export function toLiteCourse<T extends Record<string, unknown>>(c: T): T & { lite: true };
