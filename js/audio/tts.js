/**
 * Text-to-Speech (TTS) wrapper using window.speechSynthesis.
 * - Prefers en-US voice (falls back to any English voice).
 * - Normal rate 0.9, slow rate 0.6 (Section 3.6).
 * - Waits up to 1.5s for voiceschanged before first utterance.
 * - Never throws when speechSynthesis or English voice is unavailable.
 * @namespace App.audio.tts
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.audio = App.audio || {};

  const VOICE_TIMEOUT_MS = 1500;
  let _voicesReadyPromise = null;
  let _checked = false;
  let _englishVoice = null;

  /**
   * Pick best English voice from available list.
   * @param {SpeechSynthesisVoice[]} voices
   * @returns {SpeechSynthesisVoice|null}
   */
  function _pickEnglishVoice(voices) {
    if (!Array.isArray(voices) || voices.length === 0) return null;
    const enUS = voices.find((v) => v.lang && v.lang.toLowerCase() === 'en-us');
    if (enUS) return enUS;
    const enUSPrefix = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en-us'));
    if (enUSPrefix) return enUSPrefix;
    return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) || null;
  }

  /**
   * Resolve voices once speechSynthesis loads them (with 1.5s fallback timeout).
   * @returns {Promise<SpeechSynthesisVoice|null>}
   */
  function ensureVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      _checked = true;
      _englishVoice = null;
      return Promise.resolve(null);
    }

    const current = window.speechSynthesis.getVoices();
    if (current && current.length > 0) {
      _checked = true;
      _englishVoice = _pickEnglishVoice(current);
      return Promise.resolve(_englishVoice);
    }

    if (_voicesReadyPromise) return _voicesReadyPromise;

    _voicesReadyPromise = new Promise(function (resolve) {
      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        _checked = true;
        const list = window.speechSynthesis.getVoices();
        _englishVoice = _pickEnglishVoice(list);
        resolve(_englishVoice);
      }

      const timer = setTimeout(finish, VOICE_TIMEOUT_MS);
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', function onVoices() {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
          clearTimeout(timer);
          finish();
        });
      } else {
        window.speechSynthesis.onvoiceschanged = function () {
          window.speechSynthesis.onvoiceschanged = null;
          clearTimeout(timer);
          finish();
        };
      }
    });

    return _voicesReadyPromise;
  }

  /**
   * Synchronously inspect current TTS availability status.
   * @returns {{ supported: boolean, checked: boolean, hasEnglishVoice: boolean }}
   */
  function status() {
    const supported = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined';
    if (!supported) {
      return { supported: false, checked: true, hasEnglishVoice: false };
    }
    const list = window.speechSynthesis.getVoices();
    if (list && list.length > 0) {
      _checked = true;
      _englishVoice = _pickEnglishVoice(list);
    }
    return {
      supported: true,
      checked: _checked,
      hasEnglishVoice: Boolean(_englishVoice),
    };
  }

  /**
   * Speak an English word or sentence.
   * Repeated calls cancel any in-flight utterance first.
   * @param {string} text
   * @param {{ slow?: boolean }} [opts]
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async function speak(text, opts) {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return { ok: false, reason: 'empty' };

    const supported = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined';
    if (!supported) return { ok: false, reason: 'unsupported' };

    const voice = await ensureVoices();
    if (!voice) return { ok: false, reason: 'no_english_voice' };

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.voice = voice;
      utter.lang = voice.lang || 'en-US';
      const slow = Boolean(opts && opts.slow);
      const userRate = App.store && App.store.settings ? Number(App.store.settings.get('speechRate')) || 1.0 : 1.0;
      const normalRate = Math.max(0.5, Math.min(2.0, 0.9 * userRate));
      utter.rate = slow ? 0.6 : normalRate;
      window.speechSynthesis.speak(utter);
      return { ok: true };
    } catch (err) {
      console.warn('[tts] speak failed:', err);
      return { ok: false, reason: 'error' };
    }
  }

  /**
   * Stop any active utterance (call on page unmount).
   */
  function stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) { /* ignore */ }
    }
  }

  App.audio.tts = { ensureVoices, status, speak, stop };
})();
