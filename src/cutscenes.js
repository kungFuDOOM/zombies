// The cutscene player: Telltale's *mechanics* (timed four-way choices, a "..." silence option,
// a shrinking timer bar, timeout = silence, "X will remember that" toasts) in Mall of the
// Dead's own look: cinematic 3D cameras on the real survivors and the real mall, with a clean
// dark translucent HUD for the lines and the choice bar (see hud.js drawCutscene).
// No ink outlines, halftone, comic panels or portrait cards.
//
// Pure logic: no DOM, no WebGL. main.js feeds it input and renders its view().

import { CHOICES, CHOICE_SECONDS, SURVIVOR_NAMES, DEFAULT_PICKS, isSilence, bossModifiers } from './story.js';
import { TILE } from './config.js';

const NAMES = { ...SURVIVOR_NAMES, ray: 'Ray', butcher: 'The Deep-Fry Butcher' };
export const speakerName = (who) => NAMES[who] || '';

export const TYPE_SPEED = 48;  // characters per second
const LINE_HOLD = 1.1;         // an unattended line moves on this long after it finishes typing
const TOAST_SECONDS = 2.6;

// ---------- the scripts ----------
// A scene is a list of beats:
//   { t: 'card', title, sub, dur, cam }          a chapter card over the 3D scene
//   { t: 'line', who, text, cam, fx? }           a spoken line (who: survivor id, 'ray' or 'butcher')
//   { t: 'choice', id, cam, then(res, ctx) }     the timed choice; then() returns the response beats

const line = (who, text, cam, extra = {}) => ({ t: 'line', who, text, cam: cam || { shot: 'who', who }, ...extra });

export function openingScene() {
  return [
    { t: 'card', title: 'WING 1: FOOD COURT', sub: 'BLACK FRIDAY OUTBREAK', dur: 3.2, cam: { shot: 'wide' }, fx: 'alarm' },
    line('mallCop', 'Every shutter in the mall just tripped. The only way to the service tunnels is the Food Court.', null, { fx: 'alarm' }),
    line('biker', 'Then we go through the Food Court. My chainsaw has been hungry since lunch.', null, { fx: 'alarm' }),
    line('mallGoth', "Or we blast the PA, and let the noise drag every one of them to the wrong end of the mall.", null, { fx: 'alarm' }),
    line('skater', 'Uh, guys? Whatever we pick, we pick it in about ten seconds.', null, { fx: 'alarm' }),
    { t: 'choice', id: 'outbreak', cam: { shot: 'wide' }, fx: 'alarm', then: openingResponse },
  ];
}

function openingResponse(res) {
  switch (res.option.pick) {
    case 'cop': return [line('mallCop', 'Gate first. Nothing gets behind us.'), line('biker', 'Slow. Boring. Fine.')];
    case 'goth': return [line('mallGoth', 'One big bass drop. You are welcome.'), line('mallCop', 'Keep the volume sane.')];
    case 'biker': return [line('biker', "THAT'S what I'm talking about!"), line('mallCop', 'We are all going to regret this.')];
    default: return [line('skater', '...Cool. Cool cool cool. Silence. Great plan.'), line('mallCop', 'Fine. Nobody has a plan. Move out.')];
  }
}

export function crisisScene() {
  return [
    line('skater', 'That is Ray! The cook from the pizza place! He is still alive!', { shot: 'ray' }, { fx: 'fire' }),
    line('ray', "Behind the counter! I can't get out! They're everywhere!", { shot: 'ray' }, { fx: 'fire' }),
    line('mallCop', 'The Armory locker is on fire. That cache is the only heavy gear we will find, and it seals in seconds.', { shot: 'locker' }, { fx: 'fire' }),
    line('mallGoth', 'We cannot leave him. We cannot.', null, { fx: 'fire' }),
    line('biker', "We don't have time for both!", null, { fx: 'fire' }),
    { t: 'choice', id: 'rayLocker', cam: { shot: 'plaza' }, fx: 'fire', then: crisisResponse },
  ];
}

function crisisResponse(res) {
  switch (res.option.pick) {
    case 'save': return [line('skater', 'Hold on, Ray!', { shot: 'ray' }), line('ray', "I knew you'd come! Pizza is on me!", { shot: 'ray' }), line('mallGoth', 'The locker is gone. Worth it.', { shot: 'locker' })];
    case 'loot': return [line('mallCop', 'Grab the cache! Move, move!', { shot: 'locker' }), line('ray', 'No... wait! WAIT!', { shot: 'ray' }), line('mallGoth', 'I am never going to forget that sound.')];
    case 'hold': return [line('biker', 'Get your shoulders into it!', { shot: 'locker' }), line('ray', 'Ugh! My leg!', { shot: 'ray' }), line('skater', 'Sprinters! Left side!')];
    default: return [line('mallCop', '...We froze.', { shot: 'plaza' }), line('mallGoth', 'Ray? RAY!', { shot: 'ray' }), line('skater', 'No, no, no...')];
  }
}

export function bossIntroScene(story) {
  const tone = bossModifiers(story).tone;
  const beats = [{ t: 'card', title: 'THE DEEP-FRY BUTCHER', sub: 'FOOD COURT KITCHEN', dur: 3.4, cam: { shot: 'boss' }, boss: true }];
  beats.push(line('butcher', 'FRESH MEAT SPECIAL!', { shot: 'boss' }));
  if (tone === 'hopeful') {
    beats.push(line('ray', "That's the Butcher! I'll sling hot pizza from the back. You keep him busy!", { shot: 'ray' }));
    beats.push(line('mallCop', 'Stay behind the line, Ray!', { shot: 'who', who: 'mallCop' }));
  } else if (tone === 'guilt') {
    beats.push(line('skater', 'Hope that hardware was worth it.', { shot: 'who', who: 'skater' }));
    beats.push(line('mallGoth', '...', { shot: 'who', who: 'mallGoth' }));
    beats.push(line('mallCop', 'It will have to be.', { shot: 'who', who: 'mallCop' }));
  } else if (tone === 'strained') {
    beats.push(line('ray', "I'm no good in this fight. Just... don't die on me.", { shot: 'ray' }));
    beats.push(line('biker', 'We never planned to.', { shot: 'who', who: 'biker' }));
  } else {
    beats.push(line('mallCop', 'Just us now. No cook. No backup.', { shot: 'who', who: 'mallCop' }));
    beats.push(line('mallGoth', 'Do not talk. Survive.', { shot: 'who', who: 'mallGoth' }));
  }
  return beats;
}

export const SCENES = { opening: openingScene, crisis: crisisScene, boss: bossIntroScene };

// ---------- the player ----------

export class Cutscene {
  // hooks.choose(choiceId, pick) -> { option, toasts, effects, silence } (applies the choice to the
  // story and the game); hooks.done(results) when the scene is over.
  constructor(id, { story, hooks, skip = false, seconds = CHOICE_SECONDS } = {}) {
    this.id = id;
    this.hooks = hooks;
    this.seconds = seconds;
    this.beats = SCENES[id](story);
    this.i = 0;
    this.t = 0;        // time in this beat
    this.timer = 0;    // the choice countdown
    this.picked = null;
    this.results = [];
    this.toasts = [];  // { text, t } newly fired, drained by main
    this.done = false;
    this.skipped = !!skip;
    this.firstChoiceSeen = false;
    this.alarm = 0;
    if (skip) this.runSkip();
    else this.enter();
  }

  // The "Skip cutscenes" test toggle: make the documented default picks and finish at once.
  runSkip() {
    for (const b of this.beats) {
      if (b.t !== 'choice') continue;
      const pick = DEFAULT_PICKS[b.id];
      const res = this.hooks.choose(b.id, pick);
      this.results.push({ id: b.id, pick, res });
      this.fireToasts(res);
    }
    this.finish();
  }

  get beat() { return this.beats[this.i] || null; }

  enter() {
    this.t = 0;
    this.typed = 0;
    const b = this.beat;
    if (!b) { this.finish(); return; }
    if (b.t === 'choice') { this.timer = this.seconds; this.picked = null; }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    if (this.hooks.done) this.hooks.done(this.results);
  }

  textFull() { const b = this.beat; return b && b.t === 'line' ? b.text : ''; }
  isTyping() { return this.beat && this.beat.t === 'line' && this.typed < this.beat.text.length; }

  // Space / Enter / click: finish the typing, then move on. Choices ignore it (you have to pick).
  advance() {
    const b = this.beat;
    if (!b || this.done) return;
    if (b.t === 'line') {
      if (this.isTyping()) { this.typed = b.text.length; return; }
      this.next();
    } else if (b.t === 'card') { if (this.t > 0.5) this.next(); }
  }

  next() {
    this.i++;
    this.enter();
  }

  // index 0..2 = the spoken options, 3 = "..." (or any number: Telltale's 1-4 keys)
  pick(index) {
    const b = this.beat;
    if (!b || b.t !== 'choice' || this.picked || this.done) return false;
    const c = CHOICES[b.id];
    const pick = index >= 0 && index < c.options.length ? c.options[index].pick : 'silence';
    return this.choose(b, pick);
  }

  choose(b, pick) {
    const res = this.hooks.choose(b.id, pick);
    if (!res) return false;
    this.picked = { pick: res.option.pick, silence: res.silence };
    this.results.push({ id: b.id, pick: res.option.pick, res });
    this.fireToasts(res);
    // the response beats play next, then whatever follows the choice
    const reply = b.then ? b.then(res, this) : [];
    this.beats.splice(this.i + 1, 0, ...reply);
    this.next();
    return true;
  }

  fireToasts(res) {
    for (const text of res.toasts) this.toasts.push({ text, t: TOAST_SECONDS });
  }

  update(dt) {
    if (this.done) return;
    const b = this.beat;
    if (!b) { this.finish(); return; }
    this.t += dt;
    this.alarm = b.fx === 'alarm' ? 1 : 0;
    if (b.t === 'line') {
      this.typed = Math.min(b.text.length, this.typed + TYPE_SPEED * dt);
      if (this.typed >= b.text.length && this.t > b.text.length / TYPE_SPEED + LINE_HOLD + b.text.length / 60) this.next();
    } else if (b.t === 'card') {
      if (this.t >= b.dur) this.next();
    } else if (b.t === 'choice') {
      this.timer -= dt;
      if (this.timer <= 0) this.choose(b, 'timeout'); // the same path as a manual "..."
    }
  }

  // What the HUD draws. Letterbox is a plain pair of bars; nothing here is comic-styled.
  view() {
    const b = this.beat;
    const v = { id: this.id, letterbox: 1, alarm: this.alarm, card: null, speaker: '', who: '', text: '', choices: null, timerFrac: 0, hint: '', beat: b ? b.t : null };
    if (!b || this.done) return v;
    if (b.t === 'card') v.card = { title: b.title, sub: b.sub, boss: !!b.boss, t: Math.min(1, this.t / 0.4), out: Math.max(0, 1 - Math.max(0, b.dur - this.t) / 0.4) };
    if (b.t === 'line') { v.who = b.who; v.speaker = speakerName(b.who); v.text = b.text.slice(0, Math.floor(this.typed)); v.full = b.text; }
    if (b.t === 'choice') {
      const c = CHOICES[b.id];
      v.prompt = c.prompt;
      v.choices = [...c.options.map((o, k) => ({ n: k + 1, label: o.label, silence: false })), { n: 4, label: '...', silence: true }];
      v.timerFrac = Math.max(0, Math.min(1, this.timer / this.seconds));
      v.hint = b.id === 'outbreak' ? 'Silence is a valid option.' : '';
    }
    return v;
  }

  // The 3D camera for this beat (null = the normal game camera).
  camera(game) {
    const b = this.beat;
    if (!b) return null;
    return resolveShot(game, b.cam || { shot: 'wide' }, this.t, this.id);
  }
}

// ---------- cameras ----------
// Positions are in sim units; the renderer maps sim (x, y) to world (x, z) and height to y.

function castPos(game, who) {
  if (!game) return null;
  for (const p of game.allPlayers ? game.allPlayers() : []) if (p.cls === who) return p;
  if (game.npcs) for (const n of game.npcs) if (n.id === who) return n;
  if (who === 'butcher' && game.boss) return game.boss;
  return null;
}

const shot = (px, py, pz, lx, ly, lz, fov = 42) => ({ px, py, pz, lx, ly, lz, fov });

export function resolveShot(game, cam, t, sceneId) {
  const kind = cam.shot;
  const mid = averageParty(game) || { x: 15 * TILE, y: 14 * TILE };
  const ease = Math.min(1, t / 6);
  if (kind === 'who') {
    const s = castPos(game, cam.who);
    if (!s) return resolveShot(game, { shot: 'wide' }, t, sceneId);
    // from the middle of the huddle, facing the speaker, with a slow push-in
    const c = game.cutCenter || mid;
    let dx = c.x - s.x, dy = c.y - s.y;
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const dist = 108 - ease * 16;
    return shot(s.x + dx * dist - dy * 18, 46, s.y + dy * dist + dx * 18, s.x, 30, s.y, 40);
  }
  if (kind === 'ray') {
    const r = castPos(game, 'ray');
    const rx = r ? r.x : 53 * TILE, ry = r ? r.y : 38 * TILE;
    return shot(rx - 120 + ease * 22, 46 + ease * 6, ry - 84, rx, 30, ry, 40);
  }
  if (kind === 'locker') {
    const lx = 18 * TILE, ly = 40 * TILE;
    return shot(lx + 20 - ease * 30, 64, ly - 150, lx, 26, ly, 46);
  }
  if (kind === 'plaza') return shot(mid.x - 150 + ease * 40, 110, mid.y + 190 - ease * 20, mid.x + 40, 16, mid.y - 20, 50);
  if (kind === 'boss') {
    const b = game && game.boss ? game.boss : { x: 32 * TILE, y: 16 * TILE };
    return shot(b.x - 150 + ease * 40, 18 + ease * 24, b.y + 120 - ease * 30, b.x, 52, b.y, 48 - ease * 6);
  }
  // a wide shot of the huddle (the Security Room, by default)
  const c = game && game.cutCenter ? game.cutCenter : mid;
  return shot(c.x - 40 + Math.sin(t * 0.25) * 30, 84, c.y + 170, c.x, 26, c.y - 30, 52);
}

function averageParty(game) {
  const ps = game && game.allPlayers ? game.allPlayers() : [];
  if (!ps.length) return null;
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

export { isSilence };
