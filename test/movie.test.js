import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { Movie, parseCue, pictureBottom, SPEAKERS, STALL_MS } from '../src/movie.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// just enough of a page for the player: elements that remember what was done to them
function fakePage({ playable = true, play = () => Promise.resolve() } = {}) {
  const make = (tag) => {
    const on = {}, calls = [];
    const el = {
      tag, calls, style: {}, attrs: {}, children: [], paused: true, muted: false, hidden: false, parent: null,
      setAttribute(k, v) { this.attrs[k] = v; },
      removeAttribute(k) { calls.push(`remove ${k}`); delete this[k]; },
      appendChild(c) { c.parent = this; this.children.push(c); return c; },
      replaceChildren(...c) { this.children = c; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; },
      addEventListener(type, fn) { (on[type] ||= []).push(fn); },
      emit(type) { for (const fn of on[type] || []) fn(); },
    };
    if (tag === 'video') Object.assign(el, { canPlayType: () => (playable ? 'probably' : ''), play() { calls.push(`play ${this.muted ? 'muted' : 'sound'}`); return play(this); }, pause() { calls.push('pause'); }, load() { calls.push('load'); } });
    if (tag === 'track') { const t = make('texttrack'); t.mode = 'disabled'; el.track = t; }
    return el;
  };
  const doc = { createElement: make, head: make('head'), body: make('body'), addEventListener() {} };
  return { doc, win: { innerWidth: 390, innerHeight: 844, addEventListener() {} } };
}
const settle = () => new Promise((r) => setImmediate(r));

test('every caption in the VTT has text, and every speaker has a colour (Pam in amber)', () => {
  const cues = read('assets/film/opener-v1.vtt').split(/\n\n+/).filter((b) => b.includes('-->')).map((b) => parseCue(b.split('\n').slice(b.split('\n').findIndex((l) => l.includes('-->')) + 1).join('\n')));
  assert.equal(cues.length, 10);
  for (const c of cues) {
    assert.ok(c.text && !c.text.includes('<'), c.text);
    if (c.speaker && c.speaker !== 'BUTCHER') assert.ok(SPEAKERS[c.speaker], c.speaker);
    assert.equal(c.italic, !c.speaker, 'time captions are the italic ones');
  }
  assert.deepEqual(parseCue('<v MALL COP>Copy. I am very calm.'), { speaker: 'MALL COP', text: 'Copy. I am very calm.', italic: false });
  assert.deepEqual(parseCue('<i>4:59 AM. Security Room.</i>'), { speaker: '', text: '4:59 AM. Security Room.', italic: true });
  // the same colours as the in-engine opener
  const intro = read('src/intro.js');
  for (const color of Object.values(SPEAKERS)) assert.ok(intro.includes(`'${color}'`), color);
});

test('captions start in the black under the picture on phones, with room for two lines', () => {
  for (const [w, h] of [[390, 844], [844, 390], [1280, 720]]) {
    const y = pictureBottom(w, h);
    assert.ok(y > h / 2 && h - y >= 45, `${w}x${h}: ${y}`);
  }
});

test('the movie plays with sound, releases the video, and can be shown again', async () => {
  const { doc, win } = fakePage();
  const m = new Movie(doc, win);
  assert.ok(m.preload());
  const el = m.el;
  assert.equal(el.preload, 'auto');
  assert.ok('playsinline' in el.attrs && 'webkit-playsinline' in el.attrs);
  assert.equal(el.children[0].track.mode, 'hidden');
  assert.ok(m.start());
  assert.equal(m.el, el, 'the preloaded video is the one shown');
  assert.ok(m.waiting && !el.calls.length, 'nothing plays before the tap');
  m.play();
  await settle();
  assert.deepEqual(el.calls, ['play sound']);
  el.children[0].track.activeCues = [{ text: '<v SKATER>Dude.' }];
  el.children[0].track.emit('cuechange');
  const [name, body] = m.cap.children[0].children;
  assert.deepEqual([name.textContent, name.style.color, body.textContent], ['SKATER', SPEAKERS.SKATER, 'Dude.']);
  el.emit('playing'); el.emit('ended');
  assert.ok(m.ended && !m.failed);
  m.release();
  assert.deepEqual(el.calls.slice(1), ['pause', 'remove src', 'load']);
  assert.ok(!m.active && !m.el && !m.ended && !doc.body.children.length);
  assert.ok(m.start() && m.el !== el);
  m.release();
});

test('refused sound: it plays muted with a "tap for sound" button', async () => {
  const { doc, win } = fakePage({ play: (el) => (el.muted ? Promise.resolve() : Promise.reject(new Error('NotAllowedError'))) });
  const m = new Movie(doc, win);
  m.start(); m.play();
  await settle();
  assert.deepEqual(m.el.calls, ['play sound', 'play muted']);
  assert.ok(!m.sound.hidden && !m.failed);
  m.sound.emit('click');
  assert.ok(!m.el.muted && m.sound.hidden);
  m.release();
});

test('an unplayable, broken or stalled movie is reported so the in-engine opener takes over', async () => {
  const page = (o) => { const { doc, win } = fakePage(o); return new Movie(doc, win); };
  assert.equal(page({ playable: false }).start(), false);

  const refused = page({ play: () => Promise.reject(new Error('NotSupportedError')) });
  refused.start(); refused.play();
  await settle(); await settle();
  assert.ok(refused.failed);
  refused.release();

  const early = page();
  early.preload(); early.el.emit('error');
  assert.equal(early.start(), false, 'the preload already failed');
  assert.ok(early.start(), 'and the next showing tries again');
  early.el.emit('error');
  assert.ok(early.failed);
  early.release();

  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const slow = page();
    slow.start();
    mock.timers.tick(STALL_MS * 2);
    assert.ok(!slow.failed, 'the clock starts at play(), not on the tap-to-begin screen');
    slow.play();
    mock.timers.tick(STALL_MS - 1);
    assert.ok(!slow.failed);
    mock.timers.tick(1);
    assert.ok(slow.failed);
    slow.release();
    const fine = page();
    fine.start(); fine.play(); fine.el.emit('playing');
    mock.timers.tick(STALL_MS * 2);
    assert.ok(!fine.failed);
    fine.release();
  } finally { mock.timers.reset(); }
});

test('the movie streams from the network: the service worker leaves its files alone and the page policy allows them', () => {
  const sw = read('sw.js');
  const patterns = ['CODE', 'ASSET', 'IMMUTABLE'].map((n) => new RegExp(sw.match(new RegExp(`const ${n} = /(.*)/;`))[1]));
  for (const f of ['mp4', 'jpg', 'vtt']) for (const re of patterns) assert.ok(!re.test(`/zombies/assets/film/opener-v1.${f}`), `${re} matches .${f}`);
  assert.doesNotMatch(sw, /opener-v1|assets\/film/);
  assert.match(read('index.html'), /media-src 'self'/);
});

test('the dev server streams the movie, with byte ranges', async () => {
  const { server } = await import('../server.js');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const get = (path, headers = {}) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, headers }, (res) => { let n = 0; res.on('data', (d) => { n += d.length; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, n })); });
    req.on('error', reject);
    req.end();
  });
  try {
    const size = statSync(new URL('../assets/film/opener-v1.mp4', import.meta.url)).size;
    const part = await get('/assets/film/opener-v1.mp4', { Range: 'bytes=100-199' });
    assert.deepEqual([part.status, part.n, part.headers['content-range'], part.headers['content-type']], [206, 100, `bytes 100-199/${size}`, 'video/mp4']);
    const tail = await get('/assets/film/opener-v1.mp4', { Range: `bytes=${size - 10}-` });
    assert.deepEqual([tail.status, tail.n], [206, 10]);
    assert.equal((await get('/assets/film/opener-v1.vtt')).headers['content-type'], 'text/vtt; charset=utf-8');
    assert.equal((await get('/assets/film/opener-v1.jpg')).status, 200);
  } finally {
    server.close();
  }
});
