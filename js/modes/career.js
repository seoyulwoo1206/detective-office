// 모드 8: 명탐정의 길 (혼자 하는 모험 · RPG 식 성장)
//
// 수습 탐정으로 등록해 7장 25사건을 차례로 깬다. 사건은 '현장 수사'(js/investigate.js) 방식:
//   도입 영상 → 사건 배경 그림 속 장소·사람을 눌러 단서와 진술 모으기(수첩에 자동 기록) → 범인·거짓말·증거를 골라 "이의 있음!"
// 사건을 깨면 별(남은 신뢰 ❤️, 조수 힌트를 쓰면 줄어듦)에 따라 경험치 → 레벨 업 → 능력 포인트 → 능력.
// 장마다 마지막은 보스 사건(범인이 한 번 버텨서 거짓말 두 개를 다 찔러야 함). 보스를 잡으면 다음 장이 열리고 '그림자'를 쫓는 이야기가 이어진다.
// 오늘의 의뢰: 날짜로 만든 자동 생성 사건 3건(하루 한 번씩) — 이야기와 별개로 경험치를 모은다.
// 업적(ACHIEVEMENTS)·사건 도감(잡은 범인 모음)·장 클리어 연출.
// 저장: do:career = { name, xp, perks{id:랭크}, best{stageId:별}, plays{stageId:횟수}, seen{장id:true}, quests{date, done[]},
//                     ach{업적id:날짜}, stats{wins, perfect, noHint, clutch, boss, quests, fails, comeback},
//                     deco{card, stamp, title, face, motto} — 탐정증 꾸미기, ranks{stageId:'S'|'A'|'B'|'C'} — 최고 랭크,
//                     streak{last:날짜, n, best} — 오늘의 의뢰 연속 해결 }

(() => {
  const { h, render, store } = DO;
  const sfx = (n, o) => { if (DO.sfx) DO.sfx(n, o); };
  const KEY = 'career';
  const SCENE = 'scene';
  const LV = { scene: ['입문', '보통', '어려움', '전설'] };
  const TYPE = { scene: { icon: '🕵️', name: '현장 수사' } };
  const LV_DESC = [
    '조사 횟수 무제한 · 단서에 관련 이야기가 표시됨',
    '조사 16번 · 단서에 관련 이야기가 표시됨',
    '조사 13번 · 관련 이야기 표시 없음',
    '조사 11번 · 관련 이야기 표시 없음',
  ];

  // ---------- 이야기와 사건 ----------
  const CHAPTERS = [
    {
      id: 'c1', title: '1장 · 수습 탐정의 첫 출근', place: '🏫 학교',
      story: '오늘부터 탐정 사무소의 수습 탐정. 소장님이 건넨 첫 파일은 학교에서 온 작은 의뢰들이다. "작은 거짓말부터 잡아 봐. 큰 거짓말도 결국 같은 모양이니까."',
      clear: '사건을 정리하던 중 파일 사이에서 검은 카드 한 장이 떨어졌다. "제법이네, 수습." 누군가 지켜보고 있다.',
      stages: [{ c: 'case-001', lv: 0 }, { c: 'case-002', lv: 0 }, { c: 'case-003', lv: 0 }, { c: 'case-004', lv: 1 }, { c: 'case-017', lv: 1, boss: true }],
    },
    {
      id: 'c2', title: '2장 · 골목길의 소문', place: '🏡 동네',
      story: '동네에 이상한 소문이 돈다. 사건이 날 때마다 근처에서 검은 장갑을 낀 사람을 봤다는 것. 그냥 우연일까?',
      clear: '범인은 잡았지만 "누가 시켰다"는 말만 되풀이했다. 그의 주머니에서 또 검은 카드. "다음은 가게들이야."',
      stages: [{ c: 'case-005', lv: 1 }, { c: 'case-006', lv: 1 }, { c: 'case-009', lv: 2, boss: true }],
    },
    {
      id: 'c3', title: '3장 · 가게 뒤편의 비밀', place: '🏢 가게·시설',
      story: '편의점, 병원, 도서관, 호텔. 가게 뒤편에서 사건이 줄줄이 터진다. 그림자가 예고한 그대로다.',
      clear: '호텔 범인의 수첩에 적힌 다음 장소는 축제와 공항. 그림자는 판을 키우고 있다.',
      stages: [{ c: 'case-008', lv: 1 }, { c: 'case-010', lv: 2 }, { c: 'case-011', lv: 2 }, { c: 'case-014', lv: 2, boss: true }],
    },
    {
      id: 'c4', title: '4장 · 축제와 여행', place: '✈️ 모임·여행',
      story: '축제 날의 인파, 공항의 북적임. 사람이 많을수록 거짓말은 숨기 쉽다. 이제 조사할 수 있는 횟수도 빠듯하다.',
      clear: '공항 CCTV에 그림자의 뒷모습이 찍혔다. 마지막 카드: "온라인에서 기다릴게. 진짜 실력을 보여 줘."',
      stages: [{ c: 'case-007', lv: 2 }, { c: 'case-016', lv: 2 }, { c: 'case-013', lv: 3 }, { c: 'case-015', lv: 3, boss: true }],
    },
    {
      id: 'c5', title: '5장 · 그림자의 정체', place: '🎮 온라인',
      story: '그림자는 게임 길드에 숨어 있다. 마지막 대결. 단서는 적고, 조사할 기회도 적다. 한 번의 추리로 끝내야 한다.',
      clear: '마지막 거짓말이 무너졌다. 그림자의 정체는… 늘 사건 파일을 건네던 소장님. "네가 명탐정이 될 수 있는지 시험해 본 거야. 합격이다, 명탐정." 그런데 소장님 책상 위에, 소장님도 처음 본다는 검은 카드가 한 장 더 놓여 있었다.',
      stages: [{ c: 'case-012', lv: 3, boss: true }],
    },
    {
      id: 'c6', title: '6장 · 두 번째 그림자', place: '🎡 도시 곳곳',
      story: '"그림자는 나 하나가 아니었나 보군." 소장님의 얼굴이 굳었다. 놀이공원, 막차 전 지하철역, PC방, 체육관 — 카드에 적힌 장소마다 진짜 사건이 기다린다. 이번엔 시험이 아니다.',
      clear: '체육관 관중석 맨 위에 검은 카드 한 장. "재미있었어, 명탐정. 다음 판은 더 크게 벌이지." 두 번째 그림자는 아직 어딘가에 있다.',
      stages: [{ c: 'case-018', lv: 2 }, { c: 'case-019', lv: 2 }, { c: 'case-020', lv: 3 }, { c: 'case-021', lv: 3, boss: true }],
    },
    {
      id: 'c7', title: '7장 · 그림자의 수집품', place: '🏛️ 박물관에서 시장까지',
      story: '사무소 우편함에 그림자의 검은 카드가 또 꽂혀 있었다. 이번엔 목록이다. "황금 발톱, 사인 액자, 무지개 진주, 황금 국자." 소장님이 중얼거렸다. "물건을 모으는 게 아니야. 사람들이 숨기는 걸 모으는 거지."',
      clear: '야시장 천막의 불이 하나둘 꺼질 무렵, 국자 손잡이에 묶인 마지막 검은 카드. "수집은 여기까지. 너라는 탐정은 꽤 괜찮은 수집품이었어." 그림자는 웃으며 사라졌지만, 이번엔 네가 이겼다.',
      stages: [{ c: 'case-022', lv: 2 }, { c: 'case-023', lv: 3 }, { c: 'case-024', lv: 3 }, { c: 'case-025', lv: 3, boss: true }],
    },
  ];
  CHAPTERS.forEach(ch => { ch.stages = ch.stages.filter(st => DO.getCase(st.c)); });
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (!CHAPTERS[i].stages.length) CHAPTERS.splice(i, 1);
  CHAPTERS.forEach((ch, ci) => ch.stages.forEach((st, si) => { st.id = st.c; st.t = SCENE; st.ci = ci; st.si = si; st.n = 0; }));
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
    { id: 'shoes', icon: '👟', name: '부지런한 발', max: 2, text: r => `조사 횟수 +${3 * r}` },
    { id: 'lens', icon: '🔍', name: '돋보기', max: 1, text: () => '단서가 숨은 장소가 반짝인다' },
    { id: 'gut', icon: '🔮', name: '직감', max: 1, text: () => '결백한 사람 한 명이 처음부터 수첩에 ✅ 로 표시된다' },
    { id: 'calm', icon: '🛡', name: '침착함', max: 2, text: r => `신뢰(❤️) +${r} — 추리를 틀려도 버틴다` },
    { id: 'dog', icon: '🐕', name: '콩이 훈련', max: 2, text: r => `조수 콩이의 힌트 ${r}번은 별을 깎지 않는다` },
    { id: 'fame', icon: '⭐', name: '명성', max: 2, text: r => `얻는 경험치 +${15 * r}%` },
  ];
  // 업적: check(D, 도우미) 가 참이 되는 순간 열린다. 도우미 = { cleared, stars3, level, chaptersDone }
  const ACHIEVEMENTS = [
    { id: 'first', icon: '🔰', name: '첫 사건', desc: '사건을 처음으로 해결했다', check: (D, x) => x.cleared >= 1 },
    { id: 'perfect', icon: '🌟', name: '완벽한 추리', desc: '별 3개로 사건을 해결했다', check: D => D.stats.perfect >= 1 },
    { id: 'nohint', icon: '🙅', name: '콩이는 쉬는 중', desc: '조수 힌트 없이 사건을 해결했다', check: D => D.stats.noHint >= 1 },
    { id: 'clutch', icon: '😮‍💨', name: '아슬아슬', desc: '신뢰 ❤️ 하나만 남기고 사건을 해결했다', check: D => D.stats.clutch >= 1 },
    { id: 'comeback', icon: '🔁', name: '칠전팔기', desc: '실패했던 사건을 다시 도전해 해결했다', check: D => D.stats.comeback >= 1 },
    { id: 'boss1', icon: '👑', name: '보스 사냥꾼', desc: '보스 사건을 처음 해결했다', check: D => D.stats.boss >= 1 },
    { id: 'boss3', icon: '🃏', name: '그림자 추적자', desc: '보스 사건 3개를 해결했다', check: D => D.stats.boss >= 3 },
    { id: 'quest1', icon: '📌', name: '게시판 단골', desc: '오늘의 의뢰를 처음 해결했다', check: D => D.stats.quests >= 1 },
    { id: 'quest10', icon: '📮', name: '의뢰 전문가', desc: '오늘의 의뢰 10건을 해결했다', check: D => D.stats.quests >= 10 },
    { id: 'lv5', icon: '🪪', name: '형사 승진', desc: '레벨 5에 올랐다', check: (D, x) => x.level >= 5 },
    { id: 'lv10', icon: '🎖️', name: '베테랑', desc: '레벨 10에 올랐다', check: (D, x) => x.level >= 10 },
    { id: 'half', icon: '📚', name: '사건 수첩 절반', desc: '이야기 사건을 절반 넘게 해결했다', check: (D, x) => x.cleared * 2 >= x.total },
    { id: 'ch5', icon: '🕵️', name: '명탐정 합격', desc: '5장까지 모두 해결했다', check: (D, x) => x.chaptersDone >= 5 },
    { id: 'all', icon: '🏆', name: '모든 그림자를 쫓다', desc: '모든 장의 보스를 해결했다', check: (D, x) => x.chaptersDone >= x.chapters },
    { id: 'rankS', icon: '⚡', name: 'S 랭크', desc: '헛짚기·힌트 없이 조사를 아껴 S 랭크로 해결했다', check: D => D.stats.rankS >= 1 },
    { id: 'rankS5', icon: '🥇', name: '에이스 탐정', desc: 'S 랭크 사건이 5개', check: D => Object.values(D.ranks).filter(r => r === 'S').length >= 5 },
    { id: 'streak3', icon: '🔥', name: '사흘 연속', desc: '오늘의 의뢰를 사흘 연속 해결했다', check: D => D.streak.best >= 3 },
    { id: 'streak7', icon: '📅', name: '일주일 탐정', desc: '오늘의 의뢰를 7일 연속 해결했다', check: D => D.streak.best >= 7 },
    { id: 'stars10', icon: '✨', name: '별 수집가', desc: '별 3개 사건이 10개', check: (D, x) => x.stars3 >= 10 },
    { id: 'allstar', icon: '💎', name: '전부 만점', desc: '모든 이야기 사건을 별 3개로 해결했다', check: (D, x) => x.stars3 >= x.total },
  ];
  // 탐정증 꾸미기: 카드 색·도장은 레벨이나 업적으로 열린다 (need = { lv } | { ach })
  const CARD_THEMES = [
    { id: 'paper', name: '기본 종이' }, { id: 'mint', name: '민트 수첩', need: { lv: 3 } }, { id: 'sky', name: '하늘 파일', need: { ach: 'first' } },
    { id: 'rose', name: '장미 편지', need: { ach: 'perfect' } }, { id: 'night', name: '밤의 사무소', need: { lv: 5 }, dark: true },
    { id: 'noir', name: '흑백 필름', need: { ach: 'boss1' } }, { id: 'gold', name: '금박 배지', need: { lv: 10 } },
    { id: 'shadow', name: '그림자 카드', need: { ach: 'all' }, dark: true },
  ];
  const STAMPS = [
    { id: 'lens', icon: '🔍', name: '돋보기' }, { id: 'paw', icon: '🐾', name: '콩이 발자국', need: { ach: 'nohint' } },
    { id: 'star', icon: '🌟', name: '별', need: { ach: 'perfect' } }, { id: 'pin', icon: '📌', name: '압정', need: { ach: 'quest1' } },
    { id: 'crown', icon: '👑', name: '왕관', need: { ach: 'boss1' } }, { id: 'joker', icon: '🃏', name: '검은 카드', need: { ach: 'boss3' } },
    { id: 'medal', icon: '🎖️', name: '훈장', need: { lv: 10 } }, { id: 'bolt', icon: '⚡', name: '번개', need: { ach: 'rankS' } },
    { id: 'fire', icon: '🔥', name: '불꽃', need: { ach: 'streak7' } }, { id: 'gem', icon: '💎', name: '보석', need: { ach: 'allstar' } },
    { id: 'none', icon: '', name: '도장 없음' },
  ];
  const FACES = 6;   // 고를 수 있는 얼굴 수 (씨앗 'career:이름:n')
  const STAT_KEYS = ['wins', 'perfect', 'noHint', 'clutch', 'boss', 'quests', 'fails', 'comeback', 'rankS'];
  const RANK_ORDER = ['C', 'B', 'A', 'S'];
  const betterRank = (a, b) => (RANK_ORDER.indexOf(a) >= RANK_ORDER.indexOf(b) ? a : b);
  const STREAK_MAX = 5;                                    // 연속 보너스: 하루마다 +10%, 최대 +50%
  const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };
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
      ach: isObj(d.ach) ? Object.fromEntries(Object.entries(d.ach).filter(([k, v]) => typeof v === 'string' && ACHIEVEMENTS.some(a => a.id === k))) : {},
      stats: Object.fromEntries(STAT_KEYS.map(k => [k, nums(d.stats, 99999)[k] | 0])),
      ranks: isObj(d.ranks) ? Object.fromEntries(Object.entries(d.ranks).filter(([, v]) => RANK_ORDER.includes(v))) : {},
      streak: (() => {
        const x = isObj(d.streak) ? d.streak : {};
        const last = typeof x.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.last) ? x.last : '';
        const n = Number.isInteger(x.n) && x.n > 0 ? Math.min(x.n, 9999) : 0;
        return { last, n: last ? n : 0, best: Math.max(n, Number.isInteger(x.best) && x.best > 0 ? Math.min(x.best, 9999) : 0) };
      })(),
      deco: (() => {
        const x = isObj(d.deco) ? d.deco : {};
        return {
          card: CARD_THEMES.some(t => t.id === x.card) ? x.card : 'paper',
          stamp: STAMPS.some(t => t.id === x.stamp) ? x.stamp : 'lens',
          title: typeof x.title === 'string' ? x.title.slice(0, 20) : '',
          face: Number.isInteger(x.face) && x.face >= 0 && x.face < FACES ? x.face : 0,
          motto: typeof x.motto === 'string' ? x.motto.trim().slice(0, 24) : '',
        };
      })(),
    };
    for (const p of PERKS) if (data.perks[p.id] > p.max) data.perks[p.id] = p.max;
    return data;
  }
  const save = d => store.set(KEY, d);

  // ---------- 모드 ----------
  const MODE = {
    id: 'career',
    name: '명탐정의 길',
    desc: '혼자 하는 모험. 사건 현장을 조사해 단서를 모으고, 거짓말을 증거로 무너뜨린다. 레벨을 올리고 능력을 배우며 7장 25사건 + 오늘의 의뢰, 업적·범인 도감·탐정증 꾸미기까지.',
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
      const chaptersDone = () => CHAPTERS.filter(ch => cleared(ch.stages[ch.stages.length - 1])).length;
      const achInfo = () => ({ cleared: clearedCount(), total: ALL.length, stars3: ALL.filter(st => (D.best[st.id] | 0) >= 3).length,
        level: levelOf(D.xp).L, chaptersDone: chaptersDone(), chapters: CHAPTERS.length });
      // 새로 열린 업적을 저장하고 돌려준다
      function unlockAch() {
        const x = achInfo(), got = [];
        for (const a of ACHIEVEMENTS) if (!D.ach[a.id] && a.check(D, x)) { D.ach[a.id] = today(); got.push(a); }
        if (got.length) save(D);
        return got;
      }

      // ---------- 탐정증 (허브) ----------
      // 오늘의 의뢰 연속: 오늘이나 어제 해결했으면 이어지는 중
      const streakNow = () => (D.streak.last === today() || D.streak.last === yesterday() ? D.streak.n : 0);
      const streakBonus = n => Math.min(STREAK_MAX, Math.max(0, n - 1)) * 0.1;
      // 꾸미기: 열렸는지, 무엇으로 열리는지
      const isOpen = need => !need || (need.lv ? levelOf(D.xp).L >= need.lv : !!D.ach[need.ach]);
      const needText = need => need.lv ? `Lv ${need.lv}` : `업적 "${(ACHIEVEMENTS.find(a => a.id === need.ach) || {}).name}"`;
      const titles = () => [...RANKS.filter(([l]) => levelOf(D.xp).L >= l).map(([, t]) => t), ...ACHIEVEMENTS.filter(a => D.ach[a.id]).map(a => a.name)];
      const myFace = (size, n = D.deco.face) => DO.portrait('career:' + D.name + (n ? ':' + n : ''), D.name, size);
      function idCard() {
        const lv = levelOf(D.xp);
        const pct = lv.need ? Math.round(100 * lv.into / lv.need) : 100;
        const deco = D.deco;
        const theme = CARD_THEMES.find(t => t.id === deco.card && isOpen(t.need)) || CARD_THEMES[0];
        const stamp = STAMPS.find(t => t.id === deco.stamp && isOpen(t.need)) || STAMPS[0];
        const title = deco.title && titles().includes(deco.title) ? deco.title : rankOf(lv.L);
        return h('div', { class: `card id-card t-${theme.id}${theme.dark ? ' dark' : ''}` },
          stamp.icon ? h('div', { class: 'id-stamp', title: stamp.name }, stamp.icon) : null,
          h('div', { class: 'id-top' },
            myFace(72),
            h('div', { class: 'grow' },
              h('div', { class: 'id-label' }, 'DETECTIVE ID'),
              h('h2', {}, D.name),
              h('div', { class: 'id-rank' }, `${title} · Lv ${lv.L}`))),
          deco.motto ? h('p', { class: 'id-motto' }, `“${deco.motto}”`) : null,
          h('div', { class: 'xpbar' }, h('span', { style: `width:${pct}%` })),
          h('p', { class: 'muted small-text' }, lv.need ? `다음 레벨까지 ${lv.need - lv.into} XP · 해결 ${clearedCount()}/${ALL.length}` : `최고 레벨! · 해결 ${clearedCount()}/${ALL.length}`),
          (() => { const got = ACHIEVEMENTS.filter(a => D.ach[a.id]); return got.length ? h('div', { class: 'id-badges', title: '업적 배지' }, got.slice(-8).map(a => h('span', { title: a.name }, a.icon))) : null; })(),
        );
      }

      function hub() {
        D = load();
        if (!D.name) return register();
        unlockAch();
        const nx = nextStage();
        const pts = points();
        const qLeft = 3 - D.quests.done.length;
        render(root,
          idCard(),
          nx ? h('button', { class: 'primary', onClick: () => briefing(nx) }, `▶ 이어서: ${CHAPTERS[nx.ci].title.split(' · ')[0]} ${nx.si + 1}번 사건${nx.boss ? ' 👑' : ''}`)
            : h('div', { class: 'card good' }, h('p', {}, '🏆 모든 사건을 해결했습니다! 별 3개를 노려 보거나 오늘의 의뢰를 받아 보세요.')),
          h('button', { class: 'mode', onClick: chapters }, h('b', {}, '📖 사건 수첩'), h('div', { class: 'muted' }, `${CHAPTERS.length}장 ${ALL.length}사건 · 별 ${ALL.reduce((s, st) => s + (D.best[st.id] | 0), 0)}/${ALL.length * 3}`)),
          h('button', { class: 'mode', onClick: skills }, h('b', {}, `🧠 능력${pts > 0 ? ` — 포인트 ${pts}개!` : ''}`), h('div', { class: 'muted' }, '레벨이 오를 때마다 포인트 1개. 조사 횟수·신뢰·힌트를 강화한다.')),
          h('button', { class: 'mode', onClick: quests }, h('b', {}, `📌 오늘의 의뢰 (${qLeft}/3 남음)${streakNow() ? ` · 🔥${streakNow()}일` : ''}`), h('div', { class: 'muted' }, '매일 바뀌는 자동 생성 사건. 경험치를 더 모을 수 있다.')),
          h('div', { class: 'row' },
            h('button', { class: 'mode grow', onClick: album }, h('b', {}, '🗂 범인 도감'), h('div', { class: 'muted' }, `잡은 범인 ${clearedCount()}/${ALL.length}`)),
            h('button', { class: 'mode grow', onClick: achievements }, h('b', {}, '🏅 업적'), h('div', { class: 'muted' }, `${Object.keys(D.ach).length}/${ACHIEVEMENTS.length}`))),
          h('div', { class: 'row' },
            h('button', { class: 'small grow', onClick: decorate }, '🎨 탐정증 꾸미기'),
            h('button', { class: 'small grow', onClick: register }, '✏️ 이름 바꾸기'),
            h('button', { class: 'small grow', onClick: () => { if (confirm('레벨·능력·별을 모두 지우고 처음부터 시작할까요?')) { store.del(KEY); hub(); } } }, '🗑 처음부터')),
        );
      }

      function register() {
        const input = h('input', { placeholder: '탐정 이름 (최대 12자)', maxlength: 12, autocomplete: 'off', value: D.name || '' });
        const face = h('div', { class: 'center' });
        const paint = () => face.replaceChildren(DO.portrait('career:' + (input.value.trim() || '탐정') + (D.deco.face ? ':' + D.deco.face : ''), input.value.trim() || '탐정', 96));
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

      // ---------- 탐정증 꾸미기 ----------
      function decorate() {
        const set = (k, v) => { D.deco[k] = v; save(D); sfx('pop'); decorate(); };
        const chip = (on, open, label, onClick, lockText) => h('button', {
          class: 'chip deco-chip' + (on ? ' active' : '') + (open ? '' : ' locked'), 'data-quiet': '1',
          onClick: open ? onClick : () => DO.toast(`🔒 ${lockText} 달성하면 열려요.`),
        }, open ? label : `🔒 ${label}`);
        const L = levelOf(D.xp).L;
        const motto = h('input', { maxlength: 24, placeholder: '예: 진실은 언제나 하나', value: D.deco.motto });
        const saveMotto = () => { const v = motto.value.trim().slice(0, 24); if (v !== D.deco.motto) { D.deco.motto = v; save(D); decorate(); } };
        motto.addEventListener('change', saveMotto);
        motto.addEventListener('keydown', e => { if (e.key === 'Enter') saveMotto(); });
        const opened = CARD_THEMES.filter(t => isOpen(t.need)).length + STAMPS.filter(t => isOpen(t.need)).length;
        render(root,
          h('h2', {}, '🎨 탐정증 꾸미기'),
          idCard(),
          h('p', { class: 'muted small-text' }, `열린 꾸미기 ${opened}/${CARD_THEMES.length + STAMPS.length} · 레벨을 올리고 업적을 따면 더 열려요.`),
          h('div', { class: 'section-title' }, '카드 색'),
          h('div', { class: 'chips deco' }, CARD_THEMES.map(t => chip(D.deco.card === t.id, isOpen(t.need), t.name, () => set('card', t.id), t.need && needText(t.need)))),
          h('div', { class: 'section-title' }, '도장'),
          h('div', { class: 'chips deco' }, STAMPS.map(t => chip(D.deco.stamp === t.id, isOpen(t.need), `${t.icon} ${t.name}`.trim(), () => set('stamp', t.id), t.need && needText(t.need)))),
          h('div', { class: 'section-title' }, '칭호'),
          h('div', { class: 'chips deco' },
            chip(!D.deco.title, true, `${rankOf(L)} (계급 그대로)`, () => set('title', '')),
            titles().filter(t => t !== rankOf(L)).map(t => chip(D.deco.title === t, true, t, () => set('title', t)))),
          h('p', { class: 'muted small-text' }, '칭호는 계급과 딴 업적 이름 중에서 고를 수 있어요.'),
          h('div', { class: 'section-title' }, '얼굴'),
          h('div', { class: 'deco-faces' }, Array.from({ length: FACES }, (_, n) => h('button', {
            class: 'deco-face' + (D.deco.face === n ? ' active' : ''), 'data-quiet': '1', onClick: () => set('face', n),
          }, myFace(54, n)))),
          h('div', { class: 'section-title' }, '한마디'),
          h('div', { class: 'row' }, motto, h('button', { class: 'small', onClick: saveMotto }, '저장')),
          back('← 탐정증', hub),
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
                open ? h('span', { class: 'node-stars' }, starText(b), D.ranks[st.id] ? h('span', { class: 'node-rank' }, D.ranks[st.id]) : null) : null));
          })),
          bossDone ? h('div', { class: 'card calling-card' }, h('p', {}, ch.clear), h('div', { class: 'cc-sign' }, '— 🃏 그림자의 흔적')) : null,
          bossDone && CHAPTERS[ci + 1] ? h('button', { class: 'primary', onClick: () => chapterMap(ci + 1) }, `다음 장으로 → ${CHAPTERS[ci + 1].title}`) : null,
          h('div', { class: 'row' }, h('button', { class: 'grow', onClick: chapters }, '📖 사건 수첩'), h('button', { class: 'grow', onClick: hub }, '🪪 탐정증')),
        );
      }

      // ---------- 출동 전 브리핑 ----------
      function perkLines() {
        return [
          rank('shoes') && `👟 조사 +${3 * rank('shoes')}`, rank('lens') && '🔍 단서 장소 반짝임', rank('gut') && '🔮 결백한 사람 1명 표시',
          rank('calm') && `🛡 신뢰 +${rank('calm')}`, rank('dog') && `🐕 무료 힌트 ${rank('dog')}번`,
        ].filter(Boolean);
      }
      function briefing(st, quest = null) {
        const C = caseOf(st);
        if (!C) return DO.toast('사건 파일을 찾지 못했습니다.');
        const b = quest ? 0 : D.best[st.id] | 0;
        const perks = perkLines();
        const xp = Math.round(baseXP(st) * (1 + 0.15 * rank('fame')));
        render(root,
          st.boss ? h('div', { class: 'boss-banner' }, '👑 보스 사건 — 범인이 한 번 버틴다. 거짓말 두 개를 모두 찔러라') : null,
          h('h2', {}, C.title),
          h('div', { class: 'card' }, h('p', {}, C.intro)),
          h('div', { class: 'card' },
            h('p', {}, h('b', {}, `${TYPE[st.t].icon} ${TYPE[st.t].name}`), ` · 난이도 ${LV[st.t][st.lv]}`),
            h('p', { class: 'muted small-text' }, `${LV_DESC[st.lv]}. 장소를 조사해 단서를, 사람과 이야기해 진술을 모은 뒤 범인의 거짓말을 증거로 무너뜨린다. 남은 신뢰 ❤️ 만큼 별.`),
            h('p', { class: 'muted small-text' }, `보상: 최대 ${xp} XP${quest ? '' : b ? ` · 최고 기록 ${starText(b)}` : ''}`),
            perks.length ? h('p', { class: 'small-text' }, '적용 능력: ', perks.join(' · ')) : null),
          h('button', { class: 'primary', onClick: () => play(st, quest) }, st.boss ? '👑 출동' : '🚀 출동'),
          quest ? back('← 오늘의 의뢰', quests) : back('← 지도', () => chapterMap(st.ci)),
        );
      }

      // ---------- 사건 진행 (js/investigate.js) ----------
      function play(st, quest) {
        const C = caseOf(st);
        const onDone = res => { if (DO.enterMode) DO.enterMode(MODE); if (DO.music) DO.music.base('lobby'); reward(st, res || {}, quest); };
        const variant = quest ? 0 : (D.plays[st.id] | 0);   // 다시 하면 단서 위치·진술 순서가 바뀐다
        if (!quest) { D.plays[st.id] = variant + 1; save(D); }
        try {
          DO.investigate(root, C, {
            level: st.lv, variant, boss: !!st.boss,
            actionsBonus: 3 * rank('shoes'), heartsBonus: rank('calm'), lens: rank('lens') > 0, gut: rank('gut') > 0, freeHints: rank('dog'),
            onDone,
          });
        } catch (e) { console.error(e); onDone({ win: false, stars: 0 }); }
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
        // 오늘의 의뢰 연속 해결
        let streakUp = false;
        if (quest && stars && D.streak.last !== today()) {
          D.streak.n = D.streak.last === yesterday() ? D.streak.n + 1 : 1;
          D.streak.last = today(); D.streak.best = Math.max(D.streak.best, D.streak.n);
          streakUp = true;
        }
        const sBonus = quest && stars ? streakBonus(D.streak.n) : 0;
        xp = Math.round(xp * (1 + 0.15 * rank('fame') + sBonus));
        D.xp += xp;
        const rk = stars && res.rank && RANK_ORDER.includes(res.rank) ? res.rank : null;
        const prevRank = quest ? null : D.ranks[st.id] || null;
        if (rk && !quest) D.ranks[st.id] = prevRank ? betterRank(rk, prevRank) : rk;
        const failedBefore = !quest && !prev && (D.plays[st.id] | 0) > 1;
        if (!quest && stars > prev) D.best[st.id] = stars;
        if (quest && stars) D.quests.done.push(quest.slot);
        const S = D.stats;
        if (stars) {
          S.wins++;
          if (stars === 3) S.perfect++;
          if ((res.hints | 0) === 0) S.noHint++;
          if (res.hearts === 1) S.clutch++;
          if (st.boss && !prev) S.boss++;
          if (quest) S.quests++;
          if (failedBefore) S.comeback++;
          if (rk === 'S') S.rankS++;
        } else S.fails++;
        save(D);
        const newAch = unlockAch();
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
            rk ? h('p', { class: 'small-text' }, '랭크 ', h('b', {}, rk), prevRank && RANK_ORDER.indexOf(rk) > RANK_ORDER.indexOf(prevRank) ? ` (최고 기록 ${prevRank} → ${rk}!)` : prevRank && prevRank !== rk ? ` · 최고 ${prevRank}` : '') : null,
            streakUp ? h('p', { class: 'small-text' }, `🔥 의뢰 연속 ${D.streak.n}일째!${sBonus ? ` 경험치 +${Math.round(sBonus * 100)}%` : ' 내일도 해결하면 보너스!'}`) : null,
            h('p', {}, '+', xpNum, ' XP', stars ? '' : ' (실패해도 경험은 남는다)'),
            h('div', { class: 'xpbar' }, bar),
            h('p', { class: 'muted small-text' }, `${rankOf(after.L)} · Lv ${after.L}${after.need ? ` · 다음 레벨까지 ${after.need - after.into} XP` : ''}`)),
          up ? h('div', { class: 'card good level-up' },
            h('h3', {}, `🎉 레벨 업! Lv ${before.L} → ${after.L}`),
            h('p', {}, `능력 포인트 +${up}`, newRank ? h('span', {}, ' · 새 칭호 ', h('b', {}, newRank)) : null)) : null,
          bossClear ? h('div', { class: 'card calling-card' }, h('p', {}, ch.clear), h('div', { class: 'cc-sign' }, '— 🃏 그림자의 흔적')) : null,
          newAch.map(a => h('div', { class: 'card ach-new' }, h('span', { class: 'ach-icon' }, a.icon), h('div', {}, h('b', {}, `업적 달성 · ${a.name}`), h('p', { class: 'muted small-text' }, a.desc)))),
          chOpened.map(c => h('div', { class: 'card good' }, h('p', {}, `🔓 ${DO.josa(c.title, '이/가')} 열렸습니다!`))),
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
        if (bossClear) chapterClear(ch);
        else if (up && DO.fx) setTimeout(() => DO.fx.win(), 650);
        else if (newAch.length) sfx('fanfare', { delay: 0.3 });
        else if (stars) sfx('good', { delay: 0.1 });
      }

      // ---------- 장 클리어 연출 (보스를 처음 잡았을 때, 보상 화면 위에 덮어씀) ----------
      function chapterClear(ch) {
        const got = ch.stages.reduce((s2, st2) => s2 + (D.best[st2.id] | 0), 0);
        const boss = caseOf(ch.stages[ch.stages.length - 1]);
        const culprit = boss && boss.suspects.find(x => x.id === boss.culprit);
        const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 400); };
        const el = h('div', { class: 'chapter-clear', role: 'dialog', 'aria-label': '장 클리어', onClick: close },
          h('div', { class: 'cc-bar top' }), h('div', { class: 'cc-bar bottom' }),
          h('div', { class: 'cc-body' },
            h('div', { class: 'cc-kicker' }, 'CHAPTER CLEAR'),
            h('h2', {}, ch.title),
            culprit ? h('div', { class: 'cc-face' }, DO.face(boss, culprit, 96, 'sad'), h('div', { class: 'stamp win' }, '검거')) : null,
            h('p', { class: 'cc-stars' }, `★ ${got} / ${ch.stages.length * 3}`),
            h('p', { class: 'cc-card' }, '🃏 ', ch.clear),
            h('p', { class: 'muted small-text' }, '화면을 누르면 닫힙니다')));
        document.body.append(el);
        sfx('fanfare', { delay: 0.2 });
        if (DO.fx) setTimeout(() => DO.fx.win(), 900);
      }

      // ---------- 범인 도감 ----------
      function album(openId) {
        const cards = ALL.map(st => {
          const C = caseOf(st), done = cleared(st);
          const culprit = C && C.suspects.find(x => x.id === C.culprit);
          return h('button', { class: 'album-card' + (done ? ' done' : '') + (openId === st.id ? ' open' : ''), disabled: !done, 'data-quiet': '1', onClick: () => album(openId === st.id ? null : st.id) },
            done && culprit ? DO.face(C, culprit, 64, 'sad') : h('span', { class: 'album-q' }, '?'),
            h('b', {}, done && culprit ? culprit.name : '???'),
            h('span', { class: 'node-stars' }, done ? starText(D.best[st.id] | 0) + (D.ranks[st.id] ? ` ${D.ranks[st.id]}` : '') : `${CHAPTERS[st.ci].title.split(' · ')[0]}`));
        });
        const sel = openId && ALL.find(st => st.id === openId);
        const C = sel && caseOf(sel);
        const culprit = C && C.suspects.find(x => x.id === C.culprit);
        render(root,
          h('h2', {}, '🗂 범인 도감'),
          h('p', { class: 'muted' }, `해결한 사건의 범인이 여기 모인다. ${clearedCount()}/${ALL.length}명 검거. 카드를 누르면 사건 기록을 본다.`),
          sel && C && culprit ? h('div', { class: 'card album-detail' },
            h('div', { class: 'profile-head' }, DO.face(C, culprit, 72, 'sad'), h('div', {}, h('h3', {}, C.title), h('p', { class: 'muted small-text' }, `${CHAPTERS[sel.ci].title} · ${starText(D.best[sel.id] | 0)}`))),
            h('p', {}, C.intro),
            h('p', {}, '범인: ', h('b', {}, culprit.name)),
            h('p', { class: 'muted small-text' }, '🗂 결정적 증거: ', (C.clues.filter(c => c.exposes).map(c => c.text)[0]) || '-'),
            h('button', { class: 'small', onClick: () => briefing(sel) }, '🔁 이 사건 다시 하기')) : null,
          h('div', { class: 'album-grid' }, cards),
          back('← 탐정증', hub),
        );
      }

      // ---------- 업적 ----------
      function achievements() {
        const n = Object.keys(D.ach).length;
        render(root,
          h('h2', {}, '🏅 업적'),
          h('p', { class: 'muted' }, `${n}/${ACHIEVEMENTS.length} 달성. 달성한 업적의 배지는 탐정증에 붙는다.`),
          h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map(a => {
            const on = !!D.ach[a.id];
            return h('div', { class: 'card ach' + (on ? ' on' : '') },
              h('span', { class: 'ach-icon' }, on ? a.icon : '🔒'),
              h('div', {}, h('b', {}, a.name), h('p', { class: 'muted small-text' }, a.desc + (on ? ` · ${D.ach[a.id]}` : ''))));
          })),
          h('p', { class: 'muted small-text' }, `기록: 해결 ${D.stats.wins} · 별 3개 ${D.stats.perfect} · 힌트 없이 ${D.stats.noHint} · 보스 ${D.stats.boss} · 의뢰 ${D.stats.quests} · 실패 ${D.stats.fails}`),
          back('← 탐정증', hub),
        );
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
        return [SCENE, SCENE, SCENE].map((t, slot) => {
          // 생성 사건 재료가 많지 않아 씨앗이 달라도 같은 사건이 나올 수 있다 → 제목이 겹치지 않을 때까지 소금을 바꾼다
          let C = null;
          for (let salt = 0; DO.generateCase && salt < 30; salt++) {
            C = DO.generateCase(DO.hashString(`quest:${today()}:${slot}:${salt}`));
            if (!used.has(C.title)) break;
          }
          if (C) used.add(C.title);
          const lv = Math.min(3, Math.floor((L - 1) / 3));
          return { st: { id: `q-${slot}`, case: C, t, lv, n: 90 + slot, ci: 0, si: 0 }, slot };
        });
      }
      function quests() {
        D = load();
        const list = questList();
        render(root,
          h('h2', {}, '📌 오늘의 의뢰'),
          h('p', { class: 'muted' }, '사무소 게시판에 붙은 오늘의 의뢰. 매일 자정에 바뀌고, 하나에 한 번씩 보상을 받는다. 난이도는 레벨에 맞춰 오른다.'),
          (() => {
            const n = streakNow(), doneToday = D.streak.last === today();
            return h('div', { class: 'card center' },
              h('p', {}, h('b', {}, n ? `🔥 연속 ${n}일` : '🔥 연속 기록 없음'), n > 1 ? ` · 의뢰 경험치 +${Math.round(streakBonus(n) * 100)}%` : ''),
              h('div', { class: 'streak' }, Array.from({ length: 7 }, (_, i) => h('span', { class: i < (n % 7 || (n ? 7 : 0)) ? 'on' : '' }, i < (n % 7 || (n ? 7 : 0)) ? '🐾' : String(i + 1)))),
              h('p', { class: 'muted small-text' }, doneToday ? '오늘 도장 완료! 내일도 하나 해결하면 이어져요.' : n ? '오늘 의뢰를 하나 해결하면 도장이 찍혀요. 하루라도 거르면 처음부터!' : '매일 의뢰를 하나씩 해결하면 도장이 찍히고, 이어질수록 경험치 보너스가 커져요(최대 +50%).'),
              D.streak.best > 1 ? h('p', { class: 'muted small-text' }, `최고 기록 ${D.streak.best}일`) : null);
          })(),
          list.map(q => {
            const done = D.quests.done.includes(q.slot);
            const C = q.st.case;
            return h('button', { class: 'mode' + (done ? ' locked' : ''), disabled: done || !C, onClick: () => briefing(q.st, q) },
              h('b', {}, `${done ? '✅ ' : ''}${C ? C.title : '의뢰 준비 중'}`),
              h('div', { class: 'muted' }, `${TYPE[q.st.t].icon} ${TYPE[q.st.t].name} · ${LV[q.st.t][q.st.lv]} · 최대 ${Math.round(baseXP(q.st) * (1 + 0.15 * rank('fame') + streakBonus(D.streak.last === today() ? D.streak.n : streakNow() + 1)))} XP${done ? ' · 해결함' : ''}`));
          }),
          back('← 탐정증', hub),
        );
      }

      hub();
    },
  };
  DO.registerMode(MODE);
})();
