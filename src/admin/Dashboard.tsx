import React from 'react';
import type { Lead } from './types';
import { computeMetrics, type BreakdownRow } from './metrics';
import { brl, pct } from './format';

interface DashboardProps {
  leads: Lead[];
}

const Kpi: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4">
    <div className="text-[11px] uppercase tracking-wide text-[#2B1B0A]/50">{label}</div>
    <div className="text-2xl font-serif text-[#222D19] mt-1">{value}</div>
    {hint && <div className="text-[12px] text-[#2B1B0A]/45 mt-0.5">{hint}</div>}
  </div>
);

const BreakdownTable: React.FC<{ title: string; rows: BreakdownRow[]; keyLabel: string }> = ({ title, rows, keyLabel }) => (
  <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl overflow-hidden">
    <div className="px-4 py-3 border-b border-[#E4DFD9] text-[13px] font-semibold text-[#565E48]">{title}</div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#F6F0E9] text-left text-[11px] uppercase tracking-wide text-[#2B1B0A]/50">
            <th className="px-4 py-2.5 font-medium">{keyLabel}</th>
            <th className="px-4 py-2.5 font-medium text-right">Leads</th>
            <th className="px-4 py-2.5 font-medium text-right">Cons. marc.</th>
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
            <tr key={r.chave}>
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
    <div className="space-y-6">
      {/* Volume: total + por plataforma */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total de leads" value={m.total} />
        <Kpi label="Meta Ads" value={m.metaAds} hint={pct(m.metaAds, m.total) + ' do total'} />
        <Kpi label="Google Ads" value={m.googleAds} hint={pct(m.googleAds, m.total) + ' do total'} />
        <Kpi label="Diretos" value={m.diretos} hint={pct(m.diretos, m.total) + ' do total'} />
      </div>

      {/* Funil comercial */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi label="Consultas agendadas" value={m.consultasMarcadas} />
        <Kpi label="Consultas realizadas" value={m.consultasRealizadas} />
        <Kpi label="Tratamentos fechados" value={m.tratamentosFechados} />
        <Kpi label="Taxa de conversão" value={pct(m.taxaConversao.num, m.taxaConversao.den)} hint="consultas agendadas / leads" />
        <Kpi label="Taxa de comparecimento" value={pct(m.taxaComparecimento.num, m.taxaComparecimento.den)} hint="realizadas / agendadas" />
        <Kpi label="Taxa de fechamento" value={pct(m.taxaFechamento.num, m.taxaFechamento.den)} hint="fechados / realizadas" />
        <Kpi label="Faturamento" value={brl(m.faturamento)} />
        <Kpi label="Ticket médio" value={brl(m.ticketMedio)} />
        <Kpi label="Leads sem acompanhamento" value={m.semAcompanhamento} hint="status “novo”" />
      </div>

      {/* Leads por plataforma (resumo) */}
      <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4">
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
                <div className="w-16 text-right text-sm text-[#2B1B0A]/70">{count} ({pct(count, m.total)})</div>
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
      <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4">
        <div className="text-[13px] font-semibold text-[#565E48] mb-3">Principais motivos de perda</div>
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
