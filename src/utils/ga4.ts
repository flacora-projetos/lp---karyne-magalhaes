export const GA4_MEASUREMENT_ID = 'G-3783BP5DSB';

type Gtag = (...args: unknown[]) => void;
type GaIds = {gaClientId: string; gaSessionId: string};

const GA_IDS_KEY = 'dacora_ga_ids_v1';
let cachedIds: GaIds = {gaClientId: '', gaSessionId: ''};

const browserGtag = (): Gtag | undefined => {
  if (typeof window === 'undefined') return undefined;
  const gtag = (window as unknown as {gtag?: Gtag}).gtag;
  return typeof gtag === 'function' ? gtag : undefined;
};

// Só texto curto ou número inteiro chega ao GA4: nada de contato, resposta clínica ou objeto.
export function cleanGa4Params(params: Record<string, unknown>): Record<string, string | number> {
  const clean: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === 'string' && value.trim()) clean[key] = value.trim().slice(0, 100);
  }
  return clean;
}

export function trackGa4(eventName: string, params: Record<string, unknown> = {}) {
  const gtag = browserGtag();
  if (!gtag) return;
  gtag('event', eventName, {send_to: GA4_MEASUREMENT_ID, ...cleanGa4Params(params)});
}

/** `_ga` = GA1.1.<client_id>; o identificador do visitante é a parte numérica final. */
export function parseGaClientId(cookie: string | undefined | null): string {
  const match = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(String(cookie || '').trim());
  return match ? match[1] : '';
}

/** `_ga_<id>` existe em dois formatos: GS1.1.<sessão>.… e GS2.1.s<sessão>$o…. */
export function parseGaSessionId(cookie: string | undefined | null): string {
  const value = String(cookie || '').trim();
  const gs1 = /^GS1\.\d+\.(\d+)\./.exec(value);
  if (gs1) return gs1[1];
  const gs2 = /^GS2\.\d+\.s(\d+)(?:\$|$)/.exec(value);
  return gs2 ? gs2[1] : '';
}

function readCookie(name: string): string {
  try {
    const prefix = `${name}=`;
    const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : '';
  } catch {
    return '';
  }
}

function remember(ids: Partial<GaIds>) {
  cachedIds = {
    gaClientId: ids.gaClientId || cachedIds.gaClientId,
    gaSessionId: ids.gaSessionId || cachedIds.gaSessionId,
  };
  try { sessionStorage.setItem(GA_IDS_KEY, JSON.stringify(cachedIds)); } catch { /* sem armazenamento */ }
}

/**
 * Identificadores do GA4 guardados junto do lead, para que a consulta realizada
 * marcada no CRM volte ao mesmo visitante (e à mesma origem) no GA4.
 */
export function getGaIds(): GaIds {
  if (typeof document === 'undefined') return cachedIds;
  const fromCookies = {
    gaClientId: parseGaClientId(readCookie('_ga')),
    gaSessionId: parseGaSessionId(readCookie(`_ga_${GA4_MEASUREMENT_ID.replace(/^G-/, '')}`)),
  };
  let stored: Partial<GaIds> = {};
  try { stored = JSON.parse(sessionStorage.getItem(GA_IDS_KEY) || '{}') || {}; } catch { stored = {}; }
  return {
    gaClientId: fromCookies.gaClientId || cachedIds.gaClientId || stored.gaClientId || '',
    gaSessionId: fromCookies.gaSessionId || cachedIds.gaSessionId || stored.gaSessionId || '',
  };
}

/** Pergunta ao gtag os identificadores oficiais; o cookie fica como reserva. */
export function primeGaIds() {
  const gtag = browserGtag();
  if (!gtag) return;
  try {
    gtag('get', GA4_MEASUREMENT_ID, 'client_id', (id: unknown) => {
      if (typeof id === 'string' && id) remember({gaClientId: id});
    });
    gtag('get', GA4_MEASUREMENT_ID, 'session_id', (id: unknown) => {
      if ((typeof id === 'string' || typeof id === 'number') && String(id)) remember({gaSessionId: String(id)});
    });
  } catch { /* o cookie continua como fonte */ }
}

/** Liga um único ouvinte para todos os elementos marcados com data-ga-event. */
export function bindDeclarativeGa4Clicks(root: Document = document) {
  const handler = (event: Event) => {
    const target = event.target as Element | null;
    const element = target?.closest?.('[data-ga-event]') as HTMLElement | null;
    if (!element) return;
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(element.dataset)) {
      if (key.startsWith('ga') && key !== 'gaEvent' && key.length > 2) {
        const name = key.slice(2).replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        params[name] = value;
      }
    }
    trackGa4(element.dataset.gaEvent || '', params);
  };
  root.addEventListener('click', handler, true);
  return () => root.removeEventListener('click', handler, true);
}

/** Registra uma vez por página quando cada seção principal aparece na tela. */
export function observeSections(root: Document = document) {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const seen = new Set<string>();
  const sections = Array.from(root.querySelectorAll<HTMLElement>('main > section, main > div > section'));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      const name = el.dataset.gaSection || '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      trackGa4('secao_visualizada', {secao: name, secao_ordem: Number(el.dataset.gaSectionOrder) || undefined});
      observer.unobserve(el);
    }
  }, {threshold: 0.4});
  sections.forEach((section, index) => {
    if (!section.dataset.gaSection) {
      const heading = section.querySelector('h1, h2')?.textContent?.trim() || '';
      section.dataset.gaSection = section.id || heading.slice(0, 60) || `secao_${index + 1}`;
    }
    section.dataset.gaSectionOrder = String(index + 1);
    observer.observe(section);
  });
  return () => observer.disconnect();
}
