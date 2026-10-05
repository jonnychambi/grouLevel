import { useCallback } from 'react';
import { SITE } from '../config/site';
import { STORAGE_KEYS } from '../services/storage';
import { createPersistentStore } from './usePersistentStore';

export const compareStore = createPersistentStore<string[]>(STORAGE_KEYS.compare, []);

export type CompareToggleResult = 'added' | 'removed' | 'full';

/** Selección de programas para comparar (máx. 3), persistida en localStorage. */
export function useCompare() {
  const ids = compareStore.use();
  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string): CompareToggleResult => {
    const current = compareStore.get();
    if (current.includes(id)) {
      compareStore.set(current.filter((x) => x !== id));
      return 'removed';
    }
    if (current.length >= SITE.maxCompare) return 'full';
    compareStore.set([...current, id]);
    return 'added';
  }, []);

  const remove = useCallback((id: string) => compareStore.set((c) => c.filter((x) => x !== id)), []);
  const clear = useCallback(() => compareStore.set([]), []);
  const replace = useCallback((next: string[]) => compareStore.set(next.slice(0, SITE.maxCompare)), []);

  return { ids, count: ids.length, max: SITE.maxCompare, isFull: ids.length >= SITE.maxCompare, has, toggle, remove, clear, replace };
}
