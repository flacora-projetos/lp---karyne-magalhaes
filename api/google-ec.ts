import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

/**
 * /api/google-ec  — Enhanced Conversions for Leads via **Data Manager API**
 *
 * Espelha o padrão do /api/meta-capi.ts: recebe o mesmo tipo de payload da LP,
 * faz hash da PII e envia a conversão server-side pro Google. Fire-and-forget:
 * sempre responde 200 pra não travar o fluxo da LP.
 *
 * Autenticação: **service account** (JWT RS256 → access token com escopo
 * `datamanager`). Sem developer token, sem refresh token de usuário, sem tela
 * de consentimento. Fluxo validado com validateOnly (HTTP 200) antes de wire.
 *
 * Setup (1x): projeto GCloud com Data Manager API habilitada; service account
 * com chave JSON; e o e-mail da SA precisa ter acesso à conta de Google Ads do
 * cliente (operatingAccount). Por cliente muda só CUSTOMER_ID + ACTION_ID.
 *
 * Env vars (Vercel):
 *  GOOGLE_SA_CLIENT_EMAIL          // client_email do JSON da service account
 *  GOOGLE_SA_PRIVATE_KEY           // private_key do JSON (com \n literais; tratado abaixo)
 *  GOOGLE_ADS_CUSTOMER_ID          // operatingAccount, só dígitos (sem hífens)
 *  GOOGLE_ADS_LOGIN_CUSTOMER_ID    // opcional: MCC/loginAccount, só dígitos
 *  GOOGLE_ADS_CONVERSION_ACTION_ID // productDestinationId = ctId da ação de conversão
 *  GOOGLE_DM_VALIDATE_ONLY         // opcional: "true" valida sem gravar a conversão
 */

// ── Hash (mesmas regras do meta-capi; enviamos em HEX via `encoding`) ─────────
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

const hashEmail = (data?: string | null) => {
  if (!data) return undefined;
  const normalized = data.trim().toLowerCase();
  return normalized === '' ? undefined : sha256(normalized);
};

// Google exige telefone em E.164 (com código do país) ANTES do hash.
// Assume número BR sem código do país (ex.: "(11) 99999-9999" → +5511999999999).
const hashPhoneE164 = (data?: string | null) => {
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

// Assina um JWT da service account e troca por um access token (escopo datamanager).
async function getAccessToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
  // Env vars da Vercel guardam o \n como texto literal — restaura as quebras.
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datamanager',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey);
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
    console.error('[Google EC] Falha no token da service account');
    return null;
  }
  const j = (await res.json()) as { access_token?: string };
  return j.access_token || null;
}

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
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    if (!customerId || !process.env.GOOGLE_SA_CLIENT_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY) {
      return res.status(200).json({ success: false, error: 'Google Data Manager não configurado' });
    }

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

    // Identificadores do usuário (hash SHA-256 hex). Google casa por email/telefone;
    // o gclid, quando existe, reforça o match. Sem identificador nenhum, não envia.
    const userIdentifiers: Array<Record<string, string>> = [];
    const emHash = hashEmail(email);
    const phHash = hashPhoneE164(phone);
    if (emHash) userIdentifiers.push({ emailAddress: emHash });
    if (phHash) userIdentifiers.push({ phoneNumber: phHash });

    if (userIdentifiers.length === 0 && !gclid) {
      return res.status(200).json({ success: false, error: 'Sem identificadores para enviar' });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(200).json({ success: false, error: 'Falha ao autenticar no Google' });
    }

    // operatingAccount = conta do cliente; loginAccount = MCC (opcional).
    const destination: Record<string, unknown> = {
      reference: 'ads_lead',
      operatingAccount: { accountId: customerId, accountType: 'GOOGLE_ADS' },
      productDestinationId: conversionActionId,
    };
    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      destination.loginAccount = {
        accountId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
        accountType: 'GOOGLE_ADS',
      };
    }

    const event: Record<string, unknown> = {
      destinationReferences: ['ads_lead'],
      transactionId: eventId, // dedupe (equivalente ao event_id do Meta)
      eventTimestamp: new Date().toISOString(), // RFC 3339
      eventSource: 'WEB',
      userData: { userIdentifiers },
    };
    if (gclid) event.adIdentifiers = { gclid };

    const payload: Record<string, unknown> = {
      destinations: [destination],
      events: [event],
      encoding: 'HEX', // nosso sha256 é hex
    };
    if (process.env.GOOGLE_DM_VALIDATE_ONLY === 'true') payload.validateOnly = true;

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
      return res.status(200).json({ success: false, error: 'Falha ao enviar conversão ao Google' });
    }

    return res.status(200).json({ success: true, eventId });
  } catch (error) {
    console.error('[Google EC] Erro interno');
    return res.status(200).json({ success: false, error: 'Internal server error' });
  }
}
