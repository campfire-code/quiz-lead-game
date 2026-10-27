// 分享海报：在画布上直接画出来，得到一张图片，用户长按保存或点保存按钮。二维码指向活动网址。
import QRCode from 'qrcode';
import type { Dimension, QuizConfig, RankLevel, Shop } from './core/types';
import { MAX_DIM_LEVEL } from './core/types';
import { mix, readableOn } from './core/check';
import { safeSrc } from './ui';

export interface PosterInput {
  cfg: QuizConfig;
  score: number;
  correct: number;
  total: number;
  rank: RankLevel;
  shop: Shop;
  link: string;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const FONT = '"PingFang SC","Microsoft YaHei",sans-serif';

/** 海报文字太长时按宽度截断并加省略号 */
function fit(c: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (c.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && c.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

export async function drawPoster(inp: PosterInput): Promise<string> {
  const { cfg, rank } = inp;
  const color = cfg.brand.color;
  const on = readableOn(color);
  const W = 640;
  const H = 1120;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  c.fillStyle = color;
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.12;
  c.fillStyle = '#FFFFFF';
  c.beginPath();
  c.arc(560, 90, 130, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(70, 230, 70, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.textAlign = 'center';

  const logo = await loadImg(safeSrc(cfg.brand.logo));
  let top = 70;
  if (logo) {
    const h = 56;
    const w = Math.min(200, (logo.width / logo.height) * h);
    c.drawImage(logo, (W - w) / 2, 40, w, h);
    top = 128;
  }
  c.fillStyle = on;
  c.font = `800 26px ${FONT}`;
  c.fillText(fit(c, cfg.brand.name, W - 80), W / 2, top);
  c.font = `900 40px ${FONT}`;
  c.fillText('我的挑战成绩', W / 2, top + 54);

  const cardY = top + 84;
  c.fillStyle = '#FFFFFF';
  rr(c, 36, cardY, W - 72, 540, 28);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.arc(W / 2, cardY + 96, 70, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = on;
  c.font = `900 56px ${FONT}`;
  c.fillText(String(inp.score), W / 2, cardY + 114);
  c.font = `700 16px ${FONT}`;
  c.fillText('分', W / 2, cardY + 140);
  c.fillStyle = '#111111';
  c.font = `900 32px ${FONT}`;
  c.fillText(`${rank.emoji} ${fit(c, rank.name, 360)}`, W / 2, cardY + 210);
  c.fillStyle = '#777777';
  c.font = `500 18px ${FONT}`;
  c.fillText(`答对 ${inp.correct} / ${inp.total} 题`, W / 2, cardY + 242);

  const dims: Dimension[] = cfg.dims;
  const x0 = 120;
  const bw = 330;
  dims.forEach((d, i) => {
    const y = cardY + 282 + i * 40;
    const v = inp.shop[d.id] ?? 0;
    c.textAlign = 'right';
    c.fillStyle = '#555555';
    c.font = `500 18px ${FONT}`;
    c.fillText(fit(c, d.name, 80), x0 - 8, y + 14);
    c.fillStyle = '#EEEEEE';
    rr(c, x0, y, bw, 18, 9);
    c.fill();
    if (v > 0) {
      c.fillStyle = color;
      rr(c, x0, y, Math.max(18, (v / MAX_DIM_LEVEL) * bw), 18, 9);
      c.fill();
    }
    c.textAlign = 'left';
    c.fillStyle = '#333333';
    c.font = `700 16px ${FONT}`;
    c.fillText(`${v}/${MAX_DIM_LEVEL}`, x0 + bw + 10, y + 15);
  });
  c.textAlign = 'center';

  const qrY = cardY + 540 + 24;
  c.fillStyle = mix(color, 0.85);
  rr(c, 36, qrY, W - 72, H - qrY - 36, 28);
  c.fill();
  c.fillStyle = '#111111';
  c.font = `800 24px ${FONT}`;
  c.fillText('你能超过我吗？扫码来挑战', W / 2, qrY + 48);
  try {
    const qr = await loadImg(await QRCode.toDataURL(inp.link, { width: 320, margin: 1, errorCorrectionLevel: 'M' }));
    if (qr) {
      c.fillStyle = '#FFFFFF';
      rr(c, W / 2 - 96, qrY + 68, 192, 192, 12);
      c.fill();
      c.drawImage(qr, W / 2 - 88, qrY + 76, 176, 176);
    }
  } catch {
    c.fillStyle = '#777777';
    c.font = `500 15px ${FONT}`;
    c.fillText(fit(c, inp.link, W - 120), W / 2, qrY + 160);
  }
  c.fillStyle = '#777777';
  c.font = `500 16px ${FONT}`;
  c.fillText('长按识别二维码，开始答题', W / 2, qrY + 292);
  return canvas.toDataURL('image/png');
}
