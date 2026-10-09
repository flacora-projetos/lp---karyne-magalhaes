import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {contentFingerprint,presentationFingerprint,readArticles} from './core.mjs';
import {assertContentOnlyPaths,assertNoPrivateFields,materializePublicationSnapshot,normalizedPublicationSnapshot} from './phase7-publish.mjs';
import integrationHandler from '../../api/blog-publish-integration.ts';
import {dispatchPublicationOperation,publicationUiState,validIntegrationSecret} from '../../lib/blogPublisher.ts';

const ROOT=process.cwd();
function sha(value:string){return crypto.createHash('sha256').update(value).digest('hex');}
function response(){return {code:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v;},status(code:number){this.code=code;return this;},json(body:any){this.body=body;return this;}};}
function fixture(){
  const published=readArticles('content/blog/published');
  const original=published[0];
  const article={...original,version:original.version+1,title:`${original.title} — Fase 7`,dateModified:'2026-10-09T15:30:00.000Z',status:'approved'} as any;
  const contentHash=contentFingerprint(article);const presentationHash=presentationFingerprint(article);const releaseHash=sha(JSON.stringify({contentHash,presentationHash}));
  article.approval={version:article.version,editorial:true,clinical:true,contentHash,presentationHash,releaseHash};
  return {schemaVersion:1,kind:'karyne-blog-publication-snapshot',articleId:'123e4567-e89b-42d3-a456-426614174000',articleVersionId:'123e4567-e89b-42d3-a456-426614174001',content_sha256:contentHash,presentation_sha256:presentationHash,release_sha256:releaseHash,article};
}

test('endpoint de integração não aceita chamada anônima e não expõe auth administrativa',async()=>{
  const res=response();await integrationHandler({method:'POST',headers:{},body:{action:'claim'}} as any,res as any);
  assert.equal(res.code,401);assert.equal(res.body.error,'Integração não autenticada');assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(res.headers['X-Robots-Tag'],'noindex, nofollow');
});

test('segredo da integração usa comparação exata e rejeita diferenças',()=>{
  assert.equal(validIntegrationSecret('Bearer abc123','abc123'),true);
  assert.equal(validIntegrationSecret('Bearer abc124','abc123'),false);
  assert.equal(validIntegrationSecret(undefined,'abc123'),false);
});

test('automação nasce sem dispatch quando a chave hospedada está desligada',async()=>{
  const before=process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED;delete process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED;
  try{assert.deepEqual(await dispatchPublicationOperation('123e4567-e89b-42d3-a456-426614174000'),{status:'disabled',reason:'automation_disabled'});}finally{if(before===undefined)delete process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED;else process.env.BLOG_PUBLICATION_AUTOMATION_ENABLED=before;}
});

test('estados de UI distinguem fila, publicação, sucesso e atenção',()=>{
  assert.equal(publicationUiState(null,false,null),'Aguardando revisão');
  assert.equal(publicationUiState(null,true,'hold'),'Aprovado sem publicar');
  assert.equal(publicationUiState({status:'queued'},true,'auto'),'Aguardando publicação');
  assert.equal(publicationUiState({status:'preparing'},true,'auto'),'Preparando');
  assert.equal(publicationUiState({status:'publishing'},true,'auto'),'Publicando');
  assert.equal(publicationUiState({status:'published'},true,'auto'),'Publicado');
  assert.equal(publicationUiState({status:'uncertain'},true,'auto'),'Precisa de atenção');
});

test('snapshot da Fase 7 não admite campos privados',()=>{
  const snapshot=fixture();assert.doesNotThrow(()=>assertNoPrivateFields(snapshot));
  assert.throws(()=>assertNoPrivateFields({...snapshot,reviews:[{reviewer_name:'Pessoa'}]}),/Campo privado/);
  assert.equal(normalizedPublicationSnapshot(snapshot).kind,'karyne-blog-approved-snapshot');
});

test('materialização é determinística pelo slug e remove somente o legado do mesmo artigo',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'karyne-f7-'));const input=path.join(tmp,'published');fs.mkdirSync(input,{recursive:true});
  for(const name of fs.readdirSync(path.join(ROOT,'content/blog/published')))if(name.endsWith('.json'))fs.copyFileSync(path.join(ROOT,'content/blog/published',name),path.join(input,name));
  try{
    const snapshot=fixture();const result=materializePublicationSnapshot(snapshot,input);const expected=path.join(input,`${snapshot.article.slug}.json`);
    assert.equal(result.target,expected);assert.equal(fs.existsSync(expected),true);assert.ok(result.legacySource);assert.equal(fs.existsSync(result.legacySource!),false);
    const publicJson=fs.readFileSync(expected,'utf8');assert.doesNotMatch(publicJson,/reviewer_name|recorded_by_user_id|evidence_json|lease_token|snapshot_json/);
    assert.equal(JSON.parse(publicJson).slug,snapshot.article.slug);assert.equal(result.release.html_sha256.length,64);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('gate de diff aceita só o artigo determinístico e eventual remoção legada',()=>{
  const slug='artigo-seguro';
  assert.equal(assertContentOnlyPaths([`content/blog/published/${slug}.json`],slug),true);
  assert.equal(assertContentOnlyPaths([`content/blog/published/${slug}.json`,'content/blog/published/01-antigo.json'],slug,'content/blog/published/01-antigo.json'),true);
  assert.throws(()=>assertContentOnlyPaths([`content/blog/published/${slug}.json`,'src/App.tsx'],slug),/fora do allowlist/);
  assert.throws(()=>assertContentOnlyPaths(['content/blog/published/01-antigo.json'],slug,'content/blog/published/01-antigo.json'),/arquivo determinístico/);
});

test('schema Fase 7 mantém intenção por versão, operação durável, trava global e pausa independente',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261009153732_editorial_phase7_publication.sql','utf8');
  assert.match(sql,/editorial_publication_intents/);assert.match(sql,/article_version_id uuid primary key/);assert.match(sql,/intent in \('auto','hold'\)/);
  assert.match(sql,/editorial_publication_operations/);assert.match(sql,/unique\(article_version_id, release_sha256\)/);assert.match(sql,/active_operation_id/);
  assert.match(sql,/values \('publication', true,/);assert.match(sql,/automation_key in \('gsc','publication'\)/);assert.match(sql,/enable row level security/);assert.match(sql,/revoke all .*authenticated/s);
});

test('aprovação final cria operação no mesmo RPC e somente para hashes exatos',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261009153732_editorial_phase7_publication.sql','utf8');
  const review=sql.slice(sql.indexOf('editorial_phase7_record_review'),sql.indexOf('editorial_phase7_save_version'));
  assert.match(review,/content_sha256 is distinct from p_input->>'contentSha256'/);assert.match(review,/presentation_sha256 is distinct from p_input->>'presentationSha256'/);
  assert.match(review,/v_editorial='approved' and v_clinical='approved'/);assert.match(review,/editorial_phase7_create_operation/);assert.match(review,/v_intent.intent='auto'/);
});

test('editar ou pedir correção cancela só fila pré-crítica e bloqueia reserva crítica',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261009153732_editorial_phase7_publication.sql','utf8');
  assert.match(sql,/status in \('reserved','preparing','publishing','verifying','uncertain'\)/);assert.match(sql,/status in \('queued','dispatch_pending','dispatched'\)/);
  assert.match(sql,/superseded_by_new_version/);assert.match(sql,/review_changes_requested/);assert.match(sql,/publicacao ja entrou em etapa critica/);
});

test('lease expirado após reserva vira incerto e não autoriza repetição cega',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261009153732_editorial_phase7_publication.sql','utf8');
  assert.match(sql,/lease_expired_after_reservation/);assert.match(sql,/status='uncertain'/);assert.match(sql,/reconcile_required/);
  const retry=sql.slice(sql.indexOf('editorial_phase7_retry_publication'));
  assert.match(retry,/status not in \('failed','blocked'\)/);assert.doesNotMatch(retry,/status not in \('failed','blocked','uncertain'\)/);
  assert.match(sql,/attempts >= 3/);assert.match(sql,/attempts=attempts\+1/);
});

test('workflow recebe somente operation_id, usa concorrência global e código confiável pinado',()=>{
  const yml=fs.readFileSync('.github/workflows/blog-auto-publish.yml','utf8');
  assert.match(yml,/workflow_dispatch:/);assert.match(yml,/operation_id:/);assert.doesNotMatch(yml,/snapshot:/);assert.doesNotMatch(yml,/article_url:/);
  assert.match(yml,/group: blog-production-publication/);assert.match(yml,/cancel-in-progress: false/);assert.match(yml,/BLOG_PUBLICATION_WORKFLOW_ENABLED == 'true'/);
  assert.match(yml,/actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/);assert.match(yml,/ref: main/);assert.match(yml,/persist-credentials: false/);
});

test('workflow valida build, diff content-only, avanço da main e merge sem bypass administrativo',()=>{
  const yml=fs.readFileSync('.github/workflows/blog-auto-publish.yml','utf8');
  for(const cmd of ['npm run lint','npm run test:blog','npm run build','npm run verify:build','assertContentOnlyPaths','CURRENT_MAIN','BASE_SHA','gh pr merge'])assert.match(yml,new RegExp(cmd.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(yml,/gh pr merge[^\n]*--admin/);assert.match(yml,/git add -- "\$TARGET_FILE"/);assert.match(yml,/git add -u -- "\$LEGACY_SOURCE"/);
});

test('confirmação exige merge, projeto/target/alias Vercel, HTML, canonical e sitemap reais',()=>{
  const source=fs.readFileSync('lib/blogPublisher.ts','utf8');
  assert.match(source,/githubCommitSha===mergeSha/);assert.match(source,/readyState==='READY'/);assert.match(source,/target==='production'/);assert.match(source,/BLOG_PUBLICATION_PRODUCTION_ALIAS/);assert.match(source,/alias\.includes\(BLOG_PUBLICATION_PRODUCTION_ALIAS\)/);
  assert.match(source,/html_hash_mismatch/);assert.match(source,/canonical_mismatch/);assert.match(source,/sitemap_missing_url/);assert.match(source,/editorial_confirm_gsc_publication/);assert.match(source,/editorial_phase7_mark_published/);
});

test('GSC e publicação têm chaves de ativação e controles separados; cron mantém recuperação hospedada',()=>{
  const cron=fs.readFileSync('api/blog-gsc-cron.ts','utf8');const source=fs.readFileSync('lib/blogPublisher.ts','utf8');
  assert.match(cron,/BLOG_GSC_AUTOMATION_ENABLED/);assert.match(cron,/BLOG_PUBLICATION_AUTOMATION_ENABLED/);assert.match(cron,/recoverPublicationQueue\(2\)/);
  assert.match(source,/automation_key','publication'/);assert.match(source,/\['queued','dispatch_pending','dispatched'\]/);assert.match(source,/operator_paused_before_effect/);assert.doesNotMatch(source,/Indexing API/i);
});

test('falha hospedada só fecha PR quando a ausência de merge foi reconciliada',()=>{
  const yml=fs.readFileSync('.github/workflows/blog-auto-publish.yml','utf8');
  assert.match(yml,/hosted_worker_result_uncertain/);assert.match(yml,/SAFE_FAILURE_FILE/);assert.match(yml,/reason==='pr_not_merged'/);
  assert.match(yml,/if \[ -f "\$SAFE_FAILURE_FILE" \].*gh pr close/);assert.doesNotMatch(yml,/--admin/);
});

test('confirmação editorial não depende do ciclo GSC e falha posterior do GSC não desfaz publicação',()=>{
  const source=fs.readFileSync('lib/blogPublisher.ts','utf8');
  assert.doesNotMatch(source,/runBlogGscCycle/);assert.match(source,/editorial_confirm_gsc_publication/);assert.match(source,/editorial_phase7_mark_published/);
  const cron=fs.readFileSync('api/blog-gsc-cron.ts','utf8');assert.match(cron,/runBlogGscCycle/);
});

test('três artigos históricos não são retroativamente enfileirados pela migration',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261009153732_editorial_phase7_publication.sql','utf8');
  const beforeFunctions=sql.slice(0,sql.indexOf('create or replace function public.editorial_phase7_create_operation'));
  assert.doesNotMatch(beforeFunctions,/insert into public\.editorial_publication_operations/i);assert.match(beforeFunctions,/insert into public\.editorial_automation_control/);
});
