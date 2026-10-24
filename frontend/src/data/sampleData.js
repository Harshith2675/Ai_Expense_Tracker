/**
 * AI Expense Tracker - Sample Data
 * NOTE: This is clearly labeled sample data for UI demonstration purposes only.
 * Prepared for future REST API and SQLite database integration.
 */

export const IS_SAMPLE_DATA = true;
export const DATA_DISCLAIMER = "Sample demonstration data. Real SQLite backend integration ready.";

export const INITIAL_SUMMARY = {
  totalIncome: 9450.00,
  totalExpenses: 4185.30,
  availableBalance: 5264.70,
  monthlyBudget: 5500.00,
  budgetUsed: 4185.30,
  budgetPercent: 76.1,
  savingsRate: 55.7,
  incomeChangePercent: 12.4, // vs last month
  expenseChangePercent: -4.2, // vs last month
  currency: "$"
};

export const INITIAL_TRANSACTIONS = [
  {
    id: "tx-101",
    description: "Enterprise Salary Deposit",
    category: "Salary",
    date: "2026-10-01",
    amount: 6200.00,
    type: "income",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Primary Checking (...4821)",
    merchant: "Apex Global Tech Corp"
  },
  {
    id: "tx-102",
    description: "Whole Foods Market",
    category: "Food & Dining",
    date: "2026-10-03",
    amount: 168.45,
    type: "expense",
    detectionMethod: "manual",
    status: "cleared",
    account: "Sapphire Rewards (...9023)",
    merchant: "Whole Foods #1042"
  },
  {
    id: "tx-103",
    description: "Apartment Rent & Parking",
    category: "Housing & Rent",
    date: "2026-10-04",
    amount: 1850.00,
    type: "expense",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Primary Checking (...4821)",
    merchant: "Highland Residences LLC"
  },
  {
    id: "tx-104",
    description: "Freelance Design Retainer",
    category: "Freelance",
    date: "2026-10-07",
    amount: 1850.00,
    type: "income",
    detectionMethod: "manual",
    status: "cleared",
    account: "Business Reserve (...1182)",
    merchant: "Studio Vertex"
  },
  {
    id: "tx-105",
    description: "Metropolitan Power & Gas",
    category: "Bills & Utilities",
    date: "2026-10-09",
    amount: 124.80,
    type: "expense",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Primary Checking (...4821)",
    merchant: "City Power Grid"
  },
  {
    id: "tx-106",
    description: "Uber Premier Airport Ride",
    category: "Transportation",
    date: "2026-10-11",
    amount: 58.75,
    type: "expense",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Sapphire Rewards (...9023)",
    merchant: "Uber BV"
  },
  {
    id: "tx-107",
    description: "Nordic Wellness Club",
    category: "Health & Fitness",
    date: "2026-10-14",
    amount: 85.00,
    type: "expense",
    detectionMethod: "manual",
    status: "cleared",
    account: "Sapphire Rewards (...9023)",
    merchant: "Nordic Athletic"
  },
  {
    id: "tx-108",
    description: "Dividend Payout ETF",
    category: "Investments",
    date: "2026-10-15",
    amount: 400.00,
    type: "income",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Brokerage Portfolio (...3390)",
    merchant: "Vanguard Index"
  },
  {
    id: "tx-109",
    description: "Tech Gear & Accessories",
    category: "Shopping",
    date: "2026-10-17",
    amount: 289.90,
    type: "expense",
    detectionMethod: "manual",
    status: "cleared",
    account: "Sapphire Rewards (...9023)",
    merchant: "Apple Store Online"
  },
  {
    id: "tx-110",
    description: "Cloud Streaming Subscriptions",
    category: "Entertainment",
    date: "2026-10-19",
    amount: 42.99,
    type: "expense",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Sapphire Rewards (...9023)",
    merchant: "Streaming Bundle"
  },
  {
    id: "tx-111",
    description: "Blue Bottle Coffee",
    category: "Food & Dining",
    date: "2026-10-21",
    amount: 14.50,
    type: "expense",
    detectionMethod: "manual",
    status: "cleared",
    account: "Apple Pay Checking",
    merchant: "Blue Bottle Cafe"
  },
  {
    id: "tx-112",
    description: "High-Speed Fiber Internet",
    category: "Bills & Utilities",
    date: "2026-10-22",
    amount: 89.00,
    type: "expense",
    detectionMethod: "automatic",
    status: "cleared",
    account: "Primary Checking (...4821)",
    merchant: "Sonic Fiber Telecom"
  }
];

export const CATEGORIES = [
  { id: "cat-1", name: "Housing & Rent", color: "#6366f1", icon: "Home", budget: 2000, spent: 1850 },
  { id: "cat-2", name: "Food & Dining", color: "#10b981", icon: "Utensils", budget: 700, spent: 582.95 },
  { id: "cat-3", name: "Transportation", color: "#f59e0b", icon: "Car", budget: 350, spent: 288.75 },
  { id: "cat-4", name: "Bills & Utilities", color: "#8b5cf6", icon: "Zap", budget: 350, spent: 302.80 },
  { id: "cat-5", name: "Shopping", color: "#ec4899", icon: "ShoppingBag", budget: 500, spent: 489.90 },
  { id: "cat-6", name: "Entertainment", color: "#06b6d4", icon: "Film", budget: 300, spent: 185.00 },
  { id: "cat-7", name: "Health & Fitness", color: "#14b8a6", icon: "Activity", budget: 200, spent: 145.00 },
  { id: "cat-8", name: "Salary", color: "#22c55e", icon: "Briefcase", type: "income" },
  { id: "cat-9", name: "Freelance", color: "#3b82f6", icon: "Laptop", type: "income" },
  { id: "cat-10", name: "Investments", color: "#a855f7", icon: "TrendingUp", type: "income" }
];

export const MONTHLY_ANALYTICS_DATA = {
  labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  income: [7800, 8100, 8400, 8200, 8900, 9450],
  expenses: [3950, 4200, 3850, 4400, 4050, 4185]
};

export const SPENDING_TREND_DATA = {
  labels: ["W1 (Oct 1-7)", "W2 (Oct 8-14)", "W3 (Oct 15-21)", "W4 (Oct 22-28)", "Projected (Oct 29-31)"],
  actual: [2018.45, 1268.55, 680.30, 218.00, null],
  targetBaseline: [1375, 1375, 1375, 1375, 1375]
};

export const AI_INSIGHTS_SAMPLE = [
  {
    id: "ins-1",
    type: "tip",
    badge: "Smart Savings",
    title: "Dining spend decreased by 8.4%",
    description: "Your Food & Dining expenditures are $117 lower than the same period last month, putting you on track to save an extra $180 this month.",
    confidence: "94% model confidence",
    impact: "+$180 projected"
  },
  {
    id: "ins-2",
    type: "alert",
    badge: "Budget Alert",
    title: "Shopping category at 97% of limit",
    description: "You have used $489.90 of your $500 monthly Shopping budget with 9 days remaining in the billing cycle.",
    confidence: "High Priority",
    impact: "Action needed"
  },
  {
    id: "ins-3",
    type: "prediction",
    badge: "AI Forecast",
    title: "Projected month-end balance: $5,410",
    description: "Based on recurring scheduled payments and 90-day moving averages, your closing cash buffer will exceed your $5,000 safety threshold.",
    confidence: "91% accuracy score",
    impact: "Healthy liquidity"
  }
];
