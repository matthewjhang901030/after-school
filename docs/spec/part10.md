---PAGEBREAK---

# Appendix A. Build order for Antigravity

Work milestone by milestone. Each milestone ends with: tests green, no console errors, checked at 375 / 768 / 1440px, one git commit (or more) with a clear message. Do not begin the next milestone until the Definition of Done (DoD) is met.

| # | Milestone | Main work | Definition of Done | Tier |
|---|---|---|---|---|
| M0 | Setup and data audit | Repo, folder structure, README stub, `.nojekyll`, test runner; open `english-2000-data.js` and write `docs/DATA.md` | Page loads on Live Server and GitHub Pages; DATA.md lists real fields | T1 |
| M1 | Design system | `tokens.css`, fonts, base styles, all components with all states, light/dark | A `#/styleguide` dev page shows every component in both themes; contrast checked | T1 |
| M2 | App shell | Router with mount/unmount, sidebar/bottom bar, i18n zh-TW/en, toasts, modals, global error handler, store layer with migrations | Navigating all routes 20 times leaves no listeners or timers (check DevTools); language switch works | T1 |
| M3 | Flashcards | Card model, builtin import, browse/search/filter, card detail, flip, TTS, add/edit/hide/delete with undo, decks | All 3.8 edge cases handled; Leitner tests green | T1 |
| M4 | Review and learning record | Today's review, Leitner scheduling, attempt log, sessions, onboarding | Reviewing 20 cards updates boxes and due dates correctly across a simulated date change | T1 |
| M5 | Game engine + 四格分類牆 | Shared engine, wall game, validator, 10 walls first (30 by T3), 今日之牆 seeded | Validator tests green; a full wall playable on phone and desktop; confusion pairs logged | T1 |
| M6 | AI layer (tiers) + Feature A | Tier detection, Nano backend (+ Translator), Qwen backend, template backend, Feature A on all end screens, AI panel with streaming and stop | Feature A works in each tier when forced from Settings; invalid JSON falls back to template | T2 |
| M7 | 你說我猜 | Embedding service with IndexedDB cache, checks, guessing UI, scoring, vocab review | Accuracy on `guess-eval.json` documented in DECISIONS.md; works offline after first load | T2 |
| M8 | 第 13 節課 core | Question types meaning→word and verb form, per-letter typing, distance, creature SVG, win/lose, end screen | Playable 3 periods; pause on tab hide; unmount stops everything | T2 |
| M9 | Dashboard + 今日課表 | Bento dashboard, timetable with 2/3/4 periods, streak, loop diagram | Timetable resets at local midnight; persists across reload | T2 |
| — | **Tag `demo-1`** | Run the QA checklist (8.1) on the demo laptop | Demo 1 script (8.2) runs without errors | — |
| M10 | 第 13 節課 full | Broadcast dialogue cloze, audio-only rounds, supplies, key rot (cap 3), scrambled keyboard, atmosphere audio, flicker, content warning, 安心模式, gacha | Reduced-motion and 安心模式 verified; no flicker above 3 per second | T3 |
| M11 | AI B, C, D + stats + stamps | Sentence correction, weekly advice, auto-fill, statistics page with SVG charts and tables, card history tab, stamp book, export/import/reset, demo seed | All charts have text summaries; demo data load and clear works | T3 |
| M12 | Offline and AI diagnostics | Service worker, cache versioning, persistent storage, diagnostics panel | Full loop works with Wi-Fi off after one online visit | T3 |
| M13 | Polish | AI Feature E (validated walls), share image, Lighthouse fixes, docs complete (AI_USAGE, CREDITS) | QA checklist fully green; Lighthouse ≥ 90 | T4 |
| — | **Tag `final`** | Final QA, record backup video | Final demo script (8.3) rehearsed twice | — |

Rules for Antigravity during the build:
- Before writing any English content (walls, tense, broadcast), produce it as a draft file and stop for the owner's review.
- Never remove an existing feature to fix a bug without asking.
- Log every assumption in `docs/DECISIONS.md`.
- Keep commits small; message format `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`.
