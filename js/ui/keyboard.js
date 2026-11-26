/**
 * In-game keyboard component for 第 13 節課 (rotten locked keys + scrambled layouts).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  const ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  function shuffleWithSeed(list, seed) {
    if (App.random && typeof App.random.create === 'function') {
      return App.random.shuffle(list.slice(), App.random.create(seed));
    }
    const arr = list.slice();
    let s = seed >>> 0;
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function _t(key, params, fallback) {
    if (App.i18n) {
      const val = App.i18n.t(key, params);
      if (val !== key) return val;
    }
    return fallback;
  }

  /**
   * Create an interactive on-screen keyboard.
   * @param {{ onKey?: (key: string) => void, rottenKeys?: string[], scrambled?: boolean, seed?: number }} [opts]
   * @returns {HTMLElement}
   */
  function create(opts = {}) {
    const { el } = App.dom;
    const rotten = new Set((opts.rottenKeys || []).map((k) => k.toLowerCase()));
    let rows = ROWS;
    if (opts.scrambled) {
      const letters = shuffleWithSeed(ROWS.flat(), opts.seed || 13);
      rows = [letters.slice(0, 10), letters.slice(10, 19), letters.slice(19)];
    }

    const rowEls = rows.map((row) =>
      el('div', { className: 'kb-row' }, row.map((ch) => {
        const isRotten = rotten.has(ch);
        return el('button', {
          type: 'button',
          className: `kb-key${isRotten ? ' is-rotten' : ''}`,
          disabled: isRotten,
          'aria-label': isRotten ? _t('kb.rotten', { key: ch }, `${ch} 已腐蝕鎖定`) : ch,
          text: ch,
          onClick: () => {
            if (!isRotten && opts.onKey) opts.onKey(ch);
          },
        });
      }))
    );

    rowEls.push(
      el('div', { className: 'kb-row' }, [
        el('button', {
          type: 'button',
          className: 'kb-key kb-key--wide',
          text: "'",
          onClick: () => opts.onKey && opts.onKey("'"),
        }),
        el('button', {
          type: 'button',
          className: 'kb-key kb-key--wide',
          text: 'SPACE',
          onClick: () => opts.onKey && opts.onKey(' '),
        }),
        el('button', {
          type: 'button',
          className: 'kb-key kb-key--wide',
          text: 'DEL',
          onClick: () => opts.onKey && opts.onKey('Backspace'),
        }),
      ])
    );

    return el('div', {
      className: 'game-keyboard',
      role: 'group',
      'aria-label': _t('kb.label', null, '螢幕鍵盤'),
    }, rowEls);
  }

  App.keyboard = { create };
})();
