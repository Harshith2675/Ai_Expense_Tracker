/**
 * demo-data.js — Deterministic Sample Data Generator
 * Provides realistic expense & income transactions and category budgets
 * for demonstrating the Budget Overview & Advanced Spending Analytics module.
 * 
 * All generated records are tagged with `isDemo: true` so they never mix
 * destructively with real user transactions and can be cleared in one click.
 */

const DemoDataManager = {
  // Deterministic seed items spanning the 12 required categories
  SAMPLE_EXPENSE_TEMPLATES: [
    { title: 'Restaurant dinner with friends', category: 'food', amount: 850, paymentMethod: 'upi', note: 'Zomato dining' },
    { title: 'Weekly fresh groceries', category: 'groceries', amount: 1650, paymentMethod: 'upi', note: 'Supermarket' },
    { title: 'Uber cab ride to office', category: 'transportation', amount: 320, paymentMethod: 'upi', note: 'Morning commute' },
    { title: 'Weekend apparel shopping', category: 'shopping', amount: 2400, paymentMethod: 'credit_card', note: 'Festival sale' },
    { title: 'Monthly electricity bill', category: 'bills', amount: 1800, paymentMethod: 'netbanking', note: 'BESCOM portal' },
    { title: 'IMAX movie tickets & popcorn', category: 'entertainment', amount: 600, paymentMethod: 'debit_card', note: 'PVR Cinema' },
    { title: 'Pharmacy prescription & vitamins', category: 'health', amount: 450, paymentMethod: 'cash', note: 'Apollo Pharmacy' },
    { title: 'Python & Data Science online course', category: 'education', amount: 1200, paymentMethod: 'credit_card', note: 'Udemy' },
    { title: 'Weekend getaway resort stay', category: 'travel', amount: 3500, paymentMethod: 'credit_card', note: 'Coorg homestay' },
    { title: 'Spotify & Apple Music subscription', category: 'subscriptions', amount: 199, paymentMethod: 'upi', note: 'Monthly auto-debit' },
    { title: 'Salon grooming & skincare products', category: 'personal_care', amount: 750, paymentMethod: 'upi', note: 'Enrich salon' },
    { title: 'Stationery & home utilities', category: 'other_exp', amount: 400, paymentMethod: 'cash', note: 'Local vendor' },
    { title: 'Café latte & snacks', category: 'food', amount: 420, paymentMethod: 'upi', note: 'Blue Tokai' },
    { title: 'Organic fruits & dairy', category: 'groceries', amount: 980, paymentMethod: 'upi', note: 'Blinkit quick delivery' },
    { title: 'Metro smart card recharge', category: 'transportation', amount: 500, paymentMethod: 'upi', note: 'Metro rail' },
    { title: 'Broadband internet fiber bill', category: 'bills', amount: 999, paymentMethod: 'netbanking', note: 'Airtel Xstream' },
    { title: 'Netflix 4K subscription', category: 'subscriptions', amount: 649, paymentMethod: 'credit_card', note: 'Family plan' },
    { title: 'Dental checkup & cleaning', category: 'health', amount: 800, paymentMethod: 'debit_card', note: 'Clove Dental' },
    { title: 'Gym membership renewal', category: 'personal_care', amount: 1500, paymentMethod: 'credit_card', note: 'Cult.fit' },
    { title: 'Flight ticket booking', category: 'travel', amount: 4200, paymentMethod: 'credit_card', note: 'Indigo flight' }
  ],

  SAMPLE_INCOME_TEMPLATES: [
    { title: 'Monthly Salary Credit', category: 'salary', amount: 65000, paymentMethod: 'bank_transfer', note: 'Primary employer' },
    { title: 'UI/UX Freelance Design Project', category: 'freelance', amount: 18000, paymentMethod: 'bank_transfer', note: 'Fintech client milestone' },
    { title: 'Mutual Funds & Stock Dividends', category: 'interest', amount: 3500, paymentMethod: 'bank_transfer', note: 'Quarterly payout' }
  ],

  /**
   * Check if demo data is currently loaded in memory or storage
   */
  isLoaded() {
    return AppState.transactions.some(t => t.isDemo === true);
  },

  /**
   * Generate realistic demo transactions for the past 12 calendar months
   */
  generateDemoTransactions() {
    const transactions = [];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    // Generate across 12 months (month 0 to 11 of curYear)
    for (let m = 0; m <= curMonth; m++) {
      const monthNum = m + 1;
      const monthStr = String(monthNum).padStart(2, '0');
      const isCurMonth = m === curMonth;
      const daysCount = isCurMonth ? Math.min(now.getDate(), 28) : new Date(curYear, monthNum, 0).getDate();

      // 1. Add monthly salary on day 1
      transactions.push({
        id: `demo-inc-sal-${curYear}-${monthNum}`,
        title: this.SAMPLE_INCOME_TEMPLATES[0].title,
        amount: this.SAMPLE_INCOME_TEMPLATES[0].amount,
        type: 'income',
        category: this.SAMPLE_INCOME_TEMPLATES[0].category,
        date: `${curYear}-${monthStr}-01`,
        paymentMethod: this.SAMPLE_INCOME_TEMPLATES[0].paymentMethod,
        note: this.SAMPLE_INCOME_TEMPLATES[0].note,
        isDemo: true,
        createdAt: new Date(curYear, m, 1, 9, 0).toISOString(),
        updatedAt: new Date(curYear, m, 1, 9, 0).toISOString()
      });

      // 2. Add freelance / interest on day 15
      if (m % 2 === 0) {
        transactions.push({
          id: `demo-inc-free-${curYear}-${monthNum}`,
          title: this.SAMPLE_INCOME_TEMPLATES[1].title,
          amount: this.SAMPLE_INCOME_TEMPLATES[1].amount + (m * 500),
          type: 'income',
          category: this.SAMPLE_INCOME_TEMPLATES[1].category,
          date: `${curYear}-${monthStr}-15`,
          paymentMethod: this.SAMPLE_INCOME_TEMPLATES[1].paymentMethod,
          note: this.SAMPLE_INCOME_TEMPLATES[1].note,
          isDemo: true,
          createdAt: new Date(curYear, m, 15, 14, 0).toISOString(),
          updatedAt: new Date(curYear, m, 15, 14, 0).toISOString()
        });
      }

      // 3. Add expense transactions scattered across days
      this.SAMPLE_EXPENSE_TEMPLATES.forEach((tmpl, idx) => {
        // Distribute across days deterministically
        const day = ((idx * 3 + m * 5) % daysCount) + 1;
        if (isCurMonth && day > now.getDate()) return; // do not put future dates for current month

        const dayStr = String(day).padStart(2, '0');
        // Slight monthly variance
        const variance = ((idx + m) % 5 - 2) * 40;
        const finalAmount = Math.max(50, tmpl.amount + variance);

        transactions.push({
          id: `demo-exp-${curYear}-${monthNum}-${idx}`,
          title: tmpl.title,
          amount: finalAmount,
          type: 'expense',
          category: tmpl.category,
          date: `${curYear}-${monthStr}-${dayStr}`,
          paymentMethod: tmpl.paymentMethod,
          note: tmpl.note,
          isDemo: true,
          createdAt: new Date(curYear, m, day, 12, idx).toISOString(),
          updatedAt: new Date(curYear, m, day, 12, idx).toISOString()
        });
      });
    }

    return transactions;
  },

  /**
   * Generate default category budgets matching the specification
   */
  generateDemoBudgets() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const startDate = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(curYear, curMonth, 0).getDate();
    const endDate = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const categoriesWithLimits = [
      { category: 'food', limit: 6000 },
      { category: 'groceries', limit: 5000 },
      { category: 'transportation', limit: 3000 },
      { category: 'shopping', limit: 4000 },
      { category: 'bills', limit: 3500 },
      { category: 'entertainment', limit: 2000 },
      { category: 'health', limit: 1500 },
      { category: 'education', limit: 2500 },
      { category: 'travel', limit: 4000 },
      { category: 'personal_care', limit: 1000 },
      { category: 'subscriptions', limit: 500 },
      { category: 'other_exp', limit: 1500 }
    ];

    return categoriesWithLimits.map(item => ({
      id: `demo-budget-${item.category}`,
      category: item.category,
      monthlyLimit: item.limit,
      month: curMonth,
      year: curYear,
      startDate,
      endDate,
      isDemo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  },

  /**
   * Helper to return complete generated dataset object
   */
  generateDataset(year = 2026) {
    return {
      transactions: this.generateDemoTransactions(year),
      budgets: this.generateDemoBudgets(year),
    };
  },

  /**
   * Load demo transactions and budgets without overwriting real data
   */
  async load() {
    if (this.isLoaded()) {
      return { success: true, count: 0, transactionsLoaded: 0, message: 'Demo data is already loaded.' };
    }

    const demoTxns = this.generateDemoTransactions();
    const demoBudgets = this.generateDemoBudgets();

    // Save demo transactions to local DB if available
    if (typeof DB !== 'undefined') {
      const saveTx = DB.addTransaction ? (tx) => DB.addTransaction(tx) : DB.saveTransaction ? (tx) => DB.saveTransaction(tx) : null;
      const saveBg = DB.addBudget ? (b) => DB.addBudget(b) : DB.saveBudget ? (b) => DB.saveBudget(b) : null;

      if (saveTx) {
        for (const tx of demoTxns) {
          try { await saveTx(tx); } catch (_) {}
        }
      }
      if (saveBg) {
        for (const b of demoBudgets) {
          try { await saveBg(b); } catch (_) {}
        }
      }
    }

    AppState.transactions.push(...demoTxns);
    AppState.budgets.push(...demoBudgets);

    if (AppState.notify) {
      AppState.notify('transactions_changed');
      AppState.notify('budgets_changed');
    }

    return {
      success: true,
      count: demoTxns.length,
      transactionsLoaded: demoTxns.length,
      budgetsCount: demoBudgets.length,
      message: `Loaded ${demoTxns.length} demo transactions across 12 months.`
    };
  },

  /**
   * Remove all demo transactions and demo budgets in one click
   */
  async clear() {
    const demoTxIds = AppState.transactions.filter(t => t.isDemo === true).map(t => t.id);
    const demoBgIds = AppState.budgets.filter(b => b.isDemo === true).map(b => b.id);

    if (typeof DB !== 'undefined' && DB.deleteTransaction) {
      for (const id of demoTxIds) {
        try { await DB.deleteTransaction(id); } catch (_) {}
      }
      for (const id of demoBgIds) {
        try { await DB.deleteBudget(id); } catch (_) {}
      }
    }

    AppState.transactions = AppState.transactions.filter(t => t.isDemo !== true);
    AppState.budgets = AppState.budgets.filter(b => b.isDemo !== true);

    if (AppState.notify) {
      AppState.notify('transactions_changed');
      AppState.notify('budgets_changed');
    }

    return {
      success: true,
      count: demoTxIds.length,
      removedCount: demoTxIds.length,
      removedBudgetsCount: demoBgIds.length,
      message: `Removed ${demoTxIds.length} demo records.`
    };
  }
};
