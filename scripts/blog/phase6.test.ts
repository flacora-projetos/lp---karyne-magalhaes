import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { contentFingerprint as coreContentFingerprint, presentationFingerprint as corePresentationFingerprint, readArticles } from './core.mjs';
import { buildSnapshotRelease } from './phase6-release.mjs';
import { contentFingerprint, exactApprovalState, normalizeSearch, parsePage, presentationFingerprint as adminPresentationFingerprint, validateEditableArticle } from '../../lib/blogAdmin.ts';
import { automationStartDecision, gscDailyOperationKey } from '../../lib/blogGsc.ts';
import adminHandler from '../../api/blog-admin.ts';

function response() {
  return {code:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v;},status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};
}

test('API da central Blog rejeita acesso anônimo antes de tocar no banco', async () => {
  const res=response();
  await adminHandler({method:'GET',headers:{},query:{view:'overview'}} as any,res as any);
  assert.equal(res.code,401);
  assert.equal(res.body.error,'Não autenticado');
  assert.equal(res.headers['Cache-Control'],'private, no-store');
  assert.equal(res.headers['X-Robots-Tag'],'noindex, nofollow');
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
  const snapshot={schemaVersion:1,kind:'karyne-blog-approved-snapshot',exportedAt:'2026-10-09T14:00:00Z',articleId:'db-article',articleVersionId:'db-version',content_sha256:contentHash,presentation_sha256:presentationHash,release_sha256:releaseHash,article:edited};
  const result=buildSnapshotRelease(snapshot,published);
  assert.equal(result.manifest.count,1);
  assert.equal(result.selected.version,original.version+1);
  assert.equal(result.context.length,published.length);
  assert.equal(published[0].version,original.version);
  assert.equal(result.manifest.releases[0].html_sha256,cryptoHash(result.manifest.releases[0].html));
});

function cryptoHash(value:string){return crypto.createHash('sha256').update(value).digest('hex');}

test('migration Fase 6 mantém operações privadas, transacionais e idempotentes', () => {
  const sql=fs.readFileSync('supabase/migrations/20261009133955_editorial_phase6_admin.sql','utf8');
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
