import { t } from '../i18n/ar';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class Hud {
  readonly startScreen: HTMLDivElement;
  readonly startBtn: HTMLButtonElement;
  readonly pauseScreen: HTMLDivElement;
  readonly resumeBtn: HTMLButtonElement;
  readonly joystick: HTMLDivElement;
  readonly knob: HTMLDivElement;
  readonly touchButtons: Record<string, HTMLButtonElement> = {};
  readonly pauseTouchBtn: HTMLButtonElement;

  private objective: HTMLDivElement;
  private staminaBox: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastTimer = 0;
  private helpPanel: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private promptHold: HTMLDivElement;
  private timerEl: HTMLDivElement;
  readonly winScreen: HTMLDivElement;
  readonly againBtn: HTMLButtonElement;
  private isTouch: boolean;

  constructor(root: HTMLElement, isTouch: boolean) {
    this.isTouch = isTouch;
    if (isTouch) document.body.classList.add('is-touch');

    // Top bar
    const top = el('div', 'hud-top');
    this.objective = el('div', 'objective', '');
    this.staminaBox = el('div', 'stamina', `<label>${t.stamina}</label><div class="bar"><div class="fill"></div></div>`);
    this.staminaFill = this.staminaBox.querySelector('.fill')!;
    this.timerEl = el('div', 'timer', '0:00');
    top.append(this.objective, this.timerEl, this.staminaBox);
    this.toastEl = el('div', 'toast');
    this.promptEl = el('div', 'prompt hidden', '<span class="key"></span><span class="label"></span><div class="hold"><div></div></div>');
    this.promptHold = this.promptEl.querySelector('.hold > div')!;

    // Help
    const hint = el('div', 'help-hint', t.help);
    this.helpPanel = el('div', 'help-panel hidden');
    this.helpPanel.innerHTML = `<h3>${t.controlsTitle}</h3><table>${t.controls
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><p>${t.gamepadNote}</p>`;

    // Touch controls
    const touch = el('div', 'touch');
    this.joystick = el('div', 'joystick');
    this.knob = el('div', 'knob');
    this.joystick.append(this.knob);
    const btns = el('div', 'touch-buttons');
    for (const [name, label, big] of [
      ['whistle', t.touchWhistle, false], ['peck', t.touchPeck, false],
      ['down', t.touchDown, false], ['fly', t.touchFly, true],
    ] as const) {
      const b = el('button', `tbtn${big ? ' big' : ''}`, label);
      this.touchButtons[name] = b;
      btns.append(b);
    }
    this.pauseTouchBtn = el('button', 'tbtn', '⏸');
    Object.assign(this.pauseTouchBtn.style, { position: 'absolute', top: '70px', left: '16px', width: '48px', height: '48px' });
    touch.append(this.joystick, btns, this.pauseTouchBtn);

    // Start screen
    this.startScreen = el('div', 'screen');
    this.startBtn = el('button', 'btn', t.loading);
    this.startBtn.disabled = true;
    this.startScreen.append(el('h1', '', t.title), el('p', '', t.subtitle), this.startBtn);

    // Pause screen
    this.pauseScreen = el('div', 'screen hidden');
    this.resumeBtn = el('button', 'btn', t.resume);
    this.pauseScreen.append(el('h1', '', t.paused), this.resumeBtn);

    // Win screen
    this.winScreen = el('div', 'screen hidden');
    this.againBtn = el('button', 'btn', t.win.again);

    root.append(top, this.toastEl, this.promptEl, hint, this.helpPanel, touch, this.startScreen, this.pauseScreen, this.winScreen);
  }

  ready() {
    this.startBtn.disabled = false;
    this.startBtn.textContent = t.start;
  }

  setStamina(v: number, max: number) {
    const pct = Math.max(0, Math.min(1, v / max));
    this.staminaFill.style.width = `${pct * 100}%`;
    this.staminaBox.classList.toggle('low', pct < 0.2);
  }

  setObjective(text: string, done = false) {
    this.objective.textContent = text;
    this.objective.classList.toggle('done', done);
  }

  toast(text: string, seconds = 2) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  /** Show "E  التقط المفتاح" near the bottom; holdPct (0..1) fills a bar for hold actions. */
  setPrompt(label: string | null, holdPct = -1) {
    this.promptEl.classList.toggle('hidden', !label);
    if (!label) return;
    this.promptEl.querySelector('.key')!.textContent = this.isTouch ? t.peckTouch : t.peckKey;
    this.promptEl.querySelector('.label')!.textContent = label;
    this.promptEl.classList.toggle('holding', holdPct >= 0);
    this.promptHold.style.width = `${Math.max(0, holdPct) * 100}%`;
  }

  setTime(seconds: number) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  showWin(seconds: number, fast: boolean) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    const star = (on: boolean) => `<span class="star ${on ? 'on' : ''}">${on ? '★' : '☆'}</span>`;
    this.winScreen.innerHTML = '';
    this.winScreen.append(
      el('h1', '', t.win.title),
      el('div', 'stars', `<div>${star(true)} ${t.win.escaped}</div><div>${star(false)} ${t.win.necklaces}</div><div>${star(fast)} ${t.win.fast}</div>`),
      el('p', '', `${t.win.time}: ${m}:${s.toString().padStart(2, '0')}`),
      this.againBtn,
    );
    this.winScreen.classList.remove('hidden');
  }

  toggleHelp() {
    this.helpPanel.classList.toggle('hidden');
  }

  setPaused(paused: boolean) {
    this.pauseScreen.classList.toggle('hidden', !paused);
  }

  update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }
}
