---PAGEBREAK---

# 5. Browser-side AI

## 5.1 Core principle: code supplies facts, AI only phrases them

Small models hallucinate. Every fact (meaning from the card, the correct answer, the verb form, the mistyped letters, statistics) is computed by code and passed in. The AI only explains in friendly language and adds a memory tip. Code then checks the output. This principle is also the main talking point for 「能說明限制」 in the AI rubric (20%).

## 5.2 Three-tier engine with automatic detection

| Tier | Engine | Used when | Notes |
|---|---|---|---|
| 1 | **Chrome Prompt API (Gemini Nano)** | Desktop Chrome where `LanguageModel.availability()` is not "unavailable" | No download by us. Per Chrome docs (Oct 2026) needs Chrome 148+, 22 GB free disk, 16 GB RAM with 4+ cores or GPU with more than 4 GB VRAM, and is not available on Android or iOS. **Supported languages are en, ja, es, de, fr only.** So: ask for simple English output, then translate to zh-Hant with the Chrome **Translator API** when available; otherwise show English. |
| 2 | **Qwen 2.5 0.5B Instruct via Transformers.js** (about 390MB per the course page) | Tier 1 unavailable, or user selects it | Writes Chinese well. WebGPU when available, WASM fallback (slower). Same library as the embedding model, so only one AI library in the project. |
| 3 | **Offline templates** | No model available, mobile without WebGPU, or any AI error | Facts inserted into Chinese sentence templates, e.g. 「eat 的過去式是不規則變化：eat → ate。」 Always useful, never empty. |

- Detection runs once at startup (non-blocking) and is cached; the result shows in the AI Diagnostics panel (5.7).
- Settings → AI engine: 自動 (default) / Gemini Nano / Qwen / 離線範本.
- Models download only after explicit consent in Settings or on first use of an AI feature, with size shown and a progress bar.

## 5.3 AI features

| ID | Feature | Location | Tier | Input (from code) | Output (JSON) |
|---|---|---|---|---|---|
| A | 錯題解說 explain mistakes | End screen of every game (補考名單) | T2 | word, zh, pos, expected, userAnswer, errorType, wrongLetters, game | `{ why, tip, example }` |
| B | 改句子 sentence correction | End of 你說我猜 | T3 | the learner's sentences | `{ corrected, errors: [{ original, fix, reasonZh }] }` |
| C | 學習建議 weekly advice | Dashboard, once per week or on demand | T3 | stats computed by code: accuracy per skill, top wrong words, top mistyped letters, confusion pairs, study days | `{ tips: [3 strings], focusWords: [strings] }` |
| D | 幫我填 auto-fill card | Add-card form | T3 | word | `{ zh, pos, example, exampleZh }` (suggestion only) |
| E | AI 出牆 generate a wall | 四格分類牆 practice mode | T4 | 30 to 60 words from the learner's decks | wall JSON (schema 4.5.3), must pass validator |

Saving: the `tip` from Feature A is saved to `card.aiTip`; the corrected sentence from Feature B is saved to `card.myExample` (only if the learner taps 「存到卡片」).

## 5.4 Prompt rules

- System prompt in English (small models follow English instructions better). Output language: zh-Hant for Qwen; simple English for Gemini Nano (then translated).
- Pass facts in a clearly delimited FACTS block; instruct the model to use only those facts.
- Structured output: Gemini Nano uses `responseConstraint` with a JSON schema. For Qwen, parse JSON, retry once on failure, then fall back to the template.
- Do not set `maxLength` in schemas (Chrome docs warn that hard length limits make output nonsensical). Truncate on the client instead.
- Use the most predictable sampling for A, B, C, D; slightly creative for E.
- Initial prompts go into `create()`; clone a base session for repeated tasks instead of calling `create()` again.

Example system prompt for Feature A:

```
You are a patient English tutor for Taiwanese university students.
Use ONLY the information in FACTS. Do not add new meanings or new rules.
Explain why the answer is wrong in 1-2 short sentences.
Give one memory tip. Give one short example sentence that contains the WORD exactly.
Write in Traditional Chinese (zh-Hant). Keep English words in English.
Return only JSON matching the schema.
```

Example FACTS block:

```
FACTS
word: receive
meaning_zh: 收到
pos: v.
expected: receive
user_answer: recieve
error_type: spelling
wrong_letters: "ie" typed instead of "ei" after c
game: class13
```

## 5.5 Output validation (code checks every response)

- JSON parses and matches the schema.
- Feature A/D: the example sentence contains the exact target word (or an accepted inflection); otherwise drop the example.
- Feature D: if the suggested Chinese meaning differs from an existing builtin meaning, show the builtin meaning instead.
- Feature B: if `corrected` equals the original (ignoring spaces/case), show 「沒有發現錯誤」.
- Feature E: run the wall validator; discard on failure.
- Never render model output with `innerHTML`; use `textContent` (Chrome docs mark model output as untrusted).

## 5.6 UX, performance, safety

- Stream text (`promptStreaming()` / Transformers.js streamer) with a 「停止」 button wired to `AbortController`.
- Warm up: when a game reaches its last round, prepare the AI session in the background so 「請 AI 解釋」 responds quickly.
- One model in memory at a time; call `destroy()` on sessions that are no longer needed.
- Cache models for offline use (Cache Storage via Transformers.js) and call `navigator.storage.persist()`.
- Every AI output shows a source label and the disclaimer 「AI 可能出錯，請以卡片內容為準」.
- If an AI call takes longer than 20 seconds, cancel and show the template answer with a note.

## 5.7 AI Diagnostics panel (Settings → AI)

Shows: active tier, WebGPU yes/no, Prompt API availability, Translator API availability, model download sizes, load time, tokens per second from a test prompt, embedding cache status, button 「測試一下」 and 「刪除模型」. During the final demo this panel explains cost and limits with real numbers.
