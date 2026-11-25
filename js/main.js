/**
 * Application entry point (M0 bootstrap stub).
 * Verifies the course word list loaded cleanly and renders the M0 status shell.
 */

const root = document.getElementById('app');

/**
 * Create a DOM element with optional className and textContent.
 * Never uses innerHTML.
 * @param {string} tag
 * @param {{ className?: string, text?: string, href?: string }} [opts]
 * @param {Node[]} [children]
 * @returns {HTMLElement}
 */
function createEl(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.href) node.setAttribute('href', opts.href);
  for (const child of children) {
    if (child) node.appendChild(child);
  }
  return node;
}

function renderM0Status() {
  if (!root) return;
  const data = window.ENGLISH_2000_DATA;
  const hasData = Boolean(data && Array.isArray(data.words));
  const rowCount = hasData ? data.words.length : 0;
  const uniqueCount = hasData && data.stats ? data.stats.uniqueWords : 0;

  const badge = createEl('span', {
    className: 'badge',
    text: hasData ? 'M0 就緒' : '資料未載入',
  });

  const summary = createEl('span', {
    text: hasData
      ? `已載入 ${rowCount} 筆課綱單字列（不重複字彙 ${uniqueCount} 個），${data.chapters.length} 個章節。`
      : '無法讀取 data/english-2000-data.js，請確認透過本機伺服器開啟。',
  });

  const statusRow = createEl('div', { className: 'status-row' }, [badge, summary]);

  const actions = createEl('div', { className: 'actions' }, [
    createEl('a', {
      className: 'btn',
      text: '開啟測試執行器 (tests/test.html)',
      href: './tests/test.html',
    }),
    createEl('a', {
      className: 'btn secondary',
      text: '檢視資料盤點 (docs/DATA.md)',
      href: './docs/DATA.md',
    }),
  ]);

  const card = createEl('section', { className: 'card' }, [
    createEl('h1', { text: '放學後 After School' }),
    createEl('p', {
      className: 'muted',
      text: 'Milestone 0：專案骨架、課程資料盤點與測試執行器已就緒。',
    }),
    statusRow,
    actions,
  ]);

  root.replaceChildren(card);

  window.App = {
    milestone: 'M0',
    dataLoaded: hasData,
    wordRows: rowCount,
    uniqueWords: uniqueCount,
  };
}

window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

renderM0Status();
