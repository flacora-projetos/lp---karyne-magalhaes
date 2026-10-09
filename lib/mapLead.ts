/**
 * Traduz o payload da LP para a tabela `leads` e separa três contratos:
 * primeira aquisição, entrada externa atual e assistência editorial.
 */
export interface SheetsPayload {
  leadId?: string; createdAt?: string; updatedAt?: string; status?: string; currentStep?: number;
  nomeCompleto?: string; whatsapp?: string; email?: string; cidade?: string; estado?: string;
  comportamentoHalito?: string; opcaoInteresse?: string; usoAntibiotico?: string;
  periodoPreferido?: string; datasPreferidas?: string;
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string;
  fbclid?: string; gclid?: string; pageUrl?: string; referrer?: string; userAgent?: string;
  metaFbp?: string; metaFbc?: string; clientIp?: string;
  firstUtmSource?: string; firstUtmMedium?: string; firstUtmCampaign?: string; firstUtmContent?: string; firstUtmTerm?: string;
  firstGclid?: string; firstFbclid?: string; firstEntryUrl?: string; firstReferrer?: string;
  firstAcquiredAt?: string; firstChannelDerived?: string;
  currentAcquisitionAvailable?: boolean;
  currentEntryUrl?: string; currentReferrer?: string; currentAcquiredAt?: string; currentChannelDerived?: string; currentProviderDerived?: string;
  entryArticleId?: string; entrySourceId?: string; entryArticleSlug?: string;
  lastArticleId?: string; lastArticleSlug?: string; articleAssists?: unknown[];
  editorialCtaId?: string; editorialCtaDestination?: string;
  gaClientId?: string; gaSessionId?: string;
  [key: string]: unknown;
}

const clean = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const cleanStep = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
};

// Identificadores do GA4 são só dígitos e ponto; qualquer outra coisa é descartada.
const cleanGaId = (v: unknown): string | null => {
  const s = clean(v);
  return s && /^\d{1,20}(\.\d{1,20})?$/.test(s) ? s : null;
};

const paidMedium =(medium: string) => /^(cpc|ppc|paid|paid_search|paid-social|paid_social|display)$/.test(medium);
const normalizeHost = (value: string) => value.toLowerCase().replace(/^www\./, '');
const hostFromUrl = (value: string) => { try { return normalizeHost(new URL(value).hostname); } catch { return ''; } };
const isDomainOrSubdomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const isLocalizedDomain = (host: string, brand: string) => new RegExp(`(^|\\.)${brand}\\.(?:com|[a-z]{2}|com\\.[a-z]{2}|co\\.[a-z]{2})$`).test(host);
const sourceProvider = (source: string) => {
  if (/(^|[._-])google([._-]|$)/.test(source)) return 'Google Ads';
  if (/(^|[._-])(bing|microsoft)([._-]|$)/.test(source)) return 'Microsoft Ads';
  if (/(^|[._-])(facebook|instagram|meta)([._-]|$)/.test(source)) return 'Meta Ads';
  if (/(^|[._-])tiktok([._-]|$)/.test(source)) return 'TikTok Ads';
  if (/(^|[._-])linkedin([._-]|$)/.test(source)) return 'LinkedIn Ads';
  if (/(^|[._-])pinterest([._-]|$)/.test(source)) return 'Pinterest Ads';
  return '';
};

function referrerKind(referrer: string) {
  const host = hostFromUrl(referrer);
  if (!host || host === 'tratamentodomauhalito.com.br') return {kind:'',provider:''};
  if (isLocalizedDomain(host, 'google')) return {kind:'search',provider:'Google'};
  if (isDomainOrSubdomain(host, 'bing.com')) return {kind:'search',provider:'Bing'};
  if (isDomainOrSubdomain(host, 'duckduckgo.com')) return {kind:'search',provider:'DuckDuckGo'};
  if (isLocalizedDomain(host, 'yahoo')) return {kind:'search',provider:'Yahoo'};
  if (isDomainOrSubdomain(host, 'baidu.com') || isDomainOrSubdomain(host, 'baidu.cn')) return {kind:'search',provider:'Baidu'};
  if (/(^|\.)(facebook|instagram)\.com$/.test(host)) return {kind:'social',provider:'Meta'};
  if (/(^|\.)tiktok\.com$/.test(host)) return {kind:'social',provider:'TikTok'};
  if (/(^|\.)linkedin\.com$/.test(host)) return {kind:'social',provider:'LinkedIn'};
  if (isLocalizedDomain(host, 'pinterest')) return {kind:'social',provider:'Pinterest'};
  if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) return {kind:'social',provider:'X'};
  return {kind:'referral',provider:host};
}

export function derivarCanal(p: SheetsPayload): string {
  const source = (clean(p.utmSource) || '').toLowerCase();
  const medium = (clean(p.utmMedium) || '').toLowerCase();
  const provider = sourceProvider(source);
  const ref = referrerKind(clean(p.currentReferrer) || clean(p.referrer) || '');
  if (clean(p.gclid)) return 'Paid Search';
  if (paidMedium(medium)) {
    if (provider === 'Google Ads' || provider === 'Microsoft Ads') return 'Paid Search';
    if (provider) return 'Paid Social';
    return 'Paid Other';
  }
  if (medium === 'organic' || ref.kind === 'search') return 'Organic Search';
  if (ref.kind === 'social') return 'Organic Social';
  if (ref.kind === 'referral') return 'Referral';
  if (!source && !medium && !clean(p.gclid) && !clean(p.fbclid)) return 'Direct';
  return 'Unassigned';
}

/** `origem` preserva o provedor quando ele é conhecido; `channel_derived` guarda o canal. */
export function derivarOrigem(p: SheetsPayload): string {
  const source = (clean(p.utmSource) || '').toLowerCase();
  const medium = (clean(p.utmMedium) || '').toLowerCase();
  const provider = sourceProvider(source);
  const ref = referrerKind(clean(p.currentReferrer) || clean(p.referrer) || '');
  if (clean(p.gclid)) return 'Google Ads';
  if (paidMedium(medium)) return provider || 'Mídia paga';
  if (medium === 'organic' || ref.kind === 'search') return 'Busca orgânica';
  if (ref.kind === 'social') return 'Social orgânico';
  if (ref.kind === 'referral') return 'Referência';
  if (!source && !medium && !clean(p.gclid) && !clean(p.fbclid)) return 'Direto';
  return 'Não atribuído';
}

function cleanAssists(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 20).map((item) => {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;
    return {articleId: clean(obj.articleId), slug: clean(obj.slug), at: clean(obj.at)};
  }).filter(Boolean);
}

export function mapPayloadToRow(p: SheetsPayload) {
  const hasCurrentAcquisition = p.currentAcquisitionAvailable === true;
  const hasAcquisition = hasCurrentAcquisition || [
    'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'fbclid', 'gclid', 'referrer',
    'currentReferrer', 'currentChannelDerived', 'currentProviderDerived',
  ].some((key) => Object.prototype.hasOwnProperty.call(p, key));
  return {
    lead_id: clean(p.leadId), etapa_funil: clean(p.status), etapa_atual: cleanStep(p.currentStep),
    nome: clean(p.nomeCompleto), whatsapp: clean(p.whatsapp), email: clean(p.email), cidade: clean(p.cidade), estado: clean(p.estado),
    comportamento_halito: clean(p.comportamentoHalito), uso_antibiotico: clean(p.usoAntibiotico),
    opcao_interesse: clean(p.opcaoInteresse), periodo_preferido: clean(p.periodoPreferido), datas_preferidas: clean(p.datasPreferidas),
    utm_source: clean(p.utmSource), utm_medium: clean(p.utmMedium), utm_campaign: clean(p.utmCampaign), utm_content: clean(p.utmContent), utm_term: clean(p.utmTerm),
    current_acquisition_available: hasCurrentAcquisition,
    fbclid: clean(p.fbclid), gclid: clean(p.gclid),
    origem: hasAcquisition ? clean(p.currentProviderDerived) || derivarOrigem(p) : null,
    channel_derived: hasAcquisition ? clean(p.currentChannelDerived) || derivarCanal(p) : null,
    page_url: clean(p.pageUrl), referrer: clean(p.referrer), user_agent: clean(p.userAgent),
    current_entry_url: clean(p.currentEntryUrl), current_referrer: clean(p.currentReferrer), current_acquired_at: clean(p.currentAcquiredAt),
    meta_fbp: clean(p.metaFbp), meta_fbc: clean(p.metaFbc), client_ip: clean(p.clientIp),
    first_utm_source: clean(p.firstUtmSource), first_utm_medium: clean(p.firstUtmMedium), first_utm_campaign: clean(p.firstUtmCampaign),
    first_utm_content: clean(p.firstUtmContent), first_utm_term: clean(p.firstUtmTerm), first_gclid: clean(p.firstGclid), first_fbclid: clean(p.firstFbclid),
    first_entry_url: clean(p.firstEntryUrl), first_referrer: clean(p.firstReferrer), first_acquired_at: clean(p.firstAcquiredAt), first_channel_derived: clean(p.firstChannelDerived),
    entry_article_id: clean(p.entryArticleId), entry_source_id: clean(p.entrySourceId), entry_article_slug: clean(p.entryArticleSlug),
    last_article_id: clean(p.lastArticleId), last_article_slug: clean(p.lastArticleSlug), article_assists: cleanAssists(p.articleAssists),
    editorial_cta_id: clean(p.editorialCtaId), editorial_cta_destination: clean(p.editorialCtaDestination),
    ga_client_id: cleanGaId(p.gaClientId), ga_session_id: cleanGaId(p.gaSessionId),
  };
}
