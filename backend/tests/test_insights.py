"""
tests/test_insights.py — Comprehensive unit tests for AI Insights module.
Tests summary metrics, MoM calculations, category breakdowns, multi-month trends,
explainable anomaly detection, alert dismissal, and grounded saving recommendations.
"""
import unittest
import os
import tempfile
from app import create_app
from database.db import init_db, get_db_connection, dollars_to_cents


class TestInsightsAPI(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".sqlite")
        init_db(self.db_path)

        class TestConfig:
            TESTING = True
            DATABASE_PATH = self.db_path

        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def _insert_txn(self, cat, desc, amount, date_str, tx_type="expense", status="approved"):
        with get_db_connection(self.db_path) as conn:
            cur = conn.execute(
                """
                INSERT INTO transactions (
                    user_id, transaction_type, category, description,
                    payment_method, amount_cents, transaction_date, review_status
                ) VALUES (1, ?, ?, ?, 'Credit Card', ?, ?, ?)
                """,
                (tx_type, cat, desc, dollars_to_cents(amount), date_str, status)
            )
            conn.commit()
            return cur.lastrowid

    def _insert_budget(self, cat, amount, month, year):
        with get_db_connection(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO budgets (
                    category, amount_cents, period, budget_month, budget_year,
                    month, year, notes
                ) VALUES (?, ?, 'monthly', ?, ?, ?, ?, 'Test Budget')
                """,
                (cat, dollars_to_cents(amount), month, year, month, year)
            )
            conn.commit()

    def test_summary_empty_database(self):
        """Empty database should return safe zero values and handle missing data gracefully."""
        res = self.client.get("/api/insights/summary?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]
        self.assertEqual(data["total_expenses"], 0.0)
        self.assertEqual(data["transaction_count"], 0)
        self.assertEqual(data["comparison"]["difference"], 0.0)
        self.assertIsNone(data["highest_category"])
        self.assertEqual(data["daily_spending"]["average_per_day"], 0.0)

    def test_summary_mom_calculations(self):
        """Current month vs previous month should compute accurate dollar and percentage variance."""
        # Previous month: Sep 2026 ($200 total)
        self._insert_txn("Food", "Groceries", 200.0, "2026-09-15")

        # Current month: Oct 2026 ($300 total)
        self._insert_txn("Food", "Supermarket", 150.0, "2026-10-05")
        self._insert_txn("Entertainment", "Concert Tickets", 150.0, "2026-10-12")

        res = self.client.get("/api/insights/summary?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertEqual(data["total_expenses"], 300.0)
        self.assertEqual(data["previous_month"]["total_expenses"], 200.0)
        self.assertEqual(data["comparison"]["difference"], 100.0)
        self.assertEqual(data["comparison"]["percentage"], 50.0)
        self.assertTrue(data["comparison"]["is_increase"])
        self.assertIsNotNone(data["highest_category"])
        self.assertEqual(data["highest_category"]["amount"], 150.0)

    def test_category_breakdown_and_percentages(self):
        """Categories endpoint should return accurate shares, MoM changes, and budget limits."""
        self._insert_txn("Food", "Market", 300.0, "2026-10-02")
        self._insert_txn("Transportation", "Gasoline", 100.0, "2026-10-08")
        self._insert_budget("Food", 400.0, 10, 2026)

        res = self.client.get("/api/insights/categories?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        items = res.get_json()["data"]

        self.assertEqual(len(items), 2)
        food_item = next(i for i in items if i["category"] == "Food")
        self.assertEqual(food_item["amount"], 300.0)
        self.assertEqual(food_item["percentage"], 75.0)
        self.assertEqual(food_item["budget_limit"], 400.0)
        self.assertEqual(food_item["budget_used_percentage"], 75.0)

    def test_trends_multi_month(self):
        """Trends endpoint should analyze rolling months and identify spending patterns."""
        self._insert_txn("Utilities", "Electric", 80.0, "2026-08-10")
        self._insert_txn("Utilities", "Electric", 95.0, "2026-09-10")
        self._insert_txn("Utilities", "Electric", 120.0, "2026-10-10")

        res = self.client.get("/api/insights/trends?months=3&month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertEqual(len(data["trends"]), 3)
        self.assertTrue(data["has_data"])
        # Utilities has increased in consecutive periods
        inc_cats = data["increasing_categories"]
        self.assertTrue(any(c["category"] == "Utilities" for c in inc_cats))

    def test_anomalies_insufficient_history(self):
        """Categories with fewer than 3 historical transactions should NOT flag false positive anomalies."""
        self._insert_txn("Healthcare", "Doctor Visit", 450.0, "2026-10-14")

        res = self.client.get("/api/insights/anomalies?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertEqual(data["total_flagged"], 0)
        self.assertTrue(any("insufficient" in r.lower() for r in data["insufficient_data_reasons"]))

    def test_anomalies_detection_and_dismissal(self):
        """Anomalies should flag genuine statistical outliers with plain-English reasons and allow dismissal."""
        # Insert 5 normal transactions for Healthcare (~$30-$40 each)
        self._insert_txn("Healthcare", "Pharmacy", 30.0, "2026-08-01")
        self._insert_txn("Healthcare", "Prescription", 35.0, "2026-08-15")
        self._insert_txn("Healthcare", "Supplements", 40.0, "2026-09-01")
        self._insert_txn("Healthcare", "Refill", 32.0, "2026-09-20")
        self._insert_txn("Healthcare", "First Aid", 38.0, "2026-10-02")

        # Insert a massive outlier in October
        outlier_id = self._insert_txn("Healthcare", "Emergency Dental Surgery", 850.0, "2026-10-15")

        res = self.client.get("/api/insights/anomalies?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertEqual(data["total_flagged"], 1)
        anomaly = data["anomalies"][0]
        self.assertEqual(anomaly["id"], outlier_id)
        self.assertEqual(anomaly["amount"], 850.0)
        self.assertEqual(anomaly["status"], "potentially_unusual")
        self.assertIn("historical average", anomaly["reason"])

        # Dismiss the anomaly
        dismiss_res = self.client.post(f"/api/insights/anomalies/{outlier_id}/dismiss")
        self.assertEqual(dismiss_res.status_code, 200)
        self.assertTrue(dismiss_res.get_json().get("success"))

        # Re-query anomalies: should no longer return dismissed outlier
        res_after = self.client.get("/api/insights/anomalies?month=10&year=2026")
        data_after = res_after.get_json()["data"]
        self.assertEqual(data_after["total_flagged"], 0)
        self.assertEqual(data_after["dismissed_count"], 1)

    def test_recommendations_grounded_in_data(self):
        """Saving recommendations must be derived from actual calculations with stated assumptions."""
        # Top category Grocery = $500, Budget = $400 (exceeded by $100)
        self._insert_txn("Food", "Weekly Groceries 1", 250.0, "2026-10-01")
        self._insert_txn("Food", "Weekly Groceries 2", 250.0, "2026-10-08")
        self._insert_budget("Food", 400.0, 10, 2026)

        # Discretionary entertainment
        self._insert_txn("Entertainment", "Concerts", 100.0, "2026-10-05")

        res = self.client.get("/api/insights/recommendations?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        recs = data["recommendations"]
        self.assertTrue(len(recs) >= 2)

        # Check budget exceeded recommendation
        budget_rec = next((r for r in recs if r["type"] == "budget_exceeded"), None)
        self.assertIsNotNone(budget_rec)
        self.assertIn("$100.00", budget_rec["title"])
        self.assertEqual(budget_rec["category"], "Food")

        # Check dominant category recommendation
        top_rec = next((r for r in recs if r["type"] == "dominant_category"), None)
        self.assertIsNotNone(top_rec)
        self.assertIn("10%", top_rec["potential_savings"])

    def test_recurring_candidates(self):
        """Repeated transactions across distinct months should be identified as recurring."""
        self._insert_txn("Entertainment", "Netflix Premium", 19.99, "2026-08-15")
        self._insert_txn("Entertainment", "Netflix Premium", 19.99, "2026-09-15")
        self._insert_txn("Entertainment", "Netflix Premium", 19.99, "2026-10-15")

        res = self.client.get("/api/insights/recurring")
        self.assertEqual(res.status_code, 200)
        items = res.get_json()["data"]

        self.assertTrue(len(items) >= 1)
        netflix = next((i for i in items if "Netflix" in i["description"]), None)
        self.assertIsNotNone(netflix)
        self.assertEqual(netflix["amount"], 19.99)
        self.assertEqual(netflix["occurrences"], 3)

    def test_invalid_parameters(self):
        """Invalid month or year parameters must return 400 bad request."""
        res1 = self.client.get("/api/insights/summary?month=15&year=2026")
        self.assertEqual(res1.status_code, 400)

        res2 = self.client.get("/api/insights/summary?month=abc&year=2026")
        self.assertEqual(res2.status_code, 400)


if __name__ == "__main__":
    unittest.main()
