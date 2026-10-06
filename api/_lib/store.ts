/**
 * Versiones antiguas del catálogo en Vercel Blob (solo lectura).
 *
 * Antes de Supabase, cada publicación se guardaba como catalog/versions/<ISO>__<nota>.json.
 * Hoy el catálogo vive en la base; estas funciones solo permiten listar e importar/restaurar esas versiones.
 */
import { get, list } from '@vercel/blob';

const PREFIX = 'catalog/versions/';

export interface VersionInfo {
  pathname: string;
  uploaded_at: string;
  size: number;
  note: string;
}

export function isStoreConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function toInfo(b: { pathname: string; uploadedAt: Date; size: number }): VersionInfo {
  const file = b.pathname.slice(PREFIX.length).replace(/\.json$/, '');
  const note = file.includes('__') ? file.split('__')[1].replace(/-/g, ' ') : '';
  return { pathname: b.pathname, uploaded_at: b.uploadedAt.toISOString(), size: b.size, note };
}

export async function listVersions(): Promise<VersionInfo[]> {
  const out: VersionInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    out.push(...page.blobs.map(toInfo));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
}

export async function readVersion<T>(pathname: string): Promise<T | null> {
  if (!pathname.startsWith(PREFIX)) return null;
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return null;
  const text = await new Response(res.stream).text();
  return JSON.parse(text) as T;
}
