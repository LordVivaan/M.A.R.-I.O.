"""
Procurement & Supply Chain Logistics System - Core Orchestrator
Coordinates all deterministic business rules (Muscle) and connects with
AI agents (Brain) for compliance, pricing risk, and intelligent recommendations.
"""

import uuid
from datetime import datetime, timedelta
from python_system.db import EncryptedDB
from python_system.crawler import PriceCrawler
from python_system.notifier import Notifier

class CoreEngine:
    def __init__(self, db: EncryptedDB, mock_notifications: bool = True):
        self.db = db
        self.crawler = PriceCrawler(db)
        self.notifier = Notifier(mock_mode=mock_notifications)
        self.current_user = None
        self.current_role = None

    # --- Authentication & Session Management ---
    def login(self, username: str, password: str) -> bool:
        """Verifies credentials and establishes active CLI session."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash, role, full_name FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if row and self.db.verify_password(password, row['password_hash']):
            self.current_user = username
            self.current_role = row['role']
            self.db.log_action(username, row['role'], "USER_LOGIN", {"full_name": row['full_name']})
            return True
        return False

    def logout(self):
        """Clears current active CLI session."""
        if self.current_user:
            self.db.log_action(self.current_user, self.current_role, "USER_LOGOUT", {})
        self.current_user = None
        self.current_role = None

    def require_auth(self, required_roles: list[str] = None):
        """Validates if current user has the authority to execute an operation."""
        if not self.current_user:
            raise PermissionError("Authentication required. Please login first.")
        if required_roles and self.current_role not in required_roles:
            raise PermissionError(f"Access Denied. Required roles: {required_roles}. Current role: {self.current_role}")

    # --- Inventory Management ---
    def get_inventory(self, category: str = None) -> list[dict]:
        """Retrieves list of electronic components and real-time stock levels."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        if category:
            cursor.execute("SELECT * FROM components WHERE category = ?", (category,))
        else:
            cursor.execute("SELECT * FROM components")
        
        rows = cursor.fetchall()
        result = []
        for r in rows:
            comp = dict(r)
            # Compute availability status
            available = comp['stock'] - comp['reserved']
            if available <= 0:
                status = "Out of Stock"
            elif available < comp['safety_stock']:
                status = "Low Stock"
            else:
                status = "In Stock"
            comp['available'] = available
            comp['status'] = status
            result.append(comp)
        return result

    # --- Production Reservations ---
    def create_reservation(self, component_id: str, qty: int, production_group: str) -> dict:
        """Reserve component stock exclusively for production line (expires in 30 days)."""
        self.require_auth(["member", "lead", "director"])
        
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        # Verify component exists
        cursor.execute("SELECT stock, reserved FROM components WHERE id = ?", (component_id,))
        comp = cursor.fetchone()
        if not comp:
            raise ValueError(f"Component '{component_id}' not found.")
        
        available = comp['stock'] - comp['reserved']
        if qty > available:
            raise ValueError(f"Insufficient stock available. Requested: {qty}, Available: {available}")
        
        resv_id = f"RESV-{uuid.uuid4().hex[:6].upper()}"
        created = datetime.utcnow()
        expires = created + timedelta(days=30)
        
        # Insert reservation
        cursor.execute("""
        INSERT INTO reservations (id, component_id, qty, production_group, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
        """, (resv_id, component_id, qty, production_group, created.isoformat(), expires.isoformat()))
        
        # Update component reservations count
        cursor.execute("""
        UPDATE components SET reserved = reserved + ? WHERE id = ?
        """, (qty, component_id))
        
        conn.commit()
        
        self.db.log_action(
            self.current_user, self.current_role, "RESERVATION_CREATE",
            {"reservation_id": resv_id, "component_id": component_id, "qty": qty, "production_group": production_group}
        )
        return {"id": resv_id, "expires_at": expires.isoformat(), "status": "active"}

    # --- Procurement & Multi-Level Approvals ---
    def create_procurement_order(self, component_id: str, qty: int, unit_price: float) -> dict:
        """
        Submits purchase request. Evaluates pricing risk via crawler benchmarks,
        runs compliance agent (Brain), and triggers automated or human approvals.
        """
        self.require_auth(["member", "lead", "director"])
        
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        # 1. Fetch component details
        cursor.execute("SELECT name, supplier, category FROM components WHERE id = ?", (component_id,))
        comp_row = cursor.fetchone()
        if not comp_row:
            raise ValueError(f"Component '{component_id}' does not exist.")
        
        comp_name, supplier, comp_category = comp_row['name'], comp_row['supplier'], comp_row['category']
        total_price = round(qty * unit_price, 2)
        
        # 2. Veto / Compliance checklist checks
        compliance_passed = True
        compliance_notes = "Standard procurement rule checks passed."
        
        # Enforce rule: Veto lists
        veto_companies = ["BlockedElectronics", "RiskyTech"]
        if supplier in veto_companies:
            compliance_passed = False
            compliance_notes = f"REJECTED: Supplier '{supplier}' is on the banned compliance list."
        
        # Enforce monthly budget check (cap at $50,000 total monthly procurement)
        cursor.execute("""
        SELECT SUM(total_price) FROM orders 
        WHERE created_at >= ? AND status NOT IN ('rejected', 'qc_failed')
        """, ((datetime.utcnow() - timedelta(days=30)).isoformat(),))
        monthly_total_row = cursor.fetchone()
        monthly_total = monthly_total_row[0] or 0.0
        
        if monthly_total + total_price > 50000.0:
            compliance_passed = False
            compliance_notes = f"REJECTED: This order pushes 30-day procurement spend to ${monthly_total + total_price:,.2f}, exceeding the $50,000 compliance cap."

        # 3. Assess pricing risk via crawler
        price_risk, benchmark = self.crawler.assess_price_risk(component_id, supplier, unit_price)

        # 4. Determine multi-level approval requirement (HITL)
        # Rules: < $100 -> Auto; $100-$1000 -> Lead; > $1000 -> Director
        if not compliance_passed:
            status = "rejected"
            role_required = "director"
        elif total_price < 100.0:
            status = "approved"
            role_required = "member"
        elif total_price <= 1000.0:
            status = "pending_approval"
            role_required = "lead"
        else:
            status = "pending_approval"
            role_required = "director"

        order_id = f"PO-{datetime.utcnow().year}-{uuid.uuid4().hex[:6].upper()}"
        timestamp = datetime.utcnow().isoformat()

        # Insert order
        cursor.execute("""
        INSERT INTO orders (id, component_id, qty, unit_price, total_price, status, role_required, created_at, updated_at, compliance_notes, price_risk)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (order_id, component_id, qty, unit_price, total_price, status, role_required, timestamp, timestamp, compliance_notes, price_risk))
        conn.commit()

        self.db.log_action(
            self.current_user, self.current_role, "ORDER_CREATE",
            {"order_id": order_id, "component_id": component_id, "qty": qty, "total_price": total_price, "status": status}
        )

        # Send notifications
        if status == "pending_approval":
            self.notifier.send_slack_approval_alert(order_id, comp_name, qty, total_price, role_required)
            self.notifier.send_email_alert(
                f"{role_required}_procurement@factory.com",
                f"ACTION REQUIRED: Approval needed for Order {order_id}",
                f"Order {order_id} for {qty}x {comp_name} (${total_price:,.2f}) requires your review."
            )

        return {
            "order_id": order_id,
            "status": status,
            "role_required": role_required,
            "total_price": total_price,
            "price_risk": price_risk,
            "benchmark": benchmark,
            "compliance_notes": compliance_notes
        }

    def approve_order(self, order_id: str) -> dict:
        """Approves a pending procurement order if role authorized."""
        self.require_auth(["lead", "director"])
        
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise ValueError(f"Order '{order_id}' not found.")
        
        if order['status'] != "pending_approval":
            raise ValueError(f"Order '{order_id}' is not pending approval. Current status: {order['status']}")

        # Enforce role limits
        required = order['role_required']
        if required == "director" and self.current_role != "director":
            raise PermissionError("Access Denied. Only a Director can authorize this high-value/risk purchase.")
        
        timestamp = datetime.utcnow().isoformat()
        cursor.execute("""
        UPDATE orders SET status = 'approved', approver = ?, updated_at = ? WHERE id = ?
        """, (self.current_user, timestamp, order_id))
        conn.commit()

        self.db.log_action(
            self.current_user, self.current_role, "ORDER_APPROVE",
            {"order_id": order_id, "approver": self.current_user}
        )
        return {"order_id": order_id, "status": "approved"}

    # --- Quality Control & Receipts ---
    def receive_and_inspect_stock(self, barcode: str, inspection_passed: bool) -> dict:
        """
        Processes receipts using barcode format: ComponentID|OrderID|BatchNumber.
        Validates details, processes pass/fail workflows, and updates warehouse stock.
        """
        self.require_auth(["member", "lead", "director"])
        
        parts = barcode.split("|")
        if len(parts) != 3:
            raise ValueError("Invalid barcode format. Expected format: ComponentID|OrderID|BatchNumber")
        
        comp_id, order_id, batch_num = parts[0], parts[1], parts[2]
        
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        # Verify order matches and is approved
        cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise ValueError(f"Procurement Order '{order_id}' does not exist.")
        if order['component_id'] != comp_id:
            raise ValueError(f"Barcode mismatch. Order '{order_id}' lists component {order['component_id']}, barcode has {comp_id}.")
        if order['status'] not in ("approved", "ordered"):
            raise ValueError(f"Invalid Order Status. Order '{order_id}' must be APPROVED or ORDERED, currently is: {order['status']}")

        timestamp = datetime.utcnow().isoformat()
        
        if inspection_passed:
            # Pass workflow: update order, increment stock, update weighted average cost
            cursor.execute("SELECT stock, average_cost FROM components WHERE id = ?", (comp_id,))
            comp = cursor.fetchone()
            
            old_stock = comp['stock']
            old_cost = comp['average_cost']
            qty_received = order['qty']
            unit_price = order['unit_price']
            
            # Recalculate Weighted Average Cost
            new_stock = old_stock + qty_received
            new_cost = round(((old_stock * old_cost) + (qty_received * unit_price)) / new_stock, 4) if new_stock > 0 else unit_price
            
            # Update component
            cursor.execute("""
            UPDATE components SET stock = ?, average_cost = ? WHERE id = ?
            """, (new_stock, new_cost, comp_id))
            
            # Update order
            cursor.execute("""
            UPDATE orders SET status = 'qc_passed', updated_at = ? WHERE id = ?
            """, (timestamp, order_id))
            
            conn.commit()
            
            self.db.log_action(
                self.current_user, self.current_role, "QC_PASS",
                {"order_id": order_id, "component_id": comp_id, "batch": batch_num, "new_stock": new_stock, "new_cost": new_cost}
            )
            return {"status": "qc_passed", "new_stock": new_stock, "average_cost": new_cost}
        else:
            # Fail workflow: mark for return and notify managers
            cursor.execute("""
            UPDATE orders SET status = 'qc_failed', updated_at = ? WHERE id = ?
            """, (timestamp, order_id))
            conn.commit()
            
            self.notifier.send_email_alert(
                "supply_chain_lead@factory.com",
                f"QUALITY CONTROL FAILURE: Batch {batch_num}",
                f"Order {order_id} (Component: {comp_id}) has FAILED physical inspection checks. Banned from warehouse entrance."
            )
            
            self.db.log_action(
                self.current_user, self.current_role, "QC_FAIL",
                {"order_id": order_id, "component_id": comp_id, "batch": batch_num}
            )
            return {"status": "qc_failed", "message": f"Order {order_id} failed inspection. Marked for supplier return."}

    # --- Forecasting & Reorders ---
    def generate_demand_forecast(self) -> list[dict]:
        """
        Calculates Average Daily Usage (ADU) from 30-day consumption trends,
        computes Days of Stock Remaining (DSR), and provides reorder advice.
        """
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM components")
        components = cursor.fetchall()
        
        reorder_reports = []
        for c in components:
            comp_id = c['id']
            stock = c['stock']
            lead_time = c['lead_time']
            safety = c['safety_stock']
            
            # Simulate historical usage logs or query reservation fulfillments.
            # Here we simulate historical ADU dynamically.
            # In production, we scan 30-day production history.
            if "RES" in comp_id or "CAP" in comp_id:
                adu = round(random.uniform(200.0, 800.0), 2)
            elif "IC" in comp_id:
                adu = round(random.uniform(5.0, 20.0), 2)
            elif "MOD" in comp_id:
                adu = round(random.uniform(2.0, 8.0), 2)
            else:
                adu = round(random.uniform(10.0, 30.0), 2)

            # Days of Stock Remaining (DSR)
            dsr = round(stock / adu, 1) if adu > 0 else float('inf')
            
            # Reorder point threshold: Lead Time + Safety stock days
            # Safety days equivalent = safety stock / adu
            safety_days = safety / adu if adu > 0 else 10
            reorder_threshold_days = lead_time + safety_days
            
            needs_reorder = dsr < reorder_threshold_days
            recommended_qty = int(adu * 30) if needs_reorder else 0 # buy 30-day supply
            
            reorder_reports.append({
                "component_id": comp_id,
                "name": c['name'],
                "current_stock": stock,
                "adu": adu,
                "dsr": dsr,
                "needs_reorder": needs_reorder,
                "recommended_qty": recommended_qty,
                "lead_time": lead_time,
                "safety_stock": safety
            })
            
        return reorder_reports

if __name__ == "__main__":
    db = EncryptedDB()
    db.seed_data()
    core = CoreEngine(db)
    core.login("bob_lead", "lead123")
    print("Logged in. Checking inventory:")
    print(core.get_inventory()[:2])
