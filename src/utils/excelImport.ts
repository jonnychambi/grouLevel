/**
 * Importador de programas desde Excel (plantilla "CURSOS" del relevamiento Compara Learning).
 *
 * Es puro (sin DOM ni red): recibe las filas ya leídas del .xlsx y el catálogo actual, y devuelve
 * un PLAN — qué programas son nuevos, cuáles cambian (y qué campos), cuáles se descartan y por qué,
 * y qué instituciones hay que crear. `applyImportPlan` aplica la selección del usuario.
 *
 * Reglas (las mismas del import inicial):
 *  - Solo filas con extracción "Completo"/"Parcial" (si la columna existe).
 *  - Sin duplicados: los marcados en POSIBLE_DUPLICADO y las URLs repetidas dentro del archivo.
 *  - Solo áreas tecnológicas (configurable).
 *  - "No especificado" = dato no publicado (null). Un valor vacío del Excel nunca borra un dato existente.
 *  - Un programa ya existente se reconoce por su URL oficial (o institución + nombre).
 */
import type { Category, CertificateType, Course, CourseFeatures, CourseStatus, Institution, Level, Modality, ProgramType, SyllabusModule, Teacher } from '../types';
import { completeness } from './completeness';
import { normalize, slugify } from './text';

/* ------------------------------------------------------------------ Diccionarios */

export const REQUIRED_COLUMNS = ['INSTITUCION', 'NOMBRE_PROGRAMA', 'AREA_PRINCIPAL'] as const;
export const URL_COLUMNS = ['URL_FINAL', 'URL_ORIGEN'] as const;

const NA = new Set(['', 'no especificado', 'n/a', '-', 'na', 'null', 'none']);

const AREA_TO_CATEGORY: Record<string, string> = {
  'data analytics': 'data-analytics',
  'data science': 'data-science',
  'data engineering': 'data-engineering',
  'artificial intelligence': 'inteligencia-artificial',
  'inteligencia artificial': 'inteligencia-artificial',
  'machine learning': 'machine-learning',
  'generative ai': 'ia-generativa',
  'ia generativa': 'ia-generativa',
  'software development': 'desarrollo-de-software',
  'desarrollo de software': 'desarrollo-de-software',
  'cloud computing': 'cloud-computing',
  cybersecurity: 'ciberseguridad',
  ciberseguridad: 'ciberseguridad',
  devops: 'devops',
  'product management': 'product-management',
  'ux/ui': 'ux-ui',
  'ux ui': 'ux-ui',
  'business analytics': 'business-analytics',
  'digital business': 'negocios-digitales',
  'negocios digitales': 'negocios-digitales',
  'digital marketing': 'marketing-digital',
  'marketing digital': 'marketing-digital',
  'project management': 'gestion-de-proyectos',
  tecnologia: 'gestion-de-ti',
  automatizacion: 'automatizacion',
  'no-code / low-code': 'no-code-low-code',
  'no code': 'no-code-low-code'
};
/** Excepciones por nombre (área "Otro" que sí es tecnológica, u ofimática dentro de "Tecnología"). */
const NAME_CATEGORY_OVERRIDES: Record<string, string> = {
  'certified in risk and information systems control': 'gestion-de-ti',
  'actualizacion en microsoft office': 'business-analytics'
};

const TYPE_MAP: Record<string, ProgramType> = {
  curso: 'curso', especializacion: 'especializacion', maestria: 'maestria', bootcamp: 'bootcamp', certificacion: 'certificacion',
  diplomado: 'diplomado', diplomatura: 'diplomado', 'programa ejecutivo': 'programa-ejecutivo', membresia: 'membresia'
};
const PUBLISHED_TYPE_HINTS: [string, ProgramType][] = [
  ['taller', 'curso'], ['intensivo', 'bootcamp'], ['carrera', 'especializacion'], ['ruta', 'especializacion'],
  ['programa', 'especializacion'], ['membres', 'membresia'], ['diplomatura', 'diplomado']
];
const MODALITY_MAP: Record<string, Modality> = {
  sincrono: 'en-vivo', 'en vivo': 'en-vivo', asincrono: 'grabado', grabado: 'grabado', hibrido: 'hibrido', presencial: 'presencial'
};
const LEVEL_MAP: Record<string, Level> = { basico: 'basico', intermedio: 'intermedio', avanzado: 'avanzado' };

const PALETTE = ['#246BFE', '#7657FF', '#0EA5E9', '#14B8A6', '#E11D48', '#F59E0B', '#10B981', '#A855F7', '#DB2777', '#6366F1'];

/* ------------------------------------------------------------------ Lectura de celdas */

export type Cell = string | number | boolean | Date | null | undefined;
export type ExcelRecord = Record<string, Cell> & { __row: number };

const key = (s: string) => normalize(s).replace(/\s+/g, ' ');

function str(v: Cell): string | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return NA.has(s.toLowerCase()) ? null : s;
}

function num(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  const s = str(v);
  if (s == null) return null;
  const n = Number(s.replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) && s.match(/\d/) ? Math.round(n * 100) / 100 : null;
}

function yesNo(v: Cell): boolean | null {
  const s = str(v);
  if (!s) return null;
  const k = key(s);
  return k === 'si' ? true : k === 'no' ? false : null;
}

function list(v: Cell, sep: string | RegExp): string[] {
  const s = str(v);
  return s ? s.split(sep).map((x) => x.trim()).filter((x) => x && !NA.has(x.toLowerCase())) : [];
}

function clip(text: string | null, n: number): string | null {
  if (text == null || text.length <= n) return text;
  const cut = text.slice(0, n);
  const space = cut.lastIndexOf(' ');
  return (space > n * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.]+$/, '') + '…';
}

function isoDate(v: Cell): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/** Clave para reconocer un mismo programa por su URL. */
export function urlKey(url: string | null | undefined): string {
  if (!url) return '';
  return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

/* ------------------------------------------------------------------ Filas → registros */

export interface SheetParseResult {
  records: ExcelRecord[];
  missingColumns: string[];
  columns: string[];
}

/** Convierte la matriz de celdas (primera fila = encabezados) en registros por nombre de columna. */
export function rowsToRecords(rows: Cell[][]): SheetParseResult {
  const headerIndex = rows.findIndex((r) => r.some((c) => typeof c === 'string' && c.trim().toUpperCase() === 'NOMBRE_PROGRAMA'));
  if (headerIndex === -1) return { records: [], missingColumns: [...REQUIRED_COLUMNS, 'URL_FINAL'], columns: [] };
  const header = rows[headerIndex].map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''));
  const missing: string[] = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (!URL_COLUMNS.some((c) => header.includes(c))) missing.push('URL_FINAL');
  const records: ExcelRecord[] = [];
  rows.slice(headerIndex + 1).forEach((r, i) => {
    if (!r.some((c) => c != null && String(c).trim() !== '')) return;
    const rec = { __row: headerIndex + i + 2 } as ExcelRecord;
    header.forEach((h, j) => { if (h) rec[h] = r[j]; });
    records.push(rec);
  });
  return { records, missingColumns: missing, columns: header.filter(Boolean) };
}

/* ------------------------------------------------------------------ Mapeo de una fila */

function programType(r: ExcelRecord): ProgramType {
  const t = str(r.TIPO_PROGRAMA);
  if (t && TYPE_MAP[key(t)]) return TYPE_MAP[key(t)];
  const published = key(str(r.TIPO_PUBLICADO) ?? '');
  return PUBLISHED_TYPE_HINTS.find(([k]) => published.includes(k))?.[1] ?? 'curso';
}

function syllabus(v: Cell): SyllabusModule[] {
  return list(v, ' | ').slice(0, 40).map((part) => {
    let title = part.replace(/^(m[oó]dulo|curso|unidad|semana|ciclo|nivel)\s*\d+\s*[:.\-–]\s*/i, '').trim();
    let description = '';
    if (title.includes(': ') && title.length > 60) {
      const idx = title.indexOf(': ');
      description = title.slice(idx + 2).trim();
      title = title.slice(0, idx).trim();
    }
    return { title: clip(title, 140)!, hours: null, description: clip(description, 400) ?? '', topics: [] };
  });
}

function teachers(r: ExcelRecord): Teacher[] {
  const out: Teacher[] = list(r.PERFIL_DOCENTE, ' | ').map((p) => {
    const idx = p.indexOf(': ');
    return idx === -1
      ? { name: clip(p, 80)!, profile: '', linkedin: null }
      : { name: clip(p.slice(0, idx).trim(), 80)!, profile: clip(p.slice(idx + 2).trim(), 320) ?? '', linkedin: null };
  });
  if (!out.length) list(r.DOCENTE_PRINCIPAL, ' | ').forEach((n) => out.push({ name: clip(n, 80)!, profile: '', linkedin: null }));
  list(r.LINKEDIN_DOCENTE, ' | ').forEach((url, i) => { if (out[i] && /^https?:\/\//.test(url)) out[i].linkedin = url; });
  return out.slice(0, 12);
}

function certificate(r: ExcelRecord): Course['certificate'] {
  const text = str(r.CERTIFICACION);
  if (text) {
    const low = key(text);
    const type: CertificateType = low.includes('internacional') ? 'internacional' : low.includes('prepar') ? 'preparacion' : 'incluye';
    return { type, description: clip(text, 320)! };
  }
  return yesNo(r.CERTIFICADO_INCLUIDO) ? { type: 'incluye', description: 'La institución indica que el programa incluye certificado.' } : null;
}

/** Datos del programa según el Excel (sin id/slug/estado, que dependen del catálogo). */
export type ExcelCourseData = Omit<Course, 'id' | 'slug' | 'institution_id' | 'status' | 'featured' | 'manual_edit_at'>;

/** Campos que en `data` son valores por defecto (no vinieron en el Excel) y no deben pisar datos existentes. */
export type DefaultedField = 'description' | 'short_description' | 'program_type' | 'language' | 'country';

export type RowOutcome =
  | { ok: true; row: number; data: ExcelCourseData; defaulted: Set<DefaultedField>; institutionName: string; institutionCountry: string | null; url: string }
  | { ok: false; row: number; name: string; institution: string; reason: string };

export interface MapOptions { techOnly: boolean; today: string; categories: Category[] }

export function mapRow(r: ExcelRecord, opts: MapOptions): RowOutcome {
  const name = str(r.NOMBRE_PROGRAMA);
  const institution = str(r.INSTITUCION) ?? '';
  const fail = (reason: string): RowOutcome => ({ ok: false, row: r.__row, name: name ?? '(sin nombre)', institution, reason });

  const status = str(r.ESTADO_EXTRACCION);
  if (status && !['completo', 'parcial'].includes(key(status))) return fail(`Sin datos: ${status}`);
  if (!name) return fail('Falta el nombre del programa');
  if (!institution) return fail('Falta la institución');
  const url = str(r.URL_FINAL) ?? str(r.URL_ORIGEN);
  if (!url || !/^https?:\/\//i.test(url)) return fail('Falta la URL oficial del programa');

  const area = str(r.AREA_PRINCIPAL);
  const categoryIds = new Set(opts.categories.map((c) => c.id));
  let category = NAME_CATEGORY_OVERRIDES[key(name)] ?? (area ? AREA_TO_CATEGORY[key(area)] : undefined);
  if (!category && area && categoryIds.has(slugify(area))) category = slugify(area);
  if (!category || !categoryIds.has(category)) {
    if (opts.techOnly) return fail(area ? `Área fuera del foco tecnológico: ${area}` : 'Sin área');
    category = 'negocios-digitales';
  }

  const extracted = isoDate(r.FECHA_EXTRACCION) ?? opts.today;
  const currencyRaw = str(r.MONEDA)?.toUpperCase();
  const currency = currencyRaw === 'PEN' || currencyRaw === 'USD' ? currencyRaw : null;
  const regular = currency ? (num(r.PRECIO_REGULAR) ?? num(r.PRECIO)) : null;
  const offer = regular != null ? num(r.PRECIO_OFERTA) : null;
  const installments = num(r.CUOTAS);
  const start = isoDate(r.FECHA_INICIO);
  const short = str(r.DESCRIPCION_CORTA) ?? str(r.OBJETIVO_PROGRAMA) ?? `${name} — ${institution.split(' (')[0].trim()}.`;
  const features: CourseFeatures = {
    live_classes: yesNo(r.CLASES_EN_VIVO), recorded_classes: yesNo(r.CLASES_GRABADAS), final_project: yesNo(r.PROYECTO_FINAL),
    mentoring: yesNo(r.MENTORIA), lifetime_access: yesNo(r.ACCESO_DE_POR_VIDA), job_board: yesNo(r.BOLSA_TRABAJO),
    community: yesNo(r.COMUNIDAD), enrollment_open: yesNo(r.INSCRIPCIONES_ABIERTAS)
  };

  const data: ExcelCourseData = {
    name,
    category,
    subcategory: str(r.SUBAREA),
    program_type: programType(r),
    published_type: str(r.TIPO_PUBLICADO),
    description: short,
    short_description: clip(short, 200)!,
    objectives: list(r.OBJETIVO_PROGRAMA, '; ').map((o) => clip(o, 260)!).slice(0, 10),
    target_audience: clip(str(r.PUBLICO_OBJETIVO), 600),
    price: regular,
    currency: currency ?? 'PEN',
    discount_price: offer != null && regular != null && offer < regular ? offer : null,
    duration_hours: num(r.HORAS_CURSO),
    duration_weeks: num(r.DURACION_SEMANAS),
    duration_text: str(r.DURACION_TEXTO),
    modality: MODALITY_MAP[key(str(r.MODALIDAD) ?? '')] ?? null,
    schedule: [str(r.FRECUENCIA), str(r.HORARIO)].filter(Boolean).join(' · ') || null,
    level: LEVEL_MAP[key(str(r.NIVEL) ?? '')] ?? null,
    start_date: start && start >= extracted ? start : null,
    start_text: str(r.FECHA_INICIO_TEXTO),
    certificate: certificate(r),
    teachers: teachers(r),
    tools: [...new Set(list(r.HERRAMIENTAS, ' | '))].slice(0, 20),
    skills: [],
    syllabus: syllabus(r.CONTENIDO),
    requirements: list(r.REQUISITOS, '; ').map((x) => clip(x, 220)!).slice(0, 10),
    features,
    platform: clip(str(r.PLATAFORMA), 160),
    language: str(r.IDIOMA) ?? 'Español',
    country: str(r.PAIS_PROGRAMA) ?? str(r.PAIS_INSTITUCION) ?? 'Perú',
    image: null,
    url,
    rating: null,
    reviews_count: null,
    financing: {
      installments: installments && installments > 1 ? installments : null,
      installment_amount: installments && installments > 1 ? num(r.PRECIO_CUOTA) : null,
      methods: [],
      notes: ''
    },
    keywords: [str(r.SUBAREA), str(r.TIPO_PUBLICADO)].filter((x): x is string => !!x),
    completeness: 0,
    updated_at: extracted,
    is_demo: false
  };
  data.completeness = completeness({ ...data, id: '', slug: '', institution_id: '', status: 'publicado', featured: false });
  const defaulted = new Set<DefaultedField>();
  if (!str(r.DESCRIPCION_CORTA) && !str(r.OBJETIVO_PROGRAMA)) defaulted.add('description').add('short_description');
  if (!str(r.TIPO_PROGRAMA) && !str(r.TIPO_PUBLICADO)) defaulted.add('program_type');
  if (!str(r.IDIOMA)) defaulted.add('language');
  if (!str(r.PAIS_PROGRAMA) && !str(r.PAIS_INSTITUCION)) defaulted.add('country');
  return { ok: true, row: r.__row, data, defaulted, institutionName: institution, institutionCountry: str(r.PAIS_INSTITUCION), url };
}

/* ------------------------------------------------------------------ Plan de importación */

export type ImportMode = 'nuevos' | 'nuevos-y-actualizar';

export interface ImportOptions {
  mode: ImportMode;
  newStatus: CourseStatus;
  techOnly: boolean;
  /** Actualizar también programas editados a mano en /admin. */
  overwriteManual: boolean;
  today: string;
}

export interface FieldChange { field: string; label: string; before: string; after: string }
export interface PlannedNew { row: number; course: Course; institutionIsNew: boolean }
export interface PlannedUpdate { row: number; before: Course; after: Course; changes: FieldChange[] }
export interface Skipped { row: number; name: string; institution: string; reason: string }

export interface ImportPlan {
  newCourses: PlannedNew[];
  updates: PlannedUpdate[];
  unchanged: { row: number; course: Course }[];
  protectedManual: { row: number; course: Course }[];
  skipped: Skipped[];
  newInstitutions: Institution[];
  totalRows: number;
}

interface CatalogLike { courses: Course[]; institutions: Institution[]; categories: Category[] }

/** Campos que una importación puede actualizar, con su etiqueta para mostrar cambios. */
const UPDATABLE: { field: keyof ExcelCourseData; label: string }[] = [
  { field: 'name', label: 'Nombre' }, { field: 'category', label: 'Categoría' }, { field: 'program_type', label: 'Tipo' },
  { field: 'published_type', label: 'Denominación' }, { field: 'subcategory', label: 'Subárea' },
  { field: 'short_description', label: 'Descripción corta' }, { field: 'description', label: 'Descripción' },
  { field: 'objectives', label: 'Lo que aprenderás' }, { field: 'target_audience', label: 'Público' },
  { field: 'price', label: 'Precio' }, { field: 'discount_price', label: 'Precio promocional' }, { field: 'currency', label: 'Moneda' },
  { field: 'duration_hours', label: 'Horas' }, { field: 'duration_weeks', label: 'Semanas' }, { field: 'duration_text', label: 'Duración' },
  { field: 'modality', label: 'Modalidad' }, { field: 'schedule', label: 'Horario' }, { field: 'level', label: 'Nivel' },
  { field: 'start_date', label: 'Fecha de inicio' }, { field: 'start_text', label: 'Inicio (texto)' },
  { field: 'certificate', label: 'Certificación' }, { field: 'teachers', label: 'Docentes' }, { field: 'tools', label: 'Herramientas' },
  { field: 'syllabus', label: 'Temario' }, { field: 'requirements', label: 'Requisitos' }, { field: 'features', label: 'Incluye' },
  { field: 'platform', label: 'Plataforma' }, { field: 'language', label: 'Idioma' }, { field: 'financing', label: 'Financiamiento' },
  { field: 'url', label: 'URL oficial' }
];

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

function show(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return `${v.length} elementos`;
  if (typeof v === 'object') {
    if ('type' in (v as object)) return String((v as { type: string }).type);
    if ('installments' in (v as object)) {
      const f = v as Course['financing'];
      return f.installments ? `${f.installments} cuotas` : '—';
    }
    return 'actualizado';
  }
  return String(v);
}

/** Igualdad tolerante: textos se comparan sin tildes, emojis ni signos (evita "cambios" cosméticos). */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') return normalize(a) === normalize(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Fusiona: el Excel solo pisa campos que trae con dato; nunca borra información existente. */
function merge(before: Course, data: ExcelCourseData, defaulted: Set<DefaultedField>): { after: Course; changes: FieldChange[] } {
  const after: Course = { ...before };
  const changes: FieldChange[] = [];
  for (const { field, label } of UPDATABLE) {
    if (defaulted.has(field as DefaultedField)) continue; // valor por defecto, no dato del Excel
    let next = data[field] as unknown;
    if (field === 'features') {
      const prev = before.features;
      const merged = { ...prev };
      for (const k of Object.keys(data.features) as (keyof CourseFeatures)[]) if (data.features[k] != null) merged[k] = data.features[k];
      next = merged;
    } else if (field === 'financing') {
      const f = data.financing;
      next = { ...before.financing, installments: f.installments ?? before.financing.installments, installment_amount: f.installment_amount ?? before.financing.installment_amount };
    } else if (field === 'discount_price') {
      if (data.price == null) continue; // sin precio en el Excel: no tocar promoción
      // Sin precio promocional en el Excel se conserva el actual, si sigue siendo menor al nuevo precio.
      if (next == null) next = before.discount_price != null && before.discount_price < data.price ? before.discount_price : null;
    } else if (field === 'currency') {
      if (data.price == null) continue;
    } else if (isEmpty(next)) continue;
    if (!sameValue(next, before[field as keyof Course])) {
      (after as unknown as Record<string, unknown>)[field] = next;
      changes.push({ field, label, before: show(before[field as keyof Course]), after: show(next) });
    }
  }
  if (changes.length) {
    after.updated_at = data.updated_at;
    after.completeness = completeness(after);
  }
  return { after, changes };
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-ZÁÉÍÓÚÑ0-9]/.test(w));
  const s = words.map((w) => w[0]).join('').slice(0, 4);
  return s.length >= 2 ? s : name.slice(0, 3);
}

function inferInstitutionType(name: string): string {
  const n = key(name);
  if (n.includes('universidad') || n.includes('posgrado') || n.includes('postgrado')) return 'Universidad';
  if (n.includes('business school') || n.includes('escuela de negocios')) return 'Escuela de negocios';
  if (n.includes('instituto') || n.includes('escuela')) return 'Instituto';
  if (n.includes('bootcamp')) return 'Bootcamp';
  return 'Academia especializada';
}

export function planImport(records: ExcelRecord[], catalog: CatalogLike, opts: ImportOptions): ImportPlan {
  const plan: ImportPlan = { newCourses: [], updates: [], unchanged: [], protectedManual: [], skipped: [], newInstitutions: [], totalRows: records.length };

  // Índices del catálogo actual
  const byUrl = new Map(catalog.courses.map((c) => [urlKey(c.url), c]));
  const byInstName = new Map(catalog.courses.map((c) => [`${c.institution_id}|${key(c.name)}`, c]));
  const instByAlias = new Map<string, Institution>();
  for (const i of catalog.institutions) {
    for (const n of [i.name, i.short_name, ...(i.aliases ?? [])]) instByAlias.set(key(n), i);
  }
  const usedSlugs = new Set(catalog.courses.map((c) => c.slug));
  const usedInstSlugs = new Set(catalog.institutions.map((i) => i.slug));
  let nextId = Math.max(0, ...catalog.courses.map((c) => Number(/^crs-(\d+)$/.exec(c.id)?.[1] ?? 0))) + 1;
  const seenUrls = new Set<string>();

  const resolveInstitution = (excelName: string, url: string, country: string | null): { inst: Institution; isNew: boolean } => {
    const k = key(excelName);
    const base = excelName.split(' (')[0].trim();
    const found = instByAlias.get(k) ?? instByAlias.get(key(base));
    if (found) return { inst: found, isNew: false };
    let slug = slugify(base) || 'institucion';
    for (let n = 2; usedInstSlugs.has(slug); n++) slug = `${slugify(base)}-${n}`;
    usedInstSlugs.add(slug);
    const kind = inferInstitutionType(excelName);
    const place = country ?? 'Perú';
    const inst: Institution = {
      id: `inst-${slug}`, slug, name: base, short_name: base.length <= 10 ? base : initials(base), type: kind, country: place, city: place,
      founded: null, brand_color: PALETTE[[...slug].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length],
      description: `${base} es una institución de tipo «${kind.toLowerCase()}» con sede en ${place}. Compara aquí sus programas de tecnología con información obtenida de su sitio web oficial.`,
      website: /^(https?:\/\/[^/]+)/.exec(url)?.[1] ?? '', accreditations: [], logo: null, aliases: [excelName], is_demo: false
    };
    instByAlias.set(k, inst);
    instByAlias.set(key(base), inst);
    plan.newInstitutions.push(inst);
    return { inst, isNew: true };
  };

  for (const r of records) {
    // Duplicados declarados en el propio relevamiento
    if (key(str(r.POSIBLE_DUPLICADO) ?? '') === 'si') {
      const dup = num(r.ID_DUPLICADO);
      const own = num(r.ID_ORIGEN);
      if (dup != null && own != null && dup < own) {
        plan.skipped.push({ row: r.__row, name: str(r.NOMBRE_PROGRAMA) ?? '(sin nombre)', institution: str(r.INSTITUCION) ?? '', reason: `Duplicado del registro ${dup}` });
        continue;
      }
    }
    const out = mapRow(r, { techOnly: opts.techOnly, today: opts.today, categories: catalog.categories });
    if (!out.ok) {
      plan.skipped.push(out);
      continue;
    }
    const uk = urlKey(out.url);
    if (seenUrls.has(uk)) {
      plan.skipped.push({ row: out.row, name: out.data.name, institution: out.institutionName, reason: 'URL repetida dentro del archivo' });
      continue;
    }
    seenUrls.add(uk);

    const { inst, isNew } = resolveInstitution(out.institutionName, out.url, out.institutionCountry);
    const existing = byUrl.get(uk) ?? byInstName.get(`${inst.id}|${key(out.data.name)}`);

    if (existing) {
      if (opts.mode === 'nuevos') {
        plan.unchanged.push({ row: out.row, course: existing });
        continue;
      }
      if (existing.manual_edit_at && !opts.overwriteManual) {
        plan.protectedManual.push({ row: out.row, course: existing });
        continue;
      }
      const { after, changes } = merge(existing, out.data, out.defaulted);
      if (changes.length) plan.updates.push({ row: out.row, before: existing, after, changes });
      else plan.unchanged.push({ row: out.row, course: existing });
      continue;
    }

    let slug = slugify(out.data.name) || `programa-${nextId}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${inst.slug}`;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(out.data.name)}-${inst.slug}-${n}`;
    usedSlugs.add(slug);
    const course: Course = { ...out.data, id: `crs-${String(nextId++).padStart(4, '0')}`, slug, institution_id: inst.id, status: opts.newStatus, featured: false, manual_edit_at: null };
    plan.newCourses.push({ row: out.row, course, institutionIsNew: isNew });
  }
  return plan;
}

/** Aplica al catálogo los programas nuevos y actualizaciones seleccionados (por id). */
export function applyImportPlan(catalog: CatalogLike, plan: ImportPlan, selected: { newIds: Set<string>; updateIds: Set<string> }): CatalogLike & { added: number; updated: number; institutionsAdded: number } {
  const added = plan.newCourses.filter((n) => selected.newIds.has(n.course.id)).map((n) => n.course);
  const updates = new Map(plan.updates.filter((u) => selected.updateIds.has(u.after.id)).map((u) => [u.after.id, u.after]));
  const neededInst = new Set(added.map((c) => c.institution_id));
  const newInstitutions = plan.newInstitutions.filter((i) => neededInst.has(i.id));
  return {
    courses: [...catalog.courses.map((c) => updates.get(c.id) ?? c), ...added],
    institutions: [...catalog.institutions, ...newInstitutions],
    categories: catalog.categories,
    added: added.length,
    updated: updates.size,
    institutionsAdded: newInstitutions.length
  };
}
