import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || globalThis; // the announcer looks for speech synthesis
const { Game } = await import('../src/game.js');
const { BOSS_HP_MAGIC_CAP, BOSS_WARD, THRALL, phaseOf } = await import('../src/bosses.js');
const { SnapshotWriter, SnapshotReader } = await import('../src/netstate.js');

const idle = { get: () => ({ x: 0, y: 0, attack: false, magic: false, turbo: false, pressed: {} }) };

// a survivor facing the Butcher in the kitchen (stage n), both on screen
function lair(n, cls = 'mallGoth') {
  const g = new Game();
  const p = g.addPlayer(0, 'kb', cls);
  g.startLevel(n);
  const b = g.boss;
  p.x = b.x - 150; p.y = b.y;
  g.camX = b.x - 400; g.camY = b.y - 300;
  assert.ok(g.onScreen(b), 'the guardian is in view');
  return { g, p, b };
}

test('a flashbang takes only a slice of the Butcher, then it is flash-proof for a while', () => {
  const { g, p, b } = lair(2);
  p.magic = 50; // a potion that would flatten anything else
  p.potions = 3;
  const hp = b.hp;
  g.usePotion(p);
  assert.ok(hp - b.hp <= Math.ceil(b.maxHp * BOSS_HP_MAGIC_CAP), 'no more than the cap');
  assert.ok(hp - b.hp > 0, 'but it does hurt');
  assert.equal(b.ward, BOSS_WARD);
  const warded = b.hp;
  g.usePotion(p);
  assert.equal(b.hp, warded, 'a second potion is resisted while the ward holds');
  assert.equal(p.potions, 1, 'and still spent');
  // the ward wears off
  for (let t = 0; t < BOSS_WARD + 0.5; t += 1 / 30) { p.hp = p.maxHp; g.update(1 / 30, idle); }
  assert.equal(b.ward, 0);
});

test('the Butcher roars into new phases at two thirds and one third of its health', () => {
  const { g, p, b } = lair(2, 'biker');
  assert.equal(phaseOf(b), 1);
  const speed = b.speed;
  b.hp = b.maxHp * 0.6;
  g.update(1 / 60, idle);
  assert.equal(b.bphase, 2);
  assert.ok(b.roar > 0 && b.speed > speed);
  const hp = b.hp;
  g.damageEnemy(b, 100, p, false);
  assert.equal(b.hp, hp, 'no damage while it roars');
  assert.ok(g.items.filter((i) => i.type === 'food').length >= 2, 'food tumbles in for the heroes');
  b.hp = b.maxHp * 0.2;
  g.update(1 / 60, idle);
  assert.equal(b.bphase, 3);
  assert.ok(b.speed > speed * 1.2);
});

test('a winded Butcher takes extra damage', () => {
  const { g, p, b } = lair(2, 'biker');
  let hp = b.hp;
  g.damageEnemy(b, 100, p, false);
  const normal = hp - b.hp;
  b.stun = 1;
  hp = b.hp;
  g.damageEnemy(b, 100, p, false);
  assert.ok(hp - b.hp > normal * 1.4);
});

test('the Butcher runs through all of its moves without a hitch, and calls only a few thralls', () => {
  for (const n of [2]) {
    const { g, p, b } = lair(n);
    const seen = new Set();
    let thralls = 0;
    for (let t = 0; t < 90; t += 1 / 30) {
      p.hp = p.maxHp; p.alive = true; // an unkillable hero, so the fight plays out
      if (t > 30 && b.hp > b.maxHp * 0.5) b.hp = b.maxHp * 0.5;
      if (t > 60 && b.hp > b.maxHp * 0.2) b.hp = b.maxHp * 0.2;
      g.update(1 / 30, idle);
      if (b.move) seen.add(b.move.name);
      thralls = Math.max(thralls, g.enemies.filter((e) => e.thrall && e.hp > 0).length);
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `stage ${n}: the guardian stays somewhere`);
    }
    assert.equal(b.bphase, 3, `stage ${n}: reached the last phase`);
    assert.ok(seen.size >= 4, `stage ${n}: used several moves (${[...seen]})`);
    assert.ok(thralls <= THRALL.max + 3, `stage ${n}: at most ${THRALL.max + 3} thralls at once (saw ${thralls})`);
    assert.equal(g.gens.length, 0, 'no spawners in the kitchen');
  }
});

test('an online guest sees the Butcher flash-proof, stunned and in its phase', () => {
  const { g: host, b } = lair(2);
  b.ward = 5; b.stun = 1.5; b.bphase = 2;
  const reader = new SnapshotReader(Game);
  const g = reader.apply(JSON.parse(JSON.stringify(new SnapshotWriter().game(host))), []);
  const mirror = g.enemies.find((e) => e.type === 'boss');
  assert.deepEqual([mirror.ward, mirror.stun, mirror.bphase], [5, 1.5, 2]);
});
