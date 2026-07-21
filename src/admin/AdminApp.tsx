import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { Login } from './Login';
import { Panel } from './Panel';

/**
 * Módulo /admin — carregado sob demanda (lazy) a partir do App.tsx.
 * Gerencia a sessão do Supabase Auth e decide entre login e painel.
 * Proteção client-side: sem sessão, só a tela de login é renderizada.
 * (A proteção real dos dados é server-side, nas rotas /api que validam o JWT.)
 */
export const AdminApp: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F0E9] text-[#2B1B0A]/50 font-sans text-sm">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <Panel session={session} />;
};

export default AdminApp;
