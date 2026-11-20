// 모드 5: 방탈출 (협동 · 혼자도 가능)
//
// 사건 현장을 "방" 하나로 만든다. 방 안의 장소를 뒤지면 용의자 진술서, 단서, 잠긴 상자의 힌트가 나온다.
// 손전등 배터리(행동 횟수)가 다 떨어지기 전에 범인을 찾아야 한다.
// 비밀 정보가 없으므로 폰 하나를 다 같이 보면서 토론하는 협동 모드다.
//
// 흐름
//  1. 난이도(배터리) 선택 → 방 입장
//  2. 장소 뒤지기 (배터리 1): 진술서 / 단서 / 잡동사니 / 자물쇠 힌트 중 하나가 나온다
//     - 진술서: 그 용의자가 사건의 각 조건에 "그렇다/아니다"라고 말한 것. 범인만 거짓말이 섞여 있다.
//     - 잠긴 상자: 가장 결정적인 단서가 들어 있다. 번호는 진술서를 세어야 알 수 있다. 시도마다 배터리 1
//  3. 단서 대조 (배터리 2, 한 번만): 찾은 단서와 진술서를 조건별로 표로 정리해 준다
//  4. 범인 지목 → 결과. 남은 배터리로 별점
//
// 방 배치는 사건 id 로 시드를 만들어 같은 사건이면 항상 같다.

(() => {
  const { h, render, shuffle, rng, hashString } = DO;

  const LEVELS = [
    { battery: 20, label: '쉬움', desc: '배터리 20 — 거의 다 뒤질 수 있다' },
    { battery: 15, label: '보통', desc: '배터리 15 — 어디를 뒤질지 골라야 한다' },
    { battery: 12, label: '어려움', desc: '배터리 12 — 진술서를 다 못 본다' },
  ];
  const COMPARE_COST = 2;

  const SPOT_POOL = [
    ['🪑', '책상 위'], ['🗄', '서랍 안'], ['🗑', '쓰레기통'], ['🪟', '창가 커튼 뒤'], ['📌', '게시판'],
    ['📚', '책장 사이'], ['🧹', '바닥 깔개 밑'], ['🪴', '화분 옆'], ['🧥', '걸린 외투 주머니'], ['🕰', '벽시계 뒤'],
    ['🎒', '가방 안'], ['📦', '상자 더미'], ['🚪', '문 뒤'], ['💺', '의자 밑'], ['🪞', '거울 뒤'],
  ];
  const JUNK = [
    '먹다 남은 과자 봉지. 사건과는 관계없어 보인다.',
    '작년 날짜가 찍힌 영수증. 아무 의미 없다.',
    '누군가 떨어뜨린 머리끈 하나.',
    '먼지만 잔뜩 쌓여 있다. 재채기가 난다.',
    '"시험 망함"이라고 적힌 낙서 메모. 사건과 무관.',
    '빈 물병. 누구 것인지 알 수 없다.',
    '구겨진 체육복. 냄새가 좀 난다.',
  ];

  // "~한 사람 접어" → "~한 사람"
  const strip = c => c.text.replace(/\s*접어\s*$/, '');
  // 용의자가 그 조건에 대해 "그렇다"고 말하는가 (범인은 lies 태그에서 반대로 말한다)
  const claims = (s, tag) => s.traits.includes(tag) !== s.lies.includes(tag);

  const ITEM_META = {
    statement: { emoji: '📝', label: '진술서' },
    clue: { emoji: '🗂', label: '단서' },
    hint: { emoji: '🔢', label: '자물쇠 힌트' },
    junk: { emoji: '🧦', label: '잡동사니' },
  };

  function buildRoom(C) {
    const random = rng(hashString('escape:' + C.id));
    // 잠긴 상자에는 범인을 폭로하는 단서 중 마지막 것을 넣는다
    const exposing = C.clues.filter(c => c.exposes);
    const boxClue = (exposing.length ? exposing : C.clues).slice(-1)[0];
    const freeClues = C.clues.filter(c => c !== boxClue);
    // 자물쇠 번호: 앞 조건 최대 3개에 대해 "그렇다"고 진술한 사람 수
    const codeConds = C.conditions.slice(0, Math.min(3, C.conditions.length));
    const code = codeConds.map(c => C.suspects.filter(s => claims(s, c.tag)).length % 10).join('');

    const items = [
      ...C.suspects.map(s => ({ kind: 'statement', suspect: s })),
      ...freeClues.map(c => ({ kind: 'clue', clue: c })),
      { kind: 'hint', conds: codeConds },
      ...shuffle(JUNK, random).slice(0, 2).map(t => ({ kind: 'junk', text: t })),
    ];
    // 사건에 scene.spots 가 있으면 그 장소를 먼저 쓰고, 모자라는 만큼 공용 장소로 채운다
    const own = (C.scene && Array.isArray(C.scene.spots)) ? C.scene.spots : [];
    const places = [...shuffle(own, random), ...shuffle(SPOT_POOL, random)];
    const spots = shuffle(items, random).map((item, i) => {
      const p = places[i % places.length];
      return { emoji: p[0], name: p[1], item, searched: false };
    });
    spots.push({ emoji: '🔒', name: '잠긴 상자', locked: true, item: { kind: 'clue', clue: boxClue }, searched: false });
    return { spots, code, codeConds };
  }

  DO.registerMode({
    id: 'escape',
    name: '방탈출',
    desc: '협동. 사건 현장을 뒤져 진술서와 단서를 모으고, 배터리가 떨어지기 전에 범인을 찾는다. 1~6명.',
    ready: true,
    start(root, ctx) {
      const C = ctx.case;
      const room = buildRoom(C);
      // 모험 모드(career.js)에서 부를 때: { level: 0~2, batteryBonus, freeCompare, onDone({ win, stars }) } — 난이도 화면을 건너뛰고 바로 방으로.
      const P = ctx.preset || null;
      let level = P ? LEVELS[Math.max(0, Math.min(LEVELS.length - 1, P.level | 0))] : LEVELS[1];
      let battery = 0;
      let entered = false;
      let compared = false;
      // 역할 분담: 2명 이상이면 뒤질 곳을 사람별로 나눈다 (잠긴 상자는 공용). null 이면 다 같이.
      let teamMode = false;
      let players = null;

      const TEAM_MIN = 2, TEAM_MAX = 4;
      function assignSpots(names) {
        players = names;
        room.spots.filter(sp => !sp.locked).forEach((sp, i) => { sp.owner = i % names.length; });
      }
      const ownerName = sp => (players && sp.owner != null) ? players[sp.owner] : null;

      const found = () => room.spots.filter(s => s.searched).map(s => s.item);
      const foundClues = () => found().filter(i => i.kind === 'clue').map(i => i.clue);
      const foundStatements = () => found().filter(i => i.kind === 'statement').map(i => i.suspect);
      const hintItem = () => found().find(i => i.kind === 'hint');
      const dead = () => battery <= 0;

      // ---------- 1. 난이도 ----------
      function levelSelect() {
        render(root,
          h('h2', {}, C.title),
          h('div', { class: 'card' }, h('p', {}, C.intro)),
          h('div', { class: 'card' },
            h('h3', {}, '규칙'),
            h('p', { class: 'muted' }, '· 현장의 장소를 하나 뒤질 때마다 손전등 배터리 1이 줄어듭니다.'),
            h('p', { class: 'muted' }, '· 용의자 진술서는 사건 조건에 대한 그 사람의 주장입니다. 범인의 진술에만 거짓이 섞여 있습니다.'),
            h('p', { class: 'muted' }, '· 단서와 진술서를 맞춰 보면 누가 거짓말을 하는지 보입니다.'),
            h('p', { class: 'muted' }, '· 잠긴 상자에는 결정적 단서가 있습니다. 번호는 진술서를 세어 알아냅니다.'),
            h('p', { class: 'muted' }, '· 배터리가 다 떨어지면 더는 뒤질 수 없고 범인을 지목해야 합니다. 지목 기회는 한 번.'),
          ),
          h('h3', {}, '난이도'),
          LEVELS.map(L => h('button', { class: 'mode' + (L === level ? ' primary' : ''), onClick: () => { level = L; levelSelect(); } },
            h('b', {}, L.label), h('div', { class: L === level ? '' : 'muted' }, L.desc))),
          h('h3', {}, '인원'),
          h('div', { class: 'row' },
            h('button', { class: 'grow' + (!teamMode ? ' primary' : ''), onClick: () => { teamMode = false; levelSelect(); } }, '👥 다 같이 한 폰으로'),
            h('button', { class: 'grow' + (teamMode ? ' primary' : ''), onClick: () => { teamMode = true; levelSelect(); } }, `🧭 역할 나누기 (${TEAM_MIN}~${TEAM_MAX}명)`),
          ),
          h('p', { class: 'muted small-text' }, teamMode
            ? '뒤질 곳을 사람별로 나눕니다. 자기 담당 장소는 본인이 직접 뒤지고, 찾은 내용은 말로 공유하세요. 잠긴 상자·수첩·대조는 공용.'
            : '폰 하나를 다 같이 보면서 토론합니다.'),
          h('p', { class: 'muted small-text' }, `용의자 ${C.suspects.length}명 · 뒤질 곳 ${room.spots.length}곳`),
          h('button', { class: 'primary', onClick: () => {
            battery = level.battery;
            if (!teamMode) { players = null; room.spots.forEach(sp => { delete sp.owner; }); return roomScreen(); }
            DO.nameEntry(root, {
              min: TEAM_MIN, max: TEAM_MAX,
              title: '🧭 역할 나누기',
              intro: '참가자 이름을 넣으면 뒤질 곳을 고르게 나눠 줍니다.',
              note: `플레이어 ${TEAM_MIN}~${TEAM_MAX}명. 담당 장소는 본인만 뒤집니다.`,
              onStart: names => { assignSpots(names); roomScreen(); },
            });
          } }, '🔦 방에 들어가기'),
        );
      }

      // ---------- 2. 방 ----------
      function roomScreen(notice) {
        if (!entered) { entered = true; if (DO.sfx) DO.sfx('flash'); } // 처음 들어갈 때 손전등 딸깍
        if (DO.music) { const r = battery / level.battery; DO.music.intensity(r <= 0.2 ? 2 : r <= 0.5 ? 1 : 0); }
        render(root,
          h('div', { class: 'row' },
            h('h2', { class: 'grow' }, '🚪 ' + ((C.scene && C.scene.name) || '사건 현장')),
            h('span', { class: 'battery' }, `🔦 ${battery}/${level.battery}`)),
          notice ? h('div', { class: 'card alert' }, h('p', {}, notice)) : null,
          dead() ? h('div', { class: 'card alert' }, h('p', {}, h('b', {}, '배터리가 다 됐습니다.'), ' 찾은 것은 다시 볼 수 있습니다. 이제 범인을 지목하세요.')) : null,
          players ? h('div', { class: 'badges' }, players.map((n, i) => {
            const mine = room.spots.filter(sp => sp.owner === i);
            const left = mine.filter(sp => !sp.searched).length;
            return h('span', { class: 'badge owner-' + i }, `${n} · 남은 곳 ${left}/${mine.length}`);
          })) : null,
          h('div', { class: 'spots' }, room.spots.map(sp => {
            const meta = sp.searched ? ITEM_META[sp.item.kind] : null;
            const who = ownerName(sp);
            return h('button', {
              class: 'spot' + (sp.searched ? ' done' : '') + (sp.owner != null ? ' owner-' + sp.owner : ''),
              disabled: dead() && !sp.searched,
              onClick: () => openSpot(sp),
            },
              h('span', { class: 'emoji' }, sp.searched ? meta.emoji : sp.emoji),
              h('span', {}, sp.name),
              h('span', { class: 'muted small-text' }, sp.searched ? meta.label : (sp.locked ? '번호 자물쇠' : '안 뒤짐')),
              players ? h('span', { class: 'who' }, who ? '👤 ' + who : '공용') : null,
            );
          })),
          h('div', { class: 'row' },
            h('button', { class: 'grow', onClick: notebook }, `📓 수첩 (${found().length})`),
            h('button', { class: 'grow', onClick: compare }, compared ? '🔍 단서 대조' : (P && P.freeCompare ? '🔍 대조 (무료)' : `🔍 대조 (🔦${COMPARE_COST})`)),
          ),
          h('button', { class: 'danger', onClick: accuse }, '🎯 범인 지목'),
        );
      }

      function spend(n = 1) {
        battery = Math.max(0, battery - n);
        if (battery > 0 && battery <= 3 && DO.sfx) DO.sfx('battery', { delay: 0.6 }); // 배터리 경고
      }

      function openSpot(sp) {
        if (sp.searched) return showItem(sp, false);
        if (sp.locked) return boxScreen(sp);
        if (dead()) return roomScreen();
        const who = ownerName(sp);
        if (who) {
          // 역할 분담: 담당자에게 폰을 넘긴 뒤 뒤진다
          return DO.handOff(root, who, `${sp.emoji} ${sp.name}은(는) ${who}님 담당입니다. 본인이 직접 뒤지세요.`, () => search(sp));
        }
        search(sp);
      }

      function search(sp) {
        if (DO.sfx) DO.sfx('rummage');
        spend(1);
        sp.searched = true;
        showItem(sp, true);
      }

      function itemView(item) {
        if (item.kind === 'statement') {
          const s = item.suspect;
          return [
            h('div', { class: 'profile-head' }, DO.face(C, s, 52), h('h2', {}, `📝 ${s.name}의 진술서`)),
            h('div', { class: 'card statement' },
              C.conditions.map(c => {
                const yes = claims(s, c.tag);
                return h('p', {}, yes ? '⭕ ' : '❌ ', `나는 ${strip(c)}`, yes ? '이다.' : '이 아니다.');
              }),
            ),
            h('p', { class: 'muted small-text' }, '범인이라면 이 중 일부가 거짓말입니다. 나머지 사람은 전부 사실입니다.'),
          ];
        }
        if (item.kind === 'clue') {
          const c = item.clue;
          const cond = C.conditions.find(x => x.tag === c.exposes);
          return [
            h('h2', {}, '🗂 단서'),
            h('div', { class: 'card good' }, h('p', {}, c.text)),
            cond ? h('p', { class: 'muted' }, '관련 조건: ', h('b', {}, strip(cond))) : h('p', { class: 'muted' }, '정황 단서. 특정 조건과 직접 연결되지는 않는다.'),
          ];
        }
        if (item.kind === 'hint') {
          return [
            h('h2', {}, '🔢 자물쇠 힌트'),
            h('div', { class: 'card secret' },
              h('p', {}, h('b', {}, `잠긴 상자의 번호는 ${item.conds.length}자리.`)),
              h('p', {}, '진술서에서 다음을 "그렇다(⭕)"고 한 사람의 수를 순서대로 적으면 열린다.'),
              item.conds.map((c, i) => h('p', {}, `${i + 1}) ${strip(c)}`)),
            ),
            h('p', { class: 'muted small-text' }, '진술서를 못 찾은 사람 몫은 추측해야 합니다.'),
          ];
        }
        return [
          h('h2', {}, '🧦 잡동사니'),
          h('div', { class: 'card' }, h('p', {}, item.text)),
        ];
      }

      function showItem(sp, fresh) {
        // 뒤지는 소리(rummage) 뒤에 무엇을 찾았는지 소리로
        if (fresh && DO.sfx) DO.sfx({ statement: 'paper', clue: 'reveal', hint: 'reveal', junk: 'empty' }[sp.item.kind] || 'paper', { delay: 0.32 });
        render(root,
          h('p', { class: 'muted small-text' }, `${sp.emoji} ${sp.name}${fresh ? '을(를) 뒤졌다.' : ' (다시 보기)'} · 🔦 ${battery}`),
          itemView(sp.item),
          fresh && dead() ? h('div', { class: 'card alert' }, h('p', {}, '배터리가 다 됐습니다. 이제 범인을 지목해야 합니다.')) : null,
          h('button', { class: 'primary', onClick: () => roomScreen() }, '방으로 돌아가기'),
        );
      }

      // ---------- 잠긴 상자 ----------
      function boxScreen(sp, message) {
        const hint = hintItem();
        const input = h('input', { type: 'tel', inputmode: 'numeric', maxlength: room.code.length, placeholder: '0'.repeat(room.code.length), autocomplete: 'off' });
        const tryOpen = () => {
          if (dead()) return roomScreen();
          const v = input.value.trim();
          if (v.length !== room.code.length) return DO.toast(`${room.code.length}자리 번호를 입력하세요.`);
          spend(1);
          if (v === room.code) {
            sp.searched = true; sp.locked = false;
            render(root,
              h('h2', { class: 'center' }, '🔓 상자가 열렸다!'),
              itemView(sp.item),
              dead() ? h('div', { class: 'card alert' }, h('p', {}, '배터리가 다 됐습니다. 이제 범인을 지목해야 합니다.')) : null,
              h('button', { class: 'primary', onClick: () => roomScreen() }, '방으로 돌아가기'),
            );
            DO.fx && DO.fx.good(root.querySelector('h2'), 'unlock');
          } else {
            if (DO.fx) setTimeout(() => DO.fx.fail(), 0);
            boxScreen(sp, `❌ ${v} — 열리지 않는다. (배터리 -1)`);
          }
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') tryOpen(); });
        render(root,
          h('h2', {}, '🔒 잠긴 상자'),
          h('p', { class: 'muted' }, `${room.code.length}자리 번호 자물쇠가 걸려 있다. 시도할 때마다 배터리 1. · 🔦 ${battery}`),
          message ? h('div', { class: 'card alert' }, h('p', {}, message)) : null,
          hint
            ? h('div', { class: 'card secret' },
              h('p', { class: 'muted small-text' }, '찾은 힌트'),
              h('p', {}, '진술서에서 "그렇다(⭕)"고 한 사람 수를 순서대로:'),
              hint.conds.map((c, i) => h('p', {}, `${i + 1}) ${strip(c)}`)))
            : h('p', { class: 'muted small-text' }, '아직 힌트를 못 찾았다. 방 어딘가에 번호 힌트가 있을 것이다. 물론 찍어 볼 수도 있다.'),
          dead() ? null : h('div', { class: 'row' }, input, h('button', { class: 'small primary', onClick: tryOpen }, '열기')),
          h('button', { onClick: () => roomScreen() }, '돌아가기'),
        );
      }

      // ---------- 수첩 ----------
      function notebook() {
        const clues = foundClues();
        const sts = foundStatements();
        const hint = hintItem();
        render(root,
          h('h2', {}, '📓 탐정 수첩'),
          h('h3', {}, `단서 ${clues.length}/${C.clues.length}`),
          clues.length ? clues.map(c => h('div', { class: 'card good' }, h('p', {}, c.text))) : h('p', { class: 'muted' }, '아직 없음'),
          h('h3', {}, `진술서 ${sts.length}/${C.suspects.length}`),
          sts.length ? sts.map(s => h('div', { class: 'card statement' },
            h('b', {}, s.name),
            C.conditions.map(c => h('p', { class: 'muted small-text' }, claims(s, c.tag) ? '⭕ ' : '❌ ', strip(c))),
          )) : h('p', { class: 'muted' }, '아직 없음'),
          h('p', { class: 'muted small-text' }, '진술서 못 찾은 사람: ' + (C.suspects.filter(s => !sts.includes(s)).map(s => s.name).join(', ') || '없음')),
          hint ? h('div', { class: 'card secret' }, h('p', {}, '🔢 자물쇠 힌트: ' + hint.conds.map((c, i) => `${i + 1}) ${strip(c)}`).join(' / '))) : null,
          h('button', { class: 'primary', onClick: () => roomScreen() }, '방으로 돌아가기'),
        );
      }

      // ---------- 단서 대조 ----------
      function compare() {
        const clues = foundClues().filter(c => c.exposes);
        if (!compared) {
          if (!clues.length) return roomScreen('조건과 연결된 단서를 먼저 하나 이상 찾아야 대조할 수 있습니다.');
          const cost = P && P.freeCompare ? 0 : COMPARE_COST;
          if (battery < cost) return roomScreen(`배터리가 ${cost} 이상 필요합니다.`);
          if (cost) spend(cost);
          compared = true;
        }
        const sts = foundStatements();
        render(root,
          h('h2', {}, '🔍 단서 대조'),
          h('p', { class: 'muted' }, '단서가 가리키는 조건에 대해 각 용의자가 뭐라고 진술했는지 모았습니다. 단서와 어긋나는 사람이 있는지 보세요.'),
          clues.length ? clues.map(c => {
            const cond = C.conditions.find(x => x.tag === c.exposes);
            return h('div', { class: 'card' },
              h('p', {}, h('b', {}, '단서: '), c.text),
              h('p', { class: 'muted' }, '조건: ', strip(cond)),
              C.suspects.map(s => h('div', { class: 'player' },
                h('span', {}, s.name),
                h('span', { class: 'muted' }, sts.includes(s) ? (claims(s, cond.tag) ? '⭕ 그렇다' : '❌ 아니다') : '진술서 없음'),
              )),
            );
          }) : h('p', { class: 'muted' }, '조건과 연결된 단서를 아직 못 찾았습니다.'),
          h('button', { class: 'primary', onClick: () => roomScreen() }, '방으로 돌아가기'),
        );
      }

      // ---------- 4. 지목 ----------
      function accuse() {
        render(root,
          h('h2', {}, '🎯 범인은…'),
          h('p', { class: 'muted' }, '기회는 한 번. 다 같이 합의하고 누르세요.'),
          C.suspects.map(s => h('button', { onClick: () => {
            if (confirm(`${s.name}을(를) 범인으로 지목합니까?`)) finish(s);
          } }, s.name)),
          h('button', { onClick: () => roomScreen() }, '돌아가기'),
        );
        DO.music && DO.music.hold('suspense');
      }

      function finish(target) {
        const culprit = C.suspects.find(s => s.id === C.culprit);
        const win = target.id === culprit.id;
        const ratio = battery / level.battery;
        const stars = !win ? 0 : ratio >= 0.5 ? 3 : ratio >= 0.2 ? 2 : 1;
        render(root,
          h('h2', {}, win ? '🎉 탈출 성공!' : '❌ 탈출 실패'),
          h('div', { class: 'card ' + (win ? 'good' : 'alert') + ' center' },
            h('div', { class: 'big' }, win ? '⭐'.repeat(stars) : '🔒'),
            h('p', {}, h('b', {}, win ? `${culprit.name}이(가) 범인이었습니다.` : `${target.name}은(는) 범인이 아닙니다. 진짜 범인은 ${culprit.name}.`)),
            h('p', { class: 'muted' }, `난이도 ${level.label} · 남은 배터리 ${battery}/${level.battery} · 단서 ${foundClues().length}/${C.clues.length} · 진술서 ${foundStatements().length}/${C.suspects.length}`),
            players ? h('p', { class: 'muted small-text' }, '뒤진 곳: ' + players.map((n, i) => `${n} ${room.spots.filter(sp => sp.owner === i && sp.searched).length}곳`).join(' · ')) : null,
          ),
          h('h3', {}, '범인의 거짓말'),
          h('div', { class: 'card alert' },
            culprit.lies.length
              ? culprit.lies.map(tag => {
                const cond = C.conditions.find(c => c.tag === tag);
                const truth = culprit.traits.includes(tag);
                return cond ? h('p', {}, `· "${strip(cond)}${truth ? '이 아니다' : '이다'}"라고 했지만 사실은 ${truth ? '그렇다' : '아니다'}.`) : null;
              })
              : h('p', { class: 'muted' }, '(기록 없음)'),
          ),
          h('h3', {}, '전원 프로필'),
          C.suspects.map(s => h('div', { class: 'card explain' + (s === culprit ? ' alert' : '') },
            DO.face(C, s, 44),
            h('div', { class: 'grow' }, h('b', {}, s.name), h('p', { class: 'muted' }, s.profile)))),
          P ? h('button', { class: 'primary', onClick: () => P.onDone({ win, stars }) }, '📒 수첩으로 돌아가기')
            : h('button', { class: 'primary', onClick: () => DO.goHome() }, '처음으로'),
        );
        if (DO.fx) DO.fx.ending(win);
      }

      if (P) { battery = level.battery + (P.batteryBonus | 0); roomScreen(); } else levelSelect();
    },
  });
})();
