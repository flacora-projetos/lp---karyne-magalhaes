-- Identificadores GA4 do visitante guardados no lead, para devolver a consulta
-- realizada ao GA4 (close_convert_lead) pelo Measurement Protocol. Aditiva.

alter table public.leads
  add column if not exists ga_client_id text,
  add column if not exists ga_session_id text,
  add column if not exists ga_conversao_enviada_em timestamptz;

create or replace function public.upsert_lead(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  has_current_acquisition boolean := coalesce(p->'current_acquisition_available' = 'true'::jsonb, false);
begin
  if coalesce(p->>'lead_id', '') = '' then raise exception 'lead_id ausente no payload'; end if;

  insert into public.leads (
    lead_id, etapa_funil, etapa_atual, nome, whatsapp, email, cidade, estado,
    comportamento_halito, uso_antibiotico, opcao_interesse, periodo_preferido, datas_preferidas,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, google_match_gclid, origem, channel_derived,
    page_url, referrer, user_agent, current_entry_url, current_referrer, current_acquired_at, meta_fbp, meta_fbc, client_ip,
    first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term,
    first_gclid, first_fbclid, first_entry_url, first_referrer, first_acquired_at, first_channel_derived,
    entry_article_id, entry_source_id, entry_article_slug, last_article_id, last_article_slug,
    article_assists, editorial_cta_id, editorial_cta_destination, ga_client_id, ga_session_id
  ) values (
    p->>'lead_id', p->>'etapa_funil', nullif(p->>'etapa_atual','')::smallint, p->>'nome', p->>'whatsapp', p->>'email', p->>'cidade', p->>'estado',
    p->>'comportamento_halito', p->>'uso_antibiotico', p->>'opcao_interesse', p->>'periodo_preferido', p->>'datas_preferidas',
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign', p->>'utm_content', p->>'utm_term', p->>'fbclid', p->>'gclid', p->>'gclid', p->>'origem', p->>'channel_derived',
    p->>'page_url', p->>'referrer', p->>'user_agent', p->>'current_entry_url', p->>'current_referrer', nullif(p->>'current_acquired_at','')::timestamptz,
    p->>'meta_fbp', p->>'meta_fbc', p->>'client_ip',
    p->>'first_utm_source', p->>'first_utm_medium', p->>'first_utm_campaign', p->>'first_utm_content', p->>'first_utm_term',
    p->>'first_gclid', p->>'first_fbclid', p->>'first_entry_url', p->>'first_referrer', nullif(p->>'first_acquired_at','')::timestamptz, p->>'first_channel_derived',
    p->>'entry_article_id', p->>'entry_source_id', p->>'entry_article_slug', p->>'last_article_id', p->>'last_article_slug',
    p->'article_assists', p->>'editorial_cta_id', p->>'editorial_cta_destination', p->>'ga_client_id', p->>'ga_session_id'
  )
  on conflict (lead_id) do update set
    etapa_funil = coalesce(excluded.etapa_funil, public.leads.etapa_funil),
    etapa_atual = greatest(excluded.etapa_atual, public.leads.etapa_atual),
    nome = coalesce(excluded.nome, public.leads.nome), whatsapp = coalesce(excluded.whatsapp, public.leads.whatsapp),
    email = coalesce(excluded.email, public.leads.email), cidade = coalesce(excluded.cidade, public.leads.cidade), estado = coalesce(excluded.estado, public.leads.estado),
    comportamento_halito = coalesce(excluded.comportamento_halito, public.leads.comportamento_halito),
    uso_antibiotico = coalesce(excluded.uso_antibiotico, public.leads.uso_antibiotico), opcao_interesse = coalesce(excluded.opcao_interesse, public.leads.opcao_interesse),
    periodo_preferido = coalesce(excluded.periodo_preferido, public.leads.periodo_preferido), datas_preferidas = coalesce(excluded.datas_preferidas, public.leads.datas_preferidas),
    -- Contexto atual completo pode limpar uma campanha; payload legado/parcial preserva valores ausentes.
    utm_source = case when has_current_acquisition then excluded.utm_source else coalesce(excluded.utm_source, public.leads.utm_source) end,
    utm_medium = case when has_current_acquisition then excluded.utm_medium else coalesce(excluded.utm_medium, public.leads.utm_medium) end,
    utm_campaign = case when has_current_acquisition then excluded.utm_campaign else coalesce(excluded.utm_campaign, public.leads.utm_campaign) end,
    utm_content = case when has_current_acquisition then excluded.utm_content else coalesce(excluded.utm_content, public.leads.utm_content) end,
    utm_term = case when has_current_acquisition then excluded.utm_term else coalesce(excluded.utm_term, public.leads.utm_term) end,
    fbclid = case when has_current_acquisition then excluded.fbclid else coalesce(excluded.fbclid, public.leads.fbclid) end,
    gclid = case when has_current_acquisition then excluded.gclid else coalesce(excluded.gclid, public.leads.gclid) end,
    -- O matching Google conserva o último clique conhecido sem reclassificar a aquisição atual.
    google_match_gclid = coalesce(excluded.google_match_gclid, public.leads.google_match_gclid, public.leads.gclid),
    origem = case when has_current_acquisition then excluded.origem else coalesce(excluded.origem, public.leads.origem) end,
    channel_derived = case when has_current_acquisition then excluded.channel_derived else coalesce(excluded.channel_derived, public.leads.channel_derived) end,
    page_url = coalesce(excluded.page_url, public.leads.page_url), referrer = coalesce(excluded.referrer, public.leads.referrer), user_agent = coalesce(excluded.user_agent, public.leads.user_agent),
    current_entry_url = case when has_current_acquisition then excluded.current_entry_url else coalesce(excluded.current_entry_url, public.leads.current_entry_url) end,
    current_referrer = case when has_current_acquisition then excluded.current_referrer else coalesce(excluded.current_referrer, public.leads.current_referrer) end,
    current_acquired_at = case when has_current_acquisition then excluded.current_acquired_at else coalesce(excluded.current_acquired_at, public.leads.current_acquired_at) end,
    meta_fbp = coalesce(public.leads.meta_fbp, excluded.meta_fbp), meta_fbc = coalesce(public.leads.meta_fbc, excluded.meta_fbc), client_ip = coalesce(public.leads.client_ip, excluded.client_ip),
    first_utm_source = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_utm_source else coalesce(public.leads.first_utm_source, excluded.first_utm_source) end, first_utm_medium = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_utm_medium else coalesce(public.leads.first_utm_medium, excluded.first_utm_medium) end,
    first_utm_campaign = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_utm_campaign else coalesce(public.leads.first_utm_campaign, excluded.first_utm_campaign) end, first_utm_content = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_utm_content else coalesce(public.leads.first_utm_content, excluded.first_utm_content) end, first_utm_term = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_utm_term else coalesce(public.leads.first_utm_term, excluded.first_utm_term) end,
    first_gclid = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_gclid else coalesce(public.leads.first_gclid, excluded.first_gclid) end, first_fbclid = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_fbclid else coalesce(public.leads.first_fbclid, excluded.first_fbclid) end,
    first_entry_url = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_entry_url else coalesce(public.leads.first_entry_url, excluded.first_entry_url) end, first_referrer = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_referrer else coalesce(public.leads.first_referrer, excluded.first_referrer) end,
    first_acquired_at = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_acquired_at else coalesce(public.leads.first_acquired_at, excluded.first_acquired_at) end, first_channel_derived = case when public.leads.first_acquired_at is not null or public.leads.first_channel_derived is not null then public.leads.first_channel_derived else coalesce(public.leads.first_channel_derived, excluded.first_channel_derived) end,
    entry_article_id = coalesce(public.leads.entry_article_id, excluded.entry_article_id), entry_source_id = coalesce(public.leads.entry_source_id, excluded.entry_source_id), entry_article_slug = coalesce(public.leads.entry_article_slug, excluded.entry_article_slug),
    last_article_id = coalesce(excluded.last_article_id, public.leads.last_article_id), last_article_slug = coalesce(excluded.last_article_slug, public.leads.last_article_slug),
    article_assists = coalesce(excluded.article_assists, public.leads.article_assists), editorial_cta_id = coalesce(excluded.editorial_cta_id, public.leads.editorial_cta_id),
    editorial_cta_destination = coalesce(excluded.editorial_cta_destination, public.leads.editorial_cta_destination),
    -- O primeiro visitante GA4 conhecido fica fixo, como os identificadores de matching da Meta.
    ga_client_id = coalesce(public.leads.ga_client_id, excluded.ga_client_id),
    ga_session_id = coalesce(public.leads.ga_session_id, excluded.ga_session_id);
end;
$function$;
