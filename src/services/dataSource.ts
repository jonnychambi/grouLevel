/**
 * Fuente de datos intercambiable.
 *
 * El frontend solo conoce la interfaz `DataSource`. Hoy se implementa con JSON
 * estático (bundle). Para migrar a Supabase, Firebase, PostgreSQL/MySQL vía API REST,
 * basta con crear otra implementación y devolverla en `getDataSource()`.
 */
import type { Category, Course, Institution } from '../types';

export interface DataSource {
  getCourses(): Promise<Course[]>;
  getInstitutions(): Promise<Institution[]>;
  getCategories(): Promise<Category[]>;
}

/** Implementación con los JSON de /src/data (se cargan como chunk separado). */
export class JsonDataSource implements DataSource {
  async getCourses() {
    return (await import('../data/courses.json')).default as Course[];
  }
  async getInstitutions() {
    return (await import('../data/institutions.json')).default as Institution[];
  }
  async getCategories() {
    return (await import('../data/categories.json')).default as Category[];
  }
}

interface CatalogBundle { courses: Course[]; institutions: Institution[]; categories: Category[] }

/**
 * Catálogo administrable (por defecto): lee /api/catalog (lo que se publica desde /admin)
 * y, si la API no existe o falla (GitHub Pages, desarrollo local, sin datos aún), usa el JSON del build.
 */
export class LiveDataSource implements DataSource {
  private bundle: Promise<CatalogBundle> | null = null;
  constructor(private endpoint: string, private fallback: DataSource, private timeoutMs = 3500) {}

  private load(): Promise<CatalogBundle> {
    if (!this.bundle) {
      this.bundle = (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
          const res = await fetch(this.endpoint, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
          clearTimeout(t);
          if (res.ok && (res.headers.get('content-type') ?? '').includes('application/json')) {
            const data = (await res.json()) as CatalogBundle;
            if (Array.isArray(data.courses) && Array.isArray(data.institutions) && Array.isArray(data.categories)) return data;
          }
        } catch {
          /* sin API: se usa el catálogo del build */
        }
        const [courses, institutions, categories] = await Promise.all([this.fallback.getCourses(), this.fallback.getInstitutions(), this.fallback.getCategories()]);
        return { courses, institutions, categories };
      })();
    }
    return this.bundle;
  }
  async getCourses() { return (await this.load()).courses; }
  async getInstitutions() { return (await this.load()).institutions; }
  async getCategories() { return (await this.load()).categories; }
}

/** Ejemplo de implementación REST genérica. */
export class RestDataSource implements DataSource {
  constructor(private baseUrl: string) {}
  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Error ${res.status} al cargar ${path}`);
    return res.json() as Promise<T>;
  }
  getCourses() { return this.get<Course[]>('/courses'); }
  getInstitutions() { return this.get<Institution[]>('/institutions'); }
  getCategories() { return this.get<Category[]>('/categories'); }
}

let instance: DataSource | null = null;

export function getDataSource(): DataSource {
  if (!instance) {
    const api = import.meta.env.VITE_DATA_API_URL as string | undefined;
    const live = (import.meta.env.VITE_CATALOG_API as string | undefined) ?? `${import.meta.env.BASE_URL}api/catalog`;
    instance = api ? new RestDataSource(api) : live === 'off' ? new JsonDataSource() : new LiveDataSource(live, new JsonDataSource());
  }
  return instance;
}

/** Permite inyectar otra fuente (tests, previews). */
export function setDataSource(ds: DataSource) {
  instance = ds;
}
