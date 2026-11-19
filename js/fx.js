// 가벼운 화면 효과. 파일·라이브러리 없이 캔버스와 CSS 클래스로만.
//   DO.fx.ending(win)    결과 화면에서: 배경음을 결과 분위기로 + 승리면 win(), 아니면 '미제' 소리와 흔들기
//   DO.fx.win()          맞혔을 때: 양쪽 아래에서 종이 꽃가루 + 팡파르
//   DO.fx.good(el)       작은 성공: el(없으면 초록 카드)이 톡 튀어나오기 + 'good' 소리
//   DO.fx.fail(el)       틀렸을 때: el(없으면 화면의 빨간 카드)을 좌우로 흔들기 + 'bad' 소리
//   DO.fx.confetti()     꽃가루만
//   DO.fx.shake(el) / DO.fx.pop(el)   CSS 한 번 재생
//   DO.fx.count(el, to)  숫자를 0 → to 로 세어 올리기
//   DO.toast(msg)        alert 대신 화면 아래 잠깐 뜨는 쪽지
// 움직임 줄이기(prefers-reduced-motion) 설정이면 꽃가루·흔들기·세기를 생략한다.

(() => {
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sfx = n => { if (DO.sfx) DO.sfx(n); };
  // 스티커북 팔레트(style.css 토큰과 같은 색) + 종이 흰색
  const COLORS = ['#e2533f', '#f6cb5c', '#3f73c4', '#3a9a6a', '#8a5cc8', '#fffaf0'];
  const INK = '#25283a';

  let stopConfetti = null; // 한 번에 한 판만: 새로 터뜨리면 이전 것은 치운다
  // 속도·각도는 node 로 궤적을 돌려 맞췄다(812px 화면 기준 꼭대기가 위에서 150~390px, 반대편 가장자리 근처까지 퍼짐).
  function confetti({ count = 64, duration = 2400 } = {}) {
    if (reduced()) return;
    if (stopConfetti) stopConfetti();
    const W = innerWidth, H = innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.className = 'fx-confetti';
    cv.width = W * dpr; cv.height = H * dpr;
    document.body.append(cv);
    const g = cv.getContext('2d');
    if (!g) return cv.remove();
    g.scale(dpr, dpr);

    // 양쪽 아래 모서리에서 대각선 위로 쏘아 올린다. 화면 높이에 맞춰 세기를 조절(높이 ∝ 속도²).
    const k = Math.max(0.8, Math.min(1.3, Math.sqrt(H / 812)));
    const parts = Array.from({ length: count }, (_, i) => {
      const left = i % 2 === 0;
      const speed = (19 + Math.random() * 9) * k;
      const ang = 0.15 + Math.random() * 0.35; // 수직에서 안쪽으로 기운 정도(라디안)
      return {
        x: left ? -8 : W + 8, y: H * (0.78 + Math.random() * 0.15),
        vx: (left ? 1 : -1) * Math.sin(ang) * speed * Math.min(1.6, W / 420),
        vy: -Math.cos(ang) * speed,
        w: 6 + Math.random() * 5, h: 9 + Math.random() * 6,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
        flip: Math.random() * 6.28, vf: 0.12 + Math.random() * 0.12,
        c: COLORS[i % COLORS.length],
      };
    });

    const t0 = performance.now();
    let last = t0, done = false;
    const end = () => { if (!done) { done = true; cv.remove(); if (stopConfetti === end) stopConfetti = null; } };
    stopConfetti = end;
    setTimeout(end, duration + 600); // 탭이 숨겨져 rAF 가 멈춰도 남지 않게
    function frame(now) {
      if (done) return;
      const dt = Math.min(2.5, (now - last) / 16.7); last = now;
      const life = (now - t0) / duration;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = life > 0.7 ? Math.max(0, (1 - life) / 0.3) : 1;
      for (const p of parts) {
        p.vy += 0.36 * dt;
        p.vx *= Math.pow(0.975, dt); p.vy *= Math.pow(0.985, dt);
        if (p.vy > 3.2) p.vy = 3.2; // 종이는 천천히 떨어진다
        p.x += p.vx * dt + Math.sin(p.flip) * 0.6; p.y += p.vy * dt;
        p.r += p.vr * dt; p.flip += p.vf * dt;
        g.save();
        g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.flip));
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.lineWidth = 1.2; g.strokeStyle = INK; g.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      if (life < 1) requestAnimationFrame(frame); else end();
    }
    requestAnimationFrame(frame);
  }

  // CSS 애니메이션 클래스를 한 번 다시 재생
  function replay(el, cls) {
    if (!el || reduced()) return;
    el.classList.remove(cls);
    void el.offsetWidth; // 리플로우로 애니메이션 리셋
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }
  const shake = el => replay(el, 'fx-shake');
  const pop = el => replay(el, 'fx-pop');

  function count(el, to, ms = 700) {
    if (!el) return;
    if (reduced() || !(to > 0)) { el.textContent = String(to); return; }
    const t0 = performance.now();
    el.textContent = '0';
    let lastTen = 0;
    const step = now => {
      if (!el.isConnected) return;
      const k = Math.min(1, (now - t0) / ms);
      const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = String(v);
      if (Math.floor(v / 10) > lastTen) { lastTen = Math.floor(v / 10); sfx('coin', { step: Math.round(12 * v / to) }); } // 10점마다 딩, 갈수록 높게
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = String(to); }, ms + 400);
  }

  function win() { sfx('fanfare'); sfx('pop'); confetti(); }
  // 작은 성공(한 사람이 맞힘, 상자가 열림): 꽃가루 없이 톡 튀어나오기만. sound 로 소리를 바꿀 수 있다.
  function good(el, sound = 'good') { sfx(sound); pop(el || document.querySelector('#root .card.good') || document.querySelector('#root h2')); }
  function fail(el, sound = 'bad') {
    sfx(sound);
    shake(el || document.querySelector('#root .card.alert') || document.querySelector('#root h2'));
  }
  // 게임이 끝난 결과 화면: render 직후에 부른다. 배경음을 결과 분위기로 바꾸고(화면에 붙음),
  // delay 뒤에 승리면 팡파르+꽃가루, 아니면 "둥 둥 두웅" + 흔들기.
  function ending(isWin, { delay = 0 } = {}) {
    if (DO.music) DO.music.hold(isWin ? 'victory' : 'defeat');
    const go = () => (isWin ? win() : fail(null, 'lose'));
    if (delay) setTimeout(go, delay); else go();
  }

  // 비밀 카드가 펼쳐질 때(CSS cardFlip) 종이 소리
  document.addEventListener('animationstart', e => { if (e.animationName === 'cardFlip') sfx('paper'); });

  // alert() 대신 쓰는 쪽지. 같은 말을 연달아 누르면 새로 띄우지 않고 흔들기만 한다.
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.append(toastEl);
    }
    if (toastEl.classList.contains('show') && toastEl.textContent === msg) shake(toastEl);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    sfx('tick');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  DO.fx = { confetti, shake, pop, count, win, good, fail, ending };
  DO.toast = toast;
})();
