// Builds the survivor and zombie character meshes from the Quaternius "Ultimate Modular Men" and
// "Ultimate Modular Women" packs (February 2022, CC0 1.0):
//   https://quaternius.com/packs/ultimatemodularcharacters.html
//   https://quaternius.com/packs/ultimatemodularwomen.html
// Normal adult proportions (about 7 heads tall) on ONE shared 62-joint "CharacterArmature" with 24
// baked clips. The packs have no textures (named materials with flat colours), so this script
// bakes every character into ONE vertex-coloured, single-draw-call mesh (re-colouring the
// materials to the Mall of the Dead looks and painting wounds on the undead), strips the clips out
// of the character files and writes one shared animation library, then meshopt-compresses it all.
//
//   Source GLBs (poly.pizza mirrors the packs with direct links, no login):
//     PunkM.glb      https://poly.pizza/m/BTALZymknF  (Men's Punk,         CC0)  -> ch_biker
//     Worker.glb     https://poly.pizza/m/Yg2bQZO6Hj  (Men's Worker,       CC0)  -> ch_mallCop (hard hat dropped)
//     Beach.glb      https://poly.pizza/m/DojKLcO34E  (Men's Beach,        CC0)  -> ch_skater
//     PunkF.glb      https://poly.pizza/m/djXoqejw6w  (Women's Punk,       CC0)  -> ch_mallGoth
//     Casual.glb     https://poly.pizza/m/kZ3DmIoGip  (Men's Casual,       CC0)  -> ch_zombie_walker
//     Farmer.glb     (Men's Farmer, Ultimate Modular Men)                         -> ch_zombie_sprinter (hat dropped)
//     Hoodie.glb     (Men's Hoodie, Ultimate Modular Men)                         -> ch_zombie_brute
//     AnimatedWoman2.glb (Women's Casual, Ultimate Modular Women)                 -> ch_zombie_spitter
//     BusinessMan.glb (Men's Suit, Ultimate Modular Men)                          -> ch_zombie_shopper (The Grim Shopper)
//   (ch_giant, Mulchmaw, is NOT rebuilt here: it is the older Ultimate Monsters "Giant" and keeps its own file.)
//   Put them all in one directory, then:
//     node tools/build-characters.mjs <dir>
//
// Every modular file has the identical rig and clip names, so the clips are extracted once into anims_survivor.glb
// (from PunkM) and shared by every male survivor and zombie; the women (Goth, Spitter) share anims_women.glb. Clip names lose the "CharacterArmature|" prefix.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-characters.mjs <dir-with-glbs> [chars]'); process.exit(1); }
const out = new URL('../assets/models/', import.meta.url).pathname;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// ---------- colour helpers ----------
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (h) => hexRgb(h).map(toLin);
const noise = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (x, y, z, f) => { // cheap value noise on a lattice, so wounds are blotches, not static
  const X = x * f, Y = y * f, Z = z * f, ix = Math.floor(X), iy = Math.floor(Y), iz = Math.floor(Z);
  const fx = X - ix, fy = Y - iy, fz = Z - iz, u = (t) => t * t * (3 - 2 * t);
  const c = (a, b, d) => noise(ix + a, iy + b, iz + d);
  const l = (a, b, t) => a + (b - a) * u(t);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const SKIN = /^Skin/;

// ---------- per-character looks ----------
// colors: material name -> sRGB hex (or (noise) => hex); 'Mat@Part' (Head|Body|Legs|Feet|Pants) beats 'Mat'.
// Unlisted materials keep the pack's own colour. drop: [mesh-name regex, material] primitives to remove.
// undead: { skin, cloth (0..1 how far clothes rot toward grime), wounds (strength) }.
const LEATHER = '#1b191d';
const SPECS = {
  PunkM: { // Biker: leather vest, jeans, red accents; the mohawk makes way for the bandana prop
    out: 'ch_biker', drop: [[/Head$/, 'Red'], [/Head$/, 'Red_Dark']],
    colors: { Skin: '#d29a70', Black: LEATHER, White: '#a82424', LightBlue: '#26324a', Earrings: '#d8b040', Eyebrows: '#20140c', Eye: '#101010' },
  },
  Worker: { // Mall Cop: sky shirt, navy trousers, gold trim; the yellow hard hat is a separate primitive: dropped
    out: 'ch_mallCop', drop: [[/Head$/, 'Worker_Yellow']],
    colors: {
      Skin: '#e0a878', Worker_Vest: '#6a9ad8', 'Worker_Yellow@Body': '#6a9ad8', LightBrown: '#6a9ad8', Brown: '#16254a', Brown2: '#0f1a38',
      Black: '#14141a', Grey: '#1a1a20', Eyebrows: '#1a120c', Moustache: '#1a120c', Eye: '#101010',
    },
  },
  Beach: { // Skater: green tee, navy shorts, pink accents, white socks and high-tops
    out: 'ch_skater',
    colors: {
      Skin: '#c19364', LightBrown: '#38c870', 'Red_Dark@Legs': '#1c2a5c', 'White@Legs': '#ff5ad0', 'Red_Dark@Feet': '#f2f2f2', Hair: '#2a1a10',
      Eyebrows: '#20140c', Eye: '#101010', Earrings: '#ff5ad0',
    },
  },
  PunkF: { // Mall Goth: pale, black, electric purple hair and top
    out: 'ch_mallGoth',
    colors: {
      Skin: '#e2d2e0', 'Pink@Head': '#7a2ab0', 'Pink@Body': '#5a2090', Black: '#14101c', Grey: '#2a2630', Hair_Brown: '#14101c', Brown: '#40e0ff',
    },
  },
  Casual: { // Walker: gaunt dead shopper
    out: 'ch_zombie_walker', drop: [[/Head$/, 'Hair']], // bald and rotting: the pack's hair read as a sporty tuft
    colors: { Skin: '#74b04c', Skin_Darker: '#4f7a34', LightBrown: '#a89c88', LightBlue: '#33404c', White: '#d8c8b0', Red_Dark: '#6a2a2a', Hair: '#2a2218', Eye: '#e8e8b0', Eyebrows: '#2a2218' },
    undead: { cloth: 0.35, wounds: 1 },
  },
  Farmer: { // Sprinter: emaciated, jaundiced, torn overalls (hat dropped)
    out: 'ch_zombie_sprinter', drop: [[/Head$/, 'Beige'], [/Head$/, 'Red']],
    colors: { Skin: '#b4c040', Brown: '#7a4a2a', 'Beige@Body': '#d8c880', LightBlue: '#8a2a1e', Brown2: '#4a3828', Eye: '#f0f0a0', Eyebrows: '#2a2218' },
    undead: { cloth: 0.3, wounds: 1.2 },
  },
  Hoodie: { // Brute: grey slab of meat in a torn dark hoodie
    out: 'ch_zombie_brute', drop: [[/Head$/, 'Hair']],
    colors: { Skin: '#8a9ca2', Purple: '#1c2236', LightBlue: '#26324a', White: '#c8c8c0', Hair: '#1c1c20', Eye: '#d8e0e0', Eyebrows: '#1c1c20' },
    undead: { cloth: 0.3, wounds: 1.5 },
  },
  BusinessMan: { // The Grim Shopper: a grey, upright undead mall manager in a funeral suit with a blood-red tie
    out: 'ch_zombie_shopper',
    colors: { Skin: '#9aa39a', Suit: '#1c1a24', White: '#b8b09a', Tie: '#6a0f14', Black: '#0a0a0c', Hair: '#c8c4bc', Eye: '#ff3020', Eyebrows: '#3a3830' },
    undead: { cloth: 0.15, wounds: 0.35 },
  },
  AnimatedWoman2: { // Spitter: toxic-green skin, cream smock
    out: 'ch_zombie_spitter',
    colors: { Skin: '#6cd038', White: '#d8cfa4', Orange: '#cfc79a', Grey: '#3a3a30', Hair_Blond: '#8a9a46', Hair_Brown: '#2a3010', Brown: '#7fff3a' },
    undead: { cloth: 0.25, wounds: 0.9, goo: true },
  },
};

const jointGroup = (j) => (/^Head|^Neck/.test(j) ? 'head' : /^Foot/.test(j) ? 'foot' : /Arm|Shoulder|Index|Middle|Pinky|Ring|Thumb|Wrist/.test(j) ? 'arm' : 'body');
const WOUNDABLE = /^(Hips|Abdomen|Torso|Chest|Body|UpperArm|LowerArm|Head|Neck|Shoulder|LowerLeg|UpperLeg|Foot)/;

async function build(name, spec) {
  const doc = await io.read(join(src, `${name}.glb`));
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const jn = skin.listJoints().map((j) => j.getName());
  const buffer = root.listBuffers()[0];
  const P = [], N = [], J = [], W = [], C = [], I = [];
  let base = 0, skinNode = null;
  const p = [0, 0, 0];

  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    skinNode ||= node;
    const part = mesh.getName().split('_').pop();
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const mname = mat ? mat.getName() : '';
      if ((spec.drop || []).some(([re, m]) => re.test(mesh.getName()) && m === mname)) continue;
      const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), jo = prim.getAttribute('JOINTS_0'), we = prim.getAttribute('WEIGHTS_0');
      const n = pos.getCount();
      const hex = spec.colors[`${mname}@${part}`] ?? spec.colors[mname];
      const orig = mat ? mat.getBaseColorFactor().slice(0, 3) : [1, 1, 1]; // already linear
      const isSkin = SKIN.test(mname), isEye = /^Eye$/.test(mname);
      const u = spec.undead;
      const w4 = [0, 0, 0, 0], j4 = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, p); P.push(p[0], p[1], p[2]);
        const q = nor.getElement(i, [0, 0, 0]); N.push(q[0], q[1], q[2]);
        jo.getElement(i, j4); we.getElement(i, w4); J.push(j4[0], j4[1], j4[2], j4[3]); W.push(w4[0], w4[1], w4[2], w4[3]);
        pos.getElement(i, p);
        let k = 0; for (let t = 1; t < 4; t++) if (w4[t] > w4[k]) k = t;
        const joint = jn[j4[k]] || '';
        let rgb = typeof hex === 'function' ? lin(hex(smooth(p[0], p[1], p[2], 1100))) : hex ? lin(hex) : orig;
        if (u) {
          if (!isSkin && !isEye && !/^Eyebrows|^Hair/.test(mname)) { // rags: faded, filthy, stained
            rgb = mix(rgb, lin('#2e2c24'), u.cloth);
            if (smooth(p[0] + 7, p[1], p[2], 420) > 0.62) rgb = mix(rgb, lin('#1c1812'), 0.55);
          }
          if (WOUNDABLE.test(joint) && !isEye && !/^Hair|^Eyebrows/.test(mname)) { // hair and brows stay hair-coloured (no red tufts)
            const face = /^Head|^Neck/.test(joint), s = smooth(p[0], p[1], p[2], face ? 1300 : 620), d = smooth(p[0] + 3, p[1], p[2], 260), kk = face ? u.wounds * 0.4 : u.wounds;
            if (s > 0.8 - 0.04 * kk) rgb = mix(rgb, lin(s > 0.86 ? '#4a0606' : '#9a1212'), 0.92); // raw wounds, dark at the core
            else if (d > 0.66) rgb = mix(rgb, lin(u.goo ? '#5ac030' : '#3a4a22'), 0.55);            // rot / bruising (goo for the spitter)
            else if (s < 0.2 && isSkin) rgb = mix(rgb, lin('#241a12'), 0.6);                          // grime
          }
        }
        C.push(rgb[0], rgb[1], rgb[2]);
      }
      const ind = prim.getIndices();
      for (let i = 0; i < ind.getCount(); i++) I.push(ind.getScalar(i) + base);
      base += n;
    }
  }

  // one mesh, one primitive, one material: a single draw call per character
  const acc = (type, arr, Ctor) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buffer);
  const material = doc.createMaterial('Character').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85);
  const prim = doc.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', acc('VEC3', P, Float32Array)).setAttribute('NORMAL', acc('VEC3', N, Float32Array))
    .setAttribute('JOINTS_0', acc('VEC4', J, Uint16Array)).setAttribute('WEIGHTS_0', acc('VEC4', W, Float32Array))
    .setAttribute('COLOR_0', acc('VEC3', C, Float32Array)).setIndices(acc('SCALAR', I, Uint32Array));
  const mesh = doc.createMesh('Body').addPrimitive(prim);
  for (const node of root.listNodes()) if (node.getMesh() && node !== skinNode) node.dispose();
  skinNode.setMesh(mesh).setName('Body');

  // the character files carry no clips: they all use anims_survivor.glb
  for (const a of root.listAnimations()) { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); }
  await doc.transform(prune(), dedup());
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizationVolume: 'scene' }));
  const path = join(out, `${spec.out}.glb`);
  await io.write(path, doc);
  console.log(`${spec.out}.glb`.padEnd(30), `${Math.round(statSync(path).size / 1024)} KB`, `(${P.length / 3} verts)`);
}

// optional 2nd argument: 'chars' rebuilds the characters only (leaves the shared animation libraries as they are)
const charsOnly = process.argv[3] === 'chars';
for (const [name, spec] of Object.entries(SPECS)) await build(name, spec);
if (charsOnly) process.exit(0);

// ---------- the shared animation libraries: the pack's clips on a bare armature ----------
// All Men's files share one rest pose; the Women's files share a different one (arms and legs sit
// differently in the bind), so the women get their own library baked on their rest pose.
// Only clips the game maps are kept. Finger tracks are dropped (invisible at this scale) and only
// the root bones keep translation, which cuts the library to a fraction of its size.
for (const [srcName, outName] of [['PunkM', 'anims_survivor'], ['PunkF', 'anims_women']]) {
  const KEEP = new Set(['Death', 'Gun_Shoot', 'HitRecieve', 'HitRecieve_2', 'Idle', 'Idle_Gun', 'Idle_Gun_Pointing', 'Idle_Gun_Shoot', 'Idle_Sword', 'Interact',
    'Kick_Right', 'Punch_Left', 'Punch_Right', 'Roll', 'Run', 'Run_Shoot', 'Sword_Slash', 'Walk', 'Wave']);
  const doc = await io.read(join(src, `${srcName}.glb`));
  const root = doc.getRoot();
  for (const n of root.listNodes()) if (n.getMesh()) n.dispose();
  for (const a of root.listAnimations()) {
    const base = a.getName().replace(/^.*\|/, '');
    a.setName(base);
    if (!KEEP.has(base)) { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); continue; }
    for (const c of a.listChannels()) {
      const bone = c.getTargetNode().getName();
      if (/Index|Middle|Ring|Pinky|Thumb/.test(bone) || (c.getTargetPath() === 'translation' && !/^(Root|Body|Hips)$/.test(bone))) {
        const s = c.getSampler(); c.dispose(); if (s.listParents().filter((x) => x.propertyType === 'AnimationChannel').length === 0) s.dispose();
      }
    }
  }
  await doc.transform(prune({ keepLeaves: true }), resample({ tolerance: 0.001 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizationVolume: 'mesh' }));
  const path = join(out, `${outName}.glb`);
  await io.write(path, doc);
  console.log(`${outName}.glb`.padEnd(30), `${Math.round(statSync(path).size / 1024)} KB`);
}
