// 절차적 초상화: 씨앗 문자열 → 항상 같은 얼굴(SVG). 이미지 파일이 없어도 용의자마다 얼굴이 생긴다.
//   DO.portrait(seed, name, size) → <span class="portrait"> 요소
//   DO.svg(tag, attrs, ...children) → SVG 요소 (지도 등에서 공용)
// 이름에 들어 있는 단어(할머니, 초등학생, 경비원 …)로 나이대·머리 모양·모자를 맞춘다.

(() => {
  const { rng, hashString } = DO;
  const INK = '#2b2419';
  const SKIN = ['#f6d7b8', '#f0c8a0', '#e8b98f', '#d9a377', '#fbe3cc'];
  const HAIR = ['#2a2320', '#3b2a1e', '#5a3a24', '#1d1d24', '#6b4a2f'];
  const GRAY = ['#b9b4ab', '#d6d1c7', '#9c978e'];
  const CLOTH = ['#b8402f', '#3b6ea5', '#3f7d4e', '#7d5aa0', '#c98a1b', '#4a5560', '#8a5a44', '#2b8a8a'];
  const BG = ['#f3e7cf', '#e9ead8', '#f0e0d6', '#e3e8ee', '#efe4f0'];
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

  function traitsOf(name) {
    const n = String(name || '');
    return {
      elder: /할머니|할아버지|노인/.test(n),
      child: /초등|막내|어린이|아이\b|유치/.test(n),
      cap: /경비|기사|라이더|안전요원|승무원|요원/.test(n),
      glassesBias: /선생|사서|매니저|플래너|회사원|인턴|조교|수험|재수|준비생/.test(n),
      fem: /할머니|엄마|아내|신부|이모|누나|언니|여학생|간호사/.test(n),
      masc: /할아버지|아빠|남편|아저씨|삼촌|신랑|오빠|남학생/.test(n),
    };
  }

  function markup(seed, name) {
    const r = rng(hashString('face:' + seed));
    const pick = a => a[Math.floor(r() * a.length)];
    const tr = traitsOf(name);
    const id = 'pf' + (uid++);
    const skin = pick(SKIN);
    const hair = tr.elder ? pick(GRAY) : pick(HAIR);
    const cloth = pick(CLOTH);
    const bg = pick(BG);
    const long = tr.fem ? r() < 0.8 : tr.masc ? false : r() < 0.4;
    const style = tr.elder && tr.masc ? 'thin' : long ? pick(['long', 'long', 'bun', 'bob']) : pick(['crop', 'bowl', 'part', 'curly', 'crop']);
    const glasses = r() < (tr.elder ? 0.6 : tr.glassesBias ? 0.55 : 0.2);
    const eye = tr.child ? 'big' : pick(['dot', 'dot', 'dot', 'smile', 'narrow']);
    const mouth = pick(['smile', 'flat', 'smirk', 'o', 'frown', 'smile']);
    const brow = pick([0, 1, -1]);
    const hx = 32, hy = tr.child ? 30 : 29, rx = tr.child ? 15.5 : 15, ry = tr.child ? 15 : 16.5;
    const S = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;
    const out = [];

    out.push(`<defs><clipPath id="${id}"><rect x="1" y="1" width="62" height="62" rx="8"/></clipPath></defs>`);
    out.push(`<rect x="1" y="1" width="62" height="62" rx="8" fill="${bg}"/>`);
    // 키 재는 줄
    out.push(`<g stroke="${INK}" stroke-opacity=".13" stroke-width="1"><path d="M1 14h62M1 26h62M1 38h62"/></g>`);
    out.push(`<g clip-path="url(#${id})">`);
    // 뒷머리
    if (style === 'long') out.push(`<path d="M14 30C13 10 51 10 50 30L52 52C46 54 42 49 40 44L24 44C22 49 18 54 12 52Z" fill="${hair}" ${S}/>`);
    if (style === 'bob') out.push(`<path d="M14 30C13 10 51 10 50 30L50 42C46 44 42 43 40 41L24 41C22 43 18 44 14 42Z" fill="${hair}" ${S}/>`);
    if (style === 'bun') out.push(`<circle cx="32" cy="9.5" r="5.5" fill="${hair}" ${S}/>`);
    // 어깨와 옷
    out.push(`<path d="M7 66C7 51 19 46 32 46C45 46 57 51 57 66Z" fill="${cloth}" ${S}/>`);
    out.push(`<path d="M26 47L32 54L38 47" fill="none" ${S}/>`);
    // 목, 귀, 얼굴
    out.push(`<rect x="27" y="38" width="10" height="11" rx="3" fill="${skin}" ${S}/>`);
    out.push(`<circle cx="${hx - rx}" cy="${hy + 1}" r="2.6" fill="${skin}" ${S}/><circle cx="${hx + rx}" cy="${hy + 1}" r="2.6" fill="${skin}" ${S}/>`);
    out.push(`<ellipse cx="${hx}" cy="${hy}" rx="${rx}" ry="${ry}" fill="${skin}" ${S}/>`);
    // 앞머리
    const top = hy - ry;
    if (style === 'crop') out.push(`<path d="M17 ${hy - 2}C15 ${top - 3} 49 ${top - 3} 47 ${hy - 2}C44 ${top + 7} 38 ${top + 5} 32 ${top + 5}C26 ${top + 5} 20 ${top + 7} 17 ${hy - 2}Z" fill="${hair}" ${S}/>`);
    if (style === 'bowl') out.push(`<path d="M17 ${hy + 1}C13 ${top - 4} 51 ${top - 4} 47 ${hy + 1}L45 ${top + 10}L19 ${top + 10}Z" fill="${hair}" ${S}/>`);
    if (style === 'part' || style === 'long' || style === 'bob') out.push(`<path d="M17 ${hy - 1}C15 ${top - 4} 49 ${top - 4} 47 ${hy - 1}C45 ${top + 8} 40 ${top + 6} 36 ${top + 7}C30 ${top + 9} 22 ${top + 9} 17 ${hy - 1}Z" fill="${hair}" ${S}/>`);
    if (style === 'bun') out.push(`<path d="M17 ${hy - 2}C15 ${top - 3} 49 ${top - 3} 47 ${hy - 2}C44 ${top + 6} 38 ${top + 4} 32 ${top + 4}C26 ${top + 4} 20 ${top + 6} 17 ${hy - 2}Z" fill="${hair}" ${S}/>`);
    if (style === 'curly') out.push([[19, 21], [24, 16], [32, 14], [40, 16], [45, 21], [17, 27], [47, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y + (hy - 29)}" r="5" fill="${hair}" ${S}/>`).join(''));
    if (style === 'thin') out.push(`<path d="M17 ${hy}C15 ${hy - 6} 17 ${hy - 10} 20 ${hy - 11}L19.5 ${hy - 3}Z" fill="${hair}" ${S}/><path d="M47 ${hy}C49 ${hy - 6} 47 ${hy - 10} 44 ${hy - 11}L44.5 ${hy - 3}Z" fill="${hair}" ${S}/>`);
    // 모자 (경비원·기사 등)
    if (tr.cap) out.push(`<path d="M16.5 ${top + 9}C16 ${top - 5} 48 ${top - 5} 47.5 ${top + 9}Z" fill="#2f3b52" ${S}/><path d="M15 ${top + 9}H44C50 ${top + 9} 53 ${top + 11} 54 ${top + 13}H15Z" fill="#232c3d" ${S}/>`);
    // 눈썹
    const by = hy - 5;
    out.push(`<path d="M22.5 ${by + brow}L28 ${by}M36 ${by}L41.5 ${by + brow}" fill="none" ${S}/>`);
    // 눈
    const ey = hy;
    if (eye === 'dot') out.push(`<circle cx="26" cy="${ey}" r="1.7" fill="${INK}"/><circle cx="38" cy="${ey}" r="1.7" fill="${INK}"/>`);
    if (eye === 'big') out.push(`<circle cx="26" cy="${ey}" r="2.4" fill="${INK}"/><circle cx="38" cy="${ey}" r="2.4" fill="${INK}"/><circle cx="26.8" cy="${ey - 0.8}" r=".8" fill="#fff"/><circle cx="38.8" cy="${ey - 0.8}" r=".8" fill="#fff"/>`);
    if (eye === 'smile') out.push(`<path d="M23.5 ${ey}q2.5 -2.6 5 0M35.5 ${ey}q2.5 -2.6 5 0" fill="none" ${S}/>`);
    if (eye === 'narrow') out.push(`<path d="M23.5 ${ey}h5M35.5 ${ey}h5" fill="none" ${S}/>`);
    if (glasses) out.push(`<g fill="rgba(255,255,255,.35)" ${S}><circle cx="26" cy="${ey}" r="4.6"/><circle cx="38" cy="${ey}" r="4.6"/></g><path d="M30.6 ${ey}h2.8M21.4 ${ey}L17.5 ${ey - 1}M42.6 ${ey}L46.5 ${ey - 1}" fill="none" ${S}/>`);
    // 볼, 주름
    if (tr.child) out.push(`<circle cx="22" cy="${ey + 5}" r="2.6" fill="#e98b7d" opacity=".45"/><circle cx="42" cy="${ey + 5}" r="2.6" fill="#e98b7d" opacity=".45"/>`);
    if (tr.elder) out.push(`<path d="M20 ${ey + 3}q1.5 1 3 .5M41 ${ey + 3.5}q1.5 .5 3 -.5M27 ${hy + 13}q5 1.5 10 0" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="1" stroke-linecap="round"/>`);
    // 코, 입
    out.push(`<path d="M32 ${ey + 2}l-1.4 3.6h2.6" fill="none" stroke="${INK}" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`);
    const my = hy + 9.5;
    if (mouth === 'smile') out.push(`<path d="M27 ${my}q5 4 10 0" fill="none" ${S}/>`);
    if (mouth === 'flat') out.push(`<path d="M28 ${my + 1}h8" fill="none" ${S}/>`);
    if (mouth === 'smirk') out.push(`<path d="M28 ${my + 1}q5 2 9 -1.5" fill="none" ${S}/>`);
    if (mouth === 'o') out.push(`<ellipse cx="32" cy="${my + 1}" rx="1.8" ry="2.2" fill="#7a3b33" ${S}/>`);
    if (mouth === 'frown') out.push(`<path d="M27.5 ${my + 2.5}q4.5 -3.4 9 0" fill="none" ${S}/>`);
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
