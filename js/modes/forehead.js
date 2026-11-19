// 모드 2: 이마 게임 (패스앤플레이)
//
// 자기 역할(범인/공범/목격자/용의자)과 자기가 어떤 용의자인지 본인만 모른다.
// 다른 사람들은 모두 안다. 예/아니오 질문으로 자기 정체를 알아내는 게임.
//
// 흐름
//  1. 플레이어 이름 입력 → 역할 + 용의자 배정 (범인 1명은 항상 있음)
//  2. 한 명씩: 본인은 눈 감기 → 나머지가 그 사람의 역할/용의자/프로필 확인 → 다음
//  3. 차례마다 질문 1개
//     - 자유 질문: 말로 묻고 사람들이 답함 (앱은 횟수만 기록)
//     - 조건 질문: 사건의 조건 목록에서 골라 묻기 → 앱이 사실대로 예/아니오 답함
//     - 정답 말하기: 역할 + 용의자 둘 다 맞아야 성공. 틀리면 질문 수 +3
//  4. 전원 성공 or 라운드 제한 → 질문 수 적은 순으로 순위

(() => {
  const { h, render, shuffle, tagText, nameEntry, handOff } = DO;

  const ROLES = {
    culprit: { name: '범인', emoji: '🔪', desc: '사건을 저지른 사람' },
    accomplice: { name: '공범', emoji: '🤫', desc: '범인을 도운 사람. 범행은 직접 하지 않았다' },
    witness: { name: '목격자', emoji: '👀', desc: '범행 현장 근처에서 뭔가를 보거나 들은 사람' },
    suspect: { name: '용의자', emoji: '❓', desc: '의심받고 있지만 사건과 무관한 사람' },
  };
  const MAX_ROUNDS = 8;
  const WRONG_PENALTY = 3;

  function assignRoles(n) {
    // 범인 1, 목격자 1, 4명 이상이면 공범 1, 나머지 용의자
    const roles = ['culprit', 'witness'];
    if (n >= 4) roles.push('accomplice');
    while (roles.length < n) roles.push('suspect');
    return shuffle(roles.slice(0, n));
  }

  DO.registerMode({
    id: 'forehead',
    name: '이마 게임',
    desc: '내 역할(범인/공범/목격자/용의자)을 나만 모른다. 예/아니오 질문으로 알아내기. 2~6명.',
    ready: true,
    start(root, ctx) {
      const C = ctx.case;
      let players = []; // { name, role, suspect, questions, solved, solvedAt }
      let round = 0;
      let turn = 0;

      // ---------- 1. 설정 ----------
      function setup() {
        nameEntry(root, {
          min: 2, max: C.suspects.length,
          title: C.title, intro: C.intro,
          note: `플레이어 2~${C.suspects.length}명. 역할과 용의자 신분은 본인만 모릅니다.`,
          onStart(names) {
            const roles = assignRoles(names.length);
            const culpritSus = C.suspects.find(s => s.id === C.culprit);
            const others = shuffle(C.suspects.filter(s => s.id !== C.culprit));
            players = names.map((name, i) => ({
              name, role: roles[i],
              suspect: roles[i] === 'culprit' ? culpritSus : others.pop(),
              questions: 0, solved: false, solvedAt: null,
            }));
            reveal(0);
          },
        });
      }

      // ---------- 2. 정체 공개 (본인 빼고) ----------
      function reveal(i) {
        if (i >= players.length) return turnStart();
        const p = players[i];
        render(root,
          h('div', { class: 'center handoff' },
            h('div', { class: 'big' }, '🙈'),
            h('h2', {}, `${p.name}님은 눈을 감으세요`),
            h('p', { class: 'muted' }, '나머지 사람들이 확인할 차례입니다. 본인은 절대 보지 마세요!'),
            h('button', { class: 'primary', onClick: () => showCard(i) }, `${p.name} 빼고 모두 준비됨`),
          ),
        );
      }

      function showCard(i) {
        const p = players[i];
        const R = ROLES[p.role];
        render(root,
          h('p', { class: 'muted center' }, `${p.name}님의 정체 (본인은 보지 마세요)`),
          h('div', { class: 'card secret role-card' },
            h('div', { class: 'big' }, R.emoji),
            h('div', { class: 'role' }, R.name),
            DO.face(C, p.suspect, 72),
            h('div', { class: 'who' }, p.suspect.name),
            h('p', { class: 'muted' }, R.desc),
          ),
          h('div', { class: 'card' },
            h('p', { class: 'muted small-text' }, '이 사람의 프로필 (질문에 답할 때 참고)'),
            h('p', {}, p.suspect.profile),
          ),
          h('button', { class: 'primary', onClick: () => reveal(i + 1) },
            i + 1 < players.length ? '확인했음 → 다음 사람' : '확인했음 → 게임 시작'),
        );
      }

      // ---------- 3. 질문 턴 ----------
      function pending() { return players.filter(p => !p.solved); }

      function turnStart() {
        if (pending().length === 0) return finish();
        if (turn % players.length === 0) {
          round++;
          if (round > MAX_ROUNDS) return finish();
        }
        const p = players[turn % players.length];
        if (p.solved) { turn++; return turnStart(); }

        render(root,
          h('h2', {}, `라운드 ${round}/${MAX_ROUNDS} — ${p.name}님 차례`),
          scoreBoard(),
          h('div', { class: 'card' },
            h('p', {}, h('b', {}, p.name), '님, 예/아니오로 답할 수 있는 질문을 하나 하세요.'),
            h('p', { class: 'muted' }, '나머지 사람들은 이 사람의 정체를 기준으로 사실대로 답합니다.'),
            h('button', { class: 'primary', onClick: () => { p.questions++; turn++; turnStart(); } }, '🗣 말로 질문했음 (다음 사람)'),
          ),
          h('h3', {}, '또는 앱에게 조건 질문하기 (자동 답변)'),
          h('p', { class: 'muted small-text' }, '"내가 이런 사람인가?"를 앱이 사실대로 답합니다. 역할은 직접 묻지 못합니다.'),
          C.conditions.map(c => h('button', { onClick: () => autoAnswer(p, c) }, questionText(c))),
          h('button', { class: 'danger', onClick: () => guess(p) }, '🎯 내 정체 말하기'),
        );
      }

      // "~한 사람 접어" → "나는 ~한 사람인가?"
      function questionText(c) {
        return '나는 ' + c.text.replace(/\s*접어\s*$/, '') + '인가?';
      }

      function autoAnswer(p, cond) {
        p.questions++;
        const yes = p.suspect.traits.includes(cond.tag);
        render(root,
          h('h2', {}, questionText(cond)),
          h('div', { class: 'card ' + (yes ? 'good' : 'alert') + ' center' },
            h('div', { class: 'big' }, yes ? '⭕' : '❌'),
            h('p', {}, h('b', {}, yes ? '예, 그렇습니다.' : '아니요, 그렇지 않습니다.')),
          ),
          h('p', { class: 'muted' }, `${p.name} 질문 수: ${p.questions}`),
          h('button', { class: 'primary', onClick: () => { turn++; turnStart(); } }, '다음 사람'),
        );
        if (DO.sfx) DO.sfx(yes ? 'yes' : 'no');
      }

      // ---------- 정답 말하기 ----------
      function guess(p) {
        let role = null, sus = null;
        const mark = (btns, el) => btns.forEach(b => b.classList.toggle('primary', b === el));
        const roleBtns = Object.entries(ROLES).map(([id, R]) =>
          h('button', { onClick: e => { role = id; mark(roleBtns, e.currentTarget); } }, `${R.emoji} ${R.name}`));
        const susBtns = C.suspects.map(s =>
          h('button', { onClick: e => { sus = s; mark(susBtns, e.currentTarget); } }, s.name));
        render(root,
          h('h2', {}, `${p.name}님의 정답`),
          h('p', { class: 'muted' }, `역할과 용의자 신분 둘 다 맞아야 성공. 틀리면 질문 수 +${WRONG_PENALTY}.`),
          h('h3', {}, '내 역할은…'), roleBtns,
          h('h3', {}, '나는 이 용의자다…'), susBtns,
          h('button', { class: 'danger', onClick: () => {
            if (!role || !sus) return DO.toast('역할과 용의자를 모두 고르세요.');
            const ok = role === p.role && sus.id === p.suspect.id;
            if (ok) { p.solved = true; p.solvedAt = round; }
            else p.questions += WRONG_PENALTY;
            render(root,
              h('h2', {}, ok ? '🎉 정답!' : '❌ 틀렸습니다'),
              h('div', { class: 'card ' + (ok ? 'good' : 'alert') },
                ok
                  ? h('p', {}, h('b', {}, p.name), `님은 ${ROLES[p.role].name} · ${p.suspect.name} 입니다. 질문 ${p.questions}개로 맞혔습니다!`)
                  : h('p', {}, '역할 또는 용의자가 틀렸습니다. 어느 쪽이 틀렸는지는 비밀! 질문 수 +', WRONG_PENALTY, '.'),
              ),
              h('button', { class: 'primary', onClick: () => { turn++; turnStart(); } }, '다음 사람'),
            );
            if (DO.fx) ok ? DO.fx.good() : DO.fx.fail();
          } }, '정답 확정'),
          h('button', { onClick: turnStart }, '취소'),
        );
        DO.music && DO.music.hold('suspense');
      }

      // ---------- 4. 종료 ----------
      function finish() {
        const ranked = [...players].sort((a, b) => {
          if (a.solved !== b.solved) return a.solved ? -1 : 1;
          return a.questions - b.questions;
        });
        render(root,
          h('h2', {}, '게임 종료'),
          h('div', { class: 'card' },
            h('h3', {}, '🏆 순위 (질문 적은 순)'),
            h('ol', { class: 'rank' }, ranked.map(p =>
              h('li', {}, h('b', {}, p.name), ` — ${ROLES[p.role].emoji} ${ROLES[p.role].name} · ${p.suspect.name}`,
                h('div', { class: 'muted small-text' }, p.solved ? `질문 ${p.questions}개로 성공` : `실패 (질문 ${p.questions}개)`)))),
          ),
          h('p', {}, '이 사건의 범인: ', h('b', {}, C.suspects.find(s => s.id === C.culprit).name)),
          h('button', { class: 'primary', onClick: () => DO.goHome() }, '처음으로'),
        );
        if (DO.fx) DO.fx.ending(players.some(p => p.solved));
      }

      function scoreBoard() {
        return h('div', { class: 'card' },
          players.map(p => h('div', { class: 'player' + (p.solved ? ' out' : '') },
            h('span', {}, p.name),
            h('span', { class: 'muted' }, p.solved ? `✅ ${p.questions}개로 성공` : `질문 ${p.questions}개`),
          )),
        );
      }

      setup();
    },
  });
})();
