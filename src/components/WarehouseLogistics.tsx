import React, { useState, useEffect } from "react";
import { 
  Layers, MapPin, TrendingUp, Coins, Package, RefreshCw, Sliders, 
  ShieldCheck, Trash2, Plus, ArrowRightLeft, Truck, FileSpreadsheet, 
  AlertTriangle, CheckCircle, Search, Info, RotateCcw, ArrowUpDown
} from "lucide-react";
import { Component } from "../types";

interface WarehouseLogisticsProps {
  userSession: { username: string; role: string } | null;
  onDataChange?: () => void;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
}

interface Location {
  id: string;
  warehouse_id: string;
  name: string;
  zone_type: "internal" | "scrap" | "transit" | "view" | "customer";
  parent_location_id: string | null;
}

interface PutawayRule {
  id: string;
  category: string;
  source_location_id: string;
  dest_location_id: string;
  action_type: string;
}

interface ProductVariant {
  id: string;
  component_id: string;
  attribute_name: string;
  attribute_value: string;
  stock_delta: number;
}

interface LotSerial {
  id: string;
  component_id: string;
  lot_number: string;
  serial_number: string | null;
  quantity: number;
  expiration_date: string | null;
  status: "good" | "expired" | "quarantine";
}

interface StockMove {
  id: string;
  component_id: string;
  component_name: string;
  lot_id: string | null;
  qty: number;
  from_location_id: string;
  to_location_id: string;
  operation_type: "receipt" | "internal" | "delivery" | "scrap" | "adjustment";
  status: "draft" | "done";
  created_at: string;
  created_by: string;
}

interface ReorderingRule {
  id: string;
  component_id: string;
  component_name: string;
  min_qty: number;
  max_qty: number;
  active: number;
}

interface InventoryAdjustment {
  id: string;
  component_id: string;
  component_name: string;
  location_id: string;
  location_name: string;
  theoretical_qty: number;
  real_qty: number;
  status: "draft" | "completed";
  created_at: string;
}

interface ValuationItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit_price: number;
  total_valuation: number;
}

export default function WarehouseLogistics({ userSession, onDataChange }: WarehouseLogisticsProps) {
  // Navigation Tabs
  const [subTab, setSubTab] = useState<"structure" | "products" | "transfers" | "automation" | "valuation">("structure");

  // Core Data
  const [components, setComponents] = useState<Component[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [putawayRules, setPutawayRules] = useState<PutawayRule[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [lots, setLots] = useState<LotSerial[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [reorderingRules, setReorderingRules] = useState<ReorderingRule[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Transfer Form State
  const [txComp, setTxComp] = useState("");
  const [txLot, setTxLot] = useState("");
  const [txQty, setTxQty] = useState<number>(100);
  const [txFrom, setTxFrom] = useState("WH-MAIN-INCOMING");
  const [txTo, setTxTo] = useState("WH-MAIN-ZONE-B");
  const [txOp, setTxOp] = useState<"receipt" | "internal" | "delivery" | "scrap">("internal");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");
  const [txSuccess, setTxSuccess] = useState("");

  // Reordering Rule Form
  const [editingRuleComp, setEditingRuleComp] = useState("");
  const [ruleMin, setRuleMin] = useState<number>(100);
  const [ruleMax, setRuleMax] = useState<number>(1000);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleSuccess, setRuleSuccess] = useState("");

  // Physical Count Adjustment Form
  const [adjComp, setAdjComp] = useState("");
  const [adjLoc, setAdjLoc] = useState("WH-MAIN-ZONE-A");
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjSuccess, setAdjSuccess] = useState("");
  const [adjError, setAdjError] = useState("");

  // Valuation Model
  const [valMethod, setValMethod] = useState<"AVCO" | "FIFO" | "Standard">("AVCO");
  const [valReport, setValReport] = useState<{ total_portfolio_valuation: number; items: ValuationItem[] } | null>(null);
  const [valLoading, setValLoading] = useState(false);

  // Fetch all metadata
  useEffect(() => {
    fetchCoreData();
  }, [subTab, valMethod]);

  const fetchCoreData = async () => {
    setLoading(true);
    try {
      // Parallel loading
      const [
        compsRes,
        whsRes,
        locsRes,
        rulesRes,
        variantsRes,
        lotsRes,
        movesRes,
        reordersRes,
        adjsRes
      ] = await Promise.all([
        fetch("/api/inventory").then(r => r.json()),
        fetch("/api/erp/warehouses").then(r => r.json()),
        fetch("/api/erp/locations").then(r => r.json()),
        fetch("/api/erp/putaway-rules").then(r => r.json()),
        fetch("/api/erp/product-variants").then(r => r.json()),
        fetch("/api/erp/lots").then(r => r.json()),
        fetch("/api/erp/stock-moves").then(r => r.json()),
        fetch("/api/erp/reordering-rules").then(r => r.json()),
        fetch("/api/erp/adjustments").then(r => r.json())
      ]);

      setComponents(compsRes || []);
      setWarehouses(whsRes || []);
      setLocations(locsRes || []);
      setPutawayRules(rulesRes || []);
      setProductVariants(variantsRes || []);
      setLots(lotsRes || []);
      setStockMoves(movesRes || []);
      setReorderingRules(reordersRes || []);
      setAdjustments(adjsRes || []);

      if (compsRes && compsRes.length > 0 && !txComp) {
        setTxComp(compsRes[0].id);
        setEditingRuleComp(compsRes[0].id);
        setAdjComp(compsRes[0].id);
      }

      // Fetch financial valuation
      setValLoading(true);
      const valRes = await fetch(`/api/erp/valuation?method=${valMethod}`);
      const valData = await valRes.json();
      setValReport(valData);
    } catch (err) {
      console.error("Error fetching ERP data:", err);
    } finally {
      setLoading(false);
      setValLoading(false);
    }
  };

  // Submit Stock Move Operation
  const handleStockMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxLoading(true);
    setTxError("");
    setTxSuccess("");

    try {
      const response = await fetch("/api/erp/stock-moves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_id: txComp,
          lot_id: txLot || null,
          qty: txQty,
          from_location_id: txFrom,
          to_location_id: txTo,
          operation_type: txOp,
          username: userSession?.username || "system",
          role: userSession?.role || "member"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to execute stock move.");
      }

      setTxSuccess(data.message);
      fetchCoreData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      setTxError(err.message);
    } finally {
      setTxLoading(false);
    }
  };

  // Submit Reordering Rule
  const handleReorderRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleLoading(true);
    setRuleSuccess("");

    try {
      const response = await fetch("/api/erp/reordering-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_id: editingRuleComp,
          min_qty: ruleMin,
          max_qty: ruleMax,
          username: userSession?.username || "system",
          role: userSession?.role || "member"
        })
      });

      const data = await response.json();
      if (response.ok) {
        setRuleSuccess(`Min/Max reorder safety rule updated successfully!`);
        fetchCoreData();
      }
    } catch (err) {
      console.error("Error updating reordering rule:", err);
    } finally {
      setRuleLoading(false);
    }
  };

  // Submit Physical Count Adjustment
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjLoading(true);
    setAdjError("");
    setAdjSuccess("");

    try {
      const response = await fetch("/api/erp/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_id: adjComp,
          location_id: adjLoc,
          real_qty: adjQty,
          username: userSession?.username || "system",
          role: userSession?.role || "member"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to submit cycle count adjustment.");
      }

      setAdjSuccess("Cycle count finalized. System database quantities successfully calibrated.");
      fetchCoreData();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      setAdjError(err.message);
    } finally {
      setAdjLoading(false);
    }
  };

  // Helper for status classes
  const getLotStatusClass = (status: "good" | "expired" | "quarantine") => {
    switch (status) {
      case "good": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "quarantine": return "bg-amber-50 text-amber-700 border-amber-200";
      case "expired": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getOpBadgeClass = (op: string) => {
    switch (op) {
      case "receipt": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "delivery": return "bg-teal-50 text-teal-700 border-teal-200";
      case "scrap": return "bg-rose-50 text-rose-700 border-rose-200";
      case "internal": return "bg-sky-50 text-sky-700 border-sky-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Block */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-slate-900 tracking-tight">Warehouse Structure &amp; Logistics Hub</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            A real-time physical control suite for smart factory materials. Orchestrate Warehouses, Locations, Putaway logic, Traceable Lots, Cycle Counting calibration, and precise Financial Valuation models.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchCoreData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Core
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {[
          { id: "structure", label: "Warehouse Structure & Rules", icon: MapPin },
          { id: "products", label: "Products, Batches & Lots", icon: Package },
          { id: "transfers", label: "Material Transfer Desk", icon: ArrowRightLeft },
          { id: "automation", label: "Automation & Cycle Count", icon: Sliders },
          { id: "valuation", label: "Financial Inventory Valuation", icon: Coins },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive 
                  ? "bg-slate-900 text-white font-semibold shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub Tab Content */}
      <div className="transition-all duration-200">
        
        {/* TAB 1: STRUCTURE */}
        {subTab === "structure" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Warehouses */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-display font-semibold text-sm text-slate-900">Physical Warehouses</h3>
                </div>
                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-semibold uppercase">
                  {warehouses.length} Active
                </span>
              </div>
              <div className="space-y-3">
                {warehouses.map(wh => (
                  <div key={wh.id} className="p-4 rounded-xl border border-slate-100 hover:border-indigo-100 bg-slate-50/50 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800">{wh.name}</span>
                      <span className="text-[10px] font-mono bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-bold">{wh.code}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{wh.address}</p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Unique ID: <strong className="font-mono">{wh.id}</strong></span>
                      <span className="text-indigo-600 font-semibold flex items-center gap-0.5">Connected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Locations (Aisle/Shelf/Scrap) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-display font-semibold text-sm text-slate-900">Specific Zones &amp; Locations</h3>
                </div>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-semibold uppercase">
                  {locations.length} Sub-Zones
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
                {locations.map(loc => (
                  <div key={loc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-xs text-slate-800 block">{loc.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">ID: {loc.id}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border capitalize font-semibold ${
                      loc.zone_type === "internal" ? "bg-sky-50 text-sky-700 border-sky-100" :
                      loc.zone_type === "transit" ? "bg-amber-50 text-amber-700 border-amber-100" :
                      loc.zone_type === "scrap" ? "bg-rose-50 text-rose-700 border-rose-100" :
                      "bg-slate-50 text-slate-600 border-slate-200"
                    }`}>
                      {loc.zone_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Putaway Routing Rules */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                <h3 className="font-display font-semibold text-sm text-slate-900">Putaway Routing Rules</h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Putaway routing maps arriving categories immediately to their safe target warehouses to avoid bottlenecks and cross-contamination.
              </p>
              <div className="space-y-3">
                {putawayRules.map(rule => (
                  <div key={rule.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                        {rule.category} Category
                      </span>
                      <span className="text-[10px] text-indigo-600 font-semibold">Auto Transfer</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                      <span className="font-medium text-slate-800">{rule.source_location_id}</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="font-medium text-indigo-600">{rule.dest_location_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS & BATCHES */}
        {subTab === "products" && (
          <div className="space-y-6">
            {/* Traceability Lots */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-900">Inventory Traceability: Lots &amp; Serial Numbers</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Real-time batch serialization tracking with strict expiration control for physical chips and mechanical hardware.</p>
                </div>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-1 rounded-lg">
                  Traceable Quantity: {lots.reduce((acc, curr) => acc + curr.quantity, 0).toLocaleString()} pcs
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold bg-slate-50/50">
                      <th className="py-3 px-4">Component ID</th>
                      <th className="py-3 px-4">Internal Batch Lot</th>
                      <th className="py-3 px-4">Unique Serial Number</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4">Expiration Date</th>
                      <th className="py-3 px-4">QC Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lots.map(lot => (
                      <tr key={lot.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{lot.component_id}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{lot.lot_number}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {lot.serial_number ? lot.serial_number : <span className="text-slate-300 italic">N/A (Bulk Lot)</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold font-mono text-slate-800">{lot.quantity.toLocaleString()}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {lot.expiration_date ? lot.expiration_date : <span className="text-slate-300">Indefinite</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getLotStatusClass(lot.status)}`}>
                            {lot.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Variants */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-800" />
                <h3 className="font-display font-semibold text-sm text-slate-900">Product Templates &amp; Attribute Variants</h3>
              </div>
              <p className="text-xs text-slate-500">
                Avoid master catalog inflation. Manage colors, packaging sizes, and physical models under standard component parents with dynamically-calculated stock offsets.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {productVariants.map(variant => (
                  <div key={variant.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
                        <span>ID: {variant.id}</span>
                        <span className="font-bold text-indigo-600">Variant</span>
                      </div>
                      <span className="font-bold text-xs text-slate-800 block mb-1">{variant.component_id}</span>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-slate-500 font-medium">{variant.attribute_name}:</span>
                        <span className="text-[11px] bg-white text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-2xs">
                          {variant.attribute_value}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Dedicated Stock Delta:</span>
                      <strong className="font-mono text-indigo-600">+{variant.stock_delta.toLocaleString()} pcs</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSFERS */}
        {subTab === "transfers" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Quick Action Controller */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <h3 className="font-display font-semibold text-sm text-slate-900">Transfer Operator Console</h3>
              </div>
              <p className="text-[11px] text-slate-500">Perform real-time stock allocation across transit points, internal cells, scrap reserves, or mock delivery routes.</p>
              
              <form onSubmit={handleStockMoveSubmit} className="space-y-4 text-xs">
                {/* Op Type */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">Movement Operation Type</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                    {[
                      { id: "receipt", label: "Receipt", sub: "Add stock" },
                      { id: "internal", label: "Internal", sub: "Relocate" },
                      { id: "delivery", label: "Delivery", sub: "Deduct" },
                      { id: "scrap", label: "Scrap", sub: "Write-off" }
                    ].map(op => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setTxOp(op.id as any);
                          if (op.id === "receipt") {
                            setTxFrom("VIRTUAL-CUSTOMER");
                            setTxTo("WH-MAIN-INCOMING");
                          } else if (op.id === "delivery") {
                            setTxFrom("WH-MAIN-ZONE-B");
                            setTxTo("VIRTUAL-CUSTOMER");
                          } else if (op.id === "scrap") {
                            setTxFrom("WH-MAIN-ZONE-B");
                            setTxTo("WH-MAIN-SCRAP");
                          }
                        }}
                        className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                          txOp === op.id 
                            ? "bg-white border-slate-300 text-slate-950 font-bold shadow-2xs" 
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <span className="block font-semibold text-[11px]">{op.label}</span>
                        <span className="block text-[9px] text-slate-400 font-normal">{op.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Component Select */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Material / Component</label>
                  <select 
                    value={txComp} 
                    onChange={(e) => setTxComp(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-indigo-500 bg-white"
                  >
                    {components.map(c => (
                      <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Lot Select */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Lot / Batch Number (Optional)</label>
                  <select 
                    value={txLot} 
                    onChange={(e) => setTxLot(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-indigo-500 bg-white"
                  >
                    <option value="">-- No Lot (General stock allocation) --</option>
                    {lots.filter(l => l.component_id === txComp).map(l => (
                      <option key={l.id} value={l.lot_number}>{l.lot_number} ({l.quantity} pcs left)</option>
                    ))}
                  </select>
                </div>

                {/* Qty & Zones */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Qty</label>
                    <input 
                      type="number" 
                      value={txQty}
                      onChange={(e) => setTxQty(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">From</label>
                    <select 
                      value={txFrom}
                      onChange={(e) => setTxFrom(e.target.value)}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    >
                      <option value="VIRTUAL-CUSTOMER">VIRTUAL-CUSTOMER</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">To</label>
                    <select 
                      value={txTo}
                      onChange={(e) => setTxTo(e.target.value)}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    >
                      <option value="VIRTUAL-CUSTOMER">VIRTUAL-CUSTOMER</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.id}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notifications info */}
                {txError && (
                  <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 text-xs flex gap-1.5 items-start">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{txError}</span>
                  </div>
                )}

                {txSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs flex gap-1.5 items-start">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{txSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={txLoading}
                  className="w-full bg-slate-900 text-white p-3 rounded-lg hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                >
                  {txLoading ? "Executing ERP Move..." : "Dispatch Stock Move"}
                </button>
              </form>
            </div>

            {/* Stock Moves Ledger (Historical list) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-900">Historical Move Ledger</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Physical ledger showing stock arrivals, scannable internal swaps, and customer outputs.</p>
                  </div>
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded border">
                    {stockMoves.length} Logged Moves
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold bg-slate-50/50">
                        <th className="py-2.5 px-3">Move ID</th>
                        <th className="py-2.5 px-3">Material</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3">Route (From &rarr; To)</th>
                        <th className="py-2.5 px-3">Op Type</th>
                        <th className="py-2.5 px-3">Executed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockMoves.map(sm => (
                        <tr key={sm.id} className="hover:bg-slate-50/30">
                          <td className="py-2.5 px-3 font-mono text-slate-500">{sm.id}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block text-[11px]">{sm.component_id}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">{sm.component_name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold font-mono text-slate-800">+{sm.qty}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-slate-600">{sm.from_location_id}</span>
                            <span className="text-slate-400 mx-1">&rarr;</span>
                            <span className="text-indigo-600 font-medium">{sm.to_location_id}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${getOpBadgeClass(sm.operation_type)}`}>
                              {sm.operation_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{sm.created_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUTOMATION & ADJUSTMENT */}
        {subTab === "automation" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Min-Max Safety Reordering Rules */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-900">Safety Stock &amp; Reordering Rules</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automate purchase requisitions. When stock drops below Min, the brain triggers a procurement proposal to reach Max.</p>
                </div>
                <span className="text-[10px] font-mono bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-200 uppercase font-semibold">
                  Rule Enabled
                </span>
              </div>

              {/* Dynamic Form to adjust rules */}
              <form onSubmit={handleReorderRuleSubmit} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="text-xs">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Component</label>
                  <select 
                    value={editingRuleComp}
                    onChange={(e) => {
                      setEditingRuleComp(e.target.value);
                      const existing = reorderingRules.find(r => r.component_id === e.target.value);
                      if (existing) {
                        setRuleMin(existing.min_qty);
                        setRuleMax(existing.max_qty);
                      }
                    }}
                    className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                  >
                    {components.map(c => (
                      <option key={c.id} value={c.id}>{c.id}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Min Threshold</label>
                  <input 
                    type="number" 
                    value={ruleMin}
                    onChange={(e) => setRuleMin(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-1.5 rounded-lg bg-white font-mono"
                  />
                </div>
                <div className="text-xs space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Max Capacity</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={ruleMax}
                      onChange={(e) => setRuleMax(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-200 p-1.5 rounded-lg bg-white font-mono"
                    />
                    <button
                      type="submit"
                      disabled={ruleLoading}
                      className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-semibold cursor-pointer transition-all disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>

              {ruleSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] border border-emerald-100 font-medium">
                  {ruleSuccess}
                </div>
              )}

              {/* Rules list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Material</th>
                      <th className="py-2 px-3 text-right">Min Trigger</th>
                      <th className="py-2 px-3 text-right">Max Stock Target</th>
                      <th className="py-2 px-3">Auto Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reorderingRules.map(rr => {
                      const comp = components.find(c => c.id === rr.component_id);
                      const currentStock = comp ? comp.stock : 0;
                      const breached = currentStock < rr.min_qty;
                      return (
                        <tr key={rr.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-800">{rr.component_id}</span>
                            <span className="text-[10px] text-slate-400 block">{rr.component_name}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 font-semibold">{rr.min_qty.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono text-indigo-600 font-bold">{rr.max_qty.toLocaleString()}</td>
                          <td className="py-2 px-3">
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                              breached 
                                ? "bg-rose-50 text-rose-700 border-rose-200" 
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                              {breached ? "SHORTFALL REORDER TRIPPED" : "STOCK SAFE"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cycle Counting Calibration / Physical Adjustment */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <h3 className="font-display font-semibold text-sm text-slate-900">Cycle Counting Workstation</h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Correct database discrepancy instantly. Inputting the physical shelf quantity overwrites standard stock counts and generates a strict compliance trace record in the system ledger.
              </p>

              <form onSubmit={handleAdjustmentSubmit} className="space-y-4 text-xs bg-slate-50/40 p-4 rounded-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Material</label>
                    <select
                      value={adjComp}
                      onChange={(e) => {
                        setAdjComp(e.target.value);
                        const comp = components.find(c => c.id === e.target.value);
                        if (comp) setAdjQty(comp.stock);
                      }}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    >
                      {components.map(c => (
                        <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Verified Storage zone</label>
                    <select
                      value={adjLoc}
                      onChange={(e) => setAdjLoc(e.target.value)}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    >
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Actual Physical Counted Qty (Shelf verification)</label>
                  <input
                    type="number"
                    value={adjQty}
                    onChange={(e) => setAdjQty(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg bg-white font-mono text-sm"
                  />
                </div>

                {adjError && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px]">
                    {adjError}
                  </div>
                )}

                {adjSuccess && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold">
                    {adjSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={adjLoading}
                  className="w-full bg-slate-900 text-white p-2.5 rounded-lg hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                >
                  {adjLoading ? "Calibrating..." : "Finalize Verification & Overwrite Count"}
                </button>
              </form>

              {/* Adjustments historical list */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Adjustment Audit Log</h4>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {adjustments.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic block">No cycle counts submitted yet this session.</span>
                  ) : (
                    adjustments.map(ia => (
                      <div key={ia.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/20 text-[11px] flex justify-between items-center">
                        <div>
                          <strong className="text-slate-800">{ia.component_id}</strong> @ {ia.location_id}
                          <p className="text-[9px] text-slate-400 mt-0.5">{new Date(ia.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-slate-400">Theor: {ia.theoretical_qty}</span>
                          <span className="mx-1.5">&rarr;</span>
                          <strong className="text-indigo-600">Real: {ia.real_qty}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: VALUATION */}
        {subTab === "valuation" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-900">Advanced Inventory Valuation Ledger</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Compare visual valuations side-by-side using FIFO, AVCO (Average Cost), or standard purchase cost rules instantly.
                </p>
              </div>

              {/* Valuation methodology select */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
                {[
                  { id: "AVCO", label: "Weighted AVCO" },
                  { id: "FIFO", label: "FIFO Mode" },
                  { id: "Standard", label: "Standard Price" }
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setValMethod(method.id as any)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                      valMethod === method.id 
                        ? "bg-white text-slate-900 shadow-2xs" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Big Portfolio Stat */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">Total Factory Portfolio Valuation ({valMethod})</span>
                <div className="text-3xl font-mono font-bold tracking-tight text-white mt-1">
                  ${valReport?.total_portfolio_valuation?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex gap-4 text-xs font-mono">
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">Materials Registered</span>
                  <strong className="text-emerald-400 text-sm">{components.length} Items</strong>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">Weighted Method</span>
                  <strong className="text-indigo-400 text-sm uppercase">{valMethod}</strong>
                </div>
              </div>
            </div>

            {/* Valuation Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold bg-slate-50/50">
                    <th className="py-3 px-4">Component ID</th>
                    <th className="py-3 px-4">Component Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Stock Level</th>
                    <th className="py-3 px-4 text-right">Computed Unit Cost</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-900">Total Material Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {valReport?.items?.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/30">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{item.id}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{item.name}</td>
                      <td className="py-3 px-4 capitalize text-slate-600">{item.category}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">{item.stock.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">${item.total_valuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
