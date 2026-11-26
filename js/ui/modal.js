/**
 * Accessible Modal dialog with Esc, backdrop click, focus trap, and focus return.
 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  let activeBackdrop = null;
  let previousFocus = null;
  let keyHandler = null;
  let activeOnClose = null;

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  /**
   * Close the currently open modal and return focus to the trigger.
   * @param {boolean} [confirmed=false]
   */
  function close(confirmed = false) {
    const onCloseCb = activeOnClose;
    activeOnClose = null;
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    if (activeBackdrop) {
      activeBackdrop.remove();
      activeBackdrop = null;
    }
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
      previousFocus = null;
    }
    if (!confirmed && typeof onCloseCb === 'function') {
      onCloseCb();
    }
  }

  /**
   * Open a modal dialog.
   * @param {{ title: string, body: string|Node, actions?: { label: string, variant?: string, onClick?: () => void }[], onClose?: () => void }} opts
   */
  function open({ title, body, actions = [], onClose = null }) {
    close(true);
    previousFocus = document.activeElement;
    activeOnClose = typeof onClose === 'function' ? onClose : null;

    const { el } = App.dom;
    const closeLabel = App.i18n ? App.i18n.t('modal.close') : '關閉視窗';
    const closeBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-icon',
      'aria-label': closeLabel,
      onClick: () => close(false),
    }, [App.icons.svg('close')]);

    const bodyNode = typeof body === 'string' ? el('p', { text: body }) : body;
    const footerBtns = actions.map((act) =>
      el('button', {
        type: 'button',
        className: `btn ${act.variant ? `btn-${act.variant}` : 'btn-secondary'}`,
        onClick: () => {
          if (act.onClick) act.onClick();
          close(true);
        },
      }, [el('span', { className: 'btn-label', text: act.label })])
    );

    const dialog = el('div', {
      className: 'modal-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'as-modal-title',
    }, [
      el('div', { className: 'modal-head' }, [
        el('h2', { id: 'as-modal-title', text: title }),
        closeBtn,
      ]),
      bodyNode,
      footerBtns.length ? el('div', { className: 'modal-foot' }, footerBtns) : null,
    ]);

    activeBackdrop = el('div', {
      className: 'modal-backdrop',
      onClick: (ev) => {
        if (ev.target === activeBackdrop) close(false);
      },
    }, [dialog]);

    keyHandler = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close(false);
        return;
      }
      if (ev.key === 'Tab') {
        const focusables = getFocusable(dialog);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', keyHandler);
    document.body.appendChild(activeBackdrop);
    const focusables = getFocusable(dialog);
    if (focusables.length) focusables[0].focus();
  }

  App.modal = { open, close };
})();
