-- MBA como tipo de programa propio (antes dentro de "maestria"). Reclasifica los MBA ya publicados:
-- maestrías o programas ejecutivos con "MBA" en el nombre o el tipo publicado, y maestrías en administración
-- de empresas o de negocios. Se aplica a las tablas y a la versión vigente del catálogo.
create or replace function pg_temp.is_mba(t text, name text, published text) returns boolean language sql immutable as $$
  select (t in ('maestria', 'programa-ejecutivo') and (coalesce(name, '') ~ '\mMBA\M' or coalesce(published, '') ~ '\mMBA\M'))
      or (t = 'maestria' and coalesce(name, '') ~* '(business administration|administraci[oó]n de (empresas|negocios)|direcci[oó]n de empresas)')
$$;

update courses set program_type = 'mba', raw = jsonb_set(raw, '{program_type}', '"mba"')
where pg_temp.is_mba(program_type, name, published_type);

update catalog_versions cv set data = jsonb_set(cv.data, '{courses}', (
  select coalesce(jsonb_agg(case when pg_temp.is_mba(c->>'program_type', c->>'name', c->>'published_type') then jsonb_set(c, '{program_type}', '"mba"') else c end order by ord), '[]'::jsonb)
  from jsonb_array_elements(cv.data->'courses') with ordinality as t(c, ord)))
where cv.is_current and cv.data is not null and jsonb_typeof(cv.data->'courses') = 'array';
