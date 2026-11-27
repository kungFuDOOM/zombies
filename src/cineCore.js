// Cinematic toolkit, part 1: easing, camera moves and the shot timeline (CinePlayer).
//
// A film is a list of SHOTS laid end to end. Each shot has a duration, a camera move and optional hooks:
//
//   { id, dur, cam: dolly([0,50,500],[0,50,200],[0,60,-500]), fov: [50, 46], dof: { focus: [300, 900], aperture: 1 },
//     exposure: 1, bloom: 0.6, enter(player, shot) {...}, tick(dt, lt, k, player) {...} }
//
// Camera helpers (dolly, crane, push, over-the-shoulder, whip, orbit) all produce the same plain spec, so a shot can
// also be written by hand. The `fov` of a shot is the VISIBLE vertical field of view (the part between the 2.39:1 scope
// bars): the player widens the real lens to cover the bars. The picture is always 3:2 (the stage scales it), so framing is
// the same on a desktop and on a phone held either way. Cuts are hard by default; fast camera moves smear on High.
//
// CinePlayer owns time, the camera, handheld and shake, lens splats, flares, subtitles, name cards and the post chain; the film's own file (intro.js)
// owns the scene, the lights and the per-shot hooks.

import * as THREE from 'three';
import { CinePost } from './cinePost.js';
import { scopeBarFrac } from './camMath.js';

// ----- little maths helpers (shared by every cinematic file) -----
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const mix = (a, b, k) => a + (b - a) * k;
export const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const EASE = {
  lin: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) * (1 - k),
  smooth,
  smoother: (k) => k * k * k * (k * (k * 6 - 15) + 10),
  slowIn: (k) => k * k * k,                       // a long creep that accelerates
  whip: (k) => (k < 0.5 ? 8 * k ** 4 : 1 - 8 * (1 - k) ** 4), // slow, violent middle, slow
};
export const ease = (name, k) => (EASE[name] || EASE.smooth)(clamp01(k));

// ----- camera move constructors: all return { p:[from,to], l:[from,to], fov:[from,to], roll, ease, hand } -----
const pair = (a, b) => [a, b || a];
/** Straight move along the floor (or any line) while looking at a fixed point or a moving one. */
export const dolly = (p0, p1, l0, l1 = l0, o = {}) => ({ p: [p0, p1], l: [l0, l1], ease: 'smooth', hand: 0.5, ...o });
/** A vertical move; same shape as a dolly, kept as its own name so a shot list reads like a script. */
export const crane = (p0, p1, l0, l1 = l0, o = {}) => ({ p: [p0, p1], l: [l0, l1], ease: 'smooth', hand: 0.25, ...o });
/** Slow push-in on a face / prop: the camera barely moves, the lens tightens. */
export const push = (p0, p1, l0, l1 = l0, o = {}) => ({ p: [p0, p1], l: [l0, l1], ease: 'smooth', hand: 0.2, ...o });
/** Over-the-shoulder: camera sits behind `shoulder` looking past it at `target`. */
export const ots = (shoulder, target, o = {}) => {
  const d = [target[0] - shoulder[0], 0, target[2] - shoulder[2]];
  const n = Math.hypot(d[0], d[2]) || 1;
  const side = o.side ?? 1, back = o.back ?? 34, up = o.up ?? 14;
  const p = [shoulder[0] - d[0] / n * back - d[2] / n * 12 * side, shoulder[1] + up, shoulder[2] - d[2] / n * back + d[0] / n * 12 * side];
  return { p: [p, mix3(p, [p[0] + d[0] / n * (o.drift ?? 8), p[1], p[2] + d[2] / n * (o.drift ?? 8)], 1)], l: [target, target], ease: 'smooth', hand: 0.3, ...o };
};
/** Fast pan: the camera stays put and the look-at sweeps from one point to another. The post chain smears the middle. */
export const whip = (p, l0, l1, o = {}) => ({ p: [p, p], l: [l0, l1], ease: 'whip', hand: 0.1, blur: 1, ...o });
/** Circle a point: radius, angle (radians) and height all interpolate. */
export const orbit = (c, r, a, y, l = null, o = {}) => ({ orbit: { c, r: pair(r[0], r[1]), a: pair(a[0], a[1]), y: pair(y[0], y[1]) }, l: pair(l || [c[0], c[1] + y[0] * 0.2, c[2]]), ease: 'smooth', hand: 0.25, ...o });

/**
 * Evaluate a camera spec at shot progress k (0..1). A spec may be a sequence of timed segments, { seq: [{ to: 0.26, ...move }, { to: 1, ...move }] },
 * for a shot that is a whip-pan and then a hold (each segment's `to` is the fraction of the shot where it ends).
 */
export function evalCam(c, k) {
  if (c.seq) {
    let a = 0;
    for (let i = 0; i < c.seq.length; i++) {
      const seg = c.seq[i];
      if (k <= seg.to || i === c.seq.length - 1) return evalCam({ hand: c.hand, ...seg }, clamp01((k - a) / Math.max(1e-4, seg.to - a)));
      a = seg.to;
    }
  }
  const e = ease(c.ease || 'smooth', k);
  let p;
  if (c.orbit) {
    const o = c.orbit, a = mix(o.a[0], o.a[1], e);
    const r = mix(o.r[0], o.r[1], e);
    p = [o.c[0] + Math.sin(a) * r, mix(o.y[0], o.y[1], e), o.c[2] + Math.cos(a) * r];
  } else p = mix3(c.p[0], c.p[1], e);
  const l = mix3(c.l[0], c.l[1], e);
  const roll = c.roll ? mix(c.roll[0], c.roll[1] ?? c.roll[0], e) : 0;
  return { p, l, roll, fov: c.fov ? mix(c.fov[0], c.fov[1] ?? c.fov[0], e) : null, hand: c.hand, blur: c.blur || 0 };
}

// A smooth pseudo-random wobble (sum of sines), so handheld and shake never jitter randomly frame to frame.
const wob = (t, s) => Math.sin(t * 1.7 + s) + 0.6 * Math.sin(t * 2.9 + s * 2.1) + 0.3 * Math.sin(t * 5.3 + s * 3.7);

/** Everything a film needs per frame, except its own scene. */
export class CinePlayer {
  /**
   * @param r3d     the game's Renderer3D (only .renderer, .quality and the pixel ratio are used, read-only)
   * @param scene   the film's THREE.Scene
   * @param shots   [{id, dur, cam, fov:[a,b], dof, exposure, bloom, enter, tick}]
   */
  constructor(r3d, scene, shots) {
    this.r3d = r3d;
    this.renderer = r3d.renderer;
    this.scene = scene;
    this.high = r3d.quality === 'high';
    this.camera = new THREE.PerspectiveCamera(50, 1.5, 3, 3600);
    this.post = new CinePost(this.renderer, { high: this.high });
    let a = 0;
    this.shots = shots.map((s) => { const o = { ...s, a, b: a + s.dur }; a += s.dur; return o; });
    this.end = a;
    this.cues = [];           // [t, fn] sorted
    this.subs = [];           // dialogue / PA lines
    this.cards = [];          // hero name cards
    this.slates = [];         // place / time cards
    this.titleEnd = Infinity;
    this.shakes = [];         // [t0, amp, decay]
    this.barMax = scopeBarFrac(); // each letterbox bar as a fraction of the picture height: true 2.39:1 scope
    this.barIn = [0, 1];      // [start, duration] of the bars sliding in
    this.fadeFn = null;       // t => 0..1 black overlay
    this.grade = 'NIGHT_RAIN'; // the default look (cineGrade.js); a shot's own `grade` wins
    this.titleAt = -1;
    this.frames = 0; this.ema = 0; this.lastRender = 0;
    this.flashV = 0;          // lightning / muzzle flash 0..1, set by the film
    this.reset();
  }

  reset() { this.t = 0; this.cueI = 0; this.shotI = -1; this.shakes.length = 0; this.punches = []; this.splats = []; this.caV = 0; this.lastCa = 0; this.flashV = 0; this.prevVP = null; }

  at(t, fn) { this.cues.push([t, fn]); this.cues.sort((a, b) => a[0] - b[0]); }
  shake(t, amp, decay = 4.5) { this.shakes.push([t, amp, decay]); }
  /** A hit's lens punch: the field of view snaps tighter, and the colour channels split for a moment. */
  punch(t, amt = 0.07, ca = 0.012) { this.punches.push([t, amt]); this.caV = Math.max(this.caV, ca); if (this.punches.length > 8) this.punches.shift(); }
  /** Something lands on the lens. */
  splat(t, amt = 0.8, kind = 'blood', seed = 1) { this.splats.push({ t0: t, amt, kind, seed }); if (this.splats.length > 4) this.splats.shift(); }
  say(a, b, speaker, color, text, kind = 'line') { this.subs.push({ a, b, speaker, color, text, kind }); }
  card(a, b, name, role, color, blurb = '') { this.cards.push({ a, b, name, role, color, blurb }); }
  slate(a, b, line1, line2 = '') { this.slates.push({ a, b, line1, line2 }); }

  shotAt(t) {
    for (let i = this.shots.length - 1; i >= 0; i--) if (t >= this.shots[i].a) return i;
    return 0;
  }

  /** Viewport facts the overlay's type sizes depend on. */
  viewInfo() {
    const w = window.innerWidth || 960, h = window.innerHeight || 640;
    const portrait = h > w * 1.05;
    const s = Math.min(w / 960, h / 640);   // CSS pixels per virtual canvas pixel (0.41 on a 390 wide phone)
    return { portrait, s };
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    while (this.cueI < this.cues.length && this.cues[this.cueI][0] <= t) { try { this.cues[this.cueI][1](this); } catch (e) { console.warn('cue failed', e); } this.cueI++; }
    const i = this.shotAt(t);
    if (i !== this.shotI) { this.shotI = i; const s = this.shots[i]; s.entered = true; this.prevVP = null; if (s.enter) s.enter(this, s); this.cutT = t; }
    const s = this.shots[i];
    if (s.tick) s.tick(dt, t - s.a, clamp01((t - s.a) / s.dur), this);
    this.flashV = Math.max(0, this.flashV - dt * 4);
    return t >= this.end;
  }

  /** Place the camera for the current time (called by render; exposed so films can aim lights at it). */
  frame() {
    const t = this.t, s = this.shots[Math.max(0, this.shotI)];
    const k = clamp01((t - s.a) / s.dur);
    const c = evalCam(s.cam, k);
    const bar = this.bar();
    // handheld: smooth, mostly rotational (that is what reads as an operator), plus the impulse shakes
    const h = c.hand ?? 0.3, f0 = 0.8 + 0.5 * Math.min(3.2, h);
    const ht = t * f0;
    let sx = wob(ht, 1) * h * 0.5, sy = wob(ht, 7) * h * 0.3;
    const rot = 0.55 * h * (Math.PI / 180);
    let ry = wob(ht, 13) * rot * 0.35, rx = wob(ht, 17) * rot * 0.26, sr = wob(ht, 19) * rot * 0.18;
    if (c.panic || s.panic) { // operator jolts: running with the camera
      const slot = Math.floor(t / 0.7);
      for (let n = slot - 1; n <= slot; n++) {
        if (hash(n * 1.7) < 0.2) continue;
        const age = t - (n * 0.7 + hash(n) * 0.3);
        if (age < 0 || age > 0.6) continue;
        const j = Math.exp(-14 * age) * Math.sin(38 * age) * (Math.PI / 180) * Math.min(1.4, 0.5 + h * 0.3);
        rx += j * 1.6; ry += j * 1.1 * (hash(n + 5) > 0.5 ? 1 : -1);
      }
    }
    for (const [t0, amp, dec] of this.shakes) {
      const age = t - t0;
      if (age < 0 || age > 2.5) continue;
      const f = amp * Math.exp(-age * dec);
      sx += wob(t * 9, t0) * f * 0.5; sy += wob(t * 9, t0 + 3) * f * 0.35; sr += wob(t * 7, t0 + 5) * f * 0.002;
      rx += wob(t * 11, t0 + 7) * f * 0.05 * (Math.PI / 180); ry += wob(t * 10, t0 + 9) * f * 0.05 * (Math.PI / 180);
    }
    const cam = this.camera;
    cam.position.set(c.p[0] + sx, c.p[1] + sy, c.p[2]);
    cam.up.set(0, 1, 0);
    cam.lookAt(c.l[0], c.l[1], c.l[2]);
    cam.rotateY(ry); cam.rotateX(rx);
    const roll = (c.roll || 0) + sr;
    if (roll) cam.rotateZ(roll);
    // the shot's FOV is what shows between the bars (a hit punches it tighter); widen the lens to cover the bars
    let vis = c.fov ?? (s.fov ? mix(s.fov[0], s.fov[1] ?? s.fov[0], smooth(k)) : 45);
    for (const [t0, amt] of this.punches) {
      const age = t - t0;
      if (age >= 0 && age < 1.2) vis *= 1 - amt * (age < 0.05 ? age / 0.05 : Math.exp(-6 * (age - 0.05)));
    }
    this.visFov = vis;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(vis) / 2) / Math.max(0.5, 1 - 2 * bar);
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    return { shot: s, k, cam, c };
  }

  bar() { return this.barMax * smooth((this.t - this.barIn[0]) / this.barIn[1]); }

  /** Frame-rate guard: if a tier cannot hold ~20 fps on this machine, drop a step (High -> Low pass -> plain render) for the rest of the film. */
  watchFrameRate() {
    const now = performance.now();
    if (this.lastRender) {
      const d = Math.min(250, now - this.lastRender);
      this.ema = this.ema ? this.ema * 0.92 + d * 0.08 : d;
      if (++this.frames > 90 && this.ema > 55) {
        if (this.high) { this.high = false; this.post.high = false; this.frames = 0; this.ema = 0; } else if (this.post.lowOk) { this.post.lowOk = false; this.post.lean = true; }
      }
    }
    this.lastRender = now;
  }

  render() {
    this.watchFrameRate();
    const { shot, cam, c } = this.frame();
    const t = this.t;
    // camera motion blur (High): how far a point straight ahead moved on screen since the last frame, 180 degree shutter
    let blur = [0, 0];
    if (this.high) {
      const m = this.mb || (this.mb = { vp: new THREE.Matrix4(), ahead: new THREE.Vector3(), cur: new THREE.Vector3() });
      if (this.prevVP) {
        const ahead = m.ahead.set(0, 0, -200).applyMatrix4(cam.matrixWorld);
        const cur = m.cur.copy(ahead).project(cam), pv = ahead.applyMatrix4(this.prevVP);
        const bx = (cur.x - pv.x) * 0.25, by = (cur.y - pv.y) * 0.25, len = Math.hypot(bx * 1500, by * 1000);
        if (len > 3) { const cap = Math.min(1, 0.04 / Math.max(1e-6, Math.hypot(bx, by))); blur = [bx * cap, by * cap]; }
      }
      this.prevVP = m.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    }
    // rack focus: focus distance eases between two values over the shot. A longer lens melts the background more.
    let focus = 0, aperture = 0;
    if (shot.dof && this.high) {
      const k = clamp01((t - shot.a) / shot.dur), f = shot.dof.focus;
      focus = Array.isArray(f) ? mix(f[0], f[1], ease(shot.dof.ease || 'smooth', (k - (shot.dof.from ?? 0)) / ((shot.dof.to ?? 1) - (shot.dof.from ?? 0)))) : f;
      aperture = (shot.dof.aperture ?? 1) * Math.min(2.2, Math.max(0.6, (24.3 / this.visFov) ** 1.5 + 0.35));
    }
    // the channel split decays after a hit (timed on the film clock)
    this.caV *= Math.exp(-6 * Math.max(0, Math.min(0.1, t - this.lastCa)));
    this.lastCa = t;
    this.post.render(this.scene, cam, {
      exposure: (shot.exposure ?? 1) * (1 + this.flashV * 0.8),
      bloom: shot.bloom ?? 0.55,
      focus, aperture,
      blur,
      ca: 0.004 + this.caV,
      grain: shot.grain,
      vignette: shot.vignette,
      grade: shot.grade || this.grade,
      time: t,
      bar: this.bar(),
    });
  }

  /** The current shot's practical lights, projected to the overlay's pixels, for the anamorphic flares. */
  flares() {
    const s = this.shots[Math.max(0, this.shotI)], out = [];
    if (!s || !s.flares) return out;
    const lt = this.t - s.a, v = this.flareV || (this.flareV = new THREE.Vector3());
    for (const f of s.flares) {
      const k = typeof f.k === 'function' ? f.k(lt, this) : f.k ?? 0.4;
      if (!(k > 0.02)) continue;
      const at = typeof f.at === 'function' ? f.at(lt, this) : f.at;
      if (!at) continue;
      v.set(at.x ?? at[0], at.y ?? at[1], at.z ?? at[2]).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1) continue;
      out.push({ x: (v.x + 1) * 480, y: (1 - v.y) * 320, k, len: f.len ?? 0.5, color: f.color || '#7ab8ff' });
    }
    return out;
  }

  /** The newest splat on the lens, if any. */
  splatView() {
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const sp = this.splats[i], age = this.t - sp.t0;
      if (age >= 0 && age < 4.2) return { kind: sp.kind, amt: sp.amt, age, seed: sp.seed };
    }
    return null;
  }

  /** What the 2D overlay draws this frame (see overlay.js). */
  view() {
    const t = this.t, v = this.viewInfo();
    const out = { t, bar: this.bar(), fade: this.fadeFn ? this.fadeFn(t) : 0, flash: this.flashV, sub: null, card: null, slate: null, title: null, ui: v, high: this.high, graded: this.post.graded, lean: this.post.lean, blood: this.splatView(), flares: this.flares() };
    for (const s of this.subs) {
      if (t < s.a || t > s.b + 0.5) continue;
      const cps = s.kind === 'pa' ? 30 : 48;
      let text = s.text.slice(0, Math.max(1, Math.floor((t - s.a) * cps)));
      const fade = t > s.b ? 1 - (t - s.b) / 0.5 : Math.min(1, (t - s.a) / 0.12);
      if (s.kind === 'pa' && Math.floor(t * 13) % 11 === 0) text = text.replace(/[AEIOUaeiou]/g, (m, i) => (hash(i + Math.floor(t * 13)) > 0.55 ? '#' : m));
      out.sub = { speaker: s.speaker, color: s.color, text, full: s.text, a: Math.max(0, fade), kind: s.kind };
    }
    for (const c of this.cards) {
      if (t >= c.a && t < c.b) out.card = { name: c.name, role: c.role, color: c.color, blurb: c.blurb, in: clamp01((t - c.a) / 0.28), out: clamp01((c.b - t) / 0.3) };
    }
    for (const c of this.slates) {
      if (t >= c.a && t < c.b) out.slate = { line1: c.line1, line2: c.line2, age: t - c.a, a: Math.min(1, (t - c.a) / 0.15, (c.b - t) / 0.35) };
    }
    if (this.titleAt >= 0 && t >= this.titleAt && t < this.titleEnd) out.title = { age: t - this.titleAt };
    return out;
  }

  dispose() { this.post.dispose(); }
}
