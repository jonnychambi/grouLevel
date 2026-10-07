-- Mi ruta: diagnóstico frente al rol objetivo, salario y estudios sugeridos.

alter table profiles add column if not exists target_role_input text;          -- lo que escribió la persona
alter table profiles add column if not exists target_level text;
alter table profiles add column if not exists readiness integer;                -- 0–100 preparación para el rol objetivo
alter table profiles add column if not exists time_estimate text;
alter table profiles add column if not exists expected_salary numeric(14, 2);   -- salario mensual que espera
alter table profiles add column if not exists expected_salary_currency text;
alter table profiles add column if not exists target_salary_min numeric(14, 2); -- rango referencial del rol objetivo
alter table profiles add column if not exists target_salary_max numeric(14, 2);
alter table profiles add column if not exists target_salary_currency text;
alter table profiles add column if not exists salary_comparison text;          -- debajo | dentro | encima
alter table profiles add column if not exists modality text;
alter table profiles add column if not exists budget_pen numeric(14, 2);
alter table profiles add column if not exists hours_per_week integer;
alter table profiles add column if not exists diagnosis jsonb;
alter table profiles add column if not exists studies jsonb;
alter table profiles add column if not exists cv_text text;                     -- texto leído del CV (privado)

-- Puestos a los que podría postular hoy.
create table if not exists profile_suggested_roles (
  profile_id    text not null references profiles(id) on delete cascade,
  position      integer not null,
  title         text not null,
  category_id   text,
  level         text not null,
  fit           integer not null,
  reason        text,
  salary_min    numeric(14, 2),
  salary_max    numeric(14, 2),
  salary_currency text,
  primary key (profile_id, position)
);

-- Brecha entre hoy y el rol objetivo.
create table if not exists profile_gap_items (
  profile_id    text not null references profiles(id) on delete cascade,
  position      integer not null,
  kind          text not null check (kind in ('area', 'tecnica', 'blanda', 'experiencia')),
  name          text not null,
  current_value integer not null,
  required_value integer not null,
  note          text,
  primary key (profile_id, position)
);
create index if not exists profile_gap_items_name_idx on profile_gap_items (kind, name);

-- Estudios sugeridos: corto plazo (cursos, diplomados, bootcamps, especializaciones) y largo plazo (maestrías).
create table if not exists profile_studies (
  profile_id    text not null references profiles(id) on delete cascade,
  term          text not null check (term in ('corto', 'largo')),
  position      integer not null,
  course_id     text not null,
  reason        text,
  covers        text[] not null default '{}',
  primary key (profile_id, term, position)
);
create index if not exists profile_studies_course_idx on profile_studies (course_id);

alter table profile_suggested_roles enable row level security;
alter table profile_gap_items       enable row level security;
alter table profile_studies         enable row level security;
