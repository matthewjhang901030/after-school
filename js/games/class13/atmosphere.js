/**
 * 第 13 節課 — Procedural Web Audio atmosphere & PA loudspeaker announcements
 * (Section 4.3.6 & 4.3.7).
 * - 100% Web Audio API synthesis (zero external audio files, works offline under file://).
 * - Footsteps (low-pass thud) scale in rate & volume as distance drops.
 * - Subtle heartbeat pulse activates only below 3.0 m.
 * - Completely silent & no-op when safeMode === true; audio initializes ONLY after
 *   explicit user gesture ("進教室").
 * - stop() / destroy() cleanly disconnects & closes audio nodes on pause / unmount.
 * @namespace App.games.class13Atmosphere
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  App.games = App.games || {};

  const PA_LINES_ZH = [
    '廣播：「恭喜你入選夜間加強班。請繼續學習。」',
    '廣播：「請保持安靜，專心完成本節測驗。」',
    '廣播：「走廊燈光檢修中，請勿離開座位。」',
    '廣播：「距離下課還有一段時間，請持續作答。」',
  ];

  const PA_LINES_EN = [
    'PA: "Welcome to the midnight cram class. Please continue learning."',
    'PA: "Stay seated and focus on the projector."',
    'PA: "Hallway lights are under maintenance. Do not leave the room."',
    'PA: "Keep typing until the period bell rings."',
  ];

  function create() {
    let ctx = null;
    let enabled = false;
    let safeMode = false;
    let stepAccumMs = 0;
    let heartAccumMs = 0;

    function _ensureContext() {
      if (safeMode || !enabled) return null;
      if (ctx) {
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
          ctx.resume().catch(function () {});
        }
        return ctx;
      }
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (_e) {
        ctx = null;
      }
      return ctx;
    }

    function unlock(isSafe) {
      safeMode = Boolean(isSafe);
      enabled = !safeMode;
      if (enabled) _ensureContext();
    }

    function setSafeMode(isSafe) {
      safeMode = Boolean(isSafe);
      if (safeMode) stop();
    }

    function _playFootstep(closeness) {
      const ac = _ensureContext();
      if (!ac) return;
      try {
        const now = ac.currentTime;
        const osc = ac.createOscillator();
        const filter = ac.createBiquadFilter();
        const gain = ac.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(95 + closeness * 25, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180 + closeness * 420, now);

        const vol = 0.03 + closeness * 0.12;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } catch (_e) { /* ignore Web Audio errors */ }
    }

    function _playHeartbeat(closeness) {
      const ac = _ensureContext();
      if (!ac) return;
      try {
        const now = ac.currentTime;
        const beats = [0, 0.18];
        for (const offset of beats) {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(58, now + offset);
          osc.frequency.exponentialRampToValueAtTime(32, now + offset + 0.12);
          const vol = (offset === 0 ? 0.12 : 0.08) * Math.max(0.4, closeness);
          gain.gain.setValueAtTime(vol, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
          osc.connect(gain);
          gain.connect(ac.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.15);
        }
      } catch (_e) { /* ignore */ }
    }

    function playChime(isCorrect) {
      const ac = _ensureContext();
      if (!ac) return;
      try {
        const now = ac.currentTime;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = isCorrect ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(isCorrect ? 520 : 150, now);
        osc.frequency.exponentialRampToValueAtTime(isCorrect ? 660 : 95, now + 0.11);
        gain.gain.setValueAtTime(isCorrect ? 0.06 : 0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      } catch (_e) { /* ignore */ }
    }

    /**
     * Advance atmosphere timers on fixed timestep (dtMs).
     * @param {number} dtMs
     * @param {number} distanceM
     * @param {{ frozen?: boolean }} [opts]
     */
    function tick(dtMs, distanceM, opts) {
      if (safeMode || !enabled) return;
      const dt = Math.max(0, Number(dtMs) || 0);
      const d = Math.max(0, Math.min(12, Number(distanceM) || 0));
      const closeness = 1 - (d / 12);

      if (!(opts && opts.frozen)) {
        const stepInterval = Math.max(420, Math.round(1350 - closeness * 850));
        stepAccumMs += dt;
        if (stepAccumMs >= stepInterval) {
          stepAccumMs = 0;
          _playFootstep(closeness);
        }
      }

      if (d <= 3.0) {
        const heartInterval = Math.max(520, Math.round(920 - ((3 - d) / 3) * 340));
        heartAccumMs += dt;
        if (heartAccumMs >= heartInterval) {
          heartAccumMs = 0;
          _playHeartbeat(closeness);
        }
      } else {
        heartAccumMs = 0;
      }
    }

    /**
     * Trigger a creepy-cheerful PA announcement text (and low-pitch speech when not in safeMode).
     * @param {number} period
     * @returns {string}
     */
    function announcePeriod(period) {
      const isEn = App.i18n && App.i18n.lang() === 'en';
      const lines = isEn ? PA_LINES_EN : PA_LINES_ZH;
      const line = lines[(Math.max(1, Number(period) || 1) - 1) % lines.length];
      if (!safeMode && enabled && App.audio && App.audio.tts && typeof App.audio.tts.speak === 'function') {
        try {
          App.audio.tts.speak('Please, continue learning.', { rate: 0.8, pitch: 0.35 });
        } catch (_e) { /* ignore */ }
      }
      return line;
    }

    function stop() {
      stepAccumMs = 0;
      heartAccumMs = 0;
      if (App.audio && App.audio.tts && typeof App.audio.tts.stop === 'function') {
        try { App.audio.tts.stop(); } catch (_e) { /* ignore */ }
      }
    }

    function destroy() {
      stop();
      enabled = false;
      if (ctx) {
        try { ctx.close(); } catch (_e) { /* ignore */ }
        ctx = null;
      }
    }

    return { unlock, setSafeMode, tick, playChime, announcePeriod, stop, destroy };
  }

  App.games.class13Atmosphere = { create, PA_LINES_ZH, PA_LINES_EN };
})();
