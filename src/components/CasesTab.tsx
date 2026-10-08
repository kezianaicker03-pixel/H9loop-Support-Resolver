import React, { useState, useEffect } from 'react';
import { SupportCase } from '../types.js';
import { Users, ShieldAlert, CheckCircle, Clock, Search, ExternalLink } from 'lucide-react';

export const CasesTab: React.FC = () => {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<SupportCase | null>(null);
  const [takeoverNotes, setTakeoverNotes] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'in_progress'>('resolved');

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/database/table/support_cases?env=work');
      const data = await res.json();
      setCases(data.rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const filteredCases = cases.filter(
    (c) =>
      c.case_number.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(search.toLowerCase()) ||
      c.summary.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const openCasesCount = cases.filter((c) => c.status === 'open').length;
  const resolvedCasesCount = cases.filter((c) => c.status === 'resolved').length;

  const handleTakeoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    // Update case in state
    setCases((prev) =>
      prev.map((c) =>
        c.case_number === selectedCase.case_number
          ? {
              ...c,
              status: resolutionStatus,
              summary: `${c.summary} | [Support Lead Note: ${takeoverNotes}]`,
            }
          : c
      )
    );
    setSelectedCase(null);
    setTakeoverNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Queues Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Queue</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{cases.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total Tracked Support Cases</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">{openCasesCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Requiring Human Lead Action</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Resolved Cases</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{resolvedCasesCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Closed or Settled Outcomes</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Triage Queue SLA</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">1h – 24h</div>
          <div className="text-[11px] text-slate-500 mt-1">Security 1h · Support Lead 24h</div>
        </div>
      </div>

      {/* Cases Table Header and Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Escalation Queues & Case Dashboard (Section 9 & 12)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Support Lead review inbox. Human leads can inspect audit context, take over cases, and finalize outcomes.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by case #, customer, queue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Case #</th>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Opened Date</th>
                <th className="py-3 px-4">Category / Queue</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Summary & Assigned Queue</th>
                <th className="py-3 px-4 text-right">Human Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCases.map((c) => (
                <tr key={c.case_number} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {c.case_number}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {c.customer_id}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    {c.opened_date}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 capitalize">
                    {c.category}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        c.status === 'open' ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.status === 'open' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      ></span>
                      <span className="capitalize">{c.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-md truncate" title={c.summary}>
                    {c.summary}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedCase(c)}
                      className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                    >
                      Review / Takeover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Human Takeover Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Support Lead Review & Takeover: {selectedCase.case_number}
              </h3>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-200">
              <div><strong className="text-slate-900">Customer:</strong> {selectedCase.customer_id}</div>
              <div><strong className="text-slate-900">Opened Date:</strong> {selectedCase.opened_date}</div>
              <div><strong className="text-slate-900">Category:</strong> {selectedCase.category}</div>
              <div><strong className="text-slate-900">Summary:</strong> {selectedCase.summary}</div>
            </div>

            <form onSubmit={handleTakeoverSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Decision
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="resolved">Approve & Resolve Case</option>
                  <option value="in_progress">Keep In Progress (Investigating)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Support Lead Supervisor Notes
                </label>
                <textarea
                  rows={3}
                  value={takeoverNotes}
                  onChange={(e) => setTakeoverNotes(e.target.value)}
                  placeholder="Record supervisor review decision, rationale, and instructions..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                >
                  Submit Supervisor Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
