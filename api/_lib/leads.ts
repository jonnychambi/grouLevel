/**
 * Almacenamiento de leads en Vercel Blob (privado).
 * Un archivo por lead: leads/<AAAA-MM>/<timestamp>_<id>.json → sin conflictos de escritura
 * y ordenable por fecha desde el nombre. El estado/notas se actualizan sobrescribiendo el archivo.
 */
import { del, get, list, put } from '@vercel/blob';
import { DEFAULT_SCORING_CONFIG, scoreLead } from '../../src/utils/leadScoring.js';
import type { Lead, LeadObjective, LeadSource, LeadStatus, StartTimeline } from '../../src/types/lead.js';

const PREFIX = 'leads/';
export const LEAD_STATUSES: LeadStatus[] = ['nuevo', 'contactado', 'enviado', 'matriculado', 'descartado'];
const TIMELINES = Object.keys(DEFAULT_SCORING_CONFIG.timeline) as StartTimeline[];
const OBJECTIVES = Object.keys(DEFAULT_SCORING_CONFIG.objective) as LeadObjective[];
const SOURCES: LeadSource[] = ['detalle', 'comparador', 'listado', 'institucion', 'favoritos', 'home', 'ruta'];

export interface StoredLead extends Lead { pathname: string }

type Body = Record<string, unknown>;
const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optional = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);

/** Valida el envío público y construye el lead con puntaje recalculado en el servidor. */
export function buildLeadFromRequest(body: Body, course: { id: string; name: string; institution_id: string; institution_name: string } | null): { ok: true; lead: Lead } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const input = (body.input ?? {}) as Body;
  const signals = (body.signals ?? {}) as Body;
  const first_name = s(input.first_name, 80);
  const last_name = s(input.last_name, 80);
  const email = s(input.email, 160).toLowerCase();
  const whatsapp = s(input.whatsapp, 30);
  const country = s(input.country, 60);
  const start_timeline = s(input.start_timeline, 20) as StartTimeline;
  const objective = s(input.objective, 40) as LeadObjective;
  if (!first_name) errors.push('Falta el nombre.');
  if (!last_name) errors.push('Falta el apellido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Email inválido.');
  const digits = whatsapp.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) errors.push('WhatsApp inválido.');
  if (!country) errors.push('Falta el país.');
  if (!TIMELINES.includes(start_timeline)) errors.push('Fecha de inicio deseada inválida.');
  if (!OBJECTIVES.includes(objective)) errors.push('Objetivo inválido.');
  if (input.consent !== true) errors.push('Falta la autorización de contacto.');
  if (!course) errors.push('El programa no existe.');
  if (errors.length || !course) return { ok: false, errors };

  const source = (SOURCES.includes(signals.source as LeadSource) ? signals.source : 'detalle') as LeadSource;
  const score = scoreLead(
    { start_timeline, objective, whatsapp, email },
    { compared_programs: int(signals.compared_programs, 3), viewed_programs: int(signals.viewed_programs, 50), source }
  );
  const attribution = (body.attribution ?? {}) as Body;
  const now = new Date().toISOString();
  return {
    ok: true,
    lead: {
      id: `lead_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      created_at: now,
      updated_at: now,
      first_name, last_name, email, whatsapp, country, start_timeline, objective, consent: true,
      course_id: course.id,
      course_name: course.name,
      institution_id: course.institution_id,
      institution_name: course.institution_name,
      page_url: s(body.page_url, 500),
      source,
      campaign: optional(attribution.utm_campaign),
      utm_source: optional(attribution.utm_source),
      utm_medium: optional(attribution.utm_medium),
      utm_campaign: optional(attribution.utm_campaign),
      utm_term: optional(attribution.utm_term),
      utm_content: optional(attribution.utm_content),
      referrer: optional(attribution.referrer, 500),
      lead_score: score.score,
      lead_tier: score.tier,
      lead_segment: score.segment,
      status: 'nuevo',
      notes: ''
    }
  };
}

export async function saveLead(lead: Lead): Promise<string> {
  const month = lead.created_at.slice(0, 7);
  const pathname = `${PREFIX}${month}/${lead.created_at.replace(/[:.]/g, '-')}_${lead.id}.json`;
  await put(pathname, JSON.stringify(lead), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
  return pathname;
}

async function readLead(pathname: string): Promise<StoredLead | null> {
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return { ...(JSON.parse(await new Response(res.stream).text()) as Lead), pathname };
}

/** Lista los leads más recientes (por defecto 500), leyendo en paralelo con concurrencia limitada. */
export async function listLeads(limit = 500): Promise<{ leads: StoredLead[]; total: number }> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    paths.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  paths.sort((a, b) => (a < b ? 1 : -1));
  const selected = paths.slice(0, limit);
  const out: StoredLead[] = [];
  for (let i = 0; i < selected.length; i += 20) {
    const batch = await Promise.all(selected.slice(i, i + 20).map(readLead));
    out.push(...batch.filter((l): l is StoredLead => !!l));
  }
  return { leads: out, total: paths.length };
}

export async function updateLead(pathname: string, patch: { status?: unknown; notes?: unknown }): Promise<StoredLead | null> {
  if (!pathname.startsWith(PREFIX) || pathname.includes('..')) return null;
  const current = await readLead(pathname);
  if (!current) return null;
  const { pathname: _p, ...lead } = current;
  void _p;
  const next: Lead = {
    ...lead,
    status: LEAD_STATUSES.includes(patch.status as LeadStatus) ? (patch.status as LeadStatus) : lead.status,
    notes: typeof patch.notes === 'string' ? patch.notes.slice(0, 2000) : lead.notes,
    updated_at: new Date().toISOString()
  };
  await put(pathname, JSON.stringify(next), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return { ...next, pathname };
}

export async function deleteLead(pathname: string): Promise<boolean> {
  if (!pathname.startsWith(PREFIX) || pathname.includes('..')) return false;
  await del(pathname);
  return true;
}
