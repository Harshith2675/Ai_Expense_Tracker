/**
 * config.js — FinPulse Application & Supabase Configuration
 * Stores public environment settings, Supabase URL, and Anon key.
 * Can be configured via environment or directly through the app Settings UI.
 */

const AppConfig = {
  // Default placeholders — users can override in Settings -> Supabase Connection
  DEFAULT_SUPABASE_URL: '',
  DEFAULT_SUPABASE_ANON_KEY: '',

  getSupabaseUrl() {
    const envUrl = (typeof window !== 'undefined' && window.__FINPULSE_ENV__?.SUPABASE_URL) || '';
    return localStorage.getItem('finpulse_supabase_url') || envUrl || this.DEFAULT_SUPABASE_URL || '';
  },

  getSupabaseAnonKey() {
    const envKey = (typeof window !== 'undefined' && window.__FINPULSE_ENV__?.SUPABASE_ANON_KEY) || '';
    return localStorage.getItem('finpulse_supabase_anon_key') || envKey || this.DEFAULT_SUPABASE_ANON_KEY || '';
  },

  setSupabaseCredentials(url, anonKey) {
    if (url) localStorage.setItem('finpulse_supabase_url', url.trim());
    else localStorage.removeItem('finpulse_supabase_url');

    if (anonKey) localStorage.setItem('finpulse_supabase_anon_key', anonKey.trim());
    else localStorage.removeItem('finpulse_supabase_anon_key');
  },

  isSupabaseConfigured() {
    const url = this.getSupabaseUrl();
    const key = this.getSupabaseAnonKey();
    return Boolean(url && key && url.startsWith('http') && key.length > 20);
  }
};
