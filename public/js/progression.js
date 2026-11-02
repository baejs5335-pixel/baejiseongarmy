// 육성 · 수집 · 경제
//
// 설계 원칙
//  1) 등급·강화·파츠는 데미지를 올리지 않는다 → 처치 탄수(TTK) 구간이 깨지지 않아 공정성 유지
//     (예: 데미지 +4%만 돼도 AR이 미나(체력 80)를 4발 → 3발에 처치)
//  2) 성장은 편의 성능(반동·장전·정조준·탄창)과 파츠 슬롯, 외형으로 준다 — 모든 효과는 장단점이 있는 선택
//  3) 확률형 상자는 확률을 공개하고 천장(20회째 전설 확정)을 둔다
import { WEAPONS, GUN_ORDER } from './weapons.js';

const KEY = 'ss-profile-v1';

export const GRADES = [
  { name: '일반', color: '#c9d1e0', k: 1.0, slots: 2 },
  { name: '희귀', color: '#4a9dff', k: 1.3, slots: 3 },
  { name: '전설', color: '#ffc933', k: 1.6, slots: 3 },
];
// 전설 무기: 장착한 파츠 효과 +20%
export const LEGEND_PART_BONUS = 1.2;
export const SLOTS = { muzzle: '총구', mag: '탄창', stock: '개머리판' };
export const SLOT_ORDER = ['muzzle', 'mag', 'stock'];
export const MAX_ENH = 5;

// k = 파츠 등급 배율 (일반 1 / 희귀 1.3 / 전설 1.6)
const pct = (v) => `${Math.round(v * 100)}%`;
export const PARTS = {
  suppressor: { slot: 'muzzle', name: '소음기', icon: '🔇',
    desc: (k) => `총성이 작아지고 적이 듣는 거리 45m → ${Math.round(24 / k)}m · 데미지 감쇠 시작 -15%`,
    apply(w, k) { w.suppressed = true; w.hearRadius = 24 / k; w.damage.start *= 0.85; w.damage.end *= 0.9; } },
  compensator: { slot: 'muzzle', name: '보정기', icon: '🎯',
    desc: (k) => `반동 -${pct(0.12 * k)} · 화면 흔들림 +10%`,
    apply(w, k) { w.recoil.scale *= 1 - 0.12 * k; w.shake *= 1.1; } },
  flashhider: { slot: 'muzzle', name: '소염기', icon: '✨',
    desc: (k) => `총구 화염 없음 · 반동 -${pct(0.05 * k)}`,
    apply(w, k) { w.noFlash = true; w.recoil.scale *= 1 - 0.05 * k; } },
  extmag: { slot: 'mag', name: '대용량 탄창', icon: '🧱',
    desc: (k) => `탄창 +${pct(0.3 * k)} · 장전 12% 느림 · 정조준 +0.02초`,
    apply(w, k) { w.mag = Math.round(w.mag * (1 + 0.3 * k)); w.reloadTac *= 1.12; w.reloadEmpty *= 1.12; w.adsTime += 0.02; } },
  quickmag: { slot: 'mag', name: '빠른 교체 탄창', icon: '⚡',
    desc: (k) => `장전 시간 -${pct(0.18 * k)}`,
    apply(w, k) { w.reloadTac *= 1 - 0.18 * k; w.reloadEmpty *= 1 - 0.18 * k; } },
  tacstock: { slot: 'stock', name: '전술 개머리판', icon: '🏃',
    desc: (k) => `정조준 이동 탄퍼짐 -${pct(0.25 * k)} · 이동 속도 +${pct(0.02 * k)}`,
    apply(w, k) { w.ads.move *= 1 - 0.25 * k; w.mobility *= 1 + 0.02 * k; } },
  heavystock: { slot: 'stock', name: '중량 개머리판', icon: '🪨',
    desc: (k) => `반동 -${pct(0.08 * k)} · 이동 속도 -3%`,
    apply(w, k) { w.recoil.scale *= 1 - 0.08 * k; w.mobility *= 0.97; } },
};

// ── 경제 수치 ──────────────────────────────
export const ECON = {
  enhanceCost: (grade, toLv) => ({ gold: 200 * toLv * [1, 2, 4][grade] }),
  gradeUpCost: [{ gold: 3000, gems: 30 }, { gold: 8000, gems: 100 }],
  partPrice: [{ gold: 500 }, { gold: 1500 }, { gems: 300 }],
  crate: { gems: 60, odds: [0.7, 0.25, 0.05], pity: 20 },
  exchange: { gems: 10, gold: 1000 },
  freeDaily: { gold: 200 },
  // 매치 보상: 기본 + 킬당 + 승리 보너스
  match: (win, kills) => ({ xp: 80 + kills * 10 + (win ? 40 : 0), gold: 100 + kills * 15 + (win ? 100 : 0) }),
  xpToNext: (lv) => 150 + lv * 50,
  levelReward: (lv) => (lv % 5 === 0 ? { gold: 1000, gems: 50 } : { gold: 300 + lv * 20, gems: 10 }),
};

export const DAILY_POOL = [
  { id: 'k10', text: '적 10명 처치', goal: 10, ev: 'kill', reward: { gold: 300 } },
  { id: 'hs5', text: '헤드샷으로 5명 처치', goal: 5, ev: 'kill', f: (e) => e.head, reward: { gold: 300, gems: 5 } },
  { id: 'win1', text: '매치 1회 승리', goal: 1, ev: 'match', f: (e) => e.win, reward: { gems: 10 } },
  { id: 'play3', text: '매치 3판 완료', goal: 3, ev: 'match', reward: { gold: 400 } },
  { id: 'kn3', text: '칼로 3명 처치', goal: 3, ev: 'kill', f: (e) => e.w.melee, reward: { gold: 300, gems: 5 } },
  { id: 'sr5', text: '저격소총으로 5명 처치', goal: 5, ev: 'kill', f: (e) => e.w.key === 'SR', reward: { gold: 350 } },
  { id: 'smg8', text: '기관단총으로 8명 처치', goal: 8, ev: 'kill', f: (e) => e.w.key === 'SMG', reward: { gold: 300 } },
  { id: 'cr2', text: '앉은 상태로 2명 처치', goal: 2, ev: 'kill', f: (e) => e.crouched, reward: { gold: 250 } },
  { id: 'multi1', text: '더블 킬 1회', goal: 1, ev: 'multi', reward: { gems: 10 } },
];
export const DAILY_BONUS = { gems: 20 };

export const ACHIEVEMENTS = [
  { id: 'kills', text: '누적 처치', ev: 'kill', tiers: [50, 200, 1000], rewards: [{ gold: 1000 }, { gems: 50 }, { gems: 150 }] },
  { id: 'heads', text: '누적 헤드샷 처치', ev: 'kill', f: (e) => e.head, tiers: [20, 100, 500], rewards: [{ gold: 800 }, { gems: 40 }, { gems: 120 }] },
  { id: 'wins', text: '누적 승리', ev: 'match', f: (e) => e.win, tiers: [1, 10, 50], rewards: [{ gold: 500 }, { gems: 50 }, { gems: 150 }] },
  { id: 'knife', text: '칼 처치', ev: 'kill', f: (e) => e.w.melee, tiers: [10, 50], rewards: [{ gold: 800 }, { gems: 60 }] },
  { id: 'legend', text: '전설 무기 보유', ev: 'legend', tiers: [1, 3], rewards: [{ gems: 50 }, { gems: 150 }] },
  { id: 'level', text: '계정 레벨', ev: 'level', tiers: [5, 10, 20], rewards: [{ gold: 2000 }, { gems: 100 }, { gems: 300 }] },
];

const today = () => new Date().toISOString().slice(0, 10);
// 날짜로 정해지는 의사 난수 → 같은 날엔 같은 미션
function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

function fresh() {
  const weapons = {};
  for (const k of GUN_ORDER) weapons[k] = { grade: 0, enh: 0, parts: {} };
  return {
    v: 1, level: 1, xp: 0, gold: 1500, gems: 50, pity: 0, nextUid: 3,
    weapons,
    parts: [{ uid: 1, id: 'flashhider', grade: 0 }, { uid: 2, id: 'extmag', grade: 0 }], // 시작 지급
    daily: null,
    ach: { prog: {}, claimed: {} },
  };
}

export class Progression {
  constructor() {
    try { this.p = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { this.p = fresh(); }
    for (const k of GUN_ORDER) this.p.weapons[k] ||= { grade: 0, enh: 0, parts: {} };
    // 없어진 파츠(손잡이 등) 정리
    this.p.parts = this.p.parts.filter((x) => PARTS[x.id]);
    for (const k of GUN_ORDER) {
      const ps = this.p.weapons[k].parts;
      for (const slot in ps) if (!SLOTS[slot] || !this.part(ps[slot])) delete ps[slot];
    }
    this.listeners = new Set();
    this.toast = null;
    this.rollDaily();
  }

  onChange(fn) { this.listeners.add(fn); }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.p)); } catch { /* 무시 */ }
    for (const fn of this.listeners) fn();
  }

  // ── 재화 ────────────────────────────────
  canPay(cost) { return (cost.gold || 0) <= this.p.gold && (cost.gems || 0) <= this.p.gems; }
  pay(cost) {
    if (!this.canPay(cost)) return false;
    this.p.gold -= cost.gold || 0;
    this.p.gems -= cost.gems || 0;
    return true;
  }
  give(r) {
    this.p.gold += r.gold || 0;
    this.p.gems += r.gems || 0;
  }

  // ── 무기 ────────────────────────────────
  part(uid) { return this.p.parts.find((x) => x.uid === uid); }

  effective(k) {
    const base = WEAPONS[k];
    if (base.melee || !this.p.weapons[k]) return base;
    const st = this.p.weapons[k];
    const w = structuredClone(base);
    w.grade = st.grade;
    w.enh = st.enh;
    w.hearRadius = 45;
    // 강화: 단계마다 반동 -2%, 장전 -1.5%
    w.recoil.scale *= 1 - 0.02 * st.enh;
    w.reloadTac *= 1 - 0.015 * st.enh;
    w.reloadEmpty *= 1 - 0.015 * st.enh;
    for (const slot of SLOT_ORDER) {
      const pt = this.part(st.parts[slot]);
      if (pt) PARTS[pt.id].apply(w, GRADES[pt.grade].k * (st.grade === 2 ? LEGEND_PART_BONUS : 1));
    }
    if (w.suppressed) w.sfx = { ...w.sfx, cut: w.sfx.cut * 0.4, gain: w.sfx.gain * 0.45, thump: w.sfx.thump * 0.5 };
    return w;
  }

  enhance(k) {
    const st = this.p.weapons[k];
    if (st.enh >= MAX_ENH) return 'max';
    if (!this.pay(ECON.enhanceCost(st.grade, st.enh + 1))) return 'cost';
    st.enh++;
    this.save();
    return 'ok';
  }

  gradeUp(k) {
    const st = this.p.weapons[k];
    if (st.grade >= 2) return 'max';
    if (st.enh < MAX_ENH) return 'enh';
    if (!this.pay(ECON.gradeUpCost[st.grade])) return 'cost';
    st.grade++;
    st.enh = 0;
    this.event('legend', {}, GUN_ORDER.filter((x) => this.p.weapons[x].grade === 2).length, true);
    this.save();
    return 'ok';
  }

  slotsOpen(k) { return GRADES[this.p.weapons[k].grade].slots; }

  equip(k, uid) {
    const pt = this.part(uid), slot = PARTS[pt.id].slot;
    if (SLOT_ORDER.indexOf(slot) >= this.slotsOpen(k)) return false;
    // 다른 무기에 끼워져 있으면 빼서 옮김
    for (const x of GUN_ORDER) if (this.p.weapons[x].parts[PARTS[pt.id].slot] === uid) delete this.p.weapons[x].parts[slot];
    this.p.weapons[k].parts[slot] = uid;
    this.save();
    return true;
  }

  unequip(k, slot) {
    delete this.p.weapons[k].parts[slot];
    this.save();
  }

  equippedOn(uid) {
    return GUN_ORDER.find((k) => Object.values(this.p.weapons[k].parts).includes(uid));
  }

  addPart(id, grade) {
    const pt = { uid: this.p.nextUid++, id, grade };
    this.p.parts.push(pt);
    return pt;
  }

  // ── 상점 ────────────────────────────────
  buyPart(id, grade) {
    if (!this.pay(ECON.partPrice[grade])) return null;
    const pt = this.addPart(id, grade);
    this.save();
    return pt;
  }

  // 보급 상자: 일반 70% / 희귀 25% / 전설 5%, 20회째 전설 확정(천장)
  openCrate() {
    if (!this.pay({ gems: ECON.crate.gems })) return null;
    this.p.pity++;
    let grade;
    if (this.p.pity >= ECON.crate.pity) grade = 2;
    else {
      const r = Math.random(), [c, rare] = ECON.crate.odds;
      grade = r < c ? 0 : r < c + rare ? 1 : 2;
    }
    if (grade === 2) this.p.pity = 0;
    const ids = Object.keys(PARTS);
    const pt = this.addPart(ids[(Math.random() * ids.length) | 0], grade);
    this.save();
    return pt;
  }

  exchange() {
    if (!this.pay({ gems: ECON.exchange.gems })) return false;
    this.give({ gold: ECON.exchange.gold });
    this.save();
    return true;
  }

  claimFree() {
    if (this.p.daily.free) return false;
    this.p.daily.free = true;
    this.give(ECON.freeDaily);
    this.save();
    return true;
  }

  // ── 레벨 ────────────────────────────────
  addXp(xp) {
    const ups = [];
    this.p.xp += xp;
    while (this.p.xp >= ECON.xpToNext(this.p.level)) {
      this.p.xp -= ECON.xpToNext(this.p.level);
      this.p.level++;
      const r = ECON.levelReward(this.p.level);
      this.give(r);
      ups.push({ level: this.p.level, reward: r });
    }
    if (ups.length) this.event('level', {}, this.p.level, true);
    return ups;
  }

  // ── 일일 미션 / 업적 ────────────────────
  rollDaily() {
    const d = today();
    if (this.p.daily?.date === d) return;
    const rnd = seeded(d);
    const pool = [...DAILY_POOL];
    const ids = [];
    while (ids.length < 3) ids.push(pool.splice((rnd() * pool.length) | 0, 1)[0].id);
    this.p.daily = { date: d, ids, prog: {}, claimed: {}, bonus: false, free: false };
    this.save();
  }

  dailyList() {
    this.rollDaily();
    const D = this.p.daily;
    return D.ids.map((id) => {
      const m = DAILY_POOL.find((x) => x.id === id);
      const prog = Math.min(m.goal, D.prog[id] || 0);
      return { ...m, prog, done: prog >= m.goal, claimed: !!D.claimed[id] };
    });
  }

  claimDaily(id) {
    const m = this.dailyList().find((x) => x.id === id);
    if (!m?.done || m.claimed) return false;
    this.p.daily.claimed[id] = true;
    this.give(m.reward);
    this.save();
    return true;
  }

  claimDailyBonus() {
    const all = this.dailyList().every((m) => m.claimed);
    if (!all || this.p.daily.bonus) return false;
    this.p.daily.bonus = true;
    this.give(DAILY_BONUS);
    this.save();
    return true;
  }

  achList() {
    return ACHIEVEMENTS.map((a) => {
      const prog = this.p.ach.prog[a.id] || 0, claimed = this.p.ach.claimed[a.id] || 0;
      const tier = Math.min(claimed, a.tiers.length - 1);
      return { ...a, prog, claimed, goal: a.tiers[tier], reward: a.rewards[tier], done: claimed < a.tiers.length && prog >= a.tiers[claimed], finished: claimed >= a.tiers.length };
    });
  }

  claimAch(id) {
    const a = this.achList().find((x) => x.id === id);
    if (!a?.done) return false;
    this.p.ach.claimed[id] = a.claimed + 1;
    this.give(a.reward);
    this.save();
    return true;
  }

  // 게임 이벤트 → 미션·업적 진행. abs = 누적값을 그대로 설정 (레벨, 전설 개수)
  event(ev, data = {}, amount = 1, abs = false) {
    this.rollDaily();
    const D = this.p.daily;
    for (const id of D.ids) {
      const m = DAILY_POOL.find((x) => x.id === id);
      if (m.ev !== ev || (m.f && !m.f(data))) continue;
      const before = D.prog[id] || 0;
      D.prog[id] = abs ? amount : before + amount;
      if (before < m.goal && D.prog[id] >= m.goal) this.toast?.(`일일 미션 완료: ${m.text}`);
    }
    for (const a of ACHIEVEMENTS) {
      if (a.ev !== ev || (a.f && !a.f(data))) continue;
      const before = this.p.ach.prog[a.id] || 0;
      const now = abs ? Math.max(before, amount) : before + amount;
      this.p.ach.prog[a.id] = now;
      const t = a.tiers.find((x) => before < x && now >= x);
      if (t) this.toast?.(`업적 달성: ${a.text} ${t}`);
    }
    this.save();
  }

  // 매치 종료 보상
  finishMatch(win, kills) {
    const r = ECON.match(win, kills);
    this.give({ gold: r.gold });
    const ups = this.addXp(r.xp);
    this.event('match', { win });
    this.save();
    // gained = 이번 매치 획득 XP / xp = 현재 레벨 진행도
    return { gained: r.xp, gold: r.gold, ups, level: this.p.level, xp: this.p.xp, next: ECON.xpToNext(this.p.level) };
  }

  claimable() {
    return this.dailyList().filter((m) => m.done && !m.claimed).length + this.achList().filter((a) => a.done).length
      + (!this.p.daily.free ? 1 : 0);
  }
}
