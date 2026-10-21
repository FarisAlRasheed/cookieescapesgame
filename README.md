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
| Walk | WASD / arrows | Left stick | Joystick |
| Camera | Mouse (click the game first) | Right stick | Drag on screen |
| Flap / fly (hold while falling to glide) | Space | A | طيران |
| Fast descend | Shift | B / LT | نزول |
| Peck (hold to push) | E | X | نقر |
| Whistle | Q | Y | صفير |
| Pause | Esc | Start | ⏸ |
| Help | H | — | — |

## Level 1 walkthrough (spoilers)

1. Fly to the high shelf on the wall across from the cage (next to the headboard) and peck the blue book. It falls and reveals the key.
2. Peck the key to pick it up, then carry it to the bedroom door. The lock opens by itself.
3. Land on the door handle. The door swings open into the living room.
4. Peck the stuck window latch 3 times, then hold peck to push the window open.
5. Fly out the window!

## Replacing Cookie's model

Put your model at `public/models/cookie.glb` and reload. The game scales it to Cookie's size and places its feet on the floor automatically. Without a file there, the game uses the built-in placeholder.

- Export as **GLB** (glTF binary) and keep it under ~10 MB.
- The model should face **+Z** (forward). If Cookie walks backwards, tell Claude and it will rotate the model.
- If the file includes an animation, the first one plays in a loop.

## Deploy (Vercel)

Build command `npm run build`, output folder `dist` (Vercel detects Vite automatically).
