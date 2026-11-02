import * as THREE from 'three';
import { config as cfg } from './config.js';
import { WEAPONS, WEAPON_ORDER, SCOPES, MODE_NAMES, damageAt } from './weapons.js';
import { MAP } from './maps.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Feedback } from './feedback.js';
import { Sfx } from './audio.js';
import { AimAssist } from './aimassist.js';
import { Viewmodel } from './viewmodel.js';
import { Tuning } from './tuning.js';
import { MapView } from './mapview.js';
import { CHARACTERS, dims } from './characters.js';
import { CharSelect, savedCharId } from './charselect.js';
import { urlState, rulesFor, gotoMode } from './modes.js';
import { NavGrid } from './nav.js';
import { PlayerUnit, Match, meleeStrike } from './combat.js';
import { ModeSelect, MatchHud } from './modeui.js';
import { Voice, ANNOUNCER } from './voice.js';
import { Minimap } from './minimap.js';
import { Layout } from './layout.js';
import { surfaceAt } from './maps.js';
import { Progression } from './progression.js';
import { Lobby } from './lobby.js';

const DEG = Math.PI / 180;
const BASE_FOV = 65;   // 세로 FOV
const CROUCH_EYE_K = 0.6;
const PLAYER_R = 0.35;

// 모드 (URL ?mode=...)
const URL_STATE = urlState();
const rules = rulesFor(URL_STATE.mode);
const isMatch = !!rules.match;
const allowed = rules.weapons || WEAPON_ORDER;
const dmgMul = rules.dmgMul ?? 1;

// 플레이어 캐릭터 (이동 속도·눈높이·패시브에 반영)
let CH = CHARACTERS[savedCharId()];
const passive = (k) => CH.passive[k] ?? 1;
const standEye = () => dims(CH).eye;

const $ = (s) => document.querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => t * t * (3 - 2 * t);
// 부드러운 의사 노이즈 (-1..1) — 화면 흔들림용
const noise = (t, s) => Math.sin(t + s * 13.1) * 0.5 + Math.sin(t * 2.3 + s * 7.7) * 0.3 + Math.sin(t * 4.1 + s * 3.3) * 0.2;
// 배율 → 세로 FOV
const zoomFov = (zoom) => 2 * Math.atan(Math.tan(BASE_FOV * DEG / 2) / zoom) / DEG;

// ── 확대 방지 (아이폰 Safari는 viewport의 user-scalable=no를 무시함) ──
// 1) 핀치 확대 제스처 차단  2) 0.35초 안의 두 번째 탭은 기본 동작(더블탭 확대) 취소
//    게임 조작은 pointer 이벤트라 영향 없음
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = performance.now();
  if (now - lastTouchEnd < 350 && !e.target.closest?.('input, textarea, select')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.scale && e.scale !== 1) e.preventDefault(); }, { passive: false });

// ── 렌더러 / 씬 ───────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('#game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.renderScale));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.03, 250);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = new World(scene, MAP, { targets: !isMatch });
const sfx = new Sfx();
const fx = new Feedback(camera, sfx);
const vm = new Viewmodel(camera);
const input = new Input();
const assist = new AimAssist();
const voice = new Voice(sfx);
// 육성: 강화·파츠가 적용된 내 무기 스펙 (AI는 기본 스펙 사용)
const prog = new Progression();
let EFF = {};
const gun = (k) => EFF[k] || (EFF[k] = prog.effective(k));
const minimap = new Minimap(MAP);
const layout = new Layout(input, () => input.applyConfig());
// 내 캐릭터 목소리 / 아군 AI 목소리
const me = () => ({ name: CH.name, team: 'A', voice: CH.voice });
const speakerOf = (c) => (c.isPlayer ? me() : { name: c.name, team: c.team, voice: c.char.voice });

// ── 상태 ──────────────────────────────────
const spawn = MAP.spawns.A[2];
// pos.y = 발 높이 (점프 / 낮은 엄폐물 위)
const P = { pos: new THREE.Vector3(spawn.x, 0, spawn.z), vel: new THREE.Vector3(), vy: 0, grounded: true, yaw: spawn.yaw, pitch: 0, recoilDebt: 0, bob: 0, stepDist: 0, landDip: 0 };
const S = {
  wKey: 'AR', ammo: {}, reserve: {}, modeIdx: {}, scopeIdx: {},
  reloadT: 0, reloadDur: 0, cooldown: 0, fireBuffer: 0, lastShot: -9, shotIdx: 0, burstLeft: 0,
  ads: false, adsT: 0, crouch: false, crouchT: 0, melee: null,
  bloom: 0, trauma: 0, fovPunch: 0, pendX: 0, pendY: 0, time: 0, eyeH: standEye(),
  shots: 0, hits: 0, heads: 0, kills: 0, onTarget: false,
};
function refillAmmo() {
  for (const k of WEAPON_ORDER) {
    S.ammo[k] = gun(k).mag;
    S.reserve[k] = gun(k).reserve;
  }
}
refillAmmo();
for (const k of WEAPON_ORDER) {
  const w = WEAPONS[k];
  S.modeIdx[k] = 0;
  S.scopeIdx[k] = w.scopes.indexOf(w.defaultScope);
}
document.querySelectorAll('[data-weapon]').forEach((b) => { b.hidden = !allowed.includes(b.dataset.weapon); });

// 병영에서 강화·파츠를 바꾸면 스펙·외형·탄창을 다시 계산
function refreshLoadout() {
  EFF = {};
  for (const k of WEAPON_ORDER) {
    const w = gun(k);
    if (S.ammo[k] > w.mag) S.ammo[k] = w.mag;
    if (!w.melee) vm.setLoadout(k, w);
  }
}
const lobby = new Lobby(prog, refreshLoadout);
prog.toast = (text) => {
  const t = document.createElement('div');
  t.textContent = '🏅 ' + text;
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 3200);
};

const curScopeKey = () => WEAPONS[S.wKey].scopes[S.scopeIdx[S.wKey]];
const curMode = () => WEAPONS[S.wKey].modes[S.modeIdx[S.wKey]];

// ── 매치 ──────────────────────────────────
const nav = isMatch ? new NavGrid(world, MAP.bounds) : null;
const player = isMatch ? new PlayerUnit(world, P) : null;
let match = null, mhud = null;
if (isMatch) {
  player.setChar(CH);
  mhud = new MatchHud(rules);
  match = new Match({
    world, nav, map: MAP, rules, sfx, player,
    onKill: (killer, victim, w, head, back) => {
      mhud.feed(killer, victim, w, head, back);
      if (killer === player && victim !== player) onPlayerKill(w, head, back);
      if (victim.team === 'A' && !victim.isPlayer) {
        const ally = match.combatants.find((c) => c.team === 'A' && !c.dead && !c.isPlayer);
        if (ally) voice.say('allyDown', speakerOf(ally), { cooldown: 8, radio: true });
      }
    },
    onEnd: (winner) => {
      voice.say(winner === 'A' ? 'win' : winner === 'B' ? 'lose' : 'draw', ANNOUNCER, { priority: true });
      const reward = prog.finishMatch(winner === 'A', player.kills);
      mhud.result(winner, match, () => gotoMode(URL_STATE.mode), () => {
        mhud.resultEl.hidden = true;
        modeSelect.toggle(true);
      }, reward, () => lobby.toggle(true));
    },
    hooks: {
      // 적 발소리는 크게, 아군은 작게. 벽 너머는 먹먹하게. 방향은 화면 링에도 표시
      step: (s) => {
        const d = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z);
        if (d > 35) return;
        const enemy = s.team !== 'A';
        const pos = { x: s.pos.x, y: 0.1, z: s.pos.z };
        sfx.footstep(pos, { surface: surfaceAt(s.pos.x, s.pos.z), gain: enemy ? cfg.enemyStepVol : cfg.allyStepVol, occluded: occluded(pos) });
        if (enemy) fx.soundPing(relAngle(s.pos), 'step', 1 - d / 35);
      },
      shot: (s, w) => {
        const pos = { x: s.pos.x, y: 1.4, z: s.pos.z };
        const d = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z);
        sfx.shotAt(w, pos, occluded(pos), s.team === 'A' ? 0.75 : 1);
        if (s.team !== 'A' && d < 80) fx.soundPing(relAngle(s.pos), 'shot', 1 - d / 80);
      },
      spotted: (s) => { if (s.team === 'A') voice.say('spotted', speakerOf(s), { cooldown: 6, radio: true }); },
    },
  });
  // 피격: 빨간 화면 + 공격자 방향 표시 + 진동
  player.onHurt = (d, attacker) => {
    let rel;
    if (attacker?.pos) {
      const dx = attacker.pos.x - P.pos.x, dz = attacker.pos.z - P.pos.z;
      rel = Math.atan2(-dx, -dz) - P.yaw;
    }
    mhud.hurt(d, rel);
    sfx.hurt();
    fx.vibrate([18, 25, 18]);
    if (player.hp > 0 && player.hp / player.maxHp < 0.35) voice.say('lowhp', me(), { cooldown: 10 });
  };
  player.onSpawn = (sp) => {
    if (match.state === 'play' && player.deaths > 0) voice.say('respawn', me(), { cooldown: 8 });
    P.pos.set(sp.x, 0, sp.z);
    P.vel.set(0, 0, 0);
    P.vy = 0;
    P.yaw = sp.yaw;
    P.pitch = 0;
    P.recoilDebt = 0;
    refillAmmo();
    Object.assign(S, { reloadT: 0, ads: false, adsT: 0, crouch: false, crouchT: 0, burstLeft: 0, melee: null, bloom: 0 });
  };
}
const combatants = () => (match ? match.combatants : world.bots);

// 소리 위치 → 화면 기준 방향 / 가림 여부
const listenerPos = new THREE.Vector3();
function relAngle(pos) { return Math.atan2(-(pos.x - P.pos.x), -(pos.z - P.pos.z)) - P.yaw; }
function occluded(pos) {
  return cfg.occlusion && world.blocked(listenerPos, new THREE.Vector3(pos.x, Math.max(pos.y, 1), pos.z));
}

// 내가 처치: 보이스 + 연속 킬 아나운서
const multi = { n: 0, t: -9 };
function onPlayerKill(w, head, back) {
  multi.n = S.time - multi.t < 4 ? multi.n + 1 : 1;
  multi.t = S.time;
  if (match) {
    prog.event('kill', { w, head, back, crouched: S.crouch });
    if (multi.n === 2) prog.event('multi');
  }
  if (multi.n >= 2) voice.say(`multi${Math.min(4, multi.n)}`, ANNOUNCER, { cooldown: 0.5, priority: true });
  else voice.say(w.melee ? 'knife' : head ? 'headshot' : 'kill', me(), { cooldown: 2.5 });
}

const mapView = new MapView(MAP, world, isMatch ? null : (x, z) => { P.pos.set(x, 0, z); P.vel.set(0, 0, 0); });
const tuning = new Tuning(() => { input.applyConfig(); resize(); }, () => {
  // 무기 밸런스 패널에서 탄창 크기를 줄였을 때 현재 탄약 정리
  refreshLoadout();
}, () => world.rebuildBots(), {
  onEditHud: () => { tuning.toggle(false); layout.openEditor(); },
  voiceInfo: () => voice.describe(),
  onVoiceTest: (key) => voice.say(key, ['start', 'multi2'].includes(key) ? ANNOUNCER : me(), { cooldown: 0, priority: true }),
});

const charSelect = new CharSelect((id) => {
  CH = CHARACTERS[id];
  switchWeapon(allowed.includes(CH.weapon) ? CH.weapon : allowed[0]);
  if (match) {
    player.setChar(CH);
    if (match.state === 'idle') { match.start(); voice.say('start', ANNOUNCER, { priority: true }); }
  }
  requestFullscreen();
});
const modeSelect = new ModeSelect(URL_STATE.mode, (mode) => {
  if (mode !== URL_STATE.mode || (match && match.state !== 'idle')) gotoMode(mode);
  else charSelect.toggle(true);
}, () => lobby.toggle(true));

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.renderScale));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  input.applyConfig();
}
addEventListener('resize', resize);
resize();

const eye = new THREE.Vector3();
const aimQ = new THREE.Quaternion();
const aimE = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpDir = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const pelletQ = new THREE.Quaternion();
const fwdZ = new THREE.Vector3(0, 0, -1);

function switchWeapon(k) {
  if (!allowed.includes(k) || (k === S.wKey && vm.cur)) return;
  S.wKey = k;
  S.reloadT = 0;
  S.burstLeft = 0;
  S.cooldown = 0.3;       // 교체(드로우) 시간
  S.ads = false;
  S.bloom = 0;
  S.shotIdx = 0;
  S.melee = null;
  vm.setWeapon(k, curScopeKey());
  document.querySelectorAll('[data-weapon]').forEach((b) => b.classList.toggle('on', b.dataset.weapon === k));
}

function startReload() {
  const w = gun(S.wKey);
  if (w.melee || S.reloadT > 0 || S.ammo[S.wKey] >= w.mag) return;
  if (!cfg.infiniteAmmo && S.reserve[S.wKey] <= 0) return;
  // 탄이 남아 있으면 빠른 장전(약실에 한 발 남음), 비었으면 노리쇠 후퇴까지 포함한 긴 장전
  S.reloadT = S.reloadDur = (S.ammo[S.wKey] > 0 ? w.reloadTac : w.reloadEmpty) * passive('reload');
  S.burstLeft = 0;
  S.ads = false;
  // 탄창 분리 → 결합 → (빈 탄창이면) 노리쇠
  const empty = S.ammo[S.wKey] === 0;
  S.reloadSteps = [[0.12, 'out'], [0.62, 'in'], ...(empty ? [[0.86, 'bolt']] : [])];
  sfx.reloadStep('out');
  S.reloadSteps.shift();
  voice.say('reload', me(), { cooldown: 5 });
}

function finishReload() {
  const w = gun(S.wKey);
  const need = w.mag - S.ammo[S.wKey];
  const take = cfg.infiniteAmmo ? need : Math.min(need, S.reserve[S.wKey]);
  S.ammo[S.wKey] += take;
  if (!cfg.infiniteAmmo) S.reserve[S.wKey] -= take;
  S.reloadT = 0;
  sfx.reloadDone();
}

// 무적 중 공격하면 무적 해제 (스폰 킬 악용 방지)
function breakInvuln() {
  if (player && player.invulnT > 0 && rules.invulnBreak) player.invulnT = 0;
}

// 현재 탄퍼짐(도): 지향사격 ↔ 정조준 사이를 ADS 진행도로 보간, 앉으면 감소
function spreadDeg(w, adsE, speedFrac, crouchE) {
  const base = lerp(w.hip.base, w.ads.base, adsE);
  const move = lerp(w.hip.move, w.ads.move * passive('adsMove'), adsE) * Math.min(1, speedFrac);
  const air = P.grounded ? 0 : lerp(3, 1.5, adsE); // 점프 중 사격 페널티
  return (base + move + S.bloom + air) * lerp(1, w.crouchMul, crouchE);
}

// 원뿔 안의 무작위 방향 (균일 원판 분포)
function coneDir(out, baseQ, coneRad) {
  const r = coneRad * Math.sqrt(Math.random());
  const th = Math.random() * Math.PI * 2;
  out.set(Math.tan(r) * Math.cos(th), Math.tan(r) * Math.sin(th), -1).normalize();
  return out.applyQuaternion(baseQ);
}

// 명중 피드백은 탄이 도착한 프레임에 모아서 한 번에 (샷건 펠릿 합산)
const pendingShots = new Set();

function shoot(w, adsE, speedFrac, crouchE) {
  S.ammo[S.wKey]--;
  if (S.time - S.lastShot > w.recoil.reset) S.shotIdx = 0;
  S.lastShot = S.time;
  S.shots++;
  breakInvuln();

  eye.set(P.pos.x, P.pos.y + S.eyeH, P.pos.z);
  aimE.set(P.pitch, P.yaw, 0);
  aimQ.setFromEuler(aimE);
  const center = coneDir(new THREE.Vector3(), aimQ, spreadDeg(w, adsE, speedFrac, crouchE) * DEG);
  pelletQ.setFromUnitVectors(fwdZ, center);
  const off = vm.muzzleWorld(muzzle).sub(eye);

  const shot = { w, team: 'A', owner: player, mine: true, dmg: 0, head: false, kill: false, point: null, hitCounted: false, headCounted: false };
  const pSpread = w.pelletSpread * lerp(1, w.adsPelletMul || 1, adsE) * DEG;
  for (let i = 0; i < w.pellets; i++) {
    const dir = w.pellets > 1 ? coneDir(tmpDir, pelletQ, pSpread) : center;
    world.fire(eye, dir, w.velocity, shot, w.pellets === 1 || i % 2 === 0, off);
  }

  // 반동 패턴: 발 순서대로 정해진 [위, 오른쪽] + 약간의 랜덤
  const R = w.recoil;
  const [up, side] = R.pattern[Math.min(S.shotIdx, R.pattern.length - 1)];
  const k = cfg.recoilScale * R.scale * lerp(1, R.adsMul, adsE) * lerp(1, 0.85, crouchE) * passive('recoil') * DEG;
  const kickUp = up * (1 + (Math.random() * 2 - 1) * R.jitter) * k;
  P.pitch += kickUp;
  P.recoilDebt += kickUp;
  P.yaw -= (side + (Math.random() * 2 - 1) * R.jitter * 0.5) * k;
  S.shotIdx++;

  // 손맛
  const perShot = lerp(w.hip.perShot, w.ads.perShot, adsE);
  const maxBloom = lerp(w.hip.max, w.ads.max, adsE);
  S.bloom = Math.max(S.bloom, Math.min(maxBloom, S.bloom + perShot * cfg.crosshairBloom));
  S.trauma = Math.min(1, S.trauma + w.shake * cfg.shakeIntensity * lerp(1, 0.7, adsE));
  S.fovPunch += w.fovPunch * lerp(1, 0.5, adsE);
  vm.fire(w, cfg.muzzleFlash && !w.noFlash);
  sfx.shot(w);
  fx.vibrate(w.vib);
  match?.hear(P.pos, w.hearRadius ?? 45, player);
}

// 칼: 휘두르기 시작 → windup 후 판정
function startMelee(kind) {
  const w = WEAPONS.KN, m = w[kind];
  S.cooldown = kind === 'stab' ? m.cooldown : 60 / w.rpm;
  S.melee = { kind, t: m.windup };
  vm.swing(kind);
  sfx.swing(kind === 'stab');
  S.trauma = Math.min(1, S.trauma + w.shake * cfg.shakeIntensity);
  breakInvuln();
}

function resolveMelee() {
  const w = WEAPONS.KN, m = w[S.melee.kind];
  S.melee = null;
  S.shots++;
  const r = meleeStrike(player || { team: 'A' }, combatants(), world, {
    pos: P.pos, yaw: P.yaw, eyeY: P.pos.y + S.eyeH, team: 'A',
    range: m.range, angle: m.angle, dmg: m.dmg * dmgMul, backMul: w.backMul,
  });
  if (!r) return;
  if (!r.applied) { world.impact(r.point, 'shield'); return; }
  world.impact(r.point, 'flesh');
  S.hits++;
  S.fovPunch += 1.2;
  fx.hit({ dmg: r.dmg, head: r.back, kill: r.killed, point: r.point }, w);
  if (r.killed) {
    S.kills++;
    if (match) match.onKill(player, r.victim, w, false, r.back);
    else onPlayerKill(w, false, r.back);
  }
}

function onBulletHit(b, h, dist) {
  const ud = h.object.userData;
  const shot = b.shot;
  if (!ud.bot) { world.impact(h.point, 'wall'); return; }
  const victim = ud.bot, head = ud.part === 'head';
  const dmg = damageAt(shot.w, dist) * (head ? shot.w.headMul : 1) * dmgMul;
  const r = victim.damage(dmg, ud.part, shot.owner);
  if (!r.applied) { world.impact(h.point, 'shield'); return; }
  world.impact(h.point, head ? 'head' : 'flesh');
  if (shot.mine) {
    shot.dmg += dmg;
    shot.head ||= head;
    shot.kill ||= r.killed;
    shot.point ||= h.point.clone();
    pendingShots.add(shot);
  }
  if (r.killed && match) match.onKill(shot.owner, victim, shot.w, head, false);
}

function flushHits() {
  for (const s of pendingShots) {
    if (!s.hitCounted) { S.hits++; s.hitCounted = true; }
    if (s.head && !s.headCounted) { S.heads++; s.headCounted = true; }
    if (s.kill) { S.kills++; if (!match) onPlayerKill(s.w, s.head, false); }
    fx.hit({ dmg: s.dmg, head: s.head, kill: s.kill, point: s.point }, s.w);
    s.dmg = 0; s.head = false; s.kill = false; s.point = null;
  }
  pendingShots.clear();
}

// ── HUD ───────────────────────────────────
const hud = {
  cur: $('#ammo-cur'), max: $('#ammo-max'), name: $('#weapon-name'),
  bar: $('#reload-bar'), barFill: $('#reload-bar i'), stats: $('#stats'),
  lobbyDot: $('#btn-menu i'), ads: $('#btn-ads'), crouch: $('#btn-crouch'), mode: $('#btn-mode'), scope: $('#btn-scope'),
};
let statT = 0, frames = 0, fps = 0;
function updateHud(dt, w, a) {
  const ammo = S.ammo[S.wKey];
  hud.cur.textContent = w.melee ? '—' : ammo;
  hud.cur.classList.toggle('low', !w.melee && ammo <= Math.ceil(w.mag * 0.25));
  hud.max.textContent = w.melee ? '' : ' / ' + (cfg.infiniteAmmo ? '∞' : S.reserve[S.wKey]);
  hud.name.textContent = w.name;
  hud.bar.classList.toggle('on', S.reloadT > 0);
  hud.barFill.style.width = S.reloadT > 0 ? (1 - S.reloadT / S.reloadDur) * 100 + '%' : '0';
  hud.ads.classList.toggle('on', S.ads);
  hud.ads.querySelector('span').textContent = w.melee ? '찌르기' : '조준';
  hud.crouch.classList.toggle('on', S.crouch);
  hud.mode.textContent = w.melee ? '베기' : MODE_NAMES[curMode()];
  hud.mode.classList.toggle('single-only', w.modes.length < 2);
  hud.scope.textContent = SCOPES[curScopeKey()].name;
  hud.scope.hidden = !!w.melee;
  frames++;
  statT += dt;
  if (statT >= 0.5) {
    fps = Math.round(frames / statT);
    frames = 0;
    statT = 0;
    const acc = S.shots ? Math.round(S.hits / S.shots * 100) : 0;
    const hs = S.hits ? Math.round(S.heads / S.hits * 100) : 0;
    const asst = !cfg.assistEnabled ? '꺼짐' : a.target ? `감속 ×${a.friction.toFixed(2)}` : '대기';
    const zone = MAP.zones.find((z) => P.pos.x >= z.x0 && P.pos.x <= z.x1 && P.pos.z >= z.z0 && P.pos.z <= z.z1);
    const kd = player ? `킬 ${player.kills} / 데스 ${player.deaths}` : `킬 ${S.kills}`;
    hud.stats.textContent = `${rules.name} · ${CH.name} (${CH.cls})\nFPS ${fps}   ${kd}\n명중 ${acc}%   헤드 ${hs}%\n조준보정 ${asst}\n구역: ${zone ? zone.name : '연결 통로'}`;
  }
}

// ── 메인 루프 ─────────────────────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.time += dt;

  const dead = !!player?.dead;
  const inp = input.consume();
  if (dead || match?.state === 'end') {
    // 사망 중에는 조작 불가 (맵 보기만 허용)
    Object.assign(inp, { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fireHeld: false, firePressed: false, weapon: null, lookActive: false });
    inp.pressed = new Set([...inp.pressed].filter((p) => p === 'map'));
    S.ads = false;
  }
  const press = inp.pressed;
  if (inp.weapon) switchWeapon(inp.weapon);
  const w = gun(S.wKey);
  if (press.has('reload')) startReload();
  if (press.has('map')) mapView.toggle();
  if (press.has('char')) charSelect.toggle(true);
  if (press.has('modes')) modeSelect.toggle(true);
  if (press.has('score')) mhud?.toggleBoard();
  if (press.has('lobby')) lobby.toggle(true);
  if (press.has('menu')) quickMenu.hidden = !quickMenu.hidden;
  hud.lobbyDot.hidden = !prog.claimable();
  hud.stats.hidden = !cfg.showStats;
  if (world.hitboxVisible !== cfg.showHitboxes) world.setHitboxVisible(cfg.showHitboxes);
  if (press.has('crouch')) S.crouch = !S.crouch;
  if (press.has('mode') && w.modes.length > 1) {
    S.modeIdx[S.wKey] = (S.modeIdx[S.wKey] + 1) % w.modes.length;
    S.burstLeft = 0;
  }
  if (press.has('scope') && w.scopes.length > 1) {
    S.scopeIdx[S.wKey] = (S.scopeIdx[S.wKey] + 1) % w.scopes.length;
    vm.setScope(curScopeKey());
  }
  const scope = SCOPES[curScopeKey()];

  S.crouchT = clamp(S.crouchT + (S.crouch ? 1 : -1) * dt / 0.15, 0, 1);
  const crouchE = smooth(S.crouchT);
  const eyeStand = standEye();
  S.eyeH = lerp(eyeStand, eyeStand * CROUCH_EYE_K, crouchE);

  eye.set(P.pos.x, P.pos.y + S.eyeH, P.pos.z);
  const a = assist.update(eye, P.yaw, P.pitch, world, cfg, combatants());

  S.cooldown -= dt;
  if (press.has('ads')) {
    if (w.melee) {
      if (S.cooldown <= 0 && !S.melee) startMelee('stab');
    } else if (S.reloadT <= 0) {
      S.ads = !S.ads;
      // 조준 시 스냅: ADS 진입 순간 보정 대상 쪽으로 붙음
      if (S.ads && a.target && cfg.adsSnap > 0) {
        P.yaw += a.yawErr * cfg.adsSnap * a.weight;
        P.pitch += a.pitchErr * cfg.adsSnap * a.weight;
      }
    }
  }
  // 정조준 전환 시간 = 무기 기본 + 조준경 배율에 따른 추가 시간
  S.adsT = clamp(S.adsT + (S.ads ? 1 : -1) * dt / ((w.adsTime + scope.adsTimeAdd) * passive('ads')), 0, 1);
  const adsE = smooth(S.adsT);

  if (S.reloadT > 0) {
    S.reloadT -= dt;
    const frac = 1 - S.reloadT / S.reloadDur;
    while (S.reloadSteps?.length && frac >= S.reloadSteps[0][0]) sfx.reloadStep(S.reloadSteps.shift()[1]);
    if (S.reloadT <= 0) finishReload();
  }

  // 시점 회전: 스무딩 → 감도(조준경별 배율) → 조준 보정 감속
  S.pendX += inp.lookX;
  S.pendY += inp.lookY;
  const k = cfg.lookSmoothing <= 0 ? 1 : 1 - Math.pow(cfg.lookSmoothing, dt * 60);
  const ax = S.pendX * k, ay = S.pendY * k;
  S.pendX -= ax;
  S.pendY -= ay;
  const zoomK = lerp(1, cfg[scope.sensKey], adsE);
  const fr = a.target ? a.friction : 1;
  P.yaw -= ax * cfg.lookSensX * DEG * zoomK * fr;
  const dp = -ay * cfg.lookSensY * DEG * zoomK * fr * (cfg.invertY ? -1 : 1);
  P.pitch += dp;
  if (dp < 0) P.recoilDebt = Math.max(0, P.recoilDebt + dp); // 직접 반동 제어한 만큼 자동 회복 차감

  // 자석: 회전/이동/사격 입력이 있을 때만 끌어당김 (가만히 있으면 저절로 움직이지 않게)
  const moving = Math.hypot(inp.moveX, inp.moveY) > 0.1;
  if (a.target && cfg.magnetStrength > 0 && (inp.lookActive || moving || inp.fireHeld)) {
    const m = (1 - Math.exp(-cfg.magnetStrength * 5 * dt)) * a.weight;
    P.yaw += a.yawErr * m;
    P.pitch += a.pitchErr * m * 0.6;
  }

  // 이동
  const baseSpeed = cfg.moveSpeed * CH.speed * (rules.speedMul ?? 1);
  const crouchSpeed = Math.min(1, 0.5 * passive('crouchSpeed'));
  const sp = baseSpeed * w.mobility * lerp(1, 0.6, adsE) * lerp(1, crouchSpeed, crouchE);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const tx = (-sy * inp.moveY + cy * inp.moveX) * sp;
  const tz = (-cy * inp.moveY - sy * inp.moveX) * sp;
  const acc = 1 - Math.exp(-(moving ? 14 : 10) * dt);
  P.vel.x += (tx - P.vel.x) * acc;
  P.vel.z += (tz - P.vel.z) * acc;
  P.pos.x += P.vel.x * dt;
  P.pos.z += P.vel.z * dt;
  world.collide(P.pos, PLAYER_R, P.pos.y);
  // 점프 (낮은 엄폐물 1.05m 위로 올라갈 수 있는 높이)
  if (press.has('jump') && P.grounded) { P.vy = 5.4; P.grounded = false; S.crouch = false; }
  const prevY = P.pos.y;
  P.vy -= 13 * dt;
  P.pos.y += P.vy * dt;
  const ground = world.groundAt(P.pos.x, P.pos.z, prevY);
  if (P.pos.y <= ground) {
    if (!P.grounded && P.vy < -2) {
      sfx.land(surfaceAt(P.pos.x, P.pos.z));
      P.landDip = Math.min(0.12, -P.vy * 0.016);
      S.trauma = Math.min(1, S.trauma + 0.06);
      match?.hear(P.pos, 16, player);
    }
    P.pos.y = ground;
    P.vy = 0;
    P.grounded = true;
  } else P.grounded = false;
  P.landDip *= Math.exp(-dt * 10);
  const hSpeed = Math.hypot(P.vel.x, P.vel.z);
  const speedFrac = hSpeed / baseSpeed;
  P.bob += hSpeed * dt * 1.9;
  // 내 발소리 (앉아서 걸으면 무음 → 적 AI도 못 들음)
  if (P.grounded && hSpeed > 0.6) {
    P.stepDist += hSpeed * dt;
    if (P.stepDist > 1.9) {
      P.stepDist = 0;
      if (crouchE < 0.5) {
        sfx.footstep(null, { surface: surfaceAt(P.pos.x, P.pos.z), gain: cfg.ownStepVol });
        match?.hear(P.pos, 16, player);
      }
    }
  }

  // 사격: 연사 = 누르는 동안, 단발/점사 = 누를 때마다 (0.15초 입력 버퍼)
  const mode = curMode();
  if (inp.firePressed) S.fireBuffer = 0.15;
  S.fireBuffer -= dt;
  if (w.melee) {
    if ((inp.fireHeld || S.fireBuffer > 0) && S.cooldown <= 0 && !S.melee) { startMelee('slash'); S.fireBuffer = 0; }
    if (S.melee && (S.melee.t -= dt) <= 0) resolveMelee();
  } else {
    let want;
    if (S.burstLeft > 0) want = true;
    else if (mode === 'auto') want = inp.fireHeld;
    else want = S.fireBuffer > 0;
    if (cfg.autoFire && S.onTarget && !dead) want = true;
    if (!want && S.cooldown < 0) S.cooldown = 0;
    if (want && S.cooldown <= 0 && S.reloadT <= 0) {
      if (S.ammo[S.wKey] > 0) {
        if (mode === 'burst' && S.burstLeft === 0) S.burstLeft = w.burstCount;
        shoot(w, adsE, speedFrac, crouchE);
        S.fireBuffer = 0;
        if (S.burstLeft > 0) {
          S.burstLeft--;
          S.cooldown += S.burstLeft > 0 ? 60 / w.burstRpm : w.burstDelay;
        } else {
          S.cooldown += 60 / w.rpm;
        }
      } else {
        S.burstLeft = 0;
        if (inp.firePressed) sfx.dry();
        startReload();
      }
    }
  }

  // 반동 회복 / 십자선 회복 / 트라우마 감소
  if (S.time - S.lastShot > 0.06) {
    const rec = P.recoilDebt * (1 - Math.exp(-cfg.recoilRecovery * dt));
    P.pitch -= rec;
    P.recoilDebt -= rec;
  }
  P.pitch = clamp(P.pitch, -85 * DEG, 85 * DEG);
  S.bloom *= Math.exp(-cfg.crosshairRecovery * dt);
  S.trauma = Math.max(0, S.trauma - dt * 2.2);
  S.fovPunch *= Math.exp(-dt * 12);

  // 카메라: 조준 방향 + 흔들림(시각 전용, 탄도에는 영향 없음)
  const sh = S.trauma * S.trauma;
  const nt = S.time * 28;
  const bobA = Math.min(1, speedFrac) * (1 - adsE * 0.8);
  if (dead) {
    // 사망 카메라: 위로 떠오르며 나를 처치한 적을 바라봄
    player.deathT = (player.deathT || 0) + dt;
    camera.position.set(P.pos.x, P.pos.y + S.eyeH + Math.min(1.6, player.deathT * 2), P.pos.z + Math.min(1.2, player.deathT * 1.5));
    const kpos = player.killer?.pos;
    if (kpos && player.killer !== player) camera.lookAt(kpos.x, 1.2, kpos.z);
    else camera.rotation.set(-0.6, P.yaw, 0);
  } else {
    if (player) player.deathT = 0;
    camera.position.set(P.pos.x, P.pos.y + S.eyeH - P.landDip + Math.sin(P.bob * 2) * 0.03 * bobA, P.pos.z);
    camera.rotation.set(P.pitch + noise(nt, 1) * 2.2 * DEG * sh, P.yaw + noise(nt, 2) * 2.2 * DEG * sh, noise(nt, 3) * 3 * DEG * sh);
  }
  const fov = lerp(BASE_FOV, zoomFov(scope.zoom), adsE) + S.fovPunch * cfg.fovPunch;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  listenerPos.copy(camera.position);
  sfx.setListener(listenerPos, camera.getWorldDirection(tmpDir));
  if (match && match.state === 'play') {
    // 내 시야(±40°, 70m)에 적이 새로 들어오면 "적 발견!"
    S.spotT = (S.spotT || 0) - dt;
    if (S.spotT <= 0 && !dead) {
      S.spotT = 0.3;
      const seeing = match.combatants.some((c) => c.team === 'B' && !c.dead
        && Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) < 70
        && Math.abs(Math.atan2(Math.sin(relAngle(c.pos)), Math.cos(relAngle(c.pos)))) < 40 * DEG
        && !world.blocked(listenerPos, new THREE.Vector3(c.pos.x, c.chestY, c.pos.z)));
      if (seeing && !S.seeing) voice.say('spotted', me(), { cooldown: 6 });
      S.seeing = seeing;
    }
    if (match.time <= 10 && !S.tenSaid) { S.tenSaid = true; voice.say('tenSec', ANNOUNCER, { priority: true }); }
  }

  // 십자선이 적 위에 있는지 (빨간 십자선 / 자동 사격)
  aimE.set(P.pitch, P.yaw, 0);
  tmpDir.set(0, 0, -1).applyEuler(aimE);
  const ch = world.raycast(eye.set(P.pos.x, P.pos.y + S.eyeH, P.pos.z), tmpDir, w.melee ? WEAPONS.KN.slash.range + 0.4 : 150, 'A');
  S.onTarget = !!(ch && ch.object.userData.bot);

  if (match) {
    player.sync(S.eyeH);
    match.update(dt);
  }
  world.update(dt, camera, onBulletHit);
  flushHits();

  // 조준경 표시: 배율 조준경은 거의 다 들어올렸을 때 총을 숨기고 스코프 화면으로
  const scoped = scope.sight === 'scope' && adsE > 0.85;
  const overlay = scope.sight === 'scope' ? (scoped ? curScopeKey() : null) : (adsE > 0.7 ? curScopeKey() : null);
  vm.update(dt, { adsE, lookX: ax, lookY: ay, speedFrac, bob: P.bob, hide: scoped || dead, reloadFrac: S.reloadT > 0 ? 1 - S.reloadT / S.reloadDur : -1 });
  const pellet = w.pellets > 1 ? w.pelletSpread * lerp(1, w.adsPelletMul || 1, adsE) : 0;
  fx.update(dt, { spreadDeg: spreadDeg(w, adsE, speedFrac, crouchE) + pellet, onTarget: S.onTarget, hideCross: adsE > 0.55 || dead, overlay: dead ? null : overlay, assist: a });
  updateHud(dt, w, a);
  if (mhud) mhud.update(dt, match, player);
  mapView.draw(P, S.eyeH, combatants());
  minimap.draw(P, combatants(), match ? match.now : 0, !match);

  renderer.render(scene, camera);
}

refreshLoadout();
switchWeapon(allowed.includes(CH.weapon) ? CH.weapon : allowed[0]);
requestAnimationFrame(frame);

// ── ☰ 빠른 메뉴 (모바일: 작은 아이콘 대신 큰 버튼 한곳에) ─────
const quickMenu = $('#quickmenu');
quickMenu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (!b && e.target !== quickMenu) return;
  quickMenu.hidden = true;
  ({
    lobby: () => lobby.toggle(true),
    modes: () => modeSelect.toggle(true),
    char: () => charSelect.toggle(true),
    map: () => mapView.toggle(true),
    tune: () => tuning.toggle(true),
    hud: () => layout.openEditor(),
    fullscreen: () => (fsElement() ? document.exitFullscreen?.() : canFullscreen ? requestFullscreen() : ($('#ios-guide').hidden = false)),
  })[b?.dataset.q]?.();
});

// ── 전체 화면 ─────────────────────────────
// 안드로이드(크롬·삼성 인터넷): 전체 화면 API 사용. 풀려도 게임 화면을 다시 탭하면 재진입
// 아이폰: 웹페이지 전체 화면 API가 없음 → "홈 화면에 추가"로 설치해서 실행하는 것이 유일한 방법
const root = document.documentElement;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const touchDevice = matchMedia('(pointer: coarse)').matches;

function requestFullscreen() {
  if (!touchDevice || standalone || fsElement() || !canFullscreen) return;
  const p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen();
  Promise.resolve(p).then(() => screen.orientation?.lock?.('landscape')).catch(() => { /* 미지원 */ });
}
// 게임 화면을 탭할 때마다 (전체 화면이 풀려 있으면) 다시 전체 화면으로
$('#touch-layer').addEventListener('pointerdown', requestFullscreen);
document.querySelectorAll('#hud .btn').forEach((b) => b.addEventListener('pointerdown', requestFullscreen));

{
  const hint = $('#install-hint');
  if (touchDevice && !standalone) {
    hint.hidden = false;
    hint.innerHTML = canFullscreen
      ? '📲 화면을 탭하면 전체 화면이 됩니다. 브라우저 메뉴(⋮) → <b>홈 화면에 추가</b>로 설치하면 아이콘으로 바로 전체 화면 실행돼요.'
      : '📲 아이폰은 브라우저에서 전체 화면이 지원되지 않아요. <b>홈 화면에 추가</b>해서 실행해 주세요.';
  }
  // 아이폰 브라우저 첫 접속: 설치 방법 단계 안내
  let seen = false;
  try { seen = localStorage.getItem('ss-ios-guide') === '1'; } catch { /* 무시 */ }
  if (isIOS && !standalone && !seen && !URL_STATE.go) $('#ios-guide').hidden = false;
  $('#ios-guide').addEventListener('click', (e) => {
    if (!e.target.closest('[data-close]')) return;
    if (e.target.closest('[data-never]')) { try { localStorage.setItem('ss-ios-guide', '1'); } catch { /* 무시 */ } }
    $('#ios-guide').hidden = true;
  });
}

// ── 시작 화면 → 모드 선택 → 캐릭터 선택 ─────
addEventListener('pointerdown', () => sfx.unlock(), { once: true });
if (URL_STATE.go) {
  // 모드를 고르고 넘어온 경우: 바로 캐릭터 선택
  $('#start').classList.add('hidden');
  charSelect.toggle(true);
}
$('#start-btn').addEventListener('click', () => {
  sfx.unlock();
  $('#start').classList.add('hidden');
  modeSelect.toggle(true);
  requestFullscreen();
});

// 디버그용
window.__game = { P, S, world, cfg, WEAPONS, mapView, charSelect, modeSelect, rules, sfx, voice, layout, prog, lobby, get match() { return match; }, get player() { return player; }, get CH() { return CH; } };
