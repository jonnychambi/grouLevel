/**
 * Reseñas en la base (tabla `reviews`), con moderación.
 * Solo las aprobadas se publican; los promedios se calculan con SQL en cada lectura (con caché de CDN).
 * Para el administrador, `pathname` es el id de la reseña (compatibilidad con el cliente).
 */
import { displayName, institutionSummaries, summarize, validateReview, type ReviewInput } from '../../src/utils/reviews.js';
import type { PublicReview, Review, ReviewRelationship, ReviewsSummary, ReviewStatus } from '../../src/types/review.js';
import type { CourseRef } from './guard.js';
import { getSql } from './db.js';
import { upsertReview } from './dbSync.js';

export const REVIEW_STATUSES: ReviewStatus[] = ['pendiente', 'aprobada', 'rechazada'];

export type StoredReview = Review & { pathname: string };
const safeId = (id: string) => /^[a-z0-9-]{1,40}$/i.test(id);
const REVIEW_ID = /^rev_[a-z0-9]{4,40}$/;
const stored = (r: Review): StoredReview => ({ ...r, pathname: r.id });

/* ------------------------------------------------------------- Envío público */

export async function submitReview(body: Record<string, unknown>, course: CourseRef | null): Promise<{ ok: true; review: Review } | { ok: false; status: number; message: string; errors?: string[] }> {
  if (!course || !safeId(course.id)) return { ok: false, status: 422, message: 'El programa no existe.' };
  const input: Partial<ReviewInput> = {
    rating: typeof body.rating === 'number' ? body.rating : Number(body.rating),
    title: typeof body.title === 'string' ? body.title : '',
    comment: typeof body.comment === 'string' ? body.comment : '',
    author_name: typeof body.author_name === 'string' ? body.author_name : '',
    author_email: typeof body.author_email === 'string' ? body.author_email : '',
    relationship: body.relationship as ReviewRelationship,
    consent: body.consent === true
  };
  const errors = validateReview(input);
  if (Object.keys(errors).length) return { ok: false, status: 422, message: 'Revisa los datos de la reseña.', errors: Object.values(errors) as string[] };

  // Una reseña por persona y programa (el email no se publica). También lo garantiza un índice único.
  const sql = getSql();
  const [dup] = await sql`select 1 from reviews where course_id = ${course.id} and lower(author_email) = ${input.author_email!.trim().toLowerCase()} limit 1`;
  const duplicate = { ok: false as const, status: 409, message: 'Ya enviaste una reseña para este programa. ¡Gracias!' };
  if (dup) return duplicate;

  const now = new Date().toISOString();
  const review: Review = {
    id: `rev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    course_id: course.id,
    course_name: course.name,
    institution_id: course.institution_id,
    institution_name: course.institution_name,
    rating: input.rating!,
    title: input.title!.trim(),
    comment: input.comment!.trim(),
    author_name: displayName(input.author_name!),
    author_email: input.author_email!.trim().toLowerCase(),
    relationship: input.relationship!,
    created_at: now,
    status: 'pendiente',
    rejection_reason: null,
    moderated_at: null,
    reply: null,
    page_url: typeof body.page_url === 'string' ? body.page_url.slice(0, 500) : ''
  };
  try {
    await upsertReview(sql, review);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return duplicate; // envío simultáneo duplicado
    throw err;
  }
  return { ok: true, review };
}

/* ------------------------------------------------------------ Lectura pública */

export async function publicReviews(courseId: string): Promise<PublicReview[]> {
  if (!safeId(courseId)) return [];
  const rows = await getSql()`select id, course_id, rating, title, comment, author_name, relationship, created_at, reply
    from reviews where course_id = ${courseId} and status = 'aprobada' order by created_at desc`;
  return rows.map((r) => ({
    id: r.id, course_id: r.course_id, rating: r.rating, title: r.title ?? '', comment: r.comment, author_name: r.author_name ?? '',
    relationship: r.relationship, created_at: new Date(r.created_at).toISOString(), reply: r.reply ?? null
  }));
}

export async function publicSummary(): Promise<ReviewsSummary> {
  const rows = await getSql()`select course_id, max(institution_id) as institution_id, rating, count(*)::int as n
    from reviews where status = 'aprobada' group by course_id, rating`;
  const byCourse = new Map<string, { institution_id: string; ratings: number[] }>();
  for (const r of rows) {
    const entry = byCourse.get(r.course_id) ?? { institution_id: r.institution_id ?? '', ratings: [] as number[] };
    for (let i = 0; i < r.n; i++) entry.ratings.push(Number(r.rating));
    byCourse.set(r.course_id, entry);
  }
  const courses: ReviewsSummary['courses'] = {};
  for (const [id, e] of byCourse) courses[id] = { ...summarize(e.ratings), institution_id: e.institution_id };
  return { courses, institutions: institutionSummaries(courses), updated_at: new Date().toISOString() };
}

/* ---------------------------------------------------------------- Moderación */

export async function listAllReviews(): Promise<StoredReview[]> {
  return (await getSql()`select raw from reviews order by created_at desc limit 3000`).map((r) => stored(r.raw as Review));
}

async function readReview(id: string): Promise<Review | null> {
  if (!REVIEW_ID.test(id)) return null;
  const [row] = await getSql()`select raw from reviews where id = ${id}`;
  return row ? (row.raw as Review) : null;
}

export async function moderateReview(id: string, patch: { status?: unknown; reply?: unknown; rejection_reason?: unknown }): Promise<StoredReview | null> {
  const current = await readReview(id);
  if (!current) return null;
  const next: Review = {
    ...current,
    status: REVIEW_STATUSES.includes(patch.status as ReviewStatus) ? (patch.status as ReviewStatus) : current.status,
    reply: typeof patch.reply === 'string' ? patch.reply.trim().slice(0, 800) || null : current.reply,
    rejection_reason: typeof patch.rejection_reason === 'string' ? patch.rejection_reason.trim().slice(0, 300) || null : current.rejection_reason,
    moderated_at: new Date().toISOString()
  };
  await upsertReview(getSql(), next);
  return stored(next);
}

export async function deleteReview(id: string): Promise<boolean> {
  if (!REVIEW_ID.test(id)) return false;
  return (await getSql()`delete from reviews where id = ${id}`).count > 0;
}
