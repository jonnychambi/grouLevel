-- Groulevel · esquema inicial (Supabase / PostgreSQL)
--
-- Convenciones
--  · Los ids conservan el formato actual del sitio (crs-0001, inst-…, lead_…, rev_…, prf_…).
--  · Cada tabla principal guarda también el registro original en `raw` (jsonb): la base puede
--    convertirse en la fuente de verdad sin perder ningún campo.
--  · Seguridad: RLS activado SIN políticas en todas las tablas → la API pública de Supabase
--    (anon / publishable key) no puede leer ni escribir nada. Solo el servidor de Vercel,
--    que se conecta como `postgres` con POSTGRES_URL, tiene acceso.

-- ───────────────────────────── Catálogo ─────────────────────────────

create table if not exists categories (
  id            text primary key,
  slug          text not null unique,
  name          text not null,
  "group"       text,
  description   text,
  keywords      text[] not null default '{}',
  position      integer not null default 0,
  synced_at     timestamptz not null default now()
);

create table if not exists institutions (
  id              text primary key,
  slug            text not null unique,
  name            text not null,
  short_name      text,
  type            text,
  country         text,
  city            text,
  founded         integer,
  brand_color     text,
  description     text,
  website         text,
  programs_url    text,
  logo_url        text,
  accreditations  text[] not null default '{}',
  aliases         text[] not null default '{}',
  is_demo         boolean not null default false,
  raw             jsonb not null,
  synced_at       timestamptz not null default now()
);

create table if not exists courses (
  id                text primary key,
  slug              text not null unique,
  institution_id    text not null references institutions(id) on update cascade on delete restrict,
  category_id       text references categories(id) on update cascade on delete set null,
  subcategory       text,
  name              text not null,
  program_type      text not null,
  published_type    text,
  level             text check (level in ('basico', 'intermedio', 'avanzado')),
  modality          text check (modality in ('en-vivo', 'grabado', 'hibrido', 'presencial')),
  status            text not null default 'publicado' check (status in ('publicado', 'borrador', 'oculto')),
  featured          boolean not null default false,
  price             numeric(12, 2),
  discount_price    numeric(12, 2),
  currency          text not null default 'PEN',
  duration_hours    numeric(8, 1),
  duration_weeks    numeric(8, 1),
  duration_text     text,
  start_date        date,
  start_text        text,
  schedule          text,
  url               text,
  image_url         text,
  platform          text,
  language          text,
  country           text,
  short_description text,
  description       text,
  target_audience   text,
  objectives        text[] not null default '{}',
  tools             text[] not null default '{}',
  skills            text[] not null default '{}',
  keywords          text[] not null default '{}',
  requirements      text[] not null default '{}',
  -- Estructuras anidadas: docentes, temario, financiamiento, certificado, atributos sí/no.
  teachers          jsonb not null default '[]',
  syllabus          jsonb not null default '[]',
  financing         jsonb,
  certificate       jsonb,
  features          jsonb,
  completeness      numeric(4, 3),
  is_demo           boolean not null default false,
  updated_at        timestamptz,
  manual_edit_at    timestamptz,
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);
create index if not exists courses_institution_idx on courses (institution_id);
create index if not exists courses_category_idx on courses (category_id);
create index if not exists courses_status_idx on courses (status);

-- Versiones publicadas desde /admin (el archivo completo sigue en Vercel Blob).
create table if not exists catalog_versions (
  pathname        text primary key,
  note            text,
  uploaded_at     timestamptz not null,
  courses_count   integer,
  is_current      boolean not null default false,
  synced_at       timestamptz not null default now()
);

-- Historial de cambios por registro (se genera al sincronizar cada versión del catálogo).
create table if not exists catalog_changes (
  id          bigint generated always as identity primary key,
  entity      text not null check (entity in ('course', 'institution', 'category')),
  entity_id   text not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  before      jsonb,
  after       jsonb,
  version     text,
  created_at  timestamptz not null default now()
);
create index if not exists catalog_changes_entity_idx on catalog_changes (entity, entity_id, created_at desc);

-- ─────────────────────── Diagnósticos "Mi ruta" ───────────────────────

create table if not exists profiles (
  id                text primary key,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  source            text not null check (source in ('cv', 'texto')),
  engine            text not null check (engine in ('ia', 'reglas')),
  objective         text not null,
  description       text,
  preferences       jsonb not null default '{}',
  first_name        text,
  last_name         text,
  email             text,
  phone             text,
  country           text,
  city              text,
  linkedin          text,
  current_position  text,
  current_company   text,
  headline          text,
  seniority         text,
  years_experience  integer,
  highest_degree    text,
  current_studies   text,
  certifications    text[] not null default '{}',
  languages         jsonb not null default '[]',
  tools             text[] not null default '{}',
  summary           text,
  strengths         text[] not null default '{}',
  gaps              text[] not null default '{}',
  target_role       text,
  target_areas      text[] not null default '{}',
  cv_blob_path      text,
  cv_file_name      text,
  cv_file_type      text,
  cv_file_size      integer,
  contact_ok        boolean not null default false,
  status            text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'descartado')),
  notes             text not null default '',
  analysis          jsonb not null,   -- extracción + evaluación + ruta completas
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);
create index if not exists profiles_created_idx on profiles (created_at desc);
create index if not exists profiles_email_idx on profiles (lower(email));
create index if not exists profiles_status_idx on profiles (status);

create table if not exists profile_education (
  profile_id    text not null references profiles(id) on delete cascade,
  position      integer not null,
  degree        text not null,
  field         text,
  institution   text,
  level         text,
  status        text,
  end_year      integer,
  primary key (profile_id, position)
);

create table if not exists profile_experience (
  profile_id    text not null references profiles(id) on delete cascade,
  position      integer not null,
  role          text not null,
  company       text,
  start_year    integer,
  end_year      integer,
  is_current    boolean not null default false,
  primary key (profile_id, position)
);

-- Puntajes: materias del catálogo (area), habilidades técnicas y blandas.
create table if not exists profile_scores (
  profile_id    text not null references profiles(id) on delete cascade,
  kind          text not null check (kind in ('area', 'tecnica', 'blanda')),
  name          text not null,
  category_id   text,
  score         integer not null check (score between 0 and 100),
  level         text not null,
  evidence      text,
  primary key (profile_id, kind, name)
);
create index if not exists profile_scores_area_idx on profile_scores (kind, category_id, score);

-- Ruta sugerida: etapa y programas recomendados.
create table if not exists profile_route_courses (
  profile_id    text not null references profiles(id) on delete cascade,
  stage         integer not null,
  stage_title   text not null,
  position      integer not null,
  course_id     text not null,   -- sin FK: el programa puede salir del catálogo y la ruta se conserva
  primary key (profile_id, stage, position)
);
create index if not exists profile_route_course_idx on profile_route_courses (course_id);

-- ───────────────────────────── Leads ─────────────────────────────

create table if not exists leads (
  id                text primary key,
  created_at        timestamptz not null,
  updated_at        timestamptz,
  course_id         text,
  course_name       text not null,
  institution_id    text,
  institution_name  text,
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  whatsapp          text,
  country           text,
  start_timeline    text,
  objective         text,
  consent           boolean not null default false,
  source            text,
  page_url          text,
  campaign          text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_term          text,
  utm_content       text,
  referrer          text,
  lead_score        integer,
  lead_tier         text,
  lead_segment      text,
  status            text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'enviado', 'matriculado', 'descartado')),
  notes             text not null default '',
  profile_id        text references profiles(id) on delete set null,
  blob_path         text,
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_course_idx on leads (course_id);
create index if not exists leads_institution_idx on leads (institution_id, created_at desc);
create index if not exists leads_email_idx on leads (lower(email));

-- ───────────────────────────── Reseñas ─────────────────────────────

create table if not exists reviews (
  id                text primary key,
  created_at        timestamptz not null,
  course_id         text not null,
  course_name       text,
  institution_id    text,
  institution_name  text,
  rating            smallint not null check (rating between 1 and 5),
  title             text,
  comment           text not null,
  relationship      text,
  author_name       text,
  author_email      text,
  status            text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  reply             text,
  rejection_reason  text,
  moderated_at      timestamptz,
  page_url          text,
  blob_path         text,
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);
create index if not exists reviews_course_idx on reviews (course_id, status);
create index if not exists reviews_institution_idx on reviews (institution_id, status);

-- Valoraciones calculadas (solo reseñas aprobadas).
create or replace view course_ratings with (security_invoker = true) as
  select course_id,
         max(institution_id) as institution_id,
         round(avg(rating)::numeric, 2) as avg_rating,
         count(*)::int as reviews_count
  from reviews where status = 'aprobada'
  group by course_id;

create or replace view institution_ratings with (security_invoker = true) as
  select institution_id,
         round(avg(rating)::numeric, 2) as avg_rating,
         count(*)::int as reviews_count
  from reviews where status = 'aprobada' and institution_id is not null
  group by institution_id;

-- ─────────────────────────── Operación ───────────────────────────

create table if not exists sync_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  trigger       text not null,
  stats         jsonb,
  error         text
);

-- ───────────────────────── Seguridad (RLS) ─────────────────────────

alter table categories            enable row level security;
alter table institutions          enable row level security;
alter table courses               enable row level security;
alter table catalog_versions      enable row level security;
alter table catalog_changes       enable row level security;
alter table profiles              enable row level security;
alter table profile_education     enable row level security;
alter table profile_experience    enable row level security;
alter table profile_scores        enable row level security;
alter table profile_route_courses enable row level security;
alter table leads                 enable row level security;
alter table reviews               enable row level security;
alter table sync_runs             enable row level security;
