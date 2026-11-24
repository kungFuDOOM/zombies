# Asset credits

All 3D models and animations in `assets/models/` come from free packs by **Kay Lousberg**
([kaylousberg.com](https://kaylousberg.com)), released under
**Creative Commons Zero (CC0 1.0)**: free for personal, educational and commercial use, no
attribution required (credited here anyway, with thanks).

| Pack | Used for |
|---|---|
| [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) | The animation rig Ray, the clerk and the realm monsters are built on (`src/heroes.js`) |
| [KayKit Character Pack: Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) | Skeleton rig and animations used for zombies |
| [KayKit Dungeon Remastered](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) | Floors, walls, gates, torches, banners, chests, barrels, food, coins, keys, potions |
| [KayKit Halloween Bits](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) | Bones, skulls, graves, shrines and candles (generators and dungeon clutter) |

## Characters (survivors, zombies, Mulchmaw)

The four survivors, the zombies and Mulchmaw are hand-modelled, rigged and animated characters by
**Quaternius** ([quaternius.com](https://quaternius.com)), from the **Zombie Apocalypse Kit** and the
**Ultimate Monsters** pack. Quaternius' pack pages state **CC0 1.0** (public domain,
[Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html)). The files were fetched
from poly.pizza's mirror of the packs (direct download, no login). poly.pizza labels two of them
(Zombie Chubby, Zombie Arm) *CC-BY 3.0* instead, so they are credited as if BY applied: "Zombie Chubby" and
"Zombie Arm" by Quaternius, via poly.pizza.

| Model (source) | Used for |
|---|---|
| Matt ([poly.pizza/m/66kQ4dBBC7](https://poly.pizza/m/66kQ4dBBC7)) | Biker |
| Sam ([poly.pizza/m/UcLErL2W37](https://poly.pizza/m/UcLErL2W37)) | Mall Cop |
| Shaun ([poly.pizza/m/eJFT9MxzOM](https://poly.pizza/m/eJFT9MxzOM)) | Skater, and the survivors' shared animation library |
| Lis ([poly.pizza/m/gjuwleUT1U](https://poly.pizza/m/gjuwleUT1U)) | Mall Goth |
| Zombie Basic ([poly.pizza/m/VlXjG0N8Eg](https://poly.pizza/m/VlXjG0N8Eg)) | Walker and Sprinter (tint and slimming) |
| Zombie Arm ([poly.pizza/m/KaVJET0WHx](https://poly.pizza/m/KaVJET0WHx)) | Brute |
| Zombie Chubby ([poly.pizza/m/22K0aSZkHV](https://poly.pizza/m/22K0aSZkHV)) | Spitter |
| Giant ([poly.pizza/m/BldaiPtyJa](https://poly.pizza/m/BldaiPtyJa), Ultimate Monsters) | Mulchmaw (wing 6 boss) |

`tools/build-characters.mjs` bakes the kit's swatch texture into recoloured vertex colours (outfits
re-coloured to the Mall of the Dead looks, wounds painted on the undead), strips the kit's weapons,
and meshopt-compresses the result. Caps, shades, bandana, skirt and the weapons are attached in code
(`src/charProps.js`).

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
