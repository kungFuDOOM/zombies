// Original synth-horror cues for the opening cinematic and the story scenes: a 90s mall PA
// chime, static, rain, glass, doors, weapons and the stings that land on the big camera hits.
// Every sound here is built from oscillators and noise in Web Audio (no samples, no recordings,
// nothing copyrighted). audio.js hands in a getter for the shared context, then spreads these
// into `sfx`, so an online host's cutscene stings also play on the guests' machines.
//
//   const cine = makeCine(() => ({ ctx, master, muted }));
//   cine.paChime(); cine.stopAll();   // stopAll silences whatever is still ringing (skipping a cutscene)

export function makeCine(get) {
  let bus = null, busCtx = null;

  // Everything goes through one bus so a skip can kill the tails at once.
  function out() {
    const a = get();
    if (!a || !a.ctx || a.muted) return null;
    if (!bus || busCtx !== a.ctx) {
      busCtx = a.ctx;
      bus = a.ctx.createGain();
      bus.gain.value = 1;
      bus.connect(a.master);
    }
    return { ctx: a.ctx, bus };
  }

  const curves = new Map();
  function curve(k) { // a soft-clip waveshaper curve
    if (curves.has(k)) return curves.get(k);
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    curves.set(k, c);
    return c;
  }

  const noiseBufs = new Map();
  function noiseBuf(ctx, secs) {
    const key = Math.round(secs * 10);
    const hit = noiseBufs.get(key);
    if (hit && hit.ctx === ctx) return hit.buf;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(key, { ctx, buf });
    return buf;
  }

  // A filtered oscillator note: { type, vol, slide (end freq), delay, attack, filter:[type, freq, toFreq, q], drive, detune, vib:[hz, cents] }
  function note(freq, dur, o = {}) {
    const a = out(); if (!a) return;
    const { ctx } = a;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sawtooth';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(o.slide, 15), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const atk = o.attack || 0.01, vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.vib) { // slow pitch wobble: a wavering PA / dying tape
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
      lfo.connect(lg).connect(osc.detune); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter[0]; f.frequency.setValueAtTime(o.filter[1], t0); f.Q.value = o.filter[3] || 1;
      if (o.filter[2]) f.frequency.exponentialRampToValueAtTime(o.filter[2], t0 + dur);
      node.connect(f); node = f;
    }
    if (o.drive) { const w = ctx.createWaveShaper(); w.curve = curve(o.drive); node.connect(w); node = w; }
    node.connect(g).connect(a.bus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // A filtered noise burst: { vol, filter:[type, freq, toFreq, q], delay, attack, decay:'exp'|'lin' }
  function hiss(dur, o = {}) {
    const a = out(); if (!a) return;
    const { ctx } = a;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(ctx, Math.min(2, Math.max(0.3, dur)));
    src.loop = true;
    const g = ctx.createGain(), atk = o.attack || 0.005, vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    const [type, f0, f1, q] = o.filter || ['lowpass', 1200];
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(f0, t0); f.Q.value = q || 0.7;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    node.connect(f); node = f;
    if (o.drive) { const w = ctx.createWaveShaper(); w.curve = curve(o.drive); node.connect(w); node = w; }
    node.connect(g).connect(a.bus);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }

  const R = (a, b) => a + Math.random() * (b - a);

  // Crackle: a scatter of short clicks, like a failing speaker.
  function crackle(dur, density = 14, vol = 0.12, delay = 0) {
    for (let i = 0; i < dur * density; i++) hiss(R(0.006, 0.03), { vol: vol * R(0.3, 1), filter: ['bandpass', R(1500, 5000), 0, 1.2], delay: delay + R(0, dur) });
  }

  const cue = {
    // The mall's PA: a 90s three-note descending "attention shoppers" chime, thin and band-limited.
    paChime(delay = 0) {
      [[783.99, 0], [659.25, 0.5], [523.25, 1.0]].forEach(([f, d]) => {
        note(f, 1.7, { type: 'sine', vol: 0.2, delay: delay + d, attack: 0.008, filter: ['bandpass', 1900, 0, 0.5] });
        note(f * 2.005, 1.2, { type: 'sine', vol: 0.07, delay: delay + d, attack: 0.006, filter: ['bandpass', 2400, 0, 0.5] });
        note(f * 3.99, 0.5, { type: 'triangle', vol: 0.03, delay: delay + d, attack: 0.004 });
      });
      hiss(2.6, { vol: 0.035, filter: ['bandpass', 3200, 0, 0.8], delay });
    },
    // The speaker coming alive / dying: pop, hiss, crackle.
    paOpen() { hiss(0.05, { vol: 0.25, filter: ['bandpass', 900, 0, 0.8] }); note(60, 0.1, { type: 'sine', vol: 0.25 }); hiss(2.8, { vol: 0.03, filter: ['bandpass', 3000, 0, 0.7], delay: 0.05 }); crackle(2.8, 8, 0.07); },
    paStatic(dur = 1.2, vol = 0.1) { hiss(dur, { vol, attack: 0.05, filter: ['bandpass', 2400, 900, 0.5] }); crackle(dur, 22, vol * 1.2); note(50, dur, { type: 'sawtooth', vol: vol * 0.7, filter: ['lowpass', 180, 0, 1] }); },
    paClose() { hiss(0.06, { vol: 0.25, filter: ['bandpass', 800, 0, 0.8] }); note(55, 0.12, { type: 'sine', vol: 0.2 }); },

    thunder() { hiss(3.4, { vol: 0.45, attack: 0.3, filter: ['lowpass', 260, 70, 0.8] }); hiss(1.3, { vol: 0.25, attack: 0.02, filter: ['lowpass', 900, 120, 0.6] }); note(46, 2.6, { type: 'sine', vol: 0.25, slide: 30, attack: 0.15 }); },
    rain(dur = 12, vol = 0.07) { // a steady wash with pattering highs
      hiss(dur, { vol, attack: 1.2, filter: ['highpass', 1800, 0, 0.5] });
      hiss(dur, { vol: vol * 0.9, attack: 1.5, filter: ['bandpass', 600, 0, 0.4] });
    },
    neonBuzz(dur = 3, vol = 0.05) {
      note(120, dur, { type: 'sawtooth', vol, attack: 0.1, filter: ['bandpass', 360, 0, 6], drive: 6 });
      note(240.7, dur, { type: 'square', vol: vol * 0.5, attack: 0.1, filter: ['bandpass', 720, 0, 8] });
    },
    zap(delay = 0) { hiss(0.06, { vol: 0.2, delay, filter: ['highpass', 3000, 0, 0.7], drive: 5 }); note(2400, 0.07, { type: 'square', vol: 0.05, delay, slide: 400 }); },
    escalatorGroan() {
      note(58, 2.6, { type: 'sawtooth', vol: 0.16, slide: 44, attack: 0.3, filter: ['lowpass', 220, 90, 4], vib: [5.5, 25] });
      note(1180, 1.1, { type: 'square', vol: 0.025, slide: 780, delay: 0.5, attack: 0.1, filter: ['bandpass', 1000, 0, 9] }); // a seized-gear squeal
      for (let i = 0; i < 6; i++) hiss(0.05, { vol: 0.12, delay: 0.3 + i * 0.4, filter: ['bandpass', 500, 0, 3] }); // clanks
    },
    monitorOn() { hiss(0.25, { vol: 0.22, filter: ['highpass', 3500, 0, 0.5], drive: 4 }); note(7800, 0.4, { type: 'sine', vol: 0.02 }); note(180, 0.4, { type: 'square', vol: 0.06, slide: 40 }); },
    monitorGlitch(dur = 2.2) {
      hiss(dur, { vol: 0.09, attack: 0.1, filter: ['bandpass', 3000, 1400, 1.2], drive: 4 });
      for (let i = 0; i < 9; i++) note(R(300, 1800), R(0.04, 0.14), { type: 'square', vol: 0.045, delay: R(0, dur), slide: R(120, 2400), filter: ['bandpass', 1200, 0, 2] });
      note(52, dur, { type: 'sawtooth', vol: 0.08, attack: 0.4, filter: ['lowpass', 150, 0, 1], vib: [9, 40] });
    },
    // A fist of dead weight against glass.
    doorSlam(vol = 1) {
      hiss(0.5, { vol: 0.5 * vol, filter: ['lowpass', 380, 70, 0.8] });
      note(78, 0.55, { type: 'sine', vol: 0.5 * vol, slide: 30 });
      hiss(0.1, { vol: 0.2 * vol, delay: 0.01, filter: ['bandpass', 2800, 0, 1.4] }); // the glass ringing
      note(1640, 0.35, { type: 'sine', vol: 0.03 * vol, delay: 0.01, slide: 1500 });
    },
    glassCrack() {
      hiss(0.07, { vol: 0.35, filter: ['highpass', 4200, 0, 0.7], drive: 3 });
      hiss(0.2, { vol: 0.2, delay: 0.04, filter: ['bandpass', 5500, 3000, 3] });
      note(4300, 0.15, { type: 'sine', vol: 0.05, slide: 2800 });
      note(90, 0.3, { type: 'sine', vol: 0.18, slide: 50 });
    },
    glassShatter() {
      hiss(0.12, { vol: 0.6, filter: ['highpass', 2500, 0, 0.7], drive: 3 });
      hiss(1.8, { vol: 0.28, attack: 0.02, filter: ['highpass', 5000, 3000, 0.6] });
      for (let i = 0; i < 26; i++) note(R(3000, 9500), R(0.05, 0.22), { type: 'sine', vol: R(0.02, 0.06), delay: R(0.02, 1.4), slide: R(2000, 7000) });
      hiss(0.8, { vol: 0.5, filter: ['lowpass', 500, 80, 0.8] });
      note(70, 1, { type: 'sine', vol: 0.45, slide: 26 });
    },
    // A swelling mass of groaning dead: detuned saws through a moving vowel filter.
    horde(dur = 4, vol = 0.14) {
      [74, 81, 90, 98, 112].forEach((f, i) => note(f, dur, { type: 'sawtooth', vol: vol * 0.55, attack: dur * 0.5, slide: f * R(0.62, 0.8), detune: R(-30, 30), filter: ['bandpass', 450 + i * 90, 260 + i * 40, 3], vib: [R(3, 6), 40], drive: 3, delay: i * 0.05 }));
      hiss(dur, { vol: vol * 0.7, attack: dur * 0.55, filter: ['lowpass', 500, 160, 0.8] });
      for (let i = 0; i < 5; i++) note(R(150, 260), R(0.5, 1.1), { type: 'sawtooth', vol: vol * 0.28, delay: R(0.4, dur - 0.5), slide: R(70, 120), attack: 0.1, filter: ['bandpass', R(600, 1100), 0, 4], drive: 2 });
    },
    moan() { note(R(110, 170), 1.3, { type: 'sawtooth', vol: 0.09, slide: R(60, 85), attack: 0.2, filter: ['bandpass', R(500, 900), 300, 4], vib: [4, 35], drive: 3 }); },
    chainsawRev() {
      for (let i = 0; i < 3; i++) {
        const d = i * 0.42;
        note(48, 0.42, { type: 'sawtooth', vol: 0.2, delay: d, slide: 150 + i * 70, attack: 0.04, filter: ['lowpass', 900, 3200, 1.2], drive: 7, vib: [28, 120] });
        note(96, 0.42, { type: 'square', vol: 0.06, delay: d, slide: 300 + i * 140, attack: 0.04, filter: ['lowpass', 1600, 0, 1], drive: 5 });
        hiss(0.42, { vol: 0.08, delay: d, filter: ['bandpass', 1800, 0, 1] });
      }
      note(160, 0.7, { type: 'sawtooth', vol: 0.12, delay: 1.3, slide: 55, filter: ['lowpass', 1400, 400, 1], drive: 6, vib: [24, 90] });
    },
    shotgunRack() {
      hiss(0.07, { vol: 0.3, filter: ['bandpass', 2600, 0, 3], drive: 3 }); note(160, 0.09, { type: 'square', vol: 0.12, slide: 60 });
      hiss(0.09, { vol: 0.34, delay: 0.26, filter: ['bandpass', 1900, 0, 3], drive: 3 }); note(110, 0.14, { type: 'square', vol: 0.16, delay: 0.26, slide: 45 });
      hiss(0.05, { vol: 0.12, delay: 0.5, filter: ['highpass', 5000, 0, 1] });
    },
    skaterDrop() {
      hiss(0.5, { vol: 0.14, attack: 0.3, filter: ['bandpass', 700, 2600, 1.2] }); // a whoosh falling in
      hiss(0.2, { vol: 0.35, delay: 0.5, filter: ['lowpass', 500, 90, 0.8] }); note(120, 0.25, { type: 'sine', vol: 0.3, delay: 0.5, slide: 40 }); // the board lands
      hiss(0.7, { vol: 0.09, delay: 0.55, attack: 0.05, filter: ['bandpass', 1100, 1900, 3] }); // wheels rolling out
    },
    hairsprayFlame() {
      hiss(0.5, { vol: 0.16, attack: 0.03, filter: ['highpass', 3200, 0, 0.7] });
      note(180, 0.12, { type: 'square', vol: 0.06, delay: 0.1 }); // the lighter
      hiss(0.9, { vol: 0.34, delay: 0.3, attack: 0.04, filter: ['lowpass', 1300, 220, 0.8], drive: 2 }); // whoomp
      note(80, 0.8, { type: 'sawtooth', vol: 0.14, delay: 0.3, slide: 38, filter: ['lowpass', 300, 0, 1] });
      hiss(1.2, { vol: 0.07, delay: 0.5, attack: 0.2, filter: ['bandpass', 2500, 1500, 0.5] });
    },
    whoosh(dur = 0.6, vol = 0.12) { hiss(dur, { vol, attack: dur * 0.5, filter: ['bandpass', 400, 2600, 1.1] }); },
    riser(dur = 3, vol = 0.16) {
      note(70, dur, { type: 'sawtooth', vol, slide: 700, attack: dur * 0.9, filter: ['lowpass', 300, 5000, 2], drive: 3 });
      note(105, dur, { type: 'sawtooth', vol: vol * 0.6, slide: 1050, attack: dur * 0.9, detune: 14, filter: ['lowpass', 300, 5000, 2], drive: 3 });
      hiss(dur, { vol: vol * 0.7, attack: dur * 0.95, filter: ['bandpass', 500, 7000, 1.5] });
    },
    // The big ones.
    // A short dread stab: a low tritone cluster and a metal scrape.
    stingHit() {
      [55, 58.3, 77.8].forEach((f, i) => note(f, 1.5, { type: 'sawtooth', vol: 0.2, attack: 0.012, slide: f * 0.9, detune: i * 6, filter: ['lowpass', 700, 180, 1.5], drive: 3 }));
      hiss(0.5, { vol: 0.3, filter: ['lowpass', 500, 90, 0.8] });
      note(1830, 0.6, { type: 'sawtooth', vol: 0.025, slide: 1500, filter: ['bandpass', 1800, 0, 8] });
    },
    stingDread() { // a held, unresolving cluster that swells then drops away
      [98, 103.8, 146.8, 155.6].forEach((f, i) => note(f, 3.2, { type: 'sawtooth', vol: 0.1, attack: 1.6, slide: f * 0.97, detune: i * 5, filter: ['lowpass', 500, 1400, 1], vib: [5, 14] }));
      hiss(3, { vol: 0.07, attack: 1.6, filter: ['bandpass', 900, 300, 1] });
    },
    stingAlarm() { // two blaring klaxon pulses
      for (let i = 0; i < 2; i++) { note(440, 0.32, { type: 'sawtooth', vol: 0.13, delay: i * 0.4, slide: 560, attack: 0.02, filter: ['lowpass', 2200, 0, 1], drive: 4 }); note(330, 0.32, { type: 'square', vol: 0.06, delay: i * 0.4, slide: 420 }); }
      note(50, 0.9, { type: 'sine', vol: 0.3, slide: 30 });
    },
    stingFire() { hiss(1.4, { vol: 0.22, attack: 0.05, filter: ['bandpass', 1400, 600, 0.6], drive: 2 }); crackle(1.4, 30, 0.14); note(52, 1.2, { type: 'sawtooth', vol: 0.14, slide: 36, filter: ['lowpass', 220, 0, 1] }); },
    stingSad() { [[196, 0], [233.1, 0], [155.6, 0.6]].forEach(([f, d]) => note(f, 2.4, { type: 'triangle', vol: 0.12, delay: d, attack: 0.3, filter: ['lowpass', 900, 0, 1], vib: [4, 12] })); },
    // The Butcher: a cleaver ringing on a steel counter, then a low brass hit.
    stingReveal() {
      note(3040, 1.6, { type: 'sine', vol: 0.05, slide: 2960 }); note(1530, 1.6, { type: 'sine', vol: 0.05, slide: 1500 });
      hiss(0.08, { vol: 0.4, filter: ['highpass', 2600, 0, 0.8], drive: 3 });
      [41.2, 61.7, 87.3].forEach((f, i) => note(f, 2.4, { type: 'sawtooth', vol: 0.22, delay: 0.1, attack: 0.02, slide: f * 0.7, detune: i * 8, filter: ['lowpass', 900, 120, 1.6], drive: 4 }));
      hiss(1.4, { vol: 0.3, delay: 0.1, filter: ['lowpass', 600, 60, 0.8] });
    },
    butcherRoar() {
      note(150, 1.6, { type: 'sawtooth', vol: 0.3, slide: 58, attack: 0.05, filter: ['bandpass', 700, 260, 2.5], drive: 8, vib: [14, 90] });
      note(75, 1.6, { type: 'square', vol: 0.18, slide: 36, attack: 0.05, filter: ['lowpass', 500, 0, 1], drive: 6 });
      hiss(1.5, { vol: 0.24, attack: 0.04, filter: ['bandpass', 1100, 320, 1.1], drive: 5 });
      note(40, 1.4, { type: 'sine', vol: 0.4, slide: 24 });
    },
    sizzle(dur = 3, vol = 0.08) { hiss(dur, { vol, attack: 0.3, filter: ['highpass', 3800, 0, 0.6] }); crackle(dur, 20, vol * 1.3); },
    // MALL OF THE DEAD: reverse swell, a cluster slammed in, a sub drop and a bright cold shimmer.
    titleSlam() {
      hiss(0.9, { vol: 0.5, filter: ['lowpass', 900, 60, 0.7], drive: 3 });
      note(110, 2.8, { type: 'sine', vol: 0.55, slide: 26 });
      [[110, 0], [116.5, 4], [164.8, -3], [233.1, 6], [329.6, -6]].forEach(([f, dt]) => note(f, 3.2, { type: 'sawtooth', vol: 0.15, attack: 0.012, slide: f * 0.985, detune: dt, filter: ['lowpass', 2600, 500, 1.2], drive: 3 }));
      hiss(2.4, { vol: 0.2, filter: ['highpass', 3000, 6000, 0.6], attack: 0.01 });
      [880, 1318.5, 1760].forEach((f, i) => note(f, 2.4, { type: 'triangle', vol: 0.04, delay: 0.05 + i * 0.05, attack: 0.01 }));
      note(55, 3.5, { type: 'sawtooth', vol: 0.18, delay: 0.1, filter: ['lowpass', 220, 80, 1.5], drive: 4 });
    },
    // A low cold bed that lives under the whole opening: two detuned drones that slowly open up.
    introBed(dur = 40, vol = 0.12) {
      [[55, 0], [55.4, 0], [82.4, 0], [58.3, 12]].forEach(([f, d], i) => note(f, dur - d, { type: 'sawtooth', vol: vol * (i === 2 ? 0.6 : 1), delay: d, attack: 4, filter: ['lowpass', 160, 520, 1.5], vib: [0.18 + i * 0.03, 10] }));
      hiss(dur, { vol: vol * 0.35, attack: 5, filter: ['bandpass', 380, 900, 0.5] });
    },
    heartbeat(n = 6, gap = 0.78, vol = 0.3) { for (let i = 0; i < n; i++) { note(62, 0.18, { type: 'sine', vol, delay: i * gap, slide: 38 }); note(58, 0.2, { type: 'sine', vol: vol * 0.7, delay: i * gap + 0.17, slide: 34 }); } },

    // ----- the opener "Doorbuster" (cinema toolkit): locks, bursts, hero stingers, the theme -----
    // The keypad: a thin electronic beep, then (ok) the bolt thrown with a heavy clunk and the score dropping out.
    lockBeep(ok = false) { note(ok ? 1760 : 880, 0.09, { type: 'square', vol: 0.05, filter: ['bandpass', ok ? 2200 : 1100, 0, 4] }); if (ok) note(2349, 0.16, { type: 'square', vol: 0.05, delay: 0.1, filter: ['bandpass', 2400, 0, 4] }); },
    lockClunk() {
      hiss(0.09, { vol: 0.5, filter: ['bandpass', 1400, 400, 2], drive: 3 });
      note(62, 0.7, { type: 'sine', vol: 0.6, slide: 30 });
      hiss(0.4, { vol: 0.3, delay: 0.02, filter: ['lowpass', 420, 70, 0.8] });
      note(210, 0.16, { type: 'square', vol: 0.07, delay: 0.14, slide: 150, filter: ['bandpass', 600, 0, 3] }); // the latch settling
    },
    // The doors give way: glass, horde, and a percussion slam.
    doorBurst() {
      hiss(0.14, { vol: 0.65, filter: ['highpass', 2200, 0, 0.7], drive: 3 });
      hiss(0.9, { vol: 0.45, filter: ['lowpass', 600, 70, 0.8] });
      note(48, 1.4, { type: 'sine', vol: 0.55, slide: 24 });
      for (let i = 0; i < 20; i++) note(R(3000, 9000), R(0.05, 0.2), { type: 'sine', vol: R(0.02, 0.05), delay: R(0.02, 1.2), slide: R(2000, 6000) });
      [0, 0.18, 0.36].forEach((d, i) => { hiss(0.22, { vol: 0.28 - i * 0.05, delay: d, filter: ['lowpass', 900, 120, 1] }); note(70 - i * 8, 0.3, { type: 'sine', vol: 0.4, delay: d, slide: 36 }); }); // timpani-ish slams
    },
    // Tape warble: a pitch-sliding detuned tone, the sound of a feed losing its track. Ends on a single piano note.
    tapeWarble(dur = 1.6) {
      note(440, dur, { type: 'sawtooth', vol: 0.05, slide: 150, filter: ['lowpass', 1400, 300, 1], vib: [6, 120] });
      note(443, dur, { type: 'sawtooth', vol: 0.04, slide: 200, filter: ['lowpass', 1400, 300, 1], vib: [4, 160] });
      hiss(dur, { vol: 0.05, filter: ['bandpass', 3200, 1500, 1], drive: 3 });
    },
    piano(freq = 392, vol = 0.18, delay = 0) { // a struck, felted note: sine partials with a quick decay
      note(freq, 3, { type: 'sine', vol, delay, attack: 0.008, filter: ['lowpass', 2600, 500, 0.7] });
      note(freq * 2, 2, { type: 'sine', vol: vol * 0.35, delay, attack: 0.006 });
      note(freq * 3.01, 1, { type: 'triangle', vol: vol * 0.12, delay, attack: 0.004 });
      hiss(0.04, { vol: vol * 0.4, delay, filter: ['bandpass', 1800, 0, 2] }); // the hammer
    },
    // Something wet gagging up: pitch-bending growl with a burble.
    spitterGargle() {
      note(130, 1.3, { type: 'sawtooth', vol: 0.17, slide: 62, attack: 0.1, filter: ['bandpass', 520, 240, 5], drive: 4, vib: [13, 140] });
      for (let i = 0; i < 9; i++) hiss(0.06, { vol: 0.1, delay: 0.1 + i * 0.12, filter: ['bandpass', R(500, 1200), 0, 6] });
      hiss(0.5, { vol: 0.12, delay: 0.9, attack: 0.05, filter: ['bandpass', 1600, 700, 1.5] }); // the spit
    },
    // Hero stingers: each survivor has their own colour of stab.
    guitarStab() { // power chord, distorted
      [82.4, 123.5, 164.8].forEach((f, i) => note(f, 1.4, { type: 'sawtooth', vol: 0.16, attack: 0.008, slide: f * 0.97, detune: i * 7, filter: ['lowpass', 2200, 500, 1.4], drive: 8 }));
      hiss(0.12, { vol: 0.3, filter: ['bandpass', 1800, 0, 1.4], drive: 3 });
    },
    snareHit() { hiss(0.2, { vol: 0.34, filter: ['bandpass', 1900, 900, 1.1], drive: 2 }); note(190, 0.14, { type: 'triangle', vol: 0.3, slide: 100 }); },
    cymbal() { hiss(1.8, { vol: 0.16, attack: 0.01, filter: ['highpass', 6000, 4000, 0.6] }); for (let i = 0; i < 5; i++) note(R(5000, 9000), 0.9, { type: 'square', vol: 0.012, attack: 0.005, slide: R(4000, 7000), filter: ['highpass', 5000, 0, 1] }); },
    wheelRoll(dur = 1.2) { hiss(dur, { vol: 0.1, attack: 0.1, filter: ['bandpass', 900, 1700, 3] }); hiss(dur, { vol: 0.05, attack: 0.2, filter: ['lowpass', 220, 120, 1] }); },
    lighterFlick() { hiss(0.04, { vol: 0.2, filter: ['highpass', 4200, 0, 1], drive: 3 }); note(3100, 0.03, { type: 'square', vol: 0.04, delay: 0.005 }); hiss(0.05, { vol: 0.18, delay: 0.12, filter: ['highpass', 3800, 0, 1] }); },
    flameWhoomp() { hiss(0.9, { vol: 0.38, attack: 0.04, filter: ['lowpass', 1200, 200, 0.8], drive: 2 }); note(78, 0.9, { type: 'sawtooth', vol: 0.16, slide: 36, filter: ['lowpass', 280, 0, 1] }); },
    bassDrop() { note(120, 1.6, { type: 'sine', vol: 0.6, slide: 28 }); note(60, 1.6, { type: 'sawtooth', vol: 0.15, slide: 30, filter: ['lowpass', 260, 90, 1], drive: 3 }); hiss(0.5, { vol: 0.2, filter: ['lowpass', 500, 60, 1] }); },
    // The theme coming in under the title: a minor-key pad, a pulse and a slow bell.
    themeIn(dur = 9) {
      [[110, 0], [130.8, 0.3], [164.8, 0.6], [196, 1]].forEach(([f, d]) => note(f, dur, { type: 'sawtooth', vol: 0.07, delay: d, attack: 1.4, slide: f * 0.995, filter: ['lowpass', 500, 1800, 1.2], detune: R(-6, 6) }));
      for (let i = 0; i < 16; i++) note(i % 4 === 0 ? 55 : 82.4, 0.28, { type: 'triangle', vol: 0.14, delay: 0.8 + i * 0.5, slide: 40, filter: ['lowpass', 400, 0, 1] });
      [[659.3, 1.2], [587.3, 2.8], [523.3, 4.4], [493.9, 6.0]].forEach(([f, d]) => note(f, 2.2, { type: 'sine', vol: 0.06, delay: d, attack: 0.01, filter: ['lowpass', 2200, 800, 0.8] }));
    },
    // ----- the story scenes (storyFilm.js) -----
    // ----- the White Acre kit: the 11:58 PA, Midnight Madness, the vents, the cleanup -----
    // The PA's page tone: two soft struck notes, flat and polite. Nobody is meant to notice it.
    paDing(delay = 0) {
      [[784, 0], [659.25, 0.38]].forEach(([f, d]) => {
        note(f, 1.5, { type: 'sine', vol: 0.17, delay: delay + d, attack: 0.006, filter: ['bandpass', 1500, 0, 0.5] });
        note(f * 2.76, 0.45, { type: 'sine', vol: 0.03, delay: delay + d, attack: 0.003 });
      });
      hiss(1.6, { vol: 0.02, delay, filter: ['bandpass', 3000, 0, 0.8] });
    },
    // A calm voice with no words in it: low buzzy syllables through two formants, in an even rhythm (the caption has the words).
    paMurmur(dur = 3, vol = 0.07, root = 112, delay = 0) {
      for (let i = 0, d = 0; d < dur - 0.12; i++) {
        const len = R(0.1, 0.2), f = root * (1 + R(-0.08, 0.1)) * (d > dur - 0.6 ? 0.88 : 1);
        note(f, len, { type: 'sawtooth', vol: vol * 1.6, delay: delay + d, attack: 0.025, slide: f * 0.96, filter: ['bandpass', [520, 700, 430, 610, 360][i % 5], 0, 5] });
        note(f * 1.005, len, { type: 'sawtooth', vol: vol * 0.7, delay: delay + d, attack: 0.03, filter: ['bandpass', [1180, 1040, 1500, 920][i % 4], 0, 7] });
        d += len + (i % 6 === 5 ? 0.22 : 0.02);
      }
      hiss(dur, { vol: vol * 0.12, delay, filter: ['bandpass', 2600, 0, 1] });
    },
    // One slow stroke of a pumpjack a long way off.
    pumpjack(n = 3, gap = 2, vol = 0.07) {
      for (let i = 0; i < n; i++) {
        note(74, 0.9, { type: 'sawtooth', vol, delay: i * gap, slide: 52, attack: 0.3, filter: ['lowpass', 220, 90, 3] });
        hiss(0.35, { vol: vol * 0.8, delay: i * gap + 0.85, filter: ['bandpass', 340, 200, 5] });
      }
    },
    // A packed mall: overlapping murmur bands that swell.
    crowdWalla(dur = 8, vol = 0.07) {
      hiss(dur, { vol, attack: Math.min(1.2, dur * 0.3), filter: ['bandpass', 520, 640, 1.1] });
      hiss(dur, { vol: vol * 0.55, attack: Math.min(1.6, dur * 0.4), filter: ['bandpass', 1300, 1100, 1.6] });
      for (let i = 0; i < dur * 7; i++) { const f = R(130, 330); note(f, R(0.12, 0.34), { type: 'sawtooth', vol: vol * R(0.12, 0.3), delay: R(0, dur - 0.4), attack: 0.05, slide: f * R(0.85, 1.2), filter: ['bandpass', R(450, 1100), 0, 5] }); }
    },
    // The countdown crowd: a beat a second, each louder, into a roar.
    countdownRoar(dur = 4) {
      for (let i = 0; i < Math.floor(dur); i++) {
        const k = (i + 1) / dur;
        hiss(0.5, { vol: 0.07 + 0.14 * k, delay: i, attack: 0.08, filter: ['bandpass', 600 + 300 * k, 800, 1] });
        [196, 247, 294].forEach((f) => note(f * R(0.97, 1.03), 0.42, { type: 'sawtooth', vol: 0.02 + 0.025 * k, delay: i, attack: 0.06, filter: ['bandpass', 800, 0, 3] }));
      }
      hiss(1.6, { vol: 0.22, delay: dur - 0.4, attack: 0.5, filter: ['bandpass', 900, 1300, 0.8] });
    },
    // Every vent in the building breathing out at once.
    ventExhale(dur = 4, vol = 0.2) {
      hiss(dur, { vol, attack: dur * 0.4, filter: ['lowpass', 1400, 320, 0.7] });
      hiss(dur, { vol: vol * 0.35, attack: dur * 0.5, filter: ['highpass', 3800, 2400, 0.7] });
      note(49, dur, { type: 'sine', vol: vol * 0.6, attack: dur * 0.5, slide: 43.6 });
    },
    // One bag-and-body thud in a crowd going down.
    crowdThud(delay = 0, vol = 0.2) { hiss(0.2, { vol, delay, filter: ['lowpass', R(240, 620), 80, 0.8] }); note(R(58, 92), 0.18, { type: 'sine', vol, delay, slide: 40 }); },
    cough(delay = 0) {
      [[0, 1], [0.27, 0.8], [0.72, 0.9]].forEach(([d, k]) => {
        hiss(0.16, { vol: 0.34 * k, delay: delay + d, attack: 0.008, filter: ['bandpass', 1100, 520, 1.6], drive: 2 });
        note(190, 0.13, { type: 'sawtooth', vol: 0.09 * k, delay: delay + d, slide: 105, filter: ['lowpass', 900, 300, 2], drive: 3 });
      });
    },
    pagerChirp(delay = 0) { for (let i = 0; i < 6; i++) note(i % 2 ? 2600 : 3100, 0.06, { type: 'square', vol: 0.05, delay: delay + i * 0.085 + (i > 2 ? 0.2 : 0), attack: 0.002, filter: ['bandpass', 2900, 0, 3] }); },
    backupBeeper(n = 5, delay = 0) { for (let i = 0; i < n; i++) note(1050, 0.28, { type: 'square', vol: 0.03, delay: delay + i * 0.6, attack: 0.005, filter: ['bandpass', 1100, 0, 4] }); note(48, n * 0.6, { type: 'sawtooth', vol: 0.06, delay, attack: 0.4, filter: ['lowpass', 150, 0, 2], vib: [9, 40] }); },
    // The yellow helicopter: blade slaps that come in, pass and go.
    rotor(dur = 5, vol = 0.22) {
      for (let d = 0, i = 0; d < dur; i++, d += 0.095) { const k = Math.sin(Math.PI * Math.min(1, (d + 0.2) / dur)); hiss(0.06, { vol: vol * (0.25 + 0.75 * k), delay: d, filter: ['lowpass', 300 + 500 * k, 120, 1.4] }); }
      note(88, dur, { type: 'sawtooth', vol: vol * 0.2, attack: dur * 0.4, slide: 74, filter: ['lowpass', 300, 0, 2] });
    },
    // A news set on a small speaker: wordless, thin and bright.
    tvMurmur(dur = 3, vol = 0.05) { cue.paMurmur(dur, vol, 150); note(15700, dur, { type: 'sine', vol: 0.004 }); },
    radioSquelch(delay = 0) { hiss(0.09, { vol: 0.2, delay, filter: ['bandpass', 2200, 0, 1], drive: 4 }); note(1750, 0.05, { type: 'square', vol: 0.03, delay: delay + 0.06 }); },
    // A rubber strap pulled tight, then two slow breaths through the filters.
    respirator() {
      hiss(0.05, { vol: 0.4, filter: ['bandpass', 1500, 700, 2], drive: 3 }); note(220, 0.07, { type: 'triangle', vol: 0.14, delay: 0.01, slide: 90 });
      for (const d of [0.5, 1.9]) { hiss(0.7, { vol: 0.14, delay: d, attack: 0.3, filter: ['bandpass', 620, 820, 3] }); hiss(0.6, { vol: 0.1, delay: d + 0.75, attack: 0.08, filter: ['bandpass', 380, 260, 3] }); }
    },
    ringing(dur = 3) { note(3150, dur, { type: 'sine', vol: 0.035, attack: 0.5 }); note(3163, dur, { type: 'sine', vol: 0.03, attack: 0.7 }); },
    clockTick() { hiss(0.025, { vol: 0.22, filter: ['bandpass', 3400, 0, 4] }); note(1250, 0.05, { type: 'square', vol: 0.04, slide: 900, filter: ['bandpass', 1500, 0, 3] }); note(52, 0.14, { type: 'sine', vol: 0.2, slide: 36 }); },
    shutterSlams() { [0, 0.5, 1.15].forEach((d, i) => { hiss(0.35, { vol: 0.24 - i * 0.05, delay: d, filter: ['lowpass', 800 - i * 180, 90, 0.8] }); note(66 - i * 6, 0.4, { type: 'sine', vol: 0.26 - i * 0.06, delay: d, slide: 32 }); hiss(0.18, { vol: 0.08, delay: d + 0.02, filter: ['bandpass', 2200, 0, 3] }); }); },
    shutterRattle() { for (let i = 0; i < 14; i++) hiss(0.05, { vol: 0.2 * (1 - i / 18), delay: i * 0.055 + R(0, 0.02), filter: ['bandpass', R(900, 2600), 0, 3], drive: 2 }); note(92, 0.8, { type: 'sawtooth', vol: 0.08, slide: 60, filter: ['lowpass', 300, 0, 1], vib: [18, 80] }); },
    // Deep-fry oil: a bright seething wash, fat spitting out of it, and the low burble of the vat.
    fryerSizzle(dur = 4, vol = 0.09) {
      hiss(dur, { vol, attack: 0.25, filter: ['highpass', 4200, 0, 0.6] });
      hiss(dur, { vol: vol * 0.5, attack: 0.4, filter: ['bandpass', 1500, 1900, 0.8] });
      crackle(dur, 28, vol * 1.5);
      for (let i = 0; i < dur * 3; i++) note(R(90, 190), R(0.06, 0.14), { type: 'sine', vol: vol * 0.7, delay: R(0, dur), slide: R(220, 420), attack: 0.02 });
    },
    fryerDown() { [0, 0.55, 1.05, 1.5, 1.9].forEach((d, i) => { note(150 - i * 18, 0.9, { type: 'sawtooth', vol: 0.12, delay: d, slide: 28, filter: ['lowpass', 600, 90, 2], drive: 2 }); hiss(0.08, { vol: 0.2, delay: d, filter: ['bandpass', 1100, 0, 3] }); }); hiss(3.2, { vol: 0.08, filter: ['highpass', 4200, 6500, 0.6] }); },
    // A meat hook swung on its rail: two inharmonic steel strikes, a chain rattle and the ring that hangs after.
    hookClank(delay = 0) {
      for (const [d, k] of [[0, 1], [0.19, 0.6]]) {
        [523, 1347, 2210, 3391].forEach((f, i) => note(f * (1 + d * 0.05), 1.1 - i * 0.2, { type: i % 2 ? 'sine' : 'triangle', vol: (0.1 - i * 0.018) * k, delay: delay + d, attack: 0.003 }));
        hiss(0.05, { vol: 0.3 * k, delay: delay + d, filter: ['highpass', 2400, 0, 1], drive: 3 });
        note(96, 0.25, { type: 'sine', vol: 0.24 * k, delay: delay + d, slide: 50 });
      }
      for (let i = 0; i < 9; i++) hiss(0.02, { vol: 0.1, delay: delay + 0.05 + i * 0.045, filter: ['bandpass', R(2500, 5000), 0, 6] });
    },
    cleaverThunk() { hiss(0.09, { vol: 0.42, filter: ['lowpass', 900, 150, 1], drive: 3 }); note(104, 0.28, { type: 'sine', vol: 0.5, slide: 40 }); note(2870, 0.22, { type: 'sine', vol: 0.025, slide: 2780 }); },
    cleaverClang() { [0, 0.34, 0.55].forEach((d, i) => { [1480, 2315, 3710].forEach((f, k) => note(f, 0.9 - k * 0.2, { type: 'sine', vol: 0.09 / (i + 1), delay: d, attack: 0.003 })); hiss(0.06, { vol: 0.3 / (i + 1), delay: d, filter: ['highpass', 2000, 0, 1] }); note(88, 0.2, { type: 'sine', vol: 0.3 / (i + 1), delay: d, slide: 44 }); }); },
    // "Order up!": the pass bell, over a pig squeal bent into the roar.
    orderUp() {
      [2093, 2637, 4186].forEach((f, i) => note(f, 1.8, { type: 'sine', vol: 0.11 - i * 0.03, attack: 0.002 }));
      note(900, 0.9, { type: 'sawtooth', vol: 0.14, slide: 1750, delay: 0.1, attack: 0.08, filter: ['bandpass', 1900, 1100, 5], drive: 6, vib: [17, 190] });
      note(560, 0.8, { type: 'square', vol: 0.06, slide: 190, delay: 0.55, filter: ['bandpass', 900, 300, 4], drive: 5, vib: [23, 140] });
    },
    metalGroan() { note(112, 1.8, { type: 'sawtooth', vol: 0.16, slide: 71, attack: 0.25, filter: ['bandpass', 640, 280, 9], drive: 5, vib: [7.5, 70] }); note(1390, 1.2, { type: 'square', vol: 0.022, slide: 920, delay: 0.3, filter: ['bandpass', 1200, 0, 12] }); hiss(0.5, { vol: 0.24, delay: 1.1, filter: ['lowpass', 700, 90, 1] }); },
    klaxon(n = 3) { for (let i = 0; i < n; i++) { note(698, 0.2, { type: 'square', vol: 0.055, delay: i * 0.62, filter: ['bandpass', 1300, 0, 2], drive: 3 }); note(523, 0.2, { type: 'square', vol: 0.045, delay: i * 0.62 + 0.22, filter: ['bandpass', 1000, 0, 2], drive: 3 }); } },
    lockerOpen() { hiss(0.1, { vol: 0.45, filter: ['bandpass', 1100, 500, 2], drive: 3 }); note(70, 0.6, { type: 'sine', vol: 0.45, slide: 34 }); note(240, 1.3, { type: 'sawtooth', vol: 0.05, slide: 330, delay: 0.15, attack: 0.2, filter: ['bandpass', 900, 0, 7], vib: [11, 60] }); hiss(1.4, { vol: 0.07, delay: 0.2, attack: 0.3, filter: ['highpass', 3000, 0, 0.6] }); },
    // A tiny wind-up tune: four tines, slowing down.
    musicBox() { [[1318.5, 0], [1567.98, 0.46], [1174.66, 0.96], [1046.5, 1.6], [987.77, 2.4]].forEach(([f, d]) => { note(f, 1.5, { type: 'sine', vol: 0.075, delay: d, attack: 0.003 }); note(f * 3.01, 0.35, { type: 'sine', vol: 0.014, delay: d, attack: 0.002 }); }); },
    boomboxClick() { hiss(0.04, { vol: 0.35, filter: ['bandpass', 1800, 0, 2] }); note(140, 0.07, { type: 'square', vol: 0.12, slide: 70 }); hiss(1.1, { vol: 0.07, delay: 0.1, filter: ['bandpass', 2600, 1300, 0.8] }); crackle(1.1, 16, 0.06, 0.1); },
    gurgle() { for (let i = 0; i < 8; i++) note(R(70, 150), R(0.1, 0.24), { type: 'sine', vol: 0.2, delay: i * 0.13 + R(0, 0.05), slide: R(40, 190), attack: 0.03, filter: ['lowpass', 500, 0, 3] }); },
    printer(dur = 3) { // dot-matrix: pins chattering a line at a time, then the carriage zipping back
      for (let line = 0; line * 0.5 < dur; line++) {
        const t0 = line * 0.5;
        for (let i = 0; i < 17; i++) note(R(1750, 2100), 0.016, { type: 'square', vol: 0.04, delay: t0 + i * 0.019, attack: 0.002, filter: ['bandpass', 2600, 0, 3], drive: 3 });
        hiss(0.32, { vol: 0.05, delay: t0, filter: ['bandpass', 3600, 0, 5] });
        note(310, 0.12, { type: 'sawtooth', vol: 0.04, delay: t0 + 0.36, slide: 720, filter: ['bandpass', 900, 0, 4] });
      }
    },
    receiptRattle(dur = 1.8) { for (let i = 0; i < dur * 22; i++) { const k = (i + 1) / (dur * 22); note(R(900, 1300), 0.03, { type: 'square', vol: 0.045 * k, delay: k * dur, attack: 0.022, filter: ['bandpass', 1700, 0, 4], drive: 3 }); } hiss(dur, { vol: 0.07, attack: dur * 0.95, filter: ['highpass', 4000, 0, 0.7] }); },
    tapeRewind(dur = 1.4) { note(180, dur, { type: 'sawtooth', vol: 0.06, slide: 1500, attack: 0.15, filter: ['bandpass', 700, 2600, 3], vib: [14, 150] }); hiss(dur, { vol: 0.08, attack: 0.2, filter: ['bandpass', 1200, 5000, 2] }); hiss(0.07, { vol: 0.3, delay: dur, filter: ['bandpass', 900, 0, 2] }); },
    // The reveal: a reversed swell into a detuned minor-second stab, a sub drop and a thin high line that will not resolve.
    revealSting() {
      hiss(1.0, { vol: 0.2, attack: 0.95, filter: ['bandpass', 400, 5200, 1] });
      note(220, 1.0, { type: 'sawtooth', vol: 0.08, slide: 440, attack: 0.95, filter: ['lowpass', 300, 3000, 2] });
      [[116.5, 0], [123.5, 5], [174.6, -4], [185, 7], [466.2, 0]].forEach(([f, d]) => note(f, 3.4, { type: 'sawtooth', vol: 0.12, delay: 1.0, attack: 0.01, slide: f * 0.975, detune: d, filter: ['lowpass', 2400, 260, 1.4], drive: 3 }));
      note(64, 2.6, { type: 'sine', vol: 0.55, delay: 1.0, slide: 27 });
      note(1864.7, 3.6, { type: 'sine', vol: 0.035, delay: 1.15, attack: 0.6, vib: [5.5, 18] });
    },
    brassSwell() { [196, 246.94, 293.66, 392].forEach((f, i) => note(f, 2.8, { type: 'sawtooth', vol: 0.085, delay: i * 0.06, attack: 0.5, filter: ['lowpass', 500, 2600, 1], vib: [5, 9] })); note(98, 2.8, { type: 'square', vol: 0.06, attack: 0.4, filter: ['lowpass', 600, 0, 1] }); },
    celloDread() { [[87.31, 0], [92.5, 0.35], [130.81, 0.8]].forEach(([f, d]) => note(f, 3.2, { type: 'sawtooth', vol: 0.13, delay: d, attack: 0.7, slide: f * 0.98, filter: ['lowpass', 520, 900, 2], vib: [5.2, 26] })); },
    synthNote() { note(220, 4.2, { type: 'triangle', vol: 0.13, attack: 1.1, filter: ['lowpass', 1100, 700, 1], vib: [3.2, 8] }); note(110.3, 4.2, { type: 'sine', vol: 0.1, attack: 1.3 }); },
    racing(dur = 3) { for (let i = 0; i * 0.14 < dur; i++) { hiss(0.07, { vol: i % 4 === 0 ? 0.2 : 0.09, delay: i * 0.14, filter: ['bandpass', i % 4 === 0 ? 420 : 3200, 0, 2] }); if (i % 4 === 0) note(70, 0.16, { type: 'sine', vol: 0.3, delay: i * 0.14, slide: 42 }); } },
    softPiano() { [[220, 0], [261.63, 0.9], [329.63, 1.8], [311.13, 3.1], [246.94, 4.4], [220, 5.8]].forEach(([f, d]) => cue.piano(f, 0.11, d)); },
    // The next wing's cabinet waking up in the dark: a bright square-wave attract loop that ends on a coin ping.
    arcadeJingle() {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1567.98, 1396.9, 1174.66, 1318.5, 1567.98, 2093].forEach((f, i) => note(f, i === 12 ? 0.7 : 0.13, { type: 'square', vol: 0.06, delay: 0.15 + i * 0.13, attack: 0.004, filter: ['lowpass', 5200, 0, 0.7] }));
      [130.81, 130.81, 196, 196, 174.61, 196, 261.63].forEach((f, i) => note(f, 0.2, { type: 'triangle', vol: 0.14, delay: 0.15 + i * 0.26 }));
      note(987.77, 0.08, { type: 'square', vol: 0.07, delay: 2.15 }); note(1318.5, 0.5, { type: 'square', vol: 0.07, delay: 2.23 });
    },

    // ----- the horror kit (all synthesized here) -----
    // A low drone for dread: three detuned saws through a slowly opening filter, with a slow tremble.
    drone(dur = 8, vol = 0.1, root = 41.2) {
      [root, root * 1.005, root * 1.498].forEach((f, i) => note(f, dur, { type: 'sawtooth', vol: vol * (i === 2 ? 0.55 : 1), attack: dur * 0.4, filter: ['lowpass', 120, 260, 2], vib: [0.13 + i * 0.04, 14] }));
      hiss(dur, { vol: vol * 0.3, attack: dur * 0.45, filter: ['bandpass', 200, 260, 2] });
    },
    // A heartbeat that speeds up: the gap closes from gap0 to gap1.
    heartbeatRamp(n = 10, gap0 = 0.9, gap1 = 0.45, vol = 0.32) {
      let at = 0;
      for (let i = 0; i < n; i++) {
        note(62, 0.18, { type: 'sine', vol, delay: at, slide: 38 }); note(58, 0.2, { type: 'sine', vol: vol * 0.7, delay: at + 0.16, slide: 34 });
        at += gap0 + (gap1 - gap0) * (i / Math.max(1, n - 1)) ** 1.5;
      }
    },
    // The sub hit under a scare: a falling sine, a distorted low cluster and a burst of air.
    braam(vol = 0.5) {
      note(52, 2.2, { type: 'sine', vol, slide: 30, attack: 0.008 });
      [65.4, 69.3, 98].forEach((f, i) => note(f, 2, { type: 'sawtooth', vol: vol * 0.3, attack: 0.012, slide: f * 0.94, detune: i * 7, filter: ['lowpass', 900, 150, 1.4], drive: 4 }));
      hiss(0.5, { vol: vol * 0.5, filter: ['lowpass', 700, 90, 0.8] });
    },
    // A scream a long way off, with the mall's echo.
    screamFar(vol = 0.06) {
      for (const [d, k] of [[0, 1], [0.11, 0.5], [0.23, 0.3], [0.37, 0.18]]) {
        note(520, 0.35, { type: 'sawtooth', vol: vol * k, delay: d, attack: 0.04, slide: 740, filter: ['bandpass', 900, 0, 5], vib: [6, 40], drive: 2 });
        note(740, 0.75, { type: 'sawtooth', vol: vol * k * 0.8, delay: d + 0.3, attack: 0.02, slide: 430, filter: ['bandpass', 2400, 1500, 6], vib: [6.5, 55], drive: 2 });
      }
    },
    // A close scream, cut off dead. The silence after it is the point.
    screamCut(vol = 0.16) {
      note(610, 0.46, { type: 'sawtooth', vol, attack: 0.03, slide: 830, filter: ['bandpass', 1100, 0, 4], vib: [7, 60], drive: 5 });
      note(622, 0.46, { type: 'sawtooth', vol: vol * 0.7, attack: 0.03, slide: 905, filter: ['bandpass', 2500, 0, 6], vib: [9, 80], drive: 4 });
      hiss(0.45, { vol: vol * 0.5, attack: 0.05, filter: ['bandpass', 2100, 2600, 2] });
    },
    neckCrack() {
      for (let i = 0; i < 3; i++) hiss(0.018, { vol: 0.3, delay: i * 0.015, filter: ['bandpass', 2400, 0, 6], drive: 4 });
      note(140, 0.08, { type: 'square', vol: 0.09, slide: 70, filter: ['lowpass', 600, 0, 1] });
    },
    // A dead fluorescent trying to restrike.
    tubeTink() {
      note(3200, 0.018, { type: 'square', vol: 0.06, attack: 0.002 }); note(3200, 0.018, { type: 'square', vol: 0.05, delay: 0.07, attack: 0.002 });
      note(120, 0.55, { type: 'sawtooth', vol: 0.07, delay: 0.1, attack: 0.38, filter: ['bandpass', 240, 0, 4], drive: 5 });
    },
    breathPanic(dur = 2, rate = 2.2) {
      for (let i = 0; i < dur * rate; i++) {
        const d = i / rate, half = 0.45 / rate;
        hiss(half, { vol: 0.09, delay: d, attack: half * 0.6, filter: ['bandpass', 1400, 1100, 2.4] });
        hiss(half, { vol: 0.065, delay: d + half * 1.1, attack: half * 0.25, filter: ['bandpass', 900, 700, 2] });
      }
    },
    // Weight hitting something soft.
    bodyHit() {
      hiss(0.28, { vol: 0.45, filter: ['lowpass', 600, 90, 0.8] });
      note(90, 0.35, { type: 'sine', vol: 0.45, slide: 45 });
      hiss(0.22, { vol: 0.16, delay: 0.03, filter: ['bandpass', 1200, 350, 8] });
    },
    glassThud() {
      hiss(0.4, { vol: 0.55, filter: ['lowpass', 300, 70, 0.8] });
      note(70, 0.5, { type: 'sine', vol: 0.55, slide: 32 });
      note(2800, 0.07, { type: 'sine', vol: 0.06, slide: 2500 });
    },
    // The tape grinding to a stop.
    tapeStop() { note(400, 0.5, { type: 'sawtooth', vol: 0.09, slide: 40, filter: ['lowpass', 2200, 90, 1.4], drive: 2 }); hiss(0.45, { vol: 0.05, filter: ['bandpass', 1800, 200, 1.4] }); },
    // The studio card's cue: a projector starting to run, and one far cold bell.
    studioCue() {
      for (let i = 0; i < 40; i++) hiss(0.012, { vol: 0.05 * Math.min(1, (i + 1) / 12), delay: 0.2 + i * (0.09 - Math.min(0.048, i * 0.002)), filter: ['bandpass', 1900, 0, 3] });
      note(55, 3.4, { type: 'sine', vol: 0.2, delay: 0.5, attack: 0.9 });
      note(659.3, 3, { type: 'sine', vol: 0.05, delay: 1.2, attack: 0.008, filter: ['lowpass', 2000, 700, 0.8] });
      note(622.3, 2.6, { type: 'sine', vol: 0.03, delay: 1.9, attack: 0.4 });
    },
    // The credits: a slow minor figure over a held low fifth, resolving upward and not landing.
    creditsCue(dur = 9) {
      [[110, 0], [164.8, 0.4], [261.6, 2.4], [329.6, 2.8]].forEach(([f, d]) => note(f, dur - d, { type: 'sawtooth', vol: 0.045, delay: d, attack: 1.6, slide: f * 0.997, filter: ['lowpass', 420, 1200, 1], detune: d * 3 }));
      [[440, 0.4], [523.25, 1.5], [493.88, 2.6], [415.3, 3.9], [440, 5.2], [622.25, 6.6]].forEach(([f, d]) => cue.piano(f, 0.1, d));
    },

    // A black-out: everything dips for a beat (the sudden silence before a slam)
    duck(dur = 0.6) {
      if (!bus || !busCtx) return;
      try { const t = busCtx.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0.02, t, 0.015); bus.gain.setTargetAtTime(1, t + dur, 0.05); } catch { /* context gone */ }
    },

    stopAll() {
      if (!bus || !busCtx) return;
      try { const t = busCtx.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, 0.04); } catch { /* context gone */ }
      const old = bus; bus = null;
      setTimeout(() => { try { old.disconnect(); } catch { /* ignore */ } }, 600);
    },
  };
  return cue;
}
