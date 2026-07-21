import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RefreshCw, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';
import { fetchLeads, type LeadFilters } from './api';
import type { Lead } from './types';
import { Filters } from './Filters';
import { LeadsTable } from './LeadsTable';
import { LeadDetailModal } from './LeadDetailModal';
import { Dashboard } from './Dashboard';

interface PanelProps {
  session: Session;
}

const KNOWN_PLATFORMS = ['Google Ads', 'Meta Ads', 'Direto'];
type Tab = 'leads' | 'dashboard';

export const Panel: React.FC<PanelProps> = ({ session }) => {
  const [filters, setFilters] = useState<LeadFilters>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('leads');
  const [selected, setSelected] = useState<Lead | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (f: LeadFilters) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeads(f);
      setLeads(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro';
      if (msg === 'unauthorized') {
        await supabase.auth.signOut();
        return;
      }
      setError('Não foi possível carregar os leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega com debounce sempre que os filtros mudam.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(filters), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, load]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.history.pushState({}, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSaved = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelected(updated);
  };

  const plataformas = useMemo(() => {
    const set = new Set<string>(KNOWN_PLATFORMS);
    leads.forEach((l) => l.origem && set.add(l.origem));
    return Array.from(set);
  }, [leads]);

  return (
    <div className="min-h-screen bg-[#F6F0E9] font-sans text-[#2B1B0A]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#F6F0E9]/90 backdrop-blur border-b border-[#E4DFD9]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-serif font-medium text-[#222D19] leading-none">Painel de Leads</h1>
            <p className="text-[12px] text-[#2B1B0A]/50 mt-0.5">Dra. Karyne Magalhães</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(filters)}
              className="p-2 rounded-lg border border-[#E4DFD9] hover:bg-[#FEFEFE] transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <span className="hidden md:inline text-[12px] text-[#2B1B0A]/50 max-w-[180px] truncate">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[#E4DFD9] hover:bg-[#FEFEFE] transition-colors"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-1">
          {(['leads', 'dashboard'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-[#A95B21] text-[#A95B21]'
                  : 'border-transparent text-[#2B1B0A]/50 hover:text-[#2B1B0A]'
              }`}
            >
              {t === 'leads' ? 'Leads' : 'Dashboard'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
        <Filters value={filters} onChange={setFilters} onClear={() => setFilters({})} plataformas={plataformas} />

        <div className="flex items-center justify-between">
          <div className="text-sm text-[#2B1B0A]/60">
            {loading ? 'Carregando…' : `${leads.length} lead${leads.length === 1 ? '' : 's'}`}
          </div>
        </div>

        {error && (
          <div className="text-[13px] text-[#8B2312] bg-[#8B2312]/10 border border-[#8B2312]/20 rounded-xl p-3">{error}</div>
        )}

        {tab === 'leads' ? (
          <LeadsTable leads={leads} onSelect={setSelected} />
        ) : (
          <Dashboard leads={leads} />
        )}
      </main>

      {selected && (
        <LeadDetailModal lead={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
};
