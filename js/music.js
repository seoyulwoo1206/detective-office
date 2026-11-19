// 배경음: 상황(분위기)에 맞춰 즉석 합성한 곡을 깐다. 파일 없음.
//   분위기    lobby     홈·사건 고르기   — 느긋한 탐정 사무소 재즈 (D단조, 스윙, 워킹 베이스, 브러시)
//            think     게임 중          — 시계 초침 + 피치카토 + 옅은 현악 (C단조, 느림)
//            suspense  범인 지목 화면    — 심장 박동 + 낮은 웅웅거림 + 떨리는 고음
//            result    결과 화면        — 효과음(팡파르/미제)이 끝난 뒤 lobby 를 작게
//   DO.music.base(name)  바탕 분위기 (app.js: 홈·사건 선택 = lobby, 게임 시작 = think)
//   DO.music.hold(name)  지금 화면에만 붙는 분위기. render() 한 뒤에 부른다. #root 의 화면이 바뀌면 저절로 바탕으로 돌아간다.
// 곡은 마디 단위로 미리(약 1.6초 앞까지) 예약한다. 분위기가 바뀌면 1초쯤 걸쳐 교차 전환하고, 같은 곡으로 돌아오면 멈춘 마디부터 잇는다.
// 헤더의 🔊 버튼 = 소리 설정 팝업 (배경음 켜기/끄기·크기, 효과음 켜기/끄기). do:music, do:musicVol, do:sound.

(() => {
  const { h, store } = DO;
  const S = DO.synth;
  const root = document.getElementById('root');

  // ---------- 곡 ----------
  // bar(i, t, beat, out): i번째 마디를 t 초부터 예약. beat = 4분음표 길이(초).
  const swingAt = (n, beat, sw) => Math.floor(n / 2) * beat + (n % 2 ? beat * sw : 0); // n번째 8분음표의 시작

  // lobby: Dm9 | G13 | Cmaj9 | A7(b9) 를 돌리는 16마디. 앞 8마디는 비브라폰 선율, 뒤 8마디는 반주만.
  const LOBBY_CH = [
    { bass: [50, 53, 57, 56], v: [65, 69, 72, 76] }, // Dm9  (F A C E)
    { bass: [55, 53, 52, 50], v: [65, 71, 76] },     // G13  (F B E)
    { bass: [48, 52, 55, 56], v: [64, 67, 71, 74] }, // Cmaj9 (E G B D)
    { bass: [45, 49, 52, 51], v: [61, 67, 70, 76] }, // A7b9 (C# G Bb E)
  ];
  const COMP = [[[0, 2], [3, 3]], [[1, 1], [4, 3]], [[0, 3], [5, 2]], [[2, 2], [7, 1]]]; // [8분음표 위치, 길이]
  const LOBBY_MEL = {
    0: [[0, 69, 1], [2, 72, 1], [3, 74, 2], [6, 77, 1], [7, 76, 1]],
    1: [[0, 74, 3], [4, 71, 1], [5, 72, 1], [6, 74, 2]],
    2: [[0, 76, 2], [2, 74, 1], [3, 71, 1], [4, 67, 3]],
    3: [[1, 73, 1], [2, 76, 1], [3, 79, 1], [4, 77, 2], [6, 73, 2]],
    4: [[0, 74, 4], [5, 69, 1], [6, 72, 2]],
    5: [[0, 71, 2], [2, 74, 1], [3, 77, 3]],
    6: [[0, 76, 1], [1, 74, 1], [2, 72, 2], [4, 71, 4]],
    7: [[0, 73, 2], [2, 70, 2], [4, 69, 4]],
    15: [[5, 64, 1], [6, 67, 1], [7, 69, 1]],
  };
  const RIDE = [[0, 0.55], [2, 0.55], [3, 0.3], [4, 0.55], [6, 0.55], [7, 0.3]];
  const lobby = {
    bpm: 96, bars: 16, swing: 0.64,
    bar(i, t, beat, out) {
      const c = LOBBY_CH[i % 4], at = n => t + swingAt(n, beat, this.swing), e8 = beat / 2;
      c.bass.forEach((m, k) => S.bass(out, t + k * beat, m, beat * 0.92, k === 0 ? 0.9 : 0.72));
      for (const [n, len] of COMP[(i + (i >> 2)) % 4]) c.v.forEach(m => S.keys(out, at(n), m, len * e8 * 0.95, 0.42));
      for (const [n, v] of RIDE) S.ride(out, at(n), v);
      S.brush(out, at(2), 0.45); S.brush(out, at(6), 0.45);
      for (const [n, m, len] of LOBBY_MEL[i] || []) S.vibe(out, at(n), m, len * e8, 0.55);
    },
  };

  // think: Cm | Cm | Ab | Ab | Fm | Fm | G7 | G7. 8분음표 베이스 고동 + 초침 + 2마디마다 현악 + 군데군데 피치카토 동기.
  const THINK = [
    { r: 48, pad: [55, 60, 63] }, { r: 48 },
    { r: 44, pad: [56, 60, 63] }, { r: 44 },
    { r: 41, pad: [56, 60, 65] }, { r: 41 },
    { r: 43, pad: [55, 59, 62, 65] }, { r: 43 },
  ];
  const THINK_MOTIF = {
    1: [[2, 67], [3, 68], [4, 67], [6, 62]],
    5: [[2, 68], [3, 70], [4, 68], [6, 65]],
    7: [[4, 71], [5, 72], [6, 74], [7, 77]],
  };
  const think = {
    bpm: 74, bars: 8,
    bar(i, t, beat, out) {
      const c = THINK[i], e8 = beat / 2;
      for (let k = 0; k < 4; k++) S.tick(out, t + k * beat, k % 2 === 0, 0.32);
      [[0, 0.8], [3, 0.55], [6, 0.6]].forEach(([n, v]) => S.bass(out, t + n * e8, c.r, e8 * 0.8, v));
      if (c.pad) S.pad(out, t, c.pad, beat * 8, 0.55);
      for (const [n, m] of THINK_MOTIF[i] || []) S.pluck(out, t + n * e8, m, 0.5);
    },
  };

  // suspense: 4마디. 심장 박동은 매 박, 저음은 C+G 에서 C+F# (삼전음) 으로, 고음은 Eb → D 로 반음 내려간다.
  const suspense = {
    bpm: 64, bars: 4,
    bar(i, t, beat, out) {
      for (let k = 0; k < 4; k++) S.heart(out, t + k * beat, k === 0 ? 0.8 : 0.6);
      S.drone(out, t, beat * 4 + 0.6, i < 2 ? [36, 43] : [36, 42], 0.6);
      S.trem(out, t, beat * 4 + 0.3, i < 2 ? 75 : 74, 0.55);
      if (i === 3) S.pluck(out, t + beat * 3.5, 36, 0.5);
    },
  };

  const SONGS = { lobby, think, suspense };
  // 분위기 → 곡, 크기, 지연(초). 크기는 오프라인 렌더로 맞췄다: 기본 볼륨(50)에서 RMS 약 -30 dBFS,
  // 효과음(클릭 최고점 약 -22, 팡파르 약 -3)보다 확실히 뒤에 깔리게.
  const MOODS = {
    lobby: { song: 'lobby', gain: 0.32 },
    think: { song: 'think', gain: 0.5 },
    suspense: { song: 'suspense', gain: 0.85 },
    result: { song: 'lobby', gain: 0.22, delay: 2.6, from: 8 }, // 팡파르가 끝나고 선율 없는 반주부터
  };

  // ---------- 재생 ----------
  let musicOn = store.get('music', true);
  let vol = Math.max(0, Math.min(1, store.get('musicVol', 0.5)));
  let base = 'lobby', held = null, heldNode = null;
  let playing = null;          // { mood, songName, song, out, nextT, bar }
  const resumeAt = {};         // 곡 이름 → 다음에 이어 칠 마디
  const LOOK = 1.6;            // 예약해 두는 시간(초). 백그라운드 탭의 1초 타이머 지연도 버틴다.

  const busGain = () => (musicOn ? vol * 0.9 : 0);
  function want() {
    if (!musicOn) return null;
    return held && heldNode && heldNode === root.firstElementChild ? held : base;
  }

  function startTrack(a, mood) {
    const m = MOODS[mood], song = SONGS[m.song], ac = a.ac;
    const t0 = ac.currentTime + 0.06 + (m.delay || 0);
    const out = ac.createGain();
    out.gain.setValueAtTime(0, ac.currentTime);
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(m.gain, t0 + 1.1);
    out.connect(a.musicIn);
    const bar = m.from != null ? m.from : (resumeAt[m.song] || 0);
    return { mood, songName: m.song, song, out, nextT: t0, bar };
  }
  function stopTrack(tr, ac) {
    resumeAt[tr.songName] = tr.bar % tr.song.bars;
    const now = ac.currentTime, p = tr.out.gain;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now); else { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); }
    p.setTargetAtTime(0, now, 0.3);
    setTimeout(() => { try { tr.out.disconnect(); } catch { /* 이미 끊김 */ } }, (LOOK + 6) * 1000);
  }
  function pump() {
    const a = DO.audio.get();
    if (!playing || !a || a.ac.state !== 'running') return;
    const now = a.ac.currentTime;
    if (playing.nextT < now) playing.nextT = now + 0.05; // 오래 멈췄다 깨어남
    while (playing.nextT < now + LOOK) {
      const beat = 60 / playing.song.bpm;
      try { playing.song.bar(playing.bar % playing.song.bars, playing.nextT, beat, playing.out); } catch (e) { console.error(e); playing = null; return; }
      playing.nextT += beat * 4;
      playing.bar++;
    }
  }
  function apply() {
    const a = DO.audio.get();
    if (!a || !DO.audio.ready) return; // 첫 입력 전: 깨어나면 다시 부른다
    a.music.gain.setTargetAtTime(busGain(), a.ac.currentTime, 0.08);
    const target = want();
    if (playing && playing.mood === target) return;
    if (playing) stopTrack(playing, a.ac);
    playing = target ? startTrack(a, target) : null;
    pump();
  }
  setInterval(pump, 150);
  DO.audio.onReady(apply);

  // 화면이 바뀌면 화면에 붙은 분위기(hold)는 풀린다
  new MutationObserver(() => {
    if (held && root.firstElementChild !== heldNode) { held = null; heldNode = null; apply(); }
  }).observe(root, { childList: true });

  DO.music = {
    base(name) { if (MOODS[name]) { base = name; apply(); } },
    hold(name) { if (MOODS[name]) { held = name; heldNode = root.firstElementChild; apply(); } },
    get mood() { return want(); },
    get playing() { return playing ? playing.mood : null; }, // 실제로 깔리고 있는 분위기 (첫 입력 전엔 null)
    get on() { return musicOn; },
    set(v) { musicOn = !!v; store.set('music', musicOn); apply(); paint(); },
    get volume() { return vol; },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); store.set('musicVol', vol); apply(); },
    // 개발용: 분위기 하나를 seconds 초 동안 오프라인으로 렌더 → AudioBuffer (소리 크기·깨짐 검사용)
    render(mood, seconds = 12, volume = 0.5) {
      const oac = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
      const b = DO.audio.buses(oac);
      b.music.gain.value = volume * 0.9;
      const m = MOODS[mood], song = SONGS[m.song], beat = 60 / song.bpm;
      const out = oac.createGain(); out.gain.value = m.gain; out.connect(b.musicIn);
      for (let t = 0.05, i = m.from || 0; t < seconds; t += beat * 4, i++) song.bar(i % song.bars, t, beat, out);
      return oac.startRendering();
    },
  };

  // ---------- 소리 설정 팝업 ----------
  const btn = document.getElementById('sound');
  function sw(label, get, set) {
    const b = h('button', { class: 'switch', role: 'switch', 'data-quiet': '1' });
    const paintSw = () => { b.setAttribute('aria-checked', String(get())); b.classList.toggle('on', get()); };
    b.addEventListener('click', () => { set(!get()); paintSw(); paint(); if (DO.sound.on) DO.sfx('tick'); });
    paintSw();
    return { el: h('div', { class: 'sound-row' }, h('span', { class: 'grow' }, label), b), paint: paintSw };
  }
  const range = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(vol * 100), 'aria-label': '배경음 크기' });
  range.addEventListener('input', () => DO.music.setVolume(range.value / 100));
  const musicSw = sw('🎵 배경음', () => musicOn, v => { DO.music.set(v); range.disabled = !v; });
  const sfxSw = sw('🔔 효과음', () => DO.sound.on, v => DO.sound.set(v));
  range.disabled = !musicOn;
  const pop = h('div', { class: 'sound-pop', hidden: true, role: 'dialog', 'aria-label': '소리 설정' },
    musicSw.el,
    h('div', { class: 'sound-row' }, h('span', { class: 'vol-ico' }, '🔈'), range, h('span', { class: 'vol-ico' }, '🔊')),
    sfxSw.el,
    h('p', { class: 'muted small-text' }, '휴대폰 무음 모드에서는 안 들릴 수 있어요.'),
  );
  document.body.append(pop);

  function paint() {
    if (!btn) return;
    const any = musicOn || DO.sound.on;
    btn.textContent = any ? '🔊' : '🔇';
    btn.title = '소리 설정';
    btn.setAttribute('aria-expanded', String(!pop.hidden));
  }
  function place() {
    const r = btn.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 8)}px`;
    pop.style.right = `${Math.max(12, Math.round(innerWidth - r.right))}px`;
  }
  function openPop(v) {
    pop.hidden = !v;
    if (v) { place(); musicSw.paint(); sfxSw.paint(); range.value = Math.round(vol * 100); }
    paint();
  }
  if (btn) {
    btn.addEventListener('click', e => { e.stopPropagation(); DO.audio.wake(); openPop(pop.hidden); if (DO.sound.on) DO.sfx('tick'); });
    document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) openPop(false); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) openPop(false); });
    addEventListener('resize', () => { if (!pop.hidden) place(); });
  }
  paint();
})();
