# 放學後 After School

> 「放學後，才是真正的英文課。」

Integrated browser-only English learning website for Taiwanese university students (1151 Web Programming Final Project, Yuan Ze University). Built with plain HTML, CSS, and JavaScript ES modules — no framework, no build step, and relative paths only.

## Local Development (VS Code Live Server)

> **Important:** Do **not** open `index.html` directly by double-clicking (`file://`). ES modules, the service worker, and browser AI APIs require `http://` or `https://` (`localhost`).

1. Open the project folder (`after_class`) in **Visual Studio Code**.
2. Install the **Live Server** extension (`ritwickdey.LiveServer`) if you do not have it yet.
3. Right-click `index.html` in the Explorer and choose **Open with Live Server** (or click **Go Live** in the bottom-right status bar).
4. Your browser will open `http://127.0.0.1:5500/index.html` (port may vary).
5. To run the in-browser test suite, open `http://127.0.0.1:5500/tests/test.html`.

### Alternative local server (without VS Code)

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/` and `http://localhost:8000/tests/test.html`.

## Project Status

- **Current milestone:** M0 (Setup and data audit)
- **Specification:** `docs/spec/part01.md` – `docs/spec/part11.md`
- **Data audit:** `docs/DATA.md`
- **Design & implementation decisions:** `docs/DECISIONS.md`

## Browser Support (Target)

- Chrome / Edge desktop (latest; Chrome 148+ for optional built-in Prompt API)
- Safari iOS, Chrome Android

## Known Limits (M0)

- M0 provides only the folder skeleton, data audit documentation, a minimal boot check in `index.html`, and the `tests/test.html` runner. Application features will be built milestone by milestone per Appendix A.
