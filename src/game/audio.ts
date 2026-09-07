// Tiny WebAudio synth — no assets, all procedural. Built for "juice".
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ensure();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  private noiseBuffer(ctx: AudioContext, dur: number) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noise(dur: number, freq: number, gain: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, dur);
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'square', slideTo?: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  shoot(kind: 'rifle' | 'shotgun' | 'smg' | 'rocket' = 'rifle') {
    if (kind === 'shotgun') {
      this.noise(0.18, 900, 0.5);
      this.tone(180, 0.12, 0.18, 'sawtooth', 60);
    } else if (kind === 'smg') {
      this.noise(0.05, 1900, 0.22);
      this.tone(420, 0.04, 0.06, 'square', 220);
    } else if (kind === 'rocket') {
      this.noise(0.3, 500, 0.35, 'lowpass');
      this.tone(140, 0.25, 0.14, 'sawtooth', 500);
    } else {
      this.noise(0.07, 1500, 0.3);
      this.tone(330, 0.05, 0.09, 'square', 150);
    }
  }

  hit() {
    this.noise(0.06, 2600, 0.16, 'highpass');
  }

  kill() {
    this.noise(0.22, 700, 0.35, 'lowpass');
    this.tone(220, 0.16, 0.12, 'triangle', 70);
  }

  explode() {
    this.noise(0.55, 260, 0.62, 'lowpass');
    this.tone(90, 0.45, 0.28, 'sawtooth', 30);
  }

  hurt() {
    this.tone(200, 0.22, 0.24, 'sawtooth', 60);
    this.noise(0.16, 500, 0.2, 'lowpass');
  }

  dash() {
    this.noise(0.22, 1200, 0.24, 'bandpass');
    this.tone(500, 0.18, 0.07, 'sine', 1200);
  }

  pickup() {
    this.tone(660, 0.08, 0.16, 'square');
    window.setTimeout(() => this.tone(990, 0.12, 0.14, 'square'), 70);
  }

  wave() {
    this.tone(392, 0.14, 0.16, 'square');
    window.setTimeout(() => this.tone(523, 0.14, 0.16, 'square'), 130);
    window.setTimeout(() => this.tone(784, 0.3, 0.18, 'square'), 260);
  }

  gameover() {
    this.tone(392, 0.3, 0.2, 'sawtooth', 260);
    window.setTimeout(() => this.tone(262, 0.5, 0.22, 'sawtooth', 120), 240);
    window.setTimeout(() => this.tone(180, 0.9, 0.2, 'sawtooth', 60), 560);
  }

  click() {
    this.tone(760, 0.05, 0.12, 'square');
  }

  /** VTOL rotor whump — pulsing low-frequency noise bed. */
  rotor() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const dur = 1.4;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, dur);
    src.loop = false;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 240;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0, t);
    for (let i = 0; i < 10; i++) {
      const at = t + i * (dur / 10);
      g.gain.linearRampToValueAtTime(0.32, at + dur / 22);
      g.gain.linearRampToValueAtTime(0.04, at + dur / 10);
    }
    g.gain.linearRampToValueAtTime(0.0008, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
    // low sub pulse
    this.tone(48, 0.4, 0.16, 'sine', 40);
  }

  /** Air-raid siren — classic two-tone rising wail. */
  siren() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    for (let i = 0; i < 3; i++) {
      const delay = i * 420;
      window.setTimeout(() => this.tone(640, 0.28, 0.1, 'sine', 780), delay);
      window.setTimeout(() => this.tone(780, 0.28, 0.1, 'sine', 640), delay + 210);
    }
  }
}

export const sfx = new Sfx();
