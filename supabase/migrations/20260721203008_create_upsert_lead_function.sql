-- Upsert atômico por lead_id, com merge por COALESCE: um payload que chega
-- com um campo nulo NÃO apaga um valor já preenchido (a LP envia payloads
-- cumulativos e as chamadas são fire-and-forget, podendo chegar fora de ordem).
-- Só mexe em campos de captura; campos comerciais são editados no painel.
create or replace function public.upsert_lead(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(p->>'lead_id', '') = '' then
    raise exception 'lead_id ausente no payload';
  end if;

  insert into public.leads (
    lead_id, etapa_funil, nome, whatsapp, email, cidade, estado,
    comportamento_halito, uso_antibiotico, opcao_interesse,
    periodo_preferido, datas_preferidas,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    fbclid, gclid, origem, page_url, referrer, user_agent
  )
  values (
    p->>'lead_id', p->>'etapa_funil', p->>'nome', p->>'whatsapp', p->>'email',
    p->>'cidade', p->>'estado', p->>'comportamento_halito', p->>'uso_antibiotico',
    p->>'opcao_interesse', p->>'periodo_preferido', p->>'datas_preferidas',
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign', p->>'utm_content',
    p->>'utm_term', p->>'fbclid', p->>'gclid', p->>'origem', p->>'page_url',
    p->>'referrer', p->>'user_agent'
  )
  on conflict (lead_id) do update set
    etapa_funil          = coalesce(excluded.etapa_funil, public.leads.etapa_funil),
    nome                 = coalesce(excluded.nome, public.leads.nome),
    whatsapp             = coalesce(excluded.whatsapp, public.leads.whatsapp),
    email                = coalesce(excluded.email, public.leads.email),
    cidade               = coalesce(excluded.cidade, public.leads.cidade),
    estado               = coalesce(excluded.estado, public.leads.estado),
    comportamento_halito = coalesce(excluded.comportamento_halito, public.leads.comportamento_halito),
    uso_antibiotico      = coalesce(excluded.uso_antibiotico, public.leads.uso_antibiotico),
    opcao_interesse      = coalesce(excluded.opcao_interesse, public.leads.opcao_interesse),
    periodo_preferido    = coalesce(excluded.periodo_preferido, public.leads.periodo_preferido),
    datas_preferidas     = coalesce(excluded.datas_preferidas, public.leads.datas_preferidas),
    utm_source           = coalesce(excluded.utm_source, public.leads.utm_source),
    utm_medium           = coalesce(excluded.utm_medium, public.leads.utm_medium),
    utm_campaign         = coalesce(excluded.utm_campaign, public.leads.utm_campaign),
    utm_content          = coalesce(excluded.utm_content, public.leads.utm_content),
    utm_term             = coalesce(excluded.utm_term, public.leads.utm_term),
    fbclid               = coalesce(excluded.fbclid, public.leads.fbclid),
    gclid                = coalesce(excluded.gclid, public.leads.gclid),
    origem               = coalesce(excluded.origem, public.leads.origem),
    page_url             = coalesce(excluded.page_url, public.leads.page_url),
    referrer             = coalesce(excluded.referrer, public.leads.referrer),
    user_agent           = coalesce(excluded.user_agent, public.leads.user_agent);
end;
$$;

-- Trava: só a service role (usada no servidor) pode chamar. Nunca anon/authenticated.
revoke all on function public.upsert_lead(jsonb) from public;
revoke all on function public.upsert_lead(jsonb) from anon;
revoke all on function public.upsert_lead(jsonb) from authenticated;
grant execute on function public.upsert_lead(jsonb) to service_role;
;
