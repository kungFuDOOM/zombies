// Plays the opener and every ?cine= story scene from start to finish in headless Chrome, on both quality tiers, and
// reports console errors. For scenes that cut to gameplay it also compares the camera of the last film frame with the
// first gameplay frame (the Food Court prebuild included).
//   node tools/cine-check.mjs [--url http://host/path/]   (default: serves the source with server.js; the camera
//   comparison only runs in that mode)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
let url = arg('url', ''), srv = null;
if (!url) {
  const port = 8900 + Math.floor(Math.random() * 90);
  srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  url = `http://127.0.0.1:${port}/`;
  await new Promise((r) => setTimeout(r, 1200));
}
const only = arg('only', '') ? arg('only').split(',') : null;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
try {
  for (const quality of arg('quality', 'high,low').split(',')) {
    const ctx = await browser.newContext(quality === 'low' ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript((q) => { try { localStorage.setItem('motd-intro-seen', '1'); localStorage.setItem('motd-quality', q); } catch { /* none */ } }, quality);
    for (const scene of ['intro', 'scene1', 'ticket', 'scene2', 'boss', 'ending']) {
      if (only && !only.includes(scene)) continue;
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /story|shot|cue|film|intro|shader|program/i.test(m.text()))) errors.push(m.text().slice(0, 600)); });
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 400)));
      await page.goto(scene === 'intro' ? url : `${url}?cine=${scene}`, { waitUntil: 'load' });
      let info;
      if (scene === 'intro') {
        await page.waitForFunction(() => window.__motd && window.__motd.state === 'title', null, { timeout: 90000 });
        info = await page.evaluate(async () => {
          document.body.classList.add('rotate-ok');
          const frame = () => new Promise((r) => requestAnimationFrame(r));
          window.__motd.playIntro({ gate: false });
          const it = window.__motd.intro;
          it.pl.frames = -1e9;
          const seen = new Set();
          // run the whole film through the game loop, several film-seconds per rendered frame
          let n = 0;
          while (it.active && n++ < 600) {
            for (let k = 0; k < 8 && it.active; k++) it.update(1 / 20);
            if (it.pl) seen.add(it.pl.shotI);
            await frame();
          }
          await frame(); await frame();
          return { shots: seen.size, finished: !it.active, state: window.__motd.state };
        });
      } else {
        await page.waitForFunction(() => window.__motd && window.__motd.film, null, { timeout: 90000 });
        info = await page.evaluate(async () => {
          document.body.classList.add('rotate-ok');
          const frame = () => new Promise((r) => requestAnimationFrame(r));
          const M = window.__motd, r3d = M.r3d, game = M.game;
          // record every game-world camera
          const real = r3d.render.bind(r3d);
          let last = null, levelBuilds = 0, prevLevel = r3d.level;
          r3d.render = (g) => {
            real(g);
            if (r3d.level !== prevLevel) { prevLevel = r3d.level; levelBuilds++; }
            const c = r3d.camera;
            if (g.cutCam && g.cutCam.handoff != null) last = { p: c.position.toArray(), q: c.quaternion.toArray(), fov: c.fov, k: g.cutCam.handoff, shake: g.shake, camX: g.camX, camY: g.camY };
          };
          M.cut.update = ((u) => function (dt) { return u.call(this, dt); })(M.cut.update);
          const shots = new Set(), c = M.cut;
          let n = 0, sawHandoff = false;
          while (!c.done && n++ < 1500) {
            if (M.film && M.film.pl) { M.film.pl.frames = -1e9; shots.add(M.film.shotName); }
            if (c.beat && c.beat.handoff) { sawHandoff = true; c.update(0.08); } else if (c.beat && c.beat.t === 'choice') { c.pick(0); } else c.update(0.3);
            await frame();
          }
          await frame(); await frame();
          return { shots: shots.size, finished: c.done, state: M.state, sawHandoff, last, levelBuilds, filmLeft: !!M.film, ratio: r3d.renderer.getPixelRatio(), pixel: r3d.pixelLevel, toneMapping: r3d.renderer.toneMapping, target: !!r3d.renderer.getRenderTarget() };
        });
        if (srv && info.last) { // (needs the raw source: skipped against a built site)
          // the first frame of play uses gameplayPose(camX, camY) with this shake: compare against it
          const diff = await page.evaluate(async (L) => {
            const { gameplayPose } = await import('./src/camMath.js');
            const G = gameplayPose(L.camX, L.camY);
            return { dist: Math.hypot(L.p[0] - G.p[0], L.p[1] - G.p[1], L.p[2] - G.p[2]), fov: Math.abs(L.fov - G.fov), shake: L.shake };
          }, info.last).catch((e) => ({ error: String(e) }));
          info.cut = { k: info.last.k, ...diff };
          delete info.last;
          if (diff.dist > diff.shake + 0.01 || diff.fov > 0.001) errors.push(`handoff does not land on the gameplay camera: ${JSON.stringify(diff)}`);
        }
        delete info.last;
        if ((scene !== 'ending') !== info.sawHandoff) errors.push(`handoff expected ${scene !== 'ending'}, saw ${info.sawHandoff}`);
      }
      if (!info.finished) errors.push('did not finish');
      failures += errors.length;
      console.log(quality, scene, JSON.stringify(info), errors.length ? `\n  ERRORS: ${errors.join('\n  ')}` : 'ok');
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  if (srv) srv.kill();
}
console.log('console errors / failures:', failures);
process.exit(failures ? 1 : 0);
