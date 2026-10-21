import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Actions } from '../core/input';
import type { CookieVisual } from './cookieModel';

const RADIUS = 0.075;
const HALF_HEIGHT = 0.05; // capsule total height = 2 * (HALF_HEIGHT + RADIUS) = 0.25
const CENTER_OFFSET = HALF_HEIGHT + RADIUS;

export const TUNING = {
  walkSpeed: 1.1,
  flySpeed: 3.0,
  groundAccel: 14,
  airAccel: 5,
  hopSpeed: 2.3,
  flapSpeed: 2.1,
  maxRise: 2.8,
  gravity: 9,
  fallCap: 2.6, // normal max fall speed (birds drift down)
  glideFallCap: 0.55, // while holding flap
  diveFallCap: 5,
  flapCost: 9,
  hopCost: 3,
  staminaMax: 100,
  staminaRegen: 35, // per second while perched
};

export interface ControllerEvents {
  onFlap(): void;
  onTired(): void;
}

export class CookieController {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  vel = new THREE.Vector3();
  facing = 0;
  stamina = TUNING.staminaMax;
  grounded = false;
  gliding = false;

  /** Position for rendering (interpolated between physics steps). */
  readonly renderPos = new THREE.Vector3();
  private prevPos = new THREE.Vector3();
  private currPos = new THREE.Vector3();

  private kcc: RAPIER.KinematicCharacterController;
  private pending = { flap: false };
  private tiredCooldown = 0;
  private turnRate = 0; // rad/s, smoothed
  /** Something in the beak makes flapping weaker. */
  carrying = false;

  constructor(world: RAPIER.World, public visual: CookieVisual, spawn: THREE.Vector3, yaw: number, private events: ControllerEvents) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + CENTER_OFFSET, spawn.z),
    );
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);
    this.kcc = world.createCharacterController(0.004);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.kcc.enableAutostep(0.05, 0.04, true);
    this.kcc.enableSnapToGround(0.03);
    this.kcc.setApplyImpulsesToDynamicBodies(false);
    this.facing = yaw;
    this.currPos.copy(spawn);
    this.prevPos.copy(spawn);
    this.renderPos.copy(spawn);
  }

  /** Feet position. */
  get position() { return this.currPos; }

  respawn(p: THREE.Vector3, yaw: number) {
    this.body.setTranslation({ x: p.x, y: p.y + CENTER_OFFSET, z: p.z }, true);
    this.vel.set(0, 0, 0);
    this.facing = yaw;
    this.currPos.copy(p);
    this.prevPos.copy(p);
  }

  /** Call once per rendered frame with fresh input; edge-triggered actions are latched. */
  queue(a: Actions) {
    if (a.flapPressed) this.pending.flap = true;
  }

  fixedUpdate(dt: number, a: Actions, camYaw: number) {
    this.prevPos.copy(this.currPos);
    this.tiredCooldown -= dt;

    // Desired horizontal direction relative to camera
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const wishX = fx * a.moveY - fz * a.moveX;
    const wishZ = fz * a.moveY + fx * a.moveX;
    const maxSpeed = this.grounded ? TUNING.walkSpeed : TUNING.flySpeed;
    const accel = this.grounded ? TUNING.groundAccel : TUNING.airAccel;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wishX * maxSpeed - this.vel.x) * k;
    this.vel.z += (wishZ * maxSpeed - this.vel.z) * k;

    // Flap / hop
    if (this.pending.flap) {
      this.pending.flap = false;
      const cost = this.grounded ? TUNING.hopCost : TUNING.flapCost;
      if (this.stamina >= cost) {
        this.stamina -= cost;
        if (this.grounded) this.vel.y = TUNING.hopSpeed;
        else this.vel.y = Math.min(Math.max(this.vel.y, 0) + TUNING.flapSpeed * (this.carrying ? 0.8 : 1), TUNING.maxRise);
        this.grounded = false;
        this.visual.flap();
        this.events.onFlap();
      } else if (this.tiredCooldown <= 0) {
        this.tiredCooldown = 2;
        this.events.onTired();
      }
    }

    // Gravity and fall caps
    this.gliding = !this.grounded && a.flapHeld && this.vel.y < 0;
    if (!this.grounded) {
      this.vel.y -= TUNING.gravity * (a.descend ? 1.6 : 1) * dt;
      const cap = a.descend ? TUNING.diveFallCap : this.gliding ? TUNING.glideFallCap : TUNING.fallCap;
      if (this.vel.y < -cap) this.vel.y = THREE.MathUtils.lerp(this.vel.y, -cap, 1 - Math.exp(-10 * dt));
    } else {
      this.vel.y = -0.5; // keep contact with the ground
      this.stamina = Math.min(TUNING.staminaMax, this.stamina + TUNING.staminaRegen * dt);
    }

    // Move with collision
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.kcc.computeColliderMovement(this.collider, desired);
    const mv = this.kcc.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z });

    this.grounded = this.kcc.computedGrounded() && this.vel.y <= 0.01;
    // Lose velocity into walls and ceilings
    if (Math.abs(desired.x) > 1e-6 && Math.abs(mv.x) < Math.abs(desired.x) * 0.5) this.vel.x = mv.x / dt;
    if (Math.abs(desired.z) > 1e-6 && Math.abs(mv.z) < Math.abs(desired.z) * 0.5) this.vel.z = mv.z / dt;
    if (desired.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0;

    this.currPos.set(t.x + mv.x, t.y + mv.y - CENTER_OFFSET, t.z + mv.z);

    // Face the direction of travel
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.08) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const step = d * (1 - Math.exp(-12 * dt));
      this.facing += step;
      this.turnRate += (step / dt - this.turnRate) * (1 - Math.exp(-10 * dt));
    } else {
      this.turnRate *= Math.exp(-10 * dt);
    }
  }

  /** Interpolate the visual between physics steps. */
  render(alpha: number, dt: number, scared: number) {
    this.renderPos.lerpVectors(this.prevPos, this.currPos, alpha);
    this.visual.root.position.copy(this.renderPos);
    this.visual.root.rotation.y = this.facing;
    // Bank into turns while flying: turning left (positive yaw rate) dips the left wing
    const bank = this.grounded ? 0 : THREE.MathUtils.clamp(-this.turnRate * 0.28, -0.75, 0.75);
    this.visual.update(dt, {
      bank,
      grounded: this.grounded,
      speed: Math.hypot(this.vel.x, this.vel.z),
      vy: this.vel.y,
      gliding: this.gliding,
      scared,
    });
  }
}
