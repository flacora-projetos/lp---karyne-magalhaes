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
  // De onde a pessoa chegou ao site (Google Ads, Google, Direto...), para aparecer no cartão do Fluxo.
  return str(lead.origem) ? `Formulário do site · ${str(lead.origem)}` : 'Formulário do site';
}

/** Atribuição do clique, nos nomes que a porta de contatos do Fluxo aceita (vazios saem). */
function atribuicao(lead: Lead): Record<string, string> | undefined {
  const a: Record<string, string> = {
    utm_source: str(lead.utm_source), utm_medium: str(lead.utm_medium), utm_campaign: str(lead.utm_campaign),
    utm_content: str(lead.utm_content), utm_term: str(lead.utm_term),
    gclid: str(lead.gclid) || str(lead.google_match_gclid), fbclid: str(lead.fbclid),
    ga_client_id: str(lead.ga_client_id), ga_session_id: str(lead.ga_session_id),
    primeiro_canal: str(lead.first_channel_derived), primeira_origem: str(lead.first_utm_source),
    primeira_campanha: str(lead.first_utm_campaign), primeiro_gclid: str(lead.first_gclid),
    entrada_url: str(lead.first_entry_url), referrer: str(lead.referrer),
  };
  for (const k of Object.keys(a)) if (!a[k]) delete a[k];
  return Object.keys(a).length ? a : undefined;
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
    email: str(lead.email).includes('@') ? str(lead.email) : undefined,  // e-mail mal digitado não pode barrar o contato
    observacoes: linhas.join('\n'),
    chegou_em: Number.isNaN(Date.parse(str(lead.criado_em))) ? undefined : new Date(str(lead.criado_em)).toISOString(),
    origem: {
      tipo: 'site',
      titulo: t,
      url: /^https?:\/\//i.test(url) ? url.slice(0, 300) : undefined,
      canal: str(lead.channel_derived) || undefined,
      atribuicao: atribuicao(lead),
    },
  };
}

/**
 * Corpo do clique no botão de WhatsApp da página do Google, que não pede
 * telefone: o código vai na mensagem pronta e o Fluxo liga a conversa ao
 * clique (com o gclid) quando ela chegar. null quando o código não serve.
 */
export function fluxoClique(lead: Lead, codigo: unknown) {
  const c = str(codigo).toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(c)) return null;
  const url = str(lead.page_url);
  return {
    clique_whatsapp: {
      codigo: c,
      clicado_em: Number.isNaN(Date.parse(str(lead.criado_em))) ? undefined : new Date(str(lead.criado_em)).toISOString(),
      titulo: str(lead.origem) ? `Botão do WhatsApp do site · ${str(lead.origem)}` : 'Botão do WhatsApp do site',
      url: /^https?:\/\//i.test(url) ? url.slice(0, 300) : undefined,
      canal: str(lead.channel_derived) || undefined,
      atribuicao: atribuicao(lead),
    },
  };
}

/** Avisa o Fluxo do clique no botão de WhatsApp com código. */
export async function enviarCliqueFluxo(lead: Lead, codigo: unknown, fetchImpl: typeof fetch = fetch): Promise<void> {
  const corpo = fluxoClique(lead, codigo);
  if (corpo) await chamar('contato-externo', corpo, fetchImpl);
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
