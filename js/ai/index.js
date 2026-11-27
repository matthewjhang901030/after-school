/**
 * Browser-side AI Coordinator — Three-tier detection, prompt building,
 * JSON schema validation, 20-second timeout + single retry, and Feature A (錯題解說).
 *
 * Core principle (Section 5.1):
 *   Code supplies all FACTS; AI only phrases them in friendly language.
 *   Code validates every response and falls back cleanly to offline templates.
 * @namespace App.ai
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  const FIRST_TOKEN_TIMEOUT_MS = 20000;
  const FEATURE_A_MAX_TOKENS = 80;

  let _cachedStatus = null;

  const FEATURE_A_SCHEMA = {
    type: 'object',
    properties: {
      why: { type: 'string' },
      tip: { type: 'string' },
      example: { type: ['string', 'null'] },
    },
    required: ['why', 'tip'],
    additionalProperties: false,
  };

  /**
   * Detect available AI tiers (non-blocking, cached unless force === true).
   * @param {boolean} [force=false]
   * @returns {Promise<Object>}
   */
  async function detect(force) {
    if (_cachedStatus && !force) return Object.assign({}, _cachedStatus);

    const preferred = App.store && App.store.settings
      ? App.store.settings.get('aiEngine') || 'auto'
      : 'auto';

    const nanoInfo = App.ai.nano
      ? await App.ai.nano.detect()
      : { available: false, ready: false, availability: 'unavailable', translatorAvailability: 'unavailable' };

    const qwenSupported = App.ai.qwen ? App.ai.qwen.isSupported() : false;
    const qwenCache = App.ai.qwen ? await App.ai.qwen.inspectCache() : { cached: false, files: 0, bytes: 0 };
    const webgpu = typeof navigator !== 'undefined' && Boolean(navigator.gpu);

    let activeTier = 'template';
    if (preferred === 'templates') {
      activeTier = 'template';
    } else if (preferred === 'nano') {
      activeTier = nanoInfo.available ? 'nano' : 'template';
    } else if (preferred === 'qwen') {
      activeTier = qwenSupported ? 'qwen' : 'template';
    } else {
      // 'auto': Tier 1 Nano (if available) -> Tier 2 Qwen (if Worker supported & online or cached) -> Tier 3 Templates
      const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
      if (nanoInfo.ready) {
        activeTier = 'nano';
      } else if (qwenSupported && (qwenCache.cached || online)) {
        activeTier = 'qwen';
      } else {
        activeTier = 'template';
      }
    }

    const qwenMetrics = App.ai.qwen ? App.ai.qwen.getMetrics() : {};

    _cachedStatus = {
      preferred,
      activeTier,
      webgpu,
      nano: nanoInfo,
      qwen: {
        supported: qwenSupported,
        cached: qwenCache.cached,
        cachedFiles: qwenCache.files,
        cachedBytes: qwenCache.bytes,
        approxMB: App.ai.qwen ? App.ai.qwen.approxSizeMB() : 467,
        device: qwenMetrics.device || (webgpu ? 'webgpu' : 'wasm'),
        activeDevice: qwenMetrics.device || null,
        webgpuError: qwenMetrics.webgpuError || null,
        warmedUp: Boolean(qwenMetrics.warmedUp),
      },
      checkedAt: Date.now(),
    };

    if (App.bus) App.bus.emit('ai:status', Object.assign({}, _cachedStatus));
    return Object.assign({}, _cachedStatus);
  }

  /**
   * Build a compact prompt and FACTS block for Feature A (Section 5.4).
   * Kept concise so 0.5B models start streaming quickly and fit within ~80 tokens.
   * @param {Object} facts
   * @param {{ language?: string, targetTier?: string }} [opts]
   * @returns {{ systemPrompt: string, userPrompt: string }}
   */
  function buildFeatureAPrompt(facts, opts) {
    const o = opts || {};
    const lang = o.language || (App.i18n ? App.i18n.lang() : 'zh-TW');
    const isNano = o.targetTier === 'nano';
    const wantZh = lang !== 'en' && !isNano;

    const systemPrompt = [
      'English tutor. Use ONLY FACTS. Be brief.',
      wantZh
        ? 'Reply ONLY with JSON in Traditional Chinese (keep English words in English): {"why":"1句原因","tip":"1句提示","example":null}'
        : (facts && facts.word && facts.game !== 'wall'
          ? 'Reply ONLY with JSON in simple English: {"why":"1 short sentence","tip":"1 short tip","example":"short sentence with WORD"}'
          : 'Reply ONLY with JSON in simple English: {"why":"1 short sentence","tip":"1 short tip","example":null}'),
    ].join('\n');

    const lines = ['FACTS'];
    const add = (k, v) => {
      if (v === undefined || v === null || v === '') return;
      lines.push(`${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    };

    add('game', facts.game);
    add('word', facts.word);
    add('zh', facts.meaningZh);
    add('pos', facts.pos);
    add('expected', facts.expected);
    add('answer', facts.userAnswer);
    add('error', facts.errorType);
    add('wrong_letters', facts.wrongLetters && facts.wrongLetters.length ? facts.wrongLetters : null);

    if (facts.game === 'wall') {
      add('picked', facts.selectedItems);
      add('one_away', facts.isOneAway ? '3 match, 1 does not' : 'no');
      add('skills', facts.skillsPresent);
      if (Array.isArray(facts.cardMeanings) && facts.cardMeanings.length) {
        add('meanings', facts.cardMeanings.slice(0, 3).map((m) => `${m.word}=${m.zh}`).join('; '));
      }
      if (facts.spoilerSafe) {
        add('note', 'Give a hint without revealing hidden group names.');
      } else if (facts.majorityGroup) {
        add('group', `${facts.majorityGroup.labelZh}: ${facts.majorityGroup.ruleZh}`);
        if (Array.isArray(facts.oddItems) && facts.oddItems.length) {
          add('mismatch', facts.oddItems.map((it) => `${it.item}->${it.groupLabelZh}`).join('; '));
        }
      }
    }

    return { systemPrompt, userPrompt: lines.join('\n') };
  }

  /**
   * Extract and parse the first balanced JSON object from model output text.
   * Handles markdown code fences and small models that emit trailing prose or
   * a second JSON object after the closing brace.
   * @param {string} raw
   * @returns {Object|null}
   */
  function extractJsonObject(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const direct = JSON.parse(trimmed);
      if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
    } catch (_e) { /* fall through to balanced brace scan */ }

    const start = trimmed.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            const sub = JSON.parse(trimmed.slice(start, i + 1));
            if (sub && typeof sub === 'object' && !Array.isArray(sub)) return sub;
          } catch (_e) {
            return null;
          }
          break;
        }
      }
    }

    // Salvage cleanly truncated 80-token JSON when both "why" and "tip" already started
    if (depth > 0) {
      const partial = trimmed.slice(start);
      const whyM = partial.match(/"why"\s*:\s*"((?:\\.|[^"\\])+)"/);
      const tipM = partial.match(/"tip"\s*:\s*"((?:\\.|[^"\\])+)/);
      if (whyM && tipM) {
        const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\').trim();
        const exM = partial.match(/"example"\s*:\s*"((?:\\.|[^"\\])+)"/);
        return {
          why: unesc(whyM[1]),
          tip: unesc(tipM[1]),
          example: exM ? unesc(exM[1]) : null,
        };
      }
    }
    return null;
  }

  function _truncate(str, maxChars) {
    const clean = String(str || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxChars) return clean;
    return clean.slice(0, maxChars - 1).trim() + '…';
  }

  /**
   * Validate Feature A output against Section 5.5 rules.
   * - Requires non-empty string `why` and `tip`.
   * - If `facts.word` is present, drops `example` unless it contains `word` (or a valid variant).
   * - Client-side truncation (no maxLength in prompt schema).
   * @param {string|Object} raw
   * @param {Object} facts
   * @returns {{ valid: boolean, data: { why: string, tip: string, example: string|null }|null }}
   */
  function validateFeatureAOutput(raw, facts) {
    const obj = typeof raw === 'string' ? extractJsonObject(raw) : raw;
    if (!obj || typeof obj !== 'object') return { valid: false, data: null };

    const why = typeof obj.why === 'string' ? _truncate(obj.why, 240) : '';
    const tip = typeof obj.tip === 'string' ? _truncate(obj.tip, 180) : '';
    if (!why || !tip) return { valid: false, data: null };

    let example = typeof obj.example === 'string' && obj.example.trim()
      ? _truncate(obj.example, 160)
      : null;

    if (example && facts && facts.word) {
      const target = String(facts.word).trim().toLowerCase();
      const lowerEx = example.toLowerCase();
      const variants = App.text && typeof App.text.variants === 'function'
        ? App.text.variants(target)
        : [target];
      const containsWord = variants.some((v) => {
        const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerEx);
      });
      if (!containsWord) {
        example = null;
      }
    } else if (example && (!facts || !facts.word)) {
      example = null;
    }

    return { valid: true, data: { why, tip, example } };
  }

  /**
   * Run a streaming generation with a Time-To-First-Token (TTFT) timeout only:
   * - If NO token arrives within `ttftTimeoutMs` (default 20s), aborts and throws TimeoutError.
   * - Once the first token arrives, the timeout is cleared so streaming finishes naturally
   *   (the user can still abort anytime via `externalSignal` / Stop button).
   * @param {(signal: AbortSignal, markFirstToken: () => void) => Promise<any>} promiseFactory
   * @param {number} ttftTimeoutMs
   * @param {AbortSignal} [externalSignal]
   */
  async function _runWithFirstTokenTimeout(promiseFactory, ttftTimeoutMs, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;
    let firstTokenSeen = false;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    let timer = setTimeout(() => {
      if (firstTokenSeen) return;
      timedOut = true;
      controller.abort();
    }, ttftTimeoutMs);

    function markFirstToken() {
      if (firstTokenSeen) return;
      firstTokenSeen = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    try {
      return await promiseFactory(controller.signal, markFirstToken);
    } catch (err) {
      if (timedOut) {
        const tErr = new Error('No token received before timeout');
        tErr.name = 'TimeoutError';
        throw tErr;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Warm up Qwen in the background ONLY when already cached (never auto-downloads).
   * Safe to call on game entry so the first real AI answer is fast.
   * @returns {Promise<{ warmed: boolean, device?: string|null, warmupMs?: number }>}
   */
  async function warmUpIfCached() {
    const preferred = App.store && App.store.settings
      ? App.store.settings.get('aiEngine') || 'auto'
      : 'auto';
    if (preferred === 'templates' || preferred === 'nano') return { warmed: false };
    if (!App.ai.qwen || typeof App.ai.qwen.warmUpIfCached !== 'function') return { warmed: false };
    return App.ai.qwen.warmUpIfCached();
  }

  /**
   * Feature A: Explain a learner mistake using the active/forced AI tier (Section 5.3–5.6).
   * Always returns a safe, validated `{ why, tip, example, source, device, fellBack, elapsedMs }`.
   * @param {Object} facts
   * @param {{ forceTier?: 'nano'|'qwen'|'template', signal?: AbortSignal, onProgress?: Function, onToken?: Function, onDevice?: Function, timeoutMs?: number }} [opts]
   * @returns {Promise<Object>}
   */
  async function explainMistake(facts, opts) {
    const o = opts || {};
    const timeoutMs = Number.isFinite(o.timeoutMs) ? o.timeoutMs : FIRST_TOKEN_TIMEOUT_MS;
    const status = await detect();
    const tier = o.forceTier || status.activeTier || 'template';
    const lang = App.i18n ? App.i18n.lang() : 'zh-TW';
    let genStart = performance.now();

    function fallback(note, device) {
      const tpl = App.ai.templates
        ? App.ai.templates.explainMistake(facts)
        : { why: '', tip: '', example: null };
      return {
        why: tpl.why,
        tip: tpl.tip,
        example: tpl.example,
        source: 'template',
        device: device || null,
        fellBack: tier !== 'template',
        note: note || null,
        elapsedMs: Math.max(1, Math.round(performance.now() - genStart)),
      };
    }

    if (tier === 'template') {
      return fallback(null, null);
    }

    // ── Tier 1: Gemini Nano (+ Translator) ───────────────────────
    if (tier === 'nano' && App.ai.nano) {
      const prompt = buildFeatureAPrompt(facts, { language: lang, targetTier: 'nano' });
      genStart = performance.now();
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await _runWithFirstTokenTimeout(
            (sig, markFirst) => App.ai.nano.generate({
              systemPrompt: prompt.systemPrompt,
              userPrompt: prompt.userPrompt,
              schema: FEATURE_A_SCHEMA,
              signal: sig,
              onProgress: o.onProgress,
              onToken: (chunk, full) => {
                if (chunk) markFirst();
                if (typeof o.onToken === 'function') o.onToken(chunk, full);
              },
            }),
            timeoutMs,
            o.signal
          );

          const checked = validateFeatureAOutput(res.text, facts);
          if (checked.valid) {
            let { why, tip, example } = checked.data;
            if (lang !== 'en') {
              why = await App.ai.nano.translateEnToZh(why);
              tip = await App.ai.nano.translateEnToZh(tip);
            }
            return {
              why,
              tip,
              example,
              source: 'nano',
              device: 'nano',
              fellBack: false,
              note: null,
              elapsedMs: res.elapsedMs,
            };
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return fallback('aborted', null);
          if (err && err.name === 'TimeoutError') return fallback('timeout', null);
          if (attempt === 1) return fallback('nano_error', null);
        }
      }
      return fallback('invalid_json', null);
    }

    // ── Tier 2: Qwen 2.5 0.5B Instruct (Transformers.js Blob Worker) ─
    if (tier === 'qwen' && App.ai.qwen) {
      const prompt = buildFeatureAPrompt(facts, { language: lang, targetTier: 'qwen' });
      let loadMs = 0;
      let activeDevice = null;
      try {
        // Download / cache init runs WITHOUT the TTFT timeout so first download succeeds cleanly
        const info = await App.ai.qwen.init({
          onProgress: o.onProgress,
          signal: o.signal,
        });
        loadMs = info.loadMs || 0;
        activeDevice = info.device || null;
        if (typeof o.onDevice === 'function' && activeDevice) o.onDevice(activeDevice);
      } catch (err) {
        if (err && err.name === 'AbortError') return fallback('aborted', null);
        return fallback('download_error', null);
      }

      // Reset answer timer AFTER download/init so elapsedMs reports true answer time only
      genStart = performance.now();

      // Generation uses 20s Time-To-First-Token timeout + 1 retry on invalid JSON
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await _runWithFirstTokenTimeout(
            (sig, markFirst) => App.ai.qwen.generate({
              systemPrompt: prompt.systemPrompt,
              userPrompt: attempt === 0
                ? prompt.userPrompt
                : prompt.userPrompt + '\nJSON ONLY: {"why":"...","tip":"...","example":null}',
              maxNewTokens: FEATURE_A_MAX_TOKENS,
              temperature: 0,
              signal: sig,
              onToken: (chunk, full) => {
                if (chunk) markFirst();
                if (typeof o.onToken === 'function') o.onToken(chunk, full);
              },
            }),
            timeoutMs,
            o.signal
          );

          const checked = validateFeatureAOutput(res.text, facts);
          if (checked.valid) {
            return {
              why: checked.data.why,
              tip: checked.data.tip,
              example: checked.data.example,
              source: 'qwen',
              device: res.device || activeDevice,
              fellBack: false,
              note: null,
              elapsedMs: res.elapsedMs,
              firstTokenMs: res.firstTokenMs || null,
              loadMs,
            };
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return fallback('aborted', activeDevice);
          if (err && err.name === 'TimeoutError') return fallback('timeout', activeDevice);
          if (attempt === 1) return fallback('qwen_error', activeDevice);
        }
      }
      return fallback('invalid_json', activeDevice);
    }

    return fallback('unavailable', null);
  }

  function invalidateDetection() {
    _cachedStatus = null;
  }

  async function destroyAll() {
    if (App.ai.nano) await App.ai.nano.destroy();
    if (App.ai.qwen) App.ai.qwen.destroy();
  }

  Object.assign(App.ai, {
    FIRST_TOKEN_TIMEOUT_MS,
    GENERATION_TIMEOUT_MS: FIRST_TOKEN_TIMEOUT_MS,
    FEATURE_A_MAX_TOKENS,
    FEATURE_A_SCHEMA,
    detect,
    warmUpIfCached,
    buildFeatureAPrompt,
    extractJsonObject,
    validateFeatureAOutput,
    explainMistake,
    invalidateDetection,
    destroyAll,
  });
})();
