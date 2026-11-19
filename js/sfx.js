// 소리: 파일 없이 WebAudio 로 즉석 합성한다 (file:// 에서도 동작).
//   DO.sfx(name)   효과음. 설정에서 효과음을 끄면 무시.
//   DO.synth       악기 모음 — 모두 (out, t, ...) 꼴이고 out 노드의 context 로 소리를 만든다.
//                  그래서 배경음(music.js)과 효과음이 같이 쓰고, 오프라인 렌더(OfflineAudioContext)에도 그대로 쓸 수 있다.
//   DO.audio       공용 AudioContext 와 버스. 사슬: [효과음 + 잔향] ─┐
//                                                [배경음 + 잔향] → duck ─┴→ 압축기 → 스피커
// 브라우저 정책상 첫 터치/클릭/키 입력 전에는 소리가 안 난다. 그 순간 컨텍스트를 깨우고 onReady 콜백을 부른다.
// 탭이 숨겨지면 컨텍스트를 잠재우고(배터리) 돌아오면 깨운다.

(() => {
  const { store } = DO;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- 컨텍스트별 공용 자원 ----------
  const noiseCache = new WeakMap();
  function noiseBuf(ac) {
    let b = noiseCache.get(ac);
    if (!b) {
      b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); // 1초 흰 잡음
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseCache.set(ac, b);
    }
    return b;
  }
  function reverb(ac, seconds, decay) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const c = ac.createConvolver(); c.buffer = buf; return c;
  }
  // 입력 하나를 "그대로 + 잔향" 으로 버스에 보낸다
  function sendPair(ac, bus, verb, amount) {
    const inp = ac.createGain();
    inp.connect(bus);
    const s = ac.createGain(); s.gain.value = amount;
    inp.connect(s).connect(verb);
    return inp;
  }
  function buses(ac, dest = ac.destination) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    comp.connect(dest);
    const sfx = ac.createGain(); sfx.connect(comp);
    const duck = ac.createGain(); duck.connect(comp);
    const music = ac.createGain(); music.connect(duck);
    const mVerb = reverb(ac, 2.4, 3); mVerb.connect(music);
    const sVerb = reverb(ac, 1.4, 4); sVerb.connect(sfx);
    return { comp, sfx, duck, music, sfxIn: sendPair(ac, sfx, sVerb, 0.22), musicIn: sendPair(ac, music, mVerb, 0.32) };
  }

  // ---------- 악기 ----------
  const osc = (ac, type, f, detune = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune; return o; };
  const gain = (ac, v = 0) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const filt = (ac, type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  // 빠르게 올라갔다가 sus 로 줄고, end 에서 사라지는 봉투
  function env(p, t, { a = 0.005, peak, tau = 0.3, sus = 0, end = null, rel = 0.1 }) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(sus, t + a, tau);
    if (end != null) p.setTargetAtTime(0, Math.max(end, t + a), rel);
  }
  const run = (nodes, t, stop) => nodes.forEach(o => { o.start(t); o.stop(stop); });
  function noiseSrc(ac) { const s = ac.createBufferSource(); s.buffer = noiseBuf(ac); s.loop = true; return s; }

  const synth = {
    mtof,
    // 전자 피아노(로즈 느낌): 사인 + 살짝 어긋난 삼각파 + 맑은 타건음
    keys(out, t, midi, dur, vel = 0.5) {
      const ac = out.context, f = mtof(midi);
      const lp = filt(ac, 'lowpass', 1800 + vel * 1600, 0.3); lp.connect(out);
      const g = gain(ac); g.connect(lp);
      env(g.gain, t, { a: 0.006, peak: 0.085 * vel, tau: 0.5, sus: 0.022 * vel, end: t + dur, rel: 0.16 });
      const b = gain(ac); b.connect(lp);
      env(b.gain, t, { a: 0.002, peak: 0.03 * vel, tau: 0.06 });
      const o1 = osc(ac, 'sine', f), o2 = osc(ac, 'triangle', f, 5), o3 = osc(ac, 'sine', f * 4.01);
      o1.connect(g); o2.connect(g); o3.connect(b);
      run([o1, o2, o3], t, t + dur + 1);
    },
    // 비브라폰: 사인 1·4배음 + 5.5Hz 떨림
    vibe(out, t, midi, dur, vel = 0.5) {
      const ac = out.context, f = mtof(midi);
      const trem = gain(ac, 0.8); trem.connect(out);
      const lfo = osc(ac, 'sine', 5.5), depth = gain(ac, 0.2); lfo.connect(depth).connect(trem.gain);
      const g = gain(ac); g.connect(trem);
      env(g.gain, t, { a: 0.003, peak: 0.09 * vel, tau: 0.7, sus: 0, end: t + dur + 0.4, rel: 0.25 });
      const b = gain(ac); b.connect(trem);
      env(b.gain, t, { a: 0.002, peak: 0.025 * vel, tau: 0.12 });
      const o1 = osc(ac, 'sine', f), o2 = osc(ac, 'sine', f * 4);
      o1.connect(g); o2.connect(b);
      run([o1, o2, lfo], t, t + dur + 1.6);
    },
    // 콘트라베이스 느낌의 뜯는 저음
    bass(out, t, midi, dur, vel = 0.8) {
      const ac = out.context, f = mtof(midi);
      const lp = filt(ac, 'lowpass', 1400, 1.6); lp.connect(out);
      lp.frequency.setValueAtTime(1500, t); lp.frequency.setTargetAtTime(520, t, 0.09);
      const g = gain(ac); g.connect(lp);
      env(g.gain, t, { a: 0.004, peak: 0.2 * vel, tau: 0.3, sus: 0.05 * vel, end: t + dur, rel: 0.06 });
      const o1 = osc(ac, 'triangle', f), o2 = osc(ac, 'sine', f);
      o1.connect(g); o2.connect(g);
      run([o1, o2], t, t + dur + 0.5);
    },
    // 피치카토(현을 손가락으로 튕김)
    pluck(out, t, midi, vel = 0.6) {
      const ac = out.context, f = mtof(midi);
      const lp = filt(ac, 'lowpass', 2600, 0.8); lp.connect(out);
      lp.frequency.setValueAtTime(2600, t); lp.frequency.setTargetAtTime(800, t, 0.07);
      const g = gain(ac); g.connect(lp);
      env(g.gain, t, { a: 0.003, peak: 0.11 * vel, tau: 0.13 });
      const o1 = osc(ac, 'triangle', f), o2 = osc(ac, 'sine', f * 2);
      const g2 = gain(ac, 0.3); o2.connect(g2).connect(g); o1.connect(g);
      run([o1, o2], t, t + 0.9);
    },
    // 라이드 심벌 "칭"
    ride(out, t, vel = 0.5) {
      const ac = out.context;
      const hp = filt(ac, 'highpass', 7000, 0.6); hp.connect(out);
      const g = gain(ac); g.connect(hp);
      env(g.gain, t, { a: 0.001, peak: 0.05 * vel, tau: 0.07 });
      const s = noiseSrc(ac); s.connect(g);
      s.start(t, Math.random() * 0.8); s.stop(t + 0.5);
    },
    // 브러시 스네어 "쉭"
    brush(out, t, vel = 0.5, len = 0.16) {
      const ac = out.context;
      const bp = filt(ac, 'bandpass', 2800, 0.7); bp.connect(out);
      const g = gain(ac); g.connect(bp);
      env(g.gain, t, { a: 0.012, peak: 0.07 * vel, tau: len / 3 });
      const s = noiseSrc(ac); s.connect(g);
      s.start(t, Math.random() * 0.8); s.stop(t + len + 0.4);
    },
    // 시계 초침 "똑·딱"
    tick(out, t, hi = true, vel = 0.5) {
      const ac = out.context;
      const g = gain(ac); g.connect(out);
      env(g.gain, t, { a: 0.001, peak: 0.05 * vel, tau: 0.012 });
      const o = osc(ac, 'sine', hi ? 2100 : 1600); o.connect(g);
      run([o], t, t + 0.12);
    },
    // 현악 패드: 톱니파 두 개를 살짝 어긋나게 + 저역 통과
    pad(out, t, midis, dur, vel = 0.5) {
      const ac = out.context;
      const lp = filt(ac, 'lowpass', 650 + vel * 500, 0.5); lp.connect(out);
      const g = gain(ac); g.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02 * vel, t + 0.9);
      g.gain.setTargetAtTime(0, t + dur - 0.2, 0.45);
      const os = midis.flatMap(m => [osc(ac, 'sawtooth', mtof(m), -7), osc(ac, 'sawtooth', mtof(m), 7)]);
      os.forEach(o => o.connect(g));
      run(os, t, t + dur + 2.5);
    },
    // 심장 박동 "쿵-쿵"
    heart(out, t, vel = 0.7) {
      const ac = out.context;
      [[0, 0.24], [0.2, 0.15]].forEach(([dt, pk]) => {
        const g = gain(ac); g.connect(out);
        env(g.gain, t + dt, { a: 0.006, peak: pk * vel, tau: 0.07 });
        const o = osc(ac, 'sine', 64); o.frequency.setValueAtTime(64, t + dt); o.frequency.exponentialRampToValueAtTime(40, t + dt + 0.16);
        o.connect(g); run([o], t + dt, t + dt + 0.45);
      });
    },
    // 낮게 깔리는 웅웅거림 (필터가 천천히 열렸다 닫힘)
    drone(out, t, dur, midis, vel = 0.5) {
      const ac = out.context;
      const lp = filt(ac, 'lowpass', 240, 2); lp.connect(out);
      const lfo = osc(ac, 'sine', 0.18), amt = gain(ac, 90); lfo.connect(amt).connect(lp.frequency);
      const g = gain(ac); g.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045 * vel, t + 1.2);
      g.gain.setTargetAtTime(0, t + dur - 0.3, 0.5);
      const os = midis.flatMap(m => [osc(ac, 'sawtooth', mtof(m), -5), osc(ac, 'sawtooth', mtof(m), 5)]);
      os.forEach(o => o.connect(g));
      run([...os, lfo], t, t + dur + 2.5);
    },
    // 높은 음이 파르르 떨림 (불안한 현악)
    trem(out, t, dur, midi, vel = 0.5) {
      const ac = out.context, f = mtof(midi);
      const tg = gain(ac, 0.5); // 떨림: 0~1 사이를 오간다
      const lfo = osc(ac, 'sine', 6.5), depth = gain(ac, 0.5); lfo.connect(depth).connect(tg.gain);
      const g = gain(ac); tg.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.016 * vel, t + 0.8);
      g.gain.setTargetAtTime(0, t + dur - 0.2, 0.4);
      const o1 = osc(ac, 'sine', f), o2 = osc(ac, 'triangle', f, 6);
      const half = gain(ac, 0.4); o2.connect(half).connect(tg); o1.connect(tg);
      run([o1, o2, lfo], t, t + dur + 2);
    },
    // 금관 느낌의 짧은 화음 (톱니파 + 필터가 열렸다 닫힘)
    brass(out, t, midis, dur, vel = 0.6) {
      const ac = out.context;
      const lp = filt(ac, 'lowpass', 400, 1.2); lp.connect(out);
      lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1400 + vel * 900, t + 0.05);
      lp.frequency.setTargetAtTime(600, t + 0.06, dur * 0.5);
      const g = gain(ac); g.connect(lp);
      env(g.gain, t, { a: 0.02, peak: 0.07 * vel, tau: dur * 0.6, sus: 0.03 * vel, end: t + dur, rel: 0.12 });
      const os = midis.flatMap(m => [osc(ac, 'sawtooth', mtof(m), -6), osc(ac, 'sawtooth', mtof(m), 6)]);
      os.forEach(o => o.connect(g));
      run(os, t, t + dur + 0.8);
    },
    // 잡음 한 줌 (바스락·휙)
    hiss(out, t, len, { from = 2000, to = from, q = 0.8, peak = 0.05, a = 0.01 } = {}) {
      const ac = out.context;
      const bp = filt(ac, 'bandpass', from, q); bp.connect(out);
      bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + len);
      const g = gain(ac); g.connect(bp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, len / 3);
      const s = noiseSrc(ac); s.connect(g);
      s.start(t, Math.random() * 0.8); s.stop(t + len + 0.3);
    },
    // 단순한 음 하나 (클릭음 등)
    beep(out, t, f, dur, { type = 'sine', peak = 0.05, to = null } = {}) {
      const ac = out.context;
      const g = gain(ac); g.connect(out);
      env(g.gain, t, { a: 0.006, peak, tau: dur / 3 });
      const o = osc(ac, type, f); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      o.connect(g); run([o], t, t + dur + 0.1);
    },
  };

  // ---------- 효과음 (out = 효과음 버스 입력, t = 시작 시각) ----------
  const S = synth;
  const SOUNDS = {
    tap: (o, t) => S.beep(o, t, 520, 0.05, { type: 'triangle', peak: 0.075 }),
    tick: (o, t) => S.beep(o, t, 1100, 0.035, { type: 'square', peak: 0.05 }),
    paper: (o, t) => { S.hiss(o, t, 0.16, { from: 3200, to: 1800, q: 0.5, peak: 0.13 }); S.hiss(o, t + 0.07, 0.1, { from: 2400, q: 0.6, peak: 0.08 }); },
    reveal: (o, t) => { S.hiss(o, t, 0.12, { from: 3200, q: 0.6, peak: 0.035 }); S.vibe(o, t + 0.05, 76, 0.4, 0.55); S.vibe(o, t + 0.13, 83, 0.6, 0.45); },
    stamp: (o, t) => { S.beep(o, t, 140, 0.2, { peak: 0.22, to: 55 }); S.hiss(o, t, 0.09, { from: 420, q: 0.4, peak: 0.1 }); },
    good: (o, t) => { S.keys(o, t, 72, 0.25, 0.7); S.keys(o, t + 0.09, 76, 0.25, 0.7); S.keys(o, t + 0.18, 79, 0.6, 0.75); S.keys(o, t + 0.18, 84, 0.6, 0.5); },
    bad: (o, t) => { S.brass(o, t, [50, 53], 0.2, 0.75); S.brass(o, t + 0.18, [49, 52], 0.42, 0.7); },
    // 폰 넘기기: 휙
    whoosh: (o, t) => S.hiss(o, t, 0.38, { from: 380, to: 2600, q: 1.2, peak: 0.16, a: 0.16 }),
    // 뒤지기: 바스락바스락
    rummage: (o, t) => [0, 0.09, 0.2, 0.27].forEach((d, i) => S.hiss(o, t + d + Math.random() * 0.03, 0.07, { from: 1400 + Math.random() * 2200, q: 0.7, peak: 0.12 - i * 0.015 })),
    // 자물쇠가 풀림: 철컥 + 맑은 종소리
    unlock: (o, t) => { S.beep(o, t, 2400, 0.03, { type: 'square', peak: 0.03 }); S.beep(o, t + 0.07, 1800, 0.04, { type: 'square', peak: 0.035 }); S.vibe(o, t + 0.16, 79, 0.5, 0.6); S.vibe(o, t + 0.24, 84, 0.9, 0.6); },
    // 예/아니요 판정 (이마 게임 자동 답변)
    yes: (o, t) => { S.pluck(o, t, 72, 0.6); S.pluck(o, t + 0.1, 79, 0.7); },
    no: (o, t) => { S.pluck(o, t, 67, 0.6); S.pluck(o, t + 0.12, 61, 0.55); },
    // 큰 승리: 올라가는 펼침화음 → 밝은 화음 + 심벌
    fanfare: (o, t) => {
      [60, 64, 67, 72].forEach((m, i) => S.keys(o, t + i * 0.075, m, 0.3, 0.75));
      [60, 64, 67, 71, 74].forEach(m => S.keys(o, t + 0.32, m, 1.5, 0.7));
      S.brass(o, t + 0.32, [48, 55, 64], 0.9, 0.45);
      S.bass(o, t + 0.32, 36, 1.2, 0.7);
      S.hiss(o, t + 0.3, 1.2, { from: 7000, to: 5000, q: 0.4, peak: 0.035, a: 0.005 });
      [84, 88, 91].forEach((m, i) => S.vibe(o, t + 0.55 + i * 0.07, m, 0.5, 0.35));
    },
    // 미제: "둥, 둥, 두웅—"
    lose: (o, t) => {
      S.brass(o, t, [43, 55], 0.22, 0.7); S.heart(o, t, 0.6);
      S.brass(o, t + 0.3, [42, 54], 0.22, 0.7);
      S.brass(o, t + 0.62, [41, 53, 56, 59], 1.5, 0.75); S.heart(o, t + 0.62, 0.9);
      S.drone(o, t + 0.62, 1.8, [29, 36], 0.7);
    },
  };
  const BIG = { fanfare: 2.4, lose: 2.4, good: 0.8, bad: 0.7, unlock: 0.9 }; // 배경음을 잠깐 줄일 시간(초)

  // ---------- 실시간 컨텍스트 ----------
  let A = null;           // { ac, ...buses }
  let ready = false;      // 사용자 입력으로 한 번이라도 깨어났는가
  const readyCbs = [];
  function get() { return A; }
  function markReady() {
    if (ready || !A || A.ac.state !== 'running') return;
    ready = true;
    readyCbs.forEach(f => { try { f(); } catch { /* ignore */ } });
  }
  function ensure() {
    if (!A) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      let ac;
      try { ac = new AC({ latencyHint: 'interactive' }); } catch { return null; }
      A = { ac, ...buses(ac) };
      ac.addEventListener('statechange', markReady);
    }
    return A;
  }
  function wake() {
    const a = ensure();
    if (!a) return a;
    // 터치 중에 만들어지면 처음부터 running 일 수 있다 (그땐 statechange 가 안 온다)
    if (a.ac.state === 'running') markReady();
    else if (a.ac.state === 'suspended' && !document.hidden) a.ac.resume().then(markReady, () => {});
    return a;
  }
  // 첫 사용자 입력에서 깨운다 (자동 클릭 같은 가짜 이벤트로는 안 깨움)
  const unlock = e => { if (e.isTrusted) wake(); }; // 사파리는 입력 처리 안에서 바로 깨워야 한다 (setTimeout 금지)
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, true));
  document.addEventListener('visibilitychange', () => {
    if (!A) return;
    if (document.hidden) A.ac.suspend().catch(() => {});
    else if (ready) A.ac.resume().catch(() => {});
  });

  function duck(sec) {
    if (!A || !sec) return;
    const p = A.duck.gain, now = A.ac.currentTime;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(0.22, now, 0.04);
    p.setTargetAtTime(1, now + sec, 0.45);
  }

  let sfxOn = store.get('sound', true);
  DO.sfx = name => {
    if (!sfxOn || !SOUNDS[name]) return;
    const a = wake();
    if (!a || a.ac.state === 'closed') return;
    try { SOUNDS[name](a.sfxIn, a.ac.currentTime + 0.01); duck(BIG[name]); } catch { /* 소리는 없어도 게임은 계속 */ }
  };
  DO.sound = {
    get on() { return sfxOn; },
    set(v) { sfxOn = !!v; store.set('sound', sfxOn); },
  };
  DO.synth = synth;
  DO.audio = {
    get, wake, buses, duck, SOUNDS,
    get ready() { return ready; },
    onReady(f) { if (ready) f(); else readyCbs.push(f); },
    // 개발용: 효과음 하나를 오프라인으로 렌더 → AudioBuffer
    renderSfx(name, seconds = 3) {
      const oac = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
      const b = buses(oac);
      SOUNDS[name](b.sfxIn, 0.02);
      return oac.startRendering();
    },
  };

  // 모든 버튼에 가벼운 클릭음 (헤더 소리 버튼과 data-quiet 버튼은 제외)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (b && b.id !== 'sound' && !b.closest('.sound-pop') && !b.disabled && !b.dataset.quiet) DO.sfx('tap');
  }, true);
})();
