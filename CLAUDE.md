# 탐정 사무소 (Detective Office)

친구들과, 혹은 혼자 AI와 하는 추리 게임 모음 웹앱. 하나의 **사건 데이터 구조** 위에 여러 **모드**가 올라가는 구조다.

## 현재 상태
- 바닐라 HTML/JS, 빌드 없음. `index.html`을 더블클릭해서 열어도 바로 실행된다 (fetch 안 씀).
- 구현됨 (7개): **용의자 접기**, **이마 게임**, **이마 접기**(둘의 결합), **알리바이 깨기**(타임라인 논리 추리), **AI 심문**, **일일 사건(자동 생성기)**, **방탈출**
- 용의자 얼굴은 이미지 파일 없이 SVG 로 즉석 생성(`js/portrait.js`), 효과음은 WebAudio 합성(`js/sfx.js`).
- 손으로 쓴 사건 17개 (학교 3, 학원 1, 캠핑 1, 가족 모임 1, 동아리 MT 1, 편의점 1, 아파트 1, 병원 1, 도서관 1, 온라인 게임 길드 1, 호텔 1, 수영장 1, 공항 1, 결혼식장 1, 스터디 카페 1) + 자동 생성 사건.
- 로컬 서버로 띄우고 싶으면 폴더에서 `python -m http.server 8765` (`.claude/launch.json`에 등록됨).
- git 저장소 (브랜치 `main`). 커밋은 이 폴더 안에서.
- 배포: GitHub Pages — https://seoyulwoo1206.github.io/detective-office/ (저장소 `seoyulwoo1206/detective-office`, 공개). `main` 에 푸시하면 1~2분 뒤 자동으로 다시 배포된다. 빌드 단계 없음(폴더 그대로 올라감). 배포 직후 몇 초간 일부 파일이 503 을 낼 수 있으니 확인은 새로고침 후에.

## 설계 원칙
1. 모든 모드는 같은 사건 구조(`data/cases/*.js`)를 읽어서 돌아간다. 사건은 모드와 독립적이다.
2. 모드는 `js/modes/<name>.js`에 하나씩. `DO.registerMode({id, name, desc, ready, pickCase?, start(root, ctx)})` 형태로 등록.
   - `ctx.case`에 사건이 들어온다. `pickCase: false`면 사건 선택 화면을 건너뛴다(일일 사건처럼 스스로 사건을 만드는 모드).
3. 한 번에 여러 모드 건드리지 말 것. 모드 하나를 다듬고 나서 다음으로.
4. 사건 등록 순서 = `index.html`의 `<script>` 순서. 사건을 추가하면 `index.html`에 한 줄 추가.

## 파일 구조
```
index.html            스크립트 로드 순서: core → portrait → sfx → fx → alibi-engine → cases → modes → guide → app
style.css
js/core.js            DO 네임스페이스: 모드/사건 레지스트리, h()/render() DOM 헬퍼, rng(seed), shuffle, store(localStorage),
                      nameEntry(이름 입력 공용 UI), handOff(폰 넘기기 가림막)
js/portrait.js        절차적 초상화. DO.portrait(seed, name, size), DO.face(C, suspect, size) → <span class="portrait">(SVG).
                      씨앗이 같으면 같은 얼굴. 이름 속 단어(할머니/초등/경비원/선생 …)로 나이대·머리·모자·안경을 맞춘다. DO.svg() 도 여기.
js/sfx.js             효과음. DO.sfx('tap'|'tick'|'paper'|'reveal'|'stamp'|'good'|'bad'). 헤더 🔊 버튼(do:sound). 모든 버튼에 tap 이 자동으로 붙고,
                      버튼에 data-quiet 속성을 주면 자동 tap 을 끄고 직접 다른 소리를 낼 수 있다.
js/fx.js              가벼운 화면 효과. DO.fx.win()(꽃가루+good), good(el)(톡 튀기+good), fail(el)(흔들기+bad), count(el, n)(숫자 세기),
                      DO.toast(msg)(alert 대신 화면 아래 쪽지). 움직임 줄이기 설정이면 효과를 생략한다.
js/alibi-engine.js    알리바이 깨기 엔진(DOM 없음): 퍼즐 생성기 + 유일해 검증기. DO.alibi.generate(C, level, variant) / solve / feasible / describe
js/guide.js           온보딩: 설명 시트(오버레이), 앱 소개/용어 사전, 모드별 설명 GUIDES(meta: 인원/시간/난이도/분류 포함).
                      DO.openGuide(id), DO.openAppGuide(), DO.modeMeta(id). 모드를 추가하면 여기에 항목도 추가.
js/app.js             홈(분류별 모드 카드 + 처음이세요? 카드) → 사건 선택(배경별 묶음 + 필터 칩, 선택은 do:caseFilter 에 기억) → mode.start().
                      DO.goHome(), DO.enterMode(mode) 제공. 배경 목록은 CATEGORIES 상수.
                      헤더 ❓ 버튼 = 현재 모드 설명. 처음 실행이면 앱 소개를 한 번 자동으로 띄움(do:seenIntro).
img/guide/<id>-N.jpg  설명 시트에 들어가는 예시 화면 (모바일 뷰포트 375px 스크린샷, 폭 480으로 축소). 없으면 조용히 생략.
js/modes/fold.js      모드 1 용의자 접기
js/modes/forehead.js  모드 2 이마 게임
js/modes/blind-fold.js  모드 6 이마 접기 (접기 + 이마 게임 결합)
js/modes/alibi.js     모드 7 알리바이 깨기 (진술표 · 증거 카드 · 지도 · 재연)
js/modes/ai-interrogation.js  모드 3 AI 심문 (Anthropic API 직접 호출, 스트리밍)
js/modes/daily.js     모드 4 일일 사건. DO.generateCase(seed), DO.todaySeed() 도 여기서 등록
js/modes/escape.js    모드 5 방탈출 (협동). 사건에서 방/진술서/자물쇠를 자동으로 만든다
data/cases/case-00N.js  손으로 쓴 사건. DO.registerCase({...}) 호출 하나.
tools/check-cases.js  사건 데이터 불변 조건 검사 (node tools/check-cases.js)
tools/check-alibi.js  알리바이 엔진 대량 검증 (node tools/check-alibi.js [판 수])
tools/sim.js          브라우저 자동 플레이 시뮬레이터 (앱에서는 로드 안 함). 사용법은 아래 테스트 항목.
```

## 사건 데이터 구조 (data/cases/*.js)
```
DO.registerCase({
  "id": "case-001",
  "title": "...",
  "category": "학교·학원",   // 사건 선택 화면의 묶음. app.js 의 CATEGORIES 중 하나(학교·학원 / 가족·동네 / 모임·행사 / 가게·시설 / 여행 / 온라인). 없으면 "기타"
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

## 디자인 규칙 (style.css)
- "스티커북 사건 파일" 테마. 종이 질감 바탕 위에 굵은 잉크 테두리(2px `--ink`)와 아래쪽 입체 그림자(lip)를 가진 둥근 부품들. 누르면 3px 내려간다.
- 색은 전부 `:root` 토큰으로: `--ink`(남색에 가까운 검정, 테두리·글자), `--paper`(카드), `--accent`(토마토 빨강, primary 버튼), `--yellow`(강조·배지), `--ok`/`--info`/`--purple` 과 각각의 `-soft`(옅은 바탕). 그림자는 `--lip`(버튼), `--lip-sm`(작은 버튼·칩), `--shadow`(카드).
- 바탕은 `body::before` 고정 레이어: SVG 노이즈(종이 결) + 점 격자 + 모서리 색 번짐. 본문에 직접 배경을 깔지 말 것(스크롤 성능).
- 글꼴: 본문 Pretendard(jsDelivr, 없으면 Noto Sans KR), 제목(h1~h3, `.role`, `button.mode b`, `.stamp`) Hahmlet 800, 손글씨 강조(`.section-title`, 폴라로이드 이름, 메모지, 진술표 머리) Gaegu. 링크는 index.html 에 있고 오프라인이면 시스템 글꼴로 대체된다.
- 버튼: `.primary` 빨강, `.danger` 잉크색(빨간 lip), `.small`, 목록형 `.mode`(왼쪽 색 띠, 선택되면 `.primary`). 칩 `.chips .chip`(선택 = 잉크 바탕).
- 카드 `.card`(둥근 16px). `.secret` 은 줄 쳐진 노란 메모지 + 위쪽 마스킹 테이프(`::before`) + CONFIDENTIAL 도장(`::after`). `.card.alert`/`.card.good` 은 옅은 빨강/초록 바탕.
- 홈: 맨 위 `.hero` 는 코르크 수사 보드(`app.js` 의 `heroBoard()` — 날짜로 고른 용의자 셋의 폴라로이드 `.polaroid`, 붉은 실 SVG, 메모지 `.sticky`). 모드 카드 `.mode-card` 는 `.mode-icon` 타일(아이콘은 `app.js` 의 `ICONS`) + `type-party/coop/solo/daily` 로 색이 바뀐다. 구역 제목 `.section-title` 은 손글씨 + 점선.
- 용의자가 화면에 나오면 `DO.face(C, s, 크기)` 로 얼굴을 붙인다(비밀 프로필, 역할 카드, 진술서, 전원 프로필, 지목 화면). 결과 화면의 도장은 `.stamp`(검거 = 붉은색, 미제 = 잉크색).
- `#root` 직계 자식은 `rise` 애니메이션으로 올라온다. 스크린샷을 찍을 때는 `#root > * { animation: none }` 을 주입하고, 브라우저 패널을 앞으로 가져온 뒤(`tabs_select`) 찍을 것(패널이 숨겨져 있으면 화면이 갱신되지 않은 채 찍힌다). `prefers-reduced-motion` 이면 꺼진다.
- 효과(`js/fx.js` + style.css "효과" 구역)는 "있으면 좋은 정도"로만: 큰 성공(결과 화면 승리, 순위 발표)에만 꽃가루 `DO.fx.win()`, 한 사람의 작은 성공은 `DO.fx.good()`, 틀림·들통은 `DO.fx.fail()`. 결과 화면을 `render` 한 **뒤에** 부른다(대상 요소를 찾아야 하므로). 비밀 카드 펼침(`.card.secret`), 홈 보드의 폴라로이드·실·메모지 등장, 도장의 잉크 고리는 CSS 만으로 동작한다. 애니메이션은 `transform` 대신 `translate`/`scale` 개별 속성을 써서 인라인 `transform: rotate()` 와 부딪히지 않게 했다.
- `alert()` 는 쓰지 말고 `DO.toast()`. `confirm()` 은 되돌릴 수 없는 일(기록 삭제, 홈으로)에만.
- `body` 는 `overflow-x: clip` — 애니메이션이 잠깐 화면 밖으로 나가도 폰에서 옆으로 밀리지 않는다. 진짜로 넘치는 레이아웃은 잘려서 안 보이므로 `tools/sim.js` 의 가로 넘침 검사로 잡는다.
- 지나온 테마: 다크 노와르 → 빈티지 사건 파일(갈색 잉크·오프셋 그림자) → 지금. 네온 사이버 / 파스텔 팝 / 미니멀 모노는 검토 후 폐기했다.

## 온보딩 규칙
- 모드마다 `guide.js`의 GUIDES 에 tagline / goal / steps(제목+설명+예시 이미지) / example(구체 상황) / tips 를 쓴다. 홈 카드와 사건 선택 화면의 배지는 meta 에서 나온다.
- 설명은 반드시 시트로 띄운다(`#root` 를 갈아끼우지 말 것). 게임 중 ❓ 를 눌러도 상태가 유지되어야 한다.
- 예시 화면을 다시 찍을 때: 브라우저를 375px 모바일로 맞추고 `img/guide/` 에 저장한 뒤 PIL 로 아래 여백을 잘라 폭 480 으로 줄인다.

## 모드별 메모
- **용의자 접기**: 손가락 5개. 2라운드마다 단서 1장. 거짓말 판정은 "선언 ≠ 사실"(해당되는데 안 접음, 해당 안 되는데 접음 둘 다). 들통나면 -2, 지목 실패 -1. 범인은 항상 플레이어 중에 포함.
- **이마 게임**: 역할 = 범인 1, 목격자 1, (4명 이상) 공범 1, 나머지 용의자. 역할+용의자 둘 다 맞혀야 성공. 틀리면 질문 수 +3. 8라운드 제한. 조건 질문은 앱이 traits 보고 자동 답변.
- **이마 접기**: 자기 용의자는 본인만 모름(남들은 공개 단계에서 이름+프로필을 봄). 라운드마다 조건 1개, 각자 "나는 해당할까"를 찍음 → 해당하면 -1, 찍기 틀리면 추가 -1. 2라운드마다 단서. 6라운드(조건 수가 더 적으면 그만큼) 뒤 비밀 답변(내 정체 +3, 범인 +2) + 남은 손가락 = 점수. 인원은 3~(용의자 수-1)명 — 소거법으로 바로 알 수 없게.
- **알리바이 깨기**: 사건에서는 용의자 이름·범인·현장 이름·category 만 빌리고, 타임라인은 엔진이 새로 만든다(씨앗 = `alibi:<caseId>:<난이도>:<판 번호>:<시도>`).
  세계: 장소 5곳(0번 = 현장, 나머지는 category 별 풀 `POOLS`)이 고리 지도(+지름길 0~1개)로 이어져 있고 시간 칸은 5개(10분 간격, 범행 시각은 사건 소개의 "N시"). 한 칸에 제자리 또는 이어진 곳 한 칸.
  범인만 진술이 거짓(현장에 있던 칸을 숨기되 말이 되는 동선으로, 현장에 갔다는 말은 아예 안 함). 제약은 증언(saw/notsaw/alone — 말한 사람이 범인이면 무시)과 증거(count=CCTV, flow=문 센서, at=출입 기록 — 항상 사실).
  검증기: "i 가 거짓말쟁이"라 가정하고 i 의 동선만 자유(범행 시각엔 현장)로 두어 모든 제약을 만족하는 동선이 있으면 후보. 후보가 범인 하나뿐이어야 채택.
  난이도는 "한 명을 지우는 데 필요한 최소 제약 수(core)"로 잰다 — 입문: 4명·전부 1장, 보통: 5명·2장 조합이 필요, 어려움: 6명·대놓고 틀린 카드 없음·증언은 절반만·증거 3장 이상 필수, 전설: 어려움 + 범행 시각 숨김.
  전설(level 3): `p.hidden`, 시각 후보 `p.window`(연속 3칸, 가운데 칸이 사건 소개의 "N시"). 후보는 (용의자, 시각) 쌍이고 `solvePairs` 로 정답 쌍 하나만 남는지 확인한다. "범행 시각의 현장에는 범인 혼자" 규칙 때문에 결백한 사람이 현장에 있던 칸은 범행 시각이 될 수 없다. 틀린 시각마다 `p.timeCores`(그 시각을 지우는 제약 묶음 + 그 시각 현장에 있던 사람)를 만들어 힌트·해설에 쓴다. 화면에서는 시간 머리에 "후보", 지목할 때 시각 칩도 고른다. 사람은 맞고 시각이 틀리면 오판 1회 + 그 시각 제외. 힌트는 시각부터. 증거는 탐욕 선택(입문 = 가장 많이 지우는 카드, 어려움 = 가장 조금 지우는 카드) 후 불필요한 카드를 빼고 무해한 카드 1~2장을 섞는다.
  화면: 진술표(칸 = 장소 색 + 그림) → 장소 범례 → 대조 창(카드를 누르면 진술표로 센 숫자와 비교해 ✅/⚠️ 만 알려 줌, 누가 거짓인지는 안 알려 줌) → 증거 카드 가로 줄 → 지도(시간 칩으로 진술상 위치 확인). 보드는 한 번 만들고 `update()` 로 클래스만 바꾼다(카드 줄 스크롤 유지).
  100점 시작, 힌트 -15(엔진의 core 로 한 명의 결백을 증명), 오판 -30, 기회 2번. 결과: 도장 + 재연(진짜 동선을 지도에서 1.2초 간격 재생) + 전원 해설. 최고 기록 `do:alibi:best:<caseId>:<level>`, 판 번호 `do:alibi:v:<caseId>`, 난이도 `do:alibi:level`.
- **AI 심문**: 질문 예산은 소개 화면에서 10/15/20 선택(`localStorage(do:budget)`에 기억). 단서 열기도 1 소모. 응답은 SSE 스트리밍(`stream: true`, `content_block_delta` 의 `text_delta` 를 이어 붙임, `message_delta.stop_reason === 'refusal'` 이면 묵비 문구). 진행 중인 판은 `do:ai:<caseId>` 에 자동 저장되어 소개 화면에서 이어서 할 수 있고, 끝난 판은 `do:ai:done:<caseId>` 에 남아 "지난 심문 기록 보기"로 본다. API 키는 `localStorage(do:apiKey)`에만 저장, 브라우저에서 `api.anthropic.com` 직접 호출(`anthropic-dangerous-direct-browser-access` 헤더). 기본 모델 `claude-opus-5-5`, `effort: low`. Opus/Sonnet엔 `fallbacks: "default"`. 프롬프트는 `buildSystem()` 한 곳에서만 만든다 — 설정 유출 금지, 범인은 체크리스트 기준으로 일관된 거짓말, 비범인은 솔직.
- **일일 사건**: `generateCase(seed)`는 순수 함수(mulberry32). 재료는 `SETTINGS/ROLES/PLACES/EXTRAS` 배열 — 여기에 항목만 추가하면 사건 다양성이 늘어난다. 오늘 씨앗 = `hash('daily:' + YYYY-MM-DD)`.
- **방탈출**: 비밀 정보 없는 협동 모드(폰 하나를 같이 봄). 방 배치 씨앗 = `hash('escape:' + case.id)`. 뒤질 곳 = 용의자 수(진술서) + 단서 2 + 자물쇠 힌트 1 + 잡동사니 2 + 잠긴 상자 1.
  장소 이름은 사건의 `scene.spots` 를 먼저 쓰고 모자라면 공용 풀(`SPOT_POOL`)로 채운다. 생성 사건은 `daily.js` 의 `SCENE_SPOTS[place]` 에서 온다.
  진술서는 조건마다 "그렇다/아니다" — `claims(s, tag) = traits.includes(tag) !== lies.includes(tag)` 로 계산하므로 범인만 거짓이 섞인다.
  잠긴 상자에는 폭로 단서 중 마지막 것. 번호 = 앞 조건 3개에 "그렇다"고 진술한 사람 수(자릿수 = 조건 수, 최대 3). 배터리(쉬움 20/보통 15/어려움 12): 뒤지기 1, 자물쇠 시도 1, 단서 대조 2(한 번만).
  역할 나누기(2~4명, 선택): `nameEntry` 로 이름을 받고 잠긴 상자를 뺀 장소를 순서대로 `owner = i % 인원` 으로 배정. 남의 담당 장소를 누르면 `handOff` 가림막이 먼저 뜬다. 방 화면 위 배지에 사람별 남은 곳, 결과 화면에 사람별 뒤진 곳 수. 색은 `.owner-0~3`(style.css).

## 테스트
- 문법: `node --check js/**/*.js`
- 손으로 쓴 사건: `node tools/check-cases.js` — 범인 존재, 거짓말 태그↔조건 일치, 알리바이 장소 단독 점유(증인 1명), 거짓말마다 폭로 단서 존재, 방탈출 자물쇠 번호 출력. 사건을 추가·수정하면 돌릴 것.
- 알리바이 엔진: `node tools/check-alibi.js 5` — 사건 17 × 난이도 4 × 판 5 = = 340개(전설 포함)에서 유일해(후보 = 범인 1명, 전설은 (누가, 언제) 쌍 1개), 증거 전부 사실, 결백한 사람의 진술·증언 전부 사실, 범인 동선의 지도 정합성, 결정성, 해설 근거의 유효성을 확인(오류 0). 난이도 조건 충족률과 깊이 분포도 출력한다. 엔진을 고치면 반드시 다시 돌릴 것.
- 생성기 불변 조건(범인 포함, 태그↔조건 일치, 알리바이 장소 단독 점유, 결정성)을 검사하는 스크립트를 node로 돌려 확인했음(500 씨앗 통과). 생성기 재료를 바꾸면 같은 검사를 다시 할 것.
- 자동 플레이 시뮬레이션: 앱을 열고 콘솔에서 `tools/sim.js` 를 주입한 뒤 `SIM.run({ games: 20, steps: 400, seed: 7 })` (모드 지정은 `modes: ['alibi']`, 저장값 망가뜨리기는 `junk: true`). 진행은 `SIM.progress`, 결과는 `SIM.report`.
  무작위로 버튼·입력을 눌러 판을 끝까지 진행하며 JS 오류, 화면 글자의 undefined/NaN/null/[object], 가로 넘침, 막다른 화면, 꽃가루·쪽지 누수를 모은다. AI 심문은 가짜 SSE(가끔 529/401/거절) 로 돈다.
  브라우저 패널이 숨겨져 있으면 타이머가 느려지므로 `tabs_select` 로 앞으로 가져온 뒤 돌린다. 한 번에 다 기다리지 말고 시작만 해 두고 `SIM.progress` 를 확인할 것(알리바이 깨기는 판당 수 초).
  저장값 검사: `store.get(k, 기본값)` 은 기본값과 종류가 다른 값을 버린다. 기본값을 null 로 읽는 곳은 직접 모양을 검사할 것(AI 심문의 `loadSaved`/`loadDone` 참고).
- 브라우저: 7개 모드 전부 localhost:8765 에서 한 판씩 눌러 확인함. 알리바이 깨기는 대조·힌트·오판·검거·실패·재연·새 타임라인·일일 사건, 전설의 시각 오판·시각 힌트·시각 해설까지 확인. 효과음은 호출이 오류 없이 도는 것만 확인(실제 소리는 귀로 확인 필요). AI 심문은 `fetch` 를 가짜 SSE 스트림으로 바꿔 스트리밍 파서·저장·이어하기·기록까지 확인했고, 실제 Anthropic 서버 호출만 키가 없어 미확인.

## 다음 할 일
- [ ] 알리바이 깨기: 공범 변형(거짓말쟁이 2명) 검토. 검증기의 후보를 용의자 쌍으로 넓혀야 한다.
- [ ] 알리바이 깨기: 사건의 프로필 문장과 타임라인이 따로 논다. 사건 데이터에 장소·시간 정보를 넣어 연결하는 방안 검토.
- [ ] 사건 더 작성 (`data/cases/`) — 아직 없는 배경: 놀이공원, 지하철, PC방, 농구 대회 등. 자물쇠 번호가 겹치지 않게 조건 순서를 조정할 것(check-cases 출력 확인)
- [ ] 멀티 디바이스(같은 방 접속) — 서버가 필요해서 file:// 단독 실행 원칙과 충돌. 하려면 별도 서버 프로젝트로.
