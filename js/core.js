// 공통 코어: 모드 레지스트리 + 사건 레지스트리 + DOM 헬퍼 + 시드 난수 + 공용 UI
// 모든 모드는 여기에 등록되고, 사건을 ctx.case로 받는다.

window.DO = (() => {
  const modes = [];
  const cases = {};

  function registerMode(mode) {
    // mode: { id, name, desc, ready(bool), start(root, ctx) }
    modes.push(mode);
  }

  // 사건은 data/cases/*.js 에서 DO.registerCase({...}) 로 등록한다.
  // (fetch 를 쓰지 않으므로 index.html 을 file:// 로 열어도 동작)
  function registerCase(c) {
    if (!c || !c.id) throw new Error('사건에 id가 없습니다');
    cases[c.id] = c;
  }
  function listCases() { return Object.values(cases); }
  function getCase(id) { return cases[id] || null; }

  // 레거시: JSON 파일을 fetch 로 읽는 경로 (서버로 띄웠을 때만 동작)
  async function loadCase(id = 'case-001') {
    if (cases[id]) return cases[id];
    const res = await fetch(`data/cases/${id}.json`);
    if (!res.ok) throw new Error('사건 파일 로드 실패: ' + id);
    const c = await res.json();
    registerCase(c);
    return c;
  }

  // 아주 작은 DOM 헬퍼
  //  - 값이 null/undefined/false 인 속성은 건너뜀 (disabled 등 불린 속성용)
  //  - true 는 빈 문자열 속성으로
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(c));
    }
    return el;
  }

  function render(root, ...nodes) {
    root.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));
  }

  // 시드 난수 (mulberry32). 같은 시드 → 같은 수열. 일일 사건 생성기에 사용.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffle(arr, random = Math.random) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, random = Math.random) {
    return arr[Math.floor(random() * arr.length)];
  }

  // localStorage 래퍼 (사생활 모드 등에서 실패해도 앱이 죽지 않게)
  // get 은 기본값과 종류가 다른 값(예전 버전이 남긴 값, 깨진 JSON 등)이면 기본값을 돌려준다.
  // 기본값이 null 이면 종류를 따지지 않으니, 그런 곳은 읽은 뒤 직접 검사할 것.
  function sameKind(x, f) {
    if (f == null) return true;
    if (Array.isArray(f)) return Array.isArray(x);
    if (typeof f === 'number') return typeof x === 'number' && Number.isFinite(x);
    if (typeof f === 'object') return x != null && typeof x === 'object' && !Array.isArray(x);
    return typeof x === typeof f;
  }
  const store = {
    get(k, fallback = null) {
      try {
        const v = localStorage.getItem('do:' + k);
        if (v == null) return fallback;
        const x = JSON.parse(v);
        return sameKind(x, fallback) ? x : fallback;
      } catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem('do:' + k, JSON.stringify(v)); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem('do:' + k); } catch { /* ignore */ } },
  };

  // 조건 태그 → 사람이 읽는 문장
  function tagText(C, tag) {
    const c = C.conditions.find(c => c.tag === tag);
    return c ? c.text : tag;
  }

  // ---------- 공용 UI: 플레이어 이름 입력 ----------
  // opts: { min, max, title, intro, note, onStart(names) }
  function nameEntry(root, opts) {
    const names = [...new Set(store.get('lastNames', [])
      .filter(n => typeof n === 'string' && n.trim()).map(n => n.trim().slice(0, 12)))].slice(0, opts.max);
    const list = h('div');
    const input = h('input', { placeholder: '플레이어 이름', maxlength: 12, autocomplete: 'off' });
    const redraw = () => render(list, names.map((n, i) =>
      h('div', { class: 'row' },
        h('span', { class: 'grow' }, `${i + 1}. ${n}`),
        h('button', { class: 'small', onClick: () => { names.splice(i, 1); redraw(); } }, '삭제'))
    ));
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      if (names.length >= opts.max) return DO.toast(`최대 ${opts.max}명까지 가능합니다.`);
      if (names.includes(v)) return DO.toast('같은 이름이 이미 있습니다.');
      names.push(v); input.value = ''; redraw(); input.focus();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    redraw();

    render(root,
      opts.title ? h('h2', {}, opts.title) : null,
      opts.intro ? h('p', { class: 'muted' }, opts.intro) : null,
      h('div', { class: 'card' },
        h('p', { class: 'muted' }, opts.note || `플레이어 ${opts.min}~${opts.max}명. 폰 하나를 돌려가며 합니다.`),
        h('div', { class: 'row' }, input, h('button', { class: 'small', onClick: add }, '+ 추가')),
        list,
      ),
      h('button', { class: 'primary', onClick: () => {
        if (names.length < opts.min) return DO.toast(`${opts.min}명 이상 필요합니다.`);
        store.set('lastNames', names);
        opts.onStart([...names]);
      } }, '시작'),
    );
  }

  // ---------- 공용 UI: "폰을 넘기세요" 가림막 ----------
  // 다음 사람에게 폰을 넘길 때 화면을 가려서 직전 사람의 비밀이 보이지 않게 한다.
  function handOff(root, who, message, next) {
    render(root,
      h('div', { class: 'center handoff' },
        h('div', { class: 'big' }, '📱'),
        h('h2', {}, `${who}님에게 폰을 넘기세요`),
        h('p', { class: 'muted' }, message || '본인이 맞으면 아래 버튼을 누르세요.'),
        h('button', { class: 'primary', onClick: next }, `${who} 입니다`),
      ),
    );
    if (DO.sfx) DO.sfx('whoosh');
    if (DO.music) DO.music.hold('hush'); // 폰을 넘기는 동안 배경음이 벽 너머처럼 먹먹해진다
  }

  // 조사 붙이기: josa('아빠', '이/가') → '아빠가', josa('도서부', '은/는') → '도서부는', josa('교실', '으로/로') → '교실로'.
  // 끝의 괄호·공백은 건너뛰고 마지막 한글(또는 숫자)의 받침을 본다. 판단할 수 없으면(영문 등) '이(가)' 꼴로.
  const NUM_BATCHIM = { 0: 21, 1: 8, 2: 0, 3: 16, 4: 0, 5: 0, 6: 1, 7: 8, 8: 8, 9: 0 };   // 영 일 이 삼 사 오 육 칠 팔 구
  function josa(word, pair) {
    const w = String(word);
    const [a, b] = pair.split('/');
    const m = w.match(/([가-힣0-9])[^가-힣0-9]*$/);
    if (!m) return `${w}${a}(${b})`;
    const ch = m[1];
    const jong = /[0-9]/.test(ch) ? NUM_BATCHIM[ch] : (ch.charCodeAt(0) - 0xAC00) % 28;
    if (a === '으로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
    return w + (jong ? a : b);
  }

  return {
    modes, registerMode, registerCase, listCases, getCase, loadCase,
    h, render, shuffle, pick, rng, hashString, store, tagText, nameEntry, handOff, josa,
  };
})();
