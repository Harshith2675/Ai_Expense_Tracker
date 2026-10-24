import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { FileBarChart, Download, Calendar, Printer, DollarSign, TrendingUp, Percent } from 'lucide-react';

export default function ReportsView({ summary = {}, monthlyData, categories }) {
  const { formatAmount } = useCurrency();
  const handlePrint = () => {
    window.print();
  };

  const netCashFlow = (summary.totalIncome || 0) - (summary.totalExpenses || 0);
  const dailyBurn = (summary.totalExpenses || 0) / 30;

  return (
    <div className="view-container" id="reports-view">
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="chart-card-title">Executive Financial Report</h2>
            <p className="chart-card-subtitle">Comprehensive monthly balance and expense allocation overview</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button id="print-report-btn" className="btn btn-secondary" onClick={handlePrint}>
              <Printer size={16} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* High-level KPI Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <div className="stat-card">
            <span className="stat-card-title">Net Cash Flow</span>
            <div className="stat-value" style={{ marginTop: '6px', color: 'var(--color-income)' }}>
              {netCashFlow >= 0 ? '+' : '-'}{formatAmount(Math.abs(netCashFlow))}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-card-title">Savings Rate</span>
            <div className="stat-value" style={{ marginTop: '6px' }}>{summary.savingsRate || 0}%</div>
          </div>
          <div className="stat-card">
            <span className="stat-card-title">Average Daily Burn</span>
            <div className="stat-value" style={{ marginTop: '6px' }}>
              {formatAmount(dailyBurn)}/day
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-card-title">Budget Health</span>
            <div className="stat-value" style={{ marginTop: '6px', color: 'var(--accent-primary)' }}>Optimal</div>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>Category Allocation Breakdown</h3>
        <div className="table-responsive">
          <table className="fintech-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Spent</th>
                <th>Allocated Budget</th>
                <th>Budget Used</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {categories.filter((c) => !c.type || c.type === 'expense').map((cat) => {
                const spent = cat.spent || 0;
                const budget = cat.budget || 500;
                const pct = Math.round((spent / budget) * 100);
                const diff = budget - spent;
                return (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <span className="category-color-dot" style={{ backgroundColor: cat.color }} />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(spent)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(budget)}</td>
                    <td>
                      <span className="badge" style={{ background: pct > 90 ? 'var(--color-expense-soft)' : 'var(--accent-primary-soft)', color: pct > 90 ? 'var(--color-expense)' : '#a5b4fc' }}>
                        {pct}%
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: diff >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {diff >= 0 ? `+${formatAmount(diff)} (under)` : `-${formatAmount(Math.abs(diff))} (over)`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
