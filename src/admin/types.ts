export type StatusComercial =
  | 'contato_realizado'
  | 'negociando_consulta'
  | 'desistiu_consulta'
  | 'consulta_agendada'
  | 'consulta_realizada'
  | 'estorno_cancelada'
  | 'outros_invalido';

// Ordem do funil — usada no seletor do detalhe e no filtro de status.
export const STATUS_ORDER: StatusComercial[] = [
  'contato_realizado',
  'negociando_consulta',
  'desistiu_consulta',
  'consulta_agendada',
  'consulta_realizada',
  'estorno_cancelada',
  'outros_invalido',
];

export const STATUS_LABEL: Record<StatusComercial, string> = {
  contato_realizado: 'Contato Realizado',
  negociando_consulta: 'Negociando Consulta',
  desistiu_consulta: 'Desistiu da Consulta',
  consulta_agendada: 'Consulta Agendada',
  consulta_realizada: 'Consulta Realizada',
  estorno_cancelada: 'Estorno / Consulta Cancelada',
  outros_invalido: 'Outros / Leads Inválidos',
};

// Cor de fundo / texto por status (tokens da paleta da LP)
export const STATUS_STYLE: Record<StatusComercial, string> = {
  contato_realizado: 'bg-[#C98A42]/20 text-[#8a5c1e]',
  negociando_consulta: 'bg-[#A95B21]/15 text-[#A95B21]',
  desistiu_consulta: 'bg-[#8B2312]/12 text-[#8B2312]',
  consulta_agendada: 'bg-[#565E48]/20 text-[#565E48]',
  consulta_realizada: 'bg-[#222D19] text-white',
  estorno_cancelada: 'bg-[#8B2312]/20 text-[#8B2312]',
  outros_invalido: 'bg-[#2B1B0A]/10 text-[#2B1B0A]/60',
};

// ── Kanban ────────────────────────────────────────────────────────────────
// 7 colunas, TODAS alvo de drop (arrasta-se para qualquer uma, inclusive
// "Outros / Leads Inválidos"). Cada coluna corresponde a exatamente um status
// do banco (mapa 1:1). O status_comercial é a fonte da verdade — a coluna é só
// a forma de exibi-lo.
export interface KanbanColumn {
  id: string; // id do droppable
  label: string;
  status: StatusComercial | null; // null = coluna só de exibição (não recebe drop)
  members: StatusComercial[]; // status agrupados nesta coluna
}

// Cor de acento (dot do cabeçalho + faixa do card) por coluna.
export const KANBAN_COLUMNS: (KanbanColumn & { accent: string })[] = [
  { id: 'contato_realizado', label: 'Contato Realizado', status: 'contato_realizado', members: ['contato_realizado'], accent: '#C98A42' },
  { id: 'negociando_consulta', label: 'Negociando Consulta', status: 'negociando_consulta', members: ['negociando_consulta'], accent: '#A95B21' },
  { id: 'desistiu_consulta', label: 'Desistiu da Consulta', status: 'desistiu_consulta', members: ['desistiu_consulta'], accent: '#B0553C' },
  { id: 'consulta_agendada', label: 'Consulta Agendada', status: 'consulta_agendada', members: ['consulta_agendada'], accent: '#565E48' },
  { id: 'consulta_realizada', label: 'Consulta Realizada', status: 'consulta_realizada', members: ['consulta_realizada'], accent: '#222D19' },
  { id: 'estorno_cancelada', label: 'Estorno / Consulta Cancelada', status: 'estorno_cancelada', members: ['estorno_cancelada'], accent: '#8B2312' },
  { id: 'outros_invalido', label: 'Outros / Leads Inválidos', status: 'outros_invalido', members: ['outros_invalido'], accent: '#8A94A6' },
];

// Coluna a que um status pertence (fallback: "Outros / Leads Inválidos").
export function columnForStatus(status: StatusComercial): KanbanColumn & { accent: string } {
  return KANBAN_COLUMNS.find((c) => c.members.includes(status)) ?? KANBAN_COLUMNS[KANBAN_COLUMNS.length - 1];
}

// Estilo do badge de origem (tokens da paleta da LP).
export const ORIGEM_STYLE: Record<string, string> = {
  'Meta Ads': 'bg-[#A95B21]/15 text-[#A95B21]',
  'Google Ads': 'bg-[#565E48]/20 text-[#565E48]',
  Direto: 'bg-[#E4DFD9] text-[#2B1B0A]/70',
};

// Cor sólida do avatar (inicial) por origem.
export const ORIGEM_AVATAR: Record<string, string> = {
  'Meta Ads': '#A95B21',
  'Google Ads': '#565E48',
  Direto: '#8A94A6',
};

export interface Lead {
  id: string;
  lead_id: string;
  criado_em: string;
  atualizado_em: string;
  etapa_funil: string | null;
  nome: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  comportamento_halito: string | null;
  uso_antibiotico: string | null;
  opcao_interesse: string | null;
  periodo_preferido: string | null;
  datas_preferidas: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  origem: string | null;
  page_url: string | null;
  referrer: string | null;
  user_agent: string | null;
  status_comercial: StatusComercial;
  data_consulta: string | null;
  valor_fechado: number | null;
  motivo_perda: string | null;
  observacoes: string | null;
  responsavel: string | null;
}

// Campos comerciais editáveis no painel
export interface LeadCommercialUpdate {
  status_comercial?: StatusComercial;
  data_consulta?: string | null;
  valor_fechado?: number | null;
  motivo_perda?: string | null;
  observacoes?: string | null;
  responsavel?: string | null;
}
