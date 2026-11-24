import { test } from 'node:test';
import assert from 'node:assert/strict';

const { TRACKS, TRACK_IDS, SCALES, DRUMS, trackFor, levelTrack, motifOf } = await import('../src/music-data.js');

test('Wing 1 and its boss have their own tracks, and the boss is a boss track', () => {
  assert.equal(levelTrack(1, false), 'level_1');
  assert.equal(levelTrack(2, true), 'boss_1');
  assert.equal(TRACKS.level_1.name, 'Food Court Muzak Massacre');
  assert.equal(TRACKS.boss_1.name, 'The Deep-Fry Butcher');
  assert.ok(TRACKS.boss_1.boss);
  assert.ok(TRACKS.boss_1.bpm > TRACKS.level_1.bpm, 'the boss theme is faster than the level music');
  assert.equal(levelTrack(3, false), 'hub', 'locked wings have no music yet');
});

test('menus, the Security Room, cutscenes, the recap and stingers each have a track', () => {
  const base = { state: 'play', inLevel: true, levelNum: 1, isBoss: false };
  const picks = {
    title: trackFor({ state: 'title' }), story: trackFor({ state: 'story' }), shop: trackFor({ state: 'shop' }), recap: trackFor({ state: 'recap' }),
    cut_opening: trackFor({ state: 'cutscene', cutscene: 'opening' }), cut_crisis: trackFor({ state: 'cutscene', cutscene: 'crisis' }), cut_boss: trackFor({ state: 'cutscene', cutscene: 'boss' }),
    hub: trackFor({ ...base, state: 'realm', hub: true }), training: trackFor({ ...base, tutorial: true }),
    clear: trackFor({ ...base, state: 'levelclear' }), bossclear: trackFor({ ...base, state: 'levelclear', isBoss: true, levelNum: 2 }), defeat: trackFor({ ...base, state: 'gameover' }),
  };
  for (const [want, got] of Object.entries(picks)) { assert.equal(got, want); assert.ok(TRACKS[got]); }
  assert.equal(trackFor({ ...base, state: 'paused' }), 'level_1', 'pausing keeps the level track');
  assert.equal(trackFor({ ...base, levelNum: 2, isBoss: true }), 'boss_1');
  assert.ok(!TRACK_IDS.some((id) => /^(boss_[2-4]|level_([2-9]|1\d)|treasure)$/.test(id)), 'no leftover realm or treasure tracks');
});

test('track ids, names and melodies are all unique, and none mention the old game', () => {
  assert.equal(new Set(TRACK_IDS).size, TRACK_IDS.length);
  for (const [id, t] of Object.entries(TRACKS)) assert.equal(t.id, id);
  assert.equal(new Set(Object.values(TRACKS).map((t) => t.name)).size, TRACK_IDS.length, 'names');
  assert.equal(new Set(Object.values(TRACKS).map((t) => motifOf(t))).size, TRACK_IDS.length, 'melodies');
  assert.equal(new Set(Object.values(TRACKS).map((t) => `${t.root}${t.mode}${t.bpm}`)).size, TRACK_IDS.length, 'key + tempo');
  assert.ok(!/Skorne|Dragon|Chimera|Mountain|Castle|Legends|Realm|Plague/i.test(Object.values(TRACKS).map((t) => t.name).join('|')));
});

test('every spec is well formed, and loops line up', () => {
  for (const t of Object.values(TRACKS)) {
    assert.ok(SCALES[t.mode], `${t.id} scale`);
    assert.ok(DRUMS[t.drums], `${t.id} drums`);
    assert.ok(t.bpm >= 55 && t.bpm <= 170);
    assert.equal(t.bass.pat.length, 16, `${t.id} bass pattern is one bar`);
    for (const d of t.prog) assert.ok(d >= 1 && d <= 7);
    const m = motifOf(t);
    assert.ok(/^[0-9a-c.\-]+$/.test(m), `${t.id} melody characters`);
    assert.equal((t.prog.length * 16) % m.length, 0, `${t.id} melody divides the loop`);
  }
});
