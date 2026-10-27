// 页面小工具：转义、文字换行。所有来自配置的文字都必须经过 esc 再放进页面。
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const multiline = (s: string) => esc(s).replace(/\r?\n/g, '<br>');

/** 图片地址只允许相对路径、http(s) 和 data:image，其余（如 javascript:）一律不用 */
export function safeSrc(s: string): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  if (/^(https?:|data:image\/|\.?\/?[\w\-./%]+$)/i.test(v) && !/^\s*javascript:/i.test(v)) return v;
  return '';
}
