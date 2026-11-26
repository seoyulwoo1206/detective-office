// 용의자 접기 — 여러 폰 모드 (js/room.js 위에서 돈다)
//
// 폰 하나로 할 때(fold.js)와 규칙은 같고, 다른 점은:
//  - 비밀 프로필은 각자 자기 폰에서 본다(폰 넘기기 없음).
//  - 접기 선언은 각자 몰래 고르고, 모두 고르면 한꺼번에 공개된다(눈치 보기 없음).
//  - 범인 지목은 아무나 자기 폰에서. "다음" 버튼도 아무나 누르면 모두 함께 넘어간다.
// 상태 game = { phase, p: [{ id, sid, f(손가락), out, d: {태그: 접었나} }], conds(남은 조건 번호), used, clues(남은 단서 번호), shown,
//              round, turn, speaker, cur(지금 조건 번호), folds, busted, acc, winner }

(() => {
  if (!DO.room) return;
  const { h, render, shuffle, tagText } = DO;
  const alive = g => g.p.filter(x => !x.out);
  const sus = (C, x) => C.suspects.find(s => s.id === x.sid);
  const clone = o => JSON.parse(JSON.stringify(o));
  let showSecret = false;   // 내 비밀 프로필 펼침 (단계가 바뀌어도 유지)

  function hit(x, n) { x.f -= n; if (x.f <= 0) { x.f = 0; x.out = true; } }
  function finish(g, winner) { g.phase = 'end'; g.winner = winner || null; return g; }
  // 조건 고르기로 (지목 뒤에는 라운드를 올리지 않는다)
  function toPick(g) {
    if (!g.conds.length || alive(g).length <= 1) return finish(g, null);
    const al = alive(g);
    g.phase = 'pick'; g.speaker = al[g.turn % al.length].id; g.acc = null;
    return g;
  }
  function roundStart(g) {
    if (!g.conds.length || alive(g).length <= 1) return finish(g, null);
    g.round++;
    return toPick(g);
  }
  function revealClue(C, g) {
    const idx = g.clues.shift();
    g.shown.push(idx);
    const clue = C.clues[idx];
    g.busted = [];
    if (clue.exposes) {
      for (const x of alive(g)) {
        const has = sus(C, x).traits.includes(clue.exposes);
        const said = x.d[clue.exposes];
        if (said !== undefined && said !== has) { hit(x, 2); g.busted.push(x.id); }
      }
    }
    g.phase = 'clue';
    return g;
  }

  DO.room.register('fold', {
    min: 2,
    max: C => C.suspects.length,
    init(C, players, rand) {
      const culprit = C.suspects.find(s => s.id === C.culprit);
      const others = shuffle(C.suspects.filter(s => s.id !== C.culprit), rand).slice(0, players.length - 1);
      const sus = shuffle([culprit, ...others], rand);
      return {
        phase: 'reveal',
        p: players.map((pl, i) => ({ id: pl.id, sid: sus[i].id, f: 5, out: false, d: {} })),
        conds: shuffle(C.conditions.map((_, i) => i), rand), used: [],
        clues: C.clues.map((_, i) => i), shown: [],
        round: 0, turn: 0, speaker: null, cur: null, folds: null, busted: null, acc: null, winner: null,
      };
    },

    reduce(C, g0, inputs) {
      const g = clone(g0);
      const any = k => Object.values(inputs).some(a => a && a[k]);
      switch (g.phase) {
        case 'reveal':
          return g.p.every(x => inputs[x.id] && inputs[x.id].ok) ? roundStart(g) : null;
        case 'pick': {
          // 지목이 먼저
          for (const x of alive(g)) {
            const a = inputs[x.id];
            const target = a && a.accuse && g.p.find(t => t.id === a.accuse && t.id !== x.id);
            if (!target) continue;
            const ok = target.sid === C.culprit;
            g.acc = { who: x.id, target: target.id, ok };
            if (ok) return finish(g, x.id);
            hit(x, 1);
            g.phase = 'accused';
            return g;
          }
          const a = inputs[g.speaker];
          if (a && Number.isInteger(a.pick) && g.conds.includes(a.pick)) {
            g.conds = g.conds.filter(i => i !== a.pick);
            g.used.push(a.pick);
            g.cur = a.pick; g.folds = null;
            g.phase = 'declare';
            return g;
          }
          return null;
        }
        case 'declare': {
          const al = alive(g);
          if (!al.every(x => inputs[x.id] && typeof inputs[x.id].fold === 'boolean')) return null;
          const tag = C.conditions[g.cur].tag;
          g.folds = {};
          for (const x of al) {
            const f = inputs[x.id].fold;
            x.d[tag] = f; g.folds[x.id] = f;
            if (f) hit(x, 1);
          }
          g.turn++;
          g.phase = 'folded';
          return g;
        }
        case 'folded':
          if (!any('next')) return null;
          return g.round % 2 === 0 && g.clues.length ? revealClue(C, g) : roundStart(g);
        case 'clue':
          return any('next') ? roundStart(g) : null;
        case 'accused':
          return any('next') ? toPick(g) : null;
        default:
          return null;
      }
    },

    view(root, ctx) {
      const { C, game: g, players, me } = ctx;
      const nameOf = id => (players.find(p => p.id === id) || {}).name || '?';
      const mine = g.p.find(x => x.id === me);
      const myS = mine && sus(C, mine);
      const amAlive = !!(mine && !mine.out);
      const myAct = ctx.act(me) || {};

      const secretCard = () => myS ? h('div', { class: 'card secret' },
        h('div', { class: 'profile-head' }, DO.face(C, myS, 64), h('h2', {}, myS.name)),
        h('p', {}, myS.profile),
        myS.lies.length
          ? h('p', { class: 'muted' }, '🤫 당신이 범인! 거짓말해도 되는 조건: ' + myS.lies.map(t => tagText(C, t)).join(' / '))
          : h('p', { class: 'muted' }, '당신은 범인이 아닙니다. 모든 조건에 솔직하게 답하세요.'),
      ) : null;
      const secretToggle = () => myS ? [
        h('button', { class: 'small', onClick: () => { showSecret = !showSecret; ctx.redraw(); } }, showSecret ? '🙈 내 비밀 프로필 숨기기' : '🔒 내 비밀 프로필 보기'),
        showSecret ? secretCard() : null,
      ] : null;
      const board = (mark) => h('div', { class: 'card' },
        g.p.map(x => h('div', { class: 'player' + (x.out ? ' out' : '') },
          h('span', {}, mark ? mark(x) : null, h('b', {}, nameOf(x.id)), x.id === me ? h('span', { class: 'muted' }, ' (나)') : null,
            h('span', { class: 'muted' }, ` · ${sus(C, x).name}`)),
          h('span', { class: 'fingers' }, '✋'.repeat(Math.max(0, x.f)) || '💀'))),
        g.shown.length ? h('p', { class: 'muted' }, '공개된 단서: ' + g.shown.map(i => C.clues[i].text).join(' · ')) : null,
        g.clues.length ? h('p', { class: 'muted small-text' }, `남은 단서 ${g.clues.length}장 · 2라운드마다 1장 공개`) : null,
      );
      const nextBtn = label => ctx.done(me)
        ? h('p', { class: 'center muted' }, '⏳ 넘어가는 중…')
        : h('button', { class: 'primary', onClick: () => ctx.send({ next: true }) }, label);

      switch (g.phase) {
        case 'reveal': {
          const n = g.p.filter(x => ctx.done(x.id)).length;
          render(root,
            h('h2', {}, '🔒 내 비밀 프로필'),
            h('p', { class: 'muted' }, '다른 사람이 내 화면을 못 보게 하고 확인하세요. 게임 중에도 다시 볼 수 있어요.'),
            secretCard(),
            ctx.done(me)
              ? h('div', { class: 'card' }, h('p', {}, `⏳ 다른 사람 기다리는 중 (${n}/${g.p.length})`),
                  h('p', { class: 'muted small-text' }, g.p.filter(x => !ctx.done(x.id)).map(x => nameOf(x.id)).join(', ') + ' 확인 중'))
              : h('button', { class: 'primary', onClick: () => ctx.send({ ok: true }) }, '확인했어요'),
          );
          if (ctx.fresh && DO.sfx) DO.sfx('sheet');
          if (ctx.fresh) showSecret = false;
          return;
        }

        case 'pick': {
          if (ctx.fresh && DO.music) DO.music.intensity(g.conds.length <= 2 ? 2 : alive(g).some(q => q.f <= 2) ? 1 : 0);
          if (ctx.local.accuse && amAlive) {
            const sent = !!myAct.accuse;
            render(root,
              h('h2', {}, '🔎 범인 지목'),
              h('p', { class: 'muted' }, '맞히면 내가 승리! 틀리면 손가락 -1.'),
              g.p.filter(x => x.id !== me).map(x => h('button', {
                class: ctx.local.target === x.id ? 'primary' : '',
                onClick: () => { ctx.local.target = x.id; ctx.redraw(); },
              }, DO.face(C, sus(C, x), 32), ` ${nameOf(x.id)} (${sus(C, x).name})`)),
              sent ? h('p', { class: 'center muted' }, '⏳ 지목을 보냈어요…')
                : h('button', { class: 'danger', onClick: () => {
                    if (!ctx.local.target) return DO.toast('지목할 사람을 고르세요.');
                    ctx.send({ accuse: ctx.local.target });
                  } }, '지목 확정'),
              sent ? null : h('button', { onClick: () => { ctx.local.accuse = false; ctx.local.target = null; ctx.redraw(); } }, '취소'),
            );
            if (DO.music) DO.music.hold('suspense');
            return;
          }
          const mySpeak = g.speaker === me;
          render(root,
            h('h2', {}, `라운드 ${g.round}`),
            board(x => x.id === g.speaker ? '🎤 ' : null),
            mySpeak
              ? [h('p', {}, h('b', {}, '내 차례!'), ' 조건을 하나 고르세요.'),
                 myAct.pick !== undefined ? h('p', { class: 'center muted' }, '⏳ 보내는 중…')
                   : g.conds.map(i => h('button', { onClick: () => ctx.send({ pick: i }) }, C.conditions[i].text))]
              : h('div', { class: 'card center' }, h('p', {}, '🎤 ', h('b', {}, nameOf(g.speaker)), '님이 조건을 고르는 중…')),
            amAlive ? h('button', { class: 'danger', onClick: () => { ctx.local.accuse = true; ctx.redraw(); } }, '🔎 범인 지목하기') : h('p', { class: 'muted center' }, '💀 손가락을 다 접었어요. 구경하며 추리해 보세요.'),
            secretToggle(),
          );
          if (ctx.fresh && mySpeak && DO.sfx) DO.sfx('pop');
          return;
        }

        case 'declare': {
          const cond = C.conditions[g.cur];
          const al = alive(g);
          const n = al.filter(x => ctx.done(x.id)).length;
          const choice = typeof myAct.fold === 'boolean' ? myAct.fold : null;
          render(root,
            h('p', { class: 'muted small-text' }, `라운드 ${g.round} · ${nameOf(g.speaker)}님이 고른 조건`),
            h('h2', {}, cond.text),
            amAlive ? [
              h('p', { class: 'muted' }, '해당하면 접으세요. 범인은 거짓말해도 됩니다(단서로 들키면 -2). 모두 고르면 한꺼번에 공개돼요.'),
              myS && myS.lies.includes(cond.tag) ? h('p', { class: 'card secret-hint' }, '🤫 이 조건은 거짓말해도 되는 조건이에요.') : null,
              h('div', { class: 'row fold-pick' },
                h('button', { class: 'grow' + (choice === true ? ' primary' : ''), 'data-quiet': '1', onClick: () => { DO.sfx && DO.sfx('fold'); ctx.send({ fold: true }); } }, '✋ 접는다'),
                h('button', { class: 'grow' + (choice === false ? ' primary' : ''), 'data-quiet': '1', onClick: () => { DO.sfx && DO.sfx('unfold'); ctx.send({ fold: false }); } }, '🖐 안 접는다')),
              choice !== null ? h('p', { class: 'muted small-text center' }, '모두 고르기 전까지는 바꿀 수 있어요.') : null,
            ] : h('p', { class: 'muted' }, '💀 이번 라운드는 구경만 해요.'),
            h('div', { class: 'card' },
              h('p', {}, `고른 사람 ${n}/${al.length}`),
              al.map(x => h('span', { class: 'badge' }, (ctx.done(x.id) ? '✅ ' : '⏳ ') + nameOf(x.id)))),
            secretToggle(),
          );
          return;
        }

        case 'folded': {
          const cond = C.conditions[g.cur];
          const ids = Object.keys(g.folds || {});
          const clueNext = g.round % 2 === 0 && g.clues.length;
          render(root,
            h('p', { class: 'muted small-text' }, `라운드 ${g.round} 결과`),
            h('h2', {}, cond.text),
            h('div', { class: 'card fold-result' }, ids.map(id => h('div', { class: 'player' },
              h('b', {}, nameOf(id)), h('span', {}, g.folds[id] ? '✋ 접음' : '🖐 안 접음')))),
            board(),
            nextBtn(clueNext ? '🗂 단서 공개' : '다음 라운드'),
          );
          if (ctx.fresh && DO.sfx) DO.sfx('reveal');
          return;
        }

        case 'clue': {
          const clue = C.clues[g.shown[g.shown.length - 1]];
          const judged = clue.exposes && g.used.some(i => C.conditions[i].tag === clue.exposes);
          render(root,
            h('h2', {}, '🗂 단서 공개'),
            h('div', { class: 'card' }, h('p', {}, clue.text)),
            clue.exposes ? h('p', { class: 'muted' }, '관련 조건: ' + tagText(C, clue.exposes)) : null,
            g.busted.length
              ? h('div', { class: 'card alert' }, h('p', {}, '거짓말 들통: ', h('b', {}, g.busted.map(nameOf).join(', ')), ' (손가락 -2)'))
              : h('p', { class: 'muted' }, clue.exposes && !judged
                ? '관련 조건이 아직 나오지 않아 이번엔 판정할 수 없습니다. 기억해 두세요!'
                : '이번 단서로 들통난 사람은 없습니다.'),
            board(),
            nextBtn('다음 라운드'),
          );
          if (ctx.fresh) { if (g.busted.length && DO.fx) DO.fx.fail(null, 'busted'); else if (DO.sfx) DO.sfx('reveal'); }
          return;
        }

        case 'accused': {
          const t = g.p.find(x => x.id === g.acc.target);
          render(root,
            h('h2', {}, '❌ 틀렸습니다'),
            h('div', { class: 'card alert' },
              h('p', {}, h('b', {}, nameOf(g.acc.who)), '님의 지목: ', h('b', {}, DO.josa(`${nameOf(t.id)}(${sus(C, t).name})`, '은/는')), ' 범인이 아닙니다.'),
              h('p', {}, h('b', {}, nameOf(g.acc.who)), ' 손가락 -1')),
            board(),
            nextBtn('계속'),
          );
          if (ctx.fresh && DO.fx) DO.fx.fail();
          return;
        }

        case 'end': {
          const culprit = g.p.find(x => x.sid === C.culprit);
          const al = alive(g);
          let msg;
          if (g.winner) msg = `🎉 ${nameOf(g.winner)} 승리! 범인을 맞혔습니다.`;
          else if (al.length === 1) msg = `${nameOf(al[0].id)} 생존 승리!` + (al[0] === culprit ? ' (범인이 끝까지 살아남았습니다…)' : '');
          else msg = '조건이 모두 소진되었습니다. 범인 도주 성공!';
          const unshown = C.clues.filter((_, i) => !g.shown.includes(i));
          render(root,
            h('h2', {}, '게임 종료'),
            h('div', { class: 'card' }, h('p', {}, h('b', {}, msg))),
            h('p', {}, '범인: ', h('b', {}, `${nameOf(culprit.id)} (${sus(C, culprit).name})`)),
            unshown.length ? h('p', { class: 'muted' }, '공개되지 않은 단서: ' + unshown.map(c => c.text).join(' · ')) : null,
            h('h2', {}, '전원 프로필'),
            g.p.map(x => h('div', { class: 'card explain' + (x === culprit ? ' alert' : '') },
              DO.face(C, sus(C, x), 44),
              h('div', { class: 'grow' }, h('b', {}, `${nameOf(x.id)} — ${sus(C, x).name}`), h('p', { class: 'muted' }, sus(C, x).profile)))),
            ctx.isHost
              ? h('button', { class: 'primary', onClick: () => ctx.restart() }, '🔁 같은 사람들과 한 판 더')
              : h('p', { class: 'center muted' }, '방장이 "한 판 더"를 누르면 바로 이어져요.'),
            h('button', { onClick: () => { if (confirm('방에서 나갈까요?')) ctx.leave(); } }, '방에서 나가기'),
          );
          if (ctx.fresh && DO.fx) DO.fx.ending(!!g.winner || (al.length === 1 && al[0] !== culprit));
          return;
        }
      }
    },
  });
})();
