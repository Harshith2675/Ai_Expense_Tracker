/**
 * services.js — Business Logic Layer
 * Transaction service, budget service, validation, and financial calculations.
 * Maintains a single in-memory cache as source of truth, synced with IndexedDB.
 */

const AppState = {
  transactions: [],     // All transactions (in-memory cache)
  budgets: [],          // All budgets (in-memory cache)
  preferences: { ...DEFAULT_PREFERENCES },

  // Dashboard filter state
  dashboardMonth: new Date().getMonth() + 1,
  dashboardYear: new Date().getFullYear(),

  // Edit state
  editingTransactionId: null,
  editingBudgetId: null,

  // Subscribers
  _listeners: [],

  subscribe(fn) {
    this._listeners.push(fn);
  },

  notify(event) {
    this._listeners.forEach(fn => fn(event));
  },
};

// ==================== INITIALIZATION ====================

async function initAppState() {
  try {
    let transactions = [];
    let budgets = [];

    if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
      const [txRes, bgRes] = await Promise.all([
        SupabaseBackend.transactions.list(),
        SupabaseBackend.budgets.list(),
      ]);
      transactions = txRes.data || [];
      budgets = bgRes.data || [];
    } else {
      const [localTxns, localBudgets] = await Promise.all([
        DB.getAllTransactions(),
        DB.getAllBudgets(),
      ]);
      transactions = localTxns || [];
      budgets = localBudgets || [];
    }

    const [currency, theme] = await Promise.all([
      DB.getPreference('currency', 'INR'),
      DB.getPreference('theme', 'system'),
    ]);

    AppState.transactions = transactions || [];
    AppState.budgets = budgets || [];
    AppState.preferences.currency = currency;
    AppState.preferences.theme = theme;

  } catch (err) {
    console.error('Failed to load data in initAppState:', err);
    AppState.transactions = [];
    AppState.budgets = [];
  }
}

// ==================== VALIDATION ====================

const Validator = {
  /**
   * Validate a transaction form input.
   * Returns { valid: boolean, errors: { field: message } }
   */
  validateTransaction({ title, amount, type, category, date }) {
    const errors = {};

    if (!title || title.trim().length === 0) {
      errors.title = 'Title is required.';
    } else if (title.trim().length > 100) {
      errors.title = 'Title must be under 100 characters.';
    }

    const amt = parseFloat(amount);
    if (amount === '' || amount === null || amount === undefined) {
      errors.amount = 'Amount is required.';
    } else if (isNaN(amt) || !isFinite(amt)) {
      errors.amount = 'Enter a valid number.';
    } else if (amt <= 0) {
      errors.amount = 'Amount must be greater than zero.';
    } else if (amt > 1_00_00_00_000) {
      errors.amount = 'Amount is too large.';
    }

    if (!type || !['income', 'expense'].includes(type)) {
      errors.type = 'Invalid transaction type.';
    }

    if (!category || category.trim() === '') {
      errors.category = 'Please select a category.';
    }

    if (!date || date.trim() === '') {
      errors.date = 'Date is required.';
    } else {
      const d = new Date(date + 'T00:00:00');
      if (isNaN(d.getTime())) {
        errors.date = 'Invalid date.';
      } else if (d.getFullYear() < 2000 || d.getFullYear() > 2099) {
        errors.date = 'Date must be between 2000 and 2099.';
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  /**
   * Validate a budget form input.
   */
  validateBudget({ category, monthlyLimit, month, year }) {
    const errors = {};

    if (!category || category.trim() === '') {
      errors.category = 'Please select a category.';
    }

    const limit = parseFloat(monthlyLimit);
    if (!monthlyLimit) {
      errors.monthlyLimit = 'Monthly limit is required.';
    } else if (isNaN(limit) || limit <= 0) {
      errors.monthlyLimit = 'Enter a positive amount.';
    }

    const m = parseInt(month, 10);
    if (!month || isNaN(m) || m < 1 || m > 12) {
      errors.month = 'Invalid month.';
    }

    const y = parseInt(year, 10);
    if (!year || isNaN(y) || y < 2020 || y > 2099) {
      errors.year = 'Invalid year.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },
};

// ==================== TRANSACTION SERVICE ====================

const TransactionService = {

  getAll() {
    return [...AppState.transactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  getById(id) {
    return AppState.transactions.find(t => t.id === id) || null;
  },

  async add(data) {
    const validation = Validator.validateTransaction(data);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const tx = createTransaction(data);
    try {
      if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
        const res = await SupabaseBackend.transactions.create(tx);
        if (!res.success) {
          return { success: false, errors: { _general: res.error || 'Failed to save to cloud.' } };
        }
        AppState.transactions.unshift(res.data);
      } else {
        await DB.addTransaction(tx);
        AppState.transactions.unshift(tx);
      }
      AppState.notify('transactions_changed');
      return { success: true, transaction: tx };
    } catch (err) {
      console.error('Failed to save transaction:', err);
      return { success: false, errors: { _general: 'Failed to save. Please try again.' } };
    }
  },

  async update(id, data) {
    const validation = Validator.validateTransaction(data);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const existing = AppState.transactions.find(t => t.id === id);
    if (!existing) return { success: false, errors: { _general: 'Transaction not found.' } };

    const updated = createTransaction({ ...existing, ...data, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
    try {
      if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
        const res = await SupabaseBackend.transactions.update(id, updated);
        if (!res.success) {
          return { success: false, errors: { _general: res.error || 'Failed to update on cloud.' } };
        }
      } else {
        await DB.updateTransaction(updated);
      }
      const idx = AppState.transactions.findIndex(t => t.id === id);
      if (idx !== -1) AppState.transactions[idx] = updated;
      AppState.notify('transactions_changed');
      return { success: true, transaction: updated };
    } catch (err) {
      console.error('Failed to update transaction:', err);
      return { success: false, errors: { _general: 'Failed to update. Please try again.' } };
    }
  },

  async delete(id) {
    try {
      if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
        const res = await SupabaseBackend.transactions.delete(id);
        if (!res.success) {
          return { success: false, errors: { _general: res.error || 'Failed to delete on cloud.' } };
        }
      } else {
        await DB.deleteTransaction(id);
      }
      AppState.transactions = AppState.transactions.filter(t => t.id !== id);
      AppState.notify('transactions_changed');
      return { success: true };
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      return { success: false };
    }
  },

  /**
   * Filter and sort transactions based on criteria.
   */
  filter({
    type = 'all',
    category = 'all',
    month = 'all',
    year = null,
    search = '',
    startDate = null,
    endDate = null,
    sort = 'newest',
  } = {}) {
    let txns = this.getAll();

    if (type !== 'all') txns = txns.filter(t => t.type === type);
    if (category !== 'all') txns = txns.filter(t => t.category === category);

    if (startDate || endDate) {
      txns = txns.filter(t => isInDateRange(t.date, startDate, endDate));
    } else if (month !== 'all' && year) {
      txns = txns.filter(t => isInMonth(t.date, parseInt(month), parseInt(year)));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      txns = txns.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q)) ||
        getCategoryById(t.category).label.toLowerCase().includes(q)
      );
    }

    // Sort transactions
    txns.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return (a.date > b.date ? 1 : a.date < b.date ? -1 : 0) ||
                 (a.createdAt > b.createdAt ? 1 : -1);
        case 'highest':
          return b.amount - a.amount;
        case 'lowest':
          return a.amount - b.amount;
        case 'newest':
        default:
          return (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) ||
                 (b.createdAt > a.createdAt ? 1 : -1);
      }
    });

    return txns;
  },
};

// ==================== FINANCIAL CALCULATIONS ====================

const Calculator = {

  /** Sum of income transactions in a list */
  totalIncome(transactions) {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  },

  /** Sum of expense transactions in a list */
  totalExpenses(transactions) {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  },

  /** Current Balance = Total Income - Total Expenses */
  balance(transactions) {
    return this.totalIncome(transactions) - this.totalExpenses(transactions);
  },

  /** Transactions for a specific month/year */
  forMonth(transactions, month, year) {
    return transactions.filter(t => isInMonth(t.date, month, year));
  },

  /** Transactions for the calendar week of refDate (Mon-Sun) */
  forWeek(transactions, refDate = new Date()) {
    return transactions.filter(t => isInWeek(t.date, refDate));
  },

  /** Transactions for previous month */
  forPreviousMonth(transactions, month, year) {
    const prev = getPreviousMonthYear(month, year);
    return this.forMonth(transactions, prev.month, prev.year);
  },

  /** Transactions for arbitrary date range */
  forDateRange(transactions, startDate, endDate) {
    return transactions.filter(t => isInDateRange(t.date, startDate, endDate));
  },

  /**
   * Transactions for Last 3 Months:
   * current month and the preceding two calendar months.
   */
  forLast3Months(transactions, refDate = new Date()) {
    const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0); // last day of current month
    const start = new Date(refDate.getFullYear(), refDate.getMonth() - 2, 1); // 1st day of month - 2
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return this.forDateRange(transactions, startIso, endIso);
  },

  /**
   * Transactions for the preceding 3 months prior to forLast3Months
   * (for period comparison).
   */
  forPrevious3Months(transactions, refDate = new Date()) {
    const end = new Date(refDate.getFullYear(), refDate.getMonth() - 2, 0);
    const start = new Date(refDate.getFullYear(), refDate.getMonth() - 5, 1);
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return this.forDateRange(transactions, startIso, endIso);
  },

  /**
   * Transactions for a calendar year (Jan 1 to Dec 31).
   */
  forYear(transactions, year) {
    const startIso = `${year}-01-01`;
    const endIso = `${year}-12-31`;
    return this.forDateRange(transactions, startIso, endIso);
  },

  /**
   * Expense totals grouped by category
   */
  categoryBreakdown(transactions) {
    const expenses = transactions.filter(t => t.type === 'expense');
    const map = {};
    expenses.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    const totalExp = Object.values(map).reduce((a, b) => a + b, 0);

    return Object.entries(map)
      .map(([category, total]) => ({
        category,
        total,
        percentage: totalExp > 0 ? Number(((total / totalExp) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  },

  /** Highest spending category in transactions list */
  highestSpendingCategory(transactions) {
    const breakdown = this.categoryBreakdown(transactions);
    if (breakdown.length === 0) return null;
    const top = breakdown[0];
    const cat = getCategoryById(top.category);
    return {
      category: top.category,
      label: cat.label,
      emoji: cat.emoji,
      total: top.total,
      percentage: top.percentage,
    };
  },

  /** Monthly comparison with previous month */
  monthOverMonthComparison(transactions, month, year) {
    const curTxns = this.forMonth(transactions, month, year);
    const prevTxns = this.forPreviousMonth(transactions, month, year);

    const curExp = this.totalExpenses(curTxns);
    const prevExp = this.totalExpenses(prevTxns);
    const diff = curExp - prevExp;

    let percent = 0;
    if (prevExp > 0) {
      percent = Math.round((Math.abs(diff) / prevExp) * 100);
    } else if (curExp > 0) {
      percent = 100;
    }

    return {
      currentExpenses: curExp,
      previousExpenses: prevExp,
      diff,
      percent,
      isIncrease: diff > 0,
      isEqual: diff === 0,
    };
  },

  /**
   * Daily spending breakdown for a specific month (1..daysInMonth)
   * with average spending reference.
   */
  dailyMonthTrendWithAverage(transactions, month, year) {
    const monthTxns = this.forMonth(transactions, month, year).filter(t => t.type === 'expense');
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayTotals = new Array(daysInMonth).fill(0);

    monthTxns.forEach(t => {
      const dayNum = parseInt(t.date.split('-')[2], 10);
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        dayTotals[dayNum - 1] += t.amount;
      }
    });

    const totalExp = dayTotals.reduce((a, b) => a + b, 0);
    const dailyAverage = daysInMonth > 0 ? Math.round(totalExp / daysInMonth) : 0;

    let highestDay = 1;
    let highestAmount = 0;
    dayTotals.forEach((amt, idx) => {
      if (amt > highestAmount) {
        highestAmount = amt;
        highestDay = idx + 1;
      }
    });

    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

    return {
      labels,
      expenses: dayTotals,
      dailyAverage,
      totalExpenses: totalExp,
      highestDay,
      highestAmount,
    };
  },

  /**
   * 3-Month Trend: Returns the 3 consecutive calendar months
   * (month - 2, month - 1, current month) with income, expenses, and MoM diff.
   */
  threeMonthTrend(transactions, refDate = new Date()) {
    const result = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthTxns = this.forMonth(transactions, m, y);
      const inc = this.totalIncome(monthTxns);
      const exp = this.totalExpenses(monthTxns);
      result.push({
        label: `${SHORT_MONTH_NAMES[m - 1]} ${y}`,
        month: m,
        year: y,
        income: inc,
        expenses: exp,
        savings: inc - exp,
      });
    }

    // Add MoM change indicators
    result.forEach((item, idx) => {
      if (idx === 0) {
        item.momChangePercent = 0;
        item.momIsIncrease = false;
      } else {
        const prevExp = result[idx - 1].expenses;
        const curExp = item.expenses;
        const diff = curExp - prevExp;
        item.momChangePercent = prevExp > 0 ? Math.round((Math.abs(diff) / prevExp) * 100) : (curExp > 0 ? 100 : 0);
        item.momIsIncrease = diff > 0;
      }
    });

    return result;
  },

  /**
   * Yearly Trend: January through December (12 months) of the selected year.
   * Identifies highest, lowest, average, and MoM changes.
   */
  yearlyTrend(transactions, year) {
    const result = [];
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    for (let m = 1; m <= 12; m++) {
      const monthTxns = this.forMonth(transactions, m, year);
      const inc = this.totalIncome(monthTxns);
      const exp = this.totalExpenses(monthTxns);
      const isCurrentMonth = (year === curYear && m === curMonth);
      result.push({
        label: SHORT_MONTH_NAMES[m - 1],
        month: m,
        year,
        income: inc,
        expenses: exp,
        savings: inc - exp,
        isCurrentMonth,
      });
    }

    // MoM changes
    result.forEach((item, idx) => {
      if (idx === 0) {
        item.momChange = 0;
      } else {
        const prev = result[idx - 1].expenses;
        item.momChange = prev > 0 ? Math.round(((item.expenses - prev) / prev) * 100) : 0;
      }
    });

    const activeMonths = result.filter(r => r.expenses > 0 || r.income > 0);
    const totalExp = result.reduce((s, r) => s + r.expenses, 0);
    const totalInc = result.reduce((s, r) => s + r.income, 0);
    const averageMonthlyExpense = activeMonths.length > 0 ? Math.round(totalExp / activeMonths.length) : Math.round(totalExp / 12);

    let highestMonth = null;
    let lowestMonth = null;

    if (activeMonths.length > 0) {
      const sorted = [...activeMonths].sort((a, b) => b.expenses - a.expenses);
      highestMonth = sorted[0];
      lowestMonth = sorted[sorted.length - 1];
    }

    return {
      months: result,
      totalExpenses: totalExp,
      totalIncome: totalInc,
      netSavings: totalInc - totalExp,
      averageMonthlyExpense,
      highestMonth,
      lowestMonth,
    };
  },

  /**
   * Category-Wise Spending Analysis (Deep Dive)
   * Calculates Total, Share %, Tx Count, Avg Tx Amount, Change vs Prev Period,
   * Budget Limit, Remaining, and Status (<75% Within Budget, 75%-99.9% Near Limit, >=100% Over Budget).
   */
  categoryDeepDive(currentTxns, previousTxns, budgets = [], sortBy = 'highest') {
    const curExpenses = currentTxns.filter(t => t.type === 'expense');
    const prevExpenses = (previousTxns || []).filter(t => t.type === 'expense');
    const totalCurrentExp = curExpenses.reduce((s, t) => s + t.amount, 0);

    // Group current
    const curMap = {};
    curExpenses.forEach(t => {
      if (!curMap[t.category]) {
        curMap[t.category] = { total: 0, count: 0, txns: [] };
      }
      curMap[t.category].total += t.amount;
      curMap[t.category].count += 1;
      curMap[t.category].txns.push(t);
    });

    // Group prev
    const prevMap = {};
    prevExpenses.forEach(t => {
      prevMap[t.category] = (prevMap[t.category] || 0) + t.amount;
    });

    // Build items for all categories with spending or with a budget
    const allCatKeys = new Set([
      ...Object.keys(curMap),
      ...budgets.map(b => b.category),
    ]);

    const items = Array.from(allCatKeys).map(catKey => {
      const cat = getCategoryById(catKey);
      const curData = curMap[catKey] || { total: 0, count: 0, txns: [] };
      const prevTotal = prevMap[catKey] || 0;
      const total = curData.total;
      const count = curData.count;
      const avg = count > 0 ? Math.round(total / count) : 0;
      const percentage = totalCurrentExp > 0 ? Number(((total / totalCurrentExp) * 100).toFixed(1)) : 0;

      // Period change calculation
      let changePercent = 0;
      let changeType = 'none'; // 'increase', 'decrease', 'new', 'none'
      if (prevTotal > 0) {
        changePercent = Math.round(((total - prevTotal) / prevTotal) * 100);
        changeType = changePercent > 0 ? 'increase' : changePercent < 0 ? 'decrease' : 'none';
      } else if (total > 0) {
        changePercent = 100;
        changeType = 'new';
      }

      // Budget match
      const bgt = budgets.find(b => b.category === catKey);
      const budgetLimit = bgt ? bgt.monthlyLimit : null;
      let budgetRemaining = null;
      let budgetUtilization = null;
      let status = 'No Budget';
      let statusClass = 'neutral';

      if (budgetLimit !== null && budgetLimit > 0) {
        budgetRemaining = budgetLimit - total;
        budgetUtilization = Number(((total / budgetLimit) * 100).toFixed(1));

        if (budgetUtilization >= 100) {
          status = 'Over Budget';
          statusClass = 'danger';
        } else if (budgetUtilization >= 75) {
          status = 'Near Limit';
          statusClass = 'warning';
        } else {
          status = 'Within Budget';
          statusClass = 'success';
        }
      }

      return {
        category: catKey,
        label: cat.label,
        emoji: cat.emoji,
        color: cat.color,
        total,
        count,
        average: avg,
        percentage,
        prevTotal,
        changePercent,
        changeType,
        budgetLimit,
        budgetRemaining,
        budgetUtilization,
        status,
        statusClass,
        transactions: curData.txns,
      };
    });

    // Sorting
    items.sort((a, b) => {
      switch (sortBy) {
        case 'lowest':
          return a.total - b.total;
        case 'increase':
          return b.changePercent - a.changePercent;
        case 'transactions':
          return b.count - a.count;
        case 'highest':
        default:
          return b.total - a.total;
      }
    });

    return items;
  },

  /** Weekly daily spending breakdown (Mon - Sun) */
  weeklyDailyBreakdown(transactions, refDate = new Date()) {
    const now = new Date(refDate);
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayTxns = transactions.filter(t => t.date === iso);
      result.push({
        day: days[i],
        date: iso,
        expense: this.totalExpenses(dayTxns),
        income: this.totalIncome(dayTxns),
      });
    }
    return result;
  },

  /** Monthly spending for the last N months (for trend chart) */
  monthlyTrend(transactions, nMonths = 6) {
    const result = [];
    const now = new Date();
    for (let i = nMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthTxns = this.forMonth(transactions, m, y);
      result.push({
        label: `${SHORT_MONTH_NAMES[m - 1]} ${y}`,
        income: this.totalIncome(monthTxns),
        expenses: this.totalExpenses(monthTxns),
      });
    }
    return result;
  },

  /** Overall Monthly Budget usage calculated from budgets or preference limit */
  overallBudgetUsage(month, year, transactions, limit = 50000) {
    const monthTxns = this.forMonth(transactions, month, year);
    const spent = this.totalExpenses(monthTxns);
    const remaining = Math.max(0, limit - spent);
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return { spent, limit, remaining, percentage };
  },

  /**
   * Budget usage for a given budget.
   * Returns { spent, remaining, percentage, status, statusClass }
   */
  budgetUsage(budget, transactions) {
    const monthTxns = this.forMonth(transactions, budget.month, budget.year);
    const spent = monthTxns
      .filter(t => t.type === 'expense' && t.category === budget.category)
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = budget.monthlyLimit - spent;
    const percentage = budget.monthlyLimit > 0
      ? Number(((spent / budget.monthlyLimit) * 100).toFixed(1))
      : 0;

    let status = 'Within Budget';
    let statusClass = 'success';
    if (percentage >= 100) {
      status = 'Over Budget';
      statusClass = 'danger';
    } else if (percentage >= 75) {
      status = 'Near Limit';
      statusClass = 'warning';
    }

    return { spent, remaining, percentage, status, statusClass };
  },
};

// ==================== BUDGET SERVICE ====================

const BudgetService = {

  getAll() {
    return [...AppState.budgets].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  },

  getById(id) {
    return AppState.budgets.find(b => b.id === id) || null;
  },

  getBudgetsForMonth(month, year) {
    return AppState.budgets.filter(b => b.month === month && b.year === year);
  },

  async add(data) {
    const validation = Validator.validateBudget(data);
    if (!validation.valid) return { success: false, errors: validation.errors };

    // Check duplicate for same category/month/year
    const exists = AppState.budgets.find(
      b => b.category === data.category &&
           b.month === parseInt(data.month) &&
           b.year === parseInt(data.year)
    );
    if (exists) {
      return { success: false, errors: { category: 'A budget for this category and month already exists.' } };
    }

    const budget = createBudget(data);
    try {
      if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
        const res = await SupabaseBackend.budgets.create(budget);
        if (!res.success) {
          return { success: false, errors: { _general: res.error || 'Failed to save to cloud.' } };
        }
        AppState.budgets.push(res.data);
      } else {
        await DB.addBudget(budget);
        AppState.budgets.push(budget);
      }
      AppState.notify('budgets_changed');
      return { success: true, budget };
    } catch (err) {
      console.error('Failed to save budget:', err);
      return { success: false, errors: { _general: 'Failed to save. Please try again.' } };
    }
  },

  async update(id, data) {
    const validation = Validator.validateBudget(data);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const existing = AppState.budgets.find(b => b.id === id);
    if (!existing) return { success: false, errors: { _general: 'Budget not found.' } };

    // Check duplicate (excluding self)
    const dup = AppState.budgets.find(
      b => b.id !== id &&
           b.category === data.category &&
           b.month === parseInt(data.month) &&
           b.year === parseInt(data.year)
    );
    if (dup) {
      return { success: false, errors: { category: 'A budget for this category and month already exists.' } };
    }

    const updated = createBudget({ ...existing, ...data, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
    try {
      if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
        const res = await SupabaseBackend.budgets.update(id, updated);
        if (!res.success) {
          return { success: false, errors: { _general: res.error || 'Failed to update on cloud.' } };
        }
      } else {
        await DB.updateBudget(updated);
      }
      const idx = AppState.budgets.findIndex(b => b.id === id);
      if (idx !== -1) AppState.budgets[idx] = updated;
      AppState.notify('budgets_changed');
      return { success: true, budget: updated };
    } catch (err) {
      console.error('Failed to update budget:', err);
      return { success: false, errors: { _general: 'Failed to update. Please try again.' } };
    }
  },

  async delete(id) {
    try {
      if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
        const res = await SupabaseBackend.budgets.delete(id);
        if (!res.success) {
          return { success: false, errors: { _general: res.error || 'Failed to delete on cloud.' } };
        }
      } else {
        await DB.deleteBudget(id);
      }
      AppState.budgets = AppState.budgets.filter(b => b.id !== id);
      AppState.notify('budgets_changed');
      return { success: true };
    } catch (err) {
      console.error('Failed to delete budget:', err);
      return { success: false };
    }
  },
};

// ==================== PREFERENCE SERVICE ====================

const PreferenceService = {
  get(key) {
    return AppState.preferences[key] ?? DEFAULT_PREFERENCES[key];
  },

  async set(key, value) {
    AppState.preferences[key] = value;
    await DB.setPreference(key, value);
    AppState.notify('preferences_changed');
  },

  getCurrencyCode() {
    return AppState.preferences.currency || 'INR';
  },

  fmt(amount) {
    return formatCurrency(amount, this.getCurrencyCode());
  },
};

// ==================== CSV EXPORT & FORMULA INJECTION SANITIZATION ====================

function sanitizeCsvCell(val) {
  let str = String(val ?? '');
  // Mitigate CSV Formula Injection: =,+,-,@,\t,\r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function exportTransactionsCSV(transactions) {
  const headers = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Payment Method', 'Notes'];
  const rows = transactions.map(t => [
    sanitizeCsvCell(t.date),
    sanitizeCsvCell(t.title),
    sanitizeCsvCell(t.type),
    sanitizeCsvCell(getCategoryById(t.category).label),
    sanitizeCsvCell(t.amount.toFixed(2)),
    sanitizeCsvCell(t.paymentMethod),
    sanitizeCsvCell(t.note || ''),
  ]);

  // \uFEFF prepends UTF-8 Byte Order Mark for Excel compatibility
  const csv = '\uFEFF' + [headers.map(h => sanitizeCsvCell(h)).join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `finpulse_transactions_${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
