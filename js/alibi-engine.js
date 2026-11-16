// 알리바이 깨기 엔진: 타임라인 추리 퍼즐 생성기 + 검증기.
// DOM 을 쓰지 않는다 (node 에서 tools/check-alibi.js 로 대량 검증).
//
// 세계 모델
//  - 장소 5곳(0번이 사건 현장)이 지도(그래프)로 연결되어 있다. 한 시간 칸에 "제자리" 또는 "이어진 곳 한 칸"만 이동.
//  - 시간 칸 T=5. tStar 가 범행 시각. 그 시각 현장에는 범인 한 명뿐이다.
//  - 용의자마다 진술(claims) = 시간 칸별 위치. 범인만 거짓이 섞여 있고(현장에 있던 시각을 숨김) 나머지는 전부 사실.
//  - 제약(constraint) 두 종류
//      증언(by 있음): saw / notsaw / alone — 말한 사람이 거짓말쟁이면 믿을 수 없다
//      증거(by 없음): count(CCTV 인원) / at(출입 기록) / flow(문 센서) — 항상 사실
//
// 검증기: "i 가 거짓말쟁이"라고 가정 → i 의 경로만 자유(범행 시각엔 현장), 나머지는 진술 그대로.
//         모든 제약을 만족하는 경로가 하나라도 있으면 i 는 후보. 후보가 범인 한 명뿐이어야 퍼즐로 채택.

(() => {
  const { rng, hashString, shuffle } = DO;

  const T = 5;
  const P = 5;
  const LEVELS = [
    { id: 0, label: '입문', suspects: 4, desc: '용의자 4명. 증거 하나만 제대로 읽어도 한 사람씩 지울 수 있다.' },
    { id: 1, label: '보통', suspects: 5, desc: '용의자 5명. 증거 두 개를 엮어야 지워지는 사람이 있다.' },
    { id: 2, label: '어려움', suspects: 6, desc: '용의자 6명. 대놓고 틀린 증거는 없다. 여러 장을 조합해야 한다.' },
  ];

  const POOLS = {
    '학교·학원': [['🏫', '교실'], ['📚', '도서관'], ['🍜', '매점'], ['⚽', '운동장'], ['🚻', '화장실'], ['📝', '교무실'], ['🎨', '미술실'], ['🧪', '과학실']],
    '가족·동네': [['🛋️', '거실'], ['🍳', '부엌'], ['🌳', '마당'], ['🚗', '주차장'], ['🛒', '슈퍼'], ['🛝', '놀이터']],
    '모임·행사': [['🍽️', '식당'], ['🎤', '무대'], ['🚪', '로비'], ['🌿', '정원'], ['🚗', '주차장'], ['🚻', '화장실']],
    '가게·시설': [['🚪', '로비'], ['☕', '휴게실'], ['📦', '창고'], ['🚻', '화장실'], ['🚗', '주차장'], ['🧾', '사무실']],
    '여행': [['🛎️', '로비'], ['🍽️', '식당'], ['🛍️', '기념품점'], ['🏊', '수영장'], ['🛗', '엘리베이터'], ['🚻', '화장실']],
    '온라인': [['⚔️', '던전'], ['🏪', '상점가'], ['🏟️', '투기장'], ['🌲', '사냥터'], ['🍺', '주점'], ['🗺️', '광장']],
    '': [['🚪', '로비'], ['☕', '휴게실'], ['📦', '창고'], ['🚻', '화장실'], ['🌳', '마당'], ['🍽️', '식당']],
  };
  // 장소 색 (0번 = 현장은 붉은 계열)
  const PLACE_COLORS = ['#f0b9ad', '#c9dcef', '#d2e6c8', '#f3e2a9', '#decfee'];
  // 지도 좌표(0~100)와 기본 고리. 판마다 지름길(chord)이 하나 붙기도 한다.
  const NODE_POS = [[50, 14], [86, 41], [72, 80], [28, 80], [14, 41]];
  const RING = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]];
  const CHORDS = [[0, 2], [0, 3], [1, 3], [1, 4], [2, 4]];

  // ---------- 작은 도구 ----------
  function pickW(list, weight, rnd) {
    let total = 0;
    const ws = list.map(x => { const w = weight(x); total += w; return w; });
    let r = rnd() * total;
    for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  const stays = w => { let n = 0; for (let t = 1; t < T; t++) if (w[t] === w[t - 1]) n++; return n; };
  const hamming = (a, b) => { let n = 0; for (let t = 0; t < T; t++) if (a[t] !== b[t]) n++; return n; };
  const countAt = (paths, L, t) => { let n = 0; for (const p of paths) if (p[t] === L) n++; return n; };

  // 조사 고르기: 받침 유무로 을/를, 은/는, 이/가, 과/와. 한글이 아니면 "을(를)" 식으로.
  function josa(word, a, b) {
    const m = String(word).match(/[가-힣](?=[^가-힣]*$)/);
    if (!m) return `${word}${a}(${b})`;
    return word + ((m[0].charCodeAt(0) - 0xAC00) % 28 ? a : b);
  }
  // (으)로: 받침 없거나 ㄹ 받침이면 "로"
  function ro(word) {
    const m = String(word).match(/[가-힣](?=[^가-힣]*$)/);
    if (!m) return word + '(으)로';
    const j = (m[0].charCodeAt(0) - 0xAC00) % 28;
    return word + (j === 0 || j === 8 ? '로' : '으로');
  }

  function fmtTime(min) {
    let hh = Math.floor(min / 60) % 24; const mm = ((min % 60) + 60) % 60;
    hh = ((hh + 11) % 12) + 1;
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }
  // 사건 소개 글의 "N시 (M분)"을 범행 시각으로 쓴다. 없으면 3:00.
  function baseMinutes(C) {
    const m = String(C.intro || '').match(/(\d{1,2})시(?:\s*(\d{1,2})분)?/);
    return m ? (+m[1]) * 60 + (m[2] ? +m[2] : 0) : 180;
  }

  // ---------- 제약 판정 ----------
  function holds(c, paths) {
    switch (c.k) {
      case 'saw': return paths[c.who][c.t] === c.L;
      case 'notsaw': return paths[c.who][c.t] !== c.L;
      case 'alone': return countAt(paths, c.L, c.t) === 1;
      case 'count': return countAt(paths, c.L, c.t) === c.n;
      case 'at': return paths[c.who][c.t] === c.L;
      case 'flow': { let n = 0; for (const p of paths) if (p[c.t] === c.a && p[c.t + 1] === c.b) n++; return n === c.n; }
    }
    return true;
  }

  // i 가 거짓말쟁이일 수 있는가. 가능하면 그때의 i 경로를, 아니면 null.
  function feasible(p, i, cons) {
    const paths = p.claims.slice();
    const active = cons.filter(c => c.by !== i);
    // i 를 뺀 나머지 진술만으로 이미 깨지는 제약이 있으면 빨리 끝낸다 (i 와 무관한 제약)
    for (const w of p.sceneWalks) {
      paths[i] = w;
      let ok = true;
      for (const c of active) if (!holds(c, paths)) { ok = false; break; }
      if (ok) return w;
    }
    return null;
  }

  function solve(p, cons) {
    const all = cons || [...p.testimonies, ...p.evidence];
    const out = [];
    for (let i = 0; i < p.suspects.length; i++) if (feasible(p, i, all)) out.push(i);
    return out;
  }

  // i 를 지우는 데 필요한 가장 작은 제약 묶음 (1~3장은 전수, 그 이상은 하나씩 빼 보기)
  function minCore(p, i, all) {
    const n = all.length;
    for (let a = 0; a < n; a++) if (!feasible(p, i, [all[a]])) return [all[a]];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (!feasible(p, i, [all[a], all[b]])) return [all[a], all[b]];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
      if (!feasible(p, i, [all[a], all[b], all[c]])) return [all[a], all[b], all[c]];
    }
    let core = all.slice();
    for (const c of all) { const rest = core.filter(x => x !== c); if (!feasible(p, i, rest)) core = rest; }
    return core;
  }

  // ---------- 문장 ----------
  function describe(p, c) {
    const pl = i => p.places[i].name, nm = i => p.suspects[i].name, tm = t => p.times[t];
    switch (c.k) {
      case 'saw': return { icon: '👀', title: '목격 증언', by: c.by, text: `${tm(c.t)}에 ${pl(c.L)}에서 ${josa(nm(c.who), '을', '를')} 봤다.` };
      case 'notsaw': return { icon: '🙅', title: '목격 증언', by: c.by, text: `${tm(c.t)}에 ${pl(c.L)}에 있었는데, ${josa(nm(c.who), '은', '는')} 거기 없었다.` };
      case 'alone': return { icon: '🧍', title: '목격 증언', by: c.by, text: `${tm(c.t)}에 ${pl(c.L)}에는 나 혼자였다.` };
      case 'count': return { icon: '📷', title: 'CCTV', text: `${tm(c.t)} · ${pl(c.L)}: ${c.n === 0 ? '아무도 찍히지 않았다' : c.n + '명이 찍혔다'}.` };
      case 'at': return { icon: '💳', title: '출입 기록', text: `${nm(c.who)}: ${tm(c.t)}에 ${pl(c.L)}에 있었던 것이 기록으로 확인된다.` };
      case 'flow': return { icon: '🚪', title: '문 센서', text: `${tm(c.t)}→${tm(c.t + 1)} 사이, ${pl(c.a)}에서 ${ro(pl(c.b))} 건너간 사람: ${c.n === 0 ? '없음' : c.n + '명'}.` };
    }
    return { icon: '❔', title: '', text: '' };
  }

  // 제약이 가리키는 표의 칸들 (화면에서 강조용). [용의자 번호 또는 null(열 전체), 시간 칸, 장소]
  function cells(c) {
    switch (c.k) {
      case 'saw': case 'notsaw': return { times: [c.t], place: c.L, who: [c.by, c.who] };
      case 'alone': return { times: [c.t], place: c.L, who: [c.by] };
      case 'count': return { times: [c.t], place: c.L, who: null };
      case 'at': return { times: [c.t], place: c.L, who: [c.who] };
      case 'flow': return { times: [c.t, c.t + 1], place: c.a, place2: c.b, who: null };
    }
    return { times: [], who: null };
  }

  // ---------- 생성 한 번 시도 ----------
  function attempt(C, level, rnd) {
    const L = LEVELS[level];
    const all = C.suspects.map((s, idx) => ({ id: s.id, name: s.name, idx }));
    const cul = all.find(s => s.id === C.culprit);
    if (!cul) return null;
    const K = Math.min(all.length, L.suspects);
    const picked = [cul, ...shuffle(all.filter(s => s !== cul), rnd).slice(0, K - 1)].sort((a, b) => a.idx - b.idx);
    const ci = picked.indexOf(cul);
    const suspects = picked.map(s => ({ id: s.id, name: s.name }));

    // 장소: 0 = 현장
    const sceneName = (C.scene && C.scene.name) || '사건 현장';
    const pool = (POOLS[C.category] || POOLS['']).filter(([, n]) => !sceneName.includes(n));
    const extra = shuffle(pool, rnd).slice(0, P - 1);
    const nodeOf = shuffle([0, 1, 2, 3, 4], rnd);
    const places = [['🚨', sceneName], ...extra].map(([emoji, name], i) => ({ emoji, name, scene: i === 0, color: PLACE_COLORS[i], pos: NODE_POS[nodeOf[i]] }));

    // 지도: 고리 + 지름길 0~1개 (노드 기준 → 장소 번호로 옮김)
    const placeAt = []; nodeOf.forEach((node, place) => { placeAt[node] = place; });
    const nodeEdges = RING.slice();
    if (rnd() < 0.6) nodeEdges.push(CHORDS[Math.floor(rnd() * CHORDS.length)]);
    const edges = nodeEdges.map(([a, b]) => [placeAt[a], placeAt[b]]);
    const adj = Array.from({ length: P }, (_, a) => Array.from({ length: P }, (_, b) => a === b));
    for (const [a, b] of edges) { adj[a][b] = true; adj[b][a] = true; }

    // 가능한 모든 동선
    const walks = [];
    (function rec(w) {
      if (w.length === T) { walks.push(w.slice()); return; }
      for (let b = 0; b < P; b++) if (!w.length || adj[w[w.length - 1]][b]) { w.push(b); rec(w); w.pop(); }
    })([]);

    const tStar = [2, 2, 3, 1][Math.floor(rnd() * 4)];
    const sceneWalks = walks.filter(w => w[tStar] === 0);

    // 진짜 동선
    const truth = [];
    const culWalks = sceneWalks.filter(w => w.every((x, t) => t === tStar || x !== 0));
    const innWalks = walks.filter(w => w[tStar] !== 0);
    if (!culWalks.length) return null;
    for (let i = 0; i < K; i++) {
      truth[i] = i === ci
        ? pickW(culWalks, w => Math.pow(1.3, stays(w)), rnd)
        : pickW(innWalks, w => Math.pow(1.3, stays(w)) * Math.pow(0.5, w.filter(x => x === 0).length), rnd);
    }

    // 범인의 거짓 진술: 현장에 없었던 척하되 진짜 동선과 최대한 같게 (말이 되는 동선으로)
    let best = Infinity, fakes = [];
    for (const w of innWalks) {
      if (w.includes(0)) continue; // 현장에 갔다는 말 자체를 하지 않는다
      const d = hamming(w, truth[ci]);
      if (d < best) { best = d; fakes = [w]; } else if (d === best) fakes.push(w);
    }
    if (!fakes.length) return null;
    const fake = fakes[Math.floor(rnd() * fakes.length)];
    const claims = truth.map((w, i) => (i === ci ? fake : w));
    const lieSlots = []; for (let t = 0; t < T; t++) if (fake[t] !== truth[ci][t]) lieSlots.push(t);

    // 증언: 사람마다 한 마디
    const testimonies = [];
    const near = t => (Math.abs(t - tStar) <= 1 ? 3 : 1);
    for (let s = 0; s < K; s++) {
      const cand = [];
      if (s !== ci) {
        for (let t = 0; t < T; t++) {
          const Lc = truth[s][t];
          const others = []; for (let x = 0; x < K; x++) if (x !== s && truth[x][t] === Lc) others.push(x);
          if (!others.length) cand.push({ c: { k: 'alone', by: s, t, L: Lc }, w: near(t) * (claims[ci][t] === Lc ? [6, 3, 1.5][level] : 0.6) });
          for (const x of others) cand.push({ c: { k: 'saw', by: s, who: x, t, L: Lc }, w: near(t) });
          if (claims[ci][t] === Lc && truth[ci][t] !== Lc) cand.push({ c: { k: 'notsaw', by: s, who: ci, t, L: Lc }, w: near(t) * [6, 3, 1.5][level] });
        }
      } else {
        for (let t = 0; t < T; t++) {
          const Lc = fake[t];
          const lie = lieSlots.includes(t);
          const there = []; for (let x = 0; x < K; x++) if (x !== s && claims[x][t] === Lc) there.push(x);
          if (!there.length) cand.push({ c: { k: 'alone', by: s, t, L: Lc }, w: lie ? 4 : 0.6 });
          for (const x of there) cand.push({ c: { k: 'saw', by: s, who: x, t, L: Lc }, w: lie ? 4 : near(t) });
        }
      }
      if (cand.length) testimonies.push(pickW(cand, x => x.w, rnd).c);
    }
    // 어려움에서는 절반만 입을 연다 (누가 말했는지는 단서가 되지 않게 무작위)
    if (level === 2) {
      const keep = new Set(shuffle(testimonies.map(c => c.by), rnd).slice(0, Math.ceil(K / 2)));
      for (let n = testimonies.length - 1; n >= 0; n--) if (!keep.has(testimonies[n].by)) testimonies.splice(n, 1);
    }

    const p = { T, P, tStar, places, edges, adj, suspects, culpritIdx: ci, claims, truth, lieSlots, sceneWalks, testimonies, evidence: [] };

    // 증거 후보 (전부 사실)
    let pool2 = [];
    for (let Lc = 0; Lc < P; Lc++) for (let t = 0; t < T; t++) {
      if (Lc === 0 && t === tStar) continue; // 범행 규칙 그 자체
      pool2.push({ k: 'count', L: Lc, t, n: countAt(truth, Lc, t) });
    }
    if (level >= 1) {
      for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) {
        if (a === b || !adj[a][b]) continue;
        for (let t = 0; t < T - 1; t++) {
          let n = 0; for (const w of truth) if (w[t] === a && w[t + 1] === b) n++;
          pool2.push({ k: 'flow', a, b, t, n });
        }
      }
    }
    if (level <= 1) {
      for (let x = 0; x < K; x++) for (let t = 0; t < T; t++) {
        if (x === ci && lieSlots.includes(t)) continue; // 대놓고 정답인 카드는 안 만든다
        pool2.push({ k: 'at', who: x, L: truth[x][t], t });
      }
    }
    // "대놓고 틀린" 카드: 진술표와 어긋나고, 그 어긋남을 설명할 수 있는 사람이 범인뿐인 카드
    const isDirect = card => {
      if (holds(card, claims)) return false;
      for (let i = 0; i < K; i++) if (i !== ci && feasible(p, i, [card])) return false;
      return true;
    };
    if (level === 2) pool2 = pool2.filter(c => !isDirect(c));
    pool2 = shuffle(pool2, rnd);

    // 탐욕 선택: 남은 후보를 가장 많이 지우는 카드부터
    const innocents = []; for (let i = 0; i < K; i++) if (i !== ci) innocents.push(i);
    const chosen = [];
    let remaining = innocents.filter(i => feasible(p, i, testimonies));
    let guard = 0;
    while (remaining.length && guard++ < 12) {
      // 카드마다 "남은 후보를 몇 명 지우는가"를 센다
      const byN = {};
      for (const card of pool2) {
        if (chosen.includes(card)) continue;
        const cons = [...testimonies, ...chosen, card];
        let n = 0; for (const i of remaining) if (!feasible(p, i, cons)) n++;
        if (n > 0) (byN[n] = byN[n] || []).push(card);
      }
      const ns = Object.keys(byN).map(Number).sort((a, b) => a - b);
      if (!ns.length) return null;
      // 입문은 가장 많이 지우는 카드, 어려움은 가장 조금 지우는 카드(→ 여러 장을 엮어야 함), 보통은 섞어서
      const n = level === 0 ? ns[ns.length - 1] : level === 2 ? ns[0] : ns[Math.floor(rnd() * ns.length)];
      const cardsN = byN[n];
      chosen.push(cardsN[Math.floor(rnd() * cardsN.length)]);
      remaining = remaining.filter(i => feasible(p, i, [...testimonies, ...chosen]));
    }
    if (remaining.length) return null;

    // 없어도 되는 카드는 뺀다
    let evidence = chosen.slice();
    for (const card of shuffle(chosen, rnd)) {
      const rest = evidence.filter(c => c !== card);
      if (innocents.every(i => !feasible(p, i, [...testimonies, ...rest]))) evidence = rest;
    }
    const needed = evidence.length;
    // 사실이지만 결정적이지 않은 카드 (진술표와 어긋나지 않는 것만)
    const noise = pool2.filter(c => !evidence.includes(c) && holds(c, claims) && !(c.k === 'flow' && c.n === 0)).slice(0, [1, 2, 2][level]);
    p.evidence = shuffle([...evidence, ...noise], rnd);

    // 난이도 측정
    const allCons = [...testimonies, ...p.evidence];
    const cores = innocents.map(i => ({ i, core: minCore(p, i, allCons) }));
    const sizes = cores.map(c => c.core.length);
    const maxCore = Math.max(...sizes);
    const direct = p.evidence.some(isDirect);
    // 난이도 조건: 입문은 한 장씩으로 다 지워지고, 보통은 두 장 조합이 한 번 이상, 어려움은 거의 전원이 조합을 요구한다
    const hardOnes = sizes.filter(s => s >= 2).length;
    const ok = level === 0 ? (maxCore <= 1 && needed >= 1)
      : level === 1 ? (maxCore === 2 && needed >= 2)
      : (maxCore >= 2 && hardOnes >= K - 3 && needed >= 3 && !direct);
    const score = maxCore * 10 + sizes.reduce((a, b) => a + b, 0) + needed * 5 - (direct ? 20 : 0);

    p.cores = cores; p.depth = maxCore; p.needed = needed; p.ok = ok; p.score = score;
    return p;
  }

  // ---------- 공개 API ----------
  // 같은 (사건, 난이도, 판 번호) → 항상 같은 퍼즐
  function generate(C, level = 1, variant = 0) {
    level = Math.max(0, Math.min(2, level | 0));
    let fallback = null;
    for (let n = 0; n < 160; n++) {
      const rnd = rng(hashString(`alibi:${C.id}:${level}:${variant}:${n}`));
      const p = attempt(C, level, rnd);
      if (!p) continue;
      if (solve(p).length !== 1) continue; // 유일해가 아니면 버린다 (있어선 안 되지만 안전망)
      if (p.ok) { fallback = p; break; }
      // 난이도 조건을 못 맞추면 가장 가까운 것을 기억해 둔다
      if (!fallback || (level === 0 ? p.score < fallback.score : p.score > fallback.score)) fallback = p;
    }
    if (!fallback) return null;
    const p = fallback;
    const base = baseMinutes(C);
    p.times = Array.from({ length: T }, (_, t) => fmtTime(base + (t - p.tStar) * 10 + 24 * 60));
    p.caseId = C.id; p.level = level; p.variant = variant;
    return p;
  }

  DO.alibi = { T, P, LEVELS, generate, solve, feasible, holds, describe, cells, josa, ro };
})();
