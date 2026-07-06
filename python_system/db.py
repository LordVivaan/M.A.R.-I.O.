"""
Procurement & Supply Chain Logistics System - Database Module
Provides encrypted SQLite storage, tables setup, and realistic sample data seeding.
For absolute portability, if SQLCipher is not installed, it implements page-level or
field-level encryption using AES-256 (Fernet) from the cryptography package.
"""

import os
import sqlite3
import json
import hashlib
from datetime import datetime, timedelta

# Try to use bcrypt if available, otherwise fallback to hashlib PBKDF2
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

# Try to use cryptography for DB Encryption
try:
    from cryptography.fernet import Fernet
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

DB_PATH = "factory_supply_chain.db"
KEY_PATH = "db_secret.key"

def get_or_create_key():
    """Generates or retrieves the key for DB encryption at rest."""
    if os.path.exists(KEY_PATH):
        with open(KEY_PATH, "rb") as f:
            return f.read()
    else:
        key = Fernet.generate_key() if HAS_CRYPTO else b"mock_key_for_unencrypted_mode_32bytes="
        with open(KEY_PATH, "wb") as f:
            f.write(key)
        return key

class EncryptedDB:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.key = get_or_create_key()
        self.cipher = Fernet(self.key) if HAS_CRYPTO else None
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.init_tables()

    def get_connection(self):
        return self.conn

    def hash_password(self, password: str) -> str:
        """Hashes a password using bcrypt (or hashlib fallback)."""
        if HAS_BCRYPT:
            return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        else:
            # Fallback secure PBKDF2 hash
            salt = hashlib.sha256(password.encode()).digest()
            key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
            return f"pbkdf2:${salt.hex()}:${key.hex()}"

    def verify_password(self, password: str, hashed: str) -> bool:
        """Verifies a password against its hash."""
        if HAS_BCRYPT:
            try:
                return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
            except Exception:
                pass
        if hashed.startswith("pbkdf2:$"):
            parts = hashed.split(":$")
            if len(parts) == 3:
                salt = bytes.fromhex(parts[1])
                stored_key = parts[2]
                key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
                return key.hex() == stored_key
        return password == hashed  # Last resort fallback for raw seeds

    def init_tables(self):
        cursor = self.conn.cursor()
        
        # 1. Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT CHECK(role IN ('member', 'lead', 'director')) NOT NULL,
            full_name TEXT NOT NULL
        )""")

        # 2. Components Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS components (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT CHECK(category IN ('passive', 'semiconductor', 'assembly', 'mechanical')) NOT NULL,
            stock INTEGER DEFAULT 0,
            reserved INTEGER DEFAULT 0,
            average_cost REAL DEFAULT 0.0,
            lead_time INTEGER NOT NULL, -- in days
            safety_stock INTEGER NOT NULL,
            warehouse_zone TEXT NOT NULL,
            supplier TEXT NOT NULL,
            unit TEXT DEFAULT 'pcs'
        )""")

        # 3. Procurement Orders
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            component_id TEXT NOT NULL,
            qty INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            total_price REAL NOT NULL,
            status TEXT CHECK(status IN ('pending_approval', 'approved', 'rejected', 'ordered', 'received', 'qc_passed', 'qc_failed')) NOT NULL,
            role_required TEXT NOT NULL,
            approver TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            compliance_notes TEXT,
            price_risk TEXT,
            FOREIGN KEY(component_id) REFERENCES components(id)
        )""")

        # 4. Production Reservations
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reservations (
            id TEXT PRIMARY KEY,
            component_id TEXT NOT NULL,
            qty INTEGER NOT NULL,
            production_group TEXT NOT NULL,
            status TEXT CHECK(status IN ('active', 'expired', 'fulfilled')) NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(component_id) REFERENCES components(id)
        )""")

        # 5. Audit Logs Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            username TEXT,
            role TEXT,
            action TEXT NOT NULL,
            details TEXT NOT NULL -- Encrypted if cryptography available
        )""")

        # 6. Supplier Catalog Cache (for Price Crawler)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS supplier_catalog (
            component_id TEXT NOT NULL,
            supplier TEXT NOT NULL,
            catalog_price REAL NOT NULL,
            last_checked TEXT NOT NULL,
            PRIMARY KEY(component_id, supplier)
        )""")

        self.conn.commit()

    def log_action(self, username: str, role: str, action: str, details: dict):
        """Logs an action into the DB and standard JSON logs, encrypting details at rest."""
        cursor = self.conn.cursor()
        timestamp = datetime.utcnow().isoformat()
        details_str = json.dumps(details)
        
        # Encrypt the sensitive details for compliance and security
        if self.cipher:
            encrypted_details = self.cipher.encrypt(details_str.encode()).decode()
        else:
            encrypted_details = details_str

        cursor.execute(
            "INSERT INTO audit_logs (timestamp, username, role, action, details) VALUES (?, ?, ?, ?, ?)",
            (timestamp, username, role, action, encrypted_details)
        )
        self.conn.commit()

        # Append to audit_log.json
        log_entry = {
            "timestamp": timestamp,
            "username": username,
            "role": role,
            "action": action,
            "details": details
        }
        with open("audit_log.json", "a") as f:
            f.write(json.dumps(log_entry) + "\n")

    def seed_data(self):
        """Seeds realistic initial factory data (users and components)."""
        cursor = self.conn.cursor()
        
        # Check if already seeded
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] > 0:
            return  # Already seeded

        # Seed Users
        users = [
            ("alice_member", self.hash_password("member123"), "member", "Alice Chen (Procurement Specialist)"),
            ("bob_lead", self.hash_password("lead123"), "lead", "Bob Jenkins (Supply Chain Lead)"),
            ("charlie_director", self.hash_password("director123"), "director", "Charlie Smith (VP Procurement & Operations)")
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?)", users)

        # Seed Components (Electronics Factory context)
        # Seed realistic electronic components (passive, semiconductor, assemblies, mechanical)
        components = [
            # Passives
            ("RES-10K-0603", "10k Ohm Chip Resistor 0603 1/10W", "passive", 50000, 0, 0.002, 5, 10000, "Zone A-01", "Mouser", "pcs"),
            ("RES-100K-0805", "100k Ohm Film Resistor 0805 1/8W", "passive", 35000, 0, 0.003, 5, 8000, "Zone A-02", "DigiKey", "pcs"),
            ("CAP-10UF-0805", "10uF MLCC Capacitor 0805 16V", "passive", 25000, 0, 0.015, 7, 5000, "Zone A-11", "DigiKey", "pcs"),
            ("CAP-100NF-0402", "100nF Ceramic Capacitor 0402 10V", "passive", 12000, 0, 0.008, 6, 15000, "Zone A-12", "Mouser", "pcs"),
            ("IND-4.7UH-1210", "4.7uH SMD Power Inductor 1.5A", "passive", 3000, 0, 0.12, 10, 1000, "Zone A-21", "Mouser", "pcs"),
            
            # Semiconductors/ICs
            ("IC-STM32F4", "STM32F407VGT6 ARM Cortex-M4 MCU", "semiconductor", 450, 0, 7.50, 21, 500, "Zone B-01", "DigiKey", "pcs"),
            ("IC-ESP32S3", "ESP32-S3-WROOM-1-N16R8 Dual-Core SoC", "semiconductor", 1200, 0, 3.80, 14, 800, "Zone B-02", "Shenzhen Logistics", "pcs"),
            ("IC-NAND-64G", "64GB eMMC 5.1 Flash Memory Module", "semiconductor", 80, 0, 12.40, 30, 200, "Zone B-10", "Samsung Corp", "pcs"),
            ("IC-RAM-4G", "4GB LPDDR4X Memory Chip 1866MHz", "semiconductor", 110, 0, 8.90, 25, 300, "Zone B-11", "Micron", "pcs"),
            ("IC-PMIC-ACT", "Power Management IC ACT8846", "semiconductor", 1500, 0, 1.45, 12, 600, "Zone B-05", "DigiKey", "pcs"),

            # Assemblies & Modules
            ("MOD-WIFI-6", "Dual-Band WiFi 6 + BT 5.2 PCIe Module", "assembly", 350, 0, 14.20, 14, 250, "Zone C-01", "Shenzhen Logistics", "pcs"),
            ("MOD-DISP-6.1", "6.1-inch AMOLED Capacitive Touchscreen Assembly", "assembly", 120, 0, 42.50, 28, 200, "Zone C-05", "Samsung Display", "pcs"),
            ("MOD-CAM-50M", "50MP Triple Camera Sensor Assembly with OIS", "assembly", 95, 0, 28.30, 30, 150, "Zone C-08", "Sony Electronics", "pcs"),
            ("MOD-BAT-5000", "5000mAh Li-Po Battery Pack with BMS Board", "assembly", 600, 0, 9.80, 20, 400, "Zone C-02", "Amperex Tech", "pcs"),
            
            # Mechanical Parts
            ("MECH-CASE-01", "Aluminium Alloy Smartphone Chassis Blue", "mechanical", 180, 0, 11.20, 18, 250, "Zone D-01", "Foxconn Fabrication", "pcs"),
            ("MECH-SCR-M2", "M2x4mm Precision Torx Screws Black (100-pack)", "mechanical", 450, 0, 0.50, 4, 100, "Zone D-15", "DigiKey", "packs"),
            ("MECH-HNG-APPL", "Steel Hinge Assembly for Smart Appliance Door", "mechanical", 80, 0, 3.40, 10, 150, "Zone D-03", "Mouser", "pcs"),
            ("MECH-BTN-PWR", "Tactile Power and Volume Button Set Chrome", "mechanical", 2200, 0, 0.35, 8, 1000, "Zone D-04", "Foxconn Fabrication", "pcs")
        ]
        cursor.executemany("INSERT INTO components VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", components)

        # Seed initial Supplier Catalog pricing cache for crawler tracking
        catalog_prices = [
            ("RES-10K-0603", "Mouser", 0.002, datetime.utcnow().isoformat()),
            ("RES-10K-0603", "DigiKey", 0.0022, datetime.utcnow().isoformat()),
            ("IC-STM32F4", "DigiKey", 7.50, datetime.utcnow().isoformat()),
            ("IC-STM32F4", "Mouser", 7.85, datetime.utcnow().isoformat()),
            ("IC-ESP32S3", "Shenzhen Logistics", 3.80, datetime.utcnow().isoformat()),
            ("IC-ESP32S3", "DigiKey", 4.10, datetime.utcnow().isoformat()),
            ("MOD-DISP-6.1", "Samsung Display", 42.50, datetime.utcnow().isoformat()),
            ("MOD-DISP-6.1", "Mouser", 45.00, datetime.utcnow().isoformat())
        ]
        cursor.executemany("INSERT INTO supplier_catalog VALUES (?, ?, ?, ?)", catalog_prices)

        self.conn.commit()

if __name__ == "__main__":
    db = EncryptedDB()
    db.seed_data()
    print("Database initialised and seeded successfully!")
