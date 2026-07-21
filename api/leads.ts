import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { mapPayloadToRow, type SheetsPayload } from '../lib/mapLead.js';
import { requireAuth } from '../lib/requireAuth.js';

/**
 * /api/leads
 *
 * POST  — ingestão vinda da LP (público, sem auth). Faz upsert por lead_id no
 *         Postgres, em paralelo ao Apps Script/planilha (que continua intacto).
 *         Fire-and-forget: sempre responde 200 para não quebrar o fluxo da LP.
 *
 * GET   — listagem para o painel /admin. Exige JWT do Supabase Auth (Bearer).
 *
 * PATCH — atualiza os campos comerciais de um lead (?id=<lead_id>). Exige JWT.
 *         (Fica aqui, no caminho estático /api/leads, em vez de uma rota
 *         dinâmica /api/leads/[id], porque o rewrite catch-all do vercel.json
 *         engole rotas dinâmicas antes de chegarem à função.)
 */
const STATUS_VALIDOS = [
  'novo',
  'contatado',
  'aguardando_resposta',
  'em_atendimento',
  'consulta_marcada',
  'consulta_realizada',
  'tratamento_fechado',
  'nao_fechou',
  'lead_invalido',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'PATCH') {
    return handlePatch(req, res);
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] || '').trim();
  return (v || '').trim();
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return; // requireAuth já respondeu 401/403

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('leads').select('*').order('criado_em', { ascending: false }).limit(5000);

    const q = req.query;
    const periodoDe = first(q.periodoDe);
    const periodoAte = first(q.periodoAte);
    const plataforma = first(q.plataforma);
    const campanha = first(q.campanha);
    const criativo = first(q.criativo);
    const termo = first(q.termo);
    const cidade = first(q.cidade);
    const statusComercial = first(q.statusComercial);
    const responsavel = first(q.responsavel);
    const busca = first(q.busca);

    if (periodoDe) query = query.gte('criado_em', `${periodoDe}T00:00:00`);
    if (periodoAte) query = query.lte('criado_em', `${periodoAte}T23:59:59.999`);
    if (plataforma) query = query.eq('origem', plataforma);
    if (statusComercial) query = query.eq('status_comercial', statusComercial);
    if (campanha) query = query.ilike('utm_campaign', `%${campanha}%`);
    if (criativo) query = query.ilike('utm_content', `%${criativo}%`);
    if (termo) query = query.ilike('utm_term', `%${termo}%`);
    if (cidade) query = query.ilike('cidade', `%${cidade}%`);
    if (responsavel) query = query.ilike('responsavel', `%${responsavel}%`);
    if (busca) {
      const safe = busca.replace(/[%,()]/g, ' ');
      query = query.or(
        `nome.ilike.%${safe}%,whatsapp.ilike.%${safe}%,email.ilike.%${safe}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error('[api/leads GET] Erro na consulta:', error.message);
      return res.status(500).json({ success: false, error: 'Falha ao carregar leads' });
    }

    return res.status(200).json({ success: true, leads: data ?? [] });
  } catch (error) {
    console.error('[api/leads GET] Erro interno');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    let payload = req.body as SheetsPayload;

    // A LP envia como text/plain (mesmo contrato do Apps Script); o body pode
    // chegar como string bruta em vez de objeto já parseado.
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return res.status(200).json({ success: false, error: 'Invalid JSON body' });
      }
    }

    if (!payload || typeof payload !== 'object' || !payload.leadId) {
      return res.status(200).json({ success: false, error: 'leadId ausente' });
    }

    const row = mapPayloadToRow(payload);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc('upsert_lead', { p: row });

    if (error) {
      console.error('[api/leads POST] Erro no upsert:', error.message);
      return res.status(200).json({ success: false, error: 'Falha ao gravar lead' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[api/leads POST] Erro interno');
    return res.status(200).json({ success: false, error: 'Internal server error' });
  }
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const leadId = first(req.query.id);
  if (!leadId) {
    return res.status(400).json({ success: false, error: 'lead_id ausente (use ?id=)' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, error: 'JSON inválido' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Corpo inválido' });
  }

  // Whitelist estrita de campos comerciais.
  const update: Record<string, unknown> = {};

  if ('status_comercial' in body) {
    const s = String(body.status_comercial);
    if (!STATUS_VALIDOS.includes(s)) {
      return res.status(400).json({ success: false, error: 'status_comercial inválido' });
    }
    update.status_comercial = s;
  }

  if ('data_consulta' in body) {
    const v = body.data_consulta;
    update.data_consulta = v === null || v === '' ? null : String(v);
  }

  if ('valor_fechado' in body) {
    const v = body.valor_fechado;
    if (v === null || v === '') {
      update.valor_fechado = null;
    } else {
      const n = Number(v);
      if (Number.isNaN(n) || n < 0) {
        return res.status(400).json({ success: false, error: 'valor_fechado inválido' });
      }
      update.valor_fechado = n;
    }
  }

  for (const campo of ['motivo_perda', 'observacoes', 'responsavel'] as const) {
    if (campo in body) {
      const v = (body as Record<string, unknown>)[campo];
      update[campo] = v === null || v === '' ? null : String(v);
    }
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ success: false, error: 'Nenhum campo comercial para atualizar' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('leads')
      .update(update)
      .eq('lead_id', leadId)
      .select('*')
      .single();

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Lead não encontrado' });
      }
      console.error('[api/leads PATCH] Erro:', error.message);
      return res.status(500).json({ success: false, error: 'Falha ao atualizar lead' });
    }

    return res.status(200).json({ success: true, lead: data });
  } catch {
    console.error('[api/leads PATCH] Erro interno');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
