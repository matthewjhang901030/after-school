/**
 * 第 13 節課 (The 13th Period) — Complete Horror Typing Survival Game (M8 Parts a–e, Section 4.3).
 * - Fixed-timestep simulation (50 ms steps) inside requestAnimationFrame (auto-pauses on tab hide).
 * - Period length: 90s; 操行分數 target = 600 + 200 * (period - 1).
 * - Distance: starts at 12m; correct +1.5m (max 12m), wrong key -0.3m, miss (8s timeout; 12s in safeMode) -2.0m.
 * - Content mix: Meaning -> Word (P1+), Verb Form from data/tense.js (P1+), Broadcast Cloze from
 *   data/broadcast.js (P2+), Audio-only vocab (P3+ or cr-audio rule).
 * - Special mechanics (pure logic in supplies.js / atmosphere.js):
 *   Supply crates (bell / slow / fluid / flashlight, keys 1/2/3), Key Rot (3s lock, cap 3),
 *   Shuffled keyboard from Period 3, PA announcements, 扭蛋機 class-rules gacha (data/class-rules.js).
 * - 安心模式 (safeMode): slower (0.7x speed, 12s timeout), readable, zero horror/audio/flicker/shake/rot/scramble.
 * - Full keyboard accessibility (typing, 1/2/3 supplies, Escape pause, Enter advance) & prefers-reduced-motion.
 * @namespace App.games.class13
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};
  App.pages = App.pages || {};

  const FIXED_STEP_MS = 50;
  const SAFE_MODE_SPEED_MULT = 0.70;
  const SAFE_MODE_TIMEOUT_MS = 12000;

  let _root = null;
  let _clock = null;
  let _countdown = null;
  let _atmosphere = null;
  let _timers = [];
  let _keydownHandler = null;

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _announce(msg) {
    const el = typeof document !== 'undefined' ? document.getElementById('announcer') : null;
    if (el) el.textContent = String(msg || '');
  }

  function _addTimer(fn, ms) {
    const id = setTimeout(() => {
      _timers = _timers.filter((t) => t !== id);
      fn();
    }, ms);
    _timers.push(id);
    return id;
  }

  function _clearTimers() {
    for (const id of _timers) clearTimeout(id);
    _timers = [];
  }

  function _cleanup() {
    _clearTimers();
    if (_countdown) {
      _countdown.cancel();
      _countdown = null;
    }
    if (_clock) {
      _clock.stop();
      _clock = null;
    }
    if (_atmosphere) {
      _atmosphere.destroy();
      _atmosphere = null;
    }
    if (_keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }
    if (App.router && typeof App.router.clearGuard === 'function') {
      App.router.clearGuard();
    }
    if (App.games && App.games.engine) {
      App.games.engine.setHudScore('');
    }
  }

  function _reducedMotion() {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function _hasTts() {
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  }

  function mount(root) {
    _root = root;
    _cleanup();

    const { el } = App.dom;
    const cardsStore = App.store && App.store.cards;
    const decksStore = App.store && App.store.decks;
    const attemptsStore = App.store && App.store.attempts;
    const leitnerStore = App.store && App.store.leitner;
    const settingsStore = App.store && App.store.settings;
    const engine = App.games && App.games.engine;
    const Q = App.games && App.games.class13Questions;
    const Creature = App.games && App.games.class13Creature;
    const Supplies = App.games && App.games.class13Supplies;
    const Atmo = App.games && App.games.class13Atmosphere;

    // ── Session & round state ────────────────────────────────────
    let phase = 'start'; // 'start' | 'countdown' | 'play' | 'period_clear' | 'blackout' | 'end'
    let selectedDeckId = decksStore ? 'd-builtin-2000' : '';
    let safeMode = settingsStore ? Boolean(settingsStore.get('safeMode')) : false;
    let warningDismissed = settingsStore ? Boolean(settingsStore.get('class13WarningDismissed')) : false;

    let sessionId = '';
    let sessionSeed = 13;
    let sessionStartedAt = 0;
    let period = 1;
    let periodsSurvived = 0;
    let endlessMode = false;
    let periodScore = 0;
    let totalScore = 0;
    let periodRemainingMs = Q ? Q.PERIOD_DURATION_MS : 90000;
    let questionElapsedMs = 0;
    let stepAccumMs = 0;
    let distanceM = Q ? Q.START_DISTANCE_M : 12.0;
    let combo = 0;
    let totalQuestions = 0;
    let correctQuestions = 0;
    let paused = false;
    let inputLocked = false;
    let didWin = false;

    let questionDeck = null;
    let keyRot = Supplies ? Supplies.createKeyRotState() : null;
    let supplyCtrl = Supplies ? Supplies.createSupplyState() : null;
    let activeRule = null;
    let pendingNextRule = null;
    let usedRuleIds = [];
    let paBannerText = '';

    let currentQ = null;
    let audioHintRevealed = false;
    let typed = '';
    let wrongLettersInQ = [];
    let wrongLetterCounts = new Map();
    let missedItems = [];
    let feedbackMsg = '';
    let feedbackKind = '';

    // Live DOM refs updated during fixed-timestep tick without full re-render
    let creatureCtrl = null;
    let periodTimerEl = null;
    let qTimerFillEl = null;
    let playStageEl = null;
    let effectStatusEl = null;

    function _effectiveQuestionTimeoutMs() {
      const ruleMs = activeRule && activeRule.effects && activeRule.effects.questionTimeoutMs;
      if (safeMode) return Math.max(SAFE_MODE_TIMEOUT_MS, ruleMs || 0);
      return ruleMs || (Q ? Q.QUESTION_TIMEOUT_MS : 8000);
    }

    function _effectiveCreatureSpeed() {
      let spd = Q ? Q.creatureSpeed(period) : 0.20;
      if (safeMode) spd *= SAFE_MODE_SPEED_MULT;
      if (activeRule && activeRule.effects && activeRule.effects.speedMult) {
        spd *= activeRule.effects.speedMult;
      }
      if (supplyCtrl) spd *= supplyCtrl.getSpeedMultiplier();
      return spd;
    }

    function _isScrambledKeyboard() {
      return period >= 3 && !safeMode;
    }

    function _ruleTitle(rule) {
      if (!rule) return '';
      const isEn = App.i18n && App.i18n.lang() === 'en';
      return isEn ? rule.titleEn : rule.titleZh;
    }

    function _ruleDesc(rule) {
      if (!rule) return '';
      const isEn = App.i18n && App.i18n.lang() === 'en';
      return isEn ? rule.descEn : rule.descZh;
    }

    function _setGuardActive(active) {
      if (!App.router) return;
      if (active && typeof App.router.setGuard === 'function') {
        App.router.setGuard(() => _t('app.exit_confirm'));
      } else if (!active && typeof App.router.clearGuard === 'function') {
        App.router.clearGuard();
      }
    }

    function _getRecentWrongIds() {
      if (!attemptsStore || typeof attemptsStore.getAll !== 'function') return [];
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const ids = [];
      for (const a of attemptsStore.getAll()) {
        if (a && !a.correct && a.cardId && a.ts >= cutoff) ids.push(a.cardId);
      }
      return ids;
    }

    function _recordWrongLetter(letter) {
      const ch = String(letter || '').toLowerCase();
      if (!ch || ch === ' ') return;
      wrongLettersInQ.push(ch);
      wrongLetterCounts.set(ch, (wrongLetterCounts.get(ch) || 0) + 1);
    }

    function _triggerShake() {
      if (safeMode || _reducedMotion() || !playStageEl) return;
      playStageEl.classList.remove('is-shaking');
      void playStageEl.offsetWidth;
      playStageEl.classList.add('is-shaking');
      _addTimer(() => {
        if (playStageEl) playStageEl.classList.remove('is-shaking');
      }, 260);
    }

    function _logQuestionOutcome(q, correct, errorType, userAnswer) {
      totalQuestions++;
      if (correct) correctQuestions++;
      if (attemptsStore) {
        attemptsStore.record({
          source: 'class13',
          sessionId,
          cardId: q.cardId || null,
          itemId: q.displayAnswer,
          skill: q.skill || 'vocab',
          correct: Boolean(correct),
          userAnswer: userAnswer || null,
          expected: q.displayAnswer,
          errorType: correct ? null : (errorType || 'spelling'),
          wrongLetters: wrongLettersInQ.slice(),
          ms: Math.round(questionElapsedMs),
        });
      }
      if (q.cardId && leitnerStore) {
        leitnerStore.recordGameResult(q.cardId, 'class13', Boolean(correct));
      }
    }

    function _nextQuestion() {
      const eff = (activeRule && activeRule.effects) || {};
      currentQ = questionDeck ? questionDeck.next(period, {
        hardEvery: eff.hardEvery || 6,
        forceAudioOnly: Boolean(eff.audioOnlyVocab),
        ttsAvailable: _hasTts(),
        safeMode,
      }) : null;
      audioHintRevealed = false;
      typed = '';
      wrongLettersInQ = [];
      questionElapsedMs = 0;
      inputLocked = false;
      if (currentQ && currentQ.audioOnly && App.audio && App.audio.tts && typeof App.audio.tts.speak === 'function') {
        try { App.audio.tts.speak(currentQ.word); } catch (_e) { /* ignore */ }
      }
      render();
    }

    function _completeCurrentWord(matchedAnswer) {
      inputLocked = true;
      combo++;
      const eff = (activeRule && activeRule.effects) || {};
      const comboThresh = eff.comboThreshold || 3;
      const timeoutMs = _effectiveQuestionTimeoutMs();
      const baseScored = engine
        ? engine.scoreCorrect(questionElapsedMs, timeoutMs, combo >= comboThresh ? Math.max(combo, 3) : 1)
        : { points: 100 };
      let pts = baseScored.points;
      if (eff.scoreMult) pts = Math.round(pts * eff.scoreMult);
      if (eff.bonusPoints && currentQ && currentQ.audioOnly) pts += eff.bonusPoints;

      periodScore += pts;
      totalScore += pts;
      distanceM = Q.clampDistance(distanceM + Q.CORRECT_PUSH_M);
      if (engine) engine.setHudScore(`${_t('wall.score_label')} ${totalScore}`);
      if (_atmosphere) _atmosphere.playChime(true);

      _logQuestionOutcome(currentQ, true, null, matchedAnswer);

      let supplyNote = '';
      if (currentQ && currentQ.isHard && supplyCtrl) {
        const granted = supplyCtrl.grantRandom();
        if (granted) {
          supplyNote = ' · ' + _t('class13.supply_got', { name: _t(granted.labelKey) });
        }
      }

      feedbackMsg = _t('class13.correct_msg', { pts }) + supplyNote;
      feedbackKind = 'ok';
      _announce(feedbackMsg);

      if (creatureCtrl) {
        creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
      }

      if (periodScore >= Q.periodTargetScore(period)) {
        _advancePeriod();
        return;
      }
      render();
      _addTimer(() => {
        if (phase === 'play' && !paused) _nextQuestion();
      }, 220);
    }

    function _handleQuestionTimeout() {
      if (phase !== 'play' || inputLocked || !currentQ) return;
      inputLocked = true;
      combo = 0;
      distanceM = Q.clampDistance(distanceM - Q.MISS_PULL_M);
      const missedQ = currentQ;
      missedItems.push({
        word: missedQ.word,
        displayAnswer: missedQ.displayAnswer,
        meaningZh: missedQ.meaningZh,
        ruleZh: missedQ.ruleZh,
        type: missedQ.type,
        cardId: missedQ.cardId,
        errorType: 'timeout',
        wrongLetters: wrongLettersInQ.slice(),
      });
      _logQuestionOutcome(missedQ, false, 'timeout', typed);
      if (_atmosphere) _atmosphere.playChime(false);
      feedbackMsg = _t('class13.missed_timeout', { ans: missedQ.displayAnswer });
      feedbackKind = 'bad';
      _announce(feedbackMsg);

      if (creatureCtrl) {
        creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
      }
      if (distanceM <= 0) {
        _triggerLose();
        return;
      }
      render();
      _addTimer(() => {
        if (phase === 'play' && !paused) _nextQuestion();
      }, 420);
    }

    function _advancePeriod() {
      if (_clock) {
        _clock.stop();
        _clock = null;
      }
      if (_atmosphere) _atmosphere.stop();
      if (keyRot) keyRot.healAll();
      if (supplyCtrl) supplyCtrl.resetEffects();
      inputLocked = true;
      periodsSurvived = Math.max(periodsSurvived, period);

      // Pull a random 扭蛋機 class rule for the upcoming period
      pendingNextRule = Supplies
        ? Supplies.pickClassRule(usedRuleIds, { ttsAvailable: _hasTts(), safeMode })
        : null;
      if (pendingNextRule) usedRuleIds.push(pendingNextRule.id);

      phase = 'period_clear';
      _announce(_t('class13.period_clear', { p: period }));
      render();
    }

    function _triggerLose() {
      if (_clock) {
        _clock.stop();
        _clock = null;
      }
      if (_atmosphere) _atmosphere.stop();
      inputLocked = true;
      didWin = false;
      _saveCompletedSession();

      if (safeMode || _reducedMotion()) {
        phase = 'end';
        _setGuardActive(false);
        render();
        return;
      }
      phase = 'blackout';
      render();
      _addTimer(() => {
        if (!_root) return;
        phase = 'end';
        _setGuardActive(false);
        render();
      }, 600);
    }

    function _finishWinOrStop(won) {
      if (_clock) {
        _clock.stop();
        _clock = null;
      }
      if (_atmosphere) _atmosphere.stop();
      inputLocked = true;
      didWin = Boolean(won);
      _saveCompletedSession();
      phase = 'end';
      _setGuardActive(false);
      render();
    }

    function _saveCompletedSession() {
      if (!attemptsStore || !sessionId) return;
      const accuracy = totalQuestions > 0 ? (correctQuestions / totalQuestions) : 0;
      attemptsStore.recordSession({
        id: sessionId,
        source: 'class13',
        startedAt: sessionStartedAt,
        endedAt: Date.now(),
        score: totalScore,
        accuracy,
        details: {
          periodsSurvived,
          won: didWin,
          missedCount: missedItems.length,
          safeMode,
        },
      });
      sessionId = '';
    }

    function _useSupply(slotIdx) {
      if (phase !== 'play' || paused || inputLocked || !supplyCtrl || !currentQ) return false;
      const res = supplyCtrl.useSlot(slotIdx, {
        distanceM,
        maxDistance: Q.MAX_DISTANCE_M,
        typed,
        accepted: currentQ.accepted,
      });
      if (!res.used) return false;

      if (res.item.id === 'fluid' && typeof res.nextDistanceM === 'number') {
        distanceM = Q.clampDistance(res.nextDistanceM);
        feedbackMsg = _t('class13.supply_used_fluid');
      } else if (res.item.id === 'bell') {
        feedbackMsg = _t('class13.supply_used_bell');
      } else if (res.item.id === 'slow') {
        feedbackMsg = _t('class13.supply_used_slow');
      } else if (res.item.id === 'flashlight' && res.revealLetters) {
        feedbackMsg = _t('class13.supply_used_flashlight', { letters: res.revealLetters });
        for (const ch of res.revealLetters) {
          const stepRes = Q.evaluateKeystroke(typed, ch, currentQ.accepted);
          if (stepRes.accepted) {
            typed = stepRes.nextTyped;
            if (stepRes.completed) {
              _completeCurrentWord(stepRes.matchedAnswer);
              return true;
            }
          }
        }
      }

      feedbackKind = 'ok';
      _announce(feedbackMsg);
      if (creatureCtrl) creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
      render();
      return true;
    }

    function _updateLiveHud() {
      const timeoutMs = _effectiveQuestionTimeoutMs();
      if (periodTimerEl) {
        periodTimerEl.textContent = `${Math.ceil(periodRemainingMs / 1000)}s`;
      }
      if (qTimerFillEl) {
        const qPct = Math.max(0, Math.min(100, Math.round((1 - questionElapsedMs / timeoutMs) * 100)));
        qTimerFillEl.style.width = `${qPct}%`;
      }
      if (effectStatusEl && supplyCtrl) {
        const ss = supplyCtrl.getState();
        const tags = [];
        if (ss.isFrozen) tags.push(_t('class13.effect_frozen', { s: Math.ceil(ss.freezeMs / 1000) }));
        if (ss.isSlowed) tags.push(_t('class13.effect_slowed', { s: Math.ceil(ss.slowMs / 1000) }));
        effectStatusEl.textContent = tags.join(' · ');
      }
      if (creatureCtrl) {
        creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
      }
    }

    /**
     * Pure fixed-timestep simulation step (50 ms increments).
     * Decoupled from frame rate and testable deterministically.
     * @param {number} stepMs
     */
    function _stepSimulation(stepMs) {
      if (phase !== 'play' || paused) return;

      periodRemainingMs = Math.max(0, periodRemainingMs - stepMs);
      if (supplyCtrl) supplyCtrl.tick(stepMs);

      const rotChanged = keyRot ? keyRot.tick(stepMs) : false;
      const speed = _effectiveCreatureSpeed();
      const timeoutMs = _effectiveQuestionTimeoutMs();

      if (!inputLocked) {
        questionElapsedMs += stepMs;
        distanceM = Q.clampDistance(distanceM - (speed * (stepMs / 1000)));
      }

      if (_atmosphere) {
        const frozen = supplyCtrl ? supplyCtrl.getState().isFrozen : false;
        _atmosphere.tick(stepMs, distanceM, { frozen });
      }

      _updateLiveHud();

      if (distanceM <= 0) {
        _triggerLose();
        return;
      }
      if (!inputLocked && questionElapsedMs >= timeoutMs) {
        _handleQuestionTimeout();
        return;
      }
      if (periodRemainingMs <= 0) {
        if (periodScore >= Q.periodTargetScore(period)) {
          _advancePeriod();
        } else {
          _triggerLose();
        }
        return;
      }
      if (rotChanged) render();
    }

    function _startPeriodClock() {
      if (_clock) _clock.stop();
      if (!engine) return;
      stepAccumMs = 0;
      _clock = engine.createClock({
        onTick: (dtMs) => {
          if (phase !== 'play' || paused) return;
          stepAccumMs += Math.min(250, Math.max(0, dtMs));
          while (stepAccumMs >= FIXED_STEP_MS && phase === 'play' && !paused) {
            stepAccumMs -= FIXED_STEP_MS;
            _stepSimulation(FIXED_STEP_MS);
          }
        },
        onPause: () => {
          paused = true;
          if (_atmosphere) _atmosphere.stop();
          render();
        },
      });
      _clock.start();
    }

    function _handleKey(rawKey) {
      if (phase !== 'play' || paused || inputLocked || !currentQ) return;

      // Supply hotkeys 1 / 2 / 3
      if (/^[123]$/.test(String(rawKey))) {
        _useSupply(Number(rawKey) - 1);
        return;
      }

      // Check if physical key is currently locked by Key Rot
      if (keyRot && keyRot.isLocked(rawKey)) {
        feedbackMsg = _t('class13.key_locked', { key: String(rawKey).toUpperCase() });
        feedbackKind = 'bad';
        _announce(feedbackMsg);
        render();
        return;
      }

      const res = Q.evaluateKeystroke(typed, rawKey, currentQ.accepted);
      if (res.ignored) return;

      if (res.accepted) {
        typed = res.nextTyped;
        if (res.completed) {
          _completeCurrentWord(res.matchedAnswer);
          return;
        }
        render();
        return;
      }

      // Wrong keystroke: -0.3m, record mistyped letter, trigger Key Rot (unless safeMode/immune), subtle shake
      combo = 0;
      distanceM = Q.clampDistance(distanceM - Q.WRONG_KEY_PULL_M);
      _recordWrongLetter(res.expectedNext || rawKey);
      const rotImmune = safeMode || Boolean(activeRule && activeRule.effects && activeRule.effects.rotImmune);
      if (keyRot && !rotImmune) {
        keyRot.rot(rawKey, { immune: false });
      }
      if (_atmosphere) _atmosphere.playChime(false);
      feedbackMsg = _t('class13.wrong_key_msg');
      feedbackKind = 'bad';
      _triggerShake();
      if (creatureCtrl) {
        creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
      }
      if (distanceM <= 0) {
        _triggerLose();
        return;
      }
      render();
    }

    function _bindPhysicalKeyboard() {
      if (_keydownHandler && typeof window !== 'undefined') {
        window.removeEventListener('keydown', _keydownHandler);
      }
      _keydownHandler = (ev) => {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const tag = ev.target && ev.target.tagName ? ev.target.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (ev.key === 'Escape' && phase === 'play') {
          ev.preventDefault();
          if (_clock && !paused) _clock.pause();
          else if (_clock && paused) { paused = false; _clock.resume(); render(); }
          return;
        }

        if (ev.key === 'Enter' && phase === 'period_clear') {
          ev.preventDefault();
          if (period >= Q.WIN_PERIOD && !endlessMode) endlessMode = true;
          _beginPeriod(period + 1, pendingNextRule);
          return;
        }

        if (phase !== 'play' || paused || inputLocked) return;

        if (
          ev.key === 'Backspace' || ev.key === ' ' || ev.key === "'" || ev.key === '-'
          || /^[a-zA-Z123]$/.test(ev.key)
        ) {
          ev.preventDefault();
          _handleKey(ev.key);
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', _keydownHandler);
      }
    }

    function _beginPeriod(periodNum, nextRule) {
      period = periodNum;
      activeRule = nextRule || null;
      pendingNextRule = null;
      periodScore = 0;
      periodRemainingMs = Q.PERIOD_DURATION_MS;
      questionElapsedMs = 0;
      stepAccumMs = 0;
      paused = false;
      inputLocked = false;
      feedbackMsg = '';
      feedbackKind = '';

      if (keyRot) keyRot.healAll();
      if (supplyCtrl) {
        supplyCtrl.resetEffects();
        const ruleCap = activeRule && activeRule.effects && activeRule.effects.supplyCap;
        supplyCtrl.setCap(ruleCap || Supplies.DEFAULT_SUPPLY_CAP);
        if (activeRule && activeRule.effects && activeRule.effects.grantSupply) {
          supplyCtrl.grantRandom();
        }
      }

      paBannerText = _atmosphere
        ? _atmosphere.announcePeriod(period)
        : _t('class13.intro_announcement');

      phase = 'play';
      _setGuardActive(true);
      _bindPhysicalKeyboard();
      creatureCtrl = Creature ? Creature.create({ maxDistance: Q.MAX_DISTANCE_M }) : null;
      _nextQuestion();
      _startPeriodClock();
    }

    function _startSession(opts) {
      const o = opts || {};
      _clearTimers();
      if (_countdown) { _countdown.cancel(); _countdown = null; }
      if (_clock) { _clock.stop(); _clock = null; }
      if (_atmosphere) { _atmosphere.destroy(); _atmosphere = null; }

      if (Atmo) {
        _atmosphere = Atmo.create();
        _atmosphere.unlock(safeMode);
      }

      const allCards = cardsStore ? cardsStore.getAll({ includeHidden: false }) : [];
      const deckCardIds = decksStore && selectedDeckId ? decksStore.getCardIds(selectedDeckId) : null;
      const confPairs = engine && typeof engine.getConfusionPairs === 'function' ? engine.getConfusionPairs(20) : [];
      const confusionWords = [];
      for (const p of confPairs) {
        if (p.wordA) confusionWords.push(p.wordA);
        if (p.wordB) confusionWords.push(p.wordB);
      }

      const wordPool = Q.buildWordPool(allCards, {
        deckCardIds,
        recentWrongIds: _getRecentWrongIds(),
        progressMap: leitnerStore ? leitnerStore.getAll() : {},
        today: App.date ? App.date.todayKey() : '',
        confusionWords,
      });

      questionDeck = Q.createQuestionDeck({
        wordPool,
        tenseItems: (App.data && App.data.tense) || [],
        broadcastItems: (App.data && App.data.broadcast) || [],
      });

      keyRot = Supplies ? Supplies.createKeyRotState() : null;
      supplyCtrl = Supplies ? Supplies.createSupplyState() : null;
      activeRule = null;
      pendingNextRule = null;
      usedRuleIds = [];

      sessionId = 'c13-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      sessionSeed = Date.now() % 10000;
      sessionStartedAt = Date.now();
      period = 1;
      periodsSurvived = 0;
      endlessMode = false;
      totalScore = 0;
      distanceM = Q.START_DISTANCE_M;
      combo = 0;
      totalQuestions = 0;
      correctQuestions = 0;
      missedItems = [];
      wrongLetterCounts = new Map();
      didWin = false;

      if (engine) engine.setHudScore(`${_t('wall.score_label')} 0`);

      if (o.skipCountdown || !engine) {
        _beginPeriod(1, null);
        return;
      }

      phase = 'countdown';
      const holder = el('div');
      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [holder])
      );
      _countdown = engine.runCountdown(holder, {
        stepMs: 360,
        onDone: () => _beginPeriod(1, null),
      });
    }

    function _openAiExplain() {
      if (!missedItems.length) return;
      const item = missedItems[0];
      const facts = {
        game: 'class13',
        cardId: item.cardId || null,
        word: item.displayAnswer,
        expected: item.displayAnswer,
        meaningZh: item.meaningZh || '',
        errorType: item.errorType || 'spelling',
        wrongLetters: item.wrongLetters || [],
      };
      const launch = () => {
        if (App.aiPanel && typeof App.aiPanel.openModal === 'function') {
          App.aiPanel.openModal(facts, { title: _t('ai.panel_title') });
        }
      };
      if (App.aiPanel) {
        launch();
      } else if (App.loadScripts) {
        App.loadScripts(['js/ui/ai-panel.js']).then(launch).catch(() => {
          if (App.toast) App.toast.show(_t('error.load'));
        });
      }
    }

    function _renderStart() {
      const decks = decksStore ? decksStore.getAll() : [];
      const best = engine ? engine.getBestScore('class13') : null;

      const warningBox = !warningDismissed
        ? el('div', { className: 'c13-warning-box', 'data-c13-warning': 'true' }, [
          el('div', { className: 'c13-warning-title', text: _t('class13.warning_title') }),
          el('p', { className: 'text-small', style: 'margin: 4px 0 8px;', text: _t('class13.warning_desc') }),
          el('label', { className: 'c13-check-row text-small' }, [
            el('input', {
              type: 'checkbox',
              checked: warningDismissed,
              onChange: (ev) => {
                warningDismissed = Boolean(ev.target.checked);
                if (settingsStore) settingsStore.update({ class13WarningDismissed: warningDismissed });
              },
            }),
            el('span', { text: _t('class13.warning_dismiss') }),
          ]),
        ])
        : null;

      const safeToggle = el('label', { className: 'c13-check-row text-small' }, [
        el('input', {
          type: 'checkbox',
          checked: safeMode,
          'data-c13-safe-toggle': 'true',
          onChange: (ev) => {
            safeMode = Boolean(ev.target.checked);
            if (settingsStore) settingsStore.update({ safeMode });
          },
        }),
        el('span', { text: _t('class13.safe_mode_label') }),
      ]);

      const deckPicker = decks.length > 1
        ? el('div', { className: 'c13-deck-row' }, [
          el('label', { className: 'text-small text-muted', htmlFor: 'c13-deck-select', text: _t('guess.choose_deck') }),
          el('select', {
            id: 'c13-deck-select',
            className: 'input',
            onChange: (ev) => { selectedDeckId = ev.target.value; },
          }, decks.map((d) =>
            el('option', {
              value: d.id,
              selected: d.id === selectedDeckId,
              text: `${d.name} (${decksStore.getCardIds(d.id).length})`,
            })
          )),
        ])
        : null;

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: _t('games.class13.name') }),
          best !== null ? el('span', { className: 'wall-best-pill', text: `${_t('games.personal_best')} ${best}` }) : null,
        ]),
        el('section', { className: 'c13-start-hero' }, [
          el('p', { className: 'c13-broadcast-quote', text: _t('class13.intro_announcement') }),
          el('p', { className: 'text-body', style: 'margin: 0;', text: _t('class13.rules_short') }),
          el('div', { className: 'c13-rule-pills' }, [
            el('span', { className: 'c13-meta-pill', text: _t('class13.rule_period') }),
            el('span', { className: 'c13-meta-pill', text: _t('class13.rule_dist') }),
            el('span', { className: 'c13-meta-pill', text: _t('class13.rule_timeout') }),
            el('span', { className: 'c13-meta-pill', text: _t('class13.rule_win') }),
          ]),
          warningBox,
          safeToggle,
          deckPicker,
          el('div', { className: 'c13-start-actions' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              'data-c13-enter': 'true',
              onClick: () => _startSession(),
            }, [el('span', { className: 'btn-label', text: _t('class13.enter_btn') })]),
          ]),
        ]),
      ]);
    }

    function _renderPlay() {
      const targetScore = Q.periodTargetScore(period);
      const timeoutMs = _effectiveQuestionTimeoutMs();
      periodTimerEl = el('span', { className: 'c13-pill', 'data-c13-timer': 'true', text: `${Math.ceil(periodRemainingMs / 1000)}s` });
      const qPct = Math.max(0, Math.min(100, Math.round((1 - questionElapsedMs / timeoutMs) * 100)));
      qTimerFillEl = el('div', { className: 'c13-qtimer-fill', style: `width: ${qPct}%;` });

      const topBar = el('div', { className: 'c13-topbar' }, [
        el('div', { className: 'c13-topbar-left' }, [
          el('span', { className: 'c13-pill', 'data-c13-period': 'true', text: _t('class13.period_label', { p: period }) }),
          periodTimerEl,
          el('span', { className: 'c13-pill', 'data-c13-target-score': 'true', text: _t('class13.conduct_score', { cur: periodScore, target: targetScore }) }),
          combo >= (activeRule && activeRule.effects && activeRule.effects.comboThreshold ? activeRule.effects.comboThreshold : 3)
            ? el('span', { className: 'c13-combo-pill', text: _t('game.combo', { n: combo }) })
            : null,
          activeRule
            ? el('span', { className: 'c13-rule-badge', 'data-c13-active-rule': activeRule.id, text: _ruleTitle(activeRule) })
            : null,
          safeMode
            ? el('span', { className: 'c13-safe-badge', 'data-c13-safe-badge': 'true', text: _t('settings.safe_mode') })
            : null,
        ]),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          'data-c13-pause': 'true',
          onClick: () => {
            if (_clock && !paused) _clock.pause();
            else if (_clock && paused) { paused = false; _clock.resume(); render(); }
          },
        }, [el('span', { className: 'btn-label', text: paused ? _t('game.resume') : _t('game.pause') })]),
      ]);

      if (paused) {
        return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          topBar,
          el('div', { className: 'state-box', 'data-c13-paused': 'true' }, [
            el('h2', { style: 'margin: 0 0 var(--space-2);', text: _t('game.paused_title') }),
            el('p', { className: 'text-muted', text: _t('game.paused_desc') }),
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => {
                paused = false;
                if (_clock) _clock.resume();
                render();
              },
            }, [el('span', { className: 'btn-label', text: _t('game.resume') })]),
          ]),
        ]);
      }

      if (creatureCtrl) {
        creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
      }

      // PA announcement strip
      const paStrip = paBannerText
        ? el('div', { className: 'c13-pa-strip', 'data-c13-pa': 'true', text: paBannerText })
        : null;

      // Supply slots bar (keys 1 / 2 / 3)
      const supplyState = supplyCtrl ? supplyCtrl.getState() : { inventory: [], cap: 2, isFrozen: false, isSlowed: false, freezeMs: 0, slowMs: 0 };
      const activeEffects = [];
      if (supplyState.isFrozen) activeEffects.push(_t('class13.effect_frozen', { s: Math.ceil(supplyState.freezeMs / 1000) }));
      if (supplyState.isSlowed) activeEffects.push(_t('class13.effect_slowed', { s: Math.ceil(supplyState.slowMs / 1000) }));
      effectStatusEl = el('span', { className: 'c13-effect-status', 'data-c13-effect-status': 'true', text: activeEffects.join(' · ') });

      const supplySlots = [];
      for (let i = 0; i < supplyState.cap; i++) {
        const item = supplyState.inventory[i];
        if (item) {
          supplySlots.push(
            el('button', {
              type: 'button',
              className: 'btn btn-secondary c13-supply-btn',
              'data-c13-supply-slot': String(i),
              title: _t(item.descKey),
              onClick: () => _useSupply(i),
            }, [el('span', { className: 'btn-label', text: `[${i + 1}] ${_t(item.labelKey)}` })])
          );
        } else {
          supplySlots.push(
            el('span', {
              className: 'c13-supply-empty',
              'data-c13-supply-empty': String(i),
              text: `[${i + 1}] ${_t('class13.supply_empty')}`,
            })
          );
        }
      }
      const supplyBar = el('div', { className: 'c13-supply-bar', 'data-c13-supplies': 'true' }, [
        el('div', { className: 'c13-supply-slots' }, supplySlots),
        effectStatusEl,
      ]);

      const slots = currentQ ? Q.buildAnswerMask(typed, currentQ.accepted) : [];
      const slotsEl = el('div', { className: 'c13-slots', 'data-c13-slots': 'true', 'aria-live': 'polite' }, slots.map((s) =>
        el('span', {
          className: `c13-slot c13-slot--${s.state}`,
          text: s.state === 'space' ? '\u00A0' : s.char,
        })
      ));

      const audioControls = currentQ && currentQ.audioOnly
        ? el('div', { className: 'c13-audio-row' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => {
              if (App.audio && App.audio.tts) App.audio.tts.speak(currentQ.word);
            },
          }, [el('span', { className: 'btn-label', text: _t('class13.replay_audio') })]),
          !audioHintRevealed
            ? el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              onClick: () => { audioHintRevealed = true; render(); },
            }, [el('span', { className: 'btn-label', text: _t('class13.show_zh_hint') })])
            : el('span', { className: 'text-small text-muted', text: currentQ.meaningZh || '' }),
        ])
        : null;

      const projector = currentQ
        ? el('section', {
          className: 'c13-projector' + (currentQ.isHard ? ' is-hard' : ''),
          'data-c13-question-type': currentQ.type,
        }, [
          el('div', { className: 'c13-qtimer-track' }, [qTimerFillEl]),
          el('div', { className: 'c13-proj-head' }, [
            el('span', { className: `skill-tab skill-tab--${currentQ.skill}`, text: _t(`skill.${currentQ.skill}`) }),
            currentQ.isHard ? el('span', { className: 'c13-hard-tag', text: _t('class13.hard_word') }) : null,
            _isScrambledKeyboard() ? el('span', { className: 'c13-scramble-tag', 'data-c13-scrambled': 'true', text: _t('class13.kb_scrambled') }) : null,
          ]),
          currentQ.promptSub ? el('div', { className: 'c13-proj-sub', text: currentQ.promptSub }) : null,
          el('div', { className: 'c13-proj-main', 'data-c13-prompt': 'true', text: currentQ.promptMain }),
          audioControls,
          slotsEl,
          feedbackMsg
            ? el('div', { className: `c13-feedback c13-feedback--${feedbackKind}`, text: feedbackMsg })
            : el('div', { className: 'c13-feedback text-muted', text: _t('class13.type_hint') }),
        ])
        : null;

      const keyboardEl = App.keyboard
        ? App.keyboard.create({
          onKey: (ch) => _handleKey(ch),
          rottenKeys: keyRot ? keyRot.getKeys() : [],
          scrambled: _isScrambledKeyboard(),
          seed: period * 97 + sessionSeed,
        })
        : null;

      const flickerCls = !safeMode && !_reducedMotion() ? ' c13-flicker' : '';
      playStageEl = el('div', {
        className: 'c13-stage' + flickerCls,
        'data-safe-mode': safeMode ? 'true' : 'false',
      }, [
        paStrip,
        creatureCtrl ? creatureCtrl.root : null,
        projector,
        supplyBar,
        keyboardEl,
      ]);

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        topBar,
        playStageEl,
      ]);
    }

    function _renderPeriodClear() {
      const reachedWin = period >= Q.WIN_PERIOD && !endlessMode;
      const nextP = period + 1;
      const gachaCard = pendingNextRule
        ? el('div', { className: 'c13-gacha-card', 'data-c13-gacha-card': pendingNextRule.id }, [
          el('div', { className: 'c13-gacha-label', text: _t('class13.gacha_label', { p: nextP }) }),
          el('div', { className: 'c13-gacha-title', text: _ruleTitle(pendingNextRule) }),
          el('p', { className: 'text-small text-muted', style: 'margin: 4px 0 0;', text: _ruleDesc(pendingNextRule) }),
        ])
        : null;

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('section', { className: 'state-box c13-clear-box', 'data-c13-period-clear': 'true' }, [
          el('div', { className: 'stamp', text: reachedWin ? _t('class13.stamp_win') : _t('class13.stamp_period', { p: period }) }),
          el('h1', { className: 'page-title', style: 'margin: var(--space-3) 0 var(--space-2);', text: reachedWin ? _t('class13.win_title') : _t('class13.period_clear', { p: period }) }),
          el('p', { className: 'text-muted', text: _t('class13.period_summary', { score: totalScore, dist: distanceM.toFixed(1) }) }),
          gachaCard,
          el('div', { className: 'c13-start-actions', style: 'justify-content: center; margin-top: var(--space-4);' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              'data-c13-next-period': 'true',
              onClick: () => {
                if (reachedWin) endlessMode = true;
                _beginPeriod(nextP, pendingNextRule);
              },
            }, [el('span', { className: 'btn-label', text: reachedWin ? _t('class13.continue_endless') : _t('class13.next_period', { p: nextP }) })]),
            reachedWin
              ? el('button', {
                type: 'button',
                className: 'btn btn-secondary',
                onClick: () => _finishWinOrStop(true),
              }, [el('span', { className: 'btn-label', text: _t('class13.finish_win') })])
              : null,
          ]),
        ]),
      ]);
    }

    function _renderBlackout() {
      return el('main', { className: 'c13-blackout', role: 'main', id: 'main-content', 'data-c13-blackout': 'true' }, [
        el('span', { className: 'sr-only', text: _t('class13.stamp_fail') }),
      ]);
    }

    function _renderEnd() {
      const accuracyPct = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;
      const stampText = didWin || periodsSurvived >= Q.WIN_PERIOD
        ? _t('class13.stamp_win')
        : _t('class13.stamp_fail');

      const sortedWrongLetters = Array.from(wrongLetterCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const missedWordsForGuess = Array.from(new Set(
        missedItems
          .filter((m) => m.cardId && m.word)
          .map((m) => m.word)
      )).slice(0, 5);

      const mistakeListEl = missedItems.length
        ? el('section', { className: 'c13-makeup-section', 'data-class13-mistakes': 'true' }, [
          el('h2', { className: 'text-small text-muted', style: 'margin: 0 0 var(--space-2);', text: _t('class13.makeup_list') }),
          el('ul', { className: 'c13-makeup-list', role: 'list' }, missedItems.map((m) =>
            el('li', { className: 'c13-makeup-item' }, [
              el('div', {}, [
                el('strong', { text: m.displayAnswer }),
                m.meaningZh ? el('span', { className: 'text-small text-muted', style: 'margin-left: 8px;', text: m.meaningZh }) : null,
              ]),
              m.ruleZh ? el('div', { className: 'text-small text-muted', text: m.ruleZh }) : null,
            ])
          )),
        ])
        : el('p', { className: 'text-small text-muted', text: _t('class13.no_mistakes') });

      const wrongLettersEl = sortedWrongLetters.length
        ? el('section', { className: 'c13-letters-section', 'data-class13-wrong-letters': 'true' }, [
          el('h2', { className: 'text-small text-muted', style: 'margin: 0 0 var(--space-2);', text: _t('class13.most_mistyped') }),
          el('div', { className: 'c13-letter-chips' }, sortedWrongLetters.map(([ch, cnt]) =>
            el('span', { className: 'c13-letter-chip', text: `${ch.toUpperCase()} ×${cnt}` })
          )),
        ])
        : null;

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('section', { className: 'c13-end-hero', 'data-c13-end': 'true' }, [
          el('div', { className: 'stamp' + (didWin ? '' : ' c13-stamp--fail'), text: stampText }),
          el('h1', { className: 'page-title', style: 'margin: var(--space-3) 0 var(--space-1);', text: _t('class13.end_title') }),
          el('p', { className: 'text-muted', text: _t('class13.end_summary', { periods: periodsSurvived, score: totalScore, acc: accuracyPct }) }),
        ]),
        mistakeListEl,
        wrongLettersEl,
        el('div', { className: 'c13-end-actions' }, [
          missedItems.length
            ? el('button', {
              type: 'button',
              className: 'btn btn-secondary',
              'data-class13-ai-explain': 'true',
              onClick: _openAiExplain,
            }, [el('span', { className: 'btn-label', text: _t('game.ai_explain') })])
            : null,
          missedWordsForGuess.length
            ? el('a', {
              className: 'btn btn-secondary',
              href: `#/games/guess?words=${encodeURIComponent(missedWordsForGuess.join(','))}`,
            }, [el('span', { className: 'btn-label', text: _t('class13.go_guess_wrong') })])
            : null,
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            onClick: () => _startSession(),
          }, [el('span', { className: 'btn-label', text: _t('guess.play_again') })]),
          el('a', { className: 'btn btn-ghost', href: '#/games' }, [
            el('span', { className: 'btn-label', text: _t('btn.back') }),
          ]),
        ]),
      ]);
    }

    function render() {
      if (!_root) return;
      if (phase === 'start') _root.replaceChildren(_renderStart());
      else if (phase === 'play') _root.replaceChildren(_renderPlay());
      else if (phase === 'period_clear') _root.replaceChildren(_renderPeriodClear());
      else if (phase === 'blackout') _root.replaceChildren(_renderBlackout());
      else if (phase === 'end') _root.replaceChildren(_renderEnd());
    }

    render();

    return {
      startSession: _startSession,
      beginPeriod: _beginPeriod,
      handleKey: _handleKey,
      useSupply: _useSupply,
      grantSupply: (id) => (supplyCtrl ? supplyCtrl.grantRandom(id) : null),
      triggerTimeout: _handleQuestionTimeout,
      stepSimulation: (ms) => {
        let rem = Math.max(0, Number(ms) || 0);
        while (rem >= FIXED_STEP_MS && phase === 'play' && !paused) {
          rem -= FIXED_STEP_MS;
          _stepSimulation(FIXED_STEP_MS);
        }
      },
      getState: () => ({
        phase,
        period,
        periodsSurvived,
        periodScore,
        totalScore,
        distanceM,
        combo,
        paused,
        safeMode,
        inputLocked,
        scrambled: _isScrambledKeyboard(),
        effectiveTimeoutMs: _effectiveQuestionTimeoutMs(),
        effectiveSpeed: _effectiveCreatureSpeed(),
        activeRule,
        pendingNextRule,
        rottenKeys: keyRot ? keyRot.getKeys() : [],
        supplies: supplyCtrl ? supplyCtrl.getState() : null,
        currentQ,
        typed,
        missedItems: missedItems.slice(),
        wrongLetterCounts: Object.fromEntries(wrongLetterCounts.entries()),
      }),
    };
  }

  function unmount() {
    _cleanup();
    _root = null;
  }

  App.games.class13 = { mount, unmount };
  App.pages.class13 = App.games.class13;
})();
