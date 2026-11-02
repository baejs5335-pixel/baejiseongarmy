// 멀티터치 입력: 왼쪽 = 이동 패드, 오른쪽 = 시점 회전, 발사 버튼 드래그 = 쏘면서 회전.
// 마우스는 터치와 똑같이 동작하므로 PC에서도 모바일 조작감을 그대로 테스트할 수 있습니다.
import { config as cfg } from './config.js';

const $ = (s) => document.querySelector(s);

export class Input {
  constructor() {
    this.moveX = 0; this.moveY = 0;
    this.lookX = 0; this.lookY = 0;
    this.firePressed = false; this.adsToggle = false; this.reload = false; this.weapon = null;
    this.keys = new Set();
    this.mouseFire = false;
    this.locked = false;
    this.joy = { id: null, ox: 0, oy: 0 };
    this.looks = new Map();          // pointerId -> {x, y, t}
    this.fires = new Map();          // pointerId -> 버튼 엘리먼트

    this.layer = $('#touch-layer');
    this.joyBase = $('#joy-base');
    this.joyKnob = $('#joy-knob');

    this.layer.addEventListener('pointerdown', (e) => this.onDown(e));
    addEventListener('pointermove', (e) => this.onMove(e));
    addEventListener('pointerup', (e) => this.onUp(e));
    addEventListener('pointercancel', (e) => this.onUp(e));

    document.querySelectorAll('[data-action=fire]').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.fires.set(e.pointerId, b);
        this.firePressed = true;
        b.classList.add('pressed');
        if (cfg.fireBtnLook) this.startLook(e);
      }));
    $('#btn-ads').addEventListener('pointerdown', (e) => { e.preventDefault(); this.adsToggle = true; });
    $('#btn-reload').addEventListener('pointerdown', (e) => { e.preventDefault(); this.reload = true; });
    document.querySelectorAll('[data-weapon]').forEach((b) =>
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.weapon = b.dataset.weapon; }));

    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => { this.keys.clear(); this.mouseFire = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.layer;
      if (!this.locked) this.mouseFire = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX * 0.5;
      this.lookY += e.movementY * 0.5;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.firePressed = true; this.mouseFire = true; }
      if (e.button === 2) this.adsToggle = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseFire = false; });

    this.applyConfig();
  }

  applyConfig() {
    const d = cfg.joyRadius * 2;
    Object.assign(this.joyBase.style, { width: d + 'px', height: d + 'px', margin: `${-cfg.joyRadius}px 0 0 ${-cfg.joyRadius}px` });
    $('#btn-fire-left').classList.toggle('off', !cfg.leftFire);
    if (this.joy.id === null) this.resetJoyVisual();
  }

  joyHome() {
    return { x: 40 + cfg.joyRadius + 50, y: innerHeight - cfg.joyRadius - 50 };
  }

  resetJoyVisual() {
    const h = this.joyHome();
    this.joyBase.style.left = h.x + 'px';
    this.joyBase.style.top = h.y + 'px';
    this.joyKnob.style.transform = '';
    this.joyBase.classList.remove('active');
  }

  onDown(e) {
    if (this.locked) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.42 && this.joy.id === null) {
      this.joy.id = e.pointerId;
      const h = cfg.joyFloating ? { x: e.clientX, y: e.clientY } : this.joyHome();
      this.joy.ox = h.x; this.joy.oy = h.y;
      this.joyBase.classList.add('active');
      this.updateJoy(e.clientX, e.clientY);
    } else {
      this.startLook(e);
    }
  }

  startLook(e) {
    this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
  }

  onMove(e) {
    if (e.pointerId === this.joy.id) this.updateJoy(e.clientX, e.clientY);
    const p = this.looks.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    const dt = Math.max(1, e.timeStamp - p.t);
    // 회전 가속: 빠르게(px/ms) 밀수록 배율 증가
    const v = Math.hypot(dx, dy) / dt;
    const mul = 1 + cfg.lookAccel * Math.min(Math.max(v - 0.3, 0), 3);
    this.lookX += dx * mul;
    this.lookY += dy * mul;
    p.x = e.clientX; p.y = e.clientY; p.t = e.timeStamp;
  }

  onUp(e) {
    if (e.pointerId === this.joy.id) {
      this.joy.id = null;
      this.moveX = this.moveY = 0;
      this.resetJoyVisual();
    }
    this.looks.delete(e.pointerId);
    const b = this.fires.get(e.pointerId);
    if (b) {
      this.fires.delete(e.pointerId);
      if (![...this.fires.values()].includes(b)) b.classList.remove('pressed');
    }
  }

  updateJoy(x, y) {
    const R = cfg.joyRadius;
    let dx = x - this.joy.ox, dy = y - this.joy.oy;
    let d = Math.hypot(dx, dy);
    if (cfg.joyFloating && d > R) {
      // 플로팅: 손가락이 반경을 넘으면 패드가 따라옴
      const over = d - R;
      this.joy.ox += dx / d * over;
      this.joy.oy += dy / d * over;
      dx = x - this.joy.ox; dy = y - this.joy.oy; d = R;
    }
    const cl = Math.min(d, R);
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
    const mag = cl / R, dz = cfg.joyDeadzone;
    const m = mag < dz ? 0 : (mag - dz) / (1 - dz);
    this.moveX = nx * m;
    this.moveY = -ny * m;
    this.joyBase.style.left = this.joy.ox + 'px';
    this.joyBase.style.top = this.joy.oy + 'px';
    this.joyKnob.style.transform = `translate(${nx * cl}px, ${ny * cl}px)`;
  }

  onKey(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (down) {
      if (!e.repeat) {
        if (e.code === 'Space') this.firePressed = true;
        if (e.code === 'KeyQ') this.adsToggle = true;
        if (e.code === 'KeyR') this.reload = true;
        if (e.code === 'KeyL') {
          if (this.locked) document.exitPointerLock();
          else this.layer.requestPointerLock?.();
        }
        const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (n >= 0) this.weapon = ['AR', 'SR', 'SG', 'HG'][n];
      }
      this.keys.add(e.code);
    } else {
      this.keys.delete(e.code);
    }
  }

  consume() {
    let mx = this.moveX, my = this.moveY;
    const k = this.keys;
    if (k.has('KeyW') || k.has('KeyA') || k.has('KeyS') || k.has('KeyD')) {
      mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      my = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
    }
    const out = {
      moveX: mx, moveY: my,
      lookX: this.lookX, lookY: this.lookY,
      lookActive: this.looks.size > 0 || (this.locked && (this.lookX !== 0 || this.lookY !== 0)),
      fireHeld: this.fires.size > 0 || this.mouseFire || k.has('Space'),
      firePressed: this.firePressed,
      adsToggle: this.adsToggle,
      reload: this.reload,
      weapon: this.weapon,
    };
    this.lookX = this.lookY = 0;
    this.firePressed = this.adsToggle = this.reload = false;
    this.weapon = null;
    return out;
  }
}
