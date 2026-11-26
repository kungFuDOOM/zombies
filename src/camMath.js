// Camera maths shared by gameplay and the films. Pure (no three.js), so it is unit tested.
//
// gameplayPose() is THE gameplay camera: render3d.js draws play with it, and the cut-to-gameplay handoff
// (cutscenes.js -> render3d.js) lands on exactly this pose, so the last frame of a film and the first frame of
// play are the same picture.

import { WORLD_VIEW_W, WORLD_VIEW_H, VIEW_W, VIEW_H } from './config.js';

export const CAM_OFFSET = [0, 280, 330]; // a 3/4 arcade angle (~35 deg down)
export const CAM_LOOK_Y = 42;
export const GAME_FOV = 42;
export const WALL_TOP = 52; // mall3d.js WALL_H

// ---------- scope letterbox ----------
export const SCOPE = 2.39;
/** The height of EACH bar, as a fraction of a picture with this aspect, that leaves a 2.39:1 window between them. */
export const scopeBarFrac = (aspect = VIEW_W / VIEW_H) => Math.max(0, (1 - aspect / SCOPE) / 2);
export const SCOPE_BAR_PX = Math.round(VIEW_H * scopeBarFrac(VIEW_W / VIEW_H)); // 119 of 640

/** Lens length (36 mm wide virtual sensor, scope picture 15.06 mm tall) to the VISIBLE vertical field of view. */
export const mmToFov = (mm) => (2 * Math.atan(7.53 / mm) * 180) / Math.PI;

export function gameplayPose(camX, camY, sx = 0, sz = 0) {
  const tx = camX + WORLD_VIEW_W / 2, tz = camY + WORLD_VIEW_H / 2 + 10;
  return { p: [tx + CAM_OFFSET[0] + sx, CAM_OFFSET[1], tz + CAM_OFFSET[2] + sz], l: [tx + sx, CAM_LOOK_Y, tz + sz - 10], fov: GAME_FOV, roll: 0 };
}

// ---------- the handoff ----------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mix = (a, b, k) => a + (b - a) * k;
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const handoffEase = (k) => { k = clamp01(k); return k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2; };

/** Beat-time quantities of a handoff of duration D: camera progress, letterbox height, film tint and HUD alpha. */
export const handoffCamK = (t, D) => clamp01(t / (0.8 * D));
export const handoffBar = (t, D) => SCOPE_BAR_PX * (1 - smooth((t - 0.35 * D) / (0.45 * D)));
export const handoffTint = (k) => 1 - smooth(k / 0.7);          // k = t / D
export const handoffHud = (k) => smooth((k - 0.55) / 0.3);

/**
 * Where the handoff's camera starts. party: {x, y} (sim units; world x = x, world z = y). boss: the live boss or null.
 * blocked(x, z): is this spot inside a wall (the camera then rides above the wall tops).
 */
export function handoffStart(kind, party, boss = null, blocked = () => false) {
  const up = (x, z, h) => (blocked(x, z) ? Math.max(h, WALL_TOP + 20) : h);
  if (kind === 'boss' && boss) {
    let dx = boss.x - party.x, dz = boss.y - party.y;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const px = party.x - dx * 110 - dz * 36, pz = party.y - dz * 110 + dx * 36;
    return { p: [px, up(px, pz, 34), pz], l: [boss.x, 70, boss.y], fov: 46, roll: -0.03 };
  }
  // 'rise': low behind the party, looking into the level. The spot must SEE them: a spawn is often against a wall, so
  // try closer and to either side, and failing that start above the wall tops, looking down at them.
  const sees = (x, z) => {
    for (let i = 1; i <= 10; i++) if (blocked(party.x + (x - party.x) * (i / 10), party.y + (z - party.y) * (i / 10))) return false;
    return true;
  };
  const l = [party.x, 30, party.y - 60];
  for (const [ox, oz] of [[46, 120], [32, 92], [-46, 112], [70, 70], [-70, 70], [24, 66]]) {
    if (sees(party.x + ox, party.y + oz)) return { p: [party.x + ox, 40, party.y + oz], l, fov: 50, roll: 0.03 };
  }
  return { p: [party.x + 36, WALL_TOP + 70, party.y + 104], l: [party.x, 24, party.y - 20], fov: 50, roll: 0.03 };
}

const toOrbit = (P) => {
  const dx = P.p[0] - P.l[0], dy = P.p[1] - P.l[1], dz = P.p[2] - P.l[2];
  const dist = Math.hypot(dx, dy, dz) || 1;
  return { dist, yaw: Math.atan2(dx, dz), pitch: Math.asin(Math.max(-1, Math.min(1, dy / dist))) };
};

/** Blend two camera poses in orbit space, so the camera cranes in an arc. e >= 1 returns G itself (no float drift). */
export function blendPose(C, G, e) {
  if (e >= 1) return G;
  e = Math.max(0, e);
  const a = toOrbit(C), b = toOrbit(G);
  const l = [mix(C.l[0], G.l[0], e), mix(C.l[1], G.l[1], e), mix(C.l[2], G.l[2], e)];
  const wrap = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  const yaw = a.yaw + wrap * e, pitch = mix(a.pitch, b.pitch, e), dist = Math.exp(mix(Math.log(a.dist), Math.log(b.dist), e));
  return {
    p: [l[0] + dist * Math.sin(yaw) * Math.cos(pitch), l[1] + dist * Math.sin(pitch), l[2] + dist * Math.cos(yaw) * Math.cos(pitch)],
    l, fov: mix(C.fov, G.fov, e), roll: mix(C.roll || 0, G.roll || 0, e),
  };
}
