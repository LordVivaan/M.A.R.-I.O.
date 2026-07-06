"""
Procurement & Supply Chain Logistics System - Interactive Command Line Interface
Provides full command-based access to the Core Engine with professional formatting.
Supports: login, view-inventory, order, approve, receive-qc, reserve, forecast, and audit.
"""

import sys
import argparse
import json
from python_system.db import EncryptedDB
from python_system.core import CoreEngine

# Import rich for formatted tables if available, otherwise fallback to simple print
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

class CLIController:
    def __init__(self):
        self.db = EncryptedDB()
        self.core = CoreEngine(self.db, mock_notifications=True)
        self.console = Console() if HAS_RICH else None

    def print_text(self, text: str, style: str = ""):
        if HAS_RICH:
            self.console.print(text, style=style)
        else:
            print(text)

    def print_table(self, title: str, headers: list[str], rows: list[list]):
        """Renders beautifully formatted ASCII or Rich tables."""
        if HAS_RICH:
            table = Table(title=title, show_header=True, header_style="bold cyan")
            for h in headers:
                table.add_column(h)
            for r in rows:
                table.add_row(*[str(cell) for cell in r])
            self.console.print(table)
        else:
            print(f"\n=== {title} ===")
            col_widths = [max(len(str(x)) for x in col) for col in zip(headers, *rows)]
            fmt_str = " | ".join(f"{{:<{w}}}" for w in col_widths)
            print(fmt_str.format(*headers))
            print("-" * (sum(col_widths) + len(col_widths) * 3))
            for r in rows:
                print(fmt_str.format(*[str(x) for x in r]))
            print()

    def run_command(self, args_list: list[str]):
        parser = argparse.ArgumentParser(description="Electronics Factory Procurement & Supply Chain System")
        subparsers = parser.add_subparsers(dest="command")

        # Login Command
        login_parser = subparsers.add_parser("login", help="Authenticate and initiate session")
        login_parser.add_argument("--user", required=True, help="Username")
        login_parser.add_argument("--password", required=True, help="Secret password")

        # Inventory Command
        inv_parser = subparsers.add_parser("inventory", help="List stock levels and warehouse zones")
        inv_parser.add_argument("--category", choices=["passive", "semiconductor", "assembly", "mechanical"], help="Filter category")

        # Order Command
        order_parser = subparsers.add_parser("order", help="Create a purchase procurement order")
        order_parser.add_argument("--comp", required=True, help="Component ID")
        order_parser.add_argument("--qty", required=True, type=int, help="Purchase quantity")
        order_parser.add_argument("--price", required=True, type=float, help="Unit purchase cost")
        order_parser.add_argument("--user-session", required=True, help="Current logged in username")

        # Approve Command
        approve_parser = subparsers.add_parser("approve", help="Approve a pending procurement request")
        approve_parser.add_argument("--order", required=True, help="Procurement Order ID")
        approve_parser.add_argument("--user-session", required=True, help="Current logged in username")

        # Receive Command
        rcv_parser = subparsers.add_parser("receive", help="Scan receipt barcode and perform quality control")
        rcv_parser.add_argument("--barcode", required=True, help="Format: ComponentID|OrderID|BatchNumber")
        rcv_parser.add_argument("--pass-inspection", action="store_true", help="Mark physical quality check as PASSED")
        rcv_parser.add_argument("--user-session", required=True, help="Current logged in username")

        # Reserve Command
        reserve_parser = subparsers.add_parser("reserve", help="Reserve physical components for production lines")
        reserve_parser.add_argument("--comp", required=True, help="Component ID")
        reserve_parser.add_argument("--qty", required=True, type=int, help="Reservation quantity")
        reserve_parser.add_argument("--group", required=True, help="Target production group")
        reserve_parser.add_argument("--user-session", required=True, help="Current logged in username")

        # Forecast Command
        subparsers.add_parser("forecast", help="Generate reorder advice and daily usage forecasts")

        # Audit Logs Command
        subparsers.add_parser("audit", help="View strict JSON audit logs")

        parsed_args = parser.parse_parse_args = parser.parse_args(args_list)

        if not parsed_args.command:
            parser.print_help()
            return

        # Authenticate mock session state based on session parameters for CLI demonstration
        if parsed_args.command != "login" and hasattr(parsed_args, "user_session"):
            # Set context based on user session role
            conn = self.db.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT role FROM users WHERE username = ?", (parsed_args.user_session,))
            row = cursor.fetchone()
            if row:
                self.core.current_user = parsed_args.user_session
                self.core.current_role = row['role']
            else:
                self.print_text("Error: Invalid or expired session context.", "bold red")
                return

        # Handle Commands
        try:
            if parsed_args.command == "login":
                if self.core.login(parsed_args.user, parsed_args.password):
                    role = self.core.current_role.upper()
                    self.print_text(f"✔ Access Granted. Welcome, {parsed_args.user}! Role established: [{role}]", "bold green")
                else:
                    self.print_text("✘ Access Denied. Invalid security credentials.", "bold red")

            elif parsed_args.command == "inventory":
                inv = self.core.get_inventory(parsed_args.category)
                headers = ["ID", "Name", "Category", "Stock", "Reserved", "Avg Cost", "Zone", "Status"]
                rows = [
                    [c['id'], c['name'], c['category'], c['stock'], c['reserved'], f"${c['average_cost']:.3f}", c['warehouse_zone'], c['status']]
                    for c in inv
                ]
                self.print_table("FACTORY STOCK ROOM", headers, rows)

            elif parsed_args.command == "order":
                res = self.core.create_procurement_order(parsed_args.comp, parsed_args.qty, parsed_args.price)
                self.print_text(f"✔ Procurement request generated for {parsed_args.comp}.", "bold green")
                self.print_text(f"Order ID: {res['order_id']}")
                self.print_text(f"Stock compliance outcome: {res['status'].upper()}")
                self.print_text(f"Pricing deviation risk: {res['price_risk']} (Market index benchmark: ${res['benchmark']:.2f})")
                self.print_text(f"Audit logs compliance detail: {res['compliance_notes']}")

            elif parsed_args.command == "approve":
                res = self.core.approve_order(parsed_args.order)
                self.print_text(f"✔ Procurement order {parsed_args.order} has been APPROVED by {parsed_args.user_session}.", "bold green")

            elif parsed_args.command == "receive":
                res = self.core.receive_and_inspect_stock(parsed_args.barcode, parsed_args.pass_inspection)
                if res['status'] == "qc_passed":
                    self.print_text(f"✔ Quality Assurance Passed! Barcode verification complete.", "bold green")
                    self.print_text(f"New Warehouse Stock: {res['new_stock']}")
                    self.print_text(f"Updated Component Cost: ${res['average_cost']:.4f}")
                else:
                    self.print_text(f"❌ QC FAIL: {res['message']}", "bold red")

            elif parsed_args.command == "reserve":
                res = self.core.create_reservation(parsed_args.comp, parsed_args.qty, parsed_args.group)
                self.print_text(f"✔ Reservation {res['id']} created. Stock locked for 30 days.", "bold green")
                self.print_text(f"Expires on: {res['expires_at']}")

            elif parsed_args.command == "forecast":
                reports = self.core.generate_demand_forecast()
                headers = ["ID", "Name", "Stock", "ADU (30-day)", "DSR (Days)", "Reorder Required?", "Rec Qty"]
                rows = [
                    [
                        r['component_id'], r['name'][:25], r['current_stock'], 
                        f"{r['adu']:.1f}", f"{r['dsr']}", "YES" if r['needs_reorder'] else "NO", r['recommended_qty']
                    ]
                    for r in reports
                ]
                self.print_table("DEMAND FORECAST & REORDER RECOMMENDATIONS", headers, rows)

            elif parsed_args.command == "audit":
                self.print_text("--- STRICT JSON AUDIT LOGS ---", "bold yellow")
                try:
                    with open("audit_log.json", "r") as f:
                        for line in f.readlines():
                            log = json.loads(line)
                            self.print_text(f"[{log['timestamp']}] USER:{log['username']} ({log['role'].upper()}) - ACTION:{log['action']} DETAILS:{log['details']}")
                except FileNotFoundError:
                    self.print_text("No audit logs recorded yet.", "italic gray")

        except Exception as e:
            self.print_text(f"Error executing command: {str(e)}", "bold red")

def main():
    controller = CLIController()
    controller.run_command(sys.argv[1:])

if __name__ == "__main__":
    main()
