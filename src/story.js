// The story engine: persistent choices with real consequences (the Telltale-style part of
// Mall of the Dead). Pure data + functions, no DOM; storage is injectable like campaign.js.
//
//   storyState = { version, relationships, flags, choices }
//
// There is no karma meter. We track four survivors' trust (-5..+5), a handful of binary
// flags, and an ordered log of every decision for the "Your Choices" recap. The state is
// saved on the campaign save and under its own key (motd-story), so it survives reloads and
// carries into later wings.

export const STORY_KEY = 'motd-story';
export const STORY_VERSION = 1;
export const TRUST_MIN = -5;
export const TRUST_MAX = 5;

export const SURVIVORS = ['biker', 'mallCop', 'skater', 'mallGoth'];
export const SURVIVOR_NAMES = { biker: 'Biker', mallCop: 'Mall Cop', skater: 'Skater', mallGoth: 'Mall Goth' };

// How long a timed choice lasts, in seconds, before silence is chosen for you.
export const CHOICE_SECONDS = 9;

// The silence picks: a manual "..." and a timeout take exactly the same path.
const SILENCE = new Set(['silence', '...', 'timeout', '', null, undefined]);
export const isSilence = (pick) => SILENCE.has(pick);

// What a skipped cutscene (the "Skip cutscenes" test toggle) picks. Documented in DESIGN.md.
//   Scene 1 -> side with Mall Cop (lock down the gate)
//   Scene 2 -> save Ray
export const DEFAULT_PICKS = { outbreak: 'cop', rayLocker: 'save' };

// ---------- the choices ----------
// Each option: pick id, label shown on the button, who it is a reply to (speaker), trust
// changes (rel), flag changes, the toasts it fires (vague on purpose: a ping, not a spoiler),
// and effect ids the game turns into real consequences (see Game.applyStoryEffects).
// Silence is an option like any other, and it always costs something.

export const CHOICES = {
  outbreak: {
    id: 'outbreak',
    wing: 1,
    prompt: 'How do we break into the Food Court?',
    options: [
      {
        pick: 'cop', label: 'Lock down the security gate first.', speaker: 'mallCop',
        rel: { mallCop: 2, mallGoth: -1 }, flags: { outbreakPlan: 'lockdown' },
        toasts: ['Mall Cop respects your call.', 'The Food Court shutters locked down.'], effects: ['plan:lockdown'],
      },
      {
        pick: 'goth', label: 'Blow the music PA. Lure them away.', speaker: 'mallGoth',
        rel: { mallGoth: 2, mallCop: -1 }, flags: { outbreakPlan: 'lure' },
        toasts: ['Mall Goth will remember that.'], effects: ['plan:lure'],
      },
      {
        pick: 'biker', label: 'Charge straight in.', speaker: 'biker',
        rel: { biker: 2, mallCop: -1 }, flags: { outbreakPlan: 'charge' },
        toasts: ['Biker will remember that.'], effects: ['plan:charge'],
      },
    ],
    silence: {
      pick: 'silence', label: '...', speaker: null,
      rel: { biker: -1, mallCop: -1 }, flags: { outbreakPlan: 'silence' },
      toasts: ['Biker will remember that.'], effects: ['plan:silence'],
    },
  },
  rayLocker: {
    id: 'rayLocker',
    wing: 1,
    prompt: 'Ray is cornered. The Security Locker is about to seal.',
    options: [
      {
        pick: 'save', label: 'Save Ray!', speaker: 'skater',
        rel: { mallGoth: 2, skater: 2, mallCop: -1 }, flags: { rayAlive: true, rayFate: 'saved', lockerLooted: false },
        toasts: ['Mall Goth will remember that.'], effects: ['ray:saved'],
      },
      {
        pick: 'loot', label: 'Loot the Security Locker.', speaker: 'mallCop',
        rel: { mallCop: -1, mallGoth: -2, skater: -1, biker: 1 }, flags: { rayAlive: false, rayFate: 'overrun', lockerLooted: true },
        toasts: ['Mall Cop will remember that.'], effects: ['ray:overrun'],
      },
      {
        pick: 'hold', label: 'Try to hold the shutter!', speaker: 'biker',
        rel: { skater: 1, biker: 1, mallCop: -1 }, flags: { rayAlive: true, rayFate: 'injured', lockerLooted: false, shutterHeld: true },
        toasts: ['Skater will remember that.'], effects: ['ray:injured'],
      },
    ],
    silence: {
      pick: 'silence', label: '...', speaker: null,
      rel: { mallGoth: -2, skater: -2, mallCop: -1 }, flags: { rayAlive: false, rayFate: 'lost', lockerLooted: false, lockerScrap: true },
      toasts: ['Mall Goth will remember that.'], effects: ['ray:lost'],
    },
  },
};

// ---------- the state ----------

export function newStory() {
  return {
    version: STORY_VERSION,
    relationships: { biker: 0, mallCop: 0, skater: 0, mallGoth: 0 },
    flags: { outbreakPlan: null, rayAlive: null, rayFate: null, lockerLooted: false, lockerScrap: false, shutterHeld: false, silenceCount: 0, wing1Done: false },
    choices: [],
  };
}

const clampTrust = (n) => Math.max(TRUST_MIN, Math.min(TRUST_MAX, Math.round(n)));
const text = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '');

// Make whatever came out of storage into a safe story: unknown keys dropped, numbers clamped,
// lists bounded. Anything unreadable gives a fresh story.
export function sanitizeStory(d) {
  const s = newStory();
  if (!d || typeof d !== 'object' || Array.isArray(d)) return s;
  const rel = d.relationships && typeof d.relationships === 'object' ? d.relationships : {};
  for (const k of SURVIVORS) if (typeof rel[k] === 'number' && Number.isFinite(rel[k])) s.relationships[k] = clampTrust(rel[k]);
  const f = d.flags && typeof d.flags === 'object' ? d.flags : {};
  for (const k of ['lockerLooted', 'lockerScrap', 'shutterHeld', 'wing1Done']) if (typeof f[k] === 'boolean') s.flags[k] = f[k];
  if (['lockdown', 'lure', 'charge', 'silence'].includes(f.outbreakPlan)) s.flags.outbreakPlan = f.outbreakPlan;
  if (typeof f.rayAlive === 'boolean') s.flags.rayAlive = f.rayAlive;
  if (['saved', 'overrun', 'injured', 'lost'].includes(f.rayFate)) s.flags.rayFate = f.rayFate;
  if (Number.isInteger(f.silenceCount) && f.silenceCount >= 0) s.flags.silenceCount = Math.min(f.silenceCount, 99);
  if (Array.isArray(d.choices)) {
    for (const c of d.choices.slice(0, 32)) {
      if (!c || typeof c !== 'object' || !CHOICES[c.id]) continue;
      const delta = {};
      if (c.delta && typeof c.delta === 'object') for (const k of SURVIVORS) if (Number.isInteger(c.delta[k]) && c.delta[k]) delta[k] = Math.max(-10, Math.min(10, c.delta[k]));
      s.choices.push({ id: c.id, prompt: text(c.prompt), pick: text(c.pick, 16), label: text(c.label), at: Number.isFinite(c.at) ? c.at : 0, delta });
    }
  }
  return s;
}

export function loadStory(storage = globalThis.localStorage) {
  try { return sanitizeStory(JSON.parse(storage.getItem(STORY_KEY))); } catch { /* missing or corrupt */ }
  return newStory();
}

export function writeStory(story, storage = globalThis.localStorage) {
  try { storage.setItem(STORY_KEY, JSON.stringify(story)); } catch { /* storage unavailable */ }
}

// ---------- applying a choice ----------

// The option a pick means (silence for "...", a timeout, or anything unrecognised).
export function resolveOption(choiceId, pick) {
  const c = CHOICES[choiceId];
  if (!c) return null;
  if (isSilence(pick)) return c.silence;
  return c.options.find((o) => o.pick === pick) || c.silence;
}

// Make a decision: updates trust, flags and the log, and returns what the game should show
// and do: { option, toasts, effects, silence }. Choosing again (a replay) replaces the old
// decision. A timeout is a manual "..." by another road: same call, same result.
export function applyChoice(story, choiceId, pick, at = Date.now()) {
  const c = CHOICES[choiceId];
  if (!c) return null;
  const option = resolveOption(choiceId, pick);
  forgetChoice(story, choiceId);
  const delta = {};
  for (const [k, v] of Object.entries(option.rel || {})) { const before = story.relationships[k]; story.relationships[k] = clampTrust(before + v); delta[k] = story.relationships[k] - before; }
  Object.assign(story.flags, option.flags || {});
  const silence = option === c.silence;
  if (silence) story.flags.silenceCount++;
  story.choices.push({ id: choiceId, prompt: c.prompt, pick: option.pick, label: option.label === '...' ? 'You said nothing.' : option.label, at, delta, silence });
  return { option, toasts: [...option.toasts], effects: [...option.effects], silence };
}

// Undo a previous answer to this choice (its trust changes and flags) so a replay starts clean.
function forgetChoice(story, choiceId) {
  const i = story.choices.findIndex((x) => x.id === choiceId);
  if (i < 0) return;
  const old = story.choices[i];
  for (const k of SURVIVORS) if (old.delta && old.delta[k]) story.relationships[k] = clampTrust(story.relationships[k] - old.delta[k]);
  if (old.silence) story.flags.silenceCount = Math.max(0, story.flags.silenceCount - 1);
  story.choices.splice(i, 1);
  if (choiceId === 'outbreak') story.flags.outbreakPlan = null;
  if (choiceId === 'rayLocker') Object.assign(story.flags, { rayAlive: null, rayFate: null, lockerLooted: false, lockerScrap: false, shutterHeld: false });
}

// Starting Wing 1 over: forget everything it decided.
export function resetWing1(story) {
  for (const id of Object.keys(CHOICES)) forgetChoice(story, id);
  story.flags.wing1Done = false;
  return story;
}

export function lastChoice(story, id) { return story.choices.find((c) => c.id === id) || null; }

// ---------- consequences the game reads ----------

// The Food Court's opening, from Scene 1.
//   enemyKeep: share of the starting monsters that are still around
//   spawnRate: multiplies how fast the spawners (shutters, vents, escalators) work
//   wave: an extra opening horde near the start
//   bonus: which reward set from level.bonus to place
export function foodCourtModifiers(story) {
  const plan = (story && story.flags.outbreakPlan) || 'none';
  switch (plan) {
    case 'lockdown': return { plan, enemyKeep: 0.6, spawnRate: 0.75, wave: null, bonus: 'lockdown', lockShutter: true, line: { who: 'mallCop', text: 'Gates are sealed. Stay tight.' } };
    case 'lure': return { plan, enemyKeep: 0.4, spawnRate: 0.9, wave: null, bonus: null, lockShutter: false, pa: true, line: { who: 'mallGoth', text: "They're chewing on the PA. Move!" } };
    case 'charge': return { plan, enemyKeep: 1, spawnRate: 1.25, wave: { walker: 7, sprinter: 3, brute: 1 }, bonus: 'charge', lockShutter: false, line: { who: 'biker', text: "I said we go THROUGH 'em!" } };
    case 'silence': return { plan, enemyKeep: 0.9, spawnRate: 1, wave: { walker: 4, sprinter: 2 }, bonus: null, lockShutter: false, line: { who: 'mallCop', text: '...Okay. Nobody had a plan. Great.' } };
    default: return { plan: 'none', enemyKeep: 1, spawnRate: 1, wave: null, bonus: null, lockShutter: false, line: null };
  }
}

// What the mid-wing crisis does to the level the moment it resolves.
//   ray: his fate; heavy: the damage boost for the rest of the wing and the boss
//   ambush: a hostile wave; cache: which locker reward to place; pocketSurge: the besiegers overrun the pocket
export function crisisModifiers(story) {
  const f = story ? story.flags : {};
  switch (f.rayFate) {
    case 'saved': return { ray: 'saved', rayAlly: true, heavy: 0, ambush: null, cache: null, sealLocker: true, pocketSurge: false };
    case 'overrun': return { ray: 'overrun', rayAlly: false, heavy: 0.35, ambush: null, cache: 'cache', sealLocker: false, pocketSurge: true };
    case 'injured': return { ray: 'injured', rayAlly: true, heavy: 0.08, ambush: { sprinter: 6 }, cache: 'scrap', sealLocker: true, pocketSurge: false };
    case 'lost': return { ray: 'lost', rayAlly: false, heavy: 0.04, ambush: { sprinter: 8, brute: 1 }, cache: 'scrap', sealLocker: true, pocketSurge: true };
    default: return { ray: null, rayAlly: false, heavy: 0, ambush: null, cache: null, sealLocker: false, pocketSurge: false };
  }
}

// The Butcher fight.
//   rayHeals: Ray tosses pizza (every `rayEvery` seconds); dmgMul: the heavy-gear boost
//   tone: what the intro leans on
export function bossModifiers(story) {
  const f = story ? story.flags : {};
  const crisis = crisisModifiers(story);
  let tone = 'bleak';
  if (f.rayFate === 'saved') tone = 'hopeful';
  else if (f.lockerLooted) tone = 'guilt';
  else if (f.rayFate === 'injured') tone = 'strained';
  return { rayHeals: f.rayFate === 'saved', rayEvery: 14, dmgMul: 1 + crisis.heavy, tone, rayPresent: f.rayFate === 'saved' };
}

// Is Ray in the Security Room afterwards? (Saved or injured: yes. Overrun or lost: his nametag stays on an empty locker.)
export function hubRayPresent(story) { return !!(story && story.flags.rayAlive === true); }

export function hubRayLabel(story) {
  if (hubRayPresent(story)) return story.flags.rayFate === 'injured' ? 'RAY (bandaged, still cooking)' : 'RAY (the Food Court cook)';
  if (story && story.flags.rayAlive === false) return 'RAY: empty locker, name tag still on the door';
  return '';
}

export function trust(story, who) { return story.relationships[who] || 0; }

// Who feels what about it: the strongest feelings first, for the toast and the recap.
export function remembers(story) {
  return SURVIVORS
    .map((id) => ({ id, name: SURVIVOR_NAMES[id], score: story.relationships[id] }))
    .filter((r) => r.score !== 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

// ---------- the "Your Choices" recap ----------

export function recap(story) {
  const rows = story.choices.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    label: c.label,
    silence: !!c.silence,
    notes: Object.entries(c.delta || {}).filter(([, v]) => v).map(([k, v]) => `${SURVIVOR_NAMES[k]} ${v > 0 ? 'respects' : 'resents'} this`),
  }));
  const f = story.flags;
  const fate = {
    saved: 'Ray is alive and hanging around the Security Room.',
    injured: 'Ray lived, but he is hurt. He is bandaged up in the Security Room.',
    overrun: 'Ray was overrun. Only his name tag is left on an empty locker.',
    lost: 'Ray never made it. Nobody wants to talk about why.',
  }[f.rayFate] || '';
  return {
    title: 'YOUR CHOICES',
    sub: 'Wing 1: Food Court',
    rows,
    rayFate: fate,
    standings: remembers(story).map((r) => `${r.name}: ${r.score > 0 ? '+' : ''}${r.score}`),
    hook: 'Next: Arcade, Bowling & Batting Cages',
  };
}
