import React from 'react';
import {
  Users,
  Megaphone,
  Search,
  Globe,
  CalendarCheck2,
  Stethoscope,
  BadgeCheck,
  Wallet,
  Receipt,
  Percent,
  UserRoundX,
  BellRing,
} from 'lucide-react';
import type { Lead } from './types';
import { computeMetrics, type BreakdownRow } from './metrics';
import { brl, pct } from './format';

interface DashboardProps {
  leads: Lead[];
}

// Card de KPI com ícone e número em destaque.
const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ComponentType<{ size?: number }>;
  accent?: string;
}> = ({ label, value, hint, icon: Icon, accent = '#565E48' }) => (
  <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4">
    <div className="flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-wide text-[#2B1B0A]/50">{label}</div>
      <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ backgroundColor: `${accent}1a`, color: accent }}>
        <Icon size={15} />
      </span>
    </div>
    <div className="text-[26px] leading-none font-serif text-[#222D19] mt-2.5">{value}</div>
    {hint && <div className="text-[12px] text-[#2B1B0A]/45 mt-1.5">{hint}</div>}
  </div>
);

// Funil comercial: Leads → Agendadas → Realizadas → Fechados.
const Funnel: React.FC<{ stages: { label: string; value: number; accent: string }[] }> = ({ stages }) => {
  const max = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4 md:p-5">
      <div className="text-[13px] font-semibold text-[#565E48] mb-4">Funil comercial</div>
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const width = Math.max(6, (s.value / max) * 100);
          const prev = i > 0 ? stages[i - 1].value : null;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-36 flex-none text-[13px] text-[#2B1B0A]/70">{s.label}</div>
              <div className="flex-1 h-9 relative">
                <div
                  className="h-full rounded-lg flex items-center px-3 text-white text-[13px] font-semibold transition-all"
                  style={{ width: `${width}%`, backgroundColor: s.accent }}
                >
                  {s.value}
                </div>
              </div>
              <div className="w-16 flex-none text-right text-[12px] text-[#2B1B0A]/45">
                {prev !== null && prev > 0 ? pct(s.value, prev) : ''}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-[#2B1B0A]/40 mt-3">% = conversão em relação à etapa anterior.</p>
    </div>
  );
};

const BreakdownTable: React.FC<{ title: string; rows: BreakdownRow[]; keyLabel: string }> = ({ title, rows, keyLabel }) => (
  <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl overflow-hidden">
    <div className="px-4 py-3 border-b border-[#E4DFD9] text-[13px] font-semibold text-[#565E48]">{title}</div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#F6F0E9] text-left text-[11px] uppercase tracking-wide text-[#2B1B0A]/50">
            <th className="px-4 py-2.5 font-medium">{keyLabel}</th>
            <th className="px-4 py-2.5 font-medium text-right">Leads</th>
            <th className="px-4 py-2.5 font-medium text-right">Cons. agend.</th>
            <th className="px-4 py-2.5 font-medium text-right">Cons. realiz.</th>
            <th className="px-4 py-2.5 font-medium text-right">Fechados</th>
            <th className="px-4 py-2.5 font-medium text-right">Faturamento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E4DFD9]">
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[#2B1B0A]/40 text-sm">Sem dados.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.chave} className="hover:bg-[#F6F0E9]/50">
              <td className="px-4 py-2.5 max-w-[220px] truncate text-[#2B1B0A]" title={r.chave}>{r.chave}</td>
              <td className="px-4 py-2.5 text-right text-[#2B1B0A]/80">{r.leads}</td>
              <td className="px-4 py-2.5 text-right text-[#2B1B0A]/80">{r.consultasMarcadas}</td>
              <td className="px-4 py-2.5 text-right text-[#2B1B0A]/80">{r.consultasRealizadas}</td>
              <td className="px-4 py-2.5 text-right text-[#2B1B0A]/80">{r.fechados}</td>
              <td className="px-4 py-2.5 text-right text-[#2B1B0A]/80">{brl(r.faturamento)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ leads }) => {
  const m = computeMetrics(leads);
  const plataformaEntries = Object.entries(m.porPlataforma).sort((a, b) => b[1] - a[1]);
  const motivos = Object.entries(m.motivosPerda).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Volume: total + por plataforma */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total de leads" value={m.total} icon={Users} accent="#222D19" />
        <Kpi label="Meta Ads" value={m.metaAds} hint={pct(m.metaAds, m.total) + ' do total'} icon={Megaphone} accent="#A95B21" />
        <Kpi label="Google Ads" value={m.googleAds} hint={pct(m.googleAds, m.total) + ' do total'} icon={Search} accent="#565E48" />
        <Kpi label="Diretos" value={m.diretos} hint={pct(m.diretos, m.total) + ' do total'} icon={Globe} accent="#8A94A6" />
      </div>

      {/* Funil + conversões-chave */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <Funnel
            stages={[
              { label: 'Leads', value: m.total, accent: '#8A94A6' },
              { label: 'Consultas agendadas', value: m.consultasMarcadas, accent: '#A95B21' },
              { label: 'Consultas realizadas', value: m.consultasRealizadas, accent: '#565E48' },
              { label: 'Tratamentos fechados', value: m.tratamentosFechados, accent: '#222D19' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <Kpi label="Taxa de conversão" value={pct(m.taxaConversao.num, m.taxaConversao.den)} hint="agendadas / leads" icon={Percent} accent="#A95B21" />
          <Kpi label="Taxa de fechamento" value={pct(m.taxaFechamento.num, m.taxaFechamento.den)} hint="fechados / realizadas" icon={BadgeCheck} accent="#222D19" />
        </div>
      </div>

      {/* Funil comercial — números */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Consultas agendadas" value={m.consultasMarcadas} icon={CalendarCheck2} accent="#A95B21" />
        <Kpi label="Consultas realizadas" value={m.consultasRealizadas} icon={Stethoscope} accent="#565E48" />
        <Kpi label="Tratamentos fechados" value={m.tratamentosFechados} icon={BadgeCheck} accent="#222D19" />
        <Kpi label="Faturamento" value={brl(m.faturamento)} icon={Wallet} accent="#565E48" />
        <Kpi label="Ticket médio" value={brl(m.ticketMedio)} icon={Receipt} accent="#A95B21" />
        <Kpi label="Sem acompanhamento" value={m.semAcompanhamento} hint="status “novo”" icon={BellRing} accent="#8A94A6" />
      </div>

      {/* Leads por plataforma (resumo) */}
      <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4 md:p-5">
        <div className="text-[13px] font-semibold text-[#565E48] mb-3">Leads por plataforma</div>
        <div className="space-y-2">
          {plataformaEntries.length === 0 && <div className="text-sm text-[#2B1B0A]/40">Sem dados.</div>}
          {plataformaEntries.map(([plat, count]) => {
            const width = m.total ? (count / m.total) * 100 : 0;
            return (
              <div key={plat} className="flex items-center gap-3">
                <div className="w-32 text-sm text-[#2B1B0A]/80 truncate" title={plat}>{plat}</div>
                <div className="flex-1 h-3 bg-[#F6F0E9] rounded-full overflow-hidden">
                  <div className="h-full bg-[#A95B21] rounded-full" style={{ width: `${width}%` }} />
                </div>
                <div className="w-20 text-right text-sm text-[#2B1B0A]/70">{count} ({pct(count, m.total)})</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desempenho por plataforma / criativo / termo */}
      <BreakdownTable title="Desempenho por plataforma" rows={m.porPlataformaDet} keyLabel="Plataforma" />
      <BreakdownTable title="Desempenho por criativo (utm_content)" rows={m.porCriativo} keyLabel="Criativo" />
      <BreakdownTable title="Desempenho por termo de pesquisa (utm_term)" rows={m.porTermo} keyLabel="Termo" />

      {/* Motivos de perda */}
      <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4 md:p-5">
        <div className="text-[13px] font-semibold text-[#565E48] mb-3 inline-flex items-center gap-2">
          <UserRoundX size={15} className="text-[#8B2312]" /> Principais motivos de perda
        </div>
        {motivos.length === 0 ? (
          <div className="text-sm text-[#2B1B0A]/40">Nenhum motivo de perda registrado.</div>
        ) : (
          <ul className="space-y-1.5">
            {motivos.map(([motivo, count]) => (
              <li key={motivo} className="flex justify-between text-sm">
                <span className="text-[#2B1B0A]/80">{motivo}</span>
                <span className="text-[#2B1B0A]/50">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
