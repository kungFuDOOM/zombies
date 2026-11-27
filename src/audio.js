// Synthesized sound effects (Web Audio) and the announcer (Web Speech).

import { createMusic } from './music.js';
import { makeCine } from './cineAudio.js';

let ctx = null;
let master = null;
let muted = false;
// The announcer (V turns it off or on; the choice is remembered).
let voiceOn = true;
try { voiceOn = localStorage.getItem('motd-voice') !== 'off'; } catch { /* storage unavailable */ }
const lastPlayed = {};

export function initAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopVoice();
  if (musicBus) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.05);
  return muted;
}
export const isMuted = () => muted;

export function toggleVoice() {
  voiceOn = !voiceOn;
  if (!voiceOn) stopVoice();
  try { localStorage.setItem('motd-voice', voiceOn ? 'on' : 'off'); } catch { /* storage unavailable */ }
  return voiceOn;
}

function throttle(name, ms) {
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < ms) return false;
  lastPlayed[name] = now;
  return true;
}

function tone(freq, dur, { type = 'square', vol = 0.25, slide = null, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(slide, 20), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.3, freq = 1200, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  shoot(kind) {
    if (!throttle('shoot', 45)) return;
    if (kind === 'fireball') { noise(0.18, { vol: 0.15, freq: 900 }); tone(300, 0.15, { type: 'sawtooth', vol: 0.08, slide: 120 }); }
    else if (kind === 'arrow') tone(900, 0.07, { type: 'triangle', vol: 0.12, slide: 400 });
    else tone(520, 0.09, { type: 'square', vol: 0.08, slide: 260 });
  },
  melee() { if (throttle('melee', 60)) { noise(0.08, { vol: 0.25, freq: 2500 }); tone(180, 0.08, { vol: 0.1, slide: 90 }); } },
  hit() { if (throttle('hit', 40)) noise(0.06, { vol: 0.18, freq: 1800 }); },
  enemyShot() { if (throttle('eshot', 80)) tone(240, 0.12, { type: 'sawtooth', vol: 0.06, slide: 160 }); },
  // the Abatement Team: a suppressed rifle's flat cough, and a net launcher's thump
  suppressed() { if (throttle('rifle', 70)) { noise(0.07, { vol: 0.16, freq: 900 }); tone(130, 0.06, { type: 'square', vol: 0.06, slide: 60 }); } },
  netShot() { if (throttle('net', 120)) { tone(190, 0.16, { type: 'sine', vol: 0.16, slide: 70 }); noise(0.18, { vol: 0.08, freq: 2400 }); } },
  hurt() { if (throttle('hurt', 140)) tone(140, 0.14, { type: 'square', vol: 0.15, slide: 70 }); },
  die() { tone(400, 0.6, { type: 'sawtooth', vol: 0.2, slide: 50 }); },
  food() { tone(392, 0.08, { vol: 0.12 }); tone(523, 0.08, { vol: 0.12, delay: 0.07 }); tone(659, 0.12, { vol: 0.12, delay: 0.14 }); },
  gold() { if (throttle('gold', 50)) { tone(1046, 0.06, { type: 'triangle', vol: 0.15 }); tone(1568, 0.1, { type: 'triangle', vol: 0.15, delay: 0.05 }); } },
  key() { tone(2200, 0.05, { type: 'square', vol: 0.07 }); tone(2200, 0.09, { type: 'square', vol: 0.07, delay: 0.09 }); }, // keycard reader beep-beep
  door() { noise(0.35, { vol: 0.3, freq: 400 }); tone(90, 0.35, { type: 'sawtooth', vol: 0.12, slide: 60 }); },
  potion() { noise(0.12, { vol: 0.6, freq: 2500 }); noise(0.5, { vol: 0.3, freq: 900 }); tone(180, 0.18, { type: 'square', vol: 0.2, slide: 40 }); tone(3200, 0.7, { type: 'sine', vol: 0.05, delay: 0.1 }); }, // flashbang: bang, then the ringing
  explode() { if (throttle('explode', 70)) noise(0.3, { vol: 0.3, freq: 700 }); },
  powerup() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.13, delay: i * 0.06 })); },
  levelup() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.09, delay: i * 0.07 })); },
  turbo() { noise(0.25, { vol: 0.25, freq: 3000 }); tone(220, 0.25, { type: 'sawtooth', vol: 0.12, slide: 880 }); },
  exit() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); },
  join() { tone(659, 0.08, { vol: 0.1 }); tone(988, 0.15, { vol: 0.1, delay: 0.08 }); },
  select() { tone(880, 0.05, { type: 'triangle', vol: 0.1 }); },
  // The Deep-Fry Butcher's roar: a rough, rumbling growl (detuned saws with a fast wobble through a
  // sweeping low-pass), a hiss of frying oil, and a sub-bass thump. All synthesized here.
  roar() {
    if (!ctx || muted || !throttle('roar', 600)) return;
    const t0 = ctx.currentTime, dur = 1.5;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.5, t0 + 0.12);
    out.gain.setValueAtTime(0.5, t0 + 0.7);
    out.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(260, t0);
    lp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.35);
    lp.frequency.exponentialRampToValueAtTime(320, t0 + dur);
    const shaper = ctx.createWaveShaper(); // grit
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); }
    shaper.curve = curve;
    lp.connect(shaper).connect(out).connect(master);
    const wob = ctx.createOscillator(); // the throat's rattle
    const wobAmt = ctx.createGain();
    wob.frequency.value = 26; wobAmt.gain.value = 14;
    wob.connect(wobAmt);
    for (const [mult, type] of [[1, 'sawtooth'], [1.51, 'sawtooth'], [0.5, 'square']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(95 * mult, t0);
      o.frequency.linearRampToValueAtTime(150 * mult, t0 + 0.3);
      o.frequency.exponentialRampToValueAtTime(58 * mult, t0 + dur);
      wobAmt.connect(o.frequency);
      o.connect(lp);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    wob.start(t0); wob.stop(t0 + dur + 0.05);
    noise(dur, { vol: 0.35, freq: 1800 });
    tone(48, 0.5, { type: 'sine', vol: 0.4, slide: 30 });
  },
  boss() { tone(70, 1.2, { type: 'sawtooth', vol: 0.25, slide: 40 }); noise(1.2, { vol: 0.2, freq: 300 }); },
};

// Cinematic cues (the opening, the story scenes): see cineAudio.js. They are sfx like any other, so an
// online host's stings reach the guests too; stopAll is local only.
// (the films' cues go through their own gain, so a spoken line can lean on them without touching the game's sfx)
let cineMix = null;
function cineOut() {
  if (!ctx) return master;
  if (!cineMix || cineMix.context !== ctx) { cineMix = ctx.createGain(); cineMix.connect(master); }
  return cineMix;
}
const cine = makeCine(() => ({ ctx, master: ctx ? cineOut() : null, muted }));
const { stopAll: stopCine, ...cineCues } = cine;
Object.assign(sfx, cineCues);
// True silence before a shock: the cinema bus and the music both drop out for `dur` seconds. (Added before the
// audioTap wrap below, so online guests get the same silence.)
sfx.duckAll = (dur = 0.6) => { cine.duck(dur); musicDuck(dur); };
export { stopCine, cine };
export const audioReady = () => !!ctx && ctx.state === 'running';

// The mall's PA: the one speaking voice that can't go through Web Audio, so it is the browser's
// speech voice pushed low and slow, with the crackle laid over it by cineAudio. Returns false if
// there is no speech (the caption carries the line).
export function paSpeak(text) {
  if (muted || !voiceOn || !window.speechSynthesis) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = browserVoice();
    if (v) u.voice = v;
    u.pitch = 0.45; u.rate = 0.78; u.volume = 1;
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

// When hosting online, every sound effect and announcer line is also handed to audioTap.fn
// so it can be replayed on the guests' machines.
export const audioTap = { fn: null };
for (const k of Object.keys(sfx)) {
  const play = sfx[k];
  sfx[k] = (...args) => { if (audioTap.fn) audioTap.fn(['a', k, ...args]); return play(...args); };
}

// ---------- the announcer ----------
// Lines are pre-recorded with a neural voice (assets/voice, made by tools/build-voice.py)
// and played through Web Audio. Anything without a recording uses the browser's speech
// voice, picking the most natural-sounding one available.

// Story and character lines (assets/voice/lines.json) play by id from assets/voice/<id>.mp3: see "story voices" below.

let voiceIndex = null; // announcer: line text -> recording file
let voiceIds = {};     // story line id -> recording file
const lineIds = new Map(); // story line text -> id
const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
getJson('assets/voice/index.json').then((d) => { voiceIndex = d && d.lines; voiceIds = (d && d.ids) || {}; });
getJson('assets/voice/lines.json').then((d) => { for (const l of (d && d.lines) || []) lineIds.set(l.text, l.id); setSpeakers((d && d.lines) || []); });
const clips = new Map(); // file -> Promise<AudioBuffer>
let speaking = null;     // { src } while a recording plays
let queued = null;       // one line waiting for the current one to finish

function loadClip(file) {
  if (!clips.has(file)) {
    const p = fetch(`assets/voice/${file}`).then((r) => { if (!r.ok) throw new Error(`no clip ${file}`); return r.arrayBuffer(); }).then((b) => ctx.decodeAudioData(b));
    p.catch(() => clips.delete(file));
    clips.set(file, p);
  }
  return clips.get(file);
}

function playClip(file) {
  const me = {};
  speaking = me;
  loadClip(file).then((buf) => {
    if (speaking !== me || muted || !voiceOn) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    src.buffer = buf;
    src.connect(gain).connect(ctx.destination);
    src.onended = () => {
      if (speaking !== me) return;
      speaking = null;
      if (queued) { const q = queued; queued = null; playClip(q); }
    };
    me.src = src;
    src.start();
  }).catch(() => { if (speaking === me) speaking = null; });
}

export function stopVoice() {
  stopLine();
  queued = null;
  if (speaking && speaking.src) { try { speaking.src.stop(); } catch { /* already stopped */ } }
  speaking = null;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

let bestVoice;
function browserVoice() {
  if (bestVoice !== undefined || !window.speechSynthesis) return bestVoice;
  const voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  if (!voices.length) return null; // not loaded yet; try again next time
  const rank = (v) => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google uk english male|daniel|guy|ryan|arthur|male/i.test(v.name) ? 2 : 0) + (/google/i.test(v.name) ? 1 : 0);
  bestVoice = voices.sort((a, b) => rank(b) - rank(a))[0];
  return bestVoice;
}

let lastSaid = {};
export function say(text, key = text, cooldown = 8000) {
  if (Object.keys(lastSaid).length > 300) lastSaid = {}; // keys can come from an online host: keep it bounded
  if (audioTap.fn) audioTap.fn(['v', text, key, cooldown]);
  if (muted || !voiceOn) return;
  const now = performance.now();
  if (lastSaid[key] && now - lastSaid[key] < cooldown) return;
  lastSaid[key] = now;
  const story = key.startsWith('story');
  if (lineIdOf(text)) { // a story line: its own clip, and the browser's voice if that is missing
    stopVoice();
    playLine(text, { local: true, onMissing: () => speak(text, true) }); // (guests got the 'v' event above)
    return;
  }
  if (story) stopLine();
  const file = voiceIndex && Object.prototype.hasOwnProperty.call(voiceIndex, text) ? voiceIndex[text] : null;
  if (file && ctx) {
    if (story) stopVoice(); // a new page of the story cuts off the last one
    if (speaking) { queued = file; return; }
    playClip(file);
    return;
  }
  speak(text, story);
}

function speak(text, story) {
  if (muted || !voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
  if (story) window.speechSynthesis.cancel();
  else if (window.speechSynthesis.speaking && window.speechSynthesis.pending) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = browserVoice();
  if (v) u.voice = v;
  u.pitch = 0.85;
  u.rate = 0.95;
  u.volume = 0.9;
  window.speechSynthesis.speak(u);
}

// ---------- story voices ----------
// One character line at a time. Clips are fetched the first time they are wanted (never all at boot); a missing or
// broken file is silent and the subtitle carries the line. While one plays, the music and the films' cues step back.

const LOAD_GRACE = 2.5;     // seconds a subtitle will wait on a download before giving up on the voice
const BAND_LIMITED = new Set(['pa', 'news', 'radio', 'ashby']); // voices out of a speaker, a TV or a handset
const speakers = new Map(); // id -> speaker
const missing = new Set();  // files that failed this session: not asked for again
const decoded = new Map();  // file -> AudioBuffer, once it is ready
let lineNow = null;         // { text, file, state: 'loading'|'playing'|'done'|'failed', asked, endAt, src }

function setSpeakers(lines) { for (const l of lines) speakers.set(l.id, l.speaker); }
export const lineIdOf = (text) => lineIds.get(text) || null;
const fileOf = (text) => {
  const id = lineIdOf(text);
  return id && Object.prototype.hasOwnProperty.call(voiceIds, id) ? voiceIds[id] : null;
};
const nowSec = () => performance.now() / 1000;

function fetchLine(file) {
  const p = loadClip(file);
  p.then((buf) => decoded.set(file, buf), () => missing.add(file));
  return p;
}

/** Fetch these lines ahead of time (the ones a film is about to speak). */
export function preloadLines(texts) {
  if (!ctx || muted || !voiceOn) return;
  for (const text of texts) { const f = fileOf(text); if (f && !missing.has(f)) fetchLine(f).catch(() => {}); }
}

/** Is this line's recording downloaded and ready to start at once? */
export const lineReady = (text) => !muted && voiceOn && !!ctx && decoded.has(fileOf(text));

function duckVoice(on) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime, tc = on ? 0.06 : 0.3;
    if (voiceDuck) voiceDuck.gain.setTargetAtTime(on ? 0.3 : 1, t, tc);
    if (cineMix) cineMix.gain.setTargetAtTime(on ? 0.55 : 1, t, tc);
  } catch { /* context gone */ }
}

function startLine(me, buf, maxDur, onEnd) {
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.95;
  src.buffer = buf;
  // a film on a fixed clock gives the line a slot: read a little faster rather than be cut off
  const rate = maxDur > 0 ? Math.min(1.15, Math.max(1, buf.duration / maxDur)) : 1;
  src.playbackRate.value = rate;
  let node = src;
  if (BAND_LIMITED.has(speakers.get(lineIdOf(me.text)))) {
    for (const [type, freq] of [['highpass', 320], ['lowpass', 3400]]) {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; node.connect(f); node = f;
    }
  }
  node.connect(gain).connect(ctx.destination);
  src.onended = onEnd;
  me.src = src;
  me.state = 'playing';
  me.endAt = ctx.currentTime + buf.duration / rate;
  duckVoice(true);
  src.start();
}

/**
 * Speak a story line by its subtitle text, cutting off the one before it. Never throws.
 * o: { local: don't send it to online guests, maxDur: seconds before a fixed timeline moves on, onMissing() }
 */
export function playLine(text, o = {}) {
  stopLine(true);
  if (!lineIdOf(text)) { if (o.onMissing) o.onMissing(); return false; }
  if (!o.local && audioTap.fn) audioTap.fn(['l', text]);
  if (muted || !voiceOn) return false;
  const file = fileOf(text);
  if (!ctx || !file || missing.has(file)) { if (o.onMissing) o.onMissing(); return false; }
  const me = lineNow = { text, file, state: 'loading', asked: nowSec(), endAt: 0, src: null };
  const end = () => { if (lineNow !== me) return; me.state = 'done'; duckVoice(false); };
  const fail = () => { if (lineNow !== me) return; me.state = 'failed'; duckVoice(false); if (o.onMissing) o.onMissing(); };
  const begin = (buf) => {
    if (lineNow !== me || muted || !voiceOn) return;
    if (nowSec() - me.asked > LOAD_GRACE) { me.state = 'done'; return; } // too late: the scene has moved on
    try { startLine(me, buf, o.maxDur, end); } catch { fail(); }
  };
  if (decoded.has(file)) begin(decoded.get(file));
  else fetchLine(file).then(begin, fail);
  return true;
}

function stopLine(silentDuck = false) {
  const me = lineNow;
  lineNow = null;
  if (me && me.src) { try { me.src.stop(); } catch { /* already stopped */ } }
  if (me || !silentDuck) duckVoice(false);
}

/** A scene moved on early: cut the line off, here and on the guests' machines. */
export function hushLine() {
  if (audioTap.fn) audioTap.fn(['l', '']);
  stopLine();
}

/** Seconds a subtitle should still wait for this line's voice. 0 = no voice (missing, muted, off, finished). */
export function voiceLeft(text) {
  const me = lineNow;
  if (!me || me.text !== text || muted || !voiceOn) return 0;
  if (me.state === 'loading') return nowSec() - me.asked < LOAD_GRACE ? 0.5 : 0;
  if (me.state !== 'playing' || !ctx || ctx.state !== 'running') return 0;
  return Math.max(0, me.endAt - ctx.currentTime);
}

// ---------- music ----------
// Every level, guardian, hub, menu and stinger has its own synthesized track (see
// music-data.js and music.js). This part wires the engine to the mute / music toggles,
// pausing and the tab being hidden.

const MUSIC_VOL = 0.55;
let musicBus = null;
let engine = null;
let musicOn = true;
let timer = null;
let wantPaused = false;

const musicLevel = () => (muted || !musicOn ? 0 : MUSIC_VOL);
let duckGain = null; // between the music bus and the master: only the films' silences move it
let voiceDuck = null; // and one only the story voices move, so the two never undo each other
function musicDuck(dur) {
  if (!ctx || !duckGain) return;
  try { const t = ctx.currentTime; duckGain.gain.cancelScheduledValues(t); duckGain.gain.setTargetAtTime(0.02, t, 0.015); duckGain.gain.setTargetAtTime(1, t + dur, 0.08); } catch { /* context gone */ }
}

function ensureMusic() {
  if (!ctx) return false;
  if (!engine) {
    musicBus = ctx.createGain();
    musicBus.gain.value = musicLevel();
    duckGain = ctx.createGain();
    voiceDuck = ctx.createGain();
    voiceDuck.gain.value = lineNow && lineNow.state === 'playing' ? 0.3 : 1;
    musicBus.connect(voiceDuck);
    voiceDuck.connect(duckGain);
    duckGain.connect(master);
    engine = createMusic(ctx, musicBus);
    if (wantPaused) engine.setPaused(true);
  }
  if (!timer) timer = setInterval(() => { if (!document.hidden) engine.tick(); }, 40);
  return true;
}

// name: a track id from music-data.js; playing the same one again does nothing
export function playMusic(name, fadeOut = 0.8) {
  if (!ensureMusic()) return;
  if (!name) { engine.stop(fadeOut); return; } // null: silence (the openers score themselves)
  engine.play(name);
}
export const currentMusic = () => (engine ? engine.current : null);

// boss tracks gain layers as the guardian gets angrier (0 calm, 1 enraged, 2 furious)
export function setMusicIntensity(level) { if (engine) engine.setIntensity(level); }

// hold the music while the game is paused
export function setMusicPaused(on) {
  wantPaused = on;
  if (engine) engine.setPaused(on);
}

export function toggleMusic() {
  musicOn = !musicOn;
  if (musicBus) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.05);
  return musicOn;
}

// switching tabs: silence the audio clock entirely, and pick up where it was on return
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); } else if (ctx.state === 'suspended') ctx.resume();
  });
}
