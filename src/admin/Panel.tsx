import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RefreshCw, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';
import { fetchLeads, updateLead, type LeadFilters } from './api';
import type { Lead, StatusComercial } from './types';
import { Filters } from './Filters';
import { LeadsTable } from './LeadsTable';
import { LeadDetailModal } from './LeadDetailModal';
import { Dashboard } from './Dashboard';
import { KanbanBoard } from './KanbanBoard';

interface PanelProps {
  session: Session;
}

const KNOWN_PLATFORMS = ['Google Ads', 'Meta Ads', 'Direto'];
type Tab = 'kanban' | 'leads' | 'dashboard';
const TABS: { id: Tab; label: string }[] = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'leads', label: 'Leads' },
  { id: 'dashboard', label: 'Dashboard' },
];

export const Panel: React.FC<PanelProps> = ({ session }) => {
  const [filters, setFilters] = useState<LeadFilters>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('kanban');
  const [selected, setSelected] = useState<Lead | null>(null);
  // Valores distintos reais para popular os filtros (calculados de um fetch base
  // não-filtrado, uma vez — não mudam ao aplicar filtros).
  const [facets, setFacets] = useState<{ plataformas: string[]; criativos: string[]; termos: string[] }>({
    plataformas: [],
    criativos: [],
    termos: [],
  });
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

  // Facets: uma vez, a partir de todos os leads (sem filtro).
  useEffect(() => {
    let active = true;
    fetchLeads({})
      .then((all) => {
        if (!active) return;
        const distinct = (fn: (l: Lead) => string | null) =>
          Array.from(new Set(all.map(fn).filter((v): v is string => !!v && v.trim() !== ''))).sort((a, b) =>
            a.localeCompare(b, 'pt-BR'),
          );
        setFacets({
          plataformas: distinct((l) => l.origem),
          criativos: distinct((l) => l.utm_content),
          termos: distinct((l) => l.utm_term),
        });
      })
      .catch(() => {
        /* facets são um extra; falha silenciosa não bloqueia o painel */
      });
    return () => {
      active = false;
    };
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

  // Move do Kanban: update otimista + revert em erro.
  const moveLead = useCallback(async (leadId: string, status: StatusComercial) => {
    let snapshot: Lead[] = [];
    setLeads((cur) => {
      snapshot = cur;
      return cur.map((l) => (l.lead_id === leadId ? { ...l, status_comercial: status } : l));
    });
    setError('');
    try {
      const updated = await updateLead(leadId, { status_comercial: status });
      setLeads((cur) => cur.map((l) => (l.lead_id === leadId ? updated : l)));
    } catch (e) {
      setLeads(snapshot); // revert
      const msg = e instanceof Error ? e.message : 'erro';
      if (msg === 'unauthorized') {
        await supabase.auth.signOut();
        return;
      }
      setError('Não foi possível mover o lead. Tente novamente.');
    }
  }, []);

  const plataformas = useMemo(() => {
    const set = new Set<string>(KNOWN_PLATFORMS);
    facets.plataformas.forEach((p) => set.add(p));
    return Array.from(set);
  }, [facets.plataformas]);

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
              className="p-2 rounded-xl border border-[#E4DFD9] hover:bg-[#FEFEFE] transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <span className="hidden md:inline text-[12px] text-[#2B1B0A]/50 max-w-[180px] truncate">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-[#E4DFD9] hover:bg-[#FEFEFE] transition-colors"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-[#A95B21] text-[#A95B21]'
                  : 'border-transparent text-[#2B1B0A]/50 hover:text-[#2B1B0A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
        <Filters
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters({})}
          plataformas={plataformas}
          criativos={facets.criativos}
          termos={facets.termos}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-[#2B1B0A]/60">
            {loading ? 'Carregando…' : `${leads.length} lead${leads.length === 1 ? '' : 's'}`}
          </div>
        </div>

        {error && (
          <div className="text-[13px] text-[#8B2312] bg-[#8B2312]/10 border border-[#8B2312]/20 rounded-xl p-3">{error}</div>
        )}

        {tab === 'kanban' && <KanbanBoard leads={leads} onSelect={setSelected} onMove={moveLead} />}
        {tab === 'leads' && <LeadsTable leads={leads} onSelect={setSelected} />}
        {tab === 'dashboard' && <Dashboard leads={leads} />}
      </main>

      {selected && (
        <LeadDetailModal lead={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
};
