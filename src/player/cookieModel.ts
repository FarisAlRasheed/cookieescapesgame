import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Cookie's visual. Uses public/models/cookie.glb when it exists,
// otherwise a hand-built placeholder in Cookie's real colours.

export interface PoseState {
  grounded: boolean;
  speed: number; // horizontal speed m/s
  vy: number;
  gliding: boolean;
  scared: number; // 0..1 → crest height
  bank: number; // roll in radians, negative = left wing down
}

const COLORS = {
  body: 0x8d8c90,
  belly: 0x9e9da1,
  wing: 0x5d5d63,
  wingPatch: 0xf4f2ec,
  face: 0xf6d64a,
  cheek: 0xf06a2c,
  crest: 0xf3d257,
  crestTip: 0x8e8a7a,
  beak: 0x8a8580,
  eye: 0x111111,
  feet: 0xd99a90,
  tail: 0x56565c,
};

const COOKIE_HEIGHT = 0.36; // meters, crest included

export interface CookieVisual {
  root: THREE.Group;
  /** Attach carried objects here. */
  beakAnchor: THREE.Object3D;
  update(dt: number, s: PoseState): void;
  flap(): void;
  peck(): void;
  whistle(): void;
}

export async function createCookie(): Promise<CookieVisual> {
  try {
    const gltf = await new GLTFLoader().loadAsync('/models/cookie.glb');
    return new GltfCookie(gltf.scene, gltf.animations);
  } catch {
    return new ProceduralCookie();
  }
}

function mat(color: number, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function sphere(r: number, color: number, scale: [number, number, number] = [1, 1, 1], seg = 24) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat(color));
  m.scale.set(...scale);
  m.castShadow = true;
  return m;
}

class ProceduralCookie implements CookieVisual {
  root = new THREE.Group();
  private bodyPivot = new THREE.Group();
  private head = new THREE.Group();
  private crest = new THREE.Group();
  private wings: { flap: THREE.Group; sweep: THREE.Group; roll: THREE.Group; side: number }[] = [];
  private spread = 0;
  private legs = new THREE.Group();
  private tuck = 0;
  private bank = 0;
  beakAnchor = new THREE.Object3D();
  private tail = new THREE.Group();
  private beakLower!: THREE.Mesh;

  private t = 0;
  private flapT = 1; // 0..1 progress of a wing beat
  private peckT = 1;
  private whistleT = 1;
  private crestAngle = -0.9;
  private lean = 0;

  constructor() {
    const R = this.root;
    R.add(this.bodyPivot);
    const B = this.bodyPivot;
    B.position.y = 0.05;

    // Body: upright-ish teardrop
    const body = sphere(0.068, COLORS.body, [1, 1.3, 1.05]);
    body.position.set(0, 0.075, 0);
    body.rotation.x = 0.28;
    B.add(body);
    const belly = sphere(0.058, COLORS.belly, [0.95, 1.2, 0.9]);
    belly.position.set(0, 0.065, 0.02);
    belly.rotation.x = 0.28;
    B.add(belly);

    // Head
    this.head.position.set(0, 0.185, 0.03);
    B.add(this.head);
    this.head.add(sphere(0.05, COLORS.body));
    const face = sphere(0.048, COLORS.face, [1, 1, 0.95]);
    face.position.set(0, 0.004, 0.012);
    this.head.add(face);
    for (const side of [-1, 1]) {
      const cheek = sphere(0.017, COLORS.cheek, [0.45, 1, 1.05], 16);
      cheek.position.set(side * 0.04, -0.012, 0.022);
      cheek.rotation.y = side * 0.5;
      this.head.add(cheek);
      const eye = sphere(0.0085, COLORS.eye, [1, 1, 1], 12);
      eye.position.set(side * 0.034, 0.012, 0.03);
      this.head.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(side * 0.038, 0.016, 0.035);
      this.head.add(shine);
    }
    // Beak: hooked upper + small lower
    const beakUpper = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.032, 12), mat(COLORS.beak, 0.5));
    beakUpper.position.set(0, -0.006, 0.054);
    beakUpper.rotation.x = Math.PI / 2 + 0.55;
    beakUpper.castShadow = true;
    this.head.add(beakUpper);
    this.beakLower = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.018, 10), mat(0x9c958f, 0.5));
    this.beakLower.position.set(0, -0.018, 0.047);
    this.beakLower.rotation.x = Math.PI / 2 + 0.2;
    this.head.add(this.beakLower);

    // Crest: fan of feathers that rises when excited
    this.crest.position.set(0, 0.035, 0.012);
    this.head.add(this.crest);
    const feathers = [
      { len: 0.095, x: 0, tilt: 0 },
      { len: 0.085, x: 0.006, tilt: 0.12 },
      { len: 0.085, x: -0.006, tilt: 0.12 },
      { len: 0.075, x: 0.01, tilt: 0.24 },
      { len: 0.075, x: -0.01, tilt: 0.24 },
      { len: 0.065, x: 0.004, tilt: -0.14 },
      { len: 0.06, x: -0.004, tilt: 0.36 },
    ];
    for (const f of feathers) {
      const pivot = new THREE.Group();
      pivot.position.x = f.x;
      pivot.rotation.x = -f.tilt;
      pivot.rotation.z = -f.x * 6;
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.0055, f.len, 6), mat(COLORS.crest));
      shaft.position.y = f.len / 2;
      shaft.castShadow = true;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0032, f.len * 0.35, 6), mat(COLORS.crestTip));
      tip.position.y = f.len * 0.92;
      pivot.add(shaft, tip);
      this.crest.add(pivot);
    }

    // Wings: shoulder (flap) → sweep (fold/spread) → roll (lay flat when spread)
    for (const side of [-1, 1]) {
      const flap = new THREE.Group();
      flap.position.set(side * 0.047, 0.135, 0.01);
      const sweep = new THREE.Group();
      const roll = new THREE.Group();
      flap.add(sweep);
      sweep.add(roll);
      B.add(flap);
      const w = sphere(0.06, COLORS.wing, [0.22, 0.55, 1.6]);
      w.position.set(0, -0.02, -0.065);
      roll.add(w);
      const patch = sphere(0.03, COLORS.wingPatch, [0.2, 0.45, 1.3], 16);
      patch.position.set(side * 0.008, -0.012, -0.04);
      roll.add(patch);
      this.wings.push({ flap, sweep, roll, side });
    }

    // Long tail
    this.tail.position.set(0, 0.035, -0.055);
    B.add(this.tail);
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.004, 0.17, 8), mat(COLORS.tail));
    tailMesh.scale.z = 0.45;
    tailMesh.position.y = -0.085;
    tailMesh.castShadow = true;
    this.tail.add(tailMesh);
    this.tail.rotation.x = 1.2;

    // Legs + feet, pivoting at the hip so they can tuck up in flight
    this.legs.position.set(0, 0.05, 0.008);
    R.add(this.legs);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6), mat(COLORS.feet));
      leg.position.set(side * 0.022, -0.025, 0);
      this.legs.add(leg);
      for (const a of [-0.5, 0, 0.5]) {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.018, 2, 6), mat(COLORS.feet));
        toe.rotation.x = Math.PI / 2;
        toe.rotation.z = a;
        toe.position.set(side * 0.022 + Math.sin(a) * 0.012, -0.047, 0.004 + Math.cos(a) * 0.008);
        this.legs.add(toe);
      }
    }

    // Where carried items sit (tip of the beak)
    this.beakAnchor.position.set(0, -0.02, 0.07);
    this.head.add(this.beakAnchor);
  }

  flap() { this.flapT = 0; }
  peck() { this.peckT = 0; }
  whistle() { this.whistleT = 0; }

  update(dt: number, s: PoseState) {
    this.t += dt;
    const airborne = !s.grounded;

    // Body lean forward when moving/flying
    const targetLean = airborne ? 0.55 : Math.min(s.speed * 0.25, 0.25);
    this.lean = THREE.MathUtils.damp(this.lean, targetLean, 8, dt);
    this.bodyPivot.rotation.x = this.lean;

    // Idle breathing + walking hop
    const hop = s.grounded && s.speed > 0.1 ? Math.abs(Math.sin(this.t * 14)) * 0.012 : 0;
    this.bodyPivot.position.y = 0.05 + Math.sin(this.t * 2.2) * 0.0015 + hop;

    // Wings
    this.flapT = Math.min(1, this.flapT + dt * 4.5);
    const beating = this.flapT < 1;
    const spreadTarget = airborne ? 1 : beating ? Math.sin(this.flapT * Math.PI) : 0;
    this.spread = THREE.MathUtils.damp(this.spread, spreadTarget, 12, dt);
    let beat = 0;
    if (beating) beat = Math.sin(this.flapT * Math.PI * 2) * (airborne ? 0.9 : 0.5);
    else if (airborne) beat = s.gliding ? Math.sin(this.t * 5) * 0.06 : Math.sin(this.t * 16) * 0.35;
    const sp = this.spread;
    for (const w of this.wings) {
      w.sweep.rotation.y = THREE.MathUtils.lerp(w.side * 0.1, -w.side * 1.45, sp);
      w.sweep.rotation.x = THREE.MathUtils.lerp(-0.4, 0, sp);
      w.roll.rotation.z = THREE.MathUtils.lerp(0, (w.side * Math.PI) / 2, sp);
      w.flap.rotation.z = w.side * (beat + 0.15) * sp;
    }

    // Head: peck dip, curious idle tilt
    this.peckT = Math.min(1, this.peckT + dt * 4);
    const dip = this.peckT < 1 ? Math.sin(this.peckT * Math.PI) : 0;
    this.head.rotation.x = dip * 0.9 - this.lean * 0.6;
    this.head.position.z = 0.03 + dip * 0.02;
    this.head.rotation.z = s.grounded && s.speed < 0.05 ? Math.sin(this.t * 0.7) * 0.18 : 0;
    this.head.rotation.y = s.grounded && s.speed < 0.05 ? Math.sin(this.t * 0.45) * 0.3 : 0;

    // Beak opens while whistling
    this.whistleT = Math.min(1, this.whistleT + dt * 1.2);
    const open = this.whistleT < 1 ? 0.25 + Math.sin(this.t * 30) * 0.08 : 0;
    this.beakLower.rotation.x = Math.PI / 2 + 0.2 + open;

    // Crest: flat when calm, up when excited/flying/whistling
    const excite = Math.max(s.scared, airborne ? 0.7 : 0, this.whistleT < 1 ? 1 : 0);
    const crestTarget = THREE.MathUtils.lerp(-1.0, -0.12, excite);
    this.crestAngle = THREE.MathUtils.damp(this.crestAngle, crestTarget, 6, dt);
    this.crest.rotation.x = this.crestAngle + Math.sin(this.t * 3) * 0.03;

    // Legs tuck back against the belly in flight
    this.tuck = THREE.MathUtils.damp(this.tuck, airborne ? 1 : 0, 9, dt);
    this.legs.rotation.x = this.tuck * 1.35;
    this.legs.position.y = 0.05 + this.tuck * 0.035;
    this.legs.position.z = 0.008 - this.tuck * 0.015;

    // Roll into turns (root yaw is set by the controller; we roll the body pivot)
    this.bank = THREE.MathUtils.damp(this.bank, s.bank, 6, dt);
    this.bodyPivot.rotation.z = this.bank;
    this.legs.rotation.z = this.bank;

    // Tail lifts a bit in flight
    this.tail.rotation.x = THREE.MathUtils.damp(this.tail.rotation.x, airborne ? 1.45 : 1.2, 6, dt);
  }
}

class GltfCookie implements CookieVisual {
  root = new THREE.Group();
  private holder = new THREE.Group();
  beakAnchor = new THREE.Object3D();
  private mixer: THREE.AnimationMixer | null = null;
  private t = 0;
  private hopT = 1;

  constructor(scene: THREE.Object3D, clips: THREE.AnimationClip[]) {
    // Normalise size and put feet on the origin.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = COOKIE_HEIGHT / Math.max(size.y, 1e-6);
    scene.scale.setScalar(scale);
    box.setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    this.holder.add(scene);
    this.root.add(this.holder);
    this.beakAnchor.position.set(0, COOKIE_HEIGHT * 0.65, 0.09);
    this.holder.add(this.beakAnchor);
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(scene);
      this.mixer.clipAction(clips[0]).play();
    }
  }

  flap() { this.hopT = 0; }
  peck() { this.hopT = 0; }
  whistle() {}

  update(dt: number, s: PoseState) {
    this.t += dt;
    this.mixer?.update(dt);
    this.hopT = Math.min(1, this.hopT + dt * 4);
    const bob = this.hopT < 1 ? Math.sin(this.hopT * Math.PI) * 0.02 : 0;
    this.holder.position.y = bob + (s.grounded && s.speed > 0.1 ? Math.abs(Math.sin(this.t * 14)) * 0.01 : 0);
    this.holder.rotation.x = THREE.MathUtils.damp(this.holder.rotation.x, s.grounded ? 0 : 0.35, 8, dt);
    this.holder.rotation.z = THREE.MathUtils.damp(this.holder.rotation.z, s.bank, 6, dt);
  }
}
