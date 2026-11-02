// 테스트 맵, 표적 봇, 탄 궤적/피격 이펙트
import * as THREE from 'three';
import { toon, addOutline, radialTexture } from './toon.js';

const BOT_SPAWNS = [
  { x: -1, z: -6, lane: 2.5, speed: 2.2 },               // 낮은 벽 뒤 좌우 이동 (헤드 연습)
  { x: 6, z: -9, lane: 0, speed: 0 },                    // 정지 표적
  { x: -6, z: -14, lane: 3, speed: 3.2 },                // 빠른 좌우 이동 (트래킹)
  { x: 9, z: -20, lane: 2, speed: 2.5, color: 0x4a7fe0 },// 원거리 (저격)
  { x: -10, z: -2, lane: 0, speed: 0, color: 0xe08a3a }, // 근거리 (샷건)
];

class Bot {
  constructor(world, spawn) {
    this.world = world;
    this.spawn = spawn;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.pause = 0;
    this.flashT = 0;
    this.barT = 0;

    const g = this.group = new THREE.Group();
    g.rotation.order = 'YXZ';
    this.bodyMat = toon(spawn.color || 0xe4574b);
    this.headMat = toon(0xffd2a6);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 4, 12), this.bodyMat);
    body.position.y = 0.7;
    addOutline(body, 0.03);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), this.headMat);
    head.position.y = 1.62;
    addOutline(head, 0.025);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x4f7f3f));
    helm.position.y = 1.66;
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const sx of [-0.08, 0.08]) {
      const e = new THREE.Mesh(eyeGeo, eyeMat);
      e.position.set(sx, 1.64, 0.215);
      e.raycast = () => {};
      g.add(e);
    }
    body.userData = { bot: this, part: 'body' };
    head.userData = { bot: this, part: 'head' };
    helm.userData = { bot: this, part: 'head' };
    g.add(body, head, helm);
    world.scene.add(g);
    world.hittables.push(body, head, helm);

    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.09), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false }));
    this.barFg = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.055), new THREE.MeshBasicMaterial({ color: 0x5ee05e }));
    this.barFg.position.z = 0.002;
    this.bar.add(bg, this.barFg);
    world.scene.add(this.bar);

    this.reset(true);
  }

  reset(first) {
    this.hp = 100;
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
    return out.set(p.x, Math.min(1.68, Math.max(0.5, y)), p.z);
  }

  damage(d, part) {
    if (this.dead) return { killed: false };
    this.hp -= d;
    this.flashT = part === 'head' ? 0.1 : 0.07;
    this.barT = 2.5;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathT = 0;
      return { killed: true };
    }
    return { killed: false };
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
        const f = this.hp / 100;
        this.bar.position.set(p.x, 2.12, p.z);
        this.bar.quaternion.copy(cam.quaternion);
        this.barFg.scale.x = Math.max(0.001, f);
        this.barFg.position.x = -0.33 * (1 - f);
        this.barFg.material.color.setHex(f > 0.5 ? 0x5ee05e : f > 0.25 ? 0xffc23d : 0xff4a3d);
      }
    }
    const flash = this.flashT > 0 ? 0.85 : 0;
    this.flashT -= dt;
    this.bodyMat.emissive.setScalar(flash);
    this.headMat.emissive.setScalar(flash);
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.solids = [];
    this.boxes = [];
    this.hittables = [];
    this.bots = [];
    this.ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();

    scene.background = new THREE.Color(0x9ad7ff);
    scene.fog = new THREE.Fog(0x9ad7ff, 40, 95);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a70, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(8, 15, 6);
    scene.add(sun);

    this.buildFloor();
    this.buildMap();
    for (const s of BOT_SPAWNS) this.bots.push(new Bot(this, s));
    this.buildFxPools();
  }

  buildFloor() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ead9a8';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(120,90,40,.22)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(25, 25);
    tex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), toon(0xffffff, { map: tex }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.solids.push(floor);
    this.hittables.push(floor);
  }

  buildMap() {
    const WALL = 0x5c7aa6, CRATE = 0xe39b4b, CRATE2 = 0xc96f3b, BLOCK = 0x8fb3d9;
    // 외벽
    this.addBox(0, -25, 50, 3, 1, WALL);
    this.addBox(0, 25, 50, 3, 1, WALL);
    this.addBox(-25, 0, 1, 3, 50, WALL);
    this.addBox(25, 0, 1, 3, 50, WALL);
    // 엄폐물
    this.addBox(-4, 4, 1.4, 1.2, 1.4, CRATE);
    this.addBox(3.5, 3, 1.2, 1.2, 1.2, CRATE2);
    this.addBox(0, -2, 4, 1.1, 0.6, BLOCK);     // 낮은 벽
    this.addBox(-8, -6, 2, 2.2, 2, CRATE);
    this.addBox(8, -5, 2, 2.2, 2, CRATE2);
    this.addBox(-3, -10, 1.4, 1.4, 1.4, CRATE);
    this.addBox(4, -13, 3, 1.2, 0.6, BLOCK);
    this.addBox(0, -18, 6, 2.5, 1, WALL);
    this.addBox(-13, 3, 1.5, 3, 6, BLOCK);
    this.addBox(13, 3, 1.5, 3, 6, BLOCK);
    this.addBox(-6, 10, 1.2, 1.2, 1.2, CRATE2);
    this.addBox(6, 9, 2, 1, 1, CRATE);
    this.addBox(6, 9, 1, 1, 1, CRATE2, 1);
  }

  addBox(x, z, w, h, d, color, y = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
    m.position.set(x, y + h / 2, z);
    addOutline(m, 0.03);
    this.scene.add(m);
    this.solids.push(m);
    this.hittables.push(m);
    this.boxes.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)));
    return m;
  }

  buildFxPools() {
    const tg = new THREE.BoxGeometry(0.018, 0.018, 1);
    tg.translate(0, 0, 0.5);
    this.tracers = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, depthWrite: false }));
      m.visible = false;
      m.raycast = () => {};
      this.scene.add(m);
      this.tracers.push({ m, life: 0 });
    }
    const puff = radialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]);
    this.impacts = [];
    for (let i = 0; i < 32; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false }));
      s.visible = false;
      this.scene.add(s);
      this.impacts.push({ s, life: 0, max: 0.25, size: 0.4 });
    }
    this.ti = 0;
    this.ii = 0;
  }

  tracer(from, to) {
    const t = this.tracers[this.ti++ % this.tracers.length];
    t.m.position.copy(from);
    t.m.scale.set(1, 1, Math.max(0.01, from.distanceTo(to)));
    t.m.lookAt(to);
    t.m.visible = true;
    t.life = 0.06;
  }

  impact(point, kind) {
    const it = this.impacts[this.ii++ % this.impacts.length];
    it.s.position.copy(point);
    it.s.material.color.setHex(kind === 'flesh' ? 0xff5a3a : kind === 'head' ? 0xffd23f : 0xd9c9a0);
    it.size = kind === 'wall' ? 0.35 : 0.55;
    it.max = it.life = 0.22;
    it.s.visible = true;
  }

  raycast(origin, dir, far) {
    this.ray.set(origin, dir);
    this.ray.far = far;
    for (const h of this.ray.intersectObjects(this.hittables, false)) {
      const bot = h.object.userData.bot;
      if (bot && bot.dead) continue;
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

  // 원(플레이어) vs AABB 밀어내기
  collide(pos, r) {
    for (const b of this.boxes) {
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

  update(dt, cam) {
    for (const b of this.bots) b.update(dt, cam);
    for (const t of this.tracers) {
      if (!t.m.visible) continue;
      t.life -= dt;
      t.m.material.opacity = Math.max(0, t.life / 0.06);
      if (t.life <= 0) t.m.visible = false;
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
