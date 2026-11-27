/**
 * Tier 2 AI Backend: Qwen 2.5 Instruct (0.5B default / 1.5B opt-in) via Transformers.js
 * inside a classic Blob URL Worker.
 * - 100% file:// and http(s):// compatible (classic Blob Worker + jsDelivr dynamic import).
 * - WebGPU first (`navigator.gpu.requestAdapter()` -> device 'webgpu', dtype 'q4f16'),
 *   falling back to 'wasm' only on failure.
 * - Supports opt-in model selection:
 *     '0.5b' -> onnx-community/Qwen2.5-0.5B-Instruct (~467 MB, default)
 *     '1.5b' -> onnx-community/Qwen2.5-1.5B-Instruct (~1,172 MB, higher quality)
 * - Uses verified no_repeat_ngram_size: 3, temperature 0.3, max_new_tokens ~60, and
 *   InterruptableStoppingCriteria to halt immediately at the first newline or 「。」.
 * - Records per-model load time, warm-up time, TTFT, full answer time, device, and token count.
 * @namespace App.ai.qwen
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';
  const CACHE_NAME = 'transformers-cache';
  const TELEMETRY_KEY = 'as.v1.ai.telemetryByModel';

  const MODELS = {
    '0.5b': {
      key: '0.5b',
      id: 'onnx-community/Qwen2.5-0.5B-Instruct',
      label: 'Qwen 2.5 0.5B',
      approxMB: 467,
      approxBytes: Math.round(467.4 * 1024 * 1024),
    },
    '1.5b': {
      key: '1.5b',
      id: 'onnx-community/Qwen2.5-1.5B-Instruct',
      label: 'Qwen 2.5 1.5B',
      approxMB: 1172,
      approxBytes: Math.round(1172.0 * 1024 * 1024),
    },
  };

  let _worker = null;
  let _workerModelKey = null;
  let _reqSeq = 0;
  let _initPromise = null;
  let _warmupPromise = null;
  const _pending = new Map();

  function _emptyModelMetrics(key) {
    const cfg = MODELS[key] || MODELS['0.5b'];
    return {
      modelKey: cfg.key,
      modelId: cfg.id,
      modelLabel: cfg.label,
      device: null,
      dtype: null,
      webgpuError: null,
      approxMB: cfg.approxMB,
      loadedBytes: 0,
      totalBytes: 0,
      loadMs: null,
      warmupMs: null,
      warmedUp: false,
      lastFirstTokenMs: null,
      lastAnswerMs: null,
      lastTokenCount: null,
      tokensPerSec: null,
      hadCacheBefore: false,
      cachedFiles: 0,
      ready: false,
    };
  }

  const _metricsByModel = {
    '0.5b': _emptyModelMetrics('0.5b'),
    '1.5b': _emptyModelMetrics('1.5b'),
  };

  function getSelectedModelKey() {
    const raw = App.store && App.store.settings ? App.store.settings.get('qwenModel') : '0.5b';
    return MODELS[raw] ? raw : '0.5b';
  }

  function getSelectedModel(keyOverride) {
    const k = keyOverride && MODELS[keyOverride] ? keyOverride : getSelectedModelKey();
    return MODELS[k];
  }

  function _persistTelemetry() {
    if (!App.store || !App.store.db) return;
    const payload = {};
    for (const k of Object.keys(MODELS)) {
      const m = _metricsByModel[k];
      payload[k] = {
        device: m.device,
        dtype: m.dtype,
        webgpuError: m.webgpuError,
        loadMs: m.loadMs,
        warmupMs: m.warmupMs,
        lastFirstTokenMs: m.lastFirstTokenMs,
        lastAnswerMs: m.lastAnswerMs,
        lastTokenCount: m.lastTokenCount,
        tokensPerSec: m.tokensPerSec,
      };
    }
    App.store.db.set(TELEMETRY_KEY, payload);
  }

  function _hydrateTelemetry() {
    if (!App.store || !App.store.db) return;
    const saved = App.store.db.get(TELEMETRY_KEY, null);
    if (!saved || typeof saved !== 'object') return;
    for (const k of Object.keys(MODELS)) {
      const s = saved[k];
      const m = _metricsByModel[k];
      if (!s || typeof s !== 'object') continue;
      if (m.device === null && s.device) m.device = s.device;
      if (m.dtype === null && s.dtype) m.dtype = s.dtype;
      if (m.webgpuError === null && s.webgpuError) m.webgpuError = s.webgpuError;
      if (m.loadMs === null && s.loadMs != null) m.loadMs = s.loadMs;
      if (m.warmupMs === null && s.warmupMs != null) m.warmupMs = s.warmupMs;
      if (m.lastFirstTokenMs === null && s.lastFirstTokenMs != null) m.lastFirstTokenMs = s.lastFirstTokenMs;
      if (m.lastAnswerMs === null && s.lastAnswerMs != null) m.lastAnswerMs = s.lastAnswerMs;
      if (m.lastTokenCount === null && s.lastTokenCount != null) m.lastTokenCount = s.lastTokenCount;
      if (m.tokensPerSec === null && s.tokensPerSec != null) m.tokensPerSec = s.tokensPerSec;
    }
  }

  function isSupported() {
    return typeof window !== 'undefined' && typeof window.Worker !== 'undefined' && typeof window.Blob !== 'undefined';
  }

  function approxSizeMB(keyOverride) {
    return getSelectedModel(keyOverride).approxMB;
  }

  function _buildWorkerSource(modelCfg) {
    return `
      let generator = null;
      let TextStreamerCls = null;
      let InterruptableStoppingCriteriaCls = null;
      let StoppingCriteriaListCls = null;
      let activeDevice = null;
      let activeDtype = null;
      let webgpuError = null;
      const CDN_URL = ${JSON.stringify(TRANSFORMERS_CDN)};
      const MODEL = ${JSON.stringify(modelCfg.id)};
      const CACHE_NAME = ${JSON.stringify(CACHE_NAME)};
      const APPROX_TOTAL = ${modelCfg.approxBytes};

      self.onmessage = async (ev) => {
        const { id, type, payload } = ev.data || {};
        try {
          if (type === 'init') {
            if (generator) {
              self.postMessage({
                id,
                type: 'result',
                data: {
                  elapsedMs: 0,
                  device: activeDevice,
                  dtype: activeDtype,
                  webgpuError,
                  hadCacheBefore: true,
                  cachedFiles: 0,
                  totalBytes: 0,
                },
              });
              return;
            }

            const t0 = performance.now();
            const fileSizes = new Map();
            let cachedBefore = [];
            try {
              if (self.caches) {
                const c = await self.caches.open(CACHE_NAME);
                cachedBefore = (await c.keys()).map((r) => r.url);
              }
            } catch (_e) {}

            const mod = await import(CDN_URL);
            const { pipeline, env, TextStreamer, InterruptableStoppingCriteria, StoppingCriteriaList } = mod;
            TextStreamerCls = TextStreamer;
            InterruptableStoppingCriteriaCls = InterruptableStoppingCriteria || null;
            StoppingCriteriaListCls = StoppingCriteriaList || null;
            env.allowLocalModels = false;

            let hasWebGPU = false;
            if (typeof self.navigator !== 'undefined' && self.navigator.gpu) {
              try {
                const adapter = await self.navigator.gpu.requestAdapter();
                hasWebGPU = Boolean(adapter);
              } catch (e) {
                webgpuError = e && e.message ? e.message : String(e);
              }
            }

            const isLargeModel = ${JSON.stringify(modelCfg.key === '1.5b')};
            // 1.5B (1.17 GB single ONNX file) OOMs in 32-bit WASM; require WebGPU without WASM fallback
            const plans = isLargeModel
              ? (hasWebGPU ? [{ device: 'webgpu', dtype: 'q4f16' }] : [])
              : (hasWebGPU
                ? [{ device: 'webgpu', dtype: 'q4f16' }, { device: 'wasm', dtype: 'q4f16' }]
                : [{ device: 'wasm', dtype: 'q4f16' }]);

            if (!plans.length) {
              throw new Error('WebGPU unavailable for 1.5B model (WASM memory insufficient)');
            }

            const onProgress = (p) => {
              if (!p || !p.file) return;
              if (p.status === 'progress' || p.status === 'download' || p.status === 'done') {
                const prev = fileSizes.get(p.file) || { loaded: 0, total: 0 };
                const total = p.total || prev.total || 0;
                const loaded = p.status === 'done' ? (total || prev.loaded) : (p.loaded || prev.loaded);
                fileSizes.set(p.file, { loaded, total });
                let sumLoaded = 0;
                let sumTotal = 0;
                for (const entry of fileSizes.values()) {
                  sumLoaded += entry.loaded;
                  sumTotal += entry.total;
                }
                const effectiveTotal = sumTotal >= sumLoaded && sumTotal > 10 * 1024 * 1024
                  ? sumTotal
                  : Math.max(APPROX_TOTAL, sumLoaded);
                self.postMessage({
                  id,
                  type: 'progress',
                  file: p.file,
                  loaded: sumLoaded,
                  total: effectiveTotal,
                });
              }
            };

            let lastErr = null;
            for (const plan of plans) {
              try {
                generator = await pipeline('text-generation', MODEL, {
                  device: plan.device,
                  dtype: plan.dtype,
                  progress_callback: onProgress,
                });
                activeDevice = plan.device;
                activeDtype = plan.dtype;
                break;
              } catch (err) {
                lastErr = err;
                if (plan.device === 'webgpu') {
                  webgpuError = err && err.message ? err.message : String(err);
                }
                generator = null;
              }
            }
            if (!generator) {
              throw lastErr || new Error('Unable to initialize Qwen 2.5 pipeline');
            }

            let cachedCount = 0;
            let totalBytes = 0;
            try {
              if (self.caches) {
                const c = await self.caches.open(CACHE_NAME);
                const keys = (await c.keys()).filter((r) => r.url.includes(MODEL));
                cachedCount = keys.length;
                for (const req of keys) {
                  const resp = await c.match(req);
                  if (resp) totalBytes += (await resp.clone().arrayBuffer()).byteLength;
                }
              }
            } catch (_e) {}

            self.postMessage({
              id,
              type: 'result',
              data: {
                elapsedMs: Math.round(performance.now() - t0),
                device: activeDevice,
                dtype: activeDtype,
                webgpuError,
                hadCacheBefore: cachedBefore.some((u) => u.includes(MODEL)),
                cachedFiles: cachedCount,
                totalBytes,
              },
            });
            return;
          }

          if (type === 'warmup') {
            if (!generator) throw new Error('Qwen model not initialized');
            const t0 = performance.now();
            await generator(
              [{ role: 'user', content: 'Hi' }],
              { max_new_tokens: 1, do_sample: false, return_full_text: false }
            );
            self.postMessage({
              id,
              type: 'result',
              data: { elapsedMs: Math.round(performance.now() - t0), device: activeDevice },
            });
            return;
          }

          if (type === 'generate') {
            if (!generator) throw new Error('Qwen model not initialized');
            const t0 = performance.now();
            const messages = Array.isArray(payload.messages) && payload.messages.length
              ? payload.messages
              : [
                { role: 'system', content: payload.systemPrompt || '' },
                { role: 'user', content: payload.userPrompt || '' },
              ];
            let tokenCount = 0;
            let firstTokenMs = null;
            let streamed = '';
            let interruptedEarly = false;

            const stopOnSentence = payload.stopOnSentence !== false;
            const interruptCriteria = (stopOnSentence && InterruptableStoppingCriteriaCls)
              ? new InterruptableStoppingCriteriaCls()
              : null;
            let stoppingCriteria = undefined;
            if (interruptCriteria && StoppingCriteriaListCls) {
              const list = new StoppingCriteriaListCls();
              list.push(interruptCriteria);
              stoppingCriteria = list;
            } else if (interruptCriteria) {
              stoppingCriteria = [interruptCriteria];
            }

            const streamer = TextStreamerCls
              ? new TextStreamerCls(generator.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (chunk) => {
                  if (!chunk || interruptedEarly) return;
                  tokenCount++;
                  if (firstTokenMs === null) {
                    firstTokenMs = Math.max(1, Math.round(performance.now() - t0));
                  }
                  streamed += chunk;
                  self.postMessage({ id, type: 'token', chunk, full: streamed, firstTokenMs });
                  if (interruptCriteria && streamed.trim().length >= 6 && /[。\\n]/.test(streamed)) {
                    interruptedEarly = true;
                    interruptCriteria.interrupt();
                  }
                },
              })
              : undefined;

            const useSample = typeof payload.temperature === 'number' && payload.temperature > 0;
            const genOpts = {
              max_new_tokens: payload.maxNewTokens || 60,
              do_sample: useSample,
              no_repeat_ngram_size: payload.noRepeatNgramSize || 3,
              return_full_text: false,
              streamer,
            };
            if (stoppingCriteria) genOpts.stopping_criteria = stoppingCriteria;
            if (useSample) {
              genOpts.temperature = payload.temperature;
              genOpts.top_p = payload.topP || 0.9;
            }

            const out = await generator(messages, genOpts);
            const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
            let text = streamed;
            if (!text && Array.isArray(out) && out[0] && out[0].generated_text) {
              const gt = out[0].generated_text;
              text = typeof gt === 'string'
                ? gt
                : (Array.isArray(gt) && gt.length ? String(gt[gt.length - 1].content || '') : '');
            }
            if (firstTokenMs === null) firstTokenMs = elapsedMs;
            const tps = tokenCount > 0 ? Number((tokenCount / (elapsedMs / 1000)).toFixed(1)) : null;

            self.postMessage({
              id,
              type: 'result',
              data: {
                text,
                elapsedMs,
                firstTokenMs,
                tokensPerSec: tps,
                tokenCount,
                device: activeDevice,
              },
            });
          }
        } catch (err) {
          self.postMessage({
            id,
            type: 'error',
            error: err && err.message ? err.message : String(err),
          });
        }
      };
    `;
  }

  function _ensureWorker(modelKey) {
    const cfg = getSelectedModel(modelKey);
    // Keep only one model in memory at a time (Section 5.6)
    if (_worker && _workerModelKey !== cfg.key) {
      destroy();
    }
    if (_worker) return _worker;

    const blob = new Blob([_buildWorkerSource(cfg)], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    _worker = new Worker(blobUrl);
    _workerModelKey = cfg.key;
    URL.revokeObjectURL(blobUrl);

    _worker.onmessage = function (ev) {
      const msg = ev.data || {};
      const entry = _pending.get(msg.id);
      if (!entry) return;
      const m = _metricsByModel[_workerModelKey] || _metricsByModel['0.5b'];
      if (msg.type === 'progress') {
        m.loadedBytes = msg.loaded || 0;
        m.totalBytes = msg.total || m.totalBytes;
        if (entry.onProgress) entry.onProgress(msg);
        return;
      }
      if (msg.type === 'token') {
        if (msg.firstTokenMs && m.lastFirstTokenMs === null) {
          m.lastFirstTokenMs = msg.firstTokenMs;
        }
        if (entry.onToken) entry.onToken(msg.chunk, msg.full, msg.firstTokenMs);
        return;
      }
      _pending.delete(msg.id);
      if (msg.type === 'error') {
        entry.reject(new Error(msg.error || 'Qwen worker error'));
      } else {
        entry.resolve(msg.data);
      }
    };

    _worker.onerror = function (ev) {
      const err = new Error((ev && ev.message) || 'Qwen Blob Worker failed');
      for (const entry of _pending.values()) entry.reject(err);
      _pending.clear();
      if (_workerModelKey && _metricsByModel[_workerModelKey]) {
        _metricsByModel[_workerModelKey].ready = false;
        _metricsByModel[_workerModelKey].warmedUp = false;
      }
      _worker = null;
      _workerModelKey = null;
      _initPromise = null;
      _warmupPromise = null;
    };

    return _worker;
  }

  function _callWorker(type, payload, opts) {
    const o = opts || {};
    if (o.signal && o.signal.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      return Promise.reject(abortErr);
    }

    const w = _ensureWorker(o.modelKey);
    const id = ++_reqSeq;

    return new Promise(function (resolve, reject) {
      let onAbort = null;
      const cleanup = () => {
        if (o.signal && onAbort) {
          o.signal.removeEventListener('abort', onAbort);
        }
      };

      onAbort = () => {
        _pending.delete(id);
        cleanup();
        destroy();
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        reject(abortErr);
      };

      if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });

      _pending.set(id, {
        resolve: (data) => { cleanup(); resolve(data); },
        reject: (err) => { cleanup(); reject(err); },
        onProgress: o.onProgress || null,
        onToken: o.onToken || null,
      });
      w.postMessage({ id, type, payload });
    });
  }

  /**
   * Check whether a specific (or active) Qwen model is cached in Cache Storage.
   * @param {string} [modelKey]
   * @returns {Promise<{ cached: boolean, files: number, bytes: number, modelKey: string, modelId: string }>}
   */
  async function inspectCache(modelKey) {
    const cfg = getSelectedModel(modelKey);
    const m = _metricsByModel[cfg.key];
    if (typeof window === 'undefined' || !window.caches) {
      return { cached: false, files: 0, bytes: 0, modelKey: cfg.key, modelId: cfg.id };
    }
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const keys = (await cache.keys()).filter((r) => r.url.includes(cfg.id));
      let bytes = 0;
      for (const req of keys) {
        const resp = await cache.match(req);
        if (resp) bytes += (await resp.clone().arrayBuffer()).byteLength;
      }
      m.cachedFiles = keys.length;
      if (bytes > 0) m.totalBytes = bytes;
      return { cached: keys.length > 0, files: keys.length, bytes, modelKey: cfg.key, modelId: cfg.id };
    } catch (_e) {
      return { cached: false, files: 0, bytes: 0, modelKey: cfg.key, modelId: cfg.id };
    }
  }

  /**
   * Initialize (download or load from cache) the selected Qwen model.
   * @param {{ modelKey?: string, onProgress?: Function, signal?: AbortSignal }} [opts]
   * @returns {Promise<Object>}
   */
  async function init(opts) {
    const o = opts || {};
    if (!isSupported()) throw new Error('Web Workers are unavailable in this browser');
    const cfg = getSelectedModel(o.modelKey);
    const m = _metricsByModel[cfg.key];

    if (_worker && _workerModelKey !== cfg.key) {
      destroy();
    }
    if (m.ready && _worker && _workerModelKey === cfg.key) {
      return Object.assign({}, m);
    }
    if (_initPromise && _workerModelKey === cfg.key) return _initPromise;

    _initPromise = _callWorker('init', null, Object.assign({}, o, { modelKey: cfg.key })).then(function (data) {
      m.ready = true;
      m.device = data.device || m.device;
      m.dtype = data.dtype || m.dtype;
      m.webgpuError = data.webgpuError || null;
      m.loadMs = data.elapsedMs;
      m.hadCacheBefore = Boolean(data.hadCacheBefore);
      if (data.cachedFiles) m.cachedFiles = data.cachedFiles;
      if (data.totalBytes) m.totalBytes = data.totalBytes;

      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(function () {});
      }
      _persistTelemetry();
      return Object.assign({}, m);
    }).catch(function (err) {
      _initPromise = null;
      m.ready = false;
      throw err;
    });

    return _initPromise;
  }

  /**
   * Warm up the currently selected Qwen model ONLY if it is already cached (never auto-downloads).
   * @returns {Promise<{ warmed: boolean, modelKey?: string, device?: string|null, warmupMs?: number }>}
   */
  async function warmUpIfCached() {
    if (!isSupported()) return { warmed: false };
    const cfg = getSelectedModel();
    const m = _metricsByModel[cfg.key];
    if (m.warmedUp && _worker && _workerModelKey === cfg.key) {
      return { warmed: true, modelKey: cfg.key, device: m.device, warmupMs: m.warmupMs };
    }
    if (_warmupPromise) return _warmupPromise;

    _warmupPromise = (async function () {
      const cache = await inspectCache(cfg.key);
      if (!cache.cached) return { warmed: false };
      await init({ modelKey: cfg.key });
      const res = await _callWorker('warmup', null, { modelKey: cfg.key });
      m.warmedUp = true;
      m.warmupMs = res.elapsedMs;
      _persistTelemetry();
      return { warmed: true, modelKey: cfg.key, device: m.device, warmupMs: res.elapsedMs };
    })().catch(function () {
      _warmupPromise = null;
      return { warmed: false };
    });

    return _warmupPromise;
  }

  /**
   * Run text generation in the Qwen Blob Worker.
   * @param {{ messages?: Array, systemPrompt?: string, userPrompt?: string, maxNewTokens?: number, temperature?: number, topP?: number, noRepeatNgramSize?: number, stopOnSentence?: boolean, modelKey?: string, onProgress?: Function, onToken?: Function, signal?: AbortSignal }} opts
   */
  async function generate(opts) {
    const o = opts || {};
    const cfg = getSelectedModel(o.modelKey);
    const m = _metricsByModel[cfg.key];

    if (_warmupPromise) {
      await _warmupPromise.catch(function () {});
    }
    const info = await init({ modelKey: cfg.key, onProgress: o.onProgress, signal: o.signal });
    const res = await _callWorker('generate', {
      messages: Array.isArray(o.messages) ? o.messages : null,
      systemPrompt: o.systemPrompt || '',
      userPrompt: o.userPrompt || '',
      maxNewTokens: o.maxNewTokens || 60,
      temperature: typeof o.temperature === 'number' ? o.temperature : 0.3,
      topP: typeof o.topP === 'number' ? o.topP : 0.9,
      noRepeatNgramSize: o.noRepeatNgramSize || 3,
      stopOnSentence: o.stopOnSentence !== false,
    }, { modelKey: cfg.key, onToken: o.onToken, signal: o.signal });

    m.lastFirstTokenMs = res.firstTokenMs;
    m.lastAnswerMs = res.elapsedMs;
    m.lastTokenCount = res.tokenCount || null;
    m.tokensPerSec = res.tokensPerSec;
    if (res.device) m.device = res.device;
    _persistTelemetry();

    return {
      text: res.text,
      elapsedMs: res.elapsedMs,
      firstTokenMs: res.firstTokenMs,
      tokenCount: res.tokenCount || 0,
      loadMs: info.loadMs || 0,
      tokensPerSec: res.tokensPerSec,
      device: m.device,
      modelKey: cfg.key,
      modelLabel: cfg.label,
    };
  }

  function getMetrics(keyOverride) {
    _hydrateTelemetry();
    const k = keyOverride && MODELS[keyOverride] ? keyOverride : getSelectedModelKey();
    return Object.assign({}, _metricsByModel[k]);
  }

  function getAllMetrics() {
    _hydrateTelemetry();
    return {
      '0.5b': Object.assign({}, _metricsByModel['0.5b']),
      '1.5b': Object.assign({}, _metricsByModel['1.5b']),
    };
  }

  async function clearCache() {
    destroy();
    if (typeof window === 'undefined' || !window.caches) return;
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        if (req.url.includes(MODELS['0.5b'].id) || req.url.includes(MODELS['1.5b'].id)) {
          await cache.delete(req);
        }
      }
      for (const k of Object.keys(MODELS)) {
        _metricsByModel[k] = _emptyModelMetrics(k);
      }
      if (App.store && App.store.db) App.store.db.remove(TELEMETRY_KEY);
    } catch (_e) { /* ignore */ }
  }

  function destroy() {
    if (_worker) {
      try { _worker.terminate(); } catch (_e) { /* ignore */ }
      _worker = null;
    }
    if (_workerModelKey && _metricsByModel[_workerModelKey]) {
      _metricsByModel[_workerModelKey].ready = false;
      _metricsByModel[_workerModelKey].warmedUp = false;
    }
    _workerModelKey = null;
    _initPromise = null;
    _warmupPromise = null;
    for (const entry of _pending.values()) {
      const err = new Error('Worker terminated');
      err.name = 'AbortError';
      entry.reject(err);
    }
    _pending.clear();
  }

  App.ai.qwen = {
    MODELS,
    MODEL_ID: MODELS['0.5b'].id,
    TRANSFORMERS_CDN,
    getSelectedModelKey,
    getSelectedModel,
    isSupported,
    approxSizeMB,
    inspectCache,
    init,
    warmUpIfCached,
    generate,
    getMetrics,
    getAllMetrics,
    clearCache,
    destroy,
  };
})();
