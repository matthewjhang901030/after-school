/**
 * Hash router with mount/unmount lifecycle.
 * Routes are registered as { path, page } where page has mount(root, params) and unmount().
 * Unknown routes -> dashboard + toast.
 * Browser Back or HUD exit during a game -> exit confirmation modal.
 * @namespace App.router
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /** @type {{ path: string, pattern: RegExp, keys: string[], page: Object }[]} */
  const _routes = [];

  /** Currently mounted page module. */
  let _active = null;
  /** Hash currently mounted. */
  let _activePath = '';
  /** Route params for current page (used on i18n refresh). */
  let _lastParams = {};
  /** Whether the current route is a game (navigation hidden). */
  let _inGame = false;
  /** DOM root where pages mount. */
  let _root = null;
  /** Prevent duplicate hashchange bindings. */
  let _initialized = false;
  /** Guard flags for browser Back exit confirmation. */
  let _restoringHash = false;
  let _bypassExitGuard = false;
  let _skipNextHash = null;

  const GAME_PATHS = ['#/games/class13', '#/games/guess', '#/games/wall'];

  /**
   * Convert a route string like "#/cards/:id" to a regex and extract param names.
   * @param {string} path
   * @returns {{ pattern: RegExp, keys: string[] }}
   */
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
   * Register a route (replaces existing registration for same path if any).
   * @param {string} path   e.g. '#/cards/:id'
   * @param {Object} page   Must expose mount(root, params) and unmount().
   */
  function register(path, page) {
    const existing = _routes.findIndex(function (r) { return r.path === path; });
    const compiled = _compile(path);
    const entry = { path, pattern: compiled.pattern, keys: compiled.keys, page };
    if (existing >= 0) {
      _routes[existing] = entry;
    } else {
      _routes.push(entry);
    }
  }

  /**
   * Match a hash string against registered routes.
   * @param {string} hash   e.g. '#/cards/b-0001'
   * @returns {{ page: Object, params: Object, path: string }|null}
   */
  function _match(hash) {
    for (const route of _routes) {
      const m = hash.match(route.pattern);
      if (m) {
        const params = {};
        route.keys.forEach(function (k, i) { params[k] = decodeURIComponent(m[i + 1]); });
        return { page: route.page, params, path: route.path };
      }
    }
    return null;
  }

  /**
   * Unmount the currently active page safely.
   */
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

  /**
   * Toggle navigation vs. game HUD visibility.
   * @param {boolean} inGame
   */
  function _updateNav(inGame) {
    document.body.classList.toggle('is-in-game', inGame);
    const nav = document.getElementById('app-nav');
    const hud = document.getElementById('game-hud');
    if (nav) nav.setAttribute('aria-hidden', inGame ? 'true' : 'false');
    if (hud) hud.setAttribute('aria-hidden', inGame ? 'false' : 'true');
  }

  /**
   * Update active nav link styling and aria-current.
   * @param {string} hash
   */
  function _updateNavActive(hash) {
    const links = document.querySelectorAll('[data-nav-link]');
    links.forEach(function (link) {
      const href = link.getAttribute('href') || link.dataset.navLink;
      const isMatch = href === hash || (href !== '#/' && hash.startsWith(href + '/'));
      link.classList.toggle('is-active', isMatch);
      if (isMatch) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /**
   * Show the exit-game confirmation modal.
   * @param {Function} onConfirm
   * @param {Function} [onCancel]
   */
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
            onClick: function () {
              if (onCancel) onCancel();
            },
          },
          {
            label: t('app.exit_yes'),
            variant: 'danger',
            onClick: function () {
              if (onConfirm) onConfirm();
            },
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

  /**
   * Navigate to a hash and mount the matching page.
   * @param {string} [hash]  Defaults to window.location.hash.
   */
  function navigate(hash) {
    if (!_root) return;
    if (_restoringHash) {
      _restoringHash = false;
      return;
    }

    const h = hash || window.location.hash || '#/';

    // Guard leaving an active game (e.g., via browser Back or external hash change)
    if (_inGame && !_bypassExitGuard && h !== _activePath) {
      const gamePath = _activePath;
      _showExitConfirm(
        function () {
          _bypassExitGuard = true;
          navigate(h);
        },
        function () {
          if (window.location.hash !== gamePath) {
            _restoringHash = true;
            window.location.hash = gamePath;
          }
        }
      );
      return;
    }
    _bypassExitGuard = false;

    _unmount();

    const match = _match(h);
    if (!match) {
      if (App.toast) {
        App.toast.show(App.i18n ? App.i18n.t('error.unknown_route') : '找不到此頁面，已返回首頁。');
      }
      if (window.location.hash !== '#/') {
        window.location.hash = '#/';
      }
      const dash = _match('#/');
      if (dash) {
        _active = dash.page;
        _activePath = '#/';
        _lastParams = dash.params;
        _inGame = false;
        _updateNav(false);
        _updateNavActive('#/');
        _active.mount(_root, dash.params);
      }
      return;
    }

    _active = match.page;
    _activePath = h;
    _lastParams = match.params;
    _inGame = GAME_PATHS.some(function (gp) { return h === gp; });
    _updateNav(_inGame);
    _updateNavActive(h);

    if (App.bus) App.bus.emit('route:changed', { hash: h, params: match.params });

    try {
      _active.mount(_root, match.params);
    } catch (e) {
      console.error('[router] mount error on', h, e);
      if (App.toast) {
        App.toast.show(App.i18n ? App.i18n.t('error.generic') : '發生錯誤，請重試。');
      }
    }
  }

  /**
   * Re-render the current page (called after language switch).
   */
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

  /**
   * Initialise the router, binding hashchange once.
   * @param {HTMLElement} root
   */
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

  /**
   * Programmatic navigation (prompts before changing hash when in a game).
   * @param {string} hash
   */
  function go(hash) {
    function commit() {
      if (window.location.hash !== hash) {
        _skipNextHash = hash;
        window.location.hash = hash;
      }
      navigate(hash);
    }

    if (_inGame && hash !== _activePath) {
      _showExitConfirm(function () {
        _bypassExitGuard = true;
        commit();
      });
      return;
    }
    commit();
  }

  /** Return current router state (for diagnostics & tests). */
  function current() {
    return { path: _activePath, inGame: _inGame, params: _lastParams };
  }

  App.router = { register, navigate, refresh, init, go, current };
})();
