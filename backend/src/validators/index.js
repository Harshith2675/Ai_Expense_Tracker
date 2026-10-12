/**
 * FinPulse Backend Validators
 */
module.exports = {
  validateTransaction(data) {
    const { title, amount, type, category, date } = data;
    const errors = {};

    if (!title || title.trim().length === 0) {
      errors.title = 'Title is required.';
    } else if (title.trim().length > 100) {
      errors.title = 'Title must be under 100 characters.';
    }

    const amt = parseFloat(amount);
    if (amount === '' || amount === null || amount === undefined) {
      errors.amount = 'Amount is required.';
    } else if (isNaN(amt) || !isFinite(amt)) {
      errors.amount = 'Enter a valid number.';
    } else if (amt <= 0) {
      errors.amount = 'Amount must be greater than zero.';
    } else if (amt > 1_00_00_00_000) {
      errors.amount = 'Amount is too large.';
    }

    if (!type || !['income', 'expense'].includes(type)) {
      errors.type = 'Invalid transaction type.';
    }

    if (!category || category.trim() === '') {
      errors.category = 'Please select a category.';
    }

    if (!date || date.trim() === '') {
      errors.date = 'Date is required.';
    } else {
      const d = new Date(date + 'T00:00:00');
      if (isNaN(d.getTime())) {
        errors.date = 'Invalid date.';
      } else if (d.getFullYear() < 2000 || d.getFullYear() > 2099) {
        errors.date = 'Date must be between 2000 and 2099.';
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  validateBudget({ category, monthlyLimit, month, year }) {
    const errors = {};

    if (!category || category.trim() === '') {
      errors.category = 'Please select a category.';
    }

    const limit = parseFloat(monthlyLimit);
    if (!monthlyLimit) {
      errors.monthlyLimit = 'Monthly limit is required.';
    } else if (isNaN(limit) || limit <= 0) {
      errors.monthlyLimit = 'Enter a positive amount.';
    }

    const m = parseInt(month, 10);
    if (!month || isNaN(m) || m < 1 || m > 12) {
      errors.month = 'Invalid month.';
    }

    const y = parseInt(year, 10);
    if (!year || isNaN(y) || y < 2020 || y > 2099) {
      errors.year = 'Invalid year.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }
};
