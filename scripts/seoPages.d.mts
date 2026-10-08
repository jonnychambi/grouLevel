export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  body: string;
  kind?: 'catalog';
  index?: boolean;
  lastmod?: string | null;
  image?: string | null;
  jsonLd?: object[];
}
type Rec = Record<string, unknown>;
export function esc(s: unknown): string;
export function isCatalogPath(path: string): boolean;
export interface ReviewsData {
  institutions: Map<string, { avg: number; count: number; dims?: Record<string, number>; recommend_pct?: number | null }>;
  courses: Map<string, { avg: number; count: number; dims?: Record<string, number> }>;
  items: Map<string, Rec[]>;
}
export function buildRoutes(catalog: { courses: Rec[]; institutions: Rec[]; categories: Rec[] }, opts: { siteUrl: string; base?: string; ratings?: Map<string, { avg: number; count: number }>; reviews?: ReviewsData | null }): SeoRoute[];
export function staticRoutes(base?: string): SeoRoute[];
export function renderPage(template: string, route: SeoRoute, siteUrl: string): string;
export function sitemapXml(routes: SeoRoute[], siteUrl: string): string;
