// The six wing bosses. Only the Deep-Fry Butcher (wing 1) is playable; wings 2-6 are stubs so the
// roster, their combat numbers and their models exist before their stages do (see DESIGN.md 5.5).
// Every new move name is first an alias of a move bosses.js already implements (`alias`), so a
// stub boss can be fought end to end before its custom attacks are written.
//   scale: height in survivors (the Butcher is ~2.6x).  moves: [phase 1, phase 2, phase 3].

export const BOSS_ROSTER = [
  { wing: 1, id: 'butcher', model: 'butcher', name: 'The Deep-Fry Butcher', built: true, hp: 3200, speed: 66, dmg: 16, scale: 2.6, color: '#d8a040', horn: '#e8e0c8',
    moves: [['sweep', 'slam', 'grease'], ['sweep', 'slam', 'grease', 'summon', 'charge'], ['sweep2', 'slam2', 'grease', 'summon', 'charge2']] },
  { wing: 2, id: 'bowler', model: 'bowler', name: 'The Pin Boy', built: false, hp: 4000, speed: 72, dmg: 18, scale: 2.4, color: '#2a9a96', horn: '#40ff90',
    moves: [['strikeRoll', 'pinScatter', 'fastball'], ['strikeRoll', 'pinScatter', 'fastball', 'ballReturn', 'summon'], ['strikeRoll2', 'pinScatter2', 'fastball', 'ballReturn', 'tilt']] },
  { wing: 3, id: 'projectionist', model: 'projectionist', name: 'The Abatement Ambush', built: false, hp: 4600, speed: 60, dmg: 18, scale: 3.0, color: '#a03040', horn: '#e8d8a0',
    moves: [['spotlight', 'reelToss', 'filmLash'], ['spotlight', 'reelToss', 'filmLash', 'intermission', 'summon'], ['spotlight2', 'reelToss2', 'filmLash', 'intermission', 'finalReel']] },
  { wing: 4, id: 'maxrep', model: 'maxrep', name: 'Mr. Paragon', built: false, hp: 5400, speed: 80, dmg: 22, scale: 2.8, color: '#8a7a9a', horn: '#ff8a30',
    moves: [['deadlift', 'plateToss', 'treadmillCharge'], ['deadlift', 'plateToss', 'treadmillCharge', 'flex', 'proteinSpew'], ['deadlift2', 'plateToss2', 'treadmillCharge2', 'flex', 'proteinSpew']] },
  { wing: 5, id: 'santa', model: 'santa', name: 'The Village Santa', built: false, hp: 6200, speed: 62, dmg: 20, scale: 2.8, color: '#b02030', horn: '#f0ece0',
    moves: [['caneSweep', 'sackSlam', 'naughtyList'], ['caneSweep', 'sackSlam', 'naughtyList', 'toySwarm', 'caneHook'], ['caneSweep2', 'sackSlam2', 'naughtyList', 'toySwarm', 'sackMaw']] },
  { wing: 6, id: 'mulchmaw', model: 'mulchmaw', name: 'The Crew Chief', built: false, hp: 7200, speed: 56, dmg: 24, scale: 3.0, color: '#ffa020', horn: '#60e060',
    moves: [['chipperSpray', 'hedgeSweep', 'seedBomb'], ['chipperSpray', 'hedgeSweep', 'seedBomb', 'rootBurst', 'summon'], ['chipperSpray2', 'hedgeSweep2', 'seedBomb', 'rootBurst2', 'rotorWash']] },
];

// stub move -> an existing bosses.js move that plays in its place until the real one is written
export const MOVE_ALIAS = {
  strikeRoll: 'charge', strikeRoll2: 'charge2', pinScatter: 'slam', pinScatter2: 'slam2', fastball: 'grease', ballReturn: 'grease', tilt: 'slam2',
  spotlight: 'sweep', spotlight2: 'sweep2', reelToss: 'grease', reelToss2: 'grease', filmLash: 'sweep', intermission: 'summon', finalReel: 'sweep2',
  deadlift: 'slam', deadlift2: 'slam2', plateToss: 'grease', plateToss2: 'grease', treadmillCharge: 'charge', treadmillCharge2: 'charge2', flex: 'summon', proteinSpew: 'grease',
  caneSweep: 'sweep', caneSweep2: 'sweep2', sackSlam: 'slam', sackSlam2: 'slam2', naughtyList: 'grease', toySwarm: 'summon', caneHook: 'sweep', sackMaw: 'slam2',
  chipperSpray: 'sweep', chipperSpray2: 'sweep2', hedgeSweep: 'sweep', hedgeSweep2: 'sweep2', seedBomb: 'grease', rootBurst: 'slam', rootBurst2: 'slam2', rotorWash: 'charge2',
};

export const bossById = (id) => BOSS_ROSTER.find((b) => b.id === id) || BOSS_ROSTER[0];
