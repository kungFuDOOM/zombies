import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newSave, loadSave, writeSave, isUnlocked, completeLevel, nextStage, levelNumber, realmOf, wingOpen, unlockedClasses, hasProgress,
  SHOP, buy, priceOf, maxed, REALMS, STAGES, STORY,
} from '../src/campaign.js';

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('the campaign is six mall wings of two stages; only Wing 1 can be entered', () => {
  assert.equal(REALMS, 6);
  assert.equal(STAGES, 2);
  const s = newSave();
  assert.ok(isUnlocked(s.progress, 0, 1));
  assert.ok(!isUnlocked(s.progress, 0, 2), 'the Butcher needs the Food Court cleared first');
  completeLevel(s.progress, levelNumber(0, 1));
  assert.ok(isUnlocked(s.progress, 0, 2));
  for (let wing = 1; wing < 6; wing++) {
    assert.equal(wingOpen(wing), false);
    for (let stage = 1; stage <= STAGES; stage++) assert.ok(!isUnlocked(s.progress, wing, stage), `wing ${wing + 1} is locked / coming soon`);
  }
  assert.equal(realmOf(1), 0); assert.equal(realmOf(2), 0); assert.equal(realmOf(3), 1);
});

test('beating the Butcher finishes Wing 1', () => {
  const s = newSave();
  completeLevel(s.progress, 1);
  assert.ok(!s.progress.wing1Done);
  completeLevel(s.progress, 2);
  assert.ok(s.progress.wing1Done);
});

test('nextStage points at the first open, unfinished stage', () => {
  const s = newSave();
  assert.deepEqual(nextStage(s.progress), { realm: 0, stage: 1 });
  completeLevel(s.progress, 1);
  assert.deepEqual(nextStage(s.progress), { realm: 0, stage: 2 });
  completeLevel(s.progress, 2);
  assert.deepEqual(nextStage(s.progress), { realm: 0, stage: 1 }, 'a finished wing can be replayed from the start');
});

test('the cash upgrade counter: purchases cost cash, apply effects, and stat prices escalate', () => {
  const p = { gold: 2000, hp: 100, potions: 0, strength: 10, shotDmg: 5, armor: 0.1, speed: 100, magic: 1, def: { speed: 100 } };
  const str = SHOP.find((i) => i.id === 'strength');
  assert.equal(priceOf(p, str), 500);
  assert.ok(buy(p, str));
  assert.equal(p.strength, 14);
  assert.equal(p.gold, 1500);
  assert.equal(priceOf(p, str), 750);
  assert.ok(buy(p, SHOP.find((i) => i.id === 'food')));
  assert.equal(p.hp, 350);
  assert.ok(buy(p, SHOP.find((i) => i.id === 'soda')));
  assert.equal(p.hp, 750);
  p.gold = 10;
  assert.ok(!buy(p, SHOP.find((i) => i.id === 'potion')), 'cannot buy without cash');
  assert.equal(p.potions, 0);
  assert.equal(SHOP.length, 8);
  assert.equal(SHOP[SHOP.length - 1].id, 'done');
  assert.ok(!SHOP.some((i) => i.id === 'key'), 'there are no keys any more');
  assert.equal(maxed({ potions: 0 }, SHOP[0]), false);
});

test('saves round-trip (under motd-save) and survive corrupt data', () => {
  const st = memoryStorage();
  const s = newSave();
  completeLevel(s.progress, 1);
  s.heroes.biker = { lvl: 4, gold: 120 };
  assert.ok(!hasProgress(newSave()));
  assert.ok(hasProgress(s));
  writeSave(s, st);
  assert.ok(st.getItem('motd-save'));
  const back = loadSave(st);
  assert.deepEqual(back.progress.completed, { 1: true });
  assert.equal(back.heroes.biker.lvl, 4);
  assert.deepEqual(back.story.relationships, { biker: 0, mallCop: 0, skater: 0, mallGoth: 0 });
  st.setItem('motd-save', '{not json');
  assert.deepEqual(loadSave(st).progress.completed, {});
});

test('there are four survivors from the start and no secret heroes', () => {
  assert.deepEqual(unlockedClasses(newSave().progress), ['biker', 'mallCop', 'skater', 'mallGoth']);
  const s = newSave();
  completeLevel(s.progress, 1); completeLevel(s.progress, 2);
  assert.equal(unlockedClasses(s.progress).length, 4);
});

test('difficulty ramps with level and party size', async () => {
  const { difficulty } = await import('../src/config.js');
  const a = difficulty(1, 1), b = difficulty(12, 1), c = difficulty(1, 4);
  assert.ok(a.hp > 1 && a.hp < 1.2, 'the first stage is a little tougher than the base stats');
  assert.ok(b.hp > 1.8 && b.dmg > 1.4, 'late levels are much tougher');
  for (let n = 2; n <= 12; n++) assert.ok(difficulty(n, 1).hp > difficulty(n - 1, 1).hp, 'every stage is a step harder');
  assert.ok(c.hp > 1.6 && c.spawn > 1.5 && c.localCap > a.localCap, 'bigger parties face more zombies');
  assert.ok(b.gold > a.gold, 'later wings pay more');
});

test('zombies make up part of a party\'s level lead, never all of it', async () => {
  const { difficulty, expectedLevel, CLASSES } = await import('../src/config.js');
  for (const n of [1, 5, 9]) {
    const usual = expectedLevel(n);
    const even = difficulty(n, 1, usual), ahead = difficulty(n, 1, usual + 8), behind = difficulty(n, 1, Math.max(1, usual - 3));
    assert.ok(ahead.hp > even.hp && ahead.dmg > even.dmg, 'a leveled-up party meets tougher zombies');
    assert.ok(behind.hp <= even.hp, 'a party behind gets some relief');
    const hits = (CLASSES.biker.strength + 3 * (usual + 7)) / (CLASSES.biker.strength + 3 * (usual - 1));
    assert.ok(hits > 1.1 * (ahead.hp / even.hp), 'leveling up still makes the stage clearly easier');
    assert.equal(difficulty(n, 1, usual + 100).hp, difficulty(n, 1, usual + 15).hp, 'the catch-up is capped');
  }
  assert.ok(expectedLevel(12) > expectedLevel(9) && expectedLevel(9) > expectedLevel(2) && expectedLevel(1) === 1);
});

test('speed tops out a third above where a survivor started, and the counter stops selling it', async () => {
  globalThis.window = globalThis.window || globalThis; // the announcer looks for speech synthesis
  const { Game } = await import('../src/game.js');
  const { maxSpeed, CLASSES } = await import('../src/config.js');
  const g = new Game();
  // a survivor saved before the cap, comically fast, comes back at the cap
  const p = g.addPlayer(0, 'kb', 'mallGoth', { lvl: 17, speed: 330, gold: 99999, upgrades: { speed: 12, junk: 5, magic: -1 } });
  const cap = maxSpeed(CLASSES.mallGoth);
  assert.equal(cap, Math.round(CLASSES.mallGoth.speed * 1.35));
  assert.equal(p.speed, cap);
  assert.deepEqual(p.upgrades, { speed: 12 });
  const speed = SHOP.find((i) => i.id === 'speed');
  assert.ok(maxed(p, speed));
  const cash = p.gold;
  assert.equal(buy(p, speed), false);
  assert.equal(p.gold, cash, 'no cash spent on a maxed stat');
  g.startLevel(1);
  g.gainXp(p, 1e6);
  assert.equal(p.speed, cap);
  const q = g.addPlayer(1, 'kb2', 'skater', { gold: 5000 });
  const before = priceOf(q, speed);
  buy(q, speed);
  const again = g.addPlayer(1, 'kb2', 'skater', g.heroSave(q));
  assert.ok(priceOf(again, speed) > before);
});

test('the story text is Mall of the Dead, with no fantasy leftovers', () => {
  const text = JSON.stringify(STORY);
  assert.match(text, /Black Friday/);
  assert.match(text, /Deep-Fry Butcher/);
  assert.ok(!/Skorne|Rune|Warrior|Valkyrie|Gauntlet|Midway/i.test(text));
});
