// 生成 samples/ 里的示例文件（只在设置了 MAKE_SAMPLES=1 时运行）
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { EXPORT_HEADER, toJson, toRows } from './core';
import { SAMPLE_DIMS } from './samples';
import { writeXlsx } from './xlsx';
import type { Question } from '../../h5-template/src/core/types';

// 一份「宠物店经营」的虚构小题库，用来演示换行业：导入后和奶茶店示例题混在一起
const pet: [number, string, string[], number, string][] = [
  [1, '宠物店最适合开在哪类位置？', ['偏僻的工业区', '有稳定居民区客流的社区周边', '没有人经过的小巷', '只考虑租金最低'], 1, '宠物主人多在居住区活动，社区周边的稳定客流是复购的基础。'],
  [2, '给宠物零食定价时，更合理的做法是？', ['参考成本和同类产品价格，保证合理毛利', '随便定一个数', '一律最低价', '一律最高价'], 0, '定价要覆盖成本，也要和周边同类产品比较，让顾客觉得合理。'],
  [3, '宠物美容预约经常撞车，最先该做什么？', ['拒绝所有预约', '用预约表按时段排班，并提前确认', '让顾客自己等', '取消美容服务'], 1, '提前预约、按时段排班，是控制等待和提高周转的基础。'],
  [4, '想让周边小区的人知道新开的宠物店，较有效的方式是？', ['在小区群里提供养宠知识并附上到店福利', '每天刷屏广告', '什么都不做', '只发给陌生人'], 0, '先给有用的内容，再给福利，比单纯刷广告更容易被接受。'],
  [5, '顾客反映宠物洗完后有点应激，应该怎么处理？', ['说是顾客的宠物问题', '诚恳了解情况，回访并改进流程', '直接删除评价', '不再接待这位顾客'], 1, '认真回访并改进，才能留住信任。'],
  [6, '怎样让买过一次粮的顾客再来？', ['不联系', '在合适的时间提醒补货，并给一张补货小券', '每天打电话', '把价格抬高'], 1, '宠物粮是周期性消耗品，到点提醒补货很自然。'],
];

it.runIf(process.env.MAKE_SAMPLES === '1')('生成示例文件', async () => {
  const qs: Question[] = pet.map(([d, title, options, answer, explain], i) => ({ id: `x${i}`, title, options, answer, explain, dim: SAMPLE_DIMS[d - 1].id }));
  const rows = toRows(qs, SAMPLE_DIMS);
  rows.push(rows[0].slice()); // 一道重复题，演示导入时自动跳过
  rows.push(['', '', '', '', '', '', '', '', '', '']); // 一个空行
  writeFileSync('samples/宠物店题库示例.xlsx', await writeXlsx(EXPORT_HEADER, rows, '题库'));
  writeFileSync('samples/宠物店题库示例.json', toJson(qs.slice(0, 2), SAMPLE_DIMS));
});

// 开发用：把示例项目真实导出到 H5_DEMO_DIR 指定的文件夹，供浏览器里手动检查和截图（带一张示例二维码）
it.runIf(!!process.env.H5_DEMO_DIR)('导出示例 H5 到磁盘', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const QRCode = (await import('qrcode')).default;
  const { exportH5 } = await import('./exporter');
  const { sampleProject } = await import('./samples');
  const { TEMPLATES } = await import('./template');
  const p = sampleProject();
  p.brand.qr = await QRCode.toDataURL('https://example.com/demo', { width: 360, margin: 2 });
  const dir = process.env.H5_DEMO_DIR!;
  mkdirSync(dir, { recursive: true });
  const r = await exportH5({
    join: async (...a) => join(...a),
    mkdir: async (d) => void mkdirSync(d, { recursive: true }),
    writeFile: async (f, d) => writeFileSync(f, d),
    writeText: async (f, t) => writeFileSync(f, t),
  }, p, dir, TEMPLATES);
  console.log('H5_DEMO', r.dir);
});
