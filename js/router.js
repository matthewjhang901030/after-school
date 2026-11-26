/**
 * Hash router with mount/unmount lifecycle and query-string support.
 * Routes match pathname before '?' and pass parsed query params on params.query.
 * Unknown routes -> dashboard + toast.
 * Browser Back or HUD exit during a game -> exit confirmation modal.
 * @namespace App.router
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /** @type {{ path: string, pattern: RegExp, keys: string[], page: Object }[]} */
  const _routes = [];

  let _active = null;
  let _activePath = '';
  let _lastParams = {};
  let _inGame = false;
  let _root = null;
  let _initialized = false;
  let _restoringHash = false;
  let _bypassExitGuard = false;
  let _skipNextHash = null;
  let _navToken = 0;

  const GAME_PATHS = ['#/games/class13', '#/games/guess', '#/games/wall'];

  function _compile(path) {
    const keys = [];
    const src = path
      .replace(/#/g, '\\#')
      .replace(/\/:[^/]+/g, function (m) {
        keys.push(m.slice(2));
        return '/([^/]+)';
      })
      .replace(/\//g, '\\/');
    return { pattern: new RegExp('^' + src + '$'), keys };
  }

  /**
   * Split "#/cards?deck=d-1" into { pathname: "#/cards", query: { deck: "d-1" } }.
   * @param {string} hash
   * @returns {{ pathname: string, query: Record<string, string> }}
   */
  function _splitHash(hash) {
    const raw = hash || '#/';
    const qIdx = raw.indexOf('?');
    if (qIdx < 0) return { pathname: raw, query: {} };
    const pathname = raw.slice(0, qIdx) || '#/';
    const query = {};
    const search = raw.slice(qIdx + 1);
    if (search) {
      for (const pair of search.split('&')) {
        if (!pair) continue;
        const eq = pair.indexOf('=');
        const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
        const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : '';
        if (k) query[k] = v;
      }
    }
    return { pathname, query };
  }

  function register(path, page) {
    const existing = _routes.findIndex(function (r) { return r.path === path; });
    const compiled = _compile(path);
    const entry = { path, pattern: compiled.pattern, keys: compiled.keys, page, lazy: null };
    if (existing >= 0) _routes[existing] = entry;
    else _routes.push(entry);
  }

  /**
   * Register a lazy-loaded route. Scripts/styles are injected once on first visit
   * via App.loadScripts / App.loadStyles with a loading state and Retry on failure.
   * @param {string} path
   * @param {{ scripts: string[], styles?: string[], getPage: () => Object|null }} lazyConfig
   */
  function registerLazy(path, lazyConfig) {
    const existing = _routes.findIndex(function (r) { return r.path === path; });
    const compiled = _compile(path);
    const entry = { path, pattern: compiled.pattern, keys: compiled.keys, page: null, lazy: lazyConfig };
    if (existing >= 0) _routes[existing] = entry;
    else _routes.push(entry);
  }

  function _match(hash) {
    const { pathname, query } = _splitHash(hash);
    for (const route of _routes) {
      const m = pathname.match(route.pattern);
      if (m) {
        const params = { query };
        route.keys.forEach(function (k, i) { params[k] = decodeURIComponent(m[i + 1]); });
        return { page: route.page, lazy: route.lazy, params, path: route.path, pathname };
      }
    }
    return null;
  }

  function _renderLoadingState() {
    if (!_root || !App.dom) return;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };
    _root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'state-box', 'data-route-state': 'loading', role: 'status', 'aria-live': 'polite' }, [
          el('p', { className: 'text-muted', text: t('misc.loading') }),
        ]),
      ])
    );
  }

  function _renderLoadError(hash) {
    if (!_root || !App.dom) return;
    const { el } = App.dom;
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };
    _root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'state-box', 'data-route-state': 'error', role: 'alert' }, [
          el('p', { text: t('error.load') }),
          el('div', { style: 'display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); margin-top: var(--space-3);' }, [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              onClick: function () { navigate(hash); },
            }, [el('span', { className: 'btn-label', text: t('btn.retry') })]),
            el('a', { className: 'btn btn-secondary', href: '#/' }, [
              el('span', { className: 'btn-label', text: t('nav.dashboard') }),
            ]),
          ]),
        ]),
      ])
    );
  }

  function _mountMatched(page, h, pathname, params) {
    _active = page;
    _activePath = h;
    _lastParams = params;
    _inGame = GAME_PATHS.some(function (gp) { return pathname === gp; });
    _updateNav(_inGame);
    _updateNavActive(h);

    if (App.bus) App.bus.emit('route:changed', { hash: h, pathname, params });

    try {
      _active.mount(_root, params);
    } catch (e) {
      console.error('[router] mount error on', h, e);
      if (App.toast) {
        App.toast.show(App.i18n ? App.i18n.t('error.generic') : '發生錯誤，請重試。');
      }
    }
  }

  function _unmount() {
    if (_active && typeof _active.unmount === 'function') {
      try { _active.unmount(); } catch (e) { console.error('[router] unmount error:', e); }
    }
    _active = null;
    _activePath = '';
    _lastParams = {};
    _inGame = false;
    _updateNav(false);
  }

  function _updateNav(inGame) {
    document.body.classList.toggle('is-in-game', inGame);
    const nav = document.getElementById('app-nav');
    const hud = document.getElementById('game-hud');
    if (nav) nav.setAttribute('aria-hidden', inGame ? 'true' : 'false');
    if (hud) hud.setAttribute('aria-hidden', inGame ? 'false' : 'true');
  }

  function _updateNavActive(hash) {
    const { pathname } = _splitHash(hash);
    const links = document.querySelectorAll('[data-nav-link]');
    links.forEach(function (link) {
      const href = link.getAttribute('href') || link.dataset.navLink;
      const isMatch = href === pathname || (href !== '#/' && pathname.startsWith(href + '/'));
      link.classList.toggle('is-active', isMatch);
      if (isMatch) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function _showExitConfirm(onConfirm, onCancel) {
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };
    if (App.modal) {
      App.modal.open({
        title: t('app.exit_game'),
        body: t('app.exit_confirm'),
        actions: [
          {
            label: t('app.exit_no'),
            variant: 'secondary',
            onClick: function () { if (onCancel) onCancel(); },
          },
          {
            label: t('app.exit_yes'),
            variant: 'danger',
            onClick: function () { if (onConfirm) onConfirm(); },
          },
        ],
        onClose: onCancel || null,
      });
    } else if (window.confirm(t('app.exit_confirm'))) {
      if (onConfirm) onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  }

  function navigate(hash) {
    if (!_root) return;
    if (_restoringHash) {
      _restoringHash = false;
      return;
    }

    const h = hash || window.location.hash || '#/';
    const { pathname } = _splitHash(h);

    if (_inGame && !_bypassExitGuard && pathname !== _splitHash(_activePath).pathname) {
      const gamePath = _activePath;
      _showExitConfirm(
        function () {
          _bypassExitGuard = true;
          navigate(h);
        },
        function () {
          if (window.location.hash !== gamePath) {
            _restoringHash = true;
            try {
              window.history.replaceState(null, '', gamePath);
              _restoringHash = false;
            } catch (_e) {
              window.location.hash = gamePath;
            }
          }
        }
      );
      return;
    }
    _bypassExitGuard = false;

    _unmount();
    const token = ++_navToken;

    const match = _match(h);
    if (!match) {
      if (App.toast) {
        App.toast.show(App.i18n ? App.i18n.t('error.unknown_route') : '找不到此頁面，已返回首頁。');
      }
      if (window.location.hash !== '#/') {
        _skipNextHash = '#/';
        window.location.hash = '#/';
      }
      const dash = _match('#/');
      if (dash && dash.page) {
        _mountMatched(dash.page, '#/', '#/', dash.params);
      }
      return;
    }

    if (match.lazy) {
      const cfg = match.lazy;
      const scripts = Array.isArray(cfg.scripts) ? cfg.scripts : [];
      const styles = Array.isArray(cfg.styles) ? cfg.styles : [];
      if (styles.length && App.loadStyles) App.loadStyles(styles);

      const allLoaded = App.loader
        ? scripts.every(function (s) { return App.loader.isLoaded(s); })
        : false;
      const existingPage = typeof cfg.getPage === 'function' ? cfg.getPage() : null;

      if (allLoaded && existingPage) {
        _mountMatched(existingPage, h, match.pathname, match.params);
        return;
      }

      _activePath = h;
      _lastParams = match.params;
      _inGame = false;
      _updateNav(false);
      _updateNavActive(h);
      _renderLoadingState();

      if (!App.loadScripts) {
        _renderLoadError(h);
        return;
      }

      App.loadScripts(scripts).then(
        function () {
          if (token !== _navToken) return;
          const loadedPage = typeof cfg.getPage === 'function' ? cfg.getPage() : null;
          if (!loadedPage) {
            _renderLoadError(h);
            return;
          }
          _mountMatched(loadedPage, h, match.pathname, match.params);
        },
        function (err) {
          if (token !== _navToken) return;
          console.error('[router] lazy load failed for', h, err);
          _renderLoadError(h);
        }
      );
      return;
    }

    _mountMatched(match.page, h, match.pathname, match.params);
  }

  function refresh() {
    if (!_active || !_root) return;
    const page = _active;
    const path = _activePath;
    const params = _lastParams || {};
    const inGame = _inGame;
    try {
      if (typeof page.unmount === 'function') page.unmount();
    } catch (_e) { /* ignore */ }
    _active = page;
    _activePath = path;
    _lastParams = params;
    _inGame = inGame;
    _updateNav(_inGame);
    _updateNavActive(path);
    try {
      page.mount(_root, params);
    } catch (e) {
      console.error('[router] refresh error:', e);
    }
  }

  function init(root) {
    _root = root;
    if (!_initialized) {
      _initialized = true;
      window.addEventListener('hashchange', function () {
        if (_skipNextHash !== null && window.location.hash === _skipNextHash) {
          _skipNextHash = null;
          return;
        }
        _skipNextHash = null;
        navigate(window.location.hash);
      });
    }
    navigate(window.location.hash || '#/');
  }

  function go(hash) {
    function commit() {
      if (window.location.hash !== hash) {
        _skipNextHash = hash;
        window.location.hash = hash;
      }
      navigate(hash);
    }

    if (_inGame && _splitHash(hash).pathname !== _splitHash(_activePath).pathname) {
      _showExitConfirm(function () {
        _bypassExitGuard = true;
        commit();
      });
      return;
    }
    commit();
  }

  function current() {
    return { path: _activePath, inGame: _inGame, params: _lastParams };
  }

  App.router = { register, registerLazy, navigate, refresh, init, go, current };
})();
