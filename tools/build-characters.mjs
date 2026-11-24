// Builds the survivor and zombie character meshes from the Quaternius "Zombie Apocalypse Kit"
// (CC0, https://quaternius.com/packs/zombieapocalypsekit.html). The kit paints its characters with a
// shared 512px swatch atlas; this script bakes that atlas into vertex colours (re-mapping swatches
// to the Mall of the Dead looks and painting wounds on the undead) so the characters need no
// textures, share one material, are tiny, and can be tinted per zombie at runtime.
//
//   Download each model's .glb (poly.pizza mirrors the kit with direct links, no login):
//     https://poly.pizza/m/66kQ4dBBC7 Matt  -> <dir>/zak_matt.glb       https://poly.pizza/m/UcLErL2W37 Sam   -> zak_sam.glb
//     https://poly.pizza/m/eJFT9MxzOM Shaun -> zak_shaun.glb            https://poly.pizza/m/gjuwleUT1U Lis   -> zak_lis.glb
//     https://poly.pizza/m/VlXjG0N8Eg Zombie_Basic -> zak_zombie_a.glb  https://poly.pizza/m/KaVJET0WHx Zombie_Arm -> zak_big_arm.glb
//     https://poly.pizza/m/22K0aSZkHV Zombie_Chubby -> zak_zombie_b.glb https://poly.pizza/m/BldaiPtyJa Giant (Quaternius) -> um_giant.glb
//   node tools/build-characters.mjs <dir>
//
// Survivors share one rig, so their animations are extracted once (anims_survivor.glb); each
// zombie keeps its own clips. Clip names lose the "CharacterArmature|" prefix.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-characters.mjs <dir-with-glbs>'); process.exit(1); }
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
const group = (j) => (/^Head|^Tongue|Mouth|Eyelid|^Neck/.test(j) ? 'head' : /^Foot/.test(j) ? 'foot' : /Arm|Shoulder|Index|Middle|Pinky|Thumb/.test(j) ? 'arm' : 'body');

// ---------- per-character looks: swatch (4-bit hex of the atlas colour) -> sRGB colour ----------
// A key may carry a body-part suffix (@head, @foot, @arm, @body); a value may be a function (hash, pos) => hex.
const LEATHER = '#1b191d';
const SPECS = {
  zak_matt: { out: 'ch_biker', drop: ['Knife'], map: { b61: LEATHER, '464': '#16171c', '466': '#1a1d28', b86: '#c58a62', '742': '#c58a62', bb9: LEATHER, '9a8': '#8a8a90', '321': '#3a1a0c', '222': '#141414' } },
  zak_sam: {
    out: 'ch_mallCop', drop: ['Axe'],
    map: { '544': '#6fb8ee', '222@body': '#1d2d58', '333': '#141c34', a71: '#14224a', '432': '#1a1410', b61: '#e8c040', '931': '#6fb8ee', bb: '#c0c0c8', bbb: '#e0e0e8', '742': '#e0a878' },
  },
  zak_shaun: {
    out: 'ch_skater', drop: ['WoodenBat_Saw'], flipCap: ['466@head', 'ccc@head', 'ccc'],
    map: {
      a83: '#35c24a', '971': '#27963a', '464': '#35c24a', bb9: '#35c24a', '640@body': '#243f9a', '640@foot': '#f2f2f2',
      '962': '#ff4fb8', '432@arm': '#ff4fb8', '466@head': '#ff4fb8', ccc: '#ffd0ec', '466@body': '#243f9a', b86: '#c19364',
    },
  },
  zak_lis: {
    out: 'ch_mallGoth', drop: ['Pistol'],
    map: {
      c96: '#e9e2f0', '258': (h) => (h > 0.4 ? '#a63cff' : '#17101f'), b82: '#121016', '466': '#121016', '622': '#5a2a80', bbb: '#18181c', bb9: '#121016', '432': '#121016',
      '222@body': '#121016',
    },
  },
  zak_zombie_a: {
    out: 'ch_zombie_walker', drop: ['Eyelid'], wounds: 1, anims: true,
    map: { '795': '#76905e', '997': '#d8c8b0', '456': '#33404c', '643': '#4a3828', bbb: '#6a6458', '622': '#4a3a30', '947': '#d8c8b0', '673': '#5a4a38', '833': '#a85a62' },
  },
  zak_big_arm: { out: 'ch_zombie_brute', wounds: 1.4, anims: true, map: { '972': '#61794a', '356': '#4a3a30' } },
  zak_zombie_b: { out: 'ch_zombie_spitter', wounds: 0.8, anims: true, map: { '569': '#8a9a46', '653': '#4a3a30', '997': '#d8e070', '947': '#c8d060', '972': '#7fff3a' } },
  um_giant: { out: 'ch_giant', anims: true, map: {} },
};

const KEEP = new Set(['Idle', 'Walk', 'Run', 'Run_Arms', 'Punch', 'Idle_Attack', 'Run_Attack', 'HitReact', 'Death', 'Attack', 'HitRecieve']);

async function build(name, spec) {
  const doc = await io.read(join(src, `${name}.glb`));
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const jn = skin ? skin.listJoints().map((j) => j.getName()) : [];
  // drop weapons and whatever else the look doesn't want
  for (const n of root.listNodes()) if ((spec.drop || []).includes(n.getName()) || (n.getMesh() && (spec.drop || []).includes(n.getMesh().getName()))) n.dispose();

  for (const m of root.listMeshes()) if ((spec.drop || []).includes(m.getName())) m.listPrimitives().forEach((p) => p.dispose()), m.dispose();
  const mats = new Set(); // materials are shared between prims: strip their texture only once every prim is baked
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const tex = mat && mat.getBaseColorTexture();
    if (!tex) continue;
    mats.add(mat);
    const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const uv = prim.getAttribute('TEXCOORD_0'), pos = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    const n = pos.getCount(), cols = new Float32Array(n * 3);
    // head pivot for flipping a cap backwards
    let hx = 0, hy = 0, hn = 0; // the kit's meshes are Z-up (the armature carries the rotation)
    const jointOf = (i) => { if (!J) return ''; const j = J.getElement(i, []), w = W.getElement(i, []); let k = 0; for (let q = 1; q < 4; q++) if (w[q] > w[k]) k = q; return jn[j[k]] || ''; };
    const p = [0, 0, 0];
    if (spec.flipCap) for (let i = 0; i < n; i++) if (jointOf(i) === 'Head') { pos.getElement(i, p); hx += p[0]; hy += p[1]; hn++; }
    if (hn) { hx /= hn; hy /= hn; }
    const norm = prim.getAttribute('NORMAL');
    for (let i = 0; i < n; i++) {
      const [u, v] = uv.getElement(i, []);
      const x = Math.min(info.width - 1, Math.floor(((u % 1) + 1) % 1 * info.width)), y = Math.min(info.height - 1, Math.floor(((v % 1) + 1) % 1 * info.height));
      const o = (y * info.width + x) * 4;
      const key = [data[o], data[o + 1], data[o + 2]].map((c) => (c >> 4).toString(16)).join('');
      const j = jointOf(i), g = group(j);
      pos.getElement(i, p);
      let rep = spec.map[`${key}@${g}`] ?? spec.map[key];
      let rgb = typeof rep === 'function' ? lin(rep(noise(Math.round(p[0] * 40), Math.round(p[1] * 40), Math.round(p[2] * 40)))) : rep ? lin(rep) : [toLin(data[o] / 255), toLin(data[o + 1] / 255), toLin(data[o + 2] / 255)];
      if (typeof rep === 'function') rgb = lin(rep(smooth(p[0], p[1], p[2], 1100)));
      if (spec.flipCap && (spec.flipCap.includes(`${key}@${g}`) || spec.flipCap.includes(key) && g === 'head')) {
        pos.setElement(i, [2 * hx - p[0], 2 * hy - p[1], p[2]]);
        if (norm) { const q = norm.getElement(i, []); norm.setElement(i, [-q[0], -q[1], q[2]]); }
      }
      if (spec.wounds && /^(Hips|Abdomen|Torso|Body|UpperArm|LowerArm|Head|Neck|Shoulder|LowerLeg|UpperLeg|Foot)/.test(j)) {
        const s = smooth(p[0], p[1], p[2], 620), d = smooth(p[0] + 3, p[1], p[2], 260);
        const k = spec.wounds;
        if (s > 0.8 - 0.04 * k) rgb = mix(rgb, lin(s > 0.86 ? '#4a0606' : '#9a1212'), 0.92);       // raw wounds, dark at the core
        else if (d > 0.66) rgb = mix(rgb, lin('#3a4a22'), 0.55);                                        // rot / bruising
        else if (s < 0.2) rgb = mix(rgb, lin('#241a12'), 0.6);                                        // grime
      }
      cols.set(rgb, i * 3);
    }
    prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(cols).setBuffer(root.listBuffers()[0]));
    prim.setAttribute('TEXCOORD_0', null);
  }
  for (const mat of mats) mat.setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85);

  // animations: strip the prefix and the duplicate unprefixed copies; survivors share one library
  const names = new Set();
  for (const a of root.listAnimations()) {
    const base = a.getName().replace(/^.*\|/, '');
    if (!a.getName().includes('|') && root.listAnimations().some((b) => b.getName().endsWith(`|${base}`))) { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); continue; }
    if (names.has(base)) { a.dispose(); continue; }
    names.add(base);
    a.setName(base);
    if (!KEEP.has(base)) { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); }
  }
  if (!spec.anims) for (const a of root.listAnimations()) { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); }
  await doc.transform(prune(), dedup(), resample());
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizationVolume: 'scene' }));
  const path = join(out, `${spec.out}.glb`);
  await io.write(path, doc);
  console.log(`${spec.out}.glb`.padEnd(30), `${Math.round(statSync(path).size / 1024)} KB`);
}

for (const [name, spec] of Object.entries(SPECS)) await build(name, spec);

// The survivors' shared animation library: Shaun's clips on a bare armature.
{
  const doc = await io.read(join(src, 'zak_shaun.glb'));
  const root = doc.getRoot();
  for (const n of root.listNodes()) if (n.getMesh()) n.dispose();
  for (const a of root.listAnimations()) { a.setName(a.getName().replace(/^.*\|/, '')); if (/^(Duck|No|Jump_Idle|Jump_Land)$/.test(a.getName())) { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); } }
  await doc.transform(prune({ keepLeaves: true }), resample());
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizationVolume: 'mesh' }));
  const path = join(out, 'anims_survivor.glb');
  await io.write(path, doc);
  console.log('anims_survivor.glb'.padEnd(30), `${Math.round(statSync(path).size / 1024)} KB`);
}
