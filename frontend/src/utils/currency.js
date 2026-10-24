/**
 * utils/currency.js — Centralized currency formatting and helpers for AI Expense Tracker.
 * Supports Indian Rupee (INR ₹) with Indian number grouping (e.g. ₹1,25,000.50)
 * and US Dollar (USD $) with US number grouping (e.g. $125,000.50).
 */

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR ₹)', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD $)', locale: 'en-US' },
];

export const DEFAULT_CURRENCY = 'INR';
export const STORAGE_KEY = 'expense_tracker_currency';

/**
 * Get the initial currency from localStorage (defaulting to INR for new users)
 */
export function getStoredCurrency() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'USD' || val === 'INR') {
      return val;
    }
  } catch (e) {
    console.warn('Unable to read currency from localStorage', e);
  }
  return DEFAULT_CURRENCY;
}

/**
 * Save currency preference to localStorage
 */
export function setStoredCurrency(currencyCode) {
  const code = currencyCode === 'USD' ? 'USD' : 'INR';
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch (e) {
    console.warn('Unable to save currency to localStorage', e);
  }
  return code;
}

/**
 * Get currency symbol ('₹' or '$')
 */
export function getCurrencySymbol(currency = DEFAULT_CURRENCY) {
  return currency === 'USD' ? '$' : '₹';
}

/**
 * Format a numeric amount using the appropriate locale and currency format
 * @param {number|string} amount - numeric amount to format
 * @param {string} currency - 'INR' or 'USD'
 * @param {Intl.NumberFormatOptions} options - optional overrides
 * @returns {string} e.g. "₹1,25,000.50" or "$125,000.50"
 */
export function formatCurrency(amount, currency = DEFAULT_CURRENCY, options = {}) {
  const num = Number(amount) || 0;
  const isUSD = currency === 'USD';
  const locale = isUSD ? 'en-US' : 'en-IN';
  const currencyCode = isUSD ? 'USD' : 'INR';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...options
  }).format(num);
}
