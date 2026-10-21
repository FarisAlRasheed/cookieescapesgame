import * as THREE from 'three';

// Soft, cartoony humans built from rounded shapes. Feet at the origin, facing +Z.

export interface HumanLook {
  height: number;
  skin: number;
  top: number; // shirt / thobe / dress colour
  bottom: number; // trousers or dress hem
  hair: number;
  headscarf?: number;
  longDress?: boolean;
  belly?: number; // extra roundness
  mustache?: boolean;
  net?: boolean;
}

export type Pose = 'walk' | 'reach' | 'sleep' | 'dance' | 'stumble' | 'sit' | 'look';

function m(color: number, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function part(geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D, pos: [number, number, number], rough = 0.85) {
  const mesh = new THREE.Mesh(geo, m(color, rough));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export class HumanModel {
  root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private t = Math.random() * 10;
  readonly eyeHeight: number;

  constructor(look: HumanLook) {
    const s = look.height / 1.7; // everything is designed for a 1.7 m adult
    this.root.add(this.body);
    this.body.scale.setScalar(s);
    this.eyeHeight = 1.56 * s;
    const B = this.body;

    // Legs (pivot at the hip)
    const hipY = 0.85;
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.1, hipY, 0);
      B.add(leg);
      if (!look.longDress) part(new THREE.CapsuleGeometry(0.075, 0.62, 4, 10), look.bottom, leg, [0, -0.4, 0]);
      part(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), 0x5b4a40, leg, [0, -0.8, 0.06]).rotation.x = Math.PI / 2;
    }

    // Torso
    const torsoGeo = new THREE.CapsuleGeometry(0.2 + (look.belly ?? 0), 0.42, 6, 16);
    const torso = part(torsoGeo, look.top, B, [0, 1.15, 0]);
    torso.scale.z = 0.8;
    if (look.longDress) {
      // Long thobe / dress flaring to the ankles
      part(new THREE.CylinderGeometry(0.22 + (look.belly ?? 0), 0.32, 0.85, 20), look.bottom, B, [0, 0.5, 0]);
    }

    // Arms (pivot at the shoulder)
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(side * (0.27 + (look.belly ?? 0) * 0.8), 1.42, 0);
      B.add(arm);
      part(new THREE.CapsuleGeometry(0.06, 0.5, 4, 10), look.top, arm, [0, -0.3, 0]);
      part(new THREE.SphereGeometry(0.065, 12, 10), look.skin, arm, [0, -0.62, 0]);
    }
    if (look.net) {
      const net = new THREE.Group();
      net.position.set(0, -0.62, 0.05);
      this.armR.add(net);
      const pole = part(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), 0xf2b134, net, [0, 0, 0.4]);
      pole.rotation.x = Math.PI / 2;
      const ring = part(new THREE.TorusGeometry(0.16, 0.012, 6, 20), 0xe85d4a, net, [0, 0, 0.95]);
      ring.rotation.x = Math.PI / 2;
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true }));
      mesh.position.set(0, -0.12, 0.95);
      mesh.rotation.x = Math.PI;
      net.add(mesh);
    }

    // Head
    this.head.position.set(0, 1.66, 0);
    B.add(this.head);
    part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), look.skin, B, [0, 1.58, 0]);
    const skull = part(new THREE.SphereGeometry(0.16, 20, 16), look.skin, this.head, [0, 0.03, 0]);
    skull.scale.set(1, 1.1, 1);
    if (look.headscarf) {
      const scarf = part(new THREE.SphereGeometry(0.185, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), look.headscarf, this.head, [0, 0.05, -0.02]);
      scarf.rotation.x = -0.35;
      part(new THREE.CylinderGeometry(0.15, 0.24, 0.22, 20), look.headscarf, this.head, [0, -0.13, -0.02]);
    } else {
      const hair = part(new THREE.SphereGeometry(0.168, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), look.hair, this.head, [0, 0.05, -0.015]);
      hair.rotation.x = -0.25;
    }
    for (const side of [-1, 1]) {
      part(new THREE.SphereGeometry(0.022, 10, 8), 0x2a211c, this.head, [side * 0.06, 0.06, 0.145]);
      part(new THREE.SphereGeometry(0.008, 6, 6), 0xffffff, this.head, [side * 0.065, 0.068, 0.164]);
      const cheek = part(new THREE.SphereGeometry(0.03, 10, 8), 0xf2a08a, this.head, [side * 0.1, -0.01, 0.12]);
      cheek.scale.z = 0.4;
    }
    part(new THREE.SphereGeometry(0.03, 10, 8), look.skin, this.head, [0, 0.0, 0.17]);
    const smile = part(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), 0x8a4a3a, this.head, [0, -0.05, 0.15]);
    smile.rotation.z = Math.PI;
    if (look.mustache) {
      const mus = part(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), look.hair, this.head, [0, -0.03, 0.16]);
      mus.rotation.z = Math.PI / 2;
    }
  }

  update(dt: number, pose: Pose, speed: number, poseT: number) {
    this.t += dt;
    const lerp = (o: THREE.Object3D, axis: 'x' | 'y' | 'z', v: number, k = 10) => {
      o.rotation[axis] = THREE.MathUtils.damp(o.rotation[axis], v, k, dt);
    };
    let legSwing = 0, armL = 0, armR = 0, armSpreadL = 0.08, armSpreadR = -0.08, headX = 0, headZ = 0, bodyX = 0, bodyY = 0, bodyZ = 0;
    let lift = 0;

    if (pose === 'walk') {
      const phase = this.t * (4 + speed * 3.5);
      legSwing = Math.sin(phase) * Math.min(speed * 0.45, 0.7);
      armL = -legSwing * 0.9;
      armR = legSwing * 0.9;
      lift = Math.abs(Math.cos(phase)) * Math.min(speed, 2) * 0.02;
      bodyX = Math.min(speed * 0.06, 0.15);
    } else if (pose === 'reach') {
      armL = armR = -2.8; // arms up high
      armSpreadL = 0.25; armSpreadR = -0.25;
      headX = -0.5;
      lift = Math.min(poseT * 0.4, 0.06);
    } else if (pose === 'look') {
      headX = -0.6 + Math.sin(this.t * 1.5) * 0.15;
      bodyY = Math.sin(this.t * 0.9) * 0.6;
      armL = armR = -0.3;
    } else if (pose === 'sleep' || pose === 'sit') {
      legSwing = 0;
      headX = pose === 'sleep' ? 0.5 : 0;
      headZ = pose === 'sleep' ? 0.3 : 0;
      armSpreadL = 0.3; armSpreadR = -0.3;
      bodyX = -0.25;
      lift = Math.sin(this.t * 1.4) * 0.006;
    } else if (pose === 'dance') {
      const b = this.t * 9;
      armL = -2.4 + Math.sin(b) * 0.6;
      armR = -2.4 - Math.sin(b) * 0.6;
      bodyZ = Math.sin(b * 0.5) * 0.25;
      bodyY = Math.sin(b * 0.25) * 0.8;
      lift = Math.abs(Math.sin(b)) * 0.05;
      legSwing = Math.sin(b) * 0.3;
    } else if (pose === 'stumble') {
      bodyX = 0.5 * Math.sin(Math.min(poseT, 0.8) * Math.PI / 0.8);
      armL = -1.6; armR = -1.2;
      armSpreadL = 0.9; armSpreadR = -0.9;
      headZ = Math.sin(this.t * 14) * 0.2;
    }

    const sitting = pose === 'sit' || pose === 'sleep';
    lerp(this.legL, 'x', sitting ? -1.45 : legSwing, 14);
    lerp(this.legR, 'x', sitting ? -1.45 : -legSwing, 14);
    lerp(this.armL, 'x', armL, 12);
    lerp(this.armR, 'x', armR, 12);
    lerp(this.armL, 'z', -armSpreadL, 12);
    lerp(this.armR, 'z', -armSpreadR, 12);
    lerp(this.head, 'x', headX, 6);
    lerp(this.head, 'z', headZ, 6);
    lerp(this.body, 'x', bodyX, 8);
    lerp(this.body, 'z', bodyZ, 8);
    lerp(this.head, 'y', bodyY, 4);
    this.body.position.y = THREE.MathUtils.damp(this.body.position.y, lift, 12, dt);
  }
}
