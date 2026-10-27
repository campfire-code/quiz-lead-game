// 品牌页：名称、主色、Logo 与二维码、引导文案、4 档段位、6 个维度。
import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { normalizeColor } from '../../h5-template/src/core/check';
import type { Dimension, RankLevel } from '../../h5-template/src/core/types';
import { pickFiles } from '../kit/platform';
import { imageDataUrl } from './core';
import type { Api } from './shared';

function Text({ label, value, onChange, placeholder, rows, help, id }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; help?: string; id: string }) {
  return (
    <div className="k-field">
      <label className="k-label" htmlFor={id}>{label}</label>
      {rows ? <textarea id={id} className="k-input k-textarea qz-sel" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /> : <input id={id} className="k-input qz-sel" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {help && <span className="k-help">{help}</span>}
    </div>
  );
}

export function BrandTab({ api }: { api: Api }) {
  const { project, commit, flash, ctx } = api;
  const b = project.brand;
  const setBrand = (p: Partial<typeof b>) => commit({ ...project, brand: { ...b, ...p } });
  const [hex, setHex] = useState(b.color);
  const setRank = (i: number, p: Partial<RankLevel>) => commit({ ...project, ranks: project.ranks.map((r, k) => (k === i ? { ...r, ...p } : r)) });
  const setDim = (i: number, p: Partial<Dimension>) => commit({ ...project, dims: project.dims.map((d, k) => (k === i ? { ...d, ...p } : d)) });

  const pickImage = async (key: 'logo' | 'qr') => {
    if (!ctx) return flash('err', '开发预览里不能选择文件');
    try {
      const [p] = await pickFiles(['png', 'jpg', 'jpeg', 'webp', 'gif'], '图片');
      if (!p) return;
      setBrand({ [key]: imageDataUrl(p, await ctx.readFile(p)) });
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    }
  };

  const Img = ({ k, label, help }: { k: 'logo' | 'qr'; label: string; help: string }) => (
    <div className="k-field">
      <span className="k-label">{label}</span>
      <div className="qz-img">
        <span className="qz-thumb">{b[k] ? <img src={b[k]} alt={label} /> : <ImagePlus size={20} />}</span>
        <button className="k-btn" onClick={() => pickImage(k)}>{b[k] ? '更换图片' : '选择图片'}</button>
        {b[k] && <button className="k-icon-btn" aria-label={`清除${label}`} onClick={() => setBrand({ [k]: '' })}><Trash2 size={14} /></button>}
      </div>
      <span className="k-help">{help}</span>
    </div>
  );

  return (
    <div className="qz-brand">
      <section className="k-panel qz-card">
        <h3>基本信息</h3>
        <div className="qz-grid">
          <Text id="b-name" label="品牌名称" value={b.name} onChange={(v) => setBrand({ name: v })} help="显示在首页、店铺招牌和海报上；招牌最多显示前 7 个字" />
          <Text id="b-tag" label="首页副标题" value={b.tagline} onChange={(v) => setBrand({ tagline: v })} />
          <div className="k-field">
            <label className="k-label" htmlFor="b-color">主色</label>
            <div className="qz-color">
              <input type="color" aria-label="选择主色" value={normalizeColor(hex) ?? '#F5A623'} onChange={(e) => { setHex(e.target.value.toUpperCase()); setBrand({ color: e.target.value.toUpperCase() }); }} />
              <input id="b-color" className="k-input qz-sel" value={hex} maxLength={7} onChange={(e) => { setHex(e.target.value); const c = normalizeColor(e.target.value); if (c) setBrand({ color: c }); }} aria-invalid={!normalizeColor(hex)} />
            </div>
            <span className="k-help">{normalizeColor(hex) ? '按钮、顶部背景和店铺的颜色；文字颜色会自动选黑或白' : '写成 #RRGGBB，例如 #F5A623'}</span>
          </div>
          <div className="k-field">
            <label className="k-label" htmlFor="b-count">每局题数</label>
            <input id="b-count" className="k-input" type="number" min={1} max={20} value={project.questionCount} onChange={(e) => commit({ ...project, questionCount: Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
            <span className="k-help">每次从题库里随机抽这么多题，1～20</span>
          </div>
          <Text id="b-share" label="分享链接（可不填）" value={b.shareUrl} onChange={(v) => setBrand({ shareUrl: v })} placeholder="https://" help="海报二维码指向这里；不填就指向页面自己的网址" />
        </div>
        <div className="qz-grid">
          <Img k="logo" label="Logo" help="png / jpg / webp / gif，不超过 2 MB；不选则只显示品牌名称" />
        </div>
      </section>

      <section className="k-panel qz-card">
        <h3>领奖页（答完后的引导）</h3>
        <div className="qz-grid">
          <Text id="b-cta" label="标题" value={b.ctaTitle} onChange={(v) => setBrand({ ctaTitle: v })} help="也是结果页底部主按钮上的字" />
          <Text id="b-hint" label="二维码下方的说明" value={b.qrHint} onChange={(v) => setBrand({ qrHint: v })} />
        </div>
        <Text id="b-text" label="引导文案" rows={4} value={b.ctaText} onChange={(v) => setBrand({ ctaText: v })} help="可以换行；说明添加微信后能领到什么" />
        <Img k="qr" label="结尾二维码图片" help="例如你的个人微信或企业微信二维码；不选则领奖页只显示引导文案" />
      </section>

      <section className="k-panel qz-card">
        <h3>段位（4 档）</h3>
        <p className="k-help">得分满分 100。「起始分数」是进入这一档的最低分，最低一档必须是 0。</p>
        <div className="qz-rows">
          {project.ranks.map((r, i) => (
            <div className="qz-rank" key={i}>
              <input className="k-input qz-sel qz-emoji" aria-label={`第 ${i + 1} 档图标`} value={r.emoji} maxLength={4} onChange={(e) => setRank(i, { emoji: e.target.value })} />
              <input className="k-input qz-sel" aria-label={`第 ${i + 1} 档名称`} value={r.name} placeholder="段位名称" onChange={(e) => setRank(i, { name: e.target.value })} />
              <input className="k-input qz-min" type="number" min={0} max={100} aria-label={`第 ${i + 1} 档起始分数`} value={r.min} onChange={(e) => setRank(i, { min: Number(e.target.value) })} />
              <input className="k-input qz-sel qz-wide" aria-label={`第 ${i + 1} 档说明`} value={r.desc} placeholder="结果页显示的说明" onChange={(e) => setRank(i, { desc: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="k-panel qz-card">
        <h3>维度（6 个，店铺的六项能力）</h3>
        <p className="k-help">每道题归到一个维度。答对后可以升级这些能力；结果页按维度统计正确率并给出建议。</p>
        <div className="qz-rows">
          {project.dims.map((d, i) => (
            <div className="qz-dimrow" key={d.id}>
              <input className="k-input qz-sel qz-emoji" aria-label={`维度 ${i + 1} 图标`} value={d.emoji} maxLength={4} onChange={(e) => setDim(i, { emoji: e.target.value })} />
              <input className="k-input qz-sel" aria-label={`维度 ${i + 1} 名称`} value={d.name} placeholder="维度名称" onChange={(e) => setDim(i, { name: e.target.value })} />
              <input className="k-input qz-sel qz-wide" aria-label={`维度 ${i + 1} 升级说明`} value={d.desc} placeholder="升级时显示，如：让顾客一眼看到你" onChange={(e) => setDim(i, { desc: e.target.value })} />
              <input className="k-input qz-sel qz-wide" aria-label={`维度 ${i + 1} 诊断建议`} value={d.advice} placeholder="这项答得不好时给的建议" onChange={(e) => setDim(i, { advice: e.target.value })} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
