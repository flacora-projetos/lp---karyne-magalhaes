import {recordBlogContact} from './utils/blogContact';

(() => {
  const FIRST_SESSION = 'dacora_first_acquisition_v1';
  const FIRST_PERSISTED = 'dacora_first_acquisition_persisted_v1';
  const CURRENT_SESSION = 'dacora_current_acquisition_v1';
  const CURRENT_PERSISTED = 'dacora_current_acquisition_persisted_v1';
  const EDITORIAL_SESSION = 'dacora_editorial_context_v1';
  const EDITORIAL_PERSISTED = 'dacora_editorial_context_persisted_v1';
  const CONSENT_KEY = 'dacora_analytics_consent';
  const TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_ASSISTS = 20;

  const script = document.currentScript;
  const pageType = script?.dataset.blogPage || 'article';
  const articleId = script?.dataset.blogArticle || '';
  const sourceId = script?.dataset.blogSource || '';
  const slug = script?.dataset.blogSlug || '';
  const preview = script?.dataset.blogPreview === '1';
  const params = new URLSearchParams(location.search);
  const raw = {
    utmSource: params.get('utm_source') || '', utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '', utmContent: params.get('utm_content') || '',
    utmTerm: params.get('utm_term') || '', gclid: params.get('gclid') || '', fbclid: params.get('fbclid') || '',
    entryUrl: location.href, referrer: document.referrer || '', capturedAt: new Date().toISOString()
  };

  const parse = (value) => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
  const consentGranted = () => { try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; } };
  const normalizedHost = (value) => String(value || '').toLowerCase().replace(/^www\./, '');
  const referrerHost = (value) => { try { return normalizedHost(new URL(value).hostname); } catch { return ''; } };
  const currentHost = normalizedHost(location.hostname);
  const hasCampaignSignal = (value) => Boolean(value.utmSource || value.utmMedium || value.utmCampaign || value.utmContent || value.utmTerm || value.gclid || value.fbclid);
  const hasExternalReferrer = (value) => Boolean(value.referrer && referrerHost(value.referrer) && referrerHost(value.referrer) !== currentHost);
  const isExternalTouch = (value) => hasCampaignSignal(value) || hasExternalReferrer(value);

  function readPersisted(key, field) {
    if (!consentGranted()) return null;
    try {
      const envelope = parse(localStorage.getItem(key));
      if (!envelope?.expiresAt || envelope.expiresAt < Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return envelope[field] || null;
    } catch { return null; }
  }

  function persist(key, field, value) {
    if (!consentGranted() || !value) return;
    try { localStorage.setItem(key, JSON.stringify({expiresAt:Date.now()+TTL_MS,[field]:value})); } catch {}
  }

  function appendAssist(existing, assist) {
    if (!assist.articleId && !assist.slug) return Array.isArray(existing) ? existing.slice(-MAX_ASSISTS) : [];
    const list = Array.isArray(existing) ? existing.filter((item) => item && item.articleId !== assist.articleId && item.slug !== assist.slug) : [];
    return [...list, assist].slice(-MAX_ASSISTS);
  }

  let editorial = null;
  try {
    const sessionFirst = parse(sessionStorage.getItem(FIRST_SESSION));
    const persistedFirst = readPersisted(FIRST_PERSISTED, 'raw');
    const first = sessionFirst || persistedFirst || raw;
    if (!sessionFirst) sessionStorage.setItem(FIRST_SESSION, JSON.stringify(first));
    if (!persistedFirst) persist(FIRST_PERSISTED, 'raw', first);

    const sessionCurrent = parse(sessionStorage.getItem(CURRENT_SESSION));
    const persistedCurrent = readPersisted(CURRENT_PERSISTED, 'raw');
    const current = isExternalTouch(raw) ? raw : (sessionCurrent || persistedCurrent || raw);
    if (isExternalTouch(raw) || (!sessionCurrent && !persistedCurrent)) sessionStorage.setItem(CURRENT_SESSION, JSON.stringify(current));
    if (isExternalTouch(raw) || !persistedCurrent) persist(CURRENT_PERSISTED, 'raw', current);

    const sessionEditorial = parse(sessionStorage.getItem(EDITORIAL_SESSION));
    const persistedEditorial = readPersisted(EDITORIAL_PERSISTED, 'context');
    editorial = sessionEditorial || persistedEditorial || {};
    if (pageType === 'article' && (articleId || slug)) {
      const at = new Date().toISOString();
      editorial = {
        ...editorial,
        entryArticleId: editorial.entryArticleId || articleId,
        entrySourceId: editorial.entrySourceId || sourceId,
        entryArticleSlug: editorial.entryArticleSlug || slug,
        lastArticleId: articleId,
        lastArticleSlug: slug,
        articleAssists: appendAssist(editorial.articleAssists, {articleId,slug,at})
      };
      sessionStorage.setItem(EDITORIAL_SESSION, JSON.stringify(editorial));
      persist(EDITORIAL_PERSISTED, 'context', editorial);
    }
  } catch {}

  if (!preview && typeof window.gtag === 'function') {
    try {
      const flag = params.get('ga_interno');
      if (flag === '1' || flag === '0') localStorage.setItem('dacora_ga_interno', flag);
      const internalHost = !/^(www\.)?tratamentodomauhalito\.com\.br$/.test(location.hostname);
      if (internalHost || localStorage.getItem('dacora_ga_interno') === '1') window.gtag('set', {traffic_type:'internal'});
    } catch {}
    const event = {page_location:location.href,page_title:document.title,content_type:pageType === 'index' ? 'blog_index' : 'blog_article'};
    if (pageType === 'article') Object.assign(event,{article_id:articleId,source_id:sourceId,article_slug:slug});
    window.gtag('event','page_view',event);
  }

  let contactTracked = false;
  const contactClick = (event) => {
    if (preview) { event?.preventDefault(); return; }
    if (event?.type === 'auxclick' && event.button !== 1) return;
    try {
      const latest = parse(sessionStorage.getItem(EDITORIAL_SESSION)) || editorial || {};
      const withCta = {...latest,ctaId:'contato_whatsapp',ctaDestination:'whatsapp'};
      sessionStorage.setItem(EDITORIAL_SESSION,JSON.stringify(withCta));
      persist(EDITORIAL_PERSISTED,'context',withCta);
    } catch {}
    if (contactTracked) return;
    contactTracked = true;
    if (typeof window.gtag === 'function') {
      window.gtag('event','blog_cta_click',{
        send_to:'G-3783BP5DSB',article_id:articleId,article_slug:slug,
        cta_id:'contato_whatsapp',cta_destination:'whatsapp',
      });
    }
    recordBlogContact({id:articleId,sourceId,slug}).then((saved) => {
      if (!saved) contactTracked = false;
    }).catch(() => { contactTracked = false; });
  };
  document.querySelectorAll('a.cta').forEach((el) => {
    el.addEventListener('click',contactClick);
    el.addEventListener('auxclick',contactClick);
  });
  document.querySelectorAll('[data-share]').forEach((button) => {
    button.addEventListener('click',async () => {
      const status = document.querySelector('.share-status');
      if (!preview && typeof window.gtag === 'function') {
        window.gtag('event','share',{send_to:'G-3783BP5DSB',method:'copiar_link',content_type:'blog_article',item_id:slug,article_id:articleId});
      }
      try {
        await navigator.clipboard.writeText(button.dataset.share);
        if (status) status.textContent = 'Link copiado. Você pode compartilhar este artigo.';
      } catch {
        if (status) status.textContent = 'Para compartilhar, copie o endereço do artigo na barra do navegador.';
      }
    });
  });
})();
