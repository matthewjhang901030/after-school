/**
 * Vocabulary cards store — the ONLY module permitted to read window.ENGLISH_2000_DATA.
 * Applies non-destructive curation from App.data.cardFixes before merging duplicate
 * headwords, suppresses synthetic meta-template examples, strips trailing Chinese notes
 * from mixed source_771 examples, and persists edits/user cards via App.store.db.
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
    if (/\d|\(/.test(trimmed) || trimmed.length > 24) return null;

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
   * Clean an English example sentence non-destructively:
   * - Returns null for synthetic meta-template examples (generated_example) or OCR placeholders.
   * - Strips trailing Chinese study notes from mixed source_771 examples.
   * @param {string} raw
   * @param {string} exampleSource
   * @returns {string|null}
   */
  function cleanExample(raw, exampleSource) {
    if (!raw || exampleSource === 'generated_example') return null;
    let s = String(raw).trim();
    if (!s || /^Please check the original source/i.test(s)) return null;

    if (/[\u4e00-\u9fff]/.test(s)) {
      const firstCjk = s.search(/[\u4e00-\u9fff]/);
      const before = s.slice(0, firstCjk);
      const lastEnd = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'));
      if (lastEnd >= 0) {
        s = before.slice(0, lastEnd + 1);
      } else {
        const lastComma = before.lastIndexOf(',');
        s = lastComma >= 0 ? before.slice(0, lastComma) + '.' : before;
      }
    }

    s = s
      .replace(/\s+[oO]\s+(?=[A-Z])/g, ' ')
      .replace(/([?!])\s+\1/g, '$1')
      .replace(/\\+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return s || null;
  }

  /**
   * Clean Chinese translation of a real example (paired with cleanExample).
   * When trailing study notes were stripped from English, keep the matching
   * leading Chinese sentence count so translated notes don't dangle.
   * @param {string} rawZh
   * @param {string|null} cleanedEn
   * @param {boolean} hadMixedNotes
   * @returns {string|null}
   */
  function cleanExampleZh(rawZh, cleanedEn, hadMixedNotes) {
    if (!rawZh || !cleanedEn) return null;
    let s = String(rawZh).trim();
    if (!s) return null;
    if (hadMixedNotes) {
      const enSentences = (cleanedEn.match(/[.!?]+/g) || []).length || 1;
      const parts = s.match(/[^。！？!?]+[。！？!?]/g);
      if (parts && parts.length >= enSentences) {
        s = parts.slice(0, enSentences).join('');
      } else {
        const m = s.match(/^(.+?[。！？!?])\s*[A-Za-z]/);
        if (m) s = m[1];
      }
    }
    return s.trim() || null;
  }

  /**
   * Build merged builtin card records from window.ENGLISH_2000_DATA + App.data.cardFixes once.
   * @returns {Array<Object>}
   */
  function _ensureBuiltin() {
    if (_builtinCards) return _builtinCards;

    const raw = window.ENGLISH_2000_DATA;
    const rows = raw && Array.isArray(raw.words) ? raw.words : [];
    const fixes = (App.data && App.data.cardFixes) || { hideIds: {}, rowFixes: {} };
    const hideIds = fixes.hideIds || {};
    const rowFixes = fixes.rowFixes || {};

    const byKey = new Map();
    const list = [];

    for (const row of rows) {
      const fix = rowFixes[row.id] || null;
      const isHiddenRow = Boolean(hideIds[row.id]) || (Array.isArray(row.qaFlags) && row.qaFlags.includes('suspect_ocr_word'));
      const cleanWord = String((fix && fix.word) || row.word || '').trim();
      const key = isHiddenRow ? '__hidden__' + row.id : cleanWord.toLowerCase();
      if (!key) continue;

      const pos = (fix && fix.pos) || normalisePos(row.partOfSpeech);
      const zh = String((fix && fix.zh) || row.translation || '').trim();
      const hadMixed = /[\u4e00-\u9fff]/.test(String(row.example || ''));
      const example = cleanExample(row.example, row.exampleSource);
      const exampleZh = example ? cleanExampleZh(row.exampleZh, example, hadMixed) : null;
      const isRealExample = Boolean(example);

      if (byKey.has(key)) {
        const existing = byKey.get(key);
        existing.sourceIds.push(row.id);
        if (zh) {
          for (const part of zh.split('；').map((p) => p.trim()).filter(Boolean)) {
            if (!existing._zhSet.has(part)) {
              existing._zhSet.add(part);
              existing.zh = Array.from(existing._zhSet).join('；');
            }
          }
        }
        if (!existing.pos && pos) existing.pos = pos;
        if (!existing.example && isRealExample) {
          existing.example = example;
          existing.exampleZh = exampleZh;
          existing.exampleSource = row.exampleSource;
          existing.hasRealExample = true;
        }
        if (row.chapterTitle && !existing.tags.includes(row.chapterTitle)) {
          existing.tags.push(row.chapterTitle);
        }
        continue;
      }

      const zhParts = zh ? zh.split('；').map((p) => p.trim()).filter(Boolean) : [];
      const card = {
        id: 'b-' + row.id,
        sourceIds: [row.id],
        word: cleanWord,
        ipa: null,
        pos,
        zh: zhParts.join('；'),
        example,
        exampleZh,
        exampleSource: row.exampleSource || null,
        hasRealExample: isRealExample,
        tags: row.chapterTitle ? [row.chapterTitle] : [],
        chapterNo: row.chapterNo || null,
        unitNo: row.unitNo || null,
        source: 'builtin',
        hidden: isHiddenRow,
        excludeFromGames: isHiddenRow,
        aiTip: null,
        myExample: null,
        createdAt: 0,
        _zhSet: new Set(zhParts),
      };

      byKey.set(key, card);
      list.push(card);
    }

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
    const merged = Object.assign({}, baseCard, ov, {
      id: baseCard.id,
      source: baseCard.source,
      sourceIds: baseCard.sourceIds,
      excludeFromGames: baseCard.excludeFromGames,
      tags: Array.isArray(ov.tags) ? ov.tags.slice() : baseCard.tags.slice(),
    });
    if (Object.prototype.hasOwnProperty.call(ov, 'example')) {
      merged.hasRealExample = Boolean(ov.example);
    }
    return merged;
  }

  /**
   * Return all cards (builtin with overrides applied + user cards).
   * @param {{ includeHidden?: boolean }} [opts]
   * @returns {Array<Object>}
   */
  function getAll(opts) {
    const includeHidden = Boolean(opts && opts.includeHidden);
    const builtins = _ensureBuiltin().map(_applyOverride);
    const users = _loadUser().map((c) => Object.assign({}, c, {
      hasRealExample: Boolean(c.example),
      tags: (c.tags || []).slice(),
    }));
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
    if (user) return Object.assign({}, user, { hasRealExample: Boolean(user.example), tags: (user.tags || []).slice() });
    _ensureBuiltin();
    const base = _builtinIndex.get(id);
    return base ? _applyOverride(base) : null;
  }

  /**
   * Case-insensitive trimmed word duplicate check across non-hidden cards.
   * @param {string} word
   * @param {string} [excludeCardId]
   * @returns {Object|null}
   */
  function findByWord(word, excludeCardId) {
    const norm = String(word || '').trim().toLowerCase();
    if (!norm) return null;
    const all = getAll({ includeHidden: false });
    return all.find((c) => c.id !== excludeCardId && c.word.trim().toLowerCase() === norm) || null;
  }

  /**
   * Find all active headwords matching a given Chinese meaning (for M8 synonym acceptance).
   * @param {string} zh
   * @param {string|null} [pos]
   * @returns {string[]}
   */
  function findAcceptedByZh(zh, pos) {
    const target = String(zh || '').trim();
    if (!target) return [];
    const pool = getAll({ includeHidden: false }).filter((c) => !c.excludeFromGames);
    return pool
      .filter((c) => (!pos || !c.pos || c.pos === pos) && (c.zh === target || c.zh.split('；').includes(target)))
      .map((c) => c.word);
  }

  /**
   * Validate card form payload (Section 3.4).
   * Allows existing punctuation on builtin cards being edited (e.g. "Mr.", "p.m.",
   * "goodbye / bye", "you (object)") while keeping strict validation for new words.
   * @param {{ word: string, zh: string }} input
   * @param {string} [editingId]
   * @returns {{ valid: boolean, errors: Record<string, string>, duplicate: Object|null }}
   */
  function validate(input, editingId) {
    const errors = {};
    const word = String(input.word || '').trim();
    const zh = String(input.zh || '').trim();
    const existing = editingId ? getById(editingId) : null;
    const isUnchangedBuiltin = Boolean(existing && existing.source === 'builtin' && existing.word === word);

    if (!word) {
      errors.word = 'required';
    } else if (word.length > 40) {
      errors.word = 'too_long';
    } else if (!isUnchangedBuiltin && !/^[A-Za-z][A-Za-z\s'.()/-]*$/.test(word) && !/^[A-Za-z][A-Za-z\s'-]*$/.test(word)) {
      errors.word = 'invalid_chars';
    } else if (!existing && !/^[A-Za-z][A-Za-z\s'-]*$/.test(word)) {
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
    const ex = data.example ? String(data.example).trim() || null : null;
    const card = {
      id,
      word: String(data.word || '').trim(),
      ipa: data.ipa ? String(data.ipa).trim() || null : null,
      pos: data.pos ? String(data.pos).trim() || null : null,
      zh: String(data.zh || '').trim(),
      example: ex,
      exampleZh: data.exampleZh ? String(data.exampleZh).trim() || null : null,
      exampleSource: ex ? 'user' : null,
      hasRealExample: Boolean(ex),
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
      updated.hasRealExample = Boolean(updated.example);
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

  function setHidden(id, hidden) {
    return update(id, { hidden: Boolean(hidden) });
  }

  /**
   * Delete a user card immediately and return snapshot for 5-second Undo toast.
   * Builtin cards cannot be deleted.
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
    if (snapshot.progress && App.store.leitner && typeof App.store.leitner.restore === 'function') {
      App.store.leitner.restore(snapshot.card.id, snapshot.progress);
    }
    if (App.bus) App.bus.emit('card:updated', { cardId: snapshot.card.id, action: 'restore' });
  }

  function listTags() {
    const tags = new Set();
    for (const c of getAll({ includeHidden: false })) {
      for (const t of c.tags || []) tags.add(t);
    }
    return Array.from(tags);
  }

  /**
   * Filter, search, and sort cards for Browse view (Section 3.3 A).
   * @param {Object} [opts]
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

  function invalidate() {
    _userCards = null;
    _overrides = null;
  }

  App.store.cards = {
    CANONICAL_POS,
    normalisePos,
    cleanExample,
    getAll,
    getById,
    findByWord,
    findAcceptedByZh,
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
