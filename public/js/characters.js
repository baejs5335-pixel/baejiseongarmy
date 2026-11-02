// 캐릭터 & 클래스.
//  speed  이동 속도 배율 / hp 체력
//  height·width·head  체형 (보이는 모델과 판정 모두에 반영)
//  hitbox  판정 배율 — 모델은 그대로 두고 피격 판정만 키우거나 줄임
//  passive 클래스 고유 기믹
// 밸런스 원칙: 작고 빠를수록 체력이 낮고, 크고 느릴수록 체력이 높다. "생존력 지수"(체력 ÷ 판정 면적)로 비교합니다.
//  목표 생존력 ≈ 100 − (속도 − 1) × 150. 단, AR 몸통 필요 탄수 구간(4발/5발)이 깨지지 않게 체력을 반올림.
import * as THREE from 'three';
import { toon, addOutline } from './toon.js';

const KEY = 'ss-chars-v1';

const BASE = {
  leo: {
    name: '레오', cls: '돌격병', weapon: 'AR', look: 'helmet', color: 0xe4574b, accent: 0x4f7f3f,
    desc: '균형 잡힌 기본형. 어느 거리에서도 무난하게 싸웁니다.',
    speed: 1.0, hp: 100, height: 1.0, width: 1.0, head: 1.0, hitbox: 1.0,
    passive: { text: '재장전 15% 빠름', reload: 0.85 },
  },
  mina: {
    name: '미나', cls: '정찰병', weapon: 'SMG', look: 'cap', color: 0x2fb5a3, accent: 0xffd23f,
    desc: '작고 빠른 정찰병. 맞히기 어렵지만 오래 버티지 못합니다.',
    // 판정을 살짝 키워(1.04) 작은 체구의 이점을 줄이고, 체력 80 = AR 몸통 4발 구간 유지
    speed: 1.1, hp: 80, height: 0.94, width: 0.9, head: 0.95, hitbox: 1.04,
    passive: { text: '정조준 전환 20% 빠름', ads: 0.8 },
  },
  bruno: {
    name: '브루노', cls: '중화기병', weapon: 'SG', look: 'beanie', color: 0x7a5cc7, accent: 0x8b2f2f,
    desc: '덩치 큰 돌파 담당. 판정이 크고 느린 대신 체력이 높습니다.',
    // 모델은 크지만 판정은 0.9로 줄여 "큰 몸 = 무조건 손해"가 되지 않게 함
    speed: 0.9, hp: 125, height: 1.05, width: 1.18, head: 1.05, hitbox: 0.9,
    passive: { text: '반동 15% 감소', recoil: 0.85 },
  },
  yuki: {
    name: '유키', cls: '저격병', weapon: 'SR', look: 'hood', color: 0x3d6fd6, accent: 0xe8ecf5,
    desc: '조용한 저격수. 정조준한 채 움직여도 조준이 덜 흔들립니다.',
    speed: 0.96, hp: 95, height: 0.98, width: 0.92, head: 0.95, hitbox: 1.0,
    passive: { text: '정조준 이동 탄퍼짐 40% 감소', adsMove: 0.6 },
  },
  spark: {
    name: '스파크', cls: '기동병', weapon: 'SMG', look: 'goggles', color: 0xf0a531, accent: 0x2a2d36,
    desc: '측면 침투 전문. 앉은 채로도 빠르게 움직여 낮은 엄폐물을 타고 우회합니다.',
    speed: 1.04, hp: 90, height: 0.95, width: 0.95, head: 1.05, hitbox: 1.0,
    passive: { text: '앉은 상태 이동 속도 +60%', crouchSpeed: 1.6 },
  },
};

export const CHAR_ORDER = ['leo', 'mina', 'bruno', 'yuki', 'spark'];
export const CHARACTERS = structuredClone(BASE);
for (const k in CHARACTERS) CHARACTERS[k].id = k;

export const CHAR_EDITABLE = [
  { key: 'speed', label: '이동 속도', min: 0.7, max: 1.3, step: 0.01 },
  { key: 'hp', label: '체력', min: 50, max: 200, step: 1 },
  { key: 'height', label: '키', min: 0.8, max: 1.2, step: 0.01 },
  { key: 'width', label: '몸 너비', min: 0.7, max: 1.4, step: 0.01 },
  { key: 'head', label: '머리 크기', min: 0.7, max: 1.3, step: 0.01 },
  { key: 'hitbox', label: '판정 배율', min: 0.7, max: 1.3, step: 0.01 },
];

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const k in saved) {
    if (!CHARACTERS[k]) continue;
    for (const e of CHAR_EDITABLE) if (typeof saved[k][e.key] === 'number') CHARACTERS[k][e.key] = saved[k][e.key];
  }
} catch { /* 저장소 사용 불가 */ }

export function saveCharacters() {
  const out = {};
  for (const k in CHARACTERS) {
    for (const e of CHAR_EDITABLE) if (CHARACTERS[k][e.key] !== BASE[k][e.key]) (out[k] ||= {})[e.key] = CHARACTERS[k][e.key];
  }
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* 무시 */ }
  return out;
}

export function resetCharacter(k) {
  for (const e of CHAR_EDITABLE) CHARACTERS[k][e.key] = BASE[k][e.key];
  saveCharacters();
}

// 체형 → 치수(m). 판정(hit*)은 hitbox 배율을 반지름에 곱합니다.
export function dims(c) {
  const bodyR = 0.34 * c.width, bodyLen = 0.72 * c.height;
  const bodyTop = bodyLen + bodyR * 2;
  const headR = 0.24 * c.head;
  const headY = bodyTop + headR * 0.92;
  const hitBodyR = bodyR * c.hitbox, hitHeadR = headR * c.hitbox;
  return {
    bodyR, bodyLen, bodyTop, headR, headY, total: headY + headR,
    eye: headY + 0.02, chestY: bodyTop * 0.7,
    hitBodyR, hitHeadR,
    // 정면에서 본 판정 면적 (몸통 직사각형 + 머리 원)
    area: hitBodyR * 2 * (bodyLen + hitBodyR * 2) + Math.PI * hitHeadR * hitHeadR,
    headArea: Math.PI * hitHeadR * hitHeadR,
  };
}

const REF_AREA = dims(BASE.leo).area;

// 밸런스 지표: 레오 = 100 기준
export function balance(c) {
  const d = dims(c);
  return {
    areaPct: d.area / REF_AREA * 100,
    survival: (c.hp / d.area) / (BASE.leo.hp / REF_AREA) * 100,
    headPct: d.headArea / dims(BASE.leo).headArea * 100,
  };
}

const HIT_MAT = new THREE.MeshBasicMaterial({ color: 0x39ff6a, wireframe: true, transparent: true, opacity: 0.6, depthTest: false });
const noRay = (m) => { m.raycast = () => {}; return m; };

function mesh(geo, mat, x, y, z, outline = 0) {
  const m = noRay(new THREE.Mesh(geo, mat));
  m.position.set(x, y, z);
  if (outline) noRay(addOutline(m, outline));
  return m;
}

// 외형별 장식 (모두 머리 중심 기준)
const LOOKS = {
  helmet(g, d, c) {
    g.add(mesh(new THREE.SphereGeometry(d.headR * 1.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(c.accent), 0, d.headY + d.headR * 0.15, 0));
  },
  cap(g, d, c) {
    g.add(mesh(new THREE.SphereGeometry(d.headR * 1.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(c.color), 0, d.headY + d.headR * 0.12, 0));
    g.add(mesh(new THREE.BoxGeometry(d.headR * 1.3, 0.02, d.headR * 0.9), toon(c.accent), 0, d.headY + d.headR * 0.2, d.headR * 0.95));
    g.add(mesh(new THREE.SphereGeometry(d.headR * 0.45, 10, 8), toon(0x5a3a22), 0, d.headY - d.headR * 0.1, -d.headR * 1.15));
  },
  beanie(g, d, c) {
    const b = mesh(new THREE.SphereGeometry(d.headR * 1.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(c.accent), 0, d.headY + d.headR * 0.1, 0);
    b.scale.y = 1.35;
    g.add(b);
    g.add(mesh(new THREE.BoxGeometry(d.headR * 1.3, d.headR * 0.55, d.headR * 0.5), toon(0x5a3a22), 0, d.headY - d.headR * 0.62, d.headR * 0.62));
  },
  hood(g, d, c) {
    const h = mesh(new THREE.SphereGeometry(d.headR * 1.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(c.color), 0, d.headY, -d.headR * 0.12);
    g.add(h);
    g.add(mesh(new THREE.TorusGeometry(d.headR * 0.95, d.headR * 0.28, 8, 16).rotateX(Math.PI / 2), toon(c.accent), 0, d.bodyTop - 0.02, 0));
  },
  goggles(g, d, c) {
    g.add(mesh(new THREE.TorusGeometry(d.headR * 1.0, 0.025, 6, 20).rotateX(Math.PI / 2), toon(c.accent), 0, d.headY + d.headR * 0.35, 0));
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12).rotateX(Math.PI / 2), toon(0x9fe3ff), sx * d.headR * 0.38, d.headY + d.headR * 0.38, d.headR * 0.88));
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.6;
      const spike = mesh(new THREE.ConeGeometry(0.05, 0.16, 6), toon(0xff7a2e), Math.sin(a) * d.headR * 0.7, d.headY + d.headR * 0.95, -Math.cos(a) * d.headR * 0.2);
      spike.rotation.z = -a * 0.5;
      g.add(spike);
    }
  },
};

// 캐릭터 모델: 보이는 부분(visual)과 피격 판정(hitBody/hitHead)을 분리해서 만듭니다
export function buildCharacter(c) {
  const d = dims(c);
  const g = new THREE.Group();
  const bodyMat = toon(c.color), skinMat = toon(0xffd2a6);
  g.add(mesh(new THREE.CapsuleGeometry(d.bodyR, d.bodyLen, 4, 12), bodyMat, 0, d.bodyTop / 2, 0, 0.03));
  g.add(mesh(new THREE.SphereGeometry(d.headR, 16, 12), skinMat, 0, d.headY, 0, 0.025));
  g.add(mesh(new THREE.BoxGeometry(d.bodyR * 1.2, d.bodyTop * 0.35, d.bodyR * 0.6), toon(0x3a3f4b), 0, d.bodyTop * 0.6, -d.bodyR * 0.85, 0.02));
  const eyeGeo = new THREE.SphereGeometry(0.035 * c.head, 8, 6), eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-0.08, 0.08]) g.add(mesh(eyeGeo, eyeMat, sx * c.head, d.headY + 0.02, d.headR * 0.9));
  LOOKS[c.look](g, d, c);

  const hitBody = new THREE.Mesh(new THREE.CapsuleGeometry(d.hitBodyR, d.bodyLen, 2, 8), HIT_MAT);
  hitBody.position.y = d.bodyTop / 2;
  const hitHead = new THREE.Mesh(new THREE.SphereGeometry(d.hitHeadR, 10, 8), HIT_MAT);
  hitHead.position.y = d.headY;
  hitBody.visible = hitHead.visible = false;
  hitBody.renderOrder = hitHead.renderOrder = 10;
  g.add(hitBody, hitHead);
  return { group: g, d, hitBody, hitHead, flashMats: [bodyMat, skinMat] };
}
