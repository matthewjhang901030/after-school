/**
 * Shared game engine (Section 4.2).
 * Provides:
 * - Shared scoring (100 base + up to 50 linear speed bonus, 1.5x combo from 3rd consecutive correct)
 * - performance.now() + requestAnimationFrame clock with automatic visibilitychange pause
 * - 3-2-1 stationery countdown with cancellation handle
 * - Confusion pairs persistence ("as.v1.confusions") for 四格分類牆 -> 第 13 節課 & AI C
 * - Game HUD score helper & personal best helper
 * @namespace App.games.engine
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const CONFUSIONS_KEY = 'as.v1.confusions';
  const BASE_POINTS = 100;
  const MAX_SPEED_BONUS = 50;
  const COMBO_THRESHOLD = 3;
  const COMBO_MULTIPLIER = 1.5;

  /**
   * Compute shared score for a correct answer (Section 4.2).
   * @param {number} elapsedMs     Time taken on this round/group
   * @param {number} timeLimitMs   Round time limit (<= 0 for untimed games)
   * @param {number} combo         Consecutive correct count INCLUDING this answer (1, 2, 3...)
   * @returns {{ points: number, speedBonus: number, multiplier: number, isCombo: boolean }}
   */
  function scoreCorrect(elapsedMs, timeLimitMs, combo) {
    let speedBonus = 0;
    if (Number.isFinite(timeLimitMs) && timeLimitMs > 0) {
      const ratio = Math.max(0, Math.min(1, 1 - (Math.max(0, elapsedMs || 0) / timeLimitMs)));
      speedBonus = Math.round(MAX_SPEED_BONUS * ratio);
    }
    const isCombo = (Number(combo) || 0) >= COMBO_THRESHOLD;
    const multiplier = isCombo ? COMBO_MULTIPLIER : 1;
    const points = Math.round((BASE_POINTS + speedBonus) * multiplier);
    return { points, speedBonus, multiplier, isCombo };
  }

  /**
   * Create a rAF + performance.now() clock that auto-pauses when the browser tab hides.
   * Never uses setInterval (Section 4.2).
   * @param {{ onTick?: (dtMs: number, elapsedMs: number) => void, onPause?: () => void, onResume?: () => void }} [opts]
   * @returns {{ start: () => void, pause: () => void, resume: () => void, stop: () => void, isPaused: () => boolean, getElapsedMs: () => number }}
   */
  function createClock(opts) {
    const o = opts || {};
    let running = false;
    let paused = false;
    let rafId = null;
    let lastTs = 0;
    let elapsedMs = 0;

    const nowFn = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const reqFrame = (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(() => cb(nowFn()), 16));
    const cancelFrame = (id) => {
      if (id === null) return;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
      else clearTimeout(id);
    };

    function step(ts) {
      if (!running || paused) return;
      const dt = Math.min(250, Math.max(0, ts - lastTs));
      lastTs = ts;
      elapsedMs += dt;
      if (typeof o.onTick === 'function') o.onTick(dt, elapsedMs);
      if (running && !paused) rafId = reqFrame(step);
    }

    function onVisibility() {
      if (typeof document !== 'undefined' && document.hidden && running && !paused) {
        pause();
      }
    }

    function start() {
      if (running) return;
      running = true;
      paused = false;
      elapsedMs = 0;
      lastTs = nowFn();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibility);
      }
      rafId = reqFrame(step);
    }

    function pause() {
      if (!running || paused) return;
      paused = true;
      cancelFrame(rafId);
      rafId = null;
      if (typeof o.onPause === 'function') o.onPause();
    }

    function resume() {
      if (!running || !paused) return;
      paused = false;
      lastTs = nowFn();
      if (typeof o.onResume === 'function') o.onResume();
      rafId = reqFrame(step);
    }

    function stop() {
      running = false;
      paused = false;
      cancelFrame(rafId);
      rafId = null;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    }

    return {
      start,
      pause,
      resume,
      stop,
      isPaused: () => paused,
      getElapsedMs: () => Math.round(elapsedMs),
    };
  }

  /**
   * Run a brief 3-2-1 countdown inside `container`, respecting prefers-reduced-motion.
   * @param {HTMLElement} container
   * @param {{ onDone: () => void, skip?: boolean, stepMs?: number }} opts
   * @returns {{ cancel: () => void }}
   */
  function runCountdown(container, opts) {
    const o = opts || {};
    const reduced = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (o.skip || reduced || !container) {
      if (typeof o.onDone === 'function') o.onDone();
      return { cancel() {} };
    }

    const { el } = App.dom;
    const stepMs = Number.isFinite(o.stepMs) ? o.stepMs : 450;
    const steps = ['3', '2', '1'];
    let idx = 0;
    let timer = null;
    let cancelled = false;

    const numEl = el('div', { className: 'game-countdown-num', text: steps[0] });
    container.replaceChildren(
      el('div', { className: 'state-box game-countdown', role: 'status', 'aria-live': 'polite' }, [numEl])
    );

    function next() {
      if (cancelled) return;
      idx++;
      if (idx >= steps.length) {
        timer = null;
        if (typeof o.onDone === 'function') o.onDone();
        return;
      }
      numEl.textContent = steps[idx];
      timer = setTimeout(next, stepMs);
    }

    timer = setTimeout(next, stepMs);
    return {
      cancel() {
        cancelled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
    };
  }

  /**
   * Record a confusion pair (two items mistakenly grouped together across different true groups).
   * Persisted under "as.v1.confusions" for 第 13 節課, Statistics, and AI Feature C.
   * @param {string} wordA
   * @param {string} wordB
   * @param {{ source?: string, wallId?: string }} [meta]
   * @returns {Object|null}
   */
  function recordConfusionPair(wordA, wordB, meta) {
    const a = String(wordA || '').trim();
    const b = String(wordB || '').trim();
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) return null;

    const sorted = [a, b].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
    const key = `${sorted[0].toLowerCase()}|${sorted[1].toLowerCase()}`;
    const map = App.store && App.store.db ? App.store.db.get(CONFUSIONS_KEY, {}) : {};
    const prev = map[key] || {
      key,
      wordA: sorted[0],
      wordB: sorted[1],
      count: 0,
      source: (meta && meta.source) || 'wall',
      lastWallId: null,
      lastTs: 0,
    };

    const updated = {
      key,
      wordA: prev.wordA,
      wordB: prev.wordB,
      count: (prev.count || 0) + 1,
      source: (meta && meta.source) || prev.source || 'wall',
      lastWallId: (meta && meta.wallId) || prev.lastWallId,
      lastTs: Date.now(),
    };

    map[key] = updated;
    if (App.store && App.store.db) App.store.db.set(CONFUSIONS_KEY, map);
    return Object.assign({}, updated);
  }

  /**
   * Return stored confusion pairs sorted by frequency descending.
   * @param {number} [limit]
   * @returns {Array<Object>}
   */
  function getConfusionPairs(limit) {
    const map = App.store && App.store.db ? App.store.db.get(CONFUSIONS_KEY, {}) : {};
    const list = Object.values(map).sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
    return Number.isFinite(limit) ? list.slice(0, limit) : list;
  }

  /**
   * Update the shared game HUD score readout.
   * @param {string} text
   */
  function setHudScore(text) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('game-hud-score');
    if (el) el.textContent = String(text || '');
  }

  /**
   * Return highest personal best score for a game source, or null if none yet.
   * @param {string} source
   * @returns {number|null}
   */
  function getBestScore(source) {
    if (!App.store || !App.store.attempts) return null;
    const top = App.store.attempts.getPersonalBests(source, 1);
    return top.length ? top[0].score : null;
  }

  App.games.engine = {
    BASE_POINTS,
    MAX_SPEED_BONUS,
    COMBO_THRESHOLD,
    COMBO_MULTIPLIER,
    scoreCorrect,
    createClock,
    runCountdown,
    recordConfusionPair,
    getConfusionPairs,
    setHudScore,
    getBestScore,
  };
})();
