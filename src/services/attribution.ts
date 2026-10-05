/**
 * Captura de atribución (UTM + referrer). First-touch persistente y last-touch por sesión.
 * Se invoca una vez al iniciar la app.
 */
import type { Attribution } from '../types';
import { STORAGE_KEYS, sessionStore, storage } from './storage';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export function captureAttribution(): void {
  const params = new URLSearchParams(window.location.search);
  const hasUtm = UTM_KEYS.some((k) => params.get(k));
  const externalReferrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null;

  const current: Attribution = {
    utm_source: params.get('utm_source') ?? (externalReferrer ? new URL(externalReferrer).hostname : null),
    utm_medium: params.get('utm_medium') ?? (externalReferrer ? 'referral' : null),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
    referrer: externalReferrer,
    landing_page: window.location.pathname + window.location.search,
    captured_at: new Date().toISOString()
  };

  if (!storage.get<Attribution | null>(STORAGE_KEYS.firstTouch, null)) storage.set(STORAGE_KEYS.firstTouch, current);
  if (hasUtm || externalReferrer || !sessionStore.get<Attribution | null>(STORAGE_KEYS.lastTouch, null)) {
    sessionStore.set(STORAGE_KEYS.lastTouch, current);
  }
}

/** Atribución vigente: last-touch de la sesión, con fallback a first-touch. */
export function getAttribution(): Attribution {
  const empty: Attribution = { utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, referrer: null, landing_page: null, captured_at: new Date().toISOString() };
  const last = sessionStore.get<Attribution | null>(STORAGE_KEYS.lastTouch, null);
  if (last?.utm_source) return last;
  return storage.get<Attribution | null>(STORAGE_KEYS.firstTouch, null) ?? last ?? empty;
}

export function getSessionId(): string {
  let id = sessionStore.get<string | null>(STORAGE_KEYS.session, null);
  if (!id) {
    id = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStore.set(STORAGE_KEYS.session, id);
  }
  return id;
}
