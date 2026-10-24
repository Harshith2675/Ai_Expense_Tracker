import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import {
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Check,
  X,
  Edit3,
  AlertTriangle,
  Info,
  CheckCheck,
  Landmark,
  Sliders
} from 'lucide-react';
import {
  fetchAutoDetectionStatus,
  triggerAutoDetectionSync,
  fetchPendingTransactions,
  reviewPendingTransaction,
  reviewAllPendingTransactions,
  fetchSyncHistory
} from '../../services/apiService';

const EXPENSE_CATEGORIES = [
  'Food', 'Groceries', 'Transportation', 'Shopping',
  'Education', 'Healthcare', 'Entertainment', 'Bills',
  'Rent', 'Travel', 'Other'
];

const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'
];

export default function AutoDetectionView({
  _backendOnline = true,
  onNavigateToHistory,
  onRefreshLedger
}) {
  const { formatAmount } = useCurrency();
  // Status & Counts
  const [status, setStatus] = useState({
    provider_id: 'demo_bank',
    provider_name: 'Demo Bank Sandbox',
    is_configured: true,
    is_demo: true,
    mode: 'demo',
    connection_status: 'connected',
    message: 'Demo mode active',
    last_sync: null,
    detected_count: 0,
    pending_count: 0,
    approved_auto_count: 0,
    real_provider_configured: false,
    supported_providers: []
  });

  // Pending queue & history
  const [pendingItems, setPendingItems] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Selected mode
  const [selectedMode, setSelectedMode] = useState('demo');

  // Toasts & banners
  const [toast, setToast] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    category: '',
    transaction_type: 'expense',
    notes: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Load status and pending items
  const loadData = useCallback(async (modeOverride) => {
    setLoading(true);
    try {
      const mode = modeOverride !== undefined ? modeOverride : selectedMode;
      const [statusRes, pendingRes, historyRes] = await Promise.all([
        fetchAutoDetectionStatus(mode),
        fetchPendingTransactions(),
        fetchSyncHistory(8)
      ]);

      if (statusRes) {
        setStatus(statusRes);
        if (statusRes.mode) setSelectedMode(statusRes.mode);
      }
      setPendingItems(pendingRes || []);
      setSyncHistory(historyRes || []);
    } catch (err) {
      console.error('Error loading auto-detection data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Mode Change
  const handleModeChange = async (e) => {
    const newMode = e.target.value;
    setSelectedMode(newMode);
    await loadData(newMode);
    showToast(`Switched detection mode to: ${newMode.toUpperCase()}`, 'info');
  };

  // Trigger Sync
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await triggerAutoDetectionSync(selectedMode);
      if (res.ok) {
        const d = res.data;
        setSyncResult(d);
        showToast(
          `Sync complete: ${d.imported_count || 0} imported, ${d.pending_count || 0} awaiting review, ${d.duplicates_skipped || 0} duplicates prevented.`,
          'success'
        );
        await loadData();
        if (onRefreshLedger) onRefreshLedger();
      } else {
        showToast(res.error || 'Sync failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error executing sync', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Review single transaction
  const handleReview = async (id, action, updates = {}) => {
    setActionLoadingId(id);
    try {
      const res = await reviewPendingTransaction(id, action, updates);
      if (res.ok) {
        showToast(
          action === 'approve'
            ? 'Transaction approved and added to your financial ledger!'
            : 'Transaction rejected (archived from review queue).',
          'success'
        );
        // Remove locally immediately
        setPendingItems((prev) => prev.filter((item) => item.id !== id));
        // Refresh counts and parent ledger
        await loadData();
        if (onRefreshLedger) onRefreshLedger();
      } else {
        showToast(res.error || 'Failed to review transaction', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error reviewing transaction', 'error');
    } finally {
      setActionLoadingId(null);
      setEditingItem(null);
    }
  };

  // Bulk review
  const handleBulkReview = async (action) => {
    setLoading(true);
    try {
      const res = await reviewAllPendingTransactions(action);
      if (res.ok) {
        showToast(
          res.data.message || `All pending transactions marked as ${action}d!`,
          'success'
        );
        await loadData();
        if (onRefreshLedger) onRefreshLedger();
      } else {
        showToast(res.error || 'Bulk review failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error during bulk review', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      category: item.category || 'Other',
      transaction_type: item.transaction_type || 'expense',
      notes: item.notes || ''
    });
  };

  // Submit edit and approve
  const submitEditAndApprove = async () => {
    if (!editingItem) return;
    await handleReview(editingItem.id, 'approve', editForm);
  };

  return (
    <div className="view-container" id="auto-detection-view">
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
            background: toast.type === 'error' ? 'var(--color-danger, #ef4444)' : toast.type === 'info' ? 'var(--accent-primary, #6366f1)' : 'var(--color-income, #10b981)',
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

      {/* Security & Architecture Disclaimer Banner */}
      <div className="demo-disclaimer-banner" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.08) 100%)' }}>
        <div className="demo-banner-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <ShieldCheck size={22} style={{ color: 'var(--color-income)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main, #f8fafc)', marginBottom: '4px' }}>
              Safe Integration Architecture — Automatic Expense Detection
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5 }}>
              Automatic transaction detection uses official provider adapters with idempotent sync and duplicate prevention.
              <strong> Zero credentials stored:</strong> we never ask for or store banking passwords, card PINs, CVVs, or OTPs.
              {status.is_demo ? (
                <span style={{ color: '#fbbf24', marginLeft: '6px' }}>
                  (Currently running in <strong>Demo Sandbox Mode</strong> with simulated transactions. No live bank accounts are touched.)
                </span>
              ) : (
                <span style={{ color: 'var(--color-income)', marginLeft: '6px' }}>
                  (Connected to authorized financial provider.)
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`demo-tag ${status.is_demo ? '' : 'tag-live'}`} style={{ whiteSpace: 'nowrap' }}>
          {status.is_demo ? 'Demo Sandbox' : 'Live Provider'}
        </span>
      </div>

      {/* Status & Summary Cards Grid */}
      <div className="summary-cards-grid" style={{ marginBottom: '24px' }}>
        {/* Card 1: Connection Status */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Connection Status</span>
            <div className={`stat-icon-wrap ${status.connection_status === 'connected' ? 'income' : 'expense'}`}>
              <Landmark size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '8px' }}>
            {status.connection_status === 'connected' ? (
              <span style={{ color: 'var(--color-income)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={18} /> {status.is_demo ? 'Demo Mode' : 'Connected'}
              </span>
            ) : (
              <span style={{ color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <XCircle size={18} /> Disconnected
              </span>
            )}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Provider: <strong>{status.provider_name}</strong>
          </div>
        </div>

        {/* Card 2: Last Sync Time */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Last Synchronized</span>
            <div className="stat-icon-wrap neutral">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.15rem', marginTop: '8px' }}>
            {status.last_sync ? status.last_sync : 'Never'}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Idempotent duplicate check active
          </div>
        </div>

        {/* Card 3: Pending Review */}
        <div className="stat-card" style={pendingItems.length > 0 ? { borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.04)' } : {}}>
          <div className="stat-card-header">
            <span className="stat-label">Pending User Review</span>
            <div className="stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.6rem', marginTop: '8px', color: pendingItems.length > 0 ? '#f59e0b' : 'inherit' }}>
            {pendingItems.length}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Requires verification before ledger
          </div>
        </div>

        {/* Card 4: Total Detected */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Detected</span>
            <div className="stat-icon-wrap income">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.6rem', marginTop: '8px' }}>
            {status.detected_count}
          </div>
          <div className="stat-footer" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Approved in ledger: <strong>{status.approved_auto_count}</strong>
          </div>
        </div>
      </div>

      {/* Action Controls Card */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Provider Management & Sync Controls</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Choose detection mode, run on-demand synchronization, or manage financial accounts.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            {/* Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <Sliders size={16} style={{ color: 'var(--text-muted)' }} />
              <label htmlFor="detection-mode-select" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mode:</label>
              <select
                id="detection-mode-select"
                value={selectedMode}
                onChange={handleModeChange}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="demo">Demo Provider (Sandbox)</option>
                <option value="real">Authorized Provider (Plaid API)</option>
                <option value="disconnected">Disconnected (Manual Only)</option>
              </select>
            </div>

            {/* Sync Transactions Button */}
            <button
              id="sync-transactions-btn"
              className="btn btn-primary"
              onClick={handleSync}
              disabled={syncing || selectedMode === 'disconnected'}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} className={syncing ? 'spin-animation' : ''} />
              <span>{syncing ? 'Syncing Feeds...' : 'Sync Transactions'}</span>
            </button>

            {/* Connect Provider Button */}
            <button
              id="connect-provider-btn"
              className="btn btn-secondary"
              onClick={() => setShowConnectModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Landmark size={16} />
              <span>Connect Provider</span>
            </button>

            {/* View History Shortcut */}
            {onNavigateToHistory && (
              <button
                id="view-history-shortcut-btn"
                className="btn btn-secondary"
                onClick={onNavigateToHistory}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>View Ledger</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Sync Result Banner */}
        {syncResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>
                <strong>Sync Results ({syncResult.provider}):</strong> {syncResult.transactions_found} found,{' '}
                <span style={{ color: 'var(--color-income)', fontWeight: 600 }}>{syncResult.imported_count} imported</span>,{' '}
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>{syncResult.pending_count} sent to review</span>,{' '}
                <span>{syncResult.duplicates_skipped} duplicates skipped</span>.
              </span>
            </div>
            <button
              className="icon-button"
              onClick={() => setSyncResult(null)}
              style={{ width: '24px', height: '24px' }}
              aria-label="Dismiss sync result"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* PENDING TRANSACTIONS REVIEW QUEUE */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className="section-card" id="pending-review-section" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="chart-card-title" style={{ margin: 0 }}>Review Pending Transactions</h2>
              {pendingItems.length > 0 && (
                <span style={{ background: '#f59e0b', color: '#000', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                  {pendingItems.length} awaiting review
                </span>
              )}
            </div>
            <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
              Verify auto-detected transactions before adding them to your official balance and reports.
            </p>
          </div>

          {pendingItems.length > 0 && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="bulk-approve-btn"
                className="btn btn-primary"
                onClick={() => handleBulkReview('approve')}
                disabled={loading}
                style={{ background: 'var(--color-income)', borderColor: 'var(--color-income)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px' }}
              >
                <CheckCheck size={16} />
                <span>Approve All ({pendingItems.length})</span>
              </button>
              <button
                id="bulk-reject-btn"
                className="btn btn-secondary"
                onClick={() => handleBulkReview('reject')}
                disabled={loading}
                style={{ color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px' }}
              >
                <XCircle size={16} />
                <span>Reject All</span>
              </button>
            </div>
          )}
        </div>

        {/* Table or Empty State */}
        {pendingItems.length === 0 ? (
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
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--color-income)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600 }}>Review Queue Clean</h4>
            <p style={{ margin: '0 auto 20px auto', maxWidth: '420px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No pending transactions to review. All detected transactions have been processed and confirmed into your financial ledger.
            </p>
            <button
              className="btn btn-secondary"
              onClick={handleSync}
              disabled={syncing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} className={syncing ? 'spin-animation' : ''} />
              <span>Run Sync Now</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="fintech-table" id="pending-transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description / Merchant</th>
                  <th>Type</th>
                  <th>Suggested Category</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map((item) => (
                  <tr key={item.id} id={`pending-row-${item.id}`}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{item.transaction_date}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.description}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ background: 'var(--bg-surface-elevated)', padding: '1px 6px', borderRadius: '4px' }}>
                          ID: {item.external_id || item.id}
                        </span>
                        {item.is_demo && (
                          <span style={{ color: '#fbbf24', fontStyle: 'italic' }}>Simulated</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${item.transaction_type === 'income' ? 'badge-income' : 'badge-expense'}`}
                        style={{
                          textTransform: 'capitalize',
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: item.transaction_type === 'income' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: item.transaction_type === 'income' ? 'var(--color-income)' : 'var(--color-danger, #ef4444)'
                        }}
                      >
                        {item.transaction_type}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {item.payment_method}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: item.transaction_type === 'income' ? 'var(--color-income)' : 'var(--text-main)'
                      }}
                    >
                      {item.transaction_type === 'income' ? '+' : '-'}{formatAmount(item.amount)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {/* Approve */}
                        <button
                          className="icon-button"
                          title="Approve transaction into ledger"
                          aria-label="Approve transaction"
                          disabled={actionLoadingId === item.id}
                          onClick={() => handleReview(item.id, 'approve')}
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--color-income)',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <Check size={16} />
                        </button>

                        {/* Edit & Approve */}
                        <button
                          className="icon-button"
                          title="Edit category or type before approving"
                          aria-label="Edit and approve"
                          disabled={actionLoadingId === item.id}
                          onClick={() => openEditModal(item)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                          }}
                        >
                          <Edit3 size={15} />
                        </button>

                        {/* Reject */}
                        <button
                          className="icon-button"
                          title="Reject and exclude from ledger"
                          aria-label="Reject transaction"
                          disabled={actionLoadingId === item.id}
                          onClick={() => handleReview(item.id, 'reject')}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--color-danger, #ef4444)',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* RECENT SYNC HISTORY & AUDIT LOG */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <h2 className="chart-card-title">Recent Sync Executions & Audit Log</h2>
        <p className="chart-card-subtitle">Transparent record of all synchronization jobs and duplicate checks</p>

        {syncHistory.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No synchronization history recorded yet. Click "Sync Transactions" above to trigger your first run.
          </div>
        ) : (
          <div className="table-responsive" style={{ marginTop: '16px' }}>
            <table className="fintech-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Provider</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Found</th>
                  <th>Imported</th>
                  <th>Pending Review</th>
                  <th>Result / Notes</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{h.timestamp}</td>
                    <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{h.provider}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {h.sync_mode}
                      </span>
                    </td>
                    <td>
                      {h.status === 'success' ? (
                        <span style={{ color: 'var(--color-income)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Success
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                          <XCircle size={14} /> Failed
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{h.transactions_found}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-income)', fontWeight: 600 }}>{h.transactions_imported}</td>
                    <td style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>{h.transactions_pending}</td>
                    <td style={{ fontSize: '0.82rem', color: h.error_message ? 'var(--color-danger, #ef4444)' : 'var(--text-muted)' }}>
                      {h.error_message || 'Completed cleanly without errors'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* EDIT & APPROVE MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {editingItem && (
        <div className="modal-backdrop" onClick={() => setEditingItem(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '90%', padding: '24px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit & Approve Transaction</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setEditingItem(null)}
                style={{ width: '28px', height: '28px' }}
                aria-label="Close edit modal"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '18px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{editingItem.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span>Date: {editingItem.transaction_date}</span>
                <span style={{ fontWeight: 700, color: editingItem.transaction_type === 'income' ? 'var(--color-income)' : 'var(--text-main)' }}>
                  {formatAmount(editingItem.amount)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Transaction Type
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${editForm.transaction_type === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setEditForm({ ...editForm, transaction_type: 'expense' })}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={`btn ${editForm.transaction_type === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setEditForm({ ...editForm, transaction_type: 'income' })}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="edit-category-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  id="edit-category-select"
                  className="form-control"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
                >
                  {(editForm.transaction_type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-notes-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Notes (Optional)
                </label>
                <input
                  id="edit-notes-input"
                  type="text"
                  placeholder="Add clarification notes..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setEditingItem(null)}
                disabled={actionLoadingId === editingItem.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={submitEditAndApprove}
                disabled={actionLoadingId === editingItem.id}
                style={{ background: 'var(--color-income)', borderColor: 'var(--color-income)', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={16} />
                <span>Save & Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* CONNECT REAL PROVIDER MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {showConnectModal && (
        <div className="modal-backdrop" onClick={() => setShowConnectModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '90%', padding: '24px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Landmark size={22} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Connect Banking Provider</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowConnectModal(false)}
                style={{ width: '28px', height: '28px' }}
                aria-label="Close provider modal"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              AI Expense Tracker adheres strictly to financial data privacy standards. Direct bank login credentials, passwords, card PINs, and SMS OTPs are <strong>never</strong> collected or stored.
            </p>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', margin: '16px 0', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '8px' }}>
                Official Open-Banking API Setup (.env)
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                To connect a live Open Banking provider (e.g., Plaid, Teller, or Nordigen), provide official client credentials in your backend <code>.env</code> file:
              </p>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '0.78rem', color: '#a5b4fc', overflowX: 'auto', margin: 0 }}>
{`BANKING_PROVIDER=plaid
BANKING_PROVIDER_CLIENT_ID=your_official_client_id
BANKING_PROVIDER_SECRET=your_official_secret_key
BANKING_PROVIDER_ENV=sandbox`}
              </pre>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <strong>Browser Notification & SMS Notice:</strong> Web applications cannot read mobile SMS messages or system notifications without explicit native app permission. For web deployment, automated syncing operates through authorized open-banking API webhooks and statement imports.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowConnectModal(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowConnectModal(false);
                  setSelectedMode('demo');
                  loadData('demo');
                  showToast('Operating in Demo Sandbox Mode with simulated transactions.', 'info');
                }}
              >
                Use Demo Sandbox Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
