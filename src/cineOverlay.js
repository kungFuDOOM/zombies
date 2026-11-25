// Cinematic toolkit, part 5: the 2D overlay (letterbox bars, subtitles / speaker box, hero name cards, title card, skip hint).
//
// Drawn on the game's 960x640 HUD canvas, which the page scales to fit the window. `view.ui.s` is CSS pixels per canvas
// pixel (0.41 on a 390 px wide phone), so type sizes are specified in CSS pixels and divided by it: the same subtitle is
// ~17 px on a laptop and ~13 px on a phone in portrait, and wraps to the width of the picture, above the letterbox bar.

const W = 960, H = 640;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp01 = (x) => clamp(x, 0, 1);
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Greedy word wrap using the context's current font. */
export function wrapLines(ctx, text, maxW) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * h = { SANS, SERIF, drawTitleSign(ctx, time, scale, alpha) }  (from hud.js, so the title matches the title screen)
 * v = CinePlayer.view()
 */
export function drawCine(ctx, v, time, h) {
  ctx.clearRect(0, 0, W, H);
  const s = v.ui.s, barPx = Math.round(v.bar * H);
  // Low quality has no vignette in a post pass, so a cheap radial one is laid over the picture here
  if (!v.high) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,0,8,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (v.flash > 0.02) { ctx.fillStyle = `rgba(235,242,255,${Math.min(0.85, v.flash * 0.45)})`; ctx.fillRect(0, 0, W, H); }
  // letterbox
  if (barPx > 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, barPx); ctx.fillRect(0, H - barPx, W, barPx); }

  ctx.textBaseline = 'alphabetic';
  if (v.card) drawCard(ctx, v, barPx, s, h);
  if (v.sub) drawDialog(ctx, v, barPx, s, h);
  if (v.title) drawTitle(ctx, v.title, time, h);
  if (v.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, v.fade)})`; ctx.fillRect(0, 0, W, H); }
  if (v.hint > 0) {
    const f = clamp(12 / s, 17, 30);
    ctx.save();
    ctx.globalAlpha = v.hint * (0.8 + Math.sin(time * 2.4) * 0.2);
    ctx.textAlign = 'right';
    ctx.font = `${f}px ${h.SANS}`;
    ctx.fillStyle = '#d4cce8';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    // on a phone held upright the bars are thin: put the hint under the top bar so it never sits on the subtitle
    ctx.fillText('tap or press any button to skip', W - 24, v.ui.portrait ? barPx + f + 10 : H - Math.max(10, barPx * 0.35));
    ctx.restore();
  }
}

// The dialogue box: dark translucent panel in the game's style, speaker name in their colour, wrapped text typed on.
function drawDialog(ctx, v, barPx, s, h) {
  const sub = v.sub;
  const font = clamp(17 / s, 20, 46);
  const lineH = font * 1.28, pad = font * 0.7, maxW = Math.min(W - 80, font * 30) - pad * 2;
  ctx.save();
  ctx.globalAlpha = sub.a;
  ctx.font = `${font}px ${h.SANS}`;
  const lines = wrapLines(ctx, sub.full, maxW);
  const nameH = font * 0.95;
  const boxW = Math.min(W - 60, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + 4);
  const boxH = pad * 2 + nameH + lines.length * lineH;
  const x = (W - boxW) / 2, y = H - barPx - 16 - boxH;
  // panel
  ctx.fillStyle = 'rgba(8,4,16,0.74)';
  roundRect(ctx, x, y, boxW, boxH, 10); ctx.fill();
  ctx.fillStyle = sub.color; ctx.globalAlpha = sub.a * 0.9;
  ctx.fillRect(x + 2, y + 10, 4, boxH - 20);   // speaker colour tab
  ctx.globalAlpha = sub.a;
  // speaker + text
  ctx.textAlign = 'left';
  ctx.font = `bold ${font * 0.78}px ${h.SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${font * 0.12}px`;
  ctx.fillStyle = sub.color;
  ctx.fillText(sub.speaker.toUpperCase(), x + pad + 4, y + pad + nameH * 0.72);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `${font}px ${h.SANS}`;
  ctx.fillStyle = '#f2ecdc';
  let left = sub.text.length;
  lines.forEach((l, i) => {
    const part = l.slice(0, Math.max(0, left));
    left -= l.length + 1;
    if (part) ctx.fillText(part, x + pad + 4, y + pad + nameH + (i + 0.82) * lineH);
  });
  ctx.restore();
}

// A survivor's name card: slides in at the top left (clear of the subtitles) with a role chip.
function drawCard(ctx, v, barPx, s, h) {
  const c = v.card, u = clamp(0.62 / s, 1, 2.1), a = Math.min(c.in, c.out);
  const x = 48 + (1 - easeOut(c.in)) * -60 * u, y = barPx + 22 * u;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'left';
  const bw = 340 * u, bh = 96 * u;
  const bg = ctx.createLinearGradient(x - 20, 0, x - 20 + bw, 0);
  bg.addColorStop(0, 'rgba(6,2,14,0.78)'); bg.addColorStop(1, 'rgba(6,2,14,0)');
  ctx.fillStyle = bg; ctx.fillRect(x - 20, y - 10 * u, bw, bh);
  ctx.fillStyle = c.color; ctx.fillRect(x - 12 * u, y, 5 * u, bh - 20 * u);
  ctx.shadowColor = c.color; ctx.shadowBlur = 14;
  ctx.font = `bold ${40 * u}px ${h.SERIF}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(c.name, x, y + 38 * u);
  ctx.shadowBlur = 0;
  ctx.font = `bold ${17 * u}px ${h.SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${4 * u}px`;
  const tw = ctx.measureText(c.role).width;
  ctx.fillStyle = c.color; roundRect(ctx, x, y + 50 * u, tw + 24 * u, 26 * u, 4); ctx.fill();
  ctx.fillStyle = '#10061e'; ctx.fillText(c.role, x + 12 * u, y + 70 * u);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

// MALL OF THE DEAD: slammed in, the same sign the title screen shows.
function drawTitle(ctx, title, time, h) {
  const age = title.age;
  const k = easeOut(age / 0.14), scale = 1 + (1 - k) * 1.1 + (age > 0.14 && age < 0.4 ? Math.sin((age - 0.14) / 0.26 * Math.PI) * 0.04 : 0);
  ctx.save();
  ctx.globalAlpha = Math.min(1, age / 0.04);
  h.drawTitleSign(ctx, time, scale, 1);
  if (age > 0.5) {
    ctx.globalAlpha = clamp01((age - 0.5) / 0.6);
    ctx.textAlign = 'center';
    ctx.font = `bold 16px ${h.SANS}`;
    ctx.fillStyle = '#ffcc33'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText('BLACK FRIDAY SALE: EVERYONE MUST GO', W / 2, 204);
  }
  ctx.restore();
}
