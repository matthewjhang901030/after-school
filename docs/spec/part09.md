---PAGEBREAK---

# 8. Quality assurance and demo plan

## 8.1 QA checklist (run before each demo and after each milestone)

Devices and browsers: 375px (iPhone), 768px (iPad), 1440px (laptop); Chrome, Edge, Safari iOS, Chrome Android.

| Group | Scenarios that must pass |
|---|---|
| Network and AI | Fully offline; slow 3G (DevTools throttling); no WebGPU; no Gemini Nano; closing the tab while a model downloads, then reopening |
| Data | Private mode (storage blocked); storage full; importing a corrupt JSON file; old schema version; reset and start over |
| Interaction | Rapid repeated clicks; switching tabs mid-game; reloading mid-game; browser Back mid-game; rotating the phone |
| Content | Very long words; switching zh-TW ↔ en (no overflow); dark mode; empty deck; deck with fewer than 4 cards |
| Accessibility | Whole loop with keyboard only; `prefers-reduced-motion`; 安心模式; browser zoom 200% |
| Technical | `/tests/test.html` all green; **zero red errors in the console**; after leaving a game no sound, timer, or animation frame is still running |

Performance budget: first load under 2 seconds on a normal connection (excluding AI models); total JavaScript under about 300KB; Lighthouse Performance and Accessibility at least 90.

## 8.2 Demo 1 script (12/10, about 3–4 minutes)

1. Dashboard and 今日課表 (30s).
2. Flip a card, play pronunciation, rate it (40s).
3. Play one 四格分類牆 wall (60s).
4. 你說我猜: AI guesses a word from a description — the AI prototype required by the course (40s).
5. Screenshot of the 第 13 節課 core loop and the plan to 12/17 (30s).

## 8.3 Final demo script (12/17, 7 minutes)

The course asks the talk to cover 理念、架構、功能、AI 整合方式、困難與心得 (5–8 minutes).

| Time | Content | Rubric item |
|---|---|---|
| 0:00–0:45 | 理念: why "After School", the learning loop | Demo and presentation |
| 0:45–1:30 | 架構: one shared learning record, 3-tier AI | Presentation, AI |
| 1:30–5:00 | Live demo following the loop: 今日課表 → review 3 cards → solve one wall group → 第 13 節課 for about 40s with sound and key rot → 補考名單 + AI explanation → **invite the teacher to type one description in 你說我猜** → open one card's 學習紀錄 tab to show everything connected → statistics | Functionality, UI/UX, innovation |
| 5:00–6:15 | AI 整合與限制: AI Diagnostics panel (tokens/s, load time), "code supplies facts" principle, Gemini Nano has no Chinese output so the design changed | AI integration (20%) |
| 6:15–7:00 | 困難與心得 and AI tool disclosure | Presentation |

## 8.4 Prepared answers for Q&A

- "What if the computer has no GPU?" → open AI Diagnostics and switch to the template tier live.
- "Does the AI make things up?" → facts come from cards; examples must contain the word; JSON is validated before display.
- "How is a horror game related to learning?" → time pressure forces active recall; the creature is made of the learner's own wrong words.
- "Why no React?" → the course says frameworks do not earn extra points; no build step means it runs directly and has fewer failure points.
- "Is the chart data real?" → state that it is demo data, then clear it live to show the new-user state.

## 8.5 Demo-day backup plan

- Pre-download every model on the exact demo laptop the day before; test again with Wi-Fi off.
- A recorded video of the full demo flow (about 3 minutes) plus screenshots of every screen, on a USB stick and in Google Drive.
- Load demo data before going on stage.
- Check classroom speaker volume; if sound is not appropriate, use 安心模式 and describe the audio.
- Use a clean Chrome profile (no extensions, no stale cache).

## 8.6 Report / slides PDF (submit before the final demo)

Required by the course: 理念, 系統架構, 功能說明, AI 整合與限制, 困難與心得. Also include: AI tool usage disclosure, data and asset sources with licences, and the GitHub Pages link.
