# FinPulse — Backend Architecture & Services

This directory manages backend logic, service validation, database interaction models, and tests for the FinPulse Expense Tracker application.

## Directory Layout

```
backend/
├── src/
│   ├── config/          # Environment configuration & database connection helpers
│   ├── controllers/     # API request handling abstractions
│   ├── services/        # Financial business logic (Calculator, Period Analytics)
│   ├── repositories/    # Data persistence abstractions (Supabase client & local DB)
│   ├── routes/          # Route and endpoint declarations
│   ├── middleware/      # Auth verification & sanitization middleware
│   ├── validators/      # Transaction and budget schema validators
│   ├── models/          # Data schemas and category definitions
│   └── utils/           # CSV sanitizers and date utilities
├── tests/               # Backend automated test suite (test_backend.js)
├── package.json         # Backend scripts and test runners
└── README.md
```

## Backend Services

1. **Validation (`src/validators/index.js`)**:
   - Zero, negative, and extreme amount prevention.
   - Date range validation (2000–2099).
   - SQL and CSV formula injection sanitization.

2. **Calculations (`src/services/calculator.js`)**:
   - Income, Expense, Net Savings, Balance calculations.
   - Period-specific aggregations: Monthly, 3-Month, and 12-Month Yearly trends.
   - Budget status thresholds (<75% Within Budget, 75%-99.9% Near Limit, >=100% Over Budget).

3. **Supabase Integration (`src/repositories/supabase.js`)**:
   - Authenticated client connection via `@supabase/supabase-js`.
   - User-scoped queries leveraging PostgreSQL Row Level Security (RLS).
