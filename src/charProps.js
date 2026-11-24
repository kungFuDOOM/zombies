// Outfits and weapons for the four survivors, attached to the bones of their hand-modelled
// Quaternius bodies (the bodies themselves are recoloured at build time, tools/build-characters.mjs).
// Props are built in "prop metres" (1.75 m adult, the same builders heroes.js always used) inside a
// holder that cancels the rig's 100x armature scale.

import * as THREE from 'three';
import { kit } from './heroes.js';

const { mat, metal, add, box, sphere, cap, cylinder, cone, roundedBox, torus, chainsaw, shotgun, spikedBat, hairspray, boombox } = kit;
const PROP_UNIT = 33; // world units per prop metre (a touch over life size so weapons read at gameplay distance)

function holder(actor, boneName, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  const bone = actor.bone(boneName);
  if (!bone) return null;
  const h = new THREE.Group();
  h.scale.setScalar((PROP_UNIT / (actor.unit * 100)) * scale);
  h.position.set(...pos.map((v) => v * (PROP_UNIT / (actor.unit * 100)) * scale));
  h.rotation.set(...rot);
  bone.add(h);
  return h;
}

// ---- accessories (head-local: +Y up, +Z forward, head centre ~ (0, hy, 0)) ----
const HEAD = { y: 0.2, r: 0.2, zf: 0.2 };

// Measure the head of this body (bone-local, converted to prop metres) so accessories fit any of the models.
function measureHead(actor) {
  const bone = actor.bone('Head');
  let skm = null;
  actor.model.traverse((o) => { if (o.isSkinnedMesh && !skm) skm = o; });
  if (!bone || !skm) return;
  actor.model.updateMatrixWorld(true);
  const idx = skm.skeleton.bones.indexOf(bone);
  const g = skm.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const inv = skm.skeleton.boneInverses[idx].clone().multiply(skm.bindMatrix);
  const v = new THREE.Vector3(), box = new THREE.Box3();
  for (let i = 0; i < P.count; i++) {
    let k = 0, best = -1;
    for (let q = 0; q < 4; q++) if (SW.getComponent(i, q) > best) { best = SW.getComponent(i, q); k = q; }
    if (SI.getComponent(i, k) !== idx) continue;
    box.expandByPoint(v.fromBufferAttribute(P, i).applyMatrix4(inv));
  }
  if (box.isEmpty()) return;
  const k = (PROP_UNIT / (actor.unit * 100)); // bone-local units per prop metre
  HEAD.y = ((box.min.y + box.max.y) / 2) / k - 0.02;
  HEAD.r = ((box.max.x - box.min.x) / 2) / k * 0.8;
  HEAD.zf = box.max.z / k;
  HEAD.zc = ((box.min.z + box.max.z) / 2) / k;
}

function shades(g, color = '#101018', rim = '#101018', w = 1.5, aviator = false) {
  const { y, r, zf } = HEAD, W = r * w, z = zf - r * 0.02, eyeY = y - r * 0.08;
  const lens = mat(color, { roughness: 0.2, emissive: aviator ? '#304860' : '#000000', emissiveIntensity: aviator ? 0.6 : 0 });
  const frame = metal(rim);
  for (const s of [-1, 1]) add(g, roundedBox(0.4), lens, [s * W * 0.27, eyeY, z], [0, 0, 0], [W * 0.42, aviator ? r * 0.5 : r * 0.34, r * 0.16]);
  add(g, box(), frame, [0, eyeY + r * 0.08, z + 0.004], [0, 0, 0], [W * 1.02, r * 0.09, r * 0.17]);
  for (const s of [-1, 1]) add(g, box(), frame, [s * W * 0.5, eyeY, z - r * 0.5], [0, 0, 0], [r * 0.07, r * 0.09, r * 1.0]);
}

function bandana(g) {
  const { y, r, zc } = HEAD;
  const red = mat('#d41414', { roughness: 0.7 }), dark = mat('#8a0c0c');
  add(g, cap(), red, [0, y + r * 0.2, zc], [0, 0, 0], [r * 1.12, r * 0.7, r * 1.14]);
  add(g, cylinder(1, 1, 18), red, [0, y + r * 0.34, zc], [0, 0, 0], [r * 1.13, r * 0.26, r * 1.15]);
  for (const s of [-1, 1]) add(g, box(), dark, [s * r * 0.3, y + r * 0.34, zc - r * 1.1], [0.5, s * 0.3, s * 0.35], [r * 0.35, r * 0.14, r * 0.7]);
  add(g, sphere(8), red, [0, y + r * 0.42, zc - r * 1.05], [0, 0, 0], [r * 0.28, r * 0.28, r * 0.28]);
}

function copCap(g) {
  const { y, r, zc, zf } = HEAD;
  const navy = mat('#16254a'), band = mat('#0c0f1a'), gold = metal('#e8c040');
  add(g, cylinder(1, 1, 18), navy, [0, y + r * 0.62, zc], [0, 0, 0], [r * 1.08, r * 0.5, r * 1.1]);
  add(g, cylinder(1, 1, 18), navy, [0, y + r * 0.9, zc + r * 0.04], [0.1, 0, 0], [r * 1.18, r * 0.1, r * 1.2]); // overhanging crown
  add(g, cylinder(1, 1, 18), band, [0, y + r * 0.46, zc], [0, 0, 0], [r * 1.1, r * 0.14, r * 1.12]);
  add(g, box(), band, [0, y + r * 0.5, zf + r * 0.05], [0.25, 0, 0], [r * 1.1, r * 0.06, r * 0.6]);                   // visor
  add(g, box(), gold, [0, y + r * 0.72, zf + r * 0.0], [0, 0, 0], [r * 0.3, r * 0.3, r * 0.06]);                     // cap badge
}

function moustache(g) {
  const { y, r, zf } = HEAD, m = mat('#1a120c');
  add(g, box(), m, [0, y - r * 0.52, zf + r * 0.02], [0, 0, 0], [r * 0.95, r * 0.2, r * 0.16]);
  for (const s of [-1, 1]) add(g, box(), m, [s * r * 0.55, y - r * 0.68, zf - r * 0.1], [0, 0, s * 0.5], [r * 0.4, r * 0.12, r * 0.15]);
}

function skirt(g) {
  const black = mat('#101016', { roughness: 0.9 });
  const flare = new THREE.CylinderGeometry(0.17, 0.3, 0.3, 14, 1, true);
  const m = add(g, flare, new THREE.MeshStandardMaterial({ color: '#101016', roughness: 0.9, side: THREE.DoubleSide, vertexColors: false, flatShading: true }), [0, -0.1, 0], [0, 0, 0], [1, 1, 0.95]);
  m.geometry = flare;
  add(g, torus(0.17, 0.012), mat('#ff2ea6', { emissive: '#ff2ea6', emissiveIntensity: 0.5 }), [0, 0.04, 0], [Math.PI / 2, 0, 0]); // pink belt
  void black;
}

const DRESS = {
  biker(a) {
    a.model.scale.x *= 1.22; a.model.scale.z *= 1.12; a.model.scale.y *= 1.04; // burly
    const h = holder(a, 'Head'); if (h) { bandana(h); shades(h, '#0a0a10', '#0a0a10', 1.6); }
    const w = holder(a, a.hand, { pos: [0, 0.05, 0], rot: [1.9, 0, 0], scale: 1.15 }); if (w) chainsaw(w);
  },
  mallCop(a) {
    const h = holder(a, 'Head'); if (h) { copCap(h); shades(h, '#4a5a68', '#e8c040', 1.5, true); moustache(h); }
    const w = holder(a, a.hand, { scale: 1.0 }); if (w) shotgun(w);
  },
  skater(a) {
    const w = holder(a, a.hand, { rot: [2.1, 0, 0], scale: 1.1 }); if (w) spikedBat(w);
  },
  mallGoth(a) {
    const w = holder(a, a.hand, { rot: [2.0, 0, 0], scale: 1.1 }); if (w) hairspray(w);
    const t = holder(a, 'Torso', { pos: [0, 0.1, 0] }); if (t) boombox(t, { chest: 0.15, chestD: 1 });
    const s = holder(a, 'Hips', { pos: [0, 0, 0] }); if (s) skirt(s);
  },
};

export function dressSurvivor(actor, cls) {
  actor.hand = 'Middle1.L'; // the kit's own weapons hang off this bone
  measureHead(actor);
  DRESS[cls](actor);
}

// Cheap zombie outfit variants on top of the shared bodies: a food-court visor, a security cap...
export function dressZombie(actor, variant) {
  if (!variant || !actor.bone('Head')) return;
  measureHead(actor);
  const h = holder(actor, 'Head');
  if (!h) return;
  const { y, r, zc, zf } = HEAD;
  const grime = (c) => mat(c, { roughness: 0.95 });
  if (variant === 1) { // food-court visor, hanging off
    add(h, cylinder(1, 1, 14), grime('#8a1a1a'), [0, y + r * 0.45, zc], [0.1, 0, 0.2], [r * 1.05, r * 0.16, r * 1.07]);
    add(h, box(), grime('#8a1a1a'), [r * 0.1, y + r * 0.42, zf + r * 0.12], [0.3, 0, 0.2], [r * 1.0, r * 0.06, r * 0.6]);
  } else if (variant === 2) { // a tilted, torn security cap and a loose tie
    add(h, cylinder(1, 1, 14), grime('#233252'), [r * 0.12, y + r * 0.55, zc], [0.18, 0, -0.3], [r * 1.0, r * 0.4, r * 1.02]);
    add(h, box(), grime('#0c0f1a'), [r * 0.3, y + r * 0.42, zf + r * 0.02], [0.25, 0, -0.3], [r * 0.9, r * 0.05, r * 0.5]);
  }
}
