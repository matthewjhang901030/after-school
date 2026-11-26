/**
 * Toast notification stack (max 3 stacked, auto-dismiss 3s, optional action).
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  const MAX_TOASTS = 3;
  let stackEl = null;

  function ensureStack() {
    if (stackEl && document.body.contains(stackEl)) return stackEl;
    stackEl = App.dom.el('div', {
      className: 'toast-stack',
      role: 'status',
      'aria-live': 'polite',
    });
    document.body.appendChild(stackEl);
    return stackEl;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} [opts]
   * @returns {() => void} dismiss function
   */
  function show(message, opts = {}) {
    const stack = ensureStack();
    const { actionLabel, onAction, duration = 3000 } = opts;

    while (stack.children.length >= MAX_TOASTS) {
      stack.firstElementChild.remove();
    }

    let timer = null;
    const dismiss = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (toastEl.parentNode) toastEl.remove();
    };

    const children = [App.dom.el('span', { text: message })];
    if (actionLabel && typeof onAction === 'function') {
      children.push(
        App.dom.el('button', {
          type: 'button',
          className: 'toast-action',
          text: actionLabel,
          onClick: () => {
            onAction();
            dismiss();
          },
        })
      );
    }

    const toastEl = App.dom.el('div', { className: 'toast' }, children);
    stack.appendChild(toastEl);

    if (duration > 0) {
      timer = setTimeout(dismiss, duration);
    }
    return dismiss;
  }

  App.toast = { show };
})();
