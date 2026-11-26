/**
 * Application entry point — M2: app shell, router, i18n, store.
 * Boot order: db migrations -> settings -> i18n -> theme -> bus -> chrome -> router.
 * file:// compatible (classic IIFE, no ES modules, no fetch of local files).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  App.milestone = 'M4';

  // ─── 1. Database migrations ───────────────────────────────────────────────
  if (App.store && App.store.db) {
    App.store.db.runMigrations();
  }

  // ─── 2. Settings & i18n ───────────────────────────────────────────────────
  const settings = App.store && App.store.settings;

  if (App.i18n) {
    const storedLang = settings ? settings.get('language') : 'zh-TW';
    App.i18n.init(storedLang);
  }

  // ─── 3. Theme helper ──────────────────────────────────────────────────────
  function applyTheme(themeVal) {
    const theme = themeVal || (settings ? settings.get('theme') : 'auto');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'auto' && prefersDark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  applyTheme();
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      const t = settings ? settings.get('theme') : 'auto';
      if (t === 'auto') applyTheme('auto');
    });
  }

  // ─── 4. Navigation & chrome rendering (re-runs on language change) ────────
  let _exitBound = false;

  function renderChrome() {
    const t = App.i18n ? App.i18n.t.bind(App.i18n) : function (k) { return k; };
    const { el, clear } = App.dom;

    const brandEl = document.getElementById('nav-brand-name');
    if (brandEl) brandEl.textContent = t('app.name');

    const NAV_ITEMS = [
      { href: '#/',         icon: 'house',  labelKey: 'nav.dashboard', desktopOnly: false },
      { href: '#/cards',    icon: 'cards',  labelKey: 'nav.cards',     desktopOnly: false },
      { href: '#/review',   icon: 'book',   labelKey: 'nav.review',    desktopOnly: false },
      { href: '#/decks',    icon: 'folder', labelKey: 'nav.decks',     desktopOnly: true  },
      { href: '#/games',    icon: 'game',   labelKey: 'nav.games',     desktopOnly: false },
      { href: '#/stats',    icon: 'chart',  labelKey: 'nav.stats',     desktopOnly: true  },
      { href: '#/stamps',   icon: 'stamp',  labelKey: 'nav.stamps',    desktopOnly: true  },
      { href: '#/settings', icon: 'gear',   labelKey: 'nav.settings',  desktopOnly: false },
    ];

    const navList = document.getElementById('nav-items');
    if (navList) {
      clear(navList);
      NAV_ITEMS.forEach(function (item) {
        const iconEl = App.icons ? App.icons.svg(item.icon, 'icon nav-icon') : el('span', {});
        const link = el('a', {
          className: 'nav-link',
          href: item.href,
          'data-nav-link': item.href,
          'aria-label': t(item.labelKey),
        }, [
          iconEl,
          el('span', { text: t(item.labelKey) }),
        ]);

        navList.appendChild(el('li', {
          className: item.desktopOnly ? 'nav-item nav-item--desktop' : 'nav-item',
        }, [link]));
      });
    }

    const exitBtn = document.getElementById('game-hud-exit');
    if (exitBtn) {
      const icon = App.icons ? App.icons.svg('x-circle', 'icon') : null;
      clear(exitBtn);
      if (icon) exitBtn.appendChild(icon);
      exitBtn.appendChild(el('span', { text: t('app.exit_game') }));
      exitBtn.setAttribute('aria-label', t('app.exit_game'));
      if (!_exitBound) {
        _exitBound = true;
        exitBtn.addEventListener('click', function () {
          if (App.router) App.router.go('#/games');
        });
      }
    }

    const skipEl = document.getElementById('skip-link');
    if (skipEl) skipEl.textContent = t('app.skip_to_main');

    const navEl = document.getElementById('app-nav');
    if (navEl) navEl.setAttribute('aria-label', t('app.nav_label'));

    const hudEl = document.getElementById('game-hud');
    if (hudEl) hudEl.setAttribute('aria-label', t('app.game_controls'));

    const footerEl = document.getElementById('app-footer');
    if (footerEl) footerEl.textContent = t('app.footer_note');

    const offlineEl = document.getElementById('offline-indicator');
    if (offlineEl) offlineEl.textContent = t('app.offline');
  }

  renderChrome();

  // ─── 5. React to runtime setting changes ──────────────────────────────────
  if (App.bus) {
    App.bus.on('route:changed', function () {
      if (App.audio && App.audio.tts && App.audio.tts.resetPageNotice) {
        App.audio.tts.resetPageNotice();
      }
    });
    App.bus.on('settings:changed', function (data) {
      const changed = (data && data.changed) || {};
      if (changed.language) {
        document.documentElement.lang = changed.language === 'zh-TW' ? 'zh-Hant' : 'en';
        renderChrome();
      }
      if (changed.theme) {
        applyTheme(changed.theme);
      }
    });
  }

  // ─── 6. Offline / online detection ────────────────────────────────────────
  function updateOnlineState() {
    document.body.classList.toggle('is-offline', !navigator.onLine);
  }
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  updateOnlineState();

  // ─── 7. Register all routes ───────────────────────────────────────────────
  if (App.router) {
    const P = App.pages;
    const G = App.games;

    App.router.register('#/',              P.dashboard);
    App.router.register('#/cards',         P.cards);
    App.router.register('#/cards/:id',     P.cardDetail);
    App.router.register('#/review',        P.review);
    App.router.register('#/decks',         P.decks);
    App.router.register('#/games',         P.gamesHub);
    App.router.register('#/games/class13', G.class13);
    App.router.register('#/games/guess',   G.guess);
    App.router.register('#/games/wall',    G.wall);
    App.router.register('#/stats',         P.stats);
    App.router.register('#/stamps',        P.stamps);
    App.router.register('#/settings',      P.settings);
    App.router.register('#/settings/ai',   P.aiDiagnostics);
    App.router.register('#/styleguide',    P.styleguide);
  }

  // ─── 8. Global error handlers (never show a blank screen) ─────────────────
  window.addEventListener('error', function (event) {
    console.error('[main] Unhandled error:', event.error || event.message);
    if (App.toast) {
      App.toast.show(
        App.i18n ? App.i18n.t('error.generic') : '發生錯誤，請重試。'
      );
    }
  });

  window.addEventListener('unhandledrejection', function (event) {
    console.error('[main] Unhandled rejection:', event.reason);
    if (App.toast) {
      App.toast.show(
        App.i18n ? App.i18n.t('error.generic') : '發生錯誤，請重試。'
      );
    }
  });

  // ─── 9. Debug metadata ────────────────────────────────────────────────────
  const data = window.ENGLISH_2000_DATA;
  Object.assign(App, {
    protocol:    window.location.protocol,
    dataLoaded:  Boolean(data && Array.isArray(data.words)),
    wordRows:    data && Array.isArray(data.words) ? data.words.length : 0,
    uniqueWords: data && data.stats ? data.stats.uniqueWords : 0,
  });

  // ─── 10. Boot router (must be last) ───────────────────────────────────────
  if (App.router) {
    App.router.init(document.getElementById('app'));
  }
})();
