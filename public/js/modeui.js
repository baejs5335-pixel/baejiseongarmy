// 모드 선택 화면 + 매치 HUD (점수판, 킬 피드, 체력, 피격 방향, 무적, 사망, 결과)
import { MODES, MODE_ORDER, DIFFICULTY, SETTING_FIELDS, modeSettings, saveModeSettings, rulesFor } from './modes.js';
import { TEAM_NAME } from './combat.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class ModeSelect {
  constructor(current, onConfirm) {
    this.sel = current;
    this.onConfirm = onConfirm;
    this.el = document.getElementById('modeselect');
  }

  get open() { return !this.el.hidden; }

  toggle(open = !this.open) {
    this.el.hidden = !open;
    if (open) this.render();
  }

  render() {
    const m = MODES[this.sel];
    const r = rulesFor(this.sel);
    this.el.innerHTML = `
      <div class="cs-head"><b>모드 선택</b><span class="cs-sub">규칙은 모드별로 저장됩니다</span></div>
      <div class="ms-body">
        <div class="ms-list">${MODE_ORDER.map((k) => `<button data-m="${k}" class="${k === this.sel ? 'on' : ''}">
          <small>${MODES[k].tag}</small><b>${MODES[k].name}</b></button>`).join('')}</div>
        <div class="ms-info">
          <h2>${m.name}</h2><p>${m.desc}</p>
          ${m.match ? `
            <div class="ms-rules">${SETTING_FIELDS.map((f) => `
              <div class="tn-row"><label>${f.label}</label><span class="val">${f.fmt(r[f.key])}</span>
              <input type="range" data-k="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${r[f.key]}"></div>`).join('')}
            </div>
            <div class="ms-row"><span>AI 난이도</span>${Object.entries(DIFFICULTY).map(([k, d]) =>
              `<button data-d="${k}" class="${modeSettings.diff === k ? 'on' : ''}">${d.name}</button>`).join('')}</div>
            <label class="ms-row"><input type="checkbox" data-ib ${modeSettings.invulnBreak ? 'checked' : ''}> 무적 중 공격하면 무적 해제 (스폰 킬 악용 방지)</label>
            <div class="ms-meta">무기: ${m.weapons ? m.weapons.join(' · ') : '전체'} · 이동 속도 ×${m.speedMul} ${m.dmgMul > 1 ? '· 모든 공격 한 방' : ''}</div>
            <button class="ms-reset">기본값으로</button>` : ''}
        </div>
      </div>
      <button class="cs-go">다음: 캐릭터 선택</button>`;
    this.el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { this.sel = b.dataset.m; this.render(); }));
    this.el.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => {
      const f = SETTING_FIELDS.find((x) => x.key === inp.dataset.k);
      (modeSettings[this.sel] ||= {})[f.key] = parseFloat(inp.value);
      inp.previousElementSibling.textContent = f.fmt(parseFloat(inp.value));
      saveModeSettings();
    }));
    this.el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { modeSettings.diff = b.dataset.d; saveModeSettings(); this.render(); }));
    this.el.querySelector('[data-ib]')?.addEventListener('change', (e) => { modeSettings.invulnBreak = e.target.checked; saveModeSettings(); });
    this.el.querySelector('.ms-reset')?.addEventListener('click', () => { delete modeSettings[this.sel]; saveModeSettings(); this.render(); });
    this.el.querySelector('.cs-go').addEventListener('click', () => { this.toggle(false); this.onConfirm(this.sel); });
  }
}

export class MatchHud {
  constructor(rules) {
    this.rules = rules;
    const hud = document.getElementById('hud');
    this.top = hud.appendChild(el(`<div id="scorebar"><span class="sa">0</span><div class="mid"><b>${mmss(rules.time)}</b><small>${rules.name} · 목표 ${rules.scoreLimit}</small></div><span class="sb">0</span></div>`));
    this.feedEl = hud.appendChild(el('<div id="killfeed"></div>'));
    this.hpEl = hud.appendChild(el('<div id="hp"><i></i><span>100</span></div>'));
    this.hurtEl = document.body.appendChild(el('<div id="hurt"></div>'));
    this.dirEl = hud.appendChild(el('<div id="dmgdir"></div>'));
    this.invEl = hud.appendChild(el('<div id="invuln"></div>'));
    this.deathEl = document.body.appendChild(el('<div id="death" hidden><b></b><span></span></div>'));
    this.resultEl = document.body.appendChild(el('<div id="result" hidden></div>'));
    this.boardEl = document.body.appendChild(el('<div id="scoreboard" hidden></div>'));
    this.hurtA = 0;
    // 점수판을 누르면 전체 스코어보드
    this.top.addEventListener('pointerdown', (e) => { e.preventDefault(); this.toggleBoard(); });
    this.boardEl.addEventListener('pointerdown', () => this.toggleBoard(false));
  }

  toggleBoard(open = this.boardEl.hidden) {
    this.boardEl.hidden = !open;
    if (open && this.match) this.renderBoard();
  }

  renderBoard() {
    const m = this.match;
    const rows = (team) => m.combatants.filter((c) => c.team === team)
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((c) => `<tr class="${c.isPlayer ? 'me' : ''}${c.dead ? ' dead' : ''}"><td>${c.name}</td><td>${c.char?.cls || ''}</td><td>${c.kills}</td><td>${c.deaths}</td></tr>`).join('');
    this.boardEl.innerHTML = `<div class="sb-inner">
      <div class="rs-score"><span class="tA">${m.score.A}</span> : <span class="tB">${m.score.B}</span> <small>목표 ${this.rules.scoreLimit}</small></div>
      <div class="rs-tables">${['A', 'B'].map((t) => `<table><tr><th class="t${t}">${TEAM_NAME[t]}</th><th>클래스</th><th>킬</th><th>데스</th></tr>${rows(t)}</table>`).join('')}</div>
      <small>아무 곳이나 눌러 닫기</small></div>`;
  }

  update(dt, match, player) {
    this.match = match;
    if (!this.boardEl.hidden && (this.boardT = (this.boardT || 0) - dt) <= 0) { this.boardT = 0.5; this.renderBoard(); }
    this.top.querySelector('.sa').textContent = match.score.A;
    this.top.querySelector('.sb').textContent = match.score.B;
    const t = this.top.querySelector('b');
    t.textContent = mmss(Math.max(0, match.time));
    t.classList.toggle('low', match.time < 30);
    const f = player.hp / player.maxHp;
    this.hpEl.querySelector('i').style.width = f * 100 + '%';
    this.hpEl.querySelector('span').textContent = Math.ceil(player.hp);
    this.hpEl.classList.toggle('low', f < 0.35);
    this.invEl.textContent = player.invulnT > 0 && !player.dead ? `🛡 무적 ${player.invulnT.toFixed(1)}초` : '';
    document.body.classList.toggle('invuln', player.invulnT > 0 && !player.dead);
    this.hurtA = Math.max(0, this.hurtA - dt * 1.6);
    this.hurtEl.style.opacity = String(Math.max(this.hurtA, f < 0.35 && !player.dead ? 0.35 + Math.sin(match.now * 6) * 0.1 : 0));
    for (const a of [...this.dirEl.children]) {
      const life = +a.dataset.life - dt;
      a.dataset.life = life;
      a.style.opacity = String(Math.min(1, life));
      if (life <= 0) a.remove();
    }
    if (player.dead) {
      this.deathEl.hidden = false;
      this.deathEl.querySelector('b').textContent = player.killer ? `${player.killer.name}에게 처치됨` : '처치됨';
      this.deathEl.querySelector('span').textContent = `${Math.max(0, player.respawnT).toFixed(1)}초 후 부활`;
    } else this.deathEl.hidden = true;
    document.getElementById('game').classList.toggle('dead', player.dead);
  }

  // rel: 공격자 방향 (플레이어 정면 기준 라디안, +면 왼쪽)
  hurt(amount, rel) {
    this.hurtA = Math.min(0.8, this.hurtA + 0.25 + amount / 120);
    if (rel === undefined) return;
    const a = el(`<i data-life="1.2" style="transform: rotate(${-rel}rad)"></i>`);
    this.dirEl.appendChild(a);
  }

  feed(killer, victim, w, head, back) {
    const name = (c) => `<span class="t${c.team}${c.isPlayer ? ' me' : ''}">${c.name}</span>`;
    const tag = back ? ' 🗡등' : head ? ' 💥' : '';
    const row = el(`<div>${killer ? name(killer) : ''} <em>[${w.name}${tag}]</em> ${name(victim)}</div>`);
    this.feedEl.prepend(row);
    while (this.feedEl.children.length > 5) this.feedEl.lastChild.remove();
    setTimeout(() => row.remove(), 6000);
  }

  result(winner, match, onRetry, onModes) {
    const mine = winner === 'A' ? '승리' : winner === 'B' ? '패배' : '무승부';
    const rows = (team) => match.combatants.filter((c) => c.team === team)
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((c) => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${c.name}</td><td>${c.kills}</td><td>${c.deaths}</td></tr>`).join('');
    const all = [...match.combatants].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    this.resultEl.innerHTML = `
      <h1 class="${winner === 'A' ? 'win' : winner === 'B' ? 'lose' : ''}">${mine}</h1>
      <div class="rs-score"><span class="tA">${match.score.A}</span> : <span class="tB">${match.score.B}</span></div>
      <div class="rs-mvp">MVP · ${all[0].name} (${all[0].kills}킬)</div>
      <div class="rs-tables">
        ${['A', 'B'].map((t) => `<table><tr><th class="t${t}">${TEAM_NAME[t]}</th><th>킬</th><th>데스</th></tr>${rows(t)}</table>`).join('')}
      </div>
      <div class="rs-btns"><button data-retry>다시 하기</button><button data-modes>모드 선택</button></div>`;
    this.resultEl.hidden = false;
    this.resultEl.querySelector('[data-retry]').addEventListener('click', onRetry);
    this.resultEl.querySelector('[data-modes]').addEventListener('click', onModes);
  }
}
