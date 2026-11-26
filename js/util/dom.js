/**
 * Safe DOM element builder utilities (Section 7.3).
 * Never assigns innerHTML.
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});

  /**
   * Create an HTML element with attributes, event listeners, and children.
   * @param {string} tag
   * @param {Record<string, unknown>} [attrs]
   * @param {(Node|string|null|undefined|false)[]} [children]
   * @returns {HTMLElement}
   */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [key, val] of Object.entries(attrs)) {
        if (val === undefined || val === null || val === false) continue;
        if (key === 'className') {
          node.className = String(val);
        } else if (key === 'text') {
          node.textContent = String(val);
        } else if (key === 'dataset' && typeof val === 'object') {
          for (const [dk, dv] of Object.entries(val)) {
            if (dv !== undefined && dv !== null) node.dataset[dk] = String(dv);
          }
        } else if (key.startsWith('on') && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'disabled' || key === 'checked' || key === 'hidden') {
          node[key] = Boolean(val);
        } else {
          node.setAttribute(key, val === true ? '' : String(val));
        }
      }
    }

    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child);
    }
    return node;
  }

  /**
   * Remove all children from an element.
   * @param {Element} node
   */
  function clear(node) {
    if (node) node.replaceChildren();
  }

  App.dom = { el, clear };
})();
