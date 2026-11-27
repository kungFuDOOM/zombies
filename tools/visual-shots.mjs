// Visual regression screenshots. Usage:
//   node tools/visual-shots.mjs --prefix before [--url https://site/zombies/] [--only horde,select]
// Output: /workspace/motd-shots/<prefix>-<name>.png and <prefix>-report.json
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const prefix = arg('prefix', 'shots');
const quality = arg('quality', '');
const perf = arg('perf', '');
const only = arg('only', '') ? arg('only').split(',') : null;
const OUT = '/workspace/motd-shots';
mkdirSync(OUT, { recursive: true });

let url = arg('url', '');
let srv = null;
if (!url) {
  const port = 8700 + Math.floor(Math.random() * 200);
  srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  url = `http://127.0.0.1:${port}/`;
  await new Promise((r) => setTimeout(r, 1200));
}
const ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ARGS });
const report = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(() => { try { localStorage.setItem('motd-intro-seen', '1'); } catch {} });
  if (quality) await ctx.addInitScript((q) => { try { localStorage.setItem('motd-quality', q); } catch {} }, quality);
  if (perf) await ctx.addInitScript((q) => { try { localStorage.setItem('motd-perf', q); } catch {} }, perf);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__motd && window.__motd.state && window.__motd.state !== 'loading', null, { timeout: 90000 });
  return { ctx, page, errors };
}
// FPS: 2 s warm-up, then the median of 3 windows of ~5 s each (headless SwiftShader is noisy).
async function fpsWindow(page, ms) {
  return page.evaluate((ms) => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = (t) => { n++; if (t - t0 < ms) requestAnimationFrame(f); else res(+(n / ((t - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }), ms);
}
async function fps(page) {
  await sleep(2000);
  const w = [];
  for (let i = 0; i < 3; i++) w.push(await fpsWindow(page, 5000));
  return { fps: [...w].sort((a, b) => a - b)[1], windows: w };
}
// draw calls per frame (averaged over 20 frames; autoReset off so the post pass doesn't hide the scene's calls) + active quality
async function gfxInfo(page) {
  return page.evaluate(() => new Promise((res) => {
    const r3 = window.__motd.r3d; const info = r3.renderer.info; const ar = info.autoReset; info.autoReset = false; info.reset();
    let n = 0; const f = () => { if (++n < 20) requestAnimationFrame(f); else { const o = { quality: r3.quality, drawCalls: Math.round(info.render.calls / 20), triangles: Math.round(info.render.triangles / 20), geometries: info.memory.geometries }; info.autoReset = ar; res(o); } };
    requestAnimationFrame(f);
  }));
}
async function record(name, page, errors, extra = {}) {
  const f = await fps(page);
  const gi = await gfxInfo(page);
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.png` });
  report[name] = { fps: f.fps, fpsWindows: f.windows, ...gi, consoleErrors: errors.length, errors: errors.slice(0, 3), ...extra };
  console.log(name, report[name].fps, 'fps', `[${gi.quality}]`, gi.drawCalls, 'calls', errors.length, 'errors');
}
// title -> select -> ready -> the hub (a real game with a player)
async function intoPlay(page, mobile) {
  const key = (k) => page.keyboard.press(k);
  if (mobile) {
    await page.evaluate(() => document.body.classList.add('rotate-ok'));
  }
  await page.evaluate(() => window.__motd.state === 'title' || 0);
  for (let i = 0; i < 6 && (await page.evaluate(() => window.__motd.state)) !== 'play'; i++) {
    const st = await page.evaluate(() => window.__motd.state);
    if (st === 'title') { if (mobile) await page.touchscreen.tap(page.viewportSize().width / 2, page.viewportSize().height * 0.7); await key('Enter'); }
    else if (st === 'story') await key('Escape');
    else if (st === 'select') { await key('Enter'); await sleep(300); await key('Enter'); await sleep(4500); }
    else await key('Enter');
    await sleep(800);
  }
  await page.waitForFunction(() => window.__motd.state === 'play' && window.__motd.game, null, { timeout: 20000 });
}
const SETUP = `
  const g = window.__motd.game; const p = g.players.find(Boolean);
  const types = ['walker','sprinter','brute','spitter'];
  g.enemies.length = 0;
  const offs = [[-90,-60],[90,-70],[-40,70],[100,60],[0,-110],[-130,10],[140,0],[40,-40]];
  offs.forEach((o,i) => { const e = g.spawnEnemy(types[i%4], p.x+o[0], p.y+o[1]); e.cd = 99; e.speed = 0; });
  p.invuln = 1e9; p.hp = 1e9;
`;
const want = (n) => !only || only.includes(n);

if (want('horde') || want('select') || want('zombies-lineup') || want('butcher')) {
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  if (want('select')) {
    await page.keyboard.press('Enter'); await sleep(800);
    for (let i = 0; i < 4 && (await page.evaluate(() => window.__motd.state)) !== 'select'; i++) { await page.keyboard.press('Escape'); await sleep(800); }
    // add all four survivors to the select screen
    await page.evaluate(() => { const s = window.__motd.slots; const cls = ['biker', 'mallCop', 'skater', 'mallGoth']; cls.forEach((c, i) => { s[i] = { source: i ? 'pad' + i : (s[0] && s[0].source) || 'kb', cls: c, ready: false }; }); });
    await sleep(1500);
    for (let i = 0; i < +arg('burst', 0); i++) { await page.screenshot({ path: `${OUT}/${prefix}-select-b${i}.png`, clip: { x: 100, y: 120, width: 270, height: 320 } }); await sleep(1100); }
    await record('select', page, errors, { state: await page.evaluate(() => window.__motd.state) });
    await page.evaluate(() => { const s = window.__motd.slots; s.length = 1; });
  }
  await ctx.close();
}
if (want('horde') || want('butcher') || want('butcher-front')) {
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await intoPlay(page, false);
  if (want('horde')) {
    await page.evaluate(SETUP); await sleep(1500);
    await record('horde', page, errors);
  }
  if (want('butcher')) {
    await page.evaluate(`(async()=>{ const g = window.__motd.game; g.startLevel(2); })()`);
    await sleep(1500);
    const info = await page.evaluate(() => { const g = window.__motd.game; const p = g.players.find(Boolean); if (g.boss) { p.x = g.boss.x - 170; p.y = g.boss.y; p.invuln = 1e9; p.hp = 1e9; g.boss.cd = 99; g.boss.cd2 = 99; g.boss.cd3 = 99; } return { boss: !!g.boss, state: window.__motd.state }; });
    await sleep(2500);
    await record('butcher', page, errors, info);
  }
  if (want('butcher-front')) {
    // the Butcher turns to face the nearest player, so put the player BELOW him on screen (camera looks from +y) and his pig face points at us
    await page.evaluate(`(async()=>{ const g = window.__motd.game; g.startLevel(2); })()`);
    await sleep(1500);
    const info = await page.evaluate(() => { const g = window.__motd.game; const p = g.players.find(Boolean); if (g.boss) { p.x = g.boss.x; p.y = g.boss.y + 150; p.invuln = 1e9; p.hp = 1e9; g.boss.cd = 99; g.boss.cd2 = 99; g.boss.cd3 = 99; } return { boss: !!g.boss, state: window.__motd.state }; });
    await sleep(3000);
    await record('butcher-front', page, errors, info);
  }
  await ctx.close();
}
if (want('zombies-lineup')) {
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await page.evaluate(() => window.__motd.lineup('zombies')); await sleep(2000);
  await record('zombies-lineup', page, errors);
  await ctx.close();
}
for (const [name, vp] of [['phone-portrait', { width: 390, height: 844 }], ['phone-landscape', { width: 844, height: 390 }]]) {
  if (!want(name)) continue;
  const { ctx, page, errors } = await open({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await intoPlay(page, true);
  await page.evaluate(SETUP); await sleep(1500);
  if (arg('tris', '')) console.log(JSON.stringify(await page.evaluate(() => { const o = {}; window.__motd.r3d.scene.traverse((m) => { if (m.isMesh && m.visible) { const k = (m.isSkinnedMesh ? 'skin' : m.geometry.index ? 'idx' : 'raw') ; const n = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; o[k] = (o[k] || 0) + n; if (m.isSkinnedMesh) o.skinVerts = (o.skinVerts || 0) + m.geometry.attributes.position.count; } }); return o; })));
  await record(name, page, errors);
  await ctx.close();
}
// area banner vs player panels: re-enter the Food Court and grab the banner while it is up
for (const [vp, mobile] of [[{ width: 1280, height: 720 }, false], [{ width: 844, height: 390 }, true], [{ width: 390, height: 844 }, true]]) {
  if (!want('banner')) continue;
  const { ctx, page, errors } = await open(mobile ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: vp });
  await intoPlay(page, mobile);
  await page.evaluate(() => { document.body.classList.add('rotate-ok'); window.__motd.game.startLevel(1); });
  await sleep(500);
  await page.evaluate(() => { const g = window.__motd.game; if (g.banner) g.banner.t = Math.max(g.banner.t, 2); });
  await page.screenshot({ path: `${OUT}/${prefix}-banner-${vp.width}x${vp.height}.png` });
  report[`banner-${vp.width}x${vp.height}`] = { consoleErrors: errors.length, errors: errors.slice(0, 3) };
  console.log('banner', vp.width, vp.height, errors.length, 'errors');
  await ctx.close();
}
writeFileSync(`${OUT}/${prefix}-report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (srv) srv.kill();
