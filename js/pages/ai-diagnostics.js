/**
 * AI Diagnostics page (#/settings/ai) — M6 live tier detection, opt-in Qwen 0.5B / 1.5B
 * model selector with download sizes, per-model measured timings (load, TTFT, total,
 * device, tokens), Last AI Attempt inspector, and "測試一下" / "刪除模型快取".
 * All model outputs are rendered strictly via textContent (never innerHTML).
 * @namespace App.pages.aiDiagnostics
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.pages = App.pages || {};

  let _root = null;
  let _activePanel = null;

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _fmtSec(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '—';
    return (Math.max(0, Number(ms)) / 1000).toFixed(1) + 's';
  }

  function _formatModelMetrics(m) {
    if (!m) return '—';
    const parts = [];
    if (m.loadMs != null) parts.push(`load ${_fmtSec(m.loadMs)}`);
    if (m.lastFirstTokenMs != null) parts.push(`1st ${_fmtSec(m.lastFirstTokenMs)}`);
    if (m.lastAnswerMs != null) parts.push(`total ${_fmtSec(m.lastAnswerMs)}`);
    if (m.device) parts.push(String(m.device).toUpperCase());
    if (m.lastTokenCount != null) parts.push(`${m.lastTokenCount} tok`);
    return parts.length ? parts.join(' · ') : '—';
  }

  function _fmtTime(ts) {
    if (!ts || !Number.isFinite(Number(ts))) return '—';
    const d = new Date(Number(ts));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function mount(root) {
    _root = root;
    const { el, clear } = App.dom;
    const settings = App.store && App.store.settings;

    const modelSwitchSlot = el('section', { style: 'margin-bottom: var(--space-6);' });
    const statusGrid = el('div', { className: 'detail-meta-grid', style: 'margin-bottom: var(--space-6);' }, [
      el('div', { className: 'detail-meta-item', text: _t('misc.loading') }),
    ]);
    const lastAttemptSlot = el('section', { style: 'margin-top: var(--space-6);' });
    const testSlot = el('div', { style: 'margin-top: var(--space-4);' });

    function metaCard(label, value) {
      return el('div', { className: 'detail-meta-item' }, [
        el('div', { className: 'detail-meta-label', text: label }),
        el('div', { className: 'detail-meta-value', text: value }),
      ]);
    }

    function renderModelSelector() {
      clear(modelSwitchSlot);
      const cur = settings ? (settings.get('qwenModel') || '0.5b') : '0.5b';
      const opts = [
        { value: '0.5b', label: _t('settings.qwen_model.05b') },
        { value: '1.5b', label: _t('settings.qwen_model.15b') },
      ];
      modelSwitchSlot.appendChild(
        el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-2);', text: _t('settings.qwen_model') })
      );
      modelSwitchSlot.appendChild(
        el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, opts.map((opt) =>
          el('button', {
            type: 'button',
            className: 'btn ' + (cur === opt.value ? 'btn-primary' : 'btn-secondary'),
            'data-diag-qwen-model': opt.value,
            onClick: () => {
              if (settings) settings.update({ qwenModel: opt.value });
              if (App.ai && App.ai.qwen && typeof App.ai.qwen.destroy === 'function') App.ai.qwen.destroy();
              if (App.ai && typeof App.ai.invalidateDetection === 'function') App.ai.invalidateDetection();
              renderModelSelector();
              refreshStatus();
            },
          }, [el('span', { className: 'btn-label', text: opt.label })])
        ))
      );
    }

    function renderAttempts(attempts) {
      clear(lastAttemptSlot);
      lastAttemptSlot.appendChild(
        el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: _t('ai.diag.last_attempt') })
      );

      const list = Array.isArray(attempts) ? attempts : [];
      if (!list.length) {
        lastAttemptSlot.appendChild(
          el('p', { className: 'text-muted text-small', text: _t('ai.diag.no_attempt') })
        );
        return;
      }

      const wrap = el('div', { className: 'ai-attempts-list', 'data-ai-attempts-list': 'true' });
      list.forEach((item, idx) => {
        const accepted = item.accepted === true || item.fellBack === false;
        const statusText = accepted
          ? `○ ${_t('ai.diag.status_ok')}`
          : `✗ ${_t('ai.diag.status_fallback')}`;
        const devStr = item.device ? String(item.device).toUpperCase() : '—';
        const modelTag = item.modelLabel || item.tier || 'template';
        const tempStr = typeof item.temperature === 'number' ? ` · t=${item.temperature}` : '';
        const timingSummary = [
          `${_t('ai.diag.ttft')}: ${_fmtSec(item.firstTokenMs)}`,
          `${_t('ai.diag.total_time')}: ${_fmtSec(item.elapsedMs)}`,
          `${_t('ai.diag.tokens')}: ${item.tokenCount != null ? item.tokenCount : '—'}`,
        ].join(' · ');

        const attrs = {
          className: 'ai-panel',
          'data-ai-attempt-item': 'true',
        };
        if (idx === 0) attrs['data-ai-last-attempt'] = 'true';

        wrap.appendChild(
          el('div', attrs, [
            el('div', { className: 'ai-attempt-head' }, [
              el('span', { className: 'ai-panel-title', text: `#${idx + 1} · ${statusText}` }),
              el('span', { className: 'ai-attempt-time', 'data-ai-attempt-time': 'true', text: _fmtTime(item.ts) }),
            ]),
            el('div', { className: 'detail-meta-grid' }, [
              metaCard(_t('ai.diag.attempt_status'), `${modelTag} · ${devStr}${tempStr}`),
              metaCard(_t('ai.diag.target_word'), item.targetWord || '—'),
              metaCard(_t('ai.diag.rejection_reason'), item.rejectionReason || _t('ai.diag.reason_none')),
              metaCard(_t('ai.diag.metrics'), timingSummary),
            ]),
            el('div', { className: 'ai-result-label', text: _t('ai.diag.raw_output') }),
            el('pre', {
              className: 'ai-stream-box',
              'data-ai-raw-output': 'true',
              style: 'margin: 0; max-height: 160px; overflow: auto;',
              text: item.rawOutput || _t('ai.diag.raw_empty'),
            }),
          ])
        );
      });
      lastAttemptSlot.appendChild(wrap);
    }

    async function refreshStatus() {
      if (!_root || !App.ai) return;
      const st = await App.ai.detect(true);
      const qm = App.ai.qwen ? App.ai.qwen.getMetrics() : {};
      const allM = App.ai.qwen && App.ai.qwen.getAllMetrics ? App.ai.qwen.getAllMetrics() : { '0.5b': qm, '1.5b': null };
      const attempts = typeof App.ai.getLastAttempts === 'function'
        ? App.ai.getLastAttempts(5)
        : (typeof App.ai.getLastAttempt === 'function' && App.ai.getLastAttempt() ? [App.ai.getLastAttempt()] : []);
      const last = attempts[0] || null;
      const mbCached = ((st.qwen.cachedBytes || 0) / (1024 * 1024)).toFixed(1);
      const cacheText = st.qwen.cached
        ? _t('ai.diag.cached_info', { files: st.qwen.cachedFiles, mb: mbCached })
        : _t('ai.diag.not_cached', { mb: st.qwen.approxMB });

      const activeDev = qm.device || (last && last.device);
      const devLabel = activeDev === 'webgpu'
        ? 'WebGPU'
        : (activeDev === 'wasm'
          ? (qm.webgpuError ? `WASM (WebGPU fallback: ${qm.webgpuError})` : 'WASM')
          : (st.webgpu ? 'WebGPU (ready)' : 'WASM'));

      clear(statusGrid);
      statusGrid.appendChild(metaCard(_t('ai.diag.active_tier'), `${st.activeTier} (${st.preferred})`));
      statusGrid.appendChild(metaCard(_t('ai.diag.device'), devLabel));
      statusGrid.appendChild(metaCard(_t('ai.diag.qwen_cache'), `${st.qwen.modelLabel}: ${cacheText}`));
      statusGrid.appendChild(metaCard(_t('ai.diag.webgpu'), st.webgpu ? 'available' : 'unavailable'));
      statusGrid.appendChild(metaCard(_t('ai.diag.nano'), st.nano.availability));
      statusGrid.appendChild(metaCard(_t('ai.diag.translator'), st.nano.translatorAvailability));
      statusGrid.appendChild(metaCard(_t('ai.diag.metrics_05b'), _formatModelMetrics(allM['0.5b'])));
      statusGrid.appendChild(metaCard(_t('ai.diag.metrics_15b'), _formatModelMetrics(allM['1.5b'])));

      renderAttempts(attempts);
    }

    const testBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      onClick: () => {
        if (_activePanel) _activePanel.stop();
        clear(testSlot);
        if (!App.aiPanel) return;
        const sampleFacts = {
          game: 'wall',
          selectedItems: ['ate', 'took', "You're welcome", 'eraser'],
          selectedBreakdown: [
            { label: 'Irregular past tense', labelZh: '不規則過去式', ruleZh: '不加 -ed 的常見動詞過去式。', skill: 'grammar', items: ['ate', 'took'] },
            { label: 'Replies to "Thank you"', labelZh: '回應「謝謝」', ruleZh: '回應道謝的日常短句。', skill: 'dialogue', items: ["You're welcome"] },
            { label: 'Study supplies', labelZh: '書包文具', ruleZh: '教室與書包裡常見的學習用品。', skill: 'vocab', items: ['eraser'] },
          ],
        };
        _activePanel = App.aiPanel.create(sampleFacts, { autoStart: false });
        testSlot.appendChild(_activePanel.root);
        _activePanel.start().then(() => refreshStatus());
      },
    }, [el('span', { className: 'btn-label', text: _t('ai.diag.test_btn') })]);

    const clearBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary',
      onClick: async () => {
        if (App.ai && App.ai.qwen) await App.ai.qwen.clearCache();
        if (App.toast) App.toast.show(_t('ai.diag.cleared'));
        await refreshStatus();
      },
    }, [el('span', { className: 'btn-label', text: _t('ai.diag.clear_btn') })]);

    root.replaceChildren(
      el('main', { className: 'page-container', role: 'main', id: 'main-content' }, [
        el('div', { className: 'page-header' }, [
          el('a', { className: 'btn btn-ghost', href: '#/settings' }, [
            el('span', { className: 'btn-label', text: '← ' + _t('btn.back') }),
          ]),
          el('h1', { className: 'page-title', text: _t('settings.ai_diag') }),
        ]),
        modelSwitchSlot,
        statusGrid,
        el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [
          testBtn,
          clearBtn,
          el('a', { className: 'btn btn-ghost', href: './tests/ai-spike.html' }, [
            el('span', { className: 'btn-label', text: _t('settings.ai_spike_link') + ' →' }),
          ]),
        ]),
        testSlot,
        lastAttemptSlot,
      ])
    );

    renderModelSelector();
    refreshStatus();
  }

  function unmount() {
    if (_activePanel) {
      _activePanel.stop();
      _activePanel = null;
    }
    _root = null;
  }

  App.pages.aiDiagnostics = { mount, unmount };
})();
