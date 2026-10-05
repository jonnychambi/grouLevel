/**
 * Métricas de negocio calculadas a partir de eventos + leads + eventos CPL.
 * Las mismas fórmulas aplican cuando los datos provengan de un warehouse (BigQuery, etc.).
 */
import type { AnalyticsEvent, CplEvent, Lead } from '../types';
import { convert } from './format';

const rate = (num: number, den: number) => (den === 0 ? 0 : num / den);
const countBy = <T,>(items: T[], key: (t: T) => string | null | undefined) =>
  items.reduce<Record<string, number>>((acc, it) => {
    const k = key(it) ?? '(directo)';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

export interface BusinessMetrics {
  searchToViewRate: number;
  viewToLeadRate: number;
  comparisonToLeadRate: number;
  leadsByInstitution: Record<string, number>;
  leadsByCourse: Record<string, number>;
  leadsByCategory: Record<string, number>;
  leadsBySource: Record<string, number>;
  leadsByCampaign: Record<string, number>;
  avgLeadScore: number;
  revenueByInstitutionPEN: Record<string, number>;
  revenueByCoursePEN: Record<string, number>;
  avgCplPEN: number;
  totals: { searches: number; views: number; comparisons: number; leads: number; revenuePEN: number };
}

export function computeMetrics(events: AnalyticsEvent[], leads: Lead[], cpl: CplEvent[], courseCategory: (courseId: string) => string | undefined): BusinessMetrics {
  const sessionsWith = (name: AnalyticsEvent['name']) => new Set(events.filter((e) => e.name === name).map((e) => e.session_id));
  const searchSessions = sessionsWith('search_performed');
  const viewSessions = sessionsWith('course_viewed');
  const comparisonSessions = sessionsWith('comparison_viewed');
  const leadSessions = sessionsWith('lead_submitted');
  const intersect = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length;

  const leadEvents = events.filter((e) => e.name === 'lead_submitted');
  const revenueByInstitutionPEN: Record<string, number> = {};
  const revenueByCoursePEN: Record<string, number> = {};
  let revenuePEN = 0;
  for (const e of cpl) {
    const pen = convert(e.cpl_amount, e.currency, 'PEN');
    revenuePEN += pen;
    revenueByInstitutionPEN[e.institution_id] = (revenueByInstitutionPEN[e.institution_id] ?? 0) + pen;
    revenueByCoursePEN[e.course_id] = (revenueByCoursePEN[e.course_id] ?? 0) + pen;
  }

  return {
    searchToViewRate: rate(intersect(searchSessions, viewSessions), searchSessions.size),
    viewToLeadRate: rate(intersect(viewSessions, leadSessions), viewSessions.size),
    comparisonToLeadRate: rate(intersect(comparisonSessions, leadSessions), comparisonSessions.size),
    leadsByInstitution: countBy(leads, (l) => l.institution_name),
    leadsByCourse: countBy(leads, (l) => l.course_name),
    leadsByCategory: countBy(leads, (l) => courseCategory(l.course_id)),
    leadsBySource: countBy(leads, (l) => l.utm_source),
    leadsByCampaign: countBy(leads, (l) => l.utm_campaign),
    avgLeadScore: leads.length ? leads.reduce((s, l) => s + l.lead_score, 0) / leads.length : 0,
    revenueByInstitutionPEN,
    revenueByCoursePEN,
    avgCplPEN: cpl.length ? revenuePEN / cpl.length : 0,
    totals: {
      searches: events.filter((e) => e.name === 'search_performed').length,
      views: events.filter((e) => e.name === 'course_viewed').length,
      comparisons: events.filter((e) => e.name === 'comparison_viewed').length,
      leads: Math.max(leads.length, leadEvents.length),
      revenuePEN
    }
  };
}
