import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../src/tool/samples';
import { checkBrand, checkConfig, checkQuestions, hasError, mix, normalizeColor, readableOn } from './check';

const cfg = () => sampleProject();

describe('题库校验', () => {
  it('示例题库没有错误', () => {
    const c = cfg();
    expect(checkQuestions(c.questions, c.dims)).toEqual([]);
    expect(hasError(checkConfig(c))).toBe(false);
  });
  it('逐项报错：空题目、选项不足、空选项、重复选项、没设答案、维度不存在', () => {
    const c = cfg();
    const bad = [
      { ...c.questions[0], title: ' ' },
      { ...c.questions[1], options: ['只有一个'] },
      { ...c.questions[2], options: ['甲', '', '丙', '丁'] },
      { ...c.questions[3], options: ['甲', '甲', '丙', '丁'] },
      { ...c.questions[4], answer: -1 },
      { ...c.questions[5], answer: 4 },
      { ...c.questions[6], dim: 'zzz' },
      { ...c.questions[7], options: ['1', '2', '3', '4', '5', '6', '7'] },
    ];
    const text = checkQuestions(bad, c.dims).map((i) => `${i.no}:${i.text}`);
    expect(text).toContain('1:题目是空的');
    expect(text).toContain('2:至少要有 2 个选项');
    expect(text).toContain('3:有选项是空的');
    expect(text).toContain('4:有两个选项的文字一样');
    expect(text).toContain('5:没有设置正确答案');
    expect(text).toContain('6:没有设置正确答案');
    expect(text).toContain('7:所属维度不存在');
    expect(text).toContain('8:最多 6 个选项');
  });
  it('没写解析、题目重复、题号重复：解析和题目重复是提醒，题号重复是错误', () => {
    const c = cfg();
    const list = [c.questions[0], { ...c.questions[1], title: c.questions[0].title, explain: '' }, { ...c.questions[2], id: c.questions[0].id }];
    const got = checkQuestions(list, c.dims);
    expect(got.find((i) => i.text.includes('没有写解析'))?.level).toBe('warn');
    expect(got.find((i) => i.text.includes('和第 1 题'))?.level).toBe('warn');
    expect(got.find((i) => i.text === '题号重复')?.level).toBe('error');
  });
  it('题库为空是错误；题库少于每局题数是提醒', () => {
    const c = cfg();
    expect(hasError(checkConfig({ ...c, questions: [] }))).toBe(true);
    const few = checkConfig({ ...c, questions: c.questions.slice(0, 5) });
    expect(hasError(few)).toBe(false);
    expect(few.some((i) => i.text.includes('只有 5 题'))).toBe(true);
  });
});

describe('品牌校验', () => {
  it('品牌名称、主色、段位、维度的错误', () => {
    const c = cfg();
    const names = (b = c.brand, r = c.ranks, d = c.dims) => checkBrand(b, r, d).filter((i) => i.level === 'error').map((i) => i.text);
    expect(names({ ...c.brand, name: ' ' })).toContain('品牌名称是空的');
    expect(names({ ...c.brand, color: 'orange' })[0]).toContain('#RRGGBB');
    expect(names(c.brand, c.ranks.slice(0, 3))[0]).toContain('正好 4 档');
    expect(names(c.brand, c.ranks.map((r) => ({ ...r, min: 50 })))).toContain('段位的起始分数不能重复');
    expect(names(c.brand, c.ranks.map((r, i) => ({ ...r, min: i * 10 + 5 })))[0]).toContain('要是 0');
    expect(names(c.brand, c.ranks, c.dims.map((d) => ({ ...d, name: '同名' })))).toContain('维度名称不能重复');
    expect(names(c.brand, c.ranks, c.dims.slice(1))[0]).toContain('正好 6 个');
  });
  it('没有 Logo 和二维码只是提醒', () => {
    const c = cfg();
    const w = checkBrand(c.brand, c.ranks, c.dims).filter((i) => i.level === 'warn').map((i) => i.text);
    expect(w.some((t) => t.includes('二维码'))).toBe(true);
    expect(w.some((t) => t.includes('Logo'))).toBe(true);
  });
});

describe('颜色', () => {
  it('整理成大写 #RRGGBB，不合法返回空', () => {
    expect(normalizeColor('f5a623')).toBe('#F5A623');
    expect(normalizeColor(' #abcdef ')).toBe('#ABCDEF');
    expect(normalizeColor('#abc')).toBeNull();
    expect(normalizeColor('红色')).toBeNull();
  });
  it('主色上的文字：浅色底用黑字，深色底用白字', () => {
    expect(readableOn('#FFD100')).toBe('#111111');
    expect(readableOn('#F5A623')).toBe('#111111');
    expect(readableOn('#1E3A8A')).toBe('#FFFFFF');
    expect(readableOn('#7C3AED')).toBe('#FFFFFF');
    expect(readableOn('不是颜色')).toBe('#111111');
  });
  it('混合白色与黑色', () => {
    expect(mix('#000000', 1)).toBe('#FFFFFF');
    expect(mix('#FFFFFF', -1)).toBe('#000000');
    expect(mix('#808080', 0)).toBe('#808080');
  });
});
