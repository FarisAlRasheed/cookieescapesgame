import * as THREE from 'three';
import { Builder, mat } from '../core/builder';

// Reusable furniture and decoration pieces shared by every level.

export const ROOM_H = 2.7;
export const WALL_T = 0.12;

export const PALETTE = {
  wall: '#f4e6d0',
  wallLiving: '#eef0e2',
  trim: 0xfaf4ea,
  woodDark: 0x8a5d3b,
  blanket: 0x9cbf9a,
  sheet: 0xf6f1e7,
  pillow: 0xfff8ec,
  rug: 0xe7b98f,
  rugInner: 0xf3d7b4,
  door: 0xe9dcc6,
  metal: 0xc9b37c,
  books: [0xd96f5a, 0x6f9fc0, 0xe7c25c, 0x8db48a, 0xc98bb0],
};

export interface Opening { center: number; width: number; bottom: number; top: number }

/**
 * A wall of height ROOM_H with rectangular holes (doors/windows).
 * axis 'x': runs along x at z = fixed; axis 'z': runs along z at x = fixed.
 */
export function wall(b: Builder, axis: 'x' | 'z', fixed: number, from: number, to: number, openings: Opening[], material: THREE.Material) {
  const H = ROOM_H, T = WALL_T;
  const piece = (a0: number, a1: number, y0: number, y1: number) => {
    if (a1 - a0 < 1e-3 || y1 - y0 < 1e-3) return;
    const len = a1 - a0, mid = (a0 + a1) / 2, h = y1 - y0, y = (y0 + y1) / 2;
    if (axis === 'x') b.box([len, h, T], [mid, y, fixed], material);
    else b.box([T, h, len], [fixed, y, mid], material);
  };
  const sorted = [...openings].sort((a, c) => a.center - c.center);
  let cursor = from;
  for (const o of sorted) {
    const o0 = o.center - o.width / 2, o1 = o.center + o.width / 2;
    piece(cursor, o0, 0, H);
    piece(o0, o1, o.top, H);
    piece(o0, o1, 0, o.bottom);
    cursor = o1;
  }
  piece(cursor, to, 0, H);
}

export function buildCage(b: Builder, x: number, y: number, z: number, r: number, h: number, metal: THREE.Material) {
  const base = mat(0xf2ede4, 0.6);
  b.cylinder(r + 0.02, r + 0.03, 0.05, [x, y + 0.025, z], base, false);
  b.collider([r * 2, 0.05, r * 2], [x, y + 0.025, z]);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe9d9a8, 0.4, { metalness: 0.6, wireframe: true }));
  dome.position.set(x, y + h, z);
  dome.scale.y = 0.5;
  b.scene.add(dome);
  b.collider([r * 2, 0.04, r * 2], [x, y + h + 0.02, z], 0, true);
  b.cylinder(0.02, 0.02, 0.06, [x, y + h + r * 0.5 + 0.03, z], metal, false, 8);
  // Bars, leaving a door gap facing -x (towards the room)
  const barGeo = new THREE.CylinderGeometry(0.003, 0.003, h, 4);
  const bars = 28;
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * Math.PI * 2;
    const bx = Math.sin(a) * r, bz = Math.cos(a) * r;
    if (bx < -r * 0.75) continue;
    const bar = new THREE.Mesh(barGeo, metal);
    bar.position.set(x + bx, y + h / 2, z + bz);
    bar.castShadow = true;
    b.scene.add(bar);
  }
  for (const hy of [0.05, h * 0.5, h]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 6, 40), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + hy, z);
    b.scene.add(ring);
  }
  // Colliders: back (+x) and sides; the camera can see through them
  b.collider([0.02, h, r * 2], [x + r, y + h / 2, z], 0, true);
  b.collider([r * 2, h, 0.02], [x, y + h / 2, z - r], 0, true);
  b.collider([r * 2, h, 0.02], [x, y + h / 2, z + r], 0, true);
  const door = new THREE.Group();
  door.position.set(x - r * 0.75, y + 0.05, z - r * 0.65);
  door.rotation.y = 0.4;
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, h * 0.75, 4), metal);
    bar.position.set(-i * 0.045, h * 0.375, 0);
    door.add(bar);
  }
  b.scene.add(door);
  b.cylinder(0.008, 0.008, r * 1.6, [x + 0.05, y + 0.16, z], mat(0xb07d4f), false, 8).rotation.x = Math.PI / 2;
}

export function buildKey(material: THREE.Material) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 20), material);
  ring.position.x = -0.05;
  ring.rotation.x = Math.PI / 2;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.01), material);
  shaft.position.x = 0.01;
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.025), material);
  tooth1.position.set(0.04, 0, 0.015);
  const tooth2 = tooth1.clone();
  tooth2.position.x = 0.025;
  g.add(ring, shaft, tooth1, tooth2);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export function addPlant(b: Builder, x: number, y: number, z: number, height: number, color = 0x7da36f) {
  const leafMat = mat(color, 0.8, { side: THREE.DoubleSide });
  const leafGeo = new THREE.SphereGeometry(0.1, 10, 6);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const s = height * (0.6 + Math.random() * 0.4);
    leaf.scale.set(0.35 * s, 1.0 * s, 0.12 * s);
    leaf.position.set(x + Math.sin(a) * 0.04 * s, y + 0.09 * s, z + Math.cos(a) * 0.04 * s);
    leaf.rotation.set(Math.cos(a) * 0.6, a, -Math.sin(a) * 0.6);
    leaf.castShadow = true;
    b.scene.add(leaf);
  }
}

export function pottedPlant(b: Builder, x: number, z: number, height = 1.4) {
  b.cylinder(0.16, 0.12, 0.3, [x, 0.15, z], mat(0xd7896a, 0.8));
  addPlant(b, x, 0.3, z, height);
}

export function rug(b: Builder, x: number, z: number, r: number, sx: number, outer: number, inner: number) {
  for (const [rad, color, y] of [[r, outer, 0.004], [r * 0.7, inner, 0.006]] as [number, number, number][]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), mat(color, 1));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.scale.set(sx, 1, 1);
    m.receiveShadow = true;
    b.scene.add(m);
  }
}

export function frame(b: Builder, x: number, y: number, z: number, color: number, axis: 'x' | 'z', facing: 1 | -1) {
  const trim = mat(0xfaf4ea, 0.6);
  if (axis === 'x') {
    b.box([0.42, 0.32, 0.03], [x, y, z], trim, { collider: false });
    b.box([0.34, 0.24, 0.01], [x, y, z + facing * 0.017], mat(color, 0.9), { collider: false, cast: false });
  } else {
    b.box([0.03, 0.32, 0.42], [x, y, z], trim, { collider: false });
    b.box([0.01, 0.24, 0.34], [x + facing * 0.017, y, z], mat(color, 0.9), { collider: false, cast: false });
  }
}

export function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 341;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 341);
  grad.addColorStop(0, '#8ec5e8');
  grad.addColorStop(0.55, '#ffe2b8');
  grad.addColorStop(1, '#ffd1a1');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 341);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [cx, cy, s] of [[120, 80, 1], [360, 60, 0.8], [260, 130, 0.6]]) {
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(cx + i * 22 * s, cy + Math.sin(i) * 6 * s, 26 * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = '#88b07a';
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.arc(i * 40 + 10, 300, 40 + (i % 3) * 12, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Big painted backdrop outside a window. */
export function skyBackdrop(b: Builder, pos: [number, number, number], rotY: number, w = 14, h = 9) {
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTexture() }));
  sky.position.set(...pos);
  sky.rotation.y = rotY;
  b.scene.add(sky);
}

/** Wavy fabric curtain panel facing the room. */
export function curtain(b: Builder, x: number, y: number, z: number, rotY: number, color = 0xf2c9a5) {
  const c = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.5, 8, 1), mat(color, 0.95, { side: THREE.DoubleSide }));
  const pos = c.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 30) * 0.025);
  c.geometry.computeVertexNormals();
  c.position.set(x, y, z);
  c.rotation.y = rotY;
  c.castShadow = true;
  b.scene.add(c);
}

/** Floating dust motes in a sunbeam. */
export function dustMotes(b: Builder, min: THREE.Vector3, max: THREE.Vector3, n = 140) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = THREE.MathUtils.lerp(min.x, max.x, Math.random());
    arr[i * 3 + 1] = THREE.MathUtils.lerp(min.y, max.y, Math.random());
    arr[i * 3 + 2] = THREE.MathUtils.lerp(min.z, max.z, Math.random());
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1cc, size: 0.012, transparent: true, opacity: 0.7, depthWrite: false }));
  b.scene.add(pts);
  return (time: number) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      let y = p.getY(i) + Math.sin(time * 0.3 + i) * 0.0006 + 0.0003;
      if (y > max.y) y = min.y;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.cos(time * 0.2 + i * 1.7) * 0.0004);
    }
    p.needsUpdate = true;
  };
}
