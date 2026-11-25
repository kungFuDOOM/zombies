// Game-wide constants and data tables.

export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 640;
export const HUD_H = 0; // HUD panels sit in the corners over the 3D view
// Size of the world area (in sim units) the 3D camera shows; used for the party leash,
// potion range and camera clamping.
export const WORLD_VIEW_W = 680;
export const WORLD_VIEW_H = 470;
export const MAX_PLAYERS = 4;

// Health drains by this much per second, just like the arcade original.
export const HEALTH_DRAIN = 1;
export const FOOD_HEAL = 100;

export const CLASSES = {
  biker: {
    short: 'BIK', name: 'Biker', color: '#e0402a', dark: '#6a140c', accent: '#f2c14e',
    hp: 1100, speed: 105, strength: 30, armor: 0.2, magic: 1.0,
    shotDmg: 10, shotSpeed: 330, shotCooldown: 0.45, shot: 'wrench', turbo: 'revcharge',
    blurb: 'Chainsaw tank. Hates stairs. Turbo: rev-charge.',
  },
  mallCop: {
    short: 'COP', name: 'Mall Cop', color: '#3a78d8', dark: '#17387a', accent: '#f0f0f8',
    hp: 850, speed: 125, strength: 15, armor: 0.22, magic: 1.1,
    shotDmg: 7, shotSpeed: 520, shotCooldown: 0.55, shot: 'pellet', turbo: 'riot', pellets: 5, spread: 0.5, shotLife: 0.55, knockback: 14,
    blurb: 'By-the-book shotgun. Turbo: riot blast.',
  },
  skater: {
    short: 'SK8', name: 'Skater', color: '#38c870', dark: '#146a3a', accent: '#ff5ad0',
    hp: 750, speed: 160, strength: 18, armor: 0.08, magic: 1.0,
    shotDmg: 7, shotSpeed: 480, shotCooldown: 0.22, shot: 'deck', turbo: 'kickflip',
    blurb: 'Spiked bat, fastest. Turbo: kickflip dash.',
  },
  mallGoth: {
    short: 'GTH', name: 'Mall Goth', color: '#b040e0', dark: '#4a126a', accent: '#40e0ff',
    hp: 800, speed: 128, strength: 11, armor: 0.08, magic: 1.6,
    shotDmg: 5, shotSpeed: 300, shotCooldown: 0.14, shot: 'spray', turbo: 'boombox', pierce: 2, shotLife: 0.42,
    blurb: 'Dark, flammable. Turbo: boombox shockwave.',
  },
};
export const BASE_CLASSES = ['biker', 'mallCop', 'skater', 'mallGoth'];
export const CLASS_ORDER = [...BASE_CLASSES];

// Food Court monsters. ai: melee (knock: shove the hero back, atkCd: time between blows),
// charger (crouches, then lunges), lobber (lob: what it throws), death.
export const ENEMIES = {
  walker:   { name: 'Mall Walker',           hp: 18, speed: 52,  dmg: 10, r: 11, xp: 6,  score: 15, ai: 'melee',   color: '#8aa070', atkCd: 0.9 },
  sprinter: { name: 'Food-Court Sprinter',   hp: 12, speed: 104, dmg: 11, r: 10, xp: 8,  score: 25, ai: 'charger', color: '#d0803a' },
  brute:    { name: 'Security Brute',        hp: 70, speed: 50,  dmg: 22, r: 15, xp: 18, score: 60, ai: 'melee',   color: '#2a4a8a', atkCd: 1.2, knock: 20 },
  spitter:  { name: 'Toxic Spill Spitter',   hp: 16, speed: 62,  dmg: 12, r: 11, xp: 10, score: 35, ai: 'lobber',  color: '#80e030', range: 280, cooldown: 2.2, lob: 'flask' },
  death:    { name: 'The Grim Shopper',      hp: 1,  speed: 74,  dmg: 25, r: 13, xp: 60, score: 1000, ai: 'death', color: '#1a1a22', immune: true },
};

export const LOBBED = new Set(['lob', 'bomb', 'flask', 'meteor', 'quake']); // enemy attacks that land on a marked spot
// how far each of those (and a poison pool) reaches when it lands
export const BLAST = { lob: 28, bomb: 40, flask: 30, meteor: 46, quake: 60, pool: 36 };

export const GENERATOR_HP = 45; // three tiers of 15
export const MAX_ENEMIES = 110;

export const POWERUPS = {
  speed:     { name: 'Fresh Sneakers',   color: '#4ad9d9', dur: 20 },
  rapid:     { name: 'Energy Drink',     color: '#ff9a3a', dur: 20 },
  shield:    { name: 'Riot Vest',        color: '#ffffff', dur: 12 },  // invulnerable
  triple:    { name: 'Triple Shot',      color: '#d94ad9', dur: 20 },
  reflect:   { name: 'Ricochet Rounds',  color: '#8ad0ff', dur: 20 },  // shots bounce off walls
  super:     { name: 'Super Shot',       color: '#ffe040', dur: 15 },  // huge piercing shots
  fire:      { name: 'Hairspray Torch',  color: '#ff5a20', dur: 15 },  // every attack breathes fire
  invisible: { name: 'Hoodie Stealth',   color: '#b0b8c8', dur: 15 },  // zombies lose track of you
  levitate:  { name: 'Hover Heels',      color: '#a0ffb0', dur: 20 },
  xray:      { name: 'Mall Map',         color: '#40ff80', dur: 30 },
  phoenix:   { name: 'Firework Buddy',   color: '#ff7020', dur: 25 },  // a fiery familiar fights beside you
  lightning: { name: 'Tesla Cart',       color: '#a0e0ff', dur: 15 },  // attacks arc to nearby foes
  grow:      { name: 'Mega Soda',        color: '#80ff40', dur: 20 },  // giant-sized: hit harder, take less
  antideath: { name: 'Reaper Ward',      color: '#fff080', dur: 30 },
};
export const POWERUP_ORDER = ['speed', 'rapid', 'shield', 'triple', 'reflect', 'super', 'fire', 'lightning', 'grow', 'phoenix'];

export const TURBO_COST = 35;
export const MAX_KEYS = 9;
export const MAX_POTIONS = 9;
export const MAX_ARMOR = 0.65;
// The fastest a hero gets from levels and Speed upgrades: a third faster than they started
// (and never past 210), so a high-level hero is quick without being uncontrollable.
// Starting run speed is boosted +10% (slowest class) to +15% (fastest class), scaled by the class's speed stat.
// The top end is deliberately small: the fast classes already start close to their cap, and Speed upgrades
// plus the Speed Boots power-up stack on top of that.
export const START_SPEED_BOOST_MIN = 0.10;
export const START_SPEED_BOOST_MAX = 0.15;
// Absolute ceilings so the quickest classes can't snowball. Neither touches the slow/mid classes:
// UPGRADE_SPEED_CAP only bites above a base speed of 144 (195 / 1.35), SPEED_BOOTS_PEAK_CAP above ~160 upgraded speed.
export const UPGRADE_SPEED_CAP = 195;      // was 210: the most run speed levels + Speed upgrades can give
export const SPEED_BOOTS_MULT = 1.5;       // Speed Boots power-up multiplier (unchanged)
export const SPEED_BOOTS_PEAK_CAP = 240;   // hard ceiling on run speed even with boots (was uncapped: up to 315)
export function startSpeed(def) {
  const speeds = Object.values(CLASSES).map(c => c.speed);
  const lo = Math.min(...speeds), hi = Math.max(...speeds);
  const t = hi > lo ? (def.speed - lo) / (hi - lo) : 0.5;
  return def.speed * (1 + START_SPEED_BOOST_MIN + t * (START_SPEED_BOOST_MAX - START_SPEED_BOOST_MIN));
}
export function maxSpeed(def) { return Math.round(Math.min(def.speed * 1.35, UPGRADE_SPEED_CAP)); }

// Points. Everything a hero scores on a stage is worth more the deeper the stage (x1 on the
// first, x2.5 on the last), and half on a stage the quest has already cleared, so pushing on
// beats farming. Clearing a stage pays a bonus: a flat amount, time under par, and no deaths.
export const REPLAY_POINTS = 0.5;
export const STAGE_BONUS = { clear: 500, boss: 2000, par: 300, bossPar: 180, perSecond: 5, flawless: 1000 };
export function stagePoints(n) { return Math.round(100 + Math.max(0, Math.min(n, 16) - 1) * 10) / 100; }

// How tough a level is. Monsters grow with the stage (1-16) and the party's size; rewards
// grow with the realm. Every stage is a step harder than the last, from a first stage that
// already asks for some care.
//
// Heroes level up as they go, so each stage expects heroes of about a certain level
// (expectedLevel). A party ahead of that, say from replaying stages, meets monsters that
// make up 40% of the difference: if the extra levels make the heroes hit 30% harder, the
// monsters get 12% more health (and likewise their damage against the heroes' extra health
// and armour). Leveling up still makes a stage easier, just not trivial. A party behind the
// usual level gets some relief the same way.
export function difficulty(n, players = 1, partyLevel = null) {
  const k = Math.max(0, n - 1);
  const extra = Math.max(0, Math.min(players, 4) - 1);
  const realm = Math.floor(k / 4);
  const gap = partyLevel == null ? 0 : partyLevel - expectedLevel(n);
  const usual = expectedLevel(n), lvl = usual + Math.max(-4, Math.min(gap, 15));
  // how much harder heroes hit (strength) and how much more they can take (health, armour)
  const power = (L) => 1 + 0.115 * (L - 1), toughness = (L) => 1 + 0.06 * (L - 1);
  const lead = 1 + 0.4 * (power(lvl) / power(usual) - 1);
  return {
    hp: (1.12 + 0.075 * k) * (1 + 0.3 * extra) * lead,
    dmg: (1.05 + 0.05 * k) * (1 + 0.4 * (toughness(lvl) / toughness(usual) - 1)),
    spawn: (1.08 + 0.055 * k) * (1 + 0.22 * extra),
    localCap: 8 + Math.floor(k / 3) + 2 * extra,
    gold: 1 + 0.3 * realm,
    xp: 1 + 0.1 * k,
    gap,
    lead, // the part of the health from the party's level (guardians use it)
  };
}

// The hero level a party usually has on reaching stage n, from the experience the stages
// before it give (an estimate: about 600 xp from the first stage, rising with each one).
export function expectedLevel(n) {
  let xp = 0;
  for (let i = 1; i < n; i++) xp += (450 + 120 * i) * (1 + 0.1 * (i - 1));
  let lvl = 1;
  while (xp >= xpForLevel(lvl)) { xp -= xpForLevel(lvl); lvl++; }
  return lvl;
}

export function xpForLevel(lvl) {
  return Math.round(80 * Math.pow(lvl, 1.35));
}
