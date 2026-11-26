/**
 * localStorage wrapper with schema versioning and migrations.
 * ALL localStorage access in the application must go through this module.
 * Switches seamlessly to in-memory fallback on QuotaExceededError or SecurityError
 * (private mode / blocked storage) with a user-visible banner (Section 3.8 & 7.3).
 * @namespace App.store.db
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const CURRENT_VERSION = 1;

  /**
   * Ordered migration array. migrations[n] upgrades version n -> n+1.
   * @type {Array<(data: Object) => Object>}
   */
  const migrations = [
    function v0_to_v1(data) {
      return data;
    },
  ];

  let _fallback = null;
  let _bannerShown = false;

  function _t(key, fallback) {
    if (App.i18n) {
      const val = App.i18n.t(key);
      if (val !== key) return val;
    }
    return fallback;
  }

  function _activateFallback(reasonKey, fallbackText) {
    if (!_fallback) {
      _fallback = new Map();
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('as.')) {
            _fallback.set(k, localStorage.getItem(k));
          }
        }
      } catch (_e) { /* storage inaccessible (e.g. private mode) */ }
    }
    if (!_bannerShown) {
      _bannerShown = true;
      if (App.toast) {
        App.toast.show(_t(reasonKey, fallbackText), { duration: 0 });
      }
      console.warn('[db] Switched to in-memory storage fallback:', reasonKey);
    }
  }

  function _isQuotaError(err) {
    return Boolean(err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014));
  }

  function _rawGet(key) {
    if (_fallback) return _fallback.get(key);
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : raw;
    } catch (_err) {
      _activateFallback('error.storage_blocked', '無法存取本機儲存空間，本次資料僅暫存於記憶體中。');
      return _fallback.get(key);
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
      if (_isQuotaError(err)) {
        _activateFallback('error.quota', '儲存空間已滿，本次資料儲存在記憶體中（重新整理後將消失）。');
      } else {
        _activateFallback('error.storage_blocked', '無法存取本機儲存空間，本次資料僅暫存於記憶體中。');
      }
      _fallback.set(key, raw);
    }
  }

  function _rawRemove(key) {
    if (_fallback) {
      _fallback.delete(key);
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch (_err) {
      _activateFallback('error.storage_blocked', '無法存取本機儲存空間，本次資料僅暫存於記憶體中。');
      _fallback.delete(key);
    }
  }

  /**
   * Read and parse a JSON value from storage.
   * @param {string} key
   * @param {*} [def=null]
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
   * @param {*} value
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

  /**
   * Run all pending migrations on startup.
   * Keeps an in-memory backup; on failure restores old data and shows an error toast.
   * @param {Array<(data: Object) => Object>} [customMigrations]  Optional override for tests.
   * @param {number} [targetVersion]  Optional target version for tests.
   * @returns {boolean} true if migrated cleanly or already current; false on error rollback
   */
  function runMigrations(customMigrations, targetVersion) {
    const migs = Array.isArray(customMigrations) ? customMigrations : migrations;
    const goal = typeof targetVersion === 'number' ? targetVersion : CURRENT_VERSION;
    const meta = get('as.meta', { schemaVersion: 0, createdAt: null, lastOpened: null });
    let version = meta.schemaVersion || 0;
    let ok = true;

    if (version < goal) {
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
        } catch (_e) {
          _activateFallback('error.storage_blocked', '無法存取本機儲存空間，本次資料僅暫存於記憶體中。');
        }
      }

      const backup = JSON.parse(JSON.stringify(snapshot));

      try {
        while (version < goal) {
          if (typeof migs[version] !== 'function') {
            throw new Error('Missing migration step ' + version);
          }
          snapshot = migs[version](snapshot);
          version++;
        }
        for (const [k, v] of Object.entries(snapshot)) {
          set(k, v);
        }
      } catch (err) {
        ok = false;
        console.error('[db] Migration failed at version', version, err);
        for (const [k, v] of Object.entries(backup)) {
          set(k, v);
        }
        if (App.toast) {
          App.toast.show(_t('error.migration', '資料結構升級失敗，已保留舊資料。請重新整理。'), { duration: 0 });
        }
        return false;
      }
    }

    const now = new Date().toISOString();
    set('as.meta', {
      schemaVersion: goal,
      createdAt: meta.createdAt || now,
      lastOpened: now,
    });
    return ok;
  }

  function isUsingFallback() {
    return _fallback !== null;
  }

  function _resetFallback() {
    _fallback = null;
    _bannerShown = false;
  }

  App.store.db = { get, set, remove, has, runMigrations, isUsingFallback, _resetFallback, CURRENT_VERSION };
})();
