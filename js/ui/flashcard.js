/**
 * Ring-bound flashcard component with 400ms 3D flip, long-word scaling,
 * optional IPA, TTS buttons, and post-flip horizontal swipe rating.
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});

  const SKILL_FALLBACK = {
    vocab: '單字',
    grammar: '文法',
    dialogue: '對話',
  };

  function _t(key, fallback) {
    if (App.i18n) {
      const val = App.i18n.t(key);
      if (val !== key) return val;
    }
    return fallback;
  }

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
   * @param {{ word: string, ipa?: string|null, pos?: string|null, zh: string, example?: string|null, exampleZh?: string|null, aiTip?: string|null, myExample?: string|null, skills?: string[] }} card
   * @param {{ onSpeak?: (slow: boolean) => void, onHistory?: () => void, onFlip?: (flipped: boolean) => void, onRate?: (rating: 'unknown'|'know') => void, ttsDisabled?: boolean }} [opts]
   * @returns {{ root: HTMLElement, flip: () => void, isFlipped: () => boolean, setTtsDisabled: (disabled: boolean) => void }}
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
        text: _t('skill.' + s, SKILL_FALLBACK[s] || s),
      }))
    );

    const wordEl = el('h3', { className: 'flashcard-word', text: card.word });
    const customSize = getWordFontSize(card.word);
    if (customSize) wordEl.style.fontSize = customSize;

    const noVoiceLabel = _t('cards.no_english_voice', '此裝置沒有英文語音');
    const speakLabel = _t('cards.speak_normal', '發音');
    const slowLabel = _t('cards.speak_slow', '慢速發音');
    const apiSupported = App.audio && App.audio.tts
      ? App.audio.tts.isSupported()
      : (typeof window !== 'undefined' && Boolean(window.speechSynthesis));

    const speakBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-icon',
      title: speakLabel,
      'aria-label': speakLabel,
      onClick: (ev) => {
        ev.stopPropagation();
        if (speakBtn.disabled) return;
        if (opts.onSpeak) opts.onSpeak(false);
        else if (App.audio && App.audio.tts) App.audio.tts.speak(card.word, { slow: false });
      },
    }, [svg('speaker')]);

    const slowBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-icon',
      title: slowLabel,
      'aria-label': slowLabel,
      onClick: (ev) => {
        ev.stopPropagation();
        if (slowBtn.disabled) return;
        if (opts.onSpeak) opts.onSpeak(true);
        else if (App.audio && App.audio.tts) App.audio.tts.speak(card.word, { slow: true });
      },
    }, [svg('clock')]);

    function setTtsDisabled(disabled) {
      speakBtn.disabled = Boolean(disabled);
      slowBtn.disabled = Boolean(disabled);
      if (disabled) {
        speakBtn.setAttribute('title', noVoiceLabel);
        slowBtn.setAttribute('title', noVoiceLabel);
        speakBtn.setAttribute('aria-label', noVoiceLabel);
        slowBtn.setAttribute('aria-label', noVoiceLabel);
      } else {
        speakBtn.setAttribute('title', speakLabel);
        slowBtn.setAttribute('title', slowLabel);
        speakBtn.setAttribute('aria-label', speakLabel);
        slowBtn.setAttribute('aria-label', slowLabel);
      }
    }

    if (opts.ttsDisabled || !apiSupported) {
      setTtsDisabled(true);
    }

    const frontFace = el('div', { className: 'flashcard-face flashcard-face--front' }, [
      el('span', { className: 'flashcard-ring-hole', 'aria-hidden': 'true' }),
      el('div', { className: 'flashcard-head' }, [tabsEl]),
      el('div', { className: 'flashcard-center' }, [
        wordEl,
        card.ipa ? el('div', { className: 'flashcard-ipa', text: card.ipa }) : null,
      ]),
      el('div', { className: 'flashcard-foot' }, [
        el('div', { className: 'flashcard-audio' }, [speakBtn, slowBtn]),
        el('span', { className: 'text-small text-muted', text: _t('cards.tap_flip', '點擊或按空白鍵翻面') }),
      ]),
    ]);

    const historyBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: _t('cards.history', '學習紀錄'),
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
        card.example
          ? el('div', { className: 'flashcard-example', text: card.example })
          : el('div', { className: 'text-small text-muted', text: _t('cards.no_example', '暫無例句') }),
        card.example && card.exampleZh ? el('div', { className: 'flashcard-example-zh', text: card.exampleZh }) : null,
        card.aiTip ? el('div', { className: 'flashcard-tip', text: `${_t('cards.ai_tip', '記憶提示')}：${card.aiTip}` }) : null,
      ]),
      el('div', { className: 'flashcard-foot' }, [
        historyBtn,
        el('span', { className: 'text-small text-muted', text: _t('cards.flip_back', '再按一次翻回正面') }),
      ]),
    ]);

    const cardEl = el('div', {
      className: 'flashcard',
      tabindex: '0',
      role: 'button',
      'aria-pressed': 'false',
      'aria-label': `${card.word}`,
    }, [frontFace, backFace]);

    function flip() {
      if (flipLocked) return;
      flipLocked = true;
      flipped = !flipped;
      cardEl.classList.toggle('is-flipped', flipped);
      cardEl.setAttribute('aria-pressed', String(flipped));
      if (typeof opts.onFlip === 'function') opts.onFlip(flipped);
      setTimeout(() => {
        flipLocked = false;
      }, 400);
    }

    // Touch swipe rating ONLY after card is flipped (DECISIONS.md #9)
    let touchStartX = null;
    let touchStartY = null;
    let justSwiped = false;

    cardEl.addEventListener('touchstart', (ev) => {
      if (!ev.touches || ev.touches.length !== 1) return;
      touchStartX = ev.touches[0].clientX;
      touchStartY = ev.touches[0].clientY;
    }, { passive: true });

    cardEl.addEventListener('touchend', (ev) => {
      if (touchStartX === null || !ev.changedTouches || !ev.changedTouches.length) return;
      const dx = ev.changedTouches[0].clientX - touchStartX;
      const dy = ev.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;

      if (flipped && typeof opts.onRate === 'function' && Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        justSwiped = true;
        setTimeout(() => { justSwiped = false; }, 120);
        opts.onRate(dx < 0 ? 'unknown' : 'know');
      }
    }, { passive: true });

    cardEl.addEventListener('click', () => {
      if (justSwiped) return;
      flip();
    });

    cardEl.addEventListener('keydown', (ev) => {
      if (ev.code === 'Space' || ev.key === 'Enter') {
        ev.preventDefault();
        flip();
      }
    });

    const root = el('div', { className: 'flashcard-scene' }, [cardEl]);
    return { root, flip, isFlipped: () => flipped, setTtsDisabled };
  }

  App.flashcard = { create };
})();
