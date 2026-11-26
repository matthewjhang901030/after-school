/**
 * Seeded pseudo-random number generator (mulberry32 variant).
 * Used to produce deterministic sequences from a seed string (e.g. a dayKey).
 * @namespace App.random
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /**
   * Hash a string to a 32-bit unsigned integer (djb2 variant).
   * @param {string} str
   * @returns {number}
   */
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * Create a seeded RNG function using the mulberry32 algorithm.
   * The returned function returns a float in [0, 1) each time it is called.
   *
   * @param {string|number} seed  String keys (e.g. "2026-12-10") or numbers.
   * @returns {() => number}
   */
  function create(seed) {
    let state = typeof seed === 'string' ? hashStr(seed) : (seed >>> 0) || 1;
    return function rng() {
      state += 0x6D2B79F5;
      let z = state;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Shuffle an array in place using Fisher-Yates with a seeded RNG.
   * @param {Array} arr
   * @param {() => number} rng  From create()
   * @returns {Array}  The same array, mutated.
   */
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Pick n items from an array without replacement using a seeded RNG.
   * @param {Array} arr
   * @param {number} n
   * @param {() => number} rng
   * @returns {Array}
   */
  function pick(arr, n, rng) {
    return shuffle(arr.slice(), rng).slice(0, n);
  }

  App.random = { create, shuffle, pick, hashStr };
})();
