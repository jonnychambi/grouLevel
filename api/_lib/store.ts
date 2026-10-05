/**
 * Almacenamiento versionado del catálogo en Vercel Blob (store privado).
 *
 * Cada guardado crea un archivo nuevo e inmutable: catalog/versions/<ISO>__<nota>.json.
 * La versión vigente es la más reciente. Esto da historial y restauración gratis,
 * y evita problemas de caché (nunca se sobrescribe un mismo archivo).
 */
import { del, get, list, put } from '@vercel/blob';

const PREFIX = 'catalog/versions/';
const KEEP_VERSIONS = 50;

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

export async function readLatest<T>(): Promise<{ data: T; version: VersionInfo } | null> {
  const [latest] = await listVersions();
  if (!latest) return null;
  const data = await readVersion<T>(latest.pathname);
  return data ? { data, version: latest } : null;
}

export async function writeVersion(data: unknown, note: string): Promise<VersionInfo> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = note
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const pathname = `${PREFIX}${stamp}${slug ? `__${slug}` : ''}.json`;
  const blob = await put(pathname, JSON.stringify(data), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false
  });
  void prune();
  return { pathname: blob.pathname, uploaded_at: new Date().toISOString(), size: JSON.stringify(data).length, note: slug.replace(/-/g, ' ') };
}

async function prune() {
  try {
    const versions = await listVersions();
    const old = versions.slice(KEEP_VERSIONS).map((v) => v.pathname);
    if (old.length) await del(old);
  } catch {
    /* limpieza best-effort */
  }
}
