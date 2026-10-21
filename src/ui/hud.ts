import * as THREE from 'three';
import { t } from '../i18n/ar';
import type { Quality, Settings } from '../core/save';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

const fmtTime = (seconds: number) => {
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

type ScreenName = 'start' | 'pause' | 'settings' | 'howto' | 'win' | 'over';

export interface Bubble { id: string; text: string; pos: THREE.Vector3 }

export class Hud {
  readonly joyZone: HTMLDivElement;
  readonly joystick: HTMLDivElement;
  readonly knob: HTMLDivElement;
  readonly touchButtons: Record<string, HTMLButtonElement> = {};
  readonly pauseTouchBtn: HTMLButtonElement;

  // Callbacks set by the game
  onPlay = () => {};
  onResume = () => {};
  onRestart = () => {};
  onSettings: (s: Settings) => void = () => {};

  private objective: HTMLDivElement;
  private staminaBox: HTMLDivElement;
  private staminaFill: HTMLDivElement;
  private goldBox: HTMLDivElement;
  private goldFill: HTMLDivElement;
  private livesEl: HTMLDivElement;
  private necklaceEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastTimer = 0;
  private helpPanel: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private promptHold: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private flashEl: HTMLDivElement;
  private bubbleLayer: HTMLDivElement;
  private bubbleEls = new Map<string, HTMLDivElement>();
  private screens: Record<ScreenName, HTMLDivElement>;
  private startBtn: HTMLButtonElement;
  private bestEl: HTMLParagraphElement;
  private settingsBack: 'start' | 'pause' = 'start';
  private isTouch: boolean;

  constructor(root: HTMLElement, isTouch: boolean, private settings: Settings) {
    this.isTouch = isTouch;
    if (isTouch) document.body.classList.add('is-touch');

    // ---------- In-game HUD ----------
    this.bubbleLayer = el('div', 'bubbles');
    const top = el('div', 'hud-top');
    this.objective = el('div', 'objective', '');
    const right = el('div', 'hud-stack');
    this.staminaBox = el('div', 'meter stamina', `<label>${t.stamina}</label><div class="bar"><div class="fill"></div></div>`);
    this.staminaFill = this.staminaBox.querySelector('.fill')!;
    this.goldBox = el('div', 'meter gold', `<label>${t.power.meter}</label><div class="bar"><div class="fill"></div></div>`);
    this.goldFill = this.goldBox.querySelector('.fill')!;
    right.append(this.staminaBox, this.goldBox);
    const mid = el('div', 'hud-stack center');
    this.timerEl = el('div', 'chip timer', '0:00');
    this.livesEl = el('div', 'chip lives', '');
    this.necklaceEl = el('div', 'chip necklaces', '');
    mid.append(this.timerEl, this.livesEl, this.necklaceEl);
    top.append(this.objective, mid, right);
    this.toastEl = el('div', 'toast');
    this.flashEl = el('div', 'flash');
    this.promptEl = el('div', 'prompt hidden', '<span class="key"></span><span class="label"></span><div class="hold"><div></div></div>');
    this.promptHold = this.promptEl.querySelector('.hold > div')!;

    const hint = el('div', 'help-hint', t.help);
    this.helpPanel = el('div', 'help-panel hidden');
    this.helpPanel.innerHTML = `<h3>${t.controlsTitle}</h3><table>${t.controls
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><p>${t.gamepadNote}</p>`;

    // ---------- Touch controls ----------
    const touch = el('div', 'touch');
    this.joyZone = el('div', 'joy-zone');
    this.joystick = el('div', 'joystick');
    this.knob = el('div', 'knob');
    this.joystick.append(this.knob);
    this.joyZone.append(this.joystick);
    const btns = el('div', 'touch-buttons');
    for (const [name, label, cls] of [
      ['power', t.touchPower, 'gold'], ['whistle', t.touchWhistle, ''], ['peck', t.touchPeck, ''],
      ['down', t.touchDown, ''], ['fly', t.touchFly, 'big'],
    ] as const) {
      const b = el('button', `tbtn ${cls}`, label);
      this.touchButtons[name] = b;
      btns.append(b);
    }
    this.pauseTouchBtn = el('button', 'tbtn pause-btn', '⏸');
    touch.append(this.joyZone, btns, this.pauseTouchBtn);

    // ---------- Screens ----------
    const screen = () => el('div', 'screen hidden');
    const button = (label: string, onClick: () => void, cls = 'btn') => {
      const b = el('button', cls, label);
      b.addEventListener('click', onClick);
      return b;
    };
    this.screens = { start: screen(), pause: screen(), settings: screen(), howto: screen(), win: screen(), over: screen() };

    this.startBtn = button(t.loading, () => this.onPlay());
    this.startBtn.disabled = true;
    this.bestEl = el('p', 'best', '');
    const menuRow = el('div', 'menu-row');
    menuRow.append(
      button(t.menu.howTo, () => this.show('howto'), 'btn small'),
      button(t.menu.settings, () => this.openSettings('start'), 'btn small'),
    );
    this.screens.start.append(el('div', 'logo', '🐦'), el('h1', '', t.title), el('p', '', t.subtitle), this.startBtn, menuRow, this.bestEl);
    this.screens.start.classList.remove('hidden');

    const pauseRow = el('div', 'menu-col');
    pauseRow.append(
      button(t.resume, () => this.onResume()),
      button(t.menu.restart, () => this.onRestart(), 'btn small'),
      button(t.menu.settings, () => this.openSettings('pause'), 'btn small'),
    );
    this.screens.pause.append(el('h1', '', t.paused), pauseRow);

    const how = el('ul', 'howto-list', t.howTo.map((l) => `<li>${l}</li>`).join(''));
    this.screens.howto.append(el('h2', '', t.menu.howTo), how, button(t.menu.back, () => this.show('start'), 'btn small'));

    this.buildSettings(button);

    root.append(this.bubbleLayer, top, this.toastEl, this.promptEl, hint, this.helpPanel, touch, this.flashEl, ...Object.values(this.screens));
  }

  private buildSettings(button: (label: string, onClick: () => void, cls?: string) => HTMLButtonElement) {
    const s = this.settings;
    const panel = el('div', 'settings-panel');
    const slider = (label: string, key: 'sfx' | 'sensitivity', min: number, max: number, step: number) => {
      const row = el('label', 'setting');
      const input = el('input');
      Object.assign(input, { type: 'range', min, max, step, value: String(s[key]) });
      input.addEventListener('input', () => { s[key] = Number(input.value); this.onSettings(s); });
      row.append(el('span', '', label), input);
      return row;
    };
    const quality = el('label', 'setting');
    const select = el('select');
    for (const q of ['low', 'medium', 'high'] as Quality[]) {
      const o = el('option', '', t.settings.qualities[q]);
      o.value = q;
      if (s.quality === q) o.selected = true;
      select.append(o);
    }
    select.addEventListener('change', () => { s.quality = select.value as Quality; this.onSettings(s); });
    quality.append(el('span', '', t.settings.quality), select);
    const invert = el('label', 'setting');
    const check = el('input');
    check.type = 'checkbox';
    check.checked = s.invertY;
    check.addEventListener('change', () => { s.invertY = check.checked; this.onSettings(s); });
    invert.append(el('span', '', t.settings.invertY), check);
    panel.append(
      slider(t.settings.sfx, 'sfx', 0, 1, 0.05),
      slider(t.settings.sensitivity, 'sensitivity', 0.4, 2, 0.1),
      quality, invert,
    );
    this.screens.settings.append(el('h2', '', t.settings.title), panel, button(t.menu.back, () => this.show(this.settingsBack), 'btn small'));
  }

  private openSettings(from: 'start' | 'pause') {
    this.settingsBack = from;
    this.show('settings');
  }

  /** Show one overlay screen (or none). */
  show(name: ScreenName | null) {
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('hidden', k !== name);
  }

  get menuOpen() {
    return Object.values(this.screens).some((s) => !s.classList.contains('hidden'));
  }

  ready(best: { time: number | null; stars: number }) {
    this.startBtn.disabled = false;
    this.startBtn.textContent = t.menu.play;
    this.bestEl.textContent = best.time !== null ? t.menu.best(fmtTime(best.time), best.stars) : '';
  }

  private lastStamina = -1;
  private lastTime = -1;

  setStamina(v: number, max: number) {
    const pct = Math.round(Math.max(0, Math.min(1, v / max)) * 100) / 100;
    if (pct === this.lastStamina) return;
    this.lastStamina = pct;
    this.staminaFill.style.width = `${pct * 100}%`;
    this.staminaBox.classList.toggle('low', pct < 0.2);
  }

  setGold(v: number) {
    this.goldFill.style.width = `${Math.min(100, v)}%`;
    const ready = v >= 100;
    this.goldBox.classList.toggle('ready', ready);
    this.touchButtons.power.classList.toggle('ready', ready);
  }

  setLives(n: number, max: number) {
    this.livesEl.textContent = '🪶'.repeat(n) + '·'.repeat(max - n);
    this.livesEl.title = t.lives;
  }

  setNecklaces(n: number, total: number) {
    this.necklaceEl.textContent = `📿 ${n}/${total}`;
  }

  setObjective(text: string) {
    this.objective.textContent = text;
    this.objective.classList.remove('pulse');
    void this.objective.offsetWidth;
    this.objective.classList.add('pulse');
  }

  toast(text: string, seconds = 2) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  flash(color: string) {
    this.flashEl.style.background = color;
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  /** Show "E  التقط المفتاح" near the bottom; holdPct (0..1) fills a bar for hold actions. */
  private lastPrompt = '';

  setPrompt(label: string | null, holdPct = -1) {
    const key = `${label}|${holdPct < 0 ? -1 : Math.round(holdPct * 50)}`;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    this.promptEl.classList.toggle('hidden', !label);
    if (!label) return;
    this.promptEl.querySelector('.key')!.textContent = this.isTouch ? t.peckTouch : t.peckKey;
    this.promptEl.querySelector('.label')!.textContent = label;
    this.promptEl.classList.toggle('holding', holdPct >= 0);
    this.promptHold.style.width = `${Math.max(0, holdPct) * 100}%`;
  }

  setTime(seconds: number) {
    const whole = Math.floor(seconds);
    if (whole === this.lastTime) return;
    this.lastTime = whole;
    this.timerEl.textContent = fmtTime(seconds);
  }

  /** Speech bubbles and ❓/❗ icons floating over people's heads. */
  updateBubbles(bubbles: Bubble[], camera: THREE.Camera) {
    const seen = new Set<string>();
    const w = innerWidth, h = innerHeight;
    for (const b of bubbles) {
      seen.add(b.id);
      let e = this.bubbleEls.get(b.id);
      if (!e) {
        e = el('div', 'bubble');
        this.bubbleLayer.append(e);
        this.bubbleEls.set(b.id, e);
      }
      const p = b.pos.clone().project(camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      e.style.display = visible ? '' : 'none';
      if (!visible) continue;
      if (e.textContent !== b.text) {
        e.textContent = b.text;
        e.classList.toggle('icon', [...b.text].length <= 2);
      }
      e.style.transform = `translate(-50%, -100%) translate(${Math.round((p.x * 0.5 + 0.5) * w)}px, ${Math.round((-p.y * 0.5 + 0.5) * h)}px)`;
    }
    for (const [id, e] of this.bubbleEls) if (!seen.has(id)) { e.remove(); this.bubbleEls.delete(id); }
  }

  showWin(seconds: number, necklaces: number, total: number, stars: [boolean, boolean, boolean], extra: string) {
    const star = (on: boolean) => `<span class="star ${on ? 'on' : ''}">${on ? '★' : '☆'}</span>`;
    const s = this.screens.win;
    s.innerHTML = '';
    const again = el('button', 'btn', t.win.again);
    again.addEventListener('click', () => this.onRestart());
    s.append(
      el('h1', '', t.win.title),
      el('div', 'stars', `<div>${star(stars[0])} ${t.win.escaped}</div><div>${star(stars[1])} ${t.win.necklaces(necklaces, total)}</div><div>${star(stars[2])} ${t.win.fast}</div>`),
      el('p', '', `${t.win.time}: ${fmtTime(seconds)}`),
    );
    if (extra) s.append(el('p', 'extra', extra));
    s.append(again);
    this.show('win');
  }

  showGameOver() {
    const s = this.screens.over;
    s.innerHTML = '';
    const retry = el('button', 'btn', t.gameOver.retry);
    retry.addEventListener('click', () => this.onRestart());
    s.append(el('div', 'logo', '🪶'), el('h1', '', t.gameOver.title), el('p', '', t.gameOver.text), retry);
    this.show('over');
  }

  toggleHelp() {
    this.helpPanel.classList.toggle('hidden');
  }

  update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }
}
