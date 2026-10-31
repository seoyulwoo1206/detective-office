// 앱 셸: 홈 화면(모드 선택) → 사건 선택 → 모드 시작
// 헤더의 ❓ 버튼은 현재 모드의 설명 시트(guide.js)를 띄운다. 게임 화면은 건드리지 않는다.
(() => {
  const { h, render, modes, listCases, store } = DO;
  const root = document.getElementById('root');
  const homeBtn = document.getElementById('home');
  const helpBtn = document.getElementById('help');
  const title = document.getElementById('title');
  let currentMode = null;

  const SECTIONS = [
    { type: 'party', title: '👥 친구들과 · 폰 하나로 돌려가며' },
    { type: 'coop', title: '🤝 다 같이 한 화면으로 (혼자도 OK)' },
    { type: 'solo', title: '🧍 혼자서' },
    { type: 'daily', title: '📅 매일 새 사건' },
  ];

  function badges(meta) {
    const list = [meta.players, meta.time, meta.level, meta.needsKey ? 'API 키 필요' : null].filter(Boolean);
    return h('div', { class: 'badges' }, list.map(b => h('span', { class: 'badge' + (b === 'API 키 필요' ? ' key' : '') }, b)));
  }

  function modeCard(m) {
    const meta = DO.modeMeta ? DO.modeMeta(m.id) : {};
    return h('div', { class: 'mode-card' + (meta.type ? ' type-' + meta.type : '') },
      h('h3', {}, m.name + (m.ready ? '' : ' (준비 중)')),
      badges(meta),
      h('p', { class: 'muted' }, m.desc),
      h('div', { class: 'row' },
        h('button', { class: 'small', onClick: () => DO.openGuide && DO.openGuide(m.id) }, '❓ 설명'),
        h('button', { class: 'grow primary', disabled: !m.ready, onClick: () => startMode(m) }, '시작'),
      ),
    );
  }

  function home() {
    currentMode = null;
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

    render(root,
      h('div', { class: 'card hero' },
        h('h3', {}, '👋 처음이세요?'),
        h('p', { class: 'muted' }, '폰 하나를 돌려가며 하는 추리 파티 게임 모음입니다. 사건 하나에 용의자 여러 명, 그중 한 명이 거짓말쟁이 범인.'),
        h('div', { class: 'row' },
          h('button', { class: 'grow', onClick: () => DO.openAppGuide && DO.openAppGuide() }, '📖 게임 소개'),
          starter ? h('button', { class: 'grow primary', onClick: () => startMode(starter) }, '🚀 바로 시작') : null,
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
    if (mode.pickCase === false) return mode.start(root, {});

    const cases = listCases();
    const gen = DO.generateCase; // daily.js 가 등록하면 존재
    const meta = DO.modeMeta ? DO.modeMeta(mode.id) : {};
    render(root,
      h('div', { class: 'card' },
        h('p', {}, h('b', {}, mode.name), ' · ', h('span', { class: 'muted' }, mode.desc)),
        badges(meta),
        h('button', { class: 'small', onClick: () => DO.openGuide && DO.openGuide(mode.id) }, '❓ 이 게임 설명 보기'),
      ),
      h('h3', {}, '어떤 사건으로 할까요?'),
      h('p', { class: 'muted small-text' }, '처음이면 위에서부터. 용의자 수가 적을수록 쉽습니다.'),
      cases.map(c => h('button', { class: 'mode', onClick: () => begin(mode, c) },
        h('b', {}, c.title),
        h('div', { class: 'muted' }, `용의자 ${c.suspects.length}명 · ${c.intro.slice(0, 48)}…`),
      )),
      gen ? h('button', { class: 'mode', onClick: () => begin(mode, gen(DO.todaySeed())) },
        h('b', {}, '📅 오늘의 사건'),
        h('div', { class: 'muted' }, '매일 바뀌는 자동 생성 사건. 오늘은 모두 같은 사건.'),
      ) : null,
      gen ? h('button', { class: 'mode', onClick: () => begin(mode, gen(Math.floor(Math.random() * 1e9))) },
        h('b', {}, '🎲 랜덤 사건'),
        h('div', { class: 'muted' }, '매번 새로 만드는 사건.'),
      ) : null,
    );
  }

  function begin(mode, c) {
    enterMode(mode);
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
