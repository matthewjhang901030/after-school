/**
 * 你說我猜 game page stub (M2). Full implementation in M7.
 * @namespace App.games.guess
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  let _root = null;

  function mount(root) {
    _root = root;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: t('games.guess.name') }),
        ]),
        el('p', { className: 'text-muted', text: t('games.guess.desc') }),
        el('p', { className: 'text-muted', text: t('games.stub_notice') }),
      ])
    );
  }

  function unmount() { _root = null; }

  App.games.guess = { mount, unmount };
})();
