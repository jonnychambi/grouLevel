import { useSyncExternalStore } from 'react';
import { storage } from '../services/storage';

/**
 * Store persistido en localStorage y sincronizado entre componentes y pestañas.
 * Evita contextos/proveedores para estado simple de usuario (comparador, favoritos, historial).
 */
export function createPersistentStore<T>(key: string, initial: T) {
  let state: T = storage.get<T>(key, initial);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === `groulevel:${key}`) {
        state = storage.get<T>(key, initial);
        emit();
      }
    });
  }

  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      storage.set(key, state);
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    use(): T {
      return useSyncExternalStore(this.subscribe, this.get, this.get);
    }
  };
}
