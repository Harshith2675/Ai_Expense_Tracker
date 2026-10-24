import React from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertCircle
} from 'lucide-react';

export default function SummaryCards({ summary }) {
  const { formatAmount } = useCurrency();
  const {
    totalIncome = 0,
    totalExpenses = 0,
    availableBalance = 0,
    monthlyBudget = 5500,
    budgetPercent = 76.1,
    incomeChangePercent = 12.4,
    expenseChangePercent = -4.2,
    savingsRate = 55.7
  } = summary || {};

  return (
    <section className="summary-cards-grid" aria-label="Financial Summary Cards">
      {/* 1. Total Income Card */}
      <div className="stat-card income" id="summary-card-income">
        <div className="stat-card-header">
          <span className="stat-card-title">Total Income</span>
          <div className="stat-icon-wrapper">
            <TrendingUp size={22} />
          </div>
        </div>
        <div className="stat-value">{formatAmount(totalIncome)}</div>
        <div className="stat-card-footer">
          <span className="trend-badge positive">
            +{incomeChangePercent}%
          </span>
          <span>vs last month</span>
        </div>
      </div>

      {/* 2. Total Expenses Card */}
      <div className="stat-card expense" id="summary-card-expense">
        <div className="stat-card-header">
          <span className="stat-card-title">Total Expenses</span>
          <div className="stat-icon-wrapper">
            <TrendingDown size={22} />
          </div>
        </div>
        <div className="stat-value">{formatAmount(totalExpenses)}</div>
        <div className="stat-card-footer">
          <span className="trend-badge positive">
            {expenseChangePercent}%
          </span>
          <span>reduced burn rate</span>
        </div>
      </div>

      {/* 3. Available Balance Card */}
      <div className="stat-card balance" id="summary-card-balance">
        <div className="stat-card-header">
          <span className="stat-card-title">Available Balance</span>
          <div className="stat-icon-wrapper">
            <Wallet size={22} />
          </div>
        </div>
        <div className="stat-value">{formatAmount(availableBalance)}</div>
        <div className="stat-card-footer">
          <span className="trend-badge neutral">
            {savingsRate}% savings
          </span>
          <span>healthy liquidity</span>
        </div>
      </div>

      {/* 4. Monthly Budget Usage Card */}
      <div className="stat-card budget" id="summary-card-budget">
        <div className="stat-card-header">
          <span className="stat-card-title">Monthly Budget Usage</span>
          <div className="stat-icon-wrapper">
            <PiggyBank size={22} />
          </div>
        </div>
        <div className="stat-value">{budgetPercent}%</div>
        <div className="budget-progress-bar">
          <div
            className="budget-progress-fill"
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>
        <div className="stat-card-footer" style={{ marginTop: '10px' }}>
          <span>Limit: {formatAmount(monthlyBudget)}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: budgetPercent > 90 ? 'var(--color-expense)' : 'var(--text-muted)' }}>
            {formatAmount(monthlyBudget - totalExpenses)} left
          </span>
        </div>
      </div>
    </section>
  );
}
