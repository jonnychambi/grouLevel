/**
 * Monetización: CPL, Featured Listings y comisión por venta.
 * En el MVP se registra un CplEvent por cada lead (facturable a la institución).
 */
import type { CplEvent, Lead, Order } from '../types';
import { STORAGE_KEYS, storage } from './storage';
import { uid } from '../utils/format';

/** Tarifa CPL por institución (en un backend vendría del contrato). */
const CPL_RATES: Record<string, { amount: number; currency: 'PEN' | 'USD' }> = {
  default: { amount: 35, currency: 'PEN' },
  'inst-nova': { amount: 90, currency: 'PEN' },
  'inst-coderumbo': { amount: 25, currency: 'USD' }
};

/** Multiplicador por calidad de lead (opcional según contrato). */
export function cplMultiplier(score: number): number {
  if (score >= 80) return 1.5;
  if (score >= 60) return 1.2;
  if (score >= 40) return 1;
  return 0.5;
}

export function recordCplEvent(lead: Lead): CplEvent {
  const rate = CPL_RATES[lead.institution_id] ?? CPL_RATES.default;
  const event: CplEvent = {
    id: uid('cpl'),
    institution_id: lead.institution_id,
    course_id: lead.course_id,
    lead_id: lead.id,
    lead_score: lead.lead_score,
    timestamp: lead.created_at,
    source: lead.utm_source ?? lead.source,
    cpl_amount: Math.round(rate.amount * cplMultiplier(lead.lead_score) * 100) / 100,
    currency: rate.currency
  };
  const all = storage.get<CplEvent[]>(STORAGE_KEYS.cplEvents, []);
  storage.set(STORAGE_KEYS.cplEvents, [...all, event]);
  return event;
}

export function getCplEvents(): CplEvent[] {
  return storage.get<CplEvent[]>(STORAGE_KEYS.cplEvents, []);
}

/** Comisión por venta — preparado para el checkout futuro. */
export function buildOrder(input: Omit<Order, 'order_id' | 'commission_amount' | 'created_at'>): Order {
  return {
    ...input,
    order_id: uid('ord'),
    commission_amount: Math.round(input.sale_amount * input.commission_percentage) / 100,
    created_at: new Date().toISOString()
  };
}
