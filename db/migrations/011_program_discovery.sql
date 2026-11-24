-- Descubrimiento autónomo de programas: páginas de listado ("fuentes") que se revisan periódicamente para
-- encontrar programas nuevos, e instituciones sugeridas por búsqueda web que el administrador aprueba.
create table if not exists discovery_sources (
  id              bigint generated always as identity primary key,
  url             text not null,                 -- página que lista los programas de la institución
  path_prefix     text,                          -- solo links bajo esta ruta (p. ej. /es/)
  institution_id  text,                          -- institución del catálogo (null mientras no exista)
  institution     jsonb,                         -- datos para crear la institución si aún no está en el catálogo
  seed_links      text[] not null default '{}',  -- programas conocidos que se agregan aunque el listado no se pueda leer
  origin          text not null default 'manual' check (origin in ('auto', 'manual', 'sugerida', 'semilla')),
  status          text not null default 'activa' check (status in ('activa', 'pausada', 'sugerida', 'descartada')),
  reason          text,                          -- por qué se sugirió
  last_run_at     timestamptz,
  last_found      integer not null default 0,
  last_added      integer not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists discovery_sources_url_uniq on discovery_sources (lower(url));

alter table discovery_sources enable row level security;

alter table program_drafts add column if not exists source_id bigint;
alter table program_drafts add column if not exists auto boolean not null default false;

-- MIT Professional Education: programas online en español (con Global Alumni).
insert into discovery_sources (url, path_prefix, institution, seed_links, origin, status, reason)
values (
  'https://professionalprograms.mit.edu/es/',
  '/es/',
  '{"id":"inst-mit-professional-education","slug":"mit-professional-education","name":"MIT Professional Education","short_name":"MIT","type":"Universidad","country":"Estados Unidos","city":"Cambridge, Massachusetts","founded":null,"brand_color":"#A31F34","description":"MIT Professional Education es la unidad de formación para profesionales del Massachusetts Institute of Technology (MIT). Ofrece programas online en español, en colaboración con Global Alumni, sobre inteligencia artificial, transformación digital y liderazgo.","website":"https://professionalprograms.mit.edu/es/","accreditations":[],"logo":null,"is_demo":false,"aliases":["MIT","MIT Professional Education","Massachusetts Institute of Technology"]}'::jsonb,
  array[
    'https://professionalprograms.mit.edu/es/programa-online-transformacion-digital',
    'https://professionalprograms.mit.edu/es/programa-online-ia-generativa',
    'https://professionalprograms.mit.edu/es/programa-online-liderazgo-era-ia',
    'https://professionalprograms.mit.edu/es/certificado-profesional-en-transformacion-digital-ia',
    'https://professionalprograms.mit.edu/es/programa-en-alta-direccion-chief-digital-officer'
  ],
  'semilla', 'activa', 'Programas online en español del MIT (tecnología y negocios).'
)
on conflict do nothing;
