import React, { useState } from 'react';
import { Terminal, Play, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CaseState, INITIAL_CASE_STATE } from '../types.js';

export const ToolPlaygroundTab: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string>('check_refund_eligibility');
  const [env, setEnv] = useState<'work' | 'testing'>('work');
  const [inputs, setInputs] = useState<Record<string, any>>({
    order_number: 'H9-10159',
    refund_type: 'order',
    email: 'palesa.naidoo1@example.com',
    phone_last4: '7500',
    customer_id: 'C1001',
    idempotency_key: 'H9-10159:order',
    reason_code: 'policy_inquiry',
    summary: 'Manual test from Tool Workbench',
  });
  const [mockVerified, setMockVerified] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  const toolsList = [
    { id: 'get_customer', name: 'Tool 1: get_customer', desc: 'Retrieve verified customer details (G1/POPIA compliant).' },
    { id: 'lookup_order', name: 'Tool 2: lookup_order', desc: 'Retrieve order, associated payments, and existing refunds.' },
    { id: 'verify_identity', name: 'Tool 3: verify_identity', desc: 'Verify email & last 4 phone digits against database.' },
    { id: 'check_refund_eligibility', name: 'Tool 4: check_refund_eligibility', desc: 'Read-only policy assessment (14-day window, thresholds).' },
    { id: 'process_refund', name: 'Tool 5: process_refund', desc: 'Atomic simulated refund with idempotency & backup.' },
    { id: 'escalate_to_human', name: 'Tool 6: escalate_to_human', desc: 'File support case to specialized queue.' },
  ];

  const handleInputChange = (field: string, val: any) => {
    setInputs((prev) => ({ ...prev, [field]: val }));
  };

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const caseState: CaseState = {
        ...INITIAL_CASE_STATE,
        customer_id: inputs.customer_id,
        order_number: inputs.order_number,
        verified: mockVerified,
        customer_consent: true,
      };

      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: selectedTool,
          params: inputs,
          caseState,
          env,
        }),
      });
      const data = await res.json();
      setResult(data.result);
    } catch (e: any) {
      setResult({ is_error: true, category: 'unavailable', message: e.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Six Support Tools Workbench (Section 4 & 6)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Directly execute any of the 6 customer support tools. Verify structured error responses, idempotency, and POPIA constraints.
          </p>
        </div>

        {/* Environment toggle */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Environment:</span>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as any)}
            className="px-2.5 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="work">data_work/</option>
            <option value="testing">testing/</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tool selector (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          {toolsList.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTool(t.id);
                setResult(null);
              }}
              className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                selectedTool === t.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold">{t.name}</div>
              <div className={`text-[11px] mt-1 ${selectedTool === t.id ? 'text-slate-300' : 'text-slate-500'}`}>
                {t.desc}
              </div>
            </button>
          ))}

          {/* Verification toggle for testing permission gates */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2 mt-4">
            <div className="font-semibold text-slate-900">Simulate Case Verification:</div>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={mockVerified}
                onChange={(e) => setMockVerified(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>verified = {mockVerified ? 'true' : 'false'} (G1 Gate)</span>
            </label>
            <p className="text-[10px] text-slate-500">
              Uncheck to test G1 permission denial enforcement.
            </p>
          </div>
        </div>

        {/* Input parameters and Result display (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-900">
                Tool Parameters: {selectedTool}
              </span>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : ''}`} />
                <span>Execute Tool</span>
              </button>
            </div>

            {/* Inputs based on selectedTool */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {['get_customer', 'verify_identity', 'escalate_to_human'].includes(selectedTool) && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">customer_id</label>
                  <input
                    type="text"
                    value={inputs.customer_id}
                    onChange={(e) => handleInputChange('customer_id', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {['lookup_order', 'check_refund_eligibility', 'process_refund', 'escalate_to_human'].includes(selectedTool) && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">order_number</label>
                  <input
                    type="text"
                    value={inputs.order_number}
                    onChange={(e) => {
                      handleInputChange('order_number', e.target.value);
                      handleInputChange('idempotency_key', `${e.target.value}:${inputs.refund_type}`);
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {selectedTool === 'verify_identity' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">email</label>
                    <input
                      type="text"
                      value={inputs.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">phone_last4</label>
                    <input
                      type="text"
                      value={inputs.phone_last4}
                      onChange={(e) => handleInputChange('phone_last4', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {['check_refund_eligibility', 'process_refund'].includes(selectedTool) && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">refund_type</label>
                  <select
                    value={inputs.refund_type}
                    onChange={(e) => {
                      handleInputChange('refund_type', e.target.value);
                      handleInputChange('idempotency_key', `${inputs.order_number}:${e.target.value}`);
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="order">order (standard order refund)</option>
                    <option value="duplicate_charge">duplicate_charge (POL-09 reversal)</option>
                  </select>
                </div>
              )}

              {selectedTool === 'process_refund' && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">idempotency_key</label>
                  <input
                    type="text"
                    value={inputs.idempotency_key}
                    onChange={(e) => handleInputChange('idempotency_key', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {selectedTool === 'escalate_to_human' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">reason_code</label>
                    <input
                      type="text"
                      value={inputs.reason_code}
                      onChange={(e) => handleInputChange('reason_code', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">summary</label>
                    <input
                      type="text"
                      value={inputs.summary}
                      onChange={(e) => handleInputChange('summary', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Structured Output Result Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">
                Structured Tool Output / Failure Object (Section 6)
              </span>
              {result && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    result.is_error ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {result.is_error ? `Error: ${result.category}` : 'Success'}
                </span>
              )}
            </div>

            <pre className="p-3 bg-slate-900 text-emerald-400 rounded text-xs font-mono overflow-x-auto min-h-[140px] max-h-[300px]">
              {result ? JSON.stringify(result, null, 2) : '// Click Execute Tool to inspect structured output'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
