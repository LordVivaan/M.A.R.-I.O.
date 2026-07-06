import React, { useState } from "react";
import { Order } from "../types";
import { Check, X, ShieldAlert, Award, QrCode, ClipboardList, Info } from "lucide-react";

interface QCCabinProps {
  orders: Order[];
  onReceiptProcessed: () => void;
  userSession: { username: string; role: string } | null;
}

export default function QCCabin({ orders, onReceiptProcessed, userSession }: QCCabinProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [batchNum, setBatchNum] = useState("BATCH-2026-X91");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Filter approved orders waiting for receipt
  const approvedOrders = orders.filter(o => o.status === "approved" || o.status === "ordered");

  const generateBarcode = () => {
    if (!selectedOrder) return "";
    return `${selectedOrder.component_id}|${selectedOrder.id}|${batchNum}`;
  };

  const handleInspection = async (passed: boolean) => {
    if (!selectedOrder) return;
    setLoading(true);
    setResult(null);

    const barcode = generateBarcode();

    try {
      const response = await fetch("/api/qc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          passed,
          username: userSession?.username || "alice_member",
          role: userSession?.role || "member"
        })
      });

      const data = await response.json();
      setResult({
        passed,
        message: data.message || (passed ? "Stock updated and average cost recalculated!" : "Marked for return.")
      });

      onReceiptProcessed();
      setSelectedOrder(null);
    } catch (err: any) {
      setResult({
        error: true,
        message: err.message || "Failed to process quality receipt."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="qc-inspection-workstation" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Approved Orders List */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h3 className="font-display font-semibold text-slate-800 text-sm">Approved Shipments Awaiting QC</h3>
        </div>

        {approvedOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
            <Award className="w-10 h-10 text-slate-200 mb-2" />
            No approved purchase orders are currently awaiting quality inspection. Go submit a new order!
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {approvedOrders.map(o => (
              <button
                key={o.id}
                onClick={() => {
                  setSelectedOrder(o);
                  setResult(null);
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  selectedOrder?.id === o.id
                    ? "bg-indigo-50/50 border-indigo-400 shadow-sm"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {o.id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Qty: {o.qty.toLocaleString()}</span>
                </div>
                <h5 className="font-display font-medium text-slate-800 text-xs truncate mb-1">
                  {o.component_id}
                </h5>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  Supplier: {o.component_id.includes("RES") ? "Mouser" : "DigiKey"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barcode & Inspection Panel */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="w-5 h-5 text-indigo-600" />
          <h3 className="font-display font-semibold text-slate-800 text-sm">Barcode Scanner & Verification Cabin</h3>
        </div>

        {result && (
          <div className={`p-4 rounded-xl border mb-4 text-xs font-medium ${
            result.error ? "bg-rose-50 text-rose-700 border-rose-200" :
            result.passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            <div className="flex items-center gap-2 font-display font-semibold text-sm mb-1">
              {result.error ? "❌ Verification Error" : result.passed ? "✔ Quality Passed" : "⚠️ Quality Blocked"}
            </div>
            {result.message}
          </div>
        )}

        {selectedOrder ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Batch Entry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Component / Part ID:</label>
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono text-slate-700">
                    {selectedOrder.component_id}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Incoming Shipment Batch Number:</label>
                  <input
                    type="text"
                    value={batchNum}
                    onChange={(e) => setBatchNum(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Barcode Mock Card */}
              <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 flex flex-col items-center space-y-3">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-semibold">Verification Barcode Sticker</span>
                {/* Simulated Barcode bars */}
                <div className="flex gap-0.5 items-center bg-white p-4 rounded-lg border border-slate-200/50 shadow-xs h-16 w-full max-w-sm justify-center overflow-hidden select-none">
                  {Array.from({ length: 45 }).map((_, i) => {
                    const width = i % 4 === 0 ? "w-[3px]" : i % 3 === 0 ? "w-[1px]" : "w-[2px]";
                    const color = i % 5 === 0 ? "bg-white" : "bg-slate-900";
                    return <div key={i} className={`h-full ${width} ${color}`} />;
                  })}
                </div>
                {/* Barcode formula */}
                <div className="bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold select-all tracking-wider text-center max-w-md w-full truncate">
                  {generateBarcode()}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <Info className="w-3.5 h-3.5" />
                  <span>Syntax: ComponentID|OrderID|BatchNumber</span>
                </div>
              </div>
            </div>

            {/* Verification Triggers */}
            <div className="border-t border-slate-100 pt-4 flex gap-3">
              <button
                onClick={() => handleInspection(false)}
                disabled={loading}
                className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 text-rose-700 font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Fail Inspection (Mark Return)
              </button>
              <button
                onClick={() => handleInspection(true)}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Pass & Add to Stock
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <QrCode className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-display font-medium text-slate-600 mb-1">Receipt Verification Terminal</h4>
            <p className="max-w-xs text-slate-400 text-center">
              Select an approved order from the left panel to scan the incoming cargo barcode, verify physical quality standards, and log cost averages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
