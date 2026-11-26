// 현장 수사: 명탐정의 길(career.js)의 사건 진행 방식.
//   DO.investigate(root, C, opt)  opt = { level 0~3, variant, boss, actionsBonus, heartsBonus, lens, gut, freeHints, onDone({ win, stars, hints, hearts }) }
//
// 흐름: 도입 영상(레터박스 + 카메라 이동 + 타자 내레이션 + 용의자 등장)
//   → 현장(사건 배경 그림 위의 장소·사람을 눌러 조사) — 찾은 단서와 들은 말은 수첩에 자동으로 적힌다
//   → 추리(범인 고르기 → 그 사람의 거짓말 고르기 → 그 말을 무너뜨릴 증거 제시)
//   → "이의 있음!" 연출 → 자백 → 결과. 보스는 한 번 버티므로 모순을 두 번 찔러야 한다.
// 사건 데이터에서 그대로 만든다: 진술 = 조건에 대한 주장(범인은 lies 에서 거짓), 단서 = clues(exposes 가 무너뜨리는 주제), 장소 = scene.spots.
// 정답 판정: 고른 사람이 범인이고, 고른 말이 범인의 거짓말 주제(T)이고, 고른 증거가 T 를 폭로(exposes === T)하면 성공.

(() => {
  const { h, render, rng, hashString, shuffle } = DO;
  const sfx = (n, o) => { if (DO.sfx) DO.sfx(n, o); };
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- 배경 그림 (사건 배경마다 다름, 밤이면 어둡게) ----------
  const CATEGORY_THEME = { '학교·학원': 'school', '가족·동네': 'town', '모임·행사': 'event', '가게·시설': 'shop', '여행': 'travel', '온라인': 'online' };
  // 장소 이름(scene.name) → 제목 → 소개 순으로 장소 낱말을 찾아 배경을 고른다. 못 찾으면 category.
  const THEME_RULES = [
    [/박물관|미술관|유물|큐레이터|특별전/, 'museum'], [/영화관|상영관|극장|시사회|매표소/, 'cinema'], [/수족관|아쿠아리움|수조|해양관/, 'aquarium'],
    [/야시장|전통시장|시장|장터|노점|좌판/, 'market'],
    [/병원|간호|병실|응급|입원/, 'hospital'], [/놀이공원|놀이동산|관람차|회전목마|롤러코스터/, 'amusement'],
    [/지하철|승강장|플랫폼|역무|개찰구|환승/, 'subway'], [/PC방|피시방/i, 'pcroom'], [/체육관|농구|코트|경기장|배구|체육 대회|체육대회/, 'gym'],
    [/수영장|락커룸|수영/, 'pool'], [/캠핑|텐트|야영|캠프/, 'camping'], [/결혼|신부|신랑|웨딩|식장|예식/, 'wedding'],
    [/호텔|로비|루프탑|숙소|리조트/, 'hotel'], [/공항|탑승|게이트|비행기|출국/, 'travel'], [/도서관|자료실|서재|서고/, 'library'],
    [/아파트|복도|택배|엘리베이터|현관/, 'apartment'], [/스터디|독서실|카페/, 'cafe'], [/거실|할머니 댁|명절|설날|추석|펜션|안방/, 'living'],
    [/길드|게임|온라인|채팅|서버/, 'online'], [/교실|학교|학원|음악실|과학실|미술실|방송실|교무실|급식실|학생회|상담실|컴퓨터실|동아리방|별관|체육 창고/, 'school'],
    [/편의점|가게|마트|식당|약국|빵집|매장/, 'shop'], [/축제|파티|공연|행사|MT|장기자랑|무대/, 'event'],
  ];
  function themeOf(C) {
    for (const text of [C.scene && C.scene.name, C.title, C.intro]) {
      if (!text) continue;
      for (const [re, theme] of THEME_RULES) if (re.test(text)) return theme;
    }
    return CATEGORY_THEME[C.category] || 'town';
  }
  const isNight = C => /밤|저녁|새벽|야자|야간/.test(C.intro);
  const stars5 = () => [[30, 18], [70, 30], [120, 14], [300, 20], [330, 44], [180, 26]].map(([x, y], i) => `<circle class="tw" style="animation-delay:${i * 0.4}s" cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('');
  // 벽에 난 창문 (밤이면 달, 낮이면 구름)
  const win = (x, y, w, h, night) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${night ? '#1c2541' : '#a8dcf5'}" stroke="#fff" stroke-width="5"/>`
    + (night ? `<circle cx="${x + w * 0.7}" cy="${y + h * 0.3}" r="8" fill="#f6e7b0"/>` : `<g class="drift"><ellipse cx="${x + w * 0.3}" cy="${y + h * 0.35}" rx="13" ry="5" fill="#fff"/></g>`)
    + `<path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="#fff" stroke-width="4"/>`;
  const ART = {
    school: night => `
      <rect width="360" height="220" fill="#efd9b0"/><rect y="168" width="360" height="52" fill="#b98552"/>
      <path d="M0 180 H360 M0 196 H360" stroke="#a5743f" stroke-width="2"/>
      <rect x="36" y="28" width="176" height="84" rx="4" fill="#2f5d50" stroke="#7a5230" stroke-width="6"/>
      <path class="chalk" d="M54 52 h70 M54 68 h104 M54 84 h52 M150 84 l14 -14 l8 8" stroke="#eaf2ea" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <g transform="translate(246 40)"><circle r="15" fill="#fff" stroke="#25283a" stroke-width="3"/>
        <line class="hand-m" y2="-11" stroke="#25283a" stroke-width="2" stroke-linecap="round"/><line class="hand-h" y2="-6" stroke="#e2533f" stroke-width="3" stroke-linecap="round"/></g>
      <rect x="276" y="62" width="64" height="76" fill="${night ? '#1c2541' : '#a8dcf5'}" stroke="#fff" stroke-width="5"/>
      ${night ? `<circle cx="322" cy="82" r="9" fill="#f6e7b0"/>` : `<g class="drift"><ellipse cx="296" cy="84" rx="14" ry="6" fill="#fff"/></g>`}
      <path d="M308 62 V138 M276 100 H340" stroke="#fff" stroke-width="4"/>
      ${[40, 140, 240].map(x => `<rect x="${x}" y="150" width="70" height="10" rx="2" fill="#d9a066" stroke="#7a5230" stroke-width="2"/><path d="M${x + 8} 160 v16 M${x + 62} 160 v16" stroke="#7a5230" stroke-width="3"/>`).join('')}`,
    town: night => `
      <defs><linearGradient id="skyT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#151a36' : '#9fd3f0'}"/><stop offset="1" stop-color="${night ? '#3a3f6b' : '#fbe2bd'}"/></linearGradient>
      <radialGradient id="glowT"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient></defs>
      <rect width="360" height="220" fill="url(#skyT)"/>${night ? stars5() : ''}
      ${[[10, 70, 70], [90, 50, 60], [160, 80, 74], [250, 60, 66], [312, 76, 48]].map(([x, y, w], i) => `<rect x="${x}" y="${y}" width="${w}" height="${170 - y}" fill="${night ? '#262a46' : '#c98b5e'}"/>
        <polygon points="${x - 4},${y} ${x + w / 2},${y - 22} ${x + w + 4},${y}" fill="${night ? '#1d2038' : '#a5603a'}"/>
        <rect class="${i % 2 ? 'win' : 'win2'}" x="${x + 12}" y="${y + 18}" width="14" height="16" fill="${night ? '#ffd76a' : '#e8f4fb'}"/><rect x="${x + w - 26}" y="${y + 18}" width="14" height="16" fill="${night ? '#ffd76a' : '#e8f4fb'}" opacity=".85"/>`).join('')}
      <rect y="170" width="360" height="50" fill="#56596b"/><path d="M0 195 H360" stroke="#f6e7b0" stroke-width="3" stroke-dasharray="18 14"/>
      <path d="M232 170 V96 q0 -8 10 -8 h12" stroke="#25283a" stroke-width="4" fill="none"/>
      <circle class="flicker" cx="258" cy="94" r="${night ? 26 : 10}" fill="url(#glowT)"/><circle cx="258" cy="92" r="5" fill="#ffe9a0"/>`,
    event: () => `
      <rect width="360" height="220" fill="#3b2a5c"/>
      <polygon class="spot" points="180,0 120,220 240,220" fill="#fff6c8" opacity=".14"/>
      <rect x="70" y="120" width="220" height="50" fill="#7a3b2e"/><rect x="70" y="116" width="220" height="8" fill="#a8553f"/>
      <path d="M0 0 Q24 90 8 220 H0 Z M360 0 Q336 90 352 220 H360 Z" fill="#c2342b"/>
      <path d="M10 26 Q180 66 350 26" stroke="#25283a" stroke-width="1.5" fill="none"/>
      ${Array.from({ length: 13 }, (_, i) => { const x = 22 + i * 26, y = 26 + 40 * Math.sin(Math.PI * (x - 10) / 340) * 0.98; return `<circle class="${i % 2 ? 'bulb' : 'bulb2'}" cx="${x}" cy="${y}" r="4" fill="${['#ffd76a', '#ff7a8a', '#7ad3ff'][i % 3]}"/>`; }).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<polygon points="${40 + i * 32},70 ${56 + i * 32},70 ${48 + i * 32},84" fill="${['#f6cb5c', '#e2533f', '#3f73c4', '#3a9a6a'][i % 4]}"/>`).join('')}
      <rect y="170" width="360" height="50" fill="#2a1f42"/>`,
    shop: night => `
      <rect width="360" height="220" fill="#e7f0ea"/><rect y="172" width="360" height="48" fill="#c9cfd6"/>
      <rect class="flicker2" x="60" y="10" width="110" height="6" rx="3" fill="#fbfff5" stroke="#9aa" /><rect x="200" y="10" width="110" height="6" rx="3" fill="#fbfff5" stroke="#9aa"/>
      ${[40, 80, 120].map(y => `<rect x="20" y="${y}" width="160" height="6" fill="#8b6b4a"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${26 + i * 19}" y="${y - 18}" width="14" height="18" rx="2" fill="${['#e2533f', '#f6cb5c', '#3f73c4', '#3a9a6a', '#8a5cc8'][(i + y) % 5]}"/>`).join('')}`).join('')}
      <rect x="220" y="120" width="120" height="52" fill="#b9845a" stroke="#7a5230" stroke-width="3"/><rect x="290" y="98" width="34" height="22" rx="3" fill="#25283a"/><rect x="295" y="102" width="24" height="8" fill="#7ad3a0"/>
      <rect x="232" y="34" width="96" height="40" rx="8" fill="#25283a"/><text class="neon" x="280" y="62" text-anchor="middle" font-size="20" font-weight="800" fill="#ff5d7a" font-family="sans-serif">OPEN</text>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".28"/>' : ''}`,
    travel: night => `
      <rect width="360" height="220" fill="#dfe7ef"/><rect y="172" width="360" height="48" fill="#b7c2cc"/>
      <rect x="20" y="20" width="230" height="120" rx="6" fill="${night ? '#1c2541' : '#a8dcf5'}" stroke="#fff" stroke-width="6"/>
      ${night ? stars5() : '<g class="drift"><ellipse cx="80" cy="60" rx="20" ry="7" fill="#fff"/><ellipse cx="190" cy="44" rx="16" ry="6" fill="#fff"/></g>'}
      <g class="plane"><path d="M0 0 l26 -3 l8 -8 h4 l-4 9 l14 -1 l4 -5 h3 l-2 6 l2 6 h-3 l-4 -5 l-14 -1 l4 9 h-4 l-8 -8 z" fill="${night ? '#f6e7b0' : '#fff'}" stroke="#25283a" stroke-width="1"/></g>
      <path d="M97 20 V140 M174 20 V140" stroke="#fff" stroke-width="4"/>
      <rect x="268" y="24" width="76" height="70" rx="4" fill="#25283a"/>
      ${[38, 52, 66, 80].map((y, i) => `<rect x="276" y="${y - 7}" width="${40 + (i * 13) % 20}" height="6" fill="#f6cb5c" opacity=".9"/><rect class="${i === 1 ? 'blink' : ''}" x="324" y="${y - 7}" width="12" height="6" fill="${i === 1 ? '#7ad3a0' : '#f6cb5c'}"/>`).join('')}
      <rect x="270" y="132" width="30" height="40" rx="5" fill="#e2533f" stroke="#25283a" stroke-width="2"/><rect x="306" y="144" width="26" height="28" rx="5" fill="#3f73c4" stroke="#25283a" stroke-width="2"/>`,
    online: () => `
      <rect width="360" height="220" fill="#141a2e"/>
      <radialGradient id="glowO"><stop offset="0" stop-color="#3f73c4" stop-opacity=".45"/><stop offset="1" stop-color="#3f73c4" stop-opacity="0"/></radialGradient>
      <circle cx="180" cy="80" r="150" fill="url(#glowO)"/>
      <rect x="90" y="20" width="180" height="112" rx="8" fill="#0f2a44" stroke="#25283a" stroke-width="6"/>
      <clipPath id="scr"><rect x="98" y="28" width="164" height="96"/></clipPath>
      <g clip-path="url(#scr)"><g class="scroll">${Array.from({ length: 16 }, (_, i) => `<rect x="${106 + (i * 7) % 24}" y="${32 + i * 12}" width="${40 + (i * 37) % 90}" height="5" rx="2" fill="${['#7ad3a0', '#7ad3ff', '#f6cb5c', '#ff7a8a'][i % 4]}" opacity=".85"/>`).join('')}</g></g>
      <g class="bob"><rect x="224" y="92" width="18" height="18" fill="#ff7a8a"/><rect x="228" y="97" width="3" height="3" fill="#141a2e"/><rect x="235" y="97" width="3" height="3" fill="#141a2e"/></g>
      <rect x="168" y="132" width="24" height="18" fill="#25283a"/><rect x="60" y="150" width="240" height="22" rx="4" fill="#2b3150"/>
      <rect class="rgb" x="70" y="156" width="220" height="10" rx="3" fill="#7ad3ff"/>
      <rect y="172" width="360" height="48" fill="#0e1222"/>`,
    // ---- 장소별 배경 (장소 이름으로 고름: themeOf) ----
    hospital: night => `
      <rect width="360" height="220" fill="#e6f0ef"/><rect y="150" width="360" height="22" fill="#d3e2e0"/><rect y="172" width="360" height="48" fill="#bccbcf"/>
      <path d="M0 172 H360" stroke="#9fb0b4" stroke-width="2"/>
      ${win(22, 22, 86, 70, night)}
      <path d="M118 14 H350" stroke="#9aa7ab" stroke-width="3"/>
      <path d="M122 14 q6 70 0 140 h-6 q6 -70 0 -140 z M134 14 q6 70 0 140 h-8 q6 -70 0 -140z" fill="#f3b8c0" opacity=".9"/>
      <rect x="194" y="30" width="80" height="54" rx="6" fill="#1d2a2c" stroke="#25283a" stroke-width="3"/>
      <polyline class="beat" points="200,60 218,60 224,48 230,72 236,56 242,60 268,60" fill="none" stroke="#5fe08a" stroke-width="2.4" stroke-linejoin="round"/>
      <circle class="blink" cx="264" cy="40" r="3" fill="#ff5d6c"/>
      <rect x="150" y="118" width="150" height="16" rx="4" fill="#fdfdfb" stroke="#25283a" stroke-width="2"/>
      <rect x="150" y="122" width="96" height="26" rx="6" fill="#a9cfe6" stroke="#25283a" stroke-width="2"/>
      <rect x="250" y="104" width="44" height="18" rx="8" fill="#fff" stroke="#25283a" stroke-width="2"/>
      <rect x="144" y="134" width="162" height="14" fill="#c9d3d6" stroke="#25283a" stroke-width="2"/>
      <path d="M152 148 v22 M298 148 v22" stroke="#25283a" stroke-width="4"/>
      <path d="M318 34 V170 M306 170 h24" stroke="#8d989c" stroke-width="3"/><rect x="306" y="40" width="22" height="30" rx="5" fill="#dff1fb" stroke="#25283a" stroke-width="2"/>
      <path d="M317 70 q-4 40 -40 58" stroke="#8d989c" stroke-width="1.5" fill="none"/>
      <rect x="40" y="110" width="44" height="30" rx="4" fill="#fff" stroke="#25283a" stroke-width="2"/><path d="M62 116 v18 M53 125 h18" stroke="#e2533f" stroke-width="5"/>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".32"/>' : ''}`,
    hotel: night => `
      <rect width="360" height="220" fill="#f1dfbf"/><rect y="96" width="360" height="76" fill="#e6cfa4"/><path d="M0 96 H360" stroke="#b88d55" stroke-width="3"/>
      <rect y="172" width="360" height="48" fill="#efe3cc"/>
      ${Array.from({ length: 12 }, (_, i) => `<polygon points="${i * 32},172 ${i * 32 + 16},188 ${i * 32},204 ${i * 32 - 16},188" fill="#d8c3a0"/>`).join('')}
      <path d="M180 0 V18" stroke="#b88d55" stroke-width="2"/><path d="M146 30 Q180 52 214 30" stroke="#d6a640" stroke-width="3" fill="none"/>
      ${[146, 163, 180, 197, 214].map((x, i) => `<circle class="${i % 2 ? 'bulb' : 'bulb2'}" cx="${x}" cy="${i === 2 ? 44 : i % 4 ? 38 : 30}" r="4" fill="#ffe9a0"/>`).join('')}
      <rect x="26" y="122" width="170" height="50" rx="4" fill="#8a5a3a" stroke="#25283a" stroke-width="3"/><rect x="22" y="116" width="178" height="10" rx="3" fill="#a87048" stroke="#25283a" stroke-width="2"/>
      <path d="M100 116 a8 8 0 0 1 16 0 z" fill="#f2c14e" stroke="#25283a" stroke-width="1.5"/>
      <rect x="40" y="40" width="96" height="40" rx="4" fill="#25283a"/><text x="88" y="66" text-anchor="middle" font-size="14" font-weight="800" fill="#f2c14e" font-family="serif">HOTEL</text>
      <rect x="236" y="54" width="96" height="118" fill="#d6a640" stroke="#25283a" stroke-width="3"/>
      <rect x="244" y="66" width="38" height="106" fill="#cfd6dc" stroke="#25283a" stroke-width="2"/><rect x="286" y="66" width="38" height="106" fill="#cfd6dc" stroke="#25283a" stroke-width="2"/>
      <rect x="268" y="38" width="32" height="14" rx="3" fill="#25283a"/><path class="blink" d="M279 49 l5 -7 l5 7z" fill="#ff8a5c"/>
      <rect x="336" y="140" width="20" height="32" fill="#a0583a" stroke="#25283a" stroke-width="2"/><path d="M346 140 q-14 -30 0 -46 q14 16 0 46 M346 140 q-22 -14 -18 -34 M346 140 q22 -14 18 -34" fill="#3f8a55" stroke="#25283a" stroke-width="1.5"/>
      ${night ? '<rect width="360" height="220" fill="#1a1030" opacity=".22"/>' : ''}`,
    camping: night => `
      <defs><linearGradient id="skyC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#0f1534' : '#8fd0f0'}"/><stop offset="1" stop-color="${night ? '#33406e' : '#fdeccb'}"/></linearGradient>
      <radialGradient id="fireG"><stop offset="0" stop-color="#ffcf5a" stop-opacity=".8"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient></defs>
      <rect width="360" height="220" fill="url(#skyC)"/>${night ? stars5() + '<circle cx="300" cy="36" r="14" fill="#f6e7b0"/>' : '<circle cx="300" cy="40" r="16" fill="#ffd76a"/><g class="drift"><ellipse cx="90" cy="40" rx="22" ry="7" fill="#fff"/></g>'}
      <path d="M0 130 L60 80 L110 120 L170 70 L240 126 L300 90 L360 130 V220 H0Z" fill="${night ? '#243052' : '#7fae8f'}"/>
      <rect y="150" width="360" height="70" fill="${night ? '#1f3a2c' : '#5f9a56'}"/>
      ${[[20, 150], [52, 160], [318, 150], [344, 162]].map(([x, y]) => `<path d="M${x} ${y} l14 -46 l14 46z M${x + 4} ${y - 18} l10 -38 l10 38z" fill="${night ? '#16301f' : '#2f6a3a'}"/><rect x="${x + 12}" y="${y}" width="4" height="8" fill="#5a3a24"/>`).join('')}
      <path d="M96 170 L150 96 L204 170 Z" fill="#e8743b" stroke="#25283a" stroke-width="3" stroke-linejoin="round"/><path d="M150 96 L150 170 M150 120 L134 170 H166 Z" fill="#7a3b1e" stroke="#25283a" stroke-width="2"/>
      <circle class="flicker" cx="256" cy="166" r="${night ? 40 : 20}" fill="url(#fireG)"/>
      <path d="M240 178 l32 -8 M240 170 l32 8" stroke="#6b4428" stroke-width="5" stroke-linecap="round"/>
      <path class="fire" d="M256 172 q-12 -12 -2 -30 q2 10 8 10 q2 -12 -4 -20 q16 10 12 30 q-2 8 -14 10z" fill="#ff8a3c" stroke="#e2533f" stroke-width="1.5"/>
      <path class="fire" d="M256 170 q-5 -6 0 -14 q5 8 0 14z" fill="#ffe08a"/>`,
    pool: night => `
      <rect width="360" height="220" fill="#d6eef4"/>
      <g stroke="#b6d8e3" stroke-width="1">${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 30} 0 V110"/>`).join('')}${[22, 44, 66, 88].map(y => `<path d="M0 ${y} H360"/>`).join('')}</g>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${10 + i * 22}" y="20" width="20" height="78" rx="2" fill="${['#5a8fd0', '#e2533f', '#f2c14e', '#3a9a6a', '#8a5cc8'][i]}" stroke="#25283a" stroke-width="2"/><rect x="${14 + i * 22}" y="30" width="12" height="3" fill="#25283a" opacity=".5"/><circle cx="${25 + i * 22}" cy="60" r="1.6" fill="#25283a"/>`).join('')}
      <rect y="108" width="360" height="14" fill="#f3f6f8" stroke="#9fb7c2" stroke-width="2"/>
      <defs><linearGradient id="waterP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fc1e8"/><stop offset="1" stop-color="#1f7fb3"/></linearGradient></defs>
      <rect y="122" width="360" height="98" fill="url(#waterP)"/>
      <g class="wave" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2">${[138, 168, 198].map(y => `<path d="M-40 ${y} q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>`).join('')}</g>
      ${[152, 184].map(y => `<path d="M0 ${y} H360" stroke="#e2533f" stroke-width="3" stroke-dasharray="8 8"/><path d="M8 ${y} H360" stroke="#fff" stroke-width="3" stroke-dasharray="8 8"/>`).join('')}
      <path d="M296 108 V20 M320 108 V20 M296 34 h24 M296 60 h24 M296 86 h24" stroke="#c9d3d6" stroke-width="4"/><rect x="286" y="10" width="44" height="14" rx="3" fill="#e2533f" stroke="#25283a" stroke-width="2"/>
      <circle cx="210" cy="60" r="16" fill="#fff" stroke="#e2533f" stroke-width="7"/>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".3"/>' : ''}`,
    library: night => `
      <rect width="360" height="220" fill="#efe4cf"/><rect y="172" width="360" height="48" fill="#a8774a"/>
      ${[10, 128, 246].map((x, k) => `<rect x="${x}" y="16" width="104" height="156" fill="#7a5230" stroke="#25283a" stroke-width="3"/>
        ${[54, 92, 130, 168].map(y => `<rect x="${x + 4}" y="${y}" width="96" height="5" fill="#5a3a20"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${x + 6 + i * 10.4}" y="${y - 30 + ((i * 7 + k * 3 + y) % 9)}" width="8.6" height="${30 - ((i * 7 + k * 3 + y) % 9)}" fill="${['#c9483b', '#3f73c4', '#3a9a6a', '#f2c14e', '#8a5cc8', '#e8743b', '#2b8a8a'][(i + k * 2 + y) % 7]}"/>`).join('')}`).join('')}`).join('')}
      <path d="M232 20 L216 172 M250 20 L234 172 M230 40 h18 M227 70 h18 M224 100 h18 M221 130 h18 M218 160 h18" stroke="#c99b62" stroke-width="3"/>
      <rect x="120" y="150" width="120" height="10" fill="#8a5a3a" stroke="#25283a" stroke-width="2"/>
      <defs><radialGradient id="lampL"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".85"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient></defs>
      <circle cx="152" cy="150" r="${night ? 46 : 22}" fill="url(#lampL)"/>
      <path d="M150 150 v-12" stroke="#c9a24a" stroke-width="3"/><path d="M138 138 h28 l-4 -10 h-20z" fill="#2f7a4a" stroke="#25283a" stroke-width="2"/>
      <rect x="196" y="138" width="22" height="12" fill="#f4ecd8" stroke="#25283a" stroke-width="1.5"/>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".35"/>' : ''}`,
    apartment: night => `
      <rect width="360" height="220" fill="#dde2e6"/>
      <polygon points="0,220 120,150 240,150 360,220" fill="#b9bfc4"/><polygon points="0,0 120,40 240,40 360,0" fill="#eef1f3"/>
      <rect x="120" y="40" width="120" height="110" fill="#cfd5da" stroke="#25283a" stroke-width="2"/>
      <rect x="150" y="62" width="60" height="88" fill="#a9b3bb" stroke="#25283a" stroke-width="2"/><path d="M180 62 V150" stroke="#25283a" stroke-width="2"/>
      <rect x="166" y="48" width="28" height="10" rx="2" fill="#25283a"/><text class="blink" x="180" y="56.5" text-anchor="middle" font-size="8" font-weight="800" fill="#ff8a5c" font-family="sans-serif">7</text>
      ${[[0, 70], [70, 102]].map(([x, w], i) => `<polygon points="${x + 8},${30 + x * 0.33} ${x + w},${44 + x * 0.25} ${x + w},${158 - x * 0.1} ${x + 8},${190 - x * 0.35}" fill="${['#8a5a3a', '#7a4f33'][i]}" stroke="#25283a" stroke-width="2"/>
        <rect x="${x + 22}" y="${54 + x * 0.3}" width="22" height="10" rx="2" fill="#f4ecd8" stroke="#25283a" stroke-width="1"/><text x="${x + 33}" y="${62 + x * 0.3}" text-anchor="middle" font-size="7" font-weight="700" fill="#25283a" font-family="sans-serif">${70 + i + 1}</text>`).join('')}
      <rect x="252" y="150" width="34" height="26" fill="#c99b62" stroke="#25283a" stroke-width="2"/><path d="M252 158 h34 M269 150 v26" stroke="#e8d3a6" stroke-width="3"/>
      <rect x="290" y="160" width="26" height="20" fill="#b98552" stroke="#25283a" stroke-width="2"/>
      ${[[150, 14], [210, 14]].map(([x, y]) => `<rect class="${x > 180 ? 'flicker' : ''}" x="${x - 14}" y="${y}" width="28" height="5" rx="2" fill="#fbfff5" stroke="#9aa"/>`).join('')}
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".38"/>' : ''}`,
    wedding: () => `
      <rect width="360" height="220" fill="#fbeef0"/><rect y="168" width="360" height="52" fill="#f1d9de"/>
      <rect x="166" y="160" width="28" height="60" fill="#fff" opacity=".8"/>
      <path d="M100 168 V70 Q180 -6 260 70 V168" fill="none" stroke="#e6c7cf" stroke-width="12"/>
      ${Array.from({ length: 15 }, (_, i) => { const a = Math.PI * (i / 14); const x = 180 - 80 * Math.cos(a), y = 74 - 70 * Math.sin(a) * 0.92; return `<circle cx="${x}" cy="${y}" r="${7 + (i % 3)}" fill="${['#ff9fb2', '#fff', '#ffd1dc', '#f7a8c0'][i % 4]}" stroke="#d98aa0" stroke-width="1"/>`; }).join('')}
      ${[100, 260].map(x => `<circle cx="${x}" cy="110" r="9" fill="#ffd1dc" stroke="#d98aa0"/><circle cx="${x}" cy="140" r="8" fill="#fff" stroke="#d98aa0"/>`).join('')}
      ${[[30, 150], [60, 160], [300, 150], [330, 160]].map(([x, y]) => `<rect x="${x - 10}" y="${y}" width="20" height="22" rx="3" fill="#fff" stroke="#25283a" stroke-width="1.5"/><path d="M${x - 6} ${y + 2} l6 5 l6 -5 v8 l-6 -4 l-6 4z" fill="#f2a3b5"/>`).join('')}
      <rect x="20" y="96" width="44" height="10" fill="#fff" stroke="#25283a" stroke-width="1.5"/><rect x="26" y="80" width="32" height="16" fill="#fff" stroke="#25283a" stroke-width="1.5"/><rect x="32" y="66" width="20" height="14" fill="#fff" stroke="#25283a" stroke-width="1.5"/>
      <path d="M26 88 q8 4 16 0 q8 -4 16 0" stroke="#f2a3b5" stroke-width="2" fill="none"/><circle cx="42" cy="62" r="3" fill="#e2533f"/>
      ${Array.from({ length: 10 }, (_, i) => `<circle class="${i % 2 ? 'bulb' : 'bulb2'}" cx="${18 + i * 36}" cy="${10 + (i % 2) * 6}" r="3" fill="#ffe9a0"/>`).join('')}`,
    cafe: night => `
      <rect width="360" height="220" fill="#e9dccb"/><rect y="172" width="360" height="48" fill="#8a6446"/>
      <rect x="0" y="0" width="360" height="12" fill="#4a3a30"/>
      ${[20, 136, 252].map(x => `<rect x="${x}" y="60" width="96" height="70" fill="#f6efe4" stroke="#7a5a40" stroke-width="3"/><rect x="${x}" y="130" width="96" height="10" fill="#a87a52" stroke="#25283a" stroke-width="2"/><path d="M${x + 10} 140 v30 M${x + 86} 140 v30" stroke="#5a3a24" stroke-width="3"/>
        <path d="M${x + 70} 128 v-30 l-10 -8" stroke="#25283a" stroke-width="2.5" fill="none"/><path d="M${x + 52} 86 l14 -6 l4 10 z" fill="#f2c14e" stroke="#25283a" stroke-width="1.5"/>
        <rect x="${x + 14}" y="116" width="30" height="12" fill="#fff" stroke="#25283a" stroke-width="1.5"/><rect x="${x + 20}" y="112" width="20" height="4" fill="#3f73c4"/>`).join('')}
      <defs><radialGradient id="lampK"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".7"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient></defs>
      ${[80, 196, 312].map(x => `<circle cx="${x - 22}" cy="100" r="${night ? 34 : 16}" fill="url(#lampK)"/>`).join('')}
      <g transform="translate(180 32)"><circle r="14" fill="#fff" stroke="#25283a" stroke-width="3"/><line class="hand-m" y2="-10" stroke="#25283a" stroke-width="2" stroke-linecap="round"/><line class="hand-h" y2="-6" stroke="#e2533f" stroke-width="3" stroke-linecap="round"/></g>
      <rect x="40" y="18" width="70" height="26" rx="4" fill="#25283a"/><text x="75" y="36" text-anchor="middle" font-size="11" font-weight="800" fill="#f2c14e" font-family="sans-serif">STUDY</text>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".22"/>' : ''}`,
    living: night => `
      <rect width="360" height="220" fill="#f3e6cc"/>
      <g fill="#e7d4ad">${Array.from({ length: 30 }, (_, i) => `<circle cx="${12 + (i % 10) * 36}" cy="${14 + Math.floor(i / 10) * 30}" r="3"/>`).join('')}</g>
      <rect y="150" width="360" height="70" fill="#c99b62"/><path d="M0 168 H360 M0 190 H360" stroke="#b5864d" stroke-width="2"/>
      ${win(250, 24, 90, 76, night)}
      <rect x="30" y="40" width="56" height="44" fill="#fff" stroke="#8a5a3a" stroke-width="5"/><circle cx="48" cy="60" r="7" fill="#e7b48c"/><circle cx="66" cy="62" r="6" fill="#e7b48c"/><path d="M38 82 q10 -14 20 0 q8 -12 18 0" fill="#3f73c4"/>
      <rect x="20" y="108" width="140" height="44" rx="12" fill="#c75b4a" stroke="#25283a" stroke-width="3"/><rect x="14" y="96" width="152" height="24" rx="10" fill="#b44c3d" stroke="#25283a" stroke-width="3"/>
      <rect x="110" y="150" width="140" height="12" rx="3" fill="#8a5a3a" stroke="#25283a" stroke-width="2"/><path d="M122 162 v12 M238 162 v12" stroke="#5a3a24" stroke-width="5"/>
      <circle cx="150" cy="146" r="7" fill="#e2533f" stroke="#25283a" stroke-width="1.5"/><circle cx="164" cy="147" r="6" fill="#f2c14e" stroke="#25283a" stroke-width="1.5"/><rect x="190" y="140" width="30" height="10" rx="2" fill="#fff" stroke="#25283a" stroke-width="1.5"/>
      <rect x="196" y="98" width="44" height="30" rx="3" fill="#25283a"/><rect x="200" y="102" width="36" height="22" fill="${night ? '#7ad3ff' : '#3a4560'}" class="${night ? 'flicker' : ''}"/>
      ${night ? '<rect width="360" height="220" fill="#1a1030" opacity=".26"/>' : ''}`,
    amusement: night => `
      <defs><linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#1a1446' : '#8fd0f0'}"/><stop offset="1" stop-color="${night ? '#6a3b7a' : '#ffe2c4'}"/></linearGradient></defs>
      <rect width="360" height="220" fill="url(#skyA)"/>${night ? stars5() : '<g class="drift"><ellipse cx="80" cy="30" rx="20" ry="7" fill="#fff"/></g>'}
      <g transform="translate(250 92)"><g class="spin-slow">
        <circle r="70" fill="none" stroke="#25283a" stroke-width="3"/><circle r="10" fill="#25283a"/>
        ${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x2="${(70 * Math.cos(a)).toFixed(1)}" y2="${(70 * Math.sin(a)).toFixed(1)}" stroke="#25283a" stroke-width="2"/><circle cx="${(70 * Math.cos(a)).toFixed(1)}" cy="${(70 * Math.sin(a)).toFixed(1)}" r="9" fill="${['#e2533f', '#f2c14e', '#3f73c4', '#3a9a6a'][i % 4]}" stroke="#25283a" stroke-width="2"/>`; }).join('')}
      </g></g>
      <path d="M220 220 L250 92 L280 220" stroke="#25283a" stroke-width="5" fill="none"/>
      <path d="M20 150 L70 110 L120 150 Z" fill="#f7f1e3" stroke="#25283a" stroke-width="2"/>
      ${[0, 1, 2, 3].map(i => `<path d="M${20 + i * 25} 150 L70 110 L${32.5 + i * 25} 150Z" fill="#e2533f"/>`).join('')}
      <rect x="24" y="150" width="92" height="30" fill="#f2c14e" stroke="#25283a" stroke-width="2"/>${[40, 70, 100].map(x => `<path d="M${x} 150 v30" stroke="#c99b2a" stroke-width="2"/><circle class="bob" cx="${x - 8}" cy="168" r="5" fill="#fff" stroke="#25283a"/>`).join('')}
      <path d="M0 40 Q90 70 180 40" stroke="#25283a" stroke-width="1" fill="none"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle class="${i % 2 ? 'bulb' : 'bulb2'}" cx="${10 + i * 20}" cy="${41 + 14 * Math.sin(Math.PI * i / 8.5)}" r="3.4" fill="${['#ffd76a', '#ff7a8a', '#7ad3ff'][i % 3]}"/>`).join('')}
      ${[[150, 120, '#ff7a8a'], [164, 110, '#7ad3ff'], [176, 124, '#f2c14e']].map(([x, y, c]) => `<g class="bob"><path d="M${x} ${y + 12} q-3 20 4 34" stroke="#25283a" fill="none"/><ellipse cx="${x}" cy="${y}" rx="9" ry="11" fill="${c}" stroke="#25283a" stroke-width="1.5"/></g>`).join('')}
      <rect y="186" width="360" height="34" fill="${night ? '#3a2a52' : '#d8b98a'}"/>`,
    subway: night => `
      <rect width="360" height="220" fill="#e8ecef"/>
      <g stroke="#cfd6db" stroke-width="1">${Array.from({ length: 24 }, (_, i) => `<path d="M${i * 15} 0 V130"/>`).join('')}${Array.from({ length: 9 }, (_, i) => `<path d="M0 ${i * 15} H360"/>`).join('')}</g>
      <rect x="20" y="20" width="160" height="34" rx="4" fill="#2a3a5a"/><circle cx="44" cy="37" r="11" fill="#3a9a6a" stroke="#fff" stroke-width="2"/><text x="44" y="41" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="sans-serif">2</text>
      <text x="112" y="43" text-anchor="middle" font-size="16" font-weight="800" fill="#fff" font-family="sans-serif">탐정역</text>
      <rect x="20" y="64" width="160" height="10" rx="5" fill="#3a9a6a"/>${[40, 80, 120, 160].map(x => `<circle cx="${x}" cy="69" r="4" fill="#fff" stroke="#25283a"/>`).join('')}
      <rect x="194" y="20" width="22" height="110" fill="#b8c2c8" stroke="#25283a" stroke-width="2"/>
      <g class="train"><rect x="228" y="26" width="200" height="104" rx="12" fill="#d7dde2" stroke="#25283a" stroke-width="3"/><rect x="228" y="44" width="200" height="8" fill="#3a9a6a"/>
        ${[240, 290, 340].map(x => `<rect x="${x}" y="58" width="38" height="34" rx="4" fill="${night ? '#ffe9a0' : '#8fb8d0'}" stroke="#25283a" stroke-width="2"/>`).join('')}</g>
      <rect y="130" width="360" height="42" fill="#bfc6cc"/><rect y="130" width="360" height="8" fill="#f2c14e"/><g fill="#d9a826">${Array.from({ length: 36 }, (_, i) => `<circle cx="${5 + i * 10}" cy="134" r="1.5"/>`).join('')}</g>
      <rect y="172" width="360" height="48" fill="#9aa3aa"/>
      <rect x="60" y="150" width="90" height="10" rx="3" fill="#3f73c4" stroke="#25283a" stroke-width="2"/><path d="M68 160 v12 M142 160 v12" stroke="#25283a" stroke-width="3"/>
      ${night ? '<rect width="360" height="220" fill="#0b1030" opacity=".2"/>' : ''}`,
    pcroom: () => `
      <rect width="360" height="220" fill="#151826"/>
      <rect x="0" y="0" width="360" height="8" fill="#0d0f1a"/><rect class="rgb" x="0" y="8" width="360" height="3" fill="#7ad3ff"/>
      <rect x="128" y="18" width="104" height="34" rx="8" fill="#0d0f1a" stroke="#ff5d7a" stroke-width="2"/><text class="neon" x="180" y="42" text-anchor="middle" font-size="18" font-weight="900" fill="#ff5d7a" font-family="sans-serif">PC방</text>
      ${[0, 1].map(row => Array.from({ length: 5 }, (_, i) => { const x = 14 + i * 70 + row * 10, y = 70 + row * 56, s = 1 - row * 0.1; return `<rect x="${x}" y="${y}" width="${54 * s}" height="${34 * s}" rx="3" fill="#0d0f1a" stroke="#3a4060" stroke-width="2"/><rect class="${(i + row) % 2 ? 'flicker' : ''}" x="${x + 3}" y="${y + 3}" width="${48 * s}" height="${28 * s}" fill="${['#2b5a8a', '#3a7a5a', '#6a3a8a', '#8a5a2a', '#2a6a7a'][(i + row * 2) % 5]}"/><rect x="${x + 6}" y="${y + 8}" width="${20 * s}" height="4" fill="#fff" opacity=".5"/>`; }).join('')).join('')}
      <rect x="0" y="160" width="360" height="12" fill="#2b2f44"/>
      ${Array.from({ length: 6 }, (_, i) => `<path d="M${22 + i * 62} 220 v-40 q0 -12 14 -12 h12 q14 0 14 12 v40" fill="#22263a" stroke="#ff5d7a" stroke-opacity=".5" stroke-width="2"/>`).join('')}`,
    gym: () => `
      <rect width="360" height="220" fill="#e8dcc6"/>
      ${[0, 1, 2].map(r => `<rect x="0" y="${20 + r * 22}" width="360" height="18" fill="${['#c7b08a', '#bba37c', '#ad9570'][r]}"/>${Array.from({ length: 18 }, (_, i) => `<circle cx="${10 + i * 20 + (r % 2) * 10}" cy="${26 + r * 22}" r="4" fill="${['#e2533f', '#3f73c4', '#f2c14e', '#3a9a6a'][(i + r) % 4]}" opacity=".75"/>`).join('')}`).join('')}
      <rect x="120" y="4" width="120" height="14" rx="3" fill="#25283a"/><text x="150" y="15" text-anchor="middle" font-size="10" font-weight="800" fill="#ff8a5c" font-family="monospace">48</text><text x="210" y="15" text-anchor="middle" font-size="10" font-weight="800" fill="#ff8a5c" font-family="monospace" class="blink">47</text>
      <rect y="92" width="360" height="128" fill="#d9a066"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 42} 92 V220" stroke="#c98f55" stroke-width="2"/>`).join('')}
      <path d="M0 200 Q180 120 360 200" stroke="#fff" stroke-width="3" fill="none"/><circle cx="180" cy="220" r="34" stroke="#fff" stroke-width="3" fill="none"/>
      <rect x="290" y="72" width="64" height="44" fill="#fff" stroke="#25283a" stroke-width="3"/><rect x="310" y="90" width="24" height="18" fill="none" stroke="#e2533f" stroke-width="2"/>
      <path d="M296 116 h40" stroke="#e8743b" stroke-width="4"/><path d="M298 118 l6 18 l6 -18 l6 18 l6 -18 l6 18 l6 -18" stroke="#fff" stroke-width="1.5" fill="none"/>
      <path d="M354 116 v104" stroke="#5a6070" stroke-width="6"/>
      <g class="bob"><circle cx="90" cy="170" r="14" fill="#e8743b" stroke="#25283a" stroke-width="2"/><path d="M76 170 h28 M90 156 v28 M80 160 q10 10 0 20 M100 160 q-10 10 0 20" stroke="#25283a" stroke-width="1.2" fill="none"/></g>`,
    museum: night => `
      <rect width="360" height="220" fill="${night ? '#3b3a4a' : '#ece4d2'}"/><rect width="360" height="14" fill="${night ? '#2a2936' : '#d8ccb2'}"/>
      ${[60, 180, 300].map(x => `<rect x="${x - 10}" y="14" width="20" height="6" fill="#25283a"/><polygon points="${x - 8},20 ${x + 8},20 ${x + 34},160 ${x - 34},160" fill="#fff6d0" opacity="${night ? '.07' : '.22'}"/>`).join('')}
      <rect y="160" width="360" height="60" fill="#b9a27c"/>
      ${Array.from({ length: 18 }, (_, i) => `<rect x="${i * 20}" y="${160 + (i % 2) * 15}" width="20" height="15" fill="#a68d66"/><rect x="${i * 20}" y="${190 + ((i + 1) % 2) * 15}" width="20" height="15" fill="#a68d66"/>`).join('')}
      <rect x="22" y="36" width="74" height="56" fill="#c9a24a" stroke="#25283a" stroke-width="3"/><rect x="30" y="44" width="58" height="40" fill="#7fb0d8"/><circle cx="76" cy="54" r="6" fill="#f6e7b0"/><path d="M30 84 l18 -18 l14 12 l10 -8 l16 14z" fill="#3a9a6a"/>
      <rect x="46" y="98" width="26" height="8" fill="#fff" stroke="#25283a" stroke-width="1"/>
      <rect x="268" y="28" width="64" height="78" fill="#c9a24a" stroke="#25283a" stroke-width="3"/><rect x="276" y="36" width="48" height="62" fill="#e9d6b8"/><circle cx="300" cy="58" r="10" fill="#e7b48c"/><path d="M290 54 q10 -14 20 0" fill="#3a2a24"/><path d="M282 98 q18 -30 36 0z" fill="#8a3a4a"/>
      <rect x="140" y="98" width="80" height="62" fill="#ddd3c2" stroke="#25283a" stroke-width="3"/><rect x="134" y="92" width="92" height="10" fill="#cfc4b0" stroke="#25283a" stroke-width="2"/>
      <rect x="146" y="44" width="68" height="48" fill="#bfe3f0" fill-opacity=".4" stroke="#25283a" stroke-width="2.5"/>
      <path d="M172 90 q-12 -14 0 -28 h16 q12 14 0 28z" fill="#3f73c4" stroke="#25283a" stroke-width="2"/><path d="M174 70 h12 M172 78 h16" stroke="#f2c14e" stroke-width="2"/>
      <path d="M152 50 l10 0 M152 56 l5 0" stroke="#fff" stroke-width="2" opacity=".8"/>
      <path d="M104 160 v-34 M256 160 v-34" stroke="#c9a24a" stroke-width="4"/><circle cx="104" cy="124" r="4.5" fill="#c9a24a"/><circle cx="256" cy="124" r="4.5" fill="#c9a24a"/>
      <path d="M104 130 q76 24 152 0" stroke="#b33a3a" stroke-width="4" fill="none"/>
      <rect x="150" y="112" width="60" height="16" rx="2" fill="#25283a"/><text x="180" y="124" text-anchor="middle" font-size="10" font-weight="800" fill="#f2c14e" font-family="sans-serif">특별전</text>
      ${night ? `<rect width="360" height="220" fill="#0b1030" opacity=".35"/><g class="spot"><polygon points="180,0 120,220 240,220" fill="#fff3c0" opacity=".16"/></g>` : ''}`,
    cinema: () => `
      <rect width="360" height="220" fill="#1d1824"/>
      <rect x="56" y="14" width="248" height="106" fill="#0d0b12"/>
      <rect class="flicker2" x="62" y="18" width="236" height="98" fill="#dfe7f0"/>
      <g class="drift"><rect x="150" y="56" width="22" height="40" rx="6" fill="#25283a"/><circle cx="161" cy="48" r="10" fill="#25283a"/><path d="M146 44 h30 l-4 -8 h-22z" fill="#25283a"/></g>
      <circle cx="250" cy="44" r="12" fill="#f2c14e" opacity=".7"/><path d="M62 104 q60 -20 120 0 t116 -4 V116 H62z" fill="#8aa0b4"/>
      <polygon points="180,0 70,120 290,120" fill="#fff" opacity=".06"/>
      <path d="M0 0 h70 q-14 60 0 130 h-70z" fill="#8a1f2b"/><path d="M360 0 h-70 q14 60 0 130 h70z" fill="#8a1f2b"/>
      <path d="M10 0 q-4 60 0 130 M30 0 q-6 60 0 130 M50 0 q-8 60 0 130 M350 0 q4 60 0 130 M330 0 q6 60 0 130 M310 0 q8 60 0 130" stroke="#6a1420" stroke-width="3" fill="none"/>
      <rect width="360" height="12" fill="#6a1420"/>
      ${[[136, 26, 9], [162, 30, 10], [190, 36, 11]].map(([y, w, n]) => Array.from({ length: n }, (_, i) => { const x = (360 - n * w) / 2 + i * w; return `<rect x="${x + 2}" y="${y}" width="${w - 4}" height="${w * 0.9}" rx="${w * 0.25}" fill="#b0283a" stroke="#25283a" stroke-width="2"/>`; }).join('')).join('')}
      <rect x="312" y="132" width="34" height="13" rx="2" fill="#1f7a4a"/><text class="neon" x="329" y="142" text-anchor="middle" font-size="9" font-weight="800" fill="#c8ffd8" font-family="sans-serif">EXIT</text>
      <g transform="translate(52 160)"><path d="M0 0 h18 l-3 22 h-12z" fill="#fff" stroke="#25283a" stroke-width="1.5"/><path d="M2 0 v20 M8 0 v22 M14 0 v20" stroke="#e2533f" stroke-width="2"/><circle cx="4" cy="-2" r="3.5" fill="#fff4c8"/><circle cx="10" cy="-4" r="3.5" fill="#fff4c8"/><circle cx="15" cy="-1" r="3" fill="#fff4c8"/></g>`,
    aquarium: () => `
      <defs><linearGradient id="seaQ" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fc4e8"/><stop offset="1" stop-color="#1d4f8a"/></linearGradient></defs>
      <rect width="360" height="220" fill="#1a2b44"/>
      <rect x="14" y="12" width="332" height="150" rx="10" fill="url(#seaQ)" stroke="#25283a" stroke-width="4"/>
      <g opacity=".25">${[60, 140, 220, 300].map(x => `<polygon points="${x},12 ${x + 20},12 ${x - 10},162 ${x - 30},162" fill="#fff"/>`).join('')}</g>
      <path d="M14 150 q40 -10 80 0 t80 0 t80 0 t92 0 V162 H14z" fill="#e8d6a0"/>
      ${[40, 70, 260, 300, 322].map((x, i) => `<path class="sway" style="animation-delay:${i * 0.5}s" d="M${x} 156 q-10 -24 0 -46 q10 -20 0 -40" stroke="#2f8a5a" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}
      <g class="swim"><path d="M0 60 q18 -14 34 0 q-16 14 -34 0z M34 60 l12 -9 v18z" fill="#f2a03a" stroke="#25283a" stroke-width="1.5"/><path d="M12 52 v16 M20 50 v20" stroke="#fff" stroke-width="3"/><circle cx="7" cy="58" r="1.8" fill="#25283a"/></g>
      <g class="swim2"><path d="M300 100 q-14 -11 -28 0 q14 11 28 0z M272 100 l-10 -7 v14z" fill="#ffd166" stroke="#25283a" stroke-width="1.5"/><circle cx="277" cy="98" r="1.6" fill="#25283a"/></g>
      <g class="swim" style="animation-duration:18s;animation-delay:-6s"><path d="M0 120 q10 -8 20 0 q-10 8 -20 0z M20 120 l7 -5 v10z" fill="#7ad3ff" stroke="#25283a" stroke-width="1.2"/></g>
      <g class="bob"><path d="M182 40 q16 -22 32 0z" fill="#ffb3d1" opacity=".85" stroke="#25283a" stroke-width="1.2"/><path d="M186 40 q-2 14 2 22 M194 40 q2 16 -2 26 M202 40 q-2 14 2 22 M210 40 q2 12 -1 18" stroke="#ff8ab8" stroke-width="1.5" fill="none"/></g>
      ${[[110, 140], [118, 150], [230, 136], [236, 148]].map(([x, y], i) => `<circle class="bubble" style="animation-delay:${i * 0.9}s" cx="${x}" cy="${y}" r="${3 + (i % 2)}" fill="none" stroke="#fff" stroke-width="1.5"/>`).join('')}
      <rect y="166" width="360" height="54" fill="#22324e"/><rect y="166" width="360" height="6" fill="#3a4f74"/>
      <path d="M0 184 H360" stroke="#9fb3c8" stroke-width="4"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${18 + i * 36} 184 v36" stroke="#9fb3c8" stroke-width="3"/>`).join('')}`,
    market: night => `
      <defs><linearGradient id="skyM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#1d1840' : '#9fd3f0'}"/><stop offset="1" stop-color="${night ? '#5a3460' : '#ffe9c8'}"/></linearGradient></defs>
      <rect width="360" height="220" fill="url(#skyM)"/>${night ? stars5() : '<g class="drift"><ellipse cx="90" cy="24" rx="18" ry="6" fill="#fff"/></g>'}
      <path d="M0 26 Q90 50 180 26 T360 26" stroke="#25283a" stroke-width="1" fill="none"/>
      ${Array.from({ length: 9 }, (_, i) => { const x = 20 + i * 40, y = 26 + 12 * Math.sin(Math.PI * ((x % 180) / 180)); return `<path d="M${x} ${y.toFixed(1)} v6" stroke="#25283a"/><ellipse class="${i % 2 ? 'bulb' : 'bulb2'}" cx="${x}" cy="${(y + 14).toFixed(1)}" rx="7" ry="9" fill="${night ? ['#ff7a5c', '#ffd76a'][i % 2] : '#e2533f'}" stroke="#25283a" stroke-width="1.5"/>`; }).join('')}
      ${[[6, '#e2533f', '떡볶이'], [124, '#3f73c4', '호떡'], [242, '#3a9a6a', '과일']].map(([x, c, name]) => `
        <rect x="${x}" y="78" width="112" height="16" rx="3" fill="#fff" stroke="#25283a" stroke-width="2"/><text x="${x + 56}" y="90" text-anchor="middle" font-size="11" font-weight="800" fill="${c}" font-family="sans-serif">${name}</text>
        <path d="M${x} 94 h112 l8 22 h-128z" fill="${c}" stroke="#25283a" stroke-width="2"/>${Array.from({ length: 4 }, (_, k) => `<path d="M${x + 14 + k * 28} 94 l-2 22 h14 l2 -22z" fill="#fff" opacity=".85"/>`).join('')}
        <path d="M${x + 4} 116 v54 M${x + 108} 116 v54" stroke="#6b4a2e" stroke-width="4"/>
        <rect x="${x - 2}" y="142" width="116" height="30" fill="#c99b62" stroke="#25283a" stroke-width="2"/>`).join('')}
      <ellipse cx="62" cy="140" rx="30" ry="7" fill="#5a6070" stroke="#25283a" stroke-width="2"/><ellipse cx="62" cy="138" rx="24" ry="4" fill="#e2533f"/>
      ${[50, 62, 74].map((x, i) => `<path class="steam" style="animation-delay:${i * 0.6}s" d="M${x} 128 q-5 -8 0 -16 q5 -8 0 -16" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8"/>`).join('')}
      ${[160, 180, 200].map(x => `<ellipse cx="${x}" cy="138" rx="9" ry="5" fill="#d8954a" stroke="#25283a" stroke-width="1.5"/>`).join('')}
      ${[[272, '#e2533f'], [288, '#f2a03a'], [304, '#f2c14e'], [320, '#3a9a6a'], [280, '#8a3a8a']].map(([x, c], i) => `<circle cx="${x + (i > 3 ? 18 : 0)}" cy="${i > 3 ? 128 : 136}" r="7" fill="${c}" stroke="#25283a" stroke-width="1.5"/>`).join('')}
      <rect y="172" width="360" height="48" fill="${night ? '#3a3046' : '#cdb894'}"/>
      ${night ? '<rect width="360" height="220" fill="#1a1030" opacity=".18"/>' : ''}`,
  };
  const art = (theme, night) => `<svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" class="art art-${theme}${night ? ' night' : ''}">${(ART[theme] || ART.town)(night)}</svg>`;
  // 장소 단서를 놓는 자리 (그림 위 %)
  const SLOTS = [[14, 30], [38, 16], [65, 27], [87, 22], [36, 52]];
  const JUNK = ['먼지만 쌓여 있다.', '아무것도 없다.', '오래된 영수증 한 장. 사건과는 관계없어 보인다.', '떨어진 머리끈. 누구 건지 알 수 없다.', '구겨진 메모: "우유 사 오기". 상관없어 보인다.', '사탕 껍질이 몇 개. 사건과는 관계없는 듯.'];
  const OPENERS = ['무슨 일이에요? 저 바쁜데…', '저도 놀랐어요. 진짜예요.', '뭐든 물어보세요. 숨길 거 없어요.', '하아… 빨리 끝내 주세요.', '제가 의심받는 거예요?', '기억나는 대로 말할게요.'];
  const LEVELS = [
    { actions: Infinity, related: true },
    { actions: 16, related: true },
    { actions: 13, related: false },
    { actions: 11, related: false },
  ];

  // ---------- 타자 효과 ----------
  // 다 쓰이기 전에 누르면 바로 끝까지 보인다. 다 쓰이면 resolve.
  function typeInto(el, text, speed = 24) {
    return new Promise(res => {
      if (reduced() || !text) { el.textContent = text; return res(); }
      let i = 0, timer = null;
      const done = () => { clearInterval(timer); el.textContent = text; el.classList.remove('typing'); el.removeEventListener('click', done); res(); };
      el.classList.add('typing'); el.textContent = '';
      el.addEventListener('click', done);
      timer = setInterval(() => {
        if (!el.isConnected) return done();
        i++; el.textContent = text.slice(0, i);
        if (i % 3 === 1) sfx('type');
        if (i >= text.length) done();
      }, speed);
    });
  }

  DO.investigate = function investigate(root, C, opt = {}) {
    const lv = LEVELS[Math.max(0, Math.min(3, opt.level | 0))];
    const R = rng(hashString(`inv:${C.id}:${opt.variant | 0}`));
    const theme = themeOf(C), night = isNight(C);
    const condOf = tag => C.conditions.find(c => c.tag === tag);
    const clause = tag => condOf(tag).text.replace(/\s*접어\s*$/, '').replace(/\s*사람$/, '');
    const claims = (s, tag) => s.traits.includes(tag) !== s.lies.includes(tag);
    const culprit = C.suspects.find(s => s.id === C.culprit);
    const sus = C.suspects;
    const allTags = C.conditions.map(c => c.tag);
    const clueTags = C.clues.map(c => c.exposes).filter(t => t && condOf(t));
    const lieTags = culprit.lies.filter(t => condOf(t) && C.clues.some(c => c.exposes === t));
    const needHits = opt.boss ? Math.min(2, lieTags.length) : 1;   // 보스는 모순을 두 번

    // 처음 듣는 알리바이: 모두 2~3마디로 겉보기엔 같다. 범인은 거짓말 주제 + 사실 하나, 나머지는 단서 주제 + 자기 일.
    const alibiTags = {};
    for (const s of sus) {
      let tags;
      if (s === culprit) tags = [...lieTags, ...shuffle(allTags.filter(t => !s.lies.includes(t) && s.traits.includes(t)), R).slice(0, 1)];
      else tags = [...shuffle(clueTags, R).slice(0, R() < 0.6 ? 2 : 1), ...shuffle(allTags.filter(t => !clueTags.includes(t) && s.traits.includes(t)), R).slice(0, 1)];
      tags = [...new Set(tags)];
      for (const t of shuffle(allTags, R)) { if (tags.length >= 2) break; if (!tags.includes(t)) tags.push(t); }
      alibiTags[s.id] = shuffle(tags, R).slice(0, 3);
    }
    const sayOf = (s, tag) => (claims(s, tag) ? `${clause(tag)} 사람, 그건 저예요.` : `${clause(tag)} 사람이요? 그건 제가 아니에요.`);
    const opener = s => OPENERS[hashString(C.id + s.id) % OPENERS.length];

    // 장소와 숨은 물건
    const spotsSrc = (C.scene && C.scene.spots && C.scene.spots.length ? C.scene.spots : [['🗄', '서랍장'], ['🪑', '의자 밑'], ['🗑', '휴지통'], ['📦', '상자 더미'], ['🚪', '문 뒤']]).slice(0, 5);
    while (spotsSrc.length < 4) spotsSrc.push([['🗑', '휴지통'], ['📦', '상자 더미']][spotsSrc.length % 2]);
    const spots = spotsSrc.map(([emoji, name], i) => ({ emoji, name, slot: SLOTS[i], item: null, searched: false }));
    const order = shuffle(spots.map((_, i) => i), R);
    shuffle(C.clues, R).forEach((c, k) => { if (order[k] != null) spots[order[k]].item = { clue: c }; });
    spots.forEach(sp => { if (!sp.item) sp.item = { junk: JUNK[Math.floor(R() * JUNK.length)] }; });
    // 단서가 장소보다 많으면(장소 4곳 + 단서 3장은 충분) 남은 단서는 마지막 장소에 함께
    C.clues.forEach(c => { if (!spots.some(sp => sp.item.clue === c)) spots[spots.length - 1].item.extra = c; });

    // 진행 상태
    let actions = lv.actions + (opt.actionsBonus | 0) + (opt.boss ? 2 : 0);   // 보스는 증거가 둘 필요해서 +2
    let hearts = 3 + (opt.heartsBonus | 0);
    let hintsLeftFree = opt.freeHints | 0, hintsUsed = 0, hintsAll = 0;
    const found = [];                         // 찾은 단서 (순서대로)
    const heard = {}; sus.forEach(s => { heard[s.id] = []; });   // 들은 말: { tag, yes, text }
    const shown = {}; sus.forEach(s => { shown[s.id] = new Set(); });  // 그 사람에게 보여 준 단서 id
    const marks = {}; sus.forEach(s => { marks[s.id] = 0; });    // 0 없음, 1 결백, 2 의심
    const hits = new Set();                   // 찌른 모순(주제)
    let log = '어디부터 조사할까? 그림 속 장소나 사람을 눌러 보세요.';
    if (opt.gut) { const inn = shuffle(sus.filter(s => s !== culprit), R)[0]; if (inn) { marks[inn.id] = 1; log = `🔮 직감: ${DO.josa(inn.name, '은/는')} 왠지 결백해 보인다. (수첩에 ✅)`; } }

    const face = (s, size, mood) => DO.face(C, s, size, mood);
    const nameOf = s => s.name;
    const record = (s, tag) => {
      if (!tag || !condOf(tag)) return null;
      if (heard[s.id].some(x => x.tag === tag)) return null;
      const st = { tag, yes: claims(s, tag), text: sayOf(s, tag) };
      heard[s.id].push(st);
      return st;
    };
    const spend = () => { if (actions !== Infinity) actions = Math.max(0, actions - 1); };
    const outOfTime = () => actions !== Infinity && actions <= 0;
    const heartsText = () => '❤️'.repeat(hearts) + '🤍'.repeat(Math.max(0, 3 + (opt.heartsBonus | 0) - hearts));
    const starsNow = () => Math.max(1, Math.min(3, hearts) - hintsUsed);
    const relatedLine = c => (lv.related && c.exposes && condOf(c.exposes) ? h('p', { class: 'muted small-text' }, `🔗 관련 이야기: "${clause(c.exposes)} 사람"`) : null);

    // 배경마다 다른 곡: 교실 = 초침, 골목 = 밤엔 빗소리 / 낮엔 취조실 블루스, 축제 = 파티 그루브, 가게 = 밤엔 어두운 방 / 낮엔 블루스,
    // 여행 = 밤엔 빗소리 / 낮엔 보사노바, 온라인 = 사이버 아르페지오
    const THEME_MUSIC = {
      school: 'think', town: night ? 'rainy' : 'interrogation', event: 'party', shop: night ? 'explore' : 'interrogation', travel: night ? 'rainy' : 'bossa', online: 'cyber',
      hospital: night ? 'explore' : 'think', hotel: 'swing', camping: night ? 'rainy' : 'bossa', pool: 'bossa', library: 'think', apartment: night ? 'rainy' : 'interrogation',
      wedding: 'swing', cafe: 'think', living: 'swing', amusement: 'party', subway: night ? 'rainy' : 'interrogation', pcroom: 'cyber', gym: 'party',
      museum: night ? 'explore' : 'think', cinema: 'explore', aquarium: 'bossa', market: night ? 'swing' : 'bossa',
    };
    const music = (fn, ...a) => { if (DO.music && DO.music[fn]) DO.music[fn](...a); };
    music('base', THEME_MUSIC[theme] || 'think');
    music('intensity', opt.boss ? 1 : 0);
    // 긴장도: 신뢰를 잃었거나 조사 횟수가 거의 없으면 곡에 층이 더해진다 (보스는 처음부터 한 단계)
    const tension = () => {
      const maxH = 3 + (opt.heartsBonus | 0);
      const n = hearts <= 1 ? 2 : (hearts < maxH || (actions !== Infinity && actions <= 3)) ? 1 : 0;
      music('intensity', Math.max(n, opt.boss ? 1 : 0));
    };

    // ---------- 1. 도입 영상 ----------
    function opening() {
      const sentences = (C.intro.match(/[^.!?]+[.!?]?/g) || [C.intro]).map(x => x.trim()).filter(Boolean);
      const shots = [
        { kind: 'title' },
        ...sentences.map(t => ({ kind: 'pan', text: t })),
        { kind: 'lineup', text: `용의자는 ${sus.length}명. 이 중 한 명이 거짓말을 하고 있다.` },
      ];
      let k = 0;
      const cap = h('p', { class: 'cine-cap' });
      const stage = h('div', { class: 'cine-stage', html: art(theme, night) });
      const over = h('div', { class: 'cine-over' });
      const next = () => { k++; if (k >= shots.length) return scene(); show(); };
      const nextBtn = h('button', { class: 'primary', onClick: next }, '▶ 다음');
      const box = h('div', { class: 'cine' + (opt.boss ? ' boss' : '') }, h('div', { class: 'cine-bar top' }), stage, over, h('div', { class: 'cine-bar bottom' }));
      function show() {
        const s = shots[k];
        stage.className = 'cine-stage ' + (s.kind === 'pan' ? `pan pan-${k % 2}` : s.kind === 'title' ? 'dim' : 'dim');
        over.replaceChildren();
        if (s.kind === 'title') {
          over.append(h('div', { class: 'cine-title' },
            h('div', { class: 'cine-kicker' }, opt.boss ? '👑 BOSS CASE' : 'CASE FILE'),
            h('div', { class: 'cine-name' }, C.title),
            h('div', { class: 'cine-place' }, `📍 ${(C.scene && C.scene.name) || '사건 현장'}`)));
          cap.textContent = '';
          sfx(opt.boss ? 'bossOpen' : 'caseOpen');
        } else if (s.kind === 'lineup') {
          over.append(h('div', { class: 'lineup-cine' }, sus.map((x, i) => h('div', { class: 'lc', style: `animation-delay:${0.12 * i}s` }, face(x, sus.length > 5 ? 44 : 52), h('span', {}, nameOf(x))))));
          typeInto(cap, s.text);
          sfx('whoosh');
          sus.forEach((_, i) => sfx('coin', { delay: 0.15 + 0.12 * i, step: i * 2 })); // 한 명씩 등장할 때마다 톡
        } else typeInto(cap, s.text);
        nextBtn.textContent = k === shots.length - 1 ? '🔍 수사 시작' : '▶ 다음';
      }
      render(root, box, cap, nextBtn, h('button', { class: 'small', onClick: () => scene() }, '⏩ 건너뛰기'));
      show();
    }

    // ---------- 2. 현장 ----------
    function hud() {
      return h('div', { class: 'inv-hud' },
        h('span', { class: 'grow' }, `📍 ${(C.scene && C.scene.name) || '사건 현장'}`),
        h('span', { title: '남은 조사 횟수' }, actions === Infinity ? '👣 ∞' : `👣 ${actions}`),
        h('span', { title: '신뢰' }, heartsText()));
    }
    function scene(msg) {
      if (msg) log = msg;
      // 카메라 층(cam) 안에 그림·장소·사람을 넣고, 조사할 때 cam 만 확대한다
      const cam = h('div', { class: 'inv-cam', html: art(theme, night) });
      const stage = h('div', { class: 'inv-stage' }, cam);
      spots.forEach(sp => {
        const sparkle = opt.lens && !sp.searched && sp.item.clue;
        cam.append(h('button', {
          class: 'hot' + (sp.searched ? ' done' : '') + (sparkle ? ' sparkle' : ''), style: `left:${sp.slot[0]}%; top:${sp.slot[1]}%`,
          'data-quiet': '1', 'aria-label': sp.name, onClick: () => search(sp, cam),
        }, h('span', { class: 'hot-emoji' }, sp.searched ? '✔️' : sp.emoji), h('span', { class: 'hot-name' }, sp.name)));
      });
      cam.append(h('div', { class: 'hot-people' }, sus.map(s => h('button', {
        class: 'hot-person' + (heard[s.id].length ? ' talked' : '') + (marks[s.id] === 1 ? ' cleared' : marks[s.id] === 2 ? ' sus' : ''),
        'data-quiet': '1', 'aria-label': s.name, onClick: () => talk(s),
      }, face(s, 40), h('span', {}, s.name)))));
      tension();
      const canDeduce = found.length && sus.some(s => heard[s.id].length);
      render(root,
        hud(), stage,
        h('div', { class: 'inv-log' }, log),
        h('div', { class: 'row' },
          h('button', { class: 'grow', onClick: () => notebook() }, `📓 수첩 (${found.length + sus.reduce((n, s) => n + heard[s.id].length, 0)})`),
          h('button', { class: 'grow', onClick: () => hint() }, `🐕 조수 콩이${hintsLeftFree ? ' (무료)' : ''}`)),
        h('button', { class: 'danger', disabled: !canDeduce, onClick: () => deduce() }, canDeduce ? '🔎 추리 시작' : '🔎 추리 (단서와 진술을 먼저 모으세요)'),
        outOfTime() ? h('p', { class: 'muted small-text center' }, '조사 횟수를 다 썼다. 이제 모은 것으로 추리해야 한다.') : null,
      );
    }

    // 장소 조사: 돋보기로 확대 → 결과 카드
    function search(sp, cam) {
      if (sp.searched) return scene(`${sp.emoji} ${sp.name}: 이미 조사한 곳이다.`);
      if (outOfTime()) { DO.toast('조사 횟수를 다 썼습니다. 추리를 시작하세요.'); return; }
      spend(); sp.searched = true;
      sfx('zoom'); sfx('rummage', { delay: 0.45 });
      cam.style.transformOrigin = `${sp.slot[0]}% ${sp.slot[1]}%`;
      cam.classList.add('zoom');
      cam.append(h('div', { class: 'magnifier', style: `left:${sp.slot[0]}%; top:${sp.slot[1]}%` }, '🔍'));
      root.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const skip = h('button', { class: 'small', onClick: () => reveal() }, '⏩');
      root.append(skip);
      let doneOnce = false;
      const reveal = () => {
        if (doneOnce) return; doneOnce = true;
        const clues = [sp.item.clue, sp.item.extra].filter(Boolean);
        if (!clues.length) { sfx('empty'); return scene(`${sp.emoji} ${sp.name}: ${sp.item.junk}`); }
        clues.forEach(c => { if (!found.includes(c)) found.push(c); });
        sfx('clue');
        // 클로즈업: 그 장소를 크게 비춘 장면 위에 단서 카드
        const close = h('div', { class: 'closeup', html: art(theme, night) }, h('div', { class: 'closeup-emoji' }, sp.emoji));
        close.querySelector('svg').style.transformOrigin = `${sp.slot[0]}% ${sp.slot[1]}%`;
        render(root, hud(), close,
          h('div', { class: 'clue-pop' },
            h('div', { class: 'clue-kicker' }, '🗂 단서 획득!'),
            clues.map(c => h('div', { class: 'card clue-card' }, h('p', {}, c.text), relatedLine(c))),
            h('p', { class: 'muted small-text' }, `${sp.emoji} ${sp.name}에서 찾았다. 수첩에 기록했다.`)),
          h('button', { class: 'primary', onClick: () => scene(`📓 단서를 수첩에 적었다. 누구의 말과 부딪히는지 생각해 보자.`) }, '📓 수첩에 기록하고 계속'));
      };
      setTimeout(reveal, reduced() ? 0 : 1100);
    }

    // ---------- 대화 (비주얼 노벨) ----------
    function talk(s, said) {
      const bubble = h('p', { class: 'vn-bubble' });
      const first = !heard[s.id].length && !said;
      const offered = found.filter(c => !shown[s.id].has(c.id));
      const choices = h('div', { class: 'vn-choices' });
      const paint = () => choices.replaceChildren(...[
        !heard[s.id].length ? h('button', { class: 'primary', disabled: outOfTime(), onClick: askAlibi }, `💬 그 시간에 뭘 했는지 묻기${actions === Infinity ? '' : ' (👣1)'}`) : null,
        offered.length ? h('div', { class: 'vn-label muted small-text' }, '🗂 단서를 보여 주고 반응 보기' + (actions === Infinity ? '' : ' (👣1)')) : null,
        offered.map(c => h('button', { class: 'small vn-clue', disabled: outOfTime(), onClick: () => present(c) }, c.text.length > 34 ? c.text.slice(0, 33) + '…' : c.text)),
        h('div', { class: 'row' },
          h('button', { class: 'small grow', onClick: () => { marks[s.id] = (marks[s.id] + 1) % 3; sfx('scribble'); talk(s, bubble.textContent); } },
            marks[s.id] === 1 ? '✅ 결백 표시됨' : marks[s.id] === 2 ? '❓ 의심 표시됨' : '✏️ 표시하기'),
          h('button', { class: 'small grow', onClick: () => scene() }, '↩ 현장으로')),
      ].flat().filter(Boolean));
      const vnFace = h('div', { class: 'vn-face' }, face(s, 112));
      function askAlibi() {
        if (outOfTime()) return;
        spend();
        const lines = alibiTags[s.id].map(tag => { record(s, tag); return sayOf(s, tag); });
        const text = `${opener(s)} ${lines.join(' ')}`;
        log = `💬 ${s.name}의 이야기를 수첩에 적었다.`;
        typeInto(bubble, text).then(paint);
        paint();
      }
      function present(c) {
        if (outOfTime()) return;
        spend(); shown[s.id].add(c.id);
        const tag = c.exposes && condOf(c.exposes) ? c.exposes : null;
        // 쉬운 난이도에서는 거짓말을 찔린 범인이 움찔한다(당황한 얼굴). 어려우면 표정을 숨긴다.
        vnFace.replaceChildren(face(s, 112, lv.related && tag && s.lies.includes(tag) ? 'nervous' : null));
        const st = tag ? record(s, tag) : null;
        const text = tag
          ? (claims(s, tag) ? `이거요? …${clause(tag)} 사람, 그건 저 맞아요.` : `이게 저랑 무슨 상관이죠? ${clause(tag)} 사람은 제가 아니에요.`)
          : ['글쎄요, 처음 보는데요.', '그게 뭔데요? 모르겠어요.', '저랑은 상관없어 보이는데요.'][hashString(s.id + c.id) % 3];
        log = st ? `🗂 ${s.name}에게 단서를 보여 줬다. 대답을 수첩에 적었다.` : `🗂 ${DO.josa(s.name, '은/는')} 그 단서를 모른다고 했다.`;
        offered.splice(offered.indexOf(c), 1);
        typeInto(bubble, text).then(paint);
        paint();
      }
      render(root, hud(),
        h('div', { class: 'vn' },
          h('div', { class: 'vn-bg', html: art(theme, night) }),
          vnFace,
          h('div', { class: 'vn-name' }, s.name)),
        bubble, choices);
      if (said) { bubble.textContent = said; paint(); }
      else if (first) { typeInto(bubble, `(${DO.josa(s.name, '이/가')} 경계하는 눈빛으로 당신을 본다.)`).then(paint); paint(); }
      else { typeInto(bubble, `"또 뭐요?"`).then(paint); paint(); }
      sfx('select');
    }

    // ---------- 수첩 ----------
    function notebook(tab = 'clues') {
      const tabs = h('div', { class: 'chips' },
        h('button', { class: 'chip' + (tab === 'clues' ? ' active' : ''), onClick: () => notebook('clues') }, `🗂 단서 ${found.length}`),
        sus.map(s => h('button', { class: 'chip' + (tab === s.id ? ' active' : ''), onClick: () => notebook(s.id) },
          (marks[s.id] === 1 ? '✅ ' : marks[s.id] === 2 ? '❓ ' : '') + s.name)));
      let body;
      if (tab === 'clues') {
        body = found.length ? found.map(c => h('div', { class: 'card clue-card' }, h('p', {}, c.text), relatedLine(c)))
          : [h('p', { class: 'muted' }, '아직 찾은 단서가 없다. 현장의 장소를 조사해 보자.')];
      } else {
        const s = sus.find(x => x.id === tab);
        body = [h('div', { class: 'card nb-person' },
          h('div', { class: 'profile-head' }, face(s, 52), h('h3', {}, s.name)),
          heard[s.id].length ? heard[s.id].map(st => h('p', { class: 'nb-say' }, `“${st.text}”`)) : h('p', { class: 'muted' }, '아직 이야기를 듣지 못했다.'),
          h('div', { class: 'row' }, ['없음', '✅ 결백', '❓ 의심'].map((t, k) => h('button', { class: 'small grow' + (marks[s.id] === k ? ' primary' : ''), onClick: () => { marks[s.id] = k; sfx('scribble'); notebook(tab); } }, t))))];
      }
      sfx('paper');
      render(root, h('h2', {}, '📓 수사 수첩'), tabs, body, h('button', { class: 'primary', onClick: () => scene() }, '↩ 현장으로'));
    }

    // ---------- 조수 힌트 ----------
    function hint() {
      const free = hintsLeftFree > 0;
      if (!free && !confirm('조수 콩이에게 물어볼까요? 이번 사건의 최대 별이 하나 줄어듭니다.')) return;
      hintsAll++; if (free) hintsLeftFree--; else hintsUsed++;
      sfx('hint');
      const lieClue = C.clues.find(c => lieTags.includes(c.exposes) && !hits.has(c.exposes) && !found.includes(c));
      const sp = lieClue && spots.find(x => x.item.clue === lieClue || x.item.extra === lieClue);
      let msg;
      if (sp) msg = `🐕 콩이가 ${sp.emoji} ${sp.name} 쪽을 킁킁거린다. 저기 뭔가 있다!`;
      else if (!heard[culprit.id].length) msg = '🐕 콩이가 아직 이야기를 안 들어 본 사람들을 번갈아 본다. 모두의 이야기를 들어 보자.';
      else {
        const t = lieTags.find(x => !hits.has(x)) || lieTags[0];
        msg = `🐕 콩이가 수첩의 "${clause(t)} 사람" 이야기를 앞발로 톡톡 친다. 그 이야기를 한 사람들 중 단서와 안 맞는 사람이 있다.`;
      }
      scene(msg);
    }

    // ---------- 3. 추리 ----------
    function deduce(pre) {
      const step1 = () => {
        render(root, hud(),
          h('h2', {}, hits.size ? '🔎 다시 몰아붙인다' : '🔎 추리 — 범인은 누구인가?'),
          h('p', { class: 'muted' }, '거짓말을 한 사람을 고르세요. 틀리면 신뢰(❤️)가 하나 줄어듭니다.'),
          h('div', { class: 'suspect-grid' }, sus.map(s => h('button', { class: 'suspect-pick', onClick: () => step2(s) },
            face(s, 64), h('b', {}, s.name),
            h('span', { class: 'muted small-text' }, marks[s.id] === 1 ? '✅ 결백 표시' : marks[s.id] === 2 ? '❓ 의심' : `말 ${heard[s.id].length}개`)))),
          h('button', { onClick: () => scene() }, '↩ 현장으로 돌아가기'));
        if (DO.music) DO.music.hold('suspense');
      };
      const step2 = s => {
        const says = heard[s.id].filter(st => !hits.has(st.tag));
        render(root, hud(),
          h('div', { class: 'profile-head' }, face(s, 56), h('h2', {}, `${s.name}의 말 중 거짓은?`)),
          says.length ? says.map(st => h('button', { class: 'mode say-pick', onClick: () => step3(s, st) }, h('div', {}, `“${st.text}”`)))
            : h('p', { class: 'muted' }, '아직 이 사람의 (남은) 말을 듣지 못했다. 현장에서 이야기를 더 들어 보자.'),
          h('button', { onClick: pre ? () => step2(pre) : step1 }, '↩ 다른 사람 고르기'));
        if (DO.music) DO.music.hold('suspense');
      };
      const step3 = (s, st) => {
        render(root, hud(),
          h('p', { class: 'say-quote' }, `${s.name}: “${st.text}”`),
          h('h2', {}, '이 말을 무너뜨릴 증거는?'),
          found.map(c => h('button', { class: 'mode clue-pick', onClick: () => judge(s, st, c) }, h('div', {}, '🗂 ' + c.text))),
          h('button', { onClick: () => step2(s) }, '↩ 다른 말 고르기'));
        if (DO.music) DO.music.hold('suspense');
      };
      if (pre) step2(pre); else step1();
    }

    function judge(s, st, c) {
      const right = s === culprit && lieTags.includes(st.tag) && c.exposes === st.tag && !hits.has(st.tag);
      if (right) { hits.add(st.tag); return objection(s, st, c); }
      hearts--;
      const line = s !== culprit ? '저를 의심하는 거예요? 그 증거랑 제 말은 하나도 안 어긋나요!' : '그게 뭐 어쨌다는 거죠? 그 증거랑 그 말은 아무 상관 없는데요.';
      if (hearts <= 0) return ending(false);
      render(root, hud(),
        h('div', { class: 'card alert center' }, face(s, 76, s === culprit ? 'smug' : 'angry'), h('p', {}, h('b', {}, s.name), ': ', `“${line}”`),
          h('p', { class: 'muted' }, `신뢰 -1 · 남은 신뢰 ${heartsText()}`)),
        h('button', { class: 'primary', onClick: () => deduce(s === culprit ? s : null) }, '🔎 다시 생각해 보기'),
        h('button', { onClick: () => scene('😓 헛짚었다. 수첩을 다시 읽어 보자.') }, '↩ 현장으로'));
      if (DO.fx) DO.fx.fail(null, 'miss'); else sfx('miss');
      tension();
    }

    // "이의 있음!" → (보스면 반격) → 자백
    function objection(s, st, c) {
      const strike = h('p', { class: 'say-quote struck' }, `“${st.text}”`);
      const cap = h('p', { class: 'cine-cap' });
      render(root,
        h('div', { class: 'objection' }, h('div', { class: 'obj-burst' }, '이의 있음!')),
        strike,
        h('div', { class: 'card clue-card slam' }, h('p', {}, '🗂 ' + c.text)),
        cap,
        h('div', { class: 'obj-face shake' }, face(s, 96, 'shock')),
        h('button', { class: 'primary', onClick: after }, '▶ 다음'));
      sfx('objection'); sfx('slam', { delay: 0.55 });
      music('hold', 'pursuit');
      document.body.classList.add('flash');
      setTimeout(() => document.body.classList.remove('flash'), 450);
      typeInto(cap, `${DO.josa(s.name, '은/는')} "${clause(st.tag)} 사람"에 대해 거짓말을 했다. 이 증거와 맞지 않는다!`);
      function after() {
        if (hits.size < needHits) {
          // 보스의 반격
          const capB = h('p', { class: 'cine-cap' });
          render(root, hud(),
            h('div', { class: 'obj-face' }, face(s, 96, 'smug')),
            h('div', { class: 'boss-hp' }, Array.from({ length: needHits }, (_, i) => h('span', { class: i < hits.size ? 'off' : '' }))),
            capB,
            h('button', { class: 'danger', onClick: () => deduce(s) }, '🔎 다른 거짓말도 찌른다'),
            h('button', { onClick: () => scene('👑 범인이 버티고 있다. 다른 거짓말을 무너뜨릴 증거를 찾자.') }, '↩ 현장으로 (증거 더 찾기)'));
          typeInto(capB, `${s.name}: "하, 그게 다예요? 그거 하나로는 제가 범인이라는 증거가 안 되죠!"`);
          sfx('counter');
          music('hold', 'pursuit');
          return;
        }
        confession(s);
      }
    }
    // 자백: 범인의 비밀 프로필을 1인칭으로 바꿔 쓴다 (거짓말 지시 문장은 뺀다)
    function confessionText() {
      const parts = (culprit.profile.match(/[^.!?]+[.!?]?/g) || []).map(x => x.trim()).filter(x => x && !/범인이다|거짓말|남들에겐|말할 생각/.test(x));
      const body = parts.join(' ').replace(/당신은/g, '저는').replace(/당신이/g, '제가').replace(/당신의/g, '제').replace(/당신/g, '저');
      // 과거형 '…았다/었다/했다/갔다/있었다.' 를 말투 '…어요.' 로 (받침이 ㅆ 인 글자 + 다.)
      const polite = body.replace(/([가-힣])다\./g, (m, ch) => ((ch.charCodeAt(0) - 0xac00) % 28 === 20 ? `${ch}어요.` : m));
      return `…네, 맞아요. 제가 했어요. ${polite}`;
    }
    function confession(s) {
      const cap = h('p', { class: 'cine-cap' });
      render(root,
        h('div', { class: 'cine confess' }, h('div', { class: 'cine-bar top' }), h('div', { class: 'cine-stage dim', html: art(theme, night) }),
          h('div', { class: 'cine-over' }, h('div', { class: 'confess-face' }, face(s, 110, 'sad'))), h('div', { class: 'cine-bar bottom' })),
        cap,
        h('button', { class: 'primary', onClick: () => ending(true) }, '▶ 사건 종결'));
      typeInto(cap, `${s.name}: "${confessionText()}"`, 30);
      sfx('confess');
      music('hold', 'confess');
    }

    function ending(win) {
      const stars = win ? starsNow() : 0;
      render(root,
        h('div', { class: 'verdict' },
          h('div', { class: 'stamp ' + (win ? 'win' : 'lose') }, win ? '검거' : '미제'),
          face(culprit, 96, win ? 'sad' : 'smug'),
          h('h2', {}, win ? '사건 해결!' : '신뢰를 모두 잃었다'),
          h('p', {}, '범인: ', h('b', {}, culprit.name)),
          win ? h('p', { class: 'reward-stars' }, [1, 2, 3].map(k => h('span', { class: k <= stars ? 'on' : '' }, '★'))) : null,
          h('p', { class: 'muted small-text' }, `남은 신뢰 ${Math.max(0, hearts)} · 조수 힌트 ${hintsUsed}번`)),
        h('h3', {}, '🧩 사건의 진실'),
        h('div', { class: 'card' },
          lieTags.map(t => {
            const c = C.clues.find(x => x.exposes === t);
            return h('p', {}, `· "${clause(t)} 사람" — ${DO.josa(culprit.name, '은/는')} ${claims(culprit, t) ? '맞다고' : '아니라고'} 했지만 거짓. 증거: ${c ? c.text : '-'}`);
          })),
        h('button', { class: 'primary', onClick: () => opt.onDone && opt.onDone({ win, stars, hints: hintsAll, hearts: Math.max(0, hearts) }) }, '📒 수첩으로 돌아가기'));
      if (DO.fx) DO.fx.ending(win);
    }

    opening();
  };
  // 검사·미리보기용: 배경 그림과 배경 고르기
  DO.investigate.art = art;
  DO.investigate.themeOf = themeOf;
  DO.investigate.themes = Object.keys(ART);
})();
