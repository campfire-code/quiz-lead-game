// 题库的导入导出：只依赖传入的读写函数，便于用内存文件系统测试。
import { EXPORT_HEADER, fromJson, fromRows, mergeImport, toJson, toRows, type Project } from './core';
import { decodeText, readGrid, writeXlsx } from './xlsx';

export interface FileIO {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeText(path: string, text: string): Promise<void>;
}

export const IMPORT_EXT = ['xlsx', 'csv', 'json', 'txt'];
const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

/** 读一个文件并合并进题库，返回新项目与给用户看的一句话 */
export async function importFile(io: FileIO, project: Project, path: string): Promise<{ project: Project; message: string; added: number }> {
  const name = baseName(path);
  const bytes = await io.readFile(path);
  const parsed = /\.json$/i.test(name) ? fromJson(decodeText(bytes), project.dims) : fromRows(await readGrid(bytes, name), project.dims);
  if (!parsed.questions.length) throw new Error(`「${name}」里没有找到题目`);
  const r = mergeImport(project, parsed);
  const extra = [
    r.dup ? `${r.dup} 道重复已跳过` : '',
    parsed.skipped ? `${parsed.skipped} 个空行已跳过` : '',
    parsed.unknownDim ? `${parsed.unknownDim} 道题的所属维度对不上，已先归到「${project.dims[0].name}」，请检查` : '',
  ].filter(Boolean).join('，');
  return { project: r.project, added: r.added, message: `从「${name}」导入 ${r.added} 道题${extra ? '（' + extra + '）' : ''}` };
}

/** 导出题库：.json 为可读的题库文件，.xlsx 为表格（题目、选项 A～F、正确答案、解析、所属维度） */
export async function exportBank(io: FileIO, project: Project, path: string): Promise<string> {
  if (/\.json$/i.test(path)) await io.writeText(path, toJson(project.questions, project.dims));
  else await io.writeFile(path, await writeXlsx(EXPORT_HEADER, toRows(project.questions, project.dims), '题库'));
  return `已导出 ${project.questions.length} 道题到 ${path}`;
}
