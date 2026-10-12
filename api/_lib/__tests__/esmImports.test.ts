/**
 * En Vercel las funciones corren como ESM en Node: todo import relativo de ejecución necesita extensión
 * (.js/.mjs/.json). Sin ella la función falla al cargar (FUNCTION_INVOCATION_FAILED) aunque las pruebas
 * con Vite pasen. Recorre lo que importa api/ (incluido lo compartido de src/) y lo verifica.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const IMPORT = /^(?:import|export)\s+(type\s+)?[^;'"]*?from\s+'(\.[^']+)'/gm;

function apiEntries(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') return [];
    return statSync(p).isDirectory() ? apiEntries(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('imports del API', () => {
  it('todos los imports relativos que se ejecutan llevan extensión', () => {
    const seen = new Set<string>();
    const missing: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        if (m[1]) continue; // import type: se borra al compilar
        const spec = m[2];
        if (!/\.(js|mjs|json)$/.test(spec)) { missing.push(`${file.replace(ROOT, '')} → ${spec}`); continue; }
        const ts = normalize(join(dirname(file), spec)).replace(/\.js$/, '.ts');
        if (existsSync(ts)) visit(ts);
      }
    };
    apiEntries(join(ROOT, 'api')).forEach(visit);
    expect(missing).toEqual([]);
    expect(seen.size).toBeGreaterThan(20);
  });
});
