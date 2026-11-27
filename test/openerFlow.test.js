// When the opener plays: not on a load, after hero select on a story run (then into the game), and from WATCH INTRO
// (then back to the title). The rules are checked directly; the whole flow runs the real game in headless Chrome, and
// is skipped where there is no Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { completingSlot, partyReady } from '../src/storyStart.js';
import { attackKeys } from '../src/input.js';
import { VIEW_W, VIEW_H } from '../src/config.js';

const slot = (ready, source = 'kb') => ({ source, cls: 'biker', ready });

test('the party is ready when everyone who joined is', () => {
  assert.ok(!partyReady([]));
  assert.ok(!partyReady([slot(true), slot(false, 'pad0')]));
  assert.ok(partyReady([slot(true), undefined, slot(true, 'pad0')]));
});

test('only the press that readies the last hero completes the party', () => {
  const enter = (s) => attackKeys(s.source).includes('Enter');
  assert.equal(completingSlot([slot(false)], enter), 0);
  assert.equal(completingSlot([slot(true, 'pad0'), null, slot(false, 'kb2')], enter), 2);
  assert.equal(completingSlot([slot(false, 'kb1'), slot(true, 'kb2')], enter), -1, "Enter is not the WASD player's Attack");
  assert.equal(completingSlot([slot(false), slot(false, 'pad0')], enter), -1, 'someone else is still choosing');
  assert.equal(completingSlot([slot(true)], enter), -1, 'already ready');
  assert.equal(completingSlot([slot(false, 'net1')], enter), -1);
  assert.deepEqual(attackKeys('pad0'), []);
  assert.ok(['Space', 'KeyF', 'Enter'].every((k) => attackKeys('kb').includes(k)));
});

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const chromium = existsSync(CHROME) ? await import('playwright-core').then((m) => m.chromium, () => null) : null;

test('in the browser: boot -> title; a story run -> movie -> game; WATCH INTRO -> movie -> title', { skip: !chromium && 'needs Chrome and playwright-core', timeout: 400000 }, async () => {
  const { server } = await import('../server.js');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    // humanPlayer: hide navigator.webdriver, to boot as a first-time player's browser does
    const open = async (save, { humanPlayer = false, noMovieFile = false, context = { viewport: { width: 960, height: 540 } } } = {}) => {
      const ctx = await browser.newContext({ ...context, serviceWorkers: 'block' });
      if (noMovieFile) await ctx.route('**/*.mp4', (r) => r.fulfill({ status: 404, body: '' }));
      await ctx.addInitScript(([s, human]) => {
        window.__traceStates = true;
        localStorage.setItem('motd-quality', 'low');
        if (s) localStorage.setItem('motd-save', JSON.stringify(s));
        if (human) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
      }, [save, humanPlayer]);
      const page = await ctx.newPage();
      const states = [];
      page.on('console', (m) => { const t = /^state \S+ -> (\S+)$/.exec(m.text()); if (t) states.push(t[1]); });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const reach = (state) => page.waitForFunction((s) => window.__motd && window.__motd.state === s, state, { timeout: 90000 });
      await reach('title');
      return { ctx, page, states, reach };
    };
    const noMovie = (page) => page.evaluate(() => !document.querySelector('#movie') && !window.__motd.movie.active);
    const rolling = (page) => page.waitForFunction(() => { const v = document.querySelector('#movie #movie-video'); return v && !v.paused && v.currentTime > 0.5; }, null, { timeout: 90000 });
    const toSelect = async ({ page, reach }) => { await page.waitForTimeout(600); await page.keyboard.press('Enter'); await reach('select'); await page.waitForTimeout(600); };
    const veteran = { progress: { completed: {}, seenIntro: true, seenRealm: {} }, heroes: {} };

    // a first launch lands on the title and stays there; the story text still comes before hero select
    const first = await open(null, { humanPlayer: true });
    await first.page.waitForTimeout(1500);
    assert.ok(await noMovie(first.page));
    assert.deepEqual(first.states, ['title']);
    await first.page.keyboard.press('Enter');
    await first.reach('story');
    await first.page.waitForTimeout(600);
    await first.page.keyboard.press('Escape');
    await first.reach('select');
    assert.ok(await noMovie(first.page));
    await first.ctx.close();

    // a story run: the movie after select, and a skip cuts into the hub
    const run = await open(veteran);
    await toSelect(run);
    assert.ok(await noMovie(run.page));
    // (this listener runs after the game's in the same event: the movie must already be on its way, as iOS requires)
    await run.page.evaluate(() => window.addEventListener('keydown', () => { window.__inPress ??= [window.__motd.state, window.__motd.movie.active && !window.__motd.movie.waiting]; }));
    await run.page.keyboard.press('Enter');
    assert.deepEqual(await run.page.evaluate(() => window.__inPress), ['intro', true]);
    await rolling(run.page);
    assert.deepEqual(await run.page.evaluate(() => [window.__motd.state, window.__motd.introThen, window.__motd.music, document.querySelector('#movie-video').muted]), ['intro', 'game', null, false]);
    await run.page.keyboard.press('Space');
    await run.reach('play');
    assert.ok(await noMovie(run.page));
    assert.ok(await run.page.evaluate(() => window.__motd.game.level.hub));
    assert.deepEqual(run.states, ['title', 'select', 'intro', 'play']);
    await run.ctx.close();

    // left to end, on a brand new player's save (no Training, nothing owed): it cuts into the hub
    const end = await open({ ...veteran, progress: { completed: {}, seenIntro: true, seenRealm: {} } });
    await toSelect(end);
    await end.page.keyboard.press('Enter');
    await rolling(end.page);
    await end.page.evaluate(() => { const v = document.querySelector('#movie-video'); v.currentTime = v.duration - 0.2; });
    await end.reach('play');
    assert.ok(await end.page.evaluate(() => window.__motd.game.level.hub));
    assert.deepEqual(end.states, ['title', 'select', 'intro', 'play']);
    await end.ctx.close();

    // touch: letting go of the tap that readies the last hero starts the movie
    const touch = await open(veteran, { context: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } });
    const tap = async (x, y) => { // game coordinates -> the page
      const r = await touch.page.evaluate(() => { const b = document.querySelector('#stage').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      await touch.page.touchscreen.tap(r[0] + x * r[2] / VIEW_W, r[1] + y * r[3] / VIEW_H);
    };
    await toSelect(touch);
    await touch.page.evaluate(() => window.addEventListener('pointerup', () => { window.__inPress ??= [window.__motd.state, window.__motd.movie.active && !window.__motd.movie.waiting]; }));
    const card = await touch.page.evaluate(async () => {
      const { selectCardAt, selectArrowAt } = await import('/src/hud.js');
      for (let y = 530; y > 0; y -= 10) for (let x = 0; x < 960; x += 10) if (selectCardAt(x, y) === 0 && selectCardAt(x + 60, y) === 0 && selectCardAt(x - 60, y) === 0 && !selectArrowAt(x, y)) return [x, y - 5];
      return null;
    });
    await tap(...card);
    await touch.reach('intro');
    assert.deepEqual(await touch.page.evaluate(() => window.__inPress), ['intro', true]);
    await rolling(touch.page);
    assert.equal(await touch.page.evaluate(() => window.__motd.slots[0].ready), true);
    await tap(480, 100); // and a tap skips it
    await touch.reach('play');
    assert.deepEqual(touch.states, ['title', 'select', 'intro', 'play']);
    await touch.ctx.close();

    // a movie that can't load: the in-engine opener, which leads to the same place
    const broken = await open(veteran, { noMovieFile: true });
    await toSelect(broken);
    await broken.page.keyboard.press('Enter');
    await broken.page.waitForFunction(() => window.__motd.intro && window.__motd.intro.active, null, { timeout: 90000 });
    assert.ok(await noMovie(broken.page));
    assert.equal(await broken.page.evaluate(() => window.__motd.introThen), 'game');
    for (let i = 0; i < 20 && await broken.page.evaluate(() => window.__motd.state) === 'intro'; i++) { await broken.page.waitForTimeout(700); await broken.page.keyboard.press('Space'); }
    await broken.reach('play');
    assert.ok(!broken.states.slice(1).includes('title'), broken.states.join(' '));
    await broken.ctx.close();

    // there is no Training: T is just another key on the title, and the run still plays the movie
    const noTraining = await open(veteran);
    assert.equal(await noTraining.page.evaluate(async () => {
      const { titleButtonAt } = await import('/src/hud.js');
      const ids = new Set();
      for (let y = 0; y < 640; y += 5) ids.add(titleButtonAt(480, y));
      return [...ids].filter(Boolean).sort().join(' ');
    }), 'controls coop intro solo');
    await noTraining.page.waitForTimeout(600);
    await noTraining.page.keyboard.press('KeyT');
    await noTraining.reach('select');
    await noTraining.page.waitForTimeout(600);
    await noTraining.page.keyboard.press('Enter');
    await noTraining.reach('intro');
    assert.equal(await noTraining.page.evaluate(() => window.__motd.introThen), 'game');
    await noTraining.ctx.close();

    // WATCH INTRO is a rewatch: back to the title
    const watch = await open(veteran);
    await watch.page.waitForTimeout(600);
    await watch.page.keyboard.press('KeyI');
    await rolling(watch.page);
    assert.equal(await watch.page.evaluate(() => window.__motd.introThen), 'title');
    await watch.page.keyboard.press('Space');
    await watch.reach('title');
    await watch.page.waitForTimeout(600);
    assert.deepEqual(watch.states, ['title', 'intro', 'title']);
    await watch.ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
});
