import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin.js';

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

export function contentFingerprintPayload(article:any) {
  return {id:article?.id??null,version:article?.version??null,slug:article?.slug??null,title:article?.title??null,description:article?.description??null,
    body:article?.body??null,ctaLabel:article?.ctaLabel??null,internalLinks:article?.internalLinks??null,references:article?.references??null,
    author:article?.author??null,datePublished:article?.datePublished??null,dateModified:article?.dateModified??null};
}
export function contentFingerprint(article:any){return sha256Json(contentFingerprintPayload(article));}
export function presentationFingerprint(presentation:any){return sha256Json(presentation);}
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
  const [v,p,g]=await Promise.all([
    db().from('editorial_versions').select('id,article_id,version_number,title,created_at,content_sha256,presentation_sha256').in('article_id',articleIds).order('version_number',{ascending:false}),
    db().from('editorial_publications').select('id,article_id,article_version_id,url,canonical_url,publication_status,published_at,modified_at,last_verified_at').in('article_id',articleIds),
    db().from('editorial_gsc_urls').select('article_id,article_version_id,knowledge_state,action_state,last_inspected_at,next_inspection_at').in('article_id',articleIds),
  ]);
  for(const result of [v,p,g]) if(result.error) throw new Error('Falha ao carregar estado editorial');
  const latestIds:string[]=[]; const seen=new Set<string>(); for(const row of v.data||[]) if(!seen.has(row.article_id)){seen.add(row.article_id);latestIds.push(row.id);}
  const r=latestIds.length?await db().from('editorial_reviews').select('id,article_version_id,review_type,status,reviewer_name,notes,reviewed_at,created_at,content_sha256,presentation_sha256,evidence_json,recorded_by_user_id').in('article_version_id',latestIds):{data:[],error:null};
  if(r.error) throw new Error('Falha ao carregar revisões');
  return {versions:v.data||[],publications:p.data||[],reviews:r.data||[],gsc:g.data||[]};
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
    return {...article,work_version:latest?.version_number??null,work_version_id:latest?.id??null,public_version:publication?versions.find(v=>v.id===publication.article_version_id)?.version_number??null:null,public_url:publication?.canonical_url||null,approvals:{editorial:approvals.editorial,clinical:approvals.clinical},gsc:gsc?{knowledge_state:gsc.knowledge_state,action_state:gsc.action_state,last_inspected_at:gsc.last_inspected_at,next_inspection_at:gsc.next_inspection_at}:null};
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
  return {article:a.data,versions:versions.data||[],reviews:reviews.data||[],publications:publications.data||[],approvals:{editorial:Boolean(approvalState.editorial),clinical:Boolean(approvalState.clinical)},sources:(sources.data||[]).map((s:any)=>({...s,has_text:Boolean(String(s.normalized_body_text||'').trim()),normalized_body_text:undefined,body_excerpt:String(s.normalized_body_text||'').slice(0,1200)}))};
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
  const [total,published,review,approved,indexed,drafts,actionPending,lastRun,lastScheduledRun,nextInspection,automation]=await Promise.all([
    count('editorial_articles'),count('editorial_publications',q=>q.eq('publication_status','published')),
    count('editorial_articles',q=>q.in('status',['revisao_editorial','revisao_clinica'])),count('editorial_articles',q=>q.eq('status','aprovado')),
    count('editorial_gsc_urls',q=>q.eq('knowledge_state','indexed')),
    count('editorial_drafts',q=>q.is('promoted_article_id',null)),
    count('editorial_gsc_urls',q=>q.eq('action_state','action_required')),
    db().from('editorial_gsc_runs').select('operation_key,run_kind,status,trigger_source,attempts,started_at,finished_at,updated_at,details_json').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db().from('editorial_gsc_runs').select('status,started_at,finished_at,updated_at').eq('trigger_source','scheduled').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db().from('editorial_gsc_urls').select('next_inspection_at').order('next_inspection_at').limit(1).maybeSingle(),
    getAutomationControl(),
  ]);
  if(lastRun.error||lastScheduledRun.error||nextInspection.error) throw new Error('Falha ao ler última automação');
  return {counts:{articles:total,published,drafts,review_pending:review,approved_waiting_publication:approved,indexed,action_pending:actionPending},automation:{...automation,infrastructure_enabled:process.env.BLOG_GSC_AUTOMATION_ENABLED==='true'},last_run:lastRun.data||null,last_scheduled_run:lastScheduledRun.data||null,next_inspection_at:nextInspection.data?.next_inspection_at||null,data_updated_at:new Date().toISOString()};
}

export async function getReviewQueue(params:any={}){return listArticles({...params,statuses:['revisao_editorial','revisao_clinica','aprovado'],pageSize:Math.min(Number(params.pageSize)||20,50)});}

function buildContentPayload(articleId:string,versionNumber:number,article:any,editable:any, previous:any, now:string){return {
  id:previous?.id||articleId,sourceId:previous?.sourceId||article.source_id||null,version:versionNumber,slug:article.target_slug,title:editable.title,description:editable.description,status:'draft',body:editable.body,ctaLabel:editable.ctaLabel,internalLinks:editable.internalLinks,references:editable.references,
  author:previous?.author||'Dra. Karyne Magalhães',datePublished:previous?.datePublished||now,dateModified:now,
};}

export async function saveArticleVersion(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.articleId)||!isUuid(input.expectedVersionId)||!isUuid(input.operationKey)) throw new Error('Identificadores inválidos');
  const detail=await getArticleDetail(input.articleId); const latest=detail.versions[0]; if(!latest||latest.id!==input.expectedVersionId||latest.version_number!==Number(input.expectedVersionNumber)) throw new Error('Conflito de versão; recarregue antes de salvar');
  const editable=validateEditableArticle({...input.article,slug:detail.article.target_slug}); const now=new Date().toISOString(); const next=latest.version_number+1;
  const previous=latest.content_payload_json||{}; const contentPayload=buildContentPayload(detail.article.id,next,detail.article,editable,previous,now);
  const contentSha256=contentFingerprint(contentPayload); const presentationPayload=editable.presentation; const presentationSha256=presentationFingerprint(presentationPayload);
  const request={articleId:detail.article.id,expectedVersionId:latest.id,expectedVersionNumber:latest.version_number,operationKey:input.operationKey,actorUserId,requestSha256:'',targetSlug:detail.article.target_slug,title:editable.title,description:editable.description,body:editable.body,references:editable.references,changeNote:cleanText(input.changeNote,500),contentPayload,contentSha256,presentationPayload,presentationSha256};
  request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase6_save_version',{p_input:request}); if(result.error) throw new Error(result.error.message.includes('conflito de versao')?'Conflito de versão; recarregue antes de salvar':'Falha ao salvar nova versão'); return result.data;
}

export async function promoteDraft(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.draftOperationKey)||!isUuid(input.operationKey)) throw new Error('Identificadores inválidos');
  const d=await db().from('editorial_drafts').select('*').eq('operation_key',input.draftOperationKey).maybeSingle();if(d.error||!d.data)throw new Error('Rascunho não encontrado');if(d.data.status!=='draft'||!d.data.payload_json)throw new Error('Rascunho ainda não está pronto');
  const draft=d.data.payload_json; const source=await db().from('editorial_sources').select('id,external_id').eq('id',d.data.source_id).maybeSingle();if(source.error||!source.data)throw new Error('Fonte do rascunho não encontrada');
  const articleId=String(input.articleId||crypto.randomUUID()); if(!isUuid(articleId))throw new Error('ID do artigo inválido');
  const presentation=input.presentation || (draft.presentationSuggestion?.decision==='no_adequate_image'?{kind:'none',reviewStatus:'reviewed',subject:String(draft.presentationSuggestion.subject||'sem-imagem-adequada'),reason:String(draft.presentationSuggestion.notes||'Sem imagem adequada'),image:null}:null);
  if(!presentation) throw new Error('Escolha uma apresentação no editor antes de promover este rascunho');
  const editable=validateEditableArticle({title:draft.workingTitle,description:draft.description,slug:draft.targetSlug,body:draft.body,references:draft.references,internalLinks:draft.internalLinks,presentation,ctaLabel:'Conhecer a avaliação inicial'});
  const now=new Date().toISOString(); const article={id:articleId,source_id:d.data.source_id,target_slug:editable.slug}; const contentPayload=buildContentPayload(articleId,1,article,editable,{sourceId:source.data.external_id},now); const contentSha256=contentFingerprint(contentPayload); const presentationSha256=presentationFingerprint(editable.presentation);
  const request={draftOperationKey:input.draftOperationKey,operationKey:input.operationKey,actorUserId,articleId,requestSha256:'',targetSlug:editable.slug,title:editable.title,description:editable.description,body:editable.body,references:editable.references,topicCluster:cleanText(draft.editorialContribution||'',240),searchIntent:cleanText(draft.searchIntent||'',240),serviceRelation:'halitose',contentPayload,contentSha256,presentationPayload:editable.presentation,presentationSha256};request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase6_promote_draft',{p_input:request});if(result.error)throw new Error(result.error.message.includes('slug ja')?'Este slug já existe no acervo editorial':'Falha ao criar versão editável');return result.data;
}

export async function recordReview(input:any,actorUserId:string){
  if(!isUuid(actorUserId)||!isUuid(input.versionId)||!isUuid(input.operationKey)||!isSha(input.contentSha256)||!isSha(input.presentationSha256))throw new Error('Dados da revisão inválidos');
  if(!['editorial','clinical'].includes(input.reviewType)||!['approved','changes_requested'].includes(input.decision))throw new Error('Decisão de revisão inválida');
  const request={operationKey:input.operationKey,actorUserId,versionId:input.versionId,requestSha256:'',reviewType:input.reviewType,decision:input.decision,contentSha256:input.contentSha256,presentationSha256:input.presentationSha256,reviewerName:cleanText(input.reviewerName,180),notes:cleanText(input.notes,1200),evidence:input.evidence&&typeof input.evidence==='object'?input.evidence:{}};request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});
  const result=await db().rpc('editorial_phase6_record_review',{p_input:request});if(result.error)throw new Error(result.error.message.includes('versao de trabalho')?'A revisão ficou desatualizada; recarregue a fila':'Falha ao registrar revisão');return result.data;
}

export async function exportApprovedSnapshot(articleId:string,versionId:string){
  const detail=await getArticleDetail(articleId);const version=detail.versions.find((v:any)=>v.id===versionId);if(!version)throw new Error('Versão não encontrada');if(detail.versions[0]?.id!==version.id)throw new Error('Somente a versão de trabalho atual pode ser exportada');
  const approvals=exactApprovalState(version,detail.reviews);if(!approvals.editorial||!approvals.clinical)throw new Error('Aprovações editorial e clínica atuais são obrigatórias');
  if(!version.content_payload_json||!version.presentation_payload_json||!isSha(version.content_sha256)||!isSha(version.presentation_sha256))throw new Error('Versão sem payload/hash exportável');
  const content={...version.content_payload_json,status:'approved',presentation:version.presentation_payload_json}; const contentHash=contentFingerprint(content);const presentationHash=presentationFingerprint(version.presentation_payload_json);
  if(contentHash!==version.content_sha256||presentationHash!==version.presentation_sha256)throw new Error('Hashes persistidos não correspondem ao conteúdo exportado');
  const releaseHash=releaseFingerprint(contentHash,presentationHash);const article={...content,approval:{version:version.version_number,editorial:true,clinical:true,contentHash,presentationHash,releaseHash}};
  return {schemaVersion:1,kind:'karyne-blog-approved-snapshot',exportedAt:new Date().toISOString(),articleId,articleVersionId:version.id,content_sha256:contentHash,presentation_sha256:presentationHash,release_sha256:releaseHash,article,reviews:{editorial:{reviewed_at:approvals.latest.editorial.reviewed_at,recorded_by_user_id:approvals.latest.editorial.recorded_by_user_id||null},clinical:{reviewed_at:approvals.latest.clinical.reviewed_at,reviewer_name:approvals.latest.clinical.reviewer_name||null,recorded_by_user_id:approvals.latest.clinical.recorded_by_user_id||null}}};
}

export async function getAutomationControl(){const r=await db().from('editorial_automation_control').select('*').eq('automation_key','gsc').maybeSingle();if(r.error)throw new Error('Falha ao ler controle de automação');return r.data||{automation_key:'gsc',operator_paused:false,pause_reason:null,changed_at:null,revision:0};}
export async function setAutomationControl(input:any,actorUserId:string){if(!isUuid(input.operationKey)||!isUuid(actorUserId))throw new Error('Operação inválida');const request={operationKey:input.operationKey,actorUserId,requestSha256:'',expectedRevision:Number(input.expectedRevision),paused:Boolean(input.paused),reason:cleanText(input.reason,600)};request.requestSha256=sha256Json({...request,requestSha256:undefined,actorUserId:undefined});const r=await db().rpc('editorial_phase6_set_automation',{p_input:request});if(r.error)throw new Error(r.error.message.includes('mudou')?'Controle mudou; atualize antes de tentar novamente':'Falha ao alterar automação');return r.data;}
