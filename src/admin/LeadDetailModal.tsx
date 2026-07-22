import React, { useState } from 'react';
import { X, PartyPopper, XCircle } from 'lucide-react';
import type { Lead, LeadCommercialUpdate, StatusComercial } from './types';
import { STATUS_ORDER, STATUS_LABEL } from './types';
import { updateLead } from './api';
import { dateTime, dateShort } from './format';

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}

const inputCls =
  'w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all';
const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-[#2B1B0A]/50 mb-1';

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-[#2B1B0A]/45">{label}</div>
    <div className="text-[14px] text-[#2B1B0A] break-words">{value || '—'}</div>
  </div>
);

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose, onSaved }) => {
  const [form, setForm] = useState<LeadCommercialUpdate>({
    status_comercial: lead.status_comercial,
    data_consulta: lead.data_consulta,
    valor_fechado: lead.valor_fechado,
    motivo_perda: lead.motivo_perda,
    observacoes: lead.observacoes,
    responsavel: lead.responsavel,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const set = (patch: Partial<LeadCommercialUpdate>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSavedMsg('');
  };

  // Campos contextuais: valor quando a consulta é realizada (ou se já houver
  // valor); motivo quando há perda (desistência, estorno/cancelamento, inválido).
  const showValor = form.status_comercial === 'consulta_realizada' || form.valor_fechado != null;
  const showMotivo =
    ['desistiu_consulta', 'estorno_cancelada', 'outros_invalido'].includes(form.status_comercial as string) ||
    !!form.motivo_perda;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      const payload: LeadCommercialUpdate = {
        status_comercial: form.status_comercial,
        data_consulta: form.data_consulta || null,
        valor_fechado:
          form.valor_fechado === null || form.valor_fechado === undefined || (form.valor_fechado as unknown) === ''
            ? null
            : Number(form.valor_fechado),
        motivo_perda: form.motivo_perda || null,
        observacoes: form.observacoes || null,
        responsavel: form.responsavel || null,
      };
      const updated = await updateLead(lead.lead_id, payload);
      onSaved(updated);
      setSavedMsg('Alterações salvas.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      setError(msg === 'unauthorized' ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-[#F6F0E9] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans text-[#2B1B0A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-5 border-b border-[#E4DFD9]">
          <div>
            <h2 className="text-lg font-serif font-medium text-[#222D19]">{lead.nome || 'Lead sem nome'}</h2>
            <p className="text-[12px] text-[#2B1B0A]/50">Entrada em {dateTime(lead.criado_em)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          {/* Dados de contato / captura (somente leitura) */}
          <section>
            <h3 className="text-[13px] font-semibold text-[#565E48] mb-3">Dados do lead</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl p-4">
              <Field label="WhatsApp" value={lead.whatsapp} />
              <Field label="E-mail" value={lead.email} />
              <Field label="Cidade/UF" value={[lead.cidade, lead.estado].filter(Boolean).join('/')} />
              <Field label="Origem" value={lead.origem} />
              <Field label="Opção de interesse" value={lead.opcao_interesse} />
              <Field label="Disponibilidade" value={lead.periodo_preferido} />
              {lead.datas_preferidas && (
                <div className="col-span-2 md:col-span-3">
                  <Field label="Datas informadas" value={lead.datas_preferidas} />
                </div>
              )}
            </div>
          </section>

          {/* Contexto clínico — sensível, só aqui na tela de detalhe (LGPD) */}
          <section>
            <h3 className="text-[13px] font-semibold text-[#565E48] mb-3">Contexto informado (uso interno)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl p-4">
              <Field label="Comportamento do hálito" value={lead.comportamento_halito} />
              <Field label="Uso de antibiótico (21 dias)" value={lead.uso_antibiotico} />
            </div>
          </section>

          {/* Rastreamento */}
          <section>
            <h3 className="text-[13px] font-semibold text-[#565E48] mb-3">Rastreamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl p-4">
              <Field label="UTM Source" value={lead.utm_source} />
              <Field label="UTM Medium" value={lead.utm_medium} />
              <Field label="UTM Campaign" value={lead.utm_campaign} />
              <Field label="UTM Content (criativo)" value={lead.utm_content} />
              <Field label="UTM Term" value={lead.utm_term} />
              <Field label="Etapa do funil" value={lead.etapa_funil} />
            </div>
          </section>

          {/* Campos comerciais editáveis */}
          <section>
            <h3 className="text-[13px] font-semibold text-[#565E48] mb-3">Acompanhamento comercial</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Status comercial</label>
                <select
                  className={inputCls}
                  value={form.status_comercial}
                  onChange={(e) => set({ status_comercial: e.target.value as StatusComercial })}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsável</label>
                <input className={inputCls} value={form.responsavel || ''} onChange={(e) => set({ responsavel: e.target.value })} placeholder="Quem está atendendo" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Data da consulta</label>
                <input type="date" className={inputCls} value={form.data_consulta || ''} onChange={(e) => set({ data_consulta: e.target.value })} />
              </div>
            </div>

            {/* Callout do valor — aparece ao fechar (alimenta faturamento/ticket) */}
            {showValor && (
              <div className="mt-4 rounded-2xl border border-[#222D19]/25 bg-[#222D19]/[0.04] p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#222D19]">
                  <PartyPopper size={16} /> Consulta realizada — registre o valor
                </div>
                <p className="text-[12px] text-[#2B1B0A]/55 mt-1 mb-3">
                  Este valor alimenta o <strong>faturamento</strong> e o <strong>ticket médio</strong> do dashboard.
                </p>
                <label className={labelCls}>Valor da consulta (R$)</label>
                <div className="relative max-w-[220px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2B1B0A]/45 text-sm">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputCls} pl-9 text-[15px] font-medium`}
                    value={form.valor_fechado ?? ''}
                    onChange={(e) => set({ valor_fechado: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="0,00"
                  />
                </div>
              </div>
            )}

            {/* Callout do motivo — aparece ao não fechar */}
            {showMotivo && (
              <div className="mt-4 rounded-2xl border border-[#8B2312]/25 bg-[#8B2312]/[0.05] p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#8B2312]">
                  <XCircle size={16} /> Perda — registre o motivo
                </div>
                <p className="text-[12px] text-[#2B1B0A]/55 mt-1 mb-3">Ajuda a entender as perdas nos relatórios.</p>
                <label className={labelCls}>Motivo da perda</label>
                <input className={inputCls} value={form.motivo_perda || ''} onChange={(e) => set({ motivo_perda: e.target.value })} placeholder="Ex.: valor, distância, foi em outro lugar…" />
              </div>
            )}

            <div className="mt-4">
              <label className={labelCls}>Observações</label>
              <textarea
                className={`${inputCls} min-h-[90px] resize-y`}
                value={form.observacoes || ''}
                onChange={(e) => set({ observacoes: e.target.value })}
                placeholder="Anotações internas do atendimento"
              />
            </div>
            <p className="text-[11px] text-[#2B1B0A]/40 mt-2">Última atualização: {dateShort(lead.atualizado_em)}</p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between gap-3 p-4 border-t border-[#E4DFD9] bg-[#F6F0E9]">
          <div className="text-[13px] min-h-[18px]">
            {error && <span className="text-[#8B2312]">{error}</span>}
            {savedMsg && <span className="text-[#565E48]">{savedMsg}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm border border-[#E4DFD9] hover:bg-[#FEFEFE] transition-colors">
              Fechar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#222D19] hover:bg-[#222D19]/90 disabled:opacity-50 text-white transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
