// 여러 폰으로 한 판 하기: 방 만들기 · 참가 · 실시간 동기화 (Appwrite TablesDB + Realtime)
//
//  - 방장이 방을 만들면 방 번호(5글자)가 나온다. 친구들은 홈의 "📡 방 들어가기"에 번호를 넣거나 공유 링크(?room=번호)를 연다.
//  - 로그인하지 않았으면 익명 세션을 자동으로 만든다(DO.account.roomUser). 같은 기기면 새로고침해도 같은 사람으로 다시 들어온다.
//  - 저장 위치 (데이터베이스 detective)
//      rooms 표: 행 ID = 방 번호, 열 state = 방의 공개 상태 JSON. 방장만 고친다.
//      seats 표: 행 ID = 방번호_사용자ID, 열 room = 방 번호, 열 data = { name, step, act } JSON. 각자 자기 줄만 고친다.
//    권한: 표는 "로그인한 사용자(익명 포함): 만들기", 행은 "로그인한 사용자: 읽기" + 만든 사람만 고치기·지우기 (행 단위 보안).
//  - 방장 기기가 심판이다: 모두의 입력(seat.act, 지금 단계 step 에 대한 것만)을 모아 게임 규칙(def.reduce)으로 다음 상태를 만들고
//    rooms.state 에 쓴다. 다른 폰은 state 와 seats 를 받아 각자 자기 화면(def.view)을 그린다.
//  - 실시간 이벤트가 끊겨도 5초마다 한 번씩 직접 다시 읽는다.
//  - 비밀(누가 어떤 용의자인지)도 state 안에 있다. 폰 하나로 할 때처럼 "남의 화면 안 보기" 양심 규칙이다.
//
// 모드 쪽에서 쓰는 법: DO.room.register(모드 id, { min, max(C), init(C, players, rand), reduce(C, game, inputs, players), view(root, ctx) })
//   inputs = { 사용자ID: act } (이번 단계에 낸 것만), reduce 가 새 game 을 돌려주면 단계가 넘어간다(null 이면 그대로).
//   ctx = { C, game, players, me, isHost, step, fresh(이번 단계를 처음 그리는가), local(단계마다 비워지는 화면 메모),
//           act(id), done(id), send(act), restart(), redraw(), leave() }

(() => {
  const { h, render, store } = DO;
  const CFG = window.DO_ACCOUNT_CONFIG || {};
  const DB = CFG.databaseId, ROOMS = CFG.roomsTable || 'rooms', SEATS = CFG.seatsTable || 'seats';
  const enabled = !!(DO.account && DO.account.enabled && CFG.rooms);
  const CODE_CHARS = 'ACDEFHJKMNPRTUVWXY3479';   // 헷갈리는 글자(0 O, 1 I L, 2 Z, 5 S, 6 G, 8 B) 뺌
  const POLL_MS = 5000;
  const games = {};
  let R = null;        // 지금 들어가 있는 방
  let rt = null;       // Realtime (한 번만 만든다)

  const root = () => document.getElementById('root');
  const parse = s => { try { return JSON.parse(s); } catch { return null; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const linkOf = code => location.origin + location.pathname + '?room=' + code;
  const caseRefOf = C => (DO.getCase(C.id) === C || C.seed == null ? { id: C.id } : { seed: C.seed });
  const caseFrom = ref => !ref ? null : ref.id ? DO.getCase(ref.id) : (DO.generateCase && Number.isFinite(ref.seed) ? DO.generateCase(ref.seed) : null);
  const modeOf = id => DO.modes.find(m => m.id === id);

  async function sdk() {
    const u = await DO.account.roomUser();
    const aw = await DO.account.load();
    return { u, aw };
  }
  function errText(e) {
    if (e && e.code === 401) return '방에 들어갈 권한이 없어요. 새로고침한 뒤 다시 해 주세요.';
    if (e && e.code === 404) return '방을 찾을 수 없어요. 번호를 다시 확인해 주세요.';
    if (e instanceof TypeError || /fetch|network/i.test((e && e.message) || '')) return '인터넷 연결을 확인해 주세요.';
    return (e && e.message) || '알 수 없는 오류가 났어요.';
  }
  function setUrl(code) {
    const q = new URLSearchParams(location.search);
    if (code) q.set('room', code); else q.delete('room');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
  function header(mode, code) {
    if (mode && DO.enterMode) DO.enterMode(mode);
    const t = document.getElementById('title');
    if (t && code) t.textContent = (mode ? mode.name : '방') + ' · ' + code;
  }

  // ---------- 화면 조각 ----------
  function errorScreen(msg) {
    render(root(),
      h('div', { class: 'center handoff' }, h('div', { class: 'big' }, '📡'), h('h2', {}, '방에 들어가지 못했어요'), h('p', { class: 'muted' }, msg)),
      h('button', { class: 'primary', onClick: () => joinScreen() }, '다른 번호 넣기'),
      h('button', { onClick: () => DO.goHome() }, '처음으로'),
    );
  }
  function loading(msg) { render(root(), h('div', { class: 'center handoff' }, h('div', { class: 'big' }, '📡'), h('p', { class: 'muted' }, msg))); }

  function defaultName(u) {
    const info = DO.account.info();
    const last = store.get('roomName', '') || (store.get('lastNames', [])[0]) || '';
    return String((info.user && info.user.name) || last || (u && u.name) || '').slice(0, 12);
  }
  // 이름 한 칸 받기
  function askName(title, sub, u, onOk) {
    const input = h('input', { placeholder: '내 이름 (12자까지)', maxlength: 12, autocomplete: 'nickname', value: defaultName(u) });
    const go = () => {
      const v = input.value.trim();
      if (!v) return DO.toast('이름을 적어 주세요.');
      store.set('roomName', v);
      btn.disabled = true;
      onOk(v);
    };
    const btn = h('button', { class: 'primary', onClick: go }, '들어가기');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    render(root(),
      h('h2', {}, title),
      sub ? h('p', { class: 'muted' }, sub) : null,
      h('div', { class: 'card' }, h('label', { class: 'acc-label' }, '다른 사람에게 보일 이름', input)),
      btn,
    );
    setTimeout(() => input.focus(), 50);
  }

  // 홈의 "방 들어가기" → 번호 넣기
  function joinScreen(code) {
    if (!enabled) return DO.toast('이 주소에서는 여러 폰 모드를 쓸 수 없어요.');
    detach();
    const m = { id: 'room', name: '방 들어가기' };
    header(m);
    const help = document.getElementById('help'); if (help) help.hidden = true;
    const input = h('input', { class: 'room-input', placeholder: 'ABCDE', maxlength: 8, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: code || '' });
    const go = () => { const c = cleanCode(input.value); if (c.length < 4) return DO.toast('방 번호 5글자를 넣어 주세요.'); join(c); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    render(root(),
      h('div', { class: 'center' }, h('div', { class: 'big-emoji' }, '📡'), h('h2', {}, '친구 방에 들어가기')),
      h('div', { class: 'card' },
        h('p', { class: 'muted' }, '방장 화면에 나온 방 번호를 넣으세요. 방장이 보낸 링크를 열어도 바로 들어가져요.'),
        input),
      h('button', { class: 'primary', onClick: go }, '들어가기'),
      h('p', { class: 'muted small-text' }, '방을 만들려면: 홈에서 "용의자 접기" → 사건 고르기 → "📡 각자 폰으로".'),
    );
    setTimeout(() => input.focus(), 50);
  }

  // ---------- 방 만들기 ----------
  async function host(modeId, C) {
    const def = games[modeId];
    if (!def) return DO.toast('이 게임은 아직 여러 폰으로 못 해요.');
    detach();
    loading('준비하는 중…');
    let u, aw;
    try { ({ u, aw } = await sdk()); } catch (e) { return errorScreen(errText(e)); }
    askName('📡 방 만들기', `${C.title} · 친구들이 각자 폰으로 들어와요.`, u, async name => {
      loading('방을 만드는 중…');
      const { Permission, Role } = aw.sdk;
      const state = { v: 1, mode: modeId, caseRef: caseRefOf(C), host: u.$id, phase: 'lobby', step: 0, players: [], game: null, closed: false };
      let code = null;
      for (let i = 0; i < 6 && !code; i++) {
        const c = newCode();
        try {
          await aw.tables.createRow({ databaseId: DB, tableId: ROOMS, rowId: c, data: { state: JSON.stringify(state) },
            permissions: [Permission.read(Role.users()), Permission.update(Role.user(u.$id)), Permission.delete(Role.user(u.$id))] });
          code = c;
        } catch (e) { if (!e || e.code !== 409) { console.error(e); return errorScreen(errText(e)); } }
      }
      if (!code) return errorScreen('방 번호를 만들지 못했어요. 다시 해 주세요.');
      try { await attach({ aw, u, code, state, C, def, name }); } catch (e) { console.error(e); errorScreen(errText(e)); }
    });
  }

  // ---------- 들어가기 ----------
  async function join(code) {
    if (!enabled) return;
    code = cleanCode(code);
    detach();
    loading(`방 ${code} 찾는 중…`);
    let u, aw, state;
    try {
      ({ u, aw } = await sdk());
      const row = await aw.tables.getRow({ databaseId: DB, tableId: ROOMS, rowId: code });
      state = parse(row.state);
    } catch (e) { console.error(e); return errorScreen(errText(e)); }
    if (!state || !state.mode) return errorScreen('방 정보가 망가졌어요.');
    const def = games[state.mode], C = caseFrom(state.caseRef);
    if (!def || !C) return errorScreen('이 버전에서 열 수 없는 방이에요. 새로고침해 보세요.');
    if (state.closed) return errorScreen('방장이 이미 닫은 방이에요.');
    const inGame = (state.players || []).some(p => p.id === u.$id);
    if (state.phase !== 'lobby' && !inGame) return errorScreen('이미 게임을 시작한 방이에요. 다음 판에 같이 해요!');
    // 이미 자리가 있으면(새로고침) 그 이름 그대로
    let seat = null;
    try { seat = await aw.tables.getRow({ databaseId: DB, tableId: SEATS, rowId: seatId(code, u.$id) }); } catch (e) { if (!e || e.code !== 404) console.warn(e); }
    const old = seat && parse(seat.data);
    const enter = async name => {
      loading('들어가는 중…');
      try { await attach({ aw, u, code, state, C, def, name, seat: old }); } catch (e) { console.error(e); errorScreen(errText(e)); }
    };
    if (old && old.name) return enter(old.name);
    if (inGame) return enter(state.players.find(p => p.id === u.$id).name);
    askName(`📡 방 ${code}`, `${C.title}`, u, enter);
  }

  const seatId = (code, uid) => `${code}_${uid}`;

  // ---------- 방에 붙기 ----------
  async function attach({ aw, u, code, state, C, def, name, seat }) {
    const { Permission, Role } = aw.sdk;
    const me = u.$id;
    R = { aw, code, me, isHost: state.host === me, state, C, def, seats: new Map(), local: {}, localStep: -1,
      drawnKey: '', drawnStep: -1, lastEvent: Date.now(), sub: null, poll: null, saving: null, dirty: false, seatSaving: null, seatDirty: false };
    const mine = { name, step: seat ? seat.step : -1, act: seat ? seat.act : null };
    R.seats.set(me, { ...mine, created: '' });
    // 내 자리 만들기(있으면 이름만 고침)
    try {
      await aw.tables.createRow({ databaseId: DB, tableId: SEATS, rowId: seatId(code, me), data: { room: code, data: JSON.stringify(mine) },
        permissions: [Permission.read(Role.users()), Permission.update(Role.user(me)), Permission.delete(Role.user(me))] });
    } catch (e) {
      if (!e || e.code !== 409) throw e;
      await aw.tables.updateRow({ databaseId: DB, tableId: SEATS, rowId: seatId(code, me), data: { data: JSON.stringify(mine) } });
    }
    setUrl(code);
    header(modeOf(state.mode), code);
    if (DO.music) { if (state.phase === 'lobby') DO.music.base('lobby'); else DO.music.startGame(state.mode); }
    // 실시간 구독
    try {
      if (!rt) rt = new aw.sdk.Realtime(aw.client);
      const r = R;
      const sub = await rt.subscribe([
        `databases.${DB}.tables.${ROOMS}.rows.${code}`,
        `databases.${DB}.tables.${SEATS}.rows`,
      ], msg => { if (R === r) onEvent(msg); });
      if (R === r) r.sub = sub; else sub.unsubscribe();
    } catch (e) { console.warn('실시간 연결 실패, 5초마다 다시 읽기로', e); }
    await refresh();
    if (!R) return;
    R.poll = setInterval(() => { if (R && Date.now() - R.lastEvent > POLL_MS - 200) refresh(); }, POLL_MS);
    tick();
  }

  function onEvent(msg) {
    const row = msg && msg.payload;
    if (!row || !R) return;
    const del = (msg.events || []).some(e => /\.delete$/.test(e));
    R.lastEvent = Date.now();
    if (row.$tableId === ROOMS || (row.state !== undefined && row.$id === R.code)) {
      if (row.$id !== R.code) return;
      if (del) { R.state.closed = true; return tick(); }
      takeState(parse(row.state));
    } else if (row.room !== undefined) {
      if (row.room !== R.code) return;
      takeSeat(row, del);
    }
    tick();
  }
  function takeState(s) {
    if (!s || !R) return;
    if (R.isHost && R.state.phase !== 'lobby' && !s.closed) return;   // 방장은 자기 상태가 기준
    if (R.isHost && R.state.step > s.step) return;
    if ((s.step | 0) >= (R.state.step | 0) || s.closed) R.state = s;
  }
  function takeSeat(row, del) {
    const id = row.$id.slice(R.code.length + 1);
    if (del) { R.seats.delete(id); return; }
    const d = parse(row.data) || {};
    if (id === R.me) { const cur = R.seats.get(id); if (cur) { cur.created = row.$createdAt; return; } }   // 내 자리는 내 것이 기준
    R.seats.set(id, { name: String(d.name || '?').slice(0, 12), step: d.step | 0, act: d.act || null, created: row.$createdAt });
  }
  async function refresh() {
    const r = R;
    if (!r) return;
    try {
      const { Query } = r.aw.sdk;
      const [room, seats] = await Promise.all([
        r.aw.tables.getRow({ databaseId: DB, tableId: ROOMS, rowId: r.code }).catch(e => { if (e && e.code === 404) return null; throw e; }),
        r.aw.tables.listRows({ databaseId: DB, tableId: SEATS, queries: [Query.equal('room', r.code), Query.limit(50)] }),
      ]);
      if (R !== r) return;
      if (!room) r.state.closed = true; else takeState(parse(room.state));
      const seen = new Set([r.me]);
      for (const row of seats.rows || []) { takeSeat(row, false); seen.add(row.$id.slice(r.code.length + 1)); }
      for (const id of [...r.seats.keys()]) if (!seen.has(id)) r.seats.delete(id);
      r.offline = false;
    } catch (e) { console.warn(e); if (R === r) r.offline = true; }
    tick();
  }

  // ---------- 방장: 규칙 돌리기 · 상태 쓰기 ----------
  function hostRun() {
    const s = R.state;
    if (!R.isHost || s.phase !== 'play' || s.closed) return;
    const inputs = {};
    for (const [id, seat] of R.seats) if (seat.step === s.step && seat.act) inputs[id] = seat.act;
    let next = null;
    try { next = R.def.reduce(R.C, s.game, inputs, s.players); } catch (e) { console.error(e); }
    if (next) { s.game = next; s.step++; saveState(); }
  }
  function saveState() {
    const r = R;
    r.dirty = true;
    if (r.saving) return;
    r.saving = (async () => {
      while (r.dirty && (R === r || r.state.closed)) {
        r.dirty = false;
        try { await r.aw.tables.updateRow({ databaseId: DB, tableId: ROOMS, rowId: r.code, data: { state: JSON.stringify(r.state) } }); r.offline = false; }
        catch (e) { console.warn(e); r.offline = true; r.dirty = true; if (R !== r) break; await sleep(2000); }
      }
      r.saving = null;
    })();
  }
  function saveSeat() {
    const r = R;
    r.seatDirty = true;
    if (r.seatSaving) return;
    r.seatSaving = (async () => {
      while (r.seatDirty && R === r) {
        r.seatDirty = false;
        const me = r.seats.get(r.me);
        try { await r.aw.tables.updateRow({ databaseId: DB, tableId: SEATS, rowId: seatId(r.code, r.me), data: { data: JSON.stringify({ name: me.name, step: me.step, act: me.act }) } }); r.offline = false; }
        catch (e) { console.warn(e); r.offline = true; r.seatDirty = true; await sleep(2000); }
      }
      r.seatSaving = null;
    })();
  }

  function send(act) {
    if (!R) return;
    const me = R.seats.get(R.me);
    me.step = R.state.step; me.act = act;
    saveSeat();
    tick();
  }
  function startGame() {
    const s = R.state;
    const list = lobbyList();
    const max = R.def.max(R.C), min = R.def.min;
    if (list.length < min) return DO.toast(`${min}명 이상 모여야 시작할 수 있어요.`);
    if (list.length > max) return DO.toast(`이 사건은 ${max}명까지예요. ${list.length - max}명은 다음 판에!`);
    s.players = list.map(p => ({ id: p.id, name: p.name }));
    s.game = R.def.init(R.C, s.players, Math.random);
    s.phase = 'play'; s.step++;
    saveState();
    tick();
  }
  function restart() {
    if (!R || !R.isHost) return;
    const s = R.state;
    s.game = R.def.init(R.C, s.players, Math.random);
    s.step++;
    saveState();
    tick();
  }

  // ---------- 그리기 ----------
  function lobbyList() {
    return [...R.seats.entries()].map(([id, s]) => ({ id, name: s.name, created: s.created || '9' }))
      .sort((a, b) => (a.id === R.state.host ? -1 : b.id === R.state.host ? 1 : a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  }
  function tick() {
    if (!R) return;
    if (R.isHost) hostRun();
    draw();
  }
  function draw() {
    const s = R.state;
    const seatsKey = [...R.seats.entries()].map(([id, x]) => [id, x.name, x.step, x.act]);
    const key = JSON.stringify([s.step, s.phase, s.closed, s.game, seatsKey, R.offline, R.localVer || 0]);
    if (key === R.drawnKey) return;
    R.drawnKey = key;
    const fresh = s.step !== R.drawnStep;
    if (fresh) { R.local = {}; }
    const rt0 = root();
    rt0.classList.toggle('still', !fresh);   // 같은 단계에서 다시 그릴 때는 올라오는 효과를 끈다
    if (s.closed) return closedScreen();
    if (s.phase === 'lobby') lobby();
    else {
      if (fresh && R.drawnStep >= 0 && s.step === 1 && DO.music) DO.music.startGame(s.mode);
      const ctx = {
        C: R.C, game: s.game, players: s.players, me: R.me, isHost: R.isHost, step: s.step, fresh, local: R.local,
        act: id => { const x = R.seats.get(id); return x && x.step === s.step ? x.act : null; },
        done: id => { const x = R.seats.get(id); return !!(x && x.step === s.step && x.act); },
        send, restart, leave: () => DO.goHome(),
        redraw: () => { R.localVer = (R.localVer || 0) + 1; draw(); },
      };
      try { R.def.view(rt0, ctx); } catch (e) { console.error(e); render(rt0, h('p', {}, '화면 오류: ' + e.message)); }
      if (R.offline) rt0.prepend(h('div', { class: 'card alert room-offline' }, '📶 연결이 불안정해요. 다시 연결하는 중…'));
    }
    R.drawnStep = s.step;
  }

  function lobby() {
    const list = lobbyList();
    const max = R.def.max(R.C), min = R.def.min;
    const share = async () => {
      const url = linkOf(R.code);
      try {
        if (navigator.share) await navigator.share({ title: '탐정 사무소', text: `탐정 사무소 방 ${R.code} 에 들어와!`, url });
        else { await navigator.clipboard.writeText(url); DO.toast('링크를 복사했어요. 친구에게 보내 주세요.'); }
      } catch (e) { if (!e || e.name !== 'AbortError') DO.toast(url); }
    };
    render(root(),
      h('div', { class: 'card room-code-card' },
        h('p', { class: 'muted small-text' }, '방 번호'),
        h('div', { class: 'room-code' }, R.code.split('').map(ch => h('span', {}, ch))),
        h('p', { class: 'muted small-text' }, '친구들은 홈 → 📡 방 들어가기에서 이 번호를 넣어요.'),
        h('button', { class: 'small', onClick: share }, '🔗 링크 보내기')),
      h('div', { class: 'card' },
        h('p', {}, h('b', {}, R.C.title)),
        h('p', { class: 'muted small-text' }, R.C.intro)),
      h('div', { class: 'section-title' }, `들어온 사람 ${list.length}명 · ${min}~${max}명`),
      h('div', { class: 'card seat-list' },
        list.map(p => h('div', { class: 'player' },
          h('span', {}, p.id === R.state.host ? '👑 ' : '🙂 ', h('b', {}, p.name), p.id === R.me ? h('span', { class: 'muted' }, ' (나)') : null),
          h('span', { class: 'muted small-text' }, p.id === R.state.host ? '방장' : '준비 완료')))),
      R.isHost
        ? h('button', { class: 'primary', disabled: list.length < min || list.length > max, onClick: startGame },
            list.length < min ? `${min}명 이상 모이면 시작` : list.length > max ? `${max}명까지만 할 수 있어요` : `🚀 ${list.length}명으로 시작`)
        : h('p', { class: 'center muted' }, '⏳ 방장이 시작하기를 기다리는 중…'),
      h('button', { onClick: () => { if (confirm('방에서 나갈까요?')) DO.goHome(); } }, R.isHost ? '방 닫기' : '방에서 나가기'),
      R.offline ? h('div', { class: 'card alert room-offline' }, '📶 연결이 불안정해요. 다시 연결하는 중…') : null,
    );
  }
  function closedScreen() {
    render(root(),
      h('div', { class: 'center handoff' }, h('div', { class: 'big' }, '🚪'), h('h2', {}, '방이 닫혔어요'), h('p', { class: 'muted' }, '방장이 방을 닫았어요.')),
      h('button', { class: 'primary', onClick: () => DO.goHome() }, '처음으로'),
    );
  }

  // ---------- 나가기 ----------
  // 홈으로 갈 때(app.js 의 home) 부른다. 대기실이면 내 자리를 지우고, 방장이면 방을 닫는다.
  function detach() {
    if (!R) return;
    const r = R;
    R = null;
    clearInterval(r.poll);
    if (r.sub) r.sub.unsubscribe().catch(() => {});
    const rootEl = root(); if (rootEl) rootEl.classList.remove('still');
    setUrl(null);
    const t = r.aw.tables;
    if (r.isHost && !r.state.closed) {
      if (r.state.phase === 'lobby') t.deleteRow({ databaseId: DB, tableId: ROOMS, rowId: r.code }).catch(() => {});
      else { r.state.closed = true; t.updateRow({ databaseId: DB, tableId: ROOMS, rowId: r.code, data: { state: JSON.stringify(r.state) } }).catch(() => {}); }
    }
    if (r.state.phase === 'lobby' || r.state.closed || r.isHost) t.deleteRow({ databaseId: DB, tableId: SEATS, rowId: seatId(r.code, r.me) }).catch(() => {});
  }

  DO.room = {
    enabled, register: (id, def) => { games[id] = def; }, has: id => enabled && !!games[id],
    host, join, joinScreen, detach, info: () => R && { code: R.code, me: R.me, isHost: R.isHost, phase: R.state.phase, step: R.state.step, seats: R.seats.size },
    _debug: () => R,
  };
})();
