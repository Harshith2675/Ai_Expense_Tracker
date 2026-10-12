/**
 * app.js — Application Bootstrap & Event Handlers
 * Wires all UI elements to services, initialises the app, manages global events.
 */

// ==================== TRANSACTION FORM HANDLERS ====================

function getFormTransactionType() {
  const activeBtn = document.querySelector('.type-btn.active');
  return activeBtn ? activeBtn.dataset.type : 'expense';
}

function showFieldError(fieldId, errorId, message) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(errorId);
  if (field) field.classList.add('error');
  if (errEl) { errEl.textContent = message; errEl.classList.remove('hidden'); }
}

function clearFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(errorId);
  if (field) field.classList.remove('error');
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
}

function clearAllTransactionErrors() {
  ['amount', 'title', 'category', 'date'].forEach(f => clearFieldError(`tx-${f}`, `${f}-error`));
}

function applyTransactionErrors(errors) {
  const fieldMap = {
    amount: ['tx-amount', 'amount-error'],
    title: ['tx-title', 'title-error'],
    category: ['tx-category', 'category-error'],
    date: ['tx-date', 'date-error'],
  };
  Object.entries(errors).forEach(([field, msg]) => {
    if (fieldMap[field]) showFieldError(...fieldMap[field], msg);
  });
  if (errors._general) Toast.show(errors._general, 'error');
}

// ==================== INIT & BOOTSTRAP ====================

async function bootstrap() {
  // Initialize Supabase backend if configured
  if (typeof SupabaseBackend !== 'undefined') {
    await SupabaseBackend.init();
  }

  // Load data (from Supabase if online, else IndexedDB)
  await initAppState();

  // Apply theme
  applyTheme(PreferenceService.get('theme'));

  // Hide splash, show app
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      document.getElementById('main-app').classList.remove('hidden');
      Navigator.navigate('dashboard', { pushToStack: false });
    }, 500);
  }, 1600);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // system
    root.removeAttribute('data-theme');
  }
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // ---- Start app ----
  bootstrap();

  // ---- Subscribe to AppState changes ----
  AppState.subscribe((event) => {
    const current = Navigator._currentScreen;
    if (event === 'transactions_changed' || event === 'budgets_changed') {
      ScreenRenderer.render(current);
      // Also refresh dashboard if we're not on it (so next visit is fresh)
    }
    if (event === 'preferences_changed') {
      applyTheme(PreferenceService.get('theme'));
      ScreenRenderer.render(current);
    }
  });

  // ---- Bottom Navigation ----
  document.querySelectorAll('.nav-item[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'add-transaction') {
        AppState.editingTransactionId = null;
        Navigator.navigate('add-transaction');
      } else {
        Navigator.navigate(nav, { pushToStack: false });
      }
    });
  });

  // ---- Back Button ----
  document.getElementById('back-btn').addEventListener('click', () => Navigator.back());

  // ---- Header: Auth User Button ----
  document.getElementById('auth-header-btn')?.addEventListener('click', async () => {
    if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
      const user = SupabaseBackend.currentUser;
      const confirmed = await ConfirmDialog.show(
        'Sign Out',
        `You are logged in as ${user.email}. Do you want to sign out?`
      );
      if (confirmed) {
        await SupabaseBackend.auth.signOut();
        await initAppState();
        ScreenRenderer.render(Navigator._currentScreen);
        Toast.show('Signed out. Switched to local mode.', 'info');
      }
    } else {
      AuthDialog.show('signin');
    }
  });

  // ---- Header: Theme Toggle ----
  document.getElementById('theme-toggle-btn')?.addEventListener('click', async () => {
    const curTheme = PreferenceService.get('theme');
    const newTheme = curTheme === 'dark' ? 'light' : 'dark';
    await PreferenceService.set('theme', newTheme);
    applyTheme(newTheme);
    const prefSelect = document.getElementById('pref-theme');
    if (prefSelect) prefSelect.value = newTheme;
    Toast.show(`Switched to ${newTheme} mode`, 'info');
  });

  // ---- Settings Button ----
  document.getElementById('settings-btn').addEventListener('click', () => {
    Navigator.navigate('settings', { pushToStack: true });
  });

  // ---- Dashboard: Month Navigation ----
  document.getElementById('prev-month-btn').addEventListener('click', () => {
    if (AppState.dashboardMonth === 1) {
      AppState.dashboardMonth = 12;
      AppState.dashboardYear--;
    } else {
      AppState.dashboardMonth--;
    }
    ScreenRenderer.renderDashboard();
  });

  document.getElementById('next-month-btn').addEventListener('click', () => {
    if (AppState.dashboardMonth === 12) {
      AppState.dashboardMonth = 1;
      AppState.dashboardYear++;
    } else {
      AppState.dashboardMonth++;
    }
    ScreenRenderer.renderDashboard();
  });

  // ---- Dashboard: Quick Actions ----
  document.getElementById('qa-add-expense-btn')?.addEventListener('click', () => {
    AppState.pendingType = 'expense';
    AppState.editingTransactionId = null;
    Navigator.navigate('add-transaction');
  });

  document.getElementById('qa-add-income-btn')?.addEventListener('click', () => {
    AppState.pendingType = 'income';
    AppState.editingTransactionId = null;
    Navigator.navigate('add-transaction');
  });

  document.getElementById('qa-analytics-btn')?.addEventListener('click', () => {
    Navigator.navigate('reports', { pushToStack: false });
  });

  document.getElementById('qa-budget-btn')?.addEventListener('click', () => {
    Navigator.navigate('budgets', { pushToStack: false });
  });

  document.getElementById('add-budget-link-btn')?.addEventListener('click', () => {
    AppState.editingBudgetId = null;
    Navigator.navigate('add-budget');
  });

  document.getElementById('edit-overall-budget-btn')?.addEventListener('click', () => {
    OverallBudgetDialog.show();
  });

  // ---- Dashboard: View All & Manage Budget buttons ----
  document.getElementById('view-all-btn').addEventListener('click', () => {
    Navigator.navigate('transactions', { pushToStack: false });
  });

  document.getElementById('manage-budget-btn').addEventListener('click', () => {
    Navigator.navigate('budgets', { pushToStack: false });
  });

  // ---- Transaction Type Toggle ----
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      // Re-populate categories for type
      const selectedCat = document.getElementById('tx-category').value;
      populateCategorySelect('tx-category', type, selectedCat);
    });
  });

  // ---- Save Transaction ----
  let isSaving = false;
  document.getElementById('save-transaction-btn').addEventListener('click', async () => {
    if (isSaving) return;
    isSaving = true;

    clearAllTransactionErrors();

    const data = {
      type: getFormTransactionType(),
      amount: document.getElementById('tx-amount').value,
      title: document.getElementById('tx-title').value,
      category: document.getElementById('tx-category').value,
      date: document.getElementById('tx-date').value,
      paymentMethod: document.getElementById('tx-payment').value,
      note: document.getElementById('tx-notes').value,
    };

    const editId = AppState.editingTransactionId;
    let result;
    if (editId) {
      result = await TransactionService.update(editId, data);
    } else {
      result = await TransactionService.add(data);
    }

    if (result.success) {
      AppState.editingTransactionId = null;
      Toast.show(editId ? 'Transaction updated! ✓' : 'Transaction saved! ✓', 'success');
      Navigator.navigate('dashboard', { pushToStack: false });
    } else {
      applyTransactionErrors(result.errors);
    }

    setTimeout(() => { isSaving = false; }, 500);
  });

  // ---- Cancel Transaction ----
  document.getElementById('cancel-transaction-btn').addEventListener('click', () => {
    AppState.editingTransactionId = null;
    Navigator.back();
  });

  // ---- Transactions: Search, Sort & Filters ----
  document.getElementById('search-input').addEventListener('input', () => {
    ScreenRenderer._applyTransactionFilters();
  });

  document.getElementById('sort-transactions')?.addEventListener('change', () => {
    ScreenRenderer._applyTransactionFilters();
  });

  document.getElementById('filter-toggle-btn').addEventListener('click', () => {
    const panel = document.getElementById('filter-panel');
    const btn = document.getElementById('filter-toggle-btn');
    panel.classList.toggle('hidden');
    btn.classList.toggle('active');
  });

  ['filter-type', 'filter-category', 'filter-month'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      ScreenRenderer._applyTransactionFilters();
    });
  });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    document.getElementById('sort-transactions').value = 'newest';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-category').value = 'all';
    document.getElementById('filter-month').value = 'all';
    ScreenRenderer._applyTransactionFilters();
  });

  // ---- Analytics: Filter Pills & Custom Range ----
  document.querySelectorAll('.analytics-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.analytics-filter-pill').forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
      const filter = pill.dataset.filter;
      const customCard = document.getElementById('custom-range-card');
      if (filter === 'custom') {
        if (customCard) customCard.classList.remove('hidden');
      } else {
        if (customCard) customCard.classList.add('hidden');
        ScreenRenderer._renderReportForFilter(filter);
      }
    });
  });

  document.getElementById('apply-custom-range-btn')?.addEventListener('click', () => {
    const s = document.getElementById('custom-start-date')?.value;
    const e = document.getElementById('custom-end-date')?.value;
    if (!s || !e) {
      Toast.show('Please select both From and To dates', 'error');
      return;
    }
    if (new Date(s) > new Date(e)) {
      Toast.show('Start date cannot be after end date', 'error');
      return;
    }
    ScreenRenderer._renderReportForFilter('custom');
  });

  // ---- Demo Mode Controls ----
  document.getElementById('load-demo-data-btn')?.addEventListener('click', async () => {
    if (typeof DemoDataManager !== 'undefined') {
      const res = await DemoDataManager.load();
      Toast.show(`Loaded ${res.transactionsLoaded} demo transactions! ✓`, 'success');
      ScreenRenderer.renderReports();
      ScreenRenderer.renderDashboard();
    }
  });

  document.getElementById('clear-demo-data-btn')?.addEventListener('click', async () => {
    if (typeof DemoDataManager !== 'undefined') {
      const res = await DemoDataManager.clear();
      Toast.show(`Cleared ${res.removedCount} demo transactions! ✓`, 'info');
      ScreenRenderer.renderReports();
      ScreenRenderer.renderDashboard();
    }
  });

  // ---- Category Sort Selector ----
  document.getElementById('category-sort-select')?.addEventListener('change', () => {
    const activeFilterBtn = document.querySelector('.analytics-filter-pill.active');
    const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'this-month';
    ScreenRenderer._renderReportForFilter(filter);
  });

  // ---- Category Drill-Down Modal Close Handlers ----
  const closeCatDrilldown = () => {
    document.getElementById('category-drilldown-overlay')?.classList.add('hidden');
  };
  document.getElementById('close-cat-drilldown-btn')?.addEventListener('click', closeCatDrilldown);
  document.getElementById('cat-drilldown-close-btn')?.addEventListener('click', closeCatDrilldown);
  document.getElementById('category-drilldown-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'category-drilldown-overlay') closeCatDrilldown();
  });

  // ---- Legacy Reports: Period Tabs (Fallback) ----
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      ScreenRenderer._renderReportForPeriod(tab.dataset.period);
    });
  });

  // ---- Reports: Export CSV ----
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const txns = TransactionService.getAll();
    if (txns.length === 0) { Toast.show('No transactions to export', 'info'); return; }
    exportTransactionsCSV(txns);
    Toast.show('Export started!', 'success');
  });

  // ---- Budgets: Add ----
  document.getElementById('add-budget-btn').addEventListener('click', () => {
    AppState.editingBudgetId = null;
    Navigator.navigate('add-budget');
  });

  // ---- Save Budget ----
  let isSavingBudget = false;
  document.getElementById('save-budget-btn').addEventListener('click', async () => {
    if (isSavingBudget) return;
    isSavingBudget = true;

    const data = {
      category: document.getElementById('budget-category').value,
      monthlyLimit: document.getElementById('budget-amount').value,
      month: document.getElementById('budget-month').value,
      year: document.getElementById('budget-year').value,
    };

    const editId = AppState.editingBudgetId;
    let result;
    if (editId) {
      result = await BudgetService.update(editId, data);
    } else {
      result = await BudgetService.add(data);
    }

    if (result.success) {
      AppState.editingBudgetId = null;
      Toast.show(editId ? 'Budget updated! ✓' : 'Budget saved! ✓', 'success');
      Navigator.navigate('budgets', { pushToStack: false });
    } else {
      // Show errors
      const errMap = result.errors || {};
      if (errMap.category) showFieldError('budget-category', 'budget-category-error', errMap.category);
      if (errMap.monthlyLimit) showFieldError('budget-amount', 'budget-amount-error', errMap.monthlyLimit);
      if (errMap._general) Toast.show(errMap._general, 'error');
    }

    setTimeout(() => { isSavingBudget = false; }, 500);
  });

  // ---- Cancel Budget ----
  document.getElementById('cancel-budget-btn').addEventListener('click', () => {
    AppState.editingBudgetId = null;
    Navigator.back();
  });

  // ---- Settings: Segmented Navigation ----
  document.querySelectorAll('#settings-segmented-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settings-segmented-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const prefsTab = document.getElementById('settings-tab-prefs');
      const budgetsTab = document.getElementById('settings-tab-budgets');
      if (tab === 'budgets') {
        if (prefsTab) prefsTab.classList.add('hidden');
        if (budgetsTab) budgetsTab.classList.remove('hidden');
      } else {
        if (budgetsTab) budgetsTab.classList.add('hidden');
        if (prefsTab) prefsTab.classList.remove('hidden');
      }
    });
  });

  document.getElementById('settings-edit-overall-budget-btn')?.addEventListener('click', () => {
    OverallBudgetDialog.show();
  });

  document.getElementById('settings-add-budget-btn')?.addEventListener('click', () => {
    AppState.editingBudgetId = null;
    Navigator.navigate('add-budget');
  });

  // ---- Settings: Currency ----
  document.getElementById('pref-currency').addEventListener('change', async (e) => {
    await PreferenceService.set('currency', e.target.value);
    Toast.show('Currency updated!', 'success');
  });

  // ---- Settings: Theme ----
  document.getElementById('pref-theme').addEventListener('change', async (e) => {
    await PreferenceService.set('theme', e.target.value);
    applyTheme(e.target.value);
    Toast.show('Theme updated!', 'success');
  });

  // ---- Settings: Budget Alerts ----
  document.getElementById('pref-budget-alerts')?.addEventListener('change', async (e) => {
    await PreferenceService.set('budgetAlerts', e.target.checked);
    Toast.show(`Budget alerts ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
  });

  // ---- Settings: Export All ----
  document.getElementById('export-all-btn').addEventListener('click', () => {
    const txns = TransactionService.getAll();
    if (txns.length === 0) { Toast.show('No transactions to export', 'info'); return; }
    exportTransactionsCSV(txns);
    Toast.show('Export started!', 'success');
  });

  // ---- Settings: Clear Data ----
  document.getElementById('clear-data-btn').addEventListener('click', async () => {
    const confirmed = await ConfirmDialog.show(
      'Clear All Data',
      'This will permanently delete ALL transactions and budgets. This action cannot be undone. Are you sure?'
    );
    if (confirmed) {
      try {
        await DB.clearAllData();
        AppState.transactions = [];
        AppState.budgets = [];
        AppState.notify('transactions_changed');
        Toast.show('All data cleared', 'success');
        Navigator.navigate('dashboard', { pushToStack: false });
      } catch {
        Toast.show('Failed to clear data', 'error');
      }
    }
  });

  // ---- System color scheme change ----
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (PreferenceService.get('theme') === 'system') {
      ScreenRenderer.render(Navigator._currentScreen);
    }
  });

  // ---- Auth Modal Listeners ----
  document.getElementById('close-auth-modal-btn')?.addEventListener('click', () => AuthDialog.hide());
  document.getElementById('auth-tab-signin')?.addEventListener('click', () => AuthDialog.switchTab('signin'));
  document.getElementById('auth-tab-signup')?.addEventListener('click', () => AuthDialog.switchTab('signup'));
  document.getElementById('auth-submit-btn')?.addEventListener('click', () => AuthDialog.submit());
  document.getElementById('auth-guest-btn')?.addEventListener('click', () => {
    AuthDialog.hide();
    Toast.show('Continuing in Guest Mode', 'info');
  });
  document.getElementById('auth-forgot-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email')?.value.trim();
    if (!email) {
      AuthDialog.showError('Please enter your email address to receive password reset link.');
      return;
    }
    AuthDialog.setLoading(true);
    const res = await SupabaseBackend.auth.resetPassword(email);
    AuthDialog.setLoading(false);
    if (res.success) {
      AuthDialog.showSuccess('Password reset link sent! Please check your inbox.');
    } else {
      AuthDialog.showError(res.error || 'Failed to send reset link.');
    }
  });

  const authOverlay = document.getElementById('auth-modal-overlay');
  if (authOverlay) {
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) AuthDialog.hide();
    });
  }

  // ---- Settings: Cloud Auth Action Button ----
  document.getElementById('settings-auth-action-btn')?.addEventListener('click', async () => {
    if (typeof SupabaseBackend !== 'undefined' && SupabaseBackend.isOnlineMode()) {
      const confirmed = await ConfirmDialog.show('Sign Out', 'Are you sure you want to sign out?');
      if (confirmed) {
        await SupabaseBackend.auth.signOut();
        await initAppState();
        ScreenRenderer.render(Navigator._currentScreen);
        Toast.show('Signed out successfully', 'info');
      }
    } else {
      AuthDialog.show('signin');
    }
  });

  // ---- Settings: Supabase Config Modal Listeners ----
  document.getElementById('configure-supabase-btn')?.addEventListener('click', () => SupabaseConfigDialog.show());
  document.getElementById('cancel-supabase-config-btn')?.addEventListener('click', () => SupabaseConfigDialog.hide());
  document.getElementById('save-supabase-config-btn')?.addEventListener('click', () => SupabaseConfigDialog.save());

  const cfgOverlay = document.getElementById('supabase-config-overlay');
  if (cfgOverlay) {
    cfgOverlay.addEventListener('click', (e) => {
      if (e.target === cfgOverlay) SupabaseConfigDialog.hide();
    });
  }

  // ---- Keyboard back gesture ----
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('confirm-overlay');
      if (!overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
        return;
      }
      const back = document.getElementById('back-btn');
      if (!back.classList.contains('hidden')) Navigator.back();
    }
  });
});
