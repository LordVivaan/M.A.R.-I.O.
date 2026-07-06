import React, { useState, useEffect } from "react";
import { AuditLog } from "../types";
import { ClipboardList, Shield, Search, RefreshCw } from "lucide-react";

export default function AuditLedger() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/logs");
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase();
    return log.action.toLowerCase().includes(term) ||
           log.username.toLowerCase().includes(term) ||
           JSON.stringify(log.details).toLowerCase().includes(term);
  });

  return (
    <div id="audit-ledger-workspace" className="space-y-4">
      {/* Search and refresh tools */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit records..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <button
          onClick={fetchLogs}
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Log Ledger
        </button>
      </div>

      {/* Grid records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span className="font-display font-semibold text-slate-800 text-sm">Secure Audit Compliance Trail</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase font-bold">Encrypted at rest</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Accessing hardware security module...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">No ledger records found matching the criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-mono select-none bg-slate-50/50">
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Authorized User</th>
                  <th className="py-2.5 px-4 font-semibold">Action Trigger</th>
                  <th className="py-2.5 px-4 font-semibold">Transaction Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-mono text-[11px]">
                {filteredLogs.map((log, index) => (
                  <tr key={index} className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700">{log.username}</span>{" "}
                      <span className="text-[10px] uppercase bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-bold">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-indigo-700 font-bold">{log.action}</td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-xs" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
