/**
 * User settings store — persists via App.store.db under "as.v1.settings".
 * All settings have typed defaults. Changes emit "settings:changed" on App.bus.
 * @namespace App.store.settings
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const KEY = 'as.v1.settings';

  /**
   * Default values for all settings.
   * @type {Object}
   */
  const DEFAULTS = {
    language: 'zh-TW',                 // 'zh-TW' | 'en'
    theme: 'auto',                     // 'auto' | 'light' | 'dark'
    dailyNewWords: 10,                 // number (5–30)
    periodsPerDay: 3,                  // 2 | 3 | 4
    autoPlayPronunciation: false,      // boolean
    speechRate: 1.0,                   // number (0.5–2.0)
    safeMode: false,                   // boolean — 安心模式
    aiEngine: 'auto',                  // 'auto' | 'nano' | 'qwen' | 'templates'
    qwenModel: '0.5b',                 // '0.5b' (~467 MB) | '1.5b' (~1172 MB)
    onboarded: false,                  // boolean — 3-step onboarding completed (M4)
    class13WarningDismissed: false,    // boolean — Class 13 content warning (M10)
  };

  /** Cached copy to avoid unnecessary JSON round-trips on every read. */
  let _cache = null;

  /**
   * Read the full settings object (merged with defaults so new keys always exist).
   * @returns {Object}
   */
  function getAll() {
    if (_cache) return _cache;
    const stored = App.store.db.get(KEY, {});
    _cache = Object.assign({}, DEFAULTS, stored);
    return _cache;
  }

  /**
   * Read a single setting value.
   * @param {string} key
   * @returns {*}
   */
  function get(key) {
    return getAll()[key];
  }

  /**
   * Write one or more settings values and persist immediately.
   * Emits 'settings:changed' on the bus with { changed: {key: newValue, ...} }.
   * @param {Object} patch  Partial settings object.
   */
  function update(patch) {
    const current = getAll();
    const changed = {};
    for (const [k, v] of Object.entries(patch)) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && current[k] !== v) {
        changed[k] = v;
        current[k] = v;
      }
    }
    if (Object.keys(changed).length === 0) return;
    _cache = current;
    App.store.db.set(KEY, current);
    if (App.bus) App.bus.emit('settings:changed', { changed });
  }

  /**
   * Reset all settings to defaults.
   */
  function reset() {
    _cache = Object.assign({}, DEFAULTS);
    App.store.db.set(KEY, _cache);
    if (App.bus) App.bus.emit('settings:changed', { changed: Object.assign({}, DEFAULTS) });
  }

  /**
   * Invalidate the cached copy (call after external data import).
   */
  function invalidate() {
    _cache = null;
  }

  App.store.settings = { get, getAll, update, reset, invalidate, DEFAULTS };
})();
