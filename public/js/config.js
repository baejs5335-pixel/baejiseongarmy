// 튜닝 가능한 조작감/타격감 값. 튜닝 패널에서 바뀐 값은 localStorage에 저장됩니다.
const KEY = 'ss-tuning-v1';

export const DEFAULTS = {
  // 이동 패드
  joyFloating: true,
  joyRadius: 60,
  joyDeadzone: 0.12,
  moveSpeed: 5.2,
  // 화면 회전
  lookSensX: 0.30,      // 도/px
  lookSensY: 0.24,
  adsSensMul: 0.6,      // 기본 조준(아이언사이트)
  sensRedDot: 0.55,
  sens2x: 0.42,
  sens4x: 0.26,
  sens8x: 0.15,
  lookAccel: 0.25,      // 빠르게 밀수록 더 많이 도는 정도
  lookSmoothing: 0.3,   // 0 = 즉시 반응
  invertY: false,
  fireBtnLook: true,
  leftFire: true,
  // 조준 보정
  assistEnabled: true,
  assistRadius: 6,      // 도
  frictionStrength: 0.45,
  magnetStrength: 0.35,
  adsSnap: 0.5,
  autoFire: false,
  showAssistDebug: false,
  // 타격감
  shakeIntensity: 1.0,
  recoilScale: 1.0,
  recoilRecovery: 8,
  crosshairBloom: 1.0,
  crosshairRecovery: 6,
  fovPunch: 1.0,
  muzzleFlash: true,
  damageNumbers: true,
  infiniteAmmo: true,
  showHitboxes: false,
  // 진동 / 사운드
  vibration: true,
  vibrationScale: 1.0,
  volume: 0.6,
};

export const SCHEMA = [
  { group: '이동 패드', items: [
    { key: 'joyFloating', label: '플로팅 조이스틱', type: 'bool', hint: '터치한 위치에 패드가 생기고, 멀리 밀면 따라옵니다' },
    { key: 'joyRadius', label: '패드 반경', min: 35, max: 110, step: 1, unit: 'px' },
    { key: 'joyDeadzone', label: '데드존', min: 0, max: 0.4, step: 0.01 },
    { key: 'moveSpeed', label: '이동 속도', min: 2, max: 9, step: 0.1, unit: 'm/s' },
  ] },
  { group: '화면 회전', items: [
    { key: 'lookSensX', label: '가로 감도', min: 0.05, max: 1, step: 0.01, unit: '°/px' },
    { key: 'lookSensY', label: '세로 감도', min: 0.05, max: 1, step: 0.01, unit: '°/px' },
    { key: 'lookAccel', label: '회전 가속', min: 0, max: 1.5, step: 0.01, hint: '빠른 스와이프일수록 더 크게 회전' },
    { key: 'lookSmoothing', label: '회전 스무딩', min: 0, max: 0.85, step: 0.01, hint: '높을수록 부드럽지만 반응이 늦어집니다' },
    { key: 'invertY', label: '세로 반전', type: 'bool' },
    { key: 'fireBtnLook', label: '발사 버튼으로 시점 회전', type: 'bool', hint: '발사 버튼을 누른 채 드래그해서 조준' },
    { key: 'leftFire', label: '왼쪽 발사 버튼', type: 'bool' },
  ] },
  { group: '조준경별 감도 (기본 감도 대비 배율)', items: [
    { key: 'adsSensMul', label: '기본 조준', min: 0.1, max: 1.2, step: 0.01 },
    { key: 'sensRedDot', label: '레드닷', min: 0.1, max: 1.2, step: 0.01 },
    { key: 'sens2x', label: '2배율', min: 0.05, max: 1, step: 0.01 },
    { key: 'sens4x', label: '4배율', min: 0.05, max: 1, step: 0.01 },
    { key: 'sens8x', label: '8배율', min: 0.03, max: 1, step: 0.01 },
  ] },
  { group: '조준 보정 (Aim Assist)', items: [
    { key: 'assistEnabled', label: '조준 보정 사용', type: 'bool' },
    { key: 'assistRadius', label: '보정 반경', min: 1, max: 15, step: 0.1, unit: '°' },
    { key: 'frictionStrength', label: '감속(마찰) 강도', min: 0, max: 0.9, step: 0.01, hint: '적 위에서 회전 감도가 줄어듭니다' },
    { key: 'magnetStrength', label: '자석(끌림) 강도', min: 0, max: 1, step: 0.01, hint: '입력 중일 때 적 쪽으로 끌어당깁니다' },
    { key: 'adsSnap', label: '조준 시 스냅', min: 0, max: 1, step: 0.01, hint: '조준 버튼을 누르는 순간 적에게 붙는 정도' },
    { key: 'autoFire', label: '자동 사격', type: 'bool', hint: '십자선이 적 위에 오면 자동 발사' },
    { key: 'showAssistDebug', label: '보정 범위 표시 (디버그)', type: 'bool' },
  ] },
  { group: '타격감', items: [
    { key: 'shakeIntensity', label: '화면 흔들림', min: 0, max: 2.5, step: 0.05 },
    { key: 'recoilScale', label: '반동 크기', min: 0, max: 2.5, step: 0.05 },
    { key: 'recoilRecovery', label: '반동 회복 속도', min: 0, max: 20, step: 0.5 },
    { key: 'crosshairBloom', label: '십자선 확장', min: 0, max: 2.5, step: 0.05 },
    { key: 'crosshairRecovery', label: '십자선 회복 속도', min: 1, max: 15, step: 0.5 },
    { key: 'fovPunch', label: '시야(FOV) 펀치', min: 0, max: 2.5, step: 0.05 },
    { key: 'muzzleFlash', label: '총구 화염', type: 'bool' },
    { key: 'damageNumbers', label: '데미지 숫자', type: 'bool' },
    { key: 'infiniteAmmo', label: '예비 탄약 무한', type: 'bool' },
    { key: 'showHitboxes', label: '표적 피격 판정 표시', type: 'bool', hint: '초록 와이어프레임 = 실제로 맞는 범위' },
  ] },
  { group: '진동 · 사운드', items: [
    { key: 'vibration', label: '진동', type: 'bool', hint: 'Android 브라우저만 지원 (iOS Safari는 진동 API 미지원)' },
    { key: 'vibrationScale', label: '진동 세기(길이)', min: 0, max: 3, step: 0.05 },
    { key: 'volume', label: '볼륨', min: 0, max: 1, step: 0.01 },
  ] },
];

export const PRESETS = {
  '기본': {},
  '캐주얼': { assistRadius: 9, frictionStrength: 0.6, magnetStrength: 0.6, adsSnap: 0.8, shakeIntensity: 1.1 },
  '하드코어': { assistEnabled: false, lookSmoothing: 0, lookAccel: 0, shakeIntensity: 0.7, recoilScale: 1.3 },
  '타격감 MAX': { shakeIntensity: 1.8, crosshairBloom: 1.5, fovPunch: 1.8, vibrationScale: 1.8, recoilScale: 1.2 },
};

function load() {
  const c = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k in saved) if (k in DEFAULTS && typeof saved[k] === typeof DEFAULTS[k]) c[k] = saved[k];
  } catch { /* 저장소 사용 불가 시 기본값 */ }
  return c;
}

export const config = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(config)); } catch { /* 무시 */ }
}

export function applyPreset(name) {
  Object.assign(config, DEFAULTS, PRESETS[name] || {});
  save();
}

export function diffFromDefaults() {
  const d = {};
  for (const k in DEFAULTS) if (config[k] !== DEFAULTS[k]) d[k] = config[k];
  return d;
}
