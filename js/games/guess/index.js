/**
 * 你說我猜 (You describe, AI guesses) — Taboo-style semantic guessing game (M7, Section 4.4).
 * - One session = 5 cards (concrete words from active deck or ?words=... handoff).
 * - Per round: target card + 3 forbidden words, 60s timer (auto-pauses on tab hide), up to 3 clues.
 * - Code checks run before the AI sees text (non-English, 4..30 words, duplicate, target/taboo forms).
 * - AI ranks a bounded candidate list (target + 18 same-deck/topic distractors) via
 *   Xenova/all-MiniLM-L6-v2 (Blob Worker + IndexedDB vector cache) or offline keyword-overlap fallback.
 * - Reveals AI's top-3 guesses with softmax confidence bars; logs every round into
 *   as.v1.attempts and updates Leitner (wrong rounds drop to Box 1 due today).
 * @namespace App.games.guess
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const SESSION_CARDS = 5;

  let _root = null;
  let _clock = null;
  let _revealTimers = [];
  let _abortCtrl = null;

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _announce(msg) {
    const el = typeof document !== 'undefined' ? document.getElementById('announcer') : null;
    if (el) el.textContent = String(msg || '');
  }

  function _clearRevealTimers() {
    for (const id of _revealTimers) clearTimeout(id);
    _revealTimers = [];
  }

  function _cleanup() {
    _clearRevealTimers();
    if (_clock) {
      _clock.stop();
      _clock = null;
    }
    if (_abortCtrl) {
      try { _abortCtrl.abort(); } catch (_e) { /* ignore */ }
      _abortCtrl = null;
    }
    if (App.router && typeof App.router.clearGuard === 'function') {
      App.router.clearGuard();
    }
    if (App.games && App.games.engine) {
      App.games.engine.setHudScore('');
    }
  }

  function _engineBadgeText(mode, device) {
    if (mode === 'minilm') {
      const dev = device === 'webgpu' ? 'WebGPU' : 'WASM';
      return `MiniLM · ${dev}`;
    }
    return _t('guess.engine_offline');
  }

  function _formatMB(bytes) {
    return (Math.max(0, Number(bytes) || 0) / (1024 * 1024)).toFixed(1);
  }

  /**
   * Build safe DOM preview of the player's text with offending words struck through
   * (target violation) or highlighted (taboo violation). Zero innerHTML.
   */
  function _buildHighlightedViolation(text, offendingWords, isTarget) {
    const { el } = App.dom;
    const wrap = el('div', { className: 'guess-violation-preview' });
    if (!text || !Array.isArray(offendingWords) || !offendingWords.length) {
      wrap.textContent = String(text || '');
      return wrap;
    }
    const escaped = offendingWords
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((w) => String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    let lastIdx = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) {
        wrap.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      }
      if (isTarget) {
        wrap.appendChild(el('del', { className: 'guess-strike', 'data-guess-strike': 'true', text: m[0] }));
      } else {
        wrap.appendChild(el('mark', { className: 'guess-taboo-hit', 'data-guess-taboo-hit': 'true', text: m[0] }));
      }
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) {
      wrap.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    return wrap;
  }

  function mount(root, params) {
    _root = root;
    _cleanup();

    const { el } = App.dom;
    const cardsStore = App.store && App.store.cards;
    const decksStore = App.store && App.store.decks;
    const attemptsStore = App.store && App.store.attempts;
    const leitnerStore = App.store && App.store.leitner;
    const engine = App.games && App.games.engine;
    const checks = App.games && App.games.guessChecks;
    const embed = App.ai && App.ai.embed;

    const query = (params && params.query) || {};
    const forcedWords = query.words
      ? String(query.words).split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // ── Session state ────────────────────────────────────────────
    let phase = 'start'; // 'start' | 'loading' | 'play' | 'round_done' | 'end'
    let selectedDeckId = decksStore ? 'd-builtin-2000' : '';
    let engineMode = 'minilm'; // 'minilm' | 'offline'
    let activeDevice = null;
    let cacheInfo = { cached: false, files: 0, bytes: 0 };
    let loadProgress = { loaded: 0, total: Math.round((embed ? embed.APPROX_MB : 22.6) * 1024 * 1024), file: '' };
    let loadErrorMsg = '';

    let sessionId = '';
    let sessionStartedAt = 0;
    let targets = [];
    let roundIdx = 0;
    let totalScore = 0;
    let paused = false;
    let submitting = false;
    let roundRemainingMs = checks ? checks.ROUND_TIME_LIMIT_MS : 60000;
    let roundElapsedMs = 0;

    // Current round state
    let currentCandidates = [];
    let currentTaboos = [];
    let currentClues = []; // string[]
    let currentTurns = []; // [{ clue, top3, targetRank, engine, device, revealCount }]
    let currentDraft = '';
    let checkError = null; // { reason, message, offendingWords, matchedTaboos, rawText }
    let bestTop3Clue = null; // clue number where target first reached #2 or #3
    let roundOutcome = null; // { target, won, rank, clueUsed, points, timedOut, skipped, clues, taboos, wrongGuesses }
    let sessionHistory = []; // roundOutcome[]

    let timerDisplayEl = null;

    function _setGuardActive(active) {
      if (!App.router) return;
      if (active && typeof App.router.setGuard === 'function') {
        App.router.setGuard(() => _t('app.exit_confirm'));
      } else if (!active && typeof App.router.clearGuard === 'function') {
        App.router.clearGuard();
      }
    }

    function _getDeckPoolCards() {
      if (!cardsStore) return [];
      const all = cardsStore.getAll({ includeHidden: false });
      if (!selectedDeckId || !decksStore) return all;
      const ids = decksStore.getCardIds(selectedDeckId);
      if (!ids || ids.length < SESSION_CARDS) return all;
      const idSet = new Set(ids);
      return all.filter((c) => idSet.has(c.id));
    }

    function _getPrioritizedIds() {
      const ids = [];
      if (leitnerStore && typeof leitnerStore.getAll === 'function') {
        const today = App.date ? App.date.todayKey() : '';
        const allProg = leitnerStore.getAll();
        for (const rec of Object.values(allProg)) {
          if (rec && (rec.wrong > 0 || (today && rec.due <= today))) {
            ids.push(rec.cardId);
          }
        }
      }
      return ids;
    }

    function _stopRoundClock() {
      if (_clock) {
        roundElapsedMs = _clock.getElapsedMs();
        _clock.stop();
        _clock = null;
      }
    }

    function _startRoundClock() {
      _stopRoundClock();
      const limitMs = checks ? checks.ROUND_TIME_LIMIT_MS : 60000;
      roundRemainingMs = limitMs;
      roundElapsedMs = 0;
      if (!engine) return;
      _clock = engine.createClock({
        onTick: (_dt, elapsed) => {
          roundElapsedMs = elapsed;
          roundRemainingMs = Math.max(0, limitMs - elapsed);
          if (timerDisplayEl) {
            timerDisplayEl.textContent = `${Math.ceil(roundRemainingMs / 1000)}s`;
          }
          if (roundRemainingMs <= 0 && phase === 'play' && !submitting) {
            _finishRound({ won: false, rank: null, timedOut: true, skipped: false });
          }
        },
        onPause: () => {
          paused = true;
          render();
        },
      });
      _clock.start();
    }

    async function _prepareRound(index) {
      _clearRevealTimers();
      roundIdx = index;
      const target = targets[roundIdx];
      if (!target) {
        _finishSession();
        return;
      }

      const allCards = cardsStore ? cardsStore.getAll({ includeHidden: false }) : [];
      const deckCardIds = decksStore && selectedDeckId ? decksStore.getCardIds(selectedDeckId) : null;
      currentCandidates = checks.buildCandidates(target, allCards, {
        distractorCount: checks.DEFAULT_DISTRACTORS,
        deckCardIds,
      });

      let vecMap = null;
      if (engineMode === 'minilm' && embed && typeof embed.getCandidateEmbeddings === 'function') {
        try {
          _abortCtrl = new AbortController();
          vecMap = await embed.getCandidateEmbeddings(currentCandidates, { signal: _abortCtrl.signal });
          const m = embed.getMetrics();
          if (m && m.device) activeDevice = m.device;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          engineMode = 'offline';
          activeDevice = null;
          if (App.toast) App.toast.show(_t('guess.switched_offline'));
        } finally {
          _abortCtrl = null;
        }
      }

      currentTaboos = checks.pickTabooWords(target, currentCandidates, {
        count: checks.DEFAULT_TABOO_COUNT,
        embeddingsMap: vecMap,
      });
      currentClues = [];
      currentTurns = [];
      currentDraft = '';
      checkError = null;
      bestTop3Clue = null;
      roundOutcome = null;
      paused = false;
      submitting = false;
      phase = 'play';

      if (engine) engine.setHudScore(`${_t('wall.score_label')} ${totalScore}`);
      _setGuardActive(true);
      _startRoundClock();
      render();
    }

    async function _startSession(requestedMode) {
      loadErrorMsg = '';
      engineMode = requestedMode === 'offline' ? 'offline' : 'minilm';
      activeDevice = null;

      if (engineMode === 'minilm' && embed) {
        phase = 'loading';
        render();
        try {
          _abortCtrl = new AbortController();
          const info = await embed.init({
            signal: _abortCtrl.signal,
            onProgress: (p) => {
              loadProgress = {
                loaded: p.loaded || 0,
                total: p.total || Math.round(embed.APPROX_MB * 1024 * 1024),
                file: p.file || '',
              };
              render();
            },
          });
          activeDevice = info.device || 'wasm';
        } catch (err) {
          if (err && err.name === 'AbortError') {
            phase = 'start';
            render();
            return;
          }
          loadErrorMsg = (err && err.message) ? err.message : _t('guess.model_failed');
          render();
          return;
        } finally {
          _abortCtrl = null;
        }
      }

      const allCards = cardsStore ? cardsStore.getAll({ includeHidden: false }) : [];
      const deckCardIds = decksStore && selectedDeckId ? decksStore.getCardIds(selectedDeckId) : null;
      targets = checks.selectSessionTargets(allCards, SESSION_CARDS, {
        deckCardIds,
        forcedWords,
        prioritizeIds: _getPrioritizedIds(),
      });

      if (!targets.length) {
        if (App.toast) App.toast.show(_t('guess.no_cards'));
        phase = 'start';
        render();
        return;
      }

      sessionId = 'guess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      sessionStartedAt = Date.now();
      totalScore = 0;
      sessionHistory = [];

      await _prepareRound(0);
    }

    function _finishRound(opts) {
      const o = opts || {};
      _stopRoundClock();
      const target = targets[roundIdx];
      const won = Boolean(o.won);
      const clueUsed = currentClues.length;
      let points = 0;
      let finalRank = o.rank || null;

      if (won) {
        points = checks.scoreRound(clueUsed || 1, 1);
        finalRank = 1;
      } else if (bestTop3Clue !== null) {
        points = checks.scoreRound(bestTop3Clue, 2);
      }

      totalScore += points;
      if (engine) engine.setHudScore(`${_t('wall.score_label')} ${totalScore}`);

      const wrongGuesses = [];
      const seenWrong = new Set();
      for (const turn of currentTurns) {
        for (const g of (turn.top3 || [])) {
          if (g.card && g.card.id !== target.id && !seenWrong.has(g.word.toLowerCase())) {
            seenWrong.add(g.word.toLowerCase());
            wrongGuesses.push(g.card);
          }
        }
      }

      const combinedClue = currentClues.join(' ');
      const errorType = won
        ? null
        : (o.timedOut ? 'timeout' : (o.skipped ? 'skip' : 'guess_miss'));

      // Log into shared attempts log (as.v1.attempts) & feed Review via Leitner
      if (attemptsStore) {
        attemptsStore.record({
          source: 'guess',
          sessionId,
          cardId: target.id,
          itemId: target.word,
          skill: 'vocab',
          correct: won,
          userAnswer: combinedClue || null,
          expected: target.word,
          errorType,
          wrongLetters: [],
          ms: roundElapsedMs,
        });
      }
      if (leitnerStore) {
        leitnerStore.recordGameResult(target.id, 'guess', won);
      }

      roundOutcome = {
        target,
        won,
        inTop3: !won && bestTop3Clue !== null,
        rank: finalRank,
        clueUsed,
        points,
        timedOut: Boolean(o.timedOut),
        skipped: Boolean(o.skipped),
        clues: currentClues.slice(),
        taboos: currentTaboos.slice(),
        wrongGuesses,
      };
      sessionHistory.push(roundOutcome);
      phase = 'round_done';

      _announce(
        won
          ? _t('guess.round_won', { n: clueUsed, pts: points })
          : _t('guess.round_missed', { word: target.word })
      );
      render();
    }

    function _finishSession() {
      _stopRoundClock();
      _setGuardActive(false);

      const wonCount = sessionHistory.filter((r) => r.won).length;
      const accuracy = sessionHistory.length ? (wonCount / sessionHistory.length) : 0;
      if (attemptsStore && sessionHistory.length) {
        attemptsStore.recordSession({
          id: sessionId,
          source: 'guess',
          startedAt: sessionStartedAt,
          endedAt: Date.now(),
          score: totalScore,
          accuracy,
          details: {
            rounds: sessionHistory.length,
            wonCount,
            engine: engineMode,
            device: activeDevice,
          },
        });
      }

      phase = 'end';
      render();
    }

    async function _submitClue(rawText) {
      if (phase !== 'play' || paused || submitting) return;
      const target = targets[roundIdx];
      if (!target) return;

      const text = String(rawText || '').trim();
      const checked = checks.validateDescription(text, target.word, currentTaboos, currentClues);
      if (!checked.ok) {
        const msg = checked.reason === 'contains_taboo'
          ? _t(checked.messageKey, { words: checked.matchedTaboos.join(', ') })
          : _t(checked.messageKey);
        checkError = {
          reason: checked.reason,
          message: msg,
          offendingWords: checked.offendingWords,
          matchedTaboos: checked.matchedTaboos,
          rawText: text,
        };
        _announce(msg);
        render();
        return;
      }

      checkError = null;
      submitting = true;
      currentDraft = '';
      currentClues.push(text);
      const cumulative = currentClues.join(' ');
      render();

      try {
        _abortCtrl = new AbortController();
        const res = await embed.rankCandidates(cumulative, currentCandidates, {
          preferOffline: engineMode === 'offline',
          signal: _abortCtrl.signal,
        });
        if (res.engine === 'offline' && engineMode === 'minilm') {
          engineMode = 'offline';
          activeDevice = null;
          if (App.toast) App.toast.show(_t('guess.switched_offline'));
        } else if (res.engine === 'minilm') {
          activeDevice = res.device || activeDevice || 'wasm';
        }

        const top3 = (res.ranked || []).slice(0, 3);
        const targetEntry = (res.ranked || []).find((r) => r.card && r.card.id === target.id);
        const targetRank = targetEntry ? targetEntry.rank : (currentCandidates.length || 99);
        if (targetRank >= 2 && targetRank <= 3 && bestTop3Clue === null) {
          bestTop3Clue = currentClues.length;
        }

        const reducedMotion = typeof window !== 'undefined'
          && typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const turn = {
          clue: text,
          top3,
          targetRank,
          engine: res.engine,
          device: res.device,
          revealCount: reducedMotion ? top3.length : 1,
        };
        currentTurns.push(turn);
        submitting = false;

        if (targetRank === 1) {
          turn.revealCount = top3.length;
          _finishRound({ won: true, rank: 1 });
          return;
        }
        if (currentClues.length >= checks.MAX_CLUES_PER_CARD) {
          turn.revealCount = top3.length;
          _finishRound({ won: false, rank: targetRank });
          return;
        }

        render();

        // Reveal top-3 guesses one by one (respecting reduced motion)
        if (!reducedMotion && top3.length > 1) {
          _clearRevealTimers();
          for (let step = 2; step <= top3.length; step++) {
            const tid = setTimeout(() => {
              turn.revealCount = step;
              if (_root && phase === 'play') render();
            }, (step - 1) * 180);
            _revealTimers.push(tid);
          }
        }
      } catch (err) {
        submitting = false;
        if (err && err.name === 'AbortError') return;
        if (App.toast) App.toast.show(_t('error.generic'));
        render();
      } finally {
        _abortCtrl = null;
      }
    }

    function _openVocabItem(word, existingCard) {
      if (existingCard && App.router) {
        App.router.go('#/cards/' + existingCard.id);
        return;
      }
      const openForm = () => {
        if (App.cardForm && typeof App.cardForm.open === 'function') {
          App.cardForm.open({
            card: { word, zh: '', tags: ['你說我猜'] },
            onSaved: () => {
              if (App.toast) App.toast.show(_t('wall.added_to_cards', { word }));
            },
          });
        }
      };
      if (App.cardForm) {
        openForm();
      } else if (App.loadScripts) {
        App.loadScripts(['js/ui/card-form.js']).then(openForm).catch(() => {
          if (App.toast) App.toast.show(_t('error.load'));
        });
      }
    }

    function _renderStart() {
      const decks = decksStore ? decksStore.getAll() : [];
      const best = engine ? engine.getBestScore('guess') : null;
      const cacheLabel = cacheInfo.cached
        ? _t('guess.model_cached', { mb: _formatMB(cacheInfo.bytes) })
        : _t('guess.model_download_hint', { mb: embed ? embed.APPROX_MB : 22.6 });

      const deckPicker = decks.length > 1
        ? el('div', { className: 'guess-deck-row' }, [
          el('label', { className: 'text-small text-muted', htmlFor: 'guess-deck-select', text: _t('guess.choose_deck') }),
          el('select', {
            id: 'guess-deck-select',
            className: 'input',
            onChange: (ev) => { selectedDeckId = ev.target.value; },
          }, decks.map((d) => {
            const count = decksStore.getCardIds(d.id).length;
            return el('option', {
              value: d.id,
              selected: d.id === selectedDeckId,
              text: `${d.name} (${count})`,
            });
          })),
        ])
        : null;

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: _t('games.guess.name') }),
          best !== null ? el('span', { className: 'wall-best-pill', text: `${_t('games.personal_best')} ${best}` }) : null,
        ]),
        el('section', { className: 'guess-start-hero' }, [
          el('p', { className: 'text-body', style: 'margin: 0;', text: _t('guess.rules_short') }),
          el('div', { className: 'guess-rule-pills' }, [
            el('span', { className: 'guess-meta-pill', text: _t('guess.rule_cards') }),
            el('span', { className: 'guess-meta-pill', text: _t('guess.rule_clues') }),
            el('span', { className: 'guess-meta-pill', text: _t('guess.rule_timer') }),
            el('span', { className: 'guess-meta-pill', text: _t('guess.rule_score') }),
          ]),
          deckPicker,
          el('div', { className: 'guess-engine-status' }, [
            el('span', { className: 'guess-engine-badge', text: 'MiniLM' }),
            el('span', { className: 'text-small text-muted', text: cacheLabel }),
          ]),
          el('div', { className: 'guess-start-actions' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              'data-guess-start': 'ai',
              onClick: () => _startSession('minilm'),
            }, [el('span', { className: 'btn-label', text: _t('guess.start_ai') })]),
            el('button', {
              type: 'button',
              className: 'btn btn-secondary',
              'data-guess-start': 'offline',
              onClick: () => _startSession('offline'),
            }, [el('span', { className: 'btn-label', text: _t('guess.start_offline') })]),
          ]),
        ]),
      ]);
    }

    function _renderLoading() {
      const pct = loadProgress.total > 0
        ? Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100))
        : 0;

      if (loadErrorMsg) {
        return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          el('div', { className: 'state-box' }, [
            el('h2', { style: 'margin: 0 0 var(--space-2);', text: _t('guess.need_model_title') }),
            el('p', { className: 'text-muted text-small', text: loadErrorMsg }),
            el('div', { className: 'guess-start-actions', style: 'justify-content: center; margin-top: var(--space-4);' }, [
              el('button', {
                type: 'button',
                className: 'btn btn-primary',
                onClick: () => _startSession('minilm'),
              }, [el('span', { className: 'btn-label', text: _t('btn.retry') })]),
              el('button', {
                type: 'button',
                className: 'btn btn-secondary',
                onClick: () => _startSession('offline'),
              }, [el('span', { className: 'btn-label', text: _t('guess.fallback_offline_btn') })]),
            ]),
          ]),
        ]);
      }

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'state-box' }, [
          el('h2', { style: 'margin: 0 0 var(--space-2);', text: _t('guess.loading_model') }),
          el('div', { className: 'guess-progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, [
            el('div', { className: 'guess-progress-fill', style: `width: ${pct}%;` }),
          ]),
          el('p', {
            className: 'text-small text-muted',
            style: 'font-family: var(--font-mono); margin: var(--space-2) 0 0;',
            text: `${_formatMB(loadProgress.loaded)} / ${_formatMB(loadProgress.total)} MB (${pct}%)`,
          }),
          el('div', { style: 'margin-top: var(--space-4);' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              onClick: () => {
                if (_abortCtrl) _abortCtrl.abort();
                _startSession('offline');
              },
            }, [el('span', { className: 'btn-label', text: _t('guess.fallback_offline_btn') })]),
          ]),
        ]),
      ]);
    }

    function _renderPlay() {
      const target = targets[roundIdx];
      const badTaboos = new Set((checkError && checkError.matchedTaboos ? checkError.matchedTaboos : []).map((w) => w.toLowerCase()));

      timerDisplayEl = el('span', {
        className: 'guess-timer-pill',
        'data-guess-timer': 'true',
        text: `${Math.ceil(roundRemainingMs / 1000)}s`,
      });

      const topBar = el('div', { className: 'guess-topbar' }, [
        el('div', { className: 'guess-topbar-left' }, [
          el('span', { className: 'guess-round-pill', text: _t('guess.round_of', { cur: roundIdx + 1, total: targets.length }) }),
          timerDisplayEl,
          el('span', { className: 'guess-engine-badge', 'data-guess-engine-badge': 'true', text: _engineBadgeText(engineMode, activeDevice) }),
        ]),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          onClick: () => {
            if (_clock && !paused) _clock.pause();
            else if (_clock && paused) { paused = false; _clock.resume(); render(); }
          },
        }, [el('span', { className: 'btn-label', text: paused ? _t('game.resume') : _t('game.pause') })]),
      ]);

      if (paused) {
        return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          topBar,
          el('div', { className: 'state-box' }, [
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

      const speakBtn = el('button', {
        type: 'button',
        className: 'btn btn-ghost guess-tts-btn',
        'aria-label': _t('cards.speak_normal'),
        title: _t('cards.speak_normal'),
        onClick: () => {
          if (App.audio && App.audio.tts) App.audio.tts.speak(target.word);
        },
      }, [App.icons ? App.icons.svg('speaker', 'icon') : el('span', { text: '♪' })]);

      const targetCardEl = el('section', { className: 'guess-target-card' }, [
        el('div', { className: 'guess-target-head' }, [
          el('div', {}, [
            el('div', { className: 'guess-target-word-row' }, [
              el('h2', { className: 'guess-target-word', 'data-guess-target-word': 'true', text: target.word }),
              target.pos ? el('span', { className: 'guess-pos-tag', text: target.pos }) : null,
              speakBtn,
            ]),
            el('div', { className: 'guess-target-zh', text: target.zh || '' }),
          ]),
          el('div', { className: 'guess-clue-counter text-small text-muted', text: _t('guess.clues_left', { left: Math.max(0, checks.MAX_CLUES_PER_CARD - currentClues.length), max: checks.MAX_CLUES_PER_CARD }) }),
        ]),
        el('div', { className: 'guess-taboo-section' }, [
          el('span', { className: 'guess-taboo-label', text: _t('guess.taboo_label') }),
          el('div', { className: 'guess-taboo-list', 'data-guess-taboo-list': 'true' }, currentTaboos.map((tw) =>
            el('span', {
              className: 'guess-taboo-chip' + (badTaboos.has(tw.toLowerCase()) ? ' is-hit' : ''),
              'data-guess-taboo': tw,
              text: tw,
            })
          )),
        ]),
      ]);

      // Dialogue feed: player clues + AI top-3 guess bubbles
      const feedItems = [];
      for (let i = 0; i < currentTurns.length; i++) {
        const turn = currentTurns[i];
        feedItems.push(
          el('div', { className: 'guess-bubble guess-bubble--user' }, [
            el('div', { className: 'guess-bubble-label', text: _t('guess.clue_num', { n: i + 1 }) }),
            el('div', { text: turn.clue }),
          ])
        );

        const visibleTop = (turn.top3 || []).slice(0, turn.revealCount || 1);
        const first = visibleTop[0];
        const second = visibleTop[1];
        const third = visibleTop[2];
        let aiLine = first ? _t('guess.ai_reply_1', { w1: first.word, p1: first.pct }) : '';
        if (second && third) {
          aiLine += ' ' + _t('guess.ai_reply_23', { w2: second.word, p2: second.pct, w3: third.word, p3: third.pct });
        } else if (second) {
          aiLine += ' ' + _t('guess.ai_reply_2', { w2: second.word, p2: second.pct });
        }

        feedItems.push(
          el('div', { className: 'guess-bubble guess-bubble--ai', 'data-guess-ai-bubble': 'true' }, [
            el('div', { className: 'guess-bubble-label', text: _engineBadgeText(turn.engine, turn.device) }),
            el('p', { className: 'guess-ai-line', text: aiLine }),
            el('div', { className: 'guess-bars' }, visibleTop.map((g) => {
              const isHit = g.card && g.card.id === target.id;
              return el('div', {
                className: 'guess-bar-row' + (isHit ? ' is-match' : ''),
                'data-guess-top-item': g.word,
              }, [
                el('span', { className: 'guess-bar-word', text: `${isHit ? '○ ' : `#${g.rank} `}${g.word}` }),
                el('div', { className: 'guess-bar-track' }, [
                  el('div', { className: 'guess-bar-fill' + (isHit ? ' is-match' : ''), style: `width: ${Math.max(4, Math.min(100, g.pct))}%;` }),
                ]),
                el('span', { className: 'guess-bar-pct', text: `${g.pct}%` }),
              ]);
            })),
          ])
        );
      }

      if (submitting) {
        feedItems.push(
          el('div', { className: 'guess-bubble guess-bubble--ai' }, [
            el('div', { className: 'text-small text-muted', text: _t('guess.ai_guessing') }),
          ])
        );
      }

      const feedSection = feedItems.length
        ? el('section', { className: 'guess-chat-feed', 'aria-live': 'polite' }, feedItems)
        : null;

      // Round done banner OR input form
      let bottomSection = null;
      if (phase === 'round_done' && roundOutcome) {
        const isLast = roundIdx + 1 >= targets.length;
        const outcomeTitle = roundOutcome.won
          ? _t('guess.round_won', { n: roundOutcome.clueUsed, pts: roundOutcome.points })
          : (roundOutcome.inTop3
            ? _t('guess.round_top3', { pts: roundOutcome.points })
            : (roundOutcome.timedOut
              ? _t('guess.round_timeout', { word: target.word })
              : _t('guess.round_missed', { word: target.word })));

        bottomSection = el('section', {
          className: 'guess-outcome-card' + (roundOutcome.won ? ' is-won' : ''),
          'data-guess-round-done': 'true',
        }, [
          el('div', { className: 'guess-outcome-title', text: outcomeTitle }),
          target.hasRealExample && target.example
            ? el('p', { className: 'text-small text-muted', style: 'margin: 6px 0 0;', text: target.example })
            : null,
          el('div', { style: 'margin-top: var(--space-3);' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              'data-guess-next': 'true',
              onClick: () => {
                if (isLast) _finishSession();
                else _prepareRound(roundIdx + 1);
              },
            }, [el('span', { className: 'btn-label', text: isLast ? _t('guess.view_results') : _t('guess.next_card') })]),
          ]),
        ]);
      } else {
        const wordCount = (currentDraft.trim().match(/[A-Za-z]+(?:'[A-Za-z]+)?(?:-[A-Za-z]+)*/g) || []).length;
        const wordCountEl = el('span', { className: 'text-small text-muted', text: _t('guess.word_count', { n: wordCount, max: checks.MAX_WORDS }) });

        const textarea = el('textarea', {
          className: 'input guess-textarea',
          rows: '2',
          'data-guess-input': 'true',
          placeholder: _t('guess.input_placeholder'),
          'aria-label': _t('guess.input_placeholder'),
          disabled: submitting,
          onInput: (ev) => {
            currentDraft = ev.target.value;
            const wc = (currentDraft.trim().match(/[A-Za-z]+(?:'[A-Za-z]+)?(?:-[A-Za-z]+)*/g) || []).length;
            wordCountEl.textContent = _t('guess.word_count', { n: wc, max: checks.MAX_WORDS });
          },
          onKeydown: (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              _submitClue(textarea.value);
            }
          },
        });
        textarea.value = currentDraft;

        const errorBox = checkError
          ? el('div', { className: 'guess-error-box', role: 'alert', 'data-guess-error': checkError.reason }, [
            el('div', { className: 'guess-error-msg', text: checkError.message }),
            checkError.offendingWords && checkError.offendingWords.length
              ? _buildHighlightedViolation(checkError.rawText, checkError.offendingWords, checkError.reason === 'contains_target')
              : null,
          ])
          : null;

        bottomSection = el('section', { className: 'guess-input-card' }, [
          errorBox,
          textarea,
          el('div', { className: 'guess-input-foot' }, [
            wordCountEl,
            el('div', { className: 'guess-input-actions' }, [
              el('button', {
                type: 'button',
                className: 'btn btn-ghost',
                'data-guess-skip': 'true',
                disabled: submitting,
                onClick: () => _finishRound({ won: false, rank: null, timedOut: false, skipped: true }),
              }, [el('span', { className: 'btn-label', text: _t('guess.skip') })]),
              el('button', {
                type: 'button',
                className: 'btn btn-primary',
                'data-guess-submit': 'true',
                disabled: submitting,
                onClick: () => _submitClue(textarea.value),
              }, [el('span', { className: 'btn-label', text: _t('guess.submit_clue') })]),
            ]),
          ]),
        ]);
      }

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        topBar,
        targetCardEl,
        feedSection,
        bottomSection,
      ]);
    }

    function _renderEnd() {
      const wonCount = sessionHistory.filter((r) => r.won).length;
      const firstClueWin = sessionHistory.some((r) => r.won && r.clueUsed === 1);
      const stampText = firstClueWin
        ? _t('guess.stamp_first_try')
        : (wonCount >= 4 ? _t('guess.stamp_great') : _t('guess.stamp_done'));

      // Collect vocabulary review: taboo words + wrong AI guesses (excluding targets)
      const targetWordsSet = new Set(sessionHistory.map((r) => r.target.word.toLowerCase()));
      const reviewWords = [];
      const seenReview = new Set();
      for (const r of sessionHistory) {
        for (const tw of (r.taboos || [])) {
          const k = tw.toLowerCase();
          if (targetWordsSet.has(k) || seenReview.has(k)) continue;
          seenReview.add(k);
          const card = cardsStore ? cardsStore.findByWord(tw) : null;
          reviewWords.push({ word: tw, zh: card ? card.zh : '', card, kind: 'taboo' });
        }
        for (const wg of (r.wrongGuesses || [])) {
          const k = wg.word.toLowerCase();
          if (targetWordsSet.has(k) || seenReview.has(k)) continue;
          seenReview.add(k);
          reviewWords.push({ word: wg.word, zh: wg.zh || '', card: wg, kind: 'guess' });
        }
      }

      const roundList = el('ul', { className: 'guess-summary-list', role: 'list' }, sessionHistory.map((r) => {
        const badge = r.won
          ? `○ ${_t('guess.summary_won', { n: r.clueUsed })}`
          : (r.inTop3 ? `△ ${_t('guess.summary_top3')}` : `✗ ${_t('guess.summary_missed')}`);
        return el('li', { className: 'guess-summary-item' }, [
          el('div', {}, [
            el('strong', { text: r.target.word }),
            el('span', { className: 'text-muted text-small', style: 'margin-left: 8px;', text: r.target.zh || '' }),
          ]),
          el('div', { className: 'text-small' }, [
            el('span', { text: `${badge} · +${r.points}` }),
          ]),
        ]);
      }));

      const vocabReview = reviewWords.length
        ? el('section', { className: 'guess-vocab-review' }, [
          el('h2', { className: 'text-small text-muted', style: 'margin: 0 0 var(--space-3);', text: _t('guess.vocab_review') }),
          el('div', { className: 'guess-vocab-grid' }, reviewWords.slice(0, 12).map((item) =>
            el('div', { className: 'guess-vocab-chip' }, [
              el('div', {}, [
                el('strong', { text: item.word }),
                item.zh ? el('div', { className: 'text-small text-muted', text: item.zh }) : null,
              ]),
              el('button', {
                type: 'button',
                className: 'btn btn-ghost',
                onClick: () => _openVocabItem(item.word, item.card),
              }, [el('span', { className: 'btn-label', text: item.card ? _t('guess.view_card') : _t('wall.add_to_deck') })]),
            ])
          )),
        ])
        : null;

      return el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('section', { className: 'guess-end-hero', 'data-guess-end': 'true' }, [
          el('div', { className: 'stamp', text: stampText }),
          el('h1', { className: 'page-title', style: 'margin: var(--space-3) 0 var(--space-1);', text: _t('guess.end_title') }),
          el('p', { className: 'text-muted', text: _t('guess.end_summary', { score: totalScore, won: wonCount, total: sessionHistory.length }) }),
          el('span', { className: 'guess-engine-badge', text: _engineBadgeText(engineMode, activeDevice) }),
        ]),
        roundList,
        vocabReview,
        el('div', { className: 'guess-end-actions' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            onClick: () => _startSession(engineMode),
          }, [el('span', { className: 'btn-label', text: _t('guess.play_again') })]),
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => {
              if (App.toast) App.toast.show(_t('guess.feature_b_soon'));
            },
          }, [el('span', { className: 'btn-label', text: _t('guess.ai_correct_btn') })]),
          el('a', { className: 'btn btn-ghost', href: '#/games/wall' }, [
            el('span', { className: 'btn-label', text: _t('guess.go_wall') }),
          ]),
          el('a', { className: 'btn btn-ghost', href: '#/games' }, [
            el('span', { className: 'btn-label', text: _t('btn.back') }),
          ]),
        ]),
      ]);
    }

    function render() {
      if (!_root) return;
      if (phase === 'start') _root.replaceChildren(_renderStart());
      else if (phase === 'loading') _root.replaceChildren(_renderLoading());
      else if (phase === 'end') _root.replaceChildren(_renderEnd());
      else _root.replaceChildren(_renderPlay());
    }

    render();

    if (embed && typeof embed.inspectCache === 'function') {
      embed.inspectCache().then((info) => {
        cacheInfo = info || cacheInfo;
        if (_root && phase === 'start') render();
      }).catch(() => {});
    }

    // Expose tiny test hooks on mount return for deterministic integration testing
    return {
      startSession: _startSession,
      submitClue: _submitClue,
      getState: () => ({
        phase,
        engineMode,
        activeDevice,
        roundIdx,
        totalScore,
        target: targets[roundIdx] || null,
        candidates: currentCandidates,
        taboos: currentTaboos,
        clues: currentClues,
        turns: currentTurns,
        checkError,
        roundOutcome,
        sessionHistory,
      }),
    };
  }

  function unmount() {
    _cleanup();
    _root = null;
  }

  App.games.guess = { mount, unmount };
})();
