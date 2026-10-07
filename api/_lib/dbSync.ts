/**
 * Filas de la base (Supabase/PostgreSQL): mapeo de los registros del sitio a columnas y escrituras.
 *
 *  · writeCatalogTables / upsertLead / upsertReview / upsertProfile: usadas por los repositorios
 *    (catalogRepo, leads, reviews, profiles), que son la fuente principal de datos.
 *  · importFromBlob: importación NO destructiva de los datos antiguos guardados en Vercel Blob
 *    (solo agrega o actualiza; nunca borra lo que ya está en la base).
 */
import type { Lead } from '../../src/types/lead.js';
import type { Review } from '../../src/types/review.js';
import type { ProfileAnalysis } from '../../src/types/profile.js';
import type { Sql } from './db.js';
import type { CatalogPayload } from './validate.js';

type Rec = Record<string, unknown>;
type Row = Record<string, unknown>;

export interface VersionInfo { pathname: string; uploaded_at: string; size: number; note: string }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null => (num(v) === null ? null : Math.round(v as number));
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null);

/** JSON con claves ordenadas en todos los niveles (para comparar registros). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Rec)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

/** INSERT … ON CONFLICT (pk) DO UPDATE para varias filas (columnas fijas definidas en este archivo). */
export async function upsertRows(sql: Sql, table: string, rows: Row[], conflict = 'id', chunk = 150) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const keys = conflict.split(',').map((k) => k.trim());
  const set = cols.filter((c) => !keys.includes(c)).map((c) => `"${c}" = excluded."${c}"`).join(', ');
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    await sql`insert into ${sql(table)} ${sql(part as Rec[], ...(cols as [string, ...string[]]))} on conflict (${sql.unsafe(keys.map((k) => `"${k}"`).join(', '))}) do ${set ? sql.unsafe(`update set ${set}, synced_at = now()`) : sql.unsafe('nothing')}`;
  }
}

/* ────────────────────────────── Catálogo ────────────────────────────── */

function categoryRow(c: Rec, position: number): Row {
  return { id: String(c.id), slug: String(c.slug), name: String(c.name), group: str(c.group), description: str(c.description), keywords: strs(c.keywords), position };
}

function institutionRow(i: Rec, position: number, sql: Sql): Row {
  return {
    id: String(i.id), slug: String(i.slug), name: String(i.name), short_name: str(i.short_name), type: str(i.type), country: str(i.country), city: str(i.city),
    founded: int(i.founded), brand_color: str(i.brand_color), description: str(i.description), website: str(i.website), programs_url: str(i.programs_url),
    logo_url: str(i.logo), accreditations: strs(i.accreditations), aliases: strs(i.aliases), is_demo: i.is_demo === true, position, raw: sql.json(i as never)
  };
}

function courseRow(c: Rec, position: number, sql: Sql): Row {
  const json = (v: unknown, fallback: unknown) => sql.json((v ?? fallback) as never);
  return {
    id: String(c.id), slug: String(c.slug), institution_id: String(c.institution_id), category_id: str(c.category), subcategory: str(c.subcategory),
    name: String(c.name), program_type: String(c.program_type ?? 'curso'), published_type: str(c.published_type),
    level: str(c.level), modality: str(c.modality), status: str(c.status) ?? 'publicado', featured: c.featured === true,
    price: num(c.price), discount_price: num(c.discount_price), currency: str(c.currency) ?? 'PEN',
    duration_hours: num(c.duration_hours), duration_weeks: num(c.duration_weeks), duration_text: str(c.duration_text),
    start_date: date(c.start_date), start_text: str(c.start_text), schedule: str(c.schedule), url: str(c.url), image_url: str(c.image),
    platform: str(c.platform), language: str(c.language), country: str(c.country), short_description: str(c.short_description),
    description: str(c.description), target_audience: str(c.target_audience),
    objectives: strs(c.objectives), tools: strs(c.tools), skills: strs(c.skills), keywords: strs(c.keywords), requirements: strs(c.requirements),
    teachers: json(c.teachers, []), syllabus: json(c.syllabus, []), financing: c.financing ? json(c.financing, null) : null,
    certificate: c.certificate ? json(c.certificate, null) : null, features: c.features ? json(c.features, null) : null,
    completeness: num(c.completeness), is_demo: c.is_demo === true, updated_at: str(c.updated_at), manual_edit_at: str(c.manual_edit_at),
    position, raw: sql.json(c as never)
  };
}

/**
 * Reemplaza las tablas del catálogo por el indicado y registra el historial de cambios por registro.
 * Debe llamarse dentro de una transacción (la abre el repositorio del catálogo).
 */
export async function writeCatalogTables(t: Sql, catalog: CatalogPayload, versionLabel: string | null): Promise<number> {
  const prevCourses = new Map((await t`select id, raw from courses`).map((r) => [r.id as string, r.raw as Rec]));
  const prevInst = new Map((await t`select id, raw from institutions`).map((r) => [r.id as string, r.raw as Rec]));

  await upsertRows(t, 'categories', catalog.categories.map((c, i) => categoryRow(c, i)));
  await upsertRows(t, 'institutions', catalog.institutions.map((i, n) => institutionRow(i, n, t)));
  await upsertRows(t, 'courses', catalog.courses.map((c, n) => courseRow(c, n, t)));

  const courseIds = catalog.courses.map((c) => String(c.id));
  const instIds = catalog.institutions.map((i) => String(i.id));
  const catIds = catalog.categories.map((c) => String(c.id));
  await t`delete from courses where not (id = any(${courseIds}::text[]))`;
  await t`delete from institutions where not (id = any(${instIds}::text[]))`;
  await t`delete from categories where not (id = any(${catIds}::text[]))`;

  // Historial: solo si ya había un catálogo (la primera carga no genera cientos de "altas").
  const log: Row[] = [];
  const diff = (entity: string, prev: Map<string, Rec>, next: Rec[]) => {
    if (!prev.size) return;
    const seen = new Set<string>();
    for (const item of next) {
      const id = String(item.id);
      seen.add(id);
      const before = prev.get(id);
      if (!before) log.push({ entity, entity_id: id, action: 'insert', before: null, after: t.json(item as never), version: versionLabel });
      else if (stable(before) !== stable(item)) log.push({ entity, entity_id: id, action: 'update', before: t.json(before as never), after: t.json(item as never), version: versionLabel });
    }
    for (const [id, before] of prev) if (!seen.has(id)) log.push({ entity, entity_id: id, action: 'delete', before: t.json(before as never), after: null, version: versionLabel });
  };
  diff('course', prevCourses, catalog.courses);
  diff('institution', prevInst, catalog.institutions);
  for (let i = 0; i < log.length; i += 200) await t`insert into catalog_changes ${t(log.slice(i, i + 200) as Rec[], 'entity', 'entity_id', 'action', 'before', 'after', 'version')}`;
  return log.length;
}

/* ─────────────────────────────── Leads ─────────────────────────────── */

export function leadRow(lead: Lead, sql: Sql): Row {
  return {
    id: lead.id, created_at: lead.created_at, updated_at: lead.updated_at ?? null, course_id: str(lead.course_id), course_name: lead.course_name,
    institution_id: str(lead.institution_id), institution_name: str(lead.institution_name), first_name: lead.first_name, last_name: lead.last_name,
    email: lead.email, whatsapp: str(lead.whatsapp), country: str(lead.country), start_timeline: str(lead.start_timeline), objective: str(lead.objective),
    consent: lead.consent === true, source: str(lead.source), page_url: str(lead.page_url), campaign: str(lead.campaign),
    utm_source: str(lead.utm_source), utm_medium: str(lead.utm_medium), utm_campaign: str(lead.utm_campaign), utm_term: str(lead.utm_term),
    utm_content: str(lead.utm_content), referrer: str(lead.referrer), lead_score: int(lead.lead_score), lead_tier: str(lead.lead_tier),
    lead_segment: str(lead.lead_segment), status: lead.status ?? 'nuevo', notes: lead.notes ?? '', raw: sql.json(lead as never)
  };
}

export const upsertLead = (sql: Sql, lead: Lead) => upsertRows(sql, 'leads', [leadRow(lead, sql)]);

/* ────────────────────────────── Reseñas ────────────────────────────── */

export function reviewRow(review: Review, sql: Sql): Row {
  return {
    id: review.id, created_at: review.created_at, course_id: review.course_id, course_name: str(review.course_name), institution_id: str(review.institution_id),
    institution_name: str(review.institution_name), rating: review.rating, title: str(review.title), comment: review.comment, relationship: str(review.relationship),
    author_name: str(review.author_name), author_email: str(review.author_email), status: review.status, reply: str(review.reply),
    rejection_reason: str(review.rejection_reason), moderated_at: str(review.moderated_at), page_url: str(review.page_url), raw: sql.json(review as never)
  };
}

export const upsertReview = (sql: Sql, review: Review) => upsertRows(sql, 'reviews', [reviewRow(review, sql)]);

/* ─────────────────────── Diagnósticos (Mi ruta) ─────────────────────── */

/** Guarda el diagnóstico completo: columnas consultables, tablas hijas y el registro original. `cvText` solo se escribe si se entrega. */
export async function upsertProfile(sql: Sql, p: ProfileAnalysis, cvText?: string | null): Promise<void> {
  const x = p.extract;
  const per = x.personal;
  const gap = p.diagnosis?.gap;
  const prefs = p.preferences;
  await sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    await upsertRows(t, 'profiles', [{
      id: p.id, created_at: p.created_at, updated_at: p.updated_at, source: p.source, engine: p.engine, objective: p.objective, description: p.description,
      preferences: t.json(p.preferences as never), first_name: per.first_name, last_name: per.last_name, email: per.email, phone: per.phone,
      country: per.country, city: per.city, linkedin: per.linkedin, current_position: x.current_role, current_company: x.current_company, headline: x.headline,
      seniority: x.seniority, years_experience: x.years_experience, highest_degree: x.highest_degree, current_studies: x.current_studies,
      certifications: x.certifications, languages: t.json(x.languages as never), tools: x.tools, summary: p.evaluation.summary,
      strengths: p.evaluation.strengths, gaps: p.evaluation.gaps, target_role: gap?.target_role ?? p.route.target_role, target_areas: gap?.target_areas ?? p.route.target_areas,
      target_role_input: prefs.target_role ?? null, target_level: gap?.target_level ?? null, readiness: gap?.readiness ?? null, time_estimate: gap?.time_estimate ?? null,
      expected_salary: prefs.expected_salary ?? null, expected_salary_currency: prefs.expected_salary ? prefs.salary_currency ?? 'PEN' : null,
      target_salary_min: gap?.target_salary?.min ?? null, target_salary_max: gap?.target_salary?.max ?? null, target_salary_currency: gap?.target_salary?.currency ?? null,
      salary_comparison: gap?.salary_comparison ?? null, modality: prefs.modality, budget_pen: prefs.budget_pen, hours_per_week: prefs.hours_per_week,
      diagnosis: p.diagnosis ? t.json(p.diagnosis as never) : null, studies: p.studies ? t.json(p.studies as never) : null,
      cv_blob_path: p.file?.pathname ?? null, cv_file_name: p.file?.name ?? null, cv_file_type: p.file?.type ?? null, cv_file_size: p.file?.size ?? null,
      contact_ok: p.contact_ok, status: p.status, notes: p.notes,
      analysis: t.json({ extract: p.extract, evaluation: p.evaluation, route: p.route } as never), raw: t.json(p as never)
    }]);
    if (cvText !== undefined && cvText !== null) await t`update profiles set cv_text = ${cvText.slice(0, 60_000)} where id = ${p.id}`;
    for (const table of ['profile_education', 'profile_experience', 'profile_scores', 'profile_route_courses', 'profile_suggested_roles', 'profile_gap_items', 'profile_studies']) await t`delete from ${t(table)} where profile_id = ${p.id}`;
    const edu = x.education.map((e, i) => ({ profile_id: p.id, position: i, degree: e.degree, field: e.field, institution: e.institution, level: e.level, status: e.status, end_year: e.end_year }));
    const exp = x.experience.map((e, i) => ({ profile_id: p.id, position: i, role: e.role, company: e.company, start_year: e.start_year, end_year: e.end_year, is_current: e.current }));
    const seen = new Set<string>();
    const scores = [
      ...p.evaluation.areas.map((a) => ({ kind: 'area', name: a.area, category_id: a.area_id, score: a.score, level: a.level, evidence: a.evidence })),
      ...p.evaluation.technical_skills.map((s) => ({ kind: 'tecnica', name: s.name, category_id: null, score: s.score, level: s.level, evidence: s.evidence })),
      ...p.evaluation.soft_skills.map((s) => ({ kind: 'blanda', name: s.name, category_id: null, score: s.score, level: s.level, evidence: s.evidence }))
    ].filter((s) => { const k = `${s.kind}|${s.name}`; if (seen.has(k)) return false; seen.add(k); return true; }).map((s) => ({ profile_id: p.id, ...s }));
    const route = p.route.stages.flatMap((s) => s.course_ids.map((course_id, i) => ({ profile_id: p.id, stage: s.order, stage_title: s.title, position: i, course_id })));
    if (edu.length) await t`insert into profile_education ${t(edu)}`;
    if (exp.length) await t`insert into profile_experience ${t(exp)}`;
    if (scores.length) await t`insert into profile_scores ${t(scores)}`;
    if (route.length) await t`insert into profile_route_courses ${t(route)}`;
    const roles = (p.diagnosis?.suggested_roles ?? []).map((r, i) => ({ profile_id: p.id, position: i, title: r.title, category_id: r.area_id, level: r.level, fit: r.fit, reason: r.reason, salary_min: r.salary?.min ?? null, salary_max: r.salary?.max ?? null, salary_currency: r.salary?.currency ?? null }));
    const gapItems = (gap?.items ?? []).map((it, i) => ({ profile_id: p.id, position: i, kind: it.kind, name: it.name, current_value: Math.round(it.current), required_value: Math.round(it.required), note: it.note }));
    const studies = [...(p.studies?.short_term ?? []), ...(p.studies?.long_term ?? [])].map((st) => ({ profile_id: p.id, term: st.term, course_id: st.course_id, reason: st.reason, covers: st.covers }));
    const studyRows = studies.map((st, i) => ({ ...st, position: studies.slice(0, i).filter((o) => o.term === st.term).length }));
    if (roles.length) await t`insert into profile_suggested_roles ${t(roles)}`;
    if (gapItems.length) await t`insert into profile_gap_items ${t(gapItems)}`;
    if (studyRows.length) await t`insert into profile_studies ${t(studyRows)}`;
  });
}

/* ────────────────── Importación de datos antiguos (Blob) ────────────────── */

export interface BlobSources {
  versions: () => Promise<VersionInfo[]>;
  leads: () => Promise<Lead[]>;
  reviews: () => Promise<Review[]>;
  profileIds: () => Promise<string[]>;
  profile: (id: string) => Promise<ProfileAnalysis | null>;
}

export interface ImportStats { versions: number; leads: number; reviews: number; profiles: number; skipped: { leads: number; reviews: number; profiles: number }; ms: number }

/**
 * Trae a la base lo que exista en Blob y todavía no esté en ella. No sobrescribe ni borra registros
 * de la base (la base es la fuente principal: lo que se editó aquí manda).
 */
export async function importFromBlob(sql: Sql, src: BlobSources, trigger = 'admin'): Promise<ImportStats> {
  const started = Date.now();
  const [run] = await sql`insert into sync_runs (trigger) values (${trigger}) returning id`;
  try {
    const versions = await src.versions();
    const vRows = versions.map((v) => ({ pathname: v.pathname, note: v.note || null, uploaded_at: v.uploaded_at, is_current: false }));
    for (let i = 0; i < vRows.length; i += 200) await sql`insert into catalog_versions ${sql(vRows.slice(i, i + 200))} on conflict (pathname) do nothing`;

    const existing = async (table: string, ids: string[]) => new Set((await sql`select id from ${sql(table)} where id = any(${ids}::text[])`).map((r) => r.id as string));

    const leads = await src.leads();
    const haveLeads = await existing('leads', leads.map((l) => l.id));
    const newLeads = leads.filter((l) => !haveLeads.has(l.id));
    for (let i = 0; i < newLeads.length; i += 150) await sql`insert into leads ${sql(newLeads.slice(i, i + 150).map((l) => leadRow(l, sql)) as Rec[])} on conflict (id) do nothing`;

    const reviews = await src.reviews();
    const haveReviews = await existing('reviews', reviews.map((r) => r.id));
    const newReviews = reviews.filter((r) => !haveReviews.has(r.id));
    for (const r of newReviews) await sql`insert into reviews ${sql(reviewRow(r, sql) as Rec)} on conflict do nothing`;

    const ids = await src.profileIds();
    const haveProfiles = await existing('profiles', ids);
    const missing = ids.filter((id) => !haveProfiles.has(id));
    let profiles = 0;
    for (let i = 0; i < missing.length; i += 10) {
      const batch = (await Promise.all(missing.slice(i, i + 10).map(src.profile))).filter((p): p is ProfileAnalysis => !!p);
      for (const p of batch) await upsertProfile(sql, p);
      profiles += batch.length;
    }

    const stats: ImportStats = {
      versions: versions.length, leads: newLeads.length, reviews: newReviews.length, profiles,
      skipped: { leads: haveLeads.size, reviews: haveReviews.size, profiles: haveProfiles.size }, ms: Date.now() - started
    };
    await sql`update sync_runs set finished_at = now(), stats = ${sql.json(stats as never)} where id = ${run.id}`;
    return stats;
  } catch (err) {
    await sql`update sync_runs set finished_at = now(), error = ${err instanceof Error ? err.message : String(err)} where id = ${run.id}`.catch(() => undefined);
    throw err;
  }
}

/** Estado de la base para /admin: migraciones, conteos y última importación. */
export async function dbStatus(sql: Sql) {
  const migrations = await sql`select version, applied_at from schema_migrations order by version`;
  const [counts] = await sql`
    select (select count(*) from courses)::int as courses, (select count(*) from institutions)::int as institutions,
           (select count(*) from categories)::int as categories, (select count(*) from catalog_versions)::int as catalog_versions,
           (select count(*) from catalog_changes)::int as catalog_changes, (select count(*) from leads)::int as leads,
           (select count(*) from reviews)::int as reviews, (select count(*) from profiles)::int as profiles`;
  const [last] = await sql`select id, started_at, finished_at, trigger, stats, error from sync_runs order by id desc limit 1`;
  return { migrations, counts, last_sync: last ?? null };
}
