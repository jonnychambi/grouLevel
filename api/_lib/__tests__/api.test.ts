import { beforeAll, describe, expect, it } from 'vitest';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';
import { checkPassword, issueToken, verifyRequest } from '../auth';
import { validateCatalog } from '../validate';

const catalog = () => JSON.parse(JSON.stringify({ courses, institutions, categories }));

describe('validateCatalog', () => {
  it('acepta el catálogo importado del Excel', () => {
    const r = validateCatalog(catalog());
    expect(r.ok ? [] : r.errors).toEqual([]);
  });
  it('rechaza slugs duplicados', () => {
    const c = catalog();
    c.courses[1].slug = c.courses[0].slug;
    const r = validateCatalog(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('ya existe');
  });
  it('rechaza institución inexistente y precio promocional mayor al regular', () => {
    const c = catalog();
    c.courses[0].institution_id = 'inst-no-existe';
    c.courses[1].price = 100;
    c.courses[1].discount_price = 200;
    const r = validateCatalog(c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(' ')).toContain('no existe');
      expect(r.errors.join(' ')).toContain('promocional');
    }
  });
  it('rechaza estructuras inválidas', () => {
    expect(validateCatalog({ courses: 'x' }).ok).toBe(false);
  });
});

describe('auth', () => {
  beforeAll(() => {
    process.env.ADMIN_PASSWORD = 'clave-de-prueba';
    process.env.ADMIN_SESSION_SECRET = 'secreto-de-prueba';
  });
  const req = (token?: string) => new Request('https://x/api/admin', { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('valida la contraseña', () => {
    expect(checkPassword('clave-de-prueba')).toBe(true);
    expect(checkPassword('otra')).toBe(false);
    expect(checkPassword(undefined)).toBe(false);
  });
  it('acepta un token emitido y rechaza tokens alterados o ausentes', () => {
    const { token } = issueToken();
    expect(verifyRequest(req(token))).toBe(true);
    expect(verifyRequest(req())).toBe(false);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: Date.now() + 9e9 })).toString('base64url');
    expect(verifyRequest(req(`${forged}.${sig}`))).toBe(false);
    expect(verifyRequest(req(`${payload}.${sig.slice(0, -2)}xx`))).toBe(false);
  });
  it('rechaza tokens vencidos', () => {
    const { token } = issueToken();
    const sig = token.split('.')[1];
    const expired = Buffer.from(JSON.stringify({ sub: 'admin', exp: Date.now() - 1000 })).toString('base64url');
    expect(verifyRequest(req(`${expired}.${sig}`))).toBe(false);
  });
});
