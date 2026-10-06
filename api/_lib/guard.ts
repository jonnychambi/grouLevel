/** Utilidades compartidas por los endpoints públicos: límite por IP y búsqueda de programas. */
import { getSql } from './db.js';

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
    const rows = await getSql()`select c.id, c.name, c.institution_id, i.name as institution_name
      from courses c join institutions i on i.id = c.institution_id where c.status = 'publicado'`;
    cache = { at: Date.now(), courses: new Map(rows.map((r) => [r.id as string, { id: r.id, name: r.name, institution_id: r.institution_id, institution_name: r.institution_name }])) };
  }
  return cache.courses.get(id) ?? null;
}

/** Solo para pruebas: invalida la caché. */
export function resetCourseCache() {
  cache = null;
}
