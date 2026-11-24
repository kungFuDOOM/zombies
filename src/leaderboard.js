// Local leaderboard: named high scores kept in this browser's localStorage. Nothing here ever
// touches the network (there is no server for Mall of the Dead scores), so every call works
// offline. The per-survivor run board lives in stats.js; this is the "put your name on it" board.
const NAME_KEY = 'motd-lb-name', MINE_KEY = 'motd-lb-mine', BOARD_KEY = 'motd-lb-board';
const MAX_ROWS = 50;
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

// Light profanity / personal-info filter: lower-case, de-leet, drop non-letters, look for unambiguous stems.
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'pussy', 'nazi', 'hitler', 'retard', 'rapist', 'kkk'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', $: 's', '@': 'a' };
export function cleanName(raw) {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (s.length < 3 || s.length > 12) return { ok: false, err: 'NAME: 3-12 CHARACTERS' };
  if (!/^[A-Za-z0-9 _.-]+$/.test(s)) return { ok: false, err: 'LETTERS, NUMBERS, _ . - ONLY' };
  if (/\d{5,}/.test(s.replace(/[ .-]/g, '')) || /\.(com|net|org|io)\b/i.test(s)) return { ok: false, err: 'NO PERSONAL INFO IN NAME' };
  const flat = s.toLowerCase().replace(/[013457$@]/g, (c) => LEET[c]).replace(/[^a-z]/g, '');
  if (BAD.some((b) => flat.includes(b))) return { ok: false, err: 'PICK A DIFFERENT NAME' };
  return { ok: true, name: s };
}

export const getName = () => ls.get(NAME_KEY) || '';
export const setName = (n) => ls.set(NAME_KEY, n);

// ids of scores this browser submitted (so the board can highlight them)
export function getMine() { try { const a = JSON.parse(ls.get(MINE_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'number') : []; } catch { return []; } }
function addMine(id) { ls.set(MINE_KEY, JSON.stringify([...getMine(), id].slice(-20))); }

export function friendlyError(e) {
  const m = String((e && e.message) || '');
  return m ? m.toUpperCase().slice(0, 40) : 'SCORE NOT SAVED';
}

// Keeps only well-formed rows (storage can be edited by hand; never trust it blindly).
export function cleanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, MAX_ROWS).map((r) => r && typeof r === 'object' && typeof r.name === 'string' && Number.isFinite(r.score) ? {
    id: typeof r.id === 'number' ? r.id : 0, name: r.name.slice(0, 12), score: Math.max(0, Math.min(1e7, Math.floor(r.score))),
    cls: typeof r.cls === 'string' ? r.cls.slice(0, 16) : '', level: Math.max(0, Math.min(16, Math.floor(Number(r.level) || 0))),
    won: r.won === true, date: Number.isFinite(r.date) ? r.date : (Date.parse(r.created_at) || 0),
  } : null).filter(Boolean);
}

function readBoard() { try { return cleanRows(JSON.parse(ls.get(BOARD_KEY) || '[]')); } catch { return []; } }

// Saves a score on this device's board. Resolves with { id, rank } (rank 1 = best).
export async function submitScore({ name, score, cls, level, won }) {
  const rows = readBoard();
  const id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  rows.push({
    id, name: String(name).slice(0, 12), score: Math.max(0, Math.min(1e7, Math.round(score))), cls: String(cls || '').slice(0, 16),
    level: Math.max(0, Math.min(16, Math.floor(level))), won: !!won, date: Date.now(),
  });
  rows.sort((a, b) => b.score - a.score || a.id - b.id);
  const kept = rows.slice(0, MAX_ROWS);
  ls.set(BOARD_KEY, JSON.stringify(kept));
  const rank = kept.findIndex((r) => r.id === id) + 1;
  if (rank) addMine(id);
  return { id, rank: rank || null };
}

export async function fetchTop(n = 10) { return readBoard().sort((a, b) => b.score - a.score || a.id - b.id).slice(0, n); }
