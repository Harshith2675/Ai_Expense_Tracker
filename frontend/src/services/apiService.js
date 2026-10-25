/**
 * apiService.js — Unified service layer for AI Expense Tracker.
 * All dollar amounts are sent/received as plain JS numbers (floats).
 * The backend stores them as integer cents — this layer handles the boundary.
 */

/**
 * Resolves the backend API base URL from Vite environment variables.
 * Checks VITE_API_BASE_URL first, then VITE_API_URL, and defaults to local dev.
 * Normalizes the URL so that either 'https://service.onrender.com' or
 * 'https://service.onrender.com/api' (with or without trailing slash) resolves properly.
 */
export function getStoredApiUrl() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('expense_tracker_api_url') || '';
  }
  return '';
}

export function setStoredApiUrl(url) {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('expense_tracker_api_url', url.trim());
    } else {
      localStorage.removeItem('expense_tracker_api_url');
    }
  }
}

/**
 * Resolves the backend API base URL.
 * Priority:
 * 1. Explicit override passed in
 * 2. User-saved URL in browser localStorage
 * 3. Build-time environment variable VITE_API_BASE_URL or VITE_API_URL
 * 4. Localhost default (only when running on local development machines)
 */
export function resolveApiBaseUrl(overrideUrl = null) {
  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const rawUrl = (
    overrideUrl ||
    getStoredApiUrl() ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    (isLocalHost ? "http://localhost:5050/api" : "")
  );

  const envUrl = (rawUrl || "").trim().replace(/\/+$/, "");
  if (!envUrl) return "";

  return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}

export const API_BASE_URL = resolveApiBaseUrl();

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 12000;


async function apiFetch(path, options = {}) {
  const baseUrl = options.baseUrlOverride !== undefined ? options.baseUrlOverride : getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Backend API URL is not configured. Running in offline/sample mode.");
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─────────────────────────────────────────────── Health
export async function checkBackendHealth(urlOverride = null) {
  try {
    const baseUrl = urlOverride !== null ? resolveApiBaseUrl(urlOverride) : getApiBaseUrl();
    if (!baseUrl) {
      return { status: "offline", reason: "unconfigured" };
    }
    const res = await apiFetch("/health", { baseUrlOverride: baseUrl });
    if (!res.ok) throw new Error("Non-2xx response");
    return await res.json();
  } catch {
    return { status: "offline" };
  }
}

// ─────────────────────────────────────────────── Summary
export async function fetchSummary() {
  try {
    const res = await apiFetch("/summary");
    if (!res.ok) throw new Error("Failed to fetch summary");
    return await res.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────── Transactions

/**
 * List transactions with filtering, sorting, and pagination.
 * @param {{
 *   page?: number, limit?: number,
 *   q?: string, type?: string, category?: string,
 *   payment_method?: string, detection?: string,
 *   date_from?: string, date_to?: string,
 *   sort?: 'newest'|'oldest'|'amount_desc'|'amount_asc'
 * }} params
 */
export async function fetchTransactions(params = {}) {
  try {
    const qs = new URLSearchParams();
    if (params.page)           qs.set("page",           params.page);
    if (params.limit)          qs.set("limit",           params.limit);
    if (params.q)              qs.set("q",               params.q);
    if (params.type)           qs.set("type",            params.type);
    if (params.category)       qs.set("category",        params.category);
    if (params.payment_method) qs.set("payment_method",  params.payment_method);
    if (params.detection)      qs.set("detection",       params.detection);
    if (params.date_from)      qs.set("date_from",       params.date_from);
    if (params.date_to)        qs.set("date_to",         params.date_to);
    if (params.sort)           qs.set("sort",            params.sort);
    const res = await apiFetch(`/transactions?${qs.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch transactions");
    const json = await res.json();
    return {
      ...json,
      data: json.data.map(normaliseTransaction),
    };
  } catch {
    return null;
  }
}

/**
 * Create a new transaction.
 * @returns {Promise<{ data?: object, errors?: string[], apiError?: string }>}
 */
export async function createTransaction(payload) {
  try {
    const res = await apiFetch("/transactions", {
      method: "POST",
      body: JSON.stringify(apiPayload(payload)),
    });
    const json = await res.json();
    if (!res.ok) {
      return { errors: json.errors || [json.error || "Unknown error"] };
    }
    return { data: normaliseTransaction(json) };
  } catch (err) {
    return { apiError: err.message };
  }
}

/**
 * Update an existing transaction.
 * @returns {Promise<{ data?: object, errors?: string[], apiError?: string }>}
 */
export async function updateTransaction(id, payload) {
  try {
    const res = await apiFetch(`/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(apiPayload(payload)),
    });
    const json = await res.json();
    if (!res.ok) {
      return { errors: json.errors || [json.error || "Unknown error"] };
    }
    return { data: normaliseTransaction(json) };
  } catch (err) {
    return { apiError: err.message };
  }
}

/**
 * Delete a transaction.
 * @returns {Promise<{ ok: boolean, apiError?: string }>}
 */
export async function deleteTransaction(id) {
  try {
    const res = await apiFetch(`/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, apiError: json.error || "Delete failed" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, apiError: err.message };
  }
}

// ─────────────────────────────────────────────── AI helper
export async function predictCategory(description) {
  try {
    const res = await apiFetch("/ai/predict-category", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    if (!res.ok) throw new Error("Failed to predict");
    return await res.json();
  } catch {
    // Client-side heuristic fallback
    const d = description.toLowerCase();
    if (/uber|lyft|gas|transit|fuel|train|metro|bus/.test(d))
      return { category: "Transportation", confidence: 0.91 };
    if (/whole foods|grocery|market|coffee|restaurant|dinner|cafe|food/.test(d))
      return { category: "Food", confidence: 0.89 };
    if (/rent|mortgage|apartment|lease/.test(d))
      return { category: "Rent", confidence: 0.98 };
    if (/utility|electric|water|internet|wifi|power|bill/.test(d))
      return { category: "Bills", confidence: 0.95 };
    if (/amazon|store|apple|shop|clothing|mall/.test(d))
      return { category: "Shopping", confidence: 0.82 };
    if (/gym|fitness|doctor|wellness|health|hospital/.test(d))
      return { category: "Healthcare", confidence: 0.88 };
    return { category: "Other", confidence: 0.50 };
  }
}

// ─────────────────────────────────────────────── Automatic Expense Detection

export async function fetchAutoDetectionStatus(modeOverride) {
  try {
    const q = modeOverride ? `?mode=${encodeURIComponent(modeOverride)}` : "";
    const res = await apiFetch(`/automatic-detection/status${q}`);
    if (!res.ok) throw new Error("Failed to fetch detection status");
    return await res.json();
  } catch (err) {
    return {
      provider_id: "disconnected",
      provider_name: "Offline / Disconnected",
      is_configured: false,
      is_demo: true,
      mode: "disconnected",
      connection_status: "disconnected",
      message: err.message || "Failed to connect to backend",
      last_sync: null,
      detected_count: 0,
      pending_count: 0,
      approved_auto_count: 0,
      supported_providers: [],
      real_provider_configured: false,
    };
  }
}

export async function triggerAutoDetectionSync(modeOverride) {
  try {
    const body = modeOverride ? JSON.stringify({ mode: modeOverride }) : JSON.stringify({});
    const res = await apiFetch("/automatic-detection/sync", {
      method: "POST",
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Sync failed" };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err.message || "Network error during sync" };
  }
}

export async function fetchPendingTransactions() {
  try {
    const res = await apiFetch("/automatic-detection/pending");
    if (!res.ok) throw new Error("Failed to fetch pending transactions");
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("fetchPendingTransactions error:", err);
    return [];
  }
}

export async function reviewPendingTransaction(id, action, updates = {}) {
  try {
    const res = await apiFetch(`/automatic-detection/review/${id}`, {
      method: "POST",
      body: JSON.stringify({
        action,
        category: updates.category,
        transaction_type: updates.transaction_type || updates.type,
        notes: updates.notes,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Review action failed" };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function reviewAllPendingTransactions(action) {
  try {
    const res = await apiFetch("/automatic-detection/review-all", {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Bulk review failed" };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function fetchSyncHistory(limit = 10) {
  try {
    const res = await apiFetch(`/automatic-detection/history?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch sync history");
    const json = await res.json();
    return json.history || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────── Budget Management

export async function fetchBudgets(month, year, currency) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    if (currency) params.append("currency", currency);
    const q = params.toString() ? `?${params.toString()}` : "";

    const res = await apiFetch(`/budgets${q}`);
    if (!res.ok) throw new Error("Failed to fetch budgets");
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("fetchBudgets error:", err);
    return [];
  }
}

export async function fetchBudgetSummary(month, year, currency) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    if (currency) params.append("currency", currency);
    const q = params.toString() ? `?${params.toString()}` : "";

    const res = await apiFetch(`/budgets/summary${q}`);
    if (!res.ok) throw new Error("Failed to fetch budget summary");
    return await res.json();
  } catch (err) {
    console.error("fetchBudgetSummary error:", err);
    return null;
  }
}

export async function createBudget(payload) {
  try {
    const res = await apiFetch("/budgets", {
      method: "POST",
      body: JSON.stringify({
        category: payload.category,
        amount: Number(payload.amount),
        month: payload.month ? Number(payload.month) : undefined,
        year: payload.year ? Number(payload.year) : undefined,
        period: payload.period || "monthly",
        notes: payload.notes || "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Failed to create budget" };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err.message || "Network error creating budget" };
  }
}

export async function updateBudget(id, payload) {
  try {
    const res = await apiFetch(`/budgets/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        category: payload.category,
        amount: payload.amount !== undefined ? Number(payload.amount) : undefined,
        month: payload.month ? Number(payload.month) : undefined,
        year: payload.year ? Number(payload.year) : undefined,
        notes: payload.notes,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Failed to update budget" };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err.message || "Network error updating budget" };
  }
}

export async function deleteBudget(id) {
  try {
    const res = await apiFetch(`/budgets/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Failed to delete budget" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Network error deleting budget" };
  }
}

// ─────────────────────────────────────────────── AI Insights

export async function fetchInsightsSummary(month, year, currency) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    if (currency) params.append("currency", currency);
    const res = await apiFetch(`/insights/summary?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch insights summary");
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.error("fetchInsightsSummary error:", err);
    return null;
  }
}

export async function fetchInsightsCategories(month, year) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    const res = await apiFetch(`/insights/categories?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch category insights");
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("fetchInsightsCategories error:", err);
    return [];
  }
}

export async function fetchInsightsTrends(months = 6, month, year) {
  try {
    const params = new URLSearchParams({ months });
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    const res = await apiFetch(`/insights/trends?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch spending trends");
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.error("fetchInsightsTrends error:", err);
    return null;
  }
}

export async function fetchInsightsAnomalies(month, year, currency) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    if (currency) params.append("currency", currency);
    const res = await apiFetch(`/insights/anomalies?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch transaction anomalies");
    const json = await res.json();
    return json.data || { anomalies: [], total_flagged: 0, insufficient_data_reasons: [] };
  } catch (err) {
    console.error("fetchInsightsAnomalies error:", err);
    return { anomalies: [], total_flagged: 0, insufficient_data_reasons: [] };
  }
}

export async function dismissAnomaly(txId) {
  try {
    const res = await apiFetch(`/insights/anomalies/${txId}/dismiss`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || "Failed to dismiss anomaly" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Network error dismissing anomaly" };
  }
}

export async function fetchInsightsRecommendations(month, year, currency) {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);
    if (currency) params.append("currency", currency);
    const res = await apiFetch(`/insights/recommendations?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch recommendations");
    const json = await res.json();
    return json.data || { recommendations: [], total_recommendations: 0 };
  } catch (err) {
    console.error("fetchInsightsRecommendations error:", err);
    return { recommendations: [], total_recommendations: 0 };
  }
}

export async function fetchRecurringExpenses() {
  try {
    const res = await apiFetch("/insights/recurring");
    if (!res.ok) throw new Error("Failed to fetch recurring expenses");
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("fetchRecurringExpenses error:", err);
    return [];
  }
}

// ─────────────────────────────────────────────── Helpers

/**
 * Convert frontend form payload → API body shape.
 */
function apiPayload(payload) {
  return {
    transaction_type: payload.type || payload.transaction_type,
    category:         payload.category,
    description:      payload.description,
    payment_method:   payload.paymentMethod || payload.payment_method || "Other",
    amount:           payload.amount,
    transaction_date: payload.date || payload.transaction_date,
    notes:            payload.notes || "",
  };
}

/**
 * Normalise a raw API transaction object to a consistent frontend shape.
 * Maps snake_case → camelCase and provides sensible defaults.
 */
export function normaliseTransaction(raw) {
  return {
    id:              raw.id,
    type:            raw.transaction_type || raw.type || "expense",
    category:        raw.category || "Other",
    description:     raw.description || "",
    merchant:        raw.description || "",   // alias for legacy components
    paymentMethod:   raw.payment_method || "Other",
    amount:          Number(raw.amount) || 0,
    date:            raw.transaction_date || raw.date || "",
    notes:           raw.notes || "",
    detectionMethod: raw.detection_method || "manual",
    createdAt:       raw.created_at || "",
    updatedAt:       raw.updated_at || "",
    // Flag to distinguish real DB records from sample data
    isFromDB:        true,
  };
}
