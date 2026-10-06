/**
 * Motor de diagnóstico de perfil y ruta de formación ("Mi ruta").
 *
 * Es puro (sin E/S) y se usa en el servidor de dos formas:
 *  - Motor por reglas completo cuando no hay IA configurada o la IA falla.
 *  - Utilidades de saneamiento/relleno para el resultado de la IA (niveles, cursos válidos, etapas vacías).
 */
import type {
  AreaScore,
  EducationItem,
  EducationLevel,
  EducationStatus,
  ExperienceItem,
  LanguageItem,
  PersonalData,
  ProfileEvaluation,
  ProfileExtract,
  ProfilePreferences,
  ProficiencyLevel,
  RouteStage,
  Seniority,
  SkillScore,
  TrainingRoute
} from '../types/profile';
import { normalize } from './text.js';

/** Programa del catálogo con lo mínimo que necesita el motor. */
export interface RouteCourse {
  id: string;
  name: string;
  category: string;
  level: 'basico' | 'intermedio' | 'avanzado' | null;
  program_type: string;
  modality: string | null;
  price_pen: number | null;
  duration_hours: number | null;
  tools: string[];
  keywords: string[];
  institution_name: string;
  featured: boolean;
}

export interface RouteCategory { id: string; name: string; keywords: string[] }

export interface AnalysisInput {
  text: string;
  objective: string;
  preferences: ProfilePreferences;
}

export const PROFILE_LIMITS = { objectiveMin: 15, objectiveMax: 800, descriptionMin: 60, textMax: 60_000, fileMaxBytes: 4 * 1024 * 1024 };

// ───────────────────────── Diccionarios ─────────────────────────

/** Señales adicionales por materia (además de las palabras clave de la categoría y las herramientas del catálogo). */
export const AREA_SIGNALS: Record<string, string[]> = {
  'data-analytics': ['excel', 'power bi', 'tableau', 'dax', 'power query', 'looker', 'dashboard', 'dashboards', 'reportes', 'reporting', 'kpi', 'kpis', 'analisis de datos', 'analista de datos', 'data analyst', 'sql', 'visualizacion de datos'],
  'data-science': ['python', 'r', 'estadistica', 'pandas', 'numpy', 'modelos predictivos', 'regresion', 'ciencia de datos', 'data scientist', 'cientifico de datos', 'cientifica de datos', 'jupyter'],
  'data-engineering': ['etl', 'spark', 'airflow', 'databricks', 'bigquery', 'kafka', 'data lake', 'datalake', 'pipelines', 'redshift', 'glue', 'data engineer', 'ingeniero de datos', 'ingeniera de datos', 'snowflake', 'data warehouse'],
  'inteligencia-artificial': ['inteligencia artificial', 'ia', 'ai', 'vision por computador', 'nlp', 'procesamiento de lenguaje natural'],
  'machine-learning': ['machine learning', 'aprendizaje automatico', 'scikit learn', 'sklearn', 'tensorflow', 'pytorch', 'mlflow', 'deep learning', 'redes neuronales', 'mlops'],
  'ia-generativa': ['chatgpt', 'openai', 'llm', 'llms', 'prompt', 'prompts', 'prompt engineering', 'langchain', 'langgraph', 'gemini', 'claude', 'copilot', 'rag', 'agentes de ia', 'ia generativa', 'genai', 'hugging face'],
  'desarrollo-de-software': ['javascript', 'typescript', 'java', 'react', 'node.js', 'node', 'html', 'css', 'programacion', 'desarrollador', 'developer', 'programador', 'backend', 'frontend', 'full stack', 'fullstack', 'spring boot', 'git', 'c#', '.net', 'php', 'angular', 'vue', 'api', 'apis', 'kotlin', 'flutter', 'react native'],
  'cloud-computing': ['aws', 'azure', 'gcp', 'google cloud', 'cloud', 'nube', 'lambda', 's3', 'ec2', 'arquitecto cloud'],
  'ciberseguridad': ['seguridad informatica', 'ciberseguridad', 'pentesting', 'iso 27001', 'ethical hacking', 'hacking etico', 'soc', 'firewall', 'seguridad de la informacion', 'vulnerabilidades', 'siem'],
  devops: ['docker', 'kubernetes', 'ci cd', 'jenkins', 'terraform', 'devops', 'linux', 'github actions', 'sre', 'ansible'],
  'product-management': ['product manager', 'product owner', 'producto digital', 'roadmap', 'discovery', 'gestion de producto', 'okrs'],
  'ux-ui': ['ux', 'ui', 'figma', 'experiencia de usuario', 'usabilidad', 'prototipado', 'design thinking', 'diseno de interfaces', 'ux research'],
  'business-analytics': ['inteligencia de negocios', 'business intelligence', 'analisis de negocio', 'business analyst', 'finanzas', 'presupuestos', 'planeamiento financiero', 'modelos financieros'],
  'negocios-digitales': ['e commerce', 'ecommerce', 'transformacion digital', 'modelo de negocio', 'emprendimiento', 'negocios digitales', 'marketplace', 'startup'],
  automatizacion: ['automatizacion', 'automatizar', 'rpa', 'n8n', 'zapier', 'make', 'power automate', 'vba', 'macros', 'uipath'],
  'no-code-low-code': ['no code', 'low code', 'bubble', 'power apps', 'appsheet', 'webflow', 'glide'],
  'marketing-digital': ['marketing', 'marketing digital', 'seo', 'sem', 'google ads', 'meta ads', 'facebook ads', 'redes sociales', 'community manager', 'contenidos', 'growth', 'crm', 'hubspot', 'email marketing', 'google analytics', 'branding', 'publicidad'],
  'gestion-de-proyectos': ['gestion de proyectos', 'jefe de proyectos', 'project manager', 'pmp', 'pmi', 'scrum', 'scrum master', 'agile', 'agil', 'agilidad', 'kanban', 'jira', 'pmbok', 'ms project'],
  'gestion-de-ti': ['itil', 'cobit', 'gobierno de ti', 'service desk', 'mesa de ayuda', 'gestion de servicios', 'soporte ti', 'infraestructura ti']
};

const EXTRA_TOOLS = ['Word', 'PowerPoint', 'Outlook', 'SAP', 'Salesforce', 'HubSpot', 'Figma', 'Jira', 'Trello', 'Notion', 'R', 'Scrum', 'Google Analytics', 'Meta Ads', 'Google Sheets', 'TypeScript', 'Angular', 'Vue', 'C#', '.NET', 'PHP', 'Oracle', 'Snowflake', 'Canva', 'Photoshop', 'Illustrator', 'MS Project', 'Odoo', 'Zapier', 'Make', 'UiPath', 'Power Automate', 'Power Apps', 'Kotlin', 'Flutter', 'Swift', 'Terraform', 'Jenkins', 'Scikit-learn', 'PyTorch', 'Keras', 'Jupyter'];

export const SOFT_SKILLS: { name: string; signals: string[] }[] = [
  { name: 'Comunicación', signals: ['comunicacion', 'comunicacion efectiva', 'presentaciones', 'oratoria', 'redaccion', 'expositor', 'capacitaciones', 'capacite'] },
  { name: 'Trabajo en equipo', signals: ['trabajo en equipo', 'colaboracion', 'colaborativo', 'equipos multidisciplinarios', 'multidisciplinario', 'cross functional', 'interareas'] },
  { name: 'Liderazgo', signals: ['liderazgo', 'lidere', 'liderando', 'a cargo de', 'supervision', 'supervise', 'equipo de', 'jefe', 'gerente', 'coordinador', 'lider', 'manager', 'head of'] },
  { name: 'Resolución de problemas', signals: ['resolucion de problemas', 'solucion de problemas', 'mejora continua', 'optimice', 'optimizacion', 'resolver', 'troubleshooting'] },
  { name: 'Pensamiento analítico', signals: ['analitico', 'analitica', 'pensamiento critico', 'pensamiento analitico', 'toma de decisiones', 'analisis'] },
  { name: 'Adaptabilidad y aprendizaje', signals: ['adaptabilidad', 'flexibilidad', 'aprendizaje continuo', 'autodidacta', 'proactivo', 'proactividad', 'cambio', 'resiliencia'] },
  { name: 'Orientación a resultados', signals: ['orientacion a resultados', 'resultados', 'logre', 'logro', 'incremente', 'aumente', 'reduje', 'metas', 'cumplimiento de objetivos'] },
  { name: 'Negociación', signals: ['negociacion', 'negocie', 'negociar', 'proveedores', 'cierre de ventas', 'ventas'] },
  { name: 'Organización y gestión del tiempo', signals: ['organizacion', 'organizado', 'planificacion', 'gestion del tiempo', 'multitarea', 'priorizacion', 'cronogramas'] },
  { name: 'Creatividad e innovación', signals: ['creatividad', 'innovacion', 'creativo', 'innovador', 'ideacion', 'design thinking'] }
];

const COUNTRIES: [string, string[]][] = [
  ['Perú', ['peru', 'lima', 'arequipa', 'trujillo', 'cusco', 'piura', 'chiclayo', 'callao', 'huancayo']],
  ['México', ['mexico', 'cdmx', 'monterrey', 'guadalajara', 'puebla']],
  ['Colombia', ['colombia', 'bogota', 'medellin', 'cali', 'barranquilla']],
  ['Chile', ['chile', 'santiago de chile', 'valparaiso', 'concepcion']],
  ['Argentina', ['argentina', 'buenos aires', 'cordoba', 'rosario', 'mendoza']],
  ['Ecuador', ['ecuador', 'quito', 'guayaquil', 'cuenca']],
  ['Bolivia', ['bolivia', 'la paz', 'santa cruz de la sierra', 'cochabamba']],
  ['Venezuela', ['venezuela', 'caracas', 'maracaibo']],
  ['Uruguay', ['uruguay', 'montevideo']],
  ['Paraguay', ['paraguay', 'asuncion']],
  ['España', ['espana', 'madrid', 'barcelona', 'valencia', 'sevilla']],
  ['Costa Rica', ['costa rica', 'san jose de costa rica']],
  ['Panamá', ['panama']],
  ['Guatemala', ['guatemala']],
  ['República Dominicana', ['republica dominicana', 'santo domingo']],
  ['Estados Unidos', ['estados unidos', 'usa', 'miami', 'new york', 'nueva york']],
  ['Brasil', ['brasil', 'sao paulo']]
];
const PHONE_PREFIX: Record<string, string> = { '51': 'Perú', '52': 'México', '57': 'Colombia', '56': 'Chile', '54': 'Argentina', '593': 'Ecuador', '591': 'Bolivia', '58': 'Venezuela', '598': 'Uruguay', '595': 'Paraguay', '34': 'España', '506': 'Costa Rica', '507': 'Panamá', '502': 'Guatemala', '1': 'Estados Unidos', '55': 'Brasil' };

const DEGREE_RANK: EducationLevel[] = ['otro', 'secundaria', 'certificacion', 'tecnico', 'bachiller', 'licenciatura', 'maestria', 'doctorado'];
export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  secundaria: 'Secundaria', tecnico: 'Técnico', bachiller: 'Bachiller / Grado', licenciatura: 'Licenciatura / Título profesional',
  maestria: 'Maestría / MBA', doctorado: 'Doctorado', certificacion: 'Diplomado / Especialización', otro: 'Otro'
};
export const SENIORITY_LABELS: Record<Seniority, string> = {
  estudiante: 'Estudiante / Practicante', junior: 'Junior', 'semi-senior': 'Semi senior', senior: 'Senior', lider: 'Líder / Jefatura', ejecutivo: 'Gerencia / Dirección', 'no-indicado': 'No indicado'
};
export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  'sin-evidencia': 'Sin evidencia', basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado', experto: 'Experto'
};

// ───────────────────────── Utilidades ─────────────────────────

const CURRENT_YEAR = () => new Date().getFullYear();
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
const pad = (s: string) => ` ${s} `;
const uniq = <T,>(arr: T[]) => [...new Set(arr)];

/** Cuenta apariciones de una frase (normalizada) como palabra completa. */
function countPhrase(haystack: string, phrase: string): number {
  const needle = normalize(phrase);
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  const target = pad(needle);
  for (;;) {
    const i = haystack.indexOf(target, from);
    if (i < 0) break;
    count++;
    from = i + target.length - 1;
  }
  return count;
}

export function levelFromScore(score: number): ProficiencyLevel {
  if (score <= 0) return 'sin-evidencia';
  if (score < 35) return 'basico';
  if (score < 60) return 'intermedio';
  if (score < 80) return 'avanzado';
  return 'experto';
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y)\b/g, (w) => w.toLowerCase());

/** Mapa materia → señales (palabras clave de la categoría + diccionario + herramientas frecuentes del catálogo). */
export function buildAreaSignals(categories: RouteCategory[], courses: RouteCourse[]): Map<string, string[]> {
  const tally = new Map<string, Map<string, number>>();
  for (const c of courses) {
    const m = tally.get(c.category) ?? new Map<string, number>();
    for (const t of c.tools) m.set(t, (m.get(t) ?? 0) + 1);
    tally.set(c.category, m);
  }
  const out = new Map<string, string[]>();
  for (const cat of categories) {
    const frequent = [...(tally.get(cat.id) ?? new Map()).entries()].filter(([, n]) => n >= 2).map(([t]) => t);
    out.set(cat.id, uniq([cat.name, ...cat.keywords, ...(AREA_SIGNALS[cat.id] ?? []), ...frequent].map(normalize).filter((s) => s.length > 0)));
  }
  return out;
}

// ───────────────────────── Extracción ─────────────────────────

const NAME_STOP = /(curr[ií]cul|vitae|\bcv\b|hoja de vida|perfil|resumen|datos personales|contacto|experiencia|educaci|formaci|@|http|www\.|\d)/i;
const ROLE_WORDS = /(analista|ingenier[oa]|gerente|jefe|jefa|coordinador[a]?|desarrollador[a]?|developer|programador[a]?|consultor[a]?|asistente|especialista|l[ií]der|director[a]?|practicante|dise[nñ]ador[a]?|ejecutiv[oa]|supervisor[a]?|administrador[a]?|contador[a]?|auxiliar|t[eé]cnico|manager|engineer|analyst|scientist|cient[ií]fic[oa]|arquitect[oa]|docente|profesor[a]?|vendedor[a]?|asesor[a]?|representante|product owner|scrum master|head|lead|owner|encargad[oa]|operador[a]?|investigador[a]?|abogad[oa]|m[eé]dic[oa]|enfermer[oa]|economista|psic[oó]log[oa]|community manager|trainee|becari[oa])/i;
const YEAR_RANGE = /((?:19|20)\d{2})\s*(?:[-–—]|a|al|hasta)\s*((?:19|20)\d{2}|actualidad|presente|hoy|la fecha|actual|now|present)/i;

export function extractPersonal(text: string, source: 'cv' | 'texto'): PersonalData {
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0]?.toLowerCase() ?? null;
  const linkedin = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w%-]+/i)?.[0] ?? null;

  let phone: string | null = null;
  for (const m of text.matchAll(/(\+?\(?\d[\d \t().-]{6,18}\d)/g)) {
    const raw = m[1];
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    if (/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}/.test(raw)) continue;
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(raw)) continue;
    phone = raw.trim().replace(/\s+/g, ' ');
    break;
  }

  const n = pad(normalize(text));
  let country: string | null = null;
  let best = 0;
  for (const [name, signals] of COUNTRIES) {
    const hits = signals.reduce((acc, s) => acc + countPhrase(n, s), 0);
    if (hits > best) { best = hits; country = name; }
  }
  if (!country && phone?.startsWith('+')) {
    const d = phone.replace(/\D/g, '');
    const prefix = ['593', '591', '598', '595', '506', '507', '502', '51', '52', '57', '56', '54', '58', '34', '55', '1'].find((p) => d.startsWith(p));
    if (prefix) country = PHONE_PREFIX[prefix];
  }

  let first_name: string | null = null;
  let last_name: string | null = null;
  const split = (full: string) => {
    const parts = titleCase(full.trim()).split(/\s+/);
    if (parts.length < 2 || parts.length > 5) return;
    const nFirst = parts.length >= 4 ? 2 : 1;
    first_name = parts.slice(0, nFirst).join(' ');
    last_name = parts.slice(nFirst).join(' ');
  };
  if (source === 'texto') {
    const m = text.match(/(?:[Mm]e llamo|[Mm]i nombre es|[Ss]oy)\s+((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*){2,4})/);
    if (m && !ROLE_WORDS.test(m[1])) split(m[1]);
  } else {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8);
    for (const line of lines) {
      const clean = line.replace(/[|•·,]/g, ' ').replace(/\s+/g, ' ').trim();
      if (NAME_STOP.test(clean) || ROLE_WORDS.test(clean)) continue;
      if (/^[\p{L}' .-]{4,60}$/u.test(clean) && clean.split(' ').length >= 2 && clean.split(' ').length <= 5) {
        split(clean.replace(/\./g, ''));
        if (first_name) break;
      }
    }
  }
  const cityMatch = text.match(/\b(Lima|Arequipa|Trujillo|Cusco|Piura|Chiclayo|Bogotá|Medellín|Cali|Quito|Guayaquil|Santiago|Buenos Aires|Córdoba|Ciudad de México|CDMX|Monterrey|Guadalajara|La Paz|Montevideo|Madrid|Barcelona|Caracas|Asunción|Panamá|San José)\b/);
  return { first_name, last_name, email, phone, country, city: cityMatch?.[1] ?? null, linkedin };
}

const INSTITUTION_RE = /((?:Pontificia\s+)?Universi(?:dad|ty|tat)[^,\n|•;()]{0,70}|Instituto[^,\n|•;()]{0,60}|Escuela[^,\n|•;()]{0,60}|\b(?:PUCP|UPC|UNMSM|UNI|ESAN|ULima|USIL|UPN|UTP|UDEP|UNALM|UCSUR|ISIL|IDAT|TECSUP|Tecsup|Cibertec|CIBERTEC|SENATI|Senati|UP|UNAM|ITAM|UBA|UNAL|UC|PUC|IPN|Toulouse Lautrec|Certus|Zegel)\b)/;

function detectLevel(line: string): EducationLevel | null {
  const n = normalize(line);
  if (/\b(doctorado|doctor en|ph ?d)\b/.test(n)) return 'doctorado';
  if (/\b(maestria|magister|master|mba|msc)\b/.test(n)) return 'maestria';
  if (/\b(licenciad[oa]|licenciatura|titulad[oa]|titulo profesional|titulo de)\b/.test(n)) return 'licenciatura';
  if (/\b(bachiller|grado en|egresad[oa] de|carrera de|estudiante de|estudios de|pregrado|ingenieria|ingeniero en|ingeniera en)\b/.test(n)) return 'bachiller';
  if (/\b(tecnic[oa] (en|profesional|superior)|profesional tecnico|computacion e informatica)\b/.test(n)) return 'tecnico';
  if (/\b(diplomado|especializacion|posgrado|postgrado|programa de especializacion)\b/.test(n)) return 'certificacion';
  if (/\b(secundaria|colegio)\b/.test(n)) return 'secundaria';
  return null;
}

function detectStatus(line: string): EducationStatus {
  const n = normalize(line);
  if (/(en curso|cursando|actualidad|presente|actualmente|estudiante de|\bhoy\b|ciclo)/.test(n)) return 'en-curso';
  if (/(trunc|incomplet|no concluid)/.test(n)) return 'incompleto';
  if (/(egresad|titulad|bachiller|graduad|concluid|complet|(19|20)\d{2})/.test(n)) return 'completo';
  return 'no-indicado';
}

function lastYear(line: string): number | null {
  const years = [...line.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1])).filter((y) => y <= CURRENT_YEAR() + 6);
  return years.length ? Math.max(...years) : null;
}

export function extractEducation(text: string): EducationItem[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const items: EducationItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const level = detectLevel(line);
    if (!level) continue;
    const context = [lines[i - 1] ?? '', line, lines[i + 1] ?? ''];
    const inst = line.match(INSTITUTION_RE)?.[1] ?? context.map((l) => l.match(INSTITUTION_RE)?.[1]).find(Boolean) ?? null;
    if (!inst && level !== 'certificacion' && level !== 'secundaria' && !/(bachiller|titulo|grado|maestria|mba|doctor|licenciad)/i.test(normalize(line))) continue;
    const field = line.match(/\b(?:en|de)\s+([A-ZÁÉÍÓÚÑ][^,|•;\n(0-9]{2,70})/)?.[1]?.trim().replace(/\s*[-–]\s*$/, '') ?? null;
    const degree = line.replace(YEAR_RANGE, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/[|•·–—-]\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (items.some((it) => normalize(it.degree) === normalize(degree))) continue;
    items.push({
      degree,
      field: field && normalize(field) !== normalize(inst ?? '') ? field.slice(0, 80) : null,
      institution: inst ? inst.trim().replace(/\s+/g, ' ').slice(0, 90) : null,
      level,
      status: (() => {
        const own = detectStatus(line);
        return own === 'no-indicado' && lines[i + 1] && !detectLevel(lines[i + 1]) ? detectStatus(lines[i + 1]) : own;
      })(),
      end_year: lastYear(line) ?? lastYear(lines[i + 1] ?? '')
    });
    if (items.length >= 8) break;
  }
  return items;
}

export function extractExperience(text: string): { items: ExperienceItem[]; years: number | null } {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const items: ExperienceItem[] = [];
  const ranges: [number, number][] = [];
  const now = CURRENT_YEAR();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(YEAR_RANGE);
    if (!m) continue;
    const start = Number(m[1]);
    const current = !/^\d/.test(m[2]);
    const end = current ? now : Number(m[2]);
    if (end < start || start < 1970) continue;
    const near = [lines[i], lines[i - 1] ?? '', lines[i + 1] ?? ''];
    const roleLine = near.find((l) => ROLE_WORDS.test(l) && !detectLevel(l));
    if (!roleLine) continue; // probablemente es formación, no experiencia
    ranges.push([start, end]);
    const cleaned = roleLine.replace(YEAR_RANGE, '').replace(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?\b/gi, '').replace(/[()]/g, '').replace(/\s+/g, ' ').replace(/^[\s|•·,–—-]+|[\s|•·,–—-]+$/g, '').trim();
    const [rolePart, companyPart] = cleaned.split(/\s+(?:en|@|at)\s+|\s*[|–—-]\s+|,\s*/).map((s) => s?.trim()).filter(Boolean) as string[];
    const role = rolePart && ROLE_WORDS.test(rolePart) ? rolePart : cleaned;
    const company = companyPart && !ROLE_WORDS.test(companyPart) ? companyPart : (rolePart && !ROLE_WORDS.test(rolePart) ? rolePart : null);
    if (items.some((it) => it.role === role && it.start_year === start)) continue;
    items.push({ role: role.slice(0, 90), company: company ? company.slice(0, 80) : null, start_year: start, end_year: current ? null : end, current });
    if (items.length >= 10) break;
  }
  // Unión de rangos para no contar dos veces trabajos simultáneos.
  ranges.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const r of ranges) {
    if (!cur || r[0] > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [...r]; } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) total += cur[1] - cur[0];
  const declared = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:años|anos|years)\s+(?:de\s+)?(?:experiencia|experience)/gi)].map((m) => Number(m[1]));
  const years = declared.length ? Math.max(...declared) : ranges.length ? Math.max(total, ranges.length ? 1 : 0) : null;
  items.sort((a, b) => Number(b.current) - Number(a.current) || (b.start_year ?? 0) - (a.start_year ?? 0));
  return { items, years: years !== null ? Math.min(years, 50) : null };
}

function extractLanguages(text: string): LanguageItem[] {
  const out: LanguageItem[] = [];
  const re = /\b(ingl[eé]s|english|portugu[eé]s|franc[eé]s|alem[aá]n|italiano|chino|mandar[ií]n|japon[eé]s|quechua|espa[nñ]ol)\b[^\n\w]{0,4}(b[aá]sico|intermedio|avanzado|nativo|materna|fluido|biling[uü]e|a1|a2|b1|b2|c1|c2)?/gi;
  for (const m of text.matchAll(re)) {
    const language = titleCase(normalize(m[1]) === 'english' ? 'Inglés' : m[1]);
    if (out.some((l) => normalize(l.language) === normalize(language))) continue;
    out.push({ language, level: m[2] ? titleCase(m[2]) : 'No indicado' });
  }
  return out.slice(0, 6);
}

function extractCertifications(text: string): string[] {
  return uniq(
    text.split(/\n/).map((l) => l.trim().replace(/^[-•·*]\s*/, ''))
      .filter((l) => /(certificaci[oó]n|certificado|certified|certification|\bpmp\b|scrum master|\bpsm\b|\bcsm\b|itil|cisco|ccna|google analytics|aws certified|azure fundamentals|az-\d{3}|toefl|ielts)/i.test(l) && l.length <= 140)
  ).slice(0, 10);
}

function detectSeniority(role: string | null, years: number | null, text: string): Seniority {
  const r = normalize(role ?? '');
  if (/\b(gerente|director|head|chief|vp|ceo|cto|cfo|coo|cio)\b/.test(r)) return 'ejecutivo';
  if (/\b(jefe|jefa|lider|coordinador|coordinadora|manager|lead|supervisor|supervisora)\b/.test(r)) return 'lider';
  if (/\b(practicante|trainee|becario|becaria|interno|interna)\b/.test(r) || (!role && /\b(estudiante|egresado reciente|recien egresad)/.test(normalize(text)))) return 'estudiante';
  if (/\b(senior|sr)\b/.test(r)) return 'senior';
  if (years === null) return role ? 'junior' : 'no-indicado';
  if (years >= 6) return 'senior';
  if (years >= 3) return 'semi-senior';
  return 'junior';
}

export function extractProfile(text: string, source: 'cv' | 'texto', toolDictionary: string[]): ProfileExtract {
  const personal = extractPersonal(text, source);
  const education = extractEducation(text);
  const { items: experience, years } = extractExperience(text);
  const n = pad(normalize(text));

  let current_role = experience.find((e) => e.current)?.role ?? null;
  let current_company = experience.find((e) => e.current)?.company ?? null;
  if (!current_role) {
    const m = text.match(/(?:trabajo como|me desempeño como|me desempeno como|actualmente soy|actualmente trabajo como|soy|cargo actual:?|puesto actual:?)\s+(?:un |una )?([^.,;\n]{3,70})/i);
    if (m && ROLE_WORDS.test(m[1])) {
      const [role, company] = m[1].split(/\s+en\s+/);
      current_role = role.trim();
      current_company = company?.trim() ?? current_company;
    }
  }
  if (!current_role && experience[0]) current_role = experience[0].role;

  const highest = education.reduce<EducationLevel | null>((acc, e) => (!acc || DEGREE_RANK.indexOf(e.level) > DEGREE_RANK.indexOf(acc) ? e.level : acc), null);
  const studying = education.find((e) => e.status === 'en-curso');
  const tools = toolDictionary.filter((t) => countPhrase(n, t) > 0);

  let headline: string | null = null;
  if (source === 'cv') {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);
    headline = lines.find((l) => ROLE_WORDS.test(l) && l.length <= 90 && !l.includes('@')) ?? null;
  }
  return {
    personal,
    current_role,
    current_company,
    headline: headline ?? current_role,
    seniority: detectSeniority(current_role, years, text),
    years_experience: years,
    highest_degree: highest,
    current_studies: studying ? (studying.institution && !studying.degree.includes(studying.institution) ? `${studying.degree} · ${studying.institution}` : studying.degree) : null,
    education,
    experience,
    certifications: extractCertifications(text),
    languages: extractLanguages(text),
    tools
  };
}

// ───────────────────────── Evaluación ─────────────────────────

export function toolDictionary(courses: RouteCourse[]): string[] {
  const all = uniq([...courses.flatMap((c) => c.tools), ...EXTRA_TOOLS]);
  // Herramientas de una sola letra o muy genéricas generan falsos positivos.
  return all.filter((t) => t.length > 1 || t === 'R').sort((a, b) => b.length - a.length);
}

export function evaluateProfile(text: string, extract: ProfileExtract, categories: RouteCategory[], signals: Map<string, string[]>): ProfileEvaluation {
  const n = pad(normalize(text));
  const years = extract.years_experience ?? 0;

  const areas: AreaScore[] = categories.map((cat) => {
    const hits = (signals.get(cat.id) ?? []).map((s) => [s, countPhrase(n, s)] as const).filter(([, c]) => c > 0);
    const distinct = hits.length;
    const mentions = hits.reduce((a, [, c]) => a + c, 0);
    let score = distinct ? distinct * 11 + Math.min(mentions, 20) * 2 : 0;
    if (distinct >= 2 && years >= 3) score += 10;
    if (distinct >= 3 && years >= 6) score += 10;
    score = clamp(score, 0, 95);
    const top = [...hits].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s]) => s);
    return { area_id: cat.id, area: cat.name, score, level: levelFromScore(score), evidence: top.length ? `Menciona: ${top.join(', ')}.` : 'Sin evidencia en la información entregada.' };
  });

  const technical_skills: SkillScore[] = extract.tools
    .map((t) => {
      const mentions = countPhrase(n, t);
      const score = clamp(40 + 10 * Math.min(mentions - 1, 3) + (years >= 3 ? 10 : 0) + (years >= 6 ? 5 : 0), 0, 90);
      return { name: t, score, level: levelFromScore(score), evidence: mentions > 1 ? `Mencionado ${mentions} veces.` : 'Mencionado en tu perfil.' };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const soft_skills: SkillScore[] = SOFT_SKILLS.map(({ name, signals: s }) => {
    const hits = s.filter((x) => countPhrase(n, x) > 0);
    let score = hits.length ? 45 + 12 * (hits.length - 1) : 0;
    if (name === 'Liderazgo' && (extract.seniority === 'lider' || extract.seniority === 'ejecutivo')) score = Math.max(score, 70);
    score = clamp(score, 0, 85);
    return { name, score, level: levelFromScore(score), evidence: hits.length ? `Evidencia: ${hits.slice(0, 3).join(', ')}.` : 'No se menciona; conviene demostrarla con ejemplos.' };
  });

  const topAreas = [...areas].filter((a) => a.score > 0).sort((a, b) => b.score - a.score);
  const strengths = uniq([
    ...topAreas.slice(0, 3).map((a) => `${a.area} (${PROFICIENCY_LABELS[a.level].toLowerCase()})`),
    ...technical_skills.slice(0, 3).map((t) => `Manejo de ${t.name}`),
    ...soft_skills.filter((s) => s.score >= 60).slice(0, 2).map((s) => s.name)
  ]).slice(0, 6);

  const role = extract.current_role ? `como ${extract.current_role}` : '';
  const exp = extract.years_experience ? `${extract.years_experience} año${extract.years_experience === 1 ? '' : 's'} de experiencia` : 'experiencia no indicada';
  const edu = extract.highest_degree ? `formación de nivel ${EDUCATION_LABELS[extract.highest_degree]}` : 'formación no indicada';
  const summary = `Perfil ${SENIORITY_LABELS[extract.seniority].toLowerCase()} ${role} con ${exp} y ${edu}.${topAreas.length ? ` Tus mayores conocimientos están en ${topAreas.slice(0, 3).map((a) => a.area).join(', ')}.` : ' La información no muestra conocimientos técnicos específicos; detallar herramientas y proyectos mejorará el diagnóstico.'}`.replace(/\s+/g, ' ');

  return { summary, areas, technical_skills, soft_skills, strengths, gaps: [] };
}

// ───────────────────────── Ruta de formación ─────────────────────────

const LEVEL_ORDER = { basico: 0, intermedio: 1, avanzado: 2 } as const;
type StageLevel = keyof typeof LEVEL_ORDER;

/** Nivel efectivo de un programa (si no está publicado, se infiere del nombre/tipo). */
export function courseLevel(c: RouteCourse): StageLevel {
  if (c.level) return c.level;
  const n = normalize(c.name);
  if (/\b(fundamentos|introduccion|desde cero|basico|basica|inicial|principiantes|primeros pasos|esencial)\b/.test(n)) return 'basico';
  if (/\b(avanzado|avanzada|experto|master|masterclass|arquitectura|senior)\b/.test(n) || ['maestria', 'programa-ejecutivo'].includes(c.program_type)) return 'avanzado';
  return 'intermedio';
}

function fitsPreferences(c: RouteCourse, p: ProfilePreferences): boolean {
  if (p.modality !== 'cualquiera' && c.modality && c.modality !== p.modality && !(c.modality === 'hibrido' && p.modality !== 'grabado')) return false;
  if (p.budget_pen !== null && c.price_pen !== null && c.price_pen > p.budget_pen) return false;
  return true;
}

/** Materias a las que apunta el objetivo, con su peso. */
export function objectiveAreas(objective: string, categories: RouteCategory[], signals: Map<string, string[]>, courses: RouteCourse[]): { id: string; weight: number }[] {
  const n = pad(normalize(objective));
  const scores = new Map<string, number>();
  for (const cat of categories) {
    // Señales curadas pesan más que las herramientas frecuentes del catálogo (que se comparten entre materias).
    const curated = new Set([cat.name, ...cat.keywords, ...(AREA_SIGNALS[cat.id] ?? [])].map(normalize));
    const s = (signals.get(cat.id) ?? []).reduce((acc, kw) => acc + (countPhrase(n, kw) > 0 ? (curated.has(kw) ? (kw.includes(' ') ? 3 : 2) : 1) : 0), 0);
    if (s > 0) scores.set(cat.id, s);
  }
  // Señal secundaria: programas cuyo nombre coincide con el objetivo.
  const tokens = normalize(objective).split(' ').filter((t) => t.length > 3);
  for (const c of courses) {
    const name = normalize(c.name);
    const overlap = tokens.filter((t) => name.includes(t)).length;
    if (overlap >= 2) scores.set(c.category, (scores.get(c.category) ?? 0) + 1);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return [];
  const top = ranked[0][1];
  return ranked.filter(([, s]) => s >= top * 0.4).slice(0, 3).map(([id, weight]) => ({ id, weight }));
}

function relevance(c: RouteCourse, objective: string, areaWeight: Map<string, number>): number {
  const tokens = uniq(normalize(objective).split(' ').filter((t) => t.length > 3));
  const hay = normalize([c.name, ...c.keywords, ...c.tools].join(' '));
  const overlap = tokens.filter((t) => hay.includes(t)).length;
  return overlap * 3 + (areaWeight.get(c.category) ?? 0) * 2 + (c.featured ? 0.5 : 0) + (c.duration_hours ? 0.3 : 0);
}

const STAGE_META: Record<StageLevel, { title: string; goal: (area: string) => string }> = {
  basico: { title: 'Fundamentos', goal: (a) => `Construir una base sólida en ${a}.` },
  intermedio: { title: 'Especialización', goal: (a) => `Aplicar ${a} en casos reales y dominar las herramientas clave.` },
  avanzado: { title: 'Dominio y certificación', goal: (a) => `Llevar ${a} a un nivel avanzado y demostrarlo con proyectos o certificaciones.` }
};

export function buildRoute(
  input: { objective: string; preferences: ProfilePreferences },
  evaluation: ProfileEvaluation,
  extract: ProfileExtract,
  categories: RouteCategory[],
  courses: RouteCourse[],
  signals: Map<string, string[]>
): TrainingRoute {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  let targets = objectiveAreas(input.objective, categories, signals, courses);
  if (!targets.length) {
    // Sin señal clara en el objetivo: profundizar en la materia más fuerte del perfil.
    const best = [...evaluation.areas].sort((a, b) => b.score - a.score)[0];
    targets = best && best.score > 0 ? [{ id: best.area_id, weight: 1 }] : [];
  }
  const weights = new Map(targets.map((t) => [t.id, t.weight]));
  const target_areas = targets.map((t) => catName.get(t.id) ?? t.id);
  const role = input.objective.match(/(?:ser|convertirme en|trabajar como|llegar a ser|puesto de|rol de|cargo de)\s+(?:un |una )?([^.,;\n]{3,80})/i)?.[1]?.split(/\s+(?:y|e|para|con|en una|en un)\s+/)[0].trim().slice(0, 60) ?? null;

  const primary = targets[0]?.id;
  const primaryScore = evaluation.areas.find((a) => a.area_id === primary)?.score ?? 0;
  const startLevel: StageLevel = primaryScore >= 60 ? 'avanzado' : primaryScore >= 35 ? 'intermedio' : 'basico';

  const pool = courses
    .filter((c) => weights.has(c.category) && fitsPreferences(c, input.preferences))
    .map((c) => ({ c, level: courseLevel(c), score: relevance(c, input.objective, weights) }))
    .sort((a, b) => b.score - a.score);

  const used = new Set<string>();
  const ownTools = new Set(extract.tools.map(normalize));
  const stages: RouteStage[] = [];
  const areaLabel = target_areas.slice(0, 2).join(' y ') || 'tu área objetivo';
  for (const level of (['basico', 'intermedio', 'avanzado'] as StageLevel[]).filter((l) => LEVEL_ORDER[l] >= LEVEL_ORDER[startLevel])) {
    const picks = pool.filter((p) => p.level === level && !used.has(p.c.id)).slice(0, 2);
    if (!picks.length) continue;
    picks.forEach((p) => used.add(p.c.id));
    const skills = uniq(picks.flatMap((p) => p.c.tools)).filter((t) => !ownTools.has(normalize(t))).slice(0, 6);
    stages.push({
      order: stages.length + 1,
      title: STAGE_META[level].title,
      goal: STAGE_META[level].goal(areaLabel),
      skills,
      course_ids: picks.map((p) => p.c.id),
      rationale:
        level === startLevel
          ? `Tu nivel actual en ${catName.get(primary ?? '') ?? areaLabel} es ${PROFICIENCY_LABELS[levelFromScore(primaryScore)].toLowerCase()} (${primaryScore}/100), por eso la ruta empieza aquí.`
          : `Continúa con programas de nivel ${level} para cerrar las brechas hacia tu objetivo.`
    });
  }

  // Objetivo de liderazgo/gestión: sumar una etapa de gestión si no está ya cubierta.
  if (/\b(lider|liderar|jefe|jefa|gerente|gerencia|manager|coordinar|dirigir|gestionar equipos)\b/.test(normalize(input.objective)) && !weights.has('gestion-de-proyectos')) {
    const mgmt = courses.filter((c) => ['gestion-de-proyectos', 'product-management'].includes(c.category) && !used.has(c.id) && fitsPreferences(c, input.preferences)).slice(0, 2);
    if (mgmt.length) {
      stages.push({ order: stages.length + 1, title: 'Gestión y liderazgo', goal: 'Desarrollar habilidades para liderar equipos y proyectos.', skills: uniq(mgmt.flatMap((c) => c.tools)).slice(0, 5), course_ids: mgmt.map((c) => c.id), rationale: 'Tu objetivo implica liderar; la gestión ágil de proyectos complementa tu especialización técnica.' });
    }
  }

  // Brechas: herramientas frecuentes en los programas objetivo que el perfil no menciona.
  const toolFreq = new Map<string, number>();
  for (const p of pool.slice(0, 25)) for (const t of p.c.tools) if (!ownTools.has(normalize(t))) toolFreq.set(t, (toolFreq.get(t) ?? 0) + 1);
  const missingTools = [...toolFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  evaluation.gaps = uniq([
    ...targets.map((t) => evaluation.areas.find((a) => a.area_id === t.id)).filter((a): a is AreaScore => !!a && a.score < 60).map((a) => `${a.area}: nivel ${PROFICIENCY_LABELS[a.level].toLowerCase()} frente a tu objetivo`),
    ...(missingTools.length ? [`Herramientas a incorporar: ${missingTools.join(', ')}`] : []),
    ...evaluation.soft_skills.filter((s) => s.score === 0).slice(0, 2).map((s) => `${s.name}: no evidenciada en tu perfil`)
  ]).slice(0, 6);

  const totalHours = stages.flatMap((s) => s.course_ids).map((id) => courses.find((c) => c.id === id)?.duration_hours ?? 0).reduce((a, b) => a + b, 0);
  const advice: string[] = [];
  if (input.preferences.hours_per_week && totalHours) advice.push(`Con ${input.preferences.hours_per_week} h/semana, completarías la ruta en unas ${Math.ceil(totalHours / input.preferences.hours_per_week)} semanas (${totalHours} h publicadas).`);
  else if (totalHours) advice.push(`La ruta suma aproximadamente ${totalHours} horas de formación publicadas.`);
  if (!stages.length) advice.push('No encontramos programas que encajen con tus filtros; prueba ampliando el presupuesto o la modalidad.');
  advice.push('Aplica cada etapa en un proyecto propio o de tu trabajo: es la mejor forma de demostrar el nuevo nivel.');
  if (missingTools.length) advice.push(`Agrega ${missingTools.slice(0, 3).join(', ')} a tu CV cuando los practiques.`);

  return {
    objective_summary: input.objective.trim().replace(/\s+/g, ' ').slice(0, 240),
    target_role: role,
    target_areas,
    stages,
    advice
  };
}

/** Motor completo por reglas. */
export function analyzeWithRules(input: AnalysisInput & { source: 'cv' | 'texto' }, categories: RouteCategory[], courses: RouteCourse[]) {
  const signals = buildAreaSignals(categories, courses);
  const extract = extractProfile(input.text, input.source, toolDictionary(courses));
  const evaluation = evaluateProfile(input.text, extract, categories, signals);
  const route = buildRoute(input, evaluation, extract, categories, courses, signals);
  return { extract, evaluation, route };
}

/** Normaliza un resultado (de la IA o de reglas): niveles coherentes, todas las materias, cursos existentes. */
export function sanitizeAnalysis(
  result: { extract: ProfileExtract; evaluation: ProfileEvaluation; route: TrainingRoute },
  categories: RouteCategory[],
  courses: RouteCourse[],
  fallbackRoute: TrainingRoute
) {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const fixSkill = (s: SkillScore): SkillScore => {
    const score = clamp(Number(s.score) || 0);
    return { name: String(s.name).slice(0, 60), score, level: levelFromScore(score), evidence: String(s.evidence ?? '').slice(0, 300) };
  };
  const given = new Map(result.evaluation.areas.map((a) => [a.area_id, a]));
  const areas = categories.map((cat) => {
    const a = given.get(cat.id);
    const score = clamp(Number(a?.score) || 0);
    return { area_id: cat.id, area: cat.name, score, level: levelFromScore(score), evidence: String(a?.evidence ?? 'Sin evidencia en la información entregada.').slice(0, 300) };
  });
  const evaluation: ProfileEvaluation = {
    summary: String(result.evaluation.summary ?? '').slice(0, 1200),
    areas,
    technical_skills: result.evaluation.technical_skills.slice(0, 20).map(fixSkill),
    soft_skills: result.evaluation.soft_skills.slice(0, 12).map(fixSkill),
    strengths: result.evaluation.strengths.map(String).slice(0, 8),
    gaps: result.evaluation.gaps.map(String).slice(0, 8)
  };
  const used = new Set<string>();
  const fallbackIds = fallbackRoute.stages.flatMap((s) => s.course_ids);
  const stages = result.route.stages
    .slice(0, 5)
    .map((s, i) => {
      let ids = uniq(s.course_ids.map(String)).filter((id) => byId.has(id) && !used.has(id)).slice(0, 3);
      if (!ids.length) ids = fallbackIds.filter((id) => !used.has(id)).slice(0, 2);
      ids.forEach((id) => used.add(id));
      return { order: i + 1, title: String(s.title).slice(0, 80), goal: String(s.goal).slice(0, 300), skills: s.skills.map(String).slice(0, 8), course_ids: ids, rationale: String(s.rationale ?? '').slice(0, 500) };
    })
    .filter((s) => s.course_ids.length);
  const route: TrainingRoute = {
    objective_summary: String(result.route.objective_summary ?? '').slice(0, 300),
    target_role: result.route.target_role ? String(result.route.target_role).slice(0, 100) : null,
    target_areas: result.route.target_areas.map(String).slice(0, 4),
    stages: stages.length ? stages : fallbackRoute.stages,
    advice: result.route.advice.map(String).slice(0, 6)
  };
  return { extract: result.extract, evaluation, route };
}
