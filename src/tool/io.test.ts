import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { exportBank, importFile, type FileIO } from './io';
import { sampleProject } from './samples';
import { readGrid, writeXlsx } from './xlsx';
import { EXPORT_HEADER } from './core';

function memIO(files: Map<string, Uint8Array>): FileIO {
  return {
    readFile: async (p) => {
      const f = files.get(p);
      if (!f) throw new Error('文件不存在');
      return f;
    },
    writeFile: async (p, d) => void files.set(p, d),
    writeText: async (p, t) => void files.set(p, new TextEncoder().encode(t)),
  };
}
const empty = () => ({ ...sampleProject(), questions: [] });

describe('题库导入导出流程（内存文件系统）', () => {
  it('导出 Excel 再导入到空题库，题目内容一致', async () => {
    const files = new Map<string, Uint8Array>();
    const io = memIO(files);
    const src = sampleProject();
    expect(await exportBank(io, src, '/out/题库.xlsx')).toContain('已导出 20 道题');
    const grid = await readGrid(files.get('/out/题库.xlsx')!, 'a.xlsx');
    expect(grid[0]).toEqual(EXPORT_HEADER);
    expect(grid).toHaveLength(21);
    const r = await importFile(io, empty(), '/out/题库.xlsx');
    expect(r.message).toBe('从「题库.xlsx」导入 20 道题');
    r.project.questions.forEach((q, i) => expect({ ...q, id: '' }).toEqual({ ...src.questions[i], id: '' }));
  });
  it('导出 JSON 后导入回原题库：全部识别为重复', async () => {
    const files = new Map<string, Uint8Array>();
    const io = memIO(files);
    await exportBank(io, sampleProject(), 'C:\\备份\\题库.json');
    const r = await importFile(io, sampleProject(), 'C:\\备份\\题库.json');
    expect(r.added).toBe(0);
    expect(r.message).toBe('从「题库.json」导入 0 道题（20 道重复已跳过）');
  });
  it('导入 GBK 编码的 CSV', async () => {
    // 「题目,选项A,选项B,正确答案\r\n甲,对,错,A」的 GBK 编码
    const gbk = new Uint8Array([0xcc, 0xe2, 0xc4, 0xbf, 0x2c, 0xd1, 0xa1, 0xcf, 0xee, 0x41, 0x2c, 0xd1, 0xa1, 0xcf, 0xee, 0x42, 0x2c, 0xd5, 0xfd, 0xc8, 0xb7, 0xb4, 0xf0, 0xb0, 0xb8, 0x0d, 0x0a, 0xbc, 0xd7, 0x2c, 0xb6, 0xd4, 0x2c, 0xb4, 0xed, 0x2c, 0x41]);
    const r = await importFile(memIO(new Map([['/in/老题库.csv', gbk]])), empty(), '/in/老题库.csv');
    expect(r.project.questions[0]).toMatchObject({ title: '甲', options: ['对', '错'], answer: 0 });
  });
  it('提示所属维度对不上的题数；空行被跳过', async () => {
    const x = await writeXlsx(['题目', '选项A', '选项B', '正确答案', '所属维度'], [['题一', 'a', 'b', 'A', '乱写的维度'], ['', '', '', '', '']]);
    const r = await importFile(memIO(new Map([['/in/a.xlsx', x]])), empty(), '/in/a.xlsx');
    expect(r.message).toContain('1 道题的所属维度对不上，已先归到「门头选址」');
    expect(r.message).toContain('1 个空行已跳过');
  });
  it('表格里没有题目时报错；文件不存在时报错', async () => {
    const files = new Map([['/in/空.xlsx', await writeXlsx(['题目', '选项A'], [['', '']])]]);
    await expect(importFile(memIO(files), empty(), '/in/空.xlsx')).rejects.toThrow('没有找到题目');
    await expect(importFile(memIO(files), empty(), '/in/没有.xlsx')).rejects.toThrow('文件不存在');
  });
  it('损坏的 xlsx 给出中文提示', async () => {
    const files = new Map([['/in/坏.xlsx', new Uint8Array([1, 2, 3])]]);
    await expect(importFile(memIO(files), empty(), '/in/坏.xlsx')).rejects.toThrow('无法读取这个 Excel');
  });
});

describe('samples/ 里的示例文件', () => {
  const load = (name: string) => new Uint8Array(readFileSync(`samples/${name}`));
  it('宠物店题库示例.xlsx：导入 6 道，1 道重复、1 个空行被跳过', async () => {
    const io = memIO(new Map([['/s.xlsx', load('宠物店题库示例.xlsx')]]));
    const r = await importFile(io, sampleProject(), '/s.xlsx');
    expect(r.message).toBe('从「s.xlsx」导入 6 道题（1 道重复已跳过，1 个空行已跳过）');
    expect(r.project.questions).toHaveLength(26);
  });
  it('宠物店题库示例.json：导入 2 道', async () => {
    const io = memIO(new Map([['/s.json', load('宠物店题库示例.json')]]));
    const r = await importFile(io, sampleProject(), '/s.json');
    expect(r.message).toBe('从「s.json」导入 2 道题');
  });
});
