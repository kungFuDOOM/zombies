// THE DEEP-FRY BUTCHER: the Food Court boss. Its moves grow over three phases (it roars and
// gets nastier at two thirds and one third of its health). Every move is telegraphed: the
// Butcher winds up (glowing) and attacks that land on the ground mark their spot first, so
// the fight is about reading and dodging. Some moves leave it winded, taking extra damage.
//
// Grenades are no shortcut: they take only a slice of its health, then it is warded for a while.

import { BLAST } from './config.js';
import { enemyWeights } from './level.js';
import { sfx } from './audio.js';

const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const BOSS_HP_MAGIC_CAP = 0.06; // most of its health a potion can take
export const BOSS_WARD = 8;            // seconds a guardian shrugs off magic after a potion

// moves per phase; the last phase adds the deadliest versions
const MOVESETS = {
  butcher: [['sweep', 'slam', 'grease'], ['sweep', 'slam', 'grease', 'summon', 'charge'], ['sweep2', 'slam2', 'grease', 'summon', 'charge2']],
};
const GAP = [1.5, 1.1, 0.75]; // rest between moves, per phase

export function phaseOf(e) { return e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3; }

export function initBoss(e, model) {
  e.model = MOVESETS[model] ? model : 'butcher';
  e.bphase = 1; e.ward = 0; e.stun = 0; e.roar = 0; e.air = false;
  e.move = null; e.rest = 2.0; e.last = null; e.trail = 0;
}

// Damage taken: none while airborne, vanished or roaring; extra while stunned.
export function bossDamage(g, e, amount) {
  if (e.air || e.roar > 0) return 0;
  if (e.stun > 0) amount *= 1.5;
  return amount;
}

export function updateBoss(g, e, p, d, dt, contact) {
  e.ward = Math.max(0, e.ward - dt);
  e.stun = Math.max(0, e.stun - dt);
  e.cd = (e.cd || 0) - dt;
  const ph = phaseOf(e);
  if (ph > e.bphase) { phaseChange(g, e, ph); return; }
  if (e.roar > 0) { e.roar -= dt; return; }
  if (e.stun > 0 && !e.move) return; // dazed: a chance to pile on
  if (ph === 3) { // in its fury the Butcher drips scalding grease as it walks
    e.trail -= dt;
    if (e.trail <= 0) { e.trail = 1.6; pool(g, e, e.x, e.y, 4); }
  }
  if (e.move) {
    e.move.t += dt;
    if (MOVES[e.move.name](g, e, p, e.move, dt)) { e.move = null; e.rest = GAP[e.bphase - 1] * rand(0.8, 1.2); }
    return;
  }
  // between moves: close in and swipe at anyone in reach
  if (contact && e.cd <= 0) { e.cd = 1.5; e.act = { type: 'melee', t: g.time }; g.hurtPlayer(p, e.def.dmg, e); }
  else if (!contact) g.steer(e, p, d, dt);
  e.rest -= dt;
  if (e.rest <= 0) {
    const set = MOVESETS[e.model][e.bphase - 1].filter((m) => m !== e.last);
    const name = set[Math.floor(Math.random() * set.length)];
    e.last = name;
    e.move = { name, t: 0, step: 0 };
    e.act = { type: 'windup', t: g.time };
  }
}

function phaseChange(g, e, ph) {
  e.bphase = ph;
  e.move = null; e.air = false; e.invisible = false; e.charging = 0;
  e.roar = 1.6;
  e.act = { type: 'roar', t: g.time };
  e.speed = e.baseSpeed * (ph === 3 ? 1.3 : 1.12);
  g.shake = Math.max(g.shake, 14);
  g.flash = 0.5;
  sfx.explode();
  g.text(e.x, e.y - 60, ph === 3 ? 'DEEP-FRIED FURY!' : 'HOT OIL!', '#ff6040', 2);
  g.burst(e.x, e.y, '#ff6040', 40, 220);
  summon(g, e, ph === 3 ? 4 : 3);
  // a breather for the heroes: food tumbles into the arena
  for (let i = 0, tries = 0; i < 2 && tries < 20; tries++) {
    const a = Math.random() * Math.PI * 2, r = rand(140, 260);
    const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
    if (g.collides(x, y, 14, true)) continue;
    g.items.push({ type: 'food', x, y, r: 10, bob: 0 });
    i++;
  }
}

// ---------- helpers ----------
const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
const dmg = (e, n) => n * (e.dmgMul || 1);
function lob(g, e, kind, tx, ty, T, n, extra = {}) {
  g.projs.push({ owner: 'enemy', kind, x: e.x, y: e.y, sx: kind === 'meteor' || kind === 'quake' ? tx : e.x, sy: kind === 'meteor' || kind === 'quake' ? ty : e.y, tx, ty, t: 0, T, dmg: dmg(e, n), r: 6, z: 0, ...extra });
}
function pool(g, e, x, y, n) {
  g.projs.push({ owner: 'enemy', kind: 'pool', x, y, vx: 0, vy: 0, t: 0, T: 6, tick: 0.3, dmg: dmg(e, n), r: BLAST.pool, z: 0, life: 6 });
}
function ring(g, e, n, kind, dmgN, speed, off = Math.random()) {
  for (let i = 0; i < n; i++) g.enemyShot(e, ((i + off) / n) * Math.PI * 2, kind, dmgN, speed);
}
// Summoned thralls are weaker than the realm's own monsters, and only so many at once:
// they're there to split the heroes' attention, not to be the fight.
export const THRALL = { hp: 0.5, dmg: 0.6, max: 3 }; // max: alive at once, plus the phase
function summon(g, e, n) {
  const kinds = enemyWeights(g.levelNum).map(([k]) => k);
  const room = THRALL.max + e.bphase - g.enemies.filter((m) => m.thrall && m.hp > 0).length;
  for (let i = 0; i < Math.min(n, room); i++) {
    const a = Math.random() * Math.PI * 2;
    const x = e.x + Math.cos(a) * 70, y = e.y + Math.sin(a) * 70;
    if (g.collides(x, y, 12)) continue;
    const m = g.spawnEnemy(kinds[Math.floor(Math.random() * kinds.length)], x, y);
    m.fromGen = true; m.thrall = true;
    m.hp = m.maxHp = Math.max(1, Math.round(m.hp * THRALL.hp));
    m.dmgMul *= THRALL.dmg;
  }
  g.burst(e.x, e.y, '#ffb020', 20, 160);
}
const targets = (g) => g.livePlayers();

// ---------- the moves: each returns true when finished ----------
// m.t: seconds since the wind-up began. m.step: progress marker so each part fires once.
const inArc = (e, q, reach, half, a0) => {
  const d = dist(e, q);
  if (d > reach + q.r) return false;
  let da = Math.atan2(q.y - e.y, q.x - e.x) - a0;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= half || d < 30;
};
function cleaver(g, e, m, count) {
  const WIND = 0.8;
  if (m.step === 0) { m.a0 = 0; m.hits = 0; m.step = 1; }
  if (m.t < WIND) { // the tell: a red wedge in the air where the cleaver will fall
    if (!m.tell) { m.tell = true; m.a0 = aim(e, m.p0 || g.livePlayers()[0] || e); }
    return false;
  }
  while (m.hits < count && m.t >= WIND + m.hits * 0.55) {
    if (m.hits > 0) m.a0 = aim(e, g.nearestPlayer(e)[0] || e);
    e.act = { type: 'sweep', t: g.time };
    g.shake = Math.max(g.shake, 8); sfx.melee();
    for (let i = -6; i <= 6; i++) { const a = m.a0 + i * 0.12; g.burst(e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, '#e8ecf4', 3, 90); }
    for (const q of targets(g)) {
      if (!inArc(e, q, 92, 0.85, m.a0)) continue;
      g.hurtPlayer(q, 26, e);
      const d = dist(e, q) || 1;
      g.move(q, ((q.x - e.x) / d) * 26, ((q.y - e.y) / d) * 26);
    }
    m.hits++;
  }
  return m.hits >= count && m.t > WIND + count * 0.55;
}
function slam(g, e, p, m, rings) {
  const WIND = 0.7;
  if (m.t < WIND) return false;
  if (m.step === 0) {
    m.step = 1; e.act = { type: 'slam', t: g.time };
    // a ring of marked shockwaves around the Butcher, then a spray of scalding grease
    const n = 6 + e.bphase;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(0, 0.4), r = rand(60, 130);
      lob(g, e, 'quake', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 0.9, 18);
    }
    lob(g, e, 'quake', p.x, p.y, 1.0, 20);
  }
  if (m.step === 1 && m.t >= WIND + 0.9) {
    m.step = 2; g.shake = Math.max(g.shake, 14); sfx.explode();
    g.burst(e.x, e.y, '#ffb020', 30, 220);
    ring(g, e, 14, 'efire', 6, 190);
    e.stun = 1.2; g.text(e.x, e.y - 60, 'WINDED!', '#ffe070', 1.2);
  }
  if (m.step === 2 && rings > 1 && m.t >= WIND + 1.3) { m.step = 3; ring(g, e, 18, 'efire', 6, 210, 0.5); }
  return m.step >= (rings > 1 ? 3 : 2);
}
const MOVES = {
  // the cleaver sweep (one swing, then two in the last phase)
  sweep(g, e, p, m) { m.p0 = p; return cleaver(g, e, m, 1); },
  sweep2(g, e, p, m) { m.p0 = p; return cleaver(g, e, m, 2); },
  // sizzling grease-slam AOE
  slam(g, e, p, m) { return slam(g, e, p, m, 1); },
  slam2(g, e, p, m) { return slam(g, e, p, m, 2); },
  // lobbed fry baskets that leave pools of scalding grease
  grease(g, e, p, m) {
    const WIND = 0.5;
    if (m.t < WIND) return false;
    if (m.step === 0) {
      m.step = 1; e.act = { type: 'cast', t: g.time };
      const ps = targets(g), n = 3 + e.bphase;
      for (let i = 0; i < n; i++) {
        const q = ps[i % ps.length];
        lob(g, e, 'flask', q.x + (i < ps.length ? 0 : rand(-120, 120)), q.y + (i < ps.length ? 0 : rand(-90, 90)), rand(0.9, 1.3), 12, { poolDmg: dmg(e, 4) });
      }
    }
    return m.t > WIND + 0.3;
  },
  summon(g, e, p, m) {
    if (m.t < 0.5) return false;
    e.act = { type: 'cast', t: g.time };
    summon(g, e, 1 + e.bphase);
    return true;
  },
  // a long telegraphed charge; slamming into a wall stuns it
  charge(g, e, p, m, dt) { return chargeMove(g, e, p, m, dt, 1); },
  charge2(g, e, p, m, dt) { return chargeMove(g, e, p, m, dt, 2); },
};

function chargeMove(g, e, p, m, dt, times) {
  const WIND = 0.7;
  if (m.step === 0) { m.step = 1; m.count = 0; g.text(e.x, e.y - 50, '!', '#ff5030', WIND); }
  if (m.t < WIND) return false;
  if (m.step === 1) { // launch a charge at the nearest hero
    const a = aim(e, p);
    e.charging = 0.9; e.cvx = Math.cos(a) * 420; e.cvy = Math.sin(a) * 420;
    e.act = { type: 'melee', t: g.time };
    m.count++; m.hit = false; m.step = 2;
    sfx.turbo();
  }
  if (m.step === 2) {
    e.charging -= dt;
    const blocked = g.move(e, e.cvx * dt, e.cvy * dt);
    for (const q of g.livePlayers()) if (!m.hit && dist(q, e) < e.r + q.r) { m.hit = true; g.hurtPlayer(q, 32, e); }
    if (blocked) { // into the wall: dazed
      e.charging = 0; g.shake = Math.max(g.shake, 12); sfx.explode();
      e.stun = 1.8; g.text(e.x, e.y - 50, 'STUNNED!', '#ffe070', 1.4);
      return true;
    }
    if (e.charging <= 0) { e.charging = 0; m.step = 3; m.pause = 0.4; }
    return false;
  }
  m.pause -= dt; // step 3: catch its breath, then charge again or stop
  if (m.pause > 0) return false;
  if (m.count < times) { m.step = 1; return false; }
  return true;
}
