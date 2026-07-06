import React, { useState, useEffect } from "react";
import { Order } from "../types";
import { Check, X, ShieldAlert, Award, AlertTriangle, HelpCircle, Calendar, RefreshCw } from "lucide-react";

interface OrderConsoleProps {
  orders: Order[];
  onOrderUpdated: () => void;
  userSession: { username: string; role: string; name: string } | null;
}

export default function OrderConsole({ orders, onOrderUpdated, userSession }: OrderConsoleProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const handleApprove = async (orderId: string) => {
    setActionLoading(orderId);
    setActionError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userSession?.username || "alice_member",
          role: userSession?.role || "member"
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Approval failed.");
      }

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
    try {
      const response = await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userSession?.username || "alice_member",
          role: userSession?.role || "member",
          reason
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Rejection failed.");
      }

      onOrderUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return o.status === "pending_approval";
    if (filterStatus === "completed") return o.status === "qc_passed" || o.status === "approved";
    if (filterStatus === "failed") return o.status === "rejected" || o.status === "qc_failed";
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200/50 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">Pending HITL</span>;
      case "approved":
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/50 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">Approved / Awaiting QC</span>;
      case "qc_passed":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">QC Passed</span>;
      case "qc_failed":
        return <span className="bg-rose-50 text-rose-700 border border-rose-200/50 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">QC Blocked</span>;
      case "rejected":
        return <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">Rejected</span>;
      default:
        return <span className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">{status}</span>;
    }
  };

  return (
    <div id="procurement-orders-console" className="space-y-4">
      {/* Category filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {[
            { value: "all", label: "All Orders" },
            { value: "pending", label: "Pending HITL Approval" },
            { value: "completed", label: "Approved / Passed" },
            { value: "failed", label: "Rejected / Failed" }
          ].map(btn => (
            <button
              key={btn.value}
              onClick={() => setFilterStatus(btn.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                filterStatus === btn.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total orders: {filteredOrders.length}
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 shadow-sm">
          ⚠️ {actionError}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-500 text-sm">
          No orders found matching status selection.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(o => {
            const needsAuthorization = o.status === "pending_approval";
            const isDirectorRequired = o.role_required === "director";
            const hasAuthority = userSession?.role === "director" || (userSession?.role === "lead" && !isDirectorRequired);

            return (
              <div
                key={o.id}
                id={`order-card-${o.id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Header */}
                <div className="bg-slate-50 px-5 py-3.5 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200/70 px-2.5 py-1 rounded">
                      {o.id}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(o.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(o.status)}
                    {needsAuthorization && (
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded border ${
                        isDirectorRequired ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-600 border-amber-100"
                      }`}>
                        Requires {o.role_required.toUpperCase()} approval
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Item summary */}
                  <div className="space-y-1 md:border-r md:border-slate-100 md:pr-4">
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Item Details</span>
                    <h5 className="font-display font-semibold text-slate-800 text-sm">{o.component_id}</h5>
                    <div className="flex justify-between text-xs text-slate-500 pt-1">
                      <span>Order Qty:</span>
                      <span className="font-mono font-medium text-slate-800">{o.qty.toLocaleString()} units</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Unit Price:</span>
                      <span className="font-mono text-slate-800">${o.unit_price.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-800 font-semibold border-t border-slate-100 pt-1.5 mt-1.5">
                      <span>Total Value:</span>
                      <span className="font-mono text-indigo-700">${o.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Pricing Compliance and Risk Check */}
                  <div className="space-y-1.5 md:border-r md:border-slate-100 md:pr-4">
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">Audit Compliance Check</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">Price Risk Level:</span>
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.2 rounded ${
                        o.price_risk === "HIGH" ? "bg-rose-100 text-rose-700" :
                        o.price_risk === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {o.price_risk}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-100 mt-1">
                      📄 <span className="italic">{o.compliance_notes || "No compliance flags recorded."}</span>
                    </p>
                    {o.approver && (
                      <div className="text-[10px] text-slate-400 font-mono pt-1">
                        Authorized by: <span className="text-slate-600 font-semibold">{o.approver}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions / HITL authorization */}
                  <div className="flex flex-col justify-center space-y-2">
                    {needsAuthorization ? (
                      hasAuthority ? (
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider block">Authorize Action</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReject(o.id, "Rejected by compliance check.")}
                              disabled={actionLoading === o.id}
                              className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 text-rose-700 font-semibold text-xs py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(o.id)}
                              disabled={actionLoading === o.id}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-lg transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-1"
                            >
                              {actionLoading === o.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center text-xs text-slate-400 flex items-center gap-2 justify-center font-mono">
                          <ShieldAlert className="w-4 h-4 text-slate-400" />
                          <span>Clearance level too low to approve.</span>
                        </div>
                      )
                    ) : (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center text-xs text-slate-500 font-sans flex items-center gap-2 justify-center">
                        <Award className="w-4 h-4 text-indigo-500" />
                        <span>Core system transaction settled.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
