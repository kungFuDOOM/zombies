# Asset credits

The 3D models and animations in `assets/models/` come from free packs, all released under
**Creative Commons Zero (CC0 1.0)**: free for personal, educational and commercial use, no
attribution required (credited here anyway, with thanks). The KayKit packs (dungeon, heroes and
props) are by **Kay Lousberg** ([kaylousberg.com](https://kaylousberg.com)); the characters are by
**Quaternius** (see below).

| Pack | Used for |
|---|---|
| [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) | The animation rig Ray, the clerk and the realm monsters are built on (`src/heroes.js`) |
| [KayKit Character Pack: Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) | Skeleton rig and animations used by the bosses and the Security Room NPCs (zombies and The Grim Shopper use the Quaternius rig below) |
| [KayKit Dungeon Remastered](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) | Floors, walls, gates, torches, banners, barrels, food, coins, keys, potions |
| [KayKit Halloween Bits](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) | Bones, skulls, graves, shrines and candles (generators and dungeon clutter) |

## Characters (survivors, zombies, Mulchmaw)

The survivors and zombies are rigged, animated characters by **Quaternius**
([quaternius.com](https://quaternius.com)), from the **Ultimate Modular Men** and **Ultimate Modular
Women** packs (February 2022), released under **CC0 1.0**:
[Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) and
[Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html). The files were
fetched from poly.pizza (direct GLB download, no login). Mulchmaw is the "Giant" from Quaternius'
**Ultimate Monsters** pack, also CC0.

| Model | Source | Used for |
|---|---|---|
| Men's Punk | [poly.pizza/m/BTALZymknF](https://poly.pizza/m/BTALZymknF) | Biker |
| Men's Worker | [poly.pizza/m/Yg2bQZO6Hj](https://poly.pizza/m/Yg2bQZO6Hj) | Mall Cop (hard hat dropped) |
| Men's Beach | [poly.pizza/m/DojKLcO34E](https://poly.pizza/m/DojKLcO34E) | Skater |
| Women's Punk | [poly.pizza/m/djXoqejw6w](https://poly.pizza/m/djXoqejw6w) | Mall Goth |
| Men's Casual | [poly.pizza/m/kZ3DmIoGip](https://poly.pizza/m/kZ3DmIoGip) | Walker |
| Men's Farmer | [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) | Sprinter (hat dropped) |
| Men's Hoodie | [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) | Brute |
| Men's Suit (BusinessMan) | [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) | The Grim Shopper (undead mall manager, `ch_zombie_shopper.glb`) |
| Women's Casual (AnimatedWoman2) | [Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html) | Spitter |
| Giant | [poly.pizza/m/BldaiPtyJa](https://poly.pizza/m/BldaiPtyJa) (Ultimate Monsters) | Mulchmaw (wing 6 boss) |

Every model above is CC0. The Men's Punk rig and clips are the shared survivor animation library
(`anims_survivor.glb`), and the Women's Punk clips are `anims_women.glb`.

`tools/build-characters.mjs` converts each pack's flat-colour materials into vertex colours (outfits
recoloured to the Mall of the Dead looks, wounds painted on the undead), strips the clips into shared
animation libraries, and meshopt-compresses the result. Caps, shades, bandana, skirt, shoe overlays and
weapons are attached in code (`src/charProps.js`).

The earlier files were converted with `npm run build-assets -- <dir-with-the-four-repos>` (see
`tools/build-assets.mjs`): unused meshes and animations are stripped, one shared animation
library is extracted, and everything is meshopt-compressed. Class-coloured capes are applied at
load time.

## Announcer voice

The announcer lines in `assets/voice/` were generated for this project with the
[Kokoro](https://github.com/hexgrad/kokoro) text-to-speech model (Apache-2.0, voice
"am_michael") through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), then given an
arcade-announcer treatment with ffmpeg. Regenerate them with `tools/voice-lines.mjs` and
`tools/build-voice.py` (instructions at the top of that file) after changing any line.

No assets from other games (art, models, audio, levels) are used.

## Music and sound

All music is **original to this project**: it is composed as data in `src/music-data.js` and
synthesized live with Web Audio by `src/music.js` (no samples, no recordings, nothing
downloaded). The sound effects in `src/audio.js` are synthesized the same way. No third-party
audio is included.

## Cinematic audio

The opening cinematic and the cutscene stings (`src/cineAudio.js`) are synthesized at runtime with
Web Audio oscillators and noise. There are no samples, recordings or third-party music. The PA
announcement uses the player's own browser speech voice, pushed low and slow.

## Session 1 visual overhaul (original work, no new third-party assets)
- `src/undead.js` (procedural zombie gore shader), the zombie face/eye/glow meshes and the survivor outfits in `src/charProps.js` are original procedural geometry and shaders (project licence); no new asset files were added.
