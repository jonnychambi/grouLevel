import type { Course } from '../types';

/** Campos clave para comparar programas. La completitud es la proporción disponible (0–1). */
export const KEY_FIELDS: { label: string; has: (c: Course) => boolean }[] = [
  { label: 'Precio', has: (c) => c.price != null },
  { label: 'Duración', has: (c) => c.duration_hours != null || !!c.duration_text },
  { label: 'Modalidad', has: (c) => !!c.modality },
  { label: 'Inicio', has: (c) => !!c.start_date || !!c.start_text || c.modality === 'grabado' },
  { label: 'Nivel', has: (c) => !!c.level },
  { label: 'Certificación', has: (c) => !!c.certificate },
  { label: 'Temario', has: (c) => c.syllabus.length > 0 },
  { label: 'Docentes', has: (c) => c.teachers.length > 0 },
  { label: 'Herramientas', has: (c) => c.tools.length > 0 },
  { label: 'Descripción', has: (c) => c.short_description.trim().length > 20 }
];

export function completeness(c: Course): number {
  return Math.round((KEY_FIELDS.filter((f) => f.has(c)).length / KEY_FIELDS.length) * 1000) / 1000;
}

export function missingFields(c: Course): string[] {
  return KEY_FIELDS.filter((f) => !f.has(c)).map((f) => f.label);
}
