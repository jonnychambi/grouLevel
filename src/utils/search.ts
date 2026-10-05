/**
 * Motor de búsqueda client-side de Groulevel.
 *
 * - Interpreta intención (tipo de programa, modalidad, nivel, precio) desde lenguaje natural:
 *   "maestría de inteligencia artificial", "curso de Python barato", "data analytics online".
 * - Expande sinónimos (ia ⇄ inteligencia artificial, ml ⇄ machine learning…).
 * - Puntúa por campo con pesos (nombre > herramientas/categoría > institución > descripción).
 * - Tolera errores de tipeo (Levenshtein ≤ 1) y coincidencias por prefijo.
 *
 * Es puro y determinista: se puede reutilizar en un backend (Node) o reemplazar por
 * Algolia / Typesense / Postgres FTS sin tocar la UI (ver services/courseService.ts).
 */
import type { Category, CourseWithInstitution, Level, Modality, ProgramType } from '../types';
import { editDistance, normalize, tokenize } from './text';

/* ----------------------------------------------------------------------------
 * Diccionarios
 * ------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'o', 'para', 'con', 'un', 'una', 'unos', 'unas',
  'a', 'al', 'por', 'sobre', 'que', 'mi', 'me', 'quiero', 'aprender', 'estudiar', 'programa', 'programas',
  'formacion', 'clases', 'clase', 'online', 'virtual', 'virtuales', 'peru', 'lima', 'mejor', 'mejores', 'top', 'busco', 'como'
]);

/** Sinónimos: cada grupo es un mismo "concepto". Todo normalizado. */
const SYNONYM_GROUPS: string[][] = [
  ['inteligencia artificial', 'ia', 'ai', 'artificial intelligence'],
  ['ia generativa', 'generative ai', 'genai', 'llm', 'llms', 'chatgpt'],
  ['machine learning', 'ml', 'aprendizaje automatico'],
  ['data science', 'ciencia de datos', 'cientifico de datos'],
  ['data analytics', 'analisis de datos', 'analitica de datos', 'analista de datos'],
  ['data engineering', 'ingenieria de datos', 'data engineer'],
  ['business intelligence', 'inteligencia de negocios', 'bi'],
  ['power bi', 'powerbi'],
  ['desarrollo web', 'web', 'programacion web', 'full stack', 'fullstack'],
  ['programacion', 'desarrollo de software', 'programar', 'developer', 'desarrollador', 'coding'],
  ['cloud', 'nube', 'cloud computing'],
  ['aws', 'amazon web services'],
  ['ciberseguridad', 'seguridad informatica', 'cybersecurity', 'ciber seguridad'],
  ['ethical hacking', 'hacking etico', 'pentesting', 'hacker etico'],
  ['ux', 'experiencia de usuario', 'user experience'],
  ['ui', 'interfaces', 'diseno de interfaces'],
  ['product management', 'gestion de producto', 'product manager', 'producto'],
  ['no code', 'nocode', 'no-code', 'sin programar'],
  ['low code', 'lowcode'],
  ['automatizacion', 'automatizar', 'rpa'],
  ['javascript', 'js'],
  ['kubernetes', 'k8s'],
  ['excel', 'hojas de calculo']
];

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) for (const term of group) SYNONYMS.set(term, group);
/** Frases multi-palabra conocidas (para detectar "power bi" como un solo concepto). */
const PHRASES = [...SYNONYMS.keys()].filter((k) => k.includes(' ')).sort((a, b) => b.split(' ').length - a.split(' ').length);

const TYPE_INTENTS: [string[], ProgramType][] = [
  [['curso', 'cursos', 'taller', 'talleres'], 'curso'],
  [['bootcamp', 'bootcamps'], 'bootcamp'],
  [['diplomado', 'diplomados', 'diploma'], 'diplomado'],
  [['maestria', 'maestrias', 'master', 'masters', 'magister', 'posgrado', 'postgrado'], 'maestria'],
  [['especializacion', 'especializaciones', 'especialidad'], 'especializacion'],
  [['certificacion', 'certificaciones'], 'certificacion'],
  [['ejecutivo', 'ejecutivos', 'executive'], 'programa-ejecutivo'],
  [['membresia', 'membresias', 'suscripcion'], 'membresia']
];

const MODALITY_INTENTS: [string[], Modality][] = [
  [['vivo', 'sincronico', 'sincrono', 'live'], 'en-vivo'],
  [['grabado', 'grabados', 'asincronico', 'asincrono', 'ritmo'], 'grabado'],
  [['hibrido', 'semipresencial', 'presencial'], 'hibrido']
];

const LEVEL_INTENTS: [string[], Level][] = [
  [['basico', 'principiante', 'principiantes', 'cero', 'introduccion', 'inicial'], 'basico'],
  [['intermedio'], 'intermedio'],
  [['avanzado', 'experto', 'expertos'], 'avanzado']
];

const CHEAP_WORDS = new Set(['barato', 'baratos', 'barata', 'economico', 'economicos', 'accesible', 'accesibles', 'low cost', 'precio bajo']);
const FREE_WORDS = new Set(['gratis', 'gratuito', 'gratuitos', 'gratuita', 'free']);
/** Palabras de contexto que no deben contarse como concepto ("en vivo", "a tu ritmo", "desde cero"). */
const CONTEXT_FILLERS = new Set(['en', 'tu', 'desde']);

/* ----------------------------------------------------------------------------
 * Interpretación de la consulta
 * ------------------------------------------------------------------------- */

export interface QueryIntent {
  programType?: ProgramType;
  modality?: Modality;
  level?: Level;
  cheap?: boolean;
  free?: boolean;
}

export interface ParsedQuery {
  raw: string;
  /** Conceptos a buscar; cada uno con alternativas (sinónimos). */
  concepts: string[][];
  intent: QueryIntent;
}

export function parseQuery(raw: string): ParsedQuery {
  const intent: QueryIntent = {};
  let text = normalize(raw);

  // Intenciones de precio de dos palabras
  for (const w of CHEAP_WORDS) if (w.includes(' ') && text.includes(w)) { intent.cheap = true; text = text.replace(w, ' '); }
  if (/\bprograma ejecutivo\b/.test(text)) { intent.programType = 'programa-ejecutivo'; text = text.replace(/\bprograma ejecutivo\b/, ' '); }
  if (/\bel mas barato\b/.test(text)) intent.cheap = true;

  // 1) Frases multi-palabra conocidas → un concepto cada una
  const concepts: string[][] = [];
  for (const phrase of PHRASES) {
    const re = new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (re.test(text)) {
      const group = SYNONYMS.get(phrase)!;
      if (!concepts.includes(group)) concepts.push(group);
      text = text.replace(re, ' ');
    }
  }

  // 2) Palabras sueltas
  for (const token of tokenize(text)) {
    const type = TYPE_INTENTS.find(([words]) => words.includes(token));
    if (type) { intent.programType ??= type[1]; continue; }
    const modality = MODALITY_INTENTS.find(([words]) => words.includes(token));
    if (modality) { intent.modality ??= modality[1]; continue; }
    const level = LEVEL_INTENTS.find(([words]) => words.includes(token));
    if (level) { intent.level ??= level[1]; continue; }
    if (CHEAP_WORDS.has(token)) { intent.cheap = true; continue; }
    if (FREE_WORDS.has(token)) { intent.free = true; continue; }
    if (STOPWORDS.has(token) || CONTEXT_FILLERS.has(token)) continue;
    const group = SYNONYMS.get(token);
    if (group) { if (!concepts.includes(group)) concepts.push(group); continue; }
    concepts.push([token]);
  }

  return { raw, concepts, intent };
}

/* ----------------------------------------------------------------------------
 * Índice y scoring
 * ------------------------------------------------------------------------- */

interface IndexedField { text: string; tokens: string[]; weight: number }
interface IndexedCourse { course: CourseWithInstitution; fields: IndexedField[]; name: string }

const field = (value: string | string[], weight: number): IndexedField => {
  const text = normalize(Array.isArray(value) ? value.join(' | ') : value);
  return { text: ` ${text} `, tokens: text.split(/\s+/), weight };
};

export function buildIndex(courses: CourseWithInstitution[], categories: Category[]): IndexedCourse[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return courses.map((course) => {
    const cat = catById.get(course.category);
    return {
      course,
      name: normalize(course.name),
      fields: [
        field(course.name, 10),
        field(course.tools, 7),
        field(cat ? [cat.name, ...cat.keywords] : course.category, 6),
        field(course.subcategory, 4),
        field([course.institution.name, course.institution.short_name], 6),
        field(course.skills, 5),
        field(course.keywords, 4),
        field(course.syllabus.flatMap((m) => [m.title, ...m.topics]), 2),
        field(course.short_description, 2),
        field(course.description, 1)
      ]
    };
  });
}

function matchAlternative(alt: string, f: IndexedField): number {
  if (alt.includes(' ')) return f.text.includes(` ${alt} `) ? 1 : f.text.includes(alt) ? 0.8 : 0;
  let best = 0;
  for (const tok of f.tokens) {
    if (tok === alt) return 1;
    if (alt.length >= 3 && tok.startsWith(alt)) best = Math.max(best, 0.75);
    else if (alt.length >= 5 && tok.length >= 5) {
      // Tolerancia a errores de tipeo: 1 edición en palabras medianas, 2 en palabras largas.
      const max = alt.length >= 8 ? 2 : 1;
      const d = editDistance(alt, tok, max);
      if (d <= max) best = Math.max(best, d === 1 ? 0.45 : 0.35);
    }
  }
  return best;
}

function scoreConcept(concept: string[], fields: IndexedField[]): number {
  let total = 0;
  for (const f of fields) {
    let best = 0;
    for (const alt of concept) best = Math.max(best, matchAlternative(alt, f));
    total += best * f.weight;
  }
  return total;
}

export interface SearchHit {
  course: CourseWithInstitution;
  score: number;
  /** Proporción de conceptos de la consulta encontrados (0–1). */
  coverage: number;
}

export interface SearchResult {
  hits: SearchHit[];
  parsed: ParsedQuery;
  /** true si no hubo coincidencia total y se devolvieron resultados aproximados. */
  approximate: boolean;
  /** Intenciones que efectivamente se aplicaron como filtro. */
  appliedIntent: QueryIntent;
}

export function search(index: IndexedCourse[], query: string): SearchResult {
  const parsed = parseQuery(query);
  const { concepts, intent } = parsed;
  const qNorm = normalize(query);

  let hits: SearchHit[] = index.map(({ course, fields, name }) => {
    if (concepts.length === 0) return { course, score: 1, coverage: 1 };
    let score = 0;
    let matched = 0;
    for (const concept of concepts) {
      const s = scoreConcept(concept, fields);
      if (s > 0) matched++;
      score += s;
    }
    if (qNorm.length > 3 && name.includes(qNorm)) score += 25; // coincidencia exacta de frase en el nombre
    const coverage = matched / concepts.length;
    return { course, score: score * (0.4 + 0.6 * coverage), coverage };
  });

  let approximate = false;
  const full = hits.filter((h) => h.coverage === 1 && h.score > 0);
  if (full.length > 0) hits = full;
  else {
    hits = hits.filter((h) => h.score > 0);
    approximate = hits.length > 0 && concepts.length > 0;
  }

  // Intenciones: se aplican como filtro solo si dejan resultados; si no, como boost.
  const appliedIntent: QueryIntent = {};
  const applyIntent = <K extends keyof QueryIntent>(key: K, predicate: (h: SearchHit) => boolean) => {
    const filtered = hits.filter(predicate);
    if (filtered.length > 0) { hits = filtered; appliedIntent[key] = intent[key]; }
  };
  if (intent.programType) applyIntent('programType', (h) => h.course.program_type === intent.programType);
  if (intent.modality) applyIntent('modality', (h) => h.course.modality === intent.modality);
  if (intent.level) applyIntent('level', (h) => h.course.level === intent.level);
  if (intent.free) applyIntent('free', (h) => (h.course.discount_price ?? h.course.price) === 0);
  if (intent.cheap) appliedIntent.cheap = true;

  // Pequeño boost a listings destacados y a la calidad percibida (no altera la pertinencia).
  for (const h of hits) {
    h.score += (h.course.featured ? 3 : 0) + h.course.rating * 0.5;
  }
  hits.sort((a, b) => b.score - a.score);
  return { hits, parsed, approximate, appliedIntent };
}

/* ----------------------------------------------------------------------------
 * Autocompletado
 * ------------------------------------------------------------------------- */

export type SuggestionKind = 'categoria' | 'programa' | 'institucion' | 'herramienta' | 'busqueda';

export interface Suggestion {
  kind: SuggestionKind;
  label: string;
  /** Texto que se usará como búsqueda, o slug de destino. */
  value: string;
  hint?: string;
}

const prefixMatch = (label: string, q: string): number => {
  const n = normalize(label);
  if (n.startsWith(q)) return 3;
  if (n.split(' ').some((w) => w.startsWith(q))) return 2;
  if (q.length >= 3 && n.includes(q)) return 1;
  return 0;
};

export function suggest(
  query: string,
  data: { courses: CourseWithInstitution[]; categories: Category[] },
  limits = { categoria: 3, programa: 4, institucion: 2, herramienta: 3 }
): Suggestion[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const rank = <T,>(items: T[], label: (t: T) => string, extra?: (t: T) => string[]) =>
    items
      .map((item) => ({ item, s: Math.max(prefixMatch(label(item), q), ...(extra?.(item) ?? []).map((e) => prefixMatch(e, q) - 0.5)) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

  const categories = rank(data.categories, (c) => c.name, (c) => c.keywords)
    .slice(0, limits.categoria)
    .map(({ item }) => ({ kind: 'categoria' as const, label: item.name, value: item.slug, hint: 'Categoría' }));

  const programs = rank(data.courses, (c) => c.name, (c) => c.tools)
    .slice(0, limits.programa)
    .map(({ item }) => ({ kind: 'programa' as const, label: item.name, value: item.slug, hint: item.institution.short_name }));

  const institutionsSeen = new Map<string, CourseWithInstitution['institution']>();
  data.courses.forEach((c) => institutionsSeen.set(c.institution.id, c.institution));
  const institutions = rank([...institutionsSeen.values()], (i) => i.name, (i) => [i.short_name])
    .slice(0, limits.institucion)
    .map(({ item }) => ({ kind: 'institucion' as const, label: item.name, value: item.slug, hint: 'Institución' }));

  const tools = [...new Set(data.courses.flatMap((c) => c.tools))];
  const toolHits = rank(tools, (t) => t)
    .slice(0, limits.herramienta)
    .map(({ item }) => ({ kind: 'herramienta' as const, label: item, value: item, hint: 'Herramienta' }));

  return [...categories, ...toolHits, ...programs, ...institutions];
}

/** Describe en texto la intención detectada (para mostrar "Interpretamos…"). */
export function describeIntent(intent: QueryIntent, labels: { type: Record<string, string>; modality: Record<string, string>; level: Record<string, string> }): string[] {
  const out: string[] = [];
  if (intent.programType) out.push(labels.type[intent.programType]);
  if (intent.modality) out.push(labels.modality[intent.modality]);
  if (intent.level) out.push(`Nivel ${labels.level[intent.level].toLowerCase()}`);
  if (intent.free) out.push('Gratis');
  if (intent.cheap) out.push('Precio más bajo primero');
  return out;
}
