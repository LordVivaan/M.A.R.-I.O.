import React, { useState, useEffect } from "react";
import { User, Order, Component } from "./types";
import Terminal from "./components/Terminal";
import InventoryList from "./components/InventoryList";
import OrderConsole from "./components/OrderConsole";
import QCCabin from "./components/QCCabin";
import ForecastingPanel from "./components/ForecastingPanel";
import AuditLedger from "./components/AuditLedger";
import WarehouseLogistics from "./components/WarehouseLogistics";
import { 
  ShieldAlert, 
  Terminal as TerminalIcon, 
  Layers, 
  FileCheck, 
  TrendingUp, 
  ShieldCheck, 
  Code2, 
  LogOut, 
  Lock, 
  Clock,
  User as UserIcon,
  MapPin
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("inventory");
  const [orders, setOrders] = useState<Order[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loginUsername, setLoginUsername] = useState("alice_member");
  const [loginPassword, setLoginPassword] = useState("member123");
  const [loginError, setLoginError] = useState("");
  const [virtualTime, setVirtualTime] = useState<string>("2026-06-28T07:25:00-07:00");

  useEffect(() => {
    // Read cached login if any
    const saved = localStorage.getItem("sc_user");
    if (saved) {
      setUser(JSON.parse(saved));
    }
    handleDataRefresh();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/orders");
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  const fetchComponents = async () => {
    try {
      const response = await fetch("/api/inventory");
      const data = await response.json();
      setComponents(data);
    } catch (err) {
      console.error("Error fetching components:", err);
    }
  };

  const fetchReservations = async () => {
    try {
      const response = await fetch("/api/reservations");
      const data = await response.json();
      setReservations(data);
    } catch (err) {
      console.error("Error fetching reservations:", err);
    }
  };

  const handleDataRefresh = () => {
    fetchOrders();
    fetchComponents();
    fetchReservations();
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem("sc_user", JSON.stringify(data.user));
      } else {
        setLoginError(data.message || "Invalid credentials.");
      }
    } catch (err) {
      setLoginError("Failed to connect to authentication backend.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("sc_user");
  };

  const incrementVirtualTime = () => {
    const dt = new Date(virtualTime);
    dt.setHours(dt.getHours() + 24);
    setVirtualTime(dt.toISOString());
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-display font-extrabold text-slate-900 tracking-tight">
            Factory Supply Chain Console
          </h2>
          <p className="mt-2 text-center text-xs text-slate-500 max-w-sm mx-auto font-mono">
            Brain vs. Muscle Procurement & Logistics Gate
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
            {loginError && (
              <div className="mb-4 p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                ⚠️ {loginError}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Employee Account (Select/Type)
                </label>
                <select
                  value={loginUsername}
                  onChange={(e) => {
                    setLoginUsername(e.target.value);
                    setLoginPassword(e.target.value === "alice_member" ? "member123" : e.target.value === "bob_lead" ? "lead123" : "director123");
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 bg-white rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="alice_member">Alice Chen (Procurement Specialist)</option>
                  <option value="bob_lead">Bob Jenkins (Supply Chain Lead)</option>
                  <option value="charlie_director">Charlie Smith (VP Procurement & Operations)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Database Passkey
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Authenticate & Unlock Console</span>
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              <span className="text-[10px] text-slate-400 font-mono">
                Encrypted SQLite database synced. Key: db_secret.key
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shortfallRiskCount = components.filter(c => c.available < c.safety_stock).length;
  const totalApprovedSpend = orders
    .filter(o => o.status === "approved" || o.status === "qc_passed")
    .reduce((acc, curr) => acc + curr.total_price, 0);
  const remainingBudget = 842500 - totalApprovedSpend;
  const remainingBudgetStr = remainingBudget.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const activeReservationsCount = reservations.filter((r) => r.status === "active").length;
  const pendingApprovalsCount = orders.filter((o) => o.status === "pending_approval").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Navigation Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 flex flex-col shrink-0 text-slate-400 border-r border-slate-800">
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold font-display">P</div>
            <span className="text-white font-display font-semibold tracking-tight uppercase text-sm italic">ProcureFlow AI</span>
          </div>
          
          <nav className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Muscle (Automations)</div>
            {[
              { id: "inventory", label: "Inventory Ledger", icon: Layers },
              { id: "approvals", label: "Procurements & HITL", icon: FileCheck },
              { id: "receipts", label: "QC Inspection Workstation", icon: ShieldAlert },
              { id: "warehouse", label: "Warehouse & Logistics", icon: MapPin },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md font-bold"
                      : "hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}

            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2">Brain (Agents)</div>
            {[
              { id: "forecasting", label: "Usage Forecasting", icon: TrendingUp },
              { id: "audit", label: "Compliance Ledger", icon: ShieldCheck },
              { id: "terminal", label: "Terminal (cli.py)", icon: TerminalIcon }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md font-bold"
                      : "hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="mt-auto p-4 bg-slate-950">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-slate-400 uppercase tracking-tighter">Core Engine: Active</span>
          </div>
          <div className="text-[10px] font-mono text-slate-600">
            V-CLOCK: {new Date(virtualTime).toLocaleDateString()}
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">Supply Chain Dashboard</h1>
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 text-[9px] rounded uppercase font-bold">Production Active</span>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Simulated Time widget */}
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 select-none text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span className="text-slate-500 font-medium font-sans">Virtual Date:</span>
              <span className="text-slate-800 font-bold font-sans">{new Date(virtualTime).toLocaleDateString()}</span>
              <button
                onClick={incrementVirtualTime}
                className="text-indigo-600 hover:text-indigo-500 font-bold pl-1.5 border-l border-slate-200 ml-1.5 cursor-pointer font-sans text-[10px]"
                title="Fast forward 24 hours"
              >
                +24H
              </button>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 uppercase">{user.name}</p>
                <p className="text-[10px] text-slate-500 uppercase">Authorized: {user.role === 'director' ? 'Lvl 3 Director' : user.role === 'lead' ? 'Lvl 2 Lead' : 'Lvl 1 Specialist'}</p>
              </div>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 font-bold text-sm font-display italic">
                  {user.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 p-2 rounded-lg border border-slate-200 hover:bg-rose-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Workspace Panels container */}
        <div className="p-8 flex flex-col gap-6 overflow-y-auto h-full">
          {/* Dynamic Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
            {/* Shortfall Risk Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Shortfall Risk</p>
              <p className="text-2xl font-bold text-rose-600">{shortfallRiskCount} Parts</p>
              <div className="mt-2 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min((shortfallRiskCount / (components.length || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Monthly Budget Cap Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Monthly Budget Cap</p>
              <p className="text-2xl font-bold text-slate-800">$842,500</p>
              <p className="text-[10px] text-emerald-600 font-medium mt-1 uppercase tracking-tighter">
                {remainingBudgetStr} Remaining
              </p>
            </div>

            {/* Active Reservations Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Active Reservations</p>
              <p className="text-2xl font-bold text-indigo-600">{activeReservationsCount}</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter italic">
                Expires in 72h (avg)
              </p>
            </div>

            {/* Pending Approval Card */}
            <div className="bg-indigo-600 border border-indigo-700 rounded-xl p-5 shadow-sm text-white">
              <p className="text-[11px] font-semibold text-indigo-100 uppercase tracking-widest mb-1">Pending Approval</p>
              <p className="text-2xl font-bold text-white uppercase tracking-tighter">{pendingApprovalsCount} Orders</p>
              <p className="text-[10px] text-indigo-200 mt-1 uppercase tracking-tighter">
                HITL Required
              </p>
            </div>
          </div>

          {/* Active Tab Component */}
          {activeTab === "inventory" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-xl tracking-tight">Factory Stock Room Inventory</h2>
                <p className="text-xs text-slate-500">Submit reservations or purchase orders matching stock demands.</p>
              </div>
              <InventoryList onOrderCreated={handleDataRefresh} userSession={user} />
            </div>
          )}

          {activeTab === "approvals" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-xl tracking-tight">HITL Authorizations Center</h2>
                <p className="text-xs text-slate-500">Lead and Director authorization queue for pending purchases.</p>
              </div>
              <OrderConsole orders={orders} onOrderUpdated={handleDataRefresh} userSession={user} />
            </div>
          )}

          {activeTab === "receipts" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-xl tracking-tight">Receipt Verification & Quality Check</h2>
                <p className="text-xs text-slate-500">Scan standard barcodes to evaluate and ingest verified batches.</p>
              </div>
              <QCCabin orders={orders} onReceiptProcessed={handleDataRefresh} userSession={user} />
            </div>
          )}

          {activeTab === "warehouse" && (
            <WarehouseLogistics userSession={user} onDataChange={handleDataRefresh} />
          )}

          {activeTab === "forecasting" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-xl tracking-tight">Usage Forecast & ADU / DSR Logs</h2>
                <p className="text-xs text-slate-500">Deterministic models tracking Safety buffers and Lead thresholds.</p>
              </div>
              <ForecastingPanel />
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-xl tracking-tight">Compliance Ledger Logs</h2>
                <p className="text-xs text-slate-500">Strict chronological audit trail representing core system operations.</p>
              </div>
              <AuditLedger />
            </div>
          )}

          {activeTab === "terminal" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-xl tracking-tight">Interactive Python CLI Terminal</h2>
                <p className="text-xs text-slate-500">Execute command parameters directly inside the virtual environment.</p>
              </div>
              <Terminal userSession={user} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
