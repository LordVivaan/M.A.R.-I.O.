"""
Procurement & Supply Chain Logistics System - Price Crawler
Simulates crawling and parsing supplier catalogs to fetch real-time pricing benchmarks.
Integrates with the Database layer to identify procurement price anomalies and risks.
"""

import random
from datetime import datetime
from python_system.db import EncryptedDB

class PriceCrawler:
    def __init__(self, db: EncryptedDB):
        self.db = db

    def crawl_supplier_catalog(self, component_id: str, supplier: str) -> float:
        """
        Simulates parsing current prices from supplier web APIs.
        Saves crawled price into supplier_catalog cache.
        """
        # Fetch base cost of component to simulate realistic deviation
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT average_cost FROM components WHERE id = ?", (component_id,))
        row = cursor.fetchone()
        
        if not row:
            # Random default benchmark if component doesn't exist
            base_price = round(random.uniform(1.0, 50.0), 4)
        else:
            base_price = row[0]

        # Simulate small fluctuations (+/- 10%)
        fluctuation = random.uniform(-0.10, 0.15)
        catalog_price = round(base_price * (1.0 + fluctuation), 4)
        if catalog_price <= 0:
            catalog_price = base_price

        # Update cache
        cursor.execute("""
        INSERT INTO supplier_catalog (component_id, supplier, catalog_price, last_checked)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(component_id, supplier) DO UPDATE SET
            catalog_price = excluded.catalog_price,
            last_checked = excluded.last_checked
        """, (component_id, supplier, catalog_price, datetime.utcnow().isoformat()))
        conn.commit()

        return catalog_price

    def assess_price_risk(self, component_id: str, supplier: str, order_unit_price: float) -> tuple[str, float]:
        """
        Compares order price with crawled supplier benchmark.
        Returns:
            - risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
            - benchmark_price: The catalog benchmark price
        """
        # Ensure fresh crawl
        benchmark_price = self.crawl_supplier_catalog(component_id, supplier)
        
        pct_diff = ((order_unit_price - benchmark_price) / benchmark_price) * 100.0

        if pct_diff <= 5.0:
            risk = "LOW"
        elif pct_diff <= 15.0:
            risk = "MEDIUM"
        else:
            risk = "HIGH"

        return risk, benchmark_price

if __name__ == "__main__":
    db = EncryptedDB()
    crawler = PriceCrawler(db)
    risk, price = crawler.assess_price_risk("IC-STM32F4", "DigiKey", 8.90)
    print(f"Price risk assessment: Level={risk}, Benchmark={price}")
