// Outfits and weapons for the four survivors, attached to the bones of their Quaternius "Ultimate
// Modular" adult bodies (the bodies themselves are recoloured at build time, tools/build-characters.mjs).
// The Modular clips swing the RIGHT arm for guns, swords and punches, so every weapon is held on
// Wrist.R. The Mall Cop's own moustache and the Biker's bandana-over-bald-head come from the bodies
// (the Worker's hard hat and the Punk's mohawk are dropped at build time), so only the cap, shades
// and bandana are added here.
// Props are built in "prop metres" (1.75 m adult, the same builders heroes.js always used) inside a
// holder that cancels the rig's 100x armature scale.

import * as THREE from 'three';
import { kit } from './heroes.js';

const { mat, metal, add, box, sphere, cap, cylinder, cone, roundedBox, chainsaw, shotgun, spikedBat, hairspray, boombox } = kit;
const WEAPON = { // Wrist.R holder transforms (see DRESS); tuned against Idle_Sword / Idle_Gun / Gun_Shoot / Sword_Slash
  // Melee weapons hang off the right fist (Idle_Sword: arm down, fingers down): a +0.95 rad turn about the
  // wrist's outward z axis swings the blade/bar from "down" to "forward and down", and the slash then arcs naturally.
  biker: { pos: [0, 0.05, 0], rot: [0, 0, 0.95], scale: 0.95 },
  // Gun class: the right arm is held straight out front (fingers forward), so the barrel just runs along the hand.
  mallCop: { pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 1.0 },
  skater: { pos: [0, 0.05, 0], rot: [0, 0, 1.05], scale: 1.05 },
  mallGoth: { pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 1.0 },
};
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
const HEAD = { y: 0.2, r: 0.2, zf: 0.2, top: 0.3, hw: 0.25 };

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
  HEAD.top = box.max.y / k;                       // crown of the skull (hair included)
  HEAD.hw = (box.max.x - box.min.x) / 2 / k;      // true half-width
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

// Police peaked cap: navy band + tall crown, flared top, gold badge and a shiny black visor. Placed from the skull top
// (HEAD.top) so it sits ON the head however the body's hair is shaped.
function copCap(g) {
  const { top, hw, zc, zf } = HEAD;
  const navy = mat('#1b2f66', { roughness: 0.6 }), band = mat('#080a12', { roughness: 0.35 }), gold = metal('#f0c840');
  const y0 = top - hw * 0.72;                   // bottom edge of the cap, just above the brows
  add(g, cylinder(1, 1, 20), band, [0, y0 + hw * 0.1, zc], [0, 0, 0], [hw * 1.16, hw * 0.24, hw * 1.2]);            // hat band
  add(g, cylinder(1, 1, 20), navy, [0, y0 + hw * 0.5, zc], [0, 0, 0], [hw * 1.14, hw * 0.62, hw * 1.18]);           // crown
  add(g, cylinder(1, 1, 20), navy, [0, y0 + hw * 0.86, zc + hw * 0.04], [0.08, 0, 0], [hw * 1.32, hw * 0.14, hw * 1.36]); // flared top
  add(g, box(), band, [0, y0 + hw * 0.0, zf + hw * 0.12], [0.22, 0, 0], [hw * 1.0, hw * 0.07, hw * 0.62]);           // visor
  add(g, box(), gold, [0, y0 + hw * 0.5, zf + hw * 0.05], [0, 0, 0], [hw * 0.34, hw * 0.34, hw * 0.1]);            // cap badge
  add(g, box(), gold, [0, y0 + hw * 0.13, zf + hw * 0.1], [0, 0, 0], [hw * 0.8, hw * 0.05, hw * 0.1]);              // gold cord
}

// A backwards cap for the Skater: crown and brim to the rear, a hot-pink button and a green front panel.
function backCap(g) {
  const { top, hw, zc } = HEAD;
  const pink = mat('#ff5ad0', { roughness: 0.7 }), green = mat('#38c870', { roughness: 0.7 });
  const y0 = top - hw * 0.9;
  add(g, cap(), pink, [0, y0, zc], [0, 0, 0], [hw * 1.18, hw * 1.25, hw * 1.24]);                                // crown dome (covers the hair)
  add(g, cylinder(1, 1, 20), pink, [0, y0 - hw * 0.02, zc], [0, 0, 0], [hw * 1.15, hw * 0.16, hw * 1.21]);        // band
  add(g, box(), green, [0, y0 + hw * 0.36, zc - hw * 1.0], [0.25, 0, 0], [hw * 0.62, hw * 0.46, hw * 0.07]);      // the cap's front panel, which now faces backwards
  add(g, box(), pink, [0, y0 - hw * 0.04, zc - hw * 1.28], [0.12, 0, 0], [hw * 1.0, hw * 0.07, hw * 0.75]);       // the brim, at the back of the head
  add(g, sphere(8), green, [0, y0 + hw * 0.92, zc], [0, 0, 0], [hw * 0.14, hw * 0.14, hw * 0.14]);               // button
}

// High-tops for the Skater (the Beach body only has flip-flops): white sock, white shoe with a pink stripe and toe cap.
// Built in each foot bone's frame: +Y toe-ward, -Z up (the sole is at +Z), X across.
function highTops(a) {
  for (const side of ['L', 'R']) {
    const h = holder(a, 'Foot' + side); if (!h) continue;
    const white = mat('#f4f4f4', { roughness: 0.7 }), pink = mat('#ff5ad0', { roughness: 0.6 }), sole = mat('#e6e6e6', { roughness: 0.9 }), dark = mat('#1a1a22');
    add(h, cylinder(1, 1, 14), white, [0, -0.01, -0.13], [Math.PI / 2, 0, 0], [0.056, 0.14, 0.056]);                       // crew sock
    add(h, roundedBox(0.4), white, [0, 0.07, -0.05], [0, 0, 0], [0.105, 0.3, 0.1]);                                     // shoe body
    add(h, roundedBox(0.4), white, [0, -0.015, -0.11], [0, 0, 0], [0.098, 0.115, 0.12]);                                // the high collar around the ankle
    add(h, roundedBox(0.4), pink, [0, 0.0, -0.16], [0, 0, 0], [0.102, 0.04, 0.035]);                                    // collar trim
    add(h, roundedBox(0.4), sole, [0, 0.075, 0.0], [0, 0, 0], [0.11, 0.315, 0.03]);                                      // sole
    add(h, roundedBox(0.4), pink, [0, 0.195, -0.045], [0, 0, 0], [0.108, 0.07, 0.07]);                                  // toe cap
    add(h, box(), dark, [0, 0.105, -0.101], [0, 0, 0], [0.06, 0.12, 0.012]);                                            // tongue/laces
    for (const sx of [-1, 1]) add(h, box(), pink, [sx * 0.053, 0.06, -0.06], [0, 0, 0], [0.01, 0.15, 0.03]);           // side stripes
  }
}

// holder rot/pos are per weapon: the weapon's +Y (barrel / bar / bat length) sits on the wrist's local axes.
const DRESS = {
  biker(a) {
    a.model.scale.x *= 1.12; a.model.scale.z *= 1.1; a.model.scale.y *= 1.03; // burly, taller than the rest
    const h = holder(a, 'Head'); if (h) { bandana(h); shades(h, '#0a0a10', '#0a0a10', 1.6); }
    const w = holder(a, a.hand, WEAPON.biker); if (w) chainsaw(w);
  },
  mallCop(a) {
    // the Worker body already has a moustache (and its hard hat was dropped at build time): cap + aviators only
    const h = holder(a, 'Head'); if (h) { copCap(h); shades(h, '#4a5a68', '#e8c040', 1.5, true); }
    const w = holder(a, a.hand, WEAPON.mallCop); if (w) shotgun(w);
  },
  skater(a) {
    const h = holder(a, 'Head'); if (h) backCap(h);
    highTops(a);
    const w = holder(a, a.hand, WEAPON.skater); if (w) spikedBat(w);
  },
  mallGoth(a) {
    // PunkF's ripped black legs already read as her skirt/ripped look: no extra skirt
    const w = holder(a, a.hand, WEAPON.mallGoth); if (w) hairspray(w);
    const t = holder(a, 'Torso', { pos: [0, 0.02, 0] }); if (t) boombox(t, { chest: 0.1, chestD: 1 });
  },
};

export function dressSurvivor(actor, cls) {
  actor.hand = 'Wrist.R'; // the Modular clips swing the right arm for guns, swords and punches
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
