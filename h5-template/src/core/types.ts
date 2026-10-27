// 题库与品牌配置的数据结构。出题器写出、H5 读取，两边共用这一份定义。

export interface Dimension {
  id: string;
  name: string;
  emoji: string;
  /** 升级时显示的一句话，例如「让顾客一眼看到你」 */
  desc: string;
  /** 这一维度答得不好时，诊断里给的建议 */
  advice: string;
}

export interface Question {
  id: string;
  title: string;
  /** 2～6 个选项文字，不含 A/B/C 字母 */
  options: string[];
  /** 正确选项的序号，从 0 开始 */
  answer: number;
  explain: string;
  /** 所属维度的 id */
  dim: string;
}

export interface RankLevel {
  name: string;
  emoji: string;
  /** 达到这个分数（满分 100）就是这一档 */
  min: number;
  desc: string;
}

export interface Brand {
  name: string;
  tagline: string;
  /** 主色，#RRGGBB */
  color: string;
  /** Logo 图片路径（相对 index.html），没有就留空 */
  logo: string;
  /** 结尾二维码图片路径，没有就留空 */
  qr: string;
  ctaTitle: string;
  ctaText: string;
  qrHint: string;
  /** 海报二维码指向的网址；留空则用页面自己的网址 */
  shareUrl: string;
}

export interface QuizConfig {
  version: 1;
  /** 用来区分同一域名下不同活动的本机记录 */
  id: string;
  brand: Brand;
  /** 固定 4 档，按 min 从低到高 */
  ranks: RankLevel[];
  /** 固定 6 个维度 */
  dims: Dimension[];
  /** 每局抽几题 */
  questionCount: number;
  questions: Question[];
}

export interface Answer {
  qid: string;
  picked: number;
  correct: boolean;
}

/** 店铺每个维度的等级：维度 id → 级别 */
export type Shop = Record<string, number>;

export interface BoardRecord {
  name: string;
  score: number;
  correct: number;
  total: number;
  rank: string;
  at: number;
}

export const MAX_DIM_LEVEL = 10;
export const DIM_COUNT = 6;
export const RANK_COUNT = 4;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
