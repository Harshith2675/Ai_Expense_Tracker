# AI Expense Tracker — Financial Dashboard & Analytics

A modern, responsive, fintech web application built with **React (Vite)**, **Vanilla CSS**, **Chart.js**, and a scaffolded **Python Flask REST API** backed by **SQLite** and prepared for future AI/ML integration with **Pandas** & **Scikit-learn**.

---

## 🌟 Key Features

### 1. Financial Dashboard UI
- **Summary Cards**: Real-time totals for **Total Income**, **Total Expenses**, **Available Balance**, and **Monthly Budget Usage** with trend percentages and dynamic progress indicators.
- **Visual Analytics with Chart.js**:
  - *Income vs. Expenses*: Comparative 6-month dual-bar chart with rounded bars.
  - *Category Breakdown*: Interactive doughnut chart with percentage allocations.
  - *Monthly Spending Trend*: Smooth cubic-bezier line chart with target baseline.
  - *Budget Allocation Progress*: Category-level consumption meters with limit alerts.
- **Unified Transaction Ledger**:
  - Filterable by type (*Income*, *Expense*, *Automatic*, *Manual*) and search query.
  - Clearly tagged detection method badges (**Automatic** vs. **Manual**).
  - Ability to delete or record transactions with dynamic recalculation of summary cards.
- **Interactive Modals with Smart AI Category Suggestions**:
  - *Add Expense Modal*: Real-time NLP heuristic suggestion chip as you type (e.g. typing `"Uber"` auto-suggests `"Transportation"` with a confidence score).
  - *Add Income Modal*: Rapidly record salary, freelance retainers, or dividend payouts.
- **Multiple Dedicated Views**:
  - 📊 **Dashboard**: Core high-level financial health hub.
  - 📜 **Transaction History**: Comprehensive ledger with CSV export capabilities.
  - ⚡ **Automatic Detection**: Rule-based pattern matching and ingestion architecture preview.
  - 🎯 **Budget Management**: Category sliders with instant variance calculations.
  - 🧠 **AI Insights**: Machine learning playground and structured predictive alerts.
  - 📑 **Financial Reports**: Executive breakdown, net cash flow, and print-ready summary.
  - ⚙️ **Settings**: Dark/Light mode toggle, regional currency selector, and live Flask API connectivity tester.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Lucide React (Fintech icons) |
| **Styling** | Vanilla CSS (CSS variables, Dark/Light modes, Glassmorphism, Responsive Grid) |
| **Data Visualization** | Chart.js 4, react-chartjs-2 5 |
| **Backend** | Python 3, Flask 3, Flask-CORS, python-dotenv |
| **Database** | SQLite (Schema prepared with foreign keys and migrations) |
| **AI / ML** | Heuristic NLP classifier prepared for Scikit-learn & Pandas models |

---

## 📁 Project Structure

```text
ai-expense-tracker/
├── frontend/                     # React + Vite Web Client
│   ├── public/                   # Static assets & icons
│   ├── src/
│   │   ├── components/
│   │   │   ├── Modals/           # AddExpenseModal, AddIncomeModal
│   │   │   ├── Views/            # DashboardView, TransactionsView, BudgetView, etc.
│   │   │   ├── AnalyticsCharts.jsx # Chart.js integrations
│   │   │   ├── QuickActions.jsx  # Action buttons & AI widget
│   │   │   ├── RecentTransactions.jsx # Transaction ledger table
│   │   │   ├── Sidebar.jsx       # Navigation drawer with badges
│   │   │   ├── SummaryCards.jsx  # KPI summary metrics
│   │   │   └── Topbar.jsx        # Search, theme toggle, notifications
│   │   ├── data/
│   │   │   └── sampleData.js     # Clearly labeled demo data
│   │   ├── services/
│   │   │   └── apiService.js     # API client for Flask with offline fallback
│   │   ├── App.css               # Comprehensive fintech UI styling
│   │   ├── App.jsx               # Root application shell
│   │   ├── index.css             # Design tokens, variables & reset
│   │   └── main.jsx              # React entry point
│   ├── package.json
│   └── vite.config.js
│
├── backend/                      # Python Flask REST API
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py             # REST endpoints (/health, /summary, /transactions, /categories, /ai/predict-category)
│   ├── database/
│   │   ├── __init__.py
│   │   ├── db.py                 # SQLite connection helper & schema builder
│   │   └── schema.sql            # SQLite schema (users, categories, budgets, transactions, insights)
│   ├── instance/
│   │   └── expense_tracker.sqlite# SQLite database file
│   ├── ml/
│   │   ├── __init__.py
│   │   └── predictor.py          # AI service stub for Pandas and Scikit-learn
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_api.py           # Unit tests for API endpoints
│   ├── .env.example
│   ├── app.py                    # Flask application factory
│   ├── config.py                 # Configuration settings
│   └── requirements.txt          # Python package requirements
│
└── README.md
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js** (v18+ recommended, verified on v24) & **npm**
- **Python** (v3.10+ recommended, verified on v3.14)

---

### Step 1: Running the Frontend

1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

### Step 2: Running the Python Flask Backend

1. Open a new terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. (Optional) Initialize the SQLite database:
   ```bash
   python3 database/db.py
   ```
5. Run backend unit tests:
   ```bash
   python3 -m unittest tests/test_api.py
   ```
6. Start the Flask API server:
   ```bash
   python3 app.py
   ```
   *The server starts on `http://127.0.0.1:5050` (port 5050 is chosen to avoid macOS AirPlay conflict on 5000).*

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check and readiness probe |
| `GET` | `/api/summary` | Financial KPI metrics (Income, Expenses, Balance, Budget) |
| `GET` | `/api/transactions` | Retrieve recorded transaction ledger |
| `POST` | `/api/transactions` | Record a new transaction |
| `GET` | `/api/categories` | Retrieve available expense & income categories |
| `POST` | `/api/ai/predict-category` | NLP category classification for descriptions |

---

## 🛡️ Sample Data Disclaimer
All figures and sample records displayed in this initial UI stage are **clearly labeled demonstration data** intended for interface evaluation. No live banking credentials or real money connections are established. The application is completely structured for upcoming full SQLite persistence and machine learning training pipelines.

---

---

## ⚡ Prompt 4 — Automatic Expense Detection & Review Queue (Latest)

### Key Capabilities
- **Automatic Expense Detection Hub**:
  - Live Provider Connection Status card (`Connected`, `Demo Mode (Sandbox)`, or `Disconnected`).
  - Idempotent on-demand synchronization button with active loading feedback.
  - Transparent mode switcher: **Demo Provider (Sandbox)** vs. **Plaid Open Banking (OAuth)** vs. **Disconnected (Manual Only)**.
- **Safe Integration Architecture**:
  - Bank-grade security: **Zero banking passwords, PINs, OTPs, or CVVs are ever requested or stored**.
  - Provider-adapter pattern separating business logic from banking APIs (`DemoBankingProvider`, `PlaidProviderStub`, `DisconnectedProvider`).
  - Clearly distinguishes mock/simulated feeds from real financial connections.
  - Web compliance disclaimer: Web browsers cannot silently scrape SMS or notifications without native OS permissions.
- **Review Pending Transactions Queue**:
  - Automatically imported transactions require user verification before entering official balance or financial reports.
  - Approve single transactions with instant ledger entry and summary card recalculation.
  - **Edit & Approve Modal**: Adjust Category (with suggestions), Transaction Type (Expense vs. Income), or add audit notes prior to confirmation.
  - Reject transactions with non-destructive status tracking (`review_status = 'rejected'`).
  - **Bulk Actions**: One-click "Approve All" and "Reject All" capabilities.
- **Idempotency & Duplicate Prevention**:
  - Uses `(provider, external_id)` indexing to guarantee that running sync multiple times never creates duplicate transactions.
- **Sync History & Audit Log**:
  - Full audit trail recorded in SQLite `sync_history` tracking timestamp, provider, status, imported count, pending count, and duplicate counts.

### New REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/automatic-detection/status` | Returns provider connectivity, mode, last sync time, detected count, pending count |
| `POST` | `/api/automatic-detection/sync` | Triggers idempotent sync; accepts optional `{ "mode": "demo" \| "real" \| "disconnected" }` |
| `GET` | `/api/automatic-detection/pending` | Lists all detected transactions in `pending_review` status |
| `POST` | `/api/automatic-detection/review/<id>` | Approve or reject a pending transaction; accepts `{ "action": "approve" \| "reject", "category", "transaction_type", "notes" }` |
| `POST` | `/api/automatic-detection/review-all` | Bulk approve or reject all pending transactions; accepts `{ "action": "approve" \| "reject" }` |
| `GET` | `/api/automatic-detection/history` | Fetches recent sync execution logs and audit records |

---

## 🎯 Prompt 5 — Budget Management Module (Latest)

### Key Capabilities
- **Monthly Budget Dashboard & Period Navigator**:
  - Full period navigation across months and years with left/right arrows, month dropdown, and a quick "Current Month" shortcut.
  - 4 Dynamic metric overview cards:
    - **Total Allocated Budget**: Sum of all category budgets configured for the month.
    - **Actual Monthly Expenses**: Dynamic aggregation of all approved expense transactions in that month.
    - **Remaining Cushion / Net Variance**: Instant calculation of available buffer before exceeding limits.
    - **Overall Budget Usage %**: Global progress meter with color alerts (<80% green, 80-99% amber, ≥100% red).
- **Category Budgets with Visual Progress Meters**:
  - Category spending cards styled with signature fintech colors, spent vs. limit values, remaining amounts, and percentages.
  - Three-tier alert state badges:
    - `On Track` (Green): Spending is healthy and below 80% of limit.
    - `Near Limit` (Amber): Spending has reached 80%–99% of budget with warning notification.
    - `Exceeded` (Red): Spending has reached or surpassed 100% with exact over-budget dollar variance.
- **Budget Lifecycle Management (CRUD)**:
  - **Add Budget Modal**: Select from unbudgeted expense categories, input positive limit amount, and optional audit notes.
  - **Edit Budget Modal**: Update budget limits or notes with immediate recalculation.
  - **Delete Confirmation Modal**: Confirmation dialog before removing category budgets (preserves underlying transaction records).
  - Validation: Prevents duplicate budgets for the same category in the same month/year, negative amounts, and invalid categories.
- **Accurate Dynamic Spending Calculations**:
  - Aggregates actual expenses only (`transaction_type = 'expense'`).
  - Excludes income, rejected transactions, and pending review items.
  - Respects month and year filters (`LIKE 'YYYY-MM%'`).
- **Dashboard Synchronization**:
  - Updated `/api/summary` to dynamically calculate monthly budget from user-configured budgets in SQLite.
  - Added "Manage Budgets" tile in Quick Actions to jump directly to Budget Management.

### New REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/budgets?month=MM&year=YYYY` | Returns category budgets with dynamic spending, remaining cushion, and threshold statuses |
| `GET` | `/api/budgets/summary?month=MM&year=YYYY` | Returns overall monthly budget totals, usage %, and active alerts |
| `POST` | `/api/budgets` | Creates a new category budget for the specified month/year |
| `GET` | `/api/budgets/<id>` | Retrieves a single budget with spending details |
| `PUT` | `/api/budgets/<id>` | Updates budget limit amount or notes |
| `DELETE` | `/api/budgets/<id>` | Deletes a budget item |

---

## 🧠 Prompt 6 — AI Insights & Saving Recommendations Module

### Key Capabilities
- **Responsive AI Insights Dashboard & Period Selector**:
  - Filter by month (1–12) and year (2024–2027) with immediate recalculated insights.
  - 4 Dynamic KPI metric cards:
    - **Total Monthly Expenses**: Real SQLite sum for selected month with Month-over-Month (MoM) comparison percentage & dollar difference badge.
    - **Average Daily Spending**: Dollar spend per day calculated against elapsed days (current month) or total days in past months.
    - **Top Expense Category**: Category name, dollar spend, and exact share percentage of monthly expenses.
    - **Budget Health**: Overall budget utilization meter with warning and over-budget recovery statuses.
- **Visual Trends & Allocations with Chart.js**:
  - **6-Month Spending Trajectory**: Multi-period historical line chart showing actual approved expenses and income.
  - **Category Spending Allocation**: Doughnut chart with dynamic category color mapping and percentage breakdown.
- **Potentially Unusual Transaction Alerts (Explainable Statistical AI)**:
  - Grounded in transparent statistical baseline rules per category ($ \mu + 2.0\sigma $ or $ \ge 2.5 \times \text{median} $).
  - Explicitly labeled as **"Potentially Unusual"**, avoiding false or unsupported fraud accusations.
  - Each flagged alert provides plain-English mathematical rationale: `"Amount of $850.00 is 2.8x your typical Healthcare spending (avg: $312.00)"`.
  - **Dismiss Alert**: Users can dismiss alerts, which persists the transaction ID in `dismissed_anomalies` so it is not shown again.
  - **Data Sufficiency Rules**: Requires at least 3 historical observations in a category before declaring a baseline, clearly explaining when data is insufficient.
- **Personalized Grounded Saving Recommendations**:
  - Derived strictly from actual calculations and user budget limits:
    - **Dominant Category Optimization**: Targets 10% realistic reduction for categories taking $\ge 25\%$ of total expenses.
    - **Surging Category Alerts**: Detects categories increasing $\ge 25\%$ MoM (with $\ge \$25$ surge).
    - **Budget Recovery**: Exact overage warnings with instructions to freeze optional spending.
    - **Discretionary 15% Target**: Sums lifestyle spending (Entertainment, Dining, Shopping, Other) with monthly and annual projected impact.
    - **Recurring Audit**: Flags detected subscriptions for user audit.
  - Transparent stated assumptions and honest disclaimer: *"All potential savings are estimated projections based on stated mathematical assumptions, not guaranteed outcomes."*
- **Recurring Subscriptions & Bills Detection**:
  - Pandas-powered grouping detects repeated similar transactions appearing across distinct months with matching merchants.
- **Scikit-learn Classification Sandbox**:
  - Preserved interactive NLP classifier playground for testing merchant string categorization.

### New REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/insights/summary?month=MM&year=YYYY` | Aggregate financial insights, MoM variance, daily averages, and budget status |
| `GET` | `/api/insights/categories?month=MM&year=YYYY` | Category spending breakdown, percentage share, MoM diff, and budget limits |
| `GET` | `/api/insights/trends?months=6&month=MM&year=YYYY` | Multi-month cash flow trends, income vs expense, and persistent growth categories |
| `GET` | `/api/insights/anomalies?month=MM&year=YYYY` | Potentially unusual transactions flagged against statistical baselines |
| `POST` | `/api/insights/anomalies/<tx_id>/dismiss` | Dismisses a flagged transaction anomaly |
| `GET` | `/api/insights/recommendations?month=MM&year=YYYY` | Actionable saving recommendations with potential savings projections |
| `GET` | `/api/insights/recurring` | Candidates for recurring monthly subscriptions and bills |

### Running the Full Stack

```bash
# Terminal 1 — Python Flask Backend (Port 5050)
cd backend
.venv/bin/python app.py

# Terminal 2 — React + Vite Frontend (Port 5173)
cd frontend
npm run dev
```

### Running Backend Tests
```bash
cd backend
PYTHONPATH=. .venv/bin/python -m unittest discover -s tests
# 29 automated unit tests covering transactions, auto-detection, budgets, AI insights, and migration safety
```

### Database (SQLite)
- File: `backend/instance/expense_tracker.sqlite`
- Re-initialise: `cd backend && rm instance/expense_tracker.sqlite && .venv/bin/python -c "from database.db import init_db; init_db('instance/expense_tracker.sqlite')"`
- All monetary values stored as **integer cents** (avoids floating-point errors)

---

## 🚀 Production Deployment Guide

This guide details deploying the application with **React + Vite on Vercel** and the **Flask REST API on Render** using **Gunicorn**.

```
┌────────────────────────┐         HTTPS / REST API          ┌────────────────────────┐
│     Vercel (Edge)      │ ────────────────────────────────> │     Render (Flask)     │
│ React + Vite Frontend  │ <──────────────────────────────── │   Gunicorn WSGI Server │
│ (Custom Vercel Domain) │          CORS Protection          │  (/health & /api/...)  │
└────────────────────────┘                                   └───────────┬────────────┘
                                                                         │
                                                             ┌───────────┴────────────┐
                                                             │ Persistent Storage     │
                                                             │ - Render Disk (SQLite) │
                                                             │ - or Managed Postgres  │
                                                             └────────────────────────┘
```

---

### Step 1: Deploy Flask Backend to Render

1. Log into your [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the Web Service settings:
   - **Name**: `ai-expense-tracker-api` (or preferred name)
   - **Region**: Select closest to your users (e.g., Oregon, Frankfurt, Singapore)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 wsgi:app`
   - **Health Check Path**: `/health` (or `/api/health`)
4. Add **Environment Variables** in the Render Dashboard:

   | Variable | Value / Description | Example |
   |---|---|---|
   | `SECRET_KEY` | Strong random key (`openssl rand -hex 32`) | `a7f92b...e319` |
   | `FLASK_ENV` | Environment mode | `production` |
   | `FLASK_DEBUG` | Disable debug in production | `0` |
   | `CORS_ALLOWED_ORIGINS` | Exact Vercel URL (no trailing slash) | `https://your-expense-tracker.vercel.app` |
   | `FRONTEND_URL` | Exact Vercel URL | `https://your-expense-tracker.vercel.app` |
   | `BANKING_PROVIDER` | Ingestion mode (`demo` or `plaid`) | `demo` |
   | `DATABASE_PATH` | Path to persistent database (see below) | `/var/data/expense_tracker.sqlite` |

5. Click **Deploy Web Service**.
6. Once deployed, verify health at `https://your-service.onrender.com/health`. Note your public service URL.

---

### Step 2: Database Persistence Strategy on Render

> [!WARNING]
> **Ephemeral Storage Notice:** Standard container instances on cloud platforms like Render use ephemeral filesystems. Any local files written to the container root will be reset when the container restarts or redeploys. To ensure financial data is never lost, use one of the two strategies below:

#### Strategy A: SQLite with Render Persistent Disk (Recommended for Single-Instance)
1. In your Render Web Service settings, navigate to the **Disks** section.
2. Click **Add Disk**:
   - **Name**: `expense-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or as required)
3. Set your environment variable:
   ```env
   DATABASE_PATH=/var/data/expense_tracker.sqlite
   ```
4. Render mounts this volume across all container reboots and deployments, preserving your SQLite database permanently.

#### Strategy B: Managed PostgreSQL (Recommended for Distributed / Free Tier)
If using Render PostgreSQL, Supabase, Neon, or Neon Postgres:
1. Export your existing SQLite data safely without modifying the local database:
   ```bash
   cd backend
   .venv/bin/python database/migrate_to_postgres.py --sqlite instance/expense_tracker.sqlite --output postgres_dump.sql
   ```
2. Apply the dump to your PostgreSQL database:
   ```bash
   psql "$DATABASE_URL" < postgres_dump.sql
   ```
   *Or run direct migration:*
   ```bash
   .venv/bin/python database/migrate_to_postgres.py --sqlite instance/expense_tracker.sqlite --target-url "$DATABASE_URL"
   ```
3. The migration tool verifies SHA-256 checksums to ensure the local SQLite database is untouched and synchronizes PostgreSQL serial sequences.

---

### Step 3: Deploy React Frontend to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/) and click **Add New...** → **Project**.
2. Import your Git repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
4. Add **Environment Variables** in Vercel:

   | Variable | Value | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://your-service.onrender.com/api` | Full URL to your Render Flask API |
   | `VITE_API_TIMEOUT_MS` | `12000` | Optional: 12-second timeout to handle Render cold starts |

5. Click **Deploy**.
6. When deployment finishes, copy your live frontend URL (e.g. `https://your-expense-tracker.vercel.app`).
7. Return to your Render Web Service dashboard and update `CORS_ALLOWED_ORIGINS` to match your exact Vercel domain.

---

### Step 4: Routing & Refresh Behavior (SPAs)

- Static hosting platforms require rewrite rules so that deep page refreshes (e.g. `/` or direct navigation) route to `index.html`.
- This project includes [`frontend/vercel.json`](file:///Users/harshith/ai%20project/frontend/vercel.json) and root [`vercel.json`](file:///Users/harshith/ai%20project/vercel.json):
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- This guarantees error-free page reloads and maintains client state.

---

### Step 5: Troubleshooting & Verification Checklist

| Symptom | Cause | Solution |
|---|---|---|
| **CORS Blocked in Browser Console** | Origin mismatch or extra slash | Ensure `CORS_ALLOWED_ORIGINS` on Render matches your exact Vercel URL without a trailing slash (e.g. `https://app.vercel.app`). |
| **Initial request times out (Render Free Tier)** | Container spin-up latency (~30-50s) | The frontend client includes an extended timeout. Ping `https://your-service.onrender.com/health` to pre-warm the service. |
| **Settings view shows "Offline"** | Incorrect backend URL | Check `VITE_API_BASE_URL` in Vercel. Both `https://host.onrender.com` and `https://host.onrender.com/api` are automatically normalized. |
| **Data resets after redeploy** | SQLite on ephemeral storage | Attach a Render Disk at `/var/data` and configure `DATABASE_PATH=/var/data/expense_tracker.sqlite`, or use PostgreSQL. |
| **Gunicorn startup failure** | Wrong start command or missing dependency | Ensure start command is `gunicorn --bind 0.0.0.0:$PORT --workers 2 wsgi:app` and `gunicorn` is in `requirements.txt`. |



