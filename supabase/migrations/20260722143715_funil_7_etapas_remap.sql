-- Novo funil de 7 etapas. status_comercial continua text + CHECK.
-- 1) remove o CHECK antigo para permitir os novos valores
alter table public.leads drop constraint if exists leads_status_comercial_check;

-- 2) de-para dos valores existentes (preserva o que a Karyne já arrastou)
update public.leads set status_comercial = case status_comercial
  when 'novo'                then 'contato_realizado'
  when 'contatado'           then 'contato_realizado'
  when 'aguardando_resposta' then 'negociando_consulta'
  when 'em_atendimento'      then 'negociando_consulta'
  when 'consulta_marcada'    then 'consulta_agendada'
  when 'consulta_realizada'  then 'consulta_realizada'
  when 'tratamento_fechado'  then 'consulta_realizada'
  when 'nao_fechou'          then 'outros_invalido'
  when 'lead_invalido'       then 'outros_invalido'
  else 'outros_invalido'
end;

-- 3) todo lead novo (ingestão da LP) entra em "Contato Realizado"
alter table public.leads alter column status_comercial set default 'contato_realizado';

-- 4) novo CHECK com as 7 etapas
alter table public.leads add constraint leads_status_comercial_check
  check (status_comercial = any (array[
    'contato_realizado','negociando_consulta','desistiu_consulta',
    'consulta_agendada','consulta_realizada','estorno_cancelada','outros_invalido'
  ]));;
