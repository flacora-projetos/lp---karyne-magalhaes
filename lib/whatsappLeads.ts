/**
 * Contatos que chegam direto no WhatsApp (sem passar pelo filtro do site):
 * anúncios da Meta com destino WhatsApp e a triagem enviada pela mensagem
 * automática. Sem imports, para ser usado pela API e pelo painel.
 */
export const WHATSAPP_CAMPAIGN = 'OUT/26 — LEADS (WhatsApp)';

/** Código que vai na mensagem pronta de cada anúncio → nome do anúncio na Meta. */
export const WHATSAPP_ADS: { code: string; label: string }[] = [
  { code: 'W01', label: 'Boca seca' },
  { code: 'W04', label: 'Receitas milagrosas' },
  { code: 'W05', label: 'O que muda depois do diagnóstico' },
];

export const ANUNCIO_SEM_CODIGO = 'anuncio_sem_codigo';
export const NAO_VEIO_DE_ANUNCIO = 'nao_anuncio';

/** Últimos 8 dígitos: igualam "(62) 99999-1234", "62999991234" e "+55 62 99999-1234". */
export function phoneKey(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : '';
}

export interface ManualLeadInput {
  nome: string;
  whatsapp: string;
  anuncio: string;
}

/** Campos de aquisição do cadastro manual, no mesmo formato que a LP grava. */
export function manualAcquisition(anuncio: string) {
  if (anuncio === NAO_VEIO_DE_ANUNCIO) {
    return {
      utm_source: 'whatsapp', utm_medium: 'manual', utm_campaign: null, utm_content: null,
      origem: 'WhatsApp', channel_derived: 'Messaging',
    };
  }
  const ad = WHATSAPP_ADS.find((item) => item.code === anuncio);
  return {
    utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: WHATSAPP_CAMPAIGN,
    utm_content: ad ? `${ad.code} · ${ad.label}` : null,
    origem: 'Meta Ads', channel_derived: 'Paid Social',
  };
}

export function isValidAnuncio(anuncio: string): boolean {
  return anuncio === NAO_VEIO_DE_ANUNCIO || anuncio === ANUNCIO_SEM_CODIGO || WHATSAPP_ADS.some((ad) => ad.code === anuncio);
}
