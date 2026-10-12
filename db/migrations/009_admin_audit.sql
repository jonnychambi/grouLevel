-- Registro de auditoría del administrador: quién (IP anonimizada), qué acción, sobre qué registro y con qué resultado.
-- Incluye los intentos de acceso fallidos. No guarda contraseñas ni datos personales.
create table if not exists admin_audit (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  method     text not null,
  action     text not null,
  target     text,
  ok         boolean not null,
  status     integer,
  detail     text,
  ip_hash    text
);
create index if not exists admin_audit_at_idx on admin_audit (at desc);
alter table admin_audit enable row level security;
