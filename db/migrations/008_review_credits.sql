-- Créditos de descuento de Groulevel Reviews (reemplazan el pago en efectivo):
--   · S/ 100 por cada reseña (publicada y verificada) y S/ 100 por cada persona referida que publique su reseña.
--   · El saldo se canjea como descuento adicional en un programa elegido: máximo S/ 300 por programa.

-- Código de referido de cada persona y quién la invitó (primer referido válido).
alter table reviewers add column if not exists ref_code text;
create unique index if not exists reviewers_ref_code_uniq on reviewers (ref_code) where ref_code is not null;
alter table reviewers add column if not exists referred_by text;

-- Nuevos tipos de crédito: por reseña y por referido (los anteriores se conservan como historial).
alter table review_incentives drop constraint if exists review_incentives_kind_check;
alter table review_incentives add constraint review_incentives_kind_check check (kind in ('institucion', 'programa', 'resena', 'referido'));
alter table review_incentives add column if not exists referred_user_id text;
drop index if exists review_incentives_once_uniq;
-- Un crédito por reseña y uno por persona referida.
create unique index if not exists review_incentives_review_uniq on review_incentives (review_id) where kind = 'resena' and status <> 'rechazado';
create unique index if not exists review_incentives_referral_uniq on review_incentives (referred_user_id) where kind = 'referido' and status <> 'rechazado';

-- Canjes: descuento aplicado a un programa con un código que valida la institución.
create table if not exists credit_redemptions (
  id                bigint generated always as identity primary key,
  code              text not null unique,
  user_id           text not null,
  course_id         text not null,
  course_name       text not null,
  institution_id    text not null,
  institution_name  text not null,
  amount            numeric(10, 2) not null check (amount > 0),
  status            text not null default 'solicitado' check (status in ('solicitado', 'aplicado', 'anulado')),
  note              text,
  created_at        timestamptz not null default now(),
  decided_at        timestamptz
);
create index if not exists credit_redemptions_user_idx on credit_redemptions (user_id, course_id);
alter table credit_redemptions enable row level security;
