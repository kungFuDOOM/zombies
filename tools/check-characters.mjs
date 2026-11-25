// Sanity check for the built characters (run after `npm run build-characters`):
//   node tools/check-characters.mjs
// Loads each character GLB in plain three.js and prints its size, head/leg proportions, bone names the
// game relies on, the clips its library provides, and (with --axes) the bind-pose axes of key bones.
import { register } from 'node:module';
import { readFileSync, statSync } from 'node:fs';

// the vendored addons import the bare specifier 'three'; point it at the vendored copy
const threeUrl = new URL('../vendor/three.module.min.js', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`export async function resolve(s, c, n) { return s === 'three' ? { url: '${threeUrl}', shortCircuit: true } : n(s, c); }`)}`);
const THREE = await import(threeUrl);
const { GLTFLoader } = await import('../vendor/addons/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await import('../vendor/addons/libs/meshopt_decoder.module.js');

const dir = new URL('../assets/models/', import.meta.url).pathname;
const load = (name) => new Promise((res, rej) => {
  const b = readFileSync(`${dir}${name}.glb`);
  const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
  l.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej);
});
const CHARS = ['ch_biker', 'ch_mallCop', 'ch_skater', 'ch_mallGoth', 'ch_zombie_walker', 'ch_zombie_sprinter', 'ch_zombie_brute', 'ch_zombie_spitter'];
const NEED = ['Root', 'Body', 'Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'WristL', 'WristR', 'UpperLegL', 'LowerLegL', 'FootL', 'Middle1L', 'Middle1R'];
const WOMEN = new Set(['ch_mallGoth', 'ch_zombie_spitter']);
const libs = { men: await load('anims_survivor'), women: await load('anims_women') };
let bad = 0;
for (const [k, g] of Object.entries(libs)) console.log(`anims_${k}:`, g.animations.length, 'clips:', g.animations.map((c) => c.name).join(' '));
for (const name of CHARS) {
  const g = await load(name), s = g.scene;
  const skinned = []; s.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  s.updateMatrixWorld(true);
  const bone = (n) => s.getObjectByName(n);
  const wp = (n) => bone(n).getWorldPosition(new THREE.Vector3());
  const top = wp('Head').y + (wp('Head').y - wp('Neck').y) * 3.2, foot = wp('FootL').y;
  const H = new THREE.Box3().setFromObject(s); // what assets.js measures
  const total = H.max.y - H.min.y;
  const headTop = new THREE.Box3(); // head vertices only, from the skinned mesh
  const m = skinned[0], P = m.geometry.attributes.position, SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
  const headIdx = m.skeleton.bones.indexOf(bone('Head')), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { let k = 0; for (let q = 1; q < 4; q++) if (SW.getComponent(i, q) > SW.getComponent(i, k)) k = q; if (SI.getComponent(i, k) === headIdx) headTop.expandByPoint(v.fromBufferAttribute(P, i)); }
  const headH = headTop.max.y - headTop.min.y, hipY = wp('Hips').y, legLen = wp('UpperLegL').y - foot;
  const missing = NEED.filter((n) => !bone(n));
  const lib = libs[WOMEN.has(name) ? 'women' : 'men'];
  const hasClips = ['Idle', 'Walk', 'Run', 'Death', 'Sword_Slash', 'Gun_Shoot', 'Punch_Left', 'HitRecieve'].filter((c) => !lib.animations.find((a) => a.name === c));
  const heads = total / Math.max(1e-6, headH);
  const ok = !missing.length && !hasClips.length && skinned.length === 1 && heads > 6.3 && heads < 8.8;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${name.padEnd(20)} ${Math.round(statSync(`${dir}${name}.glb`).size / 1024)}KB meshes=${skinned.length} bones=${m.skeleton.bones.length} height=${total.toFixed(3)} head=${headH.toFixed(3)} (${heads.toFixed(1)} heads) legs=${(legLen / total * 100).toFixed(0)}% of height${missing.length ? ' MISSING ' + missing : ''}${hasClips.length ? ' NOCLIPS ' + hasClips : ''}`);
  void top; void hipY;
}
if (process.argv.includes('--axes')) {
  const g = await load('ch_biker'); g.scene.updateMatrixWorld(true);
  const f = (v) => [v.x, v.y, v.z].map((n) => n.toFixed(2)).join(',');
  for (const n of ['Hips', 'Abdomen', 'Torso', 'Chest', 'Head', 'UpperArmL', 'LowerArmL', 'WristL', 'WristR', 'UpperLegL', 'LowerLegL']) {
    const b = g.scene.getObjectByName(n), q = b.getWorldQuaternion(new THREE.Quaternion());
    console.log(n.padEnd(10), 'X→', f(new THREE.Vector3(1, 0, 0).applyQuaternion(q)), ' Y→', f(new THREE.Vector3(0, 1, 0).applyQuaternion(q)), ' Z→', f(new THREE.Vector3(0, 0, 1).applyQuaternion(q)));
  }
}
process.exit(bad ? 1 : 0);
