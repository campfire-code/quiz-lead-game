// H5 主流程：首页 → 答题（答对三选一升级）→ 结果（段位、诊断、错题、本机排行榜、海报）→ 领奖页。
import { addRecord } from './core/board';
import { mix, readableOn } from './core/check';
import {
  applyUpgrade, diagnose, emptyShop, letter, LEVEL_TEXT, nextRank, pickQuestions, rankOf, scoreOf, shopLevel, shuffleOptions, upgradeChoices, wrongList,
  type Rng,
} from './core/quiz';
import type { Answer, Dimension, Question, QuizConfig, Shop } from './core/types';
import { drawPoster } from './poster';
import { dimBars, shopSvg } from './shop';
import type { Sound } from './sound';
import type { Store } from './storage';
import { esc, multiline, safeSrc } from './ui';

interface Game {
  qs: Question[];
  idx: number;
  answers: Answer[];
  shop: Shop;
}

type Step =
  | { kind: 'ask' }
  | { kind: 'right'; picked: number; choices: Dimension[] }
  | { kind: 'upgraded'; picked: number; dim: Dimension }
  | { kind: 'wrong'; picked: number };

export interface Deps {
  cfg: QuizConfig;
  root: HTMLElement;
  store: Store;
  sound: Sound;
  rng: Rng;
  link: () => string;
}

export function startApp(d: Deps) {
  const { cfg, root, store, sound, rng } = d;
  const b = cfg.brand;
  let game: Game | null = null;
  let step: Step = { kind: 'ask' };
  let view: 'home' | 'play' | 'result' | 'reward' | 'board' = 'home';
  let posterUrl = '';
  let posterBusy = false;
  let toast = '';
  let toastTimer = 0;

  document.title = b.name;
  const st = document.documentElement.style;
  st.setProperty('--brand', b.color);
  st.setProperty('--on-brand', readableOn(b.color));
  st.setProperty('--brand-dark', mix(b.color, -0.25));
  st.setProperty('--brand-soft', mix(b.color, 0.88));

  const total = () => game?.qs.length ?? 0;
  const correctCount = () => game?.answers.filter((a) => a.correct).length ?? 0;
  const logo = (cls: string) => (safeSrc(b.logo) ? `<img class="${cls}" src="${esc(safeSrc(b.logo))}" alt="">` : '');
  const muteBtn = () => `<button class="icon-btn" data-act="mute" aria-label="${store.muted() ? '打开音效' : '关闭音效'}">${store.muted() ? '🔇' : '🔊'}</button>`;

  function say(text: string) {
    toast = text;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast = '';
      root.querySelector('.toast')?.remove();
    }, 1800);
    root.querySelector('.toast')?.remove();
    root.insertAdjacentHTML('beforeend', `<div class="toast">${esc(text)}</div>`);
  }

  function persist() {
    if (game && game.idx < game.qs.length) store.saveGame(game);
  }

  function begin() {
    const picked = pickQuestions(cfg.questions, cfg.questionCount, rng, store.seen());
    store.saveSeen([...store.seen().filter((id) => !picked.some((q) => q.id === id)), ...picked.map((q) => q.id)]);
    game = { qs: picked.map((q) => shuffleOptions(q, rng)), idx: 0, answers: [], shop: emptyShop(cfg.dims) };
    step = { kind: 'ask' };
    persist();
    go('play');
  }

  function resume() {
    const g = store.game();
    if (!g) return begin();
    game = g;
    step = { kind: 'ask' };
    go('play');
  }

  function go(v: typeof view) {
    view = v;
    posterUrl = '';
    render();
    window.scrollTo(0, 0);
  }

  function answer(i: number) {
    if (!game || step.kind !== 'ask') return;
    const q = game.qs[game.idx];
    const ok = i === q.answer;
    game.answers.push({ qid: q.id, picked: i, correct: ok });
    if (ok) {
      sound.correct();
      step = { kind: 'right', picked: i, choices: upgradeChoices(cfg.dims, q, game.shop, rng) };
    } else {
      sound.wrong();
      step = { kind: 'wrong', picked: i };
    }
    persist();
    render();
  }

  function upgrade(dimId: string) {
    if (!game || step.kind !== 'right') return;
    const dim = cfg.dims.find((x) => x.id === dimId);
    if (!dim) return;
    game.shop = applyUpgrade(game.shop, dimId);
    sound.upgrade();
    step = { kind: 'upgraded', picked: step.picked, dim };
    persist();
    render();
  }

  function next() {
    if (!game) return;
    game.idx++;
    step = { kind: 'ask' };
    if (game.idx >= game.qs.length) return finish();
    persist();
    render();
    window.scrollTo(0, 0);
  }

  function finish() {
    if (!game) return;
    const score = scoreOf(correctCount(), total());
    store.clearGame();
    if (score > store.best()) store.saveBest(score);
    const rank = rankOf(cfg.ranks, score);
    const sorted = cfg.ranks.slice().sort((x, y) => x.min - y.min);
    sound.finish(sorted.indexOf(rank) >= Math.ceil(sorted.length / 2));
    const name = store.name();
    if (name) store.saveBoard(addRecord(store.board(), { name, score, correct: correctCount(), total: total(), rank: rank.name, at: Date.now() }));
    go('result');
  }

  // ---------- 视图 ----------

  function home(): string {
    const saved = store.game();
    const best = store.best();
    return `<main class="page home">
<div class="top-row"><span></span>${muteBtn()}</div>
<header class="hero">${logo('hero-logo')}<h1>${esc(b.name)}</h1><p>${esc(b.tagline)}</p></header>
<div class="card">${shopSvg(b.name, b.color, emptyShop(cfg.dims))}
<ul class="rules"><li>每局随机 <b>${Math.min(cfg.questionCount, cfg.questions.length)}</b> 道单选题</li><li>答对一题，三选一升级店铺的一项能力</li><li>答完看段位、经营诊断和错题解析</li></ul></div>
${best ? `<p class="muted center">我的最高分：<b>${best}</b> 分</p>` : ''}
<div class="dock">${saved ? `<button class="btn ghost" data-act="resume">继续上次答题（第 ${saved.idx + 1} 题）</button>` : ''}<button class="btn" data-act="start">${saved ? '重新开始' : '开始挑战'}</button><button class="link" data-act="board">本机排行榜</button></div>
</main>`;
  }

  function play(): string {
    const g = game!;
    const q = g.qs[g.idx];
    const done = step.kind === 'ask' ? g.idx : g.idx + 1;
    const picked = step.kind === 'ask' ? -1 : step.picked;
    const opts = q.options
      .map((o, i) => {
        const cls = step.kind === 'ask' ? '' : i === q.answer ? ' right' : i === picked ? ' wrong' : ' dim';
        return `<button class="opt${cls}" data-act="pick" data-i="${i}" ${step.kind === 'ask' ? '' : 'disabled'}><span class="ltr">${letter(i)}</span><span class="otext">${esc(o)}</span></button>`;
      })
      .join('');
    return `<main class="page play">
<div class="top-row"><span class="muted-on">第 ${g.idx + 1} / ${g.qs.length} 题</span><span class="muted-on">答对 ${correctCount()} 题</span>${muteBtn()}</div>
<div class="progress"><i style="width:${(done / g.qs.length) * 100}%"></i></div>
<div class="mini-shop">${shopSvg(b.name, b.color, g.shop, true)}<span class="lv">店铺 ${shopLevel(g.shop)} 级</span></div>
<section class="card q ${step.kind === 'wrong' ? 'shake' : ''}"><div class="dimtag">${esc(cfg.dims.find((x) => x.id === q.dim)?.name ?? '')}</div><h2>${esc(q.title)}</h2><div class="opts">${opts}</div></section>
${sheet(q)}
</main>`;
  }

  function sheet(q: Question): string {
    if (step.kind === 'ask') return '';
    const explain = q.explain.trim() ? `<p class="explain"><b>解析：</b>${multiline(q.explain)}</p>` : '';
    const last = game!.idx + 1 >= game!.qs.length;
    const nextBtn = `<button class="btn" data-act="next">${last ? '查看成绩' : '下一题'}</button>`;
    if (step.kind === 'wrong') {
      return `<section class="sheet bad"><h3>答错了</h3><p>正确答案是 <b>${letter(q.answer)}. ${esc(q.options[q.answer])}</b></p>${explain}${nextBtn}</section>`;
    }
    if (step.kind === 'upgraded') {
      return `<section class="sheet good"><h3>${esc(step.dim.emoji)} ${esc(step.dim.name)} +1</h3><p>${esc(step.dim.desc)}</p>${explain}${nextBtn}</section>`;
    }
    const cards = step.choices
      .map((c) => `<button class="up" data-act="up" data-id="${esc(c.id)}"><span class="e">${esc(c.emoji)}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`)
      .join('');
    if (!cards) return `<section class="sheet good"><h3>答对了</h3><p>店铺的所有能力都已满级。</p>${explain}${nextBtn}</section>`;
    return `<section class="sheet good"><h3>答对了，选一项能力升级</h3>${explain}<div class="ups">${cards}</div></section>`;
  }

  function result(): string {
    const g = game!;
    const score = scoreOf(correctCount(), total());
    const rank = rankOf(cfg.ranks, score);
    const nr = nextRank(cfg.ranks, score);
    let need = 0;
    if (nr) while (scoreOf(correctCount() + need, total()) < nr.min && correctCount() + need < total()) need++;
    const dg = diagnose(cfg.dims, g.qs, g.answers);
    const wrongs = wrongList(g.qs, g.answers);
    const saved = store.name();
    const board = store.board();
    return `<main class="page result">
<div class="head-score"><span class="chip">挑战完成</span><div class="big">${score}</div><p>满分 100 · 答对 ${correctCount()} / ${total()} 题</p></div>
<section class="card center"><div class="rank-emoji">${esc(rank.emoji)}</div><h2>${esc(rank.name)}</h2><p>${multiline(rank.desc)}</p>${nr ? `<p class="muted">再答对 ${need} 题，可达到「${esc(nr.name)}」</p>` : '<p class="muted">已是最高段位</p>'}</section>
<section class="card"><h3>我的店铺 · ${shopLevel(g.shop)} 级</h3>${shopSvg(b.name, b.color, g.shop)}${dimBars(cfg.dims, g.shop, b.color)}</section>
<section class="card"><h3>经营诊断</h3><p class="sum">${esc(dg.summary)}</p>${dg.items
      .map(
        (r) => `<div class="diag ${r.level}"><div class="row"><b>${esc(r.dim.emoji)} ${esc(r.dim.name)}</b><span class="tag">${LEVEL_TEXT[r.level]} · ${r.correct}/${r.total}</span></div><span class="track"><i style="width:${r.rate * 100}%"></i></span>${r.level === 'weak' ? `<p class="adv">${esc(r.dim.advice)}</p>` : ''}</div>`,
      )
      .join('')}</section>
<section class="card"><h3>错题解析${wrongs.length ? `（${wrongs.length} 题）` : ''}</h3>${
      wrongs.length
        ? wrongs
            .map(
              (w, i) => `<details class="wq" ${i === 0 ? 'open' : ''}><summary>${esc(w.question.title)}</summary><p class="mine">你选的：${letter(w.picked)}. ${esc(w.question.options[w.picked])}</p><p class="ans">正确答案：${letter(w.question.answer)}. ${esc(w.question.options[w.question.answer])}</p>${w.question.explain.trim() ? `<p class="explain">${multiline(w.question.explain)}</p>` : ''}</details>`,
            )
            .join('')
        : '<p class="muted">这一局没有答错的题，太棒了。</p>'
    }</section>
<section class="card"><h3>本机排行榜</h3><form class="name-row" data-form="name"><input name="nick" maxlength="12" placeholder="留个昵称上榜" value="${esc(saved)}" autocomplete="off"><button class="btn small" type="submit">${saved ? '更新' : '上榜'}</button></form><p class="muted tiny">只记录在这台手机的浏览器里，不会上传。</p>${boardHtml(board)}</section>
<div class="dock sticky"><button class="btn" data-act="reward">${esc(b.ctaTitle || '领取福利')}</button><div class="two"><button class="btn ghost" data-act="poster">生成分享海报</button><button class="btn ghost" data-act="start">再来一局</button></div></div>
${posterUrl || posterBusy ? posterModal() : ''}
</main>`;
  }

  function boardHtml(list = store.board()): string {
    if (!list.length) return '<p class="muted center">还没有记录，答完题留个昵称就能上榜。</p>';
    return `<ol class="board">${list
      .map((r, i) => `<li><span class="no n${i + 1}">${i + 1}</span><span class="nm">${esc(r.name)}</span><span class="rk">${esc(r.rank)}</span><b>${r.score}</b></li>`)
      .join('')}</ol>`;
  }

  function posterModal(): string {
    return `<div class="modal" data-act="closePoster"><div class="mbox">${
      posterUrl
        ? `<img class="poster" src="${posterUrl}" alt="分享海报"><p class="muted center">长按图片保存，发给朋友或发朋友圈</p><div class="two"><a class="btn ghost" href="${posterUrl}" download="海报.png">保存图片</a><button class="btn" data-act="closePoster">关闭</button></div>`
        : '<p class="center">正在生成海报…</p>'
    }</div></div>`;
  }

  function reward(): string {
    const qr = safeSrc(b.qr);
    return `<main class="page reward">
<header class="hero small">${logo('hero-logo')}<h1>${esc(b.ctaTitle || '领取福利')}</h1></header>
<section class="card center">${b.ctaText.trim() ? `<p class="cta">${multiline(b.ctaText)}</p>` : ''}${qr ? `<img class="qr" src="${esc(qr)}" alt="二维码"><p class="muted">${esc(b.qrHint)}</p>` : '<p class="muted">请按上面的说明联系我们。</p>'}</section>
<div class="dock"><button class="btn ghost" data-act="back">返回成绩</button><button class="btn" data-act="start">再来一局</button></div>
</main>`;
  }

  function boardPage(): string {
    return `<main class="page"><header class="hero small"><h1>本机排行榜</h1></header><section class="card">${boardHtml()}<p class="muted tiny">只记录在这台手机的浏览器里，不会上传。</p></section><div class="dock"><button class="btn" data-act="home">返回首页</button></div></main>`;
  }

  function render() {
    let html: string;
    if (view === 'board') html = boardPage();
    else if (!game || view === 'home') html = home();
    else if (view === 'play') html = play();
    else if (view === 'result') html = result();
    else html = reward();
    root.innerHTML = html;
    if (view === 'play' && step.kind !== 'ask') {
      // 答完后把解析和升级项滚到可见位置，手机屏幕放不下整页
      const sheetEl = root.querySelector('.sheet');
      if (sheetEl) window.requestAnimationFrame(() => sheetEl.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
    if (toast) root.insertAdjacentHTML('beforeend', `<div class="toast">${esc(toast)}</div>`);
  }

  // ---------- 事件 ----------

  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el) return;
    if ((e.target as HTMLElement).closest('.mbox') && el.dataset.act === 'closePoster' && el.classList.contains('modal')) return;
    const act = el.dataset.act;
    if (act !== 'mute' && act !== 'pick') sound.tap();
    switch (act) {
      case 'start': return begin();
      case 'resume': return resume();
      case 'pick': return answer(Number(el.dataset.i));
      case 'up': return upgrade(el.dataset.id ?? '');
      case 'next': return next();
      case 'reward': return go('reward');
      case 'back': return go('result');
      case 'home': return go('home');
      case 'board': return go('board');
      case 'mute': {
        store.saveMuted(!store.muted());
        render();
        return;
      }
      case 'closePoster': {
        posterUrl = '';
        posterBusy = false;
        render();
        return;
      }
      case 'poster': {
        if (!game || posterBusy) return;
        posterBusy = true;
        render();
        const score = scoreOf(correctCount(), total());
        drawPoster({ cfg, score, correct: correctCount(), total: total(), rank: rankOf(cfg.ranks, score), shop: game.shop, link: d.link() })
          .then((url) => { posterUrl = url; })
          .catch(() => { posterUrl = ''; say('海报生成失败，请重试'); })
          .finally(() => { posterBusy = false; render(); });
      }
    }
  });

  root.addEventListener('submit', (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('[data-form="name"]');
    if (!form || !game) return;
    e.preventDefault();
    const name = String(new FormData(form).get('nick') ?? '').trim().slice(0, 12);
    if (!name) return say('先写一个昵称');
    store.saveName(name);
    const score = scoreOf(correctCount(), total());
    store.saveBoard(addRecord(store.board(), { name, score, correct: correctCount(), total: total(), rank: rankOf(cfg.ranks, score).name, at: Date.now() }));
    render();
    say('已记录到本机排行榜');
  });

  render();
  return { begin };
}
