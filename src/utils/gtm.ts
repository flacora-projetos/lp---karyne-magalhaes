const GA4_FUNNEL_EVENTS = new Set([
  'filtro_aberto', 'formulario_iniciado', 'etapa_respondida', 'filtro_completo', 'clique_saida',
]);

export function trackEditorialCtaArrival() {
  if (typeof window === 'undefined' || window.location.pathname !== '/') return;
  const params = new URLSearchParams(window.location.search);
  const gtag = (window as unknown as {gtag?: (command:string,event:string,params:Record<string,unknown>)=>void}).gtag;
  if (params.get('blog_cta') !== '1' || typeof gtag !== 'function') return;
  try {
    const key = 'dacora_editorial_cta_pending_v1';
    const pending = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!pending) return;
    sessionStorage.removeItem(key);
    if (typeof pending.slug !== 'string' || pending.slug !== params.get('article') ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pending.slug) ||
      typeof pending.articleId !== 'string' || typeof pending.at !== 'number' ||
      Date.now() - pending.at < 0 || Date.now() - pending.at > 60000) return;
    gtag('event','blog_cta_click',{
      send_to:'G-3783BP5DSB',article_id:pending.articleId,article_slug:pending.slug,
      cta_id:'avaliacao_inicial',cta_destination:'home_filter',
    });
  } catch { /* Sem armazenamento, a navegação e o atendimento continuam. */ }
}

export function pushDataLayerEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const browser = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (command: string, event: string, params: Record<string, unknown>) => void;
  };
  browser.dataLayer = browser.dataLayer || [];
  browser.dataLayer.push({event: eventName, ...params});

  // O container publicado atende Ads; a aplicação é a única emissora do funil para GA4.
  if (GA4_FUNNEL_EVENTS.has(eventName) && typeof browser.gtag === 'function') {
    const analyticsParams: Record<string, unknown> = {send_to: 'G-3783BP5DSB'};
    if (eventName === 'etapa_respondida' && Number.isInteger(params.step) && Number(params.step) >= 1 && Number(params.step) <= 7) {
      analyticsParams.step = params.step;
    }
    browser.gtag('event', eventName, analyticsParams);
  }
}
