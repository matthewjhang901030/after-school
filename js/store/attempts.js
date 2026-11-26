/**
 * Unified learning attempt log, daily compaction, and completed sessions store.
 * Persisted via App.store.db under:
 *   - "as.v1.attempts" (latest 5,000 detailed attempts)
 *   - "as.v1.daily"    (compacted daily summaries for attempts beyond 5,000)
 *   - "as.v1.sessions" (completed review/game sessions only; abandoned runs are never saved)
 * @namespace App.store.attempts
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const ATTEMPTS_KEY = 'as.v1.attempts';
  const DAILY_KEY = 'as.v1.daily';
  const SESSIONS_KEY = 'as.v1.sessions';
  const MAX_ATTEMPTS = 5000;

  let _attempts = null;
  let _daily = null;
  let _sessions = null;

  function _loadAttempts() {
    if (_attempts) return _attempts;
    const raw = App.store.db.get(ATTEMPTS_KEY, []);
    _attempts = Array.isArray(raw) ? raw : [];
    return _attempts;
  }

  function _loadDaily() {
    if (_daily) return _daily;
    const raw = App.store.db.get(DAILY_KEY, []);
    _daily = Array.isArray(raw) ? raw : [];
    return _daily;
  }

  function _loadSessions() {
    if (_sessions) return _sessions;
    const raw = App.store.db.get(SESSIONS_KEY, []);
    _sessions = Array.isArray(raw) ? raw : [];
    return _sessions;
  }

  function _saveAttempts(list) {
    _attempts = list;
    App.store.db.set(ATTEMPTS_KEY, list);
  }

  function _saveDaily(list) {
    _daily = list;
    App.store.db.set(DAILY_KEY, list);
  }

  function _saveSessions(list) {
    _sessions = list;
    App.store.db.set(SESSIONS_KEY, list);
  }

  /**
   * Merge an array of evicted attempts into compacted daily summary buckets.
   * Bucket key: (dayKey, source, skill).
   * @param {Array<Object>} evicted
   */
  function _mergeIntoDaily(evicted) {
    if (!evicted.length) return;
    const daily = _loadDaily().slice();
    const index = new Map();
    for (let i = 0; i < daily.length; i++) {
      const b = daily[i];
      index.set(`${b.dayKey}|${b.source}|${b.skill}`, i);
    }

    for (const att of evicted) {
      const key = `${att.dayKey}|${att.source}|${att.skill}`;
      if (index.has(key)) {
        const idx = index.get(key);
        const cur = daily[idx];
        daily[idx] = {
          dayKey: cur.dayKey,
          source: cur.source,
          skill: cur.skill,
          total: (cur.total || 0) + 1,
          correct: (cur.correct || 0) + (att.correct ? 1 : 0),
        };
      } else {
        index.set(key, daily.length);
        daily.push({
          dayKey: att.dayKey,
          source: att.source,
          skill: att.skill,
          total: 1,
          correct: att.correct ? 1 : 0,
        });
      }
    }

    daily.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    _saveDaily(daily);
  }

  /**
   * Compact oldest attempts into `as.v1.daily` when list exceeds `maxKeep`.
   * @param {number} [maxKeep=MAX_ATTEMPTS]
   * @returns {number} number of compacted attempts
   */
  function compact(maxKeep) {
    const limit = Number.isFinite(maxKeep) && maxKeep >= 0 ? Math.floor(maxKeep) : MAX_ATTEMPTS;
    const list = _loadAttempts();
    if (list.length <= limit) return 0;
    const overflow = list.length - limit;
    const evicted = list.slice(0, overflow);
    const kept = list.slice(overflow);
    _mergeIntoDaily(evicted);
    _saveAttempts(kept);
    return overflow;
  }

  /**
   * Record one unified attempt entry (Section 6.1).
   * Automatically compacts attempts older than the latest 5,000 into daily summaries.
   * @param {Object} entry
   * @returns {Object} saved attempt
   */
  function record(entry) {
    const e = entry || {};
    const ts = Number.isFinite(e.ts) ? e.ts : Date.now();
    const dayKey = e.dayKey || App.date.todayKey();
    const attempt = {
      id: e.id || ('att-' + ts + '-' + Math.random().toString(36).slice(2, 6)),
      ts,
      dayKey,
      source: e.source || 'card',
      sessionId: e.sessionId || null,
      cardId: e.cardId || null,
      itemId: e.itemId || null,
      skill: e.skill || 'vocab',
      correct: Boolean(e.correct),
      userAnswer: e.userAnswer !== undefined ? e.userAnswer : null,
      expected: e.expected !== undefined ? e.expected : null,
      errorType: e.errorType || null,
      wrongLetters: Array.isArray(e.wrongLetters) ? e.wrongLetters.slice() : [],
      ms: Number.isFinite(e.ms) ? Math.max(0, Math.round(e.ms)) : 0,
    };

    const list = _loadAttempts().slice();
    list.push(attempt);
    if (list.length > MAX_ATTEMPTS) {
      const overflow = list.length - MAX_ATTEMPTS;
      const evicted = list.splice(0, overflow);
      _mergeIntoDaily(evicted);
    }
    _saveAttempts(list);

    if (App.bus) App.bus.emit('attempt:recorded', { attempt: Object.assign({}, attempt) });
    return Object.assign({}, attempt);
  }

  /**
   * Record a completed review or game session (abandoned sessions must not call this).
   * @param {{ id?: string, source: string, startedAt: number, endedAt?: number, score?: number, accuracy?: number, details?: Object }} input
   * @returns {Object} saved session
   */
  function recordSession(input) {
    const s = input || {};
    const endedAt = Number.isFinite(s.endedAt) ? s.endedAt : Date.now();
    const startedAt = Number.isFinite(s.startedAt) ? s.startedAt : endedAt;
    const session = {
      id: s.id || ('ses-' + endedAt + '-' + Math.random().toString(36).slice(2, 6)),
      source: s.source || 'card',
      startedAt,
      endedAt,
      score: Number.isFinite(s.score) ? s.score : 0,
      accuracy: Number.isFinite(s.accuracy) ? Math.max(0, Math.min(1, s.accuracy)) : 0,
      details: s.details && typeof s.details === 'object' ? Object.assign({}, s.details) : {},
    };

    const list = _loadSessions().slice();
    list.push(session);
    _saveSessions(list);

    if (App.bus) App.bus.emit('session:completed', { session: Object.assign({}, session) });
    return Object.assign({}, session);
  }

  /**
   * Return all uncompacted attempts (oldest to newest).
   * @returns {Array<Object>}
   */
  function getAll() {
    return _loadAttempts().map((a) => Object.assign({}, a));
  }

  /**
   * Return all attempts for a specific card, newest first.
   * @param {string} cardId
   * @returns {Array<Object>}
   */
  function getByCard(cardId) {
    if (!cardId) return [];
    return _loadAttempts()
      .filter((a) => a.cardId === cardId)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((a) => Object.assign({}, a));
  }

  /**
   * Return attempts recorded on a specific local dayKey.
   * @param {string} dayKey
   * @returns {Array<Object>}
   */
  function getByDay(dayKey) {
    if (!dayKey) return [];
    return _loadAttempts()
      .filter((a) => a.dayKey === dayKey)
      .map((a) => Object.assign({}, a));
  }

  /**
   * Return compacted daily summaries from `as.v1.daily`.
   * @returns {Array<Object>}
   */
  function getDailySummaries() {
    return _loadDaily().map((d) => Object.assign({}, d));
  }

  /**
   * Return merged daily totals combining compacted `as.v1.daily` and live `as.v1.attempts`.
   * @returns {Array<{ dayKey: string, source: string, skill: string, total: number, correct: number }>}
   */
  function getCombinedDailyTotals() {
    const map = new Map();
    function addBucket(dayKey, source, skill, total, correct) {
      const key = `${dayKey}|${source}|${skill}`;
      const cur = map.get(key) || { dayKey, source, skill, total: 0, correct: 0 };
      cur.total += total;
      cur.correct += correct;
      map.set(key, cur);
    }

    for (const d of _loadDaily()) {
      addBucket(d.dayKey, d.source, d.skill, d.total || 0, d.correct || 0);
    }
    for (const a of _loadAttempts()) {
      addBucket(a.dayKey, a.source, a.skill, 1, a.correct ? 1 : 0);
    }
    return Array.from(map.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }

  /**
   * Return completed sessions (optionally filtered by source), newest first.
   * @param {string} [source]
   * @returns {Array<Object>}
   */
  function getSessions(source) {
    let list = _loadSessions();
    if (source) list = list.filter((s) => s.source === source);
    return list
      .slice()
      .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
      .map((s) => Object.assign({}, s));
  }

  /**
   * Return top N personal best sessions for a given source.
   * @param {string} source
   * @param {number} [limit=5]
   * @returns {Array<Object>}
   */
  function getPersonalBests(source, limit) {
    const n = Number.isFinite(limit) ? limit : 5;
    return _loadSessions()
      .filter((s) => !source || s.source === source)
      .slice()
      .sort((a, b) => (b.score - a.score) || (b.accuracy - a.accuracy) || (b.endedAt - a.endedAt))
      .slice(0, n)
      .map((s) => Object.assign({}, s));
  }

  /**
   * Return card IDs with mistakes in the past `days` calendar days, sorted by most mistakes.
   * Used for "我常錯的字" game source and weekly hardest words.
   * @param {number} [days=14]
   * @param {string} [todayOverride]
   * @returns {string[]}
   */
  function getWeakCardIds(days, todayOverride) {
    const windowDays = Number.isFinite(days) ? days : 14;
    const today = todayOverride || App.date.todayKey();
    const counts = new Map();
    for (const a of _loadAttempts()) {
      if (!a.cardId || a.correct) continue;
      const age = App.date.diffDays(today, a.dayKey);
      if (age >= 0 && age < windowDays) {
        counts.set(a.cardId, (counts.get(a.cardId) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((pair) => pair[0]);
  }

  /**
   * Return sorted unique local dayKeys with any study activity.
   * @returns {string[]}
   */
  function getActiveDays() {
    const set = new Set();
    for (const d of _loadDaily()) if (d.total > 0 && d.dayKey) set.add(d.dayKey);
    for (const a of _loadAttempts()) if (a.dayKey) set.add(a.dayKey);
    return Array.from(set).sort();
  }

  /**
   * Invalidate cached arrays (call after import/reset/test isolation).
   */
  function invalidate() {
    _attempts = null;
    _daily = null;
    _sessions = null;
  }

  App.store.attempts = {
    MAX_ATTEMPTS,
    record,
    recordSession,
    compact,
    getAll,
    getByCard,
    getByDay,
    getDailySummaries,
    getCombinedDailyTotals,
    getSessions,
    getPersonalBests,
    getWeakCardIds,
    getActiveDays,
    invalidate,
  };
})();
