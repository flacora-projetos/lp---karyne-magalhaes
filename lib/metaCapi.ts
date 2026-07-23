import crypto from 'crypto';

/**
 * Núcleo do envio de eventos server-side pro Meta CAPI (Graph API /events).
 * Usado tanto por /api/meta-capi (eventos vindos do client, action_source
 * "website") quanto por disparos internos do servidor (ex.: /api/leads
 * handlePatch, action_source "system_generated").
 */

const hashData = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.trim().toLowerCase();
  if (normalized === '') return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const hashPhone = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.replace(/\D/g, '');
  if (normalized === '') return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const hashString = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized === '') return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

export interface MetaEventInput {
  eventName: string;
  eventId?: string;
  actionSource?: string; // default "website"
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  customData?: Record<string, unknown>;
}

export interface MetaEventResult {
  success: boolean;
  error?: string;
}

export async function sendMetaEvent(input: MetaEventInput): Promise<MetaEventResult> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || '2060052434914188';

  if (!accessToken) {
    return { success: false, error: 'META_ACCESS_TOKEN is not configured' };
  }

  const userData: Record<string, unknown> = {
    client_user_agent: input.userAgent,
    client_ip_address: input.clientIp,
  };

  if (input.email) userData.em = hashData(input.email);
  if (input.phone) userData.ph = hashPhone(input.phone);
  if (input.firstName) userData.fn = hashString(input.firstName);
  if (input.lastName) userData.ln = hashString(input.lastName);
  if (input.city) userData.ct = hashString(input.city);
  if (input.state) userData.st = hashString(input.state);
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  Object.keys(userData).forEach((key) => userData[key] === undefined && delete userData[key]);

  const eventPayload: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: input.actionSource || 'website',
    event_source_url: input.pageUrl,
    user_data: userData,
    custom_data: {
      source: 'lp_filtro',
      ...input.customData,
    },
  };

  const payload: Record<string, unknown> = {
    data: [eventPayload],
  };

  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${pixelId}/events`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Meta CAPI] Error: Failed to send event to Meta');
      return { success: false, error: 'Failed to send event to Meta' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Meta CAPI] Erro interno:', (error as Error).message);
    return { success: false, error: 'Internal error' };
  }
}
