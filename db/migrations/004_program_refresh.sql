-- Actualización automática de programas: lectura periódica de los links oficiales.
-- Si se detectan cambios se crea una propuesta (program_updates) que el administrador aplica o descarta.

-- Último resultado de la revisión de cada programa.
create table if not exists program_checks (
  course_id        text primary key,
  url              text not null,
  last_checked_at  timestamptz not null default now(),
  last_status      text not null check (last_status in ('sin_cambios', 'cambios', 'error', 'sin_contenido')),
  http_status      integer,
  content_hash     text,             -- huella del texto relevante de la página: si no cambia, no se llama al modelo
  last_error       text,
  last_changed_at  timestamptz,
  input_tokens     integer not null default 0,
  output_tokens    integer not null default 0
);
create index if not exists program_checks_checked_idx on program_checks (last_checked_at);

-- Cambios detectados, pendientes de aprobación.
create table if not exists program_updates (
  id            bigint generated always as identity primary key,
  course_id     text not null,
  course_name   text,
  detected_at   timestamptz not null default now(),
  status        text not null default 'pendiente' check (status in ('pendiente', 'aplicada', 'descartada')),
  changes       jsonb not null default '[]',   -- [{ field, label, current, proposed }]
  source_url    text,
  method        text not null default 'ia',     -- ia | huella (sin IA: solo se sabe que la página cambió)
  model         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  decided_at    timestamptz,
  version       text,                           -- versión del catálogo publicada al aplicar
  note          text
);
create index if not exists program_updates_status_idx on program_updates (status, detected_at desc);
create unique index if not exists program_updates_pending_uniq on program_updates (course_id) where status = 'pendiente';

-- Cada ejecución (programada o manual).
create table if not exists refresh_runs (
  id            bigint generated always as identity primary key,
  trigger       text not null,                  -- cron | admin | programa
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  checked       integer not null default 0,
  unchanged     integer not null default 0,
  changed       integer not null default 0,
  errors        integer not null default 0,
  ai_calls      integer not null default 0,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0
);
create index if not exists refresh_runs_started_idx on refresh_runs (started_at desc);

-- Configuración editable desde /admin.
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table program_checks  enable row level security;
alter table program_updates enable row level security;
alter table refresh_runs    enable row level security;
alter table app_settings    enable row level security;
