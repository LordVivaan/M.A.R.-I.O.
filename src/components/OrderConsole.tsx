import React, { useState } from "react";
import { Order } from "../types";
import { 
  Check, X, ShieldAlert, Award, AlertTriangle, Calendar, 
  RefreshCw, CheckSquare, ShieldCheck, PlayCircle, Flame, 
  ChevronDown, ChevronUp, Layers, HelpCircle, BrainCircuit, Sparkles
} from "lucide-react";

interface OrderConsoleProps {
  orders: Order[];
  onOrderUpdated: () => void;
  userSession: { username: string; role: string; name: string } | null;
}

export default function OrderConsole({ orders, onOrderUpdated, userSession }: OrderConsoleProps) {
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  
  // MARIO Superuser Bypass Mode
  const [marioOverride, setMarioOverride] = useState<boolean>(true); // Default to true for maximum testing ease!
  
  // Interactive individual rejection drawers
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);
  const [customRejectReason, setCustomRejectReason] = useState("");

  // Bulk processing loading state
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  // Quick rejection reasons
  const QUICK_REJECT_REASONS = [
    "Over Allocated Budget Limits",
    "Supplier Unverified / Compliance Veto",
    "Price Discrepancy (Market Average Spike)",
    "Excess Quantity (DSR Safely > 180 Days)",
    "Redundant Duplicate Procurement"
  ];

  const handleApprove = async (orderId: string) => {
    setActionLoading(orderId);
    setActionError("");
    setActionSuccess("");
    try {
      const response = await fetch(`/api/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: marioOverride ? "MARIO_override" : (userSession?.username || "alice_member"),
          role: marioOverride ? "director" : (userSession?.role || "member")
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Approval failed.");
      }

      setActionSuccess(`Order ${orderId} successfully approved!`);
      onOrderUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (orderId: string, reason: string) => {
    setActionLoading(orderId);
    setActionError("");
    setActionSuccess("");
    try {
      const response = await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: marioOverride ? "MARIO_override" : (userSession?.username || "alice_member"),
          role: marioOverride ? "director" : (userSession?.role || "member"),
          reason
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Rejection failed.");
      }

      setActionSuccess(`Order ${orderId} successfully rejected.`);
      setActiveRejectId(null);
      setCustomRejectReason("");
      onOrderUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk Approve pending orders
  const handleBulkApprove = async (pendingOrders: Order[]) => {
    if (pendingOrders.length === 0) return;
    setBulkLoading(true);
    setActionError("");
    setActionSuccess("");
    
    let approvedCount = 0;
    try {
      for (const order of pendingOrders) {
        const response = await fetch(`/api/orders/${order.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: marioOverride ? "MARIO_override" : (userSession?.username || "alice_member"),
            role: marioOverride ? "director" : (userSession?.role || "member")
          })
        });
        if (response.ok) {
          approvedCount++;
        }
      }
      setActionSuccess(`Successfully approved ${approvedCount} orders in bulk!`);
      onOrderUpdated();
    } catch (err: any) {
      setActionError(`Bulk approval encountered an issue: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Reject pending orders
  const handleBulkReject = async (pendingOrders: Order[]) => {
    if (pendingOrders.length === 0) return;
    if (!window.confirm(`Are you sure you want to reject all ${pendingOrders.length} pending orders?`)) return;
    setBulkLoading(true);
    setActionError("");
    setActionSuccess("");

    let rejectedCount = 0;
    try {
      for (const order of pendingOrders) {
        const response = await fetch(`/api/orders/${order.id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: marioOverride ? "MARIO_override" : (userSession?.username || "alice_member"),
            role: marioOverride ? "director" : (userSession?.role || "member"),
            reason: "Bulk administrative clearance denial."
          })
        });
        if (response.ok) {
          rejectedCount++;
        }
      }
      setActionSuccess(`Successfully rejected ${rejectedCount} orders in bulk.`);
      onOrderUpdated();
    } catch (err: any) {
      setActionError(`Bulk rejection encountered an issue: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return o.status === "pending_approval";
    if (filterStatus === "completed") return o.status === "qc_passed" || o.status === "approved";
    if (filterStatus === "failed") return o.status === "rejected" || o.status === "qc_failed";
    return true;
  });

  const pendingQueue = orders.filter(o => o.status === "pending_approval");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200/50 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md animate-pulse">Pending Authorization</span>;
      case "approved":
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/50 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md">Approved / Awaiting Incoming QC</span>;
      case "qc_passed":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md">QC Processed &amp; Stored</span>;
      case "qc_failed":
        return <span className="bg-rose-50 text-rose-700 border border-rose-200/50 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md">QC Quarantined</span>;
      case "rejected":
        return <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md">Rejected / Denied</span>;
      default:
        return <span className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md">{status}</span>;
    }
  };

  return (
    <div id="procurement-orders-console" className="space-y-6">
      
      {/* MARIO System Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <BrainCircuit className="w-40 h-40" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                MARIO Intelligent Core
              </span>
              <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[10px] text-slate-400 font-mono">Autonomous Orchestration Active</span>
            </div>
            <h3 className="text-xl font-display font-bold tracking-tight text-white">
              Multi-Agent Reordering &amp; Inventory Orchestrator
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              MARIO monitors stock rates, safety margins, and forecasted Days of Stock Remaining (DSR). When a shortfall is detected, it auto-submits these Human-in-the-Loop (HITL) procurement orders.
            </p>
          </div>
          
          {/* MARIO Superuser Bypass Button / Selector */}
          <div className="shrink-0 bg-slate-800/80 border border-slate-700 p-4 rounded-xl space-y-2 max-w-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] text-indigo-300 font-mono font-bold block">BYPASS PROTOCOL</span>
                <label className="text-xs font-bold text-white block cursor-pointer select-none">
                  ⚡ MARIO Admin Override
                </label>
              </div>
              <button
                type="button"
                onClick={() => setMarioOverride(!marioOverride)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  marioOverride ? "bg-indigo-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    marioOverride ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              {marioOverride 
                ? "Active: Standard role barriers bypassed. All actions signed as Operations Director with instant authorization."
                : "Inactive: Approvals bound strictly by authenticated employee clearances."
              }
            </p>
          </div>
        </div>
      </div>

      {/* Main Filter & Bulk Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { value: "pending", label: `Pending HITL (${pendingQueue.length})` },
            { value: "all", label: "All Orders" },
            { value: "completed", label: "Approved / Passed" },
            { value: "failed", label: "Rejected / Failed" }
          ].map(btn => (
            <button
              key={btn.value}
              onClick={() => setFilterStatus(btn.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterStatus === btn.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Bulk Authorization Desk */}
        {filterStatus === "pending" && pendingQueue.length > 0 && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => handleBulkReject(pendingQueue)}
              disabled={bulkLoading}
              className="flex-1 md:flex-none px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Reject All ({pendingQueue.length})
            </button>
            <button
              onClick={() => handleBulkApprove(pendingQueue)}
              disabled={bulkLoading}
              className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {bulkLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Approve All ({pendingQueue.length})
            </button>
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {actionError && (
        <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 shadow-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">Error: {actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 shadow-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* Orders List / Queue */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 text-xs font-medium">
          No orders match the status filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(o => {
            const needsAuthorization = o.status === "pending_approval";
            const isDirectorRequired = o.role_required === "director";
            const hasAuthority = marioOverride || userSession?.role === "director" || (userSession?.role === "lead" && !isDirectorRequired);
            const isRejectDrawerOpen = activeRejectId === o.id;

            return (
              <div
                key={o.id}
                id={`order-card-${o.id}`}
                className={`bg-white rounded-xl border shadow-2xs overflow-hidden transition-all duration-200 ${
                  needsAuthorization 
                    ? "border-amber-300 ring-2 ring-amber-300/10 hover:border-amber-400" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Header Banner */}
                <div className={`px-5 py-3 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center border-b ${
                  needsAuthorization ? "bg-amber-50/40 border-amber-100" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded">
                      {o.id}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(o.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(o.status)}
                    {needsAuthorization && (
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-md font-bold border ${
                        isDirectorRequired ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-600 border-amber-100"
                      }`}>
                        Clearance Required: {o.role_required.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Stats Grid */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Column 1: Material and Qty details */}
                  <div className="space-y-1.5 md:border-r md:border-slate-100 md:pr-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-mono uppercase font-extrabold tracking-wider block">Material Specifications</span>
                      <h4 className="font-display font-bold text-slate-900 text-sm mt-0.5">{o.component_id}</h4>
                    </div>
                    
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Order Quantity:</span>
                        <span className="font-mono font-bold text-slate-800">{o.qty.toLocaleString()} units</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Unit Sourced Price:</span>
                        <span className="font-mono text-slate-700">${o.unit_price.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold border-t border-slate-100 pt-1.5 mt-1.5">
                        <span className="text-slate-900">Total Purchase Value:</span>
                        <span className="font-mono text-indigo-700 text-sm font-extrabold">${o.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Audit Compliance and Crawler Risk */}
                  <div className="space-y-1.5 md:border-r md:border-slate-100 md:pr-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-mono uppercase font-extrabold tracking-wider block">Security &amp; Crawler Validation</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">Pricing Risk:</span>
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md ${
                          o.price_risk === "HIGH" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                          o.price_risk === "MEDIUM" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {o.price_risk} RISK
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                      <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold mb-0.5">Audit Compliance Note:</span>
                      <p className="italic text-slate-600 font-medium leading-relaxed">
                        &ldquo;{o.compliance_notes || "No outstanding compliance warnings. System validated."}&rdquo;
                      </p>
                    </div>

                    {o.approver && (
                      <div className="text-[9px] text-slate-400 font-mono pt-1">
                        Digital Authorized Signer: <span className="text-slate-700 font-bold">{o.approver}</span>
                      </div>
                    )}
                  </div>

                  {/* Column 3: Interactive Quick Decision controls */}
                  <div className="flex flex-col justify-center">
                    {needsAuthorization ? (
                      hasAuthority ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 uppercase font-mono font-extrabold tracking-wider">Fast Action Console</span>
                            {marioOverride && (
                              <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                Override Enabled
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {/* Fast Single-Click Reject */}
                            <button
                              onClick={() => {
                                if (isRejectDrawerOpen) {
                                  setActiveRejectId(null);
                                } else {
                                  setActiveRejectId(o.id);
                                }
                              }}
                              disabled={actionLoading === o.id}
                              className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                isRejectDrawerOpen 
                                  ? "bg-slate-800 text-white border-slate-900" 
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>

                            {/* Fast Single-Click Approve */}
                            <button
                              onClick={() => handleApprove(o.id)}
                              disabled={actionLoading === o.id}
                              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-1 disabled:opacity-55"
                            >
                              {actionLoading === o.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-2 text-center text-xs text-slate-400 font-mono">
                          <ShieldAlert className="w-5 h-5 text-amber-500 animate-bounce" />
                          <span className="font-semibold text-slate-500">HITL Gate Sealed</span>
                          <span className="text-[10px] text-slate-400 leading-normal max-w-[180px]">
                            Clearance level is too low. Toggle "MARIO Admin Override" to approve.
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center gap-1.5 text-center text-xs text-emerald-800">
                        <Award className="w-5 h-5 text-emerald-600" />
                        <span className="font-bold">Transaction Settled</span>
                        <span className="text-[10px] text-emerald-600 font-mono">Status: {o.status.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Quick Rejection Drawer */}
                {isRejectDrawerOpen && (
                  <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Select Compliance Denial Reason (Press of a button)</span>
                      <button 
                        onClick={() => setActiveRejectId(null)} 
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Quick reason chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_REJECT_REASONS.map((reason, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleReject(o.id, reason)}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-md text-[11px] text-slate-700 hover:text-rose-700 font-semibold cursor-pointer transition-all"
                        >
                          ⛔ {reason}
                        </button>
                      ))}
                    </div>

                    {/* Custom reason input alternative */}
                    <div className="flex gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Or input custom rejection notes..."
                        value={customRejectReason}
                        onChange={(e) => setCustomRejectReason(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg outline-none focus:border-indigo-500 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleReject(o.id, customRejectReason || "Denied by supervisor override.")}
                        disabled={actionLoading === o.id}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
