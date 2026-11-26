/**
 * Classic-script & stylesheet lazy loader compatible with file:// and http(s)://.
 * Injects classic <script src="./..."> tags on first visit, preserves execution
 * order, deduplicates already-loaded / in-flight paths, and clears failed entries
 * so a Retry button can cleanly reload them.
 * @namespace App.loadScripts
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const _loadedScripts = new Set();
  const _inflightScripts = new Map();
  const _loadedStyles = new Set();
  let _domScanned = false;

  /**
   * Canonicalize a relative script/style path (strips leading ./ or ../).
   * @param {string} raw
   * @returns {string}
   */
  function _canonical(raw) {
    return String(raw || '').trim().replace(/^(\.\.\/|\.\/)+/, '');
  }

  /**
   * Build the href/src attribute honoring App._assetBase (default "./").
   * @param {string} key
   * @returns {string}
   */
  function _toUrl(key) {
    if (/^(https?:)?\/\//i.test(key)) return key;
    const base = typeof App._assetBase === 'string' ? App._assetBase : './';
    return base + key;
  }

  function _scanExistingDom() {
    if (_domScanned || typeof document === 'undefined') return;
    _domScanned = true;
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(function (s) {
      const src = s.getAttribute('src');
      if (src) _loadedScripts.add(_canonical(src));
    });
    const links = document.querySelectorAll('link[rel="stylesheet"][href]');
    links.forEach(function (l) {
      const href = l.getAttribute('href');
      if (href) _loadedStyles.add(_canonical(href));
    });
  }

  /**
   * Load a single classic script by relative path. Never loads the same path twice.
   * @param {string} path
   * @returns {Promise<void>}
   */
  function _loadOneScript(path) {
    _scanExistingDom();
    const key = _canonical(path);
    if (!key) return Promise.resolve();
    if (_loadedScripts.has(key)) return Promise.resolve();
    if (_inflightScripts.has(key)) return _inflightScripts.get(key);

    const promise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = _toUrl(key);
      script.async = false;
      script.onload = function () {
        _inflightScripts.delete(key);
        _loadedScripts.add(key);
        resolve();
      };
      script.onerror = function () {
        _inflightScripts.delete(key);
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('Failed to load script: ' + key));
      };
      (document.head || document.body || document.documentElement).appendChild(script);
    });

    _inflightScripts.set(key, promise);
    return promise;
  }

  /**
   * Load one or more classic scripts sequentially, resolving when all finish.
   * @param {string|string[]} paths
   * @returns {Promise<void>}
   */
  function loadScripts(paths) {
    const list = Array.isArray(paths) ? paths : [paths];
    let chain = Promise.resolve();
    for (const p of list) {
      chain = chain.then(function () { return _loadOneScript(p); });
    }
    return chain;
  }

  /**
   * Ensure one or more stylesheets are injected once (non-blocking, deduplicated).
   * @param {string|string[]} paths
   */
  function loadStyles(paths) {
    _scanExistingDom();
    const list = Array.isArray(paths) ? paths : [paths];
    for (const p of list) {
      const key = _canonical(p);
      if (!key || _loadedStyles.has(key)) continue;
      _loadedStyles.add(key);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = _toUrl(key);
      (document.head || document.body || document.documentElement).appendChild(link);
    }
  }

  /**
   * Whether a script path is already loaded.
   * @param {string} path
   * @returns {boolean}
   */
  function isLoaded(path) {
    _scanExistingDom();
    return _loadedScripts.has(_canonical(path));
  }

  /**
   * Reset internal tracking (tests only).
   */
  function _resetForTest() {
    _loadedScripts.clear();
    _inflightScripts.clear();
    _loadedStyles.clear();
    _domScanned = false;
  }

  App.loadScripts = loadScripts;
  App.loadStyles = loadStyles;
  App.loader = { loadScripts, loadStyles, isLoaded, _resetForTest, _canonical };
})();
