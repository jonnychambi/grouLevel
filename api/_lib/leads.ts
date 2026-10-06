/**
 * Leads en la base (tabla `leads`). `raw` guarda el registro completo; las columnas permiten filtrar y reportar.
 * Para el administrador, `pathname` es el id del lead (se mantiene el nombre por compatibilidad con el cliente).
 */
import { getSql } from './db.js';
import { upsertLead } from './dbSync.js';
import { DEFAULT_SCORING_CONFIG, scoreLead } from '../../src/utils/leadScoring.js';
import type { Lead, LeadObjective, LeadSource, LeadStatus, StartTimeline } from '../../src/types/lead.js';

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
  await upsertLead(getSql(), lead);
  return lead.id;
}

const ID = /^lead_[a-z0-9]{4,40}$/;

async function readLead(id: string): Promise<Lead | null> {
  if (!ID.test(id)) return null;
  const [row] = await getSql()`select raw from leads where id = ${id}`;
  return row ? (row.raw as Lead) : null;
}

/** Leads más recientes primero (por defecto 500). */
export async function listLeads(limit = 500): Promise<{ leads: StoredLead[]; total: number }> {
  const sql = getSql();
  const [rows, [count]] = await Promise.all([
    sql`select raw from leads order by created_at desc limit ${limit}`,
    sql`select count(*)::int as n from leads`
  ]);
  return { leads: rows.map((r) => ({ ...(r.raw as Lead), pathname: (r.raw as Lead).id })), total: count.n };
}

export async function updateLead(id: string, patch: { status?: unknown; notes?: unknown }): Promise<StoredLead | null> {
  const lead = await readLead(id);
  if (!lead) return null;
  const next: Lead = {
    ...lead,
    status: LEAD_STATUSES.includes(patch.status as LeadStatus) ? (patch.status as LeadStatus) : lead.status,
    notes: typeof patch.notes === 'string' ? patch.notes.slice(0, 2000) : lead.notes,
    updated_at: new Date().toISOString()
  };
  await upsertLead(getSql(), next);
  return { ...next, pathname: next.id };
}

export async function deleteLead(id: string): Promise<boolean> {
  if (!ID.test(id)) return false;
  const res = await getSql()`delete from leads where id = ${id}`;
  return res.count > 0;
}
