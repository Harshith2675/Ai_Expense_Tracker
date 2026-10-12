# FinPulse — Setup and Execution Guide

## 1. Quick Start

FinPulse works out of the box with zero compilation or build steps.

### Prerequisites
- Node.js (v18+)

### Running Locally

```bash
# From root directory:
npm run dev

# Or with npm workspaces:
npm --prefix frontend run dev
```

Open your browser at:
👉 **`http://localhost:8787`**

## 2. Running Automated Tests

```bash
# Run backend test suite:
npm test

# Or directly:
node backend/tests/test_backend.js
```

All 14 backend test cases validate:
- Zero and negative transaction rejection
- Date range boundary enforcement
- ₹34,500 category budget summation
- Budget status thresholds (<75%, 75-99.9%, >=100%)
- 3-Month consecutive calendar month filtering & MoM change
- 12-Month yearly aggregation
- Demo data isolation and generation
- CSV formula injection sanitization

## 3. Connecting to Supabase Cloud

1. Log into your Supabase Dashboard.
2. Apply the migration script: `database/migrations/20261012000000_init_expense_tracker.sql`.
3. In the FinPulse app, navigate to **Settings** -> **Supabase Configuration**.
4. Enter your `Project URL` and `Anon Publishable Key`.
