import React from 'react';
import { ShieldCheck, RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onResetDb: () => void;
  resetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onResetDb,
  resetting,
}) => {
  const tabs = [
    { id: 'chat', label: 'Support Desk' },
    { id: 'scenarios', label: '14 Scenario Test Suite' },
    { id: 'cases', label: 'Escalations & Queues' },
    { id: 'audit', label: 'POPIA Audit Trail' },
    { id: 'database', label: 'Database & Policies' },
    { id: 'playground', label: 'Tool Workbench' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      {/* Top Banner with Brand & System Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            H9
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                H9loop Support Resolver
              </h1>
              <span className="text-xs text-slate-500 font-mono">v2.0</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>South Africa</span>
              <span aria-hidden="true">·</span>
              <span>Ref Date: 2026-10-05</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">80%+ FCR Target</span>
            </div>
          </div>
        </div>

        {/* Action and Environment Controls */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 hidden md:flex items-center gap-2 pr-3 border-r border-slate-200">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Policy: policies.csv</span>
            <span aria-hidden="true">·</span>
            <span>Rules: G1–G10 Active</span>
          </div>

          <button
            onClick={onResetDb}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
            title="Reset working database to clean original records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset Data</span>
          </button>
        </div>
      </div>

      {/* Navigation Segmented Control */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 overflow-x-auto py-1 border-t border-slate-100">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
