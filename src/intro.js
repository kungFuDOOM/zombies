// The opening film, "Doorbuster" (STORY.md 9a): ~78 s, in engine, before the title screen. Skippable by any input.
// It is preceded by the studio card (film time -4.5 .. 0, over black).
//
//   1  crane down a PA speaker to the dark atrium          7  Biker: low orbit, chainsaw rev
//   2  slow dolly down the corridor to the glass doors     8  Mall Cop: three-quarter push-in, shotgun rack
//   3  keypad LED: red -> green, rack focus to the horde   9  Skater: tracking low mid-dash
//   4  whip-pan, the doors burst inward                    10 Mall Goth: push-in, hairspray torch
//   5  the security monitor: a figure at the door panel    11 pull back from the four, crane to the skylight, title slam
//   6  crane up the dead escalator, a spitter on the top step
//
// It is built on the cinema toolkit in src/cine*.js (cineCore, cinePost, cineFx, cineStage, cineSets, cineOverlay) (timeline + camera moves, lighting rigs and light shafts, the post chain
// with bloom / depth of field / grain / grade, character staging, sets, overlay). This file only says WHAT happens: the
// shot list, the lights per shot, the actors' actions and the audio cues. The later story scenes use the same toolkit.
//
// main.js drives it: start({ gate }), update(dt), render(), view() for the hud overlay, press()/skip().
// Sound is cineAudio.js (Web Audio only); Pam's PA voice is the browser speech voice pushed low and slow, with a subtitle.

import * as THREE from 'three';
import { cine, paSpeak } from './audio.js';
import { CinePlayer, dolly, crane, push, whip, orbit, clamp01, smooth, ease } from './cineCore.js';
import { LightRig, makeShaft, DustField, SparkPool, flicker, failing, scriptedFail, disposeTree } from './cineFx.js';
import { makeHero, makeZombie } from './cineStage.js';
import { buildConcourse, buildOffice, buildBay, DOOR_Z, FOUNTAIN, ESCALATOR, OFFICE_X, BAY_X, BAY_Z } from './cineSets.js';
import { warmSplat } from './cineLens.js';
import { glowSprite } from './models.js';

export const INTRO_END = 78;
export const PREROLL = 4.5; // the studio card
// the escalator's tube drops out (film seconds); the dead at its foot only move while it is dark
const ESC_DROPS = [[31.2, 0.3], [32.6, 0.35], [33.9, 0.4]];

const PAM = { name: 'Pam (PA)', color: '#ffd89a' };
const HEROES = [
  { cls: 'biker', name: 'BIKER', role: 'TANK', color: '#ff7a50' },
  { cls: 'mallCop', name: 'MALL COP', role: 'RANGED', color: '#6aa0ff' },
  { cls: 'skater', name: 'SKATER', role: 'SPEED', color: '#50e890' },
  { cls: 'mallGoth', name: 'MALL GOTH', role: 'AOE', color: '#d070ff' },
];
const LABEL = { biker: 'Biker', mallCop: 'Mall Cop', skater: 'Skater', mallGoth: 'Mall Goth' };
const FC = FOUNTAIN;
const E = ESCALATOR;

export class Intro {
  constructor(r3d) {
    this.r3d = r3d;
    this.built = false;
    this.active = false;
    this.done = false;
    this.gate = false;
    this.t = 0;
  }

  // gate: wait on a black "tap or press any key" screen first (browsers only let sound start after a gesture).
  start({ gate = false } = {}) {
    if (this.built && this.builtQ !== this.r3d.quality) this.teardown();   // the quality setting changed since the last play
    this.prepareRenderer();
    if (!this.built) this.build();
    this.active = true;
    this.done = false;
    this.gate = !!gate;
    this.t = 0;
    this.age = 0;
    this.resetFilm();
    if (!this.gate) this.begin();
  }

  begin() { this.gate = false; this.pl.reset(); this.resetFilm(); this.t = this.pl.t = -PREROLL; this.age = 0; }

  // Any button / tap while the gate is up starts the show; afterwards it skips.
  press() {
    if (!this.active || this.done) return 'none';
    if (this.gate) { this.begin(); return 'begin'; }
    if (this.age < 0.35) return 'none'; // (real seconds since the show began: the pre-roll's film time is negative)
    this.finish();
    return 'skip';
  }

  /** Stop the film and hand the renderer and the GPU back. */
  finish() {
    this.done = true;
    this.active = false;
    this.teardown();
  }

  // ---------------------------------------------------------------- build / teardown

  build() {
    const r3d = this.r3d, high = r3d.quality === 'high';
    this.built = true; this.builtQ = r3d.quality; this.high = high;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#05040b');
    scene.fog = new THREE.Fog('#07060f', 140, 1250);
    this.lights = new LightRig(scene);
    this.sparks = new SparkPool(scene, high ? 320 : 160);
    this.dust = new DustField(scene, { n: high ? 200 : 70, box: [360, 190, 1300], center: [0, 0, 0], color: '#bcc8ff', size: high ? 3.4 : 4.5, opacity: high ? 0.55 : 0.4 });

    // sets
    const con = buildConcourse({ high }); this.con = con.h; scene.add(con.group); this.conG = con.group;
    const off = buildOffice(); this.off = off.h; scene.add(off.group); this.offG = off.group;
    this.bays = {};
    for (const h of HEROES) { const b = buildBay(h.cls); scene.add(b.group); this.bays[h.cls] = b; }
    // light shafts: the skylight's cold moon over the concourse (fewer on Low), a coloured one over each hero bay
    this.shaftsCon = [];
    const slots = high ? [[-34, 560], [30, 330], [-26, 120], [34, 250], [0, -150], [-30, -520], [30, -820]] : [[30, 330], [-26, 120], [0, -400]];
    for (const [x, z] of slots) { const s = makeShaft({ color: '#7a98ff', len: 190, r0: 6, r1: 44, opacity: high ? 0.2 : 0.16 }); s.position.set(x, 189, z); this.conG.add(s); this.shaftsCon.push(s); }
    this.shaftBay = {};
    for (const h of HEROES) { const s = makeShaft({ color: h.color, len: 188, r0: 8, r1: 54, opacity: high ? 0.3 : 0.22 }); const c = this.bays[h.cls].center; s.position.set(c.x - 10, 188, c.z + 4); scene.add(s); this.shaftBay[h.cls] = s; }

    // cast: the four survivors and ten of the dead (real game models)
    this.heroes = {};
    for (const h of HEROES) { const a = makeHero(h.cls); a.visible = false; scene.add(a.root); this.heroes[h.cls] = a; }
    const kinds = ['walker', 'walker', 'sprinter', 'walker', 'brute', 'sprinter', 'walker', 'sprinter', 'spitter', 'walker'];
    this.zombies = kinds.map((type, i) => {
      const a = makeZombie(type, (i % 2) + 1);
      scene.add(a.root);
      const row = i < 5 ? 0 : 1, x = [-70, -34, 20, 46, 78][i % 5] + (row ? 14 : 0), z = DOOR_Z - 22 - row * 46;
      return { a, type, x, z0: z, v: type === 'sprinter' ? 330 : type === 'brute' ? 190 : 230, d: i * 0.07, run: type === 'sprinter', running: false, dz: 0, mode: 'door' };
    });
    // the torch flame, the Goth's boombox, the skater's speed streaks
    this.flame = [['#ff6a10', 17], ['#ffa030', 12], ['#ffd080', 7]].map(([c, sz]) => { const f = glowSprite(c, sz, 0.6); f.visible = false; f.userData.sz = sz; scene.add(f); return f; });
    this.buildBoombox(scene);
    this.streaks = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(90 + i * 14, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? '#30ffc0' : '#30b8ff').multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.position.set(BAY_X.skater, 0.8, BAY_Z - 70 + i * 22); m.userData = { z: BAY_Z - 60 + i * 20, ph: i * 0.37 };
      scene.add(m); this.streaks.push(m);
    }

    warmSplat('blood', 3);
    this.handV = new THREE.Vector3(); // (the flare callbacks reuse it)
    this.pl = new CinePlayer(r3d, scene, this.shots());
    this.pl.barIn = [0.2, 2.2];
    this.pl.fadeFn = (t) => Math.max(1 - smooth((t - 0.4) / 2.2), smooth((t - (INTRO_END - 1.3)) / 1.2));
    this.pl.titleAt = 70.5;
    this.script();
    this.warm();
  }

  buildBoombox(scene) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: '#1a1424', roughness: 0.5, metalness: 0.3 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(34, 16, 12), body));
    this.cones = [];
    for (const sx of [-9, 9]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(5.2, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d070ff').multiplyScalar(0.7), toneMapped: false }));
      c.position.set(sx, 0, 6.1); g.add(c); this.cones.push(c);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(9, 0.8, 6, 12, Math.PI), body); handle.position.y = 8; g.add(handle);
    g.visible = false; scene.add(g);
    this.boombox = g;
  }

  // Compile every shader up front (behind the black gate / fade-in) so no shot hitches when it first appears.
  warm() {
    const groups = [this.conG, this.offG, ...Object.values(this.bays).map((b) => b.group)];
    const vis = groups.map((g) => g.visible);
    groups.forEach((g) => { g.visible = true; });
    const act = [...Object.values(this.heroes), ...this.zombies.map((z) => z.a)];
    const av = act.map((a) => a.visible); act.forEach((a) => { a.visible = true; });
    this.boombox.visible = true; this.flame.forEach((f) => { f.visible = true; });
    this.pl.t = 0.01; this.pl.shotI = 0;
    try { this.r3d.renderer.compile(this.scene, this.pl.camera); this.pl.render(); } catch (e) { console.warn('intro warm-up failed', e); }
    groups.forEach((g, i) => { g.visible = vis[i]; });
    act.forEach((a, i) => { a.visible = av[i]; });
    this.boombox.visible = false; this.flame.forEach((f) => { f.visible = false; });
    this.pl.reset();
  }

  // High gets a crisper backbuffer (the game's own Retro pixelation is for play, not for a film); Low keeps its budget.
  prepareRenderer() {
    const r = this.r3d.renderer;
    if (this.savedRatio == null) this.savedRatio = r.getPixelRatio();
    const dpr = window.devicePixelRatio || 1, high = this.r3d.quality === 'high';
    r.setPixelRatio(high ? Math.min(1.6, Math.max(1.25, dpr)) : Math.max(this.savedRatio, 0.8));
    r.setSize(960, 640, false);
    if (this.r3d.canvas) this.r3d.canvas.style.imageRendering = 'auto';
  }

  teardown() {
    if (!this.built) return;
    try { this.pl.dispose(); } catch { /* already gone */ }
    disposeTree(this.scene);
    this.scene.clear();
    this.built = false;
    this.pl = null;
    // hand the renderer back exactly as the game had it (pixel ratio, size, image-rendering)
    try {
      if (this.savedRatio != null) { this.r3d.renderer.setPixelRatio(this.savedRatio); this.r3d.renderer.setSize(960, 640, false); }
      if (this.r3d.pixelLevel != null) this.r3d.setPixelation(this.r3d.pixelLevel);
    } catch { /* renderer gone */ }
    this.savedRatio = null;
  }

  // ---------------------------------------------------------------- the film

  resetFilm() {
    this.t = 0;
    this.slow = 1;
    this.sparks.clear();
    this.con.drawCrack(0);
    this.con.glass.visible = true; this.con.cracks.visible = true; this.con.shards.visible = false; this.shatterT = -1;
    this.con.led.material.color.set('#ff2a1a').multiplyScalar(1.4); this.con.ledGlow.material.color.set('#ff2a1a'); this.ledGreen = false;
    for (const z of this.zombies) { z.dz = 0; z.running = false; z.hit = false; z.hitAt = 0; z.mode = 'door'; z.a.root.position.set(z.x, 0, z.z0); z.a.root.rotation.set(0, 0, 0); z.a.loop('Walking_D_Skeletons', 0.5); z.a.look(0, 0); z.a.visible = true; }
    for (const m of this.con.crowdSil) m.userData.dz = 0;
    for (const a of Object.values(this.heroes)) { a.visible = false; a.root.rotation.set(0, 0, 0); a.root.scale.setScalar(a.baseScale); a.target.headYaw = a.target.headPitch = a.target.armR = a.target.armL = a.target.lean = a.target.twist = 0; }
    for (const a of Object.values(this.heroes)) a.resetActing();
    this.slammed = false;
    this.flameOn = 0; this.rev = 0; this.glow = 0; this.bass = 0; this.paTalk = 0;
  }

  // the lightning: a double strobe
  strike(t, big = 1) { this.pl.at(t, (p) => { p.flashV = big; }); this.pl.at(t + 0.07, (p) => { p.flashV = 0.12 * big; }); this.pl.at(t + 0.13, (p) => { p.flashV = 0.85 * big; }); }

  // subtitles, name cards and every sound cue, laid on the timeline (seconds from the start)
  script() {
    const p = this.pl, at = (t, fn) => p.at(t, fn);
    const pa = (a, b, text) => { p.say(a, b, PAM.name, PAM.color, text, 'pa'); at(a, () => { paSpeak(text); this.paTalk = b - a; cine.paStatic(0.3, 0.05); }); };
    const hero = (cls, a, b, text) => { const h = HEROES.find((x) => x.cls === cls); p.say(a, b, LABEL[cls], h.color, text, 'line'); };
    // --- 0 the studio card
    at(-4.4, () => { cine.drone(10, 0.08); cine.studioCue(); });
    at(-3.9, () => cine.heartbeat(1, 0.9, 0.25));
    at(-2.2, () => cine.tubeTink());
    // --- 1 atrium
    at(5.2, () => cine.tubeTink());
    at(6.2, () => cine.screamFar(0.05));
    at(0.0, () => { cine.introBed(INTRO_END, 0.1); cine.rain(INTRO_END - 3, 0.07); cine.neonBuzz(8, 0.04); });
    at(0.9, () => { cine.paOpen(); cine.paChime(0.15); });
    pa(2.9, 6.4, 'Good morning, Brightwater Commons!');
    this.strike(4.6, 0.7);
    // --- 2 corridor
    at(7.0, () => cine.thunder());
    at(7.4, () => cine.heartbeatRamp(9, 0.85, 0.5, 0.18));
    pa(8.0, 13.6, 'The time is four-fifty-nine. The doors are now open.');
    at(10.4, () => cine.escalatorGroan());
    at(11.2, () => { cine.doorSlam(0.35); this.slamPulse = 0.6; }); at(12.9, () => { cine.doorSlam(0.5); this.slamPulse = 0.8; }); 
    // silence, then the slam
    at(13.65, () => cine.duck(0.46));
    at(14.15, () => { cine.glassThud(); cine.stingHit(); cine.braam(0.35); this.con.drawCrack(1); p.shake(14.15, 12); p.punch(14.15, 0.07); });
    at(14.2, () => cine.glassCrack());
    this.strike(9.6, 0.8);
    // --- 3 the lock
    at(15.3, () => cine.lockBeep(false)); at(16.0, () => cine.lockBeep(false)); at(16.7, () => cine.lockBeep(false));
    at(17.35, () => { this.ledGreen = true; cine.lockBeep(true); });
    at(17.6, () => { cine.lockClunk(); p.shake(17.6, 5); });
    at(17.95, () => cine.duck(0.95)); // the bolt is back. Nothing. (to 18.9)
    this.strike(18.0, 0.55);
    // --- 4 the doors burst
    at(18.95, () => cine.whoosh(0.9, 0.16));
    at(19.45, () => cine.duck(0.5));
    at(20.0, () => { cine.heartbeat(2, 0.5, 0.2); cine.horde(4, 0.1); });
    // one comes straight at the lens
    at(22.6, () => { cine.bodyHit(); cine.screamCut(); p.splat(22.6, 0.85, 'blood', 3); p.shake(22.6, 16); p.punch(22.6, 0.09); });
    for (const [i, s] of [20.0, 20.2].entries()) { void i; at(s, () => { cine.doorSlam(1.1); this.con.drawCrack(2); p.shake(s, 7); }); }
    at(20.42, () => { this.shatter(); cine.doorBurst(); cine.horde(4, 0.2); cine.stingHit(); p.shake(20.42, 22, 3); });
    this.strike(20.42, 1.3);
    // --- 5 the monitor
    at(24.0, () => { cine.monitorOn(); cine.tapeWarble(2.4); });
    pa(25.0, 27.6, 'Thank you, Officer.');
    at(27.4, () => cine.piano(329.6, 0.2));
    // --- 6 the escalator and the spitter
    at(30.1, () => cine.escalatorGroan());
    pa(31.0, 35.6, 'Shoppers who sampled, please remain loyal.');
    for (const [t0] of ESC_DROPS) at(t0, () => cine.tubeTink());
    at(33.4, () => cine.moan());
    at(35.55, () => cine.duck(0.3));
    at(35.9, () => { cine.stingHit(); cine.moan(); p.shake(35.9, 10); p.punch(35.9, 0.06); });
    at(34.2, () => { cine.spitterGargle(); this.spit = 1; });
    this.strike(30.6, 0.7);
    // --- 7 biker
    p.card(37.55, 42.6, HEROES[0].name, HEROES[0].role, HEROES[0].color);
    at(36.75, () => cine.chainsawRev()); // (J-cut: the saw is heard before the Biker is seen)
    at(37.3, () => { this.rev = 2.2; });
    at(38.15, () => cine.guitarStab());
    at(39.5, () => this.heroes.biker.play('2H_Melee_Attack_Chop', { upper: true, timeScale: 1.1 }));
    hero('biker', 38.4, 42.2, "Quiet's for libraries and the dead.");
    // --- 8 mall cop
    p.card(43.55, 48.6, HEROES[1].name, HEROES[1].role, HEROES[1].color);
    // (no fire clip here: a one-shot releases the weapon-aim pose and leaves the gun hanging off his hand, so the rack is
    // acted on top of the aiming idle: a dip and kick of the torso with the flashlight flaring)
    at(44.8, () => { this.ping = 0.25; this.rack = 0.55; p.shake(44.8, 2.5, 6); });
    at(44.9, () => { cine.shotgunRack(); });
    at(45.4, () => cine.snareHit());
    hero('mallCop', 45.6, 48.6, 'Copy. I am very calm.');
    // --- 9 skater
    p.card(49.55, 54.6, HEROES[2].name, HEROES[2].role, HEROES[2].color);
    at(49.2, () => { cine.wheelRoll(3.2); cine.whoosh(0.7, 0.14); });
    at(50.1, () => cine.cymbal());
    hero('skater', 50.5, 54.4, 'Dude. Dude. We are so banned.');
    // --- 10 goth
    p.card(55.55, 61.6, HEROES[3].name, HEROES[3].role, HEROES[3].color);
    at(56.7, () => cine.lighterFlick());
    at(57.2, () => { cine.hairsprayFlame(); cine.flameWhoomp(); this.flameOn = 5; });
    at(58.6, () => { cine.bassDrop(); this.bass = 1; p.shake(58.6, 4); });
    hero('mallGoth', 57.8, 61.6, 'Great. The apocalypse. At a mall.');
    // --- 11 the circle, the skylight, the title
    at(62.2, () => cine.riser(5.5, 0.13));
    this.strike(66.2, 0.9);
    pa(65.2, 68.9, 'The mall is now open. Forever.');
    at(68.95, () => cine.paChime());
    at(69.25, () => cine.duck(1.2)); // true silence before the title
    at(70.5, () => { cine.titleSlam(); cine.braam(0.5); p.flashV = 1.2; p.shake(70.5, 14, 3); });
    at(70.75, () => cine.themeIn(8));
  }

  shatter() {
    const C = this.con;
    this.shatterT = 0;
    this.slow = 0.28;
    C.glass.visible = false; C.cracks.visible = false; C.shards.visible = true;
    for (const s of C.shardData) {
      s.p.set((Math.random() - 0.5) * 190, 6 + Math.random() * 84, DOOR_Z + 2 + Math.random() * 6);
      s.v.set((Math.random() - 0.5) * 120 + s.p.x * 0.5, Math.random() * 130 - 20, 160 + Math.random() * 330);
      s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      s.s = 0.7 + Math.random() * 1.6;
    }
    for (let i = 0; i < 60; i++) this.sparks.spark(Math.random() * 180 - 90, 8 + Math.random() * 80, DOOR_Z + 3, (Math.random() - 0.5) * 120, Math.random() * 90, 80 + Math.random() * 200, '#cfe8ff', 0.9);
  }

  // ---------------------------------------------------------------- the shot list

  shots() {
    const self = this;
    const camFill = (p, power, c = '#8fb8ff') => self.lights.set({ fill: [c, [p.camera.position.x, p.camera.position.y + 26, p.camera.position.z - 40], power] });
    // sets on / off per shot
    const show = (con, off, bay = null) => {
      self.conG.visible = con; self.offG.visible = off;
      for (const h of HEROES) { self.bays[h.cls].group.visible = h.cls === bay; self.shaftBay[h.cls].visible = h.cls === bay; }
      for (const z of self.zombies) if (!con) z.a.visible = false;
    };
    const amb = { sky: '#3a4a8a', ground: '#0a0814', hemi: 0.5, moon: 0.3, moonColor: '#7088ff' };
    const bayShot = (cls, cfg) => ({
      grade: 'HERO_GRIT',
      enter: (p) => {
        show(false, false, cls);
        const c = self.bays[cls].center;
        self.dust.moveTo(c.x, 0, c.z); self.sparks.clear();
        self.lights.set({ amb: { sky: '#2a2448', ground: '#07050e', hemi: 0.3, moon: 0, moonColor: '#101030' }, ...cfg.lights(c) }, true);
        p.fogBay = true; self.scene.fog.far = 900;
        if (cfg.enter) cfg.enter(p, c);
      },
      tick: (dt, lt, k, p) => { if (cfg.tick) cfg.tick(dt, lt, k, p, self.bays[cls].center); },
    });
    const concourse = (p, fog = 1250) => { show(true, false); self.scene.fog.near = 140; self.scene.fog.far = fog; };

    return [
      // ---- 1: crane down a PA speaker to the dark atrium
      { id: 'atrium', dur: 7, fov: [38, 52], cam: crane([84, 152, 604], [34, 74, 640], [90, 150, 560], [0, 52, 230], { ease: 'smoother' }),
        dof: { focus: [40, 560], aperture: 0.4 }, exposure: 1.0,
        enter(p) {
          concourse(p); self.dust.moveTo(0, 0, 150); self.lights.set({ amb: { ...amb, hemi: 0.42, moon: 0.4 }, key: ['#6a88ff', [40, 185, 420], 190, (t) => scriptedFail(t, [[5.2, 0.5]])], rim: ['#ffb070', [-70, 70, 330], 70], fill: ['#9ab8ff', [80, 120, 620], 40] }, true);
        },
      },
      // ---- 2: slow low dolly toward the glass doors; the dead pressed against them
      { id: 'corridor', dur: 8, fov: [52, 44], cam: dolly([0, 22, 300], [0, 28, -760], [0, 62, -1300], [0, 56, -1300], { ease: 'smooth', hand: 0.55 }),
        dof: { focus: [900, 480], aperture: 0.5 },
        enter(p) { concourse(p); self.dust.moveTo(0, 0, -250); self.lights.set({ amb, key: ['#ff2ea6', [-140, 100, 0], 170], rim: ['#2ee6ff', [140, 90, -500], 160] }, true); },
        tick(dt, lt, k, p) {
          camFill(p, 55);
          const red = clamp01((lt - 2) / 5) * (0.5 + 0.5 * Math.sin(lt * 6)) * 0.6;
          self.lights.set({ fx: ['#ff2a1a', [0, 90, DOOR_Z + 150], 500 * red] });
          for (const z of self.zombies) { if (z.mode !== 'door') continue; if (self.slamPulse > 0) z.a.root.position.z = z.z0 + Math.sin(lt * 40 + z.x) * 1.4 * self.slamPulse; }
        },
      },
      // ---- 3: close-up on the keypad lock: red LED -> green, rack focus through the glass to the horde
      { id: 'lock', dur: 4, fov: [26, 19], cam: push([-70, 63, DOOR_Z + 56], [-80, 63, DOOR_Z + 42], [-109, 63, DOOR_Z + 2], [-107, 63, DOOR_Z + 2], { hand: 0.15 }),
        dof: { focus: [60, 100], aperture: 2.0, from: 0.5, to: 0.76 }, bloom: 0.7,
        flares: [{ at: [-109, 63, DOOR_Z + 2], color: '#7ab8ff', k: 0.45, len: 0.45 }],
        enter(p) { concourse(p, 900); self.dust.moveTo(0, 0, DOOR_Z + 100); self.lights.set({ amb: { ...amb, hemi: 0.3 }, key: ['#ff2a1a', [-100, 66, DOOR_Z + 24], 70], rim: ['#6a88ff', [-20, 80, DOOR_Z + 90], 70], fill: ['#4a3a60', [-60, 50, DOOR_Z + 70], 30] }, true); },
        tick(dt, lt) {
          const g = self.ledGreen;
          self.con.led.material.color.set(g ? '#30ff70' : '#ff2a1a').multiplyScalar(g ? 3 : 2.2 + Math.sin(lt * 9) * 0.8);
          self.con.ledGlow.material.color.set(g ? '#30ff70' : '#ff2a1a');
          self.lights.set({ key: [g ? '#30ff70' : '#ff2a1a', [-100, 66, DOOR_Z + 24], 70] });
        },
      },
      // ---- 4: whip-pan to a wide as the doors burst inward (slow-motion shatter, hard white then amber)
      { id: 'burst', dur: 5, fov: [50, 62], exposure: 1.0,
        cam: { hand: 0.4, seq: [
          { to: 0.24, ...whip([0, 44, -760], [-420, 40, -520], [0, 48, DOOR_Z], { blur: 1 }), fov: [50, 50] },
          { to: 1, ...dolly([0, 44, -760], [0, 62, -690], [0, 48, DOOR_Z], [0, 40, -1000], { ease: 'in', hand: 1.0 }), fov: [52, 64] },
        ] },
        enter(p) { concourse(p); self.dust.moveTo(0, 0, -900); self.lights.set({ amb, key: ['#ff2ea6', [-120, 100, -800], 100], rim: ['#2ee6ff', [140, 90, -900], 110], fx: ['#ff2a1a', [0, 90, DOOR_Z + 150], 300] }, true); },
        tick(dt, lt, k, p) {
          camFill(p, 70);
          const burst = lt > 1.42;
          if (burst) { const live = p.shots[p.shotI]; live.panic = true; }
          self.lights.set({ fx: [burst ? '#ffa24a' : '#ff2a1a', [0, 80, DOOR_Z + 150], burst ? 650 : 300] });
          if (burst) self.glow = 1;
        },
      },
      // ---- 5: the security monitor, slow push-in on the glitched feed
      { id: 'monitor', dur: 6, fov: [34, 23], cam: push([OFFICE_X - 8, 72, 50], [OFFICE_X + 3, 69, 8], [OFFICE_X, 66, -62], [OFFICE_X + 3, 68, -62], { hand: 0.2 }),
        dof: { focus: [114, 70], aperture: 0.7 }, bloom: 0.6, grade: 'SICK_FLUOR',
        flares: [{ at: [OFFICE_X, 66, -60], color: '#58f0b0', k: 0.3, len: 0.7 }],
        enter(p) { show(false, true); self.dust.moveTo(OFFICE_X, 0, 0); self.scene.fog.far = 600; self.lights.set({ amb: { sky: '#1a3a30', ground: '#050a08', hemi: 0.25, moon: 0, moonColor: '#101820' }, key: ['#4af0a0', [OFFICE_X, 74, -20], 150], rim: ['#6a8ad0', [OFFICE_X + 110, 70, 20], 70], fill: ['#d8f0ff', [OFFICE_X, 100, 10], 50, (t) => flicker(t, 4, true)] }, true); },
        tick(dt, lt, k) { self.off.drawFeed(self.pl.t, 0.25 + 0.4 * k); self.off.glow.material.opacity = 0.045 + 0.02 * Math.sin(lt * 21); },
      },
      // ---- 6: crane up the dead escalator; a spitter crawls over the top step, walkers below
      { id: 'escalator', dur: 7, fov: [46, 52], cam: crane([-10, 16, E.z0 + 270], [-70, 124, E.z0 - 90], [E.x, 70, E.z0 - 180], [E.x, 128, E.z0 - 300], { ease: 'smooth' }),
        dof: { focus: [300, 330], aperture: 0.35 }, grade: 'FRYER_HELL',
        enter(p) {
          concourse(p, 1200); self.dust.moveTo(E.x, 0, E.z0 - 200);
          self.lights.set({ amb: { ...amb, hemi: 0.4 }, key: ['#ff7a20', [E.x, E.rise + 80, E.z0 - E.len - 60], 480, (t) => scriptedFail(t, ESC_DROPS) * (0.88 + 0.12 * failing(t, 9, 0.8))], rim: ['#4a6aff', [E.x + 90, 60, E.z0 + 20], 110], fill: ['#8fb8ff', [E.x, 40, E.z0 + 120], 40] }, true);
          const zs = self.zombies;
          [[0, -30, -10], [1, 20, 14], [2, -10, 40], [3, 30, -24], [9, -44, 4]].forEach(([i, dx, dz], n) => { const z = zs[i]; z.mode = 'esc'; z.running = false; z.a.root.position.set(E.x + dx, 0, E.z0 + dz); z.a.root.rotation.set(0, Math.PI + dx * 0.004, 0); z.a.loop('Walking_D_Skeletons', 0.4 + n * 0.05); z.a.visible = true; });
          for (const i of [4, 5, 6, 7]) { zs[i].mode = 'off'; zs[i].a.visible = false; }
          const sp = zs[8]; sp.mode = 'spit'; sp.a.visible = true; sp.a.root.position.set(E.x, 112, E.z0 - E.len - 46); sp.a.root.rotation.set(0.75, Math.PI, 0); sp.a.loop('Walking_D_Skeletons', 0.5); self.spit = 0;
        },
        tick(dt, lt, k, p) {
          // they only move in the dark: each restrike shows them closer
          if (scriptedFail(p.t, ESC_DROPS) < 0.3) for (const z of self.zombies) if (z.mode === 'esc') z.a.root.position.z += dt * 70;
          if (lt > 5.85) { // and one that was never at the foot of the stairs, right beside the camera
            const z = self.zombies[5], c = p.camera, u = clamp01((lt - 5.85) / 0.22);
            const at = self.lurchV || (self.lurchV = new THREE.Vector3());
            at.set(30 - u * 9, -6, -62).applyMatrix4(c.matrixWorld);
            z.mode = 'lurch'; z.a.visible = true; z.a.root.position.set(at.x, at.y - 52 + u * 14, at.z);
            z.a.root.rotation.set(0, Math.atan2(c.position.x - at.x, c.position.z - at.z), 0.18);
          }
          const sp = self.zombies[8];
          const kk = smooth((lt - 0.8) / 3.8);
          sp.a.root.position.z = E.z0 - E.len - 46 + kk * 66;
          sp.a.root.position.y = 112 - kk * 2;
          if (self.spit > 0) { self.spit -= dt; sp.a.root.rotation.x = 0.75 - 0.5 * Math.sin(clamp01(1 - self.spit / 1) * Math.PI); const w = sp.a.boneWorld('Head'); for (let i = 0; i < 3; i++) self.sparks.spark(w.x + (Math.random() - 0.5) * 3, w.y, w.z + 8, (Math.random() - 0.5) * 30, 10 + Math.random() * 30, 60 + Math.random() * 70, Math.random() < 0.5 ? '#b0ff40' : '#ffd040', 0.7); }
        },
      },
      // ---- 7: Biker: low orbit, the chainsaw revs, hot orange key, red rim
      { id: 'biker', dur: 6, fov: [44, 36], cam: orbit([BAY_X.biker, 0, BAY_Z], [118, 92], [-1.0, 0.22], [12, 32], [BAY_X.biker, 36, BAY_Z], { ease: 'smooth', hand: 0.25 }),
        dof: { focus: [118, 90], aperture: 1.1 },
        flares: [{ at: () => (self.rev > 0 ? self.heroes.biker.boneWorld('WristR', self.handV) : null), color: '#ff9a30', k: 0.6 }],
        ...bayShot('biker', {
          lights: (c) => ({ key: ['#ff8a30', [c.x - 70, 78, c.z + 70], 360], rim: ['#ff2a20', [c.x + 70, 92, c.z - 85], 460], fill: ['#2a3a8a', [c.x + 90, 30, c.z + 90], 80] }),
          enter(p, c) { const a = self.heroes.biker; a.visible = true; a.root.position.set(c.x, 0, c.z); a.root.rotation.y = 0.12; a.look(-35, 0, 3).raise('R', 0.35).lean(0.1).breathe(0.6, 0.4); },
          tick(dt, lt, k, p, c) {
            const a = self.heroes.biker;
            if (lt > 1.4) a.look(8, 4, 3).raise('R', 0.7).lean(0.3);
            self.rev = Math.max(0, self.rev - dt);
            // he starts as a shape in the dark: the saw's own sparks are what light his face
            const lit = Math.max(smooth((lt - 0.9) / 1.2), clamp01(self.rev / 0.6));
            self.lights.set({ key: ['#ff8a30', [c.x - 70, 78, c.z + 70], 40 + 320 * lit] });
            if (self.rev > 0) { a.root.position.set(c.x + (Math.random() - 0.5) * 0.9, Math.random() * 0.5, c.z); const w = a.boneWorld('WristR'); if (Math.random() < dt * 70) self.sparks.spark(w.x + 6, w.y + 2, w.z + 12, (Math.random() - 0.3) * 140, 30 + Math.random() * 120, 40 + Math.random() * 120, Math.random() < 0.5 ? '#ffb040' : '#fff4d0', 0.5); }
          },
        }),
      },
      // ---- 8: Mall Cop: a three-quarter push-in, the gun held level across the frame, shotgun racked, flashlight key
      { id: 'cop', dur: 6, fov: [37, 31], cam: push([BAY_X.mallCop - 14, 44, BAY_Z + 136], [BAY_X.mallCop - 6, 47, BAY_Z + 108], [BAY_X.mallCop + 6, 29, BAY_Z], [BAY_X.mallCop + 4, 34, BAY_Z], { hand: 0.3 }),
        dof: { focus: [135, 107], aperture: 1.2 },
        flares: [{ at: () => self.heroes.mallCop.boneWorld('WristR', self.handV), color: '#7ab8ff', k: () => 0.25 + (self.ping > 0 ? 0.75 : 0), len: 0.9 }],
        ...bayShot('mallCop', {
          lights: (c) => ({ key: ['#cfe0ff', [c.x - 40, 70, c.z + 90], 330], rim: ['#3a6aff', [c.x + 60, 95, c.z - 85], 420], fill: ['#c86a30', [c.x + 80, 30, c.z + 70], 90] }),
          enter(p, c) {
            const a = self.heroes.mallCop; a.visible = true; a.root.position.set(c.x, 0, c.z); a.root.rotation.y = 0.72; a.look(-24, -3, 3).lean(0).tremble(0.2).breathe(0.6, 0.5);
            self.ping = 0; self.rack = 0;
          },
          tick(dt, lt, k, p, c) {
            const a = self.heroes.mallCop;
            if (lt > 1.0) a.look(-34, 1, 4);
            self.rack = Math.max(0, (self.rack || 0) - dt);
            a.lean(self.rack > 0 ? Math.sin((1 - self.rack / 0.55) * Math.PI * 2) * 0.28 : 0.04);
            self.ping = Math.max(0, (self.ping || 0) - dt);
            self.lights.set({ key: ['#cfe0ff', [c.x - 40, 70, c.z + 90], 330 + (self.ping > 0 ? 700 : 0)] });
          },
        }),
      },
      // ---- 9: Skater: tracking low alongside, mid-dash, teal neon streaks
      { id: 'skater', dur: 6, fov: [44, 40], cam: dolly([BAY_X.skater - 150, 13, BAY_Z + 78], [BAY_X.skater + 150, 15, BAY_Z + 74], [BAY_X.skater - 130, 30, BAY_Z], [BAY_X.skater + 170, 32, BAY_Z], { ease: 'smooth', hand: 0.4 }),
        dof: { focus: 78, aperture: 1.0 },
        ...bayShot('skater', {
          lights: (c) => ({ key: ['#40ffa0', [c.x - 40, 90, c.z + 60], 330], rim: ['#ff40a0', [c.x + 70, 40, c.z - 80], 300], fill: ['#2a5aff', [c.x, 30, c.z + 110], 90] }),
          enter(p, c) { const a = self.heroes.skater; a.visible = true; a.root.position.set(c.x - 130, 0, c.z); a.root.rotation.y = Math.PI / 2 - 0.1; a.loop('Running_A', 1.15); },
          tick(dt, lt, k, p, c) {
            const a = self.heroes.skater, kk = ease('smooth', k);
            a.root.position.set(c.x - 130 + kk * 300, 0, c.z);
            self.lights.set({ key: ['#40ffa0', [a.root.position.x - 40, 90, c.z + 60], 330], rim: ['#ff40a0', [a.root.position.x + 70, 40, c.z - 80], 300] });
            for (const m of self.streaks) { m.position.x = c.x + ((((m.userData.ph * 400 - lt * 360) % 420) + 420) % 420) - 210; m.position.z = m.userData.z; m.visible = true; }
          },
        }),
      },
      // ---- 10: Mall Goth: slow push-in, hairspray torch lit, flame key from below, boombox at her feet
      { id: 'goth', dur: 7, fov: [38, 26], cam: push([BAY_X.mallGoth + 6, 30, BAY_Z + 112], [BAY_X.mallGoth + 2, 40, BAY_Z + 62], [BAY_X.mallGoth, 32, BAY_Z], [BAY_X.mallGoth, 42, BAY_Z], { hand: 0.2 }),
        dof: { focus: [114, 66], aperture: 1.2 },
        flares: [{ at: () => (self.flameOn > 0 && self.flame[0].visible ? self.flame[0].position : null), color: '#ff8a20', k: 0.55 }],
        ...bayShot('mallGoth', {
          lights: (c) => ({ key: ['#ff9a30', [c.x + 6, 6, c.z + 50], 90], rim: ['#b040ff', [c.x - 70, 95, c.z - 80], 440], fill: ['#3a2a7a', [c.x + 80, 40, c.z + 90], 70] }),
          enter(p, c) {
            const a = self.heroes.mallGoth; a.visible = true; a.root.position.set(c.x, 0, c.z); a.root.rotation.y = 0.05; a.look(0, -6, 3).raise('R', 0.1).breathe(0.4);
            self.boombox.visible = true; self.boombox.position.set(c.x + 36, 8, c.z + 20); self.boombox.rotation.y = -0.5;
            for (const s of self.streaks) s.visible = false;
          },
          tick(dt, lt, k, p, c) {
            const a = self.heroes.mallGoth, b = self.bass = Math.max(0, self.bass - dt * 2);
            // total dark until the lighter catches
            const spark = clamp01((lt - 1.7) / 0.25);
            self.lights.set({ key: ['#ff9a30', [c.x + 6, 6, c.z + 50], 8 + 82 * spark] });
            self.cones.forEach((m) => m.scale.setScalar(1 + b * 0.25 + Math.sin(lt * 18) * 0.03 * (lt > 3.5 ? 1 : 0)));
            if (lt > 1.2) a.look(0, 3, 3).raise('R', 0.5);
            if (self.flameOn > 0) {
              self.flameOn -= dt;
              const w = a.boneWorld('WristR'), ft = lt - 1.6;
              self.flame.forEach((f, i) => { f.visible = ft > 0; if (f.visible) { const kk = clamp01(ft * 5) * (1 + Math.sin(lt * 38 + i * 2) * 0.18 + Math.random() * 0.12); f.position.set(w.x + (Math.random() - 0.5) * 1.2, w.y + 6 + i * 3, w.z + 6 + i * 8 * clamp01(ft * 4)); f.scale.setScalar(f.userData.sz * kk); } });
              if (ft > 0) {
                const fl = 1 + Math.sin(lt * 40) * 0.2 + Math.random() * 0.15;
                self.lights.set({ fx: ['#ff9a30', [w.x + 14, w.y + 14, w.z + 46], 120 * fl * clamp01(ft * 6)] });
                for (let i = 0; i < 4; i++) self.sparks.spark(w.x + (Math.random() - 0.5) * 5, w.y + 1 + Math.random() * 4, w.z + 6 + Math.random() * 42 * clamp01(ft * 5), (Math.random() - 0.5) * 24, 30 + Math.random() * 60, 30 + Math.random() * 70, Math.random() < 0.5 ? '#ff8a20' : '#ffe080', 0.35 + Math.random() * 0.25);
              }
            }
          },
        }),
      },
      // ---- 11: pull back from the four in a defensive circle, crane up to the skylight, title slam
      { id: 'circle', dur: 16.5, fov: [40, 56], bloom: 0.75,
        cam: { hand: 0.3, seq: [
          { to: 0.5, ...dolly([FC[0] + 40, 46, FC[2] + 250], [FC[0], 72, FC[2] + 380], [FC[0], 34, FC[2]], [FC[0], 40, FC[2]], { ease: 'smooth' }), fov: [34, 46] },
          { to: 1, ...crane([FC[0], 72, FC[2] + 380], [FC[0], 118, FC[2] + 330], [FC[0], 40, FC[2]], [FC[0], 120, FC[2] - 30], { ease: 'smooth', hand: 0.15 }), fov: [46, 50] },
        ] },
        dof: { focus: [160, 440], aperture: 0.5 },
        enter(p) {
          concourse(p, 1400);
          self.boombox.visible = false; self.flame.forEach((f) => { f.visible = false; }); self.sparks.clear();
          self.dust.moveTo(FC[0], 0, FC[2]);
          self.lights.set({ amb: { sky: '#3a3a7a', ground: '#0a0814', hemi: 0.4, moon: 0.4, moonColor: '#7088ff' }, key: ['#ff2a50', [FC[0], 120, FC[2]], 430], rim: ['#6a8aff', [FC[0] + 90, 70, FC[2] + 260], 170], fill: ['#ffb060', [FC[0] - 150, 60, FC[2] - 120], 90], fx: ['#ff4a20', [FC[0], 40, FC[2] - 260], 150] }, true);
          const ang = { biker: 2.5, mallCop: 3.8, skater: 0.6, mallGoth: -0.6 };
          for (const h of HEROES) { const a = self.heroes[h.cls], r = 135, an = ang[h.cls]; a.visible = true; a.root.position.set(FC[0] + Math.sin(an) * r, 0, FC[2] + Math.cos(an) * r); a.root.rotation.set(0, an, 0); a.root.scale.setScalar(a.baseScale); a.loop(h.cls === 'mallGoth' ? 'Idle' : '2H_Melee_Idle', 1); a.look(0, 0, 3).raise('R', 0); }
          self.heroes.mallGoth.raise('R', 0.45); self.heroes.mallGoth.look(0, 2);
          self.heroes.skater.play('Dodge_Forward', { timeScale: 0.0001 }); self.heroes.skater.actor.base('2H_Melee_Idle');
          // the dead ring, closing in
          const spots = [1.2, 1.7, 2.2, 2.7, 3.2, 3.7, 4.2, 4.7, 5.1, 5.5];
          self.zombies.forEach((z, i) => { z.mode = 'ring'; z.ra = spots[i] + 0.2; z.rr = 520 + (i % 3) * 60; z.running = false; z.a.visible = true; z.a.loop('Walking_D_Skeletons', 0.5 + (i % 3) * 0.1); });
        },
        tick(dt, lt, k, p) {
          const tt = p.t;
          for (const z of self.zombies) {
            const r = Math.max(210 + (z.ra * 17 % 50), z.rr - lt * 24 * (0.8 + (z.ra % 1) * 0.5));
            z.a.root.position.set(FC[0] + Math.sin(z.ra) * r, 0, FC[2] + Math.cos(z.ra) * r);
            z.a.root.rotation.y = z.ra + Math.PI;
            z.a.root.visible = true;
          }
          self.scene.fog.near = 140 - 80 * clamp01(lt / 14);
          for (const h of HEROES) {
            const a = self.heroes[h.cls];
            a.breathe(0.8, 0.7);
            // eyes jump to another of the nearest three every 1.2 s (picked only when it changes)
            const slot = Math.floor(lt / 1.2 + h.cls.length);
            if (a.eyeSlot !== slot || !a.eyeOn || a.eyeOn.mode !== 'ring') {
              const hr = a.root.position;
              const near = self.zombies.filter((z) => z.mode === 'ring').sort((x, y) => x.a.root.position.distanceToSquared(hr) - y.a.root.position.distanceToSquared(hr));
              a.eyeSlot = slot; a.eyeOn = near.length ? near[slot % Math.min(3, near.length)] : null;
            }
            if (a.eyeOn) { const p3 = a.eyeOn.a.root.position; a.lookAtPoint(p3.x, 42, p3.z, 5); }
          }
          // the four's lights merge: warm key swells while the red holds, neon blooms on the title
          const hit = tt >= 70.5 ? Math.exp(-(tt - 70.5) * 1.6) : 0;
          self.lights.set({ key: ['#ff2a50', [FC[0], 120, FC[2]], 430 + hit * 600 + clamp01((lt - 4) / 6) * 160] });
          for (const s of self.shaftsCon) s.userData.mat.uniforms.uOpacity.value = (self.high ? 0.22 : 0.17) + hit * 0.25;
        },
      },
    ];
  }

  // ---------------------------------------------------------------- per frame

  /** Dev / screenshot tool: jump to time t by running the film forward in fixed steps, then hold there (hold = false resumes). */
  seek(t, step = 1 / 20) {
    this.hold = false;
    this.begin();
    while (this.active && !this.done && this.pl.t < t) this.update(step);
    this.hold = true;
  }

  update(dt) {
    if (!this.active || this.done || this.gate || this.hold) return;
    this.age += dt;
    if (this.pl.update(dt)) { this.finish(); return; }
    this.t = this.pl.t;
    const t = this.t, pl = this.pl;
    // slow motion on the shatter eases back to real time
    this.slow = this.shatterT >= 0 ? Math.min(1, 0.28 + Math.max(0, this.shatterT - 0.55) * 1.1) : 1;
    const sdt = dt * this.slow;
    const C = this.con;
    this.slamPulse = Math.max(0, (this.slamPulse || 0) - dt * 4);
    if (this.conG.visible) {
      C.update(dt, t);
      // lightning lights the world: the hemisphere, the moon and the skylight all jump with pl.flashV
      const fl = pl.flashV;
      this.lights.hemi.intensity += fl * 3.0; this.lights.moon.intensity += fl * 1.6;
      C.skyMat.color.set(fl > 0.2 ? '#9ab4ff' : '#1a2646'); C.skyMat.opacity = fl > 0.2 ? 0.55 : 0.85;
      C.exit.material.color.setScalar(0.5 + 0.5 * (Math.sin(t * 7) > -0.2 ? 1 : 0.2));
      this.paTalk = Math.max(0, this.paTalk - dt);
      C.paGlow(this.paTalk > 0, t);
      for (const s of this.shaftsCon) { const u = s.userData.mat.uniforms; if (pl.shotI < 10) u.uOpacity.value = (this.high ? 0.2 : 0.16) * (1 + fl * 2.5) * (0.85 + 0.15 * Math.sin(t * 1.7 + s.position.z)); }
      // shards, outside crowd
      if (this.shatterT >= 0) this.updateShards(sdt);
      for (const m of C.crowdSil) {
        const u = m.userData, go = Math.max(0, t - 20.42);
        if (go > 0) u.dz = (u.dz || 0) + u.v * sdt;
        m.position.z = u.z + (u.dz || 0); m.position.x = u.x;
        m.visible = pl.shotI <= 3 && m.position.z < DOOR_Z - 4;
        m.rotation.z = Math.sin(t * 3 + u.ph) * 0.06;
        m.position.y = 40 * u.s + Math.abs(Math.sin(t * 2.2 + u.ph)) * 2;
      }
      for (const z of this.zombies) this.stepZombie(z, dt, sdt, t);
    } else this.zombies.forEach((z) => { if (z.mode === 'ring') this.stepZombie(z, dt, sdt, t); });
    if (this.offG.visible) this.off.update(dt, t);
    for (const h of HEROES) { const b = this.bays[h.cls]; if (b.group.visible) b.h.update(dt, t); }
    for (const a of Object.values(this.heroes)) if (a.visible) a.update(dt);
    this.lights.update(dt, t);
    this.dust.update(dt, t);
    this.sparks.update(dt);
  }

  stepZombie(z, dt, sdt, t) {
    if (!z.a.visible) return;
    const C = this.con;
    if (z.mode === 'door') {
      const go = Math.max(0, t - 20.42 - z.d);
      if (go > 0) {
        if (!z.running) { z.running = true; z.a.loop(z.run ? 'Running_C' : 'Walking_D_Skeletons', z.run ? 1.1 : 1.8); }
        z.dz += z.v * sdt;
        z.a.root.position.z = z.z0 + z.dz;
        z.a.root.position.x = z.x * (1 - smooth(go / 1.4)) + (z.x > 0 ? 18 : -18) * smooth(go / 1.4) * (z.type === 'brute' ? 0.3 : 1);
      } else if (t > 11 && t < 20.3 && z.a.visible) {
        if (Math.floor(t * 0.9 + z.d * 7) % 3 === 0 && !z.hitAt) z.hitAt = t;
        if (z.hitAt && t - z.hitAt > 0.1 && !z.hit) { z.hit = true; z.a.play('Unarmed_Melee_Attack_Punch_A', { upper: true, timeScale: 1.5 }); }
        if (z.hitAt && t - z.hitAt > 1.4) { z.hit = false; z.hitAt = 0; }
      }
      if (z.a.root.position.z > 300) z.a.visible = false;
    }
    void C;
    // they stop. All at once. Then one of them throws itself at the glass.
    if (z.mode === 'door' && t >= 13.2 && t < 20.4) {
      if (z === this.zombies[2] && t >= 14.15) {
        if (!this.slammed) { this.slammed = true; z.a.play('Unarmed_Melee_Attack_Punch_A', { upper: true, timeScale: 1.3 }); }
        z.a.root.position.set(4, 0, DOOR_Z - 3);
      } else if (t < 14.15) return;
    }
    z.a.update(sdt);
  }

  updateShards(sdt) {
    const C = this.con, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    this.shatterT += sdt;
    C.shardData.forEach((s, i) => {
      s.v.y -= 380 * sdt; s.p.addScaledVector(s.v, sdt); s.r.addScaledVector(s.w, sdt);
      if (s.p.y < 1) { s.p.y = 1; s.v.y *= -0.25; s.v.x *= 0.7; s.v.z *= 0.7; s.w.multiplyScalar(0.6); }
      e.set(s.r.x, s.r.y, s.r.z); q.setFromEuler(e);
      const k = this.shatterT > 2.4 ? Math.max(0, 1 - (this.shatterT - 2.4) / 0.6) : 1;
      m4.compose(pos.copy(s.p), q, sc.setScalar(s.s * k));
      C.shards.setMatrixAt(i, m4);
    });
    C.shards.instanceMatrix.needsUpdate = true;
    if (this.shatterT > 3.1) C.shards.visible = false;
  }

  render() {
    const r = this.r3d.renderer;
    if (this.gate || !this.pl || this.t < 0.04) { r.setRenderTarget(null); r.setClearColor('#000000'); r.clear(); return; }
    this.pl.render();
  }

  // ---------------------------------------------------------------- what the hud draws

  view() {
    if (this.gate || !this.pl) return { gate: true, t: 0 };
    const v = this.pl.view();
    v.gate = false;
    if (this.t < 0) { // the studio card, its bulb dipping with the tube sound
      const age = this.t + PREROLL;
      v.studio = { a: Math.min(clamp01(age / 0.5), clamp01((-0.5 - this.t) / 0.6)), bulb: scriptedFail(this.t, [[-2.2, 0.12]]) * (0.9 + 0.1 * failing(this.t, 3, 0.85)) };
      v.flares = []; v.blood = null;
    }
    v.hint = this.t > 1.2 && this.t < 70.5 ? Math.min(1, (this.t - 1.2) / 1.0) * 0.62 : 0;
    return v;
  }
}
