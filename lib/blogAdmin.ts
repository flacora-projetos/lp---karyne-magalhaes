import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { dispatchPublicationOperation, getPublicationControl, getPublicationStateForArticle, listPublicationOperations, publicationUiState, setPublicationControl } from './blogPublisher.js';

export const BLOG_ADMIN_PAGE_SIZE = 20;
export const BLOG_ADMIN_MAX_PAGE_SIZE = 50;
export const ALLOWED_BLOCK_TYPES = new Set(['h2','h3','p','ul','ol','quote']);
export const APPROVED_BLOG_ASSETS = [
  { file:'oralchroma_equipamento.jpg', label:'Equipamento no consultório', defaultAlt:'Dra. Karyne junto a equipamento no consultório', defaultCaption:'Aparelho apresentado no site da Dra. Karyne como OralChroma. Os exames complementam a avaliação clínica.' },
  { file:'avaliacao_paciente.jpg', label:'Demonstração odontológica', defaultAlt:'Dra. Karyne demonstrando um modelo odontológico', defaultCaption:'Dra. Karyne demonstrando um modelo odontológico. A imagem não mostra atendimento a um paciente.' },
  { file:'karyne_cta.jpg', label:'Retrato da Dra. Karyne', defaultAlt:'Retrato da Dra. Karyne no consultório', defaultCaption:'Dra. Karyne Magalhães. Imagem de apresentação da profissional; não representa um exame de saliva.' },
] as const;

function db() { return getSupabaseAdmin(); }
export function sha256Json(value: unknown) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function isUuid(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function isSlug(value: unknown) { return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value); }
export function isSha(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }

export function parsePage(input: unknown, defaultSize = BLOG_ADMIN_PAGE_SIZE) {
  const page = Math.max(1, Number.parseInt(String((input as any)?.page || '1'),10) || 1);
  const pageSize = Math.min(BLOG_ADMIN_MAX_PAGE_SIZE, Math.max(1, Number.parseInt(String((input as any)?.pageSize || defaultSize),10) || defaultSize));
  return {page,pageSize,from:(page-1)*pageSize,to:page*pageSize-1};
}

export function normalizeSearch(value: unknown) {
  return String(value || '').normalize('NFC').replace(/[^\p{L}\p{N}\s'’_-]+/gu,' ').replace(/\s+/g,' ').trim().slice(0,80);
}
function cleanText(value: unknown, max: number, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error('Campo de texto obrigatório');
  if (text.length > max) throw new Error('Campo de texto excede o limite');
  return text;
}
function externalUrl(value: unknown) {
  try { const u=new URL(String(value)); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function internalUrl(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;
  try {
    const u=new URL(value,'https://tratamentodomauhalito.com.br');
    if (u.origin!=='https://tratamentodomauhalito.com.br' || u.search) return false;
    return u.pathname==='/' || u.pathname==='/blog/' || /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(u.pathname) || /^\/politica-de-privacidade\/?$/.test(u.pathname);
  } catch { return false; }
}

export function validateEditableArticle(input: any) {
  if (!input || typeof input!=='object') throw new Error('Conteúdo inválido');
  const title=cleanText(input.title,180,true);
  const description=cleanText(input.description,360,true);
  if (!isSlug(input.slug)) throw new Error('Slug inválido');
  if (!Array.isArray(input.body) || input.body.length<1 || input.body.length>120) throw new Error('Corpo editorial inválido');
  const body=input.body.map((block:any)=>{
    if (!block || !ALLOWED_BLOCK_TYPES.has(block.type)) throw new Error('Bloco editorial não suportado');
    if (['ul','ol'].includes(block.type)) {
      if (!Array.isArray(block.items) || !block.items.length || block.items.length>30) throw new Error('Lista editorial inválida');
      return {type:block.type,items:block.items.map((item:any)=>cleanText(item,600,true))};
    }
    return {type:block.type,text:cleanText(block.text,4000,true)};
  });
  if (input.references != null && (!Array.isArray(input.references) || input.references.length > 30)) throw new Error('Referência externa inválida');
  if (input.internalLinks != null && (!Array.isArray(input.internalLinks) || input.internalLinks.length > 20)) throw new Error('Link interno inválido');
  const references=(input.references||[]).map((ref:any)=>{
    const url=cleanText(ref?.url,1000,true); if(!externalUrl(url)) throw new Error('Referência externa inválida');
    if(ref?.verifiedAt && !/^\d{4}-\d{2}-\d{2}$/.test(String(ref.verifiedAt))) throw new Error('Referência externa inválida');
    return {title:cleanText(ref?.title,300,true),url,...(ref?.supports?{supports:cleanText(ref.supports,1000)}:{}),...(ref?.verifiedAt?{verifiedAt:cleanText(ref.verifiedAt,10)}:{})};
  });
  const internalLinks=(input.internalLinks||[]).map((link:any)=>{
    const label=cleanText(link?.label,180,true);
    if (link?.slug) { if(!isSlug(link.slug)) throw new Error('Slug de link interno inválido'); return {label,slug:String(link.slug)}; }
    const url=cleanText(link?.url,500,true); if(!internalUrl(url)) throw new Error('Link interno inválido'); return {label,url};
  });
  let presentation:any;
  if (input.presentation?.kind==='none') {
    presentation={kind:'none',reviewStatus:'reviewed',subject:cleanText(input.presentation.subject||'sem-imagem-adequada',160,true),reason:cleanText(input.presentation.reason,600,true),image:null};
  } else {
    const file=String(input.presentation?.image?.file||'');
    const approved=APPROVED_BLOG_ASSETS.find(a=>a.file===file);
    if(!approved) throw new Error('Imagem fora do acervo aprovado');
    presentation={kind:'image',reviewStatus:'reviewed',subject:cleanText(input.presentation?.subject||approved.label,160,true),image:{
      file,width:file==='oralchroma_equipamento.jpg'?1280:854,height:file==='oralchroma_equipamento.jpg'?854:1280,
      label:cleanText(input.presentation?.image?.label||approved.label,160,true),
      alt:cleanText(input.presentation?.image?.alt||approved.defaultAlt,300,true),
      caption:cleanText(input.presentation?.image?.caption,600,true),
    }};
  }
  return {title,description,slug:String(input.slug),body,references,internalLinks,presentation,ctaLabel:cleanText(input.ctaLabel||'Conhecer a avaliação inicial',120,true)};
}

export function canonicalContentPayload(article:any) {
  // JSONB reordena chaves; o pacote precisa recuperar a ordem usada pelo renderer e pelas aprovações.
  return {...article,
    body:article?.body?.map((b:any)=>['ul','ol'].includes(b.type)?{type:b.type,items:b.items}:{type:b.type,text:b.text}),
    internalLinks:article?.internalLinks?.map((l:any)=>l.slug?{label:l.label,slug:l.slug}:{label:l.label,url:l.url}),
    references:article?.references?.map((r:any)=>({title:r.title,url:r.url,...(r.supports?{supports:r.supports}:{}),...(r.verifiedAt?{verifiedAt:r.verifiedAt}:{})})),
  };
}

export function canonicalPresentation(p:any) {
  if(!p) return p;
  const image=p.image?{file:p.image.file,width:p.image.width,height:p.image.height,label:p.image.label,alt:p.image.alt,caption:p.image.caption}:null;
  if(p.kind==='none') return {kind:'none',reviewStatus:p.reviewStatus,subject:p.subject,reason:p.reason,image:null};
  if(p.kind==='legacy') return {kind:'legacy',reviewStatus:p.reviewStatus,subject:p.subject,source:p.source,image};
  return {kind:'image',reviewStatus:p.reviewStatus,subject:p.subject,image};
}

export function contentFingerprintPayload(input:any) {
  const article=canonicalContentPayload(input);
  return {id:article?.id??null,version:article?.version??null,slug:article?.slug??null,title:article?.title??null,description:article?.description??null,
    body:article?.body??null,ctaLabel:article?.ctaLabel??null,internalLinks:article?.internalLinks??null,references:article?.references??null,
    author:article?.author??null,datePublished:article?.datePublished??null,dateModified:article?.dateModified??null};
}
export function contentFingerprint(article:any){return sha256Json(contentFingerprintPayload(article));}
export function presentationFingerprint(presentation:any){return sha256Json(canonicalPresentation(presentation));}
export function releaseFingerprint(contentHash:string,presentationHash:string){return sha256Json({contentHash,presentationHash});}

export function latestReviews(reviews:any[], versionId:string) {
  const relevant=(reviews||[]).filter(r=>r.article_version_id===versionId).sort((a,b)=>String(b.reviewed_at||b.created_at||'').localeCompare(String(a.reviewed_at||a.created_at||'')) || String(b.id||'').localeCompare(String(a.id||'')));
  const latest:any={editorial:null,clinical:null};
  for(const row of relevant) if((row.review_type==='editorial'||row.review_type==='clinical')&&!latest[row.review_type]) latest[row.review_type]=row;
  return latest;
}
export function exactApprovalState(version:any,reviews:any[]){
  const latest=latestReviews(reviews,version.id); const valid=(r:any)=>r?.status==='approved'&&r.reviewed_at&&r.content_sha256===version.content_sha256&&r.presentation_sha256===version.presentation_sha256;
  return {editorial:valid(latest.editorial),clinical:valid(latest.clinical),latest};
}

async function rowsForArticles(articleIds:string[]) {
  if(!articleIds.length) return {versions:[],publications:[],reviews:[],gsc:[]};
  const [v,p,g,pi,po]=await Promise.all([
    db().from('editorial_versions').select('id,article_id,version_number,title,created_at,content_sha256,presentation_sha256').in('article_id',articleIds).order('version_number',{ascending:false}),
    db().from('editorial_publications').select('id,article_id,article_version_id,url,canonical_url,publication_status,published_at,modified_at,last_verified_at').in('article_id',articleIds),
    db().from('editorial_gsc_urls').select('article_id,article_version_id,knowledge_state,action_state,last_inspected_at,next_inspection_at').in('article_id',articleIds),
    db().from('editorial_publication_intents').select('article_id,article_version_id,intent,set_at,revision').in('article_id',articleIds),
    db().from('editorial_publication_operations').select('id,article_id,article_version_id,status,trigger_kind,attempts,last_error_code,updated_at').in('article_id',articleIds).order('created_at',{ascending:false}),
  ]);
  for(const result of [v,p,g,pi,po]) if(result.error) throw new Error('Falha ao carregar estado editorial');
  const latestIds:string[]=[]; const seen=new Set<string>(); for(const row of v.data||[]) if(!seen.has(row.article_id)){seen.add(row.article_id);latestIds.push(row.id);}
  const r=latestIds.length?await db().from('editorial_reviews').select('id,article_version_id,review_type,status,reviewer_name,notes,reviewed_at,created_at,content_sha256,presentation_sha256,evidence_json,recorded_by_user_id').in('article_version_id',latestIds):{data:[],error:null};
  if(r.error) throw new Error('Falha ao carregar revisões');
  return {versions:v.data||[],publications:p.data||[],reviews:r.data||[],gsc:g.data||[],publicationIntents:pi.data||[],publicationOperations:po.data||[]};
}

export async function listArticles(params:any={}) {
  const {page,pageSize,from,to}=parsePage(params);
  let query=db().from('editorial_articles').select('id,source_id,working_title,target_slug,topic_cluster,primary_search_intent,status,created_at,updated_at',{count:'exact'});
  if (params.publication === 'published') {
    const publications = await db().from('editorial_publications').select('article_id').eq('publication_status','published');
    if (publications.error) throw new Error('Falha ao listar publicações');
    const ids = [...new Set((publications.data || []).map(p=>p.article_id))];
    if (!ids.length) return {items:[],page,pageSize,total:0};
    query=query.in('id',ids);
  }
  const q=normalizeSearch(params.q); if(q) query=query.or(`working_title.ilike.%${q}%,topic_cluster.ilike.%${q}%`);
  const status=String(params.status||'').trim();
  if(status) {
    if (!['inventario','briefing','rascunho','revisao_editorial','revisao_clinica','aprovado','publicado','arquivado'].includes(status)) throw new Error('Status editorial inválido');
    query=query.eq('status',status);
  }
  else if(Array.isArray(params.statuses) && params.statuses.length) query=query.in('status',params.statuses);
  const result=await query.order('updated_at',{ascending:false}).range(from,to);
  if(result.error) throw new Error('Falha ao listar artigos');
  const articles=result.data||[]; const related=await rowsForArticles(articles.map(a=>a.id));
  return {items:articles.map(article=>{
    const versions=related.versions.filter(v=>v.article_id===article.id); const latest=versions[0]||null;
    const publication=related.publications.filter(p=>p.article_id===article.id&&p.publication_status==='published').sort((a,b)=>String(b.modified_at||b.published_at||'').localeCompare(String(a.modified_at||a.published_at||'')))[0]||null;
    const approvals=latest?exactApprovalState(latest,related.reviews):{editorial:false,clinical:false,latest:{}};
    const gsc=related.gsc.find(g=>g.article_id===article.id&&g.article_version_id===publication?.article_version_id)||null;
    const publicationIntent=latest?related.publicationIntents.find((i:any)=>i.article_version_id===latest.id)||null:null;
    const publicationOperation=latest?related.publicationOperations.find((o:any)=>o.article_version_id===latest.id)||null:null;
    return {...article,work_version:latest?.version_number??null,work_version_id:latest?.id??null,public_version:publication?versions.find(v=>v.id===publication.article_version_id)?.version_number??null:null,public_url:publication?.canonical_url||null,approvals:{editorial:approvals.editorial,clinical:approvals.clinical},publication_intent:publicationIntent?.intent||null,publication_operation:publicationOperation,publication_state:publicationUiState(publicationOperation,Boolean(approvals.editorial&&approvals.clinical),publicationIntent?.intent),gsc:gsc?{knowledge_state:gsc.knowledge_state,action_state:gsc.action_state,last_inspected_at:gsc.last_inspected_at,next_inspection_at:gsc.next_inspection_at}:null};
  }),page,pageSize,total:result.count??null};
}

export async function getArticleDetail(articleId:string) {
  if(!isUuid(articleId)) throw new Error('Artigo inválido');
  const a=await db().from('editorial_articles').select('*').eq('id',articleId).maybeSingle(); if(a.error||!a.data) throw new Error('Artigo não encontrado');
  const versionIdsResult=await db().from('editorial_versions').select('id').eq('article_id',articleId); if(versionIdsResult.error) throw new Error('Falha ao carregar versões');
  const versionIds=(versionIdsResult.data||[]).map(v=>v.id);
  const [versions,reviews,publications,links]=await Promise.all([
    db().from('editorial_versions').select('*').eq('article_id',articleId).order('version_number',{ascending:false}),
    versionIds.length?db().from('editorial_reviews').select('*').in('article_version_id',versionIds).order('reviewed_at',{ascending:false}):Promise.resolve({data:[],error:null} as any),
    db().from('editorial_publications').select('*').eq('article_id',articleId).order('modified_at',{ascending:false}),
    db().from('editorial_article_sources').select('source_id,source_role,source_order').eq('article_id',articleId).order('source_order'),
  ]);
  for(const r of [versions,reviews,publications,links]) if(r.error) throw new Error('Falha ao carregar detalhe editorial');
  const sourceIds=[...new Set([a.data.source_id,...(links.data||[]).map((x:any)=>x.source_id)].filter(Boolean))];
  const sources=sourceIds.length?await db().from('editorial_sources').select('id,external_id,source_url,source_slug,source_title,normalized_excerpt,normalized_body_text,published_at_source,modified_at_source').in('id',sourceIds):{data:[],error:null};
  if(sources.error) throw new Error('Falha ao carregar fontes');
  const latest=versions.data?.[0];
  const approvalState=latest?exactApprovalState(latest,reviews.data||[]):{editorial:false,clinical:false};
  const publicationState=latest?await getPublicationStateForArticle(articleId,latest.id):{intent:null,operations:[],latestOperation:null};
  return {article:a.data,versions:versions.data||[],reviews:reviews.data||[],publications:publications.data||[],approvals:{editorial:Boolean(approvalState.editorial),clinical:Boolean(approvalState.clinical)},publication:{...publicationState,infrastructure_enabled:process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED==='true',state:publicationUiState(publicationState.latestOperation,Boolean(approvalState.editorial&&approvalState.clinical),publicationState.intent?.intent)},sources:(sources.data||[]).map((s:any)=>({...s,has_text:Boolean(String(s.normalized_body_text||'').trim()),normalized_body_text:undefined,body_excerpt:String(s.normalized_body_text||'').slice(0,1200)}))};
}

export async function listDrafts(params:any={}) {
  const {page,pageSize,from,to}=parsePage(params);
  let query=db().from('editorial_drafts').select('operation_key,status,payload_json,created_at,promoted_article_id,last_error_code',{count:'exact'});
  const q=normalizeSearch(params.q); if(q) query=query.ilike('payload_json->>workingTitle',`%${q}%`);
  const result=await query.order('created_at',{ascending:false}).range(from,to);
  if(result.error) throw new Error('Falha ao listar rascunhos');
  return {items:result.data||[],page,pageSize,total:result.count??null};
}

export async function getSourceDetail(sourceId:string) {
  if(!isUuid(sourceId)) throw new Error('Fonte inválida');
  const result=await db().from('editorial_sources').select('id,external_id,source_url,source_slug,source_title,normalized_excerpt,normalized_body_text,published_at_source,modified_at_source,metadata_json,normalized_payload_json').eq('id',sourceId).maybeSingle();
  if(result.error||!result.data) throw new Error('Fonte não encontrada');
  return {...result.data,has_text:Boolean(String(result.data.normalized_body_text||'').trim())};
}

export async function listSources(params:any={}) {
  const {page,pageSize,from,to}=parsePage(params);
  let query=db().from('editorial_sources').select('id,external_id,source_url,source_slug,source_title,normalized_excerpt,normalized_body_text,published_at_source,modified_at_source',{count:'exact'}).eq('source_system','wordpress_karyne');
  const q=normalizeSearch(params.q); if(q) query=query.or(`source_title.ilike.%${q}%,source_slug.ilike.%${q}%,external_id.ilike.%${q}%`);
  const result=await query.order('published_at_source',{ascending:false,nullsFirst:false}).range(from,to); if(result.error) throw new Error('Falha ao listar acervo');
  return {items:(result.data||[]).map((s:any)=>({...s,has_text:Boolean(String(s.normalized_body_text||'').trim()),normalized_body_text:undefined,body_excerpt:String(s.normalized_body_text||'').slice(0,900)})),page,pageSize,total:result.count??null};
}

async function count(table:string, apply?:(q:any)=>any){let q=db().from(table).select('*',{count:'exact',head:true});if(apply)q=apply(q);const r=await q;if(r.error)throw new Error('Falha ao calcular visão geral');return r.count??null;}
export async function getBlogOverview(){
  const [total,published,review,approved,indexed,drafts,actionPending,lastRun,lastScheduledRun,nextInspection,automation,publicationAutomation,publicationPending,publicationAttention,publicationRuns]=await Promise.all([
    count('editorial_articles'),count('editorial_publications',q=>q.eq('publication_status','published')),
    count('editorial_articles',q=>q.in('status',['revisao_editorial','revisao_clinica'])),count('editorial_articles',q=>q.eq('status','aprovado')),
    count('editorial_gsc_urls',q=>q.eq('knowledge_state','indexed')),
    count('editorial_drafts',q=>q.is('promoted_article_id',null)),
    count('editorial_gsc_urls',q=>q.eq('action_state','action_required')),
    db().from('editorial_gsc_runs').select('operation_key,run_kind,status,trigger_source,attempts,started_at,finished_at,updated_at,details_json').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db().from('editorial_gsc_runs').select('status,started_at,finished_at,updated_at').eq('trigger_source','scheduled').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db().from('editorial_gsc_urls').select('next_inspection_at').order('next_inspection_at').limit(1).maybeSingle(),
    getAutomationControl(),
    getPublicationControl(),
    count('editorial_publication_operations',q=>q.in('status',['queued','dispatch_pending','dispatched','reserved','preparing','publishing','verifying'])),
    count('editorial_publication_operations',q=>q.in('status',['blocked','failed','uncertain'])),
    listPublicationOperations(8),
  ]);
  if(lastRun.error||lastScheduledRun.error||nextInspection.error) throw new Error('Falha ao ler última automação');
  return {counts:{articles:total,published,drafts,review_pending:review,approved_waiting_publication:approved,indexed,action_pending:actionPending,publication_pending:publicationPending,publication_attention:publicationAttention},automation:{...automation,infrastructure_enabled:process.env.BLOG_GSC_AUTOMATION_ENABLED==='true'},publication_automation:{...publicationAutomation,infrastructure_enabled:process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED==='true'},publication_runs:publicationRuns,last_run:lastRun.data||null,last_scheduled_run:lastScheduledRun.data||null,next_inspection_at:nextInspection.data?.next_inspection_at||null,data_updated_at:new Date().toISOString()};
}

export async function getReviewQueue(params:any={}){return listArticles({...params,statuses:['revisao_editorial','revisao_clinica','aprovado'],pageSize:Math.min(Number(params.pageSize)||20,50)});}

function buildContentPayload(articleId:string,versionNumber:number,article:any,editable:any, previous:any, now:string){return {
  id:previous?.id||articleId,sourceId:previous?.sourceId||article.source_id||null,version:versionNumber,slug:article.target_slug,title:editable.title,description:editable.description,status:'draft',body:editable.body,ctaLabel:editable.ctaLabel,internalLinks:editable.internalLinks,references:editable.references,
  author:previous?.author||'Dra. Karyne Magalhães',datePublished:previous?.datePublished||now,dateModified:now,
};}

async function reusedOperation(operationKey:string, requestSha256:string, actorUserId:string, operationType:string) {
  const result=await db().from('editorial_admin_audit').select('request_sha256,actor_user_id,operation_type,result_json').eq('operation_key',operationKey).maybeSingle();
  if(result.error) throw new Error('Falha ao consultar operação editorial');
  if(!result.data) return null;
  if(result.data.request_sha256!==requestSha256 || result.data.actor_user_id!==actorUserId || result.data.operation_type!==operationType) throw new Error('Identificador já usado para outra operação');
  return result.data.result_json;
}

export function saveRequestFingerprint(input:any, editable:any) {
  return sha256Json({articleId:input.articleId,expectedVersionId:input.expectedVersionId,expectedVersionNumber:Number(input.expectedVersionNumber),article:editable,changeNote:cleanText(input.changeNote,500)});
}

export async function saveArticleVersion(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.articleId)||!isUuid(input.expectedVersionId)||!isUuid(input.operationKey)) throw new Error('Identificadores inválidos');
  const requested=validateEditableArticle(input.article);
  const requestSha256=saveRequestFingerprint(input,requested);
  const reused=await reusedOperation(input.operationKey,requestSha256,actorUserId,'save_version'); if(reused) return reused;
  const detail=await getArticleDetail(input.articleId); const latest=detail.versions[0]; if(!latest||latest.id!==input.expectedVersionId||latest.version_number!==Number(input.expectedVersionNumber)) throw new Error('Conflito de versão; recarregue antes de salvar');
  if(requested.slug!==detail.article.target_slug) throw new Error('Slug de artigo existente deve ser preservado');
  const editable=validateEditableArticle({...input.article,slug:detail.article.target_slug}); const now=new Date().toISOString(); const next=latest.version_number+1;
  const previous=latest.content_payload_json||{}; const contentPayload=buildContentPayload(detail.article.id,next,detail.article,editable,previous,now);
  const contentSha256=contentFingerprint(contentPayload); const presentationPayload=editable.presentation; const presentationSha256=presentationFingerprint(presentationPayload);
  const request={articleId:detail.article.id,expectedVersionId:latest.id,expectedVersionNumber:latest.version_number,operationKey:input.operationKey,actorUserId,requestSha256:'',targetSlug:detail.article.target_slug,title:editable.title,description:editable.description,body:editable.body,references:editable.references,changeNote:cleanText(input.changeNote,500),contentPayload,contentSha256,presentationPayload,presentationSha256};
  request.requestSha256=requestSha256;
  const result=await db().rpc('editorial_phase7_save_version',{p_input:request}); if(result.error) throw new Error(result.error.message.includes('conflito de versao')?'Conflito de versão; recarregue antes de salvar':result.error.message.includes('etapa critica')?'A publicação desta versão já começou; espere terminar antes de editar':'Falha ao salvar nova versão'); return result.data;
}

export async function promoteDraft(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.draftOperationKey)||!isUuid(input.operationKey)) throw new Error('Identificadores inválidos');
  const requestSha256=sha256Json({draftOperationKey:input.draftOperationKey,presentation:input.presentation??null,articleId:input.articleId??null});
  const reused=await reusedOperation(input.operationKey,requestSha256,actorUserId,'promote_draft'); if(reused) return reused;
  const d=await db().from('editorial_drafts').select('*').eq('operation_key',input.draftOperationKey).maybeSingle();if(d.error||!d.data)throw new Error('Rascunho não encontrado');if(d.data.status!=='draft'||!d.data.payload_json)throw new Error('Rascunho ainda não está pronto');
  if(d.data.promoted_version_id) return {articleId:d.data.promoted_article_id,versionId:d.data.promoted_version_id,versionNumber:1,reused:true};
  const draft=d.data.payload_json; const source=await db().from('editorial_sources').select('id,external_id').eq('id',d.data.source_id).maybeSingle();if(source.error||!source.data)throw new Error('Fonte do rascunho não encontrada');
  const articleId=String(input.articleId||crypto.randomUUID()); if(!isUuid(articleId))throw new Error('ID do artigo inválido');
  const presentation=input.presentation || (draft.presentationSuggestion?.decision==='no_adequate_image'?{kind:'none',reviewStatus:'reviewed',subject:String(draft.presentationSuggestion.subject||'sem-imagem-adequada'),reason:String(draft.presentationSuggestion.notes||'Sem imagem adequada'),image:null}:null);
  if(!presentation) throw new Error('Escolha uma apresentação no editor antes de promover este rascunho');
  const editable=validateEditableArticle({title:draft.workingTitle,description:draft.description,slug:draft.targetSlug,body:draft.body,references:draft.references,internalLinks:draft.internalLinks,presentation,ctaLabel:'Conhecer a avaliação inicial'});
  const now=new Date().toISOString(); const article={id:articleId,source_id:d.data.source_id,target_slug:editable.slug}; const contentPayload=buildContentPayload(articleId,1,article,editable,{sourceId:source.data.external_id},now); const contentSha256=contentFingerprint(contentPayload); const presentationSha256=presentationFingerprint(editable.presentation);
  const request={draftOperationKey:input.draftOperationKey,operationKey:input.operationKey,actorUserId,articleId,requestSha256,targetSlug:editable.slug,title:editable.title,description:editable.description,body:editable.body,references:editable.references,topicCluster:cleanText(draft.editorialContribution||'',240),searchIntent:cleanText(draft.searchIntent||'',240),serviceRelation:'halitose',contentPayload,contentSha256,presentationPayload:editable.presentation,presentationSha256};
  const result=await db().rpc('editorial_phase6_promote_draft',{p_input:request});if(result.error)throw new Error(result.error.message.includes('slug ja')?'Este slug já existe no acervo editorial':'Falha ao criar versão editável');return result.data;
}

export async function recordReview(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.versionId)||!isUuid(input.operationKey)||!isSha(input.contentSha256)||!isSha(input.presentationSha256))throw new Error('Dados da revisão inválidos');
  if(!['editorial','clinical'].includes(input.reviewType)||!['approved','changes_requested'].includes(input.decision))throw new Error('Decisão de revisão inválida');
  if(input.decision==='changes_requested' && cleanText(input.notes,1200).length<3) throw new Error('Informe a correção solicitada');
  if(input.reviewType==='clinical' && input.decision==='approved' && cleanText(input.reviewerName,180).length<3) throw new Error('Identifique o responsável clínico');
  if(input.evidence && (Array.isArray(input.evidence)||typeof input.evidence!=='object'||JSON.stringify(input.evidence).length>4000)) throw new Error('Evidência da revisão inválida');
  const releaseSha256=releaseFingerprint(input.contentSha256,input.presentationSha256);
  const request={operationKey:input.operationKey,actorUserId,versionId:input.versionId,requestSha256:'',reviewType:input.reviewType,decision:input.decision,contentSha256:input.contentSha256,presentationSha256:input.presentationSha256,releaseSha256,reviewerName:cleanText(input.reviewerName,180),notes:cleanText(input.notes,1200),evidence:input.evidence&&typeof input.evidence==='object'?input.evidence:{}};request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase7_record_review',{p_input:request});if(result.error)throw new Error(result.error.message.includes('versao de trabalho')?'A revisão ficou desatualizada; recarregue a fila':result.error.message.includes('etapa critica')?'A publicação desta versão já começou; espere terminar antes de mudar a revisão':'Falha ao registrar revisão');
  const value=result.data;if(value?.publicationOperationId)value.dispatch=await dispatchPublicationOperation(value.publicationOperationId);return value;
}

export async function exportApprovedSnapshot(articleId:string,versionId:string,actorUserId:string){
  if(!isUuid(articleId)||!isUuid(versionId)||!isUuid(actorUserId)) throw new Error('Identificadores inválidos');
  const result=await db().rpc('editorial_phase6_export_snapshot',{p_input:{articleId,versionId,actorUserId}});
  if(result.error) throw new Error('Aprovações editorial e clínica atuais são obrigatórias');
  const version=result.data.version;
  const approvals=exactApprovalState(version,result.data.reviews);if(!approvals.editorial||!approvals.clinical)throw new Error('Aprovações editorial e clínica atuais são obrigatórias');
  if(!version.content_payload_json||!version.presentation_payload_json||!isSha(version.content_sha256)||!isSha(version.presentation_sha256))throw new Error('Esta versão não tem dados completos para baixar');
  const content={...canonicalContentPayload(version.content_payload_json),status:'approved',presentation:canonicalPresentation(version.presentation_payload_json)}; const contentHash=contentFingerprint(content);const presentationHash=presentationFingerprint(version.presentation_payload_json);
  if(contentHash!==version.content_sha256||presentationHash!==version.presentation_sha256)throw new Error('A versão salva não confere com o conteúdo baixado; recarregue o artigo');
  const releaseHash=releaseFingerprint(contentHash,presentationHash);const article={...content,approval:{version:version.version_number,editorial:true,clinical:true,contentHash,presentationHash,releaseHash}};
  return {schemaVersion:1,kind:'karyne-blog-approved-snapshot',exportedAt:new Date().toISOString(),articleId,articleVersionId:version.id,content_sha256:contentHash,presentation_sha256:presentationHash,release_sha256:releaseHash,article,reviews:{editorial:{reviewed_at:approvals.latest.editorial.reviewed_at,recorded_by_user_id:approvals.latest.editorial.recorded_by_user_id||null},clinical:{reviewed_at:approvals.latest.clinical.reviewed_at,reviewer_name:approvals.latest.clinical.reviewer_name||null,recorded_by_user_id:approvals.latest.clinical.recorded_by_user_id||null}}};
}

export async function getAutomationControl(){const r=await db().from('editorial_automation_control').select('*').eq('automation_key','gsc').maybeSingle();if(r.error)throw new Error('Falha ao ler controle de automação');return r.data||{automation_key:'gsc',operator_paused:false,pause_reason:null,changed_at:null,revision:0};}
export async function setAutomationControl(input:any,actorUserId:string){if(!isUuid(input.operationKey)||!isUuid(actorUserId)||typeof input.paused!=='boolean'||!Number.isInteger(input.expectedRevision)||input.expectedRevision<1)throw new Error('Operação inválida');const request={operationKey:input.operationKey,actorUserId,requestSha256:'',expectedRevision:input.expectedRevision,paused:input.paused,reason:cleanText(input.reason,600)};if(request.paused&&request.reason.length<3)throw new Error('Informe o motivo da pausa');request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});const r=await db().rpc('editorial_phase6_set_automation',{p_input:request});if(r.error)throw new Error(r.error.message.includes('mudou')?'Controle mudou; atualize antes de tentar novamente':'Falha ao alterar automação');return r.data;}

export async function setPublishIntent(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.operationKey)||!isUuid(input.versionId)||!isSha(input.contentSha256)||!isSha(input.presentationSha256)||!['auto','hold'].includes(input.intent))throw new Error('Intenção de publicação inválida');
  const releaseSha256=releaseFingerprint(input.contentSha256,input.presentationSha256);
  const request={operationKey:input.operationKey,actorUserId,versionId:input.versionId,contentSha256:input.contentSha256,presentationSha256:input.presentationSha256,releaseSha256,intent:input.intent,requestSha256:''};
  request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase7_set_publish_intent',{p_input:request});
  if(result.error)throw new Error(result.error.message.includes('etapa critica')?'A publicação desta versão já começou; espere terminar antes de mudar a escolha':result.error.message.includes('superada')?'A versão mudou; recarregue antes de escolher a publicação':'Falha ao salvar intenção de publicação');
  const value=result.data;if(value?.publicationOperationId)value.dispatch=await dispatchPublicationOperation(value.publicationOperationId);return value;
}

export async function queueArticlePublication(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.operationKey)||!isUuid(input.articleId)||!isUuid(input.versionId)||!isSha(input.contentSha256)||!isSha(input.presentationSha256))throw new Error('Publicação manual inválida');
  const releaseSha256=releaseFingerprint(input.contentSha256,input.presentationSha256);
  const request={operationKey:input.operationKey,actorUserId,articleId:input.articleId,versionId:input.versionId,contentSha256:input.contentSha256,presentationSha256:input.presentationSha256,releaseSha256,requestSha256:''};
  request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase7_queue_publication',{p_input:request});
  if(result.error)throw new Error(result.error.message.includes('aprovacoes')?'Aprovações editorial e clínica atuais são obrigatórias':result.error.message.includes('superada')?'A versão mudou; recarregue antes de publicar':'Falha ao enfileirar publicação');
  const value=result.data;if(value?.publicationOperationId)value.dispatch=await dispatchPublicationOperation(value.publicationOperationId);return value;
}

export async function retryArticlePublication(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.operationKey)||!isUuid(input.publicationOperationId))throw new Error('Nova tentativa de publicação inválida');
  const request={operationKey:input.operationKey,actorUserId,publicationOperationId:input.publicationOperationId,requestSha256:''};request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase7_retry_publication',{p_input:request});
  if(result.error)throw new Error(result.error.message.includes('limite')?'Limite de tentativas de publicação atingido':result.error.message.includes('falha conhecida')?'Só dá para tentar de novo depois de uma falha confirmada; este resultado ainda precisa ser conferido':'Falha ao preparar nova tentativa de publicação');
  const value=result.data;if(value?.publicationOperationId)value.dispatch=await dispatchPublicationOperation(value.publicationOperationId);return value;
}

export async function getPublicationAutomationControl(){return getPublicationControl();}
export async function setPublicationAutomationControl(input:any,actorUserId:string){return setPublicationControl(input,actorUserId);}

export async function renderPrivatePreview(input:any) {
  const editable=validateEditableArticle({...input.article,presentation:input.presentation??input.article?.presentation,slug:input.article?.slug||'previa-privada'});
  const {renderArticle}=await import('../scripts/blog/core.mjs');
  const publications=await db().from('editorial_publications').select('article_id').eq('publication_status','published');
  if(publications.error) throw new Error('Falha ao carregar links da prévia');
  const ids=(publications.data||[]).map(p=>p.article_id);
  const result=ids.length?await db().from('editorial_articles').select('target_slug').in('id',ids):{data:[],error:null};
  if(result.error) throw new Error('Falha ao carregar links da prévia');
  const article={...editable,id:'private-preview',version:1,status:'draft',author:'Dra. Karyne Magalhães'};
  return renderArticle(article,{preview:true,availableSlugs:new Set((result.data||[]).map(a=>a.target_slug)),relatedArticles:[]})
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
}
