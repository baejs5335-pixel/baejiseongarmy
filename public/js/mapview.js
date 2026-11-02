// 맵 분석 화면: 위에서 본 레이아웃 + 시야선 분석
//  - 노출도: 각 지점이 맵의 다른 지점 몇 %에서 보이는지 (빨강 = 위험한 열린 곳)
//  - 최대 시야거리: 각 지점에서 볼 수 있는 가장 먼 거리 (빨강 = 저격 라인, 파랑 = 근접전)
//  - 내 시야선: 현재 위치·자세에서 보이는 영역
// 서서/앉아서 자세에 따라 낮은 엄폐물이 시야를 막는지가 달라집니다.
import { COLORS } from './maps.js';

const CELL = 2.5;
const STANCE_H = { stand: 1.5, crouch: 0.95 };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// 선분(a→b)이 상자 중 하나라도 통과하면 true (2D 슬랩 테스트)
function segBlocked(ax, az, bx, bz, list) {
  const dx = bx - ax, dz = bz - az;
  for (const b of list) {
    let t0 = 0, t1 = 1;
    if (dx !== 0) {
      let u = (b.x0 - ax) / dx, v = (b.x1 - ax) / dx;
      if (u > v) { const t = u; u = v; v = t; }
      if (u > t0) t0 = u;
      if (v < t1) t1 = v;
      if (t0 >= t1) continue;
    } else if (ax <= b.x0 || ax >= b.x1) continue;
    if (dz !== 0) {
      let u = (b.z0 - az) / dz, v = (b.z1 - az) / dz;
      if (u > v) { const t = u; u = v; v = t; }
      if (u > t0) t0 = u;
      if (v < t1) t1 = v;
      if (t0 >= t1) continue;
    } else if (az <= b.z0 || az >= b.z1) continue;
    return true;
  }
  return false;
}

// 반직선이 처음 막히는 거리
function rayDist(ax, az, dx, dz, maxD, list) {
  let best = maxD;
  for (const b of list) {
    let t0 = 0, t1 = best;
    if (dx !== 0) {
      let u = (b.x0 - ax) / dx, v = (b.x1 - ax) / dx;
      if (u > v) { const t = u; u = v; v = t; }
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    } else if (ax <= b.x0 || ax >= b.x1) continue;
    if (dz !== 0) {
      let u = (b.z0 - az) / dz, v = (b.z1 - az) / dz;
      if (u > v) { const t = u; u = v; v = t; }
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    } else if (az <= b.z0 || az >= b.z1) continue;
    if (t0 < t1) best = t0;
  }
  return best;
}

export class MapView {
  constructor(map, world, onTeleport) {
    this.map = map;
    this.world = world;
    this.onTeleport = onTeleport;
    this.heat = 'none';
    this.stance = 'stand';
    this.fan = true;
    this.cache = {};
    this.el = document.getElementById('mapview');
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="mv-bar">
        <b>🗺 ${map.name}</b>
        <span class="mv-group">
          <button data-heat="none">히트맵 끔</button>
          <button data-heat="exposure">노출도</button>
          <button data-heat="range">최대 시야거리</button>
        </span>
        <button data-stance>자세: 서서</button>
        <button data-fan>내 시야선</button>
        <button data-close>닫기</button>
      </div>
      <div class="mv-side"></div>
      <div class="mv-hint">${onTeleport ? '맵을 탭하면 그 위치로 이동합니다' : '매치 중에는 순간이동할 수 없습니다'}</div>`;
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.side = this.el.querySelector('.mv-side');
    this.el.querySelectorAll('[data-heat]').forEach((b) => b.addEventListener('click', () => { this.heat = b.dataset.heat; this.syncUi(); }));
    this.el.querySelector('[data-stance]').addEventListener('click', () => { this.stance = this.stance === 'stand' ? 'crouch' : 'stand'; this.syncUi(); });
    this.el.querySelector('[data-fan]').addEventListener('click', () => { this.fan = !this.fan; this.syncUi(); });
    this.el.querySelector('[data-close]').addEventListener('click', () => this.toggle(false));
    this.canvas.addEventListener('pointerdown', (e) => this.onTap(e));
    this.syncUi();
  }

  get open() { return !this.el.hidden; }

  toggle(open = !this.open) {
    this.el.hidden = !open;
    document.getElementById('btn-map').classList.toggle('on', open);
  }

  syncUi() {
    this.el.querySelectorAll('[data-heat]').forEach((b) => b.classList.toggle('on', b.dataset.heat === this.heat));
    this.el.querySelector('[data-stance]').textContent = `자세: ${this.stance === 'stand' ? '서서' : '앉아서'}`;
    this.el.querySelector('[data-fan]').classList.toggle('on', this.fan);
    if (this.heat !== 'none') this.ensureGrid();
    this.renderSide();
  }

  blockers(h) {
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    return this.map.boxes
      .filter((b) => b.h > h - 0.05)
      .map((b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }))
      .filter((b) => b.x1 > minX && b.x0 < maxX && b.z1 > minZ && b.z0 < maxZ);
  }

  ensureGrid() {
    const key = this.stance;
    if (this.cache[key] || this.computing) return;
    this.computing = true;
    this.renderSide();
    setTimeout(() => {
      this.cache[key] = this.computeGrid(STANCE_H[key]);
      this.computing = false;
      this.renderSide();
    }, 30);
  }

  computeGrid(h) {
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    const list = this.blockers(h);
    const cells = [];
    for (let x = minX + CELL / 2; x < maxX; x += CELL) {
      for (let z = minZ + CELL / 2; z < maxZ; z += CELL) {
        if (!this.world.insideBox(x, z, 0.2)) cells.push({ x, z });
      }
    }
    const n = cells.length;
    const exp = new Float32Array(n), rng = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = cells[i];
      for (let j = i + 1; j < n; j++) {
        const b = cells[j];
        if (segBlocked(a.x, a.z, b.x, b.z, list)) continue;
        exp[i]++; exp[j]++;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > rng[i]) rng[i] = d;
        if (d > rng[j]) rng[j] = d;
      }
    }
    for (let i = 0; i < n; i++) exp[i] /= n;
    let maxExp = 0;
    for (let i = 0; i < n; i++) maxExp = Math.max(maxExp, exp[i]);
    // 구역별 요약
    const zones = this.map.zones.map((z) => {
      let cnt = 0, sumE = 0, maxR = 0;
      cells.forEach((c, i) => {
        if (c.x < z.x0 || c.x > z.x1 || c.z < z.z0 || c.z > z.z1) return;
        cnt++; sumE += exp[i]; maxR = Math.max(maxR, rng[i]);
      });
      return { name: z.name, avgExp: cnt ? sumE / cnt : 0, maxRange: maxR };
    });
    return { cells, exp, rng, maxExp, zones };
  }

  renderSide() {
    const g = this.cache[this.stance];
    const legend = {
      none: '<span class="sw" style="background:#9ec3e6"></span>낮은 엄폐물 1.05m (앉으면 숨음)<br>'
        + '<span class="sw" style="background:#e39b4b"></span>높은 엄폐물 2.2m (완전 은폐)<br>'
        + '<span class="sw" style="background:#5c7aa6"></span>벽 3.5m',
      exposure: '<span class="ramp"></span><br>파랑 = 적게 노출 (안전) · 빨강 = 많은 곳에서 보임 (위험)',
      range: '<span class="ramp"></span><br>파랑 = 짧은 시야 (근접전) · 빨강 = 80m+ (저격 유리)',
    }[this.heat];
    let html = `<div class="mv-legend">${legend}</div>`;
    if (this.heat !== 'none') {
      if (this.computing || !g) html += '<p>시야선 계산 중…</p>';
      else {
        html += `<table><tr><th>구역</th><th>평균 노출</th><th>최장 시야</th></tr>${g.zones.map((z) =>
          `<tr><td>${z.name}</td><td>${(z.avgExp * 100).toFixed(0)}%</td><td>${z.maxRange.toFixed(0)}m</td></tr>`).join('')}</table>`;
      }
    }
    this.side.innerHTML = html;
  }

  layout() {
    const dpr = Math.min(devicePixelRatio, 2);
    const W = innerWidth, Hh = innerHeight;
    if (this.canvas.width !== W * dpr || this.canvas.height !== Hh * dpr) {
      this.canvas.width = W * dpr;
      this.canvas.height = Hh * dpr;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    const sideW = Math.min(250, W * 0.3);
    const availW = W - sideW - 24, availH = Hh - 64;
    // 긴 축(z)을 가로로: 왼쪽 = A 스폰, 오른쪽 = B 스폰
    this.s = Math.min(availW / (maxZ - minZ), availH / (maxX - minX));
    this.ox = 12 + (availW - (maxZ - minZ) * this.s) / 2;
    this.oy = 52 + (availH - (maxX - minX) * this.s) / 2;
  }

  sx(z) { return this.ox + (this.map.bounds.maxZ - z) * this.s; }
  sy(x) { return this.oy + (x - this.map.bounds.minX) * this.s; }

  onTap(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const z = this.map.bounds.maxZ - (px - this.ox) / this.s;
    const x = this.map.bounds.minX + (py - this.oy) / this.s;
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    if (x < minX + 0.5 || x > maxX - 0.5 || z < minZ + 0.5 || z > maxZ - 0.5) return;
    if (this.world.insideBox(x, z, 0.4) || !this.onTeleport) return;
    this.onTeleport(x, z);
  }

  rect(x0, x1, z0, z1) {
    // x는 세로, z는 가로(반전)
    const a = this.sx(z1), b = this.sx(z0);
    return [a, this.sy(x0), b - a, this.sy(x1) - this.sy(x0)];
  }

  draw(P, eyeH, markers) {
    if (!this.open) return;
    this.layout();
    const c = this.ctx, m = this.map, { minX, maxX, minZ, maxZ } = m.bounds;
    c.fillStyle = '#0e1220';
    c.fillRect(0, 0, innerWidth, innerHeight);
    c.fillStyle = '#e9dcae';
    c.fillRect(...this.rect(minX, maxX, minZ, maxZ));
    for (const z of m.zones) {
      if (!z.floor) continue;
      c.fillStyle = hex(z.floor);
      c.fillRect(...this.rect(z.x0, z.x1, z.z0, z.z1));
    }

    const g = this.cache[this.stance];
    if (this.heat !== 'none' && g) {
      const cs = CELL * this.s;
      g.cells.forEach((cell, i) => {
        const t = this.heat === 'exposure' ? g.exp[i] / g.maxExp : Math.min(1, g.rng[i] / 80);
        c.fillStyle = `hsla(${(1 - t) * 220}, 85%, 52%, .6)`;
        c.fillRect(this.sx(cell.z) - cs / 2, this.sy(cell.x) - cs / 2, cs + 0.5, cs + 0.5);
      });
    }

    for (const b of m.boxes) {
      c.fillStyle = hex(COLORS[b.type]);
      const r = this.rect(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2);
      c.fillRect(...r);
      c.strokeStyle = '#1b1d2a';
      c.lineWidth = 1;
      c.strokeRect(...r);
    }

    // 내 시야선 (현재 자세의 눈높이 기준)
    if (this.fan) {
      const list = this.blockers(eyeH);
      c.beginPath();
      let longest = 0;
      for (let i = 0; i <= 360; i++) {
        const a = i / 360 * Math.PI * 2;
        const dx = Math.sin(a), dz = Math.cos(a);
        const d = rayDist(P.pos.x, P.pos.z, dx, dz, 140, list);
        longest = Math.max(longest, d);
        const px = this.sx(P.pos.z + dz * d), py = this.sy(P.pos.x + dx * d);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fillStyle = 'rgba(255,230,80,.22)';
      c.fill();
      c.strokeStyle = 'rgba(255,210,40,.7)';
      c.stroke();
      this.longest = longest;
    }

    c.font = 'bold 12px system-ui, sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 3;
    for (const z of m.zones) {
      const x = this.sx((z.z0 + z.z1) / 2), y = this.sy((z.x0 + z.x1) / 2);
      c.strokeStyle = 'rgba(0,0,0,.65)';
      c.strokeText(z.name, x, y);
      c.fillStyle = '#fff';
      c.fillText(z.name, x, y);
    }

    for (const [team, color] of [['A', '#3d7fe0'], ['B', '#e0503d']]) {
      for (const s of m.spawns[team]) {
        c.fillStyle = color;
        c.beginPath();
        c.arc(this.sx(s.z), this.sy(s.x), 4, 0, Math.PI * 2);
        c.fill();
      }
    }
    for (const b of markers) {
      if (b.dead || b.isPlayer) continue;
      const p = b.pos;
      c.fillStyle = b.team === 'A' ? '#4aa8ff' : '#ff3b3b';
      c.strokeStyle = '#000';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(this.sx(p.z), this.sy(p.x), 3.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    // 플레이어 화살표
    const px = this.sx(P.pos.z), py = this.sy(P.pos.x);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const ang = Math.atan2(this.sy(P.pos.x + fx) - py, this.sx(P.pos.z + fz) - px);
    c.save();
    c.translate(px, py);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(10, 0); c.lineTo(-6, -6); c.lineTo(-3, 0); c.lineTo(-6, 6); c.closePath();
    c.fillStyle = '#fff';
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.stroke();
    c.fill();
    c.restore();

    // 축척 막대 (10m)
    const bx = this.ox, by = this.sy(maxX) + 16;
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 10 * this.s, by); c.stroke();
    c.fillStyle = '#fff';
    c.textAlign = 'left';
    c.font = '11px system-ui, sans-serif';
    c.fillText('10m', bx + 10 * this.s + 6, by + 4);
    if (this.fan) c.fillText(`내 최장 시야 ${this.longest.toFixed(0)}m (${eyeH < 1.2 ? '앉아서' : '서서'})`, bx + 10 * this.s + 46, by + 4);
  }
}
