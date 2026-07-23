import crypto from 'crypto';

/**
 * Núcleo do Enhanced Conversions for Leads via Data Manager API. Usado tanto
 * por /api/google-ec (evento vindo do client, FiltroCompleto) quanto por
 * disparos internos do servidor (ex.: /api/leads handlePatch, consulta
 * realizada). Ver histórico completo em api/google-ec.ts.
 *
 * Autenticação: service account (JWT RS256 → access token escopo
 * `datamanager`). Env vars:
 *  GOOGLE_SA_KEY_B64 (ou GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY)
 *  GOOGLE_ADS_CUSTOMER_ID
 *  GOOGLE_ADS_LOGIN_CUSTOMER_ID (opcional)
 *  GOOGLE_DM_VALIDATE_ONLY (opcional)
 */

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export const hashEmail = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.trim().toLowerCase();
  return normalized === '' ? undefined : sha256(normalized);
};

// Google exige telefone em E.164 (com código do país) ANTES do hash.
// Assume número BR sem código do país (ex.: "(11) 99999-9999" → +5511999999999).
export const hashPhoneE164 = (data?: string | null) => {
  if (!data) return undefined;
  let digits = data.replace(/\D/g, '');
  if (digits === '') return undefined;
  if (!digits.startsWith('55')) digits = '55' + digits; // Brasil
  return sha256('+' + digits);
};

const b64url = (input: crypto.BinaryLike) =>
  Buffer.from(input as Buffer | string)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function loadServiceAccount(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GOOGLE_SA_KEY_B64;
  if (b64) {
    try {
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (json.client_email && json.private_key) return json;
      console.error('[Google EC] GOOGLE_SA_KEY_B64 sem client_email/private_key');
    } catch (e) {
      console.error('[Google EC] GOOGLE_SA_KEY_B64 inválido:', (e as Error).message);
    }
  }
  const client_email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const private_key = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (client_email && private_key) return { client_email, private_key };
  return null;
}

export function isGoogleServiceAccountConfigured(): boolean {
  return loadServiceAccount() !== null;
}

async function getAccessToken(): Promise<string | null> {
  const sa = loadServiceAccount();
  if (!sa) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datamanager',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
    const jwt = `${unsigned}.${b64url(signature)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.error('[Google EC] Falha no token da SA:', await res.text());
      return null;
    }
    const j = (await res.json()) as { access_token?: string };
    return j.access_token || null;
  } catch (e) {
    console.error('[Google EC] Erro ao assinar/trocar token:', (e as Error).message);
    return null;
  }
}

export interface GoogleEcInput {
  conversionActionId: string;
  eventId?: string;
  email?: string | null;
  phone?: string | null;
  gclid?: string | null;
}

export interface GoogleEcResult {
  success: boolean;
  error?: string;
}

export async function sendGoogleEcEvent(input: GoogleEcInput): Promise<GoogleEcResult> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!customerId || !loadServiceAccount()) {
    return { success: false, error: 'Google Data Manager não configurado' };
  }

  if (!input.conversionActionId) {
    return { success: false, error: 'Evento sem ação de conversão' };
  }

  const userIdentifiers: Array<Record<string, string>> = [];
  const emHash = hashEmail(input.email);
  const phHash = hashPhoneE164(input.phone);
  if (emHash) userIdentifiers.push({ emailAddress: emHash });
  if (phHash) userIdentifiers.push({ phoneNumber: phHash });

  if (userIdentifiers.length === 0 && !input.gclid) {
    return { success: false, error: 'Sem identificadores para enviar' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Falha ao autenticar no Google' };
  }

  const destination: Record<string, unknown> = {
    reference: 'ads_lead',
    operatingAccount: { accountId: customerId, accountType: 'GOOGLE_ADS' },
    productDestinationId: input.conversionActionId,
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    destination.loginAccount = {
      accountId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      accountType: 'GOOGLE_ADS',
    };
  }

  const event: Record<string, unknown> = {
    destinationReferences: ['ads_lead'],
    transactionId: input.eventId,
    eventTimestamp: new Date().toISOString(),
    eventSource: 'WEB',
    userData: { userIdentifiers },
  };
  if (input.gclid) event.adIdentifiers = { gclid: input.gclid };

  const payload: Record<string, unknown> = {
    destinations: [destination],
    events: [event],
    encoding: 'HEX',
  };
  if (process.env.GOOGLE_DM_VALIDATE_ONLY === 'true') payload.validateOnly = true;

  try {
    const response = await fetch('https://datamanager.googleapis.com/v1/events:ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Google EC] Erro ao enviar conversão (Data Manager)');
      return { success: false, error: 'Falha ao enviar conversão ao Google' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Google EC] Erro interno:', (error as Error).message);
    return { success: false, error: 'Internal server error' };
  }
}
