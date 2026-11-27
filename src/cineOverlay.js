// Cinematic toolkit, part 5: the 2D overlay (scope letterbox, subtitles, lens splats and flares, hero name cards, the studio
// card, title card, end credits, skip hint).
//
// Drawn on the game's 960x640 HUD canvas, which the page scales to fit the window. `view.ui.s` is CSS pixels per canvas
// pixel (0.41 on a 390 px wide phone), so type sizes are specified in CSS pixels and divided by it: the same subtitle is
// ~17 px on a laptop and ~13 px on a phone in portrait, and wraps to the width of the picture, above the letterbox bar.

import { drawSplat, drawFlares, drawGrain } from './cineLens.js';

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
  // only when no develop pass is drawing the film's own vignette and grain
  if (v.graded === false) { drawVignette(ctx, 0.55); if (!v.lean) drawGrain(ctx, time, 0.06, barPx, H - barPx); }
  drawFlares(ctx, v.flares, v.high ? 0.75 : 1);
  drawSplat(ctx, v.blood);
  if (v.flash > 0.02) { ctx.fillStyle = `rgba(235,242,255,${Math.min(0.85, v.flash * 0.45)})`; ctx.fillRect(0, 0, W, H); }
  drawScopeBars(ctx, barPx);

  ctx.textBaseline = 'alphabetic';
  if (v.card) drawCard(ctx, v, barPx, s, h);
  if (v.sub) drawScopeSub(ctx, v.sub, barPx, s, h);
  if (v.title) drawTitle(ctx, v.title, time, h);
  if (v.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, v.fade)})`; ctx.fillRect(0, 0, W, H); }
  if (v.studio) drawStudioCard(ctx, v.studio, time, h);
  if (v.hint > 0) drawTopHint(ctx, 'tap or press any button to skip', barPx, s, h, v.hint * (0.9 + Math.sin(time * 2.4) * 0.1));
}

export function drawVignette(ctx, alpha) {
  if (alpha <= 0.004) return;
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(2,2,6,0)'); vg.addColorStop(1, `rgba(2,2,6,${alpha})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

/** The 2.39:1 scope letterbox: pure black. */
export function drawScopeBars(ctx, bar) {
  if (bar <= 0) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
}

/** "tap: next" / the skip hint: always in the top bar's right-hand corner, so it never sits on a subtitle. */
export function drawTopHint(ctx, text, barPx, s, h, alpha = 0.55) {
  const f = clamp(11 / s, 14, 26);
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.textAlign = 'right';
  ctx.font = `${f}px ${h.SANS}`;
  ctx.fillStyle = '#cfc8dc';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  ctx.fillText(text, W - 20, Math.max(f + 4, barPx / 2 + f * 0.35));
  ctx.restore();
}

// Film subtitles: no panel, centred in the bottom bar, the speaker's name in their colour (on its own line, or in front
// of the text on a phone held upright). A block too tall for the bar rises over a dark band.
export function drawScopeSub(ctx, sub, barPx, s, h) {
  const font = clamp(17 / s, 22, 40), lineH = font * 1.22, nameF = font * 0.72;
  const name = sub.speaker.toUpperCase();
  const inline = s < 0.5;
  ctx.save();
  ctx.globalAlpha = sub.a;
  ctx.textAlign = 'left';
  const nameFont = `bold ${nameF}px ${h.SANS}`, textFont = `${font}px ${h.SANS}`;
  ctx.font = nameFont;
  const nameW = ctx.measureText(name).width + (inline && name ? font * 0.5 : 0);
  ctx.font = textFont;
  // inline: the name takes room on the first line, so wrap with a leading spacer as wide as it is
  const spaceW = ctx.measureText('\u2007').width || font * 0.55;
  const pad = inline && name ? '\u2007'.repeat(Math.ceil(nameW / spaceW)) : '';
  const lines = wrapLines(ctx, pad + sub.full, Math.min(W - 80, font * 30));
  const nameH = inline || !name ? 0 : nameF * 1.35;
  const blockH = nameH + lines.length * lineH;
  let y = H - barPx + Math.max(0, (barPx - blockH) / 2);
  if (blockH > barPx - 6) {
    y = H - 6 - blockH;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, y - 8, W, H - barPx - y + 8);
  }
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  if (!inline && name) {
    ctx.font = nameFont; ctx.fillStyle = sub.color; ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${nameF * 0.12}px`;
    ctx.fillText(name, W / 2, y + nameF);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  }
  let left = sub.text.length;
  lines.forEach((l, i) => {
    const lead = i === 0 ? pad.length : 0;
    const body = l.slice(lead);
    const part = body.slice(0, Math.max(0, left));
    left -= body.length + 1;
    ctx.font = textFont;
    const leadW = lead ? ctx.measureText(pad).width : 0;
    const x = (W - leadW - ctx.measureText(body).width) / 2;
    const base = y + nameH + i * lineH + font * 0.95;
    if (lead) { ctx.font = nameFont; ctx.fillStyle = sub.color; ctx.fillText(name, x, base); ctx.font = textFont; }
    ctx.fillStyle = '#f2ecdc';
    if (part) ctx.fillText(part, x + leadW, base);
  });
  ctx.restore();
}

/** The studio card over black before the opener. k = { a: 0..1, bulb: 0..1 (a projector bulb's flicker) } */
export function drawStudioCard(ctx, k, time, h) {
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = clamp01(k.a) * clamp(0.35 + 0.65 * k.bulb, 0, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e2d4';
  ctx.shadowColor = 'rgba(255,240,210,0.55)'; ctx.shadowBlur = 16;
  ctx.font = `bold 52px ${h.SERIF}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
  ctx.fillText('kungFuDOOM', W / 2 + 4, 316);
  ctx.shadowBlur = 0;
  ctx.font = `22px ${h.SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
  ctx.fillText('PRESENTS', W / 2 + 5, 366);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
  drawGrain(ctx, time, 0.07);
}

const CREDITS = [
  ['MALL OF THE DEAD', 'title'], ['WING 1: FOOD COURT', 'sub'], ['', 'gap'],
  ['A kungFuDOOM PRODUCTION', 'head'], ['Written, directed, scored and built in code by kungFuDOOM', 'body'],
  ['Every sound synthesized. Every frame rendered live.', 'body'], ['No survivors were harmed. Several were eaten.', 'body'], ['', 'gap'],
  ['TO BE CONTINUED AT 1:20 AM', 'head'],
];

/** The end credits card: lines fade in one after another on black. */
export function drawCredits(ctx, age, dur, s, time, h) {
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const body = clamp(11 / s, 20, 30);
  const out = clamp01((dur - age) / 0.6);
  let y = 150, n = 0;
  for (const [text, kind] of CREDITS) {
    if (kind === 'gap') { y += 28; continue; }
    const px = kind === 'title' ? 56 : kind === 'sub' ? 24 : kind === 'head' ? body * 1.1 : body;
    ctx.globalAlpha = clamp01((age - 0.2 - n * 0.55) / 0.7) * out;
    ctx.font = `${kind === 'body' ? '' : 'bold '}${px}px ${kind === 'title' ? h.SERIF : h.SANS}`;
    ctx.fillStyle = kind === 'title' ? '#e8e2d4' : kind === 'body' ? '#a8a29a' : '#cfc7b4';
    if ('letterSpacing' in ctx) ctx.letterSpacing = kind === 'body' ? '0px' : '4px';
    const w = ctx.measureText(text).width;
    if (w > W - 60) ctx.font = `${Math.floor(px * (W - 60) / w)}px ${h.SANS}`;
    y += px * 0.5;
    ctx.fillText(text, W / 2, y);
    y += px * 1.15;
    n++;
  }
  ctx.restore();
  drawGrain(ctx, time, 0.05);
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
  ctx.translate(0, 170); // (inside the scope picture, clear of the top bar)
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
