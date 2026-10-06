/**
 * Espejo de los datos de Vercel Blob en la base (Supabase/PostgreSQL).
 *
 *  · Las funciones upsert y delete se llaman en cada escritura de la API (vía mirror) para mantener la base al día.
 *  · syncAll: copia completa e idempotente (catálogo, versiones, leads, reseñas, diagnósticos);
 *    también elimina de la base lo que ya no existe en Blob. Se ejecuta desde /admin → Base de datos.
 */
import type { Lead } from '../../src/types/lead.js';
import type { Review } from '../../src/types/review.js';
import type { ProfileAnalysis } from '../../src/types/profile.js';
import type { Sql } from './db.js';
import type { CatalogPayload } from './validate.js';
import type { VersionInfo } from './store.js';

type Rec = Record<string, unknown>;
type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null => (num(v) === null ? null : Math.round(v as number));
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null);
const stable = (v: unknown) => JSON.stringify(v, Object.keys((v ?? {}) as object).sort());

/** INSERT … ON CONFLICT (pk) DO UPDATE para varias filas (columnas fijas definidas en este archivo). */
async function upsertRows(sql: Sql, table: string, rows: Row[], conflict = 'id', chunk = 150) {
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

function institutionRow(i: Rec, sql: Sql): Row {
  return {
    id: String(i.id), slug: String(i.slug), name: String(i.name), short_name: str(i.short_name), type: str(i.type), country: str(i.country), city: str(i.city),
    founded: int(i.founded), brand_color: str(i.brand_color), description: str(i.description), website: str(i.website), programs_url: str(i.programs_url),
    logo_url: str(i.logo), accreditations: strs(i.accreditations), aliases: strs(i.aliases), is_demo: i.is_demo === true, raw: sql.json(i as never)
  };
}

function courseRow(c: Rec, sql: Sql): Row {
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
    completeness: num(c.completeness), is_demo: c.is_demo === true, updated_at: str(c.updated_at), manual_edit_at: str(c.manual_edit_at), raw: sql.json(c as never)
  };
}

/** Reemplaza el catálogo de la base por el indicado (y registra el historial de cambios por registro). */
export async function upsertCatalog(sql: Sql, catalog: CatalogPayload, version?: VersionInfo | null): Promise<{ courses: number; institutions: number; categories: number; changes: number }> {
  let changes = 0;
  await sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    const prevCourses = new Map((await t`select id, raw from courses`).map((r) => [r.id as string, r.raw as Rec]));
    const prevInst = new Map((await t`select id, raw from institutions`).map((r) => [r.id as string, r.raw as Rec]));
    const versionLabel = version?.pathname ?? null;

    await upsertRows(t, 'categories', catalog.categories.map((c, i) => categoryRow(c, i)));
    await upsertRows(t, 'institutions', catalog.institutions.map((i) => institutionRow(i, t)));
    await upsertRows(t, 'courses', catalog.courses.map((c) => courseRow(c, t)));

    const courseIds = catalog.courses.map((c) => String(c.id));
    const instIds = catalog.institutions.map((i) => String(i.id));
    const catIds = catalog.categories.map((c) => String(c.id));
    await t`delete from courses where not (id = any(${courseIds}::text[]))`;
    await t`delete from institutions where not (id = any(${instIds}::text[]))`;
    await t`delete from categories where not (id = any(${catIds}::text[]))`;

    // Historial: solo si ya había un catálogo (la primera carga no genera 300 "altas").
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
    changes = log.length;

    if (version) {
      await t`update catalog_versions set is_current = false where is_current`;
      await upsertRows(t, 'catalog_versions', [{ pathname: version.pathname, note: version.note || null, uploaded_at: version.uploaded_at, courses_count: catalog.courses.length, is_current: true }], 'pathname');
    }
  });
  return { courses: catalog.courses.length, institutions: catalog.institutions.length, categories: catalog.categories.length, changes };
}

export async function upsertVersions(sql: Sql, versions: VersionInfo[]) {
  const current = versions[0]?.pathname;
  await upsertRows(sql, 'catalog_versions', versions.map((v) => ({ pathname: v.pathname, note: v.note || null, uploaded_at: v.uploaded_at, is_current: v.pathname === current })), 'pathname');
  const paths = versions.map((v) => v.pathname);
  await sql`delete from catalog_versions where not (pathname = any(${paths}::text[]))`;
}

/* ─────────────────────────────── Leads ─────────────────────────────── */

function leadRow(l: Lead & { pathname?: string }, sql: Sql): Row {
  const { pathname, ...lead } = l;
  return {
    id: lead.id, created_at: lead.created_at, updated_at: lead.updated_at ?? null, course_id: str(lead.course_id), course_name: lead.course_name,
    institution_id: str(lead.institution_id), institution_name: str(lead.institution_name), first_name: lead.first_name, last_name: lead.last_name,
    email: lead.email, whatsapp: str(lead.whatsapp), country: str(lead.country), start_timeline: str(lead.start_timeline), objective: str(lead.objective),
    consent: lead.consent === true, source: str(lead.source), page_url: str(lead.page_url), campaign: str(lead.campaign),
    utm_source: str(lead.utm_source), utm_medium: str(lead.utm_medium), utm_campaign: str(lead.utm_campaign), utm_term: str(lead.utm_term),
    utm_content: str(lead.utm_content), referrer: str(lead.referrer), lead_score: int(lead.lead_score), lead_tier: str(lead.lead_tier),
    lead_segment: str(lead.lead_segment), status: lead.status ?? 'nuevo', notes: lead.notes ?? '', blob_path: pathname ?? null, raw: sql.json(lead as never)
  };
}

export const upsertLead = (sql: Sql, lead: Lead, pathname: string) => upsertRows(sql, 'leads', [leadRow({ ...lead, pathname }, sql)]);
export const deleteLeadRow = (sql: Sql, pathname: string) => sql`delete from leads where blob_path = ${pathname}`;

/* ────────────────────────────── Reseñas ────────────────────────────── */

function reviewRow(r: Review & { pathname?: string }, sql: Sql): Row {
  const { pathname, ...review } = r;
  return {
    id: review.id, created_at: review.created_at, course_id: review.course_id, course_name: str(review.course_name), institution_id: str(review.institution_id),
    institution_name: str(review.institution_name), rating: review.rating, title: str(review.title), comment: review.comment, relationship: str(review.relationship),
    author_name: str(review.author_name), author_email: str(review.author_email), status: review.status, reply: str(review.reply),
    rejection_reason: str(review.rejection_reason), moderated_at: str(review.moderated_at), page_url: str(review.page_url), blob_path: pathname ?? null, raw: sql.json(review as never)
  };
}

export const upsertReview = (sql: Sql, review: Review, pathname: string) => upsertRows(sql, 'reviews', [reviewRow({ ...review, pathname }, sql)]);
export const deleteReviewRow = (sql: Sql, pathname: string) => sql`delete from reviews where blob_path = ${pathname}`;

/* ─────────────────────── Diagnósticos (Mi ruta) ─────────────────────── */

export async function upsertProfile(sql: Sql, p: ProfileAnalysis): Promise<void> {
  const x = p.extract;
  const per = x.personal;
  await sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    await upsertRows(t, 'profiles', [{
      id: p.id, created_at: p.created_at, updated_at: p.updated_at, source: p.source, engine: p.engine, objective: p.objective, description: p.description,
      preferences: t.json(p.preferences as never), first_name: per.first_name, last_name: per.last_name, email: per.email, phone: per.phone,
      country: per.country, city: per.city, linkedin: per.linkedin, current_position: x.current_role, current_company: x.current_company, headline: x.headline,
      seniority: x.seniority, years_experience: x.years_experience, highest_degree: x.highest_degree, current_studies: x.current_studies,
      certifications: x.certifications, languages: t.json(x.languages as never), tools: x.tools, summary: p.evaluation.summary,
      strengths: p.evaluation.strengths, gaps: p.evaluation.gaps, target_role: p.route.target_role, target_areas: p.route.target_areas,
      cv_blob_path: p.file?.pathname ?? null, cv_file_name: p.file?.name ?? null, cv_file_type: p.file?.type ?? null, cv_file_size: p.file?.size ?? null,
      contact_ok: p.contact_ok, status: p.status, notes: p.notes,
      analysis: t.json({ extract: p.extract, evaluation: p.evaluation, route: p.route } as never), raw: t.json(p as never)
    }]);
    for (const table of ['profile_education', 'profile_experience', 'profile_scores', 'profile_route_courses']) await t`delete from ${t(table)} where profile_id = ${p.id}`;
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
  });
}

export const deleteProfileRow = (sql: Sql, id: string) => sql`delete from profiles where id = ${id}`;

/* ─────────────────────────── Sincronización ─────────────────────────── */

export interface SyncSources {
  catalog: () => Promise<{ data: CatalogPayload; version: VersionInfo } | null>;
  versions: () => Promise<VersionInfo[]>;
  leads: () => Promise<(Lead & { pathname: string })[]>;
  reviews: () => Promise<(Review & { pathname: string })[]>;
  profileIds: () => Promise<string[]>;
  profile: (id: string) => Promise<ProfileAnalysis | null>;
}

export interface SyncStats { catalog: { courses: number; institutions: number; categories: number; changes: number } | null; versions: number; leads: number; reviews: number; profiles: number; removed: { leads: number; reviews: number; profiles: number }; ms: number }

export async function syncAll(sql: Sql, src: SyncSources, trigger = 'admin'): Promise<SyncStats> {
  const started = Date.now();
  const [run] = await sql`insert into sync_runs (trigger) values (${trigger}) returning id`;
  try {
    const latest = await src.catalog();
    const catalog = latest ? await upsertCatalog(sql, latest.data, latest.version) : null;
    const versions = await src.versions();
    await upsertVersions(sql, versions);

    const leads = await src.leads();
    await upsertRows(sql, 'leads', leads.map((l) => leadRow(l, sql)));
    const leadIds = leads.map((l) => l.id);
    const rl = await sql`delete from leads where not (id = any(${leadIds}::text[]))`;

    const reviews = await src.reviews();
    await upsertRows(sql, 'reviews', reviews.map((r) => reviewRow(r, sql)));
    const reviewIds = reviews.map((r) => r.id);
    const rr = await sql`delete from reviews where not (id = any(${reviewIds}::text[]))`;

    const ids = await src.profileIds();
    let profiles = 0;
    for (let i = 0; i < ids.length; i += 10) {
      const batch = (await Promise.all(ids.slice(i, i + 10).map(src.profile))).filter((p): p is ProfileAnalysis => !!p);
      for (const p of batch) await upsertProfile(sql, p);
      profiles += batch.length;
    }
    const rp = await sql`delete from profiles where not (id = any(${ids}::text[]))`;

    const stats: SyncStats = { catalog, versions: versions.length, leads: leads.length, reviews: reviews.length, profiles, removed: { leads: rl.count, reviews: rr.count, profiles: rp.count }, ms: Date.now() - started };
    await sql`update sync_runs set finished_at = now(), stats = ${sql.json(stats as never)} where id = ${run.id}`;
    return stats;
  } catch (err) {
    await sql`update sync_runs set finished_at = now(), error = ${err instanceof Error ? err.message : String(err)} where id = ${run.id}`.catch(() => undefined);
    throw err;
  }
}

/**
 * Primera sincronización: si la base nunca se sincronizó, copia todo una vez (idempotente).
 * Devuelve 'ran' si la ejecutó, 'done' si ya existía una sincronización previa.
 */
export async function ensureInitialSync(sql: Sql, src: SyncSources): Promise<'ran' | 'done'> {
  const [row] = await sql`select count(*)::int as n from sync_runs where error is null`;
  if (row.n > 0) return 'done';
  await syncAll(sql, src, 'inicial');
  return 'ran';
}

/** Estado de la base para /admin: migraciones, conteos y última sincronización. */
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
