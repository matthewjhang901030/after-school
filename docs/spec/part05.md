## 4.4 Game 2: 你說我猜 (You describe, AI guesses)

**Inspiration**: Taboo (describe a word without forbidden words) and semantic word games such as Contexto and Semantle (meaning-based similarity). The learner must **produce** English, which is harder and better for memory than recognising it.

### 4.4.1 Flow (one session = 5 cards)

1. Draw a card, e.g. **library**, shown with 「圖書館」 and **3 taboo words**, e.g. book · read · borrow.
2. The learner types a description in English, 4 to 30 words.
3. The AI answers in a dialogue bubble: "Is it a **library**? (62%) Maybe a bookstore (21%) or a school (9%)." with confidence bars.
4. Scoring: target ranked #1 on the 1st clue = 300; 2nd clue = 200; 3rd clue = 100. Target in top 3 but not #1 = half. Up to 3 clues per card; each new clue is appended to the previous description.
5. After the session: vocabulary review (taboo words and wrong AI guesses with their meanings, 「加入卡組」 buttons), then 「AI 幫我改句子」 (Feature B) for grammar.

### 4.4.2 Code checks before the AI sees the text

- The description contains the target or a variant (plural, -ing, -ed, -er, -s): reject, strike the word in red, show 「不能直接說出答案」.
- Contains a taboo word or its variant: reject and highlight it.
- Non-English characters: 「請用英文描述」.
- Fewer than 4 words: 「再多寫一點」.

### 4.4.3 How the AI guesses (embedding, not chat)

- Use a small **sentence-embedding model** through Transformers.js (for example `all-MiniLM-L6-v2`; verify size and quality on day 1). It runs on CPU via WASM, so it works without WebGPU.
- Candidate set: all 2000 builtin words plus the learner's own cards. Candidate text = word plus its example sentence when available (test both "word only" and "word + example"; keep whichever ranks targets higher on a 30-item test set in `tests/guess-eval.json`).
- On first use, compute candidate embeddings once and store them in **IndexedDB** (several MB; too large for localStorage). Later sessions load instantly. Recompute only for new user cards.
- Guess = cosine similarity between the description embedding and every candidate; show top 3, convert scores to percentages with softmax for display.
- Taboo words are chosen automatically: the 3 nearest neighbours of the target among candidates, excluding variants of the target.
- Target selection prefers concrete nouns, verbs, and adjectives; skip function words and very abstract words.

### 4.4.4 Edge cases

- Model loading: progress bar with MB downloaded. Failure: retry button; the game shows 「此遊戲需要 AI 模型」 and the rest of the site keeps working.
- Description identical to a previous clue: 「換個說法試試」.
- Every attempt is logged (correct = target ranked #1).

## 4.5 Game 3: 四格分類牆 (Four-group wall)

**Inspiration**: NYT Connections and the BBC quiz Only Connect (sort 16 items into 4 groups of 4 with red herrings).

### 4.5.1 Rules

- 16 sticky notes on a wall (4×4). Select 4, press 「送出」.
- Correct: the 4 notes slide into a solved row with the group label (e.g. 「不規則過去式」) and a one-line rule in Chinese.
- Mistakes allowed: 4. Exactly 3 of 4 correct shows 「差一個」.
- Buttons: shuffle, deselect all. Selection is capped at 4.
- Difficulty colors per group: mustard (easiest), sage, terracotta, ink (hardest).

### 4.5.2 Group types

| Skill | Group type | Example |
|---|---|---|
| 單字 | Topic | weather: rain, cloud, storm, wind |
| 單字 | Word family / prefix / suffix | un-: unhappy, unable, unfair, unknown |
| 文法 | Grammar form | irregular past: went, ate, saw, took |
| 文法 | Part of speech | adverbs: quickly, often, very, never |
| 對話 | Responses to the same line | replies to "Thank you": You're welcome, No problem, My pleasure, Anytime |
| 對話 | Function of a phrase | asking for help: Could you…, Would you mind…, Can you…, Do you mind… |
| 單字 | Collocation | make ___: a decision, a mistake, friends, money |

**Every wall must contain at least one vocabulary group, one grammar group, and one dialogue group**, plus at least one red-herring item that seems to fit two groups. Tiles may be short phrases (max 3 words) and auto-shrink on mobile.

### 4.5.3 Content and validation

- `data/walls.json`: 30 handcrafted walls. Antigravity drafts them; **the project owner reviews every wall** (wrong English in an English-learning app is a serious demo risk).
- Wall schema: `{ id, groups: [{ label, labelZh, ruleZh, skill, level: 1..4, items: [4 strings] }] }`.
- Validator (`js/games/wall/validate.js`, also used for AI walls): exactly 4 groups of 4; 16 unique items (case-insensitive); each group has a skill; the three skills all appear; single-word items exist in the word list or are whitelisted phrases.
- Modes: 「今日之牆」 (one wall per day, chosen with a seeded RNG from the local date, same for everyone that day) and practice mode (any unsolved wall).
- AI-generated walls (Feature E) must pass the validator; failed walls are discarded and never shown.

### 4.5.4 After the game

- Each group shows its rule; tapping an item opens its card or offers 「加入卡組」.
- A wrong submission does **not** send words to box 1 (the mistake is usually about the rule, not the word). Instead, the app logs **confusion pairs** (items submitted together across different true groups). Confusion pairs feed 第 13 節課 word selection and AI Feature C.
- Optional (T4): shareable result image (coloured squares) via canvas export.

## 4.6 Content banks

| File | Content | Minimum size | Notes |
|---|---|---|---|
| `data/english-2000-data.js` | Course word list | as provided | Document fields in `docs/DATA.md`; cite source in report |
| `data/tense.json` | Verb form items: base, target form, accepted answers, rule note in Chinese | 80 items | Irregular past, past participle, third person -s, -ing |
| `data/broadcast.json` | Dialogue cloze: A line, B line with one blank, accepted answers, grammar tag | 40 items | Words limited to the 2000 list where possible |
| `data/walls.json` | Walls | 30 walls | Validated by script |
| `data/class-rules.json` | Gacha rules for 第 13 節課 | 8 rules | T3 |
| `data/demo-seed.json` | Two weeks of sample learning data | 1 file | Clearly labelled as demo |

All handwritten English content must be reviewed by the project owner before Demo 1 (for content used in T1/T2) and before the final demo.
