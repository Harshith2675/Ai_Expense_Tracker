"""
database/migrate_to_postgres.py — Safe SQLite to PostgreSQL Migration Tool

Exports all schemas and records from local SQLite to PostgreSQL DDL/DML,
or directly executes migration against a PostgreSQL DATABASE_URL.

Guarantees:
1. Opens the local SQLite database in strict READ-ONLY mode.
2. NEVER drops, modifies, or deletes the local SQLite database.
3. Preserves all tables, column types, integer cents monetary amounts, and IDs.
4. Resets PostgreSQL serial sequences so new inserts never collide with migrated IDs.
"""

import os
import sys
import sqlite3
import argparse
import hashlib
from pathlib import Path


TABLES = [
    "users",
    "transactions",
    "sync_history",
    "budgets",
    "ai_insights",
    "dismissed_anomalies",
]


POSTGRES_SCHEMA = """-- AI Expense Tracker: PostgreSQL Production Schema
-- Safe migration dump generated from SQLite without modifying local database.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL DEFAULT 'Default User',
    email        TEXT UNIQUE NOT NULL DEFAULT 'user@example.com',
    currency     TEXT NOT NULL DEFAULT 'USD',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    transaction_type  TEXT NOT NULL CHECK(transaction_type IN ('expense', 'income')),
    category          TEXT NOT NULL,
    description       TEXT NOT NULL,
    payment_method    TEXT NOT NULL DEFAULT 'Other' CHECK(payment_method IN ('Cash','UPI','Debit Card','Credit Card','Bank Transfer','Other')),
    amount_cents      INTEGER NOT NULL CHECK(amount_cents > 0),
    transaction_date  TEXT NOT NULL,
    notes             TEXT,
    detection_method  TEXT NOT NULL DEFAULT 'manual' CHECK(detection_method IN ('manual','automatic')),
    external_id       TEXT,
    provider          TEXT,
    review_status     TEXT NOT NULL DEFAULT 'approved' CHECK(review_status IN ('approved', 'pending_review', 'rejected')),
    sync_timestamp    TEXT,
    is_demo           INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_ext_id
ON transactions(provider, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_history (
    id                    SERIAL PRIMARY KEY,
    provider              TEXT NOT NULL,
    sync_mode             TEXT NOT NULL,
    status                TEXT NOT NULL,
    transactions_found    INTEGER NOT NULL DEFAULT 0,
    transactions_imported INTEGER NOT NULL DEFAULT 0,
    transactions_pending  INTEGER NOT NULL DEFAULT 0,
    error_message         TEXT,
    timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
    id            SERIAL PRIMARY KEY,
    category      TEXT NOT NULL,
    amount_cents  INTEGER NOT NULL CHECK(amount_cents > 0),
    period        TEXT NOT NULL DEFAULT 'monthly',
    budget_month  INTEGER NOT NULL CHECK(budget_month BETWEEN 1 AND 12),
    budget_year   INTEGER NOT NULL,
    month         INTEGER,
    year          INTEGER,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, budget_year, budget_month)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_cat_year_month
ON budgets(category, budget_year, budget_month);

CREATE TABLE IF NOT EXISTS ai_insights (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL,
    insight_type    TEXT NOT NULL CHECK(insight_type IN ('tip','alert','anomaly','prediction')),
    confidence_score DOUBLE PRECISION,
    is_dismissed    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dismissed_anomalies (
    id              SERIAL PRIMARY KEY,
    transaction_id  INTEGER NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _compute_checksum(filepath: str) -> str:
    """Compute sha256 checksum of a file to ensure immutability."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def _format_sql_value(val) -> str:
    """Format Python/SQLite values for PostgreSQL SQL literal string."""
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    # String escaping
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def extract_sqlite_data(sqlite_path: str):
    """
    Connects to SQLite in read-only mode and extracts table schemas and rows.
    Returns: dict of {table_name: {"columns": [...], "rows": [...]}}
    """
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite database file not found at: {sqlite_path}")

    # Connect strictly in read-only mode
    uri_path = f"file:{os.path.abspath(sqlite_path)}?mode=ro"
    conn = sqlite3.connect(uri_path, uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    data = {}
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        existing_tables = {row[0] for row in cursor.fetchall()}

        for table in TABLES:
            if table not in existing_tables:
                continue
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [col[1] for col in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {table} ORDER BY id ASC;")
            rows = [list(row) for row in cursor.fetchall()]
            data[table] = {
                "columns": columns,
                "rows": rows,
            }
    finally:
        conn.close()

    return data


def generate_postgres_dump(sqlite_path: str, output_path: str | None = None) -> str:
    """
    Generates a PostgreSQL-compatible SQL dump from SQLite.
    Guarantees that the source SQLite database is untouched.
    """
    initial_checksum = _compute_checksum(sqlite_path)
    extracted = extract_sqlite_data(sqlite_path)

    statements = [POSTGRES_SCHEMA]

    for table in TABLES:
        if table not in extracted or not extracted[table]["rows"]:
            continue
        cols = extracted[table]["columns"]
        rows = extracted[table]["rows"]
        col_list = ", ".join(cols)

        statements.append(f"\n-- Data for {table} ({len(rows)} records)")
        for row in rows:
            val_list = ", ".join(_format_sql_value(v) for v in row)
            statements.append(
                f"INSERT INTO {table} ({col_list}) VALUES ({val_list}) "
                f"ON CONFLICT DO NOTHING;"
            )

    # Reset sequences for auto-incrementing serial IDs
    statements.append("\n-- Synchronize primary key sequences")
    for table in TABLES:
        if table in extracted:
            statements.append(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1), "
                f"(SELECT COUNT(*) > 0 FROM {table}));"
            )

    statements.append("\nCOMMIT;\n")

    sql_output = "\n".join(statements)

    # Verify SQLite file was not altered
    post_checksum = _compute_checksum(sqlite_path)
    if initial_checksum != post_checksum:
        raise RuntimeError("FATAL: Source SQLite database was modified during extraction!")

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(sql_output)
        print(f"[OK] Generated PostgreSQL migration dump → {output_path}")

    return sql_output


def direct_migrate_to_postgres(sqlite_path: str, postgres_url: str):
    """
    Directly applies the migration to a target PostgreSQL database via psycopg2.
    """
    try:
        import psycopg2
    except ImportError:
        raise ImportError(
            "psycopg2 is required for direct PostgreSQL migration. "
            "Install with: pip install psycopg2-binary"
        )

    initial_checksum = _compute_checksum(sqlite_path)
    dump_sql = generate_postgres_dump(sqlite_path)

    print(f"[INFO] Connecting to target PostgreSQL instance...")
    conn = psycopg2.connect(postgres_url)
    try:
        with conn.cursor() as cur:
            cur.execute(dump_sql)
        conn.commit()
        print("[OK] PostgreSQL schema and records successfully migrated.")
    finally:
        conn.close()

    # Re-verify local file safety
    post_checksum = _compute_checksum(sqlite_path)
    if initial_checksum != post_checksum:
        raise RuntimeError("FATAL: Source SQLite database was modified during direct migration!")

    print("[OK] Verification passed: local SQLite database remains unchanged.")


def main():
    parser = argparse.ArgumentParser(description="Safely migrate SQLite database to PostgreSQL.")
    parser.add_argument(
        "--sqlite",
        default=os.getenv("DATABASE_PATH", "instance/expense_tracker.sqlite"),
        help="Path to source SQLite database file",
    )
    parser.add_argument(
        "--output",
        default="postgres_dump.sql",
        help="Path to output PostgreSQL SQL dump file",
    )
    parser.add_argument(
        "--target-url",
        default=os.getenv("DATABASE_URL"),
        help="Optional PostgreSQL connection URL (e.g., postgresql://user:pass@host/dbname)",
    )
    args = parser.parse_args()

    sqlite_path = os.path.abspath(args.sqlite)
    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database not found at {sqlite_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] Source SQLite: {sqlite_path}")
    generate_postgres_dump(sqlite_path, args.output)

    if args.target_url:
        direct_migrate_to_postgres(sqlite_path, args.target_url)


if __name__ == "__main__":
    main()
