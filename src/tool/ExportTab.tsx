// 导出页：检查结果、手机页面预览、导出成文件夹。
import { useMemo, useState } from 'react';
import { CheckCircle2, FolderOpen, Rocket, TriangleAlert, XCircle } from 'lucide-react';
import { checkConfig, hasError } from '../../h5-template/src/core/check';
import { pickFolder, reveal } from '../kit/platform';
import { buildConfig, buildPreviewHtml, describeIssues, exportH5, type ExportResult } from './exporter';
import type { Api } from './shared';
import { TEMPLATES } from './template';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function ExportTab({ api }: { api: Api }) {
  const { project, flash, ctx } = api;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ExportResult | null>(null);
  const issues = useMemo(() => checkConfig(buildConfig(project).config), [project]);
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const html = useMemo(() => buildPreviewHtml(project, TEMPLATES), [project]);

  const run = async () => {
    if (!ctx) return flash('err', '开发预览里不能导出文件');
    setBusy(true);
    try {
      const parent = await pickFolder();
      if (!parent) return;
      const r = await exportH5(ctx, project, parent, TEMPLATES);
      setDone(r);
      flash('ok', `已导出 ${r.files.length} 个文件到 ${r.dir}`, r.dir);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const n = project.questions.length;
  return (
    <div className="qz-export">
      <section className="qz-side">
        <div className="k-panel qz-card">
          <h3>导出前检查</h3>
          <p className="k-muted">{n} 道题 · 每局抽 {Math.min(project.questionCount, n)} 题 · 品牌「{project.brand.name || '未命名'}」</p>
          {!issues.length && <p className="qz-ok"><CheckCircle2 size={16} />没有发现问题，可以导出。</p>}
          {errors.length > 0 && <p className="qz-bad"><XCircle size={16} />有 {errors.length} 处错误，修正后才能导出</p>}
          <ul className="qz-checks">
            {errors.slice(0, 8).map((i, k) => <li key={'e' + k} className="error">{i.no ? `第 ${i.no} 题：` : ''}{i.text}</li>)}
            {errors.length > 8 && <li className="error">……还有 {errors.length - 8} 处，请到「题库」页逐题查看</li>}
            {warns.slice(0, 6).map((i, k) => <li key={'w' + k} className="warn"><TriangleAlert size={13} />{i.no ? `第 ${i.no} 题：` : ''}{i.text}</li>)}
            {warns.length > 6 && <li className="warn">……还有 {warns.length - 6} 条提醒</li>}
          </ul>
          <button className="k-btn primary big" disabled={busy || hasError(issues)} title={hasError(issues) ? describeIssues(issues) : ''} onClick={run}><Rocket size={16} />{busy ? '正在导出…' : '导出 H5'}</button>
          <span className="k-help">选一个文件夹，会在里面生成「品牌名-答题H5」文件夹，包含 index.html 与全部资源。</span>
        </div>

        {done && (
          <div className="k-panel qz-card" aria-live="polite">
            <h3>已导出</h3>
            <button className="k-link" onClick={() => reveal(done.dir)}><FolderOpen size={14} />在文件夹中显示</button>
            <ul className="qz-files">
              {done.files.map((f) => <li key={f.path}><span>{f.path}</span><span className="k-muted">{kb(f.size)}</span></li>)}
            </ul>
            <p className="k-help">整个文件夹上传到任何能放静态网页的地方即可使用；双击 index.html 也能直接看效果。详见文件夹里的「部署说明.txt」。</p>
          </div>
        )}
      </section>

      <section className="qz-phone-wrap" aria-label="手机页面预览">
        <div className="qz-phone">
          <iframe title="手机页面预览" sandbox="allow-scripts" srcDoc={html} />
        </div>
        <span className="k-help">预览：和导出的页面完全一样，可以直接点着玩（预览里不保存记录）。</span>
      </section>
    </div>
  );
}
