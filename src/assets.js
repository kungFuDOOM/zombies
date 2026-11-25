// Loads the CC0 KayKit models (see assets/CREDITS.md) and provides animated character
// instances. Every character shares one rig, so one animation library drives them all.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildHero } from './heroes.js';
import { buildMonster, BUILT_MONSTERS } from './monsters.js';
import { dressSurvivor, dressZombie, dressShopper, dressUndead } from './charProps.js';
import { undeadMaterial } from './undead.js';

export const MODEL_SCALE = 16; // KayKit metres -> game units (one tile = 32 units = 2 m)

// Survivors and monsters are built in heroes.js / monsters.js on the bare rig from 'rig.glb'.
export const HERO_CLASSES = ['biker', 'mallCop', 'skater', 'mallGoth', 'ray', 'clerk'];
export const HERO_SCALE = 27; // adult heroes are ~1.75 m tall -> ~47 game units
const PROPS = ['barrel', 'food_b'];

// Quaternius "Ultimate Modular Men / Women" characters (CC0, see assets/CREDITS.md): adult, ~7.5 heads
// tall, all on one 62-joint 'CharacterArmature', baked to one vertex-coloured mesh each by
// tools/build-characters.mjs. Survivors AND zombies share the clip libraries (anims_survivor.glb for
// the men; the women's rest pose differs, so anims_women.glb). Mulchmaw ('giant', Ultimate Monsters)
// is a different pack with its own rig and clips.
const NATIVE = {
  biker: 'ch_biker', mallCop: 'ch_mallCop', skater: 'ch_skater', mallGoth: 'ch_mallGoth',
  z_walker: 'ch_zombie_walker', z_sprinter: 'ch_zombie_sprinter', z_brute: 'ch_zombie_brute', z_spitter: 'ch_zombie_spitter', z_shopper: 'ch_zombie_shopper', giant: 'ch_giant',
};
// Game units for the model's full bounding height (hair spikes and all).
const NATIVE_HEIGHT = { biker: 50, mallCop: 47, skater: 47, mallGoth: 45, z_walker: 46, z_sprinter: 46, z_brute: 46, z_spitter: 43, z_shopper: 48, giant: 150 };
export const NATIVE_SURVIVORS = ['biker', 'mallCop', 'skater', 'mallGoth'];
const MODULAR = ['biker', 'mallCop', 'skater', 'mallGoth', 'z_walker', 'z_sprinter', 'z_brute', 'z_spitter', 'z_shopper'];
const WOMEN = ['mallGoth', 'z_spitter'];
export const ZOMBIE_VARIANT_TINT = [null, '#c4cdb0', '#e2c8a4'];

export const assets = { chars: {}, props: {}, clips: {}, survClips: {}, womenClips: {}, ready: false };

export async function loadAssets(onProgress = () => {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const names = [...PROPS, ...Object.values(NATIVE), 'anims_survivor', 'anims_women', 'anims', 'rig'];
  let done = 0;
  const load = async (name) => {
    const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
    if (name === 'anims_survivor' || name === 'anims_women') {
      const lib = name === 'anims_women' ? assets.womenClips : assets.survClips;
      for (const c of gltf.animations) { c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale')); lib[c.name] = c; }
      onProgress(++done / names.length); return;
    }
    const nat = Object.keys(NATIVE).find((k) => NATIVE[k] === name);
    if (nat) { assets.nativeLoaded ||= {}; assets.nativeLoaded[nat] = gltf; onProgress(++done / names.length); return; }
    if (name === 'rig') { buildHeroes(gltf.scene); onProgress(++done / names.length); return; }
    if (name === 'anims') {
      // bone scale tracks are constant; dropping them lets us re-proportion the skeletons
      for (const c of gltf.animations) { c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale')); assets.clips[c.name] = c; }
    }
    else assets.props[name] = prepareProp(gltf.scene);
    onProgress(++done / names.length);
  };
  await Promise.all(names.map(load));
  for (const [key, gltf] of Object.entries(assets.nativeLoaded || {})) assets.chars[key] = prepareNative(key, gltf);
  assets.nativeLoaded = null;
  assets.ready = true;
}

// Strip the KayKit meshes off the rig and build every hero on a copy of the bare skeleton.
function buildHeroes(scene) {
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  meshes.forEach((m) => m.parent.remove(m));
  for (const cls of HERO_CLASSES) {
    const rig = SkeletonUtils.clone(scene);
    rig.userData.adult = buildHero(cls, rig);
    assets.chars[cls] = rig;
  }
  // the realms' humanoid monsters (monsters.js), built the same way
  for (const type of BUILT_MONSTERS) {
    const rig = SkeletonUtils.clone(scene);
    rig.userData.adult = buildMonster(type, rig);
    assets.chars[`m_${type}`] = rig;
  }
}

// A Quaternius character: normalise its size, keep its own clips (survivors use the shared library).
function prepareNative(key, gltf) {
  const scene = gltf.scene;
  scene.userData.native = key;
  const clips = new Map();
  const src = !MODULAR.includes(key) ? gltf.animations : Object.values(WOMEN.includes(key) ? assets.womenClips : assets.survClips);
  for (const c of src) {
    c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale'));
    clips.set(c.name, c);
  }
  scene.userData.clips = clips;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  scene.userData.unit = NATIVE_HEIGHT[key] / Math.max(0.01, box.max.y - box.min.y);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.frustumCulled = false;
    o.material.roughness = 0.82; o.material.metalness = 0;
  });
  return scene;
}

function prepareProp(scene) {
  scene.traverse((o) => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
  });
  return scene;
}

export function cloneProp(name) {
  return assets.props[name].clone(true);
}

// ---------- monster proportions ----------
// Only for the KayKit skeleton (the skeleton_mage fallback): its proportions are chibi (the head is
// nearly half their height), so it is re-proportioned at spawn by scaling bones along their length
// (bone-local Y), with hands and feet scaled back so weapons stay their normal size. The adult
// Quaternius characters (survivors and zombies) must NOT go through this: they are never built on
// the KayKit rig, so Actor skips it for them.
const BUILDS = {
  monster: { head: 0.55, spine: 1.2, chest: [1.08, 1.1, 1.05], leg: 1.75, legW: 1.08, arm: 1.4, armW: 1.05 },
};
const LEG_LEN = 0.376; // thigh + shin in the base rig, metres

function applyBuild(model, build) {
  const b = BUILDS[build];
  if (!b) return 0;
  const bone = (n) => model.getObjectByName(n);
  const set = (n, x, y, z) => { const o = bone(n); if (o) o.scale.set(x, y, z); };
  set('spine', 1, b.spine, 1);
  set('chest', ...b.chest);
  const [cx, cy, cz] = b.chest;
  set('head', b.head / cx, b.head / cy, b.head / cz);
  for (const side of ['l', 'r']) {
    set(`upperleg${side}`, b.legW, b.leg, b.legW);
    set(`foot${side}`, 1.05 / b.legW, 1.05 / b.leg, 1.05 / b.legW);
    set(`upperarm${side}`, b.armW, b.arm, b.armW);
    set(`hand${side}`, 1 / (b.armW * cx), 1 / b.arm, 1 / (b.armW * cz));
  }
  return LEG_LEN * (b.leg - 1); // how far the hips must rise to keep the feet on the ground
}

// ---------- animated actors ----------

const LOWER = /^(root|hips|upperleg|lowerleg|foot|toes|kneeIK|control|heelIK|IK)/;
const variantCache = new Map();
const AXIS_Z = new THREE.Vector3(0, 0, 1);

// Game clip names -> Modular-pack clip names (anims_survivor.glb / anims_women.glb). Per-character overrides win.
// Ranged and one-handed "casts" borrow Gun_Shoot / Punch_Right; unmapped names (Spawn_Ground...) just don't play.
const NATIVE_CLIPS = {
  Idle: 'Idle', '2H_Melee_Idle': 'Idle_Sword', Idle_Combat: 'Idle', Running_A: 'Run', Running_B: 'Run', Running_C: 'Run',
  Walking_A: 'Walk', Walking_D_Skeletons: 'Walk', '1H_Melee_Attack_Chop': 'Punch_Right', '1H_Melee_Attack_Slice_Diagonal': 'Sword_Slash',
  '1H_Melee_Attack_Stab': 'Punch_Left', '2H_Melee_Attack_Chop': 'Sword_Slash', '2H_Melee_Attack_Slice': 'Sword_Slash', '2H_Melee_Attack_Spinning': 'Sword_Slash',
  Unarmed_Melee_Attack_Punch_A: 'Punch_Right', Throw: 'Punch_Right', Spellcast_Shoot: 'Punch_Right', Spellcast_Long: 'Interact', Spellcast_Raise: 'Wave',
  '2H_Ranged_Shoot': 'Gun_Shoot', '1H_Ranged_Shoot': 'Gun_Shoot', Hit_A: 'HitRecieve', Hit_B: 'HitRecieve_2', Death_A: 'Death', Death_B: 'Death',
  Death_C_Skeletons: 'Death', Cheer: 'Wave', Dodge_Forward: 'Roll',
};
const NATIVE_OVERRIDE = {
  // right arm out front for the whole gun class: Idle_Gun_Pointing / Run_Shoot / Idle_Gun_Shoot all hold the barrel level
  mallCop: { '2H_Melee_Idle': 'Idle_Gun_Pointing', Running_C: 'Run_Shoot', '2H_Ranged_Shoot': 'Idle_Gun_Shoot', '1H_Melee_Attack_Stab': 'Punch_Right' },
  biker: { '2H_Melee_Idle': 'Idle_Sword', '2H_Melee_Attack_Chop': 'Sword_Slash', '2H_Melee_Attack_Spinning': 'Sword_Slash' },
  skater: { '2H_Melee_Idle': 'Idle_Sword', '1H_Melee_Attack_Slice_Diagonal': 'Sword_Slash' },
  mallGoth: { Idle: 'Idle_Gun_Pointing', Running_C: 'Run_Shoot', Spellcast_Long: 'Idle_Gun_Pointing', '1H_Melee_Attack_Stab': 'Punch_Right' },
  z_walker: { '1H_Melee_Attack_Stab': 'Punch_Left' },
  z_sprinter: { '1H_Melee_Attack_Stab': 'Punch_Left' },
  z_brute: { '2H_Melee_Attack_Chop': 'Punch_Right' },
  giant: { Walking_A: 'Walk', Running_A: 'Run', Idle: 'Idle', Hit_B: 'HitRecieve', Hit_A: 'HitRecieve', Death_A: 'Death', '2H_Melee_Attack_Chop': 'Attack', Spellcast_Shoot: 'Attack', Spellcast_Raise: 'Attack', Spellcast_Long: 'Attack', Cheer: 'Jump' },
};
// Giant keeps its own rig and clip names (Ultimate Monsters), so its overrides replace the Modular defaults wholesale.
const NATIVE_OWN = new Set(['giant']);
// Lower-body tracks of the Modular rig (sanitised node names: "UpperLeg.L" -> "UpperLegL"; PT = leg pole targets).
const NATIVE_LOWER = /^(Root|Body|Hips|UpperLeg|LowerLeg|Foot|PT|PoleTarget)/;

function clipVariant(name, part, adult = 0, nat = null) {
  const key = `${nat ? nat.key : ''}:${name}:${part}:${adult}`;
  if (variantCache.has(key)) return variantCache.get(key);
  let base;
  if (nat) {
    const n = (NATIVE_OVERRIDE[nat.key] || {})[name] || (NATIVE_OWN.has(nat.key) ? name : NATIVE_CLIPS[name]);
    base = nat.clips.get(n);
    if (!base) { variantCache.set(key, null); return null; }
    if (part !== 'full') {
      base = base.clone(); base.name = key;
      base.tracks = base.tracks.filter((t) => (part === 'lower') === NATIVE_LOWER.test(t.name.split('.')[0]));
    }
    variantCache.set(key, base);
    return base;
  }
  base = assets.clips[name];
  if (!base) return null;
  if (adult) {
    // built heroes have adult bone lengths: keep rotations, scale hip/root motion to match
    base = base.clone();
    base.tracks = base.tracks.filter((t) => !t.name.endsWith('.position') || /^(hips|root)\./.test(t.name)).map((t) => {
      if (!t.name.endsWith('.position')) return t;
      const c = t.clone();
      for (let i = 0; i < c.values.length; i++) c.values[i] *= adult;
      return c;
    });
  }
  let clip = base;
  if (part !== 'full') {
    clip = base.clone();
    clip.name = key;
    clip.tracks = clip.tracks.filter((t) => {
      const bone = t.name.split('.')[0];
      return part === 'lower' ? LOWER.test(bone) : !LOWER.test(bone);
    });
  }
  variantCache.set(key, clip);
  return clip;
}

// Zombies only: a faint sickly-green self-glow plus a thin green fresnel rim, so the dead pop off
// the floor at gameplay distance. One shared program (same cache key) for every zombie material.
function zombieMaterial(m) {
  if (m.emissiveIntensity === 0 || m.emissive.getHex() === 0) { m.emissive = new THREE.Color('#1a3a10'); m.emissiveIntensity = 0.2; }
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      `float zr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
       outgoingLight += vec3(0.28, 0.85, 0.12) * pow(zr, 3.0) * 0.5;
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'zombieRim';
  m.userData.hook = m.onBeforeCompile; m.userData.hookKey = 'zombieRim';
}

// Material.clone() does not copy onBeforeCompile / customProgramCacheKey: put the zombie shader back on flash and fade copies
// (otherwise a hit-flash or a fade-out drops the gore, the blood and the rim).
function keepHook(m) {
  const h = m.userData.hook;
  if (!h) return;
  const key = m.userData.hookKey;
  m.onBeforeCompile = h;
  m.customProgramCacheKey = () => key;
}

const matPool = new Map();   // shared character materials (see Actor)
const flashPool = new Map(); // base material -> { colour -> its hit-flash twin }
function flashVariant(base, color) {
  let byColor = flashPool.get(base);
  if (!byColor) flashPool.set(base, byColor = new Map());
  let m = byColor.get(color);
  if (!m) {
    m = base.clone();
    m.userData = { ...base.userData };
    keepHook(m);
    m.emissive = new THREE.Color(color);
    m.emissiveIntensity = 0.8;
    byColor.set(color, m);
  }
  return m;
}

const undeadClips = new Map();
// Additive shamble clip: `u` = { lean, head, reach, bend, sway, hitch, uneven }; sign = head tilt side.
function undeadClip(u, sign, mod = false) {
  const key = JSON.stringify(u) + sign + (mod ? 'M' : '');
  if (undeadClips.has(key)) return undeadClips.get(key);
  const N = 16, dur = 2.4, times = [], E = new THREE.Euler(), Q = new THREE.Quaternion();
  const tracks = [];
  const track = (bone, f) => {
    const vals = [];
    for (let i = 0; i <= N; i++) {
      const ph = (i / N) * Math.PI * 2;
      const [x, y, z] = f(ph + Math.sin(ph) * 0.55 + Math.sin(ph * 3) * 0.2, i); // warped phase: an irregular, stop-start rhythm
      Q.setFromEuler(E.set(x, y, z));
      vals.push(Q.x, Q.y, Q.z, Q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, vals));
  };
  for (let i = 0; i <= N; i++) times.push((i / N) * dur);
  const hit = u.hitch || 0.3;
  const hitch = (ph) => Math.max(0, Math.sin(ph * 2)) ** 3 * hit; // a wet catch in the stride: the spine folds
  const lurch = (ph) => Math.sin(ph) * u.sway * 1.8 + Math.sin(ph * 2 + 1.3) * u.sway * 0.9;
  // Bone names and axes differ between the two rigs. KayKit (hips/spine/...): x pitches forward, arms
  // reach on -x. Modular ('CharacterArmature'): the torso/head x axis is the left-right axis (positive
  // pitches forward), and the arms' z axis points out of the shoulder, so reach is -z on the left arm
  // and +z on the right. The Modular Hips/Abdomen bind frames are twisted ~27 deg, so they only get
  // light sway. Track names are the loader's sanitised node names ("UpperArm.L" -> "UpperArmL").
  const B = mod
    ? { hips: 'Hips', spine: 'Abdomen', chest: 'Torso', head: 'Head', ual: 'UpperArmL', uar: 'UpperArmR', lal: 'LowerArmL', lar: 'LowerArmR', ul: 'UpperLeg', ll: 'LowerLeg' }
    : { hips: 'hips', spine: 'spine', chest: 'chest', head: 'head', ual: 'upperarml', uar: 'upperarmr', lal: 'lowerarml', lar: 'lowerarmr', ul: 'upperleg', ll: 'lowerleg' };
  const k = mod ? 0.55 : 1; // the adult rig folds at the waist more readily than the chibi kit
  track(B.hips, (ph) => [0.03 + hitch(ph) * 0.12 * k, lurch(ph) * 0.3, lurch(ph) * 0.45]);
  const lean = mod ? 0 : u.lean, headP = mod ? 0 : u.head; // the Modular rig's hunch and chin are set in world space (Actor.undeadPose)
  track(B.spine, (ph) => [lean * 0.4 * k + hitch(ph) * 0.16 * k, 0, lurch(ph) * 0.55]);
  track(B.chest, (ph) => [lean * 0.45 * k + hitch(ph) * 0.28 * k, lurch(ph) * 0.6, lurch(ph) * 0.7]);
  track(B.head, (ph) => [headP * 0.6 * k + 0.03 + hitch(ph) * 0.15 * k + Math.sin(ph * 2) * 0.08, lurch(ph) * 0.8, sign * 0.3 + lurch(ph) * 0.7]);
  const un = u.uneven || 0.85;
  const armL = (ph) => u.reach + Math.sin(ph) * 0.2, armR = (ph) => u.reach * un + Math.sin(ph + 2) * 0.25 + hitch(ph) * 0.3;
  if (mod) {
    // arms: aimed in world space by Actor.undeadPose (the rig's local axes defeat additive swings)
  } else {
    track(B.ual, (ph) => [-armL(ph), 0.1, -0.05]);
    track(B.uar, (ph) => [-armR(ph), -0.1, 0.05]);
    track(B.lal, (ph) => [-u.bend - Math.max(0, Math.sin(ph * 2)) * 0.25, 0, 0]);
    track(B.lar, (ph) => [-u.bend * 1.4 - Math.max(0, Math.sin(ph * 2 + 1)) * 0.3, 0, 0]);
  }
  const dl = sign > 0 ? 'R' : 'L'; // which leg drags is random per zombie (the head tilts the other way)
  const dlk = mod ? dl : dl.toLowerCase();
  track(`${B.ul}${dlk}`, (ph) => [Math.max(0, Math.sin(ph + 0.5)) * 0.18 * (u.drag ?? 1), 0, 0.06 * (u.drag ?? 1)]);
  track(`${B.ll}${dlk}`, (ph) => [Math.max(0, Math.sin(ph + 0.5)) * 0.22 * (u.drag ?? 1), 0, 0]);
  if (u.retch) { // spitters: a wet heave, head and chest pitching forward
    const pulse = (ph) => Math.max(0, Math.sin(ph * 1.0 + 0.4)) ** 8 * u.retch;
    track(B.chest, (ph) => [pulse(ph) * 0.4, 0, 0]);
    track(B.head, (ph) => [pulse(ph) * 0.4, 0, 0]);
  }
  if (u.stomp) { // brutes: the whole body drops on each footfall (additive position track on the hips / body root)
    const vals = [], sc = mod ? 0.015 : 1; // the Modular rig's bone units are ~1/70 of the kit's
    for (let i = 0; i <= N; i++) { const ph = (i / N) * Math.PI * 2; vals.push(0, -Math.abs(Math.sin(ph * 2)) * u.stomp * sc, 0); }
    tracks.push(new THREE.VectorKeyframeTrack(`${mod ? 'Body' : 'hips'}.position`, times, vals));
  }
  const clip = new THREE.AnimationClip(`undead:${key}`, dur, tracks, THREE.AdditiveAnimationBlendMode);
  undeadClips.set(key, clip);
  return clip;
}

// scratch objects for Actor.undeadPose
const _rq = new THREE.Quaternion(), _rqi = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _qi = new THREE.Quaternion();
// rotate `bone` by the world-space rotation qW (applied on top of whatever the mixer left it at)
function worldRot(bone, qW) {
  bone.parent.getWorldQuaternion(_pq);
  _qb.copy(_pq).invert().multiply(qW).multiply(_pq);
  bone.quaternion.premultiply(_qb);
}
// swing `bone` so that the line bone -> child points along world direction `dir` (blend weight w)
function aimBone(bone, child, dir, w) {
  bone.getWorldPosition(_p0); child.getWorldPosition(_p1);
  _d.subVectors(_p1, _p0);
  if (_d.lengthSq() < 1e-10) return;
  _d.normalize();
  _qa.setFromUnitVectors(_d, dir);
  _qi.identity().slerp(_qa, w);
  worldRot(bone, _qi);
}

// A character instance: a full-body base loop (idle / run) plus one-shot actions that
// either take over the whole body or just the upper body (so heroes can attack on the run).
export class Actor {
  constructor(charName, { tint = null, ghost = false, emissiveEyes = null, undead = null } = {}) {
    this.undead = undead; // a shamble overlay (see startUndead)
    this.root = new THREE.Group();
    // zombie variants are 'z_walker1': the same mesh with a different tint
    const vm = /^(z_[a-z]+)([12])$/.exec(charName);
    let zvariant = 0;
    if (vm) { charName = vm[1]; zvariant = +vm[2]; tint = tint || ZOMBIE_VARIANT_TINT[zvariant]; }
    this.model = SkeletonUtils.clone(assets.chars[charName]);
    const natKey = assets.chars[charName].userData.native;
    this.nat = natKey ? { key: natKey, clips: assets.chars[charName].userData.clips } : null;
    this.adult = this.nat ? 0 : assets.chars[charName].userData.adult || 0;
    if (this.nat) {
      this.unit = assets.chars[charName].userData.unit;
      this.model.scale.setScalar(this.unit);
    } else if (this.adult) {
      this.unit = HERO_SCALE;
      this.model.scale.setScalar(HERO_SCALE);
    } else {
      this.unit = MODEL_SCALE * 0.84;
      this.model.scale.setScalar(MODEL_SCALE * 0.84);
      const lift = applyBuild(this.model, 'monster');
      this.model.position.y = lift * this.model.scale.y;
    }
    this.root.add(this.model);
    this.mats = [];
    this.parts = []; // { mesh, base, flashed }: meshes sharing pooled materials (a crowd is a few materials, not one per zombie)
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const eyes = !!(emissiveEyes && /Eyes/i.test(o.name));
      const key = [o.material.uuid, tint || '', ghost || '', undead ? 'u' : '', eyes ? emissiveEyes : ''].join('|');
      let m = matPool.get(key);
      if (!m) {
        m = o.material.clone();
        if (tint) m.color.multiply(new THREE.Color(tint));
        if (ghost) { // a colour string picks the ghost's glow
          m.transparent = true; m.opacity = 0.55; m.depthWrite = false;
          m.emissive = new THREE.Color(typeof ghost === 'string' ? ghost : '#6080ff'); m.emissiveIntensity = 0.6;
          m.color.set(m.emissive).lerp(new THREE.Color('#ffffff'), 0.8);
        }
        if (undead) { if (/^z_/.test(charName)) undeadMaterial(m, charName, o.geometry, zvariant); else zombieMaterial(m); }
        if (eyes) { m.emissive.set(emissiveEyes); m.emissiveIntensity = 2; }
        m.userData.e0 = m.emissive.clone();
        m.userData.ei0 = m.emissiveIntensity;
        m.userData.o0 = m.opacity;
        m.userData.t0 = m.transparent;
        matPool.set(key, m);
      }
      o.material = m;
      this.parts.push({ mesh: o, base: m });
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    if (this.nat && NATIVE_SURVIVORS.includes(this.nat.key)) dressSurvivor(this, this.nat.key);
    if (this.nat && zvariant && (charName === 'z_walker' || charName === 'z_sprinter')) dressZombie(this, zvariant);
    if (this.nat && charName === 'z_shopper') dressShopper(this);
    if (this.nat && this.undead && /^z_(walker|sprinter|brute|spitter)$/.test(charName)) dressUndead(this, charName, zvariant);
    if (this.undead && (!this.nat || MODULAR.includes(this.nat.key))) this.startUndead(); // additive shamble on the walk cycle
    this.baseName = null;
    this.baseAction = null;
    this.baseMode = 'full';
    this.oneShot = null;
    this.oneShotUpper = false;
    this.locked = false; // dead: stop responding
    this.mixer.addEventListener('finished', (e) => {
      if (this.oneShot && e.action === this.oneShot) {
        if (this.locked) return;
        this.oneShot.fadeOut(0.12);
        this.oneShot = null;
        this.setBaseMode('full');
      }
    });
  }

  bone(name) {
    return this.model.getObjectByName(name.replace(/[.]/g, ''));
  }

  attach(propName, boneName, { scale = 1, rotation = null, position = null } = {}) {
    const b = this.bone(boneName);
    if (!b) return null;
    const p = cloneProp(propName);
    p.scale.setScalar(scale);
    if (rotation) p.rotation.set(...rotation);
    if (position) p.position.set(...position);
    b.add(p);
    p.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); this.mats.push(o.material); o.material.userData.e0 = o.material.emissive.clone(); o.material.userData.ei0 = o.material.emissiveIntensity; o.material.userData.o0 = o.material.opacity; o.material.userData.t0 = o.material.transparent; }
    });
    return p;
  }

  // Loop a base animation (idle/run/walk).
  base(name, timeScale = 1) {
    if (this.locked) return;
    if (this.baseName === name) { if (this.baseAction) this.baseAction.timeScale = timeScale; return; }
    const clip = clipVariant(name, this.oneShot && this.oneShotUpper ? 'lower' : 'full', this.adult, this.nat);
    if (!clip) return;
    const prev = this.baseAction;
    const a = this.mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).fadeIn(0.15).play();
    a.timeScale = timeScale;
    if (this.undead && !prev) a.time = Math.random() * clip.duration; // a crowd never walks in step
    if (prev) prev.fadeOut(0.15);
    this.baseName = name;
    this.baseAction = a;
    this.baseMode = this.oneShot && this.oneShotUpper ? 'lower' : 'full';
  }

  setBaseMode(mode) {
    if (!this.baseName || this.baseMode === mode) return;
    const clip = clipVariant(this.baseName, mode, this.adult, this.nat);
    const a = this.mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.08).play();
    a.time = this.baseAction ? this.baseAction.time : 0;
    a.timeScale = this.baseAction ? this.baseAction.timeScale : 1;
    if (this.baseAction) this.baseAction.fadeOut(0.08);
    this.baseAction = a;
    this.baseMode = mode;
  }

  // Play a one-shot. upper=true keeps the legs on the base loop.
  play(name, { upper = false, timeScale = 1, clamp = false, fade = 0.08 } = {}) {
    if (this.locked) return;
    const clip = clipVariant(name, upper ? 'upper' : 'full', this.adult, this.nat);
    if (!clip) return;
    if (this.oneShot) this.oneShot.fadeOut(fade);
    const a = this.mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(fade).play();
    a.clampWhenFinished = clamp;
    a.timeScale = timeScale;
    this.oneShot = a;
    this.oneShotUpper = upper;
    this.setBaseMode(upper ? 'lower' : 'full');
    if (!upper && this.baseAction) this.baseAction.setEffectiveWeight(0.0001);
  }

  die(name = 'Death_A') {
    this.play(name, { clamp: true, fade: 0.1 });
    this.locked = true;
  }

  get busy() { return !!this.oneShot; }

  update(dt) {
    // Paused (no time passed): leave the pose alone. The mixer doesn't rewrite bones for a
    // zero step, so adultPose's relative arm turn would pile up every frame and spin the arms.
    if (!(dt > 0)) return;
    if (this.baseAction && !this.oneShot && this.baseAction.getEffectiveWeight() < 0.5) this.baseAction.setEffectiveWeight(1);
    this.mixer.update(dt);
    if (this.undeadWorld && !this.locked && !(this.poseLod < 0)) this.undeadPose(dt);
    if (this.aim) this.weaponAim(dt);
    if (this.adult) this.adultPose();
    if (this.undeadAct) this.undeadAct.setEffectiveWeight(this.locked ? 0 : this.oneShot ? 0.35 : 1); // attacks keep their swing
  }

  // Undead overlay: a looping ADDITIVE clip (collapsed spine, drooping head, arms reaching out,
  // a lurching sway) layered over the walk by the mixer. Built from deltas, so it never piles up.
  startUndead() {
    const u = this.undead;
    this.tiltDir = Math.random() < 0.5 ? 1 : -1;
    const clip = undeadClip(u, this.tiltDir, !!(this.nat && MODULAR.includes(this.nat.key)));
    const act = this.mixer.clipAction(clip);
    act.setLoop(THREE.LoopRepeat, Infinity).play();
    act.time = Math.random() * clip.duration;
    act.timeScale = u.rate || 1;
    this.undeadAct = act;
    this.undeadWorld = !!(this.nat && MODULAR.includes(this.nat.key));
    this.upT = Math.random() * 6.28;
  }

  // Survivors: while idling or running (no attack clip playing) hold the weapon in a natural pose: its length axis is aimed along
  // `aim.dir` in the ACTOR's frame (+Z forward, +X to the model's left), then eased back to the clip-tuned grip for attacks.
  weaponAim(dt) {
    const A = this.aim;
    if (!A.h || !A.h.parent) return;
    if (!A.q0) { A.q0 = A.h.quaternion.clone(); A.k = 0; A.d = new THREE.Vector3(...A.dir).normalize(); }
    A.k += ((this.oneShot || this.locked ? 0 : 1) - A.k) * Math.min(1, dt * 10);
    if (A.k < 0.004) { A.h.quaternion.copy(A.q0); return; }
    this.root.getWorldQuaternion(_rq);
    A.h.parent.getWorldQuaternion(_pq);
    _t.copy(A.d).applyQuaternion(_rq).applyQuaternion(_qi.copy(_pq).invert());
    _qa.setFromUnitVectors(_Y, _t.normalize());
    if (A.roll) _qa.multiply(_qb.setFromAxisAngle(_Y, A.roll));
    A.h.quaternion.copy(A.q0).slerp(_qa, A.k);
  }

  // World-space zombie pose, run right after the mixer (which rewrites every bone it has a track for, so nothing piles
  // up): hunch the torso toward the camera, keep the chin up so the face shows, and reach BOTH arms out in front of the
  // chest (a sprinter flails them). Works in the actor's own frame (+Z forward, +X to the right... of the root), so the
  // rig's twisted bind axes do not matter. Module scratch objects only: no allocations per frame.
  undeadPose(dt) {
    const u = this.undead;
    if (!this.upBones) {
      const g = (n) => this.model.getObjectByName(n);
      this.upBones = { torso: g('Torso'), head: g('Head'), ua: [g('UpperArmL'), g('UpperArmR')], la: [g('LowerArmL'), g('LowerArmR')], wr: [g('WristL'), g('WristR')] };
    }
    const B = this.upBones;
    if (!B.torso || !B.head || !B.ua[0] || !B.ua[1] || !B.la[0] || !B.la[1]) return;
    this.upT += dt * (u.rate || 1) * 2.6;
    const lite = this.poseLod === 1; // Low quality: torso, head and upper arms only (forearms keep the mixer's pose)
    const ph = this.upT, w = this.oneShot ? (this.oneShotUpper ? 0.5 : 0.3) : 1;
    this.root.updateWorldMatrix(true, false);
    this.root.getWorldQuaternion(_rq);
    _rqi.copy(_rq).invert();
    // actor-frame axes in world space
    _right.set(1, 0, 0).applyQuaternion(_rq);
    // hunch: the torso pitches about the actor's right axis (positive = lean forward)
    const hunch = (u.hunch ?? 0.45) * w * (1 + Math.sin(ph * 0.5) * 0.08);
    _qa.setFromAxisAngle(_right, hunch);
    worldRot(B.torso, _qa);
    B.torso.updateWorldMatrix(false, true);
    // chin up, so a camera 40 degrees overhead still sees the face
    _qa.setFromAxisAngle(_right, -hunch * 0.6);
    worldRot(B.head, _qa);
    B.head.updateWorldMatrix(false, true);
    // arms
    const flail = u.flail || 0, armY = u.armY ?? -0.05, spread = u.spread ?? 0.16;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1, ua = B.ua[i], la = B.la[i], wr = B.wr[i];
      const sw = Math.sin(ph * 1.7 + i * 2.1);
      // target direction in actor space, then to world
      _t.set(s * (spread + flail * 0.5 * sw), armY + flail * 0.35 * Math.sin(ph * 2.3 + i * 1.7) + Math.sin(ph + i) * 0.05, 1).normalize().applyQuaternion(_rq);
      aimBone(ua, la, _t, w);
      if (lite) continue;
      ua.updateWorldMatrix(false, true);
      _t.set(s * (spread * 0.7 + flail * 0.35 * sw), armY - 0.1 + Math.sin(ph * 1.3 + i) * 0.05, 1).normalize().applyQuaternion(_rq);
      aimBone(la, wr, _t, w);
      la.updateWorldMatrix(false, true);
    }
  }

  // The shared animations hold the arms well out from a chibi's wide body; bring them in
  // toward an adult's sides (less so during attacks, which need the full swing).
  adultPose() {
    if (!this.arms) this.arms = ['l', 'r'].map((s) => [this.model.getObjectByName(`upperarm${s}`), s === 'l' ? 1 : -1]);
    const k = this.oneShot ? 0.2 : 0.55;
    for (const [b, s] of this.arms) if (b) b.rotateOnAxis(AXIS_Z, -s * k);
  }

  flash(amount, color = '#ffffff') {
    const on = amount > 0;
    if (!on && !this.flashing) return;
    this.flashing = on;
    for (const m of this.mats) { // private materials (weapon props, or a faded actor's own copies)
      if (on) { m.emissive.set(color); m.emissiveIntensity = 0.8; }
      else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
    }
    if (this.ownMats) return;
    // otherwise swap to a pooled flash variant of the shared material
    for (const pt of this.parts) pt.mesh.material = on ? flashVariant(pt.base, color) : pt.base;
  }

  // fading needs a material of its own: the first fade takes private copies of the shared ones
  ownMaterials() {
    if (this.ownMats) return;
    this.ownMats = true;
    const own = new Map();
    for (const pt of this.parts) {
      let m = own.get(pt.base);
      if (!m) { m = pt.base.clone(); m.userData = { ...pt.base.userData }; keepHook(m); own.set(pt.base, m); this.mats.push(m); }
      pt.mesh.material = m;
    }
    this.flashing = false;
  }

  fade(opacity) {
    if (this.opacity === opacity || (opacity >= 1 && this.opacity === undefined)) return;
    this.ownMaterials();
    this.opacity = opacity;
    for (const m of this.mats) {
      m.transparent = opacity < 1 || m.userData.t0;
      m.opacity = opacity < 1 ? opacity * m.userData.o0 : m.userData.o0;
      m.depthWrite = !m.transparent || m.userData.t0 === false && opacity >= 1;
      m.needsUpdate = true;
    }
  }
}
