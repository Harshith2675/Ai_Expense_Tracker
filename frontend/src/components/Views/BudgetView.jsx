import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import {
  PlusCircle,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PieChart,
  DollarSign,
  TrendingUp,
  AlertCircle,
  X,
  Check,
  Calendar
} from 'lucide-react';
import {
  fetchBudgets,
  fetchBudgetSummary,
  createBudget,
  updateBudget,
  deleteBudget
} from '../../services/apiService';

const EXPENSE_CATEGORIES = [
  'Food', 'Groceries', 'Transportation', 'Shopping',
  'Education', 'Healthcare', 'Entertainment', 'Bills',
  'Rent', 'Travel', 'Other'
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BudgetView({ _backendOnline = true, onRefreshSummary }) {
  const { currency, symbol, formatAmount } = useCurrency();
  const now = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Data state
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [deletingBudget, setDeletingBudget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add form state
  const [addForm, setAddForm] = useState({
    category: 'Food',
    amount: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');

  // Edit form state
  const [editForm, setEditForm] = useState({
    amount: '',
    notes: ''
  });
  const [editError, setEditError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load budgets & summary for selected period
  const loadBudgetsData = useCallback(async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const [budgetsData, summaryData] = await Promise.all([
        fetchBudgets(selectedMonth, selectedYear, currency),
        fetchBudgetSummary(selectedMonth, selectedYear, currency)
      ]);
      setBudgets(budgetsData || []);
      setSummary(summaryData);
    } catch (err) {
      setApiError(err.message || 'Failed to load budgets');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, currency]);

  useEffect(() => {
    loadBudgetsData();
  }, [loadBudgetsData]);

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrent = () => {
    const cur = new Date();
    setSelectedMonth(cur.getMonth() + 1);
    setSelectedYear(cur.getFullYear());
  };

  // Check which categories are already budgeted this month
  const budgetedCategories = useMemo(() => {
    return new Set(budgets.map((b) => b.category));
  }, [budgets]);

  const availableCategoriesForAdd = useMemo(() => {
    return EXPENSE_CATEGORIES.filter((c) => !budgetedCategories.has(c));
  }, [budgetedCategories]);

  // Handle Add Budget
  const handleOpenAddModal = () => {
    const firstAvailable = availableCategoriesForAdd[0] || EXPENSE_CATEGORIES[0];
    setAddForm({
      category: firstAvailable,
      amount: '',
      notes: ''
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    setFormError('');

    const amt = parseFloat(addForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError(`Please enter a valid budget amount greater than ${symbol}0.`);
      return;
    }
    if (!addForm.category) {
      setFormError('Please select a category.');
      return;
    }

    setActionLoading(true);
    const res = await createBudget({
      category: addForm.category,
      amount: amt,
      month: selectedMonth,
      year: selectedYear,
      notes: addForm.notes
    });
    setActionLoading(false);

    if (res.ok) {
      showToast(`Budget for ${addForm.category} created!`);
      setShowAddModal(false);
      await loadBudgetsData();
      if (onRefreshSummary) onRefreshSummary();
    } else {
      setFormError(res.error || 'Failed to create budget.');
    }
  };

  // Handle Edit Budget
  const handleOpenEditModal = (budget) => {
    setEditingBudget(budget);
    setEditForm({
      amount: String(budget.amount),
      notes: budget.notes || ''
    });
    setEditError('');
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setEditError('');

    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setEditError(`Please enter a valid budget amount greater than ${symbol}0.`);
      return;
    }

    setActionLoading(true);
    const res = await updateBudget(editingBudget.id, {
      amount: amt,
      notes: editForm.notes
    });
    setActionLoading(false);

    if (res.ok) {
      showToast(`Budget for ${editingBudget.category} updated!`);
      setEditingBudget(null);
      await loadBudgetsData();
      if (onRefreshSummary) onRefreshSummary();
    } else {
      setEditError(res.error || 'Failed to update budget.');
    }
  };

  // Handle Delete Budget
  const handleConfirmDelete = async () => {
    if (!deletingBudget) return;
    setActionLoading(true);
    const res = await deleteBudget(deletingBudget.id);
    setActionLoading(false);

    if (res.ok) {
      showToast(`Budget for ${deletingBudget.category} deleted.`);
      setDeletingBudget(null);
      await loadBudgetsData();
      if (onRefreshSummary) onRefreshSummary();
    } else {
      showToast(res.error || 'Failed to delete budget.', 'error');
    }
  };

  const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear();

  return (
    <div className="view-container" id="budget-management-view">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`toast-alert toast-${toast.type}`}
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: toast.type === 'error' ? 'var(--color-danger, #ef4444)' : 'var(--color-income, #10b981)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
            fontSize: '0.9rem',
            fontWeight: 500
          }}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Card with Period Selector & Actions */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="chart-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PieChart size={24} style={{ color: 'var(--accent-primary)' }} />
              <span>Budget Management</span>
            </h2>
            <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
              Define monthly category spending limits with live variance tracking & threshold alerts
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Period Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <button
                className="icon-button"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
                style={{ width: '32px', height: '32px' }}
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px' }}>
                <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', outline: 'none' }}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>{name}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', outline: 'none' }}
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                className="icon-button"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
                style={{ width: '32px', height: '32px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {!isCurrentMonth && (
              <button
                className="btn btn-secondary"
                onClick={handleJumpToCurrent}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                Current Month
              </button>
            )}

            {/* Add Budget Button */}
            <button
              id="add-budget-btn"
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              disabled={availableCategoriesForAdd.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <PlusCircle size={16} />
              <span>Add Budget</span>
            </button>
          </div>
        </div>

        {apiError && (
          <div className="error-banner" style={{ marginTop: '16px' }}>
            <AlertTriangle size={18} />
            <span>{apiError}</span>
          </div>
        )}
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="summary-cards-grid" style={{ marginBottom: '24px' }}>
        {/* Card 1: Total Allocated Budget */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Allocated Budget</span>
            <div className="stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
              <PieChart size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '8px' }}>
            {summary ? formatAmount(summary.total_budget) : formatAmount(0)}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {budgets.length} {budgets.length === 1 ? 'category' : 'categories'} configured for {MONTH_NAMES[selectedMonth - 1]}
          </div>
        </div>

        {/* Card 2: Actual Month Expenses */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Expenses in {MONTH_NAMES[selectedMonth - 1]}</span>
            <div className="stat-icon-wrap expense">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--color-expense, #ef4444)' }}>
            {summary ? formatAmount(summary.total_expenses) : formatAmount(0)}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Calculated from ledger transactions
          </div>
        </div>

        {/* Card 3: Remaining Cushion / Net Variance */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Remaining Cushion</span>
            <div className={`stat-icon-wrap ${summary && summary.is_over_budget ? 'expense' : 'income'}`}>
              <DollarSign size={20} />
            </div>
          </div>
          <div
            className="stat-value"
            style={{
              fontSize: '1.75rem',
              marginTop: '8px',
              color: summary && summary.is_over_budget ? 'var(--color-danger, #ef4444)' : 'var(--color-income, #10b981)'
            }}
          >
            {summary
              ? summary.is_over_budget
                ? `-${formatAmount(Math.abs(summary.net_balance))}`
                : formatAmount(summary.remaining_budget)
              : formatAmount(0)}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {summary && summary.is_over_budget ? (
              <span style={{ color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>Total spending exceeds allocated budget</span>
            ) : (
              <span>Available before hitting limit</span>
            )}
          </div>
        </div>

        {/* Card 4: Overall Budget Usage */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Overall Usage</span>
            <div className="stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '8px' }}>
            {summary ? `${summary.budget_used_percentage}%` : '0%'}
          </div>
          {/* Progress bar */}
          <div className="meter-bar-track" style={{ height: '6px', marginTop: '10px' }}>
            <div
              className="meter-bar-progress"
              style={{
                width: `${Math.min(summary ? summary.budget_used_percentage : 0, 100)}%`,
                backgroundColor:
                  summary && summary.budget_used_percentage >= 100
                    ? 'var(--color-danger, #ef4444)'
                    : summary && summary.budget_used_percentage >= 80
                    ? '#f59e0b'
                    : 'var(--color-income, #10b981)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Active Threshold Alerts (if any) */}
      {summary && summary.alerts && summary.alerts.length > 0 && (
        <div
          className="section-card"
          style={{
            marginBottom: '24px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            background: 'rgba(245, 158, 11, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Budget Threshold Alerts ({summary.alerts.length})
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {summary.alerts.map((alert) => (
              <div
                key={alert.category}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: alert.status === 'exceeded' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="category-color-dot" style={{ backgroundColor: CATEGORY_COLORS[alert.category] || '#6366f1' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alert.category}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        background: alert.status === 'exceeded' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: alert.status === 'exceeded' ? '#ef4444' : '#f59e0b'
                      }}
                    >
                      {alert.status === 'exceeded' ? 'Exceeded' : 'Near Limit'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {alert.message}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                  {alert.percentage_used}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Budgets List / Grid */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Category Budgets for {monthLabel}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Individual category limits, actual expenses, and progress towards threshold limits.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-income, #10b981)' }} />
              <span>&lt;80% Normal</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <span>80-99% Warning</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-danger, #ef4444)' }} />
              <span>&ge;100% Exceeded</span>
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading budgets for {monthLabel}...
          </div>
        ) : budgets.length === 0 ? (
          /* Empty State */
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-medium)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <PieChart size={30} />
            </div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 600 }}>No Budgets Configured for {monthLabel}</h4>
            <p style={{ margin: '0 auto 24px auto', maxWidth: '440px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              You haven't defined any category spending limits for this month yet. Configure budgets to prevent overspending and receive proactive alerts.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <PlusCircle size={16} />
              <span>Add Your First Budget</span>
            </button>
          </div>
        ) : (
          /* List of Category Budgets */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {budgets.map((b) => {
              const catColor = CATEGORY_COLORS[b.category] || 'var(--accent-primary)';
              const isExceeded = b.status === 'exceeded';
              const isWarning = b.status === 'warning';

              return (
                <div
                  key={b.id}
                  id={`budget-card-${b.id}`}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: isExceeded
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : isWarning
                      ? '1px solid rgba(245, 158, 11, 0.35)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px 20px',
                    transition: 'border-color 0.2s ease, transform 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="category-color-dot" style={{ backgroundColor: catColor, width: '12px', height: '12px' }} />
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>{b.category}</span>

                      {/* Status Badge */}
                      {isExceeded ? (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger, #ef4444)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px' }}>
                          <AlertTriangle size={12} /> Exceeded
                        </span>
                      ) : isWarning ? (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px' }}>
                          <AlertCircle size={12} /> Near Limit
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-income, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px' }}>
                          <Check size={12} /> On Track
                        </span>
                      )}

                      {b.notes && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.notes}>
                          — {b.notes}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: isExceeded ? 'var(--color-danger, #ef4444)' : 'var(--text-main)' }}>
                          {formatAmount(b.spent)}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {' '}of {formatAmount(b.amount)} ({b.percentage_used}%)
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="icon-button"
                          onClick={() => handleOpenEditModal(b)}
                          title="Edit Budget"
                          aria-label={`Edit ${b.category} budget`}
                          style={{ width: '32px', height: '32px' }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => setDeletingBudget(b)}
                          title="Delete Budget"
                          aria-label={`Delete ${b.category} budget`}
                          style={{ width: '32px', height: '32px', color: 'var(--color-danger, #ef4444)' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="meter-bar-track" style={{ height: '8px', marginBottom: '8px', background: 'var(--bg-surface)' }}>
                    <div
                      className="meter-bar-progress"
                      style={{
                        width: `${Math.min(b.percentage_used, 100)}%`,
                        backgroundColor: isExceeded
                          ? 'var(--color-danger, #ef4444)'
                          : isWarning
                          ? '#f59e0b'
                          : catColor
                      }}
                    />
                  </div>

                  {/* Status explanation line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>
                      {isExceeded ? (
                        <strong style={{ color: 'var(--color-danger, #ef4444)' }}>
                          Exceeded budget limit by {formatAmount(b.over_budget)}
                        </strong>
                      ) : isWarning ? (
                        <span style={{ color: '#f59e0b' }}>
                          Approaching limit: {formatAmount(b.remaining)} remaining before cap
                        </span>
                      ) : (
                        <span>{formatAmount(b.remaining)} remaining cushion</span>
                      )}
                    </span>
                    <span>{b.period.charAt(0).toUpperCase() + b.period.slice(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ADD BUDGET MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '90%', padding: '24px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PlusCircle size={22} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Add Category Budget</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowAddModal(false)}
                style={{ width: '28px', height: '28px' }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Set a spending limit for <strong>{monthLabel}</strong>. You will receive proactive warnings when expenses reach 80% and 100%.
            </p>

            {formError && (
              <div className="error-banner" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="budget-category-select" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Expense Category *
                  </label>
                  <select
                    id="budget-category-select"
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const isAlreadySet = budgetedCategories.has(cat);
                      return (
                        <option key={cat} value={cat} disabled={isAlreadySet}>
                          {cat} {isAlreadySet ? '(Already budgeted)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor="budget-amount-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Monthly Budget Limit ({symbol}) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>{symbol}</span>
                    <input
                      id="budget-amount-input"
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 450.00"
                      value={addForm.amount}
                      onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                      style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.95rem' }}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="budget-notes-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Notes (Optional)
                  </label>
                  <input
                    id="budget-notes-input"
                    type="text"
                    placeholder="e.g. Groceries & occasional dining"
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} />
                  <span>{actionLoading ? 'Saving...' : 'Save Budget'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* EDIT BUDGET MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {editingBudget && (
        <div className="modal-backdrop" onClick={() => setEditingBudget(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '90%', padding: '24px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit2 size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Edit Budget: {editingBudget.category}</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setEditingBudget(null)}
                style={{ width: '28px', height: '28px' }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
              <div>Period: <strong>{monthLabel}</strong></div>
              <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                Current spent: <strong style={{ color: 'var(--text-main)' }}>{formatAmount(editingBudget.spent)}</strong>
              </div>
            </div>

            {editError && (
              <div className="error-banner" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEdit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="edit-budget-amount" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Budget Amount ({symbol}) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>{symbol}</span>
                    <input
                      id="edit-budget-amount"
                      type="number"
                      step="0.01"
                      min="1"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.95rem' }}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-budget-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Notes
                  </label>
                  <input
                    id="edit-budget-notes"
                    type="text"
                    placeholder="Update notes..."
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingBudget(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} />
                  <span>{actionLoading ? 'Updating...' : 'Update Budget'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {deletingBudget && (
        <div className="modal-backdrop" onClick={() => setDeletingBudget(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', width: '90%', padding: '24px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Delete Budget?</h3>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to remove the <strong>{deletingBudget.category}</strong> budget ({formatAmount(deletingBudget.amount)}) for <strong>{monthLabel}</strong>?
              Past transaction records in this category will not be deleted.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingBudget(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                style={{ background: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} />
                <span>{actionLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
