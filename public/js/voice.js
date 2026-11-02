// 보이스 피드백: 브라우저 음성 합성(ko-KR) + 자막. 캐릭터마다 목소리 높이/속도가 다릅니다.
// 같은 대사는 쿨다운 동안 반복하지 않고, 중요한 대사(priority)는 말하던 것을 끊고 바로 재생합니다.
import { config as cfg } from './config.js';

export const LINES = {
  reload:   ['탄창 교체!', '재장전!', '장전 중, 엄호 바람!'],
  spotted:  ['적 발견!', '적이다!', '전방에 적!'],
  kill:     ['적 처치!', '하나 잡았다!', '제압 완료!'],
  headshot: ['헤드샷!'],
  knife:    ['칼로 끝냈다!'],
  hurt:     ['윽!', '맞았다!'],
  lowhp:    ['지원 필요!', '체력이 얼마 없어!'],
  allyDown: ['아군이 쓰러졌다!'],
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

export const ANNOUNCER = { name: '작전 본부', team: 'sys', voice: { pitch: 0.8, rate: 1.0 } };

export class Voice {
  constructor() {
    this.sub = document.getElementById('voice-sub');
    this.cool = {};
    this.synth = window.speechSynthesis;
    const pick = () => {
      const vs = this.synth?.getVoices() || [];
      this.ko = vs.find((v) => v.lang?.toLowerCase().startsWith('ko')) || null;
    };
    pick();
    this.synth?.addEventListener?.('voiceschanged', pick);
  }

  // speaker: { name, team, voice: { pitch, rate } }
  say(key, speaker, { cooldown = 4, priority = false } = {}) {
    if (!cfg.voiceOn) return false;
    const now = performance.now() / 1000;
    if ((this.cool[key] || 0) > now) return false;
    this.cool[key] = now + cooldown;
    const list = LINES[key];
    const text = list[(Math.random() * list.length) | 0];
    if (cfg.subtitles) this.subtitle(speaker, text);
    if (this.synth && cfg.voiceVolume > 0) {
      if (priority) this.synth.cancel();
      else if (this.synth.pending) return true; // 대사가 밀리면 자막만
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (this.ko) u.voice = this.ko;
      u.pitch = speaker.voice?.pitch ?? 1;
      u.rate = speaker.voice?.rate ?? 1.1;
      u.volume = Math.min(1, cfg.voiceVolume * cfg.volume * 1.4);
      this.synth.speak(u);
    }
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
