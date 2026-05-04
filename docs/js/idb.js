/* obiDesk — IndexedDB Helper
   Two stores: captures (field queue) + settings (preferences)
   Fire-and-forget safe. Silent fallback on IDB failure. */

(function() {
  var DB_NAME = 'obidesk';
  var DB_VERSION = 1;
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
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      } catch (e) { reject(e); }
    });
    return _dbPromise;
  }

  window.obiDB = {
    init: openDB,

    saveCapture: function(data) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('captures', 'readwrite');
          var store = tx.objectStore('captures');
          data.createdAt = new Date().toISOString();
          var req = store.add(data);
          req.onsuccess = function() { resolve(req.result); };
          req.onerror = function() { reject(req.error); };
        });
      }).catch(function() { return -1; });
    },

    getAllCaptures: function() {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('captures', 'readonly');
          var req = tx.objectStore('captures').getAll();
          req.onsuccess = function() { resolve(req.result || []); };
          req.onerror = function() { reject(req.error); };
        });
      }).catch(function() { return []; });
    },

    deleteCapture: function(id) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('captures', 'readwrite');
          var req = tx.objectStore('captures').delete(id);
          req.onsuccess = function() { resolve(); };
          req.onerror = function() { reject(req.error); };
        });
      }).catch(function() {});
    },

    clearCaptures: function() {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('captures', 'readwrite');
          var req = tx.objectStore('captures').clear();
          req.onsuccess = function() { resolve(); };
          req.onerror = function() { reject(req.error); };
        });
      }).catch(function() {});
    },

    saveSetting: function(key, value) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('settings', 'readwrite');
          var req = tx.objectStore('settings').put(value, key);
          req.onsuccess = function() { resolve(); };
          req.onerror = function() { reject(req.error); };
        });
      }).catch(function() {});
    },

    getSetting: function(key) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('settings', 'readonly');
          var req = tx.objectStore('settings').get(key);
          req.onsuccess = function() { resolve(req.result); };
          req.onerror = function() { reject(req.error); };
        });
      }).catch(function() { return undefined; });
    }
  };
})();
