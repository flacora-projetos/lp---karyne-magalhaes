import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendGoogleEcEvent } from '../lib/googleEc.js';

/**
 * /api/google-ec  — Enhanced Conversions for Leads via **Data Manager API**
 *
 * Espelha o padrão do /api/meta-capi.ts: recebe o mesmo tipo de payload da LP,
 * faz hash da PII e envia a conversão server-side pro Google. Fire-and-forget:
 * sempre responde 200 pra não travar o fluxo da LP.
 *
 * A lógica de auth/envio mora em lib/googleEc.ts (reusada também pelo disparo
 * interno de "consulta realizada" em api/leads.ts handlePatch).
 */

// Só a conclusão do lead vira conversão (o "FiltroCompleto" é o lead qualificado).
// Extensível: mapeie outros eventos → outras ações de conversão.
const EVENT_TO_ACTION: Record<string, string | undefined> = {
  FiltroCompleto: process.env.GOOGLE_ADS_CONVERSION_ACTION_ID,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      eventName,
      eventId, // reusa o mesmo eventId do Meta como transactionId (dedupe)
      email,
      phone,
      gclid,
    } = req.body as {
      eventName?: string;
      eventId?: string;
      email?: string;
      phone?: string;
      gclid?: string | null;
    };

    const conversionActionId = eventName ? EVENT_TO_ACTION[eventName] : undefined;
    if (!conversionActionId) {
      return res.status(200).json({ success: false, error: 'Evento sem ação de conversão' });
    }

    const result = await sendGoogleEcEvent({ conversionActionId, eventId, email, phone, gclid });

    if (!result.success) {
      return res.status(200).json({ success: false, error: result.error });
    }

    return res.status(200).json({ success: true, eventId });
  } catch (error) {
    console.error('[Google EC] Erro interno:', (error as Error).message);
    return res.status(200).json({ success: false, error: 'Internal server error' });
  }
}
