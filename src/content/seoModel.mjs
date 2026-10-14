/**
 * Modelo SEO programático de Groulevel, compartido por el servidor (HTML para buscadores, api/seo y el
 * prerender del build) y por la app (páginas React). Une el contenido editorial con el catálogo vigente.
 *
 * Reglas de calidad (sin páginas vacías ni combinaciones masivas):
 *  · /cursos/:habilidad       solo si hay ≥ MIN.skill programas de ≥ 2 instituciones.
 *  · /{tipo}/:area            solo si hay ≥ MIN.typeArea programas de ≥ 2 instituciones.
 *  · Carreras, habilidades, comparaciones y guías: solo las que tienen contenido editorial propio.
 *  · Estadísticas y preguntas frecuentes se calculan con datos reales; si un dato no existe, no se muestra.
 */
import { CAREERS } from './careers.mjs';
import { SKILLS } from './skills.mjs';
import { COMPARISONS } from './comparisons.mjs';
import { GUIDES } from './guides.mjs';

import { TYPE_PATHS, TYPE_PLURAL, TYPE_SINGULAR, fitTitle, typeAreaMeta, typeHubMeta } from './meta.mjs';

export { CAREERS, SKILLS, COMPARISONS, GUIDES, TYPE_PLURAL, TYPE_SINGULAR, fitTitle, typeAreaMeta, typeHubMeta };

export const MIN = { skill: 5, typeArea: 3, institutions: 2 };
export const CONTENT_UPDATED = '2026-10-13';

/** Tipos de programa con página propia (ruta en plural). */
export { TYPE_PATHS };
export const TYPE_BY_PATH = Object.fromEntries(Object.entries(TYPE_PATHS).map(([t, p]) => [p, t]));

export const careerPath = (slug) => `/carreras/${slug}`;
export const skillPath = (slug) => `/habilidades/${slug}`;
export const coursesPath = (slug) => `/cursos/${slug}`;
export const comparisonPath = (slug) => `/comparar/${slug}`;
export const guidePath = (slug) => `/guias/${slug}`;
export const typeAreaPath = (type, areaSlug) => `/${TYPE_PATHS[type]}/${areaSlug}`;

export const careerBySlug = new Map(CAREERS.map((c) => [c.slug, c]));
export const skillBySlug = new Map(SKILLS.map((s) => [s.slug, s]));
export const comparisonBySlug = new Map(COMPARISONS.map((c) => [c.slug, c]));
export const guideBySlug = new Map(GUIDES.map((g) => [g.slug, g]));

/** ¿La ruta pertenece a las páginas de contenido? (el servidor responde 404 si el slug no existe). */
export const isContentPath = (path) =>
  /^\/(carreras|habilidades|guias|cursos)(\/[^/]+)?$/.test(path) || /^\/comparar\/[^/]+$/.test(path) || path === '/analizar-perfil' ||
  new RegExp(`^/(${Object.values(TYPE_PATHS).join('|')})(/[^/]+)?$`).test(path);

export const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const regexCache = new Map();
const rx = (src) => {
  if (!regexCache.has(src)) regexCache.set(src, new RegExp(src));
  return regexCache.get(src);
};
const courseText = (c) => ` ${normalize([c.name, c.subcategory, c.published_type, ...(c.tools ?? []), ...(c.keywords ?? [])].filter(Boolean).join(' · '))} `;
const isLive = (c) => c.modality !== 'grabado';
const published = (courses) => courses.filter((c) => (c.status ?? 'publicado') === 'publicado');

/** Orden de los listados: primero cursos con clases en vivo, luego por calidad de la información. */
export const rankCourses = (list) => [...list].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.completeness ?? 0) - (a.completeness ?? 0) || a.name.localeCompare(b.name, 'es'));

export const matchesPatterns = (patterns, course) => patterns.some((p) => rx(p).test(courseText(course)));
export function matchesSkill(skill, course) {
  return (skill.categories ?? []).includes(course.category) || matchesPatterns(skill.match, course);
}
export const coursesForSkill = (skill, courses) => rankCourses(published(courses).filter((c) => matchesSkill(skill, c)));

/** Programas relacionados con una carrera: su área cuenta más que cada habilidad que enseñan. */
export function coursesForCareer(career, courses) {
  const skills = (career.skills ?? []).map((s) => skillBySlug.get(s)).filter(Boolean);
  const scored = published(courses)
    .map((c) => ({ c, s: ((career.categories ?? []).includes(c.category) ? 2 : 0) + skills.filter((sk) => matchesPatterns(sk.match, c)).length }))
    .filter((x) => x.s > 0);
  return rankCourses(scored.map((x) => x.c)).sort((a, b) => scored.find((x) => x.c === b).s - scored.find((x) => x.c === a).s);
}

const enough = (list, min) => list.length >= min && new Set(list.map((c) => c.institution_id)).size >= MIN.institutions;

/** Páginas /cursos/:habilidad que cumplen el mínimo de oferta. */
export const skillLandings = (courses) => SKILLS.map((skill) => ({ skill, courses: coursesForSkill(skill, courses) })).filter((l) => enough(l.courses, MIN.skill));

/** Páginas /{tipo}/:area que cumplen el mínimo de oferta. */
export function typeAreaLandings(courses, categories) {
  const out = [];
  for (const type of Object.keys(TYPE_PATHS)) {
    for (const cat of categories) {
      const list = rankCourses(published(courses).filter((c) => c.program_type === type && c.category === cat.id));
      if (enough(list, MIN.typeArea)) out.push({ type, category: cat, courses: list });
    }
  }
  return out;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const effPrice = (c) => (c.price == null ? null : c.discount_price ?? c.price);

/** Estadísticas reales de un conjunto de programas (solo con los datos publicados). */
export function stats(list, today = new Date().toISOString().slice(0, 10)) {
  const pen = list.filter((c) => c.currency === 'PEN' && effPrice(c) != null && effPrice(c) > 0).map(effPrice);
  const hours = list.map((c) => c.duration_hours).filter((h) => h != null && h > 0);
  const count = (key) => list.reduce((m, c) => (c[key] ? { ...m, [c[key]]: (m[c[key]] ?? 0) + 1 } : m), {});
  const starts = list.map((c) => c.start_date).filter((d) => d && d >= today).sort();
  return {
    count: list.length,
    institutions: new Set(list.map((c) => c.institution_id)).size,
    live: list.filter(isLive).length,
    noPrice: list.filter((c) => c.price == null).length,
    pricePEN: pen.length ? { min: Math.min(...pen), max: Math.max(...pen), median: median(pen), n: pen.length } : null,
    hours: hours.length ? { min: Math.min(...hours), max: Math.max(...hours), median: median(hours), n: hours.length } : null,
    modalities: count('modality'),
    types: count('program_type'),
    nextStart: starts[0] ?? null
  };
}

const soles = (n) => `S/ ${Math.round(Number(n)).toLocaleString('en-US')}`;
const MOD = { 'en-vivo': 'online en vivo', grabado: 'grabados (a tu ritmo)', hibrido: 'híbridos', presencial: 'presenciales' };

/** Preguntas frecuentes generadas solo con datos del catálogo (nada inventado). */
export function faqFor(label, st, institutionNames = []) {
  const faq = [];
  if (st.pricePEN && st.pricePEN.n >= 2) {
    faq.push({ q: `¿Cuánto cuesta un programa de ${label} en Perú?`, a: `Entre los ${st.pricePEN.n} programas con precio publicado en soles, el precio va de ${soles(st.pricePEN.min)} a ${soles(st.pricePEN.max)}, con una mediana de ${soles(st.pricePEN.median)}.${st.noPrice ? ` ${st.noPrice} ${st.noPrice === 1 ? 'programa no publica' : 'programas no publican'} su precio.` : ''} Revisa en cada ficha si hay descuentos o cuotas.` });
  }
  if (st.hours && st.hours.n >= 2) {
    faq.push({ q: `¿Cuánto dura un programa de ${label}?`, a: `En los ${st.hours.n} programas que publican sus horas, la duración va de ${st.hours.min} a ${st.hours.max} horas (mediana: ${st.hours.median} horas). Depende mucho del tipo: un curso corto no es comparable con una especialización o una maestría.` });
  }
  const mods = Object.keys(MOD).filter((m) => st.modalities[m] > 0).map((m) => `${st.modalities[m]} ${MOD[m]}`);
  if (mods.length) faq.push({ q: `¿Hay programas de ${label} en vivo o presenciales?`, a: `Sí. Hoy hay ${mods.join(', ')}. Groulevel muestra primero los programas con clases en vivo; los grabados están en su propia sección.` });
  if (institutionNames.length >= 2) {
    const shown = institutionNames.slice(0, 8);
    faq.push({ q: `¿Qué instituciones ofrecen programas de ${label}?`, a: `${st.institutions} instituciones, entre ellas ${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}.` });
  }
  return faq;
}

/** Datos reales del catálogo para la tabla de una comparación (por tipo, habilidad o carrera). */
export function comparisonStats(comparison, courses) {
  return (comparison.catalog ?? []).map((item) => {
    let list = [];
    if (item.type) list = published(courses).filter((c) => c.program_type === item.type);
    else if (item.career) list = careerBySlug.has(item.career) ? coursesForCareer(careerBySlug.get(item.career), courses) : [];
    else if (item.match) list = published(courses).filter((c) => matchesPatterns(item.match, c));
    return { label: item.label, ...stats(list) };
  });
}


const clipText = (s, n) => (String(s).length <= n ? String(s) : `${String(s).slice(0, n - 1).replace(/\s+\S*$/, '')}…`);
const fromPrice = (st) => (st.pricePEN ? `, desde ${soles(st.pricePEN.min)}` : '');

/** Títulos y descripciones de las páginas de contenido (los mismos en el HTML del servidor y en la app). */
export const HUB_META = {
  carreras: { title: 'Carreras tecnológicas: roles, habilidades y rutas | Groulevel', description: 'Explora carreras tecnológicas como Data Analyst, Data Engineer, Data Scientist o AI Engineer: qué hacen, qué habilidades necesitan y qué estudiar para llegar.' },
  habilidades: { title: 'Habilidades tecnológicas: qué aprender y dónde | Groulevel', description: 'SQL, Python, Power BI, Excel, machine learning, IA y cloud: qué es cada habilidad, para qué sirve, qué roles la usan y programas para aprenderla.' },
  cursos: { title: 'Cursos de tecnología por habilidad: compara | Groulevel' },
  guias: { title: 'Guías de orientación profesional en tecnología | Groulevel', description: 'Guías y comparaciones para decidir qué estudiar: cómo ser Data Analyst, qué estudiar para trabajar en IA, Python vs R, bootcamp vs diplomado y más.' },
  analizar: { title: 'Analiza tu perfil gratis: habilidades y brecha | Groulevel', description: 'Analiza tu experiencia, identifica tus brechas de habilidades y encuentra programas de formación alineados con tu carrera. Gratis y con tus datos protegidos.' }
};
export const coursesHubDescription = (landings) => `Compara cursos de ${landings.map((l) => l.skill.name).join(', ')} por precio, duración, modalidad e institución.`;
export const skillLandingMeta = (skill, st) => ({
  title: fitTitle(`Cursos de ${skill.name}: compara precios y programas`, `Cursos de ${skill.name}: compara precios`, `Cursos de ${skill.name}: compara programas`),
  description: clipText(`Compara ${st.count} cursos y programas de ${skill.name} de ${st.institutions} instituciones por precio, duración, modalidad y contenido${fromPrice(st)}. Encuentra la formación adecuada para tu perfil.`, 300)
});
