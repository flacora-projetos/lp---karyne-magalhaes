import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }
      // Sessão criada — vai para o painel.
      window.history.pushState({}, '', '/admin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      setError('Não foi possível entrar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F0E9] px-4 font-sans text-[#2B1B0A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-medium text-[#222D19]">Painel administrativo</h1>
          <p className="text-sm text-[#2B1B0A]/60 mt-1">Dra. Karyne Magalhães</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-6 md:p-8 shadow-sm space-y-5"
        >
          {!isSupabaseConfigured && (
            <div className="text-[13px] text-[#8B2312] bg-[#8B2312]/10 border border-[#8B2312]/20 rounded-xl p-3">
              Configuração do Supabase ausente no build. Verifique as variáveis
              SUPABASE_URL e SUPABASE_ANON_KEY.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[#8B2312]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="w-full bg-[#222D19] hover:bg-[#222D19]/90 disabled:bg-[#E4DFD9] disabled:text-[#2B1B0A]/40 transition-colors text-white py-3.5 rounded-xl font-medium text-[15px]"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[12px] text-[#2B1B0A]/50 mt-6">
          Acesso restrito à equipe autorizada.
        </p>
      </div>
    </div>
  );
};
