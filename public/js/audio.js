// WebAudio 합성 사운드 (에셋 없이 즉시 반응하는 총성/히트음)
import { config as cfg } from './config.js';

export class Sfx {
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  env(g, t, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + decay);
  }

  shot(w) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, s = w.sfx;
    this.master.gain.value = cfg.volume;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(s.cut, t);
    f.frequency.exponentialRampToValueAtTime(s.cut * 0.2, t + s.decay);
    const g = c.createGain();
    this.env(g, t, s.gain, s.decay);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + s.decay + 0.05);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(s.thump, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.12);
    const og = c.createGain();
    this.env(og, t, s.gain * 0.9, 0.12);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  tone(freq, dur, type = 'square', vol = 0.2, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    this.master.gain.value = cfg.volume;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    this.env(g, t, vol, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hit(head) {
    if (head) { this.tone(1900, 0.05, 'square', 0.14); this.tone(2700, 0.09, 'sine', 0.22, 0.025); }
    else this.tone(1300, 0.04, 'square', 0.12);
  }
  kill() { this.tone(660, 0.08, 'triangle', 0.25, 0.04); this.tone(990, 0.16, 'triangle', 0.25, 0.11); }
  dry() { this.tone(900, 0.02, 'square', 0.08); }
  reload() { this.tone(420, 0.03, 'square', 0.1); this.tone(300, 0.03, 'square', 0.1, 0.22); }
  reloadDone() { this.tone(620, 0.03, 'square', 0.1); }
}
