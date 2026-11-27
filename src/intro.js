// The opening film of a story run, "Midnight Madness" (White Acre): 83 s, in engine, after hero select and before play.
// Everything is drawn and synthesized here and in the cine*.js files: no video, image or sound files. Skippable by any
// input, and it ends on a hard cut. It is preceded by the studio card (film time -3 .. 0, over black).
// Script: docs/OPENER_SCREENPLAY.md (its time codes are these plus 3 s). Story: STORY.md.
//
//   1  studio card                        9  12:01: the countdown, and the vents breathe
//   2  the oil field and Highway 99      10  the whole crowd folds to the floor
//   3  the lot: canisters up a ladder    11  title
//   4  the PA, and the food court        12  the Skater falls, and gets back up
//   5  Mall Cop: east doors, deadbolt    13  Action News 17, three minutes later
//   6  Biker: Dock B                     14  the call, and the cleanup convoy
//   7  Skater: "Champ"                   15  on the floor, a hand twitches
//   8  Mall Goth: order 1854             16  the four in the Security Room, up to a high view, cut
//
// This file says WHAT happens: the shot list, the lights per shot, the actors' actions and the audio cues. It is built on
// the cinema toolkit in src/cine*.js; the sets only it needs are in cineOpenerSets.js.
//
// main.js drives it: start({ gate }), update(dt), render(), view() for the hud overlay, press()/skip().
// Sound is cineAudio.js (Web Audio only). The PA is a wordless murmur under its ding; the caption carries the words.

import * as THREE from 'three';
import { cine } from './audio.js';
import { CinePlayer, dolly, crane, push, clamp01, smooth, mix } from './cineCore.js';
import { LightRig, makeShaft, DustField, disposeTree, canvasTex, scriptedFail, failing } from './cineFx.js';
import { makeHero, makeTrooper } from './cineStage.js';
import { buildConcourse, buildOffice, FOUNTAIN, OFFICE_X } from './cineSets.js';
import { buildExterior, buildKiosk, dressConcourse, dressOffice, CrowdField, crowdSpots, drawMallFeed, drawNewsFeed, EXT_X, KIOSK_X, DOCK } from './cineOpenerSets.js';
import { respirator } from './charProps.js';

export const INTRO_END = 83;
export const PREROLL = 3; // the studio card
const TITLE_AT = 50.8, TITLE_END = 53;

const COLORS = { PA: '#ffd89a', Radio: '#ffd89a', 'Action News 17': '#ffd89a', Biker: '#ff7a50', 'Mall Cop': '#6aa0ff', Skater: '#50e890', 'Mall Goth': '#d070ff' };
const CARDS = {
  mallCop: ['MALL COP', 'RANGED', 'Night security lead. Does it by the book.'],
  biker: ['BIKER', 'TANK', "Hauls what he's paid to. Never asks."],
  skater: ['SKATER', 'SPEED', 'Banned from this fountain. Here anyway.'],
  mallGoth: ['MALL GOTH', 'AOE', 'One-hour photo. Sees everything twice.'],
};
const HERO_COLOR = { biker: COLORS.Biker, mallCop: COLORS['Mall Cop'], skater: COLORS.Skater, mallGoth: COLORS['Mall Goth'] };
const FC = FOUNTAIN;
const OX = OFFICE_X, KX = KIOSK_X, EX = EXT_X, DX = DOCK[0];
const SKATE = [34, 0, 358];                       // where the Skater stands by the fountain
const FLOOR_HAND = [-24, 0, 470], FLOOR_FACE = [-34, 8, 446];
// the last shot's end pose: the gameplay camera's three-quarter high angle (camMath.gameplayPose) over the room's middle
const HIGH = { p: [OX, 238, 330], l: [OX, 6, 24] };

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
    this.dust = new DustField(scene, { n: high ? 160 : 60, box: [360, 190, 900], center: [0, 0, 0], color: '#bcc8ff', size: high ? 3 : 4, opacity: 0.4 });

    // sets
    const con = buildConcourse({ high }); this.con = con.h; scene.add(con.group); this.conG = con.group;
    this.hall = dressConcourse(con).h;
    const off = buildOffice({ chair: false }); this.off = off.h; scene.add(off.group); this.offG = off.group;
    this.officeRoof = off.group.children.filter((m) => m.isMesh && (m.position.y >= 104 || Math.abs(m.position.x) >= 124)); // lifted off for the high view
    this.room = dressOffice(off).h;
    for (const m of this.off.screens) { m.material.map = this.off.feedTex; m.material.color.set('#d0ffe8'); }
    // a lavender-and-gray checkerboard under the whole room, as in the game's Security Room (for the high view)
    const check = canvasTex(64, 64, (c) => { c.fillStyle = '#8a84a0'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#4c4870'; c.fillRect(0, 0, 32, 32); c.fillRect(32, 32, 32, 32); }, [14, 10]);
    this.hubFloor = new THREE.Mesh(new THREE.PlaneGeometry(900, 640).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: check, roughness: 0.4, metalness: 0.15 }));
    this.hubFloor.position.set(0, 0.4, 70); off.group.add(this.hubFloor);
    // the small CRT on the desk
    this.tvCanvas = document.createElement('canvas'); this.tvCanvas.width = 320; this.tvCanvas.height = 240;
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas); this.tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tv = new THREE.Group(); this.tv.position.set(-42, 52, -18); this.tv.rotation.y = 0.18; off.group.add(this.tv);
    this.tv.add(new THREE.Mesh(new THREE.BoxGeometry(42, 32, 20), new THREE.MeshLambertMaterial({ color: '#14141a' })));
    const tvFace = new THREE.Mesh(new THREE.PlaneGeometry(36, 27), new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false }));
    tvFace.position.z = 10.2; this.tv.add(tvFace);

    const ext = buildExterior({ high }); this.ext = ext.h; scene.add(ext.group); this.extG = ext.group;
    const kiosk = buildKiosk(); this.kiosk = kiosk.h; scene.add(kiosk.group); this.kioskG = kiosk.group;

    // the crowd in the food court, clear of the fountain, the Skater's spot and the camera's path down the middle
    const holes = [[0, FC[2], 102], [SKATE[0], SKATE[2] + 6, 52], [24, 430, 62], [10, 495, 62], [-36, 448, 66]];
    this.crowd = new CrowdField(con.group, crowdSpots(high ? 340 : 140, -164, 164, -640, 470, holes, 2));
    this.friends = new CrowdField(con.group, [[-4, 366, 1.1], [74, 350, -1.2], [66, 392, -2.4]]);

    this.shaftsCon = [];
    for (const [x, z] of high ? [[-30, 520], [40, 200], [-26, -120], [30, -440]] : [[30, 330], [-26, -100]]) {
      const s = makeShaft({ color: '#ffd8b0', len: 188, r0: 6, r1: 46, opacity: high ? 0.12 : 0.1 }); s.position.set(x, 188, z); this.conG.add(s); this.shaftsCon.push(s);
    }

    // cast: the four survivors and the cleanup crew (real game models)
    this.heroes = {};
    for (const k of Object.keys(CARDS)) { const a = makeHero(k); a.visible = false; scene.add(a.root); this.heroes[k] = a; }
    this.troopers = Array.from({ length: 4 }, () => { const a = makeTrooper(); a.visible = false; scene.add(a.root); return a; });
    this.mask = respirator(this.heroes.mallGoth.actor, 0.55);
    this.maskAt = this.mask ? { p: this.mask.position.clone() } : null;
    this.buildProps(scene);

    this.pl = new CinePlayer(r3d, scene, this.shots());
    this.pl.barIn = [-2, 2];
    this.pl.fadeFn = (t) => 1 - smooth((t - 0.1) / 1.1); // up from black only: it ends on a hard cut
    this.pl.titleAt = TITLE_AT;
    this.pl.titleEnd = TITLE_END;
    this.pl.grade = 'NIGHT_RAIN';
    this.script();
    this.warm();
  }

  // Small things in hands and on the floor: the pager's green screen, a photo envelope, a limp hand and a spilled bag.
  buildProps(scene) {
    const g = this.props = new THREE.Group(); scene.add(g);
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const mk = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    this.pager = new THREE.Group(); g.add(this.pager);
    mk(this.pager, new THREE.BoxGeometry(6, 4, 2), lam('#101216'), 0, 0, 0);
    mk(this.pager, new THREE.PlaneGeometry(4.4, 1.8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#60ff90').multiplyScalar(1.5), toneMapped: false }), 0, 0.5, 1.1);
    this.envelope = mk(g, new THREE.BoxGeometry(9, 6, 0.6), lam('#e0c068'), 0, 0, 0);
    // the hand on the checkerboard: palm, wrist and sleeve, and four fingers in two joints each
    const skin = lam('#a89a8c');
    this.hand = new THREE.Group(); this.hand.position.set(FLOOR_HAND[0], 1.8, FLOOR_HAND[2]); this.hand.rotation.y = -0.5; g.add(this.hand);
    mk(this.hand, new THREE.BoxGeometry(9, 2.8, 8), skin, 0, 0, 0);
    mk(this.hand, new THREE.CylinderGeometry(2.6, 3, 9, 10).rotateZ(Math.PI / 2), skin, -8, 0, 0);
    mk(this.hand, new THREE.CylinderGeometry(3.8, 4.4, 20, 10).rotateZ(Math.PI / 2), lam('#6a2a24'), -20, 0.8, 0);
    this.fingers = [-3.1, -1.05, 1.05, 3.1].map((z, i) => {
      const a = new THREE.Group(); a.position.set(4.2, 0, z); this.hand.add(a);
      mk(a, new THREE.CapsuleGeometry(0.95, 3.4, 3, 8).rotateZ(Math.PI / 2), skin, 2.4, 0, 0);
      const b = new THREE.Group(); b.position.set(4.8, 0, 0); a.add(b);
      mk(b, new THREE.CapsuleGeometry(0.85, 2.6, 3, 8).rotateZ(Math.PI / 2), skin, 2, 0, 0);
      return { a, b, ph: i * 1.3 };
    });
    mk(this.hand, new THREE.CapsuleGeometry(1.1, 4, 3, 8).rotateZ(Math.PI / 2), skin, 2, -0.2, -5.6).rotation.y = 0.7;
    this.bag = new THREE.Group(); this.bag.position.set(FLOOR_HAND[0] + 24, 5.5, FLOOR_HAND[2] - 10); this.bag.rotation.set(0, -0.5, 1.36); g.add(this.bag);
    mk(this.bag, new THREE.BoxGeometry(12, 19, 9), lam('#c8305a'), 0, 0, 0);
    mk(this.bag, new THREE.TorusGeometry(3.4, 0.4, 6, 12, Math.PI), lam('#e8dcc0'), 0, 9.6, 0);
    // the face just behind the hand, lying on its cheek: lids shut, then two cloudy eyes
    const face = new THREE.Group(); face.position.set(...FLOOR_FACE); face.rotation.set(-0.12, 0.3, 1.18); g.add(face);
    const ball = (parent, mat, r, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mk(parent, new THREE.SphereGeometry(r, 18, 14), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
    ball(face, skin, 7, 0, 0, 0, 0.9, 1.08, 0.92);
    ball(face, lam('#2a1c14'), 7.3, 0, 1.4, -1.5, 0.96, 1.06, 0.92);                  // hair
    ball(face, skin, 1.3, 0, -0.8, 6.5, 0.8, 1.2, 1);                                 // nose
    mk(face, new THREE.BoxGeometry(3.6, 0.8, 1), lam('#4a1c1c'), 0, -3.8, 5.6);       // mouth
    this.lids = []; this.eyes = [];
    for (const x of [-2.5, 2.5]) {
      this.lids.push(mk(face, new THREE.BoxGeometry(2.8, 0.5, 0.8), lam('#4a3a38'), x, 1.3, 6.3));
      const eye = ball(face, new THREE.MeshBasicMaterial({ color: new THREE.Color('#dce8c0').multiplyScalar(1.25), toneMapped: false }), 1.5, x, 1.4, 5.8, 1, 0.8, 0.6);
      ball(eye, new THREE.MeshBasicMaterial({ color: '#7a8a70', toneMapped: false }), 0.55, 0, 0, 1.35);
      this.eyes.push(eye);
    }
    mk(g, new THREE.CapsuleGeometry(7, 22, 4, 12).rotateZ(Math.PI / 2), lam('#2f4a6a'), FLOOR_FACE[0] - 24, 6.5, FLOOR_FACE[2] - 6).rotation.y = 0.35; // shoulders
    for (let i = 0; i < 3; i++) mk(g, new THREE.BoxGeometry(7, 4, 5), lam(['#2c7a74', '#e8c040', '#7a3a9a'][i]), FLOOR_HAND[0] + 30 + i * 6, 2, FLOOR_HAND[2] + 6 - i * 13).rotation.y = i * 1.2;
  }

  // Compile every shader up front (behind the black gate / fade-in) so no shot hitches when it first appears.
  warm() {
    const groups = [this.conG, this.offG, this.extG, this.kioskG, this.props, this.tv, this.hubFloor];
    const vis = groups.map((g) => g.visible);
    groups.forEach((g) => { g.visible = true; });
    const act = [...Object.values(this.heroes), ...this.troopers];
    const av = act.map((a) => a.visible); act.forEach((a) => { a.visible = true; });
    this.ext.heli.visible = true;
    this.pl.t = 0.01; this.pl.shotI = 0;
    try { this.r3d.renderer.compile(this.scene, this.pl.camera); this.pl.render(); } catch (e) { console.warn('intro warm-up failed', e); }
    groups.forEach((g, i) => { g.visible = vis[i]; });
    act.forEach((a, i) => { a.visible = av[i]; });
    this.ext.heli.visible = false;
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
    this.paTalk = 0;
    for (const a of [...Object.values(this.heroes), ...this.troopers]) {
      a.standUp();
      a.visible = false;
      a.root.rotation.set(0, 0, 0);
      a.root.scale.setScalar(a.baseScale);
      a.target.headYaw = a.target.headPitch = a.target.armR = a.target.armL = a.target.lean = a.target.twist = 0;
      a.resetActing();
    }
    this.crowd.cheer(0).fold(-1);
    this.friends.cheer(0).fold(-1);
  }

  // subtitles, name cards and every sound cue, laid on the timeline (seconds from the start)
  script() {
    const p = this.pl, at = (t, fn) => p.at(t, fn);
    const say = (a, b, who, text) => p.say(a, b, who, COLORS[who], text, 'line');
    // a page: the same two-note ding every time, then the calm wordless voice under the caption
    const page = (a, b, text, vol = 0.07) => {
      say(a, b, 'PA', text);
      at(a - 0.55, () => cine.paDing());
      at(a + 0.1, () => { cine.paMurmur(b - a - 0.4, vol); this.paTalk = b - a; });
    };
    const radio = (a, b, who, text) => { say(a, b, who, text); at(a - 0.12, () => cine.radioSquelch()); if (who === 'Radio') at(a, () => cine.paMurmur(b - a - 0.3, 0.05, 150)); };
    const card = (cls, a, b) => p.card(a, b, CARDS[cls][0], CARDS[cls][1], HERO_COLOR[cls], CARDS[cls][2]);

    // the studio card
    at(-2.9, () => { cine.studioCue(); cine.drone(15, 0.07); });
    at(-1.2, () => cine.pumpjack(7, 1.85));
    // 2 the oil field
    p.slate(0.8, 5.7, 'BAKERSFIELD, CALIFORNIA', 'THANKSGIVING NIGHT, 1994');
    at(0.1, () => cine.rain(5.5, 0.012)); // (the wind)
    // 3 the lot
    p.slate(6.3, 11.7, 'PARAGON CROSSING', 'BLACK FRIDAY · 11:58 PM');
    at(6.0, () => { cine.crowdWalla(6.2, 0.04); cine.drone(12, 0.085); });
    at(8.9, () => cine.hookClank(0));
    at(10.4, () => cine.hookClank(0));
    // 4 the PA and the food court
    at(12.0, () => { cine.crowdWalla(29.5, 0.055); cine.fryerSizzle(5, 0.03); });
    page(13.0, 16.8, 'Security, please confirm the east doors.');
    // 5 Mall Cop
    card('mallCop', 17.5, 20.6);
    radio(18.6, 20.7, 'Mall Cop', 'East doors. Confirmed.');
    at(21.5, () => cine.doorSlam(0.35));
    at(22.35, () => { cine.lockClunk(); p.shake(22.35, 2.5, 7); });
    at(22.6, () => cine.neonBuzz(4, 0.04));
    // 6 Biker
    card('biker', 23.8, 26.6);
    at(23.5, () => cine.backupBeeper(8));
    page(24.0, 26.9, 'Driver for Kern Valley, please pull to Dock B.', 0.035);
    at(25.2, () => cine.pagerChirp());
    say(27.0, 28.9, 'Biker', "Midnight pickup. Cash. Don't ask.");
    // 7 Skater
    card('skater', 29.3, 31.9);
    at(29.0, () => cine.rain(5.5, 0.016)); // (the fountain)
    page(29.5, 32.3, 'Paging Champ. Your party is at the fountain.');
    say(32.5, 34.4, 'Skater', "...Who still says 'champ'?");
    // 8 Mall Goth
    card('mallGoth', 35.0, 37.9);
    at(34.6, () => cine.printer(1.6));
    page(35.0, 38.0, 'Photo order 1854, please come to Guest Services.');
    say(38.2, 40.9, 'Mall Goth', "Nobody picks up a photo order at midnight.");
    at(39.2, () => cine.respirator());
    // 9 12:01
    p.slate(41.8, 45.3, '12:01 AM');
    at(41.0, () => cine.countdownRoar(5));
    at(43.0, () => { cine.ventExhale(6, 0.2); cine.drone(9, 0.08, 38.9); this.paTalk = 0; });
    // 10 the drop: the roar cuts dead, and only the thuds are left
    at(46.5, () => { cine.stopAll(); cine.neonBuzz(4.5, 0.035); for (let i = 0; i < 24; i++) cine.crowdThud(0.04 + i * 0.075 + (i % 5) * 0.03, 0.24 - i * 0.006); });
    at(47.5, () => { cine.bassDrop(); p.shake(47.5, 4, 3); });
    // 11 title: half a second of nothing, then it slams up, and one low held note
    at(50.2, () => cine.duck(0.55));
    at(TITLE_AT, () => { cine.titleSlam(); p.flashV = 0.5; });
    at(51.2, () => cine.synthNote());
    // 12 the Skater
    p.slate(53.4, 56.4, '12:04 AM');
    at(53.1, () => { cine.rain(5.4, 0.016); cine.neonBuzz(5, 0.03); });
    at(53.5, () => cine.cough());
    at(54.4, () => cine.bodyHit());
    at(55.0, () => cine.heartbeatRamp(14, 1.05, 0.72, 0.2));
    say(56.2, 58.4, 'Skater', 'Guys? ...Guys. Get up.');
    // 13 the news
    at(58.5, () => cine.neonBuzz(6, 0.03));
    at(58.8, () => cine.tvMurmur(2.7, 0.06));
    say(58.8, 61.5, 'Action News 17', 'A refinery leak. Stay indoors. Keep windows shut.');
    say(61.7, 64.4, 'Mall Cop', "Refinery's nine miles off. They knew in three minutes?");
    // 14 the call and the convoy
    at(64.4, () => { cine.rotor(6, 0.2); cine.drone(8, 0.07); });
    radio(64.8, 67.3, 'Radio', 'Vector Control base. How many survivors, Officer?');
    radio(67.45, 68.2, 'Mall Cop', 'Four.');
    radio(68.4, 70.4, 'Radio', 'Hold position. Help is coming.');
    at(66.9, () => { cine.doorSlam(0.3); });
    at(68.0, () => { cine.doorSlam(0.25); cine.whoosh(0.8, 0.1); });
    // 15 the floor: everything stops, then it breathes
    at(70.5, () => cine.stopAll());
    at(71.2, () => cine.gurgle());
    at(72.35, () => cine.neckCrack());
    at(72.95, () => { cine.stingHit(); p.shake(72.95, 6, 5); p.punch(72.95, 0.06); });
    // 16 the Security Room
    p.slate(74.1, 76.2, '12:09 AM');
    at(74.0, () => { cine.drone(10, 0.09); cine.monitorOn(); });
    at(74.2, () => cine.chainsawRev());
    say(74.8, 77.9, 'Skater', 'Four thousand dropped. Why are we four still standing?');
    say(78.1, 79.5, 'Biker', 'Ask later, dock rat.');
    page(79.8, 82.8, 'Shoppers, please remain where you are. Help is on the way.');
    at(80.4, () => cine.riser(2.4, 0.09));
    at(INTRO_END - 0.06, () => cine.stopAll()); // hard cut to silence on the last frame
  }

  // ---------------------------------------------------------------- the shot list

  shots() {
    const self = this;
    // which set is on (everything else, props and cast included, is put away)
    const show = (p, which, { near = 140, far = 1250, sky = '#05040b', fog = '#07060f' } = {}) => {
      self.conG.visible = which === 'con';
      self.offG.visible = which === 'off';
      self.extG.visible = which === 'ext';
      self.kioskG.visible = which === 'kiosk';
      self.props.visible = false;
      for (const o of self.props.children) o.visible = false;
      self.pager.visible = self.envelope.visible = false;
      self.tv.visible = false; self.hubFloor.visible = false;
      for (const m of [...self.officeRoof, self.room.door, self.room.doorway]) m.visible = true;
      for (const a of [...Object.values(self.heroes), ...self.troopers]) { a.standUp(); a.visible = false; a.resetActing(); a.look(0, 0, 8).raise('R', 0).raise('L', 0).lean(0); a.root.rotation.set(0, 0, 0); }
      self.dust.points.visible = which !== 'ext' && !!which;
      self.scene.fog.near = near; self.scene.fog.far = far; self.scene.fog.color.set(fog); self.scene.background.set(sky);
      self.shot = which;
    };
    // a survivor in this shot: where, which way, doing what; the weapon stays out of the quiet moments
    const hero = (cls, pos, yaw, anim, armed = false, speed = 1) => {
      const a = self.heroes[cls];
      a.visible = true; a.root.position.set(...pos); a.root.rotation.y = yaw; a.loop(anim, speed);
      const A = a.actor.aim;
      if (A && A.h) A.h.visible = armed;
      if (cls === 'mallGoth' && self.mask) self.mask.visible = false;
      return a;
    };
    const mallAmb = { sky: '#8a78a8', ground: '#2a1c28', hemi: 0.95, moon: 0.35, moonColor: '#ffd8c0' };
    const mallLights = (over = {}) => self.lights.set({ amb: mallAmb, key: ['#ffc890', [40, 150, 430], 230], rim: ['#ff4ab0', [-140, 100, 150], 230], fill: ['#40d8ff', [140, 90, -200], 200], fx: null, ...over }, true);
    const open = (over = {}) => {
      self.hall.haze = 0; self.crowd.cheer(0.12).fold(-1); self.crowd.meshes.forEach((m) => { m.visible = true; });
      self.friends.meshes.forEach((m) => { m.visible = false; });
      for (const b of self.hall.banners) b.visible = true;
      self.con.pa.visible = true;
      self.hall.setClock('3:00');
      mallLights(over);
    };
    const nightAmb = { sky: '#6a7ca8', ground: '#3a2a18', hemi: 1.05, moon: 0.55, moonColor: '#90a8e0' };
    const night = (p, over = {}, fog = {}) => {
      show(p, 'ext', { near: 600, far: 3200, sky: '#050914', fog: '#141a26', ...fog });
      self.ext.heli.visible = false; self.ext.tape.visible = false;
      for (const tk of self.ext.trucks) tk.visible = false;
      for (const c of self.ext.cars) c.g.visible = true;
      self.lights.set({ amb: nightAmb, key: ['#ffa040', [EX, 90, -360], 330], rim: ['#6a8aff', [EX + 460, 130, -300], 200], fill: null, fx: null, ...over }, true);
    };

    return [
      // ---- 2: the oil field, Highway 99, and one bright mall beyond it
      { id: 'field', dur: 6, fov: [48, 44], exposure: 1.1, bloom: 0.75,
        cam: crane([EX - 520, 350, 1080], [EX - 330, 250, 760], [EX - 300, 70, -200], [EX - 160, 60, -420], { ease: 'lin', hand: 0.12 }),
        enter(p) { night(p); } },
      // ---- 3: the queue at the doors; pan right to the dark side, where canisters are going up a ladder
      { id: 'lot', dur: 6, fov: [40, 36], exposure: 1.1,
        cam: dolly([EX + 40, 66, -40], [EX + 280, 70, -120], [EX - 10, 54, -420], [EX + 408, 64, -424], { ease: 'smoother', hand: 0.3 }),
        enter(p) {
          night(p, { rim: ['#9ac0ff', [EX + 440, 110, -340], 260], fill: ['#c8dcff', [EX + 396, 70, -360], 130] });
          [[EX + 372, -414, 2.7], [EX + 424, -410, -1.9]].forEach(([x, z, yaw], i) => { const a = self.troopers[i]; a.visible = true; a.root.position.set(x, 0, z); a.root.rotation.y = yaw; a.loop('Idle_Combat', 1); if (a.actor.aim) a.actor.aim.h.visible = false; });
        },
        tick(dt, lt) { for (let i = 0; i < 2; i++) { const k = 0.5 + 0.5 * Math.sin(lt * 2.6 + i * Math.PI); self.troopers[i].raise('R', 0.35 + 0.55 * k).raise('L', 0.35 + 0.55 * k).look(0, i ? 4 : 14 * k); } } },
      // ---- 4: from the PA speaker down into the packed food court
      { id: 'pa', dur: 5, fov: [40, 46],
        cam: crane([62, 154, 498], [14, 118, 548], [92, 150, 560], [-6, 56, -40], { ease: 'smoother', hand: 0.15 }),
        enter(p) { show(p, 'con'); self.dust.moveTo(0, 0, 200); open(); self.hall.banners[1].visible = false; } },
      // ---- 5: Mall Cop: answers the page, then shuts his own door and throws the bolt
      { id: 'cop', dur: 6.5, fov: [40, 37], grade: 'SICK_FLUOR',
        cam: dolly([OX + 34, 74, 206], [OX - 6, 70, 186], [OX - 6, 48, -6], [OX - 40, 48, 18], { ease: 'smooth', hand: 0.22 }),
        dof: { focus: [185, 165], aperture: 0.4 },
        enter(p) {
          show(p, 'off', { near: 200, far: 900 }); self.dust.moveTo(OX, 0, 0);
          self.lights.set({ amb: { sky: '#4a7a70', ground: '#10141c', hemi: 0.75, moon: 0, moonColor: '#101820' }, key: ['#a8ffd8', [OX - 10, 80, -20], 130], rim: ['#6a8ad0', [OX + 110, 90, 60], 130], fill: ['#ffe8c8', [OX - 20, 96, 130], 110], fx: null }, true);
          self.room.setDoor(1, 0);
          hero('mallCop', [OX + 2, 0, 18], 0.25, 'Idle_Combat').raise('L', 0.55).look(14, -4, 5);
          self.walking = false;
        },
        tick(dt, lt, k, p) {
          const a = self.heroes.mallCop, walk = clamp01((lt - 2.7) / 1.15);
          self.off.drawFeed(p.t, 0.2); drawMallFeed(self.off.feed.getContext('2d'), 320, 240, p.t, 'crowd'); self.off.feedTex.needsUpdate = true;
          if (walk > 0 && walk < 1) { if (!self.walking) { self.walking = true; a.raise('L', 0).look(0, 0); a.loop('Walking_A', 1.1); } a.root.rotation.y = -1.15; }
          else if (walk >= 1 && self.walking) { self.walking = false; a.loop('Idle_Combat', 1); }
          if (walk > 0) a.root.position.set(mix(OX + 2, OX - 88, walk), 0, mix(18, 60, walk));
          // the door swings to, and the bolt goes
          self.room.setDoor(1 - smooth((lt - 3.4) / 0.7), smooth((lt - 4.8) / 0.12));
          if (walk >= 1) { a.root.rotation.y = lt < 5.5 ? -1.4 : mix(-1.4, 1.5, smooth((lt - 5.5) / 0.7)); a.raise('R', lt > 4.2 && lt < 5.2 ? 0.8 : 0); }
        } },
      // ---- 6: Biker: out at Dock B under one sodium light, a pager, and a truck backing in
      { id: 'dock', dur: 5.5, fov: [40, 35],
        cam: dolly([DX + 52, 62, 150], [DX + 18, 60, 118], [DX + 4, 54, -26], [DX - 18, 62, -26], { hand: 0.3 }),
        dof: { focus: [170, 142], aperture: 0.7 }, grade: 'HERO_GRIT',
        enter(p) {
          night(p, { key: ['#ff9a30', [DX - 40, 134, 20], 330], rim: ['#6a8aff', [DX + 120, 90, -90], 200], fill: ['#c8d8ff', [DX + 110, 40, -10], 60] }, { near: 380, far: 1900 });
          hero('biker', [DX - 34, 22, -26], 0.55, 'Idle_Combat').raise('L', 0.6).look(10, -18, 8);
          self.props.visible = true; self.pager.visible = true;
        },
        tick(dt, lt) {
          const a = self.heroes.biker, back = smooth(lt / 4.6);
          if (lt > 2.4) a.look(40, 2, 3);
          const w = a.boneWorld('WristL'); self.pager.position.set(w.x + 1, w.y + 2, w.z + 3); self.pager.visible = lt < 4.4;
          self.ext.dockTruck.position.set(mix(330, 138, back), 0, -22);
          const on = back < 0.99 ? 1 : 0.6;
          for (const s of self.ext.reverse) s.material.opacity = 0.85 * on;
          self.lights.set({ fill: ['#e8f0ff', [DX + mix(262, 72, back), 34, -4], 60 + 190 * back] });
        } },
      // ---- 7: Skater: laughing on the fountain's edge until the page says one word
      { id: 'fountain', dur: 5.5, fov: [36, 30],
        cam: push([4, 56, 524], [24, 52, 478], [32, 42, 358], [34, 46, 358], { hand: 0.35 }),
        dof: { focus: [166, 120], aperture: 0.9 },
        enter(p) {
          show(p, 'con'); self.dust.moveTo(0, 0, 330); open({ key: ['#ffd0a0', [SKATE[0] - 30, 100, SKATE[2] + 90], 170] });
          self.friends.meshes.forEach((m) => { m.visible = true; }); self.friends.cheer(0.45).fold(-1);
          hero('skater', SKATE, 0.15, 'Idle_Combat', true).look(-34, -2, 6);
        },
        tick(dt, lt) {
          const a = self.heroes.skater;
          if (lt < 0.9) a.breathe(1, 1.6).look(-34 + Math.sin(lt * 9) * 6, -2, 8);
          else if (lt < 2.5) { a.breathe(0); a.look(6, 28, 7); self.friends.cheer(0.45); } // straight up at the speaker
          else if (lt < 3.5) a.look(48, 0, 4);
          else a.look(-30, 0, 3);
        } },
      // ---- 8: Mall Goth: her own order number, and a respirator she already had under the counter
      { id: 'kiosk', dur: 6.5, fov: [36, 27],
        cam: push([KX + 18, 58, 128], [KX + 1, 50, 80], [KX - 3, 37, -4], [KX - 4, 40, -8], { hand: 0.18 }),
        dof: { focus: [137, 89], aperture: 0.7 },
        enter(p) {
          show(p, 'kiosk', { near: 240, far: 900 }); self.dust.moveTo(KX, 0, 40);
          self.lights.set({ amb: { sky: '#7a5a8a', ground: '#20101c', hemi: 0.8, moon: 0.2, moonColor: '#c090ff' }, key: ['#ffd8c0', [KX + 60, 90, 90], 140], rim: ['#ff2a18', [KX - 46, 80, -30], 190], fill: ['#9a6aff', [KX - 90, 60, 70], 90], fx: null }, true);
          hero('mallGoth', [KX - 4, 0, -8], 0.12, 'Idle_Combat').raise('R', 0.4).look(-6, -20, 6);
          self.props.visible = true; self.envelope.visible = true;
        },
        tick(dt, lt) {
          const a = self.heroes.mallGoth;
          const w = a.boneWorld('WristR'); self.envelope.position.set(w.x, w.y + 3, w.z + 2); self.envelope.rotation.set(-0.4, 0.2, 0.1); self.envelope.visible = lt < 3.6;
          if (lt > 1.2) a.look(-4, -26, 3);                 // down at the envelope in her hand
          if (lt > 2.6) a.look(22, 20, 3);                  // then up, toward the atrium
          if (lt > 3.7) a.raise('R', 0).raise('L', 0).lean(0.5).look(0, -18, 5);   // down under the counter
          if (lt > 4.5) a.lean(0.04).raise('L', 0.9).raise('R', 0.9).look(0, 0, 4);
          if (self.mask) self.mask.visible = lt > 4.7;
          if (lt > 5.4) a.raise('L', 0).raise('R', 0);
        } },
      // ---- 9: 12:01: arms up under the clock, then up to the vents
      { id: 'vents', dur: 4.5, fov: [50, 54],
        cam: crane([-34, 34, 506], [-22, 52, 470], [0, 82, 120], [34, 178, 160], { ease: 'slowIn', hand: 0.4 }),
        enter(p) { show(p, 'con'); self.dust.moveTo(0, 0, 150); open(); },
        tick(dt, lt) {
          self.crowd.cheer(0.4 + 0.6 * clamp01(lt / 1.6));
          const n = Math.max(0, 3 - Math.floor(lt / 0.75));
          self.hall.setClock(`0:0${n}`, n > 0 ? 1 : (Math.floor(lt * 8) % 2));
          self.hall.haze = smooth((lt - 2.0) / 1.8);
        } },
      // ---- 10: the drop
      { id: 'drop', dur: 5, fov: [50, 47],
        cam: crane([78, 174, 640], [62, 168, 610], [0, 6, 190], [0, 2, 210], { ease: 'out', hand: 0.06 }),
        enter(p) {
          show(p, 'con', { near: 260, far: 1400 }); self.dust.moveTo(0, 0, 200); open();
          self.hall.haze = 1; self.hall.setClock('0:00');
          self.con.pa.visible = false; // (the hero speaker hangs right in front of this lens)
          for (const b of self.hall.banners) b.visible = b.position.z < 0;
        },
        tick(dt, lt) {
          self.crowd.cheer(lt < 0.7 ? 1 : 0).fold(lt - 0.7, 0, 160, 330);
          self.hall.haze = 1 - 0.6 * smooth((lt - 2) / 2.5);
          self.lights.set({ key: ['#ffc890', [40, 150, 430], mix(230, 150, clamp01(lt / 3))] });
        } },
      // ---- 11: black, and the title
      { id: 'title', dur: 2.5, fov: [40, 40], cam: push([0, 80, 600], [0, 80, 600], [0, 80, 0]),
        enter(p) { show(p, null, { sky: '#000000' }); self.lights.set({ amb: { sky: '#000000', ground: '#000000', hemi: 0, moon: 0, moonColor: '#000000' }, key: null, rim: null, fill: null, fx: null }, true); } },
      // ---- 12: the fountain: he coughs, drops, and stands back up alone
      { id: 'up', dur: 5.5, fov: [40, 33],
        cam: push([-2, 66, 520], [16, 56, 484], [34, 22, 356], [34, 40, 356], { hand: 0.15 }),
        dof: { focus: [172, 132], aperture: 0.7 },
        enter(p) {
          show(p, 'con'); self.dust.moveTo(0, 0, 330);
          open({ key: ['#ffd0a0', [SKATE[0] - 30, 100, SKATE[2] + 90], 150] });
          self.hall.haze = 0.55; self.hall.setClock('0:00');
          self.crowd.cheer(0).fold(30);
          self.friends.meshes.forEach((m) => { m.visible = true; }); self.friends.cheer(0).fold(30);
          hero('skater', SKATE, 0.2, 'Idle_Combat').flinch(1);
          self.coughs = 0;
        },
        tick(dt, lt) {
          const a = self.heroes.skater;
          if (lt > 0.5 && self.coughs === 0) { self.coughs = 1; a.flinch(1.3).lean(0.55).look(0, -20, 8); }
          if (lt > 0.85 && self.coughs === 1) { self.coughs = 2; a.lean(0).fall(1.15); }
          if (lt > 2.2 && self.coughs === 2) { self.coughs = 3; a.getUp(0.85); }
          if (lt > 3.7) a.breathe(0.9, 0.8).look(0, -28, 3).raise('R', 0.55).raise('L', 0.55);   // his own hands
        } },
      // ---- 13: the Security Room: the station already has the story
      { id: 'news', dur: 6, fov: [38, 31], grade: 'SICK_FLUOR',
        cam: push([OX + 20, 70, 176], [OX - 6, 62, 130], [OX - 14, 52, -10], [OX - 16, 52, -10], { hand: 0.18 }),
        dof: { focus: [180, 136], aperture: 0.5 },
        enter(p) {
          show(p, 'off', { near: 200, far: 900 }); self.dust.moveTo(OX, 0, 0);
          self.lights.set({ amb: { sky: '#3a5a6a', ground: '#0a0e16', hemi: 0.55, moon: 0, moonColor: '#101820' }, key: ['#7aa8ff', [OX - 40, 62, 30], 150], rim: ['#4af0a0', [OX + 80, 80, -30], 130], fill: ['#ffe8c8', [OX + 20, 96, 110], 70], fx: null }, true);
          self.room.setDoor(0, 1);
          self.tv.visible = true;
          hero('mallCop', [OX + 20, 0, 8], -0.35, 'Idle_Combat', true).look(-38, -8, 5);
        },
        tick(dt, lt, k, p) {
          drawNewsFeed(self.tvCanvas.getContext('2d'), 320, 240, p.t); self.tvTex.needsUpdate = true;
          drawMallFeed(self.off.feed.getContext('2d'), 320, 240, p.t, 'still'); self.off.feedTex.needsUpdate = true;
          const a = self.heroes.mallCop;
          if (lt > 3.1) a.look(45, 4, 3);                         // the humming air unit
          if (lt > 4.3) a.look(-55, -4, 3).raise('L', 0.55);      // the deadbolt. His hand stops.
        } },
      // ---- 14: Highway 99: white trucks, amber beacons, no sirens, and the yellow helicopter
      { id: 'convoy', dur: 6, fov: [46, 42], exposure: 1.1, bloom: 0.8,
        cam: dolly([EX - 70, 78, 520], [EX + 60, 66, 470], [EX + 40, 76, 110], [EX + 130, 62, 110], { ease: 'lin', hand: 0.25 }),
        enter(p) {
          night(p, { key: ['#ffa018', [EX + 100, 100, 230], 300], rim: ['#c8d8ff', [EX + 260, 190, 60], 200] }, { near: 380, far: 2200 });
          for (const c of self.ext.cars) c.g.visible = false; // the highway is closed
          self.ext.heli.visible = true;
          for (const tk of self.ext.trucks) tk.visible = true;
          self.troopers.forEach((a) => { a.loop('Walking_A', 1); if (a.actor.aim) a.actor.aim.h.visible = true; });
        },
        tick(dt, lt) {
          self.ext.trucks.forEach((tk, i) => { const u = clamp01((lt - i * 0.12) / 2.7), e = 1 - (1 - u) ** 3; tk.position.set(mix(560 + i * 190, -130 + i * 135, e), 0, 126); tk.rotation.y = Math.PI; });
          self.troopers.forEach((a, i) => {
            const u = clamp01((lt - 2.6 - i * 0.22) / 2.6);
            a.visible = u > 0;
            a.root.position.set(EX - 90 + i * 104 + (i % 2 ? 18 : -12) * u, 0, 156 + u * (62 + (i % 2) * 30));
            a.root.rotation.y = (i % 2 ? 0.35 : -0.3);
            if (u >= 1) a.loop('Idle_Combat', 1);
          });
          const grow = clamp01((lt - 3.6) / 1.8);
          self.ext.tape.visible = grow > 0.01;
          self.ext.tape.scale.x = Math.max(0.01, grow * 340); self.ext.tape.position.set(-170 + grow * 170 + 20, 24, 236);
          const h = self.ext.heli;
          h.position.set(mix(-420, 520, lt / 6), 196 - Math.sin(lt / 6 * Math.PI) * 24, 30);
          h.rotation.z = -0.1;
          self.ext.spot.rotation.set(Math.sin(lt * 1.1) * 0.35, 0, 0.25 + Math.sin(lt * 1.7) * 0.4);
        } },
      // ---- 15: down on the checkerboard: fingers, then eyes
      { id: 'floor', dur: 3.5, fov: [34, 28],
        cam: push([-2, 20, 534], [-16, 16, 520], [-34, 5, 458], [-40, 7, 446], { hand: 0.1 }),
        dof: { focus: [66, 92], aperture: 1.8, from: 0.4, to: 0.66 },
        enter(p) {
          show(p, 'con'); self.dust.moveTo(-30, 0, 450);
          open({ key: ['#a8d8c8', [-10, 44, 500], 90], rim: ['#ff4ab0', [-90, 36, 400], 150], fill: ['#40d8ff', [60, 30, 420], 90] });
          self.hall.haze = 0.35; self.crowd.cheer(0).fold(30);
          self.props.visible = true; for (const o of self.props.children) o.visible = true; self.pager.visible = self.envelope.visible = false;
          for (const e of self.eyes) e.visible = false;
        },
        tick(dt, lt) {
          for (const e of self.eyes) e.visible = lt > 2.4;
          for (const l of self.lids) l.visible = lt <= 2.4;
          const twitch = lt > 0.7 && lt < 1.7 ? Math.max(0, Math.sin(lt * 23)) * (Math.sin(lt * 7) > -0.3 ? 1 : 0) : 0;
          const grip = smooth((lt - 1.7) / 0.45);
          for (const f of self.fingers) {
            const t1 = twitch * (0.5 + 0.5 * Math.sin(lt * 17 + f.ph));
            f.a.rotation.z = t1 * 0.35 - grip * 0.55 + grip * 0.1 * Math.sin(f.ph);
            f.b.rotation.z = -t1 * 0.5 - grip * 1.15;
          }
          self.hand.position.y = 1.8 + grip * 1.4;
          if (lt > 2.4) self.lights.set({ fx: ['#ff3020', [FLOOR_FACE[0] + 8, 14, FLOOR_FACE[2] + 16], 40] });
        } },
      // ---- 16: all four, then up and back to a locked high view, and the hard cut to play
      { id: 'room', dur: 9, fov: [40, 42], grade: 'HERO_GRIT',
        cam: { hand: 0, seq: [
          { to: 0.26, ...dolly([OX + 24, 66, 224], [OX + 8, 66, 212], [OX - 6, 42, 12], [OX - 6, 42, 12], { hand: 0.2 }) },
          { to: 0.83, ...crane([OX + 8, 66, 212], HIGH.p, [OX - 6, 42, 12], HIGH.l, { ease: 'smoother', hand: 0 }) },
          { to: 1, ...crane(HIGH.p, HIGH.p, HIGH.l, HIGH.l, { hand: 0 }) },
        ] },
        enter(p) {
          show(p, 'off', { near: 520, far: 1300, sky: '#0a0618', fog: '#140c2a' }); self.dust.moveTo(OX, 0, 40);
          self.lights.set({ amb: { sky: '#a898d8', ground: '#241c38', hemi: 1.05, moon: 0.35, moonColor: '#b0a0ff' }, key: ['#d8d0ff', [OX + 10, 150, 110], 230], rim: ['#4af0a0', [OX, 90, -40], 140], fill: ['#ffb070', [OX - 110, 70, 100], 100], fx: null }, true);
          self.room.setDoor(0, 1);
          self.hubFloor.visible = true;
          hero('mallCop', [OX - 32, 0, -4], 0.35, '2H_Melee_Idle', true).look(-10, 0);
          hero('biker', [OX - 76, 0, 52], 0.75, '2H_Melee_Idle', true);
          hero('mallGoth', [OX + 52, 0, 12], -0.5, 'Idle_Combat', true).raise('R', 0.2);
          hero('skater', [OX + 8, 0, 60], -0.15, '2H_Melee_Idle', true);
          if (self.mask) self.mask.visible = true;
        },
        tick(dt, lt, k, p) {
          drawMallFeed(self.off.feed.getContext('2d'), 320, 240, p.t, 'rise', clamp01(lt / 7.5)); self.off.feedTex.needsUpdate = true;
          for (const m of [...self.officeRoof, self.room.door, self.room.doorway]) m.visible = lt < 2.9; // the roof and side walls come away as the camera climbs
          const g = self.heroes.mallGoth, s = self.heroes.skater, b = self.heroes.biker;
          if (lt > 0.35 && lt < 1.3) b.raise('R', 0.55).lean(0.2); else b.raise('R', 0).lean(0);
          if (lt > 1.4 && !self.revved) { self.revved = true; b.play('2H_Melee_Attack_Chop', { upper: true, timeScale: 1.2 }); }
          if (lt < 0.2) self.revved = false;
          // she pulls the respirator down to her neck
          if (self.mask && lt > 1.8) { g.raise('L', lt < 2.7 ? 0.8 : 0); const u = smooth((lt - 2.0) / 0.5); self.mask.position.y = self.maskAt.p.y - u * 0.0016; }
          else if (self.mask) self.mask.position.copy(self.maskAt.p);
          if (lt > 0.8 && lt < 4) s.look(-24, 4, 3); else s.look(0, 8, 3);
        } },
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
    const t = this.t;
    this.paTalk = Math.max(0, this.paTalk - dt);
    if (this.conG.visible) {
      this.con.update(dt, t);
      this.con.paGlow(this.paTalk > 0, t);
      this.hall.update(dt, t);
      this.crowd.update(t);
      this.friends.update(t);
    }
    if (this.offG.visible) { this.off.update(dt, t); this.room.update(dt, t); }
    if (this.extG.visible) this.ext.update(dt, t);
    if (this.kioskG.visible) this.kiosk.update(dt, t);
    for (const a of [...Object.values(this.heroes), ...this.troopers]) if (a.visible) a.update(dt);
    this.lights.update(dt, t);
    this.dust.update(dt, t);
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
    if (this.t < 0) { // the studio card, with a projector bulb's flicker
      const age = this.t + PREROLL;
      v.studio = { a: Math.min(clamp01(age / 0.5), clamp01((-0.3 - this.t) / 0.5)), bulb: scriptedFail(this.t, [[-1.5, 0.12]]) * (0.9 + 0.1 * failing(this.t, 3, 0.85)) };
      v.flares = []; v.blood = null; v.fade = 0;
    }
    v.hint = this.t > 1.2 && this.t < INTRO_END - 4 ? Math.min(1, (this.t - 1.2) / 1.0) * 0.62 : 0;
    return v;
  }
}
