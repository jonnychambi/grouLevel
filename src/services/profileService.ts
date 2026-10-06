/** "Mi ruta": envío del CV/descripción y lectura del diagnóstico guardado. */
import type { PublicProfileAnalysis } from '../types';
import { storage } from './storage';

const ENDPOINT = `${import.meta.env.BASE_URL}api/profile`;
const HISTORY_KEY = 'profile-history';

export class ProfileSubmitError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
  }
}

export async function submitProfile(form: FormData): Promise<PublicProfileAnalysis> {
  let res: Response;
  try {
    // El análisis con IA puede tardar hasta un par de minutos.
    res = await fetch(ENDPOINT, { method: 'POST', body: form, signal: AbortSignal.timeout(290_000) });
  } catch (err) {
    throw new ProfileSubmitError(err instanceof DOMException && err.name === 'TimeoutError' ? 'El análisis tardó demasiado. Inténtalo nuevamente en unos minutos.' : 'No pudimos conectarnos. Revisa tu conexión e inténtalo nuevamente.');
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ProfileSubmitError('El diagnóstico no está disponible en este entorno (funciona en www.groulevel.com).');
  const body = (await res.json()) as { profile?: PublicProfileAnalysis | null; message?: string; errors?: string[] };
  if (!res.ok || !body.profile) throw new ProfileSubmitError(body.message ?? 'No pudimos analizar tu perfil.', body.errors ?? []);
  remember(body.profile);
  return body.profile;
}

export async function fetchProfile(id: string): Promise<PublicProfileAnalysis | null> {
  try {
    const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    return ((await res.json()) as { profile: PublicProfileAnalysis }).profile;
  } catch {
    return null;
  }
}

export interface ProfileHistoryItem { id: string; created_at: string; objective: string }

/** Últimos diagnósticos de este navegador (solo id y objetivo, sin datos personales). */
export function profileHistory(): ProfileHistoryItem[] {
  return storage.get<ProfileHistoryItem[]>(HISTORY_KEY, []);
}

function remember(p: PublicProfileAnalysis) {
  const next = [{ id: p.id, created_at: p.created_at, objective: p.objective.slice(0, 120) }, ...profileHistory().filter((h) => h.id !== p.id)].slice(0, 5);
  storage.set(HISTORY_KEY, next);
}
