/**
 * AI Diagnostics page (#/settings/ai) — M6 live tier detection, Qwen cache,
 * measured timings (TTFT, total, device, tokens), Last AI Attempt inspector,
 * and "測試一下 (Feature A)" / "刪除模型快取".
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

  function mount(root) {
    _root = root;
    const { el, clear } = App.dom;

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

    function renderLastAttempt(last) {
      clear(lastAttemptSlot);
      lastAttemptSlot.appendChild(
        el('h2', { className: 'text-muted text-small', style: 'margin-bottom: var(--space-3);', text: _t('ai.diag.last_attempt') })
      );

      if (!last) {
        lastAttemptSlot.appendChild(
          el('p', { className: 'text-muted text-small', text: _t('ai.diag.no_attempt') })
        );
        return;
      }

      const statusText = last.fellBack
        ? `✗ ${_t('ai.diag.status_fallback')}`
        : `○ ${_t('ai.diag.status_ok')}`;
      const devStr = last.device ? String(last.device).toUpperCase() : '—';
      const timingSummary = [
        `${_t('ai.diag.ttft')}: ${_fmtSec(last.firstTokenMs)}`,
        `${_t('ai.diag.total_time')}: ${_fmtSec(last.elapsedMs)}`,
        `${_t('ai.diag.tokens')}: ${last.tokenCount != null ? last.tokenCount : '—'}`,
      ].join(' · ');

      const card = el('div', { className: 'ai-panel', 'data-ai-last-attempt': 'true' }, [
        el('div', { className: 'detail-meta-grid' }, [
          metaCard(_t('ai.diag.attempt_status'), `${statusText} (${last.tier || 'template'})`),
          metaCard(_t('ai.diag.device'), devStr),
          metaCard(_t('ai.diag.rejection_reason'), last.rejectionReason || _t('ai.diag.reason_none')),
          metaCard(_t('ai.diag.metrics'), timingSummary),
        ]),
        el('div', { className: 'ai-result-label', text: _t('ai.diag.raw_output') }),
        el('pre', {
          className: 'ai-stream-box',
          'data-ai-raw-output': 'true',
          style: 'margin: 0; max-height: 200px; overflow: auto;',
          text: last.rawOutput || _t('ai.diag.raw_empty'),
        }),
      ]);
      lastAttemptSlot.appendChild(card);
    }

    async function refreshStatus() {
      if (!_root || !App.ai) return;
      const st = await App.ai.detect(true);
      const qm = App.ai.qwen ? App.ai.qwen.getMetrics() : {};
      const last = typeof App.ai.getLastAttempt === 'function' ? App.ai.getLastAttempt() : null;
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

      const firstTok = qm.lastFirstTokenMs != null ? qm.lastFirstTokenMs : (last ? last.firstTokenMs : null);
      const totalMs = qm.lastAnswerMs != null ? qm.lastAnswerMs : (last ? last.elapsedMs : null);
      const tokCount = qm.lastTokenCount != null ? qm.lastTokenCount : (last ? last.tokenCount : null);

      const timingParts = [];
      if (firstTok != null) timingParts.push(`1st ${_fmtSec(firstTok)}`);
      if (totalMs != null) timingParts.push(`total ${_fmtSec(totalMs)}`);
      if (activeDev) timingParts.push(String(activeDev).toUpperCase());
      if (tokCount != null) timingParts.push(`${tokCount} tok`);
      if (qm.loadMs != null) timingParts.push(`load ${_fmtSec(qm.loadMs)}`);
      const timingText = timingParts.length ? timingParts.join(' · ') : '—';

      clear(statusGrid);
      statusGrid.appendChild(metaCard(_t('ai.diag.active_tier'), `${st.activeTier} (${st.preferred})`));
      statusGrid.appendChild(metaCard(_t('ai.diag.device'), devLabel));
      statusGrid.appendChild(metaCard(_t('ai.diag.webgpu'), st.webgpu ? 'available' : 'unavailable'));
      statusGrid.appendChild(metaCard(_t('ai.diag.nano'), st.nano.availability));
      statusGrid.appendChild(metaCard(_t('ai.diag.translator'), st.nano.translatorAvailability));
      statusGrid.appendChild(metaCard(_t('ai.diag.qwen_cache'), cacheText));
      statusGrid.appendChild(metaCard(_t('ai.diag.metrics'), timingText));

      renderLastAttempt(last);
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
        lastAttemptSlot,
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
