// 出题器主界面：三个页签 —— 题库 / 品牌 / 导出 H5。项目自动保存在本机。
import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, Palette, Rocket, X } from 'lucide-react';
import { reveal } from '../kit/platform';
import { BankTab } from './BankTab';
import { BrandTab } from './BrandTab';
import type { Project } from './core';
import { ExportTab } from './ExportTab';
import type { Api, Ctx } from './shared';
import { freshSample, loadProject, saveProject } from './store';
import './tool.css';

type Tab = 'bank' | 'brand' | 'export';
const TABS: [Tab, string, typeof Rocket][] = [['bank', '题库', BookOpenCheck], ['brand', '品牌', Palette], ['export', '导出 H5', Rocket]];

export function Maker({ ctx }: { ctx: Ctx | undefined }) {
  const [project, setProject] = useState<Project>(freshSample);
  // 开发预览里可以用 ?tab=brand 直接打开某个页签
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(location.search).get('tab');
    return t === 'brand' || t === 'export' ? t : 'bank';
  });
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string; path?: string } | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    loadProject().then(({ project, saved }) => {
      setProject(project);
      ready.current = true;
      if (!saved) saveProject(project);
    });
  }, []);

  const flash = (kind: 'ok' | 'err', text: string, path?: string) => setToast({ kind, text, path });
  useEffect(() => {
    if (!toast || toast.kind === 'err' || toast.path) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const commit = (next: Project) => {
    setProject(next);
    saveProject(next).then((ok) => !ok && ctx && flash('err', '保存失败：无法写入本机存储'));
  };
  const api: Api = { project, commit, flash, ctx };

  return (
    <div className="qz">
      <div className="qz-tabs" role="tablist">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`qz-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}><Icon size={15} />{label}</button>
        ))}
      </div>
      {toast && (
        <div className={`k-notice ${toast.kind}`} role={toast.kind === 'err' ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          {toast.path && <button className="k-link" onClick={() => reveal(toast.path!)}>在文件夹中显示</button>}
          <button className="k-icon-btn" aria-label="关闭提示" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
      {tab === 'bank' && <BankTab api={api} />}
      {tab === 'brand' && <BrandTab api={api} />}
      {tab === 'export' && <ExportTab api={api} />}
    </div>
  );
}
