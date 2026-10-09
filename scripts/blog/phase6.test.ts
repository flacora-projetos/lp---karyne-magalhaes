import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { contentFingerprint as coreContentFingerprint, presentationFingerprint as corePresentationFingerprint, readArticles } from './core.mjs';
import { buildSnapshotRelease } from './phase6-release.mjs';
import { canonicalContentPayload, canonicalPresentation, contentFingerprint, exactApprovalState, normalizeSearch, parsePage, presentationFingerprint as adminPresentationFingerprint, renderPrivatePreview, saveRequestFingerprint, validateEditableArticle } from '../../lib/blogAdmin.ts';
import { assertVersionApprovals, automationStartDecision, ensureSitemapCurrent, gscDailyOperationKey } from '../../lib/blogGsc.ts';
import adminHandler from '../../api/blog-admin.ts';
import editorialDraftHandler from '../../api/editorial-draft.ts';
import { presentationContract } from './editorial.mjs';

function response() {
  return {code:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v;},status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};
}

test('API da central Blog rejeita acesso anônimo antes de tocar no banco', async () => {
  const originalFetch=globalThis.fetch;
  let fetchCalls=0;
  globalThis.fetch=async()=>{fetchCalls++;throw new Error('Banco não deve ser consultado');};
  try {
    for (const method of ['GET','POST']) {
      const res=response();
      await adminHandler({method,headers:{},query:{view:'overview'},body:{action:'preview'}} as any,res as any);
      assert.equal(res.code,401);
      assert.equal(res.body.error,'Não autenticado');
      assert.equal(res.headers['Cache-Control'],'private, no-store');
      assert.equal(res.headers['X-Robots-Tag'],'noindex, nofollow');
    }
    assert.equal(fetchCalls,0);
  } finally { globalThis.fetch=originalFetch; }
});

test('briefing inválido autenticado é rejeitado sem iniciar geração ou inserir rascunho', async () => {
  const originalFetch=globalThis.fetch;
  const originalUrl=process.env.SUPABASE_URL;
  const originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://supabase-preview.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY='fake-service-role-key-for-tests';
  const calls:{url:string;method:string}[]=[];
  globalThis.fetch=async(input:any,init:any={})=>{
    const url=String(input);
    const method=String(init.method||'GET').toUpperCase();
    calls.push({url,method});
    if(url.includes('/auth/v1/user')&&method==='GET') return new Response(JSON.stringify({id:'test-user',email:'flacora@gmail.com'}),{headers:{'Content-Type':'application/json'}});
    if(url.includes('/rest/v1/editorial_drafts')&&method==='GET') return new Response('[]',{headers:{'Content-Type':'application/json'}});
    throw new Error('Chamada de provider ou gravação indevida');
  };
  try {
    const res=response();
    await editorialDraftHandler({method:'POST',headers:{authorization:'Bearer test-session'},body:{sourceId:'12059',briefing:{objective:''},references:[{title:'Fonte',url:'https://example.org',supports:'contexto',verifiedAt:'2026-10-09'}],operationKey:'123e4567-e89b-42d3-a456-426614174000'}} as any,res as any);
    assert.equal(res.code,400);
    assert.equal(res.body.generationNotStarted,true);
    assert.equal(res.body.error,'Pauta ou referências verificadas incompletas');
    assert.equal(calls.length,2);
    assert.equal(calls.some(call=>call.url.includes('/rest/v1/editorial_drafts')&&call.method==='POST'),false);
    assert.equal(calls.some(call=>/deepseek|openrouter/i.test(call.url)),false);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalUrl===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey;
  }
});

test('paginação administrativa é limitada no servidor e busca é normalizada', () => {
  assert.deepEqual(parsePage({page:'0',pageSize:'999'}),{page:1,pageSize:50,from:0,to:49});
  assert.deepEqual(parsePage({page:'3',pageSize:'20'}),{page:3,pageSize:20,from:40,to:59});
  assert.equal(normalizeSearch('halitose,(teste)%'), 'halitose teste');
});

test('editor aceita somente blocos, referências, links e imagens permitidos', () => {
  const base={title:'Título seguro',description:'Descrição segura',slug:'artigo-seguro',body:[{type:'p',text:'<script>não vira HTML</script>'}],references:[{title:'PubMed',url:'https://pubmed.ncbi.nlm.nih.gov/1/'}],internalLinks:[{label:'Home',url:'/'}],presentation:{kind:'none',subject:'sem-imagem-adequada',reason:'Não existe imagem apropriada para este texto.'}};
  assert.doesNotThrow(()=>validateEditableArticle(base));
  assert.throws(()=>validateEditableArticle({...base,references:[{title:'x',url:'javascript:alert(1)'}]}),/Referência externa inválida/);
  assert.throws(()=>validateEditableArticle({...base,internalLinks:[{label:'x',url:'https://evil.example/'}]}),/Link interno inválido/);
  assert.throws(()=>validateEditableArticle({...base,presentation:{kind:'image',image:{file:'arquivo-inventado.jpg',caption:'x'}}}),/Imagem fora do acervo aprovado/);
});

test('fingerprints do painel são compatíveis com os contratos estáticos existentes', () => {
  const article=readArticles('content/blog/published')[0];
  assert.equal(contentFingerprint(article),coreContentFingerprint(article));
  const editable=validateEditableArticle({title:'Teste',description:'Descrição',slug:'teste',body:[{type:'p',text:'Texto'}],references:[],internalLinks:[],presentation:{kind:'image',subject:'Equipamento no consultório',image:{file:'oralchroma_equipamento.jpg',label:'Equipamento no consultório',alt:'Dra. Karyne junto a equipamento no consultório',caption:'Aparelho apresentado no site da Dra. Karyne como OralChroma. Os exames complementam a avaliação clínica.'}}});
  assert.equal(adminPresentationFingerprint(editable.presentation),corePresentationFingerprint({...article,slug:'slug-sem-legado',presentation:editable.presentation}));
});

test('hashes editoriais permanecem iguais após reordenação JSONB do conteúdo e da apresentação', () => {
  const reorder=(value:any):any=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().reverse().map(key=>[key,reorder(value[key])])):value;
  const articles=readArticles('content/blog/published');
  assert.equal(articles.length,3);
  for (const article of articles) {
    const jsonbContent=reorder(article);
    const canonicalContent=canonicalContentPayload(jsonbContent);
    assert.equal(contentFingerprint(jsonbContent),coreContentFingerprint(article));
    assert.equal(coreContentFingerprint(canonicalContent),coreContentFingerprint(article));

    const contract=presentationContract(article);
    const jsonbPresentation=reorder(contract);
    const canonicalVisual=canonicalPresentation(jsonbPresentation);
    assert.equal(adminPresentationFingerprint(jsonbPresentation),corePresentationFingerprint(article));
    assert.equal(JSON.stringify(canonicalVisual),JSON.stringify(contract));
  }
});

test('fingerprint de salvar versão depende da edição e da versão esperada, não da operação ou do ator', () => {
  const editable=validateEditableArticle({title:'Teste',description:'Descrição',slug:'teste',body:[{type:'p',text:'Texto'}],references:[],internalLinks:[],presentation:{kind:'none',subject:'sem-imagem-adequada',reason:'Sem imagem adequada.'}});
  const base={articleId:'article-1',expectedVersionId:'version-1',expectedVersionNumber:3,operationKey:'op-1',actorUserId:'actor-1',createdAt:'2026-10-09T12:00:00Z',changeNote:'Revisão'};
  const fingerprint=saveRequestFingerprint(base,editable);
  assert.equal(saveRequestFingerprint({...base,operationKey:'op-2',actorUserId:'actor-2',createdAt:'2026-10-10T12:00:00Z'},editable),fingerprint);
  assert.notEqual(saveRequestFingerprint({...base,expectedVersionId:'version-2'},editable),fingerprint);
  assert.notEqual(saveRequestFingerprint(base,{...editable,title:'Outro título'}),fingerprint);
});

test('prévia privada remove scripts e escapa conteúdo editorial com script', async () => {
  const originalFetch=globalThis.fetch;
  const originalUrl=process.env.SUPABASE_URL;
  const originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://supabase-preview.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY='fake-service-role-key-for-tests';
  let fetchCalls=0;
  globalThis.fetch=async(input:any)=>{
    const url=new URL(String(input));
    assert.equal(url.origin,'https://supabase-preview.test');
    fetchCalls++;
    const rows=url.pathname.endsWith('/editorial_publications')?[{article_id:'published-article-id'}]:[{target_slug:'artigo-existente'}];
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const html=await renderPrivatePreview({article:{title:'Teste',description:'Descrição',slug:'teste',body:[{type:'p',text:'Texto <script>alert(1)</script>'}],references:[],internalLinks:[],presentation:{kind:'none',subject:'sem-imagem-adequada',reason:'Sem imagem adequada.'}}});
    assert.doesNotMatch(html,/<script\b/i);
    assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.equal(fetchCalls,2);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalUrl===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey;
  }
});

test('nova versão não herda aprovação e decisão mais recente revoga aprovação anterior', () => {
  const version={id:'v3',content_sha256:'a'.repeat(64),presentation_sha256:'b'.repeat(64)};
  const reviews=[
    {id:'1',article_version_id:'v3',review_type:'editorial',status:'approved',reviewed_at:'2026-10-09T10:00:00Z',content_sha256:version.content_sha256,presentation_sha256:version.presentation_sha256},
    {id:'2',article_version_id:'v3',review_type:'editorial',status:'changes_requested',reviewed_at:'2026-10-09T11:00:00Z',content_sha256:version.content_sha256,presentation_sha256:version.presentation_sha256},
    {id:'3',article_version_id:'v3',review_type:'clinical',status:'approved',reviewed_at:'2026-10-09T10:30:00Z',content_sha256:version.content_sha256,presentation_sha256:version.presentation_sha256},
  ];
  const state=exactApprovalState(version,reviews);
  assert.equal(state.editorial,false);
  assert.equal(state.clinical,true);
  assert.equal(exactApprovalState({...version,id:'v4'},reviews).editorial,false);
  assert.equal(exactApprovalState({...version,id:'v4'},reviews).clinical,false);
});

test('pausa impede início e execução manual/agendada compartilham a mesma chave diária', () => {
  assert.deepEqual(automationStartDecision({operator_paused:true}),{allowed:false,reason:'operator_paused'});
  assert.deepEqual(automationStartDecision({operator_paused:false}),{allowed:true,reason:null});
  const now=new Date('2026-10-09T12:00:00Z');
  assert.equal(gscDailyOperationKey(now),'daily:2026-10-09');
  assert.equal(gscDailyOperationKey(now),gscDailyOperationKey(now));
});

test('snapshot aprovado substitui só a versão selecionada no contexto completo e o HTML bate com o renderer final', () => {
  const published=readArticles('content/blog/published');
  const original=published[0];
  const edited={...original,version:original.version+1,title:`${original.title} — revisão`,dateModified:'2026-10-09T14:00:00.000Z',status:'approved'} as any;
  const contentHash=coreContentFingerprint(edited);
  const presentationHash=corePresentationFingerprint(edited);
  const releaseHash=cryptoHash(JSON.stringify({contentHash,presentationHash}));
  edited.approval={version:edited.version,editorial:true,clinical:true,contentHash,presentationHash,releaseHash};
  const snapshot={schemaVersion:1,kind:'karyne-blog-approved-snapshot',exportedAt:'2026-10-09T14:00:00Z',articleId:'123e4567-e89b-42d3-a456-426614174000',articleVersionId:'123e4567-e89b-42d3-a456-426614174001',content_sha256:contentHash,presentation_sha256:presentationHash,release_sha256:releaseHash,article:edited};
  const result=buildSnapshotRelease(snapshot,published);
  assert.equal(result.manifest.count,1);
  assert.equal(result.selected.version,original.version+1);
  assert.equal(result.context.length,published.length);
  assert.equal(published[0].version,original.version);
  assert.equal(result.manifest.releases[0].html_sha256,cryptoHash(result.manifest.releases[0].html));
  assert.equal(result.manifest.releases[0].operation_key,`publish:${snapshot.articleId}:v${edited.version}:${releaseHash}`);
});

test('aprovações são recusadas quando uma versão posterior já é a versão de trabalho', () => {
  const version={id:'version-2',article_id:'article-1',content_sha256:'a'.repeat(64),presentation_sha256:'b'.repeat(64),version_number:2};
  const review=(review_type:string)=>({review_type,status:'approved',reviewed_at:'2026-10-09T11:00:00Z',content_sha256:version.content_sha256,presentation_sha256:version.presentation_sha256});
  const record={version,article:{id:'article-1',status:'aprovado'},latestVersionId:'version-2',reviews:[review('editorial'),review('clinical')]};
  assert.equal(assertVersionApprovals(record),true);
  assert.throws(()=>assertVersionApprovals({...record,latestVersionId:'version-3'}),/Versão de trabalho superada/);
});

test('pausa antes da reserva não chama dependências do envio do sitemap', async () => {
  const calls:string[]=[];
  const state={last_confirmed_sitemap_sha256:'H1',last_submit_confirmed_at:'2026-10-01T00:00:00Z',last_submit_status:'confirmed'};
  const result=await ensureSitemapCurrent(state,'H2',new Date('2026-10-09T12:00:00Z'),{
    shouldPause:async()=>true,
    upsertGscState:async()=>{calls.push('state');return state;},
    claimGscRun:async()=>{calls.push('claim');return {claimed:true,row:{operation_key:'k'},leaseToken:'token'};},
    finishGscRun:async()=>{calls.push('finish');},
    submitGscSitemap:async()=>{calls.push('submit');},
    getGscSitemap:async()=>{calls.push('read');return {lastSubmitted:null};},
  } as any);
  assert.equal(result.status,'operator_paused');
  assert.deepEqual(calls,[]);
});

test('pausa após a reserva finaliza como skipped antes de gravar incerteza ou enviar', async () => {
  const calls:any[]=[];
  const state={last_confirmed_sitemap_sha256:'H1',last_submit_confirmed_at:'2026-10-01T00:00:00Z',last_submit_status:'confirmed'};
  let pauseChecks=0;
  const result=await ensureSitemapCurrent(state,'H2',new Date('2026-10-09T12:00:00Z'),{
    shouldPause:async()=>++pauseChecks===2,
    upsertGscState:async(row:any)=>{calls.push(['state',row.last_submit_status]);return row;},
    claimGscRun:async(_kind:string,key:string)=>{calls.push(['claim',key]);return {claimed:true,row:{operation_key:key},leaseToken:'token'};},
    finishGscRun:async(key:string,_token:string,status:string,details:any)=>{calls.push(['finish',key,status,details]);},
    submitGscSitemap:async()=>{calls.push(['submit']);},
    getGscSitemap:async()=>{calls.push(['read']);return {lastSubmitted:null};},
  } as any);
  assert.equal(result.status,'operator_paused');
  assert.deepEqual(calls.map(call=>call[0]),['claim','finish']);
  assert.deepEqual(calls[1].slice(2),['skipped',{reason:'operator_paused_before_submit'}]);
});

function cryptoHash(value:string){return crypto.createHash('sha256').update(value).digest('hex');}

test('migration Fase 6 mantém operações privadas, transacionais e idempotentes', () => {
  const migration=fs.readdirSync('supabase/migrations').find(file=>file.endsWith('_editorial_phase6_admin.sql'));
  assert.ok(migration,'migration Fase 6 disponível');
  const sql=fs.readFileSync(`supabase/migrations/${migration}`,'utf8');
  assert.match(sql,/operation_key uuid not null unique/i);
  assert.match(sql,/status in \('generating','draft','failed','uncertain'\)/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/editorial_phase6_promote_draft/i);
  assert.match(sql,/editorial_phase6_save_version/i);
  assert.match(sql,/editorial_phase6_record_review/i);
  assert.match(sql,/editorial_phase6_set_automation/i);
  assert.match(sql,/operator_paused boolean/i);
  assert.match(sql,/trigger_source text/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on public\.editorial_admin_audit, public\.editorial_automation_control from public, anon, authenticated/i);
});

test('adapter da Fase 5 aceita snapshot somente com slug explícito correspondente', () => {
  const source=fs.readFileSync('scripts/blog/phase5-release.mjs','utf8');
  assert.match(source,/--snapshot=/);
  assert.match(source,/args\.slugs\.length !== 1/);
  assert.match(source,/args\.slugs\[0\] !== slug/);
});

test('falha de transporte da IA é persistida como incerta e não como retry automático', () => {
  const source=fs.readFileSync('api/editorial-draft.ts','utf8');
  assert.match(source,/transport_result_unknown/);
  assert.match(source,/status = uncertain \? 'uncertain' : 'failed'/);
  assert.match(source,/não repetir automaticamente/i);
});
