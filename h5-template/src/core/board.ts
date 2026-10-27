// 本机排行榜：只记录在这台设备的浏览器里，不联网。同一个昵称只保留最高的一条。
import type { BoardRecord } from './types';

export const BOARD_SIZE = 10;

const better = (a: BoardRecord, b: BoardRecord) =>
  a.score !== b.score ? a.score > b.score : a.correct !== b.correct ? a.correct > b.correct : a.at < b.at;

export function addRecord(list: readonly BoardRecord[], rec: BoardRecord): BoardRecord[] {
  const name = rec.name.trim().slice(0, 12);
  if (!name) return list.slice();
  const next = list.filter((r) => r.name !== name);
  const old = list.find((r) => r.name === name);
  next.push(old && !better({ ...rec, name }, old) ? old : { ...rec, name });
  return next.sort((a, b) => (better(a, b) ? -1 : 1)).slice(0, BOARD_SIZE);
}

/** 读取本机保存的内容时的容错：格式不对的条目直接丢掉 */
export function parseBoard(raw: unknown): BoardRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is BoardRecord => !!r && typeof r.name === 'string' && typeof r.score === 'number' && typeof r.at === 'number')
    .map((r) => ({ name: r.name.slice(0, 12), score: r.score, correct: Number(r.correct) || 0, total: Number(r.total) || 0, rank: String(r.rank ?? ''), at: r.at }))
    .slice(0, BOARD_SIZE);
}
