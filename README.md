# FinPulse — Modern Expense Tracker & Financial Analytics

FinPulse is a personal expense tracker and financial analytics application featuring a modern emerald green dashboard, Indian Rupee (`₹ INR`) currency formatting, multi-month spending analytics, and cloud sync via Supabase.

## Repository Architecture

```
expense-tracker/
├── frontend/             # Client-side PWA, UI components, themes, Chart.js analytics
│   ├── public/           # PWA manifests, icons, service worker
│   ├── src/              # Application components, screens, services, theme
│   ├── package.json      # Frontend scripts
│   └── README.md
│
├── backend/              # Financial business logic, validation, models, tests
│   ├── src/              # Calculator services, validators, category models, CSV utilities
│   ├── tests/            # Automated test suite (test_backend.js)
│   ├── package.json      # Backend scripts
│   └── README.md
│
├── database/             # Canonical PostgreSQL schema & migrations
│   ├── migrations/       # SQL migrations (RLS, tables, triggers)
│   ├── seeds/            # Verification & seed scripts
│   └── README.md
│
├── docs/                 # Documentation
│   ├── architecture.md   # Architectural blueprint
│   ├── data-flow.md      # Data pipeline and calculation docs
│   └── setup.md          # Setup and configuration guide
│
├── .env.example          # Environment variable template
├── package.json          # Root monorepo workspace configuration
└── README.md
```

## Quick Start

```bash
# 1. Start the application
npm run dev

# 2. Run backend test suite
npm test
```

Application URL: **`http://localhost:8787`**

## Key Features

- **6 Summary Dashboard Cards**: Total Budget, Total Spent, Remaining Budget, Budget Utilization %, Total Income, Total Savings.
- **3 Analysis Periods**:
  - *This Month*: Daily spending trend (1..31) with daily average reference line.
  - *Last 3 Months*: 3 consecutive calendar months compared (Income vs Expenses) with MoM changes.
  - *This Year*: Jan–Dec 12-month series with monthly average line and peak/lowest months identified.
- **Category Deep Dive**: Sort by Highest Spending, Lowest Spending, Largest % Increase, Most Transactions. Click any category for transaction drill-down.
- **Budget Thresholds**: `<75%` (Within Budget), `75%-99.9%` (Near Limit), `>=100%` (Over Budget).
- **Deterministic Demo Mode**: 1-click load and clean removal without mixing with real financial records.
