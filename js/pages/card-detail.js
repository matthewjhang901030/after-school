/**
 * Card detail page stub (M2). Full implementation in M3.
 * @namespace App.pages.cardDetail
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  let _root = null;

  function mount(root, params) {
    _root = root;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('a', { className: 'btn btn-ghost', href: '#/cards' }, [
            el('span', { className: 'btn-label', text: '← ' + t('btn.back') }),
          ]),
          el('h1', { className: 'page-title', text: t('cards.detail') }),
        ]),
        el('p', { className: 'text-muted', text: 'Card ID: ' + (params && params.id ? params.id : '—') }),
      ])
    );
  }

  function unmount() { _root = null; }

  App.pages.cardDetail = { mount, unmount };
})();
