import { createClient } from '@supabase/supabase-js';

// Injetados em build time pelo Vite (define). Ver vite.config.ts.
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

export const SUPABASE_URL = __SUPABASE_URL__;
export const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Cliente Supabase do navegador (anon key). Usado apenas no módulo /admin para
 * login e para obter o JWT que autentica as chamadas às rotas /api. A anon key
 * é pública e protegida por RLS — nenhum dado de lead é acessível sem sessão.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'karyne-crm-auth',
  },
});
