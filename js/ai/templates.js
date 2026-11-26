/**
 * Tier 3 Offline AI Templates (Section 5.2 & 5.3).
 * Always available offline with zero download and zero hallucination:
 * formats code-supplied FACTS into concise, helpful Traditional Chinese (or English)
 * explanations for Feature A (錯題解說).
 * @namespace App.ai.templates
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  function _lang() {
    return App.i18n ? App.i18n.lang() : 'zh-TW';
  }

  function _skillName(skill, isEn) {
    const mapZh = { vocab: '單字', grammar: '文法', dialogue: '對話' };
    const mapEn = { vocab: 'vocabulary', grammar: 'grammar', dialogue: 'dialogue' };
    return (isEn ? mapEn : mapZh)[skill] || skill;
  }

  /**
   * Generate a grounded Feature A explanation from FACTS without any AI model.
   * @param {Object} facts
   * @returns {{ why: string, tip: string, example: string|null }}
   */
  function explainMistake(facts) {
    const f = facts || {};
    const isEn = _lang() === 'en';

    // ── 四格分類牆 (Four-Group Wall) ─────────────────────────────
    if (f.game === 'wall') {
      const selected = Array.isArray(f.selectedItems) ? f.selectedItems : [];
      const meanings = Array.isArray(f.cardMeanings) ? f.cardMeanings : [];
      const skills = Array.isArray(f.skillsPresent) ? f.skillsPresent : [];
      const meaningHint = meanings.length
        ? meanings.slice(0, 3).map((m) => `${m.word}（${m.zh}）`).join('、')
        : '';

      if (f.spoilerSafe) {
        // Active wall: explain without leaking the exact unsolved answer key
        const skillNames = skills.map((s) => _skillName(s, isEn));
        if (isEn) {
          const why = f.isOneAway
            ? `Three of your four picks (${selected.join(', ')}) belong together, while one item follows a different rule or skill.`
            : `Your four picks (${selected.join(', ')}) span ${f.distinctGroupCount || 2} different groups${skillNames.length > 1 ? ` across ${skillNames.join(' / ')}` : ''}.`;
          const tip = meaningHint
            ? `Check each item's role and meaning: ${meaningHint}. Separate grammar forms or dialogue phrases from topic words.`
            : 'Compare part of speech and real-life usage. Watch out for words that look related to a topic but belong to a grammar or dialogue group.';
          return { why, tip, example: null };
        }

        const why = f.isOneAway
          ? `你選的「${selected.join('、')}」裡有 3 個屬於同一組，只差 1 個其實屬於其他規則或主題。`
          : `你選的「${selected.join('、')}」橫跨了 ${f.distinctGroupCount || 2} 個不同分組${skillNames.length > 1 ? `（包含${skillNames.join('、')}）` : ''}，彼此沒有共同規則。`;
        const tip = meaningHint
          ? `先核對詞義與用法：${meaningHint}。把文法形式、日常對話短句與主題單字分開判斷。`
          : '先觀察這四個項目的詞性與使用情境：有些字表面像同主題，其實是文法變化或對話回應的誘答。';
        return { why, tip, example: null };
      }

      // End screen: full rule breakdown (all groups already revealed)
      const maj = f.majorityGroup;
      const odds = Array.isArray(f.oddItems) ? f.oddItems : [];
      if (maj && odds.length) {
        const oddDescZh = odds.map((o) => `「${o.item}」屬於「${o.groupLabelZh}」`).join('，');
        const oddDescEn = odds.map((o) => `"${o.item}" belongs to "${o.groupLabel}"`).join(', ');
        if (isEn) {
          return {
            why: `Your picks mixed "${maj.label}" (${maj.matchedItems.join(', ')}) with ${oddDescEn}.`,
            tip: `Remember the rule for "${maj.label}": ${maj.ruleZh}`,
            example: null,
          };
        }
        return {
          why: `你把「${maj.labelZh}」（${maj.matchedItems.join('、')}）和不同組的項目混在一起：${oddDescZh}。`,
          tip: `「${maj.labelZh}」的判斷重點：${maj.ruleZh}`,
          example: null,
        };
      }

      return isEn
        ? {
          why: `These four items (${selected.join(', ')}) belong to separate groups with different vocabulary, grammar, or dialogue rules.`,
          tip: 'Check the 4 revealed group rules below and notice any red-herring word that fits two contexts.',
          example: null,
        }
        : {
          why: `「${selected.join('、')}」分屬不同群組，各自對應不同的單字主題、文法規則或對話功能。`,
          tip: '對照下方四組規則，特別留意跨情境的誘答字。',
          example: null,
        };
    }

    // ── 第 13 節課 / 你說我猜 / 單字卡 ───────────────────────────
    const word = String(f.expected || f.word || '').trim();
    const userAns = String(f.userAnswer || '').trim();
    const zh = String(f.meaningZh || '').trim();
    const pos = String(f.pos || '').trim();
    const wrongLetters = Array.isArray(f.wrongLetters) ? f.wrongLetters : [];
    const example = f.cardExample ? String(f.cardExample).trim() : null;

    if (f.errorType === 'tense' || f.errorType === 'form') {
      if (isEn) {
        return {
          why: `The required form is "${word}"${userAns ? ` rather than "${userAns}"` : ''}${zh ? ` (${zh})` : ''}.`,
          tip: `Practice saying the base and target form "${word}" together as a pair.`,
          example,
        };
      }
      return {
        why: `這題需要的正確詞形是「${word}」${userAns ? `，而不是「${userAns}」` : ''}${zh ? `（${zh}）` : ''}。`,
        tip: `記這類變化時，把原形與正確變化「${word}」唸成一組會更穩。`,
        example,
      };
    }

    if (f.errorType === 'spelling') {
      const lettersNote = wrongLetters.length
        ? (isEn ? ` Pay attention to letters: ${wrongLetters.join(', ')}.` : ` 特別留意容易打錯的字母：${wrongLetters.join('、')}。`)
        : '';
      if (isEn) {
        return {
          why: `The correct spelling is "${word}"${zh ? ` (${zh})` : ''}${userAns ? `, while "${userAns}" had a spelling slip` : ''}.${lettersNote}`,
          tip: `Break "${word}" into syllables and check each vowel before typing.`,
          example,
        };
      }
      return {
        why: `正確拼法是「${word}」${zh ? `（${zh}）` : ''}${userAns ? `，你輸入的「${userAns}」有拼字誤差` : ''}。${lettersNote}`,
        tip: `把「${word}」拆成音節邊念邊拼，先確認母音位置再輸入。`,
        example,
      };
    }

    if (f.errorType === 'timeout') {
      if (isEn) {
        return {
          why: `Time ran out before finishing "${word}"${zh ? ` (${zh})` : ''}.`,
          tip: `Say "${word}" aloud twice with its meaning (${zh || 'card meaning'}) to speed up recall.`,
          example,
        };
      }
      return {
        why: `這題在時間內來不及完成「${word}」${zh ? `（${zh}）` : ''}。`,
        tip: `把「${word}」和中文「${zh || '字義'}」連在一起唸兩次，下次反應會更快。`,
        example,
      };
    }

    // Default vocabulary / meaning explanation
    if (isEn) {
      return {
        why: `"${word}"${pos ? ` (${pos})` : ''} means "${zh || 'check card'}"${userAns ? `, not "${userAns}"` : ''}.`,
        tip: `Review "${word}" in a short phrase so its meaning sticks in context.`,
        example,
      };
    }
    return {
      why: `「${word}」${pos ? `（${pos}）` : ''}的意思是「${zh || '請見卡片'}」${userAns ? `，和「${userAns}」不同` : ''}。`,
      tip: `把「${word}」連同中文「${zh || '字義'}」放進生活情境裡默念一次會更好記。`,
      example,
    };
  }

  App.ai.templates = {
    explainMistake,
  };
})();
