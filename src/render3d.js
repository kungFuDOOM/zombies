// Three.js renderer. Builds the mall (see mall3d.js) from the tile map and keeps an animated
// 3D model in sync with every simulated entity. The simulation stays 2D
// on the ground plane (sim x -> world X, sim y -> world Z), as in the arcade original.

import * as THREE from 'three';
import { TILE, VIEW_W, VIEW_H, WORLD_VIEW_W, WORLD_VIEW_H, POWERUPS, LOBBED, BLAST, ENEMIES } from './config.js';
import { T } from './level.js';
import { buildMall, WALL_H, neonSignTexture } from './mall3d.js';
import { assets, Actor, cloneProp, MODEL_SCALE, HERO_SCALE } from './assets.js';
import { glowTexture, glowSprite, buildBoss, buildExit, buildProjectile, buildMarker, buildItem, heroColor } from './models.js';

// 3/4 arcade angle (~40 deg down): low enough that vertical neon stall signs stay in frame,
// high enough that the party, enemies and pickups stay readable.
const CAM_OFFSET = new THREE.Vector3(0, 280, 330);
const CAM_LOOK_Y = 42; // look a little above the floor so wall signs are framed
const MAX_PARTICLES = 900;
// Phones get fewer dynamic lights; each one costs on every pixel.
const LOW_POWER = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const TORCH_LIGHTS = LOW_POWER ? 4 : 8;
const S = MODEL_SCALE;

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// How each survivor is animated.
const HERO_STYLE = {
  biker: { run: 'Running_C', idle: '2H_Melee_Idle', melee: '2H_Melee_Attack_Chop', shoot: 'Throw', turbo: '2H_Melee_Attack_Spinning', meleeSpeed: 2.2, shootSpeed: 2.4 },
  mallCop: { run: 'Running_C', idle: '2H_Melee_Idle', melee: '1H_Melee_Attack_Stab', shoot: '2H_Ranged_Shoot', turbo: '2H_Ranged_Shoot', meleeSpeed: 2.3, shootSpeed: 3 },
  skater: { run: 'Running_A', idle: '2H_Melee_Idle', melee: '1H_Melee_Attack_Slice_Diagonal', shoot: 'Throw', turbo: 'Dodge_Forward', meleeSpeed: 2.6, shootSpeed: 3.2 },
  mallGoth: { run: 'Running_C', idle: 'Idle', melee: '1H_Melee_Attack_Stab', shoot: 'Spellcast_Shoot', turbo: 'Spellcast_Long', meleeSpeed: 2.2, shootSpeed: 2.8 },
  ray: { idle: 'Idle', melee: '1H_Melee_Attack_Stab', shoot: 'Throw', turbo: 'Throw', meleeSpeed: 2, shootSpeed: 2.4 },
};

// How each monster looks: a built monster ('m_' + type, see monsters.js), its walk cycle and size.
const ENEMY_STYLE = {
  // `undead` = post-mixer shamble pose (assets.js zombiePose); variants are m_<type>1/2.
  walker: { model: 'm_walker', walk: 'Walking_D_Skeletons', walkSpeed: 0.85, idleSpeed: 0.3, scale: 1, melee: 'Unarmed_Melee_Attack_Punch_A', undead: { lean: 0.3, head: 0.3, reach: 1.25, bend: 0.1, sway: 0.1, rate: 1 } },
  sprinter: { model: 'm_sprinter', walk: 'Running_C', walkSpeed: 1.5, idleSpeed: 0.4, scale: 0.95, melee: '1H_Melee_Attack_Stab', undead: { lean: 0.5, head: 0.4, reach: 0.9, bend: 0.5, sway: 0.2, rate: 2.2, uneven: 0.5 } },
  brute: { model: 'm_brute', walk: 'Walking_D_Skeletons', walkSpeed: 0.8, idleSpeed: 0.25, scale: 1.3, melee: '2H_Melee_Attack_Chop', undead: { lean: 0.16, head: 0.12, reach: 0.65, bend: 0.2, sway: 0.2, rate: 0.7 } },
  spitter: { model: 'm_spitter', walk: 'Walking_D_Skeletons', walkSpeed: 0.9, idleSpeed: 0.3, scale: 1.05, undead: { lean: 0.2, head: 0.25, reach: 0.8, bend: 0.5, sway: 0.12, hitch: 0.28, rate: 1.4 } },
  death: { model: 'skeleton_mage', weapon: 'weapon_staff', tint: '#3a3440', eyes: '#ff1010', walk: 'Walking_A', walkSpeed: 1.2, scale: 1.25 },
};

export class Renderer3D {
  constructor(canvas) {
    // Rendered at a reduced resolution and scaled up with hard pixel edges for a chunky,
    // retro look (see setPixelation); antialiasing would only smear the pixels.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.canvas = canvas;
    this.setPixelation(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; // a touch grimier than the first pass
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(42, VIEW_W / VIEW_H, 10, 3000);
    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight('#ffffff', '#202020', 1);
    this.sun = new THREE.DirectionalLight('#ffffff', 1);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.torchLights = [];
    for (let i = 0; i < TORCH_LIGHTS; i++) {
      const l = new THREE.PointLight('#ff9a50', 0, 260, 1);
      this.scene.add(l);
      this.torchLights.push(l);
    }
    this.playerLights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 200, 1);
      this.scene.add(l);
      this.playerLights.push(l);
    }
    this.exitLight = new THREE.PointLight('#60c0ff', 0, 220, 1);
    this.scene.add(this.exitLight);

    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 9, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);

    // soft blob shadow shared by every character and pickup (N64-era style, and cheap)
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const sctx = sc.getContext('2d');
    const grd = sctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grd;
    sctx.fillRect(0, 0, 64, 64);
    this.shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false });

    this.views = new Map();
    this.corpses = [];
    this.gibs = [];
    this.decals = [];
    this.markers = new Map();
    this.levelGroup = null;
    this.level = null;
    this.tmpColor = new THREE.Color();
    this.tmpV = new THREE.Vector3();
    this.lastTime = 0;
  }

  // 0 = off (full resolution), 1 = retro (default), 2 = chunky.
  setPixelation(level) {
    this.pixelLevel = level;
    const ratio = [Math.min(window.devicePixelRatio || 1, 2), 0.6, 0.4][level];
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(VIEW_W, VIEW_H, false);
    this.canvas.style.imageRendering = level ? 'pixelated' : 'auto';
    return ['Pixels: OFF', 'Pixels: RETRO', 'Pixels: CHUNKY'][level];
  }

  blob(parent, size) {
    const m = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    m.scale.set(size, 1, size);
    m.position.y = 1;
    m.renderOrder = 1;
    parent.add(m);
    return m;
  }

  // ---------- level construction ----------

  // Instanced copies of a prop at many transforms ({x, y, z, ry, sx, sy, sz}).
  instanced(group, name, list, tint = null) {
    if (!list.length) return;
    const tpl = assets.props[name];
    tpl.updateMatrixWorld(true);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    tpl.traverse((mesh) => {
      if (!mesh.isMesh) return;
      let mat = mesh.material;
      if (tint) { mat = mat.clone(); mat.color.multiply(new THREE.Color(tint)); }
      const inst = new THREE.InstancedMesh(mesh.geometry, mat, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.ry || 0);
        sc.set(t.sx ?? S, t.sy ?? S, t.sz ?? S);
        pos.set(t.x, t.y || 0, t.z);
        m4.compose(pos, q, sc).multiply(mesh.matrixWorld);
        inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    });
  }

  // Instanced primitive (rocks, slabs, lava tiles) with optional per-instance colour.
  instancedPrim(group, geometry, material, list) {
    if (!list.length) return null;
    const inst = new THREE.InstancedMesh(geometry, material, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
    list.forEach((t, i) => {
      e.set(t.rx || 0, t.ry || 0, t.rz || 0);
      q.setFromEuler(e);
      sc.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
      pos.set(t.x, t.y || 0, t.z);
      inst.setMatrixAt(i, m4.compose(pos, q, sc));
      if (t.color) inst.setColorAt(i, col.set(t.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
    return inst;
  }

  buildLevel(g) {
    if (this.levelGroup) this.scene.remove(this.levelGroup);
    for (const [, v] of this.views) this.scene.remove(v.root);
    this.views.clear();
    for (const c of this.corpses) this.scene.remove(c.root);
    this.corpses = [];
    for (const [, m] of this.markers) this.scene.remove(m);
    this.markers.clear();

    const group = new THREE.Group();
    this.levelGroup = group;
    this.level = g.level;
    this.scene.add(group);
    buildMall(this, g, group);
    this.addBloodSmears(g, group);
  }

  // Old blood on the terrazzo: a handful of flat smears and pools on random floor tiles, in one
  // instanced draw. Seeded from the level so every client sees the same mess.
  addBloodSmears(g, group) {
    if (g.theme.name === 'Safe room') return;
    const list = [];
    let seed = (g.w * 131 + g.h * 17 + 7) | 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) | 0) >>> 0) / 4294967296;
    for (let i = 0; i < 160 && list.length < 26; i++) {
      const x = Math.floor(rnd() * g.w), y = Math.floor(rnd() * g.h);
      if (g.tile(x, y) !== T.FLOOR) continue;
      const k = rnd();
      list.push({ x: x * TILE + rnd() * TILE, y: 0.35, z: y * TILE + rnd() * TILE, ry: rnd() * 6.28, sx: 8 + k * 16, sz: 5 + rnd() * 10, sy: 1, color: k < 0.5 ? '#4a0808' : '#6a0e0e' });
    }
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.62, depthWrite: false });
    const inst = this.instancedPrim(group, new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), mat, list);
    if (inst) inst.renderOrder = 1;
  }

  // The exit portal, flanked by neon posts.
  portalAt(group, x, y, sealed) {
    const e = buildExit(sealed);
    e.position.set(x * TILE + 16, 0.5, y * TILE + 16);
    group.add(e);
    return e;
  }

  // The cash counter's clerk, standing behind the till.
  makeClerk(group) {
    this.merchant = new Actor('clerk');
    this.merchant.base('Idle');
    this.merchant.root.position.set(this.clerkSpot.x, 0, this.clerkSpot.z);
    this.blob(this.merchant.root, 34);
    group.add(this.merchant.root);
  }

  setAmbient(spec) {
    if (this.ambient) { this.scene.remove(this.ambient.points); this.ambient = null; }
    if (!spec) return;
    const n = Math.round(spec.count * (LOW_POWER ? 0.6 : 1));
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1000; pos[i * 3 + 1] = Math.random() * 220; pos[i * 3 + 2] = (Math.random() - 0.5) * 800;
      seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const additive = !['snow', 'ash'].includes(spec.type);
    const size = { snow: 13, ash: 11, embers: 15, sparks: 10, motes: 12, spores: 14, wisps: 34, souls: 30, drips: 8 }[spec.type] || 12;
    const mat = new THREE.PointsMaterial({ size, map: glowTexture(), color: spec.color, transparent: true, depthWrite: false, opacity: additive ? 0.9 : 0.75, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.ambient = { points, pos, seed, n, type: spec.type };
  }

  updateAmbient(dt, t) {
    const A = this.ambient;
    if (!A) return;
    const { pos, seed, n, type } = A;
    // fall / rise speed and sideways sway per kind
    const [vy, sway, swayF] = { snow: [-40, 18, 1], ash: [-14, 22, 0.6], embers: [36, 14, 2], sparks: [70, 24, 4], motes: [5, 10, 0.5], spores: [8, 16, 0.8], wisps: [6, 30, 0.4], souls: [24, 8, 1.2], drips: [-120, 0, 0] }[type] || [0, 10, 1];
    const cx = this.camX, cz = this.camZ;
    for (let i = 0; i < n; i++) {
      const k = i * 3, s = seed[i * 4], s2 = seed[i * 4 + 1];
      pos[k + 1] += vy * (0.6 + s * 0.8) * dt;
      pos[k] += Math.sin(t * swayF + s * 40) * sway * dt + (type === 'snow' || type === 'ash' ? 10 * dt : 0);
      pos[k + 2] += Math.cos(t * swayF * 0.7 + s2 * 40) * sway * 0.5 * dt;
      // wrap round a box that follows the camera
      if (pos[k + 1] < 0) pos[k + 1] += 220; else if (pos[k + 1] > 220) pos[k + 1] -= 220;
      let dx = pos[k] - cx; if (dx < -500) pos[k] += 1000; else if (dx > 500) pos[k] -= 1000;
      let dz = pos[k + 2] - cz; if (dz < -400) pos[k + 2] += 800; else if (dz > 400) pos[k + 2] -= 800;
    }
    A.points.geometry.attributes.position.needsUpdate = true;
    A.points.material.opacity = type === 'wisps' || type === 'souls' ? 0.6 + Math.sin(t * 2) * 0.25 : A.points.material.opacity;
  }

  // ---------- views for entities ----------

  makeHero(p) {
    const a = new Actor(p.cls);
    const root = a.root;
    // player-coloured ring at the feet, like the arcade's player markers
    const ring = new THREE.Mesh(new THREE.RingGeometry(11, 14, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: heroColor(p.cls), transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.y = 1.2;
    root.add(ring);
    this.blob(root, 34);
    a.base(HERO_STYLE[p.cls].idle);
    return { kind: 'hero', root, actor: a, ring };
  }

  makeEnemy(e) {
    const st = ENEMY_STYLE[e.type] || ENEMY_STYLE.walker;
    // zombies come in three variants and slightly different sizes, picked from their phase
    const vi = st.undead ? Math.floor(e.phase * 1000) % 3 : 0;
    const vr = st.undead ? ((Math.floor(e.phase * 7919) % 100) / 100 - 0.5) * 0.18 : 0;
    const a = new Actor(vi ? `${st.model}${vi}` : st.model, { tint: st.tint, ghost: st.ghost, emissiveEyes: st.eyes, undead: st.undead ? { ...st.undead } : null });
    a.model.scale.setScalar((a.adult ? HERO_SCALE : S) * st.scale * (1 + vr));
    if (st.weapon) a.attach(st.weapon, 'handslot.r');
    if (!st.float) this.blob(a.root, 30 * st.scale);
    a.base(st.undead ? st.walk : 'Idle', st.undead ? st.idleSpeed : 1);
    if (e.fromGen && !st.float) a.play('Spawn_Ground', { timeScale: 2.2 });
    return { kind: 'enemy', root: a.root, actor: a, style: st };
  }

  // Survivors that are in a scene but not played by anyone, and Ray.
  makeNpc(n) {
    const a = new Actor(n.cls);
    this.blob(a.root, 34);
    a.base((HERO_STYLE[n.cls] || HERO_STYLE.ray).idle);
    return { kind: 'npc', root: a.root, actor: a };
  }

  updateNpc(v, n, g, dt) {
    v.root.position.set(n.x, 0, n.y);
    const f = Math.atan2(n.fx || 0, n.fy || 1);
    v.root.rotation.y = lerpAngle(v.root.rotation.y, f, 0.2);
    const a = v.actor;
    const cheer = n.cheer && !n.hurt;
    if (n.act && n.act !== v.lastAct) { v.lastAct = n.act; a.play('Throw', { upper: true, timeScale: 2.2 }); }
    a.base(n.hurt ? 'Hit_B' : cheer ? 'Cheer' : (HERO_STYLE[n.cls] || HERO_STYLE.ray).idle);
    a.update(dt);
    void g;
  }

  makeBoss(e, g) {
    const b = g.info.boss;
    const root = buildBoss(b.model, b.color, b.horn);
    root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.blob(root, 110);
    for (const mat of root.userData.mats) { mat.userData.e0 = mat.emissive.clone(); mat.userData.ei0 = mat.emissiveIntensity; }
    root.scale.setScalar(root.userData.bossScale);
    return { kind: 'boss', root, proc: true, baseScale: root.userData.bossScale };
  }

  // Kill burst: flesh chunks, bone and a tumbling limb or two, plus a blood pool on the floor.
  // Pooled and capped so a horde dying at once stays cheap.
  spawnGibs(x, z, scale = 1, type = 'walker') {
    if (!this.gibMats) {
      const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, flatShading: true, ...o });
      this.gibMats = [m('#7a1010'), m('#4a0808'), m('#6a7a58'), m('#a05050'), m('#d8d0b4')];
      this.gibBox = new THREE.BoxGeometry(1, 1, 1);
      this.gibLimb = new THREE.CylinderGeometry(0.5, 0.38, 1, 6);
      this.decalGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
      this.decalMats = ['#5a0808', '#3a0606'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, depthWrite: false }));
    }
    const big = type === 'brute' ? 1.5 : 1;
    const n = Math.round((7 + Math.random() * 4) * big);
    for (let i = 0; i < n; i++) {
      const limb = i < 2 + (big > 1 ? 1 : 0);
      const mat = limb ? this.gibMats[2 + (i % 2) * 2] : this.gibMats[(Math.random() * 3) | 0];
      const mesh = new THREE.Mesh(limb ? this.gibLimb : this.gibBox, mat);
      const sz = (limb ? 4 : 1.8 + Math.random() * 2.4) * scale;
      mesh.scale.set(sz * (limb ? 1.5 : 1), limb ? 10 * scale : sz * 0.8, sz * (limb ? 1.5 : 1));
      mesh.position.set(x + (Math.random() - 0.5) * 8, 18 + Math.random() * 14, z + (Math.random() - 0.5) * 8);
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
      this.scene.add(mesh);
      this.gibs.push({ mesh, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 70 + Math.random() * 110, sx: (Math.random() - 0.5) * 14, sz: (Math.random() - 0.5) * 14, t: 0, life: limb ? 2.6 : 1.8 });
    }
    while (this.gibs.length > 160) this.scene.remove(this.gibs.shift().mesh);
    const d = new THREE.Mesh(this.decalGeo, this.decalMats[(Math.random() * 2) | 0]);
    d.position.set(x, 0.6 + this.decals.length * 0.002, z);
    d.scale.set((11 + Math.random() * 8) * big, 1, (8 + Math.random() * 7) * big);
    d.rotation.y = Math.random() * 3;
    d.renderOrder = 1;
    this.scene.add(d);
    this.decals.push({ d, t: 0 });
    while (this.decals.length > 36) this.scene.remove(this.decals.shift().d);
  }

  updateGibs(dt) {
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const gb = this.gibs[i], m = gb.mesh;
      gb.t += dt;
      if (m.position.y > 1.2) {
        gb.vy -= 520 * dt;
        m.position.x += gb.vx * dt; m.position.z += gb.vz * dt; m.position.y += gb.vy * dt;
        m.rotation.x += gb.sx * dt; m.rotation.z += gb.sz * dt;
        if (m.position.y <= 1.2) { m.position.y = 1.2; gb.vx = gb.vz = 0; }
      }
      if (gb.t > gb.life) {
        m.position.y -= dt * 20;
        if (gb.t > gb.life + 0.5) { this.scene.remove(m); this.gibs.splice(i, 1); }
      }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const dc = this.decals[i];
      dc.t += dt;
      if (dc.t > 10) { dc.d.material = dc.d.material.clone(); dc.d.material.opacity -= dt * 0.4; if (dc.d.material.opacity <= 0) { this.scene.remove(dc.d); this.decals.splice(i, 1); } }
    }
  }

  // Spawners: a shattered storefront shutter, a busted vent or a barricaded escalator, glowing
  // in the colour of what comes out of it.
  makeGenerator(gen) {
    const root = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#8c94a8', metalness: 0.7, roughness: 0.4, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#16121e', roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: '#c89050', roughness: 0.9, flatShading: true });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); root.add(m); return m; };
    switch (gen.style) {
      case 'vent': // a busted ceiling vent dropped to the floor
        add(new THREE.BoxGeometry(26, 6, 26), steel, 0, 3, 0, 0.1, 0.3, 0.1);
        add(new THREE.BoxGeometry(18, 2, 18), dark, 0, 6.5, 0, 0.1, 0.3, 0.1);
        for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(1.4, 2.5, 20), steel, i * 3.6, 7.2, 0, 0.1, 0.3, 0.1);
        add(new THREE.BoxGeometry(18, 2, 4), steel, 12, 2, 8, 0.3, 0.8, 0.6);
        break;
      case 'escalator': // a barricaded escalator step
        for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(26, 4, 8), steel, 0, 2 + i * 4, -9 + i * 6);
        for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(4, 3, 32), wood, -8 + k * 8, 15 + k * 2, 0, 0.1 * k, 0, 0.5 * (k % 2 ? 1 : -1));
        break;
      default: // a shattered storefront shutter
        add(new THREE.BoxGeometry(30, 22, 3), steel, 0, 12, 0, 0.12, 0, 0.08);
        for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(30, 1.2, 3.4), dark, 0, 5 + i * 4.2, 0.2, 0.12, 0, 0.08);
        add(new THREE.BoxGeometry(10, 3, 3), steel, 9, 4, 8, 0.2, 0.7, 0.2);
        for (let k = 0; k < 4; k++) add(new THREE.ConeGeometry(2.6, 8, 4), steel, -12 + k * 8, 24, 0, 0, 0, Math.PI);
    }
    const halo = glowSprite(ENEMIES[gen.type] ? ENEMIES[gen.type].color : '#fff', 54, 0.5);
    halo.position.y = 14;
    root.add(halo);
    const mats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData.e0 = o.material.emissive.clone();
      mats.push(o.material);
    });
    this.blob(root, 44);
    return { kind: 'gen', root, halo, mats };
  }

  makeItem(it) {
    const root = new THREE.Group();
    const spin = new THREE.Group();
    root.add(spin);
    let glow = null, spins = false;
    const add = (name, sc, y = 0) => { const p = cloneProp(name); p.scale.setScalar(S * sc); p.position.y = y; spin.add(p); return p; };
    switch (it.type) {
      case 'poison': {
        const f = add('food_b', 0.7);
        f.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color('#90ff60')); } });
        glow = '#50ff30';
        break;
      }
      case 'chest': add('chest', 0.6); break;
      case 'barrel': add('barrel', 0.75); break;
      default: {
        // pizza, soda, cash, propane, armor crates, flashbangs and turbo power-ups keep their bespoke models
        const m = buildItem(it.type, it.sub, POWERUPS[it.sub] && POWERUPS[it.sub].color);
        m.scale.setScalar(it.type === 'propane' || it.type === 'armorcrate' ? 1.4 : 1.25);
        root.add(m);
        this.blob(root, 22);
        return { kind: 'item', root, spin: m.userData.spin, spins: m.userData.spins };
      }
    }
    if (glow) { const s = glowSprite(glow, 30, 0.45); s.position.y = 10; root.add(s); }
    this.blob(root, it.type === 'chest' ? 34 : 24);
    return { kind: 'item', root, spin, spins };
  }

  makeProjectile(pr) {
    if (pr.kind === 'pool') { // a bubbling pool of poison on the ground
      const root = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: '#f0a020', transparent: true, opacity: 0, depthWrite: false });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(BLAST.pool, 24).rotateX(-Math.PI / 2), mat);
      disc.position.y = 1.4;
      const glow = glowSprite('#ffb030', BLAST.pool * 2.6, 0.35);
      glow.position.y = 6;
      root.add(disc, glow);
      return { kind: 'proj', root, spin: null, pool: { mat, glow } };
    }
    const root = buildProjectile(pr.kind);
    return { kind: 'proj', root, spin: root.userData.spin };
  }

  // ---------- per-frame sync ----------

  render(g) {
    if (this.level !== g.level) this.buildLevel(g);
    const t = g.time;
    const dt = Math.min(0.05, Math.max(0, t - this.lastTime));
    this.lastTime = t;

    const tx = g.camX + WORLD_VIEW_W / 2, tz = g.camY + WORLD_VIEW_H / 2 + 10;
    const sx = (Math.random() - 0.5) * g.shake, sz = (Math.random() - 0.5) * g.shake;
    const cc = g.cutCam;
    if (cc) {
      // a cutscene shot: a cinematic camera on the real survivors and the real mall
      this.cutFov = this.cutFov == null ? cc.fov : this.cutFov + (cc.fov - this.cutFov) * 0.1;
      if (this.camera.fov !== this.cutFov) { this.camera.fov = this.cutFov; this.camera.updateProjectionMatrix(); }
      const k = this.cutPos ? 0.14 : 1;
      this.cutPos = this.cutPos || new THREE.Vector3(cc.px, cc.py, cc.pz);
      this.cutLook = this.cutLook || new THREE.Vector3(cc.lx, cc.ly, cc.lz);
      this.cutPos.lerp(this.tmpV.set(cc.px, cc.py, cc.pz), k);
      this.cutLook.lerp(this.tmpV.set(cc.lx, cc.ly, cc.lz), k);
      this.camera.position.copy(this.cutPos).add(this.tmpV.set(sx, 0, sz));
      this.camera.lookAt(this.cutLook);
    } else {
      if (this.cutPos) { this.cutPos = null; this.cutLook = null; this.cutFov = null; this.camera.fov = 42; this.camera.updateProjectionMatrix(); }
      this.camera.position.set(tx + CAM_OFFSET.x + sx, CAM_OFFSET.y, tz + CAM_OFFSET.z + sz);
      this.camera.lookAt(tx + sx, CAM_LOOK_Y, tz + sz - 10);
    }
    this.sun.position.set(tx - 200, 500, tz + 300);
    this.sun.target.position.set(tx, 0, tz);
    this.camX = tx; this.camZ = tz;

    this.syncLevel(g, t);

    const seen = new Set();
    for (const p of g.allPlayers()) this.sync(p, () => this.makeHero(p), (v) => this.updateHero(v, p, g, dt), seen);
    for (const e of g.enemies) {
      if (e.type === 'boss') this.sync(e, () => this.makeBoss(e, g), (v) => this.updateBoss(v, e, g, dt), seen);
      else this.sync(e, () => this.makeEnemy(e), (v) => this.updateEnemy(v, e, g, dt), seen);
    }
    for (const n of g.npcs || []) this.sync(n, () => this.makeNpc(n), (v) => this.updateNpc(v, n, g, dt), seen);
    for (const gen of g.gens) this.sync(gen, () => this.makeGenerator(gen), (v) => this.updateGen(v, gen, t), seen);
    for (const it of g.items) this.sync(it, () => this.makeItem(it), (v) => this.updateItem(v, it, t), seen);
    for (const pr of g.projs) this.sync(pr, () => this.makeProjectile(pr), (v) => this.updateProj(v, pr, t), seen);
    for (const [obj, v] of this.views) {
      if (seen.has(obj)) continue;
      this.views.delete(obj);
      // slain monsters collapse and sink instead of popping out of existence
      if (v.creature && !obj.vanish && v.root.visible) {
        this.corpses.push({ ...v, t: 0 }); // beasts keel over
        if (this.corpses.length > 40) this.scene.remove(this.corpses.shift().root);
      } else if ((v.kind === 'enemy' || v.kind === 'boss') && v.actor && !obj.vanish && v.root.visible) {
        v.actor.flash(0);
        v.actor.die(v.kind === 'boss' ? 'Death_B' : 'Death_A');
        if (v.style && v.style.undead) this.spawnGibs(v.root.position.x, v.root.position.z, v.style.scale, obj.type);
        this.corpses.push({ ...v, t: 0 });
        if (this.corpses.length > 40) this.scene.remove(this.corpses.shift().root); // bounded, whatever happens
      } else this.scene.remove(v.root);
      if (v.ward) this.scene.remove(v.ward, ...v.stars);
    }
    this.updateGibs(dt);
    this.corpses = this.corpses.filter((c) => {
      c.t += dt;
      if (c.creature) c.creature.rotation.z = Math.min(Math.PI / 2, c.t * 6) * (c.root.id % 2 ? 1 : -1);
      else c.actor.update(dt);
      if (c.t > 1.3) c.root.position.y -= dt * 25;
      if (c.t > 2.4) { this.scene.remove(c.root); return false; }
      return true;
    });

    const seenM = new Set();
    for (const pr of g.projs) {
      if (!LOBBED.has(pr.kind)) continue;
      seenM.add(pr);
      let mk = this.markers.get(pr);
      if (!mk) { mk = buildMarker(); this.markers.set(pr, mk); this.scene.add(mk); }
      mk.position.set(pr.tx, 1.5, pr.ty);
      mk.scale.setScalar((0.4 + 0.6 * (pr.t / pr.T)) * (BLAST[pr.kind] || 28) / 24); // as wide as what lands there
    }
    for (const [pr, mk] of this.markers) if (!seenM.has(pr)) { this.scene.remove(mk); this.markers.delete(pr); }

    this.syncLights(g, t, tx, tz);
    this.syncParticles(g);
    this.updateAmbient(dt, t);
    this.renderer.render(this.scene, this.camera);
  }

  sync(obj, make, update, seen) {
    let v = this.views.get(obj);
    if (!v) {
      v = make();
      this.views.set(obj, v);
      this.scene.add(v.root);
    }
    seen.add(obj);
    update(v);
  }

  near(x, z, pad = 520) {
    return Math.abs(x - this.camX) < pad && Math.abs(z - this.camZ) < pad;
  }

  updateHero(v, p, g, dt) {
    const st = HERO_STYLE[p.cls];
    if (!p.alive) {
      if (!v.dead) { v.dead = true; v.actor.die('Death_A'); v.ring.visible = false; }
      v.actor.update(dt);
      return;
    }
    if (v.dead) {
      // continued: fresh actor so the animation state resets
      this.scene.remove(v.root);
      Object.assign(v, this.makeHero(p), { dead: false });
      this.scene.add(v.root);
    }
    const a = v.actor;
    v.root.visible = !(p.invuln > 0 && Math.floor(g.time * 16) % 2);
    const moved = v.px !== undefined ? Math.hypot(p.x - v.px, p.y - v.py) : 0;
    v.px = p.x; v.py = p.y;
    const moving = moved > 0.2 || !!p.dash;
    v.root.position.set(p.x, 0, p.y);
    v.root.rotation.y = lerpAngle(v.root.rotation.y, Math.atan2(p.fx, p.fy), 0.3);
    a.base(moving ? st.run || 'Running_A' : st.idle, moving ? Math.max(0.8, (moved / Math.max(dt, 0.001)) / 150) : 1);
    if (p.act && p.act !== v.lastAct) {
      v.lastAct = p.act;
      if (p.act.type === 'melee') a.play(st.melee, { upper: moving, timeScale: st.meleeSpeed });
      else if (p.act.type === 'shoot') a.play(st.shoot, { upper: true, timeScale: st.shootSpeed });
      else a.play(st.turbo, { timeScale: 1.6 });
    }
    if (p.hurtFlash > 0 && !v.wasHurt && !a.busy) a.play('Hit_A', { upper: true, timeScale: 2 });
    v.wasHurt = p.hurtFlash > 0;
    a.flash(p.hurtFlash, '#ff2020');
    a.fade(p.buffs.invisible ? 0.3 : 1);
    v.root.position.y = p.buffs.levitate ? 6 + Math.sin(g.time * 4) * 2 : 0;
    const big = p.buffs.grow ? 1.4 : 1;
    v.root.scale.setScalar(v.root.scale.x + (big - v.root.scale.x) * 0.15);
    if (p.buffs.phoenix && p.famX !== undefined) {
      if (!v.familiar) { v.familiar = makePhoenix(); this.levelGroup.add(v.familiar); }
      v.familiar.visible = true;
      v.familiar.position.set(p.famX, 34 + Math.sin(g.time * 6) * 3, p.famY);
      v.familiar.rotation.y = g.time * 3 + Math.PI / 2;
      v.familiar.userData.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (0.4 + Math.sin(g.time * 18) * 0.5)));
    } else if (v.familiar) v.familiar.visible = false;
    a.update(dt);
    v.ring.material.opacity = 0.55 + Math.sin(g.time * 5) * 0.25;

    const buff = Object.keys(p.buffs)[0];
    if (buff) {
      if (!v.aura) {
        v.aura = new THREE.Mesh(new THREE.SphereGeometry(24, 16, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
        v.aura.position.y = 20;
        v.root.add(v.aura);
      }
      v.aura.visible = true;
      v.aura.material.color.set(POWERUPS[buff].color);
      v.aura.scale.setScalar(1 + Math.sin(g.time * 6) * 0.05);
    } else if (v.aura) v.aura.visible = false;
  }

  updateEnemy(v, e, g, dt) {
    const a = v.actor;
    const st = v.style;
    v.root.position.set(e.x, st.float ? 6 + Math.sin(g.time * 4 + e.phase) * 3 : 0, e.y);
    const visible = this.near(e.x, e.y);
    v.root.visible = visible;
    if (!visible) return;
    const [p] = g.nearestPlayer(e);
    // a charging beast faces where it's going, not the hero
    const face = e.charging > 0 && v.creature ? Math.atan2(e.cvx || 0, e.cvy || 0) : p ? Math.atan2(p.x - e.x, p.y - e.y) : null;
    if (face !== null) v.root.rotation.y = lerpAngle(v.root.rotation.y, face, 0.18);
    const moved = v.px !== undefined ? Math.hypot(e.x - v.px, e.y - v.py) : 0;
    v.px = e.x; v.py = e.y;
    const moving = moved > 0.15;
    if (v.creature) {
      v.creature.userData.anim(g.time + e.phase, moving, e);
      const hurt = e.hurt > 0;
      if (hurt || v.flashing) {
        v.flashing = hurt;
        for (const m of v.creature.userData.mats) {
          if (hurt) { m.emissive.set('#ffffff'); m.emissiveIntensity = 0.8; } else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
        }
      }
      return;
    }
    if (st.undead) a.base(st.walk, moving ? st.walkSpeed : st.idleSpeed); // the dead never stand at ease
    else a.base(moving ? st.walk : 'Idle', moving ? st.walkSpeed : 1);
    if (e.act && e.act !== v.lastAct) {
      v.lastAct = e.act;
      const clip = e.act.type === 'throw' ? 'Throw' : e.act.type === 'cast' ? st.shoot || 'Spellcast_Shoot' : st.melee || '1H_Melee_Attack_Chop';
      a.play(clip, { upper: moving, timeScale: 2 });
    }
    if (e.hurt > 0 && !v.wasHurt && !a.busy) a.play('Hit_B', { upper: true, timeScale: 2.2 });
    v.wasHurt = e.hurt > 0;
    a.fade(e.invisible ? 0.15 : 1);
    a.flash(e.hurt);
    a.update(dt);
  }

  updateBoss(v, e, g, dt) {
    const t = g.time;
    const act = e.act, since = act ? t - act.t : 99;
    // leaping guardians rise and fall; teleporting ones vanish for a moment
    const air = act && act.type === 'leap' && since < 1.1 ? Math.sin((since / 1.1) * Math.PI) * 150 : 0;
    v.root.position.set(e.x, air, e.y);
    v.root.visible = !(act && act.type === 'teleport' && since < 0.85);
    v.root.scale.setScalar(v.baseScale * (act && act.type === 'roar' && since < 1.6 ? 1 + Math.sin(since * 18) * 0.04 : 1));
    this.bossExtras(v, e, t);
    const [p] = g.nearestPlayer(e);
    if (e.charging > 0) v.root.rotation.y = Math.atan2(e.cvx, e.cvy);
    else if (p) v.root.rotation.y = lerpAngle(v.root.rotation.y, Math.atan2(p.x - e.x, p.y - e.y), 0.08);
    const moved = v.px !== undefined ? Math.hypot(e.x - v.px, e.y - v.py) : 0;
    v.px = e.x; v.py = e.y;
    const moving = moved > 0.15;
    const hurtColor = e.hp < e.maxHp * 0.4 ? '#ff4020' : '#ffffff';
    if (v.actor) {
      const a = v.actor;
      a.base(e.charging > 0 ? 'Running_A' : moving ? 'Walking_A' : 'Idle', e.charging > 0 ? 1.6 : 1);
      if (e.act && e.act !== v.lastAct) {
        v.lastAct = e.act;
        const clip = { cast: 'Spellcast_Shoot', windup: 'Spellcast_Raise', breath: 'Spellcast_Long', roar: 'Cheer', teleport: 'Spellcast_Raise' }[e.act.type] || '2H_Melee_Attack_Chop';
        a.play(clip, { upper: moving, timeScale: 1.6 });
      }
      const winding = act && (act.type === 'windup' || act.type === 'roar') && since < 0.8;
      if (winding) a.flash(0.5 + Math.sin(t * 30) * 0.5, '#ff8020'); // the tell: it glows before it strikes
      else a.flash(e.hurt, hurtColor);
      a.update(dt);
      return;
    }
    const rig = v.root.userData.rig;
    if (rig.arm) { // the cleaver: raised on a wind-up, brought down on a sweep or a slam
      const raise = act && ['windup', 'sweep', 'slam'].includes(act.type) ? (act.type === 'windup' ? Math.min(1, since / 0.5) : Math.max(0, 1 - since / 0.4)) : 0;
      const swing = act && act.type === 'sweep' && since < 0.5 ? Math.sin(since / 0.5 * Math.PI) * 1.8 : 0;
      rig.arm.rotation.x = -0.4 - raise * 1.8 + (act && act.type === 'slam' && since < 0.4 ? since * 5 : 0);
      rig.arm.rotation.y = swing;
    }
    rig.wings.forEach((w, i) => (w.rotation.y = Math.sin(t * 5) * 0.5 * (i ? -1 : 1)));
    if (rig.legs) rig.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(t * 8 + i * Math.PI / 2) * 0.5 : Math.sin(t * 2 + i) * 0.1));
    rig.heads.forEach((h, i) => {
      h.rotation.y = Math.sin(t * 1.5 + i * 2) * 0.3;
      const open = act && ['windup', 'breath', 'roar'].includes(act.type) && since < (act.type === 'breath' ? 1.7 : 0.9);
      if (h.userData.jaw) h.userData.jaw.rotation.x = open ? 0.65 : Math.max(0, Math.sin(t * 3)) * 0.15;
    });
    if (rig.tail) rig.tail.rotation.y = Math.sin(t * 2) * 0.4;
    rig.rig.rotation.x = e.charging > 0 ? 0.25 : 0;
    const winding = act && (act.type === 'windup' || act.type === 'roar') && since < 0.8;
    const on = e.hurt > 0 || winding;
    for (const m of v.root.userData.mats) {
      if (winding) { m.emissive.set('#ff7010'); m.emissiveIntensity = 0.5 + Math.sin(t * 30) * 0.4; } // the tell
      else if (on) { m.emissive.set(hurtColor); m.emissiveIntensity = 0.8; } else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
    }
  }

  // A shimmering ward while a guardian is shrugging off magic; circling stars while stunned.
  bossExtras(v, e, t) {
    if (!v.ward) {
      v.ward = new THREE.Mesh(new THREE.SphereGeometry(80, 20, 14), new THREE.MeshBasicMaterial({ color: '#b080ff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      v.ward.position.y = 60;
      v.stars = [0, 1, 2].map(() => glowSprite('#ffe060', 26, 0.95));
      v.root.parent.add(v.ward, ...v.stars);
    }
    const warded = e.ward > 0;
    v.ward.visible = warded && v.root.visible;
    if (warded) { v.ward.position.set(e.x, 60 + v.root.position.y, e.y); v.ward.material.opacity = 0.12 + Math.sin(t * 5) * 0.06; v.ward.rotation.y = t; }
    v.stars.forEach((s, i) => {
      s.visible = e.stun > 0;
      const a = t * 5 + (i * Math.PI * 2) / 3;
      s.position.set(e.x + Math.cos(a) * 50, 150, e.y + Math.sin(a) * 50);
    });
  }

  updateGen(v, gen, t) {
    v.root.position.set(gen.x, 0, gen.y);
    const tier = Math.ceil(gen.hp / 15);
    v.root.scale.setScalar(0.6 + tier * 0.15);
    const pulse = 0.5 + Math.sin(t * 5 + gen.x) * 0.5;
    v.halo.material.opacity = 0.25 + pulse * 0.4;
    const on = gen.hurt > 0;
    for (const m of v.mats) {
      if (on) { m.emissive.set('#ffffff'); m.emissiveIntensity = 0.7; } else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = 0; }
    }
  }

  updateItem(v, it, t) {
    v.root.position.set(it.x, 0, it.y);
    if (v.spin) {
      v.spin.position.y = Math.sin(it.bob) * 1.5 + 1.5;
      if (v.spins) v.spin.rotation.y = t * 2 + it.bob;
    }
  }

  updateProj(v, pr, t) {
    if (v.pool) {
      v.root.position.set(pr.x, 0, pr.y);
      const k = pr.T ? pr.t / pr.T : 0;
      const a = Math.min(1, k * 8) * Math.min(1, (1 - k) * 5);
      v.pool.mat.opacity = 0.55 * a;
      v.pool.glow.material.opacity = (0.25 + Math.sin(t * 6 + pr.x) * 0.08) * a;
      return;
    }
    if (LOBBED.has(pr.kind)) {
      v.root.position.set(pr.x, 14 + pr.z, pr.y);
      v.spin.rotation.set(t * 8, t * 6, 0);
      return;
    }
    v.root.position.set(pr.x, 18, pr.y);
    if (pr.super) v.root.scale.setScalar(2);
    const ang = Math.atan2(pr.vx, pr.vy);
    if (pr.kind === 'wrench' || pr.kind === 'deck' || pr.kind === 'axe') { v.root.rotation.y = ang; v.spin.rotation.y = pr.spin; }
    else if (pr.kind === 'arrow') v.root.rotation.y = ang;
    else v.spin.rotation.set(t * 9, t * 7, 0);
  }

  syncLevel(g, t) {
    // rolling shutters drop closed (a locked-down gate, the burning locker) and roll up when open
    for (const sh of this.shutters || []) {
      const def = (g.level.shutters || []).find((x) => x.id === sh.id);
      let closed = 0;
      if (def) {
        const tx = def.vertical ? def.x : def.x, ty = def.vertical ? def.y0 : def.y;
        closed = g.tile(tx, ty) === T.DOOR ? 1 : 0;
      }
      sh.closed += (closed - sh.closed) * 0.12;
      sh.slab.scale.y = 0.08 + 0.92 * sh.closed;
      sh.slab.position.y = sh.h - (sh.h * sh.slab.scale.y) / 2;
    }
    const ex = g.level.exit;
    if (ex && this.exit) {
      const sealed = g.tile(ex.x, ex.y) === T.SEALED;
      if (this.exitSealed && !sealed) {
        this.exitSealed = false;
        this.exit.userData.bars.visible = false;
        this.exit.userData.disk.material.opacity = 1;
        this.exit.userData.halo.material.opacity = 0.6;
      }
      this.exit.userData.disk.rotation.z = -t * 2.5;
    }
    if (this.merchant) {
      this.merchant.update(Math.min(0.05, Math.max(0, t - (this.merchantT ?? t))));
      this.merchantT = t;
      const ps = g.livePlayers();
      if (ps.length) { const p = ps[0]; this.merchant.root.rotation.y = Math.atan2(p.x - this.merchant.root.position.x, p.y - this.merchant.root.position.z); }
    }
    for (const f of this.fireLights || []) f.scale.setScalar(36 * (1 + Math.sin(t * 17 + f.position.x) * 0.2 + Math.sin(t * 29 + f.position.z) * 0.12));
    for (const [i, c] of (this.crts || []).entries()) c.material.color.setScalar(0.85 + Math.sin(t * 23 + i * 5) * 0.1 + (Math.sin(t * 61 + i) > 0.97 ? 0.3 : 0));
    // the alarm: a red pulse over the whole set (Scene 1)
    this.hemi.color.set(g.alarm > 0 ? '#ff9aa8' : g.theme.light);
    this.hemi.intensity = g.theme.ambient * 1.7 * (g.alarm > 0 ? 0.75 + (Math.sin(t * 8) * 0.5 + 0.5) * 0.5 : 1);
  }

  syncLights(g, t, cx, cz) {
    const sorted = this.torches
      .map((tc) => ({ tc, d: (tc.x - cx) ** 2 + (tc.z - cz) ** 2 }))
      .sort((a, b) => a.d - b.d);
    this.torchLights.forEach((l, i) => {
      const s = sorted[i];
      if (!s || s.d > 800 * 800) { l.intensity = 0; return; }
      l.position.set(s.tc.x, s.tc.y ?? 46, s.tc.z + 10);
      l.color.set(s.tc.color || '#ff9a50');
      l.intensity = (s.tc.power || 110) * (1 + Math.sin(t * 13 + i * 3) * 0.08);
    });
    const ps = g.allPlayers();
    this.playerLights.forEach((l, i) => {
      const p = ps[i];
      if (!p || !p.alive) { l.intensity = 0; return; }
      l.color.set(heroColor(p.cls)).lerp(this.tmpColor.set('#ffffff'), 0.65);
      l.position.set(p.x, 60, p.y + 10);
      l.intensity = 60;
    });
    const ex = g.level.exit;
    if (ex) this.exitLight.position.set(ex.x * TILE + 16, 30, ex.y * TILE + 16);
    this.exitLight.intensity = !ex || this.exitSealed ? 0 : 90 + Math.sin(t * 4) * 20;
  }

  syncParticles(g) {
    const n = Math.min(g.particles.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
      const p = g.particles[i];
      const k = Math.max(0, p.life / p.max);
      this.pPos[i * 3] = p.x;
      this.pPos[i * 3 + 1] = 12 + (1 - k) * 12;
      this.pPos[i * 3 + 2] = p.y;
      this.tmpColor.set(p.color);
      this.pCol[i * 3] = this.tmpColor.r * k * 1.4;
      this.pCol[i * 3 + 1] = this.tmpColor.g * k * 1.4;
      this.pCol[i * 3 + 2] = this.tmpColor.b * k * 1.4;
    }
    const geo = this.particles.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  toScreen(x, y, h = 0) {
    const v = this.tmpV.set(x, h, y).project(this.camera);
    return { x: (v.x + 1) / 2 * VIEW_W, y: (1 - v.y) / 2 * VIEW_H, visible: v.z < 1 };
  }

  // ---------- menu showcase (title / hero select) ----------

  renderShowcase(entries, time) {
    if (!this.showcase) this.buildShowcase();
    const SC = this.showcase;
    const dt = Math.min(0.05, Math.max(0, time - (SC.last ?? time)));
    SC.last = time;
    const seen = new Set();
    entries.forEach((en, i) => {
      const key = `${i}:${en.cls}`;
      seen.add(key);
      let h = SC.heroes.get(key);
      if (!h) {
        h = new Actor(en.cls);
        h.base(HERO_STYLE[en.cls].idle);
        SC.heroes.set(key, h);
        SC.scene.add(h.root);
      }
      h.root.visible = true;
      const ndc = new THREE.Vector3((en.sx / VIEW_W) * 2 - 1, -(en.sy / VIEW_H) * 2 + 1, 0.5).unproject(SC.camera);
      const dir = ndc.sub(SC.camera.position).normalize();
      const dist = -SC.camera.position.z / dir.z;
      h.root.position.copy(SC.camera.position).add(dir.multiplyScalar(dist));
      h.root.scale.setScalar(en.scale);
      h.root.rotation.y = en.turn ?? 0;
      if (en.cheer && !h.cheered) { h.cheered = true; h.base('Cheer'); }
      else if (!en.cheer && h.cheered) { h.cheered = false; h.base(HERO_STYLE[en.cls].idle); }
      h.update(dt);
    });
    for (const [k, h] of SC.heroes) if (!seen.has(k)) h.root.visible = false;
    SC.halos.forEach((hl, i) => hl.scale.setScalar(240 * (1 + Math.sin(time * 17 + i) * 0.06 + (Math.sin(time * 41 + i * 9) > 0.98 ? -0.3 : 0))));
    SC.lights.forEach((l, i) => (l.intensity = 150 * (1 + Math.sin(time * 13 + i * 3) * 0.08)));
    this.renderer.render(SC.scene, SC.camera);
  }

  buildShowcase() {
    // the menu stage: a neon Food Court storefront, lit magenta, cyan and gold
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a0f33');
    scene.fog = new THREE.Fog('#2a1850', 500, 1100);
    const camera = new THREE.PerspectiveCamera(32, VIEW_W / VIEW_H, 5, 2000);
    camera.position.set(0, 70, 420);
    camera.lookAt(0, 50, 0);
    scene.add(new THREE.HemisphereLight('#fff0f8', '#4a2a7a', 1.7));
    const key = new THREE.DirectionalLight('#ffe8f4', 1.5);
    key.position.set(-150, 300, 400);
    scene.add(key);
    // checkerboard floor
    const tiles = [];
    const A = new THREE.Color('#f4ecd8'), B = new THREE.Color('#3fd6c8');
    for (let x = -14; x <= 14; x++) for (let z = -8; z <= 6; z++) tiles.push({ x: x * 48, y: -2, z: z * 48, rx: -Math.PI / 2, color: `#${((x + z) % 2 ? B : A).getHexString()}` });
    const g = new THREE.Group();
    this.instancedPrim(g, new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.1 }), tiles);
    // the back wall with three glowing storefront signs
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1500, 190, 20), new THREE.MeshStandardMaterial({ color: '#7a4cc8', roughness: 0.7, emissive: '#2a1650', emissiveIntensity: 0.4 }));
    wall.position.set(0, 93, -190);
    g.add(wall);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1500, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff2ea6', toneMapped: false }));
    trim.position.set(0, 130, -178);
    const trim2 = trim.clone(); trim2.material = new THREE.MeshBasicMaterial({ color: '#2ee6ff', toneMapped: false }); trim2.position.y = 20;
    g.add(trim, trim2);
    const lights = [], halos = [];
    [['PIZZA', '#ff5a2a', -330], ['BURGERS', '#ff2ea6', -110], ['TACO', '#ffcc33', 110], ['SMOOTHIES', '#2ee6ff', 330]].forEach(([name, color, x]) => {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(190, 60), new THREE.MeshBasicMaterial({ map: neonSignTexture(name, color), toneMapped: false }));
      sign.position.set(x, 90, -178);
      g.add(sign);
      const halo = glowSprite(color, 240, 0.5);
      halo.position.set(x, 90, -160);
      g.add(halo);
      halos.push(halo);
      const l = new THREE.PointLight(color, 150, 520, 1);
      l.position.set(x, 150, -100);
      g.add(l);
      lights.push(l);
    });
    scene.add(g);
    this.showcase = { scene, camera, heroes: new Map(), lights, halos };
  }
}

function makePhoenix() {
  const g = new THREE.Group();
  const fire = new THREE.MeshStandardMaterial({ color: '#ffa030', emissive: '#ff5010', emissiveIntensity: 1.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), fire);
  body.scale.set(1, 0.8, 1.6);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), fire);
  head.position.set(0, 2, 6);
  g.add(head);
  const wings = [];
  const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -3), new THREE.Vector3(14, 2, -2), new THREE.Vector3(10, 0, 4)]);
  wingGeo.computeVertexNormals();
  const wingMat = new THREE.MeshStandardMaterial({ color: '#ffd040', emissive: '#ff7010', emissiveIntensity: 1.4, side: THREE.DoubleSide });
  for (const s of [1, -1]) { const w = new THREE.Mesh(wingGeo, wingMat); w.scale.x = s; g.add(w); wings.push(w); }
  g.add(glowSprite('#ff7020', 40, 0.8));
  g.userData.wings = wings;
  return g;
}

function addHorns(actor, color, r, len, spread) {
  const head = actor.bone('head');
  if (!head) return;
  const hm = new THREE.MeshStandardMaterial({ color, flatShading: true });
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(r, len, 6), hm);
    horn.position.set(s * spread, 0.95, 0);
    horn.rotation.z = -s * 0.6;
    head.add(horn);
  }
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
