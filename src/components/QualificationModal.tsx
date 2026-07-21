import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { trackCustomEvent, generateEventId, getFbpCookie, getFbcCookie, sendMetaCapiEvent } from '../utils/metaPixel';
import { pushDataLayerEvent } from '../utils/gtm';

interface QualificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

type AntibioticStatus = 'Não' | 'Sim' | 'Não tenho certeza';
type PeriodOption = 'Manhã' | 'Tarde' | 'Posso me adaptar';

interface LeadData {
  nome: string;
  whatsapp: string;
  email: string;
  cidade: string;
  estado: string;
  comportamentoHalito: string;
  modalidade: string;
  antibioticos: AntibioticStatus | '';
  periodo: PeriodOption | '';
  datasOpcional: string;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypbOG2r2Zka810XL8er9zUUSGHjsscOQw_db95uh9azXYh7adlTNhAn1_u0VxzLn4/exec";

/**
 * Envia o MESMO payload da planilha, em paralelo, para o mini CRM (Postgres via
 * /api/leads). Fire-and-forget e totalmente isolado: qualquer erro aqui é
 * silencioso e NÃO afeta o envio para o Apps Script/planilha nem o fluxo da LP.
 */
const sendLeadToCrm = (payload: Record<string, unknown>) => {
  try {
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
};

const TOTAL_STEPS = 7;

const getTrackingData = () => {
  const params = new URLSearchParams(window.location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
  
  keys.forEach(key => {
    if (params.has(key)) {
      sessionStorage.setItem(key, params.get(key) || '');
    }
  });

  return {
    utmSource: sessionStorage.getItem('utm_source') || '',
    utmMedium: sessionStorage.getItem('utm_medium') || '',
    utmCampaign: sessionStorage.getItem('utm_campaign') || '',
    utmContent: sessionStorage.getItem('utm_content') || '',
    utmTerm: sessionStorage.getItem('utm_term') || '',
    fbclid: sessionStorage.getItem('fbclid') || '',
    gclid: sessionStorage.getItem('gclid') || '',
    pageUrl: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    metaFbp: getFbpCookie() || '',
    metaFbc: getFbcCookie() || ''
  };
};

export const QualificationModal: React.FC<QualificationModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [leadId, setLeadId] = useState<string>('');
  const eventIds = useRef({
    eventIdFilterOpen: '',
    eventIdContactCaptured: '',
    eventIdLead: '',
    eventIdContact: ''
  });
  const [data, setData] = useState<LeadData>({
    nome: '',
    whatsapp: '',
    email: '',
    cidade: '',
    estado: '',
    comportamentoHalito: '',
    modalidade: '',
    antibioticos: '',
    periodo: '',
    datasOpcional: ''
  });

  // Handle escape key, tracking data, and generate leadId
  useEffect(() => {
    let currentLeadId = leadId;
    if (isOpen) {
      if (!currentLeadId) {
        try {
          currentLeadId = crypto.randomUUID();
          setLeadId(currentLeadId);
        } catch (e) {
          currentLeadId = 'lead-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          setLeadId(currentLeadId);
        }
      }
      getTrackingData();
      
      // Fire 'Filtro aberto' event when modal opens, if we are at step 1
      if (step === 1 && !eventIds.current.eventIdFilterOpen) {
        eventIds.current.eventIdFilterOpen = generateEventId();
        pushDataLayerEvent("filtro_aberto");
        trackCustomEvent("FiltroAberto", { lp_event: "FiltroAberto" }, { eventID: eventIds.current.eventIdFilterOpen });
        const payload = {
          leadId: currentLeadId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'Filtro aberto (Abriu o filtro)',
          currentStep: 1,
          nomeCompleto: 'Visitante (Início)',
          eventIdFilterOpen: eventIds.current.eventIdFilterOpen,
          eventIdContactCaptured: eventIds.current.eventIdContactCaptured,
          eventIdLead: eventIds.current.eventIdLead,
          eventIdContact: eventIds.current.eventIdContact,
          ...getTrackingData()
        };
        fetch(GOOGLE_SCRIPT_URL, {
          method: "POST", mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        }).catch(e => console.error(e));
        sendLeadToCrm(payload);
      }
    }
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sendDataToSheets = (statusOverride?: string, stepOverride?: number) => {
    const tracking = getTrackingData();
    const payload = {
      leadId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: statusOverride || 'Contato capturado',
      currentStep: stepOverride || step,
      nomeCompleto: data.nome,
      whatsapp: data.whatsapp,
      email: data.email,
      cidade: data.cidade,
      estado: data.estado,
      comportamentoHalito: data.comportamentoHalito,
      opcaoInteresse: data.modalidade,
      usoAntibiotico: data.antibioticos,
      periodoPreferido: data.periodo,
      datasPreferidas: data.datasOpcional,
      eventIdFilterOpen: eventIds.current.eventIdFilterOpen,
      eventIdContactCaptured: eventIds.current.eventIdContactCaptured,
      eventIdLead: eventIds.current.eventIdLead,
      eventIdContact: eventIds.current.eventIdContact,
      ...tracking
    };

    console.log("Enviando lead para Sheets:", payload);

    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    })
    .then(() => console.log("Fetch para Sheets enviado (no-cors). status:", statusOverride))
    .catch(e => console.error("Error sending lead to sheets:", e));

    // Espelha o mesmo payload no mini CRM (Postgres), sem afetar o envio acima.
    sendLeadToCrm(payload);
  };

  const nextStep = () => {
    const nextS = Math.min(step + 1, TOTAL_STEPS);
    setStep(nextS);
    window.scrollTo({ top: 0, behavior: 'auto' });
    
    const eventID = generateEventId();
    const capiPayloadBase = {
      email: data.email,
      phone: data.whatsapp,
      firstName: data.nome?.split(" ")[0] || "",
      lastName: data.nome?.split(" ").slice(1).join(" ") || "",
      city: data.cidade,
      state: data.estado,
      fbp: getFbpCookie(),
      fbc: getFbcCookie() || sessionStorage.getItem('fbclid') || undefined,
      fbclid: sessionStorage.getItem('fbclid') || undefined,
      pageUrl: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent
    };

    if (step === 1 && nextS === 2 && !eventIds.current.eventIdContactCaptured) {
      eventIds.current.eventIdContactCaptured = eventID;
      trackCustomEvent("FormularioIniciado", { lp_event: "FormularioIniciado" }, { eventID });
      sendMetaCapiEvent({ eventName: "FormularioIniciado", eventId: eventID, ...capiPayloadBase });
      pushDataLayerEvent("formulario_iniciado");
    } else if (nextS > 1 && nextS < TOTAL_STEPS) {
      trackCustomEvent("EtapaRespondida", { lp_event: "EtapaRespondida", step: nextS }, { eventID });
      pushDataLayerEvent("etapa_respondida", { step });
    } else if (nextS === TOTAL_STEPS && !eventIds.current.eventIdLead) {
      eventIds.current.eventIdLead = eventID;
      trackCustomEvent("FiltroCompleto", { lp_event: "FiltroCompleto" }, { eventID });
      sendMetaCapiEvent({ eventName: "FiltroCompleto", eventId: eventID, ...capiPayloadBase });
      pushDataLayerEvent("filtro_completo");
    }

    let status = 'Respondendo perguntas (Ainda no preenchimento)';
    if (nextS === 2) status = 'Lead gerado(Lead formado)';
    if (nextS === 3) status = 'Filtro iniciado (Começou a responder)';
    if (nextS === TOTAL_STEPS) status = 'Filtro concluído(Concluiu o filtro)';
    sendDataToSheets(status, nextS);
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleChange = (field: keyof LeadData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleWhatsApp = () => {
    if (!eventIds.current.eventIdContact) {
      eventIds.current.eventIdContact = generateEventId();
      pushDataLayerEvent("clique_saida");
      trackCustomEvent("CliqueSaida", { lp_event: "CliqueSaida" }, { eventID: eventIds.current.eventIdContact });
      const capiPayloadBase = {
        email: data.email,
        phone: data.whatsapp,
        firstName: data.nome?.split(" ")[0] || "",
        lastName: data.nome?.split(" ").slice(1).join(" ") || "",
        city: data.cidade,
        state: data.estado,
        fbp: getFbpCookie(),
        fbc: getFbcCookie() || sessionStorage.getItem('fbclid') || undefined,
        fbclid: sessionStorage.getItem('fbclid') || undefined,
        pageUrl: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent
      };
      sendMetaCapiEvent({ eventName: "CliqueSaida", eventId: eventIds.current.eventIdContact, ...capiPayloadBase });
    }
    sendDataToSheets('WhatsApp aberto(clicou para WhatsApp)', TOTAL_STEPS);
    const phone = '5562999320675';
    const linhas = [
      `Nome: ${data.nome}`,
      `WhatsApp: ${data.whatsapp}`,
      data.email && `Melhor e-mail: ${data.email}`,
      (data.cidade || data.estado) && `Cidade/UF: ${[data.cidade, data.estado].filter(Boolean).join('/')}`,
      `Situação informada: ${data.comportamentoHalito}`,
      `Opção de interesse: ${data.modalidade}`,
      `Uso de antibióticos nos últimos 21 dias: ${data.antibioticos}`,
      `Período preferido: ${data.periodo}`,
      `Datas ou horários informados: ${data.datasOpcional || 'Não informado'}`,
    ].filter(Boolean).join('\n');

    const text = `Olá! Vim pela página da consulta de Halitose e respondi à avaliação inicial.

${linhas}

Gostaria de receber orientação e verificar os horários disponíveis para a consulta com a Dra. Karyne Magalhães.`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');
  };

  const isStep1Valid = !!data.whatsapp;
  const isStep6Valid = !!data.nome;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/40 backdrop-blur-sm transition-opacity">
      <div 
        className="bg-[#F6F0E9] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative font-sans text-[#2B1B0A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-6 border-b border-[#E4DFD9] bg-[#F6F0E9] z-10">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={prevStep} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors text-[#2B1B0A]">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="text-sm font-medium text-[#A95B21]">Etapa {step} de {TOTAL_STEPS}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-black/5 transition-colors text-[#2B1B0A]">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#E4DFD9] w-full">
          <div 
            className="h-full bg-[#A95B21] transition-all duration-300 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-3">Para começar, qual é o seu WhatsApp?</h2>
              <p className="text-[#2B1B0A]/70 text-sm mb-8">Assim, mesmo que você feche essa janela no meio do caminho, a equipe consegue continuar por lá. As próximas perguntas são sobre o seu caso.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 pl-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={data.whatsapp}
                    onChange={e => handleChange('whatsapp', e.target.value)}
                    className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="mt-10">
                <p className="text-[12px] md:text-[13px] text-[#2B1B0A]/60 mb-4 text-center">
                  Ao continuar, você declara estar ciente da nossa <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#222D19] transition-colors">Política de Privacidade</a>.
                </p>
                <button
                  onClick={() => {
                    nextStep();
                  }}
                  disabled={!isStep1Valid}
                  className="w-full bg-[#222D19] hover:bg-[#222D19]/90 disabled:bg-[#E4DFD9] disabled:text-[#2B1B0A]/40 transition-colors text-white py-4 rounded-xl font-medium text-[15px]"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-8">Qual situação mais se aproxima do seu caso?</h2>
              
              <div className="space-y-3">
                {[
                  'O odor costuma estar presente com frequência',
                  'O odor aparece e desaparece',
                  'Fui alertado por alguém, mas não consigo perceber',
                  'Tenho dúvida se realmente existe alteração',
                  'Quero realizar uma avaliação preventiva',
                  'Prefiro explicar diretamente à equipe'
                ].map((opcao) => (
                  <button
                    key={opcao}
                    onClick={() => {
                      handleChange('comportamentoHalito', opcao);
                      setTimeout(nextStep, 200);
                    }}
                    className={`w-full text-left p-4 md:p-5 rounded-xl border transition-all flex items-center justify-between group ${
                      data.comportamentoHalito === opcao 
                        ? 'bg-[#FEFEFE] border-[#A95B21] !shadow-[0_4px_12px_rgba(169,91,33,0.1)] ring-1 ring-[#A95B21]' 
                        : 'bg-[#FEFEFE] border-[#E4DFD9] hover:border-[#A95B21]/40 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[15px] pr-4">{opcao}</span>
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border flex items-center justify-center transition-colors ${
                      data.comportamentoHalito === opcao ? 'border-[#A95B21] bg-[#A95B21]' : 'border-[#E4DFD9] group-hover:border-[#A95B21]/40'
                    }`}>
                      {data.comportamentoHalito === opcao && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-2">Conheça as opções de avaliação</h2>
              <p className="text-[#2B1B0A]/70 text-sm mb-6">Com base nas suas respostas, você pode escolher uma das opções abaixo. Se ainda tiver dúvida, a equipe pode orientar qual avaliação faz mais sentido antes do agendamento.</p>
              
              <div className="space-y-4 mb-8">
                {/* Opção 1 */}
                <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-3">
                    <h3 className="text-lg font-medium font-serif text-[#222D19]">OralChroma</h3>
                    <div className="text-base font-semibold text-[#A95B21] md:text-right">R$ 770,00</div>
                  </div>
                  <p className="text-sm text-[#2B1B0A]/80 leading-relaxed mb-4">
                    Mede separadamente os gases presentes no hálito no momento da consulta.
                  </p>
                  <div className="text-[13px] text-[#2B1B0A]/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A95B21]"></span>
                    Cerca de 2 horas
                  </div>
                </div>

                {/* Opção 2 */}
                <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-3">
                    <h3 className="text-lg font-medium font-serif text-[#222D19]">OralChroma + Desafio da Cisteína</h3>
                    <div className="text-base font-semibold text-[#A95B21] md:text-right">R$ 1.090,00</div>
                  </div>
                  <p className="text-sm text-[#2B1B0A]/80 leading-relaxed mb-4">
                    Também avalia o potencial máximo de produção dos gases, sendo útil quando o odor oscila ou pode estar fraco no dia da consulta.
                  </p>
                  <div className="text-[13px] text-[#2B1B0A]/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A95B21]"></span>
                    Cerca de 2 horas
                  </div>
                </div>
              </div>

              <p className="text-[13px] text-[#2B1B0A]/60 leading-relaxed text-center mb-8 italic">
                Para confirmar o horário, a consulta é reservada mediante pagamento no momento do agendamento. Isso garante uma agenda individualizada, com tempo clínico dedicado, preparo da avaliação e uso dos recursos necessários para conduzir o diagnóstico com tranquilidade.
              </p>

              <h4 className="font-medium text-base mb-4">Como você prefere prosseguir?</h4>

              <p className="text-[13px] text-[#2B1B0A]/60 leading-relaxed mb-4">
                Se ficar com dúvida sobre qual opção escolher, a equipe ajuda a decidir pelo WhatsApp, sem compromisso.
              </p>

              <div className="space-y-3">
                {[
                  'Tenho interesse no OralChroma',
                  'Tenho interesse no OralChroma + Desafio da Cisteína',
                  'Ainda não sei qual escolher',
                  'Quero orientação da equipe antes de decidir'
                ].map((opcao) => (
                  <button
                    key={opcao}
                    onClick={() => {
                      handleChange('modalidade', opcao);
                      setTimeout(nextStep, 200);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                      data.modalidade === opcao 
                        ? 'bg-[#FEFEFE] border-[#A95B21] !shadow-[0_4px_12px_rgba(169,91,33,0.1)] ring-1 ring-[#A95B21]' 
                        : 'bg-[#FEFEFE] border-[#E4DFD9] hover:border-[#A95B21]/40 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[15px] pr-4">{opcao}</span>
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border flex items-center justify-center transition-colors ${
                      data.modalidade === opcao ? 'border-[#A95B21] bg-[#A95B21]' : 'border-[#E4DFD9] group-hover:border-[#A95B21]/40'
                    }`}>
                      {data.modalidade === opcao && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-2">Você utilizou antibióticos nos últimos 21 dias?</h2>
              <p className="text-[#2B1B0A]/70 text-sm mb-8">Isso ajuda a garantir que sua avaliação tenha resultado confiável.</p>

              <div className="space-y-3">
                {([ 'Não', 'Sim', 'Não tenho certeza' ] as AntibioticStatus[]).map((opcao) => (
                  <button
                    key={opcao}
                    onClick={() => {
                      handleChange('antibioticos', opcao);
                    }}
                    className={`w-full text-left p-4 md:p-5 rounded-xl border transition-all flex items-center justify-between group ${
                      data.antibioticos === opcao 
                        ? 'bg-[#FEFEFE] border-[#A95B21] !shadow-[0_4px_12px_rgba(169,91,33,0.1)] ring-1 ring-[#A95B21]' 
                        : 'bg-[#FEFEFE] border-[#E4DFD9] hover:border-[#A95B21]/40 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[15px] pr-4">{opcao}</span>
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border flex items-center justify-center transition-colors ${
                      data.antibioticos === opcao ? 'border-[#A95B21] bg-[#A95B21]' : 'border-[#E4DFD9] group-hover:border-[#A95B21]/40'
                    }`}>
                      {data.antibioticos === opcao && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>

              {(data.antibioticos === 'Sim' || data.antibioticos === 'Não tenho certeza') && (
                <div className="mt-6 p-4 bg-[#A95B21]/10 rounded-xl border border-[#A95B21]/20 animate-in fade-in duration-300">
                  <p className="text-[14px] text-[#A95B21] leading-relaxed">
                    O uso recente pode interferir nos resultados. A equipe poderá orientar a melhor data para a consulta.
                  </p>
                </div>
              )}

              <div className="mt-10">
                <button 
                  onClick={nextStep}
                  disabled={!data.antibioticos}
                  className="w-full bg-[#222D19] hover:bg-[#222D19]/90 disabled:bg-[#E4DFD9] disabled:text-[#2B1B0A]/40 transition-colors text-white py-4 rounded-xl font-medium text-[15px]"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-2">Qual período costuma ser melhor para você?</h2>
              <p className="text-[#2B1B0A]/70 text-sm mb-8">Isso ajuda a equipe a te oferecer o melhor horário disponível.</p>

              <div className="space-y-3 mb-8">
                {([ 'Manhã', 'Tarde', 'Posso me adaptar' ] as PeriodOption[]).map((opcao) => (
                  <button
                    key={opcao}
                    onClick={() => {
                      handleChange('periodo', opcao);
                    }}
                    className={`w-full text-left p-4 md:p-5 rounded-xl border transition-all flex items-center justify-between group ${
                      data.periodo === opcao 
                        ? 'bg-[#FEFEFE] border-[#A95B21] !shadow-[0_4px_12px_rgba(169,91,33,0.1)] ring-1 ring-[#A95B21]' 
                        : 'bg-[#FEFEFE] border-[#E4DFD9] hover:border-[#A95B21]/40 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[15px] pr-4">{opcao}</span>
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border flex items-center justify-center transition-colors ${
                      data.periodo === opcao ? 'border-[#A95B21] bg-[#A95B21]' : 'border-[#E4DFD9] group-hover:border-[#A95B21]/40'
                    }`}>
                      {data.periodo === opcao && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 pl-1">Datas, dias da semana ou horários de preferência <span className="text-[#2B1B0A]/40 font-normal">(opcional)</span></label>
                <textarea 
                  value={data.datasOpcional}
                  onChange={e => handleChange('datasOpcional', e.target.value)}
                  className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all min-h-[100px] resize-y"
                  placeholder="Ex: Prefiro segundas à tarde, ou somente após as 16h..."
                ></textarea>
              </div>

              <div className="mt-10">
                <button 
                  onClick={nextStep}
                  disabled={!data.periodo}
                  className="w-full bg-[#222D19] hover:bg-[#222D19]/90 disabled:bg-[#E4DFD9] disabled:text-[#2B1B0A]/40 transition-colors text-white py-4 rounded-xl font-medium text-[15px]"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-3">Só mais um passo. Como podemos te chamar?</h2>
              <p className="text-[#2B1B0A]/70 text-sm mb-8">Esses dados ajudam a equipe da clínica a te chamar pelo nome e organizar o atendimento.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 pl-1">Nome completo</label>
                  <input
                    type="text"
                    value={data.nome}
                    onChange={e => handleChange('nome', e.target.value)}
                    className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 pl-1">Melhor e-mail <span className="text-[#2B1B0A]/40 font-normal">(opcional)</span></label>
                  <input
                    type="email"
                    value={data.email}
                    onChange={e => handleChange('email', e.target.value)}
                    className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
                    placeholder="voce@exemplo.com.br"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1.5 pl-1">Cidade <span className="text-[#2B1B0A]/40 font-normal">(opcional)</span></label>
                    <input
                      type="text"
                      value={data.cidade}
                      onChange={e => handleChange('cidade', e.target.value)}
                      className="w-full bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
                      placeholder="Sua cidade"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium mb-1.5 pl-1">Estado</label>
                    <div className="relative">
                      <select
                        value={data.estado}
                        onChange={e => handleChange('estado', e.target.value)}
                        className="w-full appearance-none bg-[#FEFEFE] border border-[#E4DFD9] rounded-xl px-4 py-3.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#A95B21]/40 focus:border-[#A95B21] transition-all"
                      >
                        <option value="">UF</option>
                        {UF_LIST.map(uf => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#2B1B0A]/50" size={18} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-10">
                <p className="text-[12px] md:text-[13px] text-[#2B1B0A]/60 mb-4 text-center">
                  Ao continuar, você declara estar ciente da nossa <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#222D19] transition-colors">Política de Privacidade</a>.
                </p>
                <button
                  onClick={() => {
                    nextStep();
                  }}
                  disabled={!isStep6Valid}
                  className="w-full bg-[#222D19] hover:bg-[#222D19]/90 disabled:bg-[#E4DFD9] disabled:text-[#2B1B0A]/40 transition-colors text-white py-4 rounded-xl font-medium text-[15px]"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium font-serif leading-tight mb-8">Revise suas informações</h2>
              
              <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-5 md:p-6 space-y-5 mb-8">
                
                <div>
                  <div className="text-[12px] text-[#2B1B0A]/50 uppercase tracking-wider font-medium mb-1">Identificação</div>
                  <div className="text-[15px] font-medium">{data.nome}</div>
                  <div className="text-[14px] text-[#2B1B0A]/70">{data.whatsapp}{data.email && ` • ${data.email}`}</div>
                  {(data.cidade || data.estado) && (
                    <div className="text-[14px] text-[#2B1B0A]/70">{[data.cidade, data.estado].filter(Boolean).join(' / ')}</div>
                  )}
                </div>

                <div className="h-px bg-[#E4DFD9] w-full"></div>

                <div>
                  <div className="text-[12px] text-[#2B1B0A]/50 uppercase tracking-wider font-medium mb-1">Situação informada</div>
                  <div className="text-[14px] text-[#2B1B0A]">{data.comportamentoHalito}</div>
                </div>

                <div>
                  <div className="text-[12px] text-[#2B1B0A]/50 uppercase tracking-wider font-medium mb-1">Opção selecionada</div>
                  <div className="text-[14px] text-[#2B1B0A]">{data.modalidade}</div>
                </div>

                <div className="h-px bg-[#E4DFD9] w-full"></div>

                <div>
                  <div className="text-[12px] text-[#2B1B0A]/50 uppercase tracking-wider font-medium mb-1">Uso de antibióticos (21 dias)</div>
                  <div className="text-[14px] text-[#2B1B0A]">{data.antibioticos}</div>
                </div>

                <div>
                  <div className="text-[12px] text-[#2B1B0A]/50 uppercase tracking-wider font-medium mb-1">Disponibilidade</div>
                  <div className="text-[14px] text-[#2B1B0A]">{data.periodo}</div>
                  {data.datasOpcional && (
                    <div className="text-[14px] text-[#2B1B0A]/70 mt-1 italic">"{data.datasOpcional}"</div>
                  )}
                </div>

              </div>

              <div className="text-center mb-6">
                <p className="text-[13px] text-[#2B1B0A]/70 mb-2">
                  Suas respostas serão enviadas para a equipe, para que o atendimento continue com mais contexto e sem precisar começar do zero.
                </p>
                <p className="text-[13px] text-[#2B1B0A]/70">
                  Ao continuar, o WhatsApp será aberto com suas respostas organizadas para facilitar o atendimento.
                </p>
              </div>

              <button 
                onClick={handleWhatsApp}
                className="w-full bg-[#128C7E] hover:bg-[#128C7E]/90 transition-colors text-white py-4 rounded-xl font-medium text-[15px] flex justify-center items-center gap-2"
              >
                Continuar pelo WhatsApp
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
