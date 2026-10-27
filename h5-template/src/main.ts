import './style.css';
import { startApp } from './app';
import { checkConfig, hasError } from './core/check';
import type { QuizConfig } from './core/types';
import { createSound } from './sound';
import { createStorage } from './storage';
import { esc } from './ui';

declare global {
  interface Window {
    QUIZ_CONFIG?: QuizConfig;
  }
}

const root = document.getElementById('app')!;
const cfg = window.QUIZ_CONFIG;

if (!cfg || hasError(checkConfig(cfg))) {
  const why = cfg ? checkConfig(cfg).filter((i) => i.level === 'error').map((i) => (i.no ? `第 ${i.no} 题：` : '') + i.text).slice(0, 5) : ['没有找到题库配置（config.js）'];
  root.innerHTML = `<main class="page"><section class="card"><h2>页面还不能使用</h2><p>题库或品牌设置有问题，请回到出题器修正后重新导出：</p><ul>${why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></section></main>`;
} else {
  const store = createStorage(cfg.id);
  const link = () => cfg.brand.shareUrl.trim() || location.href.split('#')[0].replace(/index\.html$/, '');
  startApp({ cfg, root, store, sound: createSound(store.muted), rng: Math.random, link });
}
