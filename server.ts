import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { dbManager } from './src/server/db.js';
import { agentInstance } from './src/server/agent.js';
import { SupportTools, INITIAL_CASE_STATE } from './src/server/tools.js';
import { runAllScenarios, runScenario, SCENARIO_DEFINITIONS } from './src/server/scenarios.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// API Endpoints

// 1. Chat Turn with Support Resolver Agent
app.post('/api/chat', async (req, res) => {
  try {
    const { message, caseState, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const state = caseState || INITIAL_CASE_STATE;
    const response = await agentInstance.handleCustomerTurn(message, state, history || []);
    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. Scenario Testing Suite
app.get('/api/scenarios/definitions', (req, res) => {
  res.json(SCENARIO_DEFINITIONS);
});

app.post('/api/scenarios/run-all', async (req, res) => {
  try {
    const metrics = await runAllScenarios();
    res.json(metrics);
  } catch (error: any) {
    console.error('Scenario run error:', error);
    res.status(500).json({ error: error.message || 'Error executing scenarios' });
  }
});

app.post('/api/scenarios/run/:id', async (req, res) => {
  try {
    const scenario = SCENARIO_DEFINITIONS.find((s) => s.id === req.params.id);
    if (!scenario) {
      return res.status(404).json({ error: `Scenario ${req.params.id} not found` });
    }
    const result = await runScenario(scenario);
    res.json(result);
  } catch (error: any) {
    console.error('Single scenario error:', error);
    res.status(500).json({ error: error.message || 'Error executing scenario' });
  }
});

// 3. Database Management & Reset
app.post('/api/database/reset', (req, res) => {
  try {
    const target = req.body.target || 'both';
    dbManager.resetData(target);
    res.json({ success: true, message: `Successfully reset data in ${target} environment to data_original.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/database/tables', (req, res) => {
  try {
    const env = (req.query.env as 'original' | 'work' | 'testing') || 'work';
    const tables = ['customers', 'products', 'orders', 'payments', 'refunds', 'support_cases', 'policies'];
    const summary = tables.map((t) => {
      const rows = dbManager.readTable(t, env);
      return { table: t, count: rows.length };
    });
    res.json({ env, summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/database/table/:name', (req, res) => {
  try {
    const env = (req.query.env as 'original' | 'work' | 'testing') || 'work';
    const tableName = req.params.name;
    const rows = dbManager.readTable(tableName, env);
    res.json({ table: tableName, env, rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Audit Trail (POPIA Redacted)
app.get('/api/audit', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const records = dbManager.getAuditRecords(limit, true);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Policies
app.get('/api/policies', (req, res) => {
  try {
    const policies = dbManager.readTable('policies', 'work');
    res.json(policies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Direct Support Tools Execution (Developer / Inspector Panel)
app.post('/api/tools/execute', async (req, res) => {
  try {
    const { toolName, params, caseState, env } = req.body;
    const tools = new SupportTools(env || 'work');
    const state = caseState || INITIAL_CASE_STATE;

    let result: any;
    switch (toolName) {
      case 'get_customer':
        result = tools.get_customer(params.customer_id, state);
        break;
      case 'lookup_order':
        result = tools.lookup_order(params.order_number, state);
        break;
      case 'verify_identity':
        result = tools.verify_identity(params.email, params.phone_last4, state, params.customer_id);
        break;
      case 'check_refund_eligibility':
        result = tools.check_refund_eligibility(params.order_number, params.refund_type, state);
        break;
      case 'process_refund':
        result = tools.process_refund(params.order_number, params.refund_type, params.idempotency_key, state);
        break;
      case 'escalate_to_human':
        result = tools.escalate_to_human(params.reason_code, params.customer_id, params.order_number, params.summary, state);
        break;
      default:
        return res.status(400).json({ error: `Unknown tool: ${toolName}` });
    }

    res.json({ toolName, params, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite Middleware for Frontend Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`H9loop Support Resolver Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
