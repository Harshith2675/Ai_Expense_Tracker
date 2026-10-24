import React, { useState, useCallback } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import {
  TrendingUp, X, CheckCircle, AlertTriangle, Loader,
  DollarSign, Calendar, Tag, FileText, StickyNote
} from 'lucide-react';
import { createTransaction } from '../../services/apiService';

const INCOME_SOURCES = [
  'Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'
];

const EMPTY_FORM = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  source: '',
  description: '',
  notes: '',
};

function validate(fields) {
  const errs = {};
  const amt = parseFloat(fields.amount);
  if (!fields.amount || isNaN(amt) || amt <= 0)
    errs.amount = 'Please enter an amount greater than zero.';
  if (!fields.date)
    errs.date = 'Transaction date is required.';
  if (!fields.source)
    errs.source = 'Please select an income source.';
  if (!fields.description.trim())
    errs.description = 'Please enter a description.';
  return errs;
}

export default function AddIncomePage({ onAddIncome, onCancel, backendOnline }) {
  const { symbol } = useCurrency();
  const [fields, setFields]         = useState(EMPTY_FORM);
  const [errors, setErrors]         = useState({});
  const [status, setStatus]         = useState('idle');
  const [apiMsg, setApiMsg]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback((key) => (e) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const validationErrs = validate(fields);
    if (Object.keys(validationErrs).length > 0) {
      setErrors(validationErrs);
      return;
    }

    setSubmitting(true);
    setStatus('loading');
    setApiMsg('');

    const payload = {
      type: 'income',
      amount: parseFloat(fields.amount),
      date: fields.date,
      category: fields.source,       // income source maps to category column
      paymentMethod: 'Bank Transfer', // sensible default for income
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
      if (result.data && onAddIncome) onAddIncome(result.data);
    } else {
      const localRecord = {
        id: `local-${Date.now()}`,
        type: 'income',
        category: fields.source,
        description: fields.description.trim(),
        merchant: fields.description.trim(),
        paymentMethod: 'Bank Transfer',
        amount: parseFloat(fields.amount),
        date: fields.date,
        notes: fields.notes.trim(),
        detectionMethod: 'manual',
        isFromDB: false,
      };
      if (onAddIncome) onAddIncome(localRecord);
    }

    setStatus('success');
    setFields(EMPTY_FORM);

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
    <div className="view-container" id="add-income-view">
      <div className="section-card" style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h2 className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'var(--income-color, #10b981)',
                borderRadius: '10px',
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center'
              }}>
                <TrendingUp size={18} color="#fff" />
              </span>
              Add Income
            </h2>
            <p className="chart-card-subtitle" style={{ marginTop: '4px' }}>
              Record a new income transaction to your ledger
            </p>
          </div>
          <button
            id="add-income-cancel-top"
            className="icon-button"
            onClick={handleCancel}
            title="Cancel and go back"
            style={{ width: '36px', height: '36px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status banners */}
        {status === 'success' && (
          <div className="alert-banner success" id="income-success-msg" role="alert">
            <CheckCircle size={18} />
            <span>Income saved successfully{!backendOnline ? ' (locally — backend offline)' : ''}!</span>
          </div>
        )}
        {status === 'error' && (
          <div className="alert-banner error" id="income-error-msg" role="alert">
            <AlertTriangle size={18} />
            <span>{apiMsg || 'Something went wrong. Please try again.'}</span>
          </div>
        )}
        {!backendOnline && (
          <div className="alert-banner warning" id="income-offline-msg">
            <AlertTriangle size={16} />
            <span>Backend offline — income will be saved locally only.</span>
          </div>
        )}

        {/* Form */}
        <form id="add-income-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid-2">

            {/* Amount */}
            <div className="form-group">
              <label className="form-label" htmlFor="income-amount">
                <DollarSign size={14} /> Amount ({symbol}) <span className="required-star">*</span>
              </label>
              <input
                id="income-amount"
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
              <label className="form-label" htmlFor="income-date">
                <Calendar size={14} /> Date <span className="required-star">*</span>
              </label>
              <input
                id="income-date"
                type="date"
                className={`form-input ${errors.date ? 'input-error' : ''}`}
                value={fields.date}
                onChange={set('date')}
                disabled={status === 'loading'}
              />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>

            {/* Income Source */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="income-source">
                <Tag size={14} /> Income Source <span className="required-star">*</span>
              </label>
              <select
                id="income-source"
                className={`form-select ${errors.source ? 'input-error' : ''}`}
                value={fields.source}
                onChange={set('source')}
                disabled={status === 'loading'}
              >
                <option value="">-- Select income source --</option>
                {INCOME_SOURCES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.source && <span className="form-error">{errors.source}</span>}
            </div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" htmlFor="income-description">
              <FileText size={14} /> Description <span className="required-star">*</span>
            </label>
            <input
              id="income-description"
              type="text"
              className={`form-input ${errors.description ? 'input-error' : ''}`}
              placeholder="e.g. October salary from Acme Corp"
              maxLength={200}
              value={fields.description}
              onChange={set('description')}
              disabled={status === 'loading'}
            />
            {errors.description && <span className="form-error">{errors.description}</span>}
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" htmlFor="income-notes">
              <StickyNote size={14} /> Notes <span className="optional-label">(optional)</span>
            </label>
            <textarea
              id="income-notes"
              className="form-input form-textarea"
              placeholder="Any additional notes…"
              rows={3}
              maxLength={500}
              value={fields.notes}
              onChange={set('notes')}
              disabled={status === 'loading'}
            />
          </div>

          {/* Actions */}
          <div className="form-actions" style={{ marginTop: '28px' }}>
            <button
              id="add-income-save-btn"
              type="submit"
              className="btn btn-income"
              disabled={status === 'loading' || submitting}
            >
              {status === 'loading' ? (
                <><Loader size={16} className="spin-icon" /> Saving…</>
              ) : (
                <><TrendingUp size={16} /> Save Income</>
              )}
            </button>
            <button
              id="add-income-cancel-btn"
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
