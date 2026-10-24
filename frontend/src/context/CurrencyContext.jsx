import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  formatCurrency,
  getCurrencySymbol,
  getStoredCurrency,
  setStoredCurrency,
  DEFAULT_CURRENCY
} from '../utils/currency';

const CurrencyContext = createContext({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  symbol: '₹',
  formatAmount: (amt) => String(amt)
});

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => getStoredCurrency());

  const setCurrency = useCallback((newCurrency) => {
    const updated = setStoredCurrency(newCurrency);
    setCurrencyState(updated);
  }, []);

  const symbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const formatAmount = useCallback((amount, options = {}) => {
    return formatCurrency(amount, currency, options);
  }, [currency]);

  const value = useMemo(() => ({
    currency,
    setCurrency,
    symbol,
    formatAmount
  }), [currency, setCurrency, symbol, formatAmount]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
