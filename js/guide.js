// 온보딩: 앱 소개 · 용어 사전 · 모드별 설명(예시 화면 포함) · 모드 메타데이터(인원/시간/난이도)
//
// 설명은 전부 "시트"(화면 아래서 올라오는 오버레이)로 띄운다.
// 게임 화면(#root)을 건드리지 않으므로 플레이 도중 ❓ 를 눌러도 진행 상황이 사라지지 않는다.
//
// 예시 화면 이미지는 img/guide/<모드id>-<번호>.jpg . 파일이 없으면 조용히 생략된다.
// 모드를 추가하면 여기 GUIDES 에 항목을 하나 추가한다 (meta 가 없으면 홈 화면 '기타'에 들어간다).

(() => {
  const { h, render, store } = DO;

  // ---------- 시트 ----------
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');

  function openSheet(title, ...nodes) {
    render(sheet,
      h('div', { class: 'sheet-head' },
        h('h2', {}, title),
        h('button', { class: 'small', onClick: closeSheet }, '닫기 ✕')),
      nodes,
    );
    overlay.hidden = false;
    sheet.scrollTop = 0;
    document.body.classList.add('no-scroll');
  }
  function closeSheet() {
    overlay.hidden = true;
    document.body.classList.remove('no-scroll');
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeSheet(); });

  const img = (name, alt) => h('img', {
    src: `img/guide/${name}.jpg`, alt: alt || '예시 화면', loading: 'lazy',
    onError: e => e.target.remove(),
  });

  // ---------- 용어 ----------
  const TERMS = [
    ['사건', '하나의 이야기. 제목, 개요, 용의자들, 조건 목록, 단서 3장으로 이루어진다. 모든 모드가 같은 사건을 재료로 쓴다.'],
    ['용의자', '사건 속 인물. 플레이어는 보통 용의자 한 명을 맡는다. 그중 딱 한 명이 범인.'],
    ['프로필', '그 용의자만 아는 비밀 설정. "그 시간에 어디서 뭘 했는지"가 적혀 있다. 범인 프로필에는 "당신이 범인이다"와 거짓말해도 되는 조건이 적혀 있다.'],
    ['조건', '"~한 사람 접어" 꼴의 문장. 예) 점심시간에 음악실에 들어간 사람 접어. 프로필을 보면 내가 해당하는지 알 수 있다.'],
    ['단서', '사건의 증거. 공개되면 범인의 거짓말이 들통날 수 있다. 예) "미술부 증언: 미술실엔 나 혼자 있었다" → 미술실에 있었다고 한 다른 사람은 거짓말.'],
    ['범인의 거짓말', '범인은 보통 두 가지를 속인다. 현장에 갔으면서 "안 갔다", 다른 곳(알리바이)에 "있었다". 각각을 들추는 단서가 하나씩 있다.'],
  ];

  function termList() {
    return TERMS.map(([t, d]) => h('div', { class: 'term' }, h('b', {}, t), ' — ', d));
  }

  // ---------- 모드별 설명 ----------
  // meta.type: party(친구들과·폰 하나) / coop(협동) / solo(혼자) / daily(매일)
  const GUIDES = {
    fold: {
      meta: { type: 'party', players: '2~6명', time: '15~25분', level: '★☆☆ 입문' },
      tagline: '손병호 게임에 추리를 얹었다. 규칙이 가장 단순해서 처음 하기 좋다.',
      goal: '범인이 아닌 사람은 범인을 찾아 지목한다. 범인은 들키지 않고 끝까지 버틴다.',
      steps: [
        { title: '사건 고르고 이름 입력', text: '각자 용의자 한 명을 맡는다. 범인은 항상 플레이어 중에 있다.' },
        { title: '비밀 프로필 확인', text: '폰을 돌려가며 자기 프로필만 본다. 남이 보면 안 된다. 범인 프로필에는 거짓말해도 되는 조건이 적혀 있다.', img: 'fold-1' },
        { title: '조건 고르고 접기', text: '차례인 사람이 조건을 하나 고른다. 해당하는 사람은 자기 이름을 눌러 손가락을 접는다(-1). 범인은 거짓말해도 된다.', img: 'fold-2' },
        { title: '단서 공개', text: '2라운드마다 단서가 열린다. 단서와 선언이 어긋난 사람은 거짓말이 들통나 손가락 -2.', img: 'fold-3' },
        { title: '범인 지목', text: '확신이 들면 누구든 지목할 수 있다. 맞히면 그 사람이 승리, 틀리면 손가락 -1.' },
      ],
      example: '조건 "음악실에 들어간 사람 접어"가 나왔다. 댄스부 부장(범인)은 실제로 들어갔지만 안 접었다. 2라운드 뒤 단서 "피아노 옆에서 댄스부 리본 발견"이 열리자 거짓말이 들통나 손가락 2개를 잃었다.',
      tips: ['의심되는 사람이 해당할 것 같은 조건을 골라 몰아붙이자.', '범인은 단서가 들추는 조건에서만 위험하다. 어떤 단서가 남았는지 세어 보자.', '손가락이 다 접히면 탈락. 지목은 너무 늦기 전에.'],
    },
    forehead: {
      meta: { type: 'party', players: '2~6명', time: '15~20분', level: '★★☆' },
      tagline: '인디언 포커처럼, 내 정체를 나만 모른다. 예/아니오 질문으로 알아내는 게임.',
      goal: '내 역할(범인·공범·목격자·용의자)과 내가 어떤 용의자인지 둘 다 가장 적은 질문으로 맞힌다.',
      steps: [
        { title: '정체 배정', text: '이름을 넣으면 역할과 용의자가 배정된다. 범인 1명, 목격자 1명, 4명 이상이면 공범 1명, 나머지는 용의자.' },
        { title: '본인 빼고 확인', text: '한 명씩 눈을 감고, 나머지가 그 사람의 역할·용의자·프로필을 본다. 다 외워 두자.', img: 'forehead-1' },
        { title: '차례마다 질문 하나', text: '말로 예/아니오 질문을 하거나, 앱에게 조건 질문을 한다. 조건 질문은 앱이 사실대로 답해 준다.', img: 'forehead-2' },
        { title: '정체 말하기', text: '역할과 용의자를 둘 다 골라 확정. 맞으면 성공, 틀리면 질문 수 +3. 어느 쪽이 틀렸는지는 알려주지 않는다.', img: 'forehead-3' },
        { title: '순위', text: '8라운드가 끝나거나 전원 성공하면 질문 수가 적은 순으로 순위.' },
      ],
      example: '민수의 카드는 "목격자 · 음악 선생님"이다. 민수가 "나는 열쇠를 가진 사람인가?"라고 앱에게 물으면 앱은 ⭕. 두 번째로 "나는 범인인가?"라고 말로 물으면 사람들은 ❌라고 답한다.',
      tips: ['역할은 앱에게 못 묻는다. 사람에게 물어야 한다.', '조건 질문은 거짓이 없으니 용의자 특정에 좋다.', '틀리면 +3이라 두 번 확신한 뒤 말하자.'],
    },
    'blind-fold': {
      meta: { type: 'party', players: '3~5명', time: '20분', level: '★★★' },
      tagline: '접기와 이마 게임을 합쳤다. 내가 누군지 모른 채 접어야 한다.',
      goal: '손가락을 지키면서 마지막에 내 정체와 범인을 맞힌다. 점수 = 남은 손가락 + 정체 3점 + 범인 2점.',
      steps: [
        { title: '본인 빼고 확인', text: '이마 게임처럼 한 명씩 눈을 감고 나머지가 그 사람의 용의자와 프로필을 본다.', img: 'blind-fold-1' },
        { title: '조건 하나, 각자 찍기', text: '차례인 사람이 조건을 고른다. 각자 "나는 해당하는 사람일까?"를 찍어서 접거나 안 접는다.', img: 'blind-fold-2' },
        { title: '정답 공개', text: '앱이 사실을 공개한다. 실제로 해당하면 손가락 -1, 찍은 게 틀리면 추가 -1.', img: 'blind-fold-3' },
        { title: '단서와 추리', text: '2라운드마다 단서가 열린다. 단서가 가리키는 용의자가 남들 중에 없다면… 그게 나다.' },
        { title: '마지막 답변', text: '6라운드 뒤 각자 비밀리에 "나는 누구 / 범인은 누구"를 답하고 점수를 낸다.' },
      ],
      example: '"미술실에 있던 사람 접어"에서 현우만 해당했다. 뒤이어 단서 "미술부 증언: 미술실엔 나 혼자 있었다"가 열린다. 현우는 "아, 내가 미술부구나"를 알게 된다.',
      tips: ['남들의 정체를 알고 있으니, 그들이 접을 수밖에 없는 조건을 고르자.', '내가 해당했던 조건을 모으면 내 프로필이 보인다. 답변 화면에 정리돼 나온다.', '범인을 맡은 사람은 자기가 범인인 줄 모른다. 표정 관리!'],
    },
    'ai-interrogation': {
      meta: { type: 'solo', players: '1명', time: '10~20분', level: '★★☆', needsKey: true },
      tagline: '용의자들이 AI 캐릭터가 되어 대답한다. 혼자서 하는 진짜 심문.',
      goal: '정해진 질문 수 안에 용의자들을 심문하고 범인을 지목한다. 기회는 한 번.',
      steps: [
        { title: 'API 키 설정 (처음 한 번)', text: 'Anthropic API 키를 넣는다. 키는 이 폰의 브라우저에만 저장되고 Anthropic 서버로만 전송된다. 한 판에 몇십 원 수준.', img: 'ai-interrogation-1' },
        { title: '난이도 고르기', text: '질문 예산 10/15/20개. 용의자에게 묻거나 단서 카드를 열 때 1개씩 쓴다.' },
        { title: '심문', text: '위쪽 탭에서 용의자를 고르고 자유롭게 묻는다. 범인은 거짓말을 하고, 나머지는 솔직하다. 진술이 엇갈리는 지점을 찾자.', img: 'ai-interrogation-2' },
        { title: '단서 카드', text: '질문 1개를 써서 단서를 연다. 단서를 알면 용의자에게 들이댈 수 있다.', img: 'ai-interrogation-3' },
        { title: '범인 지목', text: '확신이 들면 지목. 결과 화면에서 전원 프로필과 심문 기록을 볼 수 있다. 중간에 나가도 이어서 할 수 있다.' },
      ],
      example: '댄스부 부장에게 "점심시간에 어디 있었어?"라고 물으니 "미술실에서 배경 그리는 걸 도왔어요"라고 답한다. 미술부에게 같은 걸 물으니 "미술실엔 나 혼자였는데요?" — 둘 중 하나는 거짓말.',
      tips: ['같은 질문을 여러 명에게 던져 교차 검증하자.', '단서를 연 뒤 "이건 어떻게 설명할래?"라고 들이대면 범인은 흔들린다.', '질문이 다 떨어지면 지목만 할 수 있다. 2~3개는 남겨 두자.'],
    },
    daily: {
      meta: { type: 'daily', players: '모드에 따라', time: '-', level: '-' },
      tagline: '매일 새 사건이 자동으로 만들어진다. 오늘은 모두 같은 사건.',
      goal: '손으로 쓴 사건을 다 해 봤다면 여기서 무한히 새 사건을 뽑는다.',
      steps: [
        { title: '오늘의 사건', text: '날짜로 씨앗을 만들어 사건을 생성한다. 같은 날이면 누구 폰에서나 같은 사건이 나온다.', img: 'daily-1' },
        { title: '모드 고르기', text: '그 사건으로 접기·이마·AI 심문·방탈출 중 아무거나 플레이한다.' },
        { title: '씨앗 공유', text: '씨앗 번호를 친구에게 보내면 친구도 같은 사건을 할 수 있다. 랜덤 사건도 가능.' },
      ],
      example: '씨앗 20261029로 만든 사건은 언제 누가 만들어도 똑같다. 단톡방에 "오늘 씨앗 20261029로 방탈출 해 봐"라고 보내면 된다.',
      tips: ['다른 모드의 사건 선택 화면에도 "오늘의 사건 / 랜덤 사건"이 있다.'],
    },
    escape: {
      meta: { type: 'coop', players: '1~6명', time: '15~25분', level: '★★☆' },
      tagline: '사건 현장을 뒤져 증거를 모은다. 비밀이 없어서 다 같이 한 화면을 보며 토론하는 협동 모드.',
      goal: '손전등 배터리가 떨어지기 전에 범인을 찾는다. 지목 기회는 한 번.',
      steps: [
        { title: '난이도 선택', text: '배터리 20/15/12. 장소를 하나 뒤질 때마다 1씩 줄어든다.' },
        { title: '장소 뒤지기', text: '현장의 장소를 누르면 용의자 진술서, 단서, 자물쇠 힌트, 잡동사니 중 하나가 나온다.', img: 'escape-1' },
        { title: '진술서 읽기', text: '진술서는 그 용의자가 각 조건에 "그렇다/아니다"라고 한 것. 범인의 진술에만 거짓이 섞여 있다.', img: 'escape-2' },
        { title: '잠긴 상자', text: '결정적 단서가 들어 있다. 번호는 힌트대로 진술서를 세어서 푼다. 시도마다 배터리 1.', img: 'escape-3' },
        { title: '대조하고 지목', text: '"단서 대조"(배터리 2)로 단서와 진술서를 표로 비교한다. 어긋나는 사람이 범인.' },
      ],
      example: '단서 "엄마 증언: 텐트 안에는 나 혼자였다"를 찾았다. 진술서를 보니 막내가 "텐트 안에 있던 사람이다"라고 했다. 둘 중 거짓말쟁이는 막내.',
      tips: ['진술서를 먼저 모으면 자물쇠 번호가 저절로 나온다.', '배터리가 아슬아슬하면 잡동사니를 피해야 한다. 어디가 잡동사니인지는 운.', '찾은 것은 배터리 없이 다시 볼 수 있다. 수첩을 활용하자.'],
    },
  };

  // ---------- 시트 내용 ----------
  function openGuide(modeId) {
    const g = GUIDES[modeId];
    const mode = DO.modes.find(m => m.id === modeId);
    if (!g || !mode) return openAppGuide();
    const meta = g.meta || {};
    openSheet('❓ ' + mode.name,
      h('p', {}, g.tagline),
      h('div', { class: 'badges' }, [meta.players, meta.time, meta.level, meta.needsKey ? 'API 키 필요' : null].filter(Boolean)
        .map(b => h('span', { class: 'badge' }, b))),
      h('div', { class: 'card good' }, h('p', {}, h('b', {}, '🎯 목표  '), g.goal)),
      h('h3', {}, '진행 순서'),
      g.steps.map((s, i) => h('div', { class: 'step' },
        h('div', { class: 'num' }, String(i + 1)),
        h('div', { class: 'grow' },
          h('b', {}, s.title),
          h('p', { class: 'muted' }, s.text),
          s.img ? img(s.img, s.title + ' 예시 화면') : null,
        ),
      )),
      g.example ? [h('h3', {}, '예시 상황'), h('div', { class: 'card secret' }, h('p', {}, g.example))] : null,
      g.tips && g.tips.length ? [h('h3', {}, '팁'), h('ul', { class: 'tips' }, g.tips.map(t => h('li', {}, t)))] : null,
      h('button', { onClick: () => { closeSheet(); openAppGuide(); } }, '📖 용어가 낯설다면: 게임 소개 보기'),
      h('button', { class: 'primary', onClick: closeSheet }, '알겠어요'),
    );
  }

  function openAppGuide() {
    openSheet('📖 탐정 사무소 소개',
      h('p', {}, '폰 하나를 돌려가며 하는 추리 파티 게임 모음입니다. 사건 하나에 용의자 여러 명, 그중 한 명이 거짓말쟁이 범인. 같은 사건을 여러 방식으로 플레이합니다.'),
      h('h3', {}, '공통 흐름'),
      [
        ['모드 고르기', '홈에서 하고 싶은 방식을 고른다. 처음이면 용의자 접기.'],
        ['사건 고르기', '수록된 사건이나 오늘의 사건을 고른다. 어느 모드든 같은 사건을 쓸 수 있다.'],
        ['이름 입력', '함께할 사람 이름을 넣는다. 지난번 이름은 기억되어 있다.'],
        ['폰 돌리기', '"OO님에게 폰을 넘기세요" 화면이 나오면 그 사람만 본다. 비밀 정보는 이때만 보인다.'],
        ['플레이 → 결과', '모드별 규칙대로 진행하고 결과 화면에서 전원 정체를 공개한다.'],
      ].map(([t, d], i) => h('div', { class: 'step' },
        h('div', { class: 'num' }, String(i + 1)),
        h('div', { class: 'grow' }, h('b', {}, t), h('p', { class: 'muted' }, d)))),
      h('div', { class: 'shots' }, img('app-1', '홈 화면'), img('app-2', '사건 선택 화면')),
      h('h3', {}, '용어 사전'),
      termList(),
      h('h3', {}, '어떤 모드부터?'),
      h('div', { class: 'card' },
        h('p', {}, h('b', {}, '친구들과 2~6명'), ' → 용의자 접기(입문) → 이마 게임 → 이마 접기(고수)'),
        h('p', {}, h('b', {}, '혼자 또는 다 같이 한 화면으로'), ' → 방탈출'),
        h('p', {}, h('b', {}, '혼자서, AI와 대화하며'), ' → AI 심문 (API 키 필요)'),
        h('p', {}, h('b', {}, '사건이 다 떨어졌다면'), ' → 일일 사건'),
      ),
      h('p', { class: 'muted small-text' }, '게임 중에도 화면 위 ❓ 버튼을 누르면 그 모드의 설명이 뜹니다. 진행 중인 게임은 사라지지 않습니다.'),
      h('button', { class: 'primary', onClick: closeSheet }, '시작하기'),
    );
  }

  DO.guides = GUIDES;
  DO.openGuide = openGuide;
  DO.openAppGuide = openAppGuide;
  DO.closeSheet = closeSheet;
  DO.modeMeta = id => (GUIDES[id] && GUIDES[id].meta) || {};
})();
