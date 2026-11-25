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
//
// Every beat can also carry `cues`: little events fired once as the beat's own clock passes `at`
// seconds: { at, sting: 'stingHit' (any sfx name), shake: 0-18, flash: 0-1, slow: [scale, seconds] }.
// `cam` picks a shot and a move (see resolveShot). None of this touches the words, the choices or
// their timing: it is only camera, light and sound.

const line = (who, text, cam, extra = {}) => ({ t: 'line', who, text, cam: cam || { shot: 'who', who }, ...extra });

export function openingScene() {
  return [
    // Scene 1: the alarm. A high crane glides down onto the four of them as the klaxon trips.
    { t: 'card', title: 'WING 1: FOOD COURT', sub: 'BLACK FRIDAY OUTBREAK', dur: 4.2, cam: { shot: 'wide', move: 'crane', dur: 5 }, fx: 'alarm',
      cues: [{ at: 0.05, sting: 'stingAlarm', shake: 5 }, { at: 0.9, sting: 'stingHit', shake: 9, flash: 0.35 }] },
    line('mallCop', 'Every shutter in the mall just dropped. Per procedure, our only exit is the Food Court.', { shot: 'who', who: 'mallCop', move: 'push' }, { fx: 'alarm', cues: [{ at: 0.1, sting: 'whoosh' }] }),
    line('biker', "Food Court's packed with hungry dead. Good. So's my chainsaw.", { shot: 'who', who: 'biker', move: 'orbit' }, { fx: 'alarm', cues: [{ at: 0.1, sting: 'whoosh' }] }),
    line('mallGoth', "Or we hijack the PA and play something loud. The dead always go where the music is.", { shot: 'who', who: 'mallGoth', move: 'push' }, { fx: 'alarm', cues: [{ at: 0.1, sting: 'whoosh' }] }),
    line('skater', 'Dudes. The escalator is eating a guy. Whatever we pick, we pick in like ten seconds.', { shot: 'who', who: 'skater', move: 'push', roll: 0.05 }, { fx: 'alarm', cues: [{ at: 0.1, sting: 'whoosh' }, { at: 0.6, sting: 'heartbeat', shake: 3 }] }),
    { t: 'choice', id: 'outbreak', cam: { shot: 'wide', move: 'tension' }, fx: 'alarm', then: openingResponse },
  ];
}

function openingResponse(res) {
  switch (res.option.pick) {
    case 'cop': return [line('mallCop', "Gate first. Nothing gets behind us. That's not caution, that's Section Four.", null, { cues: [{ at: 0.1, sting: 'doorSlam', shake: 8 }] }), line('biker', "Slow. Boring. Fine, Badge. But I'm first through the door.")];
    case 'goth': return [line('mallGoth', "One bass drop and they'll follow it anywhere. Like boys at a show.", null, { cues: [{ at: 0.1, sting: 'stingHit', shake: 6 }] }), line('mallCop', 'Copy. Keep it under a noise complaint, please.')];
    case 'biker': return [line('biker', "THAT'S the plan! Somebody hold the door. Never mind, I'll make one.", null, { cues: [{ at: 0.05, sting: 'chainsawRev', shake: 7, slow: [0.35, 0.7] }] }), line('mallCop', 'For the record, I objected. Into my radio. Loudly.')];
    default: return [line('skater', '...Cool. Cool cool cool. Nobody? Awesome plan, dudes.', null, { cues: [{ at: 0.1, sting: 'stingDread' }] }), line('mallCop', 'No plan. Fine. Stay close, stay quiet, and nobody gets bitten on my shift.')];
  }
}

export function crisisScene() {
  return [
    // Scene 2: Ray behind the counter, the Armory locker burning behind us.
    line('skater', "Dude, that's Ray! Pizza Ray! Behind the counter, and he's still got all his parts!", { shot: 'ray', move: 'dolly' }, { fx: 'fire', cues: [{ at: 0.05, sting: 'stingFire', shake: 4 }] }),
    line('ray', 'HEY! Over here! I make the pizza! Nobody eats the pizza guy! That\'s the rule!', { shot: 'ray', move: 'push' }, { fx: 'fire', cues: [{ at: 0.05, sting: 'moan' }, { at: 0.5, shake: 3 }] }),
    line('mallCop', "The Security Locker's behind him. Last heavy gear in the mall. Fire seals it in seconds.", { shot: 'locker', move: 'dolly' }, { fx: 'fire', cues: [{ at: 0.05, sting: 'stingHit', shake: 7 }] }),
    line('mallGoth', "He's slipped me extra garlic knots for a year. We are not leaving him.", null, { fx: 'fire' }),
    line('biker', "Can't do both, Spooky. Pizza or the guns. Pick before the fire does.", null, { fx: 'fire', cues: [{ at: 0.05, sting: 'whoosh' }] }),
    { t: 'choice', id: 'rayLocker', cam: { shot: 'plaza', move: 'tension' }, fx: 'fire', then: crisisResponse },
  ];
}

function crisisResponse(res) {
  switch (res.option.pick) {
    case 'save': return [line('skater', 'Ray! Grab my hand! Do NOT let go, dude!', { shot: 'ray', move: 'push' }, { cues: [{ at: 0.05, sting: 'whoosh', slow: [0.4, 0.6] }] }), line('ray', "I knew you'd come! Free slices for life! Which might be tonight!", { shot: 'ray' }), line('mallGoth', "The locker's ash. Worth it. He still smells like garlic.", { shot: 'locker', move: 'dolly' }, { cues: [{ at: 0.2, sting: 'stingSad' }] })];
    case 'loot': return [line('mallCop', 'Grab the gear! Move, move! That\'s an order!', { shot: 'locker', move: 'push' }, { cues: [{ at: 0.05, sting: 'doorSlam', shake: 7 }] }), line('ray', 'Wait... WAIT! You\'re grabbing the GUNS?! I\'m RIGHT HERE!', { shot: 'ray', move: 'push' }, { cues: [{ at: 0.1, sting: 'stingHit', shake: 12, slow: [0.3, 1.1], flash: 0.3 }] }), line('mallGoth', "I'm never going to forget that sound. Neither are you.", null, { cues: [{ at: 0.3, sting: 'stingSad' }] })];
    case 'hold': return [line('biker', 'Shoulders in! Get under it, Pizza! I got maybe three seconds!', { shot: 'locker', move: 'push' }, { cues: [{ at: 0.05, sting: 'doorSlam', shake: 9 }] }), line('ray', 'AGH! My leg! It\'s caught, it\'s caught!', { shot: 'ray', move: 'push' }, { cues: [{ at: 0.05, shake: 6, slow: [0.45, 0.6] }] }), line('skater', 'Sprinters! Left side, coming in hot! Biker, drop it!', null, { cues: [{ at: 0.05, sting: 'stingHit', shake: 6 }] })];
    default: return [line('mallCop', '...We froze. Eleven years on the job, and I froze.', { shot: 'plaza', move: 'push' }, { cues: [{ at: 0.1, sting: 'stingDread' }] }), line('mallGoth', "Silence isn't a plan, Officer. It's a confession with better lighting.", { shot: 'ray', move: 'push' }, { cues: [{ at: 0.05, sting: 'stingHit', shake: 12, slow: [0.3, 0.9] }] }), line('skater', 'No, no, no. Dude. We just stood there.', null, { cues: [{ at: 0.1, sting: 'stingSad' }] })];
  }
}

export function bossIntroScene(story) {
  const tone = bossModifiers(story).tone;
  // Scene 3: the kitchen. Black, a grease-light flicker, a cleaver ringing on steel, then an orbit
  // up out of the fryer steam onto the Butcher while the title slams in.
  const beats = [{
    t: 'card', title: 'THE DEEP-FRY BUTCHER', sub: 'FOOD COURT KITCHEN', dur: 6.2, cam: { shot: 'boss', move: 'reveal', dur: 6.2 }, boss: true, fx: 'kitchen',
    cues: [
      { at: 0.05, sting: 'sizzle', shake: 2 },
      { at: 0.5, sting: 'riser' },
      { at: 2.7, sting: 'stingReveal', shake: 15, flash: 0.55, slow: [0.3, 0.8] },
      { at: 3.2, sting: 'horde' },
    ],
  }];
  beats.push(line('butcher', 'ORDER UP! FRESH MEAT SPECIAL! FOUR-PIECE, EXTRA CRISPY!', { shot: 'boss', move: 'roar' }, { fx: 'kitchen', cues: [{ at: 0.08, sting: 'butcherRoar', shake: 18, flash: 0.5, slow: [0.22, 0.9] }] }));
  if (tone === 'hopeful') {
    beats.push(line('ray', "That's Dale from the carvery! I'll sling hot slices from the back. Keep him busy!", { shot: 'ray' }));
    beats.push(line('mallCop', 'Negative, Ray. Civilians stay behind the sneeze guard.', { shot: 'who', who: 'mallCop' }));
  } else if (tone === 'guilt') {
    beats.push(line('skater', 'Hope those shotgun shells were worth it.', { shot: 'who', who: 'skater' }));
    beats.push(line('mallGoth', '...', { shot: 'who', who: 'mallGoth' }));
    beats.push(line('mallCop', "They'll have to be.", { shot: 'who', who: 'mallCop' }));
  } else if (tone === 'strained') {
    beats.push(line('ray', "Can't stand on this leg. Just... don't die on me, okay?", { shot: 'ray' }));
    beats.push(line('biker', "Wasn't planning on it, Pizza. Sit tight. Enjoy the show.", { shot: 'who', who: 'biker' }));
  } else {
    beats.push(line('mallCop', 'No cook. No backup. Just us and the fryer.', { shot: 'who', who: 'mallCop' }));
    beats.push(line('mallGoth', 'Then we light him up for Ray. Hairspray. Lighter. Grease. Go.', { shot: 'who', who: 'mallGoth' }));
  }
  return beats;
}

export const SCENES = { opening: openingScene, crisis: crisisScene, boss: bossIntroScene };

// ---------- the player ----------

const BAR_CARD = 90;    // letterbox bar height (virtual px) on a chapter / boss card
const BAR_LINE = 42;    // ... on a spoken line or a choice (the plaque starts at y=460 and the bar at y=598)

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
    this.ct = 0;       // the camera's clock for this beat: runs slow during a slow-motion hit
    this.timer = 0;    // the choice countdown
    this.picked = null;
    this.results = [];
    this.toasts = [];  // { text, t } newly fired, drained by main
    this.cues = [];    // { sting, shake, flash } fired by beats, drained by main (sounds, shake, flash)
    this.done = false;
    this.skipped = !!skip;
    this.firstChoiceSeen = false;
    this.alarm = 0;
    this.timeScale = 1;   // 1, or a slow-motion factor while a big hit lands (the scene's world only: never the timers)
    this.slowLeft = 0; this.slowScale = 1;
    this.bar = BAR_CARD;  // letterbox height right now, easing toward the beat's target
    this.flash = 0;       // a white hit-flash that decays
    this.prevKey = null;
    this.snapNow = true;
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
    this.ct = 0;
    this.typed = 0;
    this.fired = 0;
    const b = this.beat;
    if (!b) { this.finish(); return; }
    if (b.t === 'choice') { this.timer = this.seconds; this.picked = null; }
    const cam = b.cam || { shot: 'wide' };
    const key = `${cam.shot}:${cam.who || ''}:${cam.move || ''}`;
    this.snapNow = key !== this.prevKey; // a new angle is a hard cut; the same angle carries on
    this.prevKey = key;
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

  // A beat's cues, once each, as its own clock passes them.
  fireCues(b) {
    const list = b.cues;
    if (!list) return;
    while (this.fired < list.length && this.t >= list[this.fired].at) {
      const c = list[this.fired++];
      this.cues.push({ sting: c.sting || '', shake: c.shake || 0, flash: c.flash || 0 });
      if (c.flash) this.flash = Math.max(this.flash, c.flash);
      if (c.slow) { this.slowScale = c.slow[0]; this.slowLeft = c.slow[1]; }
    }
  }

  update(dt) {
    if (this.done) return;
    const b = this.beat;
    if (!b) { this.finish(); return; }
    this.t += dt;
    // slow motion: the camera and the set slow down, the typing, the timer and the beat clock do not
    if (this.slowLeft > 0) {
      this.slowLeft -= dt;
      const back = Math.min(1, Math.max(0, 1 - this.slowLeft / 0.25)); // ease back to full speed in the last quarter second
      this.timeScale = this.slowLeft > 0.25 ? this.slowScale : this.slowScale + (1 - this.slowScale) * (this.slowLeft > 0 ? back : 1);
    } else this.timeScale = 1;
    this.ct += dt * this.timeScale;
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.fireCues(b);
    this.alarm = b.fx === 'alarm' ? 1 : 0;
    // the letterbox: tall on a card, slimmer under the dialogue
    const want = b.t === 'card' ? BAR_CARD : BAR_LINE;
    this.bar += (want - this.bar) * Math.min(1, dt * 7);
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
    const v = { id: this.id, letterbox: 1, bar: Math.round(this.bar), flash: Math.min(1, this.flash), fade: 0, mood: b && b.fx ? b.fx : '', alarm: this.alarm, card: null, speaker: '', who: '', text: '', choices: null, timerFrac: 0, hint: '', beat: b ? b.t : null };
    if (!b || this.done) return v;
    if (b.t === 'card') {
      v.card = { title: b.title, sub: b.sub, boss: !!b.boss, t: Math.min(1, this.t / 0.4), out: Math.max(0, 1 - Math.max(0, b.dur - this.t) / 0.4), age: this.t, dur: b.dur };
      // a chapter card comes up out of black; the Butcher's out of a long, dark nothing
      const fadeIn = b.boss ? 1.5 : 0.7;
      v.fade = this.i === 0 ? Math.max(0, 1 - this.t / fadeIn) : 0;
    }
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
    let cam = b.cam || { shot: 'wide' };
    if (b.t === 'choice') cam = { ...cam, tens: 1 - Math.max(0, Math.min(1, this.timer / this.seconds)) }; // the room closes in as the clock runs down
    const s = resolveShot(game, cam, this.ct, this.id);
    s.snap = this.snapNow && this.t < 0.2;
    return s;
  }
}

// ---------- cameras ----------
// Positions are in sim units; the renderer maps sim (x, y) to world (x, z) and height to y.
// A shot is { px, py, pz, lx, ly, lz, fov } plus optional cinematography the renderer understands:
//   roll    radians of Dutch tilt           shake   world units of handheld wobble
//   fog     { near, far, color }            a depth cue: the background falls away behind the subject
//   dim     scales the set's ambient light  lights  up to two { x, y, z, color, power, flick } key / rim lights
//   snap    a hard cut: the camera jumps there instead of gliding (set by Cutscene.camera)
// `cam.move` picks how it travels over the beat: 'push' (dolly in), 'dolly' (a sideways track),
// 'orbit' (swing around the subject), 'crane' (a high-to-low glide), 'tension' (a creeping push
// that shakes harder as the choice timer drains), 'reveal' / 'roar' (the Butcher's two big shots).

const KEY_COLOR = { biker: '#ff9040', mallCop: '#5aa0ff', mallGoth: '#c070ff', skater: '#40ffa0', ray: '#ffb060', butcher: '#ff7020' };

function castPos(game, who) {
  if (!game) return null;
  for (const p of game.allPlayers ? game.allPlayers() : []) if (p.cls === who) return p;
  if (game.npcs) for (const n of game.npcs) if (n.id === who) return n;
  if (who === 'butcher' && game.boss) return game.boss;
  return null;
}

const shot = (px, py, pz, lx, ly, lz, fov = 42, extra = null) => ({ px, py, pz, lx, ly, lz, fov, ...extra });
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, k) => a + (b - a) * k;
// a slow handheld wobble: two sines per axis, never repeating on the beat
const hand = (t, amt) => [
  (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.9 + 1.3) * 0.4) * amt,
  (Math.sin(t * 2.3 + 2.1) * 0.6 + Math.sin(t * 4.7) * 0.4) * amt * 0.6,
  (Math.sin(t * 1.3 + 0.7) * 0.6 + Math.sin(t * 3.3 + 2.9) * 0.4) * amt,
];

export function resolveShot(game, cam, t, sceneId) {
  const kind = cam.shot;
  const move = cam.move || '';
  const k = clamp01(t / (cam.dur || 6)), e = ease(k);
  const tens = cam.tens || 0;
  const mid = averageParty(game) || { x: 15 * TILE, y: 14 * TILE };
  const wob = move === 'tension' ? 0.4 + tens * 1.6 : 0.5;
  const [hx, hy, hz] = hand(t, wob);
  const roll = (cam.roll || 0) + (move === 'tension' ? Math.sin(t * 1.9) * 0.012 * (0.5 + tens) : 0);
  const shake = move === 'tension' ? 0.15 + tens * 1.6 : 0;
  if (kind === 'who') {
    const s = castPos(game, cam.who);
    if (!s) return resolveShot(game, { shot: 'wide' }, t, sceneId);
    // from the middle of the huddle, facing the speaker; the move decides how it travels
    const c = game.cutCenter || mid;
    let dx = c.x - s.x, dy = c.y - s.y;
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const push = move === 'push' ? 34 : 14, dist = 108 - mix(0, push, ease(t / 5));
    let side = 18 + (move === 'orbit' ? 38 * ease(t / 5) : 0);
    let ox = dx * dist - dy * side, oy = dy * dist + dx * side;
    const a = move === 'orbit' ? -0.55 * ease(t / 5) : 0; // swing a quarter turn around them
    const ca = Math.cos(a), sa = Math.sin(a);
    [ox, oy] = [ox * ca - oy * sa, ox * sa + oy * ca];
    const fov = move === 'push' ? mix(42, 33, ease(t / 5)) : mix(41, 37, ease(t / 5));
    const col = KEY_COLOR[cam.who] || '#ffffff';
    return shot(s.x + ox + hx, 50 - (move === 'push' ? 4 * ease(t / 5) : 0) + hy, s.y + oy + hz, s.x, 44, s.y, fov, {
      roll,
      fog: { near: dist * 0.8, far: dist * 5, color: '#0a0610' },
      lights: [{ x: s.x - dx * 46 + dy * 30, y: 74, z: s.y - dy * 46 - dx * 30, color: col, power: 150, flick: 0.1 }],
    });
  }
  if (kind === 'ray') {
    const r = castPos(game, 'ray');
    const rx = r ? r.x : 53 * TILE, ry = r ? r.y : 38 * TILE;
    const dolly = move === 'dolly', push = move === 'push';
    const px = dolly ? mix(rx - 150, rx - 70, e) : rx - 120 + e * (push ? 52 : 22);
    const pz = ry - (push ? 84 - 24 * e : 84);
    return shot(px + hx, (push ? 44 - 6 * e : 46 + e * 6) + hy, pz + hz, rx, 30, ry, push ? mix(42, 30, e) : 40, {
      roll, fog: { near: 90, far: 520, color: '#180806' },
      lights: [{ x: rx + 30, y: 40, z: ry + 20, color: '#ff7a30', power: 190, flick: 0.35 }],
    });
  }
  if (kind === 'locker') {
    const lx = 18 * TILE, ly = 40 * TILE;
    const push = move === 'push';
    const px = move === 'dolly' ? mix(lx + 70, lx - 60, e) : lx + 20 - e * 30;
    const pz = ly - (push ? 150 - 60 * e : 150);
    return shot(px + hx, 64 - (push ? 14 * e : 0) + hy, pz + hz, lx, 26, ly, push ? mix(46, 34, e) : 46, {
      roll, fog: { near: 110, far: 640, color: '#180806' },
      lights: [{ x: lx, y: 40, z: ly - 16, color: '#ff6a20', power: 240, flick: 0.45 }],
    });
  }
  if (kind === 'plaza') {
    const e2 = move === 'tension' ? ease(t / 9) : e;
    return shot(mid.x - 150 + e2 * 40 + hx, 110 - e2 * 12 + hy, mid.y + 190 - e2 * 40 + hz, mid.x + 40, 16, mid.y - 20, mix(50, 44, e2), { roll, shake, fog: { near: 200, far: 900, color: '#140808' } });
  }
  if (kind === 'boss') {
    const b = game && game.boss ? game.boss : { x: 32 * TILE, y: 16 * TILE };
    return bossShot(b, move, t, cam, roll, hx, hy, hz);
  }
  // a wide shot of the huddle (the Security Room, by default)
  const c = game && game.cutCenter ? game.cutCenter : mid;
  if (move === 'crane') { // a high crane that glides down onto the group
    return shot(c.x - mix(60, 14, e) + hx, mix(190, 70, e) + hy, c.y + mix(250, 168, e) + hz, c.x, mix(14, 28, e), c.y - mix(0, 30, e), mix(60, 50, e), { roll: mix(0.07, 0, e), shake: 0.6 * (1 - e), fog: { near: 260, far: 1100, color: '#14060a' } });
  }
  if (move === 'tension') {
    const e2 = ease(t / 10);
    return shot(c.x - 40 + Math.sin(t * 0.25) * 30 + hx, 84 - e2 * 10 + hy, c.y + 170 - e2 * 46 + hz, c.x, 26, c.y - 30, mix(52, 44, e2), { roll, shake, fog: { near: 200, far: 900, color: '#14060a' } });
  }
  return shot(c.x - 40 + Math.sin(t * 0.25) * 30, 84, c.y + 170, c.x, 26, c.y - 30, 52);
}

// The Butcher's two shots. Positions are around his feet; the party stands to his west (-x).
function bossShot(b, move, t, cam, roll, hx, hy, hz) {
  const fryer = { x: b.x - 52, y: 26, z: b.y + 22, color: '#ff6a18', power: 260, flick: 0.4 };
  const fluor = { x: b.x + 10, y: 120, z: b.y - 10, color: '#c8ffd0', power: 120, flick: 0.9 };
  if (move === 'reveal') {
    // 0-3.4s: an orbit up out of the steam, low and tight, from his north-west round to the front.
    // 3.4s+: a held, drifting hero shot while the title sits over him.
    const dur = cam.dur || 6.2, orb = ease(t / 3.4), hold = clamp01((t - 3.4) / (dur - 3.4));
    const a = Math.PI * 1.0 + mix(1.35, 0.05, orb) - hold * 0.12;
    const r = mix(320, 205, orb) + hold * 8;
    const h = mix(6, 48, orb) + hold * 6;
    const kick = t > 2.7 ? Math.max(0, 1 - (t - 2.7) / 0.5) : 0; // the dolly-in kick on the reveal hit
    const fov = mix(58, 40, orb) - kick * 5 + hold * 1.5;
    const dim = mix(0.28, 0.7, ease(t / 3));
    return shot(b.x + Math.cos(a) * r + hx, h + hy, b.y + Math.sin(a) * r + hz, b.x, mix(34, 66, orb), b.y, fov, {
      roll: mix(0.09, 0.01, orb) + roll, shake: 0.5 + kick * 3, dim,
      fog: { near: mix(40, 130, orb), far: mix(380, 700, orb), color: '#1d0c06' },
      lights: [fryer, fluor],
    });
  }
  if (move === 'roar') { // a hard cut to a low, hard push on his face
    const k = ease(t / 1.6);
    return shot(b.x - mix(122, 76, k) + hx * 0.6, mix(30, 76, k) + hy, b.y + mix(80, 46, k) + hz * 0.6, b.x, 102, b.y, mix(40, 30, k), {
      roll: 0.05, shake: t < 0.9 ? 2.4 : 0.8, dim: 0.75, fog: { near: 90, far: 600, color: '#1d0c06' },
      lights: [{ ...fryer, power: 260 + (t < 0.6 ? 300 * (1 - t / 0.6) : 0) }, fluor],
    });
  }
  return shot(b.x - 150 + ease(t / 6) * 40 + hx, 18 + ease(t / 6) * 24 + hy, b.y + 120 - ease(t / 6) * 30 + hz, b.x, 64, b.y, 48 - ease(t / 6) * 6, { roll, dim: 0.8, fog: { near: 120, far: 700, color: '#1d0c06' }, lights: [fryer, fluor] });
}

function averageParty(game) {
  const ps = game && game.allPlayers ? game.allPlayers() : [];
  if (!ps.length) return null;
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

export { isSilence };
