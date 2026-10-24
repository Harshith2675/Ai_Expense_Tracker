import React, { useState, useEffect } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { X, TrendingUp, AlertCircle } from 'lucide-react';

export default function AddIncomeModal({ isOpen, onClose, onAddIncome }) {
  const { symbol } = useCurrency();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Salary');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [detectionMethod, setDetectionMethod] = useState('manual');
  const [payer, setPayer] = useState('');
  const [error, setError] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid income amount greater than 0.');
      return;
    }

    onAddIncome({
      id: `tx-${Date.now()}`,
      description: description.trim(),
      merchant: payer.trim() || description.trim(),
      amount: parsedAmount,
      category,
      date,
      type: 'income',
      detectionMethod,
      status: 'cleared'
    });

    // Reset and close
    setDescription('');
    setAmount('');
    setPayer('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" id="add-income-modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        id="add-income-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-income-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title" id="add-income-title">
            <TrendingUp size={20} style={{ color: 'var(--color-income)' }} />
            <span>Record New Income</span>
          </div>
          <button
            id="close-income-modal-btn"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-expense)', fontSize: '0.84rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="income-desc-input" className="form-label">
                Income Source / Description *
              </label>
              <input
                id="income-desc-input"
                type="text"
                className="form-input"
                placeholder="e.g. Monthly Salary, Freelance project, Stock dividend"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError('');
                }}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="income-amount-input" className="form-label">
                  Amount ({symbol}) *
                </label>
                <input
                  id="income-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="income-category-select" className="form-label">
                  Income Category *
                </label>
                <select
                  id="income-category-select"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Salary">Salary</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Investments">Investments / Dividends</option>
                  <option value="Bonus">Bonus</option>
                  <option value="Other Income">Other Income</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="income-date-input" className="form-label">
                  Date
                </label>
                <input
                  id="income-date-input"
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="income-method-select" className="form-label">
                  Detection Method
                </label>
                <select
                  id="income-method-select"
                  className="form-select"
                  value={detectionMethod}
                  onChange={(e) => setDetectionMethod(e.target.value)}
                >
                  <option value="manual">Manual Entry</option>
                  <option value="automatic">Automatic Direct Deposit</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="income-payer-input" className="form-label">
                Payer / Company (Optional)
              </label>
              <input
                id="income-payer-input"
                type="text"
                className="form-input"
                placeholder="e.g. Acme Corp Inc."
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              id="cancel-income-btn"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-income-btn"
              className="btn btn-income"
            >
              Add Income
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
