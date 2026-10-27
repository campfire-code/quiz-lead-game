// 题库与品牌检查、颜色换算。出题器导出前用它拦住错误，H5 启动时也用它兜底。
import type { Brand, Dimension, Question, QuizConfig, RankLevel } from './types';
import { DIM_COUNT, MAX_OPTIONS, MIN_OPTIONS, RANK_COUNT } from './types';

export interface Issue {
  level: 'error' | 'warn';
  /** 第几题（从 1 开始）；0 表示不针对某一题 */
  no: number;
  text: string;
}

export function checkQuestions(questions: readonly Question[], dims: readonly Dimension[]): Issue[] {
  const issues: Issue[] = [];
  const dimIds = new Set(dims.map((d) => d.id));
  const ids = new Set<string>();
  const titles = new Map<string, number>();
  questions.forEach((q, i) => {
    const no = i + 1;
    const err = (text: string) => issues.push({ level: 'error', no, text });
    const warn = (text: string) => issues.push({ level: 'warn', no, text });
    if (!q.title.trim()) err('题目是空的');
    if (ids.has(q.id)) err('题号重复');
    ids.add(q.id);
    const t = q.title.trim();
    if (t) {
      if (titles.has(t)) warn(`和第 ${titles.get(t)} 题的题目一样`);
      else titles.set(t, no);
    }
    if (q.options.length < MIN_OPTIONS) err(`至少要有 ${MIN_OPTIONS} 个选项`);
    if (q.options.length > MAX_OPTIONS) err(`最多 ${MAX_OPTIONS} 个选项`);
    if (q.options.some((o) => !o.trim())) err('有选项是空的');
    const texts = q.options.map((o) => o.trim()).filter(Boolean);
    if (new Set(texts).size !== texts.length) err('有两个选项的文字一样');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err('没有设置正确答案');
    if (!dimIds.has(q.dim)) err('所属维度不存在');
    if (!q.explain.trim()) warn('没有写解析，答完看不到原因');
  });
  return issues;
}

export function checkBrand(brand: Brand, ranks: readonly RankLevel[], dims: readonly Dimension[]): Issue[] {
  const issues: Issue[] = [];
  const err = (text: string) => issues.push({ level: 'error', no: 0, text });
  const warn = (text: string) => issues.push({ level: 'warn', no: 0, text });
  if (!brand.name.trim()) err('品牌名称是空的');
  if (!/^#[0-9a-fA-F]{6}$/.test(brand.color)) err('主色要写成 #RRGGBB，例如 #F5A623');
  if (ranks.length !== RANK_COUNT) err(`段位要正好 ${RANK_COUNT} 档`);
  if (ranks.some((r) => !r.name.trim())) err('有段位名称是空的');
  if (ranks.some((r) => !Number.isFinite(r.min) || r.min < 0 || r.min > 100)) err('段位的起始分数要在 0 到 100 之间');
  const mins = ranks.map((r) => r.min);
  if (new Set(mins).size !== mins.length) err('段位的起始分数不能重复');
  else if (mins.length && Math.min(...mins) !== 0) err('最低一档的起始分数要是 0，否则低分没有段位');
  if (dims.length !== DIM_COUNT) err(`维度要正好 ${DIM_COUNT} 个`);
  if (dims.some((d) => !d.name.trim())) err('有维度名称是空的');
  if (new Set(dims.map((d) => d.name.trim())).size !== dims.length) err('维度名称不能重复');
  if (!brand.qr) warn('还没有上传结尾二维码，领奖页只会显示引导文案');
  if (!brand.logo) warn('还没有上传 Logo，首页和海报只显示品牌名称');
  if (!brand.ctaText.trim()) warn('引导文案是空的');
  return issues;
}

export function checkConfig(cfg: QuizConfig): Issue[] {
  const issues = [...checkBrand(cfg.brand, cfg.ranks, cfg.dims), ...checkQuestions(cfg.questions, cfg.dims)];
  if (cfg.questions.length === 0) issues.push({ level: 'error', no: 0, text: '题库是空的，至少要有 1 道题' });
  else if (cfg.questions.length < cfg.questionCount) {
    issues.push({ level: 'warn', no: 0, text: `题库只有 ${cfg.questions.length} 题，少于每局 ${cfg.questionCount} 题，每局会把全部题目出完` });
  }
  return issues;
}

export const hasError = (issues: readonly Issue[]) => issues.some((i) => i.level === 'error');

const HEX = /^#?([0-9a-fA-F]{6})$/;

/** 把用户写的颜色整理成 #RRGGBB（大写）；不合法返回 null */
export function normalizeColor(s: string): string | null {
  const m = HEX.exec(s.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** 在主色上写字用黑色还是白色：按相对亮度选对比度更高的 */
export function readableOn(hex: string): '#111111' | '#FFFFFF' {
  const m = HEX.exec(hex);
  if (!m) return '#111111';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#111111' : '#FFFFFF';
}

/** 把颜色向白色（amount>0）或黑色（amount<0）混合，范围 -1～1 */
export function mix(hex: string, amount: number): string {
  const m = HEX.exec(hex);
  if (!m) return hex;
  const to = amount >= 0 ? 255 : 0;
  const k = Math.abs(Math.max(-1, Math.min(1, amount)));
  const out = [0, 2, 4].map((i) => Math.round(parseInt(m[1].slice(i, i + 2), 16) * (1 - k) + to * k));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
