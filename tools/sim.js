// 자동 플레이 시뮬레이터 (개발용, 앱에서는 로드하지 않는다)
// 브라우저에서 앱을 연 상태로 콘솔에 붙여 넣거나 <script src="tools/sim.js"> 를 주입한 뒤:
//   await SIM.run({ modes: ['fold', 'alibi'], games: 20, steps: 400 })
// 모드마다 무작위 사건으로 여러 판을 "아무 버튼이나 누르는 플레이어"처럼 끝까지 진행하면서
//   - JS 오류 / 처리 안 된 Promise 거부 / console.error
//   - 화면 글자에 undefined · NaN · null · [object Object]
//   - 가로 넘침(폰에서 옆으로 밀리는 화면), 버튼 없는 막다른 화면, 빈 화면
//   - 결과 화면까지 도달했는지
// 를 모은다. AI 심문은 fetch 를 가짜 SSE 응답으로 바꿔서(가끔 오류·거절 섞음) 돈다.
// alert/confirm 은 막아 두고(confirm 은 무작위 예/아니오) 내용만 기록한다.
// junk: true 면 판마다 localStorage 에 엉뚱한 값을 넣고 시작한다. 결과는 SIM.report, 진행은 SIM.progress.

(() => {
  const root = document.getElementById('root');
  const overlay = document.getElementById('overlay');
  // ms = 0 이면 MessageChannel 로 양보한다 (숨겨진 탭에서 setTimeout 이 1초로 늘어지는 것을 피함)
  const ch = new MessageChannel(); const q = [];
  ch.port1.onmessage = () => { const r = q.shift(); r && r(); };
  const sleep = ms => new Promise(r => { if (ms) setTimeout(r, ms); else { q.push(r); ch.port2.postMessage(0); } });
  const NAMES = ['민지', '하준', '서연', '도윤', '지우', '예준'];
  const BAD_TEXT = /undefined|NaN|\[object |(^|[^a-z])null([^a-z]|$)/;

  const S = {
    errors: [], alerts: [], confirms: 0, rand: Math.random, waitRate: 0.1, progress: '',
    report: null,
  };

  window.addEventListener('error', e => S.errors.push(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', e => S.errors.push('Promise: ' + (e.reason && e.reason.message || e.reason)));
  const origErr = console.error;
  console.error = (...a) => { S.errors.push('console.error: ' + a.map(x => x && x.message || String(x)).join(' ')); origErr.apply(console, a); };
  window.alert = m => { S.alerts.push(String(m)); };
  if (DO.toast) { const t = DO.toast; DO.toast = m => { S.alerts.push(String(m)); t(m); }; }
  window.confirm = m => { S.confirms++; return S.rand() < 0.7; };

  // ---- AI 심문용 가짜 API ----
  const realFetch = window.fetch.bind(window);
  const LINES = ['그날은 집에 있었어요.', '저는 아무것도 몰라요!', '음… 기억이 잘 안 나네요.', '그 사람이 수상했어요.'];
  window.fetch = async (url, opts) => {
    if (!String(url).includes('api.anthropic.com')) return realFetch(url, opts);
    await sleep(5);
    const r = S.rand();
    if (r < 0.08) return new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529 });
    if (r < 0.11) return new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 });
    const body = JSON.parse(opts.body || '{}');
    const refusal = r < 0.15;
    const text = LINES[Math.floor(S.rand() * LINES.length)];
    if (!body.stream) {
      return new Response(JSON.stringify({ content: refusal ? [] : [{ type: 'text', text }], stop_reason: refusal ? 'refusal' : 'end_turn' }), { status: 200 });
    }
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    const chunks = [ev({ type: 'message_start', message: {} })];
    if (!refusal) for (const part of text.match(/.{1,4}/g)) chunks.push(ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: part } }));
    chunks.push(ev({ type: 'message_delta', delta: { stop_reason: refusal ? 'refusal' : 'end_turn' } }));
    chunks.push(ev({ type: 'message_stop' }));
    // 일부러 줄 중간에서 끊어 보낸다 (파서가 조각난 줄을 잇는지)
    const all = new TextEncoder().encode(chunks.join(''));
    const stream = new ReadableStream({
      start(c) { for (let i = 0; i < all.length; i += 37) c.enqueue(all.slice(i, i + 37)); c.close(); },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };

  // ---- 화면 읽기 ----
  const shown = el => el.getClientRects().length > 0 && !el.closest('[hidden]');
  const scope = () => (!overlay.hidden ? overlay : root);
  const buttons = () => [...scope().querySelectorAll('button')].filter(b => !b.disabled && shown(b));
  const inputs = () => [...scope().querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea')].filter(i => shown(i) && !i.disabled && !i.readOnly);
  const label = b => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const isEnd = () => buttons().some(b => /처음으로|홈으로/.test(label(b))) || !!root.querySelector('.stamp');

  function fill(inp) {
    const ph = inp.placeholder || '';
    let v;
    if (/이름/.test(ph)) {
      const have = root.innerText;
      v = NAMES.find(n => !have.includes(n)) || NAMES[Math.floor(S.rand() * NAMES.length)];
    } else if (/sk-ant/.test(ph) || inp.type === 'password') v = 'sk-ant-sim-test';
    else if (inp.type === 'number' || /번호|숫자|\d/.test(ph) || inp.inputMode === 'numeric') v = String(Math.floor(S.rand() * 1000));
    else v = ['어제 밤 어디 있었나요?', '그 사람 봤어요?', '거짓말이죠?'][Math.floor(S.rand() * 3)];
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    // 이름 입력처럼 Enter 로 추가하는 곳
    if (S.rand() < 0.5) inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  function weight(b) {
    const t = label(b);
    if (/처음으로|홈으로/.test(t)) return 0.4;          // 결과 화면에서는 조금 더 둘러보다 나간다
    if (/설명|❓/.test(t)) return 0.15;
    if (/삭제|지우기/.test(t)) return 0.3;
    if (b.classList.contains('primary')) return 3;
    return 1;
  }
  function choose(list) {
    const ws = list.map(weight), sum = ws.reduce((a, b) => a + b, 0);
    let r = S.rand() * sum;
    for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  function checkScreen(ctx) {
    const issues = [];
    const text = root.innerText;
    const m = text.match(BAD_TEXT);
    if (m) {
      const at = text.indexOf(m[0]);
      issues.push(`이상한 글자 "${m[0].trim()}": …${text.slice(Math.max(0, at - 30), at + 30).replace(/\s+/g, ' ')}…`);
    }
    // 가로 넘침: body 가 overflow-x: clip 이라 스크롤은 안 생기지만 잘려 보인다. 가로 스크롤 줄 안쪽과 애니메이션 중인 것은 뺀다.
    const cw = document.documentElement.clientWidth;
    const animating = e => { for (let x = e; x && x !== root; x = x.parentElement) if (x.getAnimations().some(a => a.playState === 'running')) return true; return false; };
    const wide = [...root.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return (r.right > cw + 1 || r.left < -1) && r.width > 0 && !e.closest('.chips, .cards, .lineup, .suspect-tabs, .shots, .tl-wrap') && !animating(e);
    });
    if (wide.length) issues.push(`가로 넘침(${cw}px): ` + wide.slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ` "${(e.textContent || '').trim().slice(0, 12)}"`).join(', '));
    if (!root.children.length) issues.push('빈 화면');
    if (document.querySelectorAll('.fx-confetti').length > 1) issues.push('꽃가루 캔버스가 쌓임');
    if (document.querySelectorAll('.toast').length > 1) issues.push('쪽지가 여러 개');
    // 배경음: 화면에 붙은 분위기가 화면과 맞는지 (지목 화면 = suspense, 결과 화면 = result)
    if (DO.music && DO.music.on) {
      const m = DO.music.mood, h2 = (root.querySelector('h2') || {}).textContent || '';
      if (m === 'suspense' && !/지목|거짓말쟁이는|범인은|정답|답$/.test(h2)) issues.push(`배경음 suspense 인데 화면은 "${h2.slice(0, 16)}"`);
      if (m === 'hush' && !root.querySelector('.handoff')) issues.push(`배경음이 먹먹(hush)한데 폰 넘기기 화면이 아님: "${h2.slice(0, 16)}"`);
      if ((m === 'victory' || m === 'defeat') && !isEnd()) issues.push(`배경음 ${m} 인데 결과 화면이 아님`);
    }
    return issues;
  }

  async function startMode(id) {
    S.alerts.length = 0;
    DO.closeSheet && DO.closeSheet();
    DO.goHome();
    const mode = DO.modes.find(m => m.id === id);
    const card = [...root.querySelectorAll('.mode-card')].find(c => c.querySelector('h3').textContent.startsWith(mode.name));
    card.querySelector('button.primary').click();
    await sleep(0);
    const cases = [...root.querySelectorAll('button.mode')];
    if (cases.length) choose(cases.map(c => c)).click();
    await sleep(0);
  }

  async function game(id, maxSteps) {
    await startMode(id);
    const seen = new Set(), issues = [];
    let steps = 0, ended = false, stuck = false, lastClicks = [];
    for (; steps < maxSteps; steps++) {
      await sleep(S.rand() < S.waitRate ? 30 : 0);
      for (const i of checkScreen()) if (!seen.has(i)) { seen.add(i); issues.push(`[${steps}] ${i}`); }
      if (isEnd()) ended = true;
      const empties = inputs().filter(i => !i.value);
      if (empties.length && S.rand() < 0.6) { fill(empties[0]); continue; }
      const bs = buttons();
      if (!bs.length) {
        // 스트리밍/타이머 대기일 수 있다
        await sleep(60);
        if (!buttons().length) { stuck = true; issues.push(`[${steps}] 누를 버튼 없음: ${root.innerText.slice(0, 80).replace(/\s+/g, ' ')}`); break; }
        continue;
      }
      const b = choose(bs);
      lastClicks.push(label(b)); if (lastClicks.length > 6) lastClicks.shift();
      if (ended && /처음으로|홈으로/.test(label(b))) { b.click(); break; }
      try { b.click(); } catch (e) { issues.push(`[${steps}] 클릭 중 예외 ${e.message}`); }
    }
    return { steps, ended, stuck, issues, lastClicks };
  }

  // 저장소에 엉뚱한 값이 들어 있어도 버티는지 (예전 버전이 남긴 값, 손으로 고친 값, 반쯤 쓰다 만 값)
  const JUNK = [null, 'abc', -3, 99, 1.5, [], {}, [1, 2], { used: 'x' }, '', true, ['', '', '', '', '', '', '', '', '']];
  function corrupt() {
    const keys = ['alibi:level', 'budget', 'lastNames', 'caseFilter', 'model', 'sound', 'apiKey', 'music', 'musicVol'];
    for (const c of DO.listCases()) keys.push('alibi:v:' + c.id, 'ai:' + c.id, 'ai:done:' + c.id, `alibi:best:${c.id}:0`);
    for (const k of keys) if (S.rand() < 0.5) DO.store.set(k, JUNK[Math.floor(S.rand() * JUNK.length)]);
    if (S.rand() < 0.2) localStorage.setItem('do:lastNames', '{broken json');
  }

  S.run = async ({ modes = DO.modes.map(m => m.id), games = 10, steps = 400, seed = null, junk = false } = {}) => {
    if (seed != null) S.rand = DO.rng(seed);
    const report = {};
    for (const id of modes) {
      const r = report[id] = { games: 0, ended: 0, stuck: 0, avgSteps: 0, issues: {}, errors: [], alerts: {} };
      for (let g = 0; g < games; g++) {
        S.errors.length = 0;
        S.progress = `${id} ${g + 1}/${games}`;
        if (junk) corrupt();
        let res;
        try { res = await game(id, steps); }
        catch (e) { res = { steps: 0, ended: false, stuck: true, issues: ['시뮬레이터 예외: ' + e.message], lastClicks: [] }; }
        r.games++; r.avgSteps += res.steps;
        if (res.ended) r.ended++;
        if (res.stuck) r.stuck++;
        for (const i of res.issues) { const k = i.replace(/^\[\d+\] /, ''); r.issues[k] = (r.issues[k] || 0) + 1; }
        for (const e of S.errors) r.errors.push(e + ' ← ' + res.lastClicks.join(' › '));
        for (const a of S.alerts) r.alerts[a] = (r.alerts[a] || 0) + 1;
      }
      r.avgSteps = Math.round(r.avgSteps / r.games);
      r.errors = [...new Set(r.errors)].slice(0, 10);
    }
    DO.closeSheet && DO.closeSheet();
    DO.goHome();
    S.report = report;
    return report;
  };

  window.SIM = S;
})();
