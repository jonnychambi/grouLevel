import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { readSheet } from 'read-excel-file/node';
import { applyImportPlan, planImport, rowsToRecords, urlKey, type Cell, type ExcelRecord, type ImportOptions } from '../excelImport';
import { CATEGORIES, INSTITUTIONS } from './fixtures';
import courses from '../../data/courses.json';
import type { Course } from '../../types';

const FIXTURE = fileURLToPath(new URL('./fixtures/import-sample.xlsx', import.meta.url));
const base = (): Course[] => (JSON.parse(JSON.stringify(courses)) as Course[]).map((c) => (c.id === 'crs-0006' ? { ...c, manual_edit_at: '2026-10-04T10:00:00Z' } : c));
const opts = (o: Partial<ImportOptions> = {}): ImportOptions => ({ mode: 'nuevos-y-actualizar', newStatus: 'borrador', techOnly: true, overwriteManual: false, today: '2026-10-05', ...o });

let records: ExcelRecord[] = [];
beforeAll(async () => {
  const parsed = rowsToRecords((await readSheet(FIXTURE, 'CURSOS')) as Cell[][]);
  expect(parsed.missingColumns).toEqual([]);
  records = parsed.records;
});
const plan = (o?: Partial<ImportOptions>) => planImport(records, { courses: base(), institutions: INSTITUTIONS, categories: CATEGORIES }, opts(o));

describe('rowsToRecords', () => {
  it('detecta columnas obligatorias faltantes', () => {
    expect(rowsToRecords([['NOMBRE_PROGRAMA', 'X']]).missingColumns).toEqual(['INSTITUCION', 'AREA_PRINCIPAL', 'URL_FINAL']);
    expect(rowsToRecords([['otra cosa']]).records).toEqual([]);
  });
  it('normaliza URLs para reconocer el mismo programa', () => {
    expect(urlKey('https://www.Ejemplo.com/a/b/?utm=1')).toBe(urlKey('http://ejemplo.com/a/b'));
  });
});

describe('planImport', () => {
  it('agrega programas nuevos con el estado elegido y una institución existente (por alias)', () => {
    const p = plan();
    const nuevo = p.newCourses.find((n) => n.course.name === 'Programa Nuevo de Prueba')!;
    expect(nuevo.course.institution_id).toBe('inst-datapath');
    expect(nuevo.course.status).toBe('borrador');
    expect(nuevo.course.price).toBe(500);
    expect(nuevo.course.discount_price).toBe(400);
    expect(nuevo.course.modality).toBe('grabado');
    expect(nuevo.course.syllabus.map((m) => m.title)).toEqual(['Intro', 'Pipelines']);
    expect(nuevo.course.id).toMatch(/^crs-\d{4}$/);
    expect(base().some((c) => c.id === nuevo.course.id || c.slug === nuevo.course.slug)).toBe(false);
  });

  it('crea instituciones nuevas automáticamente', () => {
    const p = plan();
    expect(p.newInstitutions.map((i) => i.name)).toEqual(['Academia Nueva']);
    const ia = p.newCourses.find((n) => n.course.name === 'Bootcamp de IA Aplicada')!;
    expect(ia.institutionIsNew).toBe(true);
    expect(ia.course.institution_id).toBe(p.newInstitutions[0].id);
    expect(p.newInstitutions[0].aliases).toEqual(['Academia Nueva (Lima)']);
  });

  it('actualiza programas existentes (por URL) sin borrar datos que el Excel no trae', () => {
    const p = plan();
    const upd = p.updates.find((u) => u.after.id === 'crs-0005')!;
    expect(upd.after.price).toBe(2500);
    expect(upd.after.discount_price).toBe(1990);
    expect(upd.after.duration_hours).toBe(upd.before.duration_hours); // "No especificado" no borra
    expect(upd.after.syllabus).toEqual(upd.before.syllabus); // vacío no borra
    expect(upd.changes.map((c) => c.label)).toEqual(expect.arrayContaining(['Precio', 'Precio promocional']));
    expect(upd.after.status).toBe(upd.before.status);
    // Descripción y tipo vacíos en el Excel: se conservan los existentes (no se usan valores por defecto)
    expect(upd.after.short_description).toBe(upd.before.short_description);
    expect(upd.after.program_type).toBe(upd.before.program_type);
    expect(upd.changes.map((c) => c.field).sort()).toEqual(['discount_price', 'price']);
  });

  it('sin precio promocional en el Excel conserva el actual si sigue siendo menor', () => {
    const upd = plan({ overwriteManual: true }).updates.find((u) => u.after.id === 'crs-0006')!;
    expect(upd.after.price).toBe(9999);
    expect(upd.after.discount_price).toBe(upd.before.discount_price);
  });

  it('protege programas editados a mano, salvo que se pida sobrescribirlos', () => {
    expect(plan().protectedManual.map((x) => x.course.id)).toEqual(['crs-0006']);
    expect(plan({ overwriteManual: true }).updates.some((u) => u.after.id === 'crs-0006')).toBe(true);
  });

  it('modo "solo nuevos" no modifica existentes', () => {
    const p = plan({ mode: 'nuevos' });
    expect(p.updates).toEqual([]);
    expect(p.unchanged.map((u) => u.course.id)).toEqual(expect.arrayContaining(['crs-0005', 'crs-0006']));
  });

  it('descarta filas con motivo claro', () => {
    const reasons = Object.fromEntries(plan().skipped.map((s) => [s.name, s.reason]));
    expect(reasons['Finanzas Corporativas']).toMatch(/fuera del foco/);
    expect(reasons['Programa Caído']).toMatch(/Sin datos/);
    expect(reasons['Programa Nuevo de Prueba (repetido)']).toMatch(/URL repetida/);
    expect(reasons['Programa sin URL']).toMatch(/URL/);
  });

  it('sin filtro tecnológico importa también otras áreas', () => {
    expect(plan({ techOnly: false }).newCourses.some((n) => n.course.name === 'Finanzas Corporativas')).toBe(true);
  });
});

describe('applyImportPlan', () => {
  it('aplica solo lo seleccionado y agrega solo las instituciones necesarias', () => {
    const p = plan();
    const catalog = { courses: base(), institutions: INSTITUTIONS, categories: CATEGORIES };
    const onlyDatapath = new Set(p.newCourses.filter((n) => n.course.institution_id === 'inst-datapath').map((n) => n.course.id));
    const res = applyImportPlan(catalog, p, { newIds: onlyDatapath, updateIds: new Set(['crs-0005']) });
    expect(res.added).toBe(1);
    expect(res.updated).toBe(1);
    expect(res.institutionsAdded).toBe(0);
    expect(res.courses).toHaveLength(courses.length + 1);
    expect(res.courses.find((c) => c.id === 'crs-0005')!.price).toBe(2500);
    const all = applyImportPlan(catalog, p, { newIds: new Set(p.newCourses.map((n) => n.course.id)), updateIds: new Set() });
    expect(all.institutionsAdded).toBe(1);
  });
});
