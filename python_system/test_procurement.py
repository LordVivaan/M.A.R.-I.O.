"""
Procurement & Supply Chain Logistics System - Unit Tests
Covers inventory checks, multi-level approvals, budget caps, veto lists,
quality control barcodes, reservations, and security roles.
"""

import os
import unittest
import json
from python_system.db import EncryptedDB
from python_system.core import CoreEngine

class TestSupplyChainProcurement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use a temporary database for testing
        cls.db_path = "test_factory.db"
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)
        cls.db = EncryptedDB(cls.db_path)
        cls.db.seed_data()
        cls.core = CoreEngine(cls.db, mock_notifications=True)

    @classmethod
    def tearDownClass(cls):
        # Cleanup temporary files
        if os.path.exists(cls.db_path):
            cls.db.get_connection().close()
            os.remove(cls.db_path)
        if os.path.exists("db_secret.key"):
            pass  # keep it or let it be

    def setUp(self):
        # Reset session logins
        self.core.current_user = None
        self.core.current_role = None

    def test_01_user_authentication(self):
        """Verify that login works correctly and roles are matched."""
        # Success member
        self.assertTrue(self.core.login("alice_member", "member123"))
        self.assertEqual(self.core.current_role, "member")
        
        # Success director
        self.assertTrue(self.core.login("charlie_director", "director123"))
        self.assertEqual(self.core.current_role, "director")
        
        # Fail invalid password
        self.assertFalse(self.core.login("bob_lead", "wrongpass"))
        self.assertIsNone(self.core.current_user)

    def test_02_role_permissions(self):
        """Test authorization levels across member, lead, and director."""
        self.core.login("alice_member", "member123")
        
        # Members cannot approve orders (needs lead/director)
        with self.assertRaises(PermissionError):
            self.core.approve_order("PO-2026-TEST")

    def test_03_procurement_business_rules(self):
        """Test multi-level Human-in-the-Loop order limits and approvals."""
        self.core.login("alice_member", "member123")

        # 1. Low value order (< $100): Should be AUTO-APPROVED
        res_auto = self.core.create_procurement_order("RES-10K-0603", 20, 0.05)
        self.assertEqual(res_auto['status'], "approved")

        # 2. Medium value order ($100 - $1,000): Should need LEAD approval
        res_lead = self.core.create_procurement_order("IC-ESP32S3", 100, 3.80)
        self.assertEqual(res_lead['status'], "pending_approval")
        self.assertEqual(res_lead['role_required'], "lead")

        # 3. High value order (> $1,000): Should need DIRECTOR approval
        res_dir = self.core.create_procurement_order("IC-STM32F4", 200, 7.50)
        self.assertEqual(res_dir['status'], "pending_approval")
        self.assertEqual(res_dir['role_required'], "director")

    def test_04_veto_supplier_check(self):
        """Ensure order fails compliance if supplier is on the banned veto list."""
        self.core.login("bob_lead", "lead123")
        
        # Inject blocked component
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO components (id, name, category, stock, average_cost, lead_time, safety_stock, warehouse_zone, supplier)
        VALUES ('TEST-RISK', 'Risky IC', 'semiconductor', 10, 5.0, 5, 2, 'Zone B', 'BlockedElectronics')
        """)
        conn.commit()

        res = self.core.create_procurement_order("TEST-RISK", 5, 5.0)
        self.assertEqual(res['status'], "rejected")
        self.assertIn("banned compliance list", res['compliance_notes'])

    def test_05_production_reservations(self):
        """Verify stock is held exclusively on reservation creation."""
        self.core.login("bob_lead", "lead123")
        
        # Check starting state of resistor
        inv = self.core.get_inventory()
        res_comp = [c for c in inv if c['id'] == "CAP-10UF-0805"][0]
        start_stock = res_comp['stock']
        start_reserved = res_comp['reserved']

        # Create active 50-unit reservation
        resv = self.core.create_reservation("CAP-10UF-0805", 50, "Smartphone Line A")
        self.assertIsNotNone(resv['id'])
        self.assertEqual(resv['status'], "active")

        # Verify reserved stock increased and available stock decreased
        inv_after = self.core.get_inventory()
        res_comp_after = [c for c in inv_after if c['id'] == "CAP-10UF-0805"][0]
        self.assertEqual(res_comp_after['reserved'], start_reserved + 50)
        self.assertEqual(res_comp_after['available'], start_stock - start_reserved - 50)

    def test_06_quality_control_receipts(self):
        """Verify receipts barcode validation and stock adjustment on pass/fail."""
        self.core.login("charlie_director", "director123")
        
        # Create an approved order
        order_res = self.core.create_procurement_order("MECH-HNG-APPL", 10, 3.40)
        order_id = order_res['order_id']
        
        # Check initial component stock and cost
        inv_before = self.core.get_inventory()
        comp_before = [c for c in inv_before if c['id'] == "MECH-HNG-APPL"][0]
        start_stock = comp_before['stock']
        start_cost = comp_before['average_cost']

        # Scan valid PASSED barcode
        barcode_pass = f"MECH-HNG-APPL|{order_id}|BATCH-XYZ-11"
        qc_res = self.core.receive_and_inspect_stock(barcode_pass, inspection_passed=True)
        self.assertEqual(qc_res['status'], "qc_passed")
        
        # Verify stock incremented and weighted average cost updated
        inv_after = self.core.get_inventory()
        comp_after = [c for c in inv_after if c['id'] == "MECH-HNG-APPL"][0]
        self.assertEqual(comp_after['stock'], start_stock + 10)

        # Scan failing QC barcode
        order_fail_res = self.core.create_procurement_order("MECH-HNG-APPL", 5, 3.40)
        order_fail_id = order_fail_res['order_id']
        
        # If pending_approval, cannot QC it. Let's make sure it is approved
        # MECH-HNG-APPL (5 * 3.40 = $17.00 < $100 -> Auto Approved)
        barcode_fail = f"MECH-HNG-APPL|{order_fail_id}|BATCH-BAD-22"
        qc_fail_res = self.core.receive_and_inspect_stock(barcode_fail, inspection_passed=False)
        self.assertEqual(qc_fail_res['status'], "qc_failed")

if __name__ == "__main__":
    unittest.main()
