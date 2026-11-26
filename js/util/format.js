/**
 * Number and date display formatting helpers.
 * @namespace App.format
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /**
   * Format an integer with thousands separators.
   * Uses Intl.NumberFormat when available, falls back to a simple regex.
   * @param {number} n
   * @returns {string}
   */
  function int(n) {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
      return new Intl.NumberFormat().format(Math.round(n));
    }
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format a number as a percentage string, e.g. 0.875 → "87.5%"
   * @param {number} ratio  0–1
   * @param {number} [decimals=0]
   * @returns {string}
   */
  function percent(ratio, decimals) {
    const d = decimals === undefined ? 0 : decimals;
    return (ratio * 100).toFixed(d) + '%';
  }

  /**
   * Format seconds as mm:ss.
   * @param {number} seconds
   * @returns {string}
   */
  function mmss(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Format milliseconds as "1.23s" or "456ms".
   * @param {number} ms
   * @returns {string}
   */
  function duration(ms) {
    return ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : Math.round(ms) + 'ms';
  }

  /**
   * Convert a dayKey "YYYY-MM-DD" to a human-readable string using the
   * current document language (zh-TW or en), falling back to ISO if Intl
   * is unavailable.
   * @param {string} key    "YYYY-MM-DD"
   * @param {'short'|'long'} [style='short']
   * @returns {string}
   */
  function dayLabel(key, style) {
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return key;
    const lang = document.documentElement.lang || 'zh-TW';
    const opts = style === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(lang, opts).format(date);
  }

  App.format = { int, percent, mmss, duration, dayLabel };
})();
