/**
 * Text-to-Speech (TTS) wrapper using window.speechSynthesis.
 * - Buttons stay enabled whenever window.speechSynthesis exists (never disabled
 *   by an empty getVoices() at initial render).
 * - On click: if voices are already loaded, speaks synchronously inside the user
 *   gesture; if getVoices() is still empty (common in Dia/Chromium under file://),
 *   waits for voiceschanged (max 1.5s) then speaks, or shows a toast if still none.
 * - Prefers localService === true English voices (e.g. Microsoft Zira Desktop),
 *   retries with OS default (voice = null, lang = 'en-US') if a remote voice fails,
 *   avoids the Windows SAPI cancel()+speak() race, and retains the active utterance.
 * @namespace App.audio.tts
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.audio = App.audio || {};

  const DEFAULT_VOICE_TIMEOUT_MS = 1500;
  let _voicesReadyPromise = null;
  let _checked = false;
  let _englishVoice = null;
  let _activeUtter = null;
  let _cancelTimer = null;

  function _t(key, fallback) {
    if (App.i18n) {
      const val = App.i18n.t(key);
      if (val !== key) return val;
    }
    return fallback;
  }

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

  /**
   * Whether the browser exposes the Web Speech synthesis API.
   * @returns {boolean}
   */
  function isSupported() {
    return typeof window !== 'undefined'
      && Boolean(window.speechSynthesis)
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Resolve voices once speechSynthesis populates them (with timeout).
   * Ignores empty intermediate voiceschanged events; never caches a timed-out null.
   * @param {number} [timeoutMs=1500]
   * @returns {Promise<SpeechSynthesisVoice|null>}
   */
  function ensureVoices(timeoutMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_VOICE_TIMEOUT_MS;
    if (!isSupported()) {
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
      const synth = window.speechSynthesis;

      function finish(timedOut) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', onVoices);
        }
        _checked = true;
        const list = synth.getVoices();
        _englishVoice = _pickEnglishVoice(list);
        _voicesReadyPromise = null;
        if (!timedOut && (!_englishVoice && (!list || list.length === 0))) {
          resolve(null);
          return;
        }
        resolve(_englishVoice);
      }

      function onVoices() {
        const list = synth.getVoices();
        if (list && list.length > 0) finish(false);
      }

      const timer = setTimeout(() => finish(true), limit);
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoices);
      } else {
        synth.onvoiceschanged = function () {
          const list = synth.getVoices();
          if (list && list.length > 0) {
            synth.onvoiceschanged = null;
            finish(false);
          }
        };
      }
    });

    return _voicesReadyPromise;
  }

  /**
   * Synchronously inspect current TTS status.
   * @returns {{ supported: boolean, checked: boolean, hasEnglishVoice: boolean }}
   */
  function status() {
    if (!isSupported()) {
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

  function _notifyNoVoice(opts) {
    if (opts && opts.silent) return;
    if (App.toast) {
      App.toast.show(_t('cards.no_english_voice', '此裝置沒有英文語音'));
    }
  }

  /**
   * Queue an utterance on window.speechSynthesis.
   * @param {string} clean
   * @param {SpeechSynthesisVoice|null} voice
   * @param {Object} opts
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
   * - If voices are already loaded, speaks synchronously (keeps user activation).
   * - If getVoices() is still empty, waits for voiceschanged (up to timeoutMs, default 1.5s)
   *   then speaks; only if still no English voice, shows a toast.
   * @param {string} text
   * @param {{ slow?: boolean, rate?: number, pitch?: number, onEnd?: () => void, onError?: (err: string) => void, timeoutMs?: number, silent?: boolean }} [opts]
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  function speak(text, opts) {
    const o = opts || {};
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return Promise.resolve({ ok: false, reason: 'empty' });
    if (!isSupported()) {
      _notifyNoVoice(o);
      return Promise.resolve({ ok: false, reason: 'unsupported' });
    }

    try {
      const list = window.speechSynthesis.getVoices();
      if (list && list.length > 0) {
        _checked = true;
        _englishVoice = _pickEnglishVoice(list);
        if (!_englishVoice) {
          _notifyNoVoice(o);
          return Promise.resolve({ ok: false, reason: 'no_english_voice' });
        }
        _enqueue(clean, _englishVoice, o, true);
        return Promise.resolve({ ok: true });
      }

      // Voices still empty (e.g. Dia/Chromium on first click): wait for voiceschanged (max 1.5s)
      return ensureVoices(o.timeoutMs).then(function (voice) {
        if (!voice) {
          _notifyNoVoice(o);
          return { ok: false, reason: 'no_english_voice' };
        }
        _enqueue(clean, voice, o, true);
        return { ok: true };
      });
    } catch (err) {
      console.warn('[tts] speak failed:', err);
      return Promise.resolve({ ok: false, reason: 'error' });
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
    if (isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) { /* ignore */ }
    }
  }

  App.audio.tts = { isSupported, ensureVoices, status, speak, stop, _pickEnglishVoice };
})();
