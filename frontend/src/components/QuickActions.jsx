import React from 'react';
import {
  PlusCircle,
  TrendingUp,
  FileBarChart,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  BrainCircuit,
  ArrowRight
} from 'lucide-react';

export default function QuickActions({
  onOpenAddExpense,
  onOpenAddIncome,
  onViewReports,
  onViewInsights,
  onOpenBudgets,
  insights = [],
  isLoading,
  onToggleLoading,
  simulatedError,
  onToggleError
}) {
  return (
    <div className="sidebar-widgets-column">
      {/* 1. Quick Actions Tile Card */}
      <div className="quick-actions-card" id="quick-actions-card">
        <h2 className="chart-card-title">Quick Actions</h2>
        <p className="chart-card-subtitle">Common financial operations</p>

        <div className="quick-actions-grid">
          <button
            id="quick-add-expense-btn"
            className="action-tile-btn"
            onClick={onOpenAddExpense}
          >
            <div className="action-tile-icon" style={{ background: 'var(--color-expense-soft)', color: 'var(--color-expense)' }}>
              <PlusCircle size={18} />
            </div>
            <div>
              <div>Add Expense</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Record immediate outlay</div>
            </div>
          </button>

          <button
            id="quick-add-income-btn"
            className="action-tile-btn"
            onClick={onOpenAddIncome}
          >
            <div className="action-tile-icon" style={{ background: 'var(--color-income-soft)', color: 'var(--color-income)' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div>Add Income</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Salary, freelance or dividend</div>
            </div>
          </button>

          <button
            id="quick-view-reports-btn"
            className="action-tile-btn"
            onClick={onViewReports}
          >
            <div className="action-tile-icon">
              <FileBarChart size={18} />
            </div>
            <div>
              <div>View Reports</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Monthly analytics & breakdown</div>
            </div>
          </button>

          <button
            id="quick-manage-budgets-btn"
            className="action-tile-btn"
            onClick={onOpenBudgets}
          >
            <div className="action-tile-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
              <FileBarChart size={18} />
            </div>
            <div>
              <div>Manage Budgets</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Category limits & alerts</div>
            </div>
          </button>
        </div>

        {/* State Simulation Helpers for testing loading/error states */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px' }}>
          <button
            id="toggle-loading-state-btn"
            className="btn btn-outline"
            style={{ fontSize: '0.74rem', padding: '5px 10px', flex: 1 }}
            onClick={onToggleLoading}
            title="Demonstrate skeleton loading state"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Stop Loading' : 'Demo Loading'}
          </button>

          <button
            id="toggle-error-state-btn"
            className="btn btn-outline"
            style={{ fontSize: '0.74rem', padding: '5px 10px', flex: 1, color: simulatedError ? '#fda4af' : 'var(--text-muted)' }}
            onClick={onToggleError}
            title="Demonstrate alert/error state"
          >
            <AlertTriangle size={12} />
            {simulatedError ? 'Clear Error' : 'Demo Error'}
          </button>
        </div>
      </div>

      {/* 2. AI Financial Insights Widget */}
      <div className="ai-insights-card" id="ai-insights-widget">
        <div className="ai-card-badge">
          <BrainCircuit size={13} />
          AI Intelligence Preview
        </div>
        <h3 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '6px' }}>
          Predictive Insights
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Scaffolded models analyzing cash flow trends
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insights.slice(0, 2).map((ins) => (
            <div key={ins.id} className="ai-insight-item">
              <div className="ai-insight-title">{ins.title}</div>
              <div className="ai-insight-desc">{ins.description}</div>
              <div className="ai-insight-meta">
                <span>{ins.confidence}</span>
                <span style={{ color: ins.type === 'alert' ? 'var(--color-warning)' : 'var(--color-income)' }}>
                  {ins.impact}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          id="view-all-ai-insights-btn"
          className="btn btn-outline"
          style={{ width: '100%', marginTop: '12px', justifyContent: 'center', fontSize: '0.8rem' }}
          onClick={onViewInsights}
        >
          <span>Explore All AI Insights</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
