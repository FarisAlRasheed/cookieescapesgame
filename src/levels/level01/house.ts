import * as THREE from 'three';
import { Builder, mat, softNoiseTexture } from '../../core/builder';
import { t } from '../../i18n/ar';
import { Human, type HumanConfig, type HumanEnv } from '../../ai/human';
import { NavGraph } from '../../ai/navGraph';
import { PALETTE, WALL_T as T, wall } from '../props';
import type { GameContext, Interactable, Level } from '../types';
import { BED, DOOR, buildBedroom } from './bedroom';
import { LIV, WIN, buildLivingRoom } from './livingRoom';

// Level 1 — "The House": bedroom → door → living room → window.

type Step = 'findKey' | 'getKey' | 'bringKey' | 'handle' | 'toLiving' | 'latch' | 'push' | 'fly' | 'won';

const DOOR_OPEN_ANGLE = 1.6;
const PANE_OPEN_ANGLE = 1.25;
const LATCH_PECKS = 3;

// Floor waypoints for the humans (x, z)
const NAV_POINTS: [number, number][] = [
  // bedroom
  [0.0, -0.3], [-0.2, 0.9], [0.9, -1.4], [1.9, -1.2], [0.4, 0.6], [-0.25, -1.0], [1.9, 0.2], [-1.0, 0.4],
  // doorway
  [DOOR.x, DOOR.z],
  // living room
  [3.2, -1.2], [3.2, 0.9], [5.3, 0.2], [5.2, -2.5], [6.8, -2.4], [7.8, -1.3], [8.5, 0.0], [7.8, 1.4],
  [5.3, 2.0], [4.5, 0.0], [3.3, -2.5], [8.6, -2.4], [8.6, 2.4], [6.8, 2.0],
];

export function buildHouse(b: Builder): Level {
  const brass = mat(PALETTE.metal, 0.3, { metalness: 0.8 });
  const bed = buildBedroom(b, brass);
  const liv = buildLivingRoom(b, brass);
  const { scene } = b;

  // Shared wall between bedroom and living room, with the doorway
  const sharedMat = mat(0xffffff, 0.95, { map: softNoiseTexture(PALETTE.wall, 8, [3, 2]) });
  wall(b, 'z', DOOR.x, LIV.Z0 - T, LIV.Z1 + T, [{ center: DOOR.z, width: DOOR.w, bottom: 0, top: DOOR.h }], sharedMat);

  // ---------- Lighting: one warm sun through both windows ----------
  scene.add(new THREE.HemisphereLight(0xfff3df, 0xb08a6a, 1.1));
  const sun = new THREE.DirectionalLight(0xffdcab, 3.2);
  sun.position.set(-5, 7.5, -7);
  sun.target.position.set(3.5, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 25 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // ---------- Hiding spots: humans can't see Cookie inside these ----------
  const hideZones = [
    new THREE.Box3(new THREE.Vector3(BED.X0 - 0.1, 0.7, 0.1 - 0.95), new THREE.Vector3(BED.X0 + 0.3, 2.3, 0.1 - 0.4)), // bedroom curtains
    new THREE.Box3(new THREE.Vector3(BED.X0 - 0.1, 0.7, 0.1 + 0.4), new THREE.Vector3(BED.X0 + 0.3, 2.3, 0.1 + 0.95)),
    new THREE.Box3(new THREE.Vector3(WIN.x - 1.05, 0.9, LIV.Z0 - 0.1), new THREE.Vector3(WIN.x - 0.5, 2.3, LIV.Z0 + 0.3)), // living curtains
    new THREE.Box3(new THREE.Vector3(WIN.x + 0.5, 0.9, LIV.Z0 - 0.1), new THREE.Vector3(WIN.x + 1.05, 2.3, LIV.Z0 + 0.3)),
    new THREE.Box3(new THREE.Vector3(3.5, -0.1, -1.95), new THREE.Vector3(4.9, 0.68, -1.05)), // under the dining table
  ];

  // ---------- Golden necklaces ----------
  const necklaceMat = mat(0xf5c542, 0.25, { metalness: 1, emissive: new THREE.Color(0x6b4a00), emissiveIntensity: 0.6 });
  const gemMat = mat(0xe85d4a, 0.1, { emissive: new THREE.Color(0x601010), emissiveIntensity: 0.6 });
  const necklaces: { obj: THREE.Group; collected: boolean }[] = [];
  const addNecklace = (parent: THREE.Object3D, pos: [number, number, number]) => {
    const g = new THREE.Group();
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 28), necklaceMat);
    chain.rotation.x = Math.PI / 2;
    chain.scale.set(1, 1.25, 1);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), gemMat);
    gem.position.z = 0.075;
    g.add(chain, gem);
    g.position.set(...pos);
    g.traverse((o) => { o.castShadow = true; });
    parent.add(g);
    // Twinkles around it
    const sparkGeo = new THREE.BufferGeometry();
    const arr = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) { arr[i * 3] = (Math.random() - 0.5) * 0.25; arr[i * 3 + 1] = Math.random() * 0.18; arr[i * 3 + 2] = (Math.random() - 0.5) * 0.25; }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff1a8, size: 0.02, transparent: true, opacity: 0.9, depthWrite: false })));
    necklaces.push({ obj: g, collected: false });
  };
  addNecklace(scene, [-1.25, 0.53, -1.95]); // between the pillows
  addNecklace(scene, [BED.X0 + 0.32, 2.12, 1.0]); // on top of the wardrobe
  addNecklace(scene, [3.95, 2.02, LIV.Z1 - 0.2]); // on top of the tall bookshelf
  addNecklace(scene, [LIV.X1 - 0.12, 0.52, 0.25]); // hidden behind the TV
  addNecklace(liv.fan, [0.5, 0.03, 0]); // riding the ceiling fan!

  // ---------- Puzzle state ----------
  let ctx!: GameContext;
  let step: Step = 'findKey';
  let latchPecks = 0;
  let lockedToastCooldown = 0;
  let nav!: NavGraph;
  const humans: Human[] = [];

  const bookFall = { active: false, vel: new THREE.Vector3() };
  let handleT = -1;
  let handleWiggle = 0;
  let doorAngle = 0;
  let doorOpening = false;
  let latchWiggle = 0;
  let paneAngle = 0;
  let paneOpening = false;

  const objective: Record<Step, () => string> = {
    findKey: () => t.obj.findKey,
    getKey: () => t.obj.getKey,
    bringKey: () => t.obj.bringKey,
    handle: () => t.obj.handle,
    toLiving: () => t.obj.toLiving,
    latch: () => t.obj.latch(latchPecks, LATCH_PECKS),
    push: () => t.obj.push,
    fly: () => t.obj.fly,
    won: () => '',
  };
  const go = (s: Step) => {
    step = s;
    ctx.setObjective(objective[s]());
  };
  const noise = (p: THREE.Vector3, radius: number) => humans.forEach((h) => h.hear(p, radius));

  const bookPos = bed.book.position.clone();
  const keyHome = bed.key.position.clone();
  const windowPushPos = new THREE.Vector3(WIN.x, WIN.bottom + 0.15, LIV.Z0 + 0.1);
  const doorCenter = new THREE.Vector3(DOOR.x, 1, DOOR.z);

  const interactables: Interactable[] = [
    {
      position: bookPos, radius: 0.34,
      prompt: () => (step === 'findKey' ? t.prompt.pushBook : null),
      onPeck() {
        b.removeCollider(bed.bookCollider);
        bookFall.active = true;
        bookFall.vel.set(0, 0.6, 1.3);
        ctx.sfx.rattle();
        go('getKey');
      },
    },
    {
      position: bed.key.position, radius: 0.3,
      prompt: () => (step === 'getKey' && !bookFall.active && !ctx.carrying ? t.prompt.takeKey : null),
      onPeck() {
        ctx.carry(bed.key);
        bed.keyGlow.intensity = 0;
        ctx.sfx.jingle();
        go('bringKey');
      },
    },
    {
      position: bed.lampPos, radius: 0.35,
      prompt: () => t.prompt.lamp,
      onPeck: () => bed.toggleLamp(),
    },
    {
      position: liv.remotePos, radius: 0.3,
      prompt: () => (liv.isTvOn() ? t.prompt.tvOff : t.prompt.tv),
      onPeck() {
        liv.toggleTv();
        noise(liv.remotePos, 3);
      },
    },
    {
      position: liv.radioPos, radius: 0.3,
      prompt: () => (ctx.sfx.radioOn ? t.prompt.radioOff : t.prompt.radioOn),
      onPeck() {
        ctx.sfx.radioOn = !ctx.sfx.radioOn;
        ctx.sfx.click();
      },
    },
    {
      position: liv.latchPos, radius: 0.32,
      prompt: () => (step === 'latch' ? t.prompt.latch : null),
      onPeck() {
        latchPecks++;
        latchWiggle = 0.35;
        ctx.sfx.rattle();
        noise(liv.latchPos, 3.5);
        if (latchPecks >= LATCH_PECKS) {
          liv.latch.rotation.z = Math.PI / 2;
          ctx.sfx.click();
          go('push');
        } else {
          ctx.setObjective(objective.latch());
        }
      },
    },
    {
      position: windowPushPos, radius: 0.45,
      prompt: () => (step === 'push' ? t.prompt.push : null),
      holdTime: 1.4,
      onHold() {
        b.removeCollider(liv.paneCollider);
        paneOpening = true;
        ctx.sfx.creak();
        noise(windowPushPos, 6);
        go('fly');
      },
    },
  ];

  const makeHumans = () => {
    nav = new NavGraph(b.world, NAV_POINTS);
    nav.rebuild(ctx.player.body);
    const env: HumanEnv = {
      world: b.world,
      nav,
      player: ctx.player,
      isHidden: (p) => hideZones.some((z) => z.containsPoint(p.clone().add(new THREE.Vector3(0, 0.12, 0)))),
      tvOn: () => liv.isTvOn(),
      tvSpot: { pos: new THREE.Vector3(8.5, 0, 0.55), yaw: Math.PI / 2 },
      say: (h) => ctx.sfx.voice(h.cfg.voice),
      onCatch: (h) => ctx.caught(h),
    };
    const configs: HumanConfig[] = [
      {
        name: 'mama',
        look: { height: 1.65, skin: 0xe8b48f, top: 0xc98bb0, bottom: 0xb7779d, hair: 0x3a2a20, headscarf: 0x9cbf9a, longDress: true },
        walkSpeed: 0.85, runSpeed: 2.0, reachExtra: 0, grabRange: 0.7, sight: 6, notice: 1.3, voice: 1.25,
        home: new THREE.Vector3(0.4, 0, -0.4), homeYaw: 0,
        routineArea: (p) => p.x < BED.X1 - 0.2,
        lines: t.lines.mama,
      },
      {
        name: 'baba',
        look: { height: 1.78, skin: 0xd9a07a, top: 0xf6f3ee, bottom: 0xf6f3ee, hair: 0x2e2520, longDress: true, belly: 0.06, mustache: true },
        walkSpeed: 0.75, runSpeed: 1.75, reachExtra: 0, grabRange: 0.7, sight: 5.5, notice: 1.0, voice: 0.8,
        home: new THREE.Vector3(6.35, 0, -0.45), homeYaw: Math.PI / 2,
        routineArea: (p) => p.x > LIV.X0 + 0.5,
        sleepSeat: { pos: new THREE.Vector3(6.35, 0, -0.45), yaw: Math.PI / 2, wakeRadius: 3.2 },
        lines: t.lines.baba,
      },
      {
        name: 'kid',
        look: { height: 1.2, skin: 0xe8b48f, top: 0xf2b134, bottom: 0x6f9fc0, hair: 0x3a2a20, net: true },
        walkSpeed: 1.1, runSpeed: 2.5, reachExtra: 0.55, grabRange: 0.95, sight: 6.5, notice: 1.7, voice: 1.6,
        home: new THREE.Vector3(7.8, 0, 1.6), homeYaw: Math.PI,
        routineArea: (p) => p.x > LIV.X0 + 0.5,
        watchesTv: true,
        lines: t.lines.kid,
      },
    ];
    for (const c of configs) humans.push(new Human(c, env, scene));
  };

  return {
    spawn: bed.spawn,
    spawnYaw: bed.spawnYaw,
    interactables,
    humans,
    necklaceTotal: necklaces.length,

    start(c) {
      ctx = c;
      makeHumans();
      go('findKey');
    },

    noise,

    ambience(p) {
      const near = (q: THREE.Vector3, r: number) => Math.max(0, 1 - p.distanceTo(q) / r);
      const inLiving = p.x > BED.X1;
      const doorOpen = doorAngle > 0.3;
      const bedWindow = new THREE.Vector3(BED.X0, 1.5, 0.1);
      const livWindow = new THREE.Vector3(WIN.x, 1.5, LIV.Z0);
      return {
        wind: Math.max(near(bedWindow, 3), near(livWindow, 3.5) * (paneAngle > 0.2 ? 1.6 : 1)),
        radio: inLiving ? Math.max(0.25, near(liv.radioPos, 6)) : doorOpen ? 0.2 : 0.07,
        clock: inLiving ? (doorOpen ? 0.1 : 0) : Math.max(0.35, near(bed.clockPos, 4)),
      };
    },

    onCookieCaught() {
      // The key goes back to the shelf if Cookie was carrying it
      if (ctx.carrying === bed.key) {
        ctx.carry(null);
        scene.add(bed.key);
        bed.key.position.copy(keyHome);
        bed.key.rotation.set(0, 0, 0);
        bed.key.scale.setScalar(1);
        go('getKey');
      }
      humans.forEach((h) => h.reset());
    },

    update(dt, time) {
      bed.update(time);
      liv.update(dt, time);
      const p = ctx.player.position;
      lockedToastCooldown -= dt;
      humans.forEach((h) => h.update(dt));

      // Necklaces spin, twinkle and get collected on touch
      for (const n of necklaces) {
        if (n.collected) continue;
        n.obj.rotation.y += dt * 1.5;
        const wp = n.obj.getWorldPosition(new THREE.Vector3());
        if (wp.distanceTo(p.clone().add(new THREE.Vector3(0, 0.12, 0))) < 0.28) {
          n.collected = true;
          n.obj.visible = false;
          ctx.collectNecklace(wp);
        }
      }

      // Book tumbles off the shelf and lands flat on the floor
      if (bookFall.active) {
        const bk = bed.book;
        bookFall.vel.y -= 9.8 * dt;
        bk.position.addScaledVector(bookFall.vel, dt);
        bk.rotation.x += 6 * dt;
        if (bk.position.y <= 0.025) {
          bk.position.y = 0.025;
          bk.rotation.set(Math.PI / 2, 0, 0.3);
          bookFall.active = false;
          ctx.sfx.thud();
          noise(bk.position, 7);
          b.collider([0.24, 0.05, 0.3], [bk.position.x, 0.025, bk.position.z]);
        }
      }
      if (step === 'getKey' && !ctx.carrying) bed.keyGlow.intensity = 0.6 + Math.sin(time * 4) * 0.3;

      // Bring the key to the door → it unlocks by itself
      if (step === 'bringKey' && p.distanceTo(bed.handleTop) < 0.8) {
        ctx.carry(null);
        ctx.sfx.click();
        go('handle');
      }

      // Landing on the handle
      const onHandle = ctx.player.grounded
        && Math.abs(p.y - bed.handleTop.y) < 0.08
        && Math.hypot(p.x - bed.handleTop.x, p.z - bed.handleTop.z) < 0.16;
      if (onHandle && step === 'handle' && handleT < 0) {
        handleT = 0;
      } else if (onHandle && (step === 'findKey' || step === 'getKey' || step === 'bringKey') && lockedToastCooldown <= 0) {
        lockedToastCooldown = 2.5;
        handleWiggle = 0.4;
        ctx.sfx.rattle();
        noise(doorCenter, 3);
        ctx.hud.toast(t.lockedDoor);
      }
      if (handleT >= 0) {
        handleT += dt;
        bed.handle.rotation.x = -Math.min(handleT / 0.25, 1) * 0.6;
        if (handleT > 0.35 && !doorOpening && doorAngle === 0) {
          doorOpening = true;
          b.removeCollider(bed.doorCollider);
          b.removeCollider(bed.handlePad);
          ctx.sfx.creak();
          go('toLiving');
          // The whole house hears the door creak — Mama comes to look
          noise(doorCenter, 9);
        }
        if (handleT > 1.2) bed.handle.rotation.x *= 0.9;
      }
      if (handleWiggle > 0) {
        handleWiggle -= dt;
        bed.handle.rotation.x = Math.sin(handleWiggle * 50) * 0.12;
      }
      if (doorOpening) {
        doorAngle = Math.min(DOOR_OPEN_ANGLE, doorAngle + dt * 1.4);
        bed.door.rotation.y = doorAngle;
        if (doorAngle >= DOOR_OPEN_ANGLE) {
          doorOpening = false;
          const c = new THREE.Vector3(0, DOOR.h / 2, DOOR.w / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), doorAngle).add(bed.door.position);
          b.collider([0.05, DOOR.h, DOOR.w], [c.x, c.y, c.z], doorAngle);
          b.world.step();
          nav.rebuild(ctx.player.body); // the doorway is walkable now
        }
      }

      if (step === 'toLiving' && p.x > BED.X1 + 0.3) go('latch');

      if (latchWiggle > 0) {
        latchWiggle -= dt;
        liv.latch.rotation.z = Math.sin(latchWiggle * 60) * 0.25;
      }
      if (paneOpening) {
        paneAngle = Math.min(PANE_OPEN_ANGLE, paneAngle + dt * 1.1);
        liv.pane.rotation.y = paneAngle;
        if (paneAngle >= PANE_OPEN_ANGLE) paneOpening = false;
      }

      // Escape!
      if (step === 'fly' && p.z < WIN.z - 0.2 && Math.abs(p.x - WIN.x) < WIN.w) {
        step = 'won';
        ctx.win();
      }
    },
  };
}
