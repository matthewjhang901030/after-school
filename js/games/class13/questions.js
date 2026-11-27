/**
 * 第 13 節課 (The 13th Period) question generator, word-priority builder,
 * per-letter multi-answer typing validator, and core balance formulas (M8, Section 4.3).
 * Pure, deterministic, zero DOM dependency — fully unit-testable.
 * @namespace App.games.class13Questions
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const PERIOD_DURATION_MS = 90000;
  const QUESTION_TIMEOUT_MS = 8000;
  const START_DISTANCE_M = 12.0;
  const MAX_DISTANCE_M = 12.0;
  const CORRECT_PUSH_M = 1.5;
  const WRONG_KEY_PULL_M = 0.3;
  const MISS_PULL_M = 2.0;
  const BASE_SPEED_MPS = 0.20;
  const SPEED_STEP_MPS = 0.05;
  const WIN_PERIOD = 5;

  /**
   * 操行分數 target to pass a given period (Section 4.3.1):
   * Target = 600 + 200 * (period - 1).
   * @param {number} period  1-based period number
   * @returns {number}
   */
  function periodTargetScore(period) {
    const p = Math.max(1, Math.floor(Number(period) || 1));
    return 600 + 200 * (p - 1);
  }

  /**
   * Creature approach speed in meters/second (Section 4.3.1):
   * 0.20 m/s in period 1, +0.05 m/s per period.
   * @param {number} period  1-based period number
   * @returns {number}
   */
  function creatureSpeed(period) {
    const p = Math.max(1, Math.floor(Number(period) || 1));
    return Number((BASE_SPEED_MPS + SPEED_STEP_MPS * (p - 1)).toFixed(2));
  }

  /**
   * Clamp distance within [0, MAX_DISTANCE_M] with 2-decimal precision.
   * @param {number} d
   * @returns {number}
   */
  function clampDistance(d) {
    return Number(Math.max(0, Math.min(MAX_DISTANCE_M, Number(d) || 0)).toFixed(2));
  }

  function _normChar(ch) {
    if (typeof ch !== 'string') return '';
    return ch.replace(/[\u2018\u2019\u02BC]/g, "'").toLowerCase();
  }

  function _normAnswer(ans) {
    return String(ans || '')
      .trim()
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/\s+/g, ' ')
      .toLowerCase();
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
   * Whether a vocabulary card is suitable for meaning -> typing rounds.
   * @param {Object} card
   * @returns {boolean}
   */
  function isTypableCard(card) {
    if (!card || card.hidden || card.excludeFromGames) return false;
    const w = String(card.word || '').trim();
    if (!w || w.length < 2 || w.length > 18) return false;
    if (!/^[A-Za-z][A-Za-z' -]*[A-Za-z]$/.test(w)) return false;
    if (!card.zh || !String(card.zh).trim()) return false;
    return true;
  }

  /**
   * Build prioritized vocabulary pool for 第 13 節課 (Section 4.3.2):
   * 1. Wrong in the last 7 days
   * 2. Leitner Box 1 cards
   * 3. Due cards (due <= today)
   * 4. Confusion pairs from 四格分類牆
   * 5. Remaining active deck cards
   * @param {Array<Object>} allCards
   * @param {{ deckCardIds?: string[]|null, recentWrongIds?: string[], progressMap?: Object, today?: string, confusionWords?: string[], rng?: Function }} [opts]
   * @returns {Array<Object>}
   */
  function buildWordPool(allCards, opts) {
    const o = opts || {};
    const rng = o.rng || Math.random;
    const deckSet = Array.isArray(o.deckCardIds) && o.deckCardIds.length ? new Set(o.deckCardIds) : null;
    const eligible = (allCards || []).filter((c) => isTypableCard(c) && (!deckSet || deckSet.has(c.id)));
    const basePool = eligible.length >= 10 ? eligible : (allCards || []).filter(isTypableCard);

    const recentWrongSet = new Set(Array.isArray(o.recentWrongIds) ? o.recentWrongIds : []);
    const progressMap = o.progressMap || {};
    const today = o.today || (App.date ? App.date.todayKey() : '');
    const confusionSet = new Set((o.confusionWords || []).map((w) => String(w || '').toLowerCase()));

    const tier1 = [];
    const tier2 = [];
    const tier3 = [];
    const tier4 = [];
    const tier5 = [];

    for (const c of basePool) {
      const prog = progressMap[c.id];
      if (recentWrongSet.has(c.id)) tier1.push(c);
      else if (prog && prog.box === 1) tier2.push(c);
      else if (prog && today && prog.due <= today) tier3.push(c);
      else if (confusionSet.has(c.word.toLowerCase())) tier4.push(c);
      else tier5.push(c);
    }

    return []
      .concat(_shuffleCopy(tier1, rng))
      .concat(_shuffleCopy(tier2, rng))
      .concat(_shuffleCopy(tier3, rng))
      .concat(_shuffleCopy(tier4, rng))
      .concat(_shuffleCopy(tier5, rng));
  }

  /**
   * Create a question deck cursor that mixes question types per period (Section 4.3.2):
   * - Period 1: meaning->word (vocab) + verb form (grammar)
   * - Period 2+: meaning->word (vocab) + verb form (grammar) + broadcast dialogue cloze (dialogue)
   * @param {{ wordPool: Array<Object>, tenseItems?: Array<Object>, broadcastItems?: Array<Object>, rng?: Function }} config
   */
  function createQuestionDeck(config) {
    const cfg = config || {};
    const rng = cfg.rng || Math.random;
    const words = Array.isArray(cfg.wordPool) ? cfg.wordPool.slice() : [];
    const tenses = _shuffleCopy(Array.isArray(cfg.tenseItems) ? cfg.tenseItems : [], rng);
    const broadcasts = _shuffleCopy(Array.isArray(cfg.broadcastItems) ? cfg.broadcastItems : [], rng);

    let wordIdx = 0;
    let tenseIdx = 0;
    let broadcastIdx = 0;
    let seq = 0;

    function _makeMeaningQuestion(card, isHard, isAudioOnly) {
      const accepted = [_normAnswer(card.word)];
      return {
        id: `q-m-${++seq}`,
        type: isAudioOnly ? 'audio' : 'meaning',
        skill: 'vocab',
        cardId: card.id,
        word: card.word,
        promptBadge: isAudioOnly ? '聽力' : '單字',
        promptMain: isAudioOnly ? '♪ 聽發音拼寫單字' : card.zh,
        promptSub: isAudioOnly ? (card.pos || '') : (card.pos || ''),
        accepted,
        displayAnswer: card.word,
        meaningZh: card.zh,
        ruleZh: card.hasRealExample && card.example ? card.example : null,
        isHard: Boolean(isHard),
        audioOnly: Boolean(isAudioOnly),
      };
    }

    function _makeTenseQuestion(item, isHard) {
      const accepted = (item.accepted || []).map(_normAnswer).filter(Boolean);
      const display = (item.accepted && item.accepted[0]) || '';
      return {
        id: `q-t-${++seq}`,
        type: 'tense',
        skill: 'grammar',
        cardId: null,
        word: item.base,
        promptBadge: '文法',
        promptMain: `${item.base} → ${item.formZh}`,
        promptSub: item.meaningZh || '',
        accepted,
        displayAnswer: display,
        meaningZh: item.meaningZh || null,
        ruleZh: item.ruleZh || null,
        isHard: Boolean(isHard),
      };
    }

    function _makeBroadcastQuestion(item, isHard) {
      const accepted = (item.accepted || []).map(_normAnswer).filter(Boolean);
      const display = (item.accepted && item.accepted[0]) || '';
      return {
        id: `q-b-${++seq}`,
        type: 'broadcast',
        skill: 'dialogue',
        cardId: null,
        word: display,
        promptBadge: '對話',
        promptMain: `B: ${item.lineB}`,
        promptSub: `A: ${item.lineA}`,
        accepted,
        displayAnswer: display,
        meaningZh: item.grammarTag || null,
        ruleZh: item.ruleZh || null,
        isHard: Boolean(isHard),
      };
    }

    function next(period, opts) {
      const p = Math.max(1, Math.floor(Number(period) || 1));
      const o = opts || {};
      const hardEvery = Number.isFinite(o.hardEvery) && o.hardEvery > 0 ? Math.floor(o.hardEvery) : 6;
      const count = seq + 1;
      const isHard = count % hardEvery === 0;
      const roll = rng();

      // Determine type mix for the period (Section 4.3.2):
      // P1: meaning + tense | P2: + broadcast | P3+: + audio-only vocab (when TTS available)
      let chosenType = 'meaning';
      if (p >= 2 && broadcasts.length && roll >= 0.75) {
        chosenType = 'broadcast';
      } else if (tenses.length && roll >= (p >= 2 ? 0.45 : 0.65)) {
        chosenType = 'tense';
      }

      if (chosenType === 'broadcast' && broadcasts.length) {
        const item = broadcasts[broadcastIdx % broadcasts.length];
        broadcastIdx++;
        return _makeBroadcastQuestion(item, isHard);
      }
      if (chosenType === 'tense' && tenses.length) {
        const item = tenses[tenseIdx % tenses.length];
        tenseIdx++;
        return _makeTenseQuestion(item, isHard);
      }
      if (words.length) {
        const card = words[wordIdx % words.length];
        wordIdx++;
        const wantAudioOnly = Boolean(o.ttsAvailable) && (Boolean(o.forceAudioOnly) || (p >= 3 && !o.safeMode && roll < 0.18));
        return _makeMeaningQuestion(card, isHard, wantAudioOnly);
      }
      if (tenses.length) {
        const item = tenses[tenseIdx % tenses.length];
        tenseIdx++;
        return _makeTenseQuestion(item, isHard);
      }
      return null;
    }

    return { next };
  }

  /**
   * Per-letter validation against ALL accepted answers matching the current prefix (Section 4.3.3).
   * Supports multi-answer alternatives like ["didn't", "did not"] and multi-word answers with spaces.
   * Case-insensitive; normalizes curly apostrophes.
   * @param {string} typed         Current valid prefix already typed
   * @param {string} rawKey        Incoming key ('a'..'z', ' ', "'", '-', 'Backspace')
   * @param {string[]} acceptedRaw Accepted answers list
   * @returns {{ accepted: boolean, ignored: boolean, completed: boolean, nextTyped: string, matchedAnswer: string|null, expectedNext: string|null }}
   */
  function _normPrefix(str) {
    return String(str || '')
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .toLowerCase();
  }

  function evaluateKeystroke(typed, rawKey, acceptedRaw) {
    const cur = _normPrefix(typed || '');
    const acceptedList = (acceptedRaw || []).map(_normAnswer).filter(Boolean);

    if (rawKey === 'Backspace') {
      return {
        accepted: true,
        ignored: false,
        completed: false,
        nextTyped: cur.length ? cur.slice(0, -1) : '',
        matchedAnswer: null,
        expectedNext: null,
      };
    }

    const ch = _normChar(rawKey);
    if (!ch || ch.length !== 1 || !/^[a-z' -]$/.test(ch)) {
      return {
        accepted: false,
        ignored: true,
        completed: false,
        nextTyped: cur,
        matchedAnswer: null,
        expectedNext: null,
      };
    }

    const candidateNext = cur + ch;
    const prefixMatches = acceptedList.filter((ans) => ans.startsWith(candidateNext));
    if (prefixMatches.length) {
      const exact = prefixMatches.find((ans) => ans === candidateNext) || null;
      return {
        accepted: true,
        ignored: false,
        completed: Boolean(exact),
        nextTyped: candidateNext,
        matchedAnswer: exact,
        expectedNext: null,
      };
    }

    // Wrong keystroke: determine expected next character from best matching prefix
    const activeAns = acceptedList.find((ans) => ans.startsWith(cur)) || acceptedList[0] || '';
    const expectedNext = activeAns[cur.length] || null;
    return {
      accepted: false,
      ignored: false,
      completed: false,
      nextTyped: cur,
      matchedAnswer: null,
      expectedNext,
    };
  }

  /**
   * Build display letter slots for the active answer matching `typed`.
   * @param {string} typed
   * @param {string[]} acceptedRaw
   * @returns {Array<{ char: string, state: 'typed'|'cursor'|'blank'|'space' }>}
   */
  function buildAnswerMask(typed, acceptedRaw) {
    const cur = _normPrefix(typed || '');
    const acceptedList = (acceptedRaw || []).map(_normAnswer).filter(Boolean);
    const active = acceptedList.find((ans) => ans.startsWith(cur)) || acceptedList[0] || '';
    const slots = [];
    for (let i = 0; i < active.length; i++) {
      const targetChar = active[i];
      if (targetChar === ' ') {
        slots.push({ char: ' ', state: i < cur.length ? 'typed' : 'space' });
      } else if (i < cur.length) {
        slots.push({ char: cur[i], state: 'typed' });
      } else if (i === cur.length) {
        slots.push({ char: '_', state: 'cursor' });
      } else {
        slots.push({ char: '_', state: 'blank' });
      }
    }
    return slots;
  }

  App.games.class13Questions = {
    PERIOD_DURATION_MS,
    QUESTION_TIMEOUT_MS,
    START_DISTANCE_M,
    MAX_DISTANCE_M,
    CORRECT_PUSH_M,
    WRONG_KEY_PULL_M,
    MISS_PULL_M,
    BASE_SPEED_MPS,
    SPEED_STEP_MPS,
    WIN_PERIOD,
    periodTargetScore,
    creatureSpeed,
    clampDistance,
    isTypableCard,
    buildWordPool,
    createQuestionDeck,
    evaluateKeystroke,
    buildAnswerMask,
  };
})();
