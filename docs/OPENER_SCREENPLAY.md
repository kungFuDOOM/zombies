# OPENER SCREENPLAY: "Doorbuster" (live-action cut)

> **Earlier story.** This is the script of the shipped movie, `assets/film/opener-v2.*`, which was made before White Acre. It is not canon: [STORY.md](../STORY.md) is. References below to STORY.md sections mean the earlier bible (see git history). A White Acre cut waits for the owner's approval.

**Title:** MALL OF THE DEAD, opener film "Doorbuster"
**Logline:** At 4 AM on Black Friday 1994, four strangers are each alone with a small, wrong detail at Brightwater Commons. Then a pig-masked butcher's free samples and a polite PA chime open the doors an hour early, and the four are pushed together in the food court as the line comes in.
**Runtime target:** 86 s (hard limits 60 to 90 s). 19 shots: 1 title card, 9 reused clips, 9 new generations.
**Story source:** `STORY.md` (pitch, the 4:59 truth, Dale, Pam, section 4). This replaces the montage structure in STORY.md 9a for the live-action film only. It adds no new lore.

### Shape (beginning, middle, end)
1. **Before (4:02 AM, shots 1-7):** Pam promises the doors open at six. Dale hands out free samples and the Mall Cop takes two. Then each survivor gets a role card and a moment alone with their secret: the Cop eats on patrol, the Goth smells breath in the vents, the Skater films a tunnel that breathes, the Biker finds drums he has seen before.
2. **Turn (4:59 AM, shots 8-14):** the chime plays. The Cop stops mid-chew and walks off. A uniformed hand swipes the card. Outside, every shopper's head turns to the speaker at the same moment. The doors burst and the horde floods in. *Cause and effect: samples, then chime, then Cop, then doors.*
3. **Together (5:07 AM, shots 15-19):** the Goth saves the Skater, the Biker cuts in for both of them, and the Cop comes to with eight minutes missing and racks his shotgun beside them. Four strangers, one formation, a horde closing in on the checkerboard. Hard cut to gameplay.

### Tone checks
- **Scare, then snap:** every dread beat is followed by a dry line (vents breathing, then "complaint number four"; the lost minutes, then "Later, Badge").
- **Nobody winks:** no one looks at the camera or comments on the genre. They are all scared and serious.
- **Pam is never angry:** every Pam line is warm and upbeat and sounds like a store announcement. She is never shown as a body, only speakers and monitors.
- **The Cop's secret stays hidden.** We see him eat two samples, freeze at the chime and walk off, and then a uniformed hand swipes a card. He never learns it and never says it. His only clue line is "I lost eight minutes."

---

## Look (all new generations)
Photoreal 1990s zombie horror with a late-70s mall-siege feel. Clean, lit 90s suburban mall: teal-and-cream checkerboard floor, brass rails, potted palms, pink and amber neon. It is **not** an industrial ruin. Dirty green-teal shadows and amber practicals, 35 mm film grain, slight halation on neon. Shoot 16:9, framed for a 2.39:1 center extraction (keep heads and props inside the middle 75% of the height), because the letterbox is added in the encode. No comic inking, halftone or cel shading. No real-person likeness. No readable text or brand logos in frame. Signs are either soft-focus neon shapes or blank. Mr. Drippy is a plain stenciled smiling oil drop with **no words**.

**Append to every NEW prompt (global suffix):**
> photoreal 35mm film still in motion, 1994 American shopping mall, dirty green-teal and amber color grade, film grain, practical lighting, shallow depth of field, no text, no logos, no watermark, no cartoon, no comic inking, no halftone

## Locked wardrobe / prompt strings
Paste these **verbatim** into every prompt where the character appears. Do not paraphrase. They match `13x-work/shot3-survivors-hero-v2.mp4`. Reference stills: `13x-work/frames/shot3-v2/t02.png`, `t04.png`, `t07.png`.

- **BIKER:** `burly white man, late 30s, short beard, red knit beanie, tan canvas work jacket, dirty jeans with a rip at the knee, scuffed work boots, orange-and-white gas chainsaw`
- **MALL COP:** `stocky Hispanic man, early 40s, light-blue short-sleeve security shirt, navy trousers, black tie, dark peaked cap with a badge, leather duty belt, wooden-stock pump shotgun`
- **MALL GOTH:** `pale woman, early 20s, long straight black hair, dark lipstick, small purple pointed hat, black sleeveless top, short purple tulle tutu, black knee-high boots, hairspray-can torch, silver 1980s boombox`
- **SKATER:** `lanky teenage boy, pink skate helmet, mint-green tank top, dark blue shorts, striped socks, white-and-pink sneakers (normal size), wooden bat studded with nails`

Supporting (not locked, but keep consistent): **DALE** is a big man in a white short-sleeve butcher shirt and apron wearing a full pink pig-chef mask (match frames from `14x-work/c.mp4`). **SHOPPERS** are ordinary 1994 suburban adults in rain jackets and sweatshirts, pale but alive.

---

## Shot list

Timecodes are film time in seconds. "In/out" is the source trim. Captions use the speaker name in that character's color. Every caption is 70 characters or fewer.

| # | TC | Source | Shot | Card | Caption (speaker: line) | SFX / music | s |
|---|---|---|---|---|---|---|---|
| 1 | 0.0-3.0 | CARD (existing title, no footage) | Black with projector grain. The studio card fades in and out with a slight bulb flicker. This sets the tone: this is a film. | **kungFuDOOM presents** | none | Projector whir; distant rain fades in under it | 3.0 |
| 2 | 3.0-8.0 | REUSE `14x-work/a.mp4` in 1.5 / out 6.5 | Rainy exterior at night. Shoppers are lined up under the canopy against the glass, and lightning shows how long the line is. The audience learns where and when this is, that these people are waiting for a doorbuster, and that the doors are supposed to stay shut. | **BRIGHTWATER COMMONS** / **BLACK FRIDAY, 1994 - 4:02 AM** | PAM: "Good morning, early shoppers. Doors open at six." | PA chime (soft, warm); rain on glass; low synth pad enters | 5.0 |
| 3 | 8.0-14.0 | REUSE `14x-work/c.mp4` in 1.0 / out 7.0 | Dale, in the Chef Porko pig mask, slides a tray of fried samples across the counter under heat lamps. A light-blue short sleeve reaches in and takes one, then a second. The audience understands that a friendly butcher is giving away free food, the man in light blue took two, and it matters. | **DALE BRISKET** / **PORKO'S CARVERY** | DALE: "Free samples! Officer discount. On the house." | Fryer sizzle; heat-lamp hum; one low synth note under the second grab | 6.0 |
| 4 | 14.0-19.0 | **NEW-1** | Medium tracking shot walking backward ahead of the MALL COP on patrol down a dim storefront corridor, shotgun slung on its strap. He eats the second sample whole and wipes his fingers on his trousers. He checks his wristwatch, then glances up at a ceiling PA speaker as he passes under it. The audience meets a decent, procedural man who just ate something they've been primed to distrust. | **MALL COP - RANGED** / **Eleven years. Zero arrests. Two samples.** | MALL COP: "For the record, that's community relations." | Footsteps on tile; radio squelch; PA speaker gives a faint electrical breath as he passes | 5.0 |
| 5 | 19.0-24.0 | **NEW-2** | Slow push-in on the MALL GOTH behind a closed perfume counter, prepping for the opening shift, boombox on the glass. She stops, turns to a wall vent grate and sniffs. The grate's dust ribbons are pulled in, then pushed out, in a slow rhythm like breathing. She tapes a handwritten form over the grate without looking impressed. The audience learns she has noticed something wrong before and nobody listened. | **MALL GOTH - AOE** / **Perfume counter. Three complaints. Zero read.** | MALL GOTH: "The vents are breathing again. Complaint number four." | Air-handler drone with a slow inhale/exhale swell; tape tear | 5.0 |
| 6 | 24.0-29.0 | **NEW-3** | Handheld in a concrete service tunnel lit by caged amber bulbs. The SKATER, bat strapped to his backpack, holds up a 1990s camcorder with its small red record light on. A floor grate ahead exhales steam in slow pulses with a faint orange glow below, and the pipes tick. He backs away still filming, then ducks through a service door into the mall. The audience learns he has proof of something alive under the mall. | **SKATER - SPEED** / **Banned three times. Knows the tunnels.** | SKATER: "Dude. The tunnel's breathing. I'm getting this on tape." | Steam exhale on a slow 4-count; camcorder motor whine; pipe ticks | 5.0 |
| 7 | 29.0-34.0 | **NEW-4** | Rain-slick rear loading dock under one sodium light. The BIKER has stepped out of the line to smoke under the dock awning, chainsaw at his feet. His gaze drops to a stack of empty steel drums by the dumpster, each with a stenciled smiling oil drop. Slow push-in on his face as he stops mid-drag, then flicks the cigarette into a puddle. He says nothing more. The audience reads guilt and recognition without a confession. | **BIKER - TANK** / **First in line. Been to this dock before.** | BIKER: "...Huh. Seen those before." | Rain on sheet metal; cigarette hiss in the puddle; one low synth bend | 5.0 |
| 8 | 34.0-39.0 | REUSE `14x-work/b.mp4` in 0.0 / out 5.0 | Crane down from a PA speaker into the empty two-level atrium: checkerboard, fountain, palms. Time jump. The audience understands that the mall itself is about to speak. | **4:59 AM** | PAM: "Good morning, Brightwater Commons! It's four-fifty-nine." | **The three-note chime, full and clean.** The pad drops out under it | 5.0 |
| 9 | 39.0-43.0 | **NEW-5** | Same corridor as NEW-1. The MALL COP freezes mid-stride under the PA speaker. His face goes slack and calm, and a faint fryer-orange glint catches both eyes. Two crumpled paper sample cups fall from his hand. He turns smoothly and walks away down a side hall toward a plain steel door, unhurried. The audience understands that the chime switched him on, and that the samples did it. | none | none | Silence except the chime's tail ringing and his steady footsteps | 4.0 |
| 10 | 43.0-47.0 | REUSE `14x-work/e.mp4` in 1.0 / out 5.0 | A uniformed hand swipes a keycard. The LED goes red to green, and banks of CRT monitors show the crowd at every entrance. We never see a face, but it follows directly from shot 9. | none | PAM: "Thank you, Officer." | Card swipe; heavy lock *clunk* repeated down the building; monitor hum | 4.0 |
| 11 | 47.0-51.5 | **NEW-6** | Outside, under the entrance canopy in the rain. A horn PA speaker is mounted above the doors. The chime plays again, and every waiting shopper's head turns up to the speaker **at the same instant**. Some are holding empty paper sample cups. Then, together, they turn back to the glass, eyes catching amber, and lean in. The audience understands that the chime controls anyone who ate the samples, and now the doors are unlocked. | none | PAM: "Shoppers who sampled, please remain loyal." | Chime (through the outdoor horn, slightly distorted); rain; a crowd breath in unison | 4.5 |
| 12 | 51.5-55.0 | REUSE `14x-work/d.mp4` in 4.5 / out 8.0 (avoids the garbled neon in 0-4 s) | Low dolly down an inside corridor toward the far glass doors, now crowded with silhouettes, mist on the checkerboard. Dread before the hit. | none | none | Heartbeat sub-bass building; glass creak | 3.5 |
| 13 | 55.0-59.0 | REUSE `13x-work/shot2-doors-shatter.mp4` in 0.6 / out 4.6 (cut before anyone trips) | Horde at the glass, lightning, and the doors burst inward. This is the scare. | none | none | Half-second total silence before the burst, then a glass explosion and horde roar | 4.0 |
| 14 | 59.0-62.5 | REUSE `14x-work/f.mp4` in 0.5 / out 4.0 | The horde floods the atrium, everyone on their feet, past the fountain and palms. Then the snap: Pam stays perfectly polite. | none | PAM: "No running, please. You'll only work up an appetite." | Horde roar under; music hit; chime tail | 3.5 |
| 15 | 62.5-67.0 | **NEW-7** | Corridor near the perfume counter, chaos in the background. The SKATER bursts out of the service door backward, swinging his bat, and a walker grabs at his backpack. A whoosh of flame: the MALL GOTH torches the walker off him with her hairspray torch, boombox in her other hand. A half-second look between them, then she jerks her head *this way*. The audience sees the first two survivors meet, and one saves the other. | none | SKATER: "Dude, I told everybody! I have it on tape!" | Flame whoomp; bat crack; the Skater's panicked breathing | 4.5 |
| 16 | 67.0-71.0 | **NEW-8** | Wider, same corridor. Three walkers close in on the pair from a side hall. A chainsaw roars and the BIKER shoulders through a fire door and cuts down the lead walker. He points the bar down the corridor toward the food court, and the three move off together. The audience sees him take charge and make them a group. | none | BIKER: "Kid. Spooky. On me. Move." | Chainsaw rev and bite; fire door bang | 4.0 |
| 17 | 71.0-76.0 | **NEW-9** | Side hall outside a plain steel door. The MALL COP blinks awake, alone, shotgun in his hands. He looks at his wristwatch, confused. The other three round the corner at a run. A walker lunges behind them, and the Cop racks and fires past them in one practiced motion. The Biker gives him a nod. The audience sees the Cop rejoin as a hero while we know what he did and he doesn't. | none | MALL COP: "Huh. My watch says I lost eight minutes." / BIKER: "Later, Badge. Load up." | Shotgun rack and blast; ringing ears; watch tick | 5.0 |
| 18 | 76.0-80.0 | REUSE `13x-work/shot3-survivors-hero-v2.mp4` in 0.5 / out 4.5 | Low dolly across the four, now standing together in formation: Biker, Cop, Goth, Skater. It is earned because we just watched them meet. | none | MALL COP: "Per Section Nine, nobody gets eaten in my mall." | Chainsaw idle, torch flare; synth theme swells | 4.0 |
| 19 | 80.0-86.0 | REUSE `14x-work/g.mp4` in 4.0 / out 0.0 **(reversed)** | The camera rises and settles into a locked high three-quarter overhead gameplay angle on the teal-and-cream checkerboard food court: the four back-to-back in the center, the horde closing from every side. Hold on the locked frame for the last 1.0 s, then **hard cut** to the low-poly game. | **5:07 AM** (lower left, first 2 s) | PAM: "Attention shoppers. The mall is now open. Forever." | Chime; theme peaks; **hard cut to silence** on the final frame | 6.0 |

**Total: 86.0 s.** 19 shots: 1 title card + 9 reuse + 9 NEW.

---

## Production notes: NEW generations (budget: 12)

Use image-to-video with a still for each survivor. Crop the character from `13x-work/frames/shot3-v2/t02.png`, `t04.png` or `t07.png` and use it as the first-frame reference, or as identity reference where the model supports one. For Dale continuity, pull a frame from `14x-work/c.mp4`. Generate 8 s and trim to the listed length. Paste the locked wardrobe string and the global suffix every time.

### Must-have (9)
These carry the cause and effect. If any one is missing, the story breaks.

| Priority | ID | Shot # | Why it's essential | Prompt core (add wardrobe string + global suffix) |
|---|---|---|---|---|
| 1 | NEW-5 | 9 | The chime switching the Cop on is the hinge of the film | MALL COP walking in a dim mall corridor under a ceiling PA speaker, stops mid-stride, face goes slack and calm, faint orange glint in both eyes, two crumpled paper sample cups drop from his hand, he turns and walks away calmly toward a plain steel door, medium shot, locked camera |
| 2 | NEW-6 | 11 | Shows that the chime controls everyone who sampled | night, rain, crowd of ordinary 1994 shoppers in rain jackets under a mall entrance canopy, a horn loudspeaker above glass doors, all heads turn up toward the speaker at the exact same moment, some hold small empty paper cups, then all turn back and lean toward the glass, eyes catching amber light, wide shot, slow push-in |
| 3 | NEW-1 | 4 | Establishes the Cop as a person and puts the samples in his stomach | MALL COP on night patrol, shotgun slung on a strap, eating a small fried sample from a paper cup, wipes fingers on trousers, checks wristwatch, glances up at a ceiling PA speaker as he walks under it, camera tracks backward ahead of him, closed storefront grilles, teal-and-cream checkerboard floor |
| 4 | NEW-7 | 15 | First meeting (Goth saves Skater) | SKATER backing out of a service door swinging his bat at a zombie grabbing his backpack; MALL GOTH steps in and blasts the zombie with a hairspray-can flame torch, holding a boombox, the two exchange a quick look, mall corridor, chaos and haze behind, handheld medium shot |
| 5 | NEW-8 | 16 | The Biker joins and makes them a group | BIKER bursts through a fire door revving a chainsaw and cuts down a lunging zombie in a mall corridor, then points the chainsaw down the hall; SKATER and MALL GOTH run with him, wide handheld shot |
| 6 | NEW-9 | 17 | The Cop rejoins, the "lost eight minutes" hint, and the four are complete | MALL COP blinks awake alone outside a plain steel door, looks at his wristwatch confused; BIKER, MALL GOTH and SKATER run around the corner toward him; a zombie lunges behind them and he racks the pump shotgun and fires past them, muzzle flash, medium-wide shot |
| 7 | NEW-4 | 7 | The Biker's intro and his drum secret | night, rain, rear loading dock under a single sodium light, BIKER smoking under the dock awning, chainsaw at his feet, looks down at a stack of empty steel drums by a dumpster stenciled with a simple smiling oil-drop face (no words), slow push-in on his face as he freezes mid-drag, flicks cigarette into a puddle |
| 8 | NEW-3 | 6 | The Skater's intro and his tape secret | concrete service tunnel lit by caged amber bulbs, SKATER with bat strapped to his backpack holds up a 1990s camcorder with small red record light, a floor grate ahead exhales steam in slow rhythmic pulses with faint orange glow beneath, he backs away still filming, handheld |
| 9 | NEW-2 | 5 | The Goth's intro and her vents secret | closed mall perfume counter at night, glass bottles, boombox on the counter, MALL GOTH sniffs toward a wall air vent grate, dust ribbons on the grate pulled in and pushed out slowly like breathing, she tapes a handwritten paper form over the grate, deadpan, slow push-in |

### Retry slot (1)
| Priority | ID | Shot # | Use |
|---|---|---|---|
| 10 | RETRY | any | Reserve it for whichever must-have fails identity or wardrobe lock, or has garbled text. Priority goes to NEW-5, then NEW-6, then NEW-9. |

### Nice if budget allows (2), only after all 9 must-haves and the retry are settled
| Priority | ID | Shot # | Use |
|---|---|---|---|
| 11 | NICE-A | replaces 1.0 s at the end of shot 6 | Camcorder viewfinder POV: grainy video-8 image of a huge dark vat surface **moving** in the dark, no on-screen text. Strengthens the Skater's secret. |
| 12 | NICE-B | replaces 1.5 s at the head of shot 8 | Close-up of a PA speaker grille throbbing with the chime as neon flickers in time. Gives Pam presence before the 4:59 card. If unused, shot 8's crane from `b.mp4` does the job. |

**Generation count:** 9 must-have + 1 retry + 2 nice = **12 maximum**. If NICE-A or NICE-B is used, trim the shot it replaces so the total stays at 86 s.

### Fallbacks (no generation needed)
- If NEW-6 fails twice, cut it. Instead hold `a.mp4` (out 6.5-8.0) with a hard push-in, and put Pam's "remain loyal" line over shot 12. This is weaker but keeps the story intact.
- If NEW-8 fails, shot 15 can run 1.5 s longer and shot 17's NEW-9 already brings all four together.
- **Never** fall back to showing the Cop's face at the keycard. The film hints at it and never confirms it.

### Edit notes
- Shot 19 is the cliffhanger. Its last 1.0 s must be a locked-off frame that matches the in-game hub camera (high three-quarter overhead), with no fade. Cut on the frame to the low-poly game.
- All sound is original ffmpeg synth: the chime is three sine tones (soft ding-dong-ding), plus drone, heartbeat, rain from filtered noise, and stings. Existing stems are in `13x-work/*.wav` and `14x-work/au-*.wav`. No licensed music or voice. The dialogue lives only in the captions below.
- The chime plays three times (shots 8, 11 and 19, with a tail in 9). Keep the same pitch every time so the audience learns it as a command.
- Drop the music to silence for 0.5 s before shot 13's burst.

---

## WebVTT cue list

Paste below a `WEBVTT` header. Speaker uses a `<v>` voice tag so the player can color it.

```
WEBVTT

00:00:03.300 --> 00:00:07.700
<v Pam>Good morning, early shoppers. Doors open at six.

00:00:08.600 --> 00:00:13.400
<v Dale>Free samples! Officer discount. On the house.

00:00:15.000 --> 00:00:18.700
<v Mall Cop>For the record, that's community relations.

00:00:19.800 --> 00:00:23.800
<v Mall Goth>The vents are breathing again. Complaint number four.

00:00:24.600 --> 00:00:28.800
<v Skater>Dude. The tunnel's breathing. I'm getting this on tape.

00:00:31.000 --> 00:00:33.800
<v Biker>...Huh. Seen those before.

00:00:35.600 --> 00:00:38.900
<v Pam>Good morning, Brightwater Commons! It's four-fifty-nine.

00:00:44.200 --> 00:00:46.900
<v Pam>Thank you, Officer.

00:00:48.200 --> 00:00:51.400
<v Pam>Shoppers who sampled, please remain loyal.

00:00:59.100 --> 00:01:02.400
<v Pam>No running, please. You'll only work up an appetite.

00:01:03.200 --> 00:01:06.900
<v Skater>Dude, I told everybody! I have it on tape!

00:01:07.200 --> 00:01:10.900
<v Biker>Kid. Spooky. On me. Move.

00:01:11.300 --> 00:01:13.600
<v Mall Cop>Huh. My watch says I lost eight minutes.

00:01:13.700 --> 00:01:15.900
<v Biker>Later, Badge. Load up.

00:01:16.300 --> 00:01:19.900
<v Mall Cop>Per Section Nine, nobody gets eaten in my mall.

00:01:20.800 --> 00:01:25.000
<v Pam>Attention shoppers. The mall is now open. Forever.
```

Cards (burned into the video, not VTT): 1 "kungFuDOOM presents"; 2 "BRIGHTWATER COMMONS / BLACK FRIDAY, 1994 - 4:02 AM"; 3 "DALE BRISKET / PORKO'S CARVERY"; 4-7 the survivor role cards in the shot list; 8 "4:59 AM"; 19 "5:07 AM".
