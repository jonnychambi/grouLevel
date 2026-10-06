/** Fuentes de Vercel Blob para la sincronización completa con la base de datos. */
import type { CatalogPayload } from './validate.js';
import type { SyncSources } from './dbSync.js';
import { listVersions, readLatest } from './store.js';
import { listLeads } from './leads.js';
import { listAllReviews } from './reviews.js';
import { listProfileIds, readProfile } from './profiles.js';

export const blobSources: SyncSources = {
  catalog: () => readLatest<CatalogPayload>(),
  versions: listVersions,
  leads: async () => (await listLeads(100_000)).leads,
  reviews: listAllReviews,
  profileIds: listProfileIds,
  profile: readProfile
};
