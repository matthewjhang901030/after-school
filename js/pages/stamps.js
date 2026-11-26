/**
 * Stamps (集章冊) page stub (M2). Full implementation in M11.
 * @namespace App.pages.stamps
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
          el('h1', { className: 'page-title', text: t('stamps.title') }),
        ]),
        el('p', { className: 'text-muted', text: t('empty.stamps') }),
      ])
    );
  }

  function unmount() { _root = null; }

  App.pages.stamps = { mount, unmount };
})();
