/** La plantilla pública (public/plantilla-programas-groulevel.xlsx) debe importarse tal cual. */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readSheet } from 'read-excel-file/node';
import { planImport, rowsToRecords, type Cell, type ImportOptions } from '../excelImport';
import { CATEGORIES, INSTITUTIONS } from './fixtures';
import categories from '../../data/categories.json';
import type { Category } from '../../types';

const TEMPLATE = fileURLToPath(new URL('../../../public/plantilla-programas-groulevel.xlsx', import.meta.url));
const opts: ImportOptions = { mode: 'nuevos-y-actualizar', newStatus: 'borrador', techOnly: true, overwriteManual: false, today: '2026-10-05' };

describe('plantilla de programas', () => {
  it('la hoja CURSOS trae todas las columnas y ninguna fila de datos', async () => {
    const parsed = rowsToRecords((await readSheet(TEMPLATE, 'CURSOS')) as Cell[][]);
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.records).toEqual([]);
  });

  it('la fila de EJEMPLO se importa completa con los valores de las listas', async () => {
    const parsed = rowsToRecords((await readSheet(TEMPLATE, 'EJEMPLO')) as Cell[][]);
    const plan = planImport(parsed.records, { courses: [], institutions: INSTITUTIONS, categories: CATEGORIES }, opts);
    expect(plan.skipped).toEqual([]);
    const c = plan.newCourses[0].course;
    expect(c).toMatchObject({
      name: 'Power BI para Analistas', category: 'data-analytics', program_type: 'curso', modality: 'en-vivo', level: 'intermedio',
      currency: 'PEN', price: 890, discount_price: 690, duration_hours: 24, duration_weeks: 6, start_date: '2026-11-10'
    });
    expect(c.financing).toMatchObject({ installments: 3, installment_amount: 230 });
    expect(c.syllabus).toHaveLength(3);
    expect(c.tools).toEqual(['Power BI', 'Excel', 'DAX']);
    expect(c.teachers[0]).toMatchObject({ name: 'Ana Torres', linkedin: 'https://www.linkedin.com/in/ana-torres' });
    expect(c.features).toMatchObject({ live_classes: true, mentoring: false });
  });

  it('acepta cada área tal como aparece en el sitio', async () => {
    const parsed = rowsToRecords((await readSheet(TEMPLATE, 'EJEMPLO')) as Cell[][]);
    for (const cat of categories as Category[]) {
      const rec = { ...parsed.records[0], AREA_PRINCIPAL: cat.name, URL_FINAL: `https://x.com/${cat.id}` };
      const plan = planImport([rec], { courses: [], institutions: INSTITUTIONS, categories: categories as Category[] }, opts);
      expect(plan.newCourses[0]?.course.category, cat.name).toBe(cat.id);
    }
  });
});
