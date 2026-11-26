/**
 * Ring-bound flashcard component with 400ms 3D flip, long-word scaling, and optional IPA.
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});

  const SKILL_LABEL = {
    vocab: '單字',
    grammar: '文法',
    dialogue: '對話',
  };

  /**
   * Compute a scaled font-size in px so long words never overflow (minimum 28px).
   * @param {string} word
   * @returns {string | null}
   */
  function getWordFontSize(word) {
    const len = (word || '').trim().length;
    if (len <= 10) return null;
    const size = Math.max(28, Math.round(48 - (len - 10) * 2.2));
    return `${size}px`;
  }

  /**
   * Create an interactive flashcard element.
   * @param {{ word: string, ipa?: string|null, pos?: string|null, zh: string, example?: string|null, exampleZh?: string|null, aiTip?: string|null, skills?: string[] }} card
   * @param {{ onSpeak?: (slow: boolean) => void, onHistory?: () => void }} [opts]
   * @returns {{ root: HTMLElement, flip: () => void, isFlipped: () => boolean }}
   */
  function create(card, opts = {}) {
    const { el } = App.dom;
    const { svg } = App.icons;
    let flipped = false;
    let flipLocked = false;

    const skills = Array.isArray(card.skills) && card.skills.length ? card.skills : ['vocab'];
    const tabsEl = el('div', { className: 'skill-tabs' },
      skills.map((s) => el('span', {
        className: `skill-tab skill-tab--${s}`,
        text: SKILL_LABEL[s] || s,
      }))
    );

    const wordEl = el('h3', { className: 'flashcard-word', text: card.word });
    const customSize = getWordFontSize(card.word);
    if (customSize) wordEl.style.fontSize = customSize;

    const speakBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-icon',
      'aria-label': '播放標準發音',
      onClick: (ev) => {
        ev.stopPropagation();
        if (opts.onSpeak) opts.onSpeak(false);
      },
    }, [svg('speaker')]);

    const slowBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-icon',
      'aria-label': '慢速發音',
      onClick: (ev) => {
        ev.stopPropagation();
        if (opts.onSpeak) opts.onSpeak(true);
      },
    }, [svg('clock')]);

    const frontFace = el('div', { className: 'flashcard-face flashcard-face--front' }, [
      el('span', { className: 'flashcard-ring-hole', 'aria-hidden': 'true' }),
      el('div', { className: 'flashcard-head' }, [tabsEl]),
      el('div', { className: 'flashcard-center' }, [
        wordEl,
        card.ipa ? el('div', { className: 'flashcard-ipa', text: card.ipa }) : null,
      ]),
      el('div', { className: 'flashcard-foot' }, [
        el('div', { className: 'flashcard-audio' }, [speakBtn, slowBtn]),
        el('span', { className: 'text-small text-muted', text: '點擊或按空白鍵翻面' }),
      ]),
    ]);

    const historyBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: '學習紀錄',
      onClick: (ev) => {
        ev.stopPropagation();
        if (opts.onHistory) opts.onHistory();
      },
    });

    const backFace = el('div', { className: 'flashcard-face flashcard-face--back' }, [
      el('span', { className: 'flashcard-ring-hole', 'aria-hidden': 'true' }),
      el('div', { className: 'flashcard-head' }, [
        card.pos ? el('span', { className: 'flashcard-pos', text: card.pos }) : null,
      ]),
      el('div', { className: 'flashcard-center' }, [
        el('div', { className: 'flashcard-zh', text: card.zh }),
        card.example ? el('div', { className: 'flashcard-example', text: card.example }) : null,
        card.exampleZh ? el('div', { className: 'flashcard-example-zh', text: card.exampleZh }) : null,
        card.aiTip ? el('div', { className: 'flashcard-tip', text: `記憶提示：${card.aiTip}` }) : null,
      ]),
      el('div', { className: 'flashcard-foot' }, [
        historyBtn,
        el('span', { className: 'text-small text-muted', text: '再按一次翻回正面' }),
      ]),
    ]);

    const cardEl = el('div', {
      className: 'flashcard',
      tabindex: '0',
      role: 'button',
      'aria-pressed': 'false',
      'aria-label': `單字卡 ${card.word}，按空白鍵或點擊翻面`,
    }, [frontFace, backFace]);

    function flip() {
      if (flipLocked) return;
      flipLocked = true;
      flipped = !flipped;
      cardEl.classList.toggle('is-flipped', flipped);
      cardEl.setAttribute('aria-pressed', String(flipped));
      setTimeout(() => {
        flipLocked = false;
      }, 400);
    }

    cardEl.addEventListener('click', flip);
    cardEl.addEventListener('keydown', (ev) => {
      if (ev.code === 'Space' || ev.key === 'Enter') {
        ev.preventDefault();
        flip();
      }
    });

    const root = el('div', { className: 'flashcard-scene' }, [cardEl]);
    return { root, flip, isFlipped: () => flipped };
  }

  App.flashcard = { create };
})();
