/**
 * First-visit 3-step onboarding flow (Section 3.8):
 *   Step 1: Pick daily new words (5 / 10 / 15 / 20 / 30)
 *   Step 2: Flip one sample real flashcard
 *   Step 3: Done — mark settings.onboarded = true and jump to Today's Review
 *
 * Can be rendered inline on Dashboard (createPanel) or opened inside App.modal (open).
 * @namespace App.onboarding
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const DAILY_CHOICES = [5, 10, 15, 20, 30];

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _pickSampleCard() {
    if (!App.store || !App.store.cards) return null;
    const all = App.store.cards.getAll({ includeHidden: false });
    const preferred = all.find((c) => c.word.toLowerCase() === 'library');
    if (preferred) return preferred;
    const withEx = all.find((c) => c.hasRealExample && c.word.length <= 12);
    return withEx || all[0] || null;
  }

  /**
   * Whether the first-visit onboarding should be shown.
   * @returns {boolean}
   */
  function shouldShow() {
    return Boolean(App.store && App.store.settings && !App.store.settings.get('onboarded'));
  }

  /**
   * Mark onboarding as finished in settings.
   */
  function markComplete() {
    if (App.store && App.store.settings) {
      App.store.settings.update({ onboarded: true });
    }
  }

  /**
   * Build the interactive 3-step onboarding element.
   * @param {{ onDone?: () => void, isModal?: boolean }} [opts]
   * @returns {HTMLElement}
   */
  function createPanel(opts) {
    const options = opts || {};
    const { el, clear } = App.dom;
    const settings = App.store && App.store.settings;

    let step = 1;
    let flippedOnce = false;
    let dailyNew = settings ? Number(settings.get('dailyNewWords')) || 10 : 10;
    const sampleCard = _pickSampleCard();

    const container = el('section', {
      className: options.isModal ? '' : 'onboarding-card',
      'aria-label': _t('onboarding.title'),
      'data-onboarding': 'true',
    });

    function finish(goToReview) {
      markComplete();
      if (typeof options.onDone === 'function') options.onDone();
      if (goToReview && App.router) App.router.go('#/review');
    }

    function render() {
      clear(container);

      const stepper = el('div', { className: 'onboarding-stepper', role: 'list' }, [1, 2, 3].map((n) => {
        const cls = 'onboarding-step-pill'
          + (n === step ? ' is-active' : '')
          + (n < step ? ' is-done' : '');
        const label = n < step ? `○ ${n}` : String(n);
        return el('span', { className: cls, role: 'listitem', text: label });
      }));

      const skipBtn = el('button', {
        type: 'button',
        className: 'btn btn-ghost',
        onClick: () => finish(false),
      }, [el('span', { className: 'btn-label', text: _t('btn.skip') })]);

      container.appendChild(
        el('div', { className: 'onboarding-head' }, [stepper, skipBtn])
      );

      if (step === 1) {
        container.appendChild(el('h2', { className: 'onboarding-title', text: _t('onboarding.step1_title') }));
        container.appendChild(el('p', { className: 'text-muted', text: _t('onboarding.step1_desc') }));

        const choices = el('div', { className: 'onboarding-choices' }, DAILY_CHOICES.map((n) =>
          el('button', {
            type: 'button',
            className: 'btn ' + (dailyNew === n ? 'btn-primary' : 'btn-secondary'),
            'aria-pressed': String(dailyNew === n),
            onClick: () => {
              dailyNew = n;
              if (settings) settings.update({ dailyNewWords: n });
              render();
            },
          }, [el('span', { className: 'btn-label', text: _t('onboarding.words_choice', { n }) })])
        ));
        container.appendChild(choices);

        container.appendChild(
          el('div', { className: 'onboarding-foot' }, [
            el('span', { className: 'text-small text-muted', text: _t('onboarding.step_of', { cur: 1, total: 3 }) }),
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => { step = 2; render(); },
            }, [el('span', { className: 'btn-label', text: _t('btn.next') })]),
          ])
        );
        return;
      }

      if (step === 2) {
        container.appendChild(el('h2', { className: 'onboarding-title', text: _t('onboarding.step2_title') }));
        const statusText = el('p', {
          className: flippedOnce ? 'text-small' : 'text-muted',
          text: flippedOnce ? _t('onboarding.step2_flipped') : _t('onboarding.step2_desc'),
        });
        container.appendChild(statusText);

        if (sampleCard && App.flashcard) {
          const fc = App.flashcard.create(sampleCard, {
            onSpeak: (slow) => {
              if (App.audio && App.audio.tts) App.audio.tts.speak(sampleCard.word, { slow });
            },
            onFlip: () => {
              if (!flippedOnce) {
                flippedOnce = true;
                statusText.textContent = _t('onboarding.step2_flipped');
                statusText.className = 'text-small';
              }
            },
          });
          container.appendChild(el('div', { className: 'onboarding-card-preview' }, [fc.root]));
        }

        container.appendChild(
          el('div', { className: 'onboarding-foot' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              onClick: () => { step = 1; render(); },
            }, [el('span', { className: 'btn-label', text: _t('btn.back') })]),
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => { step = 3; render(); },
            }, [el('span', { className: 'btn-label', text: _t('btn.next') })]),
          ])
        );
        return;
      }

      // Step 3: Done
      container.appendChild(el('h2', { className: 'onboarding-title', text: _t('onboarding.step3_title') }));
      container.appendChild(el('p', { className: 'text-muted', text: _t('onboarding.step3_desc', { n: dailyNew }) }));

      if (App.stamp) {
        container.appendChild(
          el('div', { style: 'display: flex; justify-content: center; padding: var(--space-2) 0;' }, [
            App.stamp.create({
              title: _t('onboarding.stamp_ready'),
              sub: App.date ? App.date.todayKey() : '',
              animate: true,
            }),
          ])
        );
      }

      container.appendChild(
        el('div', { className: 'onboarding-foot' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => finish(false),
          }, [el('span', { className: 'btn-label', text: _t('onboarding.stay_home') })]),
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            onClick: () => finish(true),
          }, [el('span', { className: 'btn-label', text: _t('onboarding.start_review') })]),
        ])
      );
    }

    render();
    return container;
  }

  /**
   * Open the 3-step onboarding flow inside App.modal (e.g. replayed from Settings).
   * @param {{ onDone?: () => void }} [opts]
   */
  function open(opts) {
    if (!App.modal) return;
    const options = opts || {};
    const panel = createPanel({
      isModal: true,
      onDone: () => {
        App.modal.close(true);
        if (typeof options.onDone === 'function') options.onDone();
      },
    });
    App.modal.open({
      title: _t('onboarding.title'),
      body: panel,
      onClose: () => {
        markComplete();
        if (typeof options.onDone === 'function') options.onDone();
      },
    });
  }

  App.onboarding = {
    DAILY_CHOICES,
    shouldShow,
    markComplete,
    createPanel,
    open,
  };
})();
