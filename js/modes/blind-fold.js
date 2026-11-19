// 모드 6: 이마 접기 (이마 게임 + 용의자 접기 결합, 패스앤플레이)
//
// 내가 어떤 용의자인지 나만 모른다. 남들은 공개 단계에서 내 용의자 이름과 프로필을 본다.
// 라운드마다 조건이 하나 나오고, 각자 "나는 해당하는 사람일까?"를 찍는다 (접는다 / 안 접는다).
// 앱이 정답을 공개한다:
//   - 실제로 해당하면 손가락 하나 접음 (-1)   ← 용의자 접기
//   - 찍은 게 틀리면 추가로 -1               ← 내 정체를 모르는 대가
// 2라운드마다 단서가 공개된다. 마지막에 각자 비밀리에 "나는 누구 / 범인은 누구"를 답한다.
// 점수 = 남은 손가락 + 내 정체 정답 3점 + 범인 정답 2점.
//
// 재미 포인트: 남들은 내 프로필을 알기 때문에 나를 겨냥한 조건을 고를 수 있다.
// 범인을 맡은 사람은 자기가 범인인 줄 모른다. 단서가 가리키는 용의자가 남들 중에 없다면… 그게 나다.

(() => {
  const { h, render, shuffle, tagText, nameEntry, handOff } = DO;

  const FINGERS = 5;
  const MAX_ROUNDS = 6;
  const SELF_POINTS = 3;
  const CULPRIT_POINTS = 2;

  DO.registerMode({
    id: 'blind-fold',
    name: '이마 접기',
    desc: '접기 + 이마 게임. 내가 어떤 용의자인지 나만 모른 채 접는다. 마지막에 내 정체와 범인을 맞힌다. 3~5명.',
    ready: true,
    start(root, ctx) {
      const C = ctx.case;
      const maxPlayers = Math.max(3, C.suspects.length - 1); // 소거법으로 바로 알 수 없게 용의자보다 1명 적게
      let players = []; // { name, suspect, fingers, wrong, answer: {self, culprit} }
      let conditions = shuffle(C.conditions);
      const usedConditions = [];
      const clues = [...C.clues];
      const revealedClues = [];
      const totalRounds = Math.min(MAX_ROUNDS, C.conditions.length);
      let round = 0;

      // ---------- 1. 설정 ----------
      function setup() {
        nameEntry(root, {
          min: 3, max: maxPlayers,
          title: C.title, intro: C.intro,
          note: `플레이어 3~${maxPlayers}명. 자기 용의자는 본인만 모릅니다. 손가락 ${FINGERS}개, ${totalRounds}라운드.`,
          onStart(names) {
            const culprit = C.suspects.find(s => s.id === C.culprit);
            const others = shuffle(C.suspects.filter(s => s.id !== C.culprit)).slice(0, names.length - 1);
            const sus = shuffle([culprit, ...others]);
            players = names.map((name, i) => ({ name, suspect: sus[i], fingers: FINGERS, wrong: 0, answer: null }));
            reveal(0);
          },
        });
      }

      // ---------- 2. 정체 공개 (본인 빼고) ----------
      function reveal(i) {
        if (i >= players.length) return roundStart();
        const p = players[i];
        render(root,
          h('div', { class: 'center handoff' },
            h('div', { class: 'big' }, '🙈'),
            h('h2', {}, `${p.name}님은 눈을 감으세요`),
            h('p', { class: 'muted' }, '나머지 사람들이 이 사람의 용의자를 확인합니다. 본인은 절대 보지 마세요!'),
            h('button', { class: 'primary', onClick: () => showCard(i) }, `${p.name} 빼고 모두 준비됨`),
          ),
        );
      }

      function showCard(i) {
        const p = players[i];
        render(root,
          h('p', { class: 'muted center' }, `${p.name}님의 용의자 (본인은 보지 마세요)`),
          h('div', { class: 'card secret role-card' },
            DO.face(C, p.suspect, 88),
            h('div', { class: 'role' }, p.suspect.name),
            h('p', {}, p.suspect.profile),
          ),
          h('p', { class: 'muted small-text' }, '기억해 두세요. 이 사람을 겨냥한 조건을 고르면 손가락을 접게 만들 수 있습니다.'),
          h('button', { class: 'primary', onClick: () => reveal(i + 1) },
            i + 1 < players.length ? '확인했음 → 다음 사람' : '확인했음 → 게임 시작'),
        );
      }

      // ---------- 3. 라운드 ----------
      function roundStart() {
        if (round >= totalRounds || conditions.length === 0) return answerPhase(0);
        round++;
        if (DO.music) DO.music.intensity(round >= totalRounds ? 2 : round >= totalRounds - 1 ? 1 : 0);
        const picker = players[(round - 1) % players.length];
        render(root,
          h('h2', {}, `라운드 ${round}/${totalRounds}`),
          board(),
          h('p', {}, h('b', {}, picker.name), '님이 조건을 고르세요. (남들의 정체를 떠올리며!)'),
          conditions.map(c => h('button', { onClick: () => guessPhase(c) }, c.text)),
        );
      }

      function guessPhase(cond) {
        conditions = conditions.filter(c => c !== cond);
        usedConditions.push(cond);
        const guess = {};
        const btns = players.map(p => {
          const b = h('button', { onClick: () => {
            guess[p.name] = !guess[p.name];
            b.textContent = `${p.name} — ${guess[p.name] ? '✋ 접는다' : '안 접는다'}`;
            b.classList.toggle('primary', !!guess[p.name]);
          } }, `${p.name} — 안 접는다`);
          return b;
        });
        render(root,
          h('h2', {}, cond.text),
          h('p', { class: 'muted' }, '각자 "나는 해당하는 사람일까?"를 찍으세요. 해당한다고 생각하면 자기 이름을 눌러 접습니다.'),
          h('p', { class: 'muted small-text' }, '남들은 정답을 알지만 알려 주면 안 됩니다. 표정 관리!'),
          btns,
          h('button', { class: 'primary', onClick: () => resolve(cond, guess) }, '확정'),
        );
      }

      function resolve(cond, guess) {
        const rows = players.map(p => {
          const truth = p.suspect.traits.includes(cond.tag);
          const guessed = !!guess[p.name];
          let loss = 0;
          if (truth) loss += 1;               // 해당하면 접음
          if (guessed !== truth) { loss += 1; p.wrong++; } // 틀리면 추가
          p.fingers = Math.max(0, p.fingers - loss);
          return { p, truth, guessed, loss };
        });
        render(root,
          h('h2', {}, '정답 공개'),
          h('p', { class: 'muted' }, cond.text),
          h('div', { class: 'card' }, rows.map(r => h('div', { class: 'player' },
            h('span', {}, h('b', {}, r.p.name), h('span', { class: 'muted' }, r.truth ? ' · 해당 ✋' : ' · 해당 없음')),
            h('span', { class: r.guessed === r.truth ? 'muted' : 'battery' },
              (r.guessed === r.truth ? '찍기 성공' : '찍기 실패') + (r.loss ? ` (-${r.loss})` : '')),
          ))),
          board(),
          h('button', { class: 'primary', onClick: () => {
            if (round % 2 === 0 && clues.length) revealClue();
            else roundStart();
          } }, round >= totalRounds || !conditions.length ? '마지막 답변으로' : '다음 라운드'),
        );
      }

      // ---------- 4. 단서 ----------
      function revealClue() {
        const clue = clues.shift();
        revealedClues.push(clue);
        render(root,
          h('h2', {}, '🗂 단서 공개'),
          h('div', { class: 'card good' }, h('p', {}, clue.text)),
          clue.exposes ? h('p', { class: 'muted' }, '관련 조건: ' + tagText(C, clue.exposes)) : null,
          h('p', { class: 'muted small-text' }, '이 단서가 가리키는 용의자가 남들 중에 없다면… 그게 당신일지도.'),
          h('button', { class: 'primary', onClick: roundStart }, round >= totalRounds || !conditions.length ? '마지막 답변으로' : '다음 라운드'),
        );
      }

      // ---------- 5. 마지막 답변 (비밀) ----------
      function answerPhase(i) {
        if (i >= players.length) return finish();
        const p = players[i];
        handOff(root, p.name, '본인만 보고 답하세요. 나는 누구이고, 범인은 누구인가?', () => {
          let self = null, culprit = null;
          const mark = (btns, el) => btns.forEach(b => b.classList.toggle('primary', b === el));
          const selfBtns = C.suspects.map(s => h('button', { onClick: e => { self = s; mark(selfBtns, e.currentTarget); } }, s.name));
          const culBtns = C.suspects.map(s => h('button', { onClick: e => { culprit = s; mark(culBtns, e.currentTarget); } }, s.name));
          render(root,
            h('h2', {}, `${p.name}님의 답`),
            h('p', { class: 'muted' }, `공개된 단서: ${revealedClues.map(c => c.text).join(' · ') || '없음'}`),
            h('p', { class: 'muted small-text' }, '내가 해당했던 조건: ' + (usedConditions.filter(c => p.suspect.traits.includes(c.tag)).map(c => c.text.replace(/\s*접어\s*$/, '')).join(' / ') || '없음')),
            h('h3', {}, `나는 이 용의자다 (+${SELF_POINTS})`), selfBtns,
            h('h3', {}, `범인은 이 용의자다 (+${CULPRIT_POINTS})`), culBtns,
            h('button', { class: 'primary', onClick: () => {
              if (!self || !culprit) return DO.toast('둘 다 고르세요.');
              p.answer = { self, culprit };
              answerPhase(i + 1);
            } }, i + 1 < players.length ? '확정 → 다음 사람에게' : '확정 → 결과 보기'),
          );
          DO.music && DO.music.hold('suspense');
        });
      }

      // ---------- 6. 결과 ----------
      function finish() {
        const culpritSus = C.suspects.find(s => s.id === C.culprit);
        const culpritPlayer = players.find(p => p.suspect.id === C.culprit);
        for (const p of players) {
          p.selfOk = p.answer.self.id === p.suspect.id;
          p.culOk = p.answer.culprit.id === C.culprit;
          p.score = p.fingers + (p.selfOk ? SELF_POINTS : 0) + (p.culOk ? CULPRIT_POINTS : 0);
        }
        const ranked = [...players].sort((a, b) => b.score - a.score);
        render(root,
          h('h2', {}, '게임 종료'),
          h('p', {}, '범인: ', h('b', {}, `${culpritPlayer.name} (${culpritSus.name})`),
            culpritPlayer.culOk ? ' — 본인도 알아챘습니다!' : ' — 본인은 끝까지 몰랐습니다.'),
          h('div', { class: 'card' },
            h('h3', {}, '🏆 순위'),
            h('ol', { class: 'rank' }, ranked.map(p =>
              h('li', {}, h('b', {}, `${p.name} — ${p.score}점`),
                h('div', { class: 'muted small-text' },
                  `손가락 ${p.fingers} · 정체 ${p.selfOk ? '정답' : `오답 (답: ${p.answer.self.name})`} · 범인 ${p.culOk ? '정답' : `오답 (답: ${p.answer.culprit.name})`}`)))),
          ),
          revealedClues.length < C.clues.length
            ? h('p', { class: 'muted' }, '공개되지 않은 단서: ' + C.clues.filter(c => !revealedClues.includes(c)).map(c => c.text).join(' · '))
            : null,
          h('h3', {}, '전원 정체'),
          players.map(p => h('div', { class: 'card' + (p === culpritPlayer ? ' alert' : '') },
            h('b', {}, `${p.name} — ${p.suspect.name}`), h('p', { class: 'muted' }, p.suspect.profile))),
          h('button', { class: 'primary', onClick: () => DO.goHome() }, '처음으로'),
        );
        if (DO.fx) DO.fx.ending(true); // 순위 발표
      }

      function board() {
        return h('div', { class: 'card' },
          players.map(p => h('div', { class: 'player' },
            h('span', {}, p.name),
            h('span', { class: 'fingers' }, '✋'.repeat(p.fingers) || '💀'),
          )),
          revealedClues.length ? h('p', { class: 'muted small-text' }, '공개된 단서: ' + revealedClues.map(c => c.text).join(' · ')) : null,
        );
      }

      setup();
    },
  });
})();
