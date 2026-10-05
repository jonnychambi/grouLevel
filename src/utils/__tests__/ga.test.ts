import { describe, expect, it } from 'vitest';
import { toGA } from '../../services/ga';
import type { AnalyticsEvent } from '../../types';

const ev = (name: AnalyticsEvent['name'], props: Record<string, unknown>) => ({ name, props, id: 'x', timestamp: '', session_id: 's', page: '/', utm_source: null, utm_medium: null, utm_campaign: null }) as AnalyticsEvent;
const course = { course_id: 'crs-1', institution_id: 'inst-a', category: 'data-analytics', program_type: 'curso', price: 500, currency: 'PEN', featured: false };

describe('toGA', () => {
  it('lead_submitted → generate_lead con valor, moneda y sin datos personales', () => {
    const [name, p] = toGA(ev('lead_submitted', { ...course, source: 'detalle', lead_id: 'l1', lead_score: 90, lead_tier: 'HIGH_INTENT', lead_segment: 'hot' }));
    expect(name).toBe('generate_lead');
    expect(p).toMatchObject({ currency: 'PEN', value: 500, lead_tier: 'HIGH_INTENT' });
    expect(JSON.stringify(p)).not.toMatch(/email|whatsapp|first_name/);
  });
  it('search_performed → search', () => {
    expect(toGA(ev('search_performed', { query: 'python', results_count: 3, source: 'home' }))).toEqual(['search', { search_term: 'python', results_count: 3, search_source: 'home' }]);
  });
  it('omite valores nulos (precio no publicado)', () => {
    const [name, p] = toGA(ev('course_viewed', { ...course, price: null }));
    expect(name).toBe('view_item');
    expect(p).not.toHaveProperty('value');
  });
});
