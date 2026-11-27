/**
 * Tier 3 Offline AI Templates & Deterministic Reason Builder (Section 5.1–5.3).
 *
 * Design:
 * - 錯誤原因 (why) is ALWAYS generated deterministically by code from exact game/wall data
 *   so it is instant and never hallucinates.
 * - 記憶提示 (tip) falls back here whenever AI is offline, disabled, or fails quality gates.
 * @namespace App.ai.templates
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  function _lang() {
    return App.i18n ? App.i18n.lang() : 'zh-TW';
  }

  /**
   * Build deterministic group breakdown from a wall object and 4 selected item texts.
   * @param {Object} wall
   * @param {string[]} selectedItems
   * @returns {Array<{ label: string, labelZh: string, ruleZh: string, skill: string, items: string[] }>}
   */
  function buildWallBreakdown(wall, selectedItems) {
    if (!wall || !Array.isArray(wall.groups) || !Array.isArray(selectedItems)) return [];
    const buckets = new Map();
    for (const raw of selectedItems) {
      const norm = String(raw || '').trim().toLowerCase();
      if (!norm) continue;
      const gi = wall.groups.findIndex((g) =>
        Array.isArray(g.items) && g.items.some((it) => String(it).trim().toLowerCase() === norm)
      );
      if (gi < 0) continue;
      const grp = wall.groups[gi];
      if (!buckets.has(gi)) {
        buckets.set(gi, {
          label: grp.label,
          labelZh: grp.labelZh,
          ruleZh: grp.ruleZh,
          skill: grp.skill,
          items: [],
        });
      }
      buckets.get(gi).items.push(String(raw).trim());
    }
    return Array.from(buckets.values()).sort((a, b) => b.items.length - a.items.length);
  }

  /**
   * Build the deterministic, always-correct 錯誤原因 (why) directly from wall data or word facts.
   * Example (zh-TW):
   *   「ate、took 是不規則過去式；You're welcome 是回應「謝謝」；eraser 是書包文具。這四個不在同一組。」
   * @param {Object} facts
   * @returns {string}
   */
  function buildDeterministicReason(facts) {
    const f = facts || {};
    const isEn = _lang() === 'en';

    if (f.game === 'wall') {
      const breakdown = Array.isArray(f.selectedBreakdown) && f.selectedBreakdown.length
        ? f.selectedBreakdown
        : (f.wall && Array.isArray(f.selectedItems) ? buildWallBreakdown(f.wall, f.selectedItems) : []);

      if (breakdown.length) {
        if (isEn) {
          const parts = breakdown.map((b) => `${b.items.join(', ')} (${b.label})`);
          return `${parts.join('; ')}. These four do not belong to the same group.`;
        }
        const parts = breakdown.map((b) => `${b.items.join('、')} 是${b.labelZh}`);
        return `${parts.join('；')}。這四個不在同一組。`;
      }

      const selected = Array.isArray(f.selectedItems) ? f.selectedItems : [];
      if (isEn) {
        return `${selected.join(', ')} belong to different groups and do not share one rule.`;
      }
      return `「${selected.join('、')}」分屬不同群組，這四個不在同一組。`;
    }

    // ── 第 13 節課 / 你說我猜 / 單字卡 ───────────────────────────
    const word = String(f.expected || f.word || '').trim();
    const userAns = String(f.userAnswer || '').trim();
    const zh = String(f.meaningZh || '').trim();
    const pos = String(f.pos || '').trim();
    const wrongLetters = Array.isArray(f.wrongLetters) ? f.wrongLetters : [];

    if (f.errorType === 'tense' || f.errorType === 'form') {
      if (isEn) {
        return `The required form is "${word}"${userAns ? ` rather than "${userAns}"` : ''}${zh ? ` (${zh})` : ''}.`;
      }
      return `這題需要的正確詞形是「${word}」${userAns ? `，而不是「${userAns}」` : ''}${zh ? `（${zh}）` : ''}。`;
    }

    if (f.errorType === 'spelling') {
      const lettersNote = wrongLetters.length
        ? (isEn ? ` Watch letters: ${wrongLetters.join(', ')}.` : ` 留意字母：${wrongLetters.join('、')}。`)
        : '';
      if (isEn) {
        return `The correct spelling is "${word}"${zh ? ` (${zh})` : ''}${userAns ? `, not "${userAns}"` : ''}.${lettersNote}`;
      }
      return `正確拼法是「${word}」${zh ? `（${zh}）` : ''}${userAns ? `，不是「${userAns}」` : ''}。${lettersNote}`;
    }

    if (f.errorType === 'timeout') {
      if (isEn) {
        return `Time ran out before finishing "${word}"${zh ? ` (${zh})` : ''}.`;
      }
      return `時間內來不及完成「${word}」${zh ? `（${zh}）` : ''}。`;
    }

    if (isEn) {
      return `"${word}"${pos ? ` (${pos})` : ''} means "${zh || 'check card'}"${userAns ? `, not "${userAns}"` : ''}.`;
    }
    return `「${word}」${pos ? `（${pos}）` : ''}的意思是「${zh || '請見卡片'}」${userAns ? `，不是「${userAns}」` : ''}。`;
  }

  /**
   * Build a concise grounded fallback 記憶提示 (tip) when AI is unavailable or rejected.
   * @param {Object} facts
   * @returns {string}
   */
  function buildFallbackTip(facts) {
    const f = facts || {};
    const isEn = _lang() === 'en';

    if (f.game === 'wall') {
      const breakdown = Array.isArray(f.selectedBreakdown) && f.selectedBreakdown.length
        ? f.selectedBreakdown
        : (f.wall && Array.isArray(f.selectedItems) ? buildWallBreakdown(f.wall, f.selectedItems) : []);
      if (breakdown.length && breakdown[0].ruleZh && !isEn) {
        return `先記「${breakdown[0].labelZh}」：${breakdown[0].ruleZh}`;
      }
      return isEn
        ? 'Separate vocabulary topics, grammar forms, and everyday dialogue replies before grouping.'
        : '先把單字主題、文法詞形和日常對話短句分開，就不容易被誘答字混淆。';
    }

    const word = String(f.expected || f.word || '').trim();
    const zh = String(f.meaningZh || '').trim();
    if (f.errorType === 'tense' || f.errorType === 'form') {
      return isEn
        ? `Say the base form and "${word}" together twice as a pair.`
        : `把原形和正確變化「${word}」連在一起唸兩次會更穩。`;
    }
    if (f.errorType === 'spelling') {
      return isEn
        ? `Break "${word}" into syllables and check each vowel before typing.`
        : `把「${word}」拆成音節邊念邊拼，先確認母音位置。`;
    }
    return isEn
      ? `Say "${word}" aloud with its meaning (${zh || 'card meaning'}) in a short phrase.`
      : `把「${word}」和「${zh || '中文意思'}」放進生活短句裡默念一次。`;
  }

  /**
   * Generate a complete grounded Feature A explanation without any AI model.
   * @param {Object} facts
   * @returns {{ why: string, tip: string, example: string|null }}
   */
  function explainMistake(facts) {
    const f = facts || {};
    const example = f.game !== 'wall' && f.cardExample ? String(f.cardExample).trim() : null;
    return {
      why: buildDeterministicReason(f),
      tip: buildFallbackTip(f),
      example,
    };
  }

  App.ai.templates = {
    buildWallBreakdown,
    buildDeterministicReason,
    buildFallbackTip,
    explainMistake,
  };
})();
