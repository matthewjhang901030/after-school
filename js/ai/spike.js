/**
 * AI Spike (file:// compatible, no local model files, classic Blob URL Worker).
 * Tests downloading Transformers.js + Xenova/all-MiniLM-L6-v2 (q8) from CDN,
 * progress reporting in MB, Cache Storage persistence across browser restarts,
 * and semantic similarity ranking in a classic Blob Worker.
 */
(function () {
  'use strict';

  const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';
  const CACHE_NAME = 'transformers-cache';
  const SAMPLE_WORDS = ['library', 'bookstore', 'school', 'banana', 'hospital', 'bicycle', 'teacher'];

  const envGrid = document.getElementById('env-grid');
  const btnLoad = document.getElementById('btn-load');
  const btnRefreshCache = document.getElementById('btn-refresh-cache');
  const btnClearCache = document.getElementById('btn-clear-cache');
  const btnInfer = document.getElementById('btn-infer');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const cacheStatus = document.getElementById('cache-status');
  const queryInput = document.getElementById('query-input');
  const inferOutput = document.getElementById('infer-output');

  let worker = null;
  let modelReady = false;
  let reqSeq = 0;
  const pending = new Map();

  function formatMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2);
  }

  function addEnvItem(label, value) {
    const item = document.createElement('div');
    item.className = 'kv-item';
    item.textContent = `${label}: ${value}`;
    envGrid.appendChild(item);
  }

  function renderEnvDiagnostics() {
    envGrid.replaceChildren();
    addEnvItem('protocol', window.location.protocol);
    addEnvItem('origin', window.location.origin);
    addEnvItem('isSecureContext', String(window.isSecureContext));
    addEnvItem('Cache API', typeof window.caches !== 'undefined' ? 'available' : 'unavailable');
    addEnvItem('IndexedDB', typeof window.indexedDB !== 'undefined' ? 'available' : 'unavailable');
    addEnvItem('WebGPU', navigator.gpu ? 'available' : 'unavailable');
    addEnvItem('Gemini Nano', typeof window.LanguageModel !== 'undefined' ? 'available' : 'unavailable');
    addEnvItem('Blob Worker', typeof window.Worker !== 'undefined' ? 'available' : 'unavailable');
  }

  function buildWorkerSource() {
    // Classic worker (NOT { type: 'module' }) is required under file:// in Chromium/Edge.
    // Dynamic import() from jsDelivr CDN works inside classic Blob Workers.
    return `
      let extractor = null;
      const CDN_URL = ${JSON.stringify(TRANSFORMERS_CDN)};
      const MODEL = ${JSON.stringify(MODEL_ID)};

      self.onmessage = async (ev) => {
        const { id, type, payload } = ev.data || {};
        try {
          if (type === 'init') {
            const t0 = performance.now();
            const fileSizes = new Map();
            const cachedBefore = self.caches
              ? (await (await self.caches.open(${JSON.stringify(CACHE_NAME)})).keys()).map((r) => r.url)
              : [];

            const { pipeline, env } = await import(CDN_URL);
            env.allowLocalModels = false;

            extractor = await pipeline('feature-extraction', MODEL, {
              dtype: 'q8',
              progress_callback: (p) => {
                if (!p || !p.file) return;
                if (p.status === 'progress' || p.status === 'download') {
                  fileSizes.set(p.file, {
                    loaded: p.loaded || 0,
                    total: p.total || 0,
                  });
                  let loaded = 0;
                  let total = 0;
                  for (const entry of fileSizes.values()) {
                    loaded += entry.loaded;
                    total += entry.total;
                  }
                  self.postMessage({
                    id,
                    type: 'progress',
                    file: p.file,
                    loaded,
                    total,
                  });
                }
              },
            });

            const cachedAfter = self.caches
              ? (await (await self.caches.open(${JSON.stringify(CACHE_NAME)})).keys()).map((r) => r.url)
              : [];

            self.postMessage({
              id,
              type: 'result',
              data: {
                elapsedMs: Math.round(performance.now() - t0),
                hadCacheBefore: cachedBefore.some((u) => u.includes(MODEL)),
                cachedCountAfter: cachedAfter.filter((u) => u.includes(MODEL)).length,
                workerOrigin: self.location.origin,
              },
            });
            return;
          }

          if (type === 'rank') {
            if (!extractor) throw new Error('Model not loaded');
            const t0 = performance.now();
            const inputs = [payload.query, ...payload.candidates];
            const out = await extractor(inputs, { pooling: 'mean', normalize: true });
            const dim = out.dims[1];
            const data = out.data;
            const scores = payload.candidates.map((word, idx) => {
              const offset = (idx + 1) * dim;
              let dot = 0;
              for (let i = 0; i < dim; i++) {
                dot += data[i] * data[offset + i];
              }
              return { word, score: Number(dot.toFixed(4)) };
            });
            scores.sort((a, b) => b.score - a.score);
            self.postMessage({
              id,
              type: 'result',
              data: {
                elapsedMs: Math.round(performance.now() - t0),
                dim,
                scores,
              },
            });
          }
        } catch (err) {
          self.postMessage({
            id,
            type: 'error',
            error: err && err.stack ? err.stack : String(err),
          });
        }
      };
    `;
  }

  function ensureWorker() {
    if (worker) return worker;
    const blob = new Blob([buildWorkerSource()], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);

    worker.onmessage = (ev) => {
      const msg = ev.data || {};
      const entry = pending.get(msg.id);
      if (!entry) return;
      if (msg.type === 'progress') {
        if (entry.onProgress) entry.onProgress(msg);
        return;
      }
      pending.delete(msg.id);
      if (msg.type === 'error') {
        entry.reject(new Error(msg.error || 'Worker error'));
      } else {
        entry.resolve(msg.data);
      }
    };

    worker.onerror = (ev) => {
      const err = new Error(ev.message || 'Blob Worker failed');
      for (const entry of pending.values()) entry.reject(err);
      pending.clear();
    };

    return worker;
  }

  function callWorker(type, payload, onProgress) {
    const w = ensureWorker();
    const id = ++reqSeq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress });
      w.postMessage({ id, type, payload });
    });
  }

  async function inspectCacheStatus() {
    if (!window.caches) {
      cacheStatus.textContent = 'Cache API 在目前環境不可用。';
      return;
    }
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const modelKeys = keys.filter((r) => r.url.includes(MODEL_ID));
      let totalBytes = 0;
      for (const req of modelKeys) {
        const resp = await cache.match(req);
        if (resp) {
          const buf = await resp.clone().arrayBuffer();
          totalBytes += buf.byteLength;
        }
      }
      if (modelKeys.length === 0) {
        cacheStatus.textContent = '目前沒有快取的模型檔案（下次載入將從網路下載）。';
      } else {
        cacheStatus.textContent = `已快取 ${modelKeys.length} 個模型檔案（共 ${formatMB(totalBytes)} MB），重開頁面後可直接離線讀取。`;
      }
    } catch (err) {
      cacheStatus.textContent = `檢查快取失敗：${String(err)}`;
    }
  }

  btnLoad.addEventListener('click', async () => {
    btnLoad.disabled = true;
    btnInfer.disabled = true;
    progressBar.style.width = '5%';
    progressText.textContent = '正在啟動 Blob Worker 並連線至 jsDelivr / Hugging Face…';

    try {
      const info = await callWorker('init', null, (p) => {
        const pct = p.total > 0 ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0;
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `下載/讀取 ${p.file}：${formatMB(p.loaded)} / ${formatMB(p.total)} MB (${pct}%)`;
      });

      progressBar.style.width = '100%';
      progressText.textContent = info.hadCacheBefore
        ? `○ 已從瀏覽器快取載入（耗時 ${info.elapsedMs} ms，未重新下載）`
        : `○ 首次下載並快取完成（耗時 ${info.elapsedMs} ms，已快取 ${info.cachedCountAfter} 個檔案）`;
      modelReady = true;
      btnInfer.disabled = false;
      await inspectCacheStatus();
    } catch (err) {
      progressText.textContent = `✗ 載入失敗：${err.message}`;
    } finally {
      btnLoad.disabled = false;
    }
  });

  btnRefreshCache.addEventListener('click', inspectCacheStatus);

  btnClearCache.addEventListener('click', async () => {
    if (!window.caches) return;
    await window.caches.delete(CACHE_NAME);
    modelReady = false;
    btnInfer.disabled = true;
    progressBar.style.width = '0%';
    progressText.textContent = '已清除模型快取。';
    await inspectCacheStatus();
  });

  btnInfer.addEventListener('click', async () => {
    if (!modelReady) return;
    const query = queryInput.value.trim();
    if (!query) return;
    btnInfer.disabled = true;
    inferOutput.textContent = '正在計算向量相似度…';
    try {
      const res = await callWorker('rank', { query, candidates: SAMPLE_WORDS });
      const lines = [
        `耗時: ${res.elapsedMs} ms | 向量維度: ${res.dim}`,
        ...res.scores.map((s, i) => `${i + 1}. ${s.word.padEnd(12, ' ')} cosine=${s.score}`),
      ];
      inferOutput.textContent = lines.join('\n');
    } catch (err) {
      inferOutput.textContent = `✗ 推論失敗：${err.message}`;
    } finally {
      btnInfer.disabled = false;
    }
  });

  renderEnvDiagnostics();
  inspectCacheStatus();
})();
