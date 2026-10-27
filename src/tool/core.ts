// 出题器的纯函数：题库与表格 / JSON 互转、导入合并、图片与项目校验。不依赖界面和本机能力，便于测试。
import { normalizeColor } from '../../h5-template/src/core/check';
import type { Dimension, Question, QuizConfig } from '../../h5-template/src/core/types';
import { MAX_OPTIONS, MIN_OPTIONS } from '../../h5-template/src/core/types';

export type Project = QuizConfig;
export type Cell = string | number | boolean | Date | null;

const ALPHA = 'ABCDEF';
export const OPTION_COLS = ALPHA.split('').map((l) => `选项${l}`);
export const EXPORT_HEADER = ['题目', ...OPTION_COLS, '正确答案', '解析', '所属维度'];

export const newId = () => 'q' + Math.random().toString(36).slice(2, 9);

export function blankQuestion(dim: string): Question {
  return { id: newId(), title: '', options: ['', '', '', ''], answer: -1, explain: '', dim };
}

const str = (v: Cell | undefined) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();

// ---------- 表格 ----------

export function toRows(questions: readonly Question[], dims: readonly Dimension[]): Cell[][] {
  const name = new Map(dims.map((d) => [d.id, d.name]));
  return questions.map((q) => [
    q.title,
    ...Array.from({ length: MAX_OPTIONS }, (_, i) => q.options[i] ?? ''),
    q.answer >= 0 ? ALPHA[q.answer] : '',
    q.explain,
    name.get(q.dim) ?? '',
  ]);
}

const HEAD_ALIASES: Record<string, string[]> = {
  title: ['题目', '题干', '问题', '试题', 'title'],
  answer: ['正确答案', '答案', '标准答案', 'answer'],
  explain: ['解析', '答案解析', '说明', 'explain'],
  dim: ['所属维度', '维度', '分类', '类别', 'dim'],
};

export interface ParsedBank {
  questions: Question[];
  /** 没有内容被跳过的行数 */
  skipped: number;
  /** 所属维度对不上，已归到第一个维度的题数 */
  unknownDim: number;
}

/** 从二维表读题。表头认中文和常见写法，列顺序不限；表里没有表头时按默认顺序读 */
export function fromRows(grid: readonly (readonly Cell[])[], dims: readonly Dimension[]): ParsedBank {
  const rows = grid.filter((r) => r && r.some((c) => str(c)));
  const out: ParsedBank = { questions: [], skipped: grid.length - rows.length, unknownDim: 0 };
  if (!rows.length) return out;
  const head = rows[0].map((c) => str(c).replace(/\s/g, ''));
  const col = (key: string) => head.findIndex((h) => HEAD_ALIASES[key].includes(h.toLowerCase()));
  const optCol = (i: number) => head.findIndex((h) => h === `选项${ALPHA[i]}` || h === ALPHA[i] || h.toLowerCase() === `option${ALPHA[i].toLowerCase()}`);
  const hasHead = col('title') >= 0;
  const idx = hasHead
    ? { title: col('title'), opts: Array.from({ length: MAX_OPTIONS }, (_, i) => optCol(i)), answer: col('answer'), explain: col('explain'), dim: col('dim') }
    : { title: 0, opts: [1, 2, 3, 4, 5, 6], answer: 7, explain: 8, dim: 9 };
  const dimByName = new Map(dims.map((d) => [d.name, d.id]));
  for (const r of hasHead ? rows.slice(1) : rows) {
    const title = str(r[idx.title]);
    if (!title) {
      out.skipped++;
      continue;
    }
    // 选项：尾部的空选项去掉；中间的空选项保留，由检查提示
    const raw = idx.opts.map((c) => (c >= 0 ? str(r[c]) : ''));
    let n = raw.length;
    while (n > 0 && !raw[n - 1]) n--;
    const options = raw.slice(0, n);
    const ans = str(r[idx.answer]);
    let answer = -1;
    const letter = /^[A-Fa-f]$/.exec(ans);
    if (letter) answer = ALPHA.indexOf(letter[0].toUpperCase());
    else if (/^[1-6]$/.test(ans)) answer = Number(ans) - 1;
    else if (ans) answer = options.findIndex((o) => o === ans);
    if (answer >= options.length) answer = -1;
    let dim = dimByName.get(str(r[idx.dim]));
    if (!dim) {
      dim = dims[0]?.id ?? '';
      out.unknownDim++;
    }
    const padded = options.length >= MIN_OPTIONS ? options : [...options, ...Array<string>(MIN_OPTIONS - options.length).fill('')];
    out.questions.push({ id: newId(), title, options: padded, answer, explain: str(r[idx.explain]), dim });
  }
  return out;
}

// ---------- JSON ----------

/** 题库 JSON：答案写字母、维度写名称，方便手写和他人阅读 */
export function toJson(questions: readonly Question[], dims: readonly Dimension[]): string {
  const name = new Map(dims.map((d) => [d.id, d.name]));
  return (
    JSON.stringify(
      { version: 1, questions: questions.map((q) => ({ title: q.title, options: q.options, answer: q.answer >= 0 ? ALPHA[q.answer] : '', explain: q.explain, dim: name.get(q.dim) ?? '' })) },
      null,
      2,
    ) + '\n'
  );
}

export function fromJson(text: string, dims: readonly Dimension[]): ParsedBank {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('这不是有效的 JSON 文件');
  }
  const list = Array.isArray(data) ? data : (data as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) throw new Error('JSON 里没有找到题目列表（应为 questions 数组）');
  const grid: Cell[][] = [EXPORT_HEADER];
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const opts = Array.isArray(o.options) ? o.options.map((x) => String(x ?? '')) : [];
    const ans = typeof o.answer === 'number' ? (ALPHA[o.answer] ?? '') : String(o.answer ?? '');
    grid.push([String(o.title ?? ''), ...Array.from({ length: MAX_OPTIONS }, (_, i) => opts[i] ?? ''), ans, String(o.explain ?? ''), String(o.dim ?? '')]);
  }
  return fromRows(grid, dims);
}

// ---------- 合并 ----------

/** 把导入的题合并进题库；题目文字相同的视为重复，跳过 */
export function mergeImport(project: Project, parsed: ParsedBank): { project: Project; added: number; dup: number } {
  const have = new Set(project.questions.map((q) => q.title.trim()));
  const fresh: Question[] = [];
  let dup = 0;
  for (const q of parsed.questions) {
    if (have.has(q.title.trim())) dup++;
    else {
      have.add(q.title.trim());
      fresh.push(q);
    }
  }
  return { project: { ...project, questions: [...project.questions, ...fresh] }, added: fresh.length, dup };
}

// ---------- 图片 ----------

export const IMAGE_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function toDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export function fromDataUrl(url: string): { mime: string; ext: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2], bytes };
}

/** 读图片文件成 data 地址，格式和大小不对时抛出中文错误 */
export function imageDataUrl(fileName: string, bytes: Uint8Array): string {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  const mime = IMAGE_EXT[ext];
  if (!mime) throw new Error('只支持 png、jpg、webp、gif 图片');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`图片有 ${(bytes.length / 1048576).toFixed(1)} MB，超过 2 MB，请先压缩后再选`);
  return toDataUrl(bytes, mime);
}

// ---------- 本机保存的项目 ----------

/** 本机保存的项目可能被旧版本写过或损坏：结构对得上才用，否则返回 null */
export function validProject(v: unknown): Project | null {
  const p = v as Project | null;
  if (!p || typeof p !== 'object' || p.version !== 1 || typeof p.id !== 'string') return null;
  if (!p.brand || !Array.isArray(p.ranks) || !Array.isArray(p.dims) || !Array.isArray(p.questions)) return null;
  if (p.ranks.length !== 4 || p.dims.length !== 6) return null;
  if (!p.questions.every((q) => q && typeof q.title === 'string' && Array.isArray(q.options) && typeof q.dim === 'string')) return null;
  const color = normalizeColor(String(p.brand.color)) ?? '#F5A623';
  return { ...p, brand: { ...p.brand, color }, questionCount: Math.min(20, Math.max(1, Math.round(Number(p.questionCount)) || 10)) };
}

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 40) || '答题H5';
