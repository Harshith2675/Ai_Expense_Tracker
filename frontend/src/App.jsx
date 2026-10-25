import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from './context/CurrencyContext';
import './App.css';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardView from './components/Views/DashboardView';
import TransactionsView from './components/Views/TransactionsView';
import BudgetView from './components/Views/BudgetView';
import AiInsightsView from './components/Views/AiInsightsView';
import AutoDetectionView from './components/Views/AutoDetectionView';
import ReportsView from './components/Views/ReportsView';
import SettingsView from './components/Views/SettingsView';
import AddExpensePage from './components/Views/AddExpensePage';
import AddIncomePage from './components/Views/AddIncomePage';
import {
  INITIAL_SUMMARY,
  INITIAL_TRANSACTIONS,
  CATEGORIES,
  MONTHLY_ANALYTICS_DATA,
  SPENDING_TREND_DATA,
  AI_INSIGHTS_SAMPLE,
} from './data/sampleData';
import {
  checkBackendHealth,
  fetchTransactions,
  fetchSummary,
  deleteTransaction as apiDeleteTransaction,
} from './services/apiService';
import { PlusCircle, TrendingUp, AlertTriangle, X, RefreshCw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────── App
export default function App() {
  const { symbol } = useCurrency();
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [theme, setTheme]               = useState('dark');
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [backendOnline, setBackendOnline] = useState(false);

  // ── Data ──
  // DB transactions (loaded from Flask) and sample transactions are kept separate.
  const [dbTransactions, setDbTransactions]         = useState([]);       // from API
  const [sampleTransactions, setSampleTransactions] = useState(INITIAL_TRANSACTIONS); // client/sample list
  const [usingDB, setUsingDB]                       = useState(false);    // true once API responded
  const [categories]                                = useState(CATEGORIES);
  const [insights]                          = useState(AI_INSIGHTS_SAMPLE);
  const [dbSummary, setDbSummary]           = useState(null);     // from /api/summary

  // ── UI state ──
  const [isLoading, setIsLoading]           = useState(false);
  const [simulatedError, setSimulatedError] = useState(false);
  const [dismissNotice, setDismissNotice]   = useState(false);
  const [apiError, setApiError]             = useState('');

  // ── Theme sync ──
  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  // ── Bootstrap: check backend + load transactions ──
  const loadFromBackend = useCallback(async () => {
    const health = await checkBackendHealth();
    const online = health?.status === 'healthy';
    setBackendOnline(online);

    if (!online) return;

    setIsLoading(true);
    const [txResult, summaryResult] = await Promise.all([
      fetchTransactions({ limit: 200 }),
      fetchSummary(),
    ]);
    setIsLoading(false);

    if (txResult?.data) {
      setDbTransactions(txResult.data);
      setUsingDB(true);
    }
    if (summaryResult) {
      setDbSummary(summaryResult);
    }
  }, []);

  useEffect(() => { loadFromBackend(); }, [loadFromBackend]);

  // ── Active transaction list: DB records when available, else sample ──
  const transactions = usingDB ? dbTransactions : sampleTransactions;

  // ── Live summary ──
  const computedSummary = useMemo(() => {
    if (usingDB && dbSummary) {
      return {
        totalIncome:           dbSummary.total_income,
        totalExpenses:         dbSummary.total_expenses,
        availableBalance:      dbSummary.available_balance,
        monthlyBudget:         dbSummary.monthly_budget,
        budgetPercent:         dbSummary.budget_used_percentage,
        savingsRate:           dbSummary.savings_rate_percentage,
        incomeChangePercent:   INITIAL_SUMMARY.incomeChangePercent,
        expenseChangePercent:  INITIAL_SUMMARY.expenseChangePercent,
        currency:              symbol,
      };
    }
    // Fallback: compute from local transaction list
    let income = 0, expense = 0;
    transactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      const type = (tx.type || tx.transaction_type || '').toLowerCase();
      if (type === 'income') income += amt;
      else expense += amt;
    });
    const monthlyBudget = INITIAL_SUMMARY.monthlyBudget;
    const balance       = income - expense;
    return {
      totalIncome:          income,
      totalExpenses:        expense,
      availableBalance:     balance,
      monthlyBudget,
      budgetPercent:        monthlyBudget > 0 ? Math.round((expense / monthlyBudget) * 1000) / 10 : 0,
      savingsRate:          income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 1000) / 10) : 0,
      incomeChangePercent:  INITIAL_SUMMARY.incomeChangePercent,
      expenseChangePercent: INITIAL_SUMMARY.expenseChangePercent,
      currency:             symbol,
    };
  }, [usingDB, dbSummary, transactions, symbol]);

  // ── Category spending ──
  const updatedCategories = useMemo(() =>
    categories.map(cat => {
      if (cat.type === 'income') return cat;
      const spent = transactions
        .filter(tx => {
          const type = (tx.type || tx.transaction_type || '').toLowerCase();
          return type === 'expense' && (tx.category || '').toLowerCase() === cat.name.toLowerCase();
        })
        .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
      return { ...cat, spent };
    }),
    [categories, transactions]
  );

  // ── Handlers ──
  const handleAddExpense = useCallback((newTx) => {
    if (usingDB) {
      setDbTransactions(prev => [newTx, ...prev]);
      // Refresh DB summary
      fetchSummary().then(s => { if (s) setDbSummary(s); });
    } else {
      setSampleTransactions(prev => [newTx, ...prev]);
    }
    setActiveTab('transactions');
  }, [usingDB]);

  const handleAddIncome = useCallback((newTx) => {
    if (usingDB) {
      setDbTransactions(prev => [newTx, ...prev]);
      fetchSummary().then(s => { if (s) setDbSummary(s); });
    } else {
      setSampleTransactions(prev => [newTx, ...prev]);
    }
    setActiveTab('transactions');
  }, [usingDB]);

  const handleDeleteTransaction = useCallback(async (id) => {
    if (usingDB && backendOnline && !String(id).startsWith('local-')) {
      const result = await apiDeleteTransaction(id);
      if (!result.ok) {
        setApiError(result.apiError || 'Delete failed');
        return;
      }
    }
    setDbTransactions(prev => prev.filter(t => t.id !== id));
    setSampleTransactions(prev => prev.filter(t => t.id !== id));
    if (usingDB) {
      fetchSummary().then(s => { if (s) setDbSummary(s); });
    }
  }, [usingDB, backendOnline]);

  const handleResetSampleData = () => {
    setSampleTransactions(INITIAL_TRANSACTIONS);
    setDbTransactions([]);
    setUsingDB(false);
    setDbSummary(null);
    setSimulatedError(false);
  };

  // ── Tab titles ──
  const tabTitles = {
    dashboard:       { title: 'Financial Dashboard',       subtitle: 'Real-time overview of income, expenditures, and telemetry' },
    transactions:    { title: 'Transaction History',        subtitle: 'Search, filter, and inspect your unified spending ledger' },
    'add-expense':   { title: 'Add Expense',                subtitle: 'Record a new expense transaction' },
    'add-income':    { title: 'Add Income',                 subtitle: 'Record a new income transaction' },
    'auto-detection':{ title: 'Automatic Detection',        subtitle: 'Transaction pattern matching and heuristic rules' },
    budget:          { title: 'Budget Management',          subtitle: 'Category thresholds, spending limits, and variance analysis' },
    'ai-insights':   { title: 'AI Insights & Forecasts',   subtitle: 'Machine learning heuristics for predictive spending' },
    reports:         { title: 'Financial Reports',          subtitle: 'Executive summaries and monthly breakdown' },
    settings:        { title: 'System Settings',            subtitle: 'Configure currency, UI appearance, and backend endpoints' },
  };
  const currentTabInfo = tabTitles[activeTab] || tabTitles.dashboard;

  // ── Sidebar nav items that open form pages ──
  const handleSidebarNav = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="app-container" id="app-root-container">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSidebarNav}
        onOpenAddExpense={() => setActiveTab('add-expense')}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main wrapper */}
      <div className="main-wrapper">
        <Topbar
          backendOnline={backendOnline}
          theme={theme}
          setTheme={setTheme}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setMobileOpen={setMobileOpen}
        />

        <main className="page-content" id="main-content-area">
          {/* Page Header — hide for dedicated form pages that have their own header */}
          {activeTab !== 'add-expense' && activeTab !== 'add-income' && (
            <div className="page-header">
              <div className="page-title-group">
                <h1>{currentTabInfo.title}</h1>
                <p>{currentTabInfo.subtitle}</p>
              </div>
              <div className="header-actions">
                <button
                  id="header-add-expense-btn"
                  className="btn btn-primary"
                  onClick={() => setActiveTab('add-expense')}
                >
                  <PlusCircle size={16} />
                  <span>Add Expense</span>
                </button>
                <button
                  id="header-add-income-btn"
                  className="btn btn-income"
                  onClick={() => setActiveTab('add-income')}
                >
                  <TrendingUp size={16} />
                  <span>Add Income</span>
                </button>
              </div>
            </div>
          )}

          {/* Data source banner */}
          {!dismissNotice && activeTab !== 'add-expense' && activeTab !== 'add-income' && (
            <div
              className={`demo-disclaimer-banner ${usingDB ? 'live-data' : ''}`}
              id="sample-data-disclaimer-banner"
            >
              <div className="demo-banner-content">
                <span className={`demo-tag ${usingDB ? 'tag-live' : ''}`}>
                  {usingDB ? 'Live DB' : 'Sample Data'}
                </span>
                <span>
                  {usingDB
                    ? <><strong>Connected to SQLite.</strong> All transactions shown are real database records.</>
                    : <><strong>Demo Mode:</strong> Displaying sample records. Connect the Flask backend to persist data.</>
                  }
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {backendOnline && (
                  <button
                    id="refresh-data-btn"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={loadFromBackend}
                    title="Refresh data from backend"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh</span>
                  </button>
                )}
                <button
                  id="dismiss-disclaimer-btn"
                  className="icon-button"
                  style={{ width: '28px', height: '28px' }}
                  onClick={() => setDismissNotice(true)}
                  title="Dismiss"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* API error banner */}
          {apiError && (
            <div className="error-banner" id="api-error-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} />
                <span><strong>API Error:</strong> {apiError}</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setApiError('')}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Simulated error banner */}
          {simulatedError && (
            <div className="error-banner" id="simulated-error-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} />
                <span><strong>Simulated Sync Error:</strong> Connection interrupted.</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setSimulatedError(false)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ── View Router ── */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="summary-cards-grid">
                {[1, 2, 3, 4].map(i => <div key={i} className="stat-card skeleton" style={{ height: '140px' }} />)}
              </div>
              <div className="charts-grid-main">
                <div className="chart-card skeleton" style={{ height: '340px' }} />
                <div className="chart-card skeleton" style={{ height: '340px' }} />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  summary={computedSummary}
                  monthlyData={MONTHLY_ANALYTICS_DATA}
                  categories={updatedCategories}
                  trendData={SPENDING_TREND_DATA}
                  transactions={transactions}
                  onDeleteTransaction={handleDeleteTransaction}
                  searchQuery={searchQuery}
                  onOpenAddExpense={() => setActiveTab('add-expense')}
                  onOpenAddIncome={() => setActiveTab('add-income')}
                  onViewReports={() => setActiveTab('reports')}
                  onViewInsights={() => setActiveTab('ai-insights')}
                  onOpenBudgets={() => setActiveTab('budget')}
                  insights={insights}
                  isLoading={isLoading}
                  onToggleLoading={() => setIsLoading(v => !v)}
                  simulatedError={simulatedError}
                  onToggleError={() => setSimulatedError(v => !v)}
                  isDarkTheme={theme === 'dark'}
                />
              )}

              {activeTab === 'add-expense' && (
                <AddExpensePage
                  backendOnline={backendOnline}
                  onAddExpense={handleAddExpense}
                  onCancel={() => setActiveTab('dashboard')}
                />
              )}

              {activeTab === 'add-income' && (
                <AddIncomePage
                  backendOnline={backendOnline}
                  onAddIncome={handleAddIncome}
                  onCancel={() => setActiveTab('dashboard')}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsView
                  transactions={transactions}
                  categories={updatedCategories}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenAddExpense={() => setActiveTab('add-expense')}
                  onOpenAddIncome={() => setActiveTab('add-income')}
                  backendOnline={backendOnline}
                  onRefreshSummary={() => fetchSummary().then(s => { if (s) setDbSummary(s); })}
                />
              )}


              {activeTab === 'budget' && (
                <BudgetView
                  backendOnline={backendOnline}
                  onRefreshSummary={() => {
                    fetchSummary().then(s => { if (s) setDbSummary(s); });
                  }}
                />
              )}

              {activeTab === 'ai-insights' && (
                <AiInsightsView
                  backendOnline={backendOnline}
                  theme={theme}
                  onNavigateToAddExpense={() => setActiveTab('add-expense')}
                />
              )}
              {activeTab === 'auto-detection' && (
                <AutoDetectionView
                  backendOnline={backendOnline}
                  onNavigateToHistory={() => setActiveTab('transactions')}
                  onRefreshLedger={loadFromBackend}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  summary={computedSummary}
                  monthlyData={MONTHLY_ANALYTICS_DATA}
                  categories={updatedCategories}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  theme={theme}
                  setTheme={setTheme}
                  onResetSampleData={handleResetSampleData}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
