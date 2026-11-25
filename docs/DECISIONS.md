# Architectural & Specification Decisions (`docs/DECISIONS.md`)

Every choice not fully specified by `docs/spec/part01.md`–`part11.md`, or resolved where the spec and source dataset interacted, is logged here.

---

## M0 — Setup and Data Audit

1. **Loading `data/english-2000-data.js` (`window.ENGLISH_2000_DATA`)**
   - Keep `data/english-2000-data.js` completely unmodified and load it via a classic `<script src="./data/english-2000-data.js"></script>` tag before ES module scripts.
   - `window.ENGLISH_2000_DATA` is an explicit allowed exception to the Section 7.3 no-globals rule (alongside `window.App`).
   - Only `js/store/cards.js` is permitted to read `window.ENGLISH_2000_DATA`.

2. **Normalizing `partOfSpeech` (`card.pos`)**
   - Normalize non-empty `partOfSpeech` values from `english-2000-data.js` to canonical tags (`n.`, `v.`, `adj.`, `adv.`, `prep.`, `conj.`, `pron.`, `det.`, `aux.`, `int.`).
   - Map `"a."` to `"adj."`.
   - Empty strings (`""`, 1,282 rows) or unparseable/noisy OCR strings (such as number-list fragments like `"n.a.；0；Water freezes at zero degrees. 21 nineteen ("`) normalize to `null`.

3. **Merging `duplicate_word` rows**
   - Merge rows sharing the same `word.trim().toLowerCase()` into **one** builtin card (`1,924` unique cards total from `2,029` rows) so each word has exactly one Leitner progress record.
   - Store all contributing raw IDs in `sourceIds: string[]` and use `"b-" + firstRow.id` as `card.id`.
   - When merged rows have different `translation` strings, join distinct meanings with `"；"`.

4. **Handling `suspect_ocr_word` entries**
   - Entries flagged `"suspect_ocr_word"` (specifically `id: "0722"`, `word: "l'"`) remain in the underlying builtin data with `hidden: true` (and an `excludeFromGames` flag) so they are excluded from all games and default study decks.

5. **IPA absence**
   - `data/english-2000-data.js` contains no IPA field. Builtin cards initialize with `ipa: null`, and the IPA row in the flashcard UI is hidden whenever `card.ipa === null`. IPA is never invented by code or AI.

6. **Distractor fallback order (Section 4.2)**
   - When choosing 3 distractors for a card: prefer cards with the same canonical `pos` when `card.pos` is non-null; if unavailable or `pos` is `null`, fall back to cards from the same `unitNo`, then the same `chapterNo`, and finally other active cards in the pool (never duplicating words or meanings).

7. **Flashcard interaction (Section 2.7 vs. 3.3 B)**
   - Tap/click or `Space` flips the flashcard.
   - Horizontal swipe on touch devices rates the card (left = 還不熟, right = 記住了) **only after the card has been flipped** to avoid gesture conflicts.

8. **JS size budget scope (Section 8.1)**
   - The ~300KB JavaScript budget applies to our application modules under `js/` (excluding `data/english-2000-data.js` and external CDN AI models).

9. **Folder structure adjustments (Section 7.2)**
   - Test files are placed flat at `tests/*.test.js` alongside `tests/test.html` and `tests/guess-eval.json` (no nested `tests/tests/` folder).
   - `README.md` sits at the repository root (matching Appendix B and standard GitHub Pages repos) rather than inside `docs/`.
   - Empty directories from Section 7.2 contain `.gitkeep` placeholders during M0 so Git tracks the full structure; each `.gitkeep` will be removed when its directory receives real source files.
