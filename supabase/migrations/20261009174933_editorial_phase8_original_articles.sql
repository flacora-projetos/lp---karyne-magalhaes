begin;

-- Fase 8: artigos originais (manuais ou gerados por IA a partir de pauta nova), sem fonte WordPress.
-- Mudança aditiva. Depende da migration da Fase 7 (20261009153732). Nenhum registro legado é criado ou alterado
-- além do preenchimento da origem dos artigos que já possuem fonte vinculada.

-- 1. Origem explícita do artigo editorial.
alter table public.editorial_articles
  add column if not exists origin_kind text;
alter table public.editorial_articles
  drop constraint if exists editorial_articles_origin_kind_check;
alter table public.editorial_articles
  add constraint editorial_articles_origin_kind_check
    check (origin_kind is null or origin_kind in ('legacy_adaptation','original_manual','original_ai'));
-- Original nunca aponta para fonte legado; não se inventa vínculo para satisfazer validação.
alter table public.editorial_articles
  drop constraint if exists editorial_articles_original_without_source;
alter table public.editorial_articles
  add constraint editorial_articles_original_without_source
    check (origin_kind is null or origin_kind = 'legacy_adaptation' or source_id is null);

-- Somente artigos com fonte realmente vinculada recebem a origem legado. Os demais ficam sem origem registrada.
update public.editorial_articles a set origin_kind = 'legacy_adaptation'
where a.origin_kind is null
  and (a.source_id is not null or exists (select 1 from public.editorial_article_sources s where s.article_id = a.id));

-- 2. Rascunhos de IA a partir de pauta nova: sem fonte legado, com tipo explícito.
alter table public.editorial_drafts
  add column if not exists draft_kind text not null default 'legacy_adaptation';
alter table public.editorial_drafts
  drop constraint if exists editorial_drafts_draft_kind_check;
alter table public.editorial_drafts
  add constraint editorial_drafts_draft_kind_check check (draft_kind in ('legacy_adaptation','original'));
-- A obrigatoriedade da fonte passa a valer por tipo: adaptação exige fonte; original proíbe fonte.
alter table public.editorial_drafts alter column source_id drop not null;
alter table public.editorial_drafts
  drop constraint if exists editorial_drafts_source_matches_kind;
alter table public.editorial_drafts
  add constraint editorial_drafts_source_matches_kind
    check ((draft_kind = 'legacy_adaptation' and source_id is not null) or (draft_kind = 'original' and source_id is null));
-- A mesma pauta original não pode ter duas gerações pendentes simultâneas (duas abas, duas pessoas).
create unique index if not exists editorial_drafts_active_original_request
  on public.editorial_drafts(request_sha256) where draft_kind = 'original' and status in ('generating','uncertain');

-- 3. Auditoria aceita a criação de artigo original.
alter table public.editorial_admin_audit
  drop constraint if exists editorial_admin_audit_operation_type_check;
alter table public.editorial_admin_audit
  add constraint editorial_admin_audit_operation_type_check check (operation_type in (
    'promote_draft','save_version','record_review','automation_control','export_snapshot',
    'publication_intent','publication_control','queue_publication','retry_publication',
    'create_original'
  ));

-- 4. Criação transacional e idempotente de artigo original (manual ou a partir de rascunho de IA original).
-- O artigo nasce privado, versão 1, em revisão editorial; nenhuma aprovação, intenção ou publicação é criada.
create or replace function public.editorial_phase8_create_original(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := (p_input->>'operationKey')::uuid;
  v_actor uuid := (p_input->>'actorUserId')::uuid;
  v_article uuid := (p_input->>'articleId')::uuid;
  v_request_sha text := p_input->>'requestSha256';
  v_origin text := p_input->>'originKind';
  v_slug text := p_input->>'targetSlug';
  v_draft_operation uuid := nullif(p_input->>'draftOperationKey','')::uuid;
  v_existing public.editorial_admin_audit%rowtype;
  v_draft public.editorial_drafts%rowtype;
  v_version uuid;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,8));
  select * into v_existing from public.editorial_admin_audit where operation_key=v_operation;
  if v_existing.id is not null then
    if v_existing.request_sha256 <> v_request_sha or v_existing.actor_user_id <> v_actor or v_existing.operation_type <> 'create_original' then
      raise exception 'operation_key reutilizada com outra requisicao';
    end if;
    return v_existing.result_json;
  end if;
  if v_origin not in ('original_manual','original_ai') then raise exception 'origem original invalida'; end if;
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'slug invalido'; end if;
  if p_input->>'contentSha256' !~ '^[0-9a-f]{64}$' or p_input->>'presentationSha256' !~ '^[0-9a-f]{64}$' then raise exception 'hashes invalidos'; end if;
  if p_input->'contentPayload'->>'sourceId' is not null then raise exception 'artigo original nao aceita fonte legado'; end if;
  if p_input->'contentPayload'->>'slug' is distinct from v_slug or p_input->'contentPayload'->>'id' is distinct from v_article::text then
    raise exception 'identidade do conteudo divergente';
  end if;

  if v_origin='original_ai' then
    if v_draft_operation is null then raise exception 'rascunho original obrigatorio'; end if;
    select * into v_draft from public.editorial_drafts where operation_key=v_draft_operation for update;
    if v_draft.operation_key is null then raise exception 'rascunho nao encontrado'; end if;
    if v_draft.draft_kind <> 'original' or v_draft.source_id is not null then raise exception 'rascunho nao e original'; end if;
    if v_draft.status <> 'draft' then raise exception 'rascunho ainda nao esta pronto para promocao'; end if;
    if v_draft.promoted_version_id is not null then
      return jsonb_build_object('articleId',v_draft.promoted_article_id,'versionId',v_draft.promoted_version_id,'versionNumber',1,'originKind','original_ai','reused',true);
    end if;
  elsif v_draft_operation is not null then
    raise exception 'criacao manual nao aceita rascunho';
  end if;

  -- Slugs são serializados para que duas criações concorrentes do mesmo endereço tenham um único vencedor.
  perform pg_advisory_xact_lock(hashtextextended('editorial-slug:' || v_slug,8));
  if exists(select 1 from public.editorial_articles where target_slug=v_slug)
    or exists(select 1 from public.editorial_publications where url like '%/blog/' || v_slug || '/') then
    raise exception 'slug ja pertence a outro artigo';
  end if;

  insert into public.editorial_articles(id,source_id,working_title,target_slug,topic_cluster,primary_search_intent,service_relation,status,origin_kind,updated_at)
  values(v_article,null,p_input->>'title',v_slug,nullif(p_input->>'topicCluster',''),nullif(p_input->>'searchIntent',''),'halitose','revisao_editorial',v_origin,now());

  insert into public.editorial_versions(article_id,version_number,title,description,body_json,references_json,change_note,created_by,
    content_payload_json,content_sha256,presentation_payload_json,presentation_sha256,payload_schema_version)
  values(v_article,1,p_input->>'title',p_input->>'description',p_input->'body',coalesce(p_input->'references','[]'::jsonb),
    case when v_origin='original_ai' then 'Criado de rascunho original de IA' else coalesce(nullif(p_input->>'changeNote',''),'Artigo original escrito manualmente') end,
    v_actor::text,p_input->'contentPayload',p_input->>'contentSha256',p_input->'presentationPayload',p_input->>'presentationSha256',1)
  returning id into v_version;

  if v_origin='original_ai' then
    update public.editorial_drafts set promoted_article_id=v_article,promoted_version_id=v_version,updated_at=now()
    where operation_key=v_draft_operation;
  end if;

  v_result := jsonb_build_object('articleId',v_article,'versionId',v_version,'versionNumber',1,'originKind',v_origin,'reused',false);
  insert into public.editorial_admin_audit(operation_key,operation_type,request_sha256,actor_user_id,target_type,target_id,result_json)
  values(v_operation,'create_original',v_request_sha,v_actor,'article',v_article::text,v_result);
  return v_result;
end $$;

revoke all on function public.editorial_phase8_create_original(jsonb) from public, anon, authenticated;
grant execute on function public.editorial_phase8_create_original(jsonb) to service_role;

commit;
