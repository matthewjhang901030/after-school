/**
 * Single-weight Phosphor-style SVG icons built via DOM (works offline and under file://).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const PATHS = {
    speaker: [
      { tag: 'polygon', attrs: { points: '80,96 40,96 40,160 80,160 136,208 136,48 80,96' } },
      { tag: 'path', attrs: { d: 'M168,96a48,48,0,0,1,0,64' } },
      { tag: 'path', attrs: { d: 'M192,72a84,84,0,0,1,0,112' } },
    ],
    clock: [
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '96' } },
      { tag: 'polyline', attrs: { points: '128,72 128,128 176,128' } },
    ],
    close: [
      { tag: 'line', attrs: { x1: '200', y1: '56', x2: '56', y2: '200' } },
      { tag: 'line', attrs: { x1: '200', y1: '200', x2: '56', y2: '56' } },
    ],
    sun: [
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '48' } },
      { tag: 'line', attrs: { x1: '128', y1: '28', x2: '128', y2: '48' } },
      { tag: 'line', attrs: { x1: '128', y1: '208', x2: '128', y2: '228' } },
      { tag: 'line', attrs: { x1: '28', y1: '128', x2: '48', y2: '128' } },
      { tag: 'line', attrs: { x1: '208', y1: '128', x2: '228', y2: '128' } },
      { tag: 'line', attrs: { x1: '58', y1: '58', x2: '72', y2: '72' } },
      { tag: 'line', attrs: { x1: '184', y1: '184', x2: '198', y2: '198' } },
      { tag: 'line', attrs: { x1: '58', y1: '198', x2: '72', y2: '184' } },
      { tag: 'line', attrs: { x1: '184', y1: '72', x2: '198', y2: '58' } },
    ],
    moon: [
      { tag: 'path', attrs: { d: 'M208,152A84,84,0,0,1,104,48a84,84,0,1,0,104,104Z' } },
    ],
    sparkle: [
      { tag: 'path', attrs: { d: 'M128,28L148,96L216,116L148,136L128,204L108,136L40,116L108,96Z' } },
    ],
    warning: [
      { tag: 'path', attrs: { d: 'M128,40L224,208H32Z' } },
      { tag: 'line', attrs: { x1: '128', y1: '104', x2: '128', y2: '148' } },
      { tag: 'circle', attrs: { cx: '128', cy: '176', r: '6', fill: 'currentColor' } },
    ],
    flip: [
      { tag: 'polyline', attrs: { points: '176,48 216,88 176,128' } },
      { tag: 'path', attrs: { d: 'M40,168a80,80,0,0,1,80-80h96' } },
    ],
  };

  /**
   * Build an accessible inline SVG icon element.
   * @param {string} name
   * @param {string} [className]
   * @returns {SVGElement}
   */
  function svg(name, className = 'icon') {
    const node = document.createElementNS(SVG_NS, 'svg');
    node.setAttribute('viewBox', '0 0 256 256');
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', '18');
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('aria-hidden', 'true');
    if (className) node.setAttribute('class', className);

    const shapes = PATHS[name] || [];
    for (const item of shapes) {
      const child = document.createElementNS(SVG_NS, item.tag);
      for (const [k, v] of Object.entries(item.attrs)) {
        child.setAttribute(k, v);
      }
      node.appendChild(child);
    }
    return node;
  }

  App.icons = { svg };
})();
