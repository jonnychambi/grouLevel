/**
 * Wrapper seguro de localStorage (modo privado, cuota llena, SSR).
 * Todas las claves van prefijadas para evitar colisiones.
 */
const PREFIX = 'groulevel:';

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = globalThis.localStorage?.getItem(PREFIX + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('groulevel:storage', { detail: { key } }));
    } catch {
      /* almacenamiento no disponible: la app sigue funcionando sin persistencia */
    }
  },
  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(PREFIX + key);
    } catch {
      /* noop */
    }
  }
};

export const sessionStore = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = globalThis.sessionStorage?.getItem(PREFIX + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      globalThis.sessionStorage?.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* noop */
    }
  }
};

export const STORAGE_KEYS = {
  compare: 'compare',
  favorites: 'favorites',
  recent: 'recently-viewed',
  preferences: 'preferences',
  leads: 'leads',
  cplEvents: 'cpl-events',
  events: 'analytics-events',
  firstTouch: 'attribution:first-touch',
  lastTouch: 'attribution:last-touch',
  session: 'session-id'
} as const;
