create table public.editorial_legacy_client_authorizations (
  article_version_id uuid primary key references public.editorial_versions(id) on delete cascade,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  presentation_sha256 text not null check (presentation_sha256 ~ '^[0-9a-f]{64}$'),
  notes text not null default 'aprovado pela Dra. Karyne por mensagem em 05/11/2026, sem revisão individual',
  recorded_by_user_id uuid references auth.users(id),
  recorded_at timestamptz,
  check ((recorded_by_user_id is null) = (recorded_at is null))
);

alter table public.editorial_legacy_client_authorizations enable row level security;
revoke all on public.editorial_legacy_client_authorizations from public, anon, authenticated, service_role;
grant select, insert on public.editorial_legacy_client_authorizations to service_role;
grant update (recorded_at, recorded_by_user_id) on public.editorial_legacy_client_authorizations to service_role;

create function public.editorial_record_legacy_client_authorization(
  p_version_id uuid, p_content_sha256 text, p_presentation_sha256 text, p_actor uuid
) returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  v_article_id uuid;
  v_version public.editorial_versions%rowtype;
  v_recorded_at timestamptz;
begin
  select article_id into v_article_id from public.editorial_versions where id=p_version_id;
  perform 1 from public.editorial_articles where id=v_article_id for update;
  select * into v_version from public.editorial_versions where article_id=v_article_id order by version_number desc limit 1;
  if p_actor is null or v_version.id is distinct from p_version_id or v_version.version_number is distinct from 1
    or v_version.content_sha256 is distinct from p_content_sha256
    or v_version.presentation_sha256 is distinct from p_presentation_sha256 then
    raise exception 'versao de trabalho superada';
  end if;

  update public.editorial_legacy_client_authorizations
    set recorded_at=clock_timestamp(), recorded_by_user_id=p_actor
    where article_version_id=p_version_id and content_sha256=p_content_sha256
      and presentation_sha256=p_presentation_sha256 and recorded_at is null;

  select recorded_at into v_recorded_at from public.editorial_legacy_client_authorizations
    where article_version_id=p_version_id and content_sha256=p_content_sha256
      and presentation_sha256=p_presentation_sha256;
  if v_recorded_at is null then raise exception 'versao fora da autorizacao da cliente'; end if;
  return v_recorded_at;
end $$;

revoke all on function public.editorial_record_legacy_client_authorization(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.editorial_record_legacy_client_authorization(uuid,text,text,uuid) to service_role;


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
  v_client_authorized boolean := false;
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
  if p_trigger_kind='manual' and v_clinical is distinct from 'approved' and v_clinical is distinct from 'changes_requested' then
    select exists(select 1 from public.editorial_legacy_client_authorizations
      where article_version_id=v_version.id and content_sha256=v_version.content_sha256
        and presentation_sha256=v_version.presentation_sha256 and recorded_at is not null)
      into v_client_authorized;
  end if;
  if v_editorial is distinct from 'approved' or (v_clinical is distinct from 'approved' and not v_client_authorized) then
    raise exception 'aprovacoes atuais ausentes';
  end if;

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
        'clinical',not v_client_authorized,
        'contentHash',v_version.content_sha256,
        'presentationHash',v_version.presentation_sha256,
        'releaseHash',p_release_sha256
      ) || case when v_client_authorized then jsonb_build_object('clinicalAuthorization','karyne-legacy-2026-11-05') else '{}'::jsonb end
    )
  );

  insert into public.editorial_publication_operations(
    article_id,article_version_id,operation_key,trigger_kind,content_sha256,presentation_sha256,
    release_sha256,snapshot_json,created_by_user_id
  ) values (
    p_article_id,v_version.id,v_operation_key,p_trigger_kind,v_version.content_sha256,v_version.presentation_sha256,
    p_release_sha256,v_snapshot,p_actor
  ) on conflict(article_version_id,release_sha256) do update set
    -- Operação cancelada antes da reserva (correção pedida ou intenção trocada) volta à fila se a mesma versão for aprovada de novo.
    snapshot_json=case when editorial_publication_operations.status='cancelled' then excluded.snapshot_json else editorial_publication_operations.snapshot_json end,
    status=case when editorial_publication_operations.status='cancelled' then 'queued' else editorial_publication_operations.status end,
    trigger_kind=case when editorial_publication_operations.status='cancelled' then excluded.trigger_kind else editorial_publication_operations.trigger_kind end,
    created_by_user_id=case when editorial_publication_operations.status='cancelled' then excluded.created_by_user_id else editorial_publication_operations.created_by_user_id end,
    last_error_code=case when editorial_publication_operations.status='cancelled' then null else editorial_publication_operations.last_error_code end,
    last_error_detail=case when editorial_publication_operations.status='cancelled' then null else editorial_publication_operations.last_error_detail end,
    finished_at=case when editorial_publication_operations.status='cancelled' then null else editorial_publication_operations.finished_at end,
    updated_at=case when editorial_publication_operations.status='cancelled' then clock_timestamp() else editorial_publication_operations.updated_at end
  returning * into v_operation;
  return v_operation.id;
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
  v_client_authorized boolean := false;
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
  if v_op.snapshot_json #>> '{article,approval,clinicalAuthorization}' = 'karyne-legacy-2026-11-05' then
    select exists(select 1 from public.editorial_legacy_client_authorizations
      where article_version_id=v_latest.id and content_sha256=v_latest.content_sha256
        and presentation_sha256=v_latest.presentation_sha256 and recorded_at is not null)
      and v_clinical is distinct from 'changes_requested' and v_op.trigger_kind='manual' into v_client_authorized;
    if v_client_authorized and (
      select count(*) from public.editorial_publication_operations
        where status='published'
          and snapshot_json #>> '{article,approval,clinicalAuthorization}' = 'karyne-legacy-2026-11-05'
          and (finished_at at time zone 'America/Sao_Paulo')::date=(v_now at time zone 'America/Sao_Paulo')::date
    ) >= 5 then
      return jsonb_build_object('claimed',false,'reason','legacy_daily_limit');
    end if;
  end if;
  if v_editorial is distinct from 'approved' or (
    case when v_op.snapshot_json #>> '{article,approval,clinicalAuthorization}' is not null
      then not v_client_authorized else v_clinical is distinct from 'approved' end
  ) then
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
