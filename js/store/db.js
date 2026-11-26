/**
 * localStorage wrapper with schema versioning and migrations.
 * ALL localStorage access in the application must go through this module.
 * @namespace App.store.db
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  // ─── Schema version ───────────────────────────────────────────────────────
  const CURRENT_VERSION = 1;

  /**
   * Ordered migration array.  migrations[n] is called to upgrade from version
   * n to version n+1.  Each function receives the full data snapshot
   * { [key]: parsedValue } and must return the transformed snapshot.
   * @type {Array<(data: Object) => Object>}
   */
  const migrations = [
    // 0 → 1: initial schema (nothing to transform, just stamp version)
    function v0_to_v1(data) {
      return data;
    },
  ];

  // ─── In-memory fallback ──────────────────────────────────────────────────
  let _fallback = null;   // null = use localStorage; Map = use in-memory
  let _quotaBannerShown = false;

  function _showQuotaBanner() {
    if (_quotaBannerShown) return;
    _quotaBannerShown = true;
    if (App.toast) {
      App.toast.show('儲存空間已滿，本次資料儲存在記憶體中（重新整理後將消失）。', { duration: 0 });
    }
    console.warn('[db] localStorage QuotaExceededError — switched to in-memory fallback');
  }

  // ─── Raw read / write ─────────────────────────────────────────────────────

  function _rawGet(key) {
    if (_fallback) return _fallback.get(key);
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : raw;
    } catch (_e) {
      return undefined;
    }
  }

  function _rawSet(key, raw) {
    if (_fallback) {
      _fallback.set(key, raw);
      return;
    }
    try {
      localStorage.setItem(key, raw);
    } catch (err) {
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        _fallback = new Map();
        // Seed the fallback with existing data so we don't lose everything
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            _fallback.set(k, localStorage.getItem(k));
          }
        } catch (_e) { /* best-effort */ }
        _fallback.set(key, raw);
        _showQuotaBanner();
      } else {
        console.error('[db] localStorage.setItem error:', err);
      }
    }
  }

  function _rawRemove(key) {
    if (_fallback) { _fallback.delete(key); return; }
    try { localStorage.removeItem(key); } catch (_e) { /* ignore */ }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Read and parse a JSON value from storage.
   * @param {string} key   Full storage key (e.g. "as.v1.settings")
   * @param {*} [def=null]  Default value if key absent or parse error.
   * @returns {*}
   */
  function get(key, def) {
    const raw = _rawGet(key);
    if (raw === undefined || raw === null) return def !== undefined ? def : null;
    try {
      return JSON.parse(raw);
    } catch (_e) {
      console.warn('[db] JSON parse error for key', key);
      return def !== undefined ? def : null;
    }
  }

  /**
   * Stringify and store a value.
   * @param {string} key
   * @param {*} value  Must be JSON-serialisable.
   */
  function set(key, value) {
    _rawSet(key, JSON.stringify(value));
  }

  /**
   * Remove a key from storage.
   * @param {string} key
   */
  function remove(key) {
    _rawRemove(key);
  }

  /**
   * Check whether a key exists.
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    return _rawGet(key) !== undefined;
  }

  // ─── Migrations ───────────────────────────────────────────────────────────

  /**
   * Run all pending migrations on startup.
   * On migration error, keeps existing data and shows a toast.
   */
  function runMigrations() {
    const meta = get('as.meta', { schemaVersion: 0, createdAt: null, lastOpened: null });
    let version = meta.schemaVersion || 0;

    if (version < CURRENT_VERSION) {
      // Snapshot all 'as.*' keys
      let snapshot = {};
      const prefix = 'as.';

      if (_fallback) {
        for (const [k, v] of _fallback) {
          if (k.startsWith(prefix)) {
            try { snapshot[k] = JSON.parse(v); } catch (_e) { snapshot[k] = v; }
          }
        }
      } else {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
              try { snapshot[k] = JSON.parse(localStorage.getItem(k)); } catch (_e) { snapshot[k] = localStorage.getItem(k); }
            }
          }
        } catch (_e) { /* ignore */ }
      }

      let backup = JSON.parse(JSON.stringify(snapshot));  // deep clone

      try {
        while (version < CURRENT_VERSION) {
          snapshot = migrations[version](snapshot);
          version++;
        }
        // Write migrated data back
        for (const [k, v] of Object.entries(snapshot)) {
          set(k, v);
        }
      } catch (err) {
        console.error('[db] Migration failed at version', version, err);
        // Restore from backup
        for (const [k, v] of Object.entries(backup)) {
          set(k, v);
        }
        if (App.toast) App.toast.show('資料結構升級失敗，已保留舊資料。請重新整理。', { duration: 0 });
      }
    }

    // Update meta
    const now = new Date().toISOString();
    set('as.meta', {
      schemaVersion: CURRENT_VERSION,
      createdAt: meta.createdAt || now,
      lastOpened: now,
    });
  }

  /**
   * Whether the store is using the in-memory fallback (quota exceeded).
   * @returns {boolean}
   */
  function isUsingFallback() {
    return _fallback !== null;
  }

  /**
   * Reset the in-memory fallback (for testing only).
   */
  function _resetFallback() {
    _fallback = null;
    _quotaBannerShown = false;
  }

  App.store.db = { get, set, remove, has, runMigrations, isUsingFallback, _resetFallback, CURRENT_VERSION };
})();
