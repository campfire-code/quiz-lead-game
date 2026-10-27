// 答题核心：抽题、计分、评段位、维度升级、诊断、错题。全部是纯函数，随机数由调用方传入，方便测试。
import type { Answer, Dimension, Question, RankLevel, Shop } from './types';
import { MAX_DIM_LEVEL } from './types';

export type Rng = () => number;

/** 可复现的随机数（mulberry32），测试用；正式运行用 Math.random */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 每局随机抽 count 题。优先抽没见过的题（seen 是以前抽过的题号）；没见过的不够时，
 * 先全部取用，再从见过的里补齐，这样题库不大时也不会重复出同一道。
 */
export function pickQuestions(bank: readonly Question[], count: number, rng: Rng, seen: readonly string[] = []): Question[] {
  const n = Math.max(0, Math.min(count, bank.length));
  const seenSet = new Set(seen);
  const fresh = shuffle(bank.filter((q) => !seenSet.has(q.id)), rng);
  if (fresh.length >= n) return fresh.slice(0, n);
  const old = shuffle(bank.filter((q) => seenSet.has(q.id)), rng);
  return shuffle([...fresh, ...old.slice(0, n - fresh.length)], rng);
}

/** 打乱一道题的选项顺序，并同步更新正确答案的序号 */
export function shuffleOptions(q: Question, rng: Rng): Question {
  const order = shuffle(q.options.map((_, i) => i), rng);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

export const letter = (i: number) => String.fromCharCode(65 + i);

/** 百分制得分：答对数 / 题数 × 100，四舍五入 */
export function scoreOf(correct: number, total: number): number {
  return total > 0 ? Math.round((correct * 100) / total) : 0;
}

/** 按分数评段位：取 min 不超过分数的最高一档，低于最低档时取第一档 */
export function rankOf(ranks: readonly RankLevel[], score: number): RankLevel {
  const sorted = ranks.slice().sort((a, b) => a.min - b.min);
  let hit = sorted[0];
  for (const r of sorted) if (score >= r.min) hit = r;
  return hit;
}

export function nextRank(ranks: readonly RankLevel[], score: number): RankLevel | null {
  const sorted = ranks.slice().sort((a, b) => a.min - b.min);
  return sorted.find((r) => r.min > score) ?? null;
}

export function emptyShop(dims: readonly Dimension[]): Shop {
  return Object.fromEntries(dims.map((d) => [d.id, 0]));
}

export const shopLevel = (shop: Shop): number => Object.values(shop).reduce((a, b) => a + b, 0);

/** 答对后三选一的升级项：必含这道题所属的维度，另外随机补足 */
export function upgradeChoices(dims: readonly Dimension[], q: Question, shop: Shop, rng: Rng, count = 3): Dimension[] {
  const open = dims.filter((d) => (shop[d.id] ?? 0) < MAX_DIM_LEVEL);
  const own = open.find((d) => d.id === q.dim);
  const others = shuffle(open.filter((d) => d !== own), rng);
  const picked = own ? [own, ...others.slice(0, count - 1)] : others.slice(0, count);
  return shuffle(picked, rng);
}

export function applyUpgrade(shop: Shop, dimId: string): Shop {
  if (!(dimId in shop)) return shop;
  return { ...shop, [dimId]: Math.min(MAX_DIM_LEVEL, shop[dimId] + 1) };
}

export interface DimReport {
  dim: Dimension;
  total: number;
  correct: number;
  rate: number;
  level: 'strong' | 'ok' | 'weak';
}

export interface Diagnosis {
  items: DimReport[];
  strongest: DimReport | null;
  weakest: DimReport | null;
  summary: string;
}

export const LEVEL_TEXT = { strong: '掌握得好', ok: '还可以', weak: '需要补强' } as const;

/** 经营诊断：按维度统计正确率；没有被抽到题的维度不列入 */
export function diagnose(dims: readonly Dimension[], questions: readonly Question[], answers: readonly Answer[]): Diagnosis {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const items: DimReport[] = [];
  for (const dim of dims) {
    const mine = answers.filter((a) => byId.get(a.qid)?.dim === dim.id);
    if (!mine.length) continue;
    const correct = mine.filter((a) => a.correct).length;
    const rate = correct / mine.length;
    items.push({ dim, total: mine.length, correct, rate, level: rate >= 0.8 ? 'strong' : rate >= 0.5 ? 'ok' : 'weak' });
  }
  if (!items.length) return { items, strongest: null, weakest: null, summary: '这一局没有可以统计的题目。' };
  const strongest = items.reduce((a, b) => (b.rate > a.rate ? b : a));
  const weakest = items.reduce((a, b) => (b.rate < a.rate ? b : a));
  let summary: string;
  if (weakest.rate === 1) summary = '全部答对，每个方面都很扎实，继续保持。';
  else if (strongest.rate === 0) summary = `这一局没有答对的题，最需要补的是「${weakest.dim.name}」，先从错题解析看起。`;
  else summary = `最强的是「${strongest.dim.name}」，最需要补强的是「${weakest.dim.name}」。${weakest.dim.advice}`;
  return { items, strongest, weakest, summary };
}

export interface WrongItem {
  question: Question;
  picked: number;
}

/** 错题列表，按答题顺序 */
export function wrongList(questions: readonly Question[], answers: readonly Answer[]): WrongItem[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: WrongItem[] = [];
  for (const a of answers) {
    const q = byId.get(a.qid);
    if (q && !a.correct) out.push({ question: q, picked: a.picked });
  }
  return out;
}
