import React from 'react';
import SummaryCards from '../SummaryCards';
import AnalyticsCharts from '../AnalyticsCharts';
import RecentTransactions from '../RecentTransactions';
import QuickActions from '../QuickActions';

export default function DashboardView({
  summary,
  monthlyData,
  categories,
  trendData,
  transactions,
  onDeleteTransaction,
  searchQuery,
  onOpenAddExpense,
  onOpenAddIncome,
  onViewReports,
  onViewInsights,
  onOpenBudgets,
  insights,
  isLoading,
  onToggleLoading,
  simulatedError,
  onToggleError,
  isDarkTheme
}) {
  return (
    <div className="view-container" id="dashboard-view">
      {/* Summary Cards */}
      <SummaryCards summary={summary} />

      {/* Analytics Charts */}
      <AnalyticsCharts
        monthlyData={monthlyData}
        categories={categories}
        trendData={trendData}
        isDarkTheme={isDarkTheme}
      />

      {/* Split Grid: Recent Transactions (Left) + Quick Actions & AI (Right) */}
      <div className="dashboard-bottom-grid">
        <RecentTransactions
          transactions={transactions}
          onDeleteTransaction={onDeleteTransaction}
          searchQuery={searchQuery}
          categories={categories}
        />

        <QuickActions
          onOpenAddExpense={onOpenAddExpense}
          onOpenAddIncome={onOpenAddIncome}
          onViewReports={onViewReports}
          onViewInsights={onViewInsights}
          onOpenBudgets={onOpenBudgets}
          insights={insights}
          isLoading={isLoading}
          onToggleLoading={onToggleLoading}
          simulatedError={simulatedError}
          onToggleError={onToggleError}
        />
      </div>
    </div>
  );
}
