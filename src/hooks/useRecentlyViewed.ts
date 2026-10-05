import { useCallback } from 'react';
import { STORAGE_KEYS } from '../services/storage';
import { createPersistentStore } from './usePersistentStore';

const MAX_RECENT = 8;
export const recentStore = createPersistentStore<string[]>(STORAGE_KEYS.recent, []);

export function useRecentlyViewed() {
  const ids = recentStore.use();
  const push = useCallback((id: string) => {
    recentStore.set((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT));
  }, []);
  const clear = useCallback(() => recentStore.set([]), []);
  return { ids, push, clear };
}
