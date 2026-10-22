/**
 * Espelha os leads do painel do site no Dácora Fluxo (CRM da Dácora), sem
 * mudar nada no painel do site.
 *
 * - contato: quem deixou o WhatsApp (filtro, triagem, cadastro manual) vira
 *   contato no Fluxo. ref = lead_id; reenviar a mesma ref só atualiza as
 *   respostas, nunca duplica.
 * - etapa: quando a Karyne muda o status no painel do site, o Fluxo anda junto
 *   (as etapas do Fluxo têm as mesmas chaves do status_comercial).
 *
 * Dados clínicos (comportamento do hálito, uso de antibiótico) ficam só no site.
 * Sem FLUXO_URL/FLUXO_CHAVE não faz nada. Nunca lança: falha no Fluxo não pode
 * atrapalhar o formulário nem o painel.
 */
import { phoneKey } from './whatsappLeads.js';

type Lead = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function dataBrasilia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function titulo(lead: Lead): string {
  if (str(lead.utm_medium) === 'manual' || str(lead.etapa_funil).startsWith('Cadastro manual')) return 'Cadastro manual no painel do site';
  if (str(lead.utm_source) === 'whatsapp' && str(lead.utm_medium) === 'triagem') return 'Triagem do WhatsApp (site)';
  return 'Formulário do site';
}

/** Corpo para a porta de contatos do Fluxo; null quando não há WhatsApp válido. */
export function fluxoContato(lead: Lead) {
  const telefone = str(lead.whatsapp);
  const ref = str(lead.lead_id);
  if (!phoneKey(telefone) || telefone.replace(/\D/g, '').length < 10 || !ref) return null;

  const t = titulo(lead);
  const quando = dataBrasilia(str(lead.criado_em));
  const local = [str(lead.cidade), str(lead.estado)].filter(Boolean).join('/');
  const linhas = [
    quando ? `${t} — ${quando}` : t,
    str(lead.origem) && `Origem: ${[str(lead.origem), str(lead.channel_derived)].filter(Boolean).join(' · ')}`,
    str(lead.utm_campaign) && `Campanha: ${str(lead.utm_campaign)}`,
    str(lead.utm_content) && `Anúncio: ${str(lead.utm_content)}`,
    str(lead.opcao_interesse) && `Interesse: ${str(lead.opcao_interesse)}`,
    str(lead.periodo_preferido) && `Período preferido: ${str(lead.periodo_preferido)}`,
    str(lead.datas_preferidas) && `Datas preferidas: ${str(lead.datas_preferidas)}`,
    local && `Cidade: ${local}`,
    str(lead.etapa_funil) && `Etapa no filtro: ${str(lead.etapa_funil)}`,
  ].filter(Boolean);

  const url = str(lead.page_url);
  return {
    telefone,
    ref,
    nome: str(lead.nome) || undefined,
    email: str(lead.email) || undefined,
    observacoes: linhas.join('\n'),
    origem: { tipo: 'site', titulo: t, url: /^https?:\/\//i.test(url) ? url.slice(0, 300) : undefined },
  };
}

/** Corpo para a porta de resultados do Fluxo (mudança de status no painel do site). */
export function fluxoEtapa(lead: Lead, status: string, agora = new Date()) {
  const telefone = str(lead.whatsapp);
  const ref = str(lead.lead_id);
  if (!status || (!phoneKey(telefone) && !ref)) return null;
  const valor = Number(lead.valor_fechado);
  return {
    etapa: status,
    telefone: telefone || undefined,
    ref: ref || undefined,
    valor: status === 'consulta_realizada' && Number.isFinite(valor) && valor > 0 ? valor : undefined,
    ocorrido_em: agora.toISOString(),
  };
}

async function chamar(porta: 'contato-externo' | 'resultado-externo', corpo: object, fetchImpl: typeof fetch): Promise<boolean> {
  const base = process.env.FLUXO_URL?.replace(/\/+$/, '');
  const chave = process.env.FLUXO_CHAVE;
  if (!base || !chave) return false;
  try {
    const r = await fetchImpl(`${base}/${porta}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) console.error(`[crmFluxo] ${porta} respondeu ${r.status}`);
    return r.ok;
  } catch {
    console.error(`[crmFluxo] ${porta} sem resposta`);
    return false;
  }
}

/** Manda o lead como contato ao Fluxo (se tiver WhatsApp). */
export async function enviarContatoFluxo(lead: Lead, fetchImpl: typeof fetch = fetch): Promise<void> {
  const corpo = fluxoContato(lead);
  if (corpo) await chamar('contato-externo', corpo, fetchImpl);
}

/** Garante o contato no Fluxo e avisa a nova etapa. */
export async function enviarEtapaFluxo(lead: Lead, status: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const contato = fluxoContato(lead);
  if (contato) await chamar('contato-externo', contato, fetchImpl);
  const corpo = fluxoEtapa(lead, status);
  if (corpo) await chamar('resultado-externo', corpo, fetchImpl);
}
