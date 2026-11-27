/**
 * 第 13 節課 — Corridor window & approaching creature SVG (M8, Section 4.3.6).
 * - Built strictly with document.createElementNS (zero innerHTML, zero CSS gradients).
 * - Scales smoothly with distance (12.0 m -> 0.0 m).
 * - Writes the learner's own missed words across the creature's body in red ink.
 * @namespace App.games.class13Creature
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function _svgEl(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== null && v !== undefined) node.setAttribute(k, String(v));
      }
    }
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /**
   * Create a corridor viewport + creature SVG controller.
   * @param {{ maxDistance?: number }} [opts]
   * @returns {{ root: HTMLElement, update: (distanceM: number, wrongWords: string[], opts?: { danger?: boolean, safeMode?: boolean }) => void }}
   */
  function create(opts) {
    const o = opts || {};
    const maxDist = Number.isFinite(o.maxDistance) && o.maxDistance > 0 ? o.maxDistance : 12;
    const { el } = App.dom;

    const svg = _svgEl('svg', {
      class: 'c13-corridor-svg',
      viewBox: '0 0 360 150',
      role: 'img',
      'aria-label': '走廊門窗與身影距離',
    });

    // Corridor background walls & door frame (flat stationery ink tones, zero gradients)
    svg.appendChild(_svgEl('rect', { x: '0', y: '0', width: '360', height: '150', fill: '#181512' }));
    svg.appendChild(_svgEl('polygon', { points: '0,0 105,28 105,122 0,150', fill: '#221E1A' }));
    svg.appendChild(_svgEl('polygon', { points: '360,0 255,28 255,122 360,150', fill: '#221E1A' }));
    svg.appendChild(_svgEl('rect', { x: '105', y: '22', width: '150', height: '106', fill: '#2C2722', stroke: '#524B42', 'stroke-width': '2' }));
    // Door window pane
    svg.appendChild(_svgEl('rect', { x: '122', y: '32', width: '116', height: '86', fill: '#141210', stroke: '#6B625A', 'stroke-width': '1.5' }));

    // Creature group centered in the door window (scales smoothly by distance)
    const creatureGroup = _svgEl('g', {
      'data-c13-creature': 'true',
      transform: 'translate(180 96) scale(0.35)',
    });

    // Silhouette head + shoulders + torso (no gore, crisp ink shape)
    creatureGroup.appendChild(_svgEl('ellipse', { cx: '0', cy: '-38', rx: '15', ry: '18', fill: '#0A0908', stroke: '#524B42', 'stroke-width': '1' }));
    creatureGroup.appendChild(_svgEl('path', {
      d: 'M -34 40 C -34 -6 -22 -18 0 -18 C 22 -18 34 -6 34 40 Z',
      fill: '#0A0908',
      stroke: '#524B42',
      'stroke-width': '1',
    }));

    const eyeLeft = _svgEl('circle', { cx: '-5', cy: '-40', r: '2', fill: '#C9BFAE' });
    const eyeRight = _svgEl('circle', { cx: '5', cy: '-40', r: '2', fill: '#C9BFAE' });
    creatureGroup.appendChild(eyeLeft);
    creatureGroup.appendChild(eyeRight);

    // Container for red-ink missed words written over the creature's body
    const wordsGroup = _svgEl('g', { 'data-c13-body-words': 'true' });
    creatureGroup.appendChild(wordsGroup);
    svg.appendChild(creatureGroup);

    // Window mullions overlaid cleanly in front
    svg.appendChild(_svgEl('line', { x1: '180', y1: '32', x2: '180', y2: '118', stroke: '#3A352F', 'stroke-width': '2' }));
    svg.appendChild(_svgEl('line', { x1: '122', y1: '75', x2: '238', y2: '75', stroke: '#3A352F', 'stroke-width': '2' }));

    const distText = el('span', { className: 'c13-dist-value', 'data-c13-distance': 'true', text: `${maxDist.toFixed(1)} m` });
    const barFill = el('div', { className: 'c13-dist-fill', style: 'width: 100%;' });

    const root = el('div', { className: 'c13-corridor-wrap' }, [
      svg,
      el('div', { className: 'c13-dist-bar-row' }, [
        el('div', { className: 'c13-dist-track' }, [barFill]),
        distText,
      ]),
    ]);

    let _lastWordsKey = '';

    function update(distanceM, wrongWords, stateOpts) {
      const clamped = Math.max(0, Math.min(maxDist, Number(distanceM) || 0));
      const closeness = 1 - (clamped / maxDist);
      const scale = Number((0.35 + closeness * 0.90).toFixed(3));
      const yOffset = Number((102 - closeness * 16).toFixed(1));
      creatureGroup.setAttribute('transform', `translate(180 ${yOffset}) scale(${scale})`);

      const inDanger = clamped <= 3.0;
      const safe = Boolean(stateOpts && stateOpts.safeMode);
      eyeLeft.setAttribute('fill', inDanger && !safe ? '#F07A64' : '#C9BFAE');
      eyeRight.setAttribute('fill', inDanger && !safe ? '#F07A64' : '#C9BFAE');

      distText.textContent = `${clamped.toFixed(1)} m`;
      const pct = Math.round((clamped / maxDist) * 100);
      barFill.style.width = `${pct}%`;
      barFill.classList.toggle('is-danger', inDanger);
      root.classList.toggle('is-danger', inDanger && !safe);

      // Update missed words inscribed in red ink on the creature's body
      const list = Array.isArray(wrongWords) ? wrongWords.slice(-6) : [];
      const key = list.join('|');
      if (key !== _lastWordsKey) {
        _lastWordsKey = key;
        while (wordsGroup.firstChild) wordsGroup.removeChild(wordsGroup.firstChild);
        const positions = [
          { x: '0', y: '-2' },
          { x: '-10', y: '8' },
          { x: '10', y: '16' },
          { x: '-6', y: '24' },
          { x: '8', y: '31' },
          { x: '0', y: '38' },
        ];
        list.forEach((word, i) => {
          const pos = positions[i % positions.length];
          wordsGroup.appendChild(
            _svgEl('text', {
              x: pos.x,
              y: pos.y,
              'text-anchor': 'middle',
              fill: '#F07A64',
              'font-family': 'JetBrains Mono, monospace',
              'font-size': '7.5',
              'font-weight': '700',
            }, String(word).slice(0, 12))
          );
        });
      }
    }

    return { root, update };
  }

  App.games.class13Creature = { create };
})();
