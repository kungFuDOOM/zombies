import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, generateHub, bfs, walkable, T, levelInfo, FOOD_COURT, WINGS, ROSTERS, enemyWeights } from '../src/level.js';
import { ENEMIES } from '../src/config.js';

const reach = (L, tiles = L.tiles, open = (t) => walkable(t) || t === T.SEALED) => bfs(tiles, L.w, L.h, [[L.start.x, L.start.y]], open);

test('the mall has six wings: only the Food Court is open', () => {
  assert.equal(WINGS.length, 6);
  assert.deepEqual(WINGS.map((w) => w.open), [true, false, false, false, false, false]);
  assert.match(WINGS[0].long, /Food Court/);
  assert.match(WINGS[1].long, /Arcade, Bowling & Batting Cages/);
  assert.match(WINGS[2].long, /Movie Theater/);
  assert.match(WINGS[3].long, /Fitness Center/);
  assert.match(WINGS[4].long, /Toy Store & Holiday Atrium/);
  assert.match(WINGS[5].long, /Hardware & Garden Center/);
});

test('level 1 is the Food Court plaza and level 2 is the Butcher\'s kitchen', () => {
  const a = levelInfo(1), b = levelInfo(2);
  assert.equal(a.isBoss, false); assert.equal(b.isBoss, true);
  assert.equal(a.style, 'mall');
  assert.equal(b.boss.name, 'The Deep-Fry Butcher');
  const plaza = generateLevel(1), kitchen = generateLevel(2);
  assert.equal(plaza.tiles[plaza.exit.y * plaza.w + plaza.exit.x], T.EXIT);
  assert.ok(kitchen.boss);
  assert.equal(kitchen.tiles[kitchen.exit.y * kitchen.w + kitchen.exit.x], T.SEALED);
  assert.equal(kitchen.generators.length, 0, 'the boss calls its own thralls');
});

test('the Food Court plaza is open end to end: exit, Ray, the locker, loot and spawners are all reachable', () => {
  const L = generateLevel(1);
  const d = reach(L);
  const at = (x, y) => d[y * L.w + x];
  assert.ok(at(L.exit.x, L.exit.y) >= 0, 'exit');
  assert.ok(at(FOOD_COURT.ray.x, FOOD_COURT.ray.y) >= 0, 'Ray behind the pizza counter');
  const lk = FOOD_COURT.locker;
  assert.ok(at(lk.door.x0, lk.door.y) >= 0 && at(lk.x0 + 2, lk.y0 + 1) >= 0, 'the Security Locker');
  for (const thing of [...L.items, ...L.generators, ...L.enemies]) assert.ok(at(thing.x, thing.y) >= 0, `${thing.type} at ${thing.x},${thing.y} is reachable`);
  for (const thing of [...L.items, ...L.generators, ...L.enemies]) assert.equal(L.tiles[thing.y * L.w + thing.x], T.FLOOR);
  assert.ok(L.generators.length >= 8, 'a good number of spawners');
  assert.deepEqual([...new Set(L.generators.map((g) => g.style))].sort(), ['escalator', 'shutter', 'vent']);
  assert.ok(L.stalls.map((s) => s.name).sort().join() === 'BURGERS,PIZZA,SMOOTHIES,TACO', 'the four neon stalls');
});

test('the Food Court has propane barrels, floor pizza and soda, cash, and turbo power-ups', () => {
  const L = generateLevel(1);
  const kinds = new Set(L.items.map((i) => i.type));
  for (const k of ['food', 'gold', 'propane', 'potion', 'amulet']) assert.ok(kinds.has(k), k);
  const subs = new Set(L.items.filter((i) => i.type === 'food').map((i) => i.sub));
  assert.ok(subs.has('pizza') && subs.has('soda'));
  assert.ok(!kinds.has('key') && !kinds.has('rune'), 'no keys or rune stones');
});

test('story rewards sit on walkable floor, ready for the opening and the mid-wing crisis', () => {
  const L = generateLevel(1);
  for (const list of Object.values(L.bonus)) for (const it of list) assert.equal(L.tiles[it.y * L.w + it.x], T.FLOOR, `${it.type} at ${it.x},${it.y}`);
  assert.ok(L.bonus.lockdown.some((i) => i.type === 'armorcrate'));
  assert.ok(L.bonus.charge.filter((i) => i.type === 'gold').length >= 8);
  assert.ok(L.bonus.cache.some((i) => i.sub === 'super'), 'the locker cache holds the heavy goods');
  assert.ok(L.shutters.some((s) => s.id === 'front') && L.shutters.some((s) => s.id === 'locker'));
  // the pocket where Ray hides has besiegers
  assert.ok(L.enemies.filter((e) => e.pocket).length >= 3);
});

test('generation is deterministic', () => {
  for (const n of [1, 2]) {
    const a = generateLevel(n), b = generateLevel(n);
    assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
    assert.deepEqual(a.items, b.items);
    assert.deepEqual(a.enemies, b.enemies);
  }
});

test('the kitchen is reachable from the dock, with room for the fight', () => {
  const L = generateLevel(2);
  const d = reach(L);
  assert.ok(d[L.exit.y * L.w + L.exit.x] >= 0);
  assert.ok(d[L.boss.y * L.w + L.boss.x] >= 0);
  for (const it of L.items) assert.ok(d[it.y * L.w + it.x] >= 0, `${it.type} is reachable`);
  assert.ok(L.items.filter((i) => i.type === 'propane').length >= 3, 'explosive tanks to shoot at the boss');
});

test('the Security Room has a directory, the cash counter, and a place for Ray', () => {
  const absent = generateHub(false), present = generateHub(true);
  assert.equal(absent.hub, true);
  assert.equal(absent.ray.present, false); assert.equal(present.ray.present, true);
  for (const p of [absent.directory, absent.shop, absent.ray]) assert.equal(absent.tiles[p.y * absent.w + p.x], T.FLOOR);
  const d = reach(absent);
  assert.ok(d[absent.directory.y * absent.w + absent.directory.x] >= 0 && d[absent.shop.y * absent.w + absent.shop.x] >= 0 && d[absent.ray.y * absent.w + absent.ray.x] >= 0);
  assert.deepEqual(generateLevel(1).info.theme.name, 'Food Court');
});

test('the Food Court roster is all four zombie kinds, and every spawn belongs to it', () => {
  assert.equal(ROSTERS.length, 1);
  const kinds = new Set(ROSTERS[0].map(([k]) => k));
  assert.deepEqual([...kinds].sort(), ['brute', 'spitter', 'sprinter', 'walker']);
  for (const k of kinds) assert.ok(ENEMIES[k], `${k} is a known monster`);
  const allowed = new Set([...enemyWeights(1).map(([k]) => k)]);
  const L = generateLevel(1);
  for (const e of [...L.enemies, ...L.generators]) assert.ok(allowed.has(e.type), `${e.type} belongs in the Food Court`);
  assert.deepEqual(enemyWeights(2), enemyWeights(1));
});
