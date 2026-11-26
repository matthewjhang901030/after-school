/**
 * Decks store — manages card groups under "as.v1.decks".
 * Includes the default builtin deck "基礎 2000 字" (isDefaultAll: true) which
 * dynamically resolves to all non-hidden builtin cards without duplicating IDs
 * in localStorage.
 * @namespace App.store.decks
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.store = App.store || {};

  const KEY = 'as.v1.decks';
  const DEFAULT_DECK_ID = 'd-builtin-2000';

  /** 5 muted stationery ring colors mapped to CSS classes / design tokens. */
  const RING_COLORS = [
    { id: 'vocab',    token: '--tab-vocab',    labelKey: 'skill.vocab' },
    { id: 'grammar',  token: '--tab-grammar',  labelKey: 'skill.grammar' },
    { id: 'dialogue', token: '--tab-dialogue', labelKey: 'skill.dialogue' },
    { id: 'muted',    token: '--muted',        labelKey: 'decks.ring.stone' },
    { id: 'ink',      token: '--ink',          labelKey: 'decks.ring.ink' },
  ];

  let _cache = null;

  function _defaultDeck() {
    return {
      id: DEFAULT_DECK_ID,
      name: '基礎 2000 字',
      ringColor: 'vocab',
      cardIds: [],
      isDefaultAll: true,
      builtin: true,
      createdAt: 0,
      order: 0,
    };
  }

  function _load() {
    if (_cache) return _cache;
    let list = App.store.db.get(KEY, null);
    if (!Array.isArray(list) || list.length === 0) {
      list = [_defaultDeck()];
      App.store.db.set(KEY, list);
    } else if (!list.some((d) => d.id === DEFAULT_DECK_ID)) {
      list.unshift(_defaultDeck());
      App.store.db.set(KEY, list);
    }
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    _cache = list;
    return _cache;
  }

  function _save(list) {
    _cache = list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    App.store.db.set(KEY, _cache);
  }

  /**
   * Return all decks in display order.
   * @returns {Array<Object>}
   */
  function getAll() {
    return _load().map((d) => Object.assign({}, d, { cardIds: (d.cardIds || []).slice() }));
  }

  /**
   * Return a deck by id.
   * @param {string} id
   * @returns {Object|null}
   */
  function getById(id) {
    const found = _load().find((d) => d.id === id);
    return found ? Object.assign({}, found, { cardIds: (found.cardIds || []).slice() }) : null;
  }

  /**
   * Resolve active card IDs belonging to a deck.
   * For the default deck (isDefaultAll), returns all non-hidden builtin cards.
   * @param {string} deckId
   * @returns {string[]}
   */
  function getCardIds(deckId) {
    const deck = _load().find((d) => d.id === deckId);
    if (!deck) return [];
    const cardsStore = App.store.cards;
    if (deck.isDefaultAll && cardsStore) {
      return cardsStore.getAll({ includeHidden: false })
        .filter((c) => c.source === 'builtin')
        .map((c) => c.id);
    }
    if (!cardsStore) return (deck.cardIds || []).slice();
    const activeSet = new Set(cardsStore.getAll({ includeHidden: false }).map((c) => c.id));
    return (deck.cardIds || []).filter((id) => activeSet.has(id));
  }

  /**
   * Create a custom deck.
   * @param {{ name: string, ringColor?: string, cardIds?: string[] }} input
   * @returns {Object}
   */
  function create(input) {
    const list = _load().slice();
    const maxOrder = list.reduce((m, d) => Math.max(m, d.order || 0), 0);
    const deck = {
      id: 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: String(input.name || '').trim(),
      ringColor: input.ringColor || 'vocab',
      cardIds: Array.isArray(input.cardIds) ? Array.from(new Set(input.cardIds)) : [],
      isDefaultAll: false,
      builtin: false,
      createdAt: Date.now(),
      order: maxOrder + 1,
    };
    list.push(deck);
    _save(list);
    return Object.assign({}, deck, { cardIds: deck.cardIds.slice() });
  }

  /**
   * Rename a deck.
   * @param {string} id
   * @param {string} name
   * @returns {Object|null}
   */
  function rename(id, name) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const list = _load().map((d) => (d.id === id ? Object.assign({}, d, { name: clean }) : d));
    _save(list);
    return getById(id);
  }

  /**
   * Update ring color token key.
   * @param {string} id
   * @param {string} ringColor
   * @returns {Object|null}
   */
  function updateColor(id, ringColor) {
    const list = _load().map((d) => (d.id === id ? Object.assign({}, d, { ringColor }) : d));
    _save(list);
    return getById(id);
  }

  /**
   * Reorder decks given an ordered list of deck IDs.
   * @param {string[]} orderedIds
   */
  function reorder(orderedIds) {
    const orderMap = new Map();
    orderedIds.forEach((id, idx) => orderMap.set(id, idx));
    const list = _load().map((d) => Object.assign({}, d, {
      order: orderMap.has(d.id) ? orderMap.get(d.id) : d.order + orderedIds.length,
    }));
    _save(list);
  }

  /**
   * Delete a custom deck (never deletes its cards; default deck protected).
   * Returns a snapshot so the caller can restore it within the undo window.
   * @param {string} id
   * @returns {Object|null}
   */
  function remove(id) {
    if (id === DEFAULT_DECK_ID) return null;
    const list = _load().slice();
    const idx = list.findIndex((d) => d.id === id);
    if (idx < 0) return null;
    const [removed] = list.splice(idx, 1);
    _save(list);
    return removed;
  }

  /**
   * Restore a soft-deleted deck snapshot.
   * @param {Object} snapshot
   */
  function restore(snapshot) {
    if (!snapshot || !snapshot.id) return;
    const list = _load().slice();
    if (!list.some((d) => d.id === snapshot.id)) {
      list.push(snapshot);
      _save(list);
    }
  }

  /**
   * Return custom decks containing cardId.
   * @param {string} cardId
   * @returns {Array<Object>}
   */
  function getDecksForCard(cardId) {
    return getAll().filter((d) => (d.isDefaultAll && App.store.cards && (App.store.cards.getById(cardId) || {}).source === 'builtin')
      || (d.cardIds && d.cardIds.includes(cardId)));
  }

  /**
   * Assign a card to a specific list of custom deck IDs.
   * @param {string} cardId
   * @param {string[]} targetDeckIds
   */
  function setCardDecks(cardId, targetDeckIds) {
    const targetSet = new Set(targetDeckIds || []);
    const list = _load().map((d) => {
      if (d.isDefaultAll) return d;
      const set = new Set(d.cardIds || []);
      if (targetSet.has(d.id)) set.add(cardId);
      else set.delete(cardId);
      return Object.assign({}, d, { cardIds: Array.from(set) });
    });
    _save(list);
  }

  /**
   * Remove a card from all custom decks (returns deck IDs that held it).
   * @param {string} cardId
   * @returns {string[]}
   */
  function removeCardFromAll(cardId) {
    const heldBy = [];
    const list = _load().map((d) => {
      if (d.isDefaultAll || !Array.isArray(d.cardIds)) return d;
      if (!d.cardIds.includes(cardId)) return d;
      heldBy.push(d.id);
      return Object.assign({}, d, { cardIds: d.cardIds.filter((id) => id !== cardId) });
    });
    if (heldBy.length) _save(list);
    return heldBy;
  }

  /**
   * Whether a deck has at least 4 active cards (required for 4-option games).
   * @param {string} deckId
   * @returns {boolean}
   */
  function canPlayFourOptionGame(deckId) {
    return getCardIds(deckId).length >= 4;
  }

  function invalidate() {
    _cache = null;
  }

  App.store.decks = {
    DEFAULT_DECK_ID,
    RING_COLORS,
    getAll,
    getById,
    getCardIds,
    create,
    rename,
    updateColor,
    reorder,
    remove,
    restore,
    getDecksForCard,
    setCardDecks,
    removeCardFromAll,
    canPlayFourOptionGame,
    invalidate,
  };
})();
