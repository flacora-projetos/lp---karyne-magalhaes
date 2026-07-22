import type { Lead, StatusComercial } from './types';

// Estágios que indicam consulta AGENDADA (inclui quem já realizou —
// necessariamente passou por agendada).
const REACHED_AGENDADA: StatusComercial[] = ['consulta_agendada', 'consulta_realizada'];
const REACHED_REALIZADA: StatusComercial[] = ['consulta_realizada'];
// Estágios de perda — alimentam os "motivos de perda".
const PERDA: StatusComercial[] = ['desistiu_consulta', 'estorno_cancelada', 'outros_invalido'];

export interface BreakdownRow {
  chave: string;
  leads: number;
  consultasAgendadas: number;
  consultasRealizadas: number;
  fechados: number;
  faturamento: number;
}

export interface Metrics {
  total: number;
  porPlataforma: Record<string, number>;
  // Contagens explícitas por plataforma (cards do dashboard).
  metaAds: number;
  googleAds: number;
  diretos: number;
  consultasAgendadas: number;
  consultasRealizadas: number;
  desistencias: number;
  estornos: number;
  // "Fechados" = consultas com valor registrado (alimenta faturamento/ticket).
  fechados: number;
  faturamento: number;
  ticketMedio: number;
  taxaAgendamento: { num: number; den: number }; // agendadas / leads
  taxaComparecimento: { num: number; den: number }; // realizadas / agendadas
  emContato: number; // ainda parados em "Contato Realizado"
  motivosPerda: Record<string, number>;
  porPlataformaDet: BreakdownRow[];
  porCriativo: BreakdownRow[];
  porTermo: BreakdownRow[];
}

function emptyRow(chave: string): BreakdownRow {
  return { chave, leads: 0, consultasAgendadas: 0, consultasRealizadas: 0, fechados: 0, faturamento: 0 };
}

function breakdown(leads: Lead[], keyFn: (l: Lead) => string): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const l of leads) {
    const chave = keyFn(l) || '(sem informação)';
    if (!map.has(chave)) map.set(chave, emptyRow(chave));
    const row = map.get(chave)!;
    row.leads += 1;
    if (REACHED_AGENDADA.includes(l.status_comercial)) row.consultasAgendadas += 1;
    if (REACHED_REALIZADA.includes(l.status_comercial)) row.consultasRealizadas += 1;
    if (l.valor_fechado != null) {
      row.fechados += 1;
      row.faturamento += l.valor_fechado ?? 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
}

export function computeMetrics(leads: Lead[]): Metrics {
  const total = leads.length;
  const porPlataforma: Record<string, number> = {};
  const motivosPerda: Record<string, number> = {};

  let consultasAgendadas = 0;
  let consultasRealizadas = 0;
  let desistencias = 0;
  let estornos = 0;
  let fechados = 0;
  let faturamento = 0;
  let emContato = 0;

  for (const l of leads) {
    const plat = l.origem || '(sem origem)';
    porPlataforma[plat] = (porPlataforma[plat] || 0) + 1;

    if (REACHED_AGENDADA.includes(l.status_comercial)) consultasAgendadas += 1;
    if (REACHED_REALIZADA.includes(l.status_comercial)) consultasRealizadas += 1;
    if (l.status_comercial === 'desistiu_consulta') desistencias += 1;
    if (l.status_comercial === 'estorno_cancelada') estornos += 1;
    if (l.status_comercial === 'contato_realizado') emContato += 1;
    if (l.valor_fechado != null) {
      fechados += 1;
      faturamento += l.valor_fechado ?? 0;
    }
    if (PERDA.includes(l.status_comercial) && l.motivo_perda) {
      const m = l.motivo_perda.trim();
      motivosPerda[m] = (motivosPerda[m] || 0) + 1;
    }
  }

  return {
    total,
    porPlataforma,
    metaAds: porPlataforma['Meta Ads'] || 0,
    googleAds: porPlataforma['Google Ads'] || 0,
    diretos: porPlataforma['Direto'] || 0,
    consultasAgendadas,
    consultasRealizadas,
    desistencias,
    estornos,
    fechados,
    faturamento,
    ticketMedio: fechados ? faturamento / fechados : 0,
    taxaAgendamento: { num: consultasAgendadas, den: total },
    taxaComparecimento: { num: consultasRealizadas, den: consultasAgendadas },
    emContato,
    motivosPerda,
    porPlataformaDet: breakdown(leads, (l) => l.origem || ''),
    porCriativo: breakdown(leads, (l) => l.utm_content || ''),
    porTermo: breakdown(leads, (l) => l.utm_term || ''),
  };
}
