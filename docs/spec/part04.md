---PAGEBREAK---

# 4. Games

## 4.1 Principle

The course requires each game to be tied to 單字 / 對話 / 文法 (at least one). This project goes further: **every game contains all three**, which earns the bonus 「同一遊戲結合 2 種以上主題」 and keeps games from feeling like isolated tools. The three games also differ in mood: one tense, one creative, one calm.

| Game | 單字 (vocabulary) | 對話 (dialogue) | 文法 (grammar) | Mood |
|---|---|---|---|---|
| 第 13 節課 | Chinese → English typing, audio-only rounds | Broadcast dialogue cloze | Verb-form rounds | Horror, pressure |
| 你說我猜 | Target word, taboo words, related words | Learner describes, AI replies with guesses | AI corrects the learner's sentences | Creative |
| 四格分類牆 | Topic and word-family groups | "Responses in conversation" groups | Grammar-form groups | Calm puzzle |

## 4.2 Shared game engine (`js/games/engine.js`)

All games plug into one engine so they look and behave the same.

**Lifecycle**: start screen (one-line rules, word source picker, personal best, skill tabs) → 3-2-1 countdown → rounds → end screen (stamp, score, 補考名單 mistake list) → actions 「請 AI 解釋錯題」 and 「再玩一次」 and a "next step" button that links to another game.

**Scoring (shared)**:
- Correct: 100 points + speed bonus up to 50 (linear from 0s to the round's time limit).
- Combo: from the 3rd consecutive correct answer, multiply by 1.5. Show 「連對 ×3」 drawn in pen style.
- Wrong: 0 points, combo resets, card goes to Leitner box 1, attempt logged.
- Personal top 5 per game stored locally (score, date, details).

**Mandatory engine rules**:
- Pause automatically on `visibilitychange` (tab hidden); show a pause overlay; timers stop.
- Use `performance.now()` deltas inside `requestAnimationFrame` for all timing. Never count time with `setInterval`.
- Lock input immediately after an answer is submitted until the next round renders.
- Distractors: same part of speech, different meaning, no duplicates in one question.
- Leaving mid-game asks for confirmation and does not save the partial session to statistics.
- `unmount()` cancels every timer, animation frame, audio node, and AI request.

## 4.3 Game 1: 第 13 節課 (The 13th Period)

**Inspiration**: tower-defense typing games (type a word before the falling object lands; supply crates that slow or freeze time) and KEYKRUNCHER™ (a visible approaching threat, cheerful-corporate tone that contrasts with dread, gumball machine, scrambled keyboard, dim CRT room). Use the ideas only; no names, art, or characters from those games or from 《返校》.

**Setting**: the learner is held in a cram school (補習班) at midnight. A cheerful loudspeaker announces: 「恭喜你入選夜間加強班。請繼續學習。」 At the end of the corridor, behind the door window, "something" stands. It moves closer when the learner is wrong or slow.

### 4.3.1 Core rules

| Item | Value |
|---|---|
| Period length | 90 seconds. Reach the period's 操行分數 target to advance. Target = 600 + 200 × (period − 1). |
| Distance | Starts at 12m. Correct answer: +1.5m (max 12m). Wrong keystroke: −0.3m. Missed question: −2m. |
| Creature speed | 0.20 m/s in period 1, +0.05 m/s per period |
| Question timeout | 8 seconds without completing the word → counted as missed, next question appears |
| Lose | Distance reaches 0m |
| Win | Survive period 5 (then endless mode with increasing speed) |

### 4.3.2 Question types (mixed, all from the learner's words)

| Type | Example | Skill | Starts in |
|---|---|---|---|
| Meaning → word | Projector shows 「圖書館」 → type `library` | 單字 | Period 1 |
| Verb form | 「eat → 過去式」 → type `ate` | 文法 | Period 1 |
| Broadcast dialogue cloze | Loudspeaker reads "A: Where were you last night? B: I [beep] at home." Subtitle shown faintly. → type `was` | 對話 + 文法 | Period 2 |
| Audio only | Only the pronunciation plays → type the word | 單字 (listening) | Period 3 |

Word source priority: words wrong in the last 7 days → box 1 words → due words → random deck words. Grammar items come from `data/tense.json`; dialogue items from `data/broadcast.json` (see 4.6).

### 4.3.3 Typing and "key rot"

- Per-letter validation: each keystroke is checked against all accepted answers that match the current prefix (supports "did not" and "didn't", multi-word answers with spaces). Case-insensitive.
- **Key rot (腐蝕鍵)**: a wrong keystroke stains that key with red ink and locks it for 3 seconds. On a physical keyboard the letter is ignored while locked; the on-screen keyboard shows the stain. **At most 3 keys can be rotten at once** (the oldest heals first) so the game can never become impossible. All keys heal at the end of a period.
- The game records which letters were typed wrongly and in which word (e.g. `ie`/`ei` in "receive") for the statistics keyboard heatmap and for AI Feature A.
- Mobile: always use the in-game keyboard (the system keyboard would cover half the screen). From period 3 the in-game keyboard is **scrambled** each period.

### 4.3.4 Supply crates (from hard words)

Every 6th question is a **hard word** (long word or box-1 word) framed in red. Typing it correctly gives a supply item. Hold at most 2; use with keys 1 / 2 or by tapping the item.

| Item | Effect |
|---|---|
| 下課鐘 (bell) | Freeze the creature for 5 seconds |
| 慢速時鐘 (slow clock) | Creature speed −50% for 8 seconds |
| 立可白 (correction fluid) | Push the creature back 3m |
| 手電筒 (flashlight) | Reveal 2 letters of the current word |

### 4.3.5 扭蛋機 class-rule gacha (T3)

Between periods the learner pulls one random "class rule" card, e.g. 「只聽不看」 (audio-only period), 「雙倍操行，雙倍速度」, 「多一個補給欄位」. Rules are data-driven in `data/class-rules.json`.

### 4.3.6 Atmosphere (cheap but effective)

- Footsteps via Web Audio API; volume and low-pass filter follow distance. Heartbeat below 3m.
- Loudspeaker voice: `speechSynthesis` with pitch about 0.3 and rate 0.8 ("Please... continue... learning.").
- The creature is a simple SVG silhouette that scales with distance. **Its body is written over with the learner's own wrong words in red ink.**
- Subtle fluorescent flicker (under 3 flashes per second), vignette, slight screen shake on a wrong keystroke.
- Lose: lights cut out for 600ms, then a red 「不及格」 stamp slams onto the screen. No gore, no jump-scare image.
- All sounds are CC0 and listed in `docs/CREDITS.md`.

### 4.3.7 Safety and settings

- Content warning screen before the first play, with a checkbox to not show again.
- 「安心模式」 switch: no footsteps, no heartbeat, no blackout, no shake. The learning content stays the same.
- `prefers-reduced-motion` disables flicker and shake automatically.
- Audio starts only after the learner clicks 「進教室」 (browser autoplay policy).

### 4.3.8 End screen

Periods survived, score, accuracy, 補考名單 (every missed item with the expected answer), most-mistyped letters, buttons: 「請 AI 解釋」, 「用這些錯字玩你說我猜」, 「再玩一次」.
