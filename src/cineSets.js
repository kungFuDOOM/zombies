// Cinematic toolkit, part 6: reusable sets built from procedural mall props. Each builder returns a THREE.Group plus a small
// "handles" object (things a shot wants to animate: flickering signs, the door lock LED, the monitor feed...) and an
// update(dt, t) for the always-on animation. Units are the game's: a survivor is ~54 tall, the concourse ceiling is 190.
//
//   buildConcourse()  the long mall hall: storefronts, neon, skylight and rain, fountain, PA speakers, a dead escalator,
//                     the glass doors with their keypad lock, and the night outside
//   buildOffice()     the security office: monitor wall, desk, rain window, fluorescent tubes
//   buildBay()        a one-hero stage: wet floor, a backdrop wall with a neon sign, pillars (hero reveals)

import * as THREE from 'three';
import { neonSignTexture } from './mall3d.js';
import { glowTexture } from './models.js';
import { canvasTex, flicker } from './cineFx.js';
import { clamp01, hash, smooth } from './cineCore.js';

export const DOOR_Z = -1300;       // the glass doors at the far end of the concourse
export const FOUNTAIN = [0, 0, 250];
export const OFFICE_X = 4200;      // the security office is built far off to the side of the concourse
export const BAY_Z = 1900;         // hero bays sit behind the back of the concourse
export const BAY_X = { biker: -1500, mallCop: -750, skater: 0, mallGoth: 750 };
export const ESCALATOR = { x: -118, z0: -330, rise: 104, len: 300 };   // z0 = foot; the top step is at z0 - len

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function add(g, geo, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; }
const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });

// ===================================================================== the concourse
export function buildConcourse({ high }) {
  const g = new THREE.Group(), W = 180;
  const H = { signs: [], neon: [], speakers: [], crowdSil: [] };

  // wet terrazzo floor
  const tile = canvasTex(128, 128, (c) => {
    c.fillStyle = '#1b1830'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#272342'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(150,160,220,${0.04 + hash(i) * 0.07})`; c.fillRect(hash(i + 3) * 128, hash(i + 9) * 128, 1 + hash(i + 5) * 3, 1 + hash(i + 7) * 2); }
  }, [W * 2 / 64, 2800 / 64]);
  add(g, new THREE.PlaneGeometry(W * 2, 2800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.34, metalness: 0.12 }), 0, 0, -300);

  // ceiling: dark side strips and a long skylight with rain running down it
  const dark = lam('#16122a');
  for (const s of [-1, 1]) add(g, new THREE.PlaneGeometry(W - 90, 2800).rotateX(Math.PI / 2), dark, s * (90 + (W - 90) / 2), 190, -300);
  const rainTex = canvasTex(128, 256, (c, w, h) => {
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * w, y = hash(i + 50) * h, l = 20 + hash(i + 9) * 60;
      const gr = c.createLinearGradient(0, y, 0, y + l);
      gr.addColorStop(0, 'rgba(180,200,255,0)'); gr.addColorStop(0.7, 'rgba(180,200,255,0.55)'); gr.addColorStop(1, 'rgba(230,240,255,0.9)');
      c.fillStyle = gr; c.fillRect(x, y, 1.5, l);
      c.fillStyle = 'rgba(210,225,255,0.8)'; c.beginPath(); c.arc(x + 0.7, y + l, 2.2, 0, Math.PI * 2); c.fill();
    }
  }, [3, 28]);
  H.rainTex = rainTex;
  H.skyMat = new THREE.MeshBasicMaterial({ color: '#1a2646', transparent: true, opacity: 0.85, toneMapped: false });
  add(g, new THREE.PlaneGeometry(180, 2800).rotateX(Math.PI / 2), H.skyMat, 0, 191, -300);
  add(g, new THREE.PlaneGeometry(180, 2800).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 189.5, -300);
  const beamMat = lam('#0e0b1c');
  for (let z = 800; z > -1300; z -= 160) add(g, box(190, 8, 12), beamMat, 0, 186, z);

  // storefronts down both sides: neon sign, half-shuttered window, dim glow inside, neon spill on the floor
  const names = [['PIZZA', '#ff5a2a'], ['BURGERS', '#ff2ea6'], ['ARCADE', '#2ee6ff'], ['TACO', '#ffcc33'], ['SHOES', '#b070ff'], ['SALE', '#ff3a3a'], ['SMOOTHIES', '#40ffb0'], ['BOOKS', '#6aa0ff'], ['GAMES', '#ff9a30'], ['CINEMA', '#ff2ea6']];
  const wallMat = lam('#1a1530');
  const shutterTex = canvasTex(64, 64, (c) => { c.fillStyle = '#3a3848'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 6) { c.fillStyle = '#23212e'; c.fillRect(0, y, 64, 2); } }, [3, 3]);
  const shutterMat = new THREE.MeshLambertMaterial({ map: shutterTex });
  for (const side of [-1, 1]) {
    add(g, box(10, 190, 2800), wallMat, side * (W + 5), 95, -300);
    for (let k = 0; k < 10; k++) {
      const z = 800 - k * 230;
      const [name, color] = names[(k + (side > 0 ? 3 : 0)) % names.length];
      const sign = add(g, new THREE.PlaneGeometry(112, 35), new THREE.MeshBasicMaterial({ map: neonSignTexture(name, color), toneMapped: false }), side * (W - 0.5), 136, z, -side * Math.PI / 2);
      H.signs.push({ mat: sign.material, seed: k * 3 + side * 7, dying: k % 3 === 1 });
      const gl = add(g, new THREE.PlaneGeometry(150, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), side * (W - 1), 52, z, -side * Math.PI / 2);
      void gl;
      const sh0 = 50 + hash(k + side) * 22;
      add(g, new THREE.PlaneGeometry(150, sh0), shutterMat, side * (W - 1.5), 94 - sh0 / 2, z, -side * Math.PI / 2);
      const spill = add(g, new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), side * (W - 70), 0.6, z);
      H.neon.push({ mat: spill.material, seed: k + 20 * side, base: 0.22 });
    }
  }
  // ceiling fluorescents, some dying
  for (const side of [-1, 1]) for (let z = 760; z > -1250; z -= 190) {
    const c = new THREE.Color(side > 0 ? '#9ad8ff' : '#ff9ad8').multiplyScalar(1.4);
    const tube = add(g, box(5, 3, 110), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), side * 70, 184, z);
    H.neon.push({ mat: tube.material, seed: z * 0.013 + side, tube: true, c });
  }

  // PA speakers on the ceiling and one on a pillar near the back (the opening crane starts on it): box + horn + status LED
  const spkMat = lam('#1c1a26'), hornMat = lam('#0a0910');
  const speaker = (x, y, z, ry) => {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(box(22, 15, 16), spkMat));
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(11, 5, 14, 14, 1, true), hornMat); horn.rotation.x = Math.PI / 2; horn.position.z = 11; horn.material.side = THREE.DoubleSide; s.add(horn);
    const led = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a2a', toneMapped: false })); led.position.set(8, 5.5, 8.4); s.add(led);
    const cable = new THREE.Mesh(box(1, 190 - y, 1), hornMat); cable.position.set(0, (190 - y) / 2 + 7, -2); s.add(cable);
    s.position.set(x, y, z); s.rotation.y = ry;
    g.add(s);
    H.speakers.push(led.material);
    return s;
  };
  H.pa = speaker(92, 150, 560, Math.PI);          // the hero speaker of shot 1 (faces down the hall)
  speaker(-92, 150, 120, Math.PI); speaker(92, 150, -380, Math.PI); speaker(-92, 150, -820, Math.PI);

  // set dressing to pass: benches, planters
  const benchMat = lam('#2c2640'), leaf = lam('#173a2a'), pot = lam('#3a2a3a');
  for (let k = 0; k < 9; k++) {
    const z = 560 - k * 250 + hash(k) * 40, x = (k % 2 ? 1 : -1) * (62 + hash(k + 4) * 30);
    if (z > 150 && z < 350) continue;      // keep the fountain clear
    if (k % 3 === 0) { add(g, box(70, 6, 18), benchMat, x, 18, z); add(g, box(70, 20, 4), benchMat, x, 28, z + 8 * Math.sign(-x)); }
    else { add(g, new THREE.CylinderGeometry(14, 10, 22, 8), pot, x, 11, z); const f = add(g, new THREE.ConeGeometry(18, 46, 7), leaf, x, 44, z); f.rotation.z = hash(k) * 0.3 - 0.15; }
  }

  // ----- the fountain: basin, still black water, a tiered column
  const fz = FOUNTAIN[2];
  const stone = new THREE.MeshStandardMaterial({ color: '#3a3650', roughness: 0.6, metalness: 0.1 });
  add(g, new THREE.CylinderGeometry(84, 88, 14, 36), stone, 0, 7, fz);
  H.water = add(g, new THREE.CircleGeometry(78, 36).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0a1830', roughness: 0.04, metalness: 0.7 }), 0, 13.2, fz);
  add(g, new THREE.CylinderGeometry(10, 14, 40, 14), stone, 0, 32, fz);
  add(g, new THREE.CylinderGeometry(34, 12, 8, 24), stone, 0, 50, fz);
  add(g, new THREE.CylinderGeometry(6, 8, 22, 12), stone, 0, 62, fz);
  H.fountainRing = add(g, new THREE.RingGeometry(44, 76, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a7aff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 13.6, fz);

  // ----- the dead escalator (a few steps missing, one hanging), with a landing, caution tape and an OUT OF ORDER sign
  const E = ESCALATOR, esc = new THREE.Group();
  esc.position.set(E.x, 0, E.z0);
  const ang = Math.atan2(E.rise, E.len);
  const stepMat = lam('#3a3a4a'), edge = lam('#c8a030'), sideMat = lam('#15131f'), railMat = lam('#050408');
  const NST = 16;
  for (let i = 0; i < NST; i++) {
    if (i === 5 || i === 6 || i === 11) continue;
    const k = i / (NST - 1);
    const s = new THREE.Mesh(box(54, 4, 17), stepMat);
    s.position.set(0, 6 + k * E.rise, -k * E.len);
    if (i === 9) { s.rotation.x = -0.6; s.position.y -= 7; }
    if (i === 3) s.rotation.z = 0.18;
    const lip = new THREE.Mesh(box(54, 4.4, 2), edge); lip.position.set(0, 0.3, 8); s.add(lip);
    esc.add(s);
  }
  for (const sx of [-30, 30]) {
    const wall = new THREE.Mesh(box(4, 22, E.len + 40), sideMat); wall.position.set(sx, 8 + E.rise / 2 + 6, -E.len / 2); wall.rotation.x = ang; esc.add(wall);
    const rail = new THREE.Mesh(box(6, 3, E.len + 40), railMat); rail.position.set(sx, 8 + E.rise / 2 + 20, -E.len / 2); rail.rotation.x = ang; esc.add(rail);
  }
  const tape = canvasTex(128, 16, (c, w, h) => { for (let x = -20; x < w; x += 22) { c.fillStyle = '#e0b020'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 11, 0); c.lineTo(x + 1, h); c.lineTo(x - 10, h); c.fill(); } });
  const t = new THREE.Mesh(new THREE.PlaneGeometry(64, 6), new THREE.MeshBasicMaterial({ map: tape, side: THREE.DoubleSide, toneMapped: false })); t.position.set(0, 18, 24); t.rotation.z = 0.08; esc.add(t);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshBasicMaterial({ map: canvasTex(128, 80, (c, w, h) => { c.fillStyle = '#d8d0b8'; c.fillRect(0, 0, w, h); c.fillStyle = '#a01818'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('OUT OF', w / 2, 34); c.fillText('ORDER', w / 2, 62); }), toneMapped: false })); sign.position.set(26, 24, 30); sign.rotation.y = -0.4; esc.add(sign);
  const landing = new THREE.Mesh(box(120, 5, 160), lam('#201c34')); landing.position.set(0, 8 + E.rise, -E.len - 70); esc.add(landing);
  // the Food Court beyond the top: a fryer-orange wash behind the landing
  H.foodGlow = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), glowMat('#ff6a1a', 0.55));
  H.foodGlow.position.set(0, E.rise + 60, -E.len - 150);
  esc.add(H.foodGlow);
  g.add(esc);
  H.escalator = esc;
  H.escTop = new THREE.Vector3(E.x, 8 + E.rise + 4, E.z0 - E.len);

  // ----- the end wall, the glass doors and their keypad lock
  const DH = 96, wall = lam('#16122a'), frame = lam('#0c0a16');
  for (const s of [-1, 1]) add(g, box(W - 100, 190, 14), wall, s * (100 + (W - 100) / 2), 95, DOOR_Z - 7);
  add(g, box(200, 190 - DH, 14), wall, 0, DH + (190 - DH) / 2, DOOR_Z - 7);
  for (const x of [-100, 0, 100]) add(g, box(7, DH, 10), frame, x, DH / 2, DOOR_Z);
  add(g, box(200, 7, 10), frame, 0, DH, DOOR_Z);
  H.exit = add(g, new THREE.PlaneGeometry(46, 14), new THREE.MeshBasicMaterial({ map: canvasTex(128, 40, (c, w, h) => { c.fillStyle = '#200406'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff2a2a'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EXIT', w / 2, h / 2 + 2); }), toneMapped: false }), 0, DH + 14, DOOR_Z + 6);
  // keypad lock on the wall beside the doors, with a red LED that flips green
  const lock = new THREE.Group();
  lock.position.set(-109, 62, DOOR_Z + 2);
  lock.add(new THREE.Mesh(box(16, 24, 5), lam('#262434')));
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(11, 13), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(44, 52, (c, w, h) => { c.fillStyle = '#0a0910'; c.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { c.fillStyle = i === 10 ? '#3a6a4a' : '#4a4a5c'; c.fillRect(4 + (i % 3) * 13, 4 + Math.floor(i / 3) * 12, 10, 9); } }), color: '#9a9aa8' })); pad.position.set(0, -4, 2.7); lock.add(pad);
  H.led = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(1.4), toneMapped: false }));
  H.led.position.set(0, 7, 3.4); lock.add(H.led);
  H.ledGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glowMat('#ff2a1a', 0.7)); H.ledGlow.position.set(0, 7, 4); lock.add(H.ledGlow);
  g.add(lock);
  H.lock = lock;
  // the night outside: a sodium-red glow, rain, and the dead
  add(g, new THREE.PlaneGeometry(900, 330), new THREE.MeshBasicMaterial({ map: canvasTex(8, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#12040a'); gr.addColorStop(0.55, '#7a1a1c'); gr.addColorStop(0.85, '#d85a2a'); gr.addColorStop(1, '#3a0e0a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), toneMapped: false, fog: false }), 0, 120, DOOR_Z - 260);
  const glassMat = new THREE.MeshPhongMaterial({ color: '#8fb8d8', transparent: true, opacity: 0.16, shininess: 120, specular: '#ffffff', depthWrite: false });
  H.glass = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(94, DH - 5), glassMat); p.position.set(s * 49, DH / 2, DOOR_Z + 1); H.glass.add(p); }
  g.add(H.glass);
  H.crackCanvas = document.createElement('canvas'); H.crackCanvas.width = H.crackCanvas.height = 512;
  H.crackTex = new THREE.CanvasTexture(H.crackCanvas); H.crackTex.colorSpace = THREE.SRGBColorSpace;
  H.cracks = add(g, new THREE.PlaneGeometry(196, DH), new THREE.MeshBasicMaterial({ map: H.crackTex, transparent: true, depthWrite: false, toneMapped: false }), 0, DH / 2, DOOR_Z + 1.6);
  const N = 260, rp = new Float32Array(N * 6);
  H.outRain = { pos: rp, n: N };
  for (let i = 0; i < N; i++) { const x = (hash(i) - 0.5) * 420, y = hash(i + 40) * 190, z = DOOR_Z - 6 - hash(i + 80) * 220; rp.set([x, y, z, x - 2, y - 14, z], i * 6); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  H.outRainMesh = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#ffb0a0', transparent: true, opacity: 0.4, fog: false }));
  H.outRainMesh.frustumCulled = false; g.add(H.outRainMesh);
  // dark billboards of the dead behind the glass (depth for the crowd; the real zombie models stand in front)
  const silTex = canvasTex(64, 128, (c) => {
    c.fillStyle = '#05010a';
    c.beginPath(); c.arc(32, 22, 11, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(20, 34); c.lineTo(44, 34); c.lineTo(48, 96); c.lineTo(16, 96); c.closePath(); c.fill();
    c.lineWidth = 7; c.strokeStyle = '#05010a'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(22, 40); c.lineTo(6, 12); c.moveTo(42, 40); c.lineTo(60, 8); c.stroke();
    c.lineWidth = 9; c.beginPath(); c.moveTo(26, 94); c.lineTo(22, 126); c.moveTo(38, 94); c.lineTo(44, 126); c.stroke();
  });
  const silMat = new THREE.MeshBasicMaterial({ map: silTex, transparent: true, depthWrite: false, toneMapped: false, fog: false }), silGeo = new THREE.PlaneGeometry(40, 80);
  for (let i = 0; i < (high ? 30 : 18); i++) {
    const m = new THREE.Mesh(silGeo, silMat);
    m.userData = { x: (hash(i + 1) - 0.5) * 330, z: DOOR_Z - 60 - hash(i + 7) * 190, s: 0.8 + hash(i + 3) * 0.5, ph: hash(i + 11) * 6, v: 110 + hash(i + 13) * 130 };
    m.position.set(m.userData.x, 40 * m.userData.s, m.userData.z); m.scale.setScalar(m.userData.s);
    g.add(m); H.crowdSil.push(m);
  }
  // glass shards: one instanced mesh of triangles
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3, -2, 0, 3, -2, 0, 0, 4.5, 0]), 3)); sg.computeVertexNormals();
  H.shardN = high ? 110 : 60;
  H.shards = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), H.shardN);
  H.shards.frustumCulled = false; H.shards.visible = false;
  H.shardData = Array.from({ length: H.shardN }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 }));
  g.add(H.shards);

  H.crack = 0;
  H.drawCrack = (stage) => {
    H.crack = stage;
    const c = H.crackCanvas.getContext('2d'), S = 512;
    c.clearRect(0, 0, S, S);
    if (stage) {
      const centers = [[0.32, 0.5], [0.7, 0.4], [0.52, 0.72], [0.18, 0.28]];
      c.lineCap = 'round';
      for (let s = 0; s < Math.min(stage, 4); s++) {
        const [cx, cy] = [centers[s][0] * S, centers[s][1] * S], rays = 7 + s * 2;
        for (let i = 0; i < rays; i++) {
          let a = (i / rays) * Math.PI * 2 + hash(s * 31 + i) * 0.6, x = cx, y = cy;
          const len = 60 + hash(s * 17 + i) * (90 + stage * 30);
          c.strokeStyle = 'rgba(235,248,255,0.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y);
          for (let d = 0; d < len; d += 16) {
            a += (hash(s * 7 + i * 3 + d) - 0.5) * 0.5; x += Math.cos(a) * 16; y += Math.sin(a) * 16; c.lineTo(x, y);
            if (hash(s * 5 + i + d * 3) > 0.82) { c.moveTo(x, y); c.lineTo(x + Math.cos(a + 0.9) * 26, y + Math.sin(a + 0.9) * 26); c.moveTo(x, y); }
          }
          c.stroke();
        }
        c.fillStyle = 'rgba(255,255,255,0.65)'; c.beginPath(); c.arc(cx, cy, 5 + s, 0, Math.PI * 2); c.fill();
        for (let r = 1; r < 4; r++) { c.strokeStyle = `rgba(235,248,255,${0.5 - r * 0.1})`; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r * 26 + hash(s + r) * 8, 0, Math.PI * 2); c.stroke(); }
      }
    }
    H.crackTex.needsUpdate = true;
  };

  // always-on animation: dying neon, rain on the skylight and outside
  H.update = (dt, t) => {
    rainTex.offset.y -= dt * 0.9;
    for (const s of H.signs) { const f = flicker(t, s.seed, s.dying); s.mat.color.setScalar((0.55 + 0.45 * Math.sin(t * 2 + s.seed)) * 0.4 + 0.6 * f); }
    for (const n of H.neon) {
      const f = hash(Math.floor(t * 9) + n.seed) > (n.tube ? 0.8 : 0.9) ? 0.15 : 1;
      if (n.tube) n.mat.color.copy(n.c).multiplyScalar(f * (0.8 + 0.2 * Math.sin(t * 40 + n.seed))); else n.mat.opacity = n.base * f;
    }
    for (let i = 0; i < N; i++) { const o = i * 6; let y = rp[o + 1] - dt * 320; if (y < 0) y += 190; rp[o + 1] = y; rp[o + 4] = y - 14; }
    rg.attributes.position.needsUpdate = true;
    H.fountainRing.material.opacity = 0.1 + 0.04 * Math.sin(t * 1.3);
  };
  /** Pulse the PA speakers' LEDs (Pam is speaking). */
  H.paGlow = (on, t) => { for (const m of H.speakers) m.color.set(on ? '#ffd23a' : '#ff3a2a').multiplyScalar(on ? 1.6 + Math.sin(t * 30) * 0.6 : 0.6); };
  return { group: g, h: H };
}

// ===================================================================== the security office
/** CCTV feed canvas: the door panel in the dead of night, a uniformed figure at it, its face lost in static. */
export function drawFeed(c, w, hgt, t, glitch = 0.4) {
  c.fillStyle = '#12362a'; c.fillRect(0, 0, w, hgt);
  c.fillStyle = 'rgba(120,230,170,0.10)'; c.fillRect(0, hgt * 0.62, w, 2);
  // door frame and keypad
  c.fillStyle = '#1a4a3a'; c.fillRect(w * 0.08, hgt * 0.12, w * 0.3, hgt * 0.82);
  c.fillStyle = '#2f7a5c'; c.fillRect(w * 0.1, hgt * 0.14, w * 0.26, hgt * 0.78);
  c.fillStyle = '#0a1a14'; c.fillRect(w * 0.7, hgt * 0.38, w * 0.1, hgt * 0.17);
  const blink = Math.sin(t * 6) > 0;
  c.fillStyle = blink ? '#9dffc8' : '#2a6a4a'; c.fillRect(w * 0.73, hgt * 0.4, 5, 5);
  // the figure: cap, shoulders, an arm at the panel, no face
  const fx = w * 0.56 + Math.sin(t * 0.7) * 2, top = hgt * 0.2;
  c.fillStyle = '#020806';
  c.beginPath(); c.ellipse(fx, top + hgt * 0.11, w * 0.055, hgt * 0.085, 0, 0, Math.PI * 2); c.fill();
  c.fillRect(fx - w * 0.07, top, w * 0.14, hgt * 0.035);                    // cap
  c.fillRect(fx - w * 0.01, top + hgt * 0.02, w * 0.12, hgt * 0.02);         // visor
  c.beginPath(); c.moveTo(fx - w * 0.1, top + hgt * 0.22); c.lineTo(fx + w * 0.1, top + hgt * 0.22); c.lineTo(fx + w * 0.12, hgt); c.lineTo(fx - w * 0.12, hgt); c.fill();
  c.lineWidth = 7; c.strokeStyle = '#020806'; c.beginPath(); c.moveTo(fx + w * 0.08, top + hgt * 0.26); c.lineTo(w * 0.72, hgt * 0.45); c.stroke();
  // badge glint
  c.fillStyle = 'rgba(150,255,200,0.55)'; c.fillRect(fx - w * 0.06, top + hgt * 0.3, 4, 5);
  // face: static
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(190,255,215,${hash(i * 3 + Math.floor(t * 24)) * 0.8})`; c.fillRect(fx - w * 0.045 + hash(i + t * 5) * w * 0.09, top + hgt * 0.04 + hash(i + 90 + t * 9) * hgt * 0.14, 3, 2); }
  // tracking bars + noise
  for (let i = 0; i < 6; i++) {
    if (hash(Math.floor(t * 14) * 7 + i) > glitch) continue;
    const y = hash(i + Math.floor(t * 11)) * hgt, hh = 3 + hash(i + 5) * 14, dx = (hash(i + Math.floor(t * 9)) - 0.5) * 50;
    c.drawImage(c.canvas, 0, y, w, hh, dx, y, w, hh);
    c.fillStyle = 'rgba(200,255,220,0.12)'; c.fillRect(0, y, w, 1);
  }
  for (let i = 0; i < 150; i++) { c.fillStyle = `rgba(190,255,215,${hash(i * 3 + t * 31) * (0.1 + glitch * 0.25)})`; c.fillRect(hash(i + t * 7) * w, hash(i + 90 + t * 13) * hgt, 2, 1); }
  c.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < hgt; y += 3) c.fillRect(0, y, w, 1);
  c.font = `bold ${Math.round(hgt * 0.07)}px monospace`; c.fillStyle = '#9dffc8'; c.textAlign = 'left';
  c.fillText('CAM 01  FRONT DOORS', 8, hgt * 0.1);
  c.fillText('04:59:0' + (Math.floor(t) % 10) + ' AM', 8, hgt - 8);
  if (Math.floor(t * 2) % 2) { c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(w - 18, hgt * 0.08, 4, 0, Math.PI * 2); c.fill(); }
}

export function buildOffice() {
  const g = new THREE.Group(), H = { tubes: [] };
  g.position.set(OFFICE_X, 0, 0);
  const wall = lam('#1c2230'), floor = new THREE.MeshStandardMaterial({ color: '#10141e', roughness: 0.35, metalness: 0.2 });
  add(g, new THREE.PlaneGeometry(260, 220).rotateX(-Math.PI / 2), floor, 0, 0, 40);
  add(g, box(260, 110, 6), wall, 0, 55, -70);                   // back wall (monitor wall)
  add(g, box(6, 110, 220), wall, -130, 55, 40); add(g, box(6, 110, 220), wall, 130, 55, 40);
  add(g, box(260, 6, 220), lam('#161a26'), 0, 110, 40);          // ceiling
  // monitor wall: 3x2 screens; the big middle one carries the glitched feed
  H.feed = document.createElement('canvas'); H.feed.width = 320; H.feed.height = 240;
  H.feedTex = new THREE.CanvasTexture(H.feed); H.feedTex.colorSpace = THREE.SRGBColorSpace;
  H.screens = [];
  const small = canvasTex(128, 96, (c, w, h) => { drawFeed(c, w, h, 3.1, 0.2); });
  for (let i = 0; i < 6; i++) {
    const x = -78 + (i % 3) * 78, y = 76 - Math.floor(i / 3) * 40;
    const big = i === 1;
    add(g, box(big ? 74 : 70, big ? 54 : 36, 6), lam('#08090e'), x, big ? y - 6 : y, -66);
    const sc = add(g, new THREE.PlaneGeometry(big ? 66 : 62, big ? 49.5 : 28), new THREE.MeshBasicMaterial({ map: big ? H.feedTex : small, toneMapped: false, color: big ? '#ffffff' : '#b0d8c0' }), x, big ? y - 6 : y, -62.8);
    H.screens.push(sc);
  }
  H.glow = add(g, new THREE.PlaneGeometry(260, 120), glowMat('#4af0a0', 0.1), 0, 62, -58);
  // desk, chair, mug, a hat
  add(g, box(190, 5, 46), lam('#2a2436'), 0, 34, -30); add(g, box(190, 34, 4), lam('#1a1626'), 0, 17, -50);
  add(g, new THREE.CylinderGeometry(3, 3, 6, 10), lam('#c8c0b0'), 40, 39, -26);
  add(g, new THREE.CylinderGeometry(9, 9, 3, 14), lam('#14161e'), -50, 38, -22);
  add(g, box(34, 4, 30), lam('#1a1a24'), 0, 28, 10); add(g, box(34, 36, 4), lam('#1a1a24'), 0, 46, 24);
  // rain window on the right wall
  const rainWin = canvasTex(256, 192, (c, w, h) => {
    c.fillStyle = '#0a1426'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = hash(i) * w, y = hash(i + 7) * h, l = 10 + hash(i + 3) * 50; c.fillStyle = `rgba(160,190,255,${0.15 + hash(i) * 0.3})`; c.fillRect(x, y, 1.4, l); }
  });
  H.win = add(g, new THREE.PlaneGeometry(90, 56), new THREE.MeshBasicMaterial({ map: rainWin, toneMapped: false, color: '#6a8ad0' }), 126.5, 66, 20, -Math.PI / 2);
  H.winFrame = add(g, box(2, 62, 96), lam('#0c0e16'), 127, 66, 20);
  // ceiling fluorescents
  for (const x of [-60, 60]) { const t = add(g, box(70, 2.4, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d8f0ff').multiplyScalar(1.3), toneMapped: false }), x, 107, 0); H.tubes.push({ mat: t.material, seed: x * 0.1, base: new THREE.Color('#d8f0ff').multiplyScalar(1.3) }); }
  H.update = (dt, t) => {
    for (const f of H.tubes) f.mat.color.copy(f.base).multiplyScalar(flicker(t, f.seed, true) * 0.55 + 0.15);
    H.rain = t;
  };
  H.drawFeed = (t, glitch) => { drawFeed(H.feed.getContext('2d'), 320, 240, t, glitch); H.feedTex.needsUpdate = true; };
  H.drawFeed(0, 0.3);
  return { group: g, h: H };
}

// ===================================================================== a hero bay
const BAY_LOOK = {
  biker: { sign: ['GARAGE', '#ff7a30'], wall: '#2a1a1a', pillar: '#3a2a26' },
  mallCop: { sign: ['SECURITY', '#4a8aff'], wall: '#161c30', pillar: '#2a3048' },
  skater: { sign: ['ARCADE', '#30ffb0'], wall: '#12262a', pillar: '#223c3c' },
  mallGoth: { sign: ['HOT TOPIC', '#c060ff'], wall: '#1e1230', pillar: '#322048' },
};
/** A dark wet stage with a neon-signed backdrop, pillars and a shuttered gate; one per hero reveal. */
export function buildBay(cls) {
  const L = BAY_LOOK[cls], g = new THREE.Group(), cx = BAY_X[cls], z = BAY_Z, H = { neon: [] };
  g.position.set(cx, 0, z);
  add(g, new THREE.PlaneGeometry(900, 700).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0f0c1c', roughness: 0.18, metalness: 0.4 }), 0, 0, 0);
  add(g, box(420, 190, 8), lam(L.wall), 0, 95, -170);
  const sign = add(g, new THREE.PlaneGeometry(130, 40), new THREE.MeshBasicMaterial({ map: neonSignTexture(L.sign[0], L.sign[1]), toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.3) }), 0, 128, -165);
  H.neon.push({ mat: sign.material, seed: cx * 0.01 });
  add(g, new THREE.PlaneGeometry(260, 150), glowMat(L.sign[1], 0.28), 0, 80, -160);
  for (const x of [-170, -90, 90, 170]) add(g, box(14, 190, 14), lam(L.pillar), x, 95, -120);
  for (const x of [-150, 150]) { const t = add(g, box(5, 3, 90), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.sign[1]).multiplyScalar(1.5), toneMapped: false }), x, 182, -60); H.neon.push({ mat: t.material, seed: x * 0.02, tube: true, c: new THREE.Color(L.sign[1]).multiplyScalar(1.5) }); }
  H.update = (dt, t) => { for (const n of H.neon) { const f = flicker(t, n.seed, !!n.tube); if (n.tube) n.mat.color.copy(n.c).multiplyScalar(f); else n.mat.color.setScalar(0.85 + 0.15 * f); } };
  return { group: g, h: H, center: new THREE.Vector3(cx, 0, z) };
}

export { smooth, clamp01 };
