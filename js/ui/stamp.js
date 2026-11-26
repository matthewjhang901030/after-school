/**
 * Commemorative station-style ink stamp component (Section 2.5).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});

  /**
   * Create a round ink stamp element.
   * @param {{ title: string, sub?: string, animate?: boolean }} opts
   * @returns {HTMLElement}
   */
  function create({ title, sub = '', animate = true }) {
    const { el } = App.dom;
    return el('div', {
      className: `stamp${animate ? ' is-animate' : ''}`,
      role: 'img',
      'aria-label': sub ? `${title} ${sub}` : title,
    }, [
      el('span', { text: title }),
      sub ? el('span', { className: 'stamp-sub', text: sub }) : null,
    ]);
  }

  App.stamp = { create };
})();
