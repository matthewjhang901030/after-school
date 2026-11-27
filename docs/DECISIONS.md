# Architectural & Specification Decisions (`docs/DECISIONS.md`)

Every choice not fully specified by `docs/spec/part01.md`–`part11.md`, or resolved where the spec and source dataset interacted, is logged here.

---

## M0 — Setup, Data Audit, and `file://` Architecture

1. **Supporting direct double-click (`file://`) alongside HTTP (`http(s)://`)**
   - The teacher's evaluation flow is downloading the repo ZIP, unzipping, and double-clicking `index.html` (`file://`), while GitHub Pages and VS Code Live Server serve over `http(s)://`.
   - Under `file://`, `<script type="module" src="./...">` and `fetch('./data/...')` are blocked by browser CORS policy. Therefore, application scripts load as **classic `<script src="./...">` files** wrapped in IIFEs registering onto `window.App` (relative paths only, zero build step).
   - Future content banks (named `walls.json`, `tense.json`, `broadcast.json`, `class-rules.json`, `demo-seed.json`, and `tests/guess-eval.json` in the spec) are implemented as classic `.js` files (`data/walls.js`, `data/tense.js`, `data/broadcast.js`, `data/class-rules.js`, `data/demo-seed.js`, `tests/guess-eval.js`) assigning onto `window.App.data.*` so they work identically under `file://` and `http(s)://` with zero local `fetch()`.
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
    - Test files are placed flat at `tests/*.test.js` alongside `tests/test.html` and `tests/guess-eval.js` (no nested `tests/tests/` folder).
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
    - `js/audio/tts.js` never disables speaker buttons based on `getVoices()` at initial render (buttons stay enabled whenever `window.speechSynthesis` exists). Uses `1.0` normal rate and `0.8` slow rate (avoiding distortion on online voices at `0.6`), prefers Edge `"Microsoft ... Online (Natural)"` `en-US` and Chrome `"Google US English"` before local `en-US` (with local fallback on error), waits `55ms` after `cancel()` before `speak()`, ignores rapid duplicate clicks while speaking, shows the `"此瀏覽器找不到英文語音，請改用 Edge 或 Chrome 開啟。"` toast at most once per page view, retains `_activeUtter` against GC, and supports `pitch` + `onEnd` for M10.
    - **M10 AI Backlog:** Add optional **Kokoro in-browser TTS fallback** (e.g. `Kokoro-82M` via Transformers.js / CDN cache, Section 3.6) for browsers without native English voices.

---

## Pre-M4 Audit & Hardening Fixes

19. **Non-destructive course data curation (`data/card-fixes.js`)**
    - `data/english-2000-data.js` remains untouched; `data/card-fixes.js` registers `App.data.cardFixes` (`hideIds` + `rowFixes`) applied by raw row ID before case-insensitive deduplication in `js/store/cards.js`.
    - 29 clear OCR-garbage and section-header rows are hidden and excluded from games (`hidden: true`, `excludeFromGames: true`); 130 `rowFixes` rows are corrected (38 OCR headword fixes — 33 of which also fixed meaning — plus 92 pure context-meaning fixes = 125 meaning updates total) and logged in `docs/DATA.md`.
    - All `generated_example` meta-template sentences are suppressed (`example: null`, `hasRealExample: false`) so cards display a quiet empty state and M7 embeddings never ingest synthetic templates. Trailing Chinese study notes are stripped cleanly from the 57 mixed `source_771` examples.

20. **Zero extra globals & router query parameters**
    - i18n catalogues register on `window.App._i18n` instead of separate `window.AS_I18N_*` globals.
    - `App.router` strips and parses hash query strings (`#/...?...`) into `params.query` so M4–M8 handoffs (`#/cards?deck=...`, `#/games/class13?words=...`) work without hitting unknown-route redirects.
    - `App.store.db` switches to its in-memory fallback with banner on both `QuotaExceededError` and `SecurityError` (private mode / blocked storage).

---

## M4 — Review and Learning Record

21. **Review queue composition & daily new-word quota**
    - `App.store.leitner.buildReviewQueue()` caps each review session at `20` cards (Section 3.3 B): due cards (`due <= todayKey`, ordered by oldest `due`, lowest `box`, oldest `lastSeen`) fill first, then unseen cards top up remaining slots up to `dailyNewWords` (default `10`, configurable `5–30` in Settings) minus cards whose `firstSeenDay === todayKey`.
    - When no cards are due and the daily new-word quota is filled, `#/review` renders the empty state (`今天的卡片都複習完了。`) with two actions: **學習新單字** (`forceNewOnly: true` starts an extra batch of unseen words) and **去玩遊戲** (`#/games`).

22. **Unified attempt log compaction & session persistence (`js/store/attempts.js`)**
    - Every review or game answer appends to `as.v1.attempts` with local `dayKey` (`App.date.todayKey()`) and emits `attempt:recorded`.
    - Once `as.v1.attempts` exceeds `5,000` entries, oldest entries are compacted into `as.v1.daily` buckets keyed by `(dayKey, source, skill)` summing `{ total, correct }`, preserving long-term charts without exhausting `localStorage`.
    - Completed sessions are written to `as.v1.sessions` only when a review or game finishes; navigating away mid-session never writes a session record.

23. **First-visit 3-step onboarding presentation (`js/ui/onboarding.js`)**
    - On first visit (`!settings.get('onboarded')`), Dashboard (`#/`) renders the 3-step onboarding card inline at the top (Step 1: pick daily new words; Step 2: flip a real builtin sample card; Step 3: done + jump to `#/review`, with a Skip option at every step) so it stays mobile-friendly at 375px and never steals focus or blocks route navigation. Learners can also replay it anytime via Settings (`App.onboarding.open()`).

---

## M5 — Lazy Loading Budget, Shared Game Engine & 四格分類牆

24. **JS 300 KB budget applies to initial load via `file://`-safe classic-script lazy loader (`js/util/loader.js`)**
    - Per owner rule update before M5, the ~300 KB application JS budget covers the **initial load** (`<script>` tags loaded by `index.html` on first paint).
    - `App.loadScripts(paths)` and `App.loadStyles(paths)` dynamically inject classic `<script src="./...">` / `<link rel="stylesheet">` tags on first visit to a route, preserving execution order, deduplicating already-loaded and in-flight paths, and clearing failed entries so a Retry button reloads cleanly under both `file://` and `http(s)://`.
    - `App.router.registerLazy(path, { scripts, styles, getPage })` renders a loading state while fetching, discards stale navigations if the user switches routes mid-load, and renders an error panel with a Retry button on failure.
    - Non-core pages (`cards`, `card-detail`, `review`, `decks`, `games`, `stats`, `stamps`, `settings`, `ai-diagnostics`, `styleguide`), secondary UI (`card-form.js`, `keyboard.js`), games (`engine.js`, `wall/*`, `class13/*`, `guess/*`), and content banks (`data/walls.js`, future `tense.js`, `broadcast.js`, `class-rules.js`) load lazily on first visit.

25. **Shared game engine & 四格分類牆 rules (`js/games/engine.js`, `js/games/wall/*`, `data/walls.js`)**
    - `App.games.engine` centralizes scoring (`100` base + up to `50` linear speed bonus + `1.5×` combo from 3rd consecutive correct), `performance.now()` + `requestAnimationFrame` delta timing with automatic `visibilitychange` pause, cancellable 3-2-1 countdowns, and confusion-pair persistence (`as.v1.confusions`).
    - `data/walls.js` ships 12 validated handcrafted walls for M5 (all documented for owner review in `docs/CONTENT.md`; planned expansion to 30 walls by T3). Every wall passes `App.games.wallValidate.validateWall()` (4 groups × 4 unique items ≤ 3 words, levels 1–4, all 3 skills `vocab`/`grammar`/`dialogue`, every vocabulary single-word verified in `english-2000-data.js` or grammar whitelist).
    - Per Section 4.5.4, wrong submissions in 四格分類牆 do **not** demote cards to Leitner box 1; instead, every cross-group pair in a wrong submission is logged to `as.v1.confusions`, and 3-of-4 matches show `"差一個"` / `"One away"`. Duplicate wrong combinations do not cost an extra mistake.

---

## M6 — Three-Tier AI Layer & Feature A (錯題解說)

26. **Wall validator updates after M5 owner content review**
    - Updated 5 dialogue tiles per owner review (`w-02` `"Can you help me?"`, `w-06` `"Feel better"`, `w-10` `"Sorry about that"`, `w-11` `"Are you free?"`, `w-12` `"Take it easy"`) and replaced duplicate `"Excuse me"` in `w-05` with `"Which way?"`.
    - Tile word-count limit updated from 3 to 4 words in `js/games/wall/validate.js` so short 4-word natural phrases like `"Can you help me?"` pass cleanly while keeping mobile wrapping readable.
    - Added `findDialogueConflicts(walls)` inside `validateAll()` to reject reusing the same dialogue phrase across two walls under different meanings.

27. **Qwen 2.5 0.5B Instruct ONNX quantization & `file://` Blob Worker**
    - Because Chrome's Gemini Nano Prompt API was unavailable in our spike, Tier 2 (**`onnx-community/Qwen2.5-0.5B-Instruct`** via Transformers.js `@huggingface/transformers@3.5.1` inside a classic Blob URL Worker) is the primary real AI path under both `file://` and `http(s)://`.
    - Inspecting Hugging Face ONNX weights showed `model_q4.onnx` is `749.7 MB`, whereas **`model_q4f16.onnx` is `460.63 MB`** (`467.4 MB` total incl. `6.71 MB` `tokenizer.json` + configs) and `model_quantized.onnx` (`q8`) is `488.37 MB` (`495.1 MB` total).
    - **Measured benchmark (`onnx-community/Qwen2.5-0.5B-Instruct`, Transformers.js 3.5.1):**
      - `q8` (`model_quantized.onnx`, `495.1 MB`, cold load `49.3 s`, warm load `2.16 s`) severely degraded Chinese instruction following and JSON generation, so `q8` was dropped in favor of **`q4f16`** (`467.4 MB`) for both WebGPU and WASM.
      - **CPU/ONNX Runtime (`q4f16`, 80-token Feature A cap, measured without browser automation):** cold download + init `48.5 s`, warm load `5.5 s`, 1-token warm-up `0.7 s`, **first-token time (TTFT) `3.5 s`** (`3,510 ms`), **full answer time `16.2 s`** (`16,162 ms`, `1.5 tok/s`).
      - **Browser WebGPU vs WASM (`file://` Chrome/Edge):** `qwen.js` verifies `navigator.gpu.requestAdapter()` inside the Blob Worker and selects `device: 'webgpu'` (`dtype: 'q4f16'`) first, falling back to `'wasm'` only on failure (recording `webgpuError`). Active device (`WebGPU` / `WASM`), warm-up time, TTFT, and full answer time are shown live in the AI badge and `#/settings/ai` for owner verification in Chrome & Edge (no browser automation was run to fabricate WebGPU numbers).
      - **TTFT timeout & background warm-up:** Generation timeout (`20 s`) now applies strictly to **Time-To-First-Token (TTFT)** and clears the moment the first token streams in, while the **「停止」** button remains active throughout. Opening a game calls `App.ai.warmUpIfCached()` only when Qwen is already cached in `transformers-cache` (never auto-downloading) so shaders/kernels compile ahead of the first question. Feature A caps output at `80` tokens, salvages cleanly truncated JSON, and displays elapsed time in seconds with one decimal (`耗時 6.8 秒`).

28. **Plain-text lenient Feature A parser for Qwen 0.5B + Last AI Attempt diagnostics**
    - Owner test on Chrome (`file://`, WebGPU, 5 cached files `467.3 MB`) confirmed fast generation (`2.8 s`), but Qwen 0.5B failed strict JSON formatting and fell back to templates.
    - Updated Tier 2 (Qwen) to use native multi-turn chat template few-shot examples (`temperature: 0.3`, `top_p: 0.9`, no `repetition_penalty` since penalty on multi-byte UTF-8 BPE tokens scrambles CJK characters) requesting a simple 2-line plain-text output (`原因：...` / `記憶提示：...`).
    - `App.ai.parseFeatureAOutput()` parses leniently (accepts full/half-width colons, strips markdown & quotes, supports missing labels by splitting first sentence as reason and rest as tip, converts Simplified → Traditional Chinese via `App.ai.s2t()`), while keeping essential safety checks (Traditional Chinese required in `zh-TW`, length limits, refusal/code rejection, fact-contradiction check, and `textContent`-only rendering).
    - Every AI attempt (success or fallback) persists telemetry (`firstTokenMs`, `elapsedMs`, `device`, `tokenCount`, `rawOutput`, `rejectionReason`) to `as.v1.ai.lastAttempt` & `as.v1.ai.telemetry` and displays them in `#/settings/ai` under **量測數據** and **最近一次 AI 嘗試**.

29. **Deterministic code-generated 錯誤原因 + 1-sentence Qwen 記憶提示 + repetition quality gate + opt-in 1.5B model**
    - Edge WebGPU testing confirmed `Qwen 2.5 0.5B` runs fast (`8.4 s` on WebGPU), but can still fall into degenerate repetition loops (`自己、自己、自己、他人...`) when asked to explain multi-group logic.
    - **Split responsibility cleanly (Section 5.1):** `App.ai.buildDeterministicReason(facts)` builds **錯誤原因** deterministically in code directly from wall/word data (always instant and 100% accurate); Qwen writes **ONLY ONE short 記憶提示** (`max_new_tokens: 60`, `temperature: 0.3`, verified `no_repeat_ngram_size: 3`, stopping immediately at the first newline or `。` via `InterruptableStoppingCriteria`).
    - **Quality gate (`App.ai.validateTipOutput`):** rejects and falls back to the template tip (recording raw output + exact reason in **最近一次 AI 嘗試**) if any 2–4 character chunk repeats 3+ times (`repetition_loop`), > 40% of characters are duplicates (`high_duplicate_ratio`), tip exceeds 60 characters (`too_long`), lacks Chinese in `zh-TW` (`no_chinese`), or contains code/refusal text (`refusal_or_code`).
    - **Opt-in Qwen model choice (`settings.qwenModel`):** learners can choose `Qwen2.5-0.5B-Instruct` (default, `~467 MB`) or `Qwen2.5-1.5B-Instruct` (`onnx/model_q4f16.onnx` `1,165.3 MB` + `6.71 MB` tokenizer = `~1,172 MB`, labeled experimental) in **設定** or **設定 → AI 診斷**, with download size shown before downloading and per-model load/TTFT/answer timings persisted in `as.v1.ai.telemetryByModel`.

30. **Echo detector, relevance check, focused word-pair prompt, and `load_error` vs `download_error` (Chrome `file://` verification)**
    - Chrome testing confirmed `Qwen 2.5 0.5B` WebGPU speed (`load 4.5 s`, `1st token 1.5 s`, `total 2.2 s`) and revealed two failure modes: (a) 0.5B echoed length/format instructions (`30字內的簡潔體中的素除外。`), and (b) `Qwen 2.5 1.5B` (`1,172 MB` single-file ONNX) downloaded cleanly to Cache Storage but crashed Emscripten WASM with `Aborted(). Build with -sASSERTIONS for more info.` when WebGPU fell back to 32-bit WASM.
    - **Echo & relevance gates (`js/ai/index.js`):** removed all length/format words from the prompt text (length cap `40` chars enforced only in code), asked Qwen to compare ONE specific cross-group word pair (`pickFocusPair(facts)`), added `detectPromptEcho()` (`prompt_echo` on instruction keywords or 4+ char overlap with prompt/few-shot text), and added `isRelevantTip()` (`off_topic` if tip mentions neither a selected English word nor a group keyword).
    - **Error classification & 1.5B resilience:** `classifyInitError()` separates `load_error` (WASM `Aborted()`, OOM, WebGPU/ONNX session errors, or failures when already cached — UI message 「模型載入失敗」) from genuine network `download_error`. `1.5B` now runs WebGPU-only (no 32-bit WASM fallback), is labeled 「實驗性，部分電腦無法載入」, and automatically switches `settings.qwenModel` back to `'0.5b'` after a `load_error` so the next attempt succeeds immediately.
    - All AI scripts (`js/ai/*`, `js/ui/ai-panel.js`, `css/pages/ai.css`) lazy-load on first use via `App.loadScripts` so initial `index.html` JS stays well under 300 KB.
    - Feature A runs spoiler-safe during an active 四格分類牆 round via the **「為什麼錯？」** button after any wrong guess, and with full group rules on the end screen (**「請 AI 解釋錯題」**). Every AI output is validated, rendered strictly via `textContent`, shows source badge + disclaimer, supports `AbortController` Stop + 20s TTFT timeout, retries once on rejected output, and falls back gracefully without error.

31. **Scope Qwen 0.5B to English-only `AI 例句` (both `錯誤原因` and `記憶提示` generated by code/template)**
    - Chrome WebGPU testing showed that even with echo and relevance gates, `Qwen 2.5 0.5B` could still emit nonsensical Chinese text containing a target word (`「note 起做任何事，anytime 作「謝謝」，一個就算兩倒，成這。」`) because rule-based checks cannot verify Chinese semantic coherence at 0.5B scale.
    - **Clean division of labor:**
      - **錯誤原因** (`App.ai.buildDeterministicReason`) and **記憶提示** (`App.ai.buildDeterministicTip`) are **always** generated deterministically by code/templates in Traditional Chinese (instant, 100% accurate, never produced by Qwen).
      - **AI 例句** (new section rendered under `記憶提示` with badge): Qwen writes **ONE short English example sentence** using one tile from the group the player confused most (`pickTargetForExample`), using an English-only 3-shot prompt (`temperature: 0.3`, `max_new_tokens: 30`, `no_repeat_ngram_size: 3`, stopping at the first `\n`).
      - **Sentence quality gate (`App.ai.validateSentenceOutput`):** enforces Latin letters & basic punctuation only (`non_latin`), complete ending punctuation `.`/`!`/`?` (`incomplete_sentence`), `4–14` words (`too_short`/`too_long`), no word repeated 3+ times (`word_repetition`), no copied few-shot examples (`copied_fewshot`), correct English indefinite articles `a`/`an` with sound exceptions (`article_error`), and target word/phrase or simple inflection appearing **exactly once** (`missing_target`, `target_repeated`).
      - **Card-grounded English prompt & target ranking:** `pickTargetForExample` skips dialogue phrases (e.g. `"You're welcome"`, `"Can you help me?"`), preferring single words and `take`-phrases (`eraser`, `took`, `a note`) from the most-confused non-dialogue group, and passes each target with its part of speech and Chinese meaning from card data (e.g. `Word: eraser (noun, 橡皮擦)`).
      - **Temperature retry schedule & budget:** On rejection, retries up to 2 more times (`0.3 → 0.6 → 0.8`) within a `4 s` total budget, returning the first passing sentence and logging every attempt (with temperature, timestamp, raw output, and exact reason) into the 5-attempt Diagnostics history (`#/settings/ai`). Offline Qwen 2.5 0.5B (`q4f16`) benchmark across 12 wall targets measured `9/12` (`75%`) on try 1 and **`11/12` (`91.7%`)** with the 3-try retry schedule.
      - **Badges & fallback:** When Qwen supplies the sentence, both the panel and `AI 例句` block display `Qwen 2.5 0.5B · WebGPU` (not `離線範本`). If all attempts fail, falls back to a real card example from the target or another selected non-dialogue tile (labeled `卡片例句`), or hides the example block completely and shows `離線範本` only in that case.
      - **Milestone status:** M6 complete and owner-verified on Chrome (`file://`, WebGPU `0.9–2.8 s`).
      - **M13 AI Polish Backlog:** Word sense: modal `'may'` sometimes gets month-sense examples (`An April May Month.`) — fix in M13 polish.

---

## M7 — 你說我猜 (Taboo-Style Semantic Guessing Game)

32. **Bounded candidate ranking + `Xenova/all-MiniLM-L6-v2` Blob Worker + offline fallback (`js/ai/embed.js`, `js/games/guess/*`)**
    - Uses `Xenova/all-MiniLM-L6-v2` (`q8`, ~`22.6 MB`) via the same Transformers.js CDN + classic Blob URL Worker pattern as Qwen (`file://` and `http(s)://` compatible), trying `webgpu` first with seamless `wasm` fallback and caching computed card vectors in IndexedDB (`App.store.idb.getMany` / `putMany`).
    - **Bounded candidate list (`buildCandidates`):** instead of searching all 2,000 words on every guess, each round ranks the **target card + 18 distractors** (19 candidates total, prioritized from the same unit/chapter/topic & POS in the active deck). This keeps inference instantaneous and produces meaningful near-synonym competition (e.g. `bookstore` vs `library`).
    - **Rule checker (`js/games/guess/checks.js`):** blocks non-English text (`請用英文描述`), descriptions outside `4–30` words, duplicate clues (`換個說法試試`), target words + simple forms (plural, `-s`/`-es`, `-ed`, `-ing`, `-er`, `-est`, irregulars — struck through in red via `<del>`), and 3 forbidden words + their simple forms (highlighted via `<mark>`).
    - **Offline fallback ranker (`App.ai.embed.rankOffline`):** whenever MiniLM is unavailable, offline (uncached), or declined by the user, ranks the same candidate list via weighted keyword-overlap + stem matching + chapter/topic semantic cues + POS cues, displaying the **`離線版本`** badge (`MiniLM · WebGPU` or `MiniLM · WASM` when embeddings run).
    - **Shared attempts & Review loop:** every finished round logs to `as.v1.attempts` (`source: 'guess'`) and updates `App.store.leitner.recordGameResult(cardId, 'guess', won)`, sending missed cards to Box 1 due today so they surface in Today's Review.
    - **Evaluation benchmark (`tests/guess-eval.js`):** Added a 30-item classic-script evaluation set of concrete words from `english-2000-data.js` with natural student clues (all 30 validated against `App.store.cards` and `guessChecks.validateDescription`). On hard 19-candidate same-topic sets, the offline keyword-overlap fallback achieves `5/30` (`16.7%`) top-3 accuracy because same-topic distractors share chapter cues and many builtin cards lack real examples; semantic ranking therefore relies primarily on `Xenova/all-MiniLM-L6-v2` embeddings with the offline ranker serving strictly as a playable no-network fallback.
    - All M7 game & embedding scripts (`js/ai/embed.js`, `js/games/guess/checks.js`, `js/games/guess/index.js`, `css/pages/guess.css`) lazy-load on `#/games/guess`, keeping initial-load `js/` well under `300 KB`.

---

## M8 — 第 13 節課 (Core Horror Typing Game)

33. **Modular 第 13 節課 core (`js/games/class13/*`, `data/tense.js`, `data/broadcast.js`)**
    - Implemented exact Section 4.3.1 core rules: `90 s` per period, target score `600 + 200 × (period − 1)`, distance starting at `12.0 m` (`+1.5 m` correct capped at `12 m`, `−0.3 m` wrong keystroke, `−2.0 m` missed question at `8 s` timeout), creature speed `0.20 + 0.05 × (period − 1)` m/s, lose at `0 m`, win after Period 5 (with endless mode continuation).
    - Authored two classic-script content banks (`data/tense.js` with **80** verb-form items across irregular past, past participle, 3rd-person `-s`, and `-ing`; `data/broadcast.js` with **40** everyday dialogue cloze items) and documented them in `docs/CONTENT.md` for owner review.
    - Per-letter prefix validation (`App.games.class13Questions.evaluateKeystroke`) checks every keystroke against all accepted answers simultaneously (e.g. `didn't` and `did not`, multi-word answers with spaces, case-insensitive) and records mistyped letters for the end-screen breakdown and `as.v1.attempts`.
    - `App.games.class13Creature` renders the corridor window and scaling silhouette via `document.createElementNS` (zero `innerHTML`, zero CSS gradients) with the learner's missed words written onto the creature's body in red ink.
    - Included content warning + dismiss persistence (`settings.class13WarningDismissed`) and `safeMode` toggle right on the start screen; all M8 scripts and banks lazy-load on `#/games/class13`.

34. **第 13 節課 Full Special Mechanics, Fixed Timestep & Accessibility (`js/games/class13/supplies.js`, `atmosphere.js`, `data/class-rules.js`)**
    - Upgraded the `requestAnimationFrame` loop to a **50 ms fixed-timestep accumulator** (`dt` clamped `<= 250 ms`) with pure-logic separation (`questions.js` + `supplies.js` have zero DOM calls; `atmosphere.js` synthesizes footsteps/heartbeat procedurally via Web Audio API with zero external sound files).
    - Implemented all Section 4.3.3–4.3.7 special mechanics: **Supply crates** (`bell` 5 s freeze, `slow` 8 s `-50%` speed, `fluid` `+3 m` push, `flashlight` 2-letter reveal; keys `1`/`2`/`3`, cap `2` or `3` via rule), **Key Rot** (3 s lock, hard cap 3 with oldest-first heal so the game never locks up, reset between periods), **Shuffled keyboard** from Period 3, **PA announcements**, **Audio-only rounds** (Period 3+ / `cr-audio`, with replay + Chinese hint fallback), and **8 扭蛋機 class-rule cards** in `data/class-rules.js`.
    - **安心模式 (`safeMode`) & Accessibility:** disables footsteps, heartbeat, flicker, shake, blackout, key rot, and scrambled keyboard; slows creature speed (`×0.70`) and extends question timeout to `12 s` with high-contrast readable styling; 100% keyboard-playable (`Escape` pause, `1/2/3` supplies, `Enter` advance); subtle fluorescent flicker runs at `0.42 Hz` (strictly `< 3 flashes/sec`) and disables under `prefers-reduced-motion`.
