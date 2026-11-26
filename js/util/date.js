/**
 * Date utilities for After School.
 * ALL dayKey values must be in local time — never UTC / toISOString().
 * @namespace App.date
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /**
   * Zero-pad a number to 2 digits.
   * @param {number} n
   * @returns {string}
   */
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Return today's date key in "YYYY-MM-DD" format using LOCAL time.
   * @returns {string}  e.g. "2026-12-10"
   */
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /**
   * Add (or subtract) n calendar days to a dayKey and return the new dayKey.
   * @param {string} key   "YYYY-MM-DD"
   * @param {number} n     May be negative.
   * @returns {string}
   */
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d + n);   // local constructor
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /**
   * Difference in calendar days: a − b (positive when a is later than b).
   * @param {string} a  "YYYY-MM-DD"
   * @param {string} b  "YYYY-MM-DD"
   * @returns {number}
   */
  function diffDays(a, b) {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    const msA = new Date(ay, am - 1, ad).getTime();
    const msB = new Date(by, bm - 1, bd).getTime();
    return Math.round((msA - msB) / 86400000);
  }

  /**
   * Parse a "YYYY-MM-DD" key back into a local midnight Date.
   * @param {string} key
   * @returns {Date}
   */
  function fromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  App.date = { todayKey, addDays, diffDays, fromKey };
})();
