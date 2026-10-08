-- Modelo editorial privado; publicação estática usa apenas as versões aprovadas.
-- Sem policies públicas: rascunhos/fontes permanecem privados; service role é a via futura de automação governada.

create table if not exists public.editorial_sources (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_id text,
  source_url text,
  captured_at timestamptz not null default now(),
  published_at_source timestamptz,
  modified_at_source timestamptz,
  raw_sha256 text,
  metadata_json jsonb not null default '{}'::jsonb,
  unique (source_system, external_id)
);

create table if not exists public.editorial_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.editorial_sources(id) on delete set null,
  working_title text not null,
  target_slug text unique not null,
  topic_cluster text,
  primary_search_intent text,
  service_relation text,
  status text not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_articles_status_check check (status in ('inventario','briefing','rascunho','revisao_editorial','revisao_clinica','aprovado','publicado','arquivado'))
);

create table if not exists public.editorial_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  description text,
  body_json jsonb not null,
  references_json jsonb not null default '[]'::jsonb,
  change_note text,
  created_at timestamptz not null default now(),
  created_by text,
  unique (article_id, version_number)
);

create table if not exists public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  article_version_id uuid not null references public.editorial_versions(id) on delete cascade,
  review_type text not null check (review_type in ('editorial','clinical','client')),
  reviewer_name text,
  status text not null default 'pending' check (status in ('pending','changes_requested','approved')),
  notes text,
  reviewed_at timestamptz
);

create table if not exists public.editorial_publications (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  article_version_id uuid not null references public.editorial_versions(id) on delete restrict,
  url text not null unique,
  canonical_url text not null,
  published_at timestamptz,
  modified_at timestamptz,
  publication_status text not null default 'pending' check (publication_status in ('pending','published','failed','withdrawn')),
  last_verified_at timestamptz
);

alter table public.editorial_sources enable row level security;
alter table public.editorial_articles enable row level security;
alter table public.editorial_versions enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.editorial_publications enable row level security;

revoke all on public.editorial_sources, public.editorial_articles, public.editorial_versions,
  public.editorial_reviews, public.editorial_publications from anon, authenticated;
grant select, insert, update, delete on public.editorial_sources, public.editorial_articles,
  public.editorial_versions, public.editorial_reviews, public.editorial_publications to service_role;
