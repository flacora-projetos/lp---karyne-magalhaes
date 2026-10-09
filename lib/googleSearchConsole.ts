import crypto from 'crypto';

const SCOPE = 'https://www.googleapis.com/auth/webmasters';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_ROOT = 'https://www.googleapis.com/webmasters/v3';
const INSPECTION_ROOT = 'https://searchconsole.googleapis.com/v1';
const TIMEOUT_MS = 8000;

type ServiceAccount = { client_email: string; private_key: string };
type OAuthRefresh = { clientId: string; clientSecret: string; refreshToken: string };
let cachedToken: { value: string; expiresAt: number } | null = null;

export class GoogleSearchConsoleError extends Error {
  status: number;
  transient: boolean;
  uncertain: boolean;
  code: string;

  constructor(message: string, options: { status?: number; transient?: boolean; uncertain?: boolean; code?: string } = {}) {
    super(message);
    this.name = 'GoogleSearchConsoleError';
    this.status = options.status ?? 0;
    this.transient = options.transient ?? false;
    this.uncertain = options.uncertain ?? false;
    this.code = options.code ?? 'gsc_error';
  }
}

function b64url(input: crypto.BinaryLike) {
  return Buffer.from(input as Buffer | string).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadOAuthRefresh(): OAuthRefresh | null {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET || '';
  const refreshToken = process.env.GSC_OAUTH_REFRESH_TOKEN || '';
  const any = Boolean(clientId || clientSecret || refreshToken);
  if (any && !(clientId && clientSecret && refreshToken)) {
    throw new GoogleSearchConsoleError('Configuração OAuth GSC incompleta', { code: 'gsc_oauth_config_incomplete' });
  }
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

function loadServiceAccount(): ServiceAccount | null {
  const b64 = process.env.GSC_GOOGLE_SA_KEY_B64;
  if (b64) {
    try {
      const value = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (value.client_email && value.private_key) return { client_email: value.client_email, private_key: value.private_key };
    } catch {
      return null;
    }
  }
  const client_email = process.env.GSC_GOOGLE_SA_CLIENT_EMAIL;
  const private_key = (process.env.GSC_GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return client_email && private_key ? { client_email, private_key } : null;
}

export function getGoogleSearchConsoleAuthMode() {
  if (loadOAuthRefresh()) return 'oauth_refresh';
  if (loadServiceAccount()) return 'service_account';
  return 'not_configured';
}

export function isGoogleSearchConsoleConfigured() {
  return getGoogleSearchConsoleAuthMode() !== 'not_configured';
}

async function exchangeToken(body: URLSearchParams) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GoogleSearchConsoleError(`Falha OAuth do Google (${response.status})`, {
        status: response.status,
        transient: response.status === 429 || response.status >= 500,
        code: 'gsc_oauth_failed',
      });
    }
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new GoogleSearchConsoleError('Resposta OAuth sem access_token', { code: 'gsc_oauth_missing_token' });
    return payload;
  } catch (error) {
    if (error instanceof GoogleSearchConsoleError) throw error;
    throw new GoogleSearchConsoleError('Falha de rede ao autenticar no Google', { transient: true, code: 'gsc_oauth_network' });
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 300000) return cachedToken.value;

  const oauth = loadOAuthRefresh();
  let payload: { access_token?: string; expires_in?: number };
  if (oauth) {
    payload = await exchangeToken(new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: oauth.refreshToken,
      scope: SCOPE,
    }));
  } else {
    const sa = loadServiceAccount();
    if (!sa) throw new GoogleSearchConsoleError('Credencial Google server-side ausente', { code: 'gsc_auth_not_configured' });
    const iat = Math.floor(now / 1000);
    const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }))}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
    payload = await exchangeToken(new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(signature)}`,
    }));
  }

  cachedToken = { value: payload.access_token!, expiresAt: now + Math.max(60, payload.expires_in ?? 3600) * 1000 };
  return payload.access_token!;
}

async function requestGoogle(url: string, init: RequestInit, effect: 'read' | 'write' = 'read') {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      signal: controller.signal,
    });
    if (!response.ok) {
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new GoogleSearchConsoleError(`Search Console respondeu ${response.status}`, {
        status: response.status,
        transient,
        code: transient ? 'gsc_transient_http' : 'gsc_http_error',
      });
    }
    return response;
  } catch (error) {
    if (error instanceof GoogleSearchConsoleError) throw error;
    throw new GoogleSearchConsoleError(
      effect === 'write' ? 'Resultado do envio ao Search Console ficou incerto' : 'Falha de rede no Search Console',
      {
        transient: effect === 'read',
        uncertain: effect === 'write',
        code: effect === 'write' ? 'gsc_write_uncertain' : 'gsc_read_network',
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

const enc = (value: string) => encodeURIComponent(value);

export async function getGscSite(siteUrl: string) {
  const response = await requestGoogle(`${API_ROOT}/sites/${enc(siteUrl)}`, { method: 'GET' });
  return response.json() as Promise<{ siteUrl?: string; permissionLevel?: string }>;
}

export async function submitGscSitemap(siteUrl: string, sitemapUrl: string) {
  await requestGoogle(`${API_ROOT}/sites/${enc(siteUrl)}/sitemaps/${enc(sitemapUrl)}`, { method: 'PUT' }, 'write');
}

export async function getGscSitemap(siteUrl: string, sitemapUrl: string) {
  const response = await requestGoogle(`${API_ROOT}/sites/${enc(siteUrl)}/sitemaps/${enc(sitemapUrl)}`, { method: 'GET' });
  return response.json() as Promise<{
    path?: string;
    lastSubmitted?: string;
    isPending?: boolean;
    warnings?: string;
    errors?: string;
    contents?: Array<{ type?: string; submitted?: string; indexed?: string }>;
  }>;
}

export async function inspectGscUrl(siteUrl: string, inspectionUrl: string) {
  const response = await requestGoogle(`${INSPECTION_ROOT}/urlInspection/index:inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode: 'pt-BR' }),
  });
  return response.json() as Promise<any>;
}
