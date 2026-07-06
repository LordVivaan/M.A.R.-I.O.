# Multi-Agent Procurement & Supply Chain Logistics System

A production-ready enterprise supply chain system designed for smart electronics factories. It implements a secure "Brain vs. Muscle" architecture using a Python-based core orchestrator linked with intelligent decision-making agents.

## Core Features
1. **Inventory Control**: Real-time component tracking across zones (A-D) with low stock alerts and multi-level category groups (passives, semiconductors, assemblies, mechanical).
2. **Deterministic Muscle (Rules engine)**: Automatic threshold calculations, safety margins, monthly spend caps ($50,000), and vendor compliance checks (veto bans).
3. **Multi-Level HITL Approvals**:
   - `< $100` : Automated approval
   - `$100 - $1,000` : Supply Chain Lead Authorization required
   - `> $1,000` : Operations Director Authorization required
4. **Demand Forecasting (ADU & DSR)**: Predicts Days of Stock Remaining (DSR) based on historical Average Daily Usage (ADU) and auto-recommends purchase quantities.
5. **Quality Assurance receipts**: Scan barcoded items (`ComponentID|OrderID|BatchNumber`) and run double-pass inspections. Successful passes recalculate the stock's **weighted average cost** dynamically.

---

## Folder Structure
- `db.py`: Encrypted SQLite schema setup, bcrypt credentials, and realistic smartphone component seeds.
- `crawler.py`: Supplier price crawler simulation evaluating price discrepancies and risk.
- `notifier.py`: Dispatches slack webhook messages and email digests (mock and live modes).
- `core.py`: Coordinating orchestrator handling the business logic.
- `cli.py`: Formatted click/argparse CLI interface with pretty output tables.
- `test_procurement.py`: Complete standard test suite.

---

## Installation & Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Initialize Database and Seed Data**:
   ```bash
   python db.py
   ```
   This creates an encrypted SQLite database `factory_supply_chain.db` and writes key `db_secret.key`.

3. **Run Unit Test Suite**:
   ```bash
   python -m unittest test_procurement.py
   ```

---

## Interactive CLI Guide

### 1. Authenticate & Login
```bash
python cli.py login --user bob_lead --password lead123
```

### 2. View Warehouse Stock
```bash
python cli.py inventory --category semiconductor
```

### 3. Request a New Procurement Order
Submit a purchase request:
```bash
python cli.py order --comp IC-STM32F4 --qty 150 --price 7.50 --user-session alice_member
```

### 4. Approve Pending Purchase Request
If you have lead/director clearance:
```bash
python cli.py approve --order PO-2026-F614C3 --user-session bob_lead
```

### 5. Warehouse Quality Control Check
Scan incoming order with barcode validation format `ComponentID|OrderID|BatchNumber` and trigger status pass/fail:
```bash
python cli.py receive --barcode "IC-STM32F4|PO-2026-F614C3|BATCH-089" --pass-inspection --user-session alice_member
```

### 6. Forecast Reorders & DSR
Get real-time supply warnings and buying recommendations:
```bash
python cli.py forecast
```

### 7. Audit Compliance Log
Inspect JSON logs and DB ledger records:
```bash
python cli.py audit
```
