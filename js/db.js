/**
 * db.js — IndexedDB Data Layer
 * Handles all persistent storage for transactions, budgets, and preferences.
 */

const DB_NAME = 'FinPulseDB';
const DB_VERSION = 1;
const STORE_TRANSACTIONS = 'transactions';
const STORE_BUDGETS = 'budgets';
const STORE_PREFERENCES = 'preferences';

const DB = {
  _db: null,

  /**
   * Open / upgrade the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Transactions store
        if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('type', 'type', { unique: false });
          txStore.createIndex('category', 'category', { unique: false });
          txStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Budgets store
        if (!db.objectStoreNames.contains(STORE_BUDGETS)) {
          const bgStore = db.createObjectStore(STORE_BUDGETS, { keyPath: 'id' });
          bgStore.createIndex('month_year', ['month', 'year'], { unique: false });
          bgStore.createIndex('category', 'category', { unique: false });
        }

        // Preferences store
        if (!db.objectStoreNames.contains(STORE_PREFERENCES)) {
          db.createObjectStore(STORE_PREFERENCES, { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /** Execute a transaction on one or more stores */
  _tx(stores, mode, fn) {
    return this.open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      tx.onerror = () => reject(tx.error);
      const result = fn(tx);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        tx.oncomplete = () => resolve();
      }
    }));
  },

  /** Wrap an IDBRequest in a Promise */
  _req(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== TRANSACTIONS ====================

  async addTransaction(tx) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_TRANSACTIONS, 'readwrite')
        .objectStore(STORE_TRANSACTIONS)
        .add(tx)
    );
  },

  async updateTransaction(tx) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_TRANSACTIONS, 'readwrite')
        .objectStore(STORE_TRANSACTIONS)
        .put(tx)
    );
  },

  async deleteTransaction(id) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_TRANSACTIONS, 'readwrite')
        .objectStore(STORE_TRANSACTIONS)
        .delete(id)
    );
  },

  async getAllTransactions() {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_TRANSACTIONS, 'readonly')
        .objectStore(STORE_TRANSACTIONS)
        .getAll()
    );
  },

  async getTransactionById(id) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_TRANSACTIONS, 'readonly')
        .objectStore(STORE_TRANSACTIONS)
        .get(id)
    );
  },

  // ==================== BUDGETS ====================

  async addBudget(budget) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_BUDGETS, 'readwrite')
        .objectStore(STORE_BUDGETS)
        .add(budget)
    );
  },

  async updateBudget(budget) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_BUDGETS, 'readwrite')
        .objectStore(STORE_BUDGETS)
        .put(budget)
    );
  },

  async deleteBudget(id) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_BUDGETS, 'readwrite')
        .objectStore(STORE_BUDGETS)
        .delete(id)
    );
  },

  async getAllBudgets() {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_BUDGETS, 'readonly')
        .objectStore(STORE_BUDGETS)
        .getAll()
    );
  },

  async getBudgetById(id) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_BUDGETS, 'readonly')
        .objectStore(STORE_BUDGETS)
        .get(id)
    );
  },

  // ==================== PREFERENCES ====================

  async getPreference(key, defaultValue = null) {
    try {
      const db = await this.open();
      const result = await this._req(
        db.transaction(STORE_PREFERENCES, 'readonly')
          .objectStore(STORE_PREFERENCES)
          .get(key)
      );
      return result ? result.value : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async setPreference(key, value) {
    const db = await this.open();
    return this._req(
      db.transaction(STORE_PREFERENCES, 'readwrite')
        .objectStore(STORE_PREFERENCES)
        .put({ key, value })
    );
  },

  async clearAllData() {
    const db = await this.open();
    const tx = db.transaction([STORE_TRANSACTIONS, STORE_BUDGETS], 'readwrite');
    tx.objectStore(STORE_TRANSACTIONS).clear();
    tx.objectStore(STORE_BUDGETS).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
};
