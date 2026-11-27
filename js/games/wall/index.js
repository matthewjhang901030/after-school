/**
 * 四格分類牆 (Four-Group Wall) game (M5, Section 4.5).
 *
 * Features:
 * - Modes: 今日之牆 (seeded daily wall by local dayKey) & Practice mode (pick any wall)
 * - 4x4 sticky-note board, selection capped at 4, Shuffle / Deselect / Submit
 * - 4 mistakes allowed; 3-of-4 correct shows "差一個"; duplicate wrong guesses ignored
 * - Solved rows reveal difficulty color (1=mustard, 2=sage, 3=terracotta, 4=ink),
 *   skill badge, and one-line Chinese rule
 * - Wrong guesses do NOT send cards to Leitner box 1; instead logs confusion pairs
 *   between selected items from different true groups (Section 4.5.4)
 * - Shared engine clock pauses automatically on visibilitychange
 * - End screen: stamp, score, all 4 rules with tappable chips (open card or 加入卡組),
 *   AI explain hook (M6), play next wall, and Class 13 handoff
 * @namespace App.games.wall
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const PROGRESS_KEY = 'as.v1.wall.progress';
  const MAX_MISTAKES = 4;

  let _root = null;
  let _clock = null;
  let _countdown = null;
  let _feedbackTimer = null;
  let _activeAiPanel = null;

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _announce(msg) {
    const el = document.getElementById('announcer');
    if (el) el.textContent = msg;
  }

  function _loadProgress() {
    const raw = App.store && App.store.db ? App.store.db.get(PROGRESS_KEY, null) : null;
    if (raw && typeof raw === 'object') {
      return {
        solvedIds: Array.isArray(raw.solvedIds) ? raw.solvedIds.slice() : [],
        solvedDays: raw.solvedDays && typeof raw.solvedDays === 'object' ? Object.assign({}, raw.solvedDays) : {},
      };
    }
    return { solvedIds: [], solvedDays: {} };
  }

  function _saveProgress(prog) {
    if (App.store && App.store.db) App.store.db.set(PROGRESS_KEY, prog);
  }

  /**
   * Return all validated curated walls.
   * @returns {Array<Object>}
   */
  function getValidWalls() {
    const raw = (App.data && Array.isArray(App.data.walls)) ? App.data.walls : [];
    if (App.games.wallValidate) {
      return App.games.wallValidate.validateAll(raw).validWalls;
    }
    return raw;
  }

  /**
   * Deterministically choose Today's Wall for a given local dayKey (Section 4.5.3).
   * @param {string} [dayKey]
   * @returns {Object|null}
   */
  function getDailyWall(dayKey) {
    const walls = getValidWalls();
    if (!walls.length) return null;
    const key = dayKey || (App.date ? App.date.todayKey() : '2026-01-01');
    const rng = App.random ? App.random.create('wall-' + key) : Math.random;
    const idx = Math.floor(rng() * walls.length);
    return walls[idx];
  }

  function _cleanup() {
    if (_clock) {
      _clock.stop();
      _clock = null;
    }
    if (_countdown) {
      _countdown.cancel();
      _countdown = null;
    }
    if (_feedbackTimer) {
      clearTimeout(_feedbackTimer);
      _feedbackTimer = null;
    }
    if (_activeAiPanel && typeof _activeAiPanel.stop === 'function') {
      _activeAiPanel.stop();
      _activeAiPanel = null;
    }
    if (App.games.engine) App.games.engine.setHudScore('');
  }

  function mount(root, params) {
    _cleanup();
    _root = root;

    const { el } = App.dom;
    const engine = App.games.engine;
    const attemptsStore = App.store && App.store.attempts;
    const cardsStore = App.store && App.store.cards;
    const walls = getValidWalls();
    const today = App.date ? App.date.todayKey() : '2026-01-01';
    const dailyWall = getDailyWall(today);

    // Runtime state
    let phase = 'start'; // 'start' | 'countdown' | 'play' | 'end'
    let mode = 'daily';  // 'daily' | 'practice'
    let activeWall = null;
    let sessionId = '';
    let sessionStartedAt = 0;
    let tiles = [];       // { text, groupIndex, level, skill }
    let selected = [];    // array of tile.text
    let solvedGroups = []; // array of group objects in solve order
    let triedWrongKeys = new Set();
    let mistakesLeft = MAX_MISTAKES;
    let combo = 0;
    let score = 0;
    let totalSubmissions = 0;
    let correctSubmissions = 0;
    let won = false;
    let paused = false;
    let submitting = false;
    let feedbackMsg = '';
    let feedbackIsOk = false;
    let loggedConfusions = [];
    let lastMistakeFacts = null;
    let sessionMistakes = [];

    function wallTitle(w) {
      const lang = App.i18n ? App.i18n.lang() : 'zh-TW';
      return lang === 'en' ? (w.titleEn || w.id) : (w.titleZh || w.titleEn || w.id);
    }

    function openItemAction(itemText) {
      const existing = cardsStore ? cardsStore.findByWord(itemText) : null;
      if (existing) {
        if (App.modal) {
          App.modal.open({
            title: existing.word,
            body: el('div', { style: 'display: flex; flex-direction: column; gap: var(--space-2);' }, [
              el('p', { style: 'font-weight: 700; margin: 0;', text: existing.zh }),
              existing.pos ? el('p', { className: 'text-small text-muted', style: 'margin: 0;', text: existing.pos }) : null,
              existing.example ? el('p', { className: 'text-small', style: 'margin: 0;', text: existing.example }) : null,
            ]),
            actions: [
              { label: _t('btn.close'), variant: 'secondary' },
              {
                label: _t('cards.detail'),
                variant: 'primary',
                onClick: () => {
                  if (App.router) App.router.go('#/cards/' + encodeURIComponent(existing.id));
                },
              },
            ],
          });
        }
        return;
      }

      // Not a card yet -> offer 加入卡組 via App.cardForm (lazy-loaded if needed)
      const openAddForm = () => {
        if (App.cardForm && typeof App.cardForm.open === 'function') {
          App.cardForm.open({
            card: { word: itemText, zh: '', tags: ['四格分類牆'] },
            onSaved: () => {
              if (App.toast) App.toast.show(_t('wall.added_to_cards', { word: itemText }));
            },
          });
        }
      };

      if (App.cardForm) {
        openAddForm();
      } else if (App.loadScripts) {
        App.loadScripts(['js/ui/card-form.js']).then(openAddForm).catch(() => {
          if (App.toast) App.toast.show(_t('error.load'));
        });
      }
    }

    function startWall(wall, chosenMode, opts) {
      if (!wall) return;
      _cleanup();
      activeWall = wall;
      mode = chosenMode || 'practice';
      sessionId = 'wall-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      sessionStartedAt = Date.now();
      solvedGroups = [];
      selected = [];
      triedWrongKeys = new Set();
      mistakesLeft = MAX_MISTAKES;
      combo = 0;
      score = 0;
      totalSubmissions = 0;
      correctSubmissions = 0;
      won = false;
      paused = false;
      submitting = false;
      feedbackMsg = '';
      feedbackIsOk = false;
      loggedConfusions = [];
      lastMistakeFacts = null;
      sessionMistakes = [];

      const flat = [];
      wall.groups.forEach((g, gi) => {
        g.items.forEach((item) => {
          flat.push({ text: item, groupIndex: gi, level: g.level, skill: g.skill });
        });
      });

      const seedKey = mode === 'daily' ? ('wall-shuffle-' + today + '-' + wall.id) : ('wall-p-' + Date.now() + '-' + wall.id);
      const rng = App.random ? App.random.create(seedKey) : Math.random;
      if (App.random) App.random.shuffle(flat, rng);
      tiles = flat;

      const beginPlay = () => {
        phase = 'play';
        if (engine) {
          engine.setHudScore(`${_t('wall.score_label')} 0`);
          _clock = engine.createClock({
            onPause: () => {
              paused = true;
              render();
            },
          });
          _clock.start();
        }
        render();
      };

      const skipCountdown = Boolean(opts && opts.skipCountdown);
      if (skipCountdown || !engine) {
        beginPlay();
      } else {
        phase = 'countdown';
        const holder = el('div');
        _root.replaceChildren(
          el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [holder])
        );
        _countdown = engine.runCountdown(holder, {
          stepMs: 360,
          onDone: beginPlay,
        });
      }
    }

    function finishGame(didWin) {
      won = Boolean(didWin);
      if (_clock) {
        _clock.stop();
        _clock = null;
      }

      // Bonus for zero mistakes on a won wall
      if (won && mistakesLeft === MAX_MISTAKES) {
        score += 100;
      }

      // Persist solved progress
      const prog = _loadProgress();
      if (won && !prog.solvedIds.includes(activeWall.id)) {
        prog.solvedIds.push(activeWall.id);
      }
      if (mode === 'daily') {
        prog.solvedDays[today] = {
          wallId: activeWall.id,
          won,
          mistakesUsed: MAX_MISTAKES - mistakesLeft,
          score,
        };
      }
      _saveProgress(prog);

      // Persist completed session (Section 6.1: only completed sessions are saved)
      const accuracy = totalSubmissions > 0 ? (correctSubmissions / totalSubmissions) : (won ? 1 : 0);
      if (attemptsStore) {
        attemptsStore.recordSession({
          id: sessionId,
          source: 'wall',
          startedAt: sessionStartedAt,
          endedAt: Date.now(),
          score,
          accuracy,
          details: {
            wallId: activeWall.id,
            mode,
            won,
            mistakesUsed: MAX_MISTAKES - mistakesLeft,
            solvedCount: solvedGroups.length,
            confusions: loggedConfusions.length,
          },
        });
      }

      if (engine) engine.setHudScore(`${_t('wall.score_label')} ${score}`);
      phase = 'end';
      render();
    }

    function toggleTile(text) {
      if (submitting || paused || phase !== 'play') return;
      const idx = selected.indexOf(text);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        if (selected.length >= 4) {
          _announce(_t('wall.max_four'));
          return;
        }
        selected.push(text);
      }
      feedbackMsg = '';
      render();
    }

    function shuffleBoard() {
      if (submitting || paused || phase !== 'play') return;
      const rng = App.random ? App.random.create('shuf-' + Date.now() + '-' + tiles.length) : Math.random;
      if (App.random) App.random.shuffle(tiles, rng);
      render();
    }

    function deselectAll() {
      if (submitting || paused || phase !== 'play') return;
      selected = [];
      feedbackMsg = '';
      render();
    }

    function submitSelection() {
      if (submitting || paused || phase !== 'play' || selected.length !== 4) return;
      submitting = true;

      const selectedTiles = selected.map((txt) => tiles.find((t) => t.text === txt)).filter(Boolean);
      const comboKey = selected.map((s) => s.toLowerCase()).sort().join('|');

      // Check if all 4 belong to the same group
      const groupCounts = new Map();
      for (const st of selectedTiles) {
        groupCounts.set(st.groupIndex, (groupCounts.get(st.groupIndex) || 0) + 1);
      }

      let maxMatchGroup = -1;
      let maxMatchCount = 0;
      for (const [gi, cnt] of groupCounts.entries()) {
        if (cnt > maxMatchCount) {
          maxMatchCount = cnt;
          maxMatchGroup = gi;
        }
      }

      const elapsedMs = _clock ? _clock.getElapsedMs() : 0;

      if (maxMatchCount === 4) {
        totalSubmissions++;
        correctSubmissions++;
        combo++;
        const scored = engine ? engine.scoreCorrect(elapsedMs, 0, combo) : { points: 100 };
        score += scored.points;
        if (engine) engine.setHudScore(`${_t('wall.score_label')} ${score}`);

        const grp = activeWall.groups[maxMatchGroup];
        solvedGroups.push(grp);
        const solvedSet = new Set(grp.items);
        tiles = tiles.filter((t) => !solvedSet.has(t.text));
        selected = [];
        feedbackMsg = `${_t('wall.group_solved', { name: grp.labelZh })} (+${scored.points})`;
        feedbackIsOk = true;
        lastMistakeFacts = null;
        _announce(feedbackMsg);

        // Log unified attempt (does not promote Leitner box — Section 3.2)
        if (attemptsStore) {
          const matchedCard = cardsStore
            ? grp.items.map((it) => cardsStore.findByWord(it)).find(Boolean)
            : null;
          attemptsStore.record({
            source: 'wall',
            sessionId,
            cardId: matchedCard ? matchedCard.id : null,
            itemId: `${activeWall.id}:${grp.label}`,
            skill: grp.skill,
            correct: true,
            userAnswer: grp.items.join(', '),
            expected: grp.items.join(', '),
            errorType: null,
            wrongLetters: [],
            ms: elapsedMs,
          });
        }

        submitting = false;
        if (solvedGroups.length === 4) {
          finishGame(true);
        } else {
          render();
        }
        return;
      }

      // Duplicate wrong submission -> warn without deducting a mistake
      if (triedWrongKeys.has(comboKey)) {
        feedbackMsg = _t('wall.already_tried');
        feedbackIsOk = false;
        _announce(feedbackMsg);
        submitting = false;
        render();
        return;
      }
      triedWrongKeys.add(comboKey);

      // Wrong submission: deduct mistake, reset combo, log confusion pairs (NO box-1 drop!)
      totalSubmissions++;
      mistakesLeft = Math.max(0, mistakesLeft - 1);
      combo = 0;

      // Record confusion pairs across items from DIFFERENT true groups (Section 4.5.4)
      if (engine) {
        for (let i = 0; i < selectedTiles.length; i++) {
          for (let j = i + 1; j < selectedTiles.length; j++) {
            if (selectedTiles[i].groupIndex !== selectedTiles[j].groupIndex) {
              const pair = engine.recordConfusionPair(
                selectedTiles[i].text,
                selectedTiles[j].text,
                { source: 'wall', wallId: activeWall.id }
              );
              if (pair) loggedConfusions.push(pair);
            }
          }
        }
      }

      // Log unified attempt (errorType: 'confusion')
      if (attemptsStore) {
        const primaryGroup = activeWall.groups[maxMatchGroup] || activeWall.groups[0];
        attemptsStore.record({
          source: 'wall',
          sessionId,
          cardId: null,
          itemId: activeWall.id,
          skill: primaryGroup ? primaryGroup.skill : 'vocab',
          correct: false,
          userAnswer: selected.join(', '),
          expected: primaryGroup ? primaryGroup.items.join(', ') : null,
          errorType: 'confusion',
          wrongLetters: [],
          ms: elapsedMs,
        });
      }

      feedbackIsOk = false;
      feedbackMsg = maxMatchCount === 3 ? _t('wall.one_away') : _t('wall.wrong_group');

      // Capture grounded FACTS for Feature A ("為什麼錯？" during play & end-screen review)
      const skillsPresent = Array.from(new Set(selectedTiles.map((t) => t.skill)));
      const cardMeanings = [];
      let primaryCard = null;
      if (cardsStore) {
        for (const st of selectedTiles) {
          const found = cardsStore.findByWord(st.text);
          if (found) {
            if (!primaryCard) primaryCard = found;
            cardMeanings.push({ word: found.word, zh: found.zh, pos: found.pos });
          }
        }
      }
      const majGrp = activeWall.groups[maxMatchGroup];
      const matchedItems = selectedTiles.filter((t) => t.groupIndex === maxMatchGroup).map((t) => t.text);
      const oddItems = selectedTiles
        .filter((t) => t.groupIndex !== maxMatchGroup)
        .map((t) => ({
          item: t.text,
          groupLabel: activeWall.groups[t.groupIndex].label,
          groupLabelZh: activeWall.groups[t.groupIndex].labelZh,
        }));

      const baseFacts = {
        game: 'wall',
        cardId: primaryCard ? primaryCard.id : null,
        word: primaryCard ? primaryCard.word : null,
        meaningZh: primaryCard ? primaryCard.zh : null,
        pos: primaryCard ? primaryCard.pos : null,
        errorType: 'confusion',
        selectedItems: selectedTiles.map((t) => t.text),
        isOneAway: maxMatchCount === 3,
        distinctGroupCount: groupCounts.size,
        skillsPresent,
        cardMeanings,
      };
      lastMistakeFacts = Object.assign({}, baseFacts, { spoilerSafe: true });
      sessionMistakes.push(Object.assign({}, baseFacts, {
        spoilerSafe: false,
        majorityGroup: majGrp ? {
          label: majGrp.label,
          labelZh: majGrp.labelZh,
          ruleZh: majGrp.ruleZh,
          matchedItems,
        } : null,
        oddItems,
      }));

      _announce(feedbackMsg);
      if (App.toast && maxMatchCount === 3) {
        App.toast.show(_t('wall.one_away'));
      }

      submitting = false;
      if (mistakesLeft <= 0) {
        finishGame(false);
      } else {
        render();
      }
    }

    function renderStart() {
      const prog = _loadProgress();
      const best = engine ? engine.getBestScore('wall') : null;
      const dailyDone = Boolean(prog.solvedDays[today]);

      const skillTabs = ['vocab', 'grammar', 'dialogue'].map((s) =>
        el('span', { className: 'skill-tab skill-tab--' + s, text: _t('skill.' + s) })
      );

      const dailySection = dailyWall ? el('div', { className: 'wall-daily-card' }, [
        el('div', {}, [
          el('div', { className: 'text-small text-muted', text: `${_t('timetable.wall')} · ${today}` }),
          el('h2', { className: 'wall-daily-title', text: wallTitle(dailyWall) }),
          dailyDone ? el('span', { className: 'wall-pick-solved text-small', text: `○ ${_t('timetable.done')}` }) : null,
        ]),
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          'data-wall-start': 'daily',
          onClick: () => startWall(dailyWall, 'daily'),
        }, [el('span', { className: 'btn-label', text: dailyDone ? _t('wall.replay_daily') : _t('wall.play_daily') })]),
      ]) : el('p', { className: 'text-muted', text: _t('error.load') });

      const practiceButtons = walls.map((w, i) => {
        const isSolved = prog.solvedIds.includes(w.id);
        return el('button', {
          type: 'button',
          className: 'wall-pick-btn',
          'data-wall-id': w.id,
          onClick: () => startWall(w, 'practice'),
        }, [
          el('div', { className: 'wall-pick-head' }, [
            el('span', { text: `#${String(i + 1).padStart(2, '0')}` }),
            isSolved ? el('span', { className: 'wall-pick-solved', text: `○ ${_t('timetable.done')}` }) : null,
          ]),
          el('div', { className: 'wall-pick-name', text: wallTitle(w) }),
        ]);
      });

      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          el('div', { className: 'page-header' }, [
            el('h1', { className: 'page-title', text: _t('games.wall.name') }),
          ]),
          el('section', { className: 'wall-start-hero', 'data-wall-phase': 'start' }, [
            el('p', { style: 'margin: 0;', text: _t('wall.rules_short') }),
            el('div', { className: 'wall-start-meta' }, [
              el('div', { className: 'skill-tabs' }, skillTabs),
              el('span', {
                className: 'wall-best-pill',
                text: best !== null ? `${_t('games.personal_best')} · ${best}` : `${_t('games.personal_best')} · —`,
              }),
            ]),
            dailySection,
          ]),
          el('section', {}, [
            el('h2', { className: 'wall-picker-title', text: _t('wall.practice_heading', { n: walls.length }) }),
            el('div', { className: 'wall-picker-grid' }, practiceButtons),
          ]),
        ])
      );
    }

    function renderSolvedRow(grp, interactiveChips) {
      return el('div', { className: `wall-solved-row wall-solved-row--${grp.level}` }, [
        el('div', { className: 'wall-solved-head' }, [
          el('span', { className: 'wall-solved-label', text: grp.labelZh }),
          el('span', { className: 'wall-solved-skill', text: _t('skill.' + grp.skill) }),
        ]),
        interactiveChips
          ? el('div', { className: 'wall-end-chips' }, grp.items.map((item) => {
            const exists = cardsStore && cardsStore.findByWord(item);
            return el('button', {
              type: 'button',
              className: 'wall-item-chip',
              title: exists ? _t('cards.detail') : _t('wall.add_to_deck'),
              onClick: () => openItemAction(item),
            }, [
              el('span', { text: item }),
              el('span', { text: exists ? '↗' : '+' }),
            ]);
          }))
          : el('div', { className: 'wall-solved-items', text: grp.items.join(' · ') }),
        el('div', { className: 'wall-solved-rule', text: grp.ruleZh }),
      ]);
    }

    function renderPlay() {
      const dots = [];
      for (let i = 0; i < MAX_MISTAKES; i++) {
        dots.push(el('span', {
          className: 'wall-dot' + (i >= mistakesLeft ? ' is-spent' : ''),
          'aria-hidden': 'true',
        }));
      }

      const statusBar = el('div', { className: 'wall-status-bar' }, [
        el('div', { className: 'wall-mistakes', 'aria-label': _t('wall.mistakes_left', { n: mistakesLeft }) }, [
          el('span', { text: _t('wall.mistakes_label') }),
          el('span', { className: 'wall-dots' }, dots),
        ]),
        combo >= 3
          ? el('span', { className: 'wall-combo-badge', text: _t('game.combo', { n: combo }) })
          : null,
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          onClick: () => {
            if (_clock) _clock.pause();
            else { paused = true; render(); }
          },
        }, [el('span', { className: 'btn-label', text: _t('game.pause') })]),
      ]);

      const solvedBlock = solvedGroups.length
        ? el('div', { className: 'wall-solved-list' }, solvedGroups.map((g) => renderSolvedRow(g, false)))
        : null;

      if (paused) {
        _root.replaceChildren(
          el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
            el('div', { className: 'wall-board-wrap', 'data-wall-phase': 'paused' }, [
              el('div', { className: 'wall-pause-box' }, [
                el('h2', { className: 'review-summary-title', text: _t('game.paused_title') }),
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
            ]),
          ])
        );
        return;
      }

      const grid = el('div', { className: 'wall-grid', role: 'group', 'aria-label': wallTitle(activeWall) }, tiles.map((tile) => {
        const isSel = selected.includes(tile.text);
        const isLong = tile.text.length > 10 || tile.text.includes(' ');
        return el('button', {
          type: 'button',
          className: 'wall-tile' + (isLong ? ' wall-tile--long' : '') + (isSel ? ' is-selected' : ''),
          'aria-pressed': String(isSel),
          'data-tile': tile.text,
          disabled: submitting,
          onClick: () => toggleTile(tile.text),
        }, [el('span', { text: tile.text })]);
      }));

      const feedbackEl = el('div', {
        className: 'wall-feedback' + (feedbackIsOk ? ' wall-feedback--ok' : ''),
        role: 'status',
        'aria-live': 'polite',
        text: feedbackMsg,
      });

      const actions = el('div', { className: 'wall-actions' }, [
        el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: shuffleBoard,
        }, [el('span', { className: 'btn-label', text: _t('wall.shuffle') })]),
        el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          disabled: selected.length === 0,
          onClick: deselectAll,
        }, [el('span', { className: 'btn-label', text: _t('wall.deselect') })]),
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          disabled: selected.length !== 4 || submitting,
          'data-wall-submit': 'true',
          onClick: submitSelection,
        }, [el('span', { className: 'btn-label', text: _t('wall.submit') })]),
      ]);

      function openExplainMistake(factsObj) {
        const launch = () => {
          if (App.aiPanel) {
            _activeAiPanel = App.aiPanel.openModal(factsObj, { title: _t('ai.panel_title') });
          }
        };
        if (App.aiPanel) {
          launch();
        } else if (App.loadScripts) {
          if (App.loadStyles) App.loadStyles(['css/pages/ai.css']);
          App.loadScripts(['js/ai/templates.js', 'js/ai/nano.js', 'js/ai/qwen.js', 'js/ai/index.js', 'js/ui/ai-panel.js'])
            .then(launch)
            .catch(() => { if (App.toast) App.toast.show(_t('error.load')); });
        }
      }

      const whyWrongRow = lastMistakeFacts
        ? el('div', { className: 'wall-why-row' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            'data-wall-why': 'true',
            onClick: () => openExplainMistake(lastMistakeFacts),
          }, [el('span', { className: 'btn-label', text: _t('wall.why_wrong') })]),
        ])
        : null;

      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          el('div', { className: 'wall-board-wrap', 'data-wall-phase': 'play' }, [
            el('div', { className: 'page-header', style: 'margin-bottom: 0;' }, [
              el('h1', { className: 'page-title', text: wallTitle(activeWall) }),
              el('span', { className: 'card-badge', text: mode === 'daily' ? _t('timetable.wall') : _t('wall.mode_practice') }),
            ]),
            statusBar,
            solvedBlock,
            grid,
            feedbackEl,
            whyWrongRow,
            actions,
          ]),
        ])
      );
    }

    function renderEnd() {
      const mistakesUsed = MAX_MISTAKES - mistakesLeft;
      const stampTitle = won
        ? (mistakesUsed === 0 ? _t('wall.stamp_perfect') : _t('wall.stamp_clear'))
        : _t('wall.stamp_over');

      const sortedGroups = activeWall.groups.slice().sort((a, b) => a.level - b.level);
      const prog = _loadProgress();
      const nextWall = walls.find((w) => w.id !== activeWall.id && !prog.solvedIds.includes(w.id))
        || walls.find((w) => w.id !== activeWall.id)
        || activeWall;

      const actions = [];
      if (mistakesUsed > 0 && sessionMistakes.length > 0) {
        actions.push(
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            'data-wall-ai-end': 'true',
            onClick: () => {
              const latestMistake = sessionMistakes[sessionMistakes.length - 1];
              const launch = () => {
                if (App.aiPanel) {
                  _activeAiPanel = App.aiPanel.openModal(latestMistake, { title: _t('ai.panel_title') });
                }
              };
              if (App.aiPanel) {
                launch();
              } else if (App.loadScripts) {
                if (App.loadStyles) App.loadStyles(['css/pages/ai.css']);
                App.loadScripts(['js/ai/templates.js', 'js/ai/nano.js', 'js/ai/qwen.js', 'js/ai/index.js', 'js/ui/ai-panel.js'])
                  .then(launch)
                  .catch(() => { if (App.toast) App.toast.show(_t('error.load')); });
              }
            },
          }, [el('span', { className: 'btn-label', text: _t('game.ai_explain') })])
        );
      }
      if (nextWall) {
        actions.push(
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            onClick: () => startWall(nextWall, 'practice'),
          }, [el('span', { className: 'btn-label', text: _t('wall.next_wall') })])
        );
      }
      actions.push(
        el('a', { className: 'btn btn-secondary', href: '#/games/class13' }, [
          el('span', { className: 'btn-label', text: _t('wall.go_class13') }),
        ])
      );
      actions.push(
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          onClick: () => { phase = 'start'; render(); },
        }, [el('span', { className: 'btn-label', text: _t('wall.choose_another') })])
      );

      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          el('section', { className: 'wall-end-card', 'data-wall-phase': 'end' }, [
            el('div', { className: 'wall-end-head' }, [
              App.stamp ? App.stamp.create({ title: stampTitle, sub: today, animate: true }) : null,
              el('h1', { className: 'review-summary-title', text: wallTitle(activeWall) }),
              el('p', {
                className: 'text-muted',
                style: 'margin: 0;',
                text: _t('wall.end_summary', { score, mistakes: mistakesUsed, max: MAX_MISTAKES }),
              }),
              el('p', { className: 'text-small text-muted', style: 'margin: 0;', text: _t('wall.tap_item_hint') }),
            ]),
            el('div', { className: 'wall-solved-list' }, sortedGroups.map((g) => renderSolvedRow(g, true))),
            el('div', { className: 'review-summary-actions' }, actions),
          ]),
        ])
      );
    }

    function render() {
      if (!_root) return;
      if (phase === 'start') renderStart();
      else if (phase === 'play') renderPlay();
      else if (phase === 'end') renderEnd();
    }

    // Background warm-up ONLY when Qwen is already cached in Cache Storage (never auto-downloads)
    if (typeof window !== 'undefined' && window.caches && App.store && App.store.settings) {
      const prefAi = App.store.settings.get('aiEngine') || 'auto';
      if (prefAi === 'auto' || prefAi === 'qwen') {
        window.caches.open('transformers-cache').then((c) => c.keys()).then((keys) => {
          const hasQwen = keys.some((r) => r.url.includes('Qwen2.5-0.5B-Instruct'));
          if (!hasQwen) return;
          const doWarm = () => {
            if (App.ai && typeof App.ai.warmUpIfCached === 'function') App.ai.warmUpIfCached();
          };
          if (App.ai && App.ai.qwen) doWarm();
          else if (App.loadScripts) {
            App.loadScripts(['js/ai/templates.js', 'js/ai/nano.js', 'js/ai/qwen.js', 'js/ai/index.js']).then(doWarm).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    // Optional direct launch query: #/games/wall?mode=daily or ?wall=w-01 (and ?instant=1 for tests)
    const q = (params && params.query) || {};
    if (q.wall) {
      const target = walls.find((w) => w.id === q.wall);
      if (target) {
        startWall(target, 'practice', { skipCountdown: q.instant === '1' });
        return;
      }
    } else if (q.mode === 'daily' && dailyWall) {
      startWall(dailyWall, 'daily', { skipCountdown: q.instant === '1' });
      return;
    }

    render();
  }

  function unmount() {
    _cleanup();
    _root = null;
  }

  App.games.wall = {
    mount,
    unmount,
    getValidWalls,
    getDailyWall,
  };
})();
