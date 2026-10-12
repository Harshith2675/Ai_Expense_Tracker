/**
 * Global Environment Configuration
 * Provides dynamic fallback across browser window runtime, localStorage, and built-in defaults.
 */
(function(window) {
  window.__FINPULSE_ENV__ = {
    SUPABASE_URL: window.__FINPULSE_ENV__?.SUPABASE_URL || localStorage.getItem('finpulse_supabase_url') || '',
    SUPABASE_ANON_KEY: window.__FINPULSE_ENV__?.SUPABASE_ANON_KEY || localStorage.getItem('finpulse_supabase_anon_key') || '',
    API_BASE_URL: window.__FINPULSE_ENV__?.API_BASE_URL || '',
    DEFAULT_CURRENCY: 'INR',
    DEFAULT_THEME: 'system'
  };
})(typeof window !== 'undefined' ? window : global);
