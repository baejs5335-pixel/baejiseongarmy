// 1인칭 총기 모델: 반동 킥, 스웨이, 걷기 흔들림, 조준 이동, 재장전/교체 모션, 총구 화염, 조준경 부착
import * as THREE from 'three';
import { toon, addOutline, radialTexture } from './toon.js';
import { ITEMS, skinTexture, patternTexture } from './cosmetics.js';

const DARK = 0x3a3f4b, ORANGE = 0xf08a2e, GREEN = 0x5a7d43, WOOD = 0x8b5a2b, METAL = 0x2a2d36, BLUE = 0x3d7fd6;
const ACCENTS = [ORANGE, GREEN, WOOD, BLUE];

function part(group, geo, color, x, y, z, rx = 0) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.userData.base = color;
  if (ACCENTS.includes(color)) m.userData.accent = color;
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
    return { muzzle: -0.49, rail: 0.05, sightZ: 0.02, hip: [0.17, -0.19, -0.5], iron: [0, -0.08, -0.3], hands: [[0, -0.12, 0.1], [0, -0.06, -0.25]] };
  },
  SMG(g) {
    part(g, box(0.065, 0.09, 0.26), DARK, 0, 0, 0);
    part(g, box(0.06, 0.07, 0.1), BLUE, 0, -0.005, -0.17);
    part(g, cyl(0.014, 0.08), METAL, 0, 0.005, -0.26);
    part(g, box(0.04, 0.18, 0.045), METAL, 0, -0.13, -0.06, 0.1);
    part(g, box(0.04, 0.09, 0.045), DARK, 0, -0.08, 0.08, -0.3);
    part(g, box(0.015, 0.05, 0.16), METAL, 0, -0.01, 0.2);
    part(g, box(0.012, 0.028, 0.012), METAL, 0, 0.058, -0.11);
    return { muzzle: -0.31, rail: 0.045, sightZ: 0.02, hip: [0.16, -0.18, -0.46], iron: [0, -0.072, -0.28], hands: [[0, -0.11, 0.09], [0, -0.06, -0.17]] };
  },
  SR(g) {
    part(g, box(0.07, 0.09, 0.42), GREEN, 0, 0, 0);
    part(g, cyl(0.017, 0.46), METAL, 0, 0.01, -0.44);
    part(g, box(0.045, 0.06, 0.06), METAL, 0, -0.08, -0.02);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.12, -0.3);
    part(g, box(0.06, 0.1, 0.2), GREEN, 0, -0.025, 0.3);
    return { muzzle: -0.67, rail: 0.045, sightZ: -0.04, hip: [0.17, -0.2, -0.55], iron: [0, -0.07, -0.3], hands: [[0, -0.12, 0.13], [0, -0.07, -0.2]] };
  },
  SG(g) {
    part(g, box(0.085, 0.1, 0.3), DARK, 0, 0, 0);
    part(g, cyl(0.024, 0.32), METAL, 0, 0.02, -0.3);
    part(g, box(0.08, 0.07, 0.15), WOOD, 0, -0.04, -0.25);
    part(g, box(0.045, 0.1, 0.05), DARK, 0, -0.09, 0.08, -0.3);
    part(g, box(0.065, 0.1, 0.18), WOOD, 0, -0.03, 0.22);
    return { muzzle: -0.47, rail: 0.05, sightZ: 0, hip: [0.17, -0.19, -0.5], iron: [0, -0.07, -0.3], hands: [[0, -0.12, 0.09], [0, -0.09, -0.25]] };
  },
  HG(g) {
    part(g, box(0.05, 0.055, 0.2), ORANGE, 0, 0.02, -0.02);
    part(g, box(0.045, 0.04, 0.17), METAL, 0, -0.02, -0.01);
    part(g, box(0.045, 0.12, 0.06), METAL, 0, -0.08, 0.06, -0.25);
    part(g, box(0.012, 0.018, 0.012), METAL, 0, 0.055, -0.1);
    return { muzzle: -0.13, rail: 0.0475, sightZ: 0.02, hip: [0.14, -0.16, -0.42], iron: [0, -0.06, -0.3], hands: [[0.005, -0.1, 0.07], [-0.03, -0.11, 0.05]] };
  },
  KN(g) {
    part(g, box(0.012, 0.045, 0.22), 0xdfe6ee, 0, 0.01, -0.13);
    part(g, box(0.06, 0.018, 0.022), METAL, 0, 0, -0.015);
    part(g, box(0.03, 0.035, 0.11), ORANGE, 0, -0.005, 0.05);
    return { muzzle: -0.24, rail: 0.03, sightZ: 0, hip: [0.2, -0.2, -0.36], iron: [0.2, -0.2, -0.36], hands: [[0, 0, 0.05]] };
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
    this.gloveMat = toon(0x2a2d36);
    this.sleeveMat = toon(0x3a5a3a);
    this.time = 0;
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
      // 스킨이 칠해질 총 파츠 재질 목록 (강조 파츠 = 등급 색상)
      const mats = [];
      g.traverse((o) => {
        if (o.isMesh && o.userData.base !== undefined) mats.push({ mat: o.material, base: o.userData.base, accent: !!o.userData.accent });
      });
      const accents = mats.filter((m) => m.accent);
      // 손(장갑) + 소매(의상): 오른손은 화면 오른쪽 아래, 왼손은 왼쪽 아래로 팔이 뻗음
      info.hands.forEach(([hx, hy, hz], i) => {
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), this.gloveMat);
        hand.scale.set(1.05, 0.85, 1.25);
        hand.position.set(hx + (i ? -0.012 : 0.012), hy, hz);
        addOutline(hand, 0.004);
        g.add(hand);
        const to = new THREE.Vector3(i ? -0.32 : 0.22, -0.42, i ? 0.25 : 0.42);
        const len = to.length();
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, len, 10), this.sleeveMat);
        sleeve.position.set(hand.position.x + to.x / 2, hand.position.y + to.y / 2, hand.position.z + to.z / 2);
        sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().normalize());
        addOutline(sleeve, 0.004);
        g.add(sleeve);
      });
      // 소음기 (장착 시 총구가 앞으로 나감)
      const sup = new THREE.Mesh(cyl(0.024, 0.16), toon(METAL));
      sup.position.set(0, 0.01, info.muzzle - 0.08);
      addOutline(sup, 0.004);
      sup.visible = false;
      g.add(sup);
      this.guns[k] = {
        g, muzzle, accents, mats, sup, muzzleZ: info.muzzle, rail: info.rail, sights: buildSights(g, info.rail, info.sightZ),
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

  // 육성 반영: 등급 색 (일반 = 원래 색 / 희귀 = 파랑 / 전설 = 금색 발광), 소음기 모델
  setLoadout(k, w, skinId = 'default') {
    const c = this.guns[k];
    if (!c) return;
    const skin = ITEMS.gunSkin[skinId] || ITEMS.gunSkin.default;
    const tex = skinTexture(skin);
    c.skin = skin;
    c.tex = tex;
    for (const m of c.mats) {
      let col = m.base, em = 0x000000;
      if (skin === ITEMS.gunSkin.default) {
        // 기본 스킨: 등급 색 (일반 = 원래 색 / 희귀 = 파랑 / 전설 = 금색 발광)
        if (m.accent) { col = [m.base, 0x4a8cff, 0xffc933][w.grade || 0]; em = w.grade === 2 ? 0x664400 : 0; }
      } else if (tex) {
        col = m.accent ? 0xffffff : 0xd8d8d8;
      } else {
        col = m.accent ? (skin.accent ?? skin.body) : skin.body;
        em = skin.emissive || 0;
      }
      if (m.mat.map !== tex) { m.mat.map = tex; m.mat.needsUpdate = true; }
      m.mat.color.setHex(col);
      m.mat.emissive.setHex(em);
    }
    c.sup.visible = !!w.suppressed;
    c.muzzle.position.z = c.muzzleZ - (w.suppressed ? 0.16 : 0);
  }

  // 1인칭 손: 장갑 색 / 소매 = 캐릭터 의상
  setHands(glove, outfit, charColor) {
    this.gloveMat.color.setHex(glove.color);
    this.gloveMat.emissive.setHex(glove.emissive || 0);
    const tex = outfit.pattern ? patternTexture(outfit.pattern, outfit.colors) : null;
    if (this.sleeveMat.map !== tex) { this.sleeveMat.map = tex; this.sleeveMat.needsUpdate = true; }
    this.sleeveMat.color.setHex(tex ? 0xffffff : outfit.color ?? charColor);
    this.sleeveMat.emissive.setHex(outfit.emissive || 0);
  }

  // 움직이는 스킨: pulse(네온 맥박) / hue(무지개 순환) / scroll(용암 흐름)
  animateSkin(dt) {
    const c = this.cur;
    if (!c?.skin?.anim) return;
    this.time += dt;
    const t = this.time;
    if (c.skin.anim === 'pulse') {
      const k = 0.35 + 0.35 * Math.sin(t * 5);
      for (const m of c.accents) m.mat.emissive.setRGB(0.22 * k, k, 0.88 * k);
    } else if (c.skin.anim === 'hue') {
      c.mats.forEach((m, i) => { if (m.accent || i % 2 === 0) m.mat.color.setHSL((t * 0.18 + i * 0.07) % 1, 0.8, 0.55); });
    } else if (c.skin.anim === 'scroll' && c.tex) {
      c.tex.offset.x += dt * 0.12;
      c.tex.offset.y += dt * 0.05;
      const k = 0.25 + 0.15 * Math.sin(t * 3);
      for (const m of c.mats) m.mat.emissive.setRGB(k, k * 0.35, 0);
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

    this.animateSkin(dt);
    this.flashT -= dt;
    const on = this.flashT > 0;
    this.flash.visible = on && !s.hide;
    this.light.intensity = on ? 6 : 0;
  }
}
