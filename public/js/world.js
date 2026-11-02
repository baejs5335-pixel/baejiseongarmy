// 맵 생성, 표적 봇, 탄도(탄속·낙차) 시뮬레이션, 피격 이펙트
import * as THREE from 'three';
import { toon, addOutline, radialTexture } from './toon.js';
import { COLORS } from './maps.js';
import { GRAVITY } from './weapons.js';
import { CHARACTERS, CHAR_ORDER, buildCharacter } from './characters.js';

const MAX_BULLET_DIST = 220;

class Bot {
  constructor(world, spawn, char) {
    this.world = world;
    this.spawn = spawn;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.pause = 0;
    this.flashT = 0;
    this.barT = 0;

    this.team = 'B';
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    world.scene.add(this.group);
    this.setCharacter(char);

    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.09), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false }));
    this.barFg = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.055), new THREE.MeshBasicMaterial({ color: 0x5ee05e }));
    this.barFg.position.z = 0.002;
    this.bar.add(bg, this.barFg);
    world.scene.add(this.bar);

    this.reset(true);
  }

  // 캐릭터 모델 교체 (밸런스 패널에서 체형을 바꾸면 다시 만듦)
  setCharacter(char) {
    const hits = this.world.hittables;
    if (this.model) {
      this.group.remove(this.model.group);
      for (const m of [this.model.hitBody, this.model.hitHead]) hits.splice(hits.indexOf(m), 1);
    }
    this.char = char;
    this.model = buildCharacter(char);
    this.model.hitBody.userData = { bot: this, part: 'body' };
    this.model.hitHead.userData = { bot: this, part: 'head' };
    this.group.add(this.model.group);
    hits.push(this.model.hitBody, this.model.hitHead);
    this.setHitboxVisible(this.world.hitboxVisible);
    this.maxHp = char.hp;
    if (!this.dead) this.hp = Math.min(this.hp ?? char.hp, char.hp);
  }

  setHitboxVisible(v) {
    this.model.hitBody.visible = this.model.hitHead.visible = !!v;
  }

  get pos() { return this.group.position; }
  get chestY() { return this.model.d.chestY; }
  get headY() { return this.model.d.headY; }

  reset(first) {
    this.hp = this.maxHp;
    this.dead = false;
    this.deathT = 0;
    this.group.rotation.x = 0;
    const s = this.spawn;
    this.group.position.set(s.x + (first ? 0 : (Math.random() * 2 - 1) * s.lane), 0, s.z);
  }

  // 십자선 광선과 가장 가까운 몸 위의 점(조준 보정용 / 머리를 노릴 때 아래로 끌어내리지 않게)
  aimPoint(eye, fwd, out) {
    const p = this.group.position;
    const hd = Math.hypot(p.x - eye.x, p.z - eye.z);
    const fh = Math.max(1e-3, Math.hypot(fwd.x, fwd.z));
    const y = eye.y + fwd.y * (hd / fh);
    const d = this.model.d;
    return out.set(p.x, Math.min(d.headY + 0.06, Math.max(d.bodyTop * 0.35, y)), p.z);
  }

  damage(d, part) {
    if (this.dead) return { applied: false, killed: false };
    this.hp -= d;
    this.flashT = part === 'head' ? 0.1 : 0.07;
    this.barT = 2.5;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathT = 0;
      return { applied: true, killed: true };
    }
    return { applied: true, killed: false };
  }

  update(dt, cam) {
    const p = this.group.position;
    const s = this.spawn;
    if (this.dead) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.35);
      this.group.rotation.x = -k * k * Math.PI * 0.47;
      p.y = -Math.max(0, this.deathT - 1.3) * 1.2;
      this.bar.visible = false;
      if (this.deathT > 2.4) this.reset(false);
    } else {
      if (s.lane > 0) {
        if (this.pause > 0) this.pause -= dt;
        else {
          p.x += this.dir * s.speed * dt;
          if (p.x > s.x + s.lane) { p.x = s.x + s.lane; this.dir = -1; this.pause = Math.random() * 0.6; }
          else if (p.x < s.x - s.lane) { p.x = s.x - s.lane; this.dir = 1; this.pause = Math.random() * 0.6; }
          else if (Math.random() < dt * 0.35) this.dir *= -1;
        }
      }
      this.group.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z);
      this.barT -= dt;
      this.bar.visible = this.barT > 0;
      if (this.bar.visible) {
        const f = this.hp / this.maxHp;
        this.bar.position.set(p.x, this.model.d.total + 0.35, p.z);
        this.bar.quaternion.copy(cam.quaternion);
        this.barFg.scale.x = Math.max(0.001, f);
        this.barFg.position.x = -0.33 * (1 - f);
        this.barFg.material.color.setHex(f > 0.5 ? 0x5ee05e : f > 0.25 ? 0xffc23d : 0xff4a3d);
      }
    }
    const flash = this.flashT > 0 ? 0.85 : 0;
    this.flashT -= dt;
    for (const m of this.model.flashMats) m.emissive.setScalar(flash);
  }
}

export class World {
  constructor(scene, map, { targets = true } = {}) {
    this.scene = scene;
    this.map = map;
    this.solids = [];
    this.boxes = [];
    this.hittables = [];
    this.bots = [];
    this.bullets = [];
    this.ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._seg = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._head = new THREE.Vector3();

    scene.background = new THREE.Color(0x9ad7ff);
    scene.fog = new THREE.Fog(0x9ad7ff, 70, 170);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a70, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(8, 15, 6);
    scene.add(sun);

    this.buildFloor();
    for (const b of map.boxes) this.addBox(b);
    // 표적들은 캐릭터를 돌아가며 사용 → 체형/판정 차이를 직접 쏴 보며 비교
    if (targets) map.bots.forEach((s, i) => this.bots.push(new Bot(this, s, CHARACTERS[CHAR_ORDER[i % CHAR_ORDER.length]])));
    this.buildFxPools();
  }

  buildFloor() {
    const { minX, maxX, minZ, maxZ } = this.map.bounds;
    const w = maxX - minX + 2, d = maxZ - minZ + 2;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(60,50,30,.18)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    const tiled = (sw, sd) => { const t = tex.clone(); t.repeat.set(sw / 2, sd / 2); t.needsUpdate = true; return t; };

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(0xead9a8, { map: tiled(w, d) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.scene.add(floor);
    this.solids.push(floor);
    this.hittables.push(floor);

    // 구역별 바닥색 (어느 구역에 있는지 바로 알 수 있게)
    for (const z of this.map.zones) {
      if (!z.floor) continue;
      const zw = z.x1 - z.x0, zd = z.z1 - z.z0;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(zw, zd), toon(z.floor, { map: tiled(zw, zd), polygonOffset: true, polygonOffsetFactor: -1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((z.x0 + z.x1) / 2, 0.005, (z.z0 + z.z1) / 2);
      m.raycast = () => {};
      this.scene.add(m);
    }
  }

  addBox({ x, z, w, d, h, type }) {
    const color = type === 'high' && (Math.round(x + z) % 2) ? 0xc96f3b : COLORS[type];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
    m.position.set(x, h / 2, z);
    addOutline(m, 0.03);
    this.scene.add(m);
    this.solids.push(m);
    this.hittables.push(m);
    this.boxes.push(new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
    return m;
  }

  buildFxPools() {
    const tg = new THREE.BoxGeometry(0.02, 0.02, 1);
    tg.translate(0, 0, 0.5);
    this.streaks = [];
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, depthWrite: false }));
      m.visible = false;
      m.raycast = () => {};
      this.scene.add(m);
      this.streaks.push({ m, busy: false, fade: 0 });
    }
    const puff = radialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]);
    this.impacts = [];
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false }));
      s.visible = false;
      this.scene.add(s);
      this.impacts.push({ s, life: 0, max: 0.25, size: 0.4 });
    }
    this.ii = 0;
  }

  takeStreak() {
    const s = this.streaks.find((x) => !x.busy && x.fade <= 0) || this.streaks.find((x) => !x.busy);
    if (!s) return null;
    s.busy = true;
    s.fade = 0;
    s.m.material.opacity = 0.95;
    return s;
  }

  // 탄환 발사. 시뮬레이션은 눈 위치에서, 궤적 이펙트는 총구에서 시작해 실제 탄도로 합쳐집니다.
  fire(origin, dir, speed, shot, tracer, muzzleOffset) {
    this.bullets.push({
      pos: origin.clone(), vel: dir.clone().multiplyScalar(speed), dist: 0, shot,
      off: muzzleOffset.clone(), streak: tracer ? this.takeStreak() : null,
    });
  }

  drawStreak(b, head, dir) {
    const s = b.streak;
    if (!s) return;
    const fade = Math.max(0, 1 - b.dist / 8);
    this._head.copy(head).addScaledVector(b.off, fade);
    s.m.position.copy(this._head);
    s.m.scale.set(1, 1, Math.max(0.05, Math.min(3, b.dist + 0.5)));
    s.m.lookAt(this._v.copy(this._head).sub(dir));
    s.m.visible = true;
  }

  endBullet(i) {
    const b = this.bullets[i];
    if (b.streak) { b.streak.busy = false; b.streak.fade = 0.05; }
    this.bullets.splice(i, 1);
  }

  updateBullets(dt, onHit) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const seg = this._seg.copy(b.vel).multiplyScalar(dt);
      const len = seg.length();
      const dir = this._dir.copy(seg).divideScalar(len);
      const h = this.raycast(b.pos, dir, len, b.shot.team);
      if (h) {
        b.dist += h.distance;
        this.drawStreak(b, h.point, dir);
        onHit(b, h, b.dist);
        this.endBullet(i);
        continue;
      }
      b.pos.add(seg);
      b.dist += len;
      b.vel.y -= GRAVITY * dt;
      this.drawStreak(b, b.pos, dir);
      if (b.dist > MAX_BULLET_DIST || b.pos.y < -2) this.endBullet(i);
    }
  }

  impact(point, kind) {
    const it = this.impacts[this.ii++ % this.impacts.length];
    it.s.position.copy(point);
    it.s.material.color.setHex({ flesh: 0xff5a3a, head: 0xffd23f, shield: 0x6ac8ff }[kind] ?? 0xd9c9a0);
    it.size = kind === 'wall' ? 0.35 : 0.55;
    it.max = it.life = 0.22;
    it.s.visible = true;
  }

  // ignoreTeam: 같은 팀 판정은 통과 (아군 사격 없음 / 자기 자신 판정 무시)
  raycast(origin, dir, far, ignoreTeam) {
    this.ray.set(origin, dir);
    this.ray.far = far;
    for (const h of this.ray.intersectObjects(this.hittables, false)) {
      const bot = h.object.userData.bot;
      if (bot && (bot.dead || (ignoreTeam && bot.team === ignoreTeam))) continue;
      return h;
    }
    return null;
  }

  blocked(from, to) {
    const d = this._v.subVectors(to, from);
    const dist = d.length();
    this.ray.set(from, d.normalize());
    this.ray.far = dist - 0.05;
    return this.ray.intersectObjects(this.solids, false).length > 0;
  }

  setHitboxVisible(v) {
    this.hitboxVisible = v;
    for (const b of this.bots) b.setHitboxVisible(v);
  }

  // 밸런스 패널에서 체형/체력이 바뀌면 표적 모델을 다시 만듦
  rebuildBots() {
    for (const b of this.bots) b.setCharacter(b.char);
  }

  insideBox(x, z, pad) {
    return this.boxes.some((b) => x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad);
  }

  // 발 높이에서 설 수 있는 바닥 높이 (낮은 엄폐물 위에 올라섰을 때)
  groundAt(x, z, feetY, r = 0.2) {
    let g = 0;
    for (const b of this.boxes) {
      if (b.max.y > feetY + 0.05 || b.max.y <= g) continue;
      if (x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r) g = b.max.y;
    }
    return g;
  }

  // 원(플레이어) vs AABB 밀어내기. 발이 상자 위에 있으면 그 상자는 통과
  collide(pos, r, feetY = 0) {
    for (const b of this.boxes) {
      if (b.max.y <= feetY + 0.05) continue;
      const cx = Math.min(Math.max(pos.x, b.min.x), b.max.x);
      const cz = Math.min(Math.max(pos.z, b.min.z), b.max.z);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + dx / d * r;
        pos.z = cz + dz / d * r;
      } else {
        const l = pos.x - b.min.x, rr = b.max.x - pos.x, f = pos.z - b.min.z, bk = b.max.z - pos.z;
        const m = Math.min(l, rr, f, bk);
        if (m === l) pos.x = b.min.x - r;
        else if (m === rr) pos.x = b.max.x + r;
        else if (m === f) pos.z = b.min.z - r;
        else pos.z = b.max.z + r;
      }
    }
  }

  update(dt, cam, onHit) {
    for (const b of this.bots) b.update(dt, cam);
    this.updateBullets(dt, onHit);
    for (const s of this.streaks) {
      if (s.busy || s.fade <= 0) continue;
      s.fade -= dt;
      s.m.material.opacity = Math.max(0, s.fade / 0.05) * 0.95;
      if (s.fade <= 0) s.m.visible = false;
    }
    for (const it of this.impacts) {
      if (!it.s.visible) continue;
      it.life -= dt;
      const k = 1 - it.life / it.max;
      it.s.scale.setScalar(it.size * (0.35 + k));
      it.s.material.opacity = Math.max(0, 1 - k);
      if (it.life <= 0) it.s.visible = false;
    }
  }
}
