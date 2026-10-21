import * as THREE from 'three';
import { Builder, mat, softNoiseTexture } from '../../core/builder';
import { t } from '../../i18n/ar';
import { PALETTE, WALL_T as T, wall } from '../props';
import type { GameContext, Interactable, Level } from '../types';
import { BED, DOOR, buildBedroom } from './bedroom';
import { LIV, WIN, buildLivingRoom } from './livingRoom';

// Level 1 — "The House": bedroom → door → living room → window.

type Step = 'findKey' | 'getKey' | 'bringKey' | 'handle' | 'toLiving' | 'latch' | 'push' | 'fly' | 'won';

const DOOR_OPEN_ANGLE = 1.6;
const PANE_OPEN_ANGLE = 1.25;
const LATCH_PECKS = 3;

export function buildHouse(b: Builder): Level {
  const brass = mat(PALETTE.metal, 0.3, { metalness: 0.8 });
  const bed = buildBedroom(b, brass);
  const liv = buildLivingRoom(b, brass);

  // Shared wall between bedroom and living room, with the doorway
  const sharedMat = mat(0xffffff, 0.95, { map: softNoiseTexture(PALETTE.wall, 8, [3, 2]) });
  wall(b, 'z', DOOR.x, LIV.Z0 - T, LIV.Z1 + T, [{ center: DOOR.z, width: DOOR.w, bottom: 0, top: DOOR.h }], sharedMat);

  // ---------- Lighting: one warm sun through both windows ----------
  const { scene } = b;
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

  // ---------- Puzzle state ----------
  let ctx!: GameContext;
  let step: Step = 'findKey';
  let latchPecks = 0;
  let lockedToastCooldown = 0;

  // Animations
  const bookFall = { active: false, vel: new THREE.Vector3(), spin: 0 };
  let handleT = -1; // seconds since handle pressed, -1 = idle
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

  const bookPos = bed.book.position.clone();
  const keyPos = bed.key.position.clone();
  const windowPushPos = new THREE.Vector3(WIN.x, WIN.bottom + 0.15, LIV.Z0 + 0.1);

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
      position: keyPos, radius: 0.3,
      prompt: () => (step === 'getKey' && !bookFall.active ? t.prompt.takeKey : null),
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
      prompt: () => t.prompt.tv,
      onPeck: () => liv.toggleTv(),
    },
    {
      position: liv.latchPos, radius: 0.32,
      prompt: () => (step === 'latch' ? t.prompt.latch : null),
      onPeck() {
        latchPecks++;
        latchWiggle = 0.35;
        ctx.sfx.rattle();
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
        go('fly');
      },
    },
  ];

  return {
    spawn: bed.spawn,
    spawnYaw: bed.spawnYaw,
    interactables,

    start(c) {
      ctx = c;
      go('findKey');
    },

    update(dt, time) {
      bed.update(time);
      liv.update(dt, time);
      const p = ctx.player.position;
      lockedToastCooldown -= dt;

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
          b.collider([0.24, 0.05, 0.3], [bk.position.x, 0.025, bk.position.z]);
        }
      }
      // Key glints so it's noticeable once uncovered
      if (step === 'getKey') bed.keyGlow.intensity = 0.6 + Math.sin(time * 4) * 0.3;

      // Bring the key to the door → it unlocks by itself
      if (step === 'bringKey' && p.distanceTo(bed.handleTop) < 0.8) {
        ctx.carry(null);
        bed.key.removeFromParent();
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
          // Solid again in its open position
          const c = new THREE.Vector3(0, DOOR.h / 2, DOOR.w / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), doorAngle).add(bed.door.position);
          b.collider([0.05, DOOR.h, DOOR.w], [c.x, c.y, c.z], doorAngle);
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
