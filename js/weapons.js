// 무기별 성능과 손맛 수치. 각도 단위는 도(°).
//  spreadBase: 기본 탄퍼짐 / spreadPerShot: 발당 확장 / moveSpread: 이동 시 추가
//  recoilPitch/Yaw: 발당 반동 / shake: 화면 흔들림 트라우마 / kick: 뷰모델 뒤로 밀림
export const WEAPON_ORDER = ['AR', 'SR', 'SG', 'HG'];

export const WEAPONS = {
  AR: {
    key: 'AR', name: '돌격소총', auto: true, rpm: 600,
    damage: 25, headMul: 2.0, pellets: 1, pelletSpread: 0,
    mag: 30, reload: 1.9, range: 80, falloffStart: 25, minDmgMul: 0.7,
    spreadBase: 0.7, spreadPerShot: 0.45, spreadMax: 4.5, moveSpread: 1.6, adsSpreadMul: 0.3,
    recoilPitch: 0.5, recoilYaw: 0.22, shake: 0.13, kick: 0.022, fovPunch: 0.6,
    adsFov: 48, adsSensK: 1, mobility: 1, vib: 12,
    sfx: { cut: 2800, decay: 0.09, thump: 150, gain: 0.8 },
  },
  SR: {
    key: 'SR', name: '저격소총', auto: false, rpm: 50, scope: true,
    damage: 90, headMul: 2.5, pellets: 1, pelletSpread: 0,
    mag: 5, reload: 2.6, range: 150, falloffStart: 150, minDmgMul: 1,
    spreadBase: 4, spreadPerShot: 5, spreadMax: 9, moveSpread: 3, adsSpreadMul: 0,
    recoilPitch: 4, recoilYaw: 0.6, shake: 0.5, kick: 0.12, fovPunch: 2.5,
    adsFov: 16, adsSensK: 0.5, mobility: 0.9, vib: 35,
    sfx: { cut: 1800, decay: 0.35, thump: 70, gain: 1.2 },
  },
  SG: {
    key: 'SG', name: '샷건', auto: false, rpm: 75,
    damage: 13, headMul: 1.5, pellets: 8, pelletSpread: 5.5,
    mag: 6, reload: 2.3, range: 30, falloffStart: 8, minDmgMul: 0.3,
    spreadBase: 1.2, spreadPerShot: 2.5, spreadMax: 6, moveSpread: 1, adsSpreadMul: 0.7,
    recoilPitch: 3.2, recoilYaw: 0.5, shake: 0.45, kick: 0.1, fovPunch: 2,
    adsFov: 55, adsSensK: 1, mobility: 1, vib: 30,
    sfx: { cut: 1400, decay: 0.25, thump: 60, gain: 1.3 },
  },
  HG: {
    key: 'HG', name: '권총', auto: false, rpm: 360,
    damage: 30, headMul: 2.0, pellets: 1, pelletSpread: 0,
    mag: 12, reload: 1.4, range: 50, falloffStart: 15, minDmgMul: 0.6,
    spreadBase: 1.0, spreadPerShot: 1.0, spreadMax: 4, moveSpread: 1.2, adsSpreadMul: 0.4,
    recoilPitch: 1.2, recoilYaw: 0.35, shake: 0.15, kick: 0.05, fovPunch: 0.8,
    adsFov: 52, adsSensK: 1, mobility: 1.08, vib: 15,
    sfx: { cut: 3200, decay: 0.08, thump: 180, gain: 0.8 },
  },
};
