import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input, lookSettings } from './core/input';
import { Sfx } from './core/audio';
import { Builder } from './core/builder';
import { loadProgress, loadSettings, saveProgress, saveSettings, type Settings } from './core/save';
import { Particles } from './fx/particles';
import { BlobShadow } from './fx/blobShadow';
import { CAMERA_RAY_GROUPS } from './core/builder';
import { buildHouse } from './levels/level01/house';
import type { GameContext, Interactable } from './levels/types';
import { createCookie } from './player/cookieModel';
import { CookieController, TUNING } from './player/cookieController';
import { FollowCamera } from './player/followCamera';
import { Hud, type Bubble } from './ui/hud';
import { t } from './i18n/ar';

const FIXED_DT = 1 / 60;
const FAST_ESCAPE_SECONDS = 180;
const MAX_LIVES = 3;
const GOLD_PER_NECKLACE = 50;
const DANCE_SECONDS = 5;
const RESPAWN_GRACE = 3; // seconds nobody can grab Cookie after he's put back

/**
 * Per-quality knobs. Phones default to "medium": lower resolution, no bloom, decorative lights off,
 * a static sun shadow refreshed now and then, and soft blob shadows under characters.
 */
const QUALITY = {
  high: { dpr: 2, shadows: true, shadowSize: 4096, soft: true, shadowEvery: 1, bloom: true, extraLights: true, characterShadows: true, fps: 60 },
  medium: { dpr: 1.25, shadows: true, shadowSize: 2048, soft: false, shadowEvery: 30, bloom: false, extraLights: false, characterShadows: false, fps: 60 },
  low: { dpr: 1, shadows: false, shadowSize: 512, soft: false, shadowEvery: 0, bloom: false, extraLights: false, characterShadows: false, fps: 30 },
} as const;

async function main() {
  const settings = loadSettings();
  const progress = loadProgress();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const input = new Input(canvas);
  const hud = new Hud(document.getElementById('ui')!, input.isTouch, settings);
  const sfx = new Sfx();

  // ---------- Renderer, scene, post-processing ----------
  // Phones have tiny pixels; skipping MSAA there saves a lot of GPU work (and heat)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !input.isTouch, powerPreference: input.isTouch ? 'default' : 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3e3c8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.02, 60);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.6, 0.88));
  composer.addPass(new OutputPass());
  let useComposer = true;
  let q: (typeof QUALITY)[keyof typeof QUALITY] = QUALITY.high;
  let frame = 0;

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // ---------- Physics & level ----------
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); // gravity handled by the controller
  const level = buildHouse(new Builder(scene, world));
  const particles = new Particles(scene);

  let characterRoots = (): THREE.Object3D[] => [];
  const applySettings = (s: Settings) => {
    saveSettings(s);
    sfx.setVolume(s.sfx);
    lookSettings.sensitivity = s.sensitivity;
    lookSettings.invertY = s.invertY;
    q = QUALITY[s.quality];
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr));
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = q.shadowEvery === 1;
    renderer.shadowMap.needsUpdate = true;
    useComposer = q.bloom;
    scene.traverse((o) => {
      const light = o as THREE.Light;
      if ((light as THREE.DirectionalLight).isDirectionalLight) {
        const l = light as THREE.DirectionalLight;
        if (l.shadow.mapSize.x !== q.shadowSize) {
          l.shadow.mapSize.set(q.shadowSize, q.shadowSize);
          l.shadow.map?.dispose();
          (l.shadow as unknown as { map: null }).map = null;
        }
      }
      if (light.isLight && light.userData.optional) light.visible = q.extraLights;
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    // Characters cast real shadows only on high; otherwise they get blob shadows
    const setCast = (root: THREE.Object3D) => root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = q.characterShadows; });
    characterRoots().forEach(setCast);
  };
  hud.onSettings = applySettings;

  // ---------- Cookie ----------
  const visual = await createCookie();
  visual.setCrown(progress.crown);
  scene.add(visual.root);
  const player = new CookieController(world, visual, level.spawn, level.spawnYaw, {
    onFlap: () => {
      sfx.flap();
      level.noise(player.position, 1.2);
    },
    onTired: () => hud.toast(t.tired),
  });
  world.step(); // register colliders before the first query
  const follow = new FollowCamera(camera, world, player.body, level.spawnYaw);
  follow.update(0, player.position, true);

  if (input.isTouch) input.bindTouch(hud.joyZone, hud.joystick, hud.knob, hud.touchButtons);

  // ---------- Game state ----------
  let running = false;
  let paused = false;
  let over = false; // won or out of lives
  let acc = 0;
  let time = 0;
  let playTime = 0;
  let scared = 0;
  let last = performance.now();
  let carrying: THREE.Object3D | null = null;
  let holdTarget: Interactable | null = null;
  let holdTime = 0;
  let lives = MAX_LIVES;
  let timesCaught = 0;
  let gold = 0;
  let necklaces = 0;
  let caughtFreeze = 0; // seconds of "caught!" before Cookie is put back
  let grace = 0;
  let powerHintShown = false;

  hud.setLives(lives, MAX_LIVES);
  hud.setNecklaces(0, level.necklaceTotal);
  hud.setGold(0);

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
    caught(by) {
      if (caughtFreeze > 0 || grace > 0 || over) return;
      timesCaught++;
      lives--;
      hud.setLives(lives, MAX_LIVES);
      hud.flash('rgba(255,120,90,.6)');
      hud.toast(t.caught, 2);
      sfx.caught();
      particles.feathers(player.position);
      by.say(t.gotYou, 1.5, true);
      caughtFreeze = 1.4;
      input.enabled = false;
    },
    collectNecklace(at) {
      necklaces++;
      gold = Math.min(200, gold + GOLD_PER_NECKLACE);
      hud.setGold(gold);
      hud.setNecklaces(necklaces, level.necklaceTotal);
      hud.toast(t.necklace(necklaces, level.necklaceTotal), 2.2);
      sfx.collect();
      particles.sparkles(at);
      scared = 1;
      if (gold >= 100 && !powerHintShown) {
        powerHintShown = true;
        setTimeout(() => hud.toast(input.isTouch ? t.power.readyTouch : t.power.ready, 3), 2300);
      }
    },
    win() {
      over = true;
      input.enabled = false;
      hud.setPrompt(null);
      document.exitPointerLock?.();
      sfx.success();
      setTimeout(() => sfx.whistle(), 600);
      const stars: [boolean, boolean, boolean] = [true, necklaces >= level.necklaceTotal, playTime < FAST_ESCAPE_SECONDS || timesCaught === 0];
      const starCount = stars.filter(Boolean).length;
      let extra = '';
      if (stars[1] && !progress.crown) {
        progress.crown = true;
        visual.setCrown(true);
        extra = t.crown;
      }
      if (starCount > progress.bestStars || (starCount === progress.bestStars && (progress.bestTime === null || playTime < progress.bestTime))) {
        progress.bestStars = starCount;
        progress.bestTime = playTime;
      }
      saveProgress(progress);
      hud.showWin(playTime, necklaces, level.necklaceTotal, stars, extra);
    },
  };
  level.start(ctx);

  // Quality needs the characters to exist (they switch between real and blob shadows)
  characterRoots = () => [visual.root, ...level.humans.map((h) => h.model.root)];
  applySettings(settings);
  const cookieBlob = new BlobShadow(scene, 0.22);
  const humanBlobs = level.humans.map(() => new BlobShadow(scene, 0.75));
  const downRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  const setPaused = (p: boolean) => {
    if (over) return;
    paused = p;
    input.enabled = !p && caughtFreeze <= 0;
    hud.show(p ? 'pause' : null);
    if (!p) input.lockPointer();
  };

  hud.ready({ time: progress.bestTime, stars: progress.bestStars });
  hud.onPlay = () => {
    sfx.unlock();
    sfx.setVolume(settings.sfx);
    sfx.chirp();
    sfx.startAmbience();
    running = true;
    setPaused(false);
  };
  hud.onResume = () => setPaused(false);
  hud.onRestart = () => location.reload();
  hud.pauseTouchBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setPaused(true); });
  document.addEventListener('pointerlockchange', () => {
    if (running && !paused && !over && !input.isTouch && !input.pointerLocked) setPaused(true);
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

  const bubbles = (): Bubble[] => level.humans
    .filter((h) => h.bubble)
    .map((h) => ({ id: h.cfg.name, text: h.bubble!.text, pos: h.headPos }));

  // ---------- Loop ----------
  // Pause when the app goes to the background (saves battery on phones)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused && !over) setPaused(true);
  });

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    // Cap the frame rate: phones with 120 Hz screens would otherwise do double the work.
    // Behind menus the scene barely changes, so draw it only ~10 times a second.
    const busyMenu = !running || paused || over;
    const minFrame = 1000 / (busyMenu ? 10 : q.fps) - 2;
    if (now - last < minFrame) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;

    const a = input.poll(dt);
    if (a.helpPressed) hud.toggleHelp();
    if (running && a.pausePressed && !over) setPaused(!paused);

    const active = running && !paused && !over;
    if (active) {
      playTime += dt;
      grace -= dt;
      hud.setTime(playTime);
      follow.look(a.lookX, a.lookY);
      player.queue(a);

      // Caught: freeze, then back to the cage
      if (caughtFreeze > 0) {
        caughtFreeze -= dt;
        if (caughtFreeze <= 0) {
          if (lives <= 0) {
            over = true;
            document.exitPointerLock?.();
            hud.showGameOver();
          } else {
            level.onCookieCaught();
            player.respawn(level.spawn, level.spawnYaw);
            follow.yaw = level.spawnYaw;
            grace = RESPAWN_GRACE;
            input.enabled = true;
          }
        }
      }

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
      hud.setPrompt(target?.prompt() ?? null, target?.holdTime ? holdTime / target.holdTime : -1);

      if (a.whistlePressed) {
        visual.whistle();
        sfx.whistle();
        level.noise(player.position, 6); // lures people towards Cookie
      }

      // Golden Whistle: everyone nearby dances
      if (a.powerPressed && gold >= 100) {
        gold -= 100;
        hud.setGold(gold);
        sfx.goldenWhistle();
        visual.whistle();
        particles.ring(player.position);
        hud.flash('rgba(255,215,110,.45)');
        hud.toast(t.power.used, 2);
        for (const h of level.humans) if (h.pos.distanceTo(player.position) < 14) h.dance(DANCE_SECONDS);
      }

      acc += dt;
      while (acc >= FIXED_DT) {
        player.fixedUpdate(FIXED_DT, a, follow.yaw);
        world.step();
        acc -= FIXED_DT;
      }

      if (player.position.y < -1) player.respawn(level.spawn, level.spawnYaw);
      level.update(dt, time);

      sfx.setAmbience(level.ambience(player.position));

      // Cookie's crest goes up when someone spots him
      if (level.humans.some((h) => h.seesCookie && h.alert > 0.3)) scared = Math.max(scared, 0.8);
    }

    scared = Math.max(0, scared - dt * 0.5);
    player.render(active ? acc / FIXED_DT : 1, dt, scared);
    visual.root.visible = caughtFreeze <= 0 || Math.floor(time * 12) % 2 === 0;
    follow.update(dt, player.renderPos);
    particles.update(dt);

    // Blob shadows (phones) and an occasional refresh of the static sun shadow
    const blobs = !q.characterShadows;
    if (blobs) {
      const p = player.renderPos;
      downRay.origin = { x: p.x, y: p.y + 0.05, z: p.z };
      const hit = world.castRay(downRay, 4, true, undefined, CAMERA_RAY_GROUPS, undefined, player.body);
      const toi = hit ? ((hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi) : 4;
      cookieBlob.place(p.x, p.y + 0.05 - toi, p.z, toi - 0.05, !!hit && visual.root.visible);
      level.humans.forEach((h, i) => humanBlobs[i].place(h.pos.x, 0, h.pos.z, 0, h.state !== 'sleep'));
    } else {
      cookieBlob.place(0, 0, 0, 0, false);
      humanBlobs.forEach((b) => b.place(0, 0, 0, 0, false));
    }
    frame++;
    if (q.shadows && q.shadowEvery > 1 && frame % q.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;

    hud.setStamina(player.stamina, TUNING.staminaMax);
    hud.updateBubbles(running ? bubbles() : [], camera);
    hud.update(dt);
    if (useComposer) composer.render();
    else renderer.render(scene, camera);
  });
}

main();
