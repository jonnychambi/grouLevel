/** Flujo "Mi ruta": envío con CV (PDF/DOCX) o descripción, análisis, almacenamiento (PostgreSQL + CV en Blob) y administración. */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';
import courses from '../../../src/data/courses.json';
import categories from '../../../src/data/categories.json';

const blobs = new Map<string, { body: string | Buffer; uploadedAt: Date }>();
vi.mock('@vercel/blob', () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()].filter(([k]) => k.startsWith(prefix)).map(([pathname, v]) => ({ pathname, uploadedAt: v.uploadedAt, size: v.body.length })),
    hasMore: false
  }),
  put: async (pathname: string, body: string | Buffer) => { blobs.set(pathname, { body, uploadedAt: new Date() }); return { pathname }; },
  get: async (pathname: string) => { const b = blobs.get(pathname); return b ? { statusCode: 200, stream: new Response(typeof b.body === "string" ? b.body : new Uint8Array(b.body)).body } : null; },
  del: async (p: string | string[]) => [p].flat().forEach((x) => blobs.delete(x))
}));

// Claude simulado: devuelve un resultado con ids inválidos y puntajes fuera de rango para probar el saneamiento.
const aiCalls: unknown[] = [];
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = {
      messages: {
        create: async (params: unknown) => {
          aiCalls.push(params);
          const result = {
            extract: { personal: { first_name: 'Carlos Alberto', last_name: 'Mendoza Ruiz', email: null, phone: null, country: 'Colombia', city: 'Bogotá', linkedin: null }, current_role: 'Desarrollador Full Stack', current_company: 'Fintech Andes', headline: 'Desarrollador Full Stack', seniority: 'semi-senior', years_experience: 5, highest_degree: 'licenciatura', current_studies: null, education: [], experience: [], certifications: [], languages: [], tools: ['React'] },
            evaluation: { summary: 'Perfil técnico.', areas: [{ area_id: 'desarrollo-de-software', score: 150, evidence: 'React y Node' }], technical_skills: [{ name: 'React', score: 70, evidence: 'x' }], soft_skills: [{ name: 'Liderazgo', score: 20, evidence: 'y' }], strengths: ['React'], gaps: ['Cloud'] },
            route: { objective_summary: 'Cloud', target_role: 'Arquitecto cloud', target_areas: ['Cloud Computing'], stages: [{ title: 'Cloud', goal: 'g', skills: ['AWS'], course_ids: ['crs-no-existe'], rationale: 'r' }], advice: ['Practica'] },
            diagnosis: {
              suggested_roles: [{ title: 'Desarrollador Full Stack', area_id: 'desarrollo-de-software', level: 'semi-senior', fit: 130, reason: 'React y Node', salary: { min: 4500, max: 8000, currency: 'PEN', note: 'ref' } }],
              gap: { target_role: 'Arquitecto Cloud', target_level: 'lider', target_areas: ['Cloud Computing'], readiness: 35, summary: 'Faltan AWS y arquitectura.', items: [{ kind: 'tecnica', name: 'AWS', current: 95, required: 60, note: '' }, { kind: 'experiencia', name: 'Años', current: 5, required: 8, note: '' }], time_estimate: '12 a 24 meses', target_salary: { min: 12000, max: 20000, currency: 'PEN', note: 'ref' } }
            },
            studies: { short_term: [{ course_id: 'crs-no-existe', reason: 'x', covers: [] }], long_term: [], note: '' }
          };
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
      }
    };
  }
}));

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const api = await import('../../profile');
const admin = await import('../../admin');
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
let ip = 0;
const send = (fields: Record<string, string>, file?: { name: string; data: Buffer; type: string }) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ objective: 'Quiero especializarme en cloud computing con AWS y llegar a ser arquitecto cloud', consent: 'true', modality: 'cualquiera', hours_per_week: '6', ...fields })) fd.set(k, v);
  if (file) fd.set("cv", new File([new Uint8Array(file.data)], file.name, { type: file.type }));
  return api.POST(new Request('https://x/api/profile', { method: 'POST', headers: { 'x-forwarded-for': `10.1.0.${ip++}` }, body: fd }));
};
let token = '';
const authed = (method: string, action: string, b?: unknown) => new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });
type Pub = { id: string; engine: string; source: string; has_file: boolean; extract: { personal: Record<string, string | null>; tools: string[] }; evaluation: { areas: { area_id: string; score: number; level: string }[] }; route: { stages: { course_ids: string[] }[] };
  diagnosis?: { suggested_roles: { title: string; fit: number }[]; gap: { target_role: string; readiness: number; target_level: string; salary_comparison: string | null; items: { current: number }[] } };
  studies?: { short_term: { course_id: string }[]; long_term: { course_id: string }[] } };

beforeAll(async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  process.env.ADMIN_SESSION_SECRET = 's';
  process.env.BLOB_READ_WRITE_TOKEN = 'fake';
  delete process.env.ANTHROPIC_API_KEY;
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

describe('Mi ruta — API', () => {
  it('analiza un CV en DOCX con reglas, guarda el archivo y los datos extraídos', async () => {
    const res = await send({}, { name: 'cv-ejemplo.docx', data: fixture('cv-ejemplo.docx'), type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(res.status).toBe(201);
    const { profile } = (await res.json()) as { profile: Pub };
    expect(profile).toMatchObject({ engine: 'reglas', source: 'cv', has_file: true });
    expect(profile.id).toMatch(/^prf_[a-f0-9]{24}$/);
    expect(profile.extract.personal).toMatchObject({ first_name: 'Carlos Alberto', last_name: 'Mendoza Ruiz', country: 'Colombia' });
    // Privacidad: la respuesta pública no incluye correo, teléfono ni LinkedIn.
    expect(profile.extract.personal).not.toHaveProperty('email');
    expect(profile.extract.personal).not.toHaveProperty('phone');
    expect(profile.extract.personal).not.toHaveProperty('linkedin');
    expect(JSON.stringify(profile)).not.toContain('carlos.mendoza@correo.co');
    expect(profile.extract.tools).toEqual(expect.arrayContaining(['React', 'JavaScript']));
    expect(profile.evaluation.areas.find((a) => a.area_id === 'desarrollo-de-software')!.score).toBeGreaterThan(0);
    expect(profile.route.stages.length).toBeGreaterThan(0);
    expect((await db.sql`select first_name, email from profiles where id = ${profile.id}`)[0]).toEqual({ first_name: 'Carlos Alberto', email: 'carlos.mendoza@correo.co' });
    expect(blobs.has(`profiles-files/${profile.id}.docx`)).toBe(true);
    // El enlace privado devuelve el mismo resultado, sin datos internos.
    const again = (await (await api.GET(new Request(`https://x/api/profile?id=${profile.id}`))).json()) as { profile: Record<string, unknown> };
    expect(again.profile.id).toBe(profile.id);
    expect(again.profile).not.toHaveProperty('file');
    expect(again.profile).not.toHaveProperty('notes');
    expect(JSON.stringify(again.profile)).not.toContain('555 1234');
  });

  it('lee CVs en PDF', async () => {
    const res = await send({}, { name: 'cv.pdf', data: fixture('cv-ejemplo.pdf'), type: 'application/pdf' });
    expect(res.status).toBe(201);
    const { profile } = (await res.json()) as { profile: Pub };
    // Los datos de contacto se guardan en la base (para el administrador), no se exponen al navegador.
    expect((await db.sql`select email, phone, cv_text is not null as has_text from profiles where id = ${profile.id}`)[0]).toEqual({ email: 'carlos.mendoza@correo.co', phone: '+57 310 555 1234', has_text: true });
  });

  it('acepta una descripción sin CV y valida los datos', async () => {
    const ok = await send({ description: 'Soy analista contable en una empresa de retail desde 2019, manejo Excel avanzado, Power BI y SAP. Estudié Contabilidad en la Universidad de Lima.' });
    expect(ok.status).toBe(201);
    expect(((await ok.json()) as { profile: Pub }).profile).toMatchObject({ source: 'texto', has_file: false });
    expect((await send({ description: 'corto' })).status).toBe(422);
    expect((await send({ description: 'x'.repeat(80), consent: 'false' })).status).toBe(422);
    expect((await send({}, { name: 'cv.exe', data: Buffer.from('MZ binario'), type: 'application/octet-stream' })).status).toBe(422);
    expect((await send({ description: 'x'.repeat(80), website: 'spam' })).status).toBe(201);
    expect(((await (await api.GET(new Request('https://x/api/profile?id=prf_000000000000000000000000'))).status))).toBe(404);
  });

  it('rol objetivo y salario esperado: diagnóstico, estudios y todo guardado en la base', async () => {
    const res = await send({
      description: 'Soy analista de datos en Banco Andino desde 2019. Manejo Python, SQL, Power BI y Excel; armo dashboards y reportes para gerencia.',
      objective: 'Quiero trabajar como científico de datos y aplicar machine learning',
      target_role: 'Científico de Datos Senior', expected_salary: '9000', salary_currency: 'PEN', budget_pen: '3000'
    });
    expect(res.status).toBe(201);
    const { profile } = (await res.json()) as { profile: Pub };
    expect(profile.diagnosis!.gap).toMatchObject({ target_role: 'Científico de Datos Senior', target_level: 'senior', salary_comparison: 'dentro' });
    expect(profile.diagnosis!.suggested_roles.length).toBeGreaterThan(0);
    expect(profile.studies!.short_term.length).toBeLessThanOrEqual(5);
    expect(profile.studies!.long_term.length).toBeLessThanOrEqual(5);
    const [row] = await db.sql`select target_role_input, target_role, target_level, readiness, expected_salary::float as salary, expected_salary_currency, target_salary_min::float as min,
      salary_comparison, budget_pen::float as budget, diagnosis is not null as has_diag, studies is not null as has_studies, cv_text from profiles where id = ${profile.id}`;
    expect(row).toMatchObject({ target_role_input: 'Científico de Datos Senior', target_role: 'Científico de Datos Senior', target_level: 'senior', salary: 9000, expected_salary_currency: 'PEN', min: 8000, salary_comparison: 'dentro', budget: 3000, has_diag: true, has_studies: true });
    expect(row.readiness).toBe(profile.diagnosis!.gap.readiness);
    expect(row.cv_text).toContain('Banco Andino');
    const [n] = await db.sql`select (select count(*) from profile_suggested_roles where profile_id = ${profile.id})::int roles,
      (select count(*) from profile_gap_items where profile_id = ${profile.id})::int gaps,
      (select count(*) from profile_studies where profile_id = ${profile.id} and term = 'corto')::int short`;
    expect(n.roles).toBe(profile.diagnosis!.suggested_roles.length);
    expect(n.gaps).toBe(profile.diagnosis!.gap.items.length);
    expect(n.short).toBe(profile.studies!.short_term.length);
  });

  it('con IA configurada usa Claude y sanea el resultado', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    try {
      const res = await send({}, { name: 'cv.pdf', data: fixture('cv-ejemplo.pdf'), type: 'application/pdf' });
      const { profile } = (await res.json()) as { profile: Pub };
      expect(profile.engine).toBe('ia');
      const params = aiCalls.at(-1) as { model: string; messages: { content: { type: string }[] }[]; output_config: { format: { type: string } } };
      expect(params.model).toBe('claude-opus-5-5');
      expect(params.messages[0].content[0].type).toBe('document');
      expect(params.output_config.format.type).toBe('json_schema');
      const ids = new Set(courses.map((c) => c.id));
      const dev = profile.evaluation.areas.find((a) => a.area_id === 'desarrollo-de-software')!;
      expect(dev).toMatchObject({ score: 84, level: 'avanzado' }); // nunca "experto"
      expect(profile.diagnosis!.suggested_roles[0]).toMatchObject({ title: 'Desarrollador Full Stack', fit: 92 });
      expect(profile.diagnosis!.gap).toMatchObject({ target_role: 'Arquitecto Cloud', readiness: 35 });
      expect(profile.diagnosis!.gap.items[0].current).toBe(84);
      // Estudios inválidos se reemplazan por programas reales del tipo correcto.
      expect(profile.studies!.short_term.length).toBeGreaterThan(0);
      expect(profile.studies!.short_term.every((st) => ids.has(st.course_id))).toBe(true);
      expect(profile.evaluation.areas).toHaveLength(categories.length);
      // Ids inexistentes se reemplazan por programas reales; el email lo completan las reglas.
      expect(profile.route.stages[0].course_ids.every((id) => ids.has(id))).toBe(true);
      expect((await db.sql`select email from profiles where id = ${profile.id}`)[0].email).toBe('carlos.mendoza@correo.co');
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('administración: lista, detalle, descarga del CV, estado y borrado', async () => {
    const { profiles, total } = (await (await admin.GET(authed('GET', 'profiles'))).json()) as { profiles: { id: string; name: string; file: unknown }[]; total: number };
    expect(total).toBeGreaterThanOrEqual(4);
    const withFile = profiles.find((p) => p.file)!;
    expect(withFile.name).toBe('Carlos Alberto Mendoza Ruiz');
    const file = await admin.GET(new Request(`https://x/api/admin?action=profile-file&id=${withFile.id}`, { headers: { authorization: `Bearer ${token}` } }));
    expect(file.status).toBe(200);
    expect(file.headers.get('content-disposition')).toContain('attachment');
    const upd = (await (await admin.POST(authed('POST', 'profile', { id: withFile.id, status: 'contactado', notes: 'Llamar el lunes' }))).json()) as { profile: { status: string; notes: string } };
    expect(upd.profile).toMatchObject({ status: 'contactado', notes: 'Llamar el lunes' });
    expect((await admin.GET(new Request(`https://x/api/admin?action=profiles`))).status).toBe(401);
    expect((await admin.POST(authed('POST', 'profile-delete', { id: withFile.id }))).status).toBe(200);
    expect([...blobs.keys()].some((k) => k.includes(withFile.id))).toBe(false); // CV borrado de Blob
    expect((await db.sql`select count(*)::int as n from profiles where id = ${withFile.id}`)[0].n).toBe(0);
  });
});
