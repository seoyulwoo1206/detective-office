// 모드 8: 명탐정의 길 (혼자 하는 모험 · RPG 식 성장)
//
// 수습 탐정으로 등록해 5장 21사건을 차례로 깬다. 사건은 기존 혼자 모드 두 가지를 그대로 쓴다:
//   🧩 알리바이 깨기(alibi.js, 난이도 0~3)  🔦 방탈출(escape.js, 난이도 0~2) — 둘 다 ctx.preset 으로 불러서 결과를 돌려받는다.
// 사건을 깨면 별(1~3)에 따라 경험치 → 레벨 업 → 능력 포인트 → 능력(힌트 감점 줄이기, 기회 +1, 배터리 +3 …).
// 장마다 마지막은 보스 사건. 보스를 잡으면 다음 장이 열리고, 장 사이사이에 '그림자'를 쫓는 짧은 이야기가 나온다.
// 오늘의 의뢰: 날짜로 만든 자동 생성 사건 3건(하루 한 번씩) — 이야기와 별개로 경험치를 모은다.
// 저장: do:career = { name, xp, perks{id:랭크}, best{stageId:별}, plays{stageId:횟수}, seen{장id:true}, quests{date, done[]} }

(() => {
  const { h, render, store } = DO;
  const sfx = (n, o) => { if (DO.sfx) DO.sfx(n, o); };
  const KEY = 'career';
  const ALIBI = 'alibi', ESCAPE = 'escape';
  const LV = { alibi: ['입문', '보통', '어려움', '전설'], escape: ['쉬움', '보통', '어려움'] };
  const TYPE = { alibi: { icon: '🧩', name: '알리바이 깨기' }, escape: { icon: '🔦', name: '방탈출' } };

  // ---------- 이야기와 사건 ----------
  const CHAPTERS = [
    {
      id: 'c1', title: '1장 · 수습 탐정의 첫 출근', place: '🏫 학교',
      story: '오늘부터 탐정 사무소의 수습 탐정. 소장님이 건넨 첫 파일은 학교에서 온 작은 의뢰들이다. "작은 거짓말부터 잡아 봐. 큰 거짓말도 결국 같은 모양이니까."',
      clear: '사건을 정리하던 중 파일 사이에서 검은 카드 한 장이 떨어졌다. "제법이네, 수습. — 그림자" 누군가 지켜보고 있다.',
      stages: [{ c: 'case-001', t: ALIBI, lv: 0 }, { c: 'case-002', t: ESCAPE, lv: 0 }, { c: 'case-003', t: ALIBI, lv: 0 }, { c: 'case-004', t: ESCAPE, lv: 0 }, { c: 'case-017', t: ALIBI, lv: 1, boss: true }],
    },
    {
      id: 'c2', title: '2장 · 골목길의 소문', place: '🏡 동네',
      story: '동네에 이상한 소문이 돈다. 사건이 날 때마다 근처에서 검은 장갑을 낀 사람을 봤다는 것. 그냥 우연일까?',
      clear: '범인은 잡았지만 "누가 시켰다"는 말만 되풀이했다. 그의 주머니에서 또 검은 카드. "다음은 가게들이야."',
      stages: [{ c: 'case-005', t: ALIBI, lv: 1 }, { c: 'case-006', t: ESCAPE, lv: 1 }, { c: 'case-009', t: ALIBI, lv: 1 }, { c: 'case-006', t: ALIBI, lv: 2, boss: true }],
    },
    {
      id: 'c3', title: '3장 · 가게 뒤편의 비밀', place: '🏢 가게·시설',
      story: '편의점, 병원, 도서관, 호텔. 가게 뒤편에서 사건이 줄줄이 터진다. 그림자가 예고한 그대로다.',
      clear: '호텔 범인의 수첩에 적힌 다음 장소는 축제와 공항. 그림자는 판을 키우고 있다.',
      stages: [{ c: 'case-008', t: ALIBI, lv: 1 }, { c: 'case-010', t: ESCAPE, lv: 1 }, { c: 'case-011', t: ALIBI, lv: 2 }, { c: 'case-014', t: ALIBI, lv: 2, boss: true }],
    },
    {
      id: 'c4', title: '4장 · 축제와 여행', place: '✈️ 모임·여행',
      story: '축제 날의 인파, 공항의 북적임. 사람이 많을수록 거짓말은 숨기 쉽다. 표를 한 칸도 빼먹지 마라.',
      clear: '공항 CCTV에 그림자의 뒷모습이 찍혔다. 마지막 카드: "온라인에서 기다릴게. 진짜 실력을 보여 줘."',
      stages: [{ c: 'case-007', t: ESCAPE, lv: 2 }, { c: 'case-016', t: ALIBI, lv: 2 }, { c: 'case-013', t: ESCAPE, lv: 2 }, { c: 'case-015', t: ALIBI, lv: 2, boss: true }],
    },
    {
      id: 'c5', title: '5장 · 그림자의 정체', place: '🎮 온라인',
      story: '그림자는 게임 길드에 숨어 있다. 이번엔 범행 시각마저 숨겨져 있다. 누가, 그리고 언제 — 둘 다 맞혀야 한다.',
      clear: '마지막 알리바이가 무너졌다. 그림자의 정체는… 늘 사건 파일을 건네던 소장님. "네가 명탐정이 될 수 있는지 시험해 본 거야. 합격이다, 명탐정."',
      stages: [{ c: 'case-012', t: ALIBI, lv: 2 }, { c: 'case-001', t: ALIBI, lv: 3 }, { c: 'case-010', t: ALIBI, lv: 3 }, { c: 'case-012', t: ALIBI, lv: 3, boss: true }],
    },
  ];
  CHAPTERS.forEach((ch, ci) => ch.stages.forEach((st, si) => { st.id = `${ch.id}-${si + 1}`; st.ci = ci; st.si = si; st.n = 0; }));
  const ALL = CHAPTERS.flatMap(ch => ch.stages);
  ALL.forEach((st, k) => { st.n = k; });

  // ---------- 성장 ----------
  const RANKS = [[1, '수습 탐정'], [3, '신참 탐정'], [5, '형사'], [7, '경위'], [9, '명탐정'], [12, '전설의 탐정']];
  const MAX_LEVEL = 15;
  const need = L => 100 + 60 * (L - 1);                    // L → L+1 에 필요한 경험치
  function levelOf(xp) {
    let L = 1, left = xp;
    while (L < MAX_LEVEL && left >= need(L)) { left -= need(L); L++; }
    return { L, into: left, need: L < MAX_LEVEL ? need(L) : 0 };
  }
  const rankOf = L => RANKS.filter(([l]) => L >= l).pop()[1];
  const PERKS = [
    { id: 'lens', icon: '🔍', name: '돋보기', max: 2, text: r => `알리바이 힌트 감점 15 → ${15 - 5 * r}점` },
    { id: 'gut', icon: '🔮', name: '직감', max: 2, text: r => `알리바이 사건을 시작할 때 결백한 사람 ${r}명이 미리 보인다 (감점 없음)` },
    { id: 'calm', icon: '🛡', name: '침착함', max: 1, text: () => '알리바이 지목 기회 2번 → 3번' },
    { id: 'torch', icon: '🔦', name: '예비 배터리', max: 2, text: r => `방탈출 배터리 +${3 * r}` },
    { id: 'note', icon: '📓', name: '꼼꼼한 수첩', max: 1, text: () => '방탈출 단서 대조가 무료' },
    { id: 'fame', icon: '⭐', name: '명성', max: 2, text: r => `얻는 경험치 +${15 * r}%` },
  ];
  const STAR_K = [0, 0.6, 0.8, 1];
  const baseXP = st => 40 + 30 * st.lv + (st.boss ? 60 : 0);

  // ---------- 저장 ----------
  const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x);
  const nums = (o, max) => (isObj(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => Number.isFinite(v) && v >= 0).map(([k, v]) => [k, Math.min(max, Math.floor(v))])) : {});
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function load() {
    const d = store.get(KEY, {});
    const q = isObj(d.quests) && d.quests.date === today() && Array.isArray(d.quests.done) ? d.quests : { date: today(), done: [] };
    const data = {
      name: typeof d.name === 'string' ? d.name.trim().slice(0, 12) : '',
      xp: Number.isFinite(d.xp) && d.xp >= 0 ? Math.floor(d.xp) : 0,
      perks: nums(d.perks, 9), best: nums(d.best, 3), plays: nums(d.plays, 9999),
      seen: isObj(d.seen) ? d.seen : {},
      quests: { date: q.date, done: q.done.filter(x => Number.isInteger(x)) },
    };
    for (const p of PERKS) if (data.perks[p.id] > p.max) data.perks[p.id] = p.max;
    return data;
  }
  const save = d => store.set(KEY, d);

  // ---------- 모드 ----------
  const MODE = {
    id: 'career',
    name: '명탐정의 길',
    desc: '혼자 하는 모험. 수습 탐정으로 시작해 사건을 하나씩 깨며 레벨을 올리고 능력을 배운다. 5장 21사건 + 오늘의 의뢰.',
    ready: true,
    pickCase: false,
    start(root) {
      let D = load();
      const rank = id => D.perks[id] | 0;
      const spent = () => PERKS.reduce((s, p) => s + rank(p.id), 0);
      const points = () => levelOf(D.xp).L - 1 - spent();
      const cleared = st => (D.best[st.id] | 0) > 0;
      const chapterOpen = ci => ci === 0 || cleared(CHAPTERS[ci - 1].stages[CHAPTERS[ci - 1].stages.length - 1]);
      const stageOpen = st => chapterOpen(st.ci) && (st.si === 0 || cleared(CHAPTERS[st.ci].stages[st.si - 1]));
      const starsIn = ch => ch.stages.reduce((s, st) => s + (D.best[st.id] | 0), 0);
      const clearedCount = () => ALL.filter(cleared).length;
      const nextStage = () => ALL.find(st => stageOpen(st) && !cleared(st)) || null;
      const caseOf = st => st.case || DO.getCase(st.c);
      const starText = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);
      const back = (label, fn) => h('button', { onClick: fn }, label);

      // ---------- 탐정증 (허브) ----------
      function idCard() {
        const lv = levelOf(D.xp);
        const pct = lv.need ? Math.round(100 * lv.into / lv.need) : 100;
        return h('div', { class: 'card id-card' },
          h('div', { class: 'id-top' },
            DO.portrait('career:' + D.name, D.name, 72),
            h('div', { class: 'grow' },
              h('div', { class: 'id-label' }, 'DETECTIVE ID'),
              h('h2', {}, D.name),
              h('div', { class: 'id-rank' }, `${rankOf(lv.L)} · Lv ${lv.L}`))),
          h('div', { class: 'xpbar' }, h('span', { style: `width:${pct}%` })),
          h('p', { class: 'muted small-text' }, lv.need ? `다음 레벨까지 ${lv.need - lv.into} XP · 해결 ${clearedCount()}/${ALL.length}` : `최고 레벨! · 해결 ${clearedCount()}/${ALL.length}`),
        );
      }

      function hub() {
        D = load();
        if (!D.name) return register();
        const nx = nextStage();
        const pts = points();
        const qLeft = 3 - D.quests.done.length;
        render(root,
          idCard(),
          nx ? h('button', { class: 'primary', onClick: () => briefing(nx) }, `▶ 이어서: ${CHAPTERS[nx.ci].title.split(' · ')[0]} ${nx.si + 1}번 사건${nx.boss ? ' 👑' : ''}`)
            : h('div', { class: 'card good' }, h('p', {}, '🏆 모든 사건을 해결했습니다! 별 3개를 노려 보거나 오늘의 의뢰를 받아 보세요.')),
          h('button', { class: 'mode', onClick: chapters }, h('b', {}, '📖 사건 수첩'), h('div', { class: 'muted' }, `5장 ${ALL.length}사건 · 별 ${ALL.reduce((s, st) => s + (D.best[st.id] | 0), 0)}/${ALL.length * 3}`)),
          h('button', { class: 'mode', onClick: skills }, h('b', {}, `🧠 능력${pts > 0 ? ` — 포인트 ${pts}개!` : ''}`), h('div', { class: 'muted' }, '레벨이 오를 때마다 포인트 1개. 힌트·기회·배터리를 강화한다.')),
          h('button', { class: 'mode', onClick: quests }, h('b', {}, `📌 오늘의 의뢰 (${qLeft}/3 남음)`), h('div', { class: 'muted' }, '매일 바뀌는 자동 생성 사건. 경험치를 더 모을 수 있다.')),
          h('div', { class: 'row' },
            h('button', { class: 'small grow', onClick: register }, '✏️ 이름 바꾸기'),
            h('button', { class: 'small grow', onClick: () => { if (confirm('레벨·능력·별을 모두 지우고 처음부터 시작할까요?')) { store.del(KEY); hub(); } } }, '🗑 처음부터')),
        );
      }

      function register() {
        const input = h('input', { placeholder: '탐정 이름 (최대 12자)', maxlength: 12, autocomplete: 'off', value: D.name || '' });
        const face = h('div', { class: 'center' });
        const paint = () => face.replaceChildren(DO.portrait('career:' + (input.value.trim() || '탐정'), input.value.trim() || '탐정', 96));
        input.addEventListener('input', paint);
        paint();
        const go = () => {
          const v = input.value.trim();
          if (!v) return DO.toast('탐정 이름을 정해 주세요.');
          const first = !D.name;
          D.name = v.slice(0, 12); save(D);
          sfx('stamp');
          if (first) chapterMap(0); else hub();
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        render(root,
          h('h2', {}, D.name ? '✏️ 이름 바꾸기' : '🕵️ 탐정 등록'),
          h('p', { class: 'muted' }, '탐정 사무소에 수습 탐정으로 등록합니다. 사건을 해결할수록 레벨이 오르고, 능력을 배우고, 칭호가 바뀝니다.'),
          h('div', { class: 'card secret' }, face, input),
          h('button', { class: 'primary', onClick: go }, D.name ? '저장' : '등록하고 첫 사건으로'),
          D.name ? back('← 돌아가기', hub) : null,
        );
      }

      // ---------- 장 목록 ----------
      function chapters() {
        render(root,
          h('h2', {}, '📖 사건 수첩'),
          CHAPTERS.map((ch, ci) => {
            const open = chapterOpen(ci);
            const done = ch.stages.filter(cleared).length;
            return h('button', { class: 'mode chapter-btn' + (open ? '' : ' locked'), disabled: !open, onClick: () => chapterMap(ci) },
              h('b', {}, (open ? '' : '🔒 ') + ch.title),
              h('div', { class: 'muted' }, open ? `${ch.place} · 해결 ${done}/${ch.stages.length} · ★ ${starsIn(ch)}/${ch.stages.length * 3}` : '앞 장의 보스 사건을 해결하면 열립니다.'));
          }),
          back('← 탐정증', hub),
        );
      }

      // ---------- 장 지도 ----------
      function chapterMap(ci) {
        const ch = CHAPTERS[ci];
        const first = !D.seen[ch.id];
        if (first) { D.seen[ch.id] = true; save(D); }
        const nx = nextStage();
        const bossDone = cleared(ch.stages[ch.stages.length - 1]);
        render(root,
          h('h2', {}, ch.title),
          h('div', { class: 'card story' + (first ? ' fresh' : '') }, h('p', {}, '📜 ', ch.story)),
          h('div', { class: 'trail' }, ch.stages.map((st, si) => {
            const open = stageOpen(st), b = D.best[st.id] | 0, C = caseOf(st);
            const cls = 'node' + (si % 2 ? ' right' : ' left') + (st.boss ? ' boss' : '') + (!open ? ' locked' : b ? ' done' : '') + (nx === st ? ' current' : '');
            return h('div', { class: cls },
              h('button', { class: 'node-dot', disabled: !open, 'aria-label': `${si + 1}번 사건`, onClick: () => briefing(st) }, !open ? '🔒' : st.boss ? '👑' : String(si + 1)),
              h('div', { class: 'node-label' },
                h('b', {}, C ? C.title : st.c),
                h('span', { class: 'muted small-text' }, `${TYPE[st.t].icon} ${LV[st.t][st.lv]}${st.boss ? ' · 보스' : ''}`),
                open ? h('span', { class: 'node-stars' }, starText(b)) : null));
          })),
          bossDone ? h('div', { class: 'card calling-card' }, h('p', {}, ch.clear), h('div', { class: 'cc-sign' }, '— 🃏 그림자의 흔적')) : null,
          bossDone && CHAPTERS[ci + 1] ? h('button', { class: 'primary', onClick: () => chapterMap(ci + 1) }, `다음 장으로 → ${CHAPTERS[ci + 1].title}`) : null,
          h('div', { class: 'row' }, h('button', { class: 'grow', onClick: chapters }, '📖 사건 수첩'), h('button', { class: 'grow', onClick: hub }, '🪪 탐정증')),
        );
      }

      // ---------- 출동 전 브리핑 ----------
      function perkLines(t) {
        const lines = t === ALIBI
          ? [rank('lens') && `🔍 힌트 -${15 - 5 * rank('lens')}점`, rank('gut') && `🔮 결백한 사람 ${rank('gut')}명이 미리 보임`, rank('calm') && '🛡 지목 기회 3번']
          : [rank('torch') && `🔦 배터리 +${3 * rank('torch')}`, rank('note') && '📓 단서 대조 무료'];
        return lines.filter(Boolean);
      }
      function briefing(st, quest = null) {
        const C = caseOf(st);
        if (!C) return DO.toast('사건 파일을 찾지 못했습니다.');
        const b = quest ? 0 : D.best[st.id] | 0;
        const perks = perkLines(st.t);
        const xp = Math.round(baseXP(st) * (1 + 0.15 * rank('fame')));
        render(root,
          st.boss ? h('div', { class: 'boss-banner' }, '👑 보스 사건 — 그림자의 흔적') : null,
          h('h2', {}, C.title),
          h('div', { class: 'card' }, h('p', {}, C.intro)),
          h('div', { class: 'card' },
            h('p', {}, h('b', {}, `${TYPE[st.t].icon} ${TYPE[st.t].name}`), ` · 난이도 ${LV[st.t][st.lv]}`),
            h('p', { class: 'muted small-text' }, st.t === ALIBI
              ? '시간대별 진술표에서 단 한 명의 거짓말을 찾는다. 100점에서 시작, 85점 이상이면 ★3.'
              : '현장을 뒤져 진술서와 단서를 모으고 범인을 지목한다. 배터리를 절반 이상 남기면 ★3.'),
            h('p', { class: 'muted small-text' }, `보상: 최대 ${xp} XP${quest ? '' : b ? ` · 최고 기록 ${starText(b)}` : ''}`),
            perks.length ? h('p', { class: 'small-text' }, '적용 능력: ', perks.join(' · ')) : null),
          h('button', { class: 'primary', onClick: () => play(st, quest) }, st.boss ? '👑 출동' : '🚀 출동'),
          quest ? back('← 오늘의 의뢰', quests) : back('← 지도', () => chapterMap(st.ci)),
        );
      }

      // ---------- 사건 진행 (알리바이/방탈출 모드를 빌려 쓴다) ----------
      function play(st, quest) {
        const mode = DO.modes.find(m => m.id === st.t);
        const C = caseOf(st);
        const onDone = res => { if (DO.enterMode) DO.enterMode(MODE); if (DO.music) DO.music.base('lobby'); reward(st, res || {}, quest); };
        const preset = st.t === ALIBI
          ? { level: st.lv, variant: 300 + st.n * 17 + (quest ? 0 : (D.plays[st.id] | 0)), hintCost: 15 - 5 * rank('lens'), chances: 2 + rank('calm'), freeHints: rank('gut'), onDone }
          : { level: st.lv, batteryBonus: 3 * rank('torch'), freeCompare: rank('note') > 0, onDone };
        if (!quest) { D.plays[st.id] = (D.plays[st.id] | 0) + 1; save(D); }
        if (DO.enterMode) DO.enterMode(mode);
        if (DO.music) DO.music.startGame(mode.id);
        try { mode.start(root, { case: C, preset }); } catch (e) { console.error(e); onDone({ win: false, stars: 0 }); }
      }

      // ---------- 보상 ----------
      function reward(st, res, quest) {
        const stars = res.win ? Math.max(1, Math.min(3, res.stars | 0)) : 0;
        const before = levelOf(D.xp), rankBefore = rankOf(before.L);
        const prev = quest ? 0 : D.best[st.id] | 0;
        const wasOpen = ALL.map(stageOpen), chWasOpen = CHAPTERS.map((_, ci) => chapterOpen(ci));
        let xp;
        if (!stars) xp = 10;                                  // 실패해도 경험은 남는다
        else {
          const full = Math.round(baseXP(st) * STAR_K[stars]);
          xp = quest ? full : Math.max(full - Math.round(baseXP(st) * STAR_K[prev]), Math.round(baseXP(st) * 0.15));
        }
        xp = Math.round(xp * (1 + 0.15 * rank('fame')));
        D.xp += xp;
        if (!quest && stars > prev) D.best[st.id] = stars;
        if (quest && stars) D.quests.done.push(quest.slot);
        save(D);
        const after = levelOf(D.xp), up = after.L - before.L;
        const newRank = rankOf(after.L) !== rankBefore ? rankOf(after.L) : null;
        const opened = ALL.filter((s, k) => !wasOpen[k] && stageOpen(s));
        const chOpened = CHAPTERS.filter((_, ci) => !chWasOpen[ci] && chapterOpen(ci));
        const bossClear = !quest && st.boss && stars && !prev;
        const ch = CHAPTERS[st.ci];
        const pct = after.need ? Math.round(100 * after.into / after.need) : 100;
        const startPct = up ? 0 : before.need ? Math.round(100 * before.into / before.need) : 100;
        const bar = h('span', { style: `width:${startPct}%` });
        const xpNum = h('b', { class: 'xp-gain' }, '0');
        const nx = nextStage();

        render(root,
          h('h2', {}, stars ? '📁 사건 종결' : '📂 사건 미해결'),
          h('div', { class: 'card center reward' },
            h('div', { class: 'reward-stars' }, [1, 2, 3].map(k => h('span', { class: k <= stars ? 'on' : '' }, '★'))),
            h('p', {}, '+', xpNum, ' XP', stars ? '' : ' (실패해도 경험은 남는다)'),
            h('div', { class: 'xpbar' }, bar),
            h('p', { class: 'muted small-text' }, `${rankOf(after.L)} · Lv ${after.L}${after.need ? ` · 다음 레벨까지 ${after.need - after.into} XP` : ''}`)),
          up ? h('div', { class: 'card good level-up' },
            h('h3', {}, `🎉 레벨 업! Lv ${before.L} → ${after.L}`),
            h('p', {}, `능력 포인트 +${up}`, newRank ? h('span', {}, ' · 새 칭호 ', h('b', {}, newRank)) : null)) : null,
          bossClear ? h('div', { class: 'card calling-card' }, h('p', {}, ch.clear), h('div', { class: 'cc-sign' }, '— 🃏 그림자의 흔적')) : null,
          chOpened.map(c => h('div', { class: 'card good' }, h('p', {}, `🔓 ${c.title} 이(가) 열렸습니다!`))),
          !chOpened.length && opened.length ? h('p', { class: 'muted' }, `🔓 다음 사건이 열렸습니다.`) : null,
          !quest && nx ? h('button', { class: 'primary', onClick: () => briefing(nx) }, `▶ 다음 사건${nx.boss ? ' 👑' : ''}`) : null,
          !quest && !stars ? h('button', { class: nx === st ? '' : 'primary', onClick: () => briefing(st) }, '🔁 다시 도전') : null,
          up || points() > 0 ? h('button', { onClick: skills }, `🧠 능력 배우기 (포인트 ${points()})`) : null,
          quest ? back('📌 오늘의 의뢰', quests) : back('🗺 지도로', () => chapterMap(st.ci)),
          back('🪪 탐정증', hub),
        );
        // 연출: 경험치 세기 → 막대 차오름 → 레벨 업이면 팡파르
        if (DO.fx) DO.fx.count(xpNum, xp, 800); else xpNum.textContent = String(xp);
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = pct + '%'; }));
        if (up && DO.fx) setTimeout(() => DO.fx.win(), 650);
        else if (stars) sfx('good', { delay: 0.1 });
      }

      // ---------- 능력 ----------
      function skills() {
        const pts = points();
        render(root,
          h('h2', {}, '🧠 능력'),
          h('p', { class: 'muted' }, `레벨이 오를 때마다 포인트 1개. 지금 남은 포인트: `, h('b', {}, String(pts))),
          PERKS.map(p => {
            const r = rank(p.id);
            return h('div', { class: 'card perk' + (r ? ' has' : '') },
              h('div', { class: 'perk-icon' }, p.icon),
              h('div', { class: 'grow' },
                h('b', {}, p.name), ' ', h('span', { class: 'pips' }, '●'.repeat(r) + '○'.repeat(p.max - r)),
                h('p', { class: 'muted small-text' }, r ? `지금: ${p.text(r)}` : p.text(1)),
                r < p.max && r ? h('p', { class: 'muted small-text' }, `다음: ${p.text(r + 1)}`) : null),
              h('button', { class: 'small' + (pts > 0 && r < p.max ? ' primary' : ''), 'data-quiet': '1', disabled: !(pts > 0 && r < p.max), onClick: () => {
                D.perks[p.id] = r + 1; save(D); sfx('hint'); skills();
              } }, r >= p.max ? '최대' : '배우기'));
          }),
          spent() ? h('button', { class: 'small', onClick: () => { if (confirm('배운 능력을 모두 되돌리고 포인트를 돌려받을까요?')) { D.perks = {}; save(D); skills(); } } }, '↩️ 능력 다시 고르기') : null,
          back('← 탐정증', hub),
        );
      }

      // ---------- 오늘의 의뢰 ----------
      function questList() {
        const L = levelOf(D.xp).L;
        const used = new Set();
        return [ALIBI, ESCAPE, ALIBI].map((t, slot) => {
          // 생성 사건 재료가 많지 않아 씨앗이 달라도 같은 사건이 나올 수 있다 → 제목이 겹치지 않을 때까지 소금을 바꾼다
          let C = null;
          for (let salt = 0; DO.generateCase && salt < 30; salt++) {
            C = DO.generateCase(DO.hashString(`quest:${today()}:${slot}:${salt}`));
            if (!used.has(C.title)) break;
          }
          if (C) used.add(C.title);
          const lv = t === ALIBI ? Math.min(3, Math.floor((L - 1) / 3)) : Math.min(2, Math.floor((L - 1) / 4));
          return { st: { id: `q-${slot}`, case: C, t, lv, n: 90 + slot, ci: 0, si: 0 }, slot };
        });
      }
      function quests() {
        D = load();
        const list = questList();
        render(root,
          h('h2', {}, '📌 오늘의 의뢰'),
          h('p', { class: 'muted' }, '사무소 게시판에 붙은 오늘의 의뢰. 매일 자정에 바뀌고, 하나에 한 번씩 보상을 받는다. 난이도는 레벨에 맞춰 오른다.'),
          list.map(q => {
            const done = D.quests.done.includes(q.slot);
            const C = q.st.case;
            return h('button', { class: 'mode' + (done ? ' locked' : ''), disabled: done || !C, onClick: () => briefing(q.st, q) },
              h('b', {}, `${done ? '✅ ' : ''}${C ? C.title : '의뢰 준비 중'}`),
              h('div', { class: 'muted' }, `${TYPE[q.st.t].icon} ${TYPE[q.st.t].name} · ${LV[q.st.t][q.st.lv]} · 최대 ${Math.round(baseXP(q.st) * (1 + 0.15 * rank('fame')))} XP${done ? ' · 해결함' : ''}`));
          }),
          back('← 탐정증', hub),
        );
      }

      hub();
    },
  };
  DO.registerMode(MODE);
})();
