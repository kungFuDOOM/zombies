// Frames of the HD story scenes, using the local-only dev jump (?cine=scene1|ticket|scene2|boss|ending&ray=...).
//   node tools/story-shots.mjs [--only boss,ending] [--sizes 1280x720,844x390,390x844] [--quality high|low] [--prefix cineB]
// Each frame freezes the scene on one beat, runs the film to a given second and saves
// /workspace/motd-shots/<prefix>-<scene>-<name>-<w>x<h>.png. Prints console errors and leftover GPU objects.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const prefix = arg('prefix', 'cineB'), quality = arg('quality', 'high');
const only = arg('only', '') ? arg('only').split(',') : null;
const match = arg('match', '');
const sizes = arg('sizes', '1280x720,844x390').split(',').map((s) => s.split('x').map(Number));
const OUT = '/workspace/motd-shots';
mkdirSync(OUT, { recursive: true });

// [name, beat, seconds into the shot, { pick: choose this option first (beat then counts from the reply), ray }]
const SCENES = {
  scene1: [['card', 0, 1.6], ['wide', 2, 4], ['biker', 3, 3.2], ['freeze', 4, 2.4], ['tv', 5, 2], ['copline', 6, 4], ['goth', 7, 2.6], ['monitor', 8, 4], ['choice', 9, 3], ['reply', 0, 3, { pick: 0 }], ['pa', 1, 3.5, { pick: 3 }], ['handoffA', 0, 0.2, { pick: 0, handoff: true }], ['handoffB', 0, 1.3, { pick: 0, handoff: true }], ['handoffC', 0, 2.05, { pick: 0, handoff: true }]],
  ticket: [['approach', 0, 4], ['spike', 1, 4], ['two', 2, 2.6], ['cop', 3, 1.6], ['chime', 4, 1.4], ['fountain', 5, 4.4], ['handoffA', 0, 0.15, { handoff: true }]],
  scene2: [['cave', 0, 3], ['locker', 1, 3.5], ['biker', 2, 1.2], ['goth', 3, 4], ['crane', 4, 3], ['choice', 5, 4], ['save', 0, 3.2, { pick: 0 }], ['loot', 0, 2.6, { pick: 1 }], ['hold', 0, 2, { pick: 2 }], ['rayout', 1, 2.5, { pick: 2 }], ['empty', 1, 3, { pick: 3 }], ['handoffA', 0, 0.2, { pick: 0, handoff: true }], ['handoffB', 0, 1.2, { pick: 0, handoff: true }]],
  boss: [['title', 0, 4.6], ['drums', 1, 5], ['cans', 2, 3], ['ots', 3, 1.7], ['turn', 5, 3.4], ['copcu', 6, 1], ['point', 6, 4.4], ['hopeful', 7, 2, { ray: 'saved' }], ['guilt', 7, 2.5, { ray: 'overrun' }], ['strained', 7, 2, { ray: 'injured' }], ['alone', 7, 3, { ray: 'lost' }], ['roar', 9, 1.8], ['handoffA', 0, 0.2, { handoff: true }], ['handoffB', 0, 1.4, { handoff: true }]],
  ending: [['kneel', 0, 6], ['gauge', 2, 5], ['card', 3, 3], ['office', 4, 3.4], ['printout', 5, 4.8], ['feed', 7, 3], ['orbit', 8, 3], ['orbit2', 9, 8], ['reflect', 11, 3.2], ['hand', 12, 1.8], ['four', 13, 2.5], ['ashby', 15, 3], ['next', 16, 3], ['credits', 17, 6.5]],
};

const port = 8700 + Math.floor(Math.random() * 200);
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/`;
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let totalErrors = 0;
try {
  for (const [w, h] of sizes) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    await ctx.addInitScript((q) => { try { localStorage.setItem('motd-intro-seen', '1'); localStorage.setItem('motd-quality', q); } catch { /* none */ } }, quality);
    for (const [scene, frames] of Object.entries(SCENES)) {
      if (only && !only.includes(scene)) continue;
      for (const [name, beat, secs, o = {}] of frames) {
        if (match && !match.split(',').includes(name)) continue;
        const page = await ctx.newPage();
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /story|shot|cue/i.test(m.text()))) errors.push(m.text().slice(0, 300)); });
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
        await page.goto(`${url}?cine=${scene}${o.ray ? `&ray=${o.ray}` : ''}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__motd && window.__motd.film, null, { timeout: 90000 });
        if (o.handoff) { // freeze a moment of the cut to gameplay
          await page.evaluate(async ({ secs, pick }) => {
            document.body.classList.add('rotate-ok');
            const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const c = window.__motd.cut, real = c.update;
            if (pick != null) { c.i = c.beats.findIndex((b) => b.t === 'choice'); c.enter(); c.pick(pick); }
            c.i = c.beats.findIndex((b) => b.handoff); c.enter();
            real.call(c, secs);
            c.update = () => {};
            await frame(); await frame();
          }, { secs, pick: o.pick });
          await page.screenshot({ path: `${OUT}/${prefix}-${scene}-${name}-${w}x${h}.png` });
          totalErrors += errors.length;
          console.log(scene, name, `${w}x${h}`, 'handoff', errors.length ? errors : '');
          await page.close();
          continue;
        }
        await page.evaluate(() => { document.body.classList.add('rotate-ok'); });
        const info = await page.evaluate(async ({ beat, secs, pick }) => {
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const c = window.__motd.cut, real = c.update;
          c.update = () => {};
          let base = 0;
          if (pick != null) { c.i = c.beats.findIndex((b) => b.t === 'choice'); c.enter(); c.pick(pick); base = c.i; }
          c.i = base + beat; c.enter(); c.shotN++;
          const b = c.beat;
          if (b.t === 'line') c.typed = b.text.length;
          if (b.t === 'card') { c.t = Math.min(secs, b.dur - 0.5); }
          if (b.t === 'line' || b.t === 'shot') c.t = secs;
          if (b.t === 'choice') c.timer = 6;
          await frame();
          const f = window.__motd.film;
          f.pl.frames = -1e9; // headless GL is slow: keep High for the capture
          const upd = f.update.bind(f);
          f.update = () => {};
          for (let t = 0; t < secs; t += 1 / 30) upd(1 / 30, c.view().film);
          await frame();
          void real;
          return { shot: c.view().film.shot, beat: b.t, quality: f.high ? 'high' : 'low' };
        }, { beat, secs, pick: o.pick });
        await page.screenshot({ path: `${OUT}/${prefix}-${scene}-${name}-${w}x${h}.png` });
        totalErrors += errors.length;
        console.log(scene, name, `${w}x${h}`, info.shot, info.beat, info.quality, errors.length ? errors : '');
        await page.close();
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
console.log('console errors:', totalErrors);
