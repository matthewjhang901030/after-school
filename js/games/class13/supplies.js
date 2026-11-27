/**
 * 第 13 節課 — Pure game mechanics for Supply Crates, Key Rot (cap 3),
 * and 扭蛋機 Class-Rule Gacha (Section 4.3.3–4.3.5).
 * Strictly separated from DOM rendering so every mechanic is deterministic and unit-testable.
 * @namespace App.games.class13Supplies
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const MAX_ROTTEN_KEYS = 3;
  const KEY_ROT_MS = 3000;
  const DEFAULT_SUPPLY_CAP = 2;

  const SUPPLY_ITEMS = [
    { id: 'bell',       labelKey: 'class13.supply.bell',       descKey: 'class13.supply.bell_desc',       freezeMs: 5000 },
    { id: 'slow',       labelKey: 'class13.supply.slow',       descKey: 'class13.supply.slow_desc',       slowMs: 8000, slowFactor: 0.5 },
    { id: 'fluid',      labelKey: 'class13.supply.fluid',      descKey: 'class13.supply.fluid_desc',      pushM: 3.0 },
    { id: 'flashlight', labelKey: 'class13.supply.flashlight', descKey: 'class13.supply.flashlight_desc', revealChars: 2 },
  ];

  const SUPPLY_BY_ID = new Map(SUPPLY_ITEMS.map((item) => [item.id, item]));

  /**
   * Create a pure Key Rot manager (Section 4.3.3):
   * - Stains a mistyped letter key and locks it for 3,000 ms.
   * - Hard cap of 3 rotten keys at once: adding a 4th immediately heals the oldest key
   *   so the game can never become impossible.
   * - Fixed-timestep tick(dtMs) expires healed keys cleanly; healAll() resets between periods.
   */
  function createKeyRotState() {
    /** @type {Array<{ key: string, remainingMs: number }>} oldest first */
    let entries = [];

    function rot(rawKey, opts) {
      if (opts && opts.immune) return { rotted: false, healedKey: null, keys: getKeys() };
      const k = String(rawKey || '').trim().toLowerCase();
      if (!/^[a-z]$/.test(k)) return { rotted: false, healedKey: null, keys: getKeys() };

      // Refresh timer if already rotten
      const existing = entries.find((e) => e.key === k);
      if (existing) {
        existing.remainingMs = KEY_ROT_MS;
        return { rotted: true, healedKey: null, keys: getKeys() };
      }

      let healedKey = null;
      if (entries.length >= MAX_ROTTEN_KEYS) {
        const oldest = entries.shift();
        healedKey = oldest ? oldest.key : null;
      }
      entries.push({ key: k, remainingMs: KEY_ROT_MS });
      return { rotted: true, healedKey, keys: getKeys() };
    }

    function isLocked(rawKey) {
      const k = String(rawKey || '').trim().toLowerCase();
      return entries.some((e) => e.key === k && e.remainingMs > 0);
    }

    function tick(dtMs) {
      const dt = Math.max(0, Number(dtMs) || 0);
      if (!dt || !entries.length) return false;
      const before = entries.length;
      for (const e of entries) e.remainingMs -= dt;
      entries = entries.filter((e) => e.remainingMs > 0);
      return entries.length !== before;
    }

    function healAll() {
      const had = entries.length > 0;
      entries = [];
      return had;
    }

    function getKeys() {
      return entries.map((e) => e.key);
    }

    return { rot, isLocked, tick, healAll, getKeys };
  }

  /**
   * Create a pure Supply Inventory + Active Effect timer manager (Section 4.3.4).
   * Supports holding up to `cap` items (default 2; 3 with cr-extra-slot) and applying
   * bell (5s freeze), slow (8s -50% speed), fluid (+3m push), flashlight (reveal 2 letters).
   * @param {{ rng?: Function }} [opts]
   */
  function createSupplyState(opts) {
    const rng = (opts && typeof opts.rng === 'function') ? opts.rng : Math.random;
    let inventory = []; // string[] of supply IDs
    let cap = DEFAULT_SUPPLY_CAP;
    let freezeMs = 0;
    let slowMs = 0;

    function setCap(nextCap) {
      cap = Math.max(1, Math.min(4, Math.floor(Number(nextCap) || DEFAULT_SUPPLY_CAP)));
      if (inventory.length > cap) inventory = inventory.slice(0, cap);
    }

    function grantRandom(forcedId) {
      if (inventory.length >= cap) return null;
      let item = forcedId && SUPPLY_BY_ID.has(forcedId) ? SUPPLY_BY_ID.get(forcedId) : null;
      if (!item) {
        const idx = Math.floor(rng() * SUPPLY_ITEMS.length);
        item = SUPPLY_ITEMS[idx] || SUPPLY_ITEMS[0];
      }
      inventory.push(item.id);
      return Object.assign({}, item);
    }

    /**
     * Use supply item at 0-based slot index.
     * @param {number} slotIndex
     * @param {{ distanceM: number, maxDistance?: number, typed?: string, accepted?: string[] }} context
     * @returns {{ used: boolean, item?: Object, nextDistanceM?: number, revealLetters?: string, freezeMs?: number, slowMs?: number }}
     */
    function useSlot(slotIndex, context) {
      const idx = Math.floor(Number(slotIndex));
      if (!Number.isFinite(idx) || idx < 0 || idx >= inventory.length) {
        return { used: false };
      }
      const itemId = inventory.splice(idx, 1)[0];
      const item = SUPPLY_BY_ID.get(itemId);
      if (!item) return { used: false };

      const ctx = context || {};
      const maxD = Number.isFinite(ctx.maxDistance) ? ctx.maxDistance : 12.0;

      if (item.id === 'bell') {
        freezeMs = Math.max(freezeMs, item.freezeMs);
        return { used: true, item, freezeMs };
      }
      if (item.id === 'slow') {
        slowMs = Math.max(slowMs, item.slowMs);
        return { used: true, item, slowMs };
      }
      if (item.id === 'fluid') {
        const nextDist = Number(Math.min(maxD, (Number(ctx.distanceM) || 0) + item.pushM).toFixed(2));
        return { used: true, item, nextDistanceM: nextDist };
      }
      if (item.id === 'flashlight') {
        const cur = String(ctx.typed || '').toLowerCase();
        const acceptedList = Array.isArray(ctx.accepted) ? ctx.accepted : [];
        const match = acceptedList.find((a) => String(a).toLowerCase().startsWith(cur)) || acceptedList[0] || '';
        const remaining = String(match).slice(cur.length);
        const revealLetters = remaining.slice(0, item.revealChars);
        return { used: true, item, revealLetters };
      }
      return { used: true, item };
    }

    function tick(dtMs) {
      const dt = Math.max(0, Number(dtMs) || 0);
      if (!dt) return;
      if (freezeMs > 0) freezeMs = Math.max(0, freezeMs - dt);
      if (slowMs > 0) slowMs = Math.max(0, slowMs - dt);
    }

    function getSpeedMultiplier() {
      if (freezeMs > 0) return 0;
      if (slowMs > 0) return 0.5;
      return 1;
    }

    function getState() {
      return {
        inventory: inventory.map((id) => Object.assign({}, SUPPLY_BY_ID.get(id))),
        cap,
        freezeMs,
        slowMs,
        isFrozen: freezeMs > 0,
        isSlowed: slowMs > 0,
      };
    }

    function resetEffects() {
      freezeMs = 0;
      slowMs = 0;
    }

    return { setCap, grantRandom, useSlot, tick, getSpeedMultiplier, getState, resetEffects };
  }

  /**
   * Pick one random 扭蛋機 class rule from `App.data.classRules` between periods.
   * Avoids repeating recently pulled rules and skips TTS-only rules when unavailable or in safeMode.
   * @param {string[]} [usedIds]
   * @param {{ rng?: Function, ttsAvailable?: boolean, safeMode?: boolean, rules?: Array<Object> }} [opts]
   * @returns {Object|null}
   */
  function pickClassRule(usedIds, opts) {
    const o = opts || {};
    const rng = typeof o.rng === 'function' ? o.rng : Math.random;
    const all = Array.isArray(o.rules) ? o.rules : ((App.data && App.data.classRules) || []);
    if (!all.length) return null;

    const used = new Set(Array.isArray(usedIds) ? usedIds : []);
    const ttsOk = o.ttsAvailable !== false;
    const eligible = all.filter((r) => {
      if (r.requiresTts && !ttsOk) return false;
      if (o.safeMode && r.effects && r.effects.speedMult && r.effects.speedMult > 1.2) return false;
      return true;
    });
    const pool = eligible.length ? eligible : all;
    const fresh = pool.filter((r) => !used.has(r.id));
    const pickFrom = fresh.length ? fresh : pool;
    const idx = Math.floor(rng() * pickFrom.length);
    return Object.assign({}, pickFrom[idx] || pickFrom[0]);
  }

  App.games.class13Supplies = {
    MAX_ROTTEN_KEYS,
    KEY_ROT_MS,
    DEFAULT_SUPPLY_CAP,
    SUPPLY_ITEMS,
    createKeyRotState,
    createSupplyState,
    pickClassRule,
  };
})();
