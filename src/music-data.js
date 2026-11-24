// The music table: one original track for every level, boss, hub, cutscene, menu and stinger.
// Pure data (no Web Audio), so it can be unit tested and rendered offline. src/music.js
// turns a spec into sound.
//
// How a spec is read:
//   root  MIDI note of the key's tonic        mode  a scale from SCALES
//   prog  one scale degree (1-7) per bar; each bar's chord is built from the scale
//   lead.mot / arp.pat / bass.pat   see the legends below
//   drums names a pattern in DRUMS            boss  tracks get intensity layers
//   once  a stinger: plays through one time and stops
// Lead motifs are strings of 16th-note steps: 1-9 are scale degrees (8 = the octave),
// a-c go higher (a = 10th ...), '.' is a rest and '-' holds the previous note.
// Bass patterns are 16 steps: r root, 5 fifth, o octave, 7 flat seventh, c half step up.

export const SCALES = {
  minor:   [0, 2, 3, 5, 7, 8, 10],
  dorian:  [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  major:   [0, 2, 4, 5, 7, 9, 11],
  lydian:  [0, 2, 4, 6, 7, 9, 11],
  mixo:    [0, 2, 4, 5, 7, 9, 10],
  hminor:  [0, 2, 3, 5, 7, 8, 11],
  pdom:    [0, 1, 4, 5, 7, 8, 10],
};

const N = { C: 48, 'C#': 49, D: 50, Eb: 51, E: 52, F: 53, 'F#': 54, G: 55, Ab: 56, A: 57, Bb: 58, B: 59 };

// k kick, s snare, h hat, o open hat, t tom ('x' hit, 'g' ghost note)
export const DRUMS = {
  none:    { k: '', s: '', h: '', o: '', t: '' },
  soft:    { k: 'x.......x.......', s: '', h: '..x...x...x...x.', o: '', t: '' },
  sparse:  { k: 'x...............', s: '', h: '', o: '', t: '........g.......' },
  march:   { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '', t: '' },
  skip:    { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.', t: '' },
  half:    { k: 'x.......x..x....', s: '........x.......', h: 'x...x...x...x...', o: '', t: '......x.......xx' },
  tribal:  { k: 'x.......x.......', s: '', h: '..x...x...x...x.', o: '', t: 'x..x..x.x..x.x..' },
  drive:   { k: 'x...x...x...x...', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx', o: '', t: '' },
  gallop:  { k: 'x..xx..xx..xx..x', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x.......x.....', t: '' },
  hammer:  { k: 'x.x.x.xxx.x.x.xx', s: '....x.......x.xx', h: 'x.x.x.x.x.x.x.x.', o: '.......x.......x', t: '' },
  stomp:   { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '', t: 'x.....x.....x.x.' },
  fury:    { k: 'xx.xxx.xxx.xxx.x', s: '..x.x.x...x.x.x.', h: 'xxxxxxxxxxxxxxxx', o: '.x...x...x...x..', t: '' },
  epic:    { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '', t: 'x.......x.x.x...' },
  rim:     { k: 'x.......x.......', s: '....g.......g...', h: '', o: '', t: '' },
};

const ARP = (w, pat, rate, oct = 1, vol = 0.03) => ({ w, pat, rate, oct, vol });
const LEAD = (w, mot, oct = 1, vol = 0.07) => ({ w, mot, oct, vol });
const PAD = (w, vol = 0.03, cut = 1100) => ({ w, vol, cut });
const BASS = (w, pat, vol = 0.1, cut = 600) => ({ w, pat, vol, cut });

// helper so each entry stays one readable block
function T(id, name, keyName, mode, bpm, prog, parts, more = {}) {
  return { id, name, key: `${keyName} ${mode === 'major' ? 'major' : mode === 'minor' ? 'minor' : mode}`, root: N[keyName], mode, bpm, prog, ...parts, ...more };
}

export const TRACKS = {
  // ----- menus and the Security Room -----
  title: T('title', 'Neon Grave Shift', 'D', 'minor', 84, [1, 6, 7, 5, 1, 4, 7, 5],
    { pad: PAD('choir', 0.04, 1500), bass: BASS('sine', 'r.......r.......', 0.12), arp: ARP('bell', 'up', 4, 2, 0.02), lead: LEAD('horn', '1---.-3-5---4-3-1---.-3-5-7-8---.---', 1, 0.06), drums: 'sparse' }),
  story: T('story', 'Black Friday Alarm', 'A', 'dorian', 66, [1, 1, 4, 5],
    { pad: PAD('choir', 0.045, 1000), bass: BASS('sine', 'r...............', 0.09), arp: ARP('bell', 'skip', 4, 2, 0.018), lead: LEAD('bell', '5---.---3---2---1---.---.---.---', 1, 0.05), drums: 'none' }),
  hub: T('hub', 'Security Room Slow Jam', 'G', 'mixo', 104, [1, 4, 1, 5, 1, 6, 4, 5],
    { pad: PAD('organ', 0.025, 1300), bass: BASS('tri', 'r..r..5.r..r..5.', 0.1), arp: ARP('pluck', 'updown', 2, 1, 0.035), lead: LEAD('flute', '5.3.5.8.-.7.5.3.2.3.5.-.-.....2.3.5.7.8.-.9.8.7.5.-.....', 1, 0.055), drums: 'half' }),
  training: T('training', 'Mall Orientation', 'C', 'major', 112, [1, 5, 6, 4, 1, 5, 4, 5],
    { pad: PAD('tri', 0.03, 1500), bass: BASS('square', 'r.o.r.o.r.o.5.o.', 0.07, 700), arp: ARP('pluck', 'up', 2, 1, 0.03), lead: LEAD('pipe', '1.3.5.3.1.3.5.-.4.6.8.6.4.6.8.-.5.7.9.7.5.4.3.2.1.-.....', 1, 0.05), drums: 'march' }),
  shop: T('shop', 'Cash Counter Lounge', 'F', 'lydian', 92, [1, 2, 1, 5, 1, 6, 2, 5],
    { pad: PAD('organ', 0.025, 1100), bass: BASS('sine', 'r.....5.r.....5.', 0.1), arp: ARP('bell', 'broken', 3, 1, 0.04), lead: LEAD('flute', '3.-.5.-.8.-.7.5.-.4.-.6.-.8.7.-.5.-.3.-.-.-.....', 1, 0.05), drums: 'soft' }),

  // ----- cutscenes: tension for the Telltale-style scenes -----
  cut_opening: T('cut_opening', 'Alarms Are Tripping', 'F#', 'minor', 72, [1, 4, 1, 5, 6, 4, 5, 1],
    { pad: PAD('choir', 0.045, 900), bass: BASS('sine', 'r...............', 0.1), arp: ARP('glass', 'down', 3, 2, 0.022), lead: LEAD('bell', '5-.-.---4-.-3---2-.-.---1-.-.---.---7---1-.-.---', 1, 0.04), drums: 'rim' }),
  cut_crisis: T('cut_crisis', 'Ray Is Still In There', 'Eb', 'phrygian', 78, [1, 2, 1, 7, 1, 2, 4, 1],
    { pad: PAD('choir', 0.04, 600), bass: BASS('sine', 'r..r....r..c....', 0.13, 400), arp: ARP('glass', 'skip', 4, 1, 0.025), lead: LEAD('bell', '.---.---5---.---4---.---3---.---2---.---1---.---', 1, 0.04), drums: 'tribal' }),
  cut_boss: T('cut_boss', 'Something In The Kitchen', 'Eb', 'dorian', 88, [1, 4, 7, 6, 1, 4, 5, 5],
    { pad: PAD('choir', 0.05, 1500), bass: BASS('sine', 'r.......r.......', 0.11), arp: ARP('bell', 'up', 4, 2, 0.026), lead: LEAD('choir', '5---.---6---5---3---.---2---3---1---.---.---.---', 1, 0.055), drums: 'tribal' }),
  recap: T('recap', 'Your Choices', 'B', 'dorian', 98, [1, 3, 6, 7, 1, 4, 6, 5],
    { pad: PAD('choir', 0.04, 1800), bass: BASS('sine', 'r.......5.......', 0.1), arp: ARP('bell', 'up', 2, 2, 0.03), lead: LEAD('flute', '5---3-5-8---7-5-6---5-3-2---3-5-7---.---', 1, 0.05), drums: 'soft' }),

  // ----- Wing 1: Food Court -----
  level_1: T('level_1', 'Food Court Muzak Massacre', 'E', 'pdom', 118, [1, 2, 1, 6, 1, 2, 1, 5],
    { pad: PAD('saw', 0.022, 1000), bass: BASS('saw', 'r.rr..r.r.rr.5r.', 0.08, 500), arp: ARP('pluck', 'updown', 1, 1, 0.026), lead: LEAD('reed', '1.2.3.-.2.1.2.3.5.-.4.3.2.-.1.-.-.2.3.5.6.-.5.3.2.-.1.-.-.-.', 1, 0.06), drums: 'skip' }),
  boss_1: T('boss_1', 'The Deep-Fry Butcher', 'E', 'minor', 148, [1, 1, 6, 5, 1, 1, 7, 5],
    { pad: PAD('saw', 0.03, 1400), bass: BASS('saw', 'rrr.rrr.rrr.r7r.', 0.1, 700), arp: ARP('saw', 'updown', 1, 1, 0.022), lead: LEAD('brass', '1-.1.3-.5-.4.3-.1-.1.3-.5-.8-.-.-.7.5-.4.3.4.5.-.-.-', 1, 0.075), drums: 'hammer' }, { boss: true }),

  // ----- stingers (play once) -----
  clear: T('clear', 'Stage Clear', 'C', 'major', 128, [1, 4, 5, 1],
    { pad: PAD('organ', 0.04, 2400), bass: BASS('square', 'r.......r.......', 0.07, 800), arp: ARP('pluck', 'up', 1, 2, 0.03), lead: LEAD('pipe', '5.5.8.-.-.a.8.-.9.8.7.5.8.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.', 1, 0.06), drums: 'none' }, { once: true }),
  bossclear: T('bossclear', 'Butcher Fried', 'D', 'major', 112, [1, 4, 5, 1, 6, 4, 5, 1],
    { pad: PAD('choir', 0.05, 2400), bass: BASS('saw', 'r.......5.......', 0.08, 700), arp: ARP('bell', 'up', 2, 2, 0.03), lead: LEAD('brass', '1---3-5-8---7-5-8---a-8-9---8-7-5---.-.-.---8---a-c---.---.---.---.---.---', 1, 0.07), drums: 'march' }, { once: true }),
  defeat: T('defeat', 'Lunch Is Served', 'D', 'phrygian', 60, [1, 2, 1, 1],
    { pad: PAD('choir', 0.05, 800), bass: BASS('sine', 'r...............', 0.12), arp: ARP('bell', 'down', 4, 1, 0.02), lead: LEAD('horn', '5---4---3---2---1---.---.---.---', 1, 0.06), drums: 'sparse' }, { once: true }),
  victory: T('victory', 'Closing Time', 'C', 'major', 96, [1, 5, 6, 4, 1, 5, 4, 5],
    { pad: PAD('choir', 0.05, 2200), bass: BASS('saw', 'r.......5.......', 0.08, 700), arp: ARP('bell', 'up', 2, 2, 0.03), lead: LEAD('brass', '5---8---a-9-8---7-5-3-5-8---7-5-.-4-5-6---8---a---c---9---8---', 1, 0.07), drums: 'epic' }),
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

// Which track plays for what is on screen. `s` = { state, hub, tutorial, isBoss, levelNum, cutscene }.
export function trackFor(s) {
  if (s.state === 'loading' || s.state === 'title' || s.state === 'confirm' || s.state === 'stats' || s.state === 'select') return 'title';
  if (s.state === 'story') return 'story';
  if (s.state === 'shop') return 'shop';
  if (s.state === 'recap') return 'recap';
  if (s.state === 'cutscene') return s.cutscene === 'crisis' ? 'cut_crisis' : s.cutscene === 'boss' ? 'cut_boss' : 'cut_opening';
  if (!s.inLevel) return 'title';
  if (s.hub) return 'hub';
  if (s.tutorial) return 'training';
  if (s.state === 'levelclear') return s.isBoss ? 'bossclear' : 'clear';
  if (s.state === 'gameover') return 'defeat';
  return levelTrack(s.levelNum, s.isBoss);
}

// Wing 1's two levels have their own music; later wings (locked for now) fall back to the hub.
export function levelTrack(n, isBoss) {
  if (isBoss) return 'boss_1';
  return TRACKS[`level_${n}`] ? `level_${n}` : 'hub';
}
