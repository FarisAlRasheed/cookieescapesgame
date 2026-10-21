import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAMERA_RAY_GROUPS } from '../core/builder';

/**
 * Hand-placed floor waypoints. Edges are found automatically: two nodes connect when
 * a few rays between them (at knee and chest height, plus a little to each side) hit nothing.
 * Call rebuild() after the world changes (e.g. a door opens).
 */
export class NavGraph {
  readonly nodes: THREE.Vector3[];
  private edges: number[][] = [];
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });

  constructor(private world: RAPIER.World, points: [number, number][], private clearance = 0.22) {
    this.nodes = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  }

  rebuild(exclude?: RAPIER.RigidBody) {
    this.edges = this.nodes.map(() => []);
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        if (this.clear(this.nodes[i], this.nodes[j], exclude)) {
          this.edges[i].push(j);
          this.edges[j].push(i);
        }
      }
    }
  }

  /** True when a human-sized body can walk straight from a to b. */
  clear(a: THREE.Vector3, b: THREE.Vector3, exclude?: RAPIER.RigidBody) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    const nx = dx / len, nz = dz / len;
    for (const side of [-this.clearance, 0, this.clearance]) {
      for (const y of [0.25, 0.9]) {
        this.ray.origin = { x: a.x - nz * side, y, z: a.z + nx * side };
        this.ray.dir = { x: nx, y: 0, z: nz };
        if (this.world.castRay(this.ray, len, true, undefined, CAMERA_RAY_GROUPS, undefined, exclude)) return false;
      }
    }
    return true;
  }

  private nearestVisible(p: THREE.Vector3, exclude?: RAPIER.RigidBody) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = this.nodes[i].distanceToSquared(p);
      if (d < bestD && this.clear(p, this.nodes[i], exclude)) { best = i; bestD = d; }
    }
    return best;
  }

  private nearest(p: THREE.Vector3) {
    let best = 0, bestD = Infinity;
    this.nodes.forEach((n, i) => {
      const d = n.distanceToSquared(p);
      if (d < bestD) { best = i; bestD = d; }
    });
    return best;
  }

  /**
   * Path of floor points from `from` towards `to`. If `to` can't be stood on (inside furniture,
   * up on a shelf), the path ends at the reachable point closest to it.
   */
  path(from: THREE.Vector3, to: THREE.Vector3, exclude?: RAPIER.RigidBody): THREE.Vector3[] {
    const goal = new THREE.Vector3(to.x, 0, to.z);
    const start = new THREE.Vector3(from.x, 0, from.z);
    if (this.clear(start, goal, exclude)) return [goal];
    const s = this.nearestVisible(start, exclude);
    if (s < 0) return [this.nodes[this.nearest(start)].clone()];

    // A* over the graph; the goal node is whichever node gets closest to the target.
    const N = this.nodes.length;
    const g = new Array(N).fill(Infinity);
    const prev = new Array(N).fill(-1);
    const open = new Set([s]);
    g[s] = 0;
    const h = (i: number) => this.nodes[i].distanceTo(goal);
    let bestEnd = s;
    while (open.size) {
      let cur = -1, curF = Infinity;
      for (const i of open) { const f = g[i] + h(i); if (f < curF) { cur = i; curF = f; } }
      open.delete(cur);
      if (h(cur) < h(bestEnd)) bestEnd = cur;
      for (const n of this.edges[cur]) {
        const ng = g[cur] + this.nodes[cur].distanceTo(this.nodes[n]);
        if (ng < g[n]) { g[n] = ng; prev[n] = cur; open.add(n); }
      }
    }
    const out: THREE.Vector3[] = [];
    for (let i = bestEnd; i >= 0; i = prev[i]) out.unshift(this.nodes[i].clone());
    if (this.clear(out[out.length - 1], goal, exclude)) out.push(goal);
    return out;
  }

  randomNode(filter: (p: THREE.Vector3) => boolean) {
    const options = this.nodes.filter(filter);
    return options[Math.floor(Math.random() * options.length)].clone();
  }
}
