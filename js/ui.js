/**
 * ui.js — Presentation Layer
 * Renders all screens, handles user interactions, navigation.
 * All UI functions read from AppState (single source of truth).
 */

// ==================== TOAST ====================
const Toast = {
  _timer: null,
  show(message, type = 'success', duration = 2800) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast show ${type}`;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      el.className = 'toast';
    }, duration);
  },
};

// ==================== CONFIRM DIALOG ====================
const ConfirmDialog = {
  show(title, message) {
    return new Promise((resolve) => {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      const overlay = document.getElementById('confirm-overlay');
      overlay.classList.remove('hidden');

      const ok = document.getElementById('confirm-ok-btn');
      const cancel = document.getElementById('confirm-cancel-btn');

      function cleanup(result) {
        overlay.classList.add('hidden');
        ok.replaceWith(ok.cloneNode(true));
        cancel.replaceWith(cancel.cloneNode(true));
        resolve(result);
      }

      document.getElementById('confirm-ok-btn').addEventListener('click', () => cleanup(true), { once: true });
      document.getElementById('confirm-cancel-btn').addEventListener('click', () => cleanup(false), { once: true });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); }, { once: true });
    });
  },
};

// ==================== NAVIGATION ====================
const Navigator = {
  _currentScreen: 'dashboard',
  _stack: [],        // screen history for back navigation
  _navScreens: ['dashboard', 'transactions', 'reports', 'budgets'],

  navigate(screen, opts = {}) {
    const { pushToStack = true, title = null } = opts;
    const prev = this._currentScreen;

    // Deactivate all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('bottom-nav').style.display = 'flex';

    const screenEl = document.getElementById(`screen-${screen}`);
    if (!screenEl) { console.warn(`Screen not found: screen-${screen}`); return; }

    screenEl.classList.add('active');
    this._currentScreen = screen;

    // Update nav
    const navBtn = document.querySelector(`.nav-item[data-nav="${screen}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Update header
    const titles = {
      dashboard: 'Dashboard',
      transactions: 'Transactions',
      'add-transaction': AppState.editingTransactionId ? 'Edit Transaction' : 'Add Transaction',
      reports: 'Reports & Analytics',
      budgets: 'Budgets',
      'add-budget': AppState.editingBudgetId ? 'Edit Budget' : 'Add Budget',
      settings: 'Settings',
    };
    document.getElementById('page-title').textContent = title || titles[screen] || screen;

    // Back button
    const backBtn = document.getElementById('back-btn');
    const isSubScreen = !this._navScreens.includes(screen);
    backBtn.classList.toggle('hidden', !isSubScreen);

    // Settings button visibility
    document.getElementById('settings-btn').style.display = screen === 'settings' ? 'none' : 'flex';

    // Push to stack if it's a sub-screen
    if (pushToStack && isSubScreen) {
      this._stack.push(prev);
    } else if (!isSubScreen) {
      this._stack = [];
    }

    // Trigger screen render
    ScreenRenderer.render(screen);
  },

  back() {
    const prev = this._stack.pop();
    if (prev) {
      this.navigate(prev, { pushToStack: false });
    } else {
      this.navigate('dashboard', { pushToStack: false });
    }
  },
};

// ==================== SCREEN RENDERER ====================
const ScreenRenderer = {
  render(screen) {
    switch (screen) {
      case 'dashboard':       this.renderDashboard(); break;
      case 'transactions':    this.renderTransactions(); break;
      case 'add-transaction': this.renderAddTransactionForm(); break;
      case 'reports':         this.renderReports(); break;
      case 'budgets':         this.renderBudgets(); break;
      case 'add-budget':      this.renderAddBudgetForm(); break;
      case 'settings':        this.renderSettings(); break;
    }
  },

  // ============ DASHBOARD ============
  renderDashboard() {
    const { dashboardMonth: month, dashboardYear: year } = AppState;

    // Greeting & Date
    const now = new Date();
    const hour = now.getHours();
    let greet = 'Good morning 👋';
    if (hour >= 12 && hour < 17) greet = 'Good afternoon 👋';
    else if (hour >= 17) greet = 'Good evening 👋';
    const greetEl = document.getElementById('greeting-title');
    if (greetEl) greetEl.textContent = greet;

    const dateEl = document.getElementById('greeting-date');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
    }

    // Month label
    document.getElementById('current-month-label').textContent =
      `${MONTH_NAMES[month - 1]} ${year}`;

    const allTxns = TransactionService.getAll();
    const monthTxns = Calculator.forMonth(allTxns, month, year);

    const income = Calculator.totalIncome(monthTxns);
    const expenses = Calculator.totalExpenses(monthTxns);
    const balance = income - expenses;

    document.getElementById('current-balance').textContent = PreferenceService.fmt(balance);
    document.getElementById('total-income').textContent = PreferenceService.fmt(income);
    document.getElementById('total-expenses').textContent = PreferenceService.fmt(expenses);

    // Color balance
    const balEl = document.getElementById('current-balance');
    balEl.style.color = balance < 0 ? '#fca5a5' : 'white';

    // Overall Monthly Budget Hero Card
    const overallLimit = PreferenceService.get('monthlyBudget') || 50000;
    const mbSpentEl = document.getElementById('mb-spent');
    const mbLimitEl = document.getElementById('mb-limit');
    const mbRemEl = document.getElementById('mb-remaining');
    const mbBarEl = document.getElementById('mb-progress-bar');
    const mbBadgeEl = document.getElementById('mb-badge');

    if (mbSpentEl && mbLimitEl && mbRemEl && mbBarEl && mbBadgeEl) {
      const usage = Calculator.overallBudgetUsage(month, year, allTxns, overallLimit);
      mbSpentEl.textContent = PreferenceService.fmt(usage.spent);
      mbLimitEl.textContent = PreferenceService.fmt(overallLimit);
      mbRemEl.textContent = PreferenceService.fmt(usage.remaining);
      mbBarEl.style.width = `${Math.min(usage.percentage, 100)}%`;

      if (usage.percentage >= 100) {
        mbBarEl.className = 'mb-progress-bar danger';
        mbBadgeEl.className = 'mb-badge danger';
        mbBadgeEl.textContent = 'Exceeded';
        mbRemEl.className = 'mb-stat-val exceeded';
      } else if (usage.percentage >= 80) {
        mbBarEl.className = 'mb-progress-bar warning';
        mbBadgeEl.className = 'mb-badge warning';
        mbBadgeEl.textContent = 'Near Limit';
        mbRemEl.className = 'mb-stat-val remaining';
      } else {
        mbBarEl.className = 'mb-progress-bar safe';
        mbBadgeEl.className = 'mb-badge safe';
        mbBadgeEl.textContent = 'Safe';
        mbRemEl.className = 'mb-stat-val remaining';
      }
    }

    // Category Budgets overview (for current month)
    this.renderBudgetOverview(month, year);

    // Category chart
    const breakdown = Calculator.categoryBreakdown(monthTxns);
    Charts.renderCategoryChart(breakdown);

    // Income vs Expense bar chart (last 6 months)
    const trend = Calculator.monthlyTrend(allTxns, 6);
    Charts.renderIncomeExpenseChart(trend);

    // Recent transactions (last 5)
    const recent = allTxns.slice(0, 5);
    const container = document.getElementById('recent-transactions');
    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M12 8v4l3 3"/></svg>
          <p>No transactions yet</p>
          <span>Tap + Expense to record your first transaction</span>
        </div>`;
    } else {
      container.innerHTML = recent.map(t => renderTransactionItem(t, false)).join('');
      attachTransactionItemListeners(container, false);
    }
  },

  renderBudgetOverview(month, year) {
    const container = document.getElementById('budget-overview-container');
    const budgets = BudgetService.getBudgetsForMonth(month, year);
    const txns = TransactionService.getAll();

    if (budgets.length === 0) {
      container.innerHTML = `
        <div class="empty-budget-msg">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg>
          <p>No category budgets set for this month. <button class="link-btn" id="add-budget-link-btn">Add one</button></p>
        </div>`;
      document.getElementById('add-budget-link-btn')?.addEventListener('click', () => {
        AppState.editingBudgetId = null;
        Navigator.navigate('add-budget');
      });
      return;
    }

    container.innerHTML = budgets.map(b => {
      const { spent, remaining, percentage } = Calculator.budgetUsage(b, txns);
      const cat = getCategoryById(b.category);
      const isWarning = percentage >= 80 && percentage < 100;
      const isDanger = percentage >= 100;
      const fillClass = isDanger ? 'danger' : isWarning ? 'warning' : '';
      const badge = isDanger
        ? `<span class="budget-danger-badge">Over Budget</span>`
        : isWarning
          ? `<span class="budget-warning-badge">Near Limit</span>`
          : '';

      return `
        <div class="budget-card">
          <div class="budget-card-header">
            <span class="budget-category-name">${cat.emoji} ${cat.label}</span>
            <div class="budget-amounts">
              <div class="budget-spent">${PreferenceService.fmt(spent)} spent</div>
              <div class="budget-limit">of ${PreferenceService.fmt(b.monthlyLimit)}</div>
            </div>
          </div>
          <div class="budget-progress-bar">
            <div class="budget-progress-fill ${fillClass}" style="width:${Math.min(percentage, 100)}%"></div>
          </div>
          <div class="budget-footer">
            <span class="budget-remaining">
              ${remaining >= 0 ? `${PreferenceService.fmt(remaining)} remaining` : `${PreferenceService.fmt(Math.abs(remaining))} over`}
            </span>
            <div style="display:flex;align-items:center;gap:8px">
              ${badge}
              <span class="budget-percentage ${fillClass}">${percentage}%</span>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  // ============ TRANSACTIONS ============
  renderTransactions() {
    this._populateFilterOptions();
    this._applyTransactionFilters();
  },

  _populateFilterOptions() {
    // Category filter
    const catSel = document.getElementById('filter-category');
    const categories = ALL_CATEGORIES.filter(c => c.id !== 'overall');
    const currentCat = catSel.value;
    catSel.innerHTML = '<option value="all">All Categories</option>' +
      categories.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
    catSel.value = currentCat;

    // Month filter
    const monthSel = document.getElementById('filter-month');
    const txns = TransactionService.getAll();
    const months = new Set();
    txns.forEach(t => {
      if (t.date) {
        const d = new Date(t.date + 'T00:00:00');
        months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      }
    });
    const currentMonth = monthSel.value;
    monthSel.innerHTML = '<option value="all">All Months</option>' +
      [...months].sort().reverse().map(key => {
        const [y, m] = key.split('-');
        return `<option value="${key}">${MONTH_NAMES[parseInt(m) - 1]} ${y}</option>`;
      }).join('');
    monthSel.value = currentMonth;
  },

  _applyTransactionFilters() {
    const search = document.getElementById('search-input')?.value || '';
    const type = document.getElementById('filter-type')?.value || 'all';
    const category = document.getElementById('filter-category')?.value || 'all';
    const monthKey = document.getElementById('filter-month')?.value || 'all';
    const sort = document.getElementById('sort-transactions')?.value || 'newest';

    let month = 'all', year = null;
    if (monthKey !== 'all') {
      const [y, m] = monthKey.split('-');
      month = m;
      year = y;
    }

    const filtered = TransactionService.filter({ type, category, month, year, search, sort });
    const container = document.getElementById('transactions-list-container');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <p>No transactions found</p>
          <span>${search || type !== 'all' || category !== 'all' ? 'Try adjusting your filters.' : 'Add your first transaction!'}</span>
        </div>`;
      return;
    }

    // Group by date
    const groups = {};
    filtered.forEach(t => {
      const key = t.date || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const sortedDates = Object.keys(groups);
    if (sort === 'oldest') {
      sortedDates.sort((a, b) => new Date(a) - new Date(b));
    } else {
      sortedDates.sort((a, b) => new Date(b) - new Date(a));
    }

    let html = '';
    sortedDates.forEach(date => {
      const label = getDateGroupLabel(date);
      html += `<div class="date-group-header">${label}</div>`;
      html += groups[date].map(t => renderTransactionItem(t, true)).join('');
    });

    container.innerHTML = html;
    attachTransactionItemListeners(container, true);
  },

  // ============ ADD/EDIT TRANSACTION ============
  renderAddTransactionForm() {
    const editId = AppState.editingTransactionId;
    const existing = editId ? TransactionService.getById(editId) : null;

    // Reset form
    const form = {
      type: existing ? existing.type : (AppState.pendingType || 'expense'),
      amount: existing ? existing.amount : '',
      title: existing ? existing.title : '',
      category: existing ? existing.category : '',
      date: existing ? existing.date : todayISO(),
      paymentMethod: existing ? existing.paymentMethod : 'upi',
      notes: existing ? existing.note : '',
    };
    AppState.pendingType = null;

    // Set type toggle
    ['income', 'expense'].forEach(t => {
      const btn = document.getElementById(`type-${t}-btn`);
      if (btn) {
        btn.classList.toggle('active', form.type === t);
        btn.setAttribute('aria-pressed', form.type === t ? 'true' : 'false');
      }
    });

    // Populate categories
    populateCategorySelect('tx-category', form.type, form.category);

    // Set values
    document.getElementById('tx-amount').value = form.amount;
    document.getElementById('tx-title').value = form.title;
    document.getElementById('tx-date').value = form.date;
    document.getElementById('tx-payment').value = form.paymentMethod;
    document.getElementById('tx-notes').value = form.notes;

    // Clear errors
    ['amount', 'title', 'category', 'date'].forEach(f => {
      const el = document.getElementById(`${f}-error`);
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
    ['tx-amount', 'tx-title', 'tx-category', 'tx-date'].forEach(id => {
      document.getElementById(id)?.classList.remove('error');
    });

    // Update save button text
    document.getElementById('save-transaction-btn').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      ${editId ? 'Update Transaction' : 'Save Transaction'}`;
  },

  // ============ REPORTS & ANALYTICS ============
  renderReports() {
    const activeFilterBtn = document.querySelector('.analytics-filter-pill.active');
    const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'this-month';
    this._renderReportForFilter(filter);
  },

  _renderReportForFilter(filter) {
    const allTxns = TransactionService.getAll();
    const allBudgets = BudgetService.getAll();

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    let filtered = [];
    let previousEquivalentTxns = [];
    let periodLabelText = '';
    let trendPeriodType = 'monthly';
    let trendData = null;

    // Determine calendar boundaries based on filter
    if (filter === 'this-month') {
      filtered = Calculator.forMonth(allTxns, curMonth, curYear);
      previousEquivalentTxns = Calculator.forPreviousMonth(allTxns, curMonth, curYear);
      periodLabelText = `${MONTH_NAMES[curMonth - 1]} ${curYear}`;
      trendPeriodType = 'monthly';
      trendData = Calculator.dailyMonthTrendWithAverage(allTxns, curMonth, curYear);

      // Section titles
      document.getElementById('trend-section-title').textContent = 'Daily Spending Trend';
      document.getElementById('trend-section-sub').textContent = `${MONTH_NAMES[curMonth - 1]} with Daily Average`;
      document.getElementById('ti-label-1').textContent = 'Daily Average';
      document.getElementById('ti-val-1').textContent = PreferenceService.fmt(trendData.dailyAverage);
      document.getElementById('ti-label-2').textContent = 'Peak Day';
      document.getElementById('ti-val-2').textContent = trendData.highestAmount > 0
        ? `Day ${trendData.highestDay} (${PreferenceService.fmt(trendData.highestAmount)})`
        : '—';

    } else if (filter === 'last-3-months') {
      filtered = Calculator.forLast3Months(allTxns, now);
      previousEquivalentTxns = Calculator.forPrevious3Months(allTxns, now);

      const dStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      periodLabelText = `${SHORT_MONTH_NAMES[dStart.getMonth()]} ${dStart.getFullYear()} – ${SHORT_MONTH_NAMES[now.getMonth()]} ${curYear} (3 Months)`;
      trendPeriodType = 'three-month';
      trendData = Calculator.threeMonthTrend(allTxns, now);

      const expOnly = trendData.map(d => d.expenses);
      const avg3Mo = expOnly.length > 0 ? Math.round(expOnly.reduce((a, b) => a + b, 0) / expOnly.length) : 0;
      const peakItem = [...trendData].sort((a, b) => b.expenses - a.expenses)[0];

      document.getElementById('trend-section-title').textContent = '3-Month Spending Trend';
      document.getElementById('trend-section-sub').textContent = 'Consecutive Calendar Months Comparison';
      document.getElementById('ti-label-1').textContent = 'Monthly Average';
      document.getElementById('ti-val-1').textContent = PreferenceService.fmt(avg3Mo);
      document.getElementById('ti-label-2').textContent = 'Highest Month';
      document.getElementById('ti-val-2').textContent = peakItem && peakItem.expenses > 0
        ? `${peakItem.label} (${PreferenceService.fmt(peakItem.expenses)})`
        : '—';

    } else if (filter === 'this-year') {
      filtered = Calculator.forYear(allTxns, curYear);
      previousEquivalentTxns = Calculator.forYear(allTxns, curYear - 1);
      periodLabelText = `Jan – Dec ${curYear} (Yearly)`;
      trendPeriodType = 'yearly';
      trendData = Calculator.yearlyTrend(allTxns, curYear);

      document.getElementById('trend-section-title').textContent = `Annual Spending Trend (${curYear})`;
      document.getElementById('trend-section-sub').textContent = 'Jan–Dec with Monthly Average';
      document.getElementById('ti-label-1').textContent = 'Monthly Average';
      document.getElementById('ti-val-1').textContent = PreferenceService.fmt(trendData.averageMonthlyExpense);
      document.getElementById('ti-label-2').textContent = 'Peak / Lowest Month';
      document.getElementById('ti-val-2').textContent = trendData.highestMonth
        ? `${trendData.highestMonth.label} (${PreferenceService.fmt(trendData.highestMonth.expenses)})`
        : '—';

    } else if (filter === 'custom') {
      const s = document.getElementById('custom-start-date')?.value;
      const e = document.getElementById('custom-end-date')?.value;
      filtered = Calculator.forDateRange(allTxns, s, e);
      previousEquivalentTxns = [];
      periodLabelText = (s && e) ? `${s} to ${e}` : 'Custom Date Range';
      trendPeriodType = 'generic';
      trendData = Calculator.monthlyTrend(allTxns, 6);

      document.getElementById('trend-section-title').textContent = 'Spending Trend';
      document.getElementById('trend-section-sub').textContent = 'Recent Period Activity';
      document.getElementById('ti-label-1').textContent = 'Period Expenses';
      document.getElementById('ti-val-1').textContent = PreferenceService.fmt(Calculator.totalExpenses(filtered));
      document.getElementById('ti-label-2').textContent = 'Period Income';
      document.getElementById('ti-val-2').textContent = PreferenceService.fmt(Calculator.totalIncome(filtered));

    } else {
      // Fallback
      filtered = Calculator.forMonth(allTxns, curMonth, curYear);
      previousEquivalentTxns = Calculator.forPreviousMonth(allTxns, curMonth, curYear);
      periodLabelText = `${MONTH_NAMES[curMonth - 1]} ${curYear}`;
      trendPeriodType = 'monthly';
      trendData = Calculator.dailyMonthTrendWithAverage(allTxns, curMonth, curYear);
    }

    // Update Period Label
    const pLbl = document.getElementById('rpt-period-label');
    if (pLbl) pLbl.textContent = periodLabelText;

    // Check if demo data is currently loaded
    const hasDemoData = (typeof DemoDataManager !== 'undefined') && DemoDataManager.isLoaded();
    const liveTag = document.getElementById('rpt-active-data-tag');
    const loadDemoBtn = document.getElementById('load-demo-data-btn');
    const clearDemoBtn = document.getElementById('clear-demo-data-btn');
    const demoBannerText = document.getElementById('demo-banner-text');

    if (liveTag) {
      if (hasDemoData) {
        liveTag.className = 'live-data-badge demo';
        liveTag.textContent = 'DEMO DATA ACTIVE';
      } else {
        liveTag.className = 'live-data-badge';
        liveTag.textContent = 'Live Data';
      }
    }
    if (loadDemoBtn && clearDemoBtn) {
      loadDemoBtn.classList.toggle('hidden', hasDemoData);
      clearDemoBtn.classList.toggle('hidden', !hasDemoData);
      if (demoBannerText) {
        demoBannerText.textContent = hasDemoData
          ? 'Demo data loaded across 12 months with ₹34,500 budgets. Clear anytime.'
          : 'Realistic demo transactions available for analytics preview.';
      }
    }

    // -------------------------------------------------------------
    // CALCULATIONS FOR SUMMARY CARDS
    // -------------------------------------------------------------
    const totalIncome = Calculator.totalIncome(filtered);
    const totalExpenses = Calculator.totalExpenses(filtered);
    const totalSavings = totalIncome - totalExpenses;

    // Calculate Total Budget from configured category budgets for period:
    // If filter is 'this-month', sum of current month budgets.
    // If filter is 'last-3-months', sum of category budgets across the 3 months (or monthly budget * 3).
    // If filter is 'this-year', sum of annual budget limits (monthly budget * 12).
    const currentMonthBudgets = BudgetService.getBudgetsForMonth(curMonth, curYear);
    let categoryBudgetSum = currentMonthBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0);

    // If no budgets configured in DB yet, fallback to sum of default category limits (₹34,500)
    if (categoryBudgetSum === 0) {
      categoryBudgetSum = Object.values(DEFAULT_CATEGORY_LIMITS).reduce((a, b) => a + b, 0);
    }

    let totalBudgetForPeriod = categoryBudgetSum;
    if (filter === 'last-3-months') {
      totalBudgetForPeriod = categoryBudgetSum * 3;
    } else if (filter === 'this-year') {
      totalBudgetForPeriod = categoryBudgetSum * 12;
    }

    const remainingBudget = totalBudgetForPeriod - totalExpenses;
    const utilizationPct = totalBudgetForPeriod > 0
      ? Number(((totalExpenses / totalBudgetForPeriod) * 100).toFixed(1))
      : 0;

    // Update 6 Summary Cards
    // 1. Total Budget
    const bgtEl = document.getElementById('rpt-total-budget');
    if (bgtEl) bgtEl.textContent = PreferenceService.fmt(totalBudgetForPeriod);
    const bgtSub = document.getElementById('rpt-budget-sub');
    if (bgtSub) {
      bgtSub.textContent = filter === 'last-3-months'
        ? '3 months limit total'
        : filter === 'this-year'
          ? '12 months annual limit'
          : 'Configured category limits';
    }

    // 2. Total Amount Spent
    const spentEl = document.getElementById('rpt-total-spent');
    if (spentEl) spentEl.textContent = PreferenceService.fmt(totalExpenses);

    // MoM comparison pill
    const prevExpenses = Calculator.totalExpenses(previousEquivalentTxns);
    const diff = totalExpenses - prevExpenses;
    const momPill = document.getElementById('rpt-mom-pill');
    if (momPill) {
      if (previousEquivalentTxns.length === 0 && prevExpenses === 0) {
        momPill.className = 'comparison-pill neutral';
        momPill.textContent = 'Current period';
      } else {
        const pct = prevExpenses > 0 ? Math.round((Math.abs(diff) / prevExpenses) * 100) : (totalExpenses > 0 ? 100 : 0);
        if (diff > 0) {
          momPill.className = 'comparison-pill up';
          momPill.textContent = `+${pct}% vs prev period`;
        } else if (diff < 0) {
          momPill.className = 'comparison-pill down';
          momPill.textContent = `-${pct}% vs prev period`;
        } else {
          momPill.className = 'comparison-pill neutral';
          momPill.textContent = `0% vs prev period`;
        }
      }
    }

    // 3. Remaining Budget
    const remEl = document.getElementById('rpt-remaining-budget');
    const remSub = document.getElementById('rpt-remaining-sub');
    if (remEl) {
      remEl.textContent = PreferenceService.fmt(remainingBudget);
      remEl.className = remainingBudget < 0 ? 'bs-card-val spent' : 'bs-card-val remaining';
    }
    if (remSub) {
      if (remainingBudget < 0) {
        remSub.textContent = `Over budget by ${PreferenceService.fmt(Math.abs(remainingBudget))}`;
        remSub.style.color = 'var(--expense-color)';
      } else {
        remSub.textContent = `Within limit (${PreferenceService.fmt(remainingBudget)} left)`;
        remSub.style.color = '';
      }
    }

    // 4. Budget Utilization Percentage
    const utilEl = document.getElementById('rpt-budget-utilization');
    const utilBar = document.getElementById('rpt-utilization-bar');
    if (utilEl) utilEl.textContent = `${utilPct}%`;
    if (utilBar) {
      utilBar.style.width = `${Math.min(utilPct, 100)}%`;
      if (utilPct >= 100) {
        utilBar.className = 'bs-progress-fill danger';
      } else if (utilPct >= 75) {
        utilBar.className = 'bs-progress-fill warning';
      } else {
        utilBar.className = 'bs-progress-fill success';
      }
    }

    // 5. Total Income
    const incEl = document.getElementById('rpt-total-income');
    if (incEl) incEl.textContent = PreferenceService.fmt(totalIncome);

    // 6. Total Savings
    const savEl = document.getElementById('rpt-total-savings');
    const savSub = document.getElementById('rpt-savings-rate');
    if (savEl) {
      savEl.textContent = PreferenceService.fmt(totalSavings);
      savEl.className = totalSavings >= 0 ? 'bs-card-val savings' : 'bs-card-val spent';
    }
    if (savSub) {
      const rate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;
      savSub.textContent = `Savings Rate: ${rate}%`;
    }

    // -------------------------------------------------------------
    // 4. EXPENSE BREAKDOWN (DONUT CHART)
    // -------------------------------------------------------------
    const breakdown = Calculator.categoryBreakdown(filtered);
    const breakdownTotalTag = document.getElementById('breakdown-total-tag');
    if (breakdownTotalTag) breakdownTotalTag.textContent = `Total: ${PreferenceService.fmt(totalExpenses)}`;

    Charts.renderReportDonutChart(breakdown, (selectedCategory) => {
      // Highlight category in deep-dive list
      const targetCard = document.querySelector(`.cat-deepdive-card[data-category="${selectedCategory}"]`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.outline = '2px solid var(--primary)';
        setTimeout(() => { targetCard.style.outline = 'none'; }, 2000);
      }
    });

    // -------------------------------------------------------------
    // 5. SPENDING TREND ANALYSIS
    // -------------------------------------------------------------
    Charts.renderSpendingTrend(trendPeriodType, trendData);

    // -------------------------------------------------------------
    // 6. SPENDING BY CATEGORY (DEEP-DIVE ANALYSIS)
    // -------------------------------------------------------------
    const sortSelect = document.getElementById('category-sort-select');
    const sortBy = sortSelect ? sortSelect.value : 'highest';

    // Budgets to use for matching limits
    const relevantBudgets = (filter === 'this-month')
      ? currentMonthBudgets
      : currentMonthBudgets.map(b => ({
          ...b,
          monthlyLimit: filter === 'last-3-months' ? b.monthlyLimit * 3 : b.monthlyLimit * 12,
        }));

    const deepDiveList = Calculator.categoryDeepDive(
      filtered,
      previousEquivalentTxns,
      relevantBudgets,
      sortBy
    );

    const deepDiveContainer = document.getElementById('report-category-deepdive');
    if (deepDiveContainer) {
      if (deepDiveList.length === 0 || totalExpenses === 0) {
        deepDiveContainer.innerHTML = '<div class="empty-state"><p>No expense data in this period.</p></div>';
      } else {
        deepDiveContainer.innerHTML = deepDiveList.filter(item => item.total > 0 || item.budgetLimit !== null).map(item => {
          const changeText = item.changeType === 'increase'
            ? `<span style="color:#dc2626;font-weight:700;">+${item.changePercent}%</span>`
            : item.changeType === 'decrease'
              ? `<span style="color:#166534;font-weight:700;">${item.changePercent}%</span>`
              : item.changeType === 'new'
                ? `<span style="color:#2563eb;font-weight:700;">New</span>`
                : `<span style="color:var(--text-muted);">0%</span>`;

          const budgetInfo = item.budgetLimit !== null
            ? `
              <div class="cdd-budget-row">
                <div class="cdd-budget-info">
                  <span>Budget: ${PreferenceService.fmt(item.budgetLimit)} • Rem: ${PreferenceService.fmt(item.budgetRemaining)}</span>
                  <span class="budget-status-pill ${item.statusClass}">${item.status} (${item.budgetUtilization}%)</span>
                </div>
                <div class="bs-progress-track" style="margin-top:2px;">
                  <div class="bs-progress-fill ${item.statusClass}" style="width:${Math.min(item.budgetUtilization, 100)}%;"></div>
                </div>
              </div>`
            : '';

          return `
            <div class="cat-deepdive-card" data-category="${item.category}">
              <div class="cdd-top">
                <div class="cdd-title-wrap">
                  <div class="cdd-icon">${item.emoji}</div>
                  <div>
                    <div class="cdd-name">${item.label}</div>
                    <div class="cdd-share">${item.percentage}% of total expenses</div>
                  </div>
                </div>
                <div class="cdd-amount-wrap">
                  <div class="cdd-amount">${PreferenceService.fmt(item.total)}</div>
                  <div class="cdd-share">${item.count} txns</div>
                </div>
              </div>
              <div class="cdd-metrics-row">
                <div class="cdd-metric">
                  <span class="cdd-m-lbl">Avg / Tx</span>
                  <span class="cdd-m-val">${PreferenceService.fmt(item.average)}</span>
                </div>
                <div class="cdd-metric">
                  <span class="cdd-m-lbl">Change vs Prev</span>
                  <span class="cdd-m-val">${changeText}</span>
                </div>
                <div class="cdd-metric">
                  <span class="cdd-m-lbl">Prev Period</span>
                  <span class="cdd-m-val">${PreferenceService.fmt(item.prevTotal)}</span>
                </div>
              </div>
              ${budgetInfo}
            </div>`;
        }).join('');

        // Attach click handlers to open Category Drill-Down Modal
        deepDiveContainer.querySelectorAll('.cat-deepdive-card').forEach(card => {
          card.addEventListener('click', () => {
            const catId = card.dataset.category;
            const item = deepDiveList.find(d => d.category === catId);
            if (item) {
              ScreenRenderer.openCategoryDrilldownModal(item, periodLabelText);
            }
          });
        });
      }
    }
  },

  /**
   * Opens the Category Drill-Down Modal showing individual transactions
   */
  openCategoryDrilldownModal(item, periodLabel) {
    const overlay = document.getElementById('category-drilldown-overlay');
    if (!overlay) return;

    document.getElementById('cat-drilldown-icon').textContent = item.emoji;
    document.getElementById('cat-drilldown-title').textContent = item.label;
    document.getElementById('cat-drilldown-sub').textContent = `${periodLabel} • ${item.count} Transactions`;

    const statsBar = document.getElementById('cat-drilldown-stats');
    if (statsBar) {
      statsBar.innerHTML = `
        <div>
          <div class="cd-stat-val" style="color:var(--expense-color);">${PreferenceService.fmt(item.total)}</div>
          <div class="cd-stat-lbl">Total Spent</div>
        </div>
        <div>
          <div class="cd-stat-val">${item.percentage}%</div>
          <div class="cd-stat-lbl">Share</div>
        </div>
        <div>
          <div class="cd-stat-val">${PreferenceService.fmt(item.average)}</div>
          <div class="cd-stat-lbl">Average</div>
        </div>`;
    }

    const listEl = document.getElementById('cat-drilldown-txns-list');
    if (listEl) {
      if (!item.transactions || item.transactions.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No transactions in this period</p></div>';
      } else {
        const sortedTxns = [...item.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        listEl.innerHTML = sortedTxns.map(t => {
          const pm = (t.paymentMethod || 'upi').toUpperCase();
          const demoBadge = t.isDemo ? '<span class="tx-category-badge" style="background:#fef3c7;color:#92400e;">DEMO</span>' : '';
          return `
            <div class="transaction-item" style="padding:10px 12px;margin-bottom:6px;">
              <div class="tx-details">
                <div class="tx-title">${t.title}</div>
                <div class="tx-meta">${formatDisplayDate(t.date)} • ${pm} ${demoBadge}</div>
              </div>
              <div class="tx-amount-col">
                <div class="tx-amount expense">${PreferenceService.fmt(t.amount)}</div>
              </div>
            </div>`;
        }).join('');
      }
    }

    overlay.classList.remove('hidden');
  },

  // ============ BUDGETS ============
  renderBudgets() {
    const budgets = BudgetService.getAll();
    const txns = TransactionService.getAll();
    const container = document.getElementById('budgets-list');
    const settingsContainer = document.getElementById('settings-budgets-list');

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    // Calculate overall budget from configured category budgets rather than hardcoding
    const currentMonthBudgets = BudgetService.getBudgetsForMonth(curMonth, curYear);
    let totalCategoryLimit = currentMonthBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0);

    // If no budgets configured yet, fallback to default category limits sum (₹34,500)
    if (totalCategoryLimit === 0) {
      totalCategoryLimit = Object.values(DEFAULT_CATEGORY_LIMITS).reduce((a, b) => a + b, 0);
    }

    const overallUsage = Calculator.overallBudgetUsage(curMonth, curYear, txns, totalCategoryLimit);

    const bgtLimitEl = document.getElementById('bgt-screen-limit');
    const bgtSpentEl = document.getElementById('bgt-screen-spent');
    if (bgtLimitEl) bgtLimitEl.textContent = PreferenceService.fmt(totalCategoryLimit);
    if (bgtSpentEl) bgtSpentEl.textContent = PreferenceService.fmt(overallUsage.spent);

    // Also update dashboard monthly budget card if present
    const mbLimitEl = document.getElementById('mb-limit');
    const mbSpentEl = document.getElementById('mb-spent');
    const mbRemEl = document.getElementById('mb-remaining');
    const mbBar = document.getElementById('mb-progress-bar');
    const mbBadge = document.getElementById('mb-badge');

    if (mbLimitEl) mbLimitEl.textContent = PreferenceService.fmt(totalCategoryLimit);
    if (mbSpentEl) mbSpentEl.textContent = PreferenceService.fmt(overallUsage.spent);
    if (mbRemEl) mbRemEl.textContent = PreferenceService.fmt(overallUsage.remaining);
    if (mbBar) {
      mbBar.style.width = `${Math.min(overallUsage.percentage, 100)}%`;
      if (overallUsage.percentage >= 100) {
        mbBar.className = 'mb-progress-bar danger';
        if (mbBadge) { mbBadge.className = 'mb-badge danger'; mbBadge.textContent = 'Over Budget'; }
      } else if (overallUsage.percentage >= 75) {
        mbBar.className = 'mb-progress-bar warning';
        if (mbBadge) { mbBadge.className = 'mb-badge warning'; mbBadge.textContent = 'Near Limit'; }
      } else {
        mbBar.className = 'mb-progress-bar safe';
        if (mbBadge) { mbBadge.className = 'mb-badge safe'; mbBadge.textContent = 'Within Budget'; }
      }
    }

    const renderList = (targetEl) => {
      if (!targetEl) return;
      if (budgets.length === 0) {
        targetEl.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            <p>No category budgets created</p>
            <span>Set spending limits for individual categories</span>
          </div>`;
        return;
      }

      targetEl.innerHTML = budgets.map(b => {
        const { spent, remaining, percentage, status, statusClass } = Calculator.budgetUsage(b, txns);
        const cat = getCategoryById(b.category);

        const badge = statusClass === 'danger'
          ? `<span class="budget-danger-badge">Over Budget (${percentage}%)</span>`
          : statusClass === 'warning'
            ? `<span class="budget-warning-badge">⚠️ Near Limit (${percentage}%)</span>`
            : `<span class="budget-status-pill success">Within Budget (${percentage}%)</span>`;

        return `
          <div class="full-budget-card" data-budget-id="${b.id}">
            <div class="budget-card-top">
              <span class="budget-card-name">${cat.emoji} ${cat.label}</span>
              <span class="budget-card-period">${MONTH_NAMES[b.month - 1]} ${b.year}</span>
            </div>
            ${badge}
            <div class="budget-stats-row">
              <div class="bstat"><div class="bstat-label">Budget</div><div class="bstat-value">${PreferenceService.fmt(b.monthlyLimit)}</div></div>
              <div class="bstat"><div class="bstat-label">Spent</div><div class="bstat-value spent">${PreferenceService.fmt(spent)}</div></div>
              <div class="bstat"><div class="bstat-label">Remaining</div><div class="bstat-value remaining">${PreferenceService.fmt(remaining)}</div></div>
            </div>
            <div class="budget-progress-bar">
              <div class="budget-progress-fill ${statusClass}" style="width:${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="budget-footer">
              <span class="budget-remaining">${percentage}% of budget used</span>
            </div>
            <div class="budget-card-actions">
              <button class="budget-edit-btn" data-id="${b.id}" aria-label="Edit budget">✏️ Edit</button>
              <button class="budget-delete-btn" data-id="${b.id}" aria-label="Delete budget">🗑️ Delete</button>
            </div>
          </div>`;
      }).join('');

      targetEl.querySelectorAll('.budget-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          AppState.editingBudgetId = btn.dataset.id;
          Navigator.navigate('add-budget');
        });
      });

      targetEl.querySelectorAll('.budget-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const confirmed = await ConfirmDialog.show(
            'Delete Budget',
            'Are you sure you want to delete this budget? This cannot be undone.'
          );
          if (confirmed) {
            const result = await BudgetService.delete(btn.dataset.id);
            if (result.success) {
              Toast.show('Budget deleted', 'success');
            } else {
              Toast.show('Failed to delete budget', 'error');
            }
          }
        });
      });
    };

    renderList(container);
    renderList(settingsContainer);
  },

  // ============ ADD/EDIT BUDGET ============
  renderAddBudgetForm() {
    const editId = AppState.editingBudgetId;
    const existing = editId ? BudgetService.getById(editId) : null;
    const now = new Date();

    const form = {
      category: existing ? existing.category : '',
      monthlyLimit: existing ? existing.monthlyLimit : '',
      month: existing ? existing.month : now.getMonth() + 1,
      year: existing ? existing.year : now.getFullYear(),
    };

    // Populate expense categories only (budgets are for expenses)
    const catSel = document.getElementById('budget-category');
    catSel.innerHTML = '<option value="">Select category...</option>' +
      EXPENSE_CATEGORIES.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
    catSel.value = form.category;

    document.getElementById('budget-amount').value = form.monthlyLimit;
    document.getElementById('budget-month').value = form.month;
    document.getElementById('budget-year').value = form.year;

    // Clear errors
    ['category', 'amount'].forEach(f => {
      const el = document.getElementById(`budget-${f}-error`);
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });

    document.getElementById('save-budget-btn').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
      ${editId ? 'Update Budget' : 'Save Budget'}`;
  },

  // ============ SETTINGS ============
  renderSettings() {
    document.getElementById('pref-currency').value = PreferenceService.get('currency');
    document.getElementById('pref-theme').value = PreferenceService.get('theme');
    const alertsCheckbox = document.getElementById('pref-budget-alerts');
    if (alertsCheckbox) alertsCheckbox.checked = PreferenceService.get('budgetAlerts') ?? true;

    const overallLimit = PreferenceService.get('monthlyBudget') || 50000;
    const settingsLimitEl = document.getElementById('settings-overall-limit');
    if (settingsLimitEl) settingsLimitEl.textContent = PreferenceService.fmt(overallLimit);

    // Update Cloud & Auth Status
    const isOnline = typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode();
    const user = isOnline ? SupabaseBackend.currentUser : null;
    const authStatusLbl = document.getElementById('settings-auth-status-lbl');
    const authStatusDesc = document.getElementById('settings-auth-status-desc');
    const authActionBtn = document.getElementById('settings-auth-action-btn');
    const backendStatusDesc = document.getElementById('settings-backend-status-desc');
    const userBadgeText = document.getElementById('user-badge-text');

    if (isOnline && user) {
      if (authStatusLbl) authStatusLbl.textContent = 'Account Status';
      if (authStatusDesc) authStatusDesc.textContent = `Logged in as ${user.email}`;
      if (authActionBtn) {
        authActionBtn.textContent = 'Sign Out';
        authActionBtn.className = 'settings-action-btn danger-btn';
      }
      if (userBadgeText) userBadgeText.textContent = `👤 ${user.email.split('@')[0]}`;
    } else {
      if (authStatusLbl) authStatusLbl.textContent = 'Account Status';
      if (authStatusDesc) authStatusDesc.textContent = 'Guest Mode (Local Offline Storage)';
      if (authActionBtn) {
        authActionBtn.textContent = 'Sign In';
        authActionBtn.className = 'settings-action-btn';
      }
      if (userBadgeText) userBadgeText.textContent = '👤 Guest';
    }

    if (backendStatusDesc) {
      const isConfigured = typeof AppConfig !== 'undefined' && AppConfig.isSupabaseConfigured();
      backendStatusDesc.textContent = isConfigured ? 'Connected to Supabase Project' : 'Not configured (tap to set URL & key)';
    }

    this.renderBudgets();
  },
};

// ==================== TRANSACTION DETAIL DIALOG ====================

const TransactionDetailDialog = {
  show(tx) {
    const cat = getCategoryById(tx.category);
    const pm = getPaymentMethodById(tx.paymentMethod);
    const isIncome = tx.type === 'income';

    const badge = document.getElementById('tx-detail-badge');
    if (badge) {
      badge.textContent = isIncome ? 'Income' : 'Expense';
      badge.style.background = isIncome ? '#dcfce7' : '#fee2e2';
      badge.style.color = isIncome ? '#166534' : '#dc2626';
    }

    const amtEl = document.getElementById('tx-detail-amount');
    if (amtEl) {
      amtEl.textContent = `${isIncome ? '+' : '-'}${PreferenceService.fmt(tx.amount)}`;
      amtEl.style.color = isIncome ? '#166534' : '#dc2626';
    }

    const titleEl = document.getElementById('tx-detail-title');
    if (titleEl) titleEl.textContent = tx.title;

    const catEl = document.getElementById('tx-detail-category');
    if (catEl) catEl.textContent = `${cat.emoji} ${cat.label}`;

    const dateEl = document.getElementById('tx-detail-date');
    if (dateEl) dateEl.textContent = formatDate(tx.date);

    const pmEl = document.getElementById('tx-detail-payment');
    if (pmEl) pmEl.textContent = `${pm.emoji} ${pm.label}`;

    const notesWrap = document.getElementById('tx-detail-notes-wrap');
    const notesEl = document.getElementById('tx-detail-notes');
    if (notesWrap && notesEl) {
      if (tx.note && tx.note.trim()) {
        notesEl.textContent = tx.note;
        notesWrap.classList.remove('hidden');
      } else {
        notesWrap.classList.add('hidden');
      }
    }

    const overlay = document.getElementById('tx-detail-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    // Edit handler
    const editBtn = document.getElementById('tx-detail-edit-btn');
    if (editBtn) {
      const newEditBtn = editBtn.cloneNode(true);
      editBtn.replaceWith(newEditBtn);
      newEditBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        AppState.editingTransactionId = tx.id;
        Navigator.navigate('add-transaction');
      });
    }

    // Delete handler
    const delBtn = document.getElementById('tx-detail-delete-btn');
    if (delBtn) {
      const newDelBtn = delBtn.cloneNode(true);
      delBtn.replaceWith(newDelBtn);
      newDelBtn.addEventListener('click', async () => {
        overlay.classList.add('hidden');
        const confirmed = await ConfirmDialog.show('Delete Transaction', `Are you sure you want to delete "${tx.title}"?`);
        if (confirmed) {
          const res = await TransactionService.delete(tx.id);
          if (res.success) {
            Toast.show('Transaction deleted', 'success');
          } else {
            Toast.show('Failed to delete transaction', 'error');
          }
        }
      });
    }

    // Close handler
    const closeBtn = document.getElementById('close-tx-detail-btn');
    if (closeBtn) {
      const newCloseBtn = closeBtn.cloneNode(true);
      closeBtn.replaceWith(newCloseBtn);
      newCloseBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
      });
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    };
  },
};

// ==================== OVERALL BUDGET MODAL ====================

const OverallBudgetDialog = {
  show() {
    const overlay = document.getElementById('overall-budget-overlay');
    const input = document.getElementById('overall-budget-input');
    if (!overlay || !input) return;

    input.value = PreferenceService.get('monthlyBudget') || 50000;
    overlay.classList.remove('hidden');

    const saveBtn = document.getElementById('save-overall-budget-btn');
    const cancelBtn = document.getElementById('cancel-overall-budget-btn');

    const newSave = saveBtn.cloneNode(true);
    saveBtn.replaceWith(newSave);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancel);

    newCancel.addEventListener('click', () => overlay.classList.add('hidden'));

    newSave.addEventListener('click', async () => {
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) {
        Toast.show('Enter a valid monthly budget limit', 'error');
        return;
      }
      await PreferenceService.set('monthlyBudget', val);
      overlay.classList.add('hidden');
      Toast.show('Monthly budget limit updated! ✓', 'success');
    });

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    };
  },
};

// ==================== AUTH DIALOG ====================

const AuthDialog = {
  currentTab: 'signin',

  show(tab = 'signin') {
    const overlay = document.getElementById('auth-modal-overlay');
    if (!overlay) return;
    this.switchTab(tab);
    this.clearErrors();
    overlay.classList.remove('hidden');

    const emailInput = document.getElementById('auth-email');
    if (emailInput) setTimeout(() => emailInput.focus(), 50);
  },

  hide() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    this.clearErrors();
  },

  switchTab(tab) {
    this.currentTab = tab;
    const signinTab = document.getElementById('auth-tab-signin');
    const signupTab = document.getElementById('auth-tab-signup');
    const nameGroup = document.getElementById('auth-display-name-group');
    const forgotWrap = document.getElementById('auth-forgot-wrap');
    const submitText = document.getElementById('auth-submit-text');

    if (tab === 'signup') {
      signinTab?.classList.remove('active');
      signupTab?.classList.add('active');
      signinTab?.setAttribute('aria-selected', 'false');
      signupTab?.setAttribute('aria-selected', 'true');
      if (nameGroup) nameGroup.classList.remove('hidden');
      if (forgotWrap) forgotWrap.classList.add('hidden');
      if (submitText) submitText.textContent = 'Create Account';
    } else {
      signupTab?.classList.remove('active');
      signinTab?.classList.add('active');
      signupTab?.setAttribute('aria-selected', 'false');
      signinTab?.setAttribute('aria-selected', 'true');
      if (nameGroup) nameGroup.classList.add('hidden');
      if (forgotWrap) forgotWrap.classList.remove('hidden');
      if (submitText) submitText.textContent = 'Sign In';
    }
    this.clearErrors();
  },

  clearErrors() {
    const errBanner = document.getElementById('auth-error-banner');
    const succBanner = document.getElementById('auth-success-banner');
    if (errBanner) { errBanner.textContent = ''; errBanner.classList.add('hidden'); }
    if (succBanner) { succBanner.textContent = ''; succBanner.classList.add('hidden'); }
  },

  showError(msg) {
    const errBanner = document.getElementById('auth-error-banner');
    const succBanner = document.getElementById('auth-success-banner');
    if (succBanner) succBanner.classList.add('hidden');
    if (errBanner) {
      errBanner.textContent = msg;
      errBanner.classList.remove('hidden');
    }
  },

  showSuccess(msg) {
    const errBanner = document.getElementById('auth-error-banner');
    const succBanner = document.getElementById('auth-success-banner');
    if (errBanner) errBanner.classList.add('hidden');
    if (succBanner) {
      succBanner.textContent = msg;
      succBanner.classList.remove('hidden');
    }
  },

  setLoading(isLoading) {
    const spinner = document.getElementById('auth-spinner');
    const submitBtn = document.getElementById('auth-submit-btn');
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
    if (submitBtn) submitBtn.disabled = isLoading;
  },

  async submit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const displayName = document.getElementById('auth-display-name')?.value.trim() || '';

    if (!email) { this.showError('Email address is required.'); return; }
    if (!password || password.length < 6) { this.showError('Password must be at least 6 characters.'); return; }

    this.setLoading(true);
    this.clearErrors();

    if (this.currentTab === 'signup') {
      const res = await SupabaseBackend.auth.signUp(email, password, displayName);
      this.setLoading(false);
      if (res.success) {
        if (!res.session) {
          this.showSuccess('Registration successful! Please check your email inbox to verify your account.');
        } else {
          this.showSuccess('Account created and signed in! Syncing data...');
          setTimeout(async () => {
            this.hide();
            await initAppState();
            ScreenRenderer.render(Navigator._currentScreen);
            Toast.show('Welcome to FinPulse! ✓', 'success');
          }, 800);
        }
      } else {
        this.showError(res.error);
      }
    } else {
      const res = await SupabaseBackend.auth.signIn(email, password);
      this.setLoading(false);
      if (res.success) {
        this.showSuccess('Signed in successfully! Loading data...');
        setTimeout(async () => {
          this.hide();
          await initAppState();
          ScreenRenderer.render(Navigator._currentScreen);
          Toast.show('Signed in successfully! ✓', 'success');
        }, 600);
      } else {
        this.showError(res.error);
      }
    }
  }
};

// ==================== SUPABASE CONFIG DIALOG ====================

const SupabaseConfigDialog = {
  show() {
    const overlay = document.getElementById('supabase-config-overlay');
    if (!overlay) return;
    const urlInput = document.getElementById('cfg-supabase-url');
    const keyInput = document.getElementById('cfg-supabase-anon');
    if (urlInput) urlInput.value = AppConfig.getSupabaseUrl();
    if (keyInput) keyInput.value = AppConfig.getSupabaseAnonKey();
    overlay.classList.remove('hidden');
  },

  hide() {
    const overlay = document.getElementById('supabase-config-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  async save() {
    const url = document.getElementById('cfg-supabase-url').value.trim();
    const key = document.getElementById('cfg-supabase-anon').value.trim();

    if (url && !url.startsWith('http')) {
      Toast.show('URL must start with https://', 'error');
      return;
    }

    AppConfig.setSupabaseCredentials(url, key);
    this.hide();

    if (url && key) {
      Toast.show('Connecting to Supabase...', 'info');
      const initialized = await SupabaseBackend.init();
      if (initialized) {
        Toast.show('Connected to Supabase! You can now Sign In.', 'success');
      } else {
        Toast.show('Could not connect. Check credentials.', 'warning');
      }
    } else {
      Toast.show('Supabase credentials cleared. Switched to Guest mode.', 'info');
      SupabaseBackend.client = null;
      SupabaseBackend.currentUser = null;
    }

    ScreenRenderer.renderSettings();
  }
};

// ==================== HELPERS ====================

function renderTransactionItem(t, showActions) {
  const cat = getCategoryById(t.category);
  const sign = t.type === 'income' ? '+' : '-';
  const pm = getPaymentMethodById(t.paymentMethod);

  return `
    <div class="transaction-item slide-up" data-id="${t.id}" style="cursor: pointer;" title="Tap to view details">
      <div class="tx-icon-wrap ${t.type}">
        <span>${cat.emoji}</span>
      </div>
      <div class="tx-details">
        <div class="tx-title">${escapeHtml(t.title)}</div>
        <div class="tx-meta">
          <span class="tx-category-badge">${cat.label}</span>${pm.label}
          ${t.note ? ` · <em>${escapeHtml(t.note.substring(0, 30))}${t.note.length > 30 ? '…' : ''}</em>` : ''}
        </div>
      </div>
      <div class="tx-amount-col">
        <div class="tx-amount ${t.type}">${sign}${PreferenceService.fmt(t.amount)}</div>
        <div class="tx-date">${formatDate(t.date)}</div>
      </div>
      ${showActions ? `
      <div class="tx-actions">
        <button class="tx-action-btn edit" data-id="${t.id}" aria-label="Edit transaction">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="tx-action-btn delete" data-id="${t.id}" aria-label="Delete transaction">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>` : ''}
    </div>`;
}

function attachTransactionItemListeners(container, showActions) {
  // Clicking the item opens the detail modal
  container.querySelectorAll('.transaction-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const tx = TransactionService.getById(id);
      if (tx) TransactionDetailDialog.show(tx);
    });
  });

  if (showActions) {
    container.querySelectorAll('.tx-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.editingTransactionId = btn.dataset.id;
        Navigator.navigate('add-transaction');
      });
    });
    container.querySelectorAll('.tx-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await ConfirmDialog.show(
          'Delete Transaction',
          'Are you sure you want to delete this transaction? This cannot be undone.'
        );
        if (confirmed) {
          const result = await TransactionService.delete(btn.dataset.id);
          if (result.success) {
            Toast.show('Transaction deleted', 'success');
          } else {
            Toast.show('Failed to delete', 'error');
          }
        }
      });
    });
  }
}

function populateCategorySelect(selectId, type, selectedValue = '') {
  const select = document.getElementById(selectId);
  const cats = getCategoriesForType(type);
  select.innerHTML = '<option value="">Select category...</option>' +
    cats.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
  if (selectedValue) select.value = selectedValue;
}

function getDateGroupLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
