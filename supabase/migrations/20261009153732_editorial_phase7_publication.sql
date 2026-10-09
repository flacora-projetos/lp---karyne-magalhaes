begin;

-- Fase 7: intenção humana por versão, fila durável e trava global de publicação.
-- A automação nasce pausada. Nenhuma policy pública é criada.

alter table public.editorial_admin_audit
  drop constraint if exists editorial_admin_audit_operation_type_check;
alter table public.editorial_admin_audit
  add constraint editorial_admin_audit_operation_type_check check (operation_type in (
    'promote_draft','save_version','record_review','automation_control','export_snapshot',
    'publication_intent','publication_control','queue_publication','retry_publication'
  ));

create table if not exists public.editorial_publication_intents (
  article_version_id uuid primary key references public.editorial_versions(id) on delete cascade,
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  intent text not null check (intent in ('auto','hold')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  presentation_sha256 text not null check (presentation_sha256 ~ '^[0-9a-f]{64}$'),
  set_by_user_id uuid not null references auth.users(id) on delete restrict,
  set_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0)
);

create table if not exists public.editorial_publication_operations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  article_version_id uuid not null references public.editorial_versions(id) on delete restrict,
  operation_key text not null unique,
  trigger_kind text not null check (trigger_kind in ('auto_review','manual')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  presentation_sha256 text not null check (presentation_sha256 ~ '^[0-9a-f]{64}$'),
  release_sha256 text not null check (release_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_json jsonb not null,
  status text not null default 'queued' check (status in (
    'queued','dispatch_pending','dispatched','reserved','preparing','publishing','verifying',
    'published','blocked','failed','uncertain','cancelled'
  )),
  attempts integer not null default 0 check (attempts between 0 and 3),
  dispatch_attempts integer not null default 0 check (dispatch_attempts between 0 and 6),
  lease_token uuid,
  lease_until timestamptz,
  executor_run_id text,
  github_base_sha text,
  github_head_sha text,
  github_branch text,
  github_pr_number integer,
  github_merge_sha text,
  expected_html_sha256 text check (expected_html_sha256 is null or expected_html_sha256 ~ '^[0-9a-f]{64}$'),
  vercel_deployment_id text,
  vercel_deployment_url text,
  last_error_code text,
  last_error_detail text,
  result_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(article_version_id, release_sha256)
);

create index if not exists editorial_publication_operations_status_idx
  on public.editorial_publication_operations(status, updated_at);
create index if not exists editorial_publication_operations_article_idx
  on public.editorial_publication_operations(article_id, created_at desc);

alter table public.editorial_automation_control
  drop constraint if exists editorial_automation_control_automation_key_check;
alter table public.editorial_automation_control
  add constraint editorial_automation_control_automation_key_check check (automation_key in ('gsc','publication'));
alter table public.editorial_automation_control
  add column if not exists active_operation_id uuid references public.editorial_publication_operations(id) on delete set null;

insert into public.editorial_automation_control(automation_key, operator_paused, pause_reason)
values ('publication', true, 'Fase 7 instalada localmente; ativação exige GO separado')
on conflict (automation_key) do nothing;

alter table public.editorial_publication_intents enable row level security;
alter table public.editorial_publication_operations enable row level security;
revoke all on public.editorial_publication_intents, public.editorial_publication_operations from public, anon, authenticated;
grant select, insert, update, delete on public.editorial_publication_intents, public.editorial_publication_operations to service_role;

create or replace function public.editorial_phase7_create_operation(
  p_article_id uuid,
  p_version_id uuid,
  p_trigger_kind text,
  p_actor uuid,
  p_release_sha256 text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_version public.editorial_versions%rowtype;
  v_latest public.editorial_versions%rowtype;
  v_intent public.editorial_publication_intents%rowtype;
  v_editorial text;
  v_clinical text;
  v_operation public.editorial_publication_operations%rowtype;
  v_snapshot jsonb;
  v_operation_key text;
begin
  if p_trigger_kind not in ('auto_review','manual') then raise exception 'gatilho de publicacao invalido'; end if;
  if p_release_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'release hash invalido'; end if;

  perform 1 from public.editorial_articles where id=p_article_id for update;
  select * into v_version from public.editorial_versions where id=p_version_id and article_id=p_article_id;
  select * into v_latest from public.editorial_versions where article_id=p_article_id order by version_number desc limit 1 for update;
  if v_version.id is null or v_latest.id is distinct from v_version.id then raise exception 'versao de trabalho superada'; end if;
  if v_version.content_sha256 is null or v_version.presentation_sha256 is null or v_version.presentation_payload_json is null then
    raise exception 'versao sem hashes ou apresentacao';
  end if;
  if coalesce(v_version.presentation_payload_json->>'reviewStatus','') <> 'reviewed' then raise exception 'apresentacao ainda nao revisada'; end if;

  select r.status into v_editorial from public.editorial_reviews r
    where r.article_version_id=v_version.id and r.review_type='editorial'
      and r.content_sha256=v_version.content_sha256 and r.presentation_sha256=v_version.presentation_sha256
      and r.reviewed_at is not null
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  select r.status into v_clinical from public.editorial_reviews r
    where r.article_version_id=v_version.id and r.review_type='clinical'
      and r.content_sha256=v_version.content_sha256 and r.presentation_sha256=v_version.presentation_sha256
      and r.reviewed_at is not null
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  if v_editorial is distinct from 'approved' or v_clinical is distinct from 'approved' then raise exception 'aprovacoes atuais ausentes'; end if;

  if p_trigger_kind='auto_review' then
    select * into v_intent from public.editorial_publication_intents where article_version_id=v_version.id for update;
    if v_intent.article_version_id is null or v_intent.intent <> 'auto'
      or v_intent.content_sha256 <> v_version.content_sha256 or v_intent.presentation_sha256 <> v_version.presentation_sha256 then
      raise exception 'intencao automatica exata ausente';
    end if;
  end if;

  v_operation_key := 'publish:' || p_article_id::text || ':v' || v_version.version_number::text || ':' || p_release_sha256;
  v_snapshot := jsonb_build_object(
    'schemaVersion',1,
    'kind','karyne-blog-publication-snapshot',
    'articleId',p_article_id,
    'articleVersionId',v_version.id,
    'content_sha256',v_version.content_sha256,
    'presentation_sha256',v_version.presentation_sha256,
    'release_sha256',p_release_sha256,
    'article',v_version.content_payload_json || jsonb_build_object(
      'status','approved',
      'presentation',v_version.presentation_payload_json,
      'approval',jsonb_build_object(
        'version',v_version.version_number,
        'editorial',true,
        'clinical',true,
        'contentHash',v_version.content_sha256,
        'presentationHash',v_version.presentation_sha256,
        'releaseHash',p_release_sha256
      )
    )
  );

  insert into public.editorial_publication_operations(
    article_id,article_version_id,operation_key,trigger_kind,content_sha256,presentation_sha256,
    release_sha256,snapshot_json,created_by_user_id
  ) values (
    p_article_id,v_version.id,v_operation_key,p_trigger_kind,v_version.content_sha256,v_version.presentation_sha256,
    p_release_sha256,v_snapshot,p_actor
  ) on conflict(article_version_id,release_sha256) do update set updated_at=editorial_publication_operations.updated_at
  returning * into v_operation;
  return v_operation.id;
end $$;

create or replace function public.editorial_phase7_set_publish_intent(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_version_id uuid := (p_input->>'versionId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_intent text := p_input->>'intent';
  v_existing public.editorial_admin_audit%rowtype;
  v_version public.editorial_versions%rowtype;
  v_latest public.editorial_versions%rowtype;
  v_current public.editorial_publication_intents%rowtype;
  v_publication_operation uuid;
  v_editorial text;
  v_clinical text;
  v_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,7));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'publication_intent' then
      raise exception 'operation_key reutilizada com outra requisicao';
    end if;
    return v_existing.result_json;
  end if;
  if v_intent not in ('auto','hold') then raise exception 'intencao de publicacao invalida'; end if;
  select * into v_version from public.editorial_versions where id=v_version_id;
  if v_version.id is null then raise exception 'versao nao encontrada'; end if;
  perform 1 from public.editorial_articles where id=v_version.article_id for update;
  select * into v_latest from public.editorial_versions where article_id=v_version.article_id order by version_number desc limit 1 for update;
  if v_latest.id is distinct from v_version.id then raise exception 'versao de trabalho superada'; end if;
  if v_version.content_sha256 is distinct from p_input->>'contentSha256' or v_version.presentation_sha256 is distinct from p_input->>'presentationSha256' then
    raise exception 'hashes da intencao nao correspondem a versao';
  end if;

  if exists(select 1 from public.editorial_publication_operations where article_version_id=v_version.id and status in ('reserved','preparing','publishing','verifying','uncertain')) then
    raise exception 'publicacao ja entrou em etapa critica';
  end if;
  if v_intent='hold' then
    update public.editorial_publication_operations set status='cancelled',finished_at=clock_timestamp(),updated_at=clock_timestamp(),last_error_code='publication_intent_changed_to_hold'
      where article_version_id=v_version.id and status in ('queued','dispatch_pending','dispatched');
  end if;

  insert into public.editorial_publication_intents(article_version_id,article_id,intent,content_sha256,presentation_sha256,set_by_user_id,set_at,revision)
  values(v_version.id,v_version.article_id,v_intent,v_version.content_sha256,v_version.presentation_sha256,v_actor,clock_timestamp(),1)
  on conflict(article_version_id) do update set intent=excluded.intent,content_sha256=excluded.content_sha256,
    presentation_sha256=excluded.presentation_sha256,set_by_user_id=excluded.set_by_user_id,set_at=excluded.set_at,revision=editorial_publication_intents.revision+1
  returning * into v_current;

  if v_intent='auto' then
    select r.status into v_editorial from public.editorial_reviews r where r.article_version_id=v_version.id and r.review_type='editorial'
      and r.content_sha256=v_version.content_sha256 and r.presentation_sha256=v_version.presentation_sha256 and r.reviewed_at is not null
      order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
    select r.status into v_clinical from public.editorial_reviews r where r.article_version_id=v_version.id and r.review_type='clinical'
      and r.content_sha256=v_version.content_sha256 and r.presentation_sha256=v_version.presentation_sha256 and r.reviewed_at is not null
      order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
    if v_editorial='approved' and v_clinical='approved' then
      v_publication_operation := public.editorial_phase7_create_operation(v_version.article_id,v_version.id,'auto_review',v_actor,p_input->>'releaseSha256');
    end if;
  end if;
  select status into v_status from public.editorial_publication_operations where id=v_publication_operation;
  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'publication_intent',v_request_sha,v_actor,'article_version',v_version.id::text,
    jsonb_build_object('articleId',v_version.article_id,'versionId',v_version.id,'intent',v_current.intent,'revision',v_current.revision,'publicationOperationId',v_publication_operation,'publicationStatus',v_status));
  return jsonb_build_object('articleId',v_version.article_id,'versionId',v_version.id,'intent',v_current.intent,'revision',v_current.revision,'publicationOperationId',v_publication_operation,'publicationStatus',v_status);
end $$;

create or replace function public.editorial_phase7_record_review(p_input jsonb)
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
  v_intent public.editorial_publication_intents%rowtype;
  v_publication_operation uuid;
  v_publication_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,7));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'record_review' then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;
  select * into v_version from public.editorial_versions where id=v_version_id;
  if v_version.id is null then raise exception 'versao nao encontrada'; end if;
  perform 1 from public.editorial_articles where id=v_version.article_id for update;
  select * into v_latest from public.editorial_versions where article_id=v_version.article_id order by version_number desc limit 1 for update;
  if v_latest.id <> v_version.id then raise exception 'somente a versao de trabalho atual pode ser revisada'; end if;
  if v_version.content_sha256 is null or v_version.presentation_sha256 is null or v_version.content_sha256 is distinct from p_input->>'contentSha256' or v_version.presentation_sha256 is distinct from p_input->>'presentationSha256' then
    raise exception 'hashes da revisao nao correspondem a versao atual';
  end if;
  if p_input->>'reviewType' not in ('editorial','clinical') then raise exception 'tipo de revisao invalido'; end if;
  if p_input->>'decision' not in ('approved','changes_requested') then raise exception 'decisao invalida'; end if;
  if p_input->>'decision'='changes_requested' and length(trim(coalesce(p_input->>'notes',''))) < 3 then raise exception 'comentario obrigatorio para solicitar correcao'; end if;
  if p_input->>'reviewType'='clinical' and p_input->>'decision'='approved' and length(trim(coalesce(p_input->>'reviewerName',''))) < 3 then raise exception 'responsavel clinico deve ser identificado'; end if;
  if exists(select 1 from public.editorial_publication_operations where article_version_id=v_version.id and status in ('reserved','preparing','publishing','verifying','uncertain')) then
    raise exception 'publicacao ja entrou em etapa critica';
  end if;

  insert into public.editorial_reviews(article_version_id,review_type,reviewer_name,status,notes,reviewed_at,content_sha256,presentation_sha256,evidence_json,recorded_by_user_id)
  values(v_version.id,p_input->>'reviewType',nullif(p_input->>'reviewerName',''),p_input->>'decision',nullif(p_input->>'notes',''),clock_timestamp(),
    v_version.content_sha256,v_version.presentation_sha256,coalesce(p_input->'evidence','{}'::jsonb),v_actor)
  returning id into v_review_id;

  if p_input->>'decision'='changes_requested' then
    update public.editorial_publication_operations set status='cancelled',finished_at=clock_timestamp(),updated_at=clock_timestamp(),last_error_code='review_changes_requested'
      where article_version_id=v_version.id and status in ('queued','dispatch_pending','dispatched');
  end if;

  select r.status into v_editorial from public.editorial_reviews r where r.article_version_id=v_version.id and r.review_type='editorial'
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  select r.status into v_clinical from public.editorial_reviews r where r.article_version_id=v_version.id and r.review_type='clinical'
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  if v_editorial='approved' and v_clinical='approved' then v_article_status := 'aprovado';
  elsif v_editorial='approved' then v_article_status := 'revisao_clinica';
  else v_article_status := 'revisao_editorial'; end if;
  update public.editorial_articles set status=v_article_status,updated_at=now() where id=v_version.article_id;

  if v_editorial='approved' and v_clinical='approved' then
    select * into v_intent from public.editorial_publication_intents where article_version_id=v_version.id;
    if v_intent.intent='auto' and v_intent.content_sha256=v_version.content_sha256 and v_intent.presentation_sha256=v_version.presentation_sha256 then
      v_publication_operation := public.editorial_phase7_create_operation(v_version.article_id,v_version.id,'auto_review',v_actor,p_input->>'releaseSha256');
      select status into v_publication_status from public.editorial_publication_operations where id=v_publication_operation;
    end if;
  end if;

  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'record_review',v_request_sha,v_actor,'editorial_review',v_review_id::text,
    jsonb_build_object('reviewId',v_review_id,'articleId',v_version.article_id,'versionId',v_version.id,'articleStatus',v_article_status,
      'publicationOperationId',v_publication_operation,'publicationStatus',v_publication_status));
  return jsonb_build_object('reviewId',v_review_id,'articleId',v_version.article_id,'versionId',v_version.id,'articleStatus',v_article_status,
    'publicationOperationId',v_publication_operation,'publicationStatus',v_publication_status);
end $$;

create or replace function public.editorial_phase7_save_version(p_input jsonb)
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
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,7));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'save_version' then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;
  select * into v_article from public.editorial_articles where id=v_article_id for update;
  if v_article.id is null then raise exception 'artigo nao encontrado'; end if;
  select * into v_latest from public.editorial_versions where article_id=v_article_id order by version_number desc limit 1 for update;
  if v_latest.id is null or v_latest.id <> v_expected_id or v_latest.version_number <> v_expected_number then raise exception 'conflito de versao; recarregue antes de salvar'; end if;
  if exists(select 1 from public.editorial_publication_operations where article_version_id=v_latest.id and status in ('reserved','preparing','publishing','verifying','uncertain')) then
    raise exception 'publicacao ja entrou em etapa critica';
  end if;
  update public.editorial_publication_operations set status='cancelled',finished_at=clock_timestamp(),updated_at=clock_timestamp(),last_error_code='superseded_by_new_version'
    where article_version_id=v_latest.id and status in ('queued','dispatch_pending','dispatched');
  if p_input->>'targetSlug' <> v_article.target_slug then raise exception 'slug do artigo nao pode ser alterado nesta operacao'; end if;
  v_next := v_latest.version_number + 1;
  insert into public.editorial_versions(article_id,version_number,title,description,body_json,references_json,change_note,created_by,
    content_payload_json,content_sha256,presentation_payload_json,presentation_sha256,payload_schema_version)
  values(v_article_id,v_next,p_input->>'title',p_input->>'description',p_input->'body',coalesce(p_input->'references','[]'::jsonb),nullif(p_input->>'changeNote',''),v_actor::text,
    p_input->'contentPayload',p_input->>'contentSha256',p_input->'presentationPayload',p_input->>'presentationSha256',1)
  returning id into v_version;
  update public.editorial_articles set working_title=p_input->>'title',status='revisao_editorial',updated_at=now() where id=v_article_id;
  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'save_version',v_request_sha,v_actor,'article_version',v_version::text,jsonb_build_object('articleId',v_article_id,'versionId',v_version,'versionNumber',v_next));
  return jsonb_build_object('articleId',v_article_id,'versionId',v_version,'versionNumber',v_next);
end $$;

create or replace function public.editorial_phase7_queue_publication(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_existing public.editorial_admin_audit%rowtype;
  v_pub_id uuid;
  v_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,7));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'queue_publication' then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;
  v_pub_id := public.editorial_phase7_create_operation((p_input->>'articleId')::uuid,(p_input->>'versionId')::uuid,'manual',v_actor,p_input->>'releaseSha256');
  select status into v_status from public.editorial_publication_operations where id=v_pub_id;
  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'queue_publication',v_request_sha,v_actor,'publication_operation',v_pub_id::text,jsonb_build_object('publicationOperationId',v_pub_id,'publicationStatus',v_status));
  return jsonb_build_object('publicationOperationId',v_pub_id,'publicationStatus',v_status);
end $$;

create or replace function public.editorial_phase7_set_publication_control(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_expected integer := (p_input->>'expectedRevision')::integer;
  v_existing public.editorial_admin_audit%rowtype;
  v_control public.editorial_automation_control%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,7));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'publication_control' then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;
  select * into v_control from public.editorial_automation_control where automation_key='publication' for update;
  if v_control.revision <> v_expected then raise exception 'controle de publicacao mudou; recarregue antes de salvar'; end if;
  if (p_input->>'paused')::boolean and length(trim(coalesce(p_input->>'reason',''))) < 3 then raise exception 'motivo obrigatorio ao pausar'; end if;
  update public.editorial_automation_control set operator_paused=(p_input->>'paused')::boolean,
    pause_reason=case when (p_input->>'paused')::boolean then p_input->>'reason' else null end,
    changed_by_user_id=v_actor,changed_at=clock_timestamp(),revision=revision+1
  where automation_key='publication' returning * into v_control;
  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'publication_control',v_request_sha,v_actor,'automation','publication',jsonb_build_object(
    'automationKey','publication','operatorPaused',v_control.operator_paused,'pauseReason',v_control.pause_reason,'changedAt',v_control.changed_at,'revision',v_control.revision));
  return jsonb_build_object('automationKey','publication','operatorPaused',v_control.operator_paused,'pauseReason',v_control.pause_reason,'changedAt',v_control.changed_at,'revision',v_control.revision);
end $$;

create or replace function public.editorial_phase7_claim_publication(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_input->>'operationId')::uuid;
  v_run text := left(coalesce(p_input->>'executorRunId',''),180);
  v_now timestamptz := clock_timestamp();
  v_control public.editorial_automation_control%rowtype;
  v_op public.editorial_publication_operations%rowtype;
  v_latest public.editorial_versions%rowtype;
  v_editorial text;
  v_clinical text;
  v_intent public.editorial_publication_intents%rowtype;
  v_token uuid;
begin
  select * into v_control from public.editorial_automation_control where automation_key='publication' for update;
  if v_control.operator_paused then return jsonb_build_object('claimed',false,'reason','operator_paused'); end if;
  select * into v_op from public.editorial_publication_operations where id=v_id for update;
  if v_op.id is null then return jsonb_build_object('claimed',false,'reason','operation_not_found'); end if;
  if v_op.status in ('published','cancelled') then return jsonb_build_object('claimed',false,'reason','terminal','status',v_op.status); end if;
  if v_op.status='uncertain' then return jsonb_build_object('claimed',false,'reason','reconcile_required','status',v_op.status); end if;
  if v_op.attempts >= 3 then return jsonb_build_object('claimed',false,'reason','retry_budget_exhausted','status',v_op.status); end if;
  if v_control.active_operation_id is not null and v_control.active_operation_id <> v_op.id then
    return jsonb_build_object('claimed',false,'reason','publication_busy');
  end if;
  if v_control.active_operation_id=v_op.id and v_op.lease_until is not null then
    if v_op.lease_until > v_now then return jsonb_build_object('claimed',false,'reason','lease_active'); end if;
    update public.editorial_publication_operations set status='uncertain',last_error_code='lease_expired_after_reservation',updated_at=v_now where id=v_op.id;
    return jsonb_build_object('claimed',false,'reason','reconcile_required','status','uncertain');
  end if;
  select * into v_latest from public.editorial_versions where article_id=v_op.article_id order by version_number desc limit 1 for update;
  if v_latest.id is distinct from v_op.article_version_id or v_latest.content_sha256 is distinct from v_op.content_sha256 or v_latest.presentation_sha256 is distinct from v_op.presentation_sha256 then
    update public.editorial_publication_operations set status='blocked',last_error_code='version_or_hash_changed',updated_at=v_now,finished_at=v_now where id=v_op.id;
    return jsonb_build_object('claimed',false,'reason','version_or_hash_changed','status','blocked');
  end if;
  if v_latest.presentation_payload_json is null or coalesce(v_latest.presentation_payload_json->>'reviewStatus','') <> 'reviewed' then
    update public.editorial_publication_operations set status='blocked',last_error_code='presentation_not_reviewed',updated_at=v_now,finished_at=v_now where id=v_op.id;
    return jsonb_build_object('claimed',false,'reason','presentation_not_reviewed','status','blocked');
  end if;
  select r.status into v_editorial from public.editorial_reviews r where r.article_version_id=v_latest.id and r.review_type='editorial'
    and r.content_sha256=v_latest.content_sha256 and r.presentation_sha256=v_latest.presentation_sha256 and r.reviewed_at is not null
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  select r.status into v_clinical from public.editorial_reviews r where r.article_version_id=v_latest.id and r.review_type='clinical'
    and r.content_sha256=v_latest.content_sha256 and r.presentation_sha256=v_latest.presentation_sha256 and r.reviewed_at is not null
    order by r.reviewed_at desc,r.created_at desc,r.id desc limit 1;
  if v_editorial is distinct from 'approved' or v_clinical is distinct from 'approved' then
    update public.editorial_publication_operations set status='blocked',last_error_code='approvals_missing_or_stale',updated_at=v_now,finished_at=v_now where id=v_op.id;
    return jsonb_build_object('claimed',false,'reason','approvals_missing_or_stale','status','blocked');
  end if;
  if v_op.trigger_kind='auto_review' then
    select * into v_intent from public.editorial_publication_intents where article_version_id=v_latest.id;
    if v_intent.intent is distinct from 'auto' or v_intent.content_sha256 is distinct from v_latest.content_sha256 or v_intent.presentation_sha256 is distinct from v_latest.presentation_sha256 then
      update public.editorial_publication_operations set status='blocked',last_error_code='auto_intent_missing_or_stale',updated_at=v_now,finished_at=v_now where id=v_op.id;
      return jsonb_build_object('claimed',false,'reason','auto_intent_missing_or_stale','status','blocked');
    end if;
  end if;
  v_token := gen_random_uuid();
  update public.editorial_automation_control set active_operation_id=v_op.id where automation_key='publication';
  update public.editorial_publication_operations set status='reserved',attempts=attempts+1,lease_token=v_token,lease_until=v_now+interval '15 minutes',executor_run_id=v_run,
    last_error_code=null,last_error_detail=null,updated_at=v_now where id=v_op.id returning * into v_op;
  return jsonb_build_object('claimed',true,'leaseToken',v_token,'operation',jsonb_build_object(
    'id',v_op.id,'operationKey',v_op.operation_key,'triggerKind',v_op.trigger_kind,'status',v_op.status,'attempts',v_op.attempts,
    'articleId',v_op.article_id,'articleVersionId',v_op.article_version_id,'contentSha256',v_op.content_sha256,
    'presentationSha256',v_op.presentation_sha256,'releaseSha256',v_op.release_sha256,'snapshot',v_op.snapshot_json));
end $$;

create or replace function public.editorial_phase7_progress_publication(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_input->>'operationId')::uuid;
  v_token uuid := (p_input->>'leaseToken')::uuid;
  v_status text := p_input->>'status';
  v_op public.editorial_publication_operations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_status not in ('preparing','publishing','verifying','blocked','failed','uncertain') then raise exception 'status de publicacao invalido'; end if;
  select * into v_op from public.editorial_publication_operations where id=v_id for update;
  if v_op.id is null or v_op.lease_token is distinct from v_token then raise exception 'lease de publicacao invalido'; end if;
  update public.editorial_publication_operations set status=v_status,
    lease_until=case when v_status in ('preparing','publishing','verifying') then v_now+interval '15 minutes' else lease_until end,
    github_base_sha=coalesce(nullif(p_input->>'githubBaseSha',''),github_base_sha),
    github_head_sha=coalesce(nullif(p_input->>'githubHeadSha',''),github_head_sha),
    github_branch=coalesce(nullif(p_input->>'githubBranch',''),github_branch),
    github_pr_number=coalesce((nullif(p_input->>'githubPrNumber',''))::integer,github_pr_number),
    github_merge_sha=coalesce(nullif(p_input->>'githubMergeSha',''),github_merge_sha),
    expected_html_sha256=coalesce(nullif(p_input->>'expectedHtmlSha256',''),expected_html_sha256),
    last_error_code=nullif(p_input->>'errorCode',''),
    last_error_detail=left(nullif(p_input->>'errorDetail',''),1200),
    result_json=result_json || coalesce(p_input->'details','{}'::jsonb),updated_at=v_now,
    finished_at=case when v_status in ('blocked','failed') then v_now else finished_at end
  where id=v_id returning * into v_op;
  if v_status in ('blocked','failed') then
    update public.editorial_automation_control set active_operation_id=null where automation_key='publication' and active_operation_id=v_id;
  end if;
  return jsonb_build_object('operationId',v_op.id,'status',v_op.status,'leaseUntil',v_op.lease_until);
end $$;

create or replace function public.editorial_phase7_mark_published(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_input->>'operationId')::uuid;
  v_op public.editorial_publication_operations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_op from public.editorial_publication_operations where id=v_id for update;
  if v_op.id is null then raise exception 'operacao de publicacao nao encontrada'; end if;
  if v_op.status='published' then return jsonb_build_object('operationId',v_op.id,'status','published','reused',true); end if;
  if v_op.status not in ('publishing','verifying','uncertain') then raise exception 'operacao ainda nao pode ser confirmada'; end if;
  update public.editorial_publication_operations set status='published',finished_at=v_now,updated_at=v_now,lease_until=null,
    vercel_deployment_id=nullif(p_input->>'vercelDeploymentId',''),vercel_deployment_url=nullif(p_input->>'vercelDeploymentUrl',''),
    last_error_code=null,last_error_detail=null,result_json=result_json || coalesce(p_input->'verification','{}'::jsonb)
    where id=v_id returning * into v_op;
  update public.editorial_automation_control set active_operation_id=null where automation_key='publication' and active_operation_id=v_id;
  return jsonb_build_object('operationId',v_op.id,'status','published','reused',false);
end $$;

create or replace function public.editorial_phase7_retry_publication(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_audit uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_id uuid := (p_input->>'publicationOperationId')::uuid;
  v_existing public.editorial_admin_audit%rowtype;
  v_op public.editorial_publication_operations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_audit::text,7));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_audit;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'retry_publication' then raise exception 'operation_key reutilizada com outra requisicao'; end if;
    return v_existing.result_json;
  end if;
  select * into v_op from public.editorial_publication_operations where id=v_id for update;
  if v_op.id is null then raise exception 'operacao de publicacao nao encontrada'; end if;
  if v_op.status not in ('failed','blocked') then raise exception 'somente falha conhecida pode ser repetida'; end if;
  if v_op.attempts >= 3 then raise exception 'limite de tentativas atingido'; end if;
  update public.editorial_publication_operations set status='queued',lease_token=null,lease_until=null,executor_run_id=null,last_error_code=null,last_error_detail=null,
    finished_at=null,updated_at=clock_timestamp() where id=v_id returning * into v_op;
  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_audit,'retry_publication',v_request_sha,v_actor,'publication_operation',v_id::text,jsonb_build_object('publicationOperationId',v_id,'publicationStatus',v_op.status));
  return jsonb_build_object('publicationOperationId',v_id,'publicationStatus',v_op.status);
end $$;

revoke all on function public.editorial_phase7_create_operation(uuid,uuid,text,uuid,text),
  public.editorial_phase7_set_publish_intent(jsonb),public.editorial_phase7_record_review(jsonb),public.editorial_phase7_save_version(jsonb),
  public.editorial_phase7_queue_publication(jsonb),public.editorial_phase7_set_publication_control(jsonb),
  public.editorial_phase7_claim_publication(jsonb),public.editorial_phase7_progress_publication(jsonb),
  public.editorial_phase7_mark_published(jsonb),public.editorial_phase7_retry_publication(jsonb) from public, anon, authenticated;
grant execute on function public.editorial_phase7_create_operation(uuid,uuid,text,uuid,text),
  public.editorial_phase7_set_publish_intent(jsonb),public.editorial_phase7_record_review(jsonb),public.editorial_phase7_save_version(jsonb),
  public.editorial_phase7_queue_publication(jsonb),public.editorial_phase7_set_publication_control(jsonb),
  public.editorial_phase7_claim_publication(jsonb),public.editorial_phase7_progress_publication(jsonb),
  public.editorial_phase7_mark_published(jsonb),public.editorial_phase7_retry_publication(jsonb) to service_role;

commit;
