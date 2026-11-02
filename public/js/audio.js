// 사운드 엔진 (WebAudio 합성, 에셋 없음)
//  - 3D: 월드 소리는 PannerNode(HRTF)로 위치를 잡고, 리스너는 매 프레임 카메라를 따라감
//  - 가림: 벽 너머 소리는 저역 통과로 먹먹하게 / 거리: 멀수록 고음이 깎이고 소리 속도만큼 늦게 도착
//  - 총성은 4겹(총구 클릭 · 몸통 · 저음 펀치 · 잔향) + 탄피/노리쇠/펌프, 재장전은 단계별
import { config as cfg } from './config.js';

// 바닥 재질별 발소리
const SURF = {
  sand:   { f: 520,  q: 0.9, dur: 0.07, click: 0,    ring: 0 },
  gravel: { f: 1500, q: 0.7, dur: 0.09, click: 0.15, ring: 0 },
  wood:   { f: 380,  q: 2.5, dur: 0.08, click: 0.3,  ring: 0 },
  metal:  { f: 2200, q: 3,   dur: 0.06, click: 0.35, ring: 820 },
};

export class Sfx {
  constructor() {
    this.lp = { x: 0, y: 0, z: 0 };
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(c.destination);
      this.master = c.createGain();
      this.master.connect(comp);
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 잔향(간이 에코) 버스
      this.echo = c.createGain();
      const delay = c.createDelay(1);
      delay.delayTime.value = 0.11;
      const fb = c.createGain();
      fb.gain.value = 0.3;
      const lpf = c.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 2000;
      const wet = c.createGain();
      wet.gain.value = 0.55;
      this.echo.connect(delay).connect(lpf).connect(fb).connect(delay);
      lpf.connect(wet).connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get t() { return this.ctx.currentTime; }

  // 리스너 = 카메라 (위치 + 바라보는 방향)
  setListener(pos, fwd) {
    if (!this.ctx) return;
    this.lp = { x: pos.x, y: pos.y, z: pos.z };
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t);
      L.forwardX.setValueAtTime(fwd.x, t); L.forwardY.setValueAtTime(fwd.y, t); L.forwardZ.setValueAtTime(fwd.z, t);
      L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  dist(pos) { return Math.hypot(pos.x - this.lp.x, pos.y - this.lp.y, pos.z - this.lp.z); }

  // 출력 체인 입구를 돌려줌: [저역 통과] → 게인 → [패너] → 마스터
  chain(pos, { gain = 1, occluded = false, far = 0 } = {}) {
    const c = this.ctx;
    this.master.gain.value = cfg.volume;
    const g = c.createGain();
    g.gain.value = gain;
    let input = g;
    if (occluded || far > 15) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.min(occluded ? 650 : 20000, Math.max(900, 12000 - far * 140));
      lp.connect(g);
      input = lp;
    }
    if (pos) {
      const p = c.createPanner();
      p.panningModel = cfg.hrtf ? 'HRTF' : 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 2.5;
      p.maxDistance = 150;
      p.rolloffFactor = 1.1;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
      else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    return input;
  }

  env(param, t, peak, decay, attack = 0.002) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  burst(dest, t, { type = 'lowpass', f, f2, q = 0.8, peak, decay, rate = 1 }) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.playbackRate.value = rate;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + decay);
    const g = c.createGain();
    this.env(g.gain, t, peak, decay);
    n.connect(fl).connect(g).connect(dest);
    n.start(t, Math.random() * 0.5);
    n.stop(t + decay + 0.05);
  }

  osc(dest, t, { type = 'sine', f, f2, peak, decay }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + decay);
    const g = c.createGain();
    this.env(g.gain, t, peak, decay);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  // ── 총성 ────────────────────────────────
  gunshot(w, pos, { gain = 1, occluded = false } = {}) {
    if (!this.ctx || gain <= 0.01) return;
    const s = w.sfx;
    const far = pos ? this.dist(pos) : 0;
    const t = this.t + (pos ? Math.min(0.35, far / 343) : 0); // 소리 속도
    const out = this.chain(pos, { gain, occluded, far });
    this.burst(out, t, { type: 'highpass', f: 2600, peak: s.gain * 0.55, decay: 0.014 });
    this.burst(out, t, { f: s.cut, f2: s.cut * 0.2, peak: s.gain, decay: s.decay, rate: 0.85 + Math.random() * 0.3 });
    if (s.thump) this.osc(out, t, { f: s.thump, f2: 35, peak: s.gain * 0.9, decay: 0.12 });
    // 잔향: 멀수록·가려질수록 비중이 커짐
    const tail = this.ctx.createGain();
    tail.gain.value = gain * (0.25 + Math.min(0.5, far / 120) + (occluded ? 0.2 : 0));
    tail.connect(this.echo);
    this.burst(tail, t, { f: s.cut * 0.5, peak: s.gain * 0.5, decay: s.decay * 1.6 });
    // 원거리 총성의 "탕—" 하는 메아리
    if (far > 40) this.burst(out, t + 0.18 + far / 900, { f: 600, peak: s.gain * 0.25, decay: 0.25 });
  }

  // 내 총 (위치 없음) + 탄피/노리쇠/펌프
  shot(w, vol = 1) {
    if (!this.ctx) return;
    this.gunshot(w, null, { gain: vol });
    const t = this.t;
    if (w.key === 'SR') this.bolt(t + 0.38);
    else if (w.key === 'SG') this.pump(t + 0.32);
    else if (Math.random() < 0.6) this.shell(t + 0.28 + Math.random() * 0.1);
  }

  shotAt(w, pos, occluded, gain = 1) { this.gunshot(w, pos, { gain, occluded }); }

  shell(t) {
    const out = this.chain(null, { gain: 0.12 });
    const f = 3200 + Math.random() * 1500;
    this.osc(out, t, { f, peak: 0.5, decay: 0.05 });
    this.osc(out, t + 0.07, { f: f * 1.12, peak: 0.3, decay: 0.04 });
  }

  bolt(t) {
    const out = this.chain(null, { gain: 0.3 });
    this.burst(out, t, { type: 'bandpass', f: 2400, q: 4, peak: 0.6, decay: 0.03 });
    this.burst(out, t + 0.16, { type: 'bandpass', f: 1600, q: 3, peak: 0.7, decay: 0.04 });
  }

  pump(t) {
    const out = this.chain(null, { gain: 0.3 });
    this.burst(out, t, { type: 'bandpass', f: 900, f2: 1800, q: 2, peak: 0.6, decay: 0.09 });
    this.burst(out, t + 0.17, { type: 'bandpass', f: 1500, f2: 700, q: 2, peak: 0.7, decay: 0.08 });
  }

  // 재장전 단계: out(탄창 분리) → in(탄창 결합) → bolt(노리쇠, 빈 탄창일 때)
  reloadStep(kind) {
    if (!this.ctx) return;
    const t = this.t, out = this.chain(null, { gain: 0.35 });
    if (kind === 'out') {
      this.burst(out, t, { type: 'bandpass', f: 2200, q: 5, peak: 0.6, decay: 0.03 });
      this.burst(out, t + 0.05, { type: 'bandpass', f: 1200, f2: 600, q: 1.5, peak: 0.35, decay: 0.12 });
    } else if (kind === 'in') {
      this.burst(out, t, { type: 'bandpass', f: 700, q: 2, peak: 0.8, decay: 0.05 });
      this.osc(out, t, { f: 180, f2: 90, peak: 0.4, decay: 0.06 });
      this.burst(out, t + 0.06, { type: 'bandpass', f: 2600, q: 6, peak: 0.5, decay: 0.025 });
    } else {
      this.bolt(t);
    }
  }
  reload() { this.reloadStep('out'); }
  reloadDone() { this.tone(620, 0.03, 'square', 0.08); }

  // ── 발소리 ──────────────────────────────
  footstep(pos, { surface = 'sand', gain = 1, occluded = false } = {}) {
    if (!this.ctx || gain <= 0.01) return;
    const S = SURF[surface] || SURF.sand;
    const far = pos ? this.dist(pos) : 0;
    const t = this.t;
    const out = this.chain(pos, { gain, occluded, far });
    const v = 0.85 + Math.random() * 0.3;
    this.burst(out, t, { type: 'bandpass', f: S.f * v, q: S.q, peak: 0.9, decay: S.dur });
    this.osc(out, t, { f: 90 * v, f2: 50, peak: 0.5, decay: 0.05 });
    if (S.click) this.burst(out, t + 0.01, { type: 'highpass', f: 3500, peak: S.click, decay: 0.015 });
    if (S.ring) this.osc(out, t, { type: 'triangle', f: S.ring * v, peak: 0.12, decay: 0.12 });
  }

  land(surface) { this.footstep(null, { surface, gain: 0.7 }); this.footstep(null, { surface, gain: 0.5 }); }

  // ── UI · 근접 · 기타 ─────────────────────
  tone(freq, dur, type = 'square', vol = 0.2, delay = 0) {
    if (!this.ctx) return;
    this.osc(this.chain(null), this.t + delay, { type, f: freq, peak: vol, decay: dur });
  }

  hit(head) {
    if (head) { this.tone(1900, 0.05, 'square', 0.14); this.tone(2700, 0.09, 'sine', 0.22, 0.025); }
    else this.tone(1300, 0.04, 'square', 0.12);
  }
  kill() { this.tone(660, 0.08, 'triangle', 0.25, 0.04); this.tone(990, 0.16, 'triangle', 0.25, 0.11); }
  dry() { this.tone(900, 0.02, 'square', 0.08); }
  hurt() { this.tone(180, 0.09, 'sawtooth', 0.18); }

  // 녹음 파일 재생 (보이스 팩). radio = 무전기 음질(대역 제한 + 약한 찌그러짐) + 잡음
  async playFile(url, { radio = false, gain = 1 } = {}) {
    if (!this.ctx) return;
    this.files ||= {};
    try {
      this.files[url] ||= fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b));
      const buf = await this.files[url];
      const c = this.ctx, src = c.createBufferSource();
      src.buffer = buf;
      const out = this.chain(null, { gain });
      if (radio) {
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        const ws = c.createWaveShaper();
        ws.curve = Float32Array.from({ length: 256 }, (_, i) => Math.tanh((i / 128 - 1) * 2.2));
        src.connect(hp).connect(lp).connect(ws).connect(out);
        this.radio(true);
        src.onended = () => this.radio(false);
      } else src.connect(out);
      src.start();
    } catch { delete this.files[url]; }
  }

  // 무전기: 켤 때 "치익" + 짧은 비프, 끌 때 "칙"
  radio(open) {
    if (!this.ctx) return;
    const out = this.chain(null, { gain: 0.22 }), t = this.t;
    this.burst(out, t, { type: 'bandpass', f: 2600, q: 1.5, peak: 0.8, decay: open ? 0.12 : 0.07 });
    if (open) this.osc(out, t + 0.02, { type: 'square', f: 1800, peak: 0.15, decay: 0.04 });
  }

  swing(heavy, pos) {
    if (!this.ctx) return;
    const out = this.chain(pos || null, { gain: heavy ? 0.5 : 0.35, far: pos ? this.dist(pos) : 0 });
    this.burst(out, this.t, { type: 'bandpass', f: heavy ? 700 : 1400, f2: heavy ? 2200 : 3800, q: 1.2, peak: 1, decay: heavy ? 0.2 : 0.13 });
  }
}
