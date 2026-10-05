/**
 * Validación del catálogo antes de guardarlo. Rechaza datos que romperían el sitio
 * (ids/slugs duplicados, referencias inexistentes, enums inválidos, tipos incorrectos).
 */
const PROGRAM_TYPES = ['curso', 'especializacion', 'certificacion', 'bootcamp', 'diplomado', 'programa-ejecutivo', 'maestria', 'membresia'];
const MODALITIES = ['en-vivo', 'grabado', 'hibrido', 'presencial'];
const LEVELS = ['basico', 'intermedio', 'avanzado'];
const STATUSES = ['publicado', 'borrador', 'oculto'];
const CERTS = ['incluye', 'internacional', 'preparacion'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Rec = Record<string, unknown>;
export interface CatalogPayload {
  courses: Rec[];
  institutions: Rec[];
  categories: Rec[];
  meta?: Rec;
}

const isNum = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
const isStr = (v: unknown) => typeof v === 'string';
const isStrOrNull = (v: unknown) => v === null || typeof v === 'string';
const isArr = (v: unknown) => Array.isArray(v);

export function validateCatalog(input: unknown): { ok: true; catalog: CatalogPayload } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const c = input as CatalogPayload;
  if (!c || !isArr(c.courses) || !isArr(c.institutions) || !isArr(c.categories)) {
    return { ok: false, errors: ['El catálogo debe tener courses, institutions y categories.'] };
  }
  const instIds = new Set<string>();
  const instSlugs = new Set<string>();
  for (const i of c.institutions) {
    const id = String(i.id ?? '');
    if (!id || instIds.has(id)) errors.push(`Institución con id vacío o duplicado: "${id}"`);
    instIds.add(id);
    if (!isStr(i.name) || !(i.name as string).trim()) errors.push(`Institución ${id}: falta el nombre.`);
    if (!isStr(i.slug) || !SLUG.test(i.slug as string) || instSlugs.has(i.slug as string)) errors.push(`Institución ${id}: slug inválido o duplicado.`);
    instSlugs.add(i.slug as string);
  }
  const catIds = new Set(c.categories.map((x) => String(x.id)));
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const k of c.courses) {
    const id = String(k.id ?? '');
    const where = `Programa ${id || '(sin id)'}${isStr(k.name) ? ` «${k.name}»` : ''}`;
    if (!id || ids.has(id)) errors.push(`${where}: id vacío o duplicado.`);
    ids.add(id);
    if (!isStr(k.name) || !(k.name as string).trim()) errors.push(`${where}: falta el nombre.`);
    if (!isStr(k.slug) || !SLUG.test(k.slug as string)) errors.push(`${where}: slug inválido (solo minúsculas, números y guiones).`);
    else if (slugs.has(k.slug as string)) errors.push(`${where}: el slug "${k.slug}" ya existe.`);
    slugs.add(k.slug as string);
    if (!instIds.has(String(k.institution_id))) errors.push(`${where}: la institución "${k.institution_id}" no existe.`);
    if (!catIds.has(String(k.category))) errors.push(`${where}: la categoría "${k.category}" no existe.`);
    if (!PROGRAM_TYPES.includes(String(k.program_type))) errors.push(`${where}: tipo de programa inválido.`);
    if (k.modality !== null && !MODALITIES.includes(String(k.modality))) errors.push(`${where}: modalidad inválida.`);
    if (k.level !== null && !LEVELS.includes(String(k.level))) errors.push(`${where}: nivel inválido.`);
    if (!STATUSES.includes(String(k.status))) errors.push(`${where}: estado inválido.`);
    if (k.currency !== 'PEN' && k.currency !== 'USD') errors.push(`${where}: moneda inválida.`);
    for (const f of ['price', 'discount_price', 'duration_hours', 'duration_weeks']) if (!isNum(k[f])) errors.push(`${where}: "${f}" debe ser un número positivo o vacío.`);
    if (k.discount_price != null && k.price != null && (k.discount_price as number) > (k.price as number)) errors.push(`${where}: el precio promocional no puede ser mayor al regular.`);
    if (k.start_date !== null && !(isStr(k.start_date) && /^\d{4}-\d{2}-\d{2}$/.test(k.start_date as string))) errors.push(`${where}: fecha de inicio inválida (AAAA-MM-DD).`);
    if (k.certificate !== null && !(typeof k.certificate === 'object' && CERTS.includes(String((k.certificate as Rec).type)))) errors.push(`${where}: certificación inválida.`);
    for (const f of ['short_description', 'description', 'url']) if (!isStr(k[f])) errors.push(`${where}: falta "${f}".`);
    for (const f of ['subcategory', 'schedule', 'duration_text', 'start_text', 'target_audience']) if (!isStrOrNull(k[f])) errors.push(`${where}: "${f}" inválido.`);
    for (const f of ['tools', 'skills', 'syllabus', 'requirements', 'teachers', 'objectives', 'keywords']) if (!isArr(k[f])) errors.push(`${where}: "${f}" debe ser una lista.`);
    if (errors.length > 30) break;
  }
  return errors.length ? { ok: false, errors: errors.slice(0, 30) } : { ok: true, catalog: c };
}
