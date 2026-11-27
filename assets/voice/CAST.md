# Voice cast: White Acre, Wing 1

The script is `lines.json` (85 lines). One line = one clip: `assets/voice/<id>.mp3`. `index.json` maps each id to its
file. A missing file is fine: the subtitle still shows (the two story screens fall back to the browser's voice).

| Speaker | Lines | Voice |
|---|---:|---|
| `mallCop` | 19 | ElevenLabs **Jon - Warm American** (`Hsmirri4X6khvaZNtgT5`). Man, about 40, Central Valley American. Dry, by-the-book night security; tired, then ashamed. Never shouts without cause. |
| `biker` | 13 | ElevenLabs **Callum - Husky Trickster** (`N2lVS1w4EtoT3dr4eOWO`). Man, about 45, rural Central Valley American. Low gravel, short sentences, deadpan; loud only when charging. |
| `mallGoth` | 13 | ElevenLabs **Cat - Droll and Dry** (`54Cze5LrTSyLgbO6Fhlc`). Woman, early 20s, flat California American. Dry and sardonic; quiet and sincere about Ray. |
| `skater` | 11 | ElevenLabs **Will - Relaxed Optimist** (`bIHbv24MWmeRgasZH58o`). Man, 19, Bakersfield American. Fast, cracking, "dude" energy; real fear under it. |
| `ray` | 9 | ElevenLabs **Carl - Upbeat, Crisp & Friendly** (`BisSY1UaEgMipJLxtUuX`). Man, about 30, Central Valley American. The pizza counter guy: warm, big, panicky when pinned. |
| `pa` | 7 | ElevenLabs **Daniel - Warm, Confident & Compelling** (`8GmsjNWRZ3Rk8VmRpvBZ`). **A calm man** (the uncredited Garrity pages), 50s, even American. Never hurries, never reacts. Unnamed in game. |
| `butcher` | 4 | ElevenLabs **Sam - Deep Americana** (`iRc49NKOKzEg1DVxmcRs`). Man, 50s, heavy American. A cheerful carvery pitch gone wet and broken; one hurt, quiet line. |
| `narrator` | 4 | ElevenLabs **Brady J – Gripping Suspense** (`kmjgtnoB3DMXA9wZpudu`). Man or woman, 40s, plain American. Low and restrained, for the two story screens. |
| `news` | 2 | ElevenLabs **Claire - Ultra Real** (`7A85ufQZSEaTbZ5eQ4f4`). Woman, 30s, 1994 local TV anchor. Bright, neutral broadcast delivery. |
| `radio` | 2 | ElevenLabs **Dave - Male Deep Voice** (`KRzS7KO2TLlh1BRPgHnB`). Man, 40s, clipped American dispatcher voice over a handset. |
| `ashby` | 1 | ElevenLabs **Adam - Distinct, Deep and Engaging** (`bfGb7JTLUnZebZRiFYyq`). Dr. Paul Ashby. Man, 40s, measured American. Quiet, sincere, over a radio. |

There are no `garrity` or `dispatch` speakers: neither has a line of their own.

All 85 lines are recorded as mono 24 kHz 48 kbps MP3s in this folder, generated with ElevenLabs model `eleven_multilingual_v2`.

## Delivery notes

- Record clean and dry. The game itself narrows `pa`, `news`, `radio` and `ashby` to a speaker/radio band.
- Export mono MP3 with no leading silence and a short tail. The subtitle waits for the clip to finish.
- The opening film runs on a fixed clock: a clip longer than its slot is played up to 15% faster, and the next line
  cuts it off. Keep opener reads brisk.
- A line heard twice has one id: "Security, please confirm the east doors." (opener and ending), "Refinery's nine miles
  off..." (opener and the plan), and "Four thousand dropped..." (the Skater in the opener; the intro story screen
  reuses that clip).

## Adding the files

Drop `<id>.mp3` into this folder. Do **not** run `tools/build-voice.py`: it rewrites `index.json` and deletes MP3s it
did not make. The game never calls a voice service.
