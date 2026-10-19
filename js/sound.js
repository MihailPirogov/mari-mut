/* Tiny WebAudio synth (no audio files, no licensing issues). Muted during ads/pauses via Platform.audio. */
(function () {
  let ctx = null, on = true, blocked = false;
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ctx && ctx.state === 'suspended' && !blocked) ctx.resume(); return ctx; }
  function tone(f, d, type, vol, delay) {
    if (!on || blocked) return; const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .12, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .05);
  }
  const PENTA = [523, 587, 659, 784, 880, 1047];
  window.Sound = {
    set enabled(v) { on = !!v; }, get enabled() { return on; },
    unlock: ac,
    get blocked() { return blocked; },
    key(i) { tone(PENTA[(i || 0) % PENTA.length] / 2, .08, 'triangle', .07); },
    del() { tone(260, .07, 'triangle', .05); },
    flip(i, s) { tone(s === 'c' ? 660 + i * 40 : s === 'p' ? 520 + i * 30 : 300, .12, 'sine', .08); },
    wrong() { tone(160, .18, 'sawtooth', .05); tone(120, .2, 'sawtooth', .04, .09); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .1, i * .11)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, .3, 'sine', .08, i * .15)); },
    click() { tone(700, .04, 'square', .03); },
  };
  if (window.Platform) Platform.audio.on((ok) => { blocked = !ok; if (ctx) { try { ok ? ctx.resume() : ctx.suspend(); } catch (e) {} } });
})();
