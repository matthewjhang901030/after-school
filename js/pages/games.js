/**
 * Games hub page stub (M2). Notebook TOC style layout. Full implementation in M5+.
 * @namespace App.pages.gamesHub
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  let _root = null;

  /** Game entries for the TOC list */
  function _games() {
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };
    return [
      {
        href: '#/games/class13',
        index: '13',
        name: t('games.class13.name'),
        desc: t('games.class13.desc'),
        skills: ['vocab', 'grammar', 'dialogue'],
      },
      {
        href: '#/games/guess',
        index: '猜',
        name: t('games.guess.name'),
        desc: t('games.guess.desc'),
        skills: ['vocab', 'dialogue'],
      },
      {
        href: '#/games/wall',
        index: '牆',
        name: t('games.wall.name'),
        desc: t('games.wall.desc'),
        skills: ['vocab', 'grammar'],
      },
    ];
  }

  function mount(root) {
    _root = root;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };

    const tocItems = _games().map(function (g) {
      const skillTabs = g.skills.map(function (s) {
        return el('span', {
          className: 'skill-tab skill-tab--' + s,
          text: t('skill.' + s),
        });
      });

      return el('li', {}, [
        el('a', {
          className: 'toc-item',
          href: g.href,
          'data-nav-link': g.href,
        }, [
          el('span', { className: 'toc-item-index', text: g.index }),
          el('div', { className: 'toc-item-body' }, [
            el('div', { className: 'toc-item-name', text: g.name }),
            el('div', { className: 'toc-item-desc', text: g.desc }),
            el('div', { className: 'skill-tabs', style: 'margin-top: 6px;' }, skillTabs),
          ]),
          el('span', { className: 'toc-item-best text-muted', text: '—' }),
        ]),
      ]);
    });

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('h1', { className: 'page-title', text: t('games.title') }),
        ]),
        el('ul', { className: 'toc-list', role: 'list' }, tocItems),
      ])
    );
  }

  function unmount() { _root = null; }

  App.pages.gamesHub = { mount, unmount };
})();
