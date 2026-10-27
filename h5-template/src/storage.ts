// 本机存储：全部放在浏览器的 localStorage，读写失败（隐私模式等）时静默退化为只在内存里。
import { parseBoard } from './core/board';
import type { Answer, BoardRecord, Question, Shop } from './core/types';

export interface SavedGame {
  qs: Question[];
  idx: number;
  answers: Answer[];
  shop: Shop;
}

export function createStorage(id: string, backend: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocal()) {
  const key = (k: string) => `qlg:${id}:${k}`;
  const mem = new Map<string, string>();
  const get = (k: string): string | null => {
    try {
      return backend ? backend.getItem(key(k)) : (mem.get(k) ?? null);
    } catch {
      return mem.get(k) ?? null;
    }
  };
  const set = (k: string, v: string) => {
    mem.set(k, v);
    try {
      backend?.setItem(key(k), v);
    } catch {
      /* 存不下就只留在内存里 */
    }
  };
  const del = (k: string) => {
    mem.delete(k);
    try {
      backend?.removeItem(key(k));
    } catch {
      /* 忽略 */
    }
  };
  const json = <T>(k: string): T | null => {
    try {
      const s = get(k);
      return s ? (JSON.parse(s) as T) : null;
    } catch {
      return null;
    }
  };
  return {
    board: (): BoardRecord[] => parseBoard(json<unknown>('board')),
    saveBoard: (l: BoardRecord[]) => set('board', JSON.stringify(l)),
    seen: (): string[] => {
      const v = json<unknown>('seen');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    },
    saveSeen: (l: string[]) => set('seen', JSON.stringify(l.slice(-500))),
    best: (): number => Number(get('best')) || 0,
    saveBest: (n: number) => set('best', String(n)),
    name: (): string => get('name') ?? '',
    saveName: (s: string) => set('name', s),
    muted: (): boolean => get('muted') === '1',
    saveMuted: (m: boolean) => set('muted', m ? '1' : '0'),
    game: (): SavedGame | null => {
      const g = json<SavedGame>('game');
      return g && Array.isArray(g.qs) && Array.isArray(g.answers) && typeof g.idx === 'number' && g.qs[g.idx] ? g : null;
    },
    saveGame: (g: SavedGame) => set('game', JSON.stringify(g)),
    clearGame: () => del('game'),
  };
}

function safeLocal(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem('qlg:probe', '1');
    s.removeItem('qlg:probe');
    return s;
  } catch {
    return null;
  }
}

export type Store = ReturnType<typeof createStorage>;
