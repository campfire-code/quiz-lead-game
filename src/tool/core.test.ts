import { describe, expect, it } from 'vitest';
import { checkQuestions } from '../../h5-template/src/core/check';
import { EXPORT_HEADER, fromDataUrl, fromJson, fromRows, imageDataUrl, mergeImport, safeName, toDataUrl, toJson, toRows, validProject, MAX_IMAGE_BYTES } from './core';
import { sampleProject } from './samples';

const p = () => sampleProject();

describe('示例题库', () => {
  it('20 道虚构的奶茶店题，6 个维度都有题，正确答案分布在多个位置', () => {
    const c = p();
    expect(c.questions).toHaveLength(20);
    expect(new Set(c.questions.map((q) => q.dim)).size).toBe(6);
    expect(new Set(c.questions.map((q) => q.answer)).size).toBeGreaterThanOrEqual(4);
    expect(checkQuestions(c.questions, c.dims)).toEqual([]);
  });
  it('示例里没有真实品牌或联系方式', () => {
    const text = JSON.stringify(p());
    expect(text).not.toMatch(/美团|waimai|https?:\/\/|\d{11}|微信号[:：]\s*\w/);
  });
});

describe('表格互转', () => {
  it('导出再读回，题目、选项、答案、解析、维度一致（题号重新生成）', () => {
    const c = p();
    const back = fromRows([EXPORT_HEADER, ...toRows(c.questions, c.dims)], c.dims);
    expect(back.questions).toHaveLength(20);
    back.questions.forEach((q, i) => expect({ ...q, id: '' }).toEqual({ ...c.questions[i], id: '' }));
    expect(back.unknownDim).toBe(0);
  });
  it('表头认常见写法，列顺序不限；答案可写字母、序号或选项原文', () => {
    const c = p();
    const grid = [
      ['答案', '问题', 'A', 'B', 'C', '维度', '答案解析'],
      ['b', '甲题', '一', '二', '三', '菜单产品', '因为二'],
      ['3', '乙题', '一', '二', '三', '门头选址', ''],
      ['二', '丙题', '一', '二', '三', '出品效率', ''],
    ];
    const r = fromRows(grid, c.dims);
    expect(r.questions.map((q) => q.answer)).toEqual([1, 2, 1]);
    expect(r.questions[0]).toMatchObject({ title: '甲题', options: ['一', '二', '三'], explain: '因为二', dim: 'd2' });
    expect(r.questions.map((q) => q.dim)).toEqual(['d2', 'd1', 'd3']);
  });
  it('没有表头时按默认顺序读；空行跳过并计数', () => {
    const c = p();
    const r = fromRows([['题', '甲', '乙', '', '', '', '', 'B', '解', '菜单产品'], [], ['', '', ''], [null, null]], c.dims);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]).toMatchObject({ options: ['甲', '乙'], answer: 1, dim: 'd2' });
    expect(r.skipped).toBe(3);
  });
  it('所属维度对不上：归到第一个维度并计数；答案超出选项数记为未设置', () => {
    const c = p();
    const r = fromRows([['题目', '选项A', '选项B', '正确答案', '所属维度'], ['x', '甲', '乙', 'D', '不存在的维度'], ['y', '甲', '乙', '', '']], c.dims);
    expect(r.unknownDim).toBe(2);
    expect(r.questions.map((q) => [q.dim, q.answer])).toEqual([['d1', -1], ['d1', -1]]);
  });
  it('选项少于 2 个时补成 2 个空选项，由检查提示', () => {
    const c = p();
    const r = fromRows([['题目', '选项A', '正确答案'], ['只有一个选项', '甲', 'A']], c.dims);
    expect(r.questions[0].options).toEqual(['甲', '']);
    expect(checkQuestions(r.questions, c.dims).some((i) => i.text === '有选项是空的')).toBe(true);
  });
  it('Excel 里的数字、日期单元格不会让读取崩溃', () => {
    const c = p();
    const r = fromRows([['题目', '选项A', '选项B', '正确答案'], [2026, 1, 2, 1]], c.dims);
    expect(r.questions[0]).toMatchObject({ title: '2026', options: ['1', '2'], answer: 0 });
  });
});

describe('JSON 互转', () => {
  it('导出再读回一致；答案写字母、维度写名称', () => {
    const c = p();
    const text = toJson(c.questions, c.dims);
    expect(JSON.parse(text).questions[0]).toMatchObject({ answer: 'B', dim: '门头选址' });
    const back = fromJson(text, c.dims);
    back.questions.forEach((q, i) => expect({ ...q, id: '' }).toEqual({ ...c.questions[i], id: '' }));
  });
  it('也接受直接是题目数组、答案写序号的 JSON', () => {
    const c = p();
    const r = fromJson(JSON.stringify([{ title: 't', options: ['a', 'b'], answer: 1, dim: '菜单产品' }]), c.dims);
    expect(r.questions[0]).toMatchObject({ answer: 1, dim: 'd2' });
  });
  it('不是 JSON 或没有题目列表时给出中文错误', () => {
    const c = p();
    expect(() => fromJson('{坏的', c.dims)).toThrow('不是有效的 JSON');
    expect(() => fromJson('{"a":1}', c.dims)).toThrow('没有找到题目列表');
  });
});

describe('导入合并', () => {
  it('题目文字相同的算重复，跳过；同一批里的重复也跳过', () => {
    const c = p();
    const parsed = fromRows([['题目', '选项A', '选项B', '正确答案'], [c.questions[0].title, 'a', 'b', 'A'], ['新题', 'a', 'b', 'A'], ['新题', 'a', 'b', 'A']], c.dims);
    const r = mergeImport(c, parsed);
    expect(r.added).toBe(1);
    expect(r.dup).toBe(2);
    expect(r.project.questions).toHaveLength(21);
    expect(c.questions).toHaveLength(20);
  });
});

describe('图片', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
  it('转成 data 地址再还原，字节一致', () => {
    const url = imageDataUrl('logo.PNG', png);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    const back = fromDataUrl(url)!;
    expect(back.ext).toBe('png');
    expect([...back.bytes]).toEqual([...png]);
  });
  it('jpg 的扩展名统一为 jpg；大文件分段编码也正确', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 251);
    const back = fromDataUrl(toDataUrl(big, 'image/jpeg'))!;
    expect(back.ext).toBe('jpg');
    expect(back.bytes).toEqual(big);
  });
  it('格式不支持或超过 2 MB 时报中文错误；不是图片 data 地址返回空', () => {
    expect(() => imageDataUrl('a.svg', png)).toThrow('只支持 png');
    expect(() => imageDataUrl('a.png', new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow('超过 2 MB');
    expect(fromDataUrl('data:text/html;base64,PGI+')).toBeNull();
    expect(fromDataUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('本机项目与文件名', () => {
  it('结构正确的项目可用；损坏的返回空；主色和题数被整理', () => {
    const c = p();
    expect(validProject(c)).not.toBeNull();
    expect(validProject(null)).toBeNull();
    expect(validProject({ ...c, dims: c.dims.slice(1) })).toBeNull();
    expect(validProject({ ...c, questions: [{ title: 1 }] })).toBeNull();
    const v = validProject({ ...c, questionCount: 99, brand: { ...c.brand, color: '坏颜色' } })!;
    expect(v.questionCount).toBe(20);
    expect(v.brand.color).toBe('#F5A623');
  });
  it('文件夹名去掉非法字符，空名用默认', () => {
    expect(safeName('我的/店:铺*?')).toBe('我的 店 铺');
    expect(safeName('  ')).toBe('答题H5');
    expect(safeName('..隐藏')).toBe('隐藏');
  });
});
