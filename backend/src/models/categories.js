/**
 * Category Definitions and Default Limits
 */
const EXPENSE_CATEGORIES = [
  { id: 'food_dining', label: 'Food & Dining', emoji: '🍽️', color: '#16a34a' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒', color: '#059669' },
  { id: 'transportation', label: 'Transportation', emoji: '🚗', color: '#2563eb' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#f59e0b' },
  { id: 'bills_utilities', label: 'Bills & Utilities', emoji: '💡', color: '#dc2626' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬', color: '#8b5cf6' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥', color: '#06b6d4' },
  { id: 'education', label: 'Education', emoji: '📚', color: '#6366f1' },
  { id: 'travel', label: 'Travel', emoji: '✈️', color: '#ec4899' },
  { id: 'personal_care', label: 'Personal Care', emoji: '💆', color: '#14b8a6' },
  { id: 'subscriptions', label: 'Subscriptions', emoji: '📱', color: '#f97316' },
  { id: 'other', label: 'Other', emoji: '📦', color: '#64748b' },
];

const DEFAULT_CATEGORY_LIMITS = {
  'food_dining': 6000,
  'groceries': 5000,
  'transportation': 3000,
  'shopping': 4000,
  'bills_utilities': 3500,
  'entertainment': 2000,
  'healthcare': 1500,
  'education': 2500,
  'travel': 4000,
  'personal_care': 1000,
  'subscriptions': 500,
  'other': 1500,
};

module.exports = {
  EXPENSE_CATEGORIES,
  DEFAULT_CATEGORY_LIMITS,
};
