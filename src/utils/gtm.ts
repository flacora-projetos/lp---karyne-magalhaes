const GA4_FUNNEL_EVENTS = new Set([
  'filtro_aberto', 'formulario_iniciado', 'etapa_respondida', 'filtro_completo', 'clique_saida',
]);

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
