// The music table: one original track for every level, boss, hub, cutscene, menu and stinger.
// Pure data (no Web Audio), so it can be unit tested and rendered offline. src/music.js
// turns a spec into sound. All of it is original to this project (see assets/CREDITS.md).
//
// The sound is a haunted shopping mall: canned 90s muzak (detuned vibes, e-piano and a
// smooth sax, bossa brushes, a slow tape wobble) for the title, hub, shop and food court;
// slow synth horror for the cutscenes; and clanking industrial pulses for the boss.
//
// How a spec is read:
//   root  MIDI note of the key's tonic        mode  a scale from SCALES
//   prog  one scale degree (1-7) per bar; each bar's chord is built from the scale
//   lead.mot / arp.pat / bass.pat   see the legends below
//   drums names a pattern in DRUMS            boss  tracks get intensity layers
//   once  a stinger: plays through one time and stops
//   wow   cents of slow pitch wobble (worn-out tape / mall PA)   swing  late off-beats
// Lead motifs are strings of 16th-note steps: 1-9 are scale degrees (8 = the octave),
// a-c go higher (a = 10th ...), '.' is a rest and '-' holds the previous note.
// Bass patterns are 16 steps: r root, 5 fifth, o octave, 7 flat seventh, c half step up.

export const SCALES = {
  minor:   [0, 2, 3, 5, 7, 8, 10],
  dorian:  [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  major:   [0, 2, 4, 5, 7, 9, 11],
  lydian:  [0, 2, 4, 6, 7, 9, 11],
  mixo:    [0, 2, 4, 5, 7, 9, 10],
  hminor:  [0, 2, 3, 5, 7, 8, 11],
  pdom:    [0, 1, 4, 5, 7, 8, 10],
};

const N = { C: 48, 'C#': 49, D: 50, Eb: 51, E: 52, F: 53, 'F#': 54, G: 55, Ab: 56, A: 57, Bb: 58, B: 59 };

// k kick, s snare / side-stick, h hat / shaker, o open hat, t tom, m metal clank ('x' hit, 'g' ghost note)
export const DRUMS = {
  none:    { k: '', s: '', h: '', o: '', t: '' },
  sparse:  { k: 'x...............', s: '', h: '', o: '', t: '........g.......' },
  muzak:   { k: 'x.......x.......', s: '....g.......g...', h: 'g.g.g.g.g.g.g.g.', o: '', t: '' },
  lounge:  { k: 'x.....x...x.....', s: '....g.......g.g.', h: 'g.x.g.x.g.x.g.x.', o: '', t: '' },
  bossa:   { k: 'x..x..x...x..x..', s: '..g..g..g...g...', h: 'g.x.g.x.g.x.g.x.', o: '', t: '' },
  heart:   { k: 'x.x.............', s: '', h: '', o: '', t: '......g.........' },
  dread:   { k: 'x...............', s: '', h: '', o: '', t: '', m: '..........g.....' },
  clank:   { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '.x...x...x...x..', t: '', m: '..x.....x..x..x.' },
};

const ARP = (w, pat, rate, oct = 1, vol = 0.03) => ({ w, pat, rate, oct, vol });
const LEAD = (w, mot, oct = 1, vol = 0.07) => ({ w, mot, oct, vol });
const PAD = (w, vol = 0.03, cut = 1100) => ({ w, vol, cut });
const BASS = (w, pat, vol = 0.1, cut = 600) => ({ w, pat, vol, cut });

// helper so each entry stays one readable block
function T(id, name, keyName, mode, bpm, prog, parts, more = {}) {
  return { id, name, key: `${keyName} ${mode}`, root: N[keyName], mode, bpm, prog, ...parts, ...more };
}

export const TRACKS = {
  // ----- menus and the Security Room: canned mall muzak, slightly off -----
  title: T('title', 'Neon Grave Shift', 'D', 'minor', 84, [1, 6, 7, 5, 1, 4, 7, 5],
    { pad: PAD('strings', 0.035, 1100), bass: BASS('sine', 'r.......r.......', 0.12), arp: ARP('vibes', 'up', 4, 2, 0.025), lead: LEAD('sax', '8---7-5-3---5-.-6---5-3-2---.---', 1, 0.055), drums: 'muzak' }, { wow: 18, sev: true }),
  story: T('story', 'Black Friday Alarm', 'A', 'dorian', 66, [1, 1, 4, 5],
    { pad: PAD('strings', 0.04, 800), bass: BASS('sine', 'r...............', 0.09), arp: ARP('vibes', 'skip', 4, 2, 0.016), lead: LEAD('vibes', '5---.---3---2---1---.---.---.---', 1, 0.05), drums: 'none' }, { wow: 26 }),
  hub: T('hub', 'Security Room Slow Jam', 'G', 'mixo', 104, [1, 4, 1, 5, 1, 6, 4, 5],
    { pad: PAD('epiano', 0.03, 1200), bass: BASS('tri', 'r..r..5.r..r..5.', 0.1), arp: ARP('vibes', 'updown', 2, 1, 0.03), lead: LEAD('sax', '5.3.5.8.-.7.5.3.2.3.5.-.-.....2.3.5.7.8.-.9.8.7.5.-.....', 1, 0.05), drums: 'lounge' }, { wow: 14, swing: 0.1, sev: true }),
  shop: T('shop', 'Cash Counter Lounge', 'F', 'lydian', 92, [1, 2, 1, 5, 1, 6, 2, 5],
    { pad: PAD('epiano', 0.03, 1100), bass: BASS('sine', 'r.....5.r.....5.', 0.1), arp: ARP('vibes', 'broken', 3, 1, 0.035), lead: LEAD('sax', '3.-.5.-.8.-.7.5.-.4.-.6.-.8.7.-.5.-.3.-.-.-.....', 1, 0.05), drums: 'bossa' }, { wow: 16, swing: 0.08, sev: true }),

  // ----- cutscenes: slow synth horror -----
  cut_opening: T('cut_opening', 'Alarms Are Tripping', 'F#', 'minor', 72, [1, 4, 1, 5, 6, 4, 5, 1],
    { pad: PAD('strings', 0.045, 700), bass: BASS('sine', 'r...............', 0.1), arp: ARP('glass', 'down', 3, 2, 0.02), lead: LEAD('vibes', '5-.-.---4-.-3---2-.-.---1-.-.---.---7---1-.-.---', 1, 0.04), drums: 'heart' }, { wow: 20 }),
  cut_crisis: T('cut_crisis', 'Ray Is Still In There', 'Eb', 'phrygian', 78, [1, 2, 1, 7, 1, 2, 4, 1],
    { pad: PAD('strings', 0.04, 550), bass: BASS('sine', 'r..r....r..c....', 0.13, 400), arp: ARP('glass', 'skip', 4, 1, 0.022), lead: LEAD('vibes', '.---.---5---.---4---.---3---.---2---.---1---.---', 1, 0.04), drums: 'heart' }, { wow: 24 }),
  cut_boss: T('cut_boss', 'Something In The Kitchen', 'Eb', 'locrian', 88, [1, 4, 7, 6, 1, 4, 5, 5],
    { pad: PAD('strings', 0.05, 900), bass: BASS('sine', 'r.......r.......', 0.12), arp: ARP('glass', 'up', 4, 2, 0.022), lead: LEAD('buzz', '5---.---6---5---3---.---2---3---1---.---.---.---', 1, 0.03), drums: 'dread' }, { wow: 16 }),
  cut_ending: T('cut_ending', 'Four Fifty-Nine', 'C', 'minor', 62, [1, 6, 4, 5, 1, 3, 4, 5],
    { pad: PAD('strings', 0.032, 620), bass: BASS('sine', 'r...............', 0.08), arp: ARP('glass', 'broken', 4, 1, 0.012), lead: LEAD('vibes', '1---.---.---5---4---.---3---.---1---.---.---.---', 1, 0.035), drums: 'none' }, { wow: 30 }),
  recap: T('recap', 'Your Choices', 'B', 'dorian', 98, [1, 3, 6, 7, 1, 4, 6, 5],
    { pad: PAD('epiano', 0.04, 1500), bass: BASS('tri', 'r.......5.......', 0.1), arp: ARP('vibes', 'up', 2, 2, 0.03), lead: LEAD('sax', '5---3-5-8---7-5-6---5-3-2---3-5-7---.---', 1, 0.05), drums: 'muzak' }, { wow: 18, sev: true }),

  // ----- Wing 1: Food Court -----
  level_1: T('level_1', 'Food Court Muzak Massacre', 'E', 'dorian', 116, [1, 2, 1, 6, 1, 2, 1, 5],
    { pad: PAD('strings', 0.022, 900), bass: BASS('tri', 'r.rr..r.r.rr.5r.', 0.1, 500), arp: ARP('vibes', 'broken', 4, 2, 0.03), lead: LEAD('sax', '1.2.3.-.2.1.2.3.5.-.4.3.2.-.1.-.-.2.3.5.6.-.5.3.2.-.1.-.-.-.', 1, 0.055), drums: 'bossa' }, { wow: 28, swing: 0.1, sev: true }),
  boss_1: T('boss_1', 'The Deep-Fry Butcher', 'E', 'phrygian', 148, [1, 1, 6, 5, 1, 1, 2, 5],
    { pad: PAD('strings', 0.03, 1000), bass: BASS('saw', 'rr.rr.r.rr.rr.c.', 0.1, 600), arp: ARP('buzz', 'skip', 1, 1, 0.014), lead: LEAD('stab', '1-.1.2-.1-.1.2-.1-.5-.-.-.4.2-.1.2.1.-.-.-', 1, 0.07), drums: 'clank' }, { boss: true }),

  // ----- stingers (play once) -----
  clear: T('clear', 'Exit Sign Glow', 'C', 'major', 128, [1, 4, 5, 1],
    { pad: PAD('epiano', 0.04, 1800), bass: BASS('sine', 'r.......r.......', 0.09), arp: ARP('vibes', 'up', 2, 2, 0.025), lead: LEAD('vibes', '5.-.-.-.8.-.-.-.3.-.-.-.5.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.', 1, 0.06), drums: 'none' }, { once: true }),
  bossclear: T('bossclear', 'Butcher Fried', 'D', 'major', 112, [1, 4, 5, 1, 6, 4, 5, 1],
    { pad: PAD('epiano', 0.05, 1800), bass: BASS('tri', 'r.......5.......', 0.09, 600), arp: ARP('vibes', 'up', 2, 2, 0.03), lead: LEAD('sax', '8---.-7-5---3---6---5-3-2---1-.-.---3---2---1---.---.---.---.---.---', 1, 0.06), drums: 'muzak' }, { once: true, wow: 14, sev: true }),
  defeat: T('defeat', 'Lunch Is Served', 'D', 'phrygian', 60, [1, 2, 1, 1],
    { pad: PAD('strings', 0.05, 700), bass: BASS('sine', 'r...............', 0.12), arp: ARP('glass', 'down', 4, 1, 0.018), lead: LEAD('strings', '5---4---3---2---1---.---.---.---', 1, 0.05), drums: 'sparse' }, { once: true, wow: 34 }),
  victory: T('victory', 'Closing Time', 'C', 'major', 76, [1, 5, 6, 4, 1, 5, 4, 5],
    { pad: PAD('epiano', 0.05, 1600), bass: BASS('tri', 'r.......5.......', 0.09, 600), arp: ARP('vibes', 'up', 4, 2, 0.03), lead: LEAD('vibes', '8---.-7-5---3---6---5-3-2---1---.---5---3---2---1---.---.---', 1, 0.06), drums: 'muzak' }, { wow: 22, sev: true }),
};

export const TRACK_IDS = Object.keys(TRACKS);
export const loopBars = (t) => t.prog.length;

// A lead motif is fitted to whole bars that divide the loop evenly (padded with rests), so
// the melody and the chords always line up again where the track wraps around.
export function motifOf(t) {
  const loop = t.prog.length * 16;
  const raw = t.lead.mot;
  let size = loop;
  while (size / 2 >= raw.length && size > 16) size /= 2;
  return raw.slice(0, size).padEnd(size, '.');
}

// Which track plays for what is on screen. `s` = { state, hub, isBoss, levelNum, cutscene }.
export function trackFor(s) {
  if (s.state === 'loading' || s.state === 'title' || s.state === 'confirm' || s.state === 'stats' || s.state === 'select') return 'title';
  if (s.state === 'story') return 'story';
  if (s.state === 'shop') return 'shop';
  if (s.state === 'recap') return 'recap';
  if (s.state === 'cutscene') return ({ crisis: 'cut_crisis', boss: 'cut_boss', ending: 'cut_ending' })[s.cutscene] || 'cut_opening';
  if (!s.inLevel) return 'title';
  if (s.hub) return 'hub';
  if (s.state === 'levelclear') return s.isBoss ? 'bossclear' : 'clear';
  if (s.state === 'gameover') return 'defeat';
  return levelTrack(s.levelNum, s.isBoss);
}

// Wing 1's two levels have their own music; later wings (locked for now) fall back to the hub.
export function levelTrack(n, isBoss) {
  if (isBoss) return 'boss_1';
  return TRACKS[`level_${n}`] ? `level_${n}` : 'hub';
}
