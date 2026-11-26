# 放學後 After School

> 「放學後，才是真正的英文課。」

Integrated browser-only English learning website for Taiwanese university students (1151 Web Programming Final Project, Yuan Ze University). Built with plain HTML, CSS, and JavaScript — no framework, no build step, and relative paths only.

## How to Open

### Option A: Double-click (`file://`, recommended for quick review)
1. Download and unzip the project folder (or clone the repository).
2. Double-click `index.html` to open it directly in **Chrome** or **Microsoft Edge**.
3. The core site and `tests/test.html` work immediately offline. AI features (`tests/ai-spike.html`) download the model from Hugging Face / jsDelivr CDN on first use with a progress bar and cache it in the browser.

### Option B: VS Code Live Server (`http://`, needed for Service Worker & Chrome Prompt API)
1. Open the project folder (`after_class`) in **Visual Studio Code**.
2. Install the **Live Server** extension (`ritwickdey.LiveServer`) if you do not have it yet.
3. Right-click `index.html` in the Explorer and choose **Open with Live Server** (or click **Go Live** in the bottom-right status bar).
4. Open `http://127.0.0.1:5500/index.html`, `http://127.0.0.1:5500/tests/test.html`, or `http://127.0.0.1:5500/tests/ai-spike.html`.

## Project Status

- **Current milestone:** M0 (`file://` refactor + AI Blob Worker / cache spike)
- **Specification:** `docs/spec/part01.md` – `docs/spec/part11.md`
- **Data audit:** `docs/DATA.md`
- **Design & implementation decisions:** `docs/DECISIONS.md`

## Browser Support (Target)

- Chrome / Edge desktop (latest; Chrome 148+ for optional built-in Prompt API over `http(s)://`)
- Safari iOS, Chrome Android

## Known Limits (M0)

- M0 provides the folder skeleton, data audit documentation, a minimal boot check in `index.html`, the `tests/test.html` runner, and the `tests/ai-spike.html` CDN/Blob Worker cache spike. Application features will be built milestone by milestone per Appendix A.
