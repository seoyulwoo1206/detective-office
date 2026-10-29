// 손으로 쓴 사건(data/cases/*.js)의 불변 조건 검사
// 사용: node tools/check-cases.js   (프로젝트 폴더에서)
//
// 검사 항목
//  - culprit 이 suspects 에 있음
//  - 범인의 lies 태그, 단서의 exposes 태그가 모두 conditions 에 있음
//  - 폭로 단서(exposes)는 범인이 실제로 거짓말하는 태그만 가리킴
//  - 범인이 "접었다"고 거짓말하는 알리바이 태그는 비범인 중 정확히 1명(증인)만 가짐
//  - 범인의 거짓말마다 그것을 폭로하는 단서가 1장 이상 있음
//  - (경고) 첫 단서가 중립이 아니면 알려만 줌
// 추가로 방탈출 자물쇠 번호를 출력한다.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
global.window = {};
global.document = { createElement() { throw new Error('DOM 없음'); } };
new Function(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'))();
global.DO = window.DO;

const caseDir = path.join(root, 'data/cases');
for (const f of fs.readdirSync(caseDir).filter(f => f.endsWith('.js')).sort()) {
  new Function(fs.readFileSync(path.join(caseDir, f), 'utf8'))();
}

const claims = (s, tag) => s.traits.includes(tag) !== s.lies.includes(tag);
let bad = 0;

for (const C of DO.listCases()) {
  const errs = [], warns = [];
  const culprit = C.suspects.find(s => s.id === C.culprit);
  if (!culprit) { console.log(`${C.id} FAIL 범인(${C.culprit})이 용의자 목록에 없음`); bad++; continue; }

  const tags = new Set(C.conditions.map(c => c.tag));
  for (const s of C.suspects) {
    if (s !== culprit && s.lies.length) errs.push(`비범인 ${s.id} 에 lies 가 있음`);
    for (const t of s.lies) if (!tags.has(t)) errs.push(`lies 태그 ${t} 에 해당하는 조건 없음`);
  }
  for (const c of C.clues) {
    if (c.exposes && !tags.has(c.exposes)) errs.push(`단서 ${c.id} 의 exposes=${c.exposes} 에 해당하는 조건 없음`);
    if (c.exposes && !culprit.lies.includes(c.exposes)) errs.push(`단서 ${c.id} 가 범인이 거짓말하지 않는 태그 ${c.exposes} 를 폭로함`);
  }
  for (const t of culprit.lies) {
    const truth = culprit.traits.includes(t);
    if (!truth) {
      const witnesses = C.suspects.filter(s => s !== culprit && s.traits.includes(t));
      if (witnesses.length !== 1) errs.push(`알리바이 태그 ${t}: 실제로 해당하는 비범인이 ${witnesses.length}명 (1명이어야 함)`);
    }
    if (!C.clues.some(c => c.exposes === t)) errs.push(`거짓말 ${t} 를 폭로하는 단서가 없음`);
  }
  if (C.clues.length && C.clues[0].exposes) warns.push('첫 단서가 중립이 아님 (바로 들통날 수 있음)');

  const code = C.conditions.slice(0, 3).map(c => C.suspects.filter(s => claims(s, c.tag)).length % 10).join('');
  const status = errs.length ? 'FAIL' : 'ok';
  console.log(`${C.id} ${status}  용의자 ${C.suspects.length} · 조건 ${C.conditions.length} · 단서 ${C.clues.length} · 자물쇠 ${code}`);
  for (const e of errs) console.log('   ✗ ' + e);
  for (const w of warns) console.log('   ! ' + w);
  bad += errs.length;
}

process.exit(bad ? 1 : 0);
