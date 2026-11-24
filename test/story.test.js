import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newStory, loadStory, writeStory, applyChoice, resolveOption, resetWing1, STORY_KEY, CHOICES, DEFAULT_PICKS,
  foodCourtModifiers, crisisModifiers, bossModifiers, hubRayPresent, hubRayLabel, recap, remembers, isSilence,
} from '../src/story.js';
import { newSave, loadSave, writeSave } from '../src/campaign.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('a new story starts neutral: no karma, four trust scores, empty flags and log', () => {
  const s = newStory();
  assert.deepEqual(s.relationships, { biker: 0, mallCop: 0, skater: 0, mallGoth: 0 });
  assert.equal(s.flags.outbreakPlan, null);
  assert.equal(s.flags.rayAlive, null);
  assert.deepEqual(s.choices, []);
  assert.equal('karma' in s, false);
});

test('story round-trips through storage, and corrupt storage gives a fresh story', () => {
  const st = memory();
  const s = newStory();
  applyChoice(s, 'outbreak', 'goth', 123);
  writeStory(s, st);
  assert.ok(st.m.has(STORY_KEY) && STORY_KEY === 'motd-story');
  const back = loadStory(st);
  assert.equal(back.flags.outbreakPlan, 'lure');
  assert.equal(back.relationships.mallGoth, 2);
  assert.equal(back.choices.length, 1);
  for (const junk of ['{nope', 'null', '[]', '"x"', '{"relationships":{"biker":"lots","mallCop":99},"flags":{"rayFate":"dragon","outbreakPlan":{"a":1}},"choices":[{"id":"nope"},5,{"id":"outbreak","pick":"cop"}]}']) {
    const bad = memory();
    bad.setItem(STORY_KEY, junk);
    const s2 = loadStory(bad);
    assert.equal(s2.relationships.biker, 0);
    assert.ok(s2.relationships.mallCop <= 5);
    assert.equal(s2.flags.rayFate, null);
    assert.equal(s2.flags.outbreakPlan, null);
  }
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadStory(broken), newStory());
  writeStory(newStory(), broken); // no throw
});

test('Scene 1: each outbreak plan sets the flag, trust and toasts', () => {
  const lock = newStory();
  const r = applyChoice(lock, 'outbreak', 'cop');
  assert.equal(lock.flags.outbreakPlan, 'lockdown');
  assert.equal(lock.relationships.mallCop, 2);
  assert.deepEqual(r.toasts, ['Mall Cop respects your call.', 'The Food Court shutters locked down.']);
  assert.deepEqual(r.effects, ['plan:lockdown']);
  const lure = newStory(); applyChoice(lure, 'outbreak', 'goth');
  assert.equal(lure.flags.outbreakPlan, 'lure');
  assert.equal(lure.relationships.mallGoth, 2);
  const charge = newStory(); const rc = applyChoice(charge, 'outbreak', 'biker');
  assert.equal(charge.flags.outbreakPlan, 'charge');
  assert.equal(charge.relationships.biker, 2);
  assert.deepEqual(rc.toasts, ['Biker will remember that.']);
});

test('silence, "..." and a timeout are the same choice by the same path', () => {
  for (const id of Object.keys(CHOICES)) {
    const runs = ['silence', '...', 'timeout', null, undefined, ''].map((pick) => { const s = newStory(); const r = applyChoice(s, id, pick, 1); return { s, r }; });
    for (const x of runs) {
      assert.deepEqual(x.s, runs[0].s);
      assert.deepEqual(x.r, runs[0].r);
      assert.equal(x.r.silence, true);
    }
    assert.equal(resolveOption(id, 'timeout'), CHOICES[id].silence);
  }
  assert.ok(isSilence('...') && isSilence('timeout') && !isSilence('cop'));
  // unknown picks fall back to silence rather than doing nothing
  const s = newStory();
  assert.equal(applyChoice(s, 'outbreak', 'hax').silence, true);
  assert.equal(applyChoice(s, 'nope', 'cop'), null);
});

test('silence costs something: no bonus, a messy wave, and trust dips', () => {
  const s = newStory();
  applyChoice(s, 'outbreak', 'silence');
  assert.equal(s.flags.outbreakPlan, 'silence');
  assert.equal(s.flags.silenceCount, 1);
  assert.ok(s.relationships.biker < 0 && s.relationships.mallCop < 0);
  const m = foodCourtModifiers(s);
  assert.equal(m.bonus, null);
  assert.ok(m.wave && m.wave.walker > 0);
  const decisive = foodCourtModifiers((() => { const t = newStory(); applyChoice(t, 'outbreak', 'cop'); return t; })());
  assert.ok(decisive.enemyKeep < m.enemyKeep, 'a decisive plan beats hesitation');
});

test('foodCourtModifiers: lockdown thins and rewards, the lure thins, the charge pays and punishes', () => {
  const mk = (pick) => { const s = newStory(); applyChoice(s, 'outbreak', pick); return foodCourtModifiers(s); };
  const lock = mk('cop'), lure = mk('goth'), charge = mk('biker');
  assert.equal(lock.bonus, 'lockdown'); assert.ok(lock.enemyKeep < 1 && lock.spawnRate < 1); assert.equal(lock.lockShutter, true);
  assert.ok(lure.enemyKeep < lock.enemyKeep && lure.spawnRate < 1 && lure.pa);
  assert.equal(charge.bonus, 'charge'); assert.ok(charge.spawnRate > 1 && charge.wave.walker >= 5);
  assert.equal(foodCourtModifiers(newStory()).plan, 'none');
});

test('Scene 2: save Ray, loot the locker, hold the shutter, or freeze', () => {
  const save = newStory(); const a = applyChoice(save, 'rayLocker', 'save');
  assert.equal(save.flags.rayFate, 'saved'); assert.equal(save.flags.rayAlive, true); assert.equal(save.flags.lockerLooted, false);
  assert.equal(save.relationships.mallGoth, 2); assert.equal(save.relationships.skater, 2);
  assert.deepEqual(a.toasts, ['Mall Goth will remember that.']);
  const loot = newStory(); const b = applyChoice(loot, 'rayLocker', 'loot');
  assert.equal(loot.flags.rayFate, 'overrun'); assert.equal(loot.flags.rayAlive, false); assert.equal(loot.flags.lockerLooted, true);
  assert.ok(loot.relationships.mallCop < 0 && loot.relationships.mallGoth < 0);
  assert.deepEqual(b.toasts, ['Mall Cop will remember that.']);
  const hold = newStory(); applyChoice(hold, 'rayLocker', 'hold');
  assert.equal(hold.flags.rayFate, 'injured'); assert.equal(hold.flags.shutterHeld, true); assert.equal(hold.flags.rayAlive, true);
  const freeze = newStory(); applyChoice(freeze, 'rayLocker', 'timeout');
  assert.equal(freeze.flags.rayFate, 'lost'); assert.equal(freeze.flags.rayAlive, false); assert.equal(freeze.flags.lockerScrap, true);
  assert.ok(freeze.relationships.mallGoth < 0 && freeze.relationships.skater < 0);
});

test('crisisModifiers: the third and fourth outcomes are risky, not soft wins', () => {
  const mk = (pick) => { const s = newStory(); applyChoice(s, 'rayLocker', pick); return crisisModifiers(s); };
  const save = mk('save'), loot = mk('loot'), hold = mk('hold'), freeze = mk('silence');
  assert.equal(save.rayAlly, true); assert.equal(save.heavy, 0); assert.equal(save.ambush, null); assert.equal(save.sealLocker, true);
  assert.ok(loot.heavy > hold.heavy && hold.heavy > freeze.heavy && freeze.heavy > 0); assert.equal(loot.cache, 'cache'); assert.equal(loot.rayAlly, false);
  assert.ok(hold.ambush.sprinter >= 6 && hold.rayAlly === true);
  assert.ok(freeze.ambush.sprinter >= hold.ambush.sprinter && freeze.rayAlly === false);
  assert.equal(crisisModifiers(newStory()).ray, null);
});

test('bossModifiers and Ray in the hub follow the earlier choices', () => {
  const s = newStory();
  assert.equal(bossModifiers(s).tone, 'bleak'); assert.equal(hubRayPresent(s), false); assert.equal(hubRayLabel(s), '');
  applyChoice(s, 'rayLocker', 'save');
  assert.equal(bossModifiers(s).rayHeals, true); assert.equal(bossModifiers(s).tone, 'hopeful'); assert.equal(hubRayPresent(s), true);
  const l = newStory(); applyChoice(l, 'rayLocker', 'loot');
  assert.equal(bossModifiers(l).rayHeals, false); assert.ok(bossModifiers(l).dmgMul > 1.2); assert.equal(bossModifiers(l).tone, 'guilt');
  assert.equal(hubRayPresent(l), false); assert.match(hubRayLabel(l), /RAY/);
  const h = newStory(); applyChoice(h, 'rayLocker', 'hold');
  assert.equal(bossModifiers(h).rayHeals, false); assert.equal(hubRayPresent(h), true); assert.equal(bossModifiers(h).tone, 'strained');
});

test('answering again replaces the old decision, and resetWing1 forgets all of it', () => {
  const s = newStory();
  applyChoice(s, 'outbreak', 'cop');
  applyChoice(s, 'outbreak', 'biker');
  assert.equal(s.choices.length, 1);
  assert.equal(s.relationships.mallCop, -1); // the cop's +2 was undone, then biker's -1 applied
  assert.equal(s.relationships.biker, 2);
  applyChoice(s, 'rayLocker', 'silence');
  assert.equal(s.flags.silenceCount, 1);
  resetWing1(s);
  assert.deepEqual(s, newStory());
});

test('trust stays within -5..+5', () => {
  const s = newStory();
  for (let i = 0; i < 10; i++) { s.relationships.mallGoth = Math.min(5, s.relationships.mallGoth + 2); }
  applyChoice(s, 'outbreak', 'goth');
  assert.equal(s.relationships.mallGoth, 5);
});

test('the story rides along on the campaign save and survives a reload', () => {
  const st = memory();
  const save = newSave();
  applyChoice(save.story, 'outbreak', 'cop');
  applyChoice(save.story, 'rayLocker', 'hold');
  writeSave(save, st);
  const back = loadSave(st);
  assert.equal(back.story.flags.outbreakPlan, 'lockdown');
  assert.equal(back.story.flags.rayFate, 'injured');
  assert.equal(back.story.choices.length, 2);
  // corrupt story inside a fine save: the rest of the save is kept
  st.setItem('motd-save', JSON.stringify({ progress: { completed: { 1: true } }, heroes: {}, story: { relationships: 'x', choices: 4 } }));
  const odd = loadSave(st);
  assert.equal(odd.progress.completed[1], true);
  assert.deepEqual(odd.story, newStory());
});

test('the recap lists each decision, who remembers, Ray, and the hook for Wing 2', () => {
  const s = newStory();
  applyChoice(s, 'outbreak', 'cop');
  applyChoice(s, 'rayLocker', 'save');
  const r = recap(s);
  assert.equal(r.rows.length, 2);
  assert.match(r.rayFate, /Ray is alive/);
  assert.ok(r.rows[0].notes.some((n) => /Mall Cop respects/.test(n)));
  assert.match(r.hook, /Arcade, Bowling & Batting Cages/);
  assert.ok(remembers(s).length > 0);
  assert.ok(r.standings.every((x) => /: [+-]?\d+/.test(x)));
});

test('skipped cutscenes use documented defaults: Mall Cop lockdown, save Ray', () => {
  assert.deepEqual(DEFAULT_PICKS, { outbreak: 'cop', rayLocker: 'save' });
  const s = newStory();
  for (const [id, pick] of Object.entries(DEFAULT_PICKS)) applyChoice(s, id, pick);
  assert.equal(s.flags.outbreakPlan, 'lockdown'); assert.equal(s.flags.rayFate, 'saved');
});
