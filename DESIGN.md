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

Each wing is a stage plus a boss, with its own theme, set of monsters and choices. The story is [STORY.md](STORY.md) (White Acre). Only Wing 1 is playable today. The Wing 2-6 model notes in 5.5 predate White Acre: the roster names changed, the models did not, and THE HUSH has no model yet. The others are listed, locked, on the Mall Directory in the Security Room.

| Wing | Area | Boss |
|---|---|---|
| 1 | Food Court | The Deep-Fry Butcher (built) |
| 2 | Arcade, Bowling & Batting Cages | The Pin Boy (planned) |
| 3 | Movie Theater | The Abatement Ambush (planned) |
| 4 | Fitness Center / Gym | Mr. Paragon (planned) |
| 5 | Toy Store & Holiday Atrium | The Village Santa (planned) |
| 6 | Hardware & Garden Center, then the Rooftop Helipad | The Crew Chief (planned) |

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

### Cinematics

- **Opening intro.** A load always goes straight to the title. The opener is a pre-rendered live-action movie (`assets/film/opener-v2.*`, played by `src/movie.js`, captions from its VTT) that plays when a story run starts: title (SOLO PLAY, or an online room) → the story text on a new save → hero select → **movie** → hard cut into `startGame()` (the Security Room). The movie predates the White Acre story and will be remade only with the owner's approval. It starts as soon as everyone is ready, with no countdown, from inside the key or tap that readied the last hero, because phones only allow sound from a gesture (a gamepad or an online guest's press can't give one: if the browser then refuses sound, it plays muted with a "tap for sound" button). So co-op players join before the last player readies up, or drop in during play. "WATCH INTRO" (or the I key) is a rewatch that comes back to the title. Any key, tap or gamepad button on this device skips it. Online guests don't see it: they stay on hero select until the host's game starts, and can't skip it. If the movie can't play, breaks, or shows no frame within 8 s, the in-engine opener (`src/intro.js`) plays instead and leads to the same place. No game music plays over either one. The service worker never caches the movie. For tools: `window.__motd.playIntro()` is a rewatch (`{ engine: true }` for the in-engine one), `?intro=1` does the same on load with no key-press gate (browsers then start it muted unless they allow autoplay), and `window.__motd.introThen` says where the opener leads (`'game'` or `'title'`).
- **Camera and cues.** Cutscene beats can carry `cam: {shot, move, roll, dur}`, where `move` is `push`, `dolly`, `orbit`, `crane`, `tension`, `reveal` or `roar`. They can also carry `cues: [{at, sting, shake, flash, slow: [scale, seconds]}]`. Slow motion only affects the set. It never slows typing, timers or choice timing.
- **Letterbox.** Desktop bars are 90px on cards and 42px on lines. Touch devices cap them at 64px and 38px.
- **Capture.** `window.__motd.cutscene('opening' | 'crisis' | 'boss')` plays a scene for screenshots or video capture.

## 5. Character & boss redesign (ground-up)

Goal: every character reads as one continuous sculpted body at the 3/4 gameplay camera, with no stacked blocks at the joints and no faces painted on balls. The style lock in section 2 still applies: clean 3D, late-90s console look, hand-painted canvas textures, no inking.

### 5.1 Pipeline: (a) procedural smooth-skinned meshes on the KayKit skeleton

**Evaluation.** (b) Exporting three.js meshes to GLB and loading them at runtime only adds a bake step and a binary artifact. It produces the same geometry as (a), but makes it harder to iterate on, harder to vary per spawn, and harder to diff. It is only worth it later as a load-time cache. (c) Blender CLI is not installed and can't be installed with pip, so it would pull a roughly 300 MB toolchain into the build for assets we already generate in code. Rejected. **We pick (a).** We keep `rig.glb`'s 41-joint skeleton, `applyRig` adult proportions, the `anims.glb` clips, `clipVariant`, upper/lower split, `adultPose` and `undeadClip`. We replace the *surfaces*: rigid per-bone primitives become a small number of **continuous lofted surfaces skinned across joints**.

| Today | Replacement (src/mesh.js) |
|---|---|
| `limb()` lathe per bone, sphere "delts", gaps hidden by overlap | `loftChain(rig, bones[], profile)`: one tube per chain (clavicle-upperarm-lowerarm-wrist; hip-upperleg-lowerleg-ankle). Rings follow bone world positions at bind pose. Each ring is an 8-12 point ellipse from a radius profile with bulges (deltoid, biceps, forearm, calf) and flats (elbow, knee) |
| Torso = two lathes + sphere bust | `loftTorso(rig, B)`: one surface from pelvis through spine and chest to the neck base. Elliptical rings with shoulder lobes, pec/bust and belly terms. Arm and leg tubes start *inside* it (rings 0-1 are buried), so there is no seam |
| Fist = rounded box, thumb box | `mitten(len, w)`: lofted palm with a merged thumb lobe. Zombie variant has a claw-curl and longer fingers. ~80 tris |
| Feet = rounded box | `shoe(style)`: lofted sole and upper (sneaker, boot, platform, bare-rotted) |
| `headGeo` displaced sphere + separate ear spheres | `sculptHead(p)`: `headGeo` extended with parameters (brow, socket depth, nose length/hook, cheek hollow, jaw width, chin, slack-jaw gap, ear lobes displaced *into* the same mesh). Real eye sockets hold inset eye spheres: warm iris on humans, glow pinpoints on zombies. `faceTex` stays for skin, brows and lips but stops faking geometry |
| Hair/hats = scaled `cap()` spheres | `shell(headGeo, mask(u,v), thick, clump)`: offsets head vertices along the normal inside a mask (fringe, mohawk, pigtails root, cap crown) with noise clumps. Hat brims and visors stay rigid parts |
| Clothes = different material per bone part | Clothes are **painted into the body atlas**. Loft UVs are u = around and v = along the chain, so a sleeve end is just a line in the texture. Loose items (apron, vest flaps, tatters, coat tails) are lofted ribbons, skinned with the same blended weights |

**Weight blending.** Each loft ring stores its parametric position `s` along the chain. A vertex gets at most 2 bones (skinIndex slots 0-1): `w = smoothstep(j - k*r, j + k*r, s)` around each joint `j`, where `r` is the local tube radius. k = 0.6 at elbows and knees, 1.0 at shoulders (chest/upperarm) and the groin (hips/upperleg), and 1.2 along the waist (hips, spine, chest blended as a 3-ring cascade). The neck blends chest to head over the bottom 40% of the neck. To fight candy-wrapper pinch, we add one extra "volume ring" (+8% radius) at each joint centre, and keep blends 2-bone only (KayKit clips have little twist). Rigid accessories keep 1-bone weights.

**Geometry budgets (triangles, LOD0).**

| Class | Body + head | Clothes/ribbons | Props/weapon | Total cap |
|---|---|---|---|---|
| Survivor (4 on screen) | 2,400 | 800 | 800 | **4,000** |
| Zombie (100 horde) | 900 | 300 | 200 | **1,400** (horde ~140k tris) |
| Zombie LOD1 (mobile, more than 60 alive or more than 30 m away) | rings halved, no ribbons | - | glow only | **600** |
| Boss (1 on screen) | 6,000 | 2,000 | 2,000 | **10,000** |

**Material sharing.** `mergeParts` becomes `bakeCharacter(rig, {surfaces, parts})` in `src/mesh.js`, called by heroes.js, monsters.js and the boss builders. Heroes are merged too. It accepts *pre-skinned* loft geometry (skinIndex and skinWeight already set, in rig space, indices into the same `rig.traverse` bone order) plus legacy rigid parts (1-bone weights as today). It still bakes colour into vertex colours and still groups by material key. Target: **3 materials per zombie archetype set, shared by all 12 variants.** (1) `zBody`: one 512x512 atlas, 4x4 tiles of 128 px, one tile per variant, Nearest filter. (2) `zWet`: gore, mouths, guts, roughness 0.3. (3) `zGlow`: eyes, goo, emissive. Survivors get 2-3 each (`body` atlas 256x256, `metal`, `glow`). Each zombie is 3 draw calls, so 100 zombies is about 300. `Actor` keeps cloning materials per instance for flash/fade, but only these 3, and textures and programs stay shared (`zombieRim` cache key).

### 5.2 Survivors (warm palettes, clearly human)

| | Biker (Tank, chainsaw) | Mall Cop (Ranged, pump shotgun) | Skater (Speed, spiked bat, dash) | Mall Goth (AOE, hairspray torch, paint bombs, boombox) |
|---|---|---|---|---|
| Look | Huge, barrel chest, red beard, bandana, wraparound shades | Fit, tucked uniform, peaked cap, moustache, aviators | Lanky teen, baggy tee and shorts, backwards cap, high-tops | Slight, tall platforms, long black coat, purple-streaked hair, pale with dark lips |
| Silhouette | Inverted triangle: pauldron shoulders, small head, wide boots | Upright rectangle, cap peak and shotgun barrel line | Narrow top, wide shorts, deck diagonal on the back | Long vertical, coat tails flare into a triangle, boombox block on the hip |
| Palette | Tan skin `#d29a70`, black leather, denim `#26324a`, chrome, gold studs, red bandana | Sky shirt `#6a9ad8`, navy `#16254a`, gold badge, warm skin | Green tee `#38c870`, navy shorts, hot pink `#ff5ad0` accents, white socks | Black `#14101c`, electric purple `#7a2ab0`, cyan eyes `#40e0ff`, silver |
| Signature details | Skull back patch, chain belt, studded cuffs, rolled-sleeve forearms with sculpted veins | Radio, name tag, cuffs pouch, shell bandolier across the chest (new) | Elbow/knee pads, striped socks, wristbands, hair spikes through the cap | Spiked choker, crossed belts, fishnet arm warmers, paint-can holster on the thigh (new) |
| Weapon | Chainsaw: rigid on `handslotr`, chain is a UV-scrolling strip, exhaust puff sprite on rev | Pump: separate `forend` pivot slides back on each shot, shell-eject sprite | Aluminium bat with nails and tape grip; dash leaves a pink deck trail | Hairspray can and lighter: flame cone sprite. Boombox is a rigid part on the chest/hip, scale-pulsed on the bass. Paint cans are thrown props |
| Idle / run | `2H_Melee_Idle` / `Running_C` (heavy) | `Idle_Combat` / `Running_C` | `2H_Melee_Idle` / `Running_A` | `Idle` / `Running_B` |
| Attack | `2H_Melee_Attack_Slice` (saw sweep), upper body on run | `2H_Ranged_Shoot` + pump, `1H_Melee_Attack_Stab` butt-stroke | `1H_Melee_Attack_Slice_Diagonal` alternating with `2H_Melee_Attack_Slice` | `Spellcast_Long` (torch jet, looped), `1H_Melee_Attack_Stab` |
| Hit / death | `Hit_A` / `Death_A` | `Hit_B` / `Death_B` | `Hit_A` / `Death_B` | `Hit_B` / `Death_A` |
| Class-specific | Turbo `2H_Melee_Attack_Spinning` (saw spin); rev = procedural hand jitter | Throw `Throw`; reload = `Spellcast_Raise` upper body + pump | Dash `Dodge_Forward` + additive forward lean 0.35 | Paint bomb `Throw`; boombox plant `Spellcast_Raise`; turbo `Spellcast_Long` |

### 5.3 Zombies (undead: rot, gore, rags, shamble, dead eyes)

Every type keeps the green fresnel rim, glow pinpoint eyes in real sockets, and a sculpted slack jaw (jaw-gap parameter). Every gait is an **additive overlay over a base clip** (`undeadClip`), never a clean jog.

| | Walker | Sprinter | Brute | Spitter |
|---|---|---|---|---|
| Look | Gaunt dead shopper, sunken cheeks, torn clothes | Emaciated fast-food worker, jaundiced, claws | Dead mall guard, grey slab of meat, riot gear | Bloated fryer-vat victim, split belly leaking green |
| Silhouette | Hunched question mark, arms reaching forward | Low forward-pitched wedge, long arms, head jutting | Huge hunched gorilla block, tiny head, fists to knees | Pear: small head, enormous belly, drum on the back |
| Palette | Green-grey skin `#74b04c`, faded pastels, dirty denim | Yellow-green `#b4c040`, ketchup red, mustard | Blue-grey `#8a9ca2`, navy, security yellow stripe | Toxic green `#6cd038`, cream smock, glow goo `#80ff30` |
| Wounds | Bitten neck, exposed ribs, missing hair, sagging cheek flap | Chewed forearm (bone shows), torn throat, raw knuckles | Split skull under the helmet, ribs through the torn vest, stump arm | Burst belly, boils, dripping maw, peeling scalded skin |
| Base / overlay | `Walking_D_Skeletons` 0.85 + **shamble**: lean 0.38, dragging right leg, uneven arms | `Running_C` 1.5 + **lurch-hitch**: stop-start rhythm, forward pitch 0.5, uneven 0.6 | `Walking_D_Skeletons` 0.8 + **stomp**: hips drop on each footfall (new hips.position track), shoulders roll | `Walking_A` 0.9 + **wet hitch**: belly sway, head bob, retch pause every 2.4 s |
| Attack / hit / death | Grab-bite `1H_Melee_Attack_Chop` / `Hit_B` / `Death_C_Skeletons` (crumple) | Claw `1H_Melee_Attack_Stab` / `Hit_A` / `Death_A` | Overhead fists `2H_Melee_Attack_Chop` / `Hit_A` at 0.5 / `Death_B` | Lob `Throw` + head-pitch retch / `Hit_B` / `Death_C_Skeletons` |
| Spawn | `Spawn_Ground` | `Spawn_Air` (drops from vents) | `Spawn_Ground` 0.7 | `Spawn_Ground` |
| Variant 0 | Shopper: striped tee, shorts, pink sale bag | Burger crew: red shirt, paper hat askew | Riot helmet, club | Cream smock, leaking drum |
| Variant 1 | Clerk: name tag, right-arm stump, neck bite | Blue visor, half torn off, shredded sleeves | Bare skull through the scalp, sleeves torn | Pale-green smock, left-arm stump, drum |
| Variant 2 | Office worker: tie, ribs exposed, milky eyes | Toque, left-arm stump, black eyes | Left-arm stump, dropped baton, black eyes | No drum, extra boils, goo-soaked |

### 5.4 The Deep-Fry Butcher (Wing 1, redesign)

**Concept.** A hulking pig-mascot chef: a food-court fry cook whose head is jammed inside the cracked fibreglass head of the food court's pig mascot (pink snout, floppy ears, tusks), his small angry eyes glowing out of it. A tall, filthy chef's hat, a blood-soaked white jacket and apron, meat hooks on his back and a giant cleaver. Half mascot, half slaughterhouse: a smiling 90s mall icon that butchers people.

| Aspect | Spec |
|---|---|
| Height / proportions | About 2.6x survivor (about 120 units incl. `BOSS_SCALE`). Legs 22%, belly and torso 48%, mascot head 20%, meat-hook rack 10% above the shoulders. Stumpy, wide-set legs. **Asymmetric arms:** right (cleaver) arm 1.4x the left, knuckles near the knee |
| Silhouette | Pear-shaped gut with a forward hunch. Big round mascot head with a beak. Three meat hooks with dangling sausage links rising off the back like a spine. A cleaver blade wider than his head on the right. A fry basket on a chain hanging from the left |
| Palette | Apron **cream `#efe2c0`** with grease sheen (roughness 0.3 patches), brown-red stains and a burnt hem. Skin: blistered pink-grey `#b88a80` crusted with **golden fry-batter `#d8a040`** (crumb texture). Mascot: off-white fibreglass, chipped orange beak, red comb. Steel cleaver with a chipped edge. Fryer glow orange `#ff8a30`. No red-dominant read |
| Props | Cleaver (rigid on `rig.cleaver`). Fry basket (wire lattice texture on an alpha-tested box, glowing oil drips) on the new `rig.basket` pivot. Apron front and two side ribbons. Paper "SPECIAL" order tickets impaled on the hooks |
| Build | Bosses use the same `mesh.js` lofts, but on a **tiny custom bone tree of `THREE.Bone` objects**. `rig.arm`, `rig.cleaver`, `rig.legs[]` and `rig.heads[0].userData.jaw` *are* those bones, so render3d.js keeps rotating them exactly as now and the body is one smooth SkinnedMesh across shoulder, hips and knees. Jaw = the mascot beak's lower half. Bones: `root > pelvis > belly > chest > neck > head(jaw)`, `chest > armR(=rig.arm) > foreR > cleaver`, `chest > armL > foreL > basket`, `pelvis > legL/legR(=rig.legs)`, `chest > hooks` |
| New pivots (optional render3d lines) | `rig.basket` swings on `cast` (grease lob), `rig.belly` jiggles on footfalls, `rig.apron` lags behind the run. Missing pivots are skipped, so this is safe to ship before render3d is updated |
| Phases (unchanged) | P1 >66%, P2 >33%, P3: batter crust cracks off, glowing oil seams appear (emissive ramp on the atlas), and he drips grease (existing trail) |

### 5.5 Wing bosses (planned)

All bosses use the Butcher's frame: `MOVESETS[id] = [p1, p2, p3]`, the `GAP` rests, roars at 66% and 33%, a glow wind-up tell, ground marks before impacts, and a "WINDED/STUNNED" punish window. **Stub rule:** each new move is first an alias to an existing implementation (column "stub"), so a boss is playable before its custom code exists.

| Wing | id | Name | hp | speed | dmg | scale (x survivor) | moves (P1 / +P2 / P3 upgrades) |
|---|---|---|---|---|---|---|---|
| 1 | `butcher` | The Deep-Fry Butcher | 3200 | 66 | 16 | 2.6 | sweep, slam, grease / +summon, charge / sweep2, slam2, charge2 |
| 2 | `bowler` | The Pin Boy | 4000 | 72 | 18 | 2.4 | strikeRoll, pinScatter, fastball / +ballReturn, summon / strikeRoll2, pinScatter2, tilt |
| 3 | `projectionist` | The Abatement Ambush | 4600 | 60 | 18 | 3.0 | spotlight, reelToss, filmLash / +intermission, summon / spotlight2, reelToss2, finalReel |
| 4 | `maxrep` | Mr. Paragon | 5400 | 80 | 22 | 2.8 | deadlift, plateToss, treadmillCharge / +flex, proteinSpew / deadlift2, plateToss2, treadmillCharge2 |
| 5 | `santa` | The Village Santa | 6200 | 62 | 20 | 2.8 | caneSweep, sackSlam, naughtyList / +toySwarm, caneHook / caneSweep2, sackSlam2, sackMaw |
| 6 | `mulchmaw` | The Crew Chief | 7200 | 56 | 24 | 3.0 | chipperSpray, hedgeSweep, seedBomb / +rootBurst, summon / chipperSpray2, rootBurst2, rotorWash |

**Wing 2: Gutterball, the Lane King.** A dead bowling-league champ whose right fist has fused into a cracked glowing bowling ball. Bowling shirt with a bloodied name script, a rack of pins sprouting from his back, a batting-cage pitching machine bolted to his left shoulder. *Silhouette:* hunched, a giant sphere fist low on one side, a pin "crown" on the back. *Palette:* teal and black bowling shirt, neon-green ball `#40ff90`, lane-wood tan, white pins with red stripes. *Moves:* **strikeRoll** (a lane-wide glowing line marks the floor 0.8 s, then he hurls his ball-fist down it; stub `charge`), **pinScatter** (pins rattle on his back, then a ring of pin shots; stub `slam` ring), **fastball** (the pitching machine whirs and flashes, then a 3-ball aimed volley; stub `grease`, direct-fire), **ballReturn** (the ball arcs back to him on a curved path), **tilt** (P3: arcade-cabinet ground slam, stunned after; stub `slam2`). *Model:* lofted body on a boss bone tree; ball = sphere on `rig.cleaver` (the fist bone); pins = merged lathe instances on the back.

**Wing 3: The Projectionist.** Tall, skeletal, a 1950s projector fused where the face was (the lens is the "eye"; its jaw is the film gate hinge). Film reels spin on both shoulders and celluloid strips whip from the wrists. *Silhouette:* thin and tall (3x), wide reel "ears", a beam cone in front. *Palette:* cinema velvet red `#a03040`, black, brass, a cold white beam. *Moves:* **spotlight** (a dim cone telegraph for 1 s, then a burning beam sweep; stub `sweep` with reach 220), **reelToss** (spinning reels boomerang out and back; stub `grease`), **filmLash** (a strip whip along a marked line), **intermission** (lights out, `e.invisible`, ticket-stub thralls; stub `summon`), **finalReel** (P3: a 360-degree slow beam rotation). *Model:* lofted gaunt body, projector box head with a lathe lens and emissive lens cap; reels = torus plus spokes on `rig.heads[1..2]` (spin via `h.rotation`).

**Wing 4: Max Rep.** A juiced gym-rat zombie: a barbell driven through both shoulders like a yoke, a torn neon windbreaker tied at the waist, a sweatband, veins glowing hot orange under grey skin. *Silhouette:* tiny head on a huge V-taper, the horizontal barbell line wider than anything else on screen. *Palette:* grey-violet skin, neon orange `#ff8a30` veins, teal and pink 90s windbreaker, iron plates. *Moves:* **deadlift** (squats, plates glow, then an overhead slam with a quake ring; stub `slam`), **plateToss** (rolling plate discs along marked lines; stub `grease`), **treadmillCharge** (stub `charge`), **flex** (P2: pose and roar, 50% damage reduction for 2 s, telegraphed by gold veins; stub roar), **proteinSpew** (a cone of chalky pools; stub pool). *Model:* lofted huge-body preset; barbell = rigid cylinder plus plates on the chest bone.

**Wing 5: Santa Claws.** The mall Santa, mutated: the red suit split over a grey distended gut, a beard matted brown-red, antler-like bone growths through the hat. A candy-cane hook in one hand, a writhing toy sack over the shoulder that grows a mouth in P3. *Silhouette:* round mass, hat tip and antlers on top, the sack as a second lump. *Palette:* faded Santa red `#b02030` (kept muddy so it never reads as the generic red giant: white fur, grey flesh and green sack dominate), dirty white, candy stripe, sack green `#30d060`. *Moves:* **caneSweep** (stub `sweep`), **sackSlam** (stub `slam`), **naughtyList** (marks each player with a scroll icon 1 s, then lobbed coal at each; stub `grease`), **toySwarm** (wind-up toy thralls; stub `summon`), **caneHook** (pulls a player in along a marked line), **sackMaw** (P3: the sack bites in an arc; the sack's jaw is `rig.heads[1].userData.jaw`). *Model:* lofted bloat preset; the sack is a lofted blob on the left arm bone with its own jaw bone.

**Wing 6: Mulchmaw.** The garden-centre manager fused into an industrial wood chipper: the hopper is his gaping chest mouth (jaw = hopper flap), hedge-trimmer and rake limbs, garden hose and vines wrapping everything. In P3 he climbs to the Rooftop Helipad (stage swap at the 33% roar) and fights in the downdraft. *Silhouette:* a boxy machine torso with a huge open mouth-hopper, long tool arms, a chute on the back spitting chips. *Palette:* safety orange `#ffa020`, rusted steel, vine green `#60e060`, mulch brown. *Moves:* **chipperSpray** (a cone of bone and wood chips; stub `sweep` cone), **hedgeSweep** (stub `sweep2`), **seedBomb** (thorn pools; stub `grease`), **rootBurst** (marked lines erupt; stub `slam` quake lines), **rotorWash** (P3 helipad: a wind pushes heroes toward the edge, telegraphed by the rotor sound and dust lines). *Model:* hybrid: a boxy chipper torso (rigid, merged) plus lofted vine-wrapped limbs on bones.

### 5.6 Animation mapping (anims.glb clips: verified)

Clips in `anims.glb`: 1H_Melee_Attack_Chop, 1H_Melee_Attack_Slice_Diagonal, 1H_Melee_Attack_Stab, 1H_Ranged_Shoot, 2H_Melee_Attack_Chop, 2H_Melee_Attack_Slice, 2H_Melee_Attack_Spinning, 2H_Melee_Idle, 2H_Ranged_Shoot, Cheer, Death_A, Death_B, Death_C_Skeletons, Dodge_Forward, Hit_A, Hit_B, Idle, Idle_Combat, Running_A, Running_B, Running_C, Spawn_Air, Spawn_Ground, Spellcast_Long, Spellcast_Raise, Spellcast_Shoot, Throw, Unarmed_Melee_Attack_Punch_A, Walking_A, Walking_D_Skeletons.

| Role | Clip(s) | Extra layer |
|---|---|---|
| Survivor base | see 5.2 table | `adultPose` arm tuck (unchanged) |
| Upper-body attack while running | attack clip via `play(..., {upper:true})` | unchanged |
| Zombie gaits | see 5.3 | `undeadClip` gains params `stomp` (hips.position Y dip, brute), `retch` (head/chest pitch pulse, spitter), `drag` (which leg drags, randomised per spawn) |
| Zombie hit-react | `Hit_A`/`Hit_B` at weight 0.6 over the shamble | undead overlay drops to 0.35 (existing) |
| Zombie death | `Death_C_Skeletons` / `Death_A` / `Death_B` | then gibs (existing) |
| Procedural (no clip) | chainsaw rev jitter, shotgun `forend` slide, boombox bass pulse, skater dash lean | small per-frame bone or pivot offsets after `mixer.update` |
| Boss (pivot-driven, not AnimationMixer) | render3d drives `rig.arm` (raise on windup, chop on sweep/slam), `rig.legs` (walk sine), `rig.heads[].rotation` and `userData.jaw` (open on windup/roar), `rig.rig.rotation.x` charge lean | new optional: `rig.basket` swing on `cast`, `rig.belly` jiggle, `rig.apron` lag, reel spin (Projectionist), sack jaw (Santa) |

### 5.7 Implementation checklist (in order)

1. **`src/mesh.js`** (new): `loftChain`, `loftTorso`, `ribbon`, `mitten`, `shoe`, `sculptHead`, `shell`, `blendWeights`, `bakeCharacter` (replaces `mergeParts`; handles pre-skinned and rigid parts), `atlas(key, tiles, drawTile)`. Pure geometry, no game imports.
2. **`src/heroes.js`**: rebuild `body()` on mesh.js (keep the `body(rig, B, o)` signature and the returned `{bone, chest, head, ...}` so costume code survives). Swap `cap()` hair for `shell()`. Call `bakeCharacter` for heroes. Keep `kit` exports.
3. **`src/monsters.js`**: `zombie()` on mesh.js, zombie body atlas (4x4 tiles), wound decals painted into the tile plus a few rigid gore parts in `zWet`. Delete `mergeParts`/`mergeAll` and call `bakeCharacter`.
4. **`src/assets.js`**: `undeadClip` params `stomp`, `retch`, `drag`. Add a LOD1 build per zombie (`m_walker_lod1`, ...) and pick it in render3d by alive count or distance on mobile.
5. **`src/bossModels.js`** (new): `buildBossRig(id)` making the `THREE.Bone` tree and the smooth SkinnedMesh, returning the same `r` shape (`root, rig, heads[], legs[], arm, cleaver, basket?, wings: [], mats`) with `userData.bossScale`. `models.js buildBoss` delegates to it for known ids (butcher first) and keeps the old path as fallback.
6. **`src/bossRoster.js`** (new): the stat table from 5.5 (`id, name, wing, hp, speed, dmg, scale, color, movesets, stubAliases`). `level.js BOSSES` and `WINGS[].boss` read from it. `bosses.js MOVESETS` is built from it, with unknown move names resolved through `stubAliases` to existing `MOVES`.
7. **`src/render3d.js`**: optional pivot lines for `basket`/`belly`/`apron`/reels (skip if absent). Material count assertions in dev.
8. **`src/hud.js`**: `WING_STAGES` rows 2-6 become "Coming soon: <boss name>" from bossRoster.
9. **Showcase:** `window.__motd.lineup()` in main.js calls `r3d.lineup()`. It clears the stage and stands the 4 survivors, 12 zombie variants (LOD0 and LOD1) and 6 bosses on a turntable row under neutral light, with a 3/4 camera. Each plays idle, and pressing a key cycles run/attack/hit/death. It logs tris and draw calls per character against the 5.1 budgets.
10. Verify: lineup screenshot review at gameplay zoom, then a 100-walker horde perf check on a mobile profile (target 60 fps desktop, 30 fps mid-range phone).

### 5.8 Implementation status (what actually shipped)

- **Pipeline (a) is live.** `src/mesh.js` has `skinCtx`, `loft` (rings of ellipses along bones, per-vertex 2-bone weights blended across joints, material zones) and `addSurface(s)`. `heroes.js body()` builds the torso, both arms and both legs as lofts (survivors and zombies); fists, feet, heads, hair, costume and weapons are still rigid parts on bones. Survivors keep their own `SkinnedMesh` surfaces plus rigid accessories (so weapon props like the flame jet and boombox stay addressable). Zombies pass `merge: true`, and `monsters.js mergeParts` bakes lofted surfaces (pre-weighted) and rigid parts into one skinned mesh per look, as before.
- **Not done from 5.1:** the 4x4 zombie atlas and the `zWet`/`zGlow` three-material split, `bakeCharacter` as a rename of `mergeParts`, LOD1 zombies, and `sculptHead` parameters. Zombies still use the shared per-look materials from `mergeParts`; draw calls per zombie did not change.
- **Zombie gaits:** `undeadClip` gained `stomp` (brute hips drop), `retch` (spitter heave) and `drag` (randomised dragging leg). The per-type parameters live in `ENEMY_STYLE` in `render3d.js`.
- **Bosses:** `src/bossModels.js` builds all six bosses (Butcher plus the five planned) as lofted bodies on a small `THREE.Bone` tree, with props parented to bones. `models.js buildBoss` delegates to it and keeps the old primitive builds as a fallback if it throws. The Butcher is Chef Cluck: a cracked fibreglass chicken-mascot head over a battered fry cook, with a cream apron plate, meat-hook rack on the back, an upright broadside cleaver on `rig.cleaver` and a fry basket on a chain on `rig.basket`. `render3d.js updateBoss` still drives `rig.arm`, `rig.legs`, `rig.heads[].userData.jaw` and the lean, and now also `rig.belly`, `rig.basket` and `rig.reels` when present.
- **Roster stubs:** `src/bossRoster.js` (`BOSS_ROSTER`, `MOVE_ALIAS`). `bosses.js` builds its movesets from it and resolves unwritten moves through `MOVE_ALIAS`. `level.js BOSSES` is unchanged (only the Butcher), `WINGS[n].boss` carries the names, and the Mall Directory shows "Coming soon: <boss>". Wings 2-6 stay locked.
- **Boss-concept lineup:** open the game with `?lineup` (e.g. `http://localhost:8080/?lineup=bosses`) or call `window.__motd.lineup('bosses')` in the console. Sections: `all`, `heroes`, `zombies`, `bosses`, `boss:<id>` (butcher, bowler, projectionist, maxrep, santa, mulchmaw) and `hero:<class>`. `window.__motd.lineup(false)` leaves it. The lineup renders at full resolution (pixelation off) on a plain stage.
