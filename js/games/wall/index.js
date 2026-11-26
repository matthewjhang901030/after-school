/**
 * 四格分類牆 game page stub (M2). Full implementation in M5.
 * @namespace App.games.wall
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
          el('h1', { className: 'page-title', text: t('games.wall.name') }),
        ]),
        el('p', { className: 'text-muted', text: t('games.wall.desc') }),
        el('p', { className: 'text-muted', text: t('games.stub_notice') }),
      ])
    );
  }

  function unmount() { _root = null; }

  App.games.wall = { mount, unmount };
})();
