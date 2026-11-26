/**
 * Tier 1 AI Backend: Chrome Built-in Prompt API (Gemini Nano) + Translator API (Section 5.2).
 * - Checks LanguageModel.availability() and Translator.availability() cleanly.
 * - Uses initialPrompts on a base session and clones it per request (Section 5.4).
 * - Uses responseConstraint JSON schema without maxLength (Section 5.4).
 * - Translates simple English output to zh-Hant via Translator API when available.
 * @namespace App.ai.nano
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  let _baseSession = null;
  let _basePromptKey = '';
  let _translator = null;

  async function detect() {
    let promptAvailability = 'unavailable';
    if (typeof window !== 'undefined' && window.LanguageModel && typeof window.LanguageModel.availability === 'function') {
      try {
        promptAvailability = await window.LanguageModel.availability();
      } catch (_e) {
        promptAvailability = 'unavailable';
      }
    }

    let translatorAvailability = 'unavailable';
    if (typeof window !== 'undefined' && window.Translator && typeof window.Translator.availability === 'function') {
      try {
        translatorAvailability = await window.Translator.availability({
          sourceLanguage: 'en',
          targetLanguage: 'zh-Hant',
        });
      } catch (_e) {
        translatorAvailability = 'unavailable';
      }
    }

    return {
      available: promptAvailability === 'available' || promptAvailability === 'downloadable' || promptAvailability === 'downloading',
      ready: promptAvailability === 'available',
      availability: promptAvailability,
      translatorAvailability,
    };
  }

  async function _ensureSession(systemPrompt, onProgress) {
    if (_baseSession && _basePromptKey === systemPrompt) {
      return _baseSession;
    }
    await destroy();

    if (typeof window === 'undefined' || !window.LanguageModel || typeof window.LanguageModel.create !== 'function') {
      throw new Error('Gemini Nano Prompt API is unavailable');
    }

    _baseSession = await window.LanguageModel.create({
      initialPrompts: [{ role: 'system', content: systemPrompt }],
      temperature: 0.2,
      topK: 3,
      monitor(m) {
        if (m && typeof m.addEventListener === 'function' && typeof onProgress === 'function') {
          m.addEventListener('downloadprogress', (e) => {
            onProgress({
              loaded: e.loaded || 0,
              total: e.total || 1,
              pct: e.total ? Math.round((e.loaded / e.total) * 100) : Math.round((e.loaded || 0) * 100),
              file: 'Gemini Nano',
            });
          });
        }
      },
    });
    _basePromptKey = systemPrompt;
    return _baseSession;
  }

  async function translateEnToZh(text) {
    if (!text || typeof window === 'undefined' || !window.Translator || typeof window.Translator.create !== 'function') {
      return text;
    }
    try {
      if (!_translator) {
        const avail = await window.Translator.availability({
          sourceLanguage: 'en',
          targetLanguage: 'zh-Hant',
        });
        if (avail === 'unavailable') return text;
        _translator = await window.Translator.create({
          sourceLanguage: 'en',
          targetLanguage: 'zh-Hant',
        });
      }
      return await _translator.translate(text);
    } catch (_e) {
      return text;
    }
  }

  /**
   * Generate structured JSON text using Chrome LanguageModel.
   * @param {{ systemPrompt: string, userPrompt: string, schema?: Object, signal?: AbortSignal, onToken?: (chunk: string, full: string) => void, onProgress?: (p: Object) => void }} opts
   * @returns {Promise<{ text: string, elapsedMs: number }>}
   */
  async function generate(opts) {
    const o = opts || {};
    const status = await detect();
    if (!status.available) {
      throw new Error('Gemini Nano unavailable (' + status.availability + ')');
    }

    const base = await _ensureSession(o.systemPrompt, o.onProgress);
    const session = typeof base.clone === 'function' ? await base.clone() : base;
    const t0 = performance.now();

    try {
      const promptOpts = {};
      if (o.schema) promptOpts.responseConstraint = o.schema;
      if (o.signal) promptOpts.signal = o.signal;

      let full = '';
      if (typeof session.promptStreaming === 'function') {
        const stream = session.promptStreaming(o.userPrompt, promptOpts);
        for await (const chunk of stream) {
          if (o.signal && o.signal.aborted) {
            const abortErr = new Error('Aborted');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
          full += chunk;
          if (typeof o.onToken === 'function') o.onToken(chunk, full);
        }
      } else {
        full = await session.prompt(o.userPrompt, promptOpts);
        if (typeof o.onToken === 'function') o.onToken(full, full);
      }

      return { text: full, elapsedMs: Math.round(performance.now() - t0) };
    } finally {
      if (session !== base && typeof session.destroy === 'function') {
        try { session.destroy(); } catch (_e) { /* ignore */ }
      }
    }
  }

  async function destroy() {
    if (_baseSession && typeof _baseSession.destroy === 'function') {
      try { _baseSession.destroy(); } catch (_e) { /* ignore */ }
    }
    _baseSession = null;
    _basePromptKey = '';
    if (_translator && typeof _translator.destroy === 'function') {
      try { _translator.destroy(); } catch (_e) { /* ignore */ }
    }
    _translator = null;
  }

  App.ai.nano = {
    detect,
    generate,
    translateEnToZh,
    destroy,
  };
})();
