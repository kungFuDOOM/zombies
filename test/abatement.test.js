import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || globalThis; // the announcer looks for speech synthesis
const { Game } = await import('../src/game.js');
const { ENEMIES, TILE } = await import('../src/config.js');
const { FOOD_COURT } = await import('../src/level.js');
const { cleanGame } = await import('../src/netstate.js');

const idle = { get: () => ({ x: 0, y: 0, attack: false, magic: false, turbo: false, pressed: {} }) };

// survivors standing in the (empty) Security Room
function arena(...classes) {
  const g = new Game();
  const ps = classes.map((cls, i) => g.addPlayer(i, `kb${i}`, cls));
  g.startHub();
  g.levelNum = 1;
  g.refreshDifficulty();
  for (const p of ps) { p.invuln = 0; p.hp = 5000; }
  return { g, ps };
}
// step the game, recording every enemy shot fired; survivors are kept from healing or dying of anything else
function run(g, seconds, each) {
  const fired = new Set();
  for (let i = 0; i < seconds * 60; i++) {
    g.update(1 / 60, idle);
    for (const pr of g.projs) fired.add(pr);
    if (each) each();
  }
  return [...fired];
}

test('a trooper winds up, then fires a rifle round at the survivor', () => {
  const { g, ps: [p] } = arena('biker');
  const e = g.spawnEnemy('abatement', p.x + 150, p.y);
  e.cd = 0;
  let aimed = false;
  const shots = run(g, 3, () => { if (e.act && e.act.type === 'windup') aimed = true; });
  assert.ok(aimed, 'the tell comes first');
  assert.ok(shots.length > 0 && shots.every((s) => s.kind === 'round'));
  assert.ok(p.hp < 5000 - 5, 'and it hits');
});

test('the Skater is never shot: only netted, which slows him and does no damage', () => {
  const { g, ps: [p] } = arena('skater');
  const e = g.spawnEnemy('abatement', p.x + 150, p.y);
  e.cd = 0;
  let netted = false, hurt = false;
  const shots = run(g, 8, () => { if (p.netT > 0) netted = true; if (p.hurtFlash > 0) hurt = true; });
  assert.ok(shots.length > 0 && shots.every((s) => s.kind === 'net' && s.dmg === 0));
  assert.ok(netted, 'a net lands');
  assert.equal(hurt, false);
});

test('with others in the party the team goes for them, and a stray round passes through the Skater', () => {
  const { g, ps: [skater, biker] } = arena('skater', 'biker');
  biker.x = skater.x - 60; biker.y = skater.y;
  const e = g.spawnEnemy('abatement', skater.x + 150, skater.y);
  assert.equal(g.abatementTarget(e)[0], biker, 'the nearer Skater is not the target');
  const hp = skater.hp;
  g.projs.push({ owner: 'enemy', kind: 'round', x: skater.x + 4, y: skater.y, vx: -1, vy: 0, r: 6, dmg: 13, life: 1 });
  g.updateProjectile(g.projs.at(-1), 1 / 60);
  assert.equal(skater.hp, hp);
  assert.equal(g.projs.at(-1).dead, undefined, 'it flies on');
});

test('rounds hit the dead in the way (they fire on everyone)', () => {
  const { g, ps: [p] } = arena('biker');
  const walker = g.spawnEnemy('walker', p.x + 120, p.y);
  const pr = { owner: 'enemy', kind: 'round', x: walker.x + 2, y: walker.y, vx: -1, vy: 0, r: 6, dmg: 13, life: 1 };
  g.updateProjectile(pr, 1 / 60);
  assert.ok(pr.dead && walker.hp < walker.maxHp);
});

test('the team arrives once, in the Food Court, after a survivor pushes in; never in the hub or the kitchen', () => {
  for (const [classes, expected] of [[['biker'], 2], [['biker', 'mallGoth'], 3], [['biker', 'mallGoth', 'mallCop', 'skater'], 4]]) {
    const g = new Game();
    const ps = classes.map((cls, i) => g.addPlayer(i, `kb${i}`, cls));
    g.startHub();
    run(g, 1);
    assert.equal(g.enemies.filter((e) => e.type === 'abatement').length, 0, 'not in the hub');
    g.startLevel(1);
    assert.ok(g.level.foodCourt);
    const team = () => g.enemies.filter((e) => e.type === 'abatement').length;
    g.updateStory(1 / 60);
    assert.equal(team(), 0, 'not at the start');
    for (const p of ps) p.x = (FOOD_COURT.abatement.column + 1) * TILE;
    g.updateStory(1 / 60);
    g.updateStory(1 / 60);
    assert.equal(team(), expected);
    assert.match(g.banner.text, /ABATEMENT TEAM/);
    g.startLevel(2);
    run(g, 1);
    assert.equal(team(), 0, 'not in the kitchen');
  }
});

test('online guests receive troopers, rounds and nets', () => {
  assert.ok(ENEMIES.abatement);
  const row = [1, 'abatement', 10, 10, 20, 45, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const proj = (kind) => [2, kind, 10, 10, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const s = cleanGame({ k: 'L1', E: [row], R: [proj('round'), proj('net'), proj('laser')] });
  assert.equal(s.E.length, 1);
  assert.deepEqual(s.R.map((r) => r[1]), ['round', 'net']);
});
