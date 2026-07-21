import React from 'react';
import type { Lead } from './types';
import { STATUS_LABEL, STATUS_STYLE, ORIGEM_AVATAR } from './types';
import { dateTime, initials } from './format';

interface LeadsTableProps {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}

const StatusBadge: React.FC<{ lead: Lead }> = ({ lead }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap ${STATUS_STYLE[lead.status_comercial]}`}>
    {STATUS_LABEL[lead.status_comercial]}
  </span>
);

export const LeadsTable: React.FC<LeadsTableProps> = ({ leads, onSelect }) => {
  if (leads.length === 0) {
    return (
      <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-12 text-center text-[#2B1B0A]/50 text-sm">
        Nenhum lead encontrado com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F6F0E9] text-left text-[11px] uppercase tracking-wide text-[#2B1B0A]/50">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Cidade/UF</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Campanha</th>
              <th className="px-4 py-3 font-medium">Criativo</th>
              <th className="px-4 py-3 font-medium">Termo</th>
              <th className="px-4 py-3 font-medium">Entrada</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4DFD9]">
            {leads.map((l) => (
              <tr
                key={l.id}
                onClick={() => onSelect(l)}
                className="cursor-pointer hover:bg-[#F6F0E9]/60 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-[#2B1B0A] max-w-[200px]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex-none w-7 h-7 rounded-full grid place-items-center text-white text-[10px] font-semibold"
                      style={{ backgroundColor: (l.origem && ORIGEM_AVATAR[l.origem]) || '#8A94A6' }}
                    >
                      {initials(l.nome)}
                    </span>
                    <span className="truncate">{l.nome || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-[#2B1B0A]/80">{l.whatsapp || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-[#2B1B0A]/80">
                  {[l.cidade, l.estado].filter(Boolean).join('/') || '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-[#2B1B0A]/80">{l.origem || '—'}</td>
                <td className="px-4 py-3 max-w-[160px] truncate text-[#2B1B0A]/70" title={l.utm_campaign || ''}>{l.utm_campaign || '—'}</td>
                <td className="px-4 py-3 max-w-[160px] truncate text-[#2B1B0A]/70" title={l.utm_content || ''}>{l.utm_content || '—'}</td>
                <td className="px-4 py-3 max-w-[160px] truncate text-[#2B1B0A]/70" title={l.utm_term || ''}>{l.utm_term || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-[#2B1B0A]/70">{dateTime(l.criado_em)}</td>
                <td className="px-4 py-3"><StatusBadge lead={l} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-[#2B1B0A]/80">{l.responsavel || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
