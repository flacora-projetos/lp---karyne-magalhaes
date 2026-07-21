import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com service role — USO EXCLUSIVO NO SERVIDOR (rotas /api).
 * A service role ignora RLS, então a chave nunca pode ir para o bundle do
 * front-end. Ela é lida apenas de env vars da Vercel / .env.local.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas no ambiente.');
  }

  cached = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cached;
}
