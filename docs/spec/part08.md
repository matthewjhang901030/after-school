---PAGEBREAK---

# 7. Architecture and code structure

## 7.1 Tech stack

- Plain HTML, CSS, JavaScript (ES modules). No framework, no build step. (The course page says frameworks do not earn extra points; no build step means fewer failure points and the site runs directly in the browser.)
- External: **Transformers.js** (ES module from CDN, pinned version) for embeddings and Qwen; **Phosphor Icons** (SVG); **Google Fonts** with local fallbacks. Nothing else.
- Storage: localStorage (small structured data) and IndexedDB (embeddings, large caches).
- Hosting: GitHub Pages (static).

## 7.2 Folder structure

```
/index.html
/sw.js                       service worker (offline)
/.nojekyll                   lets GitHub Pages serve every folder as-is
/css/  tokens.css  base.css  components.css  pages/*.css  games/*.css
/js/
  main.js                    boot: load settings, i18n, data, router
  router.js                  hash router with mount/unmount
  bus.js                     tiny event bus
  store/   db.js (localStorage wrapper, versions, migrations)  idb.js
           cards.js  decks.js  leitner.js  attempts.js  stats.js
           stamps.js  settings.js  daily.js (今日課表)
  i18n/    index.js  zh-TW.js  en.js
  ui/      dom.js-based components: toast.js  modal.js  flashcard.js
           keyboard.js  stamp.js  charts/ bar.js line.js calendar.js keymap.js
  pages/   dashboard.js  cards.js  card-detail.js  review.js  decks.js
           games.js  stats.js  stamps.js  settings.js  ai-diagnostics.js
  games/   engine.js
           class13/ index.js  creature.js  atmosphere.js  supplies.js  questions.js
           guess/   index.js  checks.js
           wall/    index.js  validate.js
  ai/      index.js (tier detection + common API)
           backends/ nano.js  qwen.js  template.js
           prompts/  explain.js  correct.js  advice.js  fill.js  wall.js
           schemas.js  validate.js  embed.js
  audio/   tts.js  sfx.js (Web Audio)
  util/    date.js  random.js (seeded RNG)  text.js  dom.js  format.js
/data/     english-2000-data.js  tense.json  broadcast.json  walls.json
           class-rules.json  demo-seed.json
/assets/   fonts/  sounds/ (CC0)  svg/
/tests/    test.html  tests/*.test.js  guess-eval.json
/docs/     README.md  DATA.md  DECISIONS.md  AI_USAGE.md  CREDITS.md
```

## 7.3 Architecture rules

1. **Every page and game exports `mount(root, params)` and `unmount()`.** `unmount` clears timers, animation frames, event listeners, audio nodes, and AI sessions. This prevents the most common single-page-app bugs (sound or timers continuing after leaving a game).
2. **All data access goes through `js/store/`.** No other file touches localStorage or IndexedDB. `QuotaExceededError` and access errors are caught in one place; on failure the store switches to an in-memory fallback and shows a banner.
3. **Event bus** for cross-feature updates: `attempt:recorded`, `card:updated`, `progress:changed`, `stamp:earned`, `settings:changed`, `ai:status`.
4. **DOM**: build elements with the `el()` helper in `util/dom.js`. `innerHTML` is forbidden for any user or AI text.
5. **Dates**: only `util/date.js` creates `dayKey` (local time). Includes helpers `todayKey()`, `addDays(key, n)`, `diffDays(a, b)`.
6. **Randomness**: `util/random.js` provides a seeded RNG (e.g. mulberry32 with a hash of the seed string). 今日之牆 uses the date as seed.
7. **Text**: `util/text.js` normalises answers (trim, collapse spaces, case-insensitive, curly quotes to straight) and generates word variants (plural, -ing, -ed, -er) for taboo checks.
8. **i18n**: `t(key, params)`; missing keys log a warning in development and fall back to English. Language switch re-renders the current page without reload.
9. Files under about 300 lines; JSDoc on exported functions; no globals except `window.App` for debugging.
10. Errors: a global `error` and `unhandledrejection` handler shows a toast and logs; the app never shows a blank screen.

## 7.4 Storage keys and versioning

| Key | Content |
|---|---|
| `as.meta` | `{ schemaVersion, createdAt, lastOpened }` |
| `as.v1.cards.user` | User cards |
| `as.v1.cards.overrides` | Edits and hidden flags for builtin cards |
| `as.v1.progress` | Leitner progress by cardId |
| `as.v1.decks` | Decks |
| `as.v1.attempts` | Recent attempts (max 5000) |
| `as.v1.daily` | Daily summaries and today's timetable state |
| `as.v1.sessions` | Game sessions and personal bests |
| `as.v1.stamps` | Earned stamps |
| `as.v1.settings` | Settings |
| IndexedDB `afterschool` / store `embeddings` | Embedding vectors by card id and model id |

Migrations: `store/db.js` holds an ordered list `migrations[n] = (data) => data`. On startup, run all migrations from the stored version to the current one. Back up the old data in memory first; if a migration throws, keep the old data and show an error.

## 7.5 Routes

| Hash | Page |
|---|---|
| `#/` | Dashboard |
| `#/cards` | Browse cards |
| `#/cards/:id` | Card detail with history |
| `#/review` | Today's review |
| `#/decks` | Decks |
| `#/games` | Game hub |
| `#/games/class13` · `#/games/guess` · `#/games/wall` | Games |
| `#/stats` | Statistics |
| `#/stamps` | 集章冊 |
| `#/settings` · `#/settings/ai` | Settings, AI diagnostics |

Unknown route: go to dashboard with a toast. Browser Back during a game triggers the exit confirmation.

## 7.6 Settings list

Language (zh-TW / en) · theme (auto / light / dark) · daily new words (default 10) · periods per day (2 / 3 / 4, default 3) · auto-play pronunciation · speech rate · 安心模式 · AI engine (auto / Gemini Nano / Qwen / templates) · download or delete models · storage usage · export / import / reset · load or clear demo data.

## 7.7 Offline

- `sw.js` pre-caches the app shell (HTML, CSS, JS, data, fonts, sounds) with a `CACHE_VERSION` constant; on activate, delete old caches. Bump the version on every deploy.
- Use relative paths everywhere (the site is served from `/<repo-name>/` on GitHub Pages, not from `/`).
- Models are cached by Transformers.js in Cache Storage; request persistent storage.
- Offline indicator in the header when `navigator.onLine` is false.

## 7.8 Environment notes (put in README)

- Do not open `index.html` by double-clicking (`file://`). ES modules, the service worker, and the Prompt API need http(s) or localhost. Use VS Code Live Server or the GitHub Pages URL.
- Tested browsers: Chrome and Edge desktop, Safari iOS, Chrome Android.

## 7.9 Automated tests (`/tests/test.html`)

A minimal in-browser test runner (no install). Required test suites:
- Leitner: promote, demote, due date calculation, game wrong → box 1.
- `dayKey` around midnight and across months.
- Wall validator: valid wall passes; duplicates, missing skill, wrong group size fail.
- Text: normalisation, variants, taboo detection.
- Scoring and combo.
- Class13 typing: prefix matching with multiple accepted answers; key-rot cap of 3.
- Migrations from a v0 fixture.
- Seeded RNG: same seed gives same sequence.

## 7.10 Documentation files

- `README.md`: what it is, how to run locally, how to deploy, browser support, known limits.
- `DATA.md`: fields of `english-2000-data.js` and every JSON bank.
- `DECISIONS.md`: every unspecified choice made during the build.
- `AI_USAGE.md`: required by the course rules. Which AI tools were used (Antigravity for code, an AI assistant for planning this spec), for what, and how outputs were checked.
- `CREDITS.md`: fonts, icons, sounds, data sources with licences.
