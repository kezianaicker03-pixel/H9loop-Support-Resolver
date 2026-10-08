import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, Table2, Layers, BookOpen } from 'lucide-react';

export const DatabaseTab: React.FC = () => {
  const [env, setEnv] = useState<'work' | 'original' | 'testing'>('work');
  const [selectedTable, setSelectedTable] = useState<string>('orders');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tablesSummary, setTablesSummary] = useState<{ table: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const tables = ['orders', 'customers', 'products', 'payments', 'refunds', 'policies', 'support_cases'];

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/database/tables?env=${env}`);
      const data = await res.json();
      setTablesSummary(data.summary || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTable = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/database/table/${t}?env=${env}`);
      const data = await res.json();
      setTableData(data.rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchTable(selectedTable);
  }, [env, selectedTable]);

  const filteredRows = tableData.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  const columns = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <div className="space-y-6">
      {/* Environment Selector and Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Database & Policy Authority Explorer (Section 3 & 10)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Explore records across isolated data environments. Verified against policies.csv as single source of truth.
          </p>
        </div>

        {/* Environment Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
          <button
            onClick={() => setEnv('work')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              env === 'work' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            data_work/ (Live)
          </button>
          <button
            onClick={() => setEnv('original')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              env === 'original' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            data_original/ (Read-Only)
          </button>
          <button
            onClick={() => setEnv('testing')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              env === 'testing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            testing/ (Resettable)
          </button>
        </div>
      </div>

      {/* Table Selector Segmented Control */}
      <div className="flex space-x-1 overflow-x-auto pb-1 text-xs">
        {tables.map((t) => {
          const isSelected = selectedTable === t;
          const count = tablesSummary.find((s) => s.table === t)?.count ?? '';
          return (
            <button
              key={t}
              onClick={() => setSelectedTable(t)}
              className={`px-3 py-2 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{t}.csv</span>
              {count !== '' && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search and Table Records */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs font-semibold text-slate-800 font-mono">
            Table: {selectedTable}.csv ({filteredRows.length} rows)
          </div>
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${selectedTable}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[550px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[10px] sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {filteredRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col) => {
                    const val = row[col];
                    // Formatter for phone numbers (POPIA G8 rule)
                    const isPhone = col === 'phone';
                    const displayVal = isPhone ? `•••• •••• ${String(val).slice(-4)}` : String(val ?? '');
                    return (
                      <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-700 max-w-xs truncate" title={String(val)}>
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
