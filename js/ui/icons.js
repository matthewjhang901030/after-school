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
    house: [
      { tag: 'path', attrs: { d: 'M40,112L128,40l88,72v96a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8Z' } },
      { tag: 'polyline', attrs: { points: '104,216 104,152 152,152 152,216' } },
    ],
    cards: [
      { tag: 'rect', attrs: { x: '36', y: '68', width: '148', height: '148', rx: '12' } },
      { tag: 'path', attrs: { d: 'M72,36H208a12,12,0,0,1,12,12V184' } },
    ],
    book: [
      { tag: 'path', attrs: { d: 'M128,64a40,40,0,0,0-40-24H32V192H88a40,40,0,0,1,40,24' } },
      { tag: 'path', attrs: { d: 'M128,64a40,40,0,0,1,40-24h56V192H168a40,40,0,0,0-40,24Z' } },
    ],
    game: [
      { tag: 'rect', attrs: { x: '32', y: '72', width: '192', height: '112', rx: '36' } },
      { tag: 'line', attrs: { x1: '80', y1: '108', x2: '80', y2: '148' } },
      { tag: 'line', attrs: { x1: '60', y1: '128', x2: '100', y2: '128' } },
      { tag: 'circle', attrs: { cx: '164', cy: '116', r: '8', fill: 'currentColor' } },
      { tag: 'circle', attrs: { cx: '188', cy: '140', r: '8', fill: 'currentColor' } },
    ],
    gear: [
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '32' } },
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '72' } },
      { tag: 'line', attrs: { x1: '128', y1: '28', x2: '128', y2: '56' } },
      { tag: 'line', attrs: { x1: '128', y1: '200', x2: '128', y2: '228' } },
      { tag: 'line', attrs: { x1: '28', y1: '128', x2: '56', y2: '128' } },
      { tag: 'line', attrs: { x1: '200', y1: '128', x2: '228', y2: '128' } },
      { tag: 'line', attrs: { x1: '57', y1: '57', x2: '77', y2: '77' } },
      { tag: 'line', attrs: { x1: '179', y1: '179', x2: '199', y2: '199' } },
      { tag: 'line', attrs: { x1: '199', y1: '57', x2: '179', y2: '77' } },
      { tag: 'line', attrs: { x1: '77', y1: '179', x2: '57', y2: '199' } },
    ],
    'x-circle': [
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '96' } },
      { tag: 'line', attrs: { x1: '160', y1: '96', x2: '96', y2: '160' } },
      { tag: 'line', attrs: { x1: '96', y1: '96', x2: '160', y2: '160' } },
    ],
    folder: [
      { tag: 'path', attrs: { d: 'M32,80V64a8,8,0,0,1,8-8H96l24,24h96a8,8,0,0,1,8,8V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8Z' } },
    ],
    chart: [
      { tag: 'line', attrs: { x1: '40', y1: '208', x2: '216', y2: '208' } },
      { tag: 'rect', attrs: { x: '60', y: '132', width: '32', height: '76' } },
      { tag: 'rect', attrs: { x: '112', y: '88', width: '32', height: '120' } },
      { tag: 'rect', attrs: { x: '164', y: '52', width: '32', height: '156' } },
    ],
    stamp: [
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '88' } },
      { tag: 'circle', attrs: { cx: '128', cy: '128', r: '56' } },
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
