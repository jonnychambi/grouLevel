import { describe, expect, it } from 'vitest';
import { displayName, institutionSummaries, sortReviews, summarize, validateReview } from '../reviews';
import type { PublicReview } from '../../types';

describe('validateReview', () => {
  const ok = { rating: 4, title: '', comment: 'Muy buen programa, docentes con experiencia real.', author_name: 'Ana Torres', author_email: 'ana@mail.com', relationship: 'egresado' as const, consent: true };
  it('acepta una reseña válida', () => expect(validateReview(ok)).toEqual({}));
  it('exige estrellas 1–5, comentario mínimo, email, relación y consentimiento', () => {
    const e = validateReview({ ...ok, rating: 0, comment: 'corto', author_email: 'x', relationship: undefined, consent: false });
    expect(Object.keys(e).sort()).toEqual(['author_email', 'comment', 'consent', 'rating', 'relationship']);
    expect(validateReview({ ...ok, rating: 6 }).rating).toBeTruthy();
    expect(validateReview({ ...ok, rating: 3.5 }).rating).toBeTruthy();
  });
});

describe('displayName', () => {
  it('muestra nombre e inicial del apellido', () => {
    expect(displayName('Ana María  Torres')).toBe('Ana María T.');
    expect(displayName('ana')).toBe('ana');
  });
});

describe('summarize / institutionSummaries', () => {
  it('promedia y arma la distribución', () => {
    expect(summarize([5, 4, 4, 1])).toEqual({ avg: 3.5, count: 4, distribution: [1, 0, 0, 2, 1] });
    expect(summarize([])).toEqual({ avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] });
  });
  it('la institución pondera todas las reseñas de sus programas', () => {
    const inst = institutionSummaries({
      a: { ...summarize([5, 5]), institution_id: 'i1' },
      b: { ...summarize([2]), institution_id: 'i1' },
      c: { ...summarize([4]), institution_id: 'i2' }
    });
    expect(inst.i1).toEqual({ avg: 4, count: 3, distribution: [0, 1, 0, 0, 2] });
    expect(inst.i2.avg).toBe(4);
  });
  it('ordena reseñas', () => {
    const r = (id: string, rating: number, d: string) => ({ id, rating, created_at: d }) as PublicReview;
    const list = [r('a', 3, '2026-01-01'), r('b', 5, '2026-01-02'), r('c', 1, '2026-01-03')];
    expect(sortReviews(list, 'recientes').map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(sortReviews(list, 'mejores').map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(sortReviews(list, 'peores').map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
