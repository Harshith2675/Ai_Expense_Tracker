/**
 * supabase-client.js — Supabase Backend Client & Services
 * Handles Auth, PostgreSQL CRUD, RLS-scoped queries, RPC calls,
 * and seamless fallback to IndexedDB when in Guest/Offline mode.
 */

const SupabaseBackend = {
  client: null,
  currentUser: null,
  currentSession: null,
  authListeners: [],

  /**
   * Initialise the Supabase client if configured
   */
  async init() {
    if (!AppConfig.isSupabaseConfigured() || typeof window.supabase === 'undefined') {
      console.log('ℹ️ Supabase not configured or offline — operating in Local Guest Mode.');
      this.client = null;
      this.currentUser = null;
      return false;
    }

    try {
      const url = AppConfig.getSupabaseUrl();
      const key = AppConfig.getSupabaseAnonKey();

      this.client = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }
      });

      // Restore session
      const { data, error } = await this.client.auth.getSession();
      if (!error && data?.session) {
        this.currentSession = data.session;
        this.currentUser = data.session.user;
      }

      // Listen to auth events
      this.client.auth.onAuthStateChange(async (event, session) => {
        this.currentSession = session;
        this.currentUser = session?.user || null;
        this.notifyAuthListeners(event, session);
      });

      return true;
    } catch (err) {
      console.warn('⚠️ Supabase initialization failed:', err);
      this.client = null;
      return false;
    }
  },

  isOnlineMode() {
    return Boolean(this.client && this.currentUser);
  },

  onAuthStateChange(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
    }
  },

  notifyAuthListeners(event, session) {
    this.authListeners.forEach(fn => {
      try { fn(event, session); } catch (e) { console.error(e); }
    });
  },

  // ==================== AUTHENTICATION ====================
  auth: {
    async signUp(email, password, displayName = '') {
      if (!SupabaseBackend.client) {
        return { success: false, error: 'Supabase client is not configured. Configure URL and Anon Key in Settings.' };
      }
      try {
        const { data, error } = await SupabaseBackend.client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() }
          }
        });

        if (error) throw error;
        SupabaseBackend.currentUser = data.user;
        SupabaseBackend.currentSession = data.session;
        return { success: true, user: data.user, session: data.session };
      } catch (err) {
        return { success: false, error: err.message || 'Registration failed' };
      }
    },

    async signIn(email, password) {
      if (!SupabaseBackend.client) {
        return { success: false, error: 'Supabase client is not configured. Configure URL and Anon Key in Settings.' };
      }
      try {
        const { data, error } = await SupabaseBackend.client.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;
        SupabaseBackend.currentUser = data.user;
        SupabaseBackend.currentSession = data.session;
        return { success: true, user: data.user, session: data.session };
      } catch (err) {
        return { success: false, error: err.message || 'Sign in failed' };
      }
    },

    async signOut() {
      if (!SupabaseBackend.client) return { success: true };
      try {
        await SupabaseBackend.client.auth.signOut();
        SupabaseBackend.currentUser = null;
        SupabaseBackend.currentSession = null;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async resetPassword(email) {
      if (!SupabaseBackend.client) {
        return { success: false, error: 'Supabase client is not configured.' };
      }
      try {
        const { error } = await SupabaseBackend.client.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    getUser() {
      return SupabaseBackend.currentUser;
    }
  },

  // ==================== TRANSACTIONS CRUD ====================
  transactions: {
    async list(filters = {}) {
      if (!SupabaseBackend.isOnlineMode()) {
        return { success: true, data: await DB.getAllTransactions() };
      }

      try {
        let query = SupabaseBackend.client
          .from('transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (filters.type && filters.type !== 'all') {
          query = query.eq('type', filters.type);
        }
        if (filters.category_id && filters.category_id !== 'all') {
          query = query.eq('category_id', filters.category_id);
        }
        if (filters.startDate) {
          query = query.gte('transaction_date', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('transaction_date', filters.endDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Map backend schema to frontend model
        const mapped = (data || []).map(row => ({
          id: row.id,
          type: row.type,
          amount: parseFloat(row.amount),
          title: row.description,
          category: row.category_id || row.category_name?.toLowerCase() || 'other',
          date: row.transaction_date,
          paymentMethod: row.payment_method,
          note: row.notes || '',
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));

        return { success: true, data: mapped };
      } catch (err) {
        console.warn('Backend transactions.list error, falling back to local DB:', err);
        return { success: true, data: await DB.getAllTransactions() };
      }
    },

    async create(txData) {
      if (!SupabaseBackend.isOnlineMode()) {
        await DB.saveTransaction(txData);
        return { success: true, data: txData };
      }

      try {
        const payload = {
          user_id: SupabaseBackend.currentUser.id,
          type: txData.type,
          amount: parseFloat(txData.amount),
          description: txData.title,
          category_name: txData.category,
          transaction_date: txData.date,
          payment_method: txData.paymentMethod || 'other',
          notes: txData.note || txData.notes || ''
        };

        const { data, error } = await SupabaseBackend.client
          .from('transactions')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const created = {
          id: data.id,
          type: data.type,
          amount: parseFloat(data.amount),
          title: data.description,
          category: txData.category,
          date: data.transaction_date,
          paymentMethod: data.payment_method,
          note: data.notes || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };

        // Cache in local DB for offline access
        await DB.saveTransaction(created);
        return { success: true, data: created };
      } catch (err) {
        console.error('Failed to create transaction on backend:', err);
        return { success: false, error: err.message };
      }
    },

    async update(id, txData) {
      if (!SupabaseBackend.isOnlineMode()) {
        await DB.saveTransaction(txData);
        return { success: true, data: txData };
      }

      try {
        const payload = {
          type: txData.type,
          amount: parseFloat(txData.amount),
          description: txData.title,
          category_name: txData.category,
          transaction_date: txData.date,
          payment_method: txData.paymentMethod || 'other',
          notes: txData.note || txData.notes || ''
        };

        const { data, error } = await SupabaseBackend.client
          .from('transactions')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        const updated = {
          id: data.id,
          type: data.type,
          amount: parseFloat(data.amount),
          title: data.description,
          category: txData.category,
          date: data.transaction_date,
          paymentMethod: data.payment_method,
          note: data.notes || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };

        await DB.saveTransaction(updated);
        return { success: true, data: updated };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async delete(id) {
      if (!SupabaseBackend.isOnlineMode()) {
        await DB.deleteTransaction(id);
        return { success: true };
      }

      try {
        const { error } = await SupabaseBackend.client
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await DB.deleteTransaction(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },

  // ==================== BUDGETS CRUD ====================
  budgets: {
    async list() {
      if (!SupabaseBackend.isOnlineMode()) {
        return { success: true, data: await DB.getAllBudgets() };
      }

      try {
        const { data, error } = await SupabaseBackend.client
          .from('budgets')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (data || []).map(row => {
          const s = new Date(row.start_date);
          return {
            id: row.id,
            category: row.category_id || '',
            monthlyLimit: parseFloat(row.amount),
            month: s.getMonth() + 1,
            year: s.getFullYear(),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        });

        return { success: true, data: mapped };
      } catch (err) {
        console.warn('Backend budgets.list error, falling back to local DB:', err);
        return { success: true, data: await DB.getAllBudgets() };
      }
    },

    async create(budgetData) {
      if (!SupabaseBackend.isOnlineMode()) {
        await DB.saveBudget(budgetData);
        return { success: true, data: budgetData };
      }

      try {
        const month = parseInt(budgetData.month, 10);
        const year = parseInt(budgetData.year, 10);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const payload = {
          user_id: SupabaseBackend.currentUser.id,
          name: `${budgetData.category || 'Overall'} Budget`,
          amount: parseFloat(budgetData.monthlyLimit),
          period: 'monthly',
          start_date: startDate,
          end_date: endDate
        };

        const { data, error } = await SupabaseBackend.client
          .from('budgets')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const created = {
          id: data.id,
          category: budgetData.category,
          monthlyLimit: parseFloat(data.amount),
          month: month,
          year: year,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };

        await DB.saveBudget(created);
        return { success: true, data: created };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async update(id, budgetData) {
      if (!SupabaseBackend.isOnlineMode()) {
        await DB.saveBudget(budgetData);
        return { success: true, data: budgetData };
      }

      try {
        const payload = {
          amount: parseFloat(budgetData.monthlyLimit)
        };

        const { data, error } = await SupabaseBackend.client
          .from('budgets')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        await DB.saveBudget(budgetData);
        return { success: true, data: budgetData };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    async delete(id) {
      if (!SupabaseBackend.isOnlineMode()) {
        await DB.deleteBudget(id);
        return { success: true };
      }

      try {
        const { error } = await SupabaseBackend.client
          .from('budgets')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await DB.deleteBudget(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },

  // ==================== DASHBOARD & ANALYTICS RPC ====================
  async getDashboardSummary(startDate, endDate) {
    if (!this.isOnlineMode()) return null;
    try {
      const { data, error } = await this.client.rpc('get_dashboard_summary', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('RPC get_dashboard_summary failed, using client calculations:', err);
      return null;
    }
  },

  async getAnalyticsSummary(startDate, endDate) {
    if (!this.isOnlineMode()) return null;
    try {
      const { data, error } = await this.client.rpc('get_analytics_summary', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('RPC get_analytics_summary failed, using client calculations:', err);
      return null;
    }
  }
};
