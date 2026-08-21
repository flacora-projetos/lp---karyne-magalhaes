-- Mini CRM administrativo da LP da Dra. Karyne Magalhães
-- Tabela única de leads: espelha o payload que já vai para o Apps Script
-- (tracking/funil) e acrescenta os campos comerciais pedidos na proposta.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_id text unique not null,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Etapa do funil de captura (valores do Kanban da planilha).
  -- Conceito DIFERENTE de status_comercial (ver proposta / handoff seção 5).
  etapa_funil text,

  -- Dados de contato / identificação
  nome text,
  whatsapp text,
  email text,
  cidade text,
  estado text,

  -- Contexto clínico leve (decidido com o cliente que entra no banco).
  -- Sensível: só deve aparecer na tela de detalhe do lead, nunca em relatório agregado.
  comportamento_halito text,
  uso_antibiotico text,

  -- Contexto operacional do filtro (não sensível), útil no atendimento
  opcao_interesse text,
  periodo_preferido text,
  datas_preferidas text,

  -- Tracking de origem
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  gclid text,
  origem text, -- derivado no servidor: 'Google Ads' | 'Meta Ads' | 'Direto'

  -- Metadados técnicos (apoio / debug de origem)
  page_url text,
  referrer text,
  user_agent text,

  -- Campos comerciais (preenchidos manualmente pela equipe no painel)
  status_comercial text not null default 'novo',
  data_consulta date,
  valor_fechado numeric(10,2),
  motivo_perda text,
  observacoes text,
  responsavel text,

  constraint leads_status_comercial_check check (
    status_comercial in (
      'novo',
      'contatado',
      'aguardando_resposta',
      'em_atendimento',
      'consulta_marcada',
      'consulta_realizada',
      'tratamento_fechado',
      'nao_fechou',
      'lead_invalido'
    )
  )
);

comment on table public.leads is 'Leads do mini CRM da LP da Dra. Karyne. Escrita via service role (api/leads). Leitura/edição via painel /admin autenticado.';
comment on column public.leads.etapa_funil is 'Etapa do funil de captura (Kanban da planilha). Diferente de status_comercial.';
comment on column public.leads.comportamento_halito is 'Dado clínico leve. Nunca expor em relatório agregado.';
comment on column public.leads.uso_antibiotico is 'Dado clínico leve. Nunca expor em relatório agregado.';

-- Índices para os filtros do painel
create index if not exists leads_criado_em_idx on public.leads (criado_em desc);
create index if not exists leads_status_comercial_idx on public.leads (status_comercial);
create index if not exists leads_origem_idx on public.leads (origem);
create index if not exists leads_responsavel_idx on public.leads (responsavel);
create index if not exists leads_utm_campaign_idx on public.leads (utm_campaign);

-- Mantém atualizado_em em UPDATEs
create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists leads_set_atualizado_em on public.leads;
create trigger leads_set_atualizado_em
  before update on public.leads
  for each row
  execute function public.set_atualizado_em();

-- RLS: ninguém acessa via anon key. Só usuários autenticados (equipe) leem/editam.
-- As escritas da LP passam pela service role no servidor, que ignora RLS.
alter table public.leads enable row level security;

drop policy if exists "equipe_select" on public.leads;
create policy "equipe_select"
  on public.leads
  for select
  to authenticated
  using (true);

drop policy if exists "equipe_update" on public.leads;
create policy "equipe_update"
  on public.leads
  for update
  to authenticated
  using (true)
  with check (true);
;
