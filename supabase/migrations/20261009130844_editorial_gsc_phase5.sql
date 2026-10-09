begin;

create table if not exists public.editorial_gsc_state (
  site_url text primary key,
  sitemap_url text not null,
  last_confirmed_sitemap_sha256 text,
  last_submit_attempt_sha256 text,
  last_submit_status text not null default 'baseline_required'
    check (last_submit_status in ('baseline_required','unchanged','confirmed','failed_transient','blocked','uncertain')),
  last_submit_attempt_at timestamptz,
  last_submit_confirmed_at timestamptz,
  last_google_submitted_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  updated_at timestamptz not null default now(),
  check (last_confirmed_sitemap_sha256 is null or last_confirmed_sitemap_sha256 ~ '^[0-9a-f]{64}$'),
  check (last_submit_attempt_sha256 is null or last_submit_attempt_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists public.editorial_gsc_urls (
  publication_id uuid primary key references public.editorial_publications(id) on delete cascade,
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  article_version_id uuid not null references public.editorial_versions(id) on delete restrict,
  release_sha256 text,
  url text not null unique,
  publication_confirmed_at timestamptz not null,
  first_tracked_at timestamptz not null default now(),
  last_inspected_at timestamptz,
  next_inspection_at timestamptz not null default now(),
  inspection_count integer not null default 0 check (inspection_count >= 0),
  verdict text,
  coverage_state text,
  robots_txt_state text,
  indexing_state text,
  page_fetch_state text,
  last_crawl_time timestamptz,
  google_canonical text,
  user_canonical text,
  knowledge_state text not null default 'inconclusive'
    check (knowledge_state in ('indexed','excluded','unknown_to_google','inconclusive')),
  action_state text not null default 'waiting'
    check (action_state in ('waiting','stable','action_required','inconclusive')),
  action_reason text,
  action_due_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists editorial_gsc_urls_next_inspection_idx
  on public.editorial_gsc_urls(next_inspection_at);
create index if not exists editorial_gsc_urls_action_state_idx
  on public.editorial_gsc_urls(action_state, action_due_at);

create table if not exists public.editorial_gsc_runs (
  operation_key text primary key,
  run_kind text not null check (run_kind in ('daily','sitemap_submit','baseline')),
  status text not null check (status in ('running','succeeded','failed','blocked','uncertain','skipped')),
  lease_token uuid not null,
  lease_until timestamptz not null,
  attempts integer not null default 1 check (attempts between 1 and 2),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  details_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.editorial_gsc_state enable row level security;
alter table public.editorial_gsc_urls enable row level security;
alter table public.editorial_gsc_runs enable row level security;

revoke all on public.editorial_gsc_state, public.editorial_gsc_urls, public.editorial_gsc_runs
  from public, anon, authenticated;
grant select, insert, update, delete on public.editorial_gsc_state, public.editorial_gsc_urls, public.editorial_gsc_runs
  to service_role;

create or replace function public.editorial_sync_gsc_url(p_publication_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  publication public.editorial_publications%rowtype;
  tracked public.editorial_gsc_urls%rowtype;
begin
  select * into publication from public.editorial_publications where id=p_publication_id for update;
  if publication.id is null or publication.publication_status <> 'published' or publication.last_verified_at is null then
    return false;
  end if;
  select * into tracked from public.editorial_gsc_urls where publication_id=publication.id for update;
  if tracked.publication_id is not null and tracked.article_version_id=publication.article_version_id
    and tracked.release_sha256 is not distinct from publication.release_sha256
    and tracked.url=publication.canonical_url then return false; end if;

  if tracked.publication_id is not null then
    insert into public.editorial_publication_events(article_id,article_version_id,event_type,operation_key,url,content_sha256,presentation_sha256,release_sha256,details_json)
    values(publication.article_id,publication.article_version_id,'superseded',
      'gsc-reset:' || publication.id || ':' || publication.last_verified_at,
      publication.url,publication.content_sha256,publication.presentation_sha256,publication.release_sha256,
      jsonb_build_object('previous_gsc',to_jsonb(tracked))) on conflict(operation_key) do nothing;
  end if;

  insert into public.editorial_gsc_urls(publication_id,article_id,article_version_id,release_sha256,url,publication_confirmed_at,next_inspection_at)
  values(publication.id,publication.article_id,publication.article_version_id,publication.release_sha256,publication.canonical_url,publication.last_verified_at,now())
  on conflict(publication_id) do update set
    article_id=excluded.article_id,article_version_id=excluded.article_version_id,release_sha256=excluded.release_sha256,url=excluded.url,
    publication_confirmed_at=excluded.publication_confirmed_at,next_inspection_at=excluded.next_inspection_at,
    last_inspected_at=null,inspection_count=0,verdict=null,coverage_state=null,robots_txt_state=null,indexing_state=null,page_fetch_state=null,
    last_crawl_time=null,google_canonical=null,user_canonical=null,knowledge_state='inconclusive',action_state='waiting',action_reason=null,action_due_at=null,
    last_error_code=null,last_error_at=null,updated_at=now();
  return true;
end $$;

create or replace function public.editorial_confirm_gsc_publication(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  publication public.editorial_publications%rowtype;
  confirmed_at timestamptz := now();
  article_uuid uuid := (p_input->>'articleId')::uuid;
  version_uuid uuid := (p_input->>'articleVersionId')::uuid;
  approval_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_input->>'url',0));
  select count(distinct r.review_type) into approval_count
  from public.editorial_versions v join public.editorial_articles a on a.id=v.article_id
  join public.editorial_reviews r on r.article_version_id=v.id
  where v.id=version_uuid and a.id=article_uuid and a.status in ('aprovado','publicado')
    and v.content_sha256=p_input->>'contentSha256' and v.presentation_sha256=p_input->>'presentationSha256'
    and r.review_type in ('editorial','clinical') and r.status='approved' and r.reviewed_at is not null
    and r.content_sha256=v.content_sha256 and r.presentation_sha256=v.presentation_sha256;
  if approval_count <> 2 then raise exception 'Aprovações da versão exata ausentes'; end if;
  select * into publication from public.editorial_publications where url=p_input->>'url' for update;
  if publication.id is not null and publication.article_id <> article_uuid then raise exception 'URL pertence a outro artigo'; end if;
  if publication.id is not null and publication.publication_status='published'
    and publication.article_version_id=version_uuid and publication.operation_key=p_input->>'operationKey'
    and publication.release_sha256=p_input->>'releaseSha256' and publication.verification_json->>'html_sha256'=p_input->>'htmlSha256'
    and publication.last_verified_at is not null then
    perform public.editorial_sync_gsc_url(publication.id);
    return publication.id;
  end if;

  insert into public.editorial_publications(article_id,article_version_id,url,canonical_url,publication_status,published_at,modified_at,last_verified_at,
    content_sha256,presentation_sha256,release_sha256,operation_key,verification_json)
  values(article_uuid,version_uuid,p_input->>'url',p_input->>'url','published',coalesce(publication.published_at,confirmed_at),confirmed_at,confirmed_at,
    p_input->>'contentSha256',p_input->>'presentationSha256',p_input->>'releaseSha256',p_input->>'operationKey',
    coalesce(publication.verification_json,'{}'::jsonb) || coalesce(p_input->'verification','{}'::jsonb) ||
      jsonb_build_object('html_sha256',p_input->>'htmlSha256','verified_at',confirmed_at))
  on conflict(url) do update set
    article_version_id=excluded.article_version_id,canonical_url=excluded.canonical_url,publication_status=excluded.publication_status,
    modified_at=excluded.modified_at,last_verified_at=excluded.last_verified_at,content_sha256=excluded.content_sha256,
    presentation_sha256=excluded.presentation_sha256,release_sha256=excluded.release_sha256,operation_key=excluded.operation_key,verification_json=excluded.verification_json
  returning * into publication;
  update public.editorial_articles set status='publicado',updated_at=confirmed_at where id=article_uuid;
  insert into public.editorial_publication_events(article_id,article_version_id,event_type,operation_key,url,content_sha256,presentation_sha256,release_sha256,details_json)
  values(article_uuid,version_uuid,'verified','verify:' || (p_input->>'operationKey') || ':' || (p_input->>'htmlSha256'),
    publication.url,publication.content_sha256,publication.presentation_sha256,publication.release_sha256,
    jsonb_build_object('html_sha256',p_input->>'htmlSha256','verified_at',confirmed_at,'prepared_operation_key',p_input->>'operationKey'))
  on conflict(operation_key) do nothing;
  perform public.editorial_sync_gsc_url(publication.id);
  return publication.id;
end $$;

revoke all on function public.editorial_sync_gsc_url(uuid), public.editorial_confirm_gsc_publication(jsonb) from public, anon, authenticated;
grant execute on function public.editorial_sync_gsc_url(uuid), public.editorial_confirm_gsc_publication(jsonb) to service_role;

commit;
