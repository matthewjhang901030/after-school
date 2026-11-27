/**
 * Settings page stub (M2). Full implementation in M11.
 * Provides live language, theme, and periods-per-day controls plus quick links
 * to decks, statistics, stamp book, AI diagnostics, and dev styleguide.
 * @namespace App.pages.settings
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  let _root = null;

  function mount(root) {
    _root = root;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };
    const settings = App.store && App.store.settings;

    // ── Language switch ────────────────────────────────────────
    const currentLang = App.i18n ? App.i18n.lang() : 'zh-TW';
    const langZH = el('button', {
      type: 'button',
      className: 'btn ' + (currentLang === 'zh-TW' ? 'btn-primary' : 'btn-secondary'),
      onClick: function () { if (App.i18n) App.i18n.setLang('zh-TW'); },
    }, [el('span', { className: 'btn-label', text: '繁體中文' })]);

    const langEN = el('button', {
      type: 'button',
      className: 'btn ' + (currentLang === 'en' ? 'btn-primary' : 'btn-secondary'),
      onClick: function () { if (App.i18n) App.i18n.setLang('en'); },
    }, [el('span', { className: 'btn-label', text: 'English' })]);

    // ── Theme switch ───────────────────────────────────────────
    const currentTheme = settings ? settings.get('theme') : 'auto';
    function themeBtn(value, label) {
      return el('button', {
        type: 'button',
        className: 'btn ' + (currentTheme === value ? 'btn-primary' : 'btn-secondary'),
        onClick: function () {
          if (settings) settings.update({ theme: value });
          mount(root);
        },
      }, [el('span', { className: 'btn-label', text: label })]);
    }

    // ── Daily new words (5–30, Section 3.2) ────────────────────
    const currentDailyNew = settings ? Number(settings.get('dailyNewWords')) || 10 : 10;
    const dailyNewRow = [5, 10, 15, 20, 30].map(function (n) {
      return el('button', {
        type: 'button',
        className: 'btn ' + (currentDailyNew === n ? 'btn-primary' : 'btn-secondary'),
        onClick: function () {
          if (settings) settings.update({ dailyNewWords: n });
          mount(root);
        },
      }, [el('span', { className: 'btn-label', text: String(n) })]);
    });

    // ── Auto-play pronunciation ────────────────────────────────
    const currentAutoPlay = Boolean(settings && settings.get('autoPlayPronunciation'));
    const autoPlayBtn = el('button', {
      type: 'button',
      className: 'btn ' + (currentAutoPlay ? 'btn-primary' : 'btn-secondary'),
      'aria-pressed': String(currentAutoPlay),
      onClick: function () {
        if (settings) settings.update({ autoPlayPronunciation: !currentAutoPlay });
        mount(root);
      },
    }, [el('span', { className: 'btn-label', text: currentAutoPlay ? t('settings.on_label') : t('settings.off_label') })]);

    // ── Speech rate ────────────────────────────────────────────
    const currentRate = settings ? Number(settings.get('speechRate')) || 1.0 : 1.0;
    const rateRow = [0.8, 1.0, 1.2].map(function (r) {
      return el('button', {
        type: 'button',
        className: 'btn ' + (Math.abs(currentRate - r) < 0.05 ? 'btn-primary' : 'btn-secondary'),
        onClick: function () {
          if (settings) settings.update({ speechRate: r });
          mount(root);
        },
      }, [el('span', { className: 'btn-label', text: r.toFixed(1) + '×' })]);
    });

    // ── AI Engine selector (auto / nano / qwen / templates, Section 5.2) ──
    const currentAi = settings ? (settings.get('aiEngine') || 'auto') : 'auto';
    const aiOptions = [
      { value: 'auto',      label: t('settings.ai_engine.auto') },
      { value: 'nano',      label: t('settings.ai_engine.nano') },
      { value: 'qwen',      label: t('settings.ai_engine.qwen') },
      { value: 'templates', label: t('settings.ai_engine.tpl') },
    ];
    const aiRow = aiOptions.map(function (opt) {
      return el('button', {
        type: 'button',
        className: 'btn ' + (currentAi === opt.value ? 'btn-primary' : 'btn-secondary'),
        'data-ai-engine': opt.value,
        onClick: function () {
          if (settings) settings.update({ aiEngine: opt.value });
          if (App.ai && typeof App.ai.invalidateDetection === 'function') App.ai.invalidateDetection();
          mount(root);
        },
      }, [el('span', { className: 'btn-label', text: opt.label })]);
    });

    // ── Qwen model size selector (opt-in 0.5B vs 1.5B, shows MB before download) ──
    const currentQwenModel = settings ? (settings.get('qwenModel') || '0.5b') : '0.5b';
    const qwenModelOptions = [
      { value: '0.5b', label: t('settings.qwen_model.05b') },
      { value: '1.5b', label: t('settings.qwen_model.15b') },
    ];
    const qwenModelRow = qwenModelOptions.map(function (opt) {
      return el('button', {
        type: 'button',
        className: 'btn ' + (currentQwenModel === opt.value ? 'btn-primary' : 'btn-secondary'),
        'data-qwen-model': opt.value,
        onClick: function () {
          if (settings) settings.update({ qwenModel: opt.value });
          if (App.ai && App.ai.qwen && typeof App.ai.qwen.destroy === 'function') App.ai.qwen.destroy();
          if (App.ai && typeof App.ai.invalidateDetection === 'function') App.ai.invalidateDetection();
          mount(root);
        },
      }, [el('span', { className: 'btn-label', text: opt.label })]);
    });

    // ── Periods per day ────────────────────────────────────────
    const currentPeriods = settings ? settings.get('periodsPerDay') : 3;
    const periodsRow = [2, 3, 4].map(function (n) {
      return el('button', {
        type: 'button',
        className: 'btn ' + (currentPeriods === n ? 'btn-primary' : 'btn-secondary'),
        onClick: function () {
          if (settings) settings.update({ periodsPerDay: n });
          mount(root);
        },
      }, [el('span', { className: 'btn-label', text: String(n) })]);
    });

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: t('settings.title') }),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.language') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [langZH, langEN]),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.theme') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [
            themeBtn('auto', t('settings.theme.auto')),
            themeBtn('light', t('settings.theme.light')),
            themeBtn('dark', t('settings.theme.dark')),
          ]),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.daily_new') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, dailyNewRow),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.periods') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, periodsRow),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.auto_play') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [autoPlayBtn]),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.speech_rate') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, rateRow),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.ai_engine') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, aiRow),
        ]),

        el('section', { style: 'margin-bottom: var(--space-6);' }, [
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.qwen_model') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, qwenModelRow),
        ]),

        el('section', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [
          App.onboarding ? el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: function () { App.onboarding.open(); },
          }, [el('span', { className: 'btn-label', text: t('settings.replay_onboarding') })]) : null,
          el('a', { className: 'btn btn-secondary', href: '#/decks' }, [
            el('span', { className: 'btn-label', text: t('nav.decks') }),
          ]),
          el('a', { className: 'btn btn-secondary', href: '#/stats' }, [
            el('span', { className: 'btn-label', text: t('nav.stats') }),
          ]),
          el('a', { className: 'btn btn-secondary', href: '#/stamps' }, [
            el('span', { className: 'btn-label', text: t('nav.stamps') }),
          ]),
          el('a', { className: 'btn btn-secondary', href: '#/settings/ai' }, [
            el('span', { className: 'btn-label', text: t('settings.ai_diag') }),
          ]),
          el('a', { className: 'btn btn-ghost', href: '#/styleguide' }, [
            el('span', { className: 'btn-label', text: 'Styleguide' }),
          ]),
        ]),
      ])
    );
  }

  function unmount() {
    _root = null;
  }

  App.pages.settings = { mount, unmount };
})();
