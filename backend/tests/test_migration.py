"""
tests/test_migration.py — Unit tests for safe SQLite-to-PostgreSQL migration
"""
import unittest
import tempfile
import os
import hashlib
from database.db import init_db, get_db_connection
from database.migrate_to_postgres import generate_postgres_dump, extract_sqlite_data, _compute_checksum


class TestMigrationTool(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".sqlite")
        init_db(self.db_path)

        # Seed sample record
        with get_db_connection(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO transactions (
                    user_id, transaction_type, category, description,
                    payment_method, amount_cents, transaction_date
                ) VALUES (1, 'expense', 'Food', 'Dinner out', 'Credit Card', 4500, '2026-10-24')
                """
            )
            conn.commit()

        self.initial_hash = _compute_checksum(self.db_path)

    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_sqlite_data_extraction_and_immutability(self):
        data = extract_sqlite_data(self.db_path)
        self.assertIn("users", data)
        self.assertIn("transactions", data)
        self.assertGreaterEqual(len(data["transactions"]["rows"]), 1)

        # Confirm file checksum remained strictly identical
        post_hash = _compute_checksum(self.db_path)
        self.assertEqual(self.initial_hash, post_hash, "Local database was modified during extraction!")

    def test_postgres_dump_generation(self):
        dump_sql = generate_postgres_dump(self.db_path)
        self.assertIn("CREATE TABLE IF NOT EXISTS transactions", dump_sql)
        self.assertIn("INSERT INTO transactions", dump_sql)
        self.assertIn("Dinner out", dump_sql)
        self.assertIn("setval(pg_get_serial_sequence('transactions', 'id')", dump_sql)

        # Confirm file checksum remained strictly identical after dump generation
        post_hash = _compute_checksum(self.db_path)
        self.assertEqual(self.initial_hash, post_hash, "Local database was modified during dump generation!")


if __name__ == "__main__":
    unittest.main()
