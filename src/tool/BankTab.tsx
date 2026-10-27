// 题库页：左边题目清单（可按维度筛选），右边编辑区。导入导出 Excel / JSON。
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Download, FilePlus2, Plus, Trash2, Upload, X } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { checkQuestions } from '../../h5-template/src/core/check';
import { MAX_OPTIONS, MIN_OPTIONS, type Question } from '../../h5-template/src/core/types';
import { onFileDrop, pickFiles } from '../kit/platform';
import { blankQuestion, newId, type Project } from './core';
import { exportBank, importFile, IMPORT_EXT, type FileIO } from './io';
import type { Api } from './shared';
import { isSampleQuestion } from './store';

const LETTERS = 'ABCDEF';

export function BankTab({ api }: { api: Api }) {
  const { project, commit, flash, ctx } = api;
  const [dim, setDim] = useState('');
  const [selId, setSelId] = useState(project.questions[0]?.id ?? '');
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | { text: string; ok: string; run: () => void }>(null);
  const projRef = useRef(project);
  projRef.current = project;

  const issues = useMemo(() => checkQuestions(project.questions, project.dims), [project.questions, project.dims]);
  const issuesOf = (no: number) => issues.filter((i) => i.no === no);
  const list = project.questions.map((q, i) => ({ q, no: i + 1 })).filter((x) => !dim || x.q.dim === dim);
  const cur = project.questions.find((q) => q.id === selId) ?? list[0]?.q;
  const curNo = cur ? project.questions.indexOf(cur) + 1 : 0;
  const samples = project.questions.filter((q) => isSampleQuestion(q.id)).length;
  const errCount = new Set(issues.filter((i) => i.level === 'error').map((i) => i.no)).size;

  const patch = (id: string, p: Partial<Question>) => commit({ ...project, questions: project.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) });

  const add = () => {
    const q = blankQuestion(dim || project.dims[0].id);
    commit({ ...project, questions: [...project.questions, q] });
    setSelId(q.id);
  };
  const remove = (id: string) => {
    const i = project.questions.findIndex((q) => q.id === id);
    const rest = project.questions.filter((q) => q.id !== id);
    commit({ ...project, questions: rest });
    setSelId(rest[Math.min(i, rest.length - 1)]?.id ?? '');
  };
  const duplicate = (q: Question) => {
    const copy = { ...q, id: newId(), options: [...q.options], title: q.title + '（副本）' };
    const i = project.questions.indexOf(q);
    commit({ ...project, questions: [...project.questions.slice(0, i + 1), copy, ...project.questions.slice(i + 1)] });
    setSelId(copy.id);
  };

  const io: FileIO | null = ctx ? { readFile: ctx.readFile, writeFile: ctx.writeFile, writeText: ctx.writeText } : null;

  const importPaths = async (paths: string[]) => {
    if (!io) return flash('err', '开发预览里不能导入文件');
    let next: Project = projRef.current;
    const msgs: string[] = [];
    let added = 0;
    for (const p of paths) {
      try {
        const r = await importFile(io, next, p);
        next = r.project;
        added += r.added;
        msgs.push(r.message);
      } catch (e) {
        msgs.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (next !== projRef.current) commit(next);
    flash(added ? 'ok' : 'err', msgs.join('；'));
  };
  const importRef = useRef(importPaths);
  importRef.current = importPaths;
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    try {
      onFileDrop((paths) => {
        const ok = paths.filter((p) => new RegExp(`\\.(${IMPORT_EXT.join('|')})$`, 'i').test(p));
        if (ok.length) importRef.current(ok);
        else flash('err', `只支持导入 ${IMPORT_EXT.join(' / ')} 文件`);
      })
        .then((u) => (dead ? u() : (off = u)))
        .catch(() => {});
    } catch {
      /* 预览环境 */
    }
    return () => {
      dead = true;
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doExport = async (fmt: 'xlsx' | 'json', blank = false) => {
    setMenu(false);
    if (!io) return flash('err', '开发预览里不能导出文件');
    try {
      const name = blank ? '题库模板' : '题库';
      const path = await save({ defaultPath: `${name}.${fmt}`, filters: [{ name: fmt === 'xlsx' ? 'Excel 表格' : 'JSON 题库', extensions: [fmt] }] });
      if (!path) return;
      const src = blank ? { ...project, questions: project.questions.slice(0, 2) } : project;
      const msg = await exportBank(io, src, path);
      flash('ok', blank ? `已导出带 2 道示范题的模板到 ${path}` : msg, path);
    } catch (e) {
      flash('err', `导出失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setOption = (q: Question, i: number, text: string) => patch(q.id, { options: q.options.map((o, k) => (k === i ? text : o)) });
  const addOption = (q: Question) => q.options.length < MAX_OPTIONS && patch(q.id, { options: [...q.options, ''] });
  const dropOption = (q: Question, i: number) => {
    if (q.options.length <= MIN_OPTIONS) return;
    const answer = q.answer === i ? -1 : q.answer > i ? q.answer - 1 : q.answer;
    patch(q.id, { options: q.options.filter((_, k) => k !== i), answer });
  };

  return (
    <div className="qz-bank">
      <div className="qz-bar">
        <button className="k-btn primary" onClick={add}><Plus size={15} />新增题目</button>
        <button className="k-btn" onClick={async () => { const p = await pickFiles(IMPORT_EXT, '题库文件').catch(() => []); if (p.length) importPaths(p); }}><Upload size={15} />导入</button>
        <span className="qz-menu-wrap">
          <button className="k-btn" aria-expanded={menu} onClick={() => setMenu(!menu)}><Download size={15} />导出</button>
          {menu && (
            <span className="qz-menu k-panel" role="menu">
              <button role="menuitem" onClick={() => doExport('xlsx')}><b>导出 Excel</b><small>题目、选项 A～F、正确答案、解析、所属维度</small></button>
              <button role="menuitem" onClick={() => doExport('json')}><b>导出 JSON</b><small>答案写字母、维度写名称，方便手写和程序处理</small></button>
              <button role="menuitem" onClick={() => doExport('xlsx', true)}><b>导出 Excel 模板</b><small>带 2 道示范题，照着格式填好再导入</small></button>
            </span>
          )}
        </span>
        <span className="k-muted qz-count">共 {project.questions.length} 题{errCount ? `，${errCount} 题有问题` : ''}</span>
      </div>

      {samples > 0 && (
        <div className="qz-tip">
          <span>现在是<b>内置示例题库</b>（虚构的奶茶店经营题），可以直接改成自己的行业，或导入已有的 Excel。</span>
          <button className="k-link" onClick={() => setConfirm({ text: `删除全部 ${samples} 道示例题？你自己新增或导入的题不受影响。`, ok: '删除示例题', run: () => { commit({ ...project, questions: project.questions.filter((q) => !isSampleQuestion(q.id)) }); setSelId(''); } })}>删除全部示例题</button>
        </div>
      )}

      <div className="qz-dims" role="tablist" aria-label="按维度筛选">
        <button role="tab" aria-selected={dim === ''} className={`k-chip${dim === '' ? ' on' : ''}`} onClick={() => setDim('')}>全部 {project.questions.length}</button>
        {project.dims.map((d) => (
          <button key={d.id} role="tab" aria-selected={dim === d.id} className={`k-chip${dim === d.id ? ' on' : ''}`} onClick={() => setDim(d.id)}>{d.emoji} {d.name} {project.questions.filter((q) => q.dim === d.id).length}</button>
        ))}
      </div>

      <div className="qz-body">
        <section className="qz-list" aria-label="题目清单">
          {!list.length ? (
            <div className="qz-empty"><b>{project.questions.length ? '这个维度下还没有题' : '题库是空的'}</b><span className="k-muted">点「新增题目」写第一道，或「导入」已有的 Excel / JSON</span></div>
          ) : (
            <ul>
              {list.map(({ q, no }) => {
                const bad = issuesOf(no).some((i) => i.level === 'error');
                return (
                  <li key={q.id}>
                    <button className={`qz-row${cur?.id === q.id ? ' sel' : ''}`} onClick={() => setSelId(q.id)}>
                      <span className="qz-no">{no}</span>
                      <span className="qz-title">{q.title || '（还没写题目）'}</span>
                      {bad && <AlertTriangle size={14} className="qz-warn" aria-label="这道题有问题" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="qz-edit k-panel" aria-label="编辑题目">
          {!cur ? (
            <div className="qz-empty"><FilePlus2 size={22} /><span className="k-muted">选一道题开始编辑</span></div>
          ) : (
            <div className="qz-form">
              <div className="k-field">
                <label className="k-label" htmlFor="qz-title">第 {curNo} 题 · 题目</label>
                <textarea id="qz-title" className="k-input k-textarea qz-sel" rows={2} value={cur.title} placeholder="例如：新店选址时，最应该先观察的是什么？" onChange={(e) => patch(cur.id, { title: e.target.value })} />
              </div>
              <div className="k-field">
                <span className="k-label">选项（点左边的圆圈设为正确答案）</span>
                <div className="qz-opts">
                  {cur.options.map((o, i) => (
                    <div className="qz-opt" key={i}>
                      <button type="button" role="radio" aria-checked={cur.answer === i} aria-label={`设选项 ${LETTERS[i]} 为正确答案`} className={`qz-radio${cur.answer === i ? ' on' : ''}`} onClick={() => patch(cur.id, { answer: i })}>{LETTERS[i]}</button>
                      <input className="k-input qz-sel" value={o} placeholder={`选项 ${LETTERS[i]}`} aria-label={`选项 ${LETTERS[i]}`} onChange={(e) => setOption(cur, i, e.target.value)} />
                      <button type="button" className="k-icon-btn" aria-label={`删除选项 ${LETTERS[i]}`} disabled={cur.options.length <= MIN_OPTIONS} onClick={() => dropOption(cur, i)}><X size={14} /></button>
                    </div>
                  ))}
                </div>
                {cur.options.length < MAX_OPTIONS && <button type="button" className="k-link qz-addopt" onClick={() => addOption(cur)}><Plus size={13} />增加选项（最多 {MAX_OPTIONS} 个）</button>}
              </div>
              <div className="k-field">
                <label className="k-label" htmlFor="qz-exp">解析（答完后显示，错题解析里也会用到）</label>
                <textarea id="qz-exp" className="k-input k-textarea qz-sel" rows={3} value={cur.explain} placeholder="说明为什么选这个答案" onChange={(e) => patch(cur.id, { explain: e.target.value })} />
              </div>
              <div className="k-field">
                <label className="k-label" htmlFor="qz-dim">所属维度（决定诊断统计和升级项）</label>
                <select id="qz-dim" className="k-input" value={cur.dim} onChange={(e) => patch(cur.id, { dim: e.target.value })}>
                  {project.dims.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
                </select>
              </div>
              {issuesOf(curNo).length > 0 && (
                <ul className="qz-issues" aria-label="这道题的问题">
                  {issuesOf(curNo).map((i, k) => <li key={k} className={i.level}>{i.level === 'error' ? '错误' : '提醒'}：{i.text}</li>)}
                </ul>
              )}
              <div className="qz-foot">
                <button className="k-btn" onClick={() => duplicate(cur)}><Copy size={14} />复制这题</button>
                <button className="k-btn qz-danger-text" onClick={() => setConfirm({ text: `删除第 ${curNo} 题？`, ok: '删除', run: () => remove(cur.id) })}><Trash2 size={14} />删除</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {confirm && (
        <div className="qz-mask" role="presentation" onClick={() => setConfirm(null)}>
          <div className="qz-dialog k-panel" role="alertdialog" aria-label="确认" onClick={(e) => e.stopPropagation()}>
            <p>{confirm.text}</p>
            <div className="qz-dialog-ft">
              <button className="k-btn" onClick={() => setConfirm(null)}>取消</button>
              <button className="k-btn primary" autoFocus onClick={() => { confirm.run(); setConfirm(null); }}>{confirm.ok}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
