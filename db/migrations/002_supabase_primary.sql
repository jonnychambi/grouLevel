-- Supabase pasa a ser la fuente principal de los datos.

-- Cada versión publicada del catálogo guarda su contenido completo (para listar y restaurar).
-- Las versiones antiguas importadas de Vercel Blob quedan con data = null y se leen de Blob al restaurarlas.
alter table catalog_versions add column if not exists data jsonb;
alter table catalog_versions add column if not exists size_bytes integer;

-- Orden original del catálogo (el sitio lo respeta al reconstruirlo desde las tablas).
alter table institutions add column if not exists position integer not null default 0;
alter table courses add column if not exists position integer not null default 0;

-- Una reseña por persona (email) y programa.
create unique index if not exists reviews_course_email_uniq on reviews (course_id, lower(author_email));

-- Una sola versión vigente.
create unique index if not exists catalog_versions_current_uniq on catalog_versions (is_current) where is_current;

-- Listados del administrador.
create index if not exists reviews_created_idx on reviews (created_at desc);
