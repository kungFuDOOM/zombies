# Mall of the Dead: Design

Retro 90s co-op mall zombie arcade game with Telltale-style timed choices. This file records the design reasoning, the style rules and the Wing 1 consequence architecture. Code lives in `src/story.js` (choices and state), `src/cutscenes.js` (scenes and cameras) and `src/game.js` (consequences in play).

## 1. Mechanics study: Telltale's The Walking Dead

We borrowed the *mechanics* of the choice system, not the look or the characters.

| Telltale mechanic | What it does | Our version |
|---|---|---|
| Timed 4-choice UI | A dialogue prompt with up to four options and a clock | Three real options plus a silence slot, on a 9 second timer (`CHOICE_SECONDS`) |
| Silence option | Saying nothing is always a legal answer | A fourth `...` button. It has its own trust costs and its own outcome, never a free "skip" |
| Shrinking timer | The bar drains while you read | A thin bar under the choice buttons drains over 9 s |
| Timeout = silence | Running out of time is a decision | Timeout and the `...` button take the same code path (`isSilence`) |
| "X will remember that" toasts | A ping that something mattered, not what | Toasts name a survivor ("Mall Goth will remember that.") and never explain the effect |
| Persistent storyState | Choices follow you across episodes | `storyState` is saved on the campaign save and under its own key (`motd-story`) and carries into later wings |
| No karma meter | No good/evil bar, only relationships and facts | Four trust values (-5..+5), a few binary flags and an ordered choice log. Nothing adds up to a morality score |
| No-good-choice dilemmas | Every option costs something | Saving Ray costs the heavy gear. Looting costs Ray. Holding costs Ray's health. Silence costs both |
| End-of-wing recap | A summary of what you did and who noticed | The "Your Choices" screen after the boss lists each decision, Ray's fate and who remembers |

Design rules we took from the study:

1. A choice must change something the player will see again (a trust line, a hub NPC, a boss fight modifier), not only a line of dialogue.
2. Toasts are vague on purpose. The player should wonder what it will cost.
3. There is no "right" answer. If an option is strictly better, rewrite it.
4. Silence is never free.

## 2. Style lock

We do **not** copy Telltale's visual identity. That means no comic-ink outlines, no halftone shading, no comic-panel framing or panel-split layouts, and no painterly "graphic novel" filter.

Cutscenes use Mall of the Dead's own look:

- **Clean 3D retro 90s arcade-horror.** The same low-res pixel-scaled 3D renderer as gameplay, neon mall lighting (magenta, cyan, gold), checkerboard floors, no outline pass.
- **Cinematic 3D cameras.** Cutscenes are shot with moving 3D cameras (`wide`, `who`, `ray`, `locker`, `plaza`, `boss` shots in `resolveShot`), not static panels. Letterbox bars are allowed. Panel borders are not.
- **Clean dark translucent HUD.** Dialogue, choice buttons, toasts and the recap sit on dark translucent plates with plain type. No speech balloons, no caption boxes drawn like comic panels.

If a new scene or UI element needs a comic device to work, change the scene.

## 3. Six-wing roadmap

Each wing is a stage plus a boss, with its own theme, set of monsters and choices. Only Wing 1 is playable today. The others are listed, locked, on the Mall Directory in the Security Room.

| Wing | Area | Boss |
|---|---|---|
| 1 | Food Court | The Deep-Fry Butcher (built) |
| 2 | Arcade, Bowling & Batting Cages | TBD |
| 3 | Movie Theater | TBD |
| 4 | Fitness Center / Gym | TBD |
| 5 | Toy Store & Holiday Atrium | TBD |
| 6 | Hardware & Garden Center, then the Rooftop Helipad | TBD |

Later wings read the same `storyState`: Ray, trust values and flags set in Wing 1 should show up as callbacks.

## 4. Wing 1 consequence architecture

The wing is three scenes around two play stages. Flow: Scene 1, Food Court, Scene 2, level clear, Scene 3, the Butcher, the recap, back to the Security Room hub.

### Scene 1: the outbreak (`outbreak`)

Prompt: *How do we break into the Food Court?*

| Pick | Effect | Trust |
|---|---|---|
| Lock down the security gate first (`cop`) | The Food Court runs under a lockdown plan (`plan:lockdown`) | Mall Cop +2, Mall Goth -1 |
| Blow the music PA (`goth`) | Lure plan (`plan:lure`) | Mall Goth +2, Mall Cop -1 |
| Charge straight in (`biker`) | Charge plan (`plan:charge`) | Biker +2, Mall Cop -1 |
| Silence | Nobody commits (`plan:silence`) | Biker -1, Mall Cop -1 |

The plan feeds `foodCourtModifiers(story)`, which tunes the Food Court stage's opening.

### Scene 2: Ray vs the locker (`rayLocker`)

Ray, the pizza cook, is cornered while the Security Locker (the only heavy gear in the wing) is about to seal. The options are *Save Ray*, *Loot the Security Locker*, a hold-the-door option that leaves Ray injured, and silence, which loses both. The flags `rayAlive`, `rayFate` (`saved`, `injured`, `overrun`, `lost`) and `lockerLooted` are set, and `crisisModifiers(story)` applies the effect to the rest of the stage (the damage boost and what is left to fight).

### Scene 3: boss intro and recap

`bossIntroScene(story)` picks a tone from `bossModifiers(story)`: `hopeful` (Ray alive and well), `guilt` (looted), `strained` (Ray injured), or a lonely default (Ray lost or overrun). In the fight, a living Ray tosses pizza to heal the party every `rayEvery` seconds, and a looted locker gives the party a damage multiplier (`dmgMul`). After the Butcher falls, `recap(story)` builds the "Your Choices" screen. Ray appears in the Security Room hub only if `hubRayPresent(story)`. Otherwise his name tag stays on an empty locker.

### Skip-cutscene documented defaults

The "Skip cutscenes" toggle (for testing) still writes a real choice, so the consequences exist. The defaults are `DEFAULT_PICKS` in `src/story.js`:

- **Scene 1:** Mall Cop lockdown (`cop`)
- **Scene 2:** Save Ray (`save`)

Replaying Wing 1 clears that wing's choices first (`resetWing1`), so a fresh run starts from a clean slate.
