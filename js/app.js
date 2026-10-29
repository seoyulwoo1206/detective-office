// 앱 셸: 홈 화면(모드 선택) → 사건 선택 → 모드 시작
(() => {
  const { h, render, modes, listCases } = DO;
  const root = document.getElementById('root');
  const homeBtn = document.getElementById('home');
  const title = document.getElementById('title');

  function home() {
    homeBtn.hidden = true;
    title.textContent = '탐정 사무소';
    render(root,
      h('p', { class: 'muted' }, '모드를 고르세요.'),
      modes.map(m => h('button', { class: 'mode', disabled: !m.ready, onClick: () => startMode(m) },
        h('b', {}, m.name + (m.ready ? '' : ' (준비 중)')),
        h('div', { class: 'muted' }, m.desc),
      )),
      h('p', { class: 'muted small-text' }, `사건 ${listCases().length}개 수록 · 폰 하나로 돌려가며 플레이`),
    );
  }

  // 사건 선택 화면. 모드가 pickCase:false 면 건너뛴다(일일 사건처럼 스스로 사건을 만드는 모드).
  function startMode(mode) {
    homeBtn.hidden = false;
    title.textContent = mode.name;
    if (mode.pickCase === false) return mode.start(root, {});

    const cases = listCases();
    const gen = DO.generateCase; // daily.js 가 등록하면 존재
    render(root,
      h('p', { class: 'muted' }, '어떤 사건으로 할까요?'),
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
    title.textContent = mode.name;
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

  DO.goHome = home;
  home();
})();
