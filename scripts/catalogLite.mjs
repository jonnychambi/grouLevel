/**
 * Versión liviana de un programa para el listado público (/api/catalog y respaldo del build).
 * Conserva lo que usan el buscador, los filtros y las tarjetas; el detalle (descripción larga, objetivos,
 * temario completo, perfiles de docentes, requisitos, público y condiciones de pago) se entrega por
 * programa (/api/catalog?ids=…), lo que encarece copiar el catálogo completo de una sola vez.
 *
 *   node scripts/catalogLite.mjs   → genera src/data/courses.lite.json desde src/data/courses.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function toLiteCourse(c) {
  return {
    ...c,
    description: c.short_description ?? '',
    objectives: [],
    target_audience: null,
    requirements: [],
    syllabus: (c.syllabus ?? []).map((m) => ({ title: m.title, hours: m.hours ?? null, description: '', topics: [] })),
    teachers: (c.teachers ?? []).map((t) => ({ name: t.name, profile: '', linkedin: null })),
    financing: { installments: c.financing?.installments ?? null, installment_amount: c.financing?.installment_amount ?? null, methods: [], notes: '' },
    lite: true
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const src = new URL('../src/data/courses.json', import.meta.url);
  const out = new URL('../src/data/courses.lite.json', import.meta.url);
  const courses = JSON.parse(readFileSync(src, 'utf8'));
  writeFileSync(out, JSON.stringify(courses.map(toLiteCourse)));
  console.log(`catalogLite: ${courses.length} programas → src/data/courses.lite.json`);
}
