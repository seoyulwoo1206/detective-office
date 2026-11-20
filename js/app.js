// 앱 셸: 홈 화면(모드 선택) → 사건 선택 → 모드 시작
// 헤더의 ❓ 버튼은 현재 모드의 설명 시트(guide.js)를 띄운다. 게임 화면은 건드리지 않는다.
(() => {
  const { h, render, modes, listCases, store } = DO;

  // 사건 선택 화면의 배경별 묶음 순서. 사건 데이터의 category 문자열과 맞춘다. 쉬운 것(학교)이 먼저.
  const CATEGORIES = [
    ['학교·학원', '🏫'], ['가족·동네', '🏡'], ['모임·행사', '🎉'], ['가게·시설', '🏢'], ['여행', '✈️'], ['온라인', '🎮'],
  ];
  const root = document.getElementById('root');
  const homeBtn = document.getElementById('home');
  const helpBtn = document.getElementById('help');
  const title = document.getElementById('title');
  let currentMode = null;

  const SECTIONS = [
    { type: 'party', title: '👥 친구들과 · 폰 하나로 돌려가며' },
    { type: 'coop', title: '🤝 다 같이 한 화면으로 (혼자도 OK)' },
    { type: 'solo', title: '🧠 혼자서 · 또는 머리를 맞대고' },
    { type: 'daily', title: '📅 매일 새 사건' },
  ];

  function badges(meta) {
    const list = [meta.isNew ? 'NEW' : null, meta.players, meta.time, meta.level, meta.needsKey ? 'API 키 필요' : null].filter(Boolean);
    return h('div', { class: 'badges' }, list.map(b => h('span', { class: 'badge' + (b === 'API 키 필요' ? ' key' : b === 'NEW' ? ' new' : '') }, b)));
  }

  // 홈 카드의 아이콘 타일. 모드를 추가하면 여기에도 한 줄.
  const ICONS = { career: '🎖️', fold: '✋', forehead: '🤔', 'blind-fold': '🙈', alibi: '🧩', 'ai-interrogation': '🤖', daily: '📅', escape: '🔦' };

  function modeCard(m) {
    const meta = DO.modeMeta ? DO.modeMeta(m.id) : {};
    return h('div', { class: 'mode-card' + (meta.type ? ' type-' + meta.type : '') },
      h('div', { class: 'mode-top' },
        h('div', { class: 'mode-icon' }, ICONS[m.id] || '🗂'),
        h('div', { class: 'grow' },
          h('h3', {}, m.name + (m.ready ? '' : ' (준비 중)')),
          badges(meta))),
      h('p', { class: 'muted' }, m.desc),
      h('div', { class: 'row' },
        h('button', { class: 'small', onClick: () => DO.openGuide && DO.openGuide(m.id) }, '❓ 설명'),
        h('button', { class: 'grow primary', disabled: !m.ready, onClick: () => startMode(m) }, '시작'),
      ),
    );
  }

  // 홈 맨 위의 코르크 수사 보드: 수록 사건의 용의자 셋을 폴라로이드로 꽂고 붉은 실로 잇는다.
  // 누구를 꽂을지는 날짜로 정해서 매일 바뀐다. 폴라로이드의 가운데(핀)가 left % 에 오므로 실의 좌표와 맞는다.
  function heroBoard() {
    const all = listCases().flatMap(c => c.suspects.map(s => ({ c, s })));
    const picks = all.length >= 3 && DO.face ? DO.shuffle(all, DO.rng(DO.hashString('board:' + new Date().toDateString()))).slice(0, 3) : [];
    const spots = [[17, 16, -6], [45, 27, 4], [73, 12, -3]];
    const string = DO.svg ? DO.svg('svg', { class: 'board-string', viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
      DO.svg('path', { d: 'M17,9 Q31,24 45,15 Q60,3 73,7 Q85,28 87,66' })) : null;
    return h('div', { class: 'board' },
      picks.length ? string : null,
      picks.map(({ c, s }, i) => h('div', {
        class: 'polaroid',
        style: `left:${spots[i][0]}%; top:${spots[i][1]}px; margin-left:-37px; transform:rotate(${spots[i][2]}deg); transform-origin:50% 0;`,
      }, DO.face(c, s, 60), h('span', { class: 'cap' }, s.name))),
      h('div', { class: 'board-stamp' }, 'TOP SECRET'),
      h('div', { class: 'sticky' }, '범인은', h('br'), '이 안에 있다!'),
    );
  }

  function home() {
    currentMode = null;
    if (DO.music) DO.music.base('lobby');
    homeBtn.hidden = true;
    helpBtn.hidden = true;
    title.textContent = '탐정 사무소';
    const placed = new Set();
    const sections = SECTIONS.map(sec => {
      const list = modes.filter(m => (DO.modeMeta ? DO.modeMeta(m.id).type : null) === sec.type);
      list.forEach(m => placed.add(m));
      return list.length ? [h('div', { class: 'section-title' }, sec.title), list.map(modeCard)] : null;
    });
    const rest = modes.filter(m => !placed.has(m));
    const starter = modes.find(m => m.id === 'fold' && m.ready);
    const career = modes.find(m => m.id === 'career' && m.ready);

    render(root,
      h('div', { class: 'card hero' },
        heroBoard(),
        h('div', { class: 'hero-body' },
          h('h3', {}, '👋 처음이세요?'),
          h('p', { class: 'muted' }, '폰 하나를 돌려가며 하는 추리 파티 게임 모음입니다. 사건 하나에 용의자 여러 명, 그중 한 명이 거짓말쟁이 범인. 혼자라면 "명탐정의 길"에서 사건을 하나씩 깨며 레벨을 올려 보세요.'),
          h('div', { class: 'row' },
            h('button', { class: 'grow', onClick: () => DO.openAppGuide && DO.openAppGuide() }, '📖 게임 소개'),
            starter ? h('button', { class: 'grow primary', onClick: () => startMode(starter) }, '🚀 바로 시작') : null,
          ),
          career ? h('button', { class: 'career-cta', onClick: () => startMode(career) }, '🎖️ 혼자 모험하기 — 명탐정의 길') : null,
        ),
      ),
      sections,
      rest.length ? [h('div', { class: 'section-title' }, '기타'), rest.map(modeCard)] : null,
      h('p', { class: 'muted small-text center' }, `사건 ${listCases().length}개 수록 · 게임 중에도 위쪽 ❓ 로 설명을 볼 수 있어요`),
    );

    // 처음 실행이면 소개를 한 번 자동으로 띄운다
    if (!store.get('seenIntro') && DO.openAppGuide) {
      store.set('seenIntro', true);
      DO.openAppGuide();
    }
  }

  // 모드에 들어갈 때 헤더(제목, 홈, ❓)를 맞춘다. daily.js 처럼 다른 모드를 직접 띄우는 곳에서도 쓴다.
  function enterMode(mode) {
    currentMode = mode;
    title.textContent = mode.name;
    homeBtn.hidden = false;
    helpBtn.hidden = !(DO.guides && DO.guides[mode.id]);
  }

  // 사건 선택 화면. 모드가 pickCase:false 면 건너뛴다(일일 사건처럼 스스로 사건을 만드는 모드).
  function startMode(mode) {
    enterMode(mode);
    if (DO.music) DO.music.base('lobby');
    if (mode.pickCase === false) return mode.start(root, {});

    const cases = listCases();
    const gen = DO.generateCase; // daily.js 가 등록하면 존재
    const meta = DO.modeMeta ? DO.modeMeta(mode.id) : {};
    // 배경별 묶음. 사건의 category 가 목록에 없으면 "기타"로.
    const groups = CATEGORIES.map(([name, emoji]) => ({ name, emoji, cases: cases.filter(c => c.category === name) }));
    const known = new Set(CATEGORIES.map(([n]) => n));
    const etc = cases.filter(c => !known.has(c.category));
    if (etc.length) groups.push({ name: '기타', emoji: '📁', cases: etc });
    const nonEmpty = groups.filter(g => g.cases.length);
    let filter = store.get('caseFilter', null);
    if (filter && !nonEmpty.some(g => g.name === filter)) filter = null;

    const caseBtn = c => h('button', { class: 'mode', onClick: () => begin(mode, c) },
      h('b', {}, c.title),
      h('div', { class: 'muted' }, `용의자 ${c.suspects.length}명 · ${c.intro.slice(0, 48)}…`),
    );
    const draw = () => render(root,
      h('div', { class: 'card' },
        h('p', {}, h('b', {}, mode.name), ' · ', h('span', { class: 'muted' }, mode.desc)),
        badges(meta),
        h('button', { class: 'small', onClick: () => DO.openGuide && DO.openGuide(mode.id) }, '❓ 이 게임 설명 보기'),
      ),
      h('h3', {}, '어떤 사건으로 할까요?'),
      h('p', { class: 'muted small-text' }, '처음이면 학교·학원부터. 용의자 수가 적을수록 쉽습니다.'),
      h('div', { class: 'chips' },
        h('button', { class: 'chip' + (filter ? '' : ' active'), onClick: () => { filter = null; store.set('caseFilter', null); draw(); } }, `전체 ${cases.length}`),
        nonEmpty.map(g => h('button', { class: 'chip' + (filter === g.name ? ' active' : ''), onClick: () => { filter = g.name; store.set('caseFilter', g.name); draw(); } }, `${g.emoji} ${g.name} ${g.cases.length}`)),
      ),
      nonEmpty.filter(g => !filter || g.name === filter).map(g => [
        h('div', { class: 'section-title' }, `${g.emoji} ${g.name} · ${g.cases.length}개`),
        g.cases.map(caseBtn),
      ]),
      gen ? h('div', { class: 'section-title' }, '🤖 자동 생성') : null,
      gen ? h('button', { class: 'mode', onClick: () => begin(mode, gen(DO.todaySeed())) },
        h('b', {}, '📅 오늘의 사건'),
        h('div', { class: 'muted' }, '매일 바뀌는 자동 생성 사건. 오늘은 모두 같은 사건.'),
      ) : null,
      gen ? h('button', { class: 'mode', onClick: () => begin(mode, gen(Math.floor(Math.random() * 1e9))) },
        h('b', {}, '🎲 랜덤 사건'),
        h('div', { class: 'muted' }, '매번 새로 만드는 사건.'),
      ) : null,
    );
    draw();
  }

  function begin(mode, c) {
    enterMode(mode);
    if (DO.music) DO.music.startGame(mode.id);
    try {
      mode.start(root, { case: c });
    } catch (e) {
      console.error(e);
      render(root, h('p', {}, '오류: ' + e.message));
    }
  }

  homeBtn.addEventListener('click', () => {
    if (confirm('홈으로 가면 진행 중인 게임이 사라집니다.')) home();
  });
  helpBtn.addEventListener('click', () => {
    if (currentMode && DO.openGuide) DO.openGuide(currentMode.id);
    else if (DO.openAppGuide) DO.openAppGuide();
  });

  DO.goHome = home;
  DO.enterMode = enterMode;
  home();
})();
