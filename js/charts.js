/**
 * charts.js — Chart Rendering Module
 * All Chart.js chart definitions for the app.
 * Re-renders charts when data changes.
 */

const Charts = (() => {
  let categoryChart = null;
  let incomeExpenseChart = null;
  let reportDonutChart = null;
  let trendChart = null;
  let weeklyChart = null;

  // Chart.js default font
  Chart.defaults.font.family = "'Inter', sans-serif";

  function getChartColors(n) {
    const palette = [
      '#166534', '#059669', '#22c55e', '#3b82f6', '#f59e0b',
      '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
      '#14b8a6', '#6366f1', '#84cc16', '#a855f7', '#10b981',
    ];
    return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
      (document.documentElement.getAttribute('data-theme') !== 'light' &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function gridColor() { return isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }
  function textColor() { return isDark() ? '#94a3b8' : '#64748b'; }

  // ==================== CATEGORY DOUGHNUT (Dashboard) ====================

  function renderCategoryChart(breakdown) {
    const canvas = document.getElementById('category-chart');
    const noDataMsg = document.getElementById('no-expense-chart-msg');

    if (!breakdown || breakdown.length === 0) {
      canvas.style.display = 'none';
      noDataMsg.style.display = 'block';
      if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
      return;
    }

    canvas.style.display = 'block';
    noDataMsg.style.display = 'none';

    const labels = breakdown.map(b => getCategoryById(b.category).label);
    const data = breakdown.map(b => b.total);
    const colors = getChartColors(data.length);

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: isDark() ? '#1e293b' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 12,
              font: { size: 11, weight: '500' },
              color: textColor(),
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${PreferenceService.fmt(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ==================== INCOME vs EXPENSE BAR (Dashboard) ====================

  function renderIncomeExpenseChart(monthlyData) {
    const canvas = document.getElementById('income-expense-chart');
    if (!canvas) return;

    if (incomeExpenseChart) incomeExpenseChart.destroy();

    incomeExpenseChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: monthlyData.map(d => d.label),
        datasets: [
          {
            label: 'Income',
            data: monthlyData.map(d => d.income),
            backgroundColor: 'rgba(22,163,74,0.7)',
            borderColor: '#16a34a',
            borderWidth: 1.5,
            borderRadius: 4,
          },
          {
            label: 'Expenses',
            data: monthlyData.map(d => d.expenses),
            backgroundColor: 'rgba(220,38,38,0.7)',
            borderColor: '#dc2626',
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { font: { size: 11 }, color: textColor(), usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label(ctx) { return ` ${PreferenceService.fmt(ctx.parsed.y)}`; },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor(), font: { size: 10 } },
          },
          y: {
            grid: { color: gridColor() },
            ticks: {
              color: textColor(),
              font: { size: 10 },
              callback(v) {
                return v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;
              },
            },
          },
        },
      },
    });
  }

  // ==================== REPORT DONUT WITH CENTER TEXT & SELECTION ====================

  function renderReportDonutChart(breakdown, onCategorySelect = null) {
    const canvas = document.getElementById('report-donut-chart');
    const noDataMsg = document.getElementById('report-no-data-msg');

    if (!breakdown || breakdown.length === 0) {
      if (canvas) canvas.style.display = 'none';
      if (noDataMsg) noDataMsg.style.display = 'block';
      if (reportDonutChart) { reportDonutChart.destroy(); reportDonutChart = null; }
      return;
    }

    if (canvas) canvas.style.display = 'block';
    if (noDataMsg) noDataMsg.style.display = 'none';

    // Sort categories by highest spending by default
    const sortedBreakdown = [...breakdown].sort((a, b) => b.total - a.total);
    const totalSpent = sortedBreakdown.reduce((sum, b) => sum + b.total, 0);

    const labels = sortedBreakdown.map(b => getCategoryById(b.category).label);
    const data = sortedBreakdown.map(b => b.total);
    const colors = getChartColors(data.length);

    // Custom center text plugin for total spent
    const centerTextPlugin = {
      id: 'donutCenterText',
      afterDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const { ctx, chartArea: { width, height } } = chart;
        ctx.save();
        const centerX = chart.getDatasetMeta(0).data[0] ? chart.getDatasetMeta(0).data[0].x : width / 2;
        const centerY = chart.getDatasetMeta(0).data[0] ? chart.getDatasetMeta(0).data[0].y : height / 2;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Subtitle "Total Spent"
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = isDark() ? '#94a3b8' : '#64748b';
        ctx.fillText('TOTAL SPENT', centerX, centerY - 10);

        // Value in ₹ INR
        ctx.font = '800 15px Inter, sans-serif';
        ctx.fillStyle = isDark() ? '#f8fafc' : '#0f172a';
        ctx.fillText(PreferenceService.fmt(totalSpent), centerX, centerY + 10);
        ctx.restore();
      },
    };

    if (reportDonutChart) reportDonutChart.destroy();
    reportDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: isDark() ? '#1e293b' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      plugins: [centerTextPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '68%',
        onClick(event, elements) {
          if (elements && elements.length > 0 && typeof onCategorySelect === 'function') {
            const index = elements[0].index;
            const selectedItem = sortedBreakdown[index];
            if (selectedItem) onCategorySelect(selectedItem.category);
          }
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 10,
              font: { size: 11, weight: '500' },
              color: textColor(),
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${PreferenceService.fmt(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ==================== ADVANCED SPENDING TREND CHART ====================
  // Supports:
  // 1. 'monthly' (Daily spending 1..31 + daily average line)
  // 2. 'three-month' (3 consecutive calendar months compared: Income vs Expense)
  // 3. 'yearly' (Jan-Dec 12 months with Income, Expenses, and Monthly Avg line)

  function renderSpendingTrend(periodType, trendData) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    if (trendChart) trendChart.destroy();

    let chartConfig;

    if (periodType === 'monthly') {
      // Daily line chart with daily average reference line
      const { labels, expenses, dailyAverage } = trendData;
      const avgLineData = new Array(labels.length).fill(dailyAverage);

      chartConfig = {
        type: 'line',
        data: {
          labels: labels.map(l => `Day ${l}`),
          datasets: [
            {
              label: 'Daily Spent',
              data: expenses,
              borderColor: '#166534',
              backgroundColor: 'rgba(22,101,52,0.12)',
              borderWidth: 2.2,
              pointBackgroundColor: '#166534',
              pointRadius: 3,
              pointHoverRadius: 6,
              tension: 0.3,
              fill: true,
            },
            {
              label: `Daily Avg (${PreferenceService.fmt(dailyAverage)})`,
              data: avgLineData,
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: { font: { size: 11 }, color: textColor(), usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                label(ctx) {
                  return ` ${ctx.dataset.label.split(' (')[0]}: ${PreferenceService.fmt(ctx.parsed.y)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: textColor(),
                font: { size: 9 },
                maxTicksLimit: 12,
              },
            },
            y: {
              grid: { color: gridColor() },
              ticks: {
                color: textColor(),
                font: { size: 10 },
                callback(v) {
                  return v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;
                },
              },
            },
          },
        },
      };
    } else if (periodType === 'three-month') {
      // 3-Month View: Grouped Bar Chart comparing consecutive months
      const items = Array.isArray(trendData) ? trendData : [];
      chartConfig = {
        type: 'bar',
        data: {
          labels: items.map(d => d.label),
          datasets: [
            {
              label: 'Income',
              data: items.map(d => d.income),
              backgroundColor: 'rgba(22,163,74,0.75)',
              borderColor: '#16a34a',
              borderWidth: 1.5,
              borderRadius: 6,
            },
            {
              label: 'Expenses',
              data: items.map(d => d.expenses),
              backgroundColor: 'rgba(220,38,38,0.75)',
              borderColor: '#dc2626',
              borderWidth: 1.5,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: { font: { size: 11 }, color: textColor(), usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                label(ctx) {
                  const item = items[ctx.dataIndex];
                  const label = ctx.dataset.label;
                  const momText = (label === 'Expenses' && item.momChangePercent > 0)
                    ? ` (${item.momIsIncrease ? '+' : '-'}${item.momChangePercent}% MoM)`
                    : '';
                  return ` ${label}: ${PreferenceService.fmt(ctx.parsed.y)}${momText}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor(), font: { size: 11, weight: '600' } },
            },
            y: {
              grid: { color: gridColor() },
              ticks: {
                color: textColor(),
                font: { size: 10 },
                callback(v) {
                  return v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;
                },
              },
            },
          },
        },
      };
    } else if (periodType === 'yearly') {
      // 1-Year View: Jan through Dec with Income, Expenses, and Monthly Avg Expense Line
      const { months, averageMonthlyExpense } = trendData;
      const avgExpenseLine = new Array(12).fill(averageMonthlyExpense);

      chartConfig = {
        type: 'bar',
        data: {
          labels: months.map(m => m.isCurrentMonth ? `${m.label}*` : m.label),
          datasets: [
            {
              type: 'line',
              label: `Avg Expense (${PreferenceService.fmt(averageMonthlyExpense)})`,
              data: avgExpenseLine,
              borderColor: '#059669',
              borderWidth: 2,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false,
              order: 1,
            },
            {
              type: 'bar',
              label: 'Expenses',
              data: months.map(m => m.expenses),
              backgroundColor: months.map(m => m.isCurrentMonth ? 'rgba(220,38,38,0.9)' : 'rgba(220,38,38,0.6)'),
              borderColor: '#dc2626',
              borderWidth: 1.5,
              borderRadius: 4,
              order: 2,
            },
            {
              type: 'bar',
              label: 'Income',
              data: months.map(m => m.income),
              backgroundColor: 'rgba(22,163,74,0.6)',
              borderColor: '#16a34a',
              borderWidth: 1.5,
              borderRadius: 4,
              order: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: { font: { size: 11 }, color: textColor(), usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                label(ctx) {
                  return ` ${ctx.dataset.label.split(' (')[0]}: ${PreferenceService.fmt(ctx.parsed.y)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor(), font: { size: 10, weight: '500' } },
            },
            y: {
              grid: { color: gridColor() },
              ticks: {
                color: textColor(),
                font: { size: 10 },
                callback(v) {
                  return v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;
                },
              },
            },
          },
        },
      };
    } else {
      // Default fallback (e.g. custom date range or generic trend)
      const items = Array.isArray(trendData) ? trendData : [];
      chartConfig = {
        type: 'line',
        data: {
          labels: items.map(d => d.label),
          datasets: [
            {
              label: 'Income',
              data: items.map(d => d.income),
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22,163,74,0.08)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
            },
            {
              label: 'Expenses',
              data: items.map(d => d.expenses),
              borderColor: '#dc2626',
              backgroundColor: 'rgba(220,38,38,0.08)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { labels: { font: { size: 11 }, color: textColor(), usePointStyle: true } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor(), font: { size: 10 } } },
            y: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { size: 10 } } },
          },
        },
      };
    }

    trendChart = new Chart(canvas, chartConfig);
  }

  // Backwards compatibility alias
  function renderTrendChart(monthlyData) {
    renderSpendingTrend('generic', monthlyData);
  }

  // ==================== WEEKLY SPENDING BAR CHART ====================

  function renderWeeklySpendingChart(weeklyData) {
    const canvas = document.getElementById('weekly-chart');
    if (!canvas) return;

    if (weeklyChart) weeklyChart.destroy();

    const maxVal = Math.max(...weeklyData.map(d => d.expense), 0);

    weeklyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weeklyData.map(d => d.day),
        datasets: [{
          label: 'Daily Spending',
          data: weeklyData.map(d => d.expense),
          backgroundColor: weeklyData.map(d =>
            d.expense === maxVal && maxVal > 0 ? '#166534' : 'rgba(22,101,52,0.45)'
          ),
          borderColor: '#166534',
          borderWidth: 1.5,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const item = weeklyData[ctx.dataIndex];
                return ` Spent: ${PreferenceService.fmt(item.expense)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor(), font: { size: 11, weight: '600' } },
          },
          y: {
            grid: { color: gridColor() },
            ticks: {
              color: textColor(),
              font: { size: 10 },
              callback(v) {
                return v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;
              },
            },
          },
        },
      },
    });
  }

  function destroyAll() {
    [categoryChart, incomeExpenseChart, reportDonutChart, trendChart, weeklyChart].forEach(c => {
      if (c) c.destroy();
    });
    categoryChart = incomeExpenseChart = reportDonutChart = trendChart = weeklyChart = null;
  }

  return {
    renderCategoryChart,
    renderIncomeExpenseChart,
    renderReportDonutChart,
    renderTrendChart,
    renderSpendingTrend,
    renderWeeklySpendingChart,
    destroyAll,
  };
})();
