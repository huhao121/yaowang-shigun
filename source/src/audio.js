// Procedural WebAudio score + SFX. No samples, no network.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.ambient = null;
    this.chimeClock = 11;
    this.windGain = null;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (_) { /* ignored */ }
      }
      return this.ready;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      const ctx = new Ctx();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.62;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.master = master;
      this.noiseBuffer = this._makeNoise(4.5);
      this.startAmbience();
      this.ready = true;
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (err) {
      console.warn('[audio] unavailable', err);
      this.ready = false;
    }
    return this.ready;
  }

  _makeNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = white * 0.55 + last * 3.2;
    }
    return buffer;
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.loopStart = Math.random() * 2;
    return src;
  }

  _tone({ freq = 180, endFreq = null, type = 'sine', dur = 0.2, gain = 0.08, delay = 0, pan = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(18, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      osc.connect(p);
      node = p;
    }
    node.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noise({ dur = 0.2, gain = 0.1, type = 'bandpass', freq = 900, endFreq = null, q = 0.9, delay = 0, pan = 0, attack = 0.005 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = this._noiseSource();
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(40, freq), t);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      src.connect(p);
      node = p;
    }
    node.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 1.6);
    src.stop(t + dur + 0.06);
  }

  startAmbience() {
    if (!this.ready || this.ambient) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const wind = this._noiseSource();
    wind.playbackRate.value = 0.36;
    const windHP = ctx.createBiquadFilter();
    windHP.type = 'highpass';
    windHP.frequency.value = 90;
    const windLP = ctx.createBiquadFilter();
    windLP.type = 'lowpass';
    windLP.frequency.value = 460;
    windLP.Q.value = 0.5;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.018;
    wind.connect(windHP);
    windHP.connect(windLP);
    windLP.connect(windGain);
    windGain.connect(this.master);
    wind.start(t);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.075;
    lfoGain.gain.value = 0.009;
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);
    lfo.start(t);

    const lfo2 = ctx.createOscillator();
    const lfo2Gain = ctx.createGain();
    lfo2.frequency.value = 0.043;
    lfo2Gain.gain.value = 190;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(windLP.frequency);
    lfo2.start(t);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.011;
    const droneLP = ctx.createBiquadFilter();
    droneLP.type = 'lowpass';
    droneLP.frequency.value = 140;
    droneGain.connect(droneLP);
    droneLP.connect(this.master);
    const droneA = ctx.createOscillator();
    droneA.type = 'sine';
    droneA.frequency.value = 43.65;
    const droneB = ctx.createOscillator();
    droneB.type = 'triangle';
    droneB.frequency.value = 65.4;
    const droneB2 = ctx.createGain();
    droneB2.gain.value = 0.35;
    droneA.connect(droneGain);
    droneB.connect(droneB2);
    droneB2.connect(droneGain);
    droneA.start(t);
    droneB.start(t);

    this.ambient = { wind, windGain, lfo, lfo2, droneA, droneB };
    this.windGain = windGain;
  }

  ambientTick(dt) {
    if (!this.ready) return;
    this.chimeClock -= dt;
    if (this.chimeClock <= 0) {
      this.chimeClock = 18 + Math.random() * 16;
      const notes = [261.6, 293.7, 349.2, 392.0, 523.3];
      const f = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1);
      this._tone({ freq: f, endFreq: f * 0.996, type: 'sine', dur: 3.2, gain: 0.018, pan: Math.random() * 1.4 - 0.7 });
      this._tone({ freq: f * 2.01, type: 'sine', dur: 1.6, gain: 0.007, delay: 0.02 });
    }
  }

  ui() {
    if (!this.ready) return;
    this._tone({ freq: 520, endFreq: 760, type: 'sine', dur: 0.1, gain: 0.035 });
  }

  swing(heavy = false) {
    if (!this.ready) return;
    const pan = (Math.random() - 0.5) * 0.35;
    this._noise({ dur: heavy ? 0.26 : 0.16, gain: heavy ? 0.17 : 0.11, type: 'bandpass', freq: heavy ? 1700 : 2600, endFreq: heavy ? 280 : 520, q: 0.7, pan });
    this._tone({ freq: heavy ? 150 : 220, endFreq: heavy ? 54 : 95, type: 'triangle', dur: heavy ? 0.22 : 0.12, gain: heavy ? 0.1 : 0.05, pan });
  }

  hit(heavy = false, crit = false) {
    if (!this.ready) return;
    this._tone({ freq: heavy ? 96 : 120, endFreq: 34, type: 'sine', dur: heavy ? 0.24 : 0.15, gain: heavy ? 0.24 : 0.15 });
    this._noise({ dur: heavy ? 0.2 : 0.11, gain: heavy ? 0.2 : 0.12, type: 'lowpass', freq: 1600, endFreq: 180, q: 0.6 });
    this._noise({ dur: 0.05, gain: 0.06, type: 'highpass', freq: 3600, q: 0.6, delay: 0.008 });
    if (crit) {
      this._tone({ freq: 880, endFreq: 660, type: 'triangle', dur: 0.22, gain: 0.07 });
      this._tone({ freq: 1320, endFreq: 990, type: 'sine', dur: 0.18, gain: 0.045, delay: 0.015 });
    }
  }

  parry() {
    if (!this.ready) return;
    [740, 1112, 1480, 1960].forEach((f, i) => {
      this._tone({ freq: f, endFreq: f * 0.992, type: i % 2 ? 'sine' : 'triangle', dur: 0.66 - i * 0.06, gain: 0.075 - i * 0.012, delay: i * 0.004 });
    });
    this._noise({ dur: 0.16, gain: 0.16, type: 'highpass', freq: 2600, endFreq: 5200, q: 0.5 });
    this._tone({ freq: 108, endFreq: 54, type: 'sine', dur: 0.28, gain: 0.16 });
  }

  roar(phase2 = false) {
    if (!this.ready) return;
    const base = phase2 ? 58 : 44;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const t = this.ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.32, t + 0.22);
    osc.frequency.linearRampToValueAtTime(base * 0.82, t + 1.2);
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    mod.frequency.value = 7.2;
    modGain.gain.value = 9;
    mod.connect(modGain);
    modGain.connect(osc.frequency);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.linearRampToValueAtTime(1000, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(180, t + 1.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t); mod.start(t);
    osc.stop(t + 1.5); mod.stop(t + 1.5);
    this._noise({ dur: 1.15, gain: 0.12, type: 'bandpass', freq: 340, endFreq: 120, q: 0.7 });
  }

  slam() {
    if (!this.ready) return;
    this._tone({ freq: 72, endFreq: 22, type: 'sine', dur: 0.9, gain: 0.32 });
    this._noise({ dur: 0.8, gain: 0.2, type: 'lowpass', freq: 1200, endFreq: 90, q: 0.5 });
    for (let i = 0; i < 5; i++) {
      this._noise({ dur: 0.06 + Math.random() * 0.08, gain: 0.025 + Math.random() * 0.03, type: 'bandpass', freq: 1000 + Math.random() * 2400, q: 1.4, delay: 0.08 + Math.random() * 0.5 });
    }
  }

  step(run = false) {
    if (!this.ready) return;
    this._noise({ dur: 0.075, gain: run ? 0.043 : 0.028, type: 'lowpass', freq: 280 + Math.random() * 120, q: 1.2 });
    this._tone({ freq: 54 + Math.random() * 16, endFreq: 38, type: 'sine', dur: 0.08, gain: 0.02 });
  }

  bossStep() {
    if (!this.ready) return;
    this._tone({ freq: 46 + Math.random() * 10, endFreq: 28, type: 'sine', dur: 0.24, gain: 0.12 });
    this._noise({ dur: 0.18, gain: 0.06, type: 'lowpass', freq: 260, q: 1 });
  }

  dodge() {
    if (!this.ready) return;
    this._noise({ dur: 0.22, gain: 0.07, type: 'bandpass', freq: 600, endFreq: 1600, q: 0.5 });
    this._tone({ freq: 120, endFreq: 70, type: 'sine', dur: 0.16, gain: 0.03 });
  }

  heal() {
    if (!this.ready) return;
    [392, 523.3, 659.3, 784].forEach((f, i) => {
      this._tone({ freq: f, type: 'sine', dur: 1.2, gain: 0.03, delay: i * 0.07 });
    });
    this._noise({ dur: 0.6, gain: 0.025, type: 'highpass', freq: 3000, q: 0.5 });
  }

  spell() {
    if (!this.ready) return;
    this._tone({ freq: 196, endFreq: 784, type: 'sine', dur: 0.8, gain: 0.06 });
    this._tone({ freq: 293.7, endFreq: 1174.7, type: 'triangle', dur: 0.55, gain: 0.035, delay: 0.06 });
    this._noise({ dur: 0.9, gain: 0.03, type: 'highpass', freq: 2400, q: 0.5 });
    [659.3, 880, 1318.5].forEach((f, i) => this._tone({ freq: f, type: 'sine', dur: 1.8, gain: 0.019, delay: 0.18 + i * 0.04 }));
  }

  playerHurt() {
    if (!this.ready) return;
    this._tone({ freq: 160, endFreq: 58, type: 'sawtooth', dur: 0.2, gain: 0.05 });
    this._noise({ dur: 0.13, gain: 0.12, type: 'lowpass', freq: 800, endFreq: 140, q: 0.8 });
  }

  victory() {
    if (!this.ready) return;
    [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => {
      this._tone({ freq: f, type: 'sine', dur: 3.2, gain: 0.035 - i * 0.003, delay: i * 0.18 });
      this._tone({ freq: f * 2.005, type: 'sine', dur: 1.6, gain: 0.009, delay: i * 0.18 });
    });
  }

  defeat() {
    if (!this.ready) return;
    [196, 174.6, 146.8, 110].forEach((f, i) => {
      this._tone({ freq: f, endFreq: f * 0.985, type: 'sine', dur: 2.4, gain: 0.045, delay: i * 0.22 });
    });
  }
}
