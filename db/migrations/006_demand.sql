-- Demanda: contadores diarios anónimos por programa/institución y por origen (sin datos personales ni IP).
create table if not exists demand_daily (
  day             date not null,
  event           text not null check (event in ('view', 'compare', 'favorite', 'outbound', 'lead_open', 'lead', 'share', 'institution_view')),
  course_id       text not null default '',
  institution_id  text not null default '',
  channel         text not null,          -- Búsqueda orgánica | Pago | Redes sociales | Email | Referido | Directo
  source          text not null default '',  -- google, facebook.com, newsletter…
  campaign        text not null default '',
  country         text not null default '',
  city            text not null default '',
  device          text not null default '',  -- móvil | escritorio | tablet
  count           integer not null default 0,
  primary key (day, event, course_id, institution_id, channel, source, campaign, country, city, device)
);
create index if not exists demand_daily_course_idx on demand_daily (course_id, day);
create index if not exists demand_daily_institution_idx on demand_daily (institution_id, day);

alter table demand_daily enable row level security;
