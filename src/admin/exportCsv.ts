import type { Lead } from './types';
import { STATUS_LABEL } from './types';
import { dateTime, dateOnly } from './format';

// Colunas exportadas, na ordem em que aparecem no CSV. `id` (uuid interno)
// fica de fora — não é útil pro time comercial.
const COLUMNS: [keyof Lead, string][] = [
  // Identificação e datas
  ['lead_id', 'ID do Lead'],
  ['criado_em', 'Criado em'],
  ['atualizado_em', 'Atualizado em'],
  // Contato
  ['nome', 'Nome'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'E-mail'],
  ['cidade', 'Cidade'],
  ['estado', 'Estado'],
  // Respostas do filtro
  ['etapa_funil', 'Etapa do Funil'],
  ['etapa_atual', 'Etapa Atual'],
  ['comportamento_halito', 'Comportamento (Hálito)'],
  ['uso_antibiotico', 'Uso de Antibiótico'],
  ['opcao_interesse', 'Opção de Interesse'],
  ['periodo_preferido', 'Período Preferido'],
  ['datas_preferidas', 'Datas Preferidas'],
  // Comercial
  ['status_comercial', 'Status Comercial'],
  ['data_consulta', 'Data da Consulta'],
  ['valor_fechado', 'Valor Fechado'],
  ['motivo_perda', 'Motivo da Perda'],
  ['responsavel', 'Responsável'],
  ['observacoes', 'Observações'],
  // Atribuição
  ['origem', 'Origem'],
  ['utm_source', 'UTM Source'],
  ['utm_medium', 'UTM Medium'],
  ['utm_campaign', 'UTM Campaign'],
  ['utm_content', 'UTM Content'],
  ['utm_term', 'UTM Term'],
  ['fbclid', 'FBCLID'],
  ['gclid', 'GCLID'],
  ['page_url', 'URL da Página'],
  ['referrer', 'Referrer'],
  ['user_agent', 'User Agent'],
];

// Escapa um valor pro formato CSV (separador ';', usado pelo Excel pt-BR).
// Também neutraliza fórmulas (CSV injection) prefixando com apóstrofo quando
// o valor começa com =, +, - ou @.
function escapeCsvValue(raw: string): string {
  let value = raw;
  if (/^[=+\-@]/.test(value)) {
    value = `'${value}`;
  }
  if (/[;"\n\r]/.test(value)) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Formata o valor de um campo específico do lead para string, antes do escape.
// Trata null/undefined antes de chamar dateTime/dateOnly (que retornam '—').
function formatField(lead: Lead, key: keyof Lead): string {
  const value = lead[key];

  if (value === null || value === undefined) return '';

  if (key === 'criado_em' || key === 'atualizado_em') {
    return dateTime(value as string);
  }
  if (key === 'data_consulta') {
    return dateOnly(value as string);
  }
  if (key === 'status_comercial') {
    return STATUS_LABEL[value as Lead['status_comercial']];
  }
  if (key === 'valor_fechado') {
    return (value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return String(value);
}

export function leadsToCsv(leads: Lead[]): string {
  const header = COLUMNS.map(([, label]) => escapeCsvValue(label)).join(';');
  const rows = leads.map((lead) =>
    COLUMNS.map(([key]) => escapeCsvValue(formatField(lead, key))).join(';')
  );
  return [header, ...rows].join('\r\n');
}

// Gera o CSV e dispara o download no navegador (100% client-side).
export function downloadLeadsCsv(leads: Lead[]): void {
  const csv = leadsToCsv(leads);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, '0');
  const d = String(hoje.getDate()).padStart(2, '0');

  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-karyne-${y}-${m}-${d}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
