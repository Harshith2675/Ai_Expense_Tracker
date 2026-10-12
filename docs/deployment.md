# FinPulse — Global Production Deployment Guide

This guide details how to deploy the FinPulse Expense Tracker globally to modern hosting platforms (Vercel, Netlify, or GitHub Pages) with Supabase cloud backend integration.

---

## 1. Production Architecture

```
User Worldwide (HTTPS Mobile / Desktop)
                 │
                 ▼
   Global Edge CDN (Vercel / Netlify)
   - Edge Caching for assets (CSS, JS, icons)
   - Automated SSL/TLS Certificates
   - SPA Routing & Rewrites (/index.html)
                 │
                 ▼
   Supabase Cloud Platform (Managed PostgreSQL)
   - Supabase Auth (Session management, JWT)
   - PostgreSQL 15+ Database Engine
   - Row Level Security (User isolation)
```

---

## 2. Option A: Deploy to Vercel (Recommended)

Vercel provides immediate global CDN distribution, automatic HTTPS, and zero-configuration PWA support.

### Method 1: Git Integration (One-Click)
1. Push your repository to GitHub / GitLab / Bitbucket:
   ```bash
   git init
   git add .
   git commit -m "feat: complete FinPulse app ready for global deployment"
   git remote add origin https://github.com/<your-username>/expense-tracker.git
   git push -u origin main
   ```
2. Navigate to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your `expense-tracker` repository.
4. Set:
   - **Framework Preset**: *Other*
   - **Root Directory**: `./`
   - **Output Directory**: Leave default (serves root)
5. Under **Environment Variables**, add:
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
6. Click **Deploy**.
7. Your app is live at: `https://your-app-name.vercel.app`!

### Method 2: Vercel CLI
```bash
npm i -g vercel
vercel deploy --prod
```

---

## 3. Option B: Deploy to Netlify

Netlify includes full support for PWA caching and redirects via `netlify.toml`.

### Method 1: Git Integration
1. Go to [netlify.com](https://netlify.com) and click **Add new site** -> **Import an existing project**.
2. Select your repository.
3. Settings:
   - **Base directory**: Leave blank (root)
   - **Publish directory**: `.`
4. Click **Deploy site**.
5. Your app is live at: `https://your-site-name.netlify.app`!

### Method 2: Netlify CLI / Drag-and-Drop
- Drag the project root folder into [app.netlify.com/drop](https://app.netlify.com/drop).

---

## 4. Option C: GitHub Pages (Free Static Hosting)

1. In GitHub, go to your repository **Settings** -> **Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**.
3. Select `main` branch and `/ (root)` folder.
4. Click **Save**.
5. Your app will be live at: `https://<your-username>.github.io/<repo-name>/`.

---

## 5. Post-Deployment Supabase Configuration

Once your production frontend is live:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) -> Select your project.
2. Go to **Authentication** -> **URL Configuration**.
3. Set **Site URL** to your production domain:
   ```
   https://your-app.vercel.app
   ```
4. Under **Redirect URLs**, add:
   ```
   https://your-app.vercel.app/*
   https://your-app.vercel.app/index.html
   ```
5. In the FinPulse app, open **Settings** -> **Supabase Configuration** and paste your URL and Anon Key.
6. The app will immediately establish cloud sync and enable user registration/login.
