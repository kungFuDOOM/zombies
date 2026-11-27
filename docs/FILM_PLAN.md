# FILM_PLAN: Mall of the Dead cutscenes as a zombie horror film

> The story has since changed to White Acre ([STORY.md](../STORY.md)). Dialogue, props and STORY.md section references below describe the earlier story.

Status: written against commit 992a486; checklist items 1-11 are implemented. As built, where it differs from the text below:
- Item 12: the capture tool is updated (and `tools/cine-check.mjs` added), but `sw.js` is NOT bumped yet (owner's call).
- The level behind Scene 1's handoff is built on the hard cut into the handoff, not during the reply lines (D4), so its one stall never lands mid-line.
- The 'rise' start pose (D4) also checks line of sight to the party, because a spawn can sit against a wall.
- Of the nice-to-haves, only a cheap High anamorphic streak (a form of N1) and camera motion blur are in. Not done: `relens` / `mm` lens changes (so close-ups keep their old lenses), N2-N10, the far-background walker in opener shot 1.
Audience: one engineer implementing in one session. Section E is the ordered checklist. Every item leaves the game working, so stopping early still ships something.

User brief, condensed:
1. The cutscenes should look and feel like a horror zombie film in a theater: slow dread, then a hit; jump scares; shaky handheld in chases; a dirty desaturated grade with sickly greens; failing lights; fog and silhouettes; terrified close-ups; blood on the lens; screams, stingers, drones, heartbeat; silence right before a shock.
2. Every scene that leads into gameplay ends on the real gameplay camera, so the cut to play has no pop, no black frame and no jump.

Hard limits (LOCKED, do not touch): survivor names, roles and weapons; the clean 3D 90s mall look; Wings 2-6; gameplay layout and controls (floating left joystick, Xbox A/B/X/Y); STORY.md dialogue (this plan adds no spoken lines); skip behaviour (D6); co-op/netplay sync (D5). All content must be original: no copied scenes, lines, music or assets, and every sound is synthesized in our own code. No comic inking or halftone. The only brand is kungFuDOOM, and no real person's name appears anywhere.

---

## A. Audit: what the toolkit does today, and what is missing

### A1. What exists (and is good, so keep it)

| Area | What it does | Where |
|---|---|---|
| Shot timeline | `CinePlayer` lays shots end to end, fires cues, subtitles, name cards and title, and runs an impulse-shake list | `src/cineCore.js:87-147` |
| Camera grammar | `dolly`, `crane`, `push`, `ots`, `whip`, `orbit`, plus timed `seq` segments, with easing presets | `src/cineCore.js:26-81` |
| Handheld | Smooth sum of sines (`wob`), applied as x/y translation and a tiny roll; `hand` is a per-shot scalar | `src/cineCore.js:84`, `:157-165` |
| Visible FOV | A shot's `fov` is the vertical FOV between the bars; the lens is widened to cover them | `src/cineCore.js:172-176` |
| Rack focus | DOF focus distance eases over the shot (`dof.focus:[a,b]`, `from`, `to`), High only | `src/cineCore.js:211-216` |
| Frame-rate guard | If High averages more than 55 ms per frame after 90 frames, it falls back to Low for the rest of the film | `src/cineCore.js:188-196` |
| High post chain | Half-float HDR target with MSAA 4 and a depth texture; 2-level bloom; composite with 14-tap DOF gather, whip-only motion blur, bloom, edge chromatic fringe, ACES, lift/gain/gamma/sat, vignette, grain | `src/cinePost.js:287-351`, `:364-447` |
| Low path | Plain forward render to the canvas with renderer ACES; the overlay adds a radial vignette | `src/cinePost.js:412-417`, `src/cineOverlay.js:320-324` |
| Lights | `LightRig` with a fixed light count (no recompiles), eased targets, optional flicker function per light | `src/cineFx.js:31-82` |
| Flicker | `flicker(t, seed, dying)`: a binary stutter from a hash | `src/cineFx.js:21-25` |
| Volumetrics (fake) | Additive soft cones (`makeShaft`), drifting dust (`DustField`), sparks (`SparkPool`) | `src/cineFx.js:94-176` |
| Acting | `look`, `raise`, `lean`, `twist`, `faceTo`, `play`/`loop`, layered after the mixer, once per bone per frame | `src/cineStage.js:201-266` (rule at `:251`) |
| Overlay | Letterbox, typed subtitles in a panel, hero name cards, title slam, skip hint | `src/cineOverlay.js:316-433` |
| Sound | Oscillator and noise cues on one bus: PA chime, heartbeat, horde, moan, stings, riser, `duck`, `stopAll` | `src/cineAudio.js` (heartbeat `:249`, stings `:206-219`, `introBed` `:245`, `duck` `:380`) |
| Opener | "Doorbuster", 11 shots, 78 s, gate, skip, warm-up compile | `src/intro.js` (shots `:293-494`, cues `:205-274`) |
| Story films | One `StoryFilm` per scene, driven only by `Cutscene.view().film` (so guests see the same thing); every shot resets the stage | `src/storyFilm.js:1-15`, `:383-448`, SHOTS `:501-961` |
| Beat logic | Cards, lines, silent shots, timed choices; per-beat `cues` (sting, shake, flash, slow) | `src/cutscenes.js:19-36`, `:184-376` |
| Netplay | The host sends `cut.view()` (including `film`) and `g.cutCam`; guests rebuild the film from it | `src/main.js:789`, `src/netstate.js:40`, `:158-167`, `:272` |

### A2. What is wrong or missing (mapped to the brief)

| # | Requirement | Today | Gap / bug | Where |
|---|---|---|---|---|
| 1 | True 2.39:1 scope | Opener bars are 0.092 of the height (about 1.84:1); story bars are 42 px for lines and 90 px for cards, clamped to 38/64 px on touch | Not 2.39:1, bars change height mid-scene, and portrait gets *thinner* bars plus a 1.16x wider lens, so framing changes with orientation even though the 3D canvas is always 3:2 | `cineCore.js:107`, `:174`, `:183`; `cutscenes.js:180-181`, `:327`; `hud.js:1291-1292`; `netstate.js:163` (bar capped at 110) |
| 2 | Filmic tone map + LUT-style grade, per-scene presets | High: ACES then lift/gain/gamma/sat. Low: renderer ACES only | No split toning, no sickly-green mid push, no contrast pivot, no black floor. **Low has no grade and no grain at all.** Four ad-hoc presets live in storyFilm | `cinePost.js:341-344`, `:412-417`; `storyFilm.js:45-48` |
| 3 | Grain, gate weave, vignette, slight CA (High) | Grain changes every frame (video-like); CA fixed at 0.006 and always on | No weave; no 24 fps grain cadence; CA cannot spike on hits; vignette ignores the bars | `cinePost.js:336-349` |
| 4 | Anamorphic flares on practicals | none | missing on both tiers | none |
| 5 | DOF / rack focus (High) | exists | Aperture does not scale with focal length; face shots are 26-34 deg (wide lenses), so the bokeh is weak | `cinePost.js:298-302`; storyFilm close-ups |
| 6 | Camera motion blur on fast moves (High) | Only on `whip` shots (`c.blur`), horizontal only | Dollies, pans and shakes get none | `cineCore.js:204-208`, `cinePost.js:328-332` |
| 7 | Volumetric shafts and haze | Additive cones and dust | Shafts do not flicker with their lights; no depth haze | `cineFx.js:94-141` |
| 8 | Horror handheld | Translation-only sines | No rotational shake (which is what reads as "handheld"), no operator jolts, no panic mode | `cineCore.js:157-165` |
| 9 | Failing lights | Binary hash stutter | No hum, no die-then-restrike ballast, no sound sync, and random timing means story-scene sounds cannot line up with it | `cineFx.js:21-25` |
| 10 | Blood / grease on the lens | none | missing | none |
| 11 | Silence before shocks | `cine.duck()` ducks only the cine bus | Music keeps playing under "silence"; no helper to schedule a silence *before* a hit | `cineAudio.js:380`; `audio.js:279-290` |
| 12 | Screams, drones, impacts | horde, moan, stings, introBed | No scream (far, or cut short), no sub impact, no accelerating heartbeat, no tube restrike, no neck crack, no panic breath | `cineAudio.js` |
| 13 | J/L-cut audio | Cues fire only at or after a beat's start | No way for the next shot's sound to lead the cut | `cutscenes.js:300-309` |
| 14 | Studio card, credits card | Title slam only | No "kungFuDOOM presents", no end credits | `intro.js:126`; `cutscenes.js:172` |
| 15 | Cut to gameplay | `finishCutscene` disposes the film and play starts on the next frame | **Hard pop.** The film's last shot is on a separate set (office, pizza stall, kitchen), and the next frame is the gameplay camera with HUD, a different pixel ratio (crisp to pixelated), fog and lights all at once. Scene 1 also loads the Food Court *after* the scene (`go()`), so its first gameplay frame builds the level (a hitch) | `main.js:546`, `:606-614`; `render3d.js:677-681`; `storyFilm.js:79-85` |
| 16 | Shakes/flashes for guests | Host calls `storyFilm.hit()` from cues | **Guests never get film shakes or flashes** (cues are host-only) | `main.js:662-667` |
| 17 | Subtitles usable in portrait | Panel sits above the bar, over the picture | Fine in landscape; in portrait the panel covers a third of a 163 px tall picture | `cineOverlay.js:349-390` |
| 18 | Title placement | Title sign is drawn at y 112-172 | It would sit inside a 119 px scope bar | `hud.js:457-470`; `cineOverlay.js:419-433` |

Facts the plan depends on (verified):

- The 3D canvas and the HUD canvas are always 960x640 (3:2). `fit()` scales the `#stage` box to the window and the page around it is black (`main.js:1277-1281`, `index.html:21-24`). So **the picture aspect inside the stage never changes**; only its CSS size does.
- Handheld phones are told to rotate to landscape (`touch.js:37-40`, `:65-70`). Portrait is the "tap here to play anyway" edge case, but it must still work.
- Low is the default on phones and iPads (`render3d.js:22-36`).
- `StoryFilm` must never play sounds. Guests run their own `StoryFilm`, and sfx are already forwarded by `audioTap` (`audio.js:172-177`), so a film-side sound would play twice on guests. **Every sound stays a cutscene cue.** Flicker that needs a sound must therefore be scripted (deterministic), not random.

---

## B. Horror film language bible (this project)

### B1. Format and lenses

- **Scope is 2.39:1 inside the 3:2 stage.** Bar fraction per side is `(1 - stageAspect/2.39)/2 = (1 - 1.5/2.39)/2 = 0.1862`, which is **119 px of 640** on every device. Bars are pure `#000` (no neon edge line in film mode).
- **Lens convention** (so the shot lists can speak in mm): a virtual sensor 36 mm wide; the scope picture is 36 x 15.06 mm; the full 3:2 frame is 36 x 24 mm. Visible vertical FOV = `2*atan(7.53/mm)`.

| mm | 14 | 16 | 18 | 21 | 24 | 28 | 32 | 35 | 40 | 50 | 65 | 75 | 85 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| visible vFOV (deg) | 56.6 | 50.4 | 45.4 | 39.4 | 34.8 | 30.1 | 26.5 | 24.3 | 21.3 | 17.1 | 13.2 | 11.5 | 10.1 | 8.6 |

- The gameplay camera is 42 deg vertical over the full 3:2 frame, which is **31 mm** in this convention (27.0 deg visible when bars are in).
- **Lens by shot type:** establishing and dread wides 16-24 mm; action and panic 18-28 mm (wide lenses distort a lunge toward the lens); medium and two-shots 32-40 mm; close-ups 40-65 mm; extreme close-ups of eyes, hands and props 65-100 mm.
- **To lengthen a lens without changing framing,** use `relens()` (D1). It pulls the camera back along the view line by `r = tan(old/2)/tan(new/2)`. Clamp r at 2.2 and check the screenshot for walls.
- **DOF with focal length:** `apertureEff = aperture * (24.3/visFov)^1.5`, so long lenses melt the background and wide lenses stay deep.

### B2. Grade presets ("LUT-style", analytic, no texture)

**Order** (High composite and Low pass alike): `exposure * breath` -> ACES -> encode `pow(1/2.2)` -> `filmGrade()` in display space -> vignette (relative to the scope picture) -> grain.

```glsl
// display-space grade, c in 0..1
vec3 filmGrade(vec3 c) {
  c *= uWB;                                              // white balance
  c = clamp((c - 0.42) * uContrast + 0.42, 0.0, 1.0);    // contrast around a mid pivot
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += uShadow * (1.0 - l) * (1.0 - l) + uHigh * l * l;  // split tone: teal shadows / orange highs
  c = pow(max(c * uGain + uLift * (1.0 - c), 0.0), 1.0 / uGamma);  // CDL-ish per channel
  c += uSick * 4.0 * l * (1.0 - l) * vec3(-0.02, 0.035, -0.04);    // sickly green, midtones only
  l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);                             // desaturate
  return uFloor + c * (1.0 - uFloor);                    // lifted, milky blacks
}
```

Defaults for every preset are `lift [0,0,0]`, `gamma [1,1,1]`, `gain [1,1,1]`. The old storyFilm presets fold in as follows: WARM becomes HERO_GRIT (people) or PIZZA_EMBER (Ray's stall), COLD becomes COLD_GRIEF, SICK becomes SICK_FLUOR, and BLEACH becomes BLEACH_SHOCK.

| Preset | wb | contrast | shadow tint | high tint | sick | sat | floor | vig | grain | Use |
|---|---|---|---|---|---|---|---|---|---|---|
| NIGHT_RAIN | [.96,1,1.05] | 1.12 | [-.016,.004,.022] | [.022,.008,-.020] | .25 | .74 | .055 | .50 | .040 | concourse, doors, fountain |
| SICK_FLUOR | [.95,1.04,.93] | 1.08 | [-.010,.012,.004] | [.010,.020,-.018] | 1.0 | .68 | .060 | .55 | .045 | security office, monitors, gauge |
| FRYER_HELL | [1.07,.98,.86] | 1.18 | [-.012,.006,.018] | [.030,.010,-.030] | .45 | .82 | .050 | .55 | .040 | kitchen, escalator glow |
| PIZZA_EMBER | [1.04,.99,.92] | 1.14 | [-.014,.004,.020] | [.026,.010,-.024] | .50 | .80 | .055 | .50 | .040 | Ray's stall |
| COLD_GRIEF | [.92,.99,1.08] | 1.04 | [-.010,.004,.024] | [0,.006,.012] | .15 | .58 | .065 | .60 | .045 | Goth close-ups, guilt, the orbit |
| BLEACH_SHOCK | [1,1,1.02] | 1.28 | [-.006,.004,.010] | [.010,.010,0] | .35 | .32 | .070 | .62 | .055 | aftermath, silence, bleak |
| HERO_GRIT | [1.03,1,.95] | 1.15 | [-.018,.004,.024] | [.030,.012,-.026] | .12 | .86 | .045 | .45 | .035 | hero bays, hopeful, the save |
| PROJECTOR | [1,1,1] | 1.0 | 0 | 0 | 0 | 0 | .030 | .70 | .060 | studio card, credits |

A shot may override single fields: `grade: { ...SICK_FLUOR, sick: 1.3 }`.

### B3. Film texture (both tiers unless marked)

- **Grain:** stepped at 24 fps, `hash(floor(fragCoord*0.75) + floor(t*24)*37)`, amount `preset.grain * (1.2 - luma)` (stronger in shadows).
- **Gate weave:** UV offset in pixels, `(sin(1.3t)*0.25 + (h24-0.5)*0.5, (h24b-0.5)*0.7) * 0.6`, where h24 is a hash of `floor(t*24)`. Never more than 0.6 px.
- **Exposure breathing** (projector flicker): `exposure *= 1 + 0.024*(h24c - 0.5)`.
- **Vignette** follows the scope picture, not the 3:2 frame: `d = (uv-0.5) * vec2(1, 1/(1-2*bar))`, strength from the preset.
- **Chromatic aberration (High only):** `uCA` defaults to 0.004 (edge-weighted, as today). It spikes to 0.012 on hits and decays at 6/s.
- **Anamorphic flares:** horizontal streaks on listed practicals (tubes, flashlight, torch, LEDs, monitors, heat lamps). Cool `#7ab8ff`, or the source colour for fire. Length is `520 * len * k` canvas px; core 2 px plus a 12 px soft band; additive. Both tiers draw them in the 2D overlay from a per-shot `flares` list (D2). High may add an automatic bloom streak chain (nice-to-have N1).
- **Lens blood / grease:** a procedural splat layer in the 2D overlay, multiplied over the picture (D2). Blood is dark red; grease is translucent amber-brown (the kitchen). The splat lands instantly, holds 2.2 s with drips crawling down, then fades over 2 s. Use it at most once per scene: it is punctuation, not wallpaper.

### B4. Light: failing practicals, silhouettes, fog

- **`failing(t, seed, health)`** (random, for atmosphere when no sound is needed):
  - Base hum `1 + 0.025*sin(754t)`.
  - Time is split into slots of 1/1.7 s. A slot is faulty when `hash(slot*3.1+seed) < 1-health`.
  - Inside a faulty slot: 0-35% stutter (`hash(floor(30t)+seed) > .55 ? .05 : .9`), 35-60% dead (0.03), 60-100% ballast restrike `min(1, .2 + 1.1*r)` with overshoot.
- **`scriptedFail(lt, events)`** (deterministic, used whenever a sound must sync): `events = [[t0, dur], ...]`. Brightness is 0.03 inside an event, with a 0.12 s stutter before t0 and a 0.25 s restrike after `t0+dur`. The matching cutscene cue `tubeTink` sits at the same beat time.
- Light shafts follow their light: `shaft.uOpacity = base * lightValue` every frame.
- **Silhouettes:** a strong rim or backlight (moon, red emergency, monitor) with the key at 30-50%; the zombie stays inside the fog band until it steps into a light pool.
- **"They only move in the dark":** a zombie's position advances only while its lighting value is below 0.3. Every restrike reveals it closer. Used in opener shot 6 and crisis `cr.crane`.
- **Fog:** dread wides `near 90-140, far 900-1250`; close-ups `near 150-250` so backgrounds fall off. Haze (High, N2) adds depth haze lit by bloom.

### B5. Camera: handheld, shake, punch, blur

**Handheld v2** (replaces `cineCore.js:157-165`). Its parameters come from the existing numeric `hand`, so old shots keep working:

```
pos  = 0.8 * hand        (world units)      rot = 0.55 * hand  (degrees)      freq = 0.8 + 0.5 * hand
offset = (wob(t*freq,1)*pos, wob(t*freq,7)*pos*0.6, wob(t*freq,11)*pos*0.5)   // world space, as today
after lookAt: rotateY(wob(t*freq,13)*rot*0.55 deg), rotateX(wob(t*freq,17)*rot*0.40 deg), rotateZ(wob(t*freq,19)*rot*0.30 deg + shot roll)
panic: true  -> operator jolts: every 0.6-1.5 s (hash of floor(t/0.7)) an impulse j(a) = exp(-14a)*sin(38a), 1.6 deg pitch, 1.1 deg yaw
impulse shakes (this.shakes) also add rotation: pitch/yaw = f * 0.05 deg per amplitude unit
```

| Mode | hand | Use |
|---|---|---|
| locked-off | 0-0.05 | the "very still" Goth close-up, the printout, the reflection (stillness is scarier) |
| breath | 0.1-0.25 | dread creeps, monitors |
| operator | 0.3-0.6 | dialogue |
| nervous | 0.8-1.4 | choice timers as they drain |
| panic | 1.6-3.2 plus `panic: true` | chases, attacks, the burst, the cave-in, the brace |

- **FOV punch on a hit:** `vis *= 1 - P(age)`, where `P = amt*(age<.05 ? age/.05 : exp(-6(age-.05)))`. amt is 0.06-0.10.
- **Motion blur (High):** every frame, compare a point 200 units ahead of the camera with last frame's projection. The UV delta times a 180-degree shutter (0.5) gives `uMotion` (x and y). Ignore it under 1.5 px per frame; clamp at 0.04 UV. This replaces the whip-only rule. Per-pixel reprojection from depth is N2.

### B6. Scare timing rules (apply to every scene)

1. **Build, silence, hit.** Every big scare has a creep of at least 1.5 s (slow push, breath handheld, drone, heartbeat). Then 0.3-0.7 s of real silence: cine bus *and* music ducked to about 2%. Then the hit on one frame: sting plus `braam` or a bodily sound, a shake of 10-18, a punch of 0.06-0.10, a CA spike, and optional blood. Use `scare()` (D1) so the silence is always scheduled *before* the hit.
2. **Fake-out, then the real one.** The first jolt in a scene is allowed to be harmless (Ray popping up). The real scare comes when the audience relaxes.
3. **Quiet scares exist.** The Grim Shopper appears with no sting: the lights restrike and it is simply there. Only the next sound (Pam's chime) lands.
4. **Cut on the aftershock, not on the hit.** Hold 0.3-0.8 s after a hit, then hard-cut to something quieter (an L-cut of the scream tail into the next shot).
5. **Never two hits within 4 s.** Never more than 3 full-screen flashes per second (photosensitivity). The alarm strobe (~1.1 Hz) and lightning double-strobes already comply.
6. **Scare, then snap** (STORY.md tone rule 1): a horror hit is followed within two lines by a dry joke or Pam's politeness. The existing dialogue already does this; keep the hits on the beat before the joke.
7. **Survivors are never gored.** Blood is on the lens or off-screen. Zombies and the Butcher take the damage.

### B7. Sound design rules

- **Bed:** a low drone under every dread passage (`drone`, 41-55 Hz, detuned, slow tremolo). Heartbeat is accelerating (`heartbeatRamp`), never a fixed loop.
- **Silence is a cue:** `duckAll(dur)` ducks the cine bus *and* the music (a new `musicDuck` gain node). The PA speech voice cannot be ducked, so never schedule a silence while Pam is speaking.
- **Hits** layer three bands: sub (`braam`, 52 to 30 Hz), body (`stingHit`, `bodyHit`, `glassThud`), and air (scrape, `screamCut`, glass).
- **J-cut** (the next shot's sound leads the picture by 0.2-0.6 s): cues with negative `at` (D1). Use them on rev, roar, horde, chime and whoosh.
- **L-cut** (sound tails over the cut): natural, because the cine bus is never stopped at cuts. Use on screams, slams and the horde.
- **Music:** the cutscene tracks stay (`music-data.js:69-79`) and are ducked by silences. During the handoff the gameplay track starts (a J-cut into play).
- **New synthesized cues** (cineAudio.js, all oscillator and noise, spread into `sfx` automatically):

| Cue | Recipe |
|---|---|
| `drone(dur=8, vol=.1, root=41.2)` | 3 saws: root, root x1.005, root x1.498; lowpass 120 to 260 Hz; tremolo 0.13 Hz; plus bandpass noise at 200 Hz; attack dur x0.4 |
| `heartbeatRamp(n=10, g0=.9, g1=.45, vol=.32)` | lub-dub like `heartbeat` (`cineAudio.js:249`), gap_i = mix(g0, g1, (i/(n-1))^1.5) |
| `braam(vol=.5)` | sine 52 to 30 Hz over 2.2 s; saw cluster 65/69/98 Hz, lowpass 900 to 150, drive 4; lowpass noise burst |
| `screamFar(vol=.06)` | saw 520 to 740 to 430 Hz, vibrato 6 Hz / 40 cents, two bandpass formants (900, 2400 Hz), lowpass 1800; echoes at 0.11/0.23/0.37 s, x0.5/0.3/0.18 |
| `screamCut()` | the same voice, close and loud, gain to 0 in 10 ms at 0.45 s (cut short), then nothing |
| `neckCrack()` | 3 clicks 15 ms apart (bandpass 2.4 kHz, Q6) plus a 140 Hz knock |
| `tubeTink()` | two 8 ms square ticks at 3.2 kHz, then a 120 Hz saw buzz through bandpass 240 Hz swelling over 0.4 s |
| `breathPanic(dur=2, rate=2.2)` | alternating inhale/exhale noise, bandpass 900 to 1400 Hz, rate breaths per second |
| `bodyHit()` | lowpass noise at 600 Hz, sine 90 to 45 Hz, plus a squelch (bandpass 1200 Hz, Q8, slide down) |
| `glassThud()` | lowpass noise at 300 Hz, a 70 Hz sine, and a 2.8 kHz tick |
| `tapeStop()` | saw 400 to 40 Hz over 0.5 s, lowpass following |
| `duckAll(dur=.6)` (audio.js) | `cine.duck(dur)` plus `musicDuck` gain `setTargetAtTime(0.02)`, back to 1 after dur |

### B8. Acting and blocking

New `CineActor` helpers (`cineStage.js`). All of them add into the existing gesture values *before* the single `rot()` per bone (the once-per-bone rule at `:251-258` stays):

- `breathe(k, rate=0.3)`: chest pitch `sin(2*pi*rate*t)*2.5k` degrees and a head-pitch counter of `0.8k`. Panic breathing is rate 1.1, k 1.
- `tremble(k)`: head yaw/pitch and both upper arms jitter at 9-13 Hz (sum of 2 sines), `1.6k` degrees.
- `flinch(amount)`: an impulse decaying over 0.35 s: head pitch +12, lean -0.25, both arms raise +0.35.
- `lookAtPoint([x,y,z], rate)`: computes headYaw/headPitch from the Head bone's world position and root yaw, clamped to +-60/+-30. Gives real eye-lines in close-ups and OTS shots.

Rules:
- Every close-up has breathing.
- Terror reads through four things together: tremble, a flinch on the hit, eyes (look) darting between two points every 0.6-1.1 s, and lighting from below or the side.
- Weight shifts: idle survivors twist +-4 deg slowly (0.15 Hz) so nobody is a statue.
- Zombies enter from fog and dark, never pop on screen. Heads snap on sound cues (as in `tk.fountain`, `storyFilm.js:612-619`).

### B9. Cards

- **Studio card**, opener pre-roll (t from -4.5 to 0): black, PROJECTOR grain. "kungFuDOOM" in SERIF 44 px with 10 px tracking, colour `#e8e2d4`; "presents" in 18 px small caps with 8 px tracking, 34 px below; centred at y 320. Alpha in over 0.5 s, out over 0.6 s. Brightness is modulated by `failing(t, 3, 0.85)`, like a projector bulb. No logo art, no person's name.
- **Title card:** the existing `MALL OF THE DEAD` slam (`cineOverlay.js:419-433`), moved down 170 px so it sits inside the scope picture.
- **End credits card** (last beat of the ending, 8 s, black, PROJECTOR), lines stacked and fading in one by one every 0.7 s:
  `MALL OF THE DEAD` / `WING 1: FOOD COURT` / (gap) / `A kungFuDOOM PRODUCTION` / `Written, directed, scored and built in code by kungFuDOOM` / `Every sound synthesized. Every frame rendered live.` / `No survivors were harmed. Several were eaten.` / (gap) / `TO BE CONTINUED AT 5:19 AM`.

---

## C. Per-scene shot plans

Notation: lens `mm -> visible vFOV`; `hand` as in B5; "J" means the sound leads the cut; "L" means the sound tails over the cut. **Existing** means keep the current code and only apply the listed delta. Opener times are absolute film seconds. Story-scene beats are user-paced, so their times are *nominal* (auto-advance, `cutscenes.js:331`), and cue times are relative to the beat (the format `cutscenes.js` uses). Dialogue is exactly STORY.md's and is not repeated here.

### C1. Opener "Doorbuster" (`src/intro.js`) - 4.5 s studio pre-roll + 78 s

The pre-roll uses negative film time: `begin()` sets `pl.t = -4.5`. `render()` already clears to black for `t < 0.04` (`intro.js:584`), and the fade function is 1 for `t < 0.4`, so **no existing cue time changes**.

| # | id | t / dur | Framing, lens | Move | Blocking / acting | Light | VFX / grade | Audio (J/L) | Out |
|---|---|---|---|---|---|---|---|---|---|
| 0 | studio (new) | -4.5 / 4.5 | black card | none | none | projector flicker | PROJECTOR; card per B9 | -4.4 `drone(9,.08)` (L under shot 1); -3.9 `heartbeat(1,.9,.25)`; -2.2 `tubeTink` with a card flicker; -0.6 silence (nothing scheduled) | black into the existing fade-up |
| 1 | atrium (existing) | 0 / 7 | ELS, 21->16 mm (39.4->52 deg; current fov [38,52] is fine) | crane down (keep) | at 5.6 one walker silhouette crosses far back under the skylight (zombie 9 at x 60, z -200, walking, then hidden) | moon key, lightning 4.6 (keep); one ceiling tube dies at 5.2 (`scriptedFail` on `con.neon` tube 0) | NIGHT_RAIN; fog near 140 -> 100 | keep 0.0 bed/rain/buzz, 0.9 chime, 2.9 Pam; add 5.2 `tubeTink`, 6.2 `screamFar(.05)` (L into 2) | cut 7.0 on the lightning afterglow |
| 2 | corridor (existing) | 7 / 8 | low wide, 16->20 mm (fov [52,40]) | dolly (keep), hand 0.55 -> 0.3 (slow dread) | door zombies punch as now, but **all freeze 13.2-14.15** ("they stop"); 14.15 zombie 2 slams face and arms into the glass at frame centre (z to DOOR_Z-2, `drawCrack(1)`) | red pulse fx (keep); neon flicker | NIGHT_RAIN; 14.15: shake 12, punch .07, CA spike | keep 7.0 thunder, 8.0-13.6 Pam, 10.4 groan, 11.2/12.9 slams; **replace** 7.0 `heartbeat(14,...)` with 7.4 `heartbeatRamp(9,.85,.5)`; 13.65 `duckAll(.5)`; 14.15 `glassThud` + `stingHit` + `braam(.35)`; move `glassCrack` 13.8 -> 14.2 | cut 15.0 on the aftershock |
| 3 | lock (existing) | 15 / 4 | ECU 40->65 mm (21.3->13.2 deg); `relens` from [26,19] | push (keep), hand .15 | none | red LED key -> green (keep); lightning 18.0 silhouettes the horde behind the glass | rack focus (keep); flare: LED (red, k .5, len .4) | keep beeps and 17.35 green; 17.6 clunk; **replace** `duck(1.0)` with `duckAll(1.3)` (silence to 18.9) | J: 18.95 whoosh into 4 (keep) |
| 4 | burst (existing) | 19 / 5 | whip, then wide 16->14 mm | whip + dolly (keep); after 20.42 `panic: true`, hand 1.0 -> 2.2 | doors burst; at 22.55 sprinter zombie 2 runs at the lens and veers past on the left (x -20 to -60, z to -700) | white then amber (keep) | 20.42 slow-mo (keep); motion blur High; **22.6 lens blood 0.85** + shake 16, punch .09, CA spike | 19.45 `duckAll(.5)` (silence after the whoosh); 20.0 slams, 20.42 burst/sting (keep); 22.6 `bodyHit` + `screamCut` | hard cut 24.0; L: horde tail through `duck(1.2)` at 24.0 |
| 5 | monitor (existing) | 24 / 6 | CU 32->50 mm (26.5->17.1 deg; relens from [34,23]) | push (keep), hand .2 | feed figure at the panel; N5: at 28.6 the figure's head snaps to camera with two yellow eye pixels for 6 frames | monitor green, dying tube (keep) | SICK_FLUOR; flare: monitor (green, k .3) | keep 24.0 monitor/warble, 25.0 Pam, 27.4 piano; N5: 28.6 `tapeStop` + `stingHit` | cut 30.0 |
| 6 | escalator (existing) | 30 / 7 | 21->24 mm (fov [40,35]) | crane (keep) | **walkers at the foot advance only while the tube is dark** (`scriptedFail` events at 31.2/.3, 32.6/.35, 33.9/.4, local 1.2, 2.6, 3.9); spitter as now; 35.9 walker zombie 3 lurches in from the right foreground (out of focus, 25 units from the lens) | orange key now `scriptedFail` instead of `flicker(t,9,true)` | FRYER_HELL; 35.9 shake 10, punch .06 | `tubeTink` at 31.2, 32.6, 33.9; keep 30.1, 33.4, 34.2; 35.55 `duckAll(.3)`; 35.9 `stingHit` + `moan`; **J: move `chainsawRev` 37.3 -> 36.75** | hard cut 37.0 on the rev |
| 7 | biker (existing) | 37 / 6 | low orbit, 32->40 mm (relens radius x1.6 from [44,36]) | orbit (keep) | opens nearly black; only chainsaw sparks light his face (key power = 60 + 300*rev); `breathe(.6)` | spark key, red rim | HERO_GRIT; flare: wrist sparks (orange, k .6) | keep 38.15 stab, 39.5 chop | cut 43 |
| 8 | cop (existing) | 43 / 6 | 40->50 mm (relens from [37,31]) | push (keep) | `tremble(.2)`; flashlight sweeps across the lens at 44.2 | flashlight key (keep ping) | HERO_GRIT; flare: flashlight (blue, k peaks 1.0 at 44.2) | keep rack 44.9, snare 45.4 | cut 49 |
| 9 | skater (existing) | 49 / 6 | 28 mm tracking (keep) | dolly (keep) | as now | neon (keep) | HERO_GRIT; motion blur High (now automatic) | keep | cut 55 |
| 10 | goth (existing) | 55 / 7 | 40->65 mm (relens from [38,26]) | push (keep) | total dark until the lighter at 56.7 (key 0 before); `breathe(.4)` | flame key from below (keep) | HERO_GRIT; flare: flame (orange, k from flameOn) | keep 56.7, 57.2, 58.6 | cut 62 |
| 11 | circle (existing) | 62 / 16.5 | pull back 28->21 mm, then crane | keep seq | the ring of dead emerges from fog (fog near 140 -> 60 over the shot); heroes use `lookAtPoint` to track the nearest zombie, switching every 1.2 s; `breathe(.8)` | red key; shafts pulse with the key | NIGHT_RAIN; title moved into the picture (B9) | keep 62.2 riser, 65.2 Pam, 68.95 chime; **69.25 `duckAll(1.2)`** (true silence); 70.5 slam + `braam(.5)`; 70.75 theme (keep) | fade 76.7-78 -> title screen (a menu, so no handoff) |

Skip: any press after 0.35 s of *real* time (D6). The hint appears in the top bar.

### C2. Scene 1 "The Plan" (`openingScene`, `cutscenes.js:39-54`) -> Food Court gameplay

| Beat | Shot id | Nominal t / dur | Lens | Move | Blocking / acting | Light | VFX / grade | Cues (beat-relative; J = negative at) | Out |
|---|---|---|---|---|---|---|---|---|---|
| card | plan.wide | 0 / 4.2 | 21->24 mm (keep fov [42,38]) | push (keep) | survivors `breathe(.4)`; Cop looks at monitors (keep) | monitors plus alarm strobe; officeLights key x0.6 | SICK_FLUOR; flares: 2 monitors (green, k .25) | keep alarm, hit, slams | same shot |
| line Cop | plan.wide | 4.2 / 5 | as above | as above | as above | as above | as above | keep | cut |
| line Biker | plan.biker | 9.2 / 5 | 40 mm (relens from [34,31]) | push (keep) | look and raise (keep); `breathe(.5)` | keep | HERO_GRIT (was WARM) | keep rev | cut |
| silent | plan.freeze | 14.2 / 2.6 | 50->75 mm (relens from [34,27]) | push, ease out (keep), hand .12 | frozen with empty eyes (keep) | **overhead tube dropout, local 0.45-0.95** (`scriptedFail`), PA halo glows | SICK_FLUOR with sick 1.3 | **replace** 0.15 `duck` with 0.1 `duckAll(.4)`; keep 0.5 chime, 1.0 ringing; add 0.45 `tubeTink`, 1.6 `heartbeat(1,.9,.3)` | same shot |
| line Cop | plan.freeze | 16.8 / 3.4 | as above | as above | `tremble(.15)` after he unfreezes | as above | as above | keep flash .12 | cut |
| line Goth | plan.goth | 20.2 / 5 | OTS 50 mm (relens from [31,26]) | push (keep) | keep | purple flicker (keep) | SICK_FLUOR | keep click | J into next |
| line Skater | plan.monitor | 25.2 / 5 | keep seq (whip to monitor) | keep | keep | keep | SICK_FLUOR; N5: escalator feed lunge at local 3.4 | keep 1.4 whoosh, 1.9 glitch, 2.4 groan; add 2.6 `screamCut` (STORY's "scream cut short"); keep 3.4 moan; N5: 3.4 `stingHit` shake 6 | cut |
| choice | plan.four | 30.2 / up to 9 | 24 mm (keep) | push lin (keep); `hand = .2 + tens*1.4`, `panic` when tens > .7 | survivors breathe at rate `.3 + tens*.8`; Skater glances (keep) | alarm strobe; fog far 900 -> 600 with tens | SICK_FLUOR | `ticking()` plus 0.1 `heartbeatRamp(9,1.0,.55)` | cut to reply |
| replies | plan.two / plan.pa | ~4-5 each | 40 mm (relens) | keep | `lookAtPoint` partner | keep | SICK_FLUOR | keep | **cut to HANDOFF** |
| handoff | game world | 2.6 | starts 50 deg full frame (about 33 deg visible) -> gameplay 42 deg | `rise` (D4) | the real party at Food Court spawn, seen from behind | level lighting | film tint fades out; bars slide away; HUD fades in | J: `level_1` music starts at handoff t=0 | gameplay |

### C3. Scene 1.5 "The Ticket" (`ticketScene`, `cutscenes.js:67-83`) -> gameplay (no handoff if a crisis is queued)

| Beat | Shot id | Nominal | Lens | Move | Blocking / acting | Light | VFX / grade | Cues | Out |
|---|---|---|---|---|---|---|---|---|---|
| line Ray | tk.approach | 0 / 5 | 28 mm (keep) | dolly (keep), hand .4 | **fake-out:** 0-0.6 a silent creep; at local 0.6 Ray pops up from behind the counter (root y -26 -> 0 in 0.15 s) | warm oven under the shutter | PIZZA_EMBER; 0.6 shake 9, punch .05 | add 0.0 `duckAll(.55)`; **move** `shutterRattle` 0.05 -> 0.6 (shake 9) + `stingHit`; `fryerSizzle` 0.2 -> 0.8 | cut |
| line Ray | tk.spike | 5 / 5 | ECU 65 mm (relens from [33,30]) | push + rack (keep) | none | oven flicker (keep) | PIZZA_EMBER; flare: oven (orange, k .3) | keep 0.1 whoosh, 1.9 dread | cut |
| line Skater | tk.two | 10 / 4 | 35 mm | push (keep) | keep, `breathe(.4)` | keep | PIZZA_EMBER (was WARM) | replace 0.02 `duck` with 0.02 `duckAll(1.2)` ("music cuts") | cut |
| line Cop | tk.cop | 14 / 4.2 | 50->75 mm (relens from [30,26]) | push (keep) | wipe gesture (keep); at local 3.0 a 2-frame cook-yellow eye glint (`F.eyes = .25`) | sickly under-key (keep) | SICK_FLUOR | keep 1.9 gurgle | cut |
| silent | tk.fountain | 18.2 / 3.1 | 24 mm crane (keep) | keep | heads snap on each chime note (keep) | neon pulses (keep) | NIGHT_RAIN | add 0.0 `duckAll(.14)`; keep 0.15 chime; add `neckCrack` at 0.2, 0.62, 1.04; keep 2.1 bass drop | same shot |
| line Goth | tk.fountain | 21.3 / 3.6 | as above | as above | Goth looks at the walkers (keep) | as above | as above | keep 0.4 moan | **HANDOFF** (only if `!game.pendingScene`) |
| handoff | game world | 2.2 | `rise` | `rise` | live party | level | as C2 | J: level music | gameplay |

### C4. Scene 2 "Ray vs the Locker" (`crisisScene`, `cutscenes.js:86-118`) -> gameplay

| Beat | Shot id | Nominal | Lens | Move | Blocking / acting | Light | VFX / grade | Cues | Out |
|---|---|---|---|---|---|---|---|---|---|
| line Ray | cr.cave | 0 / 4.6 | 24 mm | whip, then push (keep); `panic: true` (hand 1.6/1.7 kept) | struggle (keep) + `tremble(.6)` + `breathe(1, 1.1)` | red emergency `failing(t,2,.4)` | PIZZA_EMBER; CA spike on the groan | keep 0.02 groan, 0.5 fire; add 0.8 `breathPanic(2)` | cut |
| line Cop | cr.locker | 4.6 / 5.2 | keep | whip + push (keep) | none | yellow strobe (keep) | PIZZA_EMBER; flare: locker strobe (yellow, k strobe) | keep | cut |
| line Biker | cr.biker | 9.8 / 4.6 | 40 mm (relens from [33,30]) | push (keep) | left-right look (keep) + `breathe(.7)` | split light (keep) | PIZZA_EMBER | **replace** 0.05 `heartbeat` with `heartbeatRamp(6,.8,.55)` | cut |
| line Goth | cr.goth | 14.4 / 5.6 | 65->85 mm (relens from [30,26]) | push lin, hand .02 (keep: locked-off) | absolutely still; one slow blink-like head dip at 3.0 | cold key, no flicker (keep) | COLD_GRIEF; grain unchanged | replace 0.02 `duck` with `duckAll(1.6)`; keep 0.6 music box | cut |
| silent | cr.crane | 20 / 3.4 | 18->16 mm (keep [44,52]) | crane (keep), hand .4 | walkIns advance only while the red pulse is below .3; **2.6 a sprinter (index 2, `Running_C`, 3x speed) bursts through the back door** toward camera | red pulse (keep) | PIZZA_EMBER; 2.6 shake 10, punch .06 | keep 0.05 horde, 1.2 groan; add 2.25 `duckAll(.35)`, 2.6 `stingHit` + `screamFar(.08)` | hard cut to the choice (aftershock) |
| choice | cr.four | 23.4 / up to 9 | 24 mm | push lin (keep); `hand = .2 + tens*2.2`, `panic` when tens > .6 | `breathe` rate with tens | strobes (keep) | PIZZA_EMBER | keep klaxons and ticking; add `heartbeatRamp(9,.9,.45)` at 0.1 | cut to reply |
| save | cr.lift | ~3.6 + 3.4 | keep | keep | keep | keep | HERO_GRIT (was WARM) | keep | **HANDOFF** |
| loot | cr.open | ~4 + 3.6 | keep | keep | Ray off-screen | locker glow hard-flickers at 1.9 | PIZZA_EMBER, then COLD_GRIEF on the Goth line | keep; add 2.05 `screamCut` (off-screen) | **HANDOFF** |
| hold | cr.brace / cr.rayout | ~3.6 + 3.8 | keep | `panic: true` (hand 3.2 kept) | `tremble(.5)` | keep | PIZZA_EMBER | add 0.3 `breathPanic(3, 2.6)` | **HANDOFF** |
| silence | cr.empty | ~3 + 4.6 | keep | keep | none | keep | BLEACH_SHOCK (keep); **0.95 lens blood 0.6** | keep 0.8 groan (slow-mo), 1.6 dread; add 0.95 `screamCut` + `bodyHit`; Pam line keeps 0.05 chime (the snap) | **HANDOFF** |
| handoff | game world | 2.2 | `rise` toward Ray's counter | `rise` | live party | level | as C2 | J: level music | gameplay (ambush banner, etc.) |

### C5. Butcher intro (`bossIntroScene`, `cutscenes.js:128-148`) -> boss fight

| Beat | Shot id | Nominal | Lens | Move | Blocking / acting | Light | VFX / grade | Cues | Out |
|---|---|---|---|---|---|---|---|---|---|
| card | bk.reveal | 0 / 6.2 | 18->21 mm (keep [48,42]) | crane out of the steam (keep) | keep | heat lamps (keep) | FRYER_HELL (was WARM); flares: 3 heat lamps (orange, k .4); haze N2 | keep 0.05, 0.5 riser; add 2.2 `duckAll(.45)`; keep 2.7 reveal sting, 3.2 hook | cut |
| line Biker | bk.drums | 6.2 / 6 | 24 mm | dolly (keep) | stops at the drums (keep); `breathe(.5)` | **tube over the drums dies at local 3.3 for 0.5** (`scriptedFail`) | FRYER_HELL | add 0.05 `drone(6,.07)`, 3.3 `tubeTink`; keep 3.6 rev | cut |
| silent | bk.ots | 12.2 / 3.9 | 35 mm OTS | push (keep) | chopping (keep): a dread metronome | green rim (keep) | FRYER_HELL | keep thunks | cut |
| silent | bk.turn | 16.1 / 2.3 | 40 mm (relens from [40,36]) | crane down (keep) | the turn (keep) | keep | FRYER_HELL | **silence:** 0.0 `duckAll(1.1)` (the chopping stops); keep 0.2 hook; riser 0.4 at vol .08 | same shot |
| line Butcher | bk.turn | 18.4 / 2.8 | as above | as above | jaw (keep) | as above | 0.05: punch .10, CA spike | keep orderUp (shake 14, slow-mo) | cut |
| line Butcher | bk.cop | 21.2 / 4.8 | 50 mm on the Cop, whip to the Butcher (keep seq) | keep, motion blur High | Cop `tremble(.35)`, sweat sparks (keep) | keep | FRYER_HELL | keep 1.9 sting, 2.1 ringing | cut |
| variant x2 | bk.var | 26 / 6.2 | keep | keep (strained gets `panic: true`) | `lookAtPoint` partner | keep | hopeful HERO_GRIT, guilt COLD_GRIEF, strained PIZZA_EMBER, bleak BLEACH_SHOCK | keep | cut |
| line Butcher | bk.roar | 32.2 / 4 | 18 mm low (keep [51,46]) | push (keep) | keep | fryers flare white (keep) | FRYER_HELL; **0.1 lens grease 0.7** | keep roar (shake 18, slow-mo), hook, title slam; add 0.08 `braam(.4)` | **HANDOFF** |
| handoff | game world | 2.4 | `boss`: low OTS behind the party toward the in-game Butcher | `boss` (D4) | live party, live boss | level | as C2; the boss HP bar arrives with the HUD fade | J: `boss_1` starts at handoff t=0 | boss fight |

### C6. Wing 1 ending "4:59" (`endingScene`, `cutscenes.js:151-174`) -> credits -> recap (a menu, so no handoff)

| Beat | Shot id | Nominal | Lens | Move | Blocking / acting | Light | VFX / grade | Cues | Out |
|---|---|---|---|---|---|---|---|---|---|
| line Butcher | en.kneel | 0 / 7 | 24 mm crane (keep) | keep | keep | fryers dying (keep) | FRYER_HELL (was WARM); **1.3 lens grease 0.45** | keep clang (slow-mo), fryerDown | **match cut:** frame the crack glow at (0.38W, 0.45H) |
| silent + Pam | en.gauge | 7 / 6.4 | 65 mm (relens from [36,33]) | push (keep) | none | green gauge only (keep) | SICK_FLUOR; flare: gauge (green, k .35) | add 0.05 `drone(6,.06)`; keep gurgle, groan, chime | cut |
| line Skater | en.office | 13.4 / 4.6 | 24 mm | dolly (keep) | battered walk-in (keep) + `breathe(.6)` | keep | SICK_FLUOR | keep printer | cut |
| silent | en.print | 18 / 5.6 | 65 mm (relens from [32,32]) | dolly down the paper (keep), hand .06 | none | keep | SICK_FLUOR | keep; replace 1.6 `duck` with `duckAll(1.0)`; keep 1.7 reveal | cut |
| silent + Cop | en.feed | 23.6 / 7.4 | 35 mm | push (keep) | Cop `tremble(.3)` on his line | keep | SICK_FLUOR | keep rewind, glitch, dread | cut |
| 2 lines | en.orbit | 31 / 10 | 32 mm (keep [42,40]) | orbit (keep) | keep, plus `breathe` on everyone | keep | COLD_GRIEF (keep) | keep rain, piano | cut |
| silent + Pam | en.reflect | 41 / 7.2 | OTS 40 mm (relens from [39,34]), hand .05 (locked-off) | push (keep) | **restructured quiet scare:** local 0-1.55 reflection empty; 1.55-1.75 tube dropout (`scriptedFail` [[1.55,.2]]); **from 1.75 the Grim Shopper is there**, holding the receipt (no sting); holds through Pam's line; 6.0-6.35 second dropout; on restrike it is gone (+ the existing zap flash); Cop turns his head when it goes (keep) | monitor flicker now scripted | SICK_FLUOR | silent beat: keep 0.1 `receiptRattle` at vol x0.6; **remove** 0.9 `stingDread`; add 0.9 `duckAll(.85)`, 1.55 `tubeTink`. Pam beat: keep 0.05 chime (the only "hit"); add 4.2 `tubeTink`; keep 4.6 zap | cut |
| silent + Cop | en.hand | 48.2 / 7.6 | 65->100 mm (relens from [31,23]/[28,23]) | keep seq | keycard hand, eyes (keep) | orange eye flare (keep) | COLD_GRIEF; flare: eyes (orange, k = eyes) | replace 0.4 `heartbeat` with `heartbeatRamp(5,1.0,.7)`; keep chime; keep riser on "...Copy." | **smash cut** to black |
| card | en.black | 55.8 / 5 | black | none | none | none | none | keep 0.02 duck, 0.8 arcade jingle | cut |
| card (new) | en.credits | 60.8 / 8 | black | none | none | none | PROJECTOR; credits per B9 | 0.1 `drone(7,.05)` | recap (a menu); N9: the recap fades up from black |

---

## D. Technical plan

### D1. Module map: what changes where

New files:

- **`src/camMath.js`** (pure, no three.js import, unit-testable). It becomes the single source of truth for the gameplay camera:

```js
import { WORLD_VIEW_W, WORLD_VIEW_H } from './config.js';
export const CAM_OFFSET = [0, 280, 330];   // moved from render3d.js:17
export const CAM_LOOK_Y = 42;              // moved from render3d.js:18
export const GAME_FOV = 42;                // render3d.js:80 / :678
export const SCOPE = 2.39;
export const scopeBarFrac = (aspect = 1.5) => Math.max(0, (1 - aspect / SCOPE) / 2);   // 0.1862 on 3:2
export const SCOPE_BAR_PX = Math.round(640 * scopeBarFrac(960 / 640));               // 119
export const mmToFov = (mm) => 2 * Math.atan(7.53 / mm) * 180 / Math.PI;
export function gameplayPose(camX, camY, sx = 0, sz = 0) {                            // EXACTLY render3d.js:655, :679-680
  const tx = camX + WORLD_VIEW_W / 2, tz = camY + WORLD_VIEW_H / 2 + 10;
  return { p: [tx + CAM_OFFSET[0] + sx, CAM_OFFSET[1], tz + CAM_OFFSET[2] + sz], l: [tx + sx, CAM_LOOK_Y, tz + sz - 10], fov: GAME_FOV, roll: 0 };
}
export function handoffStart(kind, party, boss, blocked) { /* D4 */ }
export function blendPose(C, G, e) { /* D4; returns G itself when e >= 1 */ }
export const handoffEase = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
```

- **`src/cineGrade.js`**: the preset table (B2), `GRADE_GLSL` (the function plus uniform declarations), and `gradeUniforms()` / `setGrade(uniforms, preset)`. Both CinePost passes import it.
- **`src/cineLens.js`**: the blood/grease layer generator and drawer, the overlay flare drawer, and a fallback grain tile, all for the 2D overlay.

Modified files:

| File | Change |
|---|---|
| `cineCore.js` | `barMax = scopeBarFrac()`; delete the portrait lens hack (`:174` `* (portrait ? 1.16 : 1)`) and portrait bar thinning (`:183`); handheld v2 (B5); `punch(t, amt)`, `splat(amt, kind, seed)`, CA spike state; `scare(t, o)` scheduler; `relens(spec, fromFov, toFov)` and `mm:[a,b]` on shots; aperture scaling (B1); motion vector every frame (B5); `shot.flares` projected in `view()`; `view()` returns `bar`, `blood`, `flares`, `studio` (t<0) |
| `cinePost.js` | High composite: new order and `GRADE_GLSL`, weave, breath, 24 fps grain, `uBar` vignette, `uCA` uniform, generalized `uMotion` (remove the 0.14 factor). New Low pass with capability fallback (D2) |
| `cineFx.js` | `failing()`, `scriptedFail()`; `makeShaft` keeps its API, and shots set opacity from the light value |
| `cineStage.js` | `breathe`, `tremble`, `flinch`, `lookAtPoint` (B8) |
| `cineAudio.js` | cues from B7 |
| `audio.js` | `musicDuck` gain node (musicBus -> musicDuck -> master in `ensureMusic`, `:279-290`); `duckAll(dur)` added to `sfx` **before** the audioTap wrap loop (`:172-177`) so guests get it |
| `cineOverlay.js` | scope subtitles in the bar (D3); studio card; blood and flares (from cineLens); hint in the top bar; title shifted +170 px; the Low radial vignette only when the Low pass is unavailable |
| `intro.js` | pre-roll (`begin()` sets `pl.t=-4.5`; `press()` uses real elapsed `this.age` instead of `this.t < 0.35` at `:67`); C1 edits; `fadeFn` unchanged |
| `storyFilm.js` | presets swapped to cineGrade names; C2-C6 shot deltas; `fxView()` returns `{blood, flares}` for the HUD; apply hits from `fv.hit` (D5); **no sounds** |
| `cutscenes.js` | handoff beat, `scare()` cue helper, negative-`at` J-cuts, `args` on cues, hit counter in `view().film.hit`, the `credits` card, scope bar constant (D3, D4, D6) |
| `hud.js` | `drawCutscene(ctx, v, time, fx)`: scope bars (no touch clamp, cap 130), fx layer (flares, blood), handoff layer (D4), credits card, hints in the top bar |
| `render3d.js` | import camera constants from camMath; the handoff branch (D4); zero the cine lights during handoff |
| `main.js` | per-scene handoff flag, `prepare` hook, idempotent `go()`, banner re-arm, prebuild under the film, music J-cut, cue args, `drawCutscene(..., fx)`; remove the direct `storyFilm.hit()` call (`:666`) |
| `netstate.js` | `cc[10]` handoff k, `cc[11]` handoff duration; `cleanCut`: bar cap 130 (`:163`), `handoff`, `film.hit`, `card.credits` |
| `index.html` | `body.film #stage { box-shadow: none; }` (the glow would outline the bars in portrait; line 23). Do not touch the import map (its CSP hash is tested) |
| `sw.js` | `CODE_CACHE = 'motd-code-v17'` |
| `tools/story-shots.mjs` | add a `390x844` size and `handoff` frames (k 0.1 and end) per scene |

### D2. Shader and pass design, and cost per tier

**High** (desktop default; `CinePost.high`):

1. Scene goes to the half-float MSAA target with depth (unchanged, `cinePost.js:371-374`). Tone mapping happens in the composite (unchanged).
2. Bloom, 2 levels (unchanged).
3. Composite (rewrite of `COMPOSITE`, `:287-351`) in this order:
   - weave UV offset;
   - DOF gather (unchanged algorithm, with aperture scaling from CinePlayer);
   - motion blur, 8 taps along `uMotion` when `|uMotion| > 0` (`acc += tex(uv + uMotion*(i/7 - .5))`);
   - bloom add;
   - CA with `uCA`;
   - `aces(col * uExposure * breath)`, then `pow(1/2.2)`, then `filmGrade`;
   - vignette with `uBar`;
   - grain.
4. N1 (nice): anamorphic streak chain. A bright pass with threshold 2.2 into a `w/4 x h/16` target, then 3 horizontal blurs with dir 1, 4 and 12 texels; composite adds `streak * vec3(.48,.7,1.0) * uFlare`. When N1 is present, halve the overlay flares on High.
5. N2 (nice): per-pixel camera motion blur and haze. Reconstruct world position from depth with `uInvViewProj`, reproject with `uPrevViewProj`, giving velocity (8 taps when above 1.5 px). Haze: `h = (1-exp(-d*uHazeDensity)) * exp(-max(0, y-uHazeY)*uHazeFall)`, then `col = mix(col, uHazeColor*(1 + 2*bloomA), h*uHaze)`.

**Low** (phone and iPad default):

1. `rtLow = WebGLRenderTarget(w, h, { type: HalfFloat if renderer.extensions.has('EXT_color_buffer_float') || has('EXT_color_buffer_half_float'), else UnsignedByte; depthBuffer: true; samples: 0 })`, sized to the drawing buffer. Created lazily, so the High-to-Low frame-guard fallback can use it.
2. Render the scene to `rtLow` with `NoToneMapping`. Restore the previous render target and tone mapping in `finally`.
3. One fullscreen pass: weave, `aces(col*exposure*0.95*breath)`, `pow(1/2.2)`, `filmGrade`, vignette with `uBar`, grain. **No** DOF, motion blur, CA, bloom, haze or streaks.
4. Low frame guard: if the Low pass averages more than 55 ms after 90 frames, set `lowPass = false`. That drops to the current direct path plus the overlay vignette and a fallback grain tile (a 256x256 noise canvas, `'overlay'` composite at alpha 0.06, offset per frame).

**Overlay** (both tiers, `cineOverlay` / `hud`), drawn in this order: fallback vignette, flares (`'lighter'`), blood (`'multiply'` plus `'source-over'` highlights), flash, bars, cards, subtitles, title, fade, studio card, hint.

- Blood layer generation: once per `(seed, kind)` into a cached 960x640 canvas. 5-8 splats. Each splat is a main blob (radial gradient: centre `#4a0004`, edge `#8a0a0a` at 0.9 alpha, falling to 0), 10-20 satellite droplets along a random direction (radii 2-9 px, distance 20-120 px), and 1-3 drips (x, y, maxLen 40-160 px, speed 25-60 px/s, width 4-8 px). Grease uses centre `#5a3208`, edge `#a8701c`, alpha x0.6, and a soft `'screen'` highlight.
- Blood draw per frame: `amt(age) = A` for age < 2.2, then `A*(1 - smooth((age-2.2)/2))`. Draw the layer with `globalAlpha = amt`, then drips grown to `min(maxLen, age*speed)` as rounded strokes.
- Flare draw: for each projected flare, a horizontal linear gradient line, 2 px core plus a 12 px band, with a small radial glow at the source.

**Cost estimates** (to be verified with the frame guard and capture tools):

| Tier | Added per frame | Estimate |
|---|---|---|
| High desktop (about 1.5 Mpx at DPR 1.25-1.6) | grade ALU, weave, breath (~0), general motion blur (8 taps only while moving), CA uniform (~0); N1 streak chain (~0.2-0.4 ms); N2 reprojection blur and haze (~0.4-0.8 ms) | +0.3-1.2 ms discrete GPU; +1-2.5 ms integrated (the frame guard covers it) |
| Low phone (DPR `max(saved,0.8)` gives about 768x512, 0.39 Mpx) | one extra fullscreen pass, 1 fetch, about 60 ALU; scene into an RT instead of the canvas | +0.2-0.6 ms on mid phones |
| Overlay (both) | flares: up to 4 gradient strokes; blood: one 960x640 drawImage plus drips, only while active | <0.3 ms on the 2D canvas |
| N3 (nice) scissor | skip the 2 x 119 px bars in the scene pass (`rt.scissor` / `rt.scissorTest`, reset in `finally`) | -30% scene fill (best win on phones) |

### D3. Scope letterbox, including portrait

**Rule:** the bar fraction is computed from the *stage* aspect, `scopeBarFrac(VIEW_W/VIEW_H) = 0.1862` (119 px). It is used by the opener (`pl.barMax`), story films (`view.bar = SCOPE_BAR_PX` for every beat: delete `BAR_CARD`/`BAR_LINE`, and start `this.bar` at 119 so there is no mid-scene resize), the HUD (`drawCutscene` cap 130, no touch clamp), and netstate (cap 130). Lens widening stays as is (`cineCore.js:173-175`, `tanHalf = tan(vis/2)/(1-2*bar)`), so a shot's `fov` is still what you see between the bars.

**What portrait means:** the WebGL canvas is always 960x640 (3:2). A portrait phone (390x844 CSS) shows the stage at 390x260, letterboxed by black page above and below. A true 2.39:1 picture at full width is 390 x 163 CSS px. That is already the largest scope picture that fits a 390 px width, so portrait needs **no special lens or bar logic**. The old portrait hacks made the framing differ by orientation and must go. To make the portrait frame read as one continuous black field:

- bars are pure `#000`, with no neon edge line in film mode;
- add `document.body.classList.add('film')` while `state` is `'intro'` or `'cutscene'`, and remove it otherwise, so the magenta stage glow (`index.html:23`) disappears.

**Sizes on real screens** (bar = 0.1862 of stage height):

| Device | Stage (CSS) | Picture (CSS) | Each bar (CSS) | s (CSS per canvas px) |
|---|---|---|---|---|
| Desktop 1280x720 | 1080x720 | 1080x452 | 134 | 1.125 |
| Phone landscape 844x390 | 585x390 | 585x245 | 72.6 | 0.609 |
| Phone portrait 390x844 | 390x260 | 390x163 | 48.4 | 0.406 |

**Subtitles in the bottom bar** (`drawScopeSub` in cineOverlay, used by both `drawCine` and `hud.drawDialogue`):

- No panel. Centred text with a 6 px shadow.
- Font `clamp(15/s, 18, 40)` canvas px. Max width `W-80`. At most 2 lines (STORY lines are 70 characters or fewer).
- Speaker name in the speaker's colour, bold, 0.72x size, 0.12em tracking. When `s >= 0.5` it goes on its own line above the text. When `s < 0.5` (portrait) it is an inline prefix, `MALL COP  Copy. I am very calm.`.
- Vertical placement: centred in the bar, `y0 = H - bar + (bar - blockH)/2`. If `blockH > bar - 8`, the block rises into the picture over a 0.6-alpha band. With these numbers, portrait 2 lines are 37x1.28x2 = 95 px < 119 px and fit inside the bar.
- Hints ("tap: next", the skip hint) always go in the **top bar**, right-aligned, alpha 0.55, size `clamp(11/s, 14, 26)`. They can never collide with subtitles.
- Choices (`hud.js:1262-1269`) are unchanged: they read `view.bar` and sit just above the bottom bar, overlapping the picture during a choice (acceptable: four-shots keep faces high).
- Name cards (the opener) stay top-left under the top bar.

N7 (nice, Phase 2), **full-bleed scope:** in landscape phones the stage is pillarboxed, so a full-width 844x353 scope picture would be about 2x the area. That needs a window-sized WebGL canvas during films and an animated canvas rect during the handoff. It is deferred because it touches `fit()`, the r3d post sizing and the tap mapping (`main.js:70-75`). The `scopeBarFrac(aspect)` API is ready for it.

### D4. Cut-to-gameplay handoff (exact algorithm)

**Which scenes get one:** `opening` (to Food Court play), `ticket` (to play, only if `!game.pendingScene` when it starts, because a queued crisis plays next), `crisis` (to play), `boss` (to the boss fight). Not `ending` (to the credits, then the recap menu) and not the opener (to the title menu); those keep their fades. The `?cine=` dev hook passes `handoff: true` and, for `opening`, a `prepare` that loads level 1, so captures can see it (its `done` still returns to title).

**Gameplay camera (the target G), exact:**

- `Renderer3D.camera = PerspectiveCamera(42, 960/640, 10, 3000)` (`render3d.js:80`). Aspect is always 1.5, because the renderer is always `setSize(960, 640)` (`:154-155`) and CSS scales the canvas.
- Per frame (`render3d.js:655-656`, `:679-680`):

```
tx = camX + 340, tz = camY + 245, sx/sz = (random-0.5) * g.shake
position = (tx + sx, 280, tz + 330 + sz)
lookAt   = (tx + sx, 42,  tz - 10 + sz)
fov = 42, up = (0,1,0), roll = 0
```

- `camX/camY` come from `game.camTargetX/Y()` (`game.js:363-374`), are snapped on level load (`game.js:208`) and smoothed in play (`game.js:449-450`). **During a cutscene they do not change** (`updateScene` does not touch them), so G is constant across the handoff. In orbit terms G is `dist 415.0, pitch 35.0 deg, yaw 0`.
- Pixel ratio in play is `setPixelation(level)` (`render3d.js:151-159`), 0.6 and pixelated by default. The film's crisp ratio is undone by `StoryFilm.dispose()` (`storyFilm.js:79-85`). **That dispose happens on the hard cut into the handoff shot, so the resolution change hides behind a cut, not at the cut to play.**

**Start pose (C)**, from `handoffStart(kind, party, boss, blocked)`. Party P = average of live players (sim x,y; world X=x, Z=y). `blocked(x, z) = game.collides(x, z, 8)`.

- `rise` (opening, ticket, crisis):
  - `l_c = (P.x, 40, P.y - 150)`;
  - `p_c = (P.x + 46, 38, P.y + 120)`; if `blocked(p_c)`, set `p_c.y = 72` (above `WALL_H` 52, `mall3d.js:12`);
  - `fov_c = 50` (full frame), `roll_c = 0.03`.
  - This is the party seen low from behind, looking into the level.
- `boss`: B = `game.boss` (sim), `d = norm(B - P)`, `n = (-d.y, d.x)`;
  - `p_c = P - d*110 + n*36` at height 34 (72 if blocked);
  - `l_c = (B.x, 70, B.y)`, `fov_c = 46`, `roll_c = -0.03`.

**Blend** (`blendPose(C, G, e)`, orbit space, so the camera *cranes up and back* in an arc instead of sliding):

```
for P in {C, G}: d = P.p - P.l; dist = |d|; yaw = atan2(d.x, d.z); pitch = asin(d.y / dist)
if e >= 1: return G (the exact object, so no float drift)
l     = mix3(C.l, G.l, e)
yaw   = C.yaw + wrapPi(G.yaw - C.yaw) * e
pitch = mix(C.pitch, G.pitch, e)
dist  = exp(mix(log C.dist, log G.dist, e))
p     = l + dist * (sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch))
fov   = mix(C.fov, 42, e); roll = mix(C.roll, 0, e)
```

**Timeline of a handoff beat** (duration D: opening 2.6, ticket 2.2, crisis 2.2, boss 2.4). With t = beat time:

| Quantity | Formula | Reaches its end value at |
|---|---|---|
| camera | `k = clamp01(t/(0.8D))`, `e = handoffEase(k)` | 0.8D; **the last 20% of the beat is exactly G** |
| letterbox | `bar = 119 * (1 - smooth((t - 0.35D)/(0.45D)))` | 0.8D |
| film tint / vignette | overlay alpha `1 - smooth(t/(0.7D))` | 0.7D |
| HUD | `drawGameOverlay` into an offscreen 960x640 layer (it clears and sets its own alpha, `hud.js:50-57`), then `ctx.globalAlpha = smooth((t-0.55D)/(0.3D)); drawImage(layer)` | 0.85D |
| music | `currentTrack()` returns the *play* track while a handoff beat is active (J-cut); the cutscene SFX bus is not stopped until finish (L-cut) | t = 0 |

**Implementation steps:**

1. **cutscenes.js.** Constructor option `handoff: { kind, dur }` (default null, so existing tests are untouched). If set, push `{ t: 'shot', s: '', handoff: kind, dur, cam: { shot: 'handoff', kind, dur } }` as the last beat.
   - `view()`: when `b.handoff`, set `v.film = null` (StoryFilm disposes, and `render()` draws `r3d.render(game)`, `main.js:1115-1118`), `v.handoff = t/D`, and `v.bar` from the formula above.
   - `enter()` of the handoff beat calls `hooks.handoffStart?.()`.
   - `camera()` calls `resolveShot` (`cutscenes.js:410`). Its new `'handoff'` kind returns `{ px..lz from C, fov: C.fov, roll: C.roll, handoff: k, hdur: D }`, with **no** `lights`, `fog` or `dim`, so `applyCine` (`render3d.js:1066-1089`) leaves the level's own lighting alone. C is cached on the beat at enter, so it is stable.
2. **render3d.js** in `render(g)`, before `if (cc)` at `:658`:

```js
if (cc && cc.handoff != null) {
  const G = gameplayPose(g.camX, g.camY, sx, sz);
  const C = { p: [cc.px, cc.py, cc.pz], l: [cc.lx, cc.ly, cc.lz], fov: cc.fov, roll: cc.roll || 0 };
  const P = blendPose(C, G, handoffEase(this.hoK(cc, rdt)));   // hoK: see D5 (guests interpolate)
  this.camera.position.set(...P.p); this.camera.up.set(0, 1, 0); this.camera.lookAt(...P.l);
  if (P.roll) this.camera.rotateZ(P.roll);
  if (this.camera.fov !== P.fov) { this.camera.fov = P.fov; this.camera.updateProjectionMatrix(); }
  this.cutPos = this.cutLook = this.cutFov = null;   // no smoothing state survives into play
  this.cineLights.forEach((l) => { l.intensity = 0; });
} else if (cc) { /* existing branch :658-676 */ } else { /* existing :677-681, now via gameplayPose */ }
```

   When `cc` goes null on the next frame, the existing reset at `:678` does not run (cutPos is null), and fov is already exactly 42 with up = (0,1,0). **So frame N+1 equals frame N except for the shake jitter both share. No jump.**
3. **main.js.**
   - `startCutscene(id, done, sandbox, opts)` passes `handoff` per the rules above.
   - `hooks.handoffStart` runs `game.npcs = game.npcs.filter(n => n.id === 'ray' && !n.cornered)` so the stand-ins leave on the cut, not on the last frame. This is the same filter as `endCutscene` (`game.js:1370-1376`), so it is idempotent.
   - Opening only, `hooks.prepare` (called once by Cutscene after the last choice is made, or at handoff enter if never called): `game.startLevel(n); savedBanner = { ...game.banner }`. The level then builds under the film (step 4).
   - At `handoffStart`, opening also sets `game.banner = { ...savedBanner }`, because `updateScene` ticks the banner down (`game.js:1366`) and it would otherwise expire before play.
   - `go = () => { game.endCutscene(); if (!prepared) game.startLevel(n); setState('play'); }` (`main.js:546`). The skip-cutscenes path never prepares, so it still works.
   - `syncStoryFilm`: run `if (storyFilm && game && game.level && r3d.level !== game.level) r3d.render(game)` **every frame**, not only at film creation (`main.js:632`). Any level change under a film then builds behind it, on hosts and guests alike. The film renders after it in the same frame, so nothing flashes.
   - `currentTrack()` (`main.js:1062`): `const st = state === 'cutscene' && cutHandoffActive() ? 'play' : state`, where `cutHandoffActive` reads `cut?.beat?.handoff` or `net.ui.cut.handoff >= 0` on guests.
   - `finishCutscene` (`:606`) is unchanged. `done()` sets `state = 'play'` in the same update, before `render()`, so **no frame is drawn without the camera, and there is no black frame**.
4. **hud.js** `drawCutscene`: when `v.handoff != null`, draw the handoff layer (vignette and Low tint fading, bars from `v.bar`, HUD layer fading) instead of the line/choice UI. The "film tint" on both tiers is an overlay: preset multiply colour (NIGHT_RAIN `#c9d4dc`, SICK `#cfdcb8`, FRYER `#e2c7a8`), a 0.5 vignette and the grain tile, all at the fade alpha. r3d's post is not touched.
5. Touch controls (N6): `setMode('play')` still happens at `setState('play')`. A CSS `transition: opacity .35s` on `#touch .face, #touch .small` plus a one-frame `fade` class makes them fade in instead of popping.

### D5. Netplay (co-op) behaviour

- Guests already get `ui.cut` (with `film`) and `g.cutCam` (`main.js:789`, `netstate.js:40`, `:272`).
- **Handoff on guests.**
  - Add `cc[10] = r3(handoff k)` and `cc[11] = r2(dur)` when present; reading treats a missing index as no handoff (tolerates older hosts).
  - The guest computes G from **its own** `camX/camY` (smoothed at `netstate.js:365-368`; converged, since players are frozen during the scene), so its last handoff frame equals its first play frame.
  - Snapshots arrive at network rate, so the guest advances k locally: `hoK = min(1, max(hoK + rdt/(0.8*dur), kHost))`. It is monotonic and never behind the host, and it resets when `cc` is null.
  - `cleanCut` adds `handoff: v.handoff == null ? -1 : num(v.handoff, 0, 1)`; `drawCutscene` treats `< 0` as none.
- **Hits on guests (fixes A2 #16).**
  - `Cutscene.fireCues` merges every cue fired in a frame into `lastHit = {shake, flash, blood, grease, punch}` (max of each) and increments `hits`.
  - `view().film.hit = [hits, shake, flash, blood, grease, punch]`; `cleanCut` sanitizes it (6 numbers, `int` for the first, `num` 0..20 for the rest).
  - `StoryFilm.update` applies a hit when `fv.hit[0]` changes. The constructor sets `hitSeen` to the current value so it does not replay on join.
  - Remove `storyFilm.hit(...)` at `main.js:666` (it would double).
- Sounds: new cues and `duckAll` reach guests through `audioTap` (`audio.js:172-177`, `netstate.js:384-391`). Cue `args` are passed as `sfx[c.sting](...(c.args || []))` at `main.js:663`, and audioTap forwards the args.
- Prebuild under the film (D4 step 3) also covers guests whose level key changes mid-scene (Scene 1 prepare).
- The opener never runs online (`main.js:261`), so nothing changes there.

### D6. Skip semantics (unchanged from the player's point of view)

- **Opener:** the gate, then any press after 0.35 s of real elapsed time skips to the title. During the studio pre-roll `this.t` is negative, so `press()` must use `this.age` (incremented in `update` whenever not gated).
- **Story scenes:**
  - Lines, cards, shots and choices advance exactly as now (`cutscenes.js:258-266`).
  - **Handoff beat:** a press sets `rush = true`, and the beat's clock then runs at 6x (the rest of the handoff takes about 0.35 s). It still blends continuously, so a press never causes a camera pop. It never finishes instantly from mid-blend.
  - Skip-cutscenes (K / title toggle) still calls `runSkip()` and finishes at once with no handoff (`cutscenes.js:220-229`). Opening's `go()` loads the level because nothing was prepared.
  - Guests cannot advance (host-driven), as now.
- **J-cut cues** (negative `at`) pre-fire only when the previous beat *auto-advances*.
  - On `update`, for `nb = beats[i+1]` with `nb.cues`, fire each `c.at < 0` once when `this.t >= autoEnd(b) + c.at`, where `autoEnd(line) = max(hold, len/48 + 1.1 + len/60)`, `card/shot = dur`, and `choice = Infinity`. Mark it `c._pre = true`.
  - On a press, they fire at the new beat's t = 0 (the existing sequential `fired` loop does this naturally; skip `_pre` ones).
  - Skipping is never delayed.
- **`scare(at, sting, o)`** helper in cutscenes.js returns `[cue(at - o.silence, 'duckAll', { args: [o.silence + 0.08] }), cue(at, sting, o)]`. `enter()` sorts `b.cues` by `at` once.

---

## E. Implementation checklist (ordered)

M = must-have, N = nice-to-have. Line counts are rough. Run `npm test` after every M item. If time runs out, stop after any item: the game stays shippable. **Priority call: items 1-9 deliver the core of the request (scope, grade, handoff, horror toolkit). Items 10-12 deliver the scenes. N items come last.**

1. **M - camMath + gameplay pose refactor** (~90 lines). Create `src/camMath.js` (D1). Have `render3d.js:17-18`, `:655`, `:679-680` use `gameplayPose`, with no behaviour change. Add `test/film.test.js`:
   - `gameplayPose(100,200)` gives `p = [440,280,775]`, `l = [440,42,435]`;
   - `scopeBarFrac(1.5) ≈ 0.1862`, `SCOPE_BAR_PX = 119`;
   - `mmToFov(35) ≈ 24.3`;
   - `blendPose(C,G,1) === G`, `blendPose(C,G,0) ≈ C`;
   - `rise` height is monotonic over e.
2. **M - Handoff in cutscenes.js** (~110 lines). The handoff option and beat, `view().film = null`, `view().handoff`, the bar formula, `rush`, the `'handoff'` kind in `resolveShot`, `handoffStart` / `prepare` hooks, the hit counter with `view().film.hit`, cue `args`, negative-`at` J-cuts, the `scare()` helper. Tests:
   - opening with handoff: the last beat is the handoff and `film` is null during it;
   - the bar reaches 0 and the scene is `done` within D of entering;
   - a press during the handoff finishes within 0.5 s, not instantly;
   - `skip: true` is still instant;
   - a J-cut cue fires before the cut on auto-advance;
   - the hit counter increments.
3. **M - render3d handoff branch** (~30 lines), exactly D4 step 2, including `hoK` (D5).
4. **M - main.js wiring** (~60 lines). Per-scene handoff rules (ticket only when no crisis is pending), `prepare` / `go` / banner for opening, prebuild every frame under the film, `currentTrack` J-cut, cue args, remove the direct `storyFilm.hit` call, the `body.film` class.
5. **M - netstate** (~20 lines). `cc[10..11]`, `cleanCut` (bar 130, handoff, film.hit, card.credits). Extend `test/net.test.js` with a round-trip of these fields.
6. **M - HUD: scope and handoff layer** (~140 lines). `drawCutscene(ctx, v, time, fx)`: 119 px bars from `v.bar` (cap 130, no touch clamp), pure-black bars in film mode, the handoff layer (HUD offscreen fade, tint/vignette fade, grain tile), hints in the top bar, `drawScopeSub` via cineOverlay, the credits card drawer. **Checkpoint: play Scene 1 to the Food Court and the ticket to play; the cut must be invisible.**
7. **M - Scope in the film players** (~60 lines). `cineCore`: `barMax = scopeBarFrac()`; delete `:174` portrait x1.16 and `:183` portrait x0.45. `storyFilm` reads 119 from the view. `cineOverlay`: in-bar subtitles, title +170 px, hint in the top bar. `index.html` `body.film` CSS.
8. **M - Grade and Low pass** (~220 lines). `cineGrade.js` presets and GLSL. `cinePost` High composite rewrite (order, weave, breath, 24 fps grain, `uBar`, `uCA`, generalized motion blur); the new Low pass with HalfFloat detection, lazy allocation and its own frame guard plus fallback. Swap the storyFilm presets (`:45-48`) to the cineGrade names. Default the opener to NIGHT_RAIN. Restore all renderer state in `finally`.
9. **M - Horror toolkit** (~260 lines).
   - `cineCore`: handheld v2 + `panic`, `punch`, `splat`, CA spike, `scare()`, `relens`, `mm`, aperture scaling, the motion vector every frame, flare projection, `view().blood/flares/studio`.
   - `cineLens.js`: blood/grease layer, flare drawer, grain tile.
   - `cineFx`: `failing` and `scriptedFail`.
   - `cineStage`: `breathe`, `tremble`, `flinch`, `lookAtPoint`.
   - `cineAudio`: B7 cues.
   - `audio.js`: `musicDuck` + `duckAll` (added before the audioTap wrap).
   - `StoryFilm`: `fxView()` and hits from `fv.hit`.
10. **M - Opener pass** (~120 lines). Studio pre-roll (`pl.t = -4.5`, `this.age` skip guard, the studio card in the overlay), then C1 rows 1, 2, 3, 4, 6, 11 (silences, slam, blood, lurch, "move in the dark", J-cut rev, title silence), plus grades and flares on 5 and 7-10.
11. **M - Story pass** (~200 lines). C2 `plan.freeze` dropout and silence; C3 fake-out and neck cracks; C4 sprinter burst, `cr.empty` blood, panic flags; C5 silence before the turn, the roar grease, the drums tube; C6 the restructured `en.reflect`, the kneel grease, the credits card beat. All story sounds go in `cutscenes.js` cues, never in `storyFilm.js`.
12. **M - Ship hygiene.** Bump `sw.js` to `motd-code-v17`. Add `390x844` and `handoff` frames to `tools/story-shots.mjs`. Run `npm test`. Capture High and Low at 1280x720, 844x390 and 390x844 (F2).
13. **N1** - High anamorphic streak chain (~60 lines).
14. **N2** - High per-pixel reprojection motion blur and bloom-lit depth haze (~70 lines).
15. **N3** - Scissor the bars out of the scene pass on both tiers (~30 lines; reset in `finally`).
16. **N4** - `relens` every face shot to the mm in section C, verifying each against walls in captures.
17. **N5** - CCTV scares: `drawFeed` "stare" (opener 28.6) and `drawEscalatorFeed` "lunge" (Scene 1 monitor).
18. **N6** - Touch controls fade in via CSS (D4 step 5).
19. **N7** - Full-bleed scope in landscape (D3, Phase 2).
20. **N8** - `prefers-reduced-motion`: shakes, punches and flashes x0.35, no panic jolts.
21. **N9** - The recap fades up from black after the credits.
22. **N10** - `tools/handoff-check.mjs`: screenshot the last handoff frame and the first play frame, assert mean pixel diff < 2%, excluding the HUD layer and particles.

---

## F. Verification and risks

### F1. Automated checks

- `npm test` stays green. Existing scene tests are unaffected because handoff is opt-in via an option (`test/scenes.test.js:67`, `:84`).
- New: `test/film.test.js` (item 1), the cutscene handoff, J-cut and hit tests (item 2), the netstate round-trip (item 5).
- `node tools/story-shots.mjs --quality high` and `--quality low`, with `--sizes 1280x720,844x390,390x844`. Zero console errors and no leaked GPU objects (the tool prints both).
- `node tools/visual-shots.mjs` before and after: gameplay frames must be pixel-identical apart from particle and shake randomness. Item 1 is a pure refactor.

### F2. Manual checks

1. Opener: the studio card, then the atrium. Silence at 13.65 and 17.6, then the hits. Blood at 22.6. The lurch at 35.9 with the rev J-cut. Silence 69.25-70.45, then the title inside the picture. Skip works from the studio card onward after 0.35 s.
2. Scene 1 to Food Court: the handoff cranes up from behind the party. Bars slide away, the HUD fades in, `level_1` music starts during the crane, and the stage banner shows. No frame without the camera, no FOV or position step, no stand-in vanishing, no hitch (the level was prebuilt).
3. Ticket with a crisis queued: no handoff, the crisis follows. Without one: a handoff.
4. Crisis, all 4 replies: each ends in a handoff, then play; `cr.empty` shows blood.
5. Boss: the roar grease, then the handoff to the boss fight with the HP bar fading in and `boss_1` playing.
6. Ending: the reflect scare is quiet, then Pam's chime; the smash cut, the arcade card, then credits (kungFuDOOM only), then the recap.
7. Portrait 390x844: the picture is 163 px tall, subtitles inside the bottom bar (2 lines), hints in the top bar, no magenta stage glow, choices tappable.
8. Low on a phone: grade and grain visible, frame rate at least 30, no banding blowout in the darks (HalfFloat, or byte with grain dithering).
9. Toggle Graphics (Z) between scenes, then play gameplay: tone mapping, render target, scissor and pixel ratio all restored (no washed-out or black game).
10. Co-op: a host plus 1 guest through Scene 1 and the boss. The guest sees the shakes, flashes and blood, and its handoff is smooth (local k), ending exactly on its gameplay camera. Sounds are not doubled.

### F3. Top risks and mitigations

| Risk | Mitigation |
|---|---|
| Shared renderer state leaks (tone mapping, render target, scissor, pixel ratio) into gameplay | All film passes restore state in `try/finally`; `StoryFilm.dispose` and `Intro.teardown` already restore the pixel ratio; F2 #9 |
| Handoff start camera inside a wall | `blocked()` test raises the camera above `WALL_H`; the arc rises immediately; verify with handoff captures at spawn points |
| Hitch at the cut (level build) | `prepare` loads the level during the replies; prebuild every frame under the film |
| Guest handoff stepping or mismatch | local monotonic k; G computed locally from the guest's own `camX/camY`; tolerant `cc` parsing for version skew (plus the sw bump) |
| Low-tier phone perf with the new pass | lazy RT, Low frame guard falls back to direct render plus overlay grain; N3 scissor recovers more |
| Over-dark horror grades on phones | floor at least 0.045, exposure at least 0.9, test outdoors-bright screenshots; presets are tunable in one file |
| Photosensitivity (strobes, flicker) | at most 3 full-screen flashes per second; tube flicker is local light, not a full-screen flash; N8 reduced motion |
| Tone drift (too gory or too grim) | B6 rule 7 (no gore on survivors), blood once per scene, scare-then-snap preserved by the existing dialogue |
| Banner and music regressions at play start | banner re-armed at `handoffStart`; `currentTrack` returns the same id in the handoff and in play, so there is no restart |
| Studio pre-roll breaking seek and capture tools | `seek()` runs from `begin()` (t -4.5) forward, so it is fine; `render()` stays black below t 0.04 |
| Scope too ambitious for one session | strict order; items 1-9 are self-contained and testable; N items deferred without loss of correctness |
