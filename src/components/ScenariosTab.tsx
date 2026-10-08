import React, { useState } from 'react';
import { TestSuiteMetrics, ScenarioResult } from '../types.js';
import { Play, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Check } from 'lucide-react';

interface ScenariosTabProps {
  metrics: TestSuiteMetrics | null;
  onRunAll: () => Promise<void>;
  onRunSingle: (id: string) => Promise<void>;
  isRunning: boolean;
  onResetTestingEnv: () => Promise<void>;
}

export const ScenariosTab: React.FC<ScenariosTabProps> = ({
  metrics,
  onRunAll,
  onRunSingle,
  isRunning,
  onResetTestingEnv,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner (Section 14) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* FCR */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            FCR Rate
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {metrics ? `${metrics.fcrRate.toFixed(0)}%` : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Target: ≥80%</div>
        </div>

        {/* Correct Escalations */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Escalation Rate
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {metrics ? `${metrics.correctEscalationRate.toFixed(0)}%` : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Target: 100%</div>
        </div>

        {/* Tool Accuracy */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Tool Accuracy
          </div>
          <div className="text-xl font-bold text-indigo-600 mt-0.5">
            {metrics ? `${metrics.toolAccuracyRate.toFixed(0)}%` : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Target: ≥95%</div>
        </div>

        {/* Policy Compliance */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Policy Check
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {metrics ? `${metrics.policyComplianceRate.toFixed(0)}%` : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Target: 100%</div>
        </div>

        {/* Duplicate Refunds */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Duplicate Refunds
          </div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">
            {metrics ? metrics.duplicateRefunds : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Target: 0</div>
        </div>

        {/* Total Scenarios Passed */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Test Score
          </div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">
            {metrics ? `${metrics.passedScenarios}/${metrics.totalScenarios}` : '--'}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            {metrics && metrics.failedScenarios === 0 ? 'All 14 Passed' : ''}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            14 Seeded Scenarios Benchmark Matrix (Section 13)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Executes independently against resettable testing data. Evaluates identity, policy rules, tools, and writes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetTestingEnv}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Test Data</span>
          </button>
          <button
            onClick={onRunAll}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running All 14...' : 'Run All 14 Scenarios'}</span>
          </button>
        </div>
      </div>

      {/* Scenarios Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">ID</th>
                <th className="py-3 px-4">Scenario / Order</th>
                <th className="py-3 px-4">Expected Outcome</th>
                <th className="py-3 px-4">Actual Outcome</th>
                <th className="py-3 px-4 text-center w-24">Status</th>
                <th className="py-3 px-4 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics?.results.map((res) => {
                const isExpanded = expandedId === res.scenarioId;
                return (
                  <React.Fragment key={res.scenarioId}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {res.scenarioId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{res.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Order: {res.orderNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {res.expectedOutcome}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-mono text-[11px]">
                        {res.actualOutcome || 'Pending execution'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {res.passed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>PASS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>FAIL</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => onRunSingle(res.scenarioId)}
                          disabled={isRunning}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                        >
                          Run
                        </button>
                        <button
                          onClick={() => toggleExpand(res.scenarioId)}
                          className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <span>Trace</span>
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Trace Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={6} className="p-4 border-t border-slate-200">
                          <div className="space-y-3">
                            <div className="text-xs font-semibold text-slate-800">
                              Scenario Execution Trace: {res.scenarioId} ({res.name})
                            </div>

                            {/* Dialogue turns */}
                            <div>
                              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Conversation Dialogue
                              </div>
                              <div className="space-y-1.5">
                                {res.turns.map((t, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className={`p-2 rounded text-xs leading-relaxed ${
                                      t.role === 'customer'
                                        ? 'bg-white border border-slate-200 text-slate-800'
                                        : 'bg-indigo-50 border border-indigo-200 text-indigo-950'
                                    }`}
                                  >
                                    <span className="font-bold capitalize">{t.role}: </span>
                                    {t.message}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Tools executed */}
                            <div>
                              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Tool Sequence Executed ({res.toolCalls.length})
                              </div>
                              <div className="space-y-1">
                                {res.toolCalls.map((tc, tcIdx) => (
                                  <div
                                    key={tcIdx}
                                    className="p-2 bg-white border border-slate-200 rounded font-mono text-[11px]"
                                  >
                                    <div className="flex justify-between font-bold text-slate-900">
                                      <span>Tool: {tc.tool_name}</span>
                                      <span className="text-emerald-600">SUCCESS</span>
                                    </div>
                                    <div className="text-slate-500 text-[10px]">
                                      Inputs: {JSON.stringify(tc.inputs)}
                                    </div>
                                    <div className="text-slate-700 text-[10px] mt-0.5 bg-slate-50 p-1 rounded">
                                      Output: {JSON.stringify(tc.output)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Final Case Block */}
                            <div>
                              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Resulting Case State Block
                              </div>
                              <pre className="p-2 bg-slate-900 text-emerald-400 rounded text-[11px] font-mono overflow-x-auto">
                                {JSON.stringify(res.caseState, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
