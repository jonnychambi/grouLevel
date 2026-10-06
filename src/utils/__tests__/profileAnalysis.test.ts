import { describe, expect, it } from 'vitest';
import coursesJson from '../../data/courses.json';
import categoriesJson from '../../data/categories.json';
import institutionsJson from '../../data/institutions.json';
import { analyzeWithRules, courseLevel, extractPersonal, levelFromScore, sanitizeAnalysis, type RouteCourse } from '../profileAnalysis';

const inst = new Map((institutionsJson as { id: string; name: string }[]).map((i) => [i.id, i.name]));
const raw = (Array.isArray(coursesJson) ? coursesJson : (coursesJson as { courses: unknown[] }).courses) as Record<string, any>[];
const courses: RouteCourse[] = raw.map((c) => ({
  id: c.id, name: c.name, category: c.category, level: c.level, program_type: c.program_type, modality: c.modality,
  price_pen: c.discount_price ?? c.price, duration_hours: c.duration_hours, tools: c.tools, keywords: c.keywords,
  institution_name: inst.get(c.institution_id) ?? '', featured: c.featured
}));
const categories = categoriesJson as { id: string; name: string; keywords: string[] }[];
const prefs = { modality: 'cualquiera' as const, budget_pen: null, hours_per_week: 6 };

export const SAMPLE_CV = `MARÍA FERNANDA QUISPE ROJAS
Analista de Datos Senior
Lima, Perú | +51 987 654 321 | maria.quispe@gmail.com | linkedin.com/in/mariaquispe

PERFIL
Analista con 6 años de experiencia en análisis de datos, reportes y dashboards en Power BI. Orientada a resultados, trabajo en equipo y comunicación efectiva.

EXPERIENCIA
Analista de Datos Senior en Banco Andino | 2021 - Actualidad
- Construí dashboards en Power BI y DAX; automaticé reportes con Python y SQL.
- Lideré un equipo de 3 analistas; reduje el tiempo de cierre mensual en 40%.
Analista de Inteligencia Comercial en Retail SAC | 2018 - 2021
- Modelos en Excel, Power Query y SQL Server.

EDUCACIÓN
Universidad Nacional Mayor de San Marcos
Bachiller en Ingeniería Estadística 2013 - 2018
Maestría en Ciencia de Datos - Universidad del Pacífico (en curso)

CERTIFICACIONES
Certificación Microsoft PL-300 Power BI Data Analyst
IDIOMAS
Inglés avanzado`;

describe('profileAnalysis (reglas)', () => {
  it('extrae datos personales, formación y experiencia', () => {
    const r = analyzeWithRules({ text: SAMPLE_CV, objective: 'Quiero convertirme en científica de datos y trabajar con machine learning en Python', preferences: prefs, source: 'cv' }, categories, courses);
    const p = r.extract.personal;
    expect(p.first_name).toBe('María Fernanda');
    expect(p.last_name).toBe('Quispe Rojas');
    expect(p.email).toBe('maria.quispe@gmail.com');
    expect(p.phone).toBe('+51 987 654 321');
    expect(p.country).toBe('Perú');
    expect(p.linkedin).toContain('linkedin.com/in/mariaquispe');
    expect(r.extract.years_experience).toBe(6);
    expect(r.extract.highest_degree).toBe('maestria');
    expect(r.extract.education.some((e) => e.institution?.includes('San Marcos') && e.level === 'bachiller')).toBe(true);
    expect(r.extract.current_studies).toMatch(/Maestría/);
    expect(r.extract.current_role).toMatch(/Analista de Datos Senior/);
    expect(r.extract.current_company).toBe('Banco Andino');
    expect(r.extract.seniority).toBe('senior');
    expect(r.extract.tools).toEqual(expect.arrayContaining(['Power BI', 'Python', 'SQL', 'DAX', 'Excel']));
    expect(r.extract.languages[0]).toEqual({ language: 'Inglés', level: 'Avanzado' });
    expect(r.extract.certifications.length).toBeGreaterThan(0);
    const da = r.evaluation.areas.find((a) => a.area_id === 'data-analytics')!;
    expect(da.score).toBeGreaterThanOrEqual(60);
    expect(r.evaluation.areas.find((a) => a.area_id === 'ciberseguridad')!.score).toBe(0);
    expect(r.evaluation.soft_skills.find((s) => s.name === 'Liderazgo')!.score).toBeGreaterThan(0);
    // Ruta hacia ciencia de datos / ML con programas reales.
    expect(r.route.target_areas.join(' ')).toMatch(/Data Science|Machine Learning/);
    expect(r.route.stages.length).toBeGreaterThan(0);
    const ids = new Set(courses.map((c) => c.id));
    for (const s of r.route.stages) for (const id of s.course_ids) expect(ids.has(id)).toBe(true);
  });

  it('funciona con una descripción libre y respeta el presupuesto', () => {
    const text = 'Me llamo Jorge Ramírez. Trabajo como asistente de marketing en una agencia desde 2023, manejo redes sociales y Canva. Estudié Comunicaciones en la Universidad de Lima.';
    const r = analyzeWithRules({ text, objective: 'Quiero especializarme en marketing digital y Google Ads para liderar campañas', preferences: { modality: 'cualquiera', budget_pen: 800, hours_per_week: null }, source: 'texto' }, categories, courses);
    expect(r.extract.personal.first_name).toBe('Jorge');
    expect(r.extract.current_role).toMatch(/asistente de marketing/i);
    expect(r.route.target_areas).toContain('Marketing Digital');
    for (const s of r.route.stages) for (const id of s.course_ids) {
      const c = courses.find((x) => x.id === id)!;
      expect(c.price_pen === null || c.price_pen <= 800).toBe(true);
    }
  });

  it('no confunde rangos de años o fechas con teléfonos', () => {
    expect(extractPersonal('Juan Pérez\n2015 - 2020\n12/05/2020', 'cv').phone).toBeNull();
  });

  it('niveles y saneamiento', () => {
    expect(levelFromScore(0)).toBe('sin-evidencia');
    expect(levelFromScore(85)).toBe('experto');
    expect(courseLevel({ ...courses[0], level: null, name: 'Fundamentos de Python', program_type: 'curso' })).toBe('basico');
    const base = analyzeWithRules({ text: SAMPLE_CV, objective: 'Aprender ingeniería de datos con Spark', preferences: prefs, source: 'cv' }, categories, courses);
    const dirty = structuredClone(base);
    dirty.evaluation.areas = [{ area_id: 'data-analytics', area: 'x', score: 140, level: 'basico', evidence: 'ok' }];
    dirty.route.stages = [{ order: 9, title: 'A', goal: 'g', skills: [], course_ids: ['no-existe'], rationale: '' }];
    const clean = sanitizeAnalysis(dirty, categories, courses, base.route);
    expect(clean.evaluation.areas).toHaveLength(categories.length);
    expect(clean.evaluation.areas[0]).toMatchObject({ score: 100, level: 'experto' });
    expect(clean.route.stages[0].course_ids.length).toBeGreaterThan(0);
    expect(clean.route.stages[0].order).toBe(1);
  });
});
