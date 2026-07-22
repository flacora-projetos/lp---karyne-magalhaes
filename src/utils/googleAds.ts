/**
 * Enhanced Conversions for Leads (Google Ads) — lado cliente.
 * Espelha o sendMetaCapiEvent do metaPixel.ts: dispara a conversão server-side
 * via /api/google-ec, fire-and-forget (não bloqueia a UI, nunca lança).
 *
 * Reutilize o MESMO eventId gerado para o Meta (generateEventId), para dedupe
 * consistente entre os dois destinos.
 */
export const sendGoogleEcEvent = async (payload: {
  eventName: string;
  eventId: string;
  email?: string;
  phone?: string;
  gclid?: string | null;
  pageUrl?: string;
}) => {
  try {
    fetch('/api/google-ec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((e) => console.error('[Google EC API Error]:', e));
  } catch (e) {
    console.error('[Google EC Sync Error]:', e);
  }
};
