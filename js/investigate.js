// 현장 수사: 명탐정의 길(career.js)의 사건 진행 방식.
//   DO.investigate(root, C, opt)  opt = { level 0~3, variant, boss, actionsBonus, heartsBonus, lens, gut, freeHints, onDone({ win, stars }) }
//
// 흐름: 도입 영상(레터박스 + 카메라 이동 + 타자 내레이션 + 용의자 등장)
//   → 현장(사건 배경 그림 위의 장소·사람을 눌러 조사) — 찾은 단서와 들은 말은 수첩에 자동으로 적힌다
//   → 추리(범인 고르기 → 그 사람의 거짓말 고르기 → 그 말을 무너뜨릴 증거 제시)
//   → "이의 있음!" 연출 → 자백 → 결과. 보스는 한 번 버티므로 모순을 두 번 찔러야 한다.
// 사건 데이터에서 그대로 만든다: 진술 = 조건에 대한 주장(범인은 lies 에서 거짓), 단서 = clues(exposes 가 무너뜨리는 주제), 장소 = scene.spots.
// 정답 판정: 고른 사람이 범인이고, 고른 말이 범인의 거짓말 주제(T)이고, 고른 증거가 T 를 폭로(exposes === T)하면 성공.

(() => {
  const { h, render, rng, hashString, shuffle } = DO;
  const sfx = (n, o) => { if (DO.sfx) DO.sfx(n, o); };
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- 배경 그림 (사건 배경마다 다름, 밤이면 어둡게) ----------
  const CATEGORY_THEME = { '학교·학원': 'school', '가족·동네': 'town', '모임·행사': 'event', '가게·시설': 'shop', '여행': 'travel', '온라인': 'online' };
  function themeOf(C) {
    if (CATEGORY_THEME[C.category]) return CATEGORY_THEME[C.category];
    const t = (C.scene && C.scene.name || '') + ' ' + C.intro;
    if (/교실|학교|학원|도서관|체육관|과학실|컴퓨터실|음악실|미술실|방송실|교무실|급식실|학생회/.test(t)) return 'school';
    if (/편의점|가게|카페|병원|약국|마트|식당/.test(t)) return 'shop';
    if (/호텔|공항|수영장|캠핑|여행|역/.test(t)) return 'travel';
    if (/축제|파티|결혼|공연|행사/.test(t)) return 'event';
    if (/게임|온라인|채팅/.test(t)) return 'online';
    return 'town';
  }
  const isNight = C => /밤|저녁|새벽|야자|야간/.test(C.intro);
  const stars5 = () => [[30, 18], [70, 30], [120, 14], [300, 20], [330, 44], [180, 26]].map(([x, y], i) => `<circle class="tw" style="animation-delay:${i * 0.4}s" cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('');
  const ART = {
    school: night => `
      <rect width="360" height="220" fill="#efd9b0"/><rect y="168" width="360" height="52" fill="#b98552"/>
      <path d="M0 180 H360 M0 196 H360" stroke="#a5743f" stroke-width="2"/>
      <rect x="36" y="28" width="176" height="84" rx="4" fill="#2f5d50" stroke="#7a5230" stroke-width="6"/>
      <path class="chalk" d="M54 52 h70 M54 68 h104 M54 84 h52 M150 84 l14 -14 l8 8" stroke="#eaf2ea" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <g transform="translate(246 40)"><circle r="15" fill="#fff" stroke="#25283a" stroke-width="3"/>
        <line class="hand-m" y2="-11" stroke="#25283a" stroke-width="2" stroke-linecap="round"/><line class="hand-h" y2="-6" stroke="#e2533f" stroke-width="3" stroke-linecap="round"/></g>
      <rect x="276" y="62" width="64" height="76" fill="${night ? '#1c2541' : '#a8dcf5'}" stroke="#fff" stroke-width="5"/>
      ${night ? `<circle cx="322" cy="82" r="9" fill="#f6e7b0"/>` : `<g class="drift"><ellipse cx="296" cy="84" rx="14" ry="6" fill="#fff"/></g>`}
      <path d="M308 62 V138 M276 100 H340" stroke="#fff" stroke-width="4"/>
      ${[40, 140, 240].map(x => `<rect x="${x}" y="150" width="70" height="10" rx="2" fill="#d9a066" stroke="#7a5230" stroke-width="2"/><path d="M${x + 8} 160 v16 M${x + 62} 160 v16" stroke="#7a5230" stroke-width="3"/>`).join('')}`,
    town: night => `
      <defs><linearGradient id="skyT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#151a36' : '#9fd3f0'}"/><stop offset="1" stop-color="${night ? '#3a3f6b' : '#fbe2bd'}"/></linearGradient>
      <radialGradient id="glowT"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient></defs>
      <rect width="360" height="220" fill="url(#skyT)"/>${night ? stars5() : ''}
      ${[[10, 70, 70], [90, 50, 60], [160, 80, 74], [250, 60, 66], [312, 76, 48]].map(([x, y, w], i) => `<rect x="${x}" y="${y}" width="${w}" height="${170 - y}" fill="${night ? '#262a46' : '#c98b5e'}"/>
        <polygon points="${x - 4},${y} ${x + w / 2},${y - 22} ${x + w + 4},${y}" fill="${night ? '#1d2038' : '#a5603a'}"/>
        <rect class="${i % 2 ? 'win' : 'win2'}" x="${x + 12}" y="${y + 18}" width="14" height="16" fill="${night ? '#ffd76a' : '#e8f4fb'}"/><rect x="${x + w - 26}" y="${y + 18}" width="14" height="16" fill="${night ? '#ffd76a' : '#e8f4fb'}" opacity=".85"/>`).join('')}
      <rect y="170" width="360" height="50" fill="#56596b"/><path d="M0 195 H360" stroke="#f6e7b0" stroke-width="3" stroke-dasharray="18 14"/>
      <path d="M232 170 V96 q0 -8 10 -8 h12" stroke="#25283a" stroke-width="4" fill="none"/>
      <circle class="flicker" cx="258" cy="94" r="${night ? 26 : 10}" fill="url(#glowT)"/><circle cx="258" cy="92" r="5" fill="#ffe9a0"/>`,
    event: () => `
      <rect width="360" height="220" fill="#3b2a5c"/>
      <polygon class="spot" points="180,0 120,220 240,220" fill="#fff6c8" opacity=".14"/>
      <rect x="70" y="120" width="220" height="50" fill="#7a3b2e"/><rect x="70" y="116" width="220" height="8" fill="#a8553f"/>
      <path d="M0 0 Q24 90 8 220 H0 Z M360 0 Q336 90 352 220 H360 Z" fill="#c2342b"/>
      <path d="M10 26 Q180 66 350 26" stroke="#25283a" stroke-width="1.5" fill="none"/>
      ${Array.from({ length: 13 }, (_, i) => { const x = 22 + i * 26, y = 26 + 40 * Math.sin(Math.PI * (x - 10) / 340) * 0.98; return `<circle class="${i % 2 ? 'bulb' : 'bulb2'}" cx="${x}" cy="${y}" r="4" fill="${['#ffd76a', '#ff7a8a', '#7ad3ff'][i % 3]}"/>`; }).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<polygon points="${40 + i * 32},70 ${56 + i * 32},70 ${48 + i * 32},84" fill="${['#f6cb5c', '#e2533f', '#3f73c4', '#3a9a6a'][i % 4]}"/>`).join('')}
      <rect y="170" width="360" height="50" fill="#2a1f42"/>`,
    shop: night => `
      <rect width="360" height="220" fill="#e7f0ea"/><rect y="172" width="360" height="48" fill="#c9cfd6"/>
      <rect class="flicker2" x="60" y="10" width="110" height="6" rx="3" fill="#fbfff5" stroke="#9aa" /><rect x="200" y="10" width="110" height="6" rx="3" fill="#fbfff5" stroke="#9aa"/>
      ${[40, 80, 120].map(y => `<rect x="20" y="${y}" width="160" height="6" fill="#8b6b4a"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${26 + i * 19}" y="${y - 18}" width="14" height="18" rx="2" fill="${['#e2533f', '#f6cb5c', '#3f73c4', '#3a9a6a', '#8a5cc8'][(i + y) % 5]}"/>`).join('')}`).join('')}
      <rect x="220" y="120" width="120" height="52" fill="#b9845a" stroke="#7a5230" stroke-width="3"/><rect x="290" y="98" width="34" height="22" rx="3" fill="#25283a"/><rect x="295" y="102" width="24" height="8" fill="#7ad3a0"/>
      <rect x="232" y="34" width="96" height="40" rx="8" fill="#25283a"/><text class="neon" x="280" y="62" text-anchor="middle" font-size="20" font-weight="800" fill="#ff5d7a" font-family="sans-serif">OPEN</text>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".28"/>' : ''}`,
    travel: night => `
      <rect width="360" height="220" fill="#dfe7ef"/><rect y="172" width="360" height="48" fill="#b7c2cc"/>
      <rect x="20" y="20" width="230" height="120" rx="6" fill="${night ? '#1c2541' : '#a8dcf5'}" stroke="#fff" stroke-width="6"/>
      ${night ? stars5() : '<g class="drift"><ellipse cx="80" cy="60" rx="20" ry="7" fill="#fff"/><ellipse cx="190" cy="44" rx="16" ry="6" fill="#fff"/></g>'}
      <g class="plane"><path d="M0 0 l26 -3 l8 -8 h4 l-4 9 l14 -1 l4 -5 h3 l-2 6 l2 6 h-3 l-4 -5 l-14 -1 l4 9 h-4 l-8 -8 z" fill="${night ? '#f6e7b0' : '#fff'}" stroke="#25283a" stroke-width="1"/></g>
      <path d="M97 20 V140 M174 20 V140" stroke="#fff" stroke-width="4"/>
      <rect x="268" y="24" width="76" height="70" rx="4" fill="#25283a"/>
      ${[38, 52, 66, 80].map((y, i) => `<rect x="276" y="${y - 7}" width="${40 + (i * 13) % 20}" height="6" fill="#f6cb5c" opacity=".9"/><rect class="${i === 1 ? 'blink' : ''}" x="324" y="${y - 7}" width="12" height="6" fill="${i === 1 ? '#7ad3a0' : '#f6cb5c'}"/>`).join('')}
      <rect x="270" y="132" width="30" height="40" rx="5" fill="#e2533f" stroke="#25283a" stroke-width="2"/><rect x="306" y="144" width="26" height="28" rx="5" fill="#3f73c4" stroke="#25283a" stroke-width="2"/>`,
    online: () => `
      <rect width="360" height="220" fill="#141a2e"/>
      <radialGradient id="glowO"><stop offset="0" stop-color="#3f73c4" stop-opacity=".45"/><stop offset="1" stop-color="#3f73c4" stop-opacity="0"/></radialGradient>
      <circle cx="180" cy="80" r="150" fill="url(#glowO)"/>
      <rect x="90" y="20" width="180" height="112" rx="8" fill="#0f2a44" stroke="#25283a" stroke-width="6"/>
      <clipPath id="scr"><rect x="98" y="28" width="164" height="96"/></clipPath>
      <g clip-path="url(#scr)"><g class="scroll">${Array.from({ length: 16 }, (_, i) => `<rect x="${106 + (i * 7) % 24}" y="${32 + i * 12}" width="${40 + (i * 37) % 90}" height="5" rx="2" fill="${['#7ad3a0', '#7ad3ff', '#f6cb5c', '#ff7a8a'][i % 4]}" opacity=".85"/>`).join('')}</g></g>
      <g class="bob"><rect x="224" y="92" width="18" height="18" fill="#ff7a8a"/><rect x="228" y="97" width="3" height="3" fill="#141a2e"/><rect x="235" y="97" width="3" height="3" fill="#141a2e"/></g>
      <rect x="168" y="132" width="24" height="18" fill="#25283a"/><rect x="60" y="150" width="240" height="22" rx="4" fill="#2b3150"/>
      <rect class="rgb" x="70" y="156" width="220" height="10" rx="3" fill="#7ad3ff"/>
      <rect y="172" width="360" height="48" fill="#0e1222"/>`,
  };
  const art = (theme, night) => `<svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" class="art art-${theme}${night ? ' night' : ''}">${(ART[theme] || ART.town)(night)}</svg>`;
  // 장소 단서를 놓는 자리 (그림 위 %)
  const SLOTS = [[14, 30], [38, 16], [65, 27], [87, 22], [36, 52]];
  const JUNK = ['먼지만 쌓여 있다.', '아무것도 없다.', '오래된 영수증 한 장. 사건과는 관계없어 보인다.', '떨어진 머리끈. 누구 건지 알 수 없다.', '구겨진 메모: "우유 사 오기". 상관없어 보인다.', '사탕 껍질이 몇 개. 사건과는 관계없는 듯.'];
  const OPENERS = ['무슨 일이에요? 저 바쁜데…', '저도 놀랐어요. 진짜예요.', '뭐든 물어보세요. 숨길 거 없어요.', '하아… 빨리 끝내 주세요.', '제가 의심받는 거예요?', '기억나는 대로 말할게요.'];
  const LEVELS = [
    { actions: Infinity, related: true },
    { actions: 16, related: true },
    { actions: 13, related: false },
    { actions: 11, related: false },
  ];

  // ---------- 타자 효과 ----------
  // 다 쓰이기 전에 누르면 바로 끝까지 보인다. 다 쓰이면 resolve.
  function typeInto(el, text, speed = 24) {
    return new Promise(res => {
      if (reduced() || !text) { el.textContent = text; return res(); }
      let i = 0, timer = null;
      const done = () => { clearInterval(timer); el.textContent = text; el.classList.remove('typing'); el.removeEventListener('click', done); res(); };
      el.classList.add('typing'); el.textContent = '';
      el.addEventListener('click', done);
      timer = setInterval(() => {
        if (!el.isConnected) return done();
        i++; el.textContent = text.slice(0, i);
        if (i % 3 === 1) sfx('type');
        if (i >= text.length) done();
      }, speed);
    });
  }

  DO.investigate = function investigate(root, C, opt = {}) {
    const lv = LEVELS[Math.max(0, Math.min(3, opt.level | 0))];
    const R = rng(hashString(`inv:${C.id}:${opt.variant | 0}`));
    const theme = themeOf(C), night = isNight(C);
    const condOf = tag => C.conditions.find(c => c.tag === tag);
    const clause = tag => condOf(tag).text.replace(/\s*접어\s*$/, '').replace(/\s*사람$/, '');
    const claims = (s, tag) => s.traits.includes(tag) !== s.lies.includes(tag);
    const culprit = C.suspects.find(s => s.id === C.culprit);
    const sus = C.suspects;
    const allTags = C.conditions.map(c => c.tag);
    const clueTags = C.clues.map(c => c.exposes).filter(t => t && condOf(t));
    const lieTags = culprit.lies.filter(t => condOf(t) && C.clues.some(c => c.exposes === t));
    const needHits = opt.boss ? Math.min(2, lieTags.length) : 1;   // 보스는 모순을 두 번

    // 처음 듣는 알리바이: 모두 2~3마디로 겉보기엔 같다. 범인은 거짓말 주제 + 사실 하나, 나머지는 단서 주제 + 자기 일.
    const alibiTags = {};
    for (const s of sus) {
      let tags;
      if (s === culprit) tags = [...lieTags, ...shuffle(allTags.filter(t => !s.lies.includes(t) && s.traits.includes(t)), R).slice(0, 1)];
      else tags = [...shuffle(clueTags, R).slice(0, R() < 0.6 ? 2 : 1), ...shuffle(allTags.filter(t => !clueTags.includes(t) && s.traits.includes(t)), R).slice(0, 1)];
      tags = [...new Set(tags)];
      for (const t of shuffle(allTags, R)) { if (tags.length >= 2) break; if (!tags.includes(t)) tags.push(t); }
      alibiTags[s.id] = shuffle(tags, R).slice(0, 3);
    }
    const sayOf = (s, tag) => (claims(s, tag) ? `${clause(tag)} 사람, 그건 저예요.` : `${clause(tag)} 사람이요? 그건 제가 아니에요.`);
    const opener = s => OPENERS[hashString(C.id + s.id) % OPENERS.length];

    // 장소와 숨은 물건
    const spotsSrc = (C.scene && C.scene.spots && C.scene.spots.length ? C.scene.spots : [['🗄', '서랍장'], ['🪑', '의자 밑'], ['🗑', '휴지통'], ['📦', '상자 더미'], ['🚪', '문 뒤']]).slice(0, 5);
    while (spotsSrc.length < 4) spotsSrc.push([['🗑', '휴지통'], ['📦', '상자 더미']][spotsSrc.length % 2]);
    const spots = spotsSrc.map(([emoji, name], i) => ({ emoji, name, slot: SLOTS[i], item: null, searched: false }));
    const order = shuffle(spots.map((_, i) => i), R);
    shuffle(C.clues, R).forEach((c, k) => { if (order[k] != null) spots[order[k]].item = { clue: c }; });
    spots.forEach(sp => { if (!sp.item) sp.item = { junk: JUNK[Math.floor(R() * JUNK.length)] }; });
    // 단서가 장소보다 많으면(장소 4곳 + 단서 3장은 충분) 남은 단서는 마지막 장소에 함께
    C.clues.forEach(c => { if (!spots.some(sp => sp.item.clue === c)) spots[spots.length - 1].item.extra = c; });

    // 진행 상태
    let actions = lv.actions + (opt.actionsBonus | 0) + (opt.boss ? 2 : 0);   // 보스는 증거가 둘 필요해서 +2
    let hearts = 3 + (opt.heartsBonus | 0);
    let hintsLeftFree = opt.freeHints | 0, hintsUsed = 0;
    const found = [];                         // 찾은 단서 (순서대로)
    const heard = {}; sus.forEach(s => { heard[s.id] = []; });   // 들은 말: { tag, yes, text }
    const shown = {}; sus.forEach(s => { shown[s.id] = new Set(); });  // 그 사람에게 보여 준 단서 id
    const marks = {}; sus.forEach(s => { marks[s.id] = 0; });    // 0 없음, 1 결백, 2 의심
    const hits = new Set();                   // 찌른 모순(주제)
    let log = '어디부터 조사할까? 그림 속 장소나 사람을 눌러 보세요.';
    if (opt.gut) { const inn = shuffle(sus.filter(s => s !== culprit), R)[0]; if (inn) { marks[inn.id] = 1; log = `🔮 직감: ${inn.name}은(는) 왠지 결백해 보인다. (수첩에 ✅)`; } }

    const face = (s, size) => DO.face(C, s, size);
    const nameOf = s => s.name;
    const record = (s, tag) => {
      if (!tag || !condOf(tag)) return null;
      if (heard[s.id].some(x => x.tag === tag)) return null;
      const st = { tag, yes: claims(s, tag), text: sayOf(s, tag) };
      heard[s.id].push(st);
      return st;
    };
    const spend = () => { if (actions !== Infinity) actions = Math.max(0, actions - 1); };
    const outOfTime = () => actions !== Infinity && actions <= 0;
    const heartsText = () => '❤️'.repeat(hearts) + '🤍'.repeat(Math.max(0, 3 + (opt.heartsBonus | 0) - hearts));
    const starsNow = () => Math.max(1, Math.min(3, hearts) - hintsUsed);
    const relatedLine = c => (lv.related && c.exposes && condOf(c.exposes) ? h('p', { class: 'muted small-text' }, `🔗 관련 이야기: "${clause(c.exposes)} 사람"`) : null);

    // 배경마다 다른 곡: 교실 = 초침, 골목 = 밤엔 빗소리 / 낮엔 취조실 블루스, 축제 = 파티 그루브, 가게 = 밤엔 어두운 방 / 낮엔 블루스,
    // 여행 = 밤엔 빗소리 / 낮엔 보사노바, 온라인 = 사이버 아르페지오
    const THEME_MUSIC = { school: 'think', town: night ? 'rainy' : 'interrogation', event: 'party', shop: night ? 'explore' : 'interrogation', travel: night ? 'rainy' : 'bossa', online: 'cyber' };
    const music = (fn, ...a) => { if (DO.music && DO.music[fn]) DO.music[fn](...a); };
    music('base', THEME_MUSIC[theme] || 'think');
    music('intensity', opt.boss ? 1 : 0);
    // 긴장도: 신뢰를 잃었거나 조사 횟수가 거의 없으면 곡에 층이 더해진다 (보스는 처음부터 한 단계)
    const tension = () => {
      const maxH = 3 + (opt.heartsBonus | 0);
      const n = hearts <= 1 ? 2 : (hearts < maxH || (actions !== Infinity && actions <= 3)) ? 1 : 0;
      music('intensity', Math.max(n, opt.boss ? 1 : 0));
    };

    // ---------- 1. 도입 영상 ----------
    function opening() {
      const sentences = (C.intro.match(/[^.!?]+[.!?]?/g) || [C.intro]).map(x => x.trim()).filter(Boolean);
      const shots = [
        { kind: 'title' },
        ...sentences.map(t => ({ kind: 'pan', text: t })),
        { kind: 'lineup', text: `용의자는 ${sus.length}명. 이 중 한 명이 거짓말을 하고 있다.` },
      ];
      let k = 0;
      const cap = h('p', { class: 'cine-cap' });
      const stage = h('div', { class: 'cine-stage', html: art(theme, night) });
      const over = h('div', { class: 'cine-over' });
      const next = () => { k++; if (k >= shots.length) return scene(); show(); };
      const nextBtn = h('button', { class: 'primary', onClick: next }, '▶ 다음');
      const box = h('div', { class: 'cine' + (opt.boss ? ' boss' : '') }, h('div', { class: 'cine-bar top' }), stage, over, h('div', { class: 'cine-bar bottom' }));
      function show() {
        const s = shots[k];
        stage.className = 'cine-stage ' + (s.kind === 'pan' ? `pan pan-${k % 2}` : s.kind === 'title' ? 'dim' : 'dim');
        over.replaceChildren();
        if (s.kind === 'title') {
          over.append(h('div', { class: 'cine-title' },
            h('div', { class: 'cine-kicker' }, opt.boss ? '👑 BOSS CASE' : 'CASE FILE'),
            h('div', { class: 'cine-name' }, C.title),
            h('div', { class: 'cine-place' }, `📍 ${(C.scene && C.scene.name) || '사건 현장'}`)));
          cap.textContent = '';
          sfx(opt.boss ? 'bossOpen' : 'caseOpen');
        } else if (s.kind === 'lineup') {
          over.append(h('div', { class: 'lineup-cine' }, sus.map((x, i) => h('div', { class: 'lc', style: `animation-delay:${0.12 * i}s` }, face(x, sus.length > 5 ? 44 : 52), h('span', {}, nameOf(x))))));
          typeInto(cap, s.text);
          sfx('whoosh');
          sus.forEach((_, i) => sfx('coin', { delay: 0.15 + 0.12 * i, step: i * 2 })); // 한 명씩 등장할 때마다 톡
        } else typeInto(cap, s.text);
        nextBtn.textContent = k === shots.length - 1 ? '🔍 수사 시작' : '▶ 다음';
      }
      render(root, box, cap, nextBtn, h('button', { class: 'small', onClick: () => scene() }, '⏩ 건너뛰기'));
      show();
    }

    // ---------- 2. 현장 ----------
    function hud() {
      return h('div', { class: 'inv-hud' },
        h('span', { class: 'grow' }, `📍 ${(C.scene && C.scene.name) || '사건 현장'}`),
        h('span', { title: '남은 조사 횟수' }, actions === Infinity ? '👣 ∞' : `👣 ${actions}`),
        h('span', { title: '신뢰' }, heartsText()));
    }
    function scene(msg) {
      if (msg) log = msg;
      // 카메라 층(cam) 안에 그림·장소·사람을 넣고, 조사할 때 cam 만 확대한다
      const cam = h('div', { class: 'inv-cam', html: art(theme, night) });
      const stage = h('div', { class: 'inv-stage' }, cam);
      spots.forEach(sp => {
        const sparkle = opt.lens && !sp.searched && sp.item.clue;
        cam.append(h('button', {
          class: 'hot' + (sp.searched ? ' done' : '') + (sparkle ? ' sparkle' : ''), style: `left:${sp.slot[0]}%; top:${sp.slot[1]}%`,
          'data-quiet': '1', 'aria-label': sp.name, onClick: () => search(sp, cam),
        }, h('span', { class: 'hot-emoji' }, sp.searched ? '✔️' : sp.emoji), h('span', { class: 'hot-name' }, sp.name)));
      });
      cam.append(h('div', { class: 'hot-people' }, sus.map(s => h('button', {
        class: 'hot-person' + (heard[s.id].length ? ' talked' : '') + (marks[s.id] === 1 ? ' cleared' : marks[s.id] === 2 ? ' sus' : ''),
        'data-quiet': '1', 'aria-label': s.name, onClick: () => talk(s),
      }, face(s, 40), h('span', {}, s.name)))));
      tension();
      const canDeduce = found.length && sus.some(s => heard[s.id].length);
      render(root,
        hud(), stage,
        h('div', { class: 'inv-log' }, log),
        h('div', { class: 'row' },
          h('button', { class: 'grow', onClick: () => notebook() }, `📓 수첩 (${found.length + sus.reduce((n, s) => n + heard[s.id].length, 0)})`),
          h('button', { class: 'grow', onClick: () => hint() }, `🐕 조수 콩이${hintsLeftFree ? ' (무료)' : ''}`)),
        h('button', { class: 'danger', disabled: !canDeduce, onClick: () => deduce() }, canDeduce ? '🔎 추리 시작' : '🔎 추리 (단서와 진술을 먼저 모으세요)'),
        outOfTime() ? h('p', { class: 'muted small-text center' }, '조사 횟수를 다 썼다. 이제 모은 것으로 추리해야 한다.') : null,
      );
    }

    // 장소 조사: 돋보기로 확대 → 결과 카드
    function search(sp, cam) {
      if (sp.searched) return scene(`${sp.emoji} ${sp.name}: 이미 조사한 곳이다.`);
      if (outOfTime()) { DO.toast('조사 횟수를 다 썼습니다. 추리를 시작하세요.'); return; }
      spend(); sp.searched = true;
      sfx('zoom'); sfx('rummage', { delay: 0.45 });
      cam.style.transformOrigin = `${sp.slot[0]}% ${sp.slot[1]}%`;
      cam.classList.add('zoom');
      cam.append(h('div', { class: 'magnifier', style: `left:${sp.slot[0]}%; top:${sp.slot[1]}%` }, '🔍'));
      root.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const skip = h('button', { class: 'small', onClick: () => reveal() }, '⏩');
      root.append(skip);
      let doneOnce = false;
      const reveal = () => {
        if (doneOnce) return; doneOnce = true;
        const clues = [sp.item.clue, sp.item.extra].filter(Boolean);
        if (!clues.length) { sfx('empty'); return scene(`${sp.emoji} ${sp.name}: ${sp.item.junk}`); }
        clues.forEach(c => { if (!found.includes(c)) found.push(c); });
        sfx('clue');
        // 클로즈업: 그 장소를 크게 비춘 장면 위에 단서 카드
        const close = h('div', { class: 'closeup', html: art(theme, night) }, h('div', { class: 'closeup-emoji' }, sp.emoji));
        close.querySelector('svg').style.transformOrigin = `${sp.slot[0]}% ${sp.slot[1]}%`;
        render(root, hud(), close,
          h('div', { class: 'clue-pop' },
            h('div', { class: 'clue-kicker' }, '🗂 단서 획득!'),
            clues.map(c => h('div', { class: 'card clue-card' }, h('p', {}, c.text), relatedLine(c))),
            h('p', { class: 'muted small-text' }, `${sp.emoji} ${sp.name}에서 찾았다. 수첩에 기록했다.`)),
          h('button', { class: 'primary', onClick: () => scene(`📓 단서를 수첩에 적었다. 누구의 말과 부딪히는지 생각해 보자.`) }, '📓 수첩에 기록하고 계속'));
      };
      setTimeout(reveal, reduced() ? 0 : 1100);
    }

    // ---------- 대화 (비주얼 노벨) ----------
    function talk(s, said) {
      const bubble = h('p', { class: 'vn-bubble' });
      const first = !heard[s.id].length && !said;
      const offered = found.filter(c => !shown[s.id].has(c.id));
      const choices = h('div', { class: 'vn-choices' });
      const paint = () => choices.replaceChildren(...[
        !heard[s.id].length ? h('button', { class: 'primary', disabled: outOfTime(), onClick: askAlibi }, `💬 그 시간에 뭘 했는지 묻기${actions === Infinity ? '' : ' (👣1)'}`) : null,
        offered.length ? h('div', { class: 'vn-label muted small-text' }, '🗂 단서를 보여 주고 반응 보기' + (actions === Infinity ? '' : ' (👣1)')) : null,
        offered.map(c => h('button', { class: 'small vn-clue', disabled: outOfTime(), onClick: () => present(c) }, c.text.length > 34 ? c.text.slice(0, 33) + '…' : c.text)),
        h('div', { class: 'row' },
          h('button', { class: 'small grow', onClick: () => { marks[s.id] = (marks[s.id] + 1) % 3; sfx('scribble'); talk(s, bubble.textContent); } },
            marks[s.id] === 1 ? '✅ 결백 표시됨' : marks[s.id] === 2 ? '❓ 의심 표시됨' : '✏️ 표시하기'),
          h('button', { class: 'small grow', onClick: () => scene() }, '↩ 현장으로')),
      ].flat().filter(Boolean));
      function askAlibi() {
        if (outOfTime()) return;
        spend();
        const lines = alibiTags[s.id].map(tag => { record(s, tag); return sayOf(s, tag); });
        const text = `${opener(s)} ${lines.join(' ')}`;
        log = `💬 ${s.name}의 이야기를 수첩에 적었다.`;
        typeInto(bubble, text).then(paint);
        paint();
      }
      function present(c) {
        if (outOfTime()) return;
        spend(); shown[s.id].add(c.id);
        const tag = c.exposes && condOf(c.exposes) ? c.exposes : null;
        const st = tag ? record(s, tag) : null;
        const text = tag
          ? (claims(s, tag) ? `이거요? …${clause(tag)} 사람, 그건 저 맞아요.` : `이게 저랑 무슨 상관이죠? ${clause(tag)} 사람은 제가 아니에요.`)
          : ['글쎄요, 처음 보는데요.', '그게 뭔데요? 모르겠어요.', '저랑은 상관없어 보이는데요.'][hashString(s.id + c.id) % 3];
        log = st ? `🗂 ${s.name}에게 단서를 보여 줬다. 대답을 수첩에 적었다.` : `🗂 ${s.name}은(는) 그 단서를 모른다고 했다.`;
        offered.splice(offered.indexOf(c), 1);
        typeInto(bubble, text).then(paint);
        paint();
      }
      render(root, hud(),
        h('div', { class: 'vn' },
          h('div', { class: 'vn-bg', html: art(theme, night) }),
          h('div', { class: 'vn-face' }, face(s, 112)),
          h('div', { class: 'vn-name' }, s.name)),
        bubble, choices);
      if (said) { bubble.textContent = said; paint(); }
      else if (first) { typeInto(bubble, `(${s.name}이(가) 경계하는 눈빛으로 당신을 본다.)`).then(paint); paint(); }
      else { typeInto(bubble, `"또 뭐요?"`).then(paint); paint(); }
      sfx('select');
    }

    // ---------- 수첩 ----------
    function notebook(tab = 'clues') {
      const tabs = h('div', { class: 'chips' },
        h('button', { class: 'chip' + (tab === 'clues' ? ' active' : ''), onClick: () => notebook('clues') }, `🗂 단서 ${found.length}`),
        sus.map(s => h('button', { class: 'chip' + (tab === s.id ? ' active' : ''), onClick: () => notebook(s.id) },
          (marks[s.id] === 1 ? '✅ ' : marks[s.id] === 2 ? '❓ ' : '') + s.name)));
      let body;
      if (tab === 'clues') {
        body = found.length ? found.map(c => h('div', { class: 'card clue-card' }, h('p', {}, c.text), relatedLine(c)))
          : [h('p', { class: 'muted' }, '아직 찾은 단서가 없다. 현장의 장소를 조사해 보자.')];
      } else {
        const s = sus.find(x => x.id === tab);
        body = [h('div', { class: 'card nb-person' },
          h('div', { class: 'profile-head' }, face(s, 52), h('h3', {}, s.name)),
          heard[s.id].length ? heard[s.id].map(st => h('p', { class: 'nb-say' }, `“${st.text}”`)) : h('p', { class: 'muted' }, '아직 이야기를 듣지 못했다.'),
          h('div', { class: 'row' }, ['없음', '✅ 결백', '❓ 의심'].map((t, k) => h('button', { class: 'small grow' + (marks[s.id] === k ? ' primary' : ''), onClick: () => { marks[s.id] = k; sfx('scribble'); notebook(tab); } }, t))))];
      }
      sfx('paper');
      render(root, h('h2', {}, '📓 수사 수첩'), tabs, body, h('button', { class: 'primary', onClick: () => scene() }, '↩ 현장으로'));
    }

    // ---------- 조수 힌트 ----------
    function hint() {
      const free = hintsLeftFree > 0;
      if (!free && !confirm('조수 콩이에게 물어볼까요? 이번 사건의 최대 별이 하나 줄어듭니다.')) return;
      if (free) hintsLeftFree--; else hintsUsed++;
      sfx('hint');
      const lieClue = C.clues.find(c => lieTags.includes(c.exposes) && !hits.has(c.exposes) && !found.includes(c));
      const sp = lieClue && spots.find(x => x.item.clue === lieClue || x.item.extra === lieClue);
      let msg;
      if (sp) msg = `🐕 콩이가 ${sp.emoji} ${sp.name} 쪽을 킁킁거린다. 저기 뭔가 있다!`;
      else if (!heard[culprit.id].length) msg = '🐕 콩이가 아직 이야기를 안 들어 본 사람들을 번갈아 본다. 모두의 이야기를 들어 보자.';
      else {
        const t = lieTags.find(x => !hits.has(x)) || lieTags[0];
        msg = `🐕 콩이가 수첩의 "${clause(t)} 사람" 이야기를 앞발로 톡톡 친다. 그 이야기를 한 사람들 중 단서와 안 맞는 사람이 있다.`;
      }
      scene(msg);
    }

    // ---------- 3. 추리 ----------
    function deduce(pre) {
      const step1 = () => {
        render(root, hud(),
          h('h2', {}, hits.size ? '🔎 다시 몰아붙인다' : '🔎 추리 — 범인은 누구인가?'),
          h('p', { class: 'muted' }, '거짓말을 한 사람을 고르세요. 틀리면 신뢰(❤️)가 하나 줄어듭니다.'),
          h('div', { class: 'suspect-grid' }, sus.map(s => h('button', { class: 'suspect-pick', onClick: () => step2(s) },
            face(s, 64), h('b', {}, s.name),
            h('span', { class: 'muted small-text' }, marks[s.id] === 1 ? '✅ 결백 표시' : marks[s.id] === 2 ? '❓ 의심' : `말 ${heard[s.id].length}개`)))),
          h('button', { onClick: () => scene() }, '↩ 현장으로 돌아가기'));
        if (DO.music) DO.music.hold('suspense');
      };
      const step2 = s => {
        const says = heard[s.id].filter(st => !hits.has(st.tag));
        render(root, hud(),
          h('div', { class: 'profile-head' }, face(s, 56), h('h2', {}, `${s.name}의 말 중 거짓은?`)),
          says.length ? says.map(st => h('button', { class: 'mode say-pick', onClick: () => step3(s, st) }, h('div', {}, `“${st.text}”`)))
            : h('p', { class: 'muted' }, '아직 이 사람의 (남은) 말을 듣지 못했다. 현장에서 이야기를 더 들어 보자.'),
          h('button', { onClick: pre ? () => step2(pre) : step1 }, '↩ 다른 사람 고르기'));
        if (DO.music) DO.music.hold('suspense');
      };
      const step3 = (s, st) => {
        render(root, hud(),
          h('p', { class: 'say-quote' }, `${s.name}: “${st.text}”`),
          h('h2', {}, '이 말을 무너뜨릴 증거는?'),
          found.map(c => h('button', { class: 'mode clue-pick', onClick: () => judge(s, st, c) }, h('div', {}, '🗂 ' + c.text))),
          h('button', { onClick: () => step2(s) }, '↩ 다른 말 고르기'));
        if (DO.music) DO.music.hold('suspense');
      };
      if (pre) step2(pre); else step1();
    }

    function judge(s, st, c) {
      const right = s === culprit && lieTags.includes(st.tag) && c.exposes === st.tag && !hits.has(st.tag);
      if (right) { hits.add(st.tag); return objection(s, st, c); }
      hearts--;
      const line = s !== culprit ? '저를 의심하는 거예요? 그 증거랑 제 말은 하나도 안 어긋나요!' : '그게 뭐 어쨌다는 거죠? 그 증거랑 그 말은 아무 상관 없는데요.';
      if (hearts <= 0) return ending(false);
      render(root, hud(),
        h('div', { class: 'card alert center' }, face(s, 76), h('p', {}, h('b', {}, s.name), ': ', `“${line}”`),
          h('p', { class: 'muted' }, `신뢰 -1 · 남은 신뢰 ${heartsText()}`)),
        h('button', { class: 'primary', onClick: () => deduce(s === culprit ? s : null) }, '🔎 다시 생각해 보기'),
        h('button', { onClick: () => scene('😓 헛짚었다. 수첩을 다시 읽어 보자.') }, '↩ 현장으로'));
      if (DO.fx) DO.fx.fail(null, 'miss'); else sfx('miss');
      tension();
    }

    // "이의 있음!" → (보스면 반격) → 자백
    function objection(s, st, c) {
      const strike = h('p', { class: 'say-quote struck' }, `“${st.text}”`);
      const cap = h('p', { class: 'cine-cap' });
      render(root,
        h('div', { class: 'objection' }, h('div', { class: 'obj-burst' }, '이의 있음!')),
        strike,
        h('div', { class: 'card clue-card slam' }, h('p', {}, '🗂 ' + c.text)),
        cap,
        h('div', { class: 'obj-face shake' }, face(s, 96)),
        h('button', { class: 'primary', onClick: after }, '▶ 다음'));
      sfx('objection'); sfx('slam', { delay: 0.55 });
      music('hold', 'pursuit');
      document.body.classList.add('flash');
      setTimeout(() => document.body.classList.remove('flash'), 450);
      typeInto(cap, `${s.name}은(는) "${clause(st.tag)} 사람"에 대해 거짓말을 했다. 이 증거와 맞지 않는다!`);
      function after() {
        if (hits.size < needHits) {
          // 보스의 반격
          const capB = h('p', { class: 'cine-cap' });
          render(root, hud(),
            h('div', { class: 'obj-face' }, face(s, 96)),
            h('div', { class: 'boss-hp' }, Array.from({ length: needHits }, (_, i) => h('span', { class: i < hits.size ? 'off' : '' }))),
            capB,
            h('button', { class: 'danger', onClick: () => deduce(s) }, '🔎 다른 거짓말도 찌른다'),
            h('button', { onClick: () => scene('👑 범인이 버티고 있다. 다른 거짓말을 무너뜨릴 증거를 찾자.') }, '↩ 현장으로 (증거 더 찾기)'));
          typeInto(capB, `${s.name}: "하, 그게 다예요? 그거 하나로는 제가 범인이라는 증거가 안 되죠!"`);
          sfx('counter');
          music('hold', 'pursuit');
          return;
        }
        confession(s);
      }
    }
    // 자백: 범인의 비밀 프로필을 1인칭으로 바꿔 쓴다 (거짓말 지시 문장은 뺀다)
    function confessionText() {
      const parts = (culprit.profile.match(/[^.!?]+[.!?]?/g) || []).map(x => x.trim()).filter(x => x && !/범인이다|거짓말|남들에겐|말할 생각/.test(x));
      const body = parts.join(' ').replace(/당신은/g, '저는').replace(/당신이/g, '제가').replace(/당신의/g, '제').replace(/당신/g, '저');
      // 과거형 '…았다/었다/했다/갔다/있었다.' 를 말투 '…어요.' 로 (받침이 ㅆ 인 글자 + 다.)
      const polite = body.replace(/([가-힣])다\./g, (m, ch) => ((ch.charCodeAt(0) - 0xac00) % 28 === 20 ? `${ch}어요.` : m));
      return `…네, 맞아요. 제가 했어요. ${polite}`;
    }
    function confession(s) {
      const cap = h('p', { class: 'cine-cap' });
      render(root,
        h('div', { class: 'cine confess' }, h('div', { class: 'cine-bar top' }), h('div', { class: 'cine-stage dim', html: art(theme, night) }),
          h('div', { class: 'cine-over' }, h('div', { class: 'confess-face' }, face(s, 110))), h('div', { class: 'cine-bar bottom' })),
        cap,
        h('button', { class: 'primary', onClick: () => ending(true) }, '▶ 사건 종결'));
      typeInto(cap, `${s.name}: "${confessionText()}"`, 30);
      sfx('confess');
      music('hold', 'confess');
    }

    function ending(win) {
      const stars = win ? starsNow() : 0;
      render(root,
        h('div', { class: 'verdict' },
          h('div', { class: 'stamp ' + (win ? 'win' : 'lose') }, win ? '검거' : '미제'),
          face(culprit, 96),
          h('h2', {}, win ? '사건 해결!' : '신뢰를 모두 잃었다'),
          h('p', {}, '범인: ', h('b', {}, culprit.name)),
          win ? h('p', { class: 'reward-stars' }, [1, 2, 3].map(k => h('span', { class: k <= stars ? 'on' : '' }, '★'))) : null,
          h('p', { class: 'muted small-text' }, `남은 신뢰 ${Math.max(0, hearts)} · 조수 힌트 ${hintsUsed}번`)),
        h('h3', {}, '🧩 사건의 진실'),
        h('div', { class: 'card' },
          lieTags.map(t => {
            const c = C.clues.find(x => x.exposes === t);
            return h('p', {}, `· "${clause(t)} 사람" — ${culprit.name}은(는) ${claims(culprit, t) ? '맞다고' : '아니라고'} 했지만 거짓. 증거: ${c ? c.text : '-'}`);
          })),
        h('button', { class: 'primary', onClick: () => opt.onDone && opt.onDone({ win, stars }) }, '📒 수첩으로 돌아가기'));
      if (DO.fx) DO.fx.ending(win);
    }

    opening();
  };
})();
