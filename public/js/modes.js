// 게임 모드 규칙과 AI 난이도. 모드별 설정(시간·목표 킬·리스폰·무적)은 모드 선택 화면에서 바꿀 수 있고 저장됩니다.
const KEY = 'ss-modes-v1';

export const DIFFICULTY = {
  //        반응 시간(초)  조준 오차(°)  회전 속도(rad/s)  헤드 노림 확률  조준 보정 속도
  easy:   { name: '쉬움',   reaction: 0.55, aimErr: 4.0, turn: 4, headChance: 0.05, learn: 1.2 },
  normal: { name: '보통',   reaction: 0.38, aimErr: 2.5, turn: 6, headChance: 0.12, learn: 2.0 },
  hard:   { name: '어려움', reaction: 0.24, aimErr: 1.4, turn: 9, headChance: 0.22, learn: 3.0 },
};

export const MODES = {
  training: {
    name: '훈련장', tag: '연습', match: false,
    desc: '움직이는 표적으로 조작감 · 총기 · 맵을 자유롭게 테스트합니다. 맵을 탭해 순간이동할 수 있습니다.',
  },
  tdm: {
    name: '팀 데스매치', tag: '기본', match: true, weapons: null,
    desc: '4대4. 제한 시간 안에 목표 킬을 먼저 달성한 팀이 승리합니다. 모든 무기 사용 가능.',
    time: 300, scoreLimit: 40, respawn: 3, invuln: 1.5, speedMul: 1, dmgMul: 1,
  },
  sniper: {
    name: '저격전', tag: '이벤트', match: true, weapons: ['SR', 'KN'],
    desc: '저격소총과 칼만 사용. 한 발 한 발이 중요한 긴장감 있는 모드.',
    time: 240, scoreLimit: 30, respawn: 3, invuln: 2, speedMul: 1, dmgMul: 1,
  },
  knife: {
    name: '칼전', tag: '이벤트', match: true, weapons: ['KN'],
    desc: '칼만 사용. 베기 2번 또는 찌르기 1번으로 처치, 등 뒤 공격은 2배.',
    time: 180, scoreLimit: 25, respawn: 2, invuln: 1.5, speedMul: 1.1, dmgMul: 1,
  },
  knife2: {
    name: '칼칼전', tag: '이벤트', match: true, weapons: ['KN'],
    desc: '칼만 사용하고 모든 공격이 한 방. 이동 속도 1.3배, 1초 만에 부활하는 초고속 난타전.',
    time: 150, scoreLimit: 30, respawn: 1, invuln: 1, speedMul: 1.3, dmgMul: 10,
  },
};

export const MODE_ORDER = ['training', 'tdm', 'sniper', 'knife', 'knife2'];

const fmtTime = (v) => `${Math.floor(v / 60)}분${v % 60 ? ` ${v % 60}초` : ''}`;
export const SETTING_FIELDS = [
  { key: 'time', label: '제한 시간', min: 60, max: 900, step: 30, fmt: fmtTime },
  { key: 'scoreLimit', label: '목표 킬', min: 5, max: 100, step: 1, fmt: (v) => `${v}킬` },
  { key: 'respawn', label: '리스폰 대기', min: 0.5, max: 6, step: 0.5, fmt: (v) => `${v}초` },
  { key: 'invuln', label: '리스폰 무적', min: 0, max: 3, step: 0.1, fmt: (v) => `${v.toFixed(1)}초` },
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export const modeSettings = Object.assign({ diff: 'normal', invulnBreak: true }, load());

export function saveModeSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(modeSettings)); } catch { /* 무시 */ }
}

// 모드 기본값 + 저장된 설정을 합친 실제 규칙
export function rulesFor(key) {
  const r = { key, ...MODES[key], ...(modeSettings[key] || {}) };
  r.diff = DIFFICULTY[modeSettings.diff] || DIFFICULTY.normal;
  r.invulnBreak = modeSettings.invulnBreak;
  return r;
}

export function urlState() {
  const p = new URLSearchParams(location.search);
  const m = p.get('mode');
  return { mode: MODES[m] ? m : 'training', go: p.get('go') === '1' };
}

export function gotoMode(mode, go = true) {
  location.search = `?mode=${mode}${go ? '&go=1' : ''}`;
}
