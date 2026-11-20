// 모드 7: 알리바이 깨기 (혼자 또는 한 화면을 같이 보며)
//
// 사건의 용의자와 현장을 빌려와 "시간대별 진술표"를 만든다 (js/alibi-engine.js).
// 단 한 명만 거짓말을 하고, 나머지 진술과 모든 증거는 사실이다.
// CCTV 인원 수 · 문 센서 · 출입 기록 · 목격 증언을 진술표와 대조해서 거짓말쟁이를 논리로 찾아낸다.
//
// 화면
//  1. 소개(용의자 라인업, 난이도) → 2. 수사 보드(진술표 · 장소 범례 · 대조 창 · 증거 카드 · 지도) → 3. 지목 → 4. 결과(도장, 재연, 해설)
// 보드는 한 번 만들고 update() 로 강조만 바꾼다 (카드 줄의 가로 스크롤 위치가 유지되도록).

(() => {
  const { h, render, store } = DO;
  const A = DO.alibi;
  const svg = (...a) => DO.svg(...a);
  const sfx = n => { if (DO.sfx) DO.sfx(n); };

  const TOKEN = ['#b8402f', '#3b6ea5', '#3f7d4e', '#7d5aa0', '#c98a1b', '#2b8a8a'];
  const CIRC = ['①', '②', '③', '④', '⑤', '⑥'];
  const BASE_HINT_COST = 15, WRONG_COST = 30, BASE_CHANCES = 2, STEP_MS = 1200;
  const stars = score => (score >= 85 ? 3 : score >= 55 ? 2 : 1);

  DO.registerMode({
    id: 'alibi',
    name: '알리바이 깨기',
    desc: '시간대별 진술표에서 단 한 명의 거짓말을 논리로 찾아낸다. CCTV·문 센서·증언을 엮는 본격 추리. 1~4명.',
    ready: true,
    start(root, ctx) {
      const C = ctx.case;
      const TOP = A.LEVELS.length - 1;
      // 모험 모드(career.js)에서 부를 때: { level, variant, hintCost, chances, freeHints, onDone({ win, score, stars }) }
      // 소개 화면을 건너뛰고 바로 수사를 시작하며, 결과 화면에서는 onDone 으로 돌아간다. 이 모드의 최고 기록·판 번호는 건드리지 않는다.
      const P = ctx.preset || null;
      const HINT_COST = P && P.hintCost != null ? P.hintCost : BASE_HINT_COST;
      const CHANCES = P && P.chances ? P.chances : BASE_CHANCES;
      let level = P ? Math.max(0, Math.min(TOP, P.level | 0)) : Math.max(0, Math.min(TOP, store.get('alibi:level', 0) | 0));
      let variant = P ? P.variant | 0 : store.get('alibi:v:' + C.id, 0) | 0;
      let p = null;
      // hinted: 받은 힌트 목록({type:'time',t} | {type:'who',i}), wrong: 잘못 지목한 사람, wrongTimes: 사람은 맞혔지만 틀린 시각(전설),
      // outTimes: 범행 시각이 아니라고 밝혀진 칸(전설)
      let score, hinted, wrong, wrongTimes, outTimes, locked, marks, focus, mapTime, timer = null;
      const misses = () => wrong.length + wrongTimes.length;
      // 범행 시각을 아직 모르는가 (전설에서 후보가 둘 이상 남았을 때)
      const timeOpen = () => p.hidden && p.window.filter(t => !outTimes.has(t)).length > 1;
      const windowText = () => `${p.times[p.window[0]]}~${p.times[p.window[p.window.length - 1]]}`;

      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      const name = i => p.suspects[i].name;
      const face = (i, size) => DO.portrait(C.id + ':' + p.suspects[i].id, name(i), size);
      const num = i => h('span', { class: 'num', style: `background:${TOKEN[i]}` }, String(i + 1));
      const short = pl => (pl.scene ? '현장' : pl.name.slice(0, 3));
      const placeLabel = j => `${p.places[j].emoji} ${p.places[j].name}`;
      const who = list => list.map(i => `${CIRC[i]} ${name(i)}`).join(', ');

      // ---------- 1. 소개 ----------
      function intro() {
        stop();
        const best0 = store.get(`alibi:best:${C.id}:${level}`, -1);
        const best = best0 >= 0 && best0 <= 100 ? Math.round(best0) : null;
        render(root,
          h('h2', {}, C.title),
          h('div', { class: 'card' }, h('p', {}, C.intro)),
          h('div', { class: 'lineup' }, C.suspects.map(s => h('div', { class: 'lineup-item' },
            DO.portrait(C.id + ':' + s.id, s.name, 56), h('span', {}, s.name)))),
          h('div', { class: 'card' },
            h('h3', {}, '수사 규칙'),
            h('p', { class: 'muted' }, '· 용의자마다 "몇 시에 어디 있었다"는 진술이 표로 주어집니다.'),
            h('p', { class: 'muted' }, '· ', h('b', {}, '딱 한 명만 거짓말'), '을 합니다. 범행 시각에 현장에 있었던 걸 숨긴 사람입니다.'),
            h('p', { class: 'muted' }, '· CCTV · 문 센서 · 출입 기록은 ', h('b', {}, '항상 사실'), '입니다. 목격 증언은 말한 사람이 범인이면 거짓일 수 있습니다.'),
            h('p', { class: 'muted' }, '· 한 시간 칸에 제자리에 있거나, 지도에서 이어진 곳으로 한 칸만 갈 수 있습니다.'),
            level === TOP ? h('p', {}, '· ', h('b', {}, '전설: 범행 시각이 숨겨져 있습니다.'), ' 연속한 세 시각 중 하나라는 것만 압니다. 범행 시각의 현장에는 범인 혼자였습니다. 누가, 언제를 함께 지목하세요.') : null,
            h('p', { class: 'muted' }, `· 100점에서 시작. 힌트 -${HINT_COST}, 오판 -${WRONG_COST}. 지목 기회는 ${CHANCES}번.`),
          ),
          h('h3', {}, '난이도'),
          A.LEVELS.map(L => h('button', { class: 'mode' + (L.id === level ? ' primary' : ''), onClick: () => { level = L.id; store.set('alibi:level', level); intro(); } },
            h('b', {}, L.label), h('div', { class: L.id === level ? '' : 'muted' }, L.desc))),
          best != null ? h('p', { class: 'muted small-text' }, `이 사건 ${A.LEVELS[level].label} 최고 기록: ${'⭐'.repeat(stars(best))} ${best}점`) : null,
          h('p', { class: 'muted small-text' }, `이 모드는 사건의 용의자와 현장만 빌려와 새 타임라인을 만듭니다. (판 #${variant + 1})`),
          h('button', { class: 'primary', onClick: begin }, '🔎 수사 시작'),
        );
      }

      function begin() {
        p = A.generate(C, level, variant);
        if (!p) return render(root, h('p', {}, '이 사건으로는 타임라인을 만들지 못했습니다.'), h('button', { onClick: () => (P ? P.onDone({ win: false, score: 0, stars: 0 }) : DO.goHome()) }, P ? '돌아가기' : '처음으로'));
        score = 100; hinted = []; wrong = []; wrongTimes = []; outTimes = new Set(); locked = new Set(); marks = p.suspects.map(() => 0);
        // 모험 모드의 '직감' 능력: 결백한 사람 몇 명을 점수 깎임 없이 미리 밝혀 둔다
        if (P && P.freeHints) {
          p.cores.slice().sort((a, b) => a.core.length - b.core.length).slice(0, Math.min(P.freeHints, p.suspects.length - 2))
            .forEach(c => { hinted.push({ type: 'who', i: c.i, free: true }); locked.add(c.i); marks[c.i] = 1; });
        }
        focus = null; mapTime = p.hidden ? p.window[1] : p.tStar;
        sfx('paper');
        board();
      }

      // ---------- 지도 (보드와 재연이 같이 쓴다) ----------
      function buildMap(ring) {
        const el = svg('svg', { viewBox: '-6 -2 112 106', class: 'amap', role: 'img' });
        for (const [a, b] of p.edges) {
          el.append(svg('line', { x1: p.places[a].pos[0], y1: p.places[a].pos[1], x2: p.places[b].pos[0], y2: p.places[b].pos[1], class: 'amap-edge' }));
        }
        const rooms = p.places.map(pl => {
          const [x, y] = pl.pos;
          const g = svg('g', { class: 'amap-room' + (pl.scene ? ' scene' : '') },
            svg('rect', { x: x - 15, y: y - 8.5, width: 30, height: 17, rx: 3, fill: pl.color }),
            svg('text', { x, y: y - 0.3, class: 'amap-emoji' }, pl.emoji),
            svg('text', { x, y: y + 6.2, class: 'amap-name' }, pl.scene ? '현장' : pl.name.slice(0, 5)));
          el.append(g);
          return g;
        });
        const tokens = p.suspects.map((s, i) => {
          const g = svg('g', { class: 'amap-token' },
            ring === i ? svg('circle', { r: 5.2, class: 'amap-ring' }) : null,
            svg('circle', { r: 3.5, fill: TOKEN[i], class: 'amap-dot' }),
            svg('text', { y: 1.55 }, String(i + 1)));
          el.append(g);
          return g;
        });
        function setTime(paths, t, flash) {
          const groups = {};
          paths.forEach((w, i) => { (groups[w[t]] = groups[w[t]] || []).push(i); });
          for (const j of Object.keys(groups)) {
            const [x, y] = p.places[j].pos, list = groups[j];
            list.forEach((i, k) => {
              const row = Math.floor(k / 4), col = k % 4, inRow = Math.min(4, list.length - row * 4);
              tokens[i].style.transform = `translate(${x + (col - (inRow - 1) / 2) * 7.6}px, ${y + 12.6 + row * 7.6}px)`;
            });
          }
          rooms[0].classList.toggle('flash', !!flash);
        }
        return { el, setTime };
      }

      // ---------- 대조: 카드가 진술표와 맞는지 세어 준다 (누가 거짓인지는 알려 주지 않는다) ----------
      function tally(c) {
        const at = (i, t) => p.claims[i][t];
        const all = p.suspects.map((_, i) => i);
        if (c.k === 'count') {
          const list = all.filter(i => at(i, c.t) === c.L);
          const ok = list.length === c.n;
          return { ok, text: `진술표로 세면 ${p.times[c.t]} ${p.places[c.L].name}에 ${list.length}명${list.length ? ' (' + who(list) + ')' : ''}. ${ok ? '숫자가 맞는다.' : `CCTV는 ${c.n}명. 숫자가 다르다 → 누군가의 진술이 거짓.`}` };
        }
        if (c.k === 'flow') {
          const list = all.filter(i => at(i, c.t) === c.a && at(i, c.t + 1) === c.b);
          const ok = list.length === c.n;
          return { ok, text: `진술표에서 그렇게 움직였다는 사람은 ${list.length}명${list.length ? ' (' + who(list) + ')' : ''}. ${ok ? '숫자가 맞는다.' : `센서는 ${c.n}명. 숫자가 다르다 → 누군가의 진술이 거짓.`}` };
        }
        if (c.k === 'at') {
          const ok = at(c.who, c.t) === c.L;
          return { ok, text: ok ? `${name(c.who)}의 진술과 같다. 이 칸은 확실한 사실.` : `${name(c.who)}의 진술(${p.places[at(c.who, c.t)].name})과 다르다.` };
        }
        if (c.k === 'saw') {
          const ok = at(c.who, c.t) === c.L;
          return { ok, text: ok ? `${name(c.who)}의 진술도 같은 곳이다. (말한 사람이 믿을 만하다면 이 칸은 사실)` : `${DO.alibi.josa(name(c.who), '은', '는')} 그 시각 ${p.places[at(c.who, c.t)].name}에 있었다고 진술했다 → 둘 중 한 명은 거짓말.` };
        }
        if (c.k === 'notsaw') {
          const clash = at(c.who, c.t) === c.L;
          return { ok: !clash, text: clash ? `그런데 ${DO.alibi.josa(name(c.who), '은', '는')} 그 시각 ${p.places[c.L].name}에 있었다고 진술했다 → 둘 중 한 명은 거짓말.` : `${name(c.who)}도 거기 있었다고 하지는 않았다.` };
        }
        if (c.k === 'alone') {
          const list = all.filter(i => i !== c.by && at(i, c.t) === c.L);
          return { ok: !list.length, text: list.length ? `그런데 ${who(list)}도 그 시각 거기 있었다고 진술했다 → 누군가 거짓말.` : '그 시각 거기 있었다고 한 사람은 더 없다.' };
        }
        return { ok: true, text: '' };
      }

      // ---------- 2. 수사 보드 ----------
      function board() {
        stop();
        const K = p.suspects.length;
        const cards = [...p.testimonies, ...p.evidence];
        const scoreEl = h('span', { class: 'battery' });

        const markEls = p.suspects.map(() => h('span', { class: 'tl-mark' }));
        const headEls = p.suspects.map((s, i) => h('button', { class: 'tl-who', 'data-quiet': '1', title: '눌러서 결백/의심 표시', onClick: () => {
          if (locked.has(i)) return;
          marks[i] = (marks[i] + 1) % 3; sfx('scribble'); update();
        } }, h('span', { class: 'tl-face' }, face(i, 30), num(i), markEls[i]), h('span', { class: 'tl-name' }, s.name)));
        // 시간 머리: 보통은 범행 칸 하나에 "범행", 전설은 후보 세 칸에 "후보"(아니라고 밝혀지면 줄을 긋는다)
        const timeEls = p.times.map((tm, t) => (p.hidden
          ? h('th', { class: 'tl-time' + (p.window.includes(t) ? ' cand' : '') }, p.window.includes(t) ? h('span', { class: 'crime-tag' }, '후보') : null, tm)
          : h('th', { class: 'tl-time' + (t === p.tStar ? ' crime' : '') }, t === p.tStar ? h('span', { class: 'crime-tag' }, '범행') : null, tm)));
        const cellEls = p.suspects.map((s, i) => p.claims[i].map((L, t) => h('button', {
          class: 'tlc', style: `background:${p.places[L].color}`, title: `${s.name} · ${p.times[t]} · ${p.places[L].name}`, 'data-quiet': '1',
          onClick: () => {
            focus = (focus && focus.type === 'cell' && focus.i === i && focus.t === t) ? null : { type: 'cell', i, t };
            mapTime = t; sfx('tick'); update();
          },
        }, h('span', { class: 'e' }, p.places[L].emoji), h('span', { class: 'n' }, short(p.places[L])))));
        const rowEls = p.suspects.map((s, i) => h('tr', {}, h('th', { class: 'tl-head' }, headEls[i]), cellEls[i].map(c => h('td', {}, c))));
        const grid = h('table', { class: 'tl' },
          h('thead', {}, h('tr', {}, h('th', { class: 'tl-corner' }, '진술표'), timeEls)),
          h('tbody', {}, rowEls));

        const legendEls = p.places.map((pl, j) => h('button', { class: 'lg', style: `background:${pl.color}`, 'data-quiet': '1', onClick: () => {
          focus = (focus && focus.type === 'place' && focus.j === j) ? null : { type: 'place', j }; sfx('tick'); update();
        } }, `${pl.emoji} ${pl.name}${pl.scene ? ' · 현장' : ''}`));

        const focusEl = h('div', { class: 'card focus-box' });

        const cardEls = cards.map((c, n) => {
          const d = A.describe(p, c);
          return h('button', { class: 'ecard' + (c.by != null ? ' testi' : ''), 'data-quiet': '1', onClick: () => {
            focus = (focus && focus.type === 'card' && focus.n === n) ? null : { type: 'card', n };
            if (focus) mapTime = A.cells(c).times[0];
            // 카드를 펼치면 대조 결과가 소리로도: 맞으면 맑은 두 음, 어긋나면 불협화음 + 쿵
            sfx(focus ? (tally(c).ok ? 'match' : 'clash') : 'paper'); update();
          } },
            h('span', { class: 'ecard-head' }, h('span', {}, `${d.icon} ${d.title}`), h('span', { class: 'muted' }, `${n + 1}/${cards.length}`)),
            c.by != null ? h('span', { class: 'speaker' }, num(c.by), name(c.by)) : null,
            h('span', { class: 'ecard-text' }, c.by != null ? `“${d.text}”` : d.text),
            c.by != null ? h('span', { class: 'ecard-foot' }, '말한 사람이 범인이면 거짓일 수 있음') : h('span', { class: 'ecard-foot' }, '기계 기록 · 항상 사실'),
          );
        });

        const map = buildMap(null);
        const chipEls = p.times.map((tm, t) => h('button', { class: 'chip', 'data-quiet': '1', onClick: () => { mapTime = t; sfx('tick'); update(); } },
          (p.hidden ? (p.window.includes(t) ? '❔ ' : '') : (t === p.tStar ? '🚨 ' : '')) + tm));
        const mapTitle = h('h3', {});
        const headline = h('b', {});

        const hintBox = h('div');
        const hintBtn = h('button', { class: 'grow', 'data-quiet': '1', onClick: giveHint });
        const cardLine = c => { const d = A.describe(p, c); return h('p', { class: 'muted' }, `${d.icon} ${c.by != null ? name(c.by) + '의 증언: ' : d.title + ': '}${d.text}`); };
        // 남은 힌트: 전설에서는 "이 시각은 아니다"가 먼저, 그다음 "이 사람은 결백"
        function pendingHints() {
          const times = p.timeCores.filter(tc => !outTimes.has(tc.t)).map(tc => ({ type: 'time', t: tc.t }));
          const people = p.cores.filter(c => !locked.has(c.i)).sort((a, b) => a.core.length - b.core.length).map(c => ({ type: 'who', i: c.i }));
          return [...times, ...people];
        }
        function hintCard(item) {
          if (item.type === 'time') {
            const tc = p.timeCores.find(x => x.t === item.t);
            return h('div', { class: 'card good' },
              h('p', {}, '💡 ', h('b', {}, `범행 시각은 ${p.times[tc.t]}이 아니다.`), ' 그 시각이라면 누가 범인이어도 아래와 동시에 성립할 수 없다.'),
              tc.witnesses.length ? h('p', { class: 'muted' }, `🚨 ${p.times[tc.t]}에 현장에 있었다고 진술한 사람: ${who(tc.witnesses)}. 범행 시각의 현장에는 범인 혼자여야 한다.`) : null,
              tc.core.map(cardLine),
            );
          }
          const core = p.cores.find(c => c.i === item.i).core;
          return h('div', { class: 'card good' },
            h('p', {}, item.free ? '🔮 직감: ' : '💡 ', h('b', {}, `${CIRC[item.i]} ${name(item.i)}`), ` — 결백. 이 사람이 거짓말쟁이라면 ${p.times[p.tStar]}에 현장에 있었어야 하는데, 그러면 아래와 동시에 성립할 수 없다.`),
            core.map(cardLine),
          );
        }
        function giveHint() {
          const item = pendingHints()[0];
          if (!item) return;
          hinted.push(item);
          if (item.type === 'time') outTimes.add(item.t);
          else { locked.add(item.i); marks[item.i] = 1; }
          score = Math.max(0, score - HINT_COST);
          sfx('hint');
          hintBox.append(hintCard(item));
          update();
        }
        hinted.forEach(item => hintBox.append(hintCard(item)));

        function focusContent() {
          if (!focus) return [h('p', { class: 'muted small-text' }, '표의 칸, 장소, 아래 카드를 누르면 여기서 진술표와 대조해 봅니다. 왼쪽 얼굴을 누르면 ✅ 결백 / ❓ 의심 표시.')];
          if (focus.type === 'cell') {
            const { i, t } = focus, L = p.claims[i][t];
            const same = p.suspects.map((_, x) => x).filter(x => x !== i && p.claims[x][t] === L);
            return [
              h('p', {}, h('b', {}, `${CIRC[i]} ${name(i)}`), ` · ${p.times[t]}에 ${placeLabel(L)}에 있었다고 진술.`),
              h('p', { class: 'muted small-text' }, same.length ? `같은 시각 같은 곳이라고 한 사람: ${who(same)}` : '같은 시각 같은 곳이라고 한 사람은 없다.'),
            ];
          }
          if (focus.type === 'place') {
            const pl = p.places[focus.j];
            const near = p.places.map((_, x) => x).filter(x => x !== focus.j && p.adj[focus.j][x]).map(placeLabel).join(', ');
            return [
              h('p', {}, h('b', {}, `${pl.emoji} ${pl.name}`), !pl.scene ? '' : timeOpen() ? ' · 사건 현장. 범행 시각에 여기 혼자 있던 사람이 범인.' : ` · 사건 현장. ${p.times[p.tStar]}에 여기 있던 한 사람이 범인.`),
              h('p', { class: 'muted small-text' }, `이어진 곳: ${near}`),
            ];
          }
          const c = cards[focus.n], d = A.describe(p, c), tl = tally(c);
          return [
            h('p', {}, h('b', {}, `${d.icon} ${c.by != null ? name(c.by) + '의 증언' : d.title}`), ' · ', d.text),
            h('p', { class: 'tally ' + (tl.ok ? 'ok' : 'warn') }, (tl.ok ? '✅ ' : '⚠️ ') + tl.text),
          ];
        }

        function update() {
          scoreEl.textContent = `⭐ ${score}`;
          // 긴장도: 한 번 틀렸으면 최고, 결백 표시가 거의 다 찼으면(범인에 가까워짐) 한 단계
          if (DO.music) DO.music.intensity(misses() >= 1 ? 2 : marks.filter(m => m === 1).length >= p.suspects.length - 2 ? 1 : 0);
          // 강조할 칸
          // hot = 카드가 직접 가리키는 칸(굵은 테두리), soft = 같이 봐야 할 칸(점선), hotTimes 밖의 열은 흐리게
          const hot = new Set(), soft = new Set(), hotTimes = new Set();
          if (focus && focus.type === 'cell') hot.add(focus.i + ':' + focus.t);
          if (focus && focus.type === 'place') p.claims.forEach((w, i) => w.forEach((L, t) => { if (L === focus.j) hot.add(i + ':' + t); }));
          if (focus && focus.type === 'card') {
            const c = cards[focus.n], z = A.cells(c);
            z.times.forEach(t => hotTimes.add(t));
            if (c.k === 'flow') {
              p.claims.forEach((w, i) => {
                if (w[c.t] === c.a && w[c.t + 1] === c.b) { hot.add(i + ':' + c.t); hot.add(i + ':' + (c.t + 1)); }
                if (w[c.t] === c.a) soft.add(i + ':' + c.t);
                if (w[c.t + 1] === c.b) soft.add(i + ':' + (c.t + 1));
              });
            } else {
              if (z.who) z.who.forEach(i => hot.add(i + ':' + c.t));
              p.claims.forEach((w, i) => { if (w[c.t] === c.L) (z.who ? soft : hot).add(i + ':' + c.t); });
            }
          }
          cellEls.forEach((row, i) => row.forEach((el, t) => {
            const key = i + ':' + t;
            el.classList.toggle('hl', hot.has(key));
            el.classList.toggle('hl2', soft.has(key) && !hot.has(key));
            el.classList.toggle('col', hotTimes.size > 0 && !hotTimes.has(t));
          }));
          timeEls.forEach((el, t) => { el.classList.toggle('on', hotTimes.has(t) || t === mapTime); el.classList.toggle('out', outTimes.has(t)); });
          headline.textContent = !p.hidden ? `🕰 범행 ${p.times[p.tStar]}`
            : timeOpen() ? `🕰 범행 ❔ ${windowText()}` : `🕰 범행 ${p.times[p.tStar]} ✔`;
          rowEls.forEach((el, i) => el.classList.toggle('cleared', marks[i] === 1));
          markEls.forEach((el, i) => { el.textContent = marks[i] === 1 ? '✅' : marks[i] === 2 ? '❓' : ''; });
          legendEls.forEach((el, j) => el.classList.toggle('active', !!focus && focus.type === 'place' && focus.j === j));
          cardEls.forEach((el, n) => el.classList.toggle('active', !!focus && focus.type === 'card' && focus.n === n));
          render(focusEl, focusContent());
          // 지도
          mapTitle.textContent = `🗺 ${p.times[mapTime]} — 진술대로라면`;
          chipEls.forEach((el, t) => el.classList.toggle('active', t === mapTime));
          map.setTime(p.claims, mapTime, false);
          // 버튼
          const left = pendingHints().length;
          hintBtn.textContent = left ? `💡 힌트 (-${HINT_COST})` : '💡 남은 한 명이 범인';
          hintBtn.disabled = !left;
        }

        render(root,
          h('div', { class: 'row' },
            h('div', { class: 'grow' },
              headline, h('span', { class: 'muted' }, ` · 현장 ${p.places[0].name}`)),
            scoreEl),
          h('p', { class: 'muted small-text' }, `${A.LEVELS[level].label} · 한 명만 거짓말 · 기록은 항상 사실 · 이동은 이어진 곳으로 한 칸${p.hidden ? ' · 범행 시각의 현장에는 범인 혼자' : ''}`),
          grid,
          h('div', { class: 'legend' }, legendEls),
          focusEl,
          h('h3', {}, `🗂 증언 ${p.testimonies.length} · 증거 ${p.evidence.length}`),
          h('div', { class: 'cards' }, cardEls),
          mapTitle,
          h('div', { class: 'chips' }, chipEls),
          h('div', { class: 'amap-wrap' }, map.el),
          hintBox,
          h('div', { class: 'row' }, hintBtn, h('button', { class: 'grow danger', onClick: accuse }, '🎯 범인 지목')),
        );
        update();
      }

      // ---------- 3. 지목 ----------
      // 전설에서는 사람과 함께 범행 시각도 골라야 한다 (이미 아니라고 밝혀진 시각은 고를 수 없다)
      function accuse(picked, pickedT) {
        stop();
        const pick = typeof picked === 'number' ? picked : null;
        const open = p.hidden ? p.window.filter(t => !outTimes.has(t)) : [p.tStar];
        const pickT = open.length === 1 ? open[0] : (typeof pickedT === 'number' ? pickedT : null);
        const ready = pick != null && pickT != null;
        render(root,
          h('h2', {}, '🎯 거짓말쟁이는…'),
          h('p', { class: 'muted' }, `틀리면 -${WRONG_COST}점. 기회는 ${CHANCES - misses()}번 남았습니다.`),
          h('div', { class: 'suspect-grid' }, p.suspects.map((s, i) => h('button', {
            class: 'suspect-pick' + (pick === i ? ' active' : ''), disabled: wrong.includes(i), onClick: () => accuse(i, pickT),
          }, face(i, 64), h('b', {}, `${CIRC[i]} ${s.name}`),
            h('span', { class: 'muted small-text' }, wrong.includes(i) ? '오판 — 결백' : marks[i] === 1 ? '✅ 결백 표시' : marks[i] === 2 ? '❓ 의심 표시' : ' ')))),
          p.hidden ? [
            h('h3', {}, '⏱ 범행 시각은…'),
            h('div', { class: 'chips' }, p.window.map(t => h('button', {
              class: 'chip' + (pickT === t ? ' active' : ''), disabled: outTimes.has(t), onClick: () => accuse(pick, t),
            }, p.times[t]))),
          ] : null,
          ready ? h('button', { class: 'danger', 'data-quiet': '1', onClick: () => verdict(pick, pickT) },
            p.hidden ? `${name(pick)} · ${p.times[pickT]} 지목 확정` : `${name(pick)} 지목 확정`) : null,
          h('button', { onClick: board }, '돌아가서 더 살펴보기'),
        );
        DO.music && DO.music.hold('suspense');
      }

      function verdict(i, t) {
        const ci = p.culpritIdx;
        if (i === ci && t === p.tStar) return finish(true);
        score = Math.max(0, score - WRONG_COST);
        const rightPerson = i === ci; // 전설에서만 가능: 사람은 맞고 시각이 틀림
        if (rightPerson) { wrongTimes.push(t); outTimes.add(t); } else { wrong.push(i); locked.add(i); marks[i] = 1; }
        if (misses() >= CHANCES) return finish(false);
        render(root,
          h('h2', {}, '❌ 오판'),
          h('div', { class: 'card alert center' },
            face(i, 76),
            rightPerson
              ? h('p', {}, '사람은 맞았습니다. 하지만 범행 시각은 ', h('b', {}, p.times[t]), '이 아닙니다.')
              : h('p', {}, h('b', {}, name(i)), '의 진술은 전부 사실이었습니다.'),
            h('p', { class: 'muted' }, `-${WRONG_COST}점 · 기회 ${CHANCES - misses()}번 남음`)),
          h('button', { class: 'primary', onClick: board }, '수사 계속'),
        );
        if (DO.fx) DO.fx.fail(); else sfx('bad');
      }

      // ---------- 4. 결과: 도장 + 재연 + 해설 ----------
      function finish(win) {
        stop();
        const ci = p.culpritIdx;
        const final = win ? score : 0;
        if (win && !P) {
          const key = `alibi:best:${C.id}:${level}`;
          if (final > (store.get(key, -1))) store.set(key, final);
        }
        sfx('stamp');
        // 도장이 찍히고 나서 점수를 센다 (팡파르·꽃가루는 아래 render 뒤의 ending 에서)
        if (win && DO.fx) setTimeout(() => DO.fx.count(root.querySelector('.score-num'), final), 380);

        const map = buildMap(ci);
        const caption = h('p', { class: 'replay-caption' });
        const chipEls = p.times.map((tm, t) => h('button', { class: 'chip', 'data-quiet': '1', onClick: () => { stop(); show(t, true); } }, (t === p.tStar ? '🚨 ' : '') + tm));
        function show(t, sound) {
          map.setTime(p.truth, t, t === p.tStar);
          chipEls.forEach((el, x) => el.classList.toggle('active', x === t));
          const here = p.places[p.truth[ci][t]], said = p.places[p.claims[ci][t]];
          caption.textContent = t === p.tStar
            ? `${p.times[t]} — ${A.josa(name(ci), '이', '가')} ${here.name}에 혼자 들어간다. 사건 발생. (진술은 "${said.name}")`
            : here !== said ? `${p.times[t]} — 범인은 사실 ${here.name}에 있다. (진술은 "${said.name}")`
            : `${p.times[t]} — 범인은 ${here.name}. ${t < p.tStar ? '아직은' : '다시'} 진술과 같은 곳.`;
          if (sound) sfx(t === p.tStar ? 'stamp' : 'tick');
        }
        function play() {
          stop();
          let t = 0; show(0, true);
          timer = setInterval(() => {
            if (!map.el.isConnected) return stop();
            t++;
            if (t >= p.T) return stop();
            show(t, true);
          }, STEP_MS);
        }

        render(root,
          h('div', { class: 'verdict' },
            h('div', { class: 'stamp ' + (win ? 'win' : 'lose') }, win ? '검거' : '미제'),
            face(ci, 96),
            h('h2', {}, win ? '알리바이가 무너졌다' : '수사 실패'),
            h('p', {}, h('b', {}, `${CIRC[ci]} ${name(ci)}`), '의 진술이 거짓이었습니다.', p.hidden ? ` 범행 시각은 ${p.times[p.tStar]}.` : ''),
            p.lieSlots.map(t => h('p', { class: 'muted' }, `${p.times[t]}: "${p.places[p.claims[ci][t]].name}"에 있었다고 했지만 사실은 ${p.places[p.truth[ci][t]].name}${p.truth[ci][t] === 0 ? '(현장)' : ''}.`)),
            h('p', {}, win ? [`${'⭐'.repeat(stars(final))} `, h('span', { class: 'score-num' }, DO.fx ? '0' : String(final)), '점'] : '0점', h('span', { class: 'muted' }, ` · ${A.LEVELS[level].label} · 힌트 ${hinted.filter(x => !x.free).length} · 오판 ${misses()}`)),
          ),
          h('h3', {}, '🎞 재연 — 그날 실제로 있었던 일'),
          h('div', { class: 'chips' }, h('button', { class: 'chip', 'data-quiet': '1', onClick: play }, '▶ 재생'), chipEls),
          h('div', { class: 'amap-wrap' }, map.el),
          caption,
          p.hidden ? [
            h('h3', {}, `⏱ 해설 — 왜 ${p.times[p.tStar]}인가`),
            p.timeCores.map(tc => h('div', { class: 'card explain' },
              h('div', { class: 'grow' },
                h('p', {}, h('b', {}, `${p.times[tc.t]}은 아니다`), ' — 그 시각이 범행 시각이라면 누가 범인이어도 아래와 함께 성립할 수 없다.'),
                tc.witnesses.length ? h('p', { class: 'muted small-text' }, `🚨 ${p.times[tc.t]}에 현장에 있었다고 진술한 사람: ${who(tc.witnesses)}. 범행 시각의 현장에는 범인 혼자여야 한다.`) : null,
                tc.core.map(c => { const d = A.describe(p, c); return h('p', { class: 'muted small-text' }, `${d.icon} ${c.by != null ? name(c.by) + '의 증언: ' : d.title + ': '}${d.text}`); })))),
          ] : null,
          h('h3', {}, '🧠 해설 — 나머지는 왜 결백한가'),
          p.cores.map(co => h('div', { class: 'card explain' },
            face(co.i, 40),
            h('div', { class: 'grow' },
              h('p', {}, h('b', {}, `${CIRC[co.i]} ${name(co.i)}`), ` — 거짓말쟁이라면 ${p.times[p.tStar]}에 현장에 있었어야 한다. 그러면 아래${co.core.length > 1 ? ' 둘 이상' : ''}과 함께 성립할 수 없다.`),
              co.core.map(c => { const d = A.describe(p, c); return h('p', { class: 'muted small-text' }, `${d.icon} ${c.by != null ? name(c.by) + '의 증언: ' : d.title + ': '}${d.text}`); })))),
          P ? h('button', { class: 'primary', onClick: () => P.onDone({ win, score: final, stars: win ? stars(final) : 0 }) }, '📒 수첩으로 돌아가기') : [
            h('button', { class: 'primary', onClick: () => { variant++; store.set('alibi:v:' + C.id, variant); begin(); } }, '🔁 같은 사건, 새 타임라인'),
            level < TOP ? h('button', { onClick: () => { level++; store.set('alibi:level', level); begin(); } }, `⬆ 난이도 올리기 (${A.LEVELS[level + 1].label})`) : null,
            h('button', { onClick: () => DO.goHome() }, '처음으로'),
          ],
        );
        if (DO.fx) DO.fx.ending(win, { delay: 380 }); else setTimeout(() => sfx(win ? 'good' : 'bad'), 380);
        setTimeout(() => { if (map.el.isConnected) play(); }, 900);
      }

      if (P) begin(); else intro();
    },
  });
})();
