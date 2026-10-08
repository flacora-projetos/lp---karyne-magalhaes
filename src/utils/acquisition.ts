export type RawAcquisition = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  fbclid: string;
  entryUrl: string;
  referrer: string;
  capturedAt: string;
};

type EditorialContext = {
  entryArticleId?: string;
  entrySourceId?: string;
  entryArticleSlug?: string;
  lastArticleId?: string;
  lastArticleSlug?: string;
  articleAssists?: Array<{articleId?: string; slug?: string; at?: string}>;
  ctaId?: string;
  ctaDestination?: string;
};

const FIRST_SESSION = 'dacora_first_acquisition_v1';
const FIRST_PERSISTED = 'dacora_first_acquisition_persisted_v1';
const CURRENT_SESSION = 'dacora_current_acquisition_v1';
const CURRENT_PERSISTED = 'dacora_current_acquisition_persisted_v1';
const EDITORIAL_SESSION = 'dacora_editorial_context_v1';
const EDITORIAL_PERSISTED = 'dacora_editorial_context_persisted_v1';
const CONSENT_KEY = 'dacora_analytics_consent';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

const hasAnalyticsConsent = () => {
  try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
};

const normalizeHost = (value: string) => value.toLowerCase().replace(/^www\./, '');
const hostFromUrl = (value: string) => {
  try { return normalizeHost(new URL(value).hostname); } catch { return ''; }
};
const isDomainOrSubdomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const isLocalizedDomain = (host: string, brand: string) => new RegExp(`(^|\\.)${brand}\\.(?:com|[a-z]{2}|com\\.[a-z]{2}|co\\.[a-z]{2})$`).test(host);

function currentRaw(): RawAcquisition {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmContent: params.get('utm_content') || '',
    utmTerm: params.get('utm_term') || '',
    gclid: params.get('gclid') || '',
    fbclid: params.get('fbclid') || '',
    entryUrl: window.location.href,
    referrer: document.referrer || '',
    capturedAt: new Date().toISOString(),
  };
}

function sourceProvider(source: string) {
  const normalized = source.toLowerCase().trim();
  if (/(^|[._-])google([._-]|$)/.test(normalized)) return 'Google Ads';
  if (/(^|[._-])(bing|microsoft)([._-]|$)/.test(normalized)) return 'Microsoft Ads';
  if (/(^|[._-])(facebook|instagram|meta)([._-]|$)/.test(normalized)) return 'Meta Ads';
  if (/(^|[._-])tiktok([._-]|$)/.test(normalized)) return 'TikTok Ads';
  if (/(^|[._-])linkedin([._-]|$)/.test(normalized)) return 'LinkedIn Ads';
  if (/(^|[._-])pinterest([._-]|$)/.test(normalized)) return 'Pinterest Ads';
  return '';
}

function referrerKind(referrer: string) {
  const host = hostFromUrl(referrer);
  const self = typeof window !== 'undefined' ? normalizeHost(window.location.hostname) : 'tratamentodomauhalito.com.br';
  if (!host || host === self) return {kind:'',provider:''};
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

export function classifyAcquisition(raw: Partial<RawAcquisition>): {channel:string; provider:string} {
  const medium = (raw.utmMedium || '').toLowerCase().trim();
  const source = (raw.utmSource || '').toLowerCase().trim();
  const paidMedium = /^(cpc|ppc|paid|paid_search|paid-social|paid_social|display)$/;
  const provider = sourceProvider(source);
  const ref = referrerKind(raw.referrer || '');

  if (raw.gclid) return {channel:'Paid Search',provider:'Google Ads'};
  if (paidMedium.test(medium)) {
    if (provider === 'Google Ads' || provider === 'Microsoft Ads') return {channel:'Paid Search',provider};
    if (provider) return {channel:'Paid Social',provider};
    return {channel:'Paid Other',provider:source || 'Paid Media'};
  }
  if (medium === 'organic') return {channel:'Organic Search',provider:provider.replace(' Ads','') || source || 'Search'};
  if (ref.kind === 'search') return {channel:'Organic Search',provider:ref.provider};
  if (ref.kind === 'social') return {channel:'Organic Social',provider:ref.provider};
  if (ref.kind === 'referral') return {channel:'Referral',provider:ref.provider};
  if (!source && !medium && !raw.gclid && !raw.fbclid) return {channel:'Direct',provider:'Direct'};
  return {channel:'Unassigned',provider:source || 'Unassigned'};
}

export function deriveChannel(raw: Partial<RawAcquisition>): string {
  return classifyAcquisition(raw).channel;
}

function readPersistedField<T>(key: string, field: 'raw' | 'context'): T | null {
  if (!hasAnalyticsConsent()) return null;
  try {
    const envelope = safeParse<{expiresAt?: number; raw?: T; context?: T}>(localStorage.getItem(key));
    if (!envelope?.expiresAt || envelope.expiresAt < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return (envelope[field] || null) as T | null;
  } catch { return null; }
}

function persistField<T>(key: string, field: 'raw' | 'context', value: T) {
  if (!hasAnalyticsConsent()) return;
  try { localStorage.setItem(key, JSON.stringify({expiresAt: Date.now() + TTL_MS, [field]:value})); } catch { /* noop */ }
}

function hasCampaignSignal(raw: Partial<RawAcquisition>) {
  return Boolean(raw.utmSource || raw.utmMedium || raw.utmCampaign || raw.utmContent || raw.utmTerm || raw.gclid || raw.fbclid);
}

function isExternalTouch(raw: RawAcquisition) {
  const currentHost = normalizeHost(window.location.hostname);
  const refHost = hostFromUrl(raw.referrer);
  return hasCampaignSignal(raw) || Boolean(refHost && refHost !== currentHost);
}

export function captureFirstAcquisition() {
  if (typeof window === 'undefined') return;
  const raw = currentRaw();
  try {
    const sessionFirst = safeParse<RawAcquisition>(sessionStorage.getItem(FIRST_SESSION));
    const persistedFirst = readPersistedField<RawAcquisition>(FIRST_PERSISTED, 'raw');
    const first = sessionFirst || persistedFirst || raw;
    if (!sessionFirst) sessionStorage.setItem(FIRST_SESSION, JSON.stringify(first));
    if (!persistedFirst) persistField(FIRST_PERSISTED, 'raw', first);

    const sessionCurrent = safeParse<RawAcquisition>(sessionStorage.getItem(CURRENT_SESSION));
    const persistedCurrent = readPersistedField<RawAcquisition>(CURRENT_PERSISTED, 'raw');
    const current = isExternalTouch(raw) ? raw : (sessionCurrent || persistedCurrent || raw);
    if (isExternalTouch(raw) || (!sessionCurrent && !persistedCurrent)) sessionStorage.setItem(CURRENT_SESSION, JSON.stringify(current));
    if (isExternalTouch(raw) || !persistedCurrent) persistField(CURRENT_PERSISTED, 'raw', current);
  } catch { /* armazenamento indisponível: segue sem persistência */ }
}

export function getAttributionExtras() {
  if (typeof window === 'undefined') return {};
  captureFirstAcquisition();
  let first: RawAcquisition | null = null;
  let current: RawAcquisition | null = null;
  let editorial: EditorialContext | null = null;
  try {
    first = safeParse<RawAcquisition>(sessionStorage.getItem(FIRST_SESSION)) || readPersistedField<RawAcquisition>(FIRST_PERSISTED, 'raw');
    current = safeParse<RawAcquisition>(sessionStorage.getItem(CURRENT_SESSION)) || readPersistedField<RawAcquisition>(CURRENT_PERSISTED, 'raw');
    editorial = safeParse<EditorialContext>(sessionStorage.getItem(EDITORIAL_SESSION)) || readPersistedField<EditorialContext>(EDITORIAL_PERSISTED, 'context');
  } catch { /* noop */ }
  const currentClassification = current ? classifyAcquisition(current) : {channel:'',provider:''};
  return {
    currentAcquisitionAvailable: Boolean(current),
    firstUtmSource: first?.utmSource || '',
    firstUtmMedium: first?.utmMedium || '',
    firstUtmCampaign: first?.utmCampaign || '',
    firstUtmContent: first?.utmContent || '',
    firstUtmTerm: first?.utmTerm || '',
    firstGclid: first?.gclid || '',
    firstFbclid: first?.fbclid || '',
    firstEntryUrl: first?.entryUrl || '',
    firstReferrer: first?.referrer || '',
    firstAcquiredAt: first?.capturedAt || '',
    firstChannelDerived: first ? deriveChannel(first) : '',
    currentUtmSource: current?.utmSource || '',
    currentUtmMedium: current?.utmMedium || '',
    currentUtmCampaign: current?.utmCampaign || '',
    currentUtmContent: current?.utmContent || '',
    currentUtmTerm: current?.utmTerm || '',
    currentGclid: current?.gclid || '',
    currentFbclid: current?.fbclid || '',
    currentEntryUrl: current?.entryUrl || '',
    currentReferrer: current?.referrer || '',
    currentAcquiredAt: current?.capturedAt || '',
    currentChannelDerived: currentClassification.channel,
    currentProviderDerived: currentClassification.provider,
    entryArticleId: editorial?.entryArticleId || '',
    entrySourceId: editorial?.entrySourceId || '',
    entryArticleSlug: editorial?.entryArticleSlug || '',
    lastArticleId: editorial?.lastArticleId || '',
    lastArticleSlug: editorial?.lastArticleSlug || '',
    articleAssists: editorial?.articleAssists || [],
    editorialCtaId: editorial?.ctaId || '',
    editorialCtaDestination: editorial?.ctaDestination || '',
  };
}
