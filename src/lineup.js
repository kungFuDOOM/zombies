// Debug showcase: every survivor, zombie variant and boss (built or planned) on one stage, at
// the same 3/4 angle as gameplay. Open the game with ?lineup (or ?lineup=heroes|zombies|bosses)
// or call window.__motd.lineup('bosses') from the console; window.__motd.lineup(false) leaves it.
// Boss concepts for locked wings render here too, so the roster can be reviewed without playing them.

import * as THREE from 'three';
import { Actor, HERO_CLASSES } from './assets.js';
import { VIEW_W, VIEW_H } from './config.js';
import { ENEMY_STYLE, HERO_STYLE } from './render3d.js';
import { buildBoss, BOSS_SCALE } from './models.js';
import { BOSS_ROSTER } from './bossRoster.js';

const RUN = { biker: 'Running_C', mallCop: 'Running_C', skater: 'Running_A', mallGoth: 'Running_C' };
let L = null;

export function lineupActive() { return !!L; }

export function startLineup(r3d, section = 'all') {
  if (!section) { L = null; r3d.setPixelation(r3d.prevPixel ?? 1); return; }
  if (r3d.pixelLevel) r3d.prevPixel = r3d.pixelLevel;
  r3d.setPixelation(0); // review at full resolution
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c1626');
  scene.add(new THREE.HemisphereLight('#fff4ec', '#403060', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(-200, 500, 300);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5c5668', roughness: 0.9 }));
  scene.add(floor);
  const actors = [], bosses = [];
  const want = (k) => section === 'all' || section === k;
  const stage = { scene, actors, bosses, items: [], t: 0 };
  // layout
  const place = (obj, x, z, s) => { obj.position.set(x, 0, z); obj.scale.setScalar(s); scene.add(obj); };
  const oneHero = section.startsWith('hero:') ? section.slice(5) : null;
  if (want('heroes') || oneHero) {
    HERO_CLASSES.slice(0, 4).filter((c) => !oneHero || c === oneHero).forEach((cls, i) => {
      const a = new Actor(cls); a.base(HERO_STYLE[cls].idle); actors.push(a);
      place(a.root, oneHero ? 0 : -105 + i * 70, 0, 1.15); a.root.position.z = 110; a.root.rotation.y = oneHero ? 0.5 : 0.3;
    });
  }
  if (want('zombies')) {
    ['walker', 'sprinter', 'brute', 'spitter'].forEach((t, ti) => [0, 1, 2].forEach((v) => {
      const st = ENEMY_STYLE[t];
      const a = new Actor(`${st.model}${v || ''}`, { tint: st.tint, undead: { ...st.undead } });
      if (st.slim) a.model.scale.x *= st.slim;
      a.base(st.walk, st.walkSpeed); actors.push(a);
      place(a.root, -165 + (ti * 3 + v) * 30, 10, st.scale); a.root.scale.setScalar(st.scale * 1.15); a.root.rotation.y = 0.2;
    }));
  }
  if (want('bosses') || section.startsWith('boss:')) {
    const only = section.startsWith('boss:') ? section.slice(5) : null;
    BOSS_ROSTER.filter((b) => !only || b.id === only).forEach((b, i) => {
      if (b.model === 'mulchmaw') { const a = new Actor('giant', { tint: '#c8d8a0' }); a.base('Walking_A'); actors.push(a); place(a.root, only ? 0 : -330 + i * 130, -150, 1); a.root.rotation.y = 0.2; return; }
      const root = buildBoss(b.model, b.color, b.horn);
      root.userData.rig && bosses.push({ root, rig: root.userData.rig });
      place(root, only ? 0 : -330 + i * 130, -150, BOSS_SCALE); root.rotation.y = 0.2;
    });
  }
  const cam = new THREE.PerspectiveCamera(42, VIEW_W / VIEW_H, 10, 4000);
  cam.position.set(0, 330, 520); cam.lookAt(0, 40, -20);
  if (section === 'heroes') { cam.position.set(0, 100, 360); cam.lookAt(0, 50, 110); }
  if (oneHero) { cam.position.set(0, 70, 190); cam.lookAt(0, 42, 110); }
  if (section === 'zombies') { cam.position.set(0, 150, 250); cam.lookAt(0, 38, 0); }
  if (section === 'bosses') { cam.position.set(0, 330, 560); cam.lookAt(0, 50, -150); }
  if (section.startsWith('boss:')) { cam.position.set(0, 190, 130); cam.lookAt(0, 62, -150); }
  stage.cam = cam;
  L = stage;
}

export function renderLineup(r3d, dt) {
  if (!L) return false;
  L.t += dt;
  for (const a of L.actors) a.update(dt);
  L.bosses.forEach((b, i) => {
    const r = b.rig;
    if (r.legs) r.legs.forEach((l, k) => (l.rotation.x = Math.sin(L.t * 2 + k) * 0.1));
    if (r.arm) r.arm.rotation.x = -0.4 + Math.sin(L.t * 1.5 + i) * 0.1;
  });
  r3d.renderer.render(L.scene, L.cam);
  return true;
}
