import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../src/tool/samples';
import { applyUpgrade, diagnose, emptyShop, nextRank, pickQuestions, rankOf, scoreOf, seededRng, shopLevel, shuffleOptions, upgradeChoices, wrongList } from './quiz';
import type { Answer, Question } from './types';

const cfg = sampleProject();
const qs = cfg.questions;

describe('抽题', () => {
  it('每局抽出指定数量，题号不重复', () => {
    const got = pickQuestions(qs, 10, seededRng(1));
    expect(got).toHaveLength(10);
    expect(new Set(got.map((q) => q.id)).size).toBe(10);
  });
  it('同样的随机种子抽出同样的题，不同种子顺序不同', () => {
    const a = pickQuestions(qs, 10, seededRng(7)).map((q) => q.id);
    expect(pickQuestions(qs, 10, seededRng(7)).map((q) => q.id)).toEqual(a);
    expect(pickQuestions(qs, 10, seededRng(8)).map((q) => q.id)).not.toEqual(a);
  });
  it('题库不够每局题数时，全部出完', () => {
    expect(pickQuestions(qs.slice(0, 4), 10, seededRng(1))).toHaveLength(4);
    expect(pickQuestions([], 10, seededRng(1))).toEqual([]);
  });
  it('优先抽没见过的题：见过 12 道时，10 道都来自剩下的 8 道加 2 道旧题', () => {
    const seen = qs.slice(0, 12).map((q) => q.id);
    const got = pickQuestions(qs, 10, seededRng(3), seen);
    expect(got.filter((q) => !seen.includes(q.id))).toHaveLength(8);
    expect(new Set(got.map((q) => q.id)).size).toBe(10);
  });
  it('没见过的够用时，一道旧题也不出', () => {
    const seen = qs.slice(0, 5).map((q) => q.id);
    expect(pickQuestions(qs, 10, seededRng(3), seen).every((q) => !seen.includes(q.id))).toBe(true);
  });
  it('打乱选项后，正确答案的序号跟着走', () => {
    for (let s = 1; s < 30; s++) {
      for (const q of qs) {
        const m = shuffleOptions(q, seededRng(s));
        expect(m.options[m.answer]).toBe(q.options[q.answer]);
        expect([...m.options].sort()).toEqual([...q.options].sort());
      }
    }
  });
});

describe('计分与段位', () => {
  it('得分按答对比例折成百分制并四舍五入', () => {
    expect(scoreOf(7, 10)).toBe(70);
    expect(scoreOf(1, 3)).toBe(33);
    expect(scoreOf(2, 3)).toBe(67);
    expect(scoreOf(0, 0)).toBe(0);
    expect(scoreOf(4, 4)).toBe(100);
  });
  it('段位按起始分数划分：39/40/59/60/79/80 的边界', () => {
    const name = (s: number) => rankOf(cfg.ranks, s).name;
    expect(name(0)).toBe('新手店员');
    expect(name(39)).toBe('新手店员');
    expect(name(40)).toBe('熟练店长');
    expect(name(59)).toBe('熟练店长');
    expect(name(60)).toBe('金牌掌柜');
    expect(name(79)).toBe('金牌掌柜');
    expect(name(80)).toBe('王牌老板');
    expect(name(100)).toBe('王牌老板');
  });
  it('段位列表顺序乱了也能评对；下一档提示', () => {
    const shuffled = [cfg.ranks[3], cfg.ranks[0], cfg.ranks[2], cfg.ranks[1]];
    expect(rankOf(shuffled, 65).name).toBe('金牌掌柜');
    expect(nextRank(shuffled, 65)?.name).toBe('王牌老板');
    expect(nextRank(shuffled, 90)).toBeNull();
  });
});

describe('维度升级', () => {
  const q = qs[0];
  it('三选一必含这道题的维度，且三个互不相同', () => {
    for (let s = 1; s < 40; s++) {
      const c = upgradeChoices(cfg.dims, q, emptyShop(cfg.dims), seededRng(s));
      expect(c).toHaveLength(3);
      expect(c.some((d) => d.id === q.dim)).toBe(true);
      expect(new Set(c.map((d) => d.id)).size).toBe(3);
    }
  });
  it('已满级的维度不再出现在选项里', () => {
    let shop = emptyShop(cfg.dims);
    for (let i = 0; i < 12; i++) shop = applyUpgrade(shop, q.dim);
    expect(shop[q.dim]).toBe(10);
    const c = upgradeChoices(cfg.dims, q, shop, seededRng(2));
    expect(c.some((d) => d.id === q.dim)).toBe(false);
    expect(c).toHaveLength(3);
  });
  it('全部满级时没有可选项', () => {
    const full = Object.fromEntries(cfg.dims.map((d) => [d.id, 10]));
    expect(upgradeChoices(cfg.dims, q, full, seededRng(1))).toEqual([]);
  });
  it('升级只加 1 级且不改原对象；未知维度忽略', () => {
    const shop = emptyShop(cfg.dims);
    const next = applyUpgrade(shop, 'd2');
    expect(next.d2).toBe(1);
    expect(shop.d2).toBe(0);
    expect(shopLevel(next)).toBe(1);
    expect(applyUpgrade(shop, 'nope')).toBe(shop);
  });
});

describe('经营诊断与错题', () => {
  const picked: Question[] = [qs[0], qs[1], qs[4], qs[5], qs[8]]; // 门头 2、菜单 2、出品 1
  const ans = (flags: boolean[]): Answer[] => picked.map((q, i) => ({ qid: q.id, picked: flags[i] ? q.answer : (q.answer + 1) % q.options.length, correct: flags[i] }));
  it('按维度统计正确率，没抽到题的维度不列入', () => {
    const d = diagnose(cfg.dims, picked, ans([true, true, false, false, true]));
    expect(d.items.map((i) => [i.dim.id, i.correct, i.total, i.level])).toEqual([['d1', 2, 2, 'strong'], ['d2', 0, 2, 'weak'], ['d3', 1, 1, 'strong']]);
    expect(d.weakest?.dim.id).toBe('d2');
    expect(d.summary).toContain('菜单产品');
    expect(d.summary).toContain(cfg.dims[1].advice);
  });
  it('正确率 50% 为「还可以」，80% 以上为「掌握得好」', () => {
    const d = diagnose(cfg.dims, picked, ans([true, false, true, true, true]));
    expect(d.items[0].level).toBe('ok');
    expect(d.items[1].level).toBe('strong');
  });
  it('全对时提示全部答对；全错时指出要补的维度', () => {
    expect(diagnose(cfg.dims, picked, ans([true, true, true, true, true])).summary).toContain('全部答对');
    expect(diagnose(cfg.dims, picked, ans([false, false, false, false, false])).summary).toContain('没有答对');
  });
  it('没有答题记录时不报错', () => {
    expect(diagnose(cfg.dims, [], []).items).toEqual([]);
  });
  it('错题列表按答题顺序，带上选错的选项', () => {
    const w = wrongList(picked, ans([true, false, true, false, true]));
    expect(w.map((x) => x.question.id)).toEqual([picked[1].id, picked[3].id]);
    expect(w[0].picked).toBe((picked[1].answer + 1) % picked[1].options.length);
  });
});
