/** Completar temarios: links del brochure, criterio de mejora, propuesta combinada y una revisión por programa. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';

let aiOut: Record<string, unknown> = {};
const prompts: string[] = [];
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (params: { messages: { content: string }[] }) => {
        prompts.push(params.messages[0].content);
        return { stop_reason: 'end_turn', usage: { input_tokens: 4000, output_tokens: 900 }, content: [{ type: 'text', text: JSON.stringify(aiOut) }] };
      }
    };
  }
}));

const pages = new Map<string, string>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith('https://inst.test/')) return realFetch(input, init);
  const html = pages.get(url);
  return html === undefined ? new Response('no', { status: 404 }) : new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}) as typeof fetch;

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const syl = await import('../syllabusEnrich');
const { getCurrentCatalog, publishCatalog } = await import('../catalogRepo');
const refresh = await import('../programRefresh');

type C = Record<string, unknown> & { id: string; url: string; status: string };
let target: C;
beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = 'test';
  const cat = (await getCurrentCatalog(sql))!;
  // Solo un programa con link simulado y temario escueto; el resto queda fuera del lote (temario completo).
  const full = [1, 2, 3].map((i) => ({ title: `M${i}`, hours: 10, description: '', topics: ['a', 'b'] }));
  const courses = (cat.data.courses as C[]).map((c) => ({ ...c, url: `https://inst.test/${c.id}`, syllabus: full }) as C);
  target = courses.find((c) => c.status === 'publicado' && !c.is_demo)!;
  Object.assign(target, { syllabus: [{ title: 'Introducción', hours: null, description: '', topics: [] }], objectives: [], tools: [] });
  await publishCatalog({ ...cat.data, courses }, 'temarios', null, { force: true }, sql);
});

describe('completar temarios', () => {
  it('detecta temarios escuetos y los links del brochure o la malla', () => {
    expect(syl.needsSyllabus({ syllabus: [{ title: 'A', topics: [] }, { title: 'B', topics: [] }, { title: 'C', topics: [] }] })).toBe(true);
    expect(syl.needsSyllabus({ syllabus: [{ title: 'A', topics: ['x'] }, { title: 'B', topics: [] }, { title: 'C', topics: [] }] })).toBe(false);
    const html = '<a href="/docs/brochure.pdf">Descargar</a><a href="malla.html">Ver malla curricular</a><a href="/contacto">Contacto</a><a href="mailto:a@b.c">Plan de estudios</a>';
    expect(syl.findSyllabusLinks(html, 'https://inst.test/programa/x')).toEqual(['https://inst.test/docs/brochure.pdf', 'https://inst.test/programa/malla.html']);
  });

  it('solo propone un temario claramente más completo, y objetivos o herramientas si faltaban', () => {
    const richer = syl.normalizeModules([{ title: 'SQL', hours: 12, description: '', topics: ['SELECT', 'JOIN', 'GROUP BY'] }, { title: 'Power BI', hours: 12, description: '', topics: ['DAX', 'Modelado'] }]);
    const ch = syl.syllabusChanges({ syllabus: [{ title: 'SQL', topics: [] }], objectives: ['x'], tools: [] }, { syllabus: richer, objectives: ['y'], tools: ['Power BI'] });
    expect(ch.map((c) => c.field)).toEqual(['syllabus', 'tools']);
    expect(syl.syllabusChanges({ syllabus: richer, objectives: [], tools: [] }, { syllabus: richer.slice(0, 1), objectives: [], tools: [] })).toEqual([]);
  });

  it('lee la página y el brochure, deja una propuesta sin pisar otros cambios y no repite el programa', async () => {
    pages.set(target.url, `<html><head><title>Programa</title></head><body><h1>Programa</h1><p>${'Contenido del programa. '.repeat(20)}</p><a href="https://inst.test/plan-de-estudios">Ver plan de estudios</a></body></html>`);
    pages.set('https://inst.test/plan-de-estudios', `<html><body>${Array.from({ length: 20 }, (_, i) => `<p>Módulo ${i + 1}: tema detallado del plan de estudios</p>`).join('')}</body></html>`);
    // Ya había una propuesta de precio pendiente para el mismo programa.
    await sql`insert into program_updates (course_id, course_name, changes, method) values (${target.id}, 'x', ${sql.json([{ field: 'price', label: 'Precio', current: 1, proposed: 2 }] as never)}, 'ia')`;
    aiOut = { found: true, syllabus: [{ title: 'Fundamentos', hours: 8, description: 'Bases.', topics: ['Tema 1', 'Tema 2'] }, { title: 'Proyecto', hours: 16, description: '', topics: ['Caso real'] }], objectives: ['Aplicar'], tools: ['Python'] };
    const s = await syl.runSyllabusBatch({ sql, timeBudgetMs: 200_000 });
    expect(s).toMatchObject({ checked: 1, proposed: 1, remaining: 0 });
    expect(prompts.at(-1)).toContain('DOCUMENTO ENLAZADO (https://inst.test/plan-de-estudios)');
    const [u] = await sql`select changes from program_updates where course_id = ${target.id} and status = 'pendiente'`;
    expect((u.changes as { field: string }[]).map((c) => c.field).sort()).toEqual(['objectives', 'price', 'syllabus', 'tools']);
    // Aplicar la propuesta deja el temario con temas en el catálogo.
    const [row] = await sql`select id from program_updates where course_id = ${target.id} and status = 'pendiente'`;
    await refresh.applyUpdate(Number(row.id), ['syllabus'], sql);
    const course = ((await getCurrentCatalog(sql))!.data.courses as C[]).find((c) => c.id === target.id)!;
    expect((course.syllabus as { topics: string[] }[])[0].topics).toEqual(['Tema 1', 'Tema 2']);
    // Ya revisado: el siguiente lote no lo vuelve a consultar.
    expect((await syl.runSyllabusBatch({ sql })).checked).toBe(0);
    expect((await syl.syllabusOverview(sql)).checks).toMatchObject({ propuesta: 1 });
  });
});
