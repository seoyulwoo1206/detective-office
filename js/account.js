// 계정: 이메일+비밀번호 로그인(Appwrite) + 게임 기록을 계정에 저장 (수어 시뮬레이션 사전과 같은 방식)
//
//  - 헤더의 👤 버튼 → 계정 시트(로그인 / 가입 / 비밀번호 찾기 / 내 계정).
//  - 로그인하면 이 기기의 기록과 계정에 저장된 기록을 합친다(어느 쪽에서 한 판도 잃지 않게).
//  - 그 뒤로 기록이 바뀔 때마다(DO.store.set/del) 잠시 기다렸다가 계정에 저장한다. 화면을 떠날 때는 바로 저장.
//  - 다른 기기에서 하고 돌아오면(이 탭을 다시 볼 때) 계정의 기록을 다시 합친다.
//  - 로그아웃하면 이 기기의 게임 기록을 지운다(같은 기기를 쓰는 다음 사람에게 안 보이게). 소리 설정과 API 키는 남긴다.
//
// 저장 위치: Appwrite TablesDB  detective / saves  의 행 하나 (행 ID = 사용자 ID, 열 saveJson = { "do:키": "localStorage 원래 글자" })
// 권한: 표는 "로그인한 사용자: 만들기"만, 행은 만든 사람만 읽기·고치기·지우기 (행 단위 보안 켬)
// 계정에 올리지 않는 것: do:apiKey (AI 심문의 Anthropic API 키 — 이 기기에만)
// file:// 로 열었거나 설정이 없으면 버튼을 숨기고 아무것도 하지 않는다.

(() => {
  const CFG = window.DO_ACCOUNT_CONFIG || {};
  const { h } = DO;
  const SDK = 'https://cdn.jsdelivr.net/npm/appwrite@29.2.0/+esm';
  const SAVE_DELAY = 1500;
  const MIN_PASSWORD = 8;
  const PREFIX = 'do:';
  const NO_SYNC = new Set(['do:apiKey']);
  const KEEP_ON_SIGNOUT = new Set(['do:apiKey', 'do:music', 'do:musicVol', 'do:sound', 'do:seenIntro']);
  const enabled = !!CFG.projectId && /^https?:$/.test(location.protocol);

  let aw = null, user = null, guest = null, status = enabled ? 'loading' : 'off', errorText = '', lastSaved = null;
  let lastUploaded = '', rowExists = false, pulling = false, timer = null, uploading = null;
  const btn = document.getElementById('account');

  // ---------- 기록 묶음 ----------
  function snapshot() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && !NO_SYNC.has(k)) out[k] = localStorage.getItem(k);
      }
    } catch { /* 사생활 모드 */ }
    return out;
  }
  const sorted = o => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])));
  const parse = s => { try { return JSON.parse(s); } catch { return null; } };
  const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x);
  const maxMap = (a, b) => { const o = { ...(isObj(b) ? b : {}) }; for (const [k, v] of Object.entries(isObj(a) ? a : {})) if (Number.isFinite(v)) o[k] = Math.max(v, Number.isFinite(o[k]) ? o[k] : 0); return o; };

  // 명탐정의 길: 경험치가 많은 쪽을 바탕으로, 별·도전 횟수·통계는 큰 값, 업적·본 장은 합집합
  function mergeCareer(a, b) {
    if (!isObj(a)) return b; if (!isObj(b)) return a;
    const [hi, lo] = (a.xp | 0) >= (b.xp | 0) ? [a, b] : [b, a];
    const out = { ...lo, ...hi };
    out.name = hi.name || lo.name || '';
    out.xp = Math.max(a.xp | 0, b.xp | 0);
    out.best = maxMap(a.best, b.best);
    out.plays = maxMap(a.plays, b.plays);
    out.stats = maxMap(a.stats, b.stats);
    out.seen = { ...(isObj(lo.seen) ? lo.seen : {}), ...(isObj(hi.seen) ? hi.seen : {}) };
    const ach = { ...(isObj(lo.ach) ? lo.ach : {}) };
    for (const [k, v] of Object.entries(isObj(hi.ach) ? hi.ach : {})) ach[k] = ach[k] && ach[k] < v ? ach[k] : v;
    out.ach = ach;
    const RO = ['C', 'B', 'A', 'S'], ra = isObj(a.ranks) ? a.ranks : {}, rb = isObj(b.ranks) ? b.ranks : {};
    out.ranks = { ...ra };
    for (const [k, v] of Object.entries(rb)) if (!out.ranks[k] || RO.indexOf(v) > RO.indexOf(out.ranks[k])) out.ranks[k] = v;
    const sa = isObj(a.streak) ? a.streak : null, sb = isObj(b.streak) ? b.streak : null;
    if (sa || sb) {
      const pick = !sa ? sb : !sb ? sa : (sa.last || '') > (sb.last || '') ? sa : (sb.last || '') > (sa.last || '') ? sb : ((sa.n | 0) >= (sb.n | 0) ? sa : sb);
      out.streak = { ...pick, best: Math.max(sa ? sa.best | 0 : 0, sb ? sb.best | 0 : 0, pick.n | 0) };
    }
    const qa = isObj(a.quests) ? a.quests : null, qb = isObj(b.quests) ? b.quests : null;
    if (qa && qb && qa.date === qb.date) out.quests = { date: qa.date, done: [...new Set([...(qa.done || []), ...(qb.done || [])])] };
    else out.quests = !qa ? qb : !qb ? qa : qa.date > qb.date ? qa : qb;
    return out;
  }
  // 이 기기의 기록(local)과 계정의 기록(remote) 합치기 — 둘 다 { 키: 원래 글자 }
  function merge(local, remote) {
    const out = { ...remote, ...local };
    for (const k of Object.keys(remote)) {
      if (!(k in local)) continue;
      const a = parse(local[k]), b = parse(remote[k]);
      if (k === 'do:career') out[k] = JSON.stringify(mergeCareer(a, b));
      else if (/^do:alibi:(best|v):/.test(k) && Number.isFinite(a) && Number.isFinite(b)) out[k] = JSON.stringify(Math.max(a, b));
    }
    return out;
  }
  function apply(map) {
    try { for (const [k, v] of Object.entries(map)) if (k.startsWith(PREFIX) && !NO_SYNC.has(k) && typeof v === 'string') localStorage.setItem(k, v); } catch { /* ignore */ }
  }

  // ---------- 상태 ----------
  function setStatus(s, err = '') { status = s; errorText = err; paint(); if (sheetOpen()) renderSheet(); }
  function paint() {
    if (!btn) return;
    btn.hidden = !enabled;
    btn.classList.toggle('on', !!user);
    btn.textContent = status === 'error' && user ? '⚠️' : '👤';
    btn.title = user ? `내 계정 (${user.email}) · ${statusText()}` : '로그인하면 다른 기기에서도 이어서';
  }
  function statusText() {
    if (status === 'syncing') return '저장 중…';
    if (status === 'saved') return lastSaved ? `저장됨 · ${lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '저장됨';
    if (status === 'error') return errorText || '저장하지 못했어요';
    return '';
  }

  // Appwrite 오류 → 알아듣기 쉬운 말
  function errorMessage(e) {
    const type = (e && e.type) || '';
    if (type === 'user_invalid_credentials') return '이메일이나 비밀번호가 맞지 않아요.';
    if (type === 'user_already_exists') return '이미 가입된 이메일이에요. 로그인해 주세요.';
    if (type === 'user_password_mismatch' || type === 'password_recently_used') return '비밀번호를 다시 확인해 주세요.';
    if (type === 'password_personal_data') return '비밀번호에 이름이나 이메일을 넣지 말아 주세요.';
    if (type === 'user_blocked') return '이 계정은 사용할 수 없게 막혀 있어요.';
    if (type === 'general_rate_limit_exceeded' || (e && e.code === 429)) return '너무 여러 번 시도했어요. 잠시 뒤에 다시 해 주세요.';
    if (type === 'general_argument_invalid') {
      if (/email/i.test(e.message)) return '이메일 주소 형식이 올바르지 않아요.';
      if (/password/i.test(e.message)) return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`;
    }
    if (type === 'user_invalid_token') return '재설정 링크가 만료됐거나 이미 사용했어요. 비밀번호 찾기를 다시 해 주세요.';
    if (type === 'project_invalid_host' || type === 'general_unknown_origin') return '이 주소에서는 로그인을 쓸 수 없어요.';
    if (type === 'user_unauthorized' || (e && e.code === 401)) return '로그인이 풀렸어요. 다시 로그인해 주세요.';
    if (e && e.code === 403) return '계정 저장소에 접근할 수 없어요.';
    if (e instanceof TypeError || /fetch|network/i.test((e && e.message) || '')) return '인터넷 연결을 확인해 주세요.';
    return (e && e.message) || '알 수 없는 오류가 났어요.';
  }

  async function load() {
    if (aw) return aw;
    const sdk = await import(SDK);
    const client = new sdk.Client().setEndpoint(CFG.endpoint).setProject(CFG.projectId).setLocale('ko');
    aw = { sdk, client, account: new sdk.Account(client), tables: new sdk.TablesDB(client) };
    return aw;
  }
  const rowRef = () => ({ databaseId: CFG.databaseId, tableId: CFG.tableId, rowId: user.$id });

  // ---------- 가져오기 · 올리기 ----------
  async function pull() {
    if (!user || pulling) return;
    pulling = true;
    setStatus('syncing');
    try {
      const local = snapshot();
      let merged = local;
      try {
        const row = await aw.tables.getRow(rowRef());
        rowExists = true;
        lastUploaded = row.saveJson || '';
        const remote = parse(row.saveJson);
        if (isObj(remote)) merged = merge(local, remote);
      } catch (e) {
        if (!e || e.code !== 404) throw e;
        rowExists = false; lastUploaded = '';
      }
      const changed = sorted(merged) !== sorted(local);
      if (changed) apply(merged);
      pulling = false;
      if (changed) onSynced();
      await upload();
    } catch (e) {
      pulling = false;
      console.error(e);
      setStatus('error', errorMessage(e));
    }
  }
  // 계정 기록이 들어오면: 홈 화면이면 다시 그리고, 아니면 쪽지만 (게임 중인 판은 건드리지 않음)
  function onSynced() {
    const homeBtn = document.getElementById('home');
    if (homeBtn && homeBtn.hidden && DO.goHome) DO.goHome();
    if (DO.toast) DO.toast('☁️ 계정에 저장된 기록을 불러왔어요');
  }
  function scheduleUpload() {
    if (!user || pulling) return;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; upload(); }, SAVE_DELAY);
  }
  async function upload() {
    if (!user) return;
    if (uploading) await uploading.catch(() => {});
    const text = sorted(snapshot());
    if (text === lastUploaded) { lastSaved = lastSaved || new Date(); setStatus('saved'); return; }
    setStatus('syncing');
    const { Permission, Role } = aw.sdk;
    const mine = Role.user(user.$id);
    uploading = rowExists
      ? aw.tables.updateRow({ ...rowRef(), data: { saveJson: text } })
      : aw.tables.createRow({ ...rowRef(), data: { saveJson: text }, permissions: [Permission.read(mine), Permission.update(mine), Permission.delete(mine)] });
    try {
      await uploading;
      rowExists = true; lastUploaded = text; lastSaved = new Date();
      setStatus('saved');
    } catch (e) {
      console.error(e);
      if (e && e.code === 409) rowExists = true;   // 다른 기기가 먼저 만들었으면 다음엔 고친다
      if (e && e.code === 404) rowExists = false;
      setStatus('error', errorMessage(e));
    } finally { uploading = null; }
  }
  function flush() { if (timer) { clearTimeout(timer); timer = null; upload(); } }

  // 익명 세션(여러 폰 방 참가용, js/room.js)은 "로그인 안 함"으로 본다 — 기록 동기화는 이메일 계정만.
  const isAnon = u => !u || !u.email;
  async function startSession(u) {
    if (isAnon(u)) { user = null; guest = u || null; setStatus('signed-out'); return; }
    guest = null; user = u; lastUploaded = ''; rowExists = false; await pull();
  }
  // 익명 세션이 있으면 지우고 나서 로그인·가입한다(세션이 있으면 새 세션을 못 만든다)
  async function dropGuest() {
    if (!guest) return;
    try { await aw.account.deleteSession({ sessionId: 'current' }); } catch (e) { console.warn(e); }
    guest = null;
  }
  // 방 참가용: 로그인한 계정이 있으면 그 사람, 없으면 익명 세션을 만들어서 { $id, name } 를 돌려준다
  async function roomUser() {
    await load();
    if (user) return user;
    if (guest) return guest;
    try { guest = await aw.account.get(); } catch (e) {
      if (!e || e.code !== 401) throw new Error(errorMessage(e));
      try { await aw.account.createAnonymousSession(); guest = await aw.account.get(); } catch (e2) { throw new Error(errorMessage(e2)); }
    }
    if (!isAnon(guest)) { const u = guest; guest = null; await startSession(u); return u; }
    return guest;
  }

  async function signIn(email, password) {
    await load();
    await dropGuest();
    try { await aw.account.createEmailPasswordSession({ email: email.trim(), password }); } catch (e) {
      if (!e || e.type !== 'user_session_already_exists') throw new Error(errorMessage(e));
    }
    await startSession(await aw.account.get());
  }
  async function signUp(email, password, name) {
    await load();
    await dropGuest();
    try { await aw.account.create({ userId: aw.sdk.ID.unique(), email: email.trim(), password, name: (name || '').trim() || undefined }); } catch (e) { throw new Error(errorMessage(e)); }
    await signIn(email, password);
  }
  async function signOut() {
    if (!aw || !user) return;
    clearTimeout(timer); timer = null;
    await Promise.race([upload(), new Promise(r => setTimeout(r, 4000))]);   // 마지막 기록까지 올리고 나간다
    try { await aw.account.deleteSession({ sessionId: 'current' }); } catch (e) { console.warn(e); }
    user = null; lastUploaded = ''; rowExists = false;
    try { Object.keys(snapshot()).filter(k => !KEEP_ON_SIGNOUT.has(k)).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    view = 'signin';
    setStatus('signed-out');
    if (DO.goHome) DO.goHome();
  }
  async function sendPasswordReset(email) {
    await load();
    try { await aw.account.createRecovery({ email: email.trim(), url: location.origin + location.pathname }); } catch (e) {
      if (e && (e.code === 404 || e.type === 'user_not_found')) return;   // 가입 여부를 알려 주지 않는다
      throw new Error(errorMessage(e));
    }
  }
  async function resetPassword(userId, secret, password) {
    await load();
    try { await aw.account.updateRecovery({ userId, secret, password }); } catch (e) {
      throw new Error(errorMessage(e && e.code === 404 ? { type: 'user_invalid_token' } : e));
    }
  }

  // ---------- 계정 시트 ----------
  let view = 'signin';     // signin | signup | forgot | reset
  let reset = null;        // { userId, secret }
  const sheetOpen = () => { const o = document.getElementById('overlay'); return o && !o.hidden && document.querySelector('#sheet .account-sheet'); };
  function field(label, attrs) { const i = h('input', attrs); return [h('label', { class: 'acc-label' }, label, i), i]; }

  function renderSheet() {
    if (!DO.openSheet) return;
    const msg = h('p', { class: 'acc-msg', role: 'status' });
    const busy = (b, on) => { b.disabled = on; b.classList.toggle('busy', on); };
    const run = async (b, fn) => { msg.textContent = ''; msg.className = 'acc-msg'; busy(b, true); try { await fn(); } catch (e) { msg.textContent = e.message || String(e); msg.className = 'acc-msg err'; } finally { busy(b, false); } };
    let body;
    if (user) {
      body = [
        h('div', { class: 'card acc-me' },
          h('p', {}, h('b', {}, user.name || '탐정'), h('br'), h('span', { class: 'muted small-text' }, user.email)),
          h('p', { class: 'acc-state ' + status }, status === 'error' ? `⚠️ ${errorText}` : `☁️ ${statusText() || '연결됨'}`)),
        h('p', { class: 'muted small-text' }, '명탐정의 길(레벨·별·업적), 알리바이 최고 기록, AI 심문 기록, 소리 설정이 계정에 저장됩니다. 다른 기기에서 같은 계정으로 로그인하면 이어서 할 수 있어요. (AI 심문의 API 키는 이 기기에만 남습니다)'),
        (() => { const b = h('button', { class: 'primary', onClick: () => run(b, async () => { await pull(); if (status === 'error') throw new Error(errorText); msg.textContent = '저장했어요.'; }) }, '☁️ 지금 저장·불러오기'); return b; })(),
        (() => { const b = h('button', { onClick: () => { if (confirm('로그아웃할까요? 이 기기의 게임 기록은 지워지고, 계정에는 그대로 남아 있어요.')) run(b, async () => { await signOut(); renderSheet(); }); } }, '로그아웃'); return b; })(),
        msg,
      ];
    } else if (view === 'reset' && reset) {
      const [l1, p1] = field('새 비밀번호', { type: 'password', autocomplete: 'new-password', minlength: MIN_PASSWORD });
      const [l2, p2] = field('새 비밀번호 확인', { type: 'password', autocomplete: 'new-password' });
      const b = h('button', { class: 'primary', onClick: () => run(b, async () => {
        if (p1.value.length < MIN_PASSWORD) throw new Error(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`);
        if (p1.value !== p2.value) throw new Error('두 비밀번호가 달라요.');
        await resetPassword(reset.userId, reset.secret, p1.value);
        reset = null; view = 'signin'; renderSheet(); if (DO.toast) DO.toast('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.');
      }) }, '비밀번호 바꾸기');
      body = [h('p', {}, '새 비밀번호를 정해 주세요.'), l1, l2, b, msg];
    } else if (view === 'forgot') {
      const [l1, em] = field('가입한 이메일', { type: 'email', autocomplete: 'email' });
      const b = h('button', { class: 'primary', onClick: () => run(b, async () => {
        if (!em.value.trim()) throw new Error('이메일을 적어 주세요.');
        await sendPasswordReset(em.value);
        msg.textContent = '재설정 메일을 보냈어요(가입한 이메일이라면). 메일의 링크를 1시간 안에 눌러 주세요.';
      }) }, '재설정 메일 보내기');
      body = [l1, b, h('button', { class: 'small', onClick: () => { view = 'signin'; renderSheet(); } }, '← 로그인으로'), msg];
    } else {
      const up = view === 'signup';
      const tabs = h('div', { class: 'chips acc-tabs' },
        h('button', { class: 'chip' + (!up ? ' active' : ''), onClick: () => { view = 'signin'; renderSheet(); } }, '로그인'),
        h('button', { class: 'chip' + (up ? ' active' : ''), onClick: () => { view = 'signup'; renderSheet(); } }, '가입하기'));
      const [ln, nm] = field('탐정 이름 (선택)', { type: 'text', autocomplete: 'nickname', maxlength: 24 });
      const [le, em] = field('이메일', { type: 'email', autocomplete: 'email' });
      const [lp, pw] = field('비밀번호' + (up ? ` (${MIN_PASSWORD}자 이상)` : ''), { type: 'password', autocomplete: up ? 'new-password' : 'current-password' });
      const [lp2, pw2] = field('비밀번호 확인', { type: 'password', autocomplete: 'new-password' });
      const b = h('button', { class: 'primary', onClick: () => run(b, async () => {
        if (!em.value.trim() || !pw.value) throw new Error('이메일과 비밀번호를 적어 주세요.');
        if (up) {
          if (pw.value.length < MIN_PASSWORD) throw new Error(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`);
          if (pw.value !== pw2.value) throw new Error('두 비밀번호가 달라요.');
          await signUp(em.value, pw.value, nm.value);
        } else await signIn(em.value, pw.value);
        renderSheet();
        if (DO.toast) DO.toast(up ? '🎉 가입했어요. 이제 기록이 계정에 저장돼요.' : '로그인했어요.');
      }) }, up ? '가입하고 로그인' : '로그인');
      pw.addEventListener('keydown', e => { if (e.key === 'Enter' && !up) b.click(); });
      body = [
        h('p', { class: 'muted' }, '로그인하면 기록이 계정에 저장돼서 폰·컴퓨터 어디서든 이어서 할 수 있어요. 지금 이 기기의 기록은 로그인할 때 계정 기록과 합쳐집니다.'),
        tabs, up ? ln : null, le, lp, up ? lp2 : null, b,
        !up ? h('button', { class: 'small', onClick: () => { view = 'forgot'; renderSheet(); } }, '비밀번호를 잊었어요') : null,
        msg,
      ];
    }
    DO.openSheet('👤 내 계정', h('div', { class: 'account-sheet' }, body));
  }

  // ---------- 시작 ----------
  async function init() {
    paint();
    if (!enabled) return;
    if (btn) btn.addEventListener('click', () => { if (status === 'loading') return DO.toast && DO.toast('계정 정보를 불러오는 중이에요…'); renderSheet(); });
    // 비밀번호 재설정 메일 링크로 들어왔으면 (?userId=…&secret=…)
    const q = new URLSearchParams(location.search);
    if (q.get('userId') && q.get('secret')) {
      reset = { userId: q.get('userId'), secret: q.get('secret') }; view = 'reset';
      history.replaceState(null, '', location.pathname + location.hash);
    }
    // 기록이 바뀔 때마다 저장 예약
    const st = DO.store, set0 = st.set, del0 = st.del;
    st.set = (k, v) => { set0(k, v); scheduleUpload(); };
    st.del = k => { del0(k); scheduleUpload(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else if (user) pull(); });
    addEventListener('pagehide', flush);
    try { await load(); } catch (e) {
      console.error(e);
      setStatus('error', '로그인 기능을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
      return;
    }
    try { await startSession(await aw.account.get()); } catch (e) {
      user = null;
      if (e && e.code === 401) setStatus('signed-out'); else setStatus('error', errorMessage(e));
    }
    if (reset) renderSheet();
  }

  DO.account = { enabled, info: () => ({ status, user: user && { email: user.email, name: user.name }, lastSaved }), open: renderSheet, merge, mergeCareer, load, roomUser };
  init();
})();
