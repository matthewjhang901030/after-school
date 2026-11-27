/**
 * Application entry point — M2: app shell, router, i18n, store.
 * Boot order: db migrations -> settings -> i18n -> theme -> bus -> chrome -> router.
 * file:// compatible (classic IIFE, no ES modules, no fetch of local files).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  App.milestone = 'M8';

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
      if ((changed.aiEngine || changed.qwenModel) && App.ai) {
        if (changed.qwenModel && App.ai.qwen && typeof App.ai.qwen.destroy === 'function') {
          App.ai.qwen.destroy();
        }
        if (typeof App.ai.invalidateDetection === 'function') App.ai.invalidateDetection();
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

  // ─── 7. Register all routes (core eager, non-core lazy via App.loadScripts) ─
  if (App.router) {
    App.router.register('#/', App.pages.dashboard);

    App.router.registerLazy('#/cards', {
      scripts: ['js/ui/card-form.js', 'js/pages/cards.js'],
      getPage: function () { return App.pages && App.pages.cards; },
    });
    App.router.registerLazy('#/cards/:id', {
      scripts: ['js/ui/card-form.js', 'js/pages/card-detail.js'],
      getPage: function () { return App.pages && App.pages.cardDetail; },
    });
    App.router.registerLazy('#/review', {
      scripts: ['js/pages/review.js'],
      getPage: function () { return App.pages && App.pages.review; },
    });
    App.router.registerLazy('#/decks', {
      scripts: ['js/pages/decks.js'],
      getPage: function () { return App.pages && App.pages.decks; },
    });
    App.router.registerLazy('#/games', {
      scripts: ['js/pages/games.js'],
      getPage: function () { return App.pages && App.pages.gamesHub; },
    });
    App.router.registerLazy('#/games/class13', {
      styles: ['css/pages/class13.css'],
      scripts: [
        'data/tense.js',
        'data/broadcast.js',
        'data/class-rules.js',
        'js/ui/keyboard.js',
        'js/games/engine.js',
        'js/games/class13/questions.js',
        'js/games/class13/supplies.js',
        'js/games/class13/atmosphere.js',
        'js/games/class13/creature.js',
        'js/games/class13/index.js',
      ],
      getPage: function () { return App.games && App.games.class13; },
    });
    App.router.registerLazy('#/games/guess', {
      styles: ['css/pages/guess.css'],
      scripts: ['js/ai/embed.js', 'js/games/engine.js', 'js/games/guess/checks.js', 'js/games/guess/index.js'],
      getPage: function () { return App.games && App.games.guess; },
    });
    App.router.registerLazy('#/games/wall', {
      styles: ['css/pages/wall.css'],
      scripts: ['data/walls.js', 'js/games/engine.js', 'js/games/wall/validate.js', 'js/games/wall/index.js'],
      getPage: function () { return App.games && App.games.wall; },
    });
    App.router.registerLazy('#/stats', {
      scripts: ['js/pages/stats.js'],
      getPage: function () { return App.pages && App.pages.stats; },
    });
    App.router.registerLazy('#/stamps', {
      scripts: ['js/pages/stamps.js'],
      getPage: function () { return App.pages && App.pages.stamps; },
    });
    App.router.registerLazy('#/settings', {
      scripts: ['js/pages/settings.js'],
      getPage: function () { return App.pages && App.pages.settings; },
    });
    App.router.registerLazy('#/settings/ai', {
      styles: ['css/pages/ai.css'],
      scripts: ['js/ai/templates.js', 'js/ai/nano.js', 'js/ai/qwen.js', 'js/ai/index.js', 'js/ui/ai-panel.js', 'js/pages/ai-diagnostics.js'],
      getPage: function () { return App.pages && App.pages.aiDiagnostics; },
    });
    App.router.registerLazy('#/styleguide', {
      styles: ['css/pages/styleguide.css'],
      scripts: ['js/ui/keyboard.js', 'js/pages/styleguide.js'],
      getPage: function () { return App.pages && App.pages.styleguide; },
    });
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
