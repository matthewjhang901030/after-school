/**
 * Event bus for cross-feature communication.
 * Supported events: attempt:recorded, card:updated, progress:changed,
 *   stamp:earned, settings:changed, ai:status, route:changed
 * @namespace App.bus
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} fn  Called with the event data object.
   */
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} fn
   */
  function off(event, fn) {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  }

  /**
   * Emit an event, calling all subscribers with the given data.
   * Errors inside subscribers are caught and logged so one bad handler
   * never breaks others.
   * @param {string} event
   * @param {*} [data]
   */
  function emit(event, data) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (err) {
        console.error('[bus] Error in handler for', event, err);
      }
    }
  }

  /**
   * Remove all listeners for a given event (or all events if omitted).
   * Useful in tests.
   * @param {string} [event]
   */
  function clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }

  /**
   * Return current listener count for an event (testing aid).
   * @param {string} event
   * @returns {number}
   */
  function count(event) {
    const set = listeners.get(event);
    return set ? set.size : 0;
  }

  App.bus = { on, off, emit, clear, count };
})();
