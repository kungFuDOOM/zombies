// The wing bosses: smooth-skinned bodies (mesh.js lofts) on a tiny bone tree, with props parented
// to those bones. render3d.js keeps driving the same pivots as ever: rig.arm (cleaver arm),
// rig.legs[], rig.heads[i] (+ userData.jaw), rig.rig (lean). Optional extras (basket, belly,
// reels, sack) are plain bones other code may animate. See DESIGN.md sections 5.4 and 5.5.
//
// Units: game units. One survivor is ~47 tall; every body is built ~116 tall (the Butcher's size at
// BOSS_SCALE 1) and the rig group is scaled to the roster height (scale / 2.6).

import * as THREE from 'three';
import { skinCtx, loft, addSurfaces } from './mesh.js';
import { BOSS_ROSTER } from './bossRoster.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- procedural paint ----------
const texCache = new Map();
function tex(key, w, h, draw, repeat = true) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const rng = (seed) => { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };

// a base colour with grime blotches and flecks, optional crumbs / veins / stains
function paint(key, base, o = {}) {
  return tex(`bp:${key}:${base}:${JSON.stringify(o)}`, 128, 128, (ctx, w, h) => {
    const r = rng(o.seed || 3);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    if (o.stripes) { ctx.fillStyle = o.stripes; for (let x = 0; x < w; x += o.stripeW || 16) ctx.fillRect(x, 0, (o.stripeW || 16) / 2, h); }
    if (o.bands) for (const [y0, y1, c] of o.bands) { ctx.fillStyle = c; ctx.fillRect(0, y0 * h, w, (y1 - y0) * h); }
    for (let i = 0; i < (o.grime ?? 20); i++) { ctx.save(); ctx.globalAlpha = 0.1 + r() * 0.2; ctx.fillStyle = r() < 0.7 ? '#1a140c' : (o.dirt || '#4a5a2a'); ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 4 + r() * 14, 3 + r() * 9, r() * 3, 0, 7); ctx.fill(); ctx.restore(); }
    for (let i = 0; i < (o.crumbs ?? 0); i++) { ctx.fillStyle = r() < 0.5 ? '#e8b850' : '#b87820'; ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
    for (let i = 0; i < (o.blood ?? 0); i++) { const x = r() * w, y = r() * h * 0.8; ctx.fillStyle = r() < 0.5 ? '#6a0a0a' : '#8a1212'; ctx.beginPath(); ctx.ellipse(x, y, 3 + r() * 8, 3 + r() * 6, r() * 3, 0, 7); ctx.fill(); ctx.fillRect(x - 1, y, 2.5, 6 + r() * 20); }
    if (o.veins) { ctx.strokeStyle = o.veins; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { let x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += -8 + r() * 16; y += 5 + r() * 12; ctx.lineTo(x, y); } ctx.stroke(); } }
    for (let i = 0; i < 70; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,230,0.07)'; ctx.fillRect(r() * w, r() * h, 2, 2); }
  });
}

// ---------- a boss body builder ----------
function begin() {
  const mats = [];
  const m = (color, o = {}) => { const mt = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o }); mats.push(mt); return mt; };
  const root = new THREE.Group(), rig = new THREE.Group();
  root.add(rig);
  const bones = {};
  const bone = (name, parent, x, y, z) => {
    const b = new THREE.Bone();
    b.name = name; b.position.set(x, y, z);
    (parent ? bones[parent] : rig).add(b);
    bones[name] = b;
    return b;
  };
  const r = { root, rig, boss: true, wings: [], heads: [], legs: [] };
  return { mats, m, root, rig, bones, bone, r, S: null };
}
const GEO = new Map();
const geo = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };
const G = {
  box: (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  sph: (rad, s = 14) => geo(`s${rad},${s}`, () => new THREE.SphereGeometry(rad, s, Math.max(6, s - 4))),
  cyl: (rt, rb, h, s = 12) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (rad, h, s = 8) => geo(`k${rad},${h},${s}`, () => new THREE.ConeGeometry(rad, h, s)),
  tor: (rad, t, arc = Math.PI * 2, s = 14) => geo(`t${rad},${t},${arc},${s}`, () => new THREE.TorusGeometry(rad, t, 8, s, arc)),
};

// attach a rigid part to a bone; `at` is a rig-space bind position, so call after the bones are placed
function prop(B, boneName, geometry, material, at, rot = [0, 0, 0], scale = [1, 1, 1]) {
  const b = B.bones[boneName];
  const p = B.S.pos(boneName);
  if (!geometry.attributes.color) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(at[0] - p.x, at[1] - p.y, at[2] - p.z);
  mesh.rotation.set(...rot); mesh.scale.set(...scale);
  mesh.frustumCulled = false;
  b.add(mesh);
  return mesh;
}

// bones every humanoid boss shares; spec numbers are heights above the floor
function skeleton(B, s) {
  const { bone } = B;
  bone('pelvis', null, 0, s.leg, 0);
  bone('belly', 'pelvis', 0, s.h1, 0);
  bone('chest', 'belly', 0, s.h2, 0);
  bone('head', 'chest', 0, s.neck, s.headZ || 0);
  bone('jaw', 'head', 0, s.jawY ?? -6, s.jawZ ?? 5);
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const up = s.arm[side === 'R' ? 0 : 2], fore = s.arm[side === 'R' ? 1 : 3];
    bone(`arm${side}`, 'chest', sx * s.shoulder, s.shoulderY, 0);
    bone(`fore${side}`, `arm${side}`, 0, -up, 0);
    bone(`hand${side}`, `fore${side}`, 0, -fore, 0);
    bone(`leg${side}`, 'pelvis', sx * s.hipW, 0, 0);
  }
  B.rig.updateMatrixWorld(true);
  B.S = skinCtx(B.rig);
  const r = B.r;
  r.legs = [B.bones.legL, B.bones.legR];
  r.arm = B.bones.armR; r.cleaver = B.bones.handR;
  const head = B.bones.head; head.userData.jaw = B.bones.jaw;
  r.heads = [head];
  r.belly = B.bones.belly; r.basket = B.bones.handL;
}

// the lofted body: torso, two arms, two legs. s.torso = [[height above pelvis, rx, rz, oz], ...]
function body(B, s, mt) {
  const { S } = B;
  const E = 7; // torso extends below the pelvis bone, into the crotch
  const surfs = [];
  surfs.push(...loft(S, {
    pts: ['pelvis', 'belly', 'chest', 'head'].map((n) => S.pos(n)), bones: ['pelvis', 'belly', 'chest'], ext0: E, seg: 16, step: 5, blend: 0.5,
    profile: s.torso.map(([h, rx, rz, oz = 0]) => [E + h, rx, rz, oz]),
    zones: mt.torsoZones.map(([a, b, mat]) => ({ from: a === 0 ? 0 : E + a, to: E + b, mat })),
  }));
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const up = s.arm[side === 'R' ? 0 : 2], fore = s.arm[side === 'R' ? 1 : 3], rr = s.armR[side === 'R' ? 0 : 1];
    surfs.push(...loft(S, {
      pts: ['arm', 'fore', 'hand'].map((n) => S.pos(n + side)), bones: [`arm${side}`, `fore${side}`], ext0: 5, seg: 10, step: 5, blend: 0.8,
      profile: [[0, rr * 1.0], [5 + up * 0.4, rr * 1.18], [5 + up, rr * 0.9], [5 + up + fore * 0.3, rr * (s.foreK || 1.15)], [5 + up + fore, rr * 0.72]].map(([d, q]) => [d, q, q]),
      zones: [{ from: 0, to: 5 + up, mat: mt.upper }, { from: 5 + up, to: 99, mat: mt.fore }],
    }));
    const hip = S.pos(`leg${side}`);
    surfs.push(...loft(S, {
      pts: [hip, V(hip.x, 3, hip.z)], bones: [`leg${side}`], ext0: 5, seg: 10, step: 6, blend: 0.5,
      profile: [[0, s.legR * 1.05], [5 + s.leg * 0.25, s.legR * 1.1], [5 + s.leg * 0.7, s.legR * 0.9], [5 + s.leg, s.legR * 0.78]].map(([d, q]) => [d, q, q * 1.04]),
      zones: [{ from: 0, to: 99, mat: mt.leg }],
    }));
  }
  addSurfaces(S, surfs);
}

const dark = '#241c18';
const shared = (B) => ({
  steel: B.m('#dfe5f2', { metalness: 0.4, roughness: 0.3, emissive: '#404858', emissiveIntensity: 0.55 }),
  steelD: B.m('#8a8e9a', { metalness: 0.7, roughness: 0.35 }),
  blood: B.m('#7a1210', { roughness: 0.3 }), bone: B.m('#e8e0c8'), dark: B.m(dark),
  glow: B.m('#ffa020', { emissive: '#ff8010', emissiveIntensity: 1.8 }),
  eye: B.m('#ffe040', { emissive: '#ffcc00', emissiveIntensity: 2.4 }),
});
const lofted = (B, color, o = {}) => B.m(color, { vertexColors: true, roughness: 0.8, ...o });
const boots = (B, s, col, w = 9, l = 20) => {
  const bm = B.m(col);
  for (const [side, sx] of [['R', 1], ['L', -1]]) prop(B, `leg${side}`, G.box(w * 1.8, 7, l), bm, [sx * s.hipW, 3.5, l * 0.18], [0, 0, 0]);
};
const shoulderPads = (B, s, mat, k = 1) => {
  for (const [side, sx] of [['R', 1], ['L', -1]]) prop(B, `arm${side}`, G.sph(s.armR[side === 'R' ? 0 : 1] * 1.5 * k, 12), mat, [sx * s.shoulder, B.S.pos('chest').y + s.shoulderY, 0], [0, 0, 0], [1, 0.85, 1]);
};

// ---------- THE DEEP-FRY BUTCHER ----------
// A hulking pig-mascot chef: a pink pig head with glowing eyes and tusks, a tall chef's hat, a filthy white
// jacket under a bloody apron, meat hooks off his back, a cleaver bigger than his head and a smoking fry basket on a chain.
function butcher() {
  const B = begin(), { m } = B;
  const s = { leg: 40, hipW: 11, legR: 9.5, h1: 10, h2: 22, neck: 22, headZ: 5, shoulder: 31, shoulderY: 16, arm: [26, 24, 21, 20], armR: [8.2, 6.3], jawY: -8, jawZ: 8,
    torso: [[-7, 14, 12], [0, 20, 16], [10, 29, 24, 2], [22, 30, 25, 3], [32, 26, 19], [40, 29, 17], [47, 24, 14], [52, 10, 10], [54, 8, 8]] };
  skeleton(B, s);
  const X = shared(B);
  const batter = lofted(B, '#ffffff', { map: paint('batter', '#c89868', { crumbs: 160, grime: 14, dirt: '#6a3a18', seed: 5 }) });
  const undershirt = lofted(B, '#ffffff', { map: paint('under', '#ece6d6', { grime: 34, blood: 16, dirt: '#9a8a60', seed: 8 }) }); // the chef's jacket: filthy white, soaked in blood
  const trousers = lofted(B, '#ffffff', { map: paint('trou', '#3a3a40', { grime: 30, blood: 4, dirt: '#1a1a14', seed: 9, stripes: '#2c2c32', stripeW: 24 }) });
  const flesh = lofted(B, '#ffffff', { map: paint('flesh', '#b88a80', { grime: 26, veins: 'rgba(120,50,90,0.6)', blood: 3, seed: 6 }) });
  body(B, s, {
    torsoZones: [[0, 12, trousers], [12, 80, undershirt]], upper: undershirt, fore: flesh, leg: trousers,
  });
  boots(B, s, '#17171c', 9, 24);
  const cy = B.S.pos('chest').y, by = B.S.pos('belly').y;
  // apron: a thin plate over the belly and chest, skinned so it sways with the gut
  const apron = lofted(B, '#ffffff', { map: paint('apron', '#e6dcc0', { grime: 26, blood: 26, dirt: '#8a6a2a', seed: 12, bands: [[0.82, 0.9, '#c8a050']] }), side: THREE.DoubleSide, roughness: 0.5 });
  addSurfaces(B.S, loft(B.S, {
    pts: ['chest', 'belly', 'pelvis'].map((n) => B.S.pos(n)), bones: ['chest', 'belly'], ext0: 14, ext1: 14, seg: 12, step: 2.5, blend: 0.7,
    profile: [[0, 20, 2.2, 17], [14, 26, 2.2, 21.5], [26, 31, 2.2, 27.5], [36, 30, 2.2, 26.5], [46, 22, 2, 19], [60, 15, 2, 13]],
    zones: [{ from: 0, to: 99, mat: apron }],
  }));
  // blood-soaked handprints, a torn flank with ribs and gut, a stuck tooth
  const fresh = m('#8a1410', { roughness: 0.3 }), wound = m('#4a0808', { roughness: 0.3 });
  prop(B, 'belly', G.sph(11, 10), wound, [22, by + 4, 32], [0, 0.3, 0.2], [1, 1.2, 0.35]);
  for (let i = 0; i < 3; i++) prop(B, 'belly', G.box(1.6, 12, 1.4), X.bone, [18 + i * 4, by + 4, 36], [0, 0, 0.1]);
  for (let i = 0; i < 3; i++) prop(B, 'belly', G.cyl(1.6, 1.6, 14, 6), m('#c07070'), [20 + i * 3, by - 10 - i * 2, 34], [0, 0, 0.3]);
  for (let i = 0; i < 4; i++) prop(B, 'chest', G.box(2.4, 6 + i * 2, 1), fresh, [-14 + i * 7, cy + 4 - i * 2, 28.4]);
  // meat hooks rising off his back with sausage links and order tickets
  const hookM = m('#6a6e78', { metalness: 0.7 });
  for (const [x, h] of [[-16, 26], [0, 38], [16, 26]]) {
    prop(B, 'chest', G.cyl(1, 1, h, 5), hookM, [x, cy + 22 + h / 2, -18], [0.15, 0, 0]);
    prop(B, 'chest', G.tor(5, 1.1, Math.PI * 1.3, 10), hookM, [x, cy + 22 + h, -17], [0, 0, 2.2]);
    for (let k = 0; k < 3; k++) prop(B, 'chest', G.sph(2.5, 8), m('#a83a3a'), [x + 3, cy + 18 + h - k * 4.5, -16.5], [0, 0, 0], [1, 1.5, 1]);
    prop(B, 'chest', G.box(6, 8, 0.6), m('#f4f0e0'), [x - 4, cy + 14 + h, -17], [0, 0.4, 0.1]);
  }
  // THE PIG-MASCOT CHEF: a cracked fibreglass pig head (the food court's "Chef Porko" mascot) with the cook's angry eyes glowing
  // out of it, tusks, a snout, floppy ears and a tall, filthy chef's hat
  const hy = B.S.pos('head').y, hz = B.S.pos('head').z;
  const pig = m('#f2a2ac', { roughness: 0.5 }), pigD = m('#d8788a', { roughness: 0.5 }), hat = m('#f6f2e6', { roughness: 0.6 }), hatD = m('#cfc6ae', { roughness: 0.8 }), pigL = m('#f6b4be', { roughness: 0.5 }), hotM = m('#ffffff', { emissive: '#fff4c0', emissiveIntensity: 2.4 }), dark = m('#241c18');
  prop(B, 'head', G.sph(20, 18), pig, [0, hy + 6, hz], [0, 0, 0], [1.1, 1.02, 1.02]);                       // the big round head
  prop(B, 'head', G.cyl(10, 11.5, 11, 14), pigD, [0, hy + 0.5, hz + 20], [Math.PI / 2, 0, 0], [1, 1, 0.85]);   // snout
  prop(B, 'head', G.cyl(9, 9, 1.4, 14), pigL, [0, hy + 0.5, hz + 24.6], [Math.PI / 2, 0, 0]);                           // lighter snout face
  for (const sx of [-1, 1]) prop(B, 'head', G.sph(2.5, 8), dark, [sx * 4.2, hy + 0.8, hz + 25.6], [0, 0, 0], [1, 1.5, 0.55]); // nostrils
  for (const sx of [-1, 1]) {
    prop(B, 'head', G.cone(8, 17, 4), pig, [sx * 17, hy + 22, hz - 3], [-0.3, Math.PI / 4, sx * -0.55], [1, 1, 0.45]);     // floppy ears
    prop(B, 'head', G.cone(4.6, 11, 4), pigD, [sx * 17.4, hy + 21, hz - 1.5], [-0.3, Math.PI / 4, sx * -0.55], [1, 1, 0.4]);
    prop(B, 'head', G.sph(4.2, 8), dark, [sx * 8.5, hy + 10, hz + 16.4], [0, 0, 0], [1.35, 0.95, 0.5]);                    // dark socket, so the eye reads as a clean dot
    prop(B, 'head', G.sph(3.1, 8), X.eye, [sx * 8.5, hy + 10, hz + 18], [0, 0, 0], [1.2, 0.85, 0.6]);                      // small, angry, glowing eyes
    prop(B, 'head', G.sph(1.3, 6), hotM, [sx * 8.5, hy + 10, hz + 20], [0, 0, 0]);                                // hot core
    prop(B, 'head', G.box(11, 2.8, 2.4), dark, [sx * 8.5, hy + 14.2, hz + 18.6], [0, 0, sx * -0.4]);                      // heavy brow
    prop(B, 'jaw', G.cone(2.4, 11, 5), X.bone, [sx * 8, hy - 6, hz + 20], [-0.2, 0, sx * 0.12]);                         // tusks
  }
  prop(B, 'head', G.box(7, 1.8, 1.2), X.blood, [-3, hy - 6.2, hz + 25.2], [0, 0, 0.1]);                      // a small blood smear under the snout
  prop(B, 'jaw', G.box(15, 3, 6), pigD, [0, hy - 8, hz + 15]);                                               // lower lip
  // the chef's hat (toque): band, tall pleated stack, puffy crown, grease and blood
  prop(B, 'head', G.cyl(16, 16.5, 6, 18), hatD, [0, hy + 21, hz - 1]);
  prop(B, 'head', G.cyl(14.5, 15.5, 16, 18), hat, [0, hy + 32, hz - 1]);
  prop(B, 'head', G.sph(17, 14), hat, [0, hy + 45, hz - 1], [0, 0, 0], [1, 0.8, 1]);
  prop(B, 'head', G.box(5, 9, 1), X.blood, [-7, hy + 35, hz + 14.6]);                                        // (up on the hat, clear of the face)
  prop(B, 'head', G.box(9, 3, 1), hatD, [6, hy + 24, hz + 15.4]);
  // the cleaver, scaled up on the long right arm
  const cl = 'handR', hp = B.S.pos('handR'), cx = hp.x + 6, cyh = hp.y, cz = hp.z + 24;
  prop(B, cl, G.box(5.5, 26, 5.5), X.dark, [cx, cyh + 6, cz]);                                                 // handle, held upright
  prop(B, cl, G.sph(4.5, 8), X.steelD, [cx, cyh - 7, cz]);
  prop(B, cl, G.box(8, 3, 9), X.steelD, [cx, cyh + 19, cz]);                                                    // bolster
  prop(B, cl, G.box(34, 44, 5), X.steel, [cx - 6, cyh + 42, cz]);                                               // the blade, broadside to the camera
  prop(B, cl, G.box(34, 5, 7), X.steelD, [cx - 6, cyh + 64, cz]);                                               // top spine
  prop(B, cl, G.box(4, 44, 7), X.steelD, [cx - 21, cyh + 42, cz]);                                              // spine edge
  prop(B, cl, G.box(3.4, 44, 5.8), m('#ffffff', { metalness: 0.9, roughness: 0.15, emissive: '#ffffff', emissiveIntensity: 0.25 }), [cx + 11.5, cyh + 42, cz]); // bright cutting edge
  prop(B, cl, G.box(22, 16, 5.6), X.blood, [cx - 4, cyh + 34, cz + 0.4]);
  prop(B, cl, G.box(5, 26, 5.6), X.blood, [cx + 4, cyh + 30, cz + 0.4]);
  prop(B, cl, G.box(9, 9, 6), X.dark, [cx - 12, cyh + 54, cz]);                                                 // hang hole
  for (let i = 0; i < 3; i++) prop(B, cl, G.sph(2, 6), X.blood, [cx + 8 + i * 1.5, cyh + 18 - i * 5, cz + 2]);
  // the fry basket on a chain from the left hand
  const lh = B.S.pos('handL'), bm = m('#2a2a34', { metalness: 0.6 }), chain = m('#8a8e9a', { metalness: 0.8 });
  for (let i = 0; i < 5; i++) prop(B, 'handL', G.tor(2.2, 0.6, Math.PI * 2, 8), chain, [lh.x, lh.y - 3 - i * 4, lh.z], [i % 2 ? 0 : Math.PI / 2, 0, 0]);
  prop(B, 'handL', G.cyl(15, 11, 15, 14), bm, [lh.x, lh.y - 30, lh.z + 4]);
  prop(B, 'handL', G.cyl(14, 14, 1.5, 14), X.glow, [lh.x, lh.y - 23.5, lh.z + 4]);
  for (let i = 0; i < 6; i++) prop(B, 'handL', G.box(5, 4, 5), i % 2 ? m('#b04a4a') : m('#6a1818'), [lh.x - 7 + (i % 3) * 7, lh.y - 22, lh.z + (i % 2) * 7 - 2], [i, i * 2, 0]);
  prop(B, 'handL', G.cyl(1.4, 1.4, 14, 5), X.bone, [lh.x + 3, lh.y - 20, lh.z + 8], [0.3, 0, 0.7]);
  for (let i = 0; i < 3; i++) prop(B, 'handL', G.sph(1.8, 5), X.glow, [lh.x - 4 + i * 4, lh.y - 38 - (i % 2) * 2, lh.z + 6]); // dripping fat
  finishBoss(B, 'butcher');
  return B;
}

// ---------- WING 2: GUTTERBALL, THE LANE KING ----------
function bowler() {
  const B = begin(), { m } = B;
  const s = { leg: 34, hipW: 10, legR: 8, h1: 10, h2: 20, neck: 20, headZ: 7, shoulder: 28, shoulderY: 14, arm: [26, 22, 26, 22], armR: [8.5, 6], foreK: 1.1, jawY: -6, jawZ: 5,
    torso: [[-7, 13, 11], [0, 17, 14], [10, 23, 17], [20, 27, 19, 1], [32, 29, 18], [42, 26, 15], [48, 12, 10], [50, 8, 8]] };
  skeleton(B, s);
  const X = shared(B);
  const shirt = lofted(B, '#ffffff', { map: paint('bowl', '#1fa8a0', { grime: 16, blood: 4, dirt: '#103a38', seed: 21, bands: [[0.0, 0.18, '#17171c'], [0.82, 1, '#17171c']] }) });
  const pants = lofted(B, '#ffffff', { map: paint('bowlp', '#5a2a3a', { grime: 22, seed: 22, stripes: '#3a1a28', stripeW: 20 }) });
  const skin = lofted(B, '#ffffff', { map: paint('bowls', '#9aa890', { grime: 22, veins: 'rgba(60,100,70,0.6)', blood: 2, seed: 23 }) });
  body(B, s, { torsoZones: [[0, 14, pants], [14, 70, shirt]], upper: skin, fore: skin, leg: pants });
  boots(B, s, '#c8a070', 9, 22);
  const cy = B.S.pos('chest').y, hy = B.S.pos('head').y, hz = B.S.pos('head').z;
  // the ball-fist: his right hand fused into a cracked, glowing bowling ball
  const ballM = m('#18a860', { emissive: '#30ff90', emissiveIntensity: 0.9, roughness: 0.2 });
  const hp = B.S.pos('handR');
  prop(B, 'handR', G.sph(19, 18), ballM, [hp.x, hp.y - 12, hp.z + 4]);
  for (let i = 0; i < 3; i++) prop(B, 'handR', G.cyl(2.2, 2.2, 3, 8), X.dark, [hp.x + (i - 1) * 6, hp.y - 4, hp.z + 15 + (i === 1 ? 2 : 0)], [Math.PI / 2 - 0.5, 0, 0]);
  prop(B, 'handR', G.box(1.4, 22, 1), X.eye, [hp.x + 6, hp.y - 12, hp.z + 22], [0, 0, 0.5]);
  // pin crown rack on his back
  const pinM = m('#f4f0e8'), stripe = m('#c82020');
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.32, px = Math.sin(a) * 26, py = cy + 26 + Math.cos(a) * 12;
    prop(B, 'chest', G.cyl(2.6, 4.2, 26, 10), pinM, [px, py, -17], [0, 0, -a]);
    prop(B, 'chest', G.sph(3.8, 10), pinM, [px + Math.sin(a) * 15, py + Math.cos(a) * 14, -17]);
    prop(B, 'chest', G.cyl(3, 3, 2, 10), stripe, [px + Math.sin(a) * 11, py + Math.cos(a) * 11, -17], [0, 0, -a]);
  }
  // pitching machine bolted to the left shoulder
  const sl = B.S.pos('armL');
  prop(B, 'armL', G.box(16, 16, 18), m('#2a2a34', { metalness: 0.5 }), [sl.x - 4, sl.y + 14, sl.z + 4]);
  prop(B, 'armL', G.cyl(5.5, 5.5, 14, 12), m('#17171c'), [sl.x - 4, sl.y + 14, sl.z + 18], [Math.PI / 2, 0, 0]);
  prop(B, 'armL', G.cyl(4, 4, 1.5, 12), X.eye, [sl.x - 4, sl.y + 14, sl.z + 25.5], [Math.PI / 2, 0, 0]);
  prop(B, 'armL', G.cyl(8, 8, 2, 12), m('#ff3070', { emissive: '#ff2060', emissiveIntensity: 0.6 }), [sl.x - 4, sl.y + 24, sl.z + 4]);
  // head: pale, slick hair, glowing eyes; a name script on the shirt
  const face = m('#9aa890', { roughness: 0.6 });
  prop(B, 'head', G.sph(15, 16), face, [0, hy + 6, hz], [0, 0, 0], [1, 1.1, 1.05]);
  prop(B, 'head', G.sph(15.5, 14), m('#17171c'), [0, hy + 11, hz - 3], [-0.4, 0, 0], [1, 0.8, 1.05]);
  for (const sx of [-1, 1]) prop(B, 'head', G.sph(3, 8), X.eye, [sx * 6, hy + 8, hz + 13.5], [0, 0, 0], [1.2, 0.7, 0.6]);
  prop(B, 'head', G.box(18, 3, 4), m('#f0f0f0'), [0, hy - 6, hz + 12]);                                      // grin
  prop(B, 'chest', G.box(14, 4, 1), m('#ff3070'), [-9, cy + 16, 19.2], [0, 0, 0.1]);                         // name script
  prop(B, 'chest', G.cyl(13, 13, 3, 12), X.dark, [0, cy + 30, 4], [0, 0, 0], [1, 1, 0.8]);                   // collar
  shoulderPads(B, s, shirt, 0.9);
  finishBoss(B, 'bowler');
  return B;
}

// ---------- WING 3: THE PROJECTIONIST ----------
function projectionist() {
  const B = begin(), { m } = B;
  const s = { leg: 42, hipW: 8, legR: 5.2, h1: 10, h2: 22, neck: 18, headZ: 0, shoulder: 17, shoulderY: 16, arm: [30, 28, 30, 28], armR: [4.4, 3.6], foreK: 1.1, jawY: -10, jawZ: 8,
    torso: [[-7, 9, 8], [0, 11, 9], [10, 13, 10], [22, 16, 11], [36, 18, 12], [46, 15, 10], [49, 8, 6], [50, 6, 5]] };
  skeleton(B, s);
  const X = shared(B);
  const velvet = lofted(B, '#ffffff', { map: paint('velvet', '#a03040', { grime: 22, seed: 31, stripes: '#802030', stripeW: 14, blood: 3 }) });
  const black = lofted(B, '#ffffff', { map: paint('usher', '#1a1418', { grime: 20, seed: 32 }) });
  const bone = lofted(B, '#ffffff', { map: paint('pbone', '#c8c0a8', { grime: 28, seed: 33, veins: 'rgba(80,60,40,0.5)' }) });
  body(B, s, { torsoZones: [[0, 16, black], [16, 70, velvet]], upper: velvet, fore: bone, leg: black });
  boots(B, s, '#0c0a0c', 7, 20);
  const cy = B.S.pos('chest').y, hy = B.S.pos('head').y;
  const brass = m('#c8a040', { metalness: 0.7, roughness: 0.35 }), box = m('#1a1a20', { metalness: 0.4 });
  // the projector head: boxy body, a big glowing lens, film reels for ears, a beam
  prop(B, 'head', G.box(34, 26, 34), box, [0, hy + 8, 0]);
  prop(B, 'head', G.box(36, 3, 36), brass, [0, hy + 21.5, 0]);
  prop(B, 'head', G.cyl(10, 12, 12, 16), brass, [0, hy + 8, 22], [Math.PI / 2, 0, 0]);
  prop(B, 'head', G.cyl(8, 8, 3, 16), m('#fffbe8', { emissive: '#fff4c0', emissiveIntensity: 2.4 }), [0, hy + 8, 28.5], [Math.PI / 2, 0, 0]);
  const beam = new THREE.Mesh(G.cone(34, 120, 20), m('#fff6d0', { transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, emissive: '#fff0c0', emissiveIntensity: 0.4, side: THREE.DoubleSide }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, 8, 28 + 60); beam.frustumCulled = false;
  B.bones.head.add(beam);
  const reelM = m('#2a2a30', { metalness: 0.6 }), film = m('#3a2a1a');
  r3reels(B, [-1, 1], hy, reelM, film, brass);
  prop(B, 'jaw', G.box(24, 3, 14), brass, [0, hy - 6, 12]);                                                   // the film gate hinge = the jaw
  // film strips hanging from the wrists
  for (const [side, sx] of [['R', 1], ['L', -1]]) {
    const hp = B.S.pos(`hand${side}`);
    for (let i = 0; i < 3; i++) prop(B, `hand${side}`, G.box(5, 34 - i * 7, 0.5), film, [hp.x + (i - 1) * 3.5, hp.y - 14 - i * 2, hp.z + 1], [0.1 * i, 0, 0.2 * (i - 1) * sx]);
    prop(B, `hand${side}`, G.box(5, 1, 0.6), m('#f0e8d0'), [hp.x, hp.y - 14, hp.z + 1.4]);
  }
  prop(B, 'chest', G.box(22, 4, 1), brass, [0, cy + 12, 11.2]);                                               // usher sash
  for (let i = 0; i < 4; i++) prop(B, 'chest', G.sph(1.6, 6), brass, [(i - 1.5) * 4.5, cy + 4, 11.4]);
  finishBoss(B, 'projectionist');
  return B;
}
function r3reels(B, sides, hy, reelM, film, brass) {
  for (const sx of sides) {
    const reel = new THREE.Group();
    reel.position.set(sx * 26, 14, -4);
    const disc = new THREE.Mesh(G.cyl(15, 15, 3, 14), reelM); disc.rotation.z = Math.PI / 2; reel.add(disc);
    const wind = new THREE.Mesh(G.cyl(11, 11, 4.5, 14), film); wind.rotation.z = Math.PI / 2; reel.add(wind);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(G.box(3.6, 3, 2), brass); sp.position.set(sx * 2, Math.cos(k * 1.256) * 8, Math.sin(k * 1.256) * 8); reel.add(sp); }
    reel.userData.reel = true;
    B.bones.head.add(reel);
    reel.frustumCulled = false;
    (B.r.reels ||= []).push(reel);
  }
}

// ---------- WING 4: MAX REP ----------
function maxrep() {
  const B = begin(), { m } = B;
  const s = { leg: 30, hipW: 14, legR: 11, h1: 8, h2: 22, neck: 24, headZ: 6, shoulder: 38, shoulderY: 18, arm: [28, 24, 28, 24], armR: [11.5, 9], foreK: 1.2, jawY: -5, jawZ: 5,
    torso: [[-7, 15, 12], [0, 18, 14], [8, 22, 16], [20, 34, 22, 2], [32, 42, 24, 3], [44, 43, 22], [50, 26, 15], [54, 10, 10]] };
  skeleton(B, s);
  const X = shared(B);
  const skin = lofted(B, '#ffffff', { map: paint('rep', '#8a7a9a', { grime: 14, seed: 41, veins: '#ff8a30', blood: 2 }) });
  const wind = lofted(B, '#ffffff', { map: paint('wind', '#20c8c0', { grime: 14, seed: 42, stripes: '#ff5ad0', stripeW: 22, bands: [[0.4, 0.55, '#ff5ad0']] }) });
  const shorts = lofted(B, '#ffffff', { map: paint('sh', '#2a2a5a', { grime: 14, seed: 43, stripes: '#ffffff', stripeW: 50 }) });
  body(B, s, { torsoZones: [[0, 10, shorts], [10, 38, wind], [38, 80, skin]], upper: skin, fore: skin, leg: skin });
  boots(B, s, '#f4f4f8', 11, 26);
  const cy = B.S.pos('chest').y, hy = B.S.pos('head').y, hz = B.S.pos('head').z;
  const iron = m('#2c2c34', { metalness: 0.7, roughness: 0.4 }), chrome = m('#d0d4de', { metalness: 0.9, roughness: 0.2 });
  // the barbell yoked through both shoulders
  const by = cy + 28;
  prop(B, 'chest', G.cyl(2.4, 2.4, 150, 10), chrome, [0, by, -6], [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) prop(B, 'chest', G.cyl(26 - i * 5, 26 - i * 5, 5, 16), iron, [sx * (58 + i * 6), by, -6], [0, 0, Math.PI / 2]);
  // tiny head, sweatband, glowing eyes
  const face = m('#8a7a9a', { roughness: 0.6 });
  prop(B, 'head', G.sph(12, 14), face, [0, hy + 5, hz], [0, 0, 0], [1, 1.1, 1.05]);
  prop(B, 'head', G.cyl(12.4, 12.4, 4, 14), m('#ff5ad0'), [0, hy + 10, hz]);
  for (const sx of [-1, 1]) prop(B, 'head', G.sph(2.4, 8), m('#ff9a30', { emissive: '#ff8a30', emissiveIntensity: 2.4 }), [sx * 4.4, hy + 6, hz + 10.5], [0, 0, 0], [1.2, 0.7, 0.6]);
  prop(B, 'jaw', G.box(12, 3, 4), m('#f4ecd8'), [0, hy - 4, hz + 8]);
  // windbreaker tied at the waist: knotted sleeves
  prop(B, 'belly', G.sph(7, 10), wind, [0, B.S.pos('belly').y + 2, 20], [0, 0, 0], [1.6, 0.8, 0.9]);
  shoulderPads(B, s, skin, 0.8);
  finishBoss(B, 'maxrep');
  return B;
}

// ---------- WING 5: SANTA CLAWS ----------
function santa() {
  const B = begin(), { m } = B;
  const s = { leg: 30, hipW: 14, legR: 11, h1: 10, h2: 22, neck: 20, headZ: 8, shoulder: 31, shoulderY: 14, arm: [24, 22, 28, 24], armR: [9, 8], foreK: 1.1, jawY: -7, jawZ: 8,
    torso: [[-7, 18, 15], [0, 25, 21], [10, 34, 30, 3], [22, 37, 34, 4], [34, 32, 27], [44, 28, 19], [49, 14, 11], [52, 9, 9]] };
  skeleton(B, s);
  const X = shared(B);
  const suit = lofted(B, '#ffffff', { map: paint('suit', '#8a2030', { grime: 30, seed: 51, blood: 6, dirt: '#2a0a10' }) });
  const fur = lofted(B, '#ffffff', { map: paint('fur', '#e8e4d8', { grime: 26, seed: 52, dirt: '#8a7a60', crumbs: 0 }) });
  const gut = lofted(B, '#ffffff', { map: paint('gut', '#8a9080', { grime: 20, seed: 53, veins: 'rgba(90,40,70,0.6)', blood: 3 }) });
  body(B, s, { torsoZones: [[0, 5, fur], [5, 80, suit]], upper: suit, fore: fur, leg: suit });
  boots(B, s, '#17110e', 11, 26);
  const cy = B.S.pos('chest').y, by = B.S.pos('belly').y, hy = B.S.pos('head').y, hz = B.S.pos('head').z;
  // the suit split over a grey distended gut
  prop(B, 'belly', G.sph(22, 16), gut, [0, by + 4, 24], [0, 0, 0], [1, 1.05, 0.7]);
  prop(B, 'belly', G.sph(9, 10), m('#4a0808', { roughness: 0.3 }), [6, by + 8, 40], [0, 0, 0.4], [1, 1.4, 0.4]);
  prop(B, 'belly', G.box(60, 7, 8), m('#17110e'), [0, by - 4, 24]);                                          // belt
  prop(B, 'belly', G.box(11, 9, 3), m('#d8b040', { metalness: 0.8 }), [0, by - 4, 29]);
  // the head: sunken face, matted beard, hat with antlers of bone
  const face = m('#9a7a70', { roughness: 0.6 });
  prop(B, 'head', G.sph(15, 14), face, [0, hy + 6, hz], [0, 0, 0], [1, 1.05, 1]);
  const beard = m('#8a6a5a', { roughness: 0.95 });
  for (let i = 0; i < 7; i++) prop(B, 'jaw', G.cone(4.5, 22 - Math.abs(i - 3) * 3, 6), beard, [(i - 3) * 4.2, hy - 12, hz + 11], [Math.PI + 0.1, 0, (i - 3) * 0.08]);
  prop(B, 'head', G.sph(16, 12), beard, [0, hy + 2, hz - 3], [0, 0, 0], [1, 0.7, 0.9]);
  for (const sx of [-1, 1]) prop(B, 'head', G.sph(2.6, 8), m('#ff3a20', { emissive: '#ff3010', emissiveIntensity: 2.4 }), [sx * 6, hy + 9, hz + 13], [0, 0, 0], [1.2, 0.8, 0.6]);
  prop(B, 'head', G.cone(17, 28, 12), suit, [0, hy + 26, hz - 4], [-0.35, 0, 0]);
  prop(B, 'head', G.cyl(17.5, 17.5, 6, 14), fur, [0, hy + 14, hz - 1]);
  prop(B, 'head', G.sph(5, 8), fur, [0, hy + 40, hz - 15]);
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) prop(B, 'head', G.cone(2.2 - k * 0.3, 15, 5), X.bone, [sx * (15 + k * 4), hy + 22 + k * 8, hz - 2], [0, 0, -sx * (0.6 + k * 0.3)]);
  // candy-cane hook
  const hp = B.S.pos('handR');
  prop(B, 'handR', G.cyl(2.2, 2.2, 60, 8), m('#f4f0e4'), [hp.x, hp.y + 8, hp.z + 4]);
  for (let i = 0; i < 6; i++) prop(B, 'handR', G.cyl(2.35, 2.35, 4, 8), m('#d02030'), [hp.x, hp.y - 18 + i * 10, hp.z + 4]);
  prop(B, 'handR', G.tor(10, 2.2, Math.PI, 12), m('#f4f0e4'), [hp.x, hp.y + 38, hp.z + 4], [0, 0, 0]);
  // the toy sack, a second lump with its own mouth (heads[1].userData.jaw)
  const sackM = m('#2a8a48', { roughness: 0.9 });
  const sack = new THREE.Group(); sack.position.set(-26, cy + 8, -30); B.bones.chest.add(sack);
  const sp = B.S.pos('chest'); sack.position.set(-26 - sp.x, cy + 8 - sp.y, -30 - sp.z);
  const sm = new THREE.Mesh(G.sph(24, 14), sackM); sm.scale.set(1, 1.15, 0.9); sack.add(sm);
  const sjaw = new THREE.Group(); sjaw.position.set(0, -2, 18); sack.add(sjaw);
  const mouth = new THREE.Mesh(G.box(24, 10, 3), m('#2a0a0a')); mouth.position.set(0, -2, 22); sack.add(mouth);
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(G.cone(1.6, 5, 4), X.bone); t.position.set(-10 + i * 4, 3, 22.5); t.rotation.x = Math.PI; sjaw.add(t); }
  const toy = [m('#ff5ad0'), m('#40c8ff'), m('#ffcc33')];
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(G.box(7, 7, 7), toy[i % 3]); t.position.set(-8 + i * 7, 22 + (i % 2) * 5, -2); t.rotation.set(i, i * 2, 0); sack.add(t); }
  const sackHead = new THREE.Object3D(); sackHead.userData.jaw = sjaw; sack.add(sackHead);
  sack.traverse((o) => { o.frustumCulled = false; });
  B.r.heads.push(sackHead);
  shoulderPads(B, s, fur, 1.1);
  finishBoss(B, 'santa');
  return B;
}

// ---------- WING 6: MULCHMAW ----------
function mulchmaw() {
  const B = begin(), { m } = B;
  const s = { leg: 32, hipW: 14, legR: 11, h1: 8, h2: 24, neck: 18, headZ: 4, shoulder: 38, shoulderY: 16, arm: [26, 26, 26, 26], armR: [7, 6], foreK: 1.0, jawY: -4, jawZ: 5,
    torso: [[-7, 20, 18], [0, 24, 22], [12, 30, 28], [26, 31, 30], [40, 30, 27], [47, 24, 17], [50, 10, 10]] };
  skeleton(B, s);
  const X = shared(B);
  const orange = lofted(B, '#ffffff', { map: paint('chip', '#e8901c', { grime: 40, seed: 61, dirt: '#5a2a0a', blood: 3 }), roughness: 0.6 });
  const rust = lofted(B, '#ffffff', { map: paint('rust', '#6a4a30', { grime: 40, seed: 62, dirt: '#2a1a0a' }) });
  const skin = lofted(B, '#ffffff', { map: paint('mskin', '#8a9a68', { grime: 28, seed: 63, veins: 'rgba(60,40,30,0.6)', blood: 3 }) });
  body(B, s, { torsoZones: [[0, 90, orange]], upper: rust, fore: rust, leg: rust });
  boots(B, s, '#2a2018', 12, 26);
  const cy = B.S.pos('chest').y, by = B.S.pos('belly').y, hy = B.S.pos('head').y, hz = B.S.pos('head').z;
  const steel = m('#9aa2b4', { metalness: 0.8, roughness: 0.3 }), vine = m('#3aa040', { roughness: 0.9 });
  // the hopper: a gaping chest mouth with blade teeth
  prop(B, 'chest', G.box(36, 30, 6), X.dark, [0, cy + 4, 29]);
  prop(B, 'chest', G.box(44, 4, 12), steel, [0, cy + 22, 32], [-0.3, 0, 0]);
  for (let i = 0; i < 7; i++) prop(B, 'chest', G.cone(2.2, 9, 4), steel, [(i - 3) * 5.4, cy + 18, 34], [Math.PI, 0, 0]);
  prop(B, 'belly', G.box(44, 4, 10), steel, [0, by + 6, 31], [0.3, 0, 0]);
  for (let i = 0; i < 7; i++) prop(B, 'belly', G.cone(2.2, 9, 4), steel, [(i - 3) * 5.4, by + 10, 33]);
  prop(B, 'chest', G.box(30, 4, 2), X.glow, [0, cy + 4, 33]);
  // the chute on his back, spitting chips
  prop(B, 'chest', G.cyl(8, 11, 38, 10), steel, [0, cy + 14, -32], [0.7, 0, 0]);
  prop(B, 'chest', G.box(22, 5, 4), steel, [0, cy + 36, -44]);
  // tool arms: a hedge trimmer on the right, a rake on the left
  const rh = B.S.pos('handR'), lh = B.S.pos('handL');
  prop(B, 'handR', G.box(8, 7, 14), X.dark, [rh.x, rh.y, rh.z]);
  prop(B, 'handR', G.box(6, 5, 62), steel, [rh.x, rh.y - 2, rh.z + 36]);
  for (let i = 0; i < 9; i++) for (const sy of [-1, 1]) prop(B, 'handR', G.cone(2.2, 7, 4), steel, [rh.x, rh.y - 2 + sy * 4.5, rh.z + 12 + i * 6.4], [sy > 0 ? 0 : Math.PI, 0, 0]);
  prop(B, 'handL', G.cyl(1.8, 1.8, 56, 8), m('#6a4a2a'), [lh.x, lh.y + 4, lh.z + 14], [Math.PI / 2, 0, 0]);
  prop(B, 'handL', G.box(34, 3, 3), steel, [lh.x, lh.y + 4, lh.z + 42]);
  for (let i = 0; i < 7; i++) prop(B, 'handL', G.cone(1.5, 12, 4), steel, [lh.x + (i - 3) * 5, lh.y + 4, lh.z + 50], [Math.PI / 2, 0, 0]);
  // vines and hose wrapped round everything, a manager's head with a hard hat
  for (let i = 0; i < 6; i++) prop(B, 'belly', G.tor(24 + (i % 2) * 3, 1.8, Math.PI * 1.4, 12), vine, [0, by - 2 + i * 8, 0], [Math.PI / 2, 0, i * 1.1]);
  prop(B, 'chest', G.tor(14, 3, Math.PI * 2, 12), m('#d8c030'), [-24, cy + 10, 0], [0, Math.PI / 2, 0]);
  prop(B, 'head', G.sph(13, 14), m('#8a9a68', { roughness: 0.6 }), [0, hy + 5, hz], [0, 0, 0], [1, 1.05, 1]);
  prop(B, 'head', G.sph(14.5, 12), m('#ffa020'), [0, hy + 11, hz - 1], [0, 0, 0], [1, 0.6, 1]);
  prop(B, 'head', G.box(24, 2, 12), m('#ffa020'), [0, hy + 8, hz + 13]);
  for (const sx of [-1, 1]) prop(B, 'head', G.sph(2.5, 8), m('#80ff40', { emissive: '#60ff30', emissiveIntensity: 2.4 }), [sx * 5, hy + 5, hz + 11.5], [0, 0, 0], [1.2, 0.8, 0.6]);
  prop(B, 'jaw', G.box(14, 3, 4), m('#f4ecd8'), [0, hy - 5, hz + 9]);
  shoulderPads(B, s, X.dark, 0.9);
  finishBoss(B, 'mulchmaw');
  return B;
}

function finishBoss(B, id) {
  B.rig.traverse((o) => { o.frustumCulled = false; if (o.isMesh) { o.castShadow = false; } });
  const row = BOSS_ROSTER.find((b) => b.id === id);
  const k = row ? row.scale / 2.6 : 1;
  B.rig.scale.setScalar(k);
  B.root.userData.rig = B.r;
}

const BUILDERS = { butcher, bowler, projectionist, maxrep, santa, mulchmaw };
export const BUILT_BOSS_MODELS = Object.keys(BUILDERS);

// Returns { root, mats } shaped like models.js buildBoss expects, or null for an unknown id.
export function buildBossRig(id) {
  const f = BUILDERS[id];
  if (!f) return null;
  const B = f();
  return { root: B.root, mats: B.mats, r: B.r };
}
