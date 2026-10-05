/**
 * LeadService — abstracción del envío de leads.
 *
 * Los componentes llaman a `getLeadService().submit(...)`. Hoy la implementación es
 * `LocalLeadService` (guarda en localStorage y simula latencia). Para producción:
 *  - `HttpLeadService` (API REST propia, Supabase Edge Function, Make/Zapier webhook…)
 *    se activa definiendo VITE_LEAD_API_URL, sin tocar la UI.
 */
import type { CourseWithInstitution, Lead, LeadFormInput, LeadSignals } from '../types';
import { scoreLead } from '../utils/leadScoring';
import { uid } from '../utils/format';
import { getAttribution } from './attribution';
import { recordCplEvent } from './monetization';
import { STORAGE_KEYS, storage } from './storage';

export interface LeadSubmission {
  input: LeadFormInput;
  course: CourseWithInstitution;
  signals: LeadSignals;
}

export interface LeadService {
  submit(submission: LeadSubmission): Promise<Lead>;
  list(): Promise<Lead[]>;
}

/** Construye el registro completo del lead (scoring + atribución + contexto). */
export function buildLead({ input, course, signals }: LeadSubmission): Lead {
  const attribution = getAttribution();
  const score = scoreLead(input, signals);
  return {
    ...input,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    whatsapp: input.whatsapp.trim(),
    id: uid('lead'),
    created_at: new Date().toISOString(),
    course_id: course.id,
    course_name: course.name,
    institution_id: course.institution_id,
    institution_name: course.institution.name,
    page_url: window.location.href,
    source: signals.source,
    campaign: attribution.utm_campaign,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    referrer: attribution.referrer,
    lead_score: score.score,
    lead_tier: score.tier,
    lead_segment: score.segment,
    status: 'nuevo'
  };
}

export class LocalLeadService implements LeadService {
  async submit(submission: LeadSubmission): Promise<Lead> {
    await new Promise((r) => setTimeout(r, 650)); // simula red
    const lead = { ...buildLead(submission), status: 'enviado' as const };
    const leads = storage.get<Lead[]>(STORAGE_KEYS.leads, []);
    storage.set(STORAGE_KEYS.leads, [...leads, lead]);
    recordCplEvent(lead);
    return lead;
  }
  async list(): Promise<Lead[]> {
    return storage.get<Lead[]>(STORAGE_KEYS.leads, []);
  }
}

export class HttpLeadService implements LeadService {
  constructor(private endpoint: string) {}
  async submit(submission: LeadSubmission): Promise<Lead> {
    const lead = buildLead(submission);
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    if (!res.ok) throw new Error('No pudimos enviar tu solicitud. Inténtalo nuevamente.');
    recordCplEvent(lead);
    return { ...lead, status: 'enviado' };
  }
  async list(): Promise<Lead[]> {
    const res = await fetch(this.endpoint);
    return res.ok ? res.json() : [];
  }
}

let service: LeadService | null = null;

export function getLeadService(): LeadService {
  if (!service) {
    const endpoint = import.meta.env.VITE_LEAD_API_URL as string | undefined;
    service = endpoint ? new HttpLeadService(endpoint) : new LocalLeadService();
  }
  return service;
}

export function setLeadService(s: LeadService) {
  service = s;
}
