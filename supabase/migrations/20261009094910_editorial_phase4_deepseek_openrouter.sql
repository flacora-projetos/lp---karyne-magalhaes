begin;

alter table public.editorial_sources
  add column if not exists source_slug text,
  add column if not exists source_title text,
  add column if not exists normalized_excerpt text,
  add column if not exists normalized_body_text text,
  add column if not exists normalized_payload_json jsonb not null default '{}'::jsonb,
  add column if not exists snapshot_run_id text;

create index if not exists editorial_sources_snapshot_run_id_idx
  on public.editorial_sources(snapshot_run_id);

create table if not exists public.editorial_article_sources (
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  source_id uuid not null references public.editorial_sources(id) on delete restrict,
  source_role text not null default 'supporting'
    check (source_role in ('primary', 'supporting', 'legacy_context')),
  source_order integer not null default 1 check (source_order > 0),
  created_at timestamptz not null default now(),
  primary key (article_id, source_id)
);

alter table public.editorial_versions
  add column if not exists content_payload_json jsonb,
  add column if not exists content_sha256 text,
  add column if not exists presentation_payload_json jsonb,
  add column if not exists presentation_sha256 text,
  add column if not exists payload_schema_version integer not null default 1;

alter table public.editorial_versions
  drop constraint if exists editorial_versions_content_sha256_format,
  add constraint editorial_versions_content_sha256_format
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  drop constraint if exists editorial_versions_presentation_sha256_format,
  add constraint editorial_versions_presentation_sha256_format
    check (presentation_sha256 is null or presentation_sha256 ~ '^[0-9a-f]{64}$');

alter table public.editorial_reviews
  add column if not exists content_sha256 text,
  add column if not exists presentation_sha256 text,
  add column if not exists evidence_json jsonb not null default '{}'::jsonb;

alter table public.editorial_reviews
  drop constraint if exists editorial_reviews_content_sha256_format,
  add constraint editorial_reviews_content_sha256_format
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  drop constraint if exists editorial_reviews_presentation_sha256_format,
  add constraint editorial_reviews_presentation_sha256_format
    check (presentation_sha256 is null or presentation_sha256 ~ '^[0-9a-f]{64}$');

alter table public.editorial_publications
  add column if not exists content_sha256 text,
  add column if not exists presentation_sha256 text,
  add column if not exists release_sha256 text,
  add column if not exists operation_key text,
  add column if not exists verification_json jsonb not null default '{}'::jsonb;

create unique index if not exists editorial_publications_operation_key_uidx
  on public.editorial_publications(operation_key)
  where operation_key is not null;

create table if not exists public.editorial_publication_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  article_version_id uuid not null references public.editorial_versions(id) on delete restrict,
  event_type text not null
    check (event_type in ('prepared', 'published', 'verified', 'failed', 'withdrawn', 'superseded')),
  operation_key text not null unique,
  url text,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  presentation_sha256 text not null check (presentation_sha256 ~ '^[0-9a-f]{64}$'),
  release_sha256 text not null check (release_sha256 ~ '^[0-9a-f]{64}$'),
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.editorial_article_sources enable row level security;
alter table public.editorial_publication_events enable row level security;

revoke all on public.editorial_article_sources from anon, authenticated;
revoke all on public.editorial_publication_events from anon, authenticated;
grant select, insert, update, delete on public.editorial_article_sources to service_role;
grant select, insert, update, delete on public.editorial_publication_events to service_role;


create unique index if not exists editorial_versions_id_article_id_uidx on public.editorial_versions(id,article_id);
alter table public.editorial_publication_events add constraint editorial_publication_events_version_article_fk foreign key (article_version_id,article_id) references public.editorial_versions(id,article_id);

create table public.editorial_drafts (
  operation_key uuid primary key,
  source_id uuid not null references public.editorial_sources(id) on delete restrict,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('generating','draft','failed')),
  payload_json jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (status <> 'draft' or coalesce(
    payload_json->'approval'->'clinical' = 'false'::jsonb and
    payload_json->'approval'->'editorial' = 'false'::jsonb and
    payload_json->'approval'->'client' = 'false'::jsonb and
    payload_json->'clinicalReviewPending' = 'true'::jsonb, false))
);
create index editorial_drafts_source_id_idx on public.editorial_drafts(source_id);
alter table public.editorial_drafts enable row level security;
revoke all on public.editorial_drafts from public, anon, authenticated;
grant select, insert, update on public.editorial_drafts to service_role;
commit;
