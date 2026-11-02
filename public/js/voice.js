// 보이스 피드백: 기기에 설치된 한국어 음성 중 가장 자연스러운 것을 골라 남/여 캐릭터에 따로 배정하고,
// 높낮이는 자연스러운 범위(±15%)에서만 바꿉니다. 아군 무전에는 무전기 잡음(스켈치)을 붙입니다.
// 같은 대사는 쿨다운 동안 반복하지 않고, 중요한 대사(priority)는 말하던 것을 끊고 바로 재생합니다.
import { config as cfg } from './config.js';

export const LINES = {
  reload:   ['탄창 교체!', '장전 중, 엄호 부탁해!', '재장전!'],
  spotted:  ['적 발견!', '전방에 적!', '적이다, 조심해!'],
  kill:     ['적 하나 처치!', '처리했다!', '제압 완료!'],
  headshot: ['헤드샷!', '머리 정확히 맞췄다!'],
  knife:    ['칼로 끝냈다!'],
  hurt:     ['윽!', '맞았다!'],
  lowhp:    ['지원 필요!', '부상이다, 엄호해 줘!'],
  allyDown: ['아군이 쓰러졌다!', '한 명 당했다!'],
  respawn:  ['다시 간다!', '복귀한다!'],
  bombPlanted: ['폭탄 설치 완료!'],
  bombDefused: ['폭탄 해체 완료!'],
  // 아나운서
  start:    ['작전 개시!'],
  tenSec:   ['10초 남았습니다!'],
  multi2:   ['더블 킬!'],
  multi3:   ['트리플 킬!'],
  multi4:   ['쿼드라 킬!'],
  win:      ['승리!'],
  lose:     ['패배.'],
  draw:     ['무승부.'],
};

export const LINE_LABELS = {
  reload: '재장전', spotted: '적 발견', kill: '처치', headshot: '헤드샷', lowhp: '체력 위험',
  allyDown: '아군 사망', bombPlanted: '폭탄 설치', bombDefused: '폭탄 해체', start: '작전 개시', multi2: '더블 킬',
};

export const ANNOUNCER = { name: '작전 본부', team: 'sys', voice: { g: 'm', pitch: 0.92, rate: 1.0 } };

// 음성 이름으로 성별·품질 추정 (Edge/Windows: SunHi·InJoon Natural, Android: Google, iOS: Yuna 등)
const FEMALE = /sunhi|yuna|heami|jimin|seohyeon|sora|yujin|sora|female|여성|google/i;
const MALE = /injoon|hyunsu|bongjin|gookmin|minsu|male|남성/i;
const quality = (v) => (/natural|neural|premium|enhanced/i.test(v.name) ? 4 : 0) + (/online/i.test(v.name) ? 2 : 0)
  + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);

export class Voice {
  constructor(sfx) {
    this.sfx = sfx;
    this.sub = document.getElementById('voice-sub');
    this.cool = {};
    this.synth = window.speechSynthesis;
    this.pick();
    this.synth?.addEventListener?.('voiceschanged', () => this.pick());
    this.loadPack();
  }

  // 녹음 음성 팩 (선택): public/voice/pack.json 이 있으면 음성 합성 대신 녹음 파일을 재생
  //   { "m": { "reload": ["m/reload_1.mp3", ...], ... }, "f": { ... }, "announcer": { "start": ["a/start.mp3"] } }
  async loadPack() {
    try {
      const r = await fetch('voice/pack.json', { cache: 'no-store' });
      if (r.ok) this.pack = await r.json();
    } catch { /* 팩 없음 → 음성 합성 */ }
  }

  packFile(key, speaker) {
    const set = this.pack?.[speaker.team === 'sys' ? 'announcer' : speaker.voice?.g || 'm']?.[key];
    return set?.length ? 'voice/' + set[(Math.random() * set.length) | 0] : null;
  }

  pick() {
    const ko = (this.synth?.getVoices() || []).filter((v) => v.lang?.toLowerCase().startsWith('ko'));
    const best = (list) => list.sort((a, b) => quality(b) - quality(a))[0] || null;
    const male = best(ko.filter((v) => MALE.test(v.name)));
    const female = best(ko.filter((v) => FEMALE.test(v.name) && !MALE.test(v.name)));
    const any = best([...ko]);
    this.voices = { m: male || any, f: female || any };
    // 남성 음성이 없어 여성 음성으로 대신하면 살짝 낮춤
    this.fallbackM = !male && !!any;
  }

  describe() {
    if (this.pack) return '녹음 음성 팩 사용 중 (voice/pack.json)';
    if (!this.synth) return '이 브라우저는 음성 합성을 지원하지 않습니다 (자막만 표시)';
    const { m, f } = this.voices;
    if (!m && !f) return '한국어 음성이 없습니다 (자막만 표시). 기기 설정에서 한국어 음성을 설치하세요';
    return `남성: ${m?.name || '-'}${this.fallbackM ? ' (대체)' : ''} / 여성: ${f?.name || '-'}`;
  }

  // speaker: { name, team, voice: { g: 'm'|'f', pitch, rate } }, radio: 아군 무전 잡음
  say(key, speaker, { cooldown = 4, priority = false, radio = false } = {}) {
    if (!cfg.voiceOn) return false;
    const now = performance.now() / 1000;
    if ((this.cool[key] || 0) > now) return false;
    this.cool[key] = now + cooldown;
    const list = LINES[key];
    const text = list[(Math.random() * list.length) | 0];
    if (cfg.subtitles) this.subtitle(speaker, text);
    if (cfg.voiceVolume <= 0) return true;
    const file = this.packFile(key, speaker);
    if (file && this.sfx) {
      this.sfx.playFile(file, { radio, gain: cfg.voiceVolume * 1.2 });
      return true;
    }
    if (!this.synth) return true;
    if (priority) this.synth.cancel();
    else if (this.synth.pending) return true; // 대사가 밀리면 자막만
    const sv = speaker.voice || {};
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    const v = this.voices[sv.g || 'm'];
    if (v) u.voice = v;
    const pitch = (sv.pitch ?? 1) * (sv.g === 'm' && this.fallbackM ? 0.82 : 1);
    u.pitch = Math.min(1.2, Math.max(0.7, pitch));
    u.rate = Math.min(1.4, Math.max(0.85, sv.rate ?? 1.1));
    u.volume = Math.min(1, cfg.voiceVolume * cfg.volume * 1.4);
    if (radio) {
      this.sfx?.radio(true);
      u.onend = () => this.sfx?.radio(false);
    }
    this.synth.speak(u);
    return true;
  }

  subtitle(speaker, text) {
    const row = document.createElement('div');
    row.className = `vs-${speaker.team}`;
    row.innerHTML = `<b>${speaker.name}</b> ${text}`;
    this.sub.appendChild(row);
    while (this.sub.children.length > 3) this.sub.firstChild.remove();
    setTimeout(() => row.remove(), 2200);
  }
}
