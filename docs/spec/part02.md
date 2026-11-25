---PAGEBREAK---

# 2. Design system

## 2.1 Visual concept

The source object is the **ring-bound vocabulary card stack (單字卡)** that every Taiwanese student has carried, together with a **teacher's red grading pen**, a **highlighter**, and the **commemorative stamps (紀念章)** found at Taiwanese train stations. Everything visual comes from these objects. This keeps the site away from the generic "AI-generated" look (purple/indigo gradients, cards everywhere, default fonts, emoji, confetti).

Two moods share the same materials:
- **Afternoon (light, default)**: warm paper, ink, highlighter.
- **Night (dark theme and 第 13 節課)**: the same paper turns grey, red ink starts to bleed.

All values below are defined once as CSS custom properties in `css/tokens.css`. Pages and components use only the variables, never raw values.

## 2.2 Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F6F1E7 (ivory paper) | #1B1916 | Page background |
| `--surface` | #FFFDF8 | #25221E | Cards, dialogs |
| `--ink` | #1F1A17 | #EDE6D9 | Main text and **primary buttons (ink black)** |
| `--muted` | #6B625A | #A39A8E | Secondary text |
| `--line` | #E4DCCD | #3A352F | Borders, ruled lines |
| `--highlight` | #F5D547 | #F5D547 | The only accent. Background highlight only (selected item, current word, focus ring). Never used as text color. |
| `--correct` | #2F7A4B | #6CC08A | Correct answer (green ink) |
| `--wrong` | #C2412D | #F07A64 | Wrong answer (red grading pen) |
| `--tab-vocab` | #C9A227 (mustard) | same | 單字 label |
| `--tab-grammar` | #7C9A7E (sage) | same | 文法 label |
| `--tab-dialogue` | #C46A4A (terracotta) | same | 對話 label |

Rules:
- Only warm greys. Do not mix cool greys (Tailwind slate/gray) into the palette.
- One accent only (highlighter). If two things compete for attention, one becomes neutral.
- Skill colors appear only as small "index tab" labels, never as large fills.
- Text contrast at least 4.5:1 against its background. Check every pair in both themes.
- Correct and wrong are never shown by color alone: always with a shape (circle ○ for correct, cross ✗ for wrong).
- No gradients anywhere.

## 2.3 Typography

| Use | Font | Reason |
|---|---|---|
| English headword on cards, page titles | **Fraunces** (serif) | Dictionary feel |
| Body text, buttons, UI | **Manrope** | Clean, not a default font |
| Chinese meaning on cards | **LXGW WenKai TC (霞鶩文楷 TC)** | Handwritten-card feel, OFL licence, popular in Taiwan |
| Chinese UI text | **Noto Sans TC** | Readable at small sizes |
| Timers, scores, statistics | **JetBrains Mono** | Tabular digits, numbers do not jump |
| IPA | **Noto Sans** | Full IPA coverage |
| Fallback stack | system-ui, "Microsoft JhengHei", "PingFang TC", sans-serif | Works offline |

| Level | Size mobile → desktop | Use |
|---|---|---|
| Display | 40 → 56px, weight 700 | Headword on card (auto-shrinks for long words) |
| H1 | 24 → 32px, 700 | Page title |
| H2 | 20 → 24px, 700 | Section title |
| Body | 16px, 400 | Content. **Never below 16px for inputs on mobile** (iOS zooms otherwise). |
| Small | 14px | Captions, labels |

Rules: sentence case everywhere (no Title Case), no italics, no weights above 700. `h1, h2, h3 { text-wrap: balance; }` and `p { text-wrap: pretty; }`. Chinese line-height 1.7. Load Google Fonts with `display=swap`. Every font size comes from the scale above; no arbitrary sizes.

## 2.4 Spacing, radius, shadow, breakpoints

- Spacing scale (multiples of 4): 4, 8, 12, 16, 24, 32, 48, 64px.
- Radius: 8px (inputs, chips), 12px (buttons), 20px (cards), 999px (pills). **Concentric rule**: inner radius = outer radius minus padding (card 20px with 8px padding → inner button 12px).
- Shadows: 3 levels, all from one light source above. Only elements that truly float get a shadow (flashcard, modal, toast). In dark mode replace shadows with a 1px lighter border.
- Breakpoints: < 640px phone (bottom tab bar, 1 column); 640–1023px tablet (bottom bar, 2 columns); ≥ 1024px desktop (fixed left sidebar, content max-width 1200px, centered container but left-aligned content).
- During a game, navigation is hidden. Only an ✕ exit button (with confirmation) and the game HUD remain.

## 2.5 Materials (the signature details)

- **Flashcard**: faint horizontal ruled lines, a punched ring hole top-left, very light paper grain (SVG `feTurbulence` as data URI, opacity about 0.04). Only the flashcard has texture; everything else is flat.
- **Grading marks**: a correct answer gets a hand-drawn **circle ○ that draws itself** around it (SVG stroke-dashoffset animation, 350ms). A wrong answer gets a **red ✗ strike**, and the correct answer is highlighted with the highlighter color.
- **Stamps instead of confetti**: finishing a session presses a round ink stamp onto the screen (scale 1.3 → 1, rotate −8°, slight ink-bleed edge). Stamps are collected in the 集章冊 page. No confetti, no mascot.
- **Index tabs**: skill labels look like small coloured tabs sticking out of a card's edge.

## 2.6 Layout patterns

- **Dashboard**: bento grid, left-aligned. One large block (今日課表) takes about 2/3 width; smaller unequal blocks beside it. Avoid three equal cards in a row.
- **Game hub**: a vertical list styled like a notebook's table of contents (index tab, game name, the three skill tabs, personal best). Not a card grid.
- Separate groups with spacing or thin rules. Do not wrap every element in a bordered card.
- Icons: **Phosphor Icons**, one weight only. No emoji in the main UI.

## 2.7 Component inventory

Every interactive component implements all states: default, hover, active (pressed), focus-visible, disabled, loading.

| Component | Notes |
|---|---|
| Button | Primary (ink), secondary (outline), ghost, danger. Min height 48px. Loading state shows a small spinner and keeps the width. |
| Flashcard | 3D flip on tap, Space key, or swipe. Front: word, IPA, speaker button, skill tabs. Back: Chinese meaning (WenKai), part of speech, example sentence, AI memory tip if saved, tab 「學習紀錄」. |
| Answer tile | Used in result lists and the wall game. Selected state uses highlighter background. |
| Text input | Inline validation message below the field, never only a red border. |
| Toast | Bottom on mobile, bottom-right on desktop, auto-dismiss 3s, max 3 stacked, optional action button (e.g. 「復原」). |
| Modal | Close with Esc, backdrop click, or ✕. Focus trapped inside, focus returns to the trigger on close. |
| Progress bar, chip, switch, tabs, skeleton loader | Standard; skeleton matches final layout size so nothing shifts. |
| AI panel | Streaming text, 「停止」 button, source label (Gemini Nano / Qwen / 離線範本), disclaimer 「AI 可能出錯，請以卡片內容為準」. |
| In-game keyboard | Used by 第 13 節課 on mobile and as visual feedback on desktop. Supports locked ("rotten") keys and scrambled layouts. |

## 2.8 Motion

- Durations: fast 150ms (hover), medium 250ms (page change, toast), slow 400ms (card flip).
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Use `IntersectionObserver`, never scroll listeners, for any reveal.
- With `prefers-reduced-motion: reduce`, remove all transforms and animations; keep only color changes.

## 2.9 UI copy rules

- Buttons name the outcome: 「開始 10 題練習」, not 「開始」 or "Submit".
- Errors say what happened and what happens next: 「模型下載中斷，已改用離線題庫」, not "Oops! 出錯了!".
- No exclamation marks, no hype words, no invented round numbers, no fake testimonials or ratings. Every number shown comes from real user data (or clearly labelled demo data).
- Empty states invite the next action: 「還沒有卡片，新增第一張」.

## 2.10 UI anti-bug rules (mandatory)

1. Every screen has 4 states: loading, empty, error (with 「重試」), and content.
2. Long words never overflow: `overflow-wrap: anywhere`, and the card headword shrinks to fit (e.g. "responsibility").
3. Use `min-height: 100dvh`, never `100vh`.
4. Bottom bar respects `env(safe-area-inset-bottom)`.
5. Disable a button while its action runs; double clicks must never double-score or double-save.
6. Images, icons, and skeletons have fixed dimensions to prevent layout shift.
7. Clear focus ring: `:focus-visible { outline: 3px solid var(--highlight); outline-offset: 2px; }`.
8. No horizontal scroll at any width from 320px up.
9. Card grids align: fixed header heights and buttons pushed to the bottom with `margin-top: auto`.
10. No `z-index` above 100; define layers as tokens (`--z-nav`, `--z-modal`, `--z-toast`).
11. Test every screen at 375, 768, and 1440px before marking it done.

## 2.11 Accessibility

- Semantic landmarks: `header`, `nav`, `main`, `footer` as siblings.
- All functions usable by keyboard only.
- Buttons with icons only have `aria-label` from i18n.
- Live regions (`aria-live="polite"`) announce correct/wrong and score changes.
- Flicker effects stay under 3 flashes per second (WCAG 2.3.1). Anything that moves automatically for more than 5 seconds can be paused.
