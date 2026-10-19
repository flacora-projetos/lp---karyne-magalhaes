import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Lead } from './types';
import { createManualLead, DuplicateLeadError } from './api';
import { WHATSAPP_ADS, ANUNCIO_SEM_CODIGO, NAO_VEIO_DE_ANUNCIO } from '../../lib/whatsappLeads';

interface NewLeadModalProps {
  onClose: () => void;
  onCreated: (lead: Lead) => void;
  onOpenExisting: (leadId: string) => void;
}

const inputCls =
  'w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all';
const labelCls = 'block text-[13px] font-medium mb-1.5 pl-1';

const ORIGENS = [
  ...WHATSAPP_ADS.map((ad) => ({ value: ad.code, label: `${ad.code} · ${ad.label}` })),
  { value: ANUNCIO_SEM_CODIGO, label: 'Veio do anúncio, mas sem código' },
  { value: NAO_VEIO_DE_ANUNCIO, label: 'Não veio de anúncio' },
];

/** Cadastro rápido de quem chamou direto no WhatsApp (anúncio sem passar pelo site). */
export const NewLeadModal: React.FC<NewLeadModalProps> = ({ onClose, onCreated, onOpenExisting }) => {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicado, setDuplicado] = useState<DuplicateLeadError['duplicado'] | null>(null);

  const valid = nome.trim() && whatsapp.replace(/\D/g, '').length >= 8 && anuncio;

  const submit = async (vincularA?: string) => {
    setSaving(true);
    setError('');
    try {
      const lead = await createManualLead({ nome: nome.trim(), whatsapp: whatsapp.trim(), anuncio, vincularA });
      onCreated(lead);
    } catch (e) {
      if (e instanceof DuplicateLeadError) {
        setDuplicado(e.duplicado);
      } else {
        const msg = e instanceof Error ? e.message : '';
        setError(msg === 'unauthorized' ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível cadastrar. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-[#F6F0E9] w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans text-[#2B1B0A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none flex items-center justify-between p-5 border-b border-[#E4DFD9]">
          <div>
            <h2 className="text-lg font-serif font-medium text-[#222D19]">Novo paciente</h2>
            <p className="text-[12px] text-[#2B1B0A]/50">Para quem chamou direto no WhatsApp</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <form
          className="flex-1 overflow-y-auto p-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !saving) void submit();
          }}
        >
          <div>
            <label className={labelCls} htmlFor="novo-nome">Nome</label>
            <input id="novo-nome" className={inputCls} value={nome} onChange={(e) => { setNome(e.target.value); setDuplicado(null); }} placeholder="Nome do paciente" autoComplete="off" />
          </div>
          <div>
            <label className={labelCls} htmlFor="novo-whatsapp">WhatsApp</label>
            <input id="novo-whatsapp" type="tel" className={inputCls} value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setDuplicado(null); }} placeholder="(62) 99999-9999" autoComplete="off" />
          </div>
          <div>
            <label className={labelCls}>De onde veio</label>
            <p className="text-[12px] text-[#2B1B0A]/55 mb-2 pl-1">O código aparece no fim da primeira mensagem da pessoa.</p>
            <div className="space-y-2">
              {ORIGENS.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    anuncio === o.value ? 'bg-[#FEFEFE] border-[#A95B21] ring-1 ring-[#A95B21]' : 'bg-[#FEFEFE] border-[#E4DFD9] hover:border-[#A95B21]/40'
                  }`}
                >
                  <input type="radio" name="anuncio" value={o.value} checked={anuncio === o.value} onChange={() => setAnuncio(o.value)} className="accent-[#A95B21]" />
                  <span className="text-[14px]">{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          {duplicado && (
            <div className="text-[13px] bg-[#A95B21]/10 border border-[#A95B21]/25 rounded-xl p-3 space-y-3">
              <p>
                Esse WhatsApp já está no painel{duplicado.nome ? <> como <strong>{duplicado.nome}</strong></> : null}
                {duplicado.origem ? ` (origem: ${duplicado.origem})` : ''}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void submit(duplicado.lead_id)} disabled={saving}
                  className="px-3 py-2 rounded-xl bg-[#222D19] text-white text-[13px] disabled:opacity-50">
                  Registrar esta origem nele
                </button>
                <button type="button" onClick={() => onOpenExisting(duplicado.lead_id)}
                  className="px-3 py-2 rounded-xl border border-[#E4DFD9] bg-[#FEFEFE] text-[13px]">
                  Abrir o cadastro
                </button>
              </div>
            </div>
          )}

          {error && <div className="text-[13px] text-[#8B2312] bg-[#8B2312]/10 border border-[#8B2312]/20 rounded-xl p-3">{error}</div>}

          <button
            type="submit"
            disabled={!valid || saving || !!duplicado}
            className="w-full bg-[#222D19] hover:bg-[#222D19]/90 disabled:bg-[#E4DFD9] disabled:text-[#2B1B0A]/40 transition-colors text-white py-3.5 rounded-xl font-medium text-[15px]"
          >
            {saving ? 'Salvando…' : 'Cadastrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
