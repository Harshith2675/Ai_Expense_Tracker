# FinPulse — Frontend Application

This directory contains the client-side Progressive Web Application (PWA) for the FinPulse Expense Tracker.

## Directory Layout

```
frontend/
├── public/
│   ├── assets/            # App icons (192px, 512px)
│   ├── manifest.json      # PWA web app manifest
│   └── sw.js              # Service worker for offline caching
├── src/
│   ├── assets/            # SVG icons and visual assets
│   ├── components/
│   │   ├── common/        # Dialogs, toasts, buttons
│   │   ├── dashboard/     # Month nav, summary cards, recent transactions
│   │   ├── transactions/  # Transaction form and list
│   │   ├── analytics/     # Donut breakdown, trend charts (Chart.js)
│   │   └── budget/        # Budget cards and progress bars
│   ├── screens/           # Dashboard, Transactions, Analytics, Budgets, Settings
│   ├── services/          # Local IndexedDB storage and demo data loader
│   ├── api/               # Supabase API client
│   ├── models/            # Category models and defaults
│   ├── constants/         # App configuration and limits
│   └── theme/             # Modern emerald green CSS theme
├── tests/                 # Frontend component and UI tests
├── package.json           # Frontend scripts
└── index.html             # Single-page application entry point
```

## Features

- **Modern UI/UX**: Emerald green financial theme (`#166534`, `#DCFCE7`), white rounded cards, smooth micro-interactions.
- **Budget Overview**: 6 summary cards updating across 4 period ranges (This Month, Last 3 Months, This Year, Custom).
- **Interactive Charts**: Donut chart with center text and category highlighting, multi-period trend charts.
- **Offline First**: IndexedDB storage with seamless Supabase cloud synchronization.
- **Indian Rupee (₹ INR)**: Standardized currency formatting across all screens.
