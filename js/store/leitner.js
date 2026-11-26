/**
 * Leitner 5-box spaced repetition schedule & progress store.
 * Persisted in App.store.db under "as.v1.progress".
 * Box intervals: 1 -> 1d, 2 -> 2d, 3 -> 4d, 4 -> 7d, 5 -> 14d (Section 3.2).
 * @namespace App.store.leitner
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const KEY = 'as.v1.progress';
  const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

  let _cache = null;

  function _load() {
    if (_cache) return _cache;
    const raw = App.store.db.get(KEY, {});
    _cache = raw && typeof raw === 'object' ? raw : {};
    return _cache;
  }

  function _save(map) {
    _cache = map;
    App.store.db.set(KEY, map);
  }

  function _emit(cardId, progress) {
    if (App.bus) App.bus.emit('progress:changed', { cardId, progress });
  }

  /**
   * Return progress record for a card, or null if never seen.
   * @param {string} cardId
   * @returns {Object|null}
   */
  function get(cardId) {
    const map = _load();
    return map[cardId] ? Object.assign({}, map[cardId]) : null;
  }

  /**
   * Return shallow copy of all progress records keyed by cardId.
   * @returns {Record<string, Object>}
   */
  function getAll() {
    return Object.assign({}, _load());
  }

  /**
   * Return the interval in days for a given box (1..5).
   * @param {number} box
   * @returns {number}
   */
  function intervalForBox(box) {
    const b = Math.max(1, Math.min(5, Number(box) || 1));
    return BOX_INTERVALS[b];
  }

  /**
   * Whether a card is due for review on `dayKey` (defaults to today).
   * Never-seen cards are NOT counted as due review cards (they are new cards).
   * @param {string} cardId
   * @param {string} [today]
   * @returns {boolean}
   */
  function isDue(cardId, today) {
    const rec = _load()[cardId];
    if (!rec) return false;
    const ref = today || App.date.todayKey();
    return rec.due <= ref;
  }

  /**
   * Rate a card during flashcard review.
   * - 'unknown' (還不熟): box -> 1, due tomorrow (+1d)
   * - 'fuzzy'   (有點印象): same box, due tomorrow (+1d)
   * - 'know'    (記住了): box + 1 (max 5), due today + box interval
   * @param {string} cardId
   * @param {'unknown'|'fuzzy'|'know'} rating
   * @param {string} [todayOverride]
   * @returns {Object} updated progress record
   */
  function rateCard(cardId, rating, todayOverride) {
    const map = _load();
    const today = todayOverride || App.date.todayKey();
    const prev = map[cardId] || {
      cardId,
      box: 1,
      due: today,
      seen: 0,
      correct: 0,
      wrong: 0,
      lastSeen: 0,
      lastWrongIn: null,
    };

    let nextBox = prev.box;
    let nextDue = today;
    let correctDelta = 0;
    let wrongDelta = 0;
    let lastWrongIn = prev.lastWrongIn;

    if (rating === 'know') {
      nextBox = Math.min(5, prev.box + 1);
      nextDue = App.date.addDays(today, intervalForBox(nextBox));
      correctDelta = 1;
    } else if (rating === 'fuzzy') {
      nextBox = prev.box;
      nextDue = App.date.addDays(today, 1);
      correctDelta = 1;
    } else {
      nextBox = 1;
      nextDue = App.date.addDays(today, intervalForBox(1));
      wrongDelta = 1;
      lastWrongIn = 'card';
    }

    const updated = {
      cardId,
      box: nextBox,
      due: nextDue,
      seen: prev.seen + 1,
      correct: prev.correct + correctDelta,
      wrong: prev.wrong + wrongDelta,
      lastSeen: Date.now(),
      lastWrongIn,
    };

    map[cardId] = updated;
    _save(map);
    _emit(cardId, Object.assign({}, updated));
    return Object.assign({}, updated);
  }

  /**
   * Record a game answer on the card's Leitner progress.
   * - Correct in game: counts towards seen/correct; does NOT promote the box.
   * - Wrong in game: sends card to box 1, due TODAY (Section 3.2).
   * @param {string} cardId
   * @param {'class13'|'guess'|'wall'} source
   * @param {boolean} correct
   * @param {string} [todayOverride]
   * @returns {Object}
   */
  function recordGameResult(cardId, source, correct, todayOverride) {
    const map = _load();
    const today = todayOverride || App.date.todayKey();
    const prev = map[cardId] || {
      cardId,
      box: 1,
      due: today,
      seen: 0,
      correct: 0,
      wrong: 0,
      lastSeen: 0,
      lastWrongIn: null,
    };

    const updated = {
      cardId,
      box: correct ? prev.box : 1,
      due: correct ? prev.due : today,
      seen: prev.seen + 1,
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
      lastSeen: Date.now(),
      lastWrongIn: correct ? prev.lastWrongIn : source,
    };

    map[cardId] = updated;
    _save(map);
    _emit(cardId, Object.assign({}, updated));
    return Object.assign({}, updated);
  }

  /**
   * Compute box distribution counts { 0: unseen, 1..5: count } for a card list.
   * @param {string[]} cardIds
   * @returns {Record<number, number>}
   */
  function getBoxCounts(cardIds) {
    const map = _load();
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const id of cardIds) {
      const rec = map[id];
      if (!rec) counts[0]++;
      else counts[rec.box] = (counts[rec.box] || 0) + 1;
    }
    return counts;
  }

  /**
   * Remove progress for a deleted user card.
   * @param {string} cardId
   */
  function remove(cardId) {
    const map = _load();
    if (map[cardId]) {
      delete map[cardId];
      _save(map);
    }
  }

  /**
   * Invalidate cached map (call after import/reset/test changes).
   */
  function invalidate() {
    _cache = null;
  }

  App.store.leitner = {
    BOX_INTERVALS,
    intervalForBox,
    get,
    getAll,
    isDue,
    rateCard,
    recordGameResult,
    getBoxCounts,
    remove,
    invalidate,
  };
})();
