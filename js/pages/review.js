/**
 * Today's Review page (#/review) — Leitner 5-box spaced repetition loop (M4).
 *
 * Spec coverage (Section 3.2, 3.3 B, 3.8, 6.1):
 * - Session max 20 cards (due cards first, topped up with new cards up to dailyNewWords).
 * - Front: word + optional IPA + speaker/slow buttons; honors autoPlayPronunciation.
 * - Flip via click/tap or Space (400ms flip lock in App.flashcard).
 * - Rate after flip: 1 = 還不熟 (box 1), 2 = 有點印象 (same box, due tomorrow), 3 = 記住了 (box + 1, max 5).
 * - Mobile horizontal swipe left/right rates ONLY after flip (via App.flashcard onRate).
 * - Writes to both App.store.leitner and App.store.attempts; saves completed session only.
 * - End screen: commemorative stamp, outcome counts, CTA "把不熟的字拿去玩遊戲" -> #/games/class13?words=...
 * - No-due empty state: "今天的卡片都複習完了。" + "學習新單字" + "去玩遊戲".
 * @namespace App.pages.review
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  const MAX_SESSION_CARDS = 20;

  let _root = null;
  let _keyHandler = null;
  let _nextTimer = null;

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _announce(msg) {
    const el = document.getElementById('announcer');
    if (el) el.textContent = msg;
  }

  function _sourceLabel(source) {
    const map = {
      card: 'review.source.card',
      class13: 'timetable.class13',
      guess: 'timetable.guess',
      wall: 'games.wall.name',
    };
    return _t(map[source] || 'review.source.card');
  }

  function _openCardHistoryModal(card) {
    if (!App.modal || !App.store.attempts) return;
    const { el } = App.dom;
    const attempts = App.store.attempts.getByCard(card.id);
    const body = el('div', { style: 'display: flex; flex-direction: column; gap: var(--space-3);' });

    if (!attempts.length) {
      body.appendChild(el('p', { className: 'text-muted text-small', text: _t('cards.hist.empty') }));
    } else {
      const list = el('ul', { className: 'history-list' }, attempts.slice(0, 12).map((a) => {
        const mark = a.correct ? '○' : '✗';
        const markCls = 'history-mark ' + (a.correct ? 'history-mark--ok' : 'history-mark--no');
        return el('li', { className: 'history-item' }, [
          el('div', { className: 'history-item-main' }, [
            el('span', { className: markCls, text: mark }),
            el('span', { className: 'card-badge', text: _sourceLabel(a.source) }),
            a.userAnswer ? el('span', { text: _ratingLabel(a.userAnswer) }) : null,
          ]),
          el('span', { className: 'history-item-time', text: a.dayKey }),
        ]);
      }));
      body.appendChild(list);
    }

    App.modal.open({
      title: `${card.word} · ${_t('cards.history')}`,
      body,
      actions: [{ label: _t('btn.close'), variant: 'secondary' }],
    });
  }

  function _ratingLabel(code) {
    if (code === 'know') return _t('cards.know');
    if (code === 'fuzzy') return _t('review.fuzzy');
    if (code === 'unknown') return _t('cards.unknown');
    return String(code);
  }

  function _cleanupRuntime() {
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
      _keyHandler = null;
    }
    if (_nextTimer) {
      clearTimeout(_nextTimer);
      _nextTimer = null;
    }
    if (App.audio && App.audio.tts) {
      App.audio.tts.stop();
    }
  }

  function mount(root, params) {
    _cleanupRuntime();
    _root = root;

    const { el } = App.dom;
    const cardsStore = App.store.cards;
    const decksStore = App.store.decks;
    const leitnerStore = App.store.leitner;
    const attemptsStore = App.store.attempts;
    const settingsStore = App.store.settings;

    const queryDeck = params && params.query && params.query.deck ? params.query.deck : 'all';
    const validDecks = decksStore ? decksStore.getAll() : [];
    let selectedDeckId = queryDeck === 'all' || validDecks.some((d) => d.id === queryDeck) ? queryDeck : 'all';

    // Session state
    let queue = [];
    let totalDueInPool = 0;
    let totalUnseenInPool = 0;
    let index = 0;
    let sessionId = '';
    let sessionStartedAt = 0;
    let cardShownAt = 0;
    let currentCard = null;
    let currentFlashcard = null;
    let hasFlipped = false;
    let ratingLocked = false;
    let finished = false;
    let counts = { know: 0, fuzzy: 0, unknown: 0 };
    let weakCardIds = [];
    let fuzzyCardIds = [];

    function getPoolIds() {
      if (selectedDeckId && selectedDeckId !== 'all' && decksStore) {
        return decksStore.getCardIds(selectedDeckId);
      }
      return cardsStore.getAll({ includeHidden: false }).map((c) => c.id);
    }

    function startSession(opts) {
      const o = opts || {};
      const poolIds = getPoolIds();
      const built = leitnerStore.buildReviewQueue(poolIds, {
        maxCards: MAX_SESSION_CARDS,
        forceNewOnly: Boolean(o.forceNewOnly),
      });
      queue = built.queue.map((id) => cardsStore.getById(id)).filter(Boolean);
      totalDueInPool = built.totalDue;
      totalUnseenInPool = built.totalUnseen;
      index = 0;
      finished = false;
      sessionId = 'rev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      sessionStartedAt = Date.now();
      counts = { know: 0, fuzzy: 0, unknown: 0 };
      weakCardIds = [];
      fuzzyCardIds = [];
      render();
    }

    function rateCurrent(rating) {
      if (ratingLocked || !currentCard || !hasFlipped || finished) return;
      ratingLocked = true;

      const card = currentCard;
      const ms = Math.max(0, Date.now() - cardShownAt);
      const updated = leitnerStore.rateCard(card.id, rating);

      if (attemptsStore) {
        attemptsStore.record({
          source: 'card',
          sessionId,
          cardId: card.id,
          skill: 'vocab',
          correct: rating !== 'unknown',
          userAnswer: rating,
          expected: card.word,
          errorType: rating === 'unknown' ? 'meaning' : null,
          wrongLetters: [],
          ms,
        });
      }

      if (rating === 'know') {
        counts.know++;
        _announce(`${_t('cards.know')} · ${_t('review.promoted', { n: updated.box })}`);
      } else if (rating === 'fuzzy') {
        counts.fuzzy++;
        fuzzyCardIds.push(card.id);
        _announce(`${_t('review.fuzzy')} · ${_t('review.box', { n: updated.box })}`);
      } else {
        counts.unknown++;
        weakCardIds.push(card.id);
        _announce(`${_t('cards.unknown')} · ${_t('review.demoted')}`);
      }

      if (App.audio && App.audio.tts) App.audio.tts.stop();

      const advance = () => {
        _nextTimer = null;
        index++;
        if (index >= queue.length) {
          finished = true;
          const total = queue.length || 1;
          const accuracy = (counts.know + counts.fuzzy) / total;
          if (attemptsStore) {
            attemptsStore.recordSession({
              id: sessionId,
              source: 'card',
              startedAt: sessionStartedAt,
              endedAt: Date.now(),
              score: counts.know * 10 + counts.fuzzy * 5,
              accuracy,
              details: {
                total: queue.length,
                know: counts.know,
                fuzzy: counts.fuzzy,
                unknown: counts.unknown,
                deckId: selectedDeckId,
              },
            });
          }
        }
        ratingLocked = false;
        render();
      };

      // Brief visual beat on desktop/mobile; synchronous-friendly in unit tests if needed
      _nextTimer = setTimeout(advance, 80);
    }

    function buildHeader(counterText) {
      const deckOptions = [
        el('option', { value: 'all', text: _t('cards.all_decks') }),
      ].concat(validDecks.map((d) => el('option', { value: d.id, text: d.name })));

      const deckSelect = el('select', {
        className: 'select review-deck-select',
        'aria-label': _t('decks.title'),
        onChange: () => {
          selectedDeckId = deckSelect.value;
          startSession({ forceNewOnly: false });
        },
      }, deckOptions);
      deckSelect.value = selectedDeckId;

      return el('div', { className: 'review-header' }, [
        el('h1', { className: 'page-title', text: _t('review.title') }),
        el('div', { className: 'review-controls' }, [
          deckSelect,
          counterText ? el('span', { className: 'review-counter', text: counterText }) : null,
        ]),
      ]);
    }

    function render() {
      if (!_root) return;
      currentCard = null;
      currentFlashcard = null;
      hasFlipped = false;

      // ── State 1: Empty / No due cards (Section 3.8) ─────────
      if (!queue.length) {
        const emptyActions = [];
        if (totalUnseenInPool > 0) {
          emptyActions.push(
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => startSession({ forceNewOnly: true }),
            }, [el('span', { className: 'btn-label', text: _t('review.learn_new') })])
          );
        }
        emptyActions.push(
          el('a', { className: 'btn btn-secondary', href: '#/games' }, [
            el('span', { className: 'btn-label', text: _t('review.play_game') }),
          ])
        );

        _root.replaceChildren(
          el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
            buildHeader('0 / 0'),
            el('section', { className: 'review-empty', 'data-review-state': 'empty' }, [
              App.stamp
                ? App.stamp.create({ title: _t('review.stamp_all_clear'), sub: App.date.todayKey(), animate: false })
                : null,
              el('h2', { className: 'review-summary-title', text: _t('review.done') }),
              el('p', {
                className: 'text-muted',
                text: totalUnseenInPool > 0
                  ? _t('review.empty_sub_more', { n: totalUnseenInPool })
                  : _t('review.empty_sub_all_seen'),
              }),
              el('div', { className: 'review-empty-actions' }, emptyActions),
            ]),
          ])
        );
        return;
      }

      // ── State 2: End screen (Section 3.3 B) ─────────────────
      if (finished) {
        const total = queue.length;
        const pct = Math.round(((counts.know + counts.fuzzy) / total) * 100);
        const gameTargetIds = weakCardIds.length ? weakCardIds : fuzzyCardIds;

        const actions = [];
        if (gameTargetIds.length) {
          actions.push(
            el('a', {
              className: 'btn btn-primary',
              href: '#/games/class13?words=' + encodeURIComponent(gameTargetIds.join(',')),
            }, [el('span', { className: 'btn-label', text: _t('review.practice_weak') })])
          );
        }
        actions.push(
          el('button', {
            type: 'button',
            className: 'btn ' + (gameTargetIds.length ? 'btn-secondary' : 'btn-primary'),
            onClick: () => startSession({ forceNewOnly: false }),
          }, [el('span', { className: 'btn-label', text: _t('review.another_round') })])
        );
        actions.push(
          el('a', { className: 'btn btn-ghost', href: '#/' }, [
            el('span', { className: 'btn-label', text: _t('review.back_home') }),
          ])
        );

        _root.replaceChildren(
          el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
            buildHeader(`${total} / ${total}`),
            el('section', { className: 'review-summary', 'data-review-state': 'done' }, [
              App.stamp
                ? App.stamp.create({ title: _t('review.stamp_done'), sub: App.date.todayKey(), animate: true })
                : null,
              el('h2', { className: 'review-summary-title', text: _t('review.session_complete') }),
              el('p', {
                className: 'text-muted',
                text: _t('review.session_summary_line', { total, pct }),
              }),
              el('div', { className: 'review-summary-stats' }, [
                el('div', { className: 'review-stat-box' }, [
                  el('div', { className: 'review-stat-num review-stat-num--know', text: `○ ${counts.know}` }),
                  el('div', { className: 'review-stat-label', text: _t('cards.know') }),
                ]),
                el('div', { className: 'review-stat-box' }, [
                  el('div', { className: 'review-stat-num', text: `△ ${counts.fuzzy}` }),
                  el('div', { className: 'review-stat-label', text: _t('review.fuzzy') }),
                ]),
                el('div', { className: 'review-stat-box' }, [
                  el('div', { className: 'review-stat-num review-stat-num--unknown', text: `✗ ${counts.unknown}` }),
                  el('div', { className: 'review-stat-label', text: _t('cards.unknown') }),
                ]),
              ]),
              el('div', { className: 'review-summary-actions' }, actions),
            ]),
          ])
        );
        return;
      }

      // ── State 3: Active card review ─────────────────────────
      currentCard = queue[index];
      cardShownAt = Date.now();
      const progress = leitnerStore.get(currentCard.id);
      const pctDone = Math.round((index / queue.length) * 100);

      const hintEl = el('div', {
        className: 'review-rate-hint',
        text: _t('review.flip_first_hint'),
      });

      const unknownBtn = el('button', {
        type: 'button',
        className: 'rate-btn rate-btn--unknown',
        disabled: true,
        'data-rate': 'unknown',
        onClick: () => rateCurrent('unknown'),
      }, [
        el('span', { className: 'rate-btn-top' }, [
          el('span', { className: 'rate-btn-mark', text: '✗' }),
          el('span', { text: _t('cards.unknown') }),
        ]),
        el('span', { className: 'rate-btn-key', text: '1' }),
      ]);

      const fuzzyBtn = el('button', {
        type: 'button',
        className: 'rate-btn rate-btn--fuzzy',
        disabled: true,
        'data-rate': 'fuzzy',
        onClick: () => rateCurrent('fuzzy'),
      }, [
        el('span', { className: 'rate-btn-top' }, [
          el('span', { className: 'rate-btn-mark', text: '△' }),
          el('span', { text: _t('review.fuzzy') }),
        ]),
        el('span', { className: 'rate-btn-key', text: '2' }),
      ]);

      const knowBtn = el('button', {
        type: 'button',
        className: 'rate-btn rate-btn--know',
        disabled: true,
        'data-rate': 'know',
        onClick: () => rateCurrent('know'),
      }, [
        el('span', { className: 'rate-btn-top' }, [
          el('span', { className: 'rate-btn-mark', text: '○' }),
          el('span', { text: _t('cards.know') }),
        ]),
        el('span', { className: 'rate-btn-key', text: '3' }),
      ]);

      function unlockRatings() {
        hasFlipped = true;
        unknownBtn.disabled = false;
        fuzzyBtn.disabled = false;
        knowBtn.disabled = false;
        hintEl.textContent = _t('review.rate_hint');
      }

      currentFlashcard = App.flashcard.create(currentCard, {
        onSpeak: (slow) => {
          if (App.audio && App.audio.tts) App.audio.tts.speak(currentCard.word, { slow });
        },
        onFlip: (isFlipped) => {
          if (isFlipped) unlockRatings();
        },
        onRate: (swipeRating) => {
          if (hasFlipped) rateCurrent(swipeRating);
        },
        onHistory: () => _openCardHistoryModal(currentCard),
      });

      if (App.audio && App.audio.tts && App.audio.tts.isSupported() && settingsStore && settingsStore.get('autoPlayPronunciation')) {
        App.audio.tts.speak(currentCard.word, { slow: false, silent: true });
      }

      const statusBadge = progress
        ? _t('review.box', { n: progress.box })
        : _t('cards.box_unseen');

      const progressBar = el('div', { className: 'review-progress-wrap' }, [
        el('div', {
          className: 'review-progress-track',
          role: 'progressbar',
          'aria-valuenow': String(index),
          'aria-valuemin': '0',
          'aria-valuemax': String(queue.length),
          'aria-label': `${index + 1} / ${queue.length}`,
        }, [
          el('div', { className: 'review-progress-fill', style: `width: ${pctDone}%;` }),
        ]),
      ]);

      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          buildHeader(`${index + 1} / ${queue.length}`),
          progressBar,
          el('section', { className: 'review-stage', 'data-review-state': 'active' }, [
            el('div', { className: 'review-meta-row' }, [
              el('span', { className: 'card-badge', text: statusBadge }),
              totalDueInPool > 0
                ? el('span', { className: 'text-small text-muted', text: _t('review.due', { n: totalDueInPool }) })
                : null,
            ]),
            currentFlashcard.root,
            el('div', { className: 'review-rate-panel' }, [
              hintEl,
              el('div', { className: 'review-rate-grid' }, [unknownBtn, fuzzyBtn, knowBtn]),
            ]),
          ]),
        ])
      );
    }

    // Keyboard shortcuts: Space to flip, 1/2/3 to rate after flip
    _keyHandler = (ev) => {
      if (!_root || finished || !currentCard) return;
      if (document.querySelector('.modal-backdrop')) return;
      const tag = ev.target && ev.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (ev.code === 'Space' || ev.key === ' ') {
        // If focus is directly on .flashcard, its own keydown handler flips it
        if (ev.target && ev.target.classList && ev.target.classList.contains('flashcard')) return;
        ev.preventDefault();
        if (currentFlashcard) currentFlashcard.flip();
        return;
      }

      if (!hasFlipped || ratingLocked) return;
      if (ev.key === '1') {
        ev.preventDefault();
        rateCurrent('unknown');
      } else if (ev.key === '2') {
        ev.preventDefault();
        rateCurrent('fuzzy');
      } else if (ev.key === '3') {
        ev.preventDefault();
        rateCurrent('know');
      }
    };

    document.addEventListener('keydown', _keyHandler);
    startSession({ forceNewOnly: false });
  }

  function unmount() {
    _cleanupRuntime();
    _root = null;
  }

  App.pages.review = { mount, unmount };
})();
