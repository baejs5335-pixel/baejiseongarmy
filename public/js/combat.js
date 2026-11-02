// 매치 전투: AI 병사, 플레이어 유닛(피격 판정·체력), 근접 공격, 매치 진행(점수·시간·리스폰·무적)
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { CHARACTERS, CHAR_ORDER, buildCharacter, dims } from './characters.js';

const DEG = Math.PI / 180;
const BASE_SPEED = 5.2;
export const TEAM_COLOR = { A: 0x4aa8ff, B: 0xff5a4a };
export const TEAM_NAME = { A: '블루팀', B: '레드팀' };

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

export function coneDir(out, yaw, pitch, coneRad) {
  const r = coneRad * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
  out.set(Math.tan(r) * Math.cos(th), Math.tan(r) * Math.sin(th), -1).normalize();
  tmpQ.setFromEuler(tmpE.set(pitch, yaw, 0));
  return out.applyQuaternion(tmpQ);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 근접 공격: 사거리·각도 안의 가장 가까운 적 1명. 상대가 등을 보이고 있으면 backMul배
export function meleeStrike(attacker, candidates, world, att) {
  let best = null, bestD = 1e9;
  for (const c of candidates) {
    if (c.dead || c.team === att.team || c === attacker) continue;
    const dx = c.pos.x - att.pos.x, dz = c.pos.z - att.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > att.range + 0.35) continue;
    const a = Math.abs(wrap(Math.atan2(-dx, -dz) - att.yaw)) / DEG;
    if (a > att.angle && d > 0.9) continue;
    tmpA.set(att.pos.x, att.eyeY, att.pos.z);
    tmpB.set(c.pos.x, c.chestY, c.pos.z);
    if (world.blocked(tmpA, tmpB)) continue;
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return null;
  let back = false;
  if (best.yaw !== undefined) {
    const dx = att.pos.x - best.pos.x, dz = att.pos.z - best.pos.z, l = Math.hypot(dx, dz) || 1;
    back = (-Math.sin(best.yaw) * dx - Math.cos(best.yaw) * dz) / l < -0.4;
  }
  const dmg = att.dmg * (back ? att.backMul : 1);
  const r = best.damage(dmg, 'body', attacker);
  return { victim: best, back, dmg, point: new THREE.Vector3(best.pos.x, best.chestY, best.pos.z), ...r };
}

function hitMeshes(char, owner) {
  const d = dims(char);
  const mat = new THREE.MeshBasicMaterial({ color: 0x39ff6a, wireframe: true, transparent: true, opacity: 0.6, depthTest: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(d.hitBodyR, d.bodyLen, 2, 8), mat);
  body.position.y = d.bodyTop / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(d.hitHeadR, 10, 8), mat);
  head.position.y = d.headY;
  body.userData = { bot: owner, part: 'body' };
  head.userData = { bot: owner, part: 'head' };
  body.visible = head.visible = false;
  return { body, head, d };
}

// ── 플레이어 유닛: 보이지 않는 피격 판정 + 체력 ─────────────────
export class PlayerUnit {
  constructor(world, P) {
    this.world = world;
    this.P = P;
    this.isPlayer = true;
    this.team = 'A';
    this.name = '나';
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.kills = 0; this.deaths = 0;
    this.dead = false; this.invulnT = 0; this.respawnT = 0;
    this.chestY = 1.1; this.headY = 1.6;
  }

  get pos() { return this.P.pos; }
  get yaw() { return this.P.yaw; }

  setChar(char) {
    const hits = this.world.hittables;
    if (this.hit) {
      this.group.remove(this.hit.body, this.hit.head);
      for (const m of [this.hit.body, this.hit.head]) hits.splice(hits.indexOf(m), 1);
    }
    this.char = char;
    this.maxHp = char.hp;
    this.hp = Math.min(this.hp ?? char.hp, char.hp);
    this.hit = hitMeshes(char, this);
    this.group.add(this.hit.body, this.hit.head);
    hits.push(this.hit.body, this.hit.head);
  }

  // 앉으면 판정도 낮아짐
  sync(eyeH) {
    this.group.position.copy(this.P.pos);
    const k = eyeH / this.hit.d.eye;
    this.group.scale.y = k;
    this.chestY = this.hit.d.chestY * k;
    this.headY = eyeH;
  }

  damage(d, part, attacker) {
    if (this.dead || this.invulnT > 0) return { applied: false };
    this.hp -= d;
    this.onHurt?.(d, attacker);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deaths++;
      this.killer = attacker;
      this.deathT = 0;
      return { applied: true, killed: true };
    }
    return { applied: true, killed: false };
  }

  spawn(sp, invuln) {
    this.hp = this.maxHp;
    this.dead = false;
    this.invulnT = invuln;
    this.onSpawn?.(sp);
  }
}

// ── AI 병사 ───────────────────────────────────
export class Soldier {
  constructor(game, team, char, weaponKey, name) {
    this.game = game;
    this.world = game.world;
    this.team = team;
    this.char = char;
    this.name = name;
    this.wKey = weaponKey;
    this.kills = 0; this.deaths = 0;
    this.dead = true; this.respawnT = 0.5 + Math.random();
    this.invulnT = 0; this.flashT = 0;
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.bloom = 0;

    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.group.visible = false;
    this.world.scene.add(this.group);
    this.model = buildCharacter(char);
    this.model.hitBody.userData = { bot: this, part: 'body' };
    this.model.hitHead.userData = { bot: this, part: 'head' };
    this.group.add(this.model.group);
    this.world.hittables.push(this.model.hitBody, this.model.hitHead);
    this.d = this.model.d;
    this.maxHp = char.hp;
    this.hp = char.hp;
    this.chestY = this.d.chestY;
    this.headY = this.d.headY;

    // 리스폰 무적 보호막
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(this.d.total * 0.62, 16, 12),
      new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team], transparent: true, opacity: 0.22, depthWrite: false }));
    this.shield.position.y = this.d.total / 2;
    this.shield.raycast = () => {};
    this.group.add(this.shield);
    // 아군 표시 (머리 위 파란 삼각형)
    if (team === 'A') {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3).rotateX(Math.PI),
        new THREE.MeshBasicMaterial({ color: TEAM_COLOR.A, depthTest: false }));
      tri.position.y = this.d.total + 0.35;
      tri.renderOrder = 5;
      tri.raycast = () => {};
      this.group.add(tri);
    }
  }

  get pos() { return this.group.position; }
  get w() { return WEAPONS[this.wKey]; }

  aimPoint(eye, fwd, out) {
    const p = this.pos;
    const hd = Math.hypot(p.x - eye.x, p.z - eye.z);
    const y = eye.y + fwd.y * (hd / Math.max(1e-3, Math.hypot(fwd.x, fwd.z)));
    return out.set(p.x, Math.min(this.d.headY + 0.06, Math.max(this.d.bodyTop * 0.35, y)), p.z);
  }

  spawn(sp, invuln) {
    this.pos.set(sp.x + (Math.random() - 0.5) * 2, 0, sp.z + (Math.random() - 0.5) * 2);
    this.yaw = sp.yaw;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.dead = false;
    this.invulnT = invuln;
    this.group.visible = true;
    this.group.rotation.x = 0;
    this.ammo = this.w.mag;
    this.reloadT = 0; this.cooldown = 0.5; this.pauseT = 0; this.burstLeft = 0;
    this.target = null; this.lastSeen = null; this.path = null; this.roam = null;
    this.thinkT = 0; this.strafeT = 0; this.stuckT = 0; this.alertT = -9;
  }

  damage(d, part, attacker) {
    if (this.dead || this.invulnT > 0) return { applied: false };
    this.hp -= d;
    this.flashT = 0.08;
    // 맞으면 공격자 쪽을 돌아봄
    if (attacker && !attacker.dead) { this.alertBy = attacker; this.alertT = this.game.now; }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deaths++;
      this.deathT = 0;
      return { applied: true, killed: true };
    }
    return { applied: true, killed: false };
  }

  eye(out) { return out.set(this.pos.x, this.d.eye, this.pos.z); }

  canSee(c) {
    this.eye(tmpA);
    tmpB.set(c.pos.x, c.chestY, c.pos.z);
    if (!this.world.blocked(tmpA, tmpB)) return true;
    tmpB.y = c.headY;
    return !this.world.blocked(tmpA, tmpB);
  }

  perceive() {
    const g = this.game, now = g.now, melee = this.w.melee;
    let best = null, bd = 1e9;
    for (const c of g.combatants) {
      if (c.team === this.team || c.dead) continue;
      const dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > (melee ? 35 : 90)) continue;
      const ang = Math.abs(wrap(Math.atan2(-dx, -dz) - this.yaw)) / DEG;
      const alerted = this.alertBy === c && now - this.alertT < 2.5;
      if (ang > 75 && d > 5 && !alerted) continue;
      if (!this.canSee(c)) continue;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      if (best !== this.target) {
        const diff = g.rules.diff;
        this.target = best;
        this.reactT = diff.reaction * (0.8 + Math.random() * 0.4);
        this.errMag = diff.aimErr * DEG * (0.7 + Math.random() * 0.6) * (1 + bd / 50);
        this.errDir = Math.random() * Math.PI * 2;
        this.aimHead = Math.random() < diff.headChance;
      }
      this.lastSeen = best.pos.clone();
      this.lastSeenT = now;
    } else {
      this.target = null;
    }
  }

  nearestEnemy() {
    let best = null, bd = 1e9;
    for (const c of this.game.combatants) {
      if (c.team === this.team || c.dead) continue;
      const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // 경로를 따라 다음 지점 방향 (도착하면 null)
  steer(goal, dt) {
    const nav = this.game.nav;
    if (!this.path || this.repathT <= 0 || Math.hypot(goal.x - this.goal.x, goal.z - this.goal.z) > 2.5) {
      this.path = nav.find(this.pos, goal);
      this.pi = 0;
      this.goal = { x: goal.x, z: goal.z };
      this.repathT = 1 + Math.random();
      if (!this.path) return null;
    }
    this.repathT -= dt;
    while (this.pi < this.path.length && Math.hypot(this.path[this.pi].x - this.pos.x, this.path[this.pi].z - this.pos.z) < 0.7) this.pi++;
    if (this.pi >= this.path.length) { this.path = null; return null; }
    const p = this.path[this.pi];
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }

  pickRoam() {
    // 60%는 적 진영 쪽, 나머지는 맵 중앙 어디든 → 자연스럽게 교전이 일어나도록
    const enemySide = this.team === 'A' ? -1 : 1;
    const toEnemy = Math.random() < 0.6;
    this.roam = this.game.nav.randomOpen((p) => Math.abs(p.z) < 36 && (!toEnemy || p.z * enemySide > 0));
  }

  update(dt) {
    const g = this.game, now = g.now;
    if (this.dead) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.35);
      this.group.rotation.x = -k * k * Math.PI * 0.47;
      this.shield.visible = false;
      if (this.deathT > 2.2) this.group.visible = false;
      return;
    }
    const w = this.w, diff = g.rules.diff;
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.shield.visible = this.invulnT > 0;
    this.model.hitBody.visible = this.model.hitHead.visible = !!this.world.hitboxVisible;
    const flash = this.flashT > 0 ? 0.85 : 0;
    this.flashT -= dt;
    for (const m of this.model.flashMats) m.emissive.setScalar(flash);

    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.12 + Math.random() * 0.06; this.perceive(); }
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.ammo = w.mag; }
    this.cooldown -= dt; this.reactT -= dt; this.pauseT -= dt;
    this.bloom *= Math.exp(-dt * 5);

    // ── 이동 목표
    let T = this.target;
    let dir = null, speedK = 1;
    if (w.melee) {
      // 칼: 가장 가까운 적에게 돌진 (근접전은 위치를 아는 것으로 처리)
      const e = this.nearestEnemy();
      if (e) {
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (d < 8 && this.canSee(e)) { T = this.target = e; this.reactT = Math.min(this.reactT, 0.1); }
        if (d > 1.3) dir = this.steer(e.pos, dt);
      }
    } else if (T) {
      const dx = T.pos.x - this.pos.x, dz = T.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      const ideal = { SR: 60, AR: 30, HG: 18, SMG: 14, SG: 7 }[this.wKey] ?? 25;
      if (d > ideal + 12) dir = this.steer(T.pos, dt);
      else if (this.wKey !== 'SR') {
        // 교전 중 좌우 무빙
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeDir = [-1, 0, 1][(Math.random() * 3) | 0]; this.strafeT = 0.4 + Math.random() * 0.8; }
        if (this.strafeDir) dir = { x: -dz / d * this.strafeDir, z: dx / d * this.strafeDir };
        speedK = 0.55;
      }
    } else if (this.lastSeen && now - this.lastSeenT < 5) {
      dir = this.steer(this.lastSeen, dt);
      if (!dir) this.lastSeen = null;
    } else {
      if (!this.roam) this.pickRoam();
      dir = this.steer(this.roam, dt);
      if (!dir) this.roam = null;
    }

    const sp = BASE_SPEED * this.char.speed * w.mobility * g.rules.speedMul * speedK;
    const tx = dir ? dir.x * sp : 0, tz = dir ? dir.z * sp : 0;
    const acc = 1 - Math.exp(-10 * dt);
    this.vel.x += (tx - this.vel.x) * acc;
    this.vel.z += (tz - this.vel.z) * acc;
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.world.collide(this.pos, 0.35);
    for (const c of g.combatants) {
      if (c === this || c.dead) continue;
      const dx = this.pos.x - c.pos.x, dz = this.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 0.7) { this.pos.x += dx / d * (0.7 - d) * 0.5; this.pos.z += dz / d * (0.7 - d) * 0.5; }
    }
    // 끼임 감지 → 새 목적지
    if (dir && Math.hypot(this.pos.x - px, this.pos.z - pz) < sp * dt * 0.2) {
      this.stuckT += dt;
      if (this.stuckT > 0.8) { this.stuckT = 0; this.path = null; this.roam = null; this.pickRoam(); }
    } else this.stuckT = 0;

    // ── 조준: 목표 방향 + 오차(시간이 지나며 줄어듦), 회전 속도 제한
    let dYaw, dPitch;
    if (T) {
      const ty = this.aimHead ? T.headY : T.chestY;
      const dx = T.pos.x - this.pos.x, dz = T.pos.z - this.pos.z, hd = Math.hypot(dx, dz);
      this.errMag = Math.max(diff.aimErr * DEG * 0.25, this.errMag * Math.exp(-dt * diff.learn));
      this.errDir += dt * 2.3;
      dYaw = Math.atan2(-dx, -dz) + Math.cos(this.errDir) * this.errMag;
      dPitch = Math.atan2(ty - this.d.eye, hd) + Math.sin(this.errDir) * this.errMag * 0.6;
    } else if (this.alertBy && now - this.alertT < 1.5 && !this.alertBy.dead) {
      dYaw = Math.atan2(-(this.alertBy.pos.x - this.pos.x), -(this.alertBy.pos.z - this.pos.z));
      dPitch = 0;
    } else if (Math.hypot(this.vel.x, this.vel.z) > 0.5) {
      dYaw = Math.atan2(-this.vel.x, -this.vel.z);
      dPitch = 0;
    }
    if (dYaw !== undefined) {
      const maxT = diff.turn * dt;
      this.yaw += Math.max(-maxT, Math.min(maxT, wrap(dYaw - this.yaw)));
      this.pitch += Math.max(-maxT, Math.min(maxT, dPitch - this.pitch));
    }
    this.group.rotation.y = this.yaw + Math.PI;

    // ── 공격
    if (T && this.reactT <= 0 && !T.dead) {
      const err = Math.abs(wrap(dYaw - this.yaw));
      if (w.melee) {
        const d = Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
        if (d < 2.0 && this.cooldown <= 0 && err < 30 * DEG) {
          const stab = Math.random() < 0.35, m = stab ? w.stab : w.slash;
          this.cooldown = stab ? m.cooldown : 60 / w.rpm;
          g.sfx.swing(stab);
          const r = meleeStrike(this, g.combatants, this.world, {
            pos: this.pos, yaw: this.yaw, eyeY: this.d.eye, team: this.team,
            range: m.range, angle: m.angle, dmg: m.dmg * g.rules.dmgMul, backMul: w.backMul,
          });
          if (r?.killed) g.onKill(this, r.victim, w, false, r.back);
        }
      } else if (this.reloadT <= 0) {
        if (this.ammo <= 0) {
          this.reloadT = w.reloadEmpty;
        } else if (err < 4 * DEG && this.cooldown <= 0 && this.pauseT <= 0) {
          this.fire(w);
        }
      }
    } else if (!w.melee && !T && this.reloadT <= 0 && this.ammo < w.mag * 0.4) {
      this.reloadT = w.reloadTac;
    }
  }

  fire(w) {
    const g = this.game;
    const still = Math.hypot(this.vel.x, this.vel.z) < 0.8;
    const spread = (still ? w.ads.base + 0.25 : w.hip.base * 0.7) + this.bloom;
    this.eye(tmpA);
    const off = new THREE.Vector3(-Math.cos(this.yaw) * -0.25, -0.25, Math.sin(this.yaw) * -0.25);
    const shot = { w, team: this.team, owner: this };
    const center = coneDir(new THREE.Vector3(), this.yaw, this.pitch, spread * DEG);
    for (let i = 0; i < w.pellets; i++) {
      const dir = w.pellets > 1 ? coneDir(new THREE.Vector3(), Math.atan2(-center.x, -center.z), Math.asin(center.y), w.pelletSpread * DEG) : center;
      this.world.fire(tmpA, dir, w.velocity, shot, w.pellets === 1 || i % 3 === 0, off);
    }
    this.ammo--;
    this.cooldown = 60 / w.rpm;
    this.bloom = Math.min(still ? w.ads.max : w.hip.max, this.bloom + (still ? w.ads.perShot : w.hip.perShot));
    this.pitch += w.recoil.pattern[0][0] * 0.4 * DEG;
    // 연사 무기는 짧게 끊어 쏨
    if (--this.burstLeft <= 0) {
      const auto = w.modes.includes('auto');
      this.burstLeft = auto ? 4 + ((Math.random() * 6) | 0) : 1;
      this.pauseT = auto ? 0.2 + Math.random() * 0.35 : 0.1 + Math.random() * 0.3;
    }
    const d = Math.hypot(this.pos.x - g.player.pos.x, this.pos.z - g.player.pos.z);
    g.sfx.shot(w, Math.max(0, 1 - d / 90) * 0.75);
  }
}

// ── 매치 진행 ─────────────────────────────────
export class Match {
  constructor({ world, nav, map, rules, sfx, player, onKill, onEnd }) {
    Object.assign(this, { world, nav, map, rules, sfx, player });
    this.onKillCb = onKill;
    this.onEnd = onEnd;
    this.now = 0;
    this.score = { A: 0, B: 0 };
    this.time = rules.time;
    this.state = 'idle';
    this.combatants = [player];
    const names = { A: ['알파', '브라보', '찰리'], B: ['델타', '에코', '폭스', '골프'] };
    const pick = () => CHARACTERS[CHAR_ORDER[(Math.random() * CHAR_ORDER.length) | 0]];
    for (const team of ['A', 'B']) {
      for (const n of names[team]) {
        const ch = pick();
        const wk = !rules.weapons ? ch.weapon : rules.weapons.includes(ch.weapon) ? ch.weapon : rules.weapons[0];
        this.combatants.push(new Soldier(this, team, ch, wk, `${n}(${ch.name})`));
      }
    }
  }

  enemiesOf(team) { return this.combatants.filter((c) => c.team !== team); }

  start() {
    this.state = 'play';
    this.time = this.rules.time;
    this.score = { A: 0, B: 0 };
    for (const c of this.combatants) {
      c.kills = 0; c.deaths = 0;
      this.respawn(c);
    }
  }

  // 살아 있는 적에게서 가장 먼 스폰 지점
  spawnPoint(team) {
    const foes = this.combatants.filter((c) => c.team !== team && !c.dead);
    let best = null, bd = -1;
    for (const sp of this.map.spawns[team]) {
      const d = foes.length ? Math.min(...foes.map((f) => Math.hypot(f.pos.x - sp.x, f.pos.z - sp.z))) : Math.random();
      if (d > bd) { bd = d; best = sp; }
    }
    return best;
  }

  respawn(c) {
    c.spawn(this.spawnPoint(c.team), this.rules.invuln);
  }

  onKill(killer, victim, w, head, back) {
    victim.respawnT = this.rules.respawn;
    if (killer && killer.team !== victim.team) {
      killer.kills++;
      this.score[killer.team]++;
    }
    this.onKillCb?.(killer, victim, w, head, back);
    if (this.score[killer?.team] >= this.rules.scoreLimit) this.end();
  }

  update(dt) {
    if (this.state !== 'play') return;
    this.now += dt;
    this.time -= dt;
    for (const c of this.combatants) {
      if (c.dead) {
        c.respawnT -= dt;
        if (c.respawnT <= 0) this.respawn(c);
      }
      if (!c.isPlayer) c.update(dt);
      else c.invulnT = Math.max(0, c.invulnT - dt);
    }
    if (this.time <= 0) { this.time = 0; this.end(); }
  }

  end() {
    if (this.state === 'end') return;
    this.state = 'end';
    const { A, B } = this.score;
    this.onEnd?.(A > B ? 'A' : B > A ? 'B' : null);
  }
}
