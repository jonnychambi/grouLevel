/**
 * Paridad con el import inicial: re-importar el Excel original sobre el catálogo actual
 * no debe crear ni cambiar nada. Requiere el archivo (XLSX_PATH); si no está, se omite.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSheet } from 'read-excel-file/node';
import { planImport, rowsToRecords, type Cell } from '../excelImport';
import { CATEGORIES, INSTITUTIONS } from './fixtures';
import courses from '../../data/courses.json';
import type { Course } from '../../types';

const file = process.env.XLSX_PATH ?? '';
describe.skipIf(!file || !existsSync(file))('paridad con el Excel original', () => {
  it('re-importar no crea ni modifica programas', async () => {
    const rows = (await readSheet(file, 'CURSOS')) as Cell[][];
    const { records, missingColumns } = rowsToRecords(rows);
    expect(missingColumns).toEqual([]);
    const plan = planImport(records, { courses: courses as Course[], institutions: INSTITUTIONS, categories: CATEGORIES }, { mode: 'nuevos-y-actualizar', newStatus: 'publicado', techOnly: true, overwriteManual: false, today: '2026-10-05' });
    const sample = plan.updates.slice(0, 5).map((u) => [u.after.id, u.changes.map((c) => `${c.label}: ${c.before} → ${c.after}`)]);
    expect(plan.newCourses.map((n) => n.course.name)).toEqual([]);
    expect(sample).toEqual([]);
    expect(plan.newInstitutions).toEqual([]);
    expect(plan.unchanged.length).toBe(courses.length);
  });
});
