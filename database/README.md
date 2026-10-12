# FinPulse Database Architecture & Migrations

This folder contains the database schema migrations, seed data, and isolation test scripts for FinPulse.

## Directory Layout

```
database/
├── migrations/
│   └── 20261012000000_init_expense_tracker.sql  # Canonical PostgreSQL schema migration
├── seeds/
│   └── rls_and_isolation_test.sql               # Multi-user data verification & seed script
└── README.md
```

## Schema Highlights

- **`profiles`**: Linked directly to `auth.users(id)` via Foreign Key with cascading delete.
- **`categories`**: Standardized 12 financial categories with icons, colors, and type constraints.
- **`transactions`**: High-precision monetary transaction logs (`NUMERIC(14,2)`), indexed by user, date, category, and type.
- **`budgets`**: Monthly and periodic category limits with duplicate prevention and validation checks.
- **`user_settings`**: User-specific preferences (currency, theme, budget limits).
- **Row Level Security (RLS)**: Enforces `auth.uid() = user_id` across all tables, ensuring strict data tenancy.
- **Database Functions**:
  - `handle_new_user()`: Automated trigger to populate initial user profile and settings upon signup.
  - `get_dashboard_summary()`: Server-side aggregation for income, expenses, and savings.
  - `get_analytics_summary()`: Period-aware category breakdown calculation.

## How to Apply

1. Copy the contents of `database/migrations/20261012000000_init_expense_tracker.sql`.
2. Run in the Supabase SQL Editor.
3. Validate using `database/seeds/rls_and_isolation_test.sql`.
