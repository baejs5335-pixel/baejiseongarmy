// 회전형 미니맵: 내가 바라보는 방향이 항상 위. 아군은 늘 보이고, 적은 총을 쏜 직후(또는 내 시야 안)만 표시
import { config as cfg } from './config.js';
import { COLORS } from './maps.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class Minimap {
  constructor(map) {
    this.map = map;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
  }

  // dots: [{ pos, team, dead, isPlayer, revealUntil }] / now: 매치 시간 (훈련장이면 표적 항상 표시)
  draw(P, dots, now, alwaysShowEnemies) {
    const cv = this.canvas;
    const size = cv.clientWidth;
    if (!size) return;
    const dpr = Math.min(devicePixelRatio, 2);
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); }
    const c = this.ctx, R = size / 2, s = R / cfg.minimapRange;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath();
    c.arc(R, R, R - 1, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(14,17,27,.72)';
    c.fillRect(0, 0, size, size);
    c.translate(R, R);
    c.rotate(P.yaw);
    const px = P.pos.x, pz = P.pos.z;
    for (const b of this.map.boxes) {
      c.fillStyle = hex(COLORS[b.type]);
      c.globalAlpha = b.type === 'low' ? 0.55 : 0.9;
      c.fillRect((b.x - b.w / 2 - px) * s, (b.z - b.d / 2 - pz) * s, b.w * s, b.d * s);
    }
    c.globalAlpha = 1;
    for (const d of dots) {
      if (d.dead || d.isPlayer) continue;
      const enemy = d.team !== 'A';
      if (enemy && !alwaysShowEnemies && !((d.revealUntil || 0) > now)) continue;
      c.fillStyle = enemy ? '#ff4a3d' : '#4aa8ff';
      c.beginPath();
      c.arc((d.pos.x - px) * s, (d.pos.z - pz) * s, enemy ? 3.6 : 3, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // 나 (가운데, 항상 위쪽을 향함)
    c.fillStyle = '#fff';
    c.strokeStyle = '#000';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(R, R - 7); c.lineTo(R + 5, R + 5); c.lineTo(R, R + 2); c.lineTo(R - 5, R + 5); c.closePath();
    c.stroke();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(R, R, R - 1, 0, Math.PI * 2);
    c.stroke();
  }
}
