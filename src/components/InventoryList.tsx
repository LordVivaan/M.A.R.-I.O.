import React, { useState, useEffect } from "react";
import { Component } from "../types";
import { Search, Plus, Archive, ShieldAlert, BadgePercent, MapPin, ChevronRight, Check } from "lucide-react";

interface InventoryListProps {
  onOrderCreated: () => void;
  userSession: { username: string; role: string } | null;
}

export default function InventoryList({ onOrderCreated, userSession }: InventoryListProps) {
  const [components, setComponents] = useState<Component[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedComp, setSelectedComp] = useState<Component | null>(null);
  const [actionType, setActionType] = useState<"reserve" | "order" | null>(null);
  const [actionQty, setActionQty] = useState<number>(100);
  const [actionPrice, setActionPrice] = useState<number>(1.50);
  const [actionGroup, setActionGroup] = useState("Smartphone Line A");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState(false);

  // Brain recommendation state
  const [brainAnalysis, setBrainAnalysis] = useState<any>(null);
  const [brainLoading, setBrainLoading] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await fetch("/api/inventory");
      const data = await response.json();
      setComponents(data);
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: "all", label: "All Items" },
    { value: "passive", label: "Passives" },
    { value: "semiconductor", label: "Semiconductors" },
    { value: "assembly", label: "Assemblies" },
    { value: "mechanical", label: "Mechanical" }
  ];

  const filtered = components.filter(c => {
    const matchesSearch = c.id.toLowerCase().includes(search.toLowerCase()) || 
                          c.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || c.category === category;
    return matchesSearch && matchesCategory;
  });

  const triggerAction = (comp: Component, type: "reserve" | "order") => {
    setSelectedComp(comp);
    setActionType(type);
    setActionQty(type === "reserve" ? 50 : 500);
    setActionPrice(comp.average_cost || 1.50);
    setActionSuccess(false);
    setActionError("");
    setBrainAnalysis(null);

    if (type === "order") {
      fetchBrainRecommendation(comp, 500, comp.average_cost || 1.50);
    }
  };

  const fetchBrainRecommendation = async (comp: Component, qty: number, price: number) => {
    setBrainLoading(true);
    try {
      const response = await fetch("/api/agent-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_id: comp.id,
          qty,
          unit_price: price,
          supplier: comp.supplier
        })
      });
      const data = await response.json();
      setBrainAnalysis(data);
    } catch (err) {
      console.error("Error fetching agent analysis:", err);
    } finally {
      setBrainLoading(false);
    }
  };

  const handleQtyChange = (val: number) => {
    setActionQty(val);
    if (actionType === "order" && selectedComp) {
      fetchBrainRecommendation(selectedComp, val, actionPrice);
    }
  };

  const handlePriceChange = (val: number) => {
    setActionPrice(val);
    if (actionType === "order" && selectedComp) {
      fetchBrainRecommendation(selectedComp, actionQty, val);
    }
  };

  const submitAction = async () => {
    if (!selectedComp || !actionType) return;
    setActionLoading(true);
    setActionError("");

    const endpoint = actionType === "reserve" ? "/api/reservations" : "/api/orders";
    const payload = actionType === "reserve" ? {
      component_id: selectedComp.id,
      qty: actionQty,
      production_group: actionGroup,
      username: userSession?.username || "alice_member",
      role: userSession?.role || "member"
    } : {
      component_id: selectedComp.id,
      qty: actionQty,
      unit_price: actionPrice,
      username: userSession?.username || "alice_member",
      role: userSession?.role || "member"
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to process request.");
      }

      setActionSuccess(true);
      fetchInventory();
      onOrderCreated();
      setTimeout(() => {
        setSelectedComp(null);
        setActionType(null);
      }, 1500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div id="inventory-workspace" className="space-y-4">
      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg overflow-x-auto w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                category === cat.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts by name/ID..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid of components */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading warehouse inventory...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No components found matching filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const isLow = c.available < c.safety_stock;
            return (
              <div
                key={c.id}
                id={`inventory-card-${c.id}`}
                className="bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow transition-all p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {c.id}
                    </span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                      c.status === "In Stock" ? "bg-emerald-50 text-emerald-700" :
                      c.status === "Low Stock" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {c.status === "Low Stock" && <ShieldAlert className="w-3 h-3" />}
                      {c.status}
                    </span>
                  </div>

                  <h4 className="font-display font-medium text-slate-800 text-sm mb-3 line-clamp-1">
                    {c.name}
                  </h4>

                  {/* Stock Metrics */}
                  <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Available Stock:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {c.available.toLocaleString()} / {c.stock.toLocaleString()} {c.unit}
                      </span>
                    </div>
                    {/* Linear Gauge */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLow ? "bg-amber-500" : "bg-indigo-600"}`}
                        style={{ width: `${Math.min((c.available / (c.safety_stock * 2)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Safety Margin: {c.safety_stock.toLocaleString()}</span>
                      <span>Reserved: {c.reserved}</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 mb-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.warehouse_zone}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Archive className="w-3.5 h-3.5 text-slate-400" />
                      <span>LT: {c.lead_time} days</span>
                    </div>
                    <div className="col-span-2 text-slate-400 font-mono">
                      Supplier: <span className="text-slate-600 font-sans">{c.supplier}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => triggerAction(c, "reserve")}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    Lock Stock
                  </button>
                  <button
                    onClick={() => triggerAction(c, "order")}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Purchase Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Dialog / Drawer overlay */}
      {selectedComp && actionType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-display font-semibold text-slate-800 text-base">
                {actionType === "reserve" ? "Lock Component Stock" : "Generate Purchase Order"}
              </h3>
              <button
                onClick={() => setSelectedComp(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              {actionSuccess ? (
                <div className="text-center py-8 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-display font-semibold text-slate-800 text-base">Action Submitted Successfully!</h4>
                  <p className="text-xs text-slate-500">The factory core ledger database has been updated.</p>
                </div>
              ) : (
                <>
                  {/* Part Details */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">
                    <div className="bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded-lg text-xs font-mono font-bold">
                      {selectedComp.id}
                    </div>
                    <div>
                      <h4 className="font-display font-medium text-slate-800 text-sm">{selectedComp.name}</h4>
                      <p className="text-xs text-slate-400">Normal pricing benchmark: ${selectedComp.average_cost.toFixed(3)}</p>
                    </div>
                  </div>

                  {actionError && (
                    <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                      ⚠️ {actionError}
                    </div>
                  )}

                  {/* Quantity Form Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 flex justify-between">
                      <span>Order Quantity ({selectedComp.unit}):</span>
                      {actionType === "reserve" && (
                        <span className="text-[10px] text-amber-600">
                          Max available to lock: {selectedComp.stock - selectedComp.reserved}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={actionQty}
                      onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {actionType === "order" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Offered Unit Price ($):</label>
                        <input
                          type="number"
                          step="0.001"
                          value={actionPrice}
                          onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Calculated Total Spend ($):</label>
                        <div className="w-full px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-mono font-medium">
                          ${(actionQty * actionPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Target Production Group / Line:</label>
                      <select
                        value={actionGroup}
                        onChange={(e) => setActionGroup(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="Smartphone Line A">Smartphone Line A</option>
                        <option value="Smartphone Line B">Smartphone Line B</option>
                        <option value="Smart Appliance Assembly A">Smart Appliance Assembly A</option>
                        <option value="Research & Development Labs">Research & Development Labs</option>
                      </select>
                    </div>
                  )}

                  {/* AI Agent Recommendation Segment */}
                  {actionType === "order" && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs mt-4">
                      <div className="bg-indigo-900 px-4 py-2 flex justify-between items-center text-white">
                        <span className="font-display font-medium text-xs flex items-center gap-1.5">
                          🧠 Brain Agent - Smart Compliance Risk Auditor
                        </span>
                        <span className="text-[9px] font-mono tracking-widest bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded">
                          GEMINI-3.5-FLASH
                        </span>
                      </div>
                      
                      <div className="p-4 bg-indigo-50/50 space-y-3">
                        {brainLoading ? (
                          <div className="flex items-center gap-2 text-indigo-700 text-xs py-2">
                            <span className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                            Evaluating price index variance, Safety stock buffers & Director-level caps...
                          </div>
                        ) : brainAnalysis ? (
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-medium text-indigo-800 flex items-center gap-1">
                                Risk Rating: 
                                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${
                                  brainAnalysis.risk_score > 70 ? "bg-rose-100 text-rose-700" :
                                  brainAnalysis.risk_score > 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {brainAnalysis.risk_score}/100
                                </span>
                              </span>
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                                brainAnalysis.decision === "APPROVE" ? "bg-emerald-100 text-emerald-800" :
                                brainAnalysis.decision === "REQUIRE_HITL" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                              }`}>
                                {brainAnalysis.decision === "REQUIRE_HITL" ? "Requires HITL Review" : brainAnalysis.decision}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-2.5 rounded-lg border border-indigo-100/60">
                              "{brainAnalysis.reasoning}"
                            </p>

                            <div className="space-y-1">
                              <span className="text-[10px] text-indigo-800 uppercase font-bold tracking-wider">Recommendations:</span>
                              <ul className="list-disc pl-4 text-[11px] text-slate-500 space-y-0.5">
                                {brainAnalysis.recommendations?.map((rec: string, idx: number) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">Provide input quantity to run audit risk analysis.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Submission triggers */}
                  <div className="flex gap-3 border-t border-slate-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setSelectedComp(null)}
                      className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitAction}
                      disabled={actionLoading || (actionType === "reserve" && actionQty > (selectedComp.stock - selectedComp.reserved))}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {actionLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />}
                      Submit Request
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
