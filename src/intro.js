// The opening cinematic: ~38 seconds, in engine, before the title screen. Skippable by any input.
//
//   black + a 90s mall PA chime and a distorted "doors are open" announcement -> a slow dolly down a dark,
//   rain-lashed mall past a broken escalator -> a security monitor glitches -> the dead hammer on
//   the glass doors until they shatter and the horde floods in -> four quick hero shots (Biker's
//   chainsaw, Mall Cop's shotgun, Skater's drop-in, Mall Goth's hairspray torch) with name cards
//   -> MALL OF THE DEAD slams in and the title screen takes over.
//
// It has its own small scene (a procedural corridor, doors, escalator, monitor, rain-on-glass, a dark
// hero stage) so nothing about the real level has to be built at title time. The survivors and zombies
// are the real CC0 models (Actor), with their real weapons. Every sound comes from cineAudio.js
// (Web Audio only); the PA voice is the browser's speech voice, pushed low and slow, with a caption.
//
// main.js drives it: start({ gate }), update(dt), render(), view() for the hud overlay, press()/skip().

import * as THREE from 'three';
import { VIEW_W, VIEW_H } from './config.js';
import { Actor } from './assets.js';
import { HERO_STYLE, ENEMY_STYLE } from './render3d.js';
import { neonSignTexture } from './mall3d.js';
import { glowTexture, glowSprite } from './models.js';
import { cine, paSpeak } from './audio.js';

export const INTRO_END = 38.2;
const HERO_Z = 1600;       // the dark hero stage sits behind the start of the corridor
const DOOR_Z = -1300;      // the glass doors at the far end
const T_LIGHT_ON = 4.2;    // the picture comes up out of black

// ----- little helpers -----
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Camera segments, in real intro seconds. p = position, l = look-at, f = fov. `e`: 'lin' | 'smooth' | 'in' (a slow start that accelerates).
const SEGS = [
  { a: 4.2, b: 8.6, p0: [0, 60, 780], p1: [0, 56, 200], l0: [0, 62, -520], l1: [0, 62, -520], f0: 54, f1: 49, e: 'lin', hand: 0.5 },
  { a: 8.6, b: 11.0, p0: [0, 56, 200], p1: [-26, 60, -150], l0: [0, 62, -520], l1: [-120, 70, -420], f0: 49, f1: 44, e: 'smooth', hand: 0.5 },
  // the security monitor: a slow push onto the glowing screen
  { a: 11.0, b: 15.0, p0: [78, 71, -262], p1: [110, 71, -328], l0: [134, 69, -382], l1: [134, 69, -382], f0: 34, f1: 23, e: 'smooth', hand: 0.25 },
  // the doors: low, creeping, a little Dutch
  { a: 15.0, b: 19.0, p0: [0, 24, -1030], p1: [0, 30, -1092], l0: [0, 52, -1300], l1: [0, 50, -1300], f0: 44, f1: 38, e: 'lin', roll: 0.04, hand: 0.7 },
  // the shatter: yanked back and up as the horde pours through
  { a: 19.0, b: 21.2, p0: [0, 30, -1092], p1: [0, 100, -838], l0: [0, 48, -1300], l1: [0, 40, -1020], f0: 38, f1: 56, e: 'in', hand: 1.1 },
  // the survivors (Biker, Mall Cop, Skater, Mall Goth), one after another on the dark stage
  { a: 21.2, b: 24.0, p0: [0, 14, HERO_Z + 134], p1: [12, 30, HERO_Z + 100], l0: [0, 34, HERO_Z], l1: [0, 46, HERO_Z], f0: 36, f1: 33, e: 'smooth', hand: 0.3 },
  { a: 24.0, b: 26.6, p0: [-46, 50, HERO_Z + 116], p1: [-22, 50, HERO_Z + 84], l0: [0, 46, HERO_Z], l1: [0, 50, HERO_Z], f0: 34, f1: 32, e: 'smooth', roll: 0.14, roll1: 0.11, hand: 0.3 },
  { a: 26.6, b: 29.2, p0: [0, 118, HERO_Z + 140], p1: [0, 42, HERO_Z + 108], l0: [0, 52, HERO_Z], l1: [0, 44, HERO_Z], f0: 38, f1: 36, e: 'smooth', hand: 0.3 },
  { a: 29.2, b: 32.0, orbit: { r: 104, a0: -0.55, a1: 0.5, y0: 46, y1: 50 }, l0: [0, 46, HERO_Z], l1: [0, 46, HERO_Z], f0: 32, f1: 32, e: 'smooth', hand: 0.3 },
  // all four, back to back, as the dead close in; then the title
  { a: 32.0, b: 33.4, p0: [0, 34, HERO_Z + 250], p1: [0, 96, HERO_Z + 310], l0: [0, 42, HERO_Z], l1: [0, 52, HERO_Z], f0: 42, f1: 44, e: 'smooth', hand: 0.3 },
  { a: 33.4, b: 99, p0: [0, 96, HERO_Z + 310], p1: [0, 92, HERO_Z + 290], l0: [0, 52, HERO_Z], l1: [0, 50, HERO_Z], f0: 44, f1: 42, e: 'lin', hand: 0.3 },
];

// camera shakes: [time, strength]; each dies away over about a second
const SHAKES = [[6.2, 1.5], [14.2, 4], [15.6, 6], [16.8, 8], [17.6, 9], [18.2, 10], [19.0, 14], [21.4, 2.5], [24.65, 3], [27.15, 6], [29.6, 2], [33.4, 16]];
// lightning strikes (a double strobe each)
const LIGHTNING = [6.2, 15.2, 27.0];
const SLAMS = [15.6, 16.8, 17.6, 18.2];   // the dead hit the glass; each one adds a crack stage

const HEROES = [
  { cls: 'biker', name: 'BIKER', role: 'TANK', color: '#ff7a50', a: 21.2, b: 24.0 },
  { cls: 'mallCop', name: 'MALL COP', role: 'RANGED', color: '#6aa0ff', a: 24.0, b: 26.6 },
  { cls: 'skater', name: 'SKATER', role: 'SPEED', color: '#50e890', a: 26.6, b: 29.2 },
  { cls: 'mallGoth', name: 'MALL GOTH', role: 'AOE', color: '#d070ff', a: 29.2, b: 32.0 },
];

const PA_LINES = [
  { text: 'ATTENTION, SHOPPERS.', a: 1.7, b: 3.0 },
  { text: 'OUR DOORS ARE NOW OPEN. ENJOY THE SAVINGS.', a: 3.1, b: 5.7 },
];

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
    if (!this.built) this.build();
    this.active = true;
    this.done = false;
    this.gate = !!gate;
    this.t = 0;
    this.evI = 0;
    this.crack = 0;
    this.slamPulse = 0;
    this.flashV = 0;
    this.lightningQ = LIGHTNING.slice();
    this.shatterT = -1;
    this.sparkT = 0;
    this.strobe = 0; this.rev = 0; this.flameT = 0; this.titleHit = 0;
    this.evs = this.events();
    this.glass.visible = true; this.cracks.visible = true; this.shards.visible = false;
    this.pool.pos.fill(0);
    this.pool.life.fill(0);
    this.resetActors();
    this.drawCrack();
    if (!this.gate) this.begin();
  }

  begin() { this.gate = false; this.t = 0; this.evI = 0; }

  // Any button / tap while the gate is up starts the show; afterwards it skips.
  press() {
    if (!this.active || this.done) return 'none';
    if (this.gate) { this.begin(); return 'begin'; }
    if (this.t < 0.35) return 'none';
    this.finish();
    return 'skip';
  }

  finish() {
    this.done = true;
    this.active = false;
    for (const g of [this.corridor, this.stage]) g.visible = false;
  }

  // ---------------------------------------------------------------- build

  build() {
    this.built = true;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#05040b');
    scene.fog = new THREE.Fog('#07060f', 140, 1150);
    this.camera = new THREE.PerspectiveCamera(50, VIEW_W / VIEW_H, 4, 3200);

    // lights: a cold hemisphere, a moon through the skylights, a soft light riding the camera, two rim lights and a red/spark one
    this.hemi = new THREE.HemisphereLight('#3a4a8a', '#0a0814', 0.5);
    this.moon = new THREE.DirectionalLight('#7088ff', 0.3);
    this.moon.position.set(-80, 400, 200);
    this.camLight = new THREE.PointLight('#8fb8ff', 55, 420, 1);
    this.rimA = new THREE.PointLight('#ff7a20', 0, 320, 1);
    this.rimB = new THREE.PointLight('#4a8aff', 0, 320, 1);
    this.fxLight = new THREE.PointLight('#ff2a1a', 0, 520, 1);
    scene.add(this.hemi, this.moon, this.camLight, this.rimA, this.rimB, this.fxLight);

    this.corridor = new THREE.Group();
    this.stage = new THREE.Group();
    scene.add(this.corridor, this.stage);
    this.buildCorridor(this.corridor);
    this.buildDoors(this.corridor);
    this.buildEscalator(this.corridor);
    this.buildMonitor(this.corridor);
    this.buildStage(this.stage);
    this.buildPool(scene);
    this.buildActors();
  }

  buildCorridor(g) {
    const W = 180;
    // terrazzo floor, wet enough to catch the neon
    const tile = canvasTex(128, 128, (c) => {
      c.fillStyle = '#1b1830'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#272342'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(150,160,220,${0.04 + hash(i) * 0.07})`; c.fillRect(hash(i + 3) * 128, hash(i + 9) * 128, 1 + hash(i + 5) * 3, 1 + hash(i + 7) * 2); }
    }, [W * 2 / 64, 2300 / 64]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 2300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.22, metalness: 0.25 }));
    floor.position.set(0, 0, -250);
    g.add(floor);
    const dark = new THREE.MeshLambertMaterial({ color: '#16122a' });
    // ceiling: dark side strips and a long skylight with rain running down it
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(W - 90, 2300).rotateX(Math.PI / 2), dark);
      strip.position.set(s * (90 + (W - 90) / 2), 190, -250);
      g.add(strip);
    }
    const rainTex = canvasTex(128, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = hash(i) * w, y = hash(i + 50) * h, l = 20 + hash(i + 9) * 60;
        const gr = c.createLinearGradient(0, y, 0, y + l);
        gr.addColorStop(0, 'rgba(180,200,255,0)'); gr.addColorStop(0.7, 'rgba(180,200,255,0.55)'); gr.addColorStop(1, 'rgba(230,240,255,0.9)');
        c.fillStyle = gr; c.fillRect(x, y, 1.5, l);
        c.fillStyle = 'rgba(210,225,255,0.8)'; c.beginPath(); c.arc(x + 0.7, y + l, 2.2, 0, Math.PI * 2); c.fill();
      }
    }, [3, 24]);
    this.skyMat = new THREE.MeshBasicMaterial({ color: '#1a2646', transparent: true, opacity: 0.8 });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(180, 2300).rotateX(Math.PI / 2), this.skyMat);
    sky.position.set(0, 191, -250);
    this.rainMat = new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(180, 2300).rotateX(Math.PI / 2), this.rainMat);
    rain.position.set(0, 189.5, -250);
    this.rainTex = rainTex;
    g.add(sky, rain);
    const beamMat = new THREE.MeshLambertMaterial({ color: '#0e0b1c' });
    for (let z = 700; z > -1300; z -= 160) { const b = new THREE.Mesh(new THREE.BoxGeometry(190, 8, 12), beamMat); b.position.set(0, 186, z); g.add(b); }

    // storefronts down both sides, each with a neon sign, a half-shuttered window and a dim glow inside
    this.signs = [];
    this.neon = [];
    const names = [['PIZZA', '#ff5a2a'], ['BURGERS', '#ff2ea6'], ['ARCADE', '#2ee6ff'], ['TACO', '#ffcc33'], ['SHOES', '#b070ff'], ['SALE', '#ff3a3a'], ['SMOOTHIES', '#40ffb0'], ['BOOKS', '#6aa0ff'], ['GAMES', '#ff9a30'], ['CINEMA', '#ff2ea6']];
    const wallMat = new THREE.MeshLambertMaterial({ color: '#1a1530' });
    const shutterTex = canvasTex(64, 64, (c) => { c.fillStyle = '#3a3848'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 6) { c.fillStyle = '#23212e'; c.fillRect(0, y, 64, 2); } }, [3, 3]);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 190, 2300), wallMat);
      wall.position.set(side * (W + 5), 95, -250);
      g.add(wall);
      for (let k = 0; k < 9; k++) {
        const z = 640 - k * 230;
        const [name, color] = names[(k + (side > 0 ? 3 : 0)) % names.length];
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(112, 35), new THREE.MeshBasicMaterial({ map: neonSignTexture(name, color), toneMapped: false }));
        sign.position.set(side * (W - 0.5), 136, z);
        sign.rotation.y = -side * Math.PI / 2;
        g.add(sign);
        this.signs.push({ mat: sign.material, seed: k * 3 + side * 7, base: 1, dying: k % 3 === 1 });
        // window glow, shutter pulled most of the way down
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(150, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        glow.position.set(side * (W - 1), 52, z);
        glow.rotation.y = -side * Math.PI / 2;
        g.add(glow);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(150, 50 + hash(k + side) * 22), new THREE.MeshLambertMaterial({ map: shutterTex }));
        const sh0 = 50 + hash(k + side) * 22;
        sh.position.set(side * (W - 1.5), 94 - sh0 / 2, z);
        sh.rotation.y = -side * Math.PI / 2;
        g.add(sh);
        // spill of neon on the floor
        const spill = new THREE.Mesh(new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        spill.position.set(side * (W - 70), 0.6, z);
        g.add(spill);
        this.neon.push({ mat: spill.material, seed: k + 20 * side });
      }
    }
    // ceiling tubes, a couple of them dying
    for (const side of [-1, 1]) for (let z = 640; z > -1250; z -= 190) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 110), new THREE.MeshBasicMaterial({ color: side > 0 ? '#9ad8ff' : '#ff9ad8', toneMapped: false }));
      tube.position.set(side * 70, 184, z);
      g.add(tube);
      this.neon.push({ mat: tube.material, seed: z * 0.013 + side, tube: true, c: new THREE.Color(side > 0 ? '#9ad8ff' : '#ff9ad8') });
    }
    // set dressing: benches, planters and a toppled bin, to give the dolly something to pass
    const benchMat = new THREE.MeshLambertMaterial({ color: '#2c2640' }), leaf = new THREE.MeshLambertMaterial({ color: '#173a2a' }), pot = new THREE.MeshLambertMaterial({ color: '#3a2a3a' });
    for (let k = 0; k < 8; k++) {
      const z = 560 - k * 250 + hash(k) * 40, x = (k % 2 ? 1 : -1) * (62 + hash(k + 4) * 30);
      if (k % 3 === 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 18), benchMat); b.position.set(x, 18, z); const l = new THREE.Mesh(new THREE.BoxGeometry(70, 20, 4), benchMat); l.position.set(x, 28, z + 8 * Math.sign(-x)); g.add(b, l); }
      else { const p = new THREE.Mesh(new THREE.CylinderGeometry(14, 10, 22, 8), pot); p.position.set(x, 11, z); const f = new THREE.Mesh(new THREE.ConeGeometry(18, 46, 7), leaf); f.position.set(x, 44, z); f.rotation.z = hash(k) * 0.3 - 0.15; g.add(p, f); }
    }
  }

  buildDoors(g) {
    const W = 180;
    const wallMat = new THREE.MeshLambertMaterial({ color: '#16122a' });
    // the end wall with a wide opening for the double glass doors
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(W - 100, 190, 14), wallMat); w.position.set(s * (100 + (W - 100) / 2), 95, DOOR_Z - 7); g.add(w); }
    const DH = 96; // door height
    const header = new THREE.Mesh(new THREE.BoxGeometry(200, 190 - DH, 14), wallMat); header.position.set(0, DH + (190 - DH) / 2, DOOR_Z - 7); g.add(header);
    const frameMat = new THREE.MeshLambertMaterial({ color: '#0c0a16' });
    for (const x of [-100, 0, 100]) { const f = new THREE.Mesh(new THREE.BoxGeometry(7, DH, 10), frameMat); f.position.set(x, DH / 2, DOOR_Z); g.add(f); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(200, 7, 10), frameMat); bar.position.set(0, DH, DOOR_Z); g.add(bar);
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(46, 14), new THREE.MeshBasicMaterial({ map: canvasTex(128, 40, (c, w, h) => { c.fillStyle = '#200406'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff2a2a'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EXIT', w / 2, h / 2 + 2); }), toneMapped: false }));
    exit.position.set(0, DH + 14, DOOR_Z + 6);
    g.add(exit);
    this.exitSign = exit;
    // the night outside: a sodium-red glow, rain, and the dead
    const back = new THREE.Mesh(new THREE.PlaneGeometry(900, 330), new THREE.MeshBasicMaterial({ map: canvasTex(8, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#12040a'); gr.addColorStop(0.55, '#7a1a1c'); gr.addColorStop(0.85, '#d85a2a'); gr.addColorStop(1, '#3a0e0a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), toneMapped: false, fog: false }));
    back.position.set(0, 120, DOOR_Z - 260);
    g.add(back);
    const glassMat = new THREE.MeshPhongMaterial({ color: '#8fb8d8', transparent: true, opacity: 0.16, shininess: 120, specular: '#ffffff', depthWrite: false });
    this.glass = new THREE.Group();
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(94, DH - 5), glassMat); p.position.set(s * 49, DH / 2, DOOR_Z + 1); this.glass.add(p); }
    g.add(this.glass);
    this.crackCanvas = document.createElement('canvas');
    this.crackCanvas.width = this.crackCanvas.height = 512;
    this.crackTex = new THREE.CanvasTexture(this.crackCanvas);
    this.crackTex.colorSpace = THREE.SRGBColorSpace;
    this.cracks = new THREE.Mesh(new THREE.PlaneGeometry(196, DH), new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.cracks.position.set(0, DH / 2, DOOR_Z + 1.6);
    g.add(this.cracks);
    // rain falling outside, caught in the red glow
    const N = 260, rp = new Float32Array(N * 6);
    this.outRain = { pos: rp, n: N };
    for (let i = 0; i < N; i++) { const x = (hash(i) - 0.5) * 420, y = hash(i + 40) * 190, z = DOOR_Z - 6 - hash(i + 80) * 220; rp.set([x, y, z, x - 2, y - 14, z], i * 6); }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.outRainMesh = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#ffb0a0', transparent: true, opacity: 0.4, fog: false }));
    this.outRainMesh.frustumCulled = false;
    g.add(this.outRainMesh);
    // the dead behind the glass: dark figures against the glow (cheap billboards) ...
    this.silTex = canvasTex(64, 128, (c) => {
      c.fillStyle = '#05010a';
      c.beginPath(); c.arc(32, 22, 11, 0, Math.PI * 2); c.fill();                       // head
      c.beginPath(); c.moveTo(20, 34); c.lineTo(44, 34); c.lineTo(48, 96); c.lineTo(16, 96); c.closePath(); c.fill(); // torso
      c.lineWidth = 7; c.strokeStyle = '#05010a'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(22, 40); c.lineTo(6, 12); c.moveTo(42, 40); c.lineTo(60, 8); c.stroke();                    // reaching arms
      c.lineWidth = 9; c.beginPath(); c.moveTo(26, 94); c.lineTo(22, 126); c.moveTo(38, 94); c.lineTo(44, 126); c.stroke(); // legs
    });
    this.horde = [];
    const silMat = new THREE.MeshBasicMaterial({ map: this.silTex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const silGeo = new THREE.PlaneGeometry(40, 80);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(silGeo, silMat);
      m.userData = { x: (hash(i + 1) - 0.5) * 330, z: DOOR_Z - 24 - hash(i + 7) * 190, s: 0.8 + hash(i + 3) * 0.5, ph: hash(i + 11) * 6, v: 110 + hash(i + 13) * 130 };
      m.position.set(m.userData.x, 40 * m.userData.s, m.userData.z);
      m.scale.setScalar(m.userData.s);
      g.add(m);
      this.horde.push(m);
    }
    // shards: one instanced mesh of glass triangles
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3, -2, 0, 3, -2, 0, 0, 4.5, 0]), 3));
    sg.computeVertexNormals();
    this.shardN = 96;
    this.shards = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), this.shardN);
    this.shards.frustumCulled = false;
    this.shards.visible = false;
    this.shardData = [];
    for (let i = 0; i < this.shardN; i++) this.shardData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 });
    g.add(this.shards);
  }

  buildEscalator(g) {
    const grp = new THREE.Group();
    grp.position.set(-118, 0, -330);
    const rise = 104, len = 300, ang = Math.atan2(rise, len);
    const stepMat = new THREE.MeshLambertMaterial({ color: '#3a3a4a' }), edge = new THREE.MeshLambertMaterial({ color: '#c8a030' });
    const sideMat = new THREE.MeshLambertMaterial({ color: '#15131f' });
    const NST = 16;
    for (let i = 0; i < NST; i++) {
      if (i === 5 || i === 6 || i === 11) continue; // gaps where the steps are gone
      const k = i / (NST - 1);
      const s = new THREE.Mesh(new THREE.BoxGeometry(54, 4, 17), stepMat);
      s.position.set(0, 6 + k * rise, -k * len);
      if (i === 9) { s.rotation.x = -0.6; s.position.y -= 7; } // one hanging off its track
      if (i === 3) s.rotation.z = 0.18;
      const lip = new THREE.Mesh(new THREE.BoxGeometry(54, 4.4, 2), edge); lip.position.set(0, 0.3, 8); s.add(lip);
      grp.add(s);
    }
    for (const sx of [-30, 30]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 22, len + 40), sideMat);
      wall.position.set(sx, 8 + rise / 2 + 6, -len / 2); wall.rotation.x = ang;
      grp.add(wall);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(6, 3, len + 40), new THREE.MeshLambertMaterial({ color: '#050408' }));
      rail.position.set(sx, 8 + rise / 2 + 20, -len / 2); rail.rotation.x = ang;
      grp.add(rail);
    }
    // caution tape and an OUT OF ORDER sign at the foot
    const tape = canvasTex(128, 16, (c, w, h) => { for (let x = -20; x < w; x += 22) { c.fillStyle = '#e0b020'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 11, 0); c.lineTo(x + 1, h); c.lineTo(x - 10, h); c.fill(); } c.fillStyle = 'rgba(0,0,0,0.0)'; });
    const t = new THREE.Mesh(new THREE.PlaneGeometry(64, 6), new THREE.MeshBasicMaterial({ map: tape, side: THREE.DoubleSide, toneMapped: false }));
    t.position.set(0, 18, 24); t.rotation.z = 0.08;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshBasicMaterial({ map: canvasTex(128, 80, (c, w, h) => { c.fillStyle = '#d8d0b8'; c.fillRect(0, 0, w, h); c.fillStyle = '#a01818'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('OUT OF', w / 2, 34); c.fillText('ORDER', w / 2, 62); }), toneMapped: false }));
    sign.position.set(26, 24, 30); sign.rotation.y = -0.4;
    grp.add(t, sign);
    // the upper floor landing it climbs to
    const landing = new THREE.Mesh(new THREE.BoxGeometry(120, 5, 140), new THREE.MeshLambertMaterial({ color: '#201c34' }));
    landing.position.set(0, 8 + rise, -len - 70);
    grp.add(landing);
    g.add(grp);
    this.escalatorSpark = new THREE.Vector3(-118, 62, -330 - len * 0.48);
  }

  buildMonitor(g) {
    const grp = new THREE.Group();
    grp.position.set(136, 0, -390);
    grp.rotation.y = -0.39;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(80, 44, 30), new THREE.MeshLambertMaterial({ color: '#25203a' }));
    desk.position.set(0, 22, 0);
    const monitorBody = new THREE.Mesh(new THREE.BoxGeometry(58, 44, 14), new THREE.MeshLambertMaterial({ color: '#0d0b16' }));
    monitorBody.position.set(0, 68, 0);
    this.cctv = document.createElement('canvas');
    this.cctv.width = 256; this.cctv.height = 192;
    this.cctvTex = new THREE.CanvasTexture(this.cctv);
    this.cctvTex.colorSpace = THREE.SRGBColorSpace;
    this.cctvTex.minFilter = this.cctvTex.magFilter = THREE.NearestFilter;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(50, 37.5), new THREE.MeshBasicMaterial({ map: this.cctvTex, toneMapped: false }));
    screen.position.set(0, 68.5, 7.2);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#6af0b0', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.position.set(0, 68, 14);
    grp.add(desk, monitorBody, screen, glow);
    g.add(grp);
    this.monitorGlow = glow;
    this.drawCCTV(0);
  }

  // A security camera feed: a flat corridor, a timestamp and a few figures that shouldn't be moving.
  drawCCTV(t) {
    const c = this.cctv.getContext('2d'), w = 256, h = 192;
    const lt = t - 11;
    c.fillStyle = '#0a1612'; c.fillRect(0, 0, w, h);
    // an empty food court corridor in perspective
    c.strokeStyle = 'rgba(120,230,170,0.35)'; c.lineWidth = 1;
    c.beginPath();
    for (let i = -5; i <= 5; i++) { c.moveTo(128 + i * 6, 70); c.lineTo(128 + i * 46, h); }
    for (let k = 0; k < 6; k++) { const y = 70 + (k * k) * 3.6 + k * 4; c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();
    c.fillStyle = 'rgba(130,240,180,0.13)'; c.fillRect(100, 40, 56, 30);
    // the figures: dark shapes that drift in from the back and sway as they come
    const fig = (x, y, s, a) => {
      c.fillStyle = `rgba(2,10,6,${a})`;
      c.beginPath(); c.arc(x, y - 22 * s, 6 * s, 0, Math.PI * 2); c.fill();
      c.fillRect(x - 7 * s, y - 16 * s, 14 * s, 26 * s);
      c.fillRect(x - 6 * s, y + 8 * s, 4.5 * s, 18 * s); c.fillRect(x + 1.5 * s, y + 8 * s, 4.5 * s, 18 * s);
      c.fillRect(x - 15 * s, y - 14 * s, 5 * s, 20 * s); c.fillRect(x + 10 * s, y - 14 * s, 5 * s, 20 * s);
    };
    if (lt > 0.4) {
      const k = clamp01((lt - 0.4) / 3.2);
      fig(80 + Math.sin(lt * 1.9) * 4 + k * 14, 96 + k * 26, 0.7 + k * 0.6, 0.85);
      fig(172 - k * 18 + Math.sin(lt * 1.3 + 2) * 4, 100 + k * 20, 0.65 + k * 0.5, 0.8);
      if (lt > 1.6) fig(128 + Math.sin(lt * 1.1) * 6, 90 + k * 14, 0.5 + k * 0.5, 0.75);
    }
    // at 14.2 one of them fills the lens
    if (lt > 3.2) { const k = smooth((lt - 3.2) / 0.55); c.fillStyle = `rgba(2,8,5,${k})`; c.fillRect(0, 0, w, h); c.fillStyle = `rgba(120,255,160,${0.5 * k * (Math.sin(lt * 90) > 0 ? 1 : 0.3)})`; c.fillRect(60, 80, 12, 6); c.fillRect(184, 80, 12, 6); }
    // tracking bars and static, heavier as it goes
    const glitch = 0.12 + clamp01(lt / 3.2) * 0.5;
    for (let i = 0; i < 7; i++) {
      if (hash(Math.floor(t * 14) * 7 + i) > glitch) continue;
      const y = hash(i + Math.floor(t * 11)) * h, hh = 3 + hash(i + 5) * 14, dx = (hash(i + Math.floor(t * 9)) - 0.5) * 50;
      c.drawImage(this.cctv, 0, y, w, hh, dx, y, w, hh);
      c.fillStyle = 'rgba(200,255,220,0.12)'; c.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(190,255,215,${hash(i * 3 + t * 31) * (0.12 + glitch * 0.3)})`; c.fillRect(hash(i + t * 7) * w, hash(i + 90 + t * 13) * h, 2, 1); }
    c.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1); // scanlines
    if (lt > 3.9) { c.fillStyle = '#d8ffe8'; c.globalAlpha = 0.5 + hash(Math.floor(t * 30)) * 0.5; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
    c.font = 'bold 13px monospace'; c.fillStyle = '#9dffc8'; c.textAlign = 'left';
    c.fillText('CAM 07  FOOD CT', 8, 16);
    c.fillText(`11:5${Math.min(9, 5 + Math.floor(Math.max(0, lt) / 3.3))}:${String(Math.floor((Math.max(0, lt) * 17) % 60)).padStart(2, '0')} PM`, 8, h - 8);
    if (Math.floor(t * 2) % 2) { c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(w - 18, 14, 4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffb0b0'; c.fillText('REC', w - 52, 18); }
    this.cctvTex.needsUpdate = true;
  }

  // Cracks spreading over the glass: one more web each time the dead hit it.
  drawCrack() {
    if (!this.crackCanvas) return;
    const c = this.crackCanvas.getContext('2d'), S = 512;
    c.clearRect(0, 0, S, S);
    const stage = this.crack;
    if (!stage) { this.crackTex.needsUpdate = true; return; }
    const centers = [[0.32, 0.5], [0.7, 0.4], [0.52, 0.72], [0.18, 0.28]];
    c.lineCap = 'round';
    for (let s = 0; s < Math.min(stage, 4); s++) {
      const [cx, cy] = [centers[s][0] * S, centers[s][1] * S];
      const rays = 7 + s * 2;
      for (let i = 0; i < rays; i++) {
        let a = (i / rays) * Math.PI * 2 + hash(s * 31 + i) * 0.6, x = cx, y = cy;
        const len = 60 + hash(s * 17 + i) * (90 + stage * 30);
        c.strokeStyle = 'rgba(235,248,255,0.9)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x, y);
        for (let d = 0; d < len; d += 16) {
          a += (hash(s * 7 + i * 3 + d) - 0.5) * 0.5; x += Math.cos(a) * 16; y += Math.sin(a) * 16; c.lineTo(x, y);
          if (hash(s * 5 + i + d * 3) > 0.82) { // a branch
            c.moveTo(x, y); c.lineTo(x + Math.cos(a + 0.9) * 26, y + Math.sin(a + 0.9) * 26); c.moveTo(x, y);
          }
        }
        c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.65)'; c.beginPath(); c.arc(cx, cy, 5 + s, 0, Math.PI * 2); c.fill(); // the impact
      for (let r = 1; r < 4; r++) { c.strokeStyle = `rgba(235,248,255,${0.5 - r * 0.1})`; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r * 26 + hash(s + r) * 8, 0, Math.PI * 2); c.stroke(); } // the rings
    }
    this.crackTex.needsUpdate = true;
  }

  buildStage(g) {
    // a black stage in the dark: a wet disc of floor, a hot glow behind, motes in the air
    const floor = new THREE.Mesh(new THREE.CircleGeometry(520, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0f0c1c', roughness: 0.18, metalness: 0.4 }));
    floor.position.set(0, 0, HERO_Z);
    g.add(floor);
    this.backGlow = new THREE.Mesh(new THREE.PlaneGeometry(2200, 760), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff2a50', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    this.backGlow.position.set(0, 150, HERO_Z - 700);
    g.add(this.backGlow);
    // the crowd that closes in behind them for the last shot
    this.horde2 = [];
    const silMat = new THREE.MeshBasicMaterial({ map: this.silTex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    const silGeo = new THREE.PlaneGeometry(40, 80);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(silGeo, silMat);
      m.userData = { x: (hash(i + 2) - 0.5) * 520, z: HERO_Z - 150 - hash(i + 6) * 430, s: 0.9 + hash(i + 3) * 0.7, ph: hash(i + 11) * 6 };
      g.add(m);
      this.horde2.push(m);
    }
    g.visible = false;
  }

  // sparks / embers / motes: one pool of additive points, and a second of dim dust
  buildPool(scene) {
    const N = 260;
    this.pool = { n: N, pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), col: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), i: 0 };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pool.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pool.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 7, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spark(x, y, z, vx, vy, vz, color, life = 0.6) {
    const P = this.pool, i = P.i++ % P.n, c = new THREE.Color(color);
    P.pos.set([x, y, z], i * 3); P.vel.set([vx, vy, vz], i * 3); P.col.set([c.r, c.g, c.b], i * 3);
    P.life[i] = life; P.max[i] = life;
  }

  buildActors() {
    this.heroActors = {};
    for (const h of HEROES) {
      const a = new Actor(h.cls);
      a.base(HERO_STYLE[h.cls].idle);
      a.root.scale.setScalar(1.15);
      a.root.position.set(0, 0, HERO_Z);
      a.root.visible = false;
      this.stage.add(a.root);
      this.heroActors[h.cls] = a;
    }
    // the hairspray torch's flame: three additive glows that flicker at her wrist
    this.flame = [['#ff6a10', 26], ['#ffa030', 20], ['#ffe090', 13]].map(([c, sz]) => { const f = glowSprite(c, sz, 0.9); f.visible = false; f.userData.sz = sz; this.stage.add(f); return f; });
    // the dead at the glass (and then through it)
    const kinds = ['walker', 'walker', 'sprinter', 'walker', 'brute', 'sprinter', 'walker', 'sprinter', 'spitter', 'walker'];
    this.zombies = kinds.map((type, i) => {
      const st = ENEMY_STYLE[type];
      const a = new Actor(`${st.model}${(i % 2) + 1}`, { tint: st.tint, undead: { ...st.undead } });
      if (st.slim) a.model.scale.x *= st.slim;
      a.base('Walking_D_Skeletons', st.idleSpeed + 0.2);
      a.root.scale.setScalar(st.scale * 1.12);
      const row = i < 5 ? 0 : 1;
      const x = [-70, -34, 20, 46, 78][i % 5] + (row ? 14 : 0);
      const z = DOOR_Z - 22 - row * 46;
      a.root.position.set(x, 0, z);
      this.corridor.add(a.root);
      return { a, st, x, z0: z, v: type === 'sprinter' ? 330 : type === 'brute' ? 190 : 230, d: i * 0.07, run: type === 'sprinter', hit: 0, row };
    });
  }

  resetActors() {
    for (const z of this.zombies) { z.a.root.position.set(z.x, 0, z.z0); z.a.root.visible = true; z.hit = 0; z.dz = 0; z.running = false; z.a.base('Walking_D_Skeletons', z.st.idleSpeed + 0.2); }
    for (const m of this.horde) m.userData.dz = 0;
    for (const h of HEROES) { const a = this.heroActors[h.cls]; a.root.visible = false; a.root.position.set(0, 0, HERO_Z); a.root.rotation.y = 0; a.root.scale.setScalar(1.15); }
    this.corridor.visible = true;
    this.stage.visible = false;
    for (const f of this.flame) f.visible = false;
  }

  // ---------------------------------------------------------------- the timeline

  events() {
    const E = [];
    const at = (t, fn) => E.push([t, fn]);
    at(0.0, () => cine.introBed(37, 0.1));
    at(0.3, () => cine.paChime());
    at(1.35, () => cine.paOpen());
    at(1.7, () => paSpeak('Attention, shoppers. Our doors are now open. Enjoy the savings.'));
    at(3.4, () => cine.paStatic(0.35, 0.06));
    at(5.2, () => cine.paStatic(1.0, 0.1));
    at(6.0, () => cine.paClose());
    at(4.2, () => { cine.rain(30, 0.075); cine.neonBuzz(6, 0.05); });
    at(6.45, () => cine.thunder());
    at(7.6, () => cine.escalatorGroan());
    at(8.7, () => { this.sparkT = 2.2; cine.zap(0); cine.zap(0.35); cine.zap(0.9); });
    at(11.0, () => cine.monitorOn());
    at(11.25, () => cine.monitorGlitch(3.6));
    at(14.2, () => { cine.stingHit(); cine.paStatic(0.8, 0.16); });
    at(15.0, () => { cine.horde(4.2, 0.12); cine.neonBuzz(4, 0.04); });
    at(15.35, () => cine.thunder());
    for (const [i, s] of SLAMS.entries()) {
      at(s, () => { cine.doorSlam(1 + i * 0.12); this.slamPulse = 1; this.crack = i + 1; this.drawCrack(); });
      at(s - 0.3, () => { for (const z of this.zombies.slice(0, 5)) z.a.play('Unarmed_Melee_Attack_Punch_A', { upper: true, timeScale: 1.5 }); });
      at(s + 0.04, () => cine.glassCrack());
    }
    at(18.5, () => cine.whoosh(0.5, 0.1));
    at(19.0, () => { this.shatter(); cine.glassShatter(); cine.horde(3.8, 0.2); });
    at(19.15, () => cine.stingHit());
    at(21.3, () => { cine.chainsawRev(); this.rev = 1.7; });
    at(21.95, () => this.heroActors.biker.play('2H_Melee_Attack_Chop', { upper: true, timeScale: 1.1 }));
    at(24.55, () => { this.heroActors.mallCop.play('2H_Ranged_Shoot', { upper: true, timeScale: 0.45 }); });
    at(24.65, () => cine.shotgunRack());
    at(26.62, () => cine.skaterDrop());
    at(27.2, () => this.heroActors.skater.play('Dodge_Forward', { timeScale: 1.1 }));
    at(29.3, () => { cine.hairsprayFlame(); this.flameT = 2.6; });
    at(32.0, () => cine.riser(1.5, 0.18));
    at(33.4, () => { cine.titleSlam(); this.titleHit = 1; });
    return E.sort((a, b) => a[0] - b[0]);
  }

  shatter() {
    this.shatterT = 0;
    this.glass.visible = false;
    this.cracks.visible = false;
    this.shards.visible = true;
    for (const s of this.shardData) {
      s.p.set((Math.random() - 0.5) * 190, 6 + Math.random() * 84, DOOR_Z + 2 + Math.random() * 6);
      s.v.set((Math.random() - 0.5) * 120 + s.p.x * 0.5, Math.random() * 130 - 20, 160 + Math.random() * 330);
      s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      s.s = 0.7 + Math.random() * 1.6;
    }
    for (let i = 0; i < 60; i++) this.spark(Math.random() * 180 - 90, 8 + Math.random() * 80, DOOR_Z + 3, (Math.random() - 0.5) * 120, Math.random() * 90, 80 + Math.random() * 200, '#cfe8ff', 0.9);
  }

  // ---------------------------------------------------------------- per frame

  update(dt) {
    if (!this.active || this.done || this.gate) return;
    this.t += dt;
    const t = this.t;
    while (this.evI < this.evs.length && this.evs[this.evI][0] <= t) { try { this.evs[this.evI][1](); } catch { /* a cue failing must never stop the film */ } this.evI++; }
    // lightning strobes
    while (this.lightningQ.length && this.lightningQ[0] <= t) { this.lightningQ.shift(); this.strobe = 0.34; }
    if (this.strobe > 0) { this.strobe -= dt; const s = this.strobe; this.flashV = s > 0.24 ? 1 : s > 0.18 ? 0.1 : s > 0.06 ? 0.75 : s > 0 ? s / 0.06 * 0.4 : 0; } else this.flashV = Math.max(0, this.flashV - dt * 5);
    this.slamPulse = Math.max(0, this.slamPulse - dt * 4);
    this.titleHit = Math.max(0, (this.titleHit || 0) - dt * 2);
    const sdt = t >= 19.0 && t < 19.6 ? dt * 0.3 : dt;   // slow motion on the shatter
    this.dynamics(dt, sdt, t);
    if (t >= INTRO_END) this.finish();
  }

  dynamics(dt, sdt, t) {
    this.corridor.visible = t < 21.2;
    this.stage.visible = t >= 21.0;
    this.rainTex.offset.y -= dt * 0.9;
    // signs and tubes: the grid is dying
    for (const s of this.signs) {
      const f = s.dying ? (hash(Math.floor(t * 11) + s.seed) > 0.72 ? 0.12 : 1) : (hash(Math.floor(t * 7) + s.seed) > 0.94 ? 0.3 : 1);
      s.mat.color.setScalar((0.55 + 0.45 * Math.sin(t * 2 + s.seed)) * 0.4 + 0.6 * f);
    }
    for (const n of this.neon) {
      const f = hash(Math.floor(t * 9) + n.seed) > (n.tube ? 0.8 : 0.9) ? 0.15 : 1;
      if (n.tube) n.mat.color.copy(n.c).multiplyScalar(f * (0.8 + 0.2 * Math.sin(t * 40 + n.seed))); else n.mat.opacity = 0.22 * f;
    }
    // the outside rain
    const rp = this.outRain.pos;
    for (let i = 0; i < this.outRain.n; i++) {
      const o = i * 6; let y = rp[o + 1] - dt * 320;
      if (y < 0) y += 190;
      rp[o + 1] = y; rp[o + 4] = y - 14;
    }
    this.outRainMesh.geometry.attributes.position.needsUpdate = true;
    // the monitor
    if (t > 10.8 && t < 15.2) { this.drawCCTV(t); this.monitorGlow.material.opacity = 0.3 + 0.1 * Math.sin(t * 30) + (t > 14.2 ? 0.25 : 0); }
    // escalator sparks
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      if (Math.random() < dt * 40) { const p = this.escalatorSpark; this.spark(p.x + (Math.random() - 0.5) * 20, p.y, p.z, (Math.random() - 0.5) * 90, 30 + Math.random() * 90, (Math.random() - 0.5) * 90, Math.random() < 0.5 ? '#ffb040' : '#fff0c0', 0.5 + Math.random() * 0.5); }
    }
    // the dead at the doors: they lean on the glass, then pour through it
    for (const z of this.zombies) {
      z.a.root.visible = t < 21.2;
      if (!z.a.root.visible) continue;
      if (z.hit > 0) { z.hit -= dt; if (z.hit <= 0) z.a.play('Unarmed_Melee_Attack_Punch_A', { upper: true, timeScale: 1.5 }); }
      const go = Math.max(0, t - 19.0 - z.d);
      if (go > 0) {
        if (!z.running) { z.running = true; z.a.base(z.run ? 'Running_C' : 'Walking_D_Skeletons', z.run ? 1.1 : 1.8); }
        z.dz += z.v * sdt;
        z.a.root.position.z = z.z0 + z.dz;
        z.a.root.position.x = z.x * (1 - smooth(go / 1.4)) + (z.x > 0 ? 24 : -24) * smooth(go / 1.4);
      } else { if (z.running) { z.running = false; z.a.base('Walking_D_Skeletons', z.st.idleSpeed + 0.2); } if (t > 14.5 && t < 19) z.a.root.position.z = z.z0 + Math.sin(t * 9 + z.x) * 1.2 * this.slamPulse; }
      z.a.update(sdt);
    }
    for (const m of this.horde) {
      const u = m.userData, go = Math.max(0, t - 19.0);
      if (go > 0) u.dz = (u.dz || 0) + u.v * sdt;
      m.position.z = u.z + (u.dz || 0);
      m.position.x = u.x;
      m.visible = t < 21.2 && m.position.z < DOOR_Z - 4;
      m.rotation.z = Math.sin(t * 3 + u.ph) * 0.06;
      m.position.y = 40 * u.s + Math.abs(Math.sin(t * 2.2 + u.ph)) * 2 + (t > 15 && t < 19 ? this.slamPulse * 3 : 0);
    }
    // glass shards (slow while the camera hangs on the burst)
    if (this.shatterT >= 0) {
      this.shatterT += sdt;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
      this.shardData.forEach((s, i) => {
        s.v.y -= 380 * sdt; s.p.addScaledVector(s.v, sdt); s.r.addScaledVector(s.w, sdt);
        if (s.p.y < 1) { s.p.y = 1; s.v.y *= -0.25; s.v.x *= 0.7; s.v.z *= 0.7; s.w.multiplyScalar(0.6); }
        e.set(s.r.x, s.r.y, s.r.z); q.setFromEuler(e);
        const k = this.shatterT > 2.4 ? Math.max(0, 1 - (this.shatterT - 2.4) / 0.6) : 1;
        m4.compose(pos.copy(s.p), q, sc.setScalar(s.s * k));
        this.shards.setMatrixAt(i, m4);
      });
      this.shards.instanceMatrix.needsUpdate = true;
      if (this.shatterT > 3.1) this.shards.visible = false;
    }
    // hero stage
    this.stageDynamics(dt, t);
    // particles
    const P = this.pool;
    for (let i = 0; i < P.n; i++) {
      if (P.life[i] <= 0) { P.col[i * 3] = P.col[i * 3 + 1] = P.col[i * 3 + 2] = 0; continue; }
      P.life[i] -= dt;
      const k = Math.max(0, P.life[i] / P.max[i]);
      P.vel[i * 3 + 1] -= 220 * dt;
      P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] = Math.max(0.5, P.pos[i * 3 + 1] + P.vel[i * 3 + 1] * dt); P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      const f = Math.pow(0.02, dt / P.max[i]); P.col[i * 3] *= f; P.col[i * 3 + 1] *= f; P.col[i * 3 + 2] *= f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  stageDynamics(dt, t) {
    if (t < 21.0) return;
    const wrist = (a) => { a.root.updateMatrixWorld(true); const b = a.bone('Wrist.R'); return b ? b.getWorldPosition(new THREE.Vector3()) : a.root.position.clone().add(new THREE.Vector3(0, 30, 10)); };
    for (const h of HEROES) {
      const a = this.heroActors[h.cls];
      const wide = t >= 32.0;
      a.root.visible = wide || (t >= h.a && t < h.b);
      if (a.root.visible) a.update(dt);
    }
    // each shot's light, set and action
    const key = (c, p, power) => { this.rimA.color.set(c); this.rimA.position.set(...p); this.rimA.intensity = power; };
    const fill = (c, p, power) => { this.rimB.color.set(c); this.rimB.position.set(...p); this.rimB.intensity = power; };
    const H = HERO_Z;
    this.backGlow.material.opacity = 0.0;
    this.rimA.intensity = this.rimB.intensity = 0;
    this.fxLight.intensity = 0;
    for (const m of this.horde2) m.visible = t >= 32.0;
    if (t >= 21.0 && t < 24.0) {
      const a = this.heroActors.biker; a.root.position.set(0, 0, H); a.root.rotation.y = 0.12;
      const rev = Math.max(0, (this.rev || 0) - dt) ; this.rev = rev;
      if (rev > 0) { a.root.position.x = (Math.random() - 0.5) * 0.9; a.root.position.y = Math.random() * 0.5; const w = wrist(a); if (Math.random() < dt * 70) this.spark(w.x + 6, w.y + 2, w.z + 12, (Math.random() - 0.3) * 140, 30 + Math.random() * 120, 40 + Math.random() * 120, Math.random() < 0.5 ? '#ffb040' : '#fff4d0', 0.5); }
      key('#ff7a20', [60, 80, H - 70], 300); fill('#2a3a8a', [-80, 30, H + 80], 90);
      this.backGlow.material.opacity = 0.35; this.backGlow.material.color.set('#ff5a20');
    } else if (t >= 24.0 && t < 26.6) {
      const a = this.heroActors.mallCop; a.root.position.set(0, 0, H); a.root.rotation.y = -0.18;
      const ping = t > 24.62 && t < 24.72 ? 1 : 0;
      key('#5aa0ff', [-60, 90, H - 60], 320 + ping * 500); fill('#c8e0ff', [50, 40, H + 90], 70 + ping * 180);
      this.backGlow.material.opacity = 0.3; this.backGlow.material.color.set('#3a6aff');
    } else if (t >= 26.6 && t < 29.2) {
      const a = this.heroActors.skater, lt = t - 26.6, fall = 0.55;
      const y = lt < fall ? 118 * (1 - (lt / fall) ** 2) : 0;
      a.root.position.set(0, y, H); a.root.rotation.y = 0.1;
      const land = lt >= fall && lt < fall + 0.14 ? 1 - (lt - fall) / 0.14 : 0;
      a.root.scale.set(1.15 * (1 + land * 0.1), 1.15 * (1 - land * 0.12), 1.15 * (1 + land * 0.1));
      if (lt >= fall && lt < fall + 0.05) for (let i = 0; i < 16; i++) this.spark((Math.random() - 0.5) * 30, 2, H + (Math.random() - 0.3) * 30, (Math.random() - 0.5) * 160, 20 + Math.random() * 40, (Math.random() - 0.2) * 140, '#80ffc0', 0.45);
      key('#40ffa0', [-50, 100, H - 80], 280); fill('#ff40a0', [70, 30, H + 70], 90);
      this.backGlow.material.opacity = 0.32; this.backGlow.material.color.set('#20d080');
    } else if (t >= 29.2 && t < 32.0) {
      const a = this.heroActors.mallGoth; a.root.position.set(0, 0, H); a.root.rotation.y = 0.05;
      const w = wrist(a), lt = t - 29.6;
      const on = this.flameT > 0 ? (this.flameT -= dt, 1) : 0;
      this.flame.forEach((f, i) => { f.visible = !!(lt > 0 && on); if (f.visible) { const k = clamp01(lt * 5) * (1 + Math.sin(t * 38 + i * 2) * 0.18 + Math.random() * 0.12); f.position.set(w.x + (Math.random() - 0.5) * 1.2, w.y + 3 + i * 1.5, w.z + 8 + i * 12 * clamp01(lt * 4)); f.scale.setScalar(f.userData.sz * k); } });
      if (lt > 0 && on) {
        const f = 1 + Math.sin(t * 40) * 0.2 + Math.random() * 0.15;
        this.fxLight.color.set('#ff9a30'); this.fxLight.position.set(w.x, w.y + 6, w.z + 30); this.fxLight.intensity = 380 * f * clamp01(lt * 6);
        for (let i = 0; i < 4; i++) this.spark(w.x + (Math.random() - 0.5) * 5, w.y + 1 + Math.random() * 4, w.z + 6 + Math.random() * 42 * clamp01(lt * 5), (Math.random() - 0.5) * 24, 30 + Math.random() * 60, 30 + Math.random() * 70, Math.random() < 0.5 ? '#ff8a20' : '#ffe080', 0.35 + Math.random() * 0.25);
      }
      key('#d070ff', [-70, 80, H - 70], 250); fill('#ff9a30', [40, 40, H + 70], 70);
      this.backGlow.material.opacity = 0.32; this.backGlow.material.color.set('#b040ff');
    } else if (t >= 32.0) {
      // all four, back to back
      for (const f of this.flame) f.visible = false;
      const xs = { biker: -78, mallCop: -26, mallGoth: 26, skater: 78 };
      for (const h of HEROES) { const a = this.heroActors[h.cls]; a.root.position.set(xs[h.cls], 0, H); a.root.rotation.y = (xs[h.cls] < 0 ? 0.28 : -0.28); a.root.scale.setScalar(1.15); }
      key('#ff2a50', [0, 120, H - 160], 420); fill('#6a8aff', [0, 60, H + 150], 110);
      this.backGlow.material.opacity = 0.55 + this.titleHit * 0.3; this.backGlow.material.color.set('#ff2a50');
      const adv = Math.max(0, t - 32.0);
      for (const m of this.horde2) { const u = m.userData; m.position.set(u.x, 40 * u.s, Math.min(u.z + adv * 55, HERO_Z - 60)); m.scale.setScalar(u.s); m.rotation.z = Math.sin(t * 3 + u.ph) * 0.06; }
    }
  }

  camAt(t) {
    let s = SEGS[0];
    for (const g of SEGS) if (t >= g.a) s = g;
    const k0 = clamp01((t - s.a) / (s.b - s.a));
    const k = s.e === 'lin' ? k0 : s.e === 'in' ? k0 * k0 : smooth(k0);
    let p, l = mix3(s.l0, s.l1, k);
    if (s.orbit) { const o = s.orbit, a = mix(o.a0, o.a1, k); p = [Math.sin(a) * o.r, mix(o.y0, o.y1, k), HERO_Z + Math.cos(a) * o.r]; } else p = mix3(s.p0, s.p1, k);
    const hand = s.hand || 0;
    p = [p[0] + Math.sin(t * 1.3) * hand, p[1] + Math.sin(t * 1.9 + 1) * hand * 0.5, p[2]];
    return { p, l, fov: mix(s.f0, s.f1, k), roll: mix(s.roll || 0, s.roll1 ?? s.roll ?? 0, k) };
  }

  render() {
    const r = this.r3d.renderer;
    if (this.gate || this.t < T_LIGHT_ON - 0.05) { r.setClearColor('#000000'); r.clear(); return; }
    const t = this.t, c = this.camAt(t);
    // shake
    let sh = 0;
    for (const [te, amp] of SHAKES) if (t >= te && t < te + 1.4) sh += amp * Math.exp(-(t - te) * 4.5);
    sh += this.titleHit * 6;
    const cam = this.camera;
    cam.position.set(c.p[0] + (Math.random() - 0.5) * sh * 0.45, c.p[1] + (Math.random() - 0.5) * sh * 0.3, c.p[2]);
    if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
    cam.up.set(0, 1, 0);
    cam.lookAt(c.l[0], c.l[1], c.l[2]);
    if (c.roll) cam.rotateZ(c.roll);
    // light
    const inCorridor = t < 21.2;
    const fl = this.flashV;
    this.hemi.intensity = (inCorridor ? 0.5 : 0.28) + fl * 3.4;
    this.hemi.color.set(fl > 0.3 ? '#a8bcff' : '#3a4a8a');
    this.moon.intensity = (inCorridor ? 0.3 : 0) + fl * 1.8;
    this.skyMat.color.set(fl > 0.2 ? '#9ab4ff' : '#1a2646');
    this.skyMat.opacity = fl > 0.2 ? 0.55 : 0.82;
    this.camLight.position.set(c.p[0], c.p[1] + 26, c.p[2] - 40);
    this.camLight.intensity = inCorridor ? 55 + this.slamPulse * 30 : 0;
    if (inCorridor) {
      // red through the doors, building as the dead arrive; the sparks light the escalator
      const red = clamp01((t - 13) / 4) * (0.5 + 0.5 * Math.sin(t * 6)) * 0.4 + this.slamPulse * 0.6;
      this.exitSign.material.color.setScalar(0.5 + 0.5 * (Math.sin(t * 7) > -0.2 ? 1 : 0.2));
      this.fxLight.color.set(this.sparkT > 0 ? '#ff9a40' : '#ff2a1a');
      if (this.sparkT > 0) { this.fxLight.position.set(this.escalatorSpark.x, 70, this.escalatorSpark.z); this.fxLight.intensity = 260 * (0.3 + Math.random()); } else if (t > 12) { this.fxLight.position.set(0, 90, DOOR_Z + 140); this.fxLight.intensity = 500 * red; } else this.fxLight.intensity = 0;
      this.rimA.intensity = 0; this.rimB.intensity = 0;
    }
    r.toneMappingExposure = 0.95;
    r.render(this.scene, cam);
  }

  // ---------------------------------------------------------------- what the hud draws

  view() {
    const t = this.t;
    const v = { t, gate: this.gate, bar: 0, fade: 0, flash: 0, caption: null, stamp: null, card: null, title: null, hint: 0, vig: 0.5 };
    if (this.gate) return v;
    v.bar = Math.round(70 * smooth((t - 4.0) / 1.4));
    v.fade = t < 5.4 ? 1 - smooth((t - T_LIGHT_ON) / 1.1) : t > 36.7 ? smooth((t - 36.7) / 1.2) : 0;
    v.flash = this.flashV * 0.45 + (this.titleHit || 0) * (t < 33.9 ? 0.9 : 0) + (t >= 33.4 && t < 33.5 ? 0.6 : 0);
    // the PA subtitles: typed on, with dropouts as the speaker fails
    for (const L of PA_LINES) {
      if (t < L.a || t > L.b + 1.2) continue;
      const n = Math.floor((t - L.a) * 22);
      let txt = L.text.slice(0, n);
      const glitch = Math.floor(t * 14) % 7 === 0 || (t > 5.0 && t < 5.5);
      if (glitch) txt = txt.replace(/[AEIOU]/g, (m, i) => (hash(i + Math.floor(t * 14)) > 0.5 ? '#' : m));
      v.caption = { text: txt, a: t > L.b ? Math.max(0, 1 - (t - L.b) / 1.2) : 1, y: mix(332, 522, smooth((t - 4.4) / 0.8)), size: 30 };
    }
    if (t > 5.4 && t < 10.2) v.stamp = { text: 'BLACK FRIDAY  ·  4:59 AM', a: smooth((t - 5.4) / 0.8) * (t > 9.4 ? Math.max(0, (10.2 - t) / 0.8) : 1) };
    for (const h of HEROES) {
      const a = h.a + 0.35, b = h.b - 0.25;
      if (t >= a && t < b) v.card = { name: h.name, role: h.role, color: h.color, in: clamp01((t - a) / 0.25), out: clamp01((b - t) / 0.3) };
    }
    if (t >= 33.4) v.title = { age: t - 33.4 };
    v.hint = t > 1.2 && t < 33.4 ? Math.min(1, (t - 1.2) / 1.0) * 0.62 : 0;
    return v;
  }
}
