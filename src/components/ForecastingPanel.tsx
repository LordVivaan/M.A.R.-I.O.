import React, { useState, useEffect } from "react";
import { ShieldAlert, RefreshCw, Layers, Sparkles, TrendingUp } from "lucide-react";

export default function ForecastingPanel() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/forecasting");
      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error("Error fetching forecasting metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const criticalParts = report.filter(r => r.needs_reorder);

  return (
    <div id="forecasting-analytics-panel" className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Critical Warnings</span>
            <h3 className="font-display font-bold text-slate-800 text-lg mt-1">{criticalParts.length} Parts</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Calculated Metrics</span>
            <h3 className="font-display font-bold text-slate-800 text-lg mt-1">ADU & DSR</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Total Tracked</span>
            <h3 className="font-display font-bold text-slate-800 text-lg mt-1">{report.length} components</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main warning grid */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h3 className="font-display font-semibold text-slate-800 text-sm">Automated Supply Depletion Warnings</h3>
          </div>
          <button
            onClick={fetchForecast}
            className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Computing stock consumption logs...</div>
        ) : report.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">No analytics logs loaded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-mono select-none">
                  <th className="py-2.5 font-semibold">Component ID</th>
                  <th className="py-2.5 font-semibold">Average Daily Usage (ADU)</th>
                  <th className="py-2.5 font-semibold">Days of Stock (DSR)</th>
                  <th className="py-2.5 font-semibold">Lead Time (days)</th>
                  <th className="py-2.5 font-semibold">Reorder Needed?</th>
                  <th className="py-2.5 font-semibold text-right">Advice Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {report.map(r => (
                  <tr key={r.component_id} className={`hover:bg-slate-50/50 ${r.needs_reorder ? "bg-amber-50/10" : ""}`}>
                    <td className="py-3 font-mono font-semibold text-slate-700">{r.component_id}</td>
                    <td className="py-3 font-mono text-slate-500">{r.adu.toLocaleString()} units/day</td>
                    <td className="py-3 font-mono">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        r.dsr < 10 ? "bg-rose-100 text-rose-700" :
                        r.dsr < 25 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {r.dsr} days
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-500">{r.lead_time} days</td>
                    <td className="py-3">
                      {r.needs_reorder ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 w-fit">
                          ⚠️ Depleted
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50 w-fit">
                          ✔ Safe
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-800">
                      {r.needs_reorder ? (
                        <span className="text-indigo-600 flex items-center justify-end gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                          +{r.recommended_qty.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
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
