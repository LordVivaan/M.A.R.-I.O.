export interface Component {
  id: string;
  name: string;
  category: "passive" | "semiconductor" | "assembly" | "mechanical";
  stock: number;
  reserved: number;
  average_cost: number;
  lead_time: number;
  safety_stock: number;
  warehouse_zone: string;
  supplier: string;
  unit: string;
  available: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

export interface Order {
  id: string;
  component_id: string;
  qty: number;
  unit_price: number;
  total_price: number;
  status: "pending_approval" | "approved" | "rejected" | "ordered" | "received" | "qc_passed" | "qc_failed";
  role_required: "member" | "lead" | "director";
  approver: string | null;
  created_at: string;
  updated_at: string;
  compliance_notes: string;
  price_risk: "LOW" | "MEDIUM" | "HIGH";
}

export interface Reservation {
  id: string;
  component_id: string;
  qty: number;
  production_group: string;
  status: "active" | "expired" | "fulfilled";
  created_at: string;
  expires_at: string;
}

export interface AuditLog {
  timestamp: string;
  username: string;
  role: string;
  action: string;
  details: any;
}

export interface User {
  username: string;
  name: string;
  role: "member" | "lead" | "director";
  title: string;
}

export interface BrainAnalysis {
  decision: "APPROVE" | "REQUIRE_HITL" | "REJECT";
  risk_score: number;
  reasoning: string;
  compliance_status: "PASSED" | "FAILED";
  recommendations: string[];
}
