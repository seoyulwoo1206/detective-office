// 절차적 초상화: 씨앗 문자열 → 항상 같은 얼굴(SVG). 이미지 파일이 없어도 용의자마다 얼굴이 생긴다.
//   DO.portrait(seed, name, size) → <span class="portrait"> 요소
//   DO.svg(tag, attrs, ...children) → SVG 요소 (지도 등에서 공용)
// 웹툰풍 반실사: 피부 음영, 눈동자(홍채 그라데이션·반사광·속눈썹), 머릿결과 윤기, 역할에 맞는 옷(교복·정장·작업복 …).
// 이름에 들어 있는 단어(할머니, 초등학생, 경비원, 선생 …)로 나이대·성별 느낌·머리 모양·모자·옷을 맞춘다.

(() => {
  const { rng, hashString } = DO;
  const INK = '#25283a';
  const SKIN = ['#f8dcc4', '#f3d0b0', '#eec4a0', '#e4b38e', '#fbe5d2', '#f5d5bb'];
  const HAIR = ['#2b2320', '#3d2b22', '#54382a', '#1f1d26', '#6e4a32', '#2d2a3a', '#7a5638'];
  const GRAY = ['#bdb8b0', '#d8d3ca', '#a29d95'];
  const IRIS = ['#4a2d1c', '#5c3a22', '#3a2518', '#6b4528', '#3d3448'];
  const CLOTH = ['#b8463a', '#3b6ea5', '#3f7d55', '#7d5aa0', '#c98a2b', '#4a5560', '#8a5a44', '#2b8a8a', '#d9a3a8', '#e8e2d4'];
  const SUIT = ['#2f3a52', '#3d3f46', '#5a4a3e', '#283a34'];
  const UNIFORM = ['#26365a', '#3a3f4a', '#2f4a3a', '#5a2f36'];
  const BG = ['#f3e7cf', '#e6ead8', '#f2e0d6', '#e1e8ef', '#ede3f0', '#f6efd9'];
  let uid = 0;

  function svg(tag, attrs = {}, ...children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(c));
    }
    return el;
  }

  // 색 섞기: a > 0 이면 흰색 쪽으로, a < 0 이면 검은색 쪽으로
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const t = a < 0 ? 0 : 255, p = Math.abs(a);
    const ch = v => Math.round(v + (t - v) * p);
    return '#' + ((1 << 24) + (ch(n >> 16) << 16) + (ch((n >> 8) & 255) << 8) + ch(n & 255)).toString(16).slice(1);
  }

  function traitsOf(name) {
    const n = String(name || '');
    const elder = /할머니|할아버지|노인/.test(n);
    const child = /초등|막내|어린이|아이$|유치|사촌 동생/.test(n);
    const teen = !child && /학생|고3|중학|고등|반장|부장|회장|부원|전학생|1등|후배|주장|선배|도서부|미술부|방송부|총무|체육부|수험생|재수생|보컬|동아리/.test(n);
    const adult = !elder && !child && !teen && /선생|강사|원장|아빠|엄마|삼촌|고모|이모|아저씨|기사|직원|점장|회사원|매니저|플래너|경비|바텐더|상인|가이드|간호사|인턴|공무원|수집가|남편|아내|조교|라이더|요원|승무원|손님|봉사자|길드장/.test(n);
    return {
      elder, child, teen, adult,
      cap: /경비|기사|라이더|안전요원|요원/.test(n),
      glassesBias: /선생|사서|매니저|플래너|회사원|인턴|조교|수험|재수|준비생|1등|수집가|강사/.test(n),
      fem: /할머니|엄마|아내|신부(?! 사촌| 친구)|이모|고모|누나|언니|여학생|간호사|승무원/.test(n),
      masc: /할아버지|아빠|남편|아저씨|삼촌|신랑(?! 동생)|오빠|남학생|형$|경비/.test(n),
      outfit: elder ? 'cardigan'
        : /간호사|인턴/.test(n) ? 'scrub'
        : /경비|기사|라이더|요원|승무원|직원|가이드/.test(n) ? 'work'
        : /선생|강사|원장|회사원|매니저|플래너|점장|바텐더|공무원|신랑|신부/.test(n) ? 'suit'
        : teen && !/재수생|대학생/.test(n) ? 'uniform'
        : null,
    };
  }

  // 앞머리 가장자리: 오른쪽 관자놀이에서 왼쪽으로, v = 가르마 쪽 골짜기, t = 머리카락 끝
  function fringePath(pts) {
    let d = '';
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], B = pts[i];
      // 한 가닥 = 뿌리(골짜기)에서 곧게 내려와 끝에서 모이는 볼록한 꼴 → 골짜기는 좁게 파이고 끝은 뾰족
      const cx = B.t ? A.x + (B.x - A.x) * 0.12 : B.x + (A.x - B.x) * 0.12;
      const cy = B.t ? A.y + (B.y - A.y) * 0.72 : B.y + (A.y - B.y) * 0.72;
      d += `Q${cx.toFixed(2)} ${cy.toFixed(2)} ${B.x.toFixed(2)} ${B.y.toFixed(2)}`;
    }
    return d;
  }

  function markup(seed, name) {
    const r = rng(hashString('face:' + seed));
    const pick = a => a[Math.floor(r() * a.length)];
    const jit = k => (r() - 0.5) * 2 * k;
    const tr = traitsOf(name);
    const id = 'pf' + (uid++);
    const skin = pick(SKIN);
    const hair = tr.elder ? pick(GRAY) : pick(HAIR);
    const iris = pick(IRIS);
    const bg = pick(BG);
    const fem = tr.fem ? true : tr.masc ? false : r() < 0.5;
    const age = tr.elder ? 'elder' : tr.child ? 'child' : tr.adult ? 'adult' : tr.teen ? 'teen' : pick(['teen', 'adult']);
    const style = tr.elder && !fem ? 'thin'
      : tr.elder ? pick(['bob', 'bun', 'curly'])
      : fem ? pick(['long', 'long', 'bob', 'pony', 'bun', 'wave'])
      : pick(['short', 'short', 'swept', 'swept', 'mid', 'mid', age === 'adult' ? 'buzz' : 'short']);
    const outfit = tr.outfit || (tr.child ? pick(['tee', 'hoodie']) : pick(['tee', 'hoodie', 'knit', 'shirt']));
    const cloth = outfit === 'suit' ? pick(SUIT) : outfit === 'uniform' ? pick(UNIFORM) : outfit === 'scrub' ? pick(['#f4f6f8', '#a9d8cf', '#9cc3e6']) : pick(CLOTH);
    const glasses = r() < (tr.elder ? 0.55 : tr.glassesBias ? 0.5 : 0.15);
    const eyeShape = age === 'child' ? 'round' : pick(['almond', 'almond', 'round', 'sharp']);
    const browKind = pick(['soft', 'soft', 'straight', 'worried', 'stern']);
    const mouth = pick(['smile', 'smile', 'soft', 'soft', 'smirk', 'grin', 'pout', 'tight']);
    const earring = fem && !tr.child && !tr.elder && r() < 0.3;
    const stubble = !fem && age === 'adult' && r() < 0.3;

    // 머리 틀 (64×64 안)
    const hx = 32, hy = age === 'child' ? 29 : 28;
    const fw = age === 'child' ? 14.4 : fem ? 13.4 : 13.9;           // 얼굴 반폭
    const chin = age === 'child' ? 13.6 : age === 'elder' ? 15.6 : fem ? 15.4 : 16;
    const jw = age === 'child' ? 7.2 : fem ? 4.4 : age === 'adult' || age === 'elder' ? 6.4 : 5.4;
    const ey = hy + (age === 'child' ? 2.2 : 1.4);
    const ew = age === 'child' ? 7.6 : age === 'elder' ? 6.2 : age === 'adult' ? 6.8 : 7.2;
    const eh = (age === 'child' ? 5.6 : age === 'elder' ? 3.2 : age === 'adult' ? 3.9 : 4.6) * (eyeShape === 'round' ? 1.1 : eyeShape === 'sharp' ? 0.8 : 1);
    const eox = age === 'child' ? 6.4 : 6.1;                         // 눈 중심의 가로 간격(반)
    const my = hy + (age === 'child' ? 10.4 : 11.2);
    const skinD = shade(skin, -0.2), skinDD = shade(skin, -0.34);
    const hairD = shade(hair, -0.32), hairL = shade(hair, tr.elder ? 0.35 : 0.4);
    const lip = fem ? '#d0736f' : shade(skin, -0.28);
    const S = `stroke="${INK}" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round"`;
    const out = [];

    const faceD = `M${hx - fw} ${hy - 3}C${hx - fw - 0.5} ${hy - 19} ${hx + fw + 0.5} ${hy - 19} ${hx + fw} ${hy - 3}`
      + `C${hx + fw} ${hy + 4} ${hx + fw - 2.4} ${hy + chin - 6} ${hx + jw} ${hy + chin - 1.4}`
      + `Q${hx} ${hy + chin + 1.6} ${hx - jw} ${hy + chin - 1.4}C${hx - fw + 2.4} ${hy + chin - 6} ${hx - fw} ${hy + 4} ${hx - fw} ${hy - 3}Z`;

    // ── 머리 모양: 정수리 덮개(cap) + 앞머리 끝(fringe) ──
    const vol = fem ? 3.2 : style === 'buzz' ? 1.2 : 2.4;
    const yT = hy - 11.2, yB = hy - 4.4;          // 앞머리 뿌리 높이, 끝 높이
    const side = r() < 0.5 ? 1 : -1;               // 가르마 방향
    const sw = jit(1.2);                            // 앞머리가 쏠리는 정도
    const RT = { x: hx + fw + 1.4, y: hy + 1 }, LT = { x: hx - fw - 1.4, y: hy + 1 };
    const P = (x, y, t) => ({ x: hx + x, y, t });
    let fringe = null;
    if (style === 'long' || style === 'bob' || style === 'wave' || style === 'mid' || (style === 'bun' && r() < 0.5)) {
      fringe = [RT, P(fw - 0.6, hy - 0.5, 1), P(9.5, yT + 1.5), P(6.6 + sw, yB + jit(0.6), 1), P(3.2, yT + 0.4), P(0.4 + sw, yB + 0.9, 1), P(-3, yT + 0.6), P(-6.4 + sw, yB + jit(0.6), 1), P(-9.6, yT + 1.6), P(-fw + 0.6, hy - 0.5, 1), LT];
    } else if (style === 'pony' || style === 'bun' || style === 'swept') {
      const s = side, f = fem ? 0 : 1.2;
      const pts = [P(fw - 0.8, hy - 1.5, 1), P(8.4, yT - 0.6), P(4.6, yT + 4.2 - f, 1), P(-0.6, yT - 1.6), P(-5.8, yB - 0.8 - f, 1), P(-9.2, yT + 2.4), P(-fw + 0.6, hy - 0.2, 1)];
      fringe = [RT, ...(s > 0 ? pts : pts.map(p => ({ ...p, x: 2 * hx - p.x })).reverse()), LT];
      if (s < 0) { fringe[0] = RT; fringe[fringe.length - 1] = LT; }
    } else if (style === 'short' || style === 'curly') {
      const c = style === 'curly' ? 2.6 : 0;
      fringe = [RT, P(fw - 0.4, hy - 2.5, 1), P(10, yT + 1), P(7.4 + sw, yB - 1.2 - c, 1), P(4.6, yT), P(2 + sw, yB - 0.2 - c, 1), P(-1, yT - 0.4), P(-3.8 + sw, yB - 0.8 - c, 1), P(-6.6, yT + 0.4), P(-9 + sw, yB - 1.6 - c, 1), P(-11, yT + 2), P(-fw + 0.4, hy - 2.5, 1), LT];
    } else if (style === 'buzz') {
      fringe = [RT, P(fw - 0.8, hy - 4.5, 1), P(9, yT + 1.2), P(6, yT + 2.2, 1), P(2, yT + 1.2), P(-2, yT + 2.2, 1), P(-6, yT + 1.2), P(-fw + 0.8, hy - 4.5, 1), LT];
    }
    const capD = fringe ? `M${LT.x} ${LT.y}C${hx - fw - 3.6} ${hy - 20 - vol} ${hx + fw + 3.6} ${hy - 20 - vol} ${RT.x} ${RT.y}` + fringePath(fringe) + 'Z' : null;

    // ── 정의(그라데이션·클립) ──
    out.push(`<defs>`
      + `<clipPath id="${id}"><rect x="1" y="1" width="62" height="62" rx="8"/></clipPath>`
      + `<clipPath id="${id}f"><path d="${faceD}"/></clipPath>`
      + (capD ? `<clipPath id="${id}h"><path d="${capD}"/></clipPath>` : '')
      + `<radialGradient id="${id}bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${shade(bg, 0.45)}"/><stop offset="1" stop-color="${shade(bg, -0.05)}"/></radialGradient>`
      + `<radialGradient id="${id}sk" cx="44%" cy="36%" r="72%"><stop offset="0" stop-color="${shade(skin, 0.16)}"/><stop offset=".68" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -0.1)}"/></radialGradient>`
      + `<linearGradient id="${id}hr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(hair, 0.14)}"/><stop offset="1" stop-color="${shade(hair, -0.2)}"/></linearGradient>`
      + `<linearGradient id="${id}ir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(iris, -0.55)}"/><stop offset=".5" stop-color="${iris}"/><stop offset="1" stop-color="${shade(iris, 0.45)}"/></linearGradient>`
      + `<linearGradient id="${id}cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(cloth, 0.1)}"/><stop offset="1" stop-color="${shade(cloth, -0.2)}"/></linearGradient>`
      + `<radialGradient id="${id}bl"><stop offset="0" stop-color="#ff7d78" stop-opacity=".75"/><stop offset="1" stop-color="#ff7d78" stop-opacity="0"/></radialGradient>`
      + `</defs>`);
    out.push(`<rect x="1" y="1" width="62" height="62" rx="8" fill="url(#${id}bg)"/>`);
    out.push(`<g stroke="${INK}" stroke-opacity=".1" stroke-width="1"><path d="M1 14h62M1 26h62M1 38h62"/></g>`);   // 키 재는 줄
    out.push(`<g clip-path="url(#${id})">`);

    // ── 뒷머리 ──
    const HR = `fill="url(#${id}hr)" ${S}`;
    const backTop = `M${hx - fw - 2.6} ${hy - 2}C${hx - fw - 4.2} ${hy - 21 - vol} ${hx + fw + 4.2} ${hy - 21 - vol} ${hx + fw + 2.6} ${hy - 2}`;
    if (style === 'long') out.push(`<path d="${backTop}L${hx + fw + 5} ${hy + 22}Q${hx + fw + 1} ${hy + 26} ${hx + fw - 3} ${hy + 22}L${hx - fw + 3} ${hy + 22}Q${hx - fw - 1} ${hy + 26} ${hx - fw - 5} ${hy + 22}Z" ${HR}/>`);
    if (style === 'wave') out.push(`<path d="${backTop}Q${hx + fw + 6.5} ${hy + 6} ${hx + fw + 3.4} ${hy + 12}Q${hx + fw + 7} ${hy + 17} ${hx + fw + 4} ${hy + 24}Q${hx + fw} ${hy + 25} ${hx + fw - 3} ${hy + 22}L${hx - fw + 3} ${hy + 22}Q${hx - fw} ${hy + 25} ${hx - fw - 4} ${hy + 24}Q${hx - fw - 7} ${hy + 17} ${hx - fw - 3.4} ${hy + 12}Q${hx - fw - 6.5} ${hy + 6} ${hx - fw - 2.6} ${hy - 2}Z" ${HR}/>`);
    if (style === 'bob') out.push(`<path d="${backTop}L${hx + fw + 3.4} ${hy + 11}Q${hx + fw + 3} ${hy + 15.5} ${hx + fw - 1.5} ${hy + 14.5}L${hx - fw + 1.5} ${hy + 14.5}Q${hx - fw - 3} ${hy + 15.5} ${hx - fw - 3.4} ${hy + 11}Z" ${HR}/>`);
    if (style === 'bun') out.push(`<circle cx="${hx + side * 3}" cy="${hy - 18.5}" r="5.8" ${HR}/><path d="M${hx + side * 3 - 4} ${hy - 19.5}q4 -3 8 0" fill="none" stroke="${hairL}" stroke-width=".9" stroke-opacity=".6" stroke-linecap="round"/>`);
    if (style === 'pony') {
      const s = -side, bx = hx + s * (fw - 1);
      out.push(`<path d="M${bx} ${hy - 12}C${bx + s * 11} ${hy - 11} ${bx + s * 10} ${hy + 10} ${bx + s * 5} ${hy + 19}C${bx + s * 5.5} ${hy + 9} ${bx + s * 3} ${hy - 1} ${bx - s * 2} ${hy - 4}Z" ${HR}/>`);
      out.push(`<ellipse cx="${bx + s * 1.6}" cy="${hy - 9.6}" rx="1.9" ry="1.3" fill="${pick(['#d8484b', '#3b6ea5', '#f2c14e'])}" ${S}/>`);
    }
    if (style === 'curly' && !tr.elder) out.push(`<path d="${backTop}L${hx + fw + 2.4} ${hy + 3}L${hx - fw - 2.4} ${hy + 3}Z" ${HR}/>`);
    if (style === 'curly' && tr.elder) out.push(`<path d="${backTop}Q${hx + fw + 5} ${hy + 6} ${hx + fw} ${hy + 8}L${hx - fw} ${hy + 8}Q${hx - fw - 5} ${hy + 6} ${hx - fw - 2.6} ${hy - 2}Z" ${HR}/>`);

    // ── 목·옷 ──
    const neckW = fem ? 4.4 : 5.2;
    out.push(`<path d="M${hx - neckW} ${hy + 9}L${hx - neckW} 56L${hx + neckW} 56L${hx + neckW} ${hy + 9}Z" fill="${skin}" ${S}/>`);
    out.push(`<path d="M${hx - neckW} ${hy + chin - 3}Q${hx} ${hy + chin + 4.5} ${hx + neckW} ${hy + chin - 3}L${hx + neckW} ${hy + chin + 2.2}Q${hx} ${hy + chin + 5.5} ${hx - neckW} ${hy + chin + 2.2}Z" fill="${skinD}" opacity=".55"/>`);
    const CL = `fill="url(#${id}cl)" ${S}`;
    const body = (neck) => `M2 66C3 54 13 49.2 ${neck}C51 49.2 61 54 62 66Z`;
    if (outfit === 'tee' || outfit === 'knit' || outfit === 'hoodie') {
      out.push(`<path d="${body('24.6 48.6Q32 54.6 39.4 48.6')}" ${CL}/>`);
      if (outfit === 'knit') out.push(`<path d="M25.6 49.6Q32 55.6 38.4 49.6" fill="none" stroke="${shade(cloth, -0.3)}" stroke-width=".8"/><path d="M14 58v8M50 58v8M20 55v11M44 55v11" stroke="${shade(cloth, -0.18)}" stroke-width=".6" stroke-dasharray="1 1.2"/>`);
      if (outfit === 'hoodie') out.push(`<path d="M20.5 50Q32 42.5 43.5 50Q40 56 32 56.4Q24 56 20.5 50Z" fill="${shade(cloth, -0.14)}" ${S}/><path d="M24 51.2Q32 47.6 40 51.2" fill="none" stroke="${shade(cloth, -0.35)}" stroke-width=".8"/><path d="M29.4 54.8l-.4 5.4M34.6 54.8l.4 5.4" stroke="#f4f1ea" stroke-width="1" stroke-linecap="round"/>`);
    } else if (outfit === 'shirt' || outfit === 'work' || outfit === 'scrub') {
      const deep = outfit === 'scrub' ? 56 : 54;
      out.push(`<path d="${body(`25 48.4L32 ${deep}L39 48.4`)}" ${CL}/>`);
      if (outfit !== 'scrub') {
        const col = outfit === 'work' ? shade(cloth, -0.35) : shade(cloth, 0.25);
        out.push(`<path d="M25 48.2L31.6 54.2L27.2 56.2L23 50.2Z" fill="${col}" ${S}/><path d="M39 48.2L32.4 54.2L36.8 56.2L41 50.2Z" fill="${col}" ${S}/>`);
        out.push(`<path d="M32 56v10" stroke="${shade(cloth, -0.3)}" stroke-width=".7"/><circle cx="32" cy="59" r=".6" fill="${shade(cloth, -0.4)}"/><circle cx="32" cy="63" r=".6" fill="${shade(cloth, -0.4)}"/>`);
      } else out.push(`<path d="M44 57h7v5h-7z" fill="${shade(cloth, -0.12)}" stroke="${shade(cloth, -0.3)}" stroke-width=".6"/>`);
    } else {
      // 셔츠 + 겉옷(교복 재킷·정장·카디건)
      const shirt = outfit === 'cardigan' ? '#f1ece0' : '#f7f7f4';
      out.push(`<path d="M23 48.6Q32 52 41 48.6L42 66L22 66Z" fill="${shirt}" ${S}/>`);
      if (outfit !== 'cardigan') out.push(`<path d="M25.6 48L31.8 53.6L27.8 55.4L24 49.8Z" fill="#fff" ${S}/><path d="M38.4 48L32.2 53.6L36.2 55.4L40 49.8Z" fill="#fff" ${S}/>`);
      const tie = outfit === 'uniform' ? (fem ? 'ribbon' : 'tie') : outfit === 'suit' && !fem ? 'tie' : null;
      const tc = pick(['#b8343a', '#2b4f8a', '#2f6a4a', '#8a2f5a']);
      if (tie === 'tie') out.push(`<path d="M31 53.4L33 53.4L33.8 55.6L32 61L30.2 55.6Z" fill="${tc}" ${S}/>`);
      if (tie === 'ribbon') out.push(`<path d="M32 54.2L27.6 52.2L27.8 57L32 55.2L36.2 57L36.4 52.2Z" fill="${tc}" ${S}/><circle cx="32" cy="54.7" r="1.2" fill="${shade(tc, -0.2)}" ${S}/>`);
      const v = outfit === 'cardigan' ? 60 : 62;
      out.push(`<path d="M2 66C3 54 13 49.2 23.4 48.6L32 ${v}L40.6 48.6C51 49.2 61 54 62 66Z" ${CL}/>`);
      if (outfit === 'cardigan') out.push(`<circle cx="31" cy="62.6" r=".9" fill="${shade(cloth, -0.4)}"/><path d="M23.4 48.6L32 60M40.6 48.6L32 60" fill="none" stroke="${shade(cloth, -0.3)}" stroke-width=".9"/>`);
      else out.push(`<path d="M23.4 48.6L27.6 57.6L25.4 58.6L29 62.6M40.6 48.6L36.4 57.6L38.6 58.6L35 62.6" fill="none" stroke="${shade(cloth, -0.4)}" stroke-width=".9" stroke-linejoin="round"/>`);
      if (outfit === 'uniform') out.push(`<path d="M44.5 57.5h5.5v3.4h-5.5z" fill="${shade(cloth, 0.25)}" opacity=".7"/><path d="M46 58.4l1.2 1.6 1.4-2" fill="none" stroke="#f2c14e" stroke-width=".7"/>`);
    }

    // ── 귀 ──
    for (const s of [-1, 1]) {
      const ex = hx + s * (fw + 0.1);
      out.push(`<ellipse cx="${ex}" cy="${ey + 1}" rx="2" ry="3.1" fill="${skin}" ${S}/><path d="M${ex + s * 0.3} ${ey - 1.2}q${s * 1} 1.6 ${-s * 0.2} 3.2" fill="none" stroke="${skinDD}" stroke-width=".7" stroke-linecap="round"/>`);
      if (earring) out.push(`<circle cx="${ex + s * 0.2}" cy="${ey + 4.6}" r=".95" fill="#f2c14e" stroke="${INK}" stroke-width=".5"/>`);
    }

    // ── 얼굴 ──
    out.push(`<path d="${faceD}" fill="url(#${id}sk)" ${S}/>`);
    out.push(`<g clip-path="url(#${id}f)">`);
    // 옆 볼 그늘, 턱 아래 그늘
    out.push(`<path d="M${hx + fw - 3} ${hy - 6}Q${hx + fw + 1} ${hy + 4} ${hx + jw} ${hy + chin}L${hx + fw + 2} ${hy + chin}L${hx + fw + 2} ${hy - 6}Z" fill="${skinD}" opacity=".22"/>`);
    if (capD) out.push(`<path d="${capD}" fill="${skinDD}" opacity=".32" transform="translate(${-side * 0.4} 1.6)"/>`);   // 앞머리 그림자
    if (stubble) out.push(`<path d="M${hx - fw} ${my - 3}Q${hx - 6} ${my + 1} ${hx} ${my - 1.6}Q${hx + 6} ${my + 1} ${hx + fw} ${my - 3}L${hx + fw} ${hy + chin + 2}L${hx - fw} ${hy + chin + 2}Z" fill="#4d5566" opacity=".1"/>`);
    // 볼 홍조
    const bo = age === 'child' ? 0.55 : fem ? 0.42 : 0.2;
    out.push(`<ellipse cx="${hx - 8.3}" cy="${ey + 4.6}" rx="3.6" ry="2" fill="url(#${id}bl)" opacity="${bo}"/><ellipse cx="${hx + 8.3}" cy="${ey + 4.6}" rx="3.6" ry="2" fill="url(#${id}bl)" opacity="${bo}"/>`);
    out.push(`</g>`);

    // ── 눈 ──
    const tilt = eyeShape === 'sharp' ? 1 : age === 'elder' ? -0.3 : 0.45;
    for (const dir of [-1, 1]) {
      const x = hx + dir * eox, xi = x - dir * ew / 2, xo = x + dir * ew / 2;
      const yi = ey + 0.4, yo = ey - tilt;
      const upper = `M${xi} ${yi}C${xi + dir * ew * 0.18} ${ey - eh * 0.98} ${xo - dir * ew * 0.28} ${ey - eh * 0.98} ${xo} ${yo}`;
      const eyeD = upper + `C${xo - dir * ew * 0.2} ${ey + eh * 0.62} ${xi + dir * ew * 0.28} ${ey + eh * 0.66} ${xi} ${yi}Z`;
      const ir = Math.max(2, ew * 0.33), icy = ey + eh * 0.06;
      const cid = `${id}e${dir > 0 ? 'r' : 'l'}`;
      out.push(`<clipPath id="${cid}"><path d="${eyeD}"/></clipPath>`);
      out.push(`<path d="${eyeD}" fill="#fbfaf7"/>`);
      out.push(`<g clip-path="url(#${cid})"><circle cx="${x + dir * 0.15}" cy="${icy}" r="${ir}" fill="url(#${id}ir)"/><circle cx="${x + dir * 0.15}" cy="${icy}" r="${ir * 0.46}" fill="#14121a"/>`
        + `<path d="${upper}" fill="none" stroke="${skinDD}" stroke-width="1.6" stroke-opacity=".35" transform="translate(0 .7)"/>`
        + `<circle cx="${x - 0.7}" cy="${icy - ir * 0.42}" r="${ir * 0.36}" fill="#fff"/><circle cx="${x + 0.9}" cy="${icy + ir * 0.5}" r="${ir * 0.16}" fill="#fff" opacity=".85"/></g>`);
      // 속눈썹 선(위), 아래 눈꺼풀
      out.push(`<path d="${upper}" fill="none" stroke="${INK}" stroke-width="${fem ? 1.55 : 1.3}" stroke-linecap="round"/>`);
      if (fem && age !== 'child') out.push(`<path d="M${xo - dir * 0.3} ${yo + 0.1}q${dir * 1} -.3 ${dir * 1.5} -1.3" fill="none" stroke="${INK}" stroke-width=".85" stroke-linecap="round"/>`);
      out.push(`<path d="M${xo - dir * 0.4} ${yo + 0.8}C${xo - dir * ew * 0.3} ${ey + eh * 0.6} ${xi + dir * ew * 0.3} ${ey + eh * 0.62} ${xi + dir * 0.8} ${yi + 0.6}" fill="none" stroke="${INK}" stroke-width=".6" stroke-opacity=".35" stroke-linecap="round"/>`);
      // 쌍꺼풀 선
      if (age !== 'elder' && eyeShape !== 'sharp') out.push(`<path d="M${x - dir * ew * 0.18} ${ey - eh - 0.7}Q${x + dir * ew * 0.25} ${ey - eh - 1.3} ${xo + dir * 0.2} ${yo - 1.1}" fill="none" stroke="${skinDD}" stroke-width=".55" stroke-opacity=".7" stroke-linecap="round"/>`);
      if (age === 'elder') out.push(`<path d="M${xo + dir * 0.8} ${yo + 0.6}l${dir * 1.4} .6M${x - dir * 1.8} ${ey + eh + 1.1}q${dir * 2} .8 ${dir * 3.8} 0" fill="none" stroke="${skinDD}" stroke-width=".5" stroke-opacity=".6" stroke-linecap="round"/>`);
      if (glasses) {
        out.push(`<rect x="${x - 4.5}" y="${ey - 3.5}" width="9" height="6.6" rx="2.6" fill="#ffffff" fill-opacity=".12" stroke="${INK}" stroke-width=".95"/>`
          + `<path d="M${x - 2.6} ${ey + 2}l3.6 -4.2" stroke="#fff" stroke-opacity=".55" stroke-width=".7" stroke-linecap="round"/>`
          + `<path d="M${x + dir * 4.5} ${ey - 1.2}L${hx + dir * (fw + 0.4)} ${ey - 0.6}" fill="none" stroke="${INK}" stroke-width=".8"/>`);
      }
      // 눈썹
      const by = ey - eh - (age === 'child' ? 2.6 : 2.2);
      const ix = x - dir * ew * 0.48, ox = x + dir * ew * 0.72;
      const iy = by + (browKind === 'worried' ? -1 : browKind === 'stern' ? 0.9 : 0), oy = by + (browKind === 'worried' ? 0.8 : browKind === 'stern' ? -0.6 : 0.3);
      const arch = browKind === 'soft' ? 1.3 : browKind === 'straight' ? 0.3 : 0.6;
      const th = fem ? 1.05 : 1.45;
      const bc = tr.elder ? shade(hair, -0.3) : shade(hair, -0.15);
      out.push(`<path d="M${ix} ${iy - th / 2}Q${(ix + ox) / 2} ${Math.min(iy, oy) - arch - th / 2} ${ox} ${oy}Q${(ix + ox) / 2} ${Math.min(iy, oy) - arch + th * 0.6} ${ix} ${iy + th / 2}Z" fill="${bc}" opacity=".92"/>`);
    }
    if (glasses) out.push(`<path d="M${hx - eox + 4.5} ${ey - 0.6}Q${hx} ${ey - 2} ${hx + eox - 4.5} ${ey - 0.6}" fill="none" stroke="${INK}" stroke-width=".9"/>`);

    // ── 코 ──
    const ny = ey + (age === 'child' ? 5.4 : 6.6);
    out.push(`<path d="M${hx + 0.9} ${ey + 1.4}Q${hx + 2.1} ${ny - 2.4} ${hx + 1.3} ${ny}" fill="none" stroke="${skinD}" stroke-width=".9" stroke-linecap="round" opacity=".75"/>`
      + `<path d="M${hx - 1.5} ${ny + 0.5}Q${hx} ${ny + 1.5} ${hx + 1.5} ${ny + 0.5}" fill="none" stroke="${skinDD}" stroke-width=".8" stroke-linecap="round"/>`
      + `<circle cx="${hx - 0.4}" cy="${ny - 0.6}" r=".7" fill="#fff" opacity=".5"/>`);
    if (age === 'elder') out.push(`<path d="M${hx - 5} ${ny - 1}Q${hx - 6.6} ${ny + 2} ${hx - 5.2} ${my + 1.4}M${hx + 5} ${ny - 1}Q${hx + 6.6} ${ny + 2} ${hx + 5.2} ${my + 1.4}" fill="none" stroke="${skinDD}" stroke-width=".6" stroke-linecap="round" opacity=".7"/>`);

    // ── 입 ──
    const lineC = shade(lip, -0.42);
    const lowerLip = (o) => `<path d="M${hx - 2.3} ${my + 1.7}Q${hx} ${my + 3.3} ${hx + 2.3} ${my + 1.7}Q${hx} ${my + 2.2} ${hx - 2.3} ${my + 1.7}Z" fill="${lip}" opacity="${o}"/>`;
    if (mouth === 'smile') out.push(lowerLip(0.55) + `<path d="M${hx - 3.8} ${my - 0.2}Q${hx} ${my + 2.4} ${hx + 3.8} ${my - 0.2}" fill="none" stroke="${lineC}" stroke-width="1.05" stroke-linecap="round"/>`);
    if (mouth === 'soft') out.push(lowerLip(0.6) + `<path d="M${hx - 3} ${my + 0.7}Q${hx} ${my + 1.5} ${hx + 3} ${my + 0.7}" fill="none" stroke="${lineC}" stroke-width="1" stroke-linecap="round"/>`);
    if (mouth === 'smirk') out.push(lowerLip(0.5) + `<path d="M${hx - 3} ${my + 1}Q${hx + 0.8} ${my + 1.8} ${hx + 3.6} ${my - 0.3}" fill="none" stroke="${lineC}" stroke-width="1" stroke-linecap="round"/>`);
    if (mouth === 'pout') out.push(lowerLip(0.75) + `<path d="M${hx - 2.2} ${my + 1}Q${hx} ${my + 0.4} ${hx + 2.2} ${my + 1}" fill="none" stroke="${lineC}" stroke-width="1" stroke-linecap="round"/>`);
    if (mouth === 'tight') out.push(`<path d="M${hx - 3.3} ${my + 1.4}Q${hx} ${my + 0.3} ${hx + 3.3} ${my + 1.4}" fill="none" stroke="${lineC}" stroke-width="1.05" stroke-linecap="round"/>` + lowerLip(0.35));
    if (mouth === 'grin') out.push(`<path d="M${hx - 3.9} ${my - 0.2}Q${hx} ${my + 4.6} ${hx + 3.9} ${my - 0.2}Q${hx} ${my + 0.7} ${hx - 3.9} ${my - 0.2}Z" fill="#8c3d40" stroke="${lineC}" stroke-width=".8" stroke-linejoin="round"/>`
      + `<path d="M${hx - 3.2} ${my + 0.35}Q${hx} ${my + 1.1} ${hx + 3.2} ${my + 0.35}L${hx + 2.6} ${my + 1.5}Q${hx} ${my + 2} ${hx - 2.6} ${my + 1.5}Z" fill="#fff"/>`
      + `<path d="M${hx - 1.8} ${my + 3}Q${hx} ${my + 3.8} ${hx + 1.8} ${my + 3}" fill="none" stroke="#e58b8b" stroke-width=".9" stroke-linecap="round" opacity=".8"/>`);

    // ── 앞머리·정수리 ──
    if (capD) {
      out.push(`<path d="${capD}" fill="url(#${id}hr)" ${S}/>`);
      out.push(`<g clip-path="url(#${id}h)">`);
      // 머릿결
      const strands = [];
      for (const p of fringe) if (p.t && Math.abs(p.x - hx) < fw - 1) strands.push(`M${(hx + (p.x - hx) * 0.35).toFixed(2)} ${hy - 17}Q${(p.x + (hx - p.x) * 0.1).toFixed(2)} ${(yT - 1).toFixed(2)} ${p.x.toFixed(2)} ${(p.y - 1).toFixed(2)}`);
      out.push(`<path d="${strands.join('')}" fill="none" stroke="${hairD}" stroke-width=".6" stroke-opacity=".7" stroke-linecap="round"/>`);
      // 윤기(천사 고리)
      out.push(`<path d="M${hx - 10.5} ${hy - 10.5}Q${hx} ${hy - 17.5} ${hx + 10.5} ${hy - 10.5}" fill="none" stroke="${hairL}" stroke-width="1.7" stroke-opacity=".6" stroke-dasharray="2.6 1.3" stroke-linecap="round"/>`);
      if (style === 'curly') out.push(`<path d="M${hx - 10} ${hy - 6}q2 -2 4 0q2 2 4 0q2 -2 4 0q2 2 4 0q2 -2 4 0" fill="none" stroke="${hairD}" stroke-width=".6" stroke-opacity=".7"/>`);
      out.push(`</g>`);
      if (style === 'curly') out.push([[-11.5, -9], [-8, -14.5], [-2.5, -17.6], [3.5, -17.6], [9, -14.5], [12, -9]].map(([x, y]) => `<circle cx="${hx + x}" cy="${hy + y}" r="${tr.elder ? 3.6 : 3.3}" fill="url(#${id}hr)" ${S}/>`).join(''));
    }
    if (style === 'thin') {
      out.push(`<path d="M${hx - fw - 0.6} ${hy + 2}C${hx - fw - 2} ${hy - 6} ${hx - fw} ${hy - 11} ${hx - fw + 4} ${hy - 12}L${hx - fw + 3} ${hy - 3}Z" fill="url(#${id}hr)" ${S}/><path d="M${hx + fw + 0.6} ${hy + 2}C${hx + fw + 2} ${hy - 6} ${hx + fw} ${hy - 11} ${hx + fw - 4} ${hy - 12}L${hx + fw - 3} ${hy - 3}Z" fill="url(#${id}hr)" ${S}/>`);
      out.push(`<path d="M${hx - 5} ${hy - 14.6}q5 -1.6 10 0" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/>`);
    }
    // 얼굴 옆으로 내려오는 머리(여성 긴 머리)
    if (style === 'long' || style === 'wave' || style === 'bob') {
      const end = style === 'bob' ? hy + 13.5 : hy + 14;
      for (const s of [-1, 1]) {
        const x0 = hx + s * (fw + 1.2);
        out.push(`<path d="M${x0} ${hy - 4}Q${x0 + s * 1.2} ${hy + 6} ${x0 - s * 1.2} ${end}Q${x0 - s * 2.6} ${hy + 5} ${x0 - s * 3.4} ${hy - 4}Z" fill="url(#${id}hr)" ${S}/>`);
      }
      if (style !== 'bob') for (const s of [-1, 1]) {
        const x0 = hx + s * (fw - 0.5);
        out.push(`<path d="M${x0} ${hy + 15}Q${x0 + s * 6} ${hy + 22} ${x0 + s * 4} ${hy + 33}Q${x0 + s * 8} ${hy + 25} ${x0 + s * 5} ${hy + 15}Z" fill="url(#${id}hr)" ${S}/>`);
      }
    }
    // 모자 (경비원·기사 등)
    if (tr.cap) {
      const top = hy - 17;
      out.push(`<path d="M${hx - fw - 1.4} ${top + 9.6}C${hx - fw - 2} ${top - 6} ${hx + fw + 2} ${top - 6} ${hx + fw + 1.4} ${top + 9.6}Z" fill="#33405a" ${S}/>`
        + `<path d="M${hx - fw - 2.4} ${top + 9.6}H${hx + fw - 2}C${hx + fw + 5} ${top + 9.6} ${hx + fw + 8} ${top + 11.4} ${hx + fw + 9} ${top + 13.4}H${hx - fw - 2.4}Z" fill="#232c3d" ${S}/>`
        + `<circle cx="${hx}" cy="${top + 3.6}" r="2.2" fill="#f2c14e" stroke="${INK}" stroke-width=".7"/>`
        + `<path d="M${hx - 9} ${top + 1}Q${hx - 4} ${top - 3} ${hx + 2} ${top - 2.2}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.2" stroke-linecap="round"/>`);
    }
    out.push('</g>');
    out.push(`<rect x="1" y="1" width="62" height="62" rx="8" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out.join('')}</svg>`;
  }

  // size: 픽셀. 사건마다 다른 얼굴이 되도록 seed 는 보통 `${case.id}:${suspect.id}`.
  function portrait(seed, name, size = 48) {
    const el = document.createElement('span');
    el.className = 'portrait';
    el.style.width = el.style.height = size + 'px';
    el.innerHTML = markup(seed, name);
    return el;
  }

  // 사건의 용의자 얼굴. 같은 사건·같은 용의자면 어느 모드에서나 같은 얼굴이 나온다.
  const face = (C, s, size) => portrait(((C && C.id) || 'case') + ':' + s.id, s.name, size);

  DO.svg = svg;
  DO.face = face;
  DO.portrait = portrait;
  DO.portraitMarkup = markup;
})();
