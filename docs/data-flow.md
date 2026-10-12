# FinPulse — Data Flow Documentation

## 1. End-to-End Data Pipeline

```
User Input (Form / Filter / Demo Mode)
    │
    ▼
Input Validation (frontend/src/services/Validator + backend/src/validators)
    │  - Amount > 0 and numeric
    │  - Title non-empty (<100 chars)
    │  - Valid ISO Date (2000-2099)
    │  - CSV formula injection sanitization
    ▼
Storage Layer
    ├── Local Storage: IndexedDB (`finpulse_db` v2)
    └── Cloud Sync (if connected): Supabase PostgreSQL with RLS
    │
    ▼
Financial Aggregation Engine (Calculator)
    ├── Total Income, Expenses, Balance, Net Savings
    ├── Budget Utilization % & Status (<75% Within, 75-99% Near, >=100% Over)
    ├── Period Trends:
    │     - Monthly: Daily expenses (1..31) + Daily Average
    │     - 3-Month: 3 consecutive months comparison (MoM %)
    │     - Yearly: Jan–Dec 12 months + Monthly Average
    └── Category Deep Dive (% share, count, avg amount, MoM change)
    │
    ▼
UI Rendering (ScreenRenderer + Chart.js)
    ├── 6 Summary Dashboard Cards
    ├── Donut Breakdown Chart (with center text 'TOTAL SPENT')
    ├── Spending Trend Line/Bar Charts
    └── Category Drill-Down Transaction Modal
```

## 2. Demo Mode Isolation

- Generated demo records are explicitly marked with `isDemo: true`.
- Seeded deterministically across 12 categories and 12 months.
- Isolated from real user transactions.
- Easily cleared in one click without altering real user financial history.
