/**
 * LeadService — abstracción del envío de leads.
 *
 * Los componentes llaman a `getLeadService().submit(...)`. Por defecto se usa `ApiLeadService`,
 * que guarda el lead en el servidor (/api/leads → Vercel Blob privado, visible en /admin → Leads).
 * Si el API no existe en el entorno (GitHub Pages, desarrollo local) se usa `LocalLeadService`.
 * `HttpLeadService` permite apuntar a otro backend con VITE_LEAD_API_URL, sin tocar la UI.
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
  /** Campo trampa anti-bots (debe llegar vacío). */
  honeypot?: string;
}

export class LeadSubmitError extends Error {}

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
    const lead = { ...buildLead(submission), status: 'nuevo' as const };
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
    return { ...lead, status: 'nuevo' };
  }
  async list(): Promise<Lead[]> {
    const res = await fetch(this.endpoint);
    return res.ok ? res.json() : [];
  }
}

/** Guarda el lead en el servidor de Groulevel. */
export class ApiLeadService implements LeadService {
  constructor(private endpoint: string, private fallback: LeadService) {}
  async submit(submission: LeadSubmission): Promise<Lead> {
    const local = buildLead(submission);
    const attribution = getAttribution();
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: submission.input,
          signals: submission.signals,
          course_id: submission.course.id,
          page_url: window.location.href,
          attribution,
          website: submission.honeypot ?? ''
        })
      });
    } catch {
      throw new LeadSubmitError('No pudimos conectarnos. Revisa tu conexión e inténtalo nuevamente.');
    }
    // Sin API en este entorno → registro local (mismo comportamiento que antes).
    if (res.status === 404 || !(res.headers.get('content-type') ?? '').includes('application/json')) return this.fallback.submit(submission);
    const body = (await res.json()) as Partial<Lead> & { message?: string; errors?: string[] };
    if (!res.ok) throw new LeadSubmitError(body.errors?.length ? `${body.message ?? 'Revisa los datos.'} ${body.errors.join(' ')}` : body.message ?? 'No pudimos enviar tu solicitud. Inténtalo nuevamente.');
    const lead: Lead = { ...local, ...body, status: 'nuevo' } as Lead;
    recordCplEvent(lead);
    return lead;
  }
  list(): Promise<Lead[]> {
    return this.fallback.list();
  }
}

let service: LeadService | null = null;

export function getLeadService(): LeadService {
  if (!service) {
    const endpoint = import.meta.env.VITE_LEAD_API_URL as string | undefined;
    service = endpoint ? new HttpLeadService(endpoint) : new ApiLeadService(`${import.meta.env.BASE_URL}api/leads`, new LocalLeadService());
  }
  return service;
}

export function setLeadService(s: LeadService) {
  service = s;
}
