import type * as THREE from 'three';
import type { CookieController } from '../player/cookieController';
import type { Hud } from '../ui/hud';
import type { Sfx } from '../core/audio';

/** Something Cookie can peck (or peck-and-hold) when close enough. */
export interface Interactable {
  position: THREE.Vector3;
  radius: number;
  /** Prompt shown when Cookie is close; null means "not available right now". */
  prompt(): string | null;
  onPeck?(): void;
  /** When set, holding peck for this many seconds triggers onHold. */
  holdTime?: number;
  onHold?(): void;
}

/** What a level can use from the game while it runs. */
export interface GameContext {
  player: CookieController;
  hud: Hud;
  sfx: Sfx;
  readonly carrying: THREE.Object3D | null;
  carry(obj: THREE.Object3D | null): void;
  setObjective(text: string): void;
  win(): void;
}

export interface Level {
  spawn: THREE.Vector3;
  spawnYaw: number;
  interactables: Interactable[];
  start(ctx: GameContext): void;
  update(dt: number, time: number): void;
}
