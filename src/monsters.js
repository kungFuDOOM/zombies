// The Food Court's monsters. They are built like the survivors (heroes.js): shaped parts on the
// shared rig, so every KayKit animation drives them. Their parts are then merged into a few
// skinned meshes, one per material, so a crowd of them costs a handful of draw calls each.

import * as THREE from 'three';
import { kit } from './heroes.js';

const {
  RIGS, BODIES, applyRig, hipsHeight, BASE_HIPS, mat, metal, add, lathe, sphere, box, cap, CAP_TILT, cylinder, cone, torus,
  shapeGeo, body, hairLong, bracer, flap, belt, boots, horns, sword, shield, staff, stripes,
} = kit;

const MRIGS = {
  ...RIGS,
  // small and wiry: goblins and imps
  small: { leg: 0.24, shin: 0.22, spine: 0.09, chest: 0.18, neck: 0.2, shoulder: 0.13, shoulderY: 0.15, arm: 0.22, fore: 0.2, hipW: 0.075 },
};
const MBODIES = {
  ...BODIES,
  scrawny: { chest: 0.12, chestD: 0.72, waist: 0.095, hip: 0.105, arm: 0.034, fore: 0.031, thigh: 0.052, calf: 0.038, neck: 0.036, delt: 0.042, head: 1.3 },
  imp: { chest: 0.14, chestD: 0.7, waist: 0.1, hip: 0.11, arm: 0.04, fore: 0.036, thigh: 0.06, calf: 0.045, neck: 0.04, delt: 0.05, head: 1.2 },
  gaunt: { chest: 0.15, chestD: 0.62, waist: 0.11, hip: 0.12, arm: 0.04, fore: 0.035, thigh: 0.07, calf: 0.048, neck: 0.042, delt: 0.048, head: 1 },
};

const glow = (color, k = 2) => mat(color, { emissive: color, emissiveIntensity: k });

// Two glowing eyes on a head (bone-local; the face looks along +Z).
function eyes(head, color, hs = 1, { y = 0.16, z = 0.1, spread = 0.032, size = 0.014 } = {}) {
  const m = glow(color, 2.4);
  for (const s of [-1, 1]) add(head, sphere(8), m, [s * spread * hs, y * hs, z * hs], [0, 0, 0], [size * hs, size * 0.75 * hs, size * 0.6 * hs]);
}

function ears(head, skin, hs, len = 0.13) {
  for (const s of [-1, 1]) add(head, cone(6), skin, [s * 0.1 * hs, 0.17 * hs, -0.01], [0, 0, -s * 1.3], [0.03 * hs, len * hs, 0.014 * hs]);
}

function batWings(chest, R, B, material, size = 1) {
  const geo = shapeGeo('batwing', [[0, 0], [0.12, 0.1], [0.28, 0.14], [0.34, 0.02], [0.26, -0.02], [0.22, -0.1], [0.14, -0.04], [0.08, -0.12]], 0.006, 0);
  for (const s of [-1, 1]) {
    const w = add(chest, geo, material, [s * 0.05, R.shoulderY - 0.02, -B.chest * B.chestD - 0.01], [0.3, s > 0 ? -0.5 : Math.PI + 0.5, 0.25], [size, size, size]);
    w.userData.wing = s;
  }
}

function tail(hips, material, segs = 6, r = 0.02, tip = null) {
  let seg = hips;
  for (let i = 0; i < segs; i++) {
    seg = add(seg, cylinder(0.8, 1), material, i === 0 ? [0, 0, -0.09] : [0, 0.08, 0], [i === 0 ? -2.0 : 0.22, 0, 0], i === 0 ? [r, 0.08, r] : [0.9, 1, 0.9]);
  }
  if (tip) add(seg, cone(4), tip, [0, 0.9, 0], [0, 0, 0], [2.4, 1.2, 0.6]);
}

function club(hand) {
  const g = new THREE.Group();
  const wood = mat('#6a4a2a');
  add(g, cylinder(1, 0.55, 8), wood, [0, 0.36, 0], [0, 0, 0], [0.06, 0.66, 0.06]);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, y = 0.48 + (i % 3) * 0.1;
    add(g, cone(4), metal('#b0b0b8'), [Math.cos(a) * 0.05, y, Math.sin(a) * 0.05], [Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4], [0.015, 0.06, 0.015]);
  }
  hand.add(g);
}

function trident(hand, material) {
  const g = new THREE.Group();
  add(g, cylinder(0.012, 0.014), mat('#2a1a14'), [0, 0.4, 0], [0, 0, 0], [1, 1.1, 1]);
  add(g, box(), material, [0, 0.95, 0], [0, 0, 0], [0.14, 0.02, 0.02]);
  for (const x of [-0.065, 0, 0.065]) add(g, cone(4), material, [x, 1.02, 0], [0, 0, 0], [0.014, 0.12, 0.014]);
  hand.add(g);
}

function robe(spine, R, B, material, flare = 1.6, len = 0.82) {
  add(spine, lathe([[B.hip * 1.08, -R.spine + 0.02], [B.hip * 1.3, -R.spine - len * 0.36], [B.hip * flare, -R.spine - len]], 14), material, [0, 0, 0], [0, Math.PI, 0], [1, 1, 0.85]);
}

function pointyHat(head, material, hs, tall = 0.34) {
  add(head, cylinder(1, 1, 16), material, [0, 0.24 * hs, 0], [-0.12, 0, 0], [0.2 * hs, 0.012, 0.2 * hs]);
  const c = add(head, cone(10), material, [0, 0.24 * hs + tall * 0.35, -0.01], [-0.25, 0, 0], [0.095 * hs, tall * 0.7, 0.095 * hs]);
  add(c, cone(8), material, [0, 0.62, -0.08], [-0.7, 0, 0], [0.55, 0.5, 0.55]);
}

// ---------- the monsters ----------

function goblinBody(rig, skin, extra = {}) {
  const R = MRIGS.small, B = MBODIES.scrawny, hs = B.head;
  const b = body(rig, B, { rig: R, skin, feet: mat('#3a2a1a'), face: { eyes: '#ffcc20', brows: '#2a4010', angry: true, fangs: true }, ...extra });
  ears(b.head, b.skin, hs);
  add(b.head, cone(6), b.skin, [0, 0.13 * hs, 0.12 * hs], [Math.PI / 2 + 0.35, 0, 0], [0.02 * hs, 0.06 * hs, 0.02 * hs]); // long nose
  eyes(b.head, '#ffd020', hs, { y: 0.165, z: 0.098 });
  return { b, R, B, hs };
}

const MONSTERS = {
  // MALL WALKER: a shopper who never went home. Tourist shirt, khaki shorts, a bag from the sale.
  walker(rig) {
    const R = RIGS.male, B = MBODIES.gaunt, hs = B.head;
    const shirt = mat('#ffffff', { map: stripes(['#2ec8b8', '#ff5ab0'], 8) }), khaki = mat('#b8a070'), bag = mat('#ff4fb8');
    const b = body(rig, B, { rig: R, skin: '#8aa070', chest: shirt, abs: shirt, upperArm: shirt, thigh: khaki, calf: mat('#8aa070'), feet: mat('#d8d0c0'), face: { eyes: '#e8e8a0', brows: '#3a4a2a', scars: true } });
    eyes(b.head, '#e0ff80', hs, { y: 0.16, z: 0.1, size: 0.011 });
    for (let i = 0; i < 4; i++) flap(b.spine, [(i - 1.5) * 0.06, -R.spine + 0.02, B.hip * 0.8], 0.05, 0.08 + (i % 2) * 0.06, shirt, -0.15); // rags
    for (let i = 0; i < 3; i++) add(b.head, sphere(8), mat('#2a2018'), [(i - 1) * 0.05, 0.25, -0.03 - (i % 2) * 0.04], [0, 0, 0], [0.04, 0.025, 0.04]); // what hair is left
    const hand = b.bone('handslotl');
    add(hand, box(), bag, [0, 0.12, 0], [0, 0, 0], [0.16, 0.2, 0.08]); // the shopping bag
    add(hand, torus(0.05, 0.006), mat('#fff'), [0, 0.24, 0], [0, 0, 0]);
  },
  // FOOD-COURT SPRINTER: a fast-food worker, hunched and hungry.
  sprinter(rig) {
    const R = RIGS.male, B = MBODIES.gaunt, hs = B.head;
    const polo = mat('#e8412a'), pants = mat('#26262e'), apron = mat('#f4e8c8');
    const b = body(rig, B, { rig: R, skin: '#b88a5a', chest: polo, abs: polo, upperArm: polo, thigh: pants, calf: pants, feet: mat('#f4f4f4'), face: { eyes: '#ffd060', brows: '#3a2a1a', scars: true, fangs: true, angry: true } });
    eyes(b.head, '#ffb020', hs, { y: 0.16, z: 0.1, size: 0.013 });
    add(b.head, cylinder(1, 1, 14), mat('#e8412a'), [0, 0.225, -0.005], [-0.1, 0, 0], [0.095, 0.05, 0.1]); // the paper hat
    add(b.head, box(), mat('#ffcc33'), [0, 0.2, 0.1], [0.1, 0, 0], [0.12, 0.01, 0.06]);
    flap(b.spine, [0, -R.spine + 0.18, B.hip * 0.85], 0.2, 0.34, apron, -0.08);
    for (let i = 0; i < 3; i++) add(b.chest, sphere(5), mat('#8a1a1a'), [(i - 1) * 0.04, 0.04 - (i % 2) * 0.06, B.chest * B.chestD + 0.02], [0, 0, 0], [0.02, 0.02, 0.006]); // blood and ketchup
    for (const s of ['l', 'r']) for (let i = 0; i < 3; i++) add(b.bone(`hand${s}`), cone(4), mat('#e8e0c8'), [(i - 1) * 0.016, 0.07, 0.02], [0.3, 0, 0], [0.008, 0.05, 0.008]); // claws
  },
  // SECURITY BRUTE: a mall guard in riot armour. Slow, armoured, hits like a truck.
  brute(rig) {
    const R = RIGS.big, B = MBODIES.huge, hs = B.head;
    const navy = mat('#16254a'), armor = metal('#2a3a6a', { metalness: 0.4, roughness: 0.5 }), yellow = mat('#ffcc33', { emissive: '#806010', emissiveIntensity: 0.3 });
    const b = body(rig, B, { rig: R, skin: '#8a8f92', chest: armor, abs: navy, upperArm: navy, foreArm: navy, thigh: navy, calf: navy, feet: mat('#0c0c10'), face: { eyes: '#ff4040', brows: '#2a2a2a', scars: true, angry: true } });
    eyes(b.head, '#ff3030', hs, { y: 0.16, z: 0.105, size: 0.014 });
    add(b.head, cap(), armor, [0, 0.17 * hs, 0.02], [CAP_TILT, 0, 0], [0.112 * hs, 0.13 * hs, 0.13 * hs]); // riot helmet
    add(b.head, box(), mat('#0c1020', { roughness: 0.2 }), [0, 0.15 * hs, 0.1], [0, 0, 0], [0.15, 0.06, 0.03]);
    add(b.chest, box(), yellow, [0, 0.08, B.chest * B.chestD + 0.01], [0, 0, 0], [B.chest * 1.6, 0.03, 0.01]); // SECURITY stripe
    for (const s of [-1, 1]) add(b.chest, sphere(), armor, [s * 0.17, R.shoulderY - 0.01, 0], [0, 0, 0], [0.1, 0.07, 0.1]);
    belt(b.spine, R, B, mat('#0c0c10'), metal('#ffcc33'));
    boots(rig, R, B, mat('#0c0c10'), yellow, 0.5);
    club(b.bone('handslotr'));
  },
  // TOXIC SPILL SPITTER: bloated by the fryer vats, leaking green.
  spitter(rig) {
    const R = RIGS.male, B = BODIES.stocky, hs = B.head;
    const skin = '#7ab040', tank = mat('#c8d0c0', { metalness: 0.4 }), goo = mat('#80ff30', { emissive: '#40c010', emissiveIntensity: 1.6 });
    const smock = mat('#e8dca0');
    const b = body(rig, B, { rig: R, skin, chest: smock, abs: smock, upperArm: mat(skin), thigh: mat('#3a3a2a'), calf: mat('#3a3a2a'), feet: mat('#2a2a1a'), face: { eyes: '#c8ff40', brows: '#2a3a10', scars: true, fangs: true } });
    eyes(b.head, '#c8ff40', hs, { y: 0.16, z: 0.1, size: 0.015 });
    add(b.spine, sphere(14), goo, [0, 0.02, B.hip * B.chestD * 0.9], [0, 0, 0], [0.12, 0.13, 0.09]); // a swollen belly
    add(b.head, sphere(8), goo, [0, 0.1 * hs, 0.1 * hs], [0, 0, 0], [0.03, 0.05, 0.02]); // glowing, dripping mouth
    add(b.chest, cylinder(1, 1, 12), tank, [0, 0.04, -B.chest * B.chestD - 0.08], [0, 0, 0], [0.09, 0.3, 0.09]); // the leaking drum on its back
    add(b.chest, cylinder(1, 1, 12), goo, [0, 0.19, -B.chest * B.chestD - 0.08], [0, 0, 0], [0.07, 0.02, 0.07]);
    for (let i = 0; i < 4; i++) add(b.chest, sphere(6), goo, [(i - 1.5) * 0.05, 0.06 - (i % 2) * 0.08, B.chest * B.chestD + 0.015], [0, 0, 0], [0.014, 0.022, 0.006]);
    add(b.bone('handslotr'), sphere(10), goo, [0, 0.06, 0], [0, 0, 0], [0.05, 0.06, 0.05]); // a glob in hand, ready to lob
  },
};

export const MONSTER_RIG = { walker: 'male', sprinter: 'male', brute: 'big', spitter: 'male' };
export const BUILT_MONSTERS = Object.keys(MONSTERS);

// Turn a bare rig into the given monster; returns its size relative to the base rig.
export function buildMonster(type, rig) {
  const R = MRIGS[MONSTER_RIG[type]];
  applyRig(rig, R);
  rig.updateMatrixWorld(true);
  MONSTERS[type](rig);
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
