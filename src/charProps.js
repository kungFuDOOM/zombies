// Outfits and weapons for the four survivors, attached to the bones of their Quaternius "Ultimate
// Modular" adult bodies (the bodies themselves are recoloured at build time, tools/build-characters.mjs).
// The Modular clips swing the RIGHT arm for guns, swords and punches, so every weapon is held on
// Wrist.R. The Mall Cop's own moustache and the Biker's bandana-over-bald-head come from the bodies
// (the Worker's hard hat and the Punk's mohawk are dropped at build time), so only the cap, shades
// and bandana are added here.
// Props are built in "prop metres" (1.75 m adult, the same builders heroes.js always used) inside a
// holder that cancels the rig's 100x armature scale.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { kit } from './heroes.js';
import { UNDEAD_LOOK } from './undead.js';

const { mat, metal, add, box, sphere, cap, cylinder, cone, roundedBox, chainsaw, shotgun, spikedBat, hairspray, boombox } = kit;
const WEAPON = { // Wrist.R holder transforms (see DRESS); tuned against Idle_Sword / Idle_Gun / Gun_Shoot / Sword_Slash
  // Melee weapons hang off the right fist (Idle_Sword: arm down, fingers down): a +0.95 rad turn about the
  // wrist's outward z axis swings the blade/bar from "down" to "forward and down", and the slash then arcs naturally.
  biker: { pos: [0, 0.05, 0], rot: [0, 0, 0.95], scale: 1.1 },
  // Gun class: the right arm is held straight out front (fingers forward), so the barrel just runs along the hand.
  mallCop: { pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 1.0 },
  skater: { pos: [0, 0.05, 0], rot: [0, 0, 1.05], scale: 0.9 },
  mallGoth: { pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 1.15 },
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

// Sneakers for the Skater (the Beach body only has flip-flops): white sock, slim white shoe with a pink stripe and toe cap.
// Built in each foot bone's frame: +Y toe-ward, -Z up (the sole is at +Z), X across.
function highTops(a) {
  for (const side of ['L', 'R']) {
    const h = holder(a, 'Foot' + side); if (!h) continue;
    const white = mat('#f4f4f4', { roughness: 0.7 }), pink = mat('#ff5ad0', { roughness: 0.6 }), sole = mat('#e6e6e6', { roughness: 0.9 }), dark = mat('#1a1a22');
    add(h, cylinder(1, 1, 14), white, [0, -0.01, -0.12], [Math.PI / 2, 0, 0], [0.045, 0.12, 0.045]);                       // crew sock
    add(h, roundedBox(0.4), white, [0, 0.07, -0.045], [0, 0, 0], [0.084, 0.27, 0.08]);                                   // shoe body
    add(h, roundedBox(0.4), white, [0, -0.015, -0.085], [0, 0, 0], [0.078, 0.1, 0.07]);                                  // a low collar around the ankle
    add(h, roundedBox(0.4), pink, [0, 0.0, -0.118], [0, 0, 0], [0.08, 0.034, 0.024]);                                    // collar trim
    add(h, roundedBox(0.4), sole, [0, 0.075, 0.0], [0, 0, 0], [0.088, 0.29, 0.026]);                                     // sole
    add(h, roundedBox(0.4), pink, [0, 0.185, -0.04], [0, 0, 0], [0.086, 0.06, 0.056]);                                   // toe cap
    add(h, box(), dark, [0, 0.105, -0.084], [0, 0, 0], [0.05, 0.11, 0.01]);                                              // tongue/laces
    for (const sx of [-1, 1]) add(h, box(), pink, [sx * 0.043, 0.06, -0.05], [0, 0, 0], [0.008, 0.14, 0.024]);         // side stripes
  }
}

// holder rot/pos are per weapon: the weapon's +Y (barrel / bar / bat length) sits on the wrist's local axes.
const DRESS = {
  biker(a) {
    a.model.scale.x *= 1.12; a.model.scale.z *= 1.1; a.model.scale.y *= 1.03; // burly, taller than the rest
    const h = holder(a, 'Head'); if (h) { bandana(h); shades(h, '#0a0a10', '#0a0a10', 1.6); }
    const w = holder(a, a.hand, WEAPON.biker); if (w) { chainsaw(w); a.aim = { h: w, dir: [-0.1, -0.45, 0.9], roll: 0 }; } // low and forward at the hip
    const t = holder(a, 'Torso', { pos: [0, 0.02, 0] });
    if (t) { // black leather vest with studs and spiked shoulders: the broad, dark biker silhouette
      const leather = mat('#15110f', { roughness: 0.5 }), stud = metal('#e8ecf4'), red = mat('#d41414', { roughness: 0.6 });
      add(t, roundedBox(0.2), leather, [0, -0.04, 0], [0, 0, 0], [0.32, 0.32, 0.21]);
      add(t, box(), red, [0, -0.04, 0.119], [0, 0, 0], [0.03, 0.34, 0.01]);                         // open front, red shirt showing
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) add(t, sphere(5), stud, [sx * 0.15, 0.1 - i * 0.07, 0.118], [0, 0, 0], [0.014, 0.014, 0.014]);
      for (const sx of [-1, 1]) { add(t, roundedBox(0.3), leather, [sx * 0.2, 0.15, 0], [0, 0, sx * -0.25], [0.12, 0.07, 0.2]); for (let i = 0; i < 3; i++) add(t, cone(5), stud, [sx * (0.19 + i * 0.03), 0.2 + (i === 1 ? 0.02 : 0), (i - 1) * 0.05], [0, 0, sx * -0.9], [0.03, 0.09, 0.03]); }
    }
  },
  mallCop(a) {
    // the Worker body already has a moustache (and its hard hat was dropped at build time): cap + aviators only
    const h = holder(a, 'Head'); if (h) { copCap(h); shades(h, '#4a5a68', '#e8c040', 1.5, true); }
    const w = holder(a, a.hand, WEAPON.mallCop); if (w) { shotgun(w); a.aim = { h: w, dir: [-0.4, 0.7, 0.55], roll: 0 }; } // barrel up across the chest
    const t = holder(a, 'Torso', { pos: [0, 0.02, 0] });
    if (t) { // navy uniform shirt, bright gold badge, shoulder epaulettes, duty belt: reads as security from afar
      const navy = mat('#1c3070', { roughness: 0.6 }), gold = metal('#ffd23a', { emissive: '#a07800', emissiveIntensity: 0.5 }), black = mat('#0a0c14', { roughness: 0.4 });
      add(t, roundedBox(0.2), navy, [0, -0.04, 0], [0, 0, 0], [0.35, 0.34, 0.225]);
      add(t, box(), black, [0, -0.2, 0.0], [0, 0, 0], [0.37, 0.05, 0.24]);                               // duty belt
      add(t, box(), gold, [0, -0.2, 0.121], [0, 0, 0], [0.05, 0.04, 0.012]);                             // buckle
      add(t, roundedBox(0.3), gold, [0.085, 0.07, 0.121], [0, 0, 0], [0.07, 0.085, 0.014]);             // badge
      for (const sx of [-1, 1]) add(t, box(), gold, [sx * 0.19, 0.155, 0], [0, 0, sx * -0.2], [0.09, 0.02, 0.1]);
    }
  },
  skater(a) {
    const h = holder(a, 'Head'); if (h) backCap(h);
    highTops(a);
    const w = holder(a, a.hand, WEAPON.skater); if (w) { spikedBat(w); a.aim = { h: w, dir: [0.15, 0.7, -0.55], roll: 0 }; } // bat up over the shoulder
    const t = holder(a, 'Torso', { pos: [0, 0.02, 0] });
    if (t) { // a neon pink/teal backpack with straps: the loudest silhouette of the four
      const pink = mat('#ff3fb0', { roughness: 0.5, emissive: '#a01070', emissiveIntensity: 0.4 }), teal = mat('#20e0d0', { roughness: 0.5, emissive: '#087870', emissiveIntensity: 0.4 }), yel = mat('#ffe020', { roughness: 0.5 });
      add(t, roundedBox(0.25), pink, [0, -0.02, -0.17], [0, 0, 0], [0.28, 0.34, 0.14]);
      add(t, box(), teal, [0, -0.02, -0.245], [0, 0, 0], [0.2, 0.05, 0.02]);
      add(t, box(), yel, [0, 0.12, -0.245], [0, 0, 0], [0.2, 0.05, 0.02]);
      for (const sx of [-1, 1]) add(t, box(), teal, [sx * 0.1, 0.02, 0.0], [0, 0, 0], [0.04, 0.4, 0.23]);
    }
  },
  mallGoth(a) {
    // PunkF's ripped black legs already read as her skirt/ripped look: no extra skirt
    const w = holder(a, a.hand, WEAPON.mallGoth); if (w) { hairspray(w); a.aim = { h: w, dir: [-0.15, 0.4, 0.9], roll: 0 }; } // can up and forward
    const t = holder(a, 'Torso', { pos: [0, 0.02, 0] });
    if (t) {
      boombox(t, { chest: 0.1, chestD: 1 });
      const purple = mat('#7a22d8', { roughness: 0.5, emissive: '#4a0a9a', emissiveIntensity: 0.6 }), black = mat('#0a0810', { roughness: 0.5 });
      add(t, roundedBox(0.2), black, [0, -0.05, 0], [0, 0, 0], [0.31, 0.3, 0.2]);                              // black corset
      for (let i = 0; i < 4; i++) add(t, box(), purple, [0, 0.03 - i * 0.07, 0.102], [0, 0, 0], [0.03, 0.012, 0.008]); // purple lacing
      add(t, cylinder(0.15, 0.27, 16), purple, [0, -0.25, 0], [0, 0, 0], [1, 0.12, 1]);                       // flared purple tutu
    }
    const h = holder(a, 'Head'); if (h) { // spiked choker
      const { y, r } = HEAD; const c = metal('#d8d8e8');
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; add(h, cone(5), c, [Math.sin(an) * r * 0.7, y - r * 1.25, Math.cos(an) * r * 0.7], [Math.cos(an) * 1.2, 0, -Math.sin(an) * 1.2], [0.02, 0.05, 0.02]); }
    }
  },
};

export function dressSurvivor(actor, cls) {
  actor.hand = 'Wrist.R'; // the Modular clips swing the right arm for guns, swords and punches
  measureHead(actor);
  DRESS[cls](actor);
}

// The Grim Shopper: an oxblood apron with a grimy hem, a mall name tag, a wire shopping basket on the
// left wrist with a glowing green jar in it, and two burning red eyes (props, so they keep glowing in a hurt flash).
export function dressShopper(actor) {
  measureHead(actor);
  const h = holder(actor, 'Head');
  if (h) {
    const { y, r, zf } = HEAD;
    const eye = mat('#ff2a1a', { roughness: 0.4, emissive: '#ff2a1a', emissiveIntensity: 3 });
    for (const s of [-1, 1]) add(h, sphere(8), eye, [s * r * 0.4, y - r * 0.08, zf - r * 0.02], [0, 0, 0], [r * 0.13, r * 0.1, r * 0.1]);
  }
  const t = holder(actor, 'Torso', { pos: [0, 0.02, 0] });
  if (t) {
    const apron = mat('#4a0e12', { roughness: 0.9 }), hem = mat('#2a1a14', { roughness: 0.95 });
    add(t, roundedBox(0.2), apron, [0, -0.03, 0.115], [0.04, 0, 0], [0.27, 0.42, 0.03]);             // the apron, bib to knee
    add(t, box(), hem, [0, -0.23, 0.128], [0.04, 0, 0], [0.275, 0.07, 0.02]);                         // grimy hem
    for (const sx of [-1, 1]) add(t, box(), apron, [sx * 0.085, 0.14, 0.05], [0.5, 0, 0], [0.025, 0.02, 0.2]); // neck straps
    add(t, box(), mat('#e8e0c8', { roughness: 0.6 }), [0.07, 0.1, 0.134], [0.04, 0, 0], [0.07, 0.04, 0.012]);  // name tag
    add(t, box(), mat('#b01818'), [0.07, 0.113, 0.141], [0.04, 0, 0], [0.07, 0.012, 0.004]);                    // its red stripe
  }
  const w = holder(actor, 'Wrist.L', { pos: [0, 0.02, 0] });
  if (w) {
    const wire = metal('#9aa0a8');
    add(w, box(), wire, [0, 0.19, 0], [0, 0, 0], [0.2, 0.012, 0.14]);                                  // basket floor
    for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(w, box(), wire, [bx * 0.1, 0.14, bz * 0.07], [0, 0, 0], [0.012, 0.1, 0.012]); // corner posts
    for (const sz of [-1, 1]) add(w, box(), wire, [0, 0.1, sz * 0.07], [0, 0, 0], [0.2, 0.012, 0.012]);  // rims
    for (const sx of [-1, 1]) add(w, box(), wire, [sx * 0.1, 0.1, 0], [0, 0, 0], [0.012, 0.012, 0.14]);
    add(w, box(), wire, [0, 0.06, 0], [0, 0, 0], [0.012, 0.012, 0.14]);                                  // handle
    add(w, cylinder(1, 1, 10), mat('#60ff40', { roughness: 0.3, emissive: '#40e020', emissiveIntensity: 1.6 }), [0.01, 0.145, 0], [0, 0, 0], [0.04, 0.09, 0.04]); // glowing jar
  }
}

// Cheap zombie outfit variants on top of the shared bodies: a food-court visor, a security cap...
const grimeMats = {};
export function dressZombie(actor, variant) {
  if (!variant || !actor.bone('Head')) return;
  measureHead(actor);
  const h = holder(actor, 'Head');
  if (!h) return;
  const { y, r, zc, zf } = HEAD;
  const grime = (c) => (grimeMats[c] ||= mat(c, { roughness: 0.95 })); // shared: not one material per spawned zombie
  if (variant === 1) { // food-court visor, hanging off
    add(h, cylinder(1, 1, 14), grime('#8a1a1a'), [0, y + r * 0.45, zc], [0.1, 0, 0.2], [r * 1.05, r * 0.16, r * 1.07]);
    add(h, box(), grime('#8a1a1a'), [r * 0.1, y + r * 0.42, zf + r * 0.12], [0.3, 0, 0.2], [r * 1.0, r * 0.06, r * 0.6]);
  } else if (variant === 2) { // a tilted, torn security cap and a loose tie
    add(h, cylinder(1, 1, 14), grime('#233252'), [r * 0.12, y + r * 0.55, zc], [0.18, 0, -0.3], [r * 1.0, r * 0.4, r * 1.02]);
    add(h, box(), grime('#0c0f1a'), [r * 0.3, y + r * 0.42, zf + r * 0.02], [0.25, 0, -0.3], [r * 0.9, r * 0.05, r * 0.5]);
  }
}

// ---------- the four zombie types: glowing eyes, sunken sockets, bloody mouth, per-type gear ----------
// One merged, vertex-coloured, UNLIT face mesh per type (dark sockets + bright eyes + gore around the mouth)
// and one additive glow sprite per zombie, so the eyes read from across the room: two extra draws per zombie.

const faceGeos = new Map();
const faceMats = new Map();
let glowTex = null;
const glowMats = new Map();

function part(geo, color, pos, scale) {
  const g = geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion(), new THREE.Vector3(...scale)));
  const c = new THREE.Color(color);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  return g.index ? g.toNonIndexed() : g;
}

function faceGeometry(type) {
  if (faceGeos.has(type)) return faceGeos.get(type);
  const { y, r, zf } = HEAD, look = UNDEAD_LOOK[type];
  const S = new THREE.SphereGeometry(1, 8, 6), B = new THREE.BoxGeometry(1, 1, 1);
  const eyeY = y - r * 0.05, z = zf - r * 0.04;
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push(part(S, '#050202', [s * r * 0.42, eyeY, z - r * 0.02], [r * 0.38, r * 0.34, r * 0.18]));      // sunken socket
    parts.push(part(S, look.eye, [s * r * 0.42, eyeY, z + r * 0.06], [r * 0.27, r * 0.2, r * 0.12]));       // the glowing eye
  }
  parts.push(part(B, '#4a0606', [0, y - r * 0.78, z - r * 0.02], [r * 0.95, r * 0.34, r * 0.18]));          // blood-smeared mouth
  parts.push(part(B, '#7a0a0a', [r * 0.2, y - r * 1.1, z - r * 0.02], [r * 0.14, r * 0.5, r * 0.1]));       // dribble
  if (type === 'z_spitter') {
    parts.push(part(B, '#88b830', [-r * 0.12, y - r * 1.2, z - r * 0.0], [r * 0.12, r * 0.85, r * 0.1]));   // acid drool
    parts.push(part(S, '#a8d048', [-r * 0.12, y - r * 1.65, z - r * 0.0], [r * 0.16, r * 0.2, r * 0.14]));
  }
  const g = mergeGeometries(parts);
  faceGeos.set(type, g);
  return g;
}

function glowSprite(color) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  }
  let m = glowMats.get(color);
  if (!m) { m = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8, fog: false }); glowMats.set(color, m); }
  return new THREE.Sprite(m);
}

const gutMat = mat('#b4a58a', { roughness: 0.55, emissive: '#2a2a10', emissiveIntensity: 0.25 }); // distended, skin-toned belly
const veinMat = mat('#6a7a4a', { roughness: 0.6 });
const pustMat = mat('#b8d870', { emissive: '#80b020', emissiveIntensity: 0.7 });
const fleshMat = mat('#7a0c10', { roughness: 0.5, emissive: '#300004', emissiveIntensity: 0.5 });
const boneMat = mat('#e8e0c8', { roughness: 0.7 });

export function dressUndead(actor, type, variant) {
  if (!actor.bone('Head')) return;
  measureHead(actor);
  const look = UNDEAD_LOOK[type];
  const h = holder(actor, 'Head');
  if (h) {
    if (!faceMats.has('f')) faceMats.set('f', new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    const face = new THREE.Mesh(faceGeometry(type), faceMats.get('f'));
    h.add(face);
    const sp = glowSprite(look.glow);
    sp.position.set(0, HEAD.y - HEAD.r * 0.05, HEAD.zf + HEAD.r * 0.1);
    const gs = type === 'z_brute' ? 0.5 : 0.42; // a tight glow around the eyes only (head ~0.4 prop-metres wide)
    sp.scale.set(gs * 1.2, gs * 0.6, 1);
    h.add(sp);
  }
  if (type === 'z_spitter') { // a swollen, glowing acid gut
    const t = holder(actor, 'Torso', { pos: [0, 0.02, 0] });
    if (t) {
      // a FRONT belly hanging forward and down below the chest (nothing behind the spine, so it never reads as a shell)
      add(t, sphere(10), gutMat, [0, -0.2, 0.15], [0, 0, 0], [0.15, 0.16, 0.13]);
      const pus = [[-0.06, -0.14, 0.27, 0.03], [0.06, -0.19, 0.28, 0.036], [0.0, -0.27, 0.26, 0.028], [0.1, -0.1, 0.23, 0.024], [-0.09, -0.24, 0.24, 0.026]];
      for (const [px, py, pz, ps] of pus) add(t, sphere(6), pustMat, [px, py, pz], [0, 0, 0], [ps, ps, ps * 0.6]);
      add(t, sphere(6), veinMat, [0.0, -0.12, 0.278], [0, 0, 0], [0.08, 0.03, 0.015]);
    }
  }
  if (type === 'z_brute') { // oversized fists
    for (const w of ['WristL', 'WristR']) { const b = actor.bone(w); if (b) b.scale.multiplyScalar(1.4); }
  }
  if (variant === 2 && (type === 'z_walker' || type === 'z_sprinter')) { // right forearm torn off at the elbow
    const b = actor.bone('LowerArmR');
    if (b) {
      b.scale.setScalar(0.001);
      const st = holder(actor, 'LowerArmR', { scale: 1000 });
      if (st) { add(st, sphere(8), fleshMat, [0, 0.02, 0], [0, 0, 0], [0.055, 0.05, 0.055]); add(st, sphere(6), boneMat, [0, 0.05, 0], [0, 0, 0], [0.022, 0.03, 0.022]); }
    }
  }
}
