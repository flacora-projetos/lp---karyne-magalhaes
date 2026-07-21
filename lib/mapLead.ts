/**
 * Mapeia o payload que a LP já envia ao Apps Script para a linha da tabela
 * `leads` do Postgres. NÃO altera o payload nem o contrato existente — apenas
 * traduz nomes camelCase → snake_case e deriva a origem.
 */

export interface SheetsPayload {
  leadId?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string; // etapa do funil (Kanban)
  currentStep?: number;
  nomeCompleto?: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  estado?: string;
  comportamentoHalito?: string;
  opcaoInteresse?: string;
  usoAntibiotico?: string;
  periodoPreferido?: string;
  datasPreferidas?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  [key: string]: unknown;
}

const clean = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/**
 * Deriva a origem do tráfego seguindo a mesma lógica da aba Resumo da planilha
 * (seção 19 do doc de contexto):
 *  - UTM Source define a origem;
 *  - sem UTM, FBCLID => Meta Ads; GCLID => Google Ads;
 *  - nada disso => Direto.
 */
export function derivarOrigem(p: SheetsPayload): string {
  const src = (clean(p.utmSource) || '').toLowerCase();

  if (src) {
    if (src.includes('google')) return 'Google Ads';
    if (['facebook', 'instagram', 'meta', 'ig', 'fb'].some((k) => src.includes(k))) return 'Meta Ads';
    // Outra origem com UTM explícita: preserva o valor informado.
    return clean(p.utmSource) as string;
  }

  if (clean(p.fbclid)) return 'Meta Ads';
  if (clean(p.gclid)) return 'Google Ads';
  return 'Direto';
}

/**
 * Monta o objeto de upsert. Só inclui campos de captura (nunca campos
 * comerciais, que são editados manualmente no painel). `atualizado_em` é
 * cuidado pelo trigger no banco.
 */
export function mapPayloadToRow(p: SheetsPayload) {
  return {
    lead_id: clean(p.leadId),
    etapa_funil: clean(p.status),
    nome: clean(p.nomeCompleto),
    whatsapp: clean(p.whatsapp),
    email: clean(p.email),
    cidade: clean(p.cidade),
    estado: clean(p.estado),
    comportamento_halito: clean(p.comportamentoHalito),
    uso_antibiotico: clean(p.usoAntibiotico),
    opcao_interesse: clean(p.opcaoInteresse),
    periodo_preferido: clean(p.periodoPreferido),
    datas_preferidas: clean(p.datasPreferidas),
    utm_source: clean(p.utmSource),
    utm_medium: clean(p.utmMedium),
    utm_campaign: clean(p.utmCampaign),
    utm_content: clean(p.utmContent),
    utm_term: clean(p.utmTerm),
    fbclid: clean(p.fbclid),
    gclid: clean(p.gclid),
    origem: derivarOrigem(p),
    page_url: clean(p.pageUrl),
    referrer: clean(p.referrer),
    user_agent: clean(p.userAgent),
  };
}
