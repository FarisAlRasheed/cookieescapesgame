// Tiny synthesized sound effects (no audio files needed yet).
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxVolume = 0.8;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6 * this.sfxVolume;
    this.master.connect(this.ctx.destination);
  }

  setVolume(sfx: number) {
    this.sfxVolume = sfx;
    if (this.ctx) this.master.gain.value = 0.6 * sfx;
  }

  /** Funny gibberish speech, pitched per character. */
  voice(pitch = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const syllables = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < syllables; i++) {
      const st = t + i * rand(0.07, 0.11);
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      const base = 190 * pitch * rand(0.85, 1.25);
      o.frequency.setValueAtTime(base, st);
      o.frequency.linearRampToValueAtTime(base * rand(0.8, 1.3), st + 0.08);
      f.type = 'bandpass'; f.frequency.value = rand(700, 1600) * pitch; f.Q.value = 4;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.18, st + 0.015);
      g.gain.linearRampToValueAtTime(0, st + 0.08);
      o.connect(f).connect(g).connect(this.master);
      o.start(st); o.stop(st + 0.1);
    }
  }

  /** Glittery shimmer for a golden necklace (no melody). */
  collect() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) this.noise(t + i * rand(0.02, 0.05), 0.08, rand(6000, 9000), 0.12, 'highpass');
    this.chirp();
  }

  /** The Golden Whistle: Cookie's loudest, longest whistle with a golden shimmer. */
  goldenWhistle() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(t, 0.5, 1600, 3200, 0.28, 8);
    this.tone(t + 0.55, 0.7, 3000, 2200, 0.25, 10);
    for (let i = 0; i < 14; i++) this.noise(t + i * 0.07, 0.1, rand(5000, 9000), 0.08, 'highpass');
  }

  /** Funny "boing" and an indignant squawk when Cookie gets caught. */
  caught() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(t, 0.35, 220, 90, 0.25, 18, 'triangle'); // boing
    this.tone(t + 0.3, 0.18, 2400, 1500, 0.2, 0, 'sawtooth'); // squawk
    this.tone(t + 0.5, 0.25, 2600, 1300, 0.18, 0, 'sawtooth');
  }



  // ---------- Background ambience: wind, a talk radio, birds outside, a clock ----------
  private ambient: { wind: GainNode; radio: GainNode; clock: GainNode; birds: GainNode } | null = null;
  private ambientTimers: number[] = [];
  radioOn = true;

  startAmbience() {
    const ctx = this.ctx; if (!ctx || this.ambient) return;
    const bus = (v: number) => { const g = ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; };
    const wind = bus(0), radio = bus(0), clock = bus(0), birds = bus(0.5);
    this.ambient = { wind, radio, clock, birds };

    // Wind: looping filtered noise with slow gusts
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 6; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const gust = ctx.createGain();
    gust.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08; lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain).connect(gust.gain);
    src.connect(lp).connect(gust).connect(wind);
    src.start(); lfo.start();

    // Talk radio: muffled voices in sentences with pauses, plus a little static
    const radioFilter = ctx.createBiquadFilter();
    radioFilter.type = 'bandpass'; radioFilter.frequency.value = 1400; radioFilter.Q.value = 0.9;
    radioFilter.connect(radio);
    let talking = 0, speaker = 1;
    this.ambientTimers.push(window.setInterval(() => {
      if (!this.radioOn) return;
      const now = ctx.currentTime;
      if (talking <= 0) {
        if (Math.random() < 0.25) { talking = 6 + Math.floor(Math.random() * 14); speaker = Math.random() < 0.5 ? 0.85 : 1.2; }
        this.noise(now, 0.16, 3000, 0.02, 'bandpass');
        return;
      }
      talking--;
      const base = 160 * speaker * rand(0.85, 1.2);
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, now);
      o.frequency.linearRampToValueAtTime(base * rand(0.85, 1.15), now + 0.12);
      f.type = 'bandpass'; f.frequency.value = rand(600, 1800); f.Q.value = 3;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.02);
      g.gain.linearRampToValueAtTime(0, now + rand(0.08, 0.14));
      o.connect(f).connect(g).connect(radioFilter);
      o.start(now); o.stop(now + 0.16);
    }, 160));

    // Birds outside now and then
    const birdCall = () => {
      if (this.ambient) {
        const now = ctx.currentTime;
        const n = 2 + Math.floor(Math.random() * 4);
        const f0 = rand(3000, 4500);
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const st = now + i * rand(0.09, 0.15);
          o.frequency.setValueAtTime(f0 * rand(0.9, 1.1), st);
          o.frequency.exponentialRampToValueAtTime(f0 * rand(0.7, 1.3), st + 0.07);
          g.gain.setValueAtTime(0, st);
          g.gain.linearRampToValueAtTime(0.06, st + 0.01);
          g.gain.linearRampToValueAtTime(0, st + 0.08);
          o.connect(g).connect(birds);
          o.start(st); o.stop(st + 0.1);
        }
      }
      this.ambientTimers.push(window.setTimeout(birdCall, rand(5000, 13000)));
    };
    birdCall();

    // Wall clock in the bedroom
    let tock = false;
    this.ambientTimers.push(window.setInterval(() => {
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = tock ? 1500 : 1800;
      tock = !tock;
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      o.connect(g).connect(clock);
      o.start(now); o.stop(now + 0.04);
    }, 1000));
  }

  /** Volumes follow Cookie around the house: wind near windows, radio in the living room, clock in the bedroom. */
  setAmbience(levels: { wind: number; radio: number; clock: number }) {
    if (!this.ambient || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambient.wind.gain.setTargetAtTime(0.05 + levels.wind * 0.12, t, 0.3);
    this.ambient.radio.gain.setTargetAtTime(this.radioOn ? levels.radio * 0.16 : 0, t, 0.2);
    this.ambient.clock.gain.setTargetAtTime(levels.clock * 0.05, t, 0.3);
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

  /** Escape! A burst of happy bird calls and a whoosh of air. */
  success() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.8, 900, 0.4, 'bandpass');
    for (let i = 0; i < 5; i++) {
      const f = rand(2400, 3400);
      this.tone(t + 0.2 + i * rand(0.1, 0.16), 0.09, f, f * 1.3, 0.14, 0, 'triangle');
    }
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
