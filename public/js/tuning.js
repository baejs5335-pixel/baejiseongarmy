// 실시간 튜닝 패널 (SCHEMA로부터 자동 생성)
import { config, SCHEMA, PRESETS, save, applyPreset, diffFromDefaults } from './config.js';

export class Tuning {
  constructor(onChange) {
    this.onChange = onChange;
    this.panel = document.getElementById('tuning');
    this.btn = document.getElementById('btn-tune');
    this.inputs = {};
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
      <div class="tn-head"><b>⚙ 조작감 · 타격감 튜닝</b><button data-close>닫기</button></div>
      <div class="tn-presets">${Object.keys(PRESETS).map((n) => `<button data-preset="${n}">${n}</button>`).join('')}</div>`;
    for (const sec of SCHEMA) {
      const h = document.createElement('h3');
      h.textContent = sec.group;
      p.appendChild(h);
      for (const it of sec.items) p.appendChild(this.row(it));
    }
    const foot = document.createElement('div');
    foot.innerHTML = `<div class="tn-foot"><button data-preset="기본">전체 초기화</button><button data-copy>변경값 복사 (JSON)</button></div><textarea readonly hidden></textarea>`;
    p.appendChild(foot);

    p.querySelector('[data-close]').addEventListener('click', () => this.toggle(false));
    p.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      applyPreset(b.dataset.preset);
      this.sync();
      p.querySelectorAll('.tn-presets button').forEach((x) => x.classList.toggle('on', x === b));
      this.onChange();
    }));
    const ta = foot.querySelector('textarea');
    foot.querySelector('[data-copy]').addEventListener('click', async () => {
      const text = JSON.stringify(diffFromDefaults(), null, 2);
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
    const dec = it.step >= 1 ? 0 : String(it.step).split('.')[1].length;
    return config[it.key].toFixed(dec) + (it.unit ? ` ${it.unit}` : '');
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
}
