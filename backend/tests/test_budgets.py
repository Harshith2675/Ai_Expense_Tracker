"""
tests/test_budgets.py — Comprehensive unit tests for Budget Management module.
Tests CRUD operations, duplicate prevention, dynamic spending calculations from transactions,
threshold alert detection, and summary statistics.
"""
import unittest
import os
import tempfile
import json
from app import create_app
from database.db import init_db, get_db_connection, dollars_to_cents


class TestBudgetsAPI(unittest.TestCase):
    def setUp(self):
        # Create isolated temporary database for test run
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

    def _insert_transaction(self, cat, amount, date_str, tx_type="expense", status="approved"):
        with get_db_connection(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO transactions (
                    user_id, transaction_type, category, description,
                    payment_method, amount_cents, transaction_date, review_status
                ) VALUES (1, ?, ?, ?, 'Credit Card', ?, ?, ?)
                """,
                (tx_type, cat, f"Test {cat}", dollars_to_cents(amount), date_str, status)
            )
            conn.commit()

    def test_create_budget_valid(self):
        """Creating a valid monthly budget should succeed with status 201."""
        payload = {
            "category": "Food",
            "amount": 500.0,
            "month": 10,
            "year": 2026,
            "notes": "Dining and groceries budget"
        }
        res = self.client.post("/api/budgets", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["data"]["category"], "Food")
        self.assertEqual(data["data"]["amount"], 500.0)
        self.assertEqual(data["data"]["month"], 10)
        self.assertEqual(data["data"]["year"], 2026)

    def test_create_budget_invalid_category(self):
        """Invalid category should return 400 error."""
        res = self.client.post("/api/budgets", json={"category": "Spaceships", "amount": 100})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    def test_create_budget_invalid_amount(self):
        """Zero or negative amounts should return 400 error."""
        res = self.client.post("/api/budgets", json={"category": "Food", "amount": 0})
        self.assertEqual(res.status_code, 400)

        res2 = self.client.post("/api/budgets", json={"category": "Food", "amount": -50})
        self.assertEqual(res2.status_code, 400)

    def test_duplicate_budget_prevention(self):
        """Creating duplicate budget for same category and month/year must return 400."""
        payload = {"category": "Transportation", "amount": 250, "month": 10, "year": 2026}
        res1 = self.client.post("/api/budgets", json=payload)
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post("/api/budgets", json=payload)
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already exists", res2.get_json()["error"])

    def test_accurate_spending_calculation(self):
        """Spending must be dynamically aggregated only for approved expense transactions in the period."""
        # Setup budget: $600 for Food in Oct 2026
        self.client.post("/api/budgets", json={"category": "Food", "amount": 600, "month": 10, "year": 2026})

        # Insert transactions
        self._insert_transaction("Food", 120.00, "2026-10-05")  # Counted: 120
        self._insert_transaction("Food", 80.00, "2026-10-15")   # Counted: +80 = 200
        self._insert_transaction("Food", 300.00, "2026-09-20")  # Different month: IGNORED
        self._insert_transaction("Food", 50.00, "2026-10-18", tx_type="income")  # Income: IGNORED
        self._insert_transaction("Food", 90.00, "2026-10-22", status="rejected")  # Rejected: IGNORED
        self._insert_transaction("Bills", 100.00, "2026-10-12")  # Different category: IGNORED

        res = self.client.get("/api/budgets?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        items = res.get_json()["data"]
        self.assertEqual(len(items), 1)

        food_budget = items[0]
        self.assertEqual(food_budget["spent"], 200.00)
        self.assertEqual(food_budget["remaining"], 400.00)
        self.assertEqual(food_budget["percentage_used"], 33.3)
        self.assertEqual(food_budget["status"], "normal")

    def test_threshold_alerts(self):
        """Threshold status should be warning at 80% and exceeded at 100%."""
        # Entertainment: $100 budget
        self.client.post("/api/budgets", json={"category": "Entertainment", "amount": 100, "month": 10, "year": 2026})

        # Under 80% -> normal
        self._insert_transaction("Entertainment", 50.00, "2026-10-02")
        res = self.client.get("/api/budgets?month=10&year=2026")
        self.assertEqual(res.get_json()["data"][0]["status"], "normal")

        # Add $35 -> Total $85 (85%) -> warning
        self._insert_transaction("Entertainment", 35.00, "2026-10-04")
        res = self.client.get("/api/budgets?month=10&year=2026")
        b = res.get_json()["data"][0]
        self.assertEqual(b["status"], "warning")
        self.assertEqual(b["percentage_used"], 85.0)

        # Add $25 -> Total $110 (110%) -> exceeded
        self._insert_transaction("Entertainment", 25.00, "2026-10-06")
        res = self.client.get("/api/budgets?month=10&year=2026")
        b = res.get_json()["data"][0]
        self.assertEqual(b["status"], "exceeded")
        self.assertEqual(b["over_budget"], 10.00)

    def test_budget_summary_endpoint(self):
        """GET /api/budgets/summary should calculate aggregate totals and active alerts."""
        self.client.post("/api/budgets", json={"category": "Rent", "amount": 1200, "month": 10, "year": 2026})
        self.client.post("/api/budgets", json={"category": "Bills", "amount": 300, "month": 10, "year": 2026})

        self._insert_transaction("Rent", 1200.00, "2026-10-01")  # 100% exceeded/at limit
        self._insert_transaction("Bills", 250.00, "2026-10-05")  # 83.3% warning

        res = self.client.get("/api/budgets/summary?month=10&year=2026")
        self.assertEqual(res.status_code, 200)
        summary = res.get_json()

        self.assertEqual(summary["total_budget"], 1500.00)
        self.assertEqual(summary["total_expenses"], 1450.00)
        self.assertEqual(summary["remaining_budget"], 50.00)
        self.assertEqual(summary["category_count"], 2)
        self.assertEqual(len(summary["alerts"]), 2)

    def test_update_and_delete_budget(self):
        """Updating and deleting budget records."""
        create_res = self.client.post("/api/budgets", json={"category": "Travel", "amount": 400, "month": 10, "year": 2026})
        b_id = create_res.get_json()["data"]["id"]

        # Update
        put_res = self.client.put(f"/api/budgets/{b_id}", json={"amount": 750, "notes": "Extended flight"})
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.get_json()["data"]["amount"], 750.0)

        # Retrieve single
        get_res = self.client.get(f"/api/budgets/{b_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.get_json()["data"]["amount"], 750.0)

        # Delete
        del_res = self.client.delete(f"/api/budgets/{b_id}")
        self.assertEqual(del_res.status_code, 200)

        # Verify 404 after deletion
        get_res2 = self.client.get(f"/api/budgets/{b_id}")
        self.assertEqual(get_res2.status_code, 404)

    def test_budget_currency_parameter(self):
        """Verify that passing currency=INR uses ₹ formatting in alert messages."""
        self.client.post("/api/budgets", json={"category": "Food", "amount": 100, "month": 10, "year": 2026})
        self._insert_transaction("Food", 90.00, "2026-10-10")

        # Test with INR
        res_inr = self.client.get("/api/budgets/summary?month=10&year=2026&currency=INR")
        data_inr = res_inr.get_json()
        self.assertEqual(len(data_inr["alerts"]), 1)
        self.assertIn("₹", data_inr["alerts"][0]["message"])

        # Test with USD
        res_usd = self.client.get("/api/budgets/summary?month=10&year=2026&currency=USD")
        data_usd = res_usd.get_json()
        self.assertEqual(len(data_usd["alerts"]), 1)
        self.assertIn("$", data_usd["alerts"][0]["message"])


if __name__ == "__main__":
    unittest.main()
