import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendMetaEvent } from '../lib/metaCapi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
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
      userAgent
    } = req.body;

    const ALLOWED_EVENTS = ["FormularioIniciado", "FiltroCompleto", "CliqueSaida"];
    if (!eventName || !ALLOWED_EVENTS.includes(eventName)) {
      return res.status(200).json({ success: false, error: "Event not allowed via CAPI" });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const result = await sendMetaEvent({
      eventName,
      eventId,
      actionSource: "website",
      email,
      phone,
      firstName,
      lastName,
      city,
      state,
      fbp,
      fbc,
      pageUrl,
      userAgent: userAgent || (req.headers['user-agent'] as string | undefined),
      clientIp: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : undefined,
    });

    if (!result.success) {
      return res.status(200).json({ success: false, error: result.error });
    }

    return res.status(200).json({ success: true, eventId });
  } catch (error) {
    console.error("[Meta CAPI] Server error");
    return res.status(200).json({ success: false, error: "Internal server error" });
  }
}
