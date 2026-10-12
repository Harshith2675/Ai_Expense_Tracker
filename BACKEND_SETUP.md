# FinPulse — Supabase Backend & Database Setup Guide

This guide details the complete PostgreSQL database schema, Supabase authentication, Row Level Security (RLS) policies, and API integration for the **FinPulse Expense Tracker** mobile application.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│             FinPulse Mobile Frontend (PWA)             │
│        (index.html, js/ui.js, js/services.js)          │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│               Supabase JS SDK (v2 UMD)                 │
│         (js/config.js, js/supabase-client.js)          │
└─────────┬────────────────────────────────────┬─────────┘
          │                                    │
          ▼                                    ▼
┌───────────────────────┐            ┌───────────────────┐
│     Supabase Auth     │            │  PostgreSQL (RLS) │
│ (Email/Password, JWT) │            │   (Tables & RPC)  │
└───────────────────────┘            └───────────────────┘
```

---

## 2. Supabase Project Setup Instructions

### Step 1: Create a Supabase Project
1. Log in to [Supabase](https://supabase.com).
2. Click **New project**, select an organization, name your project (e.g. `finpulse-backend`), and choose your region (e.g. `South Asia (Mumbai)`).
3. Set a strong database password and click **Create new project**.

### Step 2: Apply Database Migration
1. In your Supabase dashboard, go to the **SQL Editor** on the left navigation bar.
2. Open the file [`supabase/migrations/20261012000000_init_expense_tracker.sql`](./supabase/migrations/20261012000000_init_expense_tracker.sql).
3. Paste the entire SQL script into the editor and click **Run**.
4. The migration will create:
   - `profiles`: user profile linked to `auth.users(id)`
   - `categories`: pre-seeded default categories with icons and colors
   - `transactions`: monetary records with positive numeric checks and indexing
   - `budgets`: period spending limits with date constraints
   - `user_settings`: currency, theme, and notification preferences
   - `handle_new_user()` trigger on `auth.users`: automatically seeds categories and profile upon signup
   - Full Row Level Security (RLS) policies isolating user data
   - Optimized stored procedures (`get_dashboard_summary`, `get_analytics_summary`)

### Step 3: Run RLS & Isolation Verification Script
1. In the Supabase SQL Editor, open [`supabase/tests/rls_and_isolation_test.sql`](./supabase/tests/rls_and_isolation_test.sql).
2. Click **Run** to execute the multi-user isolation simulation.
3. Verify that all 4 tests pass with `ALL 4 RLS & CONSTRAINT TESTS PASSED SUCCESSFULLY!`.

---

## 3. Connecting the App to Supabase

### Option A: Direct In-App Setup (Zero Build Required)
1. Open the running app at **[http://localhost:8787](http://localhost:8787)**.
2. Navigate to **Settings** → **Cloud Sync & Account** → click **Configure**.
3. Enter your **Project URL** (e.g. `https://xyz.supabase.co`) and **Publishable Anon Key**.
4. Click **Save & Connect**. The app will immediately initialize and allow you to Sign In or Create an Account!

### Option B: Pre-configured via `.env`
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 4. Running Backend Tests Locally

Run the automated backend test suite with Node:
```bash
node tests/test_backend.js
```

This verifies:
- Transaction amounts, positive checks, and title bounds
- Date validity (2000–2099)
- Budget limit validation and month bounds
- Financial calculations (Total balance, monthly income, expenses, net savings)
- Budget usage percentages and warning badges
- Category breakdown and sorting
- CSV formula injection sanitization (`=`, `+`, `-`, `@`)
- Supabase credentials storage & detection

---

## 5. Security & Row Level Security (RLS) Summary

- **User Isolation:** All tables (`profiles`, `categories`, `transactions`, `budgets`, `user_settings`) enforce Row Level Security.
- **Client Privilege:** The frontend only uses the public anonymous key (`anon`). The `service_role` secret is never exposed.
- **Ownership Verification:** When inserting transactions or budgets, the policy checks `auth.uid() = user_id` and ensures referenced `category_id` belongs to the user or is public.
- **Formula Injection Mitigation:** CSV exports automatically sanitize cells beginning with formula prefixes (`=`, `+`, `-`, `@`).
