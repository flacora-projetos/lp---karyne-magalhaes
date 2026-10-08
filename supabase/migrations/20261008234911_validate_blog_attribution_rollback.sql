BEGIN;
CREATE TEMP TABLE leads (LIKE public.leads INCLUDING ALL);
-- ETAPA 2 BLOG: migração preparada localmente. NÃO APLICADA remotamente nesta etapa.
-- Separa primeira aquisição, entrada externa atual e assistência editorial sem colocar PII/saúde no GA4.

alter table pg_temp.leads
  add column if not exists google_match_gclid text,
  add column if not exists first_utm_source text,
  add column if not exists first_utm_medium text,
  add column if not exists first_utm_campaign text,
  add column if not exists first_utm_content text,
  add column if not exists first_utm_term text,
  add column if not exists first_gclid text,
  add column if not exists first_fbclid text,
  add column if not exists first_entry_url text,
  add column if not exists first_referrer text,
  add column if not exists first_acquired_at timestamptz,
  add column if not exists first_channel_derived text,
  add column if not exists current_entry_url text,
  add column if not exists current_referrer text,
  add column if not exists current_acquired_at timestamptz,
  add column if not exists channel_derived text,
  add column if not exists entry_article_id text,
  add column if not exists entry_source_id text,
  add column if not exists entry_article_slug text,
  add column if not exists last_article_id text,
  add column if not exists last_article_slug text,
  add column if not exists article_assists jsonb,
  add column if not exists editorial_cta_id text,
  add column if not exists editorial_cta_destination text;

create index if not exists leads_first_channel_idx on pg_temp.leads (first_channel_derived);
create index if not exists leads_current_channel_idx on pg_temp.leads (channel_derived);
create index if not exists leads_entry_article_idx on pg_temp.leads (entry_article_slug);

create or replace function pg_temp.upsert_lead(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  has_current_acquisition boolean := coalesce(p->'current_acquisition_available' = 'true'::jsonb, false);
begin
  if coalesce(p->>'lead_id', '') = '' then raise exception 'lead_id ausente no payload'; end if;

  insert into pg_temp.leads (
    lead_id, etapa_funil, etapa_atual, nome, whatsapp, email, cidade, estado,
    comportamento_halito, uso_antibiotico, opcao_interesse, periodo_preferido, datas_preferidas,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, google_match_gclid, origem, channel_derived,
    page_url, referrer, user_agent, current_entry_url, current_referrer, current_acquired_at, meta_fbp, meta_fbc, client_ip,
    first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term,
    first_gclid, first_fbclid, first_entry_url, first_referrer, first_acquired_at, first_channel_derived,
    entry_article_id, entry_source_id, entry_article_slug, last_article_id, last_article_slug,
    article_assists, editorial_cta_id, editorial_cta_destination
  ) values (
    p->>'lead_id', p->>'etapa_funil', nullif(p->>'etapa_atual','')::smallint, p->>'nome', p->>'whatsapp', p->>'email', p->>'cidade', p->>'estado',
    p->>'comportamento_halito', p->>'uso_antibiotico', p->>'opcao_interesse', p->>'periodo_preferido', p->>'datas_preferidas',
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign', p->>'utm_content', p->>'utm_term', p->>'fbclid', p->>'gclid', p->>'gclid', p->>'origem', p->>'channel_derived',
    p->>'page_url', p->>'referrer', p->>'user_agent', p->>'current_entry_url', p->>'current_referrer', nullif(p->>'current_acquired_at','')::timestamptz,
    p->>'meta_fbp', p->>'meta_fbc', p->>'client_ip',
    p->>'first_utm_source', p->>'first_utm_medium', p->>'first_utm_campaign', p->>'first_utm_content', p->>'first_utm_term',
    p->>'first_gclid', p->>'first_fbclid', p->>'first_entry_url', p->>'first_referrer', nullif(p->>'first_acquired_at','')::timestamptz, p->>'first_channel_derived',
    p->>'entry_article_id', p->>'entry_source_id', p->>'entry_article_slug', p->>'last_article_id', p->>'last_article_slug',
    p->'article_assists', p->>'editorial_cta_id', p->>'editorial_cta_destination'
  )
  on conflict (lead_id) do update set
    etapa_funil = coalesce(excluded.etapa_funil, pg_temp.leads.etapa_funil),
    etapa_atual = greatest(excluded.etapa_atual, pg_temp.leads.etapa_atual),
    nome = coalesce(excluded.nome, pg_temp.leads.nome), whatsapp = coalesce(excluded.whatsapp, pg_temp.leads.whatsapp),
    email = coalesce(excluded.email, pg_temp.leads.email), cidade = coalesce(excluded.cidade, pg_temp.leads.cidade), estado = coalesce(excluded.estado, pg_temp.leads.estado),
    comportamento_halito = coalesce(excluded.comportamento_halito, pg_temp.leads.comportamento_halito),
    uso_antibiotico = coalesce(excluded.uso_antibiotico, pg_temp.leads.uso_antibiotico), opcao_interesse = coalesce(excluded.opcao_interesse, pg_temp.leads.opcao_interesse),
    periodo_preferido = coalesce(excluded.periodo_preferido, pg_temp.leads.periodo_preferido), datas_preferidas = coalesce(excluded.datas_preferidas, pg_temp.leads.datas_preferidas),
    -- Contexto atual completo pode limpar uma campanha; payload legado/parcial preserva valores ausentes.
    utm_source = case when has_current_acquisition then excluded.utm_source else coalesce(excluded.utm_source, pg_temp.leads.utm_source) end,
    utm_medium = case when has_current_acquisition then excluded.utm_medium else coalesce(excluded.utm_medium, pg_temp.leads.utm_medium) end,
    utm_campaign = case when has_current_acquisition then excluded.utm_campaign else coalesce(excluded.utm_campaign, pg_temp.leads.utm_campaign) end,
    utm_content = case when has_current_acquisition then excluded.utm_content else coalesce(excluded.utm_content, pg_temp.leads.utm_content) end,
    utm_term = case when has_current_acquisition then excluded.utm_term else coalesce(excluded.utm_term, pg_temp.leads.utm_term) end,
    fbclid = case when has_current_acquisition then excluded.fbclid else coalesce(excluded.fbclid, pg_temp.leads.fbclid) end,
    gclid = case when has_current_acquisition then excluded.gclid else coalesce(excluded.gclid, pg_temp.leads.gclid) end,
    -- O matching Google conserva o último clique conhecido sem reclassificar a aquisição atual.
    google_match_gclid = coalesce(excluded.google_match_gclid, pg_temp.leads.google_match_gclid, pg_temp.leads.gclid),
    origem = case when has_current_acquisition then excluded.origem else coalesce(excluded.origem, pg_temp.leads.origem) end,
    channel_derived = case when has_current_acquisition then excluded.channel_derived else coalesce(excluded.channel_derived, pg_temp.leads.channel_derived) end,
    page_url = coalesce(excluded.page_url, pg_temp.leads.page_url), referrer = coalesce(excluded.referrer, pg_temp.leads.referrer), user_agent = coalesce(excluded.user_agent, pg_temp.leads.user_agent),
    current_entry_url = case when has_current_acquisition then excluded.current_entry_url else coalesce(excluded.current_entry_url, pg_temp.leads.current_entry_url) end,
    current_referrer = case when has_current_acquisition then excluded.current_referrer else coalesce(excluded.current_referrer, pg_temp.leads.current_referrer) end,
    current_acquired_at = case when has_current_acquisition then excluded.current_acquired_at else coalesce(excluded.current_acquired_at, pg_temp.leads.current_acquired_at) end,
    meta_fbp = coalesce(pg_temp.leads.meta_fbp, excluded.meta_fbp), meta_fbc = coalesce(pg_temp.leads.meta_fbc, excluded.meta_fbc), client_ip = coalesce(pg_temp.leads.client_ip, excluded.client_ip),
    first_utm_source = coalesce(pg_temp.leads.first_utm_source, excluded.first_utm_source), first_utm_medium = coalesce(pg_temp.leads.first_utm_medium, excluded.first_utm_medium),
    first_utm_campaign = coalesce(pg_temp.leads.first_utm_campaign, excluded.first_utm_campaign), first_utm_content = coalesce(pg_temp.leads.first_utm_content, excluded.first_utm_content), first_utm_term = coalesce(pg_temp.leads.first_utm_term, excluded.first_utm_term),
    first_gclid = coalesce(pg_temp.leads.first_gclid, excluded.first_gclid), first_fbclid = coalesce(pg_temp.leads.first_fbclid, excluded.first_fbclid),
    first_entry_url = coalesce(pg_temp.leads.first_entry_url, excluded.first_entry_url), first_referrer = coalesce(pg_temp.leads.first_referrer, excluded.first_referrer),
    first_acquired_at = coalesce(pg_temp.leads.first_acquired_at, excluded.first_acquired_at), first_channel_derived = coalesce(pg_temp.leads.first_channel_derived, excluded.first_channel_derived),
    entry_article_id = coalesce(pg_temp.leads.entry_article_id, excluded.entry_article_id), entry_source_id = coalesce(pg_temp.leads.entry_source_id, excluded.entry_source_id), entry_article_slug = coalesce(pg_temp.leads.entry_article_slug, excluded.entry_article_slug),
    last_article_id = coalesce(excluded.last_article_id, pg_temp.leads.last_article_id), last_article_slug = coalesce(excluded.last_article_slug, pg_temp.leads.last_article_slug),
    article_assists = coalesce(excluded.article_assists, pg_temp.leads.article_assists), editorial_cta_id = coalesce(excluded.editorial_cta_id, pg_temp.leads.editorial_cta_id),
    editorial_cta_destination = coalesce(excluded.editorial_cta_destination, pg_temp.leads.editorial_cta_destination);
end;
$function$;


-- Executar SOMENTE em Supabase/PostgreSQL isolado autorizado, nunca em produção.
-- Pré-condição: clone/sandbox com schema atual de Karyne e migração
-- 20261008193000_blog_attribution_fields.sql aplicada.
-- O script usa dados sintéticos e ROLLBACK no fim.

-- 1) INSERT sintético pago, incluindo identificadores Meta que devem ser imutáveis.
select pg_temp.upsert_lead(jsonb_build_object(
  'lead_id','homolog-etapa3-001','etapa_funil','Filtro aberto (Abriu o filtro)','etapa_atual',1,
  'nome','Visitante (Homologação)','current_acquisition_available',true,
  'utm_source','google','utm_medium','cpc','utm_campaign','camp-a','gclid','gclid-a',
  'origem','Google Ads','channel_derived','Paid Search',
  'first_utm_source','google','first_utm_medium','cpc','first_utm_campaign','camp-a','first_gclid','gclid-a',
  'first_channel_derived','Paid Search','current_entry_url','https://example.invalid/a',
  'entry_article_id','art-1','entry_article_slug','artigo-1','last_article_id','art-1','last_article_slug','artigo-1',
  'meta_fbp','synthetic-fbp-original','meta_fbc','synthetic-fbc-original','client_ip','192.0.2.10',
  'article_assists',jsonb_build_array(jsonb_build_object('articleId','art-1','slug','artigo-1','at',now()::text))
));

do $$ declare r pg_temp.leads%rowtype; begin
  select * into strict r from pg_temp.leads where lead_id='homolog-etapa3-001';
  if r.utm_campaign is distinct from 'camp-a' or r.gclid is distinct from 'gclid-a' then raise exception 'falha insert inicial: aquisição paga'; end if;
  if r.meta_fbp is distinct from 'synthetic-fbp-original' or r.meta_fbc is distinct from 'synthetic-fbc-original' or r.client_ip is distinct from '192.0.2.10' then raise exception 'falha insert inicial: matching Meta'; end if;
end $$;

-- 2) ON CONFLICT: pago -> orgânico. Deve limpar UTM/gclid atuais,
-- preservar first_* e preservar google_match_gclid.
select pg_temp.upsert_lead(jsonb_build_object(
  'lead_id','homolog-etapa3-001','etapa_funil','Filtro iniciado (Começou a responder)','etapa_atual',3,
  'current_acquisition_available',true,'utm_source',null,'utm_medium',null,'utm_campaign',null,'gclid',null,
  'origem','Busca orgânica','channel_derived','Organic Search','current_referrer','https://www.google.com/',
  'meta_fbp','synthetic-fbp-update','meta_fbc','synthetic-fbc-update','client_ip','192.0.2.11'
));

do $$
declare r pg_temp.leads%rowtype;
begin
  select * into strict r from pg_temp.leads where lead_id='homolog-etapa3-001';
  if r.utm_campaign is distinct from null or r.gclid is distinct from null then raise exception 'falha pago->organico: aquisição atual não limpou'; end if;
  if r.first_gclid is distinct from 'gclid-a' then raise exception 'falha: primeira aquisição foi alterada'; end if;
  if r.google_match_gclid is distinct from 'gclid-a' then raise exception 'falha: matching google não preservado'; end if;
  if r.channel_derived is distinct from 'Organic Search' then raise exception 'falha: canal atual'; end if;
  if r.etapa_atual is distinct from 3 then raise exception 'falha: etapa do funil'; end if;
  if r.meta_fbp is distinct from 'synthetic-fbp-original' or r.meta_fbc is distinct from 'synthetic-fbc-original' or r.client_ip is distinct from '192.0.2.10' then raise exception 'falha: matching Meta alterado por update'; end if;
end $$;

-- 3) Nova campanha sem click-id: matching anterior deve sobreviver.
select pg_temp.upsert_lead(jsonb_build_object(
 'lead_id','homolog-etapa3-001','current_acquisition_available',true,
 'utm_source','newsletter','utm_medium','email','utm_campaign','camp-b','gclid',null,
 'origem','Não atribuído','channel_derived','Unassigned'
));

do $$ declare r pg_temp.leads%rowtype; begin
 select * into strict r from pg_temp.leads where lead_id='homolog-etapa3-001';
 if r.utm_campaign is distinct from 'camp-b' or r.gclid is distinct from null then raise exception 'falha campanha sem click-id'; end if;
 if r.google_match_gclid is distinct from 'gclid-a' then raise exception 'matching anterior perdido'; end if;
end $$;

-- 4) Atualização parcial sem aquisição: campanha atual deve ser preservada.
select pg_temp.upsert_lead(jsonb_build_object(
 'lead_id','homolog-etapa3-001','etapa_funil','Filtro concluído(Concluiu o filtro)','etapa_atual',7,
 'nome','Pessoa Sintética'
));

do $$ declare r pg_temp.leads%rowtype; begin
 select * into strict r from pg_temp.leads where lead_id='homolog-etapa3-001';
 if r.utm_campaign is distinct from 'camp-b' then raise exception 'update parcial apagou aquisição'; end if;
 if r.etapa_atual is distinct from 7 then raise exception 'etapa final não atualizou'; end if;
end $$;

-- 5) Cliente legado: sem booleano explícito, campos ausentes preservam o anterior.
select pg_temp.upsert_lead(jsonb_build_object(
 'lead_id','homolog-etapa3-001','utm_campaign',null,'gclid',null,'last_article_id','art-2','last_article_slug','artigo-2'
));

do $$ declare r pg_temp.leads%rowtype; begin
 select * into strict r from pg_temp.leads where lead_id='homolog-etapa3-001';
 if r.utm_campaign is distinct from 'camp-b' then raise exception 'payload legado limpou valor ausente'; end if;
 if r.last_article_slug is distinct from 'artigo-2' then raise exception 'assistência editorial não atualizou'; end if;
end $$;

-- 6) Primeira aquisição orgânica + clique pago posterior: first_gclid deve continuar null,
-- google_match_gclid recebe o clique posterior.
select pg_temp.upsert_lead(jsonb_build_object(
 'lead_id','homolog-etapa3-002','current_acquisition_available',true,
 'channel_derived','Organic Search','origem','Busca orgânica','first_channel_derived','Organic Search'
));
select pg_temp.upsert_lead(jsonb_build_object(
 'lead_id','homolog-etapa3-002','current_acquisition_available',true,
 'utm_source','google','utm_medium','cpc','gclid','gclid-posterior','channel_derived','Paid Search','origem','Google Ads'
));

do $$ declare r pg_temp.leads%rowtype; begin
 select * into strict r from pg_temp.leads where lead_id='homolog-etapa3-002';
 if r.first_gclid is distinct from null then raise exception 'first_gclid orgânico foi contaminado'; end if;
 if r.google_match_gclid is distinct from 'gclid-posterior' then raise exception 'matching do clique posterior não gravou'; end if;
end $$;

-- 7) Falha forçada: validar a mensagem exata de lead_id ausente.
do $$ begin
  begin
    perform pg_temp.upsert_lead('{}'::jsonb);
    raise exception 'falha forçada não falhou';
  exception when others then
    if sqlerrm is distinct from 'lead_id ausente no payload' then raise; end if;
  end;
end $$;

-- 8) Read-back final sintético
select lead_id, etapa_atual, utm_source, utm_medium, utm_campaign, gclid, google_match_gclid,
       first_utm_source, first_utm_medium, first_utm_campaign, first_gclid, first_channel_derived,
       channel_derived, entry_article_id, last_article_id, last_article_slug, article_assists,
       meta_fbp, meta_fbc, client_ip
from pg_temp.leads
where lead_id in ('homolog-etapa3-001','homolog-etapa3-002')
order by lead_id;

ROLLBACK;
