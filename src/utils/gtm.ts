export function pushDataLayerEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined") {
    // @ts-ignore
    window.dataLayer = window.dataLayer || [];
    // @ts-ignore
    window.dataLayer.push({
      event: eventName,
      ...params
    });
  }
}
