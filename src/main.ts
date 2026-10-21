import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Input } from './core/input';
import { Sfx } from './core/audio';
import { Builder } from './core/builder';
import { buildHouse } from './levels/level01/house';
import type { GameContext, Interactable } from './levels/types';
import { createCookie } from './player/cookieModel';
import { CookieController, TUNING } from './player/cookieController';
import { FollowCamera } from './player/followCamera';
import { Hud } from './ui/hud';
import { t } from './i18n/ar';

const FIXED_DT = 1 / 60;
const FAST_ESCAPE_SECONDS = 180;

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const input = new Input(canvas);
  const hud = new Hud(document.getElementById('ui')!, input.isTouch);
  const sfx = new Sfx();

  // ---------- Renderer & scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, input.isTouch ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3e3c8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.02, 60);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---------- Physics & level ----------
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); // gravity handled by the controller
  const level = buildHouse(new Builder(scene, world));

  // ---------- Cookie ----------
  const visual = await createCookie();
  scene.add(visual.root);
  const player = new CookieController(world, visual, level.spawn, level.spawnYaw, {
    onFlap: () => sfx.flap(),
    onTired: () => hud.toast(t.tired),
  });
  world.step(); // register colliders before the first query
  const follow = new FollowCamera(camera, world, player.body, level.spawnYaw);
  follow.update(0, player.position, true);

  if (input.isTouch) input.bindTouch(hud.joystick, hud.knob, hud.touchButtons);

  // ---------- Game state ----------
  let running = false;
  let paused = false;
  let won = false;
  let acc = 0;
  let time = 0;
  let playTime = 0;
  let scared = 0;
  let last = performance.now();
  let carrying: THREE.Object3D | null = null;
  let holdTarget: Interactable | null = null;
  let holdTime = 0;

  const ctx: GameContext = {
    player, hud, sfx,
    get carrying() { return carrying; },
    carry(obj) {
      if (carrying) carrying.removeFromParent();
      carrying = obj;
      player.carrying = !!obj;
      if (obj) {
        visual.beakAnchor.add(obj);
        obj.position.set(0, 0, 0.02);
        obj.rotation.set(0, Math.PI / 2, 0);
        obj.scale.setScalar(0.7);
        scared = 1;
      }
    },
    setObjective(text) {
      hud.setObjective(text);
      scared = 1;
    },
    win() {
      won = true;
      input.enabled = false;
      hud.setPrompt(null);
      document.exitPointerLock?.();
      sfx.success();
      setTimeout(() => sfx.whistle(), 600);
      hud.showWin(playTime, playTime < FAST_ESCAPE_SECONDS);
    },
  };
  level.start(ctx);

  const setPaused = (p: boolean) => {
    if (won) return;
    paused = p;
    input.enabled = !p;
    hud.setPaused(p);
    if (!p) input.lockPointer();
  };

  hud.ready();
  hud.startBtn.addEventListener('click', () => {
    sfx.unlock();
    sfx.chirp();
    hud.startScreen.classList.add('hidden');
    running = true;
    setPaused(false);
  });
  hud.resumeBtn.addEventListener('click', () => setPaused(false));
  hud.againBtn.addEventListener('click', () => location.reload());
  hud.pauseTouchBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setPaused(true); });
  document.addEventListener('pointerlockchange', () => {
    if (running && !paused && !won && !input.isTouch && !input.pointerLocked) setPaused(true);
  });

  // Expose for debugging in the browser console
  (window as unknown as Record<string, unknown>).cookie = { player, follow, level, ctx, TUNING, renderer, scene, camera };

  const headPos = new THREE.Vector3();
  const nearestInteractable = () => {
    headPos.copy(player.position).y += 0.12;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of level.interactables) {
      const d = it.position.distanceTo(headPos);
      if (d < it.radius + 0.1 && d < bestD && it.prompt() !== null) { best = it; bestD = d; }
    }
    return best;
  };

  // ---------- Loop ----------
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;

    const a = input.poll(dt);
    if (a.helpPressed) hud.toggleHelp();
    if (running && a.pausePressed) setPaused(!paused);

    const active = running && !paused && !won;
    if (active) {
      playTime += dt;
      hud.setTime(playTime);
      follow.look(a.lookX, a.lookY);
      player.queue(a);

      // Interactions: peck, or peck-and-hold
      const target = nearestInteractable();
      if (target !== holdTarget) { holdTarget = target; holdTime = 0; }
      if (a.peckPressed) {
        visual.peck();
        sfx.peck();
        if (target?.onPeck) target.onPeck();
      }
      if (target?.holdTime && a.peckHeld) {
        holdTime += dt;
        if (holdTime >= target.holdTime) {
          holdTime = 0;
          target.onHold?.();
        } else if (Math.floor(holdTime * 4) !== Math.floor((holdTime - dt) * 4)) {
          visual.peck();
        }
      } else {
        holdTime = 0;
      }
      const label = target?.prompt() ?? null;
      hud.setPrompt(label, target?.holdTime ? holdTime / target.holdTime : -1);

      if (a.whistlePressed) {
        visual.whistle();
        sfx.whistle();
      }

      acc += dt;
      while (acc >= FIXED_DT) {
        player.fixedUpdate(FIXED_DT, a, follow.yaw);
        world.step();
        acc -= FIXED_DT;
      }

      // Safety net: fell out of the house
      if (player.position.y < -1) player.respawn(level.spawn, level.spawnYaw);
    }

    if (running) level.update(dt, time);
    scared = Math.max(0, scared - dt * 0.5);
    player.render(active ? acc / FIXED_DT : 1, dt, scared);
    follow.update(dt, player.renderPos);
    hud.setStamina(player.stamina, TUNING.staminaMax);
    hud.update(dt);
    renderer.render(scene, camera);
  });
}

main();
