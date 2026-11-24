import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || globalThis; // the announcer looks for speech synthesis
const { Game } = await import('../src/game.js');
const { ENEMIES, CLASSES, BASE_CLASSES } = await import('../src/config.js');

const idle = { get: () => ({ x: 0, y: 0, attack: false, magic: false, turbo: false, pressed: {} }) };

function arena(cls = 'biker') {
  const g = new Game();
  const p = g.addPlayer(0, 'kb', cls);
  g.startHub();
  g.levelNum = 1;
  g.refreshDifficulty();
  p.invuln = 0;
  return { g, p };
}

test('there are exactly four zombie kinds (plus the Grim Shopper), and exactly four survivors', () => {
  assert.deepEqual(Object.keys(ENEMIES).sort(), ['brute', 'death', 'spitter', 'sprinter', 'walker']);
  assert.deepEqual(Object.keys(CLASSES).sort(), ['biker', 'mallCop', 'mallGoth', 'skater']);
  assert.deepEqual(BASE_CLASSES, ['biker', 'mallCop', 'skater', 'mallGoth']);
  const names = Object.values(ENEMIES).map((e) => e.name);
  assert.ok(names.includes('Mall Walker') && names.includes('Food-Court Sprinter') && names.includes('Security Brute') && names.includes('Toxic Spill Spitter'));
});

test('survivors are distinct: the Biker tanks, the Skater is fastest, the Cop spreads shot, the Goth burns', () => {
  const c = CLASSES;
  assert.ok(c.biker.hp > c.mallCop.hp && c.biker.hp > c.skater.hp && c.biker.hp > c.mallGoth.hp);
  assert.ok(c.biker.speed < c.mallCop.speed && c.biker.speed < c.skater.speed);
  assert.ok(c.skater.speed > c.mallCop.speed && c.skater.speed > c.mallGoth.speed && c.skater.speed > c.biker.speed);
  assert.ok(c.mallCop.pellets >= 4 && c.mallCop.knockback > 0);
  assert.ok(c.mallGoth.shotCooldown < 0.2 && c.mallGoth.shotLife < 0.6, 'a short, fast flamethrower');
  assert.deepEqual([c.biker.turbo, c.mallCop.turbo, c.skater.turbo, c.mallGoth.turbo], ['revcharge', 'riot', 'kickflip', 'boombox']);
});

test('sprinters crouch, then lunge at the survivor', () => {
  const { g, p } = arena();
  const e = g.spawnEnemy('sprinter', p.x + 130, p.y);
  e.cd = 0;
  let crouched = false, lunged = false, closest = Infinity;
  for (let i = 0; i < 180; i++) {
    g.update(1 / 60, idle);
    p.hp = 5000;
    if (e.cd2 > 0) crouched = true;
    if (e.charging > 0) lunged = true;
    closest = Math.min(closest, Math.hypot(e.x - p.x, e.y - p.y));
  }
  assert.ok(crouched && lunged, 'it winds up and charges');
  assert.ok(closest < 40, 'the lunge reaches the survivor');
});

test('security brutes shove the survivor back', () => {
  const { g, p } = arena();
  const e = g.spawnEnemy('brute', p.x + 20, p.y);
  e.cd = 0;
  const x0 = p.x;
  for (let i = 0; i < 10; i++) g.update(1 / 60, idle);
  assert.ok(p.x < x0 - 8, 'the survivor was knocked away from the brute');
});

test('spitters lob toxic spills from a distance', () => {
  const { g, p } = arena();
  const e = g.spawnEnemy('spitter', p.x + 200, p.y);
  e.cd = 0;
  let lobbed = false;
  for (let i = 0; i < 120; i++) { g.update(1 / 60, idle); p.hp = 5000; if (g.projs.some((pr) => pr.kind === 'flask')) lobbed = true; }
  assert.ok(lobbed);
});

test('the Mall Cop fires a spread of pellets that knock zombies back', () => {
  const { g, p } = arena('mallCop');
  p.fx = 1; p.fy = 0;
  const w = g.spawnEnemy('walker', p.x + 90, p.y);
  w.cd = 99;
  g.attack(p);
  const pellets = g.projs.filter((pr) => pr.kind === 'pellet');
  assert.equal(pellets.length, CLASSES.mallCop.pellets);
  assert.ok(new Set(pellets.map((pr) => Math.round(pr.vy))).size > 2, 'they fan out');
  const x0 = w.x;
  for (let i = 0; i < 40; i++) g.update(1 / 60, idle);
  assert.ok(w.hp < w.maxHp || w.x > x0, 'a pellet got there');
});

test('propane tanks explode and take the zombies around them with them', () => {
  const { g, p } = arena('mallGoth');
  g.items.push({ type: 'propane', x: p.x + 100, y: p.y, r: 10, bob: 0 });
  const z = g.spawnEnemy('walker', p.x + 110, p.y + 10);
  const hp = z.hp;
  const tank = g.items.find((i) => i.type === 'propane');
  g.explodePropane(tank, p);
  assert.ok(tank.dead);
  assert.ok(z.hp < hp || z.hp <= 0, 'the blast hurt it');
});

test('the four turbo moves each do their thing', () => {
  for (const cls of BASE_CLASSES) {
    const { g, p } = arena(cls);
    p.turbo = 100; p.fx = 1; p.fy = 0;
    const z = g.spawnEnemy('walker', p.x + 60, p.y);
    const hp = z.hp;
    g.turboAttack(p);
    for (let i = 0; i < 30; i++) g.update(1 / 60, idle);
    assert.ok(z.hp < hp || p.dash || g.projs.length > 0 || p.swing > 0, `${cls}: the turbo move did something`);
    assert.ok(p.turbo < 100);
  }
});
