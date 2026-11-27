/**
 * Browser-side Sentence Embedding Engine (M7, Section 4.4.3).
 * - Uses Xenova/all-MiniLM-L6-v2 (~22.6 MB q8) via Transformers.js CDN inside a classic
 *   Blob URL Web Worker (100% file:// and http(s):// compatible, zero local fetch).
 * - WebGPU first with automatic WASM fallback (MiniLM runs fast on CPU WASM too).
 * - Caches candidate card vectors in IndexedDB (App.store.idb) + in-memory Map.
 * - Provides a full offline keyword-overlap ranker fallback (`rankOffline`) so 你說我猜
 *   remains playable even without network or Web Workers.
 * @namespace App.ai.embed
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.ai = App.ai || {};

  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';
  const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
  const CACHE_NAME = 'transformers-cache';
  const APPROX_MB = 22.6;
  const APPROX_BYTES = Math.round(APPROX_MB * 1024 * 1024);

  const POS_NAMES = {
    'n.': 'noun',
    'v.': 'verb',
    'adj.': 'adjective',
    'adv.': 'adverb',
    'prep.': 'preposition',
    'conj.': 'conjunction',
    'pron.': 'pronoun',
    'det.': 'determiner',
    'aux.': 'auxiliary verb',
    'int.': 'interjection',
  };

  const STOPWORDS = new Set([
    'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'into',
    'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'we', 'us', 'our', 'you', 'your', 'i', 'me', 'my', 'he', 'him', 'his',
    'she', 'her', 'and', 'or', 'but', 'if', 'when', 'where', 'what', 'which',
    'who', 'how', 'so', 'very', 'just', 'can', 'could', 'will', 'would', 'do',
    'does', 'did', 'have', 'has', 'had', 'not', 'no', 'yes', 'some', 'any',
    'one', 'two', 'more', 'most', 'many', 'much', 'about', 'there', 'here',
    'often', 'usually', 'something', 'someone', 'thing', 'things', 'word', 'used',
  ]);

  /** Lightweight chapter/topic semantic cues for the offline keyword-overlap fallback. */
  const TOPIC_CUES = [
    { match: /food|drink|eat|meal|fruit|kitchen|cook|table|餐|食|飲|水果/i, words: ['eat', 'food', 'drink', 'meal', 'taste', 'cook', 'kitchen', 'table', 'sweet', 'hungry', 'restaurant', 'plate', 'cup'] },
    { match: /school|study|class|edu|campus|校|學|課|文具/i, words: ['school', 'study', 'class', 'teacher', 'student', 'learn', 'desk', 'write', 'read', 'exam', 'homework', 'book', 'pen', 'board'] },
    { match: /weather|season|nature|sky|天氣|季節|自然/i, words: ['weather', 'sky', 'rain', 'wind', 'sun', 'cold', 'hot', 'snow', 'season', 'outside', 'cloud', 'nature', 'tree', 'water', 'flower'] },
    { match: /travel|traffic|transport|trip|city|place|交|旅|城市|地點/i, words: ['travel', 'trip', 'road', 'city', 'station', 'ticket', 'bus', 'train', 'car', 'fly', 'airport', 'map', 'visit', 'place', 'building'] },
    { match: /sport|game|hobby|music|art|運動|娛樂|音樂/i, words: ['sport', 'play', 'ball', 'team', 'game', 'run', 'win', 'match', 'music', 'song', 'art', 'fun', 'movie', 'watch'] },
    { match: /health|body|medic|hosp|健|身|醫/i, words: ['health', 'body', 'doctor', 'hospital', 'sick', 'medicine', 'pain', 'sleep', 'exercise', 'head', 'hand', 'care'] },
    { match: /animal|pet|zoo|動物/i, words: ['animal', 'pet', 'wild', 'zoo', 'bird', 'dog', 'cat', 'tail', 'fur', 'fly', 'swim', 'legs', 'farm'] },
    { match: /home|house|room|family|家|房|親/i, words: ['home', 'house', 'room', 'bed', 'live', 'family', 'clean', 'door', 'window', 'chair', 'parent', 'mother', 'father'] },
    { match: /shop|money|buy|store|商|買|錢/i, words: ['buy', 'shop', 'store', 'money', 'pay', 'price', 'sell', 'market', 'cheap', 'expensive', 'cash', 'bag'] },
    { match: /job|work|office|occup|職|工作/i, words: ['job', 'work', 'office', 'company', 'boss', 'help', 'build', 'uniform', 'salary', 'meeting', 'person'] },
    { match: /cloth|wear|fashion|衣|服/i, words: ['wear', 'clothes', 'shirt', 'shoes', 'dress', 'coat', 'hat', 'warm', 'body', 'fabric', 'pocket'] },
    { match: /time|day|date|month|時間|日期/i, words: ['time', 'day', 'week', 'month', 'year', 'clock', 'morning', 'night', 'hour', 'minute', 'early', 'late'] },
    { match: /feel|emot|mood|心|情|性格/i, words: ['feel', 'happy', 'sad', 'angry', 'afraid', 'smile', 'cry', 'heart', 'mood', 'mind', 'emotion'] },
  ];

  let _worker = null;
  let _reqSeq = 0;
  let _initPromise = null;
  const _pending = new Map();
  const _memVectors = new Map();

  const _metrics = {
    modelId: MODEL_ID,
    device: null,
    dtype: null,
    webgpuError: null,
    loadMs: null,
    lastEmbedMs: null,
    cachedFiles: 0,
    totalBytes: 0,
    ready: false,
  };

  function isSupported() {
    return typeof window !== 'undefined' && typeof window.Worker !== 'undefined' && typeof window.Blob !== 'undefined';
  }

  function _buildWorkerSource() {
    return `
      let extractor = null;
      let activeDevice = null;
      let activeDtype = null;
      let webgpuError = null;
      const CDN_URL = ${JSON.stringify(TRANSFORMERS_CDN)};
      const MODEL = ${JSON.stringify(MODEL_ID)};
      const CACHE_NAME = ${JSON.stringify(CACHE_NAME)};
      const APPROX_TOTAL = ${APPROX_BYTES};

      self.onmessage = async (ev) => {
        const { id, type, payload } = ev.data || {};
        try {
          if (type === 'init') {
            if (extractor) {
              self.postMessage({
                id,
                type: 'result',
                data: { elapsedMs: 0, device: activeDevice, dtype: activeDtype, webgpuError, cachedFiles: 0, totalBytes: 0 },
              });
              return;
            }
            const t0 = performance.now();
            const fileSizes = new Map();
            const mod = await import(CDN_URL);
            const { pipeline, env } = mod;
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

            const plans = hasWebGPU
              ? [{ device: 'webgpu', dtype: 'q8' }, { device: 'wasm', dtype: 'q8' }]
              : [{ device: 'wasm', dtype: 'q8' }];

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
                const effectiveTotal = sumTotal >= sumLoaded && sumTotal > 2 * 1024 * 1024
                  ? sumTotal
                  : Math.max(APPROX_TOTAL, sumLoaded);
                self.postMessage({ id, type: 'progress', file: p.file, loaded: sumLoaded, total: effectiveTotal });
              }
            };

            let lastErr = null;
            for (const plan of plans) {
              try {
                extractor = await pipeline('feature-extraction', MODEL, {
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
                extractor = null;
              }
            }
            if (!extractor) throw lastErr || new Error('Unable to initialize MiniLM embedding pipeline');

            let cachedFiles = 0;
            let totalBytes = 0;
            try {
              if (self.caches) {
                const c = await self.caches.open(CACHE_NAME);
                const keys = (await c.keys()).filter((r) => r.url.includes(MODEL));
                cachedFiles = keys.length;
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
                cachedFiles,
                totalBytes,
              },
            });
            return;
          }

          if (type === 'embed') {
            if (!extractor) throw new Error('MiniLM model not initialized');
            const t0 = performance.now();
            const texts = Array.isArray(payload.texts) ? payload.texts : [];
            const vectors = [];
            for (const txt of texts) {
              const out = await extractor(String(txt || ''), { pooling: 'mean', normalize: true });
              const arr = out && out.data ? Array.from(out.data) : [];
              vectors.push(arr);
            }
            self.postMessage({
              id,
              type: 'result',
              data: {
                vectors,
                elapsedMs: Math.max(1, Math.round(performance.now() - t0)),
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
        if (entry.onProgress) entry.onProgress(msg);
        return;
      }
      _pending.delete(msg.id);
      if (msg.type === 'error') {
        entry.reject(new Error(msg.error || 'MiniLM worker error'));
      } else {
        entry.resolve(msg.data);
      }
    };

    _worker.onerror = function (ev) {
      const err = new Error((ev && ev.message) || 'MiniLM Blob Worker failed');
      for (const entry of _pending.values()) entry.reject(err);
      _pending.clear();
      _metrics.ready = false;
      _worker = null;
      _initPromise = null;
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
        if (o.signal && onAbort) o.signal.removeEventListener('abort', onAbort);
      };
      onAbort = () => {
        _pending.delete(id);
        cleanup();
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        reject(abortErr);
      };
      if (o.signal) o.signal.addEventListener('abort', onAbort, { once: true });

      _pending.set(id, {
        resolve: (data) => { cleanup(); resolve(data); },
        reject: (err) => { cleanup(); reject(err); },
        onProgress: o.onProgress || null,
      });
      w.postMessage({ id, type, payload });
    });
  }

  /**
   * Inspect Cache Storage for Xenova/all-MiniLM-L6-v2 files.
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
   * Initialize (download or load from cache) the MiniLM sentence-embedding worker.
   * @param {{ onProgress?: Function, signal?: AbortSignal }} [opts]
   * @returns {Promise<Object>}
   */
  async function init(opts) {
    const o = opts || {};
    if (!isSupported()) throw new Error('Web Workers are unavailable in this browser');
    if (_metrics.ready && _worker) return Object.assign({}, _metrics);
    if (_initPromise) return _initPromise;

    _initPromise = _callWorker('init', null, o).then(function (data) {
      _metrics.ready = true;
      _metrics.device = data.device || 'wasm';
      _metrics.dtype = data.dtype || 'q8';
      _metrics.webgpuError = data.webgpuError || null;
      _metrics.loadMs = data.elapsedMs;
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
   * Compute L2-normalized embeddings for one or more English strings.
   * @param {string[]} texts
   * @param {{ onProgress?: Function, signal?: AbortSignal }} [opts]
   * @returns {Promise<{ vectors: number[][], elapsedMs: number, device: string }>}
   */
  async function embedTexts(texts, opts) {
    const o = opts || {};
    await init({ onProgress: o.onProgress, signal: o.signal });
    const res = await _callWorker('embed', { texts }, { signal: o.signal });
    _metrics.lastEmbedMs = res.elapsedMs;
    if (res.device) _metrics.device = res.device;
    return res;
  }

  /**
   * Build the text embedded for a vocabulary card (Section 4.4.3).
   * Uses word + real example sentence when available (never synthetic generated_example).
   * @param {Object} card
   * @returns {string}
   */
  function candidateText(card) {
    if (!card) return '';
    const word = String(card.word || '').trim();
    if (!word) return '';
    if (card.hasRealExample && card.example) {
      return `${word}. ${String(card.example).trim()}`;
    }
    const posName = card.pos && POS_NAMES[card.pos] ? POS_NAMES[card.pos] : '';
    return posName ? `${word} (${posName})` : word;
  }

  /**
   * Cosine similarity between two equal-length vectors.
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number}
   */
  function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /**
   * Convert raw similarity scores into softmax display percentages (summing to 100%).
   * @param {Array<{ score: number }>} items
   * @param {number} [temperature=0.08]
   * @returns {number[]}
   */
  function softmaxScores(items, temperature) {
    if (!Array.isArray(items) || !items.length) return [];
    const temp = Number.isFinite(temperature) && temperature > 0 ? temperature : 0.08;
    const maxS = items.reduce((m, it) => Math.max(m, Number(it.score) || 0), -Infinity);
    const exps = items.map((it) => Math.exp(((Number(it.score) || 0) - maxS) / temp));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((e) => Math.max(1, Math.round((e / sum) * 100)));
  }

  /**
   * Fetch (from memory/IndexedDB) or compute embeddings for candidate cards.
   * @param {Array<Object>} cards
   * @param {{ onProgress?: Function, signal?: AbortSignal }} [opts]
   * @returns {Promise<Map<string, number[]>>}
   */
  async function getCandidateEmbeddings(cards, opts) {
    const result = new Map();
    if (!Array.isArray(cards) || !cards.length) return result;

    const missingAfterMem = [];
    for (const c of cards) {
      if (!c || !c.id) continue;
      if (_memVectors.has(c.id)) {
        result.set(c.id, _memVectors.get(c.id));
      } else {
        missingAfterMem.push(c);
      }
    }

    if (!missingAfterMem.length) return result;

    // Check IndexedDB batch cache
    let idbMap = new Map();
    if (App.store && App.store.idb && typeof App.store.idb.getMany === 'function') {
      try {
        idbMap = await App.store.idb.getMany(MODEL_ID, missingAfterMem.map((c) => c.id));
      } catch (_e) { /* IDB unavailable in private/sandbox mode */ }
    }

    const toCompute = [];
    for (const c of missingAfterMem) {
      const vec = idbMap.get(c.id);
      if (Array.isArray(vec) && vec.length) {
        _memVectors.set(c.id, vec);
        result.set(c.id, vec);
      } else {
        toCompute.push(c);
      }
    }

    if (!toCompute.length) return result;

    const texts = toCompute.map(candidateText);
    const { vectors } = await embedTexts(texts, opts);
    const toStore = [];
    for (let i = 0; i < toCompute.length; i++) {
      const vec = vectors[i];
      if (Array.isArray(vec) && vec.length) {
        _memVectors.set(toCompute[i].id, vec);
        result.set(toCompute[i].id, vec);
        toStore.push({ cardId: toCompute[i].id, vector: vec });
      }
    }

    if (toStore.length && App.store && App.store.idb && typeof App.store.idb.putMany === 'function') {
      App.store.idb.putMany(MODEL_ID, toStore).catch(function () {});
    }

    return result;
  }

  /**
   * Pick nearest neighbors of `targetCard` among `candidates` using precomputed embeddings.
   * @param {Object} targetCard
   * @param {Array<Object>} candidates
   * @param {Map<string, number[]>} embeddingsMap
   * @param {number} [count=3]
   * @returns {string[]}
   */
  function pickNearestNeighbors(targetCard, candidates, embeddingsMap, count) {
    const n = Number.isFinite(count) ? count : 3;
    if (!targetCard || !embeddingsMap || !embeddingsMap.has(targetCard.id)) return [];
    const targetVec = embeddingsMap.get(targetCard.id);
    const targetVariants = new Set(
      App.text && typeof App.text.variants === 'function'
        ? App.text.variants(targetCard.word)
        : [String(targetCard.word || '').toLowerCase()]
    );

    const scored = [];
    for (const c of (candidates || [])) {
      if (!c || c.id === targetCard.id) continue;
      const wl = String(c.word || '').trim().toLowerCase();
      if (!wl || targetVariants.has(wl)) continue;
      const vec = embeddingsMap.get(c.id);
      if (!vec) continue;
      scored.push({ word: c.word, score: cosine(targetVec, vec) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n).map((s) => s.word);
  }

  /**
   * Rank candidate cards against the player's English description using MiniLM embeddings.
   * @param {string} description
   * @param {Array<Object>} candidates
   * @param {{ onProgress?: Function, signal?: AbortSignal }} [opts]
   * @returns {Promise<{ engine: 'minilm', device: string, ranked: Array<Object>, elapsedMs: number }>}
   */
  async function rankWithEmbeddings(description, candidates, opts) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const vecMap = await getCandidateEmbeddings(candidates, opts);
    const descRes = await embedTexts([description], opts);
    const descVec = descRes.vectors[0] || [];

    const scored = candidates.map((card) => ({
      card,
      word: card.word,
      score: cosine(descVec, vecMap.get(card.id) || []),
    }));
    scored.sort((a, b) => b.score - a.score);

    const pcts = softmaxScores(scored.slice(0, 6), 0.08);
    const ranked = scored.map((item, idx) => ({
      card: item.card,
      word: item.word,
      score: Number(item.score.toFixed(4)),
      pct: idx < pcts.length ? pcts[idx] : 1,
      rank: idx + 1,
    }));

    const elapsedMs = Math.max(1, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0));
    return {
      engine: 'minilm',
      device: descRes.device || _metrics.device || 'wasm',
      ranked,
      elapsedMs,
    };
  }

  function _tokenizeContent(text) {
    const raw = String(text || '').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
    const tokens = [];
    for (const w of raw) {
      if (w.length < 2 || STOPWORDS.has(w)) continue;
      tokens.push(w);
    }
    return tokens;
  }

  function _stemToken(w) {
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }

  function _buildOfflineCardTokens(card) {
    const bag = new Map();
    const add = (tok, weight) => {
      if (!tok || tok.length < 2 || STOPWORDS.has(tok)) return;
      bag.set(tok, Math.max(bag.get(tok) || 0, weight));
      const stem = _stemToken(tok);
      if (stem && stem !== tok && stem.length >= 3) {
        bag.set(stem, Math.max(bag.get(stem) || 0, weight * 0.85));
      }
    };

    const wordLower = String(card.word || '').trim().toLowerCase();
    add(wordLower, 2.5);
    if (App.text && typeof App.text.variants === 'function') {
      for (const v of App.text.variants(wordLower)) add(v, 2.0);
    }
    if (card.hasRealExample && card.example) {
      for (const t of _tokenizeContent(card.example)) add(t, 1.8);
    }

    // Topic cues derived from chapter tags & Chinese meaning
    const tagBlob = (Array.isArray(card.tags) ? card.tags.join(' ') : '') + ' ' + (card.zh || '');
    for (const cue of TOPIC_CUES) {
      if (cue.match.test(tagBlob)) {
        for (const cw of cue.words) add(cw, 0.9);
      }
    }

    return bag;
  }

  /**
   * Offline keyword-overlap fallback ranker (works 100% offline with zero AI model).
   * @param {string} description
   * @param {Array<Object>} candidates
   * @returns {{ engine: 'offline', device: null, ranked: Array<Object>, elapsedMs: number }}
   */
  function rankOffline(description, candidates) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const descLower = String(description || '').toLowerCase();
    const descTokens = _tokenizeContent(descLower);
    const descStems = descTokens.map(_stemToken);

    const wantsPerson = /\b(person|someone|people|man|woman|worker)\b/.test(descLower);
    const wantsPlace = /\b(place|room|building|shop|store|where)\b/.test(descLower);
    const wantsVerb = /\b(to\s+[a-z]+|action|do\s+when|when\s+you\s+[a-z]+)\b/.test(descLower);
    const wantsAdj = /\b(feel|feeling|looks?\s+like|describ|opposite\s+of)\b/.test(descLower);

    const scored = (candidates || []).map((card) => {
      const bag = _buildOfflineCardTokens(card);
      let score = 0;
      const seen = new Set();
      for (let i = 0; i < descTokens.length; i++) {
        const tok = descTokens[i];
        const stem = descStems[i];
        if (seen.has(tok)) continue;
        seen.add(tok);
        if (bag.has(tok)) {
          score += bag.get(tok);
        } else if (bag.has(stem)) {
          score += bag.get(stem) * 0.85;
        }
      }

      // Gentle POS cue alignment
      if (wantsVerb && card.pos === 'v.') score += 0.35;
      if (wantsAdj && card.pos === 'adj.') score += 0.35;
      if ((wantsPerson || wantsPlace) && card.pos === 'n.') score += 0.25;

      // Normalize by description length so scores sit cleanly in ~[0, 1]
      const normScore = descTokens.length > 0 ? score / Math.max(2, Math.sqrt(descTokens.length)) : 0;
      return { card, word: card.word, score: normScore };
    });

    scored.sort((a, b) => (b.score - a.score) || a.word.localeCompare(b.word));
    const pcts = softmaxScores(scored.slice(0, 6), 0.35);
    const ranked = scored.map((item, idx) => ({
      card: item.card,
      word: item.word,
      score: Number(item.score.toFixed(4)),
      pct: idx < pcts.length ? pcts[idx] : 1,
      rank: idx + 1,
    }));

    const elapsedMs = Math.max(1, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0));
    return { engine: 'offline', device: null, ranked, elapsedMs };
  }

  /**
   * Rank candidate cards using MiniLM embeddings when available, falling back cleanly
   * to the offline keyword-overlap ranker if MiniLM is unavailable or disabled.
   * @param {string} description
   * @param {Array<Object>} candidates
   * @param {{ preferOffline?: boolean, onProgress?: Function, signal?: AbortSignal }} [opts]
   * @returns {Promise<{ engine: 'minilm'|'offline', device: string|null, fellBack: boolean, ranked: Array<Object>, elapsedMs: number }>}
   */
  async function rankCandidates(description, candidates, opts) {
    const o = opts || {};
    if (o.preferOffline || !isSupported()) {
      const off = rankOffline(description, candidates);
      return Object.assign({}, off, { fellBack: false });
    }
    try {
      const res = await rankWithEmbeddings(description, candidates, o);
      return Object.assign({}, res, { fellBack: false });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      const off = rankOffline(description, candidates);
      return Object.assign({}, off, { fellBack: true, error: err && err.message ? err.message : String(err) });
    }
  }

  function getMetrics() {
    return Object.assign({}, _metrics);
  }

  function destroy() {
    if (_worker) {
      try { _worker.terminate(); } catch (_e) { /* ignore */ }
      _worker = null;
    }
    _metrics.ready = false;
    _initPromise = null;
    for (const entry of _pending.values()) {
      const err = new Error('Worker terminated');
      err.name = 'AbortError';
      entry.reject(err);
    }
    _pending.clear();
  }

  App.ai.embed = {
    MODEL_ID,
    TRANSFORMERS_CDN,
    APPROX_MB,
    isSupported,
    inspectCache,
    init,
    embedTexts,
    candidateText,
    cosine,
    softmaxScores,
    getCandidateEmbeddings,
    pickNearestNeighbors,
    rankWithEmbeddings,
    rankOffline,
    rankCandidates,
    getMetrics,
    destroy,
  };
})();
