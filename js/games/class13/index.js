/**
 * 第 13 節課 (The 13th Period) — Horror Typing Survival Game (M8 core, Section 4.3).
 * - Period length: 90s; 操行分數 target = 600 + 200 * (period - 1).
 * - Distance: starts at 12m; correct +1.5m (max 12m), wrong key -0.3m, miss (8s timeout) -2.0m.
 * - Creature approaches at 0.20 + 0.05 * (period - 1) m/s, rendered as scaling SVG with missed
 *   words written in red ink across its silhouette.
 * - Question types: Meaning -> Word (Period 1+), Verb Form from data/tense.js (Period 1+),
 *   Broadcast Dialogue Cloze from data/broadcast.js (Period 2+).
 * - Per-letter multi-answer validation on physical keyboard AND on-screen App.keyboard.
 * - Auto-pauses on visibilitychange (tab hidden); respects safeMode & prefers-reduced-motion;
 *   unmount() stops every timer, rAF clock, and listener cleanly.
 * @namespace App.games.class13
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};
  App.pages = App.pages || {};

  let _root = null;
  let _clock = null;
  let _countdown = null;
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

  function mount(root) {
    _root = root;
    _cleanup();

    const { el, clear } = App.dom;
    const cardsStore = App.store && App.store.cards;
    const decksStore = App.store && App.store.decks;
    const attemptsStore = App.store && App.store.attempts;
    const leitnerStore = App.store && App.store.leitner;
    const settingsStore = App.store && App.store.settings;
    const engine = App.games && App.games.engine;
    const Q = App.games && App.games.class13Questions;
    const Creature = App.games && App.games.class13Creature;

    // ── Session & round state ────────────────────────────────────
    let phase = 'start'; // 'start' | 'countdown' | 'play' | 'period_clear' | 'blackout' | 'end'
    let selectedDeckId = decksStore ? 'd-builtin-2000' : '';
    let safeMode = settingsStore ? Boolean(settingsStore.get('safeMode')) : false;
    let warningDismissed = settingsStore ? Boolean(settingsStore.get('class13WarningDismissed')) : false;

    let sessionId = '';
    let sessionStartedAt = 0;
    let period = 1;
    let periodsSurvived = 0;
    let endlessMode = false;
    let periodScore = 0;
    let totalScore = 0;
    let periodRemainingMs = Q ? Q.PERIOD_DURATION_MS : 90000;
    let questionElapsedMs = 0;
    let distanceM = Q ? Q.START_DISTANCE_M : 12.0;
    let combo = 0;
    let totalQuestions = 0;
    let correctQuestions = 0;
    let paused = false;
    let inputLocked = false;
    let didWin = false;

    let questionDeck = null;
    let currentQ = null;
    let typed = '';
    let wrongLettersInQ = [];
    let wrongLetterCounts = new Map();
    let missedItems = []; // [{ word, displayAnswer, meaningZh, ruleZh, type, cardId, errorType, wrongLetters }]
    let feedbackMsg = '';
    let feedbackKind = ''; // 'ok' | 'bad' | ''

    // Live DOM refs updated inside rAF tick without re-rendering full DOM
    let creatureCtrl = null;
    let periodTimerEl = null;
    let qTimerFillEl = null;
    let playStageEl = null;

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
      // Force reflow only when supported in browser DOM
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
      currentQ = questionDeck ? questionDeck.next(period) : null;
      typed = '';
      wrongLettersInQ = [];
      questionElapsedMs = 0;
      inputLocked = false;
      render();
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
      inputLocked = true;
      periodsSurvived = Math.max(periodsSurvived, period);
      phase = 'period_clear';
      _announce(_t('class13.period_clear', { p: period }));
      render();
    }

    function _triggerLose() {
      if (_clock) {
        _clock.stop();
        _clock = null;
      }
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
        },
      });
      sessionId = ''; // avoid double-recording
    }

    function _startPeriodClock() {
      if (_clock) _clock.stop();
      if (!engine) return;
      const speed = Q.creatureSpeed(period);
      _clock = engine.createClock({
        onTick: (dtMs) => {
          if (phase !== 'play' || paused) return;
          periodRemainingMs = Math.max(0, periodRemainingMs - dtMs);
          if (!inputLocked) {
            questionElapsedMs += dtMs;
            distanceM = Q.clampDistance(distanceM - (speed * (dtMs / 1000)));
          }

          if (periodTimerEl) {
            periodTimerEl.textContent = `${Math.ceil(periodRemainingMs / 1000)}s`;
          }
          if (qTimerFillEl) {
            const qPct = Math.max(0, Math.min(100, Math.round((1 - questionElapsedMs / Q.QUESTION_TIMEOUT_MS) * 100)));
            qTimerFillEl.style.width = `${qPct}%`;
          }
          if (creatureCtrl) {
            creatureCtrl.update(distanceM, missedItems.map((m) => m.displayAnswer), { safeMode });
          }

          if (distanceM <= 0) {
            _triggerLose();
            return;
          }
          if (!inputLocked && questionElapsedMs >= Q.QUESTION_TIMEOUT_MS) {
            _handleQuestionTimeout();
            return;
          }
          if (periodRemainingMs <= 0) {
            if (periodScore >= Q.periodTargetScore(period)) {
              _advancePeriod();
            } else {
              _triggerLose();
            }
          }
        },
        onPause: () => {
          paused = true;
          render();
        },
      });
      _clock.start();
    }

    function _handleKey(rawKey) {
      if (phase !== 'play' || paused || inputLocked || !currentQ) return;
      const res = Q.evaluateKeystroke(typed, rawKey, currentQ.accepted);
      if (res.ignored) return;

      if (res.accepted) {
        typed = res.nextTyped;
        if (res.completed) {
          inputLocked = true;
          combo++;
          const scored = engine
            ? engine.scoreCorrect(questionElapsedMs, Q.QUESTION_TIMEOUT_MS, combo)
            : { points: 100, isCombo: false };
          periodScore += scored.points;
          totalScore += scored.points;
          distanceM = Q.clampDistance(distanceM + Q.CORRECT_PUSH_M);
          if (engine) engine.setHudScore(`${_t('wall.score_label')} ${totalScore}`);

          _logQuestionOutcome(currentQ, true, null, res.matchedAnswer);
          feedbackMsg = _t('class13.correct_msg', { pts: scored.points });
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
          return;
        }
        render();
        return;
      }

      // Wrong keystroke: -0.3m, record mistyped letter, subtle shake
      combo = 0;
      distanceM = Q.clampDistance(distanceM - Q.WRONG_KEY_PULL_M);
      _recordWrongLetter(res.expectedNext || rawKey);
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
        if (phase !== 'play' || paused || inputLocked) return;
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const tag = ev.target && ev.target.tagName ? ev.target.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (ev.key === 'Backspace' || ev.key === ' ' || ev.key === "'" || ev.key === '-' || /^[a-zA-Z]$/.test(ev.key)) {
          ev.preventDefault();
          _handleKey(ev.key);
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', _keydownHandler);
      }
    }

    function _beginPeriod(periodNum) {
      period = periodNum;
      periodScore = 0;
      periodRemainingMs = Q.PERIOD_DURATION_MS;
      questionElapsedMs = 0;
      paused = false;
      inputLocked = false;
      feedbackMsg = '';
      feedbackKind = '';
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

      sessionId = 'c13-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
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
        _beginPeriod(1);
        return;
      }

      phase = 'countdown';
      const holder = el('div');
      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [holder])
      );
      _countdown = engine.runCountdown(holder, {
        stepMs: 360,
        onDone: () => _beginPeriod(1),
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
      periodTimerEl = el('span', { className: 'c13-pill', 'data-c13-timer': 'true', text: `${Math.ceil(periodRemainingMs / 1000)}s` });
      const qPct = Math.max(0, Math.min(100, Math.round((1 - questionElapsedMs / Q.QUESTION_TIMEOUT_MS) * 100)));
      qTimerFillEl = el('div', { className: 'c13-qtimer-fill', style: `width: ${qPct}%;` });

      const topBar = el('div', { className: 'c13-topbar' }, [
        el('div', { className: 'c13-topbar-left' }, [
          el('span', { className: 'c13-pill', 'data-c13-period': 'true', text: _t('class13.period_label', { p: period }) }),
          periodTimerEl,
          el('span', { className: 'c13-pill', 'data-c13-target-score': 'true', text: _t('class13.conduct_score', { cur: periodScore, target: targetScore }) }),
          combo >= 3 ? el('span', { className: 'c13-combo-pill', text: _t('game.combo', { n: combo }) }) : null,
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

      const slots = currentQ ? Q.buildAnswerMask(typed, currentQ.accepted) : [];
      const slotsEl = el('div', { className: 'c13-slots', 'data-c13-slots': 'true', 'aria-live': 'polite' }, slots.map((s) =>
        el('span', {
          className: `c13-slot c13-slot--${s.state}`,
          text: s.state === 'space' ? '\u00A0' : s.char,
        })
      ));

      const projector = currentQ
        ? el('section', {
          className: 'c13-projector' + (currentQ.isHard ? ' is-hard' : ''),
          'data-c13-question-type': currentQ.type,
        }, [
          el('div', { className: 'c13-qtimer-track' }, [qTimerFillEl]),
          el('div', { className: 'c13-proj-head' }, [
            el('span', { className: `skill-tab skill-tab--${currentQ.skill}`, text: _t(`skill.${currentQ.skill}`) }),
            currentQ.isHard ? el('span', { className: 'c13-hard-tag', text: _t('class13.hard_word') }) : null,
          ]),
          currentQ.promptSub ? el('div', { className: 'c13-proj-sub', text: currentQ.promptSub }) : null,
          el('div', { className: 'c13-proj-main', 'data-c13-prompt': 'true', text: currentQ.promptMain }),
          slotsEl,
          feedbackMsg
            ? el('div', { className: `c13-feedback c13-feedback--${feedbackKind}`, text: feedbackMsg })
            : el('div', { className: 'c13-feedback text-muted', text: _t('class13.type_hint') }),
        ])
        : null;

      const keyboardEl = App.keyboard
        ? App.keyboard.create({ onKey: (ch) => _handleKey(ch) })
        : null;

      playStageEl = el('div', { className: 'c13-stage' }, [
        creatureCtrl ? creatureCtrl.root : null,
        projector,
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
      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('section', { className: 'state-box c13-clear-box', 'data-c13-period-clear': 'true' }, [
          el('div', { className: 'stamp', text: reachedWin ? _t('class13.stamp_win') : _t('class13.stamp_period', { p: period }) }),
          el('h1', { className: 'page-title', style: 'margin: var(--space-3) 0 var(--space-2);', text: reachedWin ? _t('class13.win_title') : _t('class13.period_clear', { p: period }) }),
          el('p', { className: 'text-muted', text: _t('class13.period_summary', { score: totalScore, dist: distanceM.toFixed(1) }) }),
          el('div', { className: 'c13-start-actions', style: 'justify-content: center; margin-top: var(--space-4);' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              'data-c13-next-period': 'true',
              onClick: () => {
                if (reachedWin) endlessMode = true;
                _beginPeriod(nextP);
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
      handleKey: _handleKey,
      triggerTimeout: _handleQuestionTimeout,
      getState: () => ({
        phase,
        period,
        periodsSurvived,
        periodScore,
        totalScore,
        distanceM,
        combo,
        paused,
        inputLocked,
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
