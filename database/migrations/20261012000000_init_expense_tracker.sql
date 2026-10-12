-- ====================================================================
-- FinPulse Expense Tracker — Supabase Database Migration
-- Version: 1.0.0
-- Database: PostgreSQL 15+ (Supabase)
-- ====================================================================

-- Enable pgcrypto extension for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. PROFILES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Stores user account profile information linked to Supabase auth.';

-- ====================================================================
-- 2. CATEGORIES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Allow unique name + type per user (or system defaults where user_id IS NULL)
    CONSTRAINT uq_categories_user_name_type UNIQUE NULLS NOT DISTINCT (user_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);

COMMENT ON TABLE public.categories IS 'Expense and Income categories. NULL user_id indicates global defaults.';

-- ====================================================================
-- 3. TRANSACTIONS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT,
    description TEXT NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'netbanking', 'cheque', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Essential Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category_id);

COMMENT ON TABLE public.transactions IS 'Monetary transactions (income and expense) scoped per user with positive amounts.';

-- ====================================================================
-- 4. BUDGETS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'weekly', 'yearly')),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_budget_dates CHECK (end_date >= start_date),
    CONSTRAINT uq_budget_user_cat_dates UNIQUE NULLS NOT DISTINCT (user_id, category_id, start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_dates ON public.budgets(user_id, start_date, end_date);

COMMENT ON TABLE public.budgets IS 'Monthly and category spending limits per user.';

-- ====================================================================
-- 5. USER SETTINGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL DEFAULT 'INR',
    theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    budget_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_settings IS 'User application preferences and alert toggles.';

-- ====================================================================
-- 6. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ====================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- 7. NEW USER REGISTRATION HOOK & SEEDING
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    cur_start_date DATE;
    cur_end_date DATE;
BEGIN
    -- 1. Create Profile
    INSERT INTO public.profiles (id, display_name, currency, opening_balance)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'INR',
        0.00
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create User Settings
    INSERT INTO public.user_settings (user_id, currency, theme, budget_alerts_enabled)
    VALUES (NEW.id, 'INR', 'system', true)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Seed Default Expense Categories
    INSERT INTO public.categories (user_id, name, type, icon, color) VALUES
    (NEW.id, 'Food', 'expense', '🍽️', '#f97316'),
    (NEW.id, 'Travel', 'expense', '✈️', '#3b82f6'),
    (NEW.id, 'Shopping', 'expense', '🛍️', '#ec4899'),
    (NEW.id, 'Bills', 'expense', '📄', '#eab308'),
    (NEW.id, 'Entertainment', 'expense', '🎬', '#8b5cf6'),
    (NEW.id, 'Health', 'expense', '🏥', '#ef4444'),
    (NEW.id, 'Education', 'expense', '📚', '#06b6d4'),
    (NEW.id, 'Groceries', 'expense', '🛒', '#10b981'),
    (NEW.id, 'Other', 'expense', '📦', '#6b7280')
    ON CONFLICT DO NOTHING;

    -- 4. Seed Default Income Categories
    INSERT INTO public.categories (user_id, name, type, icon, color) VALUES
    (NEW.id, 'Salary', 'income', '💼', '#16a34a'),
    (NEW.id, 'Freelance', 'income', '💻', '#0284c7'),
    (NEW.id, 'Business', 'income', '🏢', '#9333ea'),
    (NEW.id, 'Gift', 'income', '🎁', '#f43f5e'),
    (NEW.id, 'Interest', 'income', '📈', '#14b8a6'),
    (NEW.id, 'Other', 'income', '📦', '#6b7280')
    ON CONFLICT DO NOTHING;

    -- 5. Seed Initial Monthly Overall Budget
    cur_start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    cur_end_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;

    INSERT INTO public.budgets (user_id, name, amount, period, category_id, start_date, end_date)
    VALUES (NEW.id, 'Monthly Spending Budget', 50000.00, 'monthly', NULL, cur_start_date, cur_end_date)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger automatically attached to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES POLICIES ----
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ---- CATEGORIES POLICIES ----
DROP POLICY IF EXISTS "Users can view their own and shared categories" ON public.categories;
CREATE POLICY "Users can view their own and shared categories"
ON public.categories FOR SELECT
USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;
CREATE POLICY "Users can create their own categories"
ON public.categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories"
ON public.categories FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
CREATE POLICY "Users can delete their own categories"
ON public.categories FOR DELETE
USING (auth.uid() = user_id);

-- ---- TRANSACTIONS POLICIES ----
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create transactions for themselves" ON public.transactions;
CREATE POLICY "Users can create transactions for themselves"
ON public.transactions FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (
        category_id IS NULL OR 
        EXISTS (
            SELECT 1 FROM public.categories c 
            WHERE c.id = category_id AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
    )
);

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id
    AND (
        category_id IS NULL OR 
        EXISTS (
            SELECT 1 FROM public.categories c 
            WHERE c.id = category_id AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
    )
);

DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "Users can delete their own transactions"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);

-- ---- BUDGETS POLICIES ----
DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
CREATE POLICY "Users can view their own budgets"
ON public.budgets FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own budgets" ON public.budgets;
CREATE POLICY "Users can create their own budgets"
ON public.budgets FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (
        category_id IS NULL OR 
        EXISTS (
            SELECT 1 FROM public.categories c 
            WHERE c.id = category_id AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
    )
);

DROP POLICY IF EXISTS "Users can update their own budgets" ON public.budgets;
CREATE POLICY "Users can update their own budgets"
ON public.budgets FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id
    AND (
        category_id IS NULL OR 
        EXISTS (
            SELECT 1 FROM public.categories c 
            WHERE c.id = category_id AND (c.user_id = auth.uid() OR c.user_id IS NULL)
        )
    )
);

DROP POLICY IF EXISTS "Users can delete their own budgets" ON public.budgets;
CREATE POLICY "Users can delete their own budgets"
ON public.budgets FOR DELETE
USING (auth.uid() = user_id);

-- ---- USER SETTINGS POLICIES ----
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
ON public.user_settings FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
ON public.user_settings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
ON public.user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- 9. STORED PROCEDURES & DASHBOARD / ANALYTICS RPCs
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
    p_start_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
    p_end_date DATE DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_opening_balance NUMERIC := 0.00;
    v_lifetime_income NUMERIC := 0.00;
    v_lifetime_expenses NUMERIC := 0.00;
    v_period_income NUMERIC := 0.00;
    v_period_expenses NUMERIC := 0.00;
    v_budget_amount NUMERIC := 50000.00;
    v_budget_spent NUMERIC := 0.00;
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request';
    END IF;

    -- 1. Profile opening balance
    SELECT COALESCE(opening_balance, 0.00) INTO v_opening_balance
    FROM public.profiles
    WHERE id = v_user_id;

    -- 2. Lifetime totals for total balance
    SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0.00)
    INTO v_lifetime_income, v_lifetime_expenses
    FROM public.transactions
    WHERE user_id = v_user_id;

    -- 3. Selected period totals
    SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0.00)
    INTO v_period_income, v_period_expenses
    FROM public.transactions
    WHERE user_id = v_user_id
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date;

    -- 4. Overall Budget for current period
    SELECT COALESCE(amount, 50000.00) INTO v_budget_amount
    FROM public.budgets
    WHERE user_id = v_user_id
      AND category_id IS NULL
      AND start_date <= p_start_date
      AND end_date >= p_end_date
    ORDER BY created_at DESC
    LIMIT 1;

    v_budget_spent := v_period_expenses;

    SELECT json_build_object(
        'period', json_build_object('start_date', p_start_date, 'end_date', p_end_date),
        'total_balance', (v_opening_balance + v_lifetime_income - v_lifetime_expenses),
        'period_income', v_period_income,
        'period_expenses', v_period_expenses,
        'net_savings', (v_period_income - v_period_expenses),
        'budget', json_build_object(
            'amount', v_budget_amount,
            'spent', v_budget_spent,
            'remaining', GREATEST(0.00, v_budget_amount - v_budget_spent),
            'percentage', CASE WHEN v_budget_amount > 0 THEN ROUND((v_budget_spent / v_budget_amount) * 100, 1) ELSE 0 END
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_analytics_summary(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_total_income NUMERIC := 0.00;
    v_total_expenses NUMERIC := 0.00;
    v_categories JSON;
    v_weekly JSON;
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request';
    END IF;

    -- 1. Period totals
    SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0.00)
    INTO v_total_income, v_total_expenses
    FROM public.transactions
    WHERE user_id = v_user_id
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date;

    -- 2. Category breakdown
    SELECT COALESCE(json_agg(cat_row), '[]'::json) INTO v_categories
    FROM (
        SELECT
            COALESCE(c.name, t.category_name, 'Other') AS category,
            COALESCE(c.icon, '📦') AS icon,
            SUM(t.amount) AS amount,
            COUNT(t.id) AS count,
            CASE WHEN v_total_expenses > 0 
                THEN ROUND((SUM(t.amount) / v_total_expenses) * 100, 1)
                ELSE 0.0
            END AS percentage
        FROM public.transactions t
        LEFT JOIN public.categories c ON t.category_id = c.id
        WHERE t.user_id = v_user_id
          AND t.type = 'expense'
          AND t.transaction_date >= p_start_date
          AND t.transaction_date <= p_end_date
        GROUP BY COALESCE(c.name, t.category_name, 'Other'), COALESCE(c.icon, '📦')
        ORDER BY amount DESC
    ) cat_row;

    -- 3. Weekly totals (grouped by day of week Mon-Sun)
    SELECT COALESCE(json_agg(w_row), '[]'::json) INTO v_weekly
    FROM (
        SELECT
            TO_CHAR(d.day, 'Dy') AS day_label,
            d.day AS date,
            COALESCE(SUM(t.amount), 0.00) AS amount
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(day)
        LEFT JOIN public.transactions t ON t.user_id = v_user_id 
            AND t.type = 'expense' 
            AND t.transaction_date = d.day::DATE
        GROUP BY d.day
        ORDER BY d.day ASC
    ) w_row;

    SELECT json_build_object(
        'period', json_build_object('start_date', p_start_date, 'end_date', p_end_date),
        'income', v_total_income,
        'expenses', v_total_expenses,
        'net_savings', (v_total_income - v_total_expenses),
        'category_breakdown', v_categories,
        'weekly_spending', v_weekly
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
