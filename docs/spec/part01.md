TITLE: 放學後 After School
SUBTITLE: Integrated English Learning Environment: Product and Build Specification
META: Course: 1151 Web Programming Final Project (Yuan Ze University, Dept. of Computer Science and Engineering)
META: Team: 1 person. Demo 1: Thursday 12/10. Final demo: Thursday 12/17.
META: Spec version 1.0, written 2026-11-26. Tagline: 「放學後，才是真正的英文課。」
META: Intended reader: Antigravity (AI coding agent) and the project owner.

> **How to use this document (for Antigravity).** Read the whole document once before writing code. Build in the exact order of Appendix A and do not start a milestone before the previous milestone meets its Definition of Done. When something is not specified, choose the simplest option that is consistent with Section 2 (Design System) and record the choice in `docs/DECISIONS.md`. Never invent facts (word meanings, IPA, statistics). All UI text lives in the i18n files, never hard-coded.

---PAGEBREAK---

# 0. Executive summary

**After School (放學後)** is a browser-only English learning website for Taiwanese university students. The whole product uses one metaphor: the website is a school after the bell rings. Learners review ring-bound vocabulary cards (單字卡), play three mini-games, and get help from an AI tutor that runs inside the browser.

Everything is connected by one shared **learning record**. Every answer in every feature is written to it, and every feature reads from it. This directly answers the course's core requirement:

> 核心要求：遊戲與 AI 都必須服務「單字 / 對話 / 文法」的學習內容，不能只是彼此獨立的小工具或炫技功能。

| Area | Decision |
|---|---|
| Learning loop | Learn (cards) → Play (games) → Mistake → AI explains → Review again → Statistics |
| Flashcards | Leitner system with 5 boxes, multiple decks, pronunciation, add/edit/hide cards, per-card learning history |
| Games (3) | 第 13 節課 (horror typing game), 你說我猜 (describe a word, AI guesses), 四格分類牆 (Connections-style grouping). **Each game covers vocabulary + dialogue + grammar.** |
| AI | 3-tier fallback: Chrome built-in Gemini Nano → Qwen 2.5 0.5B via Transformers.js → offline templates. Plus a small sentence-embedding model for 你說我猜. Rule: code supplies facts, AI only phrases them. |
| AI features | A: explain mistakes. B: correct sentences. C: weekly study advice. D: auto-fill new card. E: generate new walls (validated). |
| Records | Unified attempt log, dashboard with 今日課表 (daily timetable, 2/3/4 periods), statistics page, stamp book (集章冊), demo seed data |
| Design | "Taiwanese student stationery": paper, red grading pen, highlighter, commemorative stamps. Light "afternoon" mood and dark "night" mood. |
| Tech | Plain HTML/CSS/JavaScript with ES modules, no build step, hash router, localStorage + IndexedDB, service worker for offline, deployed on GitHub Pages |
| UI languages | Traditional Chinese (default) and English, switchable |

---PAGEBREAK---

# 1. Concept and scope

## 1.1 Product concept

The learner stays "after school". During the afternoon (default light theme) they study cards and play calm games. At night, the 第 13 節課 game turns the same stationery world dark and tense. School vocabulary is used everywhere in the UI: 今日課表 (today's timetable), 節 (period), 補考名單 (make-up exam list), 操行分數 (conduct score), 集章冊 (stamp book). This one metaphor makes the many features feel like one place instead of separate tools.

## 1.2 The learning loop

1. **Learn**: review due cards in the Leitner system.
2. **Play**: games draw words from the learner's own decks, prioritising weak words.
3. **Mistake**: every wrong answer is logged and the word drops back to Leitner box 1.
4. **AI explains**: at the end of each game, the AI explains the mistakes using facts from the cards.
5. **Review again**: the explanation is saved on the card; weak words are scheduled sooner and reused by the next game.
6. **Statistics**: dashboard and stats page show progress; AI writes weekly advice from real numbers.

The dashboard shows this loop as a small diagram and highlights the step the learner is on.

## 1.3 Mapping to course requirements

| Course requirement | Where it is met |
|---|---|
| 單字卡系統: add, browse, flip; word, pronunciation, Chinese meaning | Section 3 |
| 英文小遊戲: at least 2 types, each tied to 單字 / 對話 / 文法 | Section 4: 3 games, each covering all three skills |
| 瀏覽器端 AI: at least 1 feature | Section 5: 5 features plus embedding-based game AI |
| 學習紀錄: results, progress, statistics | Section 6 |
| 介面與品質: clean, RWD, error handling | Sections 2, 7, 8 |
| Bonus: 3+ games / one game with 2+ topics | All 3 games mix 3 topics |
| Bonus: AI roleplay or sentence correction | Feature B (sentence correction), 你說我猜 dialogue framing |
| Bonus: AI review questions, personalised advice | Weak-word reuse, Feature C, Feature E |
| Bonus: offline (model cache), leaderboard, multi-language UI | Service worker + model cache; personal top 5 per game; zh-TW / en |
| Bonus: data visualisation | Statistics page (Section 6.4) |
| Course rule: disclose AI tool usage | `docs/AI_USAGE.md` |
| Course rule: asset licences | `docs/CREDITS.md` |

## 1.4 Target users

Taiwanese university students learning basic English vocabulary (the course's 2000-word list). They use both laptops and phones. Chinese meanings are shown in Traditional Chinese.

## 1.5 Scope tiers and schedule

Build tier by tier. A later tier starts only when the earlier tier works without known bugs, so a complete product exists at every point.

| Tier | Deadline | Content |
|---|---|---|
| T1 Core | before 12/06 | Design system, app shell, flashcards complete, 四格分類牆 complete, learning record, mobile layout |
| T2 Demo 1 | 12/10 | 你說我猜 working with embedding AI, AI Feature A (explain mistakes), 第 13 節課 core loop (typing, distance, win/lose), dashboard with 今日課表 |
| T3 Bonus | before 12/15 | 第 13 節課 full (atmosphere, supplies, key rot, broadcast dialogue, gacha), AI Features B, C, D, statistics page, stamp book, offline |
| T4 Polish | 12/16 to 12/17 | AI Feature E, full QA pass, report PDF, slides, backup demo video |

Demo 1 requirements from the course page: website runs, flashcards work, at least one playable game, an AI prototype that shows results, and an explanation of next steps. T1 + T2 covers all of them.

## 1.6 Non-goals

- No user accounts, no backend server, no cloud AI API (the course requires browser-side AI unless permission is given).
- No multiplayer and no online leaderboard. Leaderboards are personal and local.
- No copying of names, art, or characters from other games (《返校》 Detention, KEYKRUNCHER™, NYT Connections). They are cited only as inspiration.
