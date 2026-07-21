import type { Lead, StatusComercial } from './types';

// Estágios do funil comercial que indicam que a consulta foi MARCADA.
// (quem realizou ou fechou tratamento necessariamente passou por marcada)
const REACHED_MARCADA: StatusComercial[] = [
  'consulta_marcada',
  'consulta_realizada',
  'tratamento_fechado',
];
const REACHED_REALIZADA: StatusComercial[] = ['consulta_realizada', 'tratamento_fechado'];
const FECHADO: StatusComercial[] = ['tratamento_fechado'];

export interface BreakdownRow {
  chave: string;
  leads: number;
  consultasMarcadas: number;
  consultasRealizadas: number;
  fechados: number;
  faturamento: number;
}

export interface Metrics {
  total: number;
  porPlataforma: Record<string, number>;
  consultasMarcadas: number;
  consultasRealizadas: number;
  tratamentosFechados: number;
  taxaConversao: { num: number; den: number };
  taxaComparecimento: { num: number; den: number };
  taxaFechamento: { num: number; den: number };
  faturamento: number;
  ticketMedio: number;
  semAcompanhamento: number;
  motivosPerda: Record<string, number>;
  porPlataformaDet: BreakdownRow[];
  porCriativo: BreakdownRow[];
  porTermo: BreakdownRow[];
}

function emptyRow(chave: string): BreakdownRow {
  return { chave, leads: 0, consultasMarcadas: 0, consultasRealizadas: 0, fechados: 0, faturamento: 0 };
}

function breakdown(leads: Lead[], keyFn: (l: Lead) => string): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const l of leads) {
    const chave = keyFn(l) || '(sem informação)';
    if (!map.has(chave)) map.set(chave, emptyRow(chave));
    const row = map.get(chave)!;
    row.leads += 1;
    if (REACHED_MARCADA.includes(l.status_comercial)) row.consultasMarcadas += 1;
    if (REACHED_REALIZADA.includes(l.status_comercial)) row.consultasRealizadas += 1;
    if (FECHADO.includes(l.status_comercial)) {
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

  let consultasMarcadas = 0;
  let consultasRealizadas = 0;
  let tratamentosFechados = 0;
  let faturamento = 0;
  let semAcompanhamento = 0;

  for (const l of leads) {
    const plat = l.origem || '(sem origem)';
    porPlataforma[plat] = (porPlataforma[plat] || 0) + 1;

    if (REACHED_MARCADA.includes(l.status_comercial)) consultasMarcadas += 1;
    if (REACHED_REALIZADA.includes(l.status_comercial)) consultasRealizadas += 1;
    if (FECHADO.includes(l.status_comercial)) {
      tratamentosFechados += 1;
      faturamento += l.valor_fechado ?? 0;
    }
    if (l.status_comercial === 'novo') semAcompanhamento += 1;
    if (l.status_comercial === 'nao_fechou' && l.motivo_perda) {
      const m = l.motivo_perda.trim();
      motivosPerda[m] = (motivosPerda[m] || 0) + 1;
    }
  }

  return {
    total,
    porPlataforma,
    consultasMarcadas,
    consultasRealizadas,
    tratamentosFechados,
    taxaConversao: { num: consultasMarcadas, den: total },
    taxaComparecimento: { num: consultasRealizadas, den: consultasMarcadas },
    taxaFechamento: { num: tratamentosFechados, den: consultasRealizadas },
    faturamento,
    ticketMedio: tratamentosFechados ? faturamento / tratamentosFechados : 0,
    semAcompanhamento,
    motivosPerda,
    porPlataformaDet: breakdown(leads, (l) => l.origem || ''),
    porCriativo: breakdown(leads, (l) => l.utm_content || ''),
    porTermo: breakdown(leads, (l) => l.utm_term || ''),
  };
}
