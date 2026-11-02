// HUD 커스텀 레이아웃: 버튼 위치(화면 비율)·크기·투명도·표시 여부를 저장하고, 편집 화면에서 드래그로 바꿉니다.
// 2핑거(엄지만) / 3핑거(왼손 검지 발사) / 4핑거(클로 그립) 프리셋 제공.
import { config as cfg, save as saveCfg } from './config.js';

const KEY = 'ss-layout-v1';

export const LAYOUT_ITEMS = [
  { id: 'btn-fire', label: '발사' },
  { id: 'btn-fire-left', label: '왼쪽 발사', cfgKey: 'leftFire' },
  { id: 'btn-ads', label: '조준' },
  { id: 'btn-jump', label: '점프' },
  { id: 'btn-crouch', label: '앉기' },
  { id: 'btn-reload', label: '재장전' },
  { id: 'joy-base', label: '이동 패드', joy: true },
  { id: 'weapons', label: '무기 슬롯' },
  { id: 'gun-opts', label: '모드·조준경' },
  { id: 'ammo', label: '탄약' },
  { id: 'minimap', label: '미니맵' },
];

// x, y = 버튼 중심의 화면 비율 / s = 크기 배율 / o = 투명도 / v = 표시
export const LAYOUT_PRESETS = {
  '2핑거': {
    hint: '엄지 두 개: 오른손 엄지로 회전+발사(발사 버튼 드래그), 적 위에서 자동 사격',
    cfg: { autoFire: true, leftFire: false, fireBtnLook: true },
    items: {
      'btn-fire': { x: 0.84, y: 0.64, s: 1.3 }, 'btn-ads': { x: 0.68, y: 0.84, s: 1 },
      'btn-jump': { x: 0.94, y: 0.4, s: 0.9 }, 'btn-crouch': { x: 0.83, y: 0.38, s: 0.9 },
      'btn-reload': { x: 0.95, y: 0.22, s: 0.85 }, 'joy-base': { x: 0.17, y: 0.7, s: 1.1 },
    },
  },
  '3핑거': {
    hint: '왼손 검지로 왼쪽 위 발사, 왼손 엄지 이동, 오른손 엄지 회전',
    cfg: { autoFire: false, leftFire: true, fireBtnLook: true },
    items: {
      'btn-fire': { x: 0.87, y: 0.7, s: 1.05 }, 'btn-fire-left': { x: 0.09, y: 0.4, s: 1.15 },
      'btn-ads': { x: 0.71, y: 0.85, s: 1 }, 'btn-jump': { x: 0.93, y: 0.44, s: 1 },
      'btn-crouch': { x: 0.79, y: 0.56, s: 1 }, 'btn-reload': { x: 0.95, y: 0.24, s: 0.85 },
      'joy-base': { x: 0.19, y: 0.72, s: 1 },
    },
  },
  '4핑거': {
    hint: '클로 그립: 왼손 검지 발사, 오른손 검지로 위쪽 조준/점프, 엄지는 이동·회전에 집중',
    cfg: { autoFire: false, leftFire: true, fireBtnLook: true },
    items: {
      'btn-fire': { x: 0.88, y: 0.72, s: 1 }, 'btn-fire-left': { x: 0.1, y: 0.3, s: 1.15 },
      'btn-ads': { x: 0.84, y: 0.26, s: 1.05 }, 'btn-jump': { x: 0.7, y: 0.26, s: 1 },
      'btn-crouch': { x: 0.95, y: 0.46, s: 0.9 }, 'btn-reload': { x: 0.76, y: 0.5, s: 0.85 },
      'joy-base': { x: 0.19, y: 0.72, s: 1 },
    },
  },
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Layout {
  constructor(input, onChange) {
    this.input = input;
    this.onChange = onChange;
    this.defaults = this.measure();
    try { this.data = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { this.data = {}; }
    this.apply();
    addEventListener('resize', () => this.apply());
  }

  // CSS 기본 배치에서 각 버튼의 중심 위치를 읽어 "기본" 레이아웃으로 사용
  measure() {
    const out = {};
    for (const it of LAYOUT_ITEMS) {
      const el = document.getElementById(it.id);
      if (it.joy) {
        const h = this.input.joyHome();
        out[it.id] = { x: h.x / innerWidth, y: h.y / innerHeight, s: 1, o: 1, v: true };
        continue;
      }
      const r = el.getBoundingClientRect();
      // 숨겨진 버튼은 크기가 0 → 3핑거 프리셋 위치를 기본값으로
      const fb = LAYOUT_PRESETS['3핑거'].items[it.id] || { x: 0.5, y: 0.5 };
      out[it.id] = r.width
        ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight, s: 1, o: 1, v: true }
        : { x: fb.x, y: fb.y, s: 1, o: 1, v: true };
    }
    return out;
  }

  get(id) { return { ...this.defaults[id], ...(this.data[id] || {}) }; }

  apply() {
    for (const it of LAYOUT_ITEMS) {
      const el = document.getElementById(it.id), L = this.get(it.id);
      const x = clamp(L.x, 0.02, 0.98) * innerWidth, y = clamp(L.y, 0.03, 0.97) * innerHeight;
      if (it.joy) {
        this.input.setJoyHome(x, y, L.s);
        el.style.setProperty('--o', L.o);
        continue;
      }
      el.classList.add('laid');
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--s', L.s);
      el.style.opacity = L.o;
      el.classList.toggle('lay-hidden', L.v === false || (!!it.cfgKey && !cfg[it.cfgKey]));
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* 무시 */ }
  }

  // ── 편집 화면 ──────────────────────────
  openEditor() {
    this.snapshot = { data: structuredClone(this.data), cfg: { autoFire: cfg.autoFire, leftFire: cfg.leftFire, fireBtnLook: cfg.fireBtnLook } };
    const ed = this.ed = document.getElementById('layout-editor');
    ed.hidden = false;
    document.body.classList.add('editing');
    ed.innerHTML = `
      <div class="le-boxes"></div>
      <div class="le-panel">
        <div class="le-row"><b>HUD 편집</b>${Object.keys(LAYOUT_PRESETS).map((k) => `<button data-p="${k}">${k}</button>`).join('')}<button data-p="기본">기본</button></div>
        <div class="le-hint">버튼을 끌어서 옮기고, 선택한 버튼의 크기·투명도를 조절하세요</div>
        <div class="le-row le-sel"></div>
        <div class="le-row"><button data-save class="primary">저장</button><button data-cancel>취소</button><button data-move title="패널 위치 바꾸기">⇅ 패널 이동</button></div>
      </div>`;
    this.boxes = ed.querySelector('.le-boxes');
    ed.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => this.preset(b.dataset.p)));
    ed.querySelector('[data-save]').addEventListener('click', () => this.closeEditor(true));
    ed.querySelector('[data-cancel]').addEventListener('click', () => this.closeEditor(false));
    // 패널이 버튼을 가리면 위/가운데/아래로 옮김
    const panel = ed.querySelector('.le-panel');
    ed.querySelector('[data-move]').addEventListener('click', () => {
      const order = ['', 'at-top', 'at-bottom'];
      const cur = order.findIndex((c) => c && panel.classList.contains(c));
      panel.classList.remove('at-top', 'at-bottom');
      const next = order[(Math.max(0, cur) + 1) % order.length];
      if (next) panel.classList.add(next);
    });
    this.boxes.addEventListener('pointerdown', (e) => this.dragStart(e));
    this.select(LAYOUT_ITEMS[0].id);
  }

  preset(name) {
    if (name === '기본') {
      this.data = {};
    } else {
      const p = LAYOUT_PRESETS[name];
      this.data = structuredClone(p.items);
      Object.assign(cfg, p.cfg);
      this.ed.querySelector('.le-hint').textContent = p.hint;
    }
    this.apply();
    this.renderBoxes();
    this.renderSel();
  }

  closeEditor(keep) {
    if (keep) { this.save(); saveCfg(); }
    else { this.data = this.snapshot.data; Object.assign(cfg, this.snapshot.cfg); }
    this.apply();
    this.ed.hidden = true;
    document.body.classList.remove('editing');
    this.onChange?.();
  }

  rectOf(it) {
    const el = document.getElementById(it.id), L = this.get(it.id);
    if (it.joy) {
      const r = cfg.joyRadius * L.s;
      return { x: L.x * innerWidth - r, y: L.y * innerHeight - r, w: r * 2, h: r * 2 };
    }
    const hidden = el.classList.contains('lay-hidden');
    if (hidden) return { x: L.x * innerWidth - 28, y: L.y * innerHeight - 28, w: 56, h: 56 };
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  renderBoxes() {
    this.boxes.innerHTML = LAYOUT_ITEMS.map((it) => {
      const r = this.rectOf(it), L = this.get(it.id);
      const off = L.v === false || (it.cfgKey && !cfg[it.cfgKey]);
      return `<div class="le-box${it.id === this.sel ? ' on' : ''}${off ? ' off' : ''}" data-id="${it.id}"
        style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"><span>${it.label}</span></div>`;
    }).join('');
  }

  select(id) {
    this.sel = id;
    this.renderBoxes();
    this.renderSel();
  }

  renderSel() {
    const it = LAYOUT_ITEMS.find((x) => x.id === this.sel), L = this.get(this.sel);
    const visible = it.cfgKey ? cfg[it.cfgKey] : L.v !== false;
    const sel = this.ed.querySelector('.le-sel');
    sel.innerHTML = `<span class="le-name">${it.label}</span>
      <label>크기 <input type="range" data-k="s" min="0.5" max="2" step="0.05" value="${L.s}"></label>
      <label>투명도 <input type="range" data-k="o" min="0.15" max="1" step="0.05" value="${L.o}"></label>
      <label><input type="checkbox" data-v ${visible ? 'checked' : ''} ${it.id === 'btn-fire' || it.joy ? 'disabled' : ''}> 표시</label>`;
    sel.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => {
      this.set(this.sel, { [inp.dataset.k]: parseFloat(inp.value) });
    }));
    sel.querySelector('[data-v]').addEventListener('change', (e) => {
      if (it.cfgKey) cfg[it.cfgKey] = e.target.checked;
      else this.set(this.sel, { v: e.target.checked });
      this.apply();
      this.renderBoxes();
    });
  }

  set(id, patch) {
    this.data[id] = { ...this.get(id), ...patch };
    this.apply();
    this.renderBoxes();
  }

  dragStart(e) {
    const box = e.target.closest('.le-box');
    if (!box) return;
    e.preventDefault();
    const id = box.dataset.id;
    if (id !== this.sel) this.select(id);
    const L = this.get(id), sx = e.clientX, sy = e.clientY;
    const move = (ev) => {
      this.data[id] = { ...this.get(id), x: L.x + (ev.clientX - sx) / innerWidth, y: L.y + (ev.clientY - sy) / innerHeight };
      this.apply();
      this.renderBoxes();
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }
}
