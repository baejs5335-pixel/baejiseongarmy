// 화면/촉각 피드백: 십자선 확장, 히트마커, 데미지 숫자, 킬 콜아웃, 진동, 보정 디버그 링
import * as THREE from 'three';
import { config as cfg } from './config.js';

const $ = (s) => document.querySelector(s);
const DEG = Math.PI / 180;
const v = new THREE.Vector3();

export class Feedback {
  constructor(camera, sfx) {
    this.cam = camera;
    this.sfx = sfx;
    this.cross = $('#crosshair');
    this.hm = $('#hitmarker');
    this.dmgLayer = $('#dmg-layer');
    this.callout = $('#callout');
    this.scope = $('#scope');
    this.ring = $('#assist-ring');
    this.nums = [];
  }

  vibrate(p) {
    if (!cfg.vibration || !navigator.vibrate || cfg.vibrationScale <= 0) return;
    const s = cfg.vibrationScale;
    const pat = Array.isArray(p) ? p.map((x) => Math.max(1, Math.round(x * s))) : Math.max(1, Math.round(p * s));
    try { navigator.vibrate(pat); } catch { /* 미지원 */ }
  }

  restart(el, ...cls) {
    el.classList.remove('show', 'head', 'kill');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('show', ...cls);
  }

  hit(res, w) {
    const cls = [];
    if (res.head) cls.push('head');
    if (res.kill) cls.push('kill');
    this.restart(this.hm, ...cls);
    this.sfx.hit(res.head);
    if (res.kill) {
      this.sfx.kill();
      this.callout.textContent = res.head ? '헤드샷!' : '처치!';
      this.restart(this.callout, ...(res.head ? ['head'] : []));
      this.vibrate([w.vib + 10, 40, 45]);
    } else {
      this.vibrate(w.vib + (res.head ? 22 : 10));
    }
    if (cfg.damageNumbers) {
      const el = document.createElement('div');
      el.className = 'dmg' + (res.head ? ' head' : '');
      el.textContent = Math.round(res.dmg);
      this.dmgLayer.appendChild(el);
      this.nums.push({ el, pos: res.point.clone().setY(res.point.y + 0.25), t: 0, dx: (Math.random() * 2 - 1) * 18 });
    }
  }

  update(dt, s) {
    // 십자선: 실제 탄퍼짐 각도를 화면 픽셀로 변환
    const half = Math.tan(this.cam.fov * DEG / 2);
    const gap = Math.tan(s.spreadDeg * DEG) / half * (innerHeight / 2);
    this.cross.style.setProperty('--gap', Math.max(5, gap + 3).toFixed(1) + 'px');
    this.cross.classList.toggle('on', s.onTarget);
    this.cross.classList.toggle('hide', s.scoped);
    this.scope.classList.toggle('on', s.scoped);

    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      v.copy(n.pos).project(this.cam);
      if (n.t > 0.75 || v.z > 1) { n.el.remove(); this.nums.splice(i, 1); continue; }
      const x = (v.x * 0.5 + 0.5) * innerWidth + n.dx * n.t;
      const y = (-v.y * 0.5 + 0.5) * innerHeight - n.t * 70;
      const pop = n.t < 0.08 ? 1.5 - n.t / 0.08 * 0.5 : 1;
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${pop})`;
      n.el.style.opacity = String(Math.min(1, (0.75 - n.t) / 0.25));
    }

    const a = s.assist;
    if (cfg.showAssistDebug && a.target) {
      v.copy(a.point).project(this.cam);
      const r = Math.tan(a.radiusDeg * DEG) / half * (innerHeight / 2);
      Object.assign(this.ring.style, {
        display: 'block',
        left: (v.x * 0.5 + 0.5) * innerWidth + 'px',
        top: (-v.y * 0.5 + 0.5) * innerHeight + 'px',
        width: r * 2 + 'px', height: r * 2 + 'px',
        borderColor: `rgba(80,220,255,${0.3 + a.weight * 0.7})`,
      });
    } else {
      this.ring.style.display = 'none';
    }
  }
}
