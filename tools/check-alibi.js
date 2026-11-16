// 알리바이 깨기 엔진(js/alibi-engine.js) 대량 검증
// 사용: node tools/check-alibi.js [판 수=6]   (프로젝트 폴더에서)
//
// 모든 손으로 쓴 사건 × 난이도 3 × 판 N 개에 대해
//  - 퍼즐이 만들어진다
//  - 후보가 범인 한 명뿐이다 (유일해)
//  - 증거 카드는 진짜 동선에서 전부 사실이다
//  - 범인이 아닌 사람의 진술·증언은 전부 사실이다
//  - 범인의 진술은 말이 되는 동선이고 범행 시각에 현장이 아니다. 진짜 동선은 범행 시각에 현장이다
//  - 범인 말고는 범행 시각에 현장에 없다
//  - 같은 입력이면 같은 퍼즐이 나온다 (결정성)
// 난이도 조건을 맞춘 비율과 추리 깊이 분포를 함께 출력한다.

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
new Function(fs.readFileSync(path.join(root, 'js/alibi-engine.js'), 'utf8'))();

const A = DO.alibi;
const N = +(process.argv[2] || 6);
let bad = 0, total = 0;
const stats = A.LEVELS.map(() => ({ n: 0, ok: 0, depth: {}, cards: 0, ms: 0 }));
const fail = (id, msg) => { console.log(`   ✗ ${id}: ${msg}`); bad++; };

for (const C of DO.listCases()) {
  for (let level = 0; level < A.LEVELS.length; level++) {
    for (let v = 0; v < N; v++) {
      const id = `${C.id} L${level} v${v}`;
      const t0 = Date.now();
      const p = A.generate(C, level, v);
      const ms = Date.now() - t0;
      total++;
      if (!p) { fail(id, '퍼즐 생성 실패'); continue; }
      const st = stats[level];
      st.n++; st.ms += ms; st.cards += p.evidence.length; if (p.ok) st.ok++;
      st.depth[p.depth] = (st.depth[p.depth] || 0) + 1;
      st.needed = st.needed || {}; st.needed[p.needed] = (st.needed[p.needed] || 0) + 1; st.max = Math.max(st.max || 0, ms);

      const ci = p.culpritIdx;
      if (p.suspects[ci].id !== C.culprit) fail(id, '범인 번호가 사건과 다름');
      const sol = A.solve(p);
      if (sol.length !== 1 || sol[0] !== ci) fail(id, `유일해 아님: 후보 ${JSON.stringify(sol)}`);
      // (용의자, 범행 시각) 쌍으로도 정답 하나뿐이어야 한다. 전설에서는 시각 후보가 3칸.
      const pairs = A.solvePairs(p);
      if (pairs.length !== 1 || pairs[0][0] !== ci || pairs[0][1] !== p.tStar) fail(id, `(누가, 언제) 유일해 아님: ${JSON.stringify(pairs)}`);
      if (!p.window.includes(p.tStar)) fail(id, '시각 후보에 범행 시각이 없음');
      if (p.window.length !== (level === 3 ? 3 : 1)) fail(id, `시각 후보 수가 이상함: ${p.window.length}`);
      for (const tc of p.timeCores) {
        if (p.suspects.some((_, i) => A.feasible(p, i, tc.core, tc.t))) fail(id, `시각 해설 근거가 ${p.times[tc.t]} 을 지우지 못함`);
      }
      if (level === 3) { st.tcore = st.tcore || {}; const m = Math.max(...p.timeCores.map(tc => tc.core.length)); st.tcore[m] = (st.tcore[m] || 0) + 1; }
      for (const c of p.evidence) if (!A.holds(c, p.truth)) fail(id, `거짓인 증거: ${JSON.stringify(c)}`);
      for (const c of p.testimonies) if (c.by !== ci && !A.holds(c, p.truth)) fail(id, `결백한 사람의 거짓 증언: ${JSON.stringify(c)}`);
      p.suspects.forEach((s, i) => {
        if (i !== ci && p.claims[i].join() !== p.truth[i].join()) fail(id, `${s.name} 진술이 사실과 다름`);
        if (i !== ci && p.truth[i][p.tStar] === 0) fail(id, `${s.name} 이 범행 시각에 현장에 있음`);
      });
      const valid = w => w.every((x, t) => t === 0 || p.adj[w[t - 1]][x]);
      if (!valid(p.claims[ci]) || !valid(p.truth[ci])) fail(id, '범인의 동선이 지도와 안 맞음');
      if (p.claims[ci].includes(0)) fail(id, '범인이 현장에 있었다고 진술함');
      if (p.truth[ci][p.tStar] !== 0) fail(id, '범인의 진짜 동선이 범행 시각에 현장이 아님');
      if (!p.lieSlots.includes(p.tStar)) fail(id, '거짓 칸에 범행 시각이 없음');
      if (p.testimonies.length > p.suspects.length || !p.testimonies.length) fail(id, '증언 수가 이상함');
      const again = A.generate(C, level, v);
      const key = q => JSON.stringify([q.claims, q.truth, q.testimonies, q.evidence, q.places, q.edges, q.times]);
      if (key(again) !== key(p)) fail(id, '결정성 깨짐');
      for (const co of p.cores) if (A.feasible(p, co.i, co.core)) fail(id, '해설 근거가 그 사람을 지우지 못함');
    }
  }
}

console.log(`퍼즐 ${total}개 검사, 오류 ${bad}건`);
stats.forEach((s, L) => {
  console.log(`  난이도 ${A.LEVELS[L].label}: 조건 충족 ${s.ok}/${s.n} · 깊이 분포 ${JSON.stringify(s.depth)} · 평균 증거 ${(s.cards / s.n).toFixed(1)}장 · 평균 ${(s.ms / s.n).toFixed(0)}ms(최대 ${s.max}ms) · 꼭 필요한 증거 ${JSON.stringify(s.needed)}${s.tcore ? ' · 시각을 지우는 데 필요한 최대 장수 ' + JSON.stringify(s.tcore) : ''}`);
});
process.exit(bad ? 1 : 0);
