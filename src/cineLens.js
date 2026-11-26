// Things that live ON the lens, drawn on the 2D overlay by both quality tiers: blood and grease splats, anamorphic
// flares on the practical lights, and a film-grain tile for the places no shader pass reaches. All procedural.

const W = 960, H = 640;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const rnd = (seed) => { let n = seed * 9301 + 49297; return () => { n = (n * 9301 + 49297) % 233280; return n / 233280; }; };

const layers = new Map(); // "kind:seed" -> { canvas, drips }

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function buildSplat(kind, seed) {
  const key = `${kind}:${seed}`;
  if (layers.has(key)) return layers.get(key);
  const R = rnd(seed + (kind === 'grease' ? 71 : 13));
  const canvas = makeCanvas(W, H), x = canvas.getContext('2d');
  const grease = kind === 'grease';
  const core = grease ? '90,50,8' : '74,0,4', rim = grease ? '168,112,28' : '138,10,10';
  const alpha = grease ? 0.55 : 0.9;
  const blob = (cx, cy, r, a) => {
    const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, `rgba(${core},${a})`); g.addColorStop(0.72, `rgba(${rim},${a * 0.85})`); g.addColorStop(1, `rgba(${rim},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  };
  const drips = [];
  const n = 5 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    // splats land toward the edges and corners, so the middle of the picture stays readable
    const side = i % 2 ? 1 : -1;
    const cx = W / 2 + side * (170 + R() * 300), cy = 150 + R() * 320, r = (i === 0 ? 78 : 22 + R() * 44);
    blob(cx, cy, r, alpha);
    for (let k = 0; k < 6; k++) blob(cx + (R() - 0.5) * r * 1.4, cy + (R() - 0.5) * r * 1.4, r * (0.25 + R() * 0.35), alpha * 0.9);
    const dir = R() * Math.PI * 2;
    for (let k = 0; k < 10 + R() * 10; k++) {
      const d = r * 0.8 + R() * 110, a = dir + (R() - 0.5) * 1.1;
      blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + R() * 7, alpha);
    }
    if (drips.length < 4 && r > 30) drips.push({ x: cx + (R() - 0.5) * r * 0.6, y: cy + r * 0.45, len: 40 + R() * 120, speed: 25 + R() * 35, w: 4 + R() * 4 });
  }
  const out = { canvas, drips, color: `rgba(${rim},${alpha * 0.85})` };
  layers.set(key, out);
  if (layers.size > 6) layers.delete(layers.keys().next().value);
  return out;
}

/** Build a splat ahead of time (it is a few hundred gradients: too much for the frame it lands on). */
export const warmSplat = (kind, seed) => { buildSplat(kind, seed); };

/** A splat's opacity at `age` seconds: lands at once, holds, then fades. */
export const splatAlpha = (amt, age) => (age < 0 ? 0 : age < 2.2 ? amt : amt * (1 - clamp01((age - 2.2) / 2)));

/** b = { kind: 'blood'|'grease', amt, age, seed } */
export function drawSplat(ctx, b) {
  if (!b) return;
  const a = splatAlpha(b.amt, b.age);
  if (a <= 0.01) return;
  const L = buildSplat(b.kind || 'blood', b.seed || 1);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(L.canvas, 0, 0);
  ctx.strokeStyle = L.color; ctx.lineCap = 'round';
  for (const d of L.drips) {
    const len = Math.min(d.len, b.age * d.speed);
    if (len < 2) continue;
    ctx.lineWidth = d.w; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 1.5, d.y + len); ctx.stroke();
    ctx.fillStyle = L.color; ctx.beginPath(); ctx.arc(d.x + 1.5, d.y + len, d.w * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

/** Horizontal anamorphic streaks. list = [{ x, y (960x640 px), k (0..1), len, color }] */
export function drawFlares(ctx, list, scale = 1) {
  if (!list || !list.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of list) {
    const k = clamp01(f.k) * scale;
    if (k < 0.02) continue;
    const half = 260 * (f.len || 0.6) * (0.5 + k * 0.5), c = rgb(f.color || '#7ab8ff');
    for (const [h, a] of [[12, 0.13], [2, 0.5]]) {
      const g = ctx.createLinearGradient(f.x - half, 0, f.x + half, 0);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${a * k})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(f.x - half, f.y - h / 2, half * 2, h);
    }
    const r = 16 + 18 * k;
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.28 * k})`); g.addColorStop(0.35, `rgba(${c},${0.22 * k})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
  }
  ctx.restore();
}

let grainTile = null;
/** A moving grain wash for frames no develop pass touched (the handoff's fading film look, a failed Low pass). */
export function drawGrain(ctx, time, alpha = 0.06, y0 = 0, y1 = H) {
  if (alpha <= 0.004) return;
  if (!grainTile) {
    grainTile = makeCanvas(256, 256);
    const x = grainTile.getContext('2d'), img = x.createImageData(256, 256), R = rnd(5);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.floor(R() * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
  }
  const frame = Math.floor(time * 24), ox = (frame * 97) % 256, oy = (frame * 61) % 256;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y0, W, y1 - y0); ctx.clip();
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'overlay';
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(grainTile, x, y);
  ctx.restore();
}
