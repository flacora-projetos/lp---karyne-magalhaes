/**
 * Envio de eventos do servidor para o GA4 (Measurement Protocol). Usado para
 * devolver ao GA4 a consulta realizada marcada no CRM (`close_convert_lead`),
 * no mesmo visitante que preencheu o filtro, para o GA4 atribuir à origem certa.
 *
 * Env vars:
 *  GA4_API_SECRET       segredo criado em Admin > Fluxos de dados > Measurement Protocol
 *  GA4_MEASUREMENT_ID   opcional, padrão G-3783BP5DSB
 *
 * Nunca envia dado pessoal: só identificador anônimo do visitante, valor e rótulos.
 */

const DEFAULT_MEASUREMENT_ID = 'G-3783BP5DSB';

export interface Ga4ServerEventInput {
  eventName: string;
  /** Identificador do visitante no GA4; sem ele, usa um identificador do CRM. */
  clientId?: string | null;
  sessionId?: string | null;
  /** Usado só quando não há visitante GA4 vinculado ao lead. */
  fallbackId: string;
  params?: Record<string, string | number | undefined | null>;
}

export interface Ga4ServerEventResult {
  success: boolean;
  linkedVisitor: boolean;
  error?: string;
}

export function buildGa4Payload(input: Ga4ServerEventInput) {
  const linkedVisitor = Boolean(input.clientId);
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(input.params || {})) {
    if (typeof value === 'number' && Number.isFinite(value)) params[key] = value;
    else if (typeof value === 'string' && value.trim()) params[key] = value.trim().slice(0, 100);
  }
  if (input.sessionId && /^\d+$/.test(input.sessionId)) params.session_id = input.sessionId;
  // Sem tempo de engajamento o GA4 não associa o evento a uma sessão ativa.
  params.engagement_time_msec = 1;
  params.ga_vinculo = linkedVisitor ? 'visitante_do_site' : 'sem_visitante';
  return {
    linkedVisitor,
    body: {
      client_id: linkedVisitor ? String(input.clientId) : `crm.${input.fallbackId}`,
      events: [{name: input.eventName, params}],
    },
  };
}

export async function sendGa4ServerEvent(input: Ga4ServerEventInput): Promise<Ga4ServerEventResult> {
  const apiSecret = process.env.GA4_API_SECRET;
  const measurementId = process.env.GA4_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID;
  const {linkedVisitor, body} = buildGa4Payload(input);
  if (!apiSecret) return {success: false, linkedVisitor, error: 'GA4_API_SECRET ausente'};

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    // O endpoint responde 2xx mesmo para eventos descartados; erro real é rede/HTTP.
    if (!response.ok) return {success: false, linkedVisitor, error: `GA4 HTTP ${response.status}`};
    return {success: true, linkedVisitor};
  } catch (error) {
    return {success: false, linkedVisitor, error: (error as Error).message};
  }
}
