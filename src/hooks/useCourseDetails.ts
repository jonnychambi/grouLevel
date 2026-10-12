import { useEffect, useState } from 'react';
import type { CourseWithInstitution } from '../types';

const ENDPOINT = `${import.meta.env.BASE_URL}api/catalog`;
const cache = new Map<string, CourseWithInstitution>();
const merged = new WeakMap<CourseWithInstitution, CourseWithInstitution>();

/**
 * El listado público llega en versión liviana (sin temario completo, docentes, objetivos ni requisitos).
 * La ficha y el comparador piden el detalle de sus programas (máx. 4 por consulta) y lo combinan.
 * Si el detalle no llega, se muestra lo que haya en el listado.
 */
export function useCourseDetails<T extends CourseWithInstitution | undefined>(courses: T[]): T[] {
  const [, setTick] = useState(0);
  const pending = courses.filter((c): c is NonNullable<T> => !!c && !!(c as { lite?: boolean }).lite && !cache.has(c.id)).map((c) => c.id);
  const key = pending.join(',');
  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`${ENDPOINT}?ids=${encodeURIComponent(key)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { courses?: CourseWithInstitution[] } | null) => {
        for (const full of data?.courses ?? []) cache.set(full.id, full);
        if (alive) setTick((t) => t + 1);
      })
      .catch(() => { /* se mantiene la versión del listado */ });
    return () => { alive = false; };
  }, [key]);
  // El detalle reemplaza los campos del listado, pero se conserva lo calculado en el cliente (institución,
  // valoraciones). Cada combinación se guarda: el mismo programa devuelve siempre el mismo objeto
  // (los efectos de las páginas, como la analítica, no se repiten en cada render).
  return courses.map((c) => {
    if (!c) return c;
    const full = cache.get(c.id);
    if (!full) return c;
    let out = merged.get(c);
    if (!out) {
      out = { ...c, ...full, institution: c.institution, rating: c.rating, reviews_count: c.reviews_count, lite: false } as CourseWithInstitution;
      merged.set(c, out);
    }
    return out as T;
  });
}
