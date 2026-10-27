// H5 模板的构建产物（由 h5-template 构建出 dist/app.js 与 dist/style.css），打进出题器里，导出时填入题库与品牌。
import appJs from '../../h5-template/dist/app.js?raw';
import styleCss from '../../h5-template/dist/style.css?raw';
import indexHtml from '../../h5-template/index.html?raw';

export interface Templates {
  indexHtml: string;
  appJs: string;
  styleCss: string;
}

export const TEMPLATES: Templates = { indexHtml, appJs, styleCss };
