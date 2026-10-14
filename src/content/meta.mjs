/**
 * Metadatos (title, description, H1) de las páginas del catálogo, compartidos por el HTML del servidor
 * (scripts/seoPages.mjs → api/seo y prerender) y por la app (useSeo). Una sola fuente evita que Google vea
 * un título en el HTML inicial y otro distinto al cargar la app.
 *
 * Posicionamiento: Groulevel es un comparador. Los textos invitan a evaluar alternativas ("las mejores" =
 * la que mejor encaja contigo); no hay ranking objetivo. Solo se mencionan datos que el programa publica.
 * Módulo liviano y sin dependencias: lo carga el bundle inicial.
 */

export const BRAND = 'Groulevel';

/** Primer título candidato que cabe en ≈ 65 caracteres (con la marca si entra; si no, sin ella). */
export function fitTitle(...candidates) {
  const max = 65;
  for (const t of candidates) if (`${t} | ${BRAND}`.length <= max) return `${t} | ${BRAND}`;
  for (const t of candidates) if (t.length <= max) return t;
  return candidates.at(-1);
}

/** Tipos de programa: plural, singular y género (para "la mejor maestría" / "el mejor curso"). */
export const TYPE_INFO = {
  maestria: { plural: 'Maestrías', singular: 'maestría', fem: true },
  diplomado: { plural: 'Diplomados', singular: 'diplomado', fem: false },
  especializacion: { plural: 'Especializaciones', singular: 'especialización', fem: true },
  bootcamp: { plural: 'Bootcamps', singular: 'bootcamp', fem: false },
  curso: { plural: 'Cursos', singular: 'curso', fem: false },
  certificacion: { plural: 'Certificaciones', singular: 'certificación', fem: true },
  'programa-ejecutivo': { plural: 'Programas ejecutivos', singular: 'programa ejecutivo', fem: false },
  membresia: { plural: 'Membresías', singular: 'membresía', fem: true }
};
/** Orden en que se nombran los tipos (los de mayor nivel primero, como en "Maestrías y Cursos"). */
const TYPE_ORDER = ['maestria', 'diplomado', 'especializacion', 'bootcamp', 'curso', 'certificacion', 'programa-ejecutivo', 'membresia'];
export const TYPE_PLURAL = Object.fromEntries(Object.entries(TYPE_INFO).map(([k, v]) => [k, v.plural]));
export const TYPE_SINGULAR = Object.fromEntries(Object.entries(TYPE_INFO).map(([k, v]) => [k, v.singular]));

const joinEs = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
const lower = (s) => s.toLowerCase();

/** "Maestrías, Diplomados y Cursos": los tipos que de verdad existen en la lista (máximo `max`). */
export function typesLabel(list, max = 3) {
  const present = TYPE_ORDER.filter((t) => list.some((c) => c.program_type === t)).slice(0, max);
  return present.length ? joinEs(present.map((t) => TYPE_INFO[t].plural)) : 'Programas';
}

const MODALITY = { 'en-vivo': 'online en vivo', grabado: 'online a tu ritmo', hibrido: 'híbrida', presencial: 'presencial' };
const priceOf = (c) => (c.price == null ? null : c.discount_price ?? c.price);
const money = (n, currency) => (n === 0 ? 'gratis' : `${currency === 'USD' ? 'US$' : 'S/'} ${Math.round(Number(n)).toLocaleString('en-US')}`);
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};
const instShort = (inst) => inst?.short_name || inst?.name || '';
const hasPrice = (list) => list.some((c) => priceOf(c) != null);

/* --------------------------------- Inicio --------------------------------- */

export const HOME_COPY = {
  h1: 'Encuentra y compara las mejores maestrías, diplomados y cursos.',
  subtitle: 'Compara universidades e instituciones, precios, modalidades, duración y contenido. Encuentra el programa que mejor se adapta a tus objetivos profesionales.',
  note: 'Groulevel no es una institución educativa: reunimos y comparamos programas de distintas universidades e instituciones. Los programas destacados (patrocinados) se identifican como tales.'
};
export const homeMeta = (nCourses, nInstitutions) => ({
  title: `Compara Cursos, Diplomados y Maestrías | ${BRAND}`,
  description: `Encuentra y compara ${nCourses} maestrías, diplomados, cursos y bootcamps de ${nInstitutions} universidades e instituciones: precios, modalidades, duración y contenido.`
});

/* -------------------------------- Programa -------------------------------- */

/** "Maestría en Ciencia de Datos e Inteligencia Artificial - UTP" (H1 y base del título). */
export const programHeading = (c, inst) => `${c.name} - ${instShort(inst)}`;

export function programTitle(c, inst) {
  const full = `${programHeading(c, inst)} | ${BRAND}`;
  if (full.length <= 90) return full;
  return `${clip(c.name, Math.max(30, 90 - ` - ${instShort(inst)} | ${BRAND}`.length))} - ${instShort(inst)} | ${BRAND}`;
}

/** Artículo según la primera palabra del nombre ("la Maestría…", "el Diplomado…"); sin artículo si no se reconoce. */
function article(name) {
  const w = String(name).trim().split(/\s+/)[0]?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '';
  if (/^(maestria|especializacion|certificacion|diplomatura|carrera|ruta|membresia)$/.test(w)) return 'la ';
  if (/^(diplomado|curso|bootcamp|programa|taller|seminario|master|mba|doctorado)$/.test(w)) return 'el ';
  return '';
}

/** "Conoce la [Programa] de [Institución]. Revisa duración (…), precio (…), modalidad (…) y contenido. Compara alternativas en Groulevel." */
export function programDescription(c, inst) {
  const facts = [];
  const dur = c.duration_text || (c.duration_hours ? `${c.duration_hours} horas` : null);
  if (dur) facts.push(`duración (${dur})`);
  const p = priceOf(c);
  if (p != null) facts.push(`precio (${money(p, c.currency)})`);
  if (c.modality && MODALITY[c.modality]) facts.push(`modalidad (${MODALITY[c.modality]})`);
  if (c.syllabus?.length || c.description || c.short_description) facts.push('contenido');
  const lead = `Conoce ${article(c.name)}${c.name} de ${inst?.name ?? instShort(inst)}.`;
  return clip(`${lead} ${facts.length ? `Revisa ${joinEs(facts)}.` : 'Revisa sus detalles.'} Compara alternativas en ${BRAND}.`, 300);
}

/** Pregunta y CTA de la sección de comparación de la ficha ("¿Es esta la mejor maestría para ti?"). */
export function programCompareCopy(type) {
  const t = TYPE_INFO[type] ?? { plural: 'Programas', singular: 'programa', fem: false };
  return {
    question: `¿Es ${t.fem ? 'esta la mejor' : 'este el mejor'} ${t.singular} para ti?`,
    cta: `Comparar con ${t.fem ? 'otras' : 'otros'} ${lower(t.plural)}`,
    intro: `Depende de tus objetivos, tu presupuesto y tu tiempo. ${t.fem ? 'Compárala' : 'Compáralo'} con ${t.fem ? 'otras' : 'otros'} ${lower(t.plural)} similares según precio, duración, modalidad y contenido.`
  };
}

/**
 * Programas comparables: mismo tipo y área (otras instituciones primero, luego misma modalidad);
 * si no hay, programas de la misma área. Nunca el propio programa.
 */
export function comparablePrograms(c, all, limit = 4) {
  const pub = all.filter((x) => x.id !== c.id && (x.status ?? 'publicado') === 'publicado');
  const score = (x) => (x.institution_id !== c.institution_id ? 2 : 0) + (x.modality === c.modality ? 1 : 0);
  const sameType = pub.filter((x) => x.program_type === c.program_type && x.category === c.category).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'es'));
  if (sameType.length) return sameType.slice(0, limit);
  return pub.filter((x) => x.category === c.category).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'es')).slice(0, limit);
}

/* ------------------------------- Institución ------------------------------- */

export function institutionMeta(inst, list) {
  const types = typesLabel(list, 2);
  const name = `${types} de ${inst.name}`.length + BRAND.length + 3 <= 70 ? inst.name : instShort(inst);
  return {
    title: `${types} de ${name} | ${BRAND}`,
    description: clip(`Compara ${lower(typesLabel(list, 3))} de ${inst.name}: ${list.length} ${list.length === 1 ? 'programa' : 'programas'} con ${hasPrice(list) ? 'precios, ' : ''}duración, modalidad y contenido. Evalúalos junto a programas de otras instituciones en ${BRAND}.`, 300)
  };
}

/* ------------------------------ Área (catálogo) ------------------------------ */

export function categoryMeta(cat, list) {
  const t3 = typesLabel(list, 3);
  const t2 = typesLabel(list, 2);
  const title = [`${cat.name}: Compara ${t3}`, `${cat.name}: Compara ${t2}`, `${cat.name}: Compara Programas`].find((t) => `${t} | ${BRAND}`.length <= 70) ?? `${cat.name}: Compara Programas`;
  const insts = new Set(list.map((c) => c.institution_id)).size;
  return {
    title: `${title} | ${BRAND}`,
    h1: `${cat.name}: encuentra y compara ${lower(t3)}`,
    description: clip(`Encuentra y compara ${list.length} programas de ${cat.name} (${lower(typesLabel(list, 8))}) de ${insts} ${insts === 1 ? 'institución' : 'instituciones'}. Explora ${hasPrice(list) ? 'precios, ' : ''}duración, modalidades y contenido para elegir la mejor opción para ti.`, 300)
  };
}

/* ---------------------------- Tipo y tipo × área ---------------------------- */

/** Textos de los listados por tipo (/maestrias, /diplomados…). "Mejores" = invitación a comparar, no ranking. */
export function typeHubCopy(type) {
  const t = TYPE_INFO[type];
  const best = t.fem ? 'las mejores' : 'los mejores';
  const who = type === 'maestria' || type === 'especializacion' ? 'universidades' : type === 'bootcamp' ? 'academias e instituciones' : 'universidades e instituciones';
  return {
    h1: `Encuentra y compara ${best} ${lower(t.plural)}`,
    subtitle: `Explora ${lower(t.plural)} de distintas ${who}, compara precios, duración, modalidad y contenido, y elige ${t.fem ? 'la' : 'el'} que mejor se adapta a tus objetivos.`,
    note: `Groulevel no publica un ranking: ${t.fem ? '“la mejor”' : '“el mejor”'} es ${t.fem ? 'la' : 'el'} que mejor encaja con tu perfil, tu presupuesto y tu tiempo.`
  };
}

export const typeHubMeta = (type, st) => {
  const t = TYPE_INFO[type];
  return {
    title: `Encuentra y Compara ${t.fem ? 'las Mejores' : 'los Mejores'} ${t.plural} | ${BRAND}`,
    description: clip(`Encuentra y compara ${st.count} ${lower(t.plural)} de ${st.institutions} universidades e instituciones: ${st.pricePEN ? 'precios, ' : ''}duración, modalidades y contenido para elegir la mejor opción para ti.`, 300)
  };
};

export const typeAreaMeta = (type, category, st) => {
  const t = TYPE_INFO[type];
  const label = `${t.plural} en ${category.name}`;
  const who = type === 'maestria' || type === 'especializacion' ? 'universidades' : 'instituciones';
  return {
    label,
    title: `${label}: Compara Programas | ${BRAND}`.length <= 70 ? `${label}: Compara Programas | ${BRAND}` : fitTitle(`${label}: Compara Programas`, label),
    description: clip(`Encuentra y compara ${st.count} ${lower(t.plural)} en ${category.name}. Explora ${who}, ${st.pricePEN ? 'precios, ' : ''}duración y modalidades para elegir la mejor opción para ti.`, 300)
  };
};

/* ------------------------------ Listado general ------------------------------ */

export const programsMeta = (nCourses) => ({
  title: `Todos los Programas: Busca, Filtra y Compara | ${BRAND}`,
  h1: 'Busca y compara programas',
  description: `Explora ${nCourses} maestrías, diplomados, cursos y bootcamps de distintas universidades e instituciones. Filtra por precio, modalidad, duración y nivel, y compáralos lado a lado.`
});

/** Rutas de los listados por tipo (mismas que TYPE_PATHS de seoModel.mjs). */
export const TYPE_PATHS = { diplomado: 'diplomados', bootcamp: 'bootcamps', maestria: 'maestrias', especializacion: 'especializaciones' };

/**
 * Listado al que lleva "Comparar con otras maestrías": /{tipo}/{área} si esa página existe (≥ 3 programas de
 * ≥ 2 instituciones, la regla de typeAreaLandings), si no /{tipo} (≥ 3 programas) y, en último caso, el área.
 */
export function compareListingPath(c, all, categorySlug) {
  const pub = all.filter((x) => (x.status ?? 'publicado') === 'publicado');
  const seg = TYPE_PATHS[c.program_type];
  if (seg && categorySlug) {
    const same = pub.filter((x) => x.program_type === c.program_type && x.category === c.category);
    if (same.length >= 3 && new Set(same.map((x) => x.institution_id)).size >= 2) return `/${seg}/${categorySlug}`;
  }
  if (seg && pub.filter((x) => x.program_type === c.program_type).length >= 3) return `/${seg}`;
  return categorySlug ? `/programas/${categorySlug}` : '/programas';
}
