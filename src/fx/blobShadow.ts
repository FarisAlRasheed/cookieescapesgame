import * as THREE from 'three';

// A soft dark spot on the floor under a character: almost free compared to real shadow maps,
// used on phones where characters don't cast real shadows.

let texture: THREE.Texture | null = null;
function blobTexture() {
  if (texture) return texture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(60,40,25,0.55)');
  grad.addColorStop(0.6, 'rgba(60,40,25,0.25)');
  grad.addColorStop(1, 'rgba(60,40,25,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  texture = new THREE.CanvasTexture(c);
  return texture;
}

export class BlobShadow {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, private size: number) {
    this.mat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  /** groundY: height of the surface below; height: how far the character is above it. */
  place(x: number, groundY: number, z: number, height: number, visible: boolean) {
    this.mesh.visible = visible;
    if (!visible) return;
    const fade = Math.max(0, 1 - height / 2.5);
    this.mesh.position.set(x, groundY + 0.006, z);
    this.mesh.scale.setScalar(this.size * (1 + height * 0.25));
    this.mat.opacity = fade;
  }
}
