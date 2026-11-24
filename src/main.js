// Bootstrap + state machine:
//   title -> (intro story) -> survivor select -> Security Room hub (play) -> Mall Directory (realm)
//   realm -> cutscene (Scene 1) -> Food Court (play) -> cutscene (Scene 2) -> level clear
//   -> cutscene (Scene 3) -> the Butcher (play) -> recap ("Your Choices") -> hub

import { VIEW_W, VIEW_H, CLASSES, CLASS_ORDER, MAX_PLAYERS, stagePoints } from './config.js';
import { Input } from './input.js';
import { TouchControls } from './touch.js';
import { Tutorial, tutorialView } from './tutorial.js';
import { Game } from './game.js';
import { initAudio, sfx, toggleMute, toggleVoice, toggleMusic, playMusic, currentMusic, setMusicIntensity, setMusicPaused, say, stopVoice, audioTap } from './audio.js';
import { Host, Guest, showCode } from './net.js';
import { SnapshotWriter, SnapshotReader, playSound, cleanUi, cleanEvents, cleanGame } from './netstate.js';
import { Lobby } from './lobby.js';
import { Renderer3D } from './render3d.js';
import { loadAssets } from './assets.js';
import { startLineup, renderLineup, lineupActive } from './lineup.js';
import { titleButtonAt, drawGameOverlay, drawLoading, drawTitle, drawSelect, drawOverlay, drawStory, drawRealmPick, drawShop, drawRecords, recordsTapAt, titleRecordsAt, selectArrowAt, shopItemAt, wingAt, titleOnlineAt, setDevice, btn, titleShowcase, selectShowcase, storyShowcase, drawCutscene, drawRecap, drawStoryToasts, cutChoiceAt } from './hud.js';
import { unlockedClasses, loadSave, writeSave, newSave, hasProgress, isUnlocked, levelNumber, nextStage, completeLevel, SHOP, buy, STORY, wingOpen, REALMS } from './campaign.js';
import { levelInfo, WINGS } from './level.js';
import { applyChoice, resetWing1, writeStory, recap, hubRayPresent } from './story.js';
import { Cutscene } from './cutscenes.js';
import { trackFor } from './music-data.js';
import { phaseOf } from './bosses.js';
import { Stats } from './stats.js';
import { fetchTop, getName, getMine } from './leaderboard.js';
import { LbPrompt } from './lbprompt.js';

// Always load the newest version of the game after an update (see sw.js).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const stage = document.getElementById('stage');
const hudCanvas = document.getElementById('hud');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
hudCanvas.width = VIEW_W * DPR;
hudCanvas.height = VIEW_H * DPR;
const ctx = hudCanvas.getContext('2d');
ctx.scale(DPR, DPR);
let r3d;
try {
  r3d = new Renderer3D(document.getElementById('webgl'));
} catch (err) {
  stage.style.display = 'none';
  document.getElementById('error').style.display = 'block';
  throw err;
}
let showMinimap = false;
try {
  const saved = Number(localStorage.getItem('motd-pixels'));
  if (saved >= 0 && saved <= 2 && localStorage.getItem('motd-pixels') !== null) r3d.setPixelation(saved);
} catch { /* storage unavailable */ }

const input = new Input();
input.touch = new TouchControls({
  onFirstTouch: (handheld) => {
    initAudio(); // phones only allow sound to start from a touch
    const el = document.documentElement;
    // phones and tablets go fullscreen landscape; a touchscreen laptop stays as it is
    if (handheld && el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  },
  onMute: () => { initAudio(); toast = { text: toggleMute() ? 'Sound OFF' : 'Sound ON', t: 1.5, local: true }; },
});
// Taps and clicks on the screen itself (not the on-screen buttons), in game coordinates.
const taps = [];
window.addEventListener('pointerdown', (e) => {
  if (e.button > 0 || (e.target.closest && e.target.closest('.btn, #rotate, #lobby, #online-bar'))) return;
  const r = stage.getBoundingClientRect();
  if (!r.width) return;
  taps.push({ x: (e.clientX - r.left) * VIEW_W / r.width, y: (e.clientY - r.top) * VIEW_H / r.height });
}, true);
let game = null;
let state = 'loading';
let loadProgress = 0;
let loadError = null;
loadAssets((p) => (loadProgress = p)).then(() => { setState('title'); const q = new URLSearchParams(location.search); if (q.has('lineup')) startLineup(r3d, q.get('lineup') || 'all'); }).catch((err) => { loadError = err; console.error(err); });
let stateT = 0;
let slots = [];       // character select: { source, cls, ready }
let countdown = null;
let clearInfo = null;
let toast = null;
let tutorial = null;  // the Training Grounds lessons, while they're being played
let showControls = true; // the key-cap strip along the bottom (H toggles it)
try { showControls = localStorage.getItem('motd-controls') !== 'off'; } catch { /* storage unavailable */ }
let magicHint = { t: 20, shown: 0 }; // reminders that flashbangs exist
let cut = null;          // the Telltale-style cutscene being played (see cutscenes.js)
let cutDone = null;      // what to do when it ends
let storyToasts = [];    // "X will remember that." plaques, upper left
let titleControls = false; // the controls card on the title screen
let skipCutscenes = false; // test toggle: cutscenes make the documented default picks (see DESIGN.md)
try { skipCutscenes = localStorage.getItem('motd-skipcut') === 'on'; } catch { /* storage unavailable */ }

// lifetime stats and the leaderboard (see stats.js)
const stats = new Stats();
let recordsTab = 0; // page shown on the stats screen (0-2 local, 3 = the online leaderboard)

// The global (online) leaderboard: fetched when its page is opened or refreshed. Failing
// (offline, server down) only changes what that page says; nothing else depends on it.
let globalBoard = { status: 'loading', rows: [] };
let globalSeq = 0;
function loadGlobal() {
  const seq = ++globalSeq;
  globalBoard = { status: 'loading', rows: globalBoard.rows };
  fetchTop(10).then((rows) => { if (seq === globalSeq) globalBoard = { status: 'ok', rows }; })
    .catch(() => { if (seq === globalSeq) globalBoard = { status: 'error', rows: [] }; });
}
const isMineRow = (r) => { const n = getName().toLowerCase(); return getMine().includes(r.id) || (!!n && r.name.toLowerCase() === n); };

// The end of a run (game over, or the quest won) offers this device's own hero's score to the
// global leaderboard (see lbprompt.js): never an online partner's. Asked once per score.
const lbPrompt = new LbPrompt();
const offered = new Map(); // run id -> the score already offered (or skipped), so it isn't asked again
let offerPending = false;
function ownHeroes() {
  if (!game) return [];
  return game.allPlayers().filter((p) => (net && net.role === 'guest' ? p.source === net.me : !isNet(p.source)));
}
function maybeOffer() {
  offerPending = false;
  if (!game || (game.level && game.level.tutorial) || lbPrompt.isOpen) return;
  const c = stats.globalCandidate(ownHeroes());
  if (!c || c.score <= (offered.get(c.id) || 0)) return;
  offered.set(c.id, c.score);
  lbPrompt.open({ score: c.score, cls: c.cls, clsName: CLASSES[c.cls].name, level: c.level, won: state === 'recap' || c.won },
    input.lastDevice === 'pad' ? 'Gamepad: A to submit, B to skip' : '');
}
// the title screen shows the best run
const fmtPts = (n) => Math.round(n).toLocaleString('en-US');
function topScores() { return stats.top.map((r) => ({ name: CLASSES[r.cls].name, score: r.score, level: r.level })); }
// A finished run that made the leaderboard gets a mention on the title screen.
function announceRuns(placed) {
  if (!placed.length) return;
  const best = placed[0];
  toast = { text: `${CLASSES[best.cls].name}: #${best.rank} on the leaderboard with ${best.score.toLocaleString('en-US')} points!`, t: 4, local: true };
}

function setState(s) {
  if (window.__traceStates) console.log(`state ${state} -> ${s}`);
  if (s === 'title') { input.split = false; announceRuns(stats.endRuns()); } // a new party starts with one keyboard player
  if (s === 'stats' && recordsTab === 3) loadGlobal();
  if (s === 'gameover' || s === 'recap') offerPending = true;
  state = s; stateT = 0;
}

// A second player on the same keyboard joins with the 2 key: player 1 keeps WASD (and the
// touch controls) as 'kb1', the newcomer gets the arrow keys as 'kb2'. Returns true if the
// keyboard was split. `owners` are the slots or players holding input sources.
function splitKeyboard(owners) {
  const kbOwner = owners.find((o) => o && o.source === 'kb');
  if (input.split || !kbOwner || !input.key('Digit2')) return false;
  input.split = true;
  kbOwner.source = 'kb1';
  return true;
}

// Undo the split once only one keyboard player is left.
function unsplitKeyboard(owners) {
  if (!input.split) return;
  const kbOwners = owners.filter((o) => o && (o.source === 'kb1' || o.source === 'kb2'));
  if (kbOwners.length > 1) return;
  input.split = false;
  if (kbOwners[0]) kbOwners[0].source = 'kb';
}

function usedSources() { return slots.filter(Boolean).map((s) => s.source); }

function nextFreeClass(taken) {
  const pool = unlockedClasses(save.progress);
  return pool.find((c) => !taken.includes(c)) || pool[0];
}

// ---------- quest save ----------

let save = loadSave();
if (stats.foldOldRuns(save.heroes)) writeSave(save); // once: the board from before runs were quests
// Saves the quest and the heroes of the players on this machine (online guests' heroes are
// theirs for the session only, so they never overwrite the host's saved heroes).
function persist() {
  if (game) for (const p of game.allPlayers()) if (!isNet(p.source)) save.heroes[p.cls] = { ...game.heroSave(p), run: stats.runInfo(p) };
  writeSave(save);
}
let story = null;     // { lines, idx, t, next }
let shop = [];        // per player slot: { idx, done }

function showStory(lines, next) {
  story = { lines, idx: 0, t: 0, next };
  say(lines[0], `story${lines[0].length}`, 0);
  setState('story');
}

function updateStory(dt) {
  story.t += dt;
  const line = story.lines[story.idx];
  const shown = Math.floor(story.t * 45);
  const any = (b) => input.firstPressed(b) || (b === 'attack' && input.anyStart());
  if (anyBack()) { stopVoice(); story.next(); return; }
  if (any('attack')) {
    if (shown < line.length) { story.t = line.length / 45 + 0.01; return; }
    story.idx++;
    story.t = 0;
    if (story.idx >= story.lines.length) { story.next(); return; }
    say(story.lines[story.idx], `story${story.lines[story.idx].length}`, 0);
  }
}

// ---------- title ----------

// On the title screen almost any key starts (people try A, Enter, Space...), except the
// ones that do something else there.
const TITLE_IGNORE = /^(Key[EGMNVXPOLKC]|Period|NumpadDecimal|Quote|Tab|Escape|F\d+|Meta|Alt|Control|OS|ContextMenu|CapsLock)/;

function updateTitle() {
  if (titleControls) { // the controls card: any key or tap closes it
    if (input.key('Escape') || input.key('KeyC') || input.key('Enter') || input.key('Space') || taps.length) { titleControls = false; sfx.select(); }
    return;
  }
  if (!net && !lobby.isOpen && input.key('KeyK')) {
    skipCutscenes = !skipCutscenes;
    toast = { text: skipCutscenes ? 'SKIP CUTSCENES: ON (Scene 1 Mall Cop lockdown, Scene 2 save Ray)' : 'SKIP CUTSCENES: off', t: 3, local: true };
    try { localStorage.setItem('motd-skipcut', skipCutscenes ? 'on' : 'off'); } catch { /* storage unavailable */ }
  }
  const hit = taps.map((t) => titleButtonAt(t.x, t.y)).find(Boolean);
  if (!net && !lobby.isOpen && (input.key('KeyC') || hit === 'controls')) { initAudio(); sfx.select(); titleControls = true; return; }
  // the CO-OP LOBBY button: tap or click it, or press O
  if (!net && !lobby.isOpen && (input.key('KeyO') || hit === 'coop')) { initAudio(); sfx.select(); lobby.open(); return; }
  if (lobby.isOpen) { if (input.key('Escape')) lobby.close(); return; } // don't start the game under the panel
  // the STATS & LEADERBOARD button: tap or click it, or press L
  if (!net && (input.key('KeyL') || taps.some((t) => titleRecordsAt(t.x, t.y)))) { initAudio(); sfx.select(); setState('stats'); return; }
  // Only players on this machine act here: online guests must never start a new quest
  // (it wipes the save) or start the host's game for them.
  const guests = [...input.remote.keys()];
  const anyKey = input.frameGlobal && [...input.frameGlobal].some((k) => !TITLE_IGNORE.test(k));
  const atk = input.firstPressed('attack', guests) || input.sources().find((id) => !isNet(id) && input.get(id).pressed.start) || (anyKey && 'kb') || (hit === 'solo' && 'kb');
  if (input.firstPressed('magic', guests) && hasProgress(save)) { initAudio(); setState('confirm'); return; }
  if (atk) {
    initAudio();
    sfx.join();
    const begin = () => { slots = [{ source: atk, cls: 'biker', ready: false }]; countdown = null; setState('select'); };
    if (!save.progress.seenIntro) {
      showStory(STORY.intro, () => { save.progress.seenIntro = true; writeSave(save); begin(); });
    } else begin();
  }
}

// The stats & leaderboard screen: left/right or tap a tab to change page, back to the title.
function updateRecords() {
  const local = input.sources().filter((id) => !isNet(id));
  let dir = 0;
  for (const id of local) { const p = input.get(id).pressed; if (p.left) dir--; if (p.right) dir++; }
  for (const t of taps) {
    const hit = recordsTapAt(t.x, t.y, recordsTab);
    if (hit === 'back') { sfx.select(); setState('title'); return; }
    if (hit === 'refresh') { if (globalBoard.status !== 'loading') { sfx.select(); loadGlobal(); } continue; }
    if (hit !== null && hit !== recordsTab) { recordsTab = hit; sfx.select(); if (hit === 3) loadGlobal(); }
  }
  if (dir) { recordsTab = (recordsTab + dir + 4) % 4; sfx.select(); if (recordsTab === 3) loadGlobal(); }
  // REFRESH on the global page: R, or the attack button
  if (recordsTab === 3 && globalBoard.status !== 'loading' && (input.key('KeyR') || local.some((id) => input.get(id).pressed.attack))) { sfx.select(); loadGlobal(); }
  if (input.key('KeyL') || local.some((id) => backPressed(id))) setState('title');
}

function updateConfirm() {
  // wiping the save: the host's own players only
  if (input.firstPressed('attack', [...input.remote.keys()])) { save = newSave(); writeSave(save); toast = { text: 'A new quest begins', t: 2, local: true }; setState('title'); }
  else if (input.sources().some((id) => !isNet(id) && backPressed(id))) setState('title');
}

// ---------- hero select ----------

function cycleClass(s, dir) {
  const pool = unlockedClasses(save.progress);
  const k = Math.max(0, pool.indexOf(s.cls));
  s.cls = pool[(k + dir + pool.length) % pool.length];
  sfx.select();
}

function updateSelect(dt) {
  for (const t of taps) {
    const hit = selectArrowAt(t.x, t.y);
    const s = hit && slots[hit.slot];
    if (s && !s.ready) { initAudio(); cycleClass(s, hit.dir); countdown = null; }
  }
  const full = slots.filter(Boolean).length >= MAX_PLAYERS;
  if (!full && splitKeyboard(slots)) {
    const idx = [0, 1, 2, 3].find((i) => !slots[i]);
    slots[idx] = { source: 'kb2', cls: nextFreeClass(slots.filter(Boolean).map((s) => s.cls)), ready: false };
    sfx.join();
    countdown = null;
    return;
  }
  const joiner = input.firstPressed('attack', usedSources());
  if (joiner && !full) {
    const idx = [0, 1, 2, 3].find((i) => !slots[i]);
    slots[idx] = { source: joiner, cls: nextFreeClass(slots.filter(Boolean).map((s) => s.cls)), ready: false };
    sfx.join();
    countdown = null;
    return;
  }
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const s = slots[i];
    if (!s) continue;
    const inp = input.get(s.source);
    if (!s.ready) {
      const dir = (inp.pressed.right || inp.pressed.down ? 1 : 0) - (inp.pressed.left || inp.pressed.up ? 1 : 0);
      if (dir) cycleClass(s, dir);
      if (inp.pressed.attack) { s.ready = true; sfx.join(); say(CLASSES_NAME(s.cls), `pick${i}`, 500); }
      if (backPressed(s.source)) {
        slots[i] = null; countdown = null;
        unsplitKeyboard(slots);
        if (!slots.some(Boolean)) setState('title');
      }
    } else if (backPressed(s.source)) {
      s.ready = false; countdown = null;
    }
  }
  const active = slots.filter(Boolean);
  if (active.length && active.every((s) => s.ready)) {
    if (countdown == null) countdown = 2;
    countdown -= dt;
    if (countdown <= 0) startGame();
  } else countdown = null;
}

function CLASSES_NAME(cls) { return CLASSES[cls].name; }

function startGame() {
  game = new Game();
  game.isCleared = (n) => !!save.progress.completed[n]; // replays score half
  game.story = save.story;
  // this device's heroes count toward its stats (not online guests', and not the training)
  game.onStat = (p, key, n, sub) => { if (!isNet(p.source) && game && game.level && !game.level.tutorial) stats.add(p, key, n, sub); };
  stats.gameStarted(!!net);
  // online guests start with fresh heroes; players here continue their saved ones
  slots.forEach((s, i) => { if (s) game.addPlayer(i, s.source, s.cls, isNet(s.source) ? null : save.heroes[s.cls]); });
  save.progress.tutorialDone = true; // the controls are on screen; the orientation lessons are not part of this slice
  openMap();
}

// ---------- the Training Grounds (first-time tutorial) ----------

function startTutorial() {
  game.startTutorial();
  tutorial = new Tutorial(game, input.touch);
  setState('play');
}

function finishTutorial(skipped = false) {
  save.progress.tutorialDone = true;
  tutorial = null;
  persist();
  toast = { text: skipped ? 'Orientation skipped' : 'Orientation complete!', t: 2.5 };
  openHub();
}

// ---------- the hub ----------

let realmPick = null; // { realm, stage } while choosing a wing at the Mall Directory

function openHub() {
  for (const p of game.allPlayers()) { p.alive = true; p.hp = Math.max(p.hp, p.def.hp); }
  game.story = save.story;
  game.startHub();
  setState('play');
}
const openMap = () => openHub();

// "Back" in menus: Esc on the keyboard ('.' for a second keyboard player), B on a gamepad,
// the flashbang button on the touch screen. (E is that button in play, which made a poor exit key.)
const isKb = (src) => src === 'kb' || src === 'kb1' || src === 'kb2';
function backPressed(src) {
  if (!isKb(src)) return !!input.get(src).pressed.magic;
  if (src === 'kb2') return input.key('Period') || input.key('NumpadDecimal');
  return input.key('Escape') || input.key('Backspace') || (input.lastDevice === 'touch' && !!input.get(src).pressed.magic);
}
const anyBack = () => input.sources().some(backPressed);
const partyBack = () => partySources().some(backPressed);

function partySources() { return game ? game.allPlayers().map((p) => p.source) : []; }
function partyPressed(btn) { return partySources().some((src) => input.get(src).pressed[btn]); }

// In the hub, Attack at the Mall Directory picks a wing; at the upgrade counter it opens the shop.
function updateHubActions() {
  const f = game.hubFocus;
  if (!f || !partyPressed('attack')) return;
  if (f.type === 'shop') {
    shop = game.players.map((p) => (p ? { idx: 0, done: false } : null));
    setState('shop');
    return;
  }
  const next = nextStage(save.progress);
  realmPick = { realm: 0, stage: next.stage };
  sfx.select();
  setState('realm');
}

function updateRealmPick() {
  // tapping a wing picks it, tapping it again enters
  let enter = false;
  for (const t of taps) {
    const k = wingAt(t.x, t.y);
    if (k == null) continue;
    initAudio();
    if (k === realmPick.realm) enter = true;
    else { realmPick.realm = k; sfx.select(); }
  }
  if (partyPressed('up')) { realmPick.realm = Math.max(0, realmPick.realm - 1); sfx.select(); }
  if (partyPressed('down')) { realmPick.realm = Math.min(REALMS - 1, realmPick.realm + 1); sfx.select(); }
  if (partyBack()) { setState('play'); return; }
  if (enter || partyPressed('attack')) {
    const { realm } = realmPick;
    if (!wingOpen(realm)) { sfx.hurt(); toast = { text: `${WINGS[realm].name}: LOCKED. Coming soon.`, t: 2.2 }; return; }
    const stage = nextStage(save.progress).stage;
    enterLevel(levelNumber(realm, stage));
  }
}

// Walk into a wing's level: stage 1 plays the opening cutscene first (Scene 1), the boss its intro (Scene 3).
function enterLevel(n) {
  for (const p of game.allPlayers()) { p.alive = true; p.hp = Math.max(p.hp, p.def.hp); }
  const info = levelInfo(n);
  game.story = save.story;
  if (!info.isBoss) {
    resetWing1(save.story); // a fresh run of the wing forgets its old decisions
    persist();
    game.stageCutscene('opening');
    const go = () => { game.endCutscene(); game.startLevel(n); setState('play'); };
    if (!save.progress.seenRealm[info.realm]) {
      save.progress.seenRealm[info.realm] = true;
      writeSave(save);
      showStory(STORY.realms[info.realm] || [], () => startCutscene('opening', go));
    } else startCutscene('opening', go);
  } else {
    game.startLevel(n);
    game.stageCutscene('boss');
    startCutscene('boss', () => { game.endCutscene(); setState('play'); });
  }
}

// ---------- cutscenes (Telltale-style timed choices, see cutscenes.js) ----------

function startCutscene(id, done) {
  cutDone = done;
  cut = new Cutscene(id, {
    story: save.story,
    skip: skipCutscenes,
    hooks: {
      choose(choiceId, pick) {
        const res = applyChoice(save.story, choiceId, pick);
        if (!res) return null;
        persist();
        writeStory(save.story);
        game.applyStoryEffects(res.effects);
        return res;
      },
    },
  });
  if (cut.done) { finishCutscene(); return; }
  game.cutCam = cut.camera(game);
  setState('cutscene');
}

function finishCutscene() {
  for (const t of cut.toasts.splice(0)) storyToasts.push(t);
  const done = cutDone;
  cut = null; cutDone = null;
  if (game) game.cutCam = null;
  if (done) done();
}

function updateCutscene(dt) {
  game.updateScene(dt, cut.view().alarm ? 'alarm' : cut.beat && cut.beat.fx);
  // lines: Space / Enter / click / attack advance; choices: keys 1-4, click, or the d-pad
  const local = input.sources().filter((id) => !isNet(id));
  let adv = input.key('Space') || input.key('Enter') || input.key('NumpadEnter') || local.some((id) => input.get(id).pressed.attack);
  const v = cut.view();
  if (v.beat === 'choice') {
    let idx = -1;
    ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => { if (input.key(k) || input.key(`Numpad${i + 1}`)) idx = i; });
    for (const id of local) { const p = input.get(id).pressed; if (p.up) idx = 0; else if (p.left) idx = 1; else if (p.right) idx = 2; else if (p.down) idx = 3; }
    for (const t of taps) { const k = cutChoiceAt(t.x, t.y, v); if (k >= 0) { initAudio(); idx = k; } }
    if (idx >= 0 && cut.pick(idx)) sfx.select();
    adv = false;
  } else {
    for (const t of taps) { if (!adv) adv = true; void t; }
  }
  if (adv) cut.advance();
  cut.update(dt);
  for (const t of cut.toasts.splice(0)) { storyToasts.push(t); sfx.select(); }
  if (cut.done) { finishCutscene(); return; }
  game.cutCam = cut.camera(game);
}

// ---------- online play ----------
// One player hosts: their browser runs the game and streams it to up to three guests, whose
// button presses come back as extra input sources ('net1', 'net2', ...) that join like
// gamepads. Guests draw what the host sends. See net.js (connection) and netstate.js (state).

let net = null; // host: { role, link, code, writer, fx, sendT } · guest: { role, link, code, me, reader, ui }
function isNet(src) { return src.startsWith('net'); }
const lobby = new Lobby({
  onHost: hostOnline,
  onJoin: joinOnline,
  onLeave: () => leaveOnline('You left the online game.'),
  onKick: (id) => { if (net && net.role === 'host') net.link.kick(id); },
  onNewCode: () => {
    if (!net || net.role !== 'host') return;
    const link = net.link;
    link.newCode().then((code) => {
      if (!net || net.link !== link) return;
      net.code = code;
      toast = { text: `New room code: ${showCode(code)} (the old one no longer works)`, t: 4, local: true };
    }).catch((err) => { toast = { text: err.message, t: 3, local: true }; });
  },
  onLock: () => {
    if (!net || net.role !== 'host') return;
    net.link.locked = !net.link.locked;
    toast = { text: net.link.locked ? 'Room locked: no new players can join' : 'Room unlocked', t: 2.5, local: true };
  },
});

// How the host's room bar names each online player ("P2", or "guest" before they pick a hero).
function guestList() {
  return net.link.guests.map((id) => {
    const i = game ? game.players.findIndex((p) => p && p.source === id) : slots.findIndex((x) => x && x.source === id);
    return { id, label: i >= 0 ? `P${i + 1}` : 'guest' };
  });
}

async function hostOnline() {
  initAudio();
  const link = new Host({
    onJoin: (id) => {
      input.remote.set(id, { held: {}, acc: {} });
      sfx.join();
      toast = { text: 'A friend connected! They press Attack to join in.', t: 3.5, local: true };
    },
    onLeave: (id) => dropGuest(id),
    onInput: (id, m) => input.remoteInput(id, m),
    onError: (text) => { toast = { text, t: 3, local: true }; },
  });
  try {
    const code = await link.start();
    net = { role: 'host', link, code, writer: new SnapshotWriter(), fx: [], sendT: 0 };
    audioTap.fn = (ev) => { if (net && net.role === 'host' && net.link.count) net.fx.push(ev); };
    toast = { text: `You're hosting! Room code: ${showCode(code)}`, t: 5, local: true };
  } catch (err) {
    lobby.say(err.message);
    link.close();
  }
}

// An online guest disconnected: their hero leaves the party.
function dropGuest(id) {
  input.remote.delete(id);
  const i = slots.findIndex((s) => s && s.source === id);
  if (i >= 0) {
    slots[i] = null;
    countdown = null;
    if (state === 'select' && !slots.some(Boolean)) setState('title');
  }
  if (game) for (const p of game.allPlayers()) if (p.source === id) game.players[p.slot] = undefined;
  toast = { text: 'An online player left', t: 2.5 };
}

async function joinOnline(code) {
  initAudio();
  const link = new Guest({ onMessage: guestMessage, onClose: (reason) => leaveOnline(reason) });
  try {
    const me = await link.join(code);
    net = { role: 'guest', link, code: code.toUpperCase(), me, reader: new SnapshotReader(Game), ui: {}, sendT: 0, joinedAt: performance.now() };
    Input.me = me;
    game = null; tutorial = null; story = null; slots = [];
    toast = { text: 'Connected! Press Attack to join the party.', t: 4, local: true };
  } catch (err) {
    lobby.say(err.message);
    link.close();
  }
}

function leaveOnline(reason) {
  if (!net) return;
  const was = net;
  net = null;
  was.link.close();
  if (was.role === 'host') {
    audioTap.fn = null;
    for (const id of [...input.remote.keys()]) dropGuest(id);
    if (game) game.fx = null;
  } else {
    game = null; story = null; tutorial = null; slots = [];
    setState('title');
  }
  input.remote.clear();
  Input.me = null;
  if (reason) toast = { text: reason, t: 4, local: true };
}

// Host: about 20 times a second, send every guest the screen state and the game.
function hostSend(dt) {
  const live = net.link.count > 0;
  if (game) game.fx = live ? game.fx || [] : null;
  net.sendT -= dt;
  if (!live || net.sendT > 0) return;
  net.sendT = 0.05;
  const fx = net.fx.concat(game && game.fx ? game.fx : []);
  net.fx = [];
  if (game && game.fx) game.fx = [];
  const ui = {
    slots, cd: countdown, rp: realmPick, shop, ci: clearInfo,
    cut: cut && state === 'cutscene' ? cut.view() : null,
    rc: state === 'recap' ? recap(save.story) : null,
    tn: storyToasts.slice(0, 3).map((t) => t.text),
    story: story && state === 'story' ? { lines: story.lines, idx: story.idx, t: story.t } : null,
    toast: toast && !toast.local ? toast.text : null,
    prog: save.progress, heroes: state === 'select' ? save.heroes : null,
    tut: tutorial ? [tutorial.idx, tutorial.doneT > 0 ? 1 : 0] : null,
  };
  // (the stats screen is this device's own: guests keep seeing the title)
  net.link.send({ t: 's', st: state === 'stats' ? 'title' : state, stT: Math.round(stateT * 100) / 100, ui, g: game ? net.writer.game(game) : null, fx });
}

// Guest: apply what the host sent (all of it checked first: see netstate.js).
function guestMessage(m) {
  if (!net || m.t !== 's') return;
  try {
    const ui = cleanUi(m.st, m.ui, !!cleanGame(m.g));
    if (!ui) return; // malformed, or a screen without the data it needs: ignore it
    net.heardAt = performance.now();
    // keep our own clock for the screen's animations; only resync when it drifts
    const stT = Math.min(1e5, Math.max(0, Number(m.stT) || 0));
    if (state !== m.st || Math.abs(stateT - stT) > 0.5) stateT = stT;
    const entered = state !== m.st && m.st;
    state = m.st;
    if (entered === 'title') announceRuns(stats.endRuns()); // the host's game is over
    if (entered === 'gameover' || entered === 'ending') offerPending = true;
    net.ui = ui;
    slots = ui.slots;
    countdown = ui.cd;
    realmPick = ui.rp;
    shop = ui.shop;
    clearInfo = ui.ci;
    story = ui.story ? { ...ui.story, next() {} } : null;
    storyToasts = (ui.tn || []).map((text) => ({ text, t: 2.5 }));
    if (ui.toast && ui.toast !== net.lastToast) toast = { text: ui.toast, t: 2.5, local: true };
    net.lastToast = ui.toast;
    game = net.reader.apply(m.g, m.fx);
    const mine = game && game.allPlayers().find((p) => p.source === net.me);
    if (mine && !net.counted) { net.counted = true; stats.gameStarted(true); } // our hero joined in
    if (entered === 'levelclear' && mine && !(game.level && game.level.tutorial)) stats.levelCleared([mine], !!(ui.ci && ui.ci.wasBoss));
    if (!m.g) for (const ev of cleanEvents(m.fx)) playSound(ev);
  } catch (err) {
    console.error(err);
    leaveOnline('The host sent something this game could not read.');
  }
}

// Guest: everything on this device (keys, touch, gamepad) drives this guest's one hero.
function guestFrame(dt) {
  // a host that goes silent (gone, or hostile) doesn't leave us stuck on its last screen
  if (performance.now() - (net.heardAt || net.joinedAt) > 15000) { leaveOnline('Lost the connection to the host.'); return; }
  let x = 0, y = 0, a = false, mg = false, u = false, st = false;
  for (const s of Object.values(input.state)) {
    if (!x && !y) { x = s.x; y = s.y; }
    a = a || s.attack; mg = mg || s.magic; u = u || s.turbo; st = st || s.pressed.start;
  }
  // Esc backs out of menus and pauses during play, as it does for the host
  const menu = ['select', 'story', 'realm', 'shop', 'gameover', 'confirm', 'levelclear', 'recap'].includes(state);
  if (input.key('Escape') || input.key('Backspace')) { if (menu) mg = true; else st = true; }
  if (input.key('KeyP')) st = true;
  // pausing always shows this guest the Leave button for a while, even if the host
  // doesn't pause, so a guest can never be stuck in someone's game
  if (st) net.menuUntil = performance.now() + 5000;
  // tapping the arrows on your own hero card
  if (state === 'select') {
    for (const t of taps) {
      const hit = selectArrowAt(t.x, t.y);
      if (hit && slots[hit.slot] && slots[hit.slot].source === net.me) x = hit.dir;
    }
  }
  // tapping a stage at a portal: the same, for the party's shared choice
  if (state === 'realm' && realmPick) {
    for (const t of taps) {
      const k = wingAt(t.x, t.y);
      if (k == null) continue;
      if (k === realmPick.realm) a = true;
      else { x = 0; y = k < realmPick.realm ? -1 : 1; }
    }
  }
  // tapping in the shop: a tap on your chosen item buys it, a tap on another steps toward it
  if (state === 'shop' && game) {
    const ps = game.allPlayers();
    for (const t of taps) {
      const hit = shopItemAt(t.x, t.y, ps.length);
      const p = hit && ps[hit.i];
      const c = p && p.source === net.me && shop && shop[p.slot];
      if (!c || c.done) continue;
      if (c.idx === hit.k) a = true;
      else { x = 0; y = hit.k < c.idx ? -1 : 1; }
    }
  }
  const pkt = { t: 'i', x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, a: a ? 1 : 0, m: mg ? 1 : 0, u: u ? 1 : 0, s: st ? 1 : 0 };
  const key = `${pkt.x},${pkt.y},${pkt.a}${pkt.m}${pkt.u}${pkt.s}`;
  net.sendT -= dt;
  if (key !== net.lastPkt || net.sendT <= 0) { net.link.send(pkt); net.lastPkt = key; net.sendT = 0.1; }
  if (net.reader.game) net.reader.tick(dt);
  // our hero's stats and leaderboard run, read off the host's game
  const mine = state === 'play' && game && game.level && !game.level.tutorial && game.allPlayers().find((p) => p.source === net.me);
  if (mine) {
    stats.guestTick(mine);
    stats.tick(dt, [mine], game.levelNum, { mode: 'online', n: game.allPlayers().length });
  }
}

// ---------- playing ----------

// When someone is swamped or nearly dead and still has a potion, remind them about magic
// (a few times per session, so it doesn't nag).
function updateMagicHint(dt) {
  magicHint.t -= dt;
  if (magicHint.t > 0 || magicHint.shown >= 4) return;
  for (const p of game.livePlayers()) {
    if (p.potions <= 0) continue;
    const crowd = game.enemies.filter((e) => game.onScreen(e)).length;
    if (crowd < 12 && p.hp > 160) continue;
    game.text(p.x, p.y - 40, `${btn('magic', p.source).toUpperCase()}: FLASHBANG!`, '#c9a0ff', 2.5);
    toast = { text: `${p.name}: press ${btn('magic', p.source)} for a flashbang. It hits every zombie on screen!`, t: 3.5 };
    if (input.touch) input.touch.pulse('magic');
    magicHint = { t: 45, shown: magicHint.shown + 1 };
    return;
  }
}

// Start pressed by anyone; an online guest can only pause or resume once a second, so one
// can't keep flipping the game in and out of pause.
const netPauseAt = new Map();
function startPressed() {
  for (const id of input.sources()) {
    if (!input.get(id).pressed.start) continue;
    if (!isNet(id)) return true;
    const now = performance.now();
    if (now - (netPauseAt.get(id) || -1e9) < 1000) continue;
    netPauseAt.set(id, now);
    return true;
  }
  return false;
}

function updatePlay(dt) {
  if (input.key('Escape') || input.key('KeyP') || startPressed()) { setState('paused'); return; }

  // Drop-in join / continue
  const used = game.allPlayers().map((p) => p.source);
  const roomy = game.allPlayers().length < MAX_PLAYERS;
  const joiner = roomy && splitKeyboard(game.allPlayers()) ? 'kb2' : input.firstPressed('attack', used);
  if (joiner && roomy) {
    const slot = [0, 1, 2, 3].find((i) => !game.players[i]);
    const cls = nextFreeClass(game.allPlayers().map((p) => p.cls));
    game.joinMidGame(slot, joiner, cls, isNet(joiner) ? null : save.heroes[cls]);
  }
  for (const p of game.allPlayers()) {
    if (!p.alive && p.deadT > 1.5 && input.get(p.source).pressed.attack) game.respawn(p);
  }

  game.update(dt, input);
  if (game.level.hub) { updateHubActions(); return; }
  if (game.level.tutorial) {
    if (tutorial) tutorial.update(dt);
    if (game.exitReached) finishTutorial();
    return;
  }
  updateMagicHint(dt);

  if (game.pendingScene) { // the mid-wing crisis: Ray, the locker and a decision
    const id = game.pendingScene;
    game.pendingScene = null;
    game.stageCutscene(id);
    startCutscene(id, () => { game.endCutscene(); setState('play'); });
    return;
  }
  if (game.exitReached) {
    const n = game.levelNum;
    const info = levelInfo(n);
    const bonus = game.stageBonus(info.isBoss);
    completeLevel(save.progress, n);
    stats.levelCleared(game.allPlayers().filter((p) => !isNet(p.source)), info.isBoss);
    if (info.isBoss) save.story.flags.wing1Done = true;
    persist();
    writeStory(save.story);
    clearInfo = { level: n, wasBoss: info.isBoss, realm: info.theme.name, name: info.stageName, bonus };
    setState(info.isBoss ? 'recap' : 'levelclear');
    return;
  }
  if (!game.livePlayers().length && game.allPlayers().every((p) => p.deadT > 2.5)) {
    persist();
    stats.save();
    setState('gameover');
  }
}

function updateLevelClear() {
  if (stateT > 1 && (input.firstPressed('attack') || stateT > 8)) {
    for (const p of game.allPlayers()) {
      if (!p.alive) { p.alive = true; p.hp = Math.floor(p.def.hp / 2); }
    }
    // the Food Court leads straight into the Butcher's kitchen
    enterLevel(game.levelNum + 1);
  }
}

// The "Your Choices" recap after the wing's boss: attack to return to the Security Room.
function updateRecap() {
  if (!promptHeld && stateT > 1.2 && (input.firstPressed('attack') || input.anyStart() || input.key('Space') || input.key('Enter'))) {
    for (const p of game.allPlayers()) { if (!p.alive) { p.alive = true; p.hp = Math.floor(p.def.hp / 2); } }
    persist();
    openHub();
  }
}

function updateShop() {
  let allDone = true;
  const ps = game.allPlayers();
  // tapping an item picks it, tapping it again buys it (touch screens, this device's heroes)
  for (const t of taps) {
    const hit = shopItemAt(t.x, t.y, ps.length);
    const p = hit && ps[hit.i];
    const c = p && !isNet(p.source) && shop[p.slot];
    if (!c || c.done) continue;
    initAudio();
    if (c.idx === hit.k) shopBuy(p, c);
    else { c.idx = hit.k; sfx.select(); }
  }
  for (const p of ps) {
    const c = shop[p.slot] || (shop[p.slot] = { idx: 0, done: false });
    const inp = input.get(p.source);
    if (!c.done) {
      if (inp.pressed.up) { c.idx = (c.idx + SHOP.length - 1) % SHOP.length; sfx.select(); }
      if (inp.pressed.down) { c.idx = (c.idx + 1) % SHOP.length; sfx.select(); }
      // a solo hero's shop has two columns: left/right hop between them
      if (ps.length === 1 && (inp.pressed.left || inp.pressed.right)) { c.idx = (c.idx + SHOP.length / 2) % SHOP.length; sfx.select(); }
      if (inp.pressed.attack) shopBuy(p, c);
      if (backPressed(p.source)) { c.done = true; sfx.join(); }
    } else if (backPressed(p.source)) c.done = false;
    allDone = allDone && c.done;
  }
  if (allDone && stateT > 0.5) { persist(); setState('play'); }
}

function shopBuy(p, c) {
  const item = SHOP[c.idx];
  if (item.id === 'done') { c.done = true; sfx.join(); }
  else if (buy(p, item)) { sfx.gold(); c.flash = 0.4; }
  else { sfx.hurt(); c.deny = 0.4; }
}

function updateGameOver() {
  if (stateT < 1.5 || promptHeld) return;
  if (input.firstPressed('attack')) {
    // Continue: everyone revives and the level restarts, without the points scored on it.
    for (const p of game.allPlayers()) {
      p.alive = true; p.hp = p.def.hp; p.score = p.stageStart ?? p.score; p.keys = 0;
    }
    game.startLevel(game.levelNum);
    setState('play');
  } else if (anyBack()) {
    for (const p of game.allPlayers()) { p.alive = true; p.hp = p.def.hp; p.keys = 0; p.score = p.stageStart ?? p.score; }
    openHub();
  }
}

// Background music for whatever is on screen (the track table is in music-data.js).
function currentTrack() {
  const inLevel = !!(game && game.level && ['play', 'paused', 'levelclear', 'gameover', 'realm', 'shop', 'cutscene', 'recap'].includes(state));
  return trackFor({
    state, inLevel,
    hub: inLevel && !!game.level.hub, tutorial: inLevel && !!game.level.tutorial, cutscene: state === 'cutscene' ? (cut ? cut.id : 'opening') : '',
    isBoss: inLevel && !!game.info.isBoss, levelNum: game ? game.levelNum : 0,
  });
}

// A guardian's music gets heavier as it is hurt: enraged at two thirds, furious at one third.
function musicIntensity() {
  const b = game && game.boss;
  if (!b || (state !== 'play' && state !== 'paused') || !game.info.isBoss || b.hp <= 0) return 0;
  return phaseOf(b) - 1;
}

function render() {
  ctx.textBaseline = 'alphabetic';
  if (lineupActive() && state !== 'loading') { ctx.clearRect(0, 0, VIEW_W, VIEW_H); renderLineup(r3d, 1 / 60); return; }
  // an online guest shows the host's quest
  const guest = net && net.role === 'guest';
  const progress = guest ? net.ui.prog || save.progress : save.progress;
  const heroes = guest ? net.ui.heroes || {} : save.heroes;
  if (state === 'loading') {
    drawLoading(ctx, loadProgress, loadError);
  } else if (state === 'title' || state === 'confirm') {
    r3d.renderShowcase(titleShowcase(stateT), stateT);
    drawTitle(ctx, stateT, topScores(), hasProgress(save) ? save.progress : null, !net && state === 'title', titleControls, skipCutscenes);
    if (guest) drawOverlay(ctx, `ROOM ${showCode(net.code)}`, ['Connected! Waiting for the host to start...', `Press ${btn('attack')} to join the party`], '#8fe0ff');
    if (state === 'confirm') drawOverlay(ctx, 'NEW GAME?', ['Your saved survivors, upgrades and story choices will be lost.', '', `${btn('attack')}: start over        ${btn('back')}: keep my game`], '#ffb060');
  } else if (state === 'stats') {
    r3d.renderShowcase(titleShowcase(stateT), stateT);
    drawRecords(ctx, stateT, stats.data, save.progress, save.heroes, unlockedClasses(save.progress), recordsTab, (r) => stats.isRecent(r), globalBoard, isMineRow);
  } else if (state === 'story') {
    r3d.renderShowcase(storyShowcase(stateT, game), stateT);
    drawStory(ctx, story, stateT);
  } else if (state === 'select') {
    r3d.renderShowcase(selectShowcase(slots, stateT), stateT);
    drawSelect(ctx, stateT, slots, countdown, heroes);
  } else if (state === 'shop') {
    r3d.render(game);
    drawShop(ctx, stateT, game, shop);
  } else if (state === 'realm') {
    r3d.render(game);
    drawGameOverlay(ctx, game, r3d, { hubPrompt: false });
    drawRealmPick(ctx, stateT, progress, realmPick);
  } else if (state === 'cutscene' && game) {
    r3d.render(game);
    drawCutscene(ctx, guest ? net.ui.cut : cut.view(), stateT);
  } else if (state === 'recap' && game) {
    r3d.render(game);
    drawRecap(ctx, stateT, guest ? net.ui.rc : recap(save.story), game);
  } else if (game) {
    r3d.render(game);
    drawGameOverlay(ctx, game, r3d, {
      minimap: showMinimap && !game.level.hub && !game.level.tutorial,
      tutorial: !game.level.tutorial ? null
        : tutorial ? tutorial.view(btn, input.lastDevice)
          : guest && net.ui.tut ? tutorialView(net.ui.tut[0], !!net.ui.tut[1], btn, input.lastDevice) : null,
      controls: showControls && input.lastDevice !== 'touch' && state === 'play',
    });
    if (state === 'paused') {
      const resume = { touch: 'Tap II to resume', pad: 'Press Start to resume', keys: 'Press Esc to resume' }[input.lastDevice];
      const quit = input.lastDevice === 'keys' ? 'Q' : btn('magic');
      const lines = [resume];
      if (guest) lines.push('(only the host can quit)');
      else lines.push(game.level.tutorial ? `${quit}: skip the orientation` : `${quit}: save and quit to title`);
      if (!guest) lines.push(`${input.lastDevice === 'keys' ? 'K' : 'Title'}: SKIP CUTSCENES — ${skipCutscenes ? 'ON (default picks: Mall Cop lockdown, save Ray)' : 'off'}`);
      if (input.lastDevice === 'keys') lines.push('M: mute   N: music   V: announcer   TAB: minimap   X: pixel size');
      drawOverlay(ctx, 'PAUSED', [...lines, `${game.info.stageName} — ${game.theme.name}`]);
    } else if (state === 'levelclear') {
      const lines = [`${clearInfo.name} cleared!`, 'Next: the Butcher\'s Kitchen.', ''];
      const b = clearInfo.bonus;
      if (b) {
        const t = `${Math.floor(b.time / 60)}:${String(b.time % 60).padStart(2, '0')}`;
        lines.push(`Cleared in ${t}${b.mul !== 1 ? ` · points x${+b.mul.toFixed(2)}${b.mul < stagePoints(clearInfo.level) ? ' (replay)' : ''}` : ''}`);
      }
      for (const p of game.allPlayers()) {
        const r = b && b.rows.find((x) => x.slot === p.slot);
        const extra = r ? ` · bonus +${fmtPts(r.clear + r.time + r.flawless)}${r.flawless ? ' (no deaths!)' : ''}` : '';
        lines.push(`${p.name}: ${fmtPts(p.score)} pts${extra}`);
      }
      if (stateT > 1) lines.push('', `Press ${btn('attack')} to enter the kitchen`);
      drawOverlay(ctx, 'FOOD COURT CLEARED', lines, '#8fe0ff');
    } else if (state === 'gameover') {
      const lines = game.allPlayers().map((p) => { const r = stats.rankOf(p); return `${p.name}: level ${p.lvl} · ${p.score} pts${r ? ` · #${r} on the leaderboard!` : ''}`; });
      lines.push('', `${btn('attack')}: continue (restart this level)`, `${btn('back')}: retreat to the hub`);
      drawOverlay(ctx, 'GAME OVER', lines, '#ff6050');
    }
  }
  drawStoryToasts(ctx, storyToasts);
  if (toast) {
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, toast.t)})`;
    ctx.fillRect(VIEW_W / 2 - 200, VIEW_H - 172, 400, 30);
    ctx.fillStyle = `rgba(255,240,200,${Math.min(1, toast.t)})`;
    ctx.fillText(toast.text, VIEW_W / 2, VIEW_H - 152);
  }
}

let promptHeld = false; // the score prompt is open this frame
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stateT += dt;
  input.poll();
  setDevice(input.lastDevice);

  if (input.key('KeyM')) { initAudio(); toast = { text: toggleMute() ? 'Sound OFF' : 'Sound ON', t: 1.5, local: true }; }
  if (input.key('Tab')) showMinimap = !showMinimap;
  if (input.key('KeyH')) {
    showControls = !showControls;
    toast = { text: showControls ? 'Controls shown' : 'Controls hidden (H to show)', t: 1.5, local: true };
    try { localStorage.setItem('motd-controls', showControls ? 'on' : 'off'); } catch { /* storage unavailable */ }
  }
  if (input.key('KeyX')) {
    const level = (r3d.pixelLevel + 1) % 3;
    toast = { text: r3d.setPixelation(level), t: 1.5, local: true };
    try { localStorage.setItem('motd-pixels', String(level)); } catch { /* storage unavailable */ }
  }
  if (input.key('KeyV')) { toast = { text: toggleVoice() ? 'Announcer ON' : 'Announcer OFF', t: 1.5, local: true }; }
  if (input.key('KeyN')) { initAudio(); toast = { text: toggleMusic() ? 'Music ON' : 'Music OFF', t: 1.5, local: true }; }
  playMusic(currentTrack());
  setMusicIntensity(musicIntensity());
  setMusicPaused(state === 'paused');
  if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
  for (const t of storyToasts) t.t -= dt;
  storyToasts = storyToasts.filter((t) => t.t > 0);
  lobby.update(state, net && (net.role === 'host'
    ? { role: 'host', code: net.code, players: net.link.count, guests: guestList(), locked: net.link.locked }
    : { role: 'guest', code: net.code, menu: performance.now() < (net.menuUntil || 0) }));
  if (net && net.role === 'guest') {
    guestFrame(dt);
    taps.length = 0;
    render();
    return;
  }

  // the score prompt, when a run ends: it takes the input (A / B on a gamepad) until closed
  if (state !== 'gameover' && state !== 'ending') { offerPending = false; if (lbPrompt.isOpen) lbPrompt.close(); }
  else if (offerPending && stateT > 1) maybeOffer();
  promptHeld = lbPrompt.isOpen;
  if (promptHeld) {
    if (input.firstPressed('attack')) lbPrompt.submit();
    else if (anyBack()) lbPrompt.skip();
  }
  switch (state) {
    case 'title': updateTitle(); break;
    case 'stats': updateRecords(); break;
    case 'confirm': updateConfirm(); break;
    case 'story': updateStory(dt); break;
    case 'select': updateSelect(dt); break;
    case 'realm': updateRealmPick(); break;
    case 'shop': updateShop(); break;
    case 'cutscene': updateCutscene(dt); break;
    case 'recap': updateRecap(); break;
    case 'play': updatePlay(dt); break;
    case 'paused':
      if (input.key('Escape') || input.key('KeyP') || startPressed()) setState('play');
      // quit: Q on the keyboard (Esc resumes), B on a gamepad, MAGIC on the touch screen
      // (online guests can pause and resume, but only the host's own players can quit)
      else if (input.key('KeyQ') || partySources().some((src) => !isNet(src) && (!isKb(src) || input.lastDevice === 'touch') && input.get(src).pressed.magic)) {
        if (game.level.tutorial) finishTutorial(true);
        else { persist(); game = null; setState('title'); }
      } else if (input.key('KeyK')) {
        skipCutscenes = !skipCutscenes;
        toast = { text: skipCutscenes ? 'SKIP CUTSCENES: ON (Scene 1 -> Mall Cop lockdown, Scene 2 -> save Ray)' : 'SKIP CUTSCENES: off', t: 3, local: true };
        try { localStorage.setItem('motd-skipcut', skipCutscenes ? 'on' : 'off'); } catch { /* storage unavailable */ }
      }
      break;
    case 'levelclear': updateLevelClear(); break;
    case 'gameover': updateGameOver(); break;
  }
  if (state === 'play' && game && game.level && !game.level.tutorial) {
    const all = game.allPlayers();
    const online = all.some((p) => isNet(p.source));
    stats.tick(dt, all.filter((p) => !isNet(p.source)), game.levelNum, { mode: online ? 'online' : all.length > 1 ? 'coop' : 'solo', n: all.length });
  }
  if (net && net.role === 'host') hostSend(dt);
  taps.length = 0;
  render();
}

// Keep the loop alive even if a frame throws; report each distinct error once.
const reported = new Set();
function loop(now) {
  try { frame(now); } catch (err) {
    if (!reported.has(err.message)) { reported.add(err.message); console.error(err); }
  }
  requestAnimationFrame(loop);
}

// Debug/test hook (used by automated smoke tests).
window.__motd = { lineup: (section = 'all') => startLineup(r3d, section), get music() { return currentMusic(); }, get intensity() { return musicIntensity(); }, get net() { return net; }, get game() { return game; }, get state() { return state; }, get slots() { return slots; }, get tutorial() { return tutorial; }, get r3d() { return r3d; }, get globalBoard() { return globalBoard; } };

// Scale canvas to fit window while keeping aspect ratio.
function fit() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  stage.style.width = `${Math.floor(VIEW_W * s)}px`;
  stage.style.height = `${Math.floor(VIEW_H * s)}px`;
}
window.addEventListener('resize', fit);
fit();
requestAnimationFrame(loop);
