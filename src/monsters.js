// The Food Court's monsters. They are built like the survivors (heroes.js): shaped parts on the
// shared rig, so every KayKit animation drives them. Their parts are then merged into a few
// skinned meshes, one per material, so a crowd of them costs a handful of draw calls each.

import * as THREE from 'three';
import { kit } from './heroes.js';

const {
  RIGS, BODIES, applyRig, hipsHeight, BASE_HIPS, mat, metal, add, sphere, box, cap, CAP_TILT, cylinder, cone, torus,
  body, flap, belt, boots, rotTex, ragTex,
} = kit;

const MRIGS = { ...RIGS };
const MBODIES = {
  ...BODIES,
  scrawny: { chest: 0.12, chestD: 0.72, waist: 0.095, hip: 0.105, arm: 0.034, fore: 0.031, thigh: 0.052, calf: 0.038, neck: 0.036, delt: 0.042, head: 1.25 },
  gaunt: { chest: 0.15, chestD: 0.62, waist: 0.11, hip: 0.12, arm: 0.04, fore: 0.035, thigh: 0.07, calf: 0.048, neck: 0.042, delt: 0.048, head: 1 },
  bloat: { chest: 0.19, chestD: 0.9, waist: 0.17, hip: 0.16, arm: 0.052, fore: 0.044, thigh: 0.082, calf: 0.056, neck: 0.05, delt: 0.06, head: 0.95 },
};

const glow = (color, k = 2) => mat(color, { emissive: color, emissiveIntensity: k });
const BONE = '#d8d0b4';

// ---------- undead building blocks ----------

// Glowing pinpoints in the dead sockets (the painted face carries the milky/black eyes).
function eyes(head, color, hs = 1, { y = 0.16, z = 0.098, spread = 0.032, size = 0.009 } = {}) {
  const m = glow(color, 3.4);
  for (const s of [-1, 1]) add(head, sphere(6), m, [s * spread * hs, y * hs, z * hs], [0, 0, 0], [size * 1.25 * hs, size * hs, size * 0.5 * hs]);
}

// A wet red-black gore patch stuck to a bone.
function gore(parent, pos, size = 0.03, flat = 0.4, color = '#8a0c0c') {
  return add(parent, sphere(6), mat(color, { roughness: 0.35 }), pos, [0, 0, 0], [size, size * flat, size]);
}

// Ribs and a ruined belly: dark cavity, bone arcs, a hanging string of gut.
function ribs(chest, B, spine, y = 0.06, w = 1) {
  const front = B.chest * B.chestD + 0.012;
  add(chest, box(), mat('#3a0606', { roughness: 0.4 }), [0, y, front], [0, 0, 0], [0.13 * w, 0.14, 0.02]);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    add(chest, box(), mat("#bdb494"), [s * 0.035 * w, y + 0.05 - i * 0.034, front + 0.014], [0, 0, s * -0.3], [0.07 * w, 0.011, 0.014]);
  }
  add(chest, box(), mat(BONE), [0, y, front + 0.01], [0, 0, 0], [0.012, 0.15, 0.012]); // breastbone
  if (spine) add(spine, cylinder(1, 1, 6), mat('#a8606a', { roughness: 0.3 }), [0.02, -0.02, B.hip * B.chestD + 0.02], [0.2, 0, 0.2], [0.014, 0.1, 0.014]); // a dangling gut
}

// Ragged hem: strips hanging off a garment.
function tatters(parent, y, radius, depth, material, n = 6, len = 0.1, seed = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const l = len * (0.6 + ((i * 37 + seed * 11) % 10) / 14);
    const f = flap(parent, [Math.sin(a) * radius, y, Math.cos(a) * radius * depth], 0.045 + (i % 3) * 0.012, l, material, Math.cos(a) * 0.25, 0.008);
    f.rotation.z = -Math.sin(a) * 0.25;
  }
}

// Torn throat: a wet crater at the base of the neck with a flap of skin.
function neckBite(head, hs, side = 1) {
  gore(head, [side * 0.035 * hs, 0.02 * hs, 0.04 * hs], 0.036 * hs, 0.7);
  add(head, box(), mat('#9a6a64'), [side * 0.05 * hs, 0.035 * hs, 0.05 * hs], [0, 0.3, 0.5 * side], [0.03 * hs, 0.012, 0.02 * hs]);
}

function club(hand, bloody = true) {
  const g = new THREE.Group();
  const wood = mat('#4a3420');
  add(g, cylinder(1, 0.55, 8), wood, [0, 0.36, 0], [0, 0, 0], [0.06, 0.66, 0.06]);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, y = 0.48 + (i % 3) * 0.1;
    add(g, cone(4), metal('#7a7a82'), [Math.cos(a) * 0.05, y, Math.sin(a) * 0.05], [Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4], [0.015, 0.06, 0.015]);
  }
  if (bloody) { gore(g, [0.03, 0.55, 0.02], 0.05, 0.9); gore(g, [-0.02, 0.45, 0.03], 0.04, 0.9); }
  hand.add(g);
}

const hash3 = (v, a, b, c) => [a, b, c][v % 3];

// Shared zombie assembly: rotted skin everywhere clothes don't cover it.
function zombie(rig, { R, B, skin, seed, shirt, sleeves = true, pants, shorts = false, shoes, face, stump = null }) {
  const hs = B.head;
  const flesh = mat('#ffffff', { map: rotTex(skin, seed), roughness: 0.8 });
  const b = body(rig, B, {
    rig: R, skin, chest: shirt, abs: shirt, upperArm: sleeves ? shirt : flesh, foreArm: flesh, hands: flesh, thigh: pants, calf: shorts ? flesh : pants,
    feet: shoes, neckMat: flesh, stump,
    face: { undead: true, seed, brows: '#2a2e1c', ...face },
  });
  return { b, hs, flesh };
}

// ---------- the monsters ----------
// Every type has three variants (clothes, wounds, skin tone) so a horde is not a row of clones.

const MONSTERS = {
  // MALL WALKER: a shopper (or a worker) who never went home. Torn clothes, slack face.
  walker(rig, v = 0) {
    const R = RIGS.male, B = MBODIES.gaunt;
    const skin = hash3(v, '#7d8a68', '#8d8f6c', '#72806e');
    const shirt = mat('#ffffff', { map: hash3(v, ragTex('#e8e4d0', 11, { stripes: '#2ec8b8', holes: 5 }), ragTex('#d8b830', 12, { holes: 5 }), ragTex('#c8d4e8', 13, { holes: 4 })), roughness: 0.95 });
    const pants = mat('#ffffff', { map: hash3(v, ragTex('#b8a070', 21, { holes: 4 }), ragTex('#3a4a78', 22, { holes: 6 }), ragTex('#2a2a34', 23, { holes: 4 })), roughness: 0.95 });
    const { b, hs, flesh } = zombie(rig, {
      R, B, skin, seed: 30 + v, shirt, sleeves: v !== 0, pants, shorts: v === 0, shoes: mat(hash3(v, '#d8d0c0', '#3a2a1a', '#101014')),
      stump: v === 1 ? 'r' : null,
      face: { skin, deadEyes: hash3(v, '#d8dcc0', '#06060a', '#c8d0a0'), wound: hash3(v, 'cheek', 'brow', 'jaw') },
    });
    tatters(b.spine, -R.spine + 0.04, B.hip * 0.9, B.chestD + 0.1, shirt, 7, 0.1, v);
    if (v === 2) ribs(b.chest, B, b.spine, 0.04);
    if (v === 1) neckBite(b.head, hs, 1);
    for (let i = 0; i < 3; i++) add(b.head, sphere(6), mat('#2a2018'), [(i - 1) * 0.05, 0.25, -0.03 - (i % 2) * 0.04], [0, 0, 0], [0.04, 0.025, 0.04]); // hair remnants
    gore(b.chest, [0.05, 0.08, B.chest * B.chestD + 0.01], 0.05, 0.3);
    if (v === 0) { // the sale bag
      const hand = b.bone('handslotl');
      add(hand, box(), mat('#ff4fb8'), [0, 0.12, 0], [0, 0, 0], [0.16, 0.2, 0.08]);
      add(hand, torus(0.05, 0.006), mat('#fff'), [0, 0.24, 0], [0, 0, 0]);
    }
    if (v === 1) add(b.chest, box(), mat('#f4f0e0'), [-0.07, 0.1, B.chest * B.chestD + 0.012], [0, 0, 0], [0.06, 0.022, 0.006]); // name tag
    if (v === 2) add(b.chest, box(), mat('#8a1818'), [0, 0.0, B.chest * B.chestD + 0.02], [0, 0, 0.05], [0.026, 0.19, 0.01]); // a tie
    eyes(b.head, v === 1 ? '#80ff40' : '#d8ff80', hs, { size: 0.007 });
    void flesh;
  },
  // FOOD-COURT SPRINTER: a fast-food worker, emaciated, hungry, jaundiced.
  sprinter(rig, v = 0) {
    const R = RIGS.male, B = MBODIES.scrawny;
    const skin = hash3(v, '#98985c', '#a09a6c', '#8c9468');
    const col = hash3(v, '#e8412a', '#2a6ad8', '#f0ece0');
    const shirt = mat('#ffffff', { map: ragTex(col, 40 + v, { holes: 6, blood: 7 }), roughness: 0.95 });
    const pants = mat('#ffffff', { map: ragTex('#26262e', 50 + v, { holes: 5 }), roughness: 0.95 });
    const { b, hs } = zombie(rig, {
      R, B, skin, seed: 60 + v, shirt, sleeves: v === 2, pants, shoes: mat('#e8e4dc'),
      stump: v === 2 ? 'l' : null,
      face: { skin, deadEyes: hash3(v, '#e8e090', '#c8d870', '#06060a'), wound: hash3(v, 'jaw', 'cheek2', 'cheek'), angry: true },
    });
    const apron = mat('#ffffff', { map: ragTex('#f0e4c0', 70 + v, { holes: 4, blood: 9 }), roughness: 0.95 });
    flap(b.spine, [0, -R.spine + 0.2, B.hip * 0.9], 0.2, 0.36, apron, -0.08);
    flap(b.chest, [0, 0.12, B.chest * B.chestD + 0.012], 0.12, 0.22, apron, -0.04);
    if (v === 0) { // paper hat, askew
      add(b.head, cylinder(1, 1, 14), mat('#e8412a'), [0.015, 0.225, -0.005], [-0.1, 0, 0.18], [0.095, 0.05, 0.1]);
      add(b.head, box(), mat('#ffcc33'), [0, 0.2, 0.1], [0.1, 0, 0], [0.12, 0.01, 0.06]);
    } else if (v === 1) { // visor, half torn off
      add(b.head, box(), mat('#2a6ad8'), [0, 0.2, 0.1], [0.3, 0, -0.2], [0.14, 0.012, 0.08]);
    } else { // a tall toque, sagging
      add(b.head, cylinder(1, 1, 12), mat('#e8e0cc'), [0, 0.27, 0], [0.12, 0, 0.1], [0.085, 0.13, 0.085]);
      add(b.head, sphere(8), mat('#e8e0cc'), [0.01, 0.35, 0.01], [0, 0, 0], [0.1, 0.05, 0.1]);
    }
    neckBite(b.head, hs, v % 2 ? -1 : 1);
    gore(b.chest, [-0.04, 0.02, B.chest * B.chestD + 0.02], 0.05, 0.3);
    if (v !== 1) ribs(b.chest, B, null, 0.0, 0.8);
    for (const s of ['l', 'r']) for (let i = 0; i < 3; i++) add(b.bone(`hand${s}`), cone(4), mat('#c8c0a0'), [(i - 1) * 0.016, 0.07, 0.02], [0.3, 0, 0], [0.008, 0.055, 0.008]); // claws
    eyes(b.head, '#e8ff40', hs, { size: 0.01 });
  },
  // SECURITY BRUTE: a dead mall guard. Uniform hanging off a bulk of grey meat.
  brute(rig, v = 0) {
    const R = RIGS.big, B = MBODIES.huge;
    const skin = hash3(v, '#6f7a78', '#7a7e70', '#657270');
    const shirt = mat('#ffffff', { map: ragTex('#16254a', 80 + v, { holes: 5, blood: 8 }), roughness: 0.95 });
    const vest = mat('#ffffff', { map: ragTex('#2a3a6a', 90 + v, { holes: 3, blood: 6 }), roughness: 0.7 });
    const { b, hs } = zombie(rig, {
      R, B, skin, seed: 100 + v, shirt: vest, sleeves: v === 1, pants: shirt, shoes: mat('#0c0c10'),
      stump: v === 2 ? 'l' : null,
      face: { skin, deadEyes: hash3(v, '#8a1010', '#c8c8b0', '#06060a'), wound: hash3(v, 'cheek', 'brow', 'cheek2'), angry: true },
    });
    if (v !== 1) { // riot helmet, split by a blow
      add(b.head, cap(), metal('#2a3a6a', { metalness: 0.4, roughness: 0.5 }), [0, 0.17 * hs, 0.02], [CAP_TILT, 0, 0], [0.112 * hs, 0.13 * hs, 0.13 * hs]);
      gore(b.head, [0.04 * hs, 0.26 * hs, 0.04 * hs], 0.04 * hs, 0.6);
    } else { // bare skull showing through the scalp
      add(b.head, cap(), mat('#c8c0a8'), [0.02, 0.18 * hs, 0.02], [CAP_TILT, 0, 0.2], [0.07 * hs, 0.08 * hs, 0.09 * hs]);
      gore(b.head, [0, 0.24 * hs, 0.03], 0.03, 0.5);
    }
    add(b.chest, box(), mat('#ffcc33', { emissive: '#806010', emissiveIntensity: 0.3 }), [0, 0.08, B.chest * B.chestD + 0.01], [0, 0, 0.12], [B.chest * 1.2, 0.03, 0.01]); // SECURITY stripe, torn
    add(b.chest, box(), mat('#e8e8f0'), [-0.1, 0.06, B.chest * B.chestD + 0.016], [0, 0, 0], [0.06, 0.02, 0.006]); // a nameplate
    for (const s of [-1, 1]) add(b.chest, sphere(), metal('#2a3a6a', { metalness: 0.4 }), [s * 0.17, R.shoulderY - 0.01, 0], [0, 0, 0], [0.1, 0.07, 0.1]);
    ribs(b.chest, B, b.spine, 0.0, 1.4); // vest torn open over a ruined chest
    belt(b.spine, R, B, mat('#0c0c10'), metal('#ffcc33'));
    tatters(b.spine, -R.spine + 0.02, B.hip * 1.0, B.chestD + 0.1, shirt, 8, 0.14, v);
    boots(rig, R, B, mat('#0c0c10'), mat('#ffcc33'), 0.5);
    if (v !== 2) club(b.bone('handslotr'));
    else add(b.bone('handslotr'), cylinder(1, 1, 8), mat('#2a2a30'), [0, 0.25, 0], [0, 0, 0], [0.035, 0.5, 0.035]); // a dropped baton
    eyes(b.head, '#ff3030', hs, { y: 0.16, z: 0.105, size: 0.011 });
  },
  // TOXIC SPILL SPITTER: bloated by the fryer vats, leaking green, wet and hitching.
  spitter(rig, v = 0) {
    const R = RIGS.male, B = MBODIES.bloat;
    const skin = hash3(v, '#86a850', '#9ab058', '#7a9c58');
    const goo = mat('#80ff30', { emissive: '#40c010', emissiveIntensity: 1.6 });
    const smock = mat('#ffffff', { map: ragTex(hash3(v, '#e8dca0', '#c8e0b0', '#e8c8a0'), 110 + v, { holes: 5, blood: 4 }), roughness: 0.95 });
    const pants = mat('#ffffff', { map: ragTex('#3a3a2a', 120 + v, { holes: 4 }), roughness: 0.95 });
    const { b, hs } = zombie(rig, {
      R, B, skin, seed: 130 + v, shirt: smock, sleeves: false, pants, shoes: mat('#2a2a1a'),
      stump: v === 1 ? 'l' : null,
      face: { skin, deadEyes: '#c8ff40', wound: hash3(v, 'jaw', 'cheek', 'cheek2') },
    });
    add(b.spine, sphere(14), mat('#7a8a50', { roughness: 0.5 }), [0, 0.0, B.hip * B.chestD * 0.95], [0, 0, 0], [0.15, 0.15, 0.1]); // the swollen belly
    add(b.spine, sphere(10), goo, [0.0, 0.0, B.hip * B.chestD * 0.95 + 0.07], [0, 0, 0.2], [0.06, 0.09, 0.03]); // split open, leaking
    add(b.head, sphere(8), goo, [0, 0.1 * hs, 0.1 * hs], [0, 0, 0], [0.026, 0.05, 0.02]); // dripping mouth
    for (let i = 0; i < 4 + v; i++) add(b.head, sphere(6), goo, [(((i * 53) % 9) - 4) * 0.018 * hs, (0.12 + (i % 3) * 0.05) * hs, 0.085 * hs], [0, 0, 0], [0.014, 0.014, 0.01]); // boils
    if (v !== 2) {
      add(b.chest, cylinder(1, 1, 12), metal('#c8d0c0', { metalness: 0.4 }), [0, 0.04, -B.chest * B.chestD - 0.08], [0, 0, 0], [0.09, 0.3, 0.09]); // leaking drum
      add(b.chest, cylinder(1, 1, 12), goo, [0, 0.19, -B.chest * B.chestD - 0.08], [0, 0, 0], [0.07, 0.02, 0.07]);
    }
    for (let i = 0; i < 4; i++) add(b.chest, sphere(6), goo, [(i - 1.5) * 0.06, 0.06 - (i % 2) * 0.08, B.chest * B.chestD + 0.015], [0, 0, 0], [0.016, 0.026, 0.006]);
    tatters(b.spine, -R.spine + 0.04, B.hip * 1.05, B.chestD + 0.2, smock, 7, 0.12, v);
    add(b.bone('handslotr'), sphere(10), goo, [0, 0.06, 0], [0, 0, 0], [0.05, 0.06, 0.05]); // a glob in hand, ready to lob
    eyes(b.head, '#c8ff40', hs, { size: 0.01 });
  },
};

// Variants are separate models: 'walker', 'walker1', 'walker2', ...
const TYPES = ['walker', 'sprinter', 'brute', 'spitter'];
export const MONSTER_RIG = { walker: 'male', sprinter: 'male', brute: 'big', spitter: 'male' };
export const MONSTER_VARIANTS = 3;
export const BUILT_MONSTERS = TYPES.flatMap((t) => Array.from({ length: MONSTER_VARIANTS }, (_, i) => (i ? `${t}${i}` : t)));
const split = (type) => { const m = /^([a-z]+?)(\d?)$/.exec(type); return [m[1], m[2] ? +m[2] : 0]; };

// Turn a bare rig into the given monster; returns its size relative to the base rig.
export function buildMonster(name, rig) {
  const [type, variant] = split(name);
  const R = MRIGS[MONSTER_RIG[type]];
  applyRig(rig, R);
  rig.updateMatrixWorld(true);
  MONSTERS[type](rig, variant);
  mergeParts(rig);
  return hipsHeight(R) / BASE_HIPS;
}

// Every part hangs rigidly off one bone: bake them into one skinned mesh per material, each
// vertex weighted fully to its part's bone.
function mergeParts(rig) {
  rig.updateMatrixWorld(true);
  const bones = [];
  rig.traverse((o) => { if (o.isBone) bones.push(o); });
  const toRig = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const groups = new Map(); // material -> geometries
  // Parts share one material per kind of surface (cloth/skin, metal, each painted texture,
  // each glow): a part's colour is baked into its vertex colours (which already carry the
  // shading), so differently coloured cloth can be drawn together.
  const looks = new Map();
  const same = (m) => {
    const glows = m.emissiveIntensity > 0 && m.emissive.getHex() !== 0;
    const key = [m.map ? m.map.uuid : '', glows ? m.emissive.getHex() + ':' + m.emissiveIntensity + ':' + m.color.getHex() : '', m.metalness > 0.3 ? 'metal' : 'matte', m.side, m.transparent, m.opacity].join('|');
    if (!looks.has(key)) {
      const look = m.clone();
      if (!glows) look.color.set('#ffffff');
      look.vertexColors = true;
      looks.set(key, look);
    }
    return { look: looks.get(key), bake: !glows };
  };
  const parts = [];
  rig.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) parts.push(o); });
  for (const m of parts) {
    let b = m.parent;
    while (b && !b.isBone) b = b.parent;
    const bi = Math.max(0, bones.indexOf(b));
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRig, m.matrixWorld));
    // flipped parts (negative scale) would turn inside out
    if (m.matrixWorld.determinant() < 0) {
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i += 3) for (const a of [p, n, g.attributes.uv, g.attributes.color]) {
        if (!a) continue;
        for (let c = 0; c < a.itemSize; c++) { const t = a.getComponent(i + 1, c); a.setComponent(i + 1, c, a.getComponent(i + 2, c)); a.setComponent(i + 2, c, t); }
      }
    }
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const { look, bake } = same(m.material);
    if (bake) { // the part's own colour, into its vertex colours
      const c = g.attributes.color, col = m.material.color;
      for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * col.r, c.getY(i) * col.g, c.getZ(i) * col.b);
    }
    if (!groups.has(look)) groups.set(look, []);
    groups.get(look).push(g);
    m.parent.remove(m);
  }
  const skeleton = new THREE.Skeleton(bones);
  for (const [material, geos] of groups) {
    const merged = mergeAll(geos);
    const mesh = new THREE.SkinnedMesh(merged, material);
    mesh.frustumCulled = false;
    rig.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.matrixWorld);
  }
}

function mergeAll(geos) {
  const out = new THREE.BufferGeometry();
  for (const [k, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3], ['skinIndex', 4], ['skinWeight', 4]]) {
    const total = geos.reduce((s, g) => s + g.attributes[k].count, 0);
    const arr = k === 'skinIndex' ? new Uint16Array(total * size) : new Float32Array(total * size);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[k].array, o); o += g.attributes[k].count * size; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
