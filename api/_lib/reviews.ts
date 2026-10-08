/**
 * Groulevel Reviews (tabla `reviews`): reputación de instituciones (principal) y de programas (complementaria).
 *
 *  · Solo personas con correo validado pueden opinar (una reseña por institución y programa).
 *  · Moderación previa; se publican opiniones positivas y negativas por igual (criterios objetivos).
 *  · Evidencia opcional (certificado/constancia) en Blob privado: nunca se publica; si se aprueba, la reseña
 *    lleva la insignia "Reseña verificada".
 *  · Incentivos: S/ 50 por reseña institucional verificada + S/ 50 por evaluación detallada del programa;
 *    no dependen de la calificación; uno por persona e institución/programa; las reseñas incentivadas se
 *    identifican públicamente.
 * Para el administrador, `pathname` es el id de la reseña (compatibilidad con el cliente).
 */
import { createHash } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import { average, displayName, isDetailedProgramReview, validateSubmission, type ReviewSubmission } from '../../src/utils/reviews.js';
import type { EvidenceStatus, InstitutionScores, ProgramScores, PublicReview, RatingSummary, Review, ReviewsSummary, ReviewStatus } from '../../src/types/review.js';
import type { Sql } from './db.js';
import { getSql } from './db.js';
import type { ReviewUser } from './reviewAuth.js';
import { touchReviewer } from './reviewAuth.js';

export const REVIEW_STATUSES: ReviewStatus[] = ['pendiente', 'aprobada', 'rechazada'];
export const INCENTIVE = { institucion: 50, programa: 50 } as const;
export type StoredReview = Review & { pathname: string };

const REVIEW_ID = /^rev_[a-z0-9]{4,40}$/;
const EVIDENCE_DIR = 'review-evidence/';
const EVIDENCE_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_EVIDENCE = 8 * 1024 * 1024;

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const n = (v: unknown) => (v == null ? null : Number(v));

/** Fila de la base → reseña pública (también entiende las reseñas anteriores, solo de programa). */
export function toPublic(r: Row): PublicReview {
  return {
    id: String(r.id),
    kind: (r.kind as PublicReview['kind']) ?? 'programa',
    institution_id: String(r.institution_id ?? ''),
    institution_name: String(r.institution_name ?? ''),
    course_id: (r.course_id as string) ?? null,
    course_name: (r.course_name as string) ?? null,
    rating: Number(r.inst_rating ?? r.rating),
    inst_scores: (r.inst_scores as InstitutionScores) ?? null,
    program_rating: n(r.program_rating ?? (r.kind === 'programa' ? r.rating : null)),
    program_scores: (r.program_scores as ProgramScores) ?? null,
    best: (r.best as string) ?? null,
    improve: (r.improve as string) ?? null,
    recommend: (r.recommend as boolean) ?? null,
    study_year: n(r.study_year),
    student_status: (r.student_status as PublicReview['student_status']) ?? null,
    verified: !!r.verified,
    incentivized: !!r.incentivized,
    title: String(r.title ?? ''),
    comment: String(r.comment ?? ''),
    author_name: String(r.author_name ?? ''),
    relationship: (r.relationship as PublicReview['relationship']) ?? 'egresado',
    created_at: iso(r.created_at)!,
    reply: (r.reply as string) ?? null
  };
}

function toAdmin(r: Row): StoredReview {
  return {
    ...toPublic(r),
    author_email: String(r.author_email ?? ''),
    user_id: (r.user_id as string) ?? null,
    email_verified: !!r.email_verified,
    evidence_name: (r.evidence_name as string) ?? null,
    evidence_status: (r.evidence_status as EvidenceStatus) ?? 'sin_evidencia',
    reports_count: Number(r.reports_count ?? 0),
    flags: (r.flags as string[]) ?? [],
    criteria: (r.criteria as string[]) ?? [],
    status: r.status as ReviewStatus,
    rejection_reason: (r.rejection_reason as string) ?? null,
    moderated_at: iso(r.moderated_at),
    page_url: String(r.page_url ?? ''),
    pathname: String(r.id)
  };
}

/* ───────────────────────────── Envío ───────────────────────────── */

export interface EvidenceFile { name: string; type: string; bytes: Uint8Array }
export type SubmitResult = { ok: true; review: PublicReview & { status: ReviewStatus }; incentive: number } | { ok: false; status: number; message: string; errors?: string[] };

const normText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const scoresOf = <T extends object>(o: unknown, keys: (keyof T)[]): T | null => {
  if (!o || typeof o !== 'object') return null;
  const out = {} as Record<string, number>;
  for (const k of keys) out[k as string] = Number((o as Record<string, unknown>)[k as string]);
  return out as T;
};

export function parseSubmission(fields: Record<string, string>): Partial<ReviewSubmission> {
  const parse = (s: string | undefined) => {
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };
  return {
    institution_id: fields.institution_id?.trim() || '',
    course_id: fields.course_id?.trim() || null,
    inst_scores: scoresOf<InstitutionScores>(parse(fields.inst_scores), ['academic', 'teachers', 'experience', 'compliance', 'value']) ?? {},
    program_scores: scoresOf<ProgramScores>(parse(fields.program_scores), ['content', 'methodology', 'tools', 'teacher']),
    best: fields.best ?? '',
    improve: fields.improve ?? '',
    recommend: fields.recommend === 'si' ? true : fields.recommend === 'no' ? false : null,
    study_year: fields.study_year ? Number(fields.study_year) : null,
    student_status: (fields.student_status as ReviewSubmission['student_status']) || null,
    author_name: fields.author_name ?? '',
    wants_incentive: fields.wants_incentive === 'true',
    payout_method: (['yape', 'plin', 'transferencia'].includes(fields.payout_method ?? '') ? fields.payout_method : null) as ReviewSubmission['payout_method'],
    payout_account: (fields.payout_account ?? '').trim().slice(0, 60),
    consent: fields.consent === 'true'
  };
}

export async function submitReview(user: ReviewUser, input: Partial<ReviewSubmission>, file: EvidenceFile | null, pageUrl = '', sql: Sql = getSql()): Promise<SubmitResult> {
  if (!user.email_verified) return { ok: false, status: 403, message: 'Valida tu correo antes de opinar.' };
  const errors = validateSubmission(input);
  if (file) {
    if (!EVIDENCE_TYPES[file.type]) errors.evidence = 'La constancia debe ser PDF, JPG, PNG o WEBP.';
    else if (file.bytes.byteLength > MAX_EVIDENCE) errors.evidence = 'La constancia no puede superar 8 MB.';
  }
  if (Object.keys(errors).length) return { ok: false, status: 422, message: 'Revisa los datos de la reseña.', errors: Object.values(errors) };
  const v = input as ReviewSubmission;

  const [inst] = await sql`select id, name from institutions where id = ${v.institution_id}`;
  if (!inst) return { ok: false, status: 422, message: 'La institución no existe.' };
  let course: Row | undefined;
  if (v.course_id) {
    [course] = await sql`select id, name, institution_id from courses where id = ${v.course_id} and status = 'publicado'`;
    if (!course || course.institution_id !== inst.id) return { ok: false, status: 422, message: 'El programa no corresponde a la institución elegida.' };
  }

  const { blocked } = await touchReviewer(user, { display_name: v.author_name.trim(), payout_method: v.wants_incentive ? v.payout_method : null, payout_account: v.wants_incentive ? v.payout_account : null }, sql);
  if (blocked) return { ok: false, status: 403, message: 'Tu cuenta no puede publicar reseñas. Escríbenos si crees que es un error.' };
  const [dup] = await sql`select 1 from reviews where user_id = ${user.id} and institution_id = ${inst.id} and coalesce(course_id, '') = ${v.course_id ?? ''}`;
  if (dup) return { ok: false, status: 409, message: v.course_id ? 'Ya opinaste sobre este programa. ¡Gracias!' : 'Ya opinaste sobre esta institución. ¡Gracias!' };

  const id = `rev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const instScores = v.inst_scores as InstitutionScores;
  const progScores = v.course_id ? (v.program_scores as ProgramScores) : null;
  const instRating = average(instScores as unknown as Record<string, number>)!;
  const progRating = progScores ? average(progScores as unknown as Record<string, number>) : null;

  // Señales antifraude (no bloquean: se muestran al moderar).
  const flags: string[] = [];
  let evidence: { path: string; name: string; hash: string } | null = null;
  if (file) {
    const hash = createHash('sha256').update(file.bytes).digest('hex');
    const [reused] = await sql`select 1 from reviews where evidence_hash = ${hash} and coalesce(user_id, '') <> ${user.id} limit 1`;
    if (reused) flags.push('evidencia_repetida');
    const name = file.name.replace(/[^\w.\- ]+/g, '_').slice(-80) || `constancia.${EVIDENCE_TYPES[file.type]}`;
    const path = `${EVIDENCE_DIR}${id}/${name}`;
    await put(path, Buffer.from(file.bytes), { access: 'private', contentType: file.type, addRandomSuffix: false });
    evidence = { path, name, hash };
  }
  const text = normText(`${v.best} ${v.improve}`);
  const similar = await sql`select best, improve from reviews where institution_id = ${inst.id} and best is not null order by created_at desc limit 300`;
  if (similar.some((r) => normText(`${r.best} ${r.improve}`) === text)) flags.push('texto_duplicado');
  const [recent] = await sql`select count(*)::int c from reviews where user_id = ${user.id} and created_at > now() - interval '24 hours'`;
  if (recent.c >= 3) flags.push('muchas_resenas_24h');
  if (v.wants_incentive) {
    const [shared] = await sql`select 1 from reviewers where payout_account = ${v.payout_account} and user_id <> ${user.id} limit 1`;
    if (shared) flags.push('cuenta_de_pago_compartida');
  }

  const now = new Date().toISOString();
  const pub: PublicReview = {
    id, kind: 'institucion', institution_id: String(inst.id), institution_name: String(inst.name), course_id: (course?.id as string) ?? null, course_name: (course?.name as string) ?? null,
    rating: instRating, inst_scores: instScores, program_rating: progRating, program_scores: progScores, best: v.best.trim(), improve: v.improve.trim(), recommend: v.recommend,
    study_year: v.study_year, student_status: v.student_status, verified: false, incentivized: v.wants_incentive, title: '', comment: `${v.best.trim()}\n\n${v.improve.trim()}`,
    author_name: displayName(v.author_name), relationship: v.student_status === 'estudiante' ? 'estudiante' : 'egresado', created_at: now, reply: null
  };
  try {
    await sql`insert into reviews (id, created_at, kind, user_id, email_verified, institution_id, institution_name, course_id, course_name, rating, inst_rating, inst_scores,
        program_rating, program_scores, title, comment, best, improve, recommend, study_year, student_status, relationship, author_name, author_email, status,
        evidence_path, evidence_name, evidence_hash, evidence_status, verified, incentivized, flags, page_url, raw)
      values (${id}, ${now}, 'institucion', ${user.id}, true, ${pub.institution_id}, ${pub.institution_name}, ${pub.course_id}, ${pub.course_name}, ${Math.round(instRating)}, ${instRating},
        ${sql.json(instScores as never)}, ${progRating}, ${progScores ? sql.json(progScores as never) : null}, null, ${pub.comment}, ${pub.best}, ${pub.improve}, ${v.recommend},
        ${v.study_year}, ${v.student_status}, ${pub.relationship}, ${pub.author_name}, ${user.email}, 'pendiente', ${evidence?.path ?? null}, ${evidence?.name ?? null},
        ${evidence?.hash ?? null}, ${evidence ? 'pendiente' : 'sin_evidencia'}, false, ${v.wants_incentive}, ${flags}, ${pageUrl.slice(0, 500)}, ${sql.json(pub as never)})`;
  } catch (err) {
    if (evidence) await del(evidence.path).catch(() => {});
    if ((err as { code?: string }).code === '23505') return { ok: false, status: 409, message: 'Ya enviaste esta reseña. ¡Gracias!' };
    throw err;
  }

  // Incentivos solicitados: quedan pendientes hasta aprobar la reseña y verificar la evidencia.
  let incentive = 0;
  if (v.wants_incentive) {
    const wanted: { kind: 'institucion' | 'programa'; course: string; amount: number }[] = [{ kind: 'institucion', course: '', amount: INCENTIVE.institucion }];
    if (isDetailedProgramReview(v)) wanted.push({ kind: 'programa', course: v.course_id!, amount: INCENTIVE.programa });
    for (const w of wanted) {
      const rows = await sql`insert into review_incentives (review_id, user_id, institution_id, course_id, kind, amount)
        values (${id}, ${user.id}, ${pub.institution_id}, ${w.course}, ${w.kind}, ${w.amount}) on conflict do nothing returning id`;
      if (rows.length) incentive += w.amount;
      else await sql`update reviews set flags = array_append(flags, ${`incentivo_${w.kind}_ya_otorgado`}) where id = ${id}`;
    }
  }
  return { ok: true, review: { ...pub, status: 'pendiente' } as PublicReview & { status: ReviewStatus }, incentive };
}

/* ─────────────────────────── Lectura pública ─────────────────────────── */

const PUBLIC_COLS = 'id, kind, institution_id, institution_name, course_id, course_name, rating, inst_rating, inst_scores, program_rating, program_scores, best, improve, recommend, study_year, student_status, verified, incentivized, title, comment, author_name, relationship, created_at, reply';

/** Reseñas aprobadas de un programa (evaluación del programa) y de su institución (reputación principal). */
export async function reviewsForCourse(courseId: string, sql: Sql = getSql()) {
  if (!/^[a-z0-9-]{1,40}$/i.test(courseId)) return { reviews: [], institution_reviews: [] };
  const [c] = await sql`select institution_id from courses where id = ${courseId}`;
  const [program, institution] = await Promise.all([
    sql.unsafe(`select ${PUBLIC_COLS} from reviews where course_id = $1 and status = 'aprobada' order by created_at desc limit 200`, [courseId]),
    c ? sql.unsafe(`select ${PUBLIC_COLS} from reviews where institution_id = $1 and status = 'aprobada' order by created_at desc limit 200`, [String(c.institution_id)]) : Promise.resolve([])
  ]);
  return { reviews: program.map(toPublic), institution_reviews: institution.map(toPublic) };
}

export async function reviewsForInstitution(institutionId: string, sql: Sql = getSql()): Promise<PublicReview[]> {
  if (!/^[a-z0-9-]{1,60}$/i.test(institutionId)) return [];
  return (await sql.unsafe(`select ${PUBLIC_COLS} from reviews where institution_id = $1 and status = 'aprobada' order by created_at desc limit 300`, [institutionId])).map(toPublic);
}

const dist = (rows: Row[], key: string, id: string): RatingSummary['distribution'] => {
  const d: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
  for (const r of rows) if (r[key] === id) d[Math.min(4, Math.max(0, Number(r.star) - 1))] += Number(r.n);
  return d;
};

export async function publicSummary(sql: Sql = getSql()): Promise<ReviewsSummary> {
  const [courses, institutions, cDist, iDist] = await Promise.all([
    sql`select * from course_ratings`,
    sql`select * from institution_ratings`,
    sql`select course_id, round(coalesce(program_rating, rating))::int star, count(*)::int n from reviews where status = 'aprobada' and course_id is not null and (program_rating is not null or kind = 'programa') group by 1, 2`,
    sql`select institution_id, round(coalesce(inst_rating, rating))::int star, count(*)::int n from reviews where status = 'aprobada' and institution_id is not null group by 1, 2`
  ]);
  const out: ReviewsSummary = { courses: {}, institutions: {}, updated_at: new Date().toISOString() };
  const dims = (r: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => r[k] != null).map((k) => [k, Number(r[k])]));
  for (const r of courses) {
    out.courses[String(r.course_id)] = { avg: Number(r.avg_rating), count: Number(r.reviews_count), distribution: dist(cDist, 'course_id', String(r.course_id)), institution_id: String(r.institution_id ?? ''), dims: dims(r, ['content', 'methodology', 'tools', 'teacher']) };
  }
  for (const r of institutions) {
    out.institutions[String(r.institution_id)] = { avg: Number(r.avg_rating), count: Number(r.reviews_count), distribution: dist(iDist, 'institution_id', String(r.institution_id)), dims: dims(r, ['academic', 'teachers', 'experience', 'compliance', 'value']), recommend_pct: r.recommend_pct == null ? null : Number(r.recommend_pct) };
  }
  return out;
}

/** Reportar una reseña sospechosa (una vez por persona; la huella es anónima). */
export async function reportReview(request: Request, id: string, reason: string, details: string, sql: Sql = getSql()): Promise<boolean> {
  if (!REVIEW_ID.test(id)) return false;
  const [r] = await sql`select 1 from reviews where id = ${id} and status = 'aprobada'`;
  if (!r) return false;
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const fp = createHash('sha256').update(`${ip}|${request.headers.get('user-agent') ?? ''}|${id}`).digest('hex').slice(0, 32);
  const rows = await sql`insert into review_reports (review_id, reason, details, reporter_hash) values (${id}, ${reason.slice(0, 60)}, ${details.slice(0, 600) || null}, ${fp})
    on conflict do nothing returning id`;
  if (rows.length) await sql`update reviews set reports_count = reports_count + 1 where id = ${id}`;
  return true;
}

/** Reseñas de la persona (estado e incentivos). */
export async function myReviews(user: ReviewUser, sql: Sql = getSql()) {
  const rows = await sql`select r.id, r.institution_name, r.course_name, r.status, r.evidence_status, r.verified, r.created_at,
      coalesce((select json_agg(json_build_object('kind', i.kind, 'amount', i.amount, 'status', i.status)) from review_incentives i where i.review_id = r.id), '[]') as incentives
    from reviews r where r.user_id = ${user.id} order by r.created_at desc`;
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}

/* ───────────────────────────── Administración ───────────────────────────── */

export async function listAllReviews(sql: Sql = getSql()): Promise<StoredReview[]> {
  return (await sql`select * from reviews order by created_at desc limit 3000`).map(toAdmin);
}

export const CRITERIA = ['experiencia_real', 'sin_datos_personales', 'sin_lenguaje_ofensivo', 'no_publicitaria', 'relevante'] as const;

export async function moderateReview(id: string, patch: { status?: unknown; reply?: unknown; rejection_reason?: unknown; evidence_status?: unknown; criteria?: unknown }, sql: Sql = getSql()): Promise<StoredReview | null> {
  if (!REVIEW_ID.test(id)) return null;
  const [cur] = await sql`select * from reviews where id = ${id}`;
  if (!cur) return null;
  const status = REVIEW_STATUSES.includes(patch.status as ReviewStatus) ? (patch.status as ReviewStatus) : (cur.status as ReviewStatus);
  const evidence = ['pendiente', 'aprobada', 'rechazada'].includes(patch.evidence_status as string) && cur.evidence_path ? (patch.evidence_status as EvidenceStatus) : (cur.evidence_status as EvidenceStatus);
  const reply = typeof patch.reply === 'string' ? patch.reply.trim().slice(0, 800) || null : (cur.reply as string | null);
  const reason = typeof patch.rejection_reason === 'string' ? patch.rejection_reason.trim().slice(0, 300) || null : (cur.rejection_reason as string | null);
  const criteria = Array.isArray(patch.criteria) ? patch.criteria.map(String).filter((c) => (CRITERIA as readonly string[]).includes(c)) : (cur.criteria as string[]);
  const verified = evidence === 'aprobada';
  const [row] = await sql`update reviews set status = ${status}, evidence_status = ${evidence}, verified = ${verified}, reply = ${reply}, rejection_reason = ${reason},
      criteria = ${criteria}, moderated_at = now(), updated_at = now() where id = ${id} returning *`;
  // Sin reseña publicada o sin evidencia válida no hay incentivo.
  if (status === 'rechazada' || evidence === 'rechazada') {
    await sql`update review_incentives set status = 'rechazado', decided_at = now(), note = ${status === 'rechazada' ? 'Reseña no publicada' : 'Evidencia no válida'}
      where review_id = ${id} and status in ('pendiente', 'aprobado')`;
  }
  return toAdmin(row);
}

export async function deleteReview(id: string, sql: Sql = getSql()): Promise<boolean> {
  if (!REVIEW_ID.test(id)) return false;
  const [row] = await sql`delete from reviews where id = ${id} returning evidence_path`;
  if (row?.evidence_path) await del(String(row.evidence_path)).catch(() => {});
  return !!row;
}

/** Evidencia original (solo administrador; nunca pública). */
export async function reviewEvidence(id: string, sql: Sql = getSql()): Promise<Response | null> {
  if (!REVIEW_ID.test(id)) return null;
  const [r] = await sql`select evidence_path, evidence_name from reviews where id = ${id}`;
  if (!r?.evidence_path || !String(r.evidence_path).startsWith(EVIDENCE_DIR)) return null;
  const res = await get(String(r.evidence_path), { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return null;
  const name = String(r.evidence_name ?? 'constancia');
  const type = Object.entries(EVIDENCE_TYPES).find(([, ext]) => name.toLowerCase().endsWith(`.${ext}`))?.[0] ?? 'application/octet-stream';
  return new Response(res.stream, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function listIncentives(sql: Sql = getSql()) {
  return sql`select i.*, r.status as review_status, r.verified, r.author_name, r.institution_name, r.course_name, r.flags,
      v.email, v.payout_method, v.payout_account, v.blocked
    from review_incentives i join reviews r on r.id = i.review_id left join reviewers v on v.user_id = i.user_id
    order by case i.status when 'pendiente' then 0 when 'aprobado' then 1 else 2 end, i.created_at desc limit 1000`;
}

export class IncentiveError extends Error {}

export async function updateIncentive(id: number, status: string, note: string | null, sql: Sql = getSql()) {
  const [i] = await sql`select i.status, r.status as review_status, r.verified from review_incentives i join reviews r on r.id = i.review_id where i.id = ${id}`;
  if (!i) return null;
  if (status === 'aprobado' && !(i.review_status === 'aprobada' && i.verified)) throw new IncentiveError('Solo se aprueba con la reseña publicada y la evidencia verificada.');
  if (status === 'pagado' && i.status !== 'aprobado') throw new IncentiveError('Primero aprueba el incentivo.');
  if (!['aprobado', 'pagado', 'rechazado', 'pendiente'].includes(status)) throw new IncentiveError('Estado inválido.');
  const [row] = await sql`update review_incentives set status = ${status}, note = coalesce(${note}, note), decided_at = now(),
      paid_at = case when ${status} = 'pagado' then now() else paid_at end where id = ${id} returning *`;
  return row;
}

export async function listReports(sql: Sql = getSql()) {
  return sql`select p.*, r.institution_name, r.course_name, r.author_name, r.status as review_status from review_reports p join reviews r on r.id = p.review_id
    order by case p.status when 'abierto' then 0 else 1 end, p.created_at desc limit 500`;
}

export async function resolveReport(id: number, status: 'resuelto' | 'descartado', sql: Sql = getSql()) {
  const rows = await sql`update review_reports set status = ${status}, resolved_at = now() where id = ${id} returning id`;
  return rows.length > 0;
}

export async function setReviewerBlocked(userId: string, blocked: boolean, sql: Sql = getSql()) {
  const rows = await sql`update reviewers set blocked = ${blocked} where user_id = ${userId} returning user_id`;
  return rows.length > 0;
}
