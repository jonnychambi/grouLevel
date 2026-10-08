-- Alta de programas desde links: cada link se lee, la IA arma un borrador y el administrador lo revisa y publica.
create table if not exists program_drafts (
  id              bigint generated always as identity primary key,
  url             text not null,
  status          text not null default 'en_cola' check (status in ('en_cola', 'procesando', 'listo', 'error', 'publicado', 'descartado')),
  institution_id  text,                -- detectada por el dominio o elegida por el administrador
  data            jsonb,               -- programa propuesto (mismo formato que el catálogo)
  missing         text[] not null default '{}',  -- datos clave que la página no muestra
  error           text,
  model           text,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  attempts        integer not null default 0,
  course_id       text,                -- programa creado al publicar
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);
create unique index if not exists program_drafts_url_active_uniq on program_drafts (lower(url)) where status not in ('descartado', 'publicado');
create index if not exists program_drafts_status_idx on program_drafts (status, created_at);

alter table program_drafts enable row level security;
