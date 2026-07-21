import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAuth } from '../../lib/requireAuth.js';

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

/**
 * PATCH /api/leads/:id  (id = lead_id)
 * Atualiza SOMENTE os campos comerciais editados manualmente no painel.
 * Nunca toca em campos de captura/tracking. Exige JWT válido (equipe).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const leadId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!leadId) {
    return res.status(400).json({ success: false, error: 'lead_id ausente' });
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
      const v = body[campo];
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
      // PGRST116 = nenhuma linha encontrada
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
