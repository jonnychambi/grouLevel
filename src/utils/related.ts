import type { CourseWithInstitution } from '../types';
import { priceInPEN } from './format';

/**
 * "También podrían interesarte": similitud por categoría, modalidad y rango de precio,
 * con un pequeño aporte de herramientas compartidas.
 */
export function relatedCourses(target: CourseWithInstitution, all: CourseWithInstitution[], limit = 4): CourseWithInstitution[] {
  const targetPrice = priceInPEN(target);
  const tools = new Set(target.tools.map((t) => t.toLowerCase()));
  return all
    .filter((c) => c.id !== target.id)
    .map((c) => {
      let score = 0;
      if (c.category === target.category) score += 10;
      if (c.modality === target.modality) score += 3;
      const p = priceInPEN(c);
      const ratio = targetPrice === 0 || p === 0 ? (targetPrice === p ? 1 : 0) : Math.min(p, targetPrice) / Math.max(p, targetPrice);
      score += ratio * 5;
      score += c.tools.filter((t) => tools.has(t.toLowerCase())).length * 1.5;
      if (c.level === target.level) score += 1;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
