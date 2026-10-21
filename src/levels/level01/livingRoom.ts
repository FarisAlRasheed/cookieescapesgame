import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Builder, mat, softNoiseTexture, woodTexture } from '../../core/builder';
import { PALETTE, ROOM_H as H, WALL_T as T, addPlant, curtain, dustMotes, frame, pottedPlant, rug, skyBackdrop, wall } from '../props';

// Living room: x 2.5..9.5, z -3..3. The escape window is in the north wall (z = -3).
export const LIV = { X0: 2.5, X1: 9.5, Z0: -3, Z1: 3 };
export const WIN = { x: 6.8, w: 1.2, bottom: 0.95, top: 2.15, z: LIV.Z0 - T / 2 };

export interface LivingRoomParts {
  pane: THREE.Group; // pivots at its west hinge, swings outward
  paneCollider: RAPIER.Collider;
  latch: THREE.Group;
  latchPos: THREE.Vector3;
  remotePos: THREE.Vector3;
  radioPos: THREE.Vector3;
  fan: THREE.Group;
  isTvOn(): boolean;
  toggleTv(): void;
  update(dt: number, time: number): void;
}

export function buildLivingRoom(b: Builder, brass: THREE.Material): LivingRoomParts {
  const { X0, X1, Z0, Z1 } = LIV;
  const W = X1 - X0, D = Z1 - Z0;
  const cx = (X0 + X1) / 2;
  const { scene } = b;

  const floorMat = mat(0xffffff, 0.7, { map: woodTexture('#d2a679', [4, 3]) });
  const wallMat = mat(0xffffff, 0.95, { map: softNoiseTexture(PALETTE.wallLiving, 8, [4, 2]) });
  const trimMat = mat(PALETTE.trim, 0.6);
  const woodMat = mat(0xffffff, 0.6, { map: woodTexture('#a8774e', [1, 1]) });
  const woodDarkMat = mat(PALETTE.woodDark, 0.6);
  const sofaMat = mat(0xd9c3a5, 1);
  const cushionMat = mat(0x9cbf9a, 1);

  b.box([W, 0.1, D], [cx, -0.05, 0], floorMat, { cast: false });
  b.box([W, 0.1, D], [cx, H + 0.05, 0], mat(0xfbf5ec, 1), { cast: false });
  wall(b, 'x', WIN.z, X0, X1 + T, [{ center: WIN.x, width: WIN.w, bottom: WIN.bottom, top: WIN.top }], wallMat);
  wall(b, 'x', Z1 + T / 2, X0, X1 + T, [], wallMat);
  wall(b, 'z', X1 + T / 2, Z0, Z1, [], wallMat);
  b.box([W - 0.12, 0.1, 0.02], [cx + 0.06, 0.05, Z0 + 0.01], trimMat, { collider: false, cast: false });
  b.box([W - 0.12, 0.1, 0.02], [cx + 0.06, 0.05, Z1 - 0.01], trimMat, { collider: false, cast: false });

  // ---------- Escape window: pane hinged on the west side, opens outward ----------
  const paneH = WIN.top - WIN.bottom;
  const hingeX = WIN.x - WIN.w / 2;
  const pane = new THREE.Group();
  pane.position.set(hingeX, WIN.bottom, WIN.z);
  scene.add(pane);
  // Plain transparent glass: physical 'transmission' glass re-renders the whole scene every frame
  const glass = new THREE.MeshStandardMaterial({ color: 0xdff1ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false });
  const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(WIN.w - 0.08, paneH - 0.08, 0.015), glass);
  glassMesh.position.set(WIN.w / 2, paneH / 2, 0);
  pane.add(glassMesh);
  for (const [sx, sy, px, py] of [
    [WIN.w, 0.05, WIN.w / 2, 0.025], [WIN.w, 0.05, WIN.w / 2, paneH - 0.025],
    [0.05, paneH, 0.025, paneH / 2], [0.05, paneH, WIN.w - 0.025, paneH / 2], [0.03, paneH, WIN.w / 2, paneH / 2],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.04), trimMat);
    bar.position.set(px, py, 0);
    bar.castShadow = true;
    pane.add(bar);
  }
  const paneCollider = b.collider([WIN.w, paneH, 0.05], [WIN.x, WIN.bottom + paneH / 2, WIN.z]);
  // Latch on the inside of the pane, near the free (east) edge
  const latch = new THREE.Group();
  latch.position.set(WIN.w - 0.08, 0.12, 0.035);
  pane.add(latch);
  const latchBase = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.02), brass);
  const latchLever = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.09, 0.018), brass);
  latchLever.position.set(0, -0.03, 0.02);
  latch.add(latchBase, latchLever);
  const latchPos = new THREE.Vector3(hingeX + WIN.w - 0.08, WIN.bottom + 0.12, WIN.z + 0.05);
  // Inside ledge to perch on, outside sill
  b.box([WIN.w + 0.2, 0.04, 0.24], [WIN.x, WIN.bottom - 0.02, Z0 + 0.12], trimMat);
  b.box([WIN.w + 0.1, 0.04, 0.12], [WIN.x, WIN.bottom - 0.02, Z0 - T - 0.04], trimMat);
  for (const side of [-1, 1]) curtain(b, WIN.x + side * (WIN.w / 2 + 0.14), WIN.bottom + 0.6, Z0 + 0.08, 0, 0xc9d9c4);
  b.cylinder(0.012, 0.012, WIN.w + 1.0, [WIN.x, WIN.top + 0.12, Z0 + 0.08], brass, false, 8).rotation.z = Math.PI / 2;
  // Outside: garden, tree and sky
  skyBackdrop(b, [WIN.x, 2, Z0 - 7], 0, 22, 12);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), mat(0x9cc27f, 1));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(WIN.x, -0.02, Z0 - 4.2);
  grass.receiveShadow = true;
  scene.add(grass);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 10), mat(0x8a6446, 0.9));
  trunk.position.set(WIN.x + 2.2, 1.2, Z0 - 3.2);
  scene.add(trunk);
  for (const [dx, dy, r] of [[0, 2.7, 1.1], [-0.6, 2.3, 0.8], [0.7, 2.4, 0.85]]) {
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0x7fae6a, 1));
    leaves.position.set(WIN.x + 2.2 + dx, dy, Z0 - 3.2);
    scene.add(leaves);
  }

  // ---------- TV corner (east wall) ----------
  b.boxOn([0.45, 0.5, 1.9], X1 - 0.25, 0, 0, woodMat);
  b.box([0.02, 0.36, 0.85], [X1 - 0.475, 0.25, -0.45], woodDarkMat, { collider: false });
  b.box([0.02, 0.36, 0.85], [X1 - 0.475, 0.25, 0.45], woodDarkMat, { collider: false });
  b.boxOn([0.2, 0.04, 0.3], X1 - 0.25, 0.5, 0, mat(0x333333, 0.4));
  b.boxOn([0.06, 0.2, 0.06], X1 - 0.25, 0.54, 0, mat(0x333333, 0.4));
  b.box([0.06, 0.72, 1.28], [X1 - 0.25, 0.74 + 0.36, 0], mat(0x222222, 0.3));
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, emissive: new THREE.Color(0x000000) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.66), screenMat);
  screen.position.set(X1 - 0.285, 1.1, 0);
  screen.rotation.y = -Math.PI / 2;
  scene.add(screen);
  let tvOn = false;
  const tvLight = new THREE.PointLight(0x8fc6ff, 0, 3, 2);
  tvLight.position.set(X1 - 0.6, 1.1, 0);
  tvLight.userData.optional = true; // skipped on phones
  scene.add(tvLight);
  addPlant(b, X1 - 0.25, 0.5, 0.8, 0.5);

  // ---------- Sofa facing the TV + coffee table with the remote ----------
  const sofaX = 6.3;
  b.boxOn([0.9, 0.42, 2.2], sofaX, 0, 0, sofaMat);
  b.boxOn([0.22, 0.85, 2.2], sofaX - 0.34, 0, 0, sofaMat);
  for (const dz of [-1.1, 1.1]) b.boxOn([0.9, 0.6, 0.2], sofaX, 0, dz, sofaMat);
  for (const dz of [-0.5, 0.5]) b.boxOn([0.66, 0.12, 0.95], sofaX + 0.08, 0.42, dz, cushionMat);
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), mat(0xf0a77a, 1));
  pillow.scale.set(0.5, 1, 1);
  pillow.position.set(sofaX - 0.15, 0.72, 0.75);
  pillow.rotation.z = 0.3;
  pillow.castShadow = true;
  scene.add(pillow);
  const tableX = 7.6;
  b.boxOn([0.6, 0.05, 1.0], tableX, 0.37, 0, woodMat);
  for (const [lx, lz] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.45], [0.25, 0.45]]) b.boxOn([0.04, 0.37, 0.04], tableX + lx, 0, lz, woodDarkMat);
  const remotePos = new THREE.Vector3(tableX - 0.05, 0.43, -0.2);
  b.boxOn([0.05, 0.02, 0.16], remotePos.x, 0.42, remotePos.z, mat(0x3a3a3a, 0.5), { collider: false });
  b.cylinder(0.04, 0.035, 0.08, [tableX + 0.1, 0.46, 0.25], mat(0xf6efe4, 0.4));
  rug(b, 7.0, 0, 1.4, 1.1, 0xc9d9c4, 0xe9efe0);

  // ---------- Dining table near the window side ----------
  const dX = 4.2, dZ = -1.5;
  b.boxOn([1.4, 0.05, 0.9], dX, 0.72, dZ, woodMat);
  for (const [lx, lz] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) b.boxOn([0.05, 0.72, 0.05], dX + lx, 0, dZ + lz, woodDarkMat);
  for (const [cxo, czo, rot] of [[-0.35, -0.65, 0], [0.35, -0.65, 0], [-0.35, 0.65, Math.PI], [0.35, 0.65, Math.PI]]) {
    const chX = dX + cxo, chZ = dZ + czo;
    b.boxOn([0.42, 0.04, 0.42], chX, 0.45, chZ, woodMat);
    b.boxOn([0.42, 0.45, 0.04], chX, 0.49, chZ + (rot ? 0.19 : -0.19), woodMat);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.boxOn([0.035, 0.45, 0.035], chX + lx, 0, chZ + lz, woodDarkMat);
  }
  b.cylinder(0.12, 0.08, 0.05, [dX, 0.795, dZ], mat(0xe7c25c, 0.5));
  for (const [ox, color] of [[-0.04, 0xe85d4a], [0.05, 0xf2b134], [0, 0x8db48a]] as [number, number][]) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(color, 0.6));
    fruit.position.set(dX + ox, 0.85, dZ + ox * 0.5);
    fruit.castShadow = true;
    scene.add(fruit);
  }

  // Little talk radio on the dining table
  const radioPos = new THREE.Vector3(dX + 0.5, 0.77 + 0.07, dZ + 0.25);
  b.boxOn([0.22, 0.13, 0.09], radioPos.x, 0.77, radioPos.z, mat(0xd96f5a, 0.5));
  const grille = b.cylinder(0.04, 0.04, 0.01, [radioPos.x - 0.05, radioPos.y, radioPos.z + 0.046], mat(0x4a3a30, 0.8), false, 16);
  grille.rotation.x = Math.PI / 2;
  b.cylinder(0.012, 0.012, 0.01, [radioPos.x + 0.06, radioPos.y + 0.02, radioPos.z + 0.046], mat(0xf6efe4, 0.4), false, 10).rotation.x = Math.PI / 2;
  const antenna = b.cylinder(0.003, 0.003, 0.22, [radioPos.x + 0.08, radioPos.y + 0.15, radioPos.z - 0.02], mat(0xcccccc, 0.3, { metalness: 0.8 }), false, 6);
  antenna.rotation.z = -0.4;

  // ---------- Tall bookshelf (south wall) ----------
  const bsX = 3.7, bsZ = Z1 - 0.2;
  b.boxOn([1.1, 2.0, 0.36], bsX, 0, bsZ, woodMat);
  for (let row = 0; row < 4; row++) {
    const y = 0.15 + row * 0.47;
    b.box([1.0, 0.36, 0.01], [bsX, y + 0.18, bsZ - 0.181], woodDarkMat, { collider: false, cast: false });
    let x = bsX - 0.45;
    for (let i = 0; i < 9 && x < bsX + 0.42; i++) {
      const bw = 0.04 + ((i * 7 + row) % 3) * 0.02, bh = 0.24 + ((i + row) % 3) * 0.04;
      b.box([bw, bh, 0.02], [x + bw / 2, y + bh / 2, bsZ - 0.19], mat(PALETTE.books[(i + row) % PALETTE.books.length], 0.85), { collider: false, cast: false });
      x += bw + 0.01;
    }
  }
  b.cylinder(0.1, 0.08, 0.18, [bsX - 0.3, 2.09, bsZ], mat(0xd7896a, 0.8));
  addPlant(b, bsX - 0.3, 2.18, bsZ, 0.5);

  // ---------- Front door (locked, decorative) + floor lamp + plants ----------
  b.box([1.0, 2.1, 0.04], [5.6, 1.05, Z1 - 0.02], mat(0xb58b63, 0.6), { collider: false });
  b.cylinder(0.025, 0.025, 0.02, [5.95, 1.0, Z1 - 0.05], brass, false, 12).rotation.x = Math.PI / 2;
  b.cylinder(0.15, 0.18, 0.03, [sofaX - 0.4, 0.015, 1.5], mat(0x444444, 0.4));
  b.cylinder(0.012, 0.012, 1.5, [sofaX - 0.4, 0.78, 1.5], mat(0x444444, 0.4), false, 8);
  const floorShade = mat(0xfff0d6, 0.9, { emissive: new THREE.Color(0xffc98a), emissiveIntensity: 0.6, side: THREE.DoubleSide });
  b.cylinder(0.12, 0.2, 0.25, [sofaX - 0.4, 1.6, 1.5], floorShade, true, 20);
  const floorLight = new THREE.PointLight(0xffc98a, 1.4, 4, 1.6);
  floorLight.position.set(sofaX - 0.4, 1.5, 1.5);
  floorLight.userData.optional = true; // skipped on phones
  scene.add(floorLight);
  pottedPlant(b, X1 - 0.3, Z1 - 0.3, 1.6);
  pottedPlant(b, X0 + 0.4, Z0 + 0.4, 1.3);
  frame(b, 4.2, 1.7, Z0 + 0.015, 0xe8c9a0, 'x', 1);
  frame(b, X1 - 0.015, 1.9, -1.5, 0xa9c6d8, 'z', -1);

  // ---------- Ceiling fan (spins gently) ----------
  const fan = new THREE.Group();
  fan.position.set(cx + 0.5, H - 0.35, 0);
  scene.add(fan);
  b.cylinder(0.01, 0.01, 0.3, [cx + 0.5, H - 0.17, 0], mat(0x666666), false, 6);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 16), mat(0xf6efe4, 0.5));
  fan.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 0.12), woodMat);
    blade.position.set(Math.cos((i * Math.PI) / 2) * 0.36, 0, Math.sin((i * Math.PI) / 2) * 0.36);
    blade.rotation.y = -(i * Math.PI) / 2;
    blade.castShadow = true;
    fan.add(blade);
  }

  const fill = new THREE.PointLight(0xfff0dc, 1.5, 10, 1.1);
  fill.position.set(cx, H - 0.4, 0.5);
  scene.add(fill);

  const updateDust = dustMotes(b, new THREE.Vector3(WIN.x - 1, 0.3, Z0 + 0.2), new THREE.Vector3(WIN.x + 1, 2.4, Z0 + 2.5));

  return {
    pane, paneCollider, latch, latchPos, remotePos, radioPos, fan,
    isTvOn: () => tvOn,
    toggleTv() {
      tvOn = !tvOn;
      tvLight.intensity = tvOn ? 1.2 : 0;
      screenMat.emissiveIntensity = tvOn ? 1 : 0;
    },
    update(dt, time) {
      fan.rotation.y += dt * 2.2;
      updateDust(time);
      if (tvOn) {
        const c = new THREE.Color().setHSL((time * 0.08) % 1, 0.5, 0.55);
        screenMat.emissive.copy(c);
        tvLight.color.copy(c);
        tvLight.intensity = 0.9 + Math.sin(time * 9) * 0.2;
      }
    },
  };
}
