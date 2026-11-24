// Survivor models in the style of the 1990s arcade era: adult proportions, smooth low-poly
// limbs and bold 90s mall costumes. Each hero is assembled from shaped parts attached to the
// bones of a shared rig (from the CC0 KayKit pack) so every KayKit animation drives it.
// The rig's bones are re-positioned to adult lengths; bone-local Y always runs along a bone.

import * as THREE from 'three';

// ---------- rig proportions (metres) ----------

const ANKLE = 0.08;
const UPLEG_Y = 0.03;
export const BASE_HIPS = 0.406; // hips height of the original rig

export const RIGS = {
  male:   { leg: 0.44, shin: 0.42, spine: 0.11, chest: 0.24, neck: 0.25, shoulder: 0.175, shoulderY: 0.19, arm: 0.29, fore: 0.25, hipW: 0.095 },
  big:    { leg: 0.46, shin: 0.43, spine: 0.12, chest: 0.26, neck: 0.26, shoulder: 0.2, shoulderY: 0.2, arm: 0.31, fore: 0.27, hipW: 0.105 },
  female: { leg: 0.44, shin: 0.41, spine: 0.11, chest: 0.22, neck: 0.23, shoulder: 0.15, shoulderY: 0.175, arm: 0.27, fore: 0.23, hipW: 0.092 },
  dwarf:  { leg: 0.27, shin: 0.25, spine: 0.1, chest: 0.25, neck: 0.22, shoulder: 0.2, shoulderY: 0.19, arm: 0.25, fore: 0.22, hipW: 0.105 },
};

export const hipsHeight = (rig) => ANKLE + rig.leg + rig.shin - UPLEG_Y;

export function applyRig(root, rig) {
  const set = (name, x, y, z) => {
    const b = root.getObjectByName(name);
    if (b) { b.position.set(x, y, z); b.scale.set(1, 1, 1); }
  };
  const hips = root.getObjectByName('hips');
  if (hips) hips.position.y = hipsHeight(rig);
  set('spine', 0, rig.spine, 0);
  set('chest', 0, rig.chest, 0);
  set('head', 0, rig.neck, 0);
  for (const [side, sx] of [['l', 1], ['r', -1]]) {
    set(`upperleg${side}`, sx * rig.hipW, UPLEG_Y, 0);
    set(`lowerleg${side}`, 0, rig.leg, 0);
    set(`foot${side}`, 0, rig.shin, 0);
    set(`toes${side}`, 0, 0.14, 0);
    set(`upperarm${side}`, sx * rig.shoulder, rig.shoulderY, 0);
    set(`lowerarm${side}`, 0, rig.arm, 0);
    set(`wrist${side}`, 0, rig.fore, 0);
    set(`hand${side}`, 0, 0.05, 0);
    set(`handslot${side}`, 0, 0.08, -0.03);
  }
}

// ---------- body shapes ----------

const BODIES = {
  muscular: { chest: 0.19, chestD: 0.66, waist: 0.135, hip: 0.14, arm: 0.066, fore: 0.054, thigh: 0.094, calf: 0.064, neck: 0.062, delt: 0.078, head: 1 },
  athletic: { chest: 0.165, chestD: 0.66, waist: 0.122, hip: 0.132, arm: 0.052, fore: 0.044, thigh: 0.084, calf: 0.057, neck: 0.05, delt: 0.06, head: 1 },
  female:   { chest: 0.142, chestD: 0.7, waist: 0.1, hip: 0.138, arm: 0.04, fore: 0.034, thigh: 0.078, calf: 0.05, neck: 0.04, delt: 0.046, head: 0.93, bust: true },
  stocky:   { chest: 0.205, chestD: 0.78, waist: 0.18, hip: 0.165, arm: 0.066, fore: 0.06, thigh: 0.092, calf: 0.072, neck: 0.066, delt: 0.072, head: 1.06 },
  huge:     { chest: 0.22, chestD: 0.7, waist: 0.16, hip: 0.155, arm: 0.078, fore: 0.064, thigh: 0.105, calf: 0.074, neck: 0.08, delt: 0.09, head: 1.1 },
};

// ---------- materials and textures ----------

const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  texCache.set(key, t);
  return t;
}

// Matte and faceted, like the hand-shaded low-poly models of 1999-2000; vertex colours carry
// baked ambient occlusion so joints and undersides darken.
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: true, vertexColors: true, ...opts });
}
const metal = (color, opts = {}) => mat(color, { metalness: 0.7, roughness: 0.38, ...opts });

function shade(hex, l) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, l);
  return `#${c.getHexString()}`;
}

// Vertical stripes (robes, headdresses, tiger fur).
function stripes(colors, count, wavy = false) {
  return canvasTex(`stripes:${colors}:${count}:${wavy}`, 128, 128, (ctx, w, h) => {
    const sw = w / count;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[i % colors.length];
      if (!wavy) { ctx.fillRect(i * sw, 0, sw + 1, h); continue; }
      ctx.beginPath();
      ctx.moveTo(i * sw, 0);
      for (let y = 0; y <= h; y += 8) ctx.lineTo(i * sw + Math.sin(y * 0.15 + i) * sw * 0.25, y);
      ctx.lineTo((i + 1) * sw, h);
      ctx.lineTo((i + 1) * sw, 0);
      ctx.fill();
    }
  });
}

// Muscle definition painted onto a bare torso (front faces u = 0.5).
function torsoTex(skin) {
  return canvasTex(`torso:${skin}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, w, h);
    const dark = shade(skin, -0.12), light = shade(skin, 0.06);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    // abs: two columns of three blocks, low on the abdomen texture
    for (let r = 0; r < 3; r++) for (const s of [-1, 1]) {
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(w / 2 + s * 11, h * (0.78 - r * 0.2), 9, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.25); ctx.lineTo(w / 2, h); ctx.stroke();
  });
}

function chestTex(skin) {
  return canvasTex(`chest:${skin}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, w, h);
    const dark = shade(skin, -0.13), light = shade(skin, 0.07);
    for (const s of [-1, 1]) {
      ctx.fillStyle = light;
      ctx.beginPath(); ctx.ellipse(w / 2 + s * 20, h * 0.62, 20, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(w / 2 + s * 20, h * 0.66, 20, 15, 0, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    }
  });
}

// Face painted around u = 0.25 of a sphere (its +Z side).
function faceTex(f) {
  const key = `face:${JSON.stringify(f)}`;
  return canvasTex(key, 512, 256, (ctx, w, h) => {
    const cx = w * 0.25;
    ctx.fillStyle = f.skin;
    ctx.fillRect(0, 0, w, h);
    // faint mottling so skin isn't a flat fill
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? shade(f.skin, -0.03) : shade(f.skin, 0.025);
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const soft = (x, y, rx, ry, color, alpha) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    const dark = shade(f.skin, -0.18);
    // eye sockets, cheek hollows and the shadow under the nose
    for (const s of [-1, 1]) {
      soft(cx + s * 28, 114, 20, 12, dark, 0.35);
      soft(cx + s * 36, 150, 12, 16, dark, f.female ? 0.08 : 0.18);
      if (f.female) soft(cx + s * 34, 140, 11, 7, '#e07070', 0.18); // blush
    }
    soft(cx, 148, 12, 4, dark, 0.45);
    // eyes
    for (const s of [-1, 1]) {
      const ex = cx + s * 28, ey = 116;
      const ew = 11, eh = f.female ? 5.2 : 4.4;
      if (f.makeup) soft(ex, ey - 7, 14, 6, f.makeup, 0.55);
      ctx.fillStyle = '#f2ece4';
      ctx.beginPath();
      ctx.moveTo(ex - ew, ey); ctx.quadraticCurveTo(ex, ey - eh * 2, ex + ew, ey); ctx.quadraticCurveTo(ex, ey + eh * 1.5, ex - ew, ey);
      ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = f.eyes || '#3a5a8a';
      ctx.beginPath(); ctx.arc(ex - s * 0.5, ey - 0.5, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c0a0a';
      ctx.beginPath(); ctx.arc(ex - s * 0.5, ey - 0.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(ex - s * 0.5 + 1, ey - 3, 1.6, 1.6);
      ctx.restore();
      // upper lid, crease and lower lid
      ctx.strokeStyle = '#1a100c'; ctx.lineWidth = f.female ? 2.8 : 2;
      ctx.beginPath(); ctx.moveTo(ex - ew - 1, ey + 0.5); ctx.quadraticCurveTo(ex, ey - eh * 2.1, ex + ew + (f.female ? 3 : 1), ey - (f.female ? 2 : 0)); ctx.stroke();
      ctx.strokeStyle = shade(f.skin, -0.22); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ex - ew + 1, ey - 4); ctx.quadraticCurveTo(ex, ey - eh * 2.9, ex + ew, ey - 4); ctx.stroke();
      ctx.strokeStyle = shade(f.skin, -0.15); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex - ew + 2, ey + 1); ctx.quadraticCurveTo(ex, ey + eh * 1.7, ex + ew - 1, ey + 1); ctx.stroke();
      // brows: tapered strokes, lower and heavier on men
      ctx.fillStyle = f.brows || '#3a2416';
      const by = ey - (f.female ? 13 : 10), drop = f.angry ? 4 : 0;
      ctx.beginPath();
      ctx.moveTo(ex - s * 13, by + 2 + drop);
      ctx.quadraticCurveTo(ex - s * 2, by - 4, ex + s * 14, by + (f.female ? -1 : 1));
      ctx.quadraticCurveTo(ex - s * 2, by + (f.female ? -1 : 1), ex - s * 13, by + (f.female ? 4 : 6) + drop);
      ctx.fill();
    }
    // nostrils
    for (const s of [-1, 1]) soft(cx + s * 6, 143, 3.2, 1.8, shade(f.skin, -0.35), 0.8);
    // mouth
    if (f.lips) {
      ctx.fillStyle = f.lips;
      ctx.beginPath();
      ctx.moveTo(cx - 14, 160); ctx.quadraticCurveTo(cx - 6, 154, cx, 157); ctx.quadraticCurveTo(cx + 6, 154, cx + 14, 160);
      ctx.quadraticCurveTo(cx, 170, cx - 14, 160);
      ctx.fill();
      ctx.strokeStyle = shade(f.lips, -0.3); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - 13, 160); ctx.quadraticCurveTo(cx, 162, cx + 13, 160); ctx.stroke();
      soft(cx + 3, 164, 4, 1.5, '#ffffff', 0.25);
    } else {
      ctx.strokeStyle = shade(f.skin, -0.22); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 13, 160); ctx.quadraticCurveTo(cx, f.angry ? 161.5 : 159.5, cx + 13, 160); ctx.stroke();
      soft(cx, 164, 9, 2.5, shade(f.skin, 0.06), 0.7); // lower lip catches the light
    }
    if (f.beard) {
      ctx.fillStyle = f.beard;
      ctx.beginPath();
      ctx.moveTo(cx - 44, 126); ctx.quadraticCurveTo(cx - 40, 206, cx, 222); ctx.quadraticCurveTo(cx + 40, 206, cx + 44, 126);
      ctx.lineTo(cx + 26, 134); ctx.quadraticCurveTo(cx + 16, 150, cx + 12, 152); ctx.lineTo(cx - 12, 152); ctx.quadraticCurveTo(cx - 16, 150, cx - 26, 134);
      ctx.fill();
      ctx.strokeStyle = shade(f.beard, 0.15); ctx.lineWidth = 1;
      for (let i = 0; i < 30; i++) { const x = cx - 38 + i * 2.6; ctx.beginPath(); ctx.moveTo(x, 150 + (i % 5) * 4); ctx.lineTo(x + 1, 175 + (i % 7) * 5); ctx.stroke(); }
      ctx.fillStyle = shade(f.skin, -0.25);
      ctx.beginPath(); ctx.ellipse(cx, 161, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (f.stubble) {
      soft(cx, 172, 36, 28, f.stubble, 0.22);
    }
    if (f.fangs) { // monsters: fangs over the lower lip
      ctx.fillStyle = '#f4ecd8';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 4, 160); ctx.lineTo(cx + s * 10, 160); ctx.lineTo(cx + s * 7, 170); ctx.fill(); }
    }
    if (f.scars) { // zombies: stitches and rot
      ctx.strokeStyle = shade(f.skin, -0.3); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + 30, 70); ctx.lineTo(cx + 46, 140); ctx.stroke();
      for (let i = 0; i < 5; i++) { const y = 80 + i * 13; ctx.beginPath(); ctx.moveTo(cx + 30 + i * 3, y); ctx.lineTo(cx + 40 + i * 3, y - 3); ctx.stroke(); }
      soft(cx - 30, 80, 18, 12, shade(f.skin, -0.25), 0.5);
    }
  });
}

// ---------- geometry helpers (all in bone-local space) ----------

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) {
    const g = make();
    if (!g.attributes.color) bakeAO(g, 'vertical');
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

// Fake ambient occlusion: 'vertical' darkens toward the bottom, 'ends' toward both ends
// (limb joints), along the geometry's Y axis.
function bakeAO(g, mode) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const span = Math.max(1e-6, max.y - min.y);
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - min.y) / span;
    const v = mode === 'ends' ? 0.62 + 0.38 * Math.pow(Math.sin(Math.PI * t), 0.55) : 0.72 + 0.28 * Math.pow(t, 0.7);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

function add(parent, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.frustumCulled = false;
  parent.add(m);
  return m;
}

// Lathed segment along +Y. profile: [[radius, y], ...] bottom to top.
function lathe(profile, seg = 14) {
  const key = `lathe:${profile.map((p) => p.map((v) => v.toFixed(4)).join(',')).join(';')}:${seg}`;
  return cached(key, () => {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
    g.computeVertexNormals();
    bakeAO(g, 'ends');
    return g;
  });
}

// A limb from 0 to len with a muscle bulge.
function limb(len, r0, rMid, r1, bulgeAt = 0.35) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const base = t < bulgeAt ? r0 + (rMid - r0) * Math.sin((t / bulgeAt) * Math.PI / 2) : rMid + (r1 - rMid) * ((t - bulgeAt) / (1 - bulgeAt)) ** 1.4;
    pts.push([base, t * len]);
  }
  pts[0][0] *= 0.85;
  pts[8][0] *= 0.85;
  return lathe(pts);
}

// A sculpted head: brow ridge, eye sockets, cheekbones, nose, jaw and chin pushed into a
// sphere. UVs are untouched, so the painted face (u = 0.25 is the front) lines up.
function headGeo(female) {
  return cached(`head:${female}`, () => {
    const g = new THREE.SphereGeometry(1, 30, 24);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const bump = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
    const k = female ? 0.55 : 1;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let { x, y, z } = v;
      const front = Math.max(0, z) ** 1.5;
      let d = 0;
      d += k * 0.08 * bump(x, y, 0, 0.27, 0.6, 0.08) * front;                                       // brow ridge
      d -= 0.075 * (bump(x, y, 0.33, 0.12, 0.16, 0.1) + bump(x, y, -0.33, 0.12, 0.16, 0.1)) * front; // eye sockets
      d += (female ? 0.05 : 0.06) * (bump(x, y, 0.5, -0.1, 0.16, 0.13) + bump(x, y, -0.5, -0.1, 0.16, 0.13)) * front; // cheekbones
      if (y < 0.24 && y > -0.26) {                                                                   // nose: a ridge growing to the tip
        const t = (0.24 - y) / 0.5;
        d += (female ? 0.15 : 0.22) * t * t * Math.exp(-((x / (0.07 + 0.06 * t)) ** 2)) * front;
      }
      d -= 0.012 * bump(x, y, 0, -0.39, 0.2, 0.035) * front;                                         // mouth line
      d += (female ? 0.03 : 0.012) * bump(x, y, 0, -0.45, 0.16, 0.05) * front;                       // lower lip
      d += k * 0.05 * bump(x, y, 0, -0.68, 0.22, 0.12) * front;                                     // chin
      x *= 1 + d; y *= 1 + d * 0.3; z *= 1 + d;
      if (y < -0.1) { const t = -y - 0.1; x *= 1 - t * (female ? 0.42 : 0.3); }                      // jaw tapers to the chin
      if (z < 0) z *= 1.1;                                                                           // fuller cranium
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    bakeAO(g, 'vertical');
    return g;
  });
}

// A box with rounded edges (fists, boots).
function roundedBox(round = 0.45) {
  return cached(`rbox${round}`, () => {
    const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const sph = v.clone().normalize().multiplyScalar(0.5 * Math.sqrt(3) * 0.62);
      v.lerp(sph, round);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

const sphere = (seg = 18) => cached(`sph${seg}`, () => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)));
const box = () => cached('box', () => new THREE.BoxGeometry(1, 1, 1));
// Top half of a sphere; tilted back it makes hair, helmets and hats that clear the eyes.
const cap = (seg = 18) => cached(`cap${seg}`, () => new THREE.SphereGeometry(1, seg, 10, 0, Math.PI * 2, 0, Math.PI * 0.55));
const CAP_TILT = -0.42;
const cylinder = (rt, rb, seg = 12) => cached(`cyl${rt},${rb},${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg));
const cone = (seg = 10) => cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg));
const torus = (r, t, arc = Math.PI * 2) => cached(`tor${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 8, 20, arc));

function shapeGeo(key, pts, depth, bevel = 0.004) {
  return cached(key, () => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });
}

// ---------- the body ----------

// Builds a full figure; `o` chooses a material for each zone so costumes are mostly a matter
// of which zones get skin and which get cloth/armour, with extras added on top.
function body(rig, B, o) {
  const bone = (n) => rig.getObjectByName(n);
  const skin = mat(o.skin, { roughness: 0.55 });
  const z = (k, fallback) => o[k] || fallback;
  const hips = bone('hips'), spine = bone('spine'), chest = bone('chest'), head = bone('head');
  const R = o.rig;

  // pelvis and abdomen (spine bone, local Y up, front +Z)
  const abs = z('abs', o.bare ? mat('#ffffff', { map: torsoTex(o.skin), roughness: 0.55 }) : skin);
  add(spine, lathe([[B.hip * 0.7, -R.spine - 0.06], [B.hip, -R.spine + 0.01], [B.hip * 0.98, -0.04], [B.waist, 0.04], [B.waist * 1.04, R.chest * 0.6], [B.chest * 0.92, R.chest + 0.01]]), abs, [0, 0, 0], [0, Math.PI, 0], [1, 1, B.chestD + 0.06]);
  // chest
  const chestMat = z('chest', o.bare ? mat('#ffffff', { map: chestTex(o.skin), roughness: 0.55 }) : skin);
  add(chest, lathe([[B.chest * 0.92, -0.02], [B.chest, 0.07], [B.chest * 1.02, 0.15], [B.chest * 0.82, R.shoulderY + 0.02], [B.neck * 1.3, R.neck * 0.92], [B.neck, R.neck + 0.01]]), chestMat, [0, 0, 0], [0, Math.PI, 0], [1, 1, B.chestD]);
  if (B.bust) for (const s of [-1, 1]) add(chest, sphere(), chestMat, [s * 0.052, 0.1, B.chest * B.chestD * 0.78], [0, 0, 0], [0.058, 0.055, 0.05]);
  // shoulders
  for (const side of ['l', 'r']) {
    const ua = bone(`upperarm${side}`);
    add(ua, sphere(), z('delt', z('upperArm', skin)), [0, 0.02, 0], [0, 0, 0], [B.delt, B.delt * 1.05, B.delt]);
  }
  // neck and head
  add(head, cylinder(1, 1.15), z('neckMat', skin), [0, 0.04, 0.005], [0, 0, 0], [B.neck, 0.1, B.neck]);
  if (o.face !== false) {
    const hs = B.head;
    const female = !!(o.face && o.face.female);
    const faceMat = mat('#ffffff', { map: faceTex({ skin: o.skin, ...o.face }), roughness: 0.75 });
    const hd = add(head, headGeo(female), faceMat, [0, 0.15 * hs, 0.012], [0, 0, 0], [0.088 * hs, 0.118 * hs, 0.104 * hs]);
    hd.userData.isHead = true;
    if (o.face && o.face.beard) add(head, roundedBox(0.6), mat(o.face.beard, { roughness: 0.95, map: strands(o.face.beard) }), [0, 0.07 * hs, 0.055], [0.25, 0, 0], [0.12 * hs, 0.09 * hs, 0.09 * hs]); // beard bulk
    for (const s of [-1, 1]) add(head, sphere(8), skin, [s * 0.086 * hs, 0.15 * hs, -0.005], [0, 0, 0], [0.014, 0.028, 0.02]); // ears
  }
  // arms
  for (const side of ['l', 'r']) {
    add(bone(`upperarm${side}`), limb(R.arm, B.arm * 0.95, B.arm * 1.12, B.arm * 0.8, 0.45), z('upperArm', skin));
    add(bone(`lowerarm${side}`), limb(R.fore, B.fore * 1.05, B.fore * 1.1, B.fore * 0.72, 0.25), z('foreArm', skin));
    const hand = z('hands', skin);
    add(bone(`hand${side}`), roundedBox(0.5), hand, [0, 0.035, 0], [0, 0, 0], [0.058 * B.head, 0.08 * B.head, 0.042 * B.head]); // fist
    add(bone(`hand${side}`), roundedBox(0.5), hand, [side === 'l' ? -0.024 : 0.024, 0.02, 0.014], [0, 0, side === 'l' ? 0.4 : -0.4], [0.018, 0.042, 0.018]); // thumb
  }
  // legs
  for (const side of ['l', 'r']) {
    add(bone(`upperleg${side}`), limb(R.leg, B.thigh * 1.08, B.thigh * 1.06, B.calf * 0.92, 0.2), z('thigh', skin));
    add(bone(`lowerleg${side}`), limb(R.shin, B.calf * 0.85, B.calf * 1.08, B.calf * 0.62, 0.3), z('calf', skin));
    // foot: an elongated wedge pointing along the foot bone toward the toes
    add(bone(`foot${side}`), roundedBox(0.4), z('feet', skin), [0, 0.06, -0.012], [0.15, 0, 0], [0.085 * B.head, 0.2, 0.07]);
  }
  return { bone, skin, hips, spine, chest, head };
}

// ---------- costume pieces ----------

// Strand texture for hair and beards.
function strands(color) {
  return canvasTex(`strands:${color}`, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = i % 3 ? shade(color, -0.12) : shade(color, 0.12);
      ctx.lineWidth = 1 + (i % 2);
      const x = (i * 37) % w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 1, h); ctx.stroke();
    }
  });
}

// Long hair: a crown over the scalp and a fan of chunky locks down the back and sides.
function hairLong(head, color, hs = 1, length = 0.3) {
  const m = mat('#ffffff', { map: strands(color), roughness: 0.9 });
  const tint = new THREE.Color(color);
  m.color.setRGB(Math.min(1, tint.r * 0.3 + 0.75), Math.min(1, tint.g * 0.3 + 0.75), Math.min(1, tint.b * 0.3 + 0.75));
  add(head, cap(), m, [0, 0.162 * hs, 0.022 * hs], [CAP_TILT, 0, 0], [0.099 * hs, 0.15 * hs, 0.122 * hs]); // crown
  const lock = cone(5);
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.6; // fan from one side round the back to the other
    const x = Math.sin(a) * 0.082 * hs, zz = -Math.cos(a) * 0.07 * hs;
    const len = length * (1 - Math.abs(i / 6 - 0.5) * 0.5);
    add(head, lock, m, [x, 0.17 * hs - len * 0.45, zz - 0.012], [Math.PI - 0.12 * Math.cos(a), 0, Math.sin(a) * 0.12], [0.036 * hs, len, 0.022 * hs]);
  }
  for (const s of [-1, 1]) add(head, sphere(10), m, [s * 0.078 * hs, 0.12 * hs, -0.015], [0, 0, 0], [0.03 * hs, 0.075 * hs, 0.06 * hs]); // sides
  return m;
}

function bracer(parent, len, r, material, at = 0.45) {
  add(parent, cylinder(1, 1.06), material, [0, len * (at + 0.27), 0], [0, 0, 0], [r, len * 0.55, r]);
}

function flap(parent, pos, w, h, material, rotX = 0, thick = 0.012) {
  return add(parent, box(), material, [pos[0], pos[1] - h / 2, pos[2]], [rotX, 0, 0], [w, h, thick]);
}

function belt(spine, R, B, material, buckle) {
  add(spine, torus(1, 0.09), material, [0, -R.spine + 0.02, 0], [Math.PI / 2, 0, 0], [B.hip * 1.04, B.hip * (B.chestD + 0.1), 0.35]);
  if (buckle) add(spine, box(), buckle, [0, -R.spine + 0.02, B.hip * (B.chestD + 0.06) + 0.012], [0, 0, 0], [0.05, 0.04, 0.012]);
}

function boots(rig, R, B, material, cuff, height = 0.6) {
  for (const side of ['l', 'r']) {
    const ll = rig.getObjectByName(`lowerleg${side}`);
    add(ll, limb(R.shin * height, B.calf * 1.18, B.calf * 1.15, B.calf * 1.05, 0.5), material, [0, R.shin * (1 - height), 0]);
    if (cuff) add(ll, cylinder(1, 1.1), cuff, [0, R.shin * (1 - height) + 0.02, 0], [0, 0, 0], [B.calf * 1.35, 0.06, B.calf * 1.35]);
    add(rig.getObjectByName(`foot${side}`), roundedBox(0.35), material, [0, 0.06, -0.014], [0.15, 0, 0], [0.095, 0.21, 0.08]);
  }
}

function horns(head, material, hs = 1, size = 1) {
  for (const s of [-1, 1]) {
    const h1 = add(head, cone(8), material, [s * 0.1 * hs, 0.24 * hs, 0], [0, 0, -s * 1.2], [0.022 * size, 0.09 * size, 0.022 * size]);
    add(h1, cone(8), material, [0, 0.6, 0], [0, 0, s * 0.7], [0.65, 1, 0.65]);
  }
}

// ---------- weapons (along the hand slot's +Y) ----------

function greatAxe(hand) {
  const g = new THREE.Group();
  add(g, cylinder(0.014, 0.016), mat('#5a3418'), [0, 0.32, 0], [0, 0, 0], [1, 1.05, 1]);
  const blade = metal('#d8dce4');
  const bladeGeo = shapeGeo('axeblade', [[0, -0.02], [0.17, -0.12], [0.22, 0.0], [0.17, 0.13], [0, 0.03]], 0.012);
  for (const s of [-1, 1]) add(g, bladeGeo, blade, [s * 0.012, 0.74, 0], [0, s > 0 ? 0 : Math.PI, 0]);
  add(g, sphere(), metal('#e8c040'), [0, 0.74, 0], [0, 0, 0], [0.026, 0.05, 0.026]);
  hand.add(g);
  return g;
}

function sword(hand, len = 0.62, color = '#e0e4ee') {
  const g = new THREE.Group();
  add(g, shapeGeo(`blade${len}`, [[-0.022, 0], [0.022, 0], [0.018, len - 0.08], [0, len], [-0.018, len - 0.08]], 0.008, 0.002), metal(color), [0, 0.07, 0]);
  add(g, box(), metal('#d8b040'), [0, 0.065, 0], [0, 0, 0], [0.13, 0.022, 0.03]);
  add(g, cylinder(1, 1), mat('#4a2a14'), [0, 0.01, 0], [0, 0, 0], [0.014, 0.1, 0.014]);
  add(g, sphere(), metal('#d8b040'), [0, -0.045, 0], [0, 0, 0], [0.02, 0.02, 0.02]);
  hand.add(g);
  return g;
}

function shield(arm, face, rim, len) {
  const g = new THREE.Group();
  const outline = [[0, 0.24], [0.15, 0.2], [0.17, 0.02], [0.1, -0.16], [0, -0.24], [-0.1, -0.16], [-0.17, 0.02], [-0.15, 0.2]];
  add(g, shapeGeo('shieldRim', outline, 0.02), rim);
  add(g, shapeGeo('shieldFace', outline.map(([x, y]) => [x * 0.85, y * 0.85]), 0.03), face);
  add(g, sphere(), rim, [0, 0.03, 0.02], [0, 0, 0], [0.04, 0.04, 0.03]);
  g.position.set(0, len * 0.55, 0.06);
  g.rotation.set(-Math.PI / 2, 0, Math.PI);
  arm.add(g);
  return g;
}

function bow(hand) {
  const g = new THREE.Group();
  add(g, torus(0.38, 0.012, Math.PI * 0.7), mat('#7a4a20'), [0.3, 0, 0], [0, 0, Math.PI - Math.PI * 0.35]);
  add(g, box(), mat('#f0f0f0'), [-0.006, 0, 0], [0, 0, 0], [0.003, 0.6, 0.003]);
  g.rotation.set(0, Math.PI / 2, 0);
  g.position.y = 0.02;
  hand.add(g);
  return g;
}

function staff(hand, topMat, len = 1.2, crystal = '#80e0ff') {
  const g = new THREE.Group();
  add(g, cylinder(0.012, 0.015), mat('#6a4420'), [0, len * 0.35, 0], [0, 0, 0], [1, len, 1]);
  add(g, torus(0.06, 0.012), topMat, [0, len * 0.85 + 0.06, 0]);
  const orb = add(g, cached('ico', () => new THREE.IcosahedronGeometry(1, 0)), mat(crystal, { emissive: crystal, emissiveIntensity: 1.4 }), [0, len * 0.85 + 0.06, 0], [0, 0, 0], [0.04, 0.04, 0.04]);
  orb.userData.glow = true;
  hand.add(g);
  return g;
}

function hammer(hand) {
  const g = new THREE.Group();
  add(g, cylinder(0.015, 0.018), mat('#5a3418'), [0, 0.28, 0], [0, 0, 0], [1, 0.7, 1]);
  add(g, box(), metal('#a8acb8'), [0, 0.62, 0], [0, 0, 0], [0.26, 0.13, 0.13]);
  add(g, box(), metal('#d8b040'), [0, 0.62, 0], [0, 0, 0], [0.08, 0.15, 0.15]);
  hand.add(g);
  return g;
}

function dagger(hand) { return sword(hand, 0.28, '#e8e8f0'); }

// ---------- weapons for the survivors ----------

function chainsaw(hand) {
  const g = new THREE.Group();
  const orange = mat('#ff6a1a', { roughness: 0.5 }), steel = metal('#cfd4de'), dark = mat('#17171c');
  add(g, roundedBox(0.3), orange, [0, 0.1, 0.0], [0, 0, 0], [0.11, 0.24, 0.1]); // engine
  add(g, box(), dark, [0, 0.02, 0.0], [0, 0, 0], [0.04, 0.08, 0.12]); // rear handle
  add(g, box(), steel, [0, 0.52, 0.0], [0, 0, 0], [0.034, 0.58, 0.07]); // the bar
  for (let i = 0; i < 12; i++) add(g, box(), dark, [(i % 2 ? 1 : -1) * 0.024, 0.26 + i * 0.047, 0], [0, 0, 0], [0.016, 0.022, 0.05]); // teeth
  add(g, cylinder(1, 1), steel, [0, 0.82, 0], [Math.PI / 2, 0, Math.PI / 2], [0.035, 0.035, 0.035]);
  hand.add(g);
  return g;
}

function shotgun(hand) {
  const g = new THREE.Group();
  const gun = metal('#2a2a32'), wood = mat('#7a4a22');
  add(g, cylinder(0.016, 0.016), gun, [0, 0.44, 0], [0, 0, 0], [1, 0.8, 1]);       // barrel
  add(g, cylinder(0.013, 0.013), gun, [0, 0.36, 0.034], [0, 0, 0], [1, 0.56, 1]);   // magazine tube
  add(g, roundedBox(0.4), wood, [0, 0.3, 0.02], [0, 0, 0], [0.05, 0.14, 0.06]);     // the pump
  add(g, box(), gun, [0, 0.06, 0], [0, 0, 0], [0.04, 0.14, 0.05]);
  add(g, roundedBox(0.4), wood, [0, -0.1, -0.02], [-0.25, 0, 0], [0.045, 0.28, 0.06]); // stock
  hand.add(g);
  return g;
}

function spikedBat(hand) {
  const g = new THREE.Group();
  const alu = metal('#c8ccd6', { metalness: 0.9, roughness: 0.28 });
  add(g, cylinder(0.034, 0.016), alu, [0, 0.4, 0], [0, 0, 0], [1, 0.74, 1]);
  add(g, cylinder(0.014, 0.014), mat('#141418'), [0, 0.04, 0], [0, 0, 0], [1, 0.2, 1]);
  add(g, sphere(), alu, [0, -0.02, 0], [0, 0, 0], [0.024, 0.024, 0.024]);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.1, y = 0.5 + (i % 4) * 0.07;
    add(g, cone(5), metal('#e8ecf4'), [Math.cos(a) * 0.036, y, Math.sin(a) * 0.036], [Math.sin(a) * 1.5, 0, -Math.cos(a) * 1.5], [0.013, 0.07, 0.013]);
  }
  hand.add(g);
  return g;
}

function hairspray(hand) {
  const g = new THREE.Group();
  add(g, cylinder(0.034, 0.034), metal('#e8d8f4'), [0, 0.12, 0], [0, 0, 0], [1, 0.22, 1]);
  add(g, cylinder(0.035, 0.035), mat('#ff4fb8', { emissive: '#ff2ea6', emissiveIntensity: 0.5 }), [0, 0.12, 0], [0, 0, 0], [1, 0.07, 1]);
  add(g, cylinder(0.022, 0.034), metal('#40e0ff'), [0, 0.26, 0], [0, 0, 0], [1, 0.05, 1]);
  add(g, cylinder(0.01, 0.01), mat('#111'), [0, 0.3, 0], [0, 0, 0], [1, 0.05, 1]);
  const flame = add(g, cone(8), mat('#ffb030', { emissive: '#ff6a10', emissiveIntensity: 2.2 }), [0, 0.38, 0], [0, 0, 0], [0.04, 0.14, 0.04]);
  flame.userData.glow = true;
  hand.add(g);
  return g;
}

function spatula(hand) {
  const g = new THREE.Group();
  add(g, cylinder(0.012, 0.012), mat('#2a2a30'), [0, 0.22, 0], [0, 0, 0], [1, 0.46, 1]);
  add(g, box(), metal('#d8dce4'), [0, 0.52, 0], [0, 0, 0], [0.12, 0.14, 0.01]);
  hand.add(g);
  return g;
}

function boombox(chest, B) {
  const g = new THREE.Group();
  add(g, roundedBox(0.2), mat('#1a1a22'), [0, 0, 0], [0, 0, 0], [0.22, 0.1, 0.08]);
  for (const s of [-1, 1]) {
    add(g, cylinder(1, 1), mat('#2ee6ff', { emissive: '#18a8d8', emissiveIntensity: 1.2 }), [s * 0.06, 0, 0.042], [Math.PI / 2, 0, 0], [0.032, 0.012, 0.032]);
  }
  add(g, box(), metal('#ff2ea6'), [0, 0.058, 0], [0, 0, 0], [0.12, 0.012, 0.012]);
  g.position.set(0, 0.1, -B.chest * B.chestD - 0.06);
  g.rotation.x = 0.1;
  chest.add(g);
  return g;
}

// ---------- the survivors (and Ray, and the counter clerk) ----------

const HEROES = {
  // BIKER: the tank. Leather vest, bandana, shades, a chainsaw.
  biker(rig) {
    const R = RIGS.big, B = BODIES.muscular;
    const leather = mat('#1a1a1f', { roughness: 0.6 }), denim = mat('#26324a'), gold = metal('#e8c040'), chrome = metal('#d0d4de');
    const b = body(rig, B, {
      rig: R, skin: '#d29a70', chest: leather, abs: mat('#d29a70'), upperArm: mat('#d29a70'), thigh: leather, calf: leather, feet: mat('#101014'),
      face: { brows: '#2a1a0a', eyes: '#3a2a1a', angry: true, stubble: '#4a3018' },
    });
    // a big red beard, a bandana and wraparound shades
    add(b.head, roundedBox(0.6), mat('#8a3a14', { roughness: 0.95, map: strands('#8a3a14') }), [0, 0.07, 0.058], [0.25, 0, 0], [0.12, 0.1, 0.09]);
    add(b.head, cap(), mat('#c01818'), [0, 0.168, 0.02], [CAP_TILT, 0, 0], [0.104, 0.12, 0.124]);
    add(b.head, cone(6), mat('#c01818'), [0.02, 0.16, -0.12], [-2.0, 0.3, 0], [0.03, 0.12, 0.012]);
    add(b.head, box(), mat('#07070a', { roughness: 0.2, metalness: 0.4 }), [0, 0.158, 0.1], [0, 0, 0], [0.17, 0.03, 0.02]);
    // vest studs and a chain belt
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(b.chest, sphere(6), gold, [s * (0.05 + i * 0.03), 0.12 - i * 0.04, B.chest * B.chestD + 0.012], [0, 0, 0], [0.008, 0.008, 0.008]);
    belt(b.spine, R, B, mat('#2a2a30'), gold);
    add(b.spine, torus(1, 0.09), chrome, [0, -R.spine - 0.01, 0], [Math.PI / 2, 0, 0], [B.hip * 1.06, B.hip * (B.chestD + 0.12), 0.18]);
    for (const s of ['l', 'r']) bracer(b.bone(`lowerarm${s}`), R.fore, B.fore * 1.4, leather, 0.35);
    boots(rig, R, B, mat('#0c0c10'), chrome, 0.5);
    for (const s of [-1, 1]) add(b.chest, sphere(), leather, [s * 0.15, R.shoulderY - 0.02, 0], [0, 0, 0], [0.09, 0.05, 0.09]); // pauldrons
    chainsaw(b.bone('handslotr'));
  },
  // MALL COP: blue uniform, cap, badge, pump shotgun.
  mallCop(rig) {
    const R = RIGS.male, B = BODIES.athletic;
    const shirt = mat('#6a9ad8'), navy = mat('#16254a'), gold = metal('#e8c040');
    const b = body(rig, B, { rig: R, skin: '#e2b08a', chest: shirt, abs: shirt, upperArm: shirt, thigh: navy, calf: navy, feet: mat('#0c0c10'), face: { brows: '#3a2210', eyes: '#2a4a6a', stubble: '#3a2a1a' } });
    add(b.head, cap(), navy, [0, 0.168, 0.02], [CAP_TILT, 0, 0], [0.108, 0.1, 0.126]); // peaked cap
    add(b.head, cylinder(1, 1, 16), navy, [0, 0.215, 0.04], [-0.1, 0, 0], [0.11, 0.02, 0.12]);
    add(b.head, box(), mat('#0c0c10'), [0, 0.185, 0.11], [0.15, 0, 0], [0.12, 0.012, 0.06]); // visor
    add(b.head, sphere(8), gold, [0, 0.2, 0.1], [0, 0, 0], [0.016, 0.016, 0.006]);
    add(b.head, box(), mat('#c8a070'), [0, 0.1, 0.09], [0, 0, 0], [0.05, 0.012, 0.015]); // mustache
    // badge, radio, tie
    add(b.chest, cone(5), gold, [0.07, 0.1, B.chest * B.chestD + 0.012], [Math.PI / 2, 0, 0], [0.026, 0.01, 0.026]);
    add(b.chest, box(), mat('#10142a'), [0, 0.06, B.chest * B.chestD + 0.008], [0, 0, 0], [0.03, 0.16, 0.008]);
    add(b.chest, box(), mat('#222'), [-0.08, 0.1, B.chest * B.chestD + 0.02], [0, 0, 0], [0.03, 0.05, 0.015]);
    belt(b.spine, R, B, mat('#0c0c10'), gold);
    add(b.spine, box(), mat('#18181e'), [0.12, -R.spine, 0.02], [0, 0, 0], [0.03, 0.07, 0.04]); // holster
    for (const s of ['l', 'r']) bracer(b.bone(`lowerarm${s}`), R.fore, B.fore * 1.2, shirt, 0.5);
    boots(rig, R, B, mat('#0c0c10'), null, 0.35);
    shotgun(b.bone('handslotr'));
  },
  // SKATER: baggy tee and shorts, backwards cap, high-tops, a spiked aluminum bat.
  skater(rig) {
    const R = RIGS.male, B = BODIES.athletic;
    const tee = mat('#38c870'), shorts = mat('#1a2a60'), pink = mat('#ff5ad0', { emissive: '#d02890', emissiveIntensity: 0.3 });
    const b = body(rig, B, {
      rig: R, skin: '#f0c8a0', chest: tee, abs: tee, upperArm: tee, thigh: shorts, face: { brows: '#6a3a14', eyes: '#2a6a3a', angry: false },
    });
    // messy hair and a backwards cap
    const hairM = mat('#6a3a14', { roughness: 0.95 });
    add(b.head, cap(), hairM, [0, 0.165, 0.02], [CAP_TILT, 0, 0], [0.1, 0.14, 0.124]);
    add(b.head, cap(), mat('#ff5ad0'), [0, 0.185, 0.0], [CAP_TILT + 0.15, 0, 0], [0.105, 0.12, 0.12]);
    add(b.head, box(), mat('#ff5ad0'), [0, 0.176, -0.12], [-0.1, 0, 0], [0.12, 0.01, 0.07]); // the brim, at the back
    // baggy shorts, long socks and chunky high-tops
    add(b.spine, lathe([[B.hip * 1.06, -R.spine + 0.02], [B.hip * 1.5, -R.spine - 0.3]], 14), shorts, [0, 0, 0], [0, Math.PI, 0], [1, 1, 0.9]);
    for (const s of ['l', 'r']) {
      const ll = rig.getObjectByName(`lowerleg${s}`);
      add(ll, cylinder(1, 1.05), mat('#ffffff', { map: stripes(['#ffffff', '#ff5ad0'], 4) }), [0, R.shin * 0.8, 0], [0, 0, 0], [B.calf * 1.05, R.shin * 0.35, B.calf * 1.05]);
    }
    boots(rig, R, B, mat('#f4f4f8'), pink, 0.4);
    belt(b.spine, R, B, mat('#2a2a30'), metal('#d0d4de'));
    // a deck on the back
    add(b.chest, roundedBox(0.4), pink, [0.02, 0.08, -B.chest * B.chestD - 0.04], [0.05, 0, 0.1], [0.08, 0.34, 0.012]);
    for (const wy of [-0.11, 0.25]) for (const sx of [-0.026, 0.026]) add(b.chest, cylinder(1, 1), mat('#f4f4f8'), [0.02 + sx * 0.7, 0.08 + wy * 0.9, -B.chest * B.chestD - 0.058], [0, 0, Math.PI / 2], [0.014, 0.01, 0.014]);
    spikedBat(b.bone('handslotr'));
  },
  // MALL GOTH: black everything, purple hair, platform boots, a boombox and a can of hairspray.
  mallGoth(rig) {
    const R = RIGS.female, B = BODIES.female;
    const black = mat('#14101c', { roughness: 0.55 }), purple = mat('#7a2ab0'), silver = metal('#d0d4de');
    const b = body(rig, B, {
      rig: R, skin: '#ece0e8', chest: black, abs: black, upperArm: mat('#ece0e8'), foreArm: mat('#ece0e8'), thigh: mat('#ffffff', { map: stripes(['#14101c', '#4a3a5a'], 10) }), calf: black,
      face: { female: true, lips: '#2a0a2a', eyes: '#40e0ff', brows: '#14101c', makeup: '#6a2a9a' },
    });
    hairLong(b.head, '#241034', B.head, 0.44);
    // a streak of electric purple and a spiked choker
    add(b.head, cone(5), purple, [-0.03, 0.2, 0.09], [-0.5, 0, 0.1], [0.022, 0.1, 0.012]);
    add(b.head, cone(5), purple, [0.05, 0.2, 0.07], [-0.4, 0, -0.2], [0.02, 0.09, 0.012]);
    add(b.head, torus(0.04, 0.006), silver, [0, 0.0, 0.0], [Math.PI / 2, 0, 0], [1, 1, 1]);
    // a short black skirt, a studded belt and platform boots
    add(b.spine, lathe([[B.hip * 1.05, -R.spine + 0.02], [B.hip * 1.6, -R.spine - 0.2]], 16), black, [0, 0, 0], [0, Math.PI, 0], [1, 1, 0.9]);
    belt(b.spine, R, B, mat('#20202a'), silver);
    boots(rig, R, B, black, silver, 0.7);
    for (const s of ['l', 'r']) {
      add(b.bone(`foot${s}`), box(), mat('#0c0a12'), [0, 0.03, -0.01], [0.1, 0, 0], [0.1, 0.18, 0.1]); // platform sole
      const fa = b.bone(`lowerarm${s}`);
      for (let i = 0; i < 4; i++) add(fa, cone(5), silver, [Math.cos(i * 1.6) * B.fore * 1.3, R.fore * 0.8, Math.sin(i * 1.6) * B.fore * 1.3], [0, 0, 0], [0.01, 0.03, 0.01]); // spiked bracelets
    }
    boombox(b.chest, B);
    hairspray(b.bone('handslotr'));
  },
  // RAY: the Food Court cook, in a greasy apron and a toque.
  ray(rig) {
    const R = RIGS.male, B = BODIES.stocky;
    const coat = mat('#f6f2ea'), apron = mat('#e8dcc0');
    const b = body(rig, B, { rig: R, skin: '#d8a078', chest: coat, abs: coat, upperArm: coat, thigh: mat('#3a3a44'), calf: mat('#3a3a44'), face: { beard: '#2a1a10', brows: '#2a1a10', eyes: '#3a2a1a' } });
    add(b.head, cylinder(1, 1, 14), coat, [0, 0.27, 0], [0, 0, 0], [0.085, 0.16, 0.085]); // the toque
    add(b.head, sphere(12), coat, [0, 0.36, 0], [0, 0, 0], [0.11, 0.06, 0.11]);
    flap(b.spine, [0, -R.spine + 0.2, B.hip * 0.8], 0.26, 0.5, apron, -0.06);
    for (let i = 0; i < 4; i++) add(b.chest, sphere(5), mat('#8a3a1a'), [(i - 1.5) * 0.04, 0.0 - (i % 2) * 0.05, B.chest * B.chestD + 0.02], [0, 0, 0], [0.018, 0.018, 0.006]); // sauce stains
    belt(b.spine, R, B, mat('#8a6a3a'));
    spatula(b.bone('handslotr'));
  },
  // the cash counter clerk in the Security Room
  clerk(rig) {
    const R = RIGS.male, B = BODIES.athletic;
    const vest = mat('#ff4fb8'), tee = mat('#2ee6ff');
    const b = body(rig, B, { rig: R, skin: '#c89070', chest: vest, abs: tee, upperArm: tee, thigh: mat('#16254a'), calf: mat('#16254a'), face: { brows: '#14100a', eyes: '#2a2a3a' } });
    add(b.head, box(), mat('#ffcc33'), [0, 0.195, 0.1], [0.1, 0, 0], [0.15, 0.012, 0.09]); // visor
    add(b.head, cap(), mat('#ffcc33'), [0, 0.168, 0.02], [CAP_TILT, 0, 0], [0.1, 0.07, 0.12]);
    belt(b.spine, R, B, mat('#10101a'), metal('#ffcc33'));
  },
};

export const HERO_RIG = {
  biker: 'big', mallCop: 'male', skater: 'male', mallGoth: 'female', ray: 'male', clerk: 'male',
};

export const isBuiltHero = (cls) => !!HEROES[cls];

// Turn a bare rig (KayKit meshes removed) into the given hero.
export function buildHero(cls, rig) {
  applyRig(rig, RIGS[HERO_RIG[cls]]);
  rig.updateMatrixWorld(true);
  HEROES[cls](rig);
  return hipsHeight(RIGS[HERO_RIG[cls]]) / BASE_HIPS;
}

// The building blocks, for the monsters (monsters.js) built the same way.
export const kit = {
  RIGS, BODIES, applyRig, hipsHeight, BASE_HIPS, mat, metal, shade, stripes, strands, canvasTex, cached, add, lathe, limb,
  sphere, box, cap, CAP_TILT, cylinder, cone, torus, shapeGeo, roundedBox, body, hairLong, bracer, flap, belt, boots, horns,
  greatAxe, sword, shield, bow, staff, hammer, dagger,
};
