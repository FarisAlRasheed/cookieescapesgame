import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAMERA_RAY_GROUPS, SEE_THROUGH_GROUPS } from '../core/builder';
import type { CookieController } from '../player/cookieController';
import { HumanModel, type HumanLook, type Pose } from './humanModel';
import type { NavGraph } from './navGraph';

export type HumanState = 'routine' | 'idle' | 'sleep' | 'suspicious' | 'chase' | 'search' | 'grab' | 'stumble' | 'dance' | 'tv' | 'return' | 'wait';

export interface HumanLines {
  notice: string[];
  chase: string[];
  search: string[];
  miss: string[];
  unreachable: string[];
  wake?: string[];
  tv?: string[];
}

export interface HumanConfig {
  name: string;
  look: HumanLook;
  walkSpeed: number;
  runSpeed: number;
  reachExtra: number; // extra reach above the hands (the kid's net)
  grabRange: number; // horizontal reach
  sight: number; // meters
  notice: number; // how fast suspicion grows
  voice: number; // pitch of their gibberish voice
  home: THREE.Vector3;
  homeYaw: number;
  routineArea: (p: THREE.Vector3) => boolean;
  sleepSeat?: { pos: THREE.Vector3; yaw: number; wakeRadius: number };
  watchesTv?: boolean;
  lines: HumanLines;
}

/** Everything a human needs to know about the level. */
export interface HumanEnv {
  world: RAPIER.World;
  nav: NavGraph;
  player: CookieController;
  isHidden(p: THREE.Vector3): boolean;
  tvOn(): boolean;
  tvSpot: { pos: THREE.Vector3; yaw: number };
  say(h: Human, text: string): void;
  onCatch(h: Human): void;
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export class Human {
  readonly model: HumanModel;
  readonly body: RAPIER.RigidBody;
  pos: THREE.Vector3;
  yaw: number;
  state: HumanState;
  stateT = 0;
  alert = 0; // 0..1 suspicion, 1 = chase
  bubble: { text: string; until: number } | null = null;
  seesCookie = false;

  private path: THREE.Vector3[] = [];
  private repathT = 0;
  private lastSeen = new THREE.Vector3();
  private lostT = 0;
  private investigate = new THREE.Vector3();
  private danceT = 0;
  private time = 0;
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  private sayCooldown = 0;

  constructor(readonly cfg: HumanConfig, private env: HumanEnv, scene: THREE.Scene) {
    this.model = new HumanModel(cfg.look);
    scene.add(this.model.root);
    this.pos = cfg.home.clone();
    this.yaw = cfg.homeYaw;
    this.state = cfg.sleepSeat ? 'sleep' : 'routine';
    const r = 0.22, half = cfg.look.height / 2 - r;
    this.body = env.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, half + r, this.pos.z));
    env.world.createCollider(RAPIER.ColliderDesc.capsule(half, r).setCollisionGroups(SEE_THROUGH_GROUPS), this.body);
  }

  get reachHeight() { return this.cfg.look.height + 0.45 + this.cfg.reachExtra; }
  get headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.cfg.look.height + 0.35, this.pos.z); }
  get calm() { return this.state === 'routine' || this.state === 'idle' || this.state === 'sleep' || this.state === 'tv' || this.state === 'return'; }

  reset() {
    this.pos.copy(this.cfg.home);
    this.yaw = this.cfg.homeYaw;
    this.alert = 0;
    this.path = [];
    this.bubble = null;
    this.set(this.cfg.sleepSeat ? 'sleep' : 'routine');
  }

  say(text: string, seconds = 2.2, force = false) {
    if (!force && this.sayCooldown > 0) return;
    this.sayCooldown = 1.5;
    this.bubble = { text, until: this.time + seconds };
    this.env.say(this, text);
  }

  /** A sound happened somewhere. Loud enough sounds wake sleepers and make people come look. */
  hear(p: THREE.Vector3, radius: number) {
    if (this.pos.distanceTo(p) > radius) return;
    if (this.state === 'sleep') {
      if (this.pos.distanceTo(p) > (this.cfg.sleepSeat?.wakeRadius ?? radius)) return;
      this.say(pick(this.cfg.lines.wake ?? this.cfg.lines.notice), 2, true);
    } else if (this.state === 'tv' || this.state === 'dance' || this.state === 'chase' || this.state === 'grab' || this.state === 'stumble') {
      return;
    } else {
      this.say(pick(this.cfg.lines.notice));
    }
    this.investigate.copy(p);
    this.alert = Math.max(this.alert, 0.35);
    this.set('suspicious');
  }

  startChase() {
    this.set('chase');
    this.alert = 1;
    this.say(pick(this.cfg.lines.chase), 2.2, true);
  }

  dance(seconds: number) {
    this.danceT = seconds;
    this.set('dance');
    this.bubble = { text: '✨', until: this.time + seconds };
  }

  private set(s: HumanState) {
    this.state = s;
    this.stateT = 0;
    this.path = [];
    this.repathT = 0;
  }

  private canSee(): boolean {
    const p = this.env.player;
    if (this.state === 'sleep' || this.state === 'dance') return false;
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + this.model.eyeHeight, this.pos.z);
    const c = p.position.clone().add(new THREE.Vector3(0, 0.12, 0));
    const to = c.clone().sub(eye);
    const dist = to.length();
    const watchingTv = this.state === 'tv';
    if (dist > (watchingTv ? 1.1 : this.cfg.sight)) return false;
    const horiz = Math.hypot(to.x, to.z);
    // They rarely look straight up
    if (Math.atan2(to.y, horiz) > (50 * Math.PI) / 180) return false;
    if (dist > 1.0) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const cos = (fx * to.x + fz * to.z) / Math.max(horiz, 1e-3);
      if (cos < Math.cos((65 * Math.PI) / 180)) return false;
    }
    if (this.env.isHidden(p.position)) return false;
    this.ray.origin = { x: eye.x, y: eye.y, z: eye.z };
    this.ray.dir = { x: to.x / dist, y: to.y / dist, z: to.z / dist };
    const hit = this.env.world.castRay(this.ray, dist + 0.2, true, undefined, CAMERA_RAY_GROUPS, undefined, this.body);
    return !!hit && hit.collider.handle === p.collider.handle;
  }

  private walkTo(target: THREE.Vector3, speed: number, dt: number, repathEvery = 0.6) {
    this.repathT -= dt;
    if (this.repathT <= 0 || this.path.length === 0) {
      this.path = this.env.nav.path(this.pos, target, this.env.player.body);
      this.repathT = repathEvery;
    }
    const next = this.path[0];
    if (!next) return true;
    const dx = next.x - this.pos.x, dz = next.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      this.path.shift();
      return this.path.length === 0;
    }
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.face(Math.atan2(dx, dz), dt, 8);
    return false;
  }

  private face(target: number, dt: number, k = 6) {
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-k * dt));
  }

  private faceCookie(dt: number) {
    const p = this.env.player.position;
    this.face(Math.atan2(p.x - this.pos.x, p.z - this.pos.z), dt, 8);
  }

  update(dt: number) {
    this.time += dt;
    this.stateT += dt;
    this.sayCooldown -= dt;
    if (this.bubble && this.time > this.bubble.until) this.bubble = null;

    const player = this.env.player;
    const see = this.canSee();
    this.seesCookie = see;
    const cookie = player.position;
    const dH = Math.hypot(cookie.x - this.pos.x, cookie.z - this.pos.z);
    const reachable = cookie.y < this.reachHeight;
    if (see) {
      this.lastSeen.copy(cookie);
      this.lostT = 0;
      this.alert = Math.min(1, this.alert + dt * this.cfg.notice / Math.max(dH, 0.8));
    } else {
      this.lostT += dt;
      if (this.state !== 'chase') this.alert = Math.max(0, this.alert - dt * 0.2);
    }

    let pose = 'walk' as Pose;
    let speed = 0;
    const startChase = () => this.startChase();

    switch (this.state) {
      case 'sleep': {
        const seat = this.cfg.sleepSeat!;
        this.pos.copy(seat.pos);
        this.yaw = seat.yaw;
        pose = 'sleep';
        if (!this.bubble || this.bubble.text === '💤') this.bubble = { text: '💤', until: this.time + 1 };
        break;
      }
      case 'routine': {
        if (this.cfg.watchesTv && this.env.tvOn()) { this.set('tv'); break; }
        if (this.alert > 0.3) { this.investigate.copy(this.lastSeen); this.say(pick(this.cfg.lines.notice)); this.set('suspicious'); break; }
        if (this.stateT === dt) this.investigate.copy(this.env.nav.randomNode(this.cfg.routineArea));
        const arrived = this.walkTo(this.investigate, this.cfg.walkSpeed, dt, 2);
        speed = this.cfg.walkSpeed;
        if (arrived) this.set('idle');
        break;
      }
      case 'idle': {
        pose = 'look';
        if (this.cfg.watchesTv && this.env.tvOn()) { this.set('tv'); break; }
        if (this.alert > 0.3) { this.investigate.copy(this.lastSeen); this.say(pick(this.cfg.lines.notice)); this.set('suspicious'); break; }
        if (this.stateT > 3) this.set('routine');
        break;
      }
      case 'tv': {
        if (!this.env.tvOn()) { this.set('routine'); break; }
        const spot = this.env.tvSpot;
        if (this.pos.distanceTo(spot.pos) > 0.15) {
          this.walkTo(spot.pos, this.cfg.runSpeed * 0.7, dt);
          speed = this.cfg.runSpeed * 0.7;
          if (this.stateT < dt * 2) this.say(pick(this.cfg.lines.tv ?? ['📺']), 2, true);
        } else {
          this.face(spot.yaw, dt);
          pose = 'look';
        }
        // Only notices Cookie if he lands right next to them
        if (see && dH < 1.1) startChase();
        break;
      }
      case 'suspicious': {
        if (this.alert >= 1) { startChase(); break; }
        if (see) {
          this.faceCookie(dt);
          pose = 'look';
          if (!this.bubble) this.bubble = { text: '❓', until: this.time + 0.5 };
        } else {
          const arrived = this.walkTo(this.investigate, this.cfg.walkSpeed * 1.2, dt);
          speed = this.cfg.walkSpeed * 1.2;
          if (arrived) { pose = 'look'; speed = 0; }
          if (!this.bubble) this.bubble = { text: '❓', until: this.time + 0.5 };
          if (this.stateT > 6 && this.alert < 0.1) this.set('return');
        }
        break;
      }
      case 'chase': {
        if (this.lostT > 3.5) { this.say(pick(this.cfg.lines.search)); this.set('search'); break; }
        const target = see ? cookie : this.lastSeen;
        if (dH < this.cfg.grabRange && reachable && see) { this.set('grab'); break; }
        if (dH < 1.0 && !reachable) {
          // Cookie is perched out of reach: stand underneath, look up, complain
          pose = 'reach';
          this.faceCookie(dt);
          if (this.stateT > 1) this.say(pick(this.cfg.lines.unreachable));
          if (this.stateT > 7) { this.set('search'); }
          break;
        }
        const arrived = this.walkTo(target, this.cfg.runSpeed, dt, 0.35);
        speed = this.cfg.runSpeed;
        if (arrived) { pose = 'look'; speed = 0; this.faceCookie(dt); }
        if (!this.bubble) this.bubble = { text: '❗', until: this.time + 0.5 };
        break;
      }
      case 'grab': {
        pose = 'reach';
        this.faceCookie(dt);
        if (this.stateT > 0.45) {
          if (dH < this.cfg.grabRange + 0.15 && reachable && this.canSee()) {
            this.env.onCatch(this);
            this.set('idle');
          } else {
            this.say(pick(this.cfg.lines.miss), 1.6, true);
            this.set('stumble');
          }
        }
        break;
      }
      case 'stumble': {
        pose = 'stumble';
        if (this.stateT > 1.0) this.set(see ? 'chase' : 'search');
        break;
      }
      case 'search': {
        pose = 'look';
        if (see && this.alert > 0.6) { startChase(); break; }
        if (this.stateT > 3.5) { this.alert = Math.min(this.alert, 0.2); this.set('return'); }
        break;
      }
      case 'return': {
        if (this.alert > 0.4) { this.investigate.copy(this.lastSeen); this.set('suspicious'); break; }
        const arrived = this.walkTo(this.cfg.home, this.cfg.walkSpeed, dt, 1);
        speed = this.cfg.walkSpeed;
        if (arrived) this.set(this.cfg.sleepSeat ? 'sleep' : 'routine');
        break;
      }
      case 'dance': {
        pose = 'dance';
        this.danceT -= dt;
        this.alert = 0;
        if (this.danceT <= 0) this.set('search');
        break;
      }
      case 'wait':
        pose = 'look';
        break;
    }

    // Place the visual and the physics body
    const sitting = pose === 'sleep' || pose === 'sit';
    const sitY = sitting ? 0.45 - 0.85 * (this.cfg.look.height / 1.7) + 0.05 : 0;
    this.model.root.position.set(this.pos.x, this.pos.y + sitY, this.pos.z);
    this.model.root.rotation.y = this.yaw;
    this.model.update(dt, pose, speed, this.stateT);
    const r = 0.22, half = this.cfg.look.height / 2 - r;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y + half + r + (sitting ? 10 : 0), z: this.pos.z });
  }
}
