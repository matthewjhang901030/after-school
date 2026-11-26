/**
 * Text-to-Speech (TTS) wrapper using window.speechSynthesis.
 * - Rates: 1.0 normal (x user speechRate), 0.8 slow (avoids distortion on online voices).
 * - Voice priority: Edge "Microsoft ... Online (Natural)" en-US -> Chrome "Google US English"
 *   -> local en-US -> any en-US -> local en* -> any en*. Retries local/OS default on error.
 * - Waits 50ms after cancel() before speak() and ignores rapid duplicate clicks on the
 *   same utterance so audio never crackles.
 * - Shows "no English voice" toast at most once per page view.
 * @namespace App.audio.tts
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.audio = App.audio || {};

  const DEFAULT_VOICE_TIMEOUT_MS = 1500;
  const POST_CANCEL_DELAY_MS = 55;
  const DUPLICATE_CLICK_MS = 350;

  let _voicesReadyPromise = null;
  let _checked = false;
  let _englishVoice = null;
  let _activeUtter = null;
  let _cancelTimer = null;
  let _noVoiceToastShown = false;
  let _lastSpeakKey = '';
  let _lastSpeakAt = 0;

  function _t(key, fallback) {
    if (App.i18n) {
      const val = App.i18n.t(key);
      if (val !== key) return val;
    }
    return fallback;
  }

  /**
   * Pick best English voice:
   * 1. Edge "Microsoft ... Online (Natural)" en-US
   * 2. Chrome "Google US English"
   * 3. Local en-US (e.g. Microsoft Zira Desktop)
   * 4. Any en-US
   * 5. Local en*
   * 6. Any en*
   * @param {SpeechSynthesisVoice[]} voices
   * @returns {SpeechSynthesisVoice|null}
   */
  function _pickEnglishVoice(voices) {
    if (!Array.isArray(voices) || voices.length === 0) return null;
    const normLang = (v) => (v && v.lang ? String(v.lang).toLowerCase().replace('_', '-') : '');
    const nameOf = (v) => (v && v.name ? String(v.name) : '');
    const isEnUs = (v) => normLang(v) === 'en-us';
    const isEn = (v) => normLang(v).startsWith('en');

    return (
      voices.find((v) => isEnUs(v) && /microsoft\b.*online\s*\(natural\)/i.test(nameOf(v))) ||
      voices.find((v) => /google us english/i.test(nameOf(v))) ||
      voices.find((v) => v.localService && isEnUs(v)) ||
      voices.find((v) => isEnUs(v)) ||
      voices.find((v) => v.localService && isEn(v)) ||
      voices.find((v) => isEn(v)) ||
      null
    );
  }

  function _pickLocalEnglishVoice(voices) {
    if (!Array.isArray(voices) || voices.length === 0) return null;
    const normLang = (v) => (v && v.lang ? String(v.lang).toLowerCase().replace('_', '-') : '');
    return (
      voices.find((v) => v.localService && normLang(v) === 'en-us') ||
      voices.find((v) => v.localService && normLang(v).startsWith('en')) ||
      null
    );
  }

  function isSupported() {
    return typeof window !== 'undefined'
      && Boolean(window.speechSynthesis)
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Resolve voices once speechSynthesis populates them (with timeout).
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

      function finish() {
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
        resolve(_englishVoice);
      }

      function onVoices() {
        const list = synth.getVoices();
        if (list && list.length > 0) finish();
      }

      const timer = setTimeout(finish, limit);
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoices);
      } else {
        synth.onvoiceschanged = function () {
          const list = synth.getVoices();
          if (list && list.length > 0) {
            synth.onvoiceschanged = null;
            finish();
          }
        };
      }
    });

    return _voicesReadyPromise;
  }

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

  function resetPageNotice() {
    _noVoiceToastShown = false;
  }

  function _notifyNoVoice(opts) {
    if ((opts && opts.silent) || _noVoiceToastShown) return;
    _noVoiceToastShown = true;
    if (App.toast) {
      App.toast.show(_t('cards.no_english_voice', '此瀏覽器找不到英文語音，請改用 Edge 或 Chrome 開啟。'));
    }
  }

  function _computeRate(opts) {
    if (opts && typeof opts.rate === 'number') {
      return Math.max(0.5, Math.min(2.0, opts.rate));
    }
    if (opts && opts.slow) return 0.8;
    const userRate = App.store && App.store.settings ? Number(App.store.settings.get('speechRate')) || 1.0 : 1.0;
    return Math.max(0.5, Math.min(2.0, userRate));
  }

  function _enqueue(clean, voice, opts, allowFallback) {
    const synth = window.speechSynthesis;
    const rate = _computeRate(opts);
    const speakKey = `${clean.toLowerCase()}|${rate.toFixed(2)}`;
    const now = Date.now();

    // Ignore rapid repeated clicks while the exact same utterance is already playing
    if ((synth.speaking || synth.pending) && speakKey === _lastSpeakKey && (now - _lastSpeakAt) < DUPLICATE_CLICK_MS) {
      return;
    }

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
    utter.rate = rate;
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
        const localVoice = _pickLocalEnglishVoice(synth.getVoices());
        _enqueue(clean, localVoice, opts, false);
        return;
      }
      console.warn('[tts] utterance error:', code);
      if (opts && typeof opts.onError === 'function') opts.onError(code);
    };

    const runSpeak = function () {
      _activeUtter = utter;
      _lastSpeakKey = speakKey;
      _lastSpeakAt = Date.now();
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
      }, POST_CANCEL_DELAY_MS);
    } else {
      runSpeak();
    }
  }

  /**
   * Speak an English word or sentence.
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

  function stop() {
    if (_cancelTimer) {
      clearTimeout(_cancelTimer);
      _cancelTimer = null;
    }
    _activeUtter = null;
    _noVoiceToastShown = false;
    if (isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) { /* ignore */ }
    }
  }

  App.audio.tts = {
    isSupported,
    ensureVoices,
    status,
    speak,
    stop,
    resetPageNotice,
    _pickEnglishVoice,
  };
})();
