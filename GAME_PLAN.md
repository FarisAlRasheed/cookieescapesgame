# Cookie Escapes — Game Plan (v1)

> Status (2026-10-21): Level 1 playable end to end — phases 0–8 built, deployed at https://cookieescapesgame.vercel.app. Next: replace placeholder models (Cookie GLB), then Level 2.

A calm, funny 3D web game. You play **Cookie**, a grey cockatiel with orange cheeks and a yellow crest, trying to escape the house while the family tries (clumsily) to catch him.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Platform | Web browser (desktop + mobile), deployed by you on **Vercel** |
| Tech | **Three.js + Rapier (physics) + Vite + TypeScript** |
| Camera | Third-person, behind Cookie |
| Art style | Cartoony, **closer to realistic than low-poly**, soft and calming (warm sunlight, pastel colors, gentle shadows) |
| Tone | Funny and silly (clumsy humans, slapstick chases) |
| Caught | Back to the cage, lose 1 of 3 lives |
| Controls | Keyboard + mouse, gamepad, and mobile touch |
| Language | **Arabic only**, right-to-left UI |
| Levels | Level 1 = the house (test level); architecture built for many levels |
| Necklaces | Collectibles that grant **special powers** |
| Scoring | Stars: finish, all necklaces, fast time / never caught |
| Node.js | Installed (v24 via nvm), no extra installs needed |

---

## 2. Cookie (the player)

**Look:** classic grey cockatiel: grey body, white wing patches, yellow face, orange cheek circles, tall yellow crest. Soft feather shading, big expressive eyes.

**Abilities**

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Walk / hop | WASD | Left stick | Left virtual joystick |
| Camera | Mouse | Right stick | Drag right side of screen |
| Flap / fly | Space | A | Fly button |
| Peck / pick up / drop | E | X | Peck button |
| Whistle (lure humans) | Q | Y | Whistle button |
| Use power | F | RB | Power button |
| Pause | Esc | Start | Pause icon |

- **Flight:** each flap gives lift, and you glide between flaps. A **stamina** bar drains while flying and refills while perched. Seed bowls refill it instantly.
- **Carry:** Cookie can carry one small item in his beak (key, button, sock...). Carrying something heavy makes flight slower.
- **Whistle:** makes noise. Humans walk toward it, which you can use to lure them away from a spot.
- **Crest = emotion:** the crest goes up when scared or excited and flat when calm. It's also a gameplay hint: it rises when danger or a necklace is near.

---

## 3. The humans

| Human | Personality | Behaviour |
|---|---|---|
| **Baba (dad)** | Slow, sleepy, clumsy | Naps on the sofa and wakes up from loud noise; trips over toys |
| **Mama (mom)** | Smart and careful | Patrols, checks the door and window, uses a **towel** to grab |
| **The kid** | Fast but distracted | Chases with a toy **net**; gets distracted by TV/toys |

**AI states:** `Idle/Routine → Suspicious (?) → Chase (!) → Grab → Search → back to Routine`

- **Sight:** a vision cone in front of them. They rarely look up, so high places are safer.
- **Hearing:** flapping, knocking things over and whistling make noise; walking is quiet.
- **Funny moments:** humans slip on spilled seeds, bump their heads on shelves, hug each other by mistake when both grab at Cookie, and say short silly Arabic lines ("وين راح؟!", "كوكي تعال!").
- **Hiding spots:** under the bed, behind the curtains, inside the laundry basket, on top of the wardrobe.

---

## 4. Level 1 — "The House" (البيت)

### Room A: Bedroom (start + tutorial)
- Cookie wakes in his **cage** on a desk; the cage door was left open.
- Mama is folding laundry slowly (easy to avoid). Quick on-screen tutorial in Arabic for flying, pecking and hiding.

**Puzzle 1: the door (a mix of ideas, step by step)**
1. The door is **locked**. Cookie sees a shiny **key** on a **high shelf**, but a pile of books blocks it.
2. Cookie has to **push a book off the shelf** (it makes noise, and Mama gets suspicious). Hide until she calms down.
3. Pick up the key with his beak and fly it to the door. Near the door the lock **clicks open automatically**.
4. Cookie **lands on the door handle**. His weight pushes it down and the door creaks open.
5. 🎬 Short funny cutscene: Mama sees the door open, drops the laundry and yells. **The chase begins!**

### Room B: Living room
- Baba sleeps on the sofa and the kid watches TV. Mama follows from the bedroom.
- Furniture to fly between: bookshelf, TV cabinet, dining table, ceiling fan (spinning, so careful), curtains, fridge (through a kitchen opening).

**Puzzle 2: the window**
1. The window latch is **stuck**. Cookie needs to **peck it 3 times**, and each peck is loud.
2. Use the **whistle** or knock the **TV remote** off the table (the kid runs to it) to keep the humans busy.
3. Once the latch is free, **push the window** open (hold peck about 2s; it's risky if someone sees you).
4. 🎬 Win cutscene: Cookie flies out into a sunset sky, and the family waves from the window, laughing.

### Results screen
- ⭐ Escaped
- ⭐ Collected all necklaces
- ⭐ Under the target time **or** never caught
- Stats: time, necklaces x/5, times spotted, times caught

---

## 5. Golden necklaces & special powers (القلائد الذهبية)

5 necklaces per level, hidden in tricky places: under the pillow, inside a jewelry box (needs pecking open), on top of the wardrobe, behind the TV, on the ceiling fan blade (timing!). They sparkle, and Cookie's crest rises when one is near.

Each necklace collected fills a **gold meter**. When the meter is full, press **Power** to use the equipped power:

| Power | Effect |
|---|---|
| **Golden Whistle** (صفارة ذهبية) | A super-whistle that makes every human dance for 5 seconds |
| **Feather Dash** (اندفاعة الريش) | A fast burst of flight that escapes any grab |
| **Shadow Wings** (أجنحة الظل) | Humans can't see Cookie for 6 seconds |
| **Seed Storm** (عاصفة البذور) | Drops seeds and the humans slip comically |

- Level 1 unlocks **Golden Whistle**; later levels unlock more.
- Collecting all 5 in a level also unlocks a **cosmetic** (a tiny golden crown, a scarf, sunglasses).

---

## 6. Art & audio direction

**Look: "cozy cartoon"**, like a soft animated movie: rounded shapes, realistic-ish materials (wood grain, fabric, glass) with stylised proportions.
- Warm late-afternoon sunlight through windows, soft shadows, light dust particles, gentle bloom.
- Calm palette: cream walls, wood floors, sage green, soft blue, warm orange accents.

**Where the assets come from** (all free or allowed for commercial use):
- **Furniture/props:** Poly Haven (CC0 realistic models + textures), Quaternius & Kenney (stylised), Sketchfab CC-BY (with credits).
- **Cookie and the humans:** these need character models with animations (rig). Options are below (see Question 1).
- **HDRI lighting:** Poly Haven interior HDRIs.
- **Sound:** no music. Background ambience instead (wind, a talk radio in the living room, birds outside, a ticking clock); cockatiel chirps and whistles; funny "boing" sounds. All synthesized in code.

**Fallback:** the game is built first with simple shapes (greybox), so gameplay is fun before the art arrives. Models are swapped in later without code changes.

---

## 7. Arabic & UI

- All text in Arabic with `dir="rtl"` and an Arabic font (e.g. **Tajawal** or **Cairo**, from Google Fonts).
- Screens: main menu, level select, settings (volume, sensitivity, quality: low/medium/high), pause, results, credits.
- HUD: stamina bar, lives (feathers), necklace counter, gold-power meter, objective text ("ابحث عن المفتاح").
- Text lives in one file `src/i18n/ar.json`, so adding English later is easy.

---

## 8. Technical architecture

```
src/
  main.ts                 entry, game loop
  core/                   renderer, physics world, input, audio, save system
  input/                  keyboard, gamepad, touch joystick → one unified "actions" API
  player/                 Cookie controller, flight, stamina, carry, animations
  ai/                     human brain (state machine), vision, hearing, navmesh pathfinding
  interactables/          Key, Door, Window, Book, Necklace, SeedBowl, HidingSpot (reusable)
  levels/
    level01-house/        layout, objectives, spawn points, necklace positions
  ui/                     Arabic HTML/CSS menus + HUD
  i18n/ar.json            all text
public/models, textures, audio
```

- **Levels are data + scripts**: each level declares its rooms, items, humans and objectives. New levels reuse every system.
- **Pathfinding:** `recast-navigation-js` navmesh, so humans walk around furniture.
- **Save progress** (stars, powers, cosmetics) in the browser (localStorage).
- **Performance:** target 60 fps on laptops and 30+ fps on phones; quality presets adjust shadows and resolution.
- **Deploy:** `npm run build` creates a static `dist/` folder → import the repo in Vercel (framework preset: Vite).

---

## 9. Future levels (ideas)

| # | Level | Idea |
|---|---|---|
| 1 | The House (البيت) | This plan: bedroom → living room → window |
| 2 | The Garden (الحديقة) | Cats, a sprinkler, a gardener; reach the garden wall |
| 3 | The Street (الشارع) | Cars, kids on bikes, a market stall full of shiny things |
| 4 | The Pet Shop (محل الطيور) | Free the other birds, then escape together |
| 5 | The Big Park / Home again | Final level: Cookie finds his flock... or decides home is nice after all? |

---

## 10. Build roadmap

| Phase | Work | You can test |
|---|---|---|
| 0 | Project setup (Vite + TS + Three + Rapier), Arabic font, empty scene | Page opens in browser |
| 1 | Cookie controller: walk, hop, fly, stamina, camera; keyboard + gamepad + touch | Fly around a test room |
| 2 | Greybox house: bedroom, door, living room, window, furniture with collision | Explore the full layout |
| 3 | Interactions: peck, carry, key → door → handle, window latch, win | Level can be finished |
| 4 | Humans: navmesh, vision, hearing, chase, grab, caught → cage, lives | Real challenge |
| 5 | Necklaces, gold meter, Golden Whistle power, stars, results screen | Full game loop |
| 6 | Art pass: models, materials, lighting, particles, animations | Looks like the real game |
| 7 | Audio: music, chirps, funny sounds | Feels alive |
| 8 | Arabic menus, settings, save, mobile polish | Ready to share |
| 9 | Deploy to Vercel | Public link 🎉 |

After each phase I'll stop so you can play and give feedback.
