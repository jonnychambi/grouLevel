-- Completar temarios: último intento por programa (para no volver a consultar la IA por lo mismo).
create table if not exists syllabus_checks (
  course_id     text primary key,
  checked_at    timestamptz not null default now(),
  status        text not null check (status in ('propuesta', 'sin_mejora', 'sin_temario', 'error')),
  sources       text[] not null default '{}',   -- página y documentos (brochure, malla) leídos
  error         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0
);
alter table syllabus_checks enable row level security;
