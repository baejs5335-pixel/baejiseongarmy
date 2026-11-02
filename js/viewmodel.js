// 1인칭 총기 모델: 반동 킥, 스웨이, 걷기 흔들림, 조준 이동, 재장전/교체 모션, 총구 화염
import * as THREE from 'three';
import { toon, addOutline, radialTexture } from './toon.js';

const DARK = 0x3a3f4b, ORANGE = 0xf08a2e, GREEN = 0x5a7d43, WOOD = 0x8b5a2b, METAL = 0x2a2d36;

function part(group, geo, color, x, y, z, rx = 0) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  addOutline(m, 0.004);
  group.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, len) => new THREE.CylinderGeometry(r, r, len, 12).rotateX(Math.PI / 2);

const BUILDERS = {
  AR(g) {
    part(g, box(0.075, 0.1, 0.34), DARK, 0, 0, 0);
    part(g, box(0.07, 0.075, 0.17), ORANGE, 0, -0.005, -0.25);
    part(g, cyl(0.015, 0.16), METAL, 0, 0.01, -0.4);
    part(g, box(0.05, 0.14, 0.07), METAL, 0, -0.11, -0.05, 0.2);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.09, -0.3);
    part(g, box(0.06, 0.09, 0.17), ORANGE, 0, -0.02, 0.24);
    part(g, box(0.025, 0.035, 0.05), METAL, 0, 0.065, -0.08);
    return { muzzle: -0.49, hip: [0.17, -0.19, -0.5], ads: [0, -0.083, -0.3] };
  },
  SR(g) {
    part(g, box(0.07, 0.09, 0.42), GREEN, 0, 0, 0);
    part(g, cyl(0.017, 0.46), METAL, 0, 0.01, -0.44);
    part(g, cyl(0.032, 0.24), METAL, 0, 0.085, -0.04);
    part(g, box(0.045, 0.06, 0.06), METAL, 0, -0.08, -0.02);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.12, -0.3);
    part(g, box(0.06, 0.1, 0.2), GREEN, 0, -0.025, 0.3);
    return { muzzle: -0.67, hip: [0.17, -0.2, -0.55], ads: [0, -0.12, -0.3] };
  },
  SG(g) {
    part(g, box(0.085, 0.1, 0.3), DARK, 0, 0, 0);
    part(g, cyl(0.024, 0.32), METAL, 0, 0.02, -0.3);
    part(g, box(0.08, 0.07, 0.15), WOOD, 0, -0.04, -0.25);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.08, -0.3);
    part(g, box(0.065, 0.1, 0.18), WOOD, 0, -0.03, 0.22);
    return { muzzle: -0.47, hip: [0.17, -0.19, -0.5], ads: [0, -0.07, -0.3] };
  },
  HG(g) {
    part(g, box(0.05, 0.055, 0.2), ORANGE, 0, 0.02, -0.02);
    part(g, box(0.045, 0.04, 0.17), METAL, 0, -0.02, -0.01);
    part(g, box(0.045, 0.12, 0.06), METAL, 0, -0.08, 0.06, -0.25);
    part(g, box(0.012, 0.018, 0.012), METAL, 0, 0.055, -0.1);
    return { muzzle: -0.13, hip: [0.14, -0.16, -0.42], ads: [0, -0.06, -0.3] };
  },
};

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
      this.guns[k] = { g, muzzle, hip: new THREE.Vector3(...info.hip), ads: new THREE.Vector3(...info.ads) };
    }
    const tex = radialTexture([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,200,80,.95)'], [0.6, 'rgba(255,120,30,.35)'], [1, 'rgba(255,80,0,0)']]);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flash.visible = false;
    this.light = new THREE.PointLight(0xffb850, 0, 7, 2);
    this.kick = 0; this.kickRot = 0; this.kickSide = 0;
    this.swayX = 0; this.swayY = 0;
    this.switchT = 1;
    this.flashT = 0;
    this.tmp = new THREE.Vector3();
  }

  setWeapon(k) {
    if (this.cur) this.cur.g.visible = false;
    this.cur = this.guns[k];
    this.cur.g.visible = true;
    this.cur.muzzle.add(this.flash);
    this.cur.muzzle.add(this.light);
    this.switchT = 0;
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
    const p = this.tmp.copy(c.hip).lerp(c.ads, a);
    const bobAmt = Math.min(1, s.speedFrac) * (1 - a * 0.85);
    const drop = 1 - this.switchT;
    const rl = s.reloadFrac >= 0 ? Math.sin(Math.PI * s.reloadFrac) : 0;
    this.root.position.set(
      p.x + this.swayX * (1 - a * 0.7) + Math.cos(s.bob) * 0.012 * bobAmt + this.kickSide,
      p.y + this.swayY * (1 - a * 0.7) - Math.abs(Math.sin(s.bob)) * 0.014 * bobAmt - drop * drop * 0.25 - rl * 0.08,
      p.z + this.kick,
    );
    this.root.rotation.set(this.kickRot + rl * -0.7 - drop * 0.5, this.swayX * 1.5, rl * 0.35);
    this.root.visible = !s.hide;

    this.flashT -= dt;
    const on = this.flashT > 0;
    this.flash.visible = on;
    this.light.intensity = on ? 6 : 0;
  }
}
