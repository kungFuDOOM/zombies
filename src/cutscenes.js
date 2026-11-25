// The cutscene player: Telltale's *mechanics* (timed four-way choices, a "..." silence option,
// a shrinking timer bar, timeout = silence, "X will remember that" toasts) in Mall of the
// Dead's own look: HD cinematic 3D scenes (storyFilm.js draws them from view().film), with a clean
// dark translucent HUD for the lines and the choice bar (see hud.js drawCutscene).
// No ink outlines, halftone, comic panels or portrait cards. Scripts: STORY.md sections 8 and 9.
//
// Pure logic: no DOM, no WebGL. main.js feeds it input and renders its view().

import { CHOICES, CHOICE_SECONDS, SURVIVOR_NAMES, DEFAULT_PICKS, isSilence, bossModifiers } from './story.js';
import { TILE } from './config.js';

const NAMES = { ...SURVIVOR_NAMES, ray: 'Ray', butcher: 'The Deep-Fry Butcher', pa: 'Pam (PA)' };
export const speakerName = (who) => NAMES[who] || '';

export const TYPE_SPEED = 48;  // characters per second
const LINE_HOLD = 1.1;         // an unattended line moves on this long after it finishes typing
const TOAST_SECONDS = 2.6;

// ---------- the scripts ----------
// A scene is a list of beats:
//   { t: 'card', title, sub, dur, s, cam }     a chapter card over the 3D scene
//   { t: 'line', who, text, s, cam, hold? }    a spoken line (who: survivor id, 'ray', 'butcher' or 'pa' = Pam)
//   { t: 'shot', s, dur, cam }                 a silent shot: picture and sound only
//   { t: 'choice', id, s, cam, then(res) }     the timed choice; then() returns the response beats
//
// `s` names the 3D shot in storyFilm.js ('name' or 'name=args'). Beats in a row with the same `s` are one continuous
// shot. `cam` is the older camera on the live game world, kept as the fallback if the HD scene cannot be built.
// Every beat can also carry `cues`: little events fired once as the beat's own clock passes `at`
// seconds: { at, sting: 'stingHit' (any sfx name), shake: 0-18, flash: 0-1, slow: [scale, seconds] }.
// `hold` keeps an unattended line up at least that long (a press still moves on).

const line = (who, text, s, cam, extra = {}) => ({ t: 'line', who, text, s, cam: cam || { shot: 'who', who: who === 'pa' ? '' : who }, ...extra });
const silent = (s, dur, cam, extra = {}) => ({ t: 'shot', s, dur, cam: cam || { shot: 'wide' }, ...extra });
const cue = (at, sting, o = {}) => ({ at, sting, ...o });
// the ticking clock under a choice (it stops the moment the beat is gone)
const ticking = (extra = []) => [...Array.from({ length: CHOICE_SECONDS }, (_, i) => cue(i + 0.02, 'clockTick')), ...extra].sort((a, b) => a.at - b.at);

// Scene 1, "The Plan" (STORY.md 9b)
export function openingScene() {
  const alarm = { fx: 'alarm' };
  const who = (id, move = 'push') => ({ shot: 'who', who: id, move });
  return [
    { t: 'card', title: 'WING 1: FOOD COURT', sub: 'BLACK FRIDAY OUTBREAK', dur: 4.2, s: 'plan.wide', cam: { shot: 'wide', move: 'crane', dur: 5 }, ...alarm,
      cues: [cue(0.05, 'stingAlarm', { shake: 5 }), cue(0.9, 'stingHit', { shake: 9, flash: 0.35 }), cue(1.6, 'shutterSlams', { shake: 6 })] },
    line('mallCop', 'Every shutter just dropped. Our only route out is the Food Court.', 'plan.wide', who('mallCop'), { ...alarm, hold: 5, cues: [cue(0.9, 'shutterSlams')] }),
    line('biker', "Food Court's packed with hungry dead. Good. So's my chainsaw.", 'plan.biker', who('biker', 'orbit'), { ...alarm, hold: 5, cues: [cue(0.4, 'chainsawRev', { shake: 4 })] }),
    // the chime catches him mid-sentence: a silent beat while he stands there, then he picks it up as if nothing happened
    silent('plan.freeze', 2.6, who('mallCop'), { cues: [cue(0.15, 'duck'), cue(0.5, 'pamChime'), cue(1.0, 'ringing')] }),
    line('mallCop', '...Per procedure. Sorry. Where was I?', 'plan.freeze', who('mallCop'), { hold: 3.4, cues: [cue(0.5, '', { flash: 0.12 })] }),
    line('mallGoth', 'Or we hijack the PA. The customers go where the noise is.', 'plan.goth', who('mallGoth'), { ...alarm, hold: 5, cues: [cue(1.05, 'boomboxClick')] }),
    line('skater', "Dudes. Escalator's eating a guy. Pick in like ten seconds.", 'plan.monitor', { ...who('skater'), roll: 0.05 }, { ...alarm, hold: 5, cues: [cue(1.4, 'whoosh'), cue(1.9, 'monitorGlitch'), cue(2.4, 'escalatorGroan', { shake: 3 }), cue(3.4, 'moan')] }),
    { t: 'choice', id: 'outbreak', s: 'plan.four', cam: { shot: 'wide', move: 'tension' }, ...alarm, then: openingResponse, cues: ticking() },
  ];
}

function openingResponse(res) {
  const two = (a, b) => `plan.two=${a},${b}`;
  switch (res.option.pick) {
    case 'cop': return [line('mallCop', "Gate first. Nothing gets behind us. That's Section Four.", two('mallCop', 'biker'), null, { cues: [cue(0.1, 'doorSlam', { shake: 8 })] }), line('biker', "Slow. Boring. Fine, Badge. I'm first through the door.", two('mallCop', 'biker'))];
    case 'goth': return [line('mallGoth', "One bass drop and they'll follow it anywhere. Like boys at a show.", two('mallGoth', 'mallCop'), null, { cues: [cue(0.1, 'bassDrop', { shake: 6 })] }), line('mallCop', 'Copy. Keep it under a noise complaint, please.', two('mallGoth', 'mallCop'))];
    case 'biker': return [line('biker', "THAT'S the plan! Somebody hold the door. Never mind, I'll make one.", two('biker', 'mallCop'), null, { cues: [cue(0.05, 'chainsawRev', { shake: 7, slow: [0.35, 0.7] })] }), line('mallCop', 'For the record, I hate this plan.', two('biker', 'mallCop'))];
    default: return [line('skater', 'Okay, nobody? Cool. Cool cool cool. Running in anyway.', two('skater', 'mallGoth'), null, { cues: [cue(0.1, 'stingDread')] }), line('pa', 'Indecision is natural. Hunger is natural too.', 'plan.pa', { shot: 'wide', move: 'tension' }, { hold: 4.2, cues: [cue(0.05, 'pamChime')] })];
  }
}

// Scene 1.5, "The Ticket" (STORY.md 9c): the clue, no choice. If Ray is already gone (a replay), his ticket spike says it.
export function ticketScene(story) {
  const fate = story && story.flags.rayFate;
  const ray = { shot: 'ray', move: 'push' };
  const opening = fate === 'overrun' || fate === 'lost'
    ? [silent('tk.spike', 6, ray, { cues: [cue(0.1, 'fryerSizzle'), cue(1.2, 'stingDread')] })]
    : [
      line('ray', "Hey! Pizza guy, still alive! Dale's gone nuts back there!", 'tk.approach', ray, { hold: 5, cues: [cue(0.05, 'shutterRattle', { shake: 4 }), cue(0.2, 'fryerSizzle')] }),
      line('ray', "Gave out samples at four. Even you, Officer. Two of 'em!", 'tk.spike', ray, { hold: 5, cues: [cue(0.1, 'whoosh'), cue(1.9, 'stingDread')] }),
    ];
  return [
    ...opening,
    line('skater', 'Wait. Badge ate one? Badge ate the meat?', 'tk.two', { shot: 'who', who: 'skater' }, { hold: 4, cues: [cue(0.02, 'duck')] }),
    line('mallCop', "That's... community relations. I feel fine.", 'tk.cop', { shot: 'who', who: 'mallCop', move: 'push' }, { hold: 4.2, cues: [cue(1.9, 'gurgle')] }),
    silent('tk.fountain', 3.1, { shot: 'plaza' }, { cues: [cue(0.15, 'pamChime'), cue(2.1, 'bassDrop', { shake: 7, flash: 0.2 })] }),
    line('mallGoth', "Huh. They'd rather listen to me. Finally.", 'tk.fountain', { shot: 'who', who: 'mallGoth' }, { hold: 3.6, cues: [cue(0.4, 'moan')] }),
  ];
}

// Scene 2, "Ray vs the Locker" (STORY.md 9d)
export function crisisScene() {
  const fire = { fx: 'fire' };
  return [
    line('ray', "Guys! Counter's caving! I'm pinned, I'm pinned!", 'cr.cave', { shot: 'ray', move: 'dolly' }, { ...fire, hold: 4.6, cues: [cue(0.02, 'metalGroan', { shake: 12 }), cue(0.5, 'stingFire', { shake: 5 })] }),
    line('mallCop', "Security Locker's fire-sealing in ten. Last heavy gear in the mall.", 'cr.locker', { shot: 'locker', move: 'dolly' }, { ...fire, hold: 5.2, cues: [cue(0.05, 'whoosh'), cue(0.7, 'klaxon', { shake: 5 })] }),
    line('biker', "Pizza or payload. Can't carry both.", 'cr.biker', { shot: 'who', who: 'biker' }, { ...fire, hold: 4.6, cues: [cue(0.05, 'heartbeat', { shake: 3 })] }),
    line('mallGoth', '...He gave me garlic knots. Every night. For a year.', 'cr.goth', { shot: 'who', who: 'mallGoth', move: 'push' }, { hold: 5.6, cues: [cue(0.02, 'duck'), cue(0.6, 'musicBox')] }),
    silent('cr.crane', 3.4, { shot: 'plaza', move: 'push' }, { ...fire, cues: [cue(0.05, 'horde', { shake: 6 }), cue(1.2, 'metalGroan')] }),
    { t: 'choice', id: 'rayLocker', s: 'cr.four', cam: { shot: 'plaza', move: 'tension' }, ...fire, then: crisisResponse, cues: ticking([cue(0.05, 'klaxon'), cue(3.05, 'klaxon'), cue(6.05, 'klaxon')]) },
  ];
}

function crisisResponse(res) {
  const ray = { shot: 'ray', move: 'push' }, locker = { shot: 'locker', move: 'push' };
  switch (res.option.pick) {
    case 'save': return [
      line('biker', 'Hang on, Pizza. Lifting with my back. Like a genius.', 'cr.lift', locker, { hold: 3.6, cues: [cue(0.05, 'metalGroan', { shake: 10, slow: [0.4, 0.6] })] }),
      line('ray', "I'm out! I'm out! Somebody kiss the Biker!", 'cr.lift', ray, { hold: 3.4, cues: [cue(0.05, 'brassSwell'), cue(0.1, 'doorSlam', { shake: 7 })] }),
    ];
    case 'loot': return [
      line('mallCop', "Copy. Gear secured. ...Ray, I'm sorry.", 'cr.open', locker, { hold: 4, cues: [cue(0.05, 'lockerOpen', { shake: 8, flash: 0.2 }), cue(1.9, 'metalGroan', { shake: 12 })] }),
      line('mallGoth', "Don't. Don't talk to me for a while.", 'cr.open', { shot: 'who', who: 'mallGoth' }, { hold: 3.6, cues: [cue(0.1, 'stingSad')] }),
    ];
    case 'hold': return [
      line('skater', 'Holding it! Holding it! Dude, my arms are spaghetti!', 'cr.brace', locker, { hold: 3.6, cues: [cue(0.05, 'shutterRattle', { shake: 11 }), cue(1.5, 'shutterSlams', { shake: 9 })] }),
      line('ray', 'Got... most of me out. Most is good, right?', 'cr.rayout', ray, { hold: 3.8, cues: [cue(0.05, 'stingSad')] }),
    ];
    default: return [
      line('ray', 'Guys? GUYS?', 'cr.empty', ray, { hold: 3, cues: [cue(0.8, 'metalGroan', { shake: 14, slow: [0.3, 0.9] }), cue(1.6, 'stingDread')] }),
      line('pa', "Ray's Slice of Heaven is now closed.", 'cr.empty', { shot: 'plaza', move: 'push' }, { hold: 4.6, cues: [cue(0.05, 'pamChime')] }),
    ];
  }
}

// Scene 3, the Butcher (STORY.md 9e). The variant two-shot follows what happened to Ray.
const BOSS_VARIANTS = {
  hopeful: { sting: 'brassSwell', lines: [['mallCop', "Ray's safe. Now we close this kitchen."], ['biker', 'Order up, Porky.']] },
  guilt: { sting: 'celloDread', lines: [['mallGoth', 'We left Ray for a box of shells.'], ['mallCop', "Then let's make them count."]] },
  strained: { sting: 'racing', lines: [['skater', "Ray's barely breathing, dude. Fast fight."], ['biker', 'Fast is my only speed.']] },
  bleak: { sting: 'synthNote', lines: [['mallGoth', "Nobody's coming. It's just us."], ['mallCop', "...Then it's just us. Weapons up."]] },
};

export function bossIntroScene(story) {
  const tone = bossModifiers(story).tone;
  const v = BOSS_VARIANTS[tone] || BOSS_VARIANTS.bleak;
  const kitchen = { fx: 'kitchen' };
  const him = { shot: 'boss', move: 'roar' };
  const [[a, first], [b, second]] = v.lines;
  const two = `bk.var=${tone},${a},${b}`;
  return [
    // the cold open: a low crane up out of the fryer steam, and the title slams in over him
    { t: 'card', title: 'THE DEEP-FRY BUTCHER', sub: "DALE BRISKET · PORKO'S CARVERY", dur: 6.2, s: 'bk.reveal', cam: { shot: 'boss', move: 'reveal', dur: 6.2 }, boss: true, ...kitchen,
      cues: [cue(0.05, 'fryerSizzle', { shake: 2 }), cue(0.5, 'riser'), cue(2.7, 'stingReveal', { shake: 15, flash: 0.55, slow: [0.3, 0.8] }), cue(3.2, 'hookClank')] },
    line('biker', '...Huh. Seen those before.', 'bk.drums', { shot: 'who', who: 'biker', move: 'orbit' }, { ...kitchen, hold: 6, cues: [cue(0.05, 'fryerSizzle'), cue(3.6, 'chainsawRev', { shake: 5 })] }),
    silent('bk.ots', 3.9, { shot: 'boss' }, { ...kitchen, cues: [cue(0.05, 'fryerSizzle'), cue(0.97, 'cleaverThunk'), cue(2.12, 'cleaverThunk'), cue(3.27, 'cleaverThunk')] }),
    silent('bk.turn', 2.3, him, { ...kitchen, cues: [cue(0.2, 'hookClank'), cue(0.4, 'riser')] }),
    line('butcher', "Welcome to Porko's!", 'bk.turn', him, { ...kitchen, hold: 2.8, cues: [cue(0.05, 'orderUp', { shake: 14, flash: 0.35, slow: [0.35, 0.7] })] }),
    line('butcher', 'Officer. Back for seconds?', 'bk.cop', him, { ...kitchen, hold: 4.8, cues: [cue(1.9, 'stingHit', { shake: 9 }), cue(2.1, 'ringing')] }),
    line(a, first, two, { shot: 'who', who: a }, { ...kitchen, hold: 3.2, cues: [cue(0.05, v.sting)] }),
    line(b, second, two, { shot: 'who', who: b }, { ...kitchen, hold: 3 }),
    line('butcher', "Take a number! I'll carve you one!", 'bk.roar', him, { ...kitchen, hold: 4, cues: [cue(0.08, 'butcherRoar', { shake: 18, flash: 0.6, slow: [0.22, 0.9] }), cue(0.6, 'hookClank'), cue(1.5, 'titleSlam', { shake: 8 })] }),
  ];
}

// The Wing 1 ending, "4:59" (STORY.md 9f): after the Butcher falls, before the recap.
export function endingScene(story) {
  const fate = story && story.flags.rayFate;
  const him = { shot: 'boss' }, cop = { shot: 'who', who: 'mallCop' };
  const witness = fate === 'saved' ? ['ray', "Dale gave you the samples, man. The oil's in you."]
    : fate === 'injured' ? ['ray', 'Badge... the samples...']
      : ['mallGoth', 'Ray tried to tell us. At the counter.'];
  return [
    line('butcher', "...Tell Pam... I'm off the clock.", 'en.kneel', him, { hold: 7, cues: [cue(1.3, 'cleaverClang', { shake: 10, slow: [0.35, 0.8] }), cue(1.7, 'fryerDown')] }),
    silent('en.gauge', 2.2, him, { cues: [cue(0.2, 'gurgle'), cue(0.9, 'metalGroan')] }),
    line('pa', "Porko's Carvery is now closed. Thank you, Dale.", 'en.gauge', him, { hold: 4.2, cues: [cue(0.05, 'pamChime'), cue(2.4, 'gurgle')] }),
    line('skater', "Dude. The door log's printing.", 'en.office', { shot: 'who', who: 'skater' }, { hold: 4.6, cues: [cue(0.05, 'printer'), cue(3, 'printer')] }),
    silent('en.print', 5.6, cop, { cues: [cue(0.05, 'printer'), cue(1.6, 'duck'), cue(1.7, 'revealSting', { slow: [0.5, 0.6] }), cue(2.7, '', { shake: 9, flash: 0.22 })] }),
    silent('en.feed', 3.4, cop, { cues: [cue(0.05, 'tapeRewind'), cue(1.5, 'monitorGlitch'), cue(3, 'stingDread', { shake: 5 })] }),
    line('mallCop', "That's... that's not... I was at the loading dock.", 'en.feed', cop, { hold: 4 }),
    line(witness[0], witness[1], 'en.orbit', { shot: 'who', who: witness[0] }, { hold: 5, cues: [cue(0.1, 'rain'), cue(0.6, 'softPiano')] }),
    line('biker', 'Not your fault, Badge.', 'en.orbit', { shot: 'who', who: 'biker' }, { hold: 5 }),
    silent('en.reflect', 1.8, { shot: 'wide' }, { cues: [cue(0.1, 'receiptRattle'), cue(0.9, 'stingDread')] }),
    line('pa', "Officer, your shift isn't over. We still need you.", 'en.reflect', { shot: 'wide' }, { hold: 5.4, cues: [cue(0.05, 'pamChime'), cue(4.6, 'zap', { flash: 0.25 })] }),
    silent('en.hand', 3.2, cop, { cues: [cue(0.4, 'heartbeat'), cue(1.4, 'pamChime')] }),
    line('mallCop', '...Copy.', 'en.hand', cop, { hold: 4.4, cues: [cue(1.0, 'riser', { shake: 3 })] }),
    // smash cut to black: silence, then the next wing's cabinet wakes up
    { t: 'card', title: 'NEXT: THE ARCADE', sub: '5:19 AM', dur: 5, s: 'en.black', cam: { shot: 'wide' }, cues: [cue(0.02, 'duck'), cue(0.8, 'arcadeJingle')] },
  ];
}

export const SCENES = { opening: openingScene, ticket: ticketScene, crisis: crisisScene, boss: bossIntroScene, ending: endingScene };

// ---------- the player ----------

const BAR_CARD = 90;    // letterbox bar height (virtual px) on a chapter / boss card
const BAR_LINE = 42;    // ... on a spoken line, a silent shot or a choice
let played = 0;         // numbers each scene played, so the film knows a new one from the last

export class Cutscene {
  // hooks.choose(choiceId, pick) -> { option, toasts, effects, silence } (applies the choice to the
  // story and the game); hooks.done(results) when the scene is over. party: the classes people are playing.
  constructor(id, { story, hooks, skip = false, seconds = CHOICE_SECONDS, party = [] } = {}) {
    this.id = id;
    this.key = `${id}-${++played}`;
    this.story = story;
    this.party = party.slice(0, 4);
    this.shot = '';     // the 3D shot on screen, and its number (a new number = a cut)
    this.shotN = 0;
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
    if (b.s !== this.shot) { this.shot = b.s; this.shotN++; }
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
    else if (b.t === 'shot') { if (this.t > 0.35) this.next(); }
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
      if (this.typed >= b.text.length && this.t > Math.max(b.hold || 0, b.text.length / TYPE_SPEED + LINE_HOLD + b.text.length / 60)) this.next();
    } else if (b.t === 'card' || b.t === 'shot') {
      if (this.t >= b.dur) this.next();
    } else if (b.t === 'choice') {
      this.timer -= dt;
      if (this.timer <= 0) this.choose(b, 'timeout'); // the same path as a manual "..."
    }
  }

  // What the HUD draws. Letterbox is a plain pair of bars; nothing here is comic-styled.
  view() {
    const b = this.beat;
    const v = { id: this.id, letterbox: 1, bar: Math.round(this.bar), flash: Math.min(1, this.flash), fade: 0, mood: b && b.fx ? b.fx : '', alarm: this.alarm, card: null, speaker: '', who: '', text: '', choices: null, timerFrac: 0, hint: '', beat: b ? b.t : null, film: null };
    if (!b || this.done) return v;
    // everything storyFilm.js needs to draw the HD scene (an online guest gets exactly this)
    v.film = { key: this.key, id: this.id, shot: this.shot, cut: this.shotN, ts: this.timeScale, tens: b.t === 'choice' ? 1 - Math.max(0, Math.min(1, this.timer / this.seconds)) : 0, ray: (this.story && this.story.flags.rayFate) || '', party: this.party };
    // a scene that does not open on a card comes up out of black
    if (this.i === 0 && b.t !== 'card') v.fade = Math.max(0, 1 - this.t / 0.7);
    if (b.t === 'card') {
      v.card = { title: b.title, sub: b.sub, boss: !!b.boss, t: Math.min(1, this.t / 0.4), out: Math.max(0, 1 - Math.max(0, b.dur - this.t) / 0.4), age: this.t, dur: b.dur };
      // a chapter card comes up out of black; the Butcher's out of a long, dark nothing
      const fadeIn = b.boss ? 1.1 : 0.7;
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
