# 계정 기능 (Appwrite) 설정 기록

여러 기기에서 기록을 이어 하도록 **Appwrite Cloud**(무료 플랜)에 계정·기록을 저장합니다. (수어 시뮬레이션 사전과 같은 방식, 프로젝트는 따로)
아래는 Appwrite 콘솔(https://cloud.appwrite.io)에 이미 해 둔 설정입니다. 다시 만들거나 확인할 때 보세요.

## 프로젝트

- 이름·ID: `detective-office` · 지역: Singapore (`sgp`)
- API 주소(endpoint): `https://sgp.cloud.appwrite.io/v1`
- 코드에 들어 있는 곳: `js/account-config.js` (공개돼도 괜찮은 값. 각자의 기록을 지키는 것은 아래 권한 설정)

## 앱(접속을 허락한 사이트 주소) — Apps

| 이름 | 호스트 |
|---|---|
| Local development | `localhost` (내 컴퓨터에서 시험할 때) |
| GitHub Pages | `seoyulwoo1206.github.io` |

사이트 주소가 바뀌면 여기에 새 주소를 추가해야 로그인이 됩니다. `index.html` 을 더블클릭해서 연 경우(file://)에는 로그인 버튼이 숨겨집니다.

## 로그인 방법 — Auth

- **Email/Password** (기본값으로 켜짐. 가입하면 바로 로그인, 이메일 확인 없음)
- 비밀번호는 8자 이상, 가입할 때 "비밀번호 확인" 칸에 한 번 더

## 기록 저장소 — Databases

- 데이터베이스: `detective` (TablesDB, Serverless 무료)
- 표: `saves`
  - 열: `saveJson` (Mediumtext) — 한 사람의 게임 기록 전체. `{ "do:키": "localStorage 에 있던 글자 그대로" }` 를 JSON 으로
  - 행 ID = 사용자 ID (한 사람당 한 줄)
- 권한 (표의 Security 탭)
  - 표 권한: **All users → Create** 만 체크 (로그인한 사람은 자기 줄을 만들 수 있음)
  - **Row level security(RLS) 켜짐**: 줄을 만들 때 코드가 "그 사람만 읽기·고치기·지우기" 권한을 붙인다
  - 그래서 다른 사람의 기록은 읽을 수도, 고칠 수도 없다

## 동작 (js/account.js)

- 헤더 👤 → 계정 시트: 로그인 / 가입하기 / 비밀번호를 잊었어요(재설정 메일 → `사이트주소/?userId=…&secret=…` 로 돌아와 새 비밀번호) / 내 계정(저장 상태·지금 저장·로그아웃).
- 로그인하면 이 기기의 기록과 계정 기록을 합친다(`merge`): 명탐정의 길은 경험치가 많은 쪽 바탕 + 별·도전 횟수·통계는 큰 값 + 업적·본 장·오늘 의뢰 완료는 합집합, 알리바이 최고 기록은 큰 값, 나머지는 이 기기 값 우선.
- 그 뒤 `DO.store.set/del` 이 불릴 때마다 1.5초 뒤 저장, 화면을 떠날 때 바로 저장, 돌아오면 다시 합침.
- 로그아웃하면 이 기기의 게임 기록을 지운다(소리 설정·API 키·처음 소개 본 여부는 남김).
- 올리지 않는 값: `do:apiKey` (AI 심문의 Anthropic API 키).

## 알아 두기

- 가입한 사람 목록: Auth → Users. 기록: Databases → detective → saves → Rows.
- 2026-11-26 테스트 계정으로 가입 → 자동 저장 → 로그아웃(이 기기 기록 지워짐) → 다른 기록으로 다시 로그인 → 합쳐짐을 확인하고, 테스트 계정과 그 줄은 지웠다.
