import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Calendar
} from 'lucide-react';

export default function RecentTransactions({
  transactions,
  onDeleteTransaction,
  searchQuery = '',
  categories = []
}) {
  const { formatAmount } = useCurrency();
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income', 'automatic', 'manual'
  const [localSearch, setLocalSearch] = useState('');

  const query = (searchQuery || localSearch).toLowerCase().trim();

  const filteredTransactions = transactions.filter((tx) => {
    // Type/Detection filter
    if (filterType === 'expense' && tx.type !== 'expense') return false;
    if (filterType === 'income' && tx.type !== 'income') return false;
    if (filterType === 'automatic' && tx.detectionMethod !== 'automatic') return false;
    if (filterType === 'manual' && tx.detectionMethod !== 'manual') return false;

    // Search query matching description, merchant, or category
    if (query) {
      const matchDesc = tx.description?.toLowerCase().includes(query);
      const matchMerchant = tx.merchant?.toLowerCase().includes(query);
      const matchCategory = tx.category?.toLowerCase().includes(query);
      return matchDesc || matchMerchant || matchCategory;
    }
    return true;
  });

  const getCategoryColor = (catName) => {
    const found = categories.find((c) => c.name.toLowerCase() === catName?.toLowerCase());
    return found ? found.color : '#64748b';
  };

  return (
    <div className="transactions-card" id="recent-transactions-card">
      <div className="transactions-card-header">
        <div>
          <h2 className="chart-card-title">Recent Transactions</h2>
          <p className="chart-card-subtitle">
            Showing {filteredTransactions.length} of {transactions.length} recorded items
          </p>
        </div>

        {/* Filter Pills */}
        <div className="filter-pills">
          <button
            id="filter-all-btn"
            className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button
            id="filter-expenses-btn"
            className={`filter-pill ${filterType === 'expense' ? 'active' : ''}`}
            onClick={() => setFilterType('expense')}
          >
            Expenses
          </button>
          <button
            id="filter-income-btn"
            className={`filter-pill ${filterType === 'income' ? 'active' : ''}`}
            onClick={() => setFilterType('income')}
          >
            Income
          </button>
          <button
            id="filter-automatic-btn"
            className={`filter-pill ${filterType === 'automatic' ? 'active' : ''}`}
            onClick={() => setFilterType('automatic')}
            title="Transactions processed with automated rule matching"
          >
            Automatic
          </button>
          <button
            id="filter-manual-btn"
            className={`filter-pill ${filterType === 'manual' ? 'active' : ''}`}
            onClick={() => setFilterType('manual')}
          >
            Manual
          </button>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="empty-state-box" id="transactions-empty-state">
          <div className="empty-state-icon">
            <SlidersHorizontal size={24} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>No transactions found</h3>
          <p style={{ fontSize: '0.85rem' }}>
            No records match the current filter or search criteria.
          </p>
          <button
            id="reset-filter-btn"
            className="btn btn-secondary"
            onClick={() => {
              setFilterType('all');
              setLocalSearch('');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="fintech-table" id="transactions-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Category</th>
                <th>Date</th>
                <th>Method</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center', width: '60px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const catColor = getCategoryColor(tx.category);
                return (
                  <tr key={tx.id} id={`tx-row-${tx.id}`}>
                    <td>
                      <div className="tx-description-cell">
                        <div className={`tx-icon-circle ${isIncome ? 'income' : 'expense'}`}>
                          {isIncome ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div>
                          <div className="tx-main-desc">{tx.description}</div>
                          <div className="tx-sub-info">
                            {tx.merchant || tx.account || 'Direct Entry'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: `${catColor}20`,
                          color: catColor,
                          border: `1px solid ${catColor}40`
                        }}
                      >
                        {tx.category}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <Calendar size={13} />
                        <span>{tx.date}</span>
                      </div>
                    </td>
                    <td>
                      {tx.detectionMethod === 'automatic' ? (
                        <span className="badge badge-auto" title="Classified by pattern matching engine">
                          <Sparkles size={11} />
                          Automatic
                        </span>
                      ) : (
                        <span className="badge badge-manual" title="User manually created entry">
                          Manual
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`tx-amount ${isIncome ? 'income' : 'expense'}`}>
                        {isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        id={`delete-tx-${tx.id}`}
                        className="icon-button"
                        style={{ width: '32px', height: '32px', color: 'var(--text-subtle)' }}
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="Delete transaction"
                        aria-label={`Delete transaction ${tx.description}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
