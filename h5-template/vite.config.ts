// 把 H5 模板构建成 dist/app.js 和 dist/style.css（普通脚本，不用模块，所以双击 index.html 也能打开）。
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  logLevel: 'warn',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    minify: true,
    cssCodeSplit: false,
    lib: { entry: 'src/main.ts', formats: ['iife'], name: 'QuizApp', fileName: () => 'app.js', cssFileName: 'style' },
  },
});
