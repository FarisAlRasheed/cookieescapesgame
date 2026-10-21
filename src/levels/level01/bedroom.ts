import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Builder, mat, softNoiseTexture, woodTexture } from '../../core/builder';
import {
  PALETTE, ROOM_H as H, WALL_T as T, addPlant, buildCage, buildKey, curtain, dustMotes, frame, pottedPlant, rug, skyBackdrop, wall,
} from '../props';

// Cookie's bedroom: x -2.5..2.5, z -2.25..2.25. The door to the living room is in the east wall (x = 2.5).
export const BED = { X0: -2.5, X1: 2.5, Z0: -2.25, Z1: 2.25 };
export const DOOR = { z: -1.2, w: 0.9, h: 2.05, x: BED.X1 + T / 2 };

export interface BedroomParts {
  spawn: THREE.Vector3;
  spawnYaw: number;
  door: THREE.Group; // pivots at the hinge
  doorCollider: RAPIER.Collider;
  handle: THREE.Group; // lever, rotates down
  handleTop: THREE.Vector3; // where Cookie lands
  handlePad: RAPIER.Collider; // perch on the lever; removed when the door swings
  book: THREE.Mesh; // hides the key
  bookCollider: RAPIER.Collider;
  key: THREE.Group;
  keyGlow: THREE.PointLight;
  lampPos: THREE.Vector3;
  toggleLamp(): void;
  update(time: number): void;
}

export function buildBedroom(b: Builder, brass: THREE.Material): BedroomParts {
  const { X0, X1, Z0, Z1 } = BED;
  const W = X1 - X0, D = Z1 - Z0;
  const { scene } = b;

  const floorMat = mat(0xffffff, 0.75, { map: woodTexture('#c99b6b', [3, 3]) });
  const wallMat = mat(0xffffff, 0.95, { map: softNoiseTexture(PALETTE.wall, 8, [3, 2]) });
  const trimMat = mat(PALETTE.trim, 0.6);
  const woodMat = mat(0xffffff, 0.6, { map: woodTexture('#b98557', [1, 1]) });
  const woodDarkMat = mat(PALETTE.woodDark, 0.6);

  // Floor, ceiling, walls (the east wall is shared with the living room and built by the house)
  b.box([W, 0.1, D], [0, -0.05, 0], floorMat, { cast: false });
  b.box([W, 0.1, D], [0, H + 0.05, 0], mat(0xfbf5ec, 1), { cast: false });
  wall(b, 'x', Z0 - T / 2, X0 - T, X1, [], wallMat);
  wall(b, 'x', Z1 + T / 2, X0 - T, X1, [], wallMat);
  const winZ = 0.1, winW = 1.0, winBottom = 1.0, winTop = 2.1;
  wall(b, 'z', X0 - T / 2, Z0, Z1, [{ center: winZ, width: winW, bottom: winBottom, top: winTop }], wallMat);
  b.box([W, 0.1, 0.02], [0, 0.05, Z0 + 0.01], trimMat, { collider: false, cast: false });
  b.box([W, 0.1, 0.02], [0, 0.05, Z1 - 0.01], trimMat, { collider: false, cast: false });
  b.box([0.02, 0.1, D], [X0 + 0.01, 0.05, 0], trimMat, { collider: false, cast: false });

  // ---------- Door (hinged at its north edge, opens into the living room) ----------
  const door = new THREE.Group();
  door.position.set(DOOR.x, 0, DOOR.z - DOOR.w / 2);
  scene.add(door);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.05, DOOR.h, DOOR.w - 0.01), mat(PALETTE.door, 0.55));
  slab.position.set(0, DOOR.h / 2, DOOR.w / 2);
  slab.castShadow = slab.receiveShadow = true;
  door.add(slab);
  for (const side of [-1, 1]) {
    for (const dy of [0.55, 1.4]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.6), mat(0xe1d2b8, 0.6));
      panel.position.set(side * 0.03, dy, DOOR.w / 2);
      door.add(panel);
    }
  }
  const doorCollider = b.collider([0.05, DOOR.h, DOOR.w], [DOOR.x, DOOR.h / 2, DOOR.z]);
  // Lever handle on the bedroom side (and a twin on the living-room side)
  const handle = new THREE.Group();
  handle.position.set(-0.045, 1.0, DOOR.w / 2 + 0.32);
  door.add(handle);
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16), brass);
  rose.rotation.z = Math.PI / 2;
  handle.add(rose);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.17), brass);
  lever.position.set(-0.03, 0, -0.07);
  lever.castShadow = true;
  handle.add(lever);
  const twin = handle.clone();
  twin.position.x = 0.045;
  twin.scale.x = -1;
  door.add(twin);
  const handleTop = new THREE.Vector3(DOOR.x - 0.075, 1.0125, DOOR.z + 0.25);
  // Landing pad matching the lever (slightly generous so a bird can perch on it)
  const handlePad = b.collider([0.07, 0.025, 0.2], [handleTop.x, 1.0, handleTop.z]);
  // Frame trim
  for (const dz of [-1, 1]) b.box([0.03, DOOR.h + 0.08, 0.06], [X1 - 0.015, (DOOR.h + 0.08) / 2, DOOR.z + dz * (DOOR.w / 2 + 0.03)], trimMat, { collider: false });
  b.box([0.03, 0.06, DOOR.w + 0.12], [X1 - 0.015, DOOR.h + 0.04, DOOR.z], trimMat, { collider: false });

  // ---------- Window (stays closed) ----------
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.25 });
  b.box([0.02, winTop - winBottom, winW], [X0 - 0.04, (winTop + winBottom) / 2, winZ], glass, { cast: false });
  b.box([0.08, 0.05, winW + 0.1], [X0 - 0.02, winBottom - 0.025, winZ], trimMat);
  b.box([0.2, 0.04, winW + 0.16], [X0 + 0.06, winBottom - 0.02, winZ], trimMat);
  b.box([0.05, 0.05, winW], [X0 - 0.03, winTop + 0.025, winZ], trimMat, { collider: false });
  b.box([0.04, winTop - winBottom, 0.04], [X0 - 0.03, (winTop + winBottom) / 2, winZ], trimMat, { collider: false });
  skyBackdrop(b, [X0 - 3, 1.5, winZ], Math.PI / 2, 12, 8);
  for (const side of [-1, 1]) curtain(b, X0 + 0.08, 1.48, winZ + side * (winW / 2 + 0.12), Math.PI / 2);
  b.cylinder(0.012, 0.012, winW + 0.9, [X0 + 0.08, 2.25, winZ], brass, false, 8).rotation.x = Math.PI / 2;

  // ---------- Bed ----------
  const bedX = -1.25, bedZ = -1.2;
  b.boxOn([1.5, 0.3, 2.0], bedX, 0, bedZ, woodMat);
  b.boxOn([1.42, 0.2, 1.9], bedX, 0.3, bedZ + 0.02, mat(PALETTE.sheet, 0.95));
  b.boxOn([1.46, 0.06, 1.3], bedX, 0.5, bedZ + 0.33, mat(PALETTE.blanket, 0.95));
  b.boxOn([1.5, 1.0, 0.08], bedX, 0, Z0 + 0.04, woodMat);
  for (const dx of [-0.35, 0.35]) {
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12), mat(PALETTE.pillow, 1));
    pillow.scale.set(1, 0.28, 0.6);
    pillow.position.set(bedX + dx, 0.58, bedZ - 0.72);
    pillow.castShadow = true;
    scene.add(pillow);
    b.collider([0.55, 0.14, 0.32], [bedX + dx, 0.58, bedZ - 0.72]);
  }

  // ---------- Nightstand + lamp ----------
  const nsX = -0.2, nsZ = Z0 + 0.3;
  b.boxOn([0.45, 0.5, 0.42], nsX, 0, nsZ, woodMat);
  b.box([0.38, 0.12, 0.02], [nsX, 0.36, nsZ + 0.215], woodDarkMat, { collider: false });
  b.cylinder(0.06, 0.08, 0.04, [nsX, 0.52, nsZ], mat(0x9fb7a5, 0.5));
  b.cylinder(0.012, 0.012, 0.26, [nsX, 0.67, nsZ], brass, false, 8);
  const shadeMat = mat(0xfff0d6, 0.9, { emissive: new THREE.Color(0xffc98a), emissiveIntensity: 0.6, side: THREE.DoubleSide });
  b.cylinder(0.09, 0.15, 0.17, [nsX, 0.83, nsZ], shadeMat, true, 20);
  const lampLight = new THREE.PointLight(0xffc98a, 1.6, 4, 1.6);
  lampLight.position.set(nsX, 0.8, nsZ);
  scene.add(lampLight);
  let lampOn = true;

  // ---------- Desk, chair, cage ----------
  const deskX = 1.3, deskZ = Z1 - 0.35, deskTop = 0.75;
  b.boxOn([1.3, 0.04, 0.62], deskX, deskTop - 0.04, deskZ, woodMat);
  for (const [lx, lz] of [[-0.6, -0.26], [0.6, -0.26], [-0.6, 0.26], [0.6, 0.26]]) {
    b.boxOn([0.05, deskTop - 0.04, 0.05], deskX + lx, 0, deskZ + lz, woodDarkMat);
  }
  const chairX = deskX + 0.1, chairZ = deskZ - 0.65;
  b.boxOn([0.45, 0.04, 0.45], chairX, 0.45, chairZ, woodMat);
  b.boxOn([0.45, 0.5, 0.04], chairX, 0.49, chairZ - 0.21, woodMat);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    b.boxOn([0.04, 0.45, 0.04], chairX + lx, 0, chairZ + lz, woodDarkMat);
  }
  const cageX = deskX - 0.2, cageZ = deskZ + 0.02;
  buildCage(b, cageX, deskTop, cageZ, 0.24, 0.5, brass);
  b.cylinder(0.07, 0.05, 0.04, [deskX + 0.25, deskTop + 0.02, deskZ - 0.05], mat(0x7fb3c8, 0.4));
  const seeds = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe2c27a, 1));
  seeds.scale.y = 0.25;
  seeds.position.set(deskX + 0.25, deskTop + 0.035, deskZ - 0.05);
  scene.add(seeds);
  const mirror = b.cylinder(0.06, 0.06, 0.01, [deskX + 0.5, deskTop + 0.12, deskZ + 0.15], mat(0xcfe6f2, 0.05, { metalness: 0.9 }), false);
  mirror.rotation.x = Math.PI / 2;

  // ---------- Wardrobe ----------
  const wX = X0 + 0.32, wZ = 1.35;
  b.boxOn([0.6, 2.1, 1.2], wX, 0, wZ, woodMat);
  b.box([0.01, 1.9, 0.005], [wX + 0.305, 1.1, wZ], woodDarkMat, { collider: false, cast: false });
  for (const dz of [-0.06, 0.06]) b.box([0.03, 0.18, 0.02], [wX + 0.315, 1.1, wZ + dz], brass, { collider: false });
  b.cylinder(0.18, 0.18, 0.2, [wX, 2.2, wZ + 0.25], mat(0xd9a3a3, 0.8));

  // ---------- High shelf: books + the key hidden behind a big book ----------
  const shX = 1.3, shY = 1.85, shDepth = 0.32, shZ = Z0 + shDepth / 2;
  b.box([1.3, 0.04, shDepth], [shX, shY, shZ], woodMat);
  for (const dx of [-0.55, 0.55]) b.box([0.03, 0.15, 0.2], [shX + dx, shY - 0.1, Z0 + 0.1], woodDarkMat, { collider: false });
  let bx = shX - 0.6;
  PALETTE.books.forEach((color, i) => {
    const bw = 0.05 + (i % 2) * 0.02, bh = 0.2 + (i % 3) * 0.03;
    b.boxOn([bw, bh, 0.17], bx + bw / 2, shY + 0.02, Z0 + 0.1, mat(color, 0.85));
    bx += bw + 0.005;
  });
  const keyPos = new THREE.Vector3(shX + 0.2, shY + 0.026, Z0 + 0.07);
  const key = buildKey(brass);
  key.position.copy(keyPos);
  scene.add(key);
  const keyGlow = new THREE.PointLight(0xffd36b, 0.5, 0.8, 2);
  keyGlow.position.copy(keyPos).add(new THREE.Vector3(0, 0.15, 0));
  scene.add(keyGlow);
  // The big book standing in front of the key
  const bookSize: [number, number, number] = [0.24, 0.3, 0.05];
  const bookPos: [number, number, number] = [shX + 0.2, shY + 0.02 + bookSize[1] / 2, Z0 + 0.15];
  const book = b.box(bookSize, bookPos, mat(0x5b7fa6, 0.8), { collider: false });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.04, 0.052), mat(0xe8c26a, 0.5));
  spine.position.y = 0.08;
  book.add(spine);
  const bookCollider = b.collider(bookSize, bookPos);

  // Low shelf as a stepping stone
  b.box([0.8, 0.04, 0.22], [2.05, 1.25, Z0 + 0.12], woodMat);
  b.cylinder(0.06, 0.05, 0.1, [2.25, 1.32, Z0 + 0.12], mat(0xd7896a, 0.8));
  addPlant(b, 2.0, 1.32, Z0 + 0.12, 0.6);

  // ---------- Decoration ----------
  rug(b, 0.4, 0.3, 1.0, 1.3, PALETTE.rug, PALETTE.rugInner);
  pottedPlant(b, X1 - 0.3, Z1 - 0.3);
  frame(b, -0.9, 1.6, Z1 - 0.015, 0xa9c6d8, 'x', -1);
  frame(b, 0.1, 1.75, Z1 - 0.015, 0xe8c9a0, 'x', -1);
  b.cylinder(0.005, 0.005, 0.4, [0.2, H - 0.2, 0.2], mat(0x333333), false, 6);
  b.cylinder(0.08, 0.22, 0.16, [0.2, H - 0.45, 0.2], shadeMat, false);
  const fill = new THREE.PointLight(0xfff0dc, 1.2, 8, 1.2);
  fill.position.set(0.5, H - 0.4, 0.8);
  scene.add(fill);

  const updateDust = dustMotes(b, new THREE.Vector3(X0, 0.3, winZ - 1), new THREE.Vector3(X0 + 2.5, 2.5, winZ + 1));

  return {
    spawn: new THREE.Vector3(cageX, deskTop + 0.2, cageZ),
    spawnYaw: -Math.PI / 2,
    door, doorCollider, handle, handleTop, handlePad,
    book, bookCollider, key, keyGlow,
    lampPos: new THREE.Vector3(nsX, 0.6, nsZ),
    toggleLamp() {
      lampOn = !lampOn;
      lampLight.intensity = lampOn ? 1.6 : 0;
      shadeMat.emissiveIntensity = lampOn ? 0.6 : 0;
    },
    update(time) {
      updateDust(time);
    },
  };
}
