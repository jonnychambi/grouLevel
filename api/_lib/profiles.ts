/**
 * Diagnósticos de perfil ("Mi ruta"): validación del envío, análisis (IA o reglas) y almacenamiento.
 *
 *   Base de datos: tabla `profiles` (+ estudios, experiencia, puntajes y ruta en tablas hijas).
 *   Vercel Blob:   profiles-files/<id>.<ext> → CV original (privado, solo se descarga desde /admin).
 * El id es aleatorio y no adivinable: funciona como enlace privado para volver a ver la ruta.
 */
import { randomBytes } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import type { ProfileAnalysis, ProfilePreferences, ProfileStatus, PublicProfileAnalysis } from '../../src/types/profile.js';
import { analyzeWithRules, PROFILE_LIMITS, sanitizeAnalysis, type RouteCategory, type RouteCourse } from '../../src/utils/profileAnalysis.js';
import { analyzeWithAI, isAiConfigured } from './profileAI.js';
import { getSql } from './db.js';
import { upsertProfile } from './dbSync.js';

const FILES = 'profiles-files/';
const RATES: Record<string, number> = { PEN: 1, USD: 3.75 };
export const PROFILE_STATUSES: ProfileStatus[] = ['nuevo', 'contactado', 'descartado'];
const ID_RE = /^prf_[a-f0-9]{24}$/;

let cache: { at: number; courses: RouteCourse[]; categories: RouteCategory[] } | null = null;

/** Programas publicados y materias del catálogo vigente (caché de 60 s). */
export async function loadRouteCatalog(): Promise<{ courses: RouteCourse[]; categories: RouteCategory[] }> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const sql = getSql();
  const [rows, cats] = await Promise.all([
    sql`select c.id, c.name, c.category_id, c.level, c.program_type, c.modality, c.price, c.discount_price, c.currency, c.duration_hours,
               c.tools, c.keywords, c.featured, i.name as institution_name
        from courses c join institutions i on i.id = c.institution_id where c.status = 'publicado' order by c.position, c.id`,
    sql`select id, name, keywords from categories order by position, id`
  ]);
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const courses: RouteCourse[] = rows.map((c) => {
    const price = n(c.discount_price) ?? n(c.price);
    return {
      id: c.id, name: c.name, category: c.category_id ?? '', level: c.level ?? null, program_type: c.program_type, modality: c.modality ?? null,
      price_pen: price === null ? null : Math.round(price * (RATES[c.currency] ?? 1)), duration_hours: n(c.duration_hours),
      tools: c.tools ?? [], keywords: c.keywords ?? [], institution_name: c.institution_name, featured: c.featured === true
    };
  });
  const categories: RouteCategory[] = cats.map((c) => ({ id: c.id, name: c.name, keywords: c.keywords ?? [] }));
  cache = { at: Date.now(), courses, categories };
  return cache;
}

export interface ProfileSubmission {
  source: 'cv' | 'texto';
  text: string;
  description: string | null;
  objective: string;
  preferences: ProfilePreferences;
  contact_ok: boolean;
  file: { bytes: Uint8Array; name: string; type: 'pdf' | 'docx' | 'txt' } | null;
}

const MODALITIES: ProfilePreferences['modality'][] = ['cualquiera', 'en-vivo', 'grabado', 'hibrido', 'presencial'];

/** Valida los campos del formulario (el archivo se valida aparte). */
export function validateSubmission(fields: Record<string, string>): { ok: true; value: Omit<ProfileSubmission, 'text' | 'file' | 'source'> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const objective = (fields.objective ?? '').trim();
  const description = (fields.description ?? '').trim();
  if (objective.length < PROFILE_LIMITS.objectiveMin) errors.push(`Describe tu objetivo con al menos ${PROFILE_LIMITS.objectiveMin} caracteres.`);
  if (objective.length > PROFILE_LIMITS.objectiveMax) errors.push('El objetivo es demasiado largo.');
  if (description.length > PROFILE_LIMITS.textMax) errors.push('La descripción es demasiado larga.');
  if (fields.consent !== 'true') errors.push('Falta la autorización para tratar tus datos.');
  const modality = (MODALITIES.includes(fields.modality as ProfilePreferences['modality']) ? fields.modality : 'cualquiera') as ProfilePreferences['modality'];
  const budget = Number(fields.budget_pen);
  const hours = Number(fields.hours_per_week);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      description: description || null,
      objective,
      contact_ok: fields.contact_ok === 'true',
      preferences: {
        modality,
        budget_pen: Number.isFinite(budget) && budget > 0 ? Math.min(Math.round(budget), 1_000_000) : null,
        hours_per_week: Number.isFinite(hours) && hours > 0 ? Math.min(Math.round(hours), 80) : null
      }
    }
  };
}

/** Ejecuta el análisis: IA si está configurada (con respaldo por reglas), si no, reglas. */
export async function runAnalysis(sub: ProfileSubmission): Promise<Omit<ProfileAnalysis, 'id' | 'created_at' | 'updated_at' | 'file' | 'status' | 'notes'>> {
  const { courses, categories } = await loadRouteCatalog();
  const input = { text: sub.text, objective: sub.objective, preferences: sub.preferences, source: sub.source };
  const rules = analyzeWithRules(input, categories, courses);
  let engine: ProfileAnalysis['engine'] = 'reglas';
  let result = rules;
  if (isAiConfigured()) {
    try {
      const ai = await analyzeWithAI({ ...input, pdf: sub.file?.type === 'pdf' ? sub.file.bytes : null }, categories, courses);
      result = sanitizeAnalysis(ai, categories, courses, rules.route);
      // Datos de contacto: si la IA no los encontró pero las reglas sí, se completan.
      for (const [k, v] of Object.entries(rules.extract.personal) as [keyof typeof rules.extract.personal, string | null][]) {
        if (!result.extract.personal[k] && v) result.extract.personal[k] = v;
      }
      engine = 'ia';
    } catch (err) {
      console.error('profile_ai_failed', err instanceof Error ? err.message : err);
    }
  }
  return { source: sub.source, engine, objective: sub.objective, description: sub.description, preferences: sub.preferences, contact_ok: sub.contact_ok, ...result };
}

export function newProfileId(): string {
  return `prf_${randomBytes(12).toString('hex')}`;
}

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' } as const;

export async function saveProfile(id: string, analysis: Omit<ProfileAnalysis, 'id' | 'created_at' | 'updated_at' | 'file' | 'status' | 'notes'>, file: ProfileSubmission['file']): Promise<ProfileAnalysis> {
  const now = new Date().toISOString();
  let stored: ProfileAnalysis['file'] = null;
  if (file) {
    const pathname = `${FILES}${id}.${file.type}`;
    await put(pathname, Buffer.from(file.bytes), { access: 'private', contentType: MIME[file.type], addRandomSuffix: false });
    stored = { pathname, name: file.name.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 120), type: MIME[file.type], size: file.bytes.byteLength };
  }
  const record: ProfileAnalysis = { id, created_at: now, updated_at: now, ...analysis, file: stored, status: 'nuevo', notes: '' };
  await upsertProfile(getSql(), record);
  return record;
}

export function toPublic(p: ProfileAnalysis): PublicProfileAnalysis {
  const { file, status: _s, notes: _n, ...rest } = p;
  void _s; void _n;
  return { ...rest, has_file: !!file };
}

export async function readProfile(id: string): Promise<ProfileAnalysis | null> {
  if (!ID_RE.test(id)) return null;
  const [row] = await getSql()`select raw from profiles where id = ${id}`;
  return row ? (row.raw as ProfileAnalysis) : null;
}

/** Resumen para el listado del administrador (sin la evaluación completa). */
export type ProfileListItem = Pick<ProfileAnalysis, 'id' | 'created_at' | 'updated_at' | 'source' | 'engine' | 'objective' | 'status' | 'notes' | 'contact_ok' | 'file'> & {
  name: string; email: string | null; phone: string | null; country: string | null; current_role: string | null; seniority: string; years_experience: number | null; highest_degree: string | null; target_areas: string[];
};

export async function listProfiles(limit = 300): Promise<{ profiles: ProfileListItem[]; total: number }> {
  const sql = getSql();
  const [rows, [count]] = await Promise.all([
    sql`select id, created_at, updated_at, source, engine, objective, status, notes, contact_ok, first_name, last_name, email, phone, country,
               current_position, seniority, years_experience, highest_degree, target_areas, cv_blob_path, cv_file_name, cv_file_type, cv_file_size
        from profiles order by created_at desc limit ${limit}`,
    sql`select count(*)::int as n from profiles`
  ]);
  const iso = (v: unknown) => new Date(v as string).toISOString();
  return {
    total: count.n,
    profiles: rows.map((p) => ({
      id: p.id, created_at: iso(p.created_at), updated_at: iso(p.updated_at), source: p.source, engine: p.engine, objective: p.objective, status: p.status,
      notes: p.notes, contact_ok: p.contact_ok,
      file: p.cv_blob_path ? { pathname: p.cv_blob_path, name: p.cv_file_name, type: p.cv_file_type, size: p.cv_file_size } : null,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sin nombre', email: p.email, phone: p.phone, country: p.country,
      current_role: p.current_position, seniority: p.seniority, years_experience: p.years_experience, highest_degree: p.highest_degree, target_areas: p.target_areas ?? []
    }))
  };
}

export async function updateProfile(id: string, patch: { status?: unknown; notes?: unknown }): Promise<ProfileAnalysis | null> {
  const current = await readProfile(id);
  if (!current) return null;
  const next: ProfileAnalysis = {
    ...current,
    status: PROFILE_STATUSES.includes(patch.status as ProfileStatus) ? (patch.status as ProfileStatus) : current.status,
    notes: typeof patch.notes === 'string' ? patch.notes.slice(0, 2000) : current.notes,
    updated_at: new Date().toISOString()
  };
  await upsertProfile(getSql(), next);
  return next;
}

/** Elimina el diagnóstico (y en cascada sus tablas hijas) y el CV guardado en Blob. */
export async function deleteProfile(id: string): Promise<boolean> {
  const current = await readProfile(id);
  if (!current) return false;
  if (current.file) await del(current.file.pathname).catch((err) => console.error('cv_delete_failed', err instanceof Error ? err.message : err));
  await getSql()`delete from profiles where id = ${id}`;
  return true;
}

/** Devuelve el CV original como descarga (solo para el administrador). */
export async function profileFile(id: string): Promise<Response | null> {
  const p = await readProfile(id);
  if (!p?.file || !p.file.pathname.startsWith(FILES)) return null;
  const res = await get(p.file.pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return new Response(res.stream, {
    headers: {
      'Content-Type': p.file.type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(p.file.name)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
