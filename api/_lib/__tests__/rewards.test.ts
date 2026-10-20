/** Groulevel Rewards: la landing explica exactamente las reglas de créditos que aplica el servidor. */
import { describe, expect, it } from 'vitest';
import { CREDITS } from '../../../src/utils/reviews';
import { REWARDS, REWARDS_FAQ, REWARDS_RULES, simulateRewards } from '../../../src/content/rewards.mjs';
import { staticRoutes } from '../../../scripts/seoPages.mjs';

describe('Groulevel Rewards', () => {
  it('los montos de la landing coinciden con los créditos del servidor', () => {
    expect(REWARDS).toEqual({ review: CREDITS.review, referral: CREDITS.referral, maxPerProgram: CREDITS.maxPerProgram });
  });

  it('simula el total y su reparto con el máximo por programa', () => {
    expect(simulateRewards(0, 0)).toEqual({ total: 0, programs: [] });
    expect(simulateRewards(1, 2)).toEqual({ total: 300, programs: [300] });
    expect(simulateRewards(2, 3)).toEqual({ total: 500, programs: [300, 200] });
  });

  it('las bases explican aprobación, verificación, etiqueta "Incentivada" y uso como descuento', () => {
    const text = REWARDS_RULES.join(' ');
    for (const s of ['constancia', 'Incentivada', 'no depende de tu calificación', 'No es canjeable por dinero', 'primera reseña']) expect(text.toLowerCase()).toContain(s.toLowerCase());
    expect(REWARDS_FAQ.length).toBeGreaterThanOrEqual(5);
  });

  it('se publica como página indexable con contenido en el HTML inicial y FAQPage', () => {
    const r = staticRoutes().find((x) => x.path === '/rewards')!;
    expect(r.index).not.toBe(false);
    expect(r.title).toContain('Groulevel Rewards');
    expect(r.body).toContain('Bases de la campaña');
    expect(JSON.stringify(r.jsonLd)).toContain('FAQPage');
  });
});
