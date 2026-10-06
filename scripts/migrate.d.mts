import type postgres from 'postgres';
export function connect(url: string, opts?: postgres.Options<Record<string, postgres.PostgresType>>): postgres.Sql;
export function migrate(sql: postgres.Sql, opts?: { log?: (msg: string) => void; statusOnly?: boolean }): Promise<{ applied: string[]; pending: string[] }>;
