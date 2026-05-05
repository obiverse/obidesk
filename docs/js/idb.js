/* ═══════════════════════════════════════════════
   obiDesk — IndexedDB Persistence Layer
   Stores: captures, settings, invoices, business_profile
   Fire-and-forget safe. Silent fallback on failure.
   ═══════════════════════════════════════════════ */

(function() {
  var DB_NAME = 'obidesk';
  var DB_VERSION = 2;
  var _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function(resolve, reject) {
      try {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function() {
          var db = req.result;
          if (!db.objectStoreNames.contains('captures')) {
            db.createObjectStore('captures', { keyPath: 'id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
          if (!db.objectStoreNames.contains('invoices')) {
            var invStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
            invStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
            invStore.createIndex('status', 'status', { unique: false });
            invStore.createIndex('clientName', 'clientName', { unique: false });
            invStore.createIndex('createdAt', 'createdAt', { unique: false });
          }
          if (!db.objectStoreNames.contains('business_profile')) {
            db.createObjectStore('business_profile');
          }
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      } catch (e) { reject(e); }
    });
    return _dbPromise;
  }

  // ── Generic helpers ────────────────────────────
  function idbPut(store, data, key) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var req = key !== undefined ? tx.objectStore(store).put(data, key) : tx.objectStore(store).put(data);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function idbGet(store, key) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readonly');
        var req = tx.objectStore(store).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function idbGetAll(store) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readonly');
        var req = tx.objectStore(store).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function idbDelete(store, key) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var req = tx.objectStore(store).delete(key);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function idbClear(store) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var req = tx.objectStore(store).clear();
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  window.obiDB = {
    init: openDB,

    // ── Captures (field queue) ──────────────────
    saveCapture: function(data) {
      data.createdAt = new Date().toISOString();
      return idbPut('captures', data).catch(function() { return -1; });
    },
    getAllCaptures: function() { return idbGetAll('captures').catch(function() { return []; }); },
    deleteCapture: function(id) { return idbDelete('captures', id).catch(function() {}); },
    clearCaptures: function() { return idbClear('captures').catch(function() {}); },

    // ── Settings (key-value) ────────────────────
    saveSetting: function(key, value) { return idbPut('settings', value, key).catch(function() {}); },
    getSetting: function(key) { return idbGet('settings', key).catch(function() { return undefined; }); },

    // ── Invoices ────────────────────────────────
    saveInvoice: function(invoice) {
      return idbPut('invoices', invoice).catch(function() { return -1; });
    },
    getInvoice: function(id) {
      return idbGet('invoices', id).catch(function() { return null; });
    },
    getAllInvoices: function() {
      return idbGetAll('invoices').then(function(list) {
        list.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
        return list;
      }).catch(function() { return []; });
    },
    updateInvoiceStatus: function(id, status) {
      return idbGet('invoices', id).then(function(inv) {
        if (!inv) return;
        inv.status = status;
        inv.updatedAt = new Date().toISOString();
        return idbPut('invoices', inv);
      }).catch(function() {});
    },
    deleteInvoice: function(id) { return idbDelete('invoices', id).catch(function() {}); },

    // ── Business Profile ────────────────────────
    saveBusinessProfile: function(profile) {
      return idbPut('business_profile', profile, 'profile').catch(function() {});
    },
    getBusinessProfile: function() {
      return idbGet('business_profile', 'profile').catch(function() { return null; });
    }
  };
})();
