import React from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AnalyticsCharts({
  monthlyData,
  categories,
  trendData,
  isDarkTheme = true
}) {
  const { currency, symbol, formatAmount } = useCurrency();
  const textColor = isDarkTheme ? '#94a3b8' : '#475569';
  const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  // 1. Income vs Expense Bar Chart Configuration
  const incomeExpenseData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Income',
        data: monthlyData.income,
        backgroundColor: '#10b981',
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
      {
        label: 'Expenses',
        data: monthlyData.expenses,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: textColor,
          font: { family: "'Plus Jakarta Sans', sans-serif", weight: 600, size: 12 },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatAmount(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif" } }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { family: "'Plus Jakarta Sans', sans-serif" },
          callback: (val) => `${symbol}${val >= 1000 ? (val / 1000) + 'k' : val}`
        }
      }
    }
  };

  // 2. Category Doughnut Chart Configuration
  const expenseCategories = categories.filter((c) => !c.type || c.type === 'expense');
  const doughnutData = {
    labels: expenseCategories.map((c) => c.name),
    datasets: [
      {
        data: expenseCategories.map((c) => c.spent || 0),
        backgroundColor: expenseCategories.map((c) => c.color),
        borderColor: isDarkTheme ? '#0f172a' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 6
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
          usePointStyle: true,
          boxWidth: 6,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ` Spent: ${formatAmount(ctx.raw)}`
        }
      }
    }
  };

  // 3. Weekly Spending Trend (Line Chart)
  const lineTrendData = {
    labels: trendData.labels,
    datasets: [
      {
        label: `Actual Spend (${symbol})`,
        data: trendData.actual,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: `Budget Target Baseline (${symbol})`,
        data: trendData.targetBaseline,
        borderColor: 'rgba(99, 102, 241, 0.5)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: textColor,
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw != null ? formatAmount(ctx.raw) : 'N/A'}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (val) => `${symbol}${val}`
        }
      }
    }
  };

  return (
    <section className="analytics-section" aria-label="Financial Analytics Charts">
      {/* Primary Charts Row */}
      <div className="charts-grid-main">
        {/* Chart 1: Income vs Expense Bar */}
        <div className="chart-card" id="analytics-income-expense-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-card-title">Income vs. Expenses</h2>
              <p className="chart-card-subtitle">Monthly cash flow comparative analysis (6 Months)</p>
            </div>
            <span className="badge badge-auto">Chart.js</span>
          </div>
          <div className="chart-container-wrapper" style={{ height: '280px' }}>
            <Bar data={incomeExpenseData} options={barChartOptions} />
          </div>
        </div>

        {/* Chart 2: Category Breakdown Doughnut */}
        <div className="chart-card" id="analytics-category-doughnut-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-card-title">Category Breakdown</h2>
              <p className="chart-card-subtitle">October current spend distribution</p>
            </div>
          </div>
          <div className="chart-container-wrapper" style={{ height: '280px' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="charts-grid-secondary">
        {/* Chart 3: Weekly Spending Trend */}
        <div className="chart-card" id="analytics-spending-trend-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-card-title">Monthly Spending Trend</h2>
              <p className="chart-card-subtitle">Weekly velocity vs. recommended spending rate</p>
            </div>
          </div>
          <div className="chart-container-wrapper" style={{ height: '260px' }}>
            <Line data={lineTrendData} options={lineOptions} />
          </div>
        </div>

        {/* Chart 4: Category Budget Progress */}
        <div className="chart-card" id="analytics-budget-progress-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-card-title">Budget Allocation Progress</h2>
              <p className="chart-card-subtitle">Category consumption vs. assigned limits</p>
            </div>
          </div>
          <div className="category-meters-list">
            {expenseCategories.slice(0, 5).map((cat) => {
              const pct = Math.min(Math.round(((cat.spent || 0) / (cat.budget || 1)) * 100), 100);
              const isOver = (cat.spent || 0) >= (cat.budget || 1);
              return (
                <div key={cat.id} className="category-meter-item">
                  <div className="meter-header">
                    <span className="meter-name">
                      <span className="category-color-dot" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </span>
                    <span className="meter-stats">
                      <strong>{formatAmount(cat.spent || 0)}</strong> / {formatAmount(cat.budget || 0)} ({pct}%)
                    </span>
                  </div>
                  <div className="meter-bar-track">
                    <div
                      className="meter-bar-progress"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isOver ? 'var(--color-expense)' : cat.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
