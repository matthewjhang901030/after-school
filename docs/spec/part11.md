---PAGEBREAK---

# Appendix B. GitHub and GitHub Pages guide (step by step)

## B.1 One-time setup

1. Sign in at github.com. Click **New repository**. Name: `after-school` (lowercase, no spaces). Visibility: **Public** (GitHub Pages on a free account needs a public repo). Do not add a README (the project has one).
2. Install Git for Windows (git-scm.com) if it is not installed. Open a terminal in the project folder and set your identity once:

```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

3. Connect the local project to GitHub and push the first version:

```
git init
git add .
git commit -m "chore: initial project structure"
git branch -M main
git remote add origin https://github.com/<your-username>/after-school.git
git push -u origin main
```

A browser window may ask you to sign in to GitHub the first time; approve it. Alternative without commands: **GitHub Desktop** (File → Add local repository → Publish repository).

## B.2 Turn on GitHub Pages

1. In the repository: **Settings → Pages**.
2. Source: **Deploy from a branch**. Branch: `main`, folder: `/ (root)`. Save.
3. After 1–2 minutes the site is live at `https://<your-username>.github.io/after-school/`. The link appears at the top of the Pages settings.
4. Important: the site lives under `/after-school/`, not `/`. All paths in HTML, CSS, JS, and the service worker must be **relative** (`./css/base.css`, not `/css/base.css`). This is the most common reason a site works locally but breaks on Pages.
5. Keep the empty `.nojekyll` file in the root so GitHub Pages serves every folder unchanged.

## B.3 Daily workflow

```
git add .
git commit -m "feat: add wall validator"
git push
```

Pages redeploys automatically after each push (1–2 minutes). If the old version still shows, it is the service worker cache: bump `CACHE_VERSION` in `sw.js` on each deploy, and hard-reload (Ctrl+Shift+R) while testing.

## B.4 Safe points with tags

Before each demo, mark a stable version:

```
git tag demo-1
git push origin demo-1
```

Use `final` for the last version. If something breaks later, the tagged version can be downloaded from the repository's **Tags / Releases** page or restored with `git checkout demo-1`.

## B.5 Submitting

Give the teacher both links: the repository (`https://github.com/<your-username>/after-school`) and the live site (`https://<your-username>.github.io/after-school/`). If the course asks for a zip instead, use **Code → Download ZIP** on the tagged version.

## B.6 Letting Antigravity handle Git

Antigravity can run the commands above. Ask it to commit after each milestone with the message format from Appendix A, and to never force-push (`git push --force`) or rewrite history.

---PAGEBREAK---

# Appendix C. Rubric mapping

| Rubric item (weight) | What "excellent" requires | How this project meets it |
|---|---|---|
| 功能完整性 Functionality (35%) | All required features, stable, edge cases handled | Sections 3–6 with edge-case tables; QA checklist 8.1; automated tests 7.9 |
| UI / UX (15%) | Clear layout, intuitive, good RWD, clear feedback | Design system Section 2; 3 breakpoints; ○/✗ grading feedback; 4 states per screen |
| AI 整合與應用 (20%) | Useful, natural integration, good prompt design, can explain limits | AI inside the game rules (你說我猜), Features A–E tied to mistakes and stats, prompt rules 5.4, validation 5.5, diagnostics panel 5.7 |
| Demo 與口頭報告 (20%) | Smooth demo, clear explanation, answers questions, reflects on trade-offs | Scripts 8.2 and 8.3, Q&A prep 8.4, backup plan 8.5 |
| 創新性與完成度 (10%) | Creative, technically challenging, polished | Horror typing game with key rot, embedding-based guessing, stationery design language, each game covering all three skills |

# Appendix D. Open items to verify early

| Item | Why it matters | When |
|---|---|---|
| Fields in `english-2000-data.js` (IPA? examples? part of speech?) | Card UI and AI facts depend on it | M0, day 1 |
| Embedding model choice, download size, and guess accuracy | 你說我猜 quality | Start of M7; prototype on day 1 if possible |
| Qwen 2.5 0.5B download size and speed on the demo laptop (WebGPU and WASM) | AI tier 2 latency | M6 |
| Gemini Nano and Translator API availability on the demo laptop | Tier 1 feasibility | M6 |
| Demo laptop specs (RAM, GPU, free disk) | Decides which tier is shown live | Before Demo 1 |
| Licences of every font, icon set, and sound | Course rule on asset licences | Before final demo |
| Owner review of all English content (walls, tense, broadcast) | Correctness in an English-learning app | Before each demo |
| Whether the course accepts a GitHub link or requires a zip | Submission format | Ask the teacher before 12/17 |

> Inspiration references (cite in the report, do not copy assets): NYT Connections and Only Connect (grouping puzzles); Taboo, Contexto, Semantle (meaning-based word games); tower-defense typing games with slow/freeze power-ups; KEYKRUNCHER™ by Sunscorched Studios (approaching threat, ironic tone, scrambled keyboard); Chrome Prompt API documentation (developer.chrome.com/docs/ai/prompt-api); course project page (1151 Web 程式設計 期末專題說明頁).
