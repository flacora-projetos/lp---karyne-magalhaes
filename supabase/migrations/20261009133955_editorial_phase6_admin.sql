begin;

-- Fase 6: operacao editorial privada no admin. Tudo permanece server-only.
alter table public.editorial_drafts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_error_code text,
  add column if not exists promoted_article_id uuid references public.editorial_articles(id) on delete set null,
  add column if not exists promoted_version_id uuid references public.editorial_versions(id) on delete set null;

alter table public.editorial_drafts drop constraint if exists editorial_drafts_status_check;
alter table public.editorial_drafts
  add constraint editorial_drafts_status_check check (status in ('generating','draft','failed','uncertain'));

alter table public.editorial_reviews
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists recorded_by_user_id uuid references auth.users(id) on delete set null;

alter table public.editorial_gsc_runs
  add column if not exists trigger_source text check (trigger_source is null or trigger_source in ('scheduled','manual')),
  add column if not exists triggered_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.editorial_admin_audit (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  operation_type text not null check (operation_type in ('promote_draft','save_version','record_review','automation_control')),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null,
  target_id text,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.editorial_automation_control (
  automation_key text primary key check (automation_key in ('gsc')),
  operator_paused boolean not null default false,
  pause_reason text,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0)
);

insert into public.editorial_automation_control(automation_key, operator_paused)
values ('gsc', false)
on conflict (automation_key) do nothing;

alter table public.editorial_admin_audit enable row level security;
alter table public.editorial_automation_control enable row level security;
revoke all on public.editorial_admin_audit, public.editorial_automation_control from public, anon, authenticated;
grant select, insert, update on public.editorial_admin_audit, public.editorial_automation_control to service_role;

create or replace function public.editorial_phase6_promote_draft(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_draft_operation uuid := (p_input->>'draftOperationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_article uuid := (p_input->>'articleId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_existing public.editorial_admin_audit%rowtype;
  v_draft public.editorial_drafts%rowtype;
  v_version uuid;
begin
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;

  select * into v_draft from public.editorial_drafts where operation_key=v_draft_operation for update;
  if v_draft.operation_key is null then raise exception 'rascunho nao encontrado'; end if;
  if v_draft.status <> 'draft' then raise exception 'rascunho ainda nao esta pronto para promocao'; end if;
  if v_draft.promoted_version_id is not null then
    return jsonb_build_object('articleId',v_draft.promoted_article_id,'versionId',v_draft.promoted_version_id,'versionNumber',1,'reused',true);
  end if;
  if exists(select 1 from public.editorial_articles where target_slug=p_input->>'targetSlug') then
    raise exception 'slug ja pertence a outro artigo';
  end if;

  insert into public.editorial_articles(id,source_id,working_title,target_slug,topic_cluster,primary_search_intent,service_relation,status,updated_at)
  values(v_article,v_draft.source_id,p_input->>'title',p_input->>'targetSlug',nullif(p_input->>'topicCluster',''),nullif(p_input->>'searchIntent',''),nullif(p_input->>'serviceRelation',''),'revisao_editorial',now());

  insert into public.editorial_versions(article_id,version_number,title,description,body_json,references_json,change_note,created_by,
    content_payload_json,content_sha256,presentation_payload_json,presentation_sha256,payload_schema_version)
  values(v_article,1,p_input->>'title',p_input->>'description',p_input->'body',coalesce(p_input->'references','[]'::jsonb),'Promovido de rascunho de IA',v_actor::text,
    p_input->'contentPayload',p_input->>'contentSha256',p_input->'presentationPayload',p_input->>'presentationSha256',1)
  returning id into v_version;

  insert into public.editorial_article_sources(article_id,source_id,source_role,source_order)
  values(v_article,v_draft.source_id,'primary',1)
  on conflict(article_id,source_id) do nothing;

  update public.editorial_drafts set promoted_article_id=v_article,promoted_version_id=v_version,updated_at=now()
  where operation_key=v_draft_operation;

  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'promote_draft',v_request_sha,v_actor,'article',v_article::text,
    jsonb_build_object('articleId',v_article,'versionId',v_version,'versionNumber',1,'reused',false));
  return jsonb_build_object('articleId',v_article,'versionId',v_version,'versionNumber',1,'reused',false);
end $$;

create or replace function public.editorial_phase6_save_version(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_article_id uuid := (p_input->>'articleId')::uuid;
  v_expected_id uuid := (p_input->>'expectedVersionId')::uuid;
  v_expected_number integer := (p_input->>'expectedVersionNumber')::integer;
  v_request_sha text := p_input->>'requestSha256';
  v_existing public.editorial_admin_audit%rowtype;
  v_article public.editorial_articles%rowtype;
  v_latest public.editorial_versions%rowtype;
  v_version uuid;
  v_next integer;
begin
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;

  select * into v_article from public.editorial_articles where id=v_article_id for update;
  if v_article.id is null then raise exception 'artigo nao encontrado'; end if;
  select * into v_latest from public.editorial_versions where article_id=v_article_id order by version_number desc limit 1 for update;
  if v_latest.id is null or v_latest.id <> v_expected_id or v_latest.version_number <> v_expected_number then
    raise exception 'conflito de versao; recarregue antes de salvar';
  end if;
  if p_input->>'targetSlug' <> v_article.target_slug then raise exception 'slug do artigo nao pode ser alterado nesta operacao'; end if;
  v_next := v_latest.version_number + 1;

  insert into public.editorial_versions(article_id,version_number,title,description,body_json,references_json,change_note,created_by,
    content_payload_json,content_sha256,presentation_payload_json,presentation_sha256,payload_schema_version)
  values(v_article_id,v_next,p_input->>'title',p_input->>'description',p_input->'body',coalesce(p_input->'references','[]'::jsonb),nullif(p_input->>'changeNote',''),v_actor::text,
    p_input->'contentPayload',p_input->>'contentSha256',p_input->'presentationPayload',p_input->>'presentationSha256',1)
  returning id into v_version;

  update public.editorial_articles set working_title=p_input->>'title',status='revisao_editorial',updated_at=now() where id=v_article_id;

  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'save_version',v_request_sha,v_actor,'article_version',v_version::text,
    jsonb_build_object('articleId',v_article_id,'versionId',v_version,'versionNumber',v_next));
  return jsonb_build_object('articleId',v_article_id,'versionId',v_version,'versionNumber',v_next);
end $$;

create or replace function public.editorial_phase6_record_review(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_version_id uuid := (p_input->>'versionId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_existing public.editorial_admin_audit%rowtype;
  v_version public.editorial_versions%rowtype;
  v_latest public.editorial_versions%rowtype;
  v_review_id uuid;
  v_editorial text;
  v_clinical text;
  v_article_status text;
begin
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;

  select * into v_version from public.editorial_versions where id=v_version_id for update;
  if v_version.id is null then raise exception 'versao nao encontrada'; end if;
  select * into v_latest from public.editorial_versions where article_id=v_version.article_id order by version_number desc limit 1;
  if v_latest.id <> v_version.id then raise exception 'somente a versao de trabalho atual pode ser revisada'; end if;
  if v_version.content_sha256 <> p_input->>'contentSha256' or v_version.presentation_sha256 <> p_input->>'presentationSha256' then
    raise exception 'hashes da revisao nao correspondem a versao atual';
  end if;
  if p_input->>'reviewType' not in ('editorial','clinical') then raise exception 'tipo de revisao invalido'; end if;
  if p_input->>'decision' not in ('approved','changes_requested') then raise exception 'decisao invalida'; end if;
  if p_input->>'decision'='changes_requested' and length(trim(coalesce(p_input->>'notes',''))) < 3 then raise exception 'comentario obrigatorio para solicitar correcao'; end if;
  if p_input->>'reviewType'='clinical' and p_input->>'decision'='approved' and length(trim(coalesce(p_input->>'reviewerName',''))) < 3 then raise exception 'responsavel clinico deve ser identificado'; end if;

  insert into public.editorial_reviews(article_version_id,review_type,reviewer_name,status,notes,reviewed_at,content_sha256,presentation_sha256,evidence_json,recorded_by_user_id)
  values(v_version.id,p_input->>'reviewType',nullif(p_input->>'reviewerName',''),p_input->>'decision',nullif(p_input->>'notes',''),clock_timestamp(),
    v_version.content_sha256,v_version.presentation_sha256,coalesce(p_input->'evidence','{}'::jsonb),v_actor)
  returning id into v_review_id;

  select r.status into v_editorial from public.editorial_reviews r
    where r.article_version_id=v_version.id and r.review_type='editorial'
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  select r.status into v_clinical from public.editorial_reviews r
    where r.article_version_id=v_version.id and r.review_type='clinical'
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;

  if v_editorial='approved' and v_clinical='approved' then v_article_status := 'aprovado';
  elsif v_editorial='approved' then v_article_status := 'revisao_clinica';
  else v_article_status := 'revisao_editorial'; end if;
  update public.editorial_articles set status=v_article_status,updated_at=now() where id=v_version.article_id;

  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'record_review',v_request_sha,v_actor,'editorial_review',v_review_id::text,
    jsonb_build_object('reviewId',v_review_id,'articleId',v_version.article_id,'versionId',v_version.id,'articleStatus',v_article_status));
  return jsonb_build_object('reviewId',v_review_id,'articleId',v_version.article_id,'versionId',v_version.id,'articleStatus',v_article_status);
end $$;

create or replace function public.editorial_phase6_set_automation(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_expected integer := (p_input->>'expectedRevision')::integer;
  v_existing public.editorial_admin_audit%rowtype;
  v_control public.editorial_automation_control%rowtype;
begin
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;
  select * into v_control from public.editorial_automation_control where automation_key='gsc' for update;
  if v_control.revision <> v_expected then raise exception 'controle de automacao mudou; recarregue antes de salvar'; end if;
  if (p_input->>'paused')::boolean and length(trim(coalesce(p_input->>'reason',''))) < 3 then raise exception 'motivo obrigatorio ao pausar'; end if;

  update public.editorial_automation_control set
    operator_paused=(p_input->>'paused')::boolean,
    pause_reason=case when (p_input->>'paused')::boolean then p_input->>'reason' else null end,
    changed_by_user_id=v_actor,changed_at=clock_timestamp(),revision=revision+1
  where automation_key='gsc' returning * into v_control;

  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'automation_control',v_request_sha,v_actor,'automation','gsc',
    jsonb_build_object('automationKey','gsc','operatorPaused',v_control.operator_paused,'pauseReason',v_control.pause_reason,'changedAt',v_control.changed_at,'revision',v_control.revision));
  return jsonb_build_object('automationKey','gsc','operatorPaused',v_control.operator_paused,'pauseReason',v_control.pause_reason,'changedAt',v_control.changed_at,'revision',v_control.revision);
end $$;

-- A confirmacao da Fase 5 passa a considerar a decisao MAIS RECENTE de cada tipo.
-- Assim, uma solicitacao posterior de correcao revoga elegibilidade sem apagar historico.
create or replace function public.editorial_confirm_gsc_publication(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  publication public.editorial_publications%rowtype;
  confirmed_at timestamptz := clock_timestamp();
  article_uuid uuid := (p_input->>'articleId')::uuid;
  version_uuid uuid := (p_input->>'articleVersionId')::uuid;
  editorial_status text;
  clinical_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_input->>'url',0));
  select r.status into editorial_status from public.editorial_reviews r
    where r.article_version_id=version_uuid and r.review_type='editorial'
      and r.content_sha256=p_input->>'contentSha256' and r.presentation_sha256=p_input->>'presentationSha256'
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  select r.status into clinical_status from public.editorial_reviews r
    where r.article_version_id=version_uuid and r.review_type='clinical'
      and r.content_sha256=p_input->>'contentSha256' and r.presentation_sha256=p_input->>'presentationSha256'
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  if editorial_status <> 'approved' or clinical_status <> 'approved' then raise exception 'Aprovacoes atuais da versao exata ausentes'; end if;
  if not exists(select 1 from public.editorial_versions v join public.editorial_articles a on a.id=v.article_id
    where v.id=version_uuid and a.id=article_uuid and a.status in ('aprovado','publicado')
      and v.content_sha256=p_input->>'contentSha256' and v.presentation_sha256=p_input->>'presentationSha256') then
    raise exception 'Versao/artigo nao elegivel para publicacao';
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

revoke all on function public.editorial_phase6_promote_draft(jsonb), public.editorial_phase6_save_version(jsonb),
  public.editorial_phase6_record_review(jsonb), public.editorial_phase6_set_automation(jsonb) from public, anon, authenticated;
grant execute on function public.editorial_phase6_promote_draft(jsonb), public.editorial_phase6_save_version(jsonb),
  public.editorial_phase6_record_review(jsonb), public.editorial_phase6_set_automation(jsonb) to service_role;

commit;
