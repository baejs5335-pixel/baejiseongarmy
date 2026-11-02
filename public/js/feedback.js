// 화면/촉각 피드백: 십자선 확장, 히트마커, 데미지 숫자, 킬 콜아웃, 진동, 보정 디버그 링
import * as THREE from 'three';
import { config as cfg } from './config.js';

const $ = (s) => document.querySelector(s);
const DEG = Math.PI / 180;
const v = new THREE.Vector3();

// 조준경 레티클 (SVG, 중심 0,0)
const svg = (body) => `<svg viewBox="-100 -100 200 200" width="200" height="200">${body}</svg>`;
const milDots = [-56, -42, -28, -14, 14, 28, 42, 56]
  .map((d) => `<circle cx="${d}" cy="0" r="1.6"/><circle cx="0" cy="${d}" r="1.6"/>`).join('');
const RETICLES = {
  iron: svg('<circle r="1.6" fill="#fff" stroke="#000" stroke-width=".8"/>'),
  reddot: svg('<circle r="2.8" fill="#ff2a2a"/><circle r="5" fill="none" stroke="rgba(255,60,60,.35)" stroke-width="2"/>'),
  x2: svg('<circle r="2.2" fill="#ff2a2a"/><circle r="17" fill="none" stroke="#ff2a2a" stroke-width="1.4"/>'),
  x4: svg(`<g stroke="#111" stroke-width="1.6" fill="none">
      <path d="M-11 13 L0 0 L11 13" stroke="#ff3030" stroke-width="2"/>
      <line x1="-100" y1="0" x2="-24" y2="0"/><line x1="24" y1="0" x2="100" y2="0"/>
      <line x1="0" y1="24" x2="0" y2="100"/>
      <line x1="-8" y1="32" x2="8" y2="32"/><line x1="-6" y1="46" x2="6" y2="46"/><line x1="-4" y1="60" x2="4" y2="60"/></g>`),
  x8: svg(`<g stroke="#111" stroke-width="1.2"><line x1="-100" y1="0" x2="-4" y2="0"/><line x1="4" y1="0" x2="100" y2="0"/>
      <line x1="0" y1="-100" x2="0" y2="-4"/><line x1="0" y1="4" x2="0" y2="100"/></g><g fill="#111">${milDots}</g>`),
};

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
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // 첫 터치 전에는 브라우저가 차단
    const s = cfg.vibrationScale;
    const pat = Array.isArray(p) ? p.map((x) => Math.max(1, Math.round(x * s))) : Math.max(1, Math.round(p * s));
    try { navigator.vibrate(pat); } catch { /* 미지원 */ }
  }

  // 소리 방향 표시: rel = 소리 방향 (플레이어 정면 기준 라디안, +면 왼쪽), kind = step | shot
  soundPing(rel, kind, strength) {
    if (!cfg.soundViz) return;
    const host = this.viz ||= document.getElementById('soundviz');
    const el = document.createElement('i');
    el.className = kind;
    el.dataset.life = kind === 'shot' ? 0.9 : 0.6;
    el.style.transform = `rotate(${-rel}rad)`;
    el.style.setProperty('--a', Math.min(1, 0.35 + strength));
    host.appendChild(el);
    while (host.children.length > 12) host.firstChild.remove();
  }

  // 킬마크: 처치마다 가운데에 배지가 튀어나오고, 4초 안의 연속 처치는 개수만큼 나란히 쌓임
  killmark(icon, rarity) {
    const host = this.km ||= document.getElementById('killmark');
    const now = performance.now();
    this.kmStreak = now - (this.kmLast || 0) < 4000 ? Math.min(5, (this.kmStreak || 0) + 1) : 1;
    this.kmLast = now;
    host.innerHTML = Array.from({ length: this.kmStreak }, (_, i) =>
      `<span class="km r${rarity}${i === this.kmStreak - 1 ? ' new' : ''}">${icon}</span>`).join('');
    host.classList.remove('show');
    void host.offsetWidth;
    host.classList.add('show');
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

  setOverlay(type) {
    if (type === this.overlayType) return;
    this.overlayType = type;
    this.scope.dataset.type = type || '';
    this.scope.classList.toggle('on', !!type);
    this.scope.querySelector('.ret').innerHTML = type ? RETICLES[type] : '';
  }

  update(dt, s) {
    // 십자선: 실제 탄퍼짐 각도를 화면 픽셀로 변환
    const half = Math.tan(this.cam.fov * DEG / 2);
    const gap = Math.tan(s.spreadDeg * DEG) / half * (innerHeight / 2);
    this.cross.style.setProperty('--gap', Math.max(5, gap + 3).toFixed(1) + 'px');
    this.cross.classList.toggle('on', s.onTarget);
    this.cross.classList.toggle('hide', s.hideCross);
    this.setOverlay(s.overlay);

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

    if (this.viz) {
      for (const el of [...this.viz.children]) {
        const life = +el.dataset.life - dt;
        el.dataset.life = life;
        el.style.opacity = String(Math.max(0, Math.min(1, life * 2)) * el.style.getPropertyValue('--a'));
        if (life <= 0) el.remove();
      }
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
