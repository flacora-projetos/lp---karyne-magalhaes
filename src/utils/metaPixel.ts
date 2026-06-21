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
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, data, eventData);
  } else {
    console.warn(`Meta Pixel not loaded. Event '${eventName}' not sent.`);
  }
};

export const trackCustomEvent = (eventName: string, data = {}, eventData = {}) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", eventName, data, eventData);
  } else {
    console.warn(`Meta Pixel not loaded. Custom event '${eventName}' not sent.`);
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
