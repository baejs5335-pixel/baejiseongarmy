// 무기 스펙. 각도는 도(°), 거리는 m, 시간은 초.
//  damage: near(근거리) → start~end 구간에서 선형 감쇠 → far(원거리)
//  hip / ads: 지향사격 / 정조준 시 탄퍼짐 { base 기본, move 이동 시 추가, perShot 발당 확장, max 최대 확장 }
//  recoil.pattern: i번째 발의 [위, 오른쪽] 반동 — 매번 같은 패턴이라 연습하면 제어할 수 있습니다
const KEY = 'ss-weapons-v1';

export const GRAVITY = 9.8;

export const SCOPES = {
  iron:   { name: '기본 조준', zoom: 1.15, sight: 'iron',   adsTimeAdd: 0,    sensKey: 'adsSensMul' },
  reddot: { name: '레드닷',    zoom: 1.3,  sight: 'reddot', adsTimeAdd: 0.02, sensKey: 'sensRedDot' },
  x2:     { name: '2배율',     zoom: 2,    sight: 'scope',  adsTimeAdd: 0.06, sensKey: 'sens2x' },
  x4:     { name: '4배율',     zoom: 4,    sight: 'scope',  adsTimeAdd: 0.1,  sensKey: 'sens4x' },
  x8:     { name: '8배율',     zoom: 8,    sight: 'scope',  adsTimeAdd: 0.14, sensKey: 'sens8x' },
};

export const MODE_NAMES = { auto: '연사', burst: '점사', single: '단발' };

const pattern = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const BASE = {
  AR: {
    name: '돌격소총', modes: ['auto', 'burst', 'single'], rpm: 640, burstCount: 3, burstRpm: 900, burstDelay: 0.22,
    damage: { near: 26, far: 18, start: 30, end: 70 }, headMul: 2.0, pellets: 1, pelletSpread: 0,
    velocity: 420, mag: 30, reserve: 150, reloadTac: 1.7, reloadEmpty: 2.2,
    hip: { base: 2.0, move: 2.2, perShot: 0.3, max: 5 },
    ads: { base: 0.12, move: 0.8, perShot: 0.1, max: 1.4 },
    crouchMul: 0.7,
    // 처음 6발은 수직, 이후 좌우로 흔들리며 상승
    recoil: { scale: 1, jitter: 0.12, adsMul: 0.8, reset: 0.3,
      pattern: pattern(40, (i) => (i < 6 ? [0.55, i % 2 ? 0.05 : -0.05] : [0.32, 0.25 * Math.sin(i * 0.55) + 0.06])) },
    scopes: ['iron', 'reddot', 'x2', 'x4'], defaultScope: 'reddot', adsTime: 0.2, mobility: 1,
    shake: 0.13, kick: 0.022, fovPunch: 0.6, vib: 12,
    sfx: { cut: 2800, decay: 0.09, thump: 150, gain: 0.8 },
  },
  SMG: {
    name: '기관단총', modes: ['auto', 'single'], rpm: 900,
    damage: { near: 20, far: 11, start: 12, end: 35 }, headMul: 1.8, pellets: 1, pelletSpread: 0,
    velocity: 330, mag: 35, reserve: 175, reloadTac: 1.5, reloadEmpty: 1.9,
    hip: { base: 1.4, move: 1.0, perShot: 0.22, max: 4 },
    ads: { base: 0.35, move: 0.5, perShot: 0.12, max: 1.8 },
    crouchMul: 0.8,
    // 반동은 작지만 좌우로 빠르게 흔들림
    recoil: { scale: 1, jitter: 0.2, adsMul: 0.85, reset: 0.25,
      pattern: pattern(40, (i) => (i < 4 ? [0.38, 0] : [0.22, 0.32 * Math.sin(i * 0.9)])) },
    scopes: ['iron', 'reddot', 'x2'], defaultScope: 'iron', adsTime: 0.15, mobility: 1.1,
    shake: 0.09, kick: 0.015, fovPunch: 0.4, vib: 9,
    sfx: { cut: 3400, decay: 0.06, thump: 200, gain: 0.65 },
  },
  SR: {
    name: '저격소총', modes: ['single'], rpm: 45,
    damage: { near: 95, far: 95, start: 150, end: 200 }, headMul: 2.5, pellets: 1, pelletSpread: 0,
    velocity: 520, mag: 5, reserve: 25, reloadTac: 2.4, reloadEmpty: 3.0,
    hip: { base: 4.5, move: 3, perShot: 5, max: 9 },
    ads: { base: 0, move: 1.5, perShot: 0, max: 0 },
    crouchMul: 0.6,
    recoil: { scale: 1, jitter: 0.15, adsMul: 1, reset: 1, pattern: [[4, 0.6]] },
    scopes: ['x4', 'x8'], defaultScope: 'x8', adsTime: 0.3, mobility: 0.9,
    shake: 0.5, kick: 0.12, fovPunch: 2.5, vib: 35,
    sfx: { cut: 1800, decay: 0.35, thump: 70, gain: 1.2 },
  },
  SG: {
    name: '샷건', modes: ['single'], rpm: 75,
    damage: { near: 14, far: 3, start: 8, end: 22 }, headMul: 1.5, pellets: 8, pelletSpread: 5, adsPelletMul: 0.75,
    velocity: 280, mag: 6, reserve: 30, reloadTac: 2.0, reloadEmpty: 2.6,
    hip: { base: 1.0, move: 1, perShot: 2.5, max: 6 },
    ads: { base: 0.8, move: 0.8, perShot: 1.5, max: 4 },
    crouchMul: 0.85,
    recoil: { scale: 1, jitter: 0.2, adsMul: 0.9, reset: 1, pattern: [[3.2, 0.5]] },
    scopes: ['iron', 'reddot'], defaultScope: 'iron', adsTime: 0.2, mobility: 1,
    shake: 0.45, kick: 0.1, fovPunch: 2, vib: 30,
    sfx: { cut: 1400, decay: 0.25, thump: 60, gain: 1.3 },
  },
  HG: {
    name: '권총', modes: ['single'], rpm: 380,
    damage: { near: 32, far: 20, start: 15, end: 40 }, headMul: 2.0, pellets: 1, pelletSpread: 0,
    velocity: 300, mag: 12, reserve: 60, reloadTac: 1.3, reloadEmpty: 1.6,
    hip: { base: 1.0, move: 1.2, perShot: 0.9, max: 4 },
    ads: { base: 0.25, move: 0.6, perShot: 0.5, max: 2 },
    crouchMul: 0.8,
    recoil: { scale: 1, jitter: 0.25, adsMul: 0.8, reset: 0.4, pattern: pattern(12, (i) => [1.2, i % 2 ? 0.3 : -0.25]) },
    scopes: ['iron', 'reddot'], defaultScope: 'iron', adsTime: 0.14, mobility: 1.08,
    shake: 0.15, kick: 0.05, fovPunch: 0.8, vib: 15,
    sfx: { cut: 3200, decay: 0.08, thump: 180, gain: 0.8 },
  },
};

export const WEAPON_ORDER = ['AR', 'SMG', 'SR', 'SG', 'HG'];
export const WEAPONS = structuredClone(BASE);
for (const k in WEAPONS) WEAPONS[k].key = k;

// 무기 밸런스 패널에서 수정 가능한 항목
export const EDITABLE = [
  { path: 'rpm', label: '연사 속도', min: 30, max: 1200, step: 5, unit: 'RPM' },
  { path: 'damage.near', label: '근거리 데미지', min: 2, max: 150, step: 1 },
  { path: 'damage.far', label: '원거리 데미지', min: 1, max: 150, step: 1 },
  { path: 'damage.start', label: '감쇠 시작 거리', min: 0, max: 150, step: 1, unit: 'm' },
  { path: 'damage.end', label: '감쇠 끝 거리', min: 1, max: 200, step: 1, unit: 'm' },
  { path: 'headMul', label: '헤드샷 배율', min: 1, max: 4, step: 0.05 },
  { path: 'velocity', label: '탄속', min: 100, max: 1000, step: 10, unit: 'm/s' },
  { path: 'mag', label: '탄창 크기', min: 1, max: 100, step: 1 },
  { path: 'reloadTac', label: '장전 (잔탄 있음)', min: 0.5, max: 5, step: 0.05, unit: 's' },
  { path: 'reloadEmpty', label: '장전 (빈 탄창)', min: 0.5, max: 5, step: 0.05, unit: 's' },
  { path: 'hip.base', label: '지향사격 탄퍼짐', min: 0, max: 8, step: 0.05, unit: '°' },
  { path: 'hip.perShot', label: '지향사격 발당 확장', min: 0, max: 5, step: 0.05, unit: '°' },
  { path: 'ads.base', label: '정조준 탄퍼짐', min: 0, max: 3, step: 0.01, unit: '°' },
  { path: 'ads.move', label: '정조준 이동 페널티', min: 0, max: 4, step: 0.05, unit: '°' },
  { path: 'recoil.scale', label: '반동 배율', min: 0, max: 3, step: 0.05 },
  { path: 'adsTime', label: '정조준 전환 시간', min: 0.05, max: 0.6, step: 0.01, unit: 's' },
  { path: 'mobility', label: '이동 속도 배율', min: 0.6, max: 1.3, step: 0.01 },
];

export const getP = (o, path) => path.split('.').reduce((a, k) => a[k], o);
export function setP(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((a, k) => a[k], o)[last] = v;
}

export function saveWeapons() {
  const out = {};
  for (const k in WEAPONS) {
    for (const e of EDITABLE) {
      const v = getP(WEAPONS[k], e.path);
      if (v !== getP(BASE[k], e.path)) (out[k] ||= {})[e.path] = v;
    }
  }
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* 무시 */ }
  return out;
}

export function resetWeapon(k) {
  for (const e of EDITABLE) setP(WEAPONS[k], e.path, getP(BASE[k], e.path));
  saveWeapons();
}

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const k in saved) {
    if (!WEAPONS[k]) continue;
    for (const e of EDITABLE) if (typeof saved[k][e.path] === 'number') setP(WEAPONS[k], e.path, saved[k][e.path]);
  }
} catch { /* 저장소 사용 불가 */ }

export function damageAt(w, d) {
  const D = w.damage;
  if (d <= D.start) return D.near;
  if (d >= D.end) return D.far;
  return D.near + (D.far - D.near) * (d - D.start) / (D.end - D.start);
}
