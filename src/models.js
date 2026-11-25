// Procedural models for things the CC0 KayKit packs don't cover: the Deep-Fry Butcher boss,
// pickups, projectiles, the exit gate, plus shared glow/exit-pad textures.

import * as THREE from 'three';
import { buildBossRig } from './bossModels.js';
import { keep } from './gpu.js';

// ---------- shared helpers ----------

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, keep(make())); // (cached forever: never disposed with a level)
  return geoCache.get(key);
}
const G = {
  box: (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  sphere: (r, s = 8) => geo(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(4, s - 2))),
  cyl: (rt, rb, h, s = 8) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r, h, s = 8) => geo(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  torus: (r, t, arc = Math.PI * 2) => geo(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 6, 14, arc)),
  oct: (r) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r)),
  ico: (r) => geo(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0)),
  dodec: (r) => geo(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  wing: () => geo('wing', () => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0, 0, 1, 0.4, -0.3, 0.9, -0.5, -0.1, 0, 0, 0, 0.9, -0.5, -0.1, 0.5, -0.6, 0.1]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }),
};

// Every model gets its own materials so hit-flashes and fades are per entity.
function makeMats(flat = true) {
  const list = [];
  const m = (color, opts = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: flat, roughness: 0.75, metalness: 0.05, ...opts });
    list.push(mat);
    return mat;
  };
  return { m, list };
}

function part(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function finish(root, mats, extra = {}) {
  root.userData.mats = mats.list;
  Object.assign(root.userData, extra);
  return root;
}

// ---------- procedural textures ----------

function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

function noise(ctx, size, alpha) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * alpha;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function capTexture(base) {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
    noise(ctx, s, 22);
  });
}

// Stone block with obvious cracks: the tell for a breakable wall hiding a secret.
export function crackedTexture(base) {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) ctx.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28);
    ctx.strokeStyle = 'rgba(10,6,2,0.85)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      let x = 20 + Math.random() * 88, y = 0;
      ctx.moveTo(x, y);
      while (y < s) { x += (Math.random() - 0.5) * 30; y += 10 + Math.random() * 14; ctx.lineTo(x, y); if (Math.random() < 0.3) { ctx.moveTo(x, y); } }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,240,200,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    noise(ctx, s, 26);
  });
}

let grassTex = null;
export function grassTexture() {
  if (grassTex) return grassTex;
  grassTex = canvasTex(64, (ctx, s) => {
    ctx.fillStyle = '#4a7a30';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = ['#5a8a38', '#3e6a28', '#6a9a40', '#4f7f2c'][i % 4];
      const x = Math.random() * s, y = Math.random() * s;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 3);
    }
    for (let i = 0; i < 5; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#e8d870' : '#d8e0f0'; ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });
  grassTex.magFilter = THREE.NearestFilter;
  return grassTex;
}

// Molten lava, or (palette 'souls') pools of pale blue soul fire.
const LAVA_PALETTES = {
  lava: ['#c02808', 'rgba(255,220,80,0.9)', 'rgba(90,20,6,0.8)'],
  souls: ['#24168a', 'rgba(150,210,255,0.9)', 'rgba(16,8,50,0.8)'],
};
const lavaTex = {};
export function lavaTexture(kind = 'lava') {
  if (lavaTex[kind]) return lavaTex[kind];
  const [base, bright, dark] = LAVA_PALETTES[kind] || LAVA_PALETTES.lava;
  lavaTex[kind] = canvasTex(128, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // bright molten veins between darker cooling crust
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 6 + Math.random() * 16;
      for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
        const gr = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, i % 3 ? bright : dark);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    noise(ctx, s, 20);
  });
  return lavaTex[kind];
}

// A cobweb for dungeon corners.
let webTex = null;
export function webTexture() {
  if (webTex) return webTex;
  webTex = keep(canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(235,235,240,0.85)';
    ctx.lineWidth = 1.2;
    const c = s / 2;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); ctx.stroke(); }
    for (let r = 8; r < c; r += 9) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 2; const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; if (i) ctx.quadraticCurveTo(c + Math.cos(a - 0.4) * r * 0.9, c + Math.sin(a - 0.4) * r * 0.9, x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }, false));
  return webTex;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = keep(canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, false));
  return glowTex;
}

let swirlTex = null;
export function swirlTexture() { // the emergency-exit pad: a green glow ringed with hazard chevrons
  if (swirlTex) return swirlTex;
  swirlTex = keep(canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
    ctx.translate(s / 2, s / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
    g.addColorStop(0, 'rgba(120,255,170,0.9)'); g.addColorStop(0.6, 'rgba(40,200,110,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) { // alternating green / dark slashes around the rim
      ctx.fillStyle = i % 2 ? 'rgba(220,255,230,0.85)' : 'rgba(10,60,30,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.46, i * Math.PI / 6, (i + 1) * Math.PI / 6); ctx.arc(0, 0, s * 0.36, (i + 1) * Math.PI / 6, i * Math.PI / 6, true); ctx.fill();
    }
  }, false));
  return swirlTex;
}

export function glowSprite(color, size, opacity = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.set(size, size, 1);
  return s;
}

// ---------- bosses ----------

// The Butcher stands ~115 units tall (about 2.5x a survivor); this is the on-field scale applied
// on top of that. The renderer reads it from root.userData.bossScale and never resets it.
export const BOSS_SCALE = 1.05;

export function buildBoss(model, color, hornColor) {
  // the skinned, lofted bosses (bossModels.js); the old primitive builds below remain as a fallback
  try {
    const built = buildBossRig(model);
    if (built) {
      built.root.userData.mats = built.mats;
      built.root.userData.bossScale = BOSS_SCALE;
      built.root.userData.kind = 'boss';
      built.root.userData.model = model;
      return built.root;
    }
  } catch (err) { console.error('boss model failed, using fallback', err); }
  const mats = makeMats(false);
  const { m } = mats;
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const skin = m(color);
  const belly = m(shade(color, 0.15));
  const horn = m(hornColor);
  const eyeM = m('#ffe040', { emissive: '#ffcc00', emissiveIntensity: 2 });
  const r = { root, rig, boss: true, wings: [], heads: [] };
  const wingM = m(shade(color, -0.12), { side: THREE.DoubleSide });
  const addWings = (y, span, z = -6) => {
    for (const s of [-1, 1]) {
      const wg = new THREE.Mesh(G.wing(), wingM);
      wg.scale.set(s * span, span * 0.8, span * 0.6);
      wg.position.set(s * 10, y, z);
      wg.castShadow = true;
      rig.add(wg);
      r.wings.push(wg);
    }
  };
  const legs = (y, spread, len, thick) => {
    r.legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const lg = pivot(rig, sx * spread, y, sz * spread * 1.1);
      part(lg, G.box(thick, len, thick), skin, 0, -len / 2, 0);
      part(lg, G.box(thick * 1.2, 3, thick * 1.5), horn, 0, -len + 1, 2);
      r.legs.push(lg);
    }
  };
  const head = (parent, x, y, z, s, kind) => {
    const h = pivot(parent, x, y, z);
    h.scale.setScalar(s);
    if (kind === 'snake') {
      part(h, G.box(7, 6, 12), m('#4a7a2a'), 0, 0, 3);
      part(h, G.box(1.5, 1.5, 1), eyeM, -2.5, 2, 8.5, false);
      part(h, G.box(1.5, 1.5, 1), eyeM, 2.5, 2, 8.5, false);
    } else if (kind === 'goat') {
      part(h, G.box(8, 9, 11), m('#c8c0b0'), 0, 0, 2);
      for (const sx of [-1, 1]) part(h, G.torus(4, 1.3, Math.PI), horn, sx * 4, 5, -1).rotation.y = Math.PI / 2;
      part(h, G.box(1.6, 1.6, 1), eyeM, -2.5, 1.5, 7.5, false);
      part(h, G.box(1.6, 1.6, 1), eyeM, 2.5, 1.5, 7.5, false);
    } else {
      part(h, G.box(12, 10, 14), skin, 0, 0, 2);
      const jaw = pivot(h, 0, -4, 0);
      part(jaw, G.box(10, 3, 13), belly, 0, -1.5, 3);
      for (let i = -1; i <= 1; i++) part(h, G.cone(0.9, 3, 4), m('#f0f0e0'), i * 3, -5, 8.5).rotation.x = Math.PI;
      part(h, G.box(2.4, 2, 1), eyeM, -3.5, 2.5, 9, false);
      part(h, G.box(2.4, 2, 1), eyeM, 3.5, 2.5, 9, false);
      for (const sx of [-1, 1]) part(h, G.cone(2, 11, 5), horn, sx * 4, 7, -4).rotation.x = -0.9;
      if (kind === 'lion') part(h, G.cyl(10, 10, 6, 10), m('#7a4a1a'), 0, 0, -4).rotation.x = Math.PI / 2;
      h.userData.jaw = jaw;
    }
    r.heads.push(h);
    return h;
  };

  if (model === 'chimera') {
    part(rig, G.sphere(16, 10), skin, 0, 30, 0).scale.set(1.1, 0.85, 1.6);
    legs(24, 12, 22, 9);
    head(rig, 0, 38, 24, 1.4, 'lion');
    head(rig, -14, 46, 14, 1.1, 'goat');
    const snakeNeck = pivot(rig, 0, 34, -22);
    for (let i = 0; i < 5; i++) part(snakeNeck, G.cyl(3, 3.5, 8, 6), m('#4a7a2a'), 0, i * 6, -i * 2);
    head(snakeNeck, 0, 32, -6, 1.2, 'snake');
    r.tail = snakeNeck;
    addWings(42, 36);
  } else if (model === 'fiend') {
    part(rig, G.sphere(22, 10), skin, 0, 32, 0).scale.set(1, 1.05, 0.95);
    part(rig, G.sphere(16, 8), m('#8aaa4a'), 0, 28, 8).scale.set(1, 0.9, 0.7);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const t = pivot(rig, Math.cos(a) * 16, 14, Math.sin(a) * 16);
      t.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      for (let k = 0; k < 3; k++) part(t, G.cyl(3 - k * 0.7, 3.6 - k * 0.7, 8, 6), skin, 0, -k * 7, 0);
      (r.legs ||= []).push(t);
    }
    head(rig, 0, 56, 6, 1.3, 'dragon');
    for (let i = 0; i < 6; i++) part(rig, G.sphere(3.5, 6), m('#c8e070', { emissive: '#90c020', emissiveIntensity: 0.6 }), Math.cos(i) * 18, 30 + Math.sin(i * 2) * 10, Math.sin(i) * 18);
    addWings(48, 30);
  } else if (model === 'butcher') {
    // THE DEEP-FRY BUTCHER: ONE hulking food-court mascot. Cream greasy apron, charcoal
    // trousers, pig-mascot head under a paper hat, steel cleaver and a bubbling fry basket.
    // Deliberately NOT red: the minions are red, he must read as a different, bigger thing.
    const apron = m('#f6f0dc'), stain = m('#c8a050'), steel = m('#dfe5f2', { metalness: 0.35, roughness: 0.3, emissive: '#404858', emissiveIntensity: 0.55 });
    const cloth = m('#2c3038'), hide = m('#e6a8a0'), dark = m('#241c18');
    const glow = m('#ffa020', { emissive: '#ff8010', emissiveIntensity: 1.8 });
    // legs: two thick trousered pillars with boots
    r.legs = [];
    for (const sx of [-1, 1]) {
      const lg = pivot(rig, sx * 11, 30, 0);
      part(lg, G.box(15, 30, 16), cloth, 0, -15, 0);
      part(lg, G.box(17, 7, 24), dark, 0, -29, 4);
      r.legs.push(lg);
    }
    // huge barrel torso + apron
    part(rig, G.box(52, 36, 34), cloth, 0, 48, 0);
    part(rig, G.box(44, 46, 6), apron, 0, 44, 17);
    part(rig, G.box(44, 5, 36), apron, 0, 66, 0).scale.x = 1.05;
    part(rig, G.box(10, 8, 1.5), stain, -10, 52, 20.5);
    part(rig, G.box(14, 6, 1.5), stain, 8, 36, 20.5);
    part(rig, G.box(6, 14, 1.5), stain, 14, 54, 20.5);
    part(rig, G.box(50, 3, 3), dark, 0, 56, 0);
    part(rig, G.cyl(14, 14, 20, 10), cloth, 0, 70, -6).scale.set(1.4, 1, 0.9);
    // hulking shoulders
    for (const sx of [-1, 1]) part(rig, G.sphere(11, 10), cloth, sx * 30, 64, 0);
    // pig-mascot head, grinning, under a paper hat
    const hd = pivot(rig, 0, 82, 3);
    part(hd, G.sphere(15, 12), hide, 0, 0, 0).scale.set(1.15, 1, 1.05);
    part(hd, G.cyl(6.5, 7.5, 7, 10), hide, 0, -3, 15).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {
      part(hd, G.sphere(1.3, 6), dark, sx * 2.6, -3, 19, false);
      part(hd, G.cone(5, 11, 4), hide, sx * 12, 12, -2).rotation.z = -sx * 0.6; // ears
      part(hd, G.sphere(3.4, 8), m('#ffffff', { emissive: '#fff070', emissiveIntensity: 1.6 }), sx * 6.5, 5, 12, false);
      part(hd, G.sphere(1.4, 6), dark, sx * 6.5, 5, 14.6, false);
      part(hd, G.cone(1.8, 6, 5), m('#f8f4e0'), sx * 7, -8, 13, false).rotation.x = Math.PI; // tusks
    }
    part(hd, G.cyl(10, 12, 14, 12), apron, 0, 19, 0);                       // paper hat
    part(hd, G.sphere(11, 10), apron, 0, 28, 0).scale.set(1.15, 0.8, 1.15);
    const jaw = pivot(hd, 0, -8, 0);
    part(jaw, G.box(20, 3.5, 11), m('#2a0a0a'), 0, -1, 7);
    for (let i = -4; i <= 4; i++) part(jaw, G.box(1.8, 3.5, 1.2), m('#f8f4e0'), i * 2.3, 1.5, 13);
    hd.userData.jaw = jaw;
    r.heads.push(hd);
    // gore: rotting patches and a torn-open cheek on the pig face, stitches and a bad eye
    const rot = m('#7a8a62'), wound = m('#5a0c0c', { roughness: 0.35 }), bone2 = m('#e8e0c8'), stitch = m('#1a1410');
    part(hd, G.sphere(7, 8), rot, -9, 4, 10).scale.set(1, 0.9, 0.5);
    part(hd, G.sphere(6, 8), rot, 10, 9, 8).scale.set(1, 0.9, 0.5);
    part(hd, G.sphere(6, 8), wound, 11, -3, 12.5).scale.set(1, 0.9, 0.45);       // chunk bitten out of the cheek
    part(hd, G.cone(1.2, 5, 4), bone2, 12, -4, 17).rotation.x = Math.PI / 2;     // jaw bone showing
    part(hd, G.box(1.2, 20, 1.2), stitch, -3, 8, 15.5).rotation.z = 0.35;        // stitched seam across the face
    for (let i = 0; i < 5; i++) part(hd, G.box(4, 1, 1), stitch, -3 + (i - 2) * 1.9, 8 + (i - 2) * 3.5, 15.8).rotation.z = 0.6;
    part(hd, G.sphere(3.6, 8), m('#c8c8a8'), -6.5, 5, 12.4, false);             // a dead, clouded left eye
    part(hd, G.sphere(4.2, 6), wound, 3, 12, 11).scale.set(1.4, 0.4, 0.8);       // scalp torn open under the hat
    // blood smeared down the snout and chin
    part(hd, G.box(10, 6, 1.5), m('#7a1210'), 0, -8, 21);
    // the apron: soaked in old blood, handprints, a torn-open flank and strung viscera
    const dried = m('#6a2418'), fresh = m('#8a1410', { roughness: 0.3 });
    part(rig, G.box(22, 14, 1.5), dried, -6, 46, 20.6).rotation.z = 0.2;
    part(rig, G.box(14, 24, 1.5), dried, 12, 38, 20.7);
    part(rig, G.box(8, 4, 1.5), fresh, -14, 36, 20.9);
    for (let i = 0; i < 4; i++) part(rig, G.box(2.4, 8 + i * 3, 1.5), fresh, -12 + i * 6, 56 - i * 2, 21);   // blood runs
    part(rig, G.box(14, 14, 3), wound, 24, 40, 12);                              // a torn-open flank...
    for (let i = 0; i < 3; i++) part(rig, G.box(1.6, 10, 1.4), bone2, 24, 40, 13.8).position.y = 35 + i * 5;   // ...ribs
    for (let i = 0; i < 3; i++) part(rig, G.cyl(1.5, 1.5, 12, 5), m('#c07070'), 22 + i * 2, 28 - i * 2, 15).rotation.z = 0.2;
    part(rig, G.box(6, 3, 1.4), bone2, 14, 56, 20.8);                              // a stuck tooth
    for (let i = 0; i < 6; i++) part(rig, G.box(1.1, 8, 1.1), stitch, -22 + i * 1.8, 40 - i * 0.5, 20.8).rotation.z = 0.5;       // stitched belly seam
    // meat hooks on chains off his belt, a slab swinging from one
    for (const hx of [-12, 8]) {
      part(rig, G.cyl(0.6, 0.6, 14, 4), m('#6a6e78', { metalness: 0.7 }), hx, 28, 19, false);
      part(rig, G.cone(2, 5, 5), m('#c8ccd8', { metalness: 0.8 }), hx, 20, 19, false).rotation.x = Math.PI;
    }
    part(rig, G.box(8, 11, 4), m('#a83a3a'), -12, 14, 19, false);
    part(rig, G.box(8, 3, 4.2), m('#e8d8c0'), -12, 18, 19, false);
    // the cleaver arm swings from the shoulder
    const arm = pivot(rig, 34, 66, 4);
    part(arm, G.cyl(6, 7, 28, 8), cloth, 0, -14, 6).rotation.x = -0.5;
    part(arm, G.sphere(6.5, 8), hide, 0, -28, 16);
    const cl = pivot(arm, 0, -28, 18);
    // a hefty cleaver, blade turned broadside to the camera (it was edge-on and easy to miss):
    // thick steel slab, dark spine, blood run down the edge, nicks and a hook through the handle.
    cl.rotation.z = -0.35;
    const blood = m('#7a1210', { roughness: 0.3 }), rust = m('#6a4a2a');
    part(cl, G.box(5, 5, 26), dark, 0, 0, 4);                       // handle (points forward)
    part(cl, G.box(6, 6, 4), m('#8a8e9a', { metalness: 0.7 }), 0, 0, 16);   // pommel
    part(cl, G.box(30, 38, 4.5), steel, 2, 22, 8);                  // the blade
    part(cl, G.box(30, 4, 6), m('#9aa2b4', { metalness: 0.8 }), 2, 41.5, 8); // top spine
    part(cl, G.box(3, 38, 6), m('#9aa2b4', { metalness: 0.8 }), -12.5, 22, 8);    // spine edge
    part(cl, G.box(31, 3, 5.2), m('#ffffff', { metalness: 0.9, roughness: 0.15 }), 2, 3, 8); // the bright cutting edge
    part(cl, G.box(22, 10, 5), blood, 4, 12, 8);                    // blood on the blade
    part(cl, G.box(5, 18, 5), blood, 8, 7, 8);
    part(cl, G.box(4, 10, 5), blood, -4, 4, 8);
    for (let i = 0; i < 3; i++) part(cl, G.sphere(2, 5), blood, 4 + i * 6, -2 - i * 2, 8, false); // drips
    part(cl, G.box(7, 7, 6), dark, -6, 30, 8.5);                    // hang hole
    part(cl, G.box(4, 4, 6.5), m('#241c18'), -6, 30, 8.6);
    part(cl, G.box(3, 3, 5), rust, 14, 38, 8);
    // blood up the arm
    part(arm, G.cyl(6.4, 7.4, 8, 8), blood, 0, -20, 6).rotation.x = -0.5;
    r.arm = arm; r.cleaver = cl;
    // the other hand carries a big bubbling fry basket
    const bk = pivot(rig, -34, 62, 6);
    part(bk, G.cyl(5.5, 6.5, 24, 8), cloth, 0, -12, 6).rotation.x = -0.5;
    part(bk, G.sphere(6, 8), hide, 0, -24, 14);
    part(bk, G.cyl(13, 10, 14, 12), m('#2a2a34', { metalness: 0.6 }), 0, -28, 18);
    part(bk, G.cyl(12, 12, 1.5, 12), glow, 0, -21, 18, false);
    part(bk, G.box(3, 3, 22), dark, 0, -22, 34);
    for (let i = 0; i < 4; i++) part(bk, G.sphere(2.5, 6), glow, -6 + i * 4, -19 + (i % 2) * 2, 18 + (i % 3 - 1) * 4, false);
    // what's frying in it: meat chunks, a bone, a rib, dangling gut and a drip of fat
    const meat = m('#b04a4a'), meat2 = m('#6a1818'), bone = m('#e8e0c8');
    for (let i = 0; i < 6; i++) part(bk, G.box(4.5, 3.5, 4.5), i % 2 ? meat : meat2, -7 + (i % 3) * 7, -19 + (i % 2) * 2.5, 13 + (i % 2) * 8, false).rotation.set(i, i * 2, i * 0.5);
    part(bk, G.cyl(1.2, 1.4, 14, 5), bone, 4, -17, 20, false).rotation.set(0.3, 0, 0.7);
    part(bk, G.sphere(2.4, 6), bone, 10, -12, 22, false);
    for (let i = 0; i < 3; i++) part(bk, G.cyl(1.4, 1.4, 12 - i * 2, 5), m('#c07070'), -8 + i * 3, -34 - i, 24 + i * 3, false); // gut strands hanging over the rim
    for (let i = 0; i < 3; i++) part(bk, G.sphere(1.6, 5), m('#7a1210'), -4 + i * 4, -40, 26, false);
    // dripping grease down the apron
    for (let i = 0; i < 5; i++) part(rig, G.sphere(2.2, 5), glow, -16 + i * 8, 62 - (i % 2) * 12, 21, false);
  }
  root.userData.rig = r;
  root.userData.bossScale = BOSS_SCALE;
  return finish(root, mats, { kind: 'boss', model });
}

// ---------- items ----------

export function buildItem(type, sub, powerColor) {
  const mats = makeMats();
  const { m } = mats;
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  let glow = null;
  switch (type) {
    case 'food': {
      if (sub === 'soda') { // Jumbo Soda: a giant striped cup with a straw
        part(spin, G.cyl(6, 4.4, 13, 12), m('#ffffff'), 0, 8, 0);
        part(spin, G.cyl(6.1, 4.5, 4, 12), m('#e02a3a', { emissive: '#a01020', emissiveIntensity: 0.5 }), 0, 11, 0);
        part(spin, G.cyl(6.4, 6.4, 1.4, 12), m('#30c8ff', { emissive: '#1090d0', emissiveIntensity: 0.8 }), 0, 15, 0);
        part(spin, G.cyl(0.6, 0.6, 9, 5), m('#ff5ad0'), 2, 19, 0).rotation.z = -0.25;
        glow = '#30c8ff';
      } else { // Floor Pizza: a slice on the tile
        part(spin, G.box(16, 1.2, 14), m('#f4e4b8'), 0, 1, 0);
        part(spin, G.cone(9, 1.8, 3), m('#ffb030'), 0, 2.2, 0).rotation.y = 0.5;
        for (const [x, z] of [[-2, 1], [2, -1], [0, 3]]) part(spin, G.cyl(1.5, 1.5, 0.6, 8), m('#c02a1a'), x, 3.2, z);
        glow = '#ffb030';
      }
      break;
    }
    case 'gold': // a rubber-banded stack of cash
      for (let i = 0; i < 3; i++) part(spin, G.box(10, 2.4, 5), m('#6ac870', { emissive: '#208030', emissiveIntensity: 0.4 }), (i - 1) * 1.2, 1.5 + i * 2.5, (i - 1) * 0.8);
      part(spin, G.box(2, 8, 5.4), m('#f0e0a0'), 0, 4.5, 0);
      glow = '#6ac870';
      break;
    case 'propane': { // an explosive propane tank: shoot it
      part(spin, G.cyl(6, 6, 16, 12), m('#e8eaf0', { metalness: 0.4, roughness: 0.4 }), 0, 10, 0);
      part(spin, G.sphere(6, 10), m('#e8eaf0', { metalness: 0.4, roughness: 0.4 }), 0, 18, 0).scale.set(1, 0.6, 1);
      part(spin, G.cyl(6.2, 6.2, 3, 12), m('#e02a1a', { emissive: '#a01008', emissiveIntensity: 0.7 }), 0, 9, 0);
      part(spin, G.cyl(1.6, 1.6, 3, 6), m('#3a3a40'), 0, 22, 0);
      glow = '#ff4020';
      break;
    }
    case 'armorcrate': { // padded armor and ammo
      part(spin, G.box(14, 10, 10), m('#3a5a8a'), 0, 5, 0);
      part(spin, G.box(4, 11, 10.5), m('#ffffff'), 0, 5, 0);
      part(spin, G.box(14.5, 4, 10.5), m('#ffffff'), 0, 5, 0);
      glow = '#60a0ff';
      break;
    }
    case 'gem': { // stolen jewelry: a gold ring with a big stone
      const gold = m('#ffd040', { metalness: 0.9, roughness: 0.2, emissive: '#806000', emissiveIntensity: 0.4 });
      const ring = part(spin, G.torus(5, 1.3), gold, 0, 7, 0);
      ring.rotation.x = Math.PI / 2;
      part(spin, G.oct(3.2), m('#50d0ff', { emissive: '#2080ff', emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.1 }), 0, 13, 0).scale.set(1, 1.3, 1);
      glow = '#50d0ff';
      break;
    }
    case 'key': { // a plastic keycard with a magstripe and a lanyard hole
      part(spin, G.box(14, 0.8, 9), m('#f2f2f4', { roughness: 0.4 }), 0, 9, 0);
      part(spin, G.box(14.2, 0.9, 2.4), m('#2a3a50'), 0, 9, 2.5);
      part(spin, G.box(5, 0.9, 3), m('#2ac060', { emissive: '#10a040', emissiveIntensity: 0.8 }), -3.5, 9, -1.8);
      part(spin, G.cyl(1, 1, 1, 8), m('#7a7a86'), 5.2, 9, -2.8);
      glow = '#40ff80';
      break;
    }
    case 'potion': { // a flashbang: grey can, black grip band, spoon lever and ring pin
      const can = m('#8a8e98', { metalness: 0.6, roughness: 0.4 });
      part(spin, G.cyl(3.6, 3.6, 13, 12), can, 0, 8, 0);
      part(spin, G.cyl(3.7, 3.7, 3, 12), m('#202228'), 0, 7, 0);
      part(spin, G.cyl(3.7, 3.7, 1.6, 12), m('#e0c020', { emissive: '#806000', emissiveIntensity: 0.5 }), 0, 11.5, 0);
      part(spin, G.cyl(3.2, 3.6, 2, 12), can, 0, 15.5, 0);
      part(spin, G.box(1.2, 11, 2), m('#b8bcc6', { metalness: 0.7 }), 4.3, 11, 0);
      part(spin, G.torus(1.6, 0.35), m('#d8d8e0', { metalness: 0.8 }), -3.4, 17, 0);
      glow = '#fff0b0';
      break;
    }
    case 'amulet': { // a mall power-up: a security badge in the power's color
      const c = powerColor || '#ffffff';
      part(spin, G.cyl(6.5, 6.5, 1.4, 6), m('#c8ccd8', { metalness: 0.8, roughness: 0.3 }), 0, 10, 0).rotation.x = Math.PI / 2;
      part(spin, G.cyl(4.6, 4.6, 1.6, 6), m(c, { emissive: c, emissiveIntensity: 1.4 }), 0, 10, 0.2).rotation.x = Math.PI / 2;
      part(spin, G.box(5, 3, 1.2), m('#202228'), 0, 18, 0);
      glow = c;
      break;
    }
    case 'rune': { // a wall keypad with a blinking light (not placed in the mall; kept for old saves)
      part(spin, G.box(10, 16, 4), m('#3a3a44'), 0, 8, 0);
      part(spin, G.box(6, 4, 1), m('#40ff80', { emissive: '#20ff60', emissiveIntensity: 1.5 }), 0, 12, 2.2, false);
      glow = '#40ff80';
      break;
    }
  }
  if (glow) {
    const s = glowSprite(glow, 26, 0.45);
    s.position.y = 9;
    root.add(s);
  }
  spin.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return finish(root, mats, { kind: 'item', spin, spins: !['food', 'barrel', 'gold'].includes(type) });
}

// ---------- level dressing ----------

export function buildExit(sealed) {
  const root = new THREE.Group();
  const mats = makeMats();
  part(root, G.cyl(17, 18, 3, 16), mats.m('#4a4a54'), 0, 1.5, 0).receiveShadow = true;
  const ring = part(root, G.torus(15, 2, Math.PI * 2), mats.m('#b8bcc8', { metalness: 0.8, roughness: 0.3 }), 0, 3.2, 0, false);
  ring.rotation.x = Math.PI / 2;
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ map: swirlTexture(), transparent: true, opacity: sealed ? 0 : 1, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 3.4;
  root.add(disk);
  const halo = glowSprite('#50ff90', 70, sealed ? 0 : 0.6);
  halo.position.y = 10;
  root.add(halo);
  const bars = new THREE.Group();
  const iron = mats.m('#9aa0ac', { metalness: 0.7 }); // a rolled-down security shutter
  for (let i = -3; i <= 3; i++) part(bars, G.box(28, 2.2, 3), iron, 0, 4.5 + (i + 3) * 0.1, i * 4, false);
  bars.visible = sealed;
  root.add(bars);
  return finish(root, mats, { kind: 'exit', disk, halo, bars });
}

export function buildProjectile(kind) {
  const mats = makeMats();
  const { m } = mats;
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  let glow = null, size = 24;
  switch (kind) {
    case 'wrench':
      part(spin, G.box(14, 3, 1.6), m('#c8ccd8', { metalness: 0.8, roughness: 0.3 }), 0, 0, 0, false);
      part(spin, G.torus(3, 1.2, Math.PI * 1.6), m('#c8ccd8', { metalness: 0.8 }), 8, 0, 0, false);
      break;
    case 'pellet':
      part(spin, G.ico(2.2), m('#fff0a0', { emissive: '#ffc020', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#ffd040'; size = 18;
      break;
    case 'deck': // a thrown skateboard deck
      part(spin, G.box(14, 1.4, 5), m('#ff5ad0', { emissive: '#ff20a0', emissiveIntensity: 0.6 }), 0, 0, 0, false);
      part(spin, G.box(10, 0.5, 3.6), m('#202030'), 0, 0.9, 0, false);
      glow = '#ff5ad0'; size = 22;
      break;
    case 'spray': // flaming hairspray
      part(spin, G.ico(4.5), m('#ffd060', { emissive: '#ff4090', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#ff40a0'; size = 40;
      break;
    case 'axe':
      part(spin, G.cyl(0.8, 0.8, 14, 5), m('#6a4424'), 0, 0, 0, false).rotation.z = Math.PI / 2;
      part(spin, G.box(6, 8, 1.4), m('#e0e0ea', { metalness: 0.8, roughness: 0.2 }), 6, 0, 0, false);
      break;
    case 'sword':
      part(spin, G.box(16, 2.4, 1), m('#e8e8f8', { metalness: 0.8, roughness: 0.2, emissive: '#4060a0', emissiveIntensity: 0.5 }), 2, 0, 0, false);
      part(spin, G.box(1.6, 7, 1.6), m('#d8b040'), -6, 0, 0, false);
      glow = '#a0c0ff'; size = 22;
      break;
    case 'arrow':
      part(spin, G.cyl(0.5, 0.5, 18, 4), m('#c8a070'), 0, 0, 0, false).rotation.x = Math.PI / 2;
      part(spin, G.cone(1.5, 4, 4), m('#d0d0d8', { metalness: 0.8 }), 0, 0, 10, false).rotation.x = Math.PI / 2;
      part(spin, G.box(0.3, 3, 4), m('#e04030'), 0, 0, -8, false);
      break;
    case 'fireball':
      part(spin, G.ico(5), m('#ffd060', { emissive: '#ff9020', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#ff8a20'; size = 46;
      break;
    case 'efire':
      part(spin, G.ico(4.5), m('#ff6030', { emissive: '#ff3010', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#ff3010'; size = 40;
      break;
    case 'dagger':
      part(spin, G.box(10, 2, 1), m('#e8e8f0', { metalness: 0.8, roughness: 0.2 }), 2, 0, 0, false);
      part(spin, G.box(1.4, 5, 1.4), m('#d8b040'), -4, 0, 0, false);
      break;
    case 'spark':
      part(spin, G.oct(4), m('#f0a0ff', { emissive: '#d040ff', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#d040ff'; size = 40;
      break;
    case 'bolt':
      part(spin, G.oct(4), m('#ff80ff', { emissive: '#e040ff', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#d040ff'; size = 36;
      break;
    case 'lob':
      part(spin, G.dodec(4.5), m('#7a6a5a'), 0, 0, 0, true);
      break;
    case 'bomb': // a black iron bomb with a lit fuse
      part(spin, G.ico(5), m('#24222a', { metalness: 0.6, roughness: 0.4 }), 0, 0, 0, true);
      part(spin, G.cyl(0.6, 0.6, 4, 4), m('#c8a060'), 0, 6, 0, false);
      glow = '#ffb040'; size = 22;
      break;
    case 'flask': // a spoiled takeout tub, lobbed
      part(spin, G.cyl(4.4, 3.2, 5, 8), m('#e8e0c8'), 0, 0, 0, false);
      part(spin, G.ico(3.6), m('#80d030', { emissive: '#50a010', emissiveIntensity: 1.1 }), 0, 3.5, 0, false);
      glow = '#60ff30'; size = 30;
      break;
    case 'meteor': // a falling ball of fire
      part(spin, G.ico(9), m('#ffb040', { emissive: '#ff6010', emissiveIntensity: 3 }), 0, 0, 0, false);
      part(spin, G.ico(6), m('#5a2a10'), 4, 3, 2, false);
      glow = '#ff6a10'; size = 90;
      break;
    case 'quake': // nothing to see until it lands: the marker on the ground is the warning
      break;
    case 'gbolt':
      part(spin, G.oct(4), m('#a0ff80', { emissive: '#40ff40', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#40ff60'; size = 38;
      break;
    case 'hbolt':
      part(spin, G.oct(4.5), m('#ff6080', { emissive: '#ff1040', emissiveIntensity: 3 }), 0, 0, 0, false);
      glow = '#ff2050'; size = 42;
      break;
  }
  if (glow) root.add(glowSprite(glow, size, 0.85));
  return finish(root, mats, { kind: 'proj', spin });
}

// Ring telegraph for lobbed rocks.
export function buildMarker() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(18, 22, 20),
    new THREE.MeshBasicMaterial({ color: '#ff4030', transparent: true, opacity: 0.6, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

export function heroColor(cls) {
  return {
    biker: '#ff5030', mallCop: '#5090ff', skater: '#50e070', mallGoth: '#d060ff',
  }[cls] || '#ffffff';
}
