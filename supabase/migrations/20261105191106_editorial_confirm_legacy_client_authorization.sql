create or replace function public.editorial_confirm_gsc_publication(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  publication public.editorial_publications%rowtype;
  confirmed_at timestamptz := clock_timestamp();
  article_uuid uuid := (p_input->>'articleId')::uuid;
  version_uuid uuid := (p_input->>'articleVersionId')::uuid;
  editorial_status text;
  clinical_status text;
  client_authorized boolean := false;
begin
  perform 1 from public.editorial_articles where id=article_uuid for update;
  perform pg_advisory_xact_lock(hashtextextended(p_input->>'url',0));
  select r.status into editorial_status from public.editorial_reviews r
    where r.article_version_id=version_uuid and r.review_type='editorial'
      and r.content_sha256=p_input->>'contentSha256' and r.presentation_sha256=p_input->>'presentationSha256'
      and r.reviewed_at is not null
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  select r.status into clinical_status from public.editorial_reviews r
    where r.article_version_id=version_uuid and r.review_type='clinical'
      and r.content_sha256=p_input->>'contentSha256' and r.presentation_sha256=p_input->>'presentationSha256'
      and r.reviewed_at is not null
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  if editorial_status='approved' and clinical_status is distinct from 'approved'
    and clinical_status is distinct from 'changes_requested' then
    select exists (
    select 1
    from public.editorial_publication_operations op
    join public.editorial_versions v on v.id=op.article_version_id and v.article_id=op.article_id
    join public.editorial_legacy_client_authorizations client_scope on client_scope.article_version_id=v.id
    where op.article_id=article_uuid and v.id=version_uuid and v.version_number=1
      and op.status in ('verifying','uncertain','published') and op.trigger_kind='manual'
      and op.snapshot_json #>> '{article,approval,clinicalAuthorization}'='karyne-legacy-2026-11-05'
      and op.snapshot_json #>> '{article,approval,clinical}'='false'
      and client_scope.recorded_at is not null
      and client_scope.content_sha256=v.content_sha256 and client_scope.presentation_sha256=v.presentation_sha256
      and op.content_sha256=v.content_sha256 and op.presentation_sha256=v.presentation_sha256
      and op.content_sha256=p_input->>'contentSha256' and op.presentation_sha256=p_input->>'presentationSha256'
      and op.operation_key=p_input->>'operationKey' and op.release_sha256=p_input->>'releaseSha256'
      and op.expected_html_sha256=p_input->>'htmlSha256'
      and op.github_pr_number::text=p_input #>> '{verification,github_pr_number}'
      and op.github_merge_sha=p_input #>> '{verification,github_merge_sha}'
      and p_input #>> '{verification,vercel_deployment_id}' ~ '^dpl_[A-Za-z0-9]+$'
      and p_input #>> '{verification,sitemap_present}'='true'
      and p_input->>'url'=p_input #>> '{verification,canonical_url}'
      and p_input->>'url'='https://tratamentodomauhalito.com.br/blog/' || (op.snapshot_json #>> '{article,slug}') || '/'
    ) into client_authorized;
  end if;
  if editorial_status is distinct from 'approved' or (clinical_status is distinct from 'approved' and not client_authorized) then
    raise exception 'Aprovacoes atuais da versao exata ausentes';
  end if;
  if not exists(select 1 from public.editorial_versions v join public.editorial_articles a on a.id=v.article_id
    where v.id=version_uuid and a.id=article_uuid and (a.status in ('aprovado','publicado') or (client_authorized and a.status='revisao_clinica'))
      and v.content_sha256=p_input->>'contentSha256' and v.presentation_sha256=p_input->>'presentationSha256') then
    raise exception 'Versao/artigo nao elegivel para publicacao';
  end if;
  if version_uuid is distinct from (select id from public.editorial_versions where article_id=article_uuid order by version_number desc limit 1) then
    raise exception 'Versao de trabalho superada';
  end if;

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
