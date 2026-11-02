// 조준 보정: 보정 반경 안의 가장 가까운 적을 찾아
//  - friction: 회전 감도를 줄여 십자선이 적 위에 머물게 하고
//  - magnetism: 입력 중일 때 적 쪽으로 살짝 끌어당깁니다 (main.js에서 적용)
import * as THREE from 'three';

const DEG = Math.PI / 180;
const fwd = new THREE.Vector3();
const pt = new THREE.Vector3();

export class AimAssist {
  constructor() {
    this.target = null;
    this.point = new THREE.Vector3();
    this.yawErr = 0; this.pitchErr = 0;
    this.weight = 0; this.friction = 1; this.radiusDeg = 0;
  }

  update(eye, yaw, pitch, world, cfg) {
    this.target = null;
    this.friction = 1;
    this.weight = 0;
    if (!cfg.assistEnabled) return this;
    fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    let best = 1;
    for (const b of world.bots) {
      if (b.dead) continue;
      b.aimPoint(eye, fwd, pt);
      const dx = pt.x - eye.x, dy = pt.y - eye.y, dz = pt.z - eye.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 60 || dist < 0.5) continue;
      const ang = Math.acos(Math.min(1, (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist)) / DEG;
      // 몸통 반폭 + 거리 보정된 반경 (가까울수록 넓게, 멀수록 좁게)
      const rad = Math.atan(0.4 / dist) / DEG + cfg.assistRadius * Math.min(1.2, Math.max(0.35, 12 / dist));
      const ratio = ang / rad;
      if (ratio >= best) continue;
      if (world.blocked(eye, pt)) continue;
      best = ratio;
      this.target = b;
      this.point.copy(pt);
      this.radiusDeg = rad;
      const ye = Math.atan2(-dx, -dz) - yaw;
      this.yawErr = Math.atan2(Math.sin(ye), Math.cos(ye));
      this.pitchErr = Math.asin(dy / dist) - pitch;
    }
    if (this.target) {
      this.weight = 1 - best;
      this.friction = 1 - cfg.frictionStrength * Math.min(1, this.weight * 1.6);
    }
    return this;
  }
}
