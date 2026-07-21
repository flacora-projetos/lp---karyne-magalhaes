import React from 'react';
import type { LeadFilters } from './api';
import { STATUS_ORDER, STATUS_LABEL } from './types';

interface FiltersProps {
  value: LeadFilters;
  onChange: (next: LeadFilters) => void;
  onClear: () => void;
  plataformas: string[];
  criativos: string[]; // valores distintos reais de utm_content
  termos: string[]; // valores distintos reais de utm_term
}

// Encurta rótulos longos de criativo/termo mantendo o value cheio.
const short = (v: string, max = 42) => (v.length > max ? `${v.slice(0, max - 1)}…` : v);

const inputCls =
  'w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all';
const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-[#2B1B0A]/50 mb-1';

export const Filters: React.FC<FiltersProps> = ({ value, onChange, onClear, plataformas, criativos, termos }) => {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...value, ...patch });

  const hasAny = Object.values(value).some((v) => v !== undefined && String(v).trim() !== '');

  return (
    <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4 md:p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Período — de</label>
          <input type="date" className={inputCls} value={value.periodoDe || ''} onChange={(e) => set({ periodoDe: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Período — até</label>
          <input type="date" className={inputCls} value={value.periodoAte || ''} onChange={(e) => set({ periodoAte: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Plataforma</label>
          <select className={inputCls} value={value.plataforma || ''} onChange={(e) => set({ plataforma: e.target.value })}>
            <option value="">Todas</option>
            {plataformas.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status comercial</label>
          <select className={inputCls} value={value.statusComercial || ''} onChange={(e) => set({ statusComercial: e.target.value })}>
            <option value="">Todos</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Campanha</label>
          <input className={inputCls} value={value.campanha || ''} onChange={(e) => set({ campanha: e.target.value })} placeholder="utm_campaign" />
        </div>
        <div>
          <label className={labelCls}>Criativo</label>
          <select className={inputCls} value={value.criativo || ''} onChange={(e) => set({ criativo: e.target.value })}>
            <option value="">Todos</option>
            {criativos.map((c) => (
              <option key={c} value={c}>{short(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Termo de pesquisa</label>
          <select className={inputCls} value={value.termo || ''} onChange={(e) => set({ termo: e.target.value })}>
            <option value="">Todos</option>
            {termos.map((t) => (
              <option key={t} value={t}>{short(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cidade</label>
          <input className={inputCls} value={value.cidade || ''} onChange={(e) => set({ cidade: e.target.value })} placeholder="Cidade" />
        </div>
        <div>
          <label className={labelCls}>Responsável</label>
          <input className={inputCls} value={value.responsavel || ''} onChange={(e) => set({ responsavel: e.target.value })} placeholder="Responsável" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Buscar (nome, WhatsApp, e-mail)</label>
          <input className={inputCls} value={value.busca || ''} onChange={(e) => set({ busca: e.target.value })} placeholder="Buscar…" />
        </div>
        <div className="flex items-end">
          <button
            onClick={onClear}
            disabled={!hasAny}
            className="w-full border border-[#E4DFD9] text-[#2B1B0A]/70 rounded-xl px-3 py-2 text-sm hover:bg-[#F6F0E9] disabled:opacity-40 transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
};
