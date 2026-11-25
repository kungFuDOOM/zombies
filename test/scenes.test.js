import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || globalThis; // the announcer looks for speech synthesis
const { Game } = await import('../src/game.js');
const { Cutscene, SCENES, TYPE_SPEED, resolveShot } = await import('../src/cutscenes.js');
const { newStory, applyChoice, CHOICE_SECONDS, DEFAULT_PICKS } = await import('../src/story.js');
const { FOOD_COURT, T } = await import('../src/level.js');

const idle = { get: () => ({ x: 0, y: 0, attack: false, magic: false, turbo: false, pressed: {} }) };

// a cutscene wired to a story the way main.js does it
function play(id, story = newStory(), opts = {}) {
  const log = [];
  const cut = new Cutscene(id, {
    story, skip: opts.skip,
    hooks: { choose: (cid, pick) => { const r = applyChoice(story, cid, pick); log.push([cid, pick]); return r; } },
  });
  return { cut, story, log };
}
// run to the choice beat
function toChoice(cut) {
  for (let i = 0; i < 40 && !(cut.beat && cut.beat.t === 'choice'); i++) { cut.update(5); if (cut.beat && cut.beat.t !== 'choice') cut.advance(); }
  assert.equal(cut.beat.t, 'choice');
}

test('Scene 1 opens with the chapter card, then lines, then a timed choice with a silence option and the hint', () => {
  const { cut } = play('opening');
  assert.equal(cut.view().card.title, 'WING 1: FOOD COURT');
  assert.match(cut.view().card.sub, /BLACK FRIDAY OUTBREAK/);
  toChoice(cut);
  const v = cut.view();
  assert.equal(v.choices.length, 4);
  assert.deepEqual(v.choices.map((c) => c.n), [1, 2, 3, 4]);
  assert.equal(v.choices[3].label, '...'); assert.equal(v.choices[3].silence, true);
  assert.match(v.choices[0].label, /gate/i); assert.match(v.choices[1].label, /PA/); assert.match(v.choices[2].label, /Charge/i);
  assert.equal(v.hint, 'Silence is a valid option.', 'the first choice teaches that silence is valid');
  assert.equal(v.timerFrac, 1);
});

test('the timer bar shrinks, and when it hits zero silence is picked by the same path as "..."', () => {
  const manual = play('opening');
  toChoice(manual.cut);
  manual.cut.pick(3);
  const timed = play('opening');
  toChoice(timed.cut);
  timed.cut.update(CHOICE_SECONDS / 2);
  assert.ok(Math.abs(timed.cut.view().timerFrac - 0.5) < 0.01, 'the line has drained by half');
  assert.equal(timed.log.length, 0, 'nothing chosen yet');
  timed.cut.update(CHOICE_SECONDS / 2 + 0.1);
  assert.deepEqual(timed.log, [['outbreak', 'timeout']]);
  assert.deepEqual(manual.log, [['outbreak', 'silence']]);
  assert.deepEqual(timed.story, manual.story, 'timeout and a manual "..." leave the story identical');
  assert.equal(timed.story.flags.outbreakPlan, 'silence');
  assert.deepEqual(timed.cut.results[0].res.toasts, manual.cut.results[0].res.toasts);
});

test('keys 1-4 pick, and a pick plays a response beat and fires the "will remember" toast', () => {
  const { cut, story } = play('opening');
  toChoice(cut);
  assert.equal(cut.pick(1), true);
  assert.equal(story.flags.outbreakPlan, 'lure');
  assert.deepEqual(cut.toasts.map((t) => t.text), ['Mall Goth will remember that.']);
  assert.equal(cut.beat.t, 'line', 'a reply follows');
  assert.equal(cut.beat.who, 'mallGoth');
  assert.equal(cut.pick(0), false, 'you cannot pick twice');
  while (!cut.done) { cut.update(5); if (!cut.done) cut.advance(); }
  assert.ok(cut.done);
});

test('lines type out, a press finishes the typing, and the next press moves on', () => {
  const { cut } = play('opening');
  cut.update(10); // past the card
  assert.equal(cut.beat.t, 'line');
  cut.update(1 / TYPE_SPEED * 4);
  assert.ok(cut.view().text.length < cut.beat.text.length);
  cut.advance();
  assert.equal(cut.view().text, cut.beat.text);
  const before = cut.i;
  cut.advance();
  assert.equal(cut.i, before + 1);
});

test('Skip cutscenes makes the documented defaults and finishes at once', () => {
  const a = play('opening', newStory(), { skip: true });
  assert.ok(a.cut.done);
  assert.equal(a.story.flags.outbreakPlan, 'lockdown');
  const b = play('crisis', a.story, { skip: true });
  assert.ok(b.cut.done);
  assert.equal(b.story.flags.rayFate, 'saved');
  assert.deepEqual(b.log.map(([id, pick]) => [id, pick]), [['rayLocker', DEFAULT_PICKS.rayLocker]]);
  assert.deepEqual(a.cut.toasts.map((t) => t.text), ['Mall Cop respects your call.', 'The Food Court shutters locked down.']);
});

test('Scene 2 offers save, loot, hold and "...", and each result is a different outcome', () => {
  const picks = ['save', 'loot', 'hold', 'timeout'];
  const fates = [];
  for (const [i, pick] of picks.entries()) {
    const { cut, story } = play('crisis');
    toChoice(cut);
    assert.equal(cut.view().choices.length, 4);
    if (pick === 'timeout') cut.update(CHOICE_SECONDS + 1); else cut.pick(i);
    fates.push(story.flags.rayFate);
  }
  assert.deepEqual(fates, ['saved', 'overrun', 'injured', 'lost']);
});

test('Scene 3 changes with the earlier choice', () => {
  const lines = (story) => SCENES.boss(story).filter((b) => b.t === 'line').map((b) => `${b.who}: ${b.text}`).join(' | ');
  const ray = newStory(); applyChoice(ray, 'rayLocker', 'save');
  const loot = newStory(); applyChoice(loot, 'rayLocker', 'loot');
  const hold = newStory(); applyChoice(hold, 'rayLocker', 'hold');
  const none = newStory(); applyChoice(none, 'rayLocker', 'silence');
  assert.match(lines(ray), /mallCop: Ray's safe\. Now we close this kitchen/);
  assert.match(lines(loot), /We left Ray for a box of shells/);
  assert.match(lines(hold), /skater: Ray's barely breathing/i);
  assert.match(lines(none), /Nobody's coming\. It's just us/);
  assert.equal(SCENES.boss(ray)[0].title, 'THE DEEP-FRY BUTCHER');
});

test('cutscene cameras are 3D shots of the real survivors, not flat art', () => {
  const g = new Game();
  g.addPlayer(0, 'kb', 'biker');
  g.startHub();
  g.stageCutscene('opening');
  assert.equal(g.allPlayers().length, 1);
  assert.deepEqual(g.npcs.map((n) => n.id).sort(), ['mallCop', 'mallGoth', 'skater'], 'the other three survivors stand in');
  for (const shot of [{ shot: 'wide' }, { shot: 'who', who: 'mallCop' }, { shot: 'who', who: 'biker' }, { shot: 'plaza' }]) {
    const c = resolveShot(g, shot, 1, 'opening');
    for (const k of ['px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov']) assert.ok(Number.isFinite(c[k]), `${shot.shot} ${k}`);
    assert.ok(c.py > 0 && c.py < 200);
  }
  const cop = g.npcs.find((n) => n.id === 'mallCop');
  const c = resolveShot(g, { shot: 'who', who: 'mallCop' }, 1, 'opening');
  assert.ok(Math.hypot(c.lx - cop.x, c.lz - cop.y) < 1, 'the camera looks at the speaker');
  g.endCutscene();
  assert.equal(g.npcs.length, 0);
  assert.equal(g.cutCam, null);
});

// ---------- the story in the game ----------

function foodCourt(story, cls = 'biker') {
  const g = new Game();
  g.story = story;
  g.addPlayer(0, 'kb', cls);
  g.startLevel(1);
  return g;
}
const countAt = (g) => ({ enemies: g.enemies.length, crates: g.items.filter((i) => i.type === 'armorcrate').length, cash: g.items.filter((i) => i.type === 'gold').length });

test('Scene 1 changes the Food Court opening: lockdown thins and rewards, charge pays and punishes, silence is messy', () => {
  const pick = (p) => { const s = newStory(); if (p) applyChoice(s, 'outbreak', p); return s; };
  Math.random = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);
  const base = countAt(foodCourt(pick(null)));
  const lock = foodCourt(pick('cop')), lure = foodCourt(pick('goth')), charge = foodCourt(pick('biker')), silent = foodCourt(pick('silence'));
  assert.ok(countAt(lock).enemies < base.enemies, 'lockdown: fewer early walkers');
  assert.equal(countAt(lock).crates, 2, 'lockdown: a bonus armor/ammo crate near the start');
  assert.ok(lock.spawnRate < 1);
  assert.ok(countAt(lure).enemies < countAt(lock).enemies, 'the PA lure draws the first wave away');
  assert.ok(countAt(charge).enemies > base.enemies, 'the charge: a heavier opening horde');
  assert.ok(countAt(charge).cash > base.cash + 8, 'but extra cash in the open court');
  assert.ok(charge.spawnRate > 1);
  assert.equal(countAt(silent).crates, 0, 'silence: no bonus armor');
  assert.equal(countAt(silent).cash, base.cash, 'silence: no bonus loot');
  assert.ok(countAt(silent).enemies > base.enemies * 0.9 && countAt(silent).enemies > countAt(lock).enemies, 'silence: a messy mid-size wave');
});

test('the lockdown shutter comes down behind the party, and the crisis starts halfway through the plaza', () => {
  const s = newStory(); applyChoice(s, 'outbreak', 'cop');
  const g = foodCourt(s);
  const p = g.allPlayers()[0];
  g.enemies = []; g.gens = [];
  p.hp = 1e6;
  p.x = 20 * 32; p.y = 23 * 32;
  g.update(1 / 60, idle);
  assert.equal(g.tiles[23 * g.w + FOOD_COURT.shutter.x], T.DOOR, 'the front shutters locked');
  assert.equal(g.pendingScene, null);
  p.x = 37 * 32; p.y = 24 * 32;
  g.update(1 / 60, idle);
  assert.equal(g.pendingScene, 'crisis', 'Scene 2 triggers once');
  g.pendingScene = null;
  g.update(1 / 60, idle);
  assert.equal(g.pendingScene, null);
});

function crisis(pick) {
  const s = newStory(); applyChoice(s, 'outbreak', 'cop');
  const g = foodCourt(s);
  g.enemies = g.enemies.filter((e) => !e.pocket);
  const before = g.enemies.length;
  const res = applyChoice(s, 'rayLocker', pick);
  g.applyStoryEffects(res.effects);
  return { g, s, before };
}

test('Scene 2 save: Ray joins the party, the locker is sealed, no heavy weapon', () => {
  const { g } = crisis('save');
  assert.ok(g.npcs.some((n) => n.id === 'ray'));
  assert.equal(g.dmgBoost, 1);
  const door = FOOD_COURT.locker.door;
  assert.equal(g.tiles[door.y * g.w + door.x0], T.DOOR, 'the locker shuttered');
});

test('Scene 2 loot: a big damage boost and the cache, Ray is gone and the pocket is overrun', () => {
  const { g, before } = crisis('loot');
  assert.ok(g.dmgBoost > 1.3);
  assert.ok(!g.npcs.some((n) => n.id === 'ray'));
  assert.ok(g.items.some((i) => i.type === 'amulet' && i.sub === 'super'), 'the heavy gear');
  assert.ok(g.enemies.length > before, 'walkers close in on the pizza counter');
  const door = FOOD_COURT.locker.door;
  assert.notEqual(g.tiles[door.y * g.w + door.x0], T.DOOR);
});

test('Scene 2 hold and silence are risky: an ambush of sprinters, only a scrap of loot', () => {
  const hold = crisis('hold'), frozen = crisis('silence');
  const sprinters = (g) => g.enemies.filter((e) => e.type === 'sprinter').length;
  assert.ok(sprinters(hold.g) >= 6 && sprinters(frozen.g) >= 8);
  assert.ok(hold.g.dmgBoost > 1 && hold.g.dmgBoost < 1.2, 'a scrap of the gear');
  assert.ok(frozen.g.dmgBoost > 1 && frozen.g.dmgBoost < hold.g.dmgBoost);
  assert.ok(hold.g.npcs.some((n) => n.id === 'ray' && n.hurt), 'Ray lives, hurt');
  assert.ok(!frozen.g.npcs.some((n) => n.id === 'ray'));
  assert.ok(hold.g.items.some((i) => i.sub === 'rapid'), 'a little scrap');
  assert.ok(!hold.g.items.some((i) => i.sub === 'super'));
});

test('the boss fight reads the story: Ray tosses healing pizza only if you saved him; the locker boost carries over', () => {
  const run = (pick) => {
    const s = newStory(); applyChoice(s, 'rayLocker', pick);
    const g = new Game();
    g.story = s;
    const p = g.addPlayer(0, 'kb', 'mallCop');
    g.startLevel(2);
    return { g, p, s };
  };
  const saved = run('save');
  const ray = saved.g.npcs.find((n) => n.id === 'ray');
  assert.ok(ray && ray.heal, 'Ray is at the loading dock');
  saved.p.hp = 100; saved.p.invuln = 99;
  const pizzas = () => saved.g.items.filter((i) => i.thrown).length;
  for (let t = 0; t < 30; t += 1 / 30) { saved.p.hp = Math.min(saved.p.hp, 300); saved.g.update(1 / 30, idle); }
  assert.ok(pizzas() >= 1, 'hot pizza arrives mid-fight');
  const loot = run('loot');
  assert.ok(!loot.g.npcs.some((n) => n.id === 'ray'));
  assert.ok(loot.g.dmgBoost > 1.3, 'the heavy hardware still hits the Butcher');
  const hold = run('hold');
  assert.ok(hold.g.npcs.some((n) => n.id === 'ray') && !hold.g.npcs.find((n) => n.id === 'ray').heal, 'injured Ray cannot throw pizza');
  assert.equal(run('silence').g.dmgBoost > 1, true);
});

test('the Security Room shows Ray if he lived, and not if he did not', () => {
  for (const [pick, present] of [['save', true], ['hold', true], ['loot', false], ['silence', false]]) {
    const s = newStory(); applyChoice(s, 'rayLocker', pick);
    const g = new Game();
    g.story = s;
    g.addPlayer(0, 'kb', 'skater');
    g.startHub();
    assert.equal(g.npcs.some((n) => n.id === 'ray'), present, pick);
    assert.equal(g.levelKey, present ? 'HR' : 'H');
  }
});
