# 放學後 After School

> 「放學後，才是真正的英文課。」

Integrated browser-only English learning website for Taiwanese university students (1151 Web Programming Final Project, Yuan Ze University). Built with plain HTML, CSS, and JavaScript — no framework, no build step, and relative paths only.

## How to Open

### Option A: Double-click (`file://`, recommended for quick review)
1. Download and unzip the project folder (or clone the repository).
2. Double-click `index.html` to open it directly in **Chrome**, **Dia**, or **Microsoft Edge**.
3. The core site and `tests/test.html` work immediately offline. AI features (`tests/ai-spike.html`) download models from Hugging Face / jsDelivr CDN on first use with a progress bar and cache them in the browser.

### Option B: VS Code Live Server (`http://`, needed for Service Worker & Chrome Prompt API)
1. Open the project folder (`after_class`) in **Visual Studio Code**.
2. Install the **Live Server** extension (`ritwickdey.LiveServer`) if you do not have it yet.
3. Right-click `index.html` in the Explorer and choose **Open with Live Server** (or click **Go Live** in the bottom-right status bar).
4. Open `http://127.0.0.1:5500/index.html`, `http://127.0.0.1:5500/tests/test.html`, or `http://127.0.0.1:5500/tests/ai-spike.html`.

## Project Status

- **Current milestone:** M6 Complete (Design system, app shell, `file://`-safe lazy loader, i18n zh-TW/en, storage + migrations, flashcards, Leitner 5-box review, attempt log, onboarding, shared game engine, 四格分類牆 with 12 validated walls, and 3-tier browser AI layer + Feature A 錯題解說: deterministic code 錯誤原因/記憶提示 + Qwen 2.5 WebGPU `AI 例句` with sentence quality gate, safe `<mark>` highlighting, card fallback, and 5-attempt diagnostics) — ready for M7.
- **Specification:** `docs/spec/part01.md` – `docs/spec/part11.md`
- **Data audit & curation log:** `docs/DATA.md`
- **Authored English content for review:** `docs/CONTENT.md`
- **Design & implementation decisions:** `docs/DECISIONS.md`

## Browser Support (Target)

- Chrome / Edge / Dia desktop (latest; Chrome 148+ for optional built-in Prompt API over `http(s)://`)
- Safari iOS, Chrome Android

## Known Limits (Through M6)

- Builtin vocabulary comes from `data/english-2000-data.js` (unmodified) with non-destructive OCR and translation curation in `data/card-fixes.js`.
- Curated walls (`data/walls.js`) currently ship 12 validated walls (expanding to 30 by T3).
- 你說我猜 (M7), 第 13 節課 (M8/M10), Dashboard timetable & charts (M9/M11), AI Features B–E (M11/M13), and offline Service Worker (M12) are staged until their respective milestones.
