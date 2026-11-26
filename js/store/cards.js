/**
 * Vocabulary cards store — the ONLY module permitted to read window.ENGLISH_2000_DATA.
 * Merges duplicate builtin headwords into 1,924 unique cards, stores builtin
 * edits/hidden flags in "as.v1.cards.overrides", and stores user cards in
 * "as.v1.cards.user".
 * @namespace App.store.cards
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const USER_KEY = 'as.v1.cards.user';
  const OVERRIDES_KEY = 'as.v1.cards.overrides';

  const CANONICAL_POS = ['adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'det.', 'aux.', 'int.', 'v.', 'n.'];

  let _builtinCards = null;
  let _builtinIndex = null;
  let _userCards = null;
  let _overrides = null;

  /**
   * Normalize raw partOfSpeech string to canonical tag or null (DECISIONS.md #4).
   * @param {string} raw
   * @returns {string|null}
   */
  function normalisePos(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Reject noisy OCR strings containing digits or parenthetical fragments
    if (/\d|\(/.test(trimmed) || trimmed.length > 24) return null;

    // Split on full-width semicolon or whitespace and inspect the leading POS token
    const token = trimmed.split(/[；;\s]+/)[0].toLowerCase();
    if (!token) return null;
    if (token === 'a.' || token.startsWith('adj.')) return 'adj.';
    if (token.startsWith('adv.')) return 'adv.';
    if (token.startsWith('prep.')) return 'prep.';
    if (token.startsWith('conj.')) return 'conj.';
    if (token.startsWith('pron.')) return 'pron.';
    if (token.startsWith('det.')) return 'det.';
    if (token.startsWith('aux.')) return 'aux.';
    if (token.startsWith('int.')) return 'int.';
    if (token.startsWith('v.')) return 'v.';
    if (token.startsWith('n.')) return 'n.';
    return null;
  }

  /**
   * Build merged builtin card records from window.ENGLISH_2000_DATA once.
   * @returns {Array<Object>}
   */
  function _ensureBuiltin() {
    if (_builtinCards) return _builtinCards;

    const raw = window.ENGLISH_2000_DATA;
    const rows = raw && Array.isArray(raw.words) ? raw.words : [];
    const byKey = new Map();
    const list = [];

    for (const row of rows) {
      const cleanWord = String(row.word || '').trim();
      const key = cleanWord.toLowerCase();
      if (!key) continue;

      const suspect = Array.isArray(row.qaFlags) && row.qaFlags.includes('suspect_ocr_word');
      const pos = normalisePos(row.partOfSpeech);
      const zh = String(row.translation || '').trim();

      if (byKey.has(key)) {
        const existing = byKey.get(key);
        existing.sourceIds.push(row.id);
        if (zh && !existing._zhSet.has(zh)) {
          existing._zhSet.add(zh);
          existing.zh = Array.from(existing._zhSet).join('；');
        }
        if (!existing.pos && pos) existing.pos = pos;
        if (!existing.example && row.example) existing.example = String(row.example).trim() || null;
        if (!existing.exampleZh && row.exampleZh) existing.exampleZh = String(row.exampleZh).trim() || null;
        if (row.chapterTitle && !existing.tags.includes(row.chapterTitle)) {
          existing.tags.push(row.chapterTitle);
        }
        continue;
      }

      const card = {
        id: 'b-' + row.id,
        sourceIds: [row.id],
        word: cleanWord,
        ipa: null,
        pos,
        zh,
        example: row.example ? String(row.example).trim() || null : null,
        exampleZh: row.exampleZh ? String(row.exampleZh).trim() || null : null,
        tags: row.chapterTitle ? [row.chapterTitle] : [],
        chapterNo: row.chapterNo || null,
        unitNo: row.unitNo || null,
        source: 'builtin',
        hidden: suspect,
        excludeFromGames: suspect,
        aiTip: null,
        myExample: null,
        createdAt: 0,
        _zhSet: new Set(zh ? [zh] : []),
      };

      byKey.set(key, card);
      list.push(card);
    }

    // Strip internal helper Set
    _builtinCards = list.map((c) => {
      delete c._zhSet;
      return c;
    });
    _builtinIndex = new Map(_builtinCards.map((c) => [c.id, c]));
    return _builtinCards;
  }

  function _loadUser() {
    if (_userCards) return _userCards;
    const raw = App.store.db.get(USER_KEY, []);
    _userCards = Array.isArray(raw) ? raw : [];
    return _userCards;
  }

  function _saveUser(list) {
    _userCards = list;
    App.store.db.set(USER_KEY, list);
  }

  function _loadOverrides() {
    if (_overrides) return _overrides;
    const raw = App.store.db.get(OVERRIDES_KEY, {});
    _overrides = raw && typeof raw === 'object' ? raw : {};
    return _overrides;
  }

  function _saveOverrides(map) {
    _overrides = map;
    App.store.db.set(OVERRIDES_KEY, map);
  }

  function _applyOverride(baseCard) {
    const ov = _loadOverrides()[baseCard.id];
    if (!ov) return Object.assign({}, baseCard, { tags: baseCard.tags.slice() });
    return Object.assign({}, baseCard, ov, {
      id: baseCard.id,
      source: baseCard.source,
      sourceIds: baseCard.sourceIds,
      excludeFromGames: baseCard.excludeFromGames,
      tags: Array.isArray(ov.tags) ? ov.tags.slice() : baseCard.tags.slice(),
    });
  }

  /**
   * Return all cards (builtin with overrides applied + user cards).
   * By default excludes hidden cards unless `includeHidden: true`.
   * @param {{ includeHidden?: boolean }} [opts]
   * @returns {Array<Object>}
   */
  function getAll(opts) {
    const includeHidden = Boolean(opts && opts.includeHidden);
    const builtins = _ensureBuiltin().map(_applyOverride);
    const users = _loadUser().map((c) => Object.assign({}, c, { tags: (c.tags || []).slice() }));
    const merged = users.concat(builtins);
    return includeHidden ? merged : merged.filter((c) => !c.hidden);
  }

  /**
   * Find a single card by ID (including hidden cards).
   * @param {string} id
   * @returns {Object|null}
   */
  function getById(id) {
    if (!id) return null;
    const user = _loadUser().find((c) => c.id === id);
    if (user) return Object.assign({}, user, { tags: (user.tags || []).slice() });
    _ensureBuiltin();
    const base = _builtinIndex.get(id);
    return base ? _applyOverride(base) : null;
  }

  /**
   * Case-insensitive trimmed word duplicate check.
   * @param {string} word
   * @param {string} [excludeCardId]
   * @returns {Object|null}
   */
  function findByWord(word, excludeCardId) {
    const norm = String(word || '').trim().toLowerCase();
    if (!norm) return null;
    const all = getAll({ includeHidden: true });
    return all.find((c) => c.id !== excludeCardId && c.word.trim().toLowerCase() === norm) || null;
  }

  /**
   * Validate card form payload (Section 3.4).
   * @param {{ word: string, zh: string }} input
   * @param {string} [editingId]
   * @returns {{ valid: boolean, errors: Record<string, string>, duplicate: Object|null }}
   */
  function validate(input, editingId) {
    const errors = {};
    const word = String(input.word || '').trim();
    const zh = String(input.zh || '').trim();

    if (!word) {
      errors.word = 'required';
    } else if (word.length > 40) {
      errors.word = 'too_long';
    } else if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(word)) {
      errors.word = 'invalid_chars';
    }

    if (!zh) {
      errors.zh = 'required';
    }

    const duplicate = !errors.word ? findByWord(word, editingId) : null;
    return {
      valid: Object.keys(errors).length === 0 && !duplicate,
      errors,
      duplicate,
    };
  }

  /**
   * Create a new user card.
   * @param {Object} data
   * @returns {Object}
   */
  function add(data) {
    const list = _loadUser().slice();
    const id = 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const card = {
      id,
      word: String(data.word || '').trim(),
      ipa: data.ipa ? String(data.ipa).trim() || null : null,
      pos: data.pos ? String(data.pos).trim() || null : null,
      zh: String(data.zh || '').trim(),
      example: data.example ? String(data.example).trim() || null : null,
      exampleZh: data.exampleZh ? String(data.exampleZh).trim() || null : null,
      tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : [],
      source: 'user',
      hidden: false,
      excludeFromGames: false,
      aiTip: null,
      myExample: null,
      createdAt: Date.now(),
    };
    list.unshift(card);
    _saveUser(list);
    if (App.bus) App.bus.emit('card:updated', { cardId: card.id, action: 'add' });
    return Object.assign({}, card);
  }

  /**
   * Update a user card OR store an override for a builtin card.
   * @param {string} id
   * @param {Object} patch
   * @returns {Object|null}
   */
  function update(id, patch) {
    const users = _loadUser().slice();
    const uIdx = users.findIndex((c) => c.id === id);
    if (uIdx >= 0) {
      const updated = Object.assign({}, users[uIdx], patch, { id, source: 'user' });
      users[uIdx] = updated;
      _saveUser(users);
      if (App.bus) App.bus.emit('card:updated', { cardId: id, action: 'update' });
      return Object.assign({}, updated);
    }

    _ensureBuiltin();
    const base = _builtinIndex.get(id);
    if (!base) return null;

    const overrides = Object.assign({}, _loadOverrides());
    overrides[id] = Object.assign({}, overrides[id] || {}, patch, { updatedAt: Date.now() });
    _saveOverrides(overrides);
    if (App.bus) App.bus.emit('card:updated', { cardId: id, action: 'update' });
    return _applyOverride(base);
  }

  /**
   * Hide or unhide a card (works for both builtin and user cards).
   * @param {string} id
   * @param {boolean} hidden
   * @returns {Object|null}
   */
  function setHidden(id, hidden) {
    return update(id, { hidden: Boolean(hidden) });
  }

  /**
   * Delete a user card immediately and return its snapshot (plus decks/progress)
   * so the caller can support a 5-second Undo toast. Builtin cards cannot be deleted.
   * @param {string} id
   * @returns {{ card: Object, progress: Object|null, deckIds: string[] }|null}
   */
  function removeUserCard(id) {
    const users = _loadUser().slice();
    const idx = users.findIndex((c) => c.id === id);
    if (idx < 0) return null;

    const [removed] = users.splice(idx, 1);
    _saveUser(users);

    const progress = App.store.leitner ? App.store.leitner.get(id) : null;
    if (App.store.leitner) App.store.leitner.remove(id);

    const deckIds = App.store.decks ? App.store.decks.removeCardFromAll(id) : [];

    if (App.bus) App.bus.emit('card:updated', { cardId: id, action: 'delete' });
    return { card: removed, progress, deckIds };
  }

  /**
   * Restore a soft-deleted user card snapshot from Undo toast.
   * @param {{ card: Object, progress: Object|null, deckIds: string[] }} snapshot
   */
  function restoreUserCard(snapshot) {
    if (!snapshot || !snapshot.card) return;
    const users = _loadUser().slice();
    if (!users.some((c) => c.id === snapshot.card.id)) {
      users.unshift(snapshot.card);
      _saveUser(users);
    }
    if (snapshot.deckIds && snapshot.deckIds.length && App.store.decks) {
      App.store.decks.setCardDecks(snapshot.card.id, snapshot.deckIds);
    }
    if (snapshot.progress && App.store.leitner) {
      const map = App.store.db.get('as.v1.progress', {});
      map[snapshot.card.id] = snapshot.progress;
      App.store.db.set('as.v1.progress', map);
      App.store.leitner.invalidate();
    }
    if (App.bus) App.bus.emit('card:updated', { cardId: snapshot.card.id, action: 'restore' });
  }

  /**
   * Collect distinct tags from active cards for filtering.
   * @returns {string[]}
   */
  function listTags() {
    const tags = new Set();
    for (const c of getAll({ includeHidden: false })) {
      for (const t of c.tags || []) tags.add(t);
    }
    return Array.from(tags);
  }

  /**
   * Filter, search, and sort cards for the Browse view (Section 3.3 A).
   * @param {{ search?: string, deckId?: string, box?: number|string|null, tag?: string, onlyMine?: boolean, visibility?: 'active'|'hidden'|'all', sort?: 'az'|'newest'|'mistakes' }} [opts]
   * @returns {Array<Object>}
   */
  function query(opts) {
    const o = opts || {};
    const vis = o.visibility || 'active';
    let list = getAll({ includeHidden: vis !== 'active' });

    if (vis === 'hidden') list = list.filter((c) => c.hidden);
    else if (vis === 'active') list = list.filter((c) => !c.hidden);

    if (o.onlyMine) list = list.filter((c) => c.source === 'user');

    if (o.deckId && App.store.decks) {
      const deckSet = new Set(App.store.decks.getCardIds(o.deckId));
      list = list.filter((c) => deckSet.has(c.id));
    }

    if (o.tag) {
      list = list.filter((c) => Array.isArray(c.tags) && c.tags.includes(o.tag));
    }

    const progressMap = App.store.leitner ? App.store.leitner.getAll() : {};
    if (o.box !== undefined && o.box !== null && o.box !== '' && o.box !== 'all') {
      const targetBox = Number(o.box);
      list = list.filter((c) => {
        const p = progressMap[c.id];
        return targetBox === 0 ? !p : (p && p.box === targetBox);
      });
    }

    if (o.search && o.search.trim()) {
      const q = o.search.trim().toLowerCase();
      list = list.filter((c) =>
        c.word.toLowerCase().includes(q) || (c.zh && c.zh.toLowerCase().includes(q))
      );
    }

    const sortMode = o.sort || 'az';
    if (sortMode === 'az') {
      list.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortMode === 'newest') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.id.localeCompare(b.id));
    } else if (sortMode === 'mistakes') {
      list.sort((a, b) => {
        const wa = (progressMap[a.id] && progressMap[a.id].wrong) || 0;
        const wb = (progressMap[b.id] && progressMap[b.id].wrong) || 0;
        return wb - wa || a.word.localeCompare(b.word);
      });
    }

    return list;
  }

  /**
   * Choose N distractors for a target card (DECISIONS.md #8):
   * same canonical pos -> same unitNo -> same chapterNo -> rest of active pool.
   * Excludes hidden cards, `excludeFromGames`, and duplicate words/meanings.
   * @param {Object} target
   * @param {number} [count=3]
   * @returns {Array<Object>}
   */
  function getDistractors(target, count) {
    const n = count === undefined ? 3 : count;
    const pool = getAll({ includeHidden: false }).filter(
      (c) => !c.excludeFromGames && c.id !== target.id && c.word.toLowerCase() !== target.word.toLowerCase() && c.zh !== target.zh
    );

    const chosen = [];
    const seenWords = new Set([target.word.toLowerCase()]);
    const seenZh = new Set([target.zh]);

    function takeFrom(candidates) {
      for (const c of candidates) {
        if (chosen.length >= n) return;
        const wl = c.word.toLowerCase();
        if (seenWords.has(wl) || seenZh.has(c.zh)) continue;
        seenWords.add(wl);
        seenZh.add(c.zh);
        chosen.push(c);
      }
    }

    if (target.pos) takeFrom(pool.filter((c) => c.pos === target.pos));
    if (chosen.length < n && target.unitNo) takeFrom(pool.filter((c) => c.unitNo === target.unitNo));
    if (chosen.length < n && target.chapterNo) takeFrom(pool.filter((c) => c.chapterNo === target.chapterNo));
    if (chosen.length < n) takeFrom(pool);
    return chosen;
  }

  /** Reset in-memory caches (for tests/imports). */
  function invalidate() {
    _userCards = null;
    _overrides = null;
  }

  App.store.cards = {
    CANONICAL_POS,
    normalisePos,
    getAll,
    getById,
    findByWord,
    validate,
    add,
    update,
    setHidden,
    removeUserCard,
    restoreUserCard,
    listTags,
    query,
    getDistractors,
    invalidate,
  };
})();
