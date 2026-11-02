import * as THREE from 'three';
import { config as cfg } from './config.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Feedback } from './feedback.js';
import { Sfx } from './audio.js';
import { AimAssist } from './aimassist.js';
import { Viewmodel } from './viewmodel.js';
import { Tuning } from './tuning.js';

const DEG = Math.PI / 180;
const BASE_FOV = 65;   // 세로 FOV
const EYE = 1.6;
const PLAYER_R = 0.35;

const $ = (s) => document.querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => t * t * (3 - 2 * t);
// 부드러운 의사 노이즈 (-1..1) — 화면 흔들림용
const noise = (t, s) => Math.sin(t + s * 13.1) * 0.5 + Math.sin(t * 2.3 + s * 7.7) * 0.3 + Math.sin(t * 4.1 + s * 3.3) * 0.2;

// ── 렌더러 / 씬 ───────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('#game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.03, 250);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = new World(scene);
const sfx = new Sfx();
const fx = new Feedback(camera, sfx);
const vm = new Viewmodel(camera);
const input = new Input();
const assist = new AimAssist();
new Tuning(() => input.applyConfig());

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  input.applyConfig();
}
addEventListener('resize', resize);
resize();

// ── 상태 ──────────────────────────────────
const P = { pos: new THREE.Vector3(0, 0, 14), vel: new THREE.Vector3(), yaw: 0, pitch: 0, recoilDebt: 0, bob: 0 };
const S = {
  wKey: 'AR', ammo: {}, reloadT: 0, cooldown: 0, fireBuffer: 0, lastShot: -1,
  ads: false, adsT: 0, bloom: 0, trauma: 0, fovPunch: 0, pendX: 0, pendY: 0, time: 0,
  shots: 0, hits: 0, heads: 0, kills: 0, onTarget: false,
};
for (const k of WEAPON_ORDER) S.ammo[k] = WEAPONS[k].mag;

const eye = new THREE.Vector3();
const aimQ = new THREE.Quaternion();
const aimE = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpDir = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const endPt = new THREE.Vector3();

function switchWeapon(k) {
  if (k === S.wKey && vm.cur) return;
  S.wKey = k;
  S.reloadT = 0;
  S.cooldown = 0.3;       // 교체(드로우) 시간
  S.ads = false;
  S.bloom = 0;
  vm.setWeapon(k);
  document.querySelectorAll('[data-weapon]').forEach((b) => b.classList.toggle('on', b.dataset.weapon === k));
}

function startReload() {
  const w = WEAPONS[S.wKey];
  if (S.reloadT > 0 || S.ammo[S.wKey] === w.mag) return;
  S.reloadT = w.reload;
  S.ads = false;
  sfx.reload();
}

// 현재 탄퍼짐(도)
function spreadDeg(w, adsE, speedFrac) {
  return (w.spreadBase + S.bloom + w.moveSpread * Math.min(1, speedFrac)) * lerp(1, w.adsSpreadMul, adsE);
}

// 원뿔 안의 무작위 방향 (균일 원판 분포)
function coneDir(out, baseQ, coneRad) {
  const r = coneRad * Math.sqrt(Math.random());
  const th = Math.random() * Math.PI * 2;
  out.set(Math.tan(r) * Math.cos(th), Math.tan(r) * Math.sin(th), -1).normalize();
  return out.applyQuaternion(baseQ);
}

const pelletQ = new THREE.Quaternion();
const fwdZ = new THREE.Vector3(0, 0, -1);

function shoot(w, adsE, speedFrac) {
  S.ammo[S.wKey]--;
  S.cooldown += 60 / w.rpm;
  S.lastShot = S.time;
  S.shots++;

  eye.copy(camera.position);
  aimE.set(P.pitch, P.yaw, 0);
  aimQ.setFromEuler(aimE);
  const center = coneDir(new THREE.Vector3(), aimQ, spreadDeg(w, adsE, speedFrac) * DEG);
  pelletQ.setFromUnitVectors(fwdZ, center);
  vm.muzzleWorld(muzzle);

  const res = { hit: false, head: false, kill: false, dmg: 0, point: null };
  for (let i = 0; i < w.pellets; i++) {
    const dir = w.pellets > 1 ? coneDir(tmpDir, pelletQ, w.pelletSpread * DEG) : center;
    const h = world.raycast(eye, dir, w.range);
    if (h) endPt.copy(h.point); else endPt.copy(eye).addScaledVector(dir, w.range);
    if (w.pellets === 1 || i % 2 === 0) world.tracer(muzzle, endPt);
    if (!h) continue;
    const ud = h.object.userData;
    if (ud.bot) {
      const head = ud.part === 'head';
      const fall = h.distance <= w.falloffStart ? 1
        : lerp(1, w.minDmgMul, clamp((h.distance - w.falloffStart) / Math.max(1, w.range - w.falloffStart), 0, 1));
      const dmg = w.damage * (head ? w.headMul : 1) * fall;
      const r = ud.bot.damage(dmg, ud.part);
      res.hit = true;
      res.dmg += dmg;
      res.head ||= head;
      res.kill ||= r.killed;
      res.point ||= h.point.clone();
      world.impact(h.point, head ? 'head' : 'flesh');
    } else {
      world.impact(h.point, 'wall');
    }
  }

  // 손맛: 십자선 확장, 화면 흔들림, 반동(실제 조준이 올라감), FOV 펀치, 뷰모델 킥, 사운드, 진동
  S.bloom = Math.min(w.spreadMax, S.bloom + w.spreadPerShot * cfg.crosshairBloom);
  S.trauma = Math.min(1, S.trauma + w.shake * cfg.shakeIntensity);
  const kick = w.recoilPitch * cfg.recoilScale * DEG * lerp(1, 0.65, adsE);
  P.pitch += kick;
  P.recoilDebt += kick;
  P.yaw += (Math.random() * 2 - 1) * w.recoilYaw * cfg.recoilScale * DEG;
  S.fovPunch += w.fovPunch;
  vm.fire(w, cfg.muzzleFlash);
  sfx.shot(w);
  if (res.hit) {
    S.hits++;
    if (res.head) S.heads++;
    if (res.kill) S.kills++;
    fx.hit(res, w);
  } else {
    fx.vibrate(w.vib);
  }
}

// ── HUD ───────────────────────────────────
const hud = {
  cur: $('#ammo-cur'), max: $('#ammo-max'), name: $('#weapon-name'),
  bar: $('#reload-bar'), barFill: $('#reload-bar i'), stats: $('#stats'), ads: $('#btn-ads'),
};
let statT = 0, frames = 0, fps = 0;
function updateHud(dt, w, a) {
  const ammo = S.ammo[S.wKey];
  hud.cur.textContent = ammo;
  hud.cur.classList.toggle('low', ammo <= Math.ceil(w.mag * 0.25));
  hud.max.textContent = '/' + w.mag;
  hud.name.textContent = w.name;
  hud.bar.classList.toggle('on', S.reloadT > 0);
  hud.barFill.style.width = S.reloadT > 0 ? (1 - S.reloadT / w.reload) * 100 + '%' : '0';
  hud.ads.classList.toggle('on', S.ads);
  frames++;
  statT += dt;
  if (statT >= 0.5) {
    fps = Math.round(frames / statT);
    frames = 0;
    statT = 0;
    const acc = S.shots ? Math.round(S.hits / S.shots * 100) : 0;
    const hs = S.hits ? Math.round(S.heads / S.hits * 100) : 0;
    const asst = !cfg.assistEnabled ? '꺼짐' : a.target ? `감속 ×${a.friction.toFixed(2)}` : '대기';
    hud.stats.textContent = `FPS ${fps}   킬 ${S.kills}\n명중 ${acc}%   헤드 ${hs}%\n조준보정 ${asst}`;
  }
}

// ── 메인 루프 ─────────────────────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.time += dt;

  const inp = input.consume();
  if (inp.weapon) switchWeapon(inp.weapon);
  const w = WEAPONS[S.wKey];
  if (inp.reload) startReload();

  eye.set(P.pos.x, EYE, P.pos.z);
  const a = assist.update(eye, P.yaw, P.pitch, world, cfg);

  if (inp.adsToggle && S.reloadT <= 0) {
    S.ads = !S.ads;
    // 조준 시 스냅: ADS 진입 순간 보정 대상 쪽으로 붙음
    if (S.ads && a.target && cfg.adsSnap > 0) {
      P.yaw += a.yawErr * cfg.adsSnap * a.weight;
      P.pitch += a.pitchErr * cfg.adsSnap * a.weight;
    }
  }
  S.adsT = clamp(S.adsT + (S.ads ? 1 : -1) * dt / 0.16, 0, 1);
  const adsE = smooth(S.adsT);

  if (S.reloadT > 0) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) { S.reloadT = 0; S.ammo[S.wKey] = w.mag; sfx.reloadDone(); }
  }

  // 시점 회전: 스무딩 → 감도(ADS 배율) → 조준 보정 감속
  S.pendX += inp.lookX;
  S.pendY += inp.lookY;
  const k = cfg.lookSmoothing <= 0 ? 1 : 1 - Math.pow(cfg.lookSmoothing, dt * 60);
  const ax = S.pendX * k, ay = S.pendY * k;
  S.pendX -= ax;
  S.pendY -= ay;
  const zoomK = lerp(1, cfg.adsSensMul * w.adsSensK, adsE);
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
  const sp = cfg.moveSpeed * w.mobility * lerp(1, 0.6, adsE);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const tx = (-sy * inp.moveY + cy * inp.moveX) * sp;
  const tz = (-cy * inp.moveY - sy * inp.moveX) * sp;
  const acc = 1 - Math.exp(-(moving ? 14 : 10) * dt);
  P.vel.x += (tx - P.vel.x) * acc;
  P.vel.z += (tz - P.vel.z) * acc;
  P.pos.x += P.vel.x * dt;
  P.pos.z += P.vel.z * dt;
  world.collide(P.pos, PLAYER_R);
  const speedFrac = Math.hypot(P.vel.x, P.vel.z) / cfg.moveSpeed;
  P.bob += Math.hypot(P.vel.x, P.vel.z) * dt * 1.9;

  // 사격 (단발 무기는 0.15초 입력 버퍼로 약간 일찍 눌러도 발사)
  if (inp.firePressed) S.fireBuffer = 0.15;
  S.fireBuffer -= dt;
  let want = w.auto ? inp.fireHeld : S.fireBuffer > 0;
  if (cfg.autoFire && S.onTarget) want = true;
  S.cooldown -= dt;
  if (!want && S.cooldown < 0) S.cooldown = 0;
  if (want && S.cooldown <= 0 && S.reloadT <= 0) {
    if (S.ammo[S.wKey] > 0) { shoot(w, adsE, speedFrac); S.fireBuffer = 0; }
    else { if (inp.firePressed) sfx.dry(); startReload(); }
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
  camera.position.set(P.pos.x, EYE + Math.sin(P.bob * 2) * 0.03 * bobA, P.pos.z);
  camera.rotation.set(P.pitch + noise(nt, 1) * 2.2 * DEG * sh, P.yaw + noise(nt, 2) * 2.2 * DEG * sh, noise(nt, 3) * 3 * DEG * sh);
  const fov = lerp(BASE_FOV, w.adsFov, adsE) + S.fovPunch * cfg.fovPunch;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();

  // 십자선이 적 위에 있는지 (빨간 십자선 / 자동 사격)
  aimE.set(P.pitch, P.yaw, 0);
  tmpDir.set(0, 0, -1).applyEuler(aimE);
  const ch = world.raycast(eye.copy(camera.position), tmpDir, w.range);
  S.onTarget = !!(ch && ch.object.userData.bot);

  world.update(dt, camera);
  const scoped = !!w.scope && adsE > 0.85;
  vm.update(dt, { adsE, lookX: ax, lookY: ay, speedFrac, bob: P.bob, hide: scoped, reloadFrac: S.reloadT > 0 ? 1 - S.reloadT / w.reload : -1 });
  fx.update(dt, { spreadDeg: spreadDeg(w, adsE, speedFrac) + (w.pellets > 1 ? w.pelletSpread : 0), onTarget: S.onTarget, scoped, assist: a });
  updateHud(dt, w, a);

  renderer.render(scene, camera);
}

switchWeapon('AR');
requestAnimationFrame(frame);

// ── 시작 화면 ─────────────────────────────
addEventListener('pointerdown', () => sfx.unlock(), { once: true });
$('#start-btn').addEventListener('click', async () => {
  sfx.unlock();
  $('#start').classList.add('hidden');
  if (matchMedia('(pointer: coarse)').matches) {
    try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* 미지원 */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* 미지원 */ }
  }
});

// 디버그용
window.__game = { P, S, world, cfg };
