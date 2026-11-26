/**
 * 第 13 節課 game page stub (M2). Full implementation in M8/M10.
 * @namespace App.pages.class13
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};
  App.games = App.games || {};

  let _root = null;

  function mount(root) {
    _root = root;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: t('games.class13.name') }),
        ]),
        el('p', { className: 'text-muted', text: t('games.class13.desc') }),
        el('p', { className: 'text-muted', text: '（M8 實作中）' }),
      ])
    );
  }

  function unmount() { _root = null; }

  App.games.class13 = { mount, unmount };
})();
