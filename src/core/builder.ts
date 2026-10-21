import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/** Colliders in this group block Cookie but not the camera (e.g. thin cage bars). */
export const SEE_THROUGH_GROUPS = 0x0002ffff;
/** Ray filter for the camera: hits everything except SEE_THROUGH colliders. */
export const CAMERA_RAY_GROUPS = 0xffff0001;

/** Helpers that create a mesh and (optionally) a matching static physics collider. */
export class Builder {
  constructor(public scene: THREE.Scene, public world: RAPIER.World) {}

  /** Box with its center at (x, y, z). */
  box(
    size: [number, number, number],
    pos: [number, number, number],
    material: THREE.Material,
    opts: { collider?: boolean; rotY?: number; parent?: THREE.Object3D; cast?: boolean } = {},
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...pos);
    mesh.rotation.y = opts.rotY ?? 0;
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = true;
    (opts.parent ?? this.scene).add(mesh);
    if (opts.collider ?? true) this.collider(size, pos, opts.rotY ?? 0);
    return mesh;
  }

  /** Box resting on a surface: y is the bottom instead of the center. */
  boxOn(size: [number, number, number], x: number, bottom: number, z: number, material: THREE.Material, opts: Parameters<Builder['box']>[3] = {}) {
    return this.box(size, [x, bottom + size[1] / 2, z], material, opts);
  }

  collider(size: [number, number, number], pos: [number, number, number], rotY = 0, cameraSeesThrough = false) {
    const desc = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...pos);
    if (cameraSeesThrough) desc.setCollisionGroups(SEE_THROUGH_GROUPS);
    if (rotY) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    return this.world.createCollider(desc);
  }

  removeCollider(c: RAPIER.Collider) {
    this.world.removeCollider(c, true);
  }

  cylinder(rTop: number, rBottom: number, h: number, pos: [number, number, number], material: THREE.Material, collider = true, seg = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collider) {
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, Math.max(rTop, rBottom)).setTranslation(...pos));
    }
    return mesh;
  }
}

export function mat(color: number, roughness = 0.8, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

/** Soft procedural wood-plank texture. */
export function woodTexture(base = '#c89a6a', repeat: [number, number] = [4, 4]) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const plankH = 64;
  for (let row = 0; row < 512 / plankH; row++) {
    const shade = (Math.random() - 0.5) * 24;
    g.fillStyle = `rgba(${shade > 0 ? 255 : 60},${shade > 0 ? 230 : 40},${shade > 0 ? 200 : 20},${Math.abs(shade) / 120})`;
    g.fillRect(0, row * plankH, 512, plankH);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(90,55,30,${Math.random() * 0.08})`;
      g.lineWidth = 1 + Math.random() * 2;
      const y = row * plankH + Math.random() * plankH;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + (Math.random() - 0.5) * 8, 340, y + (Math.random() - 0.5) * 8, 512, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(70,40,20,0.35)';
    g.fillRect(0, row * plankH, 512, 2);
    const off = (row % 2) * 256 + Math.random() * 60;
    g.fillRect(off % 512, row * plankH, 2, plankH);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Gentle noise for plaster walls and fabrics. */
export function softNoiseTexture(base: string, amount = 10, repeat: [number, number] = [2, 2]) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
