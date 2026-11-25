---PAGEBREAK---

# 3. Flashcard system

## 3.1 Data model

```
card {
  id: string            // "b-0001" builtin, "u-<timestamp>" user
  word: string          // "library"
  ipa: string | null    // "/ˈlaɪbreri/" or null if unknown
  pos: string | null    // "n." "v." "adj." "adv." ...
  zh: string            // "圖書館"
  example: string | null
  exampleZh: string | null
  tags: string[]
  source: "builtin" | "user"
  hidden: boolean       // builtin cards can be hidden, not deleted
  aiTip: string | null  // memory tip saved from AI Feature A
  myExample: string | null // sentence the learner wrote in 你說我猜, corrected by AI
  createdAt: number
}
progress {
  cardId, box: 1..5, due: dayKey, seen, correct, wrong, lastSeen: number,
  lastWrongIn: "card" | "class13" | "guess" | "wall" | null
}
deck { id, name, ringColor, cardIds: string[], createdAt, order }
```

- Builtin cards come from the course file `english-2000-data.js`. **First task: open this file and document its actual fields in `docs/DATA.md`.** Map fields to the model above. If IPA or example sentences are missing, store `null` and hide those rows in the UI. Never let the AI invent IPA.
- Builtin and user cards are stored separately so a data update never deletes user cards.
- Leitner progress belongs to the card, not the deck. The same word in two decks shares one progress record.

## 3.2 Leitner schedule

| Box | Review after | Meaning |
|---|---|---|
| 1 | every day | New or just failed |
| 2 | 2 days | Starting to remember |
| 3 | 4 days | Fairly known |
| 4 | 7 days | Well known |
| 5 | 14 days | Mastered |

- Self-rating in review: 「還不熟」 → box 1; 「有點印象」 → same box, due tomorrow; 「記住了」 → box + 1 (max 5).
- **Any wrong answer in any game sends the card to box 1, due today.** A correct answer in a game counts as `correct` but does not move the box (only deliberate review promotes).
- New words per day: default 10, configurable 5–30 in Settings.
- Due date uses `dayKey` (local date string, see 7.3). A card is due if `due <= todayKey`.

## 3.3 Modes

**A. Browse (瀏覽)**
- Search by English or Chinese, 200ms debounce.
- Filters: deck, Leitner box, tag, "my cards", "hidden".
- Sort: A–Z, newest, most mistakes.
- Virtualise or paginate (50 per page) so 2000 cards do not slow the page.

**B. Today's review (今日複習)**
1. Show front (word + IPA + speaker). Auto-play pronunciation is a setting.
2. Flip: tap card or Space.
3. Rate with 3 buttons (keys 1/2/3; on mobile also swipe left = 還不熟, right = 記住了).
4. Session max 20 cards. End screen: stamp, counts per outcome, button 「把不熟的字拿去玩遊戲」 that opens 第 13 節課 with those words.

## 3.4 Add, edit, hide, delete

- Form fields: word (required), Chinese meaning (required), part of speech (select), IPA, example, example translation, tags, decks.
- Validation while typing: required fields not empty; word allows letters, spaces, apostrophe, hyphen; max 40 characters.
- Duplicate detection (case-insensitive, trimmed): show 「這個字已在卡片中」 with a link to the existing card.
- Button 「幫我填」 (AI Feature D): fills meaning, part of speech, and example as suggestions. The user must confirm; AI never saves on its own.
- Delete user card: immediate, with toast 「已刪除 · 復原」 for 5 seconds (soft delete, purge after toast closes).
- Builtin cards can be edited and hidden, never deleted.

## 3.5 Decks (卡組)

- Default deck 「基礎 2000 字」 (all builtin cards).
- Create, rename, reorder (drag), delete. Each deck picks a ring color from the 5 muted tokens.
- Deleting a deck never deletes its cards; undo toast for 5 seconds.
- A card may belong to several decks.
- Game word sources: a chosen deck, today's due cards, or 「我常錯的字」 (most mistakes in the last 14 days).
- Decks with fewer than 4 cards disable games that need 4 options and show 「至少需要 4 張卡片」.

## 3.6 Pronunciation

- `speechSynthesis` with an `en-US` voice, rate 0.9. Slow button (turtle icon) uses rate 0.6.
- Voices load asynchronously: wait for `voiceschanged` (with a 1.5s timeout) before the first utterance.
- No English voice available: speaker button disabled with tooltip 「此裝置沒有英文語音」. Never throw an error.
- Repeated taps: call `speechSynthesis.cancel()` before speaking again.
- Optional later: Kokoro TTS (course page lists Kokoro-82M, about 90MB) as a higher quality voice.

## 3.7 Card learning history (tab 「學習紀錄」)

A timeline on the back of each card: first learned date, every attempt (source game, correct/wrong, user answer), AI explanations given, the learner's own corrected sentence. This is the screen that proves features are connected during the demo.

## 3.8 Edge cases

| Situation | Behaviour |
|---|---|
| First visit | Load builtin data, 3-step onboarding: pick daily new words, flip one card, done |
| No due cards | 「今天的卡片都複習完了」 with two actions: learn new words / play a game |
| Very long word | Headword auto-shrinks (measure and scale, minimum 28px) |
| localStorage blocked (private mode) | Banner: data kept only for this session. App still works from memory. |
| Old data version | Run migrations in order (see 7.4). Never wipe progress. |
| Rapid flip clicks | Ignore input while the 400ms flip animation runs |
