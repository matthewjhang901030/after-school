/**
 * Decks page stub (M2). Full implementation in M3.
 * @namespace App.pages.decks
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

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: t('decks.title') }),
        ]),
        el('p', { className: 'text-muted', text: t('empty.decks') }),
      ])
    );
  }

  function unmount() { _root = null; }

  App.pages.decks = { mount, unmount };
})();
