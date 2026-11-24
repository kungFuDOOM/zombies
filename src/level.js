// Level generation. Pure module (no DOM) so it can be unit tested in Node.
//
// Mall of the Dead is built wing by wing. Wing 1 (the Food Court) is hand-authored: a big
// neon plaza ringed by food stalls, a security corridor to start in, a pizza-counter pocket
// where Ray gets cornered, an armory locker and a barricaded exit. Every level yields a tile
// grid, "rooms" (open spaces used for placing things), spawners and a start/exit pair.

import { POWERUP_ORDER } from './config.js';

export const T = { WALL: 0, FLOOR: 1, DOOR: 2, EXIT: 3, SEALED: 4, LAVA: 5, VOID: 6, BRIDGE: 7, CRACKED: 8, SPIKES: 9 };
export const GROUND = { DEFAULT: 0, GRASS: 1 };

// The six wings of the mall. Only the Food Court is playable in this slice.
export const WINGS = [
  { id: 'food', name: 'Food Court', long: 'Wing 1: Food Court', boss: 'The Deep-Fry Butcher', open: true, tag: 'BLACK FRIDAY OUTBREAK' },
  { id: 'arcade', name: 'Arcade, Bowling & Batting Cages', long: 'Wing 2: Arcade, Bowling & Batting Cages', boss: null, open: false },
  { id: 'theater', name: 'Movie Theater', long: 'Wing 3: Movie Theater', boss: null, open: false },
  { id: 'gym', name: 'Fitness Center', long: 'Wing 4: Fitness Center / Gym', boss: null, open: false },
  { id: 'toys', name: 'Toy Store & Holiday Atrium', long: 'Wing 5: Toy Store & Holiday Atrium', boss: null, open: false },
  { id: 'hardware', name: 'Hardware & Garden Center', long: 'Wing 6: Hardware & Garden Center, then the Rooftop Helipad', boss: null, open: false },
];

export const THEMES = [
  { // Food Court: bright checkerboard tiles under magenta, cyan and gold neon
    name: 'Food Court', style: 'mall', stages: ['Food Court Plaza'],
    floorA: '#b4b49c', floorB: '#2c8f86', wallTop: '#c8368c', wallSide: '#4a3a78', rock: '#a07ad8', dark: 0.1, accent: '#ffcc33',
    void: '#080a10', sky: '#0c1210', fog: '#16241c', light: '#b8d4b4', ambient: 0.72, neonA: '#ff2ea6', neonB: '#2ee6ff', neonC: '#ffcc33',
  },
  { name: 'Arcade, Bowling & Batting Cages', style: 'mall', stages: ['Arcade'], floorA: '#2a2050', floorB: '#3a2a70', wallTop: '#5a3aa0', wallSide: '#2a1a60', rock: '#5a3aa0', dark: 0.3, accent: '#40ff90', void: '#08041a', sky: '#0a0620', fog: '#150a35', light: '#c0a0ff', ambient: 0.8, neonA: '#40ff90', neonB: '#ff40a0', neonC: '#40c0ff' },
  { name: 'Movie Theater', style: 'mall', stages: ['Theater'], floorA: '#5a1a20', floorB: '#6a2228', wallTop: '#a03040', wallSide: '#401018', rock: '#6a2228', dark: 0.4, accent: '#ffcc33', void: '#0a0406', sky: '#0a0406', fog: '#200a0e', light: '#ffd0c0', ambient: 0.7, neonA: '#ff3040', neonB: '#ffcc33', neonC: '#ffffff' },
  { name: 'Fitness Center', style: 'mall', stages: ['Gym'], floorA: '#2a4a5a', floorB: '#34586a', wallTop: '#60a0c0', wallSide: '#2a4a60', rock: '#34586a', dark: 0.25, accent: '#ff8a30', void: '#06101a', sky: '#06101a', fog: '#0c2030', light: '#e0f4ff', ambient: 0.9, neonA: '#ff8a30', neonB: '#40e0ff', neonC: '#ffffff' },
  { name: 'Toy Store & Holiday Atrium', style: 'mall', stages: ['Atrium'], floorA: '#f0e0e8', floorB: '#e8c0d0', wallTop: '#ff6a80', wallSide: '#40a060', rock: '#e8c0d0', dark: 0.1, accent: '#ff3040', void: '#10101a', sky: '#10101a', fog: '#2a1a30', light: '#fff0f0', ambient: 1.0, neonA: '#ff3040', neonB: '#30d060', neonC: '#ffe040' },
  { name: 'Hardware & Garden Center', style: 'mall', stages: ['Garden Center'], floorA: '#6a5a40', floorB: '#7a6a4a', wallTop: '#a08a60', wallSide: '#503a20', rock: '#7a6a4a', dark: 0.3, accent: '#ffa020', void: '#0a0804', sky: '#101820', fog: '#202830', light: '#fff0d0', ambient: 0.85, neonA: '#ffa020', neonB: '#60e060', neonC: '#ffffff' },
];

// Each level's own look layered over its wing's theme.
export const STAGE_LOOKS = {
  1: { // Food Court Plaza: warm neon on terrazzo
    particles: { type: 'motes', color: '#ffd0f0', count: 60 }, lantern: '#ff9ad8',
  },
  2: { // The Butcher's Kitchen: steel, steam and grease-fire orange
    name: "The Butcher's Kitchen", floorA: '#98a09a', floorB: '#5c665c', wallTop: '#d06a22', wallSide: '#3c4640', sky: '#100a08', fog: '#2a1610', light: '#e8c8a0', ambient: 0.74,
    neonA: '#ff7a1a', neonB: '#ffd040', neonC: '#ff2ea6', kitchen: true,
    particles: { type: 'sparks', color: '#ffa030', count: 50 }, lantern: '#ff8a30',
  },
};

export const BOSSES = [
  { name: 'The Deep-Fry Butcher', model: 'butcher', color: '#e8b890', horn: '#d8dde8', hp: 3200, speed: 66 },
];

export const LEVELS_PER_REALM = 2; // the stage, then the wing's boss

export function levelInfo(n) {
  const realm = Math.max(0, Math.floor((n - 1) / LEVELS_PER_REALM));
  const isBoss = n % LEVELS_PER_REALM === 0;
  const theme = { ...THEMES[realm % THEMES.length], ...(STAGE_LOOKS[isBoss ? 2 : 1] || {}) };
  const boss = BOSSES[Math.min(realm, BOSSES.length - 1)];
  return {
    realm,
    theme,
    style: 'mall',
    isBoss,
    stage: isBoss ? 2 : 1,
    stageName: isBoss ? "The Butcher's Kitchen" : WINGS[realm % WINGS.length].name === 'Food Court' ? 'Food Court' : theme.stages[0],
    boss,
  };
}

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Multi-source BFS over a tile grid. Returns Int32Array of distances (-1 = unreachable).
export function bfs(tiles, w, h, sources, passable, parents = null) {
  const dist = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (const [sx, sy] of sources) {
    const i = sy * w + sx;
    if (dist[i] === -1) { dist[i] = 0; queue[tail++] = i; if (parents) parents[i] = -1; }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j] !== -1 || !passable(tiles[j])) continue;
      dist[j] = dist[i] + 1;
      if (parents) parents[j] = i;
      queue[tail++] = j;
    }
  }
  return dist;
}

export const walkable = (t) => t === T.FLOOR || t === T.EXIT || t === T.BRIDGE || t === T.SPIKES;
export const walkableOrDoor = (t) => walkable(t) || t === T.DOOR;


// Which monsters live where, per wing (weights = how common each is).
export const ROSTERS = [
  [['walker', 6], ['sprinter', 3], ['spitter', 2], ['brute', 1]],
];

export function enemyWeights(n) {
  return ROSTERS[Math.min(ROSTERS.length - 1, Math.max(0, Math.floor((n - 1) / LEVELS_PER_REALM)))];
}

function pickWeighted(R, list) {
  const total = list.reduce((s, [, wt]) => s + wt, 0);
  let r = R() * total;
  for (const [k, wt] of list) { if ((r -= wt) < 0) return k; }
  return list[list.length - 1][0];
}

export function generateLevel(n, seed = n * 7919 + 13) {
  const info = levelInfo(n);
  return info.isBoss ? generateBossLevel(n, seed, info) : generateFoodCourt(n, seed, info);
}

// ---------- shared helpers for layouts ----------

function grid(w, h, fill) {
  const tiles = new Uint8Array(w * h);
  if (fill) tiles.fill(fill);
  return tiles;
}

// Carve a filled disc of `tile` (only over cells matching `over`, if given).
function disc(tiles, w, h, cx, cy, r, tile, over = null, R = null) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
      const jitter = R ? (R() - 0.5) * r * 0.6 : 0;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2 + jitter * r) continue;
      const i = y * w + x;
      if (over === null || over.includes(tiles[i])) tiles[i] = tile;
    }
}

// A wandering path from a to b, carved with a round brush. Returns the visited centre cells.


// ---------- Wing 1: the Food Court ----------

// Key spots in the plaza, in tiles. Game logic (scene triggers, Ray, the locker) reads these.
export const FOOD_COURT = {
  w: 72, h: 48,
  start: { x: 5, y: 23 },
  shutter: { x: 11, y0: 21, y1: 26 },       // the security gate between the corridor and the plaza
  sceneTrigger: 36,                          // crossing this column starts the mid-wing crisis
  ray: { x: 53, y: 38 },                     // Ray, cornered behind the pizza counter
  locker: { x0: 14, y0: 39, x1: 22, y1: 42, door: { x0: 17, x1: 19, y: 38 } },
  exit: { x: 67, y: 23 },
};

function generateFoodCourt(n, seed, info) {
  const R = makeRng(seed);
  const { w, h } = FOOD_COURT;
  const tiles = grid(w, h, T.WALL);
  const ground = grid(w, h, 0);
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y * w + x] = t; };
  rect(3, 21, 10, 26, T.FLOOR);   // security corridor
  rect(11, 21, 11, 26, T.FLOOR);  // the gate
  rect(12, 6, 62, 42, T.FLOOR);   // the plaza
  rect(63, 20, 68, 26, T.FLOOR);  // the barricaded escalator hall
  // stalls along the north wall (their neon signs are drawn by the renderer)
  const stalls = [
    { name: 'BURGERS', x0: 15, x1: 23, color: '#ff2ea6' },
    { name: 'TACO', x0: 30, x1: 38, color: '#ffcc33' },
    { name: 'SMOOTHIES', x0: 45, x1: 53, color: '#2ee6ff' },
  ];
  for (const s of stalls) { rect(s.x0, 6, s.x1, 8, T.WALL); s.y0 = 6; s.y1 = 8; }
  // the pizza stall, with its counter and the pocket Ray hides in
  rect(46, 39, 60, 42, T.WALL);
  rect(49, 37, 57, 37, T.WALL);
  stalls.push({ name: 'PIZZA', x0: 46, x1: 60, y0: 39, y1: 42, color: '#ff5a2a', south: true });
  // the armory locker (sealed with a shutter by the mid-wing crisis)
  const L = FOOD_COURT.locker;
  rect(L.x0 - 1, L.y0 - 1, L.x1 + 1, 43, T.WALL);
  rect(L.x0, L.y0, L.x1, L.y1, T.FLOOR);
  rect(L.door.x0, L.door.y, L.door.x1, L.door.y, T.FLOOR);
  // overturned tables and palm planters: solid, but drawn as furniture, not wall
  const tables = [
    [22, 14, 2, 1], [28, 18, 1, 2], [33, 13, 2, 1], [40, 17, 2, 1], [44, 24, 1, 2], [26, 29, 2, 1], [34, 32, 2, 1],
    [41, 34, 1, 2], [31, 24, 2, 1], [52, 28, 2, 1], [57, 18, 1, 2], [48, 13, 2, 1], [20, 24, 1, 2], [57, 31, 2, 1],
  ].map(([x, y, tw, th]) => ({ x, y, w: tw, h: th }));
  for (const t of tables) rect(t.x, t.y, t.x + t.w - 1, t.y + t.h - 1, T.WALL);
  const palms = [[14, 11], [14, 35], [60, 11], [60, 35], [37, 21], [37, 28], [24, 22], [24, 27], [50, 22], [50, 27]].map(([x, y]) => ({ x, y }));
  for (const p of palms) tiles[p.y * w + p.x] = T.WALL;
  const decoTiles = [];
  for (const t of tables) for (let yy = 0; yy < t.h; yy++) for (let xx = 0; xx < t.w; xx++) decoTiles.push((t.y + yy) * w + t.x + xx);
  for (const p of palms) decoTiles.push(p.y * w + p.x);
  const lowCounters = [{ x0: 49, y0: 37, x1: 57, y1: 37, color: '#ff5a2a' }];
  for (const c of lowCounters) for (let x = c.x0; x <= c.x1; x++) decoTiles.push(c.y0 * w + x);
  // a patch of terrazzo mosaic in the middle
  for (let y = 18; y <= 29; y++) for (let x = 28; x <= 46; x++) ground[y * w + x] = 1;

  const start = FOOD_COURT.start;
  const exit = FOOD_COURT.exit;
  tiles[exit.y * w + exit.x] = T.EXIT;

  const occupied = new Set();
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) occupied.add((start.y + dy) * w + start.x + dx);
  const cells = [];
  for (let y = 7; y <= 41; y++) for (let x = 13; x <= 61; x++) {
    const i = y * w + x;
    if (tiles[i] === T.FLOOR && !(y >= 37 && x >= 46 && x <= 60) && !(y >= 38 && x >= 13 && x <= 23)) cells.push(i);
  }
  const take = (pred = () => true) => {
    for (let tries = 0; tries < 400; tries++) {
      const c = cells[Math.floor(R() * cells.length)];
      if (occupied.has(c) || !pred(c % w, (c / w) | 0)) continue;
      occupied.add(c);
      return c;
    }
    return null;
  };
  const farFromStart = (x, y) => Math.abs(x - start.x) + Math.abs(y - start.y) > 14;
  const items = [];
  const put = (type, c, sub) => { if (c != null) items.push({ type, x: c % w, y: (c / w) | 0, sub }); };
  for (let k = 0; k < 9; k++) put('food', take(), k % 3 === 2 ? 'soda' : R() < 0.5 ? 'pizza' : 'soda');
  put('food', take((x, y) => x < 20 && y > 18 && y < 30), 'pizza');
  for (let k = 0; k < 24; k++) put('gold', take());
  for (let k = 0; k < 12; k++) put('propane', take((x, y) => farFromStart(x, y)));
  for (let k = 0; k < 4; k++) put('potion', take(farFromStart));
  for (let k = 0; k < 4; k++) put('amulet', take(farFromStart), POWERUP_ORDER[Math.floor(R() * POWERUP_ORDER.length)]);
  for (let k = 0; k < 3; k++) put('gem', take(farFromStart));
  // the pocket behind the pizza counter has a little food, if Ray's rescuers get there
  put('food', 38 * w + 55, 'pizza');
  for (let i = 0; i < items.length; i++) tiles[items[i].y * w + items[i].x] = T.FLOOR;

  // spawners: shattered shutters, busted vents and barricaded escalators
  const weights = enemyWeights(n);
  const generators = [];
  const styles = ['shutter', 'vent', 'escalator'];
  const GEN_COUNT = 11;
  for (let k = 0; k < GEN_COUNT; k++) {
    const c = take((x, y) => Math.abs(x - start.x) > 14 && !generators.some((g) => Math.abs(g.x - x) + Math.abs(g.y - y) < 9));
    if (c == null) continue;
    generators.push({ type: pickWeighted(R, weights), x: c % w, y: (c / w) | 0, style: styles[k % 3] });
  }
  const enemies = [];
  for (let k = 0; k < 30; k++) {
    const c = take((x, y) => x > 20 && Math.abs(x - start.x) + Math.abs(y - start.y) > 22);
    if (c != null) enemies.push({ type: pickWeighted(R, weights), x: c % w, y: (c / w) | 0 });
  }
  // the pocket's besiegers: only here so the crisis reads as a crisis (Ray is cornered)
  for (const [x, y] of [[50, 36], [56, 36], [46, 38], [59, 36]]) enemies.push({ type: 'walker', x, y, pocket: true });

  // rewards the opening choice can unlock (placed by Game from the story)
  const bonus = {
    lockdown: [{ type: 'armorcrate', x: 14, y: 22 }, { type: 'armorcrate', x: 14, y: 25 }, { type: 'food', x: 15, y: 23, sub: 'soda' }],
    charge: [29, 31, 33, 35, 38, 40].flatMap((x, i) => [{ type: 'gold', x, y: 21 + (i % 2) }, { type: 'gold', x, y: 25 + (i % 2) }]),
    cache: [{ type: 'amulet', x: 16, y: 40, sub: 'super' }, { type: 'amulet', x: 18, y: 41, sub: 'triple' }, { type: 'potion', x: 20, y: 40 }, { type: 'potion', x: 21, y: 41 }, { type: 'gem', x: 15, y: 41 }, { type: 'gem', x: 19, y: 40 }],
    scrap: [{ type: 'amulet', x: 18, y: 40, sub: 'rapid' }],
  };

  const rooms = [
    { cx: 7, cy: 23, size: 48 }, { cx: 37, cy: 24, size: 700 }, { cx: 18, cy: 40, size: 40 }, { cx: 53, cy: 38, size: 28 }, { cx: 65, cy: 23, size: 42 },
  ];
  return {
    n, w, h, tiles, ground, rooms, start, exit, items, generators, enemies, boss: null, info, doorSegs: 0,
    foodCourt: true, stalls, tables, palms, decoTiles, lowCounters, bonus,
    shutters: [
      { id: 'front', x: FOOD_COURT.shutter.x, y0: FOOD_COURT.shutter.y0, y1: FOOD_COURT.shutter.y1, vertical: true },
      { id: 'locker', x: L.door.x0, x1: L.door.x1, y: L.door.y, vertical: false },
    ],
  };
}

// ---------- the Security Room hub ----------

export const HUB_DIRECTORY = { x: 20, y: 4 };   // the Mall Directory kiosk
export const HUB_SHOP = { x: 5, y: 8 };          // the cash upgrade counter
export const HUB_RAY = { x: 22, y: 8 };          // where Ray hangs around, if he lived

export function generateHub(rayPresent = false) {
  const base = levelInfo(1);
  const info = { ...base, isBoss: false, hub: true, stageName: 'Security Room', stage: 0, theme: { ...base.theme, name: 'Safe room', floorA: '#d8d4e4', floorB: '#7c78a0', wallTop: '#5a3ab0', wallSide: '#2a2050', sky: '#0a0618', fog: '#140c2a', light: '#e8e0ff', ambient: 0.95, particles: { type: 'motes', color: '#80e0ff', count: 30 } } };
  const w = 30, h = 22;
  const tiles = grid(w, h, T.WALL);
  const ground = grid(w, h, 0);
  for (let y = 3; y <= h - 4; y++) for (let x = 3; x <= w - 4; x++) tiles[y * w + x] = T.FLOOR;
  // a console desk across the middle, with a gap at each end
  for (let x = 9; x <= 20; x++) tiles[11 * w + x] = T.WALL;
  const desk = { x0: 9, x1: 20, y: 11 };
  const items = [{ type: 'food', x: 7, y: 17, sub: 'pizza' }, { type: 'food', x: 23, y: 17, sub: 'soda' }];
  return {
    n: 0, w, h, tiles, ground, rooms: [{ cx: 15, cy: 12, size: 300 }], start: { x: 15, y: 16 }, exit: null,
    items, generators: [], enemies: [], boss: null, info, doorSegs: 0, hub: true, directory: HUB_DIRECTORY, shop: HUB_SHOP, ray: { ...HUB_RAY, present: !!rayPresent }, desk,
  };
}

// ---------- training grounds (the first-time tutorial) ----------

// A row of small rooms joined by gates. src/tutorial.js opens each gate once the lesson in
// the room before it is done; the gate out of the key room is a real locked door.
export const TUTORIAL_ROOMS = 8, TUTORIAL_PITCH = 12, TUTORIAL_MID = 6;
export const tutorialRoomX = (k) => k * TUTORIAL_PITCH + TUTORIAL_PITCH / 2; // centre column of room k

export function generateTutorial() {
  const base = levelInfo(1);
  const info = { ...base, isBoss: false, tutorial: true, stageName: 'Training Grounds', stage: 0, theme: { ...base.theme, name: 'Learn the ropes' } };
  const P = TUTORIAL_PITCH, M = TUTORIAL_MID;
  const w = TUTORIAL_ROOMS * P + 1, h = M * 2 + 1;
  const tiles = grid(w, h, T.WALL);
  const ground = grid(w, h, 0);
  for (let k = 0; k < TUTORIAL_ROOMS; k++) {
    for (let y = 1; y < h - 1; y++) for (let x = k * P + 1; x < (k + 1) * P; x++) tiles[y * w + x] = T.FLOOR;
    if (k > 0) for (let y = M - 1; y <= M + 1; y++) tiles[y * w + k * P] = T.DOOR; // gate into room k
  }
  for (let y = M - 2; y <= M + 2; y++) for (let x = (TUTORIAL_ROOMS - 1) * P + 3; x < TUTORIAL_ROOMS * P - 2; x++) ground[y * w + x] = GROUND.GRASS;
  const cx = tutorialRoomX;
  const start = { x: 2, y: M };
  const exit = { x: cx(TUTORIAL_ROOMS - 1) + 3, y: M };
  tiles[exit.y * w + exit.x] = T.EXIT;
  const items = [
    { type: 'gold', x: 5, y: 2 }, { type: 'gold', x: 9, y: M }, { type: 'gold', x: 5, y: h - 3 }, // 0: move
    { type: 'key', x: cx(3), y: 2 },                                                           // 3: keys
    { type: 'potion', x: cx(4) - 3, y: M },                                                    // 4: magic
    { type: 'food', x: cx(6) - 2, y: M - 2 }, { type: 'food', x: cx(6) + 2, y: M + 2 },        // 6: food
    { type: 'poison', x: cx(6) + 2, y: M - 2 },
  ];
  const rooms = [];
  for (let k = 0; k < TUTORIAL_ROOMS; k++) rooms.push({ cx: cx(k), cy: M, size: 110 });
  return { n: 0, w, h, tiles, ground, rooms, start, exit, items, generators: [], enemies: [], boss: null, info, doorSegs: 0, tutorial: true };
}


// ---------- boss arena: the Butcher's Kitchen ----------

function generateBossLevel(n, seed, info) {
  const R = makeRng(seed);
  const w = 48, h = 34;
  const tiles = grid(w, h, T.WALL);
  const ground = grid(w, h, 0);
  const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y * w + x] = t; };
  fill(3, 13, 10, 20, T.FLOOR);   // the loading dock
  fill(11, 16, 15, 17, T.FLOOR);
  fill(16, 3, 44, 30, T.FLOOR);   // the kitchen
  // steel prep counters
  const counters = [[21, 8, 3, 2], [21, 23, 3, 2], [35, 8, 3, 2], [35, 23, 3, 2], [28, 5, 2, 1], [28, 28, 2, 1]];
  for (const [x, y, cw, ch] of counters) fill(x, y, x + cw - 1, y + ch - 1, T.WALL);
  const exit = { x: 43, y: 16 };
  fill(42, 15, 44, 18, T.FLOOR);
  tiles[exit.y * w + exit.x] = T.SEALED;
  const items = [
    { type: 'food', x: 4, y: 14, sub: 'pizza' }, { type: 'food', x: 4, y: 18, sub: 'soda' }, { type: 'food', x: 8, y: 13, sub: 'pizza' },
    { type: 'potion', x: 8, y: 19 }, { type: 'potion', x: 5, y: 16 },
    { type: 'gold', x: 18, y: 10 }, { type: 'gold', x: 18, y: 25 }, { type: 'gem', x: 41, y: 16 },
    { type: 'propane', x: 26, y: 12 }, { type: 'propane', x: 26, y: 21 }, { type: 'propane', x: 32, y: 16 }, { type: 'propane', x: 38, y: 12 }, { type: 'propane', x: 38, y: 21 },
  ];
  if (R() < 0.8) items.push({ type: 'amulet', x: 6, y: 16, sub: POWERUP_ORDER[Math.floor(R() * POWERUP_ORDER.length)] });
  for (const it of items) tiles[it.y * w + it.x] = T.FLOOR;
  const rooms = [{ cx: 6, cy: 16, size: 56 }, { cx: 30, cy: 16, size: 800 }];
  return { n, w, h, tiles, ground, rooms, start: { x: 6, y: 16 }, exit, items, generators: [], enemies: [], boss: { x: 32, y: 16 }, info, doorSegs: 0, kitchen: true, counters };
}
