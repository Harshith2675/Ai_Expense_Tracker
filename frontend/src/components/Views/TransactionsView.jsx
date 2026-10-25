/**
 * TransactionsView.jsx
 * Full-featured transaction history: search, filters, sort, pagination,
 * inline edit modal, delete confirmation, empty state, CSV export.
 * Uses backend pagination via GET /api/transactions with query params.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import {
  Download, PlusCircle, TrendingUp, Search, Sparkles,
  ArrowDownLeft, ArrowUpRight, Trash2, Calendar, Edit2,
  ChevronLeft, ChevronRight, X, CheckCircle, AlertTriangle,
  Loader, RefreshCw, Filter
} from 'lucide-react';
import { fetchTransactions, updateTransaction, deleteTransaction } from '../../services/apiService';

// ─────────────────────────────────────────────────────────────── constants
const EXPENSE_CATEGORIES = [
  'Food','Groceries','Transportation','Shopping',
  'Education','Healthcare','Entertainment','Bills','Rent','Travel','Other'
];
const INCOME_SOURCES = ['Salary','Freelance','Business','Investment','Gift','Other'];
const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_SOURCES];
const PAYMENT_METHODS = ['Cash','UPI','Debit Card','Credit Card','Bank Transfer','Other'];
const PAGE_SIZE = 10;

const EMPTY_EDIT = {
  amount: '', date: '', category: '', paymentMethod: '', description: '', notes: ''
};

// ─────────────────────────────────────────────────────────────── helpers
function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return s; }
}

// ─────────────────────────────────────────────────────────────── component
export default function TransactionsView({
  transactions: propTxns,       // fallback when backend offline
  categories: _propCategories,
  onDeleteTransaction,          // bubble-up to App to update global state
  onOpenAddExpense,
  onOpenAddIncome,
  onRefreshSummary,             // called after edit/delete so dashboard updates
  backendOnline,
}) {
  const { currency, symbol, formatAmount } = useCurrency();

  // ── Filter / sort state ──
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('all');
  const [filterCat, setFilterCat]     = useState('');
  const [filterPay, setFilterPay]     = useState('');
  const [filterDet, setFilterDet]     = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [sort, setSort]               = useState('newest');
  const [page, setPage]               = useState(1);

  // ── Data state ──
  const [rows, setRows]               = useState([]);
  const [pagination, setPagination]   = useState({ page:1, pages:1, total:0 });
  const [loading, setLoading]         = useState(false);
  const [loadError, setLoadError]     = useState('');
  const [usingBackend, setUsingBackend] = useState(false);

  // ── Edit modal ──
  const [editTx, setEditTx]           = useState(null);
  const [editFields, setEditFields]   = useState(EMPTY_EDIT);
  const [editErrors, setEditErrors]   = useState({});
  const [editStatus, setEditStatus]   = useState('idle'); // idle|loading|success|error
  const [editMsg, setEditMsg]         = useState('');

  // ── Delete confirm ──
  const [deleteTx, setDeleteTx]       = useState(null);
  const [deleteStatus, setDeleteStatus] = useState('idle'); // idle|loading
  const [deleteMsg, setDeleteMsg]     = useState('');

  // ── Toast ──
  const [toast, setToast]             = useState(''); // success message
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  // ─── Load from backend ────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!backendOnline) {
      // Offline: filter/sort/paginate locally from prop data
      let filtered = [...(propTxns || [])];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(t =>
          (t.description || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q) ||
          (t.paymentMethod || t.payment_method || '').toLowerCase().includes(q)
        );
      }
      if (filterType !== 'all') {
        filtered = filtered.filter(t => (t.type || t.transaction_type || '').toLowerCase() === filterType.toLowerCase());
      }
      if (filterCat) {
        filtered = filtered.filter(t => (t.category || '').toLowerCase() === filterCat.toLowerCase());
      }
      if (filterPay) {
        filtered = filtered.filter(t => (t.paymentMethod || t.payment_method || '').toLowerCase() === filterPay.toLowerCase());
      }
      if (filterDet) {
        filtered = filtered.filter(t => (t.detectionMethod || t.detection_method || '').toLowerCase() === filterDet.toLowerCase());
      }
      if (dateFrom) {
        filtered = filtered.filter(t => (t.date || t.transaction_date || '') >= dateFrom);
      }
      if (dateTo) {
        filtered = filtered.filter(t => (t.date || t.transaction_date || '') <= dateTo);
      }

      // Sort
      filtered.sort((a, b) => {
        const dateA = a.date || a.transaction_date || '';
        const dateB = b.date || b.transaction_date || '';
        const amtA = Number(a.amount) || 0;
        const amtB = Number(b.amount) || 0;
        if (sort === 'oldest') return dateA.localeCompare(dateB);
        if (sort === 'highest') return amtB - amtA;
        if (sort === 'lowest') return amtA - amtB;
        return dateB.localeCompare(dateA);
      });

      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const currentPage = Math.min(page, pages);
      const pagedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

      setRows(pagedRows);
      setPagination({ page: currentPage, pages, total });
      setUsingBackend(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    const params = { page, limit: PAGE_SIZE, sort };
    if (search.trim())  params.q              = search.trim();
    if (filterType !== 'all') params.type     = filterType;
    if (filterCat)      params.category       = filterCat;
    if (filterPay)      params.payment_method = filterPay;
    if (filterDet)      params.detection      = filterDet;
    if (dateFrom)       params.date_from      = dateFrom;
    if (dateTo)         params.date_to        = dateTo;

    const result = await fetchTransactions(params);
    setLoading(false);

    if (!result) {
      setLoadError('Could not reach backend. Showing local data.');
      setRows(propTxns || []);
      setUsingBackend(false);
      return;
    }

    setRows(result.data);
    setPagination(result.pagination);
    setUsingBackend(true);
  }, [backendOnline, page, sort, search, filterType, filterCat, filterPay, filterDet, dateFrom, dateTo, propTxns]);

  // Re-fetch whenever any filter/page/sort changes
  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change (not page itself)
  const resetPage = () => setPage(1);

  const handleSearchChange = (v) => { setSearch(v); resetPage(); };
  const handleTypeChange   = (v) => { setFilterType(v); resetPage(); };
  const handleCatChange    = (v) => { setFilterCat(v); resetPage(); };
  const handlePayChange    = (v) => { setFilterPay(v); resetPage(); };
  const handleDetChange    = (v) => { setFilterDet(v); resetPage(); };
  const handleFromChange   = (v) => { setDateFrom(v); resetPage(); };
  const handleToChange     = (v) => { setDateTo(v); resetPage(); };
  const handleSortChange   = (v) => { setSort(v); resetPage(); };

  const clearFilters = () => {
    setSearch(''); setFilterType('all'); setFilterCat('');
    setFilterPay(''); setFilterDet(''); setDateFrom(''); setDateTo('');
    setSort('newest'); setPage(1);
  };

  const hasActiveFilters = search || filterType !== 'all' || filterCat ||
    filterPay || filterDet || dateFrom || dateTo || sort !== 'newest';

  // ─── CSV Export ────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['ID','Date','Description','Category','Payment Method','Type',`Amount (${currency})`,'Detection'];
    const csvRows = rows.map(t => [
      t.id, t.date,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.category, t.paymentMethod, t.type,
      t.amount, t.detectionMethod
    ]);
    const content = 'data:text/csv;charset=utf-8,'
      + [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(content);
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Edit ─────────────────────────────────────────────────────────────
  const openEdit = (tx) => {
    setEditTx(tx);
    setEditFields({
      amount:        String(tx.amount),
      date:          tx.date,
      category:      tx.category,
      paymentMethod: tx.paymentMethod,
      description:   tx.description,
      notes:         tx.notes || '',
    });
    setEditErrors({});
    setEditStatus('idle');
    setEditMsg('');
  };

  const closeEdit = () => { setEditTx(null); setEditStatus('idle'); };

  const setEdit = (key) => (e) => {
    setEditFields(p => ({ ...p, [key]: e.target.value }));
    setEditErrors(p => ({ ...p, [key]: undefined }));
  };

  const validateEdit = () => {
    const errs = {};
    const amt = parseFloat(editFields.amount);
    if (isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount > 0';
    if (!editFields.date)       errs.date = 'Date is required';
    if (!editFields.category)   errs.category = 'Category is required';
    if (!editFields.description.trim()) errs.description = 'Description is required';
    return errs;
  };

  const handleEditSave = async () => {
    const errs = validateEdit();
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setEditStatus('loading');
    const payload = {
      amount:           parseFloat(editFields.amount),
      transaction_date: editFields.date,
      category:         editFields.category,
      payment_method:   editFields.paymentMethod,
      description:      editFields.description.trim(),
      notes:            editFields.notes.trim(),
    };

    const result = await updateTransaction(editTx.id, payload);
    if (result.errors || result.apiError) {
      setEditMsg(result.errors ? result.errors.join(' ') : result.apiError);
      setEditStatus('error');
      return;
    }

    setEditStatus('success');
    setTimeout(() => {
      closeEdit();
      load();
      if (onRefreshSummary) onRefreshSummary();
      showToast('Transaction updated successfully.');
    }, 700);
  };

  // ─── Delete ────────────────────────────────────────────────────────────
  const openDelete = (tx) => {
    setDeleteTx(tx);
    setDeleteStatus('idle');
    setDeleteMsg('');
  };

  const closeDelete = () => { setDeleteTx(null); setDeleteStatus('idle'); };

  const handleDeleteConfirm = async () => {
    if (!deleteTx) return;
    setDeleteStatus('loading');

    const result = await deleteTransaction(deleteTx.id);
    if (!result.ok) {
      setDeleteMsg(result.apiError || 'Delete failed. Please try again.');
      setDeleteStatus('idle');
      return;
    }

    // Bubble up to App.jsx global state
    if (onDeleteTransaction) onDeleteTransaction(deleteTx.id);
    closeDelete();

    // If last item on current page, go to previous page
    if (rows.length === 1 && page > 1) setPage(p => p - 1);
    else load();

    if (onRefreshSummary) onRefreshSummary();
    showToast('Transaction deleted successfully.');
  };

  // ─────────────────────────────────────────────────────────────── render
  const totalPages = pagination.pages || 1;

  return (
    <div className="view-container" id="transactions-view">

      {/* ── Toast notification ── */}
      {toast && (
        <div className="tx-toast" role="alert">
          <CheckCircle size={16} />
          <span>{toast}</span>
        </div>
      )}

      <div className="section-card">
        {/* ── Header row ── */}
        <div className="txv-header">
          <div>
            <h2 className="chart-card-title">Transaction History</h2>
            <p className="chart-card-subtitle">
              {usingBackend
                ? `${pagination.total} record${pagination.total !== 1 ? 's' : ''} in database`
                : 'Showing local data — backend offline'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button id="tx-refresh-btn" className="btn btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
              <span>{loading ? 'Loading…' : 'Refresh'}</span>
            </button>
            <button id="export-csv-btn" className="btn btn-secondary" onClick={exportCSV}>
              <Download size={15} />
              <span>CSV</span>
            </button>
            <button id="add-expense-from-ledger" className="btn btn-primary" onClick={onOpenAddExpense}>
              <PlusCircle size={15} />
              <span>Add Expense</span>
            </button>
            <button id="add-income-from-ledger" className="btn btn-income" onClick={onOpenAddIncome}>
              <TrendingUp size={15} />
              <span>Add Income</span>
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="txv-filters">
          {/* Search */}
          <div className="search-box txv-search" style={{ gridColumn: 'span 2' }}>
            <Search size={15} className="search-icon" />
            <input
              id="ledger-search-input"
              type="text"
              className="search-input"
              placeholder="Search description or notes…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
            {search && (
              <button className="icon-button" style={{ width: '24px', height: '24px' }}
                onClick={() => handleSearchChange('')} title="Clear search">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Type */}
          <select id="ledger-type-filter" className="form-select"
            value={filterType} onChange={e => handleTypeChange(e.target.value)}>
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>

          {/* Category */}
          <select id="ledger-cat-filter" className="form-select"
            value={filterCat} onChange={e => handleCatChange(e.target.value)}>
            <option value="">All Categories</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Payment method */}
          <select id="ledger-pay-filter" className="form-select"
            value={filterPay} onChange={e => handlePayChange(e.target.value)}>
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Detection */}
          <select id="ledger-det-filter" className="form-select"
            value={filterDet} onChange={e => handleDetChange(e.target.value)}>
            <option value="">All Sources</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
          </select>

          {/* Date from */}
          <input type="date" className="form-input" id="ledger-date-from"
            value={dateFrom} onChange={e => handleFromChange(e.target.value)}
            title="From date" />

          {/* Date to */}
          <input type="date" className="form-input" id="ledger-date-to"
            value={dateTo} onChange={e => handleToChange(e.target.value)}
            title="To date" />

          {/* Sort */}
          <select id="ledger-sort" className="form-select"
            value={sort} onChange={e => handleSortChange(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button id="clear-filters-btn" className="btn btn-secondary"
              onClick={clearFilters} style={{ gridColumn: 'span 1' }}>
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>

        {/* ── Error banner ── */}
        {loadError && (
          <div className="alert-banner warning" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={16} /> {loadError}
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className="txv-loading-state">
            <Loader size={28} className="spin-icon" />
            <span>Loading transactions…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="txv-empty-state">
            <div className="txv-empty-icon">
              <Filter size={36} />
            </div>
            <h3>No transactions found</h3>
            <p>
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'Add your first expense or income to get started.'}
            </p>
            {hasActiveFilters && (
              <button className="btn btn-secondary" onClick={clearFilters}>
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="fintech-table" id="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Payment</th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center', width: '96px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(tx => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id}>
                      {/* Date */}
                      <td>
                        <div className="tx-date-cell">
                          <Calendar size={13} />
                          <span>{fmtDate(tx.date)}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td>
                        <div className="tx-description-cell">
                          <div className={`tx-icon-circle ${isIncome ? 'income' : 'expense'}`}>
                            {isIncome ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </div>
                          <div>
                            <div className="tx-main-desc">{tx.description}</div>
                            {tx.notes && (
                              <div className="tx-sub-info tx-notes-preview" title={tx.notes}>
                                {tx.notes.length > 40 ? tx.notes.slice(0, 40) + '…' : tx.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className={`badge ${isIncome ? 'badge-income' : 'badge-manual'}`}>
                          {tx.category}
                        </span>
                      </td>

                      {/* Payment */}
                      <td>
                        <span className="tx-payment-method">{tx.paymentMethod}</span>
                      </td>

                      {/* Detection */}
                      <td>
                        {tx.detectionMethod === 'automatic' ? (
                          <span className="badge badge-auto">
                            <Sparkles size={11} /> Auto
                          </span>
                        ) : (
                          <span className="badge badge-manual">Manual</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ textAlign: 'right' }}>
                        <span className={`tx-amount ${isIncome ? 'income' : 'expense'}`}>
                          {isIncome ? '+' : '−'}{formatAmount(tx.amount)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            id={`edit-tx-${tx.id}`}
                            className="icon-button"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => openEdit(tx)}
                            title="Edit transaction"
                            aria-label={`Edit ${tx.description}`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            id={`delete-tx-${tx.id}`}
                            className="icon-button icon-button-danger"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => openDelete(tx)}
                            title="Delete transaction"
                            aria-label={`Delete ${tx.description}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="txv-pagination" id="transactions-pagination">
            <span className="txv-page-info">
              Page {pagination.page} of {totalPages} &nbsp;·&nbsp; {pagination.total} total
            </span>
            <div className="txv-page-controls">
              <button
                id="pagination-prev"
                className="btn btn-secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce((acc, n, idx, arr) => {
                  if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === '…' ? (
                    <span key={`ellipsis-${i}`} className="txv-page-ellipsis">…</span>
                  ) : (
                    <button
                      key={item}
                      id={`pagination-page-${item}`}
                      className={`txv-page-pill ${item === page ? 'active' : ''}`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  )
                )
              }
              <button
                id="pagination-next"
                className="btn btn-secondary"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════ EDIT MODAL */}
      {editTx && (
        <div className="modal-overlay" id="edit-modal-overlay" onClick={closeEdit}>
          <div className="modal-container" id="edit-transaction-modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '580px' }}>

            <div className="modal-header">
              <h3 className="modal-title">
                <Edit2 size={18} style={{ marginRight: '8px' }} />
                Edit Transaction
              </h3>
              <button id="edit-modal-close" className="icon-button" onClick={closeEdit}
                style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {editStatus === 'success' && (
                <div className="alert-banner success">
                  <CheckCircle size={16} /> Saved successfully!
                </div>
              )}
              {editStatus === 'error' && (
                <div className="alert-banner error">
                  <AlertTriangle size={16} /> {editMsg}
                </div>
              )}

              <div className="form-grid-2">
                {/* Amount */}
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-amount">Amount ({symbol}) *</label>
                  <input id="edit-amount" type="number" className={`form-input ${editErrors.amount ? 'input-error' : ''}`}
                    min="0.01" step="0.01" value={editFields.amount}
                    onChange={setEdit('amount')} disabled={editStatus === 'loading'} />
                  {editErrors.amount && <span className="form-error">{editErrors.amount}</span>}
                </div>

                {/* Date */}
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-date">Date *</label>
                  <input id="edit-date" type="date" className={`form-input ${editErrors.date ? 'input-error' : ''}`}
                    value={editFields.date} onChange={setEdit('date')}
                    disabled={editStatus === 'loading'} />
                  {editErrors.date && <span className="form-error">{editErrors.date}</span>}
                </div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-category">Category *</label>
                  <select id="edit-category" className={`form-select ${editErrors.category ? 'input-error' : ''}`}
                    value={editFields.category} onChange={setEdit('category')}
                    disabled={editStatus === 'loading'}>
                    <option value="">-- Select --</option>
                    {(editTx?.type === 'income' ? INCOME_SOURCES : EXPENSE_CATEGORIES)
                      .map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {editErrors.category && <span className="form-error">{editErrors.category}</span>}
                </div>

                {/* Payment method */}
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-payment">Payment Method</label>
                  <select id="edit-payment" className="form-select"
                    value={editFields.paymentMethod} onChange={setEdit('paymentMethod')}
                    disabled={editStatus === 'loading'}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" htmlFor="edit-desc">Description *</label>
                <input id="edit-desc" type="text" className={`form-input ${editErrors.description ? 'input-error' : ''}`}
                  value={editFields.description} onChange={setEdit('description')}
                  maxLength={200} disabled={editStatus === 'loading'} />
                {editErrors.description && <span className="form-error">{editErrors.description}</span>}
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" htmlFor="edit-notes">
                  Notes <span className="optional-label">(optional)</span>
                </label>
                <textarea id="edit-notes" className="form-input form-textarea"
                  rows={3} maxLength={500}
                  value={editFields.notes} onChange={setEdit('notes')}
                  disabled={editStatus === 'loading'} />
              </div>
            </div>

            <div className="modal-footer">
              <button id="edit-save-btn" className="btn btn-primary"
                onClick={handleEditSave}
                disabled={editStatus === 'loading' || editStatus === 'success'}>
                {editStatus === 'loading'
                  ? <><Loader size={15} className="spin-icon" /> Saving…</>
                  : 'Save Changes'}
              </button>
              <button id="edit-cancel-btn" className="btn btn-secondary" onClick={closeEdit}
                disabled={editStatus === 'loading'}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ DELETE CONFIRM MODAL */}
      {deleteTx && (
        <div className="modal-overlay" id="delete-modal-overlay" onClick={closeDelete}>
          <div className="modal-container" id="delete-confirm-modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '440px' }}>

            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#ef4444' }}>
                <Trash2 size={18} style={{ marginRight: '8px' }} />
                Confirm Delete
              </h3>
              <button id="delete-modal-close" className="icon-button" onClick={closeDelete}
                style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text-main)', marginBottom: '12px' }}>
                Are you sure you want to permanently delete this transaction?
              </p>
              <div className="delete-confirm-card">
                <div className="tx-description-cell">
                  <div className={`tx-icon-circle ${deleteTx.type === 'income' ? 'income' : 'expense'}`}>
                    {deleteTx.type === 'income' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </div>
                  <div>
                    <div className="tx-main-desc">{deleteTx.description}</div>
                    <div className="tx-sub-info">{fmtDate(deleteTx.date)} · {deleteTx.category}</div>
                  </div>
                </div>
                <span className={`tx-amount ${deleteTx.type === 'income' ? 'income' : 'expense'}`}
                  style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {deleteTx.type === 'income' ? '+' : '−'}{formatAmount(deleteTx.amount)}
                </span>
              </div>
              {deleteMsg && (
                <div className="alert-banner error" style={{ marginTop: '12px' }}>
                  <AlertTriangle size={15} /> {deleteMsg}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button id="delete-confirm-btn" className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteStatus === 'loading'}>
                {deleteStatus === 'loading'
                  ? <><Loader size={15} className="spin-icon" /> Deleting…</>
                  : <><Trash2 size={15} /> Delete</>}
              </button>
              <button id="delete-cancel-btn" className="btn btn-secondary" onClick={closeDelete}
                disabled={deleteStatus === 'loading'}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
