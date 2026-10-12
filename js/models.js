/**
 * models.js — Data Models and Constants
 * Defines factory functions for transactions and budgets,
 * plus category definitions with emoji icons.
 */

// ==================== CATEGORIES ====================
const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Food & Dining',      emoji: '🍽️' },
  { id: 'groceries',     label: 'Groceries',          emoji: '🛒' },
  { id: 'transportation',label: 'Transportation',     emoji: '🚗' },
  { id: 'shopping',      label: 'Shopping',           emoji: '🛍️' },
  { id: 'bills',         label: 'Bills & Utilities',  emoji: '💡' },
  { id: 'entertainment', label: 'Entertainment',      emoji: '🎬' },
  { id: 'health',        label: 'Healthcare',         emoji: '🏥' },
  { id: 'education',     label: 'Education',          emoji: '📚' },
  { id: 'travel',        label: 'Travel',             emoji: '✈️' },
  { id: 'personal_care', label: 'Personal Care',      emoji: '💆' },
  { id: 'subscriptions', label: 'Subscriptions',      emoji: '📱' },
  { id: 'other_exp',     label: 'Other',              emoji: '📦' },
];

const DEFAULT_CATEGORY_LIMITS = {
  food: 6000,
  groceries: 5000,
  transportation: 3000,
  shopping: 4000,
  bills: 3500,
  entertainment: 2000,
  health: 1500,
  education: 2500,
  travel: 4000,
  personal_care: 1000,
  subscriptions: 500,
  other_exp: 1500,
};

const INCOME_CATEGORIES = [
  { id: 'salary',        label: 'Salary',        emoji: '💼' },
  { id: 'freelance',     label: 'Freelance',     emoji: '💻' },
  { id: 'business',      label: 'Business',      emoji: '🏢' },
  { id: 'gift',          label: 'Gift',          emoji: '🎁' },
  { id: 'interest',      label: 'Interest',      emoji: '📈' },
  { id: 'other_inc',     label: 'Other',         emoji: '💰' },
];

const PAYMENT_METHODS = [
  { id: 'cash',          label: 'Cash',          emoji: '💵' },
  { id: 'upi',           label: 'UPI',           emoji: '📱' },
  { id: 'debit_card',    label: 'Debit Card',    emoji: '💳' },
  { id: 'credit_card',   label: 'Credit Card',   emoji: '💳' },
  { id: 'bank_transfer', label: 'Bank Transfer', emoji: '🏦' },
  { id: 'other',         label: 'Other',         emoji: '🔄' },
];

const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  { id: 'overall', label: 'Overall Monthly Budget', emoji: '🎯' },
];

function getCategoryById(id) {
  if (!id) return { id: 'other_exp', label: 'Other', emoji: '📦' };
  // Normalise aliases
  if (id === 'other') id = 'other_exp';
  if (id === 'food_dining') id = 'food';
  if (id === 'bills_utilities') id = 'bills';
  if (id === 'healthcare') id = 'health';
  return ALL_CATEGORIES.find(c => c.id === id) || { id, label: id, emoji: '📌' };
}

function getPaymentMethodById(id) {
  return PAYMENT_METHODS.find(m => m.id === id) || { id, label: id || 'Other', emoji: '💳' };
}

function getCategoriesForType(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

// ==================== TRANSACTION MODEL ====================

/**
 * Create a new Transaction object.
 * @param {Object} data
 * @returns {Object} Transaction
 */
function createTransaction({
  title,
  amount,
  type,
  category,
  date,
  paymentMethod = 'cash',
  note = '',
  id = null,
  createdAt = null,
  updatedAt = null,
}) {
  const now = new Date().toISOString();
  return {
    id: id || generateId(),
    title: title.trim(),
    amount: parseFloat(amount),
    type,             // 'income' | 'expense'
    category,
    date,             // ISO date string 'YYYY-MM-DD'
    paymentMethod,
    note: (note || '').trim(),
    createdAt: createdAt || now,
    updatedAt: updatedAt || now,
  };
}

// ==================== BUDGET MODEL ====================

/**
 * Create a new Budget object.
 * @param {Object} data
 * @returns {Object} Budget
 */
function createBudget({
  category,
  monthlyLimit,
  month,
  year,
  id = null,
  createdAt = null,
  updatedAt = null,
}) {
  const now = new Date().toISOString();
  return {
    id: id || generateId(),
    category,
    monthlyLimit: parseFloat(monthlyLimit),
    month: parseInt(month, 10),
    year: parseInt(year, 10),
    createdAt: createdAt || now,
    updatedAt: updatedAt || now,
  };
}

// ==================== USER PREFERENCES ====================
const DEFAULT_PREFERENCES = {
  currency: 'INR',
  theme: 'system',
  budgetAlerts: true,
  monthlyBudget: 50000,
};

const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// ==================== MONTHS ====================
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ==================== UTILITIES ====================

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format a number as Indian Rupee currency.
 * Supports other currencies via symbol map.
 */
function formatCurrency(amount, currencyCode = 'INR') {
  const num = parseFloat(amount) || 0;
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

  if (currencyCode === 'INR') {
    // Indian number formatting: 1,23,456.78
    const formatted = num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  }

  return `${symbol}${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a date string 'YYYY-MM-DD' to a readable format.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Get 'YYYY-MM-DD' string for today.
 */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Check if a transaction date falls within a given month/year.
 * @param {string} dateStr  — 'YYYY-MM-DD'
 * @param {number} month    — 1-indexed
 * @param {number} year
 */
function isInMonth(dateStr, month, year) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

/**
 * Check if a date falls within the last N months.
 */
function isInLastNMonths(dateStr, n) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - n + 1);
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);
  return d >= cutoff;
}

/**
 * Check if a date falls within a given year.
 */
function isInYear(dateStr, year) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00').getFullYear() === year;
}

/**
 * Check if a date string falls within the calendar week of refDate (Mon-Sun).
 */
function isInWeek(dateStr, refDate = new Date()) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(refDate);
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return d >= monday && d <= sunday;
}

/**
 * Check if a date string is within [startDate, endDate] inclusive.
 */
function isInDateRange(dateStr, startDate, endDate) {
  if (!dateStr) return false;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/**
 * Get previous month and year.
 */
function getPreviousMonthYear(month, year) {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}
