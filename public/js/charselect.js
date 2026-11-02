// 캐릭터 선택 화면: 목록 + 회전하는 3D 미리보기 + 능력치/판정 비교
import * as THREE from 'three';
import { CHARACTERS, CHAR_ORDER, buildCharacter, dims, balance } from './characters.js';
import { WEAPONS, damageAt } from './weapons.js';

const KEY = 'ss-char';

export function savedCharId() {
  try { const id = localStorage.getItem(KEY); if (CHARACTERS[id]) return id; } catch { /* 무시 */ }
  return 'leo';
}

export class CharSelect {
  constructor(onPick) {
    this.onPick = onPick;
    this.el = document.getElementById('charselect');
    this.sel = savedCharId();
    this.showHit = false;
    this.el.innerHTML = `
      <div class="cs-head"><b>캐릭터 선택</b><span class="cs-sub">작고 빠를수록 체력이 낮고, 크고 느릴수록 체력이 높습니다</span></div>
      <div class="cs-body">
        <div class="cs-list"></div>
        <div class="cs-stage">
          <canvas></canvas>
          <button class="cs-hit">판정 보기</button>
        </div>
        <div class="cs-info"></div>
      </div>
      <button class="cs-go">출전</button>`;
    this.list = this.el.querySelector('.cs-list');
    this.info = this.el.querySelector('.cs-info');
    this.canvas = this.el.querySelector('canvas');
    this.el.querySelector('.cs-hit').addEventListener('click', (e) => {
      this.showHit = !this.showHit;
      e.currentTarget.classList.toggle('on', this.showHit);
      this.applyHit();
    });
    this.el.querySelector('.cs-go').addEventListener('click', () => {
      try { localStorage.setItem(KEY, this.sel); } catch { /* 무시 */ }
      this.toggle(false);
      this.onPick(this.sel);
    });

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshBasicMaterial({ color: 0x2a3146 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // 1.8m 기준선
    const ref = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.8, 0.02), new THREE.MeshBasicMaterial({ color: 0x5c6680 }));
    ref.position.set(-0.85, 0.9, 0);
    this.scene.add(ref);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    this.camera.position.set(0, 1.15, 5.8);
    this.camera.lookAt(0, 0.95, 0);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.loop = this.loop.bind(this);
  }

  get open() { return !this.el.hidden; }

  toggle(open = !this.open) {
    this.el.hidden = !open;
    if (open) { this.render(); requestAnimationFrame(this.loop); }
  }

  render() {
    this.list.innerHTML = CHAR_ORDER.map((id) => {
      const c = CHARACTERS[id];
      return `<button data-id="${id}" class="${id === this.sel ? 'on' : ''}">
        <i style="background:#${c.color.toString(16).padStart(6, '0')}"></i><b>${c.name}</b><small>${c.cls}</small></button>`;
    }).join('');
    this.list.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.sel = b.dataset.id; this.render(); }));
    this.showModel();
    this.renderInfo();
  }

  showModel() {
    this.pivot.clear();
    this.model = buildCharacter(CHARACTERS[this.sel]);
    this.pivot.add(this.model.group);
    this.applyHit();
  }

  applyHit() {
    if (this.model) this.model.hitBody.visible = this.model.hitHead.visible = this.showHit;
  }

  renderInfo() {
    const c = CHARACTERS[this.sel];
    const d = dims(c), b = balance(c);
    const ar = WEAPONS.AR, near = damageAt(ar, 10);
    const bar = (label, v, max, text) => `<div class="cs-stat"><span>${label}</span>
      <div class="cs-bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><em>${text}</em></div>`;
    this.info.innerHTML = `
      <h2>${c.name} <small>${c.cls}</small></h2>
      <p>${c.desc}</p>
      <div class="cs-passive">패시브 · ${c.passive.text}</div>
      ${bar('이동 속도', c.speed, 1.3, `×${c.speed.toFixed(2)}`)}
      ${bar('체력', c.hp, 160, c.hp)}
      ${bar('판정 면적', b.areaPct, 160, `${b.areaPct.toFixed(0)}%`)}
      ${bar('생존력 지수', b.survival, 160, b.survival.toFixed(0))}
      <table>
        <tr><td>키</td><td>${d.total.toFixed(2)}m</td><td>머리 판정</td><td>${b.headPct.toFixed(0)}%</td></tr>
        <tr><td>AR 10m 몸통</td><td>${Math.ceil(c.hp / near)}발</td><td>AR 10m 헤드</td><td>${Math.ceil(c.hp / (near * ar.headMul))}발</td></tr>
      </table>
      <div class="cs-note">판정 면적·생존력 지수는 레오 = 100 기준 · 기본 무기 ${WEAPONS[c.weapon].name}</div>`;
  }

  loop(t) {
    if (!this.open) return;
    requestAnimationFrame(this.loop);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.pivot.rotation.y = t * 0.0007;
    this.renderer.render(this.scene, this.camera);
  }
}
