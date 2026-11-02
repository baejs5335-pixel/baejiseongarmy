// 실시간 튜닝 패널: [조작·타격감] 탭은 SCHEMA에서, [무기 밸런스] 탭은 EDITABLE에서 자동 생성
import { config, SCHEMA, PRESETS, save, applyPreset, diffFromDefaults } from './config.js';
import { WEAPONS, WEAPON_ORDER, EDITABLE, MODE_NAMES, getP, setP, saveWeapons, resetWeapon, damageAt } from './weapons.js';

import { CHARACTERS, CHAR_ORDER, CHAR_EDITABLE, saveCharacters, resetCharacter, balance } from './characters.js';

const TTK_DIST = [5, 15, 30, 50, 80];

const decimals = (step) => (step >= 1 ? 0 : String(step).split('.')[1].length);

export class Tuning {
  constructor(onChange, onWeaponChange, onCharChange) {
    this.onChange = onChange;
    this.onWeaponChange = onWeaponChange;
    this.onCharChange = onCharChange;
    this.cKey = 'leo';
    this.panel = document.getElementById('tuning');
    this.btn = document.getElementById('btn-tune');
    this.inputs = {};
    this.wKey = 'AR';
    this.btn.addEventListener('click', () => this.toggle());
    this.build();
  }

  toggle(open = this.panel.hidden) {
    this.panel.hidden = !open;
    this.btn.classList.toggle('on', open);
  }

  build() {
    const p = this.panel;
    p.innerHTML = `
      <div class="tn-head"><b>⚙ 튜닝</b><button data-close>닫기</button></div>
      <div class="tn-tabs"><button data-tab="feel" class="on">조작 · 타격감</button><button data-tab="weapon">무기</button><button data-tab="char">캐릭터</button></div>
      <div data-pane="feel"></div>
      <div data-pane="weapon" hidden></div>
      <div data-pane="char" hidden></div>`;
    p.querySelector('[data-close]').addEventListener('click', () => this.toggle(false));
    p.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      p.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      p.querySelectorAll('[data-pane]').forEach((x) => { x.hidden = x.dataset.pane !== b.dataset.tab; });
    }));
    this.buildFeel(p.querySelector('[data-pane=feel]'));
    this.weaponPane = p.querySelector('[data-pane=weapon]');
    this.buildWeapon();
    this.charPane = p.querySelector('[data-pane=char]');
    this.buildChar();
  }

  // ── 캐릭터 밸런스 ─────────────────────────
  buildChar() {
    const pane = this.charPane;
    const c = CHARACTERS[this.cKey];
    pane.innerHTML = `
      <h3>전체 비교 (레오 = 100)</h3>
      <div class="tn-cmp"></div>
      <div class="tn-presets">${CHAR_ORDER.map((k) => `<button data-c="${k}" class="${k === this.cKey ? 'on' : ''}">${CHARACTERS[k].name}</button>`).join('')}</div>
      <div class="tn-wmeta">${c.cls} · 패시브: ${c.passive.text}</div>
      <div class="tn-crows"></div>
      <div class="tn-foot"><button data-creset>이 캐릭터 초기화</button><button data-copy>변경값 복사 (JSON)</button></div>
      <textarea readonly hidden></textarea>`;
    pane.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { this.cKey = b.dataset.c; this.buildChar(); }));
    pane.querySelector('[data-creset]').addEventListener('click', () => { resetCharacter(this.cKey); this.onCharChange(); this.buildChar(); });
    this.copyButton(pane, () => saveCharacters());
    const rows = pane.querySelector('.tn-crows');
    for (const e of CHAR_EDITABLE) {
      const el = document.createElement('div');
      el.className = 'tn-row';
      el.innerHTML = `<label>${e.label}</label><span class="val"></span><input type="range" min="${e.min}" max="${e.max}" step="${e.step}">`;
      const inp = el.querySelector('input'), val = el.querySelector('.val');
      const show = () => { val.textContent = c[e.key].toFixed(decimals(e.step)); };
      inp.value = c[e.key];
      show();
      inp.addEventListener('input', () => {
        c[e.key] = parseFloat(inp.value);
        show();
        saveCharacters();
        this.renderCmp();
        this.onCharChange();
      });
      rows.appendChild(el);
    }
    this.renderCmp();
  }

  // 생존력 지수 = 체력 ÷ 판정 면적. 속도까지 높은 캐릭터가 지수도 높으면 너무 강하다는 신호
  renderCmp() {
    const rows = CHAR_ORDER.map((k) => {
      const c = CHARACTERS[k], b = balance(c);
      const warn = c.speed > 1 && b.survival > 105 ? ' class="warn"' : '';
      return `<tr${warn}><td>${c.name}</td><td>×${c.speed.toFixed(2)}</td><td>${c.hp}</td><td>${b.areaPct.toFixed(0)}%</td><td>${b.survival.toFixed(0)}</td></tr>`;
    }).join('');
    this.charPane.querySelector('.tn-cmp').innerHTML = `
      <table><tr><th>캐릭터</th><th>속도</th><th>체력</th><th>판정</th><th>생존력</th></tr>${rows}</table>
      <div class="hint">빨간 줄 = 빠른데 생존력도 높음 (밸런스 주의)</div>`;
  }

  // ── 조작 · 타격감 ─────────────────────────
  buildFeel(pane) {
    pane.innerHTML = `<div class="tn-presets">${Object.keys(PRESETS).map((n) => `<button data-preset="${n}">${n}</button>`).join('')}</div>`;
    for (const sec of SCHEMA) {
      const h = document.createElement('h3');
      h.textContent = sec.group;
      pane.appendChild(h);
      for (const it of sec.items) pane.appendChild(this.row(it));
    }
    const foot = document.createElement('div');
    foot.innerHTML = `<div class="tn-foot"><button data-preset="기본">전체 초기화</button><button data-copy>변경값 복사 (JSON)</button></div><textarea readonly hidden></textarea>`;
    pane.appendChild(foot);

    pane.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      applyPreset(b.dataset.preset);
      this.sync();
      pane.querySelectorAll('.tn-presets button').forEach((x) => x.classList.toggle('on', x === b));
      this.onChange();
    }));
    this.copyButton(foot, () => diffFromDefaults());
  }

  copyButton(foot, data) {
    const ta = foot.querySelector('textarea');
    foot.querySelector('[data-copy]').addEventListener('click', async () => {
      const text = JSON.stringify(data(), null, 2);
      ta.hidden = false;
      ta.value = text;
      try { await navigator.clipboard.writeText(text); ta.value = '// 클립보드에 복사됨\n' + text; } catch { ta.select(); }
    });
  }

  row(it) {
    const el = document.createElement('div');
    const id = 'tn-' + it.key;
    if (it.type === 'bool') {
      el.className = 'tn-row bool';
      el.innerHTML = `<label for="${id}">${it.label}</label><input id="${id}" type="checkbox">${it.hint ? `<div class="hint">${it.hint}</div>` : ''}`;
      const inp = el.querySelector('input');
      inp.addEventListener('change', () => { config[it.key] = inp.checked; this.changed(); });
      this.inputs[it.key] = { it, inp };
    } else {
      el.className = 'tn-row';
      el.innerHTML = `<label for="${id}">${it.label}</label><span class="val"></span>
        <input id="${id}" type="range" min="${it.min}" max="${it.max}" step="${it.step}">${it.hint ? `<div class="hint">${it.hint}</div>` : ''}`;
      const inp = el.querySelector('input');
      const val = el.querySelector('.val');
      inp.addEventListener('input', () => { config[it.key] = parseFloat(inp.value); val.textContent = this.fmt(it); this.changed(); });
      this.inputs[it.key] = { it, inp, val };
    }
    this.syncOne(it.key);
    return el;
  }

  fmt(it) {
    return config[it.key].toFixed(decimals(it.step)) + (it.unit ? ` ${it.unit}` : '');
  }

  syncOne(key) {
    const { it, inp, val } = this.inputs[key];
    if (it.type === 'bool') inp.checked = config[key];
    else { inp.value = config[key]; val.textContent = this.fmt(it); }
  }

  sync() { for (const k in this.inputs) this.syncOne(k); }

  changed() {
    save();
    this.panel.querySelectorAll('.tn-presets button').forEach((x) => x.classList.remove('on'));
    this.onChange();
  }

  // ── 무기 밸런스 ───────────────────────────
  buildWeapon() {
    const pane = this.weaponPane;
    const w = WEAPONS[this.wKey];
    pane.innerHTML = `
      <div class="tn-presets">${WEAPON_ORDER.map((k) => `<button data-w="${k}" class="${k === this.wKey ? 'on' : ''}">${WEAPONS[k].name}</button>`).join('')}</div>
      <div class="tn-wmeta">사격 모드: ${w.modes.map((m) => MODE_NAMES[m]).join(' / ')}${w.pellets > 1 ? ` · 펠릿 ${w.pellets}발` : ''}</div>
      <h3>TTK (체력 100 기준)</h3>
      <div class="tn-ttk"></div>
      <h3>스펙</h3>
      <div class="tn-wrows"></div>
      <div class="tn-foot"><button data-wreset>이 무기 초기화</button><button data-copy>변경값 복사 (JSON)</button></div>
      <textarea readonly hidden></textarea>`;
    pane.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { this.wKey = b.dataset.w; this.buildWeapon(); }));
    pane.querySelector('[data-wreset]').addEventListener('click', () => { resetWeapon(this.wKey); this.onWeaponChange(); this.buildWeapon(); });
    this.copyButton(pane, () => saveWeapons());

    const rows = pane.querySelector('.tn-wrows');
    for (const e of EDITABLE) {
      const el = document.createElement('div');
      el.className = 'tn-row';
      el.innerHTML = `<label>${e.label}</label><span class="val"></span><input type="range" min="${e.min}" max="${e.max}" step="${e.step}">`;
      const inp = el.querySelector('input'), val = el.querySelector('.val');
      const show = () => { val.textContent = getP(w, e.path).toFixed(decimals(e.step)) + (e.unit ? ` ${e.unit}` : ''); };
      inp.value = getP(w, e.path);
      show();
      inp.addEventListener('input', () => {
        setP(w, e.path, parseFloat(inp.value));
        show();
        saveWeapons();
        this.renderTtk();
        this.onWeaponChange();
      });
      rows.appendChild(el);
    }
    this.renderTtk();
  }

  // 거리별 필요 탄수와 TTK. 첫 발은 즉시, 이후 연사 간격 + 탄 비행 시간
  renderTtk() {
    const w = WEAPONS[this.wKey];
    const interval = 60 / w.rpm;
    const cell = (perShot, d) => {
      const stk = Math.ceil(100 / Math.max(0.01, perShot));
      const ms = ((stk - 1) * interval + d / w.velocity) * 1000;
      return `<td>${stk}발</td><td>${Math.round(ms)}ms</td>`;
    };
    const rows = TTK_DIST.map((d) => {
      const body = damageAt(w, d) * w.pellets;
      return `<tr><td>${d}m</td><td>${body.toFixed(0)}</td>${cell(body, d)}${cell(body * w.headMul, d)}</tr>`;
    }).join('');
    this.weaponPane.querySelector('.tn-ttk').innerHTML = `
      <table><tr><th>거리</th><th>데미지</th><th colspan="2">몸통</th><th colspan="2">헤드</th></tr>${rows}</table>
      <div class="hint">${w.pellets > 1 ? '샷건은 펠릿 전부 명중 가정 · ' : ''}DPS ${Math.round(damageAt(w, 0) * w.pellets / interval)} · 탄 비행 시간 포함</div>`;
  }
}
