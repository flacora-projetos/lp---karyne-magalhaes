import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { extractSitemapLocs, sha256Text } from './blogGsc.js';

export const BLOG_PUBLICATION_ORIGIN='https://tratamentodomauhalito.com.br';
export const BLOG_PUBLICATION_REPO='flacora-projetos/lp---karyne-magalhaes';
export const BLOG_PUBLICATION_WORKFLOW='blog-auto-publish.yml';
export const BLOG_PUBLICATION_REF='main';
export const BLOG_PUBLICATION_VERCEL_PROJECT='prj_x5aS2Lns4FevJzp6EgPGnYZE9h8B';
export const BLOG_PUBLICATION_VERCEL_TEAM='team_s0oosifyjpEUd6Fbe5JXb5hh';
export const BLOG_PUBLICATION_PRODUCTION_ALIAS='tratamentodomauhalito.com.br';
const TERMINAL=new Set(['published','cancelled']);
const DISPATCHABLE=new Set(['queued','dispatch_pending','dispatched']);

function db(){return getSupabaseAdmin();}
function uuid(value:unknown){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
function sha(value:unknown){return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);}
function clean(value:unknown,max=1200){return String(value??'').trim().slice(0,max);}

export function validIntegrationSecret(header:string|undefined,secret:string|undefined){
  if(!header||!secret||!header.startsWith('Bearer '))return false;
  const supplied=Buffer.from(header.slice(7));const expected=Buffer.from(secret);
  return supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);
}

export async function getPublicationControl(){
  const r=await db().from('editorial_automation_control').select('*').eq('automation_key','publication').maybeSingle();
  if(r.error)throw new Error('Falha ao ler controle de publicação');
  return r.data||{automation_key:'publication',operator_paused:true,pause_reason:'Controle ainda não instalado',revision:0,active_operation_id:null};
}

export async function setPublicationControl(input:any,actorUserId:string){
  if(!uuid(input.operationKey)||!uuid(actorUserId)||typeof input.paused!=='boolean'||!Number.isInteger(input.expectedRevision)||input.expectedRevision<1)throw new Error('Operação de publicação inválida');
  const reason=clean(input.reason,600);if(input.paused&&reason.length<3)throw new Error('Informe o motivo da pausa de publicação');
  const request={operationKey:input.operationKey,actorUserId,requestSha256:'',expectedRevision:input.expectedRevision,paused:input.paused,reason};
  request.requestSha256=crypto.createHash('sha256').update(JSON.stringify({...request,requestSha256:undefined,actorUserId:undefined})).digest('hex');
  const r=await db().rpc('editorial_phase7_set_publication_control',{p_input:request});
  if(r.error)throw new Error(r.error.message.includes('mudou')?'Controle de publicação mudou; atualize antes de tentar novamente':'Falha ao alterar controle de publicação');
  const value=r.data;
  if(!input.paused&&process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED==='true')value.recovery=await recoverPublicationQueue(2);
  return value;
}

export async function getPublicationStateForArticle(articleId:string,versionId?:string|null){
  const [intent,ops]=await Promise.all([
    versionId?db().from('editorial_publication_intents').select('*').eq('article_version_id',versionId).maybeSingle():Promise.resolve({data:null,error:null} as any),
    db().from('editorial_publication_operations').select('id,article_id,article_version_id,operation_key,trigger_kind,status,attempts,dispatch_attempts,github_pr_number,github_merge_sha,vercel_deployment_id,last_error_code,last_error_detail,created_at,updated_at,finished_at').eq('article_id',articleId).order('created_at',{ascending:false}).limit(10),
  ]);
  if(intent.error||ops.error)throw new Error('Falha ao carregar estado de publicação');
  return {intent:intent.data||null,operations:ops.data||[],latestOperation:(ops.data||[])[0]||null};
}

export async function listPublicationOperations(limit=20){
  const r=await db().from('editorial_publication_operations').select('id,article_id,article_version_id,operation_key,trigger_kind,status,attempts,dispatch_attempts,github_pr_number,github_merge_sha,vercel_deployment_id,last_error_code,last_error_detail,created_at,updated_at,finished_at').order('created_at',{ascending:false}).limit(Math.min(Math.max(limit,1),50));
  if(r.error)throw new Error('Falha ao listar operações de publicação');return r.data||[];
}

export function publicationUiState(op:any,approved=false,intent?:string|null){
  if(!op)return approved?(intent==='auto'?'Aguardando publicação':'Aprovado sem publicar'):'Aguardando revisão';
  const map:Record<string,string>={queued:'Aguardando publicação',dispatch_pending:'Aguardando publicação',dispatched:'Preparando',reserved:'Preparando',preparing:'Preparando',publishing:'Publicando',verifying:'Publicando',published:'Publicado',blocked:'Precisa de atenção',failed:'Precisa de atenção',uncertain:'Precisa de atenção',cancelled:approved?'Aprovado sem publicar':'Aguardando revisão'};
  return map[op.status]||'Precisa de atenção';
}

export async function dispatchPublicationOperation(operationId:string){
  if(!uuid(operationId))throw new Error('Operação de publicação inválida');
  const enabled=process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED==='true';
  if(!enabled)return {status:'disabled',reason:'automation_disabled'};
  const control=await getPublicationControl();
  if(control.operator_paused)return {status:'paused',reason:'operator_paused'};
  const current=await db().from('editorial_publication_operations').select('*').eq('id',operationId).maybeSingle();
  if(current.error||!current.data)throw new Error('Operação de publicação não encontrada');
  const op=current.data;
  if(TERMINAL.has(op.status))return {status:op.status,reused:true};
  if(!DISPATCHABLE.has(op.status))return {status:op.status,reused:true};
  if(Number(op.dispatch_attempts||0)>=6)return {status:'blocked',reason:'dispatch_retry_budget_exhausted'};
  const token=process.env.BLOG_PUBLISH_GITHUB_DISPATCH_TOKEN;
  if(!token)return {status:'not_configured',reason:'dispatch_token_missing'};
  const nextAttempts=Number(op.dispatch_attempts||0)+1;
  const reserve=await db().from('editorial_publication_operations').update({status:'dispatch_pending',dispatch_attempts:nextAttempts,updated_at:new Date().toISOString(),last_error_code:null,last_error_detail:null}).eq('id',operationId).in('status',['queued','dispatch_pending','dispatched']).select('id').maybeSingle();
  if(reserve.error||!reserve.data)return {status:'reused',reason:'state_changed'};
  const endpoint=`https://api.github.com/repos/${BLOG_PUBLICATION_REPO}/actions/workflows/${BLOG_PUBLICATION_WORKFLOW}/dispatches`;
  let response:Response;
  try{
    response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:BLOG_PUBLICATION_REF,inputs:{operation_id:operationId}})});
  }catch(error){
    await db().from('editorial_publication_operations').update({status:'dispatch_pending',last_error_code:'dispatch_result_unknown',last_error_detail:clean(error instanceof Error?error.message:'transport error'),updated_at:new Date().toISOString()}).eq('id',operationId).eq('status','dispatch_pending');
    return {status:'dispatch_pending',reason:'dispatch_result_unknown'};
  }
  if(response.status===204){
    await db().from('editorial_publication_operations').update({status:'dispatched',last_error_code:null,last_error_detail:null,updated_at:new Date().toISOString()}).eq('id',operationId).eq('status','dispatch_pending');
    return {status:'dispatched'};
  }
  const detail=clean(await response.text().catch(()=>''));
  await db().from('editorial_publication_operations').update({status:'queued',last_error_code:`github_dispatch_${response.status}`,last_error_detail:detail,updated_at:new Date().toISOString()}).eq('id',operationId).eq('status','dispatch_pending');
  return {status:'queued',reason:`github_dispatch_${response.status}`};
}

export async function recoverPublicationQueue(limit=2){
  if(process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED!=='true')return {status:'disabled',attempted:0};
  const control=await getPublicationControl();if(control.operator_paused)return {status:'paused',attempted:0};
  const r=await db().from('editorial_publication_operations').select('id,status').in('status',['queued','dispatch_pending','dispatched']).order('created_at').limit(Math.min(Math.max(limit,1),3));
  if(r.error)throw new Error('Falha ao recuperar fila de publicação');
  const results=[];for(const row of r.data||[])results.push(await dispatchPublicationOperation(row.id));
  return {status:'ok',attempted:results.length,results};
}

export async function claimPublicationOperation(operationId:string,executorRunId:string){
  if(!uuid(operationId)||!executorRunId||executorRunId.length>180)throw new Error('Parâmetros do executor inválidos');
  if(process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED!=='true')return {claimed:false,reason:'automation_disabled'};
  const r=await db().rpc('editorial_phase7_claim_publication',{p_input:{operationId,executorRunId}});
  if(r.error)throw new Error('Não foi possível reservar a publicação');return r.data;
}

export async function progressPublication(input:any){
  if(!uuid(input.operationId)||!uuid(input.leaseToken))throw new Error('Lease de publicação inválido');
  const allowed=new Set(['preparing','publishing','verifying','blocked','failed','uncertain']);if(!allowed.has(input.status))throw new Error('Estado de publicação inválido');
  if(input.status==='publishing'){
    const [control,current]=await Promise.all([getPublicationControl(),db().from('editorial_publication_operations').select('status,github_pr_number').eq('id',input.operationId).maybeSingle()]);
    if(current.error||!current.data)throw new Error('Operação de publicação não encontrada');
    if(control.operator_paused&&['reserved','preparing'].includes(current.data.status)&&!current.data.github_pr_number){
      const stopped=await db().rpc('editorial_phase7_progress_publication',{p_input:{operationId:input.operationId,leaseToken:input.leaseToken,status:'blocked',errorCode:'operator_paused_before_effect',errorDetail:'Publicação pausada antes do primeiro efeito externo'}});
      if(stopped.error)throw new Error('Falha ao registrar progresso da publicação');
      return {...stopped.data,reason:'operator_paused_before_effect'};
    }
  }
  const payload={operationId:input.operationId,leaseToken:input.leaseToken,status:input.status,
    githubBaseSha:clean(input.githubBaseSha,80),githubHeadSha:clean(input.githubHeadSha,80),githubBranch:clean(input.githubBranch,180),githubPrNumber:input.githubPrNumber??null,
    githubMergeSha:clean(input.githubMergeSha,80),expectedHtmlSha256:clean(input.expectedHtmlSha256,64),errorCode:clean(input.errorCode,120),errorDetail:clean(input.errorDetail,1200),details:input.details&&typeof input.details==='object'?input.details:{}};
  if(payload.expectedHtmlSha256&&!sha(payload.expectedHtmlSha256))throw new Error('Hash HTML inválido');
  const r=await db().rpc('editorial_phase7_progress_publication',{p_input:payload});if(r.error)throw new Error('Falha ao registrar progresso da publicação');return r.data;
}

export function selectPublicationPullRequest(candidates:any[],expectedHeadSha?:string|null){
  if(!Array.isArray(candidates))return null;
  const expected=clean(expectedHeadSha,80);
  if(expected)return candidates.find(item=>String(item?.head?.sha||item?.headRefOid||'')===expected)||null;
  return candidates.length===1?candidates[0]:null;
}

async function githubJson(url:string,token:string){
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw new Error(`github_pr_read_${response.status}`);return response.json();
}

async function githubPr(op:any){
  const token=process.env.BLOG_PUBLISH_GITHUB_READ_TOKEN||process.env.BLOG_PUBLISH_GITHUB_DISPATCH_TOKEN;
  if(!token)return {configured:false,pr:null};
  if(op.github_pr_number){
    const pr=await githubJson(`https://api.github.com/repos/${BLOG_PUBLICATION_REPO}/pulls/${op.github_pr_number}`,token);
    return {configured:true,pr};
  }
  if(!op.github_branch||!op.github_head_sha)return {configured:true,pr:null};
  const owner=BLOG_PUBLICATION_REPO.split('/')[0];
  const params=new URLSearchParams({state:'all',head:`${owner}:${op.github_branch}`,per_page:'20'});
  const candidates:any=await githubJson(`https://api.github.com/repos/${BLOG_PUBLICATION_REPO}/pulls?${params}`,token);
  let pr=selectPublicationPullRequest(candidates,op.github_head_sha);
  if(!pr){
    const search=new URLSearchParams({q:`repo:${BLOG_PUBLICATION_REPO} is:pr \"${op.id}\"`,per_page:'10'});
    const found:any=await githubJson(`https://api.github.com/search/issues?${search}`,token);
    for(const item of found?.items||[]){
      const candidate=await githubJson(`https://api.github.com/repos/${BLOG_PUBLICATION_REPO}/pulls/${item.number}`,token);
      if(selectPublicationPullRequest([candidate],op.github_head_sha)){pr=candidate;break;}
    }
  }
  if(pr?.number){
    const persisted=await db().from('editorial_publication_operations').update({github_pr_number:pr.number,github_merge_sha:pr.merged_at?(pr.merge_commit_sha||op.github_merge_sha||null):(op.github_merge_sha||null),updated_at:new Date().toISOString()}).eq('id',op.id).is('github_pr_number',null);
    if(persisted.error)throw new Error('github_pr_reconciliation_persist_failed');
  }
  return {configured:true,pr};
}

export async function vercelDeployment(mergeSha:string){
  const token=process.env.BLOG_PUBLISH_VERCEL_TOKEN;if(!token)return null;
  const qs=new URLSearchParams({projectId:BLOG_PUBLICATION_VERCEL_PROJECT,target:'production',limit:'20',teamId:BLOG_PUBLICATION_VERCEL_TEAM});
  const response=await fetch(`https://api.vercel.com/v6/deployments?${qs}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error(`vercel_deployments_${response.status}`);
  const data:any=await response.json();
  const candidate=(data.deployments||[]).find((item:any)=>item?.meta?.githubCommitSha===mergeSha&&item.readyState==='READY'&&item.target==='production');
  const id=candidate?.uid||candidate?.id;
  if(!id||!/^dpl_[a-zA-Z0-9]+$/.test(id))return null;
  // A listagem não inclui os aliases; a confirmação usa os detalhes da implantação exata.
  const detailResponse=await fetch(`https://api.vercel.com/v13/deployments/${id}?teamId=${BLOG_PUBLICATION_VERCEL_TEAM}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!detailResponse.ok)throw new Error(`vercel_deployment_${detailResponse.status}`);
  const detail:any=await detailResponse.json();
  return detail.id===id&&detail.project?.id===BLOG_PUBLICATION_VERCEL_PROJECT&&detail.meta?.githubCommitSha===mergeSha&&detail.readyState==='READY'&&detail.target==='production'&&Array.isArray(detail.alias)&&detail.alias.includes(BLOG_PUBLICATION_PRODUCTION_ALIAS)?detail:null;
}

function canonicalFromHtml(html:string){return html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]||html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)?.[1]||'';}
async function fetchText(url:string){const response=await fetch(url,{headers:{'Cache-Control':'no-cache'}});if(!response.ok)throw new Error(`production_http_${response.status}`);return response.text();}

export async function reconcilePublicationOperation(operationId:string){
  if(!uuid(operationId))throw new Error('Operação de publicação inválida');
  const row=await db().from('editorial_publication_operations').select('*').eq('id',operationId).maybeSingle();if(row.error||!row.data)throw new Error('Operação de publicação não encontrada');
  const op=row.data;if(op.status==='published')return {status:'published',reused:true};if(op.status==='cancelled')return {status:'cancelled'};
  const lookup:any=await githubPr(op);if(!lookup.configured)return {status:op.status,reason:'github_read_not_configured'};
  const pr:any=lookup.pr;if(!pr)return {status:op.status,reason:op.github_branch?'pr_not_found':'pr_not_recorded'};
  if(pr.state==='closed'&&!pr.merged_at){
    if(op.lease_token)await progressPublication({operationId:op.id,leaseToken:op.lease_token,status:'failed',errorCode:'pr_closed_unmerged',errorDetail:'PR editorial foi fechado sem merge'});
    return {status:'failed',reason:'pr_closed_unmerged',prNumber:pr.number};
  }
  if(!pr.merged_at||!pr.merge_commit_sha)return {status:'publishing',reason:'pr_not_merged',prNumber:pr.number};
  const mergeSha=String(pr.merge_commit_sha);if(op.github_merge_sha&&op.github_merge_sha!==mergeSha)throw new Error('github_merge_sha_mismatch');
  const deployment:any=await vercelDeployment(mergeSha);if(!deployment)return {status:'verifying',reason:'production_deployment_not_confirmed'};
  const snapshot=op.snapshot_json;const slug=snapshot?.article?.slug;if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error('snapshot_slug_invalid');
  const canonical=`${BLOG_PUBLICATION_ORIGIN}/blog/${slug}/`;const html=await fetchText(canonical);const actualHtml=sha256Text(html);
  if(!sha(op.expected_html_sha256)||actualHtml!==op.expected_html_sha256)return {status:'verifying',reason:'html_hash_mismatch',actualHtmlSha256:actualHtml};
  if(canonicalFromHtml(html)!==canonical)return {status:'verifying',reason:'canonical_mismatch'};
  const sitemap=await fetchText(`${BLOG_PUBLICATION_ORIGIN}/sitemap.xml`);if(!extractSitemapLocs(sitemap).includes(canonical))return {status:'verifying',reason:'sitemap_missing_url'};
  const confirm=await db().rpc('editorial_confirm_gsc_publication',{p_input:{articleId:op.article_id,articleVersionId:op.article_version_id,operationKey:op.operation_key,url:canonical,contentSha256:op.content_sha256,presentationSha256:op.presentation_sha256,releaseSha256:op.release_sha256,htmlSha256:actualHtml,verification:{canonical_url:canonical,sitemap_present:true,github_pr_number:pr.number,github_merge_sha:mergeSha,vercel_deployment_id:deployment.uid||deployment.id||null,vercel_deployment_url:deployment.url||null}}});
  if(confirm.error)throw new Error('publication_confirmation_failed');
  const done=await db().rpc('editorial_phase7_mark_published',{p_input:{operationId:op.id,vercelDeploymentId:deployment.uid||deployment.id||'',vercelDeploymentUrl:deployment.url||'',verification:{html_sha256:actualHtml,canonical_url:canonical,sitemap_present:true,github_merge_sha:mergeSha}}});
  if(done.error)throw new Error('publication_operation_completion_failed');
  return {status:'published',publicationId:confirm.data,operationId:op.id,canonical,htmlSha256:actualHtml,deploymentId:deployment.uid||deployment.id||null};
}
