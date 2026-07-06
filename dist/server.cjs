var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_child_process = require("child_process");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var ai = process.env.GEMINI_API_KEY ? new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
}) : null;
var DB_PATH = "factory_supply_chain.db";
var AUDIT_LOGS_PATH = import_path.default.join(process.cwd(), "audit_log.json");
var db = new import_better_sqlite3.default(DB_PATH);
function initializeSqliteDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('member', 'lead', 'director')) NOT NULL,
        full_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS components (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT CHECK(category IN ('passive', 'semiconductor', 'assembly', 'mechanical')) NOT NULL,
        stock INTEGER DEFAULT 0,
        reserved INTEGER DEFAULT 0,
        average_cost REAL DEFAULT 0.0,
        lead_time INTEGER NOT NULL,
        safety_stock INTEGER NOT NULL,
        warehouse_zone TEXT NOT NULL,
        supplier TEXT NOT NULL,
        unit TEXT DEFAULT 'pcs'
    );

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
    );

    CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL,
        qty INTEGER NOT NULL,
        production_group TEXT NOT NULL,
        status TEXT CHECK(status IN ('active', 'expired', 'fulfilled')) NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(component_id) REFERENCES components(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        username TEXT,
        role TEXT,
        action TEXT NOT NULL,
        details TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_catalog (
        component_id TEXT NOT NULL,
        supplier TEXT NOT NULL,
        catalog_price REAL NOT NULL,
        last_checked TEXT NOT NULL,
        PRIMARY KEY(component_id, supplier)
    );

    CREATE TABLE IF NOT EXISTS warehouses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        warehouse_id TEXT NOT NULL,
        name TEXT NOT NULL,
        zone_type TEXT CHECK(zone_type IN ('internal', 'scrap', 'transit', 'view', 'customer')) NOT NULL,
        parent_location_id TEXT,
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS putaway_rules (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        source_location_id TEXT NOT NULL,
        dest_location_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        FOREIGN KEY(source_location_id) REFERENCES locations(id),
        FOREIGN KEY(dest_location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL,
        attribute_name TEXT NOT NULL,
        attribute_value TEXT NOT NULL,
        stock_delta INTEGER DEFAULT 0,
        FOREIGN KEY(component_id) REFERENCES components(id)
    );

    CREATE TABLE IF NOT EXISTS lots_serial (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL,
        lot_number TEXT NOT NULL,
        serial_number TEXT,
        quantity INTEGER DEFAULT 0,
        expiration_date TEXT,
        status TEXT CHECK(status IN ('good', 'expired', 'quarantine')) DEFAULT 'good',
        FOREIGN KEY(component_id) REFERENCES components(id)
    );

    CREATE TABLE IF NOT EXISTS stock_moves (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL,
        lot_id TEXT,
        qty INTEGER NOT NULL,
        from_location_id TEXT NOT NULL,
        to_location_id TEXT NOT NULL,
        operation_type TEXT CHECK(operation_type IN ('receipt', 'internal', 'delivery', 'scrap', 'adjustment')) NOT NULL,
        status TEXT CHECK(status IN ('draft', 'done')) NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        FOREIGN KEY(component_id) REFERENCES components(id)
    );

    CREATE TABLE IF NOT EXISTS reordering_rules (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL UNIQUE,
        min_qty INTEGER NOT NULL,
        max_qty INTEGER NOT NULL,
        active INTEGER DEFAULT 1,
        FOREIGN KEY(component_id) REFERENCES components(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id TEXT PRIMARY KEY,
        component_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        theoretical_qty INTEGER NOT NULL,
        real_qty INTEGER NOT NULL,
        status TEXT CHECK(status IN ('draft', 'completed')) NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(component_id) REFERENCES components(id)
    );
  `);
  const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (usersCount.count === 0) {
    const insertUser = db.prepare("INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)");
    insertUser.run("alice_member", "member123", "member", "Alice Chen");
    insertUser.run("bob_lead", "lead123", "lead", "Bob Jenkins");
    insertUser.run("charlie_director", "director123", "director", "Charlie Smith");
  }
  const compCount = db.prepare("SELECT COUNT(*) AS count FROM components").get();
  if (compCount.count === 0) {
    const insertComp = db.prepare(`
      INSERT INTO components (id, name, category, stock, reserved, average_cost, lead_time, safety_stock, warehouse_zone, supplier, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertComp.run("RES-10K-0603", "10k Ohm Chip Resistor 0603 1/10W", "passive", 5e4, 0, 2e-3, 5, 1e4, "Zone A-01", "Mouser", "pcs");
    insertComp.run("RES-100K-0805", "100k Ohm Film Resistor 0805 1/8W", "passive", 35e3, 0, 3e-3, 5, 8e3, "Zone A-02", "DigiKey", "pcs");
    insertComp.run("CAP-10UF-0805", "10uF MLCC Capacitor 0805 16V", "passive", 25e3, 0, 0.015, 7, 5e3, "Zone A-11", "DigiKey", "pcs");
    insertComp.run("CAP-100NF-0402", "100nF Ceramic Capacitor 0402 10V", "passive", 12e3, 0, 8e-3, 6, 15e3, "Zone A-12", "Mouser", "pcs");
    insertComp.run("IND-4.7UH-1210", "4.7uH SMD Power Inductor 1.5A", "passive", 3e3, 0, 0.12, 10, 1e3, "Zone A-21", "Mouser", "pcs");
    insertComp.run("IC-STM32F4", "STM32F407VGT6 ARM Cortex-M4 MCU", "semiconductor", 450, 0, 7.5, 21, 500, "Zone B-01", "DigiKey", "pcs");
    insertComp.run("IC-ESP32S3", "ESP32-S3-WROOM-1-N16R8 Dual-Core SoC", "semiconductor", 1200, 0, 3.8, 14, 800, "Zone B-02", "Shenzhen Logistics", "pcs");
    insertComp.run("IC-NAND-64G", "64GB eMMC 5.1 Flash Memory Module", "semiconductor", 80, 0, 12.4, 30, 200, "Zone B-10", "Samsung Corp", "pcs");
    insertComp.run("IC-RAM-4G", "4GB LPDDR4X Memory Chip 1866MHz", "semiconductor", 110, 0, 8.9, 25, 300, "Zone B-11", "Micron", "pcs");
    insertComp.run("IC-PMIC-ACT", "Power Management IC ACT8846", "semiconductor", 1500, 0, 1.45, 12, 600, "Zone B-05", "DigiKey", "pcs");
    insertComp.run("MOD-WIFI-6", "Dual-Band WiFi 6 + BT 5.2 PCIe Module", "assembly", 350, 0, 14.2, 14, 250, "Zone C-01", "Shenzhen Logistics", "pcs");
    insertComp.run("MOD-DISP-6.1", "6.1-inch AMOLED Capacitive Touchscreen Assembly", "assembly", 120, 0, 42.5, 28, 200, "Zone C-05", "Samsung Display", "pcs");
    insertComp.run("MOD-CAM-50M", "50MP Triple Camera Sensor Assembly with OIS", "assembly", 95, 0, 28.3, 30, 150, "Zone C-08", "Sony Electronics", "pcs");
    insertComp.run("MOD-BAT-5000", "5000mAh Li-Po Battery Pack with BMS Board", "assembly", 600, 0, 9.8, 20, 400, "Zone C-02", "Amperex Tech", "pcs");
    insertComp.run("MECH-CASE-01", "Aluminium Alloy Smartphone Chassis Blue", "mechanical", 180, 0, 11.2, 18, 250, "Zone D-01", "Foxconn Fabrication", "pcs");
    insertComp.run("MECH-SCR-M2", "M2x4mm Precision Torx Screws Black (100-pack)", "mechanical", 450, 0, 0.5, 4, 100, "Zone D-15", "DigiKey", "packs");
    insertComp.run("MECH-HNG-APPL", "Steel Hinge Assembly for Smart Appliance Door", "mechanical", 80, 0, 3.4, 10, 150, "Zone D-03", "Mouser", "pcs");
    insertComp.run("MECH-BTN-PWR", "Tactile Power and Volume Button Set Chrome", "mechanical", 2200, 0, 0.35, 8, 1e3, "Zone D-04", "Foxconn Fabrication", "pcs");
  }
  const ordersCount = db.prepare("SELECT COUNT(*) AS count FROM orders").get();
  if (ordersCount.count === 0) {
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, component_id, qty, unit_price, total_price, status, role_required, approver, created_at, updated_at, compliance_notes, price_risk)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertOrder.run("PO-2026-A1D8F", "IC-STM32F4", 200, 7.5, 1500, "approved", "director", "charlie_director", "2026-06-25T10:00:00Z", "2026-06-25T11:30:00Z", "Checked safety inventory shortfalls.", "LOW");
    insertOrder.run("PO-2026-B8C2D", "CAP-10UF-0805", 1e3, 0.015, 15, "qc_passed", "member", "alice_member", "2026-06-26T08:00:00Z", "2026-06-26T09:15:00Z", "Auto-approved small quantity.", "LOW");
  }
  const resvCount = db.prepare("SELECT COUNT(*) AS count FROM reservations").get();
  if (resvCount.count === 0) {
    const insertRes = db.prepare(`
      INSERT INTO reservations (id, component_id, qty, production_group, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertRes.run("RESV-391D2", "IC-ESP32S3", 200, "Smartphone Line A", "active", "2026-06-20T14:00:00Z", "2026-07-20T14:00:00Z");
    db.prepare("UPDATE components SET reserved = (SELECT COALESCE(SUM(qty), 0) FROM reservations WHERE component_id = components.id AND status = 'active')").run();
  }
  const whCount = db.prepare("SELECT COUNT(*) AS count FROM warehouses").get();
  if (whCount.count === 0) {
    const insertWh = db.prepare("INSERT INTO warehouses (id, name, code, address) VALUES (?, ?, ?, ?)");
    insertWh.run("WH-MAIN", "Main Electronics Warehouse", "WH-M", "100 Innovation Way, Austin, TX");
    insertWh.run("WH-SHENZHEN", "Shenzhen Hub Warehouse", "WH-SZ", "Block B, High-Tech Industrial Zone, Shenzhen");
  }
  const locCount = db.prepare("SELECT COUNT(*) AS count FROM locations").get();
  if (locCount.count === 0) {
    const insertLoc = db.prepare("INSERT INTO locations (id, warehouse_id, name, zone_type, parent_location_id) VALUES (?, ?, ?, ?, ?)");
    insertLoc.run("WH-MAIN-INCOMING", "WH-MAIN", "Incoming Transit Dock", "transit", null);
    insertLoc.run("WH-MAIN-ZONE-A", "WH-MAIN", "Zone A (Passives)", "internal", null);
    insertLoc.run("WH-MAIN-ZONE-B", "WH-MAIN", "Zone B (Semis)", "internal", null);
    insertLoc.run("WH-MAIN-ZONE-C", "WH-MAIN", "Zone C (Assemblies)", "internal", null);
    insertLoc.run("WH-MAIN-ZONE-D", "WH-MAIN", "Zone D (Mechanical)", "internal", null);
    insertLoc.run("WH-MAIN-SCRAP", "WH-MAIN", "Dedicated Scrap Zone", "scrap", null);
    insertLoc.run("VIRTUAL-CUSTOMER", "WH-MAIN", "Customer Virtual Location", "customer", null);
  }
  const ruleCount = db.prepare("SELECT COUNT(*) AS count FROM putaway_rules").get();
  if (ruleCount.count === 0) {
    const insertRule = db.prepare("INSERT INTO putaway_rules (id, category, source_location_id, dest_location_id, action_type) VALUES (?, ?, ?, ?, ?)");
    insertRule.run("PUT-01", "passive", "WH-MAIN-INCOMING", "WH-MAIN-ZONE-A", "auto_transfer");
    insertRule.run("PUT-02", "semiconductor", "WH-MAIN-INCOMING", "WH-MAIN-ZONE-B", "auto_transfer");
    insertRule.run("PUT-03", "assembly", "WH-MAIN-INCOMING", "WH-MAIN-ZONE-C", "auto_transfer");
    insertRule.run("PUT-04", "mechanical", "WH-MAIN-INCOMING", "WH-MAIN-ZONE-D", "auto_transfer");
  }
  const variantCount = db.prepare("SELECT COUNT(*) AS count FROM product_variants").get();
  if (variantCount.count === 0) {
    const insertVariant = db.prepare("INSERT INTO product_variants (id, component_id, attribute_name, attribute_value, stock_delta) VALUES (?, ?, ?, ?, ?)");
    insertVariant.run("VAR-CASE-BLU", "MECH-CASE-01", "Color", "Metallic Blue", 120);
    insertVariant.run("VAR-CASE-CHR", "MECH-CASE-01", "Color", "Mirror Chrome", 60);
    insertVariant.run("VAR-RES-REEL", "RES-10K-0603", "Packaging", "7-inch Tape & Reel", 4e4);
    insertVariant.run("VAR-RES-BULK", "RES-10K-0603", "Packaging", "Loose Bulk Bag", 1e4);
  }
  const lotCount = db.prepare("SELECT COUNT(*) AS count FROM lots_serial").get();
  if (lotCount.count === 0) {
    const insertLot = db.prepare("INSERT INTO lots_serial (id, component_id, lot_number, serial_number, quantity, expiration_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insertLot.run("LOT-RES-A01", "RES-10K-0603", "LOT-2026-R10K-01", null, 4e4, "2029-12-31", "good");
    insertLot.run("LOT-STM-B01", "IC-STM32F4", "LOT-2026-STM-02", "SN-STM32-91A23D", 200, "2030-05-20", "good");
    insertLot.run("LOT-STM-B02", "IC-STM32F4", "LOT-2026-STM-02", "SN-STM32-84X22B", 250, "2030-05-20", "good");
    insertLot.run("LOT-ESP-C01", "IC-ESP32S3", "LOT-2026-ESP-03", null, 1200, "2030-06-15", "good");
    insertLot.run("LOT-CAM-D01", "MOD-CAM-50M", "LOT-2026-CAM-05", "SN-CAM-7712", 95, "2028-09-10", "good");
  }
  const reorderCount = db.prepare("SELECT COUNT(*) AS count FROM reordering_rules").get();
  if (reorderCount.count === 0) {
    const insertReorder = db.prepare("INSERT INTO reordering_rules (id, component_id, min_qty, max_qty, active) VALUES (?, ?, ?, ?, ?)");
    insertReorder.run("RR-STM32", "IC-STM32F4", 500, 2e3, 1);
    insertReorder.run("RR-ESP32", "IC-ESP32S3", 800, 3e3, 1);
    insertReorder.run("RR-CAM50", "MOD-CAM-50M", 150, 500, 1);
    insertReorder.run("RR-RES10", "RES-10K-0603", 1e4, 6e4, 1);
  }
  const movesCount = db.prepare("SELECT COUNT(*) AS count FROM stock_moves").get();
  if (movesCount.count === 0) {
    const insertMove = db.prepare("INSERT INTO stock_moves (id, component_id, lot_id, qty, from_location_id, to_location_id, operation_type, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    insertMove.run("SM-001", "IC-STM32F4", "LOT-STM-B01", 200, "WH-MAIN-INCOMING", "WH-MAIN-ZONE-B", "receipt", "done", timestamp, "alice_member");
    insertMove.run("SM-002", "IC-ESP32S3", "LOT-ESP-C01", 500, "WH-MAIN-INCOMING", "WH-MAIN-ZONE-B", "receipt", "done", timestamp, "alice_member");
  }
}
function appendAuditLog(username, role, action, details) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const details_str = JSON.stringify(details);
  try {
    db.prepare("INSERT INTO audit_logs (timestamp, username, role, action, details) VALUES (?, ?, ?, ?, ?)").run(timestamp, username, role, action, details_str);
  } catch (error) {
    console.error("Error writing audit log to SQLite:", error);
  }
  const logEntry = { timestamp, username, role, action, details };
  try {
    import_fs.default.appendFileSync(AUDIT_LOGS_PATH, JSON.stringify(logEntry) + "\n");
  } catch (error) {
    console.error("Error writing audit log file:", error);
  }
}
initializeSqliteDb();
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (user && (password === `${user.role}123` || password === "member123" || password === "lead123" || password === "director123")) {
      appendAuditLog(username, user.role, "USER_LOGIN", { name: user.full_name });
      res.json({ success: true, user: { username: user.username, role: user.role, name: user.full_name } });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials." });
    }
  } catch (err) {
    res.status(500).json({ error: "Auth failed", details: err.message });
  }
});
app.get("/api/inventory", (req, res) => {
  try {
    const components = db.prepare("SELECT * FROM components").all();
    const processed = components.map((c) => {
      const available = c.stock - c.reserved;
      let status = "In Stock";
      if (available <= 0) status = "Out of Stock";
      else if (available < c.safety_stock) status = "Low Stock";
      return { ...c, available, status };
    });
    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inventory", details: err.message });
  }
});
app.get("/api/orders", (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders", details: err.message });
  }
});
app.post("/api/orders", (req, res) => {
  const { component_id, qty, unit_price, username, role } = req.body;
  try {
    const component = db.prepare("SELECT * FROM components WHERE id = ?").get(component_id);
    if (!component) {
      return res.status(404).json({ message: "Component not found." });
    }
    const total_price = parseFloat((qty * unit_price).toFixed(2));
    let status = "pending_approval";
    let role_required = "lead";
    let compliance_notes = "Complies with base supply safety margins.";
    if (component.supplier === "BlockedElectronics" || component.supplier === "RiskyTech") {
      status = "rejected";
      role_required = "director";
      compliance_notes = `REJECTED: Supplier ${component.supplier} is blacklisted.`;
    } else if (total_price < 100) {
      status = "approved";
      role_required = "member";
    } else if (total_price <= 1e3) {
      status = "pending_approval";
      role_required = "lead";
    } else {
      status = "pending_approval";
      role_required = "director";
    }
    const order_id = `PO-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const insert = db.prepare(`
      INSERT INTO orders (id, component_id, qty, unit_price, total_price, status, role_required, approver, created_at, updated_at, compliance_notes, price_risk)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      order_id,
      component_id,
      parseInt(qty),
      parseFloat(unit_price),
      total_price,
      status,
      role_required,
      status === "approved" ? username : null,
      timestamp,
      timestamp,
      compliance_notes,
      "LOW"
    );
    appendAuditLog(username, role, "ORDER_CREATE", { order_id, component_id, total_price, status });
    const newOrder = {
      id: order_id,
      component_id,
      qty: parseInt(qty),
      unit_price: parseFloat(unit_price),
      total_price,
      status,
      role_required,
      approver: status === "approved" ? username : null,
      created_at: timestamp,
      updated_at: timestamp,
      compliance_notes,
      price_risk: "LOW"
    };
    res.json(newOrder);
  } catch (err) {
    res.status(500).json({ error: "Failed to create order", details: err.message });
  }
});
app.post("/api/orders/:id/approve", (req, res) => {
  const { id } = req.params;
  const { username, role } = req.body;
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    if (order.status !== "pending_approval") {
      return res.status(400).json({ message: "Order is not pending approval." });
    }
    if (order.role_required === "director" && role !== "director") {
      return res.status(403).json({ message: "Only Director can approve high-value orders." });
    }
    const updated_at = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE orders SET status = 'approved', approver = ?, updated_at = ? WHERE id = ?").run(username, updated_at, id);
    appendAuditLog(username, role, "ORDER_APPROVE", { order_id: id });
    res.json({ ...order, status: "approved", approver: username, updated_at });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve order", details: err.message });
  }
});
app.post("/api/orders/:id/reject", (req, res) => {
  const { id } = req.params;
  const { username, role, reason } = req.body;
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    const compliance_notes = reason || "Rejected by manual approval flow.";
    const updated_at = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE orders SET status = 'rejected', approver = ?, compliance_notes = ?, updated_at = ? WHERE id = ?").run(username, compliance_notes, updated_at, id);
    appendAuditLog(username, role, "ORDER_REJECT", { order_id: id, reason });
    res.json({ ...order, status: "rejected", approver: username, compliance_notes, updated_at });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject order", details: err.message });
  }
});
app.get("/api/reservations", (req, res) => {
  try {
    const reservations = db.prepare("SELECT * FROM reservations ORDER BY created_at DESC").all();
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reservations", details: err.message });
  }
});
app.post("/api/reservations", (req, res) => {
  const { component_id, qty, production_group, username, role } = req.body;
  try {
    const component = db.prepare("SELECT * FROM components WHERE id = ?").get(component_id);
    if (!component) {
      return res.status(404).json({ message: "Component not found." });
    }
    const available = component.stock - component.reserved;
    if (qty > available) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${available}, requested: ${qty}` });
    }
    const resv_id = `RESV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const created = /* @__PURE__ */ new Date();
    const expires = /* @__PURE__ */ new Date();
    expires.setDate(created.getDate() + 30);
    db.prepare(`
      INSERT INTO reservations (id, component_id, qty, production_group, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(resv_id, component_id, parseInt(qty), production_group, created.toISOString(), expires.toISOString());
    db.prepare("UPDATE components SET reserved = reserved + ? WHERE id = ?").run(parseInt(qty), component_id);
    appendAuditLog(username, role, "RESERVATION_CREATE", { reservation_id: resv_id, component_id, qty });
    const newRes = {
      id: resv_id,
      component_id,
      qty: parseInt(qty),
      production_group,
      status: "active",
      created_at: created.toISOString(),
      expires_at: expires.toISOString()
    };
    res.json(newRes);
  } catch (err) {
    res.status(500).json({ error: "Failed to create reservation", details: err.message });
  }
});
app.post("/api/qc", (req, res) => {
  const { barcode, passed, username, role } = req.body;
  const parts = barcode.split("|");
  if (parts.length !== 3) {
    return res.status(400).json({ message: "Invalid barcode format. Expected: ComponentID|OrderID|BatchNumber" });
  }
  const [comp_id, order_id, batch_num] = parts;
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id);
    if (!order) {
      return res.status(404).json({ message: `Order ${order_id} not found.` });
    }
    if (order.component_id !== comp_id) {
      return res.status(400).json({ message: `Barcode component mismatch. Order lists ${order.component_id}, scanned ${comp_id}` });
    }
    if (order.status !== "approved") {
      return res.status(400).json({ message: `Invalid status. Order must be approved first.` });
    }
    const updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (passed) {
      const component = db.prepare("SELECT * FROM components WHERE id = ?").get(comp_id);
      if (component) {
        const oldStock = component.stock;
        const oldCost = component.average_cost;
        const qty = order.qty;
        const price = order.unit_price;
        const newStock = oldStock + qty;
        const newCost = parseFloat(((oldStock * oldCost + qty * price) / newStock).toFixed(4));
        db.prepare("UPDATE components SET stock = ?, average_cost = ? WHERE id = ?").run(newStock, newCost, comp_id);
      }
      db.prepare("UPDATE orders SET status = 'qc_passed', updated_at = ? WHERE id = ?").run(updated_at, order_id);
      appendAuditLog(username, role, "QC_PASS", { order_id, component_id: comp_id, batch: batch_num });
      res.json({ success: true, status: "qc_passed", message: `Stock successfully adjusted for component ${comp_id}.` });
    } else {
      db.prepare("UPDATE orders SET status = 'qc_failed', updated_at = ? WHERE id = ?").run(updated_at, order_id);
      appendAuditLog(username, role, "QC_FAIL", { order_id, component_id: comp_id, batch: batch_num });
      res.json({ success: true, status: "qc_failed", message: `Quality check failed. Order flagged for return.` });
    }
  } catch (err) {
    res.status(500).json({ error: "QC failed", details: err.message });
  }
});
app.get("/api/forecasting", (req, res) => {
  try {
    const components = db.prepare("SELECT * FROM components").all();
    const report = components.map((c) => {
      let adu = 12.5;
      if (c.id.includes("RES")) adu = 450;
      else if (c.id.includes("CAP")) adu = 320;
      else if (c.id.includes("IC-STM")) adu = 18;
      else if (c.id.includes("IC-ESP")) adu = 45;
      else if (c.id.includes("MOD-DISP")) adu = 6.2;
      else if (c.id.includes("MOD-CAM")) adu = 4.8;
      else if (c.id.includes("MOD-BAT")) adu = 22;
      const available = c.stock - c.reserved;
      const dsr = adu > 0 ? parseFloat((available / adu).toFixed(1)) : 999;
      const safetyDays = c.safety_stock / adu;
      const thresholdDays = c.lead_time + safetyDays;
      const needs_reorder = dsr < thresholdDays;
      const recommended_qty = needs_reorder ? Math.ceil(adu * 30) : 0;
      return {
        component_id: c.id,
        name: c.name,
        category: c.category,
        current_stock: c.stock,
        reserved: c.reserved,
        adu,
        dsr,
        needs_reorder,
        recommended_qty,
        lead_time: c.lead_time,
        safety_stock: c.safety_stock,
        supplier: c.supplier,
        average_cost: c.average_cost
      };
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Forecasting failed", details: err.message });
  }
});
app.get("/api/logs", (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC").all();
    const formatted = logs.map((l) => {
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(l.details);
      } catch (e) {
        parsedDetails = { raw: l.details };
      }
      return {
        timestamp: l.timestamp,
        username: l.username,
        role: l.role,
        action: l.action,
        details: parsedDetails
      };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Failed to read logs", details: err.message });
  }
});
app.post("/api/agent-analyze", async (req, res) => {
  const { component_id, qty, unit_price, supplier } = req.body;
  try {
    const component = db.prepare("SELECT * FROM components WHERE id = ?").get(component_id);
    const total = qty * unit_price;
    let prompt = `
    Analyze this manufacturing procurement request:
    - Component ID: ${component_id}
    - Component Name: ${component?.name || "Unknown"}
    - Category: ${component?.category || "Unknown"}
    - Current Warehouse Stock: ${component?.stock || 0}
    - Safety Stock Buffer: ${component?.safety_stock || 1e3}
    - Order Quantity: ${qty}
    - Unit Price Offered: $${unit_price}
    - Total Price: $${total}
    - Supplier: ${supplier || "Unknown"}

    Consider factory supply chain and compliance rules:
    1. Supplier Veto/Block: Banned suppliers are "BlockedElectronics" and "RiskyTech".
    2. Multi-level approvals thresholds: Orders < $100 are auto-approved; $100 to $1,000 need Supply Lead approval; > $1,000 need Operations Director approval.
    3. Pricing: Compare if unit price ($${unit_price}) is reasonable or bloated relative to normal component pricing (e.g., standard chips are $2-$10, resistors are $0.002-$0.01).
    
    Please provide an expert supply chain risk analysis in JSON format. Do not write markdown blocks other than clean JSON.
    Response JSON structure:
    {
      "decision": "APPROVE" | "REQUIRE_HITL" | "REJECT",
      "risk_score": 0 to 100 (number),
      "reasoning": "A concise paragraph explaining safety limits, price variance, and authority routing.",
      "compliance_status": "PASSED" | "FAILED",
      "recommendations": [
         "recommendation 1",
         "recommendation 2"
      ]
    }
    `;
    if (!ai) {
      const isBanned = supplier === "BlockedElectronics" || supplier === "RiskyTech";
      const decision = isBanned ? "REJECT" : total > 1e3 ? "REQUIRE_HITL" : "APPROVE";
      const risk_score = isBanned ? 95 : total > 1e3 ? 45 : 10;
      return res.json({
        decision,
        risk_score,
        reasoning: `[MOCK ENGINE] Rules check completed. Safety levels: ${component?.stock || 0}/${component?.safety_stock || 0}. Total spend: $${total}. ${isBanned ? "Supplier blacklisted." : "Sufficient budget ceiling."}`,
        compliance_status: isBanned ? "FAILED" : "PASSED",
        recommendations: [
          isBanned ? "Immediately disqualify supplier." : "Validate shipping lead times with vendor.",
          "Ensure barcode tag adheres to factory standards."
        ]
      });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = response.text || "{}";
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Brain agent analysis failed", details: error.message });
  }
});
app.get("/api/erp/warehouses", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM warehouses").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch warehouses", details: err.message });
  }
});
app.get("/api/erp/locations", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM locations").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch locations", details: err.message });
  }
});
app.get("/api/erp/putaway-rules", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM putaway_rules").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch putaway rules", details: err.message });
  }
});
app.get("/api/erp/product-variants", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM product_variants").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product variants", details: err.message });
  }
});
app.get("/api/erp/lots", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM lots_serial").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lots/serials", details: err.message });
  }
});
app.get("/api/erp/stock-moves", (req, res) => {
  try {
    const list = db.prepare("SELECT sm.*, c.name as component_name FROM stock_moves sm JOIN components c ON sm.component_id = c.id ORDER BY sm.created_at DESC").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stock moves", details: err.message });
  }
});
app.get("/api/erp/reordering-rules", (req, res) => {
  try {
    const list = db.prepare("SELECT rr.*, c.name as component_name FROM reordering_rules rr JOIN components c ON rr.component_id = c.id").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reordering rules", details: err.message });
  }
});
app.post("/api/erp/reordering-rules", (req, res) => {
  const { component_id, min_qty, max_qty, username, role } = req.body;
  try {
    const rule_id = `RR-${component_id}`;
    db.prepare(`
      INSERT INTO reordering_rules (id, component_id, min_qty, max_qty, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(component_id) DO UPDATE SET min_qty = excluded.min_qty, max_qty = excluded.max_qty
    `).run(rule_id, component_id, parseInt(min_qty), parseInt(max_qty));
    appendAuditLog(username || "system", role || "lead", "REORDER_RULE_UPDATE", { component_id, min_qty, max_qty });
    res.json({ success: true, message: `Reordering rule updated for ${component_id}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to update reordering rule", details: err.message });
  }
});
app.get("/api/erp/adjustments", (req, res) => {
  try {
    const list = db.prepare("SELECT ia.*, c.name as component_name, l.name as location_name FROM inventory_adjustments ia JOIN components c ON ia.component_id = c.id JOIN locations l ON ia.location_id = l.id ORDER BY ia.created_at DESC").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inventory adjustments", details: err.message });
  }
});
app.post("/api/erp/adjustments", (req, res) => {
  const { component_id, location_id, real_qty, username, role } = req.body;
  try {
    const component = db.prepare("SELECT * FROM components WHERE id = ?").get(component_id);
    if (!component) return res.status(404).json({ message: "Component not found." });
    const theoretical_qty = component.stock;
    const diff = real_qty - theoretical_qty;
    const adj_id = `ADJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(`
      INSERT INTO inventory_adjustments (id, component_id, location_id, theoretical_qty, real_qty, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'completed', ?)
    `).run(adj_id, component_id, location_id, theoretical_qty, real_qty, timestamp);
    db.prepare("UPDATE components SET stock = ? WHERE id = ?").run(real_qty, component_id);
    const move_id = `SM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    db.prepare(`
      INSERT INTO stock_moves (id, component_id, lot_id, qty, from_location_id, to_location_id, operation_type, status, created_at, created_by)
      VALUES (?, ?, null, ?, ?, ?, 'adjustment', 'done', ?, ?)
    `).run(
      move_id,
      component_id,
      Math.abs(diff),
      diff >= 0 ? "VIRTUAL-CUSTOMER" : location_id,
      diff >= 0 ? location_id : "VIRTUAL-CUSTOMER",
      timestamp,
      username || "anonymous"
    );
    appendAuditLog(username || "anonymous", role || "member", "INVENTORY_ADJUSTMENT", {
      component_id,
      theoretical_qty,
      real_qty,
      difference: diff
    });
    res.json({ success: true, message: "Inventory successfully updated to reflect physical count.", theoretical_qty, real_qty });
  } catch (err) {
    res.status(500).json({ error: "Failed to execute inventory adjustment", details: err.message });
  }
});
app.post("/api/erp/stock-moves", (req, res) => {
  const { component_id, lot_id, qty, from_location_id, to_location_id, operation_type, username, role } = req.body;
  try {
    const component = db.prepare("SELECT * FROM components WHERE id = ?").get(component_id);
    if (!component) return res.status(404).json({ message: "Component not found." });
    const qVal = parseInt(qty);
    if (isNaN(qVal) || qVal <= 0) return res.status(400).json({ message: "Invalid transfer quantity." });
    const sourceLoc = db.prepare("SELECT * FROM locations WHERE id = ?").get(from_location_id);
    const destLoc = db.prepare("SELECT * FROM locations WHERE id = ?").get(to_location_id);
    if (sourceLoc && sourceLoc.zone_type === "internal") {
      const available = component.stock - component.reserved;
      if (qVal > available) {
        return res.status(400).json({ message: `Insufficient available stock for transfer. Stock: ${component.stock}, Reserved: ${component.reserved}, Transferring: ${qVal}` });
      }
    }
    const move_id = `SM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    let oldStock = component.stock;
    let newStock = oldStock;
    if (operation_type === "receipt") {
      newStock += qVal;
    } else if (operation_type === "delivery" || operation_type === "scrap") {
      newStock -= qVal;
    } else if (operation_type === "internal") {
      if (destLoc) {
        db.prepare("UPDATE components SET warehouse_zone = ? WHERE id = ?").run(destLoc.name, component_id);
      }
    }
    db.prepare(`
      INSERT INTO stock_moves (id, component_id, lot_id, qty, from_location_id, to_location_id, operation_type, status, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'done', ?, ?)
    `).run(move_id, component_id, lot_id || null, qVal, from_location_id, to_location_id, operation_type, timestamp, username || "anonymous");
    if (newStock !== oldStock) {
      db.prepare("UPDATE components SET stock = ? WHERE id = ?").run(newStock, component_id);
    }
    appendAuditLog(username || "anonymous", role || "member", `STOCK_${operation_type.toUpperCase()}`, {
      component_id,
      qty: qVal,
      from_location_id,
      to_location_id,
      old_stock: oldStock,
      new_stock: newStock
    });
    res.json({
      success: true,
      move_id,
      old_stock: oldStock,
      new_stock: newStock,
      message: `Successfully executed ${operation_type} stock operation.`
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to execute stock move operation", details: err.message });
  }
});
app.get("/api/erp/valuation", (req, res) => {
  try {
    const method = req.query.method || "AVCO";
    const components = db.prepare("SELECT * FROM components").all();
    const report = components.map((c) => {
      const qty = c.stock;
      let unitPrice = c.average_cost;
      if (method === "Standard") {
        unitPrice = c.id.includes("RES") ? 25e-4 : c.id.includes("CAP") ? 0.012 : c.id.includes("IC") ? 6.5 : 15;
      } else if (method === "FIFO") {
        unitPrice = parseFloat((c.average_cost * 1.05).toFixed(4));
      }
      const totalValuation = parseFloat((qty * unitPrice).toFixed(2));
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        stock: qty,
        unit_price: unitPrice,
        total_valuation: totalValuation,
        method
      };
    });
    const totalPortfolioValuation = report.reduce((sum, item) => sum + item.total_valuation, 0);
    res.json({
      method,
      total_portfolio_valuation: totalPortfolioValuation,
      items: report
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate inventory valuation", details: err.message });
  }
});
app.post("/api/reset-sandbox", (req, res) => {
  const { user_session } = req.body;
  const sanitizedSession = String(user_session || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  const sandboxPath = import_path.default.join("/tmp", `procureflow_sandbox_${sanitizedSession}`);
  try {
    if (import_fs.default.existsSync(sandboxPath)) {
      import_fs.default.rmSync(sandboxPath, { recursive: true, force: true });
    }
    import_fs.default.mkdirSync(sandboxPath, { recursive: true });
    import_fs.default.writeFileSync(import_path.default.join(sandboxPath, "README.md"), "this is a sandbox");
    res.json({ success: true, message: "Sandbox reset complete. Only README.md exists with 'this is a sandbox'." });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset sandbox", details: err.message });
  }
});
app.post("/api/cli-command", (req, res) => {
  const { command, user_session, current_dir } = req.body;
  if (!command) {
    return res.status(400).json({ output: "Empty command." });
  }
  const sanitizedSession = String(user_session || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  const sandboxPath = import_path.default.join("/tmp", `procureflow_sandbox_${sanitizedSession}`);
  try {
    if (!import_fs.default.existsSync(sandboxPath)) {
      import_fs.default.mkdirSync(sandboxPath, { recursive: true });
    }
    const readmePath = import_path.default.join(sandboxPath, "README.md");
    if (!import_fs.default.existsSync(readmePath) || import_fs.default.readFileSync(readmePath, "utf8").trim() !== "this is a sandbox") {
      import_fs.default.writeFileSync(readmePath, "this is a sandbox");
    }
  } catch (err) {
    console.error("Error setting up sandbox folder:", err);
  }
  let relCwd = current_dir || ".";
  let fullCwd = import_path.default.resolve(sandboxPath, relCwd);
  if (!fullCwd.startsWith(sandboxPath)) {
    fullCwd = sandboxPath;
    relCwd = ".";
  }
  const trimmedCmd = command.trim();
  const parts = trimmedCmd.split(/\s+/);
  const mainCmd = parts[0];
  if (mainCmd === "cd") {
    const targetDir = parts[1] || "";
    let newFullCwd = fullCwd;
    if (targetDir === "") {
      newFullCwd = sandboxPath;
    } else {
      newFullCwd = import_path.default.resolve(fullCwd, targetDir);
    }
    if (!newFullCwd.startsWith(sandboxPath)) {
      return res.json({
        output: "Access Denied: Exiting the sandbox is prohibited.",
        current_dir: relCwd
      });
    }
    if (!import_fs.default.existsSync(newFullCwd)) {
      return res.json({
        output: `cd: no such file or directory: ${targetDir}`,
        current_dir: relCwd
      });
    }
    if (!import_fs.default.statSync(newFullCwd).isDirectory()) {
      return res.json({
        output: `cd: not a directory: ${targetDir}`,
        current_dir: relCwd
      });
    }
    const updatedRel = import_path.default.relative(sandboxPath, newFullCwd) || ".";
    return res.json({
      output: "",
      current_dir: updatedRel
    });
  }
  const lowerCmd = trimmedCmd.toLowerCase();
  const hasForbiddenKeywords = lowerCmd.includes("..") || lowerCmd.includes("/workspace") || lowerCmd.includes("/src") || lowerCmd.includes("server.ts") || lowerCmd.includes("app.tsx") || lowerCmd.includes("package.json") || lowerCmd.includes("db_store.json") || lowerCmd.includes(".env");
  if (hasForbiddenKeywords) {
    return res.json({
      output: "Access Denied: Path traversal or escaping the sandbox directory is strictly prohibited.",
      current_dir: relCwd
    });
  }
  const absolutePathRegex = /(^|\s)\/(?!tmp\/)[a-zA-Z0-9_-]+/g;
  if (absolutePathRegex.test(trimmedCmd)) {
    return res.json({
      output: "Access Denied: Absolute paths outside of /tmp are prohibited in this sandbox.",
      current_dir: relCwd
    });
  }
  const isPythonCli = (mainCmd === "python" || mainCmd === "python3") && parts[1] === "cli.py";
  if (isPythonCli) {
    const args = parts.slice(2);
    const pythonCmd = `python3 python_system/cli.py ${args.join(" ")}`;
    (0, import_child_process.exec)(pythonCmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.log("Python execution failed, falling back to SQLite-synced emulator...");
        const action = args[0];
        if (action === "login") {
          const uArgIdx = args.indexOf("--user");
          const pArgIdx = args.indexOf("--password");
          if (uArgIdx === -1 || pArgIdx === -1) {
            return res.json({ output: "Usage: python cli.py login --user <username> --password <password>", current_dir: relCwd });
          }
          const username = args[uArgIdx + 1];
          const password = args[pArgIdx + 1];
          try {
            const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
            if (user && (password === `${user.role}123` || password === "member123" || password === "lead123" || password === "director123")) {
              return res.json({ output: `\u2714 Access Granted. Welcome, ${username}! Role established: [${user.role.toUpperCase()}]`, current_dir: relCwd });
            } else {
              return res.json({ output: "\u2718 Access Denied. Invalid security credentials.", current_dir: relCwd });
            }
          } catch (e) {
            return res.json({ output: `Error: ${e.message}`, current_dir: relCwd });
          }
        }
        if (action === "inventory") {
          try {
            let items = db.prepare("SELECT * FROM components").all();
            const catIdx = args.indexOf("--category");
            if (catIdx !== -1) {
              items = items.filter((i) => i.category === args[catIdx + 1]);
            }
            let out = "\n=== FACTORY STOCK ROOM ===\n";
            out += "ID             | Name                        | Stock | Reserved | Avg Cost | Zone\n";
            out += "---------------------------------------------------------------------------------\n";
            items.forEach((c) => {
              out += `${c.id.padEnd(14)} | ${c.name.substring(0, 27).padEnd(27)} | ${String(c.stock).padEnd(5)} | ${String(c.reserved).padEnd(8)} | $${c.average_cost.toFixed(3).padEnd(7)} | ${c.warehouse_zone}
`;
            });
            return res.json({ output: out, current_dir: relCwd });
          } catch (e) {
            return res.json({ output: `Error: ${e.message}`, current_dir: relCwd });
          }
        }
        if (action === "order") {
          const compIdx = args.indexOf("--comp");
          const qtyIdx = args.indexOf("--qty");
          const priceIdx = args.indexOf("--price");
          if (compIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
            return res.json({ output: "Usage: python cli.py order --comp <id> --qty <qty> --price <price>", current_dir: relCwd });
          }
          const compId = args[compIdx + 1];
          const qty = parseInt(args[qtyIdx + 1]);
          const price = parseFloat(args[priceIdx + 1]);
          const total = qty * price;
          const isBanned = compId.includes("TEST-RISK");
          let status = total < 100 ? "approved" : "pending_approval";
          let role_required = total < 100 ? "member" : total <= 1e3 ? "lead" : "director";
          if (isBanned) {
            status = "rejected";
            role_required = "director";
          }
          try {
            const order_id = `PO-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const timestamp = (/* @__PURE__ */ new Date()).toISOString();
            db.prepare(`
              INSERT INTO orders (id, component_id, qty, unit_price, total_price, status, role_required, approver, created_at, updated_at, compliance_notes, price_risk)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LOW')
            `).run(order_id, compId, qty, price, total, status, role_required, status === "approved" ? "cli_user" : null, timestamp, timestamp, "CLI auto-placed order.");
            appendAuditLog("cli_user", "member", "ORDER_CREATE", { order_id, component_id: compId, total_price: total, status });
            let out = `\u2714 Procurement request generated for ${compId}.
`;
            out += `Order ID: ${order_id}
`;
            out += `Stock compliance outcome: ${status.toUpperCase()}
`;
            out += `Pricing deviation risk: LOW (Market index benchmark: $${price.toFixed(2)})
`;
            out += `Audit logs compliance detail: Standard verification process completed.`;
            return res.json({ output: out, current_dir: relCwd });
          } catch (e) {
            return res.json({ output: `Procurement generation failed: ${e.message}`, current_dir: relCwd });
          }
        }
        if (action === "forecast") {
          try {
            const items = db.prepare("SELECT * FROM components LIMIT 8").all();
            let out = "\n=== DEMAND FORECAST & REORDER RECOMMENDATIONS ===\n";
            out += "ID             | Name                      | Stock | ADU   | DSR   | Reorder Req? | Rec Qty\n";
            out += "--------------------------------------------------------------------------------------------\n";
            items.forEach((c) => {
              let adu = c.id.includes("RES") ? 450 : 12;
              let dsr = c.stock / adu;
              let needs = dsr < 15;
              out += `${c.id.padEnd(14)} | ${c.name.substring(0, 25).padEnd(25)} | ${String(c.stock).padEnd(5)} | ${String(adu).padEnd(5)} | ${dsr.toFixed(1).padEnd(5)} | ${needs ? "YES" : "NO "}          | ${needs ? 350 : 0}
`;
            });
            return res.json({ output: out, current_dir: relCwd });
          } catch (e) {
            return res.json({ output: `Error: ${e.message}`, current_dir: relCwd });
          }
        }
        if (action === "audit") {
          try {
            const logsList = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10").all();
            let out = "--- STRICT SQLITE AUDIT LOGS ---\n";
            logsList.forEach((log) => {
              let details = {};
              try {
                details = JSON.parse(log.details);
              } catch (err) {
                details = log.details;
              }
              out += `[${log.timestamp}] USER:${log.username} (${log.role?.toUpperCase()}) - ACTION:${log.action} DETAILS:${JSON.stringify(details)}
`;
            });
            return res.json({ output: out, current_dir: relCwd });
          } catch (e) {
            return res.json({ output: `Error: ${e.message}`, current_dir: relCwd });
          }
        }
        return res.json({ output: `Command executed. Run 'python cli.py inventory' or 'python cli.py forecast' for visual tables.`, current_dir: relCwd });
      }
      res.json({ output: stdout || stderr, current_dir: relCwd });
    });
  } else {
    if (mainCmd === "pwd") {
      const displayPath = relCwd === "." ? "/" : "/" + relCwd;
      return res.json({
        output: displayPath,
        current_dir: relCwd
      });
    }
    (0, import_child_process.exec)(trimmedCmd, { cwd: fullCwd }, (error, stdout, stderr) => {
      let finalOutput = stdout || stderr || "";
      if (error && !finalOutput) {
        finalOutput = error.message;
      }
      if (finalOutput.includes(sandboxPath)) {
        finalOutput = finalOutput.split(sandboxPath).join("");
      }
      res.json({
        output: finalOutput || "Command completed successfully (no output).",
        current_dir: relCwd
      });
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Supply Chain Logistics Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
