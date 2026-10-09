import React, { useEffect, useState } from 'react';
import { PauseCircle, PlayCircle, RefreshCw, SearchCheck, ShieldCheck } from 'lucide-react';
import { blogGscAction, fetchBlogGscReport } from './api';

type GscUrlRow = {
  publication_id:string; article_title?:string|null; article_slug?:string|null; url:string;
  publication_confirmed_at?:string|null; last_inspected_at?:string|null; next_inspection_at?:string|null;
  knowledge_state?:string|null; action_state?:string|null; action_reason?:string|null;
};

type Report = {
  state:any; urls:GscUrlRow[]; runs:any[]; runsPage?:{page:number;pageSize:number;total:number|null};
  automation?:{operator_paused?:boolean;pause_reason?:string|null;changed_at?:string|null;revision?:number;changed_by_user_id?:string|null};
  infrastructure?:{enabled:boolean;configured_schedule:string;schedule_expression:string};
};

function dateTime(value?:string|null){if(!value)return 'Indisponível';const d=new Date(value);return Number.isNaN(d.getTime())?'Indisponível':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
function label(value?:string|null){const map:Record<string,string>={indexed:'Indexada',excluded:'Não indexada / excluída',unknown_to_google:'Ainda desconhecida pelo Google',inconclusive:'Inconclusivo',waiting:'Aguardar',stable:'Estável',action_required:'Ação necessária',baseline_required:'Primeiro envio pendente',confirmed:'Envio confirmado pelo Google',unchanged:'Sitemap sem mudanças',uncertain:'Resultado incerto',failed_transient:'Falha temporária',blocked:'Bloqueada',running:'Em andamento',succeeded:'Concluída',failed:'Falhou',skipped:'Não executada'};return value?map[value]||value.replaceAll('_',' '):'Indisponível';}
function reason(value?:string|null){if(!value)return 'Nenhuma ação registrada.';if(value==='inspection_failed')return 'Falha ao inspecionar; uma nova tentativa poderá ser feita.';if(value==='gsc_response_inconclusive')return 'O Google ainda não trouxe resposta conclusiva.';if(value==='not_indexed_after_14_days')return 'URL não indexada após 14 dias da publicação.';if(value==='operator_paused')return 'Automação pausada por operador.';if(value.startsWith('gsc_blocker:'))return `Bloqueio técnico: ${value.slice(12).replaceAll('_',' ').toLowerCase()}.`;return value.replaceAll('_',' ');}

export const BlogGscStatus:React.FC=()=>{
  const [report,setReport]=useState<Report|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [page,setPage]=useState(1);const [pauseReason,setPauseReason]=useState('');
  const load=async(targetPage=page)=>{setLoading(true);setError('');try{setReport(await fetchBlogGscReport(targetPage,10));setPage(targetPage);}catch(e){setError(e instanceof Error?e.message:'Status Blog/GSC indisponível.');}finally{setLoading(false);}};
  useEffect(()=>{void load(1);},[]);
  const mutate=async(payload:Record<string,unknown>)=>{setBusy(true);setError('');setNotice('');try{const result=await blogGscAction(payload);if(payload.action==='run-now')setNotice(result?.status==='skipped'?`Verificação não repetida: ${reason(result?.reason)}.`:`Verificação concluída: ${label(result?.status)}.`);else setNotice('Controle atualizado e registrado.');await load(page);}catch(e){setError(e instanceof Error?e.message:'Operação não concluída.');}finally{setBusy(false);}};
  const paused=Boolean(report?.automation?.operator_paused);const total=report?.runsPage?.total;const hasNext=typeof total==='number'?page*10<total:(report?.runs?.length||0)===10;
  return <div className="space-y-4">
    <section className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[13px] font-semibold text-[#565E48] inline-flex items-center gap-2"><SearchCheck size={15}/> Google Search Console</div><p className="text-[12px] text-[#2B1B0A]/55 mt-1">Status conhecido pelo sistema. Ausência de dado não é tratada como zero nem como indexação.</p></div><button onClick={()=>void load(page)} disabled={loading||busy} className="p-2 rounded-xl border border-[#E4DFD9] hover:bg-[#F6F0E9] disabled:opacity-50" title="Atualizar dados, sem executar automação"><RefreshCw size={15} className={loading?'animate-spin':''}/></button></div>
      {error&&<div className="mt-3 text-sm text-[#8B2312] bg-[#8B2312]/8 border border-[#8B2312]/20 rounded-xl p-3">{error}</div>}{notice&&<div className="mt-3 text-sm text-[#365B32] bg-[#365B32]/8 border border-[#365B32]/20 rounded-xl p-3">{notice}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 text-sm">
        <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Infraestrutura</div><div className="mt-1 font-medium">{report?.infrastructure?report.infrastructure.enabled?'Habilitada':'Desabilitada':'Indisponível'}</div></div>
        <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Agenda configurada</div><div className="mt-1 font-medium">{report?.infrastructure?.configured_schedule||'Indisponível'}</div></div>
        <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Pausa operacional</div><div className={`mt-1 font-medium ${paused?'text-[#8B2312]':'text-[#365B32]'}`}>{report?.automation?paused?'Pausada':'Ativa':'Indisponível'}</div></div>
        <div><div className="text-[11px] uppercase text-[#2B1B0A]/45">Última execução observada</div><div className="mt-1 font-medium">{dateTime(report?.runs?.[0]?.updated_at)}</div></div>
      </div>
      {paused&&<div className="mt-3 text-[12px] text-[#8B2312]">Motivo: {report?.automation?.pause_reason||'não informado'} · alteração: {dateTime(report?.automation?.changed_at)}</div>}
      <div className="mt-4 flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex-1"><label className="text-[11px] uppercase text-[#2B1B0A]/45">Motivo ao pausar</label><input value={pauseReason} onChange={e=>setPauseReason(e.target.value)} placeholder="Ex.: revisão de configuração antes da próxima rotina" className="mt-1 w-full rounded-xl border border-[#D8D1C9] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#565E48]/25"/></div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy||!report?.automation||(!paused&&pauseReason.trim().length<3)} onClick={()=>void mutate({action:'set-automation',operationKey:crypto.randomUUID(),expectedRevision:report?.automation?.revision||0,paused:!paused,reason:paused?'':pauseReason})} className="inline-flex items-center gap-2 rounded-xl border border-[#D8D1C9] bg-white px-3 py-2.5 text-sm font-medium disabled:opacity-40">{paused?<><PlayCircle size={16}/>Retomar automação</>:<><PauseCircle size={16}/>Pausar automação</>}</button>
          <button disabled={busy||paused||report?.infrastructure?.enabled!==true} onClick={()=>void mutate({action:'run-now'})} className="inline-flex items-center gap-2 rounded-xl bg-[#222D19] text-white px-3 py-2.5 text-sm font-medium disabled:opacity-40"><ShieldCheck size={16}/>Executar verificação agora</button>
        </div>
      </div>
      <p className="text-[11px] text-[#2B1B0A]/40 mt-3">O botão manual usa a mesma execução diária idempotente do cron. Se a rotina do dia já ocorreu, ela não é repetida. A agenda da hospedagem não é alterada por este painel.</p>
    </section>

    <section className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E4DFD9] text-[13px] font-semibold text-[#565E48]">URLs acompanhadas</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-[12px]"><thead><tr className="bg-[#F6F0E9] text-left uppercase tracking-wide text-[#2B1B0A]/45"><th className="px-3 py-2">Artigo</th><th className="px-3 py-2">Publicação confirmada</th><th className="px-3 py-2">Última inspeção</th><th className="px-3 py-2">Estado conhecido</th><th className="px-3 py-2">Próxima inspeção</th><th className="px-3 py-2">Ação</th></tr></thead><tbody className="divide-y divide-[#E4DFD9]">{(report?.urls||[]).map(row=><tr key={row.publication_id}><td className="px-3 py-2.5"><div className="font-medium">{row.article_title||row.article_slug||row.url}</div><div className="text-[#2B1B0A]/40">{row.article_slug||row.url}</div></td><td className="px-3 py-2.5">{dateTime(row.publication_confirmed_at)}</td><td className="px-3 py-2.5">{dateTime(row.last_inspected_at)}</td><td className="px-3 py-2.5">{label(row.knowledge_state)}</td><td className="px-3 py-2.5">{dateTime(row.next_inspection_at)}</td><td className={row.action_state==='action_required'?'px-3 py-2.5 text-[#8B2312] font-medium':'px-3 py-2.5'}>{reason(row.action_reason)}</td></tr>)}{!loading&&!(report?.urls||[]).length&&<tr><td colSpan={6} className="px-4 py-8 text-center text-[#2B1B0A]/45">Nenhuma URL acompanhada disponível.</td></tr>}</tbody></table></div>
    </section>

    <section className="bg-[#FEFEFE] border border-[#E4DFD9] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E4DFD9] flex items-center justify-between"><div className="text-[13px] font-semibold text-[#565E48]">Histórico de execuções</div><div className="text-[11px] text-[#2B1B0A]/45">{typeof total==='number'?`${total} registros`:'total indisponível'}</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[12px]"><thead><tr className="bg-[#F6F0E9] text-left text-[#2B1B0A]/45"><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Tentativas</th></tr></thead><tbody className="divide-y divide-[#E4DFD9]">{(report?.runs||[]).map(run=><tr key={run.operation_key}><td className="px-3 py-2.5">{dateTime(run.updated_at)}</td><td className="px-3 py-2.5">{run.trigger_source==='manual'?'Manual':run.trigger_source==='scheduled'?'Agendada':'Legado / não registrado'}</td><td className="px-3 py-2.5">{run.run_kind}</td><td className="px-3 py-2.5">{label(run.status)}</td><td className="px-3 py-2.5">{run.attempts??'Indisponível'}</td></tr>)}</tbody></table></div>
      <div className="px-4 py-3 flex justify-between border-t border-[#E4DFD9]"><button disabled={page<=1||loading} onClick={()=>void load(page-1)} className="text-sm px-3 py-2 rounded-xl border border-[#D8D1C9] disabled:opacity-40">Anterior</button><span className="text-[12px] text-[#2B1B0A]/50 self-center">Página {page}</span><button disabled={!hasNext||loading} onClick={()=>void load(page+1)} className="text-sm px-3 py-2 rounded-xl border border-[#D8D1C9] disabled:opacity-40">Próxima</button></div>
    </section>
  </div>;
};
