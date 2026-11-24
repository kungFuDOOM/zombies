import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, hidden: false };

const lb = await import('../src/leaderboard.js');
const { Stats } = await import('../src/stats.js');
beforeEach(() => store.clear());

test('cleanName accepts normal names and trims', () => {
  assert.deepEqual(lb.cleanName('  Harambe 22 '), { ok: true, name: 'Harambe 22' });
  assert.equal(lb.cleanName('a_b-c.d').ok, true);
});
test('cleanName enforces 3-12 chars and charset', () => {
  for (const n of ['ab', '', 'x'.repeat(13), 'né♥me', '<b>hi</b>']) assert.equal(lb.cleanName(n).ok, false, n);
});
test('cleanName blocks profanity (incl. leetspeak) and personal info, not innocent words', () => {
  for (const n of ['f u c k', 'SH1T', 'b1tch', 'n4zi', '5551234567', 'joe.com']) assert.equal(lb.cleanName(n).ok, false, n);
  for (const n of ['Classic', 'Assassin', 'Biker', 'Skater']) assert.equal(lb.cleanName(n).ok, true, n);
});
test('cleanRows keeps well-formed rows only and clamps values', () => {
  const rows = lb.cleanRows([
    { id: 1, name: 'AAA', score: 500, cls: 'biker', level: 3, won: false, created_at: '2026-10-18T00:00:00Z' },
    { id: 2, name: 'BBB', score: 9e99, cls: 'x'.repeat(40), level: 99, won: 'yes', created_at: 'nope' },
    { id: 3, name: 7, score: 1 }, null, 'x', { name: 'CCC', score: 'a' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].score, 1e7); assert.equal(rows[1].level, 16); assert.equal(rows[1].won, false); assert.equal(rows[1].cls.length, 16);
  assert.deepEqual(lb.cleanRows('junk'), []);
});
test('the board is localStorage only: submitting never touches the network', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('network must not be used'); };
  const r = await lb.submitScore({ name: 'Tester', score: 1234.6, cls: 'biker', level: 1, won: false });
  assert.deepEqual(r, { id: 1, rank: 1 });
  const r2 = await lb.submitScore({ name: 'Second', score: 5000, cls: 'skater', level: 2, won: true });
  assert.deepEqual(r2, { id: 2, rank: 1 });
  const top = await lb.fetchTop(10);
  assert.deepEqual(top.map((x) => [x.name, x.score]), [['Second', 5000], ['Tester', 1235]]);
  assert.deepEqual(lb.getMine(), [1, 2]);
  assert.equal(calls, 0);
  assert.ok(store.has('motd-lb-board'));
});
test('no source file mentions a remote leaderboard host or RPC', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /supabase|\/rest\/v1|submit_[a-z]+_score|LB_URL|LB_KEY/, f);
  }
});
test('corrupt board storage is ignored', async () => {
  store.set('motd-lb-board', '{nope');
  assert.deepEqual(await lb.fetchTop(), []);
  store.set('motd-lb-board', JSON.stringify([{ name: 5 }, null, { name: 'OK', score: 3 }]));
  assert.equal((await lb.fetchTop()).length, 1);
});
test('only this device\'s own heroes are offered, best run first', () => {
  const s = new Stats();
  const mine = { slot: 0, cls: 'biker', score: 400, lvl: 1, kills: 0, gold: 0, alive: true };
  const mine2 = { slot: 1, cls: 'mallCop', score: 900, lvl: 1, kills: 0, gold: 0, alive: true };
  const other = { slot: 2, cls: 'skater', score: 99999, lvl: 1, kills: 0, gold: 0, alive: true };
  for (const p of [mine, mine2, other]) s.startRun(p, 'online', 3);
  assert.equal(s.globalCandidate([mine, mine2]).cls, 'mallCop');
  assert.equal(s.globalCandidate([mine]).score, 400);
  assert.equal(s.globalCandidate([]), null);
  const zero = { slot: 3, cls: 'mallGoth', score: 0, lvl: 1, kills: 0, gold: 0, alive: true };
  s.startRun(zero, 'solo', 1);
  assert.equal(s.globalCandidate([zero]), null);
});
