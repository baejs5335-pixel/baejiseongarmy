// 병영 화면: 무기고(강화·등급·파츠) / 상점(파츠·보급 상자·환전) / 일일 미션 / 업적
import { WEAPONS, GUN_ORDER } from './weapons.js';
import { GRADES, SLOTS, SLOT_ORDER, PARTS, ECON, MAX_ENH, DAILY_BONUS } from './progression.js';

const cost = (c) => [c.gold ? `🪙${c.gold.toLocaleString()}` : '', c.gems ? `💎${c.gems}` : ''].filter(Boolean).join(' ');
const gradeTag = (g) => `<span class="gr" style="color:${GRADES[g].color}">${GRADES[g].name}</span>`;

export class Lobby {
  constructor(prog, onChange) {
    this.prog = prog;
    this.onChange = onChange;
    this.el = document.getElementById('lobby');
    this.tab = 'armory';
    this.wKey = 'AR';
    this.slot = null;
    prog.onChange(() => { if (this.open) this.render(); this.onChange?.(); });
  }

  get open() { return !this.el.hidden; }

  toggle(open = !this.open) {
    this.el.hidden = !open;
    if (open) this.render();
  }

  flash(msg) {
    this.msg = msg;
    clearTimeout(this.msgT);
    this.msgT = setTimeout(() => { this.msg = ''; if (this.open) this.render(); }, 2200);
  }

  render() {
    const p = this.prog.p;
    const need = ECON.xpToNext(p.level);
    const tabs = { armory: '무기고', shop: '상점', missions: '일일 미션', ach: '업적' };
    const badge = this.prog.claimable();
    this.el.innerHTML = `
      <div class="lb-head">
        <b>🎒 병영</b>
        <div class="lb-lv">Lv.${p.level}<div class="lb-xp"><i style="width:${p.xp / need * 100}%"></i></div><small>${p.xp}/${need}</small></div>
        <span class="lb-cur">🪙 ${p.gold.toLocaleString()}</span><span class="lb-cur">💎 ${p.gems}</span>
        <button data-close>닫기</button>
      </div>
      <div class="lb-tabs">${Object.entries(tabs).map(([k, v]) => `<button data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${v}${(k === 'missions' || k === 'ach') && badge ? ' <i class="dot"></i>' : ''}</button>`).join('')}</div>
      <div class="lb-body">${this[this.tab]()}</div>
      ${this.msg ? `<div class="lb-msg">${this.msg}</div>` : ''}`;
    this.el.querySelector('[data-close]').onclick = () => this.toggle(false);
    this.el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.slot = null; this.render(); }; });
    this.el.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => this.act(b.dataset.act, b.dataset); });
  }

  // ── 무기고 ──────────────────────────────
  armory() {
    const pr = this.prog, st = pr.p.weapons[this.wKey], base = WEAPONS[this.wKey], eff = pr.effective(this.wKey);
    const list = GUN_ORDER.map((k) => {
      const s = pr.p.weapons[k];
      return `<button data-act="pick" data-k="${k}" class="${k === this.wKey ? 'on' : ''}" style="border-left-color:${GRADES[s.grade].color}">
        <b>${WEAPONS[k].name}</b><small>${GRADES[s.grade].name} +${s.enh}</small></button>`;
    }).join('');
    const row = (label, a, b, better, fmt = (v) => v) => {
      const diff = Math.abs(a - b) > 1e-6;
      const good = diff && (better === 'low' ? b < a : b > a);
      return `<tr><td>${label}</td><td>${fmt(a)}</td><td class="${diff ? (good ? 'up' : 'down') : ''}">${fmt(b)}</td></tr>`;
    };
    const f2 = (v) => v.toFixed(2), f1 = (v) => v.toFixed(1);
    const stats = `<table class="lb-stats"><tr><th></th><th>기본</th><th>현재</th></tr>
      ${row('데미지', base.damage.near, eff.damage.near, 'high')}
      ${row('탄창', base.mag, eff.mag, 'high')}
      ${row('장전(초)', base.reloadTac, eff.reloadTac, 'low', f2)}
      ${row('반동', base.recoil.scale, eff.recoil.scale, 'low', f2)}
      ${row('정조준(초)', base.adsTime, eff.adsTime, 'low', f2)}
      ${row('지향 탄퍼짐°', base.hip.base, eff.hip.base, 'low', f1)}
      ${row('이동 배율', base.mobility, eff.mobility, 'high', f2)}
      ${row('총성 들리는 거리', 45, eff.hearRadius, 'low', (v) => Math.round(v) + 'm')}</table>`;
    const enhCost = st.enh < MAX_ENH ? ECON.enhanceCost(st.grade, st.enh + 1) : null;
    const upCost = st.grade < 2 ? ECON.gradeUpCost[st.grade] : null;
    const slots = SLOT_ORDER.map((slot, i) => {
      const locked = i >= pr.slotsOpen(this.wKey);
      const pt = pr.part(st.parts[slot]);
      return `<button class="lb-slot ${locked ? 'locked' : ''} ${this.slot === slot ? 'on' : ''}" ${locked ? '' : `data-act="slot" data-slot="${slot}"`}>
        <small>${SLOTS[slot]}</small>${locked ? `🔒 ${GRADES[i === 2 ? 1 : 2].name}부터` : pt ? `${PARTS[pt.id].icon} ${PARTS[pt.id].name} ${gradeTag(pt.grade)}` : '<em>비어 있음</em>'}</button>`;
    }).join('');
    let inv = '';
    if (this.slot) {
      const items = pr.p.parts.filter((x) => PARTS[x.id].slot === this.slot).sort((a, b) => b.grade - a.grade);
      inv = `<div class="lb-inv"><b>${SLOTS[this.slot]} 파츠</b>
        ${st.parts[this.slot] ? `<button data-act="unequip" data-slot="${this.slot}">해제</button>` : ''}
        ${items.length ? items.map((x) => {
          const on = pr.equippedOn(x.uid);
          return `<button data-act="equip" data-uid="${x.uid}" class="${st.parts[this.slot] === x.uid ? 'on' : ''}">
            ${PARTS[x.id].icon} ${PARTS[x.id].name} ${gradeTag(x.grade)}<small>${PARTS[x.id].desc(GRADES[x.grade].k)}${on && on !== this.wKey ? ` · ${WEAPONS[on].name} 장착 중` : ''}</small></button>`;
        }).join('') : '<p>보유한 파츠가 없습니다. 상점에서 구매하세요.</p>'}</div>`;
    }
    return `<div class="lb-armory">
      <div class="lb-wlist">${list}</div>
      <div class="lb-wdetail">
        <h2>${base.name} ${gradeTag(st.grade)} <span class="enh">${'★'.repeat(st.enh)}${'☆'.repeat(MAX_ENH - st.enh)}</span></h2>
        <div class="lb-actions">
          <button data-act="enhance" ${enhCost ? '' : 'disabled'}>강화 +${Math.min(MAX_ENH, st.enh + 1)} ${enhCost ? cost(enhCost) : '(최대)'}</button>
          <button data-act="gradeup" ${upCost && st.enh >= MAX_ENH ? '' : 'disabled'}>등급 상승 → ${upCost ? GRADES[st.grade + 1].name + ' ' + cost(upCost) : '최고 등급'}</button>
        </div>
        <p class="lb-note">강화: 단계마다 반동 -2% · 장전 -1.5% / 등급: 파츠 슬롯 +1 · 무기 색상 변경. <b>데미지는 오르지 않습니다</b> (처치 탄수 구간 보호).</p>
        <div class="lb-slots">${slots}</div>
        ${inv}
      </div>
      <div class="lb-wstats">${stats}</div>
    </div>`;
  }

  // ── 상점 ────────────────────────────────
  shop() {
    const p = this.prog.p;
    const parts = Object.entries(PARTS).map(([id, P]) => `<div class="lb-card">
      <b>${P.icon} ${P.name}</b><small>${SLOTS[P.slot]} · ${P.desc(1)}</small>
      <div>${[0, 1].map((g) => `<button data-act="buy" data-id="${id}" data-g="${g}">${GRADES[g].name} ${cost(ECON.partPrice[g])}</button>`).join('')}</div></div>`).join('');
    const [c, r, l] = ECON.crate.odds;
    return `<div class="lb-shop">
      <div class="lb-card wide crate">
        <b>📦 보급 상자</b>
        <small>무작위 파츠 1개 · 확률: 일반 ${c * 100}% / 희귀 ${r * 100}% / 전설 ${l * 100}% · ${ECON.crate.pity}회째 전설 확정 (현재 ${p.pity}/${ECON.crate.pity})</small>
        <div><button data-act="crate">열기 ${cost({ gems: ECON.crate.gems })}</button>
        <button data-act="free" ${p.daily.free ? 'disabled' : ''}>일일 무료 보급 🪙${ECON.freeDaily.gold}${p.daily.free ? ' (받음)' : ''}</button>
        <button data-act="exchange">환전 💎${ECON.exchange.gems} → 🪙${ECON.exchange.gold}</button></div>
      </div>
      ${parts}
      <p class="lb-note">전설 파츠는 보급 상자에서만 나옵니다.</p>
    </div>`;
  }

  // ── 미션 / 업적 ─────────────────────────
  missions() {
    const list = this.prog.dailyList();
    const allClaimed = list.every((m) => m.claimed);
    return `<div class="lb-missions">
      <p class="lb-note">매일 자정에 3개가 새로 나옵니다 · 매치 모드에서만 집계 (훈련장 제외)</p>
      ${list.map((m) => `<div class="lb-mission ${m.claimed ? 'done' : ''}">
        <div><b>${m.text}</b><div class="lb-bar"><i style="width:${m.prog / m.goal * 100}%"></i></div><small>${m.prog}/${m.goal} · 보상 ${cost(m.reward)}</small></div>
        <button data-act="claimD" data-id="${m.id}" ${m.done && !m.claimed ? '' : 'disabled'}>${m.claimed ? '완료' : '받기'}</button></div>`).join('')}
      <div class="lb-mission bonus"><div><b>모든 일일 미션 완료 보너스</b><small>보상 ${cost(DAILY_BONUS)}</small></div>
        <button data-act="bonus" ${allClaimed && !this.prog.p.daily.bonus ? '' : 'disabled'}>${this.prog.p.daily.bonus ? '완료' : '받기'}</button></div>
    </div>`;
  }

  ach() {
    return `<div class="lb-missions">${this.prog.achList().map((a) => `<div class="lb-mission ${a.finished ? 'done' : ''}">
      <div><b>${a.text} ${'●'.repeat(a.claimed)}${'○'.repeat(a.tiers.length - a.claimed)}</b>
      <div class="lb-bar"><i style="width:${Math.min(1, a.prog / a.goal) * 100}%"></i></div>
      <small>${Math.min(a.prog, a.goal)}/${a.goal}${a.finished ? '' : ` · 보상 ${cost(a.reward)}`}</small></div>
      <button data-act="claimA" data-id="${a.id}" ${a.done ? '' : 'disabled'}>${a.finished ? '완료' : '받기'}</button></div>`).join('')}</div>`;
  }

  act(a, d) {
    const pr = this.prog;
    const msgs = { cost: '재화가 부족합니다', enh: '먼저 +5까지 강화하세요', max: '이미 최대입니다' };
    switch (a) {
      case 'pick': this.wKey = d.k; this.slot = null; this.render(); break;
      case 'slot': this.slot = this.slot === d.slot ? null : d.slot; this.render(); break;
      case 'equip': pr.equip(this.wKey, +d.uid); break;
      case 'unequip': pr.unequip(this.wKey, d.slot); break;
      case 'enhance': { const r = pr.enhance(this.wKey); this.flash(r === 'ok' ? '강화 성공!' : msgs[r]); if (r !== 'ok') this.render(); break; }
      case 'gradeup': { const r = pr.gradeUp(this.wKey); this.flash(r === 'ok' ? `${GRADES[pr.p.weapons[this.wKey].grade].name} 등급 달성!` : msgs[r]); if (r !== 'ok') this.render(); break; }
      case 'buy': { const pt = pr.buyPart(d.id, +d.g); this.flash(pt ? `${PARTS[d.id].name} 구매` : msgs.cost); if (!pt) this.render(); break; }
      case 'crate': { const pt = pr.openCrate(); this.flash(pt ? `📦 ${GRADES[pt.grade].name} ${PARTS[pt.id].name} 획득!` : msgs.cost); if (!pt) this.render(); break; }
      case 'free': pr.claimFree(); this.flash(`🪙${ECON.freeDaily.gold} 획득`); break;
      case 'exchange': if (!pr.exchange()) { this.flash(msgs.cost); this.render(); } break;
      case 'claimD': pr.claimDaily(d.id); break;
      case 'bonus': pr.claimDailyBonus(); break;
      case 'claimA': pr.claimAch(d.id); break;
    }
  }
}
