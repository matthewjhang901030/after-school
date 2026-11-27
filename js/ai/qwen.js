/**
 * Tier 2 AI Backend: Qwen 2.5 0.5B Instruct via Transformers.js inside a classic Blob URL Worker.
 * - 100% file:// and http(s):// compatible (classic Blob Worker + jsDelivr dynamic import).
 * - WebGPU first: checks navigator.gpu + requestAdapter() inside the worker and uses
 *   device: 'webgpu' (dtype 'q4f16', ~467 MB), falling back to 'wasm' only if WebGPU fails.
 * - Reports exact download progress in MB, streams tokens live via TextStreamer,
 *   measures first-token latency (TTFT) + full answer time, supports background warm-up
 *   when already cached (never auto-downloads), caches in Cache Storage ("transformers-cache"),
 *   and supports immediate cancellation via AbortController.
 * @namespace App.ai.qwen
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';
  const CACHE_NAME = 'transformers-cache';
  const APPROX_MB_Q4F16 = 467;
  const APPROX_BYTES_Q4F16 = Math.round(467.4 * 1024 * 1024);

  let _worker = null;
  let _reqSeq = 0;
  let _initPromise = null;
  let _warmupPromise = null;
  const _pending = new Map();

  const _metrics = {
    modelId: MODEL_ID,
    device: null,          // 'webgpu' | 'wasm' | null
    dtype: null,           // 'q4f16' | 'q4' | null
    webgpuError: null,     // non-null if WebGPU failed and fell back to WASM
    approxMB: APPROX_MB_Q4F16,
    loadedBytes: 0,
    totalBytes: 0,
    loadMs: null,
    warmupMs: null,
    warmedUp: false,
    lastFirstTokenMs: null,
    lastAnswerMs: null,
    tokensPerSec: null,
    hadCacheBefore: false,
    cachedFiles: 0,
    ready: false,
  };

  function isSupported() {
    return typeof window !== 'undefined' && typeof window.Worker !== 'undefined' && typeof window.Blob !== 'undefined';
  }

  function approxSizeMB() {
    return APPROX_MB_Q4F16;
  }

  function _buildWorkerSource() {
    return `
      let generator = null;
      let TextStreamerCls = null;
      let activeDevice = null;
      let activeDtype = null;
      let webgpuError = null;
      const CDN_URL = ${JSON.stringify(TRANSFORMERS_CDN)};
      const MODEL = ${JSON.stringify(MODEL_ID)};
      const CACHE_NAME = ${JSON.stringify(CACHE_NAME)};
      const APPROX_TOTAL = ${APPROX_BYTES_Q4F16};

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
            const { pipeline, env, TextStreamer } = mod;
            TextStreamerCls = TextStreamer;
            env.allowLocalModels = false;

            // Verify real WebGPU adapter availability inside the worker
            let hasWebGPU = false;
            if (typeof self.navigator !== 'undefined' && self.navigator.gpu) {
              try {
                const adapter = await self.navigator.gpu.requestAdapter();
                hasWebGPU = Boolean(adapter);
              } catch (e) {
                webgpuError = e && e.message ? e.message : String(e);
              }
            }

            const plans = hasWebGPU
              ? [
                { device: 'webgpu', dtype: 'q4f16' },
                { device: 'wasm', dtype: 'q4f16' },
              ]
              : [{ device: 'wasm', dtype: 'q4f16' }];

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
            const messages = [
              { role: 'system', content: payload.systemPrompt },
              { role: 'user', content: payload.userPrompt },
            ];
            let tokenCount = 0;
            let firstTokenMs = null;
            let streamed = '';
            const streamer = TextStreamerCls
              ? new TextStreamerCls(generator.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (chunk) => {
                  if (!chunk) return;
                  tokenCount++;
                  if (firstTokenMs === null) {
                    firstTokenMs = Math.max(1, Math.round(performance.now() - t0));
                  }
                  streamed += chunk;
                  self.postMessage({ id, type: 'token', chunk, full: streamed, firstTokenMs });
                },
              })
              : undefined;

            const out = await generator(messages, {
              max_new_tokens: payload.maxNewTokens || 80,
              do_sample: Boolean(payload.temperature && payload.temperature > 0),
              temperature: payload.temperature || 0.1,
              return_full_text: false,
              streamer,
            });

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

  function _ensureWorker() {
    if (_worker) return _worker;
    const blob = new Blob([_buildWorkerSource()], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    _worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);

    _worker.onmessage = function (ev) {
      const msg = ev.data || {};
      const entry = _pending.get(msg.id);
      if (!entry) return;
      if (msg.type === 'progress') {
        _metrics.loadedBytes = msg.loaded || 0;
        _metrics.totalBytes = msg.total || _metrics.totalBytes;
        if (entry.onProgress) entry.onProgress(msg);
        return;
      }
      if (msg.type === 'token') {
        if (msg.firstTokenMs && _metrics.lastFirstTokenMs === null) {
          _metrics.lastFirstTokenMs = msg.firstTokenMs;
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
      _worker = null;
      _initPromise = null;
      _warmupPromise = null;
      _metrics.ready = false;
      _metrics.warmedUp = false;
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

    const w = _ensureWorker();
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
        // Terminate worker immediately so WebGPU/WASM generation stops right away
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
   * Check whether Qwen model files are already cached in Cache Storage.
   * @returns {Promise<{ cached: boolean, files: number, bytes: number }>}
   */
  async function inspectCache() {
    if (typeof window === 'undefined' || !window.caches) {
      return { cached: false, files: 0, bytes: 0 };
    }
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const keys = (await cache.keys()).filter((r) => r.url.includes(MODEL_ID));
      let bytes = 0;
      for (const req of keys) {
        const resp = await cache.match(req);
        if (resp) bytes += (await resp.clone().arrayBuffer()).byteLength;
      }
      _metrics.cachedFiles = keys.length;
      if (bytes > 0) _metrics.totalBytes = bytes;
      return { cached: keys.length > 0, files: keys.length, bytes };
    } catch (_e) {
      return { cached: false, files: 0, bytes: 0 };
    }
  }

  /**
   * Initialize (download/load from cache) Qwen 2.5 0.5B Instruct.
   * @param {{ onProgress?: (p: Object) => void, signal?: AbortSignal }} [opts]
   * @returns {Promise<Object>}
   */
  async function init(opts) {
    if (!isSupported()) throw new Error('Web Workers are unavailable in this browser');
    if (_metrics.ready && _worker) return Object.assign({}, _metrics);
    if (_initPromise) return _initPromise;

    _metrics.approxMB = approxSizeMB();
    _initPromise = _callWorker('init', null, opts).then(function (data) {
      _metrics.ready = true;
      _metrics.device = data.device || _metrics.device;
      _metrics.dtype = data.dtype || _metrics.dtype;
      _metrics.webgpuError = data.webgpuError || null;
      _metrics.loadMs = data.elapsedMs;
      _metrics.hadCacheBefore = Boolean(data.hadCacheBefore);
      if (data.cachedFiles) _metrics.cachedFiles = data.cachedFiles;
      if (data.totalBytes) _metrics.totalBytes = data.totalBytes;

      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(function () {});
      }
      return Object.assign({}, _metrics);
    }).catch(function (err) {
      _initPromise = null;
      _metrics.ready = false;
      throw err;
    });

    return _initPromise;
  }

  /**
   * Warm up Qwen in the background ONLY if the model is already cached (never auto-downloads).
   * Compiles WebGPU shaders / WASM kernels with a tiny 1-token generation so the first real answer is fast.
   * @returns {Promise<{ warmed: boolean, device?: string|null, warmupMs?: number }>}
   */
  async function warmUpIfCached() {
    if (!isSupported()) return { warmed: false };
    if (_metrics.warmedUp && _worker) {
      return { warmed: true, device: _metrics.device, warmupMs: _metrics.warmupMs };
    }
    if (_warmupPromise) return _warmupPromise;

    _warmupPromise = (async function () {
      const cache = await inspectCache();
      if (!cache.cached) return { warmed: false };
      await init();
      const res = await _callWorker('warmup', null, {});
      _metrics.warmedUp = true;
      _metrics.warmupMs = res.elapsedMs;
      return { warmed: true, device: _metrics.device, warmupMs: res.elapsedMs };
    })().catch(function () {
      _warmupPromise = null;
      return { warmed: false };
    });

    return _warmupPromise;
  }

  /**
   * Run text generation in the Qwen Blob Worker with streaming tokens and AbortController.
   * @param {{ systemPrompt: string, userPrompt: string, maxNewTokens?: number, temperature?: number, onProgress?: Function, onToken?: Function, signal?: AbortSignal }} opts
   * @returns {Promise<{ text: string, elapsedMs: number, firstTokenMs: number, loadMs: number, tokensPerSec: number|null, device: string|null }>}
   */
  async function generate(opts) {
    const o = opts || {};
    if (_warmupPromise) {
      await _warmupPromise.catch(function () {});
    }
    const info = await init({ onProgress: o.onProgress, signal: o.signal });
    const res = await _callWorker('generate', {
      systemPrompt: o.systemPrompt,
      userPrompt: o.userPrompt,
      maxNewTokens: o.maxNewTokens || 80,
      temperature: o.temperature || 0,
    }, { onToken: o.onToken, signal: o.signal });

    _metrics.lastFirstTokenMs = res.firstTokenMs;
    _metrics.lastAnswerMs = res.elapsedMs;
    _metrics.tokensPerSec = res.tokensPerSec;
    if (res.device) _metrics.device = res.device;

    return {
      text: res.text,
      elapsedMs: res.elapsedMs,
      firstTokenMs: res.firstTokenMs,
      loadMs: info.loadMs || 0,
      tokensPerSec: res.tokensPerSec,
      device: _metrics.device,
    };
  }

  function getMetrics() {
    return Object.assign({}, _metrics);
  }

  async function clearCache() {
    destroy();
    if (typeof window === 'undefined' || !window.caches) return;
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        if (req.url.includes(MODEL_ID)) await cache.delete(req);
      }
      _metrics.cachedFiles = 0;
      _metrics.totalBytes = 0;
      _metrics.hadCacheBefore = false;
      _metrics.loadMs = null;
      _metrics.warmupMs = null;
      _metrics.lastFirstTokenMs = null;
      _metrics.lastAnswerMs = null;
    } catch (_e) { /* ignore */ }
  }

  function destroy() {
    if (_worker) {
      try { _worker.terminate(); } catch (_e) { /* ignore */ }
      _worker = null;
    }
    _initPromise = null;
    _warmupPromise = null;
    _metrics.ready = false;
    _metrics.warmedUp = false;
    for (const entry of _pending.values()) {
      const err = new Error('Worker terminated');
      err.name = 'AbortError';
      entry.reject(err);
    }
    _pending.clear();
  }

  App.ai.qwen = {
    MODEL_ID,
    TRANSFORMERS_CDN,
    isSupported,
    approxSizeMB,
    inspectCache,
    init,
    warmUpIfCached,
    generate,
    getMetrics,
    clearCache,
    destroy,
  };
})();
