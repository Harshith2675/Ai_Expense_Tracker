/**
 * FinPulse Backend Financial Calculator Service
 */
const CalculatorService = {
  totalIncome(transactions) {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  },

  totalExpenses(transactions) {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  },

  balance(transactions) {
    return this.totalIncome(transactions) - this.totalExpenses(transactions);
  },

  forMonth(transactions, month, year) {
    return transactions.filter(t => {
      const parts = t.date.split('-');
      return parseInt(parts[0], 10) === year && parseInt(parts[1], 10) === month;
    });
  },

  forDateRange(transactions, startDate, endDate) {
    return transactions.filter(t => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  },

  forLast3Months(transactions, refDate = new Date()) {
    const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const start = new Date(refDate.getFullYear(), refDate.getMonth() - 2, 1);
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return this.forDateRange(transactions, startIso, endIso);
  },

  forYear(transactions, year) {
    const startIso = `${year}-01-01`;
    const endIso = `${year}-12-31`;
    return this.forDateRange(transactions, startIso, endIso);
  },

  categoryBreakdown(transactions) {
    const expenses = transactions.filter(t => t.type === 'expense');
    const map = {};
    expenses.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    const totalExp = Object.values(map).reduce((a, b) => a + b, 0);

    return Object.entries(map)
      .map(([category, total]) => ({
        category,
        total,
        percentage: totalExp > 0 ? Number(((total / totalExp) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  },

  budgetUsage(budget, transactions) {
    const monthTxns = this.forMonth(transactions, budget.month, budget.year);
    const spent = monthTxns
      .filter(t => t.type === 'expense' && t.category === budget.category)
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = budget.monthlyLimit - spent;
    const percentage = budget.monthlyLimit > 0
      ? Number(((spent / budget.monthlyLimit) * 100).toFixed(1))
      : 0;

    let status = 'Within Budget';
    let statusClass = 'success';
    if (percentage >= 100) {
      status = 'Over Budget';
      statusClass = 'danger';
    } else if (percentage >= 75) {
      status = 'Near Limit';
      statusClass = 'warning';
    }

    return { spent, remaining, percentage, status, statusClass };
  }
};

module.exports = CalculatorService;
