// The campaign: six mall wings, the cash upgrade counter, saved survivors and the story text.
// Pure data + functions (localStorage access is wrapped), so it can be unit tested.

import { MAX_POTIONS, MAX_ARMOR, maxSpeed, BASE_CLASSES } from './config.js';
import { newStory, loadStory } from './story.js';

export const REALMS = 6;   // wings of the mall
export const STAGES = 2;   // each wing: the stage itself, then its boss

const SAVE_KEY = 'motd-save';

export const levelNumber = (realm, stage) => realm * STAGES + stage; // stage is 1-based
export const realmOf = (n) => Math.floor((n - 1) / STAGES);
export const stageOf = (n) => ((n - 1) % STAGES) + 1;

export function newSave() {
  return { progress: { completed: {}, seenIntro: false, seenRealm: {}, won: false, wing1Done: false }, heroes: {}, story: newStory() };
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const d = JSON.parse(storage.getItem(SAVE_KEY));
    if (d && d.progress && d.heroes) {
      const base = newSave();
      // the story lives on the save and in its own key (motd-story); the save's copy wins when both exist
      const story = d.story ? loadStory({ getItem: () => JSON.stringify(d.story) }) : loadStory(storage);
      return { ...base, ...d, progress: { ...base.progress, ...d.progress }, story };
    }
  } catch { /* missing or corrupt */ }
  return { ...newSave(), story: loadStory(storage) };
}

export function writeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}

export function hasProgress(save) {
  return Object.keys(save.progress.completed).length > 0 || Object.keys(save.heroes).length > 0 || save.story.choices.length > 0;
}

// Only Wing 1 (the Food Court) can be entered in this slice; wings 2-6 are on the directory but locked.
export function wingOpen(realm) { return realm === 0; }

export function isUnlocked(progress, realm, stage) {
  if (!wingOpen(realm)) return false;
  return stage === 1 || !!progress.completed[levelNumber(realm, stage - 1)];
}

// Record a finished level.
export function completeLevel(progress, n) {
  progress.completed[n] = true;
  if (n === levelNumber(0, STAGES)) progress.wing1Done = true;
}

// The first unfinished stage that's open, for placing the map cursor.
export function nextStage(progress) {
  for (let s = 1; s <= STAGES; s++) if (isUnlocked(progress, 0, s) && !progress.completed[levelNumber(0, s)]) return { realm: 0, stage: s };
  return { realm: 0, stage: 1 };
}

// The four survivors are available from the start: there are no secret heroes.
export function unlockedClasses() {
  return [...BASE_CLASSES];
}

// ---------- shop ----------

export const SHOP = [
  { id: 'food', name: 'Pizza Slice', desc: '+250 health', price: 100 },
  { id: 'soda', name: 'Jumbo Soda', desc: '+400 health', price: 160 },
  { id: 'potion', name: 'Flashbang', desc: 'Stuns and blasts every zombie on screen', price: 250 },
  { id: 'strength', name: 'Weapon Mods', desc: 'Hit harder', price: 500, stat: true },
  { id: 'armor', name: 'Armor Padding', desc: 'Take less damage', price: 500, stat: true },
  { id: 'speed', name: 'Fresh Kicks', desc: 'Run faster', price: 400, stat: true },
  { id: 'magic', name: 'Flash Charge', desc: 'Stronger flashbangs', price: 400, stat: true },
  { id: 'done', name: 'Done', desc: 'Back to the Security Room', price: 0 },
];

// Nothing more to gain from buying this (full up, or the stat is at its cap).
export function maxed(p, item) {
  switch (item.id) {
    case 'potion': return p.potions >= MAX_POTIONS;
    case 'armor': return p.armor >= MAX_ARMOR - 1e-9;
    case 'speed': return p.speed >= maxSpeed(p.def);
    default: return false;
  }
}

// Stat upgrades get pricier each time you buy the same one.
export function priceOf(p, item) {
  if (!item.stat) return item.price;
  const n = (p.upgrades && p.upgrades[item.id]) || 0;
  return Math.round(item.price * (1 + n * 0.5));
}

export function buy(p, item) {
  if (item.id === 'done') return false;
  const cost = priceOf(p, item);
  if (p.gold < cost || maxed(p, item)) return false;
  p.gold -= cost;
  switch (item.id) {
    case 'food': p.hp += 250; break;
    case 'potion': p.potions++; break;
    case 'soda': p.hp += 400; break;
    case 'strength': p.strength += 4; p.shotDmg += 1.5; break;
    case 'armor': p.armor = Math.min(MAX_ARMOR, p.armor + 0.04); break;
    case 'speed': p.speed = Math.min(maxSpeed(p.def), p.speed + 10); break;
    case 'magic': p.magic += 0.25; break;
  }
  if (item.stat) { p.upgrades = p.upgrades || {}; p.upgrades[item.id] = (p.upgrades[item.id] || 0) + 1; }
  return true;
}

// ---------- story text ----------

export const STORY = {
  intro: [
    'Black Friday, 1994. Brightwater Commons opens at six.',
    'At 4:59 AM, somebody opened it early.',
    'Four strangers. Six wings. One very polite voice on the PA.',
  ],
  realms: [
    ['WING 1: THE FOOD COURT. Fryer smoke, sticky tile, and a fountain full of drool.', "Porko's Carvery handed out free samples at four. Everybody who ate one is still in line, including someone you trust."],
  ],
  ending: [
    'Dale, the Deep-Fry Butcher, is off the clock. The fryers are cold. The Grease Main is not.',
    "The door log doesn't lie. The keycard was his.",
    'Pam has a list. One of you is on it.',
  ],
};

// What the mall directory says about each wing (see level.js WINGS).
export const NEXT_WING_HOOK = 'Next: Arcade, Bowling & Batting Cages';
