/**
 * Cards browse, search, filter, sort, and pagination page (#/cards).
 * Supports 200ms debounced search, deck/box/tag/"my cards"/"hidden" filters,
 * 50-per-page pagination, and Add Card modal with duplicate detection.
 * @namespace App.pages.cards
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  const PAGE_SIZE = 50;

  let _root = null;
  let _debounceTimer = null;
  let _busUnsubs = [];
  let _ttsUnavailable = false;

  const _state = {
    search: '',
    deckId: '',
    box: 'all',
    tag: '',
    onlyMine: false,
    showHidden: false,
    sort: 'az',
    page: 1,
  };

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  /**
   * Allow Decks page to pre-select a deck before navigating to #/cards.
   * @param {string} deckId
   */
  function filterByDeck(deckId) {
    _state.deckId = deckId || '';
    _state.page = 1;
  }

  function _cleanup() {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
    _busUnsubs.forEach((fn) => fn());
    _busUnsubs = [];
    if (App.audio && App.audio.tts) App.audio.tts.stop();
  }

  function mount(root, params) {
    _cleanup();
    _root = root;
    if (params && params.query && typeof params.query.deck === 'string') {
      _state.deckId = params.query.deck;
      _state.page = 1;
    }
    const { el, clear } = App.dom;
    const cardsStore = App.store.cards;
    const decksStore = App.store.decks;
    const leitnerStore = App.store.leitner;

    const searchInput = el('input', {
      type: 'search',
      className: 'input',
      value: _state.search,
      placeholder: _t('cards.search'),
      'aria-label': _t('cards.search'),
      onInput: () => {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          _state.search = searchInput.value;
          _state.page = 1;
          renderList();
        }, 200);
      },
    });

    const deckSelect = el('select', {
      className: 'input',
      'aria-label': _t('decks.title'),
      onChange: () => {
        _state.deckId = deckSelect.value;
        _state.page = 1;
        renderList();
      },
    }, [
      el('option', { value: '', text: _t('cards.all_decks') }),
      ...decksStore.getAll().map((d) => el('option', {
        value: d.id,
        text: d.builtin ? _t('decks.builtin_name') : d.name,
        selected: _state.deckId === d.id ? 'selected' : null,
      })),
    ]);

    const boxSelect = el('select', {
      className: 'input',
      'aria-label': _t('cards.filter_box'),
      onChange: () => {
        _state.box = boxSelect.value;
        _state.page = 1;
        renderList();
      },
    }, [
      el('option', { value: 'all', text: _t('cards.filter_all') }),
      el('option', { value: '0', text: _t('cards.box_unseen'), selected: _state.box === '0' ? 'selected' : null }),
      ...[1, 2, 3, 4, 5].map((b) => el('option', {
        value: String(b),
        text: _t('review.box', { n: b }),
        selected: _state.box === String(b) ? 'selected' : null,
      })),
    ]);

    const tags = cardsStore.listTags();
    const tagSelect = el('select', {
      className: 'input',
      'aria-label': _t('cards.filter_tag'),
      onChange: () => {
        _state.tag = tagSelect.value;
        _state.page = 1;
        renderList();
      },
    }, [
      el('option', { value: '', text: _t('cards.all_tags') }),
      ...tags.map((tg) => el('option', {
        value: tg,
        text: tg,
        selected: _state.tag === tg ? 'selected' : null,
      })),
    ]);

    const sortSelect = el('select', {
      className: 'input',
      'aria-label': _t('cards.sort_label'),
      onChange: () => {
        _state.sort = sortSelect.value;
        _state.page = 1;
        renderList();
      },
    }, [
      el('option', { value: 'az', text: _t('cards.sort.az'), selected: _state.sort === 'az' ? 'selected' : null }),
      el('option', { value: 'newest', text: _t('cards.sort.newest'), selected: _state.sort === 'newest' ? 'selected' : null }),
      el('option', { value: 'mistakes', text: _t('cards.sort.mistakes'), selected: _state.sort === 'mistakes' ? 'selected' : null }),
    ]);

    const mineChip = el('button', {
      type: 'button',
      className: 'chip ' + (_state.onlyMine ? 'is-selected' : ''),
      'aria-pressed': String(_state.onlyMine),
      text: _t('cards.filter_mine'),
      onClick: () => {
        _state.onlyMine = !_state.onlyMine;
        _state.page = 1;
        mineChip.classList.toggle('is-selected', _state.onlyMine);
        mineChip.setAttribute('aria-pressed', String(_state.onlyMine));
        renderList();
      },
    });

    const hiddenChip = el('button', {
      type: 'button',
      className: 'chip ' + (_state.showHidden ? 'is-selected' : ''),
      'aria-pressed': String(_state.showHidden),
      text: _t('cards.filter_hidden'),
      onClick: () => {
        _state.showHidden = !_state.showHidden;
        _state.page = 1;
        hiddenChip.classList.toggle('is-selected', _state.showHidden);
        hiddenChip.setAttribute('aria-pressed', String(_state.showHidden));
        renderList();
      },
    });

    const countEl = el('span', { className: 'cards-count' });
    const listWrap = el('div');

    function resetFilters() {
      _state.search = '';
      _state.deckId = '';
      _state.box = 'all';
      _state.tag = '';
      _state.onlyMine = false;
      _state.showHidden = false;
      _state.page = 1;
      mount(root);
    }

    function renderList() {
      clear(listWrap);
      const allMatches = cardsStore.query({
        search: _state.search,
        deckId: _state.deckId,
        box: _state.box,
        tag: _state.tag,
        onlyMine: _state.onlyMine,
        visibility: _state.showHidden ? 'hidden' : 'active',
        sort: _state.sort,
      });

      const total = allMatches.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (_state.page > totalPages) _state.page = totalPages;

      countEl.textContent = _t('cards.total_count', { n: App.format ? App.format.int(total) : total });

      if (total === 0) {
        const isFiltered = Boolean(_state.search || _state.deckId || _state.box !== 'all' || _state.tag || _state.onlyMine || _state.showHidden);
        listWrap.appendChild(
          el('div', { className: 'state-box' }, [
            el('p', { className: 'text-muted', text: isFiltered ? _t('cards.empty_filtered') : _t('empty.cards') }),
            isFiltered
              ? el('button', {
                  type: 'button',
                  className: 'btn btn-secondary',
                  onClick: resetFilters,
                }, [el('span', { className: 'btn-label', text: _t('cards.reset_filters') })])
              : el('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: () => App.cardForm.open({ onSaved: renderList }),
                }, [el('span', { className: 'btn-label', text: _t('cards.add') })]),
          ])
        );
        return;
      }

      const start = (_state.page - 1) * PAGE_SIZE;
      const pageItems = allMatches.slice(start, start + PAGE_SIZE);
      const progressMap = leitnerStore.getAll();

      const grid = el('div', { className: 'cards-grid' }, pageItems.map((card) => {
        const prog = progressMap[card.id];
        const boxLabel = prog ? _t('review.box', { n: prog.box }) : _t('cards.box_unseen');
        const speakDisabled = _ttsUnavailable;
        const noVoiceMsg = _t('cards.no_english_voice');

        const speakBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-icon',
          disabled: speakDisabled,
          title: speakDisabled ? noVoiceMsg : _t('cards.speak_normal'),
          'aria-label': speakDisabled ? noVoiceMsg : `${_t('cards.speak_normal')} ${card.word}`,
          onClick: () => {
            if (App.audio && App.audio.tts) App.audio.tts.speak(card.word, { slow: false });
          },
        }, [App.icons.svg('speaker')]);

        return el('article', { className: 'card-tile' }, [
          el('div', { className: 'card-tile-head' }, [
            el('a', {
              className: 'card-tile-word',
              href: '#/cards/' + encodeURIComponent(card.id),
              text: card.word,
            }),
            card.pos ? el('span', { className: 'card-badge', text: card.pos }) : null,
          ]),
          el('div', { className: 'card-tile-zh', text: card.zh }),
          el('div', { className: 'card-tile-badges' }, [
            el('span', { className: 'card-badge', text: boxLabel }),
            card.source === 'user' ? el('span', { className: 'card-badge', text: _t('cards.badge_mine') }) : null,
            card.hidden ? el('span', { className: 'card-badge', text: _t('cards.badge_hidden') }) : null,
          ]),
          el('div', { className: 'card-tile-foot' }, [
            speakBtn,
            el('a', {
              className: 'btn btn-ghost',
              href: '#/cards/' + encodeURIComponent(card.id),
            }, [el('span', { className: 'btn-label', text: _t('cards.detail') + ' →' })]),
          ]),
        ]);
      }));

      listWrap.appendChild(grid);

      if (totalPages > 1) {
        const prevBtn = el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          disabled: _state.page <= 1,
          onClick: () => {
            _state.page = Math.max(1, _state.page - 1);
            renderList();
            window.scrollTo({ top: 0 });
          },
        }, [el('span', { className: 'btn-label', text: _t('cards.prev_page') })]);

        const nextBtn = el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          disabled: _state.page >= totalPages,
          onClick: () => {
            _state.page = Math.min(totalPages, _state.page + 1);
            renderList();
            window.scrollTo({ top: 0 });
          },
        }, [el('span', { className: 'btn-label', text: _t('cards.next_page') })]);

        listWrap.appendChild(
          el('div', { className: 'pagination-bar' }, [
            prevBtn,
            el('span', { className: 'mono text-small text-muted', text: `${_state.page} / ${totalPages}` }),
            nextBtn,
          ])
        );
      }
    }

    const page = el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
      el('div', { className: 'page-header' }, [
        el('h1', { className: 'page-title', text: _t('cards.title') }),
        el('div', { className: 'page-header-actions' }, [
          el('a', { className: 'btn btn-secondary', href: '#/decks' }, [
            el('span', { className: 'btn-label', text: _t('decks.title') }),
          ]),
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            onClick: () => App.cardForm.open({
              defaultDeckId: _state.deckId || null,
              onSaved: () => { renderList(); },
            }),
          }, [el('span', { className: 'btn-label', text: _t('cards.add') })]),
        ]),
      ]),
      el('section', { className: 'cards-toolbar' }, [
        el('div', { className: 'cards-controls' }, [searchInput, deckSelect, boxSelect, tagSelect, sortSelect]),
        el('div', { className: 'cards-chip-row' }, [mineChip, hiddenChip, countEl]),
      ]),
      listWrap,
    ]);

    root.replaceChildren(page);
    renderList();

    if (App.audio && App.audio.tts) {
      App.audio.tts.ensureVoices().then((voice) => {
        if (!_root) return;
        const st = App.audio.tts.status();
        const voicesLoaded = typeof window.speechSynthesis !== 'undefined' && window.speechSynthesis.getVoices().length > 0;
        const noVoice = !st.supported || (voicesLoaded && !voice);
        if (noVoice !== _ttsUnavailable) {
          _ttsUnavailable = noVoice;
          renderList();
        }
      });
    }

    if (App.bus) {
      const onUpdate = () => { if (_root) renderList(); };
      App.bus.on('card:updated', onUpdate);
      App.bus.on('progress:changed', onUpdate);
      _busUnsubs.push(() => App.bus.off('card:updated', onUpdate));
      _busUnsubs.push(() => App.bus.off('progress:changed', onUpdate));
    }
  }

  function unmount() {
    _cleanup();
    _root = null;
  }

  App.pages.cards = { mount, unmount, filterByDeck };
})();
