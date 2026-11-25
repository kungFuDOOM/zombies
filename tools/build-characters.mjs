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
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-characters.mjs <dir-with-glbs> [chars]'); process.exit(1); }
const out = new URL('../assets/models/', import.meta.url).pathname;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
// ONLY=Casual,Farmer limits the rebuild to those specs (the rest of assets/models stays byte-identical)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
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
    out: 'ch_zombie_walker', simplify: 0.5, drop: [[/Head$/, 'Hair']], // bald and rotting: the pack's hair read as a sporty tuft
    colors: { Skin: '#aab69c', Skin_Darker: '#76816b', LightBrown: '#d8d2c0', LightBlue: '#7a8ea4', White: '#e2dac8', Red_Dark: '#8a3a34', Hair: '#2a2218', Eye: '#fff6a0', Eyebrows: '#2a2218' },
    undead: { cloth: 0.1, wounds: 1.4, bib: 1 },
  },
  Farmer: { // Sprinter: emaciated, jaundiced, torn overalls (hat dropped)
    out: 'ch_zombie_sprinter', simplify: 0.5, drop: [[/Head$/, 'Beige'], [/Head$/, 'Red']],
    colors: { Skin: '#bcb890', Brown: '#a8764c', 'Beige@Body': '#e6dcae', LightBlue: '#b04434', Brown2: '#7a6048', Eye: '#ffd0a0', Eyebrows: '#2a2218' },
    undead: { cloth: 0.1, wounds: 1.6, bib: 1 },
  },
  Hoodie: { // Brute: grey slab of meat in a torn dark hoodie
    out: 'ch_zombie_brute', simplify: 0.5, drop: [[/Head$/, 'Hair']],
    colors: { Skin: '#92a3a8', Purple: '#56608a', LightBlue: '#3e4e72', White: '#d8d8d0', Hair: '#1c1c20', Eye: '#ffc890', Eyebrows: '#1c1c20' },
    undead: { cloth: 0.1, wounds: 1.8, bib: 1.15 },
  },
  BusinessMan: { // The Grim Shopper: a grey, upright undead mall manager in a funeral suit with a blood-red tie
    out: 'ch_zombie_shopper',
    colors: { Skin: '#9aa39a', Suit: '#1c1a24', White: '#b8b09a', Tie: '#6a0f14', Black: '#0a0a0c', Hair: '#c8c4bc', Eye: '#ff3020', Eyebrows: '#3a3830' },
    undead: { cloth: 0.15, wounds: 0.35 },
  },
  AnimatedWoman2: { // Spitter: toxic-green skin, cream smock
    out: 'ch_zombie_spitter', simplify: 0.5,
    colors: { Skin: '#a8b88a', White: '#ece2c6', Orange: '#d8d0a4', Grey: '#6a6a58', Hair_Blond: '#8a9a46', Hair_Brown: '#3a4018', Brown: '#a8d860' },
    undead: { cloth: 0.1, wounds: 1.1, goo: true, bib: 0.9 },
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
  // bounding boxes (the meshes are Z-up, facing -y): the whole body, and the Head-joint skin, for the blood paint below
  const bb = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }, hb = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  if (spec.undead) {
    const q = [0, 0, 0], w4 = [0, 0, 0, 0], j4 = [0, 0, 0, 0];
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial(), mname = mat ? mat.getName() : '';
        if ((spec.drop || []).some(([re, m]) => re.test(mesh.getName()) && m === mname)) continue;
        const pos = prim.getAttribute('POSITION'), jo = prim.getAttribute('JOINTS_0'), we = prim.getAttribute('WEIGHTS_0');
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, q);
          for (let a = 0; a < 3; a++) { bb.min[a] = Math.min(bb.min[a], q[a]); bb.max[a] = Math.max(bb.max[a], q[a]); }
          jo.getElement(i, j4); we.getElement(i, w4);
          let k = 0; for (let t = 1; t < 4; t++) if (w4[t] > w4[k]) k = t;
          if (/^Head/.test(jn[j4[k]] || '') && SKIN.test(mname)) for (let a = 0; a < 3; a++) { hb.min[a] = Math.min(hb.min[a], q[a]); hb.max[a] = Math.max(hb.max[a], q[a]); }
        }
      }
    }
  }
  const H = Math.max(1e-6, bb.max[2] - bb.min[2]), cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2;

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
            rgb = mix(rgb, lin('#4a4638'), u.cloth);
            if (smooth(p[0] + 7, p[1], p[2], 420) > 0.7) rgb = mix(rgb, lin('#3a3226'), 0.4);
          }
          // BLOOD that reads from a high camera at ~8 px per head: a big dark-red bib down the chest, a soaked back and
          // shoulders (the camera sees those), red hands, a bloody mouth and chin. Model space: x side, z height, -y front.
          const nx = (p[0] - cx) / H, nz = (p[2] - bb.min[2]) / H, nf = -(p[1] - cy) / H;
          const cloth = !isSkin && !isEye && !/^Eyebrows|^Hair/.test(mname);
          const bk = u.bib || 1, jit = smooth(p[0], p[1], p[2], 300), jit2 = smooth(p[0] + 9, p[1], p[2], 700);
          const bibW = (0.085 + 0.07 * jit) * bk;
          if (cloth && nf > -0.01 && nz > 0.50 && nz < 0.80 - 0.06 * jit && Math.abs(nx) < bibW) rgb = mix(rgb, lin(jit2 > 0.62 ? '#3a0505' : '#6a0b0b'), 0.94); // front bib
          if (cloth && nf < 0.01 && nz > 0.56 && nz < 0.8 && Math.abs(nx) < (0.07 + 0.08 * jit) * bk && jit2 > 0.3) rgb = mix(rgb, lin('#640a0a'), 0.9);       // back soak
          if (cloth && nz > 0.7 && Math.abs(nx) > 0.07 && Math.abs(nx) < 0.2 && jit > 0.5) rgb = mix(rgb, lin('#700c0c'), 0.9);                              // bloody shoulders
          if (cloth && nz > 0.46 && nz < 0.56 && jit2 > 0.55) rgb = mix(rgb, lin('#58080a'), 0.8);                                                            // soaked waist
          if (/^(Wrist|Hand|LowerArm)/.test(joint) && isSkin && (/^Wrist|^Hand/.test(joint) || jit > 0.35)) rgb = mix(rgb, lin('#6a0a0a'), 0.85);          // red hands and forearms
          if (isSkin && /^Head/.test(joint) && hb.max[2] > hb.min[2]) {
            const hh = (p[2] - hb.min[2]) / (hb.max[2] - hb.min[2]), hf = -(p[1] - hb.min[1] - 0) / 1; void hf;
            const fr = (hb.min[1] + hb.max[1]) / 2 - p[1];            // > 0 on the face side (-y)
            if (fr > 0 && hh < 0.34) rgb = mix(rgb, lin('#4a0606'), 0.85);                                 // blood on the mouth and chin
            else if (fr > 0 && hh > 0.36 && hh < 0.52 && Math.abs(p[0] - (hb.min[0] + hb.max[0]) / 2) < (hb.max[0] - hb.min[0]) * 0.34) rgb = mix(rgb, lin('#2a1210'), 0.35); // shadowed eye band
          }
          if (WOUNDABLE.test(joint) && !isEye && !/^Hair|^Eyebrows/.test(mname)) { // hair and brows stay hair-coloured (no red tufts)
            const face = /^Head|^Neck/.test(joint), s = smooth(p[0], p[1], p[2], face ? 1300 : 620), d = smooth(p[0] + 3, p[1], p[2], 260), kk = face ? u.wounds * 0.4 : u.wounds;
            if (s > 0.8 - 0.04 * kk) rgb = mix(rgb, lin(s > 0.86 ? '#4a0606' : '#9a1212'), 0.92); // raw wounds, dark at the core
            else if (d > 0.66) rgb = mix(rgb, lin(u.goo ? '#5ac030' : '#3a4a22'), 0.55);            // rot / bruising (goo for the spitter)
            else if (s < 0.14 && isSkin) rgb = mix(rgb, lin('#3a2c22'), 0.4);                          // grime
          }
        }
        C.push(rgb[0], rgb[1], rgb[2]);
      }
      const ind = prim.getIndices();
      for (let i = 0; i < ind.getCount(); i++) I.push(ind.getScalar(i) + base);
      base += n;
    }
  }

  // Phones are vertex-bound (software skinning on weak GPUs): decimate the horde bodies. The bake leaves every hard edge as
  // split vertices, which the simplifier can't collapse, so weld by position, simplify that, then give every surviving corner
  // the attributes (normal, colour, skin) of the original copy whose normal best matches the new face. Part borders stay locked.
  if (spec.simplify) {
    const nv = P.length / 3, before = I.length / 3, key = (v) => `${P[v * 3].toFixed(6)},${P[v * 3 + 1].toFixed(6)},${P[v * 3 + 2].toFixed(6)}`;
    const wmap = new Map(), WP = [], copies = [], w = new Array(nv);
    for (let v = 0; v < nv; v++) { const k = key(v); let id = wmap.get(k); if (id === undefined) { id = wmap.size; wmap.set(k, id); WP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); copies.push([]); } w[v] = id; copies[id].push(v); }
    const WI = Uint32Array.from(I, (v) => w[v]);
    const [si] = MeshoptSimplifier.simplify(WI, Float32Array.from(WP), 3, Math.floor(WI.length * spec.simplify / 3) * 3, 0.03, ['LockBorder']);
    const used = new Map(); const nP = [], nN = [], nJ = [], nW = [], nC = [], nI = [];
    for (let t = 0; t < si.length; t += 3) {
      const ids = [si[t], si[t + 1], si[t + 2]];
      const p0 = ids.map((id) => [WP[id * 3], WP[id * 3 + 1], WP[id * 3 + 2]]);
      const e1 = p0[1].map((x, i) => x - p0[0][i]), e2 = p0[2].map((x, i) => x - p0[0][i]);
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const fl = Math.hypot(...fn) || 1;
      for (const id of ids) {
        let best = copies[id][0], bd = -2;
        for (const v of copies[id]) { const d = (N[v * 3] * fn[0] + N[v * 3 + 1] * fn[1] + N[v * 3 + 2] * fn[2]) / fl; if (d > bd) { bd = d; best = v; } }
        let k = used.get(best);
        if (k === undefined) { k = used.size; used.set(best, k); const v = best; nP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nN.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); nJ.push(J[v * 4], J[v * 4 + 1], J[v * 4 + 2], J[v * 4 + 3]); nW.push(W[v * 4], W[v * 4 + 1], W[v * 4 + 2], W[v * 4 + 3]); nC.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]); }
        nI.push(k);
      }
    }
    for (const [arr, rep] of [[P, nP], [N, nN], [J, nJ], [W, nW], [C, nC], [I, nI]]) { arr.length = 0; for (const x of rep) arr.push(x); }
    console.log(`  simplified ${before} -> ${I.length / 3} tris, ${nv} -> ${P.length / 3} verts`);
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
for (const [name, spec] of Object.entries(SPECS)) if (!ONLY || ONLY.includes(name)) await build(name, spec);
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
