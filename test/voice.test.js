// Story voices: the script covers every line the game speaks, a scene waits for a recording, and online guests get it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = globalThis.window || globalThis;
const { Cutscene, SCENES } = await import('../src/cutscenes.js');
const { newStory } = await import('../src/story.js');
const { cleanEvents } = await import('../src/netstate.js');
const json = (f) => JSON.parse(readFileSync(new URL(`../assets/voice/${f}`, import.meta.url)));
const { lines } = json('lines.json');
const texts = new Set(lines.map((l) => l.text));

test('one id and one clip per line, and no two ids for the same words', () => {
  const { ids } = json('index.json');
  assert.equal(new Set(lines.map((l) => l.id)).size, lines.length);
  assert.equal(texts.size, lines.length);
  assert.deepEqual(Object.keys(ids).sort(), lines.map((l) => l.id).sort());
  for (const l of lines) assert.equal(ids[l.id], `${l.id}.mp3`);
});

test('every cutscene line, in every branch, is in the voice script', () => {
  const check = (beats) => { for (const b of beats) if (b.t === 'line') assert.ok(texts.has(b.text), b.text); };
  for (const fate of ['saved', 'injured', 'overrun', 'lost']) {
    for (const make of Object.values(SCENES)) {
      const beats = make({ ...newStory(), flags: { ...newStory().flags, rayFate: fate } });
      check(beats);
      for (const b of beats) if (b.then) for (const pick of ['cop', 'goth', 'biker', 'save', 'loot', 'hold', 'silence']) check(b.then({ option: { pick } }));
    }
  }
});

test('a line stays up until its recording ends, and moves on without one', () => {
  const run = (clip) => {
    let left = 0;
    const said = [];
    const c = new Cutscene('ticket', { story: newStory(), hooks: { line: (t) => { said.push(t); left = clip; }, voiceLeft: () => left, done() {} } });
    let t = 0;
    while (c.i === 0 && t < 60) { c.update(0.05); left = Math.max(0, left - 0.05); t += 0.05; }
    assert.ok(said.length >= 1);
    return t;
  };
  const silent = run(0);
  assert.ok(run(9) >= 9, 'waits for the clip');
  assert.ok(silent < 9);
  assert.ok(run(1e6) < silent + 15, 'a stuck clip cannot hold the scene for ever');
});

test('a guest accepts a story line event', () => {
  assert.deepEqual(cleanEvents([['l', ''], ['l', lines[0].text]]), [['l', ''], ['l', lines[0].text]]);
});
