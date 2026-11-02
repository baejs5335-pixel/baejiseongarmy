// 1인칭 총기 모델: 반동 킥, 스웨이, 걷기 흔들림, 조준 이동, 재장전/교체 모션, 총구 화염, 조준경 부착
import * as THREE from 'three';
import { toon, addOutline, radialTexture } from './toon.js';

const DARK = 0x3a3f4b, ORANGE = 0xf08a2e, GREEN = 0x5a7d43, WOOD = 0x8b5a2b, METAL = 0x2a2d36, BLUE = 0x3d7fd6;

function part(group, geo, color, x, y, z, rx = 0) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  addOutline(m, 0.004);
  group.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, len) => new THREE.CylinderGeometry(r, r, len, 14).rotateX(Math.PI / 2);

// rail: 조준경이 올라가는 레일 높이 / iron: 기본 조준 시 총 위치
const BUILDERS = {
  AR(g) {
    part(g, box(0.075, 0.1, 0.34), DARK, 0, 0, 0);
    part(g, box(0.07, 0.075, 0.17), ORANGE, 0, -0.005, -0.25);
    part(g, cyl(0.015, 0.16), METAL, 0, 0.01, -0.4);
    part(g, box(0.05, 0.14, 0.07), METAL, 0, -0.11, -0.05, 0.2);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.09, -0.3);
    part(g, box(0.06, 0.09, 0.17), ORANGE, 0, -0.02, 0.24);
    part(g, box(0.012, 0.03, 0.012), METAL, 0, 0.065, -0.3);
    return { muzzle: -0.49, rail: 0.05, sightZ: 0.02, hip: [0.17, -0.19, -0.5], iron: [0, -0.08, -0.3] };
  },
  SMG(g) {
    part(g, box(0.065, 0.09, 0.26), DARK, 0, 0, 0);
    part(g, box(0.06, 0.07, 0.1), BLUE, 0, -0.005, -0.17);
    part(g, cyl(0.014, 0.08), METAL, 0, 0.005, -0.26);
    part(g, box(0.04, 0.18, 0.045), METAL, 0, -0.13, -0.06, 0.1);
    part(g, box(0.04, 0.09, 0.045), DARK, 0, -0.08, 0.08, -0.3);
    part(g, box(0.015, 0.05, 0.16), METAL, 0, -0.01, 0.2);
    part(g, box(0.012, 0.028, 0.012), METAL, 0, 0.058, -0.11);
    return { muzzle: -0.31, rail: 0.045, sightZ: 0.02, hip: [0.16, -0.18, -0.46], iron: [0, -0.072, -0.28] };
  },
  SR(g) {
    part(g, box(0.07, 0.09, 0.42), GREEN, 0, 0, 0);
    part(g, cyl(0.017, 0.46), METAL, 0, 0.01, -0.44);
    part(g, box(0.045, 0.06, 0.06), METAL, 0, -0.08, -0.02);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.12, -0.3);
    part(g, box(0.06, 0.1, 0.2), GREEN, 0, -0.025, 0.3);
    return { muzzle: -0.67, rail: 0.045, sightZ: -0.04, hip: [0.17, -0.2, -0.55], iron: [0, -0.07, -0.3] };
  },
  SG(g) {
    part(g, box(0.085, 0.1, 0.3), DARK, 0, 0, 0);
    part(g, cyl(0.024, 0.32), METAL, 0, 0.02, -0.3);
    part(g, box(0.08, 0.07, 0.15), WOOD, 0, -0.04, -0.25);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.08, -0.3);
    part(g, box(0.065, 0.1, 0.18), WOOD, 0, -0.03, 0.22);
    return { muzzle: -0.47, rail: 0.05, sightZ: 0, hip: [0.17, -0.19, -0.5], iron: [0, -0.07, -0.3] };
  },
  HG(g) {
    part(g, box(0.05, 0.055, 0.2), ORANGE, 0, 0.02, -0.02);
    part(g, box(0.045, 0.04, 0.17), METAL, 0, -0.02, -0.01);
    part(g, box(0.045, 0.12, 0.06), METAL, 0, -0.08, 0.06, -0.25);
    part(g, box(0.012, 0.018, 0.012), METAL, 0, 0.055, -0.1);
    return { muzzle: -0.13, rail: 0.0475, sightZ: 0.02, hip: [0.14, -0.16, -0.42], iron: [0, -0.06, -0.3] };
  },
  KN(g) {
    part(g, box(0.012, 0.045, 0.22), 0xdfe6ee, 0, 0.01, -0.13);
    part(g, box(0.06, 0.018, 0.022), METAL, 0, 0, -0.015);
    part(g, box(0.03, 0.035, 0.11), ORANGE, 0, -0.005, 0.05);
    return { muzzle: -0.24, rail: 0.03, sightZ: 0, hip: [0.2, -0.2, -0.36], iron: [0.2, -0.2, -0.36] };
  },
};

function buildSights(g, rail, z) {
  const red = new THREE.Group();
  part(red, box(0.036, 0.01, 0.045), METAL, 0, rail + 0.005, z);
  part(red, box(0.006, 0.042, 0.01), METAL, -0.021, rail + 0.03, z);
  part(red, box(0.006, 0.042, 0.01), METAL, 0.021, rail + 0.03, z);
  part(red, box(0.048, 0.006, 0.01), METAL, 0, rail + 0.051, z);
  const scope = (len, r) => {
    const s = new THREE.Group();
    part(s, cyl(r, len), METAL, 0, rail + 0.035, z);
    part(s, cyl(r * 1.25, 0.03), DARK, 0, rail + 0.035, z - len / 2);
    part(s, box(0.012, 0.03, 0.012), METAL, 0, rail + 0.012, z - len * 0.3);
    part(s, box(0.012, 0.03, 0.012), METAL, 0, rail + 0.012, z + len * 0.3);
    return s;
  };
  const out = { reddot: red, x2: scope(0.12, 0.018), x4: scope(0.18, 0.022), x8: scope(0.26, 0.026) };
  for (const k in out) { out[k].visible = false; g.add(out[k]); }
  return out;
}

export class Viewmodel {
  constructor(camera) {
    this.root = new THREE.Group();
    camera.add(this.root);
    this.guns = {};
    for (const k in BUILDERS) {
      const g = new THREE.Group();
      const info = BUILDERS[k](g);
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0.01, info.muzzle);
      g.add(muzzle);
      g.visible = false;
      this.root.add(g);
      this.guns[k] = {
        g, muzzle, rail: info.rail, sights: buildSights(g, info.rail, info.sightZ),
        hip: new THREE.Vector3(...info.hip), iron: new THREE.Vector3(...info.iron),
      };
    }
    const tex = radialTexture([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,200,80,.95)'], [0.6, 'rgba(255,120,30,.35)'], [1, 'rgba(255,80,0,0)']]);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flash.visible = false;
    this.light = new THREE.PointLight(0xffb850, 0, 7, 2);
    this.adsPos = new THREE.Vector3();
    this.kick = 0; this.kickRot = 0; this.kickSide = 0;
    this.swayX = 0; this.swayY = 0;
    this.switchT = 1;
    this.flashT = 0;
    this.tmp = new THREE.Vector3();
  }

  setWeapon(k, scopeKey) {
    if (this.cur) this.cur.g.visible = false;
    this.cur = this.guns[k];
    this.cur.g.visible = true;
    this.cur.muzzle.add(this.flash);
    this.cur.muzzle.add(this.light);
    this.switchT = 0;
    this.setScope(scopeKey);
  }

  // 조준경에 따라 정조준 위치(눈과 조준점이 일직선이 되는 높이)가 바뀝니다
  setScope(scopeKey) {
    const c = this.cur;
    for (const k in c.sights) c.sights[k].visible = k === scopeKey;
    if (scopeKey === 'iron') this.adsPos.copy(c.iron);
    else if (scopeKey === 'reddot') this.adsPos.set(0, -(c.rail + 0.03), -0.27);
    else this.adsPos.set(0, -(c.rail + 0.035), -0.25);
  }

  fire(w, flash) {
    this.kick += w.kick;
    this.kickRot += w.kick * 2.6;
    this.kickSide += (Math.random() * 2 - 1) * w.kick * 0.6;
    if (flash) {
      this.flashT = 0.05;
      this.flash.material.rotation = Math.random() * Math.PI * 2;
      this.flash.scale.setScalar((w.pellets > 1 ? 0.32 : 0.22) * (0.85 + Math.random() * 0.3));
    }
  }

  // 칼 모션: slash = 오른쪽→왼쪽 베기, stab = 앞으로 찌르기
  swing(kind) {
    this.swingKind = kind;
    this.swingT = 0;
  }

  muzzleWorld(out) {
    return this.cur.muzzle.getWorldPosition(out);
  }

  update(dt, s) {
    const c = this.cur;
    this.kick *= Math.exp(-dt * 16);
    this.kickRot *= Math.exp(-dt * 12);
    this.kickSide *= Math.exp(-dt * 14);
    this.switchT = Math.min(1, this.switchT + dt / 0.3);
    const lk = 1 - Math.exp(-dt * 10);
    this.swayX += (Math.max(-0.04, Math.min(0.04, -s.lookX * 0.0007)) - this.swayX) * lk;
    this.swayY += (Math.max(-0.03, Math.min(0.03, s.lookY * 0.0006)) - this.swayY) * lk;

    const a = s.adsE;
    const p = this.tmp.copy(c.hip).lerp(this.adsPos, a);
    const bobAmt = Math.min(1, s.speedFrac) * (1 - a * 0.85);
    const drop = 1 - this.switchT;
    const rl = s.reloadFrac >= 0 ? Math.sin(Math.PI * s.reloadFrac) : 0;
    const kickK = 1 - a * 0.5;
    this.root.position.set(
      p.x + this.swayX * (1 - a * 0.7) + Math.cos(s.bob) * 0.012 * bobAmt + this.kickSide * kickK,
      p.y + this.swayY * (1 - a * 0.7) - Math.abs(Math.sin(s.bob)) * 0.014 * bobAmt - drop * drop * 0.25 - rl * 0.08,
      p.z + this.kick,
    );
    this.root.rotation.set(this.kickRot * kickK + rl * -0.7 - drop * 0.5, this.swayX * 1.5, rl * 0.35);
    if (this.swingKind) {
      const dur = this.swingKind === 'stab' ? 0.5 : 0.3;
      this.swingT += dt / dur;
      const t = Math.min(1, this.swingT), arc = Math.sin(Math.PI * t);
      if (this.swingKind === 'slash') {
        this.root.position.x += -0.28 * (t - 0.5) * 2 * arc;
        this.root.position.y += 0.06 * arc;
        this.root.rotation.y += 1.2 * arc;
        this.root.rotation.z += -0.9 * arc;
      } else {
        this.root.position.z += -0.22 * arc;
        this.root.position.x += -0.12 * arc;
        this.root.rotation.x += -0.25 * arc;
      }
      if (t >= 1) this.swingKind = null;
    }
    this.root.visible = !s.hide;

    this.flashT -= dt;
    const on = this.flashT > 0;
    this.flash.visible = on && !s.hide;
    this.light.intensity = on ? 6 : 0;
  }
}
