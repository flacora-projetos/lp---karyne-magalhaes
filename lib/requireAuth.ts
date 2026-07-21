import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './supabaseAdmin';

export interface AuthedUser {
  id: string;
  email: string | undefined;
}

/**
 * Allow-list de e-mails com acesso ao painel (handoff seção 9). Defesa em
 * profundidade: mesmo que o sign-up público fique ligado por engano, só estes
 * e-mails conseguem ler/editar leads. Pode ser sobrescrita via env ADMIN_EMAILS
 * (lista separada por vírgula).
 */
const DEFAULT_ADMIN_EMAILS = [
  'karynemag@gmail.com',
  'flacora@gmail.com',
  'contato@nandacora.com.br',
  'equipe@nandacora.com.br',
];

function getAllowedEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS;
  const list = fromEnv
    ? fromEnv.split(',').map((e) => e.trim())
    : DEFAULT_ADMIN_EMAILS;
  return list.filter(Boolean).map((e) => e.toLowerCase());
}

/**
 * Valida o JWT do Supabase Auth enviado no header Authorization: Bearer <token>.
 * Retorna o usuário autenticado ou null (e já responde 401) se inválido.
 * Usado para proteger as rotas de leitura/edição do painel (GET/PATCH).
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthedUser | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ success: false, error: 'Não autenticado' });
    return null;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({ success: false, error: 'Sessão inválida' });
      return null;
    }

    const email = data.user.email?.toLowerCase();
    if (!email || !getAllowedEmails().includes(email)) {
      res.status(403).json({ success: false, error: 'Acesso não autorizado' });
      return null;
    }

    return { id: data.user.id, email: data.user.email };
  } catch {
    res.status(401).json({ success: false, error: 'Falha ao validar sessão' });
    return null;
  }
}
