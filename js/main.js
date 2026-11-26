/**
 * Application entry point (M1: design system + #/styleguide dev route, file:// compatible).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  const root = document.getElementById('app');
  let activePage = null;

  function renderHome() {
    const { el } = App.dom;
    const data = window.ENGLISH_2000_DATA;
    const hasData = Boolean(data && Array.isArray(data.words));
    const rowCount = hasData ? data.words.length : 0;
    const uniqueCount = hasData && data.stats ? data.stats.uniqueWords : 0;
    const chapterCount = hasData && Array.isArray(data.chapters) ? data.chapters.length : 0;
    const modeLabel = window.location.protocol === 'file:' ? '本機檔案 (file://)' : `伺服器 (${window.location.protocol})`;

    const home = el('main', { className: 'app-container' }, [
      el('section', { className: 'surface-card', style: 'max-width: 720px;' }, [
        el('div', { className: 'skill-tabs', style: 'margin-bottom: 12px;' }, [
          el('span', { className: 'skill-tab skill-tab--vocab', text: '單字' }),
          el('span', { className: 'skill-tab skill-tab--grammar', text: '文法' }),
          el('span', { className: 'skill-tab skill-tab--dialogue', text: '對話' }),
        ]),
        el('h1', { text: '放學後 After School' }),
        el('p', {
          className: 'text-muted',
          text: 'Milestone 1：文具紙張設計系統、雙主題 tokens 與全元件樣式表已就緒。',
        }),
        el('div', {
          style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:var(--bg);margin-bottom:16px;',
        }, [
          el('span', {
            className: 'chip is-selected',
            text: hasData ? 'M1 就緒' : '資料未載入',
          }),
          el('span', {
            text: hasData
              ? `已載入 ${rowCount} 筆課綱單字列（不重複字彙 ${uniqueCount} 個），${chapterCount} 個章節 · ${modeLabel}。`
              : '無法讀取 data/english-2000-data.js，請確認檔案路徑完整。',
          }),
        ]),
        el('div', { className: 'sg-row' }, [
          el('a', { className: 'btn btn-primary', href: '#/styleguide' }, [
            el('span', { className: 'btn-label', text: '開啟設計系統樣式表 (#/styleguide)' }),
          ]),
          el('a', { className: 'btn btn-secondary', href: './tests/test.html' }, [
            el('span', { className: 'btn-label', text: '執行測試 (tests/test.html)' }),
          ]),
          el('a', { className: 'btn btn-secondary', href: './tests/ai-spike.html' }, [
            el('span', { className: 'btn-label', text: 'AI 模型測試 (tests/ai-spike.html)' }),
          ]),
        ]),
      ]),
    ]);

    root.replaceChildren(home);
  }

  function route() {
    if (!root) return;
    if (activePage && typeof activePage.unmount === 'function') {
      activePage.unmount();
      activePage = null;
    }

    const hash = window.location.hash || '#/';
    if (hash === '#/styleguide' && App.pages && App.pages.styleguide) {
      activePage = App.pages.styleguide;
      activePage.mount(root);
      return;
    }

    renderHome();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
  });

  const data = window.ENGLISH_2000_DATA;
  Object.assign(App, {
    milestone: 'M1',
    protocol: window.location.protocol,
    dataLoaded: Boolean(data && Array.isArray(data.words)),
    wordRows: data && Array.isArray(data.words) ? data.words.length : 0,
    uniqueWords: data && data.stats ? data.stats.uniqueWords : 0,
  });

  route();
})();
