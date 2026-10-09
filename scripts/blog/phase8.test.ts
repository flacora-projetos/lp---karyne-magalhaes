import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {contentFingerprint as coreContentFingerprint, presentationFingerprint as corePresentationFingerprint, readArticles, renderArticle} from './core.mjs';
import {buildSnapshotRelease} from './phase6-release.mjs';
import {materializePublicationSnapshot} from './phase7-publish.mjs';
import {articleOrigin, buildOriginalRequest, canonicalContentPayload, canonicalPresentation, contentFingerprint, createOriginalFingerprint, getLegacyCounts, presentationFingerprint, releaseFingerprint, validateEditableArticle} from '../../lib/blogAdmin.ts';
import {ORIGINAL_RESPONSE_SCHEMA, validateOriginalBriefing, validateOriginalDraft} from '../../lib/editorialDraft.mjs';
import adminHandler from '../../api/blog-admin.ts';
import editorialDraftHandler from '../../api/editorial-draft.ts';

// Serviços simulados: Supabase REST/RPC e provedores de IA são respostas locais. Nada aqui toca produção.
process.env.SUPABASE_URL='https://supabase-preview.test';
process.env.SUPABASE_SERVICE_ROLE_KEY='fake-service-role-key-for-tests';
process.env.DEEPSEEK_API_KEY='fake-deepseek';process.env.DEEPSEEK_MODEL='deepseek-test';
process.env.OPENROUTER_API_KEY='fake-openrouter';process.env.OPENROUTER_MODEL='openrouter-test';
delete process.env.ADMIN_EMAILS;

const ACTOR='5f0e6a3c-1b2d-4c5e-8f90-123456789abc';
const OP='123e4567-e89b-42d3-a456-426614174000';
const OP2='123e4567-e89b-42d3-a456-426614174099';
const REFS=[{title:'Diretriz sobre halitose',url:'https://example.org/halitose',supports:'Causas comuns do mau hálito matinal',verifiedAt:'2026-10-09'}];
const BRIEFING={topic:'Mau hálito ao acordar',objective:'Explicar quando o hálito matinal é esperado',searchIntent:'Informacional',editorialContribution:'Orientar próximos passos seguros',allowedInternalLinks:['/']};

function sha(value:string){return crypto.createHash('sha256').update(value).digest('hex');}
function response(){return {code:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v;},status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};}
function validArticle(overrides:any={}){
  return {title:'Mau hálito ao acordar: o que é normal',description:'Quando o hálito da manhã é esperado e quando vale procurar avaliação.',slug:'mau-halito-ao-acordar-o-que-e-normal',
    body:[{type:'h2',text:'O que acontece durante o sono'},{type:'p',text:'Durante a noite a produção de saliva diminui.'}],references:REFS.map(({title,url,supports,verifiedAt})=>({title,url,supports,verifiedAt})),
    internalLinks:[{label:'Conheça a avaliação',url:'/'}],presentation:{kind:'none',subject:'sem-imagem-adequada',reason:'Nenhuma imagem aprovada combina com o tema.'},ctaLabel:'Conhecer a avaliação inicial',...overrides};
}
function aiDraft(overrides:any={}){
  return {workingTitle:'Mau hálito ao acordar: o que é esperado',targetSlug:'mau-halito-ao-acordar',description:'Entenda o hálito matinal.',searchIntent:'Informacional',editorialContribution:'Orientação prudente',
    body:[{type:'h2',text:'Introdução'},{type:'p',text:'Parágrafo 1'},{type:'h2',text:'Causas'},{type:'p',text:'Parágrafo 2'},{type:'h2',text:'Quando procurar'},{type:'p',text:'Parágrafo 3'}],
    internalLinks:[{label:'Início',url:'/'}],references:[{title:REFS[0].title,url:REFS[0].url,supports:REFS[0].supports}],clinicalReviewPending:true,reviewPending:['Revisão clínica das afirmações'],
    presentationSuggestion:{subject:'sem-imagem-adequada',decision:'no_adequate_image',notes:'Sem imagem adequada'},...overrides};
}

type Call={url:string;method:string;body:any;table?:string;rpc?:string};
// Roteador simulado do Supabase: cada teste define respostas por tabela/RPC e lê as chamadas registradas.
function fakeSupabase(routes:{user?:any;tables?:Record<string,(call:Call)=>any>;rpc?:Record<string,(body:any)=>any>;provider?:(url:string,body:any)=>Response|Promise<Response>}={}){
  const calls:Call[]=[];const original=globalThis.fetch;
  globalThis.fetch=(async(input:any,init:any={})=>{
    const url=String(input);const method=String(init.method||'GET').toUpperCase();let body:any=null;try{body=init.body?JSON.parse(String(init.body)):null;}catch{body=init.body;}
    const call:Call={url,method,body};calls.push(call);
    if(url.includes('/auth/v1/user')){const user=routes.user===undefined?{id:ACTOR,email:'flacora@gmail.com'}:routes.user;return new Response(JSON.stringify(user),{status:user?200:401,headers:{'Content-Type':'application/json'}});}
    const rpc=url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/);
    if(rpc){call.rpc=rpc[1];const handler=routes.rpc?.[rpc[1]];if(!handler)throw new Error(`RPC não esperada: ${rpc[1]}`);const out=handler(body);
      if(out?.error)return new Response(JSON.stringify(out.error),{status:400,headers:{'Content-Type':'application/json'}});
      return new Response(JSON.stringify(out),{headers:{'Content-Type':'application/json'}});}
    const table=url.match(/\/rest\/v1\/([a-z_]+)/);
    if(table){call.table=table[1];const handler=routes.tables?.[table[1]];const out=handler?handler(call):[];
      if(out instanceof Response)return out;
      if(method==='HEAD'||out?.count!==undefined)return new Response(null,{status:200,headers:{'Content-Range':`*/${out?.count??0}`}});
      return new Response(JSON.stringify(out),{status:method==='POST'?201:200,headers:{'Content-Type':'application/json'}});}
    if(routes.provider&&/deepseek|openrouter/.test(url))return routes.provider(url,body);
    throw new Error(`Chamada externa não simulada: ${method} ${url}`);
  }) as any;
  return {calls,restore(){globalThis.fetch=original;}};
}
function providerJson(content:any,model='deepseek-test'){return new Response(JSON.stringify({id:'resp-1',model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{total_tokens:10}}),{headers:{'Content-Type':'application/json'}});}
const auth={authorization:'Bearer test-session'};

test('Fase 8: criação original exige sessão autorizada antes de tocar no banco', async()=>{
  const anon=fakeSupabase();
  try{const res=response();await adminHandler({method:'POST',headers:{},query:{},body:{action:'create-original',operationKey:OP,article:validArticle()}} as any,res as any);
    assert.equal(res.code,401);assert.equal(anon.calls.length,0);}finally{anon.restore();}
  const outsider=fakeSupabase({user:{id:ACTOR,email:'pessoa@externa.test'}});
  try{const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'create-original',operationKey:OP,article:validArticle()}} as any,res as any);
    assert.equal(res.code,403);assert.equal(outsider.calls.filter(c=>c.rpc||c.table).length,0);}finally{outsider.restore();}
});

test('Fase 8: conteúdo inválido, fonte legado ou imagem fora do acervo não criam artigo original', async()=>{
  for(const [article,expected,extra] of [
    [validArticle({description:''}),'Campo de texto obrigatório',{}],
    [validArticle({slug:'Endereço Inválido'}),'Slug inválido',{}],
    [validArticle({presentation:{kind:'image',image:{file:'foto-qualquer.jpg',caption:'x'}}}),'Imagem fora do acervo aprovado',{}],
    [validArticle({references:[{title:'x',url:'javascript:alert(1)'}]}),'Referência externa inválida',{}],
    [validArticle(),'Artigo original não aceita fonte legado',{sourceId:'12059'}],
  ] as const){
    const fake=fakeSupabase();
    try{const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'create-original',operationKey:OP,article,...extra}} as any,res as any);
      assert.equal(res.code,400);assert.equal(res.body.error,expected);
      assert.equal(fake.calls.some(c=>c.rpc||c.table),false,'nenhuma leitura/gravação editorial antes da validação');}finally{fake.restore();}
  }
});

test('Fase 8: artigo original manual é salvo sem fonte, sem IA, sem aprovação e sem publicação', async()=>{
  delete process.env.DEEPSEEK_API_KEY;delete process.env.OPENROUTER_API_KEY;
  let rpcInput:any=null;
  const fake=fakeSupabase({tables:{editorial_admin_audit:()=>[]},rpc:{editorial_phase8_create_original:(body)=>{rpcInput=body.p_input;return {articleId:body.p_input.articleId,versionId:'aaaaaaaa-1111-4111-8111-111111111111',versionNumber:1,originKind:'original_manual',reused:false};}}});
  try{
    const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'create-original',operationKey:OP,article:validArticle(),changeNote:'Primeira versão'}} as any,res as any);
    assert.equal(res.code,200);assert.equal(res.body.result.originKind,'original_manual');
    assert.equal(fake.calls.filter(c=>c.rpc).length,1);assert.equal(fake.calls.some(c=>/deepseek|openrouter/.test(c.url)),false);
    assert.equal(fake.calls.some(c=>c.table==='editorial_sources'||c.table==='editorial_article_sources'),false);
    assert.equal(rpcInput.originKind,'original_manual');assert.equal(rpcInput.actorUserId,ACTOR);assert.equal(rpcInput.draftOperationKey,null);
    assert.equal(rpcInput.contentPayload.sourceId,null);assert.equal(rpcInput.contentPayload.id,rpcInput.articleId);assert.equal(rpcInput.contentPayload.status,'draft');
    assert.equal(rpcInput.contentPayload.slug,'mau-halito-ao-acordar-o-que-e-normal');assert.equal(rpcInput.targetSlug,rpcInput.contentPayload.slug);
    assert.equal('approval' in rpcInput.contentPayload,false);assert.equal(JSON.stringify(rpcInput).includes('"approved"'),false);
    assert.equal(rpcInput.contentSha256,coreContentFingerprint(rpcInput.contentPayload),'hash compatível com o renderer estático');
    assert.equal(rpcInput.presentationSha256,corePresentationFingerprint({presentation:rpcInput.presentationPayload}));
    assert.equal(rpcInput.presentationPayload.reviewStatus,'reviewed');
  }finally{fake.restore();process.env.DEEPSEEK_API_KEY='fake-deepseek';process.env.OPENROUTER_API_KEY='fake-openrouter';}
});

test('Fase 8: repetição da criação devolve o mesmo artigo e chave reutilizada com outro conteúdo é recusada', async()=>{
  const editable=validateEditableArticle(validArticle());const stored={articleId:'bbbbbbbb-1111-4111-8111-111111111111',versionId:'cccccccc-1111-4111-8111-111111111111',versionNumber:1,originKind:'original_manual',reused:false};
  const audit={request_sha256:createOriginalFingerprint(editable,''),actor_user_id:ACTOR,operation_type:'create_original',result_json:stored};
  const fake=fakeSupabase({tables:{editorial_admin_audit:()=>[audit]},rpc:{}});
  try{
    const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'create-original',operationKey:OP,article:validArticle()}} as any,res as any);
    assert.equal(res.code,200);assert.equal(res.body.result.articleId,stored.articleId);assert.equal(res.body.result.reused,true);
    const other=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'create-original',operationKey:OP,article:validArticle({title:'Outro título do artigo'})}} as any,other as any);
    assert.equal(other.body.error,'Identificador já usado para outra operação');
    assert.equal(fake.calls.filter(c=>c.rpc).length,0,'resposta perdida não cria segundo artigo');
  }finally{fake.restore();}
});

test('Fase 8: endereço duplicado ou corrida pelo mesmo endereço retorna conflito sem sobrescrever', async()=>{
  for(const error of [{code:'P0001',message:'slug ja pertence a outro artigo'},{code:'23505',message:'duplicate key value violates unique constraint "editorial_articles_target_slug_key"'}]){
    const fake=fakeSupabase({tables:{editorial_admin_audit:()=>[]},rpc:{editorial_phase8_create_original:()=>({error})}});
    try{const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'create-original',operationKey:OP,article:validArticle()}} as any,res as any);
      assert.equal(res.code,409);assert.equal(res.body.error,'Este slug já existe no acervo editorial');}finally{fake.restore();}
  }
});

test('Fase 8: pauta original inválida não inicia geração nem cobrança', async()=>{
  for(const body of [
    {mode:'original',briefing:{...BRIEFING,topic:''},references:REFS,operationKey:OP},
    {mode:'original',briefing:BRIEFING,references:[{...REFS[0],verifiedAt:''}],operationKey:OP},
    {mode:'original',briefing:{...BRIEFING,allowedInternalLinks:['https://externo.test/']},references:REFS,operationKey:OP},
    {mode:'original',sourceId:'12059',briefing:BRIEFING,references:REFS,operationKey:OP},
    {mode:'original',briefing:BRIEFING,references:[],operationKey:OP},
  ]){
    const fake=fakeSupabase({tables:{editorial_drafts:()=>[]},provider:()=>{throw new Error('provedor não deve ser chamado');}});
    try{const res=response();await editorialDraftHandler({method:'POST',headers:auth,body} as any,res as any);
      assert.equal(res.code,400);assert.equal(res.body.generationNotStarted,true);
      assert.equal(fake.calls.some(c=>c.table==='editorial_drafts'&&c.method==='POST'),false);
      assert.equal(fake.calls.some(c=>/deepseek|openrouter/.test(c.url)),false);}finally{fake.restore();}
  }
  assert.throws(()=>validateOriginalBriefing({...BRIEFING,sourceId:'1'},REFS),/não aceita fonte/);
});

test('Fase 8: pauta original gera rascunho privado sem fonte, com revisão clínica pendente e uma única chamada', async()=>{
  let inserted:any=null;let saved:any=null;let prompt='';
  const fake=fakeSupabase({tables:{editorial_drafts:(call)=>{if(call.method==='GET')return [];if(call.method==='POST'){inserted=call.body;return [];}saved=call.body;return [{operation_key:OP}];}},
    provider:(url,body)=>{prompt=body.messages[1].content;return providerJson(aiDraft());}});
  try{
    const res=response();await editorialDraftHandler({method:'POST',headers:auth,body:{mode:'original',briefing:BRIEFING,references:REFS,operationKey:OP}} as any,res as any);
    assert.equal(res.code,201);
    assert.equal(inserted.source_id,null);assert.equal(inserted.draft_kind,'original');assert.equal(inserted.status,'generating');
    assert.equal(fake.calls.some(c=>c.table==='editorial_sources'),false,'nenhuma fonte legado é consultada');
    assert.equal(fake.calls.filter(c=>/deepseek|openrouter/.test(c.url)).length,1);
    assert.match(prompt,/Não existe texto legado/);assert.doesNotMatch(prompt,/FONTE LEGADA/);assert.match(prompt,/Não invente fatos clínicos/);
    assert.equal(saved.status,'draft');assert.deepEqual(saved.payload_json.approval,{editorial:false,clinical:false,client:false});
    assert.equal(saved.payload_json.clinicalReviewPending,true);assert.equal(saved.payload_json.origin,'original');assert.equal('sourceId' in saved.payload_json,false);
  }finally{fake.restore();}
});

test('Fase 8: IA que inventa referência é recusada sem repetir em outro provedor', async()=>{
  let updated:any=null;
  const fake=fakeSupabase({tables:{editorial_drafts:(call)=>{if(call.method==='PATCH'){updated=call.body;return [];}return [];}},
    provider:()=>providerJson(aiDraft({references:[{title:'Inventada',url:'https://inventada.test/estudo',supports:'Eficácia de 90%'}]}))});
  try{const res=response();await editorialDraftHandler({method:'POST',headers:auth,body:{mode:'original',briefing:BRIEFING,references:REFS,operationKey:OP}} as any,res as any);
    assert.equal(res.code,502);assert.equal(updated.status,'failed');assert.equal(fake.calls.filter(c=>/deepseek|openrouter/.test(c.url)).length,1);}finally{fake.restore();}
  assert.throws(()=>validateOriginalDraft(aiDraft({clinicalReviewPending:false}),{briefing:BRIEFING,references:REFS}),/clinicalReviewPending/);
  assert.throws(()=>validateOriginalDraft({...aiDraft(),sourceId:'12059'},{briefing:BRIEFING,references:REFS}),/não permitido/);
  assert.equal(ORIGINAL_RESPONSE_SCHEMA.required.includes('sourceId'),false);
});

test('Fase 8: resposta perdida da IA fica incerta e nova tentativa com a mesma operação não chama a IA de novo', async()=>{
  let row:any=null;
  const fake=fakeSupabase({tables:{editorial_drafts:(call)=>{if(call.method==='GET')return row?[row]:[];if(call.method==='POST'){row={...call.body};return [];}row={...row,...call.body};return [];}},
    provider:()=>{throw new TypeError('conexão encerrada');}});
  try{
    const first=response();await editorialDraftHandler({method:'POST',headers:auth,body:{mode:'original',briefing:BRIEFING,references:REFS,operationKey:OP}} as any,first as any);
    assert.equal(first.code,202);assert.equal(first.body.status,'uncertain');assert.equal(row.status,'uncertain');
    const again=response();await editorialDraftHandler({method:'POST',headers:auth,body:{mode:'original',briefing:BRIEFING,references:REFS,operationKey:OP}} as any,again as any);
    assert.equal(again.code,202);assert.equal(again.body.reconciliationRequired,true);
    assert.equal(fake.calls.filter(c=>/deepseek|openrouter/.test(c.url)).length,1,'sem segunda cobrança');
  }finally{fake.restore();}
});

test('Fase 8: mesma pauta já pendente em outra aba retorna conflito sem chamar a IA', async()=>{
  const fake=fakeSupabase({tables:{editorial_drafts:(call)=>call.method==='POST'?new Response(JSON.stringify({code:'23505',message:'duplicate key value violates unique constraint "editorial_drafts_active_original_request"'}),{status:409,headers:{'Content-Type':'application/json'}}):[]},
    provider:()=>{throw new Error('provedor não deve ser chamado');}});
  try{const res=response();await editorialDraftHandler({method:'POST',headers:auth,body:{mode:'original',briefing:BRIEFING,references:REFS,operationKey:OP2}} as any,res as any);
    assert.equal(res.code,409);assert.equal(res.body.generationNotStarted,true);assert.match(res.body.error,/pauta já possui geração pendente/);
    assert.equal(fake.calls.some(c=>/deepseek|openrouter/.test(c.url)),false);}finally{fake.restore();}
});

test('Fase 8: adaptação do legado mantém o mesmo contrato e reconhece rascunhos anteriores', async()=>{
  const legacyBody={sourceId:'12059',briefing:{objective:'x',allowedInternalLinks:['/']},references:REFS};
  const legacyHash=sha(JSON.stringify(legacyBody));
  const fake=fakeSupabase({tables:{editorial_drafts:()=>[{operation_key:OP,status:'draft',request_sha256:legacyHash,draft_kind:'legacy_adaptation',payload_json:{workingTitle:'Antigo'}}]}});
  try{const res=response();await editorialDraftHandler({method:'POST',headers:auth,body:{...legacyBody,operationKey:OP}} as any,res as any);
    assert.equal(res.code,200);assert.equal(res.body.reused,true);}finally{fake.restore();}
});

test('Fase 8: rascunho de pauta original vira artigo sem fonte e repetição não duplica a promoção', async()=>{
  const draftRow={operation_key:OP2,status:'draft',draft_kind:'original',source_id:null,promoted_article_id:null,promoted_version_id:null,payload_json:{...aiDraft(),origin:'original',topic:BRIEFING.topic,approval:{editorial:false,clinical:false,client:false}}};
  let rpcInput:any=null;
  const fake=fakeSupabase({tables:{editorial_drafts:()=>[draftRow],editorial_admin_audit:()=>[]},rpc:{editorial_phase8_create_original:(body)=>{rpcInput=body.p_input;return {articleId:body.p_input.articleId,versionId:'dddddddd-1111-4111-8111-111111111111',versionNumber:1,originKind:'original_ai',reused:false};}}});
  try{
    const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'promote-draft',draftOperationKey:OP2,operationKey:OP}} as any,res as any);
    assert.equal(res.code,200);assert.equal(rpcInput.originKind,'original_ai');assert.equal(rpcInput.draftOperationKey,OP2);assert.equal(rpcInput.contentPayload.sourceId,null);
    assert.equal(rpcInput.presentationPayload.kind,'none');assert.equal(rpcInput.topicCluster,BRIEFING.topic);
    assert.equal(fake.calls.some(c=>c.table==='editorial_sources'||c.rpc==='editorial_phase6_promote_draft'),false);
  }finally{fake.restore();}
  const promoted=fakeSupabase({tables:{editorial_drafts:()=>[{...draftRow,promoted_article_id:'eeeeeeee-1111-4111-8111-111111111111',promoted_version_id:'ffffffff-1111-4111-8111-111111111111'}],editorial_admin_audit:()=>[]},rpc:{}});
  try{const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'promote-draft',draftOperationKey:OP2,operationKey:OP2}} as any,res as any);
    assert.equal(res.code,200);assert.equal(res.body.result.reused,true);assert.equal(res.body.result.articleId,'eeeeeeee-1111-4111-8111-111111111111');
    assert.equal(promoted.calls.filter(c=>c.rpc).length,0);}finally{promoted.restore();}
});

test('Fase 8: editar um original mantém a ausência de fonte e não leva aprovação à nova versão', async()=>{
  const articleId='aaaaaaaa-2222-4222-8222-222222222222';const versionId='aaaaaaaa-3333-4333-8333-333333333333';
  const request=buildOriginalRequest({articleId,operationKey:OP,actorUserId:ACTOR,requestSha256:'0'.repeat(64),originKind:'original_manual',editable:validateEditableArticle(validArticle()),now:'2026-10-09T18:00:00.000Z'});
  const version={id:versionId,article_id:articleId,version_number:1,title:request.title,content_payload_json:request.contentPayload,content_sha256:request.contentSha256,presentation_payload_json:request.presentationPayload,presentation_sha256:request.presentationSha256};
  let rpcInput:any=null;
  const fake=fakeSupabase({tables:{editorial_admin_audit:()=>[],editorial_articles:()=>[{id:articleId,source_id:null,origin_kind:'original_manual',target_slug:request.targetSlug,working_title:request.title,status:'aprovado'}],
    editorial_versions:()=>[version],editorial_reviews:()=>[{id:'r1',article_version_id:versionId,review_type:'editorial',status:'approved',reviewed_at:'2026-10-09T18:10:00Z',content_sha256:request.contentSha256,presentation_sha256:request.presentationSha256}]},
    rpc:{editorial_phase7_save_version:(body)=>{rpcInput=body.p_input;return {articleId,versionId:'aaaaaaaa-4444-4444-8444-444444444444',versionNumber:2};}}});
  try{
    const res=response();await adminHandler({method:'POST',headers:auth,query:{},body:{action:'save-version',articleId,expectedVersionId:versionId,expectedVersionNumber:1,operationKey:OP2,article:{...validArticle(),title:'Título corrigido do artigo'},changeNote:'Correção'}} as any,res as any);
    assert.equal(res.code,200);assert.equal(rpcInput.contentPayload.sourceId,null);assert.equal(rpcInput.contentPayload.version,2);assert.equal(rpcInput.contentPayload.id,articleId);
    assert.notEqual(rpcInput.contentSha256,request.contentSha256,'aprovação da versão anterior não vale para o novo hash');
    assert.equal(JSON.stringify(rpcInput).includes('approved'),false);
  }finally{fake.restore();}
});

test('Fase 8: contagens do acervo legado são reais e indisponibilidade não vira zero', async()=>{
  const fake=fakeSupabase({tables:{editorial_sources:(call)=>({count:call.url.includes('normalized_body_text')?6:129})}});
  try{assert.deepEqual(await getLegacyCounts(),{legacy_sources:129,legacy_sources_without_text:6});
    const filters=fake.calls.filter(c=>c.table==='editorial_sources').map(c=>decodeURIComponent(c.url));
    assert.ok(filters.every(u=>u.includes('source_system=eq.wordpress_karyne')));assert.ok(filters.some(u=>u.includes('normalized_body_text.is.null')));}finally{fake.restore();}
  const broken=fakeSupabase({tables:{editorial_sources:()=>new Response(JSON.stringify({message:'indisponível'}),{status:400,headers:{'Content-Type':'application/json'}})}});
  try{assert.deepEqual(await getLegacyCounts(),{legacy_sources:null,legacy_sources_without_text:null});}finally{broken.restore();}
});

test('Fase 8: origem compreensível sem inventar vínculo legado', ()=>{
  assert.equal(articleOrigin({origin_kind:'original_ai',source_id:null}),'original_ai');
  assert.equal(articleOrigin({origin_kind:'original_manual',source_id:null}),'original_manual');
  assert.equal(articleOrigin({origin_kind:null,source_id:'aaaaaaaa-1111-4111-8111-111111111111'}),'legacy_adaptation');
  assert.equal(articleOrigin({origin_kind:null,source_id:null}),null);
});

test('Fase 8: original aprovado percorre exportação, materialização e build sem fonte legado e preserva os três artigos', ()=>{
  const articleId='aaaaaaaa-5555-4555-8555-555555555555';const versionId='aaaaaaaa-6666-4666-8666-666666666666';
  const request=buildOriginalRequest({articleId,operationKey:OP,actorUserId:ACTOR,requestSha256:'0'.repeat(64),originKind:'original_manual',editable:validateEditableArticle(validArticle()),now:'2026-10-09T18:00:00.000Z'});
  // Mesmo cálculo da exportação do painel após leitura JSONB.
  const content={...canonicalContentPayload(request.contentPayload),status:'approved',presentation:canonicalPresentation(request.presentationPayload)};
  assert.equal(contentFingerprint(content),request.contentSha256);assert.equal(presentationFingerprint(request.presentationPayload),request.presentationSha256);
  const releaseHash=releaseFingerprint(request.contentSha256,request.presentationSha256);
  // Snapshot montado como a função da Fase 7: conteúdo || status/apresentação/aprovação.
  const snapshot={schemaVersion:1,kind:'karyne-blog-publication-snapshot',articleId,articleVersionId:versionId,content_sha256:request.contentSha256,presentation_sha256:request.presentationSha256,release_sha256:releaseHash,
    article:{...request.contentPayload,status:'approved',presentation:request.presentationPayload,approval:{version:1,editorial:true,clinical:true,contentHash:request.contentSha256,presentationHash:request.presentationSha256,releaseHash}}};
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'karyne-f8-'));const input=path.join(tmp,'published');fs.mkdirSync(input,{recursive:true});
  const before=new Map<string,string>();
  for(const name of fs.readdirSync('content/blog/published'))if(name.endsWith('.json')){fs.copyFileSync(path.join('content/blog/published',name),path.join(input,name));before.set(name,fs.readFileSync(path.join(input,name),'utf8'));}
  try{
    const result=materializePublicationSnapshot(snapshot,input);
    assert.equal(result.legacySource,null);assert.equal(path.basename(result.target),'mau-halito-ao-acordar-o-que-e-normal.json');
    for(const [name,text] of before)assert.equal(fs.readFileSync(path.join(input,name),'utf8'),text,`${name} preservado`);
    const all=readArticles(input);assert.equal(all.length,before.size+1);
    const html=result.release.html;assert.match(html,new RegExp(`data-blog-article="${articleId}"`));assert.match(html,/data-blog-source=""/);
    assert.match(html,/<link rel="canonical" href="https:\/\/tratamentodomauhalito.com.br\/blog\/mau-halito-ao-acordar-o-que-e-normal\/"/);
    const published=JSON.parse(fs.readFileSync(result.target,'utf8'));assert.equal(published.sourceId,null);assert.doesNotMatch(JSON.stringify(published),/reviewer_name|recorded_by_user_id|operationKey/);
    const again=buildSnapshotRelease({...snapshot,kind:'karyne-blog-approved-snapshot'},readArticles('content/blog/published'));
    assert.equal(again.manifest.count,1);assert.equal(again.context.length,before.size+1);
    assert.equal(renderArticle(again.selected,{availableSlugs:new Set(again.context.map((a:any)=>a.slug))}),again.manifest.releases[0].html);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('Fase 8: migration é aditiva, não cria fonte fictícia e restringe a criação ao servidor (verificação estrutural)', ()=>{
  const sql=fs.readFileSync('supabase/migrations/20261009174933_editorial_phase8_original_articles.sql','utf8');
  assert.doesNotMatch(sql,/insert\s+into\s+public\.editorial_sources/i);assert.doesNotMatch(sql,/insert\s+into\s+public\.editorial_article_sources/i);
  assert.doesNotMatch(sql,/update\s+public\.editorial_sources/i);assert.doesNotMatch(sql,/drop\s+table|drop\s+column|delete\s+from/i);
  assert.match(sql,/origin_kind = 'legacy_adaptation' or source_id is null/);
  assert.match(sql,/draft_kind = 'original' and source_id is null/);
  assert.match(sql,/revoke all on function public\.editorial_phase8_create_original\(jsonb\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function public\.editorial_phase8_create_original\(jsonb\) to service_role/);
  assert.doesNotMatch(sql.split('create or replace function public.editorial_phase8_create_original')[1],/editorial_reviews|editorial_publication_intents|editorial_publication_operations|insert into public\.editorial_publications/);
});
