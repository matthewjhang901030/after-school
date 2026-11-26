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
          el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: t('settings.periods') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, periodsRow),
        ]),

        el('section', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [
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
