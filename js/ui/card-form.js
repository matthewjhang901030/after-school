/**
 * Add / Edit Flashcard modal form (Section 3.4).
 * Enforces live validation, case-insensitive duplicate detection with link,
 * optional AI Feature D placeholder button, and custom deck assignment.
 * @namespace App.cardForm
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  /**
   * Open the Add or Edit Card modal.
   * @param {{ card?: Object|null, defaultDeckId?: string|null, onSaved?: (card: Object) => void }} [opts]
   */
  function open(opts) {
    const o = opts || {};
    const editing = o.card || null;
    const { el, clear } = App.dom;
    const cardsStore = App.store.cards;
    const decksStore = App.store.decks;

    const currentDecks = editing ? new Set(decksStore.getDecksForCard(editing.id).map((d) => d.id))
      : new Set(o.defaultDeckId && o.defaultDeckId !== decksStore.DEFAULT_DECK_ID ? [o.defaultDeckId] : []);

    const wordInput = el('input', {
      type: 'text',
      className: 'input',
      maxlength: '40',
      value: editing ? editing.word : '',
      placeholder: 'library',
      autocomplete: 'off',
    });
    const wordMsg = el('div', { className: 'field-msg', 'aria-live': 'polite' });

    const zhInput = el('input', {
      type: 'text',
      className: 'input',
      value: editing ? editing.zh : '',
      placeholder: '圖書館',
    });
    const zhMsg = el('div', { className: 'field-msg', 'aria-live': 'polite' });

    const posSelect = el('select', { className: 'input' }, [
      el('option', { value: '', text: _t('cards.form.pos_none') }),
      ...cardsStore.CANONICAL_POS.map((tag) => el('option', {
        value: tag,
        text: tag,
        selected: editing && editing.pos === tag ? 'selected' : null,
      })),
    ]);

    const ipaInput = el('input', {
      type: 'text',
      className: 'input',
      value: editing && editing.ipa ? editing.ipa : '',
      placeholder: '/ˈlaɪbreri/',
    });

    const exInput = el('input', {
      type: 'text',
      className: 'input',
      value: editing && editing.example ? editing.example : '',
      placeholder: 'I study at the library after school.',
    });

    const exZhInput = el('input', {
      type: 'text',
      className: 'input',
      value: editing && editing.exampleZh ? editing.exampleZh : '',
      placeholder: '我放學後在圖書館讀書。',
    });

    const tagsInput = el('input', {
      type: 'text',
      className: 'input',
      value: editing && Array.isArray(editing.tags) ? editing.tags.join(', ') : '',
      placeholder: 'campus, daily',
    });

    const customDecks = decksStore.getAll().filter((d) => !d.isDefaultAll);
    const deckCheckboxes = customDecks.map((d) => {
      const cb = el('input', {
        type: 'checkbox',
        value: d.id,
        checked: currentDecks.has(d.id),
      });
      return { id: d.id, cb, label: el('label', { className: 'deck-check-item' }, [cb, el('span', { text: d.name })]) };
    });

    const aiFillBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary',
      onClick: () => {
        if (App.toast) App.toast.show(_t('cards.form.ai_fill_soon'));
      },
    }, [
      App.icons ? App.icons.svg('sparkle', 'icon icon-sm') : null,
      el('span', { className: 'btn-label', text: _t('cards.form.ai_fill') }),
    ]);

    const saveBtn = el('button', {
      type: 'submit',
      className: 'btn btn-primary',
    }, [el('span', { className: 'btn-label', text: _t('btn.save') })]);

    function renderValidation() {
      const check = cardsStore.validate(
        { word: wordInput.value, zh: zhInput.value },
        editing ? editing.id : undefined
      );

      clear(wordMsg);
      wordInput.classList.remove('is-error');
      wordMsg.className = 'field-msg';
      if (check.errors.word) {
        wordInput.classList.add('is-error');
        wordMsg.classList.add('is-error');
        wordMsg.textContent = _t('cards.err.' + check.errors.word);
      } else if (check.duplicate) {
        wordInput.classList.add('is-error');
        wordMsg.classList.add('is-error');
        wordMsg.appendChild(document.createTextNode(_t('cards.err.duplicate') + ' '));
        wordMsg.appendChild(el('a', {
          href: '#/cards/' + encodeURIComponent(check.duplicate.id),
          text: _t('cards.err.view_existing', { word: check.duplicate.word }),
          onClick: () => { App.modal.close(true); },
        }));
      }

      clear(zhMsg);
      zhInput.classList.remove('is-error');
      zhMsg.className = 'field-msg';
      if (check.errors.zh) {
        zhInput.classList.add('is-error');
        zhMsg.classList.add('is-error');
        zhMsg.textContent = _t('cards.err.required');
      }

      saveBtn.disabled = !check.valid;
      return check.valid;
    }

    wordInput.addEventListener('input', renderValidation);
    zhInput.addEventListener('input', renderValidation);

    const form = el('form', {
      className: 'card-form',
      novalidate: true,
      onSubmit: (ev) => {
        ev.preventDefault();
        if (!renderValidation()) return;
        saveBtn.disabled = true;

        const payload = {
          word: wordInput.value.trim(),
          zh: zhInput.value.trim(),
          pos: posSelect.value || null,
          ipa: ipaInput.value.trim() || null,
          example: exInput.value.trim() || null,
          exampleZh: exZhInput.value.trim() || null,
          tags: tagsInput.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        };

        const saved = editing
          ? cardsStore.update(editing.id, payload)
          : cardsStore.add(payload);

        if (saved) {
          const pickedDecks = deckCheckboxes.filter((d) => d.cb.checked).map((d) => d.id);
          decksStore.setCardDecks(saved.id, pickedDecks);
          App.modal.close(true);
          if (typeof o.onSaved === 'function') o.onSaved(saved);
        } else {
          saveBtn.disabled = false;
        }
      },
    }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', text: _t('cards.form.word') + ' *' }),
        wordInput,
        wordMsg,
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', text: _t('cards.form.zh') + ' *' }),
        zhInput,
        zhMsg,
      ]),
      el('div', { className: 'card-form-row' }, [
        el('div', { className: 'field' }, [
          el('label', { className: 'field-label', text: _t('cards.form.pos') }),
          posSelect,
        ]),
        el('div', { className: 'field' }, [
          el('label', { className: 'field-label', text: _t('cards.form.ipa') }),
          ipaInput,
        ]),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', text: _t('cards.form.example') }),
        exInput,
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', text: _t('cards.form.example_zh') }),
        exZhInput,
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', text: _t('cards.form.tags') }),
        tagsInput,
      ]),
      deckCheckboxes.length ? el('div', { className: 'field' }, [
        el('span', { className: 'field-label', text: _t('cards.form.decks') }),
        el('div', { className: 'deck-check-list' }, deckCheckboxes.map((d) => d.label)),
      ]) : null,
      el('div', { className: 'modal-foot', style: 'justify-content: space-between;' }, [
        aiFillBtn,
        el('div', { style: 'display: flex; gap: var(--space-2);' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-ghost',
            onClick: () => App.modal.close(false),
          }, [el('span', { className: 'btn-label', text: _t('btn.cancel') })]),
          saveBtn,
        ]),
      ]),
    ]);

    App.modal.open({
      title: editing ? _t('cards.edit') : _t('cards.add'),
      body: form,
    });

    if (editing) renderValidation();
  }

  App.cardForm = { open };
})();
