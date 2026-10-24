import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import {
  BrainCircuit,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  Calendar,
  DollarSign,
  Target,
  Repeat,
  Info,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  EyeOff,
  PlusCircle
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

import {
  fetchInsightsSummary,
  fetchInsightsCategories,
  fetchInsightsTrends,
  fetchInsightsAnomalies,
  dismissAnomaly,
  fetchInsightsRecommendations,
  fetchRecurringExpenses,
  predictCategory
} from '../../services/apiService';

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CATEGORY_COLORS = {
  'Food': '#f59e0b',
  'Groceries': '#10b981',
  'Transportation': '#3b82f6',
  'Shopping': '#ec4899',
  'Education': '#8b5cf6',
  'Healthcare': '#06b6d4',
  'Entertainment': '#a855f7',
  'Bills': '#f97316',
  'Rent': '#6366f1',
  'Travel': '#14b8a6',
  'Other': '#64748b'
};

export default function AiInsightsView({ _backendOnline = true, theme = 'dark', onNavigateToAddExpense }) {
  const { currency, symbol, formatAmount } = useCurrency();
  const isDark = theme === 'dark';
  const now = useMemo(() => new Date(), []);

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Data states
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trendsData, setTrendsData] = useState(null);
  const [anomaliesData, setAnomaliesData] = useState({ anomalies: [], total_flagged: 0, insufficient_data_reasons: [] });
  const [recommendationsData, setRecommendationsData] = useState({ recommendations: [], total_recommendations: 0 });
  const [recurringExpenses, setRecurringExpenses] = useState([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [dismissingId, setDismissingId] = useState(null);

  // ML playground sandbox states
  const [testDesc, setTestDesc] = useState('');
  const [predictionResult, setPredictionResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // Load all insights data from SQLite backend
  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const [sumRes, catRes, trendRes, anomRes, recRes, recExpensesRes] = await Promise.all([
        fetchInsightsSummary(selectedMonth, selectedYear, currency),
        fetchInsightsCategories(selectedMonth, selectedYear),
        fetchInsightsTrends(6, selectedMonth, selectedYear),
        fetchInsightsAnomalies(selectedMonth, selectedYear, currency),
        fetchInsightsRecommendations(selectedMonth, selectedYear, currency),
        fetchRecurringExpenses()
      ]);

      if (sumRes) setSummary(sumRes);
      if (catRes) setCategories(catRes);
      if (trendRes) setTrendsData(trendRes);
      if (anomRes) setAnomaliesData(anomRes);
      if (recRes) setRecommendationsData(recRes);
      if (recExpensesRes) setRecurringExpenses(recExpensesRes);
    } catch (err) {
      console.error('Failed to load insights:', err);
      setApiError('Unable to load insights data from backend. Please verify the Flask server is running.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, currency]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Handle toast timeout
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle dismissing an anomaly alert
  const handleDismissAnomaly = async (txId) => {
    setDismissingId(txId);
    try {
      const res = await dismissAnomaly(txId);
      if (res.ok) {
        setAnomaliesData(prev => ({
          ...prev,
          anomalies: prev.anomalies.filter(a => a.id !== txId),
          total_flagged: Math.max(0, prev.total_flagged - 1),
          dismissed_count: (prev.dismissed_count || 0) + 1
        }));
        setToastMessage('Potentially unusual alert dismissed.');
      } else {
        setToastMessage(res.error || 'Failed to dismiss alert.');
      }
    } catch {
      setToastMessage('Error dismissing alert.');
    } finally {
      setDismissingId(null);
    }
  };

  // ML Playground test handler
  const handleTestPrediction = async (e) => {
    e.preventDefault();
    if (!testDesc.trim()) return;
    setIsPredicting(true);
    try {
      const res = await predictCategory(testDesc.trim());
      setPredictionResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPredicting(false);
    }
  };

  // Currency helper
  const fmt = useCallback((n) => formatAmount(n), [formatAmount]);

  // ─────────────────────────────────────────────────────────
  // Chart Configurations
  // ─────────────────────────────────────────────────────────

  // Trend Chart Data (6-month history)
  const lineChartData = useMemo(() => {
    if (!trendsData || !trendsData.trends || trendsData.trends.length === 0) {
      return { labels: [], datasets: [] };
    }
    const labels = trendsData.trends.map(t => t.label);
    const expenses = trendsData.trends.map(t => t.expenses);
    const income = trendsData.trends.map(t => t.income);

    return {
      labels,
      datasets: [
        {
          label: `Monthly Expenses (${symbol})`,
          data: expenses,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointHoverRadius: 6,
          borderWidth: 2.5
        },
        {
          label: `Monthly Income (${symbol})`,
          data: income,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointHoverRadius: 6,
          borderWidth: 2,
          borderDash: [5, 5]
        }
      ]
    };
  }, [trendsData, symbol]);

  const lineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDark ? '#94a3b8' : '#475569',
          font: { family: 'inherit', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#e2e8f0' : '#334155',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${formatAmount(context.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        beginAtZero: true,
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          callback: (value) => `${symbol}${value}`
        }
      }
    }
  }), [isDark, symbol, formatAmount]);

  // Doughnut Chart Data (Category share)
  const doughnutData = useMemo(() => {
    if (!categories || categories.length === 0) {
      return { labels: [], datasets: [] };
    }
    const labels = categories.map(c => c.category);
    const dataVals = categories.map(c => c.amount);
    const bgColors = categories.map(c => CATEGORY_COLORS[c.category] || '#94a3b8');

    return {
      labels,
      datasets: [
        {
          data: dataVals,
          backgroundColor: bgColors,
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };
  }, [categories, isDark]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          color: isDark ? '#cbd5e1' : '#334155',
          font: { family: 'inherit', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#e2e8f0' : '#334155',
        callbacks: {
          label: (context) => {
            const val = context.raw || 0;
            const cat = categories[context.dataIndex];
            const pct = cat ? cat.percentage : 0;
            return ` ${context.label}: ${formatAmount(val)} (${pct}%)`;
          }
        }
      }
    }
  }), [categories, isDark, formatAmount]);

  const hasExpensesThisMonth = summary && summary.total_expenses > 0;

  return (
    <div className="view-container" id="ai-insights-view">
      {/* Toast alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--bg-surface-elevated, #1e293b)',
            color: 'var(--text-primary, #f8fafc)',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            border: '1px solid var(--border-medium, #334155)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem'
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner & Period Controls */}
      <div
        className="section-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BrainCircuit size={18} style={{ color: '#c084fc' }} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              AI Financial Insights & Recommendations
            </h2>
            <span className="badge badge-auto" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' }}>
              Rule-Based Statistical Intelligence
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Grounded analysis derived from actual SQLite transaction records and budgets
          </p>
        </div>

        {/* Month & Year Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              id="insights-month-select"
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '0.85rem', width: '130px' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <select
            id="insights-year-select"
            className="form-input"
            style={{ padding: '6px 10px', fontSize: '0.85rem', width: '90px' }}
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            id="insights-refresh-btn"
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={loadInsights}
            disabled={isLoading}
            title="Refresh Insights"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {apiError && (
        <div className="error-banner" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} />
          <span>{apiError}</span>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: 'auto' }} onClick={loadInsights}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[1, 2, 3, 4].map(k => (
              <div key={k} className="stat-card skeleton" style={{ height: '115px' }} />
            ))}
          </div>
          <div className="charts-grid-main">
            <div className="chart-card skeleton" style={{ height: '320px' }} />
            <div className="chart-card skeleton" style={{ height: '320px' }} />
          </div>
        </div>
      ) : (
        <>
          {/* Top 4 Summary Stat Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '16px',
              marginBottom: '22px'
            }}
          >
            {/* Card 1: Total Expenses & MoM */}
            <div className="stat-card" id="insights-total-expenses-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total Expenses ({MONTH_NAMES[selectedMonth - 1].slice(0, 3)} {selectedYear})
                </span>
                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}>
                  <DollarSign size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 4px', color: 'var(--text-primary)' }}>
                {fmt(summary?.total_expenses)}
              </div>
              <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {summary?.comparison?.is_increase ? (
                  <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                    <ArrowUpRight size={13} />
                    {summary.comparison.percentage !== null ? `+${summary.comparison.percentage}%` : 'New'}
                  </span>
                ) : (
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                    <ArrowDownRight size={13} />
                    {summary?.comparison?.percentage !== null ? `${summary.comparison.percentage}%` : '0%'}
                  </span>
                )}
                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {summary?.comparison?.explanation || 'vs previous month'}
                </span>
              </div>
            </div>

            {/* Card 2: Average Daily Spending */}
            <div className="stat-card" id="insights-daily-spend-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average Daily Spend</span>
                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6'
                }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 4px', color: 'var(--text-primary)' }}>
                {fmt(summary?.daily_spending?.average_per_day)}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}> /day</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Based on {summary?.daily_spending?.days_considered || 0} days recorded in period
              </div>
            </div>

            {/* Card 3: Highest-Spending Category */}
            <div className="stat-card" id="insights-top-category-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top Expense Category</span>
                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#f59e0b'
                }}>
                  <PieIcon size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0 4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {summary?.highest_category ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[summary.highest_category.category] || '#94a3b8'
                    }} />
                    <span>{summary.highest_category.category}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>None recorded</span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {summary?.highest_category ? (
                  <><strong>{fmt(summary.highest_category.amount)}</strong> ({summary.highest_category.percentage}% of total)</>
                ) : (
                  'No expense records found'
                )}
              </div>
            </div>

            {/* Card 4: Budget Health */}
            <div className="stat-card" id="insights-budget-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monthly Budget Health</span>
                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: summary?.budget?.status === 'exceeded'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : summary?.budget?.status === 'warning'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(16, 185, 129, 0.1)',
                  color: summary?.budget?.status === 'exceeded'
                    ? '#ef4444'
                    : summary?.budget?.status === 'warning'
                    ? '#f59e0b'
                    : '#10b981'
                }}>
                  <Target size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 4px', color: 'var(--text-primary)' }}>
                {summary?.budget?.total_budget > 0 ? (
                  `${summary.budget.used_percentage}%`
                ) : (
                  <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Unbudgeted</span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {summary?.budget?.total_budget > 0 ? (
                  summary.budget.remaining >= 0
                    ? `${fmt(summary.budget.remaining)} remaining cushion`
                    : `Over budget by ${fmt(Math.abs(summary.budget.remaining))}`
                ) : (
                  'Set category budgets in Budget view'
                )}
              </div>
            </div>
          </div>

          {/* Empty State Banner if no expenses exist in selected period */}
          {!hasExpensesThisMonth && (
            <div
              className="section-card"
              style={{
                textAlign: 'center',
                padding: '36px 20px',
                marginBottom: '24px',
                border: '1px dashed var(--border-medium)'
              }}
            >
              <Info size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
                No Expense Records Found for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 16px' }}>
                Insights are generated strictly from actual SQLite transaction records. Add an expense or choose a period with recorded transactions to see dynamic analytics.
              </p>
              {onNavigateToAddExpense && (
                <button className="btn btn-primary" onClick={onNavigateToAddExpense}>
                  <PlusCircle size={15} />
                  <span>Add First Expense</span>
                </button>
              )}
            </div>
          )}

          {/* Visualizations Grid */}
          <div className="charts-grid-main" style={{ marginBottom: '24px' }}>
            {/* Chart 1: 6-Month Spending Trends */}
            <div className="chart-card" id="insights-trend-chart-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-card-title">6-Month Spending Trajectory</h3>
                  <p className="chart-card-subtitle">
                    Historical cash flow comparison across consecutive periods
                  </p>
                </div>
                <span className="badge badge-auto">Chart.js</span>
              </div>
              <div className="chart-container-wrapper" style={{ height: '260px' }}>
                {trendsData?.trends && trendsData.trends.length > 0 ? (
                  <Line data={lineChartData} options={lineChartOptions} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Insufficient historical data for trend trajectory
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Category Allocation */}
            <div className="chart-card" id="insights-category-chart-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-card-title">Category Spending Allocation</h3>
                  <p className="chart-card-subtitle">
                    Distribution of expenses for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </p>
                </div>
                <span className="badge badge-auto">{categories.length} Categories</span>
              </div>
              <div className="chart-container-wrapper" style={{ height: '260px', position: 'relative' }}>
                {categories.length > 0 ? (
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No categorized spending recorded for this month
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* SECTION: Potentially Unusual Transactions (Anomalies)    */}
          {/* ───────────────────────────────────────────────────────── */}
          <div className="section-card" id="insights-anomalies-section" style={{ marginBottom: '24px' }}>
            <div className="chart-card-header" style={{ marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                  <h3 className="chart-card-title" style={{ margin: 0 }}>
                    Potentially Unusual Transactions
                  </h3>
                  {anomaliesData.total_flagged > 0 ? (
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                      {anomaliesData.total_flagged} Flagged
                    </span>
                  ) : (
                    <span className="badge badge-success">
                      0 Flagged
                    </span>
                  )}
                </div>
                <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
                  Transactions evaluated against statistical historical baselines (mean + 2σ or &gt;2.5x median). Labeled as potentially unusual, not confirmed fraud.
                </p>
              </div>
            </div>

            {anomaliesData.anomalies && anomaliesData.anomalies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {anomaliesData.anomalies.map((anom) => (
                  <div
                    key={anom.id}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--bg-surface-elevated, #1e293b)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{anom.description}</span>
                        <span
                          className="badge"
                          style={{
                            background: `${CATEGORY_COLORS[anom.category] || '#64748b'}22`,
                            color: CATEGORY_COLORS[anom.category] || '#cbd5e1'
                          }}
                        >
                          {anom.category}
                        </span>
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                          Potentially Unusual
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <strong>Evidence:</strong> {anom.reason}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle, #94a3b8)', marginTop: '4px' }}>
                        Date: {anom.transaction_date} • Payment: {anom.payment_method} • Historical Avg: {fmt(anom.baseline_average)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>
                          {fmt(anom.amount)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {anom.ratio}x typical spend
                        </div>
                      </div>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={() => handleDismissAnomaly(anom.id)}
                        disabled={dismissingId === anom.id}
                        title="Dismiss this alert"
                      >
                        <EyeOff size={13} />
                        <span>{dismissingId === anom.id ? 'Dismissing...' : 'Dismiss'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'var(--bg-surface-elevated, #1e293b)',
                  border: '1px solid var(--border-subtle, #334155)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No Potentially Unusual Transactions Flagged</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    All recorded expenses in {MONTH_NAMES[selectedMonth - 1]} {selectedYear} fall within expected statistical boundaries.
                  </div>
                </div>
              </div>
            )}

            {/* Informative Insufficient Observations Note */}
            {anomaliesData.insufficient_data_reasons && anomaliesData.insufficient_data_reasons.length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', background: 'rgba(148, 163, 184, 0.08)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                <strong>Data Sufficiency Note:</strong> {anomaliesData.insufficient_data_reasons[0]} (Transparent statistical rules require ≥3 transactions per category to avoid false flags).
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* SECTION: Personalized Grounded Saving Recommendations   */}
          {/* ───────────────────────────────────────────────────────── */}
          <div className="section-card" id="insights-recommendations-section" style={{ marginBottom: '24px' }}>
            <div className="chart-card-header" style={{ marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lightbulb size={18} style={{ color: '#a855f7' }} />
                  <h3 className="chart-card-title" style={{ margin: 0 }}>
                    Personalized Saving Recommendations
                  </h3>
                  <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' }}>
                    {recommendationsData.total_recommendations} Opportunities
                  </span>
                </div>
                <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
                  Recommendations computed from actual category shares, spending surges, budget margins, and stated mathematical assumptions.
                </p>
              </div>
            </div>

            {recommendationsData.recommendations && recommendationsData.recommendations.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {recommendationsData.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="stat-card"
                    style={{
                      borderLeft: rec.type === 'budget_exceeded'
                        ? '4px solid #ef4444'
                        : rec.type === 'budget_warning'
                        ? '4px solid #f59e0b'
                        : rec.type === 'spending_surge'
                        ? '4px solid #f97316'
                        : '4px solid #a855f7',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          className="badge"
                          style={{
                            background: rec.type === 'budget_exceeded'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(168, 85, 247, 0.15)',
                            color: rec.type === 'budget_exceeded' ? '#ef4444' : '#d8b4fe'
                          }}
                        >
                          {rec.badge}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {rec.confidence === 'preliminary' ? 'Preliminary (Building History)' : 'High Confidence'}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                        {rec.title}
                      </h4>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.45 }}>
                        <strong>Evidence:</strong> {rec.evidence}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '14px', lineHeight: 1.45, background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                        <strong>Action:</strong> {rec.action}
                      </div>
                    </div>

                    <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Potential Savings:</span>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#10b981' }}>
                        {rec.potential_savings}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No active recommendations for this period. Add additional transactions and budgets to surface personalized saving strategies.
              </div>
            )}

            {/* Stated Assumptions Disclaimer */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                {recommendationsData.disclaimer || 'All potential savings are estimated projections based on stated mathematical assumptions, not guaranteed outcomes.'}
              </span>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* SECTION: Recurring Subscriptions & Fixed Expenses         */}
          {/* ───────────────────────────────────────────────────────── */}
          <div className="section-card" id="insights-recurring-section" style={{ marginBottom: '24px' }}>
            <div className="chart-card-header" style={{ marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Repeat size={18} style={{ color: '#3b82f6' }} />
                  <h3 className="chart-card-title" style={{ margin: 0 }}>
                    Recurring Expense Candidates
                  </h3>
                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                    {recurringExpenses.length} Detected
                  </span>
                </div>
                <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
                  Detected repeating transactions across multiple dates with matching descriptions and consistent amounts
                </p>
              </div>
            </div>

            {recurringExpenses.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="transactions-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Merchant / Description</th>
                      <th>Category</th>
                      <th>Frequency</th>
                      <th>Occurrences</th>
                      <th>Average Amount</th>
                      <th>Latest Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringExpenses.map((rec, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{rec.description}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: `${CATEGORY_COLORS[rec.category] || '#64748b'}22`,
                              color: CATEGORY_COLORS[rec.category] || '#cbd5e1'
                            }}
                          >
                            {rec.category}
                          </span>
                        </td>
                        <td>{rec.frequency}</td>
                        <td>{rec.occurrences} recorded</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(rec.amount)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{rec.last_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No recurring monthly charges detected yet. Repeating monthly expenses will automatically appear here once recorded across consecutive months.
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* SECTION: Live ML Classification Sandbox                   */}
          {/* ───────────────────────────────────────────────────────── */}
          <div className="section-card" id="insights-ml-sandbox-card">
            <div className="chart-card-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: '#c084fc' }} />
                  <h3 className="chart-card-title" style={{ margin: 0 }}>
                    Live NLP Classification Playground
                  </h3>
                </div>
                <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
                  Test how the scikit-learn NLP pipeline predicts expense categories from merchant keywords
                </p>
              </div>
              <span className="badge badge-auto">Flask & Scikit-learn</span>
            </div>

            <form onSubmit={handleTestPrediction} style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
              <input
                id="ml-test-input"
                type="text"
                className="form-input"
                style={{ flex: 1, minWidth: '240px' }}
                placeholder="Type a merchant or transaction (e.g. 'Delta Airlines ticket', 'Starbucks dark roast', 'Whole Foods organic')"
                value={testDesc}
                onChange={(e) => setTestDesc(e.target.value)}
              />
              <button id="run-ml-prediction-btn" type="submit" className="btn btn-primary" disabled={isPredicting}>
                <Sparkles size={15} />
                <span>{isPredicting ? 'Classifying...' : 'Test Classifier'}</span>
              </button>
            </form>

            {predictionResult && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'var(--bg-surface-elevated, #1e293b)',
                  border: '1px solid var(--border-medium, #334155)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Predicted Category</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#c084fc' }}>
                    {predictionResult.category}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Confidence Score</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                    {Math.round(predictionResult.confidence * 100)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
