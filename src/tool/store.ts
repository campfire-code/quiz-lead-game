// 出题项目保存在本机应用数据目录的 settings.json（kit 的 settingsStore），键名 project.w29。
import { settingsStore } from '../kit/platform';
import { validProject, type Project } from './core';
import { sampleProject } from './samples';

const KEY = 'project.w29';

const newProjectId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const freshSample = (): Project => ({ ...sampleProject(), id: newProjectId() });

/** 读取项目；第一次打开或读不到（例如开发预览）时用内置示例 */
export async function loadProject(): Promise<{ project: Project; saved: boolean }> {
  try {
    const v = validProject(await (await settingsStore()).get(KEY));
    if (v) return { project: v, saved: true };
  } catch {
    /* 预览环境没有本机存储 */
  }
  return { project: freshSample(), saved: false };
}

export async function saveProject(p: Project): Promise<boolean> {
  try {
    const st = await settingsStore();
    await st.set(KEY, p);
    await st.save();
    return true;
  } catch {
    return false;
  }
}

/** 题号以 s 加数字开头的是内置示例题 */
export const isSampleQuestion = (id: string) => /^s\d+$/.test(id);
