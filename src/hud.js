// 2D overlay drawn over the WebGL view: corner player panels, floating text, banners, menus and the
// cutscene overlay. The look is clean dark translucent HUD with neon edges: no ink, no halftone, no comic panels.

import { VIEW_W, VIEW_H, CLASSES, BASE_CLASSES as CLASS_ORDER, ENEMIES, POWERUPS, TURBO_COST, MAX_PLAYERS, TILE, xpForLevel } from './config.js';
import { T, WINGS, HUB_RAY } from './level.js';
import { hubRayLabel } from './story.js';
import { Input } from './input.js';
import { SHOP, priceOf, maxed } from './campaign.js';
import { BOSS_ROSTER } from './bossRoster.js';

const SERIF = '"Arial Black", Impact, "Trebuchet MS", sans-serif'; // arcade display type
const SANS = '"Trebuchet MS", Verdana, sans-serif';
const PANEL_W = 236, PANEL_H = 78, M = 10;

function outlined(ctx, text, x, y, fill, stroke = '#000', width = 4) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function frame(ctx, x, y, w, h, accent) {
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(12,8,30,0.82)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.stroke();
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(46,230,255,0.35)';
  ctx.stroke();
}

// ---------- in-game ----------

export function drawGameOverlay(ctx, g, r3d, opts) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // floating combat text, projected from 3D
  ctx.textAlign = 'center';
  for (const t of g.texts) {
    const s = r3d.toScreen(t.x, t.y, 40);
    ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
    ctx.font = `bold ${t.text.length > 6 ? 15 : 17}px ${SANS}`;
    outlined(ctx, t.text, s.x, s.y, t.color, '#000', 3);
  }
  ctx.globalAlpha = 1;

  // player name tags
  ctx.font = `bold 11px ${SANS}`;
  for (const p of g.livePlayers()) {
    const s = r3d.toScreen(p.x, p.y, 62);
    outlined(ctx, `P${p.slot + 1}`, s.x, s.y, p.def.color, '#000', 3);
  }

  // danger vignette when anyone is starving
  const low = g.livePlayers().some((p) => p.hp < 150);
  if (low) {
    const a = 0.25 + Math.sin(g.time * 6) * 0.12;
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    vg.addColorStop(0, 'rgba(255,0,0,0)');
    vg.addColorStop(1, `rgba(200,0,0,${a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.65})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawBossBar(ctx, g);
  if (g.level.hub) drawHubLabels(ctx, g, r3d, opts.hubPrompt !== false);
  drawBarks(ctx, g);
  if (opts.tutorial) drawTutorial(ctx, g, opts.tutorial);
  else if (!g.level.hub) drawBanner(ctx, g); // (in the Security Room it would sit on the 3D SECURITY ROOM sign)
  for (let s = 0; s < MAX_PLAYERS; s++) drawPanel(ctx, g, s);
  if (opts.controls && device !== 'touch' && !document.body.classList.contains('touching')) drawControlsBar(ctx, g.players[2] || g.players[3] ? 440 : 680);
  if (opts.minimap || g.anyBuff('xray')) drawMinimap(ctx, g, g.anyBuff('xray'));
}

function panelPos(slot) {
  const right = slot % 2 === 1, bottom = slot >= 2;
  return { x: right ? VIEW_W - PANEL_W - M : M, y: bottom ? VIEW_H - PANEL_H - M : M, right, bottom };
}

function drawPanel(ctx, g, slot) {
  const p = g.players[slot];
  const { x, y } = panelPos(slot);
  if (!p) {
    // One small "join" note in the first free corner, shown in the hub and for the first
    // few seconds of a level, then it fades so the corners stay clear.
    if ([0, 1, 2, 3].find((i) => !g.players[i]) !== slot) return;
    const a = g.level.hub ? 0.75 : Math.min(0.75, Math.max(0, (8 - g.time) / 2));
    if (a <= 0) return;
    if (slot >= 2 && document.body.classList.contains('touching')) return; // under the touch controls
    ctx.globalAlpha = a;
    const jy = slot >= 2 ? VIEW_H - M - 24 : M;
    ctx.fillStyle = 'rgba(10,8,6,0.6)';
    roundRect(ctx, x, jy, PANEL_W, 24, 6);
    ctx.fill();
    ctx.font = `bold 11px ${SANS}`;
    ctx.textAlign = 'center';
    const how = document.body.classList.contains('touching') ? 'GAMEPAD A TO JOIN' : 'GAMEPAD A OR KEY 2 TO JOIN';
    outlined(ctx, `P${slot + 1}: ${how}`, x + PANEL_W / 2, jy + 16, '#e8d8a8', '#000', 3);
    ctx.globalAlpha = 1;
    return;
  }
  const def = p.def;
  frame(ctx, x, y, PANEL_W, PANEL_H, def.color);

  // colour crest
  const cg = ctx.createLinearGradient(x, y, x, y + PANEL_H);
  cg.addColorStop(0, def.color); cg.addColorStop(1, def.dark);
  ctx.fillStyle = cg;
  roundRect(ctx, x + 8, y + 8, 40, PANEL_H - 16, 5);
  ctx.fill();
  ctx.font = `bold 15px ${SERIF}`;
  ctx.textAlign = 'center';
  outlined(ctx, def.short, x + 28, y + 38, '#fff', 'rgba(0,0,0,0.6)', 3);
  ctx.font = `bold 10px ${SANS}`;
  outlined(ctx, `LV${p.lvl}`, x + 28, y + 62, '#ffe890', '#000', 3);

  ctx.textAlign = 'left';
  ctx.font = `bold 14px ${SERIF}`;
  outlined(ctx, def.name.toUpperCase(), x + 56, y + 22, def.color, '#000', 3);

  if (!p.alive) {
    ctx.font = `bold 13px ${SANS}`;
    const blink = Math.floor(g.time * 2) % 2;
    outlined(ctx, p.deadT > 1.5 ? `PRESS ${BTN('attack', p.source)}` : 'EATEN', x + 56, y + 44, blink ? '#ff6050' : '#a03020', '#000', 3);
    if (p.deadT > 1.5) outlined(ctx, 'TO CONTINUE', x + 56, y + 60, blink ? '#ff6050' : '#a03020', '#000', 3);
    return;
  }

  // health
  ctx.font = `bold 9px ${SANS}`;
  outlined(ctx, 'HEALTH', x + 56, y + 36, '#c8b88a', '#000', 2);
  const hc = p.hp < 200 ? (Math.floor(g.time * 5) % 2 ? '#ff3a2a' : '#ffd0c0') : '#ffffff';
  const hpv = Math.max(0, Math.floor(p.hp));
  const hpText = hpv >= 1e9 ? `${Math.floor(hpv / 1e8) / 10}B` : hpv >= 1e6 ? `${Math.floor(hpv / 1e5) / 10}M` : hpv >= 1e5 ? `${Math.floor(hpv / 100) / 10}K` : String(hpv);
  let hpSize = 26; // shrink to stay clear of the flashbang badge and the TURBO bar
  ctx.font = `bold ${hpSize}px ${SANS}`;
  while (hpSize > 12 && ctx.measureText(hpText).width > 74) { hpSize--; ctx.font = `bold ${hpSize}px ${SANS}`; }
  outlined(ctx, hpText, x + 56, y + 61, hc, '#000', 4);

  // score
  ctx.textAlign = 'right';
  ctx.font = `bold 9px ${SANS}`;
  outlined(ctx, 'CASH', x + PANEL_W - 12, y + 22, '#c8b88a', '#000', 2);
  ctx.font = `bold 13px ${SANS}`;
  outlined(ctx, `$${p.gold}`, x + PANEL_W - 12, y + 36, '#ffe070', '#000', 3);

  // inventory: flashbangs
  const iy = y + 46;
  let ix = x + 152;
  // the flashbang key, as a little key cap, so players know they have one and how to use it
  const mk = btn('magic', p.source);
  if (mk.length <= 2) {
    ctx.font = `bold 9px ${SANS}`;
    ctx.textAlign = 'center';
    roundRect(ctx, ix - 15, iy - 6, 11, 12, 2);
    ctx.fillStyle = p.potions ? '#c8d0ff' : '#5a5a6a';
    ctx.fill();
    ctx.fillStyle = '#10142a';
    ctx.fillText(mk.toUpperCase(), ix - 9.5, iy + 3.5);
  }
  for (let i = 0; i < Math.min(p.potions, 3); i++) drawPotionIcon(ctx, ix + i * 11, iy);
  if (p.potions > 3) { ctx.font = `bold 10px ${SANS}`; ctx.textAlign = 'left'; outlined(ctx, `x${p.potions}`, ix + 36, iy + 4, '#8aa0ff', '#000', 2); }

  // turbo bar
  const bx = x + 136, by = y + 62, bw = PANEL_W - 148, bh = 7;
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(bx, by, bw, bh);
  const tg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  tg.addColorStop(0, '#ffe040'); tg.addColorStop(1, '#ff3a10');
  ctx.fillStyle = tg;
  ctx.fillRect(bx, by, bw * (p.turbo / 100), bh);
  if (p.turbo >= TURBO_COST) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(g.time * 10) * 0.2})`;
    ctx.fillRect(bx, by, bw * (p.turbo / 100), bh);
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx + bw * (TURBO_COST / 100), by - 1, 1, bh + 2);
  ctx.strokeStyle = '#a07a30';
  ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
  ctx.font = `bold 8px ${SANS}`;
  ctx.textAlign = 'left';
  outlined(ctx, 'TURBO', bx, by - 2, '#ffb040', '#000', 2);

  // xp sliver
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(x + 56, y + PANEL_H - 9, 72, 2);
  ctx.fillStyle = '#ffe070';
  ctx.fillRect(x + 56, y + PANEL_H - 9, 72 * Math.min(1, p.xp / xpForLevel(p.lvl)), 2);

  // active power-ups
  let k = 0;
  for (const [name, t] of Object.entries(p.buffs)) {
    const px = x + PANEL_W - 14 - k * 14, py = y + 44;
    ctx.fillStyle = POWERUPS[name].color;
    ctx.globalAlpha = t < 3 && Math.floor(g.time * 8) % 2 ? 0.3 : 1;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    k++;
  }
}

function drawPotionIcon(ctx, x, y) { // a flashbang grenade
  ctx.fillStyle = '#c8ccd8';
  roundRect(ctx, x - 3.5, y - 5, 7, 11, 2);
  ctx.fill();
  ctx.fillStyle = '#ffcc33';
  ctx.fillRect(x - 3.5, y - 1, 7, 2);
  ctx.fillStyle = '#ff2ea6';
  ctx.fillRect(x - 1, y - 8, 2, 3);
}

function drawBossBar(ctx, g) {
  if (!g.boss) return;
  const e = g.boss;
  const w = 380, x = (VIEW_W - w) / 2, y = 22;
  frame(ctx, x - 12, y - 14, w + 24, 40, '#ff4020');
  ctx.font = `bold 14px ${SERIF}`;
  ctx.textAlign = 'center';
  outlined(ctx, g.info.boss.name.toUpperCase(), VIEW_W / 2, y + 2, '#ffd8a0', '#000', 3);
  ctx.fillStyle = '#300';
  ctx.fillRect(x, y + 8, w, 9);
  const hg = ctx.createLinearGradient(0, y + 8, 0, y + 17);
  hg.addColorStop(0, '#ff7040'); hg.addColorStop(1, '#a01808');
  ctx.fillStyle = hg;
  ctx.fillRect(x, y + 8, w * Math.max(0, e.hp / e.maxHp), 9);
  // the guardian gets nastier at two thirds and one third of its health
  ctx.fillStyle = '#ffe0b0';
  for (const k of [0.33, 0.66]) ctx.fillRect(x + w * k - 1, y + 6, 2, 13);
  ctx.font = `bold 11px ${SANS}`;
  const tags = [];
  if (e.stun > 0) tags.push(['WINDED: HIT IT!', '#ffe060']);
  if (e.ward > 0) tags.push(['FLASH-PROOF', '#c9a0ff']);
  if ((e.bphase || 1) === 3) tags.push(['DEEP-FRIED FURY', '#ff6040']);
  tags.forEach(([text, color], i) => { ctx.textAlign = 'center'; outlined(ctx, text, VIEW_W / 2 + (i - (tags.length - 1) / 2) * 130, y + 34, color, '#000', 3); });
}

// The current lesson in the Training Grounds, in a box at the top of the screen.
function drawTutorial(ctx, g, tut) {
  const w = 456, x = (VIEW_W - w) / 2, y = 10; // clear of the P1 / P2 panels at either side
  ctx.font = `15px ${SANS}`;
  const rows = wrap(ctx, tut.text, w - 56);
  const h = 56 + rows.length * 19;
  frame(ctx, x, y, w, h, tut.done ? '#60e060' : '#f2c14e');
  ctx.textAlign = 'center';
  ctx.font = `bold 12px ${SANS}`;
  outlined(ctx, `ORIENTATION ${tut.n} / ${tut.of}`, VIEW_W / 2, y + 17, '#c8b88a', '#000', 2);
  ctx.font = `bold 17px ${SERIF}`;
  outlined(ctx, tut.done ? `${tut.title}  ✓` : tut.title, VIEW_W / 2, y + 35, tut.done ? '#80ff80' : '#ffe080', '#000', 3);
  ctx.font = `15px ${SANS}`;
  rows.forEach((r, i) => outlined(ctx, r, VIEW_W / 2, y + 56 + i * 19, '#f4ead0', '#000', 3));
  if (g.banner && g.banner.t > 0) {
    // the level-name banner still shows, lower down, when training starts
    drawBanner(ctx, g, y + h);
  }
}

// A strip of key caps along the bottom so the controls are always in sight.
function drawControlsBar(ctx, maxW) {
  const items = device === 'touch'
    ? [['STICK', 'move'], ['A', 'attack'], ['B', 'flashbang'], ['X', 'turbo'], ['Y', 'pause']]
    : device === 'pad'
    ? [['STICK', 'move'], ['A', 'attack'], ['B', 'flashbang'], ['X', '+ A turbo'], ['START', 'pause']]
    : [['WASD', 'move'], ['SPACE', 'attack'], ['E', 'flashbang'], ['SHIFT', '+ SPACE turbo'], ['ESC', 'pause'], ['H', 'hide']];
  let size = 14;
  const measure = () => {
    let total = 0;
    for (const [k, label] of items) {
      ctx.font = `bold ${size}px ${SANS}`;
      total += ctx.measureText(k).width + 10 + 4;
      ctx.font = `${size}px ${SANS}`;
      total += ctx.measureText(label).width + 14;
    }
    return total - 14;
  };
  let total = measure();
  while (total > maxW && size > 9) { size--; total = measure(); }
  let x = (VIEW_W - total) / 2;
  const y = VIEW_H - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x - 10, y - size - 8, total + 20, size + 14, 6);
  ctx.fill();
  ctx.textAlign = 'left';
  for (const [k, label] of items) {
    ctx.font = `bold ${size}px ${SANS}`;
    const kw = ctx.measureText(k).width + 10;
    roundRect(ctx, x, y - size - 3, kw, size + 6, 3);
    ctx.fillStyle = '#e8dcc0';
    ctx.fill();
    ctx.fillStyle = '#1a1208';
    ctx.fillText(k, x + 5, y);
    x += kw + 4;
    ctx.font = `${size}px ${SANS}`;
    outlined(ctx, label, x, y, '#f0e6d0', '#000', 3);
    x += ctx.measureText(label).width + 14;
  }
}

function drawBanner(ctx, g, top = 0) {
  if (!g.banner) return;
  // fades out over its last half second, and sits near the top so it stays off the play area
  const a = Math.min(1, g.banner.t / 0.5) * 0.85;
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  const y = Math.max(96, top + 58); // below the boss health bar (y 8 to 48), still well above the play area
  const grad = ctx.createLinearGradient(0, y - 46, 0, y + 30);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 56, VIEW_W, 96);
  if (g.banner.sub) {
    ctx.font = `italic 16px ${SERIF}`;
    outlined(ctx, g.banner.sub, VIEW_W / 2, y - 30, '#d8c8a0', '#000', 3);
  }
  ctx.font = `bold 38px ${SERIF}`;
  const tg = ctx.createLinearGradient(0, y - 30, 0, y + 6);
  tg.addColorStop(0, '#fff4c0'); tg.addColorStop(0.5, '#f2c14e'); tg.addColorStop(1, '#a0601a');
  outlined(ctx, g.banner.text, VIEW_W / 2, y + 6, tg, '#1a0a00', 6);
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx, g, xray = false) {
  const maxW = 170, maxH = 120;
  const s = Math.min(maxW / g.w, maxH / g.h);
  const mw = g.w * s, mh = g.h * s;
  const ox = (VIEW_W - mw) / 2, oy = VIEW_H - mh - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      const t = g.tiles[i];
      if (xray && t === T.CRACKED) { ctx.fillStyle = Math.floor(g.time * 4) % 2 ? '#40ff80' : '#208040'; ctx.fillRect(ox + x * s - 1, oy + y * s - 1, Math.ceil(s) + 2, Math.ceil(s) + 2); continue; }
      if (!g.explored[i] && !xray) continue;
      if (t === T.WALL) continue;
      ctx.fillStyle = t === T.DOOR ? '#c08a3a' : t === T.EXIT ? '#6ad0ff' : t === T.SEALED ? '#a05050' : 'rgba(220,210,190,0.4)';
      ctx.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
    }
  for (const p of g.livePlayers()) {
    ctx.fillStyle = p.def.color;
    ctx.fillRect(ox + (p.x / TILE) * s - 2, oy + (p.y / TILE) * s - 2, 4, 4);
  }
}

// ---------- menus (drawn over the 3D showcase) ----------

export function drawLoading(ctx, progress, error) {
  ctx.fillStyle = '#10061e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = `bold 40px ${SERIF}`;
  outlined(ctx, 'MALL OF THE DEAD', VIEW_W / 2, 280, '#ff4fb8', '#000', 5);
  const w = 360, x = (VIEW_W - w) / 2, y = 320;
  ctx.fillStyle = '#2a1050';
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = '#2ee6ff';
  ctx.fillRect(x, y, w * progress, 12);
  ctx.strokeStyle = '#ff4fb8';
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 13);
  ctx.font = `14px ${SANS}`;
  outlined(ctx, error ? `Failed to load assets: ${error.message}` : 'Unlocking the mall...', VIEW_W / 2, y + 40, error ? '#ff6050' : '#e8d8ff', '#000', 3);
}

const TITLE_X = [110, 255, 705, 850]; // two survivors either side of the menu
export function titleShowcase(time) {
  return CLASS_ORDER.map((cls, i) => ({ cls, sx: TITLE_X[i], sy: 470, scale: 1.1, turn: (i < 2 ? 0.35 : -0.35) + Math.sin(time * 0.7 + i) * 0.2 }));
}

// The title menu: SOLO PLAY, CO-OP LOBBY and CONTROLS (click, tap, or keys). Co-op is also the O key.
const TITLE_BTNS = [
  { id: 'solo', label: 'SOLO PLAY', y: 290, c0: '#ff4fb8', c1: '#8a1a6a', hint: '' },
  { id: 'coop', label: 'CO-OP LOBBY', y: 340, c0: '#3fd6f0', c1: '#1a5fb0', hint: '(or press O)' },
  { id: 'controls', label: 'CONTROLS', y: 390, c0: '#ffd040', c1: '#a06a10', hint: '(or press C)' },
  { id: 'training', label: 'TRAINING / ORIENTATION', y: 440, c0: '#7be07b', c1: '#1c6a2c', hint: '(or press T)' },
  { id: 'intro', label: 'WATCH INTRO', y: 490, c0: '#c070ff', c1: '#4a1a8a', hint: '(or press I)' },
];
const TB_W = 340, TB_H = 42, TB_X = (VIEW_W - TB_W) / 2;
export function titleButtonAt(x, y) {
  for (const b of TITLE_BTNS) if (x >= TB_X - 10 && x <= TB_X + TB_W + 10 && y >= b.y - 6 && y <= b.y + TB_H + 6) return b.id;
  return null;
}
export const titleOnlineAt = (x, y) => titleButtonAt(x, y) === 'coop';

function drawTitleButtons(ctx, time) {
  TITLE_BTNS.forEach((b, i) => {
    const pulse = 0.5 + Math.sin(time * 3 + i) * 0.5;
    ctx.save();
    ctx.shadowColor = b.c0;
    ctx.shadowBlur = 8 + pulse * 12;
    roundRect(ctx, TB_X, b.y, TB_W, TB_H, 8);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + TB_H);
    g.addColorStop(0, b.c0); g.addColorStop(1, b.c1);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `bold 22px ${SERIF}`;
    outlined(ctx, b.label, VIEW_W / 2, b.y + 30, '#ffffff', 'rgba(0,0,0,0.7)', 4);
    ctx.restore();
    if (b.hint && device !== 'touch') {
      ctx.font = `bold 12px ${SANS}`;
      ctx.textAlign = 'left';
      outlined(ctx, b.hint, TB_X + TB_W + 12, b.y + 28, '#e8d8ff', '#000', 3);
    }
  });
}

function drawControlsPanel(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  frame(ctx, 130, 110, VIEW_W - 260, 420, '#ffd040');
  ctx.textAlign = 'center';
  ctx.font = `bold 34px ${SERIF}`;
  outlined(ctx, 'CONTROLS', VIEW_W / 2, 160, '#ffd040', '#000', 5);
  const rows = device === 'touch' ? [
    'Drag on the left side to move', 'A attack  ·  B flashbang  ·  X turbo  ·  Y pauses (also the II button)', 'The speaker button mutes', 'Gamepads join with A', '', 'Cutscenes: tap a choice box. Silence ("...") is a choice too.',
  ] : [
    'Move: WASD or ARROWS', 'Attack: SPACE or ENTER (hold to keep swinging or firing)', 'Flashbang: E      Turbo: hold SHIFT + attack',
    'Second player on the keyboard: press 2 (ARROWS + ENTER)', 'Gamepads: A attack · B flashbang · X / RB turbo',
    'Cutscenes: keys 1-4, click, or tap a choice. "..." is silence, and so is running out of time.',
    'ESC pause · M mute · N music · V announcer · X pixel size · TAB minimap · K skip cutscenes (test)',
  ];
  ctx.font = `15px ${SANS}`;
  rows.forEach((r, i) => outlined(ctx, r, VIEW_W / 2, 214 + i * 32, '#f0e6ff', '#000', 3));
  ctx.font = `bold 14px ${SANS}`;
  outlined(ctx, `${btn('attack')} / ESC: back`, VIEW_W / 2, 500, '#80e0ff', '#000', 3);
}

// The neon MALL OF THE DEAD sign: the title screen draws it, and the opening cinematic slams the very same one in.
export function drawTitleSign(ctx, time, scale = 1, alpha = 1) {
  ctx.save();
  ctx.textAlign = 'center';
  if (scale !== 1) { ctx.translate(VIEW_W / 2, 140); ctx.scale(scale, scale); ctx.translate(-VIEW_W / 2, -140); }
  const flick = Math.sin(time * 23) > 0.96 ? 0.55 : 1;
  ctx.globalAlpha = flick * alpha;
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = 30;
  ctx.font = `bold 78px ${SERIF}`;
  outlined(ctx, 'MALL', VIEW_W / 2, 112, '#ffd8f4', '#ff2ea6', 9);
  ctx.shadowColor = '#2ee6ff';
  ctx.font = `bold 52px ${SERIF}`;
  outlined(ctx, 'OF THE DEAD', VIEW_W / 2, 172, '#d8fbff', '#18a8d8', 7);
  ctx.restore();
}

export function drawTitle(ctx, time, hiscores, progress = null, online = false, controlsOpen = false, skipOn = false) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 200, VIEW_W / 2, VIEW_H / 2, 620);
  vg.addColorStop(0, 'rgba(10,0,30,0)'); vg.addColorStop(1, 'rgba(10,0,30,0.8)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawTitleSign(ctx, time);
  ctx.font = `bold 15px ${SANS}`;
  outlined(ctx, 'BLACK FRIDAY SALE: EVERYONE MUST GO', VIEW_W / 2, 204, '#ffcc33', '#000', 4);
  if (progress) {
    ctx.font = `bold 13px ${SANS}`;
    outlined(ctx, `${btn('magic')}: start a new game (wipes your saved survivors and story choices)`, VIEW_W / 2, 246, '#ffd890', '#000', 3);
  }

  ctx.font = `bold 11px ${SANS}`;
  CLASS_ORDER.forEach((cls, i) => outlined(ctx, CLASSES[cls].name.toUpperCase(), TITLE_X[i], 492, CLASSES[cls].color, '#000', 4));

  if (online) {
    drawTitleButtons(ctx, time);
    drawRecordsButton(ctx);
  } else if (Math.floor(time * 2) % 2) {
    ctx.font = `bold 24px ${SANS}`;
    const verb = device === 'touch' ? 'TAP' : 'PRESS';
    outlined(ctx, `${verb} ${BTN('attack')} TO ${progress ? 'CONTINUE' : 'START'}`, VIEW_W / 2, 540, '#ffffff', '#000', 5);
  }
  ctx.font = `12px ${SANS}`;
  ctx.textAlign = 'center';
  const lines = device === 'touch' ? [
    'Drag on the left side to move · A attack · B flashbang · X turbo on the right',
    'Y pauses · gamepads join with A',
  ] : [
    'Move: WASD or ARROWS · Attack: SPACE or ENTER · Flashbang: E · Turbo: hold SHIFT + attack',
    'ESC pause / back · M mute · N music · V announcer · K: skip cutscenes (test) · C: controls',
  ];
  lines.forEach((l, i) => outlined(ctx, l, VIEW_W / 2, 586 + i * 16, '#e0d4f8', '#000', 3));
  if (skipOn) { ctx.font = `bold 12px ${SANS}`; outlined(ctx, 'SKIP CUTSCENES: ON (Scene 1 Mall Cop lockdown · Scene 2 save Ray)', VIEW_W / 2, 620, '#80ff90', '#000', 3); }
  if (hiscores.length) {
    ctx.font = `bold 12px ${SANS}`;
    const h = hiscores[0];
    outlined(ctx, `HIGH SCORE  ${fmt(h.score)}  ·  ${h.name.toUpperCase()}  ·  ${stageName(h.level).toUpperCase()}`, VIEW_W / 2, progress ? 264 : 246, '#ffd040', '#000', 3);
  }
  if (controlsOpen) drawControlsPanel(ctx);
}

// What to call a button for a given input source ('kb', 'kb1', 'kb2', 'padN', or one of
// the device kinds 'keys' / 'pad' / 'touch'), so prompts say "Press Enter" rather than
// leaving people to guess which key is Attack.
const BUTTON_NAMES = {
  attack: { kb: 'Space', kb1: 'Space', kb2: 'Enter', pad: 'A', touch: 'A' },
  magic: { kb: 'E', kb1: 'E', kb2: '.', pad: 'B', touch: 'B' },
  back: { kb: 'Esc', kb1: 'Esc', kb2: '.', pad: 'B', touch: 'B' }, // leaving a menu
  turbo: { kb: 'Shift', kb1: 'Left Shift', kb2: 'Right Shift', pad: 'X', touch: 'X' },
  start: { kb: 'Esc', kb1: 'Esc', kb2: 'Esc', pad: 'Start', touch: 'Y' }, // pause / resume
};
let device = 'keys';
export function setDevice(d) { device = d; }
export function btn(name, source = device) {
  let src = source === 'keys' ? 'kb' : source;
  if (src.startsWith('net')) src = device === 'keys' ? 'kb' : device; // an online player: name this screen's own buttons
  if (src.startsWith('pad')) src = 'pad';
  if (src === 'kb' && document.body.classList.contains('touching') && device === 'touch') src = 'touch';
  return BUTTON_NAMES[name][src];
}
const BTN = (name, source) => btn(name, source).toUpperCase();

const SEL_W = 220, SEL_GAP = 12, SEL_X0 = (VIEW_W - (SEL_W * 4 + SEL_GAP * 3)) / 2, SEL_Y = 110, SEL_H = 470;

// The full roster is always on screen: a joined column shows that player's pick, and every empty
// column shows one of the survivors nobody has picked yet (so a solo player still sees all four).
function rosterPreview(slots) {
  const taken = new Set(slots.filter(Boolean).map((sl) => sl.cls));
  const spare = CLASS_ORDER.filter((c) => !taken.has(c));
  let n = 0;
  return Array.from({ length: MAX_PLAYERS }, (_, s) => (slots[s] ? null : spare[n++ % Math.max(1, spare.length)] || CLASS_ORDER[s % CLASS_ORDER.length]));
}

export function selectShowcase(slots, time) {
  const out = [];
  const prev = rosterPreview(slots);
  for (let s = 0; s < MAX_PLAYERS; s++) {
    const slot = slots[s];
    const cls = slot ? slot.cls : prev[s];
    out.push({ cls, sx: SEL_X0 + s * (SEL_W + SEL_GAP) + SEL_W / 2, sy: SEL_Y + 262, scale: slot ? 1.75 : 1.55, turn: time * (slot ? 0.9 : 0.6) + s, walk: false, cheer: !!(slot && slot.ready) });
  }
  return out;
}

const SEL_ARROW_Y = 240, SEL_ARROW_INSET = 28;

function drawArrowButton(ctx, cx, cy, dir, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + dir * 9, cy);
  ctx.lineTo(cx - dir * 6, cy - 10);
  ctx.lineTo(cx - dir * 6, cy + 10);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// Which hero-select arrow (if any) is under a tap or click at screen point (x, y).
// Generous hit areas: the outer third of each card, from the portrait down to the name.
export function selectArrowAt(x, y) {
  for (let s = 0; s < MAX_PLAYERS; s++) {
    const cx = SEL_X0 + s * (SEL_W + SEL_GAP);
    const lx = x - cx, ly = y - SEL_Y;
    if (lx < 0 || lx > SEL_W || ly < 120 || ly > 330) continue;
    if (lx < SEL_W / 3) return { slot: s, dir: -1 };
    if (lx > SEL_W * 2 / 3) return { slot: s, dir: 1 };
    return null;
  }
  return null;
}

// Which hero-select card (0-3) a tap at (x, y) lands on, or -1.
export function selectCardAt(x, y) {
  for (let s = 0; s < MAX_PLAYERS; s++) {
    const cx = SEL_X0 + s * (SEL_W + SEL_GAP);
    if (x >= cx && x <= cx + SEL_W && y >= SEL_Y && y <= SEL_Y + SEL_H) return s;
  }
  return -1;
}

// On-canvas buttons for touch screens, where the Xbox face buttons are hidden on menus.
// Each is { id, label, x, y, w, h }; main.js decides which ones a screen has.
export function drawTouchButtons(ctx, btns) {
  for (const b of btns) {
    ctx.save();
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fillStyle = 'rgba(10,6,28,0.82)';
    ctx.fill();
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `bold 16px ${SANS}`;
    outlined(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 6, '#ffe9a8', '#000', 3);
    ctx.restore();
  }
}
export function touchButtonAt(btns, x, y) {
  const b = btns.find((q) => x >= q.x - 6 && x <= q.x + q.w + 6 && y >= q.y - 6 && y <= q.y + q.h + 6);
  return b ? b.id : null;
}

export function drawSelect(ctx, time, slots, countdown, heroes = {}) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = `bold 42px ${SERIF}`;
  const tg = ctx.createLinearGradient(0, 40, 0, 80);
  tg.addColorStop(0, '#d8fbff'); tg.addColorStop(1, '#ff4fb8');
  outlined(ctx, 'CHOOSE YOUR SURVIVOR', VIEW_W / 2, 66, tg, '#1a0a00', 6);
  ctx.font = `13px ${SANS}`;
  const help = document.body.classList.contains('touching')
    ? 'Tap ◀ ▶ to change survivor · tap the middle of the card: ready'
    : `Left/Right or click ◀ ▶: choose · ${btn('attack')}: ready · ${btn('back')}: back`;
  outlined(ctx, help, VIEW_W / 2, 92, '#e0d4b8', '#000', 3);

  const prev = rosterPreview(slots);
  for (let s = 0; s < MAX_PLAYERS; s++) {
    const x = SEL_X0 + s * (SEL_W + SEL_GAP), y = SEL_Y;
    const slot = slots[s];
    const def = slot ? CLASSES[slot.cls] : null;
    roundRect(ctx, x, y, SEL_W, SEL_H, 10);
    ctx.fillStyle = slot ? 'rgba(30,22,16,0.55)' : 'rgba(10,8,6,0.3)';
    ctx.fill();
    ctx.lineWidth = slot ? (slot.ready ? 5 : 4) : 2;
    if (slot) { ctx.shadowColor = def.color; ctx.shadowBlur = 14; }
    ctx.strokeStyle = def ? def.color : 'rgba(160,130,80,0.5)';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.font = `bold 15px ${SANS}`;
    outlined(ctx, `PLAYER ${s + 1}`, x + SEL_W / 2, y + 24, '#f0e0b0', '#000', 3);
    if (!slot) {
      // an open seat: the survivor on show is a preview, with the join hint underneath
      const pd = CLASSES[prev[s]];
      ctx.font = `bold 22px ${SERIF}`;
      outlined(ctx, pd.name.toUpperCase(), x + SEL_W / 2, y + 306, pd.color, '#000', 5);
      ctx.font = `12px ${SANS}`;
      wrap(ctx, pd.blurb, SEL_W - 24).slice(0, 2).forEach((ln, li) => outlined(ctx, ln, x + SEL_W / 2, y + 326 + li * 14, '#c8b890', '#000', 3));
      ctx.font = `bold 15px ${SANS}`;
      if (Math.floor(time * 2) % 2) outlined(ctx, document.body.classList.contains('touching') ? 'TAP TO JOIN' : 'PRESS A TO JOIN', x + SEL_W / 2, y + 360, '#e8d8a8', '#000', 3);
      ctx.font = `12px ${SANS}`;
      outlined(ctx, document.body.classList.contains('touching') ? '' : 'on a gamepad,', x + SEL_W / 2, y + 384, '#a89878', '#000', 2);
      if (!document.body.classList.contains('touching')) outlined(ctx, 'or press 2 to share the keyboard', x + SEL_W / 2, y + 402, '#a89878', '#000', 2);
      continue;
    }
    ctx.font = `11px ${SANS}`;
    outlined(ctx, Input.label(slot.source), x + SEL_W / 2, y + 42, '#b8a888', '#000', 2);
    const saved = !slot.source.startsWith('net') && heroes[slot.cls]; // online guests play fresh survivors
    if (saved) { ctx.font = `bold 12px ${SANS}`; outlined(ctx, `SAVED · LEVEL ${saved.lvl} · $${saved.gold}`, x + SEL_W / 2, y + 60, '#ffd860', '#000', 3); }
    if (!slot.ready) {
      for (const dir of [-1, 1]) drawArrowButton(ctx, x + SEL_W / 2 + dir * (SEL_W / 2 - SEL_ARROW_INSET), y + SEL_ARROW_Y, dir, def.color);
    }
    ctx.font = `bold 26px ${SERIF}`;
    outlined(ctx, def.name.toUpperCase(), x + SEL_W / 2, y + 306, def.color, '#000', 5);
    ctx.font = `12px ${SANS}`;
    wrap(ctx, def.blurb, SEL_W - 24).slice(0, 2).forEach((ln, li) => outlined(ctx, ln, x + SEL_W / 2, y + 326 + li * 14, '#e0d4b8', '#000', 3));
    const stats = [
      ['Health', def.hp / 1100], ['Strength', def.strength / 30], ['Armor', def.armor / 0.25],
      ['Flash', def.magic / 1.6], ['Speed', def.speed / 160],
    ];
    stats.forEach(([n, v], i) => {
      const sy = y + 344 + i * 19;
      ctx.textAlign = 'left';
      outlined(ctx, n, x + 16, sy + 10, '#d8c8a8', '#000', 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x + 84, sy, 118, 11);
      const bg = ctx.createLinearGradient(0, sy, 0, sy + 11);
      bg.addColorStop(0, def.color); bg.addColorStop(1, def.dark);
      ctx.fillStyle = bg;
      ctx.fillRect(x + 84, sy, 118 * Math.min(1, v), 11);
      ctx.textAlign = 'center';
    });
    if (slot.ready) {
      ctx.font = `bold 22px ${SANS}`;
      outlined(ctx, 'READY!', x + SEL_W / 2, y + SEL_H - 14, '#80ff80', '#000', 4);
    }
  }
  if (countdown != null) {
    ctx.font = `bold 22px ${SANS}`;
    outlined(ctx, `Heading for the Security Room in ${Math.ceil(countdown)}...`, VIEW_W / 2, 612, '#fff', '#000', 4);
  }
}

export function drawOverlay(ctx, title, lines, accent = '#f2c14e') {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = `bold 52px ${SERIF}`;
  outlined(ctx, title, VIEW_W / 2, 230, accent, '#000', 7);
  // as large as fits, so the lines stay readable on a phone
  let size = 23;
  ctx.font = `${size}px ${SANS}`;
  const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
  if (widest > VIEW_W - 60) size = Math.floor(size * (VIEW_W - 60) / widest);
  if (lines.length > 1) size = Math.min(size, Math.floor(316 / (lines.length - 1) / 1.55)); // last line by y 600
  size = Math.max(15, size);
  ctx.font = `${size}px ${SANS}`;
  const gap = Math.round(size * 1.55);
  lines.forEach((l, i) => outlined(ctx, l, VIEW_W / 2, 284 + i * gap, '#f0e6d0', '#000', 3));
}

// ---------- story screens ----------

// Heroes standing along the bottom of the menu screens.
export function partyShowcase(g, time, cheer = false, wide = false) {
  if (!g) return [];
  const ps = g.allPlayers();
  return ps.map((p, i) => ({
    cls: p.cls, sx: VIEW_W / 2 + (i - (ps.length - 1) / 2) * (wide ? 170 : 120), sy: wide ? 470 : 612, scale: wide ? 1.22 : 0.78,
    turn: Math.sin(time * 0.8 + i) * 0.3, cheer,
  }));
}

export function storyShowcase(time, g) {
  if (g) return partyShowcase(g, time, false, true);
  return CLASS_ORDER.slice(0, 4).map((cls, i) => ({ cls, sx: 210 + i * 180, sy: 400, scale: 1.14, turn: Math.sin(time * 0.6 + i) * 0.4 }));
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawStory(ctx, story, time) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.45, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!story) return;
  const line = story.lines[story.idx];
  const shown = line.slice(0, Math.floor(story.t * 45));
  frame(ctx, 90, 470, VIEW_W - 180, 130, '#2ee6ff');
  ctx.font = `bold 19px ${SANS}`;
  ctx.textAlign = 'center';
  const rows = wrap(ctx, line, VIEW_W - 240);
  // typewriter over the wrapped rows
  let left = shown.length;
  rows.forEach((r, i) => {
    const part = r.slice(0, Math.max(0, left));
    left -= r.length + 1;
    outlined(ctx, part, VIEW_W / 2, 512 + i * 28, '#f4e8c8', '#000', 4);
  });
  ctx.font = `12px ${SANS}`;
  outlined(ctx, `${story.idx + 1} / ${story.lines.length}     ${btn('attack')}: continue     ${btn('back')}: skip`, VIEW_W / 2, 590, '#b8a888', '#000', 3);
  ctx.font = `bold 34px ${SERIF}`;
  const tg = ctx.createLinearGradient(0, 40, 0, 80);
  tg.addColorStop(0, '#d8fbff'); tg.addColorStop(1, '#ff4fb8');
  outlined(ctx, 'BLACK FRIDAY', VIEW_W / 2, 72, tg, '#1a0a00', 6);
}

// ---------- the Mall Directory ----------
// Six wings. Wing 1 is playable; the rest are on the board but locked.
const WING_COLORS = ['#ff2ea6', '#40ff90', '#ff3040', '#ff8a30', '#ff3040', '#ffa020'];
const WING_STAGES = ['Food Court Plaza, then The Deep-Fry Butcher', ...[2, 3, 4, 5, 6].map((wing) =>
  `Coming soon: ${BOSS_ROSTER.find((b) => b.wing === wing).name}${wing === 6 ? ' (then the Rooftop Helipad)' : ''}`)];
const MD_X = 150, MD_Y = 80, MD_W = VIEW_W - 300, MD_ROW = 62;
const wingRow = (k) => ({ x: MD_X + 14, y: MD_Y + 62 + k * (MD_ROW + 6), w: MD_W - 28, h: MD_ROW });

// Which wing (0-5) a tap at (x, y) lands on, or null.
export function wingAt(x, y) {
  for (let k = 0; k < WINGS.length; k++) {
    const r = wingRow(k);
    if (x >= r.x && x <= r.x + r.w && y >= r.y - 3 && y <= r.y + r.h + 3) return k;
  }
  return null;
}

export function drawRealmPick(ctx, time, progress, pick) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  frame(ctx, MD_X, MD_Y, MD_W, 62 + WINGS.length * (MD_ROW + 6) + 44, '#2ee6ff');
  ctx.textAlign = 'center';
  ctx.font = `bold 26px ${SERIF}`;
  outlined(ctx, 'MALL DIRECTORY', VIEW_W / 2, MD_Y + 40, '#2ee6ff', '#000', 5);
  WINGS.forEach((w, k) => {
    const r = wingRow(k);
    const open = w.open;
    const done = k === 0 && progress.completed && progress.completed[2];
    const here = pick.realm === k;
    ctx.fillStyle = here ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.35)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fill();
    if (here) { ctx.strokeStyle = open ? '#ffe080' : '#9a8aa0'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
    ctx.fillStyle = open ? WING_COLORS[k] : '#4a4058';
    ctx.fillRect(r.x, r.y, 6, r.h);
    ctx.textAlign = 'left';
    ctx.font = `bold 15px ${SANS}`;
    outlined(ctx, w.long.toUpperCase(), r.x + 18, r.y + 25, open ? '#ffffff' : '#7a7090', '#000', 3);
    ctx.font = `11px ${SANS}`;
    outlined(ctx, WING_STAGES[k], r.x + 18, r.y + 46, open ? '#d8c8f0' : '#6a6080', '#000', 2);
    ctx.textAlign = 'right';
    ctx.font = `bold 13px ${SANS}`;
    outlined(ctx, done ? 'CLEARED' : open ? 'OPEN' : 'LOCKED', r.x + r.w - 14, r.y + 36, done ? '#80e080' : open ? '#ffe080' : '#8a7090', '#000', 3);
  });
  ctx.textAlign = 'center';
  ctx.font = `13px ${SANS}`;
  const help = device === 'touch' ? 'Tap a wing, tap again to enter' : `Up/Down: choose     ${btn('attack')}: enter     ${btn('back')}: back`;
  outlined(ctx, help, VIEW_W / 2, MD_Y + 62 + WINGS.length * (MD_ROW + 6) + 30, '#e0d4f8', '#000', 3);
}

// Labels over the Mall Directory, the cash counter and Ray, and a prompt when someone stands at one.
function drawHubLabels(ctx, g, r3d, prompt = true) {
  ctx.textAlign = 'center';
  const L = g.level;
  // low on the kiosk, clear of the big 3D SECURITY ROOM / MALL DIRECTORY neon overhead
  const dp = r3d.toScreen((L.directory.x + 0.5) * TILE, (L.directory.y + 0.5) * TILE, 6);
  ctx.font = `bold 14px ${SERIF}`;
  outlined(ctx, 'MALL DIRECTORY', dp.x, dp.y + 18, '#2ee6ff', '#000', 3);
  const rp = r3d.toScreen((HUB_RAY.x + 0.5) * TILE, (HUB_RAY.y + 0.5) * TILE, 64);
  const label = hubRayLabel(g.story);
  if (label) { ctx.font = `bold 12px ${SANS}`; outlined(ctx, label, rp.x, rp.y, label.startsWith('RAY:') ? '#a090b0' : '#ffb060', '#000', 3); }
  if (g.hubFocus && prompt) {
    const text = g.hubFocus.type === 'shop' ? `Press ${btn('attack')} to buy upgrades` : `Press ${btn('attack')} to open the Mall Directory`;
    ctx.font = `bold 18px ${SANS}`;
    outlined(ctx, text, VIEW_W / 2, VIEW_H - 120, Math.floor(g.time * 3) % 2 ? '#ffffff' : '#ffe080', '#000', 4);
  }
}

// Shop panels, sized for the party: a solo hero gets one big two-column panel (readable on a
// phone, where this whole screen is shrunk to fit), two or three heroes get large columns, and
// four share the screen at the normal size. Items run top to bottom, then on to the next column.
const SHOP_TOP = 90, SHOP_BOTTOM = 584; // (room below for the online bar)
function shopLayout(n, i) {
  // with touch controls on screen, keep clear of the buttons down the right side
  const touch = document.body.classList.contains('touching');
  const left = touch ? 16 : 40, right = touch ? 816 : VIEW_W - 40;
  if (n <= 1) return { x: left, y: SHOP_TOP, w: right - left, h: SHOP_BOTTOM - SHOP_TOP, cols: 2, top: 60, rowH: 86, gap: 8, pad: 22, f: 1.85, wide: true };
  const gap = 10, room = touch ? right - left : VIEW_W - 30, w = Math.min(440, (room - gap * (n - 1)) / n);
  const f = Math.min((SHOP_BOTTOM - SHOP_TOP) / 410, w / 222);
  const x0 = (touch ? left : (VIEW_W - room) / 2) + (room - (w * n + gap * (n - 1))) / 2;
  return { x: x0 + i * (w + gap), y: SHOP_TOP, w, h: 410 * f, cols: 1, top: 62 * f, rowH: 34 * f, gap: 6 * f, pad: 10 * f, f };
}

function shopRow(L, k) {
  const per = Math.ceil(SHOP.length / L.cols);
  const col = Math.floor(k / per), row = k % per;
  const cw = (L.w - L.pad * 2 - L.gap * (L.cols - 1)) / L.cols;
  return { x: L.x + L.pad + col * (cw + L.gap), y: L.y + L.top + row * (L.rowH + L.gap), w: cw, h: L.rowH };
}

// Which panel and item a tap at (x, y) lands on, or null.
export function shopItemAt(x, y, n) {
  for (let i = 0; i < n; i++) {
    const L = shopLayout(n, i);
    for (let k = 0; k < SHOP.length; k++) {
      const r = shopRow(L, k);
      if (x >= r.x && x <= r.x + r.w && y >= r.y - L.gap / 2 && y <= r.y + r.h + L.gap / 2) return { i, k };
    }
  }
  return null;
}

export function drawShop(ctx, time, g, cursors) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(6,4,2,0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = document.body.classList.contains('touching') ? 416 : VIEW_W / 2; // over the panels
  ctx.textAlign = 'center';
  ctx.font = `bold 34px ${SERIF}`;
  const tg = ctx.createLinearGradient(0, 30, 0, 70);
  tg.addColorStop(0, '#fff4c0'); tg.addColorStop(1, '#ffa020');
  outlined(ctx, 'CASH UPGRADE COUNTER', cx, 52, tg, '#1a0a00', 6);
  ctx.font = `bold 16px ${SANS}`;
  const help = device === 'touch'
    ? `Tap an item, tap again to buy   ${btn('back')}: done   (everyone must finish)`
    : `Up/Down: browse   ${btn('attack')}: buy   ${btn('back')}: done   (everyone must finish)`;
  outlined(ctx, help, cx, 78, '#e0d4b8', '#000', 3);
  const ps = g.allPlayers();
  const n = ps.length;
  ps.forEach((p, i) => {
    const c = cursors[p.slot] || { idx: 0 };
    const L = shopLayout(n, i), f = L.f, { x, y } = L;
    frame(ctx, x, y, L.w, L.h, p.def.color);
    const gold = `$${p.gold}`, goldColor = c.deny > 0 ? '#ff5040' : '#ffd860';
    if (L.wide) {
      ctx.textAlign = 'left';
      ctx.font = `bold 26px ${SERIF}`;
      outlined(ctx, `${p.name.toUpperCase()}  LV${p.lvl}`, x + L.pad + 6, y + 40, p.def.color, '#000', 4);
      ctx.textAlign = 'right';
      ctx.font = `bold 28px ${SANS}`;
      outlined(ctx, gold, x + L.w - L.pad - 6, y + 40, goldColor, '#000', 4);
    } else {
      ctx.textAlign = 'center';
      ctx.font = `bold ${15 * f}px ${SERIF}`;
      outlined(ctx, `${p.name.toUpperCase()}  LV${p.lvl}`, x + L.w / 2, y + 26 * f, p.def.color, '#000', 4);
      ctx.font = `bold ${16 * f}px ${SANS}`;
      outlined(ctx, gold, x + L.w / 2, y + 48 * f, goldColor, '#000', 3);
    }
    SHOP.forEach((item, k) => {
      const r = shopRow(L, k);
      const here = c.idx === k && !c.done;
      const cost = priceOf(p, item), full = maxed(p, item);
      const afford = item.id === 'done' || (p.gold >= cost && !full);
      ctx.fillStyle = here ? 'rgba(255,220,140,0.25)' : 'rgba(0,0,0,0.3)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 5 * f);
      ctx.fill();
      if (here) { ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 2 * Math.min(f, 1.5); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.textAlign = 'left';
      ctx.font = `bold ${13 * f}px ${SANS}`;
      outlined(ctx, item.name, r.x + 8 * f, r.y + r.h * 0.44, afford ? '#f4ead0' : '#8a7a68', '#000', 3);
      ctx.font = `${10 * f}px ${SANS}`;
      outlined(ctx, item.desc, r.x + 8 * f, r.y + r.h * 0.82, '#b8a888', '#000', 2);
      if (item.price) {
        ctx.textAlign = 'right';
        ctx.font = `bold ${12 * f}px ${SANS}`;
        outlined(ctx, full ? 'MAX' : `$${cost}`, r.x + r.w - 8 * f, r.y + r.h * (L.wide ? 0.5 : 0.62), full ? '#9ad0ff' : afford ? '#ffd860' : '#8a6a40', '#000', 3);
      }
    });
    ctx.textAlign = 'center';
    ctx.font = `${(L.wide ? 19 : 11 * f)}px ${SANS}`;
    outlined(ctx, `STR ${Math.round(p.strength)}  ARM ${Math.round(p.armor * 100)}  SPD ${Math.round(p.speed)}  FLASH ${p.magic.toFixed(1)}`, x + L.w / 2, y + L.h - (L.wide ? 16 : 10 * f), '#d8c8a8', '#000', L.wide ? 3 : 2);
    if (c.done) {
      const last = shopRow(L, Math.ceil(SHOP.length / L.cols) - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, x + 6, y + L.top - 6 * f, L.w - 12, last.y + last.h - (y + L.top) + 12 * f, 6);
      ctx.fill();
      ctx.font = `bold ${L.wide ? 40 : 22 * f}px ${SANS}`;
      outlined(ctx, 'READY!', x + L.w / 2, (y + L.top + last.y + last.h) / 2 + 10, '#80ff80', '#000', 4);
    }
    if (c.deny > 0) c.deny -= 0.016;
  });
}

// ---------- stats & leaderboard ----------

// The title screen's button for it, top left.
const RECORDS_BTN = { x: 14, y: 14, w: 290, h: 42 };
export function titleRecordsAt(x, y) {
  const b = RECORDS_BTN;
  return x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8;
}

function drawRecordsButton(ctx) {
  const { x, y, w, h } = RECORDS_BTN;
  roundRect(ctx, x, y, w, h, 12);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(120,84,20,0.92)'); g.addColorStop(1, 'rgba(60,38,8,0.92)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f2c14e';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.font = `bold 18px ${SANS}`;
  outlined(ctx, '🏆  STATS & LEADERBOARD', x + w / 2, y + 27, '#fff0c0', '#2a1800', 4);
  if (device !== 'touch') {
    ctx.font = `bold 12px ${SANS}`;
    outlined(ctx, '(or press L)', x + w / 2, y + h + 15, '#e0c890', '#000', 3);
  }
}

const RECORD_TABS = ['OVERVIEW', 'SURVIVORS', 'LEADERBOARD', 'GLOBAL'];
const TAB_W = 190, TAB_H = 42, TAB_GAP = 10, TAB_Y = 72;
const TAB_X0 = (VIEW_W - (TAB_W * RECORD_TABS.length + TAB_GAP * (RECORD_TABS.length - 1))) / 2;
// GLOBAL page only. Top-right corner (mirrors BACK), well clear of the centred title.
const refreshBtn = () => ({ x: VIEW_W - 14 - 130, y: 14, w: 130, h: 40 });
// Hit area: padded so it is >= 34 screen px tall even on a small phone (canvas scaled ~0.6), but it stops above the tab row.
const hitRefresh = (x, y) => { const r = refreshBtn(); return x >= r.x - 10 && x <= r.x + r.w + 14 && y >= 2 && y <= TAB_Y - 8; };
const BACK_BTN = { x: 14, y: 14, w: 116, h: 40 };

// What a tap on the stats screen hits: a tab (0-3), 'back', 'refresh' (GLOBAL page), or null.
export function recordsTapAt(x, y, tab = 0) {
  const b = BACK_BTN;
  if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) return 'back';
  if (tab === 3 && hitRefresh(x, y)) return 'refresh';
  if (y < TAB_Y - 6 || y > TAB_Y + TAB_H + 6) return null;
  for (let i = 0; i < RECORD_TABS.length; i++) {
    const tx = TAB_X0 + i * (TAB_W + TAB_GAP);
    if (x >= tx && x <= tx + TAB_W) return i;
  }
  return null;
}

const fmt = (n) => Math.floor(n).toLocaleString('en-US');
function hours(sec) {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
// Level number n (1..12, odd = stage, even = boss) as a place name.
export function stageName(n) {
  if (n === 1) return 'Food Court';
  if (n === 2) return "The Butcher's Kitchen";
  if (!n) return 'The hub';
  return `Wing ${Math.floor((n - 1) / 2) + 1}`;
}

// The stats screen. data: see stats.js · progress: the save · heroes: saved survivors
// (for their levels) · unlocked: heroes that can be played · tab: 0-3 · global: the online board
// ({ status: 'loading' | 'ok' | 'error', rows }) and isMine(row): which of its rows are ours
export function drawRecords(ctx, time, data, progress, heroes, unlocked, tab, isRecent = () => false, global = null, isMine = () => false) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(4,3,2,0.86)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = `bold 40px ${SERIF}`;
  const tg = ctx.createLinearGradient(0, 20, 0, 60);
  tg.addColorStop(0, '#fff4c0'); tg.addColorStop(1, '#c88a2a');
  outlined(ctx, 'SURVIVOR RECORDS', VIEW_W / 2, 52, tg, '#1a0a00', 6);

  // back button and tabs
  const b = BACK_BTN;
  roundRect(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fillStyle = 'rgba(40,26,10,0.9)'; ctx.fill();
  ctx.strokeStyle = '#a07a30'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  ctx.font = `bold 18px ${SANS}`;
  outlined(ctx, '◀ BACK', b.x + b.w / 2, b.y + 26, '#f0e6d0', '#000', 3);
  RECORD_TABS.forEach((name, i) => {
    const x = TAB_X0 + i * (TAB_W + TAB_GAP), on = i === tab;
    roundRect(ctx, x, TAB_Y, TAB_W, TAB_H, 10);
    ctx.fillStyle = on ? 'rgba(200,150,50,0.9)' : 'rgba(30,22,12,0.9)'; ctx.fill();
    ctx.strokeStyle = on ? '#ffe9a0' : '#6a5328'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    ctx.font = `bold 20px ${SANS}`;
    outlined(ctx, name, x + TAB_W / 2, TAB_Y + 28, on ? '#fff' : '#c8b890', '#000', 3);
  });

  if (tab === 0) drawOverview(ctx, data, progress, unlocked);
  else if (tab === 1) drawHeroTable(ctx, data, heroes, unlocked);
  else if (tab === 2) drawLeaderboard(ctx, data, isRecent, time);
  else drawGlobalBoard(ctx, time, global, isMine);

  ctx.textAlign = 'center';
  ctx.font = `15px ${SANS}`;
  const help = device === 'touch' ? `Tap a tab to switch pages · ${btn('back')} or ◀ BACK: return` : `Left/Right: switch pages${tab === 3 ? `   ${btn('attack')} / R: refresh` : ''}   ${btn('back')}: back`;
  outlined(ctx, help, VIEW_W / 2, 628, '#b8a888', '#000', 3);
}

function drawOverview(ctx, d, progress, unlocked) {
  const tiles = [
    ['Time played', hours(d.time)], ['Games played', fmt(d.games)], ['Levels cleared', fmt(d.levels)], ['Bosses defeated', fmt(d.bosses)],
    ['Zombies slain', fmt(d.kills)], ['Spawners smashed', fmt(d.gens)], ['Cash collected', fmt(d.gold)], ['Deaths', fmt(d.deaths)],
    ['Food eaten', fmt(d.food)], ['Flashbangs thrown', fmt(d.potions)], ['Turbo attacks', fmt(d.turbo)],
  ];
  const w = (VIEW_W - 80 - 3 * 12) / 4, h = 104;
  tiles.forEach(([name, value], i) => {
    const x = 40 + (i % 4) * (w + 12), y = 130 + Math.floor(i / 4) * (h + 12);
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(40,30,16,0.85)'; ctx.fill();
    ctx.strokeStyle = '#5a4520'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.font = `bold 36px ${SANS}`;
    outlined(ctx, value, x + w / 2, y + 54, '#ffe9a0', '#000', 4);
    ctx.font = `17px ${SANS}`;
    outlined(ctx, name, x + w / 2, y + 86, '#c8b890', '#000', 3);
  });
  // favourites
  const foe = Object.entries(d.byEnemy).filter(([k]) => ENEMIES[k]).sort((a, b) => b[1] - a[1])[0];
  const fav = Object.entries(d.heroes).sort((a, b) => b[1].time - a[1].time)[0];
  ctx.font = `19px ${SANS}`;
  const line1 = [
    foe ? `Most slain: ${ENEMIES[foe[0]].name} × ${fmt(foe[1])}` : null,
    fav && fav[1].time > 0 ? `Favourite survivor: ${CLASSES[fav[0]].name} (${hours(fav[1].time)})` : null,
  ].filter(Boolean).join('     ·     ');
  outlined(ctx, line1 || 'Play a game and your stats will appear here.', VIEW_W / 2, 518, '#f0e6d0', '#000', 3);
  outlined(ctx, `Online games: ${fmt(d.online)}`, VIEW_W / 2, 554, '#c8b890', '#000', 3);
}

// Table columns are laid out for x 40..920; with touch controls on screen the tables stop
// short of the buttons down the right side, so columns are squeezed toward the left.
function tableX() {
  const k = document.body.classList.contains('touching') ? (812 - 40) / (920 - 40) : 1;
  const X = (x) => 40 + (x - 40) * k;
  X.w = (VIEW_W - 80) * k;
  return X;
}

function drawHeroTable(ctx, d, heroes, unlocked) {
  const X = tableX();
  const cols = [['SURVIVOR', 60, 'left'], ['LEVEL', 330, 'center'], ['TIME', 430, 'center'], ['KILLS', 540, 'center'], ['DEATHS', 650, 'center'], ['CASH', 760, 'center'], ['BEST', 900, 'right']].map(([n, x, a]) => [n, X(x), a]);
  ctx.font = `bold 15px ${SANS}`;
  for (const [name, x, align] of cols) { ctx.textAlign = align; outlined(ctx, name, x, 150, '#a89870', '#000', 3); }
  const rh = Math.min(48, (590 - 166) / unlocked.length);
  unlocked.forEach((cls, i) => {
    const y = 166 + i * rh, h = d.heroes[cls], saved = heroes[cls];
    ctx.fillStyle = i % 2 ? 'rgba(40,30,16,0.55)' : 'rgba(20,15,8,0.55)';
    ctx.fillRect(40, y, X.w, rh - 4);
    const ty = y + rh / 2 + 5;
    ctx.textAlign = 'left';
    ctx.font = `italic bold ${Math.min(22, rh * 0.5)}px ${SERIF}`;
    outlined(ctx, CLASSES[cls].name.toUpperCase(), 60, ty, CLASSES[cls].color, '#000', 4);
    ctx.font = `${Math.min(20, rh * 0.45)}px ${SANS}`;
    const vals = [saved ? saved.lvl : 1, h ? hours(h.time) : '—', h ? fmt(h.kills) : '—', h ? fmt(h.deaths) : '—', h ? fmt(h.gold) : '—', h && h.best ? fmt(h.best) : '—'];
    vals.forEach((v, k) => { ctx.textAlign = cols[k + 1][2]; outlined(ctx, String(v), cols[k + 1][1], ty, '#f0e6d0', '#000', 3); });
  });
}

function drawLeaderboard(ctx, d, isRecent = () => false, time = 0) {
  const X = tableX();
  const runs = d.runs.slice(0, 10);
  const cols = [['#', 64, 'center'], ['SURVIVOR', 100, 'left'], ['SCORE', 400, 'right'], ['REACHED', 440, 'left'], ['PARTY', 690, 'left'], ['DATE', 900, 'right']].map(([n, x, a]) => [n, X(x), a]);
  ctx.font = `bold 15px ${SANS}`;
  for (const [name, x, align] of cols) { ctx.textAlign = align; outlined(ctx, name, x, 150, '#a89870', '#000', 3); }
  if (!runs.length) {
    ctx.textAlign = 'center';
    ctx.font = `italic 22px ${SERIF}`;
    outlined(ctx, 'No records yet. Clock in and make your mark!', VIEW_W / 2, 320, '#c8b890', '#000', 3);
    return;
  }
  ctx.textAlign = 'center';
  ctx.font = `italic 14px ${SANS}`;
  outlined(ctx, 'Each entry is one survivor\'s whole run · deeper stages score more · replayed stages score half', VIEW_W / 2, 607, '#a89870', '#000', 3);
  const medal = ['#ffd84a', '#d8dce8', '#e09a5a'];
  runs.forEach((r, i) => {
    const y = 162 + i * 43, ty = y + 27;
    ctx.fillStyle = i % 2 ? 'rgba(40,30,16,0.55)' : 'rgba(20,15,8,0.55)';
    ctx.fillRect(40, y, X.w, 39);
    const recent = isRecent(r);
    if (recent) { // your latest run: a glowing outline
      ctx.strokeStyle = `rgba(255,216,96,${0.6 + Math.sin(time * 4) * 0.3})`; ctx.lineWidth = 2;
      ctx.strokeRect(41, y + 1, X.w - 2, 37); ctx.lineWidth = 1;
    }
    ctx.textAlign = 'center';
    ctx.font = `bold 21px ${SANS}`;
    outlined(ctx, String(i + 1), X(64), ty, medal[i] || '#c8b890', '#000', 3);
    ctx.textAlign = 'left';
    ctx.font = `italic bold 21px ${SERIF}`;
    outlined(ctx, `${CLASSES[r.cls].name.toUpperCase()}${r.lvl ? `  LV${r.lvl}` : ''}`, X(100), ty, CLASSES[r.cls].color, '#000', 4);
    ctx.textAlign = 'right';
    ctx.font = `bold 21px ${SANS}`;
    outlined(ctx, fmt(r.score), X(400), ty, '#ffe070', '#000', 3);
    ctx.textAlign = 'left';
    ctx.font = `19px ${SANS}`;
    if (r.won) outlined(ctx, '★ Run complete', X(440), ty, '#ffd84a', '#000', 3);
    else outlined(ctx, stageName(r.level), X(440), ty, '#f0e6d0', '#000', 3);
    outlined(ctx, r.mode === 'solo' ? 'Solo' : `${r.mode === 'online' ? 'Online' : 'Co-op'} ${r.players}P`, X(690), ty, r.mode === 'online' ? '#8fe0ff' : '#f0e6d0', '#000', 3);
    ctx.textAlign = 'right';
    if (recent) { ctx.font = `bold 19px ${SANS}`; outlined(ctx, 'NEW', X(900), ty, '#ffd860', '#000', 3); }
    else outlined(ctx, r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', X(900), ty, '#c8b890', '#000', 3);
  });
}

// The online leaderboard: the world's best runs (one per player name), with the ones from
// this browser highlighted. global.status says what to show while it loads or can't be reached.
function drawGlobalBoard(ctx, time, g, isMine) {
  const X = tableX();
  // REFRESH button, top right
  const r = refreshBtn();
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = 'rgba(40,26,10,0.9)'; ctx.fill();
  ctx.strokeStyle = '#a07a30'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.font = `bold 18px ${SANS}`;
  outlined(ctx, g && g.status === 'loading' ? 'LOADING…' : '↻ REFRESH', r.x + r.w / 2, r.y + 26, '#f0e6d0', '#000', 3);
  const cols = [['#', 64, 'center'], ['PLAYER', 100, 'left'], ['SURVIVOR', 330, 'left'], ['SCORE', 560, 'right'], ['REACHED', 600, 'left'], ['DATE', 900, 'right']].map(([n, x, a]) => [n, X(x), a]);
  ctx.font = `bold 15px ${SANS}`;
  for (const [name, x, align] of cols) { ctx.textAlign = align; outlined(ctx, name, x, 150, '#a89870', '#000', 3); }
  const msg = (text, color = '#c8b890') => {
    ctx.textAlign = 'center'; ctx.font = `italic 22px ${SERIF}`;
    outlined(ctx, text, VIEW_W / 2, 320, color, '#000', 3);
  };
  const rows = g && g.status === 'ok' ? g.rows.slice(0, 10) : [];
  if (!g || (g.status === 'loading' && !rows.length)) { msg('Loading the worldwide top 10…'); return; }
  if (g.status === 'error') { msg('Can\'t reach the global leaderboard right now.', '#ffb080'); ctx.font = `17px ${SANS}`; outlined(ctx, 'Your local leaderboard still works. Check your connection and try REFRESH.', VIEW_W / 2, 358, '#c8b890', '#000', 3); return; }
  if (!rows.length) { msg('No scores yet. Be the first on the board!'); return; }
  ctx.textAlign = 'center';
  ctx.font = `italic 14px ${SANS}`;
  outlined(ctx, 'Worldwide best runs, one per player · at the end of a run you can submit yours', VIEW_W / 2, 607, '#a89870', '#000', 3);
  const medal = ['#ffd84a', '#d8dce8', '#e09a5a'];
  rows.forEach((r, i) => {
    const y = 162 + i * 43, ty = y + 27, mine = isMine(r);
    ctx.fillStyle = i % 2 ? 'rgba(40,30,16,0.55)' : 'rgba(20,15,8,0.55)';
    ctx.fillRect(40, y, X.w, 39);
    if (mine) {
      ctx.strokeStyle = `rgba(255,216,96,${0.6 + Math.sin(time * 4) * 0.3})`; ctx.lineWidth = 2;
      ctx.strokeRect(41, y + 1, X.w - 2, 37); ctx.lineWidth = 1;
    }
    const cls = CLASSES[r.cls];
    ctx.textAlign = 'center';
    ctx.font = `bold 21px ${SANS}`;
    outlined(ctx, String(i + 1), X(64), ty, medal[i] || '#c8b890', '#000', 3);
    ctx.textAlign = 'left';
    ctx.font = `bold 21px ${SANS}`;
    outlined(ctx, r.name, X(100), ty, mine ? '#ffe070' : '#f0e6d0', '#000', 3);
    ctx.font = `italic bold 20px ${SERIF}`;
    outlined(ctx, cls ? cls.name.toUpperCase() : '—', X(330), ty, cls ? cls.color : '#c8b890', '#000', 4);
    ctx.textAlign = 'right';
    ctx.font = `bold 21px ${SANS}`;
    outlined(ctx, fmt(r.score), X(560), ty, '#ffe070', '#000', 3);
    ctx.textAlign = 'left';
    ctx.font = `19px ${SANS}`;
    if (r.won) outlined(ctx, '★ Run complete', X(600), ty, '#ffd84a', '#000', 3);
    else outlined(ctx, stageName(r.level), X(600), ty, '#f0e6d0', '#000', 3);
    ctx.textAlign = 'right';
    if (mine) { ctx.font = `bold 19px ${SANS}`; outlined(ctx, 'YOU', X(900), ty, '#ffd860', '#000', 3); }
    else outlined(ctx, r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', X(900), ty, '#c8b890', '#000', 3);
  });
}

// ---------- in-game chatter ----------

const BARK_COLORS = { biker: '#ff7a50', mallCop: '#6aa0ff', skater: '#50e890', mallGoth: '#d070ff', ray: '#ffb060', butcher: '#ff8a30' };
const BARK_NAMES = { biker: 'BIKER', mallCop: 'MALL COP', skater: 'SKATER', mallGoth: 'MALL GOTH', ray: 'RAY' };

// Short lines of squad chatter along the bottom of the screen.
function drawBarks(ctx, g) {
  if (!g.barks || !g.barks.length) return;
  ctx.textAlign = 'left';
  g.barks.slice(-2).forEach((b, i, arr) => {
    const y = VIEW_H - 150 - (arr.length - 1 - i) * 34;
    const a = Math.min(1, b.t * 2);
    ctx.globalAlpha = a;
    ctx.font = `bold 15px ${SANS}`;
    const name = `${BARK_NAMES[b.who] || ''}: `;
    const w = ctx.measureText(name + b.text).width + 24;
    const x = (VIEW_W - w) / 2;
    ctx.fillStyle = 'rgba(12,8,30,0.78)';
    roundRect(ctx, x, y - 20, w, 28, 5);
    ctx.fill();
    ctx.fillStyle = BARK_COLORS[b.who] || '#fff';
    ctx.fillRect(x, y - 20, 4, 28);
    ctx.fillStyle = BARK_COLORS[b.who] || '#fff';
    ctx.fillText(name, x + 12, y);
    ctx.fillStyle = '#f4ecff';
    ctx.fillText(b.text, x + 12 + ctx.measureText(name).width, y);
    ctx.globalAlpha = 1;
  });
}

// ---------- cutscene overlay ----------
// Telltale's timed-choice mechanics, drawn in Mall of the Dead's own clean HUD: thin letterbox
// bars, a dark translucent dialogue plaque, a bottom bar of four choices (three actions and "..."),
// and a thin timer line that drains. The 3D scene behind it is the real mall and the real survivors.

const LB = 42; // default letterbox bar height (cutscenes ask for their own: see Cutscene.view)
const CH = { x: 30, y: 504, w: 210, h: 66, gap: 10 };
const choiceRect = (i) => ({ x: CH.x + i * (CH.w + CH.gap), y: CH.y, w: CH.w, h: CH.h });

// Which choice (0-3) a tap at (x, y) lands on, or -1.
export function cutChoiceAt(x, y, view) {
  if (!view || !view.choices) return -1;
  for (let i = 0; i < view.choices.length; i++) {
    const r = choiceRect(i);
    if (x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 14 && y <= r.y + r.h + 6) return i;
  }
  return -1;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;

export function drawCutscene(ctx, v, time) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (!v) return;
  const card = !!v.card;
  // letterbox: as tall as the scene asks on a desktop; a phone (390px tall) keeps the picture and the text clear
  let bar = Math.max(0, Math.min(v.bar == null ? LB : v.bar, 110));
  if (device === 'touch') bar = Math.min(bar, card ? 64 : 38);
  // a heavy vignette so every shot falls away at the edges
  const vg0 = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.34, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.92);
  vg0.addColorStop(0, 'rgba(0,0,0,0)'); vg0.addColorStop(1, 'rgba(2,0,8,0.62)');
  ctx.fillStyle = vg0;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // an alarm pulse around the edges (red, clean: no pattern)
  if (v.alarm) {
    const a = 0.12 + (Math.sin(time * 8) * 0.5 + 0.5) * 0.2;
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    vg.addColorStop(0, 'rgba(255,0,40,0)');
    vg.addColorStop(1, `rgba(255,20,60,${a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else if (v.mood === 'kitchen' || v.mood === 'fire') { // a warm throb at the edges: the fryers / the burning locker
    const a = 0.1 + (Math.sin(time * 5.3) * 0.5 + 0.5) * 0.1 + (Math.sin(time * 31) > 0.93 ? 0.08 : 0);
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.9);
    vg.addColorStop(0, 'rgba(255,120,20,0)');
    vg.addColorStop(1, `rgba(255,110,20,${a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (v.flash > 0) { ctx.fillStyle = `rgba(255,240,230,${Math.min(0.85, v.flash * 0.8)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawBars(ctx, bar);
  if (v.card) drawChapterCard(ctx, v.card, time);
  else if (v.beat === 'line') drawDialogue(ctx, v);
  else if (v.beat === 'choice') drawChoiceBar(ctx, v, time);
  if (v.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, v.fade)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

// Black bars with a thin neon edge (shared with the opening cinematic).
export function drawBars(ctx, bar) {
  if (bar <= 0) return;
  ctx.fillStyle = 'rgba(2,1,8,0.97)';
  ctx.fillRect(0, 0, VIEW_W, bar);
  ctx.fillRect(0, VIEW_H - bar, VIEW_W, bar);
  ctx.strokeStyle = 'rgba(46,230,255,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, bar + 0.5); ctx.lineTo(VIEW_W, bar + 0.5); ctx.moveTo(0, VIEW_H - bar - 0.5); ctx.lineTo(VIEW_W, VIEW_H - bar - 0.5); ctx.stroke();
}

// Chapter and boss title cards: big type slammed into the middle of the picture, between the bars.
// A boss card (the long Butcher reveal) holds back until the camera lands on him.
function drawChapterCard(ctx, c, time) {
  const show = c.boss && c.dur > 5 ? 2.55 : 0;       // when the type hits
  const age = c.age - show;
  if (age < 0) return;
  const out = c.out > 0 ? 1 - c.out : 1;
  const slam = easeOut(age / (c.boss ? 0.2 : 0.28));  // 0 -> 1: the scale-down onto the screen
  const scale = 1 + (1 - slam) * (c.boss ? 0.75 : 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, age / 0.08)) * out;
  const cy = c.boss ? 318 : 312;
  // a dark band behind the type so it reads over any shot
  const band = ctx.createLinearGradient(0, cy - 100, 0, cy + 100);
  band.addColorStop(0, 'rgba(6,2,14,0)'); band.addColorStop(0.5, `rgba(6,2,14,${c.boss ? 0.78 : 0.7})`); band.addColorStop(1, 'rgba(6,2,14,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, cy - 100, VIEW_W, 200);
  const c0 = c.boss ? '#ff5a18' : '#ff2ea6', c1 = c.boss ? '#ffd040' : '#2ee6ff';
  ctx.textAlign = 'center';
  if (c.boss) { // a small red tag over the name
    ctx.font = `bold 16px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '7px';
    outlined(ctx, 'GUARDIAN', VIEW_W / 2 + 3, cy - 52, '#ff7a50', '#000', 3);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.shadowColor = c0;
  ctx.shadowBlur = 24 + Math.sin(time * 9) * 5;
  const px = c.boss ? 62 : 54;
  ctx.font = `bold ${px}px ${SERIF}`;
  // type that tracks in from wide: letters settle together
  const track = 'letterSpacing' in ctx ? Math.round((1 - easeOut(age / 0.7)) * 14 + 1) : 0;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${track}px`;
  let w = ctx.measureText(c.title).width;
  // size the type so it fits settled (the measure includes the tracking), then cap the slam
  // scale so the title stays inside the screen even at the start of the slam
  if (w > VIEW_W - 120) { ctx.font = `bold ${Math.floor(px * (VIEW_W - 120) / w)}px ${SERIF}`; w = ctx.measureText(c.title).width; }
  const fitScale = Math.min(scale, (VIEW_W - 48) / Math.max(1, w));
  ctx.translate(VIEW_W / 2 + track / 2 * fitScale, cy); // the trailing letter gap would pull it left
  ctx.scale(fitScale, fitScale);
  const fill = ctx.createLinearGradient(0, -px * 0.8, 0, px * 0.2);
  fill.addColorStop(0, '#ffffff'); fill.addColorStop(0.55, c.boss ? '#ffe9b0' : '#ffe0f4'); fill.addColorStop(1, c.boss ? '#ff9a30' : '#ff8ad0');
  outlined(ctx, c.title, 0, 0, fill, c0, 8);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.shadowBlur = 0;
  // the underline sweeps out from the middle (a grease drip on the Butcher's)
  const sweep = easeOut((age - 0.15) / 0.5);
  const uw = Math.min(w, 700) * sweep;
  const ug = ctx.createLinearGradient(-uw / 2, 0, uw / 2, 0);
  ug.addColorStop(0, 'rgba(255,255,255,0)'); ug.addColorStop(0.5, c1); ug.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ug;
  ctx.fillRect(-uw / 2, 14, uw, 4);
  if (c.boss) for (let i = 0; i < 5; i++) { // drips
    const dx = (i - 2) * w * 0.17, dl = (10 + ((i * 37) % 22)) * clamp01((age - 0.4 - i * 0.07) / 0.5);
    ctx.fillStyle = c1; ctx.fillRect(dx - 1.5, 18, 3, dl); ctx.beginPath(); ctx.arc(dx, 18 + dl, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // the sub-line fades in under the slam
  ctx.save();
  ctx.globalAlpha = clamp01((age - 0.35) / 0.4) * out;
  ctx.textAlign = 'center';
  ctx.font = `bold 21px ${SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  outlined(ctx, c.sub, VIEW_W / 2 + 3, cy + 58, c.boss ? '#ffd040' : '#2ee6ff', '#000', 4);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
  // a light streak across the screen as the type lands
  if (age < 0.35) {
    ctx.save();
    ctx.globalAlpha = (1 - age / 0.35) * 0.9 * out;
    const sx = -200 + (VIEW_W + 400) * easeOut(age / 0.3);
    const sg = ctx.createLinearGradient(sx - 160, 0, sx + 160, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, c.boss ? 'rgba(255,200,120,0.9)' : 'rgba(180,255,255,0.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, cy - 3, VIEW_W, 6);
    ctx.restore();
  }
}

function drawDialogue(ctx, v) {
  const x = 90, y = 474, w = VIEW_W - 180, h = 100;
  const col = BARK_COLORS[v.who] || '#2ee6ff';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(10,6,28,0.8)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = col;
  ctx.stroke();
  // the name tab
  ctx.font = `bold 15px ${SERIF}`;
  const nw = ctx.measureText(v.speaker).width + 30;
  ctx.fillStyle = col;
  roundRect(ctx, x + 14, y - 14, nw, 26, 4);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#10061e';
  ctx.fillText(v.speaker.toUpperCase(), x + 29, y + 5);
  ctx.font = `bold 20px ${SANS}`;
  const rows = wrap(ctx, v.full || v.text, w - 48);
  let left = v.text.length;
  rows.forEach((r, i) => {
    const part = r.slice(0, Math.max(0, left));
    left -= r.length + 1;
    outlined(ctx, part, x + 24, y + 42 + i * 26, '#f6f0ff', '#000', 3);
  });
  ctx.font = `11px ${SANS}`;
  ctx.textAlign = 'right';
  outlined(ctx, `${btn('attack')} / click: next`, x + w - 14, y + h - 8, '#9a8ac0', '#000', 2);
}

function drawChoiceBar(ctx, v, time) {
  // the prompt
  ctx.textAlign = 'center';
  ctx.font = `bold 17px ${SANS}`;
  const pw = ctx.measureText(v.prompt).width + 36;
  ctx.fillStyle = 'rgba(10,6,28,0.78)';
  roundRect(ctx, (VIEW_W - pw) / 2, 446, pw, 28, 5);
  ctx.fill();
  outlined(ctx, v.prompt, VIEW_W / 2, 466, '#f6f0ff', '#000', 3);
  if (v.hint) { // a small dim note under the choice buttons, clear of the question
    ctx.globalAlpha = 0.75;
    ctx.font = `italic 12px ${SANS}`;
    outlined(ctx, v.hint, VIEW_W / 2, CH.y + CH.h + 22, '#ffcc33', '#000', 2);
    ctx.globalAlpha = 1;
  }
  // the timer bar: thick, neon, full width above the four choices, and it drains
  const tx = CH.x, tw = 4 * CH.w + 3 * CH.gap, TH = 10, ty = CH.y - TH - 6;
  const frac = Math.max(0, Math.min(1, v.timerFrac));
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(tx - 2, ty - 2, tw + 4, TH + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(tx, ty, tw, TH);
  const hot = frac < 0.3;
  const barCol = hot ? (Math.floor(time * 8) % 2 ? '#ff2e8a' : '#ffd040') : frac < 0.6 ? '#ffd040' : '#2ee6ff';
  ctx.save();
  ctx.shadowColor = barCol; ctx.shadowBlur = hot ? 14 : 8;
  ctx.fillStyle = barCol;
  ctx.fillRect(tx, ty, tw * frac, TH);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; // a highlight strip so it reads as a lit tube
  ctx.fillRect(tx, ty, tw * frac, 2);
  v.choices.forEach((c, i) => {
    const r = choiceRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = c.silence ? 'rgba(20,16,36,0.78)' : 'rgba(10,6,28,0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.silence ? '#7a7090' : '#2ee6ff';
    ctx.stroke();
    // the key badge
    ctx.fillStyle = c.silence ? '#7a7090' : '#ff2ea6';
    roundRect(ctx, r.x + 8, r.y + 8, 22, 22, 4);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `bold 14px ${SANS}`;
    ctx.fillStyle = '#10061e';
    ctx.fillText(String(c.n), r.x + 19, r.y + 24);
    ctx.textAlign = 'left';
    if (c.silence) {
      ctx.font = `bold 30px ${SERIF}`;
      outlined(ctx, '...', r.x + 44, r.y + 38, '#b8b0d0', '#000', 3);
      ctx.font = `11px ${SANS}`;
      outlined(ctx, 'say nothing', r.x + 44, r.y + 56, '#7a7090', '#000', 2);
    } else {
      ctx.font = `bold 14px ${SANS}`;
      const rows = wrap(ctx, c.label, r.w - 52);
      rows.slice(0, 3).forEach((row, k) => outlined(ctx, row, r.x + 40, r.y + 24 + k * 17, '#f6f0ff', '#000', 3));
    }
  });
}

// "X will remember that." Plaques in the upper left, fading after a couple of seconds.
export function drawStoryToasts(ctx, toasts) {
  if (!toasts || !toasts.length) return;
  ctx.textAlign = 'left';
  toasts.slice(0, 3).forEach((t, i) => {
    const a = Math.min(1, t.t * 2.5) * Math.min(1, (2.7 - t.t) * 4 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.font = `bold 17px ${SERIF}`;
    const w = ctx.measureText(t.text).width + 36;
    const x = 18, y = 98 + i * 44; // below the P1 panel (y 10 to 88)
    ctx.fillStyle = 'rgba(10,6,28,0.84)';
    roundRect(ctx, x, y, w, 34, 5);
    ctx.fill();
    ctx.fillStyle = '#ff2ea6';
    ctx.fillRect(x, y, 5, 34);
    ctx.fillStyle = '#f6f0ff';
    ctx.fillText(t.text, x + 18, y + 23);
    ctx.globalAlpha = 1;
  });
}

// ---------- "Your Choices": the end-of-wing recap ----------

export function drawRecap(ctx, time, r, g) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(8,4,20,0.86)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!r) return;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = 20;
  ctx.font = `bold 46px ${SERIF}`;
  { // the title slams in
    const k = easeOut(time / 0.3), sc = 1 + (1 - k) * 0.7;
    ctx.save();
    ctx.globalAlpha = Math.min(1, time / 0.08);
    ctx.translate(VIEW_W / 2, 84); ctx.scale(sc, sc);
    outlined(ctx, r.title, 0, 0, '#ffffff', '#ff2ea6', 7);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.font = `bold 16px ${SANS}`;
  outlined(ctx, `${r.sub}  ·  Summary`, VIEW_W / 2, 112, '#2ee6ff', '#000', 3);
  let y = 150;
  const x = 90, w = VIEW_W - 180;
  for (const row of r.rows || []) {
    const h = 74;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = 'rgba(20,12,44,0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = row.silence ? '#7a7090' : '#2ee6ff';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = `12px ${SANS}`;
    outlined(ctx, row.prompt, x + 16, y + 20, '#9a8ac0', '#000', 2);
    ctx.font = `bold 19px ${SANS}`;
    outlined(ctx, row.silence ? '"..."  You said nothing.' : row.label, x + 16, y + 44, row.silence ? '#b8b0d0' : '#ffffff', '#000', 3);
    ctx.font = `12px ${SANS}`;
    outlined(ctx, row.notes.join('   ·   '), x + 16, y + 64, '#ffcc33', '#000', 2);
    y += h + 10;
  }
  if (r.rayFate) {
    ctx.textAlign = 'center';
    ctx.font = `bold 16px ${SANS}`;
    outlined(ctx, r.rayFate, VIEW_W / 2, y + 18, '#ffb060', '#000', 3);
    y += 34;
  }
  if (r.standings && r.standings.length) {
    ctx.font = `13px ${SANS}`;
    outlined(ctx, `They remember: ${r.standings.join('   ·   ')}`, VIEW_W / 2, y + 14, '#d8c8f0', '#000', 3);
    y += 30;
  }
  ctx.font = `bold 20px ${SERIF}`;
  outlined(ctx, r.hook, VIEW_W / 2, Math.max(y + 24, 560), '#ff4fb8', '#000', 4);
  if (time > 1.2 && Math.floor(time * 2) % 2) {
    ctx.font = `bold 16px ${SANS}`;
    outlined(ctx, `Press ${btn('attack')} to return to the Security Room`, VIEW_W / 2, 608, '#ffffff', '#000', 4);
  }
  void g;
}


// ---------- the opening cinematic's overlay ----------
// Letterbox, the PA subtitles, the hero name cards, the title slam and the skip hint. Text stays inside
// x 60..900 and y 70..570 (between the bars) so a 390px-tall phone, where 1 virtual px is ~0.6 CSS px, can read it.

export function drawIntro(ctx, v, time) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (!v) return;
  if (v.gate) { // before anything: the black waits for a press, which also unlocks the sound
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.55 + Math.sin(time * 3) * 0.3;
    ctx.font = `bold 24px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    outlined(ctx, device === 'touch' ? 'TAP TO BEGIN' : 'PRESS ANY KEY TO BEGIN', VIEW_W / 2 + 2, 322, '#e8e0f0', '#000', 3);
    ctx.globalAlpha = 0.45;
    ctx.font = `20px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    outlined(ctx, 'sound on', VIEW_W / 2 + 1, 356, '#9a90b8', '#000', 3);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
    return;
  }
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,0,8,0.7)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (v.flash > 0) { ctx.fillStyle = `rgba(235,242,255,${Math.min(0.9, v.flash)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  drawBars(ctx, v.bar);
  ctx.textAlign = 'center';
  // the PA's captions
  if (v.caption && v.caption.a > 0) {
    ctx.save();
    ctx.globalAlpha = v.caption.a * (Math.sin(time * 41) > 0.9 ? 0.55 : 1);
    ctx.font = `bold ${v.caption.size}px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    outlined(ctx, v.caption.text, VIEW_W / 2 + 2, v.caption.y, '#f0ead8', '#000', 5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
  if (v.stamp) {
    ctx.save();
    ctx.globalAlpha = v.stamp.a;
    ctx.textAlign = 'left';
    ctx.font = `bold 21px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    outlined(ctx, v.stamp.text, 84, 540, '#9fe8ff', '#000', 4);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
  // a survivor's name card: slides in at the lower left with a role chip
  if (v.card) {
    const c = v.card, a = Math.min(c.in, c.out), x = 84 + (1 - easeOut(c.in)) * -60;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    const bg = ctx.createLinearGradient(40, 0, 560, 0);
    bg.addColorStop(0, 'rgba(6,2,14,0.8)'); bg.addColorStop(1, 'rgba(6,2,14,0)');
    ctx.fillStyle = bg; ctx.fillRect(40, 436, 520, 118);
    ctx.fillStyle = c.color; ctx.fillRect(x - 14, 446, 5, 98);
    ctx.shadowColor = c.color; ctx.shadowBlur = 16;
    ctx.font = `bold 50px ${SERIF}`;
    outlined(ctx, c.name, x, 500, '#ffffff', c.color, 6);
    ctx.shadowBlur = 0;
    ctx.font = `bold 21px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    const tw = ctx.measureText(c.role).width;
    ctx.fillStyle = c.color; roundRect(ctx, x, 512, tw + 30, 30, 4); ctx.fill();
    ctx.fillStyle = '#10061e'; ctx.fillText(c.role, x + 15, 534);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
  // MALL OF THE DEAD: slammed in, the same sign the title screen shows
  if (v.title) {
    const age = v.title.age;
    const k = easeOut(age / 0.14), scale = 1 + (1 - k) * 1.1 + (age > 0.14 && age < 0.4 ? Math.sin((age - 0.14) / 0.26 * Math.PI) * 0.04 : 0);
    ctx.save();
    ctx.globalAlpha = Math.min(1, age / 0.04);
    drawTitleSign(ctx, time, scale, 1);
    if (age > 0.5) {
      ctx.globalAlpha = clamp01((age - 0.5) / 0.6);
      ctx.textAlign = 'center';
      ctx.font = `bold 15px ${SANS}`;
      outlined(ctx, 'BLACK FRIDAY SALE: EVERYONE MUST GO', VIEW_W / 2, 204, '#ffcc33', '#000', 4);
    }
    ctx.restore();
  }
  if (v.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, v.fade)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  // the skip hint: small, bottom right, inside the bar, never on the picture
  if (v.hint > 0) {
    ctx.save();
    ctx.globalAlpha = v.hint * (0.8 + Math.sin(time * 2.4) * 0.2);
    ctx.textAlign = 'right';
    ctx.font = `17px ${SANS}`;
    outlined(ctx, 'tap or press any button to skip', VIEW_W - 64, VIEW_H - 26, '#c8c0e0', '#000', 3);
    ctx.restore();
  }
}
