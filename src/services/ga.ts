/**
 * Google Analytics 4 con Consent Mode v2.
 *
 * - Se activa solo si existe VITE_GA_MEASUREMENT_ID (G-XXXXXXX) en el build.
 * - Por defecto las cookies analíticas están DENEGADAS: GA solo recibe señales sin cookies
 *   hasta que la persona acepta en el aviso (ConsentBanner). La elección se recuerda.
 * - No se mide el panel /admin. No se envían datos personales (nombre, email, teléfono).
 * - Los eventos de producto se traducen a eventos recomendados de GA4 (generate_lead, search, view_item…).
 */
import type { AnalyticsEvent } from '../types';
import { createPersistentStore } from '../hooks/usePersistentStore';
import { sessionStore } from './storage';

export const GA_ID = ((import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ?? '').trim();
export const gaEnabled = /^G-[A-Z0-9]{4,}$/.test(GA_ID);

export type ConsentChoice = 'granted' | 'denied' | null;
export const consentStore = createPersistentStore<ConsentChoice>('analytics-consent', null);

const isAdmin = () => window.location.pathname.replace(import.meta.env.BASE_URL, '/').startsWith('/admin');
let started = false;

/**
 * Modo depuración: abrir el sitio con ?ga_debug=1 envía los eventos con debug_mode,
 * de modo que aparecen al instante en GA4 → Administrar → DebugView (dura toda la sesión;
 * ?ga_debug=0 lo apaga). También los muestra en la consola del navegador.
 */
function debugEnabled(): boolean {
  const flag = new URLSearchParams(window.location.search).get('ga_debug');
  if (flag === '1') sessionStore.set('ga-debug', true);
  if (flag === '0') sessionStore.set('ga-debug', false);
  return sessionStore.get<boolean>('ga-debug', false);
}
let debug = false;

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  // gtag necesita el objeto `arguments`, no un array.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments as unknown as Record<string, unknown>);
  void args;
}

export function initGA(): void {
  if (!gaEnabled || started || isAdmin()) return;
  started = true;
  window.gtag = gtag;
  const granted = consentStore.get() === 'granted';
  gtag('consent', 'default', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  gtag('js', new Date());
  debug = debugEnabled();
  gtag('config', GA_ID, { send_page_view: false, ...(debug ? { debug_mode: true } : {}) });
  if (debug) console.info(`[GA4] Modo depuración activo (${GA_ID}). Consentimiento: ${granted ? 'aceptado' : 'pendiente/rechazado'}.`);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
}

export function setConsent(choice: 'granted' | 'denied'): void {
  consentStore.set(choice);
  if (started) gtag('consent', 'update', { analytics_storage: choice });
}

/** Page view de SPA: se envía una vez por URL, cuando el título ya es el definitivo. */
let lastPage = '';
let pageTimer: ReturnType<typeof setTimeout> | undefined;
export function trackPageView(): void {
  if (!started || isAdmin()) return;
  clearTimeout(pageTimer);
  pageTimer = setTimeout(() => {
    const page = window.location.pathname + window.location.search;
    if (page === lastPage) return;
    lastPage = page;
    const params = { page_location: window.location.href, page_path: page, page_title: document.title };
    gtag('event', 'page_view', debug ? { ...params, debug_mode: true } : params);
    if (debug) console.info('[GA4] page_view', params);
  }, 400);
}

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));

/** Traduce un evento interno a GA4 (eventos recomendados cuando existen). */
export function toGA(e: AnalyticsEvent): [string, Record<string, unknown>] {
  const p = e.props as Record<string, unknown>;
  const item = p.course_id ? [clean({ item_id: p.course_id, item_brand: p.institution_id, item_category: p.category, item_variant: p.program_type, price: p.price })] : undefined;
  const money = clean({ currency: p.currency, value: p.price ?? undefined });
  switch (e.name) {
    case 'search_performed': return ['search', clean({ search_term: p.query, results_count: p.results_count, search_source: p.source })];
    case 'course_viewed': return ['view_item', clean({ ...money, items: item })];
    case 'lead_form_opened': return ['begin_lead_form', clean({ ...money, items: item, lead_source: p.source })];
    case 'lead_submitted': return ['generate_lead', clean({ ...money, items: item, lead_source: p.source, lead_tier: p.lead_tier, lead_score: p.lead_score, lead_segment: p.lead_segment })];
    case 'favorite_added': return ['add_to_wishlist', clean({ ...money, items: item })];
    case 'share_clicked': return ['share', clean({ method: p.method, content_type: 'programa', item_id: p.course_id })];
    case 'compare_added': return ['add_to_compare', clean({ ...money, items: item, compare_count: p.compare_count })];
    case 'comparison_viewed': return ['view_comparison', clean({ compare_count: p.count })];
    case 'profile_submitted': return ['generate_route', clean({ route_source: p.source, route_engine: p.engine, route_stages: p.stages, target_areas: (p.target_areas as string[]).join(', ') })];
    case 'outbound_click': return ['click_institution_site', clean({ link_url: p.url, items: item })];
    default: return [e.name, clean(p)];
  }
}

/** Sink para services/analytics.ts. */
export function gaSink(e: AnalyticsEvent): void {
  if (!started || isAdmin()) return;
  const [name, params] = toGA(e);
  gtag('event', name, { ...params, session_id_internal: e.session_id, ...(debug ? { debug_mode: true } : {}) });
  if (debug) console.info(`[GA4] ${name}`, params, consentStore.get() === 'granted' ? '' : '(sin consentimiento: GA4 no lo mostrará en informes)');
}
