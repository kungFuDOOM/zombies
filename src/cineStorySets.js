// Cinematic toolkit, part 8: the sets and props only the in-campaign story scenes need (see storyFilm.js):
//
//   buildPizza()     Ray's Slice of Heaven: counter, half-down shutter, pizza oven, ticket spike, the collapsing
//                    hood, the Security Locker and the back door the dead come through
//   buildKitchen()   Toller's Carvery: fryer line, walk-in freezer, Vector Control canisters, meat hooks,
//                    heat lamps, the AIR INTAKE gauge
//   SteamPuffs       soft rising fryer steam
//   plus the printout, the Goth's boombox and the other small hand props
//
// Same contract as cineSets.js: a THREE.Group plus a handles object. Nothing here disposes itself; the film frees the
// whole scene with disposeTree(). All art is drawn in code.

import * as THREE from 'three';
import { glowTexture } from './models.js';
import { canvasTex, flicker } from './cineFx.js';
import { hash } from './cineCore.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.3, ...o });
const lit = (c, k = 1.5) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const flat = (map, o = {}) => new THREE.MeshBasicMaterial({ map, toneMapped: false, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
function add(g, geo, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; }
export const glowPlane = (w, h, color, opacity) => new THREE.Mesh(plane(w, h), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));

// A neon sign for any length of text (the stock one is sized for one short word).
export function wordSign(text, color, w = 640, h = 128) {
  return canvasTex(w, h, (c) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    let px = h * 0.62;
    c.font = `bold ${px}px Georgia, serif`;
    const tw = c.measureText(text).width;
    if (tw > w - 40) { px *= (w - 40) / tw; c.font = `bold ${px}px Georgia, serif`; }
    c.shadowColor = color; c.shadowBlur = 22;
    c.strokeStyle = color; c.lineWidth = 7; c.strokeText(text, w / 2, h / 2);
    c.fillStyle = '#fff4ee'; c.fillText(text, w / 2, h / 2);
  });
}

// Plain printed lettering on a coloured card (labels, door plates).
function labelTex(lines, { w = 256, h = 128, bg = '#e8e0c8', fg = '#201408', px = 34, border = null } = {}) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (border) { c.strokeStyle = border; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); }
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => {
      let s = px;
      c.font = `bold ${s}px sans-serif`;
      const tw = c.measureText(l).width;
      if (tw > w - 24) { s *= (w - 24) / tw; c.font = `bold ${s}px sans-serif`; }
      c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * px * 1.2);
    });
  });
}

function stripes(a, b, n, repeat = null) {
  return canvasTex(128, 128, (c) => { c.fillStyle = a; c.fillRect(0, 0, 128, 128); c.fillStyle = b; for (let i = 0; i < n; i++) c.fillRect((i * 128) / n, 0, 64 / n, 128); }, repeat);
}
function hazard() {
  return canvasTex(128, 32, (c, w, h) => { c.fillStyle = '#e0b020'; c.fillRect(0, 0, w, h); c.fillStyle = '#17130a'; for (let x = -32; x < w + 32; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x - 4, h); c.lineTo(x - 20, h); c.fill(); } }, [2, 1]);
}
function tiles(a, b, grout, repeat) {
  return canvasTex(128, 128, (c) => {
    c.fillStyle = a; c.fillRect(0, 0, 128, 128); c.fillStyle = b; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
    c.strokeStyle = grout; c.lineWidth = 2; for (let i = 0; i <= 128; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(0,0,0,${0.05 + hash(i) * 0.16})`; c.beginPath(); c.arc(hash(i + 3) * 128, hash(i + 9) * 128, 1 + hash(i + 5) * 5, 0, Math.PI * 2); c.fill(); }
  }, repeat);
}

// ===================================================================== steam
/** Soft puffs that rise and swell from a list of sources [x, y, z]. */
export class SteamPuffs {
  constructor(parent, sources, { n = 40, color = '#ffd8b0', opacity = 0.16, rise = 22, size = 26, life = 3.6 } = {}) {
    this.src = sources; this.rise = rise; this.size = size; this.life = life; this.opacity = opacity; this.gain = 1;
    this.puffs = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.renderOrder = 4;
      parent.add(s);
      this.puffs.push({ s, phase: hash(i + 2) * life, k: i % sources.length, seed: hash(i + 7) * 10 });
    }
  }
  update(dt, t) {
    for (const p of this.puffs) {
      const a = ((t + p.phase) % this.life) / this.life, o = this.src[p.k];
      p.s.position.set(o[0] + Math.sin(t * 0.7 + p.seed) * 10 * a + (hash(p.seed) - 0.5) * 18, o[1] + a * this.rise * this.life, o[2] + Math.cos(t * 0.5 + p.seed) * 6 * a);
      p.s.scale.setScalar(this.size * (0.45 + a * 1.5));
      p.s.material.opacity = this.opacity * this.gain * Math.sin(a * Math.PI);
    }
  }
}

// ===================================================================== small props
export function buildBoombox() {
  const g = new THREE.Group(), cones = [];
  const body = std('#6a6078', { metalness: 0.55, roughness: 0.35, emissive: '#1a1030' });
  g.add(new THREE.Mesh(box(30, 14, 11), body));
  for (const sx of [-8, 8]) { const c = new THREE.Mesh(new THREE.CircleGeometry(4.8, 18), lit('#d070ff', 0.7)); c.position.set(sx, 0, 5.6); g.add(c); cones.push(c); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(8, 0.8, 6, 12, Math.PI), body); handle.position.y = 7; g.add(handle);
  return { group: g, cones };
}

// A fan-fold dot-matrix printout. `rows` 0..1 is how far the printer has got.
export function drawPrintout(c, w, h, rows = 1) {
  c.fillStyle = '#e9e6d6'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 48) { c.fillStyle = 'rgba(90,150,100,0.13)'; c.fillRect(34, y, w - 68, 24); }
  c.fillStyle = '#6a685c'; for (let y = 14; y < h; y += 28) { c.beginPath(); c.arc(16, y, 6, 0, Math.PI * 2); c.arc(w - 16, y, 6, 0, Math.PI * 2); c.fill(); }
  const text = [
    ['PARAGON CROSSING SECURITY', 28, '#2a2a30'],
    ['DOOR LOG  11/25/94', 28, '#2a2a30'],
    ['---------------------', 26, '#5a5a60'],
    ['11:30 PM  FOG CREW: ROOF', 28, '#5a5a60'],
    ['11:58 PM  PA PAGES (4)', 28, '#5a5a60'],
    ['---------------------', 26, '#5a5a60'],
    ['OUTER DOORS LOCKED', 38, '#17171c'],
    ['11:55 PM', 66, '#17171c'],
    ['KEYCARD:', 40, '#17171c'],
    ['MALL COP', 70, '#b0101c'],
    ['---------------------', 26, '#5a5a60'],
  ];
  c.textAlign = 'center'; c.textBaseline = 'middle';
  let y = 30;
  const shown = Math.ceil(text.length * Math.max(0, Math.min(1, rows)));
  text.forEach(([s, px, col], i) => {
    y += px * 0.62;
    if (i < shown) {
      let size = px;
      c.font = `bold ${size}px "Courier New", monospace`;
      const tw = c.measureText(s).width;
      if (tw > w - 76) { size *= (w - 76) / tw; c.font = `bold ${size}px "Courier New", monospace`; }
      c.fillStyle = col; c.fillText(s, w / 2, y);
    }
    y += px * 0.62;
  });
}

// ===================================================================== Ray's Slice of Heaven
export const PIZZA_X = -4200;
export const TICKET_AT = [-44, 52, 10];   // centre of the ticket, in the set's local coordinates

export function buildPizza({ high }) {
  const g = new THREE.Group(), H = {};
  g.position.set(PIZZA_X, 0, 0);
  add(g, plane(900, 700).rotateX(-Math.PI / 2), std('#ffffff', { map: tiles('#4a2a2a', '#8a7a6a', '#1a1010', [14, 11]), roughness: 0.3, metalness: 0.15 }), 0, 0, 40);
  // back wall, side walls, tiled splashback
  add(g, box(640, 190, 8), lam('#2c1a24'), 0, 95, -108);
  add(g, plane(230, 74), flat(tiles('#b8a890', '#c8baa0', '#6a5a48', [7, 2]), { color: '#7a6a5a' }), 0, 52, -103);
  const sign = add(g, plane(188, 38), flat(wordSign("RAY'S SLICE OF HEAVEN", '#ff5a2a'), { transparent: true }), 0, 142, -102);
  H.sign = sign.material;
  const spill = glowPlane(300, 130, '#ff6a2a', 0.2); spill.position.set(0, 128, -101); g.add(spill);
  // menu boards
  for (const [x, a, b] of [[-72, 'SLICE  $1.25', 'KNOTS  $0.99'], [72, 'WHOLE PIE $8', 'EXTRA GARLIC']]) add(g, plane(52, 30), flat(labelTex([a, b], { bg: '#18100c', fg: '#ffd890', px: 28 }), { color: '#b0a090' }), x, 98, -102);
  // the pizza oven: a brick arch full of fire
  add(g, box(74, 62, 16), lam('#6a3424'), 26, 31, -96);
  H.ovenMouth = add(g, new THREE.CircleGeometry(23, 24, 0, Math.PI), lit('#ff7a18', 1.7), 26, 22, -87.6);
  add(g, box(46, 4, 2), lit('#ffb040', 1.5), 26, 22, -87.4);
  H.ovenGlow = glowPlane(170, 120, '#ff8a20', 0.32); H.ovenGlow.position.set(26, 40, -86); g.add(H.ovenGlow);
  // stacked pizza boxes and a flour sack
  const card = lam('#b89870');
  for (let i = 0; i < 7; i++) add(g, box(26, 3.4, 26), card, -74 + hash(i) * 5, 2 + i * 3.6, -74, hash(i + 4) * 0.4);
  add(g, new THREE.SphereGeometry(13, 12, 8), lam('#d8d0b8'), 82, 11, -72).scale.y = 0.85;

  // ----- the counter: red-and-white front, a steel top, a glass case
  const counter = new THREE.Group(); g.add(counter); H.counter = counter;
  for (const x of [-60, 60]) {
    add(counter, box(60, 30, 18), flat(stripes('#7a1c18', '#c8bca8', 6), { color: '#9a8a84' }), x, 15, 0);
    add(counter, box(64, 3.4, 24), std('#b8bcc8', { metalness: 0.75, roughness: 0.25 }), x, 31.6, 0);
  }
  const low = add(counter, box(60, 20, 14), flat(stripes('#7a1c18', '#c8bca8', 6), { color: '#8a7a74' }), 0, 10, 0);
  H.counterMid = low;
  add(counter, box(26, 12, 14), std('#9ab8d0', { transparent: true, opacity: 0.25, roughness: 0.05 }), 74, 39, 0);
  for (let i = 0; i < 3; i++) add(counter, new THREE.CylinderGeometry(7, 7, 1.4, 18), lam('#e0a040'), 68 + i * 6, 35.5 + i * 3, 0);

  // ----- the ticket spike with the tell-tale order on it
  const [tx, ty, tz] = TICKET_AT;
  add(g, cyl(4.5, 5.5, 2, 16), std('#20202a'), tx, 34.4, tz);
  add(g, cyl(0.35, 0.35, 28, 6), std('#d8dce8', { metalness: 0.9, roughness: 0.2 }), tx, 49, tz - 0.8);
  const ticket = new THREE.Group(); ticket.position.set(tx, ty, tz); g.add(ticket); H.ticket = ticket;
  const tkt = canvasTex(384, 448, (c, w, h) => {
    c.fillStyle = '#efe9d4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c0b8a0'; for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 12, 12); c.lineTo(x + 24, 0); c.fill(); }
    c.textAlign = 'center'; c.fillStyle = '#7a2418'; c.font = 'bold 30px "Courier New", monospace'; c.fillText("RAY'S SLICE", w / 2, 56);
    c.strokeStyle = '#8a8068'; c.setLineDash([8, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(24, 76); c.lineTo(w - 24, 76); c.stroke();
    c.fillStyle = '#141c4a';
    const row = (s, y, px, col = '#141c4a') => { c.fillStyle = col; c.font = `bold ${px}px "Comic Sans MS", "Courier New", monospace`; const tw = c.measureText(s).width; if (tw > w - 36) c.font = `bold ${Math.floor(px * (w - 36) / tw)}px "Courier New", monospace`; c.fillText(s, w / 2, y); };
    row('BUG CREW -', 142, 68);
    row('2 SLICES -', 220, 56);
    row('11:30', 322, 112, '#a01018');
    row('ROOF ACCESS', 392, 46, '#4a4438');
  });
  const sheet = add(ticket, plane(18, 21), flat(tkt, { color: '#d8d2c4', side: THREE.DoubleSide }), 0, 0, 0);
  sheet.rotation.set(-0.06, 0, 0.035);
  for (let i = 0; i < 3; i++) add(ticket, plane(15, 17), lam('#c8c0a8', { side: THREE.DoubleSide }), -0.8 + i, -2.6, -0.5 - i * 0.4).rotation.z = (i - 1) * 0.12;

  // ----- the rolling shutter, half way down
  const shutter = new THREE.Group(); g.add(shutter); H.shutter = shutter;
  const slat = std('#6a6676', { map: canvasTex(64, 64, (c) => { c.fillStyle = '#8a8698'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) { c.fillStyle = '#3a3646'; c.fillRect(0, y, 64, 3); } }, [3, 2]), metalness: 0.55, roughness: 0.45 });
  add(shutter, box(190, 52, 3), slat, 0, 92, -14);
  add(shutter, box(194, 4, 6), std('#2a2832'), 0, 66, -14);
  for (const x of [-96, 96]) add(g, box(7, 122, 12), std('#1c1a24'), x, 61, -14);
  add(g, box(206, 14, 20), std('#241c2a'), 0, 124, -14);
  H.setShutter = (drop) => { shutter.position.y = 4 - drop * 30; };   // 0 = half down, 1 = nearly shut

  // ----- the collapsing hood: a steel slab and shelving that comes down on Ray
  const hood = new THREE.Group(); hood.position.set(-32, 46, -42); g.add(hood); H.hood = hood;
  const steel = std('#8a8e9e', { metalness: 0.75, roughness: 0.35 });
  add(hood, box(70, 7, 40), steel, 30, 0, 0);
  add(hood, box(4, 26, 38), steel, 62, 10, 0);
  for (let i = 0; i < 5; i++) add(hood, cyl(5 + hash(i) * 3, 5, 9, 10), lam(i % 2 ? '#a83a2a' : '#c8c0b0'), 8 + i * 12, 8, (hash(i + 3) - 0.5) * 22).rotation.z = hash(i + 9) - 0.5;
  const debris = new THREE.Group(); g.add(debris); H.debris = debris;
  for (let i = 0; i < 16; i++) { const m = add(debris, box(4 + hash(i) * 12, 2 + hash(i + 1) * 5, 3 + hash(i + 2) * 10), i % 3 ? card : steel, -34 + hash(i + 3) * 80, 2, -24 - hash(i + 5) * 34, hash(i + 8) * 3); m.rotation.z = hash(i + 11) - 0.5; }

  // ----- the Security Locker, off to the right
  const L = new THREE.Group(); L.position.set(168, 0, -52); L.rotation.y = -0.22; g.add(L); H.locker = L;
  const shell = std('#4a4e5c', { metalness: 0.65, roughness: 0.45 });
  add(L, box(70, 112, 4), shell, 0, 56, -15);
  for (const x of [-33, 33]) add(L, box(4, 112, 30), shell, x, 56, 0);
  add(L, box(70, 6, 30), shell, 0, 112, 0); add(L, box(70, 5, 30), shell, 0, 2.5, 0);
  H.lockerGlow = glowPlane(70, 100, '#ffe090', 0); H.lockerGlow.position.set(0, 56, -10); L.add(H.lockerGlow);
  const gun = std('#14161c', { metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 4; i++) { const x = -22 + i * 15; add(L, box(4, 62, 4), gun, x, 50, -8).rotation.z = 0.08; add(L, box(7, 18, 5), lam('#5a3a22'), x - 2.4, 26, -8); }
  for (let i = 0; i < 3; i++) add(L, box(18, 10, 12), lam('#4a5a2a'), -20 + i * 21, 92, -4);
  const door = new THREE.Group(); door.position.set(-31, 0, 16); L.add(door); H.lockerDoor = door;
  add(door, box(62, 104, 3.4), shell, 31, 56, 0);
  add(door, plane(56, 10), flat(hazard(), { color: '#c8c0b0' }), 31, 18, 2);
  add(door, plane(56, 10), flat(hazard(), { color: '#c8c0b0' }), 31, 100, 2);
  add(door, plane(52, 17), flat(labelTex(['SECURITY LOCKER'], { w: 384, h: 128, bg: '#d8d0b0', px: 46, border: '#201408' }), { color: '#d0c8b8' }), 31, 82, 2);
  H.count = document.createElement('canvas'); H.count.width = 256; H.count.height = 112;
  H.countTex = new THREE.CanvasTexture(H.count); H.countTex.colorSpace = THREE.SRGBColorSpace;
  add(door, plane(40, 17.5), flat(H.countTex), 31, 56, 2.2);
  H.lastCount = -1;
  H.drawCount = (n, blink) => {
    const key = n * 2 + (blink ? 1 : 0);
    if (key === H.lastCount) return;
    H.lastCount = key;
    const c = H.count.getContext('2d');
    c.fillStyle = '#120402'; c.fillRect(0, 0, 256, 112);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffb020'; c.font = 'bold 26px monospace'; c.fillText('FIRE SEAL IN', 128, 24);
    c.fillStyle = blink ? '#ff3a1a' : '#a01808'; c.font = 'bold 64px monospace'; c.fillText(`0:${String(Math.max(0, n)).padStart(2, '0')}`, 128, 74);
    H.countTex.needsUpdate = true;
  };
  H.drawCount(10, true);
  H.beacon = add(L, new THREE.SphereGeometry(5.5, 14, 10), lit('#ffc020', 1.6), 0, 121, 4);
  H.beaconGlow = glowPlane(52, 52, '#ffb020', 0.5); H.beaconGlow.position.set(0, 121, 10); L.add(H.beaconGlow);

  // ----- the back door the dead come through, off to the left
  add(g, plane(64, 106), lit('#3a0406', 1), -176, 53, -103);
  const dg = glowPlane(150, 170, '#ff2018', 0.35); dg.position.set(-176, 56, -102); g.add(dg);
  for (const x of [-210, -142]) add(g, box(8, 112, 10), lam('#120c14'), x, 56, -102);
  add(g, box(76, 8, 10), lam('#120c14'), -176, 112, -102);
  H.backDoor = [PIZZA_X - 176, -96];

  // a couple of tipped tables and stools well in front, for depth
  const top = lam('#a83028'), leg = std('#9a9aa8', { metalness: 0.8 });
  for (const [x, z, tip] of [[-196, 96, 0], [214, 70, 1.35], ...(high ? [[-250, -10, 0]] : [])]) {
    const t = new THREE.Group(); t.position.set(x, tip ? 20 : 0, z); t.rotation.z = tip; g.add(t);
    add(t, cyl(22, 22, 3, 22), top, 0, 30, 0); add(t, cyl(2, 2, 30, 8), leg, 0, 15, 0); add(t, cyl(10, 10, 2, 14), leg, 0, 1, 0);
  }

  H.update = (dt, t) => {
    const f = flicker(t, 5, true);
    H.sign.color.setScalar(0.75 + 0.45 * f);
    H.ovenGlow.material.opacity = 0.28 + Math.sin(t * 11) * 0.04 + Math.sin(t * 23) * 0.03;
    const on = Math.sin(t * 9) > 0;
    H.beacon.material.color.set('#ffc020').multiplyScalar(on ? 1.9 : 0.35);
    H.beaconGlow.material.opacity = on ? 0.55 : 0.06;
  };
  return { group: g, h: H };
}

// ===================================================================== Toller's Carvery kitchen
export const KITCHEN_X = 9000;
export const FRYER_XS = [-175, -125, -75, -25, 25, 75, 125, 175];
export const GAUGE_AT = [212, 78, -142];

function drumTex() {
  return canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#d8dcd8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a5a4a'; c.fillRect(0, 18, w, 14); c.fillRect(0, h - 32, w, 14);
    for (const cx of [w * 0.25, w * 0.75]) {
      // the agency's stencil: a mosquito in a struck-out ring
      c.strokeStyle = '#1c2a24'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx, 72); c.lineTo(cx, 112); c.moveTo(cx, 86); c.lineTo(cx - 24, 68); c.moveTo(cx, 86); c.lineTo(cx + 24, 68); c.moveTo(cx, 96); c.lineTo(cx - 24, 112); c.moveTo(cx, 96); c.lineTo(cx + 24, 112); c.stroke();
      c.strokeStyle = '#b0101c'; c.lineWidth = 7;
      c.beginPath(); c.arc(cx, 92, 40, 0, Math.PI * 2); c.moveTo(cx - 28, 64); c.lineTo(cx + 28, 120); c.stroke();
      c.fillStyle = '#17241c'; c.textAlign = 'center'; c.font = 'bold 21px sans-serif';
      c.fillText('KERN VALLEY', cx, 170); c.fillText('VECTOR CONTROL', cx, 204);
    }
  });
}

export function buildKitchen({ high }) {
  const g = new THREE.Group(), H = { oil: [], lamps: [] };
  g.position.set(KITCHEN_X, 0, 0);
  add(g, plane(900, 760).rotateX(-Math.PI / 2), std('#ffffff', { map: tiles('#3a342e', '#554c40', '#141008', [18, 15]), roughness: 0.22, metalness: 0.25 }), 0, 0, 80);
  const wall = std('#ffffff', { map: tiles('#6a665a', '#74705f', '#2a2820', [16, 6]), roughness: 0.55, metalness: 0.05 });
  add(g, plane(640, 230), wall, 0, 115, -160);
  for (const s of [-1, 1]) add(g, plane(620, 230), wall, s * 320, 115, 150, -s * Math.PI / 2);
  // ----- the fryer line: eight fryers, oil glowing, Fryer Eight with its own plate
  const steel = std('#7a7e8c', { metalness: 0.8, roughness: 0.34 }), dark = std('#1a1a20', { metalness: 0.6 });
  FRYER_XS.forEach((x, i) => {
    add(g, box(46, 42, 34), steel, x, 21, -128);
    add(g, box(46, 20, 4), steel, x, 52, -143);
    const oil = add(g, plane(38, 24).rotateX(-Math.PI / 2), lit('#ff8a14', 1.5), x, 42.6, -128);
    const halo = glowPlane(56, 40, '#ff7a14', 0.3); halo.position.set(x, 52, -124); g.add(halo);
    H.oil.push({ mat: oil.material, halo: halo.material, seed: i * 7 });
    add(g, box(30, 3, 3), lit('#ff5a10', 0.9), x, 14, -110.6);
    add(g, cyl(0.7, 0.7, 24, 6), dark, x - 6 + (i % 2) * 12, 54, -118).rotation.x = 1.1;
    add(g, plane(14, 8), flat(labelTex([`FRYER ${i + 1}`], { w: 128, h: 64, bg: '#101014', fg: '#ffb040', px: 24 })), x, 26, -110.4);
  });
  // exhaust hood over the fryers
  add(g, box(420, 22, 62), steel, 0, 168, -128);
  const carvery = add(g, plane(190, 34), flat(wordSign("TOLLER'S CARVERY", '#ff4a7a'), { transparent: true }), 0, 140, -96);
  H.sign = carvery.material;
  add(g, plane(120, 22), flat(labelTex(['MIDNIGHT MADNESS'], { w: 384, h: 72, bg: '#e8dcb8', fg: '#a0141c', px: 42, border: '#a0141c' }), { color: '#c0b498' }), 128, 112, -158);
  // ----- hanging meat hooks on a rail, some with sides of ham
  add(g, box(430, 4, 4), dark, 0, 178, -70);
  H.hooks = [];
  const hookM = std('#9a9ea8', { metalness: 0.9, roughness: 0.25 }), ham = lam('#8a3438'), fat = lam('#d8b0a0');
  for (let i = 0; i < 9; i++) {
    const x = -196 + i * 49, hk = new THREE.Group(); hk.position.set(x, 176, -70); g.add(hk);
    const len = 22 + hash(i + 2) * 18;
    add(hk, cyl(0.6, 0.6, len, 5), hookM, 0, -len / 2, 0);
    const curve = add(hk, new THREE.TorusGeometry(4, 0.8, 6, 12, Math.PI * 1.4), hookM, 0, -len - 3.6, 0); curve.rotation.z = Math.PI * 0.85;
    if (i % 3 !== 1 && Math.abs(x) > 40) { const m = add(hk, new THREE.SphereGeometry(8, 12, 10), ham, 2, -len - 20, 0); m.scale.set(1, 1.8, 0.8); add(hk, cyl(2, 3.4, 7, 8), fat, 2, -len - 7, 0); }
    H.hooks.push({ g: hk, seed: i });
  }
  // ----- the walk-in freezer door on the left, frost light round its edge
  add(g, box(10, 128, 80), steel, -314, 64, -20);
  add(g, plane(66, 112), std('#aab4c4', { metalness: 0.7, roughness: 0.28 }), -308.5, 58, -20, Math.PI / 2);
  add(g, box(3, 4, 22), dark, -307, 58, -2);
  const frost = glowPlane(110, 150, '#9ad8ff', 0.22); frost.position.set(-306, 62, -20); frost.rotation.y = Math.PI / 2; g.add(frost);
  add(g, plane(46, 12), flat(labelTex(['WALK-IN FREEZER'], { w: 256, h: 64, bg: '#18202c', fg: '#bfe4ff', px: 28 })), -307.5, 126, -20, Math.PI / 2);
  // ----- the empty Vector Control canisters, stacked beside the line
  const dt = drumTex(), lid = std('#5a625e', { metalness: 0.7, roughness: 0.35 });
  const side = std('#ffffff', { map: dt, metalness: 0.35, roughness: 0.42 });
  for (const [x, y, z, ry] of [[-236, 0, -66, 0.1], [-190, 0, -84, -0.3], [-246, 0, -112, 0.5], [-215, 47, -90, 0.05]]) {
    const d = add(g, cyl(21, 21, 46, 22), [side, lid, lid], x, y + 23, z, -Math.PI / 2 + ry + 0.5);
    for (const ly of [-19, 19]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(21.2, 1, 6, 24), lid); rim.rotation.x = Math.PI / 2; rim.position.y = ly; d.add(rim); }
  }
  // ----- the prep line: steel islands with boards, trays and cleaver marks, running from the freezer toward the line
  for (const x of [-232, -168, 168, 232]) {
    add(g, box(60, 5, 30), steel, x, 29, 30);
    for (const lx of [-26, 26]) add(g, box(4, 28, 4), dark, x + lx, 14, 30);
    add(g, box(26, 2.4, 18), lam('#8a6034'), x - 8, 32.8, 30, hash(x) - 0.5);
    for (let i = 0; i < 4; i++) { const m = add(g, new THREE.SphereGeometry(4.4, 8, 6), i % 2 ? ham : fat, x - 16 + i * 9, 33.4, 28 + hash(i + x) * 6, hash(i) * 3); m.scale.set(1.3, 0.38, 0.8); }
  }
  // the chopping block in the middle of the floor
  const block = new THREE.Group(); g.add(block); H.block = block;
  add(block, box(54, 40, 32), lam('#6a4628'), 0, 20, 0);
  add(block, box(58, 6, 36), lam('#9a7044'), 0, 43, 0);
  add(block, box(26, 2, 15), lam('#7a1a14'), 4, 46.4, 2);
  // ----- heat lamps over the pass
  for (const x of [-150, -50, 50, 150]) {
    add(g, cyl(0.7, 0.7, 62, 5), dark, x, 188, -18);
    add(g, new THREE.ConeGeometry(13, 14, 18, 1, true), std('#b8501c', { metalness: 0.7, side: THREE.DoubleSide }), x, 152, -18);
    const bulb = add(g, new THREE.SphereGeometry(4, 12, 8), lit('#ffb040', 2), x, 148, -18);
    H.lamps.push({ mat: bulb.material, seed: x });
  }
  // ----- the main air intake: a fat pipe and a gauge whose needle keeps climbing
  add(g, cyl(9, 9, 190, 14), std('#5a4a2a', { metalness: 0.75, roughness: 0.4 }), GAUGE_AT[0] + 36, 95, -150);
  add(g, box(40, 6, 6), std('#5a4a2a', { metalness: 0.75 }), GAUGE_AT[0] + 18, GAUGE_AT[1] - 8, -152);
  H.gaugeCanvas = document.createElement('canvas'); H.gaugeCanvas.width = H.gaugeCanvas.height = 512;
  H.gaugeTex = new THREE.CanvasTexture(H.gaugeCanvas); H.gaugeTex.colorSpace = THREE.SRGBColorSpace;
  add(g, cyl(26, 26, 8, 32).rotateX(Math.PI / 2), std('#3a3428', { metalness: 0.85, roughness: 0.3 }), GAUGE_AT[0], GAUGE_AT[1], -150);
  H.gaugeFace = add(g, new THREE.CircleGeometry(23, 40), flat(H.gaugeTex, { color: '#c8ffd0' }), GAUGE_AT[0], GAUGE_AT[1], -145.6);
  H.gaugeGlow = glowPlane(86, 86, '#30ff80', 0.1); H.gaugeGlow.position.set(GAUGE_AT[0], GAUGE_AT[1], -144); g.add(H.gaugeGlow);
  H.lastNeedle = -1;
  H.drawGauge = (v) => {
    const q = Math.round(v * 240);
    if (q === H.lastNeedle) return;
    H.lastNeedle = q;
    const c = H.gaugeCanvas.getContext('2d');
    c.fillStyle = '#0e1c10'; c.fillRect(0, 0, 512, 512);
    c.lineWidth = 34; c.strokeStyle = '#2a6a3a'; c.beginPath(); c.arc(256, 256, 190, Math.PI * 0.75, Math.PI * 2.05); c.stroke();
    c.strokeStyle = '#d02a18'; c.beginPath(); c.arc(256, 256, 190, Math.PI * 2.05, Math.PI * 2.25); c.stroke();
    c.strokeStyle = '#c8f8d0'; c.lineWidth = 6;
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.75 + i * 0.125); c.beginPath(); c.moveTo(256 + Math.cos(a) * 156, 256 + Math.sin(a) * 156); c.lineTo(256 + Math.cos(a) * 214, 256 + Math.sin(a) * 214); c.stroke(); }
    c.fillStyle = '#d8ffe0'; c.textAlign = 'center'; c.font = 'bold 50px sans-serif'; c.fillText('AIR INTAKE', 256, 366);
    c.font = 'bold 30px sans-serif'; c.fillText('WALK-IN FEED PSI', 256, 410);
    const a = Math.PI * (0.75 + 1.5 * Math.max(0, Math.min(1, v)));
    c.strokeStyle = '#ff7a30'; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(256, 256); c.lineTo(256 + Math.cos(a) * 176, 256 + Math.sin(a) * 176); c.stroke();
    c.fillStyle = '#d8d0b0'; c.beginPath(); c.arc(256, 256, 22, 0, Math.PI * 2); c.fill();
    H.gaugeTex.needsUpdate = true;
  };
  H.drawGauge(0.4);
  H.steam = new SteamPuffs(g, FRYER_XS.map((x) => [x, 48, -124]), { n: high ? 46 : 16, color: '#ffc890', opacity: 0.13, rise: 28, size: 30 });
  H.floorSteam = new SteamPuffs(g, [[-130, 2, -20], [130, 2, -30], [-60, 2, -70], [70, 2, -66]], { n: high ? 22 : 8, color: '#d8a888', opacity: 0.09, rise: 11, size: 46, life: 4.4 });
  H.power = 1;   // the fryers: 1 = roaring, 0 = dead
  H.update = (dt, t) => {
    H.oil.forEach((o, i) => {
      const alive = H.power >= 1 ? 1 : Math.max(0.04, Math.min(1, (H.power * 9 - i)));   // they die one by one
      o.mat.color.set('#ff8a14').multiplyScalar((1.3 + Math.sin(t * 13 + o.seed) * 0.3) * alive);
      o.halo.opacity = (0.28 + Math.sin(t * 7 + o.seed) * 0.06) * alive;
    });
    for (const l of H.lamps) l.mat.color.set('#ffb040').multiplyScalar((1.2 + 0.8 * flicker(t, l.seed, false)) * Math.max(0.05, H.power));
    H.sign.color.setScalar((0.55 + 0.55 * flicker(t, 17, true)) * (0.25 + 0.75 * H.power));
    for (const k of H.hooks) k.g.rotation.z = Math.sin(t * 1.1 + k.seed * 2) * 0.045;
    H.steam.gain = 0.25 + 0.75 * H.power;
    H.steam.update(dt, t);
    H.floorSteam.update(dt, t);
  };
  return { group: g, h: H };
}
