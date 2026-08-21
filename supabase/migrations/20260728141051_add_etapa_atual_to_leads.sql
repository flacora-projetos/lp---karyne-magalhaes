alter table public.leads
  add column if not exists etapa_atual smallint;

comment on column public.leads.etapa_atual is
  'Etapa numerica do modal em que o lead parou (currentStep enviado pela LP). Ordem a partir de 2026-07-28: 1 WhatsApp, 2 situacao, 3 antibiotico, 4 periodo, 5 identificacao, 6 modalidade/preco, 7 revisao. Nulo nos registros anteriores a esta coluna.';;
