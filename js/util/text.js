/**
 * Text utilities: answer normalisation, word variants, taboo detection.
 * @namespace App.text
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /**
   * Normalise an answer string for comparison:
   * trim, collapse spaces, lowercase, straight ASCII quotes.
   * @param {string} str
   * @returns {string}
   */
  function normalise(str) {
    if (typeof str !== 'string') return '';
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');
  }

  /**
   * Generate common English spelling variants for taboo checks (Section 4.4.2).
   * Always includes regular forms (+s/+es, +ed, +ing, +er, +est) alongside
   * true single-vowel CVC doubled forms so words like eat/read/clean/book
   * always include eating/reading/cleaned/booked.
   * @param {string} word
   * @returns {string[]}
   */
  function variants(word) {
    if (!word || typeof word !== 'string') return [];
    const w = word.trim().toLowerCase();
    if (!w) return [];
    const result = new Set([w]);

    const endsWithE = w.endsWith('e') && w.length > 2;
    const endsWithConsonantY = /[^aeiou]y$/.test(w);
    // True CVC (consonant + single vowel + single doubleable consonant, not w/x/y)
    const isCvc = /(?:^|[^aeiou])[aeiou][bcdfghjklmnpqrstvz]$/.test(w) && w.length >= 3;
    const last = w[w.length - 1];

    // +s / +es / +ies
    if (endsWithConsonantY) {
      result.add(w.slice(0, -1) + 'ies');
    } else if (/(?:s|sh|ch|x|z)$/.test(w)) {
      result.add(w + 'es');
    } else {
      result.add(w + 's');
    }

    // +ed
    if (endsWithE) {
      result.add(w + 'd');
    } else if (endsWithConsonantY) {
      result.add(w.slice(0, -1) + 'ied');
    } else {
      result.add(w + 'ed');
      if (isCvc) result.add(w + last + 'ed');
    }

    // +ing
    if (endsWithE && !w.endsWith('ee')) {
      result.add(w.slice(0, -1) + 'ing');
    } else {
      result.add(w + 'ing');
      if (isCvc) result.add(w + last + 'ing');
    }

    // +er
    if (endsWithE) {
      result.add(w + 'r');
    } else if (endsWithConsonantY) {
      result.add(w.slice(0, -1) + 'ier');
    } else {
      result.add(w + 'er');
      if (isCvc) result.add(w + last + 'er');
    }

    // +est
    if (endsWithE) {
      result.add(w + 'st');
    } else if (endsWithConsonantY) {
      result.add(w.slice(0, -1) + 'iest');
    } else {
      result.add(w + 'est');
      if (isCvc) result.add(w + last + 'est');
    }

    return Array.from(result);
  }

  /**
   * Check whether any taboo word appears as a whole word in a description.
   * @param {string} desc
   * @param {string[]} taboos
   * @returns {{ found: boolean, matched: string[] }}
   */
  function tabooDetect(desc, taboos) {
    const norm = normalise(desc);
    const matched = [];
    if (!norm || !Array.isArray(taboos)) return { found: false, matched };
    for (const taboo of taboos) {
      const t = normalise(taboo);
      if (!t) continue;
      const pattern = new RegExp('(?<![\\w\'])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w\'])', 'i');
      if (pattern.test(norm)) matched.push(taboo);
    }
    return { found: matched.length > 0, matched };
  }

  App.text = { normalise, variants, tabooDetect };
})();
