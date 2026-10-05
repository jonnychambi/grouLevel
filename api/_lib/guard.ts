/** Utilidades compartidas por los endpoints públicos: límite por IP y búsqueda de programas. */
import { readLatest } from './store.js';
import type { CatalogPayload } from './validate.js';

const buckets = new Map<string, number[]>();

/** true si la IP superó `max` envíos en la ventana (memoria por instancia: frena abusos simples). */
export function rateLimited(request: Request, scope: string, max: number, windowMs = 10 * 60_000): boolean {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 10_000) buckets.clear();
  return recent.length > max;
}

export interface CourseRef { id: string; name: string; institution_id: string; institution_name: string }
let cache: { at: number; courses: Map<string, CourseRef> } | null = null;

/** Busca un programa publicado en el catálogo vigente (caché de 60 s). */
export async function findCourse(id: string): Promise<CourseRef | null> {
  if (!cache || Date.now() - cache.at > 60_000) {
    const latest = await readLatest<CatalogPayload>();
    const inst = new Map((latest?.data.institutions ?? []).map((i) => [String(i.id), String(i.name)]));
    cache = {
      at: Date.now(),
      courses: new Map(
        (latest?.data.courses ?? [])
          .filter((c) => c.status === 'publicado')
          .map((c) => [String(c.id), { id: String(c.id), name: String(c.name), institution_id: String(c.institution_id), institution_name: inst.get(String(c.institution_id)) ?? String(c.institution_id) }])
      )
    };
  }
  return cache.courses.get(id) ?? null;
}
