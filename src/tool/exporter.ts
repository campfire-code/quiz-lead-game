// 导出 H5：把题库与品牌填进模板，写成一个可以直接放到静态空间的文件夹。读写通过传入的函数，便于用内存文件系统测试。
import { checkConfig, hasError, type Issue } from '../../h5-template/src/core/check';
import type { QuizConfig } from '../../h5-template/src/core/types';
import { fromDataUrl, safeName, type Project } from './core';
import type { Templates } from './template';

export interface ExportIO {
  mkdir(path: string): Promise<void>;
  join(...parts: string[]): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeText(path: string, text: string): Promise<void>;
}

export interface Asset {
  path: string;
  bytes: Uint8Array;
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * 由项目生成 H5 用的配置。inline 为真时图片保持 data 地址（预览用），否则拆成 assets/ 下的文件。
 * 文字统一去掉首尾空白；段位按起始分数排序。
 */
export function buildConfig(project: Project, inline = false): { config: QuizConfig; assets: Asset[] } {
  const assets: Asset[] = [];
  const image = (url: string, base: string): string => {
    if (!url) return '';
    if (inline) return fromDataUrl(url) ? url : '';
    const img = fromDataUrl(url);
    if (!img) return '';
    const path = `assets/${base}.${img.ext}`;
    assets.push({ path, bytes: img.bytes });
    return path;
  };
  const b = project.brand;
  const config: QuizConfig = {
    version: 1,
    id: project.id,
    brand: {
      name: b.name.trim(),
      tagline: b.tagline.trim(),
      color: b.color.trim().toUpperCase(),
      logo: image(b.logo, 'logo'),
      qr: image(b.qr, 'qr'),
      ctaTitle: b.ctaTitle.trim(),
      ctaText: b.ctaText.trim(),
      qrHint: b.qrHint.trim(),
      shareUrl: b.shareUrl.trim(),
    },
    ranks: project.ranks.map((r) => ({ name: r.name.trim(), emoji: r.emoji.trim(), min: Math.round(Number(r.min)), desc: r.desc.trim() })).sort((a, c) => a.min - c.min),
    dims: project.dims.map((d) => ({ id: d.id, name: d.name.trim(), emoji: d.emoji.trim(), desc: d.desc.trim(), advice: d.advice.trim() })),
    questionCount: Math.max(1, Math.round(project.questionCount)),
    questions: project.questions.map((q) => ({ id: q.id, title: q.title.trim(), options: q.options.map((o) => o.trim()), answer: q.answer, explain: q.explain.trim(), dim: q.dim })),
  };
  return { config, assets };
}

/** config.js 的内容。把 < 转义掉，避免题目里的 </script> 破坏页面；行分隔符也转义 */
export function configScript(config: QuizConfig): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
  return `window.QUIZ_CONFIG = ${json};\n`;
}

export function pageHtml(tpl: Templates, config: QuizConfig): string {
  const name = escHtml(config.brand.name);
  return tpl.indexHtml.replace('<title>答题挑战</title>', `<title>${name}</title>\n<meta name="theme-color" content="${escHtml(config.brand.color)}">`);
}

/** 预览用：把样式、配置、脚本都内联成一个页面，放进 iframe 的 srcdoc */
export function buildPreviewHtml(project: Project, tpl: Templates): string {
  const { config } = buildConfig(project, true);
  const inlineJs = (js: string) => js.replace(/<\/script/gi, '<\\/script');
  return pageHtml(tpl, config)
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>${tpl.styleCss}</style>`)
    .replace('<script src="config.js"></script>', () => `<script>${inlineJs(configScript(config))}</script>`)
    .replace('<script src="app.js"></script>', () => `<script>${inlineJs(tpl.appJs)}</script>`);
}

export function deployNote(name: string): string {
  return `${name} · 答题 H5 部署说明
==============================

这个文件夹就是一个完整的手机网页，里面不需要任何服务器程序。

文件说明
  index.html   页面入口
  app.js       答题程序
  style.css    样式
  config.js    题库与品牌设置（由出题器生成，改题库请回到出题器重新导出）
  assets/      你上传的 Logo 和二维码图片（没上传就没有这个文件夹）

怎么用
  1. 想先看看效果：直接双击 index.html，用浏览器打开即可。
  2. 想给别人用：把整个文件夹上传到任意能放静态网页的地方（自己的服务器、
     对象存储的静态网站功能、Nginx 等），用手机打开 index.html 所在的网址。
  3. 分享海报里的二维码默认指向「当前页面的网址」，所以请放到正式网址后再生成海报。
     也可以在出题器的「品牌」里填写固定的分享链接。
  4. 排行榜和最高分只记录在每位玩家自己的手机浏览器里，不会上传，也不会汇总。

更新题库
  回到出题器改题库，重新点「导出 H5」，把新生成的文件覆盖到原位置即可。

篝火出品
`;
}

export interface ExportResult {
  dir: string;
  files: { path: string; size: number }[];
  warnings: string[];
}

/** 把检查结果里的错误整理成一句话，用于抛出 */
export function describeIssues(issues: readonly Issue[], max = 4): string {
  const errs = issues.filter((i) => i.level === 'error');
  const lines = errs.slice(0, max).map((i) => (i.no ? `第 ${i.no} 题：` : '') + i.text);
  return lines.join('；') + (errs.length > max ? `……共 ${errs.length} 处问题` : '');
}

export async function exportH5(io: ExportIO, project: Project, parentDir: string, tpl: Templates): Promise<ExportResult> {
  const { config, assets } = buildConfig(project);
  const issues = checkConfig(config);
  if (hasError(issues)) throw new Error('题库或品牌还有错误，先修正再导出：' + describeIssues(issues));
  const dir = await io.join(parentDir, `${safeName(config.brand.name)}-答题H5`);
  await io.mkdir(dir);
  const enc = new TextEncoder();
  const files: ExportResult['files'] = [];
  const text = async (name: string, content: string) => {
    await io.writeText(await io.join(dir, name), content);
    files.push({ path: name, size: enc.encode(content).length });
  };
  await text('index.html', pageHtml(tpl, config));
  await text('style.css', tpl.styleCss);
  await text('app.js', tpl.appJs);
  await text('config.js', configScript(config));
  if (assets.length) await io.mkdir(await io.join(dir, 'assets'));
  for (const a of assets) {
    await io.writeFile(await io.join(dir, ...a.path.split('/')), a.bytes);
    files.push({ path: a.path, size: a.bytes.length });
  }
  await text('部署说明.txt', deployNote(config.brand.name));
  return { dir, files, warnings: issues.filter((i) => i.level === 'warn').map((i) => (i.no ? `第 ${i.no} 题：` : '') + i.text) };
}
