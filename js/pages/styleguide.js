/**
 * Dev Styleguide page (#/styleguide) showcasing all Section 2 tokens and components
 * across Light (Afternoon) and Dark (Night) themes, with live contrast checks.
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let activeTimers = [];
  let activeKeyHandler = null;

  function makeCircleMark() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('class', 'grade-circle-svg');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'grade-circle-path');
    path.setAttribute('d', 'M16,4 C23,4 28,9.5 28,16 C28,23 22.5,28 16,28 C9,28 4,22.5 4,16 C4,9.5 9.5,4.5 15.5,4.2');
    svg.appendChild(path);
    return svg;
  }

  function buildButtonMatrix(el) {
    const variants = [
      { cls: 'btn-primary', label: '開始 10 題練習' },
      { cls: 'btn-secondary', label: '檢視單字卡組' },
      { cls: 'btn-ghost', label: '略過這一節' },
      { cls: 'btn-danger', label: '清除示範資料' },
    ];
    const states = [
      { key: 'default', name: 'Default' },
      { key: 'hover', name: 'Hover', extra: 'is-hover' },
      { key: 'active', name: 'Active', extra: 'is-active' },
      { key: 'focus', name: 'Focus', extra: 'is-focus-preview' },
      { key: 'disabled', name: 'Disabled', disabled: true },
      { key: 'loading', name: 'Loading', extra: 'is-loading', loading: true },
    ];

    return el('div', { className: 'sg-grid sg-grid--2' }, variants.map((v) =>
      el('div', { className: 'surface-card' }, [
        el('h3', { text: v.cls }),
        el('div', { className: 'sg-state-table' }, states.map((s) =>
          el('div', { className: 'sg-state-cell' }, [
            el('span', { className: 'text-small text-muted', text: s.name }),
            el('button', {
              type: 'button',
              className: `btn ${v.cls}${s.extra ? ` ${s.extra}` : ''}`,
              disabled: Boolean(s.disabled),
            }, [
              el('span', { className: 'btn-label', text: v.label }),
              s.loading ? el('span', { className: 'btn-spinner', 'aria-hidden': 'true' }) : null,
            ]),
          ])
        )),
      ])
    ));
  }

  function buildContrastSection(el) {
    const out = el('div', { className: 'sg-grid sg-grid--3' });

    function relLum(rgbStr) {
      const m = rgbStr.match(/\d+/g);
      if (!m) return 0;
      const [r, g, b] = m.slice(0, 3).map((n) => {
        const v = Number(n) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function computeContrast() {
      out.replaceChildren();
      const cs = getComputedStyle(document.documentElement);
      const probe = el('div', { style: 'position:absolute;left:-9999px;top:-9999px;' });
      document.body.appendChild(probe);

      const getRgb = (varName) => {
        probe.style.color = cs.getPropertyValue(varName).trim();
        return getComputedStyle(probe).color;
      };

      const pairs = [
        ['ink / bg', '--ink', '--bg'],
        ['ink / surface', '--ink', '--surface'],
        ['muted / bg', '--muted', '--bg'],
        ['correct / surface', '--correct', '--surface'],
        ['wrong / surface', '--wrong', '--surface'],
        ['on-ink / ink', '--on-ink', '--ink'],
        ['on-wrong / wrong', '--on-wrong', '--wrong'],
        ['on-highlight / highlight', '--on-highlight', '--highlight'],
        ['on-tab / tab-dialogue', '--on-tab', '--tab-dialogue'],
      ];

      for (const [label, fgVar, bgVar] of pairs) {
        const l1 = relLum(getRgb(fgVar));
        const l2 = relLum(getRgb(bgVar));
        const ratio = ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
        const pass = Number(ratio) >= 4.5;
        out.appendChild(el('div', { className: 'sg-swatch' }, [
          el('span', { className: 'mono text-small', text: label }),
          el('span', {
            className: 'mono text-small',
            style: `color: var(${pass ? '--correct' : '--wrong'}); font-weight: 700;`,
            text: `${ratio}:1 ${pass ? '○' : '✗'}`,
          }),
        ]));
      }
      probe.remove();
    }

    return { node: out, refresh: computeContrast };
  }

  function mount(root) {
    unmount();
    const { el } = App.dom;
    const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = currentTheme;

    const contrast = buildContrastSection(el);
    const themeLabel = el('span', {
      className: 'mono text-small',
      text: currentTheme === 'dark' ? '目前：深色 Night' : '目前：淺色 Afternoon',
    });

    const themeBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary',
      onClick: () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        themeLabel.textContent = next === 'dark' ? '目前：深色 Night' : '目前：淺色 Afternoon';
        contrast.refresh();
      },
    }, [
      App.icons.svg(currentTheme === 'dark' ? 'sun' : 'moon'),
      el('span', { className: 'btn-label', text: '切換淺色 / 深色主題' }),
    ]);

    const header = el('header', { className: 'sg-header' }, [
      el('div', {}, [
        el('h1', { text: '放學後 After School · 設計系統樣式表' }),
        el('p', { className: 'text-muted', text: '檢查淺色 (Afternoon) 與深色 (Night) 下的所有元件狀態、排版與對比度。' }),
      ]),
      el('div', { className: 'sg-toolbar' }, [
        themeLabel,
        themeBtn,
        el('a', { className: 'btn btn-ghost', href: '#/' }, [el('span', { className: 'btn-label', text: '← 回首頁' })]),
      ]),
    ]);

    // Section 1: Swatches & live contrast
    const swatches = [
      ['--bg', '紙張背景'],
      ['--surface', '卡片表面'],
      ['--ink', '主墨色'],
      ['--muted', '次要文字'],
      ['--line', '格線邊框'],
      ['--highlight', '螢光筆標記'],
      ['--correct', '批改正確綠'],
      ['--wrong', '紅筆批改'],
      ['--tab-vocab', '單字標籤'],
      ['--tab-grammar', '文法標籤'],
      ['--tab-dialogue', '對話標籤'],
    ].map(([token, desc]) =>
      el('div', { className: 'sg-swatch' }, [
        el('div', {}, [
          el('div', { className: 'mono text-small', text: token }),
          el('div', { className: 'text-small text-muted', text: desc }),
        ]),
        el('span', { className: 'sg-swatch-chip', style: `background-color: var(${token});` }),
      ])
    );

    // Section 2: Typography
    const typoBox = el('div', { className: 'surface-card' }, [
      el('div', { style: 'font-family: var(--font-display); font-size: var(--text-display); font-weight: 700; line-height: 1.15;', text: 'library · Display' }),
      el('h1', { text: 'H1 標題：今日課表與單字練習' }),
      el('h2', { text: 'H2 區段：四格分類牆' }),
      el('p', { text: 'Body 內文（16px，中文行高 1.7）：放學後，才是真正的英文課。每個錯誤都會記錄在卡片上，並由 AI 用卡片上的真實資料解釋。' }),
      el('p', { style: 'font-family: var(--font-zh-card); font-size: 24px; font-weight: 700;', text: '霞鶩文楷 TC：圖書館 · 溫柔手寫字卡感' }),
      el('p', { className: 'mono text-small', text: 'JetBrains Mono: 12.0 m | 600 / 800 pts | 00:42.8' }),
    ]);

    // Section 3: Flashcards (normal + long word + no IPA)
    const normalCard = App.flashcard.create({
      word: 'library',
      ipa: null,
      pos: 'n.',
      zh: '圖書館',
      example: 'I study English in the library after school.',
      exampleZh: '我放學後在圖書館讀英文。',
      aiTip: 'libr- (書) + -ary (場所) → 放書的地方就是圖書館。',
      skills: ['vocab', 'dialogue'],
    }, {
      onSpeak: (slow) => App.toast.show(slow ? '慢速朗讀示範 (0.6x)' : '標準朗讀示範 (0.9x)'),
      onHistory: () => App.toast.show('M3 將開啟單字學習紀錄時間軸'),
    });

    const longCard = App.flashcard.create({
      word: 'responsibility',
      ipa: '/rɪˌspɑːnsəˈbɪləti/',
      pos: 'n.',
      zh: '責任',
      example: 'Taking care of your own notes is your responsibility.',
      exampleZh: '整理自己的筆記是你的責任。',
      skills: ['vocab', 'grammar'],
    });

    // Section 4: Answer tiles with animated ○ and ✗
    const tileSelected = el('button', { type: 'button', className: 'answer-tile is-selected' }, [
      el('span', { text: 'selected — 螢光筆選取狀態' }),
      el('span', { className: 'text-small', text: '已選 1' }),
    ]);
    const tileCorrect = el('button', { type: 'button', className: 'answer-tile is-correct' }, [
      el('span', { text: 'ate — 動詞不規則過去式正確' }),
      el('span', { className: 'grade-mark' }, [makeCircleMark()]),
    ]);
    const tileWrong = el('button', { type: 'button', className: 'answer-tile is-wrong' }, [
      el('span', { text: 'eated — 紅筆批改錯誤示範' }),
      el('span', { className: 'grade-mark' }, [el('span', { className: 'grade-cross', text: '✗' })]),
    ]);

    // Section 5: Inputs, chips, switches, tabs, progress, skeleton
    const inputDemo = el('div', { className: 'sg-grid sg-grid--2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', for: 'sg-in-1', text: '英文單字（驗證錯誤示範）' }),
        el('input', { id: 'sg-in-1', className: 'input is-error', type: 'text', value: 'recieve' }),
        el('div', { className: 'field-msg is-error', text: '✗ 拼字提醒：c 後面通常為 ei（receive）' }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field-label', for: 'sg-in-2', text: '中文意思（正常 / 停用）' }),
        el('input', { id: 'sg-in-2', className: 'input', type: 'text', value: '收到', disabled: true }),
        el('div', { className: 'field-msg is-valid', text: '○ 已鎖定為課綱標準釋義' }),
      ]),
    ]);

    const switchInput = el('input', { type: 'checkbox', className: 'switch-input', checked: true });
    const switchCtrl = el('label', { className: 'switch-row' }, [
      switchInput,
      el('span', { className: 'switch-track' }, [el('span', { className: 'switch-thumb' })]),
      el('span', { text: '安心模式（關閉恐怖音效與畫面閃爍）' }),
    ]);

    const controlsBox = el('div', { className: 'surface-card' }, [
      el('div', { className: 'sg-row', style: 'margin-bottom: 16px;' }, [
        el('button', { type: 'button', className: 'chip is-selected', text: '單字卡組' }),
        el('button', { type: 'button', className: 'chip', text: '我常錯的字' }),
        el('button', { type: 'button', className: 'chip', disabled: true, text: '未解鎖' }),
        switchCtrl,
      ]),
      el('div', { className: 'tabs', role: 'tablist', style: 'margin-bottom: 16px;' }, [
        el('button', { type: 'button', className: 'tab-btn', role: 'tab', 'aria-selected': 'true', text: '單字內容' }),
        el('button', { type: 'button', className: 'tab-btn', role: 'tab', 'aria-selected': 'false', text: '學習紀錄' }),
      ]),
      el('div', { className: 'progress', role: 'progressbar', 'aria-valuenow': '65', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
        el('div', { className: 'progress-fill', style: 'width: 65%;' }),
      ]),
    ]);

    // Section 6: Stamp, Toast, Modal, AI Panel, In-game Keyboard
    const stampHost = el('div', { className: 'sg-row' }, [
      App.stamp.create({ title: '今日完課', sub: 'PERIOD 03', animate: false }),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary',
        onClick: () => {
          const fresh = App.stamp.create({ title: '完課紀念', sub: '11/26', animate: true });
          stampHost.replaceChild(fresh, stampHost.firstElementChild);
        },
      }, [el('span', { className: 'btn-label', text: '重播蓋章動畫' })]),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary',
        onClick: () => App.toast.show('已刪除卡片', {
          actionLabel: '復原',
          onAction: () => App.toast.show('已復原卡片'),
        }),
      }, [el('span', { className: 'btn-label', text: '顯示 Toast（附復原）' })]),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary',
        onClick: () => App.modal.open({
          title: '確定要離開第 13 節課嗎？',
          body: '中途離開不會儲存本次操行分數與統計資料。',
          actions: [
            { label: '繼續上課', variant: 'secondary' },
            { label: '確定離開', variant: 'danger', onClick: () => App.toast.show('已返回遊戲列表') },
          ],
        }),
      }, [el('span', { className: 'btn-label', text: '開啟 Modal 對話框' })]),
    ]);

    const aiBody = el('p', {
      className: 'ai-panel-body',
      text: '「receive」容易把 ei 寫成 ie。記住口訣：c 後面先寫 e 再寫 i（receive）。',
    });
    const aiStopBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      onClick: () => {
        activeTimers.forEach((t) => clearInterval(t));
        activeTimers = [];
        aiStopBtn.disabled = true;
      },
    }, [el('span', { className: 'btn-label', text: '停止' })]);
    aiStopBtn.disabled = true;

    const aiPanel = el('div', { className: 'ai-panel' }, [
      el('div', { className: 'ai-panel-head' }, [
        el('div', { className: 'sg-row' }, [
          App.icons.svg('sparkle'),
          el('strong', { text: 'AI 錯題解說面板' }),
          el('span', { className: 'ai-source-badge', text: '離線範本' }),
        ]),
        el('div', { className: 'sg-row' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => {
              const full = '「eat」是不規則動詞，過去式為 ate（不是 eated）。例句：I ate lunch at school.';
              let i = 0;
              aiBody.textContent = '';
              aiStopBtn.disabled = false;
              const timer = setInterval(() => {
                i += 2;
                aiBody.textContent = full.slice(0, i);
                if (i >= full.length) {
                  clearInterval(timer);
                  aiStopBtn.disabled = true;
                }
              }, 35);
              activeTimers.push(timer);
            },
          }, [el('span', { className: 'btn-label', text: '模擬串流輸出' })]),
          aiStopBtn,
        ]),
      ]),
      aiBody,
      el('p', { className: 'ai-disclaimer', text: 'AI 可能出錯，請以卡片內容為準' }),
    ]);

    let kbScrambled = false;
    const kbWrap = el('div');
    const renderKb = () => {
      kbWrap.replaceChildren(
        App.keyboard.create({
          rottenKeys: ['e', 'r', 't'],
          scrambled: kbScrambled,
          seed: 13,
          onKey: (k) => App.toast.show(`按下按鍵：${k}`),
        })
      );
    };
    renderKb();

    // Section 7: 4 Screen States
    const fourStates = el('div', { className: 'sg-grid sg-grid--2' }, [
      el('div', { className: 'state-box' }, [
        el('strong', { text: '1. 載入中 (Skeleton)' }),
        el('div', { className: 'skeleton skeleton-line', style: 'width: 60%;' }),
        el('div', { className: 'skeleton skeleton-card', style: 'width: 100%;' }),
      ]),
      el('div', { className: 'state-box' }, [
        el('strong', { text: '2. 空狀態 (Empty)' }),
        el('p', { className: 'text-muted', text: '還沒有卡片，新增第一張' }),
        el('button', { type: 'button', className: 'btn btn-primary' }, [el('span', { className: 'btn-label', text: '新增第一張單字卡' })]),
      ]),
      el('div', { className: 'state-box' }, [
        el('strong', { text: '3. 錯誤狀態 (Error)' }),
        el('p', { style: 'color: var(--wrong);', text: '模型下載中斷，已改用離線題庫' }),
        el('button', { type: 'button', className: 'btn btn-secondary' }, [el('span', { className: 'btn-label', text: '重試' })]),
      ]),
      el('div', { className: 'state-box' }, [
        el('strong', { text: '4. 內容狀態 (Content)' }),
        el('p', { text: '今日課表 3 節課已排定，先從 10 張單字卡開始。' }),
        el('button', { type: 'button', className: 'btn btn-primary' }, [el('span', { className: 'btn-label', text: '開始今日第 1 節課' })]),
      ]),
    ]);

    const main = el('main', { className: 'app-container' }, [
      header,
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '色彩與即時 WCAG 對比度檢查（目標 ≥ 4.5:1）' }),
        el('div', { className: 'sg-grid sg-grid--3', style: 'margin-bottom: 16px;' }, swatches),
        contrast.node,
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '字體與層級' }),
        typoBox,
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '按鈕矩陣（4 變體 × 6 狀態）' }),
        buildButtonMatrix(el),
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '活頁單字卡（紙張紋理、打孔、3D 翻轉、長字縮放）' }),
        el('div', { className: 'sg-grid sg-grid--2' }, [normalCard.root, longCard.root]),
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '作答方塊與批改標記（螢光筆 / 手繪紅圈 ○ / 紅叉 ✗）' }),
        el('div', { className: 'sg-grid sg-grid--3' }, [tileSelected, tileCorrect, tileWrong]),
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '表單、標籤、開關與進度條' }),
        inputDemo,
        el('div', { style: 'margin-top: 16px;' }, [controlsBox]),
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '紀念章、Toast 與 Modal' }),
        stampHost,
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: 'AI 解說面板與第 13 節課螢幕鍵盤（含腐蝕鎖定鍵與亂序）' }),
        el('div', { className: 'sg-grid sg-grid--2' }, [
          aiPanel,
          el('div', { className: 'surface-card' }, [
            el('div', { className: 'sg-row', style: 'margin-bottom: 12px;' }, [
              el('strong', { text: '腐蝕鍵上限 3 顆：E / R / T' }),
              el('button', {
                type: 'button',
                className: 'btn btn-secondary',
                onClick: () => {
                  kbScrambled = !kbScrambled;
                  renderKb();
                },
              }, [el('span', { className: 'btn-label', text: '切換亂序鍵盤' })]),
            ]),
            kbWrap,
          ]),
        ]),
      ]),
      el('section', { className: 'sg-section' }, [
        el('h2', { text: '每個畫面必備的 4 種狀態' }),
        fourStates,
      ]),
    ]);

    root.replaceChildren(main);
    contrast.refresh();
  }

  function unmount() {
    activeTimers.forEach((t) => clearInterval(t));
    activeTimers = [];
    if (activeKeyHandler) {
      document.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
    App.modal.close();
  }

  App.pages = App.pages || {};
  App.pages.styleguide = { mount, unmount };
})();
