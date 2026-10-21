// Unified input: keyboard + mouse, gamepad and touch all feed the same action state.
export interface Actions {
  moveX: number; // -1 left .. 1 right
  moveY: number; // -1 back .. 1 forward
  lookX: number; // camera yaw delta (radians this frame)
  lookY: number; // camera pitch delta
  flapPressed: boolean; // pressed this frame
  flapHeld: boolean;
  descend: boolean;
  peckPressed: boolean;
  peckHeld: boolean;
  whistlePressed: boolean;
  pausePressed: boolean;
  helpPressed: boolean;
}

const MOUSE_SENS = 0.0025;
const PAD_LOOK_SPEED = 2.6; // rad/s at full stick
const TOUCH_LOOK_SENS = 0.006;
const DEADZONE = 0.18;

export class Input {
  readonly isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  enabled = false;

  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private padPrev: boolean[] = [];

  // touch state
  private joy = { x: 0, y: 0 };
  private touchLookDX = 0;
  private touchLookDY = 0;
  private touchHeld = new Set<string>();
  private touchPressed = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (this.enabled && !this.isTouch) this.lockPointer();
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  lockPointer() {
    if (this.isTouch) return;
    const req = this.canvas.requestPointerLock() as unknown;
    if (req instanceof Promise) req.catch(() => {});
  }

  get pointerLocked() {
    return document.pointerLockElement === this.canvas;
  }

  /** Wire up on-screen touch controls built by the HUD. */
  bindTouch(joystick: HTMLElement, knob: HTMLElement, buttons: Record<string, HTMLElement>) {
    let joyId: number | null = null;
    const radius = 50;
    const updateJoy = (t: Touch) => {
      const r = joystick.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx *= radius / len; dy *= radius / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / radius;
      this.joy.y = -dy / radius;
    };
    joystick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      updateJoy(t);
    }, { passive: false });
    const endJoy = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyId) {
          joyId = null; this.joy.x = 0; this.joy.y = 0;
          knob.style.transform = '';
        }
      }
    };
    joystick.addEventListener('touchend', endJoy);
    joystick.addEventListener('touchcancel', endJoy);

    for (const [name, el] of Object.entries(buttons)) {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.touchHeld.add(name); this.touchPressed.add(name);
        el.classList.add('active');
      }, { passive: false });
      const up = () => { this.touchHeld.delete(name); el.classList.remove('active'); };
      el.addEventListener('touchend', up);
      el.addEventListener('touchcancel', up);
    }

    // Any other finger dragging on the canvas rotates the camera.
    const lookIds = new Map<number, { x: number; y: number }>();
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of Array.from(e.changedTouches)) lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const p = lookIds.get(t.identifier);
        if (!p) continue;
        this.touchLookDX += t.clientX - p.x;
        this.touchLookDY += t.clientY - p.y;
        p.x = t.clientX; p.y = t.clientY;
      }
    }, { passive: false });
    const endLook = (e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) lookIds.delete(t.identifier); };
    this.canvas.addEventListener('touchend', endLook);
    this.canvas.addEventListener('touchcancel', endLook);
  }

  /** Read and reset this frame's input. */
  poll(dt: number): Actions {
    const k = (c: string) => this.keys.has(c);
    const p = (c: string) => this.pressed.has(c);

    let moveX = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let moveY = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    let lookX = this.mouseDX * MOUSE_SENS;
    let lookY = this.mouseDY * MOUSE_SENS;
    let flapPressed = p('Space');
    let flapHeld = k('Space');
    let descend = k('ShiftLeft') || k('ShiftRight');
    let peckPressed = p('KeyE');
    let peckHeld = k('KeyE');
    let whistlePressed = p('KeyQ');
    const pausePressed = p('Escape') || p('KeyP');
    const helpPressed = p('KeyH');

    // Gamepad (standard mapping)
    const pad = navigator.getGamepads?.().find((g) => g && g.connected);
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < DEADZONE ? 0 : v);
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const edge = (i: number) => btn(i) && !this.padPrev[i];
      moveX += dz(pad.axes[0] ?? 0);
      moveY -= dz(pad.axes[1] ?? 0);
      lookX += dz(pad.axes[2] ?? 0) * PAD_LOOK_SPEED * dt;
      lookY += dz(pad.axes[3] ?? 0) * PAD_LOOK_SPEED * dt;
      flapPressed ||= edge(0);
      flapHeld ||= btn(0);
      descend ||= btn(1) || btn(6);
      peckPressed ||= edge(2);
      peckHeld ||= btn(2);
      whistlePressed ||= edge(3);
      this.padPrev = pad.buttons.map((b) => b.pressed);
      if (edge(9)) this.pressed.add('Escape');
    }

    // Touch
    if (this.isTouch) {
      moveX += this.joy.x;
      moveY += this.joy.y;
      lookX += this.touchLookDX * TOUCH_LOOK_SENS;
      lookY += this.touchLookDY * TOUCH_LOOK_SENS;
      flapPressed ||= this.touchPressed.has('fly');
      flapHeld ||= this.touchHeld.has('fly');
      descend ||= this.touchHeld.has('down');
      peckPressed ||= this.touchPressed.has('peck');
      peckHeld ||= this.touchHeld.has('peck');
      whistlePressed ||= this.touchPressed.has('whistle');
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 1) { moveX /= len; moveY /= len; }

    this.pressed.clear();
    this.touchPressed.clear();
    this.mouseDX = this.mouseDY = 0;
    this.touchLookDX = this.touchLookDY = 0;

    if (!this.enabled) {
      return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, flapPressed: false, flapHeld: false, descend: false, peckPressed: false, peckHeld: false, whistlePressed: false, pausePressed, helpPressed };
    }
    return { moveX, moveY, lookX, lookY, flapPressed, flapHeld, descend, peckPressed, peckHeld, whistlePressed, pausePressed, helpPressed };
  }
}
