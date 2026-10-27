import { describe, expect, it } from 'vitest';
import { buildConfig, buildPreviewHtml, configScript, exportH5, type ExportIO } from './exporter';
import { toDataUrl } from './core';
import { sampleProject } from './samples';
import type { Templates } from './template';
import { TEMPLATES } from './template';

const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5]);

// 内存文件系统：记录写入的文件和建过的文件夹
function memFs() {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const enc = new TextEncoder();
  const io: ExportIO = {
    join: async (...p) => p.join('/'),
    mkdir: async (p) => void dirs.add(p),
    writeFile: async (p, d) => {
      const dir = p.slice(0, p.lastIndexOf('/'));
      if (!dirs.has(dir) && dir !== '/out') throw new Error(`文件夹不存在：${dir}`);
      files.set(p, d);
    },
    writeText: async (p, t) => {
      const dir = p.slice(0, p.lastIndexOf('/'));
      if (!dirs.has(dir) && dir !== '/out') throw new Error(`文件夹不存在：${dir}`);
      files.set(p, enc.encode(t));
    },
  };
  const text = (p: string) => new TextDecoder().decode(files.get(p));
  return { io, files, dirs, text };
}

const withImages = () => {
  const p = sampleProject();
  p.brand = { ...p.brand, logo: toDataUrl(png, 'image/png'), qr: toDataUrl(png, 'image/jpeg') };
  return p;
};
const fake: Templates = { indexHtml: '<html><head><title>答题挑战</title><link rel="stylesheet" href="style.css"></head><body><script src="config.js"></script><script src="app.js"></script></body></html>', appJs: 'console.log(1)', styleCss: 'body{}' };

describe('生成 H5 配置', () => {
  it('图片拆成 assets 文件，配置里只留相对路径', () => {
    const { config, assets } = buildConfig(withImages());
    expect(config.brand.logo).toBe('assets/logo.png');
    expect(config.brand.qr).toBe('assets/qr.jpg');
    expect(assets.map((a) => a.path)).toEqual(['assets/logo.png', 'assets/qr.jpg']);
    expect([...assets[0].bytes]).toEqual([...png]);
    expect(JSON.stringify(config)).not.toContain('base64');
  });
  it('没有图片时没有 assets；预览模式保留 data 地址', () => {
    expect(buildConfig(sampleProject()).assets).toEqual([]);
    expect(buildConfig(sampleProject()).config.brand.logo).toBe('');
    expect(buildConfig(withImages(), true).config.brand.logo.startsWith('data:image/png')).toBe(true);
  });
  it('文字去首尾空白，主色转大写，段位按起始分数排序，题数取整', () => {
    const p = sampleProject();
    p.brand = { ...p.brand, name: '  我的店  ', color: '#abcdef' };
    p.ranks = [p.ranks[3], p.ranks[0], p.ranks[2], p.ranks[1]];
    p.questionCount = 8.4;
    p.questions = [{ ...p.questions[0], title: ' 题 ', options: [' 甲 ', '乙'] }];
    const { config } = buildConfig(p);
    expect(config.brand).toMatchObject({ name: '我的店', color: '#ABCDEF' });
    expect(config.ranks.map((r) => r.min)).toEqual([0, 40, 60, 80]);
    expect(config.questionCount).toBe(8);
    expect(config.questions[0]).toMatchObject({ title: '题', options: ['甲', '乙'] });
  });
  it('config.js 能被当作脚本执行并还原配置；题目里的 </script> 被转义', () => {
    const p = sampleProject();
    p.questions[0] = { ...p.questions[0], title: '危险</script><b>"x"\u2028' };
    const { config } = buildConfig(p);
    const js = configScript(config);
    expect(js).not.toContain('</script');
    expect(js).not.toContain('\u2028');
    const win: { QUIZ_CONFIG?: unknown } = {};
    new Function('window', js)(win);
    expect(win.QUIZ_CONFIG).toEqual(config);
  });
});

describe('导出 H5 流程（内存文件系统）', () => {
  it('写出 index.html、app.js、style.css、config.js、assets 与部署说明', async () => {
    const m = memFs();
    const r = await exportH5(m.io, withImages(), '/out', TEMPLATES);
    expect(r.dir).toBe('/out/示例奶茶店经营挑战-答题H5');
    expect(r.files.map((f) => f.path).sort()).toEqual(['app.js', 'assets/logo.png', 'assets/qr.jpg', 'config.js', 'index.html', 'style.css', '部署说明.txt'].sort());
    for (const f of r.files) expect(m.files.has(`${r.dir}/${f.path}`)).toBe(true);
    expect(m.text(`${r.dir}/index.html`)).toContain('<title>示例奶茶店经营挑战</title>');
    expect(m.text(`${r.dir}/index.html`)).toContain('src="config.js"');
    expect(m.text(`${r.dir}/app.js`)).toBe(TEMPLATES.appJs);
    expect([...m.files.get(`${r.dir}/assets/qr.jpg`)!]).toEqual([...png]);
    expect(m.text(`${r.dir}/config.js`)).toContain('"assets/logo.png"');
    expect(m.text(`${r.dir}/部署说明.txt`)).toContain('index.html');
  });
  it('没有图片时不建 assets 文件夹；品牌名里的非法字符不会进文件夹名', async () => {
    const m = memFs();
    const p = sampleProject();
    p.brand.name = '我的/店*';
    const r = await exportH5(m.io, p, '/out', fake);
    expect(r.dir).toBe('/out/我的 店-答题H5');
    expect([...m.dirs].some((d) => d.endsWith('assets'))).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('品牌名里的 HTML 符号在 title 里被转义', async () => {
    const m = memFs();
    const p = sampleProject();
    p.brand.name = '<b>店</b> & "我"';
    const r = await exportH5(m.io, p, '/out', fake);
    expect(m.text(`${r.dir}/index.html`)).toContain('<title>&lt;b&gt;店&lt;/b&gt; &amp; &quot;我&quot;</title>');
  });
  it('有错误时不写任何文件，并说明是哪一题', async () => {
    const m = memFs();
    const p = sampleProject();
    p.questions[2] = { ...p.questions[2], answer: -1 };
    await expect(exportH5(m.io, p, '/out', fake)).rejects.toThrow('第 3 题：没有设置正确答案');
    expect(m.files.size).toBe(0);
    expect(m.dirs.size).toBe(0);
  });
  it('题库为空时拒绝导出', async () => {
    const m = memFs();
    await expect(exportH5(m.io, { ...sampleProject(), questions: [] }, '/out', fake)).rejects.toThrow('题库是空的');
  });
  it('重复导出到同一位置会覆盖旧文件', async () => {
    const m = memFs();
    const r1 = await exportH5(m.io, sampleProject(), '/out', fake);
    const p = sampleProject();
    p.brand.tagline = '新的副标题';
    await exportH5(m.io, p, '/out', fake);
    expect(m.text(`${r1.dir}/config.js`)).toContain('新的副标题');
  });
});

describe('预览页面与模板产物', () => {
  it('预览页面是自包含的：样式、配置、脚本都内联，没有外部引用', () => {
    const html = buildPreviewHtml(withImages(), fake);
    expect(html).toContain('<style>body{}</style>');
    expect(html).toContain('window.QUIZ_CONFIG');
    expect(html).toContain('console.log(1)');
    expect(html).not.toContain('src="config.js"');
    expect(html).not.toContain('href="style.css"');
  });
  it('脚本里的 </script> 不会截断预览页面', () => {
    const html = buildPreviewHtml(sampleProject(), { ...fake, appJs: 'var s="</script>";' });
    expect(html).toContain('<\\/script>');
  });
  it('真实模板产物：包含答题程序的关键界面文字，并且没有带进参考项目的任何服务器信息', () => {
    expect(TEMPLATES.appJs.length).toBeGreaterThan(10_000);
    expect(TEMPLATES.styleCss.length).toBeGreaterThan(3000);
    expect(TEMPLATES.styleCss).toContain('.opt');
    expect(TEMPLATES.appJs).toContain('QUIZ_CONFIG');
    expect(TEMPLATES.appJs).toContain('经营诊断');
    expect(TEMPLATES.appJs).toContain('错题解析');
    expect(TEMPLATES.appJs).not.toMatch(/\/api\/|appSecret|AppSecret|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    expect(TEMPLATES.indexHtml).toContain('src="app.js"');
  });
});
