import React, { useState, useEffect } from 'react';
import { AuditRecord } from '../types.js';
import { ShieldCheck, Download, Search, RefreshCw, FileText } from 'lucide-react';

export const AuditTab: React.FC = () => {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit?limit=200');
      const data = await res.json();
      setRecords(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      (r.customer_id && r.customer_id.toLowerCase().includes(search.toLowerCase())) ||
      (r.order_number && r.order_number.toLowerCase().includes(search.toLowerCase())) ||
      (r.tool_name && r.tool_name.toLowerCase().includes(search.toLowerCase())) ||
      r.action.toLowerCase().includes(search.toLowerCase());

    const matchesAction = filterAction === 'all' || r.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h9loop_audit_trail_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ['id', 'timestamp', 'customer_id', 'action', 'rule_ids', 'order_number', 'amount_zar', 'tool_name', 'is_error'];
    const lines = [
      headers.join(','),
      ...records.map((r) =>
        [
          r.id,
          r.timestamp,
          r.customer_id || '',
          r.action,
          `"${r.rule_ids.join(';')}"`,
          r.order_number || '',
          r.amount_zar || '',
          r.tool_name || '',
          r.is_error ? '1' : '0',
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h9loop_audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              POPIA-Compliant Audit Trail (Section 7, 11 & 12)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full chronological ledger of every decision, tool call, policy verification, and financial write. Private phone & email fields are permanently redacted.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Filter Action:</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-2.5 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Actions</option>
            <option value="call_tool">call_tool</option>
            <option value="confirm_refund">confirm_refund</option>
            <option value="process_refund">process_refund</option>
            <option value="decline">decline</option>
            <option value="escalate">escalate</option>
            <option value="close">close</option>
          </select>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer, order, tool, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Rules</th>
                <th className="py-3 px-4">Tool Invocations</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-slate-500">
                    {r.timestamp.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-bold">
                    {r.customer_id || 'ANONYMOUS'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        r.action === 'close'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.action === 'escalate'
                          ? 'bg-amber-100 text-amber-800'
                          : r.action === 'decline'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-indigo-600 font-semibold">
                    {r.rule_ids.join(', ')}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {r.tool_name ? (
                      <span className="font-semibold text-slate-900">{r.tool_name}</span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-800">
                    {r.amount_zar ? `R${r.amount_zar.toLocaleString()}` : '--'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedRecord(r)}
                      className="px-2.5 py-1 text-[11px] font-sans font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 font-mono">
                Audit Record: {selectedRecord.id}
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-mono"
              >
                ✕
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded text-xs font-mono overflow-x-auto max-h-[400px]">
              {JSON.stringify(selectedRecord, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
