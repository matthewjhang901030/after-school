---PAGEBREAK---

# 6. Learning records, statistics, dashboard

## 6.1 Unified attempt log

Every answer anywhere creates one record:

```
attempt {
  id, ts: number, dayKey: "2026-12-10",
  source: "card" | "class13" | "guess" | "wall",
  sessionId, cardId | null, itemId | null,
  skill: "vocab" | "grammar" | "dialogue",
  correct: boolean, userAnswer, expected,
  errorType: "spelling" | "meaning" | "tense" | "form" | "confusion" | "timeout" | null,
  wrongLetters: string[], ms: number
}
session { id, source, startedAt, endedAt, score, accuracy, details }
```

- All charts, the dashboard, stamps, and AI Feature C are computed from this log. No number is ever invented.
- `dayKey` is computed in local time (never `toISOString()`, which is UTC and puts a 7 a.m. Taipei session on the previous day).
- Keep the latest 5000 attempts; older attempts are compacted into daily summaries `{ dayKey, source, skill, total, correct }` so long-term charts remain and localStorage does not fill up.
- Sessions abandoned mid-game are not saved.

## 6.2 Dashboard (home), bento layout

| Block | Content |
|---|---|
| Large: 「今日課表」 | Today's periods with stamps for completed ones (6.3) |
| Streak | 「連續 5 天」 and 7 small day squares |
| Hardest words this week | Top 3 wrong words, tap to open the card |
| Latest stamp | Most recent stamp, link to 集章冊 |
| Learning loop | Small diagram Learn → Play → Mistake → AI → Review, current step highlighted |
| AI advice | Feature C output with source label |

New users with no data see invitations instead of zeros, e.g. 「完成第一節課後，這裡會出現你的進度」.

## 6.3 今日課表 (today's timetable)

- Number of periods is chosen by the user in Settings: **2, 3, or 4 (default 3)**.
- Priority order when fewer periods are chosen: card review → 第 13 節課 → 今日之牆 → 你說我猜.

| Period | Activity | Word selection |
|---|---|---|
| Card review | Due cards, max 20; if none, new words | Leitner |
| 第 13 節課 | One run | Wrong in last 7 days + box 1; top up with due words to at least 8 |
| 今日之牆 | Today's wall | Seeded by date; marked done if already played today |
| 你說我猜 | 5 cards | From today's reviewed or wrong words |
| 放學 (after school) | AI daily summary | Unlocks after at least 2 periods |

- Regenerated at local midnight; completed periods persist across reloads.
- Every period can be skipped; it is a suggestion, not a lock.

## 6.4 Statistics page

| Chart | Question it answers |
|---|---|
| Leitner box distribution (stacked bar styled as a card stack) | How many words do I know? |
| 14-day accuracy (line) | Am I improving? |
| Study calendar (daily squares, shade by attempts) | Do I study regularly? |
| Accuracy by skill: 單字 / 文法 / 對話 | Which skill is weak? |
| Keyboard heatmap (from 第 13 節課) | Which letters do I mistype? |
| Confusion pairs (from 四格分類牆) | Which words do I mix up? |
| Personal bests (top 5 per game) | Local leaderboard |

- Charts are hand-written SVG (no chart library) so they match the paper-and-ink style and add no dependency.
- Each chart has a one-sentence text summary (e.g. 「本週正確率比上週高 8%」) and a "show as table" toggle.
- Time filter: 7 days / 30 days / all.
- Empty chart state: short message plus a link to the activity that produces the data.

## 6.5 集章冊 (stamp book)

About 12 stamps with conditions computed from real data, for example: 初次翻卡 (first card flipped), 連續 7 天 (7-day streak), 撐過第 3 節 (survive period 3 in 第 13 節課), 四格零失誤 (perfect wall), 一次猜中 (AI guessed on the first clue), 50 張卡進入第 5 盒 (50 cards in box 5). Locked stamps appear as faint outlines with a hint on how to earn them. Earning a stamp fires `stamp:earned` and shows the stamp animation.

## 6.6 Data management (Settings)

- Export all data as JSON; import with schema and version validation before overwriting (show a summary and ask to confirm).
- Reset all data: the user must type 「刪除」 to confirm.
- 「載入示範資料」 loads `data/demo-seed.json` (about two weeks of sample activity). Demo data is flagged (`isDemo: true`), shown with a banner 「目前顯示示範資料」, and removable with one button 「清除示範資料」.

## 6.7 Integration map (proof that nothing is isolated)

| Feature | Reads | Writes |
|---|---|---|
| Flashcards | cards, progress | progress, attempts |
| 第 13 節課 | weak words, due words, tense/broadcast banks, confusion pairs | attempts (with wrongLetters), box 1 drops, session |
| 你說我猜 | deck words, embeddings | attempts, learner sentences, new cards via 「加入卡組」 |
| 四格分類牆 | walls, deck words | attempts, confusion pairs, session |
| AI A/B | attempts of the session, card facts | card.aiTip, card.myExample |
| AI C | aggregated statistics | weekly advice, focus words used by 今日課表 |
| Dashboard / stats / stamps | everything above | stamps |

Each game's end screen links to the next activity (e.g. 第 13 節課 → 「用這些錯字玩你說我猜」), so the loop is visible in the interface, not only in the data.
