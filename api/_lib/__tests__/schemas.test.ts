/** La API de Claude admite hasta 16 parámetros con tipos unión (anyOf / null) por esquema de salida estructurada. */
import { describe, expect, it } from 'vitest';
import { RESULT_SCHEMA } from '../profileAI';
import { FACTS_SCHEMA } from '../programRefresh';
import { draftSchema } from '../programImport';

function unions(node: unknown): number {
  if (Array.isArray(node)) return node.reduce((n, x) => n + unions(x), 0);
  if (!node || typeof node !== 'object') return 0;
  const o = node as Record<string, unknown>;
  let n = Array.isArray(o.anyOf) || Array.isArray(o.type) ? 1 : 0;
  for (const v of Object.values(o)) n += unions(v);
  return n;
}

describe('esquemas de salida estructurada', () => {
  it.each([
    ['análisis de perfil', RESULT_SCHEMA],
    ['actualización de programas', FACTS_SCHEMA],
    ['alta de programas', draftSchema(['data-analytics', 'ux-ui'])]
  ])('%s: como máximo 16 campos con unión', (_name, schema) => {
    expect(unions(schema)).toBeLessThanOrEqual(16);
  });
});
