# Data Audit (`docs/DATA.md`)

This document records the exact observed schema of `data/english-2000-data.js` and the JSON content banks used by **放學後 After School**.

---

## 1. Course Word List: `data/english-2000-data.js`

- **Format:** Classic browser script assigning `window.ENGLISH_2000_DATA` (1,817,188 bytes).
- **Access rule:** Kept unmodified. Loaded via `<script src="./data/english-2000-data.js"></script>` before module scripts; only `js/store/cards.js` reads `window.ENGLISH_2000_DATA`.

### 1.1 Top-Level Keys

| Key | Type | Size / Value | Description |
|---|---|---|---|
| `source` | `object` | `{ title, csvPath, reviewNotes }` | Provenance metadata (`"English Vocabulary by Chapter 2025 reviewed"`, 4 review notes). |
| `stats` | `object` | See below | Summary counts and QA totals for the dataset. |
| `chapters` | `array` | 30 items | Chapter index (`{ chapterNo, title, count }`). |
| `units` | `array` | 133 items | Unit index (`{ unitNo, chapterNo, chapterTitle, title, count }`). |
| `words` | `array` | 2,029 items | Master vocabulary rows (`id` `"0001"` to `"2029"`). |

#### Observed `stats` values
- `rows`: `2029`
- `uniqueWords`: `1924` (97 case-insensitive headwords appear more than once)
- `chapters`: `30`
- `units`: `133`
- `sourceTranslations`: `767`, `machineTranslations`: `1260`, `manualCorrections`: `2`
- `sourceExamples`: `695`, `generatedExamples`: `1321`, `exampleTranslations`: `2029`
- `qaSummary`: `{ duplicate_word: 202, english_corrected_from_raw_note: 2, suspect_ocr_word: 1 }`

### 1.2 Fields on Each `words[i]` Entry (21 fields)

| Field | Type | Nulls | Empty (`""`) | Notes & Examples |
|---|---|---|---|---|
| `id` | `string` | 0 | 0 | Zero-padded 4-digit string `"0001"`–`"2029"`. |
| `order` | `number` | 0 | 0 | Sequential row order (`1`–`2029`). |
| `chapterNo` | `number` | 0 | 0 | `1`–`30`. |
| `chapterTitle` | `string` | 0 | 0 | e.g. `"People"`, `"Occupations"`. |
| `unitNo` | `number` | 0 | 0 | `1`–`133`. |
| `unitTitle` | `string` | 0 | 0 | e.g. `"Life Stages"`. |
| `wordNo` | `number` | 0 | 0 | Order within the unit. |
| `originalWord` | `string` | 0 | 0 | Original raw word before correction (differs from `word` on `"0291"` `ook→look` and `"0295"` `ip→lip`). |
| `word` | `string` | 0 | 0 | English headword, e.g. `"baby"`. Entry `"0722"` has `"l'"` (`suspect_ocr_word`). |
| `translation` | `string` | 0 | 0 | Traditional Chinese meaning, e.g. `"嬰兒"`. |
| `partOfSpeech` | `string` | 0 | 1,282 | Present on 747 rows; uses abbreviations (`"n.[C]"`, `"a."`, `"v."`, `"n.[U]"`, `"n.[pl.]"`, compound forms like `"a.；n.[C]"`), plus noisy number strings (e.g. `"n.a.；20"`, `"n.a.；0；Water freezes at zero degrees. 21 nineteen ("`, `"n.[[U]"`). |
| `example` | `string` | 0 | 0 | Primary English example sentence. |
| `examples` | `string[]` | 0 | 0 | Array of English example sentences (108 rows have > 1 item). |
| `exampleZh` | `string` | 0 | 0 | Traditional Chinese translation of the primary example. |
| `examplesZh` | `string[]` | 0 | 0 | Translations matching `examples` (108 secondary entries are `""`). |
| `source` | `string` | 0 | 0 | e.g. `"Manual correction from page image"`. |
| `note` | `string` | 0 | 0 | Raw/OCR note. |
| `reviewNote` | `string` | 0 | 2,028 | Non-empty only on `"0722"` (`"疑似 OCR 錯字；2029 主清單保留原值，需回原始頁面確認。"`). |
| `translationSource` | `string` | 0 | 0 | `"source_771"` \| `"machine_translation"` \| `"manual_correction"`. |
| `exampleSource` | `string` | 0 | 0 | `"source_771"` \| `"generated_example"` \| `"curated_example"`. |
| `qaFlags` | `string[]` | 0 | 0 | Contains any of `"duplicate_word"`, `"english_corrected_from_raw_note"`, `"suspect_ocr_word"`. |

**Absent fields:** There is **no `ipa` field** in `data/english-2000-data.js`.

### 1.3 Mapping to Application `card` Model (Section 3.1)

When `js/store/cards.js` imports `window.ENGLISH_2000_DATA.words`:
- Rows with the same `word.trim().toLowerCase()` are **merged into one builtin card** (`1,924` unique cards), with primary `id: "b-" + firstRow.id` and `sourceIds: string[]` storing all contributing row IDs (`"0001"`, ...).
- `word`: `row.word.trim()`
- `ipa`: `null` (never invented; IPA UI row stays hidden unless user edits it)
- `pos`: normalized from `row.partOfSpeech` (`"a."` → `"adj."`, etc.; empty or unparseable → `null`)
- `zh`: unique `translation` values across merged rows joined with `"；"`
- `example` / `exampleZh`: from primary row (`row.example`, `row.exampleZh`)
- `tags`: chapter/unit tags (plus QA tags where relevant)
- `source`: `"builtin"`
- `hidden`: `true` for `suspect_ocr_word` entries (e.g. `id: "0722"`, `"l'"`) so they stay in data without appearing in games; `false` otherwise (plus user override state in `as.v1.cards.overrides`)
- `chapterNo`, `unitNo`: kept for distractor fallback when `pos` is `null`

---

## 2. Planned JSON Content Banks (To Be Populated in Later Milestones)

| File | Milestone | Status | Purpose |
|---|---|---|---|
| `data/walls.json` | M5 / M10 | Not created yet | Handcrafted 4×4 Connections-style walls (drafted & owner-reviewed first). |
| `data/tense.json` | M8 | Not created yet | Verb-form grammar items (drafted & owner-reviewed first). |
| `data/broadcast.json` | M10 | Not created yet | Dialogue cloze items (drafted & owner-reviewed first). |
| `data/class-rules.json` | M10 | Not created yet | Gacha rules for 第 13 節課. |
| `data/demo-seed.json` | M11 | Not created yet | Two weeks of clearly labelled sample learning data. |
| `tests/guess-eval.json` | M7 | Not created yet | 30-item evaluation set for 你說我猜 embedding ranking. |
