/**
 * Catálogo en la base (fuente principal).
 *
 *  · Tablas categories / institutions / courses: el catálogo vigente, consultable.
 *  · catalog_versions: cada publicación desde /admin guarda su contenido completo (data) → historial y restauración.
 *    Las versiones antiguas importadas de Vercel Blob tienen data = null y se leen de Blob al restaurarlas.
 *  · catalog_changes: qué cambió en cada programa/institución entre versiones.
 */
import type { Sql } from './db.js';
import { getSql } from './db.js';
import type { CatalogPayload } from './validate.js';
import { writeCatalogTables, type VersionInfo } from './dbSync.js';
import { readVersion as readBlobVersion } from './store.js';

const KEEP_VERSIONS = 40;

type Rec = Record<string, unknown>;

function toInfo(r: Rec): VersionInfo {
  return { pathname: String(r.pathname), uploaded_at: new Date(r.uploaded_at as string).toISOString(), size: Number(r.size_bytes ?? 0), note: (r.note as string) ?? '' };
}

/** Reconstruye el catálogo desde las tablas (respeta el orden original). */
async function catalogFromTables(sql: Sql): Promise<CatalogPayload | null> {
  const [courses, institutions, categories] = await Promise.all([
    sql`select raw from courses order by position, id`,
    sql`select raw from institutions order by position, id`,
    sql`select id, slug, name, "group", description, keywords from categories order by position, id`
  ]);
  if (!courses.length && !institutions.length) return null;
  return {
    courses: courses.map((r) => r.raw as Rec),
    institutions: institutions.map((r) => r.raw as Rec),
    categories: categories.map((r) => ({ id: r.id, slug: r.slug, name: r.name, group: r.group, description: r.description ?? '', keywords: r.keywords }))
  };
}

/** Catálogo vigente y su versión (null si nunca se publicó). */
export async function getCurrentCatalog(sql: Sql = getSql()): Promise<{ data: CatalogPayload; version: VersionInfo } | null> {
  const [current] = await sql`select pathname, note, uploaded_at, size_bytes, data from catalog_versions where is_current limit 1`;
  if (!current) return null;
  const data = (current.data as CatalogPayload | null) ?? (await catalogFromTables(sql));
  return data ? { data, version: toInfo(current) } : null;
}

export async function listVersions(sql: Sql = getSql()): Promise<VersionInfo[]> {
  return (await sql`select pathname, note, uploaded_at, size_bytes from catalog_versions order by uploaded_at desc, pathname desc limit 200`).map(toInfo);
}

export async function readVersion(pathname: string, sql: Sql = getSql()): Promise<CatalogPayload | null> {
  const [row] = await sql`select data from catalog_versions where pathname = ${pathname}`;
  if (!row) return null;
  if (row.data) return row.data as CatalogPayload;
  return pathname.startsWith('catalog/versions/') ? readBlobVersion<CatalogPayload>(pathname) : null;
}

const versionId = (note: string) => {
  const slug = note.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'edicion';
  return `db/${new Date().toISOString()}__${slug}`;
};

export class VersionConflictError extends Error {
  constructor(public current: VersionInfo) {
    super('conflict');
  }
}

/**
 * Publica una nueva versión del catálogo. Control de concurrencia optimista: si `baseVersion` no es la
 * versión vigente (otra sesión guardó antes) lanza VersionConflictError. `force` lo omite (restauraciones).
 */
export async function publishCatalog(catalog: CatalogPayload, note: string, baseVersion: string | null | undefined, opts: { force?: boolean } = {}, sql: Sql = getSql()): Promise<VersionInfo> {
  return sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    const [current] = await t`select pathname, note, uploaded_at, size_bytes from catalog_versions where is_current for update`;
    if (!opts.force && current && baseVersion !== current.pathname) throw new VersionConflictError(toInfo(current));
    const pathname = versionId(note);
    const body = JSON.stringify(catalog);
    await t`update catalog_versions set is_current = false where is_current`;
    const [row] = await t`
      insert into catalog_versions (pathname, note, uploaded_at, courses_count, is_current, data, size_bytes)
      values (${pathname}, ${note || null}, now(), ${catalog.courses.length}, true, ${t.json(catalog as never)}, ${Buffer.byteLength(body)})
      returning pathname, note, uploaded_at, size_bytes`;
    await writeCatalogTables(t, catalog, pathname);
    // Retención: se conservan las últimas versiones con contenido (las demás quedan listadas sin datos).
    await t`update catalog_versions set data = null where data is not null and pathname not in (
      select pathname from catalog_versions where data is not null order by uploaded_at desc limit ${KEEP_VERSIONS})`;
    return toInfo(row);
  }) as Promise<VersionInfo>;
}
