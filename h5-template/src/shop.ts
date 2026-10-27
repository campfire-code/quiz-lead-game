// 店铺画面：用 SVG 画一家小店，升级越多，装饰越多。颜色跟随品牌主色。
import type { Dimension, Shop } from './core/types';
import { MAX_DIM_LEVEL } from './core/types';
import { mix, readableOn } from './core/check';
import { shopLevel } from './core/quiz';
import { esc } from './ui';

export function shopSvg(name: string, color: string, shop: Shop, compact = false): string {
  const total = shopLevel(shop);
  const on = readableOn(color);
  const dark = mix(color, -0.25);
  const light = mix(color, 0.6);
  const label = name.trim().slice(0, 7) || '我的小店';
  const size = label.length > 5 ? 17 : label.length > 3 ? 20 : 24;
  const stripes = Array.from({ length: 8 }, (_, i) => `<rect x="${52 + i * 27}" y="62" width="27" height="26" fill="${i % 2 ? '#FFFFFF' : color}"/>`).join('');
  const people = Math.min(6, Math.floor(total / 3));
  const crowd = Array.from({ length: people }, (_, i) => {
    const x = 262 + (i % 3) * 18 - (i > 2 ? 9 : 0);
    const y = i > 2 ? 160 : 168;
    return `<circle cx="${x}" cy="${y - 14}" r="5" fill="#F2C9A0"/><rect x="${x - 5}" y="${y - 9}" width="10" height="14" rx="4" fill="${i % 2 ? dark : '#5B6B8C'}"/>`;
  }).join('');
  const plants = total >= 5 ? `<rect x="30" y="150" width="14" height="18" rx="3" fill="#B0713D"/><circle cx="37" cy="146" r="11" fill="#5BAE5B"/><rect x="276" y="150" width="0" height="0"/>` : '';
  const bulbs = total >= 2 ? Array.from({ length: 9 }, (_, i) => `<circle cx="${60 + i * 25}" cy="94" r="3" fill="${total >= 10 ? '#FFE680' : '#E8E0C8'}"/>`).join('') : '';
  const star = total >= 20 ? `<polygon points="160,4 166,20 183,20 169,30 175,46 160,36 145,46 151,30 137,20 154,20" fill="#FFC928" stroke="#E0A800" stroke-width="1.5"/>` : '';
  const flag = total >= 8 ? `<line x1="290" y1="60" x2="290" y2="34" stroke="#6B6B6B" stroke-width="2"/><polygon points="290,34 312,41 290,48" fill="${color}"/>` : '';
  return `<svg class="shop-svg${compact ? ' compact' : ''}" viewBox="0 0 320 180" role="img" aria-label="${esc(label)}，店铺等级 ${total}">
<ellipse cx="160" cy="171" rx="150" ry="7" fill="rgba(0,0,0,.08)"/>
${star}${flag}
<rect x="46" y="86" width="228" height="82" rx="6" fill="#FFFDF7" stroke="${dark}" stroke-width="2"/>
<rect x="52" y="34" width="216" height="30" rx="8" fill="${dark}"/>
<text x="160" y="55" text-anchor="middle" font-size="${size}" font-weight="800" fill="${readableOn(dark)}" font-family="PingFang SC,Microsoft YaHei,sans-serif">${esc(label)}</text>
<g>${stripes}</g>${bulbs}
<rect x="74" y="104" width="86" height="46" rx="4" fill="${light}" stroke="${dark}" stroke-width="2"/>
<rect x="188" y="104" width="52" height="64" rx="4" fill="${color}" stroke="${dark}" stroke-width="2"/>
<circle cx="230" cy="138" r="3" fill="${on}"/>
${total >= 1 ? '<circle cx="96" cy="128" r="9" fill="#FFFFFF" opacity=".85"/><circle cx="124" cy="132" r="9" fill="#FFFFFF" opacity=".65"/>' : ''}
${plants}${crowd}
</svg>`;
}

export function dimBars(dims: readonly Dimension[], shop: Shop, color: string): string {
  return dims
    .map((d) => {
      const v = shop[d.id] ?? 0;
      return `<div class="dbar"><span class="dn">${esc(d.emoji)} ${esc(d.name)}</span><span class="track"><i style="width:${(v / MAX_DIM_LEVEL) * 100}%;background:${color}"></i></span><span class="dv">${v}/${MAX_DIM_LEVEL}</span></div>`;
    })
    .join('');
}
