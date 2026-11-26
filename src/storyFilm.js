// The in-campaign story scenes in HD (STORY.md 9b-9f), built on the cinema toolkit.
//
// cutscenes.js stays the boss: it owns the beats, the timers and the choices, and every beat names a 3D shot
// ('plan.biker', 'cr.crane', ...). This file only DRAWS that: it is driven entirely by Cutscene.view().film, so an
// online guest, who has nothing but the host's view, sees the same pictures.
//
//   const film = new StoryFilm(r3d, view.film);
//   film.update(dt, view.film);  film.render(view.bar);  film.fxView();  film.dispose();
//
// view.film = { key (one per scene played), id, shot, cut (a new number = a new shot), ts (slow-motion factor),
//               tens (0..1, how far the choice timer has drained), ray (rayFate or ''), party: [classes],
//               hit: [n, shake, flash, blood, grease, punch] (a new n = a new camera hit) }
//
// This file never plays sounds: every sound is a cutscene cue, so a guest (who runs its own film) never hears it twice.
//
// A shot is { cam, fov, dof, exposure, bloom, grade } plus the staging it sets up when it starts and an optional
// tick(dt, lt). Every shot resets the stage first, so any shot can be entered cold (a skipped line, a dev jump).
// Nothing here touches the game world; dispose() frees the scene and hands the renderer back as it was.

import * as THREE from 'three';
import { CinePlayer, dolly, crane, push, whip, orbit, clamp01, smooth, mix, hash } from './cineCore.js';
import { LightRig, makeShaft, DustField, SparkPool, flicker, scriptedFail, disposeTree } from './cineFx.js';
import { GRADES } from './cineGrade.js';
import { warmSplat } from './cineLens.js';
import { SCOPE_BAR_PX } from './camMath.js';
import { CineActor, makeHero, makeZombie } from './cineStage.js';
import { buildConcourse, buildOffice, FOUNTAIN, OFFICE_X } from './cineSets.js';
import { buildPizza, buildKitchen, buildBoombox, drawPrintout, glowPlane, SteamPuffs, PIZZA_X, TICKET_AT, KITCHEN_X, GAUGE_AT } from './cineStorySets.js';
import { Actor } from './assets.js';
import { keep } from './gpu.js';
import { buildBoss, glowSprite, BOSS_SCALE } from './models.js';
import { BOSS_ROSTER } from './bossRoster.js';

const SPLAT_SEED = 1;
const SURVIVORS = ['biker', 'mallCop', 'skater', 'mallGoth'];
const D2R = Math.PI / 180;
const OX = OFFICE_X, PX = PIZZA_X, KX = KITCHEN_X, FZ = FOUNTAIN[2];

// which sets a scene needs (only those are built)
const NEEDS = {
  opening: { office: true, zombies: 0 },
  ticket: { pizza: true, concourse: true, ray: true, zombies: 6 },
  crisis: { pizza: true, ray: true, zombies: 6 },
  boss: { kitchen: true, ray: true, butcher: true, zombies: 0 },
  ending: { kitchen: true, office: true, ray: true, butcher: true, shopper: true, zombies: 0 },
};

const OFFICE_AMB = { sky: '#2a4a48', ground: '#06090c', hemi: 0.5, moon: 0, moonColor: '#102020' };
const PIZZA_AMB = { sky: '#4a2a3a', ground: '#0c0608', hemi: 0.45, moon: 0.12, moonColor: '#6070c0' };
const KITCHEN_AMB = { sky: '#4a3020', ground: '#0c0602', hemi: 0.38, moon: 0.1, moonColor: '#60a080' };

export class StoryFilm {
  constructor(r3d, fv) {
    this.r3d = r3d;
    this.key = fv.key;
    this.id = fv.id;
    this.high = r3d.quality === 'high';
    this.party = (fv.party || []).filter((c) => SURVIVORS.includes(c));
    this.cut = null;       // the shot number on screen
    this.shotName = '';
    this.lt = 0;           // this shot's own clock
    this.abs = 0;          // the film's clock (monotonic: shakes are laid on it)
    this.tens = 0;
    this.ray = fv.ray || '';
    this.dead = false;
    // a film joined mid-scene does not replay the last hit
    this.hitSeen = fv.cut > 1 && fv.hit ? fv.hit[0] : 0;
    this.look = 'NIGHT_RAIN'; // the current set's grade
    if (!NEEDS[this.id]) throw new Error(`no story film for "${this.id}"`);
    this.claimRenderer();
    try { this.build(); } catch (err) { this.dispose(); throw err; }
  }

  // High gets a crisper backbuffer for the film; Low keeps its budget. Undone by dispose().
  claimRenderer() {
    const r = this.r3d.renderer;
    this.savedRatio = r.getPixelRatio();
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(this.high ? Math.min(1.6, Math.max(1.25, dpr)) : Math.max(this.savedRatio, 0.8));
    r.setSize(960, 640, false);
    if (this.r3d.canvas) this.r3d.canvas.style.imageRendering = 'auto';
  }

  releaseRenderer() {
    try {
      if (this.savedRatio != null) { this.r3d.renderer.setPixelRatio(this.savedRatio); this.r3d.renderer.setSize(960, 640, false); }
      if (this.r3d.pixelLevel != null) this.r3d.setPixelation(this.r3d.pixelLevel);
    } catch { /* renderer gone */ }
    this.savedRatio = null;
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    try { if (this.pl) this.pl.dispose(); } catch { /* already gone */ }
    if (this.scene) { disposeTree(this.scene); this.scene.clear(); }
    this.pl = null;
    this.releaseRenderer();
  }

  // ---------------------------------------------------------------- build

  build() {
    const need = NEEDS[this.id], high = this.high;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#05040a');
    scene.fog = new THREE.Fog('#07060c', 200, 1300);
    this.lights = new LightRig(scene);
    this.sparks = new SparkPool(scene, high ? 240 : 100);
    this.dust = new DustField(scene, { n: high ? 150 : 50, box: [420, 180, 380], center: [0, 0, 0], color: '#d8ccff', size: high ? 2.6 : 3.6, opacity: high ? 0.45 : 0.32 });
    this.sets = {};

    if (need.office) {
      const o = buildOffice({ chair: false }); scene.add(o.group); this.sets.office = o;
      this.buildOfficeProps(o.group);
    }
    if (need.pizza) {
      const p = buildPizza({ high }); scene.add(p.group); this.sets.pizza = p;
      this.shaftsPizza = [];
      for (const [x, z, c] of high ? [[-90, 30, '#ff8a40'], [60, 20, '#ff5a80'], [-176, -80, '#ff3020']] : [[-90, 30, '#ff8a40']]) { const s = makeShaft({ color: c, len: 176, r0: 5, r1: 42, opacity: 0.17 }); s.position.set(x, 176, z); p.group.add(s); this.shaftsPizza.push(s); }
    }
    if (need.concourse) { const c = buildConcourse({ high }); scene.add(c.group); this.sets.concourse = c; }
    if (need.kitchen) {
      const k = buildKitchen({ high }); scene.add(k.group); this.sets.kitchen = k;
      this.shaftsKitchen = [];
      for (const [x, z] of high ? [[-150, -18], [-50, -18], [50, -18], [150, -18], [-262, -20]] : [[-50, -18], [150, -18]]) { const s = makeShaft({ color: x < -200 ? '#9ad8ff' : '#ff8a28', len: 150, r0: 7, r1: 38, opacity: high ? 0.2 : 0.15 }); s.position.set(x, 148, z); k.group.add(s); this.shaftsKitchen.push(s); }
    }

    // the cast: the game's own models
    this.heroes = {};
    for (const cls of SURVIVORS) { const a = makeHero(cls); scene.add(a.root); this.heroes[cls] = a; }
    if (need.ray) { this.rayA = makeHero('ray'); scene.add(this.rayA.root); }
    this.zombies = [];
    const kinds = ['walker', 'walker', 'sprinter', 'walker', 'brute', 'spitter'];
    for (let i = 0; i < need.zombies; i++) { const a = makeZombie(kinds[i % kinds.length], (i % 2) + 1); scene.add(a.root); this.zombies.push(a); }
    if (need.butcher) this.buildButcher(scene);
    if (need.shopper) this.buildShopper(scene);

    // hand props that travel with the cast
    this.boombox = buildBoombox(); scene.add(this.boombox.group);
    // the Mall Cop's eyes catching cook-yellow (placed at his head every frame while on)
    this.copEyes = [0, 1].map(() => { const s = glowSprite('#ffc020', 3.2, 0.9); s.material.depthTest = false; s.renderOrder = 9; scene.add(s); return s; });
    // his keycard
    this.keycard = new THREE.Group();
    const cardM = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.4, 0.35), new THREE.MeshBasicMaterial({ color: '#d8d0b8' }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a18').multiplyScalar(1.3), toneMapped: false })); band.position.y = 1.6;
    this.keycard.add(cardM, band); scene.add(this.keycard);

    this.pl = new CinePlayer(this.r3d, scene, [{ id: 'blank', dur: 10, cam: dolly([0, 60, 200], [0, 60, 200], [0, 40, 0]), fov: [40, 40] }]);
    this.barFrac = SCOPE_BAR_PX / 640;
    this.pl.bar = () => this.barFrac;
    this.pl.shotI = 0;
    this.pose = null;
    // paint this scene's lens splat now, not on the frame of the scare
    const splat = { crisis: 'blood', boss: 'grease', ending: 'grease' }[this.id];
    if (splat) warmSplat(splat, SPLAT_SEED);
    this.warm();
  }

  buildOfficeProps(g) {
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    // a PA speaker high on the wall
    add(new THREE.BoxGeometry(22, 15, 10), lam('#1c1a26'), -98, 94, -62);
    const horn = add(new THREE.CylinderGeometry(8, 3.5, 9, 14, 1, true), new THREE.MeshLambertMaterial({ color: '#0a0910', side: THREE.DoubleSide }), -98, 94, -54); horn.rotation.x = Math.PI / 2;
    this.paLed = add(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a2a', toneMapped: false }), -89, 99, -56);
    this.paHalo = glowPlane(48, 40, '#ffd23a', 0); this.paHalo.position.set(-98, 94, -52); g.add(this.paHalo);
    // the dot-matrix printer on the desk and its paper
    add(new THREE.BoxGeometry(34, 8, 18), lam('#b8b0a0'), 58, 40, -22);
    add(new THREE.BoxGeometry(28, 2, 3), lam('#2a2830'), 58, 45, -24);
    this.paper = document.createElement('canvas'); this.paper.width = 440; this.paper.height = 624;
    this.paperTex = new THREE.CanvasTexture(this.paper); this.paperTex.colorSpace = THREE.SRGBColorSpace; this.paperTex.anisotropy = 4;
    this.sheet = add(new THREE.PlaneGeometry(26, 37), new THREE.MeshBasicMaterial({ map: this.paperTex, color: '#cdd8cc', side: THREE.DoubleSide, toneMapped: false }), 58, 64, -17);
    this.sheet.rotation.x = -0.1;
    this.lastRows = -1;
    // the red alarm lamp over the door
    this.alarmLamp = add(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff2010', toneMapped: false }), 104, 98, -64);
  }

  printRows(k) {
    const q = Math.round(k * 11);
    if (q === this.lastRows) return;
    this.lastRows = q;
    drawPrintout(this.paper.getContext('2d'), this.paper.width, this.paper.height, k);
    this.paperTex.needsUpdate = true;
  }

  buildButcher(scene) {
    const row = BOSS_ROSTER.find((b) => b.id === 'butcher');
    const root = buildBoss(row.model, row.color, row.horn);
    root.scale.setScalar(BOSS_SCALE * 1.12);
    scene.add(root);
    // bossModels.js caches its prop shapes and painted textures and the live boss uses the same ones: dispose() must
    // leave those alone (the skinned body and the materials are this film's own, and are freed with it)
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.isSkinnedMesh) keep(o.geometry);
      for (const m of [].concat(o.material)) for (const k in m) if (m[k] && m[k].isTexture) keep(m[k]);
    });
    const rig = root.userData.rig;
    const B = this.butcher = { root, rig, scale: BOSS_SCALE * 1.12, legs: rig.legs, armR: rig.arm, armL: rig.basket && rig.basket.parent ? rig.basket.parent.parent : null, head: rig.heads[0], cleaver: [] };
    // the fibreglass is cracked, and the cook's eyes light it from inside
    B.crackMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc020').multiplyScalar(2), toneMapped: false });
    const onSkull = (x, y) => { const k = 1 - (x / 22.4) ** 2 - ((y - 6) / 20.8) ** 2; return new THREE.Vector3(x, y, 20.9 * Math.sqrt(Math.max(0.02, k)) + 0.25); };
    const lines = [
      [[3, 25], [7, 21], [5, 18], [12, 15.5], [15, 11], [13.5, 7], [18, 3], [16, -3]],
      [[12, 15.5], [16, 17.5], [18, 15]],
      [[13.5, 7], [10.5, 3], [12, -1]],
      [[-6, 24], [-10, 21.5], [-9, 19], [-14, 17], [-17.5, 12]],
      [[-15, 6], [-18, 2], [-14, -4], [-16, -8]],
    ];
    for (const l of lines) for (let i = 1; i < l.length; i++) {
      const a = onSkull(...l[i - 1]), b = onSkull(...l[i]), d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, d.length() + 0.35, 0.5), B.crackMat);
      m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m.frustumCulled = false; B.head.add(m);
    }
    B.cracks = B.head.children.filter((c) => c.material === B.crackMat);
    // a loose copy of the cleaver, for the moment it hits the floor
    const hand = rig.cleaver;
    B.cleaver = hand.children.filter((c) => c.isMesh);
    const drop = new THREE.Group(), inner = new THREE.Group();
    for (const c of B.cleaver) inner.add(c.clone());
    const box = new THREE.Box3().setFromObject(inner), mid = box.getCenter(new THREE.Vector3());
    inner.position.sub(mid); drop.add(inner); drop.scale.setScalar(B.scale); scene.add(drop);
    B.drop = drop;
  }

  buildShopper(scene) {
    const a = new Actor('z_shopper', { ghost: '#bcd8ff' });
    a.base('Idle');
    const c = this.shopper = new CineActor(a, { scale: 1.0 });
    scene.add(c.root);
    // its receipt, still printing, down to the floor
    const g = new THREE.Group();
    const tex = document.createElement('canvas'); tex.width = 64; tex.height = 512;
    const x = tex.getContext('2d');
    x.fillStyle = '#eef6ff'; x.fillRect(0, 0, 64, 512); x.fillStyle = '#334';
    for (let i = 0; i < 46; i++) x.fillRect(8, 8 + i * 11, 18 + hash(i) * 30, 3);
    const t = new THREE.CanvasTexture(tex); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 36), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.82, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    g.add(m); scene.add(g);
    this.receipt = g;
  }

  // Compile every material now (the first frame sits under a fade) so no shot hitches when it first appears.
  warm() {
    try {
      this.scene.traverse((o) => { o.userData.wasVisible = o.visible; o.visible = true; });
      this.r3d.renderer.compile(this.scene, this.pl.camera);
    } catch (e) { console.warn('story film warm-up failed', e); }
    this.scene.traverse((o) => { if ('wasVisible' in o.userData) { o.visible = o.userData.wasVisible; delete o.userData.wasVisible; } });
  }

  // ---------------------------------------------------------------- staging helpers

  /** Everyone off stage, every prop back to its mark. */
  reset() {
    for (const k in this.sets) this.sets[k].group.visible = false;
    for (const a of this.cast()) {
      a.visible = false; a.frozen = false; a.root.rotation.set(0, 0, 0); a.root.scale.setScalar(a.baseScale);
      for (const k in a.target) { a.target[k] = 0; a.g[k] = 0; }
      a.rate = 6; a.walk = null; a.resetActing();
    }
    for (const cls of SURVIVORS) this.heroes[cls].breathe(0.4);
    if (this.rayA) this.rayA.breathe(0.5);
    for (const cls of SURVIVORS) this.heroes[cls].loop(cls === 'mallGoth' ? 'Idle' : '2H_Melee_Idle', 1);
    if (this.rayA) this.rayA.loop('Idle', 1);
    for (const z of this.zombies) z.loop('Walking_D_Skeletons', 0.6);
    this.boombox.group.visible = false; this.bass = 0;
    this.copEyes.forEach((s) => { s.visible = false; }); this.eyes = 0;
    this.keycard.visible = false;
    if (this.receipt) this.receipt.visible = false;
    if (this.butcher) {
      const B = this.butcher;
      B.root.visible = false; B.root.position.set(KX, 0, 0); B.root.rotation.set(0, 0, 0);
      B.rig.rig.rotation.set(0, 0, 0); B.legs.forEach((l) => l.rotation.set(0, 0, 0));
      B.armR.rotation.set(-0.35, 0, 0); if (B.armL) B.armL.rotation.set(0, 0, 0); B.head.rotation.set(0, 0, 0);
      if (B.head.userData.jaw) B.head.userData.jaw.rotation.x = 0.06;
      B.cleaver.forEach((c) => { c.visible = true; }); B.drop.visible = false;
    }
    const P = this.sets.pizza;
    if (P) {
      const h = P.h;
      h.hood.position.set(-32, 98, -42); h.hood.rotation.set(0, 0, 0); h.debris.visible = false; h.lockerDoor.rotation.y = 0; h.lockerGlow.material.opacity = 0; h.setShutter(0);
      h.counterMid.rotation.set(0, 0, 0); h.ticket.visible = true;
    }
    const K = this.sets.kitchen;
    if (K) { K.h.power = 1; K.h.block.visible = true; }
    if (this.sets.office) { this.feedMode = 'door'; this.feedK = 0.4; this.sheet.visible = false; this.paperK = 0; this.paTalk = 0; }
    this.slam = 0;
    this.sparks.clear();
    this.scene.fog.color.set('#07060c'); this.scene.fog.near = 200; this.scene.fog.far = 1300;
  }

  show(...names) { for (const n of names) this.sets[n].group.visible = true; }
  fog(near, far, color) { this.scene.fog.near = near; this.scene.fog.far = far; if (color) this.scene.fog.color.set(color); }
  light(amb, cfg) { this.lights.set({ amb: this.high ? amb : { ...amb, hemi: amb.hemi * 1.2 + 0.04 }, key: null, rim: null, fill: null, fx: null, ...cfg }, true); } // (Low has no bloom: lift the shadows a little)

  /** Put a survivor (or 'ray') on a mark, facing yaw radians (0 = toward +z). */
  place(who, x, z, yaw = 0, y = 0) {
    const a = who === 'ray' ? this.rayA : this.heroes[who];
    a.visible = true; a.root.position.set(x, y, z); a.root.rotation.y = yaw;
    return a;
  }

  zombie(i, x, z, yaw = 0, speed = 0.6) {
    const a = this.zombies[i % this.zombies.length];
    a.visible = true; a.root.position.set(x, 0, z); a.root.rotation.y = yaw; a.loop('Walking_D_Skeletons', speed);
    return a;
  }

  /** The party's own survivors take the middle marks of a line-up. */
  order() { return [...new Set([...this.party, 'mallCop', 'biker', 'mallGoth', 'skater'])]; }
  lineup(cx, cz, yaw = 0) {
    const marks = [[-20, 0], [20, 0], [-58, 12], [58, 12]];
    this.order().forEach((cls, i) => { const a = this.place(cls, cx + marks[i][0], cz + marks[i][1], yaw - Math.sign(marks[i][0]) * (i > 1 ? 0.22 : 0.06)); a.look(0, 3, 3); });
  }

  /** A camera in front of an actor: dist along their facing, side to their left, at height h looking at height lh. */
  face(a, dist, side, h, lh) {
    const p = a.root.position, yaw = a.root.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    return { p: [p.x + fx * dist + fz * side, p.y + h, p.z + fz * dist - fx * side], l: [p.x, p.y + lh, p.z] };
  }

  /** A slow push from one framing of an actor to another. */
  closeUp(a, [d0, s0, h0, l0], [d1, s1, h1, l1], o = {}) {
    const from = this.face(a, d0, s0, h0, l0), to = this.face(a, d1, s1, h1, l1);
    return push(from.p, to.p, from.l, to.l, o);
  }

  stageButcher(x, z, yaw = 0) {
    const B = this.butcher;
    B.root.visible = true; B.root.position.set(KX + x, 0, z); B.root.rotation.y = yaw;
    return B;
  }

  /** The Butcher's idle breathing, his glowing cracks, and the chop. raise 0..1 lifts the cleaver. */
  butcherPose(lt, { raise = 0, basket = 0, headYaw = 0, headPitch = 0, jaw = 0.06, glow = 1 } = {}) {
    const B = this.butcher;
    B.armR.rotation.x = -0.35 - raise * 1.75;
    if (B.armL) B.armL.rotation.x = -basket * 1.5;
    if (B.rig.belly) B.rig.belly.rotation.x = Math.sin(lt * 2.2) * 0.04;
    if (B.rig.basket) B.rig.basket.rotation.x = Math.sin(lt * 3) * 0.1;
    B.head.rotation.y = headYaw + Math.sin(lt * 1.3) * 0.04;
    B.head.rotation.x = headPitch;
    if (B.head.userData.jaw) B.head.userData.jaw.rotation.x = jaw;
    B.crackMat.color.set('#ffc020').multiplyScalar((1.5 + Math.sin(lt * 7) * 0.35 + Math.sin(lt * 17) * 0.2) * glow);
  }

  /** Shotgun-lamp orange from the fryers, green from the tired fluorescents. */
  kitchenLights(power = 1, extra = {}) {
    this.light({ ...KITCHEN_AMB, hemi: 0.2 + 0.18 * power }, {
      key: ['#ff7a18', [KX - 90, 36, 84], 330 * power, (t) => 0.86 + 0.14 * Math.sin(t * 13) * Math.sin(t * 7.3)],
      rim: ['#7affb0', [KX + 110, 150, -90], 260],
      fill: ['#ff9a40', [KX + 20, 150, 40], 150 * power],
      fx: ['#ff5a10', [KX, 56, -112], 330 * power, (t) => 0.8 + 0.2 * flicker(t, 3, true)],
      ...extra,
    });
  }

  pizzaLights(extra = {}) {
    this.light(PIZZA_AMB, {
      key: ['#ffb060', [PX - 90, 96, 90], 210],
      rim: ['#ff2a50', [PX + 120, 120, -50], 190],
      fill: ['#4a6aff', [PX + 110, 40, 130], 70],
      fx: ['#ff8a20', [PX + 26, 34, -62], 250, (t) => 0.82 + 0.18 * Math.sin(t * 12) * Math.sin(t * 5.1)],
      ...extra,
    });
  }

  officeLights(extra = {}) {
    this.light(OFFICE_AMB, {
      key: ['#8affd0', [OX - 66, 92, 104], 140],
      rim: ['#4af0a0', [OX + 4, 84, -34], 190],
      fill: ['#ff9a40', [OX + 112, 56, 40], 90],
      fx: null,
      ...extra,
    });
  }

  // ---------------------------------------------------------------- the shot list

  /** Build one shot: stage it, return its camera. `arg` is the part of the shot name after ':'. */
  stage(name, arg) {
    const fn = SHOTS[name];
    if (fn) return fn(this, arg);
    console.warn('no story shot', name);
    return { cam: dolly([0, 60, 220], [0, 60, 220], [0, 40, 0]), fov: [40, 40] };
  }

  enter(fv) {
    this.cut = fv.cut;
    this.shotName = fv.shot;
    const [name, arg] = String(fv.shot).split('=');
    this.lt = 0;
    this.reset();
    const s = this.stage(name, arg || '');
    this.pose = s;
    this.black = !!s.black;
    const pl = this.pl;
    pl.shots = [{ ...s, grade: s.grade || this.look, id: name, dur: s.dur || 6, a: this.abs, b: this.abs + (s.dur || 6) }];
    pl.shotI = 0; pl.t = this.abs; pl.prevVP = null; pl.flashV = 0;
    pl.shakes.length = 0;
    this.lights.update(0, this.abs, true);
    this.settle();
  }

  /** Let the animation mixers reach the pose before the first frame of a cut (no T-pose, no cross-fade from the last shot). */
  settle() {
    for (const a of this.actors()) a.update(0.6);
    this.tickShot(0);
  }

  cast() {
    const all = [...Object.values(this.heroes), ...this.zombies];
    if (this.rayA) all.push(this.rayA);
    if (this.shopper) all.push(this.shopper);
    return all;
  }

  actors() { return this.cast().filter((a) => a.visible); }

  tickShot(dt) { if (this.pose && this.pose.tick) this.pose.tick(dt, this.lt, this); }

  update(dt, fv) {
    if (this.dead) return;
    this.tens = fv.tens || 0;
    this.ray = fv.ray || '';
    if (fv.cut !== this.cut || fv.shot !== this.shotName) this.enter(fv);
    const sdt = dt * (fv.ts == null ? 1 : fv.ts);   // slow motion on a big hit: the picture only
    this.lt += sdt; this.abs += sdt;
    this.pl.t = this.abs;
    if (fv.hit && fv.hit[0] !== this.hitSeen) { this.hitSeen = fv.hit[0]; this.hit(...fv.hit.slice(1)); }
    // a draining choice timer makes the operator nervous, then panic; everyone breathes faster
    if (this.tens > 0 && this.pose && this.pose.nervous) {
      const live = this.pl.shots[0];
      live.cam.hand = 0.2 + this.tens * this.pose.nervous;
      live.panic = this.tens > 0.65;
      for (const a of this.actors()) if (!this.zombies.includes(a)) a.breathe(0.5 + this.tens * 0.5, 0.3 + this.tens * 0.8);
    }
    this.pl.flashV = Math.max(0, this.pl.flashV - dt * 4);
    this.tickShot(sdt);
    // a walk runs even while its actor is still off stage: a walk-in is what brings them on
    for (const a of this.cast()) if (a.walk) a.walk(sdt, this.lt);
    for (const a of this.actors()) if (!a.frozen) a.update(sdt);
    const t = this.abs, S = this.sets;
    if (S.pizza && S.pizza.group.visible) { S.pizza.h.update(sdt, t); S.pizza.h.drawCount(10 - Math.floor(this.tens * 9.99), Math.sin(t * 8) > 0); }
    if (S.concourse && S.concourse.group.visible) S.concourse.h.update(sdt, t);
    if (S.kitchen && S.kitchen.group.visible) S.kitchen.h.update(sdt, t);
    if (S.office && S.office.group.visible) {
      S.office.h.update(sdt, t);
      const tick = `${this.cut}:${Math.floor(t * 20)}`;   // a CCTV frame rate: no canvas upload every video frame
      if (tick !== this.feedTick) { this.feedTick = tick; S.office.h.drawFeed(t, this.feedK, this.feedMode); }
      this.paTalk = Math.max(0, this.paTalk - sdt);
      this.paHalo.material.opacity = this.paTalk > 0 ? 0.45 + Math.sin(t * 26) * 0.2 : 0;
      this.paLed.material.color.set(this.paTalk > 0 ? '#ffd23a' : '#ff3a2a');
      this.alarmLamp.material.color.set('#ff2010').multiplyScalar(Math.sin(t * 7) > 0 ? 2 : 0.3);
    }
    if (this.boombox.group.visible) { this.bass = Math.max(0, this.bass - sdt * 1.6); this.boombox.cones.forEach((m) => m.scale.setScalar(1 + this.bass * 0.35)); }
    this.updateEyes(t);
    this.lights.update(sdt, t);
    this.dust.update(sdt, t);
    this.sparks.update(sdt);
  }

  updateEyes(t) {
    const cop = this.heroes.mallCop;
    const on = this.eyes > 0 && cop.visible;
    if (!on) { this.copEyes.forEach((s) => { s.visible = false; }); return; }
    const w = cop.boneWorld('Head'), yaw = cop.root.rotation.y + cop.g.headYaw * D2R;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.copEyes.forEach((s, i) => {
      const side = i ? 1.15 : -1.15;
      s.visible = true;
      s.position.set(w.x + fx * 3.7 + fz * side, w.y + 2.5, w.z + fz * 3.7 - fx * side);
      s.scale.setScalar(2.4 * this.eyes * (1 + Math.sin(t * 13) * 0.12));
    });
  }

  /** A story cue's camera hit: shake, flash, blood or grease on the lens, a lens punch. A big one makes people flinch. */
  hit(shake = 0, flash = 0, blood = 0, grease = 0, punch = 0) {
    if (this.dead || !this.pl) return;
    if (shake) this.pl.shake(this.abs, shake * 0.55);
    if (flash) this.pl.flashV = Math.max(this.pl.flashV, flash * 0.8);
    if (blood) this.pl.splat(this.abs, blood, 'blood', SPLAT_SEED);
    if (grease) this.pl.splat(this.abs, grease, 'grease', SPLAT_SEED);
    if (punch) this.pl.punch(this.abs, punch);
    if (shake >= 9) for (const a of this.actors()) if (!this.zombies.includes(a)) a.flinch(Math.min(1, shake / 14));
  }

  /** What the 2D overlay puts on the lens this frame. */
  fxView() {
    if (this.dead || !this.pl || this.black) return { graded: true, high: this.high };
    return { flares: this.pl.flares(), blood: this.pl.splatView(), graded: this.pl.post.graded, lean: this.pl.post.lean, high: this.pl.high };
  }

  /** bar: the letterbox height the HUD is drawing, in the 640-tall canvas's pixels. */
  render(bar = SCOPE_BAR_PX) {
    if (this.dead || !this.pl || this.cut == null) return;
    this.barFrac = Math.max(0, bar) / 640;
    if (this.black) { const r = this.r3d.renderer; r.setRenderTarget(null); r.setClearColor('#000000', 1); r.clear(); return; }
    this.pl.render();
  }
}

// ===================================================================== SHOTS
// Positions are in each set's own space plus its x offset (OX office, PX Ray's, KX kitchen).

const o3 = (x, y, z) => [OX + x, y, z];
const p3 = (x, y, z) => [PX + x, y, z];
const k3 = (x, y, z) => [KX + x, y, z];

function office(F) { F.show('office'); F.look = 'SICK_FLUOR'; F.dust.moveTo(OX, 0, 20); F.fog(250, 700, '#04100c'); }
function pizza(F) { F.show('pizza'); F.look = 'PIZZA_EMBER'; F.dust.moveTo(PX, 0, 0); F.fog(300, 900, '#12050a'); }
function kitchen(F) { F.show('kitchen'); F.look = 'FRYER_HELL'; F.dust.moveTo(KX, 0, -20); F.fog(190, 880, '#241006'); }
// the anamorphic flare points
const monitorFlares = [{ at: [OX, 66, -60], color: '#58f0b0', k: 0.3, len: 0.7 }];
const eyeFlares = (F) => [0, 1].map((i) => ({ at: () => (F.eyes > 0.3 ? F.copEyes[i].position : null), color: '#ffb020', k: () => F.eyes * 0.6, len: 0.35 }));

// the red alarm strobe in the Security Room
const alarmStrobe = { fx: ['#ff2030', [OX + 80, 100, 50], 260, (t) => Math.max(0.05, Math.sin(t * 7))] };

// ----- Scene 1, "The Plan": the four round the monitors
function crew(F, talk = null) {
  const marks = { biker: [-58, 20, 0.4], mallCop: [-17, 6, 0.1], mallGoth: [23, 10, -0.15], skater: [62, 24, -0.45] };
  for (const cls of SURVIVORS) { const [x, z, yaw] = marks[cls]; const a = F.place(cls, OX + x, z, yaw); if (talk && cls !== talk) { const t = marks[talk]; a.look(Math.max(-50, Math.min(50, (Math.atan2(t[0] - x, t[1] - z) - yaw) / D2R * 0.7)), 0, 3); } }
  F.boombox.group.visible = true; F.boombox.group.position.set(OX + 42, 7, 24); F.boombox.group.rotation.y = -0.3;
}

const SHOTS = {
  // 1: wide inside the security office, a slow push
  'plan.wide'(F) {
    office(F); crew(F); F.officeLights(alarmStrobe);
    return { dur: 9, flares: monitorFlares, cam: push(o3(-30, 80, 205), o3(-6, 70, 170), o3(0, 43, 0), o3(0, 42, 0), { hand: 0.3 }), fov: [42, 38], dof: { focus: [200, 165], aperture: 0.4 }, tick: (dt, lt) => { if (lt > 1.2) F.heroes.mallCop.look(0, 2, 4); } };
  },
  // 2: medium close-up of the Biker, slightly low, orange doorway rim
  'plan.biker'(F) {
    office(F); crew(F); F.officeLights({ key: ['#ffd0a0', [OX - 66, 74, 96], 210], rim: ['#ff7a18', [OX - 112, 70, -4], 330], fill: ['#2a8a70', [OX + 20, 40, 80], 60] });
    const a = F.heroes.biker; a.root.rotation.y = 0.5;
    F.heroes.mallCop.visible = false;
    return { dur: 5, cam: F.closeUp(a, [80, 48, 46, 41], [62, 34, 46, 43], { hand: 0.3 }), fov: [34, 31], dof: { focus: [93, 70], aperture: 1.1 }, grade: 'HERO_GRIT', tick: (dt, lt) => { if (lt > 0.5) a.look(16, 3, 3); if (lt > 2) a.raise('L', 0.4); } };
  },
  // 3: push to a close-up on the Mall Cop; the chime; he freezes with his eyes empty
  'plan.freeze'(F) {
    office(F); crew(F);
    const tube = () => scriptedFail(F.lt, [[0.45, 0.5]]);
    F.officeLights({ key: ['#9affd8', [OX - 56, 72, 70], 130, tube], rim: ['#ffd23a', [OX - 60, 104, -30], 260] });
    const a = F.heroes.mallCop; a.look(14, 0, 5); F.paTalk = 2.6;
    F.heroes.biker.visible = false; F.heroes.mallGoth.visible = false;
    return { dur: 7, grade: { ...GRADES.SICK_FLUOR, sick: 1.3 }, cam: F.closeUp(a, [90, 34, 54, 42], [48, 19, 52, 45], { hand: 0.12, ease: 'out' }), fov: [34, 27], dof: { focus: [92, 45], aperture: 1.6 }, tick: (dt, lt) => {
      if (lt > 0.55 && lt < 3.1) { a.frozen = true; F.eyes = Math.min(0.5, (lt - 0.55)); F.copEyes.forEach((s) => s.material.color.set('#cfe8ff')); F.lights.set({ key: ['#9affd8', [OX - 56, 72, 70], 46, tube] }); }
      if (lt >= 3.1 && a.frozen) { a.frozen = false; F.eyes = 0; a.tremble(0.15); a.look(18, 0, 5); F.lights.set({ key: ['#9affd8', [OX - 56, 72, 70], 130] }); }
      if (lt >= 3.1) F.eyes = 0;
      for (const s of F.copEyes) if (lt >= 3.1) s.material.color.set('#ffffff');
    } };
  },
  // 4: over the Skater's shoulder to the Mall Goth; she taps her boombox
  'plan.goth'(F) {
    office(F); crew(F, 'mallGoth');
    F.officeLights({ key: ['#c07aff', [OX - 10, 84, 76], 190, (t) => 0.7 + 0.3 * flicker(t, 6, true)], rim: ['#7a30ff', [OX + 70, 80, -30], 300] });
    const g = F.heroes.mallGoth, s = F.heroes.skater;
    g.root.position.set(OX + 14, 0, 12); g.root.rotation.y = 0.62;
    s.root.position.set(OX + 70, 0, 52); s.root.rotation.y = Math.atan2(-56, -40);
    F.boombox.group.position.set(OX + 34, 41, -14);
    return { dur: 5.5, cam: push(o3(90, 62, 104), o3(80, 60, 90), o3(17, 42, 10), o3(15, 43, 10), { hand: 0.3 }), fov: [31, 26], dof: { focus: [112, 94], aperture: 1.5 }, tick: (dt, lt) => { if (lt > 0.4) g.look(10, 2, 3); if (lt > 1 && lt < 1.5) { g.raise('L', 0.7); F.bass = 1; } else g.raise('L', 0.2); } };
  },
  // 5: whip-pan from the Skater to the escalator camera
  'plan.monitor'(F) {
    office(F); crew(F); F.feedMode = 'escalator';
    F.officeLights({ key: ['#4af0a0', [OX, 76, -16], 170], fill: ['#ffd0a0', [OX + 90, 70, 90], 70] });
    const s = F.heroes.skater; s.root.rotation.y = -0.2;
    for (const c of ['mallGoth', 'mallCop', 'biker']) F.heroes[c].visible = false;
    F.heroes.skater.look(35, 6, 6).raise('L', 0.8);
    return { dur: 7, cam: { hand: 0.25, seq: [
      { to: 0.22, ...push(o3(40, 54, 138), o3(38, 54, 132), o3(60, 44, 22), o3(60, 44, 22)), fov: [36, 35] },
      { to: 0.34, ...whip(o3(34, 62, 100), o3(60, 46, 22), o3(0, 66, -62)), fov: [35, 35] },
      { to: 1, ...push(o3(12, 68, 52), o3(2, 69, 28), o3(0, 66, -62), o3(0, 69, -62)), fov: [39, 34] },
    ] }, dof: { focus: 100, aperture: 0.3 }, bloom: 0.6 };
  },
  // 6: pull back to the four-shot; all of them look at you
  'plan.four'(F) {
    office(F); F.lineup(OX, 20); F.officeLights({ key: ['#d8fff0', [OX - 60, 96, 120], 190], fill: ['#ff9a40', [OX + 100, 60, 90], 100] });
    return { dur: 11, nervous: 1.4, cam: push(o3(0, 74, 218), o3(0, 62, 188), o3(0, 21, 14), o3(0, 21, 14), { hand: 0.2, ease: 'lin' }), fov: [38, 35], dof: { focus: [208, 178], aperture: 0.5 }, tick: (dt, lt) => { F.pl.camera.zoom = 1; if (F.tens > 0.65 && Math.floor(lt * 2) % 2) F.heroes.skater.look(18, 0, 8); else F.heroes.skater.look(0, 3, 8); } };
  },
  // replies: a two-shot of the speaking pair. arg = 'speaker,other'
  'plan.two'(F, arg) {
    office(F);
    const [a, b] = arg.split(',');
    const A = F.place(a, OX - 21, 24, 0.5), B = F.place(b, OX + 21, 24, -0.5);
    F.officeLights({ key: ['#c8ffe8', [OX - 70, 90, 100], 170], fill: ['#ff9a40', [OX + 100, 60, 70], 120] });
    return { dur: 8, cam: push(o3(-14, 56, 150), o3(-4, 53, 126), o3(0, 36, 24), o3(0, 38, 24), { hand: 0.35 }), fov: [34, 31], dof: { focus: [128, 104], aperture: 1.0 }, tick: (dt, lt) => { A.look(-14, 2, 3); B.look(18, 0, 3); if (lt > 0.4 && a !== 'mallCop') A.raise('L', 0.35); } };
  },
  // the silence replies end on the PA speaker: Pam
  'plan.pa'(F) {
    office(F); crew(F); F.paTalk = 20;
    F.officeLights({ rim: ['#ffd23a', [OX - 92, 96, -34], 300] });
    for (const c of SURVIVORS) F.heroes[c].look(-30, 18, 2);
    return { dur: 7, flares: [{ at: [OX - 89, 99, -55], color: '#ffd23a', k: 0.45, len: 0.5 }], cam: push(o3(-52, 70, 62), o3(-78, 84, 12), o3(-98, 86, -60), o3(-98, 93, -60), { hand: 0.12 }), fov: [40, 30], dof: { focus: [128, 70], aperture: 1.4 }, bloom: 0.75 };
  },

  // ----- Scene 1.5, "The Ticket"
  'tk.approach'(F) {
    pizza(F); F.pizzaLights();
    const r = F.place('ray', PX + 6, -34, 0, -34); r.raise('L', 0.2); // (down behind the counter, until he pops up)
    const party = F.order();
    party.forEach((c, i) => { const a = F.place(c, PX + [-50, 58, -92, 100][i], [76, 88, 104, 112][i], Math.PI + [0.22, -0.28, 0.4, -0.45][i]); a.loop(c === 'mallGoth' ? 'Idle' : 'Walking_A', 0.7); a.walk = (dt, lt) => { if (lt < 2.6) a.root.position.z -= dt * 11; else a.loop(c === 'mallGoth' ? 'Idle' : '2H_Melee_Idle', 1); }; });
    return { dur: 6, cam: dolly(p3(-96, 80, 262), p3(-26, 64, 182), p3(0, 44, -20), p3(4, 46, -30), { hand: 0.4 }), fov: [42, 36], dof: { focus: [270, 210], aperture: 0.5 }, tick: (dt, lt) => { r.root.position.y = -34 * (1 - clamp01((lt - 0.6) / 0.15)); r.raise('R', lt < 0.6 ? 0 : 0.35 + 0.3 * Math.max(0, Math.sin(lt * 5))).look(Math.sin(lt * 2) * 14, 0, 5); } };
  },
  'tk.spike'(F) {
    pizza(F);
    F.pizzaLights({ key: ['#ffb060', [PX - 20, 66, 44], 100, (t) => 0.8 + 0.2 * flicker(t, 2, false)], fx: ['#ff8a20', [PX + 20, 50, -40], 260, (t) => 0.75 + 0.25 * flicker(t, 8, true)] });
    F.place('ray', PX - 20, -40, 0);
    const [x, y, z] = TICKET_AT;
    return { dur: 6, flares: [{ at: [PX + 20, 50, -40], color: '#ff9a40', k: 0.3 }], cam: push(p3(x + 17, y + 6, z + 66), p3(x + 3, y + 1.5, z + 47), p3(x - 3, y - 2, z - 6), p3(x, y - 3.5, z), { hand: 0.12 }), fov: [33, 30], dof: { focus: [105, 47], aperture: 2.2, from: 0.12, to: 0.55 }, bloom: 0.45 };
  },
  'tk.two'(F) {
    pizza(F); F.pizzaLights({ key: ['#ffc890', [PX - 40, 84, 120], 180] });
    const s = F.place('skater', PX - 24, 52, 0.75), c = F.place('mallCop', PX + 26, 58, -0.6);
    c.look(30, 0, 3);
    return { dur: 5, cam: push(p3(-10, 58, 178), p3(-4, 55, 156), p3(2, 38, 54), p3(2, 39, 54), { hand: 0.3 }), fov: [33, 30], dof: { focus: [125, 103], aperture: 1.1 }, tick: (dt, lt) => { s.look(-26, 3, 5); if (lt > 0.5) { s.raise('L', 0.75); c.look(40, -6, 5); } } };
  },
  'tk.cop'(F) {
    pizza(F);
    F.pizzaLights({ key: ['#ffa818', [PX - 24, 30, 96], 150, (t) => 0.85 + 0.15 * flicker(t, 12, true)], rim: ['#c8ff40', [PX + 50, 80, 20], 160], fill: ['#4a3000', [PX + 40, 60, 110], 50] });
    const a = F.place('mallCop', PX + 6, 58, 0.12);
    return { dur: 5.5, cam: F.closeUp(a, [54, 13, 46, 44], [40, 8, 47, 46], { hand: 0.15 }), fov: [30, 26], dof: { focus: [55, 41], aperture: 1.8 }, grade: 'SICK_FLUOR', tick: (dt, lt) => { F.eyes = lt > 3 && lt < 3.12 ? 0.25 : 0; a.breathe(0.6, 0.6).tremble(0.2); a.look(lt > 2.2 ? 16 : 40, lt > 2.2 ? -6 : -2, 3); a.raise('L', lt > 0.9 && lt < 2.1 ? 1 : 0.1); } };
  },
  // 5: wide at the fountain. The chime: every head turns at once. Then the boombox, and they turn to it instead.
  'tk.fountain'(F) {
    F.show('concourse'); F.look = 'NIGHT_RAIN'; F.dust.moveTo(0, 0, FZ + 80); F.fog(240, 1200, '#0a0614');
    const amb = { sky: '#3a3a7a', ground: '#0a0814', hemi: 0.55, moon: 0.45, moonColor: '#7088ff' };
    F.light(amb, { key: ['#ff2ea6', [-120, 120, FZ + 110], 300], rim: ['#2ee6ff', [130, 100, FZ - 20], 300], fill: ['#ffb060', [20, 80, FZ + 260], 130] });
    const g = F.place('mallGoth', -30, FZ + 158, 0.15);
    F.place('mallCop', -76, FZ + 188, Math.PI - 0.5); F.place('skater', -104, FZ + 156, Math.PI - 0.75); F.place('biker', 62, FZ + 192, Math.PI + 0.55);
    F.boombox.group.visible = true; F.boombox.group.position.set(-4, 7, FZ + 165); F.boombox.group.rotation.y = -0.15;
    const spots = [[-112, 8], [112, 28], [-70, -58], [76, -40], [132, 104], [-136, 90]];
    const zs = spots.map(([x, z], i) => F.zombie(i, x, FZ + z, -Math.sign(x) * (1.4 + hash(i) * 0.5), 0.35 + hash(i + 4) * 0.2));
    return { dur: 10, cam: crane([6, 90, FZ + 348], [4, 66, FZ + 300], [-4, 40, FZ + 70], [-8, 36, FZ + 110], { hand: 0.2 }), fov: [40, 36], dof: { focus: [230, 150], aperture: 0.45 }, tick: (dt, lt) => {
      // the neon pulses with the three notes of the chime
      const beat = [0.15, 0.57, 0.99].reduce((m, at) => Math.max(m, lt >= at ? Math.exp(-(lt - at) * 5) : 0), 0);
      F.lights.set({ key: ['#ff2ea6', [-120, 120, FZ + 110], 300 + beat * 520], rim: ['#2ee6ff', [130, 100, FZ - 20], 300 + beat * 520] });
      zs.forEach((z) => {
        const p = z.root.position, drop = lt > 2.1;
        const tx = drop ? -4 : 0, tz = drop ? FZ + 165 : FZ - 400;
        const want = Math.atan2(tx - p.x, tz - p.z);
        if (lt > 0.25) z.faceTo(tx, tz, 1 - Math.exp(-dt * (drop ? 4.5 : 9)));
        const rel = Math.atan2(Math.sin(want - z.root.rotation.y), Math.cos(want - z.root.rotation.y)) / D2R;
        z.look(lt > 0.15 ? Math.max(-70, Math.min(70, rel)) : 0, lt > 0.15 && !drop ? 14 : 0, 16);
      });
      if (lt > 2.1 && lt < 2.25) F.bass = 1;
      if (lt > 2.1 && Math.floor(lt * 2.4) !== Math.floor((lt - dt) * 2.4)) F.bass = 0.8;
      if (lt > 2.6) g.look(-12, 3, 3);
    } };
  },

  // ----- Scene 2, "Ray vs the Locker"
  'cr.cave'(F) {
    pizza(F); F.pizzaLights({ key: ['#ff2a1a', [PX - 70, 90, 70], 260, (t) => 0.55 + 0.45 * Math.max(0, Math.sin(t * 8))], rim: ['#ff2a50', [PX + 90, 110, -30], 200], fill: ['#ffb070', [PX + 40, 70, 90], 110] });
    const r = pinned(F); r.tremble(0.6).breathe(1, 1.1);
    return { dur: 6, panic: true, flares: [{ at: [PX - 70, 90, 20], color: '#ff3028', k: (lt) => 0.5 * Math.max(0, Math.sin(lt * 8)), len: 0.8 }], cam: { hand: 1.6, seq: [
      { to: 0.1, ...whip(p3(-70, 74, 130), p3(-230, 60, -60), p3(-4, 44, -36)), fov: [44, 42] },
      { to: 1, ...push(p3(-70, 74, 130), p3(-28, 60, 92), p3(-4, 44, -36), p3(-2, 43, -36), { hand: 1.7, ease: 'out' }), fov: [42, 35] },
    ] }, dof: { focus: [170, 128], aperture: 0.9 }, tick: (dt, lt) => {
      const sag = smooth(lt / 5);
      F.sets.pizza.h.hood.position.y = 66 - sag * 6 + (lt < 0.8 ? (0.8 - lt) * 12 : 0); F.sets.pizza.h.hood.rotation.z = -0.12 - sag * 0.1 + Math.sin(lt * 31) * 0.008;
      struggle(r, lt);
      if (Math.random() < dt * 30) F.sparks.spark(PX + 30 + Math.random() * 14, 72, -30, (Math.random() - 0.3) * 90, Math.random() * 60, 20 + Math.random() * 60, Math.random() < 0.5 ? '#ffb040' : '#fff0c0', 0.55);
    } };
  },
  'cr.locker'(F) {
    pizza(F);
    F.pizzaLights({ key: ['#ffc020', [PX + 120, 110, 40], 320, (t) => (Math.sin(t * 9) > 0 ? 1 : 0.18)], rim: ['#ff2a1a', [PX + 230, 80, -20], 160] });
    pinned(F);
    return { dur: 6, flares: [{ at: [PX + 166, 92, -44], color: '#ffc830', k: (lt) => (Math.sin(lt * 9) > 0 ? 0.55 : 0.05), len: 0.8 }], cam: { hand: 0.35, seq: [
      { to: 0.13, ...whip(p3(86, 70, 120), p3(0, 44, -36), p3(166, 60, -42)), fov: [42, 40] },
      { to: 1, ...push(p3(86, 70, 120), p3(124, 64, 78), p3(166, 60, -42), p3(166, 61, -42)), fov: [40, 34] },
    ] }, dof: { focus: 140, aperture: 0.6 } };
  },
  'cr.biker'(F) {
    pizza(F); down(F); pinned(F);
    F.pizzaLights({ key: ['#ff2020', [PX - 40, 66, 94], 220], rim: ['#ffc020', [PX + 150, 70, 60], 330], fill: ['#2a1a3a', [PX + 60, 90, 130], 50] });
    const b = F.place('biker', PX + 62, 46, 0.35); b.breathe(0.7, 0.55);
    return { dur: 5, cam: F.closeUp(b, [80, 40, 55, 43], [66, 33, 53, 44], { hand: 0.3 }), fov: [33, 30], dof: { focus: [90, 74], aperture: 1.5 }, tick: (dt, lt) => { b.look(lt < 1.5 ? 44 : lt < 3 ? -44 : 14, 2, 7); } };
  },
  'cr.goth'(F) {
    pizza(F); down(F); pinned(F);
    F.pizzaLights({ key: ['#d0b0ff', [PX - 4, 66, 112], 150], rim: ['#6030ff', [PX + 20, 84, 20], 200], fill: ['#1a1a4a', [PX - 20, 40, 130], 60], fx: null });
    const g = F.place('mallGoth', PX - 48, 52, 0.55);   // staring just past the lens, at him
    return { dur: 7, cam: F.closeUp(g, [62, 12, 50, 41], [43, 8, 49, 43], { hand: 0.02, ease: 'lin' }), fov: [30, 26], dof: { focus: [62, 43], aperture: 1.8 }, grade: 'COLD_GRIEF', tick: (dt, lt) => { g.look(18, lt > 3 && lt < 3.7 ? -16 : -2, lt > 3 ? 5 : 1.2); } };
  },
  // 5: crane up to look down on the whole stall as they spill in through the back
  'cr.crane'(F) {
    pizza(F); down(F); const r = pinned(F);
    F.pizzaLights({ key: ['#ff2a1a', [PX - 140, 150, -20], 340, (t) => 0.4 + 0.6 * Math.max(0, Math.sin(t * 6))], fill: ['#ffb070', [PX + 60, 150, 100], 140] });
    F.lineup(PX + 6, 62, Math.PI);
    walkIns(F, 6);
    F.fog(420, 1200);
    // and one that does not walk: a sprinter bursts out of the back at the camera
    const runner = F.zombies[2], shamble = runner.walk;
    let running = false;
    runner.walk = (dt, lt) => {
      if (lt < 2.6) { shamble(dt, lt); return; }
      if (!running) { running = true; runner.root.visible = true; runner.loop('Running_C', 1.6); }
      const k = clamp01((lt - 2.6) / 0.8);
      runner.root.position.set(mix(PX - 150, PX - 40, k), 0, mix(-70, 150, k));
      runner.root.rotation.y = Math.atan2(110, 220);
    };
    return { dur: 5, cam: crane(p3(-40, 100, 220), p3(-24, 244, 150), p3(-40, 34, -40), p3(-30, 8, -2), { hand: 0.4 }), fov: [44, 52], tick: (dt, lt) => struggle(r, lt) };
  },
  'cr.four'(F) {
    pizza(F); down(F); const r = pinned(F);
    F.pizzaLights({ key: ['#ffc8a0', [PX - 80, 110, 210], 210], rim: ['#ff2a1a', [PX - 130, 100, 0], 260, (t) => 0.5 + 0.5 * Math.max(0, Math.sin(t * (3 + F.tens * 4)))], fill: ['#ffc020', [PX + 140, 90, 80], 120, (t) => (Math.sin(t * 5) > 0 ? 1 : 0.25)] });
    F.lineup(PX, 96);
    walkIns(F, 3, 0.35);
    return { dur: 12, nervous: 2.2, cam: push(p3(0, 82, 296), p3(0, 70, 262), p3(0, 21, 86), p3(0, 21, 86), { hand: 0.2, ease: 'lin' }), fov: [38, 35], dof: { focus: [206, 172], aperture: 0.7 }, tick: (dt, lt) => struggle(r, lt) };
  },
  // reply, save: the Biker takes the weight, low hero angle; Ray gets out
  'cr.lift'(F) {
    pizza(F); down(F); const r = pinned(F);
    F.pizzaLights({ key: ['#ffb060', [PX - 90, 40, 70], 280], rim: ['#ff2a50', [PX + 80, 120, -60], 300] });
    const b = F.place('biker', PX + 40, -30, -1.25); b.raise('R', 0.9).raise('L', 0.9);
    r.root.position.x = PX - 12;
    F.sets.pizza.h.ticket.visible = false;
    return { dur: 8, cam: push(p3(-66, 40, 100), p3(-40, 36, 84), p3(8, 55, -36), p3(6, 57, -36), { hand: 0.4 }), fov: [42, 37], dof: { focus: [160, 135], aperture: 0.7 }, grade: 'HERO_GRIT', tick: (dt, lt) => {
      const up = smooth(lt / 1.8);
      const h = F.sets.pizza.h.hood; h.position.y = 60 + up * 28; h.rotation.z = -0.22 + up * 0.16 + (lt < 1.8 ? Math.sin(lt * 40) * 0.01 : 0);
      b.lean(0.35 - up * 0.45).look(10, up * 10, 4);
      const free = smooth((lt - 1.6) / 1.4);
      r.root.position.set(PX - 12 - free * 18, -12 + free * 12, -36 + free * 8); r.root.rotation.z = 0.22 * (1 - free);
      if (free > 0.8) r.raise('L', 1).raise('R', 0.8); else struggle(r, lt);
    } };
  },
  // reply, loot: close on the locker swinging open; Ray is only a voice
  'cr.open'(F) {
    pizza(F); down(F);
    F.pizzaLights({ key: ['#ffd890', [PX + 130, 80, 40], 150], rim: ['#ff2a1a', [PX + 240, 80, -10], 240, (t) => 0.5 + 0.5 * Math.sin(t * 7)], fill: ['#4a6aff', [PX + 90, 40, 80], 60] });
    const c = F.place('mallCop', PX + 118, -6, 2.0);
    return { dur: 9, cam: push(p3(82, 74, 98), p3(116, 66, 62), p3(166, 54, -44), p3(168, 55, -48), { hand: 0.35 }), fov: [42, 34], dof: { focus: [150, 115], aperture: 0.9 }, bloom: 0.75, tick: (dt, lt) => {
      const k = smooth(lt / 1.4);
      F.sets.pizza.h.lockerDoor.rotation.y = -k * 1.75; F.sets.pizza.h.lockerGlow.material.opacity = k * 0.45;
      c.raise('L', 0.7 * k).look(lt > 3 ? 42 : 0, lt > 3 ? -10 : 0, 3);
      F.lights.set({ fx: ['#ffe090', [PX + 166, 60, -30], 220 * k] });
    } };
  },
  // reply, hold: the Skater braced against the shutter, arms up, camera shaking
  'cr.brace'(F) {
    pizza(F); down(F); pinned(F);
    F.pizzaLights({ key: ['#ffd8b0', [PX - 30, 80, 80], 200], rim: ['#ff2a1a', [PX + 80, 90, -10], 300] });
    F.sets.pizza.h.setShutter(0.35);
    const s = F.place('skater', PX + 58, 30, -1.0); s.raise('R', 0.9).raise('L', 0.9).tremble(0.5).breathe(1, 1.1);   // in profile, so the braced arms read
    return { dur: 6, panic: true, cam: push(p3(84, 46, 138), p3(74, 44, 118), p3(50, 42, 24), p3(50, 43, 24), { hand: 3.2 }), fov: [38, 34], dof: { focus: [112, 92], aperture: 1.2 }, tick: (dt, lt) => {
      s.root.position.y = Math.sin(lt * 33) * 0.5 - smooth(lt / 5) * 4; s.look(46 + Math.sin(lt * 6) * 14, 6, 8);
      F.sets.pizza.h.setShutter(0.35 + smooth(lt / 5) * 0.4 + Math.sin(lt * 21) * 0.02);
      if (Math.random() < dt * 22) { const w = s.boneWorld('Head'); F.sparks.spark(w.x + (Math.random() - 0.5) * 8, w.y + 3, w.z + 4, (Math.random() - 0.5) * 30, 20, 14, '#cfe8ff', 0.4, 0.8); }
    } };
  },
  'cr.rayout'(F) {
    pizza(F); down(F);
    F.pizzaLights({ key: ['#ffb060', [PX - 90, 60, 60], 210] });
    F.sets.pizza.h.hood.position.y = 48; F.sets.pizza.h.hood.rotation.z = -0.26;
    const r = F.place('ray', PX - 52, 30, 0.35, -9); r.root.rotation.z = 0.2; r.lean(0.45);
    return { dur: 6, cam: F.closeUp(r, [82, -16, 54, 39], [66, -10, 51, 39], { hand: 0.4 }), fov: [36, 32], dof: { focus: [82, 66], aperture: 1.3 }, tick: (dt, lt) => { r.look(Math.sin(lt * 1.7) * 8, -4 + Math.sin(lt * 3) * 4, 3).raise('R', 0.25); } };
  },
  // reply, silence: the empty counter. Nobody there.
  'cr.empty'(F) {
    pizza(F); down(F);
    F.pizzaLights({ key: ['#8a9ac0', [PX - 40, 90, 70], 100], rim: ['#ff2a1a', [PX - 170, 90, -80], 220], fill: null, fx: ['#ff8a20', [PX + 26, 34, -62], 90] });
    F.sets.pizza.h.hood.position.y = 34; F.sets.pizza.h.hood.rotation.z = -0.3;
    return { dur: 10, cam: push(p3(-6, 70, 168), p3(-16, 62, 128), p3(-12, 36, -26), p3(-14, 36, -30), { hand: 0.1, ease: 'lin' }), fov: [38, 33], dof: { focus: [196, 158], aperture: 0.6 }, grade: 'BLEACH_SHOCK' };
  },

  // ----- Scene 3, the Butcher
  // the title card: a low crane up out of the steam, heat-lamp orange
  'bk.reveal'(F) {
    kitchen(F); const B = F.stageButcher(0, -10); F.sets.kitchen.h.block.visible = false;
    F.kitchenLights(1, { key: ['#ff7a18', [KX - 70, 14, 78], 300, (t) => 0.85 + 0.15 * Math.sin(t * 13)] });
    return { dur: 6.4, flares: [-50, 150].map((x) => ({ at: [KX + x, 56, -112], color: '#ff8a28', k: (lt) => 0.25 + (lt > 2.7 ? 0.5 * Math.exp(-(lt - 2.7) * 2) : 0), len: 0.8 })), cam: crane(k3(-104, 9, 236), k3(26, 36, 300), k3(0, 52, -10), k3(0, 76, -10), { hand: 0.3, ease: 'smoother' }), fov: [48, 42], exposure: 1.0, bloom: 0.75,
      tick: (dt, lt) => {
        const rise = smooth((lt - 1.4) / 1.7);
        F.butcherPose(lt, { raise: rise * 0.55, headPitch: 0.4 * (1 - rise), jaw: lt > 2.7 ? 0.45 : 0.06, glow: 0.25 + rise * 0.75 });
        B.root.position.y = 0;
        F.lights.set({ key: ['#ff7a18', [KX - 70, 14, 78], 150 + smooth(lt / 3) * 220 + (lt > 2.7 ? 300 * Math.exp(-(lt - 2.7) * 3) : 0)] });
        if (Math.random() < dt * 26) F.sparks.spark(KX + (Math.random() - 0.5) * 150, 8, 30 + Math.random() * 40, (Math.random() - 0.5) * 26, 70 + Math.random() * 90, (Math.random() - 0.5) * 20, '#ff9a30', 1.1);
      } };
  },
  // 1: dolly down the prep line from the freezer; the Biker passes the PERMA-FRY drums and goes quiet
  'bk.drums'(F) {
    kitchen(F); F.fog(200, 820);
    F.kitchenLights(1, { key: ['#ffb060', [KX - 150, 96, 40], 260, () => scriptedFail(F.lt, [[3.3, 0.5]])], rim: ['#9ad8ff', [KX - 290, 80, 10], 240], fill: ['#ff8a28', [KX - 190, 36, 60], 110] });
    const b = F.place('biker', KX - 272, 2, 1.45); b.loop('Walking_A', 0.75); b.breathe(0.5);
    let stopped = false;
    b.walk = (dt, lt) => { if (lt < 3.2) b.root.position.x += dt * 22; else { if (!stopped) { stopped = true; b.loop('2H_Melee_Idle', 1); } b.faceTo(KX - 205, -92, 1 - Math.exp(-dt * 2.4)); } };
    return { dur: 7, cam: dolly(k3(-262, 76, 142), k3(-150, 56, 92), k3(-256, 44, -50), k3(-208, 40, -62), { hand: 0.3 }), fov: [42, 38], dof: { focus: [170, 148], aperture: 0.6 }, tick: (dt, lt) => { if (lt > 3.4) b.look(8, -8, 2); } };
  },
  // 2: over the party's shoulders to the Butcher's back, chopping
  'bk.ots'(F) {
    kitchen(F); const B = F.stageButcher(10, -30, Math.PI); B.root.position.x = KX + 10;
    F.sets.kitchen.h.block.position.set(14, 0, -78);
    F.kitchenLights(1, { rim: ['#40ff90', [KX + 90, 130, -90], 360] });
    const [a, b] = F.order();
    F.place(a, KX - 40, 140, Math.PI + 0.12); F.place(b, KX + 74, 156, Math.PI - 0.2);
    return { dur: 5, cam: push(k3(6, 74, 276), k3(10, 73, 248), k3(8, 70, -30), k3(10, 70, -30), { hand: 0.35 }), fov: [40, 37], dof: { focus: [265, 238], aperture: 0.9 }, tick: (dt, lt) => {
      const c = (lt % 1.15) / 1.15, raise = c < 0.78 ? smooth(c / 0.78) * 0.75 : 0.75 * (1 - clamp01((c - 0.78) / 0.07));
      F.butcherPose(lt, { raise, headPitch: 0.15 });
      if (c >= 0.84 && c - dt / 1.15 < 0.84) { F.hit(4, 0); for (let i = 0; i < 14; i++) F.sparks.spark(KX + 40, 50, -72, (Math.random() - 0.5) * 120, 40 + Math.random() * 90, Math.random() * 60, '#ffb060', 0.45); }
    } };
  },
  // 3: he turns; crane down into the cracked pig head
  'bk.turn'(F) {
    kitchen(F); const B = F.stageButcher(0, -20, Math.PI);
    F.kitchenLights(1, { key: ['#ff7a18', [KX - 76, 74, 76], 240], fill: ['#ffb060', [KX + 60, 130, 80], 90] });
    const k = BOSS_SCALE * 1.12, headY = 104 * k;
    return { dur: 8, cam: crane(k3(36, headY + 64, 196), k3(10, headY - 9, 96), k3(0, headY - 6, -10), k3(0, headY - 1, -12), { hand: 0.15, ease: 'out' }), fov: [40, 36], dof: { focus: [214, 90], aperture: 1.1 }, bloom: 0.8, tick: (dt, lt) => {
      const turn = smooth((lt - 0.25) / 1.7);
      B.root.rotation.y = Math.PI * (1 - turn);
      F.butcherPose(lt, { raise: -0.45, headYaw: (1 - turn) * -0.4, jaw: lt > 2.35 && lt < 4.4 ? 0.34 + Math.sin(lt * 17) * 0.2 : 0.05, glow: 0.6 + turn * 0.7 });
      if (Math.random() < dt * 9) F.sparks.spark(KX + (Math.random() - 0.5) * 70, 80, 14, (Math.random() - 0.5) * 8, 34, 4, '#8a6a50', 1.4, 0.7);
    } };
  },
  // 4: the Mall Cop, sweating; then the camera shoves past him to the Butcher, who points the cleaver
  'bk.cop'(F) {
    kitchen(F); const B = F.stageButcher(10, -34, -0.14);
    F.kitchenLights(1, { fill: ['#ff9a30', [KX - 70, 60, 190], 190] });
    const c = F.place('mallCop', KX - 40, 128, -0.3); c.look(0, 3, 3); c.tremble(0.35).breathe(0.9, 0.8);
    const from = F.face(c, 56, 12, 47, 47);
    return { dur: 7, cam: { hand: 0.25, seq: [
      { to: 0.34, ...push(from.p, F.face(c, 48, 9, 47, 48).p, from.l, from.l), fov: [31, 29] },
      { to: 0.5, ...dolly(F.face(c, 48, 9, 47, 48).p, k3(8, 72, 128), from.l, k3(8, 96, -34), { ease: 'whip', blur: 0.8 }), fov: [30, 40] },
      { to: 1, ...push(k3(8, 72, 128), k3(8, 70, 108), k3(8, 96, -34), k3(8, 100, -34)), fov: [44, 41] },
    ] }, dof: { focus: [52, 150], aperture: 0.9, from: 0.3, to: 0.52 }, tick: (dt, lt) => {
      F.butcherPose(lt, { raise: smooth((lt - 1.6) / 1.2) * 0.78, headPitch: 0.12, jaw: lt > 2.6 && lt < 4.2 ? 0.3 : 0.05 });
      if (Math.random() < dt * 5) { const w = c.boneWorld('Head'); F.sparks.spark(w.x + (Math.random() > 0.5 ? 3 : -3), w.y + 3, w.z + 3, 0, -6, 1, '#cfe8ff', 0.5, 0.7); }
    } };
  },
  // 5: the variant, by what happened to Ray. arg = 'tone,first,second'
  'bk.var'(F, arg) {
    kitchen(F);
    const [tone, a, b] = arg.split(',');
    F.stageButcher(36, -92, -0.2);
    const A = F.place(a, KX - 24, 126, 0.42), B = F.place(b, KX + 22, 126, -0.42);
    let cam = push(k3(0, 56, 252), k3(0, 52, 224), k3(0, 40, 126), k3(0, 41, 126), { hand: 0.25 });
    let fov = [33, 30], grade = null, dof = { focus: [126, 100], aperture: 1.3 };
    let tick = () => { F.butcherPose(F.lt, { raise: 0.2 }); A.look(tone === 'guilt' ? 12 : -12, 0, 3); B.look(12, 0, 3); };
    if (tone === 'hopeful') {
      grade = 'HERO_GRIT';
      F.kitchenLights(1, { key: ['#ffc878', [KX - 80, 90, 210], 220], fill: ['#ff9a40', [KX + 90, 60, 190], 110] });
      const r = F.place('ray', KX + 92, 46, -0.35); r.raise('L', 0.8);
    } else if (tone === 'guilt') {
      grade = 'COLD_GRIEF';
      F.kitchenLights(0.55, { key: ['#6a9aff', [KX - 70, 80, 206], 200], fill: ['#2a4aaa', [KX + 90, 60, 180], 90] });
      A.root.position.x = KX - 14; B.root.position.set(KX + 40, 0, 104);
      A.root.rotation.y = 0.3;
      cam = F.closeUp(A, [100, 22, 52, 41], [64, 13, 50, 43], { hand: 0.12 });
      dof = { focus: [102, 65], aperture: 1.6 };
    } else if (tone === 'strained') {
      grade = 'PIZZA_EMBER';
      F.kitchenLights(0.8, { key: ['#ffb890', [KX - 70, 80, 206], 190], fill: ['#ff1a10', [KX + 80, 90, 180], 330, (t) => Math.max(0.05, Math.sin(t * 11))] });
      cam = push(k3(-10, 54, 242), k3(8, 50, 220), k3(0, 40, 126), k3(2, 41, 126), { hand: 2.8 });
      const r = F.place('ray', KX + 106, 50, -0.4, -10); r.root.rotation.z = 0.2; r.lean(0.4);
    } else {
      grade = 'BLEACH_SHOCK';
      F.kitchenLights(0.5, { key: ['#e8eef8', [KX - 80, 100, 200], 170], fill: null });
      cam = push(k3(0, 96, 396), k3(0, 82, 350), k3(0, 46, 90), k3(0, 46, 90), { hand: 0.1, ease: 'lin' });
      fov = [31, 29]; dof = { focus: [270, 225], aperture: 0.5 };
      F.fog(170, 620, '#1a1410');
    }
    return { dur: 8, cam, fov, dof, grade, panic: tone === 'strained', tick: (dt, lt) => tick(dt, lt) };
  },
  // 6: the cleaver and the fry basket go up, the fryers flare white
  'bk.roar'(F) {
    kitchen(F); F.stageButcher(0, -10); F.sets.kitchen.h.block.visible = false;
    F.kitchenLights(1);
    const marks = [[-122, 150, 0.7], [118, 160, -0.65], [-168, 80, 1.1], [164, 90, -1.1]];
    const party = F.order().map((c, i) => F.place(c, KX + marks[i][0], marks[i][1], Math.PI - marks[i][2]));
    return { dur: 7, cam: push(k3(30, 11, 250), k3(8, 18, 204), k3(0, 88, -10), k3(0, 94, -10), { hand: 0.7, ease: 'out' }), fov: [51, 46], bloom: 0.85, tick: (dt, lt) => {
      const up = smooth(lt / 0.55);
      F.butcherPose(lt, { raise: up, basket: up * 0.85, headPitch: -0.22 * up, jaw: 0.5 + Math.sin(lt * 24) * 0.15 * (lt < 2 ? 1 : 0.2), glow: 1.35 });
      const flare = lt < 1.6 ? Math.exp(-lt * 1.8) : 0;
      F.lights.set({ fx: [flare > 0.2 ? '#fff0d8' : '#ff5a10', [KX, 70, -112], 330 + flare * 900] });
      if (Math.random() < dt * 60) F.sparks.spark(KX + (Math.random() - 0.5) * 320, 46, -118, (Math.random() - 0.5) * 80, 90 + Math.random() * 150, 40 + Math.random() * 70, Math.random() < 0.5 ? '#ffd060' : '#ff8a20', 0.8);
      party.forEach((a, i) => { if (lt < 1.1) { a.root.position.x += (i % 2 ? 1 : -1) * dt * 20; a.lean(0.25); } });
    } };
  },

  // ----- the Wing 1 ending, "4:59"
  // 1: slow crane down over the Butcher on his knees, head split, the fryers dying one by one
  'en.kneel'(F) {
    kitchen(F); const B = F.stageButcher(0, -10, 0.12); F.sets.kitchen.h.block.visible = false;
    F.kitchenLights(1);
    B.cleaver.forEach((c) => { c.visible = false; });
    return { dur: 9, cam: crane(k3(-36, 252, 268), k3(-86, 54, 206), k3(0, 60, -10), k3(-4, 50, -10), { hand: 0.2, ease: 'smoother' }), fov: [42, 38], dof: { focus: [330, 215], aperture: 0.7 }, tick: (dt, lt) => {
      const sag = smooth(lt / 3.2);
      const k = B.scale;
      B.root.position.y = -sag * 33 * k;
      B.legs.forEach((l, i) => { l.rotation.x = sag * (1.45 + i * 0.07); });
      B.rig.rig.rotation.x = sag * 0.1;
      F.butcherPose(lt, { raise: -0.1 * sag, basket: -0.05, headPitch: sag * 0.48, headYaw: sag * 0.16, jaw: lt > 3 && lt < 5.4 ? 0.2 + Math.sin(lt * 9) * 0.08 : 0.28, glow: Math.max(0.12, 1.3 - lt * 0.16) * (flicker(lt, 3, lt > 2) * 0.5 + 0.5) });
      // the cleaver slips out of his hand
      const fall = clamp01((lt - 0.7) / 0.62);
      B.drop.visible = true;
      B.drop.position.set(KX + 62 + fall * 18, mix(62, 5, fall * fall), 40 + fall * 26);
      B.drop.rotation.set(-fall * Math.PI / 2, 0.3, fall * 1.7);
      const power = 1 - smooth((lt - 0.8) / 5.6);
      F.sets.kitchen.h.power = Math.min(0.999, power);
      F.lights.set({ key: ['#ff7a18', [KX - 90, 40, 80], 100 + 230 * power], fx: ['#ff5a10', [KX, 56, -112], 330 * power], fill: ['#ff9a40', [KX + 20, 150, 60], 40 + 110 * power] });
    } };
  },
  // 2: the dark, except the GREASE MAIN gauge, and its needle still climbing
  'en.gauge'(F) {
    kitchen(F); F.sets.kitchen.h.power = 0.01;
    F.light({ sky: '#102a18', ground: '#020402', hemi: 0.16, moon: 0, moonColor: '#102010' }, { key: ['#30ff80', [KX + GAUGE_AT[0] - 16, GAUGE_AT[1] + 10, GAUGE_AT[2] + 46], 130], rim: ['#1a8a4a', [KX + GAUGE_AT[0] + 70, GAUGE_AT[1] + 40, GAUGE_AT[2] + 30], 90] });
    F.fog(120, 520, '#010503'); F.look = 'SICK_FLUOR';
    const [x, y, z] = GAUGE_AT;
    return { dur: 8, flares: [{ at: [KX + x, y, z], color: '#40ff90', k: 0.35, len: 0.6 }], cam: push(k3(x - 52, y + 14, z + 140), k3(x - 8, y + 3, z + 76), k3(x - 2, y - 7, z), k3(x, y - 9, z), { hand: 0.08 }), fov: [36, 33], dof: { focus: [150, 76], aperture: 1.3 }, bloom: 0.7, tick: (dt, lt) => {
      F.sets.kitchen.h.power = 0.01;
      F.sets.kitchen.h.drawGauge(Math.round((0.52 + smooth(lt / 6.5) * 0.4 + Math.sin(lt * 19) * 0.008) * 90) / 90);   // (a notched needle: fewer redraws)
      F.sets.kitchen.h.gaugeGlow.material.opacity = 0.14 + 0.06 * Math.sin(lt * 4);
      if (Math.random() < dt * 4) F.sparks.spark(KX + x + (Math.random() - 0.5) * 40, 4, z + 20, 0, 40, 0, '#40ff90', 0.9, 0.8);
    } };
  },
  // 3: back in the security office, battered; the printer is going
  'en.office'(F) {
    office(F); F.officeLights({ key: ['#b0ffe0', [OX - 40, 100, 130], 200], fill: ['#8aa8ff', [OX + 118, 80, 60], 210] });
    F.sheet.visible = true; F.feedK = 0.55;
    const walk = [['biker', -60, 66, -6, 0.2], ['mallCop', -8, 98, -4, 0.1], ['mallGoth', -92, 122, -6, 0.45], ['skater', 26, 70, 10, 1.05]];
    for (const [c, x, z, vx, yaw] of walk) { const a = F.place(c, OX + x, z, Math.PI - 0.5); a.loop('Walking_A', 0.65); let done = false; a.walk = (dt, lt) => { if (lt < 1.8) { a.root.position.z -= dt * 16; a.root.position.x += dt * vx * 0.5; } else { if (!done) { done = true; a.loop(c === 'mallGoth' ? 'Idle' : '2H_Melee_Idle', 1); } a.root.rotation.y += (Math.PI - yaw * 1.6 - a.root.rotation.y) * Math.min(1, dt * 3); } }; a.look(0, -8, 2); }
    return { dur: 8, cam: dolly(o3(112, 78, 192), o3(78, 70, 150), o3(-4, 46, 0), o3(12, 46, -10), { hand: 0.2 }), fov: [42, 37], dof: { focus: [220, 180], aperture: 0.4 }, tick: (dt, lt) => { F.printRows(0.15 + 0.35 * clamp01(lt / 4)); F.sheet.scale.y = 0.45 + 0.35 * clamp01(lt / 4); F.sheet.position.y = 45 + 37 * F.sheet.scale.y / 2; if (lt > 1.9) F.heroes.skater.look(-20, -4, 3).raise('L', 0.6); } };
  },
  // 4: close on the printout, tracking down the paper
  'en.print'(F) {
    office(F); F.officeLights({ key: ['#7affb0', [OX + 30, 80, 30], 70], rim: ['#4af0a0', [OX + 90, 90, -30], 110], fill: null });
    F.sheet.visible = true; F.sheet.scale.y = 1; F.sheet.position.y = 64; F.printRows(1);
    return { dur: 6, cam: dolly(o3(60, 77, 33), o3(58, 59.5, 30), o3(58, 75, -17), o3(58, 57, -16), { hand: 0.06, ease: 'smooth' }), fov: [32, 32], bloom: 0.25, exposure: 0.92 };
  },
  // 5: the monitor: the static clears, and then the footage turns fryer orange
  'en.feed'(F) {
    office(F); F.officeLights({ key: ['#4af0a0', [OX, 76, -20], 170], fill: null, fx: null });
    F.feedMode = 'reveal'; F.feedK = 0;
    return { dur: 8, cam: push(o3(-14, 74, 58), o3(0, 70, 9), o3(0, 69, -62), o3(0, 69.5, -62), { hand: 0.12 }), fov: [38, 34], bloom: 0.6, tick: (dt, lt) => {
      F.feedK = smooth((lt - 0.8) / 3.2);
      const o = F.feedK * F.feedK;
      F.lights.set({ key: [o > 0.4 ? '#ff8a20' : '#4af0a0', [OX, 76, -20], 170 + o * 120] });
    } };
  },
  // 6: reverse: a slow orbit round the four, faces lit from the monitors. Ray if he made it.
  'en.orbit'(F) {
    office(F); F.feedMode = 'reveal'; F.feedK = 1;
    F.look = 'COLD_GRIEF';
    F.light({ sky: '#2a3a6a', ground: '#06080e', hemi: 0.5, moon: 0, moonColor: '#101830' }, { key: ['#8ab8ff', [OX, 84, -26], 230], rim: ['#ff8a30', [OX + 112, 70, 90], 190], fill: ['#4a6ad0', [OX - 100, 80, 130], 140] });
    const mid = [OX, 0, 52];
    const cop = F.place('mallCop', OX, 38, 0);
    const goth = F.place('mallGoth', OX - 40, 58, 1.25), biker = F.place('biker', OX + 46, 66, -1.45);
    F.place('skater', OX + 8, 94, Math.PI + 0.15);
    if (F.ray === 'saved') F.place('ray', OX - 50, 98, 2.35);
    if (F.ray === 'injured') { const r = F.place('ray', OX - 56, 96, 2.35, -10); r.root.rotation.z = 0.2; r.lean(0.4); }
    cop.look(0, -12, 2).lean(0.14);
    return { dur: 13, cam: orbit(mid, [128, 116], [-0.7, 0.95], [78, 62], [mid[0], 34, mid[2]], { ease: 'lin', hand: 0.15 }), fov: [42, 40], dof: { focus: 122, aperture: 0.7 }, tick: (dt, lt) => {
      if (lt > 2.5) goth.raise('R', 0).look(-6, -4, 1.4);
      if (lt > 3.6) { const k = smooth((lt - 3.6) / 2.2); biker.root.position.x = OX + 46 - k * 17; biker.root.position.z = 66 - k * 14; biker.raise('L', k * 0.5).look(0, 0, 3); }
    } };
  },
  // 7: over the Cop's shoulder to the monitors. In the reflection, the Grim Shopper. Then it isn't.
  'en.reflect'(F) {
    office(F); F.feedK = 0.18; F.feedMode = 'door';
    // the quiet scare: the reflection is empty; a tube drops out; when it restrikes the Shopper is simply there
    const DROPS = [[1.55, 0.2], [6.0, 0.35]];
    const tube = () => scriptedFail(F.lt, DROPS);
    F.officeLights({ key: ['#4af0a0', [OX - 4, 82, -18], 150, tube], rim: ['#eef6ff', [OX + 44, 96, -34], 210, tube], fill: ['#2a5a4a', [OX - 90, 60, 90], 60] });
    const cop = F.place('mallCop', OX - 22, 46, Math.PI + 0.2);
    const s = F.shopper; s.root.position.set(OX + 16, 30, -52); s.root.rotation.y = 0.05; s.root.scale.setScalar(0.86); s.visible = false;
    F.receipt.visible = false;
    return { dur: 8, cam: push(o3(-46, 62, 138), o3(-36, 61, 118), o3(0, 50, -56), o3(5, 53, -56), { hand: 0.05 }), fov: [39, 34], dof: { focus: [190, 170], aperture: 0.6 }, tick: (dt, lt) => {
      const there = lt >= 1.65 && lt < 6.1;
      s.visible = there; F.receipt.visible = there;
      F.receipt.position.set(OX + 25, 48, -46);
      F.receipt.children[0].material.map.offset.y = lt * 0.3;
      s.raise('R', smooth((lt - 1.9) / 1.4) * 0.85).look(-8, -5, 2);
      if (lt >= 6.35) cop.look(14, 0, 8);
    } };
  },
  // 8: extreme close-up: his hand finds the keycard, and one orange flare lights his eyes
  'en.hand'(F) {
    office(F);
    F.light({ sky: '#101828', ground: '#030406', hemi: 0.22, moon: 0, moonColor: '#101020' }, { key: ['#5a8ac8', [OX - 50, 70, 80], 80], rim: ['#4af0a0', [OX + 40, 74, -20], 130], fill: ['#b8d0ff', [OX + 34, 36, 90], 55], fx: ['#ff8a18', [OX + 8, 30, 70], 0] });
    F.look = 'COLD_GRIEF';
    const a = F.place('mallCop', OX - 4, 34, 0.06); a.look(0, -8, 2); a.breathe(0.5);
    F.sheet.visible = false;
    a.update(0.6);
    const head = a.boneWorld('Head'), hand = a.boneWorld('WristL');
    const on = (v, dist, side, up) => [v.x + dist * Math.sin(0.06) + side, v.y + up, v.z + dist];
    return { dur: 12, flares: eyeFlares(F), cam: { hand: 0.08, seq: [
      { to: 0.24, ...push(on(hand, 66, -30, 12), on(hand, 50, -21, 8), [hand.x + 1, hand.y + 4, hand.z], [hand.x, hand.y + 1, hand.z]), fov: [31, 27] },
      { to: 1, ...push(on(head, 56, 4, 1), on(head, 31, 1.5, 1), [head.x, head.y - 0.5, head.z], [head.x, head.y + 1.6, head.z], { ease: 'out' }), fov: [28, 23] },
    ] }, dof: { focus: [52, 30], aperture: 1.2 }, bloom: 0.8, tick: (dt, lt) => {
      const k = smooth(lt / 2.4);
      a.raise('L', 0.12 + k * 0.28);
      const w = a.boneWorld('WristL');
      F.keycard.visible = lt < 2.9;
      F.keycard.position.set(w.x + 0.6 + (1 - k) * 4, w.y - 2.6, w.z + 1.8); F.keycard.scale.setScalar(0.72); F.keycard.rotation.set(0.1, 0.25, -0.2 + (1 - k) * 0.5);
      const glow = smooth((lt - 3.3) / 2.2);
      F.eyes = glow;
      F.copEyes.forEach((s) => s.material.color.set('#ffb818'));
      F.lights.set({ fx: ['#ff8a18', [OX + 6, 44, 66], glow * 150] });
    } };
  },
  'en.black'() { return { black: true, dur: 8, cam: dolly([0, 60, 200], [0, 60, 200], [0, 40, 0]), fov: [40, 40] }; },
};

// ---------- bits of staging the crisis shots share ----------
// Ray stuck behind the counter with the hood on top of him.
function pinned(F) {
  const h = F.sets.pizza.h;
  h.hood.position.set(-32, 60, -40); h.hood.rotation.z = -0.22; h.debris.visible = true;
  h.counterMid.rotation.z = 0.12;
  const r = F.place('ray', PX - 4, -36, 0.08, -12); r.root.rotation.z = 0.22; r.lean(0.25);
  return r;
}
// the aftermath: rubble on the floor
function down(F) { const h = F.sets.pizza.h; h.debris.visible = true; h.counterMid.rotation.z = 0.12; h.hood.position.y = 60; h.hood.rotation.z = -0.22; }
function struggle(r, lt) { r.raise('R', 0.55 + 0.45 * Math.max(0, Math.sin(lt * 7))).raise('L', 0.4 + 0.3 * Math.max(0, Math.sin(lt * 5.2 + 2))); r.look(Math.sin(lt * 3.4) * 26, 8, 6); }
// walkers shouldering in through the back door
function walkIns(F, n, speed = 1) {
  for (let i = 0; i < n; i++) {
    const z = F.zombie(i, PX - 176 + (i % 3) * 12 - 12, -96 - i * 4, 0.9, 0.8);
    const tx = PX - 190 + (i % 3) * 62, tz = -34 + Math.floor(i / 3) * 62 + (i % 2) * 14;
    z.walk = (dt, lt) => {
      const k = clamp01((lt * speed - i * 0.35) / 3);
      z.root.visible = lt * speed > i * 0.35;
      z.root.position.set(mix(PX - 176, tx, k), 0, mix(-96, tz, k));
      z.root.rotation.y = Math.atan2(tx - (PX - 176), tz + 96) * (1 - k) + 0.9 * k;
    };
  }
}

export const STORY_SHOTS = Object.keys(SHOTS);
