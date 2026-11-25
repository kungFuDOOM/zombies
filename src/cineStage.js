// Cinematic toolkit, part 4: character staging. Wraps the game's own survivors / zombies (Actor from assets.js, styles from
// render3d.js; both only imported, never modified) and adds acting on top of their animation clips:
//
//   const biker = makeHero('biker', { pos: [0,0,0], yaw: 0.2 });
//   biker.look(-30, 5);          // turn the head 30 degrees to the model's left, chin up a little
//   biker.raise('R', 0.8);       // lift the right arm (weapon arm) toward the camera
//   biker.lean(0.15);            // shoulders forward
//   biker.play('2H_Melee_Attack_Chop', { upper: true });   // any clip the game already has
//
// The bone tweaks are layered AFTER the animation mixer each frame, and are eased, so gestures blend in and out rather than snap.

import * as THREE from 'three';
import { Actor } from './assets.js';
import { HERO_STYLE, ENEMY_STYLE } from './render3d.js';

const D2R = Math.PI / 180;
const Q = new THREE.Quaternion(), E = new THREE.Euler();

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
    this.bones = {};
    for (const n of ['Head', 'Neck', 'Chest', 'Torso', 'UpperArmR', 'UpperArmL', 'LowerArmR', 'LowerArmL']) this.bones[n] = actor.bone(n);
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
  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }
  /** World position of a bone (for flames, sparks, muzzle flashes). */
  boneWorld(name, out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    const b = this.actor.bone(name);
    return b ? b.getWorldPosition(out) : out.copy(this.root.position).add(new THREE.Vector3(0, 30, 10));
  }

  update(dt) {
    this.actor.update(dt);
    if (!(dt > 0)) return;
    const f = 1 - Math.exp(-dt * this.rate), g = this.g, t = this.target;
    for (const k in g) g[k] += (t[k] - g[k]) * f;
    const B = this.bones;
    const rot = (bone, x, y, z) => { if (!bone || (!x && !y && !z)) return; Q.setFromEuler(E.set(x * D2R, y * D2R, z * D2R)); bone.quaternion.multiply(Q); };
    rot(B.Neck, g.headPitch * 0.35, g.headYaw * 0.4, 0);
    rot(B.Head, g.headPitch * 0.65, g.headYaw * 0.6, 0);
    rot(B.Chest, g.lean * 18, g.twist * 0.5, 0);
    rot(B.Torso, g.lean * 12, g.twist * 0.5, 0);
    if (g.armR) rot(B.UpperArmR, -g.armR * 80, 0, g.armR * 25);
    if (g.armL) rot(B.UpperArmL, -g.armL * 80, 0, -g.armL * 25);
  }
}

/** One of the four survivors, idling in the weapon pose the game uses. */
export function makeHero(cls, o = {}) {
  const a = new Actor(cls);
  a.base(HERO_STYLE[cls].idle);
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
