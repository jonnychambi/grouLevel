/** Groulevel Reviews: correo validado, formulario por dimensiones, evidencia, moderación, reportes, créditos y referidos (PGlite). */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';
import courses from '../../../src/data/courses.json';

// Blob privado simulado (evidencias).
const blobs = new Map<string, Uint8Array>();
vi.mock('@vercel/blob', () => ({
  put: async (p: string, b: Buffer) => { blobs.set(p, new Uint8Array(b)); return { pathname: p }; },
  get: async (p: string) => (blobs.has(p) ? { statusCode: 200, stream: new Response(blobs.get(p) as BodyInit).body } : null),
  del: async (p: string) => { blobs.delete(p); },
  list: async () => ({ blobs: [], hasMore: false })
}));

// Supabase Auth simulado: token "tok-<email>" ⇒ usuario con correo validado.
const realFetch = globalThis.fetch;
const sentOtp: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith('https://sb.test/auth/v1')) return realFetch(input, init);
  if (url.includes('/otp')) { sentOtp.push(JSON.parse(String(init?.body)).email); return Response.json({}); }
  if (url.endsWith('/verify')) {
    const b = JSON.parse(String(init?.body));
    return b.token === '123456' ? Response.json({ access_token: `tok-${b.email}`, refresh_token: 'r', expires_at: 9999999999 }) : Response.json({ msg: 'invalid' }, { status: 403 });
  }
  if (url.endsWith('/user')) {
    const tok = String((init?.headers as Record<string, string>).Authorization).replace('Bearer ', '');
    if (!tok.startsWith('tok-')) return Response.json({}, { status: 401 });
    const email = tok.slice(4);
    return Response.json({ id: `u-${email}`, email, email_confirmed_at: email.startsWith('noverif') ? null : '2026-01-01' });
  }
  return Response.json({}, { status: 404 });
}) as typeof fetch;

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const api = await import('../../reviews');
const admin = await import('../../admin');
const pub = (courses as { id: string; institution_id: string; status: string; name: string }[]).filter((c) => c.status === 'publicado');
const c1 = pub[0];
const inst = c1.institution_id;
const otherInst = pub.find((c) => c.institution_id !== inst)!;

let ip = 0;
const INST = { academic: 5, teachers: 4, experience: 4, compliance: 5, value: 3 };
const PROG = { content: 5, methodology: 4, tools: 5, teacher: 4 };
const LONG = 'Los docentes tienen experiencia real en la industria y los proyectos fueron muy aplicables al trabajo diario.';
const form = (over: Record<string, string> = {}, file?: File) => {
  const f = new FormData();
  const base: Record<string, string> = {
    institution_id: inst, course_id: c1.id, inst_scores: JSON.stringify(INST), program_scores: JSON.stringify(PROG), best: LONG, improve: `${LONG} Mejoraría la plataforma.`,
    recommend: 'si', study_year: '2025', student_status: 'egresado', author_name: 'Ana María Torres', wants_incentive: 'false', consent: 'true', website: '', ...over
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  if (file) f.set('evidence', file);
  return f;
};
const submit = (email: string, f: FormData) => api.POST(new Request('https://x/api/reviews', { method: 'POST', headers: { authorization: `Bearer tok-${email}`, 'x-forwarded-for': `10.2.0.${ip++}` }, body: f }));
const getJson = async (qs: string) => (await api.GET(new Request(`https://x/api/reviews?${qs}`))).json() as Promise<Record<string, any>>;
let token = '';
const authed = (method: string, action: string, b?: unknown) => new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });
const all = async () => ((await (await admin.GET(authed('GET', 'reviews'))).json()) as { reviews: Record<string, any>[] }).reviews;
const wallet = async (email: string) => ((await (await api.GET(new Request('https://x/api/reviews?action=me', { headers: { authorization: `Bearer tok-${email}` } }))).json()) as { wallet: Record<string, any> }).wallet;
const redeem = (email: string, course_id: string, amount: number) =>
  api.POST(new Request('https://x/api/reviews?action=redeem', { method: 'POST', headers: { authorization: `Bearer tok-${email}`, 'x-forwarded-for': `10.3.0.${ip++}` }, body: JSON.stringify({ course_id, amount }) }));
const pdf = () => new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, Math.floor(Math.random() * 255)])], 'certificado.pdf', { type: 'application/pdf' });

beforeAll(async () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 's', SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'anon' });
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

describe('acceso con correo validado', () => {
  it('envía el código y lo verifica; sin sesión no se puede opinar', async () => {
    const start = await api.POST(new Request('https://x/api/reviews?action=auth-start', { method: 'POST', body: JSON.stringify({ email: 'Ana@Mail.com' }) }));
    expect(start.status).toBe(200);
    expect(sentOtp).toEqual(['ana@mail.com']);
    const bad = await api.POST(new Request('https://x/api/reviews?action=auth-verify', { method: 'POST', body: JSON.stringify({ email: 'ana@mail.com', code: '000000' }) }));
    expect(bad.status).toBe(401);
    const ok = (await (await api.POST(new Request('https://x/api/reviews?action=auth-verify', { method: 'POST', body: JSON.stringify({ email: 'ana@mail.com', code: '123 456' }) }))).json()) as { session: { access_token: string } };
    expect(ok.session.access_token).toBe('tok-ana@mail.com');
    expect((await api.POST(new Request('https://x/api/reviews', { method: 'POST', body: form() }))).status).toBe(401);
    expect((await submit('noverif@mail.com', form())).status).toBe(403);
  });
});

describe('reseñas', () => {
  it('una reseña nueva queda pendiente, guarda la evidencia en privado y los incentivos solicitados', async () => {
    const res = await submit('ana@mail.com', form({ wants_incentive: 'true' }, pdf()));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: 'pendiente', incentive: 100 }); // S/ 100 de crédito por reseña
    expect(await getJson(`course=${c1.id}`)).toEqual({ reviews: [], institution_reviews: [] });
    const [r] = await all();
    expect(r).toMatchObject({ status: 'pendiente', kind: 'institucion', rating: 4.2, program_rating: 4.5, evidence_status: 'pendiente', verified: false, incentivized: true, author_name: 'Ana María T.' });
    expect([...blobs.keys()][0]).toMatch(/^review-evidence\/rev_/);
    expect((await sql`select kind, amount::int, status from review_incentives order by kind`)).toEqual([{ kind: 'resena', amount: 100, status: 'pendiente' }]);
  });

  it('valida el formulario, la relación programa–institución y los duplicados', async () => {
    const invalid = await submit('beto@mail.com', form({ inst_scores: JSON.stringify({ ...INST, value: 0 }), best: 'corto', recommend: '' }));
    expect(invalid.status).toBe(422);
    expect(((await invalid.json()) as { errors: string[] }).errors.length).toBeGreaterThanOrEqual(3);
    expect((await submit('beto@mail.com', form({ institution_id: otherInst.institution_id }))).status).toBe(422);
    expect((await submit('ana@mail.com', form())).status).toBe(409);
    // Solo institución (sin programa): válida para la misma persona.
    expect((await submit('ana@mail.com', form({ course_id: '', program_scores: '' }))).status).toBe(201);
  });

  it('detecta texto y evidencia duplicados entre personas', async () => {
    const shared = pdf();
    await submit('carla@mail.com', form({}, shared));
    await submit('dani@mail.com', form({}, shared));
    const dani = (await all()).find((r) => r.author_email === 'dani@mail.com')!;
    expect(dani.flags).toEqual(expect.arrayContaining(['evidencia_repetida', 'texto_duplicado']));
  });

  it('aprobar y verificar la evidencia publica la reseña con insignia; el correo y la evidencia no son públicos', async () => {
    const ana = (await all()).find((r) => r.author_email === 'ana@mail.com' && r.course_id)!;
    const res = await admin.POST(authed('POST', 'review', { pathname: ana.pathname, status: 'aprobada', evidence_status: 'aprobada', criteria: ['experiencia_real', 'relevante', 'xx'] }));
    expect(((await res.json()) as { review: { verified: boolean; criteria: string[] } }).review).toMatchObject({ verified: true, criteria: ['experiencia_real', 'relevante'] });
    const pubCourse = await getJson(`course=${c1.id}`);
    expect(pubCourse.reviews).toHaveLength(1);
    expect(pubCourse.reviews[0]).toMatchObject({ verified: true, incentivized: true, program_scores: PROG, study_year: 2025, student_status: 'egresado' });
    const text = JSON.stringify(pubCourse);
    expect(text).not.toContain('ana@mail.com');
    expect(text).not.toContain('review-evidence');
    const summary = await getJson('summary=1');
    expect(summary.institutions[inst]).toMatchObject({ avg: 4.2, count: 1, dims: { academic: 5, value: 3 }, recommend_pct: 100 });
    expect(summary.courses[c1.id]).toMatchObject({ avg: 4.5, count: 1, dims: { content: 5 } });
    const ev = await admin.GET(authed('GET', `review-evidence&id=${ana.pathname}`));
    expect(ev.headers.get('content-disposition')).toContain('certificado.pdf');
  });

  it('créditos: se activan solo con reseña verificada y no dependen de la calificación', async () => {
    const list = ((await (await admin.GET(authed('GET', 'review-incentives'))).json()) as { incentives: { id: number; kind: string; email: string }[] }).incentives;
    const ana = list.filter((i) => i.email === 'ana@mail.com');
    expect(ana).toHaveLength(1);
    const set = (id: number, status: string) => admin.POST(authed('POST', 'review-incentive', { id, status }));
    expect((await set(ana[0].id, 'pagado')).status).toBe(409); // ya no hay pagos en efectivo
    expect((await set(ana[0].id, 'aprobado')).status).toBe(200);
    expect((await wallet('ana@mail.com'))).toMatchObject({ earned: 100, available: 100, pending: 0, max_per_program: 300 });
    // Reseña crítica (1★) con crédito: igual de válida.
    const res = await submit('eva@mail.com', form({ inst_scores: JSON.stringify({ academic: 1, teachers: 1, experience: 2, compliance: 1, value: 1 }), wants_incentive: 'true', best: `${LONG} Nada más.`, improve: 'La atención fue muy lenta y el certificado llegó tarde, no lo recomiendo.' }));
    expect(((await res.json()) as { incentive: number }).incentive).toBe(100);
  });

  it('reportes, filtros de antigüedad y moderación con sesión', async () => {
    const ana = (await all()).find((r) => r.author_email === 'ana@mail.com' && r.course_id)!;
    const report = () => api.POST(new Request('https://x/api/reviews?action=report', { method: 'POST', headers: { 'x-forwarded-for': '10.9.9.9', 'user-agent': 'UA' }, body: JSON.stringify({ id: ana.pathname, reason: 'falsa', details: 'No parece real' }) }));
    expect((await report()).status).toBe(200);
    expect((await report()).status).toBe(200); // misma persona: no suma dos veces
    expect((await all()).find((r) => r.pathname === ana.pathname)!.reports_count).toBe(1);
    const reports = ((await (await admin.GET(authed('GET', 'review-reports'))).json()) as { reports: { id: number }[] }).reports;
    expect((await admin.POST(authed('POST', 'review-report', { id: reports[0].id, status: 'resuelto' }))).status).toBe(200);
    expect((await admin.GET(new Request('https://x/api/admin?action=reviews'))).status).toBe(401);
    // Rechazar retira la reseña y anula incentivos pendientes.
    const eva = (await all()).find((r) => r.author_email === 'eva@mail.com')!;
    await admin.POST(authed('POST', 'review', { pathname: eva.pathname, status: 'rechazada', rejection_reason: 'Sin evidencia de haber estudiado' }));
    expect((await sql`select status from review_incentives where review_id = ${eva.pathname}`)[0].status).toBe('rechazado');
    const me = await api.GET(new Request('https://x/api/reviews?action=me', { headers: { authorization: 'Bearer tok-ana@mail.com' } }));
    expect(((await me.json()) as { reviews: unknown[] }).reviews).toHaveLength(2);
  });

  it('canje: descuento por programa con saldo disponible y tope de S/ 300 por programa', async () => {
    expect((await redeem('ana@mail.com', c1.id, 200)).status).toBe(409); // saldo S/ 100
    expect((await redeem('ana@mail.com', c1.id, 150)).status).toBe(409); // múltiplos de S/ 100
    const ok = await redeem('ana@mail.com', c1.id, 100);
    expect(ok.status).toBe(201);
    expect(((await ok.json()) as { redemption: Record<string, unknown> }).redemption).toMatchObject({ course_id: c1.id, amount: 100, status: 'solicitado', code: expect.stringMatching(/^GL-[A-Z2-9]{6}$/) });
    expect(await wallet('ana@mail.com')).toMatchObject({ available: 0, redeemed: 100 });
    // Un crédito ya canjeado no se puede rechazar sin anular el canje.
    const [inc] = await sql`select id from review_incentives where user_id = 'u-ana@mail.com' and kind = 'resena'`;
    expect((await admin.POST(authed('POST', 'review-incentive', { id: inc.id, status: 'rechazado' }))).status).toBe(409);
    // Más saldo: el tope por programa sigue siendo S/ 300.
    const [r] = await sql`select id from reviews where user_id = 'u-ana@mail.com' and course_id is null`;
    await sql`insert into review_incentives (review_id, user_id, institution_id, kind, amount, status) values (${r.id}, 'u-ana@mail.com', ${inst}, 'resena', 300, 'aprobado')`;
    expect((await redeem('ana@mail.com', c1.id, 300)).status).toBe(409); // ya usó 100 en este programa
    expect((await redeem('ana@mail.com', c1.id, 200)).status).toBe(201);
    const full = await redeem('ana@mail.com', c1.id, 100);
    expect(((await full.json()) as { message: string }).message).toContain('máximo');
    expect((await redeem('ana@mail.com', otherInst.id, 100)).status).toBe(201); // otro programa
    // El administrador anula un canje: el saldo vuelve.
    const reds = ((await (await admin.GET(authed('GET', 'review-redemptions'))).json()) as { redemptions: { id: number; amount: number; course_id: string }[] }).redemptions;
    expect(reds).toHaveLength(3);
    const other = reds.find((x) => x.course_id === otherInst.id)!;
    expect((await admin.POST(authed('POST', 'review-redemption', { id: other.id, status: 'anulado' }))).status).toBe(200);
    expect(await wallet('ana@mail.com')).toMatchObject({ earned: 400, redeemed: 300, available: 100 });
  });

  it('referidos: S/ 100 por la primera reseña de cada persona invitada (no a uno mismo)', async () => {
    const code = (await wallet('ana@mail.com')).ref_code as string;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    const res = await submit('fede@mail.com', form({ institution_id: otherInst.institution_id, course_id: otherInst.id, ref: code.toLowerCase() }, pdf()));
    expect(res.status).toBe(201);
    const fede = (await all()).find((r) => r.author_email === 'fede@mail.com')!;
    expect(fede.flags).toContain('referida');
    expect(fede.incentivized).toBe(false); // la persona referida no pidió crédito
    let refs = await sql`select user_id, referred_user_id, amount::int, status from review_incentives where kind = 'referido'`;
    expect(refs).toEqual([{ user_id: 'u-ana@mail.com', referred_user_id: 'u-fede@mail.com', amount: 100, status: 'pendiente' }]);
    // Segunda reseña de la misma persona y autoreferido: no suman.
    await submit('fede@mail.com', form({ institution_id: otherInst.institution_id, course_id: '', program_scores: '', ref: code }));
    await submit('eva@mail.com', form({ course_id: '', program_scores: '', ref: (await wallet('eva@mail.com')).ref_code }));
    refs = await sql`select 1 from review_incentives where kind = 'referido'`;
    expect(refs).toHaveLength(1);
    // Se activa con la reseña de la persona referida publicada y verificada.
    const [ref] = await sql`select id from review_incentives where kind = 'referido'`;
    expect((await admin.POST(authed('POST', 'review-incentive', { id: ref.id, status: 'aprobado' }))).status).toBe(409);
    await admin.POST(authed('POST', 'review', { pathname: fede.pathname, status: 'aprobada', evidence_status: 'aprobada' }));
    expect((await admin.POST(authed('POST', 'review-incentive', { id: ref.id, status: 'aprobado' }))).status).toBe(200);
    const w = await wallet('ana@mail.com');
    expect(w).toMatchObject({ available: 200 });
    expect(w.referrals).toEqual([expect.objectContaining({ amount: 100, status: 'aprobado', author_name: 'Ana María T.' })]);
  });

  it('las reseñas anteriores (solo de programa) siguen contando', async () => {
    await sql`insert into reviews (id, created_at, course_id, course_name, institution_id, institution_name, rating, comment, author_name, author_email, relationship, status, raw, program_rating)
      values ('rev_legacy1', now(), ${c1.id}, 'x', ${inst}, 'x', 3, 'Reseña antigua con suficiente texto.', 'Luis P.', 'l@x.com', 'estudiante', 'aprobada', '{}', 3)`;
    const r = await getJson(`course=${c1.id}`);
    expect(r.reviews.map((x: { id: string }) => x.id)).toContain('rev_legacy1');
    const s = await getJson('summary=1');
    expect(s.courses[c1.id].count).toBe(2);
  });
});
