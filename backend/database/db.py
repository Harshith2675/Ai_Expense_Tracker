"""
database/db.py — SQLite connection utilities for AI Expense Tracker.
Uses integer cents for monetary values to avoid floating-point errors.
"""
import sqlite3
import os
from pathlib import Path


from contextlib import contextmanager


@contextmanager
def get_db_connection(db_path: str):
    """Context manager that opens a SQLite connection with Row factory and always closes it."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def migrate_db(conn: sqlite3.Connection) -> None:
    """Safely apply backward-compatible schema migrations to an existing database."""
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions';")
    if not cur.fetchone():
        return

    cur.execute("PRAGMA table_info(transactions);")
    existing_cols = {col[1] for col in cur.fetchall()}

    new_cols = [
        ("external_id", "TEXT"),
        ("provider", "TEXT"),
        ("review_status", "TEXT NOT NULL DEFAULT 'approved'"),
        ("sync_timestamp", "TEXT"),
        ("is_demo", "INTEGER NOT NULL DEFAULT 0"),
    ]
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            conn.execute(f"ALTER TABLE transactions ADD COLUMN {col_name} {col_type}")

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_ext_id "
        "ON transactions(provider, external_id) WHERE external_id IS NOT NULL"
    )

    # Migrate budgets table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets';")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(budgets);")
        budget_cols = {col[1] for col in cur.fetchall()}

        new_budget_cols = [
            ("period", "TEXT NOT NULL DEFAULT 'monthly'"),
            ("budget_month", "INTEGER"),
            ("budget_year", "INTEGER"),
            ("month", "INTEGER"),
            ("year", "INTEGER"),
            ("notes", "TEXT"),
            ("created_at", "TEXT NOT NULL DEFAULT (datetime('now'))"),
            ("updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))"),
        ]
        for col_name, col_type in new_budget_cols:
            if col_name not in budget_cols:
                conn.execute(f"ALTER TABLE budgets ADD COLUMN {col_name} {col_type}")

        # Synchronize month/budget_month and year/budget_year if legacy columns exist
        conn.execute("""
            UPDATE budgets
            SET budget_month = month
            WHERE budget_month IS NULL AND month IS NOT NULL
        """)
        conn.execute("""
            UPDATE budgets
            SET budget_year = year
            WHERE budget_year IS NULL AND year IS NOT NULL
        """)
        conn.execute("""
            UPDATE budgets
            SET month = budget_month
            WHERE month IS NULL AND budget_month IS NOT NULL
        """)
        conn.execute("""
            UPDATE budgets
            SET year = budget_year
            WHERE year IS NULL AND budget_year IS NOT NULL
        """)

        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_cat_year_month "
            "ON budgets(category, budget_year, budget_month)"
        )

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sync_history (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            provider              TEXT NOT NULL,
            sync_mode             TEXT NOT NULL,
            status                TEXT NOT NULL,
            transactions_found    INTEGER NOT NULL DEFAULT 0,
            transactions_imported INTEGER NOT NULL DEFAULT 0,
            transactions_pending  INTEGER NOT NULL DEFAULT 0,
            error_message         TEXT,
            timestamp             TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS dismissed_anomalies (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id  INTEGER NOT NULL UNIQUE,
            dismissed_at    TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
        )
    """)

    conn.commit()


def init_db(db_path: str, schema_path: str | None = None) -> None:
    """Initialise (or migrate) the database from schema.sql."""
    if schema_path is None:
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")

    with get_db_connection(db_path) as conn:
        # If database already has tables, migrate columns first
        migrate_db(conn)
        with open(schema_path, "r", encoding="utf-8") as fh:
            conn.executescript(fh.read())
        migrate_db(conn)
    print(f"[DB] Initialised & Migrated → {db_path}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def dollars_to_cents(amount_dollars: float) -> int:
    """Convert a dollar float to integer cents, rounding half-up."""
    return round(float(amount_dollars) * 100)


def cents_to_dollars(amount_cents: int) -> float:
    """Convert integer cents back to a dollar float."""
    return round(int(amount_cents) / 100, 2)


def row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a plain dict."""
    return dict(row)


if __name__ == "__main__":
    default_db = os.path.join(
        os.path.dirname(__file__), "..", "instance", "expense_tracker.sqlite"
    )
    init_db(default_db)
