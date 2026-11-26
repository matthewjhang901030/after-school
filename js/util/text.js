/**
 * Text utilities: answer normalisation, word variants, taboo detection.
 * @namespace App.text
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /**
   * Normalise an answer string for comparison:
   *   - trim leading/trailing whitespace
   *   - collapse internal whitespace runs to a single space
   *   - convert to lowercase
   *   - replace curly/typographic quotes with straight ASCII equivalents
   * @param {string} str
   * @returns {string}
   */
  function normalise(str) {
    if (typeof str !== 'string') return '';
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[\u2018\u2019\u02BC]/g, "'")   // curly single quotes / apostrophe
      .replace(/[\u201C\u201D]/g, '"');          // curly double quotes
  }

  /**
   * Generate acceptable spelling variants for a word used in taboo checks.
   * Returns an array that includes the word itself plus:
   *   - +s  (simple plural / 3rd person)
   *   - +ed  (simple past)
   *   - +ing  (present participle, dropping trailing e when appropriate)
   *   - +er  (comparative / agent noun)
   *   - +est (superlative)
   * @param {string} word  The base word (lowercase).
   * @returns {string[]}
   */
  function variants(word) {
    if (!word) return [];
    const w = word.toLowerCase();
    const result = new Set([w]);

    // Helpers
    const endsWithE = w.endsWith('e') && w.length > 2;
    const endsWithConsonantY = /[^aeiou]y$/.test(w);
    const endsWithDoubleableConsonant = /[aeiou][bcdfghjklmnpqrstvwxz]$/.test(w) && w.length > 2;

    // +s / +es
    if (endsWithConsonantY) {
      result.add(w.slice(0, -1) + 'ies');  // study → studies
    } else if (/(?:s|sh|ch|x|z)$/.test(w)) {
      result.add(w + 'es');
    } else {
      result.add(w + 's');
    }

    // +ed
    if (endsWithE) {
      result.add(w + 'd');                      // e.g. like → liked
    } else if (endsWithConsonantY) {
      result.add(w.slice(0, -1) + 'ied');       // study → studied
    } else if (endsWithDoubleableConsonant) {
      result.add(w + w[w.length - 1] + 'ed');   // stop → stopped
    } else {
      result.add(w + 'ed');
    }

    // +ing
    if (endsWithE) {
      result.add(w.slice(0, -1) + 'ing');       // like → liking
    } else if (endsWithDoubleableConsonant) {
      result.add(w + w[w.length - 1] + 'ing');  // stop → stopping
    } else {
      result.add(w + 'ing');
    }

    // +er
    if (endsWithE) {
      result.add(w + 'r');                       // nice → nicer
    } else if (endsWithDoubleableConsonant) {
      result.add(w + w[w.length - 1] + 'er');   // big → bigger
    } else {
      result.add(w + 'er');
    }

    // +est
    if (endsWithE) {
      result.add(w + 'st');
    } else if (endsWithDoubleableConsonant) {
      result.add(w + w[w.length - 1] + 'est');
    } else {
      result.add(w + 'est');
    }

    return Array.from(result);
  }

  /**
   * Check whether any taboo word appears as a whole word in a description string.
   * Used in 你說我猜 to prevent the describer from saying the target word or its variants.
   *
   * @param {string} desc     The player's description sentence(s).
   * @param {string[]} taboos Array of words/variants to ban.
   * @returns {{ found: boolean, matched: string[] }}
   */
  function tabooDetect(desc, taboos) {
    const norm = normalise(desc);
    const matched = [];
    for (const taboo of taboos) {
      const t = normalise(taboo);
      // whole-word check using word-boundary-like logic (handle non-ASCII gracefully)
      const pattern = new RegExp('(?<![\\w\'])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w\'])', 'i');
      if (pattern.test(norm)) matched.push(taboo);
    }
    return { found: matched.length > 0, matched };
  }

  App.text = { normalise, variants, tabooDetect };
})();
