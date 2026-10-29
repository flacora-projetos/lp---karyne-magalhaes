import { pushDataLayerEvent } from './gtm';
import {
  generateEventId,
  getFbcCookie,
  getFbpCookie,
  sendMetaCapiEvent,
  trackCustomEvent,
} from './metaPixel';
import { sendGoogleEcEvent } from './googleAds';
import { getAttributionExtras } from './acquisition';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypbOG2r2Zka810XL8er9zUUSGHjsscOQw_db95uh9azXYh7adlTNhAn1_u0VxzLn4/exec';
const WHATSAPP_NUMBER = '5562999320675';
const isLocalPreview = () => ['127.0.0.1', 'localhost'].includes(window.location.hostname);

type DirectFlowState = {
  leadId: string;
  codigo: string;
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

// Código curto na mensagem pronta: a página não pede telefone, então é por ele
// que o Dácora Fluxo liga a conversa ao clique do anúncio (e ao gclid).
// Sem 0/O/1/I para não confundir quem lê.
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const novoCodigoWhatsapp = (): string => {
  const bytes = new Uint8Array(5);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
};

export const mensagemWhatsappGoogle = (codigo: string): string =>
  `Olá! Vim pelo Google e gostaria de receber orientação e verificar os horários disponíveis para a consulta com a Dra. Karyne Magalhães. (cód. ${codigo})`;

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
    ...getAttributionExtras(),
  };
};

const recordLead = (payload: Record<string, unknown>) => {
  fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});

  if (!isLocalPreview()) fetch(GOOGLE_SCRIPT_URL, {
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
    codigo: novoCodigoWhatsapp(),
    googleEventId: generateEventId(),
    contactEventId: generateEventId(),
    tracked: false,
  };

  return (ctaLocation = '') => {
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
        codigoWhatsapp: state.codigo,
        ...tracking,
      });

      pushDataLayerEvent('filtro_completo', { fluxo: 'gads_direto', cta_location: ctaLocation });
      sendGoogleEcEvent({
        eventName: 'FiltroCompleto',
        eventId: state.googleEventId,
        gclid: tracking.gclid || undefined,
        pageUrl: tracking.pageUrl,
      });

      pushDataLayerEvent('clique_saida', { fluxo: 'gads_direto', cta_location: ctaLocation });
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

    const text = encodeURIComponent(mensagemWhatsappGoogle(state.codigo));
    if (!isLocalPreview()) window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };
};
