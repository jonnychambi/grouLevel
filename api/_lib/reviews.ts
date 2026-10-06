/**
 * Reseñas en Vercel Blob (privado), con moderación.
 *
 *   reviews/<courseId>/<timestamp>_<emailHash>_<id>.json   → registro completo (incluye email, estado)
 *   reviews-public/<courseId>.json                          → reseñas APROBADAS del programa (sin datos privados)
 *   reviews-public/summary.json                             → promedios por programa e institución
 *
 * Los archivos públicos se regeneran solo al moderar, así las lecturas del sitio son 1 archivo.
 */
import { createHash } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import { displayName, institutionSummaries, summarize, validateReview, type ReviewInput } from '../../src/utils/reviews.js';
import type { PublicReview, Review, ReviewRelationship, ReviewsSummary, ReviewStatus } from '../../src/types/review.js';
import type { CourseRef } from './guard.js';

const RAW = 'reviews/';
const PUB = 'reviews-public/';
const SUMMARY = `${PUB}summary.json`;
export const REVIEW_STATUSES: ReviewStatus[] = ['pendiente', 'aprobada', 'rechazada'];

export type StoredReview = Review & { pathname: string };
const safeId = (id: string) => /^[a-z0-9-]{1,40}$/i.test(id);
const emailHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);

async function readJson<T>(pathname: string): Promise<T | null> {
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return JSON.parse(await new Response(res.stream).text()) as T;
}
const writeJson = (pathname: string, data: unknown) =>
  put(pathname, JSON.stringify(data), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

async function listPaths(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    paths.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

async function readMany(paths: string[]): Promise<StoredReview[]> {
  const out: StoredReview[] = [];
  for (let i = 0; i < paths.length; i += 20) {
    const batch = await Promise.all(paths.slice(i, i + 20).map(async (p) => {
      const r = await readJson<Review>(p);
      return r ? { ...r, pathname: p } : null;
    }));
    out.push(...batch.filter((r): r is StoredReview => !!r));
  }
  return out;
}

/* ------------------------------------------------------------- Envío público */

export async function submitReview(body: Record<string, unknown>, course: CourseRef | null): Promise<{ ok: true; review: Review; pathname: string } | { ok: false; status: number; message: string; errors?: string[] }> {
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

  // Una reseña por persona y programa (el email solo se usa como huella, no se publica).
  const hash = emailHash(input.author_email!);
  const existing = await listPaths(`${RAW}${course.id}/`);
  if (existing.some((p) => p.includes(`_${hash}_`))) return { ok: false, status: 409, message: 'Ya enviaste una reseña para este programa. ¡Gracias!' };

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
  const pathname = `${RAW}${course.id}/${now.replace(/[:.]/g, '-')}_${hash}_${review.id}.json`;
  await writeJson(pathname, review);
  return { ok: true, review, pathname };
}

/* ------------------------------------------------------------ Lectura pública */

export async function publicReviews(courseId: string): Promise<PublicReview[]> {
  if (!safeId(courseId)) return [];
  return (await readJson<PublicReview[]>(`${PUB}${courseId}.json`)) ?? [];
}

export async function publicSummary(): Promise<ReviewsSummary> {
  return (await readJson<ReviewsSummary>(SUMMARY)) ?? { courses: {}, institutions: {}, updated_at: new Date(0).toISOString() };
}

/* ---------------------------------------------------------------- Moderación */

export async function listAllReviews(): Promise<StoredReview[]> {
  const paths = (await listPaths(RAW)).sort((a, b) => (a.split('/')[2] < b.split('/')[2] ? 1 : -1));
  return readMany(paths.slice(0, 3000));
}

/** Regenera las reseñas públicas de un programa y el resumen general. */
async function rebuildCourse(courseId: string, institutionId: string): Promise<void> {
  const all = await readMany(await listPaths(`${RAW}${courseId}/`));
  const approved = all.filter((r) => r.status === 'aprobada').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pub: PublicReview[] = approved.map(({ id, course_id, rating, title, comment, author_name, relationship, created_at, reply }) => ({ id, course_id, rating, title, comment, author_name, relationship, created_at, reply }));
  if (pub.length) await writeJson(`${PUB}${courseId}.json`, pub);
  else await del(`${PUB}${courseId}.json`).catch(() => undefined);

  const summary = await publicSummary();
  if (pub.length) summary.courses[courseId] = { ...summarize(pub.map((r) => r.rating)), institution_id: approved[0]?.institution_id ?? institutionId };
  else delete summary.courses[courseId];
  summary.institutions = institutionSummaries(summary.courses);
  summary.updated_at = new Date().toISOString();
  await writeJson(SUMMARY, summary);
}

export async function moderateReview(pathname: string, patch: { status?: unknown; reply?: unknown; rejection_reason?: unknown }): Promise<StoredReview | null> {
  if (!pathname.startsWith(RAW) || pathname.includes('..')) return null;
  const current = await readJson<Review>(pathname);
  if (!current) return null;
  const next: Review = {
    ...current,
    status: REVIEW_STATUSES.includes(patch.status as ReviewStatus) ? (patch.status as ReviewStatus) : current.status,
    reply: typeof patch.reply === 'string' ? patch.reply.trim().slice(0, 800) || null : current.reply,
    rejection_reason: typeof patch.rejection_reason === 'string' ? patch.rejection_reason.trim().slice(0, 300) || null : current.rejection_reason,
    moderated_at: new Date().toISOString()
  };
  await writeJson(pathname, next);
  await rebuildCourse(next.course_id, next.institution_id);
  return { ...next, pathname };
}

export async function deleteReview(pathname: string): Promise<boolean> {
  if (!pathname.startsWith(RAW) || pathname.includes('..')) return false;
  const current = await readJson<Review>(pathname);
  await del(pathname);
  if (current) await rebuildCourse(current.course_id, current.institution_id);
  return true;
}
