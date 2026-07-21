export type StatusComercial =
  | 'novo'
  | 'contatado'
  | 'aguardando_resposta'
  | 'em_atendimento'
  | 'consulta_marcada'
  | 'consulta_realizada'
  | 'tratamento_fechado'
  | 'nao_fechou'
  | 'lead_invalido';

export const STATUS_ORDER: StatusComercial[] = [
  'novo',
  'contatado',
  'aguardando_resposta',
  'em_atendimento',
  'consulta_marcada',
  'consulta_realizada',
  'tratamento_fechado',
  'nao_fechou',
  'lead_invalido',
];

export const STATUS_LABEL: Record<StatusComercial, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  aguardando_resposta: 'Aguardando resposta',
  em_atendimento: 'Em atendimento',
  consulta_marcada: 'Consulta marcada',
  consulta_realizada: 'Consulta realizada',
  tratamento_fechado: 'Tratamento fechado',
  nao_fechou: 'Não fechou',
  lead_invalido: 'Lead inválido',
};

// Cor de fundo / texto por status (tokens da paleta da LP)
export const STATUS_STYLE: Record<StatusComercial, string> = {
  novo: 'bg-[#E4DFD9] text-[#2B1B0A]',
  contatado: 'bg-[#757D50]/20 text-[#565E48]',
  aguardando_resposta: 'bg-[#C98A42]/20 text-[#8a5c1e]',
  em_atendimento: 'bg-[#A95B21]/15 text-[#A95B21]',
  consulta_marcada: 'bg-[#565E48]/20 text-[#565E48]',
  consulta_realizada: 'bg-[#222D19]/15 text-[#222D19]',
  tratamento_fechado: 'bg-[#222D19] text-white',
  nao_fechou: 'bg-[#8B2312]/15 text-[#8B2312]',
  lead_invalido: 'bg-[#2B1B0A]/10 text-[#2B1B0A]/60',
};

// ── Kanban ────────────────────────────────────────────────────────────────
// 6 colunas nomeadas (alvo de drop) + "Outros" (bucket de exibição, NÃO é alvo
// de drop). Os 9 status do banco continuam intactos; "Outros" só agrupa 3 deles
// na exibição — a definição desses 3 continua sendo feita pelo modal de detalhe.
export interface KanbanColumn {
  id: string; // id do droppable
  label: string;
  status: StatusComercial | null; // null = "Outros" (não recebe drop)
  members: StatusComercial[]; // status agrupados nesta coluna
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'novo', label: 'Novo', status: 'novo', members: ['novo'] },
  { id: 'contatado', label: 'Contatado', status: 'contatado', members: ['contatado'] },
  { id: 'consulta_marcada', label: 'Consulta agendada', status: 'consulta_marcada', members: ['consulta_marcada'] },
  { id: 'consulta_realizada', label: 'Consulta realizada', status: 'consulta_realizada', members: ['consulta_realizada'] },
  { id: 'tratamento_fechado', label: 'Fechou', status: 'tratamento_fechado', members: ['tratamento_fechado'] },
  { id: 'nao_fechou', label: 'Não fechou', status: 'nao_fechou', members: ['nao_fechou'] },
  { id: 'outros', label: 'Outros', status: null, members: ['aguardando_resposta', 'em_atendimento', 'lead_invalido'] },
];

// Coluna a que um status pertence (fallback: "Outros").
export function columnForStatus(status: StatusComercial): KanbanColumn {
  return KANBAN_COLUMNS.find((c) => c.members.includes(status)) ?? KANBAN_COLUMNS[KANBAN_COLUMNS.length - 1];
}

// Estilo do badge de origem (tokens da paleta da LP).
export const ORIGEM_STYLE: Record<string, string> = {
  'Meta Ads': 'bg-[#A95B21]/15 text-[#A95B21]',
  'Google Ads': 'bg-[#565E48]/20 text-[#565E48]',
  Direto: 'bg-[#E4DFD9] text-[#2B1B0A]/70',
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
