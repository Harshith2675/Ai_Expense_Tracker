import React, { useState } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { Settings, Server, Database, Moon, Sun, RefreshCw, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import {
  checkBackendHealth,
  resolveApiBaseUrl,
  getStoredApiUrl,
  setStoredApiUrl
} from '../../services/apiService';

export default function SettingsView({ theme, setTheme, onResetSampleData }) {
  const { currency, setCurrency } = useCurrency();
  const [apiUrl, setApiUrl] = useState(getStoredApiUrl() || resolveApiBaseUrl());

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setSaveMessage('');
    const result = await checkBackendHealth(apiUrl);
    setTestResult(result);
    setTestingConnection(false);
  };

  const handleSaveApiUrl = () => {
    setStoredApiUrl(apiUrl);
    setSaveMessage('Backend URL saved successfully! Reloading data...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleResetApiUrl = () => {
    setStoredApiUrl('');
    const defaultUrl = resolveApiBaseUrl('');
    setApiUrl(defaultUrl);
    setSaveMessage('Reset to build default URL. Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="view-container" id="settings-view">
      <div className="section-card">
        <h2 className="chart-card-title">System & Application Settings</h2>
        <p className="chart-card-subtitle">Manage environment preferences, backend links, and display options</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
          {/* Appearance */}
          <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>Appearance</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Choose theme styling for high contrast or evening usage
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                id="theme-dark-btn"
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={16} />
                <span>Dark Slate Theme</span>
              </button>
              <button
                id="theme-light-btn"
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={16} />
                <span>Light Theme</span>
              </button>
            </div>
          </div>

          {/* Regional Currency */}
          <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>Currency & Region</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Select your preferred display currency and number formatting
            </p>
            <select
              id="currency-setting-select"
              className="form-select"
              style={{ maxWidth: '320px' }}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="INR">Indian Rupee (INR ₹)</option>
              <option value="USD">US Dollar (USD $)</option>
            </select>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.5, background: 'var(--bg-surface-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', maxWidth: '520px' }}>
              <span style={{ fontWeight: 600 }}>Note:</span> This setting changes the display currency formatting only (currency symbol and number grouping). It does not perform exchange-rate conversion; stored database transaction amounts and budget limits remain unchanged.
            </p>
          </div>

          {/* Backend & Database Integration */}
          <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>Flask REST API & SQLite Link</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Configured backend REST API endpoint
            </p>


            <div style={{ display: 'flex', gap: '10px', maxWidth: '620px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input
                id="backend-api-url-input"
                type="text"
                className="form-input"
                placeholder="https://your-service.onrender.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                style={{ flex: '1 1 280px' }}
              />
              <button
                id="test-backend-connection-btn"
                className="btn btn-secondary"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                <RefreshCw size={14} className={testingConnection ? 'animate-spin' : ''} />
                <span>{testingConnection ? 'Testing...' : 'Test API'}</span>
              </button>
              <button
                id="save-backend-url-btn"
                className="btn btn-primary"
                onClick={handleSaveApiUrl}
              >
                <Save size={14} />
                <span>Save & Connect</span>
              </button>
              <button
                id="reset-backend-url-btn"
                className="btn btn-secondary"
                onClick={handleResetApiUrl}
                title="Reset to build default"
              >
                <span>Reset</span>
              </button>
            </div>

            {saveMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  marginBottom: '10px',
                  background: 'var(--color-income-soft)',
                  color: 'var(--color-income)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  maxWidth: '620px'
                }}
              >
                {saveMessage}
              </div>
            )}

            {testResult && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: testResult.status === 'healthy' ? 'var(--color-income-soft)' : 'var(--color-warning-soft)',
                  color: testResult.status === 'healthy' ? 'var(--color-income)' : 'var(--color-warning)',
                  border: `1px solid ${testResult.status === 'healthy' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                }}
              >
                {testResult.status === 'healthy' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>
                  {testResult.status === 'healthy'
                    ? `Connected! Flask API v${testResult.version} (${testResult.database}) is active.`
                    : 'Backend API is currently unreachable. Make sure the Render URL is correct and the service is awake.'}
                </span>
              </div>
            )}
          </div>

          {/* Reset Demo Data */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>Sample Data Controls</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Reset modified transactions and balances back to initial default sample state
            </p>
            <button id="reset-sample-data-btn" className="btn btn-secondary" onClick={onResetSampleData}>
              <RefreshCw size={14} />
              <span>Reset to Default Sample Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
