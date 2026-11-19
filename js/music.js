// 배경음: 상황(분위기)에 맞춰 즉석 합성한 곡을 깐다. 파일 없음.
//   lobby          홈·사건 고르기 — 시간대별로 곡이 다르다: 낮(6~17시) 보사노바, 저녁(17~22시) 스윙 재즈, 밤 빗소리 발라드
//   party          파티 모드(접기·이마 게임·이마 접기) 게임 중 — 살금살금 핑거스냅 그루브 (E단조)
//   think          알리바이 깨기 — 시계 초침 + 피치카토 + 옅은 현악 (C단조)
//   interrogation  AI 심문 — 취조실: 형광등 웅웅 + 약음기 트럼펫 + 느린 블루스 (C단조)
//   explore        방탈출 — 어두운 방: 낮은 울림 + 물방울 메아리 + 바람 + 띄엄띄엄 피아노
//   suspense       범인 지목 화면 — 심장 박동이 점점 빨라진다
//   victory/defeat 결과 화면 — 팡파르 뒤 밝은 스윙 / "둥 둥 두웅" 뒤 빗속 피아노
//   hush           폰 넘기기 가림막 — 곡은 그대로, 벽 너머처럼 먹먹하게
//
//   DO.music.base(name)      바탕 분위기 (app.js: 홈·사건 선택 = lobby, 게임 시작 = forMode(모드))
//   DO.music.hold(name)      지금 화면에만 붙는 분위기. render() 한 뒤에 부른다. #root 의 화면이 바뀌면 저절로 바탕으로 돌아간다.
//   DO.music.intensity(0~2)  긴장도. 곡마다 층이 더해진다(셰이커·심장 박동·초침 등). 모드가 상황(남은 기회·배터리·질문)에 맞춰 올린다.
// 곡은 마디 단위로 미리(약 1.6초 앞까지) 예약하고, 마디마다 조금씩 무작위로 바뀐다(필인·장식음·선율 바꿔 치기).
// 분위기가 바뀌면 1초쯤 걸쳐 교차 전환하고, 같은 곡으로 돌아오면 멈춘 마디부터 잇는다.
// 헤더의 🔊 버튼 = 소리 설정 팝업 (배경음 켜기/끄기·크기, 효과음 켜기/끄기). do:music, do:musicVol, do:sound.

(() => {
  const { h, store } = DO;
  const S = DO.synth;
  const root = document.getElementById('root');
  const R = Math.random;
  const chance = p => R() < p;
  const pick = a => a[Math.floor(R() * a.length)];
  const swingAt = (n, beat, sw) => Math.floor(n / 2) * beat + (n % 2 ? beat * sw : 0); // n번째 8분음표의 시작

  // 곡의 출력: 가운데 + 좌우 (헤드폰에서 넓게 들리게)
  function outs(dest) {
    return { c: dest, l: S.pan(dest, -0.3), r: S.pan(dest, 0.3), ll: S.pan(dest, -0.6), rr: S.pan(dest, 0.6) };
  }

  // ---------- 곡 ----------
  // bar(i, t, beat, o, x): i번째 마디를 t 초부터 예약. beat = 4분음표 길이(초), o = 출력(c/l/r/ll/rr), x = { level 긴장도, k 시작 후 몇 번째 마디 }

  // 저녁 로비: 스윙 재즈. Dm9 | G13 | Cmaj9 | A7(b9) 16마디. 앞 8마디 비브라폰 선율, 9~12마디는 가끔 로즈가 한 옥타브 아래로 받는다.
  const SWING_CH = [
    { bass: [50, 53, 57, 56], v: [65, 69, 72, 76] },
    { bass: [55, 53, 52, 50], v: [65, 71, 76] },
    { bass: [48, 52, 55, 56], v: [64, 67, 71, 74] },
    { bass: [45, 49, 52, 51], v: [61, 67, 70, 76] },
  ];
  const COMP = [[[0, 2], [3, 3]], [[1, 1], [4, 3]], [[0, 3], [5, 2]], [[2, 2], [7, 1]]]; // [8분음표 위치, 길이]
  const SWING_MEL = {
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
  const swing = {
    gain: 0.32, bpm: 96, bars: 16,
    bar(i, t, beat, o) {
      const c = SWING_CH[i % 4], at = n => t + swingAt(n, beat, 0.64), e8 = beat / 2;
      c.bass.forEach((m, k) => S.bass(o.c, t + k * beat, m, beat * 0.92, k === 0 ? 0.9 : 0.72));
      for (const [n, len] of COMP[(i + (i >> 2)) % 4]) c.v.forEach(m => S.keys(o.l, at(n), m, len * e8 * 0.95, 0.42));
      for (const [n, v] of RIDE) S.ride(o.rr, at(n), v);
      S.brush(o.ll, at(2), 0.45); S.brush(o.ll, at(6), 0.45);
      if (i % 4 === 3 && chance(0.5)) [5, 7].forEach(n => S.brush(o.ll, at(n), 0.3)); // 프레이즈 끝 필인
      for (const [n, m, len] of SWING_MEL[i] || []) S.vibe(o.r, at(n), m, len * e8, 0.55);
      if (i >= 8 && i < 12 && chance(0.5)) for (const [n, m, len] of SWING_MEL[i - 8]) S.keys(o.r, at(n), m - 12, len * e8, 0.4);
    },
  };

  // 낮 로비: 보사노바 (F장조). 플루트 선율 8마디 + 반주 8마디(가끔 비브라폰 장식). 나일론 기타·림 클라베·셰이커.
  const BOSSA_CH = [
    { r: 41, v: [57, 60, 64] }, { r: 41, v: [57, 60, 64, 67] }, { r: 43, v: [58, 62, 65, 69] }, { r: 36, v: [58, 64, 67] },
    { r: 45, v: [55, 60, 64] }, { r: 38, v: [54, 60, 63] }, { r: 43, v: [58, 62, 65] }, { r: 36, v: [58, 62, 64, 67] },
  ];
  const BOSSA_MEL = {
    0: [[0, 72, 3], [3, 69, 1], [4, 72, 2], [6, 76, 2]],
    1: [[0, 77, 4], [5, 76, 1], [6, 74, 2]],
    2: [[0, 74, 3], [3, 70, 1], [4, 74, 2], [6, 77, 2]],
    3: [[0, 76, 4], [5, 74, 1], [6, 72, 2]],
    4: [[0, 72, 3], [3, 69, 1], [4, 72, 2], [6, 76, 2]],
    5: [[0, 78, 3], [3, 75, 1], [4, 74, 4]],
    6: [[0, 74, 2], [2, 72, 2], [4, 70, 2], [6, 69, 2]],
    7: [[0, 67, 4], [4, 70, 2], [6, 72, 2]],
  };
  const bossa = {
    gain: 0.32, bpm: 132, bars: 16,
    bar(i, t, beat, o) {
      const c = BOSSA_CH[i % 8], e8 = beat / 2, at = n => t + n * e8;
      S.bass(o.c, at(0), c.r, e8 * 2.8, 0.85); S.bass(o.c, at(4), c.r + 7, e8 * 2.8, 0.7);
      if (chance(0.35)) S.bass(o.c, at(7), c.r + 12, e8 * 0.8, 0.45);
      for (const n of (i % 2 ? [2, 4, 7] : [0, 3, 6])) c.v.forEach((m, k) => S.pluck(o.l, at(n) + k * 0.013, m, 0.42));
      for (const n of (i % 2 ? [2, 4] : [0, 3, 6])) S.rim(o.r, at(n), 0.4);
      for (let n = 0; n < 8; n++) S.shaker(o.rr, at(n), n % 2 ? 0.55 : 0.35); // 뒷박에 힘
      for (const [n, m, len] of BOSSA_MEL[i] || []) S.flute(o.r, at(n), m, len * e8 * 0.95, 0.6);
      if (i >= 8 && chance(0.4)) S.vibe(o.r, at(pick([3, 5, 6])), pick(c.v) + 12, e8 * 2, 0.4);
    },
  };

  // 밤 로비: 빗소리 + 느린 로즈 아르페지오 (A단조).
  const RAIN_CH = [{ r: 45, v: [60, 64, 67, 71] }, { r: 41, v: [57, 60, 64, 71] }, { r: 38, v: [53, 57, 60, 64] }, { r: 40, v: [56, 62, 65] }];
  const RAIN_MEL = {
    1: [[0, 76, 3], [3, 74, 1], [4, 72, 4]], 3: [[0, 71, 2], [2, 74, 2], [4, 76, 4]],
    5: [[0, 79, 3], [3, 77, 1], [4, 76, 4]], 7: [[0, 74, 2], [2, 71, 2], [4, 68, 4]],
  };
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
  const rainy = {
    gain: 0.45, bpm: 66, bars: 8,
    bar(i, t, beat, o) {
      const c = RAIN_CH[i % 4], e8 = beat / 2;
      S.rain(o.c, t, beat * 4 + 0.6, 0.8);
      S.bass(o.c, t, c.r, beat * 1.8, 0.7); S.bass(o.c, t + beat * 2, c.r + 7, beat * 1.6, 0.5);
      ARP.forEach((k, n) => { if (n === 0 || chance(0.85)) S.keys(o.l, t + n * e8, c.v[k % c.v.length], e8 * 1.8, n === 0 ? 0.5 : 0.32); });
      S.brush(o.ll, t + beat, 0.25, 0.5); S.brush(o.ll, t + beat * 3, 0.25, 0.5);
      for (const [n, m, len] of RAIN_MEL[i] || []) S.keys(o.r, t + n * e8, m, len * e8, 0.5);
    },
  };

  // 파티: 살금살금 핑거스냅 그루브 (E단조). 반음씩 기어오르는 베이스 + 마림바. 긴장도에 따라 킥·하이햇·금관이 더해진다.
  const PARTY_BASS = [[40, 0, 0, 43, 44, 0, 45, 0], [47, 0, 0, 46, 45, 0, 43, 0], [45, 0, 0, 48, 49, 0, 50, 0], [47, 0, 46, 0, 45, 0, 42, 0]];
  const PARTY_CH = [[55, 59, 64], [55, 59, 64], [57, 60, 64], [54, 57, 63]];
  const PARTY_MEL = {
    0: [[0, 76], [1, 74], [2, 71], [4, 70], [5, 69], [6, 67]], 1: [[1, 64], [3, 67], [6, 71]],
    2: [[0, 72], [1, 71], [2, 69], [4, 68], [5, 67], [6, 64]], 3: [[0, 66], [2, 69], [4, 71], [6, 75]],
  };
  const party = {
    gain: 0.3, bpm: 108, bars: 8,
    bar(i, t, beat, o, x) {
      const j = i % 4, at = n => t + swingAt(n, beat, 0.58), e8 = beat / 2;
      PARTY_BASS[j].forEach((m, n) => { if (m) S.bass(o.c, at(n), m, e8 * 0.7, 0.85); });
      S.snap(o.ll, t + beat, 0.7); S.snap(o.ll, t + beat * 3, 0.7);
      for (let n = 0; n < 8; n++) S.shaker(o.rr, at(n), n % 2 ? 0.3 : 0.5);
      PARTY_CH[j].forEach(m => S.keys(o.l, at(7), m, e8 * 0.8, 0.35));
      if (chance(0.5)) PARTY_CH[j].forEach(m => S.keys(o.l, at(3), m, e8 * 0.6, 0.28));
      const mel = PARTY_MEL[j];
      if (i < 4) mel.forEach(([n, m]) => S.marimba(o.r, at(n), m, 0.6));
      else if (chance(0.7)) mel.forEach(([n, m]) => S.keys(o.r, at(n), m, e8 * 0.9, 0.42));
      if (x.level >= 1) [0, 2].forEach(b => S.beep(o.c, t + b * beat, 70, 0.12, { peak: 0.22, to: 42 }));            // 킥
      if (x.level >= 2) { for (let s = 0; s < 16; s++) S.shaker(o.r, t + s * beat / 4, 0.25); if (j === 3) S.brass(o.l, at(6), [54, 57, 63], 0.3, 0.5); }
    },
  };

  // 알리바이 깨기: Cm | Cm | Ab | Ab | Fm | Fm | G7 | G7. 초침 + 8분음표 베이스 + 2마디마다 현악 + 군데군데 피치카토 동기.
  const THINK = [
    { r: 48, pad: [55, 60, 63] }, { r: 48 }, { r: 44, pad: [56, 60, 63] }, { r: 44 },
    { r: 41, pad: [56, 60, 65] }, { r: 41 }, { r: 43, pad: [55, 59, 62, 65] }, { r: 43 },
  ];
  const THINK_MOTIF = {
    1: [[2, 67], [3, 68], [4, 67], [6, 62]],
    5: [[2, 68], [3, 70], [4, 68], [6, 65]],
    7: [[4, 71], [5, 72], [6, 74], [7, 77]],
  };
  const think = {
    gain: 0.5, bpm: 74, bars: 8,
    bar(i, t, beat, o, x) {
      const c = THINK[i], e8 = beat / 2;
      for (let k = 0; k < (x.level >= 1 ? 8 : 4); k++) S.tick(o.rr, t + k * (x.level >= 1 ? e8 : beat), k % 2 === 0, x.level >= 1 ? 0.26 : 0.32);
      [[0, 0.8], [3, 0.55], [6, 0.6]].forEach(([n, v]) => S.bass(o.c, t + n * e8, c.r, e8 * 0.8, v));
      if (c.pad) S.pad(o.l, t, c.pad, beat * 8, 0.55);
      for (const [n, m] of THINK_MOTIF[i] || []) S.pluck(o.r, t + n * e8, m + (chance(0.15) ? 12 : 0), 0.5);
      if (x.level >= 2) { S.heart(o.c, t, 0.55); S.heart(o.c, t + beat * 2, 0.45); if (i % 2 === 0) S.trem(o.r, t, beat * 8 + 0.3, 79, 0.4); }
    },
  };

  // AI 심문: 취조실 블루스. Cm7 | Fm7 | Cm7 | G7(b9). 형광등 웅웅, 약음기 트럼펫이 4마디마다 한 소절.
  const NOIR_CH = [{ r: 36, v: [58, 63, 67] }, { r: 41, v: [56, 60, 63] }, { r: 36, v: [58, 63, 67] }, { r: 43, v: [56, 59, 65] }];
  const NOIR_HORN = { // [박, 음, 길이(박)]
    1: [[0, 67, 1.5], [1.5, 70, 0.5], [2, 72, 1], [3, 70, 1]],
    5: [[0, 75, 1], [1, 72, 1], [2, 70, 1.5], [3.5, 67, 0.5]],
    7: [[0, 68, 2], [2, 67, 2]],
  };
  const interrogation = {
    gain: 0.5, bpm: 60, bars: 8,
    bar(i, t, beat, o, x) {
      const c = NOIR_CH[i % 4];
      if (i % 2 === 0) S.hum(o.rr, t, beat * 8 + 0.6, 0.6);
      S.bass(o.c, t, c.r, beat * 1.8, 0.75); S.bass(o.c, t + beat * 2, c.r + (chance(0.5) ? 7 : 12), beat * 1.6, 0.55);
      c.v.forEach(m => S.keys(o.l, t + (chance(0.3) ? beat * 0.5 : 0), m, beat * 3.4, 0.33));
      S.brush(o.ll, t + beat, 0.2, 0.6); S.brush(o.ll, t + beat * 3, 0.2, 0.6);
      for (const [b, m, len] of NOIR_HORN[i] || []) S.horn(o.r, t + b * beat, m, len * beat * 0.95, 0.6);
      if (x.level >= 1) for (let k = 0; k < 4; k++) S.tick(o.rr, t + k * beat, k % 2 === 0, 0.3);
      if (x.level >= 2) [0, 2].forEach(b => S.heart(o.c, t + b * beat, 0.5));
    },
  };

  // 방탈출: 어두운 방. D2+A2 울림, 물방울(반대편에서 메아리), 4마디마다 바람, 띄엄띄엄 피아노.
  const EXP_NOTES = [62, 65, 69, 70, 74, 57];
  const explore = {
    gain: 1.2, bpm: 70, bars: 8,
    bar(i, t, beat, o, x) {
      if (i % 2 === 0) S.drone(o.c, t, beat * 8 + 0.6, [38, 45], 0.55);
      for (let k = 1 + Math.floor(R() * 3); k > 0; k--) {
        const dt = R() * beat * 4, left = chance(0.5);
        S.drip(left ? o.ll : o.rr, t + dt, 0.5); S.drip(left ? o.rr : o.ll, t + dt + 0.33, 0.18);
      }
      if (i % 4 === 1) S.hiss(o.l, t, beat * 4, { from: 260, to: 900, q: 1.5, peak: 0.035, a: beat * 1.5 });
      if (chance(0.6)) S.keys(o.r, t + Math.floor(R() * 4) * beat, pick(EXP_NOTES), beat * 2.5, 0.38);
      if (x.level >= 1) { S.heart(o.c, t, 0.45); S.heart(o.c, t + beat * 2, 0.38); }
      if (x.level >= 2) { for (let k = 0; k < 8; k++) S.tick(o.rr, t + k * beat / 2, k % 2 === 0, 0.3); if (i % 2 === 0) S.trem(o.r, t, beat * 8 + 0.3, 75, 0.45); }
    },
  };

  // 지목: 심장 박동(점점 빨라짐) + C+G → C+F# 저음 + Eb → D 떨리는 고음.
  const suspense = {
    gain: 0.85, bpm: 64, bars: 4,
    tempo: k => 64 + Math.min(22, k * 3),
    bar(i, t, beat, o) {
      for (let k = 0; k < 4; k++) S.heart(o.c, t + k * beat, k === 0 ? 0.8 : 0.6);
      S.drone(o.c, t, beat * 4 + 0.6, i < 2 ? [36, 43] : [36, 42], 0.6);
      S.trem(o.r, t, beat * 4 + 0.3, i < 2 ? 75 : 74, 0.55);
      if (i === 3) S.pluck(o.l, t + beat * 3.5, 36, 0.5);
    },
  };

  // 승리: 밝은 스윙 (F장조) Fmaj9 | Dm9 | Gm7 | C9, 워킹 베이스 + 비브라폰.
  const VIC_CH = [
    { bass: [41, 45, 48, 49], v: [57, 60, 64, 67] }, { bass: [38, 41, 45, 44], v: [53, 57, 60, 64] },
    { bass: [43, 46, 50, 49], v: [53, 58, 62, 65] }, { bass: [48, 46, 45, 40], v: [52, 58, 62, 67] },
  ];
  const VIC_MEL = {
    0: [[0, 72, 2], [2, 76, 1], [3, 79, 2], [6, 77, 1], [7, 76, 1]], 1: [[0, 74, 3], [4, 72, 1], [5, 69, 1], [6, 72, 2]],
    2: [[0, 70, 2], [2, 74, 1], [3, 77, 2], [6, 76, 1], [7, 74, 1]], 3: [[0, 72, 4], [5, 76, 1], [6, 79, 2]],
    4: [[0, 72, 2], [2, 76, 1], [3, 79, 2], [6, 77, 1], [7, 76, 1]], 5: [[0, 81, 3], [4, 79, 1], [5, 77, 1], [6, 74, 2]],
    6: [[0, 77, 2], [2, 76, 1], [3, 74, 2], [6, 72, 2]], 7: [[0, 72, 6]],
  };
  const victory = {
    gain: 0.24, bpm: 116, bars: 8,
    bar(i, t, beat, o) {
      const c = VIC_CH[i % 4], at = n => t + swingAt(n, beat, 0.62), e8 = beat / 2;
      c.bass.forEach((m, k) => S.bass(o.c, t + k * beat, m, beat * 0.9, k === 0 ? 0.9 : 0.72));
      for (const [n, len] of COMP[(i + 1) % 4]) c.v.forEach(m => S.keys(o.l, at(n), m, len * e8 * 0.95, 0.45));
      for (const [n, v] of RIDE) S.ride(o.rr, at(n), v);
      S.brush(o.ll, at(2), 0.5); S.brush(o.ll, at(6), 0.5);
      for (const [n, m, len] of VIC_MEL[i] || []) S.vibe(o.r, at(n), m, len * e8, 0.6);
    },
  };

  // 미제: 빗속 솔로 로즈 (D단조) Dm9 | Bbmaj7 | Gm7 | A7, 내려가는 선율.
  const DEF_CH = [{ r: 38, v: [53, 57, 60, 64] }, { r: 46, v: [57, 62, 65] }, { r: 43, v: [53, 58, 62] }, { r: 45, v: [55, 61, 64] }];
  const DEF_MEL = { 0: [[0, 69, 2], [2, 67, 1], [3, 65, 1], [4, 64, 4]], 1: [[0, 62, 4], [4, 65, 4]], 2: [[0, 67, 2], [2, 65, 2], [4, 62, 4]], 3: [[0, 64, 2], [2, 61, 2], [4, 57, 4]] };
  const defeat = {
    gain: 0.6, bpm: 60, bars: 8,
    bar(i, t, beat, o) {
      const c = DEF_CH[i % 4], e8 = beat / 2;
      S.rain(o.c, t, beat * 4 + 0.6, 0.7);
      S.bass(o.c, t, c.r, beat * 3.6, 0.6);
      c.v.forEach((m, k) => S.keys(o.l, t + k * 0.04, m, beat * 3.5, 0.32));
      if (i < 4 || chance(0.4)) for (const [n, m, len] of DEF_MEL[i % 4]) S.keys(o.r, t + n * e8, m + 12, len * e8, 0.45);
    },
  };

  const SONGS = { swing, bossa, rainy, party, think, interrogation, explore, suspense, victory, defeat };
  // 로비 곡은 시간대로 고른다
  const lobbySong = () => { const hr = new Date().getHours(); return hr >= 6 && hr < 17 ? 'bossa' : hr >= 17 && hr < 22 ? 'swing' : 'rainy'; };
  // 분위기 → 곡, 지연(초). 곡마다의 크기(gain)는 오프라인 렌더로 맞췄다: 기본 볼륨(50)에서 RMS 약 -30 dBFS 안팎.
  const MOODS = {
    lobby: { song: lobbySong },
    party: { song: 'party' },
    think: { song: 'think' },
    interrogation: { song: 'interrogation' },
    explore: { song: 'explore' },
    suspense: { song: 'suspense' },
    victory: { song: 'victory', delay: 2.4 },
    defeat: { song: 'defeat', delay: 2.6 },
    hush: { muffle: true },
  };
  const MODE_MUSIC = { fold: 'party', forehead: 'party', 'blind-fold': 'party', alibi: 'think', 'ai-interrogation': 'interrogation', escape: 'explore', daily: 'lobby' };
  const songOf = mood => { const s = MOODS[mood].song; return typeof s === 'function' ? s() : s; };

  // ---------- 재생 ----------
  let musicOn = store.get('music', true);
  let vol = Math.max(0, Math.min(1, store.get('musicVol', 0.5)));
  let base = 'lobby', held = null, heldNode = null, level = 0;
  let playing = null;          // { mood, songName, song, o, out, nextT, bar, k }
  const resumeAt = {};         // 곡 이름 → 다음에 이어 칠 마디
  const LOOK = 1.6;            // 예약해 두는 시간(초). 백그라운드 탭의 1초 타이머 지연도 버틴다.

  const busGain = () => (musicOn ? vol * 0.9 : 0);
  function want() {
    if (!musicOn) return null;
    return held && heldNode && heldNode === root.firstElementChild ? held : base;
  }

  function startTrack(a, mood) {
    const m = MOODS[mood], songName = songOf(mood), song = SONGS[songName], ac = a.ac;
    const t0 = ac.currentTime + 0.06 + (m.delay || 0);
    const out = ac.createGain();
    out.gain.setValueAtTime(0, ac.currentTime);
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(song.gain, t0 + 1.1);
    out.connect(a.musicIn);
    return { mood, songName, song, o: outs(out), out, nextT: t0, bar: resumeAt[songName] || 0, k: 0 };
  }
  function stopTrack(tr, ac) {
    resumeAt[tr.songName] = tr.bar % tr.song.bars;
    const now = ac.currentTime, p = tr.out.gain;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now); else { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); }
    p.setTargetAtTime(0, now, 0.3);
    setTimeout(() => { try { tr.out.disconnect(); } catch { /* 이미 끊김 */ } }, (LOOK + 6) * 1000);
  }
  function scheduleBar(tr, t) {
    const beat = 60 / (tr.song.tempo ? tr.song.tempo(tr.k) : tr.song.bpm);
    tr.song.bar(tr.bar % tr.song.bars, t, beat, tr.o, { level, k: tr.k });
    return beat * 4;
  }
  function pump() {
    const a = DO.audio.get();
    if (!playing || !a || a.ac.state !== 'running') return;
    const now = a.ac.currentTime;
    if (playing.nextT < now) playing.nextT = now + 0.05; // 오래 멈췄다 깨어남
    while (playing && playing.nextT < now + LOOK) {
      try { playing.nextT += scheduleBar(playing, playing.nextT); } catch (e) { console.error(e); playing = null; return; }
      playing.bar++; playing.k++;
    }
  }
  function setMuffle(a, on) {
    const now = a.ac.currentTime;
    a.muffle.frequency.setTargetAtTime(on ? 480 : 20000, now, on ? 0.12 : 0.25);
    a.muffleGain.gain.setTargetAtTime(on ? 0.65 : 1, now, 0.15);
  }
  function apply() {
    const a = DO.audio.get();
    if (!a || !DO.audio.ready) return; // 첫 입력 전: 깨어나면 다시 부른다
    a.music.gain.setTargetAtTime(busGain(), a.ac.currentTime, 0.08);
    let target = want();
    const muffled = !!(target && MOODS[target].muffle);
    setMuffle(a, muffled);
    if (muffled) target = base; // 곡은 바탕 그대로, 소리만 먹먹하게
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
    base(name) { if (MOODS[name] && !MOODS[name].muffle) { if (name !== base) level = 0; base = name; apply(); } },
    hold(name) { if (MOODS[name]) { held = name; heldNode = root.firstElementChild; apply(); } },
    forMode: id => MODE_MUSIC[id] || 'think',
    // 새 게임이면 긴장도를 0 으로 (같은 분위기여도)
    startGame(id) { level = 0; DO.music.base(MODE_MUSIC[id] || 'think'); },
    intensity(n) { level = Math.max(0, Math.min(2, n | 0)); },
    get level() { return level; },
    get mood() { return want(); },
    get playing() { return playing ? playing.mood : null; },   // 실제로 깔리고 있는 분위기 (첫 입력 전엔 null)
    get song() { return playing ? playing.songName : null; },
    get on() { return musicOn; },
    set(v) { musicOn = !!v; store.set('music', musicOn); apply(); paint(); },
    get volume() { return vol; },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); store.set('musicVol', vol); apply(); },
    songs: Object.keys(SONGS),
    // 개발용: 곡 하나를 seconds 초 동안 오프라인으로 렌더 → AudioBuffer (소리 크기·깨짐 검사용)
    render(songName, seconds = 12, { volume = 0.5, gain = null, lvl = 0 } = {}) {
      const oac = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
      const b = DO.audio.buses(oac);
      b.music.gain.value = volume * 0.9;
      const out = oac.createGain(); out.gain.value = gain != null ? gain : SONGS[songName].gain; out.connect(b.musicIn);
      const tr = { song: SONGS[songName], o: outs(out), bar: 0, k: 0 };
      const keep = level; level = lvl;
      try { for (let t = 0.05; t < seconds; tr.bar++, tr.k++) t += scheduleBar(tr, t); } finally { level = keep; }
      return oac.startRendering();
    },
  };

  // ---------- 소리 설정 팝업 ----------
  const btn = document.getElementById('sound');
  function sw(label, get, set) {
    const b = h('button', { class: 'switch', role: 'switch', 'data-quiet': '1' });
    const paintSw = () => { b.setAttribute('aria-checked', String(get())); b.classList.toggle('on', get()); };
    b.addEventListener('click', () => { set(!get()); paintSw(); paint(); if (DO.sound.on) DO.sfx('soft'); });
    paintSw();
    return { el: h('div', { class: 'sound-row' }, h('span', { class: 'grow' }, label), b), paint: paintSw };
  }
  const range = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(vol * 100), 'aria-label': '배경음 크기' });
  range.addEventListener('input', () => DO.music.setVolume(range.value / 100));
  const musicSw = sw('🎵 배경음', () => musicOn, v => { DO.music.set(v); range.disabled = !v; });
  const sfxSw = sw('🔔 효과음', () => DO.sound.on, v => DO.sound.set(v));
  range.disabled = !musicOn;
  const nowPlaying = h('p', { class: 'muted small-text' });
  const pop = h('div', { class: 'sound-pop', hidden: true, role: 'dialog', 'aria-label': '소리 설정' },
    musicSw.el,
    h('div', { class: 'sound-row' }, h('span', { class: 'vol-ico' }, '🔈'), range, h('span', { class: 'vol-ico' }, '🔊')),
    sfxSw.el,
    nowPlaying,
  );
  document.body.append(pop);
  const SONG_LABEL = {
    swing: '저녁의 사무소 재즈', bossa: '한낮의 보사노바', rainy: '비 오는 밤', party: '살금살금 파티', think: '초침 소리',
    interrogation: '취조실 블루스', explore: '어두운 방', suspense: '두근두근', victory: '사건 해결', defeat: '미제 사건',
  };

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
    if (v) {
      place(); musicSw.paint(); sfxSw.paint(); range.value = Math.round(vol * 100);
      const s = DO.music.song;
      nowPlaying.textContent = musicOn && s ? `♪ 지금: ${SONG_LABEL[s] || s}` : '휴대폰 무음 모드에서는 안 들릴 수 있어요.';
    }
    paint();
  }
  if (btn) {
    btn.addEventListener('click', e => { e.stopPropagation(); DO.audio.wake(); openPop(pop.hidden); if (DO.sound.on) DO.sfx('soft'); });
    document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) openPop(false); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) openPop(false); });
    addEventListener('resize', () => { if (!pop.hidden) place(); });
  }
  paint();
})();
