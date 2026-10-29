# 탐정 사무소 (Detective Office)

친구들과, 혹은 혼자 AI와 하는 추리 게임 모음 웹앱. 하나의 **사건 데이터 구조** 위에 여러 **모드**가 올라가는 구조다.

## 현재 상태
- 바닐라 HTML/JS, 빌드 없음. `index.html`을 더블클릭해서 열어도 바로 실행된다 (fetch 안 씀).
- 구현됨 (6개): **용의자 접기**, **이마 게임**, **이마 접기**(둘의 결합), **AI 심문**, **일일 사건(자동 생성기)**, **방탈출**
- 손으로 쓴 사건 6개 (학교 3, 학원 1, 캠핑 1, 가족 모임 1) + 자동 생성 사건.
- 로컬 서버로 띄우고 싶으면 폴더에서 `python -m http.server 8765` (`.claude/launch.json`에 등록됨).
- git 저장소 (브랜치 `main`). 커밋은 이 폴더 안에서.

## 설계 원칙
1. 모든 모드는 같은 사건 구조(`data/cases/*.js`)를 읽어서 돌아간다. 사건은 모드와 독립적이다.
2. 모드는 `js/modes/<name>.js`에 하나씩. `DO.registerMode({id, name, desc, ready, pickCase?, start(root, ctx)})` 형태로 등록.
   - `ctx.case`에 사건이 들어온다. `pickCase: false`면 사건 선택 화면을 건너뛴다(일일 사건처럼 스스로 사건을 만드는 모드).
3. 한 번에 여러 모드 건드리지 말 것. 모드 하나를 다듬고 나서 다음으로.
4. 사건 등록 순서 = `index.html`의 `<script>` 순서. 사건을 추가하면 `index.html`에 한 줄 추가.

## 파일 구조
```
index.html            스크립트 로드 순서: core → cases → modes → app
style.css
js/core.js            DO 네임스페이스: 모드/사건 레지스트리, h()/render() DOM 헬퍼, rng(seed), shuffle, store(localStorage),
                      nameEntry(이름 입력 공용 UI), handOff(폰 넘기기 가림막)
js/app.js             홈(모드 선택) → 사건 선택 → mode.start(). DO.goHome() 제공.
js/modes/fold.js      모드 1 용의자 접기
js/modes/forehead.js  모드 2 이마 게임
js/modes/blind-fold.js  모드 6 이마 접기 (접기 + 이마 게임 결합)
js/modes/ai-interrogation.js  모드 3 AI 심문 (Anthropic API 직접 호출, 스트리밍)
js/modes/daily.js     모드 4 일일 사건. DO.generateCase(seed), DO.todaySeed() 도 여기서 등록
js/modes/escape.js    모드 5 방탈출 (협동). 사건에서 방/진술서/자물쇠를 자동으로 만든다
data/cases/case-00N.js  손으로 쓴 사건. DO.registerCase({...}) 호출 하나.
tools/check-cases.js  사건 데이터 불변 조건 검사 (node tools/check-cases.js)
```

## 사건 데이터 구조 (data/cases/*.js)
```
DO.registerCase({
  "id": "case-001",
  "title": "...",
  "intro": "사건 개요(플레이어에게 보여줌)",
  "culprit": "suspect id",
  "scene": { "name": "음악실", "spots": [["🎹", "피아노 뚜껑 안"], ...] },   // 선택. 방탈출이 쓰는 현장 이름과 장소 4~5개
  "suspects": [
    { "id": "s1", "name": "...", "profile": "본인에게만 보이는 비밀 프로필 문장",
      "traits": ["library", "night", ...],       // 조건 판정용 태그 (조건이 없는 태그는 순수 배경 설정)
      "lies": ["library"] }                        // 범인만: 거짓말하는 태그. 비범인은 []
  ],
  "conditions": [
    { "tag": "library", "text": "사건 당일 도서관에 간 사람 접어" }   // 문장은 "~한 사람 접어" 꼴로 끝낼 것
  ],                                                                 // (이마 게임이 "나는 ~한 사람인가?"로 바꿔 씀)
  "clues": [
    { "id": "c1", "text": "...", "exposes": "library" }   // 공개되면 해당 태그 거짓말을 들통나게 함. 중립 단서는 null
  ]
});
```
사건을 쓸 때 지킬 것:
- 범인의 `lies`에는 보통 2개: 현장 태그(사실은 해당하는데 "안 접음") + 알리바이 태그(사실은 아닌데 "접음").
- 알리바이 장소에 실제로 있던 사람은 딱 1명(증인). 그 증인의 "혼자 있었다" 증언이 알리바이 폭로 단서가 된다.
- 단서는 3장: 알리바이 폭로 1, 현장 증거 1, 중립 1. 중립 단서가 먼저 나오게 배치하면 바로 들통나지 않는다.

## 모드별 메모
- **용의자 접기**: 손가락 5개. 2라운드마다 단서 1장. 거짓말 판정은 "선언 ≠ 사실"(해당되는데 안 접음, 해당 안 되는데 접음 둘 다). 들통나면 -2, 지목 실패 -1. 범인은 항상 플레이어 중에 포함.
- **이마 게임**: 역할 = 범인 1, 목격자 1, (4명 이상) 공범 1, 나머지 용의자. 역할+용의자 둘 다 맞혀야 성공. 틀리면 질문 수 +3. 8라운드 제한. 조건 질문은 앱이 traits 보고 자동 답변.
- **이마 접기**: 자기 용의자는 본인만 모름(남들은 공개 단계에서 이름+프로필을 봄). 라운드마다 조건 1개, 각자 "나는 해당할까"를 찍음 → 해당하면 -1, 찍기 틀리면 추가 -1. 2라운드마다 단서. 6라운드(조건 수가 더 적으면 그만큼) 뒤 비밀 답변(내 정체 +3, 범인 +2) + 남은 손가락 = 점수. 인원은 3~(용의자 수-1)명 — 소거법으로 바로 알 수 없게.
- **AI 심문**: 질문 예산은 소개 화면에서 10/15/20 선택(`localStorage(do:budget)`에 기억). 단서 열기도 1 소모. 응답은 SSE 스트리밍(`stream: true`, `content_block_delta` 의 `text_delta` 를 이어 붙임, `message_delta.stop_reason === 'refusal'` 이면 묵비 문구). 진행 중인 판은 `do:ai:<caseId>` 에 자동 저장되어 소개 화면에서 이어서 할 수 있고, 끝난 판은 `do:ai:done:<caseId>` 에 남아 "지난 심문 기록 보기"로 본다. API 키는 `localStorage(do:apiKey)`에만 저장, 브라우저에서 `api.anthropic.com` 직접 호출(`anthropic-dangerous-direct-browser-access` 헤더). 기본 모델 `claude-opus-5-5`, `effort: low`. Opus/Sonnet엔 `fallbacks: "default"`. 프롬프트는 `buildSystem()` 한 곳에서만 만든다 — 설정 유출 금지, 범인은 체크리스트 기준으로 일관된 거짓말, 비범인은 솔직.
- **일일 사건**: `generateCase(seed)`는 순수 함수(mulberry32). 재료는 `SETTINGS/ROLES/PLACES/EXTRAS` 배열 — 여기에 항목만 추가하면 사건 다양성이 늘어난다. 오늘 씨앗 = `hash('daily:' + YYYY-MM-DD)`.
- **방탈출**: 비밀 정보 없는 협동 모드(폰 하나를 같이 봄). 방 배치 씨앗 = `hash('escape:' + case.id)`. 뒤질 곳 = 용의자 수(진술서) + 단서 2 + 자물쇠 힌트 1 + 잡동사니 2 + 잠긴 상자 1.
  장소 이름은 사건의 `scene.spots` 를 먼저 쓰고 모자라면 공용 풀(`SPOT_POOL`)로 채운다. 생성 사건은 `daily.js` 의 `SCENE_SPOTS[place]` 에서 온다.
  진술서는 조건마다 "그렇다/아니다" — `claims(s, tag) = traits.includes(tag) !== lies.includes(tag)` 로 계산하므로 범인만 거짓이 섞인다.
  잠긴 상자에는 폭로 단서 중 마지막 것. 번호 = 앞 조건 3개에 "그렇다"고 진술한 사람 수(자릿수 = 조건 수, 최대 3). 배터리(쉬움 20/보통 15/어려움 12): 뒤지기 1, 자물쇠 시도 1, 단서 대조 2(한 번만).

## 테스트
- 문법: `node --check js/**/*.js`
- 손으로 쓴 사건: `node tools/check-cases.js` — 범인 존재, 거짓말 태그↔조건 일치, 알리바이 장소 단독 점유(증인 1명), 거짓말마다 폭로 단서 존재, 방탈출 자물쇠 번호 출력. 사건을 추가·수정하면 돌릴 것.
- 생성기 불변 조건(범인 포함, 태그↔조건 일치, 알리바이 장소 단독 점유, 결정성)을 검사하는 스크립트를 node로 돌려 확인했음(500 씨앗 통과). 생성기 재료를 바꾸면 같은 검사를 다시 할 것.
- 브라우저: 6개 모드 전부 localhost:8765 에서 한 판씩 눌러 확인함. AI 심문은 `fetch` 를 가짜 SSE 스트림으로 바꿔 스트리밍 파서·저장·이어하기·기록까지 확인했고, 실제 Anthropic 서버 호출만 키가 없어 미확인.

## 다음 할 일
- [ ] 사건 더 작성 (`data/cases/`) — 동아리 MT, 편의점 아르바이트 등
- [ ] 방탈출: 2인 이상일 때 역할 분담(각자 뒤질 곳 나누기)
- [ ] 멀티 디바이스(같은 방 접속) — 서버가 필요해서 file:// 단독 실행 원칙과 충돌. 하려면 별도 서버 프로젝트로.
