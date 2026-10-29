// 모드 4: 일일 사건 — 씨앗값 기반 사건 자동 생성기
//
// DO.generateCase(seed) 가 핵심. 같은 씨앗 → 같은 사건.
// 생성된 사건은 다른 모드(접기/이마/AI 심문)와 똑같은 구조라서 어디서든 쓸 수 있다.
// app.js 의 사건 선택 화면에도 "오늘의 사건 / 랜덤 사건"으로 자동 노출된다.

(() => {
  const { h, render, shuffle, pick, rng, hashString } = DO;

  // ---------- 조사(助詞) ----------
  function josa(word, consonant, vowel) {
    const ch = word.charCodeAt(word.length - 1);
    if (ch < 0xAC00 || ch > 0xD7A3) return consonant; // 한글 아니면 받침형
    return (ch - 0xAC00) % 28 === 0 ? vowel : consonant;
  }
  const iga = w => w + josa(w, '이', '가');
  const eulreul = w => w + josa(w, '을', '를');

  // ---------- 재료 ----------
  const SETTINGS = [
    { time: '금요일 밤 9시', short: '금요일 밤', place: '2학년 3반 교실', item: '수학 수행평가 답안지 뭉치', where: '학교' },
    { time: '수요일 점심시간', short: '수요일 점심', place: '과학실', item: '과학 탐구 대회 실험 보고서', where: '본관 3층' },
    { time: '월요일 아침 7시 반', short: '월요일 아침', place: '교무실', item: '담임 선생님의 USB', where: '학교' },
    { time: '목요일 방과 후 5시', short: '목요일 오후', place: '미술실', item: '전국 대회 출품작', where: '학교' },
    { time: '화요일 저녁 7시', short: '화요일 저녁', place: '음악실', item: '축제 공연 악보 묶음', where: '본관' },
    { time: '금요일 오후 4시', short: '금요일 오후', place: '동아리방', item: '동아리 활동비 봉투', where: '별관' },
    { time: '토요일 오전 10시', short: '토요일 오전', place: '체육관 창고', item: '새 축구공 세트', where: '학교' },
    { time: '수요일 밤 10시', short: '수요일 밤', place: '기숙사 휴게실', item: '층 전체 간식 상자', where: '기숙사' },
    { time: '월요일 점심시간', short: '월요일 점심', place: '학생회실', item: '축제 티켓 판매 수익금', where: '학교' },
    { time: '목요일 밤 8시', short: '목요일 밤', place: '컴퓨터실', item: '코딩 대회 제출용 노트북', where: '학교' },
  ];

  // 방탈출용 현장 장소 (SETTINGS.place 별). 없으면 방탈출이 공용 장소를 쓴다.
  const SCENE_SPOTS = {
    '2학년 3반 교실': [['🪑', '교탁 서랍'], ['🗄', '사물함 위'], ['🧹', '청소도구함'], ['📏', '칠판 분필 받침']],
    '과학실': [['🧪', '실험대 밑'], ['🧴', '약품장'], ['🔬', '현미경 상자'], ['🐟', '수조 옆']],
    '교무실': [['🗄', '선생님 책상 서랍'], ['🖨', '프린터 옆'], ['☕', '커피포트 밑'], ['📁', '서류함']],
    '미술실': [['🖼', '이젤 뒤'], ['🎨', '물감 선반'], ['🗿', '석고상 뒤'], ['🧥', '앞치마 걸이']],
    '음악실': [['🎹', '피아노 뚜껑 안'], ['🎼', '악보대'], ['🥁', '드럼 세트 뒤'], ['🎸', '악기 보관함']],
    '동아리방': [['🛋', '소파 쿠션 밑'], ['🍪', '간식 상자'], ['🗄', '낡은 사물함'], ['🪟', '창틀']],
    '체육관 창고': [['🧘', '매트 더미'], ['⚽', '공 바구니'], ['🥅', '네트 자루'], ['🪜', '선반 위']],
    '기숙사 휴게실': [['📡', '전자레인지 위'], ['🛋', '소파 밑'], ['🧊', '냉장고 안'], ['📺', 'TV 뒤']],
    '학생회실': [['🪑', '회의 탁자 밑'], ['📜', '포스터 뭉치'], ['🔐', '금고 옆'], ['🖊', '화이트보드 뒤']],
    '컴퓨터실': [['🖥', '본체 뒤'], ['⌨', '키보드 서랍'], ['📽', '프로젝터 선반'], ['🔌', '콘센트 박스']],
  };

  // 용의자 역할: name + 현장에 떨어뜨릴 수 있는 소지품(증거)
  const ROLES = [
    { name: '체육부 차장', item: '체육부 호루라기' },
    { name: '도서부', item: '도서 대출 카드' },
    { name: '수학 동아리 부장', item: '수학 동아리 배지' },
    { name: '방송부', item: '방송부 출입증' },
    { name: '학생회장', item: '학생회 명찰' },
    { name: '미술부', item: '물감 묻은 손수건' },
    { name: '밴드부 보컬', item: '기타 피크' },
    { name: '반장', item: '출석부 쪽지' },
    { name: '교지 편집부', item: '취재 수첩' },
    { name: '전학생', item: '전 학교 교표' },
    { name: '요리 동아리', item: '앞치마 끈' },
    { name: '과학부', item: '실험용 고글' },
    { name: '당직 선생님', item: '당직 열쇠고리' },
    { name: '댄스부 부장', item: '공연용 리본' },
    { name: '게임 동아리', item: '게임기 스트랩' },
  ];

  // 알리바이 장소
  const PLACES = [
    { tag: 'library', name: '도서관', activity: '책 정리를' },
    { tag: 'gym', name: '체육관', activity: '공 정리를' },
    { tag: 'studio', name: '방송실', activity: '방송 준비를' },
    { tag: 'office', name: '교무실', activity: '선생님 심부름을' },
    { tag: 'music', name: '음악실', activity: '악기 연습을' },
    { tag: 'art', name: '미술실', activity: '그림 작업을' },
    { tag: 'cafeteria', name: '급식실', activity: '식판 정리를' },
    { tag: 'lab', name: '과학실', activity: '실험 뒷정리를' },
    { tag: 'field', name: '운동장', activity: '달리기를' },
    { tag: 'nurse', name: '보건실', activity: '휴식을' },
    { tag: 'council', name: '학생회실', activity: '회의 준비를' },
    { tag: 'snack', name: '매점', activity: '간식 쇼핑을' },
    { tag: 'computer', name: '컴퓨터실', activity: '과제를' },
  ];

  // 부가 특성
  const EXTRAS = [
    { tag: 'key', text: '열쇠를 가지고 있는 사람 접어', profile: '건물 열쇠를 하나 가지고 있다.' },
    { tag: 'heard', text: '수상한 소리를 들은 사람 접어', profile: '어디선가 수상한 소리를 들었지만 누군지는 못 봤다.' },
    { tag: 'phone', text: '그 시간에 휴대폰을 보고 있던 사람 접어', profile: '그 시간에 휴대폰으로 영상을 보고 있었다.' },
    { tag: 'wet', text: '신발이 젖어 있는 사람 접어', profile: '밖에 나갔다 와서 신발이 젖어 있다.' },
    { tag: 'hungry', text: '밥을 안 먹은 사람 접어', profile: '밥을 못 먹어서 배가 아주 고팠다.' },
    { tag: 'glasses', text: '안경을 쓴 사람 접어', profile: '안경을 쓴다.' },
    { tag: 'passed', text: '현장 앞을 지나간 사람 접어', profile: '현장 앞 복도를 한 번 지나갔다.' },
    { tag: 'bag', text: '큰 가방을 들고 있던 사람 접어', profile: '큼직한 가방을 들고 다녔다.' },
    { tag: 'alone', text: '그 시간에 혼자 있던 사람 접어', profile: '그 시간에 혼자 있었다.' },
    { tag: 'angry', text: '피해자에게 불만이 있는 사람 접어', profile: '사실 물건 주인에게 불만이 좀 있다.' },
  ];

  const NEUTRAL_CLUES = [
    s => `${s.place} CCTV는 그날 고장 나 있었다.`,
    s => `사라진 ${iga(s.item)} 아직 발견되지 않았다.`,
    s => `${s.time} 직후 복도에서 급한 발소리가 들렸다는 제보가 있다.`,
    s => `${s.place} 문은 잠겨 있지 않았다.`,
    s => `사건 직전까지 ${iga(s.item)} 제자리에 있었다는 목격담이 있다.`,
  ];

  // ---------- 생성기 ----------
  function generateCase(seed) {
    seed = seed >>> 0;
    const R = rng(seed);
    const S = pick(SETTINGS, R);
    const N = 5;

    const roles = shuffle(ROLES, R).slice(0, N);
    const culpritIdx = Math.floor(R() * N);
    const places = shuffle(PLACES.filter(p => p.name !== S.place), R).slice(0, N - 1); // 범인 외 4명의 장소
    const extras = shuffle(EXTRAS, R);
    const alibiIdx = Math.floor(R() * (N - 1)); // 범인이 거짓으로 주장할 장소 = places[alibiIdx]
    const alibi = places[alibiIdx];

    const suspects = [];
    let pi = 0;
    const usedTags = new Set(['scene']);
    const lateText = `${S.time} 이후에도 ${S.where}에 남아 있던 사람 접어`;

    for (let i = 0; i < N; i++) {
      const role = roles[i];
      const extra = extras[i % extras.length];
      const id = 's' + (i + 1);
      usedTags.add(extra.tag);

      if (i === culpritIdx) {
        const traits = ['scene', 'late', extra.tag];
        usedTags.add('late');
        suspects.push({
          id, name: role.name, item: role.item,
          profile: `당신이 범인이다. ${S.time}에 ${S.place}에 들어가 ${eulreul(S.item)} 가져갔다. ` +
                   `남들에겐 '${alibi.name}에 있었다'고 말할 생각이다. ${extra.profile} ` +
                   `${S.place}·${alibi.name} 조건에는 거짓말해도 된다.`,
          traits, lies: ['scene', alibi.tag],
        });
      } else {
        const place = places[pi++];
        const late = R() < 0.5;
        const traits = [place.tag, extra.tag];
        if (late) { traits.push('late'); usedTags.add('late'); }
        usedTags.add(place.tag);
        const isWitness = place === alibi;
        suspects.push({
          id, name: role.name, item: role.item,
          profile: `당신은 ${S.time}에 ${place.name}에서 ${place.activity} 했다. ` +
                   (isWitness ? `${place.name}에는 당신 혼자였다. ` : '') +
                   `${extra.profile} ` +
                   (late ? `사건 뒤에도 한참 남아 있었다. ` : `그 뒤 바로 집에 갔다. `) +
                   `${S.place}엔 안 갔다.`,
          traits, lies: [],
        });
      }
    }

    // 조건 목록 (쓰인 태그만)
    const conditions = [];
    conditions.push({ tag: 'scene', text: `${S.time}에 ${S.place}에 들어간 사람 접어` });
    if (usedTags.has('late')) conditions.push({ tag: 'late', text: lateText });
    for (const p of places) if (usedTags.has(p.tag)) conditions.push({ tag: p.tag, text: `${S.time}에 ${p.name}에 있던 사람 접어` });
    for (const e of EXTRAS) if (usedTags.has(e.tag)) conditions.push({ tag: e.tag, text: e.text });

    // 단서
    const culprit = suspects[culpritIdx];
    const witness = suspects.find(s => s.traits[0] === alibi.tag && s !== culprit);
    const clues = [
      { id: 'c1', text: `${witness.name} 증언: 그때 ${alibi.name}엔 나 혼자 있었다. 아무도 안 왔다.`, exposes: alibi.tag },
      { id: 'c2', text: `${S.place} 앞에서 ${iga(culprit.item)} 발견되었다.`, exposes: 'scene' },
      { id: 'c3', text: pick(NEUTRAL_CLUES, R)(S), exposes: null },
    ];
    // 공개 순서를 섞되, 중립 단서가 먼저 나오게 해서 바로 들통나지 않게
    const [neutral, ...rest] = [clues[2], ...shuffle([clues[0], clues[1]], R)];
    const orderedClues = [neutral, ...rest];

    // item 필드는 생성용이므로 제거
    for (const s of suspects) delete s.item;

    return {
      id: 'gen-' + seed,
      seed,
      generated: true,
      title: `${S.short}, ${S.place}에서 사라진 ${S.item}`,
      intro: `${S.time}, ${S.place}에서 ${iga(S.item)} 사라졌다. 당시 ${S.where}에 남아 있던 사람은 ${N}명. 범인은 그중 한 명이다.`,
      culprit: culprit.id,
      scene: { name: S.place, spots: SCENE_SPOTS[S.place] || [] },
      suspects, conditions, clues: orderedClues,
    };
  }

  function todaySeed() {
    // 로컬 날짜 YYYY-MM-DD 기준. 같은 날이면 모두 같은 사건.
    return hashString('daily:' + new Date().toLocaleDateString('sv'));
  }

  DO.generateCase = generateCase;
  DO.todaySeed = todaySeed;

  // ---------- 모드 화면: 오늘의 사건 미리보기 + 플레이할 모드 선택 ----------
  DO.registerMode({
    id: 'daily',
    name: '일일 사건',
    desc: '매일 자동 생성되는 새 사건. 씨앗 번호를 공유하면 친구와 같은 사건을 할 수 있다.',
    ready: true,
    pickCase: false,
    start(root) {
      show(generateCase(todaySeed()), true);

      function show(C, isToday) {
        const seedInput = h('input', { type: 'number', placeholder: '씨앗 번호', value: String(C.seed) });
        const playable = DO.modes.filter(m => m.ready && m.pickCase !== false && m.id !== 'daily');
        render(root,
          h('p', { class: 'muted' }, isToday ? `📅 오늘의 사건 (${new Date().toLocaleDateString('ko')})` : `🎲 씨앗 ${C.seed}`),
          h('div', { class: 'card' },
            h('h2', {}, C.title),
            h('p', {}, C.intro),
            h('p', { class: 'muted' }, '용의자: ' + C.suspects.map(s => s.name).join(', ')),
            h('p', { class: 'muted small-text' }, `조건 ${C.conditions.length}개 · 단서 ${C.clues.length}장 · 씨앗 ${C.seed}`),
          ),
          h('h3', {}, '이 사건으로 플레이'),
          playable.map(m => h('button', { class: 'mode', onClick: () => {
            document.getElementById('title').textContent = m.name;
            m.start(root, { case: C });
          } }, h('b', {}, m.name), h('div', { class: 'muted' }, m.desc))),
          h('h3', {}, '다른 사건'),
          h('button', { onClick: () => show(generateCase(Math.floor(Math.random() * 1e9)), false) }, '🎲 랜덤 사건 만들기'),
          h('div', { class: 'row' },
            seedInput,
            h('button', { class: 'small', onClick: () => {
              const n = parseInt(seedInput.value, 10);
              if (Number.isNaN(n)) return alert('숫자를 입력하세요.');
              show(generateCase(n), false);
            } }, '씨앗으로 만들기'),
          ),
          isToday ? null : h('button', { onClick: () => show(generateCase(todaySeed()), true) }, '📅 오늘의 사건으로'),
        );
      }
    },
  });
})();
