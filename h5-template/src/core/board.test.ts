import { describe, expect, it } from 'vitest';
import { createStorage } from '../storage';
import { addRecord, BOARD_SIZE, parseBoard } from './board';
import type { BoardRecord } from './types';

const rec = (name: string, score: number, at = 1, correct = score / 10): BoardRecord => ({ name, score, correct, total: 10, rank: '熟练店长', at });

describe('本机排行榜', () => {
  it('空榜没有任何预置的假名次', () => {
    expect(parseBoard(undefined)).toEqual([]);
    expect(createStorage('t', null).board()).toEqual([]);
  });
  it('按分数从高到低；同分先到的在前', () => {
    let l: BoardRecord[] = [];
    l = addRecord(l, rec('甲', 60, 5));
    l = addRecord(l, rec('乙', 90, 6));
    l = addRecord(l, rec('丙', 60, 2));
    expect(l.map((r) => r.name)).toEqual(['乙', '丙', '甲']);
  });
  it('同一个昵称只保留最高分；低分不覆盖', () => {
    let l = addRecord([], rec('甲', 70));
    l = addRecord(l, rec('甲', 50, 9));
    expect(l).toHaveLength(1);
    expect(l[0].score).toBe(70);
    l = addRecord(l, rec('甲', 80, 10));
    expect(l[0].score).toBe(80);
  });
  it('昵称为空不记录；超过 12 个字截断；最多保留 10 名', () => {
    expect(addRecord([], rec('  ', 80))).toEqual([]);
    expect(addRecord([], rec('一二三四五六七八九十甲乙丙丁', 80))[0].name).toBe('一二三四五六七八九十甲乙');
    let l: BoardRecord[] = [];
    for (let i = 0; i < 15; i++) l = addRecord(l, rec('玩家' + i, i * 5));
    expect(l).toHaveLength(BOARD_SIZE);
    expect(l[0].score).toBe(70);
    expect(l.at(-1)!.score).toBe(25);
  });
  it('读取损坏的本机数据时丢弃坏条目', () => {
    expect(parseBoard([{ name: '甲', score: 3, at: 1 }, { foo: 1 }, null, 'x'])).toHaveLength(1);
    expect(parseBoard({})).toEqual([]);
  });
});

describe('本机存储', () => {
  const fake = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };
  it('不同活动 id 的记录互不干扰', () => {
    const b = fake();
    createStorage('a', b).saveBest(80);
    expect(createStorage('a', b).best()).toBe(80);
    expect(createStorage('b', b).best()).toBe(0);
  });
  it('存储不可用或抛错时退回内存，不报错', () => {
    const boom = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    const s = createStorage('a', boom);
    s.saveName('小明');
    s.saveMuted(true);
    expect(s.name()).toBe('小明');
    expect(s.muted()).toBe(true);
    const n = createStorage('a', null);
    n.saveBoard([rec('甲', 50)]);
    expect(n.board()).toHaveLength(1);
  });
  it('未完成的对局：结构不对时当作没有', () => {
    const b = fake();
    const s = createStorage('a', b);
    expect(s.game()).toBeNull();
    b.setItem('qlg:a:game', '{坏的');
    expect(s.game()).toBeNull();
    s.saveGame({ qs: [], idx: 0, answers: [], shop: {} });
    expect(s.game()).toBeNull();
    s.clearGame();
  });
  it('已见过的题号最多保留 500 个', () => {
    const s = createStorage('a', fake());
    s.saveSeen(Array.from({ length: 600 }, (_, i) => 'q' + i));
    expect(s.seen()).toHaveLength(500);
    expect(s.seen()[499]).toBe('q599');
  });
});
