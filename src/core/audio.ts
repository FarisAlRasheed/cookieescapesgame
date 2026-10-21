// Tiny synthesized sound effects (no audio files needed yet).
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  private lastTune = -1;
  private flapCount = 0;

  /** Cockatiel whistle: a random tune (never the same twice in a row), transposed and re-timed each time. */
  whistle() {
    const ctx = this.ctx; if (!ctx) return;
    let i = Math.floor(Math.random() * TUNES.length);
    if (i === this.lastTune) i = (i + 1) % TUNES.length;
    this.lastTune = i;
    const pitch = rand(0.88, 1.14);
    const tempo = rand(0.85, 1.15);
    const vibrato = rand(4, 9);
    const t = ctx.currentTime;
    for (const [s, d, f0, f1] of TUNES[i]) {
      this.tone(t + s * tempo, d * tempo, f0 * pitch * rand(0.98, 1.02), f1 * pitch * rand(0.98, 1.02), 0.22, vibrato);
    }
  }

  chirp() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const notes = Math.random() < 0.4 ? 2 : 1;
    for (let n = 0; n < notes; n++) {
      const f = rand(2300, 3000);
      this.tone(t + n * 0.11, rand(0.06, 0.1), f, f * rand(1.15, 1.4), 0.12, 0, 'triangle');
    }
  }

  /** Feathery whoosh; filter, length and loudness change on every flap. */
  flap() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.flapCount++;
    const dur = rand(0.09, 0.17);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Two quick feather beats in a single whoosh sometimes
    const double = Math.random() < 0.3;
    for (let j = 0; j < len; j++) {
      const x = j / len;
      const env = double ? Math.abs(Math.sin(x * Math.PI * 2)) : Math.sin(x * Math.PI) ** rand(0.8, 1.6);
      data[j] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rand(0.85, 1.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(rand(600, 1300), t);
    f.frequency.exponentialRampToValueAtTime(rand(400, 900), t + dur);
    f.Q.value = rand(0.5, 1.3);
    const g = ctx.createGain();
    g.gain.value = rand(0.25, 0.42);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.25, 0.25);
    src.connect(f).connect(g).connect(pan).connect(this.master);
    src.start(t);
    // An excited little chirp now and then
    if (this.flapCount % 5 === 0 && Math.random() < 0.5) this.chirp();
  }

  private tone(start: number, dur: number, f0: number, f1: number, vol: number, vibratoHz = 0, type: OscillatorType = 'sine') {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    if (vibratoHz) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = vibratoHz;
      lg.gain.value = f0 * 0.015;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(start); lfo.stop(start + dur + 0.02);
    }
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + Math.min(0.03, dur / 3));
    g.gain.setValueAtTime(vol, start + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, start + dur);
    o.connect(g).connect(this.master);
    o.start(start); o.stop(start + dur + 0.02);
  }

  peck() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (const s of [0, 0.09]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(900, t + s);
      o.frequency.exponentialRampToValueAtTime(300, t + s + 0.04);
      g.gain.setValueAtTime(0.08, t + s);
      g.gain.exponentialRampToValueAtTime(0.001, t + s + 0.05);
      o.connect(g).connect(this.master);
      o.start(t + s); o.stop(t + s + 0.06);
    }
  }

  private noise(start: number, dur: number, filterHz: number, vol: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(start);
  }

  /** Heavy book landing on the floor. */
  thud() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.35, rand(180, 260), 0.9);
    this.tone(t, 0.18, rand(90, 120), 50, 0.4);
  }

  /** Little metallic jingle when grabbing the key. */
  jingle() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (let n = 0; n < 4; n++) {
      const f = rand(3200, 4800);
      this.tone(t + n * rand(0.03, 0.06), 0.12, f, f * 0.98, 0.06, 0, 'triangle');
    }
  }

  /** Lock clicking open. */
  click() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.03, 3000, 0.5, 'highpass');
    this.noise(t + 0.12, 0.04, 2200, 0.6, 'highpass');
  }

  /** Slow, funny door creak. */
  creak() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(150, 190), t);
    o.frequency.linearRampToValueAtTime(rand(260, 320), t + 0.5);
    o.frequency.linearRampToValueAtTime(rand(180, 220), t + 1.1);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.1);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.25);
  }

  /** Stuck latch rattling. */
  rattle() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (let n = 0; n < 3; n++) this.noise(t + n * 0.05, 0.03, rand(1500, 2500), 0.35, 'bandpass');
  }

  success() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((hz, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(0, t + i * 0.1);
      g.gain.linearRampToValueAtTime(0.15, t + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.45);
    });
  }
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// [start s, duration s, from Hz, to Hz]
const TUNES: [number, number, number, number][][] = [
  // rising "wheet-wheet-whoo"
  [[0, 0.22, 1700, 2500], [0.28, 0.32, 2300, 2900], [0.62, 0.2, 2900, 2100]],
  // wolf whistle
  [[0, 0.28, 1500, 2900], [0.42, 0.45, 1600, 3000]],
  // happy triple peep
  [[0, 0.1, 2600, 2900], [0.14, 0.1, 2600, 2900], [0.28, 0.25, 2700, 3200]],
  // questioning rise
  [[0, 0.5, 1800, 2700]],
  // "pretty bird" four-note phrase
  [[0, 0.15, 2200, 2300], [0.2, 0.15, 2600, 2650], [0.4, 0.12, 2400, 2450], [0.56, 0.35, 2900, 2300]],
  // falling sigh
  [[0, 0.18, 3000, 3100], [0.22, 0.4, 3000, 1800]],
  // trill
  [[0, 0.07, 2500, 2800], [0.08, 0.07, 2500, 2800], [0.16, 0.07, 2500, 2800], [0.24, 0.07, 2500, 2800], [0.34, 0.3, 2600, 3100]],
];
