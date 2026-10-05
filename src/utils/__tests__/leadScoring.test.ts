import { describe, expect, it } from 'vitest';
import { classify, DEFAULT_SCORING_CONFIG, scoreLead } from '../leadScoring';

const base = { email: 'ana@gmail.com', whatsapp: '' };
const signals = { compared_programs: 0, viewed_programs: 0, source: 'listado' as const };

describe('scoreLead', () => {
  it('aplica los pesos de urgencia del brief', () => {
    expect(DEFAULT_SCORING_CONFIG.timeline).toEqual({ inmediato: 40, '30-dias': 30, '1-3-meses': 20, comparando: 5 });
  });
  it('lead inmediato + cambio de carrera + comparó + WhatsApp = HIGH INTENT / hot', () => {
    const r = scoreLead({ ...base, whatsapp: '+51 999 888 777', start_timeline: 'inmediato', objective: 'cambiar-carrera' }, { compared_programs: 3, viewed_programs: 5, source: 'comparador' });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r).toMatchObject({ tier: 'HIGH_INTENT', segment: 'hot' });
  });
  it('solo comparando = LOW / cold', () => {
    const r = scoreLead({ ...base, start_timeline: 'comparando', objective: 'actualizar-conocimientos' }, signals);
    expect(r.tier).toBe('LOW');
    expect(r.segment).toBe('cold');
  });
  it('el score se mantiene entre 0 y 100 y suma su desglose', () => {
    const r = scoreLead({ email: 'cto@empresa.pe', whatsapp: '+51999888777', start_timeline: 'inmediato', objective: 'cambiar-carrera' }, { compared_programs: 3, viewed_programs: 9, source: 'comparador' });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.breakdown.reduce((s, b) => s + b.points, 0)).toBe(r.score);
  });
  it('la configuración es reemplazable sin tocar la UI', () => {
    const cfg = { ...DEFAULT_SCORING_CONFIG, timeline: { ...DEFAULT_SCORING_CONFIG.timeline, comparando: 90 } };
    expect(scoreLead({ ...base, start_timeline: 'comparando', objective: 'emprender' }, signals, cfg).tier).toBe('HIGH_INTENT');
  });
});

describe('classify', () => {
  it.each([[85, 'HIGH_INTENT'], [65, 'WARM'], [45, 'NURTURE'], [10, 'LOW']])('%i → %s', (score, tier) => {
    expect(classify(score).tier).toBe(tier);
  });
});
