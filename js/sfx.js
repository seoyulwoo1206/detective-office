// 효과음: 파일 없이 WebAudio 로 즉석 합성한다 (file:// 에서도 동작).
//   DO.sfx('tap' | 'paper' | 'tick' | 'stamp' | 'good' | 'bad' | 'reveal')
// 헤더의 🔊 버튼으로 켜고 끈다 (localStorage do:sound). 오디오를 못 쓰는 환경에서는 조용히 무시한다.

(() => {
  const { store } = DO;
  let ctx = null;
  let on = store.get('sound', true);

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.06, at = 0, to = null } = {}) {
    const ac = audio(); if (!ac) return;
    const t0 = ac.currentTime + at;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, { gain = 0.05, at = 0, freq = 1800, q = 0.7, type = 'bandpass' } = {}) {
    const ac = audio(); if (!ac) return;
    const t0 = ac.currentTime + at;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t0);
  }

  const SOUNDS = {
    tap() { tone(520, 0.045, { type: 'triangle', gain: 0.035 }); },
    tick() { tone(1100, 0.03, { type: 'square', gain: 0.02 }); },
    paper() { noise(0.16, { gain: 0.05, freq: 2600, q: 0.5 }); },
    reveal() { noise(0.12, { gain: 0.04, freq: 3200, q: 0.6 }); tone(660, 0.12, { gain: 0.04, at: 0.05 }); },
    stamp() { tone(140, 0.18, { type: 'sine', gain: 0.22, to: 55 }); noise(0.09, { gain: 0.12, freq: 420, q: 0.4, type: 'lowpass' }); },
    good() { tone(523, 0.14, { gain: 0.06 }); tone(659, 0.14, { gain: 0.06, at: 0.11 }); tone(784, 0.26, { gain: 0.07, at: 0.22 }); },
    bad() { tone(220, 0.22, { type: 'sawtooth', gain: 0.045, to: 150 }); tone(165, 0.3, { type: 'sawtooth', gain: 0.045, at: 0.16, to: 105 }); },
  };

  DO.sfx = name => {
    if (!on || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch { /* 소리는 없어도 게임은 계속 */ }
  };
  DO.sound = {
    get on() { return on; },
    set(v) { on = !!v; store.set('sound', on); paint(); },
  };

  // 헤더 버튼 + 모든 버튼에 가벼운 클릭음
  const btn = document.getElementById('sound');
  function paint() { if (btn) { btn.textContent = on ? '🔊' : '🔇'; btn.title = on ? '효과음 끄기' : '효과음 켜기'; } }
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); DO.sound.set(!on); if (on) DO.sfx('tick'); });
  paint();
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (b && b !== btn && !b.disabled && !b.dataset.quiet) DO.sfx('tap');
  }, true);
})();
