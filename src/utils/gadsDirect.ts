import { pushDataLayerEvent } from './gtm';
import {
  generateEventId,
  getFbcCookie,
  getFbpCookie,
  sendMetaCapiEvent,
  trackCustomEvent,
} from './metaPixel';
import { sendGoogleEcEvent } from './googleAds';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypbOG2r2Zka810XL8er9zUUSGHjsscOQw_db95uh9azXYh7adlTNhAn1_u0VxzLn4/exec';
const WHATSAPP_NUMBER = '5562999320675';

type DirectFlowState = {
  leadId: string;
  googleEventId: string;
  contactEventId: string;
  tracked: boolean;
};

const newId = (prefix: string): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
};

const trackingData = () => {
  const params = new URLSearchParams(window.location.search);

  return {
    utmSource: 'google',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmContent: params.get('utm_content') || '',
    utmTerm: params.get('utm_term') || '',
    fbclid: params.get('fbclid') || '',
    gclid: params.get('gclid') || '',
    pageUrl: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    metaFbp: getFbpCookie() || '',
    metaFbc: getFbcCookie() || '',
  };
};

const recordLead = (payload: Record<string, unknown>) => {
  fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
};

export const createGadsDirectHandler = () => {
  const state: DirectFlowState = {
    leadId: newId('lead'),
    googleEventId: generateEventId(),
    contactEventId: generateEventId(),
    tracked: false,
  };

  return () => {
    const tracking = trackingData();

    if (!state.tracked) {
      state.tracked = true;
      const now = new Date().toISOString();

      recordLead({
        leadId: state.leadId,
        createdAt: now,
        updatedAt: now,
        status: 'WhatsApp aberto(clicou para WhatsApp)',
        eventIdLead: state.googleEventId,
        eventIdContact: state.contactEventId,
        ...tracking,
      });

      pushDataLayerEvent('filtro_completo');
      sendGoogleEcEvent({
        eventName: 'FiltroCompleto',
        eventId: state.googleEventId,
        gclid: tracking.gclid || undefined,
        pageUrl: tracking.pageUrl,
      });

      pushDataLayerEvent('clique_saida');
      trackCustomEvent('CliqueSaida', { lp_event: 'CliqueSaida' }, { eventID: state.contactEventId });
      sendMetaCapiEvent({
        eventName: 'CliqueSaida',
        eventId: state.contactEventId,
        fbp: tracking.metaFbp,
        fbc: tracking.metaFbc,
        fbclid: tracking.fbclid || undefined,
        externalId: state.leadId,
        pageUrl: tracking.pageUrl,
        referrer: tracking.referrer,
        userAgent: tracking.userAgent,
      });
    }

    const text = encodeURIComponent(
      'Olá! Vim pelo Google e gostaria de receber orientação e verificar os horários disponíveis para a consulta com a Dra. Karyne Magalhães.',
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };
};
