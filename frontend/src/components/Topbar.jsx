import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  CheckCircle2,
  Server
} from 'lucide-react';

export default function Topbar({
  backendOnline,
  theme,
  setTheme,
  searchQuery,
  setSearchQuery,
  setMobileOpen
}) {
  const { currency, setCurrency, symbol } = useCurrency();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifications = [
    { id: 1, title: 'Budget Limit Reached', text: 'Shopping category is at 97% of limit', time: '10m ago', unread: true },
    { id: 2, title: 'Salary Cleared', text: '$6,200 deposited from Apex Global Corp', time: '2h ago', unread: false },
    { id: 3, title: 'AI Anomaly Detected', text: 'No unusual transactions detected this week', time: '1d ago', unread: false },
  ];

  return (
    <header className="topbar" id="app-topbar">
      <div className="topbar-left">
        <button
          id="menu-toggle-btn"
          className="menu-toggle-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            id="global-search-input"
            type="text"
            className="search-input"
            placeholder="Search transactions, merchants, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="topbar-right">
        {/* Currency Selector */}
        <div className="currency-selector-header" style={{ display: 'flex', alignItems: 'center' }}>
          <select
            id="header-currency-select"
            className="form-select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
            aria-label="Currency Selector"
          >
            <option value="INR">₹ INR</option>
            <option value="USD">$ USD</option>
          </select>
        </div>

        {/* Backend Connectivity Status */}
        <div
          id="backend-status-indicator"
          className="status-indicator-badge"
          title={backendOnline ? "Connected to Flask API on :5050" : "Running on local sample data preview"}
        >
          <span className={`status-dot ${backendOnline ? 'online' : 'simulated'}`} />
          <span>{backendOnline ? 'Flask API Live' : 'Sample Data Mode'}</span>
        </div>

        {/* Theme Toggle */}
        <button
          id="theme-toggle-btn"
          className="icon-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            id="notifications-btn"
            className="icon-button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="notification-count">3</span>
          </button>

          {showNotifications && (
            <div
              id="notifications-dropdown"
              style={{
                position: 'absolute',
                top: '48px',
                right: '0',
                width: '320px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '16px',
                zIndex: 60,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', cursor: 'pointer' }}>Mark all read</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      background: n.unread ? 'var(--bg-surface-elevated)' : 'transparent',
                      borderLeft: n.unread ? '3px solid var(--accent-primary)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.text}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: '4px' }}>{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div style={{ position: 'relative' }}>
          <button
            id="user-profile-menu-btn"
            className="user-profile-btn"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
          >
            <div className="user-avatar">AM</div>
            <div className="user-info">
              <span className="user-name">Alex Mercer</span>
              <span className="user-role">Fintech Pro</span>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {showProfileMenu && (
            <div
              id="user-profile-dropdown"
              style={{
                position: 'absolute',
                top: '48px',
                right: '0',
                width: '240px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '16px',
                zIndex: 60,
              }}
            >
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Alex Mercer</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>alex.mercer@fintech.io</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Base Currency:</span>
                  <span style={{ fontWeight: 600 }}>{currency} ({symbol})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Database:</span>
                  <span style={{ fontWeight: 600 }}>SQLite</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>AI Engine:</span>
                  <span style={{ fontWeight: 600, color: '#a855f7' }}>Scikit-learn</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
