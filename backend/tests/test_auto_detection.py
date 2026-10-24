"""
tests/test_auto_detection.py — Unit and integration tests for Automatic Expense Detection.
Tests idempotency, provider adapters, pending review workflow, and ledger updates.
"""
import unittest
import os
import tempfile
import sqlite3
from app import create_app
from database.db import init_db
from config import Config


class TestConfig(Config):
    TESTING = True
    DEBUG = False


class AutoDetectionTestCase(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".sqlite")
        init_db(self.db_path)

        class CustomConfig(TestConfig):
            DATABASE_PATH = self.db_path

        self.app = create_app(CustomConfig)
        self.client = self.app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def test_status_endpoint(self):
        """Test GET /api/automatic-detection/status returns active provider status."""
        res = self.client.get("/api/automatic-detection/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("provider_id", data)
        self.assertIn("mode", data)
        self.assertIn("detected_count", data)
        self.assertIn("pending_count", data)
        self.assertIn("supported_providers", data)
        self.assertTrue(data.get("is_demo"))

    def test_sync_idempotency_and_pending_review(self):
        """Test sync imports transactions, handles pending review, and avoids duplicate imports."""
        # First sync
        res1 = self.client.post("/api/automatic-detection/sync", json={"mode": "demo"})
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()
        self.assertTrue(data1.get("success"))
        summary1 = data1.get("summary", {})
        self.assertGreater(summary1.get("imported_approved", 0), 0)
        self.assertGreater(summary1.get("imported_pending_review", 0), 0)
        self.assertEqual(summary1.get("duplicates_skipped", 0), 0)

        # Second sync with same provider feed: should be completely idempotent (0 new, all duplicates skipped)
        res2 = self.client.post("/api/automatic-detection/sync", json={"mode": "demo"})
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        summary2 = data2.get("summary", {})
        self.assertEqual(summary2.get("imported_approved", 0), 0)
        self.assertEqual(summary2.get("imported_pending_review", 0), 0)
        self.assertGreater(summary2.get("duplicates_skipped", 0), 0)

    def test_pending_review_and_approval_flow(self):
        """Test reviewing, updating category, and approving a pending transaction."""
        # Run sync first
        self.client.post("/api/automatic-detection/sync", json={"mode": "demo"})

        # Fetch pending list
        res_pending = self.client.get("/api/automatic-detection/pending")
        self.assertEqual(res_pending.status_code, 200)
        pending_list = res_pending.get_json().get("data", [])
        self.assertGreater(len(pending_list), 0)

        target = pending_list[0]
        tx_id = target["id"]

        # Approve and update category to Education
        res_review = self.client.post(
            f"/api/automatic-detection/review/{tx_id}",
            json={
                "action": "approve",
                "category": "Education",
                "transaction_type": "expense",
                "notes": "Verified course subscription"
            }
        )
        self.assertEqual(res_review.status_code, 200)
        review_data = res_review.get_json()
        self.assertTrue(review_data.get("success"))
        self.assertEqual(review_data.get("action"), "approved")
        self.assertEqual(review_data.get("transaction", {}).get("category"), "Education")

        # Verify transaction now appears in main transactions list with approved status
        res_tx = self.client.get(f"/api/transactions/{tx_id}")
        self.assertEqual(res_tx.status_code, 200)
        tx_data = res_tx.get_json()
        self.assertEqual(tx_data.get("review_status"), "approved")
        self.assertEqual(tx_data.get("category"), "Education")
        self.assertEqual(tx_data.get("detection_method"), "automatic")

    def test_review_rejection_flow(self):
        """Test rejecting a pending transaction."""
        self.client.post("/api/automatic-detection/sync", json={"mode": "demo"})
        res_pending = self.client.get("/api/automatic-detection/pending")
        pending_list = res_pending.get_json().get("data", [])
        self.assertGreater(len(pending_list), 0)

        tx_id = pending_list[0]["id"]
        res_reject = self.client.post(
            f"/api/automatic-detection/review/{tx_id}",
            json={"action": "reject"}
        )
        self.assertEqual(res_reject.status_code, 200)
        data = res_reject.get_json()
        self.assertEqual(data.get("action"), "rejected")

        # Rejected item should no longer be pending
        res_pending_after = self.client.get("/api/automatic-detection/pending")
        ids_after = [t["id"] for t in res_pending_after.get_json().get("data", [])]
        self.assertNotIn(tx_id, ids_after)

    def test_disconnected_mode(self):
        """Test that disconnected mode cleanly rejects sync and does not create transactions."""
        res = self.client.post("/api/automatic-detection/sync", json={"mode": "disconnected"})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("disconnected", data.get("error", "").lower())

    def test_sync_history_endpoint(self):
        """Test audit trail recording in GET /api/automatic-detection/history."""
        self.client.post("/api/automatic-detection/sync", json={"mode": "demo"})
        res = self.client.get("/api/automatic-detection/history")
        self.assertEqual(res.status_code, 200)
        history = res.get_json().get("history", [])
        self.assertGreater(len(history), 0)
        self.assertEqual(history[0].get("provider"), "demo_bank")


if __name__ == "__main__":
    unittest.main()
