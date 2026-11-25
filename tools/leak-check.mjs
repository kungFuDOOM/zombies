// GPU leak check: rebuild levels repeatedly and report renderer.info.memory (geometries / textures) and program count.
// Usage: node tools/leak-check.mjs [--rebuilds 8] [--quality low|high]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const N = +arg('rebuilds', 8), quality = arg('quality', 'high'), perf = arg('perf', '');
const port = 8700 + Math.floor(Math.random() * 200);
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(([q, p]) => { localStorage.setItem('motd-intro-seen', '1'); localStorage.setItem('motd-quality', q); if (p) localStorage.setItem('motd-perf', p); }, [quality, perf]);
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
try {
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.__motd && window.__motd.state && window.__motd.state !== 'loading', null, { timeout: 90000 });
for (let i = 0; i < 6 && (await page.evaluate(() => window.__motd.state)) !== 'play'; i++) {
  const st = await page.evaluate(() => window.__motd.state);
  if (st === 'story') await page.keyboard.press('Escape');
  else if (st === 'select') { await page.keyboard.press('Enter'); await new Promise((r) => setTimeout(r, 300)); await page.keyboard.press('Enter'); await new Promise((r) => setTimeout(r, 4500)); }
  else await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 800));
}
await page.waitForFunction(() => window.__motd.state === 'play' && window.__motd.game, null, { timeout: 20000 });
const mem = () => page.evaluate(() => { const i = window.__motd.r3d.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs.length }; });
const rows = [];
const levels = [0, 1, 2, 3];
for (let i = 0; i <= N; i++) {
  await page.evaluate((n) => { window.__motd.game.startLevel(n); }, levels[i % levels.length]);
  await new Promise((r) => setTimeout(r, 2500));
  rows.push({ rebuild: i, level: levels[i % levels.length], ...(await mem()) });
  console.log(JSON.stringify(rows.at(-1)));
}
console.log('errors', errors.length, errors.slice(0, 3));

} finally { await browser.close(); srv.kill(); }
