import * as THREE from 'three';

// Small, cheap particle bursts: feathers when Cookie is caught, sparkles for necklaces, a golden ring for the power.

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  grow: number;
}

export class Particles {
  private list: Particle[] = [];
  private featherGeo = new THREE.PlaneGeometry(0.04, 0.012);
  private sparkGeo = new THREE.OctahedronGeometry(0.012);
  private ringGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 48);

  constructor(private scene: THREE.Scene) {
    this.featherGeo.translate(0, 0, 0);
  }

  private add(mesh: THREE.Mesh, p: Omit<Particle, 'mesh'>) {
    this.scene.add(mesh);
    this.list.push({ mesh, ...p });
  }

  feathers(at: THREE.Vector3, n = 14) {
    for (let i = 0; i < n; i++) {
      const color = Math.random() < 0.25 ? 0xf4f2ec : Math.random() < 0.2 ? 0xf3d257 : 0x8d8c90;
      const m = new THREE.Mesh(this.featherGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true }));
      m.position.copy(at).add(new THREE.Vector3(0, 0.15, 0));
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const a = Math.random() * Math.PI * 2;
      this.add(m, {
        vel: new THREE.Vector3(Math.cos(a) * 1.2, 1 + Math.random() * 1.5, Math.sin(a) * 1.2).multiplyScalar(Math.random() * 0.8 + 0.4),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 0, maxLife: 2 + Math.random(), gravity: 1.2, drag: 2.5, grow: 0,
      });
    }
  }

  sparkles(at: THREE.Vector3, n = 18, color = 0xffe58a) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(at);
      const dir = new THREE.Vector3().randomDirection();
      this.add(m, {
        vel: dir.multiplyScalar(0.8 + Math.random() * 1.2),
        spin: new THREE.Vector3(5, 7, 3),
        life: 0, maxLife: 0.6 + Math.random() * 0.5, gravity: -0.5, drag: 3, grow: 0,
      });
    }
  }

  ring(at: THREE.Vector3) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, depthWrite: false }));
      m.position.copy(at).add(new THREE.Vector3(0, 0.15, 0));
      m.rotation.x = Math.PI / 2;
      this.add(m, { vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: -i * 0.15, maxLife: 1.2, gravity: 0, drag: 0, grow: 9 });
    }
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life < 0) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      if (p.grow) p.mesh.scale.setScalar(1 + p.life * p.grow);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - Math.max(0, p.life / p.maxLife) ** 2;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        mat.dispose();
        this.list.splice(i, 1);
      }
    }
  }
}
