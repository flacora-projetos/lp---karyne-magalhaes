import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const hashData = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.trim().toLowerCase();
  if (normalized === "") return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const hashPhone = (data?: string | null) => {
  if (!data) return undefined;
  // keep only numbers
  const normalized = data.replace(/\D/g, "");
  if (normalized === "") return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const hashString = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized === "") return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const pixelId = process.env.META_PIXEL_ID || "2060052434914188";
    
    if (!accessToken) {
      return res.status(200).json({ success: false, error: "META_ACCESS_TOKEN is not configured" });
    }

    const {
      eventName,
      eventId,
      email,
      phone,
      firstName,
      lastName,
      city,
      state,
      fbp,
      fbc,
      pageUrl,
      referrer,
      userAgent
    } = req.body;

    const ALLOWED_EVENTS = ["FormularioIniciado", "FiltroCompleto", "CliqueSaida"];
    if (!eventName || !ALLOWED_EVENTS.includes(eventName)) {
      return res.status(200).json({ success: false, error: "Event not allowed via CAPI" });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const userData: any = {
      client_user_agent: userAgent || req.headers['user-agent'],
      client_ip_address: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : undefined,
    };

    if (email) userData.em = hashData(email);
    if (phone) userData.ph = hashPhone(phone);
    if (firstName) userData.fn = hashString(firstName);
    if (lastName) userData.ln = hashString(lastName);
    if (city) userData.ct = hashString(city);
    if (state) userData.st = hashString(state);
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    // Clean undefined keys
    Object.keys(userData).forEach(key => userData[key] === undefined && delete userData[key]);

    const eventPayload: any = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: pageUrl,
      user_data: userData,
      custom_data: {
        source: "lp_filtro"
      }
    };

    const payload: any = {
      data: [eventPayload]
    };

    if (process.env.META_TEST_EVENT_CODE) {
      payload.test_event_code = process.env.META_TEST_EVENT_CODE;
    }

    const url = `https://graph.facebook.com/v20.0/${pixelId}/events`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("[Meta CAPI] Error: Failed to send event to Meta");
      return res.status(200).json({ success: false, error: "Failed to send event to Meta" });
    }

    return res.status(200).json({ success: true, eventId });
  } catch (error) {
    console.error("[Meta CAPI] Server error");
    return res.status(200).json({ success: false, error: "Internal server error" });
  }
}
