/** Catálogo tipado de eventos de producto. */
export interface AnalyticsEventMap {
  search_performed: { query: string; results_count: number; source: 'home' | 'header' | 'listado'; intent?: string[] };
  filter_applied: { filter: string; value: string; active_filters: number; results_count: number };
  course_viewed: CourseContext & { source?: string };
  compare_added: CourseContext & { compare_count: number; source: string };
  compare_removed: { course_id: string; compare_count: number };
  comparison_viewed: { course_ids: string[]; institution_ids: string[]; count: number };
  lead_form_opened: CourseContext & { source: string };
  lead_submitted: CourseContext & { source: string; lead_id: string; lead_score: number; lead_tier: string; lead_segment: string };
  institution_viewed: { institution_id: string; programs_count: number };
  outbound_click: CourseContext & { url: string };
  favorite_added: CourseContext;
  favorite_removed: { course_id: string };
  share_clicked: CourseContext & { method: 'native' | 'clipboard' };
}

export interface CourseContext {
  course_id: string;
  institution_id: string;
  category: string;
  program_type: string;
  price: number | null;
  currency: string;
  featured: boolean;
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface AnalyticsEvent<N extends AnalyticsEventName = AnalyticsEventName> {
  id: string;
  name: N;
  props: AnalyticsEventMap[N];
  timestamp: string;
  session_id: string;
  page: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}
