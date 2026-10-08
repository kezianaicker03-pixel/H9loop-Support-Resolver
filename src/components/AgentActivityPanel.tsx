import React from 'react';
import { CaseState, DecisionRecord } from '../types.js';
import { Terminal, Shield, CheckCircle2, AlertTriangle, FileCode2, ArrowRight } from 'lucide-react';

interface AgentActivityPanelProps {
  caseState: CaseState;
  latestDecision?: DecisionRecord;
  latestToolCalls?: {
    tool_name: string;
    inputs: any;
    output: any;
  }[];
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  caseState,
  latestDecision,
  latestToolCalls = [],
}) => {
  const orchestrationStages = [
    'RECEIVE',
    'CLASSIFY',
    'VERIFY',
    'RETRIEVE',
    'CHECK POLICY',
    'DECIDE',
    'ACT',
    'RECORD',
    'RESPOND',
  ];

  const currentStageIndex = !caseState.verified
    ? 2 // VERIFY
    : !caseState.order_number
    ? 3 // RETRIEVE
    : latestDecision?.action === 'confirm_refund'
    ? 5 // DECIDE
    : latestDecision?.action === 'close'
    ? 8 // RESPOND
    : latestDecision?.action === 'escalate'
    ? 7 // RECORD
    : 4; // CHECK POLICY

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-4 text-slate-800 text-xs">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Terminal className="w-4 h-4 text-indigo-600" />
          <span>Agent Activity & Verified State</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          {caseState.verified ? (
            <span className="text-emerald-700 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Identity Verified (G1)
            </span>
          ) : (
            <span className="text-amber-700 flex items-center gap-1 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Verification Pending
            </span>
          )}
        </div>
      </div>

      {/* Orchestration Stage Pipeline */}
      <div>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Orchestration Cycle
        </div>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 text-[10px] font-mono">
          {orchestrationStages.map((stage, idx) => {
            const isCurrent = idx === currentStageIndex;
            const isPast = idx < currentStageIndex;
            return (
              <div
                key={stage}
                className={`px-1.5 py-1 rounded text-center truncate ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-bold'
                    : isPast
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-white border border-slate-200 text-slate-400'
                }`}
                title={stage}
              >
                {stage}
              </div>
            );
          })}
        </div>
      </div>

      {/* Exact Case Block (Section 2) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Exact Case Block (Section 2)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Typed JSON</span>
        </div>
        <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
          {JSON.stringify(
            {
              customer_id: caseState.customer_id,
              order_number: caseState.order_number,
              product_id: caseState.product_id,
              amount_zar: caseState.amount_zar,
              order_date: caseState.order_date,
              refund_type: caseState.refund_type,
              refund_id: caseState.refund_id,
              case_number: caseState.case_number,
              verified: caseState.verified,
              attempts_left: caseState.attempts_left,
            },
            null,
            2
          )}
        </pre>
      </div>

      {/* Latest Structured Decision Record (Section 7) */}
      {latestDecision && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Structured Decision Record (Section 7)
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                latestDecision.action === 'close'
                  ? 'bg-emerald-100 text-emerald-800'
                  : latestDecision.action === 'escalate'
                  ? 'bg-amber-100 text-amber-800'
                  : latestDecision.action === 'decline'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {latestDecision.action}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded p-2.5 font-mono text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Action:</span>
              <span className="font-semibold text-slate-900">{latestDecision.action}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Enforced Rules:</span>
              <span className="text-indigo-600 font-semibold">{latestDecision.rule_ids.join(', ')}</span>
            </div>
            {latestDecision.reason_code && (
              <div className="flex justify-between">
                <span className="text-slate-500">Reason Code:</span>
                <span className="text-slate-800">{latestDecision.reason_code}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Human Approval Needed:</span>
              <span className={latestDecision.needs_human_approval ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                {latestDecision.needs_human_approval ? 'Yes (Support Lead)' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tool Execution Activity */}
      <div>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Tool Invocations This Turn ({latestToolCalls.length})
        </div>
        {latestToolCalls.length === 0 ? (
          <div className="text-slate-400 italic text-[11px] bg-white p-2.5 rounded border border-slate-200">
            No external database tools called in current step.
          </div>
        ) : (
          <div className="space-y-2">
            {latestToolCalls.map((tc, index) => {
              const isError = tc.output && tc.output.is_error;
              return (
                <div key={index} className="bg-white border border-slate-200 rounded p-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
                    <span className="font-bold text-slate-900">{tc.tool_name}</span>
                    <span className={isError ? 'text-rose-600 font-bold' : 'text-emerald-600 font-medium'}>
                      {isError ? 'ERROR' : 'OK'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    Inputs: {JSON.stringify(tc.inputs)}
                  </div>
                  <div className="text-[10px] bg-slate-50 p-1.5 rounded overflow-x-auto text-slate-700">
                    {JSON.stringify(tc.output)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
