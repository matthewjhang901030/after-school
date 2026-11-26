/**
 * Text-to-Speech (TTS) wrapper using window.speechSynthesis.
 * - Preserves Chromium user-gesture activation by speaking synchronously when
 *   voices are ready (no unnecessary await before speechSynthesis.speak).
 * - Prefers localService === true English voices (e.g. Microsoft Zira Desktop
 *   on Windows 11) so Dia, offline mode, and file:// work reliably; retries
 *   with OS default voice (voice = null, lang = 'en-US') if a remote voice fails.
 * - Avoids Chromium Windows SAPI cancel()+speak() race and GC mid-utterance bug.
 * - Supports slow (0.6x), custom rate, pitch (for Class 13 loudspeaker), and onEnd.
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
  let _activeUtter = null;
  let _cancelTimer = null;

  /**
   * Pick best English voice: local en-US -> local en* -> remote en-US -> remote en*.
   * @param {SpeechSynthesisVoice[]} voices
   * @returns {SpeechSynthesisVoice|null}
   */
  function _pickEnglishVoice(voices) {
    if (!Array.isArray(voices) || voices.length === 0) return null;
    const isEnUs = (v) => v.lang && v.lang.toLowerCase().replace('_', '-') === 'en-us';
    const isEn = (v) => v.lang && v.lang.toLowerCase().startsWith('en');

    return (
      voices.find((v) => v.localService && isEnUs(v)) ||
      voices.find((v) => v.localService && isEn(v)) ||
      voices.find((v) => isEnUs(v)) ||
      voices.find((v) => isEn(v)) ||
      null
    );
  }

  function _supported() {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Resolve voices once speechSynthesis loads them (with 1.5s fallback timeout).
   * Does not permanently cache an empty result after timeout so later clicks recover.
   * @returns {Promise<SpeechSynthesisVoice|null>}
   */
  function ensureVoices() {
    if (!_supported()) {
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
      function finish(timedOut) {
        if (settled) return;
        settled = true;
        _checked = true;
        const list = window.speechSynthesis.getVoices();
        _englishVoice = _pickEnglishVoice(list);
        if (timedOut && !_englishVoice) {
          _voicesReadyPromise = null;
        }
        resolve(_englishVoice);
      }

      const timer = setTimeout(() => finish(true), VOICE_TIMEOUT_MS);
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', function onVoices() {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
          clearTimeout(timer);
          finish(false);
        });
      } else {
        window.speechSynthesis.onvoiceschanged = function () {
          window.speechSynthesis.onvoiceschanged = null;
          clearTimeout(timer);
          finish(false);
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
    if (!_supported()) {
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
   * Queue an utterance synchronously inside the current user gesture.
   * @param {string} clean
   * @param {SpeechSynthesisVoice|null} voice
   * @param {{ slow?: boolean, rate?: number, pitch?: number, onEnd?: () => void, onError?: (err: string) => void }} opts
   * @param {boolean} allowFallback
   */
  function _enqueue(clean, voice, opts, allowFallback) {
    const synth = window.speechSynthesis;
    if (_cancelTimer) {
      clearTimeout(_cancelTimer);
      _cancelTimer = null;
    }

    const utter = new SpeechSynthesisUtterance(clean);
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang || 'en-US';
    } else {
      utter.lang = 'en-US';
    }

    const slow = Boolean(opts && opts.slow);
    const userRate = App.store && App.store.settings ? Number(App.store.settings.get('speechRate')) || 1.0 : 1.0;
    const defaultNormal = Math.max(0.5, Math.min(2.0, 0.9 * userRate));
    if (opts && typeof opts.rate === 'number') {
      utter.rate = Math.max(0.5, Math.min(2.0, opts.rate));
    } else {
      utter.rate = slow ? 0.6 : defaultNormal;
    }
    if (opts && typeof opts.pitch === 'number') {
      utter.pitch = Math.max(0.1, Math.min(2.0, opts.pitch));
    }

    utter.onend = function () {
      if (_activeUtter === utter) _activeUtter = null;
      if (opts && typeof opts.onEnd === 'function') opts.onEnd();
    };

    utter.onerror = function (ev) {
      const code = ev && ev.error ? String(ev.error) : 'unknown';
      if (_activeUtter === utter) _activeUtter = null;
      if (code === 'canceled' || code === 'interrupted') return;

      // Remote voice failed (common in Dia / offline / file://): retry once with OS default voice
      if (allowFallback && voice && !voice.localService) {
        _enqueue(clean, null, opts, false);
        return;
      }
      console.warn('[tts] utterance error:', code);
      if (opts && typeof opts.onError === 'function') opts.onError(code);
    };

    const runSpeak = function () {
      _activeUtter = utter;
      if (synth.paused) {
        try { synth.resume(); } catch (_e) { /* ignore */ }
      }
      synth.speak(utter);
    };

    // Avoid Chromium Windows SAPI cancel()+speak() race: only cancel if active
    if (synth.speaking || synth.pending) {
      synth.cancel();
      _cancelTimer = setTimeout(function () {
        _cancelTimer = null;
        runSpeak();
      }, 40);
    } else {
      runSpeak();
    }
  }

  /**
   * Speak an English word or sentence.
   * Speaks synchronously when voices are available (preserving user activation).
   * @param {string} text
   * @param {{ slow?: boolean, rate?: number, pitch?: number, onEnd?: () => void, onError?: (err: string) => void }} [opts]
   * @returns {{ ok: boolean, reason?: string }}
   */
  function speak(text, opts) {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return { ok: false, reason: 'empty' };
    if (!_supported()) return { ok: false, reason: 'unsupported' };

    try {
      const list = window.speechSynthesis.getVoices();
      if (list && list.length > 0) {
        _checked = true;
        _englishVoice = _pickEnglishVoice(list);
        if (!_englishVoice) {
          return { ok: false, reason: 'no_english_voice' };
        }
        _enqueue(clean, _englishVoice, opts || {}, true);
        return { ok: true };
      }

      // Voices not populated yet (lazy load in Chromium/Dia): speak immediately with
      // lang='en-US' (OS default SAPI voice) to stay inside the synchronous user gesture,
      // and warm up voices in background for subsequent clicks.
      ensureVoices();
      _enqueue(clean, null, opts || {}, false);
      return { ok: true };
    } catch (err) {
      console.warn('[tts] speak failed:', err);
      return { ok: false, reason: 'error' };
    }
  }

  /**
   * Stop any active or queued utterance (call on page unmount).
   */
  function stop() {
    if (_cancelTimer) {
      clearTimeout(_cancelTimer);
      _cancelTimer = null;
    }
    _activeUtter = null;
    if (_supported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) { /* ignore */ }
    }
  }

  App.audio.tts = { ensureVoices, status, speak, stop, _pickEnglishVoice };
})();
