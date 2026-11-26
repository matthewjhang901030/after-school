/**
 * AI diagnostics page stub (M2). Full implementation in M12.
 * @namespace App.pages.aiDiagnostics
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
          el('a', { className: 'btn btn-ghost', href: '#/settings' }, [
            el('span', { className: 'btn-label', text: '← ' + t('btn.back') }),
          ]),
          el('h1', { className: 'page-title', text: t('settings.ai_diag') }),
        ]),
        el('p', { className: 'text-muted', text: t('settings.ai_diag_stub') }),
        el('a', { className: 'btn btn-secondary', href: './tests/ai-spike.html' }, [
          el('span', { className: 'btn-label', text: t('settings.ai_spike_link') + ' →' }),
        ]),
      ])
    );
  }

  function unmount() { _root = null; }

  App.pages.aiDiagnostics = { mount, unmount };
})();
