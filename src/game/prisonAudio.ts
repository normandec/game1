/**
 * PRISON SOUND — every noise in the cell block is synthesised on the fly.
 *
 * No audio files: the build is a single HTML file, and a prison is mostly noise anyway —
 * boots on wet concrete, steel bars, a siren far away, the hum of the lighting grid.
 * Everything is WebAudio nodes fed from one cached noise buffer.
 */

export interface AudioState {
  /** the operative is on his feet and moving */
  moving: boolean;
  sprint: boolean;
  /** 0..1, straight from the simulation's siren */
  siren: number;
  lightsOut: boolean;
  /** master volume, 0..1 */
  volume: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class PrisonAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private sirenGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private stepT = 0;
  private voiceT = 6;
  private breathT = 0;

  muted = false;
  ready = false;

  /** Must be called from a real user gesture (click or key), and is safe to call twice. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctor) return;
    let ctx: AudioContext;
    try { ctx = new Ctor(); } catch { return; }
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    this.master = master;

    // one second of white noise, reused by every impact and footstep
    const len = Math.floor(ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // ---- the siren: two detuned saws, amplitude-wobbled, always running at gain 0 ----
    const sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    const sirenFilter = ctx.createBiquadFilter();
    sirenFilter.type = 'lowpass';
    sirenFilter.frequency.value = 1400;
    sirenFilter.Q.value = 0.8;
    sirenFilter.connect(sirenGain);
    sirenGain.connect(master);
    for (const f of [610, 823]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.22;
      osc.connect(g);
      g.connect(sirenFilter);
      osc.start();
    }
    // slow wobble, the sound of a motor-driven siren spinning up
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.42;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenFilter.frequency);
    lfo.start();
    this.sirenGain = sirenGain;

    // ---- room tone: the lighting grid and the ventilation ----
    const hum = ctx.createGain();
    hum.gain.value = 0.06;
    hum.connect(master);
    for (const f of [50, 100, 148]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = f === 50 ? 0.35 : 0.16;
      osc.connect(g);
      g.connect(hum);
      osc.start();
    }
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 5200;
    hissFilter.Q.value = 0.5;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.05;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(master);
    hiss.start();
    this.humGain = hum;

    this.ready = true;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  dispose(): void {
    try { void this.ctx?.close(); } catch { /* already closed */ }
    this.ctx = null; this.master = null; this.noise = null;
    this.sirenGain = null; this.humGain = null; this.ready = false;
  }

  /* ------------------------------------------------------------------ */
  /* primitives                                                          */
  /* ------------------------------------------------------------------ */

  private burst(opts: {
    gain: number; dur: number; freq: number; q?: number; type?: BiquadFilterType;
    sweepTo?: number; delay?: number; pan?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q ?? 1;
    if (opts.sweepTo) {
      filter.frequency.setValueAtTime(opts.freq, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), t + opts.dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(opts.pan ?? 0, -1, 1);
    src.connect(filter);
    filter.connect(g);
    g.connect(pan);
    pan.connect(this.master);
    src.start(t);
    src.stop(t + opts.dur + 0.02);
  }

  private tone(opts: { freq: number; to?: number; dur: number; gain: number; type?: OscillatorType; delay?: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  /* ------------------------------------------------------------------ */
  /* one-shots                                                           */
  /* ------------------------------------------------------------------ */

  footstep(sprint: boolean, pan = 0): void {
    if (!this.ready) return;
    const k = sprint ? 1 : 0.62;
    this.burst({ gain: 0.16 * k, dur: sprint ? 0.13 : 0.16, freq: 780 + Math.random() * 340, q: 0.9, pan });
    this.burst({ gain: 0.09 * k, dur: 0.06, freq: 2100, q: 1.4, pan, delay: 0.01 });
    this.tone({ freq: 96, to: 58, dur: 0.08, gain: 0.05 * k, type: 'sine' });
  }

  shot(kind: 'pistol' | 'carbine' | 'shotgun' | 'smg'): void {
    if (!this.ready) return;
    const heavy = kind === 'shotgun';
    this.burst({ gain: heavy ? 0.5 : 0.34, dur: heavy ? 0.34 : 0.2, freq: heavy ? 900 : 1500, q: 0.5, sweepTo: 180 });
    this.burst({ gain: 0.18, dur: 0.5, freq: 420, q: 0.4, type: 'lowpass', sweepTo: 120, delay: 0.03 });
    this.tone({ freq: heavy ? 120 : 168, to: 42, dur: heavy ? 0.28 : 0.16, gain: 0.24, type: 'triangle' });
    if (kind === 'carbine' || kind === 'smg') this.burst({ gain: 0.1, dur: 0.22, freq: 2600, q: 1.2, delay: 0.05 });
  }

  /** A magazine out, a magazine in. */
  reload(): void {
    if (!this.ready) return;
    this.burst({ gain: 0.12, dur: 0.07, freq: 1800, q: 2 });
    this.burst({ gain: 0.14, dur: 0.06, freq: 900, q: 2, delay: 0.42 });
    this.burst({ gain: 0.16, dur: 0.08, freq: 1500, q: 2.4, delay: 0.9 });
  }

  /** Steel: a lock giving way, a door swinging, a lever slamming home. */
  steel(kind: 'lock' | 'lever' | 'gate' = 'lock'): void {
    if (!this.ready) return;
    if (kind === 'lock') {
      this.burst({ gain: 0.24, dur: 0.14, freq: 2600, q: 3, sweepTo: 900 });
      this.tone({ freq: 420, to: 180, dur: 0.22, gain: 0.09, type: 'square' });
    } else if (kind === 'lever') {
      this.burst({ gain: 0.2, dur: 0.1, freq: 1600, q: 2 });
      this.tone({ freq: 150, to: 90, dur: 0.16, gain: 0.14, type: 'square' });
    } else {
      // the sally port: a very large piece of steel moving very slowly
      this.burst({ gain: 0.3, dur: 1.1, freq: 260, q: 0.4, type: 'lowpass', sweepTo: 90 });
      this.tone({ freq: 62, to: 38, dur: 1.4, gain: 0.2, type: 'sawtooth' });
    }
  }

  /** Handcuffs closing, then the drag. */
  cuff(): void {
    if (!this.ready) return;
    this.burst({ gain: 0.22, dur: 0.07, freq: 3200, q: 3 });
    this.burst({ gain: 0.18, dur: 0.09, freq: 2100, q: 3, delay: 0.11 });
    this.burst({ gain: 0.12, dur: 0.5, freq: 620, q: 0.6, delay: 0.3 });
  }

  /** Your own gun going off next to your ear is louder than a shot. */
  dryFire(): void {
    if (!this.ready) return;
    this.burst({ gain: 0.1, dur: 0.05, freq: 2400, q: 2 });
  }

  pickup(): void {
    if (!this.ready) return;
    this.tone({ freq: 780, dur: 0.08, gain: 0.08, type: 'square' });
    this.tone({ freq: 1180, dur: 0.1, gain: 0.07, type: 'square', delay: 0.08 });
  }

  /** Somebody shouting three galleries away. */
  shout(distance = 20): void {
    if (!this.ready) return;
    const near = clamp(1 - distance / 60, 0.12, 1);
    const base = 300 + Math.random() * 160;
    this.burst({ gain: 0.1 * near, dur: 0.42, freq: base, q: 4, type: 'bandpass', sweepTo: base * 0.7 });
    this.tone({ freq: base, to: base * 0.72, dur: 0.34, gain: 0.03 * near, type: 'sawtooth' });
  }

  /** A body hitting the floor. */
  thud(): void {
    if (!this.ready) return;
    this.tone({ freq: 84, to: 44, dur: 0.22, gain: 0.2, type: 'sine' });
    this.burst({ gain: 0.1, dur: 0.16, freq: 400, q: 0.7, type: 'lowpass' });
  }

  /** Prying a floor grate out of its frame. */
  scrape(): void {
    if (!this.ready) return;
    this.burst({ gain: 0.14, dur: 0.3, freq: 900, q: 1.2, sweepTo: 500 });
    this.burst({ gain: 0.08, dur: 0.2, freq: 2400, q: 3, delay: 0.12 });
  }

  /* ------------------------------------------------------------------ */
  /* per-frame                                                           */
  /* ------------------------------------------------------------------ */

  update(dt: number, s: AudioState): void {
    if (!this.ready || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const vol = clamp(s.volume, 0, 1);

    if (this.sirenGain) {
      this.sirenGain.gain.setTargetAtTime(clamp(s.siren, 0, 1) * 0.085 * vol, t, 0.25);
    }
    if (this.humGain) {
      // the grid hums louder when the hall is dark and the ballast whines
      this.humGain.gain.setTargetAtTime((s.lightsOut ? 0.1 : 0.055) * vol, t, 0.4);
    }

    // boots on wet concrete: one step every 0.5 m walking, 0.78 m running
    if (s.moving) {
      const stride = s.sprint ? 0.78 : 0.52;
      this.stepT += dt * (s.sprint ? 3.9 : 2.5) * stride;
      if (this.stepT >= 1) {
        this.stepT = 0;
        this.footstep(s.sprint, Math.sin(t * 1.7) * 0.12);
        this.breathT = s.sprint ? 2.2 : 4.5;
      }
    } else {
      this.stepT = Math.max(0, this.stepT - dt);
    }
    if (this.breathT > 0) this.breathT -= dt;

    // the block talks: a distant shout now and then
    this.voiceT -= dt;
    if (this.voiceT <= 0) {
      this.voiceT = 9 + Math.random() * 16;
      this.shout(18 + Math.random() * 40);
    }
  }
}
