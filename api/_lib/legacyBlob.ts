/**
 * Lectura de los datos antiguos guardados en Vercel Blob (antes de pasar a Supabase).
 * Solo se usa para la importación no destructiva desde /admin → Base de datos.
 */
import { get, list } from '@vercel/blob';
import type { Lead } from '../../src/types/lead.js';
import type { Review } from '../../src/types/review.js';
import type { ProfileAnalysis } from '../../src/types/profile.js';
import type { BlobSources } from './dbSync.js';
import { isStoreConfigured, listVersions } from './store.js';

async function listPaths(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    paths.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

async function readJson<T>(pathname: string): Promise<T | null> {
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return JSON.parse(await new Response(res.stream).text()) as T;
}

async function readAll<T>(paths: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < paths.length; i += 20) out.push(...(await Promise.all(paths.slice(i, i + 20).map((p) => readJson<T>(p)))).filter((x): x is Awaited<T> => !!x));
  return out;
}

const PROFILE_ID = /^prf_[a-f0-9]{24}$/;

export const legacyBlobSources: BlobSources = {
  versions: () => (isStoreConfigured() ? listVersions() : Promise.resolve([])),
  leads: async () => (isStoreConfigured() ? readAll<Lead>(await listPaths('leads/')) : []),
  reviews: async () => (isStoreConfigured() ? readAll<Review>(await listPaths('reviews/')) : []),
  profileIds: async () => (isStoreConfigured() ? (await listPaths('profiles/')).map((p) => p.slice('profiles/'.length).replace(/\.json$/, '')).filter((id) => PROFILE_ID.test(id)) : []),
  profile: (id) => readJson<ProfileAnalysis>(`profiles/${id}.json`)
};
