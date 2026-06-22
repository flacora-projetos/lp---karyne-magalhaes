export const META_PIXEL_ID = "2060052434914188";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    fbq: any;
  }
}

export const generateEventId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
};

export const trackEvent = (eventName: string, data = {}, eventData = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, data, eventData);
  }
};

export const trackCustomEvent = (eventName: string, data = {}, eventData = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", eventName, data, eventData);
  }
};

export const getFbpCookie = (): string | null => {
  const match = document.cookie.match(/(?:^|;)\s*_fbp=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const getFbcCookie = (): string | null => {
  const match = document.cookie.match(/(?:^|;)\s*_fbc=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const preserveFbclid = () => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.has("fbclid")) {
    sessionStorage.setItem("fbclid", params.get("fbclid") || "");
  }
};

export const sendMetaCapiEvent = async (payload: {
  eventName: string;
  eventId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
}) => {
  try {
    fetch('/api/meta-capi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(e => console.error("[CAPI API Error]:", e));
  } catch (e) {
    console.error("[CAPI Sync Error]:", e);
  }
};
