# كوكي يهرب — Cookie Escapes

A cozy, funny 3D web game about Cookie the cockatiel escaping the house. See [GAME_PLAN.md](GAME_PLAN.md) for the full design.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Walk | WASD / arrows | Left stick | Floating joystick (left side) |
| Camera | Mouse (click the game first) | Right stick | Drag on screen |
| Flap / fly (hold while falling to glide) | Space | A | طيران |
| Fast descend | Shift | B / LT | نزول |
| Peck (hold to push) | E | X | نقر |
| Whistle (lures people) | Q | Y | صفير |
| Golden Whistle power | F | RB | ✨ |
| Pause | Esc | Start | ⏸ |
| Help | H | — | — |

## Level 1 walkthrough (spoilers)

1. Fly to the high shelf on the wall across from the cage (next to the headboard) and peck the blue book. It falls and reveals the key.
2. Peck the key to pick it up, then carry it to the bedroom door. The lock opens by itself.
3. Land on the door handle. The door swings open into the living room.
4. Peck the stuck window latch 3 times, then hold peck to push the window open.
5. Fly out the window!

**The family:** Mama patrols the bedroom, Baba naps on the sofa (loud sounds wake him), and the kid has a toy net (turn on the TV to distract him). ❓ means someone is suspicious, ❗ means they're chasing. They rarely look up; curtains and the space under the dining table hide Cookie. Getting caught costs a feather (3 lives).

**Golden necklaces:** 5 are hidden (bed, wardrobe top, bookshelf top, behind the TV, on the ceiling fan). Every 2 fill the gold meter for the Golden Whistle, which makes everyone dance for 5 seconds. Collecting all 5 unlocks a golden crown for Cookie.

## Quality

Settings → graphics quality. Phones default to **medium** (lower resolution, no bloom, static sun shadow refreshed twice a second, blob shadows under characters). **Low** also drops shadows and caps at 30 fps; **high** (desktop default) has full soft shadows and bloom. Frame rate is capped at 60 everywhere, and the game pauses when it goes to the background.

## Replacing Cookie's model

Put your model at `public/models/cookie.glb` and reload. The game scales it to Cookie's size and places its feet on the floor automatically. Without a file there, the game uses the built-in placeholder.

- Export as **GLB** (glTF binary) and keep it under ~10 MB.
- The model should face **+Z** (forward). If Cookie walks backwards, tell Claude and it will rotate the model.
- If the file includes an animation, the first one plays in a loop.

## Deploy (Vercel)

Build command `npm run build`, output folder `dist` (Vercel detects Vite automatically).
