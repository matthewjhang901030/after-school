/**
 * Decks management page (#/decks): create, rename, pick 1 of 5 muted ring colors,
 * reorder via drag-and-drop or Up/Down buttons, delete with 5-second undo toast,
 * and warn when a deck has fewer than 4 cards.
 * @namespace App.pages.decks
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  let _root = null;
  let _dragId = null;

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function mount(root) {
    _root = root;
    const { el, clear } = App.dom;
    const decksStore = App.store.decks;

    function openDeckForm(editingDeck) {
      let chosenColor = editingDeck ? editingDeck.ringColor : 'vocab';
      const nameInput = el('input', {
        type: 'text',
        className: 'input',
        value: editingDeck ? editingDeck.name : '',
        placeholder: _t('decks.name_placeholder'),
        maxlength: '40',
      });
      const msgEl = el('div', { className: 'field-msg' });

      const colorButtons = decksStore.RING_COLORS.map((rc) => {
        const btn = el('button', {
          type: 'button',
          className: 'ring-choice ' + (chosenColor === rc.id ? 'is-selected' : ''),
          onClick: () => {
            chosenColor = rc.id;
            colorButtons.forEach((b, i) => b.classList.toggle('is-selected', decksStore.RING_COLORS[i].id === rc.id));
          },
        }, [
          el('span', { className: 'deck-ring-dot deck-ring-dot--' + rc.id }),
          el('span', { text: _t(rc.labelKey) }),
        ]);
        return btn;
      });

      const saveBtn = el('button', {
        type: 'submit',
        className: 'btn btn-primary',
        disabled: !nameInput.value.trim(),
      }, [el('span', { className: 'btn-label', text: _t('btn.save') })]);

      nameInput.addEventListener('input', () => {
        const ok = Boolean(nameInput.value.trim());
        saveBtn.disabled = !ok;
        nameInput.classList.toggle('is-error', !ok);
        msgEl.className = ok ? 'field-msg' : 'field-msg is-error';
        msgEl.textContent = ok ? '' : _t('cards.err.required');
      });

      const form = el('form', {
        className: 'card-form',
        onSubmit: (ev) => {
          ev.preventDefault();
          const clean = nameInput.value.trim();
          if (!clean) return;
          if (editingDeck) {
            decksStore.rename(editingDeck.id, clean);
            decksStore.updateColor(editingDeck.id, chosenColor);
          } else {
            decksStore.create({ name: clean, ringColor: chosenColor });
          }
          App.modal.close(true);
          renderList();
        },
      }, [
        el('div', { className: 'field' }, [
          el('label', { className: 'field-label', text: _t('decks.name_placeholder') }),
          nameInput,
          msgEl,
        ]),
        el('div', { className: 'field' }, [
          el('span', { className: 'field-label', text: _t('decks.ring_color') }),
          el('div', { className: 'ring-picker' }, colorButtons),
        ]),
        el('div', { className: 'modal-foot' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-ghost',
            onClick: () => App.modal.close(false),
          }, [el('span', { className: 'btn-label', text: _t('btn.cancel') })]),
          saveBtn,
        ]),
      ]);

      App.modal.open({
        title: editingDeck ? _t('btn.edit') : _t('decks.create'),
        body: form,
      });
    }

    const listEl = el('ul', { className: 'deck-list', role: 'list' });

    function moveDeck(deckId, delta) {
      const all = decksStore.getAll().map((d) => d.id);
      const idx = all.indexOf(deckId);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= all.length) return;
      const [item] = all.splice(idx, 1);
      all.splice(target, 0, item);
      decksStore.reorder(all);
      renderList();
    }

    function renderList() {
      if (!_root) return;
      clear(listEl);
      const decks = decksStore.getAll();

      decks.forEach((deck, index) => {
        const count = decksStore.getCardIds(deck.id).length;
        const tooFew = !decksStore.canPlayFourOptionGame(deck.id);
        const displayName = deck.builtin ? _t('decks.builtin_name') : deck.name;

        const row = el('li', {
          className: 'deck-row',
          draggable: 'true',
          onDragstart: () => { _dragId = deck.id; },
          onDragover: (ev) => {
            ev.preventDefault();
            row.classList.add('is-drag-over');
          },
          onDragleave: () => { row.classList.remove('is-drag-over'); },
          onDrop: (ev) => {
            ev.preventDefault();
            row.classList.remove('is-drag-over');
            if (!_dragId || _dragId === deck.id) return;
            const ids = decks.map((d) => d.id);
            const from = ids.indexOf(_dragId);
            const to = ids.indexOf(deck.id);
            if (from >= 0 && to >= 0) {
              const [moved] = ids.splice(from, 1);
              ids.splice(to, 0, moved);
              decksStore.reorder(ids);
              renderList();
            }
            _dragId = null;
          },
        }, [
          el('span', { className: 'deck-ring-dot deck-ring-dot--' + (deck.ringColor || 'vocab'), 'aria-hidden': 'true' }),
          el('div', { className: 'deck-info' }, [
            el('div', { className: 'deck-name', text: displayName }),
            el('div', { className: 'deck-sub' }, [
              el('span', { className: 'mono', text: _t('decks.card_count', { n: App.format ? App.format.int(count) : count }) }),
              deck.builtin ? el('span', { className: 'card-badge', text: _t('cards.source_builtin') }) : null,
              tooFew ? el('span', { className: 'deck-warn', text: _t('decks.min_four_warn') }) : null,
            ]),
          ]),
          el('div', { className: 'deck-actions' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => {
                if (App.pages.cards && App.pages.cards.filterByDeck) {
                  App.pages.cards.filterByDeck(deck.id);
                }
                if (App.router) App.router.go('#/cards');
              },
            }, [el('span', { className: 'btn-label', text: _t('decks.browse') })]),
            el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              disabled: index === 0,
              'aria-label': _t('decks.move_up'),
              onClick: () => moveDeck(deck.id, -1),
            }, [el('span', { className: 'btn-label', text: '↑' })]),
            el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              disabled: index === decks.length - 1,
              'aria-label': _t('decks.move_down'),
              onClick: () => moveDeck(deck.id, 1),
            }, [el('span', { className: 'btn-label', text: '↓' })]),
            !deck.builtin ? el('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => openDeckForm(deck),
            }, [el('span', { className: 'btn-label', text: _t('btn.edit') })]) : null,
            !deck.builtin ? el('button', {
              type: 'button',
              className: 'btn btn-danger',
              onClick: () => {
                const snap = decksStore.remove(deck.id);
                renderList();
                if (snap && App.toast) {
                  App.toast.show(_t('decks.undo_delete', { name: deck.name }), {
                    duration: 5000,
                    actionLabel: _t('btn.undo'),
                    onAction: () => {
                      decksStore.restore(snap);
                      renderList();
                    },
                  });
                }
              },
            }, [el('span', { className: 'btn-label', text: _t('btn.delete') })]) : null,
          ]),
        ]);

        listEl.appendChild(row);
      });
    }

    const page = el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
      el('div', { className: 'page-header' }, [
        el('h1', { className: 'page-title', text: _t('decks.title') }),
        el('div', { className: 'page-header-actions' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            onClick: () => openDeckForm(null),
          }, [el('span', { className: 'btn-label', text: _t('decks.create') })]),
        ]),
      ]),
      listEl,
    ]);

    root.replaceChildren(page);
    renderList();
  }

  function unmount() {
    _dragId = null;
    _root = null;
  }

  App.pages.decks = { mount, unmount };
})();
