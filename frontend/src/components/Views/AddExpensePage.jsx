import React, { useState, useCallback } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import {
  PlusCircle, X, CheckCircle, AlertTriangle, Loader,
  DollarSign, Calendar, Tag, CreditCard, FileText, StickyNote
} from 'lucide-react';
import { createTransaction } from '../../services/apiService';

// ─────────────────────────────────────────────────────────────── constants
const EXPENSE_CATEGORIES = [
  'Food', 'Groceries', 'Transportation', 'Shopping',
  'Education', 'Healthcare', 'Entertainment', 'Bills',
  'Rent', 'Travel', 'Other'
];

const PAYMENT_METHODS = [
  'Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'
];

const EMPTY_FORM = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  category: '',
  paymentMethod: 'Cash',
  description: '',
  notes: '',
};

// ─────────────────────────────────────────────────────────────── helpers
function validate(fields) {
  const errs = {};
  const amt = parseFloat(fields.amount);
  if (!fields.amount || isNaN(amt) || amt <= 0)
    errs.amount = 'Please enter an amount greater than zero.';
  if (!fields.date)
    errs.date = 'Transaction date is required.';
  if (!fields.category)
    errs.category = 'Please select a category.';
  if (!fields.description.trim())
    errs.description = 'Please enter a description or merchant name.';
  return errs;
}

// ─────────────────────────────────────────────────────────────── component
export default function AddExpensePage({ onAddExpense, onCancel, backendOnline }) {
  const { symbol } = useCurrency();
  const [fields, setFields]       = useState(EMPTY_FORM);
  const [errors, setErrors]       = useState({});
  const [status, setStatus]       = useState('idle'); // idle | loading | success | error
  const [apiMsg, setApiMsg]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback((key) => (e) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // prevent duplicate submissions

    const validationErrs = validate(fields);
    if (Object.keys(validationErrs).length > 0) {
      setErrors(validationErrs);
      return;
    }

    setSubmitting(true);
    setStatus('loading');
    setApiMsg('');

    const payload = {
      type: 'expense',
      amount: parseFloat(fields.amount),
      date: fields.date,
      category: fields.category,
      paymentMethod: fields.paymentMethod,
      description: fields.description.trim(),
      notes: fields.notes.trim(),
    };

    if (backendOnline) {
      const result = await createTransaction(payload);
      if (result.errors || result.apiError) {
        const msg = result.errors ? result.errors.join(' ') : result.apiError;
        setApiMsg(msg);
        setStatus('error');
        setSubmitting(false);
        return;
      }
      // Backend saved: use the returned record (has real id, timestamps)
      if (result.data && onAddExpense) onAddExpense(result.data);
    } else {
      // Offline: create a local optimistic record
      const localRecord = {
        id: `local-${Date.now()}`,
        type: 'expense',
        category: fields.category,
        description: fields.description.trim(),
        merchant: fields.description.trim(),
        paymentMethod: fields.paymentMethod,
        amount: parseFloat(fields.amount),
        date: fields.date,
        notes: fields.notes.trim(),
        detectionMethod: 'manual',
        isFromDB: false,
      };
      if (onAddExpense) onAddExpense(localRecord);
    }

    setStatus('success');
    setFields(EMPTY_FORM);

    // Auto-reset success message after 2.5 s
    setTimeout(() => {
      setStatus('idle');
      setSubmitting(false);
    }, 2500);
  };

  const handleCancel = () => {
    setFields(EMPTY_FORM);
    setErrors({});
    setStatus('idle');
    if (onCancel) onCancel();
  };

  return (
    <div className="view-container" id="add-expense-view">
      <div className="section-card" style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* ─── Header ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h2 className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'var(--expense-color, #ef4444)',
                borderRadius: '10px',
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center'
              }}>
                <PlusCircle size={18} color="#fff" />
              </span>
              Add Expense
            </h2>
            <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
              Record a new expense transaction to your ledger
            </p>
          </div>
          <button
            id="add-expense-cancel-top"
            className="icon-button"
            onClick={handleCancel}
            title="Cancel and go back"
            style={{ width: '36px', height: '36px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Status banners ─── */}
        {status === 'success' && (
          <div className="alert-banner success" id="expense-success-msg" role="alert">
            <CheckCircle size={18} />
            <span>Expense saved successfully{!backendOnline ? ' (locally — backend offline)' : ''}!</span>
          </div>
        )}
        {status === 'error' && (
          <div className="alert-banner error" id="expense-error-msg" role="alert">
            <AlertTriangle size={18} />
            <span>{apiMsg || 'Something went wrong. Please try again.'}</span>
          </div>
        )}
        {!backendOnline && (
          <div className="alert-banner warning" id="expense-offline-msg">
            <AlertTriangle size={16} />
            <span>Backend offline — expense will be saved locally and will not persist after reload.</span>
          </div>
        )}

        {/* ─── Form ─── */}
        <form id="add-expense-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid-2">

            {/* Amount */}
            <div className="form-group">
              <label className="form-label" htmlFor="expense-amount">
                <DollarSign size={14} /> Amount ({symbol}) <span className="required-star">*</span>
              </label>
              <input
                id="expense-amount"
                type="number"
                className={`form-input ${errors.amount ? 'input-error' : ''}`}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={fields.amount}
                onChange={set('amount')}
                disabled={status === 'loading'}
              />
              {errors.amount && <span className="form-error">{errors.amount}</span>}
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="expense-date">
                <Calendar size={14} /> Transaction Date <span className="required-star">*</span>
              </label>
              <input
                id="expense-date"
                type="date"
                className={`form-input ${errors.date ? 'input-error' : ''}`}
                value={fields.date}
                onChange={set('date')}
                disabled={status === 'loading'}
              />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label" htmlFor="expense-category">
                <Tag size={14} /> Category <span className="required-star">*</span>
              </label>
              <select
                id="expense-category"
                className={`form-select ${errors.category ? 'input-error' : ''}`}
                value={fields.category}
                onChange={set('category')}
                disabled={status === 'loading'}
              >
                <option value="">-- Select a category --</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <span className="form-error">{errors.category}</span>}
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label" htmlFor="expense-payment">
                <CreditCard size={14} /> Payment Method
              </label>
              <select
                id="expense-payment"
                className="form-select"
                value={fields.paymentMethod}
                onChange={set('paymentMethod')}
                disabled={status === 'loading'}
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description (full-width) */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" htmlFor="expense-description">
              <FileText size={14} /> Description / Merchant <span className="required-star">*</span>
            </label>
            <input
              id="expense-description"
              type="text"
              className={`form-input ${errors.description ? 'input-error' : ''}`}
              placeholder="e.g. Swiggy – Biryani order"
              maxLength={200}
              value={fields.description}
              onChange={set('description')}
              disabled={status === 'loading'}
            />
            {errors.description && <span className="form-error">{errors.description}</span>}
          </div>

          {/* Notes (full-width, optional) */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" htmlFor="expense-notes">
              <StickyNote size={14} /> Notes <span className="optional-label">(optional)</span>
            </label>
            <textarea
              id="expense-notes"
              className="form-input form-textarea"
              placeholder="Any additional notes…"
              rows={3}
              maxLength={500}
              value={fields.notes}
              onChange={set('notes')}
              disabled={status === 'loading'}
            />
          </div>

          {/* Action Buttons */}
          <div className="form-actions" style={{ marginTop: '28px' }}>
            <button
              id="add-expense-save-btn"
              type="submit"
              className="btn btn-primary"
              disabled={status === 'loading' || submitting}
            >
              {status === 'loading' ? (
                <><Loader size={16} className="spin-icon" /> Saving…</>
              ) : (
                <><PlusCircle size={16} /> Save Expense</>
              )}
            </button>
            <button
              id="add-expense-cancel-btn"
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={status === 'loading'}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
