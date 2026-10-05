import { useCallback } from 'react';
import { STORAGE_KEYS } from '../services/storage';
import { createPersistentStore } from './usePersistentStore';

export const favoritesStore = createPersistentStore<string[]>(STORAGE_KEYS.favorites, []);

export function useFavorites() {
  const ids = favoritesStore.use();
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string): boolean => {
    const current = favoritesStore.get();
    const added = !current.includes(id);
    favoritesStore.set(added ? [id, ...current] : current.filter((x) => x !== id));
    return added;
  }, []);
  return { ids, has, toggle, count: ids.length };
}
