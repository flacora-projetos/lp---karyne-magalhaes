import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RefreshCw, LogOut, LayoutGrid, List, BarChart3, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import { fetchLeads, updateLead, type LeadFilters } from './api';
import type { Lead, StatusComercial } from './types';
import { STATUS_LABEL } from './types';
import { dateOnly } from './format';
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
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'leads', label: 'Leads', icon: List },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
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

  // Chips de filtros ativos (rótulo curto + chave para remoção).
  const activeFilterChips = useMemo(() => {
    const trunc = (v: string, n = 24) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);
    const chips: { key: keyof LeadFilters; label: string }[] = [];
    const f = filters;
    if (f.periodoDe) chips.push({ key: 'periodoDe', label: `De ${dateOnly(f.periodoDe)}` });
    if (f.periodoAte) chips.push({ key: 'periodoAte', label: `Até ${dateOnly(f.periodoAte)}` });
    if (f.plataforma) chips.push({ key: 'plataforma', label: f.plataforma });
    if (f.statusComercial) chips.push({ key: 'statusComercial', label: STATUS_LABEL[f.statusComercial as keyof typeof STATUS_LABEL] ?? f.statusComercial });
    if (f.campanha) chips.push({ key: 'campanha', label: `Camp.: ${trunc(f.campanha)}` });
    if (f.criativo) chips.push({ key: 'criativo', label: `Criativo: ${trunc(f.criativo)}` });
    if (f.termo) chips.push({ key: 'termo', label: `Termo: ${trunc(f.termo)}` });
    if (f.cidade) chips.push({ key: 'cidade', label: `Cidade: ${trunc(f.cidade)}` });
    if (f.responsavel) chips.push({ key: 'responsavel', label: `Resp.: ${trunc(f.responsavel)}` });
    if (f.busca) chips.push({ key: 'busca', label: `"${trunc(f.busca)}"` });
    return chips;
  }, [filters]);

  // Só o Kanban usa o layout de altura fixa (100dvh) para congelar a linha das
  // colunas. Leads e Dashboard mantêm a rolagem natural da página (comportamento
  // original), com o cabeçalho fixo no topo.
  const isKanban = tab === 'kanban';

  return (
    <div
      className={
        isKanban
          ? 'h-[100dvh] flex flex-col overflow-hidden bg-[#F6F0E9] font-sans text-[#2B1B0A]'
          : 'min-h-screen bg-[#F6F0E9] font-sans text-[#2B1B0A]'
      }
    >
      {/* Top bar */}
      <header
        className={
          isKanban
            ? 'flex-none bg-[#F6F0E9] border-b border-[#E4DFD9]'
            : 'sticky top-0 z-30 bg-[#F6F0E9]/95 backdrop-blur border-b border-[#E4DFD9]'
        }
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#222D19] text-[#F6F0E9] grid place-items-center font-serif text-[15px] font-medium leading-none">
              KM
            </div>
            <div>
              <h1 className="text-[15px] font-serif font-medium text-[#222D19] leading-none">Painel de Leads</h1>
              <p className="text-[12px] text-[#2B1B0A]/50 mt-1">Dra. Karyne Magalhães</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(filters)}
              className="p-2 rounded-xl border border-[#E4DFD9] bg-[#FEFEFE] hover:bg-[#F0E9E0] transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <span className="hidden md:inline text-[12px] text-[#2B1B0A]/50 max-w-[180px] truncate">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-[#E4DFD9] bg-[#FEFEFE] hover:bg-[#F0E9E0] transition-colors"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
        {/* Tabs — segmented pills */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 pb-3">
          <div className="inline-flex gap-1 p-1 rounded-2xl bg-[#E7DED3] border border-[#E4DFD9]">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-3.5 md:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    tab === t.id
                      ? 'bg-[#FEFEFE] text-[#222D19] shadow-sm'
                      : 'text-[#2B1B0A]/55 hover:text-[#2B1B0A]'
                  }`}
                >
                  <Icon size={16} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main
        className={
          isKanban
            ? 'flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 md:px-6 pt-5 pb-4 flex flex-col gap-4'
            : 'max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5'
        }
      >
        {/* Filtros + contagem (fixos apenas no Kanban) */}
        <div className={isKanban ? 'flex-none space-y-4' : 'space-y-5'}>
        <Filters
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters({})}
          plataformas={plataformas}
          criativos={facets.criativos}
          termos={facets.termos}
        />

        <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
          <div className="text-sm font-medium text-[#2B1B0A]/70">
            {loading ? 'Carregando…' : `${leads.length} lead${leads.length === 1 ? '' : 's'}`}
          </div>
          {activeFilterChips.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5">
              {activeFilterChips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 text-[12px] text-[#565E48] bg-[#565E48]/10 border border-[#565E48]/15 rounded-full pl-2.5 pr-1 py-0.5"
                >
                  {c.label}
                  <button
                    onClick={() => setFilters((f) => ({ ...f, [c.key]: undefined }))}
                    className="grid place-items-center w-4 h-4 rounded-full hover:bg-[#565E48]/20"
                    title="Remover filtro"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="text-[13px] text-[#8B2312] bg-[#8B2312]/10 border border-[#8B2312]/20 rounded-xl p-3">{error}</div>
        )}
        </div>

        {/* Kanban: rola por dentro (mantém a linha das colunas à vista).
            Leads e Dashboard: rolagem natural da página. */}
        {tab === 'kanban' && (
          <div className="flex-1 min-h-0">
            <KanbanBoard leads={leads} onSelect={setSelected} onMove={moveLead} />
          </div>
        )}
        {tab === 'leads' && <LeadsTable leads={leads} onSelect={setSelected} />}
        {tab === 'dashboard' && <Dashboard leads={leads} />}
      </main>

      {selected && (
        <LeadDetailModal lead={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
};
