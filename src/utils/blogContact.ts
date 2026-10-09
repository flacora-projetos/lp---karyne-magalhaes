import { getAttributionExtras } from './acquisition';
import { getFbcCookie, getFbpCookie } from './metaPixel';

export async function recordBlogContact(article: {id:string; sourceId:string; slug:string}) {
  const attribution = getAttributionExtras();
  const params = new URLSearchParams(window.location.search);
  const now = new Date().toISOString();
  const payload = {
    leadId: crypto.randomUUID(), createdAt: now, updatedAt: now,
    status: 'Clique para WhatsApp (blog)',
    utmSource: attribution.currentUtmSource || params.get('utm_source') || '',
    utmMedium: attribution.currentUtmMedium || params.get('utm_medium') || '',
    utmCampaign: attribution.currentUtmCampaign || params.get('utm_campaign') || '',
    utmContent: attribution.currentUtmContent || params.get('utm_content') || '',
    utmTerm: attribution.currentUtmTerm || params.get('utm_term') || '',
    gclid: attribution.currentGclid || params.get('gclid') || '',
    fbclid: attribution.currentFbclid || params.get('fbclid') || '',
    pageUrl: window.location.href, referrer: document.referrer || '', userAgent: navigator.userAgent,
    metaFbp: getFbpCookie() || '', metaFbc: getFbcCookie() || '',
    ...attribution,
    entryArticleId: attribution.entryArticleId || article.id,
    entrySourceId: attribution.entrySourceId || article.sourceId,
    entryArticleSlug: attribution.entryArticleSlug || article.slug,
    lastArticleId: article.id, lastArticleSlug: article.slug,
    editorialCtaId: 'contato_whatsapp', editorialCtaDestination: 'whatsapp',
  };
  const response = await fetch('/api/leads', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload), keepalive: true,
  });
  const result = await response.json();
  return response.ok && result.success === true;
}
