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

/** Ejemplo de implementación REST (no usada en el MVP). */
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
    instance = api ? new RestDataSource(api) : new JsonDataSource();
  }
  return instance;
}

/** Permite inyectar otra fuente (tests, previews). */
export function setDataSource(ds: DataSource) {
  instance = ds;
}
