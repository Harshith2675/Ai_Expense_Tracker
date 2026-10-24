import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  TrendingUp,
  History,
  Sparkles,
  PieChart,
  BrainCircuit,
  FileBarChart,
  Settings,
  X,
  Wallet
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenAddExpense,
  mobileOpen,
  setMobileOpen
}) {
  const navItems = [
    { id: 'dashboard',       label: 'Dashboard',           icon: LayoutDashboard },
    { id: 'add-expense',     label: 'Add Expense',          icon: PlusCircle,    accent: 'expense' },
    { id: 'add-income',      label: 'Add Income',           icon: TrendingUp,    accent: 'income' },
    { id: 'transactions',    label: 'Transaction History',  icon: History },
    { id: 'auto-detection',  label: 'Automatic Detection',  icon: Sparkles,      badge: 'AI' },
    { id: 'budget',          label: 'Budget Management',    icon: PieChart },
    { id: 'ai-insights',     label: 'AI Insights',          icon: BrainCircuit,  badge: '3' },
    { id: 'reports',         label: 'Reports',              icon: FileBarChart },
    { id: 'settings',        label: 'Settings',             icon: Settings },
  ];

  const handleNavClick = (item) => {
    setActiveTab(item.id);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 45 }}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} id="app-sidebar">
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-icon">
              <Wallet size={20} />
            </div>
            <div className="brand-title">
              <span>AI Expense</span>
              <span className="brand-subtitle">Smart Analytics</span>
            </div>
          </div>
          {mobileOpen && (
            <button
              id="sidebar-close-btn"
              className="icon-button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const accentStyle = item.accent === 'expense'
              ? { '--nav-accent': '#ef4444' }
              : item.accent === 'income'
              ? { '--nav-accent': '#10b981' }
              : {};
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                className={`nav-item ${isActive ? 'active' : ''} ${item.accent ? `nav-accent-${item.accent}` : ''}`}
                style={accentStyle}
                onClick={() => handleNavClick(item)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-demo-banner">
            <strong>AI Expense Tracker v2</strong>
            Flask API + SQLite backend connected.
          </div>
        </div>
      </aside>
    </>
  );
}
