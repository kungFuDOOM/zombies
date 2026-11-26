import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || globalThis;
const { gameplayPose, scopeBarFrac, SCOPE_BAR_PX, mmToFov, blendPose, handoffStart, handoffEase } = await import('../src/camMath.js');
const { Cutscene, HANDOFF_SECONDS } = await import('../src/cutscenes.js');
const { Game } = await import('../src/game.js');
const { newStory, applyChoice } = await import('../src/story.js');
const { cleanEvents, cleanUi } = await import('../src/netstate.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('the gameplay camera is where it always was', () => {
  const g = gameplayPose(100, 200);
  assert.deepEqual(g.p, [440, 280, 775]);
  assert.deepEqual(g.l, [440, 42, 435]);
  assert.equal(g.fov, 42);
});

test('the letterbox is true 2.39:1 scope on the 3:2 stage', () => {
  near(scopeBarFrac(1.5), 0.1862, 1e-4);
  assert.equal(SCOPE_BAR_PX, 119);
  near(960 / (640 - 2 * SCOPE_BAR_PX), 2.39, 0.01);
  near(mmToFov(35), 24.3, 0.05);
});

test('the handoff blend starts at the film pose and ends on the gameplay pose exactly', () => {
  const G = gameplayPose(300, 120);
  for (const C of [handoffStart('rise', { x: 700, y: 450 }), handoffStart('boss', { x: 300, y: 500 }, { x: 900, y: 500 })]) {
    assert.equal(blendPose(C, G, 1), G);
    const a = blendPose(C, G, 0);
    for (let i = 0; i < 3; i++) { near(a.p[i], C.p[i], 1e-6); near(a.l[i], C.l[i], 1e-6); }
    const last = blendPose(C, G, 0.9999);
    for (let i = 0; i < 3; i++) near(last.p[i], G.p[i], 0.5);
    near(last.fov, 42, 0.01);
  }
  const C = handoffStart('rise', { x: 700, y: 450 });
  let y = -Infinity;
  for (let k = 0; k <= 1; k += 0.05) { const p = blendPose(C, G, handoffEase(k)).p[1]; assert.ok(p >= y - 1e-6, 'the camera only rises'); y = p; }
  assert.ok(handoffStart('rise', { x: 0, y: 0 }, null, () => true).p[1] > 52, 'inside a wall: ride above it');
});

function scene(id, opts = {}) {
  const story = newStory();
  const log = { prepare: 0, start: 0, done: 0 };
  const cut = new Cutscene(id, {
    story, handoff: true, ...opts,
    hooks: {
      choose: (c, p) => applyChoice(story, c, p),
      prepare: () => { log.prepare++; },
      handoffStart: () => { log.start++; },
      done: () => { log.done++; },
    },
  });
  return { cut, log };
}
// step to the handoff beat, answering any choice
function toHandoff(cut, log) {
  for (let i = 0; i < 4000 && !(cut.beat && cut.beat.handoff); i++) {
    assert.equal(log.prepare, 0, 'nothing is built before the cut into the handoff (no stall mid-line)');
    if (cut.beat.t === 'choice') cut.pick(0); else cut.update(1 / 20);
  }
  assert.ok(cut.beat.handoff);
}

test('a scene with a handoff ends on it: no film, bars sliding to nothing, then done', () => {
  const { cut, log } = scene('opening');
  toHandoff(cut, log);
  assert.equal(log.prepare, 1);
  assert.equal(log.start, 1);
  assert.equal(cut.view().film, null);
  assert.equal(cut.view().bar, SCOPE_BAR_PX);
  const g = new Game(); g.addPlayer(0, 'kb', 'biker'); g.startLevel(1);
  const first = cut.camera(g);
  assert.equal(first.handoff, 0);
  assert.ok(!first.lights && !first.fog, "the level's own lighting is left alone");
  cut.update(HANDOFF_SECONDS.opening * 0.85);
  assert.equal(cut.view().bar, 0);
  assert.equal(cut.camera(g).handoff, 1, 'the last fifth is the gameplay camera');
  assert.equal(cut.camera(g).px, first.px, 'the start pose is fixed');
  cut.update(HANDOFF_SECONDS.opening);
  assert.ok(cut.done);
  assert.equal(log.done, 1);
});

test('a press during the handoff rushes it, but never jumps', () => {
  const { cut, log } = scene('boss');
  toHandoff(cut, log);
  cut.advance();
  assert.ok(!cut.done);
  let t = 0;
  while (!cut.done) { cut.update(1 / 60); t += 1 / 60; assert.ok(t < 0.6); }
  assert.ok(t > 0.25);
});

test('skip is still instant, and the ending has no handoff but ends on the credits', () => {
  const skipped = scene('crisis', { skip: true });
  assert.ok(skipped.cut.done);
  assert.equal(skipped.log.prepare, 0);
  const end = new Cutscene('ending', { story: newStory(), hooks: {} });
  assert.ok(!end.beats.some((b) => b.handoff));
  assert.ok(end.beats.at(-1).credits);
});

test('camera hits are numbered for the film (and guests), cue arguments are passed on, and J-cuts lead the picture', () => {
  const { cut } = scene('crisis');
  assert.equal(cut.view().film.hit[0], 0);
  cut.update(0.1);
  assert.equal(cut.view().film.hit[0], 1);
  assert.equal(cut.view().film.hit[1], 12);
  cut.update(1);
  assert.ok(cut.cues.some((c) => c.sting === 'breathPanic' && c.args[0] === 2));
  // the horde of the silent crane shot is heard before the cut to it
  const i = cut.beats.findIndex((b) => b.s === 'cr.crane');
  cut.i = i - 1; cut.enter(); cut.cues.length = 0;
  while (cut.i === i - 1) cut.update(1 / 30);
  assert.equal(cut.cues.filter((c) => c.sting === 'horde').length, 1, 'fired once, ahead of its beat');
  cut.update(1);
  assert.equal(cut.cues.filter((c) => c.sting === 'horde').length, 1);
});

test('online guests get the handoff, the hit counter, the credits card and numeric sound arguments', () => {
  const { cut, log } = scene('opening');
  const wire = (v) => cleanUi('cutscene', { cut: JSON.parse(JSON.stringify(v)) }).cut;
  const a = wire(cut.view());
  assert.equal(a.bar, SCOPE_BAR_PX);
  assert.equal(a.handoff, -1);
  assert.equal(a.film.hit.length, 6);
  toHandoff(cut, log);
  cut.update(1.3);
  near(wire(cut.view()).handoff, 0.5, 0.01);
  const end = new Cutscene('ending', { story: newStory(), hooks: {} });
  end.i = end.beats.length - 1; end.enter();
  assert.equal(wire(end.view()).card.credits, true);
  assert.deepEqual(cleanEvents([['a', 'duckAll', 0.4]]), [['a', 'duckAll', 0.4]]);
  assert.deepEqual(cleanEvents([['a', 'heartbeatRamp', 1e9, 0.9, 0.5, 99]]), [['a', 'heartbeatRamp', 12, 0.9, 0.5, 3]]);
});
