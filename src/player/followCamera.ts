import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAMERA_RAY_GROUPS } from '../core/builder';

/** Third-person orbit camera that stays behind Cookie and avoids clipping through walls. */
export class FollowCamera {
  yaw: number;
  pitch = 0.32; // radians, positive = looking down
  private distance = 1.1;
  private currentDist = 1.1;
  private target = new THREE.Vector3();
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  constructor(public camera: THREE.PerspectiveCamera, private world: RAPIER.World, private exclude: RAPIER.RigidBody, yaw: number) {
    this.yaw = yaw;
  }

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.5, 1.2);
  }

  update(dt: number, focus: THREE.Vector3, snap = false) {
    const goal = focus.clone().add(new THREE.Vector3(0, 0.22, 0));
    if (snap) this.target.copy(goal);
    else this.target.lerp(goal, 1 - Math.exp(-14 * dt));

    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    // Pull the camera in if furniture or walls are in the way
    this.ray.origin = { x: this.target.x, y: this.target.y, z: this.target.z };
    this.ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = this.world.castRay(this.ray, this.distance, true, undefined, CAMERA_RAY_GROUPS, undefined, this.exclude);
    let want = this.distance;
    if (hit) {
      const toi = (hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi;
      want = Math.max(0.12, toi - 0.06);
    }
    // Move in quickly, ease back out
    this.currentDist = want < this.currentDist || snap ? want : THREE.MathUtils.damp(this.currentDist, want, 4, dt);

    this.camera.position.copy(this.target).addScaledVector(dir, this.currentDist);
    this.camera.lookAt(this.target);
  }
}
