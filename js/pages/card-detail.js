/**
 * Card detail page (#/cards/:id) with 3D Flashcard, TTS pronunciation,
 * Edit, Hide/Unhide (builtin & user), Delete with 5s Undo (user only),
 * Deck checkboxes, and Learning History tab (Section 3.7).
 * @namespace App.pages.cardDetail
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  let _root = null;
  let _activeTab = 'info';

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function mount(root, params) {
    _root = root;
    _activeTab = 'info';
    const { el, clear } = App.dom;
    const cardsStore = App.store.cards;
    const decksStore = App.store.decks;
    const leitnerStore = App.store.leitner;
    const settingsStore = App.store.settings;
    const cardId = params && params.id;

    function render() {
      if (!_root) return;
      const card = cardsStore.getById(cardId);

      if (!card) {
        _root.replaceChildren(
          el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
            el('div', { className: 'page-header' }, [
              el('a', { className: 'btn btn-ghost', href: '#/cards' }, [
                el('span', { className: 'btn-label', text: '← ' + _t('btn.back') }),
              ]),
              el('h1', { className: 'page-title', text: _t('cards.detail') }),
            ]),
            el('div', { className: 'state-box' }, [
              el('p', { className: 'text-muted', text: _t('cards.not_found') }),
              el('a', { className: 'btn btn-primary', href: '#/cards' }, [
                el('span', { className: 'btn-label', text: _t('cards.back_to_list') }),
              ]),
            ]),
          ])
        );
        return;
      }

      const progress = leitnerStore.get(card.id);
      const customDecks = decksStore.getAll().filter((d) => !d.isDefaultAll);
      const assignedIds = new Set(decksStore.getDecksForCard(card.id).map((d) => d.id));

      const panelBody = el('div');

      function renderPanel() {
        clear(panelBody);
        if (_activeTab === 'history') {
          const attemptsStore = App.store.attempts;
          const attempts = attemptsStore ? attemptsStore.getByCard(card.id) : [];
          const firstDate = progress && (progress.firstSeenDay || progress.firstSeen || progress.lastSeen)
            ? (progress.firstSeenDay || new Date(progress.firstSeen || progress.lastSeen).toLocaleDateString())
            : '—';

          panelBody.appendChild(
            el('div', { className: 'detail-meta-grid' }, [
              el('div', { className: 'detail-meta-item' }, [
                el('div', { className: 'detail-meta-label', text: _t('cards.hist.first_seen') }),
                el('div', { className: 'detail-meta-value', text: firstDate }),
              ]),
              el('div', { className: 'detail-meta-item' }, [
                el('div', { className: 'detail-meta-label', text: _t('cards.hist.accuracy') }),
                el('div', {
                  className: 'detail-meta-value',
                  text: progress && progress.seen ? `${progress.correct}/${progress.seen}` : '—',
                }),
              ]),
            ])
          );
          if (card.aiTip) {
            panelBody.appendChild(el('div', { className: 'flashcard-tip', text: `${_t('cards.ai_tip')}：${card.aiTip}` }));
          }
          if (card.myExample) {
            panelBody.appendChild(el('div', { className: 'flashcard-tip', text: `${_t('cards.my_example')}：${card.myExample}` }));
          }
          if (!attempts.length) {
            panelBody.appendChild(el('p', { className: 'text-muted text-small', text: _t('cards.hist.empty') }));
            return;
          }

          const sourceMap = {
            card: 'review.source.card',
            class13: 'timetable.class13',
            guess: 'timetable.guess',
            wall: 'games.wall.name',
          };
          const answerLabel = (ans) => {
            if (ans === 'know') return _t('cards.know');
            if (ans === 'fuzzy') return _t('review.fuzzy');
            if (ans === 'unknown') return _t('cards.unknown');
            return ans ? String(ans) : '';
          };

          const list = el('ul', { className: 'history-list', 'data-card-history': 'true' }, attempts.slice(0, 30).map((a) => {
            const mark = a.correct ? '○' : '✗';
            const markCls = 'history-mark ' + (a.correct ? 'history-mark--ok' : 'history-mark--no');
            const detail = answerLabel(a.userAnswer);
            return el('li', { className: 'history-item' }, [
              el('div', { className: 'history-item-main' }, [
                el('span', { className: markCls, text: mark }),
                el('span', { className: 'card-badge', text: _t(sourceMap[a.source] || 'review.source.card') }),
                detail ? el('span', { text: detail }) : null,
              ]),
              el('span', { className: 'history-item-time', text: a.dayKey }),
            ]);
          }));
          panelBody.appendChild(list);
          return;
        }

        panelBody.appendChild(
          el('div', { className: 'detail-meta-grid' }, [
            el('div', { className: 'detail-meta-item' }, [
              el('div', { className: 'detail-meta-label', text: _t('cards.meta.box') }),
              el('div', {
                className: 'detail-meta-value',
                text: progress ? _t('review.box', { n: progress.box }) : _t('cards.box_unseen'),
              }),
            ]),
            el('div', { className: 'detail-meta-item' }, [
              el('div', { className: 'detail-meta-label', text: _t('cards.meta.due') }),
              el('div', {
                className: 'detail-meta-value',
                text: progress ? progress.due : '—',
              }),
            ]),
            el('div', { className: 'detail-meta-item' }, [
              el('div', { className: 'detail-meta-label', text: _t('cards.meta.source') }),
              el('div', {
                className: 'detail-meta-value',
                text: card.source === 'builtin' ? _t('cards.source_builtin') : _t('cards.source_user'),
              }),
            ]),
            el('div', { className: 'detail-meta-item' }, [
              el('div', { className: 'detail-meta-label', text: _t('cards.meta.mistakes') }),
              el('div', {
                className: 'detail-meta-value',
                text: String(progress ? progress.wrong : 0),
              }),
            ]),
          ])
        );

        if (card.tags && card.tags.length) {
          panelBody.appendChild(
            el('div', { className: 'card-tile-badges' }, card.tags.map((tag) =>
              el('span', { className: 'card-badge', text: tag })
            ))
          );
        }

        if (customDecks.length) {
          panelBody.appendChild(el('div', { className: 'field-label', text: _t('cards.form.decks') }));
          panelBody.appendChild(
            el('div', { className: 'deck-check-list' }, customDecks.map((d) => {
              const cb = el('input', {
                type: 'checkbox',
                checked: assignedIds.has(d.id),
                onChange: () => {
                  if (cb.checked) assignedIds.add(d.id);
                  else assignedIds.delete(d.id);
                  decksStore.setCardDecks(card.id, Array.from(assignedIds));
                },
              });
              return el('label', { className: 'deck-check-item' }, [cb, el('span', { text: d.name })]);
            }))
          );
        }
      }

      const infoTabBtn = el('button', {
        type: 'button',
        className: 'tab-btn',
        role: 'tab',
        'aria-selected': String(_activeTab === 'info'),
        text: _t('cards.tab_info'),
        onClick: () => {
          _activeTab = 'info';
          infoTabBtn.setAttribute('aria-selected', 'true');
          histTabBtn.setAttribute('aria-selected', 'false');
          renderPanel();
        },
      });

      const histTabBtn = el('button', {
        type: 'button',
        className: 'tab-btn',
        role: 'tab',
        'aria-selected': String(_activeTab === 'history'),
        text: _t('cards.history'),
        onClick: () => {
          _activeTab = 'history';
          infoTabBtn.setAttribute('aria-selected', 'false');
          histTabBtn.setAttribute('aria-selected', 'true');
          renderPanel();
        },
      });

      const flashcard = App.flashcard.create(card, {
        onSpeak: (slow) => {
          if (App.audio && App.audio.tts) App.audio.tts.speak(card.word, { slow });
        },
        onHistory: () => {
          histTabBtn.click();
          panelBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
      });

      if (App.audio && App.audio.tts && App.audio.tts.isSupported() && settingsStore && settingsStore.get('autoPlayPronunciation')) {
        App.audio.tts.speak(card.word, { slow: false, silent: true });
      }

      const actionButtons = [
        el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: () => App.cardForm.open({ card, onSaved: render }),
        }, [el('span', { className: 'btn-label', text: _t('btn.edit') })]),
        el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: () => {
            const nextHidden = !card.hidden;
            cardsStore.setHidden(card.id, nextHidden);
            render();
            if (nextHidden && App.toast) {
              App.toast.show(_t('cards.undo_hide', { word: card.word }), {
                duration: 5000,
                actionLabel: _t('btn.undo'),
                onAction: () => {
                  cardsStore.setHidden(card.id, false);
                  if (_root) render();
                },
              });
            }
          },
        }, [el('span', { className: 'btn-label', text: card.hidden ? _t('cards.unhide') : _t('cards.hide') })]),
      ];

      if (card.source === 'user') {
        actionButtons.push(
          el('button', {
            type: 'button',
            className: 'btn btn-danger',
            onClick: () => {
              const snapshot = cardsStore.removeUserCard(card.id);
              if (snapshot && App.toast) {
                App.toast.show(_t('cards.undo_delete', { word: card.word }), {
                  duration: 5000,
                  actionLabel: _t('btn.undo'),
                  onAction: () => {
                    cardsStore.restoreUserCard(snapshot);
                    if (App.router) App.router.go('#/cards/' + encodeURIComponent(card.id));
                  },
                });
              }
              if (App.router) App.router.go('#/cards');
            },
          }, [el('span', { className: 'btn-label', text: _t('btn.delete') })])
        );
      }

      renderPanel();

      _root.replaceChildren(
        el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
          el('div', { className: 'page-header' }, [
            el('a', { className: 'btn btn-ghost', href: '#/cards' }, [
              el('span', { className: 'btn-label', text: '← ' + _t('btn.back') }),
            ]),
            el('h1', { className: 'page-title', text: card.word }),
            card.hidden ? el('span', { className: 'card-badge', text: _t('cards.badge_hidden') }) : null,
          ]),
          el('div', { className: 'detail-layout' }, [
            flashcard.root,
            el('section', { className: 'detail-panel' }, [
              el('div', { className: 'tabs', role: 'tablist' }, [infoTabBtn, histTabBtn]),
              panelBody,
              el('div', { className: 'detail-actions' }, actionButtons),
            ]),
          ]),
        ])
      );
    }

    render();
  }

  function unmount() {
    if (App.audio && App.audio.tts) App.audio.tts.stop();
    _root = null;
  }

  App.pages.cardDetail = { mount, unmount };
})();
