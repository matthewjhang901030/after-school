/**
 * IndexedDB wrapper — stores embedding vectors so they survive page reloads.
 * Database: "afterschool"  |  Store: "embeddings"
 * Key: composite string "<modelId>/<cardId>"
 * @namespace App.store.idb
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const DB_NAME    = 'afterschool';
  const STORE_NAME = 'embeddings';
  const DB_VERSION = 1;

  /** @type {Promise<IDBDatabase>|null} */
  let _dbPromise = null;

  /**
   * Open (or reuse) the IndexedDB connection.
   * @returns {Promise<IDBDatabase>}
   */
  function _open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);  // keyPath = explicit key on put()
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror   = function (e) {
        _dbPromise = null;
        reject(e.target.error);
      };
    });
    return _dbPromise;
  }

  /**
   * Compose the storage key from model id and card id.
   * @param {string} modelId
   * @param {string} cardId
   * @returns {string}
   */
  function _key(modelId, cardId) {
    return modelId + '/' + cardId;
  }

  /**
   * Store (or overwrite) an embedding vector.
   * @param {string} modelId
   * @param {string} cardId
   * @param {number[]} vector
   * @returns {Promise<void>}
   */
  function put(modelId, cardId, vector) {
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx  = db.transaction(STORE_NAME, 'readwrite');
        const str = tx.objectStore(STORE_NAME);
        const req = str.put({ modelId, cardId, vector, updatedAt: Date.now() }, _key(modelId, cardId));
        req.onsuccess = function () { resolve(); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Retrieve an embedding vector, or null if not found.
   * @param {string} modelId
   * @param {string} cardId
   * @returns {Promise<number[]|null>}
   */
  function getVector(modelId, cardId) {
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx  = db.transaction(STORE_NAME, 'readonly');
        const str = tx.objectStore(STORE_NAME);
        const req = str.get(_key(modelId, cardId));
        req.onsuccess = function (e) {
          resolve(e.target.result ? e.target.result.vector : null);
        };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Delete the embedding for a specific card.
   * @param {string} modelId
   * @param {string} cardId
   * @returns {Promise<void>}
   */
  function del(modelId, cardId) {
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx  = db.transaction(STORE_NAME, 'readwrite');
        const str = tx.objectStore(STORE_NAME);
        const req = str.delete(_key(modelId, cardId));
        req.onsuccess = function () { resolve(); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Clear all embeddings for a specific model (e.g. after a model upgrade).
   * Iterates all keys and removes those matching the modelId prefix.
   * @param {string} modelId
   * @returns {Promise<number>}  Number of deleted records.
   */
  function clearModel(modelId) {
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx  = db.transaction(STORE_NAME, 'readwrite');
        const str = tx.objectStore(STORE_NAME);
        const prefix = modelId + '/';
        let deleted = 0;
        const cursorReq = str.openCursor();
        cursorReq.onsuccess = function (e) {
          const cursor = e.target.result;
          if (!cursor) { resolve(deleted); return; }
          if (String(cursor.key).startsWith(prefix)) {
            cursor.delete();
            deleted++;
          }
          cursor.continue();
        };
        cursorReq.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Batch-store multiple embedding vectors in a single readwrite transaction (M7).
   * @param {string} modelId
   * @param {Array<{ cardId: string, vector: number[] }>} entries
   * @returns {Promise<number>}
   */
  function putMany(modelId, entries) {
    if (!Array.isArray(entries) || !entries.length) return Promise.resolve(0);
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const str = tx.objectStore(STORE_NAME);
        const now = Date.now();
        for (const item of entries) {
          if (!item || !item.cardId || !Array.isArray(item.vector)) continue;
          str.put({ modelId, cardId: item.cardId, vector: item.vector, updatedAt: now }, _key(modelId, item.cardId));
        }
        tx.oncomplete = function () { resolve(entries.length); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  /**
   * Batch-retrieve embedding vectors for multiple cardIds in a single readonly transaction (M7).
   * @param {string} modelId
   * @param {string[]} cardIds
   * @returns {Promise<Map<string, number[]>>}
   */
  function getMany(modelId, cardIds) {
    const out = new Map();
    if (!Array.isArray(cardIds) || !cardIds.length) return Promise.resolve(out);
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const str = tx.objectStore(STORE_NAME);
        for (const cardId of cardIds) {
          const req = str.get(_key(modelId, cardId));
          req.onsuccess = function (e) {
            if (e.target.result && Array.isArray(e.target.result.vector)) {
              out.set(cardId, e.target.result.vector);
            }
          };
        }
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  App.store.idb = { put, putMany, getVector, getMany, del, clearModel };
})();
