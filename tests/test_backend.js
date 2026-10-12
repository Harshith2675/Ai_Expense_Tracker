/**
 * test_backend.js — Automated Test Suite for FinPulse Backend Logic
 * Tests:
 * 1. Validation Rules (amounts, negative numbers, empty titles, date bounds)
 * 2. Budget Constraints & Validation
 * 3. Financial Calculations (Balance, Net Savings, Budget Percentage, MoM)
 * 4. CSV Formula Injection Defense
 * 5. Supabase Config & State Management
 */

const fs = require('fs');
const assert = require('assert');

const vm = require('vm');

// Mock browser environments
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};
global.DB = {
  getAllTransactions: async () => [],
  getAllBudgets: async () => [],
  getPreference: async (k, d) => d,
};

// Evaluate modules into global context
['js/config.js', 'js/models.js', 'js/demo-data.js', 'js/services.js'].forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInThisContext(code);
});

console.log('🧪 Starting FinPulse Backend Test Suite...\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error('    Error:', err.message);
    process.exitCode = 1;
  }
}

// ==================== 1. VALIDATION TESTS ====================
runTest('Reject zero transaction amount', () => {
  const res = Validator.validateTransaction({
    title: 'Coffee',
    amount: '0',
    type: 'expense',
    category: 'food',
    date: '2026-10-12'
  });
  assert.strictEqual(res.valid, false);
  assert(res.errors.amount);
});

runTest('Reject negative transaction amount', () => {
  const res = Validator.validateTransaction({
    title: 'Refund',
    amount: '-150',
    type: 'expense',
    category: 'food',
    date: '2026-10-12'
  });
  assert.strictEqual(res.valid, false);
  assert(res.errors.amount);
});

runTest('Accept valid decimal amount', () => {
  const res = Validator.validateTransaction({
    title: 'Dinner',
    amount: '1249.50',
    type: 'expense',
    category: 'food',
    date: '2026-10-12'
  });
  assert.strictEqual(res.valid, true);
  assert.deepStrictEqual(res.errors, {});
});

runTest('Reject missing or empty title', () => {
  const res = Validator.validateTransaction({
    title: '   ',
    amount: '500',
    type: 'expense',
    category: 'food',
    date: '2026-10-12'
  });
  assert.strictEqual(res.valid, false);
  assert(res.errors.title);
});

// ==================== 2. BUDGET MANAGEMENT & THRESHOLDS ====================
runTest('Default category limits sum to ₹34,500', () => {
  const total = Object.values(DEFAULT_CATEGORY_LIMITS).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 34500);
});

runTest('Budget Status Thresholds (<75% Within Budget, 75%-99.9% Near Limit, >=100% Over Budget)', () => {
  const budget = { category: 'food', monthlyLimit: 10000, month: 10, year: 2026 };

  // Under 75% -> Within Budget
  const txnsUnder = [{ type: 'expense', amount: 5000, category: 'food', date: '2026-10-05' }];
  const usageUnder = Calculator.budgetUsage(budget, txnsUnder);
  assert.strictEqual(usageUnder.status, 'Within Budget');
  assert.strictEqual(usageUnder.statusClass, 'success');

  // 75% to under 100% -> Near Limit
  const txnsNear = [{ type: 'expense', amount: 8000, category: 'food', date: '2026-10-05' }];
  const usageNear = Calculator.budgetUsage(budget, txnsNear);
  assert.strictEqual(usageNear.status, 'Near Limit');
  assert.strictEqual(usageNear.statusClass, 'warning');

  // >= 100% -> Over Budget
  const txnsOver = [{ type: 'expense', amount: 10500, category: 'food', date: '2026-10-05' }];
  const usageOver = Calculator.budgetUsage(budget, txnsOver);
  assert.strictEqual(usageOver.status, 'Over Budget');
  assert.strictEqual(usageOver.statusClass, 'danger');
});

// ==================== 3. 3-MONTH AND 1-YEAR PERIOD ANALYTICS ====================
runTest('Last 3 Months calculation uses exactly 3 consecutive calendar months', () => {
  const refDate = new Date('2026-10-12');
  const txns = [
    { type: 'expense', amount: 1000, date: '2026-10-01' }, // Month 10
    { type: 'expense', amount: 2000, date: '2026-09-15' }, // Month 9
    { type: 'expense', amount: 3000, date: '2026-08-20' }, // Month 8
    { type: 'expense', amount: 9999, date: '2026-07-31' }, // Month 7 (outside)
  ];
  const last3 = Calculator.forLast3Months(txns, refDate);
  assert.strictEqual(last3.length, 3);
  assert.strictEqual(Calculator.totalExpenses(last3), 6000);
});

runTest('3-Month Trend returns 3 consecutive months with MoM calculations', () => {
  const refDate = new Date('2026-10-12');
  const txns = [
    { type: 'income', amount: 50000, date: '2026-10-01' },
    { type: 'expense', amount: 15000, date: '2026-10-05' },
    { type: 'expense', amount: 10000, date: '2026-09-05' },
    { type: 'expense', amount: 8000, date: '2026-08-05' },
  ];
  const trend = Calculator.threeMonthTrend(txns, refDate);
  assert.strictEqual(trend.length, 3);
  assert.strictEqual(trend[2].month, 10);
  assert.strictEqual(trend[1].month, 9);
  assert.strictEqual(trend[0].month, 8);
  assert.strictEqual(trend[2].expenses, 15000);
  assert.strictEqual(trend[1].expenses, 10000);
  // MoM from 10k to 15k is +50%
  assert.strictEqual(trend[2].momChangePercent, 50);
  assert.strictEqual(trend[2].momIsIncrease, true);
});

runTest('Yearly Trend covers all 12 calendar months with averages and peak month', () => {
  const txns = [
    { type: 'expense', amount: 20000, date: '2026-01-10' },
    { type: 'expense', amount: 35000, date: '2026-05-15' },
    { type: 'expense', amount: 15000, date: '2026-10-10' },
  ];
  const yTrend = Calculator.yearlyTrend(txns, 2026);
  assert.strictEqual(yTrend.months.length, 12);
  assert.strictEqual(yTrend.totalExpenses, 70000);
  assert.strictEqual(yTrend.highestMonth.month, 5);
  assert.strictEqual(yTrend.highestMonth.expenses, 35000);
});

runTest('Daily Month Trend with Average calculates average line correctly', () => {
  const txns = [
    { type: 'expense', amount: 3100, date: '2026-10-05' },
  ];
  const dTrend = Calculator.dailyMonthTrendWithAverage(txns, 10, 2026);
  assert.strictEqual(dTrend.labels.length, 31);
  assert.strictEqual(dTrend.expenses[4], 3100);
  assert.strictEqual(dTrend.dailyAverage, 100); // 3100 / 31 = 100
});

// ==================== 4. DEMO DATA GENERATION & ISOLATION ====================
runTest('Demo Data Generator produces deterministic records across 12 categories', () => {
  const demoSet = DemoDataManager.generateDataset(2026);
  assert(demoSet.transactions.length >= 60, 'Demo dataset should have extensive transactions');
  assert.strictEqual(demoSet.budgets.length, 12, 'Demo dataset should include all 12 category budgets');

  // Verify all records are tagged with isDemo
  const allTagged = demoSet.transactions.every(t => t.isDemo === true);
  assert.strictEqual(allTagged, true, 'All demo transactions must have isDemo: true');

  // Verify default category budget sum is ₹34,500
  const budgetSum = demoSet.budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  assert.strictEqual(budgetSum, 34500, 'Demo category budgets must sum to ₹34,500');
});

runTest('Demo Data isolation from real transactions', () => {
  AppState.transactions = [
    { id: 'real-1', title: 'Real Salary', amount: 60000, type: 'income', date: '2026-10-01' }
  ];
  AppState.budgets = [];

  // Load demo data
  DemoDataManager.load();
  assert(AppState.transactions.length > 1);

  // Clear demo data
  DemoDataManager.clear();
  assert.strictEqual(AppState.transactions.length, 1);
  assert.strictEqual(AppState.transactions[0].id, 'real-1');
});

// ==================== 5. CSV FORMULA INJECTION DEFENSE ====================
runTest('Sanitize CSV cells against formula injection (=, +, -, @)', () => {
  assert.strictEqual(sanitizeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
  assert.strictEqual(sanitizeCsvCell('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
  assert.strictEqual(sanitizeCsvCell('-123'), '"\'-123"');
  assert.strictEqual(sanitizeCsvCell('@test'), '"\'@test"');
  assert.strictEqual(sanitizeCsvCell('Normal Text'), '"Normal Text"');
});

// ==================== 6. CONFIGURATION TESTS ====================
runTest('Supabase Credentials setter and detector', () => {
  assert.strictEqual(AppConfig.isSupabaseConfigured(), false);
  AppConfig.setSupabaseCredentials('https://testproject.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykey1234567890');
  assert.strictEqual(AppConfig.isSupabaseConfigured(), true);
  assert.strictEqual(AppConfig.getSupabaseUrl(), 'https://testproject.supabase.co');
  // Clean up
  AppConfig.setSupabaseCredentials('', '');
  assert.strictEqual(AppConfig.isSupabaseConfigured(), false);
});

console.log(`\n🎉 Test Suite Completed: ${passedTests} test cases passed!\n`);

runTest('Reject invalid date outside 2000-2099', () => {
  const res = Validator.validateTransaction({
    title: 'Old Entry',
    amount: '500',
    type: 'expense',
    category: 'food',
    date: '1999-12-31'
  });
  assert.strictEqual(res.valid, false);
  assert(res.errors.date);
});

// ==================== 2. BUDGET VALIDATION TESTS ====================
runTest('Validate budget positive monthly limit', () => {
  const validRes = Validator.validateBudget({
    category: 'food',
    monthlyLimit: '15000',
    month: '10',
    year: '2026'
  });
  assert.strictEqual(validRes.valid, true);

  const invalidRes = Validator.validateBudget({
    category: 'food',
    monthlyLimit: '-500',
    month: '10',
    year: '2026'
  });
  assert.strictEqual(invalidRes.valid, false);
  assert(invalidRes.errors.monthlyLimit);
});

runTest('Reject invalid budget month > 12', () => {
  const res = Validator.validateBudget({
    category: 'food',
    monthlyLimit: '5000',
    month: '13',
    year: '2026'
  });
  assert.strictEqual(res.valid, false);
  assert(res.errors.month);
});

// ==================== 3. FINANCIAL CALCULATIONS ====================
runTest('Calculate Total Balance (Opening + Income - Expenses)', () => {
  const txns = [
    { type: 'income', amount: 50000, date: '2026-10-01' },
    { type: 'expense', amount: 12000, date: '2026-10-05' },
    { type: 'expense', amount: 3500.50, date: '2026-10-10' }
  ];
  const income = Calculator.totalIncome(txns);
  const expenses = Calculator.totalExpenses(txns);
  const balance = Calculator.balance(txns);

  assert.strictEqual(income, 50000);
  assert.strictEqual(expenses, 15500.50);
  assert.strictEqual(balance, 34499.50);
});

runTest('Calculate Overall Budget Usage', () => {
  const txns = [
    { type: 'expense', amount: 25000, date: '2026-10-05' }
  ];
  const usage = Calculator.overallBudgetUsage(10, 2026, txns, 50000);
  assert.strictEqual(usage.spent, 25000);
  assert.strictEqual(usage.remaining, 25000);
  assert.strictEqual(usage.percentage, 50);
});

runTest('Category Breakdown and Percentages calculation', () => {
  const txns = [
    { type: 'expense', amount: 3000, category: 'food' },
    { type: 'expense', amount: 7000, category: 'travel' }
  ];
  const breakdown = Calculator.categoryBreakdown(txns);
  assert.strictEqual(breakdown.length, 2);
  assert.strictEqual(breakdown[0].category, 'travel');
  assert.strictEqual(breakdown[0].total, 7000);
  assert.strictEqual(breakdown[0].percentage, 70);
  assert.strictEqual(breakdown[1].category, 'food');
  assert.strictEqual(breakdown[1].total, 3000);
  assert.strictEqual(breakdown[1].percentage, 30);
});

// ==================== 4. CSV FORMULA INJECTION DEFENSE ====================
runTest('Sanitize CSV cells against formula injection (=, +, -, @)', () => {
  assert.strictEqual(sanitizeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
  assert.strictEqual(sanitizeCsvCell('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
  assert.strictEqual(sanitizeCsvCell('-123'), '"\'-123"');
  assert.strictEqual(sanitizeCsvCell('@test'), '"\'@test"');
  assert.strictEqual(sanitizeCsvCell('Normal Text'), '"Normal Text"');
});

// ==================== 5. CONFIGURATION TESTS ====================
runTest('Supabase Credentials setter and detector', () => {
  assert.strictEqual(AppConfig.isSupabaseConfigured(), false);
  AppConfig.setSupabaseCredentials('https://testproject.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykey1234567890');
  assert.strictEqual(AppConfig.isSupabaseConfigured(), true);
  assert.strictEqual(AppConfig.getSupabaseUrl(), 'https://testproject.supabase.co');
  // Clean up
  AppConfig.setSupabaseCredentials('', '');
  assert.strictEqual(AppConfig.isSupabaseConfigured(), false);
});

console.log(`\n🎉 Test Suite Completed: ${passedTests} test cases passed!\n`);
