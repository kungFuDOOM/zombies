# Mall of the Dead

A retro 90s co-op mall zombie arcade game that runs in the browser in 3D, with **Telltale-style timed choices that have real consequences**. It's Black Friday, 1994. At 12:01 AM, during the Midnight Madness sale at Paragon Crossing in Bakersfield, something comes out of the air vents. Four thousand shoppers drop, then get back up. The full story (spoilers) is in [STORY.md](STORY.md).

It is plain JavaScript with no build step. The libraries are [three.js](https://threejs.org) and, for online co-op, [PeerJS](https://peerjs.com), both included in `vendor/` (MIT licensed). Sounds and music are synthesized. See [`assets/CREDITS.md`](assets/CREDITS.md) for the CC0 3D models.

Design notes, the style lock and the six-wing roadmap are in [DESIGN.md](DESIGN.md). Security notes are in [SECURITY.md](SECURITY.md).

## Play

```bash
npm start                # serves the game at http://localhost:8080 (this computer only)
HOST=0.0.0.0 npm start   # also reachable from a phone on the same Wi-Fi
npm test                 # runs the test suite (node:test)
```

Any static file server works too. The game uses ES modules, so opening `index.html` from disk won't work. You need a browser with WebGL. It's fully static, so it can be hosted on GitHub Pages (a service worker keeps repeat visits fast and the game playable offline).

## The four survivors

Four survivors are locked in the **Security Room**. Pick one, or play all four in co-op.

| Survivor | Weapon | Turbo |
|---|---|---|
| **Biker** | Chainsaw tank, thrown wrenches | Rev-charge |
| **Mall Cop** | Pump shotgun, big knockback | Riot blast |
| **Skater** | Spiked bat, the fastest runner | Kickflip dash |
| **Mall Goth** | Hairspray flamethrower | Boombox shockwave |

## The Security Room hub

Between fights you walk around the Security Room. From there you can:

- read the **Mall Directory** and choose a wing (Wing 1 is open; Wings 2 to 6 are listed and locked),
- spend cash at the upgrade counter on food, flashbangs, keycards and permanent Strength / Armor / Speed / Flash upgrades,
- check on Ray, if he made it.

## Wing 1: Food Court and the Deep-Fry Butcher

A neon graveyard of overturned tables and cold fryers, with a **Deep-Fry Butcher** waiting in the kitchen. Boss fights are about reading and dodging: every attack is telegraphed, the Butcher goes through phases, and flashbangs can't be spammed against him.

## Choices with real consequences

Choices are timed (about 9 seconds), with a shrinking bar. Three real options and a silence option `...`. If the timer runs out, you've chosen silence. There is no karma meter, only trust between the survivors, and the game tells you only that "someone will remember that".

- **Scene 1, the outbreak:** how do you break into the Food Court? Lock down the gate, blow the PA to lure the dead away, or charge in.
- **Scene 2, Ray vs the locker:** Ray the cook is cornered while the only heavy gear in the wing is about to seal. You can't have both.
- **Scene 3, the Butcher:** the boss intro and fight change with what you did to Ray. After the fight, a **Your Choices** recap shows what you decided and who remembers.

Choices are saved with your game, so they carry into later wings. Replaying Wing 1 starts with fresh choices. There's a "Skip cutscenes" test toggle. When used, Scene 1 defaults to the Mall Cop lockdown and Scene 2 to Save Ray. See [DESIGN.md](DESIGN.md).

## Controls

| | Move | Attack | Flashbang | Turbo (hold + attack) |
|---|---|---|---|---|
| **Keyboard** (one player) | WASD or Arrows | Space / F / Enter | E / G / `.` | Left Shift / Q / Right Shift |
| **Shared keyboard, player 1** | WASD | Space / F | E / G | Left Shift / Q |
| **Shared keyboard, player 2** | Arrows | Enter / `/` | `.` / `'` | Right Shift / `,` |
| **Gamepads** (up to 4) | Stick / D-pad | A / RT | B / Y | X / RB + A |

`Esc`/`P`/Start pauses · `M` mutes sound · `N` toggles music · `X` changes the pixel size. Choices can be picked with the number keys, the mouse, a tap or a gamepad.

Phones and tablets get on-screen touch controls automatically: drag on the left half to move and use the buttons on the right.

## Co-op

Up to **4 players** can play on one screen: gamepads join by pressing Attack, and two people can share a keyboard (press **2**). Friends can also join over the internet: the host picks **PLAY ONLINE WITH FRIENDS** on the title screen and shares the 8-letter room code. The host's browser runs the game and connections are peer-to-peer, using the free public PeerJS server only for matchmaking. Everyone needs the same version of the game. See [SECURITY.md](SECURITY.md) for how rooms are protected.

## Stats and leaderboard

The **STATS & LEADERBOARD** button on the title screen shows lifetime stats and the 10 best runs. Everything is stored in your browser with `localStorage`: there is no global leaderboard and no server.

## Project layout

```
index.html        canvas + module entry
sw.js             service worker: newest code after an update, offline play
server.js         zero-dependency static server (npm start)
src/main.js       game loop and state machine (title, select, hub, cutscenes, play, recap)
src/game.js       simulation: players, enemies, projectiles, pickups, story consequences
src/story.js      choices, trust, flags, persistent storyState, recap
src/cutscenes.js  the three Wing 1 scenes and their 3D cameras
src/campaign.js   wings, unlocking, upgrade counter, saved survivors, story text
src/bosses.js     the Deep-Fry Butcher: telegraphed moves, phases, stuns
src/level.js      procedural stage generation and the wing list
src/render3d.js, mall3d.js, models.js, heroes.js, monsters.js   3D rendering and models
src/hud.js        the dark translucent HUD, choice UI, toasts, menus
src/stats.js, leaderboard.js, lbprompt.js   local stats and leaderboard
src/net.js, netstate.js, lobby.js   online co-op
src/audio.js, music.js, music-data.js   synthesized sound and music
vendor/           three.js and PeerJS (MIT)
test/             node:test suite
tools/            asset, voice and music build scripts
```

## Rebuilding the 3D assets

The prepared models are committed, so this is only needed to change which models are used. See the header of `tools/build-assets.mjs` for the KayKit packs to clone, then:

```bash
npm install
npm run build-assets -- kaykit
```

## Tests

```bash
npm test
```
