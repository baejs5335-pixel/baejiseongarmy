# 스페셜 솔져 — 1단계: 조작감 & 타격감 프로토타입

## 실행
```
node server.js
```
- PC: http://localhost:5173
- 폰: 같은 Wi-Fi에서 콘솔에 표시되는 `http://192.168.x.x:5173` 접속 → 가로 모드

## 배포 (Cloudflare Pages + GitHub)
빌드 과정 없는 정적 사이트입니다. Cloudflare 대시보드 → Workers & Pages → Pages → Git 저장소 연결 후:
- 프레임워크 프리셋: **None**
- 빌드 명령: **(비워둠)**
- 빌드 출력 디렉터리: **/** (루트)

`main` 브랜치에 push하면 자동 배포되고, 다른 브랜치는 미리보기 URL이 생깁니다.

## 구조
| 파일 | 역할 |
|---|---|
| `js/config.js` | 튜닝 값 기본값 · 프리셋 · 패널 항목 정의 |
| `js/weapons.js` | 무기별 데미지/연사/반동/탄퍼짐/흔들림/진동 수치 |
| `js/input.js` | 멀티터치: 플로팅 조이스틱, 회전 가속, 발사 버튼 드래그 조준 |
| `js/aimassist.js` | 조준 보정 (감속 friction + 자석 magnetism + 조준 스냅) |
| `js/feedback.js` | 십자선 확장, 히트마커, 데미지 숫자, 킬 콜아웃, 진동 |
| `js/viewmodel.js` | 1인칭 총기 (킥, 스웨이, 걷기 흔들림, 재장전/교체 모션, 총구 화염) |
| `js/main.js` | 게임 루프, 사격/반동/화면 흔들림/FOV 펀치 |

튜닝 패널의 **변경값 복사** 버튼으로 마음에 드는 값을 JSON으로 뽑아 `DEFAULTS`에 반영하면 됩니다.
