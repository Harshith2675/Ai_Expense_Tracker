# FinPulse — Application Architecture

## 1. System Overview

FinPulse is an offline-capable, cloud-synchronized personal finance tracking Progressive Web Application (PWA) with Indian Rupee (`₹ INR`) currency support, Row Level Security (RLS) tenancy, and comprehensive financial analytics.

```
┌────────────────────────────────────────────────────────┐
│             FinPulse Client Frontend (PWA)             │
│        (frontend/src/, index.html, Chart.js)           │
└───────────────────┬────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │ Local-First Storage │
         │   (IndexedDB API)   │
         └──────────┬──────────┘
                    │ (Optional Cloud Sync)
                    ▼
┌────────────────────────────────────────────────────────┐
│             Supabase Backend Platform (BaaS)           │
│        PostgreSQL 15+ with Row Level Security (RLS)    │
│        Supabase Auth (JWT, email/password session)     │
└────────────────────────────────────────────────────────┘
```

## 2. Directory Layout & Separation

- **`frontend/`**: Contains the visual application, UI screens (Home, Transactions, AddExpense, Analytics, BudgetOverview, Settings), PWA manifests, Chart.js components, and IndexedDB cache.
- **`backend/`**: Contains validation schemas, server-side financial calculations (Calculator, period trends, budget thresholds), models, and backend unit tests.
- **`database/`**: Canonical migration files (`20261012000000_init_expense_tracker.sql`), seed data, and isolation test scripts.
- **`docs/`**: Architectural documentation, data flow diagrams, and setup guides.
