// Cinematic toolkit, part 3: lighting rigs, light shafts, dust, sparks and flicker.
//
// A film keeps a FIXED set of lights for its whole run (changing the light count recompiles every material), and every shot
// just re-aims and re-colours them through a LightRig. Volumetric light is faked with additive cone meshes that fade
// soft at the silhouette (makeShaft) plus a drifting dust field that catches the light (DustField).

import * as THREE from 'three';
import { glowTexture } from './models.js';
import { clamp01, mix, hash } from './cineCore.js';

export function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/** A fluorescent tube's brightness 0..1 over time. `dying` tubes stutter hard, healthy ones glitch rarely. */
export function flicker(t, seed, dying = false) {
  if (dying) { const n = hash(Math.floor(t * 11) + seed); return n > 0.7 ? 0.08 : n > 0.5 ? 0.6 : 1; }
  return hash(Math.floor(t * 7) + seed) > 0.95 ? 0.35 : 1;
}

/**
 * Key + rim + fill + accent lights with a hemisphere ambient and a moon. `set()` takes target values; update(dt) eases to them,
 * so a cut is instant (call snap()) and a within-shot change glides. Light colour/position/power are in game units.
 */
export class LightRig {
  constructor(scene) {
    this.hemi = new THREE.HemisphereLight('#3a4a8a', '#0a0814', 0.5);
    this.moon = new THREE.DirectionalLight('#7088ff', 0.3);
    this.moon.position.set(-80, 400, 200);
    this.key = new THREE.PointLight('#ffffff', 0, 520, 1);
    this.rim = new THREE.PointLight('#ffffff', 0, 520, 1);
    this.fill = new THREE.PointLight('#ffffff', 0, 520, 1);
    this.fx = new THREE.PointLight('#ffffff', 0, 520, 1);   // flashes: sparks, flame, lightning bounce
    scene.add(this.hemi, this.moon, this.key, this.rim, this.fill, this.fx);
    this.lights = { key: this.key, rim: this.rim, fill: this.fill, fx: this.fx };
    this.goal = {};
    for (const k in this.lights) this.goal[k] = { c: new THREE.Color('#ffffff'), p: new THREE.Vector3(), w: 0 };
    this.amb = { hemiI: 0.5, hemiSky: new THREE.Color('#3a4a8a'), hemiGround: new THREE.Color('#0a0814'), moonI: 0.3, moonC: new THREE.Color('#7088ff') };
    this.flick = {};
  }

  /** set({ key: ['#ff7a20', [x,y,z], power], rim: [...], fill: [...], fx: [...], amb: { sky, ground, hemi, moon, moonColor } }) */
  set(cfg, snap = false) {
    for (const k in this.lights) {
      const c = cfg[k];
      const g = this.goal[k];
      if (c === undefined) continue;          // not mentioned: leave it as it is
      if (c === null) { g.w = 0; continue; }  // null: switch it off
      g.c.set(c[0]); g.p.set(...c[1]); g.w = c[2];
      this.flick[k] = c[3] || null;           // optional flicker fn: t => 0..1
    }
    if (cfg.amb) {
      const a = cfg.amb;
      if (a.sky) this.amb.hemiSky.set(a.sky);
      if (a.ground) this.amb.hemiGround.set(a.ground);
      if (a.hemi != null) this.amb.hemiI = a.hemi;
      if (a.moon != null) this.amb.moonI = a.moon;
      if (a.moonColor) this.amb.moonC.set(a.moonColor);
    }
    if (snap) this.update(1, 0, true);
  }

  update(dt, t, snap = false) {
    const f = snap ? 1 : 1 - Math.exp(-dt * 7);
    for (const k in this.lights) {
      const L = this.lights[k], g = this.goal[k];
      L.color.lerp(g.c, snap ? 1 : f);
      if (snap || g.w === 0 || L.intensity === 0) L.position.copy(g.p); else L.position.lerp(g.p, f);
      const fl = this.flick[k] ? this.flick[k](t) : 1;
      L.intensity = mix(L.intensity, g.w * fl, snap ? 1 : Math.min(1, f * 1.6));
    }
    const a = this.amb;
    this.hemi.color.lerp(a.hemiSky, f); this.hemi.groundColor.lerp(a.hemiGround, f); this.hemi.intensity = mix(this.hemi.intensity, a.hemiI, f);
    this.moon.intensity = mix(this.moon.intensity, a.moonI, f); this.moon.color.lerp(a.moonC, f);
  }
}

// A soft cone of light: additive, brightest near the source, fading along its length and at the silhouette so there is no hard edge.
const SHAFT_VERT = `varying vec3 vN; varying vec3 vV; varying float vY;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix * mv; }`;
const SHAFT_FRAG = `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vY;
void main() { float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 1.6) * pow(1.0 - vY, 1.4) * uOpacity; gl_FragColor = vec4(uColor * a, a); }`;

/**
 * A light shaft pointing straight down from `from` (the source) toward the floor, `len` long, `spread` wide at the far end.
 * Returns the mesh; mesh.userData.mat.uniforms.uOpacity is the live brightness.
 */
export function makeShaft({ color = '#9ab4ff', len = 190, r0 = 4, r1 = 40, opacity = 0.35, segs = 20 } = {}) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, segs, 1, true);   // open ended; uv.y runs 1 (top) -> 0 (bottom), flipped below
  geo.translate(0, -len / 2, 0);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.mat = mat;
  m.renderOrder = 5;
  return m;
}

/** Drifting motes that catch the light. A box of N points; slow upward drift with a sideways sway. */
export class DustField {
  constructor(scene, { n = 120, box = [400, 180, 400], center = [0, 90, 0], color = '#cfd8ff', size = 3.2, opacity = 0.5 } = {}) {
    this.n = n; this.box = box; this.center = center;
    this.pos = new Float32Array(n * 3);
    this.seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.seed[i] = hash(i + 1) * 100; this.pos.set([(hash(i + 3) - 0.5) * box[0], hash(i + 9) * box[1], (hash(i + 5) - 0.5) * box[2]], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size, map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.position.set(...center);
    this.points.renderOrder = 6;
    scene.add(this.points);
  }
  /** Re-centre the field (e.g. on each new shot's subject). */
  moveTo(x, y, z) { this.points.position.set(x, y, z); }
  update(dt, t) {
    const b = this.box, p = this.pos;
    for (let i = 0; i < this.n; i++) {
      const s = this.seed[i], o = i * 3;
      p[o] += Math.sin(t * 0.4 + s) * dt * 3.5;
      p[o + 1] += dt * (2.5 + hash(i) * 3);
      p[o + 2] += Math.cos(t * 0.33 + s * 1.7) * dt * 3.5;
      if (p[o + 1] > b[1]) p[o + 1] -= b[1];
      if (p[o] > b[0] / 2) p[o] -= b[0]; else if (p[o] < -b[0] / 2) p[o] += b[0];
      if (p[o + 2] > b[2] / 2) p[o + 2] -= b[2]; else if (p[o + 2] < -b[2] / 2) p[o + 2] += b[2];
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/** One pool of additive spark / ember points: spark(x,y,z, vx,vy,vz, colour, life). */
export class SparkPool {
  constructor(scene, n = 260, size = 7) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    scene.add(this.points);
  }
  clear() { this.life.fill(0); this.col.fill(0); }
  spark(x, y, z, vx, vy, vz, color, life = 0.6, gain = 1.6) {
    const i = this.i++ % this.n, c = new THREE.Color(color);
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.col.set([c.r * gain, c.g * gain, c.b * gain], i * 3);
    this.life[i] = life; this.max[i] = life;
  }
  update(dt, gravity = 220) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] = Math.max(0.5, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt); this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = Math.pow(0.02, dt / this.max[i]);
      this.col[i * 3] *= f; this.col[i * 3 + 1] *= f; this.col[i * 3 + 2] *= f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** Remove a root from its parent and free every geometry / material / texture under it that is not owned by someone else (gpu.js keep()). */
export { disposeTree } from './gpu.js';
export { clamp01 };
