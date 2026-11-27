/**
 * AI Diagnostics page (#/settings/ai) — M6 live tier detection, Qwen cache & test runner.
 * Shows active tier, WebGPU, Chrome Prompt API, Translator API, Qwen 2.5 cache size,
 * measured timings, "測試一下 (Feature A)", and "刪除模型快取".
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

  function mount(root) {
    _root = root;
    const { el, clear } = App.dom;

    const statusGrid = el('div', { className: 'detail-meta-grid', style: 'margin-bottom: var(--space-6);' }, [
      el('div', { className: 'detail-meta-item', text: _t('misc.loading') }),
    ]);
    const testSlot = el('div', { style: 'margin-top: var(--space-4);' });

    function metaCard(label, value) {
      return el('div', { className: 'detail-meta-item' }, [
        el('div', { className: 'detail-meta-label', text: label }),
        el('div', { className: 'detail-meta-value', text: value }),
      ]);
    }

    async function refreshStatus() {
      if (!_root || !App.ai) return;
      const st = await App.ai.detect(true);
      const qm = App.ai.qwen ? App.ai.qwen.getMetrics() : {};
      const mbCached = ((st.qwen.cachedBytes || 0) / (1024 * 1024)).toFixed(1);
      const cacheText = st.qwen.cached
        ? _t('ai.diag.cached_info', { files: st.qwen.cachedFiles, mb: mbCached })
        : _t('ai.diag.not_cached', { mb: st.qwen.approxMB });

      const devLabel = qm.device === 'webgpu'
        ? 'WebGPU'
        : (qm.device === 'wasm'
          ? (qm.webgpuError ? `WASM (WebGPU fallback: ${qm.webgpuError})` : 'WASM')
          : (st.webgpu ? 'WebGPU (ready)' : 'WASM'));

      const timingParts = [];
      if (qm.loadMs !== null && qm.loadMs !== undefined) timingParts.push(`load ${(qm.loadMs / 1000).toFixed(1)}s`);
      if (qm.warmupMs !== null && qm.warmupMs !== undefined) timingParts.push(`warm-up ${(qm.warmupMs / 1000).toFixed(1)}s`);
      if (qm.lastFirstTokenMs !== null && qm.lastFirstTokenMs !== undefined) timingParts.push(`1st token ${(qm.lastFirstTokenMs / 1000).toFixed(1)}s`);
      if (qm.lastAnswerMs !== null && qm.lastAnswerMs !== undefined) timingParts.push(`full ${(qm.lastAnswerMs / 1000).toFixed(1)}s`);
      if (qm.tokensPerSec) timingParts.push(`${qm.tokensPerSec} tok/s`);
      const timingText = timingParts.length ? timingParts.join(' · ') : '—';

      clear(statusGrid);
      statusGrid.appendChild(metaCard(_t('ai.diag.active_tier'), `${st.activeTier} (${st.preferred})`));
      statusGrid.appendChild(metaCard(_t('ai.diag.device'), devLabel));
      statusGrid.appendChild(metaCard(_t('ai.diag.webgpu'), st.webgpu ? 'available' : 'unavailable'));
      statusGrid.appendChild(metaCard(_t('ai.diag.nano'), st.nano.availability));
      statusGrid.appendChild(metaCard(_t('ai.diag.translator'), st.nano.translatorAvailability));
      statusGrid.appendChild(metaCard(_t('ai.diag.qwen_cache'), cacheText));
      statusGrid.appendChild(metaCard(_t('ai.diag.metrics'), timingText));
    }

    const testBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      onClick: () => {
        if (_activePanel) _activePanel.stop();
        clear(testSlot);
        if (!App.aiPanel) return;
        const sampleFacts = {
          game: 'class13',
          word: 'receive',
          meaningZh: '收到',
          pos: 'v.',
          expected: 'receive',
          userAnswer: 'recieve',
          errorType: 'spelling',
          wrongLetters: ['i', 'e'],
          cardExample: 'Did you receive my email yesterday?',
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
        statusGrid,
        el('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--space-2);' }, [
          testBtn,
          clearBtn,
          el('a', { className: 'btn btn-ghost', href: './tests/ai-spike.html' }, [
            el('span', { className: 'btn-label', text: _t('settings.ai_spike_link') + ' →' }),
          ]),
        ]),
        testSlot,
      ])
    );

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
