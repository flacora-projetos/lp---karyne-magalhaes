import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseManifest } from './phase4-release.mjs';
import { readArticles, renderArticle } from './core.mjs';
import { selectReleaseArticles } from './phase5-release.mjs';
import { classifyInspection, ensureSitemapCurrent } from '../../lib/blogGsc.ts';
import { GoogleSearchConsoleError } from '../../lib/googleSearchConsole.ts';
test('release seletivo usa o mesmo contexto do build de produção', () => {
  const articles = readArticles('content/blog/published');
  for (const article of articles) {
    const release = buildReleaseManifest(selectReleaseArticles(articles, [article.slug]), articles);
    const relatedArticles = article.internalLinks.filter(link => link.slug).map(link => articles.find(a => a.slug === link.slug)).filter(Boolean);
    assert.equal(release.count, 1);
    assert.equal(release.releases[0].html, renderArticle(article, { preview:false, availableSlugs:new Set(articles.map(a=>a.slug)), relatedArticles }));
  }
});
test('ausência de dados após 14 dias e desconhecimento em português não viram diagnósticos falsos', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  assert.equal(classifyInspection({}, '2026-09-01', now).action_state, 'inconclusive');
  assert.equal(classifyInspection({}, '2026-09-01', now).action_reason, 'gsc_response_inconclusive');
  assert.equal(classifyInspection({inspectionResult:{indexStatusResult:{verdict:'NEUTRAL',coverageState:'O URL é desconhecido pelo Google'}}},'2026-10-08',now).knowledge_state,'unknown_to_google');
});
function harness() {
  let state:any = {site_url:'site', last_confirmed_sitemap_sha256:'H1',last_submit_confirmed_at:'2026-10-01T00:00:00Z',last_submit_status:'confirmed'};
  const runs = new Map<string,any>(); let writes=0; let clock=new Date('2026-10-09T12:00:00Z');
  let googleSubmitted='2026-10-01T00:00:00Z';
  const deps:any = {
    upsertGscState:async (row:any)=>(state={...row}),
    claimGscRun:async (_kind:string,key:string)=>{
      if(runs.has(key))return {claimed:false,reason:runs.get(key).status};
      const row={operation_key:key,status:'running'};runs.set(key,row);return {claimed:true,row,leaseToken:'token'};
    },
    finishGscRun:async (key:string,_token:string,status:string)=>{runs.get(key).status=status;},
    getGscSitemap:async ()=>({lastSubmitted:googleSubmitted}),
    submitGscSitemap:async ()=>{assert.equal(state.last_submit_status,'uncertain');writes++;googleSubmitted=clock.toISOString();},
  };
  return {deps,getState:()=>state,getWrites:()=>writes,runs,tick:()=>{clock=new Date(clock.getTime()+86400000);return clock;},clock:()=>clock,setGoogle:(value:string)=>{googleSubmitted=value}};
}
test('sitemap H1 -> H2 -> H1 e repetição de cada etapa mantêm transições idempotentes',async()=>{
 const h=harness();
 assert.equal((await ensureSitemapCurrent(h.getState(),'H1',h.clock(),h.deps)).status,'unchanged');
 assert.equal((await ensureSitemapCurrent(h.getState(),'H2',h.clock(),h.deps)).status,'confirmed');
 assert.equal((await ensureSitemapCurrent(h.getState(),'H2',h.clock(),h.deps)).status,'unchanged');
 h.tick();
 assert.equal((await ensureSitemapCurrent(h.getState(),'H1',h.clock(),h.deps)).status,'confirmed');
 assert.equal((await ensureSitemapCurrent(h.getState(),'H1',h.clock(),h.deps)).status,'unchanged');
 assert.equal(h.getWrites(),2);
 assert.equal(h.runs.size,2);
});
test('envio incerto reconcilia por leitura antes de qualquer nova escrita',async()=>{
 const h=harness();
 h.deps.submitGscSitemap=async()=>{h.setGoogle(h.clock().toISOString());throw new GoogleSearchConsoleError('timeout',{uncertain:true,code:'gsc_write_uncertain'});};
 assert.equal((await ensureSitemapCurrent(h.getState(),'H2',h.clock(),h.deps)).status,'uncertain');
 h.deps.submitGscSitemap=async()=>{throw Error('Duplicate write');};
 assert.equal((await ensureSitemapCurrent(h.getState(),'H2',h.tick(),h.deps)).status,'reconciled');
 assert.equal(h.getState().last_confirmed_sitemap_sha256,'H2');
});
