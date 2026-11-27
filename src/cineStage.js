// Cinematic toolkit, part 4: character staging. Wraps the game's own survivors / zombies (Actor from assets.js, styles from
// render3d.js; both only imported, never modified) and adds acting on top of their animation clips:
//
//   const biker = makeHero('biker', { pos: [0,0,0], yaw: 0.2 });
//   biker.look(-30, 5);          // turn the head 30 degrees to the model's left, chin up a little
//   biker.raise('R', 0.8);       // lift the right arm (weapon arm) toward the camera
//   biker.lean(0.15);            // shoulders forward
//   biker.play('2H_Melee_Attack_Chop', { upper: true });   // any clip the game already has
//   biker.breathe(0.6); biker.tremble(0.5); biker.flinch();  // fear: breathing, shaking, a recoil on the hit
//
// The bone tweaks are layered AFTER the animation mixer each frame, and are eased, so gestures blend in and out rather than snap.
// (The mixer does not rewrite a bone whose animated value has not changed, so each tweak is taken off again before the next
// mixer step; otherwise it would pile up on a still pose and fold the actor over.)

import * as THREE from 'three';
import { Actor } from './assets.js';
import { HERO_STYLE, ENEMY_STYLE } from './render3d.js';

const D2R = Math.PI / 180;
const Q = new THREE.Quaternion(), E = new THREE.Euler();

/** The rhythm of speech at time t, 0..1: uneven syllables, never on a steady beat (also drives the Butcher's jaw). */
export const speechBeat = (t) => Math.max(0, Math.sin(t * 13.1)) * 0.6 + Math.max(0, Math.sin(t * 8.3 + 1.3)) * 0.4;

export class CineActor {
  constructor(actor, { pos = [0, 0, 0], yaw = 0, scale = 1 } = {}) {
    this.actor = actor;
    this.root = actor.root;
    this.root.position.set(...pos);
    this.root.rotation.y = yaw;
    this.root.scale.setScalar(scale);
    this.baseScale = scale;
    // current / target gesture values (degrees for angles)
    this.g = { headYaw: 0, headPitch: 0, armR: 0, armL: 0, lean: 0, twist: 0 };
    this.target = { ...this.g };
    this.rate = 6;
    this.clock = (pos[0] || 0) * 0.37;   // (so two actors never breathe in step)
    this.resetActing();
    this.bones = {};
    for (const n of ['Head', 'Neck', 'Chest', 'Torso', 'UpperArmR', 'UpperArmL', 'LowerArmR', 'LowerArmL']) this.bones[n] = actor.bone(n);
    this.tweaked = new Map();   // bone -> { base: its pose before the gesture, out: what we wrote, on } (records are reused)
  }

  /** Take last frame's gestures off any bone nothing else has rewritten since. */
  untweak() {
    for (const [bone, q] of this.tweaked) { if (q.on && bone.quaternion.equals(q.out)) bone.quaternion.copy(q.base); q.on = false; }
  }

  /** Breathing (k 0..1+, breaths per second; panic is about 1.1), and a slow weight shift. */
  breathe(k = 0.4, rate = 0.3) { this.breathK = k; this.breathRate = rate; return this; }
  /** Fear: a fine high shake in the head and arms. 0 = steady. */
  tremble(k = 0.5) { this.shiverK = k; return this; }
  /** A recoil that decays over about a third of a second. */
  flinch(amount = 1) { this.flinchK = amount; this.flinchAge = 0; return this; }
  resetActing() { this.breathK = 0; this.breathRate = 0.3; this.shiverK = 0; this.flinchK = 0; this.flinchAge = 9; this.talkK = 0; this.talkG = 0; return this; }
  /** Speaking: the head works with the syllables and the chest with the phrase (the models have no jaw). 0 = quiet. */
  talk(k = 1) { this.talkK = k; return this; }
  /** An eye-line: turn the head toward a world point (clamped to what a neck can do). */
  lookAtPoint(x, y, z, rate = 4) {
    const w = this.boneWorld('Head', this.eyeV || (this.eyeV = new THREE.Vector3()));
    const dx = x - w.x, dz = z - w.z, want = Math.atan2(dx, dz) - this.root.rotation.y;
    const yaw = Math.atan2(Math.sin(want), Math.cos(want)) / D2R, pitch = Math.atan2(y - w.y, Math.hypot(dx, dz) || 1) / D2R;
    return this.look(Math.max(-60, Math.min(60, yaw)), Math.max(-30, Math.min(30, pitch)), rate);
  }

  /** Head turn in degrees: +yaw looks to the model's left, +pitch looks up. */
  look(yaw = 0, pitch = 0, rate = 6) { this.target.headYaw = yaw; this.target.headPitch = pitch; this.rate = rate; return this; }
  /** Raise an arm (side 'R' | 'L') by 0..1 (1 = about 100 degrees forward/up). */
  raise(side, amount = 1) { this.target[side === 'L' ? 'armL' : 'armR'] = amount; return this; }
  /** Lean the torso forward (+) or back (-), in 0..1 (~30 degrees). */
  lean(k = 0) { this.target.lean = k; return this; }
  /** Twist the torso toward its left (+) / right (-), degrees. */
  twist(deg = 0) { this.target.twist = deg; return this; }
  /** Turn the whole body to face a world point. */
  faceTo(x, z, k = 1) { const want = Math.atan2(x - this.root.position.x, z - this.root.position.z); this.root.rotation.y += (Math.atan2(Math.sin(want - this.root.rotation.y), Math.cos(want - this.root.rotation.y))) * k; return this; }
  loop(name, speed = 1) { this.actor.base(name, speed); return this; }
  play(name, o = {}) { this.actor.play(name, o); return this; }
  /** Fall, and stay down until getUp() (or standUp()). */
  fall(timeScale = 1) { this.standUp(); this.actor.play('Death_A', { clamp: true, timeScale }); this.downed = this.actor.oneShot; this.actor.locked = true; return this; }
  /** Push back up: the fall played in reverse, then back to the base loop. */
  getUp(speed = 0.8) {
    const a = this.downed;
    if (!a) return this;
    this.actor.locked = false;
    a.clampWhenFinished = false;
    a.paused = false;
    a.enabled = true;
    a.timeScale = -speed;
    this.downed = null;
    return this;
  }
  /** On their feet at once (a film being rewound). */
  standUp() {
    const A = this.actor;
    A.locked = false;
    if (A.oneShot) { A.oneShot.stop(); A.oneShot = null; A.setBaseMode('full'); if (A.baseAction) A.baseAction.setEffectiveWeight(1); }
    this.downed = null;
    return this;
  }
  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }
  /** World position of a bone (for flames, sparks, muzzle flashes). */
  boneWorld(name, out = new THREE.Vector3()) {
    const b = this.actor.bone(name);
    if (b) b.updateWorldMatrix(true, false); // (just the bone and its parents, not the whole skeleton)
    return b ? b.getWorldPosition(out) : out.copy(this.root.position).add(new THREE.Vector3(0, 30, 10));
  }

  update(dt) {
    if (!(dt > 0)) return;
    this.untweak();
    this.actor.update(dt);
    const f = 1 - Math.exp(-dt * this.rate), g = this.g, t = this.target;
    for (const k in g) g[k] += (t[k] - g[k]) * f;
    const B = this.bones;
    const rot = (bone, x, y, z) => {   // (once per bone per frame: a second call would lose the untweaked pose)
      if (!bone || (!x && !y && !z)) return;
      let r = this.tweaked.get(bone);
      if (!r) this.tweaked.set(bone, r = { base: new THREE.Quaternion(), out: new THREE.Quaternion(), on: false });
      r.base.copy(bone.quaternion);
      Q.setFromEuler(E.set(x * D2R, y * D2R, z * D2R)); bone.quaternion.multiply(Q);
      r.out.copy(bone.quaternion); r.on = true;
    };
    // involuntary movement is added on top of the eased gestures (never fed back into them)
    this.clock += dt;
    this.flinchAge += dt;
    const c = this.clock, br = this.breathK, sh = this.shiverK;
    const wave = br ? Math.sin(c * Math.PI * 2 * this.breathRate) : 0;
    const jit = (a1, a2) => (sh ? (Math.sin(c * a1) * 0.65 + Math.sin(c * a2 + 1.9) * 0.35) * sh * 1.6 : 0);
    const fl = this.flinchAge < 0.6 ? this.flinchK * Math.exp(-this.flinchAge * 7) * Math.min(1, this.flinchAge * 24) : 0;
    this.talkG += (this.talkK - this.talkG) * (1 - Math.exp(-dt * 10));
    const tk = this.talkG, beat = tk > 0.01 ? speechBeat(c) : 0, phrase = tk > 0.01 ? Math.sin(c * 2.3) : 0;
    const yaw = g.headYaw + jit(61, 79) + phrase * 3.2 * tk, pitch = g.headPitch + jit(71, 57) - wave * 0.8 * br + fl * 12 + (beat - 0.35) * 6.5 * tk;
    const armR = g.armR + jit(67, 83) * 0.012 + fl * 0.35, armL = g.armL + jit(73, 59) * 0.012 + fl * 0.35;
    const chest = g.lean * 18 + wave * 2.5 * br - fl * 5 + Math.sin(c * 3.4) * 1.3 * tk;
    const shift = br ? Math.sin(c * Math.PI * 2 * 0.15) * 3 * Math.min(1, br) : 0;
    rot(B.Neck, pitch * 0.35, yaw * 0.4, 0);
    rot(B.Head, pitch * 0.65, yaw * 0.6, 0);
    rot(B.Chest, chest, (g.twist + shift) * 0.5, 0);
    rot(B.Torso, g.lean * 12 - fl * 3, (g.twist + shift) * 0.5, 0);
    if (armR) rot(B.UpperArmR, -armR * 80, 0, armR * 25);
    if (armL) rot(B.UpperArmL, -armL * 80, 0, -armL * 25);
  }
}

/** One of the four survivors, idling in the weapon pose the game uses. */
export function makeHero(cls, o = {}) {
  const a = new Actor(cls);
  a.base(HERO_STYLE[cls].idle);
  return new CineActor(a, { scale: 1.15, ...o });
}

/** One of the Abatement Team, rifle held ready. */
export function makeTrooper(o = {}) {
  const a = new Actor('abatement');
  a.base('2H_Melee_Idle');
  return new CineActor(a, { scale: 1.15, ...o });
}

/** A zombie of the game's types ('walker' | 'sprinter' | 'brute' | 'spitter'), variant 1 or 2. */
export function makeZombie(type, variant = 1, o = {}) {
  const st = ENEMY_STYLE[type];
  const a = new Actor(`${st.model}${variant}`, { tint: st.tint, undead: { ...st.undead } });
  if (st.slim) a.model.scale.x *= st.slim;
  a.base(st.walk, st.idleSpeed + 0.2);
  return new CineActor(a, { scale: st.scale * 1.12, ...o });
}

export { HERO_STYLE, ENEMY_STYLE };
