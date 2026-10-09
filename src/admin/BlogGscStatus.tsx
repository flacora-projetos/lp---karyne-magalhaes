import React, { useEffect, useState } from 'react';
import { RefreshCw, SearchCheck } from 'lucide-react';
import { fetchBlogGscReport } from './api';

type GscUrlRow = {
  publication_id: string;
  article_title?: string | null;
  article_slug?: string | null;
  article_status?: string | null;
  url: string;
  publication_confirmed_at?: string | null;
  last_inspected_at?: string | null;
  next_inspection_at?: string | null;
  knowledge_state?: string | null;
  action_state?: string | null;
  action_reason?: string | null;
};

type Report = {
  state: any;
  urls: GscUrlRow[];
  runs: any[];
};

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    indexed: 'Indexada',
    excluded: 'Não indexada / excluída',
    unknown_to_google: 'Ainda desconhecida pelo Google',
    inconclusive: 'Inconclusivo',
    waiting: 'Aguardar',
    stable: 'Estável',
    action_required: 'Ação necessária',
    baseline_required: 'Primeiro envio pendente',
    confirmed: 'Envio confirmado pelo Google',
    unchanged: 'Sitemap sem mudanças',
    uncertain: 'Resultado incerto',
    failed_transient: 'Falha temporária no envio',
    blocked: 'Envio bloqueado',
    running: 'Em andamento',
    succeeded: 'Concluída',
    failed: 'Falhou',
    skipped: 'Não executada',
  };
  return value ? labels[value] || value.replaceAll('_', ' ') : 'Sem inspeção';
}

function actionReasonLabel(value?: string | null) {
  if (!value) return 'Revisar a URL';
  if (value === 'inspection_failed') return 'Falha ao inspecionar a URL; uma nova tentativa será feita.';
  if (value === 'gsc_response_inconclusive') return 'O Google não trouxe informações conclusivas; aguardar nova inspeção.';
  if (value === 'not_indexed_after_14_days') return 'URL não indexada após 14 dias da publicação.';
  if (value.startsWith('gsc_blocker:')) {
    const blocker = value.slice('gsc_blocker:'.length);
    const blockers: Record<string, string> = {
      DISALLOWED: 'o robots.txt bloqueia o rastreamento',
      BLOCKED_BY_META_TAG: 'a página indica noindex em uma meta tag',
      BLOCKED_BY_HTTP_HEADER: 'a resposta indica noindex em um cabeçalho',
      NOT_FOUND: 'a página não foi encontrada',
      ACCESS_DENIED: 'o acesso à página foi negado',
      ACCESS_FORBIDDEN: 'o acesso à página foi proibido',
      SERVER_ERROR: 'o servidor apresentou um erro',
      REDIRECT_ERROR: 'houve um erro no redirecionamento',
      BLOCKED_4XX: 'a página respondeu com erro de acesso',
      SOFT_404: 'a página parece estar vazia ou indisponível',
      INVALID_URL: 'o Google considerou a URL inválida',
      BLOCKED_ROBOTS_TXT: 'o robots.txt bloqueia o rastreamento',
    };
    return `Bloqueio encontrado: ${blockers[blocker] || blocker.replaceAll('_', ' ').toLowerCase()}.`;
  }
  return value.replaceAll('_', ' ');
}

function nextAction(row: GscUrlRow) {
  if (row.action_state === 'action_required' || row.action_reason) return actionReasonLabel(row.action_reason);
  if (row.action_state === 'stable') return `Revisar novamente em ${dateTime(row.next_inspection_at)}`;
  if (row.action_state === 'inconclusive') return `Repetir inspeção em ${dateTime(row.next_inspection_at)}`;
  return `Aguardar e consultar em ${dateTime(row.next_inspection_at)}`;
}

export const BlogGscStatus: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setReport(await fetchBlogGscReport()); }
    catch { setError('Status Blog/GSC indisponível.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const actions = report?.urls?.filter((row) => row.action_state === 'action_required') || [];
  const lastRun = report?.runs?.[0];

  return (
    <div className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[13px] font-semibold text-[#565E48] inline-flex items-center gap-2">
          <SearchCheck size={15} /> Blog / Google Search Console
        </div>
        <button onClick={() => void load()} disabled={loading} className="p-2 rounded-xl border border-[#E4DFD9] hover:bg-[#F6F0E9] disabled:opacity-50" title="Atualizar status">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? <div className="text-sm text-[#8B2312]">{error}</div> : loading && !report ? (
        <div className="text-sm text-[#2B1B0A]/45">Carregando status…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Sitemap</div><div className="mt-1 font-medium">{statusLabel(report?.state?.last_submit_status || 'baseline_required')}</div></div>
            <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Último envio confirmado</div><div className="mt-1 font-medium">{dateTime(report?.state?.last_google_submitted_at || report?.state?.last_submit_confirmed_at)}</div></div>
            <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">URLs / pendências</div><div className="mt-1 font-medium">{report?.urls?.length || 0} / {actions.length}</div></div>
            <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Última rotina</div><div className="mt-1 font-medium">{lastRun ? `${lastRun.status} · ${dateTime(lastRun.updated_at)}` : 'ainda não executada'}</div></div>
          </div>

          {(report?.urls?.length || 0) > 0 && (
            <div className="mt-4 overflow-x-auto border border-[#E4DFD9] rounded-xl">
              <table className="w-full min-w-[820px] text-[12px]">
                <thead>
                  <tr className="bg-[#F6F0E9] text-left uppercase tracking-wide text-[#2B1B0A]/45">
                    <th className="px-3 py-2 font-medium">Artigo</th>
                    <th className="px-3 py-2 font-medium">Publicação confirmada</th>
                    <th className="px-3 py-2 font-medium">Última inspeção</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                    <th className="px-3 py-2 font-medium">Próxima ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DFD9]">
                  {report?.urls?.map((row) => (
                    <tr key={row.publication_id} className={row.action_state === 'action_required' ? 'bg-[#8B2312]/5' : ''}>
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <div className="font-medium text-[#222D19] truncate" title={row.article_title || row.article_slug || row.url}>{row.article_title || row.article_slug || row.url}</div>
                        <div className="text-[#2B1B0A]/40 truncate" title={row.url}>{row.article_slug || row.url}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[#2B1B0A]/70">{dateTime(row.publication_confirmed_at)}</td>
                      <td className="px-3 py-2.5 text-[#2B1B0A]/70">{dateTime(row.last_inspected_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className={row.action_state === 'action_required' ? 'font-medium text-[#8B2312]' : 'text-[#2B1B0A]/75'}>{statusLabel(row.knowledge_state)}</div>
                        <div className="text-[#2B1B0A]/40">{statusLabel(row.action_state)}</div>
                      </td>
                      <td className={row.action_state === 'action_required' ? 'px-3 py-2.5 text-[#8B2312] font-medium' : 'px-3 py-2.5 text-[#2B1B0A]/70'}>{nextAction(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-[#2B1B0A]/40 mt-3">Envio do sitemap, conhecimento da URL, rastreamento e indexação são estados diferentes. O Google decide a indexação.</p>
    </div>
  );
};
