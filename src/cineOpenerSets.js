// Sets for the White Acre opener (intro.js), all drawn in code: the oil field, Highway 99, the lot, Dock B and the cleanup
// convoy (one exterior), the one-hour Photo Hut, the crowd, the Midnight Madness dressing and the monitor pictures.
// Same contract as cineSets.js: a builder returns { group, h } and h.update(dt, t) runs the always-on animation.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { neonSignTexture } from './mall3d.js';
import { glowTexture } from './models.js';
import { canvasTex, makeShaft } from './cineFx.js';
import { clamp01, hash, smooth } from './cineCore.js';
import { drumTex } from './cineStorySets.js';

export const EXT_X = -9000;     // the exterior is built far off to the other side of the concourse from the office
export const KIOSK_X = 6400;
export const DOCK = [EXT_X + 1600, 0, 0];

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const lit = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const far = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false, fog: false });
const flat = (map, o = {}) => new THREE.MeshBasicMaterial({ map, toneMapped: false, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
const cyl = (a, b, h, n = 12) => new THREE.CylinderGeometry(a, b, h, n);
function add(g, geo, mat, x = 0, y = 0, z = 0, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; }
function glow(color, size, opacity = 0.6, fog = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog }));
  s.scale.setScalar(size);
  return s;
}
const addGlow = (g, color, size, opacity, x, y, z, fog) => { const s = glow(color, size, opacity, fog); s.position.set(x, y, z); g.add(s); return s; };

/** Centred text on a board, shrunk to fit the width. */
export function textTex(lines, { w = 512, h = 128, bg = '#e8dcb8', fg = '#a0141c', px = 56, border = null, font = 'sans-serif' } = {}) {
  return canvasTex(w, h, (c) => {
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
    if (border) { c.strokeStyle = border; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12); }
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => {
      c.font = `bold ${px}px ${font}`;
      const tw = c.measureText(l).width;
      if (tw > w - 32) c.font = `bold ${Math.floor(px * (w - 32) / tw)}px ${font}`;
      c.fillText(l, w / 2, h * (i + 0.5) / lines.length + 2);
    });
  });
}

// ===================================================================== the crowd
/**
 * A crowd of simple shoppers in four instanced meshes (legs, torsos, heads, raised arms). spots: [[x, z, yaw], ...].
 * cheer(k) lifts arms; fold(t, ox, oz, speed) drops everyone in a wave spreading from (ox, oz), t seconds after it starts
 * (t < 0 = still standing). update() rewrites the matrices.
 */
export class CrowdField {
  constructor(parent, spots) {
    this.spots = spots.map(([x, z, yaw = 0], i) => ({ x, z, yaw, s: 0.86 + hash(i + 3) * 0.26, ph: hash(i + 7) * 6.28, dir: hash(i + 11) * 6.28, jit: hash(i + 17) * 0.45 }));
    const n = this.spots.length;
    const legs = mergeGeometries([box(5, 20, 6).translate(-3.6, 10, 0), box(5, 20, 6).translate(3.6, 10, 0)]);
    const torso = new THREE.CapsuleGeometry(7.4, 14, 3, 8).scale(1, 1, 0.75).translate(0, 31, 0);
    const head = new THREE.SphereGeometry(5.6, 10, 8).translate(0, 49, 0);
    const arms = mergeGeometries([box(3.4, 19, 3.4).rotateZ(0.3).translate(-11, 49, 0), box(3.4, 19, 3.4).rotateZ(-0.3).translate(11, 49, 0)]);
    const mk = (geo) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n); m.frustumCulled = false; parent.add(m); return m; };
    this.meshes = [mk(legs), mk(torso), mk(head), mk(arms)];
    // 1994 Central Valley: flannel, team jackets, sweatshirts and denim
    const jackets = ['#8a2f2a', '#2f4a7a', '#3a5a44', '#6a6f7c', '#22252c', '#a8723a', '#5a3a68', '#b8b0a0', '#2c6a72', '#7a1f38'];
    const denim = ['#26344e', '#1c2436', '#3a3a40', '#4a4234'];
    const skin = ['#e0b090', '#b88060', '#8a5a40', '#f0c8a8', '#a06c4c'];
    const c = new THREE.Color();
    this.spots.forEach((p, i) => {
      const pick = (list, k) => c.set(list[Math.floor(hash(i + k) * list.length) % list.length]);
      const j = pick(jackets, 23).clone();
      this.meshes[0].setColorAt(i, pick(denim, 29));
      this.meshes[1].setColorAt(i, j);
      this.meshes[2].setColorAt(i, pick(skin, 31));
      this.meshes[3].setColorAt(i, j);
    });
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion();
    this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.axis = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
    this.cheerK = 0; this.fallT = -1; this.fallFrom = [0, 0]; this.fallSpeed = 520;
    this.update(0);
  }

  cheer(k) { this.cheerK = k; return this; }
  fold(t, ox = 0, oz = 0, speed = 520) { this.fallT = t; this.fallFrom[0] = ox; this.fallFrom[1] = oz; this.fallSpeed = speed; return this; }

  update(t) {
    const { m, q, q2, v, sc, axis } = this;
    this.spots.forEach((p, i) => {
      let fall = 0;
      if (this.fallT >= 0) {
        const wait = Math.hypot(p.x - this.fallFrom[0], p.z - this.fallFrom[1]) / this.fallSpeed + p.jit;
        const u = clamp01((this.fallT - wait) / 0.85);
        fall = u * u;
      }
      q.setFromAxisAngle(this.up, p.yaw);
      if (fall > 0) { axis.set(Math.cos(p.dir), 0, Math.sin(p.dir)); q2.setFromAxisAngle(axis, fall * 1.52); q.premultiply(q2); }
      const bob = fall > 0 ? 0 : Math.abs(Math.sin(t * (2 + this.cheerK * 5) + p.ph)) * (0.7 + this.cheerK * 3.2);
      v.set(p.x, bob + fall * 5.5, p.z);
      m.compose(v, q, sc.setScalar(p.s));
      for (let k = 0; k < 3; k++) this.meshes[k].setMatrixAt(i, m);
      const up = fall > 0 ? 0 : clamp01(this.cheerK * 1.6 - p.jit * 1.4);
      if (up < 0.05) m.makeScale(0, 0, 0); // (arms down: hidden inside the jacket)
      else { m.compose(v.set(p.x, bob - (1 - up) * 10 * p.s, p.z), q, sc.setScalar(p.s)); }
      this.meshes[3].setMatrixAt(i, m);
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Standing spots in a rectangle, jittered, keeping clear of the circles in `holes` [[x, z, r], ...]. */
export function crowdSpots(n, x0, x1, z0, z1, holes = [], seed = 0, yaw = null) {
  const out = [];
  for (let i = 0; out.length < n && i < n * 8; i++) {
    const x = x0 + hash(i * 3.1 + seed) * (x1 - x0), z = z0 + hash(i * 7.7 + seed + 41) * (z1 - z0);
    if (holes.some(([hx, hz, r]) => (x - hx) ** 2 + (z - hz) ** 2 < r * r)) continue;
    if (out.some(([ox, oz]) => (x - ox) ** 2 + (z - oz) ** 2 < 150)) continue;
    out.push([x, z, yaw ?? hash(i + seed + 9) * 6.28]);
  }
  return out;
}

// ===================================================================== Midnight Madness, hung in the concourse
export function dressConcourse(con) {
  const g = new THREE.Group(), H = {};
  // nothing is wrong yet: no rain on the skylight or outside, no dead on the glass, no broken escalator
  con.group.traverse((o) => { if (o.isMesh && o.material.map === con.h.rainTex) o.visible = false; });
  con.h.outRainMesh.visible = false;
  for (const m of con.h.crowdSil) m.visible = false;
  con.h.cracks.visible = false;
  con.h.escalator.visible = false;

  const banner = textTex(['MIDNIGHT MADNESS', 'DOORBUSTERS AT 12:01'], { w: 768, h: 192, bg: '#a81428', fg: '#fff0c8', px: 68, border: '#ffd040' });
  H.banners = [640, 380, -60, -520].map((z, i) => {
    const hang = new THREE.Group(); hang.position.set(0, 186, z); g.add(hang);
    add(hang, plane(150, 37), flat(banner, { side: THREE.DoubleSide, color: '#cfc8c0' }), 0, -28, 0);
    for (const x of [-68, 68]) add(hang, box(0.8, 10, 0.8), lam('#100c18'), x, -5, 0);
    hang.userData.ph = i * 1.7;
    return hang;
  });

  // the red LED doorbuster clock
  H.canvas = document.createElement('canvas'); H.canvas.width = 384; H.canvas.height = 160;
  H.tex = new THREE.CanvasTexture(H.canvas); H.tex.colorSpace = THREE.SRGBColorSpace;
  add(g, box(104, 48, 8), lam('#0c0a12'), 0, 126, 60);
  add(g, plane(96, 40), flat(H.tex), 0, 126, 64.4);
  add(g, box(1.4, 40, 1.4), lam('#0c0a12'), -40, 170, 60); add(g, box(1.4, 40, 1.4), lam('#0c0a12'), 40, 170, 60);
  let shown = '';
  H.setClock = (text, bright = 1) => {
    const key = `${text}|${bright > 0.5}`;
    if (key === shown) return;
    shown = key;
    const c = H.canvas.getContext('2d');
    c.fillStyle = '#140204'; c.fillRect(0, 0, 384, 160);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#c87060'; c.font = 'bold 26px sans-serif'; c.fillText('DOORBUSTERS IN', 192, 30);
    c.fillStyle = bright > 0.5 ? '#ff3a20' : '#7a1408'; c.font = 'bold 96px monospace'; c.fillText(text, 192, 102);
    H.tex.needsUpdate = true;
  };
  H.setClock('3:00');

  // square ceiling diffusers down both sides, and the haze that breathes out of them
  const grille = canvasTex(64, 64, (c) => { c.fillStyle = '#8a8a96'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#26242e'; c.lineWidth = 3; for (let r = 4; r < 32; r += 7) c.strokeRect(r, r, 64 - r * 2, 64 - r * 2); });
  const vm = flat(grille, { color: '#9a96a8' });
  H.vents = []; H.puffs = [];
  for (let z = 680; z > -700; z -= 150) for (const x of [-112, 112]) {
    add(g, plane(34, 34).rotateX(Math.PI / 2), vm, x, 188.6, z);
    H.vents.push([x, z]);
    for (let i = 0; i < 3; i++) {
      const s = addGlow(g, '#b8d8c8', 40, 0, x, 180, z, true);
      s.userData = { x, z, ph: i / 3 + hash(x + z) * 0.3 };
      H.puffs.push(s);
    }
  }
  H.haze = 0; // 0 = nothing, 1 = full breath
  H.update = (dt, t) => {
    for (const s of H.puffs) {
      const u = (t * 0.28 + s.userData.ph) % 1;
      s.position.set(s.userData.x + Math.sin(t + s.userData.ph * 9) * 7 * u, 184 - u * 130 * H.haze, s.userData.z);
      s.scale.setScalar(24 + u * 110);
      s.material.opacity = H.haze * 0.3 * Math.sin(Math.PI * u);
    }
    for (const b of H.banners) b.rotation.x = Math.sin(t * 3.4 + b.userData.ph) * 0.16 * H.haze;
  };
  con.group.add(g);
  return { group: g, h: H };
}

// ===================================================================== the exterior: oil field, Highway 99, lot, Dock B
function pumpjack(g, x, z, s, ph) {
  const root = new THREE.Group(); root.position.set(x, 0, z); root.scale.setScalar(s); g.add(root);
  const iron = lam('#07080c');
  for (const sx of [-1, 1]) add(root, box(5, 76, 5), iron, sx * 14, 36, 0).rotation.z = sx * 0.36;
  const beam = new THREE.Group(); beam.position.y = 72; root.add(beam);
  add(beam, box(112, 8, 7), iron, 2, 0, 0);
  add(beam, box(14, 30, 8), iron, 60, -8, 0).rotation.z = 0.28;   // the horse head
  add(beam, box(1.4, 62, 1.4), iron, 66, -40, 0);                  // the rod
  add(beam, box(24, 20, 9), iron, -50, -4, 0);                     // the counterweight
  add(root, box(34, 18, 20), iron, -46, 9, 0);
  add(root, box(150, 4, 28), iron, 4, 2, 0);
  const lamp = addGlow(root, '#ffb050', 16, 0.7, -46, 24, 11);
  return { beam, ph, lamp };
}

function whiteTruck(beacon = true) {
  const t = new THREE.Group();
  const paint = lam('#c8ccd0'), dark = lam('#0c0e12'), glass = lam('#1a2430');
  add(t, box(76, 46, 40), paint, -16, 38, 0);
  add(t, box(32, 34, 38), paint, 40, 32, 0);
  add(t, box(2, 14, 32), glass, 56.4, 40, 0);
  add(t, box(20, 12, 39), glass, 43, 41, 0);
  add(t, box(112, 6, 36), dark, 1, 13, 0);
  for (const x of [-38, -10, 38]) for (const z of [-19, 19]) add(t, cyl(9, 9, 7, 14).rotateX(Math.PI / 2), dark, x, 9, z);
  for (const z of [-13, 13]) { add(t, box(2, 5, 7), lit('#fff0c8', 1.6), 56.6, 22, z); add(t, box(2, 5, 5), lit('#ff2018', 1.2), -54.6, 22, z); }
  if (beacon) {
    t.userData.beacon = add(t, box(9, 5, 14), lit('#ffa018', 2), 40, 52, 0);
    t.userData.halo = addGlow(t, '#ffa018', 70, 0.5, 40, 56, 0);
  }
  return t;
}

export function buildExterior({ high }) {
  const g = new THREE.Group(), H = { jacks: [], cars: [], trucks: [] };
  g.position.set(EXT_X, 0, 0);

  // the sky: a sodium haze on the horizon under a cold dark
  const sky = canvasTex(8, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#03060f'); gr.addColorStop(0.58, '#0a1424'); gr.addColorStop(0.82, '#33271c'); gr.addColorStop(0.9, '#4a321c'); gr.addColorStop(1, '#0a0806');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  add(g, new THREE.CylinderGeometry(2300, 2300, 1100, 40, 1, true), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, toneMapped: false, fog: false }), 400, 330, -200);
  add(g, plane(6000, 4200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#17140f', roughness: 0.95 }), 400, -0.5, -400);
  // furrows
  for (let i = 0; i < 26; i++) add(g, box(900, 0.6, 5), lam('#262015'), -700, 0.2, 640 - i * 26);

  // Highway 99: asphalt, dashes, and traffic that never looks over
  add(g, plane(4400, 130).rotateX(-Math.PI / 2), lam('#101218'), 400, 0.8, 130);
  for (let x = -1600; x < 2400; x += 64) add(g, plane(30, 3).rotateX(-Math.PI / 2), far('#6a6450'), x, 1.4, 130);
  for (let i = 0; i < 8; i++) {
    const car = new THREE.Group(); g.add(car);
    const east = i % 2 === 0, col = east ? '#ffe8c0' : '#ff3020';
    for (const z of [-5, 5]) addGlow(car, col, east ? 30 : 18, 0.85, 0, 12, z);
    add(car, box(i % 3 ? 30 : 74, i % 3 ? 11 : 28, 16), lam('#080a10'), east ? -22 : 22, i % 3 ? 9 : 18, 0);
    H.cars.push({ g: car, z: east ? 162 : 98, v: east ? 190 + hash(i) * 70 : -(170 + hash(i + 3) * 80), x0: hash(i + 9) * 2400 });
  }

  // pumpjacks nodding in the fields, behind and beside the mall
  [[-640, -80, 1.25], [-470, 420, 1.0], [-820, 340, 0.9], [-760, -520, 1.4], [720, -420, 1.2], [900, -80, 0.95], [-250, 520, 0.75], [1330, -420, 0.9], [1900, -480, 1.1], [2120, -360, 0.8], [1700, -640, 1.3]]
    .forEach(([x, z, s], i) => H.jacks.push(pumpjack(g, x, z, s, i * 1.9)));
  // a gas flare on its stack
  add(g, cyl(4, 6, 220, 8), lam('#0a0a10'), -900, 110, -420);
  H.flare = [['#ff6a10', 150], ['#ffb040', 82], ['#ffe8a0', 34]].map(([c, s]) => { const f = addGlow(g, c, s, 0.85, -900, 240, -420); f.userData.s = s; return f; });

  // the mall: a long low box, lit glass doors, its sign and two banners
  const stucco = lam('#5a4a44');
  add(g, box(680, 124, 160), stucco, 0, 62, -520);
  add(g, box(700, 10, 176), lam('#2a2428'), 0, 129, -520);
  add(g, box(190, 150, 24), lam('#6a564c'), 0, 75, -436);
  add(g, plane(150, 74), lit('#ffd8a0', 1.05), 0, 37, -423.6);
  for (let x = -75; x <= 75; x += 25) add(g, box(2.4, 76, 2), lam('#1a1418'), x, 38, -423);
  add(g, plane(168, 42), flat(neonSignTexture('PARAGON CROSSING', '#ff4ac0'), { transparent: true }), 0, 128, -423.4);
  addGlow(g, '#ffb870', 340, 0.34, 0, 50, -410);
  const mm = textTex(['MIDNIGHT MADNESS'], { w: 512, h: 96, bg: '#a81428', fg: '#fff0c8', px: 54 });
  for (const x of [-190, 190]) add(g, plane(140, 26), flat(mm, { color: '#c8c0b8' }), x, 88, -439);
  for (let i = 0; i < 16; i++) { const x = -320 + i * 43; if (Math.abs(x) > 100) add(g, plane(24, 3), far(i % 3 ? '#ff2ea6' : '#2ee6ff', 1.2), x, 112, -439.4); }
  // sodium lot lamps and parked cars
  for (const x of [-420, -250, 640]) {
    add(g, box(4, 130, 4), lam('#101014'), x, 65, -170);
    add(g, box(18, 5, 10), lit('#ffa040', 1.8), x, 131, -170);
    addGlow(g, '#ff9430', 120, 0.45, x, 128, -168);
  }
  const paint = ['#4a1c1c', '#1c2c48', '#484c52', '#2c3c2c', '#5a5648'];
  for (let i = 0; i < (high ? 34 : 20); i++) {
    const x = -450 + (i % 12) * 82 + hash(i) * 16, z = -120 - Math.floor(i / 12) * 62;
    if (Math.abs(x) < 120) continue;
    add(g, box(48, 13, 24), lam(paint[i % 5]), x, 13, z); add(g, box(26, 10, 22), lam('#141a22'), x - 3, 24, z);
  }
  // the queue at the doors
  H.queue = new CrowdField(g, crowdSpots(high ? 220 : 100, -150, 150, -405, -225, [], 5, Math.PI));

  // ----- the dark side of the building: the white utility truck, a roof ladder, and the canisters going up
  const truck = whiteTruck(false); truck.position.set(474, 0, -405); truck.rotation.y = Math.PI; g.add(truck);
  const steel = lam('#7a7e88');
  for (const x of [374, 398]) add(g, box(3, 142, 3), steel, x, 71, -434);
  for (let y = 8; y < 140; y += 11) add(g, box(24, 1.8, 2), steel, 386, y, -434);
  addGlow(g, '#8fb8ff', 80, 0.18, 420, 80, -420);
  const dt = drumTex(), lid = lam('#5a625e'), side = new THREE.MeshLambertMaterial({ map: dt });
  const canister = () => { const c = new THREE.Mesh(cyl(8, 8, 20, 18), [side, lid, lid]); c.rotation.y = -Math.PI / 2; g.add(c); return c; };
  for (let i = 0; i < 3; i++) canister().position.set(408 + i * 19, 10, -388 - (i % 2) * 8);
  H.lift = canister(); // the one being handed up
  H.ladderAt = [EXT_X + 386, 0, -418];

  // ----- the freeway exit: the convoy
  for (let i = 0; i < 4; i++) { const t = whiteTruck(true); t.visible = false; g.add(t); H.trucks.push(t); }
  H.tape = add(g, plane(1, 4), flat(canvasTex(128, 16, (c, w, h) => { c.fillStyle = '#e0b020'; c.fillRect(0, 0, w, h); c.fillStyle = '#14100a'; for (let x = -20; x < w; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 11, 0); c.lineTo(x + 1, h); c.lineTo(x - 10, h); c.fill(); } }, [8, 1]), { side: THREE.DoubleSide }), 0, 26, 214);
  H.tape.visible = false;

  // ----- the yellow crop duster helicopter, unmarked
  const heli = new THREE.Group(); heli.visible = false; g.add(heli); H.heli = heli;
  const yellow = lam('#e0b018', { emissive: '#2a1e00' }), dark = lam('#14141a');
  const body = add(heli, new THREE.SphereGeometry(20, 20, 14), yellow, 0, 0, 0); body.scale.set(1.5, 0.95, 0.9);
  add(heli, new THREE.SphereGeometry(13, 16, 10), lam('#24384a', { emissive: '#0a1a2a' }), 22, 2, 0);
  add(heli, box(62, 6, 5), yellow, -52, 4, 0); add(heli, box(8, 20, 2), yellow, -80, 12, 0);
  for (const z of [-16, 16]) { add(heli, box(50, 2.4, 2.4), dark, 2, -26, z); for (const x of [-12, 14]) add(heli, box(2, 12, 2), dark, x, -20, z * 0.8); }
  add(heli, box(2, 1.4, 70), dark, -6, -14, 0);   // the spray boom
  add(heli, cyl(1.6, 1.6, 12, 8), dark, 0, 22, 0);
  H.rotorHub = new THREE.Group(); H.rotorHub.position.y = 28; heli.add(H.rotorHub);
  for (const a of [0, Math.PI / 2]) add(H.rotorHub, box(150, 0.8, 5), dark, 0, 0, 0, a);
  add(H.rotorHub, new THREE.CircleGeometry(75, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8a8aa0', transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }), 0, 0.5, 0);
  H.tailRotor = add(heli, box(2, 26, 2), dark, -80, 12, 3);
  H.spot = makeShaft({ color: '#e8f0ff', len: 270, r0: 3, r1: 58, opacity: 0.42 }); heli.add(H.spot);
  addGlow(heli, '#ff2018', 14, 0.9, -82, 24, 0);

  // ----- Dock B, off to the right: a dock edge, a rolling door, one sodium light, fence, and a box truck backing in
  const D = new THREE.Group(); D.position.set(DOCK[0] - EXT_X, 0, DOCK[2]); g.add(D);
  add(D, box(230, 170, 20), lam('#4a4240'), -90, 85, -110);
  add(D, box(250, 22, 100), lam('#5c5a5c'), -90, 11, -52);                       // the platform (its top is y 22)
  add(D, box(250, 4, 3), lit('#c89818', 0.55), -90, 21, -1.4);
  const shutter = canvasTex(64, 64, (c) => { c.fillStyle = '#5a5862'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 7) { c.fillStyle = '#2c2a34'; c.fillRect(0, y, 64, 2); } }, [3, 3]);
  add(D, plane(84, 92), new THREE.MeshLambertMaterial({ map: shutter }), -96, 68, -99.4);
  add(D, plane(52, 17), flat(textTex(['DOCK B'], { w: 192, h: 64, bg: '#18161c', fg: '#ffb040', px: 40 })), -96, 126, -99);
  add(D, box(24, 6, 12), lit('#ffa040', 2), -38, 138, -97);
  addGlow(D, '#ff9430', 150, 0.5, -38, 130, -90);
  for (let x = 40; x < 420; x += 26) add(D, box(1.6, 56, 1.6), lam('#2a2c34'), x, 28, -140);
  for (const y of [20, 40, 56]) add(D, box(390, 1.2, 1.2), lam('#2a2c34'), 230, y, -140);
  H.dockTruck = whiteTruck(false); D.add(H.dockTruck);
  H.dockTruck.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHexString() === 'c8ccd0') o.material = lam('#7a6a58'); });
  H.reverse = [-13, 13].map((z) => addGlow(H.dockTruck, '#f0f4ff', 44, 0.8, -58, 24, z));

  // tule fog lying low everywhere
  H.fog = [];
  for (let i = 0; i < (high ? 70 : 34); i++) {
    const x = -1100 + hash(i + 61) * 3300, z = -600 + hash(i + 67) * 1200;
    const s = addGlow(g, '#7c8ca0', 160 + hash(i + 71) * 190, 0.075, x, 8 + hash(i + 73) * 12, z);
    s.scale.y *= 0.3;
    H.fog.push({ s, x, ph: hash(i + 79) * 6 });
  }

  H.update = (dt, t) => {
    for (const j of H.jacks) j.beam.rotation.z = Math.sin(t * 1.7 + j.ph) * 0.24;
    for (const f of H.flare) f.scale.set(f.userData.s * (1 + Math.sin(t * 17 + f.userData.s) * 0.08), f.userData.s * (1.3 + Math.sin(t * 11) * 0.18), 1);
    for (const c of H.cars) c.g.position.set((((c.x0 + c.v * t) % 2600) + 2600) % 2600 - 900, 0, c.z);
    for (const f of H.fog) f.s.position.x = f.x + Math.sin(t * 0.12 + f.ph) * 40;
    for (const tk of H.trucks) if (tk.userData.beacon) { const on = Math.sin(t * 8 + tk.position.x * 0.05) > 0; tk.userData.beacon.material.color.set('#ffa018').multiplyScalar(on ? 2.4 : 0.4); tk.userData.halo.material.opacity = on ? 0.7 : 0.08; }
    H.rotorHub.rotation.y = t * 31;
    H.tailRotor.rotation.z = t * 47;
    H.queue.update(t);
    const u = (t * 0.42) % 1;
    H.lift.position.set(386, 24 + smooth(u) * 112, -426);
  };
  return { group: g, h: H };
}

// ===================================================================== the one-hour Photo Hut
export function buildKiosk() {
  const g = new THREE.Group(), H = {};
  g.position.set(KIOSK_X, 0, 0);
  const tile = canvasTex(64, 64, (c) => { c.fillStyle = '#c8c0a8'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#2c7a74'; c.fillRect(0, 0, 32, 32); c.fillRect(32, 32, 32, 32); }, [11, 9]);
  add(g, plane(520, 420).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile, color: '#6a6870', roughness: 0.35, metalness: 0.1 }), 0, 0, 0);
  add(g, box(520, 190, 6), lam('#1c1830'), 0, 95, -150);
  for (const [name, color, x] of [['ARCADE', '#2ee6ff', -170], ['PRETZELS', '#ffcc33', 175]]) add(g, plane(104, 30), flat(neonSignTexture(name, color), { transparent: true }), x, 118, -146);
  // the booth: back panel, posts, a roof with its sign, and the red safelight inside
  add(g, box(150, 108, 5), lam('#38222a'), 0, 54, -46);
  for (const x of [-76, 76]) add(g, box(7, 112, 7), lam('#b8a060'), x, 56, -8);
  add(g, box(166, 10, 54), lam('#2a1c26'), 0, 112, -24);
  add(g, plane(128, 22), flat(textTex(['ONE-HOUR PHOTO'], { w: 512, h: 88, bg: '#ffd040', fg: '#8a1020', px: 56 }), { color: '#cfc4a8' }), 0, 99, 3.4);
  H.safe = add(g, box(40, 4, 6), lit('#ff2a18', 1.8), -36, 86, -40);
  H.safeGlow = addGlow(g, '#ff2010', 150, 0.34, -36, 78, -34, true);
  // the rack of envelopes
  const env = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#2a1c18'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 17; i++) { c.fillStyle = ['#d8b868', '#c8a050', '#e0c880'][(r + i) % 3]; c.fillRect(6 + i * 14.4, 6 + r * 38 + hash(r * 20 + i) * 5, 11, 30); c.fillStyle = '#7a2018'; c.fillRect(6 + i * 14.4, 12 + r * 38 + hash(r * 20 + i) * 5, 11, 4); }
  });
  add(g, plane(70, 46), flat(env, { color: '#a89888' }), 34, 66, -43);
  // the print machine and the counter (envelopes stacked on it)
  add(g, box(30, 36, 22), lam('#8a8474'), -56, 40, -26);
  add(g, box(18, 5, 2), lit('#40ff80', 0.9), -56, 50, -14.6);
  add(g, box(160, 20, 24), lam('#7a2c44'), 0, 10, 20);
  add(g, box(168, 3.4, 30), lam('#d8cfc0'), 0, 21.6, 20);
  for (let i = 0; i < 5; i++) add(g, box(13, 1.4, 9), lam(i % 2 ? '#d8b868' : '#e0c880'), 34 + hash(i) * 4, 24.2 + i * 1.5, 22, hash(i + 4) * 0.5 - 0.25);
  H.update = (dt, t) => { H.safeGlow.material.opacity = 0.3 + Math.sin(t * 2.2) * 0.04; };
  return { group: g, h: H };
}

// ===================================================================== the security office, 12:01 onward
export function dressOffice(off) {
  const g = new THREE.Group(), H = {};
  // the window becomes closed blinds (it is a dry, foggy night)
  const blinds = canvasTex(128, 96, (c, w, h) => { c.fillStyle = '#1c2230'; c.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 8) { c.fillStyle = '#4a5266'; c.fillRect(0, y, w, 4); } });
  off.h.win.material.map = blinds; off.h.win.material.color.set('#8a94b0');
  // the brand-new sealed air unit with the agency's sticker
  const unit = new THREE.Group(); unit.position.set(100, 56, -60); g.add(unit);
  add(unit, box(46, 38, 14), new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.4, metalness: 0.5 }), 0, 0, 0);
  for (let y = -12; y <= 2; y += 4.4) add(unit, box(36, 1.6, 1), lam('#20242c'), 0, y, 7.4);
  add(unit, plane(30, 9), flat(textTex(['KERN VALLEY', 'VECTOR CONTROL'], { w: 320, h: 96, bg: '#e8e8e0', fg: '#14301f', px: 32 }), { color: '#d0d0c8' }), 0, 11.4, 7.6);
  H.led = add(unit, new THREE.SphereGeometry(1.4, 8, 6), lit('#30ff60', 2), 18, -15, 7.4);
  // the Cop's own steel door, on the left wall, swinging shut, and its deadbolt
  H.doorway = add(g, box(2, 96, 54), lam('#05060a'), -126.4, 48, 62);
  const hinge = new THREE.Group(); hinge.position.set(-125, 0, 36); g.add(hinge); H.door = hinge;
  add(hinge, box(4, 94, 50), new THREE.MeshStandardMaterial({ color: '#4a505e', roughness: 0.42, metalness: 0.65 }), 0, 47, 25);
  H.bolt = add(hinge, box(3, 5, 12), new THREE.MeshStandardMaterial({ color: '#e0c060', roughness: 0.25, metalness: 0.9, emissive: '#4a3a08' }), 3.2, 48, 38);
  /** open 1..0, bolt 0..1 (thrown) */
  H.setDoor = (open, bolt) => { hinge.rotation.y = open * 1.15; H.bolt.position.z = 38 + bolt * 7; };
  H.setDoor(1, 0);
  H.update = (dt, t) => { H.led.material.color.set('#30ff60').multiplyScalar(Math.sin(t * 5) > -0.4 ? 2 : 0.5); };
  off.group.add(g);
  return { group: g, h: H };
}

// ----- what the security monitors show (drawn into the office's 320 x 240 feed canvas) -----
const scan = (c, w, h, t, noise) => {
  for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(200,255,220,${hash(i * 3 + t * 31) * noise})`; c.fillRect(hash(i + t * 7) * w, hash(i + 90 + t * 13) * h, 2, 1); }
  c.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
};
const label = (c, w, h, a, b) => { c.font = `bold ${Math.round(h * 0.07)}px monospace`; c.fillStyle = '#9dffc8'; c.textAlign = 'left'; c.fillText(a, 8, h * 0.1); c.fillText(b, 8, h - 8); };

/**
 * The atrium from a ceiling camera. mode 'crowd' (packed and moving), 'still' (everyone down) or 'rise' (they are getting
 * up: `k` 0..1 is how many have).
 */
export function drawMallFeed(c, w, h, t, mode, k = 0) {
  c.fillStyle = '#0e2a20'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(120,230,170,0.12)'; c.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(w / 2 + (x - w / 2) * 0.5, 0); c.lineTo(w / 2 + (x - w / 2) * 1.5, h); c.stroke(); }
  for (let i = 0; i < 80; i++) {
    const depth = hash(i + 2), x = 14 + hash(i) * (w - 28) + (mode === 'crowd' ? Math.sin(t * 1.5 + i) * 3 : 0), y = h * 0.2 + depth * h * 0.68, s = 7 + depth * 11;
    const up = mode === 'crowd' ? 1 : mode === 'rise' ? smooth((k * 1.5 - hash(i + 31)) * 3) : 0;
    c.save(); c.translate(x, y); c.rotate((1 - up) * (hash(i + 5) > 0.5 ? 1.5 : -1.5));
    c.fillStyle = up > 0.4 && mode === 'rise' ? '#d8ffe0' : '#6ad0a0';
    c.beginPath(); c.arc(0, -s * 1.5, s * 0.34, 0, Math.PI * 2); c.fill();
    c.fillRect(-s * 0.36, -s * 1.2, s * 0.72, s * 1.2);
    if (mode === 'rise' && up > 0.6) c.fillRect(s * 0.3, -s * 1.1 + Math.sin(t * 6 + i) * 2, s * 0.8, s * 0.18);
    c.restore();
  }
  scan(c, w, h, t, 0.16);
  label(c, w, h, 'CAM 03  FOOD COURT', mode === 'crowd' ? '11:58 PM' : mode === 'still' ? '12:04 AM' : '12:09 AM');
}

/** The local station on a small CRT: an anchor at a desk, too soft to have a face, under the station's lower third. */
export function drawNewsFeed(c, w, h, t) {
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1a2c6a'); bg.addColorStop(1, '#0a1030');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2a408a'; c.fillRect(w * 0.6, h * 0.1, w * 0.32, h * 0.34);
  c.fillStyle = '#c86a28'; c.fillRect(w * 0.64, h * 0.24, w * 0.05, h * 0.2); c.fillRect(w * 0.73, h * 0.18, w * 0.04, h * 0.26);   // a stock refinery graphic
  const x = w * 0.38 + Math.sin(t * 1.3) * 2;
  c.fillStyle = '#3a2018'; c.beginPath(); c.ellipse(x, h * 0.35, w * 0.085, h * 0.15, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#c89878'; c.beginPath(); c.ellipse(x, h * 0.38, w * 0.062, h * 0.12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#4a1c28'; c.beginPath(); c.moveTo(x - w * 0.18, h * 0.72); c.lineTo(x - w * 0.08, h * 0.5); c.lineTo(x + w * 0.08, h * 0.5); c.lineTo(x + w * 0.18, h * 0.72); c.fill();
  c.fillStyle = '#6a5040'; c.fillRect(w * 0.06, h * 0.7, w * 0.88, h * 0.08);
  c.fillStyle = '#b01820'; c.fillRect(0, h * 0.78, w, h * 0.17);
  c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.font = `bold ${Math.round(h * 0.09)}px sans-serif`; c.fillText('ACTION NEWS 17', 12, h * 0.855);
  c.font = `${Math.round(h * 0.062)}px sans-serif`; c.fillText('REFINERY LEAK: STAY INDOORS', 12, h * 0.928);
  scan(c, w, h, t, 0.1);
}
