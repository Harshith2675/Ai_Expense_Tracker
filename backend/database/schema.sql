-- AI Expense Tracker — SQLite Schema v2
-- Transactions table uses INTEGER cents to avoid floating-point errors.
-- amount_cents = round(amount_dollars * 100)  e.g. $12.50 → 1250

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------ users
CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL DEFAULT 'Default User',
    email        TEXT    UNIQUE NOT NULL DEFAULT 'user@example.com',
    currency     TEXT    NOT NULL DEFAULT 'USD',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed a default user so all transactions have a valid user_id
INSERT OR IGNORE INTO users (id, name, email, currency)
VALUES (1, 'Default User', 'user@example.com', 'USD');

-- ------------------------------------------------------------------ transactions
-- transaction_type : 'expense' | 'income'
-- detection_method : 'manual'  (only value created by forms; 'automatic' reserved for future)
-- amount_cents     : whole integer — dollars * 100, never NULL
CREATE TABLE IF NOT EXISTS transactions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL DEFAULT 1,
    transaction_type  TEXT    NOT NULL CHECK(transaction_type IN ('expense', 'income')),
    category          TEXT    NOT NULL,
    description       TEXT    NOT NULL,
    payment_method    TEXT    NOT NULL DEFAULT 'Other'
                              CHECK(payment_method IN ('Cash','UPI','Debit Card','Credit Card','Bank Transfer','Other')),
    amount_cents      INTEGER NOT NULL CHECK(amount_cents > 0),
    transaction_date  TEXT    NOT NULL,   -- ISO 8601 date e.g. '2026-10-23'
    notes             TEXT,
    detection_method  TEXT    NOT NULL DEFAULT 'manual'
                              CHECK(detection_method IN ('manual','automatic')),
    external_id       TEXT,
    provider          TEXT,
    review_status     TEXT    NOT NULL DEFAULT 'approved'
                              CHECK(review_status IN ('approved', 'pending_review', 'rejected')),
    sync_timestamp    TEXT,
    is_demo           INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_ext_id
ON transactions(provider, external_id) WHERE external_id IS NOT NULL;

-- ------------------------------------------------------------------ sync_history
CREATE TABLE IF NOT EXISTS sync_history (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    provider              TEXT    NOT NULL,
    sync_mode             TEXT    NOT NULL,
    status                TEXT    NOT NULL,
    transactions_found    INTEGER NOT NULL DEFAULT 0,
    transactions_imported INTEGER NOT NULL DEFAULT 0,
    transactions_pending  INTEGER NOT NULL DEFAULT 0,
    error_message         TEXT,
    timestamp             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------ budgets
CREATE TABLE IF NOT EXISTS budgets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category      TEXT    NOT NULL,
    amount_cents  INTEGER NOT NULL CHECK(amount_cents > 0),
    period        TEXT    NOT NULL DEFAULT 'monthly',
    budget_month  INTEGER NOT NULL CHECK(budget_month BETWEEN 1 AND 12),
    budget_year   INTEGER NOT NULL,
    month         INTEGER, -- backward compatibility
    year          INTEGER, -- backward compatibility
    notes         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category, budget_year, budget_month)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_cat_year_month
ON budgets(category, budget_year, budget_month);

-- ------------------------------------------------------------------ ai_insights (scaffold only)
CREATE TABLE IF NOT EXISTS ai_insights (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL DEFAULT 1,
    title           TEXT    NOT NULL,
    summary         TEXT    NOT NULL,
    insight_type    TEXT    NOT NULL CHECK(insight_type IN ('tip','alert','anomaly','prediction')),
    confidence_score REAL,
    is_dismissed    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------ dismissed_anomalies
CREATE TABLE IF NOT EXISTS dismissed_anomalies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id  INTEGER NOT NULL UNIQUE,
    dismissed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
