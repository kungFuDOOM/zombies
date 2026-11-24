// The 3D set dressing for Mall of the Dead: bright 90s neon mall tiles, glowing stall signs,
// overturned tables, palm planters, shutters, the kitchen and the Security Room. Everything
// is clean low-poly with emissive neon, in the retro arcade look (no ink, no halftone).
// Called from Renderer3D.buildLevel with the renderer, the game and the level's group.

import * as THREE from 'three';
import { TILE } from './config.js';
import { T, FOOD_COURT, WINGS } from './level.js';
import { glowSprite } from './models.js';

export const WALL_H = 52;

const hashN = (x, y, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------- little texture factories ----------

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A glowing neon sign: dark panel, bright tube lettering, a soft halo.
export function neonSignTexture(text, color, sub = '') {
  return canvasTex(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0c0618';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 8;
    ctx.strokeStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 92;
    ctx.font = `bold ${size}px "Arial Black", Impact, sans-serif`;
    while (ctx.measureText(text).width > w - 70 && size > 30) { size -= 4; ctx.font = `bold ${size}px "Arial Black", Impact, sans-serif`; }
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 24;
    ctx.fillText(text, w / 2, sub ? h / 2 - 8 : h / 2 + 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.strokeText(text, w / 2, sub ? h / 2 - 8 : h / 2 + 2);
    if (sub) { ctx.shadowBlur = 8; ctx.font = 'bold 26px "Trebuchet MS", sans-serif'; ctx.fillStyle = color; ctx.fillText(sub, w / 2, h - 34); }
  });
}

function stripeTex(c0, c1, n = 8, vertical = true) {
  return canvasTex(128, 32, (ctx, w, h) => {
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c1 : c0; if (vertical) ctx.fillRect((i * w) / n, 0, w / n + 1, h); else ctx.fillRect(0, (i * h) / n, w, h / n + 1); }
  });
}

function crtTexture(label, color, seed) {
  return canvasTex(128, 96, (ctx, w, h) => {
    ctx.fillStyle = '#041018';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    // a little wireframe corridor: a security camera feed
    for (let i = 0; i < 5; i++) { const k = i / 5; ctx.strokeRect(64 - (50 - k * 36), 48 - (34 - k * 24), (50 - k * 36) * 2, (34 - k * 24) * 2); }
    ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(114, 82); ctx.moveTo(114, 14); ctx.lineTo(14, 82); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, 6, 12);
    ctx.fillRect(100, 5, 6, 6);
    for (let y = 0; y < h; y += 3) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y, w, 1); }
    for (let i = 0; i < 80; i++) { ctx.fillStyle = `rgba(255,255,255,${hashN(i, seed) * 0.15})`; ctx.fillRect(hashN(i, seed, 1) * w, hashN(i, seed, 2) * h, 2, 1); }
  });
}

function directoryTexture() {
  return canvasTex(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#10082a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 5; ctx.shadowColor = '#2ee6ff'; ctx.shadowBlur = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Arial Black", Impact, sans-serif';
    ctx.fillText('MALL DIRECTORY', w / 2, 36);
    const cols = ['#ff2ea6', '#40ff90', '#ff3040', '#ff8a30', '#ff3040', '#ffa020'];
    WINGS.forEach((wg, i) => {
      const y = 62 + i * 41;
      ctx.fillStyle = wg.open ? cols[i] : '#3a3050';
      ctx.fillRect(16, y, 8, 30);
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
      ctx.fillStyle = wg.open ? '#ffffff' : '#7a7090';
      ctx.fillText(`${i + 1}  ${wg.name}`.slice(0, 30), 32, y + 13);
      ctx.font = '11px "Trebuchet MS", sans-serif';
      ctx.fillStyle = wg.open ? '#ffcc33' : '#6a6080';
      ctx.fillText(wg.open ? 'OPEN: YOU ARE HERE' : 'LOCKED: COMING SOON', 32, y + 27);
    });
  });
}

// ---------- the builder ----------

export function buildMall(r, g, group) {
  const th = g.theme;
  const L = g.level;
  const { w, h } = g;
  const tileAt = (x, y) => g.tile(x, y);
  const S = TILE;
  const deco = new Set(L.decoTiles || []);
  if (L.hub && L.desk) for (let x = L.desk.x0; x <= L.desk.x1; x++) deco.add(L.desk.y * w + x);
  if (L.kitchen && L.counters) for (const [x, y, cw, ch] of L.counters) for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) deco.add((y + yy) * w + x + xx);
  const isWall = (x, y) => tileAt(x, y) === T.WALL && !deco.has(y * w + x);
  const open = (x, y) => { const t = tileAt(x, y); return t !== T.WALL && t !== T.VOID; };
  const col = (hex) => new THREE.Color(hex);

  r.torches = [];
  r.clouds = [];
  r.lavaMats = [];
  r.cracked = new Map();
  r.spikes = [];
  r.doors = new Map();
  r.shutters = [];
  r.hubPortals = [];
  r.merchant = null;
  r.fireLights = [];

  r.scene.background = col(th.sky);
  r.scene.fog = new THREE.Fog(th.fog, 380, 1150);
  r.hemi.color.set(th.light);
  r.hemi.groundColor.set(th.fog);
  r.hemi.intensity = th.ambient * 1.7;
  r.sun.color.set(th.light);
  r.sun.intensity = th.ambient * 1.1 + 0.3;

  // ---- floor: checkerboard terrazzo (or steel in the kitchen, console tiles in the Security Room) ----
  const floors = [], mosaic = [];
  const A = col(th.floorA), B = col(th.floorB);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const t = tileAt(tx, ty);
      if (t === T.WALL || t === T.VOID) { if (!(deco.has(ty * w + tx))) continue; }
      const x = tx * S + 16, z = ty * S + 16;
      const isMosaic = L.ground && L.ground[ty * w + tx] === 1;
      const c = (tx + ty) % 2 ? B : A;
      const shade = 0.66 + hashN(tx, ty) * 0.14; // dirty, uneven tiles
      (isMosaic ? mosaic : floors).push({ x, y: 0, z, rx: -Math.PI / 2, color: `#${c.clone().multiplyScalar(shade).getHexString()}` });
    }
  }
  const tileMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.05, emissive: '#ffffff', emissiveIntensity: 0.03 });
  tileMat.emissiveMap = null;
  r.instancedPrim(group, new THREE.PlaneGeometry(S, S), tileMat, floors);
  if (mosaic.length) {
    // the terrazzo centre: speckled stone with a neon edge
    const speck = canvasTex(128, 128, (ctx, cw, ch) => {
      ctx.fillStyle = '#f2e6d4'; ctx.fillRect(0, 0, cw, ch);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 38; i++) { ctx.fillStyle = ['#f0a0c0', '#90e0e0', '#f4d890', '#b0a0e8', '#e0d0b8'][i % 5]; ctx.beginPath(); ctx.ellipse(hashN(i, 1) * cw, hashN(i, 2) * ch, 6 + hashN(i, 3) * 9, 4 + hashN(i, 4) * 6, hashN(i, 5) * 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
    r.instancedPrim(group, new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: speck, roughness: 0.4, emissive: '#ffe8f4', emissiveIntensity: 0.12 }), mosaic.map((m) => ({ ...m, color: undefined })));
  }

  // ---- walls: pastel slabs with a neon band, only where they can be seen ----
  const walls = [], caps = [], bands = [];
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      if (!isWall(tx, ty)) continue;
      let near = false;
      for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -2; ox <= 2; ox++) if (open(tx + ox, ty + oy)) { near = true; break; }
      if (!near) continue;
      const x = tx * S + 16, z = ty * S + 16;
      const tone = th.wallSide;
      const tint = col(tone).offsetHSL(0, 0, (hashN(tx, ty) - 0.5) * 0.05);
      walls.push({ x, y: WALL_H / 2, z, sx: S, sy: WALL_H, sz: S, color: `#${tint.getHexString()}` });
      caps.push({ x, y: WALL_H + 0.6, z, sx: S - 1, sy: 1.2, sz: S - 1, color: th.wallTop });
      // neon band on every face that looks onto open floor
      const faces = [[0, -1, 0, -S / 2 - 0.4, S, 3], [0, 1, 0, S / 2 + 0.4, S, 3], [-1, 0, -S / 2 - 0.4, 0, 3, S], [1, 0, S / 2 + 0.4, 0, 3, S]];
      for (const [dx, dy, ox, oz, sx, sz] of faces) {
        if (!open(tx + dx, ty + dy)) continue;
        const k = (tx + ty) % 3;
        const bc = k === 0 ? th.neonA : k === 1 ? th.neonB : th.neonC;
        bands.push({ x: x + ox, y: WALL_H * 0.62, z: z + oz, sx: sx === 3 ? 1.6 : sx, sy: 4, sz: sz === 3 ? 1.6 : sz, color: bc });
      }
    }
  }
  r.instancedPrim(group, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, emissive: '#1a2a1a', emissiveIntensity: 0.2 }), walls);
  r.instancedPrim(group, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.06 }), caps);
  r.instancedPrim(group, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), bands);

  // ---- grime: blood smears on the floor and drag marks up the walls (two instanced draws) ----
  {
    const smear = canvasTex(128, 128, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      for (let i = 0; i < 9; i++) {
        const a = hashN(i, 7) * Math.PI * 2, rr = 10 + hashN(i, 8) * 40;
        ctx.fillStyle = i % 3 ? 'rgba(90,6,6,0.75)' : 'rgba(40,2,4,0.8)';
        ctx.beginPath(); ctx.ellipse(64 + Math.cos(a) * rr * 0.6, 64 + Math.sin(a) * rr * 0.6, 8 + hashN(i, 9) * 22, 5 + hashN(i, 10) * 14, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(70,4,6,0.7)'; ctx.fillRect(58, 64, 10, 60); // a drag trail
    });
    const smearMat = new THREE.MeshBasicMaterial({ map: smear, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const fl = [], wl = [];
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const t = tileAt(tx, ty);
        const x = tx * S + 16, z = ty * S + 16;
        if (t === T.FLOOR && hashN(tx * 3 + 1, ty * 5 + 2) > 0.86) {
          const sc = 22 + hashN(tx, ty * 7) * 30;
          fl.push({ x: x + (hashN(tx, ty) - 0.5) * 16, y: 0.5, z: z + (hashN(ty, tx) - 0.5) * 16, rx: -Math.PI / 2, rz: hashN(tx + 9, ty) * 6.28, sx: sc, sy: sc, sz: 1 });
        }
        if (isWall(tx, ty) && hashN(tx * 7 + 3, ty * 3 + 1) > 0.78) {
          for (const [dx, dy, ox, oz, ry] of [[0, -1, 0, -S / 2 - 0.6, Math.PI], [0, 1, 0, S / 2 + 0.6, 0], [-1, 0, -S / 2 - 0.6, 0, -Math.PI / 2], [1, 0, S / 2 + 0.6, 0, Math.PI / 2]]) {
            if (!open(tx + dx, ty + dy)) continue;
            wl.push({ x: x + ox, y: 14 + hashN(tx, ty) * 14, z: z + oz, ry, sx: 26, sy: 26, sz: 1 });
            break;
          }
        }
      }
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const f = r.instancedPrim(group, quad, smearMat, fl); if (f) f.renderOrder = 1;
    const wv = r.instancedPrim(group, quad, smearMat, wl); if (wv) wv.renderOrder = 1;
  }

  // ---- stalls: awnings and neon signs ----
  const addSign = (text, color, cx, y, cz, ry, sw = 130, sh = 40, sub = '') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: neonSignTexture(text, color, sub), toneMapped: false }));
    m.position.set(cx, y, cz);
    m.rotation.y = ry;
    group.add(m);
    const halo = glowSprite(color, sw * 1.5, 0.35);
    halo.position.set(cx, y, cz + (ry === 0 ? 4 : -4));
    group.add(halo);
    return m;
  };
  if (L.stalls) {
    for (const st of L.stalls) {
      const x0 = st.x0 * S, x1 = (st.x1 + 1) * S, cx = (x0 + x1) / 2, sw = x1 - x0;
      const front = st.south ? st.y0 * S - 0.6 : (st.y1 + 1) * S + 0.6;
      const ry = st.south ? Math.PI : 0;
      addSign(st.name, st.color, cx, WALL_H * 0.78, front + (st.south ? -0.5 : 0.5), ry, Math.min(sw - 20, 170), 48);
      // striped awning over the counter
      const aw = new THREE.Mesh(new THREE.BoxGeometry(sw, 3, 14), new THREE.MeshStandardMaterial({ map: stripeTex(st.color, '#ffffff', 10), roughness: 0.8, emissive: st.color, emissiveIntensity: 0.1 }));
      aw.position.set(cx, WALL_H * 0.5, front + (st.south ? -7 : 7));
      aw.rotation.x = st.south ? -0.28 : 0.28;
      group.add(aw);
      // a glowing counter lip on the floor side
      const lip = new THREE.Mesh(new THREE.BoxGeometry(sw, 3, 3), new THREE.MeshBasicMaterial({ color: st.color, toneMapped: false }));
      lip.position.set(cx, WALL_H * 0.28, front + (st.south ? -2 : 2));
      group.add(lip);
      r.torches.push({ x: cx, z: front + (st.south ? -26 : 26), y: 40, color: st.color, power: 150 });
      // menu board
      addSign(st.name === 'PIZZA' ? 'SLICE $1' : st.name === 'BURGERS' ? 'COMBO #5' : st.name === 'TACO' ? 'TUESDAY!' : '2 FOR 1', '#ffffff', cx - sw * 0.33, WALL_H * 0.42, front + (st.south ? -0.6 : 0.6), ry, 54, 18);
    }
  }

  // ---- low counters (the pizza counter Ray hides behind) ----
  for (const c of L.lowCounters || []) {
    const cw = (c.x1 - c.x0 + 1) * S, cd = (c.y1 - c.y0 + 1) * S;
    const body = new THREE.Mesh(new THREE.BoxGeometry(cw, 22, cd - 8), new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: 0.5 }));
    body.position.set(c.x0 * S + cw / 2, 11, c.y0 * S + cd / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(cw + 2, 3, cd - 4), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.4, emissive: c.color, emissiveIntensity: 0.25 }));
    top.position.set(c.x0 * S + cw / 2, 23.5, c.y0 * S + cd / 2);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(cw, 2, 2), new THREE.MeshBasicMaterial({ color: c.color, toneMapped: false }));
    lip.position.set(c.x0 * S + cw / 2, 18, c.y0 * S + cd / 2 - cd / 2 + 2);
    group.add(body, top, lip);
  }

  // ---- overturned tables and palm planters ----
  if (L.tables) {
    const topMat = new THREE.MeshStandardMaterial({ color: '#ff8ac8', roughness: 0.4, emissive: '#7a1a50', emissiveIntensity: 0.2 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#d8dce8', metalness: 0.8, roughness: 0.3 });
    const chairMat = new THREE.MeshStandardMaterial({ color: '#2ee6ff', roughness: 0.5, emissive: '#0a5a70', emissiveIntensity: 0.2 });
    for (const t of L.tables) {
      const cx = (t.x + t.w / 2) * S, cz = (t.y + t.h / 2) * S;
      const flip = hashN(t.x, t.y) * 0.5 + 0.25;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(t.w, t.h) * S * 0.46, Math.max(t.w, t.h) * S * 0.46, 3, 14), topMat);
      top.scale.set(t.w >= t.h ? 1 : 0.62, 1, t.h >= t.w ? 1 : 0.62);
      top.position.set(cx, 20, cz);
      top.rotation.set(t.w >= t.h ? flip : 0, 0, t.w < t.h ? flip : 0);
      group.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 22, 6), legMat);
      leg.position.set(cx, 11, cz);
      leg.rotation.set(t.w >= t.h ? flip : 0, 0, t.w < t.h ? flip : 0);
      group.add(leg);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 2, 10), legMat);
      base.position.set(cx + (t.w >= t.h ? 0 : 9), 14, cz + (t.w >= t.h ? 9 : 0));
      base.rotation.x = Math.PI / 2 - 0.3;
      group.add(base);
      // a toppled chair beside it
      const seat = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 11), chairMat);
      seat.position.set(cx + (hashN(t.y, t.x) - 0.5) * 36, 6, cz + (t.w >= t.h ? 24 : 0));
      seat.rotation.set(1.1, hashN(t.x, t.y, 4) * 3, 0.3);
      group.add(seat);
    }
  }
  if (L.palms) {
    const pot = new THREE.MeshStandardMaterial({ color: '#f2eadc', roughness: 0.6 });
    const band = new THREE.MeshBasicMaterial({ color: th.neonB, toneMapped: false });
    const trunk = new THREE.MeshStandardMaterial({ color: '#9a6a34', roughness: 0.9 });
    const leaf = new THREE.MeshStandardMaterial({ color: '#2fe07a', roughness: 0.7, emissive: '#0a5a2a', emissiveIntensity: 0.35, side: THREE.DoubleSide });
    for (const p of L.palms) {
      const cx = p.x * S + 16, cz = p.y * S + 16;
      const planter = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 26), pot);
      planter.position.set(cx, 7, cz);
      const bnd = new THREE.Mesh(new THREE.BoxGeometry(27, 3, 27), band);
      bnd.position.set(cx, 11, cz);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 34, 7), trunk);
      tr.position.set(cx, 30, cz);
      tr.rotation.z = (hashN(p.x, p.y) - 0.5) * 0.2;
      group.add(planter, bnd, tr);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + hashN(p.x, p.y, 7);
        const fr = new THREE.Mesh(new THREE.ConeGeometry(4.6, 30, 4), leaf);
        fr.scale.set(1, 1, 0.22);
        fr.position.set(cx + Math.cos(a) * 11, 50, cz + Math.sin(a) * 11);
        fr.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
        group.add(fr);
      }
    }
  }

  // ---- shutters: rolling steel doors over the security gate and the armory locker ----
  const shutterMat = new THREE.MeshStandardMaterial({ map: stripeTex('#aab2c4', '#8890a4', 14, false), roughness: 0.5, metalness: 0.5, emissive: '#202838', emissiveIntensity: 0.2 });
  const addShutter = (id, cx, cz, len, vertical) => {
    const grp = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 4 : len, WALL_H * 0.9, vertical ? len : 4), shutterMat);
    slab.position.y = WALL_H * 0.45;
    grp.add(slab);
    const box = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 8 : len + 6, 8, vertical ? len + 6 : 8), new THREE.MeshStandardMaterial({ color: '#3a3a48', metalness: 0.6, roughness: 0.4 }));
    box.position.y = WALL_H * 0.93;
    grp.add(box);
    grp.position.set(cx, 0, cz);
    group.add(grp);
    r.shutters.push({ id, grp, slab, closed: 0, h: WALL_H * 0.9 });
    return grp;
  };
  if (L.shutters) {
    for (const s of L.shutters) {
      if (s.vertical) addShutter(s.id, s.x * S + 16, ((s.y0 + s.y1 + 1) / 2) * S, (s.y1 - s.y0 + 1) * S, true);
      else addShutter(s.id, ((s.x + s.x1 + 1) / 2) * S, s.y * S + 16, (s.x1 - s.x + 1) * S, false);
    }
  }

  // ---- Wing 1 specifics: signs over the gate, the locker and the barricaded escalator ----
  if (L.foodCourt) {
    addSign('SECURITY GATE', '#ff5a5a', 11 * S - 2, WALL_H * 0.8, 23.5 * S, -Math.PI / 2, 120, 36);
    addSign('ARMORY', '#ff8a30', 18.5 * S, WALL_H * 0.78, 38 * S - 0.6, Math.PI, 110, 36, 'SECURITY LOCKER');
    addSign('FOOD COURT', '#ff2ea6', 37 * S, WALL_H * 0.92, 5 * S + 14, 0, 220, 60, 'BLACK FRIDAY SALE');
    addSign('SERVICE TUNNELS', '#2ee6ff', 63 * S + 4, WALL_H * 0.82, 23.5 * S, Math.PI / 2, 130, 36);
    // the escalator barricade: crossed planks and a broken escalator
    const planks = new THREE.MeshStandardMaterial({ color: '#c89050', roughness: 0.9 });
    for (let k = 0; k < 5; k++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 70), planks);
      pl.position.set(65 * S + (k % 2) * 8, 14 + k * 5, 23.5 * S + (k - 2) * 4);
      pl.rotation.set(0.5 * (k % 2 ? 1 : -1), 0, 0.2);
      group.add(pl);
    }
    r.torches.push({ x: 18.5 * S, z: 40 * S, y: 34, color: '#ff6a1a', power: 170, fire: true });
    r.torches.push({ x: 53.5 * S, z: 38 * S, y: 40, color: '#ffa040', power: 120 });
    r.torches.push({ x: 9 * S, z: 23 * S, y: 40, color: '#ff4a4a', power: 100 });
    r.torches.push({ x: 66 * S, z: 23.5 * S, y: 40, color: '#2ee6ff', power: 130 });
    for (const [tx, ty, c] of [[22, 12, th.neonA], [37, 24, th.neonC], [52, 14, th.neonB], [30, 34, th.neonB], [45, 32, th.neonA]]) r.torches.push({ x: tx * S, z: ty * S, y: 46, color: c, power: 100 });
    // the locker's flames
    for (let i = 0; i < 5; i++) {
      const f = glowSprite('#ff7a1a', 40, 0.7);
      f.position.set(16 * S + i * 22 + 10, 14 + (i % 2) * 8, 40 * S);
      group.add(f);
      r.fireLights.push(f);
    }
  }
  if (L.kitchen) {
    // steel prep counters, hanging pans and a glowing fryer row
    const steel = new THREE.MeshStandardMaterial({ color: '#d8dee8', metalness: 0.7, roughness: 0.3 });
    for (const [x, y, cw, ch] of L.counters) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(cw * S, 28, ch * S), steel);
      top.position.set((x + cw / 2) * S, 14, (y + ch / 2) * S);
      group.add(top);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(cw * S + 1, 2, ch * S + 1), new THREE.MeshBasicMaterial({ color: th.neonA, toneMapped: false }));
      glow.position.set((x + cw / 2) * S, 29, (y + ch / 2) * S);
      group.add(glow);
    }
    addSign("BUTCHER'S KITCHEN", '#ff7a1a', 30 * S, WALL_H * 0.85, 2.5 * S + 12, 0, 240, 60, 'EMPLOYEES ONLY');
    addSign('LOADING DOCK', '#2ee6ff', 6 * S, WALL_H * 0.8, 12 * S + 4, 0, 130, 34);
    for (const [tx, ty, c] of [[22, 8, '#ff7a1a'], [36, 8, '#ffd040'], [22, 24, '#ff2ea6'], [36, 24, '#ff7a1a'], [30, 16, '#ff5a1a'], [7, 16, '#2ee6ff']]) r.torches.push({ x: tx * S, z: ty * S, y: 50, color: c, power: 150 });
  }

  // ---- the Security Room ----
  if (L.hub) buildSecurityRoom(r, g, group, addSign);

  // exit portal for levels with one
  r.exit = null;
  const ex = L.exit;
  if (ex) {
    r.exitSealed = tileAt(ex.x, ex.y) === T.SEALED;
    r.exit = r.portalAt(group, ex.x, ex.y, r.exitSealed);
  }
  r.setAmbient(th.particles);
}

function buildSecurityRoom(r, g, group, addSign) {
  const S = TILE, L = g.level, th = g.theme;
  // the monitor wall: a bank of flickering CRTs
  const feeds = ['CAM 01 FOOD COURT', 'CAM 02 ARCADE', 'CAM 03 THEATER', 'CAM 04 GYM', 'CAM 05 TOY STORE', 'CAM 06 GARDEN', 'CAM 07 ROOF'];
  r.crts = [];
  for (let i = 0; i < 7; i++) {
    const row = i < 4 ? 0 : 1;
    const x = (4.4 + i * 3.5 - (row ? 12.2 : 0) + (row ? 0.8 : 0)) * S + (row ? 3.5 * S : 0);
    const cx = (4.4 + (i % 4) * 3.6 + (row ? 1.6 : 0)) * S, cy = 24 + row * 18, cz = 2.45 * S + 4;
    void x;
    const col = ['#2ee6ff', '#ff2ea6', '#40ff90', '#ffcc33'][i % 4];
    const casing = new THREE.Mesh(new THREE.BoxGeometry(46, 32, 22), new THREE.MeshStandardMaterial({ color: '#2a2a34', roughness: 0.6 }));
    casing.position.set(cx, cy, cz);
    group.add(casing);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(38, 26), new THREE.MeshBasicMaterial({ map: crtTexture(feeds[i], col, i), toneMapped: false }));
    scr.position.set(cx, cy, cz + 11.2);
    group.add(scr);
    r.crts.push(scr);
    const halo = glowSprite(col, 70, 0.28);
    halo.position.set(cx, cy, cz + 18);
    group.add(halo);
    if (i % 2 === 0) r.torches.push({ x: cx, z: cz + 40, y: 40, color: col, power: 90 });
  }
  addSign('SECURITY ROOM', '#2ee6ff', 15 * S, WALL_H * 0.9, 2.5 * S - 2 + 40, 0, 200, 50, 'MALL OF THE DEAD');
  // the console desk across the middle
  const desk = L.desk;
  if (desk) {
    const dw = (desk.x1 - desk.x0 + 1) * S;
    const body = new THREE.Mesh(new THREE.BoxGeometry(dw, 22, S - 4), new THREE.MeshStandardMaterial({ color: '#2a2a3a', roughness: 0.5 }));
    body.position.set(desk.x0 * S + dw / 2, 11, desk.y * S + 16);
    group.add(body);
    const topP = new THREE.Mesh(new THREE.BoxGeometry(dw + 2, 3, S + 2), new THREE.MeshStandardMaterial({ color: '#3a3a52', metalness: 0.4, roughness: 0.4 }));
    topP.position.set(desk.x0 * S + dw / 2, 23, desk.y * S + 16);
    group.add(topP);
    for (let i = 0; i < 24; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 4), new THREE.MeshBasicMaterial({ color: ['#2ee6ff', '#ff2ea6', '#ffcc33', '#40ff90'][i % 4], toneMapped: false }));
      b.position.set(desk.x0 * S + 14 + i * ((dw - 28) / 23), 25.5, desk.y * S + 14 + (i % 3) * 6);
      group.add(b);
    }
  }
  // the Mall Directory kiosk
  const dir = L.directory;
  const kioskBack = new THREE.Mesh(new THREE.BoxGeometry(56, 48, 8), new THREE.MeshStandardMaterial({ color: '#1a1030', roughness: 0.5 }));
  kioskBack.position.set((dir.x + 0.5) * S, 24, (dir.y + 0.5) * S);
  group.add(kioskBack);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(50, 42), new THREE.MeshBasicMaterial({ map: directoryTexture(), toneMapped: false }));
  board.position.set((dir.x + 0.5) * S, 25, (dir.y + 0.5) * S + 4.2);
  group.add(board);
  const dh = glowSprite('#2ee6ff', 80, 0.3);
  dh.position.set((dir.x + 0.5) * S, 25, (dir.y + 0.5) * S + 12);
  group.add(dh);
  r.torches.push({ x: (dir.x + 0.5) * S, z: (dir.y + 3) * S, y: 40, color: '#2ee6ff', power: 160 });
  // the cash upgrade counter and its clerk
  const sh = L.shop;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(34, 24, 3 * S), new THREE.MeshStandardMaterial({ color: '#ff4fb8', roughness: 0.4, emissive: '#7a1a5a', emissiveIntensity: 0.4 }));
  counter.position.set((sh.x + 1.5) * S, 12, (sh.y + 0.5) * S);
  group.add(counter);
  const till = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 14), new THREE.MeshStandardMaterial({ color: '#d8dce8', metalness: 0.6, roughness: 0.3 }));
  till.position.set((sh.x + 1.5) * S, 29, (sh.y + 0.5) * S);
  group.add(till);
  addSign('CASH', '#ffcc33', (sh.x + 1.5) * S + 18, 52, (sh.y + 0.5) * S, Math.PI / 2, 90, 30, 'UPGRADES');
  r.torches.push({ x: (sh.x + 1.5) * S, z: (sh.y + 0.5) * S, y: 50, color: '#ffcc33', power: 130 });
  r.clerkSpot = { x: (sh.x + 0.4) * S, z: (sh.y + 0.5) * S };
  r.makeClerk(group);
  // lockers along the east wall; one carries Ray's name tag
  const ray = L.ray;
  const lockerMat = new THREE.MeshStandardMaterial({ color: '#4a5a82', roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const lk = new THREE.Mesh(new THREE.BoxGeometry(22, 48, 18), lockerMat);
    lk.position.set(26.2 * S + 6, 24, (5 + i * 1.05) * S);
    lk.rotation.y = -Math.PI / 2;
    group.add(lk);
  }
  const story = g.story;
  if (!ray.present && story && story.flags.rayAlive === false) {
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), new THREE.MeshBasicMaterial({ map: canvasTex(128, 48, (ctx, cw, ch) => { ctx.fillStyle = '#f4ecd8'; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = '#2a1a10'; ctx.font = 'bold 34px "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RAY', cw / 2, 36); }), toneMapped: false }));
    tag.position.set(26.2 * S - 4.6, 36, 7.1 * S);
    tag.rotation.y = -Math.PI / 2;
    group.add(tag);
    // an empty stool where the pizza cook used to sit
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 2, 10), new THREE.MeshStandardMaterial({ color: '#e8412a' }));
    stool.position.set(22 * S, 18, 8 * S);
    const sleg = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 18, 6), new THREE.MeshStandardMaterial({ color: '#c8ccd8', metalness: 0.7 }));
    sleg.position.set(22 * S, 9, 8 * S);
    group.add(stool, sleg);
  }
  r.torches.push({ x: 15 * S, z: 8 * S, y: 52, color: '#ff4fb8', power: 150 });
  r.torches.push({ x: 24 * S, z: 12 * S, y: 52, color: '#2ee6ff', power: 120 });
  void th;
}
