/**
 * Capa de analítica agnóstica del proveedor.
 *
 * `track()` es la única API que usan los componentes. Cada evento se:
 *  1. enriquece con sesión, página y UTMs;
 *  2. envía a todos los "sinks" registrados (dataLayer/GTM, GA4 gtag, log local);
 *  3. guarda en un buffer local (últimos 1.000) para calcular métricas del funnel
 *     en /interno/metricas mientras no exista un backend de eventos.
 *
 * Para conectar Segment, Mixpanel, PostHog o un endpoint propio: `registerSink(fn)`.
 */
import type { AnalyticsEvent, AnalyticsEventMap, AnalyticsEventName, CourseContext, CourseWithInstitution } from '../types';
import { getAttribution, getSessionId } from './attribution';
import { STORAGE_KEYS, storage } from './storage';
import { effectivePrice, uid } from '../utils/format';
import { gaSink } from './ga';

type Sink = (event: AnalyticsEvent) => void;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MAX_EVENTS = 1000;

const sinks: Sink[] = [
  // Google Tag Manager / dataLayer (formato GTM; GA4 usa su propio sink)
  (e) => {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event: `gl_${e.name}`, ...e.props, session_id: e.session_id, page: e.page });
  },
  // Google Analytics 4 (si hay ID configurado y la página no es /admin)
  gaSink,
  // Panel de Demanda (contadores anónimos propios en /api/track)
  demandSink,
  // Buffer local
  (e) => {
    const events = storage.get<AnalyticsEvent[]>(STORAGE_KEYS.events, []);
    events.push(e);
    storage.set(STORAGE_KEYS.events, events.slice(-MAX_EVENTS));
  }
];

/** Eventos que alimentan el panel de Demanda del administrador (los leads se cuentan en el servidor). */
const DEMAND: Partial<Record<AnalyticsEventName, string>> = {
  course_viewed: 'view', compare_added: 'compare', favorite_added: 'favorite', outbound_click: 'outbound',
  lead_form_opened: 'lead_open', share_clicked: 'share', institution_viewed: 'institution_view'
};

function demandSink(e: AnalyticsEvent): void {
  const event = DEMAND[e.name];
  if (!event || import.meta.env.DEV || window.location.pathname.replace(import.meta.env.BASE_URL, '/').startsWith('/admin')) return;
  const p = e.props as unknown as Record<string, unknown>;
  const a = getAttribution();
  const body = JSON.stringify({ event, course_id: p.course_id, institution_id: p.institution_id, utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign, referrer: a.referrer });
  const url = `${import.meta.env.BASE_URL}api/track`;
  // sendBeacon no se pierde si la persona sale de la página (p. ej. clic al sitio de la institución).
  if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) {
    void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

if (import.meta.env.DEV) sinks.push((e) => console.debug('[analytics]', e.name, e.props));

export function registerSink(sink: Sink) {
  sinks.push(sink);
}

export function track<N extends AnalyticsEventName>(name: N, props: AnalyticsEventMap[N]): void {
  const attribution = getAttribution();
  const event: AnalyticsEvent<N> = {
    id: uid('evt'),
    name,
    props,
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
    page: window.location.pathname,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign
  };
  for (const sink of sinks) {
    try {
      sink(event as AnalyticsEvent);
    } catch {
      /* un sink caído no debe romper la UX */
    }
  }
}

export function getStoredEvents(): AnalyticsEvent[] {
  return storage.get<AnalyticsEvent[]>(STORAGE_KEYS.events, []);
}

/** Contexto estándar de un curso para cualquier evento. */
export function courseContext(c: CourseWithInstitution): CourseContext {
  return {
    course_id: c.id,
    course_name: c.name,
    institution_id: c.institution_id,
    institution_name: c.institution.name,
    category: c.category,
    program_type: c.program_type,
    price: effectivePrice(c),
    currency: c.currency,
    featured: c.featured
  };
}
