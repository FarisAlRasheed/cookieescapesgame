import type * as THREE from 'three';
import type { CookieController } from '../player/cookieController';
import type { Hud } from '../ui/hud';
import type { Sfx } from '../core/audio';
import type { Human } from '../ai/human';

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
  /** A human got Cookie. */
  caught(by: Human): void;
  collectNecklace(at: THREE.Vector3): void;
  win(): void;
}

export interface Level {
  spawn: THREE.Vector3;
  spawnYaw: number;
  interactables: Interactable[];
  humans: Human[];
  necklaceTotal: number;
  start(ctx: GameContext): void;
  update(dt: number, time: number): void;
  /** A sound at p that people within `radius` meters can hear. */
  noise(p: THREE.Vector3, radius: number): void;
  /** 0..1 loudness of background sounds where Cookie is. */
  ambience(p: THREE.Vector3): { wind: number; radio: number; clock: number };
  /** Cookie was caught and put back in the cage: reset whatever needs resetting. */
  onCookieCaught(): void;
}
