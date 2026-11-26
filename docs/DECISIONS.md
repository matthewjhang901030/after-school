# Architectural & Specification Decisions (`docs/DECISIONS.md`)

Every choice not fully specified by `docs/spec/part01.md`–`part11.md`, or resolved where the spec and source dataset interacted, is logged here.

---

## M0 — Setup, Data Audit, and `file://` Architecture

1. **Supporting direct double-click (`file://`) alongside HTTP (`http(s)://`)**
   - The teacher's evaluation flow is downloading the repo ZIP, unzipping, and double-clicking `index.html` (`file://`), while GitHub Pages and VS Code Live Server serve over `http(s)://`.
   - Under `file://`, `<script type="module" src="./...">` and `fetch('./data/...')` are blocked by browser CORS policy. Therefore, application scripts load as **classic `<script src="./...">` files** wrapped in IIFEs registering onto `window.App` (relative paths only, zero build step).
   - Future JSON content banks (`walls.json`, `tense.json`, `broadcast.json`, `class-rules.json`, `demo-seed.json`) will likewise load via classic `.js` wrappers (or inline data scripts) so they work identically under `file://` and `http(s)://`.
   - Service worker (`sw.js`) and Chrome built-in `LanguageModel` remain progressive enhancements when running over `http(s)://`.

2. **AI model hosting and Blob URL Web Worker under `file://`**
   - AI model weights are **never bundled** inside the project folder. On first use (only after user action, with a visible MB progress bar), models are downloaded from Hugging Face / jsDelivr CDN and cached by the browser.
   - Under `file://`, `new Worker('js/ai/worker.js')` is blocked by origin rules, and `new Worker(blobUrl, { type: 'module' })` also fails in Edge/Chromium (`onerror`).
   - Verified solution: create a **classic Blob URL Worker** (`new Worker(blobUrl)` without `{ type: 'module' }`) and dynamically `await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js')` inside the worker.
   - **Browser verification (`file://`)**:
     - **Edge 158.0.4370.33**: `index.html` OK, `tests/test.html` 4/4 passed; cold download of `Xenova/all-MiniLM-L6-v2` (`q8`) completed in `6991 ms` (`22.59 MB` across 4 files in `transformers-cache`); after closing and reopening via `file://`, warm load ran in `837 ms` with 0 Hugging Face requests (`fromDiskCache: true`, `0` network bytes).
     - **Dia browser (Chromium-based, owner's machine)**: `index.html` OK, `tests/test.html` 4/4 passed; Cache API, IndexedDB, WebGPU, Gemini Nano, and Blob Worker all available; cold model download completed in `11391 ms`; after closing and reopening the browser via `file://`, cache persisted with 4 files (`22.59 MB`).

3. **Loading `data/english-2000-data.js` (`window.ENGLISH_2000_DATA`)**
   - Keep `data/english-2000-data.js` completely unmodified and load it via `<script src="./data/english-2000-data.js"></script>` before app scripts.
   - `window.ENGLISH_2000_DATA` is an explicit allowed exception to the Section 7.3 no-globals rule (alongside `window.App`).
   - Only `js/store/cards.js` is permitted to read `window.ENGLISH_2000_DATA`.

4. **Normalizing `partOfSpeech` (`card.pos`)**
   - Normalize non-empty `partOfSpeech` values from `english-2000-data.js` to canonical tags (`n.`, `v.`, `adj.`, `adv.`, `prep.`, `conj.`, `pron.`, `det.`, `aux.`, `int.`).
   - Map `"a."` to `"adj."`.
   - Empty strings (`""`, 1,282 rows) or unparseable/noisy OCR strings (such as number-list fragments like `"n.a.；0；Water freezes at zero degrees. 21 nineteen ("`) normalize to `null`.

5. **Merging `duplicate_word` rows**
   - Merge rows sharing the same `word.trim().toLowerCase()` into **one** builtin card (`1,924` unique cards total from `2,029` rows) so each word has exactly one Leitner progress record.
   - Store all contributing raw IDs in `sourceIds: string[]` and use `"b-" + firstRow.id` as `card.id`.
   - When merged rows have different `translation` strings, join distinct meanings with `"；"`.

6. **Handling `suspect_ocr_word` entries**
   - Entries flagged `"suspect_ocr_word"` (specifically `id: "0722"`, `word: "l'"`) remain in the underlying builtin data with `hidden: true` (and an `excludeFromGames` flag) so they are excluded from all games and default study decks.

7. **IPA absence**
   - `data/english-2000-data.js` contains no IPA field. Builtin cards initialize with `ipa: null`, and the IPA row in the flashcard UI is hidden whenever `card.ipa === null`. IPA is never invented by code or AI.

8. **Distractor fallback order (Section 4.2)**
   - When choosing 3 distractors for a card: prefer cards with the same canonical `pos` when `card.pos` is non-null; if unavailable or `pos` is `null`, fall back to cards from the same `unitNo`, then the same `chapterNo`, and finally other active cards in the pool (never duplicating words or meanings).

9. **Flashcard interaction (Section 2.7 vs. 3.3 B)**
   - Tap/click or `Space` flips the flashcard.
   - Horizontal swipe on touch devices rates the card (left = 還不熟, right = 記住了) **only after the card has been flipped** to avoid gesture conflicts.

10. **JS size budget scope (Section 8.1)**
    - The ~300KB JavaScript budget applies to our application modules under `js/` (excluding `data/english-2000-data.js` and external CDN AI models).

11. **Folder structure adjustments (Section 7.2)**
    - Test files are placed flat at `tests/*.test.js` alongside `tests/test.html` and `tests/guess-eval.json` (no nested `tests/tests/` folder).
    - `README.md` sits at the repository root (matching Appendix B and standard GitHub Pages repos) rather than inside `docs/`.
    - Empty directories from Section 7.2 contain `.gitkeep` placeholders during M0 so Git tracks the full structure; each `.gitkeep` will be removed when its directory receives real source files.

---

## M1 — Design System

12. **Contrast-safe foreground tokens (`--on-ink`, `--on-highlight`, `--on-wrong`, `--on-tab`)**
    - Computing WCAG 2.1 contrast ratios on the spec palette showed that `#FFFDF8` on `--tab-dialogue` (`#C46A4A`) yields `3.75:1` (below `4.5:1`), whereas dark ink `#1F1A17` (`--on-tab`) yields `4.52:1` on `--tab-dialogue`, `5.57:1` on `--tab-grammar`, and `7.12:1` on `--tab-vocab`.
    - Similarly, filled danger buttons (`--wrong`) pair with `#FFFDF8` (`5.05:1`) in light mode and `#1B1916` (`6.41:1`) in dark mode (`#F07A64`).

13. **Ruled flashcard lines & icons without CSS gradients or external icon sprites**
    - Section 2.2 forbids CSS gradients everywhere. Flashcard ruled lines use a `1px` inline SVG data URI (`background-repeat: repeat`) alongside the `feTurbulence` paper grain overlay.
    - Single-weight Phosphor-style SVG icons are built cleanly via `js/ui/icons.js` (`document.createElementNS`) so icons work offline and under `file://` without CORS sprite failures.

---

## M2 — App Shell, Store, i18n, and Router

14. **Mobile bottom bar vs. desktop sidebar navigation density**
    - Below `1024px`, the fixed bottom tab bar displays 5 primary destinations (`#/`, `#/cards`, `#/review`, `#/games`, `#/settings`) so each tab maintains comfortable `≥ 48px` width and `14px` (`--text-small`) labels at `375px`.
    - Secondary destinations (`#/decks`, `#/stats`, `#/stamps`) appear directly in the `220px` desktop sidebar (`≥ 1024px`) and remain reachable on mobile from Dashboard/Settings links.
    - During game routes (`#/games/class13`, `#/games/guess`, `#/games/wall`), `body.is-in-game` hides `#app-nav` and reveals the `52px` `#game-hud` exit bar; leaving via HUD or Browser Back opens an accessible confirmation modal.

15. **i18n loading under `file://`**
    - Language catalogues (`js/i18n/zh-TW.js` and `js/i18n/en.js`) register onto `window.AS_I18N_ZH_TW` and `window.AS_I18N_EN` via classic `<script>` tags rather than `fetch()`ing JSON files, keeping `file://` double-click compatibility intact.
    - Switching language triggers `settings:changed`, re-renders both navigation chrome and the active page via `App.router.refresh()` while preserving route parameters.

---

## M3 — Flashcards, Leitner, TTS, and Decks

16. **Default deck representation (`isDefaultAll`)**
    - The default deck `"基礎 2000 字"` (`d-builtin-2000`) stores `isDefaultAll: true` rather than writing all 1,924 builtin card IDs into `as.v1.decks`. Active membership resolves dynamically to all non-hidden builtin cards, keeping `localStorage` small and automatically excluding hidden or `suspect_ocr_word` cards.

17. **Leitner review vs. game scheduling**
    - Review ratings follow Section 3.2: `know` (記住了) promotes `box + 1` (max 5) and schedules `+1/+2/+4/+7/+14` days; `fuzzy` (有點印象) keeps the same box due tomorrow (`+1` day); `unknown` (還不熟) resets to box 1 due tomorrow (`+1` day).
    - Game outcomes (`recordGameResult`): wrong answers immediately drop to box 1 due **today** (`todayKey()`), while correct answers increment `seen`/`correct` without promoting the box.

18. **Shared Add/Edit card modal helper & TTS fallback**
    - Form rendering, validation, duplicate detection, and deck assignment live in `js/ui/card-form.js` so `#/cards` and `#/cards/:id` share one code path.
    - `js/audio/tts.js` speaks synchronously inside click gestures when voices are loaded (preserving Chromium user activation), prefers `localService === true` English voices (e.g. `Microsoft Zira Desktop` on Windows 11) with automatic retry on OS default `lang = 'en-US'` if a remote voice fails (fixing silent Dia/`file://` playback), avoids the synchronous `cancel() → speak()` race, retains the active utterance reference against Chromium GC, and supports `pitch` + `onEnd` for M10.

---

## Pre-M4 Audit & Hardening Fixes

19. **Non-destructive course data curation (`data/card-fixes.js`)**
    - `data/english-2000-data.js` remains untouched; `data/card-fixes.js` registers `App.data.cardFixes` (`hideIds` + `rowFixes`) applied by raw row ID before case-insensitive deduplication in `js/store/cards.js`.
    - 29 clear OCR-garbage and section-header rows are hidden and excluded from games (`hidden: true`, `excludeFromGames: true`); 38 obvious OCR headwords and 125 clearly context-wrong meanings are corrected and logged in `docs/DATA.md`.
    - All `generated_example` meta-template sentences are suppressed (`example: null`, `hasRealExample: false`) so cards display a quiet empty state and M7 embeddings never ingest synthetic templates. Trailing Chinese study notes are stripped cleanly from the 57 mixed `source_771` examples.

20. **Zero extra globals & router query parameters**
    - i18n catalogues register on `window.App._i18n` instead of separate `window.AS_I18N_*` globals.
    - `App.router` strips and parses hash query strings (`#/...?...`) into `params.query` so M4–M8 handoffs (`#/cards?deck=...`, `#/games/class13?words=...`) work without hitting unknown-route redirects.
    - `App.store.db` switches to its in-memory fallback with banner on both `QuotaExceededError` and `SecurityError` (private mode / blocked storage).
