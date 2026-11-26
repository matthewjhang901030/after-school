/**
 * Dashboard page — home screen, bento grid layout (stub for M2).
 * Full bento content implemented in M9.
 * @namespace App.pages.dashboard
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

    const page = el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
      el('div', { className: 'page-header' }, [
        el('h1', { className: 'page-title', text: t('dashboard.title') }),
      ]),
      el('div', { className: 'bento-grid' }, [
        el('div', { className: 'bento-block bento-block--large' }, [
          el('p', { className: 'text-muted', text: t('empty.attempts') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: auto;' }, [
            el('a', { className: 'btn btn-primary', href: '#/review' }, [
              el('span', { className: 'btn-label', text: t('review.title') }),
            ]),
            el('a', { className: 'btn btn-secondary', href: '#/games' }, [
              el('span', { className: 'btn-label', text: t('games.title') }),
            ]),
          ]),
        ]),
        el('div', { className: 'bento-block' }, [
          el('h2', { className: 'text-small text-muted', text: t('dashboard.loop_step') }),
          el('p', { className: 'text-small', text: 'Learn → Play → Mistake → AI → Review' }),
          el('a', { className: 'btn btn-ghost', href: '#/stats', style: 'align-self: flex-start; margin-top: auto;' }, [
            el('span', { className: 'btn-label', text: t('stats.title') }),
          ]),
        ]),
        el('div', { className: 'bento-block' }, [
          el('h2', { className: 'text-small text-muted', text: t('stamps.title') }),
          el('p', { className: 'text-muted text-small', text: t('empty.stamps') }),
          el('a', { className: 'btn btn-ghost', href: '#/stamps', style: 'align-self: flex-start; margin-top: auto;' }, [
            el('span', { className: 'btn-label', text: t('stamps.title') }),
          ]),
        ]),
      ]),
    ]);

    root.replaceChildren(page);
  }

  function unmount() {
    _root = null;
  }

  App.pages.dashboard = { mount, unmount };
})();
