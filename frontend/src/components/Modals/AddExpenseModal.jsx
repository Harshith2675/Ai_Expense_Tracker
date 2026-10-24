import React, { useState, useEffect } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { X, Sparkles, AlertCircle, PlusCircle } from 'lucide-react';
import { predictCategory } from '../../services/apiService';

export default function AddExpenseModal({ isOpen, onClose, onAddExpense, categories }) {
  const { symbol } = useCurrency();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [detectionMethod, setDetectionMethod] = useState('manual');
  const [merchant, setMerchant] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(null);
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

  // AI Instant Category suggestion preview as user types description
  useEffect(() => {
    if (!description || description.trim().length < 3) {
      setAiSuggestion(null);
      return;
    }
    const timer = setTimeout(async () => {
      const pred = await predictCategory(description);
      if (pred && pred.category && pred.confidence > 0.6) {
        setAiSuggestion(pred);
      } else {
        setAiSuggestion(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [description]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    onAddExpense({
      id: `tx-${Date.now()}`,
      description: description.trim(),
      merchant: merchant.trim() || description.trim(),
      amount: parsedAmount,
      category,
      date,
      type: 'expense',
      detectionMethod,
      status: 'cleared'
    });

    // Reset and close
    setDescription('');
    setAmount('');
    setMerchant('');
    setError('');
    onClose();
  };

  const expenseCategories = categories.filter((c) => !c.type || c.type === 'expense');

  return (
    <div className="modal-overlay" id="add-expense-modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        id="add-expense-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-expense-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title" id="add-expense-title">
            <PlusCircle size={20} style={{ color: 'var(--color-expense)' }} />
            <span>Record New Expense</span>
          </div>
          <button
            id="close-expense-modal-btn"
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
              <label htmlFor="expense-desc-input" className="form-label">
                Expense Description *
              </label>
              <input
                id="expense-desc-input"
                type="text"
                className="form-input"
                placeholder="e.g. Whole Foods groceries, Uber ride, Sonic WiFi"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError('');
                }}
                autoFocus
                required
              />
            </div>

            {/* AI Category Suggestion Pill */}
            {aiSuggestion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  id="apply-ai-category-suggestion"
                  className="ai-suggestion-chip"
                  onClick={() => setCategory(aiSuggestion.category)}
                  title="Click to apply AI suggested category"
                >
                  <Sparkles size={13} />
                  <span>AI Suggestion: <strong>{aiSuggestion.category}</strong> ({Math.round(aiSuggestion.confidence * 100)}% match)</span>
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="expense-amount-input" className="form-label">
                  Amount ({symbol}) *
                </label>
                <input
                  id="expense-amount-input"
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
                <label htmlFor="expense-category-select" className="form-label">
                  Category *
                </label>
                <select
                  id="expense-category-select"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="expense-date-input" className="form-label">
                  Date
                </label>
                <input
                  id="expense-date-input"
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="expense-method-select" className="form-label">
                  Detection Method
                </label>
                <select
                  id="expense-method-select"
                  className="form-select"
                  value={detectionMethod}
                  onChange={(e) => setDetectionMethod(e.target.value)}
                >
                  <option value="manual">Manual Entry</option>
                  <option value="automatic">Automatic (Simulated Rule)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="expense-merchant-input" className="form-label">
                Merchant / Store (Optional)
              </label>
              <input
                id="expense-merchant-input"
                type="text"
                className="form-input"
                placeholder="e.g. Target Store #201"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              id="cancel-expense-btn"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-expense-btn"
              className="btn btn-primary"
            >
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
