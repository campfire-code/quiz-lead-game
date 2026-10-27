import type { RunContext } from '../kit/types';
import type { Project } from './core';

export type Ctx = Pick<RunContext, 'readFile' | 'readText' | 'writeFile' | 'writeText' | 'mkdir' | 'join'>;

export interface Api {
  project: Project;
  commit: (next: Project) => void;
  flash: (kind: 'ok' | 'err', text: string, path?: string) => void;
  ctx: Ctx | undefined;
}
