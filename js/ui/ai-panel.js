/**
 * Reusable AI Explanation Panel (M6, Section 5.5 & 5.6).
 * - Renders ALL AI text strictly via textContent (never innerHTML).
 * - Shows source label (Gemini Nano / Qwen 2.5 / 離線範本) and disclaimer.
 * - Displays visible MB download progress bar when Qwen downloads on first use.
 * - Supports live token streaming, "停止" (AbortController), instant fallback to
 *   offline template, and "存到卡片" (saves tip to card.aiTip).
 * @namespace App.aiPanel
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const AI_SCRIPTS = [
    'js/ai/templates.js',
    'js/ai/nano.js',
    'js/ai/qwen.js',
    'js/ai/index.js',
  ];

  function _t(key, params) {
    return App.i18n ? App.i18n.t(key, params) : key;
  }

  function _formatMB(bytes) {
    return (Math.max(0, bytes || 0) / (1024 * 1024)).toFixed(1);
  }

  function _formatSeconds(ms) {
    const val = Math.max(0, Number(ms) || 0) / 1000;
    return val.toFixed(1);
  }

  function _deviceLabel(device) {
    if (device === 'webgpu') return 'WebGPU';
    if (device === 'wasm') return 'WASM';
    return '';
  }

  function _sourceLabel(source, device, modelLabel) {
    if (source === 'nano') return _t('ai.source.nano');
    if (source === 'qwen') {
      const base = modelLabel || _t('ai.source.qwen');
      const dev = _deviceLabel(device);
      return dev ? `${base} · ${dev}` : base;
    }
    return _t('ai.source.template');
  }

  function _fallbackNoteText(note) {
    if (!note) return '';
    if (note === 'aborted') return _t('ai.note_aborted');
    if (note === 'timeout') return _t('ai.note_timeout');
    if (note === 'download_error') return _t('ai.download_error');
    if (note === 'load_error' || note === 'out_of_memory') return _t('ai.load_error');
    if (note === 'load_error_15b') return _t('ai.load_error_15b');
    return _t('ai.note_fallback');
  }

  function _buildHighlightedSentence(sentence, matchedText, targetWord) {
    const { el } = App.dom;
    const text = String(sentence || '');
    const container = el('div', { className: 'ai-result-text ai-example-sentence', 'data-ai-example': 'true' });
    if (!text) return container;

    let needle = matchedText ? String(matchedText).trim() : '';
    if (!needle && targetWord && App.ai && typeof App.ai.findTargetMatch === 'function') {
      needle = App.ai.findTargetMatch(text, targetWord) || '';
    }
    if (!needle && targetWord) needle = String(targetWord).trim();

    if (needle) {
      const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = text.match(new RegExp(`(^|[^A-Za-z])(${esc})(?=$|[^A-Za-z])`, 'i'));
      let idx = -1;
      let len = needle.length;
      if (m) {
        idx = m.index + m[1].length;
        len = m[2].length;
      } else {
        idx = text.toLowerCase().indexOf(needle.toLowerCase());
      }
      if (idx >= 0) {
        const before = text.slice(0, idx);
        const hit = text.slice(idx, idx + len);
        const after = text.slice(idx + len);
        if (before) container.appendChild(document.createTextNode(before));
        container.appendChild(el('mark', { className: 'ai-highlight', 'data-ai-highlight': 'true', text: hit }));
        if (after) container.appendChild(document.createTextNode(after));
        return container;
      }
    }

    container.textContent = text;
    return container;
  }

  /**
   * Ensure AI backend modules & stylesheet are loaded (lazy under file://).
   * @returns {Promise<void>}
   */
  function ensureAiLoaded() {
    if (App.loadStyles) App.loadStyles(['css/pages/ai.css']);
    if (App.ai && typeof App.ai.explainMistake === 'function') return Promise.resolve();
    if (App.loadScripts) return App.loadScripts(AI_SCRIPTS);
    return Promise.reject(new Error('Script loader unavailable'));
  }

  /**
   * Create an interactive AI explanation panel for Feature A (錯題解說).
   * @param {Object} facts
   * @param {{ autoStart?: boolean, forceTier?: string, onSavedTip?: (tip: string) => void }} [opts]
   * @returns {{ root: HTMLElement, start: (tierOverride?: string) => Promise<Object|null>, stop: () => void }}
   */
  function create(facts, opts) {
    const o = opts || {};
    const { el, clear } = App.dom;

    let controller = null;
    let running = false;
    let savedTip = false;

    const sourceBadge = el('span', { className: 'ai-source-badge', text: _t('misc.loading') });
    const bodySlot = el('div');
    const timingEl = el('span', { className: 'text-small', text: '' });

    const root = el('section', {
      className: 'ai-panel',
      'data-ai-panel': 'true',
      'aria-live': 'polite',
    }, [
      el('div', { className: 'ai-panel-head' }, [
        el('span', { className: 'ai-panel-title', text: _t('ai.panel_title') }),
        sourceBadge,
      ]),
      bodySlot,
      el('div', { className: 'ai-panel-foot' }, [
        el('span', { text: _t('ai.disclaimer') }),
        timingEl,
      ]),
    ]);

    function stop() {
      if (controller) {
        try { controller.abort(); } catch (_e) { /* ignore */ }
        controller = null;
      }
      running = false;
    }

    function renderResult(res) {
      clear(bodySlot);
      sourceBadge.textContent = _sourceLabel(res.source, res.device, res.modelLabel);
      const sec = _formatSeconds(res.elapsedMs);
      timingEl.textContent = _t('ai.elapsed', { sec });

      const rows = [
        el('div', { className: 'ai-result-row' }, [
          el('div', { className: 'ai-result-label', text: _t('ai.label_why') }),
          el('div', { className: 'ai-result-text', 'data-ai-why': 'true', text: res.why }),
        ]),
        el('div', { className: 'ai-result-row' }, [
          el('div', { className: 'ai-result-label', text: _t('ai.label_tip') }),
          el('div', { className: 'ai-result-text', 'data-ai-tip': 'true', text: res.tip }),
        ]),
      ];

      if (res.example) {
        const isAiExample = res.exampleSource === 'qwen' || res.exampleSource === 'nano';
        const rowLabel = isAiExample ? _t('ai.label_ai_example') : _t('ai.example_source_card');
        const badgeText = isAiExample
          ? _sourceLabel(res.exampleSource, res.device, res.modelLabel)
          : _t('ai.example_source_card');
        const exampleChildren = [
          el('div', { className: 'ai-example-head' }, [
            el('span', { className: 'ai-result-label', style: 'margin: 0;', text: rowLabel }),
            el('span', { className: 'ai-example-badge', 'data-ai-example-badge': 'true', text: badgeText }),
          ]),
          _buildHighlightedSentence(res.example, res.matchedText, res.targetWord),
        ];
        if (res.targetMeaningZh) {
          const meaningLine = res.targetWord
            ? `${res.targetWord}：${res.targetMeaningZh}`
            : res.targetMeaningZh;
          exampleChildren.push(
            el('div', { className: 'ai-example-meaning', 'data-ai-example-meaning': 'true', text: meaningLine })
          );
        }
        rows.push(
          el('div', {
            className: 'ai-result-row ai-example-row',
            'data-ai-example-row': 'true',
            'data-example-source': res.exampleSource || 'ai',
          }, exampleChildren)
        );
      }

      if (res.fellBack && res.note) {
        rows.push(el('p', { className: 'text-small text-muted', style: 'margin: 0;', text: _fallbackNoteText(res.note) }));
      }

      const actions = [];
      const saveCardId = (facts && facts.cardId) || res.targetCardId || null;
      if (saveCardId && res.tip && App.store && App.store.cards) {
        const saveBtn = el('button', {
          type: 'button',
          className: 'btn ' + (savedTip ? 'btn-ghost' : 'btn-secondary'),
          disabled: savedTip,
          onClick: () => {
            App.store.cards.update(saveCardId, { aiTip: res.tip });
            savedTip = true;
            saveBtn.disabled = true;
            saveBtn.textContent = `○ ${_t('ai.saved_to_card')}`;
            if (App.toast) App.toast.show(_t('ai.saved_to_card'));
            if (typeof o.onSavedTip === 'function') o.onSavedTip(res.tip);
          },
        }, [el('span', { className: 'btn-label', text: savedTip ? `○ ${_t('ai.saved_to_card')}` : _t('ai.save_to_card') })]);
        actions.push(saveBtn);
      }

      if (res.fellBack) {
        actions.push(
          el('button', {
            type: 'button',
            className: 'btn btn-ghost',
            onClick: () => start(o.forceTier),
          }, [el('span', { className: 'btn-label', text: _t('btn.retry') })])
        );
      }

      bodySlot.appendChild(el('div', { className: 'ai-result-block', 'data-ai-state': 'done' }, rows));
      if (actions.length) {
        bodySlot.appendChild(el('div', { className: 'ai-panel-actions', style: 'margin-top: var(--space-2);' }, actions));
      }
    }

    async function start(tierOverride) {
      stop();
      running = true;
      controller = new AbortController();
      timingEl.textContent = '';

      const progressFill = el('div', { className: 'ai-progress-fill', style: 'width: 0%;' });
      const progressText = el('div', { className: 'ai-progress-text', text: _t('ai.preparing') });
      const progressWrap = el('div', { className: 'ai-progress-wrap', hidden: true }, [
        el('div', { className: 'ai-progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, [progressFill]),
        progressText,
      ]);

      const streamBox = el('div', { className: 'ai-stream-box', text: _t('ai.thinking') });
      const stopBtn = el('button', {
        type: 'button',
        className: 'btn btn-secondary',
        'data-ai-stop': 'true',
        onClick: () => stop(),
      }, [el('span', { className: 'btn-label', text: _t('btn.stop') })]);

      const tplBtn = el('button', {
        type: 'button',
        className: 'btn btn-ghost',
        onClick: () => {
          stop();
          start('template');
        },
      }, [el('span', { className: 'btn-label', text: _t('ai.use_template_now') })]);

      const instantReasonText = (App.ai && typeof App.ai.buildDeterministicReason === 'function')
        ? App.ai.buildDeterministicReason(facts)
        : '';
      const instantTipText = (App.ai && typeof App.ai.buildDeterministicTip === 'function')
        ? App.ai.buildDeterministicTip(facts)
        : '';

      const instantReasonRow = instantReasonText
        ? el('div', { className: 'ai-result-row' }, [
          el('div', { className: 'ai-result-label', text: _t('ai.label_why') }),
          el('div', { className: 'ai-result-text', text: instantReasonText }),
        ])
        : null;
      const instantTipRow = instantTipText
        ? el('div', { className: 'ai-result-row' }, [
          el('div', { className: 'ai-result-label', text: _t('ai.label_tip') }),
          el('div', { className: 'ai-result-text', text: instantTipText }),
        ])
        : null;

      clear(bodySlot);
      bodySlot.appendChild(
        el('div', { className: 'ai-result-block', 'data-ai-state': 'loading' }, [
          instantReasonRow,
          instantTipRow,
          progressWrap,
          streamBox,
          el('div', { className: 'ai-panel-actions' }, [stopBtn, tplBtn]),
        ])
      );

      try {
        await ensureAiLoaded();
        if (!instantReasonRow && App.ai && typeof App.ai.buildDeterministicReason === 'function') {
          const rText = App.ai.buildDeterministicReason(facts);
          if (rText) {
            bodySlot.firstElementChild.insertBefore(
              el('div', { className: 'ai-result-row' }, [
                el('div', { className: 'ai-result-label', text: _t('ai.label_why') }),
                el('div', { className: 'ai-result-text', text: rText }),
              ]),
              progressWrap
            );
          }
        }
        if (!instantTipRow && App.ai && typeof App.ai.buildDeterministicTip === 'function') {
          const tText = App.ai.buildDeterministicTip(facts);
          if (tText) {
            bodySlot.firstElementChild.insertBefore(
              el('div', { className: 'ai-result-row' }, [
                el('div', { className: 'ai-result-label', text: _t('ai.label_tip') }),
                el('div', { className: 'ai-result-text', text: tText }),
              ]),
              progressWrap
            );
          }
        }
        const status = await App.ai.detect();
        const plannedTier = tierOverride || o.forceTier || status.activeTier;
        const plannedDevice = plannedTier === 'qwen' && status.qwen ? status.qwen.device : null;
        const plannedModelLabel = plannedTier === 'qwen' && status.qwen ? status.qwen.modelLabel : null;
        sourceBadge.textContent = _sourceLabel(plannedTier, plannedDevice, plannedModelLabel);

        if (plannedTier === 'qwen' && status.qwen && !status.qwen.cached) {
          progressWrap.hidden = false;
          progressText.textContent = _t('ai.downloading', { mb: status.qwen.approxMB });
        }

        const res = await App.ai.explainMistake(facts, {
          forceTier: tierOverride || o.forceTier,
          signal: controller ? controller.signal : undefined,
          onDevice: (dev, modelLbl) => {
            sourceBadge.textContent = _sourceLabel('qwen', dev, modelLbl || plannedModelLabel);
          },
          onProgress: (p) => {
            progressWrap.hidden = false;
            const total = p.total || 0;
            const loaded = p.loaded || 0;
            const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : (p.pct || 0);
            progressFill.style.width = `${pct}%`;
            if (total > 0) {
              progressText.textContent = `${p.file || 'Qwen 2.5'} · ${_formatMB(loaded)} / ${_formatMB(total)} MB (${pct}%)`;
            } else {
              progressText.textContent = _t('ai.downloading', { mb: status.qwen ? status.qwen.approxMB : 467 });
            }
          },
          onToken: (_chunk, full) => {
            progressWrap.hidden = true;
            streamBox.textContent = full;
          },
        });

        running = false;
        controller = null;
        renderResult(res);
        return res;
      } catch (_err) {
        running = false;
        controller = null;
        const fallbackRes = App.ai && App.ai.templates
          ? Object.assign(App.ai.templates.explainMistake(facts), {
            source: 'template',
            fellBack: true,
            note: 'error',
            elapsedMs: 1,
          })
          : { why: _t('error.generic'), tip: '', example: null, source: 'template', fellBack: true, note: 'error', elapsedMs: 1 };
        renderResult(fallbackRes);
        return fallbackRes;
      }
    }

    if (o.autoStart !== false) {
      start(o.forceTier);
    }

    return { root, start, stop, isRunning: () => running };
  }

  /**
   * Open Feature A inside App.modal, cancelling generation if closed early.
   * @param {Object} facts
   * @param {{ title?: string, forceTier?: string }} [opts]
   * @returns {{ stop: () => void }}
   */
  function openModal(facts, opts) {
    const o = opts || {};
    const panel = create(facts, { autoStart: true, forceTier: o.forceTier });
    if (App.modal) {
      App.modal.open({
        title: o.title || _t('ai.panel_title'),
        body: panel.root,
        actions: [{
          label: _t('btn.close'),
          variant: 'secondary',
          onClick: () => panel.stop(),
        }],
        onClose: () => panel.stop(),
      });
    }
    return panel;
  }

  App.aiPanel = {
    AI_SCRIPTS,
    ensureAiLoaded,
    create,
    openModal,
  };
})();
