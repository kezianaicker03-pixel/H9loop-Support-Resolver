import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { ChatTab } from './components/ChatTab.js';
import { ScenariosTab } from './components/ScenariosTab.js';
import { CasesTab } from './components/CasesTab.js';
import { AuditTab } from './components/AuditTab.js';
import { DatabaseTab } from './components/DatabaseTab.js';
import { ToolPlaygroundTab } from './components/ToolPlaygroundTab.js';
import { ChatMessage, CaseState, DecisionRecord, TestSuiteMetrics } from './types.js';

const INITIAL_CASE: CaseState = {
  customer_id: null,
  order_number: null,
  product_id: null,
  amount_zar: null,
  order_date: null,
  refund_type: null,
  refund_id: null,
  case_number: null,
  verified: false,
  attempts_left: 2,
  customer_consent: false,
  human_approval_granted: false,
  failed_attempts_count: 0,
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-0',
    sender: 'agent',
    text: 'Welcome to H9loop Customer Support. I am your automated resolution agent. In compliance with Rule G1 and POPIA privacy guidelines, please confirm your registered email address and the last 4 digits of your telephone number before we access your order details.',
    timestamp: '10:00:00',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [caseState, setCaseState] = useState<CaseState>(INITIAL_CASE);
  const [latestDecision, setLatestDecision] = useState<DecisionRecord | undefined>();
  const [latestToolCalls, setLatestToolCalls] = useState<any[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [metrics, setMetrics] = useState<TestSuiteMetrics | null>(null);
  const [isScenariosRunning, setIsScenariosRunning] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);

  // Load scenarios on mount
  useEffect(() => {
    runAllScenarios();
  }, []);

  const runAllScenarios = async () => {
    setIsScenariosRunning(true);
    try {
      const res = await fetch('/api/scenarios/run-all', { method: 'POST' });
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error('Error running test scenarios:', e);
    } finally {
      setIsScenariosRunning(false);
    }
  };

  const runSingleScenario = async (id: string) => {
    setIsScenariosRunning(true);
    try {
      const res = await fetch(`/api/scenarios/run/${id}`, { method: 'POST' });
      const singleRes = await res.json();
      setMetrics((prev) => {
        if (!prev) return null;
        const newResults = prev.results.map((r) => (r.scenarioId === id ? singleRes : r));
        return { ...prev, results: newResults };
      });
    } catch (e) {
      console.error('Error running single scenario:', e);
    } finally {
      setIsScenariosRunning(false);
    }
  };

  const handleResetData = async (target: 'both' | 'testing' = 'both') => {
    setIsResettingDb(true);
    try {
      await fetch('/api/database/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      // If reset testing, re-run scenarios
      if (target === 'testing' || target === 'both') {
        await runAllScenarios();
      }
    } catch (e) {
      console.error('Error resetting database:', e);
    } finally {
      setIsResettingDb(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'customer',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const history = messages.map((m) => ({
        id: m.id,
        role: m.sender === 'agent' ? ('agent' as const) : ('customer' as const),
        content: m.text,
        timestamp: m.timestamp,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          caseState,
          history,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCaseState(data.case_state);
      setLatestDecision(data.decision);
      setLatestToolCalls(data.tool_calls_executed || []);

      const agentMsg: ChatMessage = {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text: data.message,
        timestamp: new Date().toLocaleTimeString(),
        toolCalls: data.tool_calls_executed,
        decision: data.decision,
        caseState: data.case_state,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'agent',
        text: `Error processing request: ${err.message}. Please try again.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleResetChat = () => {
    setCaseState(INITIAL_CASE);
    setLatestDecision(undefined);
    setLatestToolCalls([]);
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: 'New session started. In compliance with Rule G1 and POPIA privacy guidelines, please confirm your registered email address and the last 4 digits of your telephone number before we access your order details.',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetDb={() => handleResetData('both')}
        resetting={isResettingDb}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            caseState={caseState}
            onResetChat={handleResetChat}
            latestDecision={latestDecision}
            latestToolCalls={latestToolCalls}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenariosTab
            metrics={metrics}
            onRunAll={runAllScenarios}
            onRunSingle={runSingleScenario}
            isRunning={isScenariosRunning}
            onResetTestingEnv={() => handleResetData('testing')}
          />
        )}

        {activeTab === 'cases' && <CasesTab />}

        {activeTab === 'audit' && <AuditTab />}

        {activeTab === 'database' && <DatabaseTab />}

        {activeTab === 'playground' && <ToolPlaygroundTab />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            H9loop Support Resolver · South Africa · POPIA Compliance Enforced
          </div>
          <div className="flex items-center gap-3">
            <span>Reference Date: 2026-10-05</span>
            <span aria-hidden="true">·</span>
            <span>Rules: G1–G10</span>
            <span aria-hidden="true">·</span>
            <span>Architectural Safeguards: M1–M7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
