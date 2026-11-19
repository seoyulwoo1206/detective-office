// 모드 1: 용의자 접기 (손병호 게임 변형, 패스앤플레이)
//
// 흐름
//  1. 플레이어 이름 입력 → 용의자 무작위 배정 (범인은 항상 포함)
//  2. 한 명씩 폰을 받아 비밀 프로필 확인
//  3. 라운드: 차례인 사람이 조건을 고른다 → 각자 "접음/안 접음" 선언 (양심 시스템, 범인은 거짓말 가능)
//  4. 2라운드마다 단서 카드 공개 → 거짓말 들통난 사람 손가락 -2
//     (해당되는데 안 접은 것도, 해당 안 되는데 접은 것도 거짓말로 본다)
//  5. 누구든 "범인 지목" 가능. 맞히면 승리, 틀리면 손가락 -1
//  6. 조건 소진 or 생존자 1명이면 종료 → 전원 프로필 공개

(() => {
  const { h, render, shuffle, tagText, nameEntry, handOff } = DO;

  DO.registerMode({
    id: 'fold',
    name: '용의자 접기',
    desc: '손병호 게임 + 추리. 범인은 거짓말을 할 수 있다. 2~6명.',
    ready: true,
    start(root, ctx) {
      const C = ctx.case;
      let players = [];           // { name, suspect, fingers, declared: {tag: bool}, out }
      let conditions = shuffle(C.conditions);
      const usedConditions = [];
      const clues = [...C.clues];
      const revealedClues = [];
      let round = 0;
      let turn = 0;

      // ---------- 1. 설정 ----------
      function setup() {
        nameEntry(root, {
          min: 2, max: C.suspects.length,
          title: C.title, intro: C.intro,
          onStart(names) {
            // 범인은 반드시 포함, 나머지는 무작위
            const culprit = C.suspects.find(s => s.id === C.culprit);
            const others = shuffle(C.suspects.filter(s => s.id !== C.culprit)).slice(0, names.length - 1);
            const sus = shuffle([culprit, ...others]);
            players = names.map((name, i) => ({ name, suspect: sus[i], fingers: 5, declared: {}, out: false }));
            reveal(0);
          },
        });
      }

      // ---------- 2. 비밀 프로필 확인 ----------
      function reveal(i) {
        if (i >= players.length) return roundStart();
        const p = players[i];
        handOff(root, p.name, '다른 사람이 화면을 못 보게 하고 확인하세요.', () => {
          const shown = h('div', { class: 'card secret', hidden: true },
            h('div', { class: 'profile-head' }, DO.face(C, p.suspect, 64), h('h2', {}, p.suspect.name)),
            h('p', {}, p.suspect.profile),
            p.suspect.lies.length
              ? h('p', { class: 'muted' }, '거짓말해도 되는 조건: ' + p.suspect.lies.map(t => tagText(C, t)).join(' / '))
              : h('p', { class: 'muted' }, '당신은 범인이 아닙니다. 모든 조건에 솔직하게 답하세요.'),
          );
          render(root,
            h('div', { class: 'center' },
              h('h2', {}, `${p.name}님의 비밀 프로필`),
              h('p', { class: 'muted' }, '확인한 뒤 "확인했음"을 눌러 다음 사람에게 넘기세요.'),
            ),
            h('button', { class: 'primary', onClick: e => { shown.hidden = false; e.target.hidden = true; } }, '프로필 보기'),
            shown,
            h('button', { onClick: () => reveal(i + 1) }, i + 1 < players.length ? '확인했음 → 다음 사람에게' : '확인했음 → 게임 시작'),
          );
        });
      }

      // ---------- 3. 라운드 ----------
      function alive() { return players.filter(p => !p.out); }

      function roundStart() {
        if (conditions.length === 0 || alive().length <= 1) return finish();
        round++;
        const speaker = alive()[turn % alive().length];
        render(root,
          h('h2', {}, `라운드 ${round}`),
          statusBoard(),
          h('p', {}, h('b', {}, speaker.name), '님이 조건을 고르세요.'),
          conditions.map(c => h('button', { onClick: () => declare(c) }, c.text)),
          h('button', { class: 'danger', onClick: accuse }, '🔎 범인 지목하기'),
        );
      }

      function declare(cond) {
        conditions = conditions.filter(c => c !== cond);
        usedConditions.push(cond);
        const toggles = {};
        render(root,
          h('h2', {}, cond.text),
          h('p', { class: 'muted' }, '해당하는 사람은 자기 이름을 눌러 "접음"으로 바꾸세요. 범인은 거짓말해도 됩니다. 단서로 들키면 -2.'),
          alive().map(p => {
            const btn = h('button', { onClick: () => {
              toggles[p.name] = !toggles[p.name];
              btn.textContent = `${p.name} — ${toggles[p.name] ? '✋ 접음' : '안 접음'}`;
              btn.classList.toggle('primary', !!toggles[p.name]);
            } }, `${p.name} — 안 접음`);
            return btn;
          }),
          h('button', { class: 'primary', onClick: () => {
            for (const p of alive()) {
              const folded = !!toggles[p.name];
              p.declared[cond.tag] = folded;
              if (folded) p.fingers--;
              if (p.fingers <= 0) p.out = true;
            }
            turn++;
            if (round % 2 === 0 && clues.length) revealClue();
            else roundStart();
          } }, '확정'),
        );
      }

      // ---------- 4. 단서 공개 ----------
      function revealClue() {
        const clue = clues.shift();
        revealedClues.push(clue);
        const busted = [];
        if (clue.exposes) {
          for (const p of alive()) {
            const hasTrait = p.suspect.traits.includes(clue.exposes);
            const declared = p.declared[clue.exposes];
            // 아직 안 나온 조건이면 판정 불가. 나왔다면 선언과 사실이 다르면 거짓말.
            if (declared !== undefined && declared !== hasTrait) {
              p.fingers -= 2; if (p.fingers <= 0) p.out = true; busted.push(p.name);
            }
          }
        }
        render(root,
          h('h2', {}, '🗂 단서 공개'),
          h('div', { class: 'card' }, h('p', {}, clue.text)),
          clue.exposes
            ? h('p', { class: 'muted' }, '관련 조건: ' + tagText(C, clue.exposes))
            : null,
          busted.length
            ? h('div', { class: 'card alert' },
                h('p', {}, '거짓말 들통: ', h('b', {}, busted.join(', ')), ' (손가락 -2)'))
            : h('p', { class: 'muted' }, clue.exposes && !usedConditions.some(c => c.tag === clue.exposes)
                ? '관련 조건이 아직 나오지 않아 이번엔 판정할 수 없습니다. 기억해 두세요!'
                : '이번 단서로 들통난 사람은 없습니다.'),
          h('button', { class: 'primary', onClick: roundStart }, '다음 라운드'),
        );
        if (busted.length && DO.fx) DO.fx.fail();
      }

      // ---------- 5. 범인 지목 ----------
      function accuse() {
        let who = null, target = null;
        const mark = (btns, el) => btns.forEach(b => b.classList.toggle('primary', b === el));
        const whoBtns = alive().map(p => h('button', { onClick: e => { who = p; mark(whoBtns, e.currentTarget); } }, p.name));
        const tgtBtns = players.map(p => h('button', { onClick: e => { target = p; mark(tgtBtns, e.currentTarget); } }, `${p.name} (${p.suspect.name})`));
        render(root,
          h('h2', {}, '범인 지목'),
          h('p', { class: 'muted' }, '맞히면 지목한 사람이 승리합니다. 틀리면 손가락 -1.'),
          h('p', { class: 'muted' }, '누가 지목하나요?'), whoBtns,
          h('p', { class: 'muted' }, '누구를 지목하나요?'), tgtBtns,
          h('button', { class: 'danger', onClick: () => {
            if (!who || !target) return DO.toast('지목하는 사람과 대상을 모두 고르세요.');
            if (target.suspect.id === C.culprit) return finish(who);
            who.fingers -= 1; if (who.fingers <= 0) who.out = true;
            render(root,
              h('h2', {}, '❌ 틀렸습니다'),
              h('div', { class: 'card alert' },
                h('p', {}, h('b', {}, target.name), `(${target.suspect.name})은 범인이 아닙니다.`),
                h('p', {}, h('b', {}, who.name), ' 손가락 -1')),
              h('button', { class: 'primary', onClick: roundStart }, '계속'),
            );
            DO.fx && DO.fx.fail();
          } }, '지목 확정'),
          h('button', { onClick: roundStart }, '취소'),
        );
      }

      // ---------- 6. 종료 ----------
      function finish(winner) {
        const culprit = players.find(p => p.suspect.id === C.culprit);
        let msg;
        if (winner) msg = `🎉 ${winner.name} 승리! 범인을 맞혔습니다.`;
        else if (alive().length === 1) msg = `${alive()[0].name} 생존 승리!` + (alive()[0] === culprit ? ' (범인이 끝까지 살아남았습니다…)' : '');
        else msg = '조건이 모두 소진되었습니다. 범인 도주 성공!';
        render(root,
          h('h2', {}, '게임 종료'),
          h('div', { class: 'card' }, h('p', {}, h('b', {}, msg))),
          h('p', {}, '범인: ', h('b', {}, `${culprit.name} (${culprit.suspect.name})`)),
          revealedClues.length < C.clues.length
            ? h('p', { class: 'muted' }, '공개되지 않은 단서: ' + C.clues.filter(c => !revealedClues.includes(c)).map(c => c.text).join(' · '))
            : null,
          h('h2', {}, '전원 프로필'),
          players.map(p => h('div', { class: 'card explain' + (p === culprit ? ' alert' : '') },
            DO.face(C, p.suspect, 44),
            h('div', { class: 'grow' }, h('b', {}, `${p.name} — ${p.suspect.name}`), h('p', { class: 'muted' }, p.suspect.profile)))),
          h('button', { class: 'primary', onClick: () => DO.goHome() }, '처음으로'),
        );
        if (winner && DO.fx) DO.fx.win();
      }

      function statusBoard() {
        return h('div', { class: 'card' },
          players.map(p => h('div', { class: 'player' + (p.out ? ' out' : '') },
            h('span', {}, h('b', {}, p.name), h('span', { class: 'muted' }, ` · ${p.suspect.name}`)),
            h('span', { class: 'fingers' }, '✋'.repeat(Math.max(0, p.fingers)) || '💀'),
          )),
          revealedClues.length ? h('p', { class: 'muted' }, '공개된 단서: ' + revealedClues.map(c => c.text).join(' · ')) : null,
          clues.length ? h('p', { class: 'muted small-text' }, `남은 단서 ${clues.length}장 · 2라운드마다 1장 공개`) : null,
        );
      }

      setup();
    },
  });
})();
