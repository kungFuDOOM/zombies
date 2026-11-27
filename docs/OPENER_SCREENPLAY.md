# OPENER SCREENPLAY: "Midnight Madness" (White Acre opener, rendered in the engine)

> **Official canon.** This is the White Acre opener for **Mall of the Dead**. It replaces the earlier "Doorbuster" film, which is not canon. Story source: [STORY.md](../STORY.md).
>
> **How it ships:** rendered live in the engine by `src/intro.js` (sets in `src/cineOpenerSets.js`, synthesized audio in `src/cineAudio.js`). There is no video or image file. The in-engine cut runs 83 s: its time codes are the table's minus 3 s, with a 3 s studio card first. The shot list, captions and cards below are the script it follows, adapted to what the engine can render (simple shopper figures for crowds; Vern is not in shot 4). The sections after the shot list about video generation prompts, encoding and stitching are kept only as the visual brief and are not used.

**Title:** MALL OF THE DEAD, opener film "Midnight Madness"
**Logline:** Bakersfield, Black Friday 1994. At 11:58 a calm voice on the PA reads four routine pages at Paragon Crossing. At 12:01 the air system breathes out, and four thousand shoppers hit the floor. Four people stay standing: a guard behind a door he locked himself, a biker out at the dock, a photo clerk who put on a respirator for no reason, and a kid who coughs, falls, and gets back up. The TV says it was a refinery leak. A voice on the radio says help is coming. Neither is true.
**Runtime target:** 86 s (hard limits 60 to 90 s). 16 shots: 2 cards and 14 new generations. No reused story footage.
**Story source:** STORY.md sections 1, 3 (timeline items 9 and 10), 4 (Wing 1: the 11:58 pages, the clues, the fake news, the phone call) and 7 (the cover-up layers). This film adds no new lore.

### Shape (beginning, middle, end)
1. **Before: 11:58 PM (shots 1-8).** Highway 99, fog, pumpjacks. Paragon Crossing is packed for Midnight Madness while a white truck crew carries canisters up to the roof. Inside, the PA reads four bland pages. Each one lands on one survivor: the Cop confirms the east doors and locks his own office, the Biker gets a pager call to Dock B, the Skater looks up when he hears "Champ," and the Goth hears her own order number and pulls a respirator out from under the counter. The audience isn't told why. They just see four people react when nobody else does.
2. **Turn: 12:01 AM (shots 9-11).** The doorbuster clock hits zero, the ceiling vents breathe, and the crowd drops in one silent wave. Hard to black: **MALL OF THE DEAD**.
3. **After: 12:04 to 12:09 AM (shots 12-16).** The Skater coughs, falls, and stands up alone among his friends. On the Cop's monitors, a newscaster reads a refinery-leak story, and the Cop does the math. He calls the number from his wallet, and a calm dispatcher tells him to hold position. Outside, white trucks and a yellow helicopter arrive on the 99 with no sirens. On the floor, a hand twitches. In the Security Room the four are together, nobody knows why, and the PA asks everyone to stay where they are. The frame locks on the high three-quarter view and hard-cuts to gameplay.

### Tone checks
- **Scare, then snap.** Every dread beat gets a short, dry human line after it: the drop, then "Guys? ...Guys. Get up."; the fake news, then "Refinery's nine miles off."; the rising hand, then "Ask later, dock rat."
- **Nobody winks.** No looks to camera and no genre jokes. Everyone is scared, tired and working-class serious.
- **The PA is never sinister on purpose.** It's one calm, bored male voice (Garrity, uncredited, tagged only "PA"). It should sound like any mall at midnight, and the pages should come across as wallpaper. The audience shouldn't be able to tell they matter until the roof.
- **Hints only, no confessions.** The Cop confirms the doors and locks his own office, the Biker takes a cash job, the Skater reacts to "Champ," and the Goth has a respirator ready. Nobody explains anything. The words "HUSH," "WHITE ACRE," "OSCS," "Ashby" and "Garrity" never appear on screen.
- **Not sentimental.** The Skater's friends get one line and no slow-motion grief.

---

## Look (all new generations)
Photoreal 1990s zombie horror shot like a mid-budget 1994 studio thriller. **Bakersfield in late November at midnight**: cold, damp, low tule fog in the fields, sodium-orange street light, oil-field work lights, gas flares, pumpjacks nodding in black silhouette, Highway 99 traffic. The mall itself is clean, bright and overcrowded: teal-and-cream checkerboard floor, brass rails, potted palms, pink and amber neon, Midnight Madness banners. It is not a ruin. The grade has dirty green-teal shadows and amber practicals, with 35 mm grain and slight halation on neon. Shoot 16:9 and frame for a **2.39:1 center extraction** (heads and key props inside the middle 75% of the height), because the letterbox is added in the encode. No comic inking, halftone or cel shading. No real-person likeness. No readable text or real brand logos in frame: signs are soft-focus neon shapes or blank, and all names and times are **cards we add in the encode**.

**Invented names that may appear (as encode cards or captions only, never generated text):** Paragon Crossing, Action News 17, Kern Valley Vector Control. Vehicles and props stay **unmarked**: plain white trucks, a plain yellow helicopter, blank stickers.

**Global suffix (append to every NEW prompt, verbatim):**
> photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone

## Locked wardrobe / prompt strings
Paste these **verbatim** into every prompt where the character appears. Do not paraphrase them.

- **BIKER:** `burly white man, late 30s, short beard, red knit beanie, tan canvas work jacket, dirty jeans with a rip at the knee, scuffed work boots, orange-and-white gas chainsaw`
- **MALL COP:** `stocky Hispanic man, early 40s, light-blue short-sleeve security shirt, navy trousers, black tie, dark peaked cap with a badge, leather duty belt, wooden-stock pump shotgun`
- **MALL GOTH:** `pale woman, early 20s, long straight black hair, dark lipstick, small purple pointed hat, black sleeveless top, short purple tulle tutu, black knee-high boots, hairspray-can torch, silver 1980s boombox`
- **SKATER:** `lanky teenage boy, pink skate helmet, mint-green tank top, dark blue shorts, striped socks, white-and-pink sneakers (normal size), wooden bat studded with nails`

**Identity references:** for image-to-video, crop each survivor from `/workspace/motd-shots/13x-work/frames/shot3-v2/t02.png`, `t04.png` or `t07.png` and use the crop as the first-frame or identity reference. Use only the character crops. Don't reuse those clips as story footage.

**Supporting (not locked, keep consistent):**
- **VERN TOLLER** (background only, shot 4): a big man in white butcher whites and apron wearing the full pink pig-chef promo head, behind a carvery counter. A rubber gas mask hangs on a hook behind him. He is **not** Dale Brisket. He hands out nothing and has no line.
- **SHOPPERS:** ordinary 1994 Central Valley adults and teens in flannel, Raiders and Kings starter-style jackets with no logos, sweatshirts, and work boots. They're tired, excited and alive.
- **THE SKATER'S FRIENDS:** three teen boys around 15, in hoodies and baggy jeans, one with a skateboard.
- **CLEANUP CREW:** gray coveralls, full-face respirators, no insignia. Rifles stay slung; nobody fires in this film.
- **NEWSCASTER:** a generic 1990s local anchor at a desk, seen only on a CRT and soft enough that no face is readable.

---

## Shot list

Timecodes are film time in seconds. Captions use the speaker name in that character's color (PA, Radio and Action News 17 are amber). Every caption is 70 characters or fewer. **CARD** means a black frame or an overlay we add in the encode. **NEW** means a fresh generation.

| # | TC | Source | Shot (what we see / what the audience learns) | Card (encode) | Caption (speaker: line) | SFX / music | s |
|---|---|---|---|---|---|---|---|
| 1 | 0.0-3.0 | CARD | Black with projector grain. The studio card fades in and out with a slight bulb flicker. | **kungFuDOOM presents** | none | Projector whir. A far-off pumpjack creak fades in. A low drone enters. | 3.0 |
| 2 | 3.0-9.0 | **NEW-01** | Aerial drift at night over a Kern County oil field. Pumpjacks nod in black silhouette, a gas flare burns, and low tule fog lies in the furrows. Highway 99 cuts through with truck headlights, and on the far side a big lit mall glows under its own sodium lights. *The audience learns where: a tired oil town nobody looks at.* | **BAKERSFIELD, CALIFORNIA** / **THANKSGIVING NIGHT, 1994** | none | Pumpjack creak in slow 2-beat (original synth). Wind. Distant semi on the 99. | 6.0 |
| 3 | 9.0-15.0 | **NEW-02** | Mall parking lot at ground level. Hundreds of shoppers crowd the glowing entrance under blank Midnight Madness banners, and breath steams in the cold. Slow pan right to the dark side of the building: a plain white utility truck by a roof ladder, and two men in gray coveralls passing metal canisters up to the roof. Nobody in the line looks over. *Something is being installed, and it's in plain sight.* | **PARAGON CROSSING** / **BLACK FRIDAY · 11:58 PM** | none | Crowd murmur through glass. A metal canister clinks on a ladder rung. Drone thickens. | 6.0 |
| 4 | 15.0-20.0 | **NEW-03** | Interior. Crane down from a ceiling PA speaker grille into the packed two-level food court: teal-and-cream checkerboard, neon, a big red LED doorbuster clock (blank segments) over the crowd. Background left: VERN in his pig-chef promo head behind the carvery counter, with a gas mask on a hook behind him. *The PA is the mall's voice. Ordinary.* | none | PA: "Security, please confirm the east doors." | **PA ding** (soft two-tone, same pitch all film). Crowd walla. Fryer hiss. | 5.0 |
| 5 | 20.0-26.5 | **NEW-04** | Small security office lit by a wall of CRT monitors that show the crowd. The MALL COP keys his shoulder radio and answers. Then he crosses to his own steel office door, swings it shut, and turns the deadbolt. Behind him a brand-new boxy air unit in the wall hums, with a small blank sticker on its housing. He settles back toward the monitors. *He locks things when he's told. Remember the air unit.* | **MALL COP · RANGED** / **Night security lead. Does it by the book.** | MALL COP: "East doors. Confirmed." | Radio squelch. A heavy deadbolt clack. A new machine hum (a slightly different pitch from the mall's air handlers). | 6.5 |
| 6 | 26.5-32.0 | **NEW-05** | Exterior, rear loading dock under one sodium light. Fog hangs past the fence, with pumpjack silhouettes beyond. The BIKER sits on the dock edge, chainsaw beside him, reading a 1990s pager. He looks up as a box truck backs toward the dock, reverse lights washing over him. He doesn't go inside. *He's here for a job and doesn't ask what it is.* | **BIKER · TANK** / **Hauls what he's paid to. Never asks.** | PA (faint, through a dock door): "Driver for Kern Valley, please pull to Dock B." / BIKER: "Midnight pickup. Cash. Don't ask." | PA ding (muffled). Pager chirp. Truck backup beeper. Diesel idle. | 5.5 |
| 7 | 32.0-37.5 | **NEW-06** | Mall center fountain, coins glinting, crowd all around. The SKATER and three friends mess around on the fountain lip. He stops mid-laugh and looks straight up at the ceiling speaker when the page plays, then glances around the crowd as if someone might be watching him. His friends don't notice. *The page means something to him alone.* | **SKATER · SPEED** / **Banned from this fountain. Here anyway.** | PA: "Paging Champ. Your party is at the fountain." / SKATER: "...Who still says 'champ'?" | PA ding. Fountain splash. Teen laughter that stops short. | 5.5 |
| 8 | 37.5-44.0 | **NEW-07** | A one-hour photo kiosk in the mall concourse: envelopes, a print machine, red safelight glow inside. The MALL GOTH is filing photo envelopes, boombox on the counter. The page plays. She stops, looks down at the envelope in her hand, then up toward the atrium. Without hurrying, she pulls a black rubber half-face respirator from under the counter and straps it on. *She knew something was coming, and the audience doesn't know how.* | **MALL GOTH · AOE** / **One-hour photo. Sees everything twice.** | PA: "Photo order 1854, please come to Guest Services." / MALL GOTH: "Nobody picks up a photo order at midnight." | PA ding. Print-machine whir. Respirator strap snap. Her breathing goes muffled and close. | 6.5 |
| 9 | 44.0-48.5 | **NEW-08** | Low angle on the packed crowd as the red LED clock flashes and the crowd cheers, arms up. Tilt up past the banners to the square ceiling diffusers: a faint pale haze breathes out of every vent, and the banners ripple in the downdraft. Nobody looks up. | **12:01 AM** | none | Crowd countdown roar at its peak. Under it, a long soft **exhale** from every vent. The drone drops a half-step. | 4.5 |
| 10 | 48.5-53.5 | **NEW-09** | Wide high angle over the food court and atrium. The whole crowd folds to the floor in one slow wave, outward from the vents: bags spill, a soda tips, a balloon floats free. No screams. Then stillness: thousands of bodies on the checkerboard while the neon keeps buzzing. **This is the scare.** | none | none | The crowd roar **cuts to silence** in under a second. Bags and bodies thud. Neon buzz. One sub-bass hit. | 5.0 |
| 11 | 53.5-56.0 | CARD | Black. The title fades up hard with a short bulb flicker. | **MALL OF THE DEAD** | none | Silence, then one low sustained synth note. | 2.5 |
| 12 | 56.0-61.5 | **NEW-10** | At the fountain in drifting haze. The SKATER's three friends are down around him. He coughs hard, drops to his knees, hand on the fountain lip, and falls onto his side. A beat. Then he pushes himself up and stands, swaying, the only one on his feet in a sea of bodies. He looks at his own hands. | **12:04 AM** | SKATER: "Guys? ...Guys. Get up." | His cough, very close. Fountain water. Neon buzz. A faint heartbeat starts. | 5.5 |
| 13 | 61.5-67.5 | **NEW-11** | Back in the sealed security office. Monitors show still bodies on every floor. One small CRT on the desk shows a local news anchor at a desk (soft, no readable graphics). The MALL COP stares at it, then at the humming air unit behind him, then at the deadbolt. His hand drifts toward the lock and stops. | **ACTION NEWS 17** (lower third added in the encode over the CRT) | ACTION NEWS 17: "A refinery leak. Stay indoors. Keep windows shut." / MALL COP: "Refinery's nine miles off. They knew in three minutes?" | TV audio, tinny and wordless (synth murmur). Air unit hum. Heartbeat. | 6.0 |
| 14 | 67.5-73.5 | **NEW-12** | Exterior, Highway 99 at the mall exit, in fog. A convoy of plain white trucks rolls off the freeway with amber beacons and no sirens. Men in gray coveralls and full-face respirators step down, rifles slung, and start unrolling tape. A plain yellow crop-dusting helicopter passes low overhead, its spotlight sweeping the lot and the pumpjacks. *The cleanup was ready before anyone called.* | none | RADIO: "Vector Control base. How many survivors, Officer?" / MALL COP: "Four." / RADIO: "Hold position. Help is coming." | Radio filter on all dialogue. Helicopter rotor thump. Truck doors. Tape squeal. No sirens. | 6.0 |
| 15 | 73.5-77.0 | **NEW-13** | Floor-level close-up on the checkerboard among the bodies. A shopper's hand lies by a spilled shopping bag. The fingers twitch, then clench. Rack focus to a face just behind it: the eyes snap open, cloudy and wrong. | none | none | Heartbeat stops. Silence, then a wet intake of breath and a knuckle crack. A sting. | 3.5 |
| 16 | 77.0-86.0 | **NEW-14** | The Security Room. All four are together inside: the COP by the monitor wall with his shotgun, the BIKER revving his chainsaw once at the door, the GOTH pulling her respirator down to her neck, the SKATER with his bat. On the monitors, figures are getting up. The camera cranes up and back and **settles into a locked high three-quarter overhead view** that matches the in-game Security Room camera, with the four in the center of the lavender-and-gray checkerboard. Hold the locked frame for the last 1.5 s, then **hard cut** to the low-poly game. | **12:09 AM** (lower left, first 2 s) | SKATER: "Four thousand dropped. Why are we four still standing?" / BIKER: "Ask later, dock rat." / PA: "Shoppers, please remain where you are. Help is on the way." | Chainsaw rev and idle. Monitor hum. **PA ding** before the last line. Drone swells, then a **hard cut to silence** on the final frame. | 9.0 |

**Total: 86.0 s.** 16 shots: 2 cards and 14 NEW.

### What each survivor's moment hints (and keeps back)
| Survivor | Hint on screen | Withheld for the game |
|---|---|---|
| Mall Cop | Confirms "east doors," locks his own office, has a new sealed air unit, calls a number and is told to hold | The federal card, the work order, the $2,000, October, naming the Goth |
| Biker | Outside at Dock B on a pager cash job; calls the Skater "dock rat" | The October drums, the knock, Lease 99, the 1977 flagman job |
| Mall Goth | Hears "Photo order 1854" and puts on a respirator she already had | The negatives, the tip-line call, the 12:30 meeting, that she was the target |
| Skater | Reacts to "Champ," then coughs, falls and stands up | Lerdo Flats, the health study, Ashby, the $100, why his friends were there |

---

## Production notes: NEW generations (budget: 16)

Generate every clip 16:9 at 720p and trim to the listed length. For each clip with a survivor, use image-to-video with the identity crop listed above. Paste the locked wardrobe string and the global suffix every time. The full prompts are in the generation queue at the bottom.

### Priority
| Priority | ID | Shot # | Why it's essential |
|---|---|---|---|
| 1 | NEW-09 | 10 | The drop is the film's one big image |
| 2 | NEW-10 | 12 | The Skater gets back up: the clearest "why us" beat |
| 3 | NEW-07 | 8 | The Goth's respirator, before 12:01 |
| 4 | NEW-04 | 5 | The Cop's door lock and air unit, kept to hints |
| 5 | NEW-14 | 16 | All four together, and the locked frame for the hard cut |
| 6 | NEW-05 | 6 | The Biker at Dock B |
| 7 | NEW-06 | 7 | "Champ" lands on the Skater |
| 8 | NEW-08 | 9 | The vents breathe at 12:01 |
| 9 | NEW-11 | 13 | The fake news and the Cop doing the math |
| 10 | NEW-12 | 14 | The cover-up arrives (trucks, crew, helicopter) |
| 11 | NEW-03 | 4 | The PA establishing shot and the Vern plant |
| 12 | NEW-02 | 3 | The roof crew at 11:58 |
| 13 | NEW-01 | 2 | Bakersfield establishing shot |
| 14 | NEW-13 | 15 | The twitch and the eyes |
| 15-16 | RETRY x2 | any | For a failed identity or wardrobe lock, garbled text, or a camera that won't settle. Order of priority: NEW-14, NEW-10, NEW-07. |

### Fallbacks (no extra generation)
- **NEW-01 fails:** open shot 2 on the first 2 s of NEW-02 (the parking lot) and stretch shot 3 to 8 s. Both cards still fit.
- **NEW-13 fails:** cut it and give its 3.5 s to shot 16 (12.5 s, generate 15 s). The rising figures on the monitors carry the beat.
- **NEW-12 fails:** play the three radio captions over the end of shot 13 and the start of shot 16, plus 2 s of the helicopter spotlight sweeping the security-office blinds (the tail of NEW-11, if usable).
- **NEW-14 won't settle into a locked frame:** freeze its best final frame for 1.5 s. A held still counts as locked-off. Never fade or dissolve into gameplay.
- **Generic reuse (last resort only):** a horde-in-atrium clip from `/workspace/motd-shots/14x-work/f.mp4` can sit behind monitor glass in shot 16, but only if it shows no Pam, Dale, Brightwater signage or daylight. Never reuse the old Cop/keycard, sample, chime or doors-burst story clips.
- **Never** show the Cop explaining the doors, a readable federal card, Ashby, Garrity's face, or the words HUSH or WHITE ACRE.

---

## WebVTT cue list

Paste below the header. The speaker uses a `<v>` voice tag so the player can color it (`PA`, `Radio` and `Action News 17` use the PA amber).

```
WEBVTT

00:00:15.600 --> 00:00:19.600
<v PA>Security, please confirm the east doors.

00:00:21.400 --> 00:00:23.600
<v Mall Cop>East doors. Confirmed.

00:00:26.800 --> 00:00:29.900
<v PA>Driver for Kern Valley, please pull to Dock B.

00:00:30.000 --> 00:00:31.900
<v Biker>Midnight pickup. Cash. Don't ask.

00:00:32.300 --> 00:00:35.300
<v PA>Paging Champ. Your party is at the fountain.

00:00:35.500 --> 00:00:37.300
<v Skater>...Who still says 'champ'?

00:00:37.800 --> 00:00:41.000
<v PA>Photo order 1854, please come to Guest Services.

00:00:41.200 --> 00:00:43.900
<v Mall Goth>Nobody picks up a photo order at midnight.

00:00:58.300 --> 00:01:01.300
<v Skater>Guys? ...Guys. Get up.

00:01:01.900 --> 00:01:04.500
<v Action News 17>A refinery leak. Stay indoors. Keep windows shut.

00:01:04.700 --> 00:01:07.400
<v Mall Cop>Refinery's nine miles off. They knew in three minutes?

00:01:07.800 --> 00:01:10.300
<v Radio>Vector Control base. How many survivors, Officer?

00:01:10.400 --> 00:01:11.200
<v Mall Cop>Four.

00:01:11.300 --> 00:01:13.400
<v Radio>Hold position. Help is coming.

00:01:17.800 --> 00:01:20.900
<v Skater>Four thousand dropped. Why are we four still standing?

00:01:21.100 --> 00:01:22.500
<v Biker>Ask later, dock rat.

00:01:22.700 --> 00:01:25.900
<v PA>Shoppers, please remain where you are. Help is on the way.
```

Every cue is 70 characters or fewer. The longest is 58 characters (the final PA line).

**Cards (burned into the video, not the VTT):** 1 "kungFuDOOM presents"; 2 "BAKERSFIELD, CALIFORNIA / THANKSGIVING NIGHT, 1994"; 3 "PARAGON CROSSING / BLACK FRIDAY · 11:58 PM"; 5-8 the four survivor role cards from the shot list; 9 "12:01 AM"; 11 "MALL OF THE DEAD"; 12 "12:04 AM"; 13 "ACTION NEWS 17" lower third over the CRT; 16 "12:09 AM". Use clean sans-serif or typewriter type, white or amber, inside the 2.39:1 safe area. Hold role cards 2.5 s at the lower left.

---

## Edit / stitch notes

- **Frame and letterbox:** the clips are 16:9 at 720p. Center-crop or matte to 2.39:1 inside a 1280x720 frame (black bars of about 92 px top and bottom), so the cards and captions sit inside the image. Output: `libx264`, `-pix_fmt yuv420p`, `-profile:v high`, `-movflags +faststart`, 24 fps, CRF 20-22, AAC 160k stereo. Files: `assets/film/opener-v3.mp4`, `opener-v3.vtt`, `opener-v3.jpg`.
- **Poster frame (`opener-v3.jpg`):** a frame from NEW-09 just after the drop, with bodies on the checkerboard under neon, letterboxed and with no card. It gives nothing away about the four.
- **Grade:** match all 14 clips to one LUT feel: green-teal shadows, amber highlights, lifted blacks, fine grain added in post (the same grain on every shot so the generator's grain differences disappear). Slight halation on neon.
- **Cuts:** hard cuts throughout. The only fade is the title cards' up-fades. **Shot 16 ends on a locked-off high three-quarter frame and hard-cuts to the low-poly Security Room hub camera** (the game's hub; `src/main.js` routes opener → Security Room). No fade, no dissolve, no hold on black.
- **Music (original synth only):** an ffmpeg-generated low drone (detuned sines with filtered noise) that moves a half-step down at 12:01. A rhythm built from a synthesized **pumpjack creak** (a filtered noise burst with a pitch bend, two beats per bar), carried from the first shot and pulled out at the drop. A heartbeat (sub sine thumps) through shots 12-14, which stops dead on shot 15. One stinger on shot 15. The drone swells under shot 16 and **cuts to silence** on the last frame. No melody hooks, no theme fanfare, and no three-note chime motif.
- **PA ding:** a soft two-tone (for example 784 Hz then 659 Hz, sine, short decay), the same every time: before each of the four pages, and once before the final "remain where you are." It's a plain mall ding, not a control signal. The PA voice itself is only captions. Any PA "voice" bed is a wordless, low-passed murmur under the ding.
- **SFX (original synth or existing original stems):** crowd walla and countdown roar, vent exhale, neon buzz, fryer hiss, canister clink, deadbolt clack, pager chirp, backup beeper, diesel idle, fountain, cough, rotor thump, tape squeal, body thuds. Reuse original stems from `/workspace/motd-shots/13x-work/*.wav` and `/workspace/motd-shots/14x-work/au-*.wav` where they fit (crowd, neon, rotor), and synthesize the rest. **No licensed music, voice, or library audio.**
- **Silence beats:** after the 12:01 roar, cut to silence in under a second (shot 10). Keep 0.5 s of near-silence before the shot 11 title. Hold full silence for 0.3 s before the wet breath in shot 15.
- **Captions:** the VTT drives the in-game captions (`src/movie.js` colors). Don't burn dialogue into the video. Burn in only the cards listed above.
- **Hookup (separate step, not part of this doc):** encode the three files, then point `FILM` in `src/movie.js` at `assets/film/opener-v3` and bump the service worker cache version.

---

## Generation queue

Run top to bottom in priority order (see the Priority table), or in shot order. All clips: **aspect 16:9, resolution 720p**. Each prompt below is complete. The wardrobe strings and global suffix are already pasted in.

| Shot ID | Film shot | Duration (gen) | Aspect | Res | Full prompt |
|---|---|---|---|---|---|
| NEW-01 | 2 | 8 s (trim 6.0) | 16:9 | 720p | Slow aerial drift at night over a Kern County California oil field, rows of oil pumpjacks nodding in black silhouette, one tall gas flare burning orange, low white tule fog lying in the furrows between them, a four-lane highway cutting across the frame with truck headlights and taillights moving, beyond the highway a large single-story 1990s shopping mall glowing under sodium parking-lot lights, cold damp air, camera drifts forward slowly and steadily, wide establishing shot, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-02 | 3 | 8 s (trim 6.0) | 16:9 | 720p | Night, a crowded 1990s mall parking lot, hundreds of ordinary working-class shoppers in flannel and plain team-style jackets packed outside brightly lit glass entrance doors under blank red promotional banners, breath steaming in the cold, camera at eye level slowly pans right along the building to its dark unlit side wall where a plain unmarked white utility truck is parked beside a steel roof ladder, two men in plain gray coveralls pass dull metal canisters hand to hand up the ladder to the flat roof, nobody in the crowd looks at them, sodium orange light, faint fog, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-03 | 4 | 6 s (trim 5.0) | 16:9 | 720p | Interior of a packed two-level 1994 American mall food court at midnight, camera starts tight on a round ceiling PA speaker grille and cranes smoothly down into a dense excited crowd of shoppers, teal-and-cream checkerboard floor, brass rails, potted palms, pink and amber neon shapes, a large red LED countdown clock with blank unlit segments hanging over the crowd, background left behind a carvery counter under heat lamps a big man in white butcher whites and apron wearing a full pink pig-chef mascot head, a rubber gas mask hanging on a wall hook behind him, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-04 | 5 | 8 s (trim 6.5) | 16:9 | 720p | Small windowless mall security office at night lit by a wall of glowing CRT monitors showing a crowd from above, a stocky Hispanic man, early 40s, light-blue short-sleeve security shirt, navy trousers, black tie, dark peaked cap with a badge, leather duty belt, wooden-stock pump shotgun leaning on the desk, he presses the button on his shoulder radio and speaks briefly, then walks to the heavy steel office door, swings it shut and turns the deadbolt with a firm click, behind him a brand-new boxy metal air unit set into the wall hums with a small blank white sticker on its housing, he turns back toward the monitors, calm and procedural, medium shot, slow push-in, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-05 | 6 | 6 s (trim 5.5) | 16:9 | 720p | Night, the rear concrete loading dock of a shopping mall under a single sodium light, fog drifting past a chain-link fence with oil pumpjack silhouettes nodding beyond it, a burly white man, late 30s, short beard, red knit beanie, tan canvas work jacket, dirty jeans with a rip at the knee, scuffed work boots, orange-and-white gas chainsaw resting beside him, he sits on the dock edge reading a small 1990s belt pager, then looks up as a plain box truck backs toward the dock, its white reverse lights washing across his face, he stays put, unreadable expression, medium shot, locked camera with slight drift, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-06 | 7 | 6 s (trim 5.5) | 16:9 | 720p | Interior 1994 mall atrium at midnight, a round tiled fountain with coins glinting under the water, crowd of shoppers all around, a lanky teenage boy, pink skate helmet, mint-green tank top, dark blue shorts, striped socks, white-and-pink sneakers (normal size), wooden bat studded with nails tucked under his arm, laughing with three teenage friends in hoodies and baggy jeans on the fountain ledge, one holds a skateboard, he suddenly stops laughing and looks straight up at a ceiling speaker, then glances around the crowd uneasily as if being watched, his friends keep joking and do not notice, teal-and-cream checkerboard floor, pink and amber neon, medium shot, gentle handheld, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-07 | 8 | 8 s (trim 6.5) | 16:9 | 720p | A small one-hour photo kiosk in a 1994 mall concourse at night, racks of blank paper photo envelopes, a boxy print machine, dim red safelight glow inside, a silver 1980s boombox on the counter, a pale woman, early 20s, long straight black hair, dark lipstick, small purple pointed hat, black sleeveless top, short purple tulle tutu, black knee-high boots, a hairspray-can torch on the shelf behind her, she is filing photo envelopes, freezes and looks down at one envelope in her hand, then up toward the crowded atrium, then without hurrying pulls a black rubber half-face respirator from under the counter and straps it over her mouth and nose, cool and deliberate, slow push-in, medium close-up, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-08 | 9 | 6 s (trim 4.5) | 16:9 | 720p | Low angle inside a packed 1994 mall food court at midnight, a large red LED countdown clock with blank segments flashes, the crowd cheers with arms raised, camera tilts up past hanging blank red promotional banners to square metal ceiling air diffusers, a faint pale translucent haze breathes slowly out of every vent and drifts down over the crowd, the banners ripple in the downdraft, no one looks up, pink and amber neon, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-09 | 10 | 6 s (trim 5.0) | 16:9 | 720p | Wide high-angle shot over a huge crowded two-level 1994 mall food court and atrium in faint pale haze, the entire crowd of shoppers folds slowly and silently to the floor in one wave spreading outward, shopping bags spill, a soda cup tips over, a single balloon floats up free, then complete stillness, thousands of people lying motionless on the teal-and-cream checkerboard floor among potted palms and brass rails while pink and amber neon keeps glowing, no blood, eerie and quiet, locked camera, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-10 | 12 | 6 s (trim 5.5) | 16:9 | 720p | Beside a tiled mall fountain in drifting pale haze, three teenage boys in hoodies lie motionless on the checkerboard floor, a lanky teenage boy, pink skate helmet, mint-green tank top, dark blue shorts, striped socks, white-and-pink sneakers (normal size), wooden bat studded with nails, coughs hard, drops to his knees with one hand on the fountain ledge, falls onto his side, lies still for a beat, then pushes himself up and stands swaying, the only person standing among hundreds of still bodies, he stares at his own hands, medium-wide shot, slow push-in, pink and amber neon, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-11 | 13 | 8 s (trim 6.0) | 16:9 | 720p | Small windowless mall security office at night, a wall of CRT monitors showing motionless bodies on mall floors from above, one small CRT television on the desk shows a blurry 1990s local news anchor at a desk with soft unreadable graphics, a stocky Hispanic man, early 40s, light-blue short-sleeve security shirt, navy trousers, black tie, dark peaked cap with a badge, leather duty belt, wooden-stock pump shotgun in his hands, stares at the TV, then turns his head to a humming boxy metal air unit in the wall, then to the locked steel door, his hand drifts toward the deadbolt and stops, dread on his face, medium close-up, slow push-in, monitor glow, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-12 | 14 | 8 s (trim 6.0) | 16:9 | 720p | Night, fog over a highway off-ramp beside a mall parking lot, a convoy of plain unmarked white trucks with amber roof beacons rolls off the freeway with no sirens, men in plain gray coveralls and full-face respirators climb down with rifles slung on their backs and begin unrolling barrier tape across the lot entrance, a plain yellow crop-dusting helicopter passes low overhead, its spotlight sweeping across the parked cars and the nodding oil pumpjacks beyond, sodium orange light, wide shot, slow lateral track, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-13 | 15 | 5 s (trim 3.5) | 16:9 | 720p | Extreme low floor-level close-up on a teal-and-cream checkerboard mall floor among still bodies in faint haze, an ordinary shopper's limp hand lies beside a spilled shopping bag, the fingers twitch, then clench into a fist, rack focus to a pale face lying just behind it, the eyes snap open, cloudy and unfocused, horror, neon reflections on the tile, locked camera, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| NEW-14 | 16 | 10 s (trim 9.0) | 16:9 | 720p | Interior of a mall security room at night, lavender-and-gray checkerboard floor, a wall of CRT monitors showing figures slowly getting up from mall floors, purple-blue light, four survivors stand together in the center of the room: a stocky Hispanic man, early 40s, light-blue short-sleeve security shirt, navy trousers, black tie, dark peaked cap with a badge, leather duty belt, wooden-stock pump shotgun, by the monitors; a burly white man, late 30s, short beard, red knit beanie, tan canvas work jacket, dirty jeans with a rip at the knee, scuffed work boots, orange-and-white gas chainsaw, revving it once by the door; a pale woman, early 20s, long straight black hair, dark lipstick, small purple pointed hat, black sleeveless top, short purple tulle tutu, black knee-high boots, hairspray-can torch, silver 1980s boombox, pulling a black respirator down to her neck; a lanky teenage boy, pink skate helmet, mint-green tank top, dark blue shorts, striped socks, white-and-pink sneakers (normal size), wooden bat studded with nails; the camera cranes up and back smoothly and settles into a locked high three-quarter overhead view looking down at the four in the middle of the floor, then holds completely still, photoreal live-action 35mm film footage, Bakersfield California, November 1994, night, dirty green-teal and amber color grade, fine film grain, slight halation on neon, practical lighting, shallow depth of field, 16:9 frame composed for a 2.39:1 center crop with heads and key props in the middle of the frame, no readable text, no logos, no watermark, no subtitles, no cartoon, no comic inking, no halftone |
| RETRY-A | any | as original | 16:9 | 720p | Re-run the failed shot's full prompt unchanged with a new seed. If wardrobe drifted, use a tighter identity crop. If text garbled, add "all signs blank" before the suffix. |
| RETRY-B | any | as original | 16:9 | 720p | As RETRY-A. Priority: NEW-14, then NEW-10, then NEW-07. |

**Totals:** 14 NEW clips, 99 s generated, 80.5 s used, plus 5.5 s of cards = 86.0 s film.
