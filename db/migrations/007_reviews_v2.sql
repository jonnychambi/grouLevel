-- Groulevel Reviews: reputación de instituciones (principal) y programas (complementaria), usuarios con
-- correo validado, evidencias privadas, insignia de verificación, reportes e incentivos.

-- Personas que opinan (correo validado con Supabase Auth). Datos de pago solo para incentivos.
create table if not exists reviewers (
  user_id         text primary key,          -- id del usuario en Supabase Auth
  email           text not null unique,
  display_name    text,
  payout_method   text,                      -- yape | plin | transferencia
  payout_account  text,
  blocked         boolean not null default false,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

-- Reseñas: institución + (opcional) programa cursado. Las anteriores quedan como kind = 'programa'.
alter table reviews alter column course_id drop not null;
alter table reviews add column if not exists kind text not null default 'programa';
alter table reviews add column if not exists user_id text;
alter table reviews add column if not exists email_verified boolean not null default false;
alter table reviews add column if not exists inst_rating numeric(3, 2);            -- promedio de las dimensiones de la institución
alter table reviews add column if not exists inst_scores jsonb;                   -- { academic, teachers, experience, compliance, value }
alter table reviews add column if not exists program_rating numeric(3, 2);
alter table reviews add column if not exists program_scores jsonb;                -- { content, methodology, tools, teacher }
alter table reviews add column if not exists best text;
alter table reviews add column if not exists improve text;
alter table reviews add column if not exists recommend boolean;
alter table reviews add column if not exists study_year integer;
alter table reviews add column if not exists student_status text;                 -- estudiante | egresado
alter table reviews add column if not exists evidence_path text;                  -- Blob privado (nunca público)
alter table reviews add column if not exists evidence_name text;
alter table reviews add column if not exists evidence_hash text;
alter table reviews add column if not exists evidence_status text not null default 'sin_evidencia';
alter table reviews add column if not exists verified boolean not null default false;
alter table reviews add column if not exists incentivized boolean not null default false;  -- se identifica públicamente
alter table reviews add column if not exists reports_count integer not null default 0;
alter table reviews add column if not exists flags text[] not null default '{}';  -- posibles duplicados, evidencia repetida…
alter table reviews add column if not exists criteria text[] not null default '{}';  -- criterios objetivos marcados al moderar
alter table reviews add column if not exists updated_at timestamptz;

update reviews set program_rating = rating where kind = 'programa' and program_rating is null;

do $$ begin
  alter table reviews add constraint reviews_kind_chk check (kind in ('institucion', 'programa'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table reviews add constraint reviews_evidence_chk check (evidence_status in ('sin_evidencia', 'pendiente', 'aprobada', 'rechazada'));
exception when duplicate_object then null; end $$;

-- Una reseña por persona, institución y programa (o institución sola).
create unique index if not exists reviews_user_target_uniq on reviews (user_id, institution_id, coalesce(course_id, '')) where user_id is not null;
create index if not exists reviews_institution_status_idx on reviews (institution_id, status, created_at desc);
create index if not exists reviews_evidence_hash_idx on reviews (evidence_hash) where evidence_hash is not null;

-- Reportes de reseñas sospechosas.
create table if not exists review_reports (
  id            bigint generated always as identity primary key,
  review_id     text not null references reviews(id) on delete cascade,
  reason        text not null,
  details       text,
  reporter_hash text,                         -- huella anónima para no contar el mismo reporte dos veces
  status        text not null default 'abierto' check (status in ('abierto', 'resuelto', 'descartado')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create unique index if not exists review_reports_once_uniq on review_reports (review_id, reporter_hash) where reporter_hash is not null;

-- Incentivos: S/ 50 por reseña institucional verificada + S/ 50 por evaluación detallada del programa.
create table if not exists review_incentives (
  id              bigint generated always as identity primary key,
  review_id       text not null references reviews(id) on delete cascade,
  user_id         text not null,
  institution_id  text not null,
  course_id       text not null default '',
  kind            text not null check (kind in ('institucion', 'programa')),
  amount          numeric(10, 2) not null,
  status          text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'pagado', 'rechazado')),
  note            text,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  paid_at         timestamptz
);
-- Máximo un incentivo por usuario e institución (reseña institucional) y por usuario y programa (evaluación).
create unique index if not exists review_incentives_once_uniq on review_incentives (user_id, institution_id, course_id, kind) where status <> 'rechazado';

-- Promedios públicos (solo reseñas aprobadas). Se reemplazan para incluir las dimensiones.
drop view if exists course_ratings;
drop view if exists institution_ratings;

create view course_ratings with (security_invoker = true) as
  select course_id,
         max(institution_id) as institution_id,
         round(avg(coalesce(program_rating, rating))::numeric, 2) as avg_rating,
         count(*)::int as reviews_count,
         round(avg((program_scores->>'content')::numeric), 2) as content,
         round(avg((program_scores->>'methodology')::numeric), 2) as methodology,
         round(avg((program_scores->>'tools')::numeric), 2) as tools,
         round(avg((program_scores->>'teacher')::numeric), 2) as teacher
  from reviews where status = 'aprobada' and course_id is not null and (program_rating is not null or kind = 'programa')
  group by course_id;

create view institution_ratings with (security_invoker = true) as
  select institution_id,
         round(avg(coalesce(inst_rating, rating))::numeric, 2) as avg_rating,
         count(*)::int as reviews_count,
         round(avg((inst_scores->>'academic')::numeric), 2) as academic,
         round(avg((inst_scores->>'teachers')::numeric), 2) as teachers,
         round(avg((inst_scores->>'experience')::numeric), 2) as experience,
         round(avg((inst_scores->>'compliance')::numeric), 2) as compliance,
         round(avg((inst_scores->>'value')::numeric), 2) as value,
         round(100.0 * avg(case when recommend then 1 when recommend = false then 0 end), 0) as recommend_pct
  from reviews where status = 'aprobada' and institution_id is not null
  group by institution_id;

alter table reviewers         enable row level security;
alter table review_reports    enable row level security;
alter table review_incentives enable row level security;
