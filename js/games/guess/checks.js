/**
 * 你說我猜 (Taboo-style game) rule checker, target selector, candidate builder,
 * taboo picker, and scoring logic (M7, Section 4.4.1–4.4.4).
 * Pure, deterministic, zero DOM dependency — fully unit-testable.
 * @namespace App.games.guessChecks
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const MIN_WORDS = 4;
  const MAX_WORDS = 30;
  const DEFAULT_DISTRACTORS = 18;
  const DEFAULT_TABOO_COUNT = 3;
  const MAX_CLUES_PER_CARD = 3;
  const ROUND_TIME_LIMIT_MS = 60000;
  const CLUE_POINTS = { 1: 300, 2: 200, 3: 100 };

  const FUNCTION_WORDS = new Set([
    'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'into',
    'onto', 'about', 'over', 'under', 'between', 'through', 'during', 'before',
    'after', 'above', 'below', 'up', 'down', 'out', 'off', 'that', 'this',
    'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our',
    'you', 'your', 'i', 'me', 'my', 'he', 'him', 'his', 'she', 'her', 'and',
    'or', 'but', 'if', 'so', 'yet', 'nor', 'than', 'then', 'when', 'where',
    'what', 'which', 'who', 'whom', 'whose', 'how', 'why', 'very', 'too',
    'just', 'only', 'also', 'not', 'no', 'yes', 'can', 'could', 'will',
    'would', 'shall', 'should', 'may', 'might', 'must', 'do', 'does', 'did',
    'have', 'has', 'had', 'some', 'any', 'all', 'both', 'each', 'few', 'more',
    'most', 'other', 'such', 'own', 'same', 'there', 'here', 'ever', 'still',
    'already', 'almost', 'really', 'quite', 'rather', 'perhaps', 'maybe',
  ]);

  const IRREGULAR_GROUPS = [
    ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
    ['go', 'goes', 'went', 'gone', 'going'],
    ['eat', 'eats', 'ate', 'eaten', 'eating'],
    ['take', 'takes', 'took', 'taken', 'taking'],
    ['see', 'sees', 'saw', 'seen', 'seeing'],
    ['write', 'writes', 'wrote', 'written', 'writing'],
    ['give', 'gives', 'gave', 'given', 'giving'],
    ['come', 'comes', 'came', 'coming'],
    ['make', 'makes', 'made', 'making'],
    ['get', 'gets', 'got', 'gotten', 'getting'],
    ['know', 'knows', 'knew', 'known', 'knowing'],
    ['think', 'thinks', 'thought', 'thinking'],
    ['bring', 'brings', 'brought', 'bringing'],
    ['buy', 'buys', 'bought', 'buying'],
    ['catch', 'catches', 'caught', 'catching'],
    ['teach', 'teaches', 'taught', 'teaching'],
    ['find', 'finds', 'found', 'finding'],
    ['tell', 'tells', 'told', 'telling'],
    ['say', 'says', 'said', 'saying'],
    ['keep', 'keeps', 'kept', 'keeping'],
    ['leave', 'leaves', 'left', 'leaving'],
    ['feel', 'feels', 'felt', 'feeling'],
    ['meet', 'meets', 'met', 'meeting'],
    ['run', 'runs', 'ran', 'running'],
    ['drink', 'drinks', 'drank', 'drunk', 'drinking'],
    ['sing', 'sings', 'sang', 'sung', 'singing'],
    ['swim', 'swims', 'swam', 'swum', 'swimming'],
    ['break', 'breaks', 'broke', 'broken', 'breaking'],
    ['choose', 'chooses', 'chose', 'chosen', 'choosing'],
    ['speak', 'speaks', 'spoke', 'spoken', 'speaking'],
    ['drive', 'drives', 'drove', 'driven', 'driving'],
    ['ride', 'rides', 'rode', 'ridden', 'riding'],
    ['read', 'reads', 'reading'],
    ['send', 'sends', 'sent', 'sending'],
    ['spend', 'spends', 'spent', 'spending'],
    ['build', 'builds', 'built', 'building'],
    ['lose', 'loses', 'lost', 'losing'],
    ['win', 'wins', 'won', 'winning'],
    ['sit', 'sits', 'sat', 'sitting'],
    ['stand', 'stands', 'stood', 'standing'],
    ['good', 'better', 'best'],
    ['bad', 'worse', 'worst'],
    ['child', 'children'],
    ['foot', 'feet'],
    ['tooth', 'teeth'],
    ['mouse', 'mice'],
    ['man', 'men'],
    ['woman', 'women'],
    ['person', 'people'],
    ['leaf', 'leaves'],
    ['knife', 'knives'],
    ['life', 'lives'],
    ['shelf', 'shelves'],
  ];

  const IRREGULAR_INDEX = new Map();
  for (const grp of IRREGULAR_GROUPS) {
    for (const form of grp) IRREGULAR_INDEX.set(form, grp);
  }

  /**
   * Expand a word into its simple morphological variants (plural, -s/-es/-ies,
   * -ed, -ing, -er, -est, and common irregular forms).
   * @param {string} word
   * @returns {string[]}
   */
  function expandForms(word) {
    const w = String(word || '').trim().toLowerCase();
    if (!w) return [];
    const set = new Set([w]);

    const addRegular = (base) => {
      if (!base) return;
      set.add(base);
      if (App.text && typeof App.text.variants === 'function') {
        for (const v of App.text.variants(base)) set.add(v);
      } else {
        set.add(base + 's');
        set.add(base + 'es');
        set.add(base + 'ed');
        set.add(base + 'ing');
        set.add(base + 'er');
        set.add(base + 'est');
      }
    };

    const fam = IRREGULAR_INDEX.get(w);
    if (fam) {
      for (const f of fam) set.add(f);
      addRegular(fam[0]);
    } else {
      addRegular(w);
    }

    // Reverse stems for inflected inputs
    if (w.length > 4 && (w.endsWith('ies') || w.endsWith('ied'))) addRegular(w.slice(0, -3) + 'y');
    else if (w.length > 4 && w.endsWith('ing')) {
      const s = w.slice(0, -3);
      addRegular(s);
      addRegular(s + 'e');
    } else if (w.length > 3 && w.endsWith('ed')) {
      const s = w.slice(0, -2);
      addRegular(s);
      addRegular(s + 'e');
    } else if (w.length > 3 && w.endsWith('es')) {
      addRegular(w.slice(0, -2));
      addRegular(w.slice(0, -1));
    } else if (w.length > 2 && w.endsWith('s') && !w.endsWith('ss')) {
      addRegular(w.slice(0, -1));
    }

    return Array.from(set);
  }

  function _normaliseForCompare(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, ' ');
  }

  function _findWordHits(desc, formsSet) {
    const hits = [];
    const seen = new Set();
    const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
    let m;
    while ((m = re.exec(desc)) !== null) {
      const raw = m[0];
      const lower = raw.toLowerCase();
      if (formsSet.has(lower) && !seen.has(lower)) {
        seen.add(lower);
        hits.push(raw);
      }
    }
    return hits;
  }

  /**
   * Code checks run BEFORE the AI sees the learner's description (Section 4.4.2 & 4.4.4):
   * 1. Non-English characters -> 'non_english' ("請用英文描述")
   * 2. Fewer than 4 words -> 'too_short' ("再多寫一點")
   * 3. More than 30 words -> 'too_long'
   * 4. Identical to a previous clue -> 'duplicate_clue' ("換個說法試試")
   * 5. Contains target word or variant -> 'contains_target' ("不能直接說出答案")
   * 6. Contains any taboo word or variant -> 'contains_taboo'
   * @param {string} rawDesc
   * @param {string} targetWord
   * @param {string[]} [tabooWords]
   * @param {string[]} [prevClues]
   * @returns {{ ok: boolean, reason: string|null, messageKey: string|null, wordCount: number, offendingWords: string[], matchedTaboos: string[] }}
   */
  function validateDescription(rawDesc, targetWord, tabooWords, prevClues) {
    const desc = String(rawDesc || '')
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .trim();

    if (!desc) {
      return { ok: false, reason: 'too_short', messageKey: 'guess.err_too_short', wordCount: 0, offendingWords: [], matchedTaboos: [] };
    }

    // 1. Non-English characters (CJK, Kana, Hangul, Cyrillic, emoji, etc.) or no ASCII letters
    if (/[^\x00-\x7F]/.test(desc) || !/[A-Za-z]/.test(desc)) {
      return { ok: false, reason: 'non_english', messageKey: 'guess.err_non_english', wordCount: 0, offendingWords: [], matchedTaboos: [] };
    }

    // 2. Word count (4..30 English words)
    const words = desc.match(/[A-Za-z]+(?:'[A-Za-z]+)?(?:-[A-Za-z]+)*/g) || [];
    if (words.length < MIN_WORDS) {
      return { ok: false, reason: 'too_short', messageKey: 'guess.err_too_short', wordCount: words.length, offendingWords: [], matchedTaboos: [] };
    }
    if (words.length > MAX_WORDS) {
      return { ok: false, reason: 'too_long', messageKey: 'guess.err_too_long', wordCount: words.length, offendingWords: [], matchedTaboos: [] };
    }

    // 3. Duplicate clue check
    const normDesc = _normaliseForCompare(desc);
    if (Array.isArray(prevClues) && prevClues.some((c) => _normaliseForCompare(c) === normDesc)) {
      return { ok: false, reason: 'duplicate_clue', messageKey: 'guess.err_duplicate', wordCount: words.length, offendingWords: [], matchedTaboos: [] };
    }

    // 4. Target word or simple form (plural, -ed, -ing, -er, -s, irregulars)
    const targetTokens = String(targetWord || '').trim().match(/[A-Za-z]+/g) || [];
    const targetForms = new Set();
    for (const tok of targetTokens) {
      if (tok.length >= 2 && !FUNCTION_WORDS.has(tok.toLowerCase())) {
        for (const f of expandForms(tok)) targetForms.add(f);
      } else if (targetTokens.length === 1) {
        for (const f of expandForms(tok)) targetForms.add(f);
      }
    }
    const targetHits = _findWordHits(desc, targetForms);
    if (targetHits.length) {
      return {
        ok: false,
        reason: 'contains_target',
        messageKey: 'guess.err_target',
        wordCount: words.length,
        offendingWords: targetHits,
        matchedTaboos: [],
      };
    }

    // 5. Taboo (forbidden) words or variants
    const offendingWords = [];
    const matchedTaboos = [];
    const seenOff = new Set();
    for (const taboo of (tabooWords || [])) {
      const tClean = String(taboo || '').trim();
      if (!tClean) continue;
      const forms = new Set(expandForms(tClean));
      const hits = _findWordHits(desc, forms);
      if (hits.length) {
        matchedTaboos.push(tClean);
        for (const h of hits) {
          if (!seenOff.has(h.toLowerCase())) {
            seenOff.add(h.toLowerCase());
            offendingWords.push(h);
          }
        }
      }
    }
    if (offendingWords.length) {
      return {
        ok: false,
        reason: 'contains_taboo',
        messageKey: 'guess.err_taboo',
        wordCount: words.length,
        offendingWords,
        matchedTaboos,
      };
    }

    return {
      ok: true,
      reason: null,
      messageKey: null,
      wordCount: words.length,
      offendingWords: [],
      matchedTaboos: [],
    };
  }

  /**
   * Whether a card is a good concrete target for 你說我猜 (Section 4.4.3).
   * Prefers concrete nouns, verbs, and adjectives; skips function words and hidden/excluded cards.
   * @param {Object} card
   * @returns {boolean}
   */
  function isEligibleTarget(card) {
    if (!card || card.hidden || card.excludeFromGames) return false;
    const word = String(card.word || '').trim();
    if (!word || word.length < 3) return false;
    if (!/^[A-Za-z]+(?:[ -][A-Za-z]+)?$/.test(word)) return false;
    const lower = word.toLowerCase();
    if (FUNCTION_WORDS.has(lower)) return false;
    if (card.pos && /^(prep\.|conj\.|pron\.|det\.|aux\.|int\.)$/.test(card.pos)) return false;
    return true;
  }

  function _shuffleCopy(list, rng) {
    const arr = list.slice();
    const rand = typeof rng === 'function' ? rng : Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Select `count` (default 5) concrete target cards for a 你說我猜 session.
   * Supports forced words (?words=...), deck filtering, and prioritizing reviewed/wrong cards.
   * @param {Array<Object>} allCards
   * @param {number} [count=5]
   * @param {{ deckCardIds?: string[]|null, forcedWords?: string[], prioritizeIds?: string[], rng?: Function }} [opts]
   * @returns {Array<Object>}
   */
  function selectSessionTargets(allCards, count, opts) {
    const n = Number.isFinite(count) && count > 0 ? count : 5;
    const o = opts || {};
    const rng = o.rng || Math.random;
    const deckSet = Array.isArray(o.deckCardIds) && o.deckCardIds.length ? new Set(o.deckCardIds) : null;

    const pool = (allCards || []).filter((c) => isEligibleTarget(c) && (!deckSet || deckSet.has(c.id)));
    const fallbackPool = pool.length >= n ? pool : (allCards || []).filter(isEligibleTarget);

    const chosen = [];
    const seen = new Set();
    const pushCard = (c) => {
      if (!c || chosen.length >= n) return;
      const wl = c.word.toLowerCase();
      if (seen.has(wl)) return;
      seen.add(wl);
      chosen.push(c);
    };

    // 1. Forced words (e.g. from 第 13 節課 "用這些錯字玩你說我猜")
    if (Array.isArray(o.forcedWords) && o.forcedWords.length) {
      const byWord = new Map((allCards || []).map((c) => [String(c.word || '').toLowerCase(), c]));
      for (const fw of o.forcedWords) {
        const match = byWord.get(String(fw || '').trim().toLowerCase());
        if (match && !match.hidden) pushCard(match);
      }
    }

    // 2. Prioritized cards (today's reviewed / wrong cards)
    if (chosen.length < n && Array.isArray(o.prioritizeIds) && o.prioritizeIds.length) {
      const prioSet = new Set(o.prioritizeIds);
      const prioCards = _shuffleCopy(fallbackPool.filter((c) => prioSet.has(c.id)), rng);
      for (const c of prioCards) pushCard(c);
    }

    // 3. Prefer cards with canonical n./v./adj. & real examples first, then remaining concrete cards
    if (chosen.length < n) {
      const rich = _shuffleCopy(
        fallbackPool.filter((c) => c.hasRealExample && (!c.pos || /^(n\.|v\.|adj\.)$/.test(c.pos))),
        rng
      );
      for (const c of rich) pushCard(c);
    }

    if (chosen.length < n) {
      const rest = _shuffleCopy(fallbackPool, rng);
      for (const c of rest) pushCard(c);
    }

    return chosen;
  }

  /**
   * Build a bounded candidate list for embedding/offline ranking:
   * target card + `distractorCount` (default 18, i.e. 15–20 distractors) from the same deck/topic.
   * Priority: same unit -> same chapter/shared tag -> same POS -> rest of deck/active pool.
   * @param {Object} targetCard
   * @param {Array<Object>} poolCards
   * @param {{ distractorCount?: number, deckCardIds?: string[]|null, rng?: Function }} [opts]
   * @returns {Array<Object>}
   */
  function buildCandidates(targetCard, poolCards, opts) {
    if (!targetCard) return [];
    const o = opts || {};
    const distractorCount = Number.isFinite(o.distractorCount) ? Math.max(5, Math.min(25, o.distractorCount)) : DEFAULT_DISTRACTORS;
    const rng = o.rng || Math.random;
    const deckSet = Array.isArray(o.deckCardIds) && o.deckCardIds.length ? new Set(o.deckCardIds) : null;

    const targetForms = new Set(expandForms(targetCard.word));
    const targetTags = new Set(Array.isArray(targetCard.tags) ? targetCard.tags : []);

    const activePool = (poolCards || []).filter((c) => {
      if (!c || c.id === targetCard.id || c.hidden || c.excludeFromGames) return false;
      const wl = String(c.word || '').trim().toLowerCase();
      if (!wl || targetForms.has(wl) || FUNCTION_WORDS.has(wl)) return false;
      return true;
    });

    const deckPool = deckSet ? activePool.filter((c) => deckSet.has(c.id)) : activePool;
    const primaryPool = deckPool.length >= distractorCount ? deckPool : activePool;

    const distractors = [];
    const seenWords = new Set([String(targetCard.word || '').toLowerCase()]);

    const takeFrom = (list) => {
      for (const c of _shuffleCopy(list, rng)) {
        if (distractors.length >= distractorCount) return;
        const wl = String(c.word || '').toLowerCase();
        if (seenWords.has(wl)) continue;
        seenWords.add(wl);
        distractors.push(c);
      }
    };

    // Tier 1: same unitNo (tightest topic neighborhood -> near-synonyms like bookstore/library)
    if (targetCard.unitNo != null) {
      takeFrom(primaryPool.filter((c) => c.unitNo === targetCard.unitNo));
    }
    // Tier 2: same chapterNo or shared tag
    if (distractors.length < distractorCount && (targetCard.chapterNo != null || targetTags.size > 0)) {
      takeFrom(primaryPool.filter((c) =>
        (targetCard.chapterNo != null && c.chapterNo === targetCard.chapterNo)
        || (Array.isArray(c.tags) && c.tags.some((t) => targetTags.has(t)))
      ));
    }
    // Tier 3: same canonical POS
    if (distractors.length < distractorCount && targetCard.pos) {
      takeFrom(primaryPool.filter((c) => c.pos === targetCard.pos));
    }
    // Tier 4: remaining cards from deck pool, then full active pool
    if (distractors.length < distractorCount) takeFrom(primaryPool);
    if (distractors.length < distractorCount && primaryPool !== activePool) takeFrom(activePool);

    return _shuffleCopy([targetCard].concat(distractors), rng);
  }

  /**
   * Pick 3–5 forbidden (taboo) words for `targetCard` (default 3).
   * - When `embeddingsMap` is available: picks the nearest semantic neighbors among candidates.
   * - Offline / fallback: extracts content words from target's real example + same-topic candidates.
   * Always excludes target word & its morphological variants.
   * @param {Object} targetCard
   * @param {Array<Object>} candidates
   * @param {{ count?: number, embeddingsMap?: Map<string, number[]>|null }} [opts]
   * @returns {string[]}
   */
  function pickTabooWords(targetCard, candidates, opts) {
    if (!targetCard) return [];
    const o = opts || {};
    const count = Number.isFinite(o.count) ? Math.max(3, Math.min(5, o.count)) : DEFAULT_TABOO_COUNT;
    const targetForms = new Set(expandForms(targetCard.word));
    const chosen = [];
    const seen = new Set();

    const addTaboo = (w) => {
      const clean = String(w || '').trim();
      const lower = clean.toLowerCase();
      if (!clean || lower.length < 3 || FUNCTION_WORDS.has(lower) || targetForms.has(lower) || seen.has(lower)) return;
      if (!/^[A-Za-z]+$/.test(clean)) return;
      seen.add(lower);
      chosen.push(lower);
    };

    // 1. Embedding nearest neighbors when vectors are available
    if (o.embeddingsMap && App.ai && App.ai.embed && typeof App.ai.embed.pickNearestNeighbors === 'function') {
      const neighbors = App.ai.embed.pickNearestNeighbors(targetCard, candidates, o.embeddingsMap, count + 2);
      for (const nw of neighbors) {
        if (chosen.length >= count) break;
        addTaboo(nw);
      }
    }

    // 2. Content words from real example sentence (when available)
    if (chosen.length < count && targetCard.hasRealExample && targetCard.example) {
      const exWords = String(targetCard.example).match(/[A-Za-z]{3,}/g) || [];
      for (const ew of exWords) {
        if (chosen.length >= count) break;
        addTaboo(ew);
      }
    }

    // 3. Same-unit / same-chapter candidates
    const orderedCands = (candidates || []).slice().sort((a, b) => {
      const sa = (a.unitNo === targetCard.unitNo ? 2 : 0) + (a.chapterNo === targetCard.chapterNo ? 1 : 0);
      const sb = (b.unitNo === targetCard.unitNo ? 2 : 0) + (b.chapterNo === targetCard.chapterNo ? 1 : 0);
      return sb - sa;
    });
    for (const c of orderedCands) {
      if (chosen.length >= count) break;
      if (c && c.id !== targetCard.id) addTaboo(c.word);
    }

    return chosen.slice(0, count);
  }

  /**
   * Compute round score per Section 4.4.1:
   * - Target ranked #1 on 1st clue = 300; 2nd clue = 200; 3rd clue = 100.
   * - Target in top 3 (rank #2 or #3) without reaching #1 = half of that clue's points.
   * @param {number} clueNumber  1, 2, or 3
   * @param {number} rank        1-based rank of target
   * @returns {number}
   */
  function scoreRound(clueNumber, rank) {
    const base = CLUE_POINTS[clueNumber] || 100;
    if (rank === 1) return base;
    if (rank === 2 || rank === 3) return Math.round(base / 2);
    return 0;
  }

  App.games.guessChecks = {
    MIN_WORDS,
    MAX_WORDS,
    DEFAULT_DISTRACTORS,
    DEFAULT_TABOO_COUNT,
    MAX_CLUES_PER_CARD,
    ROUND_TIME_LIMIT_MS,
    CLUE_POINTS,
    expandForms,
    validateDescription,
    isEligibleTarget,
    selectSessionTargets,
    buildCandidates,
    pickTabooWords,
    scoreRound,
  };
})();
