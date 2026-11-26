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

  const GENERATION_TIMEOUT_MS = 20000;

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
      },
      checkedAt: Date.now(),
    };

    if (App.bus) App.bus.emit('ai:status', Object.assign({}, _cachedStatus));
    return Object.assign({}, _cachedStatus);
  }

  /**
   * Build the English system prompt and delimited FACTS block for Feature A (Section 5.4).
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
      'You are a patient English tutor for Taiwanese university students (2000-word level).',
      'Use ONLY the information in FACTS. Do not invent new meanings, rules, or answers.',
      'Explain why the attempt was wrong in 1-2 short sentences ("why").',
      'Give one practical memory tip ("tip").',
      facts && facts.word
        ? 'Give one short natural English example sentence containing the exact WORD ("example"), or null if not applicable.'
        : 'Set "example" to null.',
      wantZh
        ? 'Write "why" and "tip" in natural Traditional Chinese (zh-Hant). Keep English words in English.'
        : 'Write "why" and "tip" in clear, simple English.',
      'Return ONLY a valid JSON object: {"why":"...","tip":"...","example":null}. No markdown.',
    ].join('\n');

    const lines = ['FACTS'];
    const add = (k, v) => {
      if (v === undefined || v === null || v === '') return;
      lines.push(`${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    };

    add('game', facts.game);
    add('word', facts.word);
    add('meaning_zh', facts.meaningZh);
    add('pos', facts.pos);
    add('expected', facts.expected);
    add('user_answer', facts.userAnswer);
    add('error_type', facts.errorType);
    add('wrong_letters', facts.wrongLetters && facts.wrongLetters.length ? facts.wrongLetters : null);

    if (facts.game === 'wall') {
      add('selected_items', facts.selectedItems);
      add('one_away', facts.isOneAway ? 'yes (3 of 4 items belong together, 1 is different)' : 'no');
      add('distinct_groups_mixed', facts.distinctGroupCount);
      add('skills_mixed', facts.skillsPresent);
      if (Array.isArray(facts.cardMeanings) && facts.cardMeanings.length) {
        add('known_meanings', facts.cardMeanings.map((m) => `${m.word}=${m.zh}`).join('; '));
      }
      if (facts.spoilerSafe) {
        add('spoiler_rule', 'Do NOT reveal the hidden group names or full answer key; only guide the learner to spot the mismatch.');
      } else if (facts.majorityGroup) {
        add('majority_group', `${facts.majorityGroup.label} (${facts.majorityGroup.labelZh}): ${facts.majorityGroup.ruleZh}`);
        if (Array.isArray(facts.oddItems) && facts.oddItems.length) {
          add('other_items', facts.oddItems.map((it) => `${it.item} belongs to ${it.groupLabel} (${it.groupLabelZh})`).join('; '));
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

  async function _runWithTimeout(promiseFactory, timeoutMs, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await promiseFactory(controller.signal);
    } catch (err) {
      if (timedOut) {
        const tErr = new Error('AI generation timed out');
        tErr.name = 'TimeoutError';
        throw tErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Feature A: Explain a learner mistake using the active/forced AI tier (Section 5.3–5.6).
   * Always returns a safe, validated `{ why, tip, example, source, fellBack, elapsedMs }`.
   * @param {Object} facts
   * @param {{ forceTier?: 'nano'|'qwen'|'template', signal?: AbortSignal, onProgress?: Function, onToken?: Function, timeoutMs?: number }} [opts]
   * @returns {Promise<{ why: string, tip: string, example: string|null, source: 'nano'|'qwen'|'template', fellBack: boolean, note: string|null, elapsedMs: number, loadMs?: number }>}
   */
  async function explainMistake(facts, opts) {
    const o = opts || {};
    const t0 = performance.now();
    const timeoutMs = Number.isFinite(o.timeoutMs) ? o.timeoutMs : GENERATION_TIMEOUT_MS;
    const status = await detect();
    const tier = o.forceTier || status.activeTier || 'template';
    const lang = App.i18n ? App.i18n.lang() : 'zh-TW';

    function fallback(note) {
      const tpl = App.ai.templates
        ? App.ai.templates.explainMistake(facts)
        : { why: '', tip: '', example: null };
      return {
        why: tpl.why,
        tip: tpl.tip,
        example: tpl.example,
        source: 'template',
        fellBack: tier !== 'template',
        note: note || null,
        elapsedMs: Math.round(performance.now() - t0),
      };
    }

    if (tier === 'template') {
      return fallback(null);
    }

    // ── Tier 1: Gemini Nano (+ Translator) ───────────────────────
    if (tier === 'nano' && App.ai.nano) {
      const prompt = buildFeatureAPrompt(facts, { language: lang, targetTier: 'nano' });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await _runWithTimeout(
            (sig) => App.ai.nano.generate({
              systemPrompt: prompt.systemPrompt,
              userPrompt: prompt.userPrompt,
              schema: FEATURE_A_SCHEMA,
              signal: sig,
              onProgress: o.onProgress,
              onToken: o.onToken,
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
              fellBack: false,
              note: null,
              elapsedMs: res.elapsedMs,
            };
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return fallback('aborted');
          if (err && err.name === 'TimeoutError') return fallback('timeout');
          if (attempt === 1) return fallback('nano_error');
        }
      }
      return fallback('invalid_json');
    }

    // ── Tier 2: Qwen 2.5 0.5B Instruct (Transformers.js Blob Worker) ─
    if (tier === 'qwen' && App.ai.qwen) {
      const prompt = buildFeatureAPrompt(facts, { language: lang, targetTier: 'qwen' });
      let loadMs = 0;
      try {
        // Download / cache init runs WITHOUT the 20s generation timeout so first download succeeds cleanly
        const info = await App.ai.qwen.init({
          onProgress: o.onProgress,
          signal: o.signal,
        });
        loadMs = info.loadMs || 0;
      } catch (err) {
        if (err && err.name === 'AbortError') return fallback('aborted');
        return fallback('download_error');
      }

      // Generation runs with 20s timeout + 1 retry on invalid JSON (Section 5.4 & 5.6)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await _runWithTimeout(
            (sig) => App.ai.qwen.generate({
              systemPrompt: prompt.systemPrompt,
              userPrompt: attempt === 0
                ? prompt.userPrompt
                : prompt.userPrompt + '\nRemember: output ONLY valid JSON {"why":"...","tip":"...","example":null}.',
              maxNewTokens: 130,
              temperature: 0,
              signal: sig,
              onToken: o.onToken,
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
              fellBack: false,
              note: null,
              elapsedMs: res.elapsedMs,
              loadMs,
            };
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return fallback('aborted');
          if (err && err.name === 'TimeoutError') return fallback('timeout');
          if (attempt === 1) return fallback('qwen_error');
        }
      }
      return fallback('invalid_json');
    }

    return fallback('unavailable');
  }

  function invalidateDetection() {
    _cachedStatus = null;
  }

  async function destroyAll() {
    if (App.ai.nano) await App.ai.nano.destroy();
    if (App.ai.qwen) App.ai.qwen.destroy();
  }

  Object.assign(App.ai, {
    GENERATION_TIMEOUT_MS,
    FEATURE_A_SCHEMA,
    detect,
    buildFeatureAPrompt,
    extractJsonObject,
    validateFeatureAOutput,
    explainMistake,
    invalidateDetection,
    destroyAll,
  });
})();
