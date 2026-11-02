// 꾸미기(치장): 능력치에는 영향 없음. 상점 구매 또는 레벨·업적 해금.
//  총기 스킨(무기별) · 킬 연출 · 의상(캐릭터별) · 장갑 · 악세서리(캐릭터별) · 킬마크 · 칭호 · 프로필 테두리 · 닉네임
import * as THREE from 'three';

// rarity: 0 일반 / 1 희귀 / 2 전설 (등급 색은 progression.GRADES와 동일)
export const RARITY = [{ name: '일반', color: '#c9d1e0' }, { name: '희귀', color: '#4a9dff' }, { name: '전설', color: '#ffc933' }];

export const CATS = {
  gunSkin: '총기 스킨', killFx: '킬 연출', outfit: '의상', glove: '장갑', accessory: '악세서리',
  killmark: '킬마크', title: '칭호', frame: '프로필 테두리',
};

// unlock: { level: n } 또는 { ach: id, tier: n } — 상점 판매 없이 달성으로만 획득
export const ITEMS = {
  gunSkin: {
    default: { name: '기본', rarity: 0, free: true },
    desert: { name: '사막 위장', rarity: 0, price: { gold: 1500 }, pattern: 'camo', colors: ['#c8a46a', '#a8844a', '#e2c690', '#7a5a2a'] },
    forest: { name: '숲 위장', rarity: 0, price: { gold: 1500 }, pattern: 'camo', colors: ['#5a7d43', '#3e5a2e', '#7f9a5a', '#2c3a22'] },
    urban: { name: '도시 디지털', rarity: 1, price: { gold: 4000 }, pattern: 'digital', colors: ['#5c6680', '#8a93a8', '#3a3f4b', '#b8c0d0'] },
    tiger: { name: '호랑이', rarity: 1, price: { gold: 4000 }, pattern: 'stripes', colors: ['#f08a2e', '#1b1d2a'] },
    candy: { name: '캔디 팝', rarity: 1, price: { gold: 4000 }, pattern: 'dots', colors: ['#ff8fb8', '#8ff0d8', '#fff2a0'] },
    gold: { name: '황금', rarity: 2, price: { gems: 250 }, body: 0xd4a83a, accent: 0xfff0a0, emissive: 0x3a2800 },
    neon: { name: '네온 펄스', rarity: 2, price: { gems: 300 }, body: 0x1a1a2e, accent: 0x39ffe0, anim: 'pulse' },
    rainbow: { name: '레인보우', rarity: 2, price: { gems: 300 }, body: 0x2a2d36, anim: 'hue' },
    lava: { name: '용암 흐름', rarity: 2, price: { gems: 350 }, pattern: 'lava', anim: 'scroll' },
  },
  killFx: {
    none: { name: '기본', rarity: 0, free: true, icon: '💨' },
    confetti: { name: '축하 꽃가루', rarity: 0, price: { gold: 2000 }, icon: '🎉' },
    hearts: { name: '하트 뿅뿅', rarity: 1, price: { gems: 120 }, icon: '💖' },
    flame: { name: '화염 폭발', rarity: 1, price: { gems: 150 }, icon: '🔥' },
    stars: { name: '별빛', rarity: 1, price: { gems: 150 }, icon: '✨' },
    pixel: { name: '픽셀 분해', rarity: 2, price: { gems: 250 }, icon: '🟩' },
    lightning: { name: '낙뢰', rarity: 2, price: { gems: 300 }, icon: '⚡' },
  },
  outfit: {
    default: { name: '기본 전투복', rarity: 0, free: true },
    blackops: { name: '블랙옵스', rarity: 0, price: { gold: 2000 }, color: 0x2a2d36 },
    arctic: { name: '설원', rarity: 0, price: { gold: 2000 }, color: 0xe8eef5 },
    navy: { name: '해군', rarity: 0, price: { gold: 2000 }, color: 0x2c4a7a },
    sakura: { name: '벚꽃', rarity: 1, price: { gold: 4000 }, color: 0xff9fc4 },
    camo: { name: '정글 위장복', rarity: 1, price: { gold: 4000 }, color: 0x5a7d43, pattern: 'camo', colors: ['#5a7d43', '#3e5a2e', '#7f9a5a', '#2c3a22'] },
    goldsuit: { name: '골든 수트', rarity: 2, price: { gems: 200 }, color: 0xd4a83a, emissive: 0x3a2800 },
  },
  glove: {
    default: { name: '전술 장갑', rarity: 0, free: true, color: 0x2a2d36 },
    tan: { name: '사막 장갑', rarity: 0, price: { gold: 800 }, color: 0xc8a46a },
    red: { name: '레드 장갑', rarity: 0, price: { gold: 800 }, color: 0xd64a3d },
    white: { name: '화이트 장갑', rarity: 0, price: { gold: 800 }, color: 0xf0f0f0 },
    neon: { name: '네온 장갑', rarity: 1, price: { gems: 100 }, color: 0x39ff6a, emissive: 0x0f5020 },
    gold: { name: '황금 장갑', rarity: 2, price: { gems: 150 }, color: 0xffc933, emissive: 0x3a2800 },
  },
  accessory: {
    none: { name: '없음', rarity: 0, free: true },
    shades: { name: '선글라스', rarity: 0, price: { gold: 1500 } },
    headset: { name: '헤드셋', rarity: 0, price: { gold: 1500 } },
    bandana: { name: '두건 마스크', rarity: 1, price: { gold: 3000 } },
    catears: { name: '고양이 귀', rarity: 1, price: { gems: 150 } },
    crown: { name: '왕관', rarity: 2, price: { gems: 300 } },
    halo: { name: '천사 고리', rarity: 2, price: { gems: 300 } },
  },
  killmark: {
    skull: { name: '해골', rarity: 0, free: true, icon: '💀' },
    star: { name: '별', rarity: 0, price: { gold: 1000 }, icon: '⭐' },
    fire: { name: '불꽃', rarity: 0, price: { gold: 1500 }, icon: '🔥' },
    bolt: { name: '번개', rarity: 1, price: { gold: 1500 }, icon: '⚡' },
    target: { name: '과녁', rarity: 1, price: { gems: 100 }, icon: '🎯' },
    crown: { name: '왕관', rarity: 2, price: { gems: 200 }, icon: '👑' },
    tiger: { name: '호랑이', rarity: 2, price: { gems: 200 }, icon: '🐯' },
    eagle: { name: '독수리', rarity: 2, price: { gems: 250 }, icon: '🦅' },
  },
  title: {
    recruit: { name: '신병', rarity: 0, free: true },
    marksman: { name: '명사수', rarity: 1, unlock: { ach: 'heads', tier: 1 } },
    blade: { name: '칼잡이', rarity: 1, unlock: { ach: 'knife', tier: 1 } },
    veteran: { name: '베테랑', rarity: 1, unlock: { level: 10 } },
    warhorse: { name: '백전노장', rarity: 2, unlock: { ach: 'wins', tier: 2 } },
    collector: { name: '전설 수집가', rarity: 2, unlock: { ach: 'legend', tier: 1 } },
    special: { name: '스페셜 솔져', rarity: 2, unlock: { level: 20 } },
    party: { name: '파티 피플', rarity: 1, price: { gems: 100 } },
    assassin: { name: '조용한 암살자', rarity: 1, price: { gems: 150 } },
  },
  frame: {
    basic: { name: '기본', rarity: 0, free: true },
    bronze: { name: '브론즈', rarity: 0, unlock: { level: 3 } },
    silver: { name: '실버', rarity: 0, unlock: { level: 5 } },
    gold: { name: '골드', rarity: 1, unlock: { level: 10 } },
    diamond: { name: '다이아', rarity: 2, unlock: { level: 20 } },
    rainbow: { name: '무지개', rarity: 2, unlock: { ach: 'kills', tier: 2 } },
    flame: { name: '불꽃', rarity: 2, price: { gems: 200 } },
    neon: { name: '네온', rarity: 2, price: { gems: 250 } },
  },
};

const DEFAULT_EQUIP = { gunSkin: {}, killFx: 'none', outfit: {}, glove: 'default', accessory: {}, killmark: 'skull', title: 'recruit', frame: 'basic' };
// 무기별 / 캐릭터별로 장착하는 분류
export const PER = { gunSkin: 'weapon', outfit: 'char', accessory: 'char' };

export class Cosmetics {
  constructor(prog) {
    this.prog = prog;
    const p = prog.p;
    p.cos ||= { owned: [], equip: structuredClone(DEFAULT_EQUIP), nick: '' };
    for (const k in DEFAULT_EQUIP) if (p.cos.equip[k] === undefined) p.cos.equip[k] = structuredClone(DEFAULT_EQUIP[k]);
  }

  get c() { return this.prog.p.cos; }
  item(cat, id) { return ITEMS[cat][id]; }
  key(cat, id) { return `${cat}:${id}`; }

  // 해금 조건 문구 / 달성 여부
  unlockText(u) {
    if (u.level) return `레벨 ${u.level} 달성`;
    const names = { heads: '헤드샷 처치', knife: '칼 처치', wins: '승리', legend: '전설 무기 보유', kills: '누적 처치' };
    return `업적 "${names[u.ach]}" ${u.tier}단계`;
  }
  unlockMet(u) {
    const p = this.prog.p;
    if (u.level) return p.level >= u.level;
    return (p.ach.claimed[u.ach] || 0) >= u.tier || this.achTierReached(u.ach) >= u.tier;
  }
  achTierReached(id) {
    const a = this.prog.achList().find((x) => x.id === id);
    return a ? a.tiers.filter((t) => a.prog >= t).length : 0;
  }

  owns(cat, id) {
    const it = this.item(cat, id);
    if (!it) return false;
    if (it.free) return true;
    if (it.unlock) return this.unlockMet(it.unlock);
    return this.c.owned.includes(this.key(cat, id));
  }

  buy(cat, id) {
    const it = this.item(cat, id);
    if (!it?.price || this.owns(cat, id)) return 'no';
    if (!this.prog.pay(it.price)) return 'cost';
    this.c.owned.push(this.key(cat, id));
    this.prog.save();
    return 'ok';
  }

  // slot: 무기 키(총기 스킨) 또는 캐릭터 id(의상·악세서리)
  equipped(cat, slot) {
    const e = this.c.equip[cat];
    if (PER[cat]) return e[slot] || Object.keys(ITEMS[cat])[0];
    return e;
  }

  equip(cat, id, slot) {
    if (!this.owns(cat, id)) return false;
    if (PER[cat]) this.c.equip[cat][slot] = id;
    else this.c.equip[cat] = id;
    this.prog.save();
    return true;
  }

  get nick() { return this.c.nick || '병사'; }
  setNick(n) {
    this.c.nick = n.replace(/[<>&"']/g, '').trim().slice(0, 10);
    this.prog.save();
  }

  // 캐릭터 외형 (의상·악세서리)
  look(charId) {
    return { outfit: ITEMS.outfit[this.equipped('outfit', charId)], accessory: this.equipped('accessory', charId) };
  }
}

// ── 패턴 텍스처 (캔버스로 생성, 스킨·의상 공용) ─────────────
const texCache = {};
export function patternTexture(kind, colors) {
  const key = kind + colors.join();
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = colors[0];
  g.fillRect(0, 0, 64, 64);
  if (kind === 'camo') {
    for (let i = 0; i < 26; i++) {
      g.fillStyle = colors[1 + (i % (colors.length - 1))];
      g.beginPath();
      g.ellipse(rnd() * 64, rnd() * 64, 5 + rnd() * 10, 3 + rnd() * 7, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'digital') {
    for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) {
      if (rnd() < 0.5) continue;
      g.fillStyle = colors[1 + ((rnd() * (colors.length - 1)) | 0)];
      g.fillRect(x, y, 4, 4);
    }
  } else if (kind === 'stripes') {
    g.fillStyle = colors[1];
    for (let i = -64; i < 128; i += 16) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 6 + rnd() * 4, 0); g.lineTo(i + 30, 64); g.lineTo(i + 24, 64);
      g.fill();
    }
  } else if (kind === 'dots') {
    for (let i = 0; i < 30; i++) {
      g.fillStyle = colors[1 + (i % (colors.length - 1))];
      g.beginPath();
      g.arc(rnd() * 64, rnd() * 64, 2 + rnd() * 4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'lava') {
    g.fillStyle = '#1a0d08';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#ff6a1a';
    g.shadowColor = '#ffb02e';
    g.shadowBlur = 6;
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      let x = rnd() * 64, y = rnd() * 64;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  texCache[key] = t;
  return t;
}

export function skinTexture(skin) {
  if (skin.pattern === 'lava') return patternTexture('lava', ['#1a0d08']);
  return skin.pattern ? patternTexture(skin.pattern, skin.colors) : null;
}

// ── 프로필 표시 (아바타 + 테두리 + 닉네임 + 칭호) ────────────
const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');
// size: 'mini'(스코어보드 한 줄) | 'card'(병영·결과 화면)
export function profileHTML(cos, char, size = 'mini') {
  const title = ITEMS.title[cos.c.equip.title]?.name || '신병';
  const frame = cos.c.equip.frame || 'basic';
  const av = `<i class="av fr-${frame}" style="--c:${hexCss(char.color)}"><b>${char.name[0]}</b></i>`;
  if (size === 'mini') return `<span class="pf">${av}<b>${cos.nick}</b><small class="ttl">${title}</small></span>`;
  const mark = ITEMS.killmark[cos.c.equip.killmark];
  return `<div class="pf-card">${av}<div><b>${cos.nick}</b><small class="ttl">${title}</small></div><span class="km r${mark.rarity}">${mark.icon}</span></div>`;
}

// 꾸미기 목록 미리보기 (스와치)
const ACC_ICON = { none: '✖', shades: '🕶️', headset: '🎧', bandana: '🥷', catears: '🐱', crown: '👑', halo: '😇' };
export function swatchHTML(cat, id, it) {
  if (cat === 'gunSkin' || cat === 'outfit') {
    if (it.pattern) {
      const tex = it.pattern === 'lava' ? patternTexture('lava', ['#1a0d08']) : patternTexture(it.pattern, it.colors);
      return `<i class="sw-img ${it.anim ? 'anim-' + it.anim : ''}" style="background-image:url(${tex.image.toDataURL()})"></i>`;
    }
    const a = hexCss(it.body ?? it.color ?? 0x3a3f4b), b = hexCss(it.accent ?? it.body ?? it.color ?? 0xf08a2e);
    return `<i class="sw-img ${it.anim ? 'anim-' + it.anim : ''}" style="background:linear-gradient(135deg, ${a} 55%, ${b} 55%)"></i>`;
  }
  if (cat === 'glove') return `<i class="sw-img round" style="background:${hexCss(it.color)};${it.emissive ? 'box-shadow:0 0 10px ' + hexCss(it.color) : ''}"></i>`;
  if (cat === 'accessory') return `<i class="sw-icon">${ACC_ICON[id]}</i>`;
  if (cat === 'killFx') return `<i class="sw-icon">${it.icon}</i>`;
  if (cat === 'killmark') return `<span class="km r${it.rarity}">${it.icon}</span>`;
  if (cat === 'title') return `<i class="sw-title">${it.name}</i>`;
  if (cat === 'frame') return `<i class="av fr-${id}" style="--c:#3d7fd6"><b>★</b></i>`;
  return '';
}
