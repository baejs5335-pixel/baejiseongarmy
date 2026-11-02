# 녹음 음성 팩 (선택)

이 폴더에 `pack.json`과 음성 파일(mp3/ogg/wav)을 넣으면 브라우저 음성 합성 대신 녹음 음성을 재생합니다.
아군 대사에는 무전기 음질 필터와 잡음이 자동으로 붙습니다. `pack.json`이 없으면 기기의 한국어 음성 합성을 씁니다.

```json
{
  "m": { "reload": ["m/reload_1.mp3", "m/reload_2.mp3"], "spotted": ["m/spotted_1.mp3"] },
  "f": { "reload": ["f/reload_1.mp3"] },
  "announcer": { "start": ["a/start.mp3"], "win": ["a/win.mp3"] }
}
```

- `m` = 남성 캐릭터 (레오·브루노·스파크), `f` = 여성 캐릭터 (미나·유키), `announcer` = 작전 본부
- 대사 키: reload, spotted, kill, headshot, knife, hurt, lowhp, allyDown, respawn, bombPlanted, bombDefused, start, tenSec, multi2, multi3, multi4, win, lose, draw
- 한 키에 파일을 여러 개 넣으면 무작위로 골라 재생합니다. 없는 키는 음성 합성으로 대체합니다.
